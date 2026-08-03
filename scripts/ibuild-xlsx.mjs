// Parses an iBuild "Plan Review - Review Comments" Excel export into the same
// {permit, records} shape as ibuild-parse.mjs (so ibuild-import.mjs can reuse it).
// Columns: REF# | CYCLE | REVIEWED BY (area\nreviewer\ndate) | TYPE (type\n[note]\ntext) | FILENAME | DISCUSSION | STATUS
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { resolveCode } from "./ibuild-parse.mjs";

const STATUSES = new Set(["Unresolved", "Resolved", "Info Only", "Information"]);

export function parseXlsx(path) {
  const wb = XLSX.read(readFileSync(path), { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });

  const permit = (rows.flat().join("\n").match(/Project Name:\s*(\S+)/) || [])[1] || null;
  const hi = rows.findIndex((r) => String(r[0]).trim() === "REF #");

  const records = [];
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i];
    const ref = parseInt(String(r[0]).trim(), 10);
    if (!Number.isFinite(ref)) continue;

    const cycle = String(r[1]).trim() ? parseInt(String(r[1]).trim(), 10) : null;
    const reviewedBy = String(r[2]).split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    const area = reviewedBy[0] || "";
    const reviewer = reviewedBy[1] || "";

    const typeCell = String(r[3]).split(/\r?\n/).map((s) => s.trim());
    const type = typeCell[0] || "";
    let textLines = typeCell.slice(1).filter(Boolean);
    let note = null;
    if (/changemark/i.test(type) && textLines.length) { note = textLines[0]; textLines = textLines.slice(1); }
    const text = textLines.join(" ").replace(/\s+/g, " ").trim();

    const filename = String(r[4]).trim() || null;
    let status = String(r[6]).trim();
    if (!STATUSES.has(status)) status = null; // blank/unknown -> importer preserves existing or defaults

    const code = resolveCode(area, reviewer);
    records.push({ ref, cycle, area, reviewer, type, code, status, filename, note, text });
  }
  return { permit, records };
}
