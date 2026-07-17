package storage

import (
	"context"
	"encoding/json"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/Zijinn/Aurora/internal/domain"
)

func TestLibrarySnapshotIsPortableAndPreservesLocalAccounts(t *testing.T) {
	ctx := context.Background()
	db, err := Open(ctx, filepath.Join(t.TempDir(), "aurora.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	guid := "portable-entry"
	if _, err := SaveNewFeed(ctx, db, domain.DefaultProfileID, "https://example.com/feed", "https://example.com/feed", domain.ParsedFeed{
		Title: "Portable feed", Format: "rss", Entries: []domain.ParsedEntry{{
			GUID: &guid, Title: "Portable article", PublishedAt: time.Now().UTC(),
			ContentHash: "portable-hash", SanitizedHTML: "<p>Portable</p>", PlainText: "Portable",
		}},
	}, nil, nil, nil, nil); err != nil {
		t.Fatal(err)
	}
	if _, err := CreateSyncAccount(ctx, db, CreateSyncAccountParams{
		ID: "local-webdav", Provider: "webdav", Name: "Local WebDAV",
		Endpoint: "https://dav.example.test/aurora.json", EncryptedCredentials: []byte("ciphertext"),
		Enabled: true, SyncIntervalMinutes: 30,
	}); err != nil {
		t.Fatal(err)
	}

	document, err := ExportLibrarySnapshot(ctx, db)
	if err != nil {
		t.Fatal(err)
	}
	body, err := json.Marshal(document)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(body), "sync_accounts") || strings.Contains(string(body), "ciphertext") {
		t.Fatalf("portable snapshot exposed local account data: %s", body)
	}
	if err := RestoreLibrarySnapshot(ctx, db, document); err != nil {
		t.Fatal(err)
	}
	accounts, err := ListSyncAccounts(ctx, db, domain.DefaultProfileID)
	if err != nil || len(accounts) != 1 || accounts[0].ID != "local-webdav" {
		t.Fatalf("local sync account was not preserved: %+v %v", accounts, err)
	}
	page, err := ListEntries(ctx, db, domain.EntryFilter{ProfileID: domain.DefaultProfileID, Limit: 10})
	if err != nil || len(page.Items) != 1 || page.Items[0].Title != "Portable article" {
		t.Fatalf("snapshot library did not restore: %+v %v", page, err)
	}
}

func TestLibrarySnapshotFingerprintIgnoresExportTime(t *testing.T) {
	ctx := context.Background()
	db, err := Open(ctx, filepath.Join(t.TempDir(), "aurora.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	first, err := ExportLibrarySnapshot(ctx, db)
	if err != nil {
		t.Fatal(err)
	}
	second, err := ExportLibrarySnapshot(ctx, db)
	if err != nil {
		t.Fatal(err)
	}
	firstHash, _ := LibrarySnapshotFingerprint(first)
	secondHash, _ := LibrarySnapshotFingerprint(second)
	if firstHash == "" || firstHash != secondHash {
		t.Fatalf("stable snapshot fingerprint mismatch: %q %q", firstHash, secondHash)
	}
}
