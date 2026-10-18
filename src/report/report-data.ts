import { parseDailyEntry, type DailyEntry, type LocalDate } from "../domain/contracts";
import { MAYA_ENTRIES, MAYA_PROFILE } from "../demo/maya";
import { JournalError, checkRead, type JournalStorage } from "../journal/repository";
import type { ReportProfileKey } from "./summary-service";
export type { ReportProfileKey };
export interface LoadedEntries { profileId: string; entries: DailyEntry[]; storage: JournalStorage | "synthetic" }

/** Saved records only; You's maps and notes are read together in one PostgreSQL query. */
export async function loadSavedEntries(profile: ReportProfileKey, range: { from: LocalDate; to: LocalDate }, signal: AbortSignal): Promise<LoadedEntries> {
  checkRead({ signal });
  if (profile === "maya") {
    const entries = MAYA_ENTRIES.filter(entry => entry.localDate >= range.from && entry.localDate <= range.to);
    return { profileId: MAYA_PROFILE.id, entries: structuredClone(entries), storage: "synthetic" };
  }
  const response = await fetch(`/api/report/entries?${new URLSearchParams({ profile, ...range })}`, { cache: "no-store", signal });
  const body = await response.json();
  checkRead({ signal });
  if (!response.ok) throw new JournalError("unavailable", body.error?.message ?? "Your saved check-ins could not be loaded.");
  return { profileId: body.profileId, entries: body.entries.map(parseDailyEntry), storage: "postgresql" };
}
