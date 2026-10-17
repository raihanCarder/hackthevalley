import { PAIN_TYPES, type DailyEntry, type LocalDate, type PainType, type RegionId } from "../domain/contracts";
import { REGION_LABELS } from "../body/region-labels";
import { compareDates, computeRegionTrend, computeReportEvidence, listCalendarDates, type ReportEvidence } from "../timeline/analysis";

/**
 * Report evidence with stable IDs. Every number comes from the timeline's shared analysis (owner C); this module only
 * selects, labels, and references those results so summaries can be checked against them. Pure: no React, DOM, or I/O.
 */
export interface RangeFact { id: "range"; start: LocalDate; end: LocalDate; calendarDays: number; recordedDays: number; missingDays: number; emptyDays: number }
export interface RegionFact {
  id: string; regionId: RegionId; painType: PainType;
  presentDays: number; recordedDays: number; firstDate: LocalDate; lastDate: LocalDate;
  maxPeak: number; maxCoveragePercent: number;
}
export interface ChangeFact {
  id: string; regionId: RegionId; painType: PainType;
  earlierDate: LocalDate; laterDate: LocalDate;
  earlierCoveragePercent: number; laterCoveragePercent: number; earlierPeak: number; laterPeak: number;
}
export interface NoteFact { id: string; entryId: string; date: LocalDate; text: string }
export interface ReportFacts { profileId: string; range: RangeFact; regions: RegionFact[]; changes: ChangeFact[]; notes: NoteFact[] }
export interface DayCell { date: LocalDate; recorded: boolean; peaks: Partial<Record<PainType, number>> }
export interface NoteExcerpt { entryId: string; date: LocalDate; text: string; truncated: boolean }
export interface ReportModel {
  facts: ReportFacts;
  evidence: ReportEvidence;
  /** Saved entries inside the profile and range, oldest first. The only source for composites and notes. */
  entries: DailyEntry[];
  days: DayCell[];
  noteExcerpts: NoteExcerpt[];
}
export interface ReportScope { profileId: string; start: LocalDate; end: LocalDate }

export const regionFactId = (regionId: RegionId, painType: PainType) => `region:${regionId}:${painType}`;
export const changeFactId = (regionId: RegionId, painType: PainType) => `change:${regionId}:${painType}`;
const percent = (fraction: number) => Math.round(fraction * 100);

/** Patient-relative phrase for report sentences, e.g. "left calf" (the patient's left), "lower back". */
export function regionPhrase(regionId: RegionId): string {
  const label = REGION_LABELS[regionId].replace(/^Your /, "");
  return label[0].toLowerCase() + label.slice(1);
}
export const SENSATION_WORDS: Record<PainType, string> = { burning: "burning", sharp: "sharp or stabbing pain", aching: "aching", tingling: "tingling or numbness" };

/** Builds the report for saved entries only. Returns null when the range has no saved check-in. */
export function buildReportModel(allEntries: readonly DailyEntry[], scope: ReportScope): ReportModel | null {
  const { profileId, start, end } = scope;
  const dates = listCalendarDates(start, end);
  const entries = allEntries.filter(entry => entry.profileId === profileId && entry.localDate >= start && entry.localDate <= end)
    .sort((a, b) => a.localDate.localeCompare(b.localDate));
  if (new Set(entries.map(entry => entry.localDate)).size !== entries.length) throw new Error("A profile can have only one entry per date.");
  if (!entries.length) return null;

  const evidence = computeReportEvidence(entries, { profileId, startDate: start, endDate: end });
  const byDate = new Map(entries.map(entry => [entry.localDate, entry]));
  const regions: RegionFact[] = evidence.regionalEvidence.map(row => ({
    id: regionFactId(row.regionId, row.painType), regionId: row.regionId, painType: row.painType,
    presentDays: row.presentDays, recordedDays: row.recordedDays,
    firstDate: row.firstRecordedDate!, lastDate: row.lastRecordedDate!,
    maxPeak: row.maxPeakIntensity, maxCoveragePercent: percent(row.maxMapCoverage),
  }));

  // Change between the first and last day each region/type was recorded, using the timeline's date comparison.
  const changes: ChangeFact[] = [];
  for (const region of regions) {
    if (region.firstDate === region.lastDate) continue;
    const comparison = compareDates(byDate.get(region.firstDate)!, byDate.get(region.lastDate)!, region.firstDate, region.lastDate);
    const change = comparison.allChanges.find(row => row.regionId === region.regionId && row.painType === region.painType);
    if (!change) continue;
    changes.push({
      id: changeFactId(region.regionId, region.painType), regionId: region.regionId, painType: region.painType,
      earlierDate: region.firstDate, laterDate: region.lastDate,
      earlierCoveragePercent: percent(change.earlierCoverage), laterCoveragePercent: percent(change.laterCoverage),
      earlierPeak: change.earlierPeak, laterPeak: change.laterPeak,
    });
  }

  // Per-day sensation peaks for the timeline strip, from the shared region trends (missing dates stay gaps).
  const days: DayCell[] = dates.map(date => ({ date, recorded: byDate.has(date), peaks: {} }));
  for (const region of regions) {
    const trend = computeRegionTrend(entries, { profileId, regionId: region.regionId, painType: region.painType, startDate: start, endDate: end });
    trend.points.forEach((point, index) => {
      if (!point.mapCoverage || point.peakIntensity === null) return;
      const peaks = days[index].peaks;
      peaks[region.painType] = Math.max(peaks[region.painType] ?? 0, point.peakIntensity);
    });
  }

  const notes: NoteFact[] = entries.filter(entry => entry.note?.trim()).map(entry => ({ id: `note:${entry.id}`, entryId: entry.id, date: entry.localDate, text: entry.note!.trim() }));
  const emptyDays = evidence.explicitEmptyDays;
  return {
    facts: {
      profileId,
      range: { id: "range", start, end, calendarDays: evidence.totalCalendarDays, recordedDays: evidence.recordedDays, missingDays: evidence.missingDays, emptyDays },
      regions, changes, notes,
    },
    evidence, entries, days,
    noteExcerpts: [...notes].reverse().slice(0, 3).map(note => excerpt(note)),
  };
}

const EXCERPT_LENGTH = 200;
function excerpt(note: NoteFact): NoteExcerpt {
  if (note.text.length <= EXCERPT_LENGTH) return { entryId: note.entryId, date: note.date, text: note.text, truncated: false };
  const cut = note.text.slice(0, EXCERPT_LENGTH);
  return { entryId: note.entryId, date: note.date, text: cut.slice(0, Math.max(cut.lastIndexOf(" "), EXCERPT_LENGTH - 40)).trimEnd(), truncated: true };
}

/** Sensations present anywhere in the range, in legend order. */
export function presentSensations(model: ReportModel): PainType[] {
  return PAIN_TYPES.filter(type => model.facts.regions.some(region => region.painType === type));
}
