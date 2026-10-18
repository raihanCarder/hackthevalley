import { parseLocalDate, type DailyEntry, type LocalDate } from "../domain/contracts";
import {
  checkRead, JournalError, parseStoredEntry, prepareEntry, requireSynthetic, summarizeEntry, validateRange,
  type CheckInInput, type DateRange, type EntrySummary, type JournalMapServices,
  type JournalProfile, type JournalRepository, type ReadOptions, type SyntheticJournalSource,
} from "./repository";

export interface IndexedDbOptions {
  profileId: string;
  maps: JournalMapServices | null;
  synthetic?: SyntheticJournalSource | null;
  databaseName?: string;
  factory?: IDBFactory;
}

/** Two stores keep list queries free of encoded image payloads. */
export class IndexedDbJournal implements JournalRepository {
  readonly storage = "indexeddb" as const;
  private database?: Promise<IDBDatabase>;
  constructor(private readonly options: IndexedDbOptions) {
    if (!options.profileId.startsWith("local-")) throw new JournalError("invalid", "Invalid local visitor profile.");
  }

  private open(): Promise<IDBDatabase> {
    if (!this.database) this.database = new Promise<IDBDatabase>((resolve, reject) => {
      const factory = this.options.factory ?? globalThis.indexedDB;
      if (!factory) { reject(new JournalError("unavailable", "Browser storage is unavailable.")); return; }
      const request = factory.open(this.options.databaseName ?? "pain-journal-v1", 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        for (const name of ["entries", "summaries"]) db.createObjectStore(name, { keyPath: ["profileId", "localDate"] });
      };
      request.onerror = () => reject(new JournalError("unavailable", "Browser storage could not be opened."));
      request.onblocked = () => reject(new JournalError("unavailable", "Close other pain journal tabs and retry opening storage."));
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => { db.close(); this.database = undefined; };
        resolve(db);
      };
    }).catch(error => { this.database = undefined; throw error; });
    return this.database;
  }

  async close(): Promise<void> {
    if (this.database) (await this.database).close();
    this.database = undefined;
  }

  private async readTransaction<T>(stores: string[], options: ReadOptions | undefined,
    operation: (transaction: IDBTransaction, result: (value: T) => void) => void): Promise<T> {
    checkRead(options);
    const db = await this.open();
    checkRead(options);
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(stores, "readonly");
      let result: T;
      const cancel = () => { try { tx.abort(); } catch { /* Already completed. */ } };
      options?.signal?.addEventListener("abort", cancel, { once: true });
      const cleanup = () => options?.signal?.removeEventListener("abort", cancel);
      tx.oncomplete = () => { cleanup(); resolve(result); };
      tx.onabort = tx.onerror = () => { cleanup(); reject(new JournalError(options?.signal?.aborted ? "cancelled" : "unavailable", "The journal could not be read.")); };
      try { operation(tx, value => { result = value; }); }
      catch (error) { cancel(); reject(error); }
    });
  }

  async list(profile: JournalProfile, range: DateRange, options?: ReadOptions): Promise<EntrySummary[]> {
    validateRange(range); checkRead(options);
    if (profile === "maya") return structuredClone(await requireSynthetic(this.options.synthetic ?? null).list("maya", range, options));
    return this.readTransaction(["summaries"], options, (tx, finish) => {
      const rows: EntrySummary[] = [];
      const bounds = IDBKeyRange.bound([this.options.profileId, range.from], [this.options.profileId, range.to]);
      const cursor = tx.objectStore("summaries").openCursor(bounds);
      cursor.onsuccess = () => { if (cursor.result) { rows.push(cursor.result.value); cursor.result.continue(); } else finish(rows); };
    });
  }

  async read(profile: JournalProfile, date: LocalDate, options?: ReadOptions): Promise<DailyEntry | null> {
    parseLocalDate(date); checkRead(options);
    if (profile === "maya") return structuredClone(await requireSynthetic(this.options.synthetic ?? null).read("maya", date, options));
    const entry = await this.readTransaction<unknown>(["entries"], options, (tx, finish) => {
      const request = tx.objectStore("entries").get([this.options.profileId, date]);
      request.onsuccess = () => finish(request.result);
    });
    return entry === undefined ? null : parseStoredEntry(entry);
  }

  async previous(profile: JournalProfile, before: LocalDate, options?: ReadOptions): Promise<DailyEntry | null> {
    parseLocalDate(before); checkRead(options);
    if (profile === "maya") return structuredClone(await requireSynthetic(this.options.synthetic ?? null).previous("maya", before, options));
    if (before === "0001-01-01") return null;
    const entry = await this.readTransaction<unknown>(["entries"], options, (tx, finish) => {
      const bounds = IDBKeyRange.bound([this.options.profileId, "0001-01-01"], [this.options.profileId, before], false, true);
      const request = tx.objectStore("entries").openCursor(bounds, "prev");
      request.onsuccess = () => finish(request.result?.value);
    });
    return entry === undefined ? null : parseStoredEntry(entry);
  }

  async upsert(input: CheckInInput): Promise<DailyEntry> {
    const prepared = await prepareEntry(input, this.options.profileId, this.options.maps);
    const db = await this.open();
    return new Promise<DailyEntry>((resolve, reject) => {
      const tx = db.transaction(["entries", "summaries"], "readwrite");
      let saved = prepared;
      tx.oncomplete = () => resolve(structuredClone(saved));
      tx.onabort = tx.onerror = () => reject(new JournalError("unavailable", "Browser storage rejected the save. Your draft has not been saved."));
      const store = tx.objectStore("entries");
      const request = store.get([this.options.profileId, prepared.localDate]);
      request.onsuccess = () => {
        if (request.result) saved = { ...prepared, id: request.result.id };
        store.put(saved);
        tx.objectStore("summaries").put(summarizeEntry(saved));
      };
    });
  }
}

/** Stable browser-local identity. A server session is never reused as a local ID. */
export function localVisitorId(storage: Pick<Storage, "getItem" | "setItem">): string {
  try {
    let id = storage.getItem("pain-journal-local-profile");
    if (!id || !/^local-[0-9a-f-]{36}$/.test(id)) {
      id = `local-${crypto.randomUUID()}`;
      storage.setItem("pain-journal-local-profile", id);
    }
    return id;
  } catch { throw new JournalError("unavailable", "Browser storage is blocked. Your draft remains on this page."); }
}
