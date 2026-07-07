// Creates (or resets the password of) app users via the Supabase Admin API.
// Usage:
//   node scripts/create-users.mjs "bruno@example.com=TempPass123!" "asistente@example.com=OtherPass123!"
// Each arg is email=password. Emails are created pre-confirmed so they can log in immediately.
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
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const args = process.argv.slice(2);
if (!args.length) {
  console.error('Pass one or more "email=password" pairs.');
  process.exit(1);
}

const { data: existing } = await admin.auth.admin.listUsers();
for (const a of args) {
  const idx = a.indexOf("=");
  const email = a.slice(0, idx).trim().toLowerCase();
  const password = a.slice(idx + 1);
  if (!email || !password) { console.error("skip invalid:", a); continue; }

  const found = existing.users.find((u) => u.email?.toLowerCase() === email);
  if (found) {
    const { error } = await admin.auth.admin.updateUserById(found.id, { password });
    console.log(error ? `ERROR ${email}: ${error.message}` : `Updated password: ${email}`);
  } else {
    const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    console.log(error ? `ERROR ${email}: ${error.message}` : `Created: ${email}`);
  }
}
