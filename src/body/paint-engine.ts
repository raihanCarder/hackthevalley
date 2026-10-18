import { PAIN_TYPES, type PainType } from "../domain/contracts";
import type { BodyAtlas } from "./atlas";
import { assertLayers, cloneLayers, createEmptyLayers, layersAreEmpty, MAX_UNDO_STROKES, PRESENCE_THRESHOLD, TEXEL_COUNT, type PaintLayers } from "./layers";

export type BrushTool = "brush" | "eraser";
export interface SurfaceHit {
  /** Model-space surface point. */
  point: readonly [number, number, number];
  /** Render triangle that contains the point (from a raycast or a landmark). */
  triangle: number;
}
export interface StrokeOptions {
  layer: PainType;
  tool: BrushTool;
  /** Target byte (0–255) for the brush centre; ignored by the eraser. */
  intensity: number;
  /** Surface radius in metres. */
  radius: number;
}
interface Patch { layer: PainType; texels: Uint32Array; before: Uint8Array }

/** Samples farther apart than this are never joined into one continuous mark. */
const MAX_JOIN_DISTANCE = .25;
/** Samples are joined only when the surface path is at most this much longer than the straight line between them. */
const MAX_DETOUR = 1.6;
/** The eraser reaches a little farther with a harder edge, so retracing a mark removes its soft rim too. */
const ERASER_REACH = 1.3;

/**
 * CPU paint maps are the source of truth (design decision 3). A stamp covers texels whose geodesic distance on the
 * welded body surface is within the radius, so paint follows the skin across UV seams and never jumps across a gap
 * (finger to finger, front to back of a hand, ear to scalp). Maximum blending, soft falloff, bounded undo.
 */
export class PaintEngine {
  readonly atlas: BodyAtlas;
  private layers: PaintLayers;
  private undoStack: Patch[] = [];
  private stroke: { options: StrokeOptions; touched: number[]; before: number[]; last: SurfaceHit | null } | null = null;
  private touchedMark = new Uint8Array(TEXEL_COUNT);
  private revisionValue = 0;
  private dirtyValue = 0;
  // Geodesic workspace, reused between stamps.
  private distance: Float32Array;
  private previous: Int32Array;
  private settled: Uint8Array;
  private visited: number[] = [];
  private triangleMark: Uint8Array;

