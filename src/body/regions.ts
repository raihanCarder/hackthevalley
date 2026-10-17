import { PAIN_TYPES, REGION_IDS, type RegionalObservation } from "../domain/contracts";
import { getBodyAtlas, type BodyAtlas } from "./atlas";
import { assertLayers, PRESENCE_THRESHOLD, TEXEL_COUNT, type PaintLayers } from "./layers";

const round = (value: number, places: number) => Math.round(value * 10 ** places) / 10 ** places;

/**
 * The single shared reduction rule (design decision 5): bytes below PRESENCE_THRESHOLD count as unpainted; mean intensity
 * averages all valid region texels including zeros; peak is the maximum; map coverage is the fraction at or above the
 * threshold. Only present region/type pairs (coverage > 0) are returned, so an empty map yields an empty list.
 * Intensities are 0–10 rounded to 4 places, coverage 0–1 rounded to 6 places.
 */
export function reduceRegions(layers: PaintLayers, atlas: BodyAtlas = getBodyAtlas()): RegionalObservation[] {
  assertLayers(layers);
  const regions = REGION_IDS.length;
  const sum = new Float64Array(regions), peak = new Uint8Array(regions), covered = new Uint32Array(regions);
  const observations: RegionalObservation[] = [];
  const byKey = new Map<string, RegionalObservation>();
  for (const painType of PAIN_TYPES) {
    sum.fill(0); peak.fill(0); covered.fill(0);
    const layer = layers[painType];
    for (let texel = 0; texel < TEXEL_COUNT; texel++) {
      const value = layer[texel];
      if (value < PRESENCE_THRESHOLD) continue;
      const region = atlas.regionOf[texel];
      if (region < 0) continue;
      sum[region] += value; covered[region]++;
      if (value > peak[region]) peak[region] = value;
    }
    for (let region = 0; region < regions; region++) {
      if (!covered[region]) continue;
      const count = atlas.regionTexelCount[region];
      byKey.set(`${region}:${painType}`, {
        regionId: REGION_IDS[region], painType,
        meanIntensity: round(sum[region] / count / 255 * 10, 4),
        peakIntensity: round(peak[region] / 255 * 10, 4),
        mapCoverage: Math.max(1e-6, round(covered[region] / count, 6)),
      });
    }
  }
  // Stable order: REGION_IDS, then PAIN_TYPES.
  for (let region = 0; region < regions; region++) for (const painType of PAIN_TYPES) {
    const observation = byKey.get(`${region}:${painType}`);
    if (observation) observations.push(observation);
  }
  return observations;
}
