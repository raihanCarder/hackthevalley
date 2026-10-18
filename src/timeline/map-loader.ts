import type { DailyEntry, LocalDate } from "../domain/contracts";
import { decodePaintSnapshot, type PaintLayers } from "../body/map-utils";
import { checkRead, type JournalProfile, type SyntheticJournalSource } from "../journal/repository";

export interface LoadedMap { entry: DailyEntry | null; layers: PaintLayers | null }
/** A small decoded-map cache. Aborted reads never enter the cache or reach the screen. */
export class HistoryMapLoader {
  private cache = new Map<LocalDate, LoadedMap>();
  constructor(private source: Pick<SyntheticJournalSource, "read">, private profile: JournalProfile, private capacity = 8) {}
  async load(date: LocalDate, signal: AbortSignal): Promise<LoadedMap> {
    checkRead({ signal });
    const cached = this.cache.get(date);
    if (cached) { this.cache.delete(date); this.cache.set(date, cached); return cached; }
    const entry = await this.source.read(this.profile, date, { signal });
    checkRead({ signal });
    const layers = entry ? await decodePaintSnapshot(entry.maps) : null;
    checkRead({ signal });
    const result = { entry, layers };
    this.cache.set(date, result);
    while (this.cache.size > this.capacity) this.cache.delete(this.cache.keys().next().value!);
    return result;
  }
}
