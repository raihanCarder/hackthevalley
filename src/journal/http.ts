import { parseDailyEntry, parseLocalDate, type DailyEntry, type LocalDate } from "../domain/contracts";
import { JournalError, parseCheckInInput, validateRange, type CheckInInput, type DateRange,
  type EntrySummary, type JournalProfile, type JournalRepository, type ReadOptions } from "./repository";

/** Server errors are surfaced, never redirected into IndexedDB. */
export class HttpJournal implements JournalRepository {
  readonly storage = "postgresql" as const;
  constructor(private readonly fetcher: typeof fetch = globalThis.fetch.bind(globalThis)) {}

  private async request(path: string, init?: RequestInit): Promise<Record<string, unknown>> {
    let response: Response;
    try { response = await this.fetcher(path, { ...init, credentials: "same-origin", cache: "no-store" }); }
    catch {
      throw new JournalError(init?.signal?.aborted ? "cancelled" : "unavailable", "PostgreSQL could not be reached. Your draft remains on this page.");
    }
    let body: Record<string, unknown>;
    try { body = await response.json(); }
    catch { throw new JournalError("unavailable", "The journal returned an unreadable response."); }
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new JournalError("unavailable", "The journal returned an unreadable response.");
    if (!response.ok) {
      const error = body.error as { code?: string; message?: string } | undefined;
      const code = error?.code;
      throw new JournalError(code === "forbidden" || code === "invalid" || code === "cancelled" ? code : "unavailable",
        error?.message ?? "PostgreSQL rejected the request. Your draft has not changed.");
    }
    return body;
  }

  async bootstrap(): Promise<void> {
    await this.request("/api/session", { method: "POST", headers: { "Content-Type": "application/json" } });
  }
  async list(profile: JournalProfile, range: DateRange, options?: ReadOptions): Promise<EntrySummary[]> {
    validateRange(range);
    const body = await this.request(`/api/entries?${new URLSearchParams({ profile, ...range })}`, { signal: options?.signal });
    if (!Array.isArray(body.entries)) throw new JournalError("unavailable", "The journal returned an unreadable list.");
    return body.entries as EntrySummary[];
  }
  async read(profile: JournalProfile, date: LocalDate, options?: ReadOptions): Promise<DailyEntry | null> {
    parseLocalDate(date);
    const body = await this.request(`/api/entries/${date}?${new URLSearchParams({ profile })}`, { signal: options?.signal });
    return body.entry === null ? null : parseDailyEntry(body.entry);
  }
  async previous(profile: JournalProfile, before: LocalDate, options?: ReadOptions): Promise<DailyEntry | null> {
    parseLocalDate(before);
    const body = await this.request(`/api/entries/previous?${new URLSearchParams({ profile, before })}`, { signal: options?.signal });
    return body.entry === null ? null : parseDailyEntry(body.entry);
  }
  async upsert(input: CheckInInput): Promise<DailyEntry> {
    const parsed = parseCheckInInput(input);
    const body = await this.request(`/api/entries/${parsed.localDate}`, { method: "PUT",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed) });
    return parseDailyEntry(body.entry);
  }
}
