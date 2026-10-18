import { HttpJournal } from "./http";
import type { JournalRepository } from "./repository";

/** The app always uses the single journal in this device's PostgreSQL instance. */
export async function openVisitorJournal(): Promise<JournalRepository> {
  return new HttpJournal();
}

export function closeJournal(_repository: JournalRepository | null) { /* HTTP owns no browser database connection. */ }
