// Verifies seeded row counts via the service_role key (PostgREST — no DB password).
// Usage: node scripts/verify-counts.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const txt = readFileSync(join(ROOT, ".env.local"), "utf8");
const env = {};
for (const line of txt.split(/\r?\n/)) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
  if (m) env[m[1]] = m[2].trim();
}

const sb = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

async function count(table) {
  const { count, error } = await sb
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) throw new Error(`${table}: ${error.message}`);
  return count;
}

try {
  const props = await count("properties");
  const disc = await count("disciplines");
  const cmts = await count("comments");
  console.log(`properties=${props}  disciplines=${disc}  comments=${cmts}`);
  const ok = props === 8 && disc === 73 && cmts === 240;
  console.log(ok ? "✓ Seed matches expected 8 / 73 / 240." : "⚠ Counts differ from expected 8 / 73 / 240.");
} catch (e) {
  console.error("ERROR:", e.message);
  console.error("(If tables are missing, run supabase/setup_all.sql in the SQL Editor first.)");
  process.exit(1);
}
