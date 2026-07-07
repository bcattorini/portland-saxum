// Verifies RLS is tightened: anon gets 0 rows, service_role still reads.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const env = {};
for (const l of readFileSync(join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(l);
  if (m) env[m[1]] = m[2].trim();
}

const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const tables = ["properties", "disciplines", "comments", "property_documents", "payments", "meetings", "action_items"];

async function count(sb, t) {
  const { count, error } = await sb.from(t).select("*", { count: "exact", head: true });
  return error ? `err(${error.code ?? "?"})` : count;
}

console.log("table                  anon    service_role");
let ok = true;
for (const t of tables) {
  const a = await count(anon, t);
  const s = await count(admin, t);
  if (typeof a === "number" && a > 0) ok = false; // anon should see nothing
  console.log(`${t.padEnd(22)} ${String(a).padEnd(7)} ${s}`);
}
console.log(
  ok
    ? "\n✓ RLS tightened: anon sees 0 rows everywhere; service_role still reads."
    : "\n⚠ anon still returns rows on some table — RLS NOT fully tightened.",
);
