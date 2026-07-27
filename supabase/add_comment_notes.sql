-- ============================================================================
-- Portland Saxum — dated notes log + finalize tracking.
-- Paste into Supabase SQL Editor and Run. Idempotent. RLS: authenticated-only.
-- (Existing comment_tracking.notes are migrated by scripts/migrate-notes.mjs.)
-- ============================================================================
begin;

-- dated notes thread per comment
create table if not exists comment_notes (
  id         uuid primary key default gen_random_uuid(),
  comment_id uuid not null references comments(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now(),
  created_by text
);
create index if not exists comment_notes_comment_idx on comment_notes(comment_id);
alter table comment_notes enable row level security;
drop policy if exists comment_notes_authenticated_all on comment_notes;
create policy comment_notes_authenticated_all on comment_notes for all to authenticated using (true) with check (true);

-- finalize a follow-up (record kept)
alter table comment_tracking add column if not exists finalized_at timestamptz;

commit;
