// Authoritative schema introspection via PostgREST's OpenAPI spec (covers empty tables too).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const env = {};
for (const line of readFileSync(join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
  if (m) env[m[1]] = m[2].trim();
}
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
});
const spec = await res.json();
const defs = spec.definitions || {};
for (const [table, def] of Object.entries(defs)) {
  const cols = Object.entries(def.properties || {}).map(([c, p]) => {
    const pk = /Primary Key/i.test(p.description || "") ? " PK" : "";
    const fk = /Foreign Key/i.test(p.description || "") ? " FK" : "";
    const en = p.enum ? ` = {${p.enum.join(" | ")}}` : "";
    return `${c}:${p.format || p.type}${pk}${fk}${en}`;
  });
  console.log(`\n[${table}]`);
  console.log("  " + cols.join("\n  "));
}
console.log("\nTABLES: " + Object.keys(defs).join(", "));
