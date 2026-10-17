import type { DailyEntry, LocalDate } from "../domain/contracts";
import { JournalError, summarizeEntry, validateRange, checkRead, type JournalProfile, type SyntheticJournalSource } from "../journal/repository";
import { MAYA_ENTRIES } from "./maya";

/** Read-only journal source over Maya's immutable fixture. Results are detached copies; there is no write method. */
export function createMayaSource(entries: readonly DailyEntry[] = MAYA_ENTRIES): SyntheticJournalSource {
  const sorted = [...entries].sort((a, b) => a.localDate.localeCompare(b.localDate));
  const onlyMaya = (profile: JournalProfile) => { if (profile !== "maya") throw new JournalError("forbidden", "This source only serves Maya's synthetic records."); };
  return {
    async list(profile, range, options) {
      onlyMaya(profile); checkRead(options);
      const { from, to } = validateRange(range);
      return sorted.filter(entry => entry.localDate >= from && entry.localDate <= to).map(summarizeEntry);
    },
    async read(profile, date: LocalDate, options) {
      onlyMaya(profile); checkRead(options);
      const entry = sorted.find(row => row.localDate === date);
      return entry ? structuredClone(entry) : null;
    },
    async previous(profile, before: LocalDate, options) {
      onlyMaya(profile); checkRead(options);
      const entry = [...sorted].reverse().find(row => row.localDate < before);
      return entry ? structuredClone(entry) : null;
    },
  };
}
