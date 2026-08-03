-- Dated updates attached to a meeting or an action item. Paste + Run. Idempotent.
begin;

create table if not exists updates (
  id          uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('meeting','action_item')),
  entity_id   uuid not null,
  body        text not null,
  created_at  timestamptz not null default now(),
  created_by  text
);
create index if not exists updates_entity_idx on updates(entity_type, entity_id);
alter table updates enable row level security;
drop policy if exists updates_authenticated_all on updates;
create policy updates_authenticated_all on updates for all to authenticated using (true) with check (true);

commit;
