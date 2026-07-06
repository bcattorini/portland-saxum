-- ============================================================================
-- Portland Saxum — initial schema (brief §2, with §10 importer fields)
-- Enum-like columns use TEXT + CHECK for easier evolution than PG enums.
-- ============================================================================

create extension if not exists "pgcrypto";

-- Keeps updated_at fresh on UPDATE ------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- properties
-- ---------------------------------------------------------------------------
create table properties (
  id               uuid primary key default gen_random_uuid(),
  portfolio        text not null check (portfolio in ('portland_saxum','casas')),
  address          text not null,
  permit_number    text,
  permit_type      text check (permit_type in ('master','demo','main')),
  cycle            int,
  workflow_started date,
  status_note      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create trigger properties_set_updated_at
  before update on properties for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- disciplines (Planos & Ciudad — one row per discipline per property)
-- ---------------------------------------------------------------------------
create table disciplines (
  id             uuid primary key default gen_random_uuid(),
  property_id    uuid not null references properties(id) on delete cascade,
  code           text not null,
  name           text,
  reviewer_name  text,
  city_status    text check (city_status in
                   ('CORRECTIONS','PENDING_ACTION','PENDING_REVIEW','APPROVED')),
  total_comments int not null default 0,
  open_comments  int not null default 0,
  info_comments  int not null default 0,
  unique (property_id, code)
);
create index disciplines_property_idx on disciplines(property_id);

-- ---------------------------------------------------------------------------
-- comments (verbatim City data from iBuild — read-only content layer)
-- ---------------------------------------------------------------------------
create table comments (
  id            uuid primary key default gen_random_uuid(),
  discipline_id uuid not null references disciplines(id) on delete cascade,
  ref_number    int,
  cycle         int,
  text          text,
  filename      text,
  discussion    text,
  city_status   text not null default 'UNRESOLVED'
                  check (city_status in ('UNRESOLVED','RESOLVED','INFO_ONLY')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (discipline_id, ref_number)
);
create index comments_discipline_idx on comments(discipline_id);
create trigger comments_set_updated_at
  before update on comments for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- comment_tracking (internal layer — what the team edits; carried across
-- re-imports and NEVER overwritten by the importer)
-- ---------------------------------------------------------------------------
create table comment_tracking (
  id              uuid primary key default gen_random_uuid(),
  comment_id      uuid not null unique references comments(id) on delete cascade,
  assignee        text,
  internal_status text not null default 'Pending' check (internal_status in
                    ('Pending','In Progress','With Architect','With Engineer',
                     'With Owner','Submitted','Resolved')),
  notes           text,
  updated_at      timestamptz not null default now()
);
create trigger comment_tracking_set_updated_at
  before update on comment_tracking for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- tracking_history (audit trail — append only, never overwritten)
-- ---------------------------------------------------------------------------
create table tracking_history (
  id              uuid primary key default gen_random_uuid(),
  comment_id      uuid not null references comments(id) on delete cascade,
  assignee        text,
  internal_status text,
  notes           text,
  changed_by      text,
  changed_at      timestamptz not null default now()
);
create index tracking_history_comment_idx on tracking_history(comment_id);

-- ---------------------------------------------------------------------------
-- property_documents (Documentos — owner-delivered docs)
-- ---------------------------------------------------------------------------
create table property_documents (
  id          uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  title       text not null,
  description text,
  status      text not null default 'Pending'
                check (status in ('Pending','In Progress','Submitted','Approved','N/A')),
  assignee    text,
  due_date    date,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index property_documents_property_idx on property_documents(property_id);
create trigger property_documents_set_updated_at
  before update on property_documents for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- payments (Pagos)
-- ---------------------------------------------------------------------------
create table payments (
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
  created_at      timestamptz not null default now()
);
create index payments_property_idx on payments(property_id);

-- ---------------------------------------------------------------------------
-- meetings + action_items (Follow Up / Seguimiento)
-- ---------------------------------------------------------------------------
create table meetings (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  participants text,
  meeting_date date not null,
  notes        text,
  created_at   timestamptz not null default now()
);

create table action_items (
  id         uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings(id) on delete cascade,
  text       text not null,
  assignee   text,
  due_date   date,
  done       boolean not null default false,
  created_at timestamptz not null default now()
);
create index action_items_meeting_idx on action_items(meeting_id);

-- ============================================================================
-- Row Level Security. Both users (Bruno + assistant) share all data, so the
-- policy is simply: any authenticated user can do anything (brief §11).
-- The service_role key used by server importers bypasses RLS entirely.
-- ============================================================================
alter table properties         enable row level security;
alter table disciplines        enable row level security;
alter table comments           enable row level security;
alter table comment_tracking   enable row level security;
alter table tracking_history   enable row level security;
alter table property_documents enable row level security;
alter table payments           enable row level security;
alter table meetings           enable row level security;
alter table action_items       enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'properties','disciplines','comments','comment_tracking','tracking_history',
    'property_documents','payments','meetings','action_items'
  ] loop
    execute format(
      'create policy %I on %I for all to authenticated using (true) with check (true);',
      t || '_authenticated_all', t
    );
  end loop;
end $$;
