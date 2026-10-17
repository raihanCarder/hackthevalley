import test from "node:test";
import assert from "node:assert/strict";
import { assertVersions, BODY_MAP_VERSION, MAP_SIZE, PAIN_TYPES, parseDailyEntry, parseLocalDate, parsePainType, parseRegionId, SCHEMA_VERSION } from "../src/domain/contracts";

test("local dates follow the calendar without timezone shifts", () => {
  for (const date of ["2026-10-17", "2024-02-29", "2000-02-29", "0001-01-01"]) assert.equal(parseLocalDate(date), date);
  for (const date of ["2026-02-29", "1900-02-29", "2026-04-31", "2026-00-01", "2026-13-01", "2026-01-00", "0000-01-01", "2026-1-1", "2026-10-17T00:00:00Z", null]) assert.throws(() => parseLocalDate(date));
});
test("unknown body regions, sensations, and versions are rejected", () => {
  assert.equal(parseRegionId("left-calf"), "left-calf");
  assert.equal(parsePainType("aching"), "aching");
  assert.throws(() => parseRegionId("viewer-left-leg"));
  assert.throws(() => parsePainType("electric"));
  assert.throws(() => assertVersions({ schemaVersion: 2, bodyMapVersion: BODY_MAP_VERSION }));
  assert.throws(() => assertVersions({ schemaVersion: SCHEMA_VERSION, bodyMapVersion: "future-model" }));
});
const entry = () => ({
  id: "test-entry", profileId: "local-test", localDate: "2026-10-17", timeZone: "America/Toronto", updatedAt: "2026-10-17T20:00:00.000Z",
  schemaVersion: SCHEMA_VERSION, bodyMapVersion: BODY_MAP_VERSION,
  maps: { bodyMapVersion: BODY_MAP_VERSION, width: MAP_SIZE, height: MAP_SIZE, encoding: "png-base64", layers: Object.fromEntries(PAIN_TYPES.map(type => [type, "structural-test-placeholder"])) },
  note: "Original written note", observations: [{ regionId: "left-calf", painType: "aching", meanIntensity: 1, peakIntensity: 4, mapCoverage: .2 }],
});
test("entry structure preserves four independent layers and explicit records", () => {
  const parsed = parseDailyEntry(entry());
  assert.equal(parsed.localDate, "2026-10-17");
  assert.deepEqual(Object.keys(parsed.maps.layers), [...PAIN_TYPES]);
  assert.equal(parseDailyEntry({ ...entry(), observations: [] }).observations.length, 0);
  assert.throws(() => parseDailyEntry(null));
});
test("entry validation rejects inconsistent metadata and observations", () => {
  const base = entry();
  for (const patch of [
    { localDate: "2026-02-30" }, { bodyMapVersion: "other" }, { schemaVersion: 0 }, { timeZone: "unknown/zone" }, { updatedAt: "yesterday" },
    { observations: [{ ...base.observations[0], regionId: "unknown" }] },
    { observations: [{ ...base.observations[0], peakIntensity: 11 }] },
    { observations: [{ ...base.observations[0], mapCoverage: -1 }] },
    { observations: [base.observations[0], base.observations[0]] },
    { maps: { ...base.maps, bodyMapVersion: "other" } },
    { maps: { ...base.maps, width: 256 } },
    { maps: { ...base.maps, layers: { aching: "only-one-layer" } } },
  ]) assert.throws(() => parseDailyEntry({ ...base, ...patch }));
});
