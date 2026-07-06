// Applies SQL files to the Supabase Postgres in order, then verifies row counts.
// Usage: node scripts/apply-sql.mjs supabase/migrations/0001_initial_schema.sql supabase/seed/0001_permits_seed.sql
// Reads DATABASE_URL from .env.local.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import pg from "pg";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const txt = readFileSync(join(ROOT, ".env.local"), "utf8");
  const env = {};
  for (const line of txt.split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

const env = loadEnv();
const url = env.DATABASE_URL;
if (!url) {
  console.error(
    "DATABASE_URL is empty in .env.local.\n" +
      "Add the Supabase connection URI (Project Settings → Database → Connection string → URI).",
  );
  process.exit(1);
}

const files = process.argv.slice(2);
if (!files.length) {
  console.error("Pass one or more .sql files to apply.");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  for (const f of files) {
    const sql = readFileSync(resolve(ROOT, f), "utf8");
    process.stdout.write(`Applying ${f} ... `);
    await client.query(sql);
    console.log("done");
  }

  const q = async (sql) => (await client.query(sql)).rows[0].n;
  const props = await q("select count(*)::int n from properties");
  const disc = await q("select count(*)::int n from disciplines");
  const cmts = await q("select count(*)::int n from comments");
  console.log(`\nRow counts → properties=${props}  disciplines=${disc}  comments=${cmts}`);
} catch (e) {
  console.error("\nERROR:", e.message);
  process.exit(1);
} finally {
  await client.end();
}
