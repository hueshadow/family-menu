// One-off migration runner: applies src/lib/db.sql via direct Postgres connection.
// Usage: node --env-file=.env.local scripts/migrate.mjs

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlPath = join(__dirname, "..", "src", "lib", "db.sql");

const required = [
  "SUPABASE_DB_HOST",
  "SUPABASE_DB_PORT",
  "SUPABASE_DB_NAME",
  "SUPABASE_DB_USER",
  "SUPABASE_DB_PASSWORD",
];
for (const k of required) {
  if (!process.env[k]) {
    console.error(`✗ missing env: ${k}`);
    process.exit(1);
  }
}

const client = new pg.Client({
  host: process.env.SUPABASE_DB_HOST,
  port: Number(process.env.SUPABASE_DB_PORT),
  database: process.env.SUPABASE_DB_NAME,
  user: process.env.SUPABASE_DB_USER,
  password: process.env.SUPABASE_DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

const sql = await readFile(sqlPath, "utf8");

await client.connect();
console.log("→ connected to", process.env.SUPABASE_DB_HOST);

await client.query(sql);
console.log("✓ schema applied");

const { rows } = await client.query(
  `select table_name from information_schema.tables
   where table_schema = 'public' order by table_name`,
);
console.log("→ tables:", rows.map((r) => r.table_name).join(", "));

await client.end();
