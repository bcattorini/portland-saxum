// Parses an iBuild "Plan Review - Review Comments Report" PDF into structured
// comment records. Diagnostics only (no DB writes). Usage: node scripts/ibuild-parse.mjs <pdf>
import { readFileSync } from "node:fs";
import { PDFParse } from "pdf-parse";

// area/reviewer -> discipline. SKIP = pre-cycle admin (Permitting Coordinator).
const AREA_TO_CODE = [
  [/permitting\s+coordinator/i, "SKIP"],
  [/miami\s*dade|(^|\W)mdc(\W|$)/i, "MDC"],
  [/pw\s*bbl|(^|\W)bbl(\W|$)/i, "BBL"],
  [/public\s+works/i, "DRP"],
  [/flood/i, "FF"],
  [/environmental/i, "LI"],
  [/structural/i, "S"],
  [/building/i, "B"],
  [/zoning/i, "Z"],
  [/plumbing/i, "P"],
  [/mechanical/i, "MA"],
  [/electrical/i, "E"],
  [/fire/i, "F"],
];
const REVIEWER_TO_CODE = {
  "carmen sueiro": "B", "maria matilde chalgub": "B",
  "jonathan thole": "Z", "yaremy vega": "Z",
  "cergio moreno": "P", "luis sosa": "P",
  "ana maria gonzalez": "FF", "ana m. gonzalez": "FF",
  "augusto carvajal": "LI", "craig henry": "LI", "ruben colon": "LI",
  "yanet albelo": "S", "yudexi rodriguez": "S",
  "gonzalo briz": "MDC",
  "iris valdes": "DRP",
  "nadya vazquez": "F", "joseph gentile": "F",
  "mauricio valdes": "BBL",
  "noel ferro": "E", "osmany caballero": "E",
  "alejandro cosano": "MA", "juan dalmau": "MA",
};
const CODE_NAME = {
  B: "Building", Z: "Zoning", P: "Plumbing", FF: "Flood Plain", LI: "Environmental",
  S: "Structural", MDC: "Miami-Dade Co.", DRP: "Public Works", F: "Fire",
  E: "Electrical", MA: "Mechanical", BBL: "PW BBL",
};

function resolveCode(area, reviewer) {
  for (const [re, code] of AREA_TO_CODE) if (re.test(area)) return code;
  const r = (reviewer || "").toLowerCase().trim();
  if (REVIEWER_TO_CODE[r]) return REVIEWER_TO_CODE[r];
  return null; // unresolved
}

