// Importer for Miami-Dade County "Remarks" PDFs into the MDC discipline.
// Dedupes by normalized text so re-runs don't duplicate. DRY-RUN unless --apply.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { PDFParse } from "pdf-parse";

const ROOT = "C:/dev/portland-saxum";
const env = {};
for (const l of readFileSync(ROOT + "/.env.local","utf8").split(/\r?\n/)){const m=/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(l);if(m)env[m[1]]=m[2].trim();}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false}});
const APPLY = process.argv.includes("--apply");
const BASE = process.argv.find(a => a.startsWith("--dir="))?.slice(6);

const norm = (s) => (s||"").replace(/[^a-z0-9]/gi,"").toLowerCase();
// folder "MDC - 150" -> property address
const ADDR = { "150":"150 NE 77 St", "156":"156 NE 77 St", "160":"160 NE 77 St", "3801":"3801 Oak Av" };

function parseRemarks(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length);
  const isStatus = (l) => /^(DISAPPROVED|APPROVED)$/.test(l);
  const isDate = (l) => /^\d{1,2}\/\d{1,2}\/\d{4}(\s+\d{1,2}:\d{2}\s*(AM|PM))?$/.test(l);
  const isPerson = (l) => /^(E\d{3,}|FASTRAK|[A-Z][A-Z .'-]*,\s*[A-Z][A-Z .'-]*)$/.test(l);
  const isFooter = (l) => /^(Code|Description|Created|Modified|Released|Showing |Remarks:)/.test(l) || l === "▲" || l === "▼";
  const starts = [];
  lines.forEach((l, idx) => { if (/^REMARK\b/.test(l)) starts.push(idx); });
  const out = [];
  for (let s = 0; s < starts.length; s++) {
    const to = (s + 1 < starts.length) ? starts[s + 1] : lines.length;
    const block = lines.slice(starts[s], to).filter((l) => !isFooter(l));
    if (!block.length) continue;
    block[0] = block[0].replace(/^REMARK\s*/, "");
    let statusIdx = -1;
    for (let k = block.length - 1; k >= 0; k--) { if (isStatus(block[k])) { statusIdx = k; break; } }
    const status = statusIdx >= 0 ? block[statusIdx] : null;
    let metaStart = statusIdx >= 0 ? statusIdx : block.length;
    let k = metaStart - 1;
    while (k >= 0 && (isDate(block[k]) || isPerson(block[k]))) { metaStart = k; k--; }
    let descLines = block.slice(0, metaStart);
    // drop a leading pure-metadata "ENTERED …" / "APPROVED …" first line
    descLines = descLines.filter((l, i) => !(i === 0 && /^(ENTERED|APPROVED)\b/.test(l) && /\d{1,2}\/\d{1,2}\/\d{4}/.test(l) && l.replace(/[^a-z]/gi, "").length < 12));
    let description = descLines.join(" ").replace(/\s+/g, " ").trim();
    // strip inline leading ENTERED/APPROVED metadata prefix if the text still begins with it
    description = description.replace(/^(ENTERED|APPROVED)\s+\d{1,2}\/\d{1,2}\/\d{4}\s+\S+\s*(APPROVED\s+\d{1,2}\/\d{1,2}\/\d{4}\s+\S+\s*)?/i, "");
    description = description.replace(/^[.\s]+/, "");
    // cut trailing metadata that leaked in (a person "LAST, FIRST" + date onward, or a lone trailing name)
    description = description.replace(/\s+[A-Z][A-Z.'’-]+,\s*[A-Z][A-Z.'’-]+\s+\d{1,2}\/\d{1,2}\/\d{4}.*$/, "");
    description = description.replace(/\s+[A-Z][A-Z.'’-]+,\s*[A-Z][A-Z.'’-]+\s*$/, "");
    description = description.trim();
    const nameOnly = /^[A-Z][A-Z.'’ -]*,\s*[A-Z][A-Z.'’ -]*$/.test(description);
    if (!nameOnly && description.replace(/[^a-z0-9]/gi, "").length >= 8) out.push({ description, status });
  }
  return out;
}

