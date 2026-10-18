import type { RegionId } from "../../src/domain/contracts";
import { cross, dot, normalize, sub, type Vec3 } from "./mesh";

/**
 * Region-aligned UV charts. Each chart holds edge-connected triangles of one region whose normals favour one of
 * 26 directions; it is projected onto the plane facing that direction, which keeps it free of folds. Charts are
 * packed into the square atlas at one uniform texel density with gutters wide enough for display dilation.
 */
export interface Chart { region: RegionId; triangles: number[]; direction: Vec3; uv: Map<number, [number, number]>; min: [number, number]; max: [number, number] }
export interface PackedChart extends Chart { offset: [number, number] }

const DIRECTIONS: Vec3[] = (() => {
  const list: Vec3[] = [];
  for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) for (const z of [-1, 0, 1]) if (x || y || z) list.push(normalize([x, y, z]));
  return list;
})();

function basis(direction: Vec3): [Vec3, Vec3] {
  const helper: Vec3 = Math.abs(direction[1]) < .9 ? [0, 1, 0] : [1, 0, 0];
  const u = normalize(cross(helper, direction));
  return [u, cross(direction, u)];
}

/** True when 2D triangles overlap with positive area (shared edges and corners do not count). */
function trianglesOverlap(a: [number, number][], b: [number, number][]) {
  const axes = (t: [number, number][]) => t.map((p, i) => { const q = t[(i + 1) % 3]; return [q[1] - p[1], p[0] - q[0]] as [number, number]; });
  for (const axis of [...axes(a), ...axes(b)]) {
    const project = (t: [number, number][]) => t.map(p => p[0] * axis[0] + p[1] * axis[1]);
    const pa = project(a), pb = project(b);
    const eps = 1e-12 * Math.hypot(...axis);
    if (Math.max(...pa) <= Math.min(...pb) + eps || Math.max(...pb) <= Math.min(...pa) + eps) return false;
  }
  return true;
}

export function buildCharts(positions: Vec3[], triangles: [number, number, number][], regions: RegionId[]): Chart[] {
  const normals = triangles.map(([a, b, c]) => normalize(cross(sub(positions[b], positions[a]), sub(positions[c], positions[a]))));
  const preferred = normals.map(n => { let best = 0, score = -Infinity; DIRECTIONS.forEach((d, i) => { const s = dot(n, d); if (s > score) { score = s; best = i; } }); return best; });
  const edgeOwners = new Map<string, number[]>();
  triangles.forEach((t, index) => { for (let k = 0; k < 3; k++) { const [u, v] = [t[k], t[(k + 1) % 3]].sort((m, n) => m - n); const key = `${u}:${v}`; edgeOwners.set(key, [...(edgeOwners.get(key) ?? []), index]); } });
  const neighbors = triangles.map(() => [] as number[]);
  for (const owners of edgeOwners.values()) for (const a of owners) for (const b of owners) if (a !== b) neighbors[a].push(b);

  const assigned = new Int32Array(triangles.length).fill(-1);
  const charts: Chart[] = [];
  const cell = .01;
  const state = new Map<Chart, { bu: Vec3; bv: Vec3; grid: Map<string, number[]> }>();
  const flat = (chart: Chart, t: number) => { const { bu, bv } = state.get(chart)!; return triangles[t].map(v => [dot(positions[v], bu), dot(positions[v], bv)]) as [number, number][]; };
  const cells = (points: [number, number][]) => {
    const xs = points.map(p => Math.floor(p[0] / cell)), ys = points.map(p => Math.floor(p[1] / cell));
    const keys: string[] = [];
    for (let gx = Math.min(...xs); gx <= Math.max(...xs); gx++) for (let gy = Math.min(...ys); gy <= Math.max(...ys); gy++) keys.push(`${gx}:${gy}`);
    return keys;
  };
  // A triangle fits a chart when it faces the chart's projection direction and does not overlap the chart in UV space.
  const fits = (chart: Chart, t: number, minFacing: number) => {
    if (dot(normals[t], chart.direction) < minFacing) return false;
    const points = flat(chart, t);
    const { grid } = state.get(chart)!;
    for (const key of cells(points)) for (const other of grid.get(key) ?? []) {
      const shared = triangles[t].filter(v => triangles[other].includes(v)).length;
      if (shared < 2 && trianglesOverlap(points, flat(chart, other))) return false;
    }
    return true;
  };
  const add = (chart: Chart, t: number) => {
    assigned[t] = charts.indexOf(chart); chart.triangles.push(t);
    const points = flat(chart, t);
    const { grid } = state.get(chart)!;
    triangles[t].forEach((v, k) => { chart.uv.set(v, points[k]); for (const axis of [0, 1]) { chart.min[axis] = Math.min(chart.min[axis], points[k][axis]); chart.max[axis] = Math.max(chart.max[axis], points[k][axis]); } });
    for (const key of cells(points)) grid.set(key, [...(grid.get(key) ?? []), t]);
  };
  const grow = (chart: Chart, start: number[], minFacing: number) => {
    const queue = [...start];
    while (queue.length) {
      const current = queue.shift()!;
      for (const next of neighbors[current]) {
        if (assigned[next] >= 0 || regions[next] !== chart.region || !fits(chart, next, minFacing)) continue;
        add(chart, next); queue.push(next);
      }
    }
  };
  // Seeds: triangles facing one of the 26 directions most squarely, so charts start from flat-facing areas.
  const order = triangles.map((_, i) => i).sort((a, b) => dot(normals[b], DIRECTIONS[preferred[b]]) - dot(normals[a], DIRECTIONS[preferred[a]]) || a - b);
  for (const seed of order) {
    if (assigned[seed] >= 0) continue;
    const direction = normals[seed];
    const [bu, bv] = basis(direction);
    const chart: Chart = { region: regions[seed], triangles: [], direction, uv: new Map(), min: [Infinity, Infinity], max: [-Infinity, -Infinity] };
    charts.push(chart); state.set(chart, { bu, bv, grid: new Map() });
    add(chart, seed);
    grow(chart, [seed], .5);
  }
  // Fold small charts into an adjacent chart of the same region when every triangle fits there.
  for (const small of [...charts].sort((a, b) => a.triangles.length - b.triangles.length)) {
    if (small.triangles.length >= 24 || !small.triangles.length) continue;
    const candidates = new Set<number>();
    for (const t of small.triangles) for (const n of neighbors[t]) { const owner = assigned[n]; if (owner >= 0 && charts[owner] !== small && charts[owner].region === small.region) candidates.add(owner); }
    for (const owner of [...candidates].sort((a, b) => charts[b].triangles.length - charts[a].triangles.length)) {
      const target = charts[owner];
      if (!small.triangles.every(t => fits(target, t, .2))) continue;
      const moved = small.triangles.splice(0);
      for (const t of moved) add(target, t);
      break;
    }
  }
  return charts.filter(chart => chart.triangles.length > 0).map(orientChart);
}

