-- Legacy column: comment_tracking.notes was NOT NULL, but notes now live in the
-- dated comment_notes table. Saving responsable/estado on a comment without prior
-- tracking inserted a row with notes = null and failed. Make it nullable. Paste + Run.
alter table comment_tracking alter column notes drop not null;
