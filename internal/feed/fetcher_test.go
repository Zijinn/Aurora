package feed

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestNewFetcherUsesFiveMinuteTimeout(t *testing.T) {
	fetcher := NewFetcher()
	if fetcher.Timeout != 300*time.Second {
		t.Fatalf("unexpected fetch timeout: %s", fetcher.Timeout)
	}
}

func TestFetcherUsesConditionalHeaders(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("If-None-Match") == `"v1"` {
			w.WriteHeader(http.StatusNotModified)
			return
		}
		w.Header().Set("ETag", `"v1"`)
		w.Header().Set("Content-Type", "application/rss+xml; charset=utf-8")
		_, _ = w.Write(readFixture(t, "rss.xml"))
	}))
	defer server.Close()

	fetcher := NewFetcher()
	fetcher.Policy.AllowPrivate = true
	first, err := fetcher.Fetch(context.Background(), server.URL, Validators{})
	if err != nil || first.ETag == nil || first.NotModified {
		t.Fatalf("unexpected first response: %+v, %v", first, err)
	}
	second, err := fetcher.Fetch(context.Background(), server.URL, Validators{ETag: first.ETag})
	if err != nil || !second.NotModified {
		t.Fatalf("expected conditional response: %+v, %v", second, err)
	}
}

func TestFetcherEnforcesResponseLimit(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(strings.Repeat("x", 128)))
	}))
	defer server.Close()
	fetcher := NewFetcher()
	fetcher.Policy.AllowPrivate = true
	fetcher.MaxResponseBytes = 64
	_, err := fetcher.Fetch(context.Background(), server.URL, Validators{})
	var fetchError *FetchError
	if !errors.As(err, &fetchError) || fetchError.Code != "response_too_large" {
		t.Fatalf("expected response_too_large, got %v", err)
	}
}

func TestDefaultPolicyBlocksLoopback(t *testing.T) {
	_, err := NewFetcher().Fetch(context.Background(), "http://127.0.0.1/feed", Validators{})
	if !errors.Is(err, ErrBlockedAddress) {
		t.Fatalf("expected blocked loopback, got %v", err)
	}
}

func TestDiscovererFindsAlternateFeeds(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		_, _ = w.Write([]byte(`<html><head><title>Example</title><link rel="alternate" type="application/rss+xml" title="News" href="/feed.xml"></head></html>`))
	}))
	defer server.Close()
	fetcher := NewFetcher()
	fetcher.Policy.AllowPrivate = true
	candidates, err := NewDiscoverer(fetcher, NewParser()).Discover(context.Background(), server.URL)
	if err != nil || len(candidates) != 1 || candidates[0].URL != server.URL+"/feed.xml" {
		t.Fatalf("unexpected candidates: %+v, %v", candidates, err)
	}
}
