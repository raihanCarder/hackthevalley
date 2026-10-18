import { loadEnvConfig } from "@next/env";
import { readdir, readFile } from "node:fs/promises";
import { Pool } from "pg";

async function migrate() {
  loadEnvConfig(process.cwd());
  if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL for a local PostgreSQL database.");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(70610617)");
    await client.query("CREATE TABLE IF NOT EXISTS journal_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
    // Apply every migration once, in file-name order (001_…, 002_…).
    const names = (await readdir(new URL("./migrations/", import.meta.url))).filter(name => name.endsWith(".sql")).sort();
    for (const name of names) {
      const applied = await client.query("SELECT name FROM journal_migrations WHERE name = $1", [name]);
      if (applied.rowCount) continue;
      await client.query(await readFile(new URL(`./migrations/${name}`, import.meta.url), "utf8"));
      await client.query("INSERT INTO journal_migrations (name) VALUES ($1)", [name]);
    }
    await client.query("COMMIT");
    console.log("Journal migrations are up to date.");
  } catch {
    if (client) await client.query("ROLLBACK");
    throw new Error("Journal migration failed. Check the database and schema permissions.");
  } finally {
    client?.release();
    await pool.end();
  }
}
void migrate().catch(error => { console.error(error.message); process.exitCode = 1; });
