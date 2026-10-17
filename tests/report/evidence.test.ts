import test from "node:test";
import assert from "node:assert/strict";
import { PAIN_TYPES, type LocalDate } from "../../src/domain/contracts";
import { MAYA_ENTRIES, MAYA_PROFILE } from "../../src/demo/maya";
import { computeRegionTrend, computeReportEvidence } from "../../src/timeline/analysis";
import { buildReportModel } from "../../src/report/facts";
import { buildRangeComposite } from "../../src/report/composite";
import { deterministicPlan, renderStatement, validatePlan } from "../../src/report/plan";
import { createEmptyLayers, MapValidationError } from "../../src/body/map-utils";
import { dates, entry, obs, paintRegion, savedEntry } from "./fixtures";

const mayaScope = { profileId: MAYA_PROFILE.id, start: MAYA_PROFILE.dateRange.start, end: MAYA_PROFILE.dateRange.end };
const d = (value: string) => value as LocalDate;

test("Maya's report facts are the timeline's shared analysis for the same 42 saved check-ins", () => {
  const model = buildReportModel(MAYA_ENTRIES, mayaScope)!;
  const timeline = computeReportEvidence(MAYA_ENTRIES, { profileId: MAYA_PROFILE.id, startDate: mayaScope.start, endDate: mayaScope.end });
  assert.deepEqual(model.evidence, timeline);
  assert.equal(model.entries.length, 42);
  assert.deepEqual(model.facts.range, { id: "range", start: "2026-09-06", end: "2026-10-17", calendarDays: 42, recordedDays: 42, missingDays: 0, emptyDays: 4 });
  const byId = Object.fromEntries(model.facts.regions.map(row => [row.id, row]));
  assert.equal(byId["region:back-lower-torso:aching"].presentDays, 38);
  assert.equal(byId["region:left-thigh:burning"].firstDate, "2026-10-03");
  assert.equal(byId["region:left-calf:burning"].firstDate, "2026-10-10");
  // The day strip uses the same trend points as the timeline.
  const calf = computeRegionTrend(MAYA_ENTRIES, { profileId: MAYA_PROFILE.id, regionId: "left-calf", painType: "burning", startDate: mayaScope.start, endDate: mayaScope.end });
  calf.points.forEach((point, index) => assert.equal(!!model.days[index].peaks.burning && point.mapCoverage! > 0 || !point.mapCoverage, true));
  assert.equal(model.days.filter(day => day.peaks.burning).length, 15, "burning appears on the thigh's 15 days");
  assert.equal(model.days.filter(day => Object.keys(day.peaks).length === 0).length, 4, "four explicit empty check-ins have no marks");
});

test("counts distinguish recorded days from calendar days (10 check-ins in 14 days, aching on 7)", () => {
  const range = dates("2026-03-01", 14);
  const skipped = new Set([range[2], range[5], range[9], range[12]]);
  const recorded = range.filter(date => !skipped.has(date));
  const entries = recorded.map((date, index) => entry(date, index < 7 ? [obs("back-lower-torso", "aching", 4, .2)] : []));
  const model = buildReportModel(entries, { profileId: "visitor-a", start: d(range[0]), end: d(range[13]) })!;
  assert.equal(model.facts.range.recordedDays, 10);
  assert.equal(model.facts.range.missingDays, 4);
  const plan = deterministicPlan(model.facts);
  const sentences = plan.map(statement => renderStatement(statement, model.facts));
  assert.ok(sentences.includes("Check-ins were saved on 10 of 14 calendar days; 4 days have no check-in."));
  assert.ok(sentences.includes("Aching in the lower back was marked on 7 of 10 recorded days."));
  assert.ok(!sentences.some(sentence => sentence.includes("7 of 14")));
  assert.equal(model.days.filter(day => !day.recorded).length, 4, "unrecorded days stay gaps, not pain-free days");
});

