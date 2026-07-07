-- ============================================================================
-- Portland Saxum — TIGHTEN RLS: anon (public) → authenticated only.
-- Run in the Supabase SQL Editor AFTER auth is live and the two users exist.
-- Drops every existing policy on each app table and replaces it with a single
-- "authenticated can do everything" policy (both users share all data, §11).
-- Idempotent: safe to re-run. service_role (server scripts) bypasses RLS.
-- After running, the app REQUIRES login; anon requests get no rows.
-- ============================================================================
begin;
do $$
declare
  t text;
  pol record;
  tbls text[] := array[
    'properties','disciplines','comments','comment_tracking','tracking_history',
    'property_documents','payments','meetings','action_items',
    'construction_projects','tasks','notes','key_dates','alerts','objectives','app_users'
  ];
begin
  foreach t in array tbls loop
    if to_regclass('public.' || t) is null then
      continue; -- table doesn't exist, skip
    end if;

    -- drop all existing policies on this table
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy if exists %I on public.%I', pol.policyname, t);
    end loop;

    -- enable RLS and add authenticated-only full access
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true)',
      t || '_authenticated_all', t
    );
  end loop;
end $$;
commit;
