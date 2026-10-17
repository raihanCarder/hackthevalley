import { PAIN_TYPES, type DailyEntry } from "../domain/contracts";
import { createEmptyLayers, decodePaintSnapshot, type PaintLayers } from "../body/map-utils";

/**
 * Range composite ("worst-area map"): the maximum value at each texel of each layer across the given saved entries.
 * It shows where each sensation was ever marked in the range, not one day's simultaneous pain.
 * Maps are decoded with the body feature's validated codec; incompatible maps reject rather than being skipped.
 */
export async function buildRangeComposite(entries: readonly DailyEntry[], signal?: AbortSignal): Promise<PaintLayers> {
  const composite = createEmptyLayers();
  for (const entry of entries) {
    if (signal?.aborted) throw new DOMException("Composite cancelled.", "AbortError");
    const layers = await decodePaintSnapshot(entry.maps);
    for (const type of PAIN_TYPES) {
      const target = composite[type], source = layers[type];
      for (let texel = 0; texel < target.length; texel++) if (source[texel] > target[texel]) target[texel] = source[texel];
    }
  }
  return composite;
}
