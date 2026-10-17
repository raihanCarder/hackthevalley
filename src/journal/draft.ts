import type { DailyEntry, LocalDate, PaintSnapshot } from "../domain/contracts";
import { parseLocalDate } from "../domain/contracts";
import { JournalError, validateNote, type JournalRepository } from "./repository";

export type SaveState = "idle" | "unsaved" | "saving" | "saved" | "error";
export interface JournalDraft {
  localDate: LocalDate;
  timeZone: string;
  note: string;
  /** null is not an empty map: the editor has not supplied a snapshot yet. */
  maps: PaintSnapshot | null;
  copiedFrom: LocalDate | null;
  savedEntry: DailyEntry | null;
  revision: number;
  saveState: SaveState;
  error: string | null;
}

export function createDraft(localDate: LocalDate, timeZone: string): JournalDraft {
  return { localDate: parseLocalDate(localDate), timeZone, note: "", maps: null,
    copiedFrom: null, savedEntry: null, revision: 0, saveState: "idle", error: null };
}

export function restoreDraft(entry: DailyEntry): JournalDraft {
  const copy = structuredClone(entry);
  return { ...createDraft(copy.localDate, copy.timeZone), note: copy.note ?? "", maps: copy.maps,
    savedEntry: copy, saveState: "saved" };
}

export function editDraft(draft: JournalDraft, changes: { note?: string; maps?: PaintSnapshot }): JournalDraft {
  if (changes.note !== undefined) validateNote(changes.note);
  return { ...draft, ...changes, maps: changes.maps ? structuredClone(changes.maps) : draft.maps,
    revision: draft.revision + 1, saveState: "unsaved", error: null };
}

/** Copy only the map. Today's note and date remain today's; the source is untouched. */
export function copyPreviousMap(draft: JournalDraft, source: DailyEntry): JournalDraft {
  if (source.localDate >= draft.localDate) throw new JournalError("invalid", "Choose a check-in before this date.");
  return { ...editDraft(draft, { maps: source.maps }), copiedFrom: source.localDate };
}

export function saveInput(draft: JournalDraft) {
  validateNote(draft.note);
  if (!draft.maps) throw new JournalError("invalid", "The body map is not ready to save.");
  return structuredClone({ localDate: draft.localDate, timeZone: draft.timeZone, maps: draft.maps, note: draft.note });
}

/** Acknowledges only the submitted revision; edits made while saving stay unsaved. */
export function acknowledgeSave(current: JournalDraft, submitted: JournalDraft, entry: DailyEntry): JournalDraft {
  if (entry.localDate !== submitted.localDate || current.localDate !== submitted.localDate) {
    throw new JournalError("invalid", "The saved check-in does not match the selected date.");
  }
  return { ...current, savedEntry: structuredClone(entry),
    saveState: current.revision === submitted.revision ? "saved" : "unsaved", error: null };
}

export function rejectSave(current: JournalDraft): JournalDraft {
  return { ...current, saveState: "error", error: "Your check-in could not be saved. Your draft is still here. Try again." };
}

/** Each selection cancels older reads, including repositories that ignore AbortSignal. */
export class JournalSelection {
  private revision = 0;
  private pending?: AbortController;

  cancel(): void { this.revision += 1; this.pending?.abort(); }

  async read(repository: Pick<JournalRepository, "read">, date: LocalDate): Promise<DailyEntry | null | undefined> {
    this.cancel();
    const revision = this.revision;
    const pending = this.pending = new AbortController();
    try {
      const entry = await repository.read("visitor", date, { signal: pending.signal });
      return revision === this.revision ? entry : undefined;
    } catch (error) {
      if (revision !== this.revision) return undefined;
      throw error;
    }
  }
}
