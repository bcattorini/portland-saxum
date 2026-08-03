-- Mark action items as urgent (sorted first). Paste + Run.
alter table action_items add column if not exists urgent boolean not null default false;
