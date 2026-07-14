// Seeds quickbooks_codes from _input/qb_codes.json (produced by qb-parse.mjs).
// Upserts by full_path so it is safe to re-run. Run AFTER the SQL is applied.
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
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const rows = JSON.parse(readFileSync(join(ROOT, "_input", "qb_codes.json"), "utf8"));
const { error } = await sb.from("quickbooks_codes").upsert(rows, { onConflict: "full_path" });
if (error) { console.error("seed error:", error.message); process.exit(1); }

const { count } = await sb.from("quickbooks_codes").select("*", { count: "exact", head: true });
const { data: sample } = await sb.from("quickbooks_codes").select("code,name,division").ilike("name", "%architectural%");
console.log(`seeded. quickbooks_codes rows: ${count}`);
console.log("check 'architectural':", JSON.stringify(sample));
