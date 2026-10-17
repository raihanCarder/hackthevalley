import { HttpJournal } from "./http";
import { IndexedDbJournal, localVisitorId } from "./indexeddb";
import { journalMapServices, syntheticJournalSource } from "./integrations";
import { JournalError, type JournalRepository } from "./repository";

/** All consuming screens honor the same explicit store. Failures never select another store. */
export async function openVisitorJournal(): Promise<JournalRepository> {
  let storage: string | null;
  try { storage = window.localStorage.getItem("pain-journal-storage"); }
  catch { throw new JournalError("unavailable", "Browser preferences are blocked. Choose a save location on the Check-in page."); }
  if (storage === "postgresql") {
    const repository = new HttpJournal();
    await repository.bootstrap();
    return repository;
  }
  return new IndexedDbJournal({ profileId: localVisitorId(window.localStorage), maps: journalMapServices, synthetic: syntheticJournalSource });
}

export function closeJournal(repository: JournalRepository | null) {
  if (repository instanceof IndexedDbJournal) void repository.close();
}
