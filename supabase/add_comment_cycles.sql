-- Cycle resolution tracking: each time a new iBuild report is imported, we snapshot
-- how many comments were resolved vs the previous state. Paste + Run.

create table if not exists comment_cycles (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  cycle_no int,
  imported_at timestamptz not null default now(),
  source text,
  total_before int not null default 0,
  unresolved_before int not null default 0,
  resolved_in_cycle int not null default 0,
  new_comments int not null default 0,
  total_after int not null default 0,
  unresolved_after int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists comment_cycles_property_idx on comment_cycles (property_id, imported_at);

alter table comment_cycles enable row level security;

drop policy if exists "authenticated read comment_cycles" on comment_cycles;
create policy "authenticated read comment_cycles" on comment_cycles
  for select using (auth.role() = 'authenticated');

drop policy if exists "authenticated write comment_cycles" on comment_cycles;
create policy "authenticated write comment_cycles" on comment_cycles
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
