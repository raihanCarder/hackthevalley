import nextEnv from "@next/env";
import { Pool } from "pg";
import { randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { createWriteStream } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";

nextEnv.loadEnvConfig(process.cwd());
if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL for local PostgreSQL first.");
const url = new URL(process.env.DATABASE_URL);
if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) throw new Error("Browser acceptance requires a local database.");
const schema = `journal_browser_${randomBytes(6).toString("hex")}`;
const generatedFiles = ["tsconfig.json", "next-env.d.ts"];
const originals = await Promise.all(generatedFiles.map(file => readFile(file, "utf8")));
let generated;
const admin = new Pool({ connectionString: url.toString(), connectionTimeoutMillis: 3000 });
url.searchParams.set("options", `-c search_path=${schema}`);
const port = process.env.TEST_LOCAL_PORT ?? String(20000 + randomBytes(2).readUInt16BE() % 30000);
const env = { ...process.env, DATABASE_URL: url.toString(), TEST_DATABASE_URL: url.toString(), TEST_BASE_URL: `http://127.0.0.1:${port}`,
  PAIN_JOURNAL_DIST_DIR: `.next-${schema}`, GEMINI_API_KEY: "", GEMINI_MODEL: "" };
let server;
let provider;
const fakeProvider = process.argv.includes("--fake-gemini");
if (fakeProvider) Object.assign(env, { TEST_GEMINI_PROVIDER: "1", GEMINI_API_KEY: "local-acceptance-key", GEMINI_MODEL: "acceptance-model", GEMINI_API_BASE: "http://127.0.0.1:3199", GEMINI_TIMEOUT_MS: "400" });
const log = createWriteStream("/private/tmp/pain-journal-local-browser-server.log");
try {
  await admin.query(`CREATE SCHEMA ${schema}`);
  const migration = spawnSync(process.execPath, ["--import", "tsx", "db/migrate.ts"], { env, stdio: "inherit" });
  if (migration.status !== 0) throw new Error("Test-schema migration failed.");
  if (fakeProvider) {
    provider = spawn(process.execPath, ["tests/helpers/gemini-provider.mjs"], { stdio: ["ignore", "pipe", "pipe"] });
    await once(provider.stdout, "data");
  }
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", port], { env, detached: true, stdio: ["ignore", "pipe", "pipe"] });
  server.stdout.pipe(log); server.stderr.pipe(log);
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error("Test app exited; inspect /private/tmp/pain-journal-local-browser-server.log.");
    try { ready = (await fetch(`${env.TEST_BASE_URL}/api/status`, { signal: AbortSignal.timeout(3000) })).ok; } catch { /* Startup still in progress. */ }
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error("Test app did not become ready.");
  generated = await Promise.all(generatedFiles.map(file => readFile(file, "utf8")));
  const tests = spawn(process.execPath, ["node_modules/@playwright/test/cli.js", "test", ...process.argv.slice(2).filter(arg => arg !== "--fake-gemini")], { env, stdio: "inherit" });
  const [code] = await once(tests, "exit");
  process.exitCode = code ?? 1;
} finally {
  if (server && server.exitCode === null) { const ended = once(server, "exit"); process.kill(-server.pid, "SIGTERM"); await ended; }
  if (provider && provider.exitCode === null) { const ended = once(provider, "exit"); provider.kill("SIGTERM"); await ended; }
  log.end();
  // Restore only untouched generated configuration; never overwrite concurrent user edits.
  if (generated) for (let index = 0; index < generatedFiles.length; index++) {
    if (await readFile(generatedFiles[index], "utf8") === generated[index]) await writeFile(generatedFiles[index], originals[index]);
  }
  await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await admin.end();
  await rm(env.PAIN_JOURNAL_DIST_DIR, { recursive: true, force: true });
}
