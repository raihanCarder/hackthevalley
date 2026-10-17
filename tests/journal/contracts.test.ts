import test from "node:test";
import assert from "node:assert/strict";
import { parseLocalDate } from "../../src/domain/contracts";
import { JournalError, MAX_NOTE_LENGTH, parseCheckInInput, prepareEntry, summarizeEntry, validateRange } from "../../src/journal/repository";
import { input, entry, mapServices } from "./fixtures";

test("bounded ranges count leap days, reject impossible dates, and preserve local dates", () => {
  for (const [from, to] of [["2024-01-01", "2024-12-31"], ["0001-01-01", "0001-12-31"]]) {
    assert.deepEqual(validateRange({ from: parseLocalDate(from), to: parseLocalDate(to) }), { from, to });
  }
  for (const [from, to] of [["2024-01-01", "2025-01-01"], ["2026-10-17", "2026-10-16"], ["2026-02-30", "2026-03-01"]]) {
    assert.throws(() => validateRange({ from: from as never, to: to as never }), JournalError);
  }
});

test("write envelope rejects forged identity, measurements, long notes, size, versions, and time zones", () => {
  const valid = input();
  assert.deepEqual(parseCheckInInput(valid), valid);
  for (const patch of [{ profileId: "another-visitor" }, { observations: [] }, { id: "chosen-id" },
    { note: "x".repeat(MAX_NOTE_LENGTH + 1) }, { note: 4 }, { localDate: "2026-02-30" },
    { timeZone: "not/a-zone" }, { maps: { ...valid.maps, bodyMapVersion: "future" } },
    { maps: { ...valid.maps, layers: { ...valid.maps.layers, aching: "x".repeat(6 * 1024 * 1024) } } },
  ]) assert.throws(() => parseCheckInInput({ ...valid, ...patch }), JournalError);
});

test("entry preparation requires A's map services and derives observations through that boundary", async () => {
  await assert.rejects(prepareEntry(input(), "local-test", null), { code: "unavailable" });
  const saved = await prepareEntry(input(), "local-test", mapServices);
  assert.equal(saved.profileId, "local-test");
  assert.equal(saved.observations[0].peakIntensity, 5);
  const summary = summarizeEntry(saved);
  assert.equal("maps" in summary, false);
  assert.equal("note" in summary, false);
  summary.observations.length = 0;
  assert.equal(saved.observations.length, 1);
  assert.equal(summarizeEntry(entry()).localDate, "2026-10-17");
});
