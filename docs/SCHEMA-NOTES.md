# Live schema notes (source of truth: the Supabase DB, not brief §2)

The Supabase project `ajiqfgmjewyaxdqcmxib` was created by an **earlier session**
with a different, more generic data model than the technical brief specified.
The app is built against the **live schema** (introspected via
`scripts/introspect.mjs`). `lib/types.ts` mirrors it exactly.

## Tables that exist
| Table | Notes |
|---|---|
| `properties` | No `permit_type`. Has `related_permits`, `sort_order`. |
| `disciplines` | Has `sort_order`. `city_status` enum `discipline_city_status`. |
| `comments` | No `cycle`/`discussion`. Has `filename`, `sort_order`. `city_status` = **raw** iBuild values. |
| `comment_tracking` | Has `updated_by`. `internal_status` enum. Unique on `comment_id`. |
| `tracking_history` | Append-only audit. |
| `construction_projects` | Future Construcción module (already scaffolded in DB). |
| `tasks` | **Polymorphic** action items: `entity_type` (`property`/`construction_project`) + `entity_id`. |
| `notes` | **Polymorphic** free-text notes: `entity_type` + `entity_id`. |
| `key_dates` | **Polymorphic** dates: `entity_type` + `entity_id`. |
| `alerts` | Cross-module: `module` (`permits`/`construction`), `level` (`urgent`/`note`). Maps to prototype "alerts". |
| `objectives` | OKR-style: `scope` (`company`/`person`). |
| `app_users` | `role` (`admin`/`member`). |

## Postgres enums
- `portfolio`: `portland_saxum` | `casas`
- `comment_city_status`: `Unresolved` | `Resolved` | `Info Only` | `Information`  ← raw, NOT normalized
- `discipline_city_status`: `CORRECTIONS` | `PENDING_ACTION` | `PENDING_REVIEW` | `APPROVED`
- `internal_status`: `Pending` | `In Progress` | `With Architect` | `With Engineer` | `With Owner` | `Submitted` | `Resolved`
- `entity_type`: `property` | `construction_project`
- `alert_module`: `permits` | `construction`; `alert_level`: `urgent` | `note`
- `overall_status`: `On Track` | `At Risk` | `Blocked`
- `objective_scope`: `company` | `person`; `user_role`: `admin` | `member`

## Divergence from the brief (DECISION NEEDED for later modules)
The brief (§2) specified dedicated tables that **do not exist**:
- `property_documents` (Documentos tab)
- `payments` (Pagos tab)
- `meetings` + `action_items` (Seguimiento)

The live DB models these generically instead:
- Documents/dates → likely `notes` + `key_dates` on a `property` entity
- Payments → **no equivalent table exists** — needs a decision (add `payments`, or model via `tasks`/`notes`? Payments need amount/QB code/status, which the generic tables don't carry)
- Meetings → `tasks` are polymorphic action items but there is **no `meetings` table** for meeting notes

**Before building Documentos / Pagos / Seguimiento, decide:** adopt the generic
model, or add the brief's dedicated tables. Payments especially has no home yet.

## Data / RLS state
- Seeded: 8 properties, 73 disciplines, 240 comments (verbatim, matches prototype).
- RLS is currently **permissive** — anon key can read AND write. Tighten with real
  auth before go-live (brief §12.8). `comment_tracking`/`tracking_history` are
  written directly from the browser today.

## My unused artifacts (kept for reference / a fresh DB)
- `supabase/migrations/0001_initial_schema.sql` + `supabase/seed/0001_permits_seed.sql`
  + `supabase/setup_all.sql` describe the **brief's** schema. They were NOT applied
  (the live DB pre-existed). Useful if a clean rebuild is ever wanted.
