import type { DailyEntry, DailyRecord, LocalDate, PaintSnapshot, RegionalObservation } from "../domain/contracts";
import { BODY_MAP_VERSION, SCHEMA_VERSION, parseDailyEntry, parseLocalDate } from "../domain/contracts";

/** Selection is not authorization. Each adapter binds visitor access to its own identity. */
export type JournalProfile = "visitor" | "maya";
/** `visitor` is the existing API selection key for the single persistent You profile. */
export const LOCAL_PROFILE_ID = "local-you";
export type JournalStorage = "indexeddb" | "postgresql";
export type EntrySummary = Omit<DailyEntry, "maps" | "note">;
export interface DateRange { from: LocalDate; to: LocalDate }
export interface ReadOptions { signal?: AbortSignal }
export interface CheckInInput {
  localDate: LocalDate;
  timeZone: string;
  maps: PaintSnapshot;
  note?: string;
}

/**
 * Shared consumer boundary for check-in, history, and reports.
 * Implementations return detached values and reject with JournalError on failure.
 * A null read means missing; an entry containing empty maps is still recorded.
 */
export interface JournalRepository {
  readonly storage: JournalStorage;
  list(profile: JournalProfile, range: DateRange, options?: ReadOptions): Promise<EntrySummary[]>;
  read(profile: JournalProfile, date: LocalDate, options?: ReadOptions): Promise<DailyRecord>;
  previous(profile: JournalProfile, before: LocalDate, options?: ReadOptions): Promise<DailyRecord>;
  /** Visitor only. Resolves after commit with the saved identity and revision. */
  upsert(input: CheckInInput): Promise<DailyEntry>;
}

/** Owner A supplies this from the real browser/Node-safe decoder and region reducer. */
export interface JournalMapServices {
  validateAndMeasure(maps: PaintSnapshot): Promise<RegionalObservation[]>;
}

/** Owner C supplies immutable, encoded Maya entries through this read-only boundary. */
export type SyntheticJournalSource = Pick<JournalRepository, "list" | "read" | "previous">;

export type JournalErrorCode = "invalid" | "unavailable" | "forbidden" | "cancelled";
export class JournalError extends Error {
  constructor(public readonly code: JournalErrorCode, message: string) {
    super(message);
    this.name = "JournalError";
  }
}

export const MAX_LIST_DAYS = 366;
export const MAX_NOTE_LENGTH = 4_000;
export const MAX_CHECK_IN_BYTES = 6 * 1024 * 1024;

export function parseJournalDate(value: unknown): LocalDate {
  try { return parseLocalDate(value); }
  catch { throw new JournalError("invalid", "Choose a valid local calendar date (YYYY-MM-DD)."); }
}

function calendarDay(date: LocalDate): number {
  // setUTCFullYear avoids Date.UTC's special handling of years 00–99.
  const value = new Date(0);
  const [year, month, day] = date.split("-").map(Number);
  value.setUTCFullYear(year, month - 1, day);
  return value.getTime() / 86_400_000;
}

export function validateRange(range: DateRange): DateRange {
  const from = parseJournalDate(range.from);
  const to = parseJournalDate(range.to);
  const days = calendarDay(to) - calendarDay(from) + 1;
  if (days < 1 || days > MAX_LIST_DAYS) {
    throw new JournalError("invalid", `Choose a range of 1–${MAX_LIST_DAYS} calendar days.`);
  }
  return { from, to };
}

export function validateNote(note: string | undefined): void {
  if (note !== undefined && (typeof note !== "string" || note.length > MAX_NOTE_LENGTH)) {
    throw new JournalError("invalid", `Keep the written note within ${MAX_NOTE_LENGTH} characters.`);
  }
}

/** Browser-local date; never convert midnight through toISOString(). */
export function localToday(now = new Date()): LocalDate {
  return parseLocalDate(`${String(now.getFullYear()).padStart(4, "0")}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`);
}

export function summarizeEntry(entry: DailyEntry): EntrySummary {
  const { maps: _maps, note: _note, ...summary } = entry;
  return structuredClone(summary);
}

/** Structural/envelope validation; PNG decoding and measurement remain Owner A's job. */
export function parseCheckInInput(value: unknown): CheckInInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new JournalError("invalid", "Expected a check-in.");
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(key => !["localDate", "timeZone", "maps", "note"].includes(key))) {
    throw new JournalError("invalid", "Check-ins accept only date, time zone, maps, and note.");
  }
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > MAX_CHECK_IN_BYTES) {
    throw new JournalError("invalid", "The complete check-in must be no larger than 6 MiB.");
  }
  validateNote(input.note as string | undefined);
  try {
    const entry = parseDailyEntry({ ...input, id: "validation", profileId: "validation",
      schemaVersion: SCHEMA_VERSION, bodyMapVersion: BODY_MAP_VERSION,
      updatedAt: "2026-01-01T00:00:00.000Z", observations: [] });
    return { localDate: entry.localDate, timeZone: entry.timeZone, maps: entry.maps, note: entry.note };
  } catch (error) {
    throw new JournalError("invalid", error instanceof Error ? error.message : "Invalid check-in.");
  }
}

export async function prepareEntry(input: CheckInInput, profileId: string, services: JournalMapServices | null): Promise<DailyEntry> {
  const parsed = parseCheckInInput(input);
  if (!services) throw new JournalError("unavailable", "Body-map validation is not connected yet. Your draft has not been saved.");
  // Do not trust client-supplied observations. The same reducer serves both stores.
  try {
    const observations = await services.validateAndMeasure(structuredClone(parsed.maps));
    return parseDailyEntry({ ...parsed, id: crypto.randomUUID(), profileId,
      updatedAt: new Date().toISOString(), schemaVersion: SCHEMA_VERSION,
      bodyMapVersion: BODY_MAP_VERSION, observations });
  } catch (error) {
    if (error instanceof JournalError) throw error;
    throw new JournalError("invalid", "The body map could not be validated. Check the map version and try again.");
  }
}

export function parseStoredEntry(value: unknown): DailyEntry {
  try { return parseDailyEntry(value); }
  catch (error) { throw new JournalError("invalid", error instanceof Error ? error.message : "This saved check-in cannot be restored."); }
}

export function checkRead(options?: ReadOptions): void {
  if (options?.signal?.aborted) throw new JournalError("cancelled", "The journal request was cancelled.");
}

export function requireSynthetic(source: SyntheticJournalSource | null): SyntheticJournalSource {
  if (!source) throw new JournalError("unavailable", "Maya's synthetic history is not connected yet.");
  return source;
}
