ALTER TABLE ai_profiles ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0, 1));
ALTER TABLE ai_profiles ADD COLUMN allow_private_network INTEGER NOT NULL DEFAULT 0 CHECK(allow_private_network IN (0, 1));
ALTER TABLE ai_profiles ADD COLUMN remote_content_approved INTEGER NOT NULL DEFAULT 0 CHECK(remote_content_approved IN (0, 1));
ALTER TABLE ai_profiles ADD COLUMN last_used_at TEXT;
ALTER TABLE ai_profiles ADD COLUMN last_error_code TEXT;
ALTER TABLE ai_profiles ADD COLUMN last_error_message TEXT;

CREATE UNIQUE INDEX idx_ai_profile_name ON ai_profiles(profile_id, name);

ALTER TABLE ai_results ADD COLUMN ai_profile_id TEXT REFERENCES ai_profiles(id) ON DELETE SET NULL;
ALTER TABLE ai_chat_sessions ADD COLUMN ai_profile_id TEXT REFERENCES ai_profiles(id) ON DELETE SET NULL;
ALTER TABLE ai_chat_messages ADD COLUMN job_id TEXT REFERENCES jobs(id) ON DELETE SET NULL;
ALTER TABLE ai_chat_messages ADD COLUMN usage_json TEXT NOT NULL DEFAULT '{}';

CREATE UNIQUE INDEX idx_ai_chat_assistant_job
ON ai_chat_messages(job_id) WHERE job_id IS NOT NULL AND role = 'assistant';

CREATE TABLE ai_usage (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    ai_profile_id TEXT REFERENCES ai_profiles(id) ON DELETE SET NULL,
    entry_id TEXT REFERENCES entries(id) ON DELETE SET NULL,
    job_id TEXT REFERENCES jobs(id) ON DELETE SET NULL,
    operation TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    input_tokens INTEGER NOT NULL DEFAULT 0 CHECK(input_tokens >= 0),
    output_tokens INTEGER NOT NULL DEFAULT 0 CHECK(output_tokens >= 0),
    total_tokens INTEGER NOT NULL DEFAULT 0 CHECK(total_tokens >= 0),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE INDEX idx_ai_usage_profile_time ON ai_usage(profile_id, created_at DESC);
CREATE INDEX idx_ai_results_entry ON ai_results(profile_id, entry_id, created_at DESC);
CREATE INDEX idx_ai_chat_sessions_entry ON ai_chat_sessions(profile_id, entry_id, updated_at DESC);
