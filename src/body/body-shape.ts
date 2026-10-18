import { base64ToBytes, bytesToBase64 } from "./png";

/**
 * Body-shape sliders. Each slider blends CC0 MakeHuman morph targets on top of the default figure. Shapes only move
 * vertices: triangles, UVs, and region labels never change, so saved maps and region measurements are identical
 * on every shape and the body-map version does not depend on it. Pure: no DOM or WebGL.
 */
export const BODY_SHAPE_SLIDERS = ["sex", "weight", "muscle", "height", "waist", "shoulders", "hips", "legs", "age"] as const;
export type BodyShapeSlider = (typeof BODY_SHAPE_SLIDERS)[number];
/** Every slider runs 0–1. 0.5 is the default figure, except age, where 0 is 25 years (the default) and 1 is about 70. */
export type BodyShape = Record<BodyShapeSlider, number>;
export const DEFAULT_BODY_SHAPE: BodyShape = { sex: .5, weight: .5, muscle: .5, height: .5, waist: .5, shoulders: .5, hips: .5, legs: .5, age: 0 };

/** One quantized sparse morph: welded vertex indices and xyz offsets in metres (int16 × scale). */
export interface EncodedMorph { scale: number; indices: string; values: string }
export interface BodyShapePack {
  bodyMapVersion: string;
  vertexCount: number;
  /** Fraction of the female-side sex offset kept on the chest (keeps every setting modest). */
  chestCap: number;
  /** How strongly the cap applies per welded vertex: uint32 indices and uint8 strengths (255 = full), fading out smoothly. */
  chest: { indices: string; strengths: string };
  morphs: Record<string, EncodedMorph>;
  source: { name: string; commit: string; license: string; files: { path: string; sha256: string }[] };
}
interface Morph { indices: Uint32Array; values: Float32Array }
/** `chest` holds the cap strength (0–1) of every welded vertex. */
export interface DecodedShapePack { vertexCount: number; chestCap: number; chest: Float32Array; morphs: Map<string, Morph> }

const AGE_MAX_OLD = .7; // the "old" target weight at the top of the slider (about 70 of MakeHuman's 25→90 years)
/** MakeHuman's height and leg-length targets reach unrealistic extremes; the sliders use part of their range. */
const REACH = { heightLow: .45, heightHigh: .4, legs: .6 } as const;

export function encodeMorph(indices: number[], values: number[]): EncodedMorph {
  const maxAbs = values.reduce((max, value) => Math.max(max, Math.abs(value)), 0) || 1;
  const scale = maxAbs / 32767;
  const index = new Uint8Array(indices.length * 4);
  const view = new DataView(index.buffer);
  indices.forEach((value, i) => view.setUint32(i * 4, value, true));
  const quantized = new Uint8Array(values.length * 2);
  const out = new DataView(quantized.buffer);
  values.forEach((value, i) => out.setInt16(i * 2, Math.round(value / scale), true));
  return { scale, indices: bytesToBase64(index), values: bytesToBase64(quantized) };
}

export function decodeShapePack(pack: BodyShapePack): DecodedShapePack {
  const morphs = new Map<string, Morph>();
  for (const [name, morph] of Object.entries(pack.morphs)) {
    const indexBytes = base64ToBytes(morph.indices), valueBytes = base64ToBytes(morph.values);
    const indexView = new DataView(indexBytes.buffer, indexBytes.byteOffset, indexBytes.byteLength);
    const valueView = new DataView(valueBytes.buffer, valueBytes.byteOffset, valueBytes.byteLength);
    const indices = new Uint32Array(indexBytes.length / 4);
    for (let i = 0; i < indices.length; i++) indices[i] = indexView.getUint32(i * 4, true);
    const values = new Float32Array(valueBytes.length / 2);
    for (let i = 0; i < values.length; i++) values[i] = valueView.getInt16(i * 2, true) * morph.scale;
    if (values.length !== indices.length * 3) throw new Error(`Corrupt body-shape morph ${name}.`);
    morphs.set(name, { indices, values });
  }
  const chest = new Float32Array(pack.vertexCount);
  const chestBytes = base64ToBytes(pack.chest.indices), strengths = base64ToBytes(pack.chest.strengths);
  const chestView = new DataView(chestBytes.buffer, chestBytes.byteOffset, chestBytes.byteLength);
  if (strengths.length * 4 !== chestBytes.length) throw new Error("Corrupt body-shape chest cap.");
  for (let i = 0; i < strengths.length; i++) chest[chestView.getUint32(i * 4, true)] = strengths[i] / 255;
  return { vertexCount: pack.vertexCount, chestCap: pack.chestCap, chest, morphs };
}

