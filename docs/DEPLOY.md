# Deploy & go-live checklist

## Status: LIVE at portland-saxum.vercel.app (auth + RLS + rotated keys ✅)

## Environment variables (Vercel → Project → Settings → Environment Variables)
| Var | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://ajiqfgmjewyaxdqcmxib.supabase.co` | public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **publishable** key (`sb_publishable_…`) | public/browser-safe |
| `SUPABASE_SERVICE_ROLE_KEY` | **secret** key (`sb_secret_…`) | server only; bypasses RLS |
| `ANTHROPIC_API_KEY` | (later) | only when the AI note upload ships |

Migrated off the legacy `anon`/`service_role` JWT keys to the new API-key system;
legacy keys are **disabled** (the service_role exposed during setup is revoked).
The same values are in local `.env.local` (gitignored). `NEXT_PUBLIC_*` are exposed to the
browser by design; the secret key must NEVER be `NEXT_PUBLIC_`.

## Auth
- Email/password via Supabase. Both users share all data.
- Create the two users:
  - Supabase dashboard → Authentication → Users → Add user (set "Auto Confirm"), **or**
  - `node scripts/create-users.mjs "bruno@…=TempPass!" "asistente@…=TempPass!"`
- Middleware (`middleware.ts`) redirects unauthenticated traffic to `/login`.

## Harden RLS (do this once auth works)
Run `supabase/tighten_rls.sql` in the SQL Editor. It flips every table from
anon-permissive to **authenticated-only**. After this, logged-out requests return
no rows; the app requires login. Re-test by logging in — data should still load
(the browser client sends the user's JWT automatically).

## Rotate the service_role key (brief §12.8) — DONE ✅
Rotated by migrating to the new API-key system (non-disruptive; JWT secret untouched
so sessions survived):
1. Created a new **secret key** (`sb_secret_…`) and pointed `SUPABASE_SERVICE_ROLE_KEY` at it;
   switched `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the **publishable key** (`sb_publishable_…`).
2. Updated both in `.env.local` + Vercel, redeployed.
3. **Disabled legacy API keys** in Supabase → the old anon + service_role now return
   `401 "Legacy API keys are disabled"`. Verified.

To rotate again later: create a new secret key, swap it in `.env.local` + Vercel, redeploy,
then revoke the previous secret key (Settings → API Keys → ⋯ → Revoke).

## Deploy to Vercel (Hobby, shared account, GitHub bcattorini)
**Option A — GitHub + dashboard (auto-deploy on push):**
1. Create empty repo `bcattorini/portland-saxum` on GitHub.
2. `git remote add origin https://github.com/bcattorini/portland-saxum.git && git push -u origin main`
3. Vercel → New Project → import the repo → framework auto-detected (Next.js).
4. Add the env vars above → Deploy.

**Option B — Vercel CLI (direct):**
1. `npm i -g vercel`
2. `vercel login` (or `--token`)
3. `vercel` (link/create project) → add env vars → `vercel --prod`
