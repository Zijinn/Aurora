package storage

import (
	"context"
	"database/sql"
	"fmt"
	"sort"
	"strings"
	"time"

	feedcore "github.com/Zijinn/Aurora/internal/feed"
)

type entryIdentityRecord struct {
	id           string
	feedID       string
	guid         string
	canonicalURL string
	identityHash string
	createdAt    string
}

// ReconcileEntryIdentities backfills identity data after the identity migration and
// merges duplicates within the same feed while preserving reading state and tags.
func ReconcileEntryIdentities(ctx context.Context, db *sql.DB) error {
	rows, err := db.QueryContext(ctx, `
		SELECT e.id, e.feed_id, COALESCE(e.guid, ''), COALESCE(e.canonical_url, ''),
			COALESCE(e.identity_hash, ''), e.title, COALESCE(e.author, ''), e.published_at,
			COALESCE(ec.plain_text, ''), e.created_at
		FROM entries e
		LEFT JOIN entry_contents ec ON ec.entry_id = e.id
		ORDER BY e.feed_id, e.created_at, e.id`)
	if err != nil {
		return fmt.Errorf("list entries for deduplication: %w", err)
	}
	defer rows.Close()

	type pendingEntry struct {
		entryIdentityRecord
		title, author, publishedAt, plainText string
	}
	entries := make([]pendingEntry, 0)
	for rows.Next() {
		var entry pendingEntry
		if err := rows.Scan(&entry.id, &entry.feedID, &entry.guid, &entry.canonicalURL, &entry.identityHash,
			&entry.title, &entry.author, &entry.publishedAt, &entry.plainText, &entry.createdAt); err != nil {
			return fmt.Errorf("scan entry for deduplication: %w", err)
		}
		entries = append(entries, entry)
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("iterate entries for deduplication: %w", err)
	}

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin entry deduplication: %w", err)
	}
	defer tx.Rollback()
	groups := make(map[string][]entryIdentityRecord)
	normalizedURLs := make(map[string]string)
	for _, entry := range entries {
		canonicalURL := entry.canonicalURL
		if canonicalURL != "" {
			if normalized, normalizeErr := feedcore.NormalizeURL(canonicalURL); normalizeErr == nil {
				canonicalURL = normalized
				normalizedURLs[entry.id] = canonicalURL
			}
		}
		publishedAt, parseErr := time.Parse(time.RFC3339Nano, entry.publishedAt)
		var publishedPointer *time.Time
		if parseErr == nil {
			publishedPointer = &publishedAt
		}
		identityHash := feedcore.ComputeIdentityHash(entry.title, entry.author, publishedPointer, entry.plainText)
		if identityHash != entry.identityHash {
			if _, err := tx.ExecContext(ctx, "UPDATE entries SET identity_hash = ? WHERE id = ?", identityHash, entry.id); err != nil {
				return fmt.Errorf("backfill entry identity: %w", err)
			}
		}
		record := entryIdentityRecord{id: entry.id, feedID: entry.feedID, guid: entry.guid, canonicalURL: canonicalURL, identityHash: identityHash, createdAt: entry.createdAt}
		for _, key := range []string{
			identityKey("guid", record.guid),
			identityKey("url", record.canonicalURL),
			identityKey("identity", record.identityHash),
		} {
			if key != "" {
				groups[record.feedID+"\x00"+key] = append(groups[record.feedID+"\x00"+key], record)
			}
		}
	}

	seenPairs := make(map[string]bool)
	removed := make(map[string]bool)
	for _, group := range groups {
		active := make([]entryIdentityRecord, 0, len(group))
		for _, record := range group {
			if !removed[record.id] {
				active = append(active, record)
			}
		}
		if len(active) < 2 {
			continue
		}
		sort.SliceStable(active, func(i, j int) bool { return active[i].createdAt < active[j].createdAt })
		survivor := active[0]
		for _, duplicate := range active[1:] {
			pair := survivor.id + "\x00" + duplicate.id
			if seenPairs[pair] {
				continue
			}
			seenPairs[pair] = true
			if err := mergeEntry(ctx, tx, survivor.id, duplicate.id); err != nil {
				return err
			}
			removed[duplicate.id] = true
		}
	}
	for entryID, canonicalURL := range normalizedURLs {
		if removed[entryID] || canonicalURL == "" {
			continue
		}
		if _, err := tx.ExecContext(ctx, "UPDATE entries SET canonical_url = ? WHERE id = ?", canonicalURL, entryID); err != nil {
			return fmt.Errorf("normalize entry URL: %w", err)
		}
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit entry deduplication: %w", err)
	}
	return nil
}

func identityKey(kind, value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	return kind + ":" + value
}

func mergeEntry(ctx context.Context, tx *sql.Tx, survivorID, duplicateID string) error {
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO entry_states (profile_id, entry_id, is_read, is_starred, is_read_later, read_at, updated_at, updated_by_device_id)
		SELECT profile_id, ?, is_read, is_starred, is_read_later, read_at, updated_at, updated_by_device_id
		FROM entry_states WHERE entry_id = ?
		ON CONFLICT(profile_id, entry_id) DO UPDATE SET
			is_read = MIN(entry_states.is_read, excluded.is_read),
			is_starred = MAX(entry_states.is_starred, excluded.is_starred),
			is_read_later = MAX(entry_states.is_read_later, excluded.is_read_later),
			read_at = COALESCE(entry_states.read_at, excluded.read_at),
			updated_at = MAX(entry_states.updated_at, excluded.updated_at),
			updated_by_device_id = COALESCE(entry_states.updated_by_device_id, excluded.updated_by_device_id)`, survivorID, duplicateID); err != nil {
		return fmt.Errorf("merge entry state: %w", err)
	}
	if _, err := tx.ExecContext(ctx, `INSERT OR IGNORE INTO entry_tags(entry_id, tag_id) SELECT ?, tag_id FROM entry_tags WHERE entry_id = ?`, survivorID, duplicateID); err != nil {
		return fmt.Errorf("merge entry tags: %w", err)
	}
	for _, statement := range []string{
		"UPDATE ai_results SET entry_id = ? WHERE entry_id = ?",
		"UPDATE ai_chat_sessions SET entry_id = ? WHERE entry_id = ?",
		"UPDATE ai_usage SET entry_id = ? WHERE entry_id = ?",
	} {
		if _, err := tx.ExecContext(ctx, statement, survivorID, duplicateID); err != nil {
			return fmt.Errorf("merge entry references: %w", err)
		}
	}
	if _, err := tx.ExecContext(ctx, "DELETE FROM entries WHERE id = ?", duplicateID); err != nil {
		return fmt.Errorf("delete duplicate entry: %w", err)
	}
	return nil
}
