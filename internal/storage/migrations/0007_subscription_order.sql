ALTER TABLE subscriptions ADD COLUMN position INTEGER NOT NULL DEFAULT 0;

CREATE INDEX idx_subscriptions_order ON subscriptions(profile_id, folder_id, position, id);
