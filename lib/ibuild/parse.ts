// Server-side port of scripts/ibuild-parse.mjs — parses an iBuild
// "Plan Review - Review Comments Report" PDF into structured comment records.
import { PDFParse } from "pdf-parse";

const AREA_TO_CODE: [RegExp, string][] = [
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
const REVIEWER_TO_CODE: Record<string, string> = {
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
export const CODE_NAME: Record<string, string> = {
  B: "Building", Z: "Zoning", P: "Plumbing", FF: "Flood Plain", LI: "Environmental",
  S: "Structural", MDC: "Miami-Dade Co.", DRP: "Public Works", F: "Fire",
  E: "Electrical", MA: "Mechanical", BBL: "PW BBL",
};

export function resolveCode(area: string, reviewer: string): string | null {
  for (const [re, code] of AREA_TO_CODE) if (re.test(area)) return code;
  const r = (reviewer || "").toLowerCase().trim();
  if (REVIEWER_TO_CODE[r]) return REVIEWER_TO_CODE[r];
  return null;
}

export type ParsedRecord = {
  ref: number;
  cycle: number | null;
  area: string;
  reviewer: string;
  type: string;
  code: string | null;
  status: string | null;
  filename: string | null;
  note: string | null;
  text: string;
};

export async function parseReport(data: Uint8Array): Promise<{ permit: string | null; records: ParsedRecord[] }> {
  const parser = new PDFParse({ data });
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

  const anchors: number[] = [];
  for (let i = 0; i < lines.length - 1; i++) if (dateRe.test(lines[i]) && typeRe.test(lines[i + 1])) anchors.push(i);

  const refIdxOf = (dateIdx: number) => {
    for (let j = dateIdx - 2; j >= 0 && j >= dateIdx - 6; j--) {
      if (refStart.test(lines[j]) && !dateRe.test(lines[j]) && !typeRe.test(lines[j])) return j;
    }
    return -1;
  };
  const refIdxs = anchors.map(refIdxOf);

  const records: ParsedRecord[] = [];
  for (let a = 0; a < anchors.length; a++) {
    const dateIdx = anchors[a];
    const refIdx = refIdxs[a];
    if (refIdx < 0) continue;
    const m = lines[refIdx].match(/^(\d+)(?:\s+(\d+))?\s+(.*)$/);
    if (!m) continue;
    const ref = parseInt(m[1], 10);
    const cycle = m[2] ? parseInt(m[2], 10) : null;
    const reviewer = lines[dateIdx - 1];
    const area = [m[3], ...lines.slice(refIdx + 1, dateIdx - 1)].join(" ").replace(/\s+/g, " ").trim();
    const type = lines[dateIdx + 1];

    const bodyEnd = a + 1 < anchors.length ? refIdxs[a + 1] : lines.length;
    let body = lines.slice(dateIdx + 2, bodyEnd);

    let note: string | null = null;
    if (body[0] && /^Changemark note/i.test(body[0])) { note = body[0]; body = body.slice(1); }

    let status: string | null = null, filename: string | null = null, statusLineIdx = -1;
    for (let k = body.length - 1; k >= 0; k--) {
      const sm = body[k].match(statusWord);
      if (sm) { status = sm[1]; statusLineIdx = k; break; }
    }
    const fnMatch = body.join(" ").match(/([A-Za-z0-9_\-]+\.pdf)/i);
    if (fnMatch) filename = fnMatch[1];

    const respIdx = body.findIndex((l) => /^Responded by:/i.test(l));
    const textEnd = respIdx >= 0 ? respIdx : statusLineIdx >= 0 ? statusLineIdx + 1 : body.length;
    const textLines = body.slice(0, textEnd);
    let cityText = textLines.join(" ");
    if (filename) cityText = cityText.replace(new RegExp(filename.replace(/[.\-]/g, "\\$&"), "i"), "");
    if (status) cityText = cityText.replace(new RegExp(status + "\\s*$"), "");
    cityText = cityText.replace(/\bDone\b\s*$/, "").replace(/\s+/g, " ").trim();

    const code = resolveCode(area, reviewer);
    records.push({ ref, cycle, area, reviewer, type, code, status, filename, note, text: cityText });
  }
  return { permit, records };
}
