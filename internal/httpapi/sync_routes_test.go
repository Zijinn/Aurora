package httpapi

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	feedcore "github.com/cairn-reader/cairn/internal/feed"
	"github.com/cairn-reader/cairn/internal/secretbox"
	"github.com/cairn-reader/cairn/internal/storage"
)

func TestSyncAccountAPIKeepsCredentialsPrivateAndRunsJob(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-Auth-Token") != "sync-api-secret" {
			t.Errorf("missing sync token")
		}
		switch r.URL.Path {
		case "/v1/feeds":
			_, _ = io.WriteString(w, `[]`)
		case "/v1/entries":
			_, _ = io.WriteString(w, `{"entries":[]}`)
		default:
			http.NotFound(w, r)
		}
	}))
	defer upstream.Close()

	server, httpServer := newSyncTestServer(t, nil)
	createResponse := requestJSON(t, http.MethodPost, httpServer.URL+"/api/v1/sync/accounts", map[string]any{
		"provider": "miniflux", "name": "Personal Miniflux", "endpoint": upstream.URL,
		"credentials":           map[string]string{"token": "sync-api-secret"},
		"allow_private_network": true, "sync_interval_minutes": 30,
	})
	if createResponse.StatusCode != http.StatusCreated {
		t.Fatalf("create sync account returned %d: %s", createResponse.StatusCode, readBody(t, createResponse))
	}
	body := readBody(t, createResponse)
	if strings.Contains(body, "sync-api-secret") || strings.Contains(body, "credentials") {
		t.Fatalf("sync account response exposed credentials: %s", body)
	}
	var account struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal([]byte(body), &account); err != nil || account.ID == "" {
		t.Fatalf("decode account: %+v %v", account, err)
	}

	runResponse := requestJSON(t, http.MethodPost, httpServer.URL+"/api/v1/sync/accounts/"+account.ID+"/sync", nil)
	if runResponse.StatusCode != http.StatusAccepted {
		t.Fatalf("queue sync returned %d: %s", runResponse.StatusCode, readBody(t, runResponse))
	}
	var queued struct {
		ID string `json:"id"`
	}
	decodeResponse(t, runResponse, &queued)
	waitForJobState(t, httpServer.URL, queued.ID, "succeeded")

	accountsResponse, err := http.Get(httpServer.URL + "/api/v1/sync/accounts")
	if err != nil {
		t.Fatal(err)
	}
	accountsBody := readBody(t, accountsResponse)
	if !strings.Contains(accountsBody, `"last_sync_at":`) || strings.Contains(accountsBody, "sync-api-secret") {
		t.Fatalf("unexpected account list: %s", accountsBody)
	}

	deleteRequest, _ := http.NewRequest(http.MethodDelete, httpServer.URL+"/api/v1/sync/accounts/"+account.ID, nil)
	deleteResponse, err := http.DefaultClient.Do(deleteRequest)
	if err != nil {
		t.Fatal(err)
	}
	defer deleteResponse.Body.Close()
	if deleteResponse.StatusCode != http.StatusNoContent {
		t.Fatalf("delete sync account returned %d", deleteResponse.StatusCode)
	}
	_ = server
}

func TestSyncFailureDoesNotBlockLocalFeedRefresh(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/feed":
			w.Header().Set("Content-Type", "application/rss+xml")
			_, _ = io.WriteString(w, integrationRSS)
		case "/sync/v1/feeds":
			http.Error(w, "remote unavailable", http.StatusInternalServerError)
		default:
			http.NotFound(w, r)
		}
	}))
	defer upstream.Close()
	feedFetcher := feedcore.NewFetcher()
	feedFetcher.Policy.AllowPrivate = true
	_, httpServer := newSyncTestServer(t, feedFetcher)

	feedResponse := requestJSON(t, http.MethodPost, httpServer.URL+"/api/v1/feeds", map[string]string{"url": upstream.URL + "/feed"})
	if feedResponse.StatusCode != http.StatusCreated {
		t.Fatalf("create feed returned %d: %s", feedResponse.StatusCode, readBody(t, feedResponse))
	}
	var feed struct {
		ID string `json:"id"`
	}
	decodeResponse(t, feedResponse, &feed)

	accountResponse := requestJSON(t, http.MethodPost, httpServer.URL+"/api/v1/sync/accounts", map[string]any{
		"provider": "miniflux", "name": "Failing remote", "endpoint": upstream.URL + "/sync",
		"credentials": map[string]string{"token": "test"}, "allow_private_network": true,
	})
	var account struct {
		ID string `json:"id"`
	}
	decodeResponse(t, accountResponse, &account)

	syncResponse := requestJSON(t, http.MethodPost, httpServer.URL+"/api/v1/sync/accounts/"+account.ID+"/sync", nil)
	var syncJob struct {
		ID string `json:"id"`
	}
	decodeResponse(t, syncResponse, &syncJob)
	refreshResponse := requestJSON(t, http.MethodPost, httpServer.URL+"/api/v1/feeds/"+feed.ID+"/refresh", nil)
	var refreshJob struct {
		ID string `json:"id"`
	}
	decodeResponse(t, refreshResponse, &refreshJob)

	waitForJobState(t, httpServer.URL, syncJob.ID, "failed")
	waitForJobState(t, httpServer.URL, refreshJob.ID, "succeeded")
}

func newSyncTestServer(t *testing.T, fetcher *feedcore.Fetcher) (*Server, *httptest.Server) {
	t.Helper()
	db, err := storage.Open(context.Background(), filepath.Join(t.TempDir(), "cairn.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	box, err := secretbox.LoadOrCreate(filepath.Join(t.TempDir(), "master.key"))
	if err != nil {
		t.Fatal(err)
	}
	server := NewWithFetcher(db, slog.New(slog.NewTextHandler(io.Discard, nil)), "", fetcher)
	server.ConfigureSync(box)
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	if err := server.Start(ctx); err != nil {
		t.Fatal(err)
	}
	httpServer := httptest.NewServer(server.Handler())
	t.Cleanup(httpServer.Close)
	return server, httpServer
}