test("profile and range isolation: other profiles, out-of-range dates, and their notes are excluded", () => {
  const entries = [
    entry("2026-05-01", [obs("left-calf", "burning", 6, .3)], { note: "In range." }),
    entry("2026-05-02", [obs("head", "sharp", 9, .5)], { profileId: "visitor-b", id: "other", note: "Another visitor's note." }),
    entry("2026-05-09", [obs("neck", "tingling", 3, .1)], { note: "After the range." }),
  ];
  const model = buildReportModel(entries, { profileId: "visitor-a", start: d("2026-05-01"), end: d("2026-05-07") })!;
  assert.deepEqual(model.entries.map(row => row.id), ["e-2026-05-01"]);
  assert.deepEqual(model.facts.regions.map(row => row.id), ["region:left-calf:burning"]);
  assert.deepEqual(model.facts.notes.map(note => note.text), ["In range."]);
  assert.equal(buildReportModel(entries, { profileId: "visitor-a", start: d("2026-06-01"), end: d("2026-06-30") }), null, "an empty range produces no report");
  assert.throws(() => buildReportModel([entries[0], { ...entries[0], id: "dup" }], { profileId: "visitor-a", start: d("2026-05-01"), end: d("2026-05-07") }));
});

test("patient notes: the three most recent appear verbatim, long notes are shortened on a word boundary", () => {
  const long = "Sitting for a long time made the ache worse. ".repeat(8).trim();
  const entries = dates("2026-02-01", 5).map((date, index) => entry(date, [], { note: index === 4 ? long : `Note ${index}` }));
  const model = buildReportModel(entries, { profileId: "visitor-a", start: d("2026-02-01"), end: d("2026-02-05") })!;
  assert.deepEqual(model.noteExcerpts.map(note => note.date), ["2026-02-05", "2026-02-04", "2026-02-03"]);
  assert.ok(model.noteExcerpts[0].truncated && long.startsWith(model.noteExcerpts[0].text) && !model.noteExcerpts[0].text.endsWith(" "));
  const maya = buildReportModel(MAYA_ENTRIES, mayaScope)!;
  assert.match(maya.noteExcerpts[0].text, /partial temporary relief/);
});

test("deterministic plan is valid against its own facts and reads descriptively", () => {
  const model = buildReportModel(MAYA_ENTRIES, mayaScope)!;
  const plan = deterministicPlan(model.facts);
  assert.deepEqual(validatePlan({ statements: plan }, model.facts), plan);
  const sentences = plan.map(statement => renderStatement(statement, model.facts));
  assert.deepEqual(sentences.slice(0, 4), [
    "Check-ins were saved on all 42 calendar days in this range.",
    "Aching in the lower back was marked on 38 of 42 recorded days.",
    "Burning in the left thigh was marked on 15 of 42 recorded days.",
    "Burning was first recorded in the left thigh on Oct 3, 2026, and in the left calf from Oct 10, 2026.",
  ]);
  for (const sentence of sentences) assert.doesNotMatch(sentence, /diagnos|sciatica|caused|because|treat|recommend|spread|worsen/i);
});

test("range composite keeps the maximum value per texel across exactly the given saved entries", async () => {
  const day1 = paintRegion("left-thigh", "burning", 120);
  paintRegion("back-lower-torso", "aching", 200, day1);
  const day2 = paintRegion("left-thigh", "burning", 220, createEmptyLayers(), .5);
  paintRegion("left-calf", "burning", 90, day2);
  const entries = [await savedEntry("2026-10-01", day1), await savedEntry("2026-10-02", day2)];
  const composite = await buildRangeComposite(entries);
  for (const type of PAIN_TYPES) for (let texel = 0; texel < composite[type].length; texel++) {
    assert.equal(composite[type][texel], Math.max(day1[type][texel], day2[type][texel]));
  }
  const firstOnly = await buildRangeComposite(entries.slice(0, 1));
  assert.ok(firstOnly.burning.every((value, texel) => value === day1.burning[texel]), "entries outside the selection do not contribute");
  assert.ok((await buildRangeComposite([])).aching.every(value => value === 0));
  await assert.rejects(buildRangeComposite([{ ...entries[0], maps: { ...entries[0].maps, bodyMapVersion: "mannequin-v0" as never } }]), MapValidationError);
});
