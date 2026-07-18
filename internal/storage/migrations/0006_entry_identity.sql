ALTER TABLE entries ADD COLUMN identity_hash TEXT;

CREATE INDEX idx_entries_feed_identity_hash
    ON entries(feed_id, identity_hash)
    WHERE identity_hash IS NOT NULL AND identity_hash != '';
