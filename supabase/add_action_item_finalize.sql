-- Finalize a follow-up on an action item (kept as record). Paste + Run.
alter table action_items add column if not exists finalized_at timestamptz;
