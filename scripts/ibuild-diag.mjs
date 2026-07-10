import { parseReport } from "./ibuild-parse.mjs";

const path = process.argv[2];
const { permit, records, unresolved, anchorCount } = await parseReport(path);
const kept = records.filter((r) => r.code && r.code !== "SKIP");
const skipped = records.filter((r) => r.code === "SKIP");
console.log(`permit: ${permit}   anchors: ${anchorCount}   parsed: ${records.length}`);
console.log(`kept: ${kept.length}   skipped(Permitting): ${skipped.length}   unresolved-discipline: ${unresolved.length}`);
const byCode = {}, byStatus = {};
for (const r of kept) { byCode[r.code] = (byCode[r.code] || 0) + 1; byStatus[r.status] = (byStatus[r.status] || 0) + 1; }
console.log("by discipline:", JSON.stringify(byCode));
console.log("by status:", JSON.stringify(byStatus));
if (unresolved.length) console.log("UNRESOLVED areas:", unresolved.map((r) => `#${r.ref} "${r.area}" (${r.reviewer})`).join(" | "));
const nullStatus = kept.filter((r) => !r.status);
if (nullStatus.length) console.log("NULL status refs:", nullStatus.map((r) => r.ref).join(", "));
const noText = kept.filter((r) => !r.text);
if (noText.length) console.log("EMPTY text refs:", noText.map((r) => r.ref).join(", "));
console.log("--- samples ---");
for (const r of kept.slice(0, 4)) console.log(`#${r.ref} [${r.code}/${r.status}] ${r.filename || ""} :: ${r.text.slice(0, 85)}`);
const refs = kept.map((r) => r.ref);
console.log(`ref range ${Math.min(...refs)}..${Math.max(...refs)}  unique ${new Set(refs).size}/${refs.length}`);
