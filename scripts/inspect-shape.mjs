// Inspects the live schema/data shape so the UI is built against reality.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const env = {};
for (const line of readFileSync(join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
  if (m) env[m[1]] = m[2].trim();
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const show = (label, v) => console.log(`\n== ${label} ==\n` + JSON.stringify(v, null, 2));

// sample rows → reveals exact column names
const { data: prop } = await sb.from("properties").select("*").limit(1);
show("properties[0] columns", prop?.[0]);
const { data: disc } = await sb.from("disciplines").select("*").limit(1);
show("disciplines[0] columns", disc?.[0]);
const { data: cmt } = await sb.from("comments").select("*").limit(1);
show("comments[0] columns", cmt?.[0]);

// distinct-ish enum probes
const distinct = async (table, col) => {
  const { data } = await sb.from(table).select(col).limit(1000);
  return [...new Set((data || []).map((r) => r[col]))].sort();
};
show("portfolios", await distinct("properties", "portfolio"));
show("permit_types", await distinct("properties", "permit_type"));
show("discipline city_status values", await distinct("disciplines", "city_status"));
show("comment city_status values", await distinct("comments", "city_status"));

// per-property counts (join sanity)
const { data: props } = await sb.from("properties").select("id,address,portfolio,cycle").order("address");
for (const p of props || []) {
  const { data: ds } = await sb.from("disciplines").select("id").eq("property_id", p.id);
  const dids = (ds || []).map((d) => d.id);
  let c = 0;
  if (dids.length) {
    const { count } = await sb.from("comments").select("*", { count: "exact", head: true }).in("discipline_id", dids);
    c = count || 0;
  }
  console.log(`  ${p.portfolio.padEnd(15)} ${p.address.padEnd(22)} cyc=${p.cycle ?? "-"} disc=${dids.length} comments=${c}`);
}

// tracking layer present?
const { count: trackCount, error: trackErr } = await sb
  .from("comment_tracking")
  .select("*", { count: "exact", head: true });
console.log(`\ncomment_tracking rows: ${trackErr ? "table error: " + trackErr.message : trackCount}`);
