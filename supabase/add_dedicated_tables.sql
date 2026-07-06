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
-- Seed known documents (brief §6) — ONLY if property_documents is empty.
-- Properties resolved by their real live addresses.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from property_documents) then

    -- helper inline: insert one doc for a property matched by address
    -- 156 NE 77 St
    insert into property_documents (property_id, title, description, status, assignee, sort_order)
    select id, 'WASA Agreement', 'Acuerdo WASA pendiente de entrega por el dueño.', 'Pending', 'Dueño', 1 from properties where address = '156 NE 77 St';
    insert into property_documents (property_id, title, description, status, assignee, sort_order)
    select id, 'FPL', 'Coordinación FPL pendiente.', 'Pending', 'Dueño', 2 from properties where address = '156 NE 77 St';
    insert into property_documents (property_id, title, description, status, assignee, sort_order)
    select id, 'BBL Dedication (NE 77 St, 5ft)', 'Dedicación de 5 ft en NE 77 St. Contacto: Sandra Saez · Ssaez@miamigov.com · 305-416-1262. Proceso 14-16 semanas.', 'Pending', 'Bruno', 3 from properties where address = '156 NE 77 St';
    insert into property_documents (property_id, title, description, status, assignee, sort_order)
    select id, 'Covenant', 'Covenant pendiente de entrega por el dueño.', 'Pending', 'Dueño', 4 from properties where address = '156 NE 77 St';
    insert into property_documents (property_id, title, description, status, assignee, sort_order)
    select id, 'Hydrant Flow Test', 'Reporte de hydrant flow test (vigencia máx. 12 meses).', 'Pending', 'Dueño', 5 from properties where address = '156 NE 77 St';

    -- 150 NE 77 St (mismos 5 documentos que 156)
    insert into property_documents (property_id, title, description, status, assignee, sort_order)
    select id, 'WASA Agreement', 'Acuerdo WASA pendiente de entrega por el dueño.', 'Pending', 'Dueño', 1 from properties where address = '150 NE 77 St';
    insert into property_documents (property_id, title, description, status, assignee, sort_order)
    select id, 'FPL', 'Coordinación FPL pendiente.', 'Pending', 'Dueño', 2 from properties where address = '150 NE 77 St';
    insert into property_documents (property_id, title, description, status, assignee, sort_order)
    select id, 'BBL Dedication (NE 77 St, 5ft)', 'Dedicación de 5 ft en NE 77 St. Contacto: Sandra Saez · Ssaez@miamigov.com · 305-416-1262. Proceso 14-16 semanas.', 'Pending', 'Bruno', 3 from properties where address = '150 NE 77 St';
    insert into property_documents (property_id, title, description, status, assignee, sort_order)
    select id, 'Covenant', 'Covenant pendiente de entrega por el dueño.', 'Pending', 'Dueño', 4 from properties where address = '150 NE 77 St';
    insert into property_documents (property_id, title, description, status, assignee, sort_order)
    select id, 'Hydrant Flow Test', 'Reporte de hydrant flow test (vigencia máx. 12 meses).', 'Pending', 'Dueño', 5 from properties where address = '150 NE 77 St';

    -- 160 NE 77 St (mismos 5 + Civil comments response)
    insert into property_documents (property_id, title, description, status, assignee, sort_order)
    select id, 'WASA Agreement', 'Acuerdo WASA pendiente de entrega por el dueño.', 'Pending', 'Dueño', 1 from properties where address = '160 NE 77 St';
    insert into property_documents (property_id, title, description, status, assignee, sort_order)
    select id, 'FPL', 'Coordinación FPL pendiente.', 'Pending', 'Dueño', 2 from properties where address = '160 NE 77 St';
    insert into property_documents (property_id, title, description, status, assignee, sort_order)
    select id, 'BBL Dedication (NE 77 St, 5ft)', 'Dedicación de 5 ft en NE 77 St. Contacto: Sandra Saez · Ssaez@miamigov.com · 305-416-1262. Proceso 14-16 semanas.', 'Pending', 'Bruno', 3 from properties where address = '160 NE 77 St';
    insert into property_documents (property_id, title, description, status, assignee, sort_order)
    select id, 'Covenant', 'Covenant pendiente de entrega por el dueño.', 'Pending', 'Dueño', 4 from properties where address = '160 NE 77 St';
    insert into property_documents (property_id, title, description, status, assignee, sort_order)
    select id, 'Hydrant Flow Test', 'Reporte de hydrant flow test (vigencia máx. 12 meses).', 'Pending', 'Dueño', 5 from properties where address = '160 NE 77 St';
    insert into property_documents (property_id, title, description, status, assignee, sort_order)
    select id, 'Civil comments response', 'Respuesta a comentarios de Civil pendiente por David.', 'Pending', 'David', 6 from properties where address = '160 NE 77 St';

    -- 3770 Oak Av
    insert into property_documents (property_id, title, description, status, assignee, sort_order)
    select id, 'Carta del vecino (tala de aguacate)', 'Carta del vecino autorizando la remoción del árbol de aguacate en propiedad adyacente.', 'Pending', 'Bruno', 1 from properties where address = '3770 Oak Av';
    insert into property_documents (property_id, title, description, status, assignee, sort_order)
    select id, 'BBL Dedication (Oak Av, 10ft)', 'Dedicación de 10 ft en Oak Av. Contacto: Sandra Saez. Proceso 14-16 semanas.', 'Pending', 'Bruno', 2 from properties where address = '3770 Oak Av';
    insert into property_documents (property_id, title, description, status, assignee, sort_order)
    select id, 'Waiver PZ-25-20026', 'Waiver de setback PZ-25-20026 en proceso. Building permit no se aprueba hasta final decision.', 'In Progress', 'David', 3 from properties where address = '3770 Oak Av';

    -- 3801 Oak Av
    insert into property_documents (property_id, title, description, status, assignee, sort_order)
    select id, 'BBL Dedication (Oak Av, 10ft)', 'Dedicación de 10 ft en Oak Av. Contacto: Sandra Saez. Proceso 14-16 semanas.', 'Pending', 'Bruno', 1 from properties where address = '3801 Oak Av';
    insert into property_documents (property_id, title, description, status, assignee, sort_order)
    select id, 'Covenant (doble folio)', 'Covenant doble folio (Zoning REF74). Contacto: Alicia T. Menardy · ATMenardy@miamigov.com.', 'Pending', 'Alicia T. Menardy', 2 from properties where address = '3801 Oak Av';

    -- 3201 Day Av (Master)
    insert into property_documents (property_id, title, description, status, assignee, sort_order)
    select id, 'BBL Dedication (McDonald St, 10ft)', 'Dedicación de 10 ft en McDonald St. Contacto: Sandra Saez. Proceso 14-16 semanas.', 'Pending', 'Bruno', 1 from properties where address = '3201 Day Av';
    insert into property_documents (property_id, title, description, status, assignee, sort_order)
    select id, 'Covenant (doble folio)', 'Covenant doble folio. Contacto: Alicia T. Menardy · ATMenardy@miamigov.com.', 'Pending', 'Alicia T. Menardy', 2 from properties where address = '3201 Day Av';

    -- 3201 Day Av — Demo (matched by address LIKE to avoid em-dash issues)
    insert into property_documents (property_id, title, description, status, assignee, sort_order)
    select id, 'Tree Protection Bond $36,000', 'Entregar EN PERSONA: 444 SW 2nd Ave, 4th floor, Environmental Resources Div. Pink Tabebuia #20 -> $20,000 · Gumbo Limbo #23 -> $16,000. Bloquea aprobación del demo permit.', 'Pending', 'Bruno', 1 from properties where address like '3201 Day Av%Demo';

  end if;
end $$;

commit;
