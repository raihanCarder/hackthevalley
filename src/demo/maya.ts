import type { DailyEntry, LocalDate } from "../domain/contracts";
import mayaDataRaw from "./maya-data.json";

export interface SyntheticProfile {
  id: string;
  name: string;
  isSynthetic: true;
  isReadOnly: true;
  description: string;
  dateRange: { start: LocalDate; end: LocalDate };
}

export const MAYA_PROFILE: SyntheticProfile = {
  id: "maya-synthetic",
  name: "Maya",
  isSynthetic: true,
  isReadOnly: true,
  description: "Six-week synthetic patient history demonstrating lower-back aching and radiating left-leg burning.",
  dateRange: {
    start: "2026-09-06" as LocalDate,
    end: "2026-10-17" as LocalDate,
  },
};

function freezeDeep<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}
export const MAYA_ENTRIES: readonly DailyEntry[] = freezeDeep(mayaDataRaw as DailyEntry[]);

export function getMayaEntry(date: string): DailyEntry | null {
  return structuredClone(MAYA_ENTRIES.find(entry => entry.localDate === date) ?? null);
}

export function listMayaEntries(): DailyEntry[] {
  return structuredClone([...MAYA_ENTRIES]);
}
