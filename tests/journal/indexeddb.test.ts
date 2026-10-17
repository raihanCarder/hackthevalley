import "fake-indexeddb/auto";
import { IDBDatabase, IDBFactory } from "fake-indexeddb";
import test from "node:test";
import assert from "node:assert/strict";
import { parseLocalDate } from "../../src/domain/contracts";
import { IndexedDbJournal, localVisitorId } from "../../src/journal/indexeddb";
import { input, mapServices } from "./fixtures";

const date = parseLocalDate;
test("IndexedDB upserts once per profile/date, survives reopening, and restores the exact maps/note", async () => {
  const factory = new IDBFactory();
  const options = { profileId: "local-test", maps: mapServices, factory };
  const repository = new IndexedDbJournal(options);
  assert.equal(await repository.read("visitor", date("2026-10-17")), null);
  const first = await repository.upsert(input());
  const changed = { ...input(), note: "Updated note", maps: input(undefined, "replacement").maps };
  const saved = await repository.upsert(changed);
  assert.equal(saved.id, first.id);
  await repository.close();
  const reopened = new IndexedDbJournal(options);
  assert.deepEqual(await reopened.read("visitor", date("2026-10-17")), saved);
  const list = await reopened.list("visitor", { from: date("2026-10-01"), to: date("2026-10-31") });
  assert.equal(list.length, 1);
  assert.equal("maps" in list[0], false);
  assert.equal("note" in list[0], false);
  const detached = await reopened.read("visitor", date("2026-10-17"));
  detached!.maps.layers.aching = "changed copy";
  assert.deepEqual(await reopened.read("visitor", date("2026-10-17")), saved);
  await reopened.close();
});

test("profiles are isolated; empty entries are recorded, missing dates are absent, and previous skips gaps", async () => {
  const factory = new IDBFactory();
  const one = new IndexedDbJournal({ profileId: "local-one", factory, maps: mapServices });
  const two = new IndexedDbJournal({ profileId: "local-two", factory, maps: mapServices });
  await one.upsert(input("2026-10-15", "test-only-empty"));
  assert.equal((await one.read("visitor", date("2026-10-15")))?.observations.length, 0);
  assert.equal(await one.read("visitor", date("2026-10-16")), null);
  assert.equal((await one.previous("visitor", date("2026-10-17")))?.localDate, "2026-10-15");
  assert.equal(await one.previous("visitor", date("2026-10-15")), null);
  assert.equal(await two.read("visitor", date("2026-10-15")), null);
  assert.equal((await two.list("visitor", { from: date("2026-10-01"), to: date("2026-10-31") })).length, 0);
  await assert.rejects(one.read("maya", date("2026-10-15")), { code: "unavailable" });
  await assert.rejects(one.upsert({ ...input(), profileId: "maya" } as never), { code: "invalid" });
  await one.close(); await two.close();
});

test("an aborted IndexedDB transaction acknowledges no save and preserves the old entry and summary", async () => {
  const repository = new IndexedDbJournal({ profileId: "local-test", factory: new IDBFactory(), maps: mapServices });
  const saved = await repository.upsert(input());
  const original = IDBDatabase.prototype.transaction;
  IDBDatabase.prototype.transaction = function (...args: Parameters<typeof original>) {
    const tx = original.apply(this, args);
    if (args[1] === "readwrite") queueMicrotask(() => tx.abort());
    return tx;
  };
  try { await assert.rejects(repository.upsert({ ...input(), note: "Rejected change" }), { code: "unavailable" }); }
  finally { IDBDatabase.prototype.transaction = original; }
  assert.deepEqual(await repository.read("visitor", date("2026-10-17")), saved);
  assert.equal((await repository.list("visitor", { from: date("2026-10-17"), to: date("2026-10-17") })).length, 1);
  await repository.close();
});

test("cancelled reads and blocked local identity fail explicitly", async () => {
  const repository = new IndexedDbJournal({ profileId: "local-test", factory: new IDBFactory(), maps: mapServices });
  const abort = new AbortController(); abort.abort();
  await assert.rejects(repository.read("visitor", date("2026-10-17"), { signal: abort.signal }), { code: "cancelled" });
  assert.throws(() => localVisitorId({ getItem() { throw new Error("blocked"); }, setItem() {} }), { code: "unavailable" });
});
