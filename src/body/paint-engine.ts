import { PAIN_TYPES, type PainType } from "../domain/contracts";
import type { BodyAtlas } from "./atlas";
import { assertLayers, cloneLayers, createEmptyLayers, layersAreEmpty, MAX_UNDO_STROKES, PRESENCE_THRESHOLD, TEXEL_COUNT, type PaintLayers } from "./layers";

export type BrushTool = "brush" | "eraser";
export interface SurfaceHit {
  /** Model-space surface point and outward face normal. */
  point: readonly [number, number, number];
  normal: readonly [number, number, number];
  island: number;
}
export interface StrokeOptions {
  layer: PainType;
  tool: BrushTool;
  /** Target byte (0–255) for the brush centre; ignored by the eraser. */
  intensity: number;
  /** World-space radius in metres. */
  radius: number;
}
interface Patch { layer: PainType; texels: Uint32Array; before: Uint8Array }

/** Strokes jumping farther than this between samples are not joined (e.g. a lost pointer re-entering elsewhere). */
const MAX_JOIN_DISTANCE = .25;
/** Texels whose normal faces away from the brush more than this are on another side of the surface. */
const MIN_NORMAL_ALIGNMENT = .2;
/** The eraser reaches a little farther with a harder edge, so retracing a mark removes its soft rim too. */
const ERASER_REACH = 1.2;

/**
 * CPU paint maps are the source of truth (design decision 3). Stamps use maximum blending with a soft radial falloff,
 * are restricted to the hit island and its documented seam neighbours, and ignore surfaces facing away from the brush.
 */
export class PaintEngine {
  readonly atlas: BodyAtlas;
  private layers: PaintLayers;
  private undoStack: Patch[] = [];
  private stroke: { options: StrokeOptions; touched: number[]; before: number[]; last: SurfaceHit | null } | null = null;
  private touchedMark = new Uint8Array(TEXEL_COUNT);
  private revisionValue = 0;
  /** Bumps on every texel change, including mid-stroke, so the renderer knows when to upload. */
  private dirtyValue = 0;

  constructor(atlas: BodyAtlas, initial?: PaintLayers | null) {
    this.atlas = atlas;
    this.layers = createEmptyLayers();
    if (initial) this.load(initial);
  }

  get revision() { return this.revisionValue; }
  get dirty() { return this.dirtyValue; }
  get canUndo() { return this.undoStack.length > 0; }
  get undoDepth() { return this.undoStack.length; }
  get stroking() { return this.stroke !== null; }
  isEmpty() { return layersAreEmpty(this.layers); }
  /** Read-only view for the renderer. Callers outside the body feature should use snapshot(). */
  peek(): Readonly<PaintLayers> { return this.layers; }
  snapshot(): PaintLayers { return cloneLayers(this.layers); }

  /** Replaces all four layers with a copy of `layers` (or blanks them) and clears undo history. */
  load(layers: PaintLayers | null) {
    if (this.stroke) this.cancelStroke();
    if (layers) assertLayers(layers);
    this.layers = layers ? cloneLayers(layers) : createEmptyLayers();
    this.undoStack = [];
    this.revisionValue++; this.dirtyValue++;
  }

  beginStroke(options: StrokeOptions) {
    if (this.stroke) this.endStroke();
    if (!PAIN_TYPES.includes(options.layer)) throw new Error("Unknown pain layer.");
    this.stroke = { options: { ...options, intensity: Math.max(0, Math.min(255, Math.round(options.intensity))) }, touched: [], before: [], last: null };
  }

