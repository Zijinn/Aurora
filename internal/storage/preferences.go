package storage

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"
)

const PreferenceRetentionDays = "retention_days"

// preferenceKeys whitelists the settings the API accepts so the key-value
// table cannot grow arbitrary rows from a malformed client.
var preferenceKeys = map[string]struct{}{
	PreferenceRetentionDays: {},
}

func IsPreferenceKey(key string) bool {
	_, ok := preferenceKeys[key]
	return ok
}

func GetPreference(ctx context.Context, db *sql.DB, profileID, key string) (json.RawMessage, error) {
	var raw string
	err := db.QueryRowContext(ctx, "SELECT value_json FROM preferences WHERE profile_id = ? AND key = ?", profileID, key).Scan(&raw)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return json.RawMessage(raw), nil
}

func SetPreference(ctx context.Context, db *sql.DB, profileID, key string, value json.RawMessage) error {
	var validate any
	if err := json.Unmarshal(value, &validate); err != nil {
		return fmt.Errorf("preference value must be valid JSON: %w", err)
	}
	_, err := db.ExecContext(ctx, `
		INSERT INTO preferences (profile_id, key, value_json, updated_at) VALUES (?, ?, ?, ?)
		ON CONFLICT(profile_id, key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
		profileID, key, string(value), formatTime(time.Now().UTC()))
	return err
}

func ListPreferences(ctx context.Context, db *sql.DB, profileID string) (map[string]json.RawMessage, error) {
	rows, err := db.QueryContext(ctx, "SELECT key, value_json FROM preferences WHERE profile_id = ?", profileID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make(map[string]json.RawMessage)
	for rows.Next() {
		var key, raw string
		if err := rows.Scan(&key, &raw); err != nil {
			return nil, err
		}
		items[key] = json.RawMessage(raw)
	}
	return items, rows.Err()
}

// RetentionDays reads the entry retention policy; 0 (or unset) keeps entries
// forever.
func RetentionDays(ctx context.Context, db *sql.DB, profileID string) (int, error) {
	raw, err := GetPreference(ctx, db, profileID, PreferenceRetentionDays)
	if errors.Is(err, ErrNotFound) {
		return 0, nil
	}
	if err != nil {
		return 0, err
	}
	var days int
	if err := json.Unmarshal(raw, &days); err != nil {
		return 0, fmt.Errorf("decode retention preference: %w", err)
	}
	return days, nil
}
