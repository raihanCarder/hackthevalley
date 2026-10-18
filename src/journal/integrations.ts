import { decodePaintSnapshot, reduceRegions } from "../body/map-utils";
import { createMayaSource } from "../demo/maya-source";
import type { JournalMapServices, SyntheticJournalSource } from "./repository";

// Integration points owned by B: A's pure validator/decoder and region reducer, and C's immutable Maya fixture.
// Both run in the browser and in Node route handlers without the renderer.
export const journalMapServices: JournalMapServices = {
  async validateAndMeasure(maps) {
    return reduceRegions(await decodePaintSnapshot(maps));
  },
};
export const syntheticJournalSource: SyntheticJournalSource = createMayaSource();