export async function parseReport(pdfPath) {
  const parser = new PDFParse({ data: new Uint8Array(readFileSync(pdfPath)) });
  const { text } = await parser.getText();
  await parser.destroy?.();

  const permit = (text.match(/Project Name:\s*(\S+)/) || [])[1] || null;

  const noise = [
    /^Plan Review - Review Comments Report$/, /^Project Name:/, /^Workflow Started:/,
    /^Report Generated:/, /^REF # CYCLE REVIEWED BY TYPE FILENAME DISCUSSION STATUS$/,
    /^REVIEW COMMENTS$/, /^-- \d+ of \d+ --$/, /^\s*$/,
  ];
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => !noise.some((re) => re.test(l)));

  const dateRe = /^\d{1,2}\/\d{1,2}\/\d{2,4}\s+\d{1,2}:\d{2}\s*(AM|PM)$/;
  const typeRe = /^(Comment|Changemark|Library Comment)$/;
  const statusWord = /(Unresolved|Resolved|Info Only|Information)/;
  const refStart = /^(\d+)(?:\s+(\d+))?\s+\S/;

  // anchors: date lines whose next line is a TYPE (excludes wrapped response dates)
  const anchors = [];
  for (let i = 0; i < lines.length - 1; i++) if (dateRe.test(lines[i]) && typeRe.test(lines[i + 1])) anchors.push(i);

  // ref line index for each anchor
  const refIdxOf = (dateIdx) => {
    for (let j = dateIdx - 2; j >= 0 && j >= dateIdx - 6; j--) {
      if (refStart.test(lines[j]) && !dateRe.test(lines[j]) && !typeRe.test(lines[j])) return j;
    }
    return -1;
  };
  const refIdxs = anchors.map(refIdxOf);

  const records = [];
  const unresolved = [];
  for (let a = 0; a < anchors.length; a++) {
    const dateIdx = anchors[a];
    const refIdx = refIdxs[a];
    if (refIdx < 0) continue;
    const m = lines[refIdx].match(/^(\d+)(?:\s+(\d+))?\s+(.*)$/);
    const ref = parseInt(m[1], 10);
    const cycle = m[2] ? parseInt(m[2], 10) : null;
    const reviewer = lines[dateIdx - 1];
    const area = [m[3], ...lines.slice(refIdx + 1, dateIdx - 1)].join(" ").replace(/\s+/g, " ").trim();
    const type = lines[dateIdx + 1];

    // block body = after type, up to next anchor's ref line
    const bodyEnd = a + 1 < anchors.length ? refIdxs[a + 1] : lines.length;
    let body = lines.slice(dateIdx + 2, bodyEnd);

    // changemark note
    let note = null;
    if (body[0] && /^Changemark note/i.test(body[0])) { note = body[0]; body = body.slice(1); }

    // status = last body line containing a status word; strip it + any filename
    let status = null, filename = null;
    let statusLineIdx = -1;
    for (let k = body.length - 1; k >= 0; k--) {
      const sm = body[k].match(statusWord);
      if (sm) { status = sm[1]; statusLineIdx = k; break; }
    }
    // filename anywhere in body
    const fnMatch = body.join(" ").match(/([A-Za-z0-9_\-]+\.pdf)/i);
    if (fnMatch) filename = fnMatch[1];

    // City comment text = body up to "Responded by:" (or up to status line), minus filename/status tokens
    let respIdx = body.findIndex((l) => /^Responded by:/i.test(l));
    const textEnd = respIdx >= 0 ? respIdx : statusLineIdx >= 0 ? statusLineIdx + 1 : body.length;
    let textLines = body.slice(0, textEnd);
    let cityText = textLines.join(" ");
    if (filename) cityText = cityText.replace(new RegExp(filename.replace(/[.\-]/g, "\\$&"), "i"), "");
    if (status) cityText = cityText.replace(new RegExp(status + "\\s*$"), "");
    cityText = cityText.replace(/\bDone\b\s*$/,"").replace(/\s+/g, " ").trim();

    const code = resolveCode(area, reviewer);
    const rec = { ref, cycle, area, reviewer, type, code, status, filename, note, text: cityText };
    if (!code) unresolved.push(rec);
    records.push(rec);
  }
  return { permit, records, unresolved, anchorCount: anchors.length };
}

// ---- CLI diagnostics ----
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}`) {
  const path = process.argv[2];
  const { permit, records, unresolved, anchorCount } = await parseReport(path);
  console.log(`permit: ${permit}   anchors: ${anchorCount}   parsed: ${records.length}`);
  const kept = records.filter((r) => r.code && r.code !== "SKIP");
  const skipped = records.filter((r) => r.code === "SKIP");
  console.log(`kept: ${kept.length}   skipped(Permitting): ${skipped.length}   unresolved-discipline: ${unresolved.length}`);
  const byCode = {}, byStatus = {};
  for (const r of kept) { byCode[r.code] = (byCode[r.code] || 0) + 1; byStatus[r.status] = (byStatus[r.status] || 0) + 1; }
  console.log("by discipline:", byCode);
  console.log("by status:", byStatus);
  if (unresolved.length) console.log("UNRESOLVED areas:", unresolved.map((r) => `#${r.ref} "${r.area}" (${r.reviewer})`));
  console.log("\n--- sample records ---");
  for (const r of kept.slice(0, 3)) console.log(JSON.stringify({ ref: r.ref, code: r.code, status: r.status, filename: r.filename, text: r.text.slice(0, 90) }));
  const refs = kept.map((r) => r.ref);
  console.log(`\nref range: ${Math.min(...refs)}..${Math.max(...refs)}  unique refs: ${new Set(refs).size}/${refs.length}`);
}
