-- ============================================================================
-- Portland Saxum — add dedicated tables: property_documents, payments,
-- meetings, action_items (brief §2). Paste into Supabase SQL Editor and Run.
--
-- FULLY IDEMPOTENT: safe to run more than once.
--   - create table IF NOT EXISTS
--   - drop policy / drop trigger IF EXISTS before (re)create
--   - documents seeded ONLY if the table is empty
-- Matches live conventions: permissive RLS (anon can read/write for now),
-- sort_order columns. Properties resolved by their real live addresses.
-- ============================================================================
begin;

-- updated_at helper (namespaced so it never clobbers existing DB objects)
create or replace function ps_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- property_documents (Documentos tab)
-- ---------------------------------------------------------------------------
create table if not exists property_documents (
  id          uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  title       text not null,
  description text,
  status      text not null default 'Pending'
                check (status in ('Pending','In Progress','Submitted','Approved','N/A')),
  assignee    text,
  due_date    date,
  notes       text,
  sort_order  integer,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists property_documents_property_idx on property_documents(property_id);
alter table property_documents enable row level security;
drop policy if exists property_documents_all on property_documents;
create policy property_documents_all on property_documents for all to public using (true) with check (true);
drop trigger if exists property_documents_updated_at on property_documents;
create trigger property_documents_updated_at
  before update on property_documents for each row execute function ps_set_updated_at();

-- ---------------------------------------------------------------------------
-- payments (Pagos tab) — starts empty
-- ---------------------------------------------------------------------------
create table if not exists payments (
  id              uuid primary key default gen_random_uuid(),
  property_id     uuid not null references properties(id) on delete cascade,
  description     text not null,
  payment_type    text not null check (payment_type in ('vendor','client')),
  vendor_or_payer text,
  amount          numeric(10,2) not null default 0,
  currency        text not null default 'USD',
  due_date        date,
  paid_date       date,
  status          text not null default 'Pending'
                    check (status in ('Pending','Paid','Overdue','Cancelled')),
  quickbooks_code text,
  notes           text,
  sort_order      integer,
  created_at      timestamptz not null default now()
);
create index if not exists payments_property_idx on payments(property_id);
alter table payments enable row level security;
drop policy if exists payments_all on payments;
create policy payments_all on payments for all to public using (true) with check (true);

-- ---------------------------------------------------------------------------
-- meetings + action_items (Seguimiento) — start empty
-- ---------------------------------------------------------------------------
create table if not exists meetings (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  participants text,
  meeting_date date not null,
  notes        text,
  created_at   timestamptz not null default now()
);
alter table meetings enable row level security;
drop policy if exists meetings_all on meetings;
create policy meetings_all on meetings for all to public using (true) with check (true);

create table if not exists action_items (
  id         uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings(id) on delete cascade,
  text       text not null,
  assignee   text,
  due_date   date,
  done       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists action_items_meeting_idx on action_items(meeting_id);
alter table action_items enable row level security;
drop policy if exists action_items_all on action_items;
create policy action_items_all on action_items for all to public using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Document seed lives in scripts/seed-documents.mjs (run via the API), NOT here.
-- Reason: pasting accented Spanish (ñ/ó/á) through the SQL Editor corrupted the
-- text (UTF-8 read as Latin-1). The API seeder sends proper UTF-8. Run once:
--     node scripts/seed-documents.mjs
-- ---------------------------------------------------------------------------

commit;
