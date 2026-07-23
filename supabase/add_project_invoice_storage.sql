-- ============================================================================
-- Portland Saxum — payments: project column + invoice attachment (Storage).
-- Paste into Supabase SQL Editor and Run. Idempotent.
-- Creates the private 'invoices' bucket + authenticated-only access policies,
-- so no manual bucket creation is needed.
-- ============================================================================
begin;

-- 1) new columns on both payment tables
alter table payments         add column if not exists project text;
alter table payments         add column if not exists invoice_url text;
alter table general_payments add column if not exists project text;
alter table general_payments add column if not exists invoice_url text;

-- 2) private Storage bucket for invoices
insert into storage.buckets (id, name, public)
values ('invoices', 'invoices', false)
on conflict (id) do nothing;

-- 3) authenticated users can read/write/replace objects in the invoices bucket
drop policy if exists "invoices_auth_all" on storage.objects;
create policy "invoices_auth_all" on storage.objects
  for all to authenticated
  using (bucket_id = 'invoices')
  with check (bucket_id = 'invoices');

commit;
