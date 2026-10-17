import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { PostgresJournal } from "../../src/journal/postgres";
import { parseLocalDate } from "../../src/domain/contracts";
import { input, mapServices } from "./fixtures";

test("real PostgreSQL daily upserts, isolation, transaction rollback, and concurrent replacements", async () => {
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(url, "Set TEST_DATABASE_URL to a local test database; this check does not use a simulated PostgreSQL implementation.");
  const schema = `journal_test_${randomBytes(6).toString("hex")}`;
  const admin = new Pool({ connectionString: url, connectionTimeoutMillis: 3000 });
  const pool = new Pool({ connectionString: url, options: `-c search_path=${schema}`, connectionTimeoutMillis: 3000 });
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    await pool.query(await readFile(new URL("../../db/migrations/001_journal.sql", import.meta.url), "utf8"));
    await pool.query("INSERT INTO visitor_sessions (token_hash, profile_id, expires_at) VALUES ($1, 'visitor-one', now() + interval '1 day'), ($2, 'visitor-two', now() + interval '1 day')", [randomBytes(32), randomBytes(32)]);
    const one = new PostgresJournal(pool, "visitor-one", mapServices);
    const two = new PostgresJournal(pool, "visitor-two", mapServices);
    const date = parseLocalDate("2026-10-17");
    const first = await one.upsert(input());
    assert.deepEqual(await one.read("visitor", date), first);
    assert.equal(await two.read("visitor", date), null);
    const empty = await one.upsert(input("2026-10-17", "test-only-empty"));
    assert.equal(empty.id, first.id);
    assert.equal(empty.observations.length, 0);
    assert.deepEqual(await one.read("visitor", date), empty);
    assert.equal(await one.read("visitor", parseLocalDate("2026-10-16")), null);
    const list = await one.list("visitor", { from: date, to: date });
    assert.equal(list.length, 1);
    assert.equal("maps" in list[0], false);
    assert.equal((await one.previous("visitor", parseLocalDate("2026-10-19")))?.localDate, date);

    await pool.query(`CREATE FUNCTION reject_test_observation() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.peak_intensity = 9 THEN RAISE EXCEPTION 'test write rejection'; END IF; RETURN NEW; END $$`);
    await pool.query("CREATE TRIGGER reject_test_observation BEFORE INSERT ON regional_observations FOR EACH ROW EXECUTE FUNCTION reject_test_observation()");
    const rejected = new PostgresJournal(pool, "visitor-one", { async validateAndMeasure() {
      return [{ regionId: "left-calf", painType: "burning", meanIntensity: 2, peakIntensity: 9, mapCoverage: .5 }];
    } });
    await assert.rejects(rejected.upsert({ ...input(), note: "Must roll back" }), { code: "unavailable" });
    assert.deepEqual(await one.read("visitor", date), empty);
    assert.equal((await pool.query("SELECT * FROM regional_observations")).rowCount, 0);
    await Promise.all([one.upsert(input()), one.upsert(input("2026-10-17", "test-only-empty"))]);
    const final = (await one.read("visitor", date))!;
    assert.equal(final.observations.length, final.maps.layers.aching.startsWith("test-only-empty") ? 0 : 1);
    assert.equal((await one.list("visitor", { from: date, to: date })).length, 1);
  } finally {
    await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
  }
});
