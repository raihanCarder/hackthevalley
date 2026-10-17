import test from "node:test";
import assert from "node:assert/strict";
import { MAYA_ENTRIES, MAYA_PROFILE, getMayaEntry, listMayaEntries } from "../src/demo/maya";
import { parseDailyEntry, parseLocalDate } from "../src/domain/contracts";

test("Maya fixture contains exactly 42 consecutive validated daily entries", () => {
  assert.equal(MAYA_ENTRIES.length, 42);
  assert.equal(MAYA_PROFILE.isSynthetic, true);
  assert.equal(MAYA_PROFILE.isReadOnly, true);

  // Validate date range continuity
  let expectedYear = 2026;
  let expectedMonth = 9;
  let expectedDay = 6;

  for (let i = 0; i < MAYA_ENTRIES.length; i++) {
    const entry = MAYA_ENTRIES[i];
    const monthStr = expectedMonth < 10 ? `0${expectedMonth}` : `${expectedMonth}`;
    const dayStr = expectedDay < 10 ? `0${expectedDay}` : `${expectedDay}`;
    const expectedDate = `${expectedYear}-${monthStr}-${dayStr}`;

    assert.equal(entry.localDate, expectedDate);
    assert.equal(entry.profileId, "maya-synthetic");

    // Every entry must pass structural and domain validation
    const validated = parseDailyEntry(entry);
    assert.equal(validated.id, entry.id);

    // Validate 4 layer PNG base64 strings
    for (const type of ["burning", "sharp", "aching", "tingling"] as const) {
      const b64 = entry.maps.layers[type];
      assert.ok(typeof b64 === "string" && b64.length > 100);
      // Standard PNG base64 starts with iVBORw0KGgo
      assert.ok(b64.startsWith("iVBORw0KGgo"));
    }

    // Step calendar day
    const daysInMonth = expectedMonth === 9 ? 30 : 31;
    expectedDay++;
    if (expectedDay > daysInMonth) {
      expectedMonth++;
      expectedDay = 1;
    }
  }
});

test("Maya aching lower-back occurs on 38 days with 4 early explicitly empty entries", () => {
  const emptyDays = MAYA_ENTRIES.filter(e => e.observations.length === 0);
  assert.equal(emptyDays.length, 4);

  const emptyDates = emptyDays.map(e => e.localDate);
  assert.deepEqual(emptyDates, ["2026-09-06", "2026-09-07", "2026-09-08", "2026-09-09"]);

  // Back aching days
  const backAchingEntries = MAYA_ENTRIES.filter(e =>
    e.observations.some(
      o => o.regionId === "back-lower-torso" && o.painType === "aching" && o.mapCoverage > 0
    )
  );
  assert.equal(backAchingEntries.length, 38);
  assert.equal(backAchingEntries[0].localDate, "2026-09-10");
  assert.equal(backAchingEntries[backAchingEntries.length - 1].localDate, "2026-10-17");

  // Every aching observation has mean <= peak
  for (const entry of backAchingEntries) {
    const obs = entry.observations.find(o => o.regionId === "back-lower-torso" && o.painType === "aching")!;
    assert.ok(obs.peakIntensity >= 3 && obs.peakIntensity <= 8);
    assert.ok(obs.meanIntensity <= obs.peakIntensity);
    assert.ok(obs.mapCoverage > 0 && obs.mapCoverage <= 1);
  }
});

test("Maya left-thigh burning begins on October 3, 2026 and calf burning begins on October 10", () => {
  // Before October 3, zero burning anywhere
  const beforeOct3 = MAYA_ENTRIES.filter(e => e.localDate < "2026-10-03");
  for (const entry of beforeOct3) {
    const hasBurning = entry.observations.some(o => o.painType === "burning" && o.mapCoverage > 0);
    assert.equal(hasBurning, false, `Found unexpected burning on ${entry.localDate}`);
  }

  // Left thigh burning first occurs on 2026-10-03
  const thighBurningDays = MAYA_ENTRIES.filter(e =>
    e.observations.some(o => o.regionId === "left-thigh" && o.painType === "burning" && o.mapCoverage > 0)
  );
  assert.equal(thighBurningDays[0].localDate, "2026-10-03");
  assert.equal(thighBurningDays.length, 15); // Oct 3 to Oct 17 inclusive = 15 days

  // Left calf burning first occurs on 2026-10-10
  const calfBurningDays = MAYA_ENTRIES.filter(e =>
    e.observations.some(o => o.regionId === "left-calf" && o.painType === "burning" && o.mapCoverage > 0)
  );
  assert.equal(calfBurningDays[0].localDate, "2026-10-10");
  assert.equal(calfBurningDays.length, 8); // Oct 10 to Oct 17 inclusive = 8 days
});