/** Rotates a chart so its principal axis is horizontal, which tightens bounding boxes of slanted limbs. */
function orientChart(chart: Chart): Chart {
  const points = [...chart.uv.values()];
  const mean = points.reduce((acc, p) => [acc[0] + p[0] / points.length, acc[1] + p[1] / points.length], [0, 0]);
  let xx = 0, xy = 0, yy = 0;
  for (const [x, y] of points) { xx += (x - mean[0]) ** 2; xy += (x - mean[0]) * (y - mean[1]); yy += (y - mean[1]) ** 2; }
  const angle = .5 * Math.atan2(2 * xy, xx - yy);
  const c = Math.cos(-angle), s = Math.sin(-angle);
  const uv = new Map<number, [number, number]>();
  const min: [number, number] = [Infinity, Infinity], max: [number, number] = [-Infinity, -Infinity];
  for (const [vertex, [x, y]] of chart.uv) {
    const p: [number, number] = [(x - mean[0]) * c - (y - mean[1]) * s, (x - mean[0]) * s + (y - mean[1]) * c];
    uv.set(vertex, p);
    for (const axis of [0, 1]) { min[axis] = Math.min(min[axis], p[axis]); max[axis] = Math.max(max[axis], p[axis]); }
  }
  return { ...chart, uv, min, max };
}

/** Shelf-packs charts at the largest uniform scale (texels per metre) that fits; returns charts with pixel offsets. */
export function packCharts(charts: Chart[], size: number, gutter = 5): { charts: PackedChart[]; texelsPerMetre: number } {
  const attempt = (scale: number): PackedChart[] | null => {
    const order = charts.map((chart, index) => ({ chart, index, w: (chart.max[0] - chart.min[0]) * scale, h: (chart.max[1] - chart.min[1]) * scale }))
      .sort((a, b) => b.h - a.h || b.w - a.w || a.index - b.index);
    const placed: PackedChart[] = new Array(charts.length);
    let x = gutter, y = gutter, shelf = 0;
    for (const { chart, index, w, h } of order) {
      const width = Math.ceil(w) + 1, height = Math.ceil(h) + 1;
      if (x + width + gutter > size) { x = gutter; y += shelf + gutter; shelf = 0; }
      if (x + width + gutter > size || y + height + gutter > size) return null;
      placed[index] = { ...chart, offset: [x, y] };
      x += width + gutter; shelf = Math.max(shelf, height);
    }
    return placed;
  };
  let low = 10, high = 5000;
  for (let i = 0; i < 40; i++) { const mid = (low + high) / 2; if (attempt(mid)) low = mid; else high = mid; }
  return { charts: attempt(low)!, texelsPerMetre: low };
}
