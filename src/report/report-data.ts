import type { DailyEntry, LocalDate } from "../domain/contracts";
import { MAYA_ENTRIES, MAYA_PROFILE } from "../demo/maya";
import { HttpJournal } from "../journal/http";
import { IndexedDbJournal, localVisitorId } from "../journal/indexeddb";
import { journalMapServices, syntheticJournalSource } from "../journal/integrations";
import { JournalError, type JournalRepository, type JournalStorage } from "../journal/repository";

import type { ReportProfileKey } from "./summary-service";
export type { ReportProfileKey };
export interface LoadedEntries { profileId: string; entries: DailyEntry[]; storage: JournalStorage | "synthetic" }
export class StorageNotChosen extends Error {
  constructor() { super("Choose where your check-ins are saved on the Check-in page first."); this.name = "StorageNotChosen"; }
}

/** The save location chosen on the check-in page (owner B's preference). The report never picks a store itself. */
export function chosenStorage(): JournalStorage | null {
  try {
    const saved = window.localStorage.getItem("pain-journal-storage");
    return saved === "indexeddb" || saved === "postgresql" ? saved : null;
  } catch { return null; }
}

/**
 * Loads saved entries only, through the same sources as the timeline: Maya's immutable fixture, or the visitor's
 * chosen journal repository. Unsaved check-in drafts are never read.
 */
export async function loadSavedEntries(profile: ReportProfileKey, range: { from: LocalDate; to: LocalDate }, signal: AbortSignal): Promise<LoadedEntries> {
  if (profile === "maya") {
    const entries = MAYA_ENTRIES.filter(entry => entry.localDate >= range.from && entry.localDate <= range.to);
    return { profileId: MAYA_PROFILE.id, entries: structuredClone(entries), storage: "synthetic" };
  }
  const storage = chosenStorage();
  if (!storage) throw new StorageNotChosen();
  let repository: JournalRepository;
  if (storage === "indexeddb") {
    repository = new IndexedDbJournal({ profileId: localVisitorId(window.localStorage), maps: journalMapServices, synthetic: syntheticJournalSource });
  } else {
    const server = new HttpJournal();
    await server.bootstrap();
    repository = server;
  }
  const summaries = await repository.list("visitor", range, { signal });
  const entries: DailyEntry[] = [];
  for (const summary of summaries) {
    const entry = await repository.read("visitor", summary.localDate, { signal });
    if (entry) entries.push(entry);
  }
  if (signal.aborted) throw new JournalError("cancelled", "The report request was cancelled.");
  return { profileId: entries[0]?.profileId ?? summaries[0]?.profileId ?? "visitor", entries, storage };
}
