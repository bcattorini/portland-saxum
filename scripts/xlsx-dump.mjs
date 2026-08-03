import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
const path = process.argv[2];
const wb = XLSX.read(readFileSync(path), { type: "buffer" });
console.log("sheets:", wb.SheetNames);
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });
console.log("total rows:", rows.length);
console.log("----- first 14 rows -----");
for (let i = 0; i < Math.min(14, rows.length); i++) {
  console.log(i, JSON.stringify(rows[i]).slice(0, 320));
}