  /** Adds one surface sample to the current stroke, or breaks the stroke's path when the pointer leaves the body. */
  strokeTo(hit: SurfaceHit | null, intensity?: number) {
    const stroke = this.stroke;
    if (!stroke) return;
    if (intensity !== undefined) stroke.options.intensity = Math.max(0, Math.min(255, Math.round(intensity)));
    if (!hit) { stroke.last = null; return; }
    const last = stroke.last;
    const distance = last ? Math.hypot(hit.point[0] - last.point[0], hit.point[1] - last.point[1], hit.point[2] - last.point[2]) : 0;
    if (last && distance > 0 && distance <= MAX_JOIN_DISTANCE && this.related(last.island, hit.island)) {
      // Interpolate along the chord so a fast drag leaves no gaps; only between related surfaces.
      const step = Math.max(stroke.options.radius * .3, .003);
      const steps = Math.ceil(distance / step);
      const islands = new Set([last.island, hit.island, ...this.atlas.seamNeighbors[last.island], ...this.atlas.seamNeighbors[hit.island]]);
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const point = [0, 1, 2].map(axis => last.point[axis] + (hit.point[axis] - last.point[axis]) * t) as [number, number, number];
        const normal = [0, 1, 2].map(axis => last.normal[axis] + (hit.normal[axis] - last.normal[axis]) * t) as [number, number, number];
        this.stamp(point, normal, islands);
      }
    } else {
      this.stamp(hit.point, hit.normal, new Set([hit.island, ...this.atlas.seamNeighbors[hit.island]]));
    }
    stroke.last = hit;
  }

  /** Commits the stroke as one undo step. Returns true when any texel changed. */
  endStroke(): boolean {
    const stroke = this.stroke;
    if (!stroke) return false;
    this.stroke = null;
    for (const texel of stroke.touched) this.touchedMark[texel] = 0;
    const layer = this.layers[stroke.options.layer];
    const texels: number[] = [], before: number[] = [];
    stroke.touched.forEach((texel, index) => { if (layer[texel] !== stroke.before[index]) { texels.push(texel); before.push(stroke.before[index]); } });
    if (!texels.length) return false;
    this.undoStack.push({ layer: stroke.options.layer, texels: Uint32Array.from(texels), before: Uint8Array.from(before) });
    if (this.undoStack.length > MAX_UNDO_STROKES) this.undoStack.shift();
    this.revisionValue++;
    return true;
  }

  /** Discards the in-progress stroke (pointer cancel, Escape, multi-touch). */
  cancelStroke() {
    const stroke = this.stroke;
    if (!stroke) return;
    this.stroke = null;
    const layer = this.layers[stroke.options.layer];
    stroke.touched.forEach((texel, index) => { layer[texel] = stroke.before[index]; this.touchedMark[texel] = 0; });
    if (stroke.touched.length) this.dirtyValue++;
  }

  /** Reverts the most recent completed stroke on its own layer only. */
  undo(): boolean {
    if (this.stroke) this.cancelStroke();
    const patch = this.undoStack.pop();
    if (!patch) return false;
    const layer = this.layers[patch.layer];
    patch.texels.forEach((texel, index) => { layer[texel] = patch.before[index]; });
    this.revisionValue++; this.dirtyValue++;
    return true;
  }

  private related(a: number, b: number) {
    return a === b || this.atlas.seamNeighbors[a].includes(b);
  }

  private stamp(point: readonly number[], normalIn: readonly number[], islands: Set<number>) {
    const stroke = this.stroke!;
    const { tool, intensity } = stroke.options;
    const erasing = tool === "eraser";
    const radius = erasing ? stroke.options.radius * ERASER_REACH : stroke.options.radius;
    const layer = this.layers[stroke.options.layer];
    const { position, normal, islandTexels, islandBox } = this.atlas;
    const length = Math.hypot(normalIn[0], normalIn[1], normalIn[2]) || 1;
    const nx = normalIn[0] / length, ny = normalIn[1] / length, nz = normalIn[2] / length;
    const radius2 = radius * radius;
    const inner = radius * (erasing ? .7 : .45);
    let changed = false;
    for (const island of islands) {
      const box = islandBox[island];
      if (point[0] < box[0] - radius || point[1] < box[1] - radius || point[2] < box[2] - radius ||
        point[0] > box[3] + radius || point[1] > box[4] + radius || point[2] > box[5] + radius) continue;
      for (const texel of islandTexels[island]) {
        const dx = position[texel * 3] - point[0], dy = position[texel * 3 + 1] - point[1], dz = position[texel * 3 + 2] - point[2];
        const distance2 = dx * dx + dy * dy + dz * dz;
        if (distance2 >= radius2) continue;
        if (normal[texel * 3] * nx + normal[texel * 3 + 1] * ny + normal[texel * 3 + 2] * nz < MIN_NORMAL_ALIGNMENT) continue;
        const distance = Math.sqrt(distance2);
        // Soft edge: full strength inside the inner radius, smooth falloff to zero at the rim.
        const t = distance <= inner ? 0 : (distance - inner) / (radius - inner);
        const falloff = 1 - t * t * (3 - 2 * t);
        const current = layer[texel];
        let next: number;
        if (!erasing) next = Math.max(current, Math.round(intensity * falloff));
        else {
          next = Math.round(current * (1 - falloff));
          if (next < PRESENCE_THRESHOLD) next = 0; // no invisible residue left behind
        }
        if (next === current) continue;
        if (!this.touchedMark[texel]) { this.touchedMark[texel] = 1; stroke.touched.push(texel); stroke.before.push(current); }
        layer[texel] = next;
        changed = true;
      }
    }
    if (changed) this.dirtyValue++;
  }
}
