-- Deadline for a paper, used by the workbench calendar to surface when a
-- submitted manuscript is due. Stored as free text like the other date fields
-- (submission_date) and normalized to YYYY-MM-DD by the client.
ALTER TABLE research_papers ADD COLUMN deadline TEXT NOT NULL DEFAULT '';