  constructor(atlas: BodyAtlas, initial?: PaintLayers | null) {
    this.atlas = atlas;
    this.layers = createEmptyLayers();
    this.distance = new Float32Array(atlas.vertexCount).fill(Infinity);
    this.previous = new Int32Array(atlas.vertexCount).fill(-1);
    this.settled = new Uint8Array(atlas.vertexCount);
    this.triangleMark = new Uint8Array(atlas.triangleCount);
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
    const straight = last ? Math.hypot(hit.point[0] - last.point[0], hit.point[1] - last.point[1], hit.point[2] - last.point[2]) : 0;
    const radius = this.effectiveRadius();
    if (last && straight > radius * .3 && straight <= MAX_JOIN_DISTANCE) {
      // Join along the shortest surface path, if the surface connects the samples without a long detour.
      const path = this.surfacePath(last, hit, straight * MAX_DETOUR + radius * .5);
      if (path) {
        const step = Math.max(radius * .3, .003);
        let previous = last.point as readonly number[];
        for (const vertex of path) {
          const point = [this.atlas.vertices[vertex * 3], this.atlas.vertices[vertex * 3 + 1], this.atlas.vertices[vertex * 3 + 2]] as const;
          if (Math.hypot(point[0] - previous[0], point[1] - previous[1], point[2] - previous[2]) < step) continue;
          this.stamp({ point, triangle: this.atlas.vertexTriangles[this.atlas.vertexTriangleStart[vertex]] });
          previous = point;
        }
      }
    }
    this.stamp(hit);
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

  private effectiveRadius() {
    const options = this.stroke!.options;
    return options.tool === "eraser" ? options.radius * ERASER_REACH : options.radius;
  }

  /**
   * Bounded Dijkstra from a surface point over welded edges. Leaves distances in `this.distance` for visited vertices
   * (listed in `this.visited`); call `resetGeodesic` afterwards. Stops early when `goal` (a vertex set) is settled.
   */
  private geodesic(hit: SurfaceHit, limit: number, goal?: Set<number>): number {
    const { atlas, distance, previous, settled, visited } = this;
    const heap: number[] = [];
    const push = (vertex: number) => {
      heap.push(vertex);
      for (let i = heap.length - 1; i > 0;) { const parent = (i - 1) >> 1; if (distance[heap[parent]] <= distance[heap[i]]) break; [heap[parent], heap[i]] = [heap[i], heap[parent]]; i = parent; }
    };
    const pop = () => {
      const top = heap[0], end = heap.pop()!;
      if (heap.length) {
        heap[0] = end;
        for (let i = 0; ;) {
          const l = i * 2 + 1, r = l + 1;
          let m = i;
          if (l < heap.length && distance[heap[l]] < distance[heap[m]]) m = l;
          if (r < heap.length && distance[heap[r]] < distance[heap[m]]) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]]; i = m;
        }
      }
      return top;
    };
    for (let k = 0; k < 3; k++) {
      const v = atlas.triangles[hit.triangle * 3 + k];
      const d = Math.hypot(atlas.vertices[v * 3] - hit.point[0], atlas.vertices[v * 3 + 1] - hit.point[1], atlas.vertices[v * 3 + 2] - hit.point[2]);
      if (distance[v] === Infinity) visited.push(v);
      if (d < distance[v]) { distance[v] = d; previous[v] = -1; push(v); }
    }
    while (heap.length) {
      const v = pop();
      if (settled[v]) continue;
      settled[v] = 1;
      if (goal?.has(v)) return v;
      if (distance[v] > limit) break;
      for (let i = atlas.neighborStart[v]; i < atlas.neighborStart[v + 1]; i++) {
        const n = atlas.neighbors[i], d = distance[v] + atlas.edgeLength[i];
        if (d >= distance[n] || d > limit + atlas.edgeLength[i]) continue;
        if (distance[n] === Infinity) visited.push(n);
        distance[n] = d; previous[n] = v; push(n);
      }
    }
    return -1;
  }

  private resetGeodesic() {
    for (const v of this.visited) { this.distance[v] = Infinity; this.previous[v] = -1; this.settled[v] = 0; }
    this.visited.length = 0;
  }

  /** Welded vertices along the surface path from `from` to `to`, or null when the surface detour is too long. */
  private surfacePath(from: SurfaceHit, to: SurfaceHit, limit: number): number[] | null {
    const goal = new Set([0, 1, 2].map(k => this.atlas.triangles[to.triangle * 3 + k]));
    const reached = this.geodesic(from, limit, goal);
    let path: number[] | null = null;
    if (reached >= 0 && this.distance[reached] <= limit) {
      path = [];
      for (let v = reached; v >= 0; v = this.previous[v]) path.push(v);
      path.reverse();
    }
    this.resetGeodesic();
    return path;
  }

  private stamp(hit: SurfaceHit) {
    const stroke = this.stroke!;
    const { tool, intensity } = stroke.options;
    const erasing = tool === "eraser";
    const radius = this.effectiveRadius();
    const inner = radius * (erasing ? .7 : .45);
    const layer = this.layers[stroke.options.layer];
    const { atlas, distance, triangleMark } = this;
    this.geodesic(hit, radius);
    const triangles: number[] = [];
    for (const v of this.visited) {
      if (distance[v] >= radius) continue;
      for (let i = atlas.vertexTriangleStart[v]; i < atlas.vertexTriangleStart[v + 1]; i++) {
        const t = atlas.vertexTriangles[i];
        if (!triangleMark[t]) { triangleMark[t] = 1; triangles.push(t); }
      }
    }
    if (!triangleMark[hit.triangle]) { triangleMark[hit.triangle] = 1; triangles.push(hit.triangle); }
    let changed = false;
    for (const t of triangles) {
      triangleMark[t] = 0;
      const corners = [atlas.triangles[t * 3], atlas.triangles[t * 3 + 1], atlas.triangles[t * 3 + 2]];
      const cornerDistance = corners.map(v => Math.min(distance[v], radius));
      for (let i = atlas.triangleTexelStart[t]; i < atlas.triangleTexelStart[t + 1]; i++) {
        const texel = atlas.triangleTexels[i];
        const w0 = atlas.bary[texel * 3], w1 = atlas.bary[texel * 3 + 1], w2 = atlas.bary[texel * 3 + 2];
        let d: number;
        if (t === hit.triangle) {
          // Inside the hit triangle the straight-line distance is exact.
          const px = atlas.vertices[corners[0] * 3] * w0 + atlas.vertices[corners[1] * 3] * w1 + atlas.vertices[corners[2] * 3] * w2;
          const py = atlas.vertices[corners[0] * 3 + 1] * w0 + atlas.vertices[corners[1] * 3 + 1] * w1 + atlas.vertices[corners[2] * 3 + 1] * w2;
          const pz = atlas.vertices[corners[0] * 3 + 2] * w0 + atlas.vertices[corners[1] * 3 + 2] * w1 + atlas.vertices[corners[2] * 3 + 2] * w2;
          d = Math.hypot(px - hit.point[0], py - hit.point[1], pz - hit.point[2]);
        } else {
          d = cornerDistance[0] * w0 + cornerDistance[1] * w1 + cornerDistance[2] * w2;
        }
        if (d >= radius) continue;
        // Soft edge: full strength inside the inner radius, smooth falloff to zero at the rim.
        const s = d <= inner ? 0 : (d - inner) / (radius - inner);
        const falloff = 1 - s * s * (3 - 2 * s);
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
    this.resetGeodesic();
    if (changed) this.dirtyValue++;
  }
}
