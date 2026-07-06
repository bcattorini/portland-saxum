// Verify the dedicated tables + document seed after the SQL Editor run.
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
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function count(t) {
  const { count, error } = await sb.from(t).select("*", { count: "exact", head: true });
  return error ? `ERROR ${error.message}` : count;
}

for (const t of ["property_documents", "payments", "meetings", "action_items"]) {
  console.log(`${t}: ${await count(t)}`);
}

// docs per property
const { data: props } = await sb.from("properties").select("id,address").order("address");
console.log("\nDocuments per property:");
for (const p of props) {
  const { count } = await sb.from("property_documents").select("*", { count: "exact", head: true }).eq("property_id", p.id);
  if (count) console.log(`  ${p.address.padEnd(22)} ${count}`);
}

// sample row → confirm columns/anon-writability shape
const { data: sample } = await sb.from("property_documents").select("*").limit(1);
console.log("\nSample document row:", JSON.stringify(sample?.[0], null, 2));

// distinct statuses/assignees
const { data: all } = await sb.from("property_documents").select("status,assignee");
console.log("\nStatuses:", [...new Set(all.map((r) => r.status))]);
console.log("Assignees:", [...new Set(all.map((r) => r.assignee))]);
