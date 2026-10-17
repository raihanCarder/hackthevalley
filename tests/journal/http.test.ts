import test from "node:test";
import assert from "node:assert/strict";
import { HttpJournal } from "../../src/journal/http";
import { parseLocalDate } from "../../src/domain/contracts";
import { input } from "./fixtures";

test("server failures retain the chosen store and propagate rejection without a fallback write", async () => {
  const requests: string[] = [];
  const repository = new HttpJournal((async path => {
    requests.push(String(path));
    return Response.json({ error: { code: "unavailable", message: "PostgreSQL rejected the save." } }, { status: 503 });
  }) as typeof fetch);
  await assert.rejects(repository.upsert(input()), { code: "unavailable" });
  assert.equal(repository.storage, "postgresql");
  assert.deepEqual(requests, ["/api/entries/2026-10-17"]);
});
test("an explicit null is missing; malformed or failed reads do not become empty entries", async () => {
  const missing = new HttpJournal((async () => Response.json({ entry: null })) as typeof fetch);
  assert.equal(await missing.read("visitor", parseLocalDate("2026-10-17")), null);
  const malformed = new HttpJournal((async () => Response.json({})) as typeof fetch);
  await assert.rejects(malformed.read("visitor", parseLocalDate("2026-10-17")));
});
