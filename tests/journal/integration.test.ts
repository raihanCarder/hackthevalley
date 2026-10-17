import test from "node:test";
import assert from "node:assert/strict";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { IndexedDbJournal } from "../../src/journal/indexeddb";
import { journalMapServices, syntheticJournalSource } from "../../src/journal/integrations";
import { MAYA_ENTRIES } from "../../src/demo/maya";
import { validateEntryPayload, decodePaintSnapshot } from "../../src/body/map-utils";
import { HistoryMapLoader } from "../../src/timeline/map-loader";
import { TimelinePlaybackController } from "../../src/timeline/playback";
import { parseLocalDate } from "../../src/domain/contracts";

globalThis.IDBKeyRange = IDBKeyRange;
const date = parseLocalDate;

test("all 42 Maya maps reproduce their exact stored observations through the shared reducer", async () => {
  for (const entry of MAYA_ENTRIES) {
    const validated = await validateEntryPayload(entry);
    assert.equal(validated.submittedObservationsMatched, true, entry.localDate);
    assert.deepEqual(validated.entry.observations, entry.observations);
  }
  assert.ok(Object.isFrozen(MAYA_ENTRIES[30].maps.layers));
  const copy = await syntheticJournalSource.read("maya", date("2026-10-03"));
  copy!.observations.length = 0;
  assert.ok((await syntheticJournalSource.read("maya", date("2026-10-03")))!.observations.length > 0);
});

test("real PNG maps persist, replace measurements, reopen exactly and keep missing and empty dates distinct", async () => {
  const factory = new IDBFactory();
  const options = { profileId: "local-integration", maps: journalMapServices, synthetic: syntheticJournalSource, factory };
  const repository = new IndexedDbJournal(options);
  const source = MAYA_ENTRIES[34];
  const saved = await repository.upsert({ localDate: source.localDate, timeZone: source.timeZone, maps: source.maps, note: "Saved real map" });
  assert.deepEqual(saved.observations, source.observations);
  await repository.close();
  const reopened = new IndexedDbJournal(options);
  assert.deepEqual(await reopened.read("visitor", source.localDate), saved);
  const restored = await decodePaintSnapshot((await reopened.read("visitor", source.localDate))!.maps);
  assert.deepEqual(restored, await decodePaintSnapshot(source.maps));
  const replaced = await reopened.upsert({ localDate: source.localDate, timeZone: source.timeZone, maps: MAYA_ENTRIES[0].maps });
  assert.equal(replaced.id, saved.id);
  assert.deepEqual(replaced.observations, []);
  assert.equal(await reopened.read("visitor", date("2026-10-09")), null);
  assert.equal((await reopened.list("visitor", { from: date("2026-10-01"), to: date("2026-10-17") })).length, 1);
  await reopened.close();
});

test("an aborted delayed history read cannot populate the cache or replace a newer date", async () => {
  let finish!: () => void;
  let reads = 0;
  const wait = new Promise<void>(resolve => { finish = resolve; });
  const source = { async read(_profile: unknown, selected: string) { reads++; if (selected === "2026-10-03") await wait; return structuredClone(MAYA_ENTRIES.find(e => e.localDate === selected) ?? null); } };
  const loader = new HistoryMapLoader(source, "maya");
  const stale = new AbortController();
  const pending = loader.load(date("2026-10-03"), stale.signal);
  const rejected = assert.rejects(pending, { code: "cancelled" });
  stale.abort();
  const current = await loader.load(date("2026-10-10"), new AbortController().signal);
  finish(); await rejected;
  assert.equal(current.entry!.localDate, "2026-10-10");
  assert.deepEqual(current.layers, await decodePaintSnapshot(MAYA_ENTRIES[34].maps));
  await loader.load(date("2026-10-10"), new AbortController().signal);
  assert.equal(reads, 2, "a decoded prefetched date is reused");
  await loader.load(date("2026-10-03"), new AbortController().signal);
  assert.equal(reads, 3, "the aborted date was not cached");
});

test("playback starts at the selected date, changes speed, stops at the end, and scrubbing cancels timers", context => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const dates: string[] = []; let ended = 0;
  const controller = new TimelinePlaybackController(MAYA_ENTRIES, date("2026-10-01"), date("2026-10-03"), d => dates.push(d), () => ended++, 1000);
  controller.seek(date("2026-10-02"));
  assert.deepEqual(controller.getPrefetchWindow(), ["2026-10-02", "2026-10-03"]);
  controller.play(); controller.setSpeed(500);
  context.mock.timers.tick(500);
  assert.equal(dates.at(-1), "2026-10-03");
  context.mock.timers.tick(500); assert.equal(ended, 1);
  controller.play(); controller.seek(date("2026-10-02"));
  context.mock.timers.tick(2000); assert.equal(dates.at(-1), "2026-10-02");
  controller.dispose();
  const single = new TimelinePlaybackController([MAYA_ENTRIES[0]], date("2026-09-06"), date("2026-09-07"), () => {}, () => {});
  assert.equal(single.play(), false); single.dispose();
});
