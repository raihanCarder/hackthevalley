import {
  REGION_IDS,
  PAIN_TYPES,
  PAIN_LABELS,
  parseLocalDate,
  type DailyEntry,
  type LocalDate,
  type PainType,
  type RegionId,
} from "../domain/contracts";
import { REGION_LABELS } from "../body/region-labels";

export type ObservationEntry = Pick<DailyEntry, "id" | "profileId" | "localDate" | "updatedAt" | "observations">;

export interface DailyTrendPoint {
  localDate: LocalDate;
  status: "recorded" | "missing";
  peakIntensity: number | null;
  mapCoverage: number | null;
  meanIntensity: number | null;
  hasCheckIn: boolean;
  isExplicitEmpty: boolean;
}

export interface RegionTrendSummary {
  profileId: string;
  regionId: RegionId;
  painType: PainType;
  dateRange: { start: LocalDate; end: LocalDate };
  totalCalendarDays: number;
  recordedDays: number;
  missingDays: number;
  presentDays: number;
  frequency: number;
  maxPeakIntensity: number;
  maxMapCoverage: number;
  firstPresentDate: LocalDate | null;
  lastPresentDate: LocalDate | null;
  points: DailyTrendPoint[];
  sourceEntries: Array<{ id: string; localDate: LocalDate; updatedAt: string }>;
}

export interface DateComparisonRegionChange {
  regionId: RegionId;
  painType: PainType;
  status: "newly-marked" | "no-longer-marked" | "persistent" | "unmarked";
  earlierPeak: number;
  laterPeak: number;
  deltaPeak: number;
  earlierCoverage: number;
  laterCoverage: number;
  deltaCoverage: number;
}

export interface DateComparisonResult {
  earlierDate: LocalDate;
  laterDate: LocalDate;
  earlierEntry: ObservationEntry | null;
  laterEntry: ObservationEntry | null;
  newlyMarked: DateComparisonRegionChange[];
  noLongerMarked: DateComparisonRegionChange[];
  persistentChanges: DateComparisonRegionChange[];
  allChanges: DateComparisonRegionChange[];
  descriptiveObservations: string[];
}

export interface RegionEvidenceSummary {
  regionId: RegionId;
  painType: PainType;
  presentDays: number;
  recordedDays: number;
  frequency: number;
  firstRecordedDate: LocalDate | null;
  lastRecordedDate: LocalDate | null;
  maxPeakIntensity: number;
  maxMapCoverage: number;
}

export interface ReportEvidence {
  profileId: string;
  dateRange: { start: LocalDate; end: LocalDate };
  totalCalendarDays: number;
  recordedDays: number;
  missingDays: number;
  explicitEmptyDays: number;
  regionalEvidence: RegionEvidenceSummary[];
  sourceEntries: Array<{ id: string; localDate: LocalDate; updatedAt: string }>;
}

/**
 * Generates an inclusive array of consecutive LocalDates between start and end.
 * Pure calendar arithmetic; no timezone shifts.
 */
export function listCalendarDates(start: LocalDate, end: LocalDate): LocalDate[] {
  parseLocalDate(start);
  parseLocalDate(end);
  if (start > end) {
    throw new Error("Start date must be before or equal to end date.");
  }

  const result: LocalDate[] = [];
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);

  let curY = sy;
  let curM = sm;
  let curD = sd;

  const isLeap = (y: number) => y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  const getDaysInMonth = (y: number, m: number) => {
    const days = [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return days[m - 1];
  };

  while (true) {
    const mStr = curM < 10 ? `0${curM}` : `${curM}`;
    const dStr = curD < 10 ? `0${curD}` : `${curD}`;
    const dateStr = `${curY}-${mStr}-${dStr}` as LocalDate;
    result.push(dateStr);

    if (curY === ey && curM === em && curD === ed) {
      break;
    }

    curD++;
    if (curD > getDaysInMonth(curY, curM)) {
      curD = 1;
      curM++;
      if (curM > 12) {
        curM = 1;
        curY++;
      }
    }
  }

  return result;
}

