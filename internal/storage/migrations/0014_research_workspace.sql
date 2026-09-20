-- Research workspace: a personal academic tracker for working papers,
-- submissions, and publications. One row per paper; the three kinds share a
-- table so a paper can flow research -> submitted -> published while keeping a
-- stable id. Kind-specific fields are nullable and JSON columns hold the
-- structured data the client edits inline (stages, submission history,
-- authors, keywords).
CREATE TABLE research_papers (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK(kind IN ('research', 'submitted', 'published')),
    position INTEGER NOT NULL DEFAULT 0,
    title TEXT NOT NULL DEFAULT '',
    authors_json TEXT NOT NULL DEFAULT '[]',
    keywords_json TEXT NOT NULL DEFAULT '[]',
    file_path TEXT NOT NULL DEFAULT '',
    next_action TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',

    -- research
    research_area TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT '',
    priority TEXT NOT NULL DEFAULT '',
    target_journal TEXT NOT NULL DEFAULT '',
    stages_json TEXT NOT NULL DEFAULT '[]',

    -- submitted
    current_journal TEXT NOT NULL DEFAULT '',
    submission_date TEXT NOT NULL DEFAULT '',
    manuscript_id TEXT NOT NULL DEFAULT '',
    submission_count INTEGER NOT NULL DEFAULT 0 CHECK(submission_count >= 0),
    target_level TEXT NOT NULL DEFAULT '',
    editor TEXT NOT NULL DEFAULT '',
    history_json TEXT NOT NULL DEFAULT '[]',

    -- published
    abstract TEXT NOT NULL DEFAULT '',
    journal TEXT NOT NULL DEFAULT '',
    language TEXT NOT NULL DEFAULT '',
    year TEXT NOT NULL DEFAULT '',
    volume TEXT NOT NULL DEFAULT '',
    issue TEXT NOT NULL DEFAULT '',
    pages TEXT NOT NULL DEFAULT '',
    doi TEXT NOT NULL DEFAULT '',
    citations INTEGER,
    citation_source TEXT NOT NULL DEFAULT '',
    citation_updated_at TEXT NOT NULL DEFAULT '',

    last_updated TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE INDEX idx_research_papers_kind ON research_papers(profile_id, kind, position);
