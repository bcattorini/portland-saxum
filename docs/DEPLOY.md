# Deploy & go-live checklist

## Environment variables (set in Vercel → Project → Settings → Environment Variables)
| Var | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://ajiqfgmjewyaxdqcmxib.supabase.co` | public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon JWT | public |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role (secret) | server only; **rotate before go-live** |
| `ANTHROPIC_API_KEY` | (later) | only when the AI note upload ships |

The same values are in local `.env.local` (gitignored). `NEXT_PUBLIC_*` are exposed to the
browser by design; the service_role key must NEVER be `NEXT_PUBLIC_`.

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

## Rotate the service_role key (brief §12.8)
1. Supabase → Project Settings → API → **generate new** service keys (or roll the
   JWT secret). The old service_role key stops working.
2. Update `SUPABASE_SERVICE_ROLE_KEY` in **both** `.env.local` and Vercel.
3. Redeploy. (The anon/publishable keys can stay unless you rolled the JWT secret,
   which would also invalidate them — then update those too.)

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