/**
 * Formats a YYYY-MM-DD date into a friendly string like "Sat, Oct 17, 2026".
 */
export function formatDisplayDate(dateStr: string): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const [year, month, day] = dateStr.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  // UTC noon to get stable day-of-week without timezone jumps
  const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return `${dayNames[d.getUTCDay()]}, ${months[month - 1]} ${day}, ${year}`;
}

const FULL_MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export function formatFullDate(dateStr: string): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const [year, month, day] = dateStr.split("-").map(Number);
  return `${FULL_MONTH_NAMES[month - 1]} ${day}, ${year}`;
}

export function formatRegionName(regionId: RegionId): string {
  const base = REGION_LABELS[regionId] ?? regionId;
  return base
    .replace(/^Your /, "")
    .split(" ")
    .map(word => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Computes regional trend statistics and daily points across a date range.
 * Missing dates are treated as gaps (null values), saved empty maps contribute zeros.
 * Denominator for frequency is strictly recorded days.
 */
export function computeRegionTrend(
  entries: readonly ObservationEntry[],
  options: {
    profileId: string;
    regionId: RegionId;
    painType: PainType;
    startDate: LocalDate;
    endDate: LocalDate;
  }
): RegionTrendSummary {
  const { profileId, regionId, painType, startDate, endDate } = options;
  const dates = listCalendarDates(startDate, endDate);

  const entryByDate = new Map<LocalDate, ObservationEntry>();
  for (const entry of entries) {
    if (entry.profileId === profileId && entry.localDate >= startDate && entry.localDate <= endDate) {
      entryByDate.set(entry.localDate, entry);
    }
  }

  let recordedDays = 0;
  let presentDays = 0;
  let maxPeakIntensity = 0;
  let maxMapCoverage = 0;
  let firstPresentDate: LocalDate | null = null;
  let lastPresentDate: LocalDate | null = null;

  const points: DailyTrendPoint[] = [];
  const sourceEntries: Array<{ id: string; localDate: LocalDate; updatedAt: string }> = [];

  for (const d of dates) {
    const entry = entryByDate.get(d);
    if (!entry) {
      // Unrecorded calendar date: gap
      points.push({
        localDate: d,
        status: "missing",
        peakIntensity: null,
        mapCoverage: null,
        meanIntensity: null,
        hasCheckIn: false,
        isExplicitEmpty: false,
      });
    } else {
      recordedDays++;
      sourceEntries.push({ id: entry.id, localDate: entry.localDate, updatedAt: entry.updatedAt });

      const obs = entry.observations.find(o => o.regionId === regionId && o.painType === painType);
      const isExplicitEmpty = entry.observations.length === 0;

      if (obs && obs.mapCoverage > 0) {
        presentDays++;
        if (obs.peakIntensity > maxPeakIntensity) maxPeakIntensity = obs.peakIntensity;
        if (obs.mapCoverage > maxMapCoverage) maxMapCoverage = obs.mapCoverage;
        if (!firstPresentDate) firstPresentDate = d;
        lastPresentDate = d;

        points.push({
          localDate: d,
          status: "recorded",
          peakIntensity: obs.peakIntensity,
          mapCoverage: obs.mapCoverage,
          meanIntensity: obs.meanIntensity,
          hasCheckIn: true,
          isExplicitEmpty: false,
        });
      } else {
        // Recorded day with 0 pain in this region / explicit empty entry
        points.push({
          localDate: d,
          status: "recorded",
          peakIntensity: 0,
          mapCoverage: 0,
          meanIntensity: 0,
          hasCheckIn: true,
          isExplicitEmpty,
        });
      }
    }
  }

  const frequency = recordedDays > 0 ? Number((presentDays / recordedDays).toFixed(4)) : 0;

  return {
    profileId,
    regionId,
    painType,
    dateRange: { start: startDate, end: endDate },
    totalCalendarDays: dates.length,
    recordedDays,
    missingDays: dates.length - recordedDays,
    presentDays,
    frequency,
    maxPeakIntensity: Number(maxPeakIntensity.toFixed(1)),
    maxMapCoverage: Number(maxMapCoverage.toFixed(3)),
    firstPresentDate,
    lastPresentDate,
    points,
    sourceEntries,
  };
}

/**
 * Compares two recorded dates and computes changes in regional peak intensity and coverage.
 * Accurately identifies newly marked and no-longer-marked regions without diagnostic assertions.
 */
export function compareDates(
  earlierEntry: ObservationEntry | null,
  laterEntry: ObservationEntry | null,
  earlierDate: LocalDate,
  laterDate: LocalDate
): DateComparisonResult {
  if (earlierEntry && laterEntry && earlierEntry.profileId !== laterEntry.profileId) throw new Error("Compare dates from the same profile.");
  if (!earlierEntry || !laterEntry) return {
    earlierDate, laterDate, earlierEntry, laterEntry, newlyMarked: [], noLongerMarked: [], persistentChanges: [], allChanges: [],
    descriptiveObservations: ["Both dates need a saved check-in. An unrecorded date cannot be compared as zero pain."],
  };
  const earlierObsMap = new Map<string, { peak: number; coverage: number }>();
  if (earlierEntry) {
    for (const o of earlierEntry.observations) {
      earlierObsMap.set(`${o.regionId}:${o.painType}`, { peak: o.peakIntensity, coverage: o.mapCoverage });
    }
  }

  const laterObsMap = new Map<string, { peak: number; coverage: number }>();
  if (laterEntry) {
    for (const o of laterEntry.observations) {
      laterObsMap.set(`${o.regionId}:${o.painType}`, { peak: o.peakIntensity, coverage: o.mapCoverage });
    }
  }

  const allKeys = new Set([...earlierObsMap.keys(), ...laterObsMap.keys()]);
  const newlyMarked: DateComparisonRegionChange[] = [];
  const noLongerMarked: DateComparisonRegionChange[] = [];
  const persistentChanges: DateComparisonRegionChange[] = [];
  const allChanges: DateComparisonRegionChange[] = [];
  const descriptiveObservations: string[] = [];

  for (const key of allKeys) {
    const [regionId, painType] = key.split(":") as [RegionId, PainType];
    const earlier = earlierObsMap.get(key) ?? { peak: 0, coverage: 0 };
    const later = laterObsMap.get(key) ?? { peak: 0, coverage: 0 };

    const earlierCovered = earlier.coverage > 0;
    const laterCovered = later.coverage > 0;

    let status: DateComparisonRegionChange["status"] = "unmarked";
    if (!earlierCovered && laterCovered) {
      status = "newly-marked";
    } else if (earlierCovered && !laterCovered) {
      status = "no-longer-marked";
    } else if (earlierCovered && laterCovered) {
      status = "persistent";
    }

    const change: DateComparisonRegionChange = {
      regionId,
      painType,
      status,
      earlierPeak: earlier.peak,
      laterPeak: later.peak,
      deltaPeak: Number((later.peak - earlier.peak).toFixed(1)),
      earlierCoverage: earlier.coverage,
      laterCoverage: later.coverage,
      deltaCoverage: Number((later.coverage - earlier.coverage).toFixed(3)),
    };

    allChanges.push(change);

    const regionName = formatRegionName(regionId);
    const painLabel = PAIN_LABELS[painType];

    if (status === "newly-marked") {
      newlyMarked.push(change);
      descriptiveObservations.push(
        `${regionName} ${painLabel.toLowerCase()} newly recorded on ${laterDate} (peak intensity ${later.peak}/10, ${(later.coverage * 100).toFixed(0)}% map coverage), not recorded on ${earlierDate}.`
      );
    } else if (status === "no-longer-marked") {
      noLongerMarked.push(change);
      descriptiveObservations.push(
        `${regionName} ${painLabel.toLowerCase()} recorded on ${earlierDate} (peak intensity ${earlier.peak}/10) was no longer marked on ${laterDate}.`
      );
    } else if (status === "persistent") {
      persistentChanges.push(change);
      if (Math.abs(change.deltaPeak) > 0.1 || Math.abs(change.deltaCoverage) > 0.02) {
        const peakWord = change.deltaPeak > 0 ? "increased by" : change.deltaPeak < 0 ? "decreased by" : "remained at";
        descriptiveObservations.push(
          `${regionName} ${painLabel.toLowerCase()} peak intensity ${peakWord} ${Math.abs(change.deltaPeak)} (from ${earlier.peak} to ${later.peak}/10) between ${earlierDate} and ${laterDate}.`
        );
      }
    }
  }

  // Sort changes for deterministic display: newly-marked first, then persistent, then no-longer-marked
  newlyMarked.sort((a, b) => a.regionId.localeCompare(b.regionId));
  noLongerMarked.sort((a, b) => a.regionId.localeCompare(b.regionId));
  persistentChanges.sort((a, b) => a.regionId.localeCompare(b.regionId));

  return {
    earlierDate,
    laterDate,
    earlierEntry,
    laterEntry,
    newlyMarked,
    noLongerMarked,
    persistentChanges,
    allChanges,
    descriptiveObservations,
  };
}

/**
 * Computes report evidence across all regions for a specified date range.
 * Shared contract for Owner D (Milestone 5) to eliminate duplicate trend reducers.
 */
export function computeReportEvidence(
  entries: readonly ObservationEntry[],
  options: {
    profileId: string;
    startDate: LocalDate;
    endDate: LocalDate;
  }
): ReportEvidence {
  const { profileId, startDate, endDate } = options;
  const dates = listCalendarDates(startDate, endDate);

  const entryByDate = new Map<LocalDate, ObservationEntry>();
  let explicitEmptyDays = 0;

  for (const entry of entries) {
    if (entry.profileId === profileId && entry.localDate >= startDate && entry.localDate <= endDate) {
      entryByDate.set(entry.localDate, entry);

    }
  }

  explicitEmptyDays = [...entryByDate.values()].filter(entry => entry.observations.length === 0).length;
  const recordedDays = entryByDate.size;
  const missingDays = dates.length - recordedDays;
  const regionalEvidence: RegionEvidenceSummary[] = [];

  for (const regionId of REGION_IDS) {
    for (const painType of PAIN_TYPES) {
      let presentDays = 0;
      let firstRecordedDate: LocalDate | null = null;
      let lastRecordedDate: LocalDate | null = null;
      let maxPeak = 0;
      let maxCoverage = 0;

      for (const d of dates) {
        const entry = entryByDate.get(d);
        if (entry) {
          const obs = entry.observations.find(o => o.regionId === regionId && o.painType === painType);
          if (obs && obs.mapCoverage > 0) {
            presentDays++;
            if (!firstRecordedDate) firstRecordedDate = d;
            lastRecordedDate = d;
            if (obs.peakIntensity > maxPeak) maxPeak = obs.peakIntensity;
            if (obs.mapCoverage > maxCoverage) maxCoverage = obs.mapCoverage;
          }
        }
      }

      if (presentDays > 0) {
        regionalEvidence.push({
          regionId,
          painType,
          presentDays,
          recordedDays,
          frequency: recordedDays > 0 ? Number((presentDays / recordedDays).toFixed(4)) : 0,
          firstRecordedDate,
          lastRecordedDate,
          maxPeakIntensity: Number(maxPeak.toFixed(1)),
          maxMapCoverage: Number(maxCoverage.toFixed(3)),
        });
      }
    }
  }

  // Sort regional evidence by present days descending
  regionalEvidence.sort((a, b) => b.presentDays - a.presentDays || a.regionId.localeCompare(b.regionId));

  const sourceEntries = Array.from(entryByDate.values())
    .sort((a, b) => a.localDate.localeCompare(b.localDate))
    .map(e => ({ id: e.id, localDate: e.localDate, updatedAt: e.updatedAt }));

  return {
    profileId,
    dateRange: { start: startDate, end: endDate },
    totalCalendarDays: dates.length,
    recordedDays,
    missingDays,
    explicitEmptyDays,
    regionalEvidence,
    sourceEntries,
  };
}
