import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const env = {};
for (const l of readFileSync(join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) { const m=/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(l); if(m) env[m[1]]=m[2].trim(); }
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: appUsers, error } = await sb.from("app_users").select("*");
console.log("app_users:", error ? "ERR "+error.message : JSON.stringify(appUsers));

const { data: authList } = await sb.auth.admin.listUsers();
console.log("auth users:", authList.users.map(u => u.email));
