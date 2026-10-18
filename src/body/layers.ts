import { MAP_SIZE, PAIN_TYPES, type PainType } from "../domain/contracts";

/** Four independent 512x512 intensity buffers. Row 0 is the top of the atlas (v = 1); see docs/body-contract.md. */
export type PaintLayers = Record<PainType, Uint8Array>;

export const TEXEL_COUNT = MAP_SIZE * MAP_SIZE;
/** Texels below this byte value are soft-edge residue and count as unpainted (design decision 5). */
export const PRESENCE_THRESHOLD = 13;
export const MAX_UNDO_STROKES = 10;

export function createEmptyLayers(): PaintLayers {
  return Object.fromEntries(PAIN_TYPES.map(type => [type, new Uint8Array(TEXEL_COUNT)])) as PaintLayers;
}

/** Deep copy; never returns a buffer shared with the source. */
export function cloneLayers(layers: PaintLayers): PaintLayers {
  return Object.fromEntries(PAIN_TYPES.map(type => [type, layers[type].slice()])) as PaintLayers;
}

export function assertLayers(layers: unknown): asserts layers is PaintLayers {
  if (!layers || typeof layers !== "object") throw new Error("Expected four paint layers.");
  for (const type of PAIN_TYPES) {
    const layer = (layers as Record<string, unknown>)[type];
    if (!(layer instanceof Uint8Array) || layer.length !== TEXEL_COUNT) throw new Error(`The ${type} layer must be a ${MAP_SIZE}x${MAP_SIZE} byte buffer.`);
  }
}

export function layersAreEmpty(layers: PaintLayers): boolean {
  return PAIN_TYPES.every(type => layers[type].every(value => value < PRESENCE_THRESHOLD));
}

/** Intensity 1–10 to a stored byte; 10 is 255. */
export function intensityToByte(intensity: number): number {
  return Math.round(Math.min(10, Math.max(0, intensity)) / 10 * 255);
}
export function byteToIntensity(value: number): number {
  return value / 255 * 10;
}
/** CPU buffer index for a UV coordinate (origin bottom-left) using the documented clamped conversion. */
export function uvToTexel(u: number, v: number): number {
  const column = Math.min(MAP_SIZE - 1, Math.max(0, Math.floor(u * MAP_SIZE)));
  const row = Math.min(MAP_SIZE - 1, Math.max(0, Math.floor((1 - v) * MAP_SIZE)));
  return row * MAP_SIZE + column;
}
