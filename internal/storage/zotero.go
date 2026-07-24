package storage

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"
)

type ZoteroEntry struct {
	ID           string
	Title        string
	Author       string
	Journal      string
	CanonicalURL string
	Summary      string
	Content      string
	PublishedAt  time.Time
	Language     string
	DOI          string
	Tags         []string
}

type ZoteroExport struct {
	EntryID             string    `json:"entry_id"`
	ZoteroItemKey       string    `json:"zotero_item_key,omitempty"`
	LibraryID           string    `json:"library_id,omitempty"`
	LibraryName         string    `json:"library_name,omitempty"`
	CollectionID        string    `json:"collection_id,omitempty"`
	CollectionName      string    `json:"collection_name,omitempty"`
	MetadataFingerprint string    `json:"metadata_fingerprint"`
	ExportedAt          time.Time `json:"exported_at"`
	UpdatedAt           time.Time `json:"updated_at"`
}

func GetZoteroEntry(ctx context.Context, db *sql.DB, profileID, entryID string) (ZoteroEntry, error) {
	var item ZoteroEntry
	var author, canonicalURL, summary, content, language, doi, publishedAt sql.NullString
	err := db.QueryRowContext(ctx, `SELECT e.id, e.title, e.author, COALESCE(s.title_override, f.title),
		e.canonical_url, e.summary,
		COALESCE(NULLIF(ec.readability_text, ''), NULLIF(ec.plain_text, ''), NULLIF(e.summary, ''), e.title),
		e.published_at, e.language, e.doi
		FROM entries e
		JOIN feeds f ON f.id = e.feed_id
		JOIN subscriptions s ON s.feed_id = e.feed_id AND s.profile_id = ?
		LEFT JOIN entry_contents ec ON ec.entry_id = e.id
		WHERE e.id = ?`, profileID, entryID).Scan(
		&item.ID, &item.Title, &author, &item.Journal, &canonicalURL, &summary,
		&content, &publishedAt, &language, &doi,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return ZoteroEntry{}, ErrNotFound
	}
	if err != nil {
		return ZoteroEntry{}, fmt.Errorf("get Zotero entry: %w", err)
	}
	item.Author = author.String
	item.CanonicalURL = canonicalURL.String
	item.Summary = summary.String
	item.Content = content.String
	item.Language = language.String
	item.DOI = doi.String
	if publishedAt.Valid {
		item.PublishedAt, _ = time.Parse(time.RFC3339Nano, publishedAt.String)
	}
	rows, err := db.QueryContext(ctx, `SELECT t.name FROM tags t
		JOIN entry_tags et ON et.tag_id = t.id WHERE et.entry_id = ? ORDER BY t.position, t.name`, entryID)
	if err != nil {
		return ZoteroEntry{}, err
	}
	defer rows.Close()
	for rows.Next() {
		var tag string
		if err := rows.Scan(&tag); err != nil {
			return ZoteroEntry{}, err
		}
		item.Tags = append(item.Tags, tag)
	}
	return item, rows.Err()
}

func GetZoteroExport(ctx context.Context, db *sql.DB, profileID, entryID string) (ZoteroExport, error) {
	var item ZoteroExport
	var itemKey, libraryID, libraryName, collectionID, collectionName sql.NullString
	var exportedAt, updatedAt string
	err := db.QueryRowContext(ctx, `SELECT entry_id, zotero_item_key, library_id, library_name,
		collection_id, collection_name, metadata_fingerprint, exported_at, updated_at
		FROM zotero_exports WHERE profile_id = ? AND entry_id = ?`, profileID, entryID).Scan(
		&item.EntryID, &itemKey, &libraryID, &libraryName, &collectionID, &collectionName,
		&item.MetadataFingerprint, &exportedAt, &updatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return ZoteroExport{}, ErrNotFound
	}
	if err != nil {
		return ZoteroExport{}, err
	}
	item.ZoteroItemKey = itemKey.String
	item.LibraryID, item.LibraryName = libraryID.String, libraryName.String
	item.CollectionID, item.CollectionName = collectionID.String, collectionName.String
	item.ExportedAt, _ = time.Parse(time.RFC3339Nano, exportedAt)
	item.UpdatedAt, _ = time.Parse(time.RFC3339Nano, updatedAt)
	return item, nil
}

func SaveZoteroExport(ctx context.Context, db *sql.DB, profileID string, item ZoteroExport) (ZoteroExport, error) {
	now := time.Now().UTC()
	if item.ExportedAt.IsZero() {
		item.ExportedAt = now
	}
	_, err := db.ExecContext(ctx, `INSERT INTO zotero_exports (
		profile_id, entry_id, zotero_item_key, library_id, library_name, collection_id,
		collection_name, metadata_fingerprint, exported_at, updated_at
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	ON CONFLICT(profile_id, entry_id) DO UPDATE SET
		zotero_item_key = excluded.zotero_item_key,
		library_id = excluded.library_id, library_name = excluded.library_name,
		collection_id = excluded.collection_id, collection_name = excluded.collection_name,
		metadata_fingerprint = excluded.metadata_fingerprint, updated_at = excluded.updated_at`,
		profileID, item.EntryID, nullableStringValue(item.ZoteroItemKey), nullableStringValue(item.LibraryID),
		nullableStringValue(item.LibraryName), nullableStringValue(item.CollectionID),
		nullableStringValue(item.CollectionName), item.MetadataFingerprint,
		formatTime(item.ExportedAt), formatTime(now))
	if err != nil {
		return ZoteroExport{}, fmt.Errorf("save Zotero export: %w", err)
	}
	return GetZoteroExport(ctx, db, profileID, item.EntryID)
}

func SplitZoteroAuthors(value string) []string {
	parts := strings.FieldsFunc(value, func(r rune) bool { return r == ';' || r == '；' || r == '\n' })
	authors := make([]string, 0, len(parts))
	for _, part := range parts {
		if cleaned := strings.TrimSpace(part); cleaned != "" {
			authors = append(authors, cleaned)
		}
	}
	return authors
}
