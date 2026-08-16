-- Switch full-text search to the trigram tokenizer. unicode61 treats a run of
-- CJK characters as a single token, so Chinese queries could only ever match
-- whole-field prefixes; trigram indexes 3-character substrings and makes CJK
-- substring search work. The index is rebuilt from the authoritative tables.
DROP TABLE entries_fts;

CREATE VIRTUAL TABLE entries_fts USING fts5(
    entry_id UNINDEXED,
    title,
    author,
    summary,
    plain_text,
    tokenize = 'trigram'
);

INSERT INTO entries_fts (entry_id, title, author, summary, plain_text)
SELECT e.id, e.title, COALESCE(e.author, ''), COALESCE(e.summary, ''),
    COALESCE(NULLIF(ec.readability_text, ''), ec.plain_text, '')
FROM entries e LEFT JOIN entry_contents ec ON ec.entry_id = e.id;
