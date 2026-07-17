ALTER TABLE sync_accounts ADD COLUMN allow_private_network INTEGER NOT NULL DEFAULT 0 CHECK(allow_private_network IN (0, 1));
ALTER TABLE sync_accounts ADD COLUMN sync_interval_minutes INTEGER NOT NULL DEFAULT 30 CHECK(sync_interval_minutes BETWEEN 5 AND 10080);
ALTER TABLE sync_accounts ADD COLUMN next_sync_at TEXT;
ALTER TABLE sync_accounts ADD COLUMN last_attempt_at TEXT;
ALTER TABLE sync_accounts ADD COLUMN last_error_code TEXT;
ALTER TABLE sync_accounts ADD COLUMN last_error_message TEXT;

CREATE INDEX idx_sync_accounts_due ON sync_accounts(enabled, next_sync_at);