test("Maya lookup helpers find entries by date or list all entries", () => {
  const oct3 = getMayaEntry("2026-10-03");
  assert.ok(oct3 !== null);
  assert.equal(oct3.localDate, "2026-10-03");

  const missing = getMayaEntry("2026-08-01");
  assert.equal(missing, null);

  const all = listMayaEntries();
  assert.equal(all.length, 42);
});

test("Maya notes reflect the sitting and partial-relief narrative", () => {
  const notes = MAYA_ENTRIES.map(e => e.note ?? "").join(" ");
  assert.ok(notes.includes("sitting") || notes.includes("seated") || notes.includes("desk"));
  assert.ok(notes.includes("relief") || notes.includes("helped") || notes.includes("walk"));
});

test("Maya's saved maps go through the body pipeline: paint lies on the body and re-measures to the stored observations", async () => {
  const { decodePaintSnapshot, getBodyAtlas, reduceRegions, PRESENCE_THRESHOLD } = await import("../src/body/map-utils");
  const atlas = getBodyAtlas();
  for (const entry of MAYA_ENTRIES) {
    const layers = await decodePaintSnapshot(entry.maps);
    for (const layer of Object.values(layers)) {
      for (let texel = 0; texel < layer.length; texel++) {
        if (layer[texel] >= PRESENCE_THRESHOLD) assert.ok(atlas.islandOf[texel] >= 0, `${entry.localDate}: paint outside the body at texel ${texel}`);
      }
    }
    assert.deepEqual(reduceRegions(layers, atlas), entry.observations, `${entry.localDate}: stored observations match the shared reducer`);
  }
});

test("regenerating Maya reproduces the checked-in fixture", async () => {
  const { generateMayaEntries } = await import("../scripts/generate-maya");
  const { decodePaintSnapshot } = await import("../src/body/map-utils");
  const generated = await generateMayaEntries();
  assert.equal(generated.length, MAYA_ENTRIES.length);
  for (const [index, entry] of generated.entries()) {
    const saved = MAYA_ENTRIES[index];
    assert.deepEqual({ ...entry, maps: undefined }, { ...saved, maps: undefined });
    assert.deepEqual(await decodePaintSnapshot(entry.maps), await decodePaintSnapshot(saved.maps), `${entry.localDate}: identical maps`);
  }
});

test("Maya's journal source is read-only, bounded, and returns detached copies", async () => {
  const { createMayaSource } = await import("../src/demo/maya-source");
  const source = createMayaSource();
  const list = await source.list("maya", { from: parseLocalDate("2026-10-01"), to: parseLocalDate("2026-10-17") });
  assert.equal(list.length, 17);
  assert.ok(list.every(summary => !("maps" in summary) && !("note" in summary)));
  const day = (await source.read("maya", parseLocalDate("2026-10-10")))!;
  day.observations.length = 0;
  assert.ok((await source.read("maya", parseLocalDate("2026-10-10")))!.observations.length > 0, "fixture is not mutated");
  assert.equal(await source.read("maya", parseLocalDate("2026-08-01")), null);
  assert.equal((await source.previous("maya", parseLocalDate("2026-09-07")))!.localDate, "2026-09-06");
  assert.equal(await source.previous("maya", parseLocalDate("2026-09-06")), null);
  await assert.rejects(source.read("visitor", parseLocalDate("2026-10-10")), { code: "forbidden" });
  assert.ok(!("upsert" in source));
});
