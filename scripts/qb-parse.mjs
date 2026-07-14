// Parses LR_156_LLC.csv (QuickBooks chart of accounts) into 3rd-level codes.
// full_path uses ':' between levels: CATEGORY:DIVISION:CODE NAME
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const raw = readFileSync(join(ROOT, "_input", "LR_156_LLC.csv"), "utf8");

// first CSV field only (handles quoted field with commas)
function firstField(line) {
  if (line.startsWith('"')) {
    const end = line.indexOf('"', 1);
    return line.slice(1, end);
  }
  return line.split(",")[0];
}

const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
const records = [];
const unmatched = [];
for (const line of lines) {
  const path = firstField(line);
  const parts = path.split(":");
  if (parts.length !== 3) continue; // only assignable 3rd-level codes
  const category = parts[0].trim(); // HARD COST / SOFT COST
  const division = parts[1].trim(); // e.g. "SC DIV 02 - Building Design Fees"
  const seg = parts[2].trim(); // e.g. "SC 2.1 Architectural"
  // code = leading "HC|SC <num|->", name = rest
  const m = seg.match(/^((?:HC|SC)\s+(?:\d+(?:\.\d+)*|-{1,2}))\s+(.*)$/);
  let code, name;
  if (m) { code = m[1].replace(/\s+/g, " "); name = m[2].trim(); }
  else { code = null; name = seg; unmatched.push(seg); }
  records.push({ category, division, code, name, full_path: path });
}

writeFileSync(join(ROOT, "_input", "qb_codes.json"), JSON.stringify(records, null, 2), "utf8");

const byCat = {};
for (const r of records) byCat[r.category] = (byCat[r.category] || 0) + 1;
console.log(`total 3rd-level records: ${records.length}`);
console.log("by category:", JSON.stringify(byCat));
console.log("codeless (name only):", unmatched.length, unmatched.slice(0, 8));
console.log("\nsamples:");
for (const r of records.filter((x) => /Architectural|Tree|Permit Fee|WASA|MEP|Structural|Civil/i.test(x.name)).slice(0, 10))
  console.log(`  [${r.code}] ${r.name}  ::  ${r.division}`);
const nullCode = records.filter((r) => !r.code);
console.log(`\nrecords with null code: ${nullCode.length}`);
if (nullCode.length) nullCode.slice(0, 12).forEach((r) => console.log(`  ${r.full_path}`));
