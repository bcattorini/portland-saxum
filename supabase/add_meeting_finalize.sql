-- Finalize a whole meeting (kept as record). Paste + Run.
alter table meetings add column if not exists finalized_at timestamptz;
