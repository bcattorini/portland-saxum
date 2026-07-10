// iBuild importer (brief §10). Merges a Review Comments Report PDF into the DB:
//   - matches property by permit number
//   - upserts comments by (property, ref_number) — updates in place so
//     comment_tracking / tracking_history are NEVER touched
//   - creates missing disciplines; recomputes discipline counts + city_status
//   - never deletes existing comments
// DRY-RUN by default. Pass --apply to write. Usage:
//   node scripts/ibuild-import.mjs <a.pdf> [b.pdf ...] [--apply]
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { parseReport } from "./ibuild-parse.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const env = {};
for (const l of readFileSync(join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(l);
  if (m) env[m[1]] = m[2].trim();
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const CODE_NAME = {
  B: "Building", Z: "Zoning", P: "Plumbing", FF: "Flood Plain", LI: "Environmental",
  S: "Structural", MDC: "Miami-Dade Co.", DRP: "Public Works", F: "Fire",
  E: "Electrical", MA: "Mechanical", BBL: "PW BBL",
};
const norm = (s) => (s || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
const APPLY = process.argv.includes("--apply");
const pdfs = process.argv.slice(2).filter((a) => a.toLowerCase().endsWith(".pdf"));

// which comments have internal tracking (to report preservation)
const { data: trackRows } = await sb.from("comment_tracking").select("comment_id");
const trackedIds = new Set((trackRows || []).map((t) => t.comment_id));

const { data: allProps } = await sb.from("properties").select("id,address,permit_number");

for (const pdf of pdfs) {
  const { permit, records } = await parseReport(pdf);
  const kept = records.filter((r) => r.code && r.code !== "SKIP");
  const prop = allProps.find((p) => norm(p.permit_number) === norm(permit));
  console.log(`\n================ ${permit} ================`);
  if (!prop) { console.log(`  ⚠ no property matches permit ${permit} — skipping`); continue; }
  console.log(`  property: ${prop.address}`);

  const { data: discRows } = await sb.from("disciplines").select("id,code").eq("property_id", prop.id);
  const discByCode = new Map(discRows.map((d) => [d.code, d.id]));
  const { data: existRows } = await sb
    .from("comments")
    .select("id,ref_number,city_status,discipline_id")
    .in("discipline_id", discRows.length ? discRows.map((d) => d.id) : ["x"]);
  const existByRef = new Map(existRows.map((c) => [c.ref_number, c]));

  const codesInPdf = [...new Set(kept.map((r) => r.code))];
  const codesToCreate = codesInPdf.filter((c) => !discByCode.has(c));

  const pdfRefs = new Set(kept.map((r) => r.ref));
  let toInsert = 0, toUpdate = 0, statusChanges = [], trackedTouched = [];
  for (const r of kept) {
    const ex = existByRef.get(r.ref);
    if (ex) {
      toUpdate++;
      if (ex.city_status !== r.status) statusChanges.push(`#${r.ref} ${ex.city_status}→${r.status}`);
      if (trackedIds.has(ex.id)) trackedTouched.push(r.ref);
    } else toInsert++;
  }
  const staleRefs = existRows.filter((c) => !pdfRefs.has(c.ref_number)).map((c) => c.ref_number);

  console.log(`  disciplines to create: ${codesToCreate.length ? codesToCreate.join(", ") : "none"}`);
  console.log(`  comments: ${toUpdate} update, ${toInsert} insert, ${staleRefs.length} stale-in-db-not-in-pdf (kept as-is)`);
  console.log(`  status changes: ${statusChanges.length}${statusChanges.length ? " → " + statusChanges.slice(0, 12).join(", ") + (statusChanges.length > 12 ? " …" : "") : ""}`);
  console.log(`  tracked comments affected (preserved): ${trackedTouched.length ? trackedTouched.join(", ") : "none"}`);

  if (!APPLY) continue;

  // 1) create missing disciplines
  for (const code of codesToCreate) {
    const { data, error } = await sb.from("disciplines")
      .insert({ property_id: prop.id, code, name: CODE_NAME[code] || code, city_status: "CORRECTIONS", total_comments: 0, open_comments: 0, info_comments: 0 })
      .select("id").single();
    if (error) { console.log(`  ERROR creating discipline ${code}: ${error.message}`); continue; }
    discByCode.set(code, data.id);
  }

  // 2) upsert comments (update in place by id, or insert)
  for (const r of kept) {
    const discId = discByCode.get(r.code);
    const ex = existByRef.get(r.ref);
    const payload = { discipline_id: discId, ref_number: r.ref, text: r.text, filename: r.filename, city_status: r.status || "Unresolved", sort_order: r.ref };
    if (ex) {
      const { error } = await sb.from("comments").update(payload).eq("id", ex.id);
      if (error) console.log(`  ERROR update #${r.ref}: ${error.message}`);
    } else {
      const { error } = await sb.from("comments").insert(payload);
      if (error) console.log(`  ERROR insert #${r.ref}: ${error.message}`);
    }
  }

  // 3) recompute discipline counts + city_status from actual comments
  const { data: discNow } = await sb.from("disciplines").select("id,code").eq("property_id", prop.id);
  for (const d of discNow) {
    const { data: cs } = await sb.from("comments").select("city_status").eq("discipline_id", d.id);
    const total = cs.length;
    const open = cs.filter((c) => c.city_status === "Unresolved").length;
    const info = cs.filter((c) => c.city_status === "Info Only" || c.city_status === "Information").length;
    const city_status = total === 0 ? "PENDING_REVIEW" : open > 0 ? "CORRECTIONS" : "APPROVED";
    await sb.from("disciplines").update({ total_comments: total, open_comments: open, info_comments: info, city_status }).eq("id", d.id);
  }
  console.log(`  ✓ applied.`);
}

console.log(`\n${APPLY ? "APPLIED changes." : "DRY-RUN only. Re-run with --apply to write."}`);
