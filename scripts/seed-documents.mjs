// Re-seeds property_documents via the API (guarantees correct UTF-8 for
// Spanish accents — the SQL-Editor paste corrupted them). Deletes existing
// docs first so this is the single source of truth for the seed.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const env = {};
for (const l of readFileSync(join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(l);
  if (m) env[m[1]] = m[2].trim();
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const BBL_5 = "Dedicación de 5 ft en NE 77 St. Contacto: Sandra Saez · Ssaez@miamigov.com · 305-416-1262. Proceso 14-16 semanas.";
const BBL_OAK = "Dedicación de 10 ft en Oak Av. Contacto: Sandra Saez. Proceso 14-16 semanas.";
const WASA = "Acuerdo WASA pendiente de entrega por el dueño.";
const FPL = "Coordinación FPL pendiente.";
const COV = "Covenant pendiente de entrega por el dueño.";
const HYD = "Reporte de hydrant flow test (vigencia máx. 12 meses).";

const base = [
  { title: "WASA Agreement", description: WASA, status: "Pending", assignee: "Dueño" },
  { title: "FPL", description: FPL, status: "Pending", assignee: "Dueño" },
  { title: "BBL Dedication (NE 77 St, 5ft)", description: BBL_5, status: "Pending", assignee: "Bruno" },
  { title: "Covenant", description: COV, status: "Pending", assignee: "Dueño" },
  { title: "Hydrant Flow Test", description: HYD, status: "Pending", assignee: "Dueño" },
];

// address (or predicate) → list of docs
const SEED = [
  { addr: "156 NE 77 St", docs: base },
  { addr: "150 NE 77 St", docs: base },
  {
    addr: "160 NE 77 St",
    docs: [
      ...base,
      { title: "Civil comments response", description: "Respuesta a comentarios de Civil pendiente por David.", status: "Pending", assignee: "David" },
    ],
  },
  {
    addr: "3770 Oak Av",
    docs: [
      { title: "Carta del vecino (tala de aguacate)", description: "Carta del vecino autorizando la remoción del árbol de aguacate en propiedad adyacente.", status: "Pending", assignee: "Bruno" },
      { title: "BBL Dedication (Oak Av, 10ft)", description: BBL_OAK, status: "Pending", assignee: "Bruno" },
      { title: "Waiver PZ-25-20026", description: "Waiver de setback PZ-25-20026 en proceso. Building permit no se aprueba hasta final decision.", status: "In Progress", assignee: "David" },
    ],
  },
  {
    addr: "3801 Oak Av",
    docs: [
      { title: "BBL Dedication (Oak Av, 10ft)", description: BBL_OAK, status: "Pending", assignee: "Bruno" },
      { title: "Covenant (doble folio)", description: "Covenant doble folio (Zoning REF74). Contacto: Alicia T. Menardy · ATMenardy@miamigov.com.", status: "Pending", assignee: "Alicia T. Menardy" },
    ],
  },
  {
    addr: "3201 Day Av",
    docs: [
      { title: "BBL Dedication (McDonald St, 10ft)", description: "Dedicación de 10 ft en McDonald St. Contacto: Sandra Saez. Proceso 14-16 semanas.", status: "Pending", assignee: "Bruno" },
      { title: "Covenant (doble folio)", description: "Covenant doble folio. Contacto: Alicia T. Menardy · ATMenardy@miamigov.com.", status: "Pending", assignee: "Alicia T. Menardy" },
    ],
  },
  {
    addrIncludes: "Demo",
    docs: [
      { title: "Tree Protection Bond $36,000", description: "Entregar EN PERSONA: 444 SW 2nd Ave, 4th floor, Environmental Resources Div. Pink Tabebuia #20 → $20,000 · Gumbo Limbo #23 → $16,000. Bloquea aprobación del demo permit.", status: "Pending", assignee: "Bruno" },
    ],
  },
];

const { data: props } = await sb.from("properties").select("id,address");
const byExact = new Map(props.map((p) => [p.address, p.id]));
const resolve2 = (s) =>
  s.addrIncludes ? props.find((p) => p.address.includes(s.addrIncludes))?.id : byExact.get(s.addr);

const rows = [];
for (const s of SEED) {
  const pid = resolve2(s);
  if (!pid) throw new Error("property not found: " + JSON.stringify(s.addr ?? s.addrIncludes));
  s.docs.forEach((d, i) => rows.push({ property_id: pid, sort_order: i + 1, ...d }));
}

// wipe existing (all seeded by us) and re-insert clean
const { error: delErr } = await sb.from("property_documents").delete().not("id", "is", null);
if (delErr) throw new Error("delete failed: " + delErr.message);
const { data: inserted, error: insErr } = await sb.from("property_documents").insert(rows).select("id");
if (insErr) throw new Error("insert failed: " + insErr.message);

console.log(`Re-seeded ${inserted.length} documents with correct UTF-8.`);
const { data: check } = await sb.from("property_documents").select("assignee,description").eq("assignee", "Dueño").limit(1);
console.log("Verify accent:", JSON.stringify(check?.[0]));
