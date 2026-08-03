-- Payment approval workflow: Cargado -> (Bruno aprueba) -> Por pagar -> Pagado.
-- Only the approval step is Bruno-gated (enforced in the app by login email).
-- Paste + Run in Supabase SQL Editor.

alter table payments         add column if not exists approved_at timestamptz;
alter table payments         add column if not exists approved_by text;
alter table general_payments add column if not exists approved_at timestamptz;
alter table general_payments add column if not exists approved_by text;

-- Existing rows are already-known payments: treat them as approved so they land
-- in "Por pagar"/"Pagados" instead of flooding the approval queue. Only NEW
-- invoices loaded from now on start in "Cargados" (approved_at = null).
update payments         set approved_at = coalesce(approved_at, created_at) where approved_at is null;
update general_payments set approved_at = coalesce(approved_at, created_at) where approved_at is null;
