-- Normalize sync schedule timestamps written by SQLite's datetime(), which
-- emits a space-separated form that sorts before every RFC3339 value on the
-- same calendar date and made completed accounts immediately due again.
UPDATE sync_accounts
SET next_sync_at = strftime('%Y-%m-%dT%H:%M:%fZ', next_sync_at)
WHERE next_sync_at IS NOT NULL AND next_sync_at NOT LIKE '%T%';

UPDATE sync_accounts
SET last_sync_at = strftime('%Y-%m-%dT%H:%M:%fZ', last_sync_at)
WHERE last_sync_at IS NOT NULL AND last_sync_at NOT LIKE '%T%';

UPDATE sync_accounts
SET last_attempt_at = strftime('%Y-%m-%dT%H:%M:%fZ', last_attempt_at)
WHERE last_attempt_at IS NOT NULL AND last_attempt_at NOT LIKE '%T%';
