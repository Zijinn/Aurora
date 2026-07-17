CREATE TABLE pairing_codes (
    id TEXT PRIMARY KEY,
    code_hash BLOB NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE INDEX idx_pairing_codes_expiry ON pairing_codes(expires_at, used_at);
