import { BODY_MAP_VERSION, MAP_SIZE, PAIN_TYPES, SCHEMA_VERSION, parseLocalDate, type DailyEntry, type PaintSnapshot } from "../../src/domain/contracts";
import type { CheckInInput, JournalMapServices } from "../../src/journal/repository";

// Test-only structural fixtures. These deliberately do NOT pretend to be real PNGs
// or Owner A's validator/reducer; integration with that pipeline is still pending.
export function maps(label = "test-only-painted"): PaintSnapshot {
  return { bodyMapVersion: BODY_MAP_VERSION, width: MAP_SIZE, height: MAP_SIZE, encoding: "png-base64",
    layers: Object.fromEntries(PAIN_TYPES.map(type => [type, `${label}-${type}`])) as PaintSnapshot["layers"] };
}
export const mapServices: JournalMapServices = {
  async validateAndMeasure(snapshot) {
    return snapshot.layers.aching.startsWith("test-only-empty") ? [] : [
      { regionId: "back-lower-torso", painType: "aching", meanIntensity: 1, peakIntensity: 5, mapCoverage: .2 },
    ];
  },
};
export function input(date = "2026-10-17", label?: string): CheckInInput {
  return { localDate: parseLocalDate(date), timeZone: "America/Toronto", maps: maps(label), note: "A test note with partial relief." };
}
export function entry(date = "2026-10-17"): DailyEntry {
  return { ...input(date), id: crypto.randomUUID(), profileId: "local-test", schemaVersion: SCHEMA_VERSION,
    bodyMapVersion: BODY_MAP_VERSION, updatedAt: "2026-10-17T20:00:00.000Z", observations: [] };
}
