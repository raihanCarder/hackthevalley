import test from "node:test";
import assert from "node:assert/strict";
import {
  listCalendarDates,
  computeRegionTrend,
  compareDates,
  computeReportEvidence,
  formatDisplayDate,
} from "../src/timeline/analysis";
import { MAYA_ENTRIES } from "../src/demo/maya";
import type { DailyEntry, LocalDate } from "../src/domain/contracts";

test("listCalendarDates generates accurate consecutive calendar dates", () => {
  const dates = listCalendarDates("2026-09-06" as LocalDate, "2026-09-10" as LocalDate);
  assert.deepEqual(dates, [
    "2026-09-06",
    "2026-09-07",
    "2026-09-08",
    "2026-09-09",
    "2026-09-10",
  ]);

  // Leap year boundary check
  const leapDates = listCalendarDates("2024-02-27" as LocalDate, "2024-03-02" as LocalDate);
  assert.deepEqual(leapDates, [
    "2024-02-27",
    "2024-02-28",
    "2024-02-29",
    "2024-03-01",
    "2024-03-02",
  ]);

  assert.throws(() => listCalendarDates("2026-10-10" as LocalDate, "2026-10-01" as LocalDate));
});

test("formatDisplayDate formats dates into human-readable strings", () => {
  assert.equal(formatDisplayDate("2026-10-17"), "Sat, Oct 17, 2026");
  assert.equal(formatDisplayDate("2026-09-06"), "Sun, Sep 6, 2026");
});

test("computeRegionTrend matches Maya fixture values for lower-back aching", () => {
  const trend = computeRegionTrend(MAYA_ENTRIES, {
    profileId: "maya-synthetic",
    regionId: "back-lower-torso",
    painType: "aching",
    startDate: "2026-09-06" as LocalDate,
    endDate: "2026-10-17" as LocalDate,
  });

  assert.equal(trend.totalCalendarDays, 42);
  assert.equal(trend.recordedDays, 42);
  assert.equal(trend.missingDays, 0);
  assert.equal(trend.presentDays, 38);
  assert.equal(trend.frequency, 0.9048);
  assert.equal(trend.firstPresentDate, "2026-09-10");
  assert.equal(trend.lastPresentDate, "2026-10-17");
  assert.ok(trend.maxPeakIntensity >= 4 && trend.maxPeakIntensity <= 8);
  assert.ok(trend.maxMapCoverage > 0.2 && trend.maxMapCoverage <= 1.0);

  // Early 4 days have 0 intensity
  for (let i = 0; i < 4; i++) {
    assert.equal(trend.points[i].peakIntensity, 0);
    assert.equal(trend.points[i].mapCoverage, 0);
    assert.equal(trend.points[i].status, "recorded");
    assert.equal(trend.points[i].isExplicitEmpty, true);
  }

  // Day 5 onwards has recorded aching
  for (let i = 4; i < 42; i++) {
    assert.ok(trend.points[i].peakIntensity! > 0);
    assert.ok(trend.points[i].mapCoverage! > 0);
  }
});

test("computeRegionTrend matches Maya left-thigh and left-calf burning onsets", () => {
  const thighTrend = computeRegionTrend(MAYA_ENTRIES, {
    profileId: "maya-synthetic",
    regionId: "left-thigh",
    painType: "burning",
    startDate: "2026-09-06" as LocalDate,
    endDate: "2026-10-17" as LocalDate,
  });
  assert.equal(thighTrend.presentDays, 15);
  assert.equal(thighTrend.firstPresentDate, "2026-10-03");
  assert.equal(thighTrend.lastPresentDate, "2026-10-17");

  const calfTrend = computeRegionTrend(MAYA_ENTRIES, {
    profileId: "maya-synthetic",
    regionId: "left-calf",
    painType: "burning",
    startDate: "2026-09-06" as LocalDate,
    endDate: "2026-10-17" as LocalDate,
  });
  assert.equal(calfTrend.presentDays, 8);
  assert.equal(calfTrend.firstPresentDate, "2026-10-10");
  assert.equal(calfTrend.lastPresentDate, "2026-10-17");
});