/** Clamps every slider to 0–1 and fills missing ones with defaults (stored preferences may be partial or stale). */
export function normalizeShape(value: unknown): BodyShape {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return Object.fromEntries(BODY_SHAPE_SLIDERS.map(slider => {
    const raw = input[slider];
    return [slider, typeof raw === "number" && Number.isFinite(raw) ? Math.min(1, Math.max(0, raw)) : DEFAULT_BODY_SHAPE[slider]];
  })) as BodyShape;
}
export const isDefaultShape = (shape: BodyShape) => BODY_SHAPE_SLIDERS.every(slider => Math.abs(shape[slider] - DEFAULT_BODY_SHAPE[slider]) < 1e-6);

/** MakeHuman's split of a 0–1 macro value into min/max target weights (0.5 is average). */
const low = (value: number) => Math.max(0, 1 - value * 2);
const high = (value: number) => Math.max(0, value * 2 - 1);

/**
 * Welded-vertex offsets (metres, xyz) of `shape` relative to the default figure, following MakeHuman's macro weights:
 * sex blends female/male targets; age blends young/old ethnic-average targets; muscle, weight, and height use the
 * young adult min/max targets of each sex; waist, shoulders, hips, and leg length use their measurement targets.
 */
export function shapeOffsets(pack: DecodedShapePack, shape: BodyShape, out = new Float32Array(pack.vertexCount * 3)): Float32Array {
  out.fill(0);
  const add = (name: string, weight: number, chestScale = 1) => {
    if (!weight) return;
    const morph = pack.morphs.get(name);
    if (!morph) throw new Error(`Missing body-shape morph ${name}.`);
    const { indices, values } = morph;
    for (let i = 0; i < indices.length; i++) {
      const v = indices[i], w = weight * (1 + (chestScale - 1) * pack.chest[v]);
      out[v * 3] += values[i * 3] * w; out[v * 3 + 1] += values[i * 3 + 1] * w; out[v * 3 + 2] += values[i * 3 + 2] * w;
    }
  };
  const male = shape.sex, female = 1 - shape.sex;
  const old = shape.age * AGE_MAX_OLD, young = 1 - old;
  // Ethnic-average shape, relative to the default (sex 0.5, young): only the difference is applied.
  // On the female side the whole ethnic offset is scaled down around the breasts, keeping every setting modest.
  const chest = female > .5 ? pack.chestCap : 1;
  add("female-young", female * young - .5, chest);
  add("male-young", male * young - .5, chest);
  add("female-old", female * old, chest);
  add("male-old", male * old, chest);
  for (const [sex, weight] of [["female", female], ["male", male]] as const) {
    add(`${sex}-minmuscle`, weight * low(shape.muscle)); add(`${sex}-maxmuscle`, weight * high(shape.muscle));
    add(`${sex}-minweight`, weight * low(shape.weight)); add(`${sex}-maxweight`, weight * high(shape.weight));
    add(`${sex}-minheight`, weight * low(shape.height) * REACH.heightLow); add(`${sex}-maxheight`, weight * high(shape.height) * REACH.heightHigh);
  }
  for (const part of ["waist", "shoulders", "hips", "legs"] as const) {
    const reach = part === "legs" ? REACH.legs : 1;
    add(`${part}-decr`, low(shape[part]) * reach); add(`${part}-incr`, high(shape[part]) * reach);
  }
  return out;
}
