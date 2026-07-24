ALTER TABLE entries ADD COLUMN doi TEXT;

CREATE INDEX idx_entries_doi ON entries(doi) WHERE doi IS NOT NULL AND doi != '';
