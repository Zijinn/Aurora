ALTER TABLE feeds ADD COLUMN content_kind TEXT NOT NULL DEFAULT 'general'
    CHECK (content_kind IN ('general', 'literature', 'video', 'social'));

-- Backfill: feeds whose entries already carry DOIs are academic sources.
UPDATE feeds SET content_kind = 'literature'
WHERE id IN (SELECT DISTINCT feed_id FROM entries WHERE doi IS NOT NULL AND doi != '');
