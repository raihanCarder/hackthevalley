import { BODY_MAP_VERSION, MAP_SIZE, SCHEMA_VERSION, type DailyEntry, type LocalDate, type RegionalObservation, type RegionId } from "../../src/domain/contracts";
import { createEmptyLayers, encodePaintSnapshot, getBodyAtlas, reduceRegions, type PaintLayers } from "../../src/body/map-utils";

const PLACEHOLDER = { bodyMapVersion: BODY_MAP_VERSION, width: MAP_SIZE, height: MAP_SIZE, encoding: "png-base64", layers: { burning: "x", sharp: "x", aching: "x", tingling: "x" } } as const;

/** Structural entry for evidence tests (maps are not decoded by the analysis). */
export function entry(date: string, observations: RegionalObservation[], extra: Partial<DailyEntry> = {}): DailyEntry {
  return {
    id: `e-${date}`, profileId: "visitor-a", localDate: date as LocalDate, timeZone: "America/Toronto", updatedAt: `${date}T20:00:00.000Z`,
    schemaVersion: SCHEMA_VERSION, bodyMapVersion: BODY_MAP_VERSION, maps: structuredClone(PLACEHOLDER) as DailyEntry["maps"], observations, ...extra,
  };
}
export const obs = (regionId: RegionId, painType: RegionalObservation["painType"], peak: number, coverage: number): RegionalObservation =>
  ({ regionId, painType, meanIntensity: Math.min(peak, peak * coverage), peakIntensity: peak, mapCoverage: coverage });

/** Layers with one region painted at a byte value, using the real atlas. */
export function paintRegion(regionId: RegionId, type: keyof PaintLayers, value: number, layers = createEmptyLayers(), fraction = 1) {
  const atlas = getBodyAtlas();
  const texels = atlas.islands.filter(island => island.regionId === regionId).flatMap(island => [...atlas.islandTexels[island.id]]);
  for (const texel of texels.slice(0, Math.ceil(texels.length * fraction))) layers[type][texel] = Math.max(layers[type][texel], value);
  return layers;
}
/** A real saved entry: encoded maps plus observations from the shared reducer. */
export async function savedEntry(date: string, layers: PaintLayers, extra: Partial<DailyEntry> = {}): Promise<DailyEntry> {
  return entry(date, reduceRegions(layers), { maps: await encodePaintSnapshot(layers), ...extra });
}
export function dates(start: string, count: number): string[] {
  const value = new Date(`${start}T00:00:00Z`);
  return Array.from({ length: count }, (_, index) => new Date(value.getTime() + index * 86_400_000).toISOString().slice(0, 10));
}
