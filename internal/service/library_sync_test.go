package service

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"sync"
	"testing"
	"time"

	"github.com/Zijinn/Aurora/internal/domain"
	"github.com/Zijinn/Aurora/internal/secretbox"
	"github.com/Zijinn/Aurora/internal/storage"
	"github.com/Zijinn/Aurora/internal/syncadapter"
)

func TestLibrarySyncCanMirrorWebDAVAndICloudTogether(t *testing.T) {
	if runtime.GOOS != "darwin" && runtime.GOOS != "windows" {
		t.Skip("iCloud Drive is available only on macOS and Windows")
	}
	ctx := context.Background()
	db, err := storage.Open(ctx, filepath.Join(t.TempDir(), "aurora.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	box, err := secretbox.LoadOrCreate(filepath.Join(t.TempDir(), "master.key"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := storage.SaveNewFeed(ctx, db, domain.DefaultProfileID, "https://example.com/feed", "https://example.com/feed", domain.ParsedFeed{
		Title: "Mirrored feed", Format: "rss", Entries: []domain.ParsedEntry{{
			Title: "Mirrored article", PublishedAt: time.Now().UTC(), ContentHash: "mirrored",
			SanitizedHTML: "<p>Mirrored</p>", PlainText: "Mirrored",
		}},
	}, nil, nil, nil, nil); err != nil {
		t.Fatal(err)
	}

	var mu sync.Mutex
	var webDAVBody []byte
	webDAV := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		defer mu.Unlock()
		switch r.Method {
		case http.MethodGet:
			if len(webDAVBody) == 0 {
				http.NotFound(w, r)
				return
			}
			_, _ = w.Write(webDAVBody)
		case http.MethodPut:
			webDAVBody, _ = io.ReadAll(r.Body)
			w.WriteHeader(http.StatusCreated)
		default:
			http.Error(w, "unsupported", http.StatusMethodNotAllowed)
		}
	}))
	defer webDAV.Close()

	home := t.TempDir()
	t.Setenv("HOME", home)
	iCloudFile := filepath.Join(home, "Library", "Mobile Documents", "com~apple~CloudDocs", "Aurora", "aurora-library.json")
	syncService := newSyncService(db, NewFeedService(db, nil), box, func(bool) *http.Client { return webDAV.Client() })
	webDAVAccount, err := syncService.CreateAccount(ctx, SyncAccountInput{
		Provider: "webdav", Name: "WebDAV mirror", Endpoint: webDAV.URL + "/aurora-library.json",
		Credentials: syncadapter.Credentials{Username: "aurora", Password: "secret"}, AllowPrivateNetwork: true,
	})
	if err != nil {
		t.Fatal(err)
	}
	iCloudAccount, err := syncService.CreateAccount(ctx, SyncAccountInput{Provider: "icloud", Name: "iCloud mirror", Endpoint: iCloudFile})
	if err != nil {
		t.Fatal(err)
	}
	webDAVResult, err := syncService.Run(ctx, webDAVAccount.ID, nil)
	if err != nil || webDAVResult.Action != "push" {
		t.Fatalf("WebDAV initial mirror failed: %+v %v", webDAVResult, err)
	}
	iCloudResult, err := syncService.Run(ctx, iCloudAccount.ID, nil)
	if err != nil || iCloudResult.Action != "push" {
		t.Fatalf("iCloud initial mirror failed: %+v %v", iCloudResult, err)
	}
	mu.Lock()
	webDAVWritten := len(webDAVBody) > 0
	mu.Unlock()
	if !webDAVWritten {
		t.Fatal("WebDAV mirror did not receive a snapshot")
	}
	if info, err := os.Stat(iCloudFile); err != nil || info.Size() == 0 {
		t.Fatalf("iCloud mirror was not written: %v", err)
	}
	accounts, err := syncService.ListAccounts(ctx)
	if err != nil || len(accounts) != 2 || !accounts[0].Enabled || !accounts[1].Enabled {
		t.Fatalf("cloud targets were not enabled together: %+v %v", accounts, err)
	}
}

func TestICloudRootsRejectUnsupportedPlatforms(t *testing.T) {
	if _, err := iCloudRootsForPlatform("linux", t.TempDir()); err == nil {
		t.Fatal("expected Linux iCloud Drive synchronization to be rejected")
	}

	home := t.TempDir()
	darwinRoots, err := iCloudRootsForPlatform("darwin", home)
	if err != nil || len(darwinRoots) != 1 || darwinRoots[0] != filepath.Join(home, "Library", "Mobile Documents", "com~apple~CloudDocs") {
		t.Fatalf("unexpected macOS roots: %v %v", darwinRoots, err)
	}
	windowsRoots, err := iCloudRootsForPlatform("windows", home)
	if err != nil || len(windowsRoots) != 1 || windowsRoots[0] != filepath.Join(home, "iCloudDrive") {
		t.Fatalf("unexpected Windows roots: %v %v", windowsRoots, err)
	}
}

func TestLibrarySyncRequiresConflictChoice(t *testing.T) {
	local := storage.BackupDocument{Format: storage.LibrarySnapshotFormat, Version: 1, Tables: []storage.BackupTable{{Name: "feeds", Rows: [][]storage.BackupValue{{{Kind: "text", Text: "local"}}}}}}
	action, err := chooseLibrarySyncAction(local, "local-hash", true, "remote-hash", librarySyncCursor{})
	if err == nil || action != "" || syncadapter.ErrorCode(err) != "conflict" {
		t.Fatalf("expected an explicit first-sync conflict, got action=%q err=%v", action, err)
	}
	action, err = chooseLibrarySyncAction(local, "local-new", true, "remote-new", librarySyncCursor{LocalFingerprint: "local-old", RemoteFingerprint: "remote-old"})
	if err == nil || action != "" || syncadapter.ErrorCode(err) != "conflict" {
		t.Fatalf("expected a two-sided conflict, got action=%q err=%v", action, err)
	}
}
