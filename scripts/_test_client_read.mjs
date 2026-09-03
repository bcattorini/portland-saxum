import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const env = {};
for (const l of readFileSync("C:/dev/portland-saxum/.env.local","utf8").split(/\r?\n/)){const m=/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(l);if(m)env[m[1]]=m[2].trim();}

// client exactly like the browser: anon/publishable key + a real user session
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth:{persistSession:false}});
const { error: authErr } = await sb.auth.signInWithPassword({ email:"dsinisi@portlandsaxum.com", password:"SaxumPagos2026" });
console.log("login:", authErr ? "ERR "+authErr.message : "OK (authenticated)");

const { data: props, error } = await sb.from("properties").select("id,address").order("address");
console.log("properties read:", error ? "ERR "+error.message : `${props.length} filas`);
if (props) for (const p of props) console.log("   ", p.address);

// also test reading general_payments (what the pagos page shows)
const { data: gp, error: gErr } = await sb.from("general_payments").select("id,property_id").limit(3);
console.log("general_payments read:", gErr ? "ERR "+gErr.message : `${gp.length} filas ok`);