test("computeRegionTrend handles missing-date gaps and empty-map zeros faithfully", () => {
  // Subset of entries with an unrecorded gap
  const sparseEntries: DailyEntry[] = [
    {
      ...MAYA_ENTRIES[0],
      localDate: "2026-10-01" as LocalDate,
      observations: [], // saved empty map
    },
    // 2026-10-02 missing!
    {
      ...MAYA_ENTRIES[27],
      localDate: "2026-10-03" as LocalDate, // recorded day with left-thigh burning
    },
  ];

  const trend = computeRegionTrend(sparseEntries, {
    profileId: "maya-synthetic",
    regionId: "left-thigh",
    painType: "burning",
    startDate: "2026-10-01" as LocalDate,
    endDate: "2026-10-03" as LocalDate,
  });

  assert.equal(trend.totalCalendarDays, 3);
  assert.equal(trend.recordedDays, 2);
  assert.equal(trend.missingDays, 1);
  assert.equal(trend.presentDays, 1);
  assert.equal(trend.frequency, 0.5); // 1 present day / 2 recorded days!

  // Point 0 (2026-10-01): saved empty map contributes 0
  assert.equal(trend.points[0].status, "recorded");
  assert.equal(trend.points[0].peakIntensity, 0);
  assert.equal(trend.points[0].mapCoverage, 0);

  // Point 1 (2026-10-02): unrecorded date is a gap
  assert.equal(trend.points[1].status, "missing");
  assert.equal(trend.points[1].peakIntensity, null);
  assert.equal(trend.points[1].mapCoverage, null);

  // Point 2 (2026-10-03): present
  assert.equal(trend.points[2].status, "recorded");
  assert.ok(trend.points[2].peakIntensity! > 0);
});

test("compareDates accurately identifies newly marked and no-longer-marked regions", () => {
  const oct2 = MAYA_ENTRIES.find(e => e.localDate === "2026-10-02")!;
  const oct3 = MAYA_ENTRIES.find(e => e.localDate === "2026-10-03")!;
  const oct10 = MAYA_ENTRIES.find(e => e.localDate === "2026-10-10")!;

  // Compare Oct 2 (before thigh burning) with Oct 3 (first thigh burning)
  const comp1 = compareDates(oct2, oct3, "2026-10-02" as LocalDate, "2026-10-03" as LocalDate);
  const newlyMarked1 = comp1.newlyMarked.map(m => `${m.regionId}:${m.painType}`);
  assert.ok(newlyMarked1.includes("left-thigh:burning"));
  assert.equal(comp1.noLongerMarked.length, 0);
  assert.ok(comp1.descriptiveObservations.some(s => s.includes("Left Thigh burning newly recorded on 2026-10-03")));

  // Compare Oct 3 with Oct 10 (first calf burning)
  const comp2 = compareDates(oct3, oct10, "2026-10-03" as LocalDate, "2026-10-10" as LocalDate);
  const newlyMarked2 = comp2.newlyMarked.map(m => `${m.regionId}:${m.painType}`);
  assert.ok(newlyMarked2.includes("left-calf:burning"));
  // Thigh burning is persistent
  assert.ok(comp2.persistentChanges.some(p => p.regionId === "left-thigh" && p.painType === "burning"));

  // Check no diagnostic or causal language
  const text = comp2.descriptiveObservations.join(" ");
  assert.equal(text.includes("diagnosis"), false);
  assert.equal(text.includes("caused by"), false);
  assert.equal(text.includes("pathology"), false);
});

test("computeReportEvidence provides exact consistent data for Owner D", () => {
  const evidence = computeReportEvidence(MAYA_ENTRIES, {
    profileId: "maya-synthetic",
    startDate: "2026-09-06" as LocalDate,
    endDate: "2026-10-17" as LocalDate,
  });

  assert.equal(evidence.profileId, "maya-synthetic");
  assert.equal(evidence.totalCalendarDays, 42);
  assert.equal(evidence.recordedDays, 42);
  assert.equal(evidence.missingDays, 0);
  assert.equal(evidence.explicitEmptyDays, 4);

  const backAching = evidence.regionalEvidence.find(
    r => r.regionId === "back-lower-torso" && r.painType === "aching"
  );
  assert.ok(backAching !== undefined);
  assert.equal(backAching.presentDays, 38);
  assert.equal(backAching.recordedDays, 42);
  assert.equal(backAching.firstRecordedDate, "2026-09-10");
  assert.equal(backAching.lastRecordedDate, "2026-10-17");

  const thighBurning = evidence.regionalEvidence.find(
    r => r.regionId === "left-thigh" && r.painType === "burning"
  );
  assert.ok(thighBurning !== undefined);
  assert.equal(thighBurning.presentDays, 15);
  assert.equal(thighBurning.firstRecordedDate, "2026-10-03");

  const calfBurning = evidence.regionalEvidence.find(
    r => r.regionId === "left-calf" && r.painType === "burning"
  );
  assert.ok(calfBurning !== undefined);
  assert.equal(calfBurning.presentDays, 8);
  assert.equal(calfBurning.firstRecordedDate, "2026-10-10");
});
