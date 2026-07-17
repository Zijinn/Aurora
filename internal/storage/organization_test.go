package storage

import (
	"context"
	"encoding/json"
	"path/filepath"
	"testing"
	"time"

	"github.com/cairn-reader/cairn/internal/domain"
)

func TestFolderCycleAndAutomationRules(t *testing.T) {
	ctx := context.Background()
	db, err := Open(ctx, filepath.Join(t.TempDir(), "cairn.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	root, err := EnsureFolder(ctx, db, domain.DefaultProfileID, nil, "Research")
	if err != nil {
		t.Fatal(err)
	}
	child, err := EnsureFolder(ctx, db, domain.DefaultProfileID, &root.ID, "Economics")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := UpdateFolder(ctx, db, domain.DefaultProfileID, root.ID, &child.ID, nil, nil); err == nil {
		t.Fatal("expected folder cycle to be rejected")
	}

	tag, err := CreateTag(ctx, db, domain.DefaultProfileID, "Important", nil)
	if err != nil {
		t.Fatal(err)
	}
	conditions, _ := json.Marshal(map[string]string{"title_contains": "cairn"})
	actions, _ := json.Marshal(map[string]any{"star": true, "read_later": true, "add_tag_ids": []string{tag.ID}})
	if _, err := CreateRule(ctx, db, domain.DefaultProfileID, "Save Cairn posts", true, 0, conditions, actions); err != nil {
		t.Fatal(err)
	}
	guid := "rule-entry"
	entryURL := "https://example.com/rule"
	feed, err := SaveNewFeed(ctx, db, domain.DefaultProfileID, "https://example.com/feed", "https://example.com/feed", domain.ParsedFeed{
		Title: "Rules", Format: "rss", Entries: []domain.ParsedEntry{{
			GUID: &guid, CanonicalURL: &entryURL, Title: "Cairn automation",
			PublishedAt: time.Now().UTC(), ContentHash: "rule-hash", PlainText: "body",
		}},
	}, nil, nil, &child.ID, nil)
	if err != nil {
		t.Fatal(err)
	}
	if err := ApplyRulesToFeed(ctx, db, domain.DefaultProfileID, feed.ID); err != nil {
		t.Fatal(err)
	}
	page, err := ListEntries(ctx, db, domain.EntryFilter{ProfileID: domain.DefaultProfileID, FeedID: feed.ID, Limit: 10})
	if err != nil || len(page.Items) != 1 || !page.Items[0].State.IsStarred || !page.Items[0].State.IsReadLater {
		t.Fatalf("rule actions did not apply: %+v, %v", page, err)
	}
	var tagCount int
	if err := db.QueryRowContext(ctx, "SELECT COUNT(*) FROM entry_tags WHERE entry_id = ? AND tag_id = ?", page.Items[0].ID, tag.ID).Scan(&tagCount); err != nil || tagCount != 1 {
		t.Fatalf("rule tag action failed: count=%d err=%v", tagCount, err)
	}
	if len(page.Items[0].TagIDs) != 1 || page.Items[0].TagIDs[0] != tag.ID {
		t.Fatalf("entry response omitted assigned tag: %+v", page.Items[0].TagIDs)
	}
	tagged, err := ListEntries(ctx, db, domain.EntryFilter{ProfileID: domain.DefaultProfileID, TagID: tag.ID, Limit: 10})
	if err != nil || len(tagged.Items) != 1 || tagged.Items[0].ID != page.Items[0].ID {
		t.Fatalf("tag filter failed: %+v, %v", tagged, err)
	}
	if err := SetEntryTags(ctx, db, domain.DefaultProfileID, page.Items[0].ID, []string{tag.ID, tag.ID}); err != nil {
		t.Fatal(err)
	}
	detail, err := GetEntry(ctx, db, domain.DefaultProfileID, page.Items[0].ID)
	if err != nil || len(detail.TagIDs) != 1 || detail.TagIDs[0] != tag.ID {
		t.Fatalf("entry detail tags failed: %+v, %v", detail.TagIDs, err)
	}

	filterQuery := json.RawMessage(`{"state":"starred"}`)
	if _, err := CreateSavedFilter(ctx, db, domain.DefaultProfileID, "Favorites", filterQuery); err != nil {
		t.Fatal(err)
	}
	filters, err := ListSavedFilters(ctx, db, domain.DefaultProfileID)
	if err != nil || len(filters) != 1 {
		t.Fatalf("saved filters failed: %+v, %v", filters, err)
	}
}

func TestMarkEntriesReadRespectsStateFilter(t *testing.T) {
	ctx := context.Background()
	db, err := Open(ctx, filepath.Join(t.TempDir(), "cairn.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	firstGUID, secondGUID := "starred-entry", "plain-entry"
	firstURL, secondURL := "https://example.com/starred", "https://example.com/plain"
	feed, err := SaveNewFeed(ctx, db, domain.DefaultProfileID, "https://example.com/bulk-feed", "https://example.com/bulk-feed", domain.ParsedFeed{
		Title: "Bulk state", Format: "rss", Entries: []domain.ParsedEntry{
			{GUID: &firstGUID, CanonicalURL: &firstURL, Title: "Starred", PublishedAt: time.Now().UTC(), ContentHash: "starred-hash", PlainText: "starred"},
			{GUID: &secondGUID, CanonicalURL: &secondURL, Title: "Plain", PublishedAt: time.Now().UTC().Add(-time.Minute), ContentHash: "plain-hash", PlainText: "plain"},
		},
	}, nil, nil, nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	page, err := ListEntries(ctx, db, domain.EntryFilter{ProfileID: domain.DefaultProfileID, FeedID: feed.ID, Limit: 10})
	if err != nil || len(page.Items) != 2 {
		t.Fatalf("list bulk state entries: %+v, %v", page, err)
	}
	starredID, plainID := page.Items[0].ID, page.Items[1].ID
	starred := true
	if _, err := UpdateEntryState(ctx, db, domain.DefaultProfileID, starredID, domain.EntryStatePatch{MutationID: "starred-filter-state", IsStarred: &starred}); err != nil {
		t.Fatal(err)
	}
	count, err := MarkEntriesRead(ctx, db, domain.EntryFilter{ProfileID: domain.DefaultProfileID, State: "starred"})
	if err != nil || count != 1 {
		t.Fatalf("mark starred entries read: count=%d err=%v", count, err)
	}
	starredEntry, err := GetEntry(ctx, db, domain.DefaultProfileID, starredID)
	if err != nil || !starredEntry.State.IsRead {
		t.Fatalf("starred entry was not marked read: %+v, %v", starredEntry.State, err)
	}
	plainEntry, err := GetEntry(ctx, db, domain.DefaultProfileID, plainID)
	if err != nil || plainEntry.State.IsRead {
		t.Fatalf("unfiltered entry was unexpectedly marked read: %+v, %v", plainEntry.State, err)
	}
}
