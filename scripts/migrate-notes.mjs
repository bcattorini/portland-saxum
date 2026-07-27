// One-time: migrate existing comment_tracking.notes into the comment_notes log.
// Idempotent: skips comments that already have a note. Run AFTER the SQL is applied.
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
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: tracks } = await sb
  .from("comment_tracking")
  .select("comment_id, notes, updated_at, updated_by")
  .not("notes", "is", null);

const { data: existing } = await sb.from("comment_notes").select("comment_id");
const already = new Set((existing ?? []).map((n) => n.comment_id));

const rows = (tracks ?? [])
  .filter((t) => t.notes && t.notes.trim() && !already.has(t.comment_id))
  .map((t) => ({
    comment_id: t.comment_id,
    body: t.notes.trim(),
    created_at: t.updated_at,
    created_by: t.updated_by ?? null,
  }));

if (!rows.length) {
  console.log("Nothing to migrate (already done or no notes).");
} else {
  const { error } = await sb.from("comment_notes").insert(rows);
  console.log(error ? "ERROR: " + error.message : `Migrated ${rows.length} notes into comment_notes.`);
}
const { count } = await sb.from("comment_notes").select("*", { count: "exact", head: true });
console.log("comment_notes total:", count);