// find MDC folders
const dirs = [];
(function walk(d){ for (const n of readdirSync(d)) { const p = join(d,n); if (statSync(p).isDirectory()) walk(p); } if (/MDC - /.test(d)) dirs.push(d); })(BASE);
const propDirs = [...new Set(readdirSync(BASE, {recursive:true, withFileTypes:true}).filter(e=>e.isDirectory() && /^MDC - /.test(e.name)).map(e=>join(e.parentPath||e.path, e.name)))];

for (const dir of propDirs) {
  const key = dir.match(/MDC - (\S+)$/)[1];
  const address = ADDR[key];
  console.log(`\n================ MDC ${key} -> ${address} ================`);
  const { data: prop } = await sb.from("properties").select("id,address").eq("address", address).single();
  if (!prop) { console.log("  ⚠ propiedad no encontrada"); continue; }
  let { data: disc } = await sb.from("disciplines").select("id,code").eq("property_id", prop.id).eq("code","MDC").maybeSingle();
  if (!disc) { console.log("  ⚠ no hay disciplina MDC (habría que crearla)"); if(!APPLY) { continue; } const {data:nd}=await sb.from("disciplines").insert({property_id:prop.id,code:"MDC",name:"Miami-Dade Co.",city_status:"CORRECTIONS",total_comments:0,open_comments:0,info_comments:0}).select("id,code").single(); disc=nd; }
  const { data: existing } = await sb.from("comments").select("id,ref_number,text").eq("discipline_id", disc.id);
  const existNorm = new Set((existing||[]).map(c => norm(c.text)));
  let nextRef = Math.max(900, ...(existing||[]).map(c => c.ref_number||0)) + 1;

  const files = readdirSync(dir).filter(f => f.toLowerCase().endsWith(".pdf"));
  let toAdd = [], dup = 0;
  for (const f of files) {
    const division = (f.match(/Remarks - (.+?) - M/) || [])[1] || f;
    const parser = new PDFParse({ data: new Uint8Array(readFileSync(join(dir,f))) });
    const { text } = await parser.getText(); await parser.destroy?.();
    const remarks = parseRemarks(text);
    for (const r of remarks) {
      const full = `[${division}] ${r.description}`;
      if (existNorm.has(norm(full))) { dup++; continue; }
      existNorm.add(norm(full));
      toAdd.push({ division, text: full, city_status: r.status === "APPROVED" ? "Resolved" : "Unresolved", filename: f });
    }
    console.log(`  ${division}: ${remarks.length} remarks`);
  }
  console.log(`  -> nuevos a agregar: ${toAdd.length} | ya existían (dup): ${dup}`);
  for (const a of toAdd) console.log(`     [${a.city_status}] ${a.text.slice(0,140)}`);

  if (APPLY && toAdd.length) {
    const rows = toAdd.map(a => { const ref = nextRef++; return { discipline_id: disc.id, ref_number: ref, text: a.text, city_status: a.city_status, cycle: null, filename: a.filename, sort_order: ref }; });
    const { error } = await sb.from("comments").insert(rows);
    if (error) { console.log("  ERROR insert:", error.message); continue; }
    // recompute discipline counts
    const { data: cs } = await sb.from("comments").select("city_status").eq("discipline_id", disc.id);
    const total = cs.length, open = cs.filter(c=>c.city_status==="Unresolved").length, info = cs.filter(c=>c.city_status==="Info Only"||c.city_status==="Information").length;
    await sb.from("disciplines").update({ total_comments:total, open_comments:open, info_comments:info, city_status: total===0?"PENDING_REVIEW":open>0?"CORRECTIONS":"APPROVED" }).eq("id", disc.id);
    console.log(`  ✓ agregados ${rows.length}. MDC ahora: ${total} total, ${open} abiertos.`);
  }
}
console.log(`\n${APPLY ? "APLICADO." : "DRY-RUN. Correr con --apply para escribir."}`);
