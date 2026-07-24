CREATE TABLE zotero_exports (
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
    zotero_item_key TEXT,
    library_id TEXT,
    library_name TEXT,
    collection_id TEXT,
    collection_name TEXT,
    metadata_fingerprint TEXT NOT NULL,
    exported_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY(profile_id, entry_id)
) STRICT, WITHOUT ROWID;

CREATE INDEX idx_zotero_exports_item_key ON zotero_exports(zotero_item_key)
WHERE zotero_item_key IS NOT NULL AND zotero_item_key != '';
