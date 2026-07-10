// Dumps extracted text from a PDF (pdf-parse v2). Usage: node scripts/pdf-dump.mjs <path> [outfile]
import { readFileSync, writeFileSync } from "node:fs";
import { PDFParse } from "pdf-parse";

const path = process.argv[2];
const out = process.argv[3];
const parser = new PDFParse({ data: new Uint8Array(readFileSync(path)) });
const res = await parser.getText();
console.log("result keys:", Object.keys(res));
console.log("pages:", res.total ?? res.numpages ?? "?", " chars:", res.text?.length ?? 0);
if (out && res.text) writeFileSync(out, res.text, "utf8");
console.log("----- first 4500 chars -----");
console.log((res.text ?? "").slice(0, 4500));
await parser.destroy?.();
