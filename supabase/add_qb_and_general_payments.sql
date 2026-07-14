-- ============================================================================
-- Portland Saxum — QuickBooks codes + company-level payments.
-- Paste into Supabase SQL Editor and Run. Idempotent + ASCII-only (accents in
-- the QB names are seeded separately via scripts/seed-qb-codes.mjs to avoid
-- the SQL-Editor encoding issue). RLS: authenticated-only, like the rest.
-- ============================================================================
begin;

-- ---------------------------------------------------------------------------
-- quickbooks_codes (chart of accounts, 3rd-level assignable codes)
-- ---------------------------------------------------------------------------
create table if not exists quickbooks_codes (
  id         uuid primary key default gen_random_uuid(),
  category   text not null check (category in ('HARD COST','SOFT COST')),
  division   text not null,
  code       text,
  name       text not null,
  full_path  text not null unique,
  created_at timestamptz not null default now()
);
create index if not exists quickbooks_codes_category_idx on quickbooks_codes(category);
alter table quickbooks_codes enable row level security;
drop policy if exists quickbooks_codes_authenticated_all on quickbooks_codes;
create policy quickbooks_codes_authenticated_all on quickbooks_codes for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- general_payments (company-level, not tied to a permit property)
-- Same shape as payments (+ currency, sort_order) so the UI is shared.
-- ---------------------------------------------------------------------------
create table if not exists general_payments (
  id                 uuid primary key default gen_random_uuid(),
  description        text not null,
  payment_type       text not null check (payment_type in ('vendor','client')),
  vendor_or_payer    text,
  amount             numeric(10,2) not null default 0,
  currency           text not null default 'USD',
  due_date           date,
  paid_date          date,
  status             text not null default 'Pending'
                       check (status in ('Pending','Paid','Overdue','Cancelled')),
  quickbooks_code    text,
  quickbooks_code_id uuid references quickbooks_codes(id) on delete set null,
  notes              text,
  sort_order         integer,
  created_at         timestamptz not null default now()
);
alter table general_payments enable row level security;
drop policy if exists general_payments_authenticated_all on general_payments;
create policy general_payments_authenticated_all on general_payments for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- link the existing per-property payments to a QB code too
-- ---------------------------------------------------------------------------
alter table payments add column if not exists quickbooks_code_id uuid references quickbooks_codes(id) on delete set null;

commit;
