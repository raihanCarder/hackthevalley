import { decodePaintSnapshot, reduceRegions } from "../body/map-utils";
import { MAYA_ENTRIES } from "../demo/maya";
import { checkRead, JournalError, summarizeEntry, validateRange, type JournalMapServices, type SyntheticJournalSource } from "./repository";

function requireMaya(profile: string) {
  if (profile !== "maya") throw new JournalError("forbidden", "This source contains only Maya's synthetic records.");
}

export const journalMapServices: JournalMapServices = {
  async validateAndMeasure(maps) { return reduceRegions(await decodePaintSnapshot(maps)); },
};
export const syntheticJournalSource: SyntheticJournalSource = {
  async list(profile, range, options) {
    requireMaya(profile); validateRange(range); checkRead(options);
    return MAYA_ENTRIES.filter(e => e.localDate >= range.from && e.localDate <= range.to).map(summarizeEntry);
  },
  async read(profile, date, options) {
    requireMaya(profile); checkRead(options);
    return structuredClone(MAYA_ENTRIES.find(e => e.localDate === date) ?? null);
  },
  async previous(profile, before, options) {
    requireMaya(profile); checkRead(options);
    return structuredClone(MAYA_ENTRIES.filter(e => e.localDate < before).at(-1) ?? null);
  },
};
