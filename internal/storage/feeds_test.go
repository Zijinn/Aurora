package storage

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"github.com/Zijinn/Aurora/internal/domain"
)

func TestFeedEntryDedupSearchAndMutationIdempotency(t *testing.T) {
	ctx := context.Background()
	db, err := Open(ctx, filepath.Join(t.TempDir(), "cairn.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	guid := "entry-guid"
	entryURL := "https://example.com/entry"
	initial := domain.ParsedFeed{
		Title: "Example", Format: "rss",
		Entries: []domain.ParsedEntry{{
			GUID: &guid, CanonicalURL: &entryURL, Title: "Initial title",
			PublishedAt: time.Now().UTC(), ContentHash: "hash-one",
			SanitizedHTML: "<p>Initial body</p>", PlainText: "Initial body",
		}},
	}
	created, err := SaveNewFeed(ctx, db, domain.DefaultProfileID, "https://example.com/feed", "https://example.com/feed", initial, nil, nil, nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	subscriptions, err := ListSubscriptions(ctx, db, domain.DefaultProfileID)
	if err != nil || len(subscriptions) != 1 || subscriptions[0].UnreadCount != 1 {
		t.Fatalf("unexpected subscriptions: %+v, %v", subscriptions, err)
	}

	updated := initial
	updated.Entries = []domain.ParsedEntry{{
		GUID: &guid, CanonicalURL: &entryURL, Title: "Updated searchable title",
		PublishedAt: initial.Entries[0].PublishedAt, ContentHash: "hash-two",
		SanitizedHTML: "<p>Updated body</p>", PlainText: "needle content",
	}}
	inserted, err := SaveFeedRefresh(ctx, db, domain.DefaultProfileID, created.ID, updated, nil, nil)
	if err != nil || inserted != 0 {
		t.Fatalf("expected deduplicated update, inserted=%d err=%v", inserted, err)
	}
	var count int
	if err := db.QueryRowContext(ctx, "SELECT COUNT(*) FROM entries WHERE feed_id = ?", created.ID).Scan(&count); err != nil || count != 1 {
		t.Fatalf("expected one entry, count=%d err=%v", count, err)
	}
	page, err := ListEntries(ctx, db, domain.EntryFilter{ProfileID: domain.DefaultProfileID, Query: "needle", Limit: 10})
	if err != nil || len(page.Items) != 1 || page.Items[0].Title != "Updated searchable title" {
		t.Fatalf("unexpected FTS result: %+v, %v", page, err)
	}

	entryID := page.Items[0].ID
	truth := true
	falsehood := false
	state, err := UpdateEntryState(ctx, db, domain.DefaultProfileID, entryID, domain.EntryStatePatch{MutationID: "mutation-1", IsRead: &truth})
	if err != nil || !state.IsRead {
		t.Fatalf("mark read: %+v, %v", state, err)
	}
	state, err = UpdateEntryState(ctx, db, domain.DefaultProfileID, entryID, domain.EntryStatePatch{MutationID: "mutation-1", IsRead: &falsehood})
	if err != nil || !state.IsRead {
		t.Fatalf("duplicate mutation should be ignored: %+v, %v", state, err)
	}
	state, err = UpdateEntryState(ctx, db, domain.DefaultProfileID, entryID, domain.EntryStatePatch{MutationID: "mutation-2", IsRead: &falsehood})
	if err != nil || state.IsRead {
		t.Fatalf("new mutation should apply: %+v, %v", state, err)
	}
}

func TestEmptySubscriptionHasZeroUnreadAndFailureBackoffUsesRFC3339(t *testing.T) {
	ctx := context.Background()
	db, err := Open(ctx, filepath.Join(t.TempDir(), "cairn.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	created, err := SaveNewFeed(ctx, db, domain.DefaultProfileID, "https://example.com/empty", "https://example.com/empty", domain.ParsedFeed{Title: "Empty", Format: "rss"}, nil, nil, nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	subscriptions, err := ListSubscriptions(ctx, db, domain.DefaultProfileID)
	if err != nil || subscriptions[0].UnreadCount != 0 {
		t.Fatalf("empty subscription should have zero unread: %+v, %v", subscriptions, err)
	}
	if err := MarkFeedFailure(ctx, db, created.ID, "network", "offline"); err != nil {
		t.Fatal(err)
	}
	failed, err := GetFeed(ctx, db, created.ID)
	if err != nil || failed.FailureCount != 1 || failed.NextCheckAt == nil {
		t.Fatalf("unexpected failed feed: %+v, %v", failed, err)
	}
	if _, err := time.Parse(time.RFC3339Nano, formatTime(*failed.NextCheckAt)); err != nil {
		t.Fatalf("next check is not RFC3339: %v", err)
	}
	remaining := time.Until(*failed.NextCheckAt)
	if remaining < 4*time.Minute || remaining > 6*time.Minute {
		t.Fatalf("unexpected first backoff %s", remaining)
	}
}
