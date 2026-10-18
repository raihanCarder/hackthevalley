import { BODY_MAP_VERSION, MAP_SIZE, REGION_IDS, type RegionId } from "../domain/contracts";
import { TEXEL_COUNT } from "./layers";
import type { MannequinAsset } from "./mannequin";
import type { SurfaceHit } from "./paint-engine";

/** The region raster used by the shared reducer: REGION_IDS index per texel (-1 invalid) and valid texels per region. */
export interface RegionRaster { regionOf: Int8Array; regionTexelCount: Uint32Array }

/**
 * Per-texel surface data and welded surface topology for the current body asset. Pure data: no DOM, WebGL, or
 * renderer imports. Painting uses it to measure geodesic distance on the welded mesh, so marks spread along the skin
 * and never jump across a gap (between fingers, from an ear to the scalp behind it, front to back of a hand).
 */
export interface BodyAtlas extends RegionRaster {
  bodyMapVersion: typeof BODY_MAP_VERSION;
  asset: MannequinAsset;
  /** Render triangle covering each texel centre, -1 for gutters and unused texels. */
  triangleOf: Int32Array;
  /** Barycentric weights of each valid texel within its triangle (3 per texel). */
  bary: Float32Array;
  triangleCount: number;
  /** Welded vertex indices per render triangle (3 per triangle). */
  triangles: Uint32Array;
  /** Welded vertex positions (3 per vertex). */
  vertices: Float32Array;
  vertexCount: number;
  /** CSR adjacency: welded neighbours with edge lengths. */
  neighborStart: Uint32Array;
  neighbors: Uint32Array;
  edgeLength: Float32Array;
  /** CSR: triangles incident to each welded vertex. */
  vertexTriangleStart: Uint32Array;
  vertexTriangles: Uint32Array;
  /** CSR: valid texels of each triangle. */
  triangleTexelStart: Uint32Array;
  triangleTexels: Uint32Array;
  /** REGION_IDS index per render triangle. */
  triangleRegion: Uint8Array;
  /** Display-only gutter fill: pairs of [invalid texel, nearest valid texel] within two texels of a chart. */
  gutterFill: Uint32Array;
}

export function buildBodyAtlas(asset: MannequinAsset): BodyAtlas {
  if (asset.bodyMapVersion !== BODY_MAP_VERSION || asset.mapSize !== MAP_SIZE) throw new Error("Unsupported body asset version.");
  const triangleCount = asset.indices.length / 3;
  const regionIndex = new Map<RegionId, number>(REGION_IDS.map((id, index) => [id, index]));
  const triangleRegion = new Uint8Array(triangleCount);
  for (const chart of asset.charts) {
    const region = regionIndex.get(chart.regionId);
    if (region === undefined) throw new Error(`Unknown region ${chart.regionId} in body asset.`);
    triangleRegion.fill(region, chart.triangleStart, chart.triangleStart + chart.triangleCount);
  }

  // Rasterize every triangle into its chart with texel-centre sampling.
  const triangleOf = new Int32Array(TEXEL_COUNT).fill(-1);
  const bary = new Float32Array(TEXEL_COUNT * 3);
  for (let t = 0; t < triangleCount; t++) {
    const [a, b, c] = [asset.indices[t * 3], asset.indices[t * 3 + 1], asset.indices[t * 3 + 2]];
    const ax = asset.uvs[a * 2] * MAP_SIZE, ay = (1 - asset.uvs[a * 2 + 1]) * MAP_SIZE;
    const bx = asset.uvs[b * 2] * MAP_SIZE, by = (1 - asset.uvs[b * 2 + 1]) * MAP_SIZE;
    const cx = asset.uvs[c * 2] * MAP_SIZE, cy = (1 - asset.uvs[c * 2 + 1]) * MAP_SIZE;
    const area = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
    if (Math.abs(area) < 1e-12) continue;
    const epsilon = -1e-6 * Math.abs(area);
    const minColumn = Math.max(0, Math.ceil(Math.min(ax, bx, cx) - .5)), maxColumn = Math.min(MAP_SIZE - 1, Math.floor(Math.max(ax, bx, cx) - .5));
    const minRow = Math.max(0, Math.ceil(Math.min(ay, by, cy) - .5)), maxRow = Math.min(MAP_SIZE - 1, Math.floor(Math.max(ay, by, cy) - .5));
    for (let row = minRow; row <= maxRow; row++) {
      const y = row + .5;
      for (let column = minColumn; column <= maxColumn; column++) {
        const x = column + .5;
        const wa = (bx - x) * (cy - y) - (cx - x) * (by - y);
        const wb = (cx - x) * (ay - y) - (ax - x) * (cy - y);
        const wc = area - wa - wb;
        if (area > 0 ? (wa < epsilon || wb < epsilon || wc < epsilon) : (wa > -epsilon || wb > -epsilon || wc > -epsilon)) continue;
        const texel = row * MAP_SIZE + column;
        triangleOf[texel] = t;
        bary[texel * 3] = wa / area; bary[texel * 3 + 1] = wb / area; bary[texel * 3 + 2] = wc / area;
      }
    }
  }

  // Welded topology.
  let vertexCount = 0;
  for (const w of asset.weld) vertexCount = Math.max(vertexCount, w + 1);
  const vertices = new Float32Array(vertexCount * 3);
  asset.weld.forEach((w, render) => { for (let axis = 0; axis < 3; axis++) vertices[w * 3 + axis] = asset.positions[render * 3 + axis]; });
  const triangles = new Uint32Array(triangleCount * 3);
  for (let i = 0; i < triangles.length; i++) triangles[i] = asset.weld[asset.indices[i]];
  const vertexTriangleStart = csrStart(vertexCount, function* () { for (let i = 0; i < triangles.length; i++) yield triangles[i]; });
  const vertexTriangles = new Uint32Array(triangles.length);
  {
    const cursor = vertexTriangleStart.slice(0, vertexCount);
    for (let i = 0; i < triangles.length; i++) vertexTriangles[cursor[triangles[i]]++] = Math.floor(i / 3);
  }
  const edgeSets: Set<number>[] = Array.from({ length: vertexCount }, () => new Set());
  for (let t = 0; t < triangleCount; t++) for (let k = 0; k < 3; k++) {
    const u = triangles[t * 3 + k], v = triangles[t * 3 + (k + 1) % 3];
    if (u !== v) { edgeSets[u].add(v); edgeSets[v].add(u); }
  }
  const neighborStart = new Uint32Array(vertexCount + 1);
  edgeSets.forEach((set, v) => { neighborStart[v + 1] = neighborStart[v] + set.size; });
  const neighbors = new Uint32Array(neighborStart[vertexCount]);
  const edgeLength = new Float32Array(neighbors.length);
  edgeSets.forEach((set, v) => {
    let i = neighborStart[v];
    for (const n of [...set].sort((p, q) => p - q)) {
      neighbors[i] = n;
      edgeLength[i++] = Math.hypot(vertices[v * 3] - vertices[n * 3], vertices[v * 3 + 1] - vertices[n * 3 + 1], vertices[v * 3 + 2] - vertices[n * 3 + 2]);
    }
  });

  const regionOf = new Int8Array(TEXEL_COUNT).fill(-1);
  const regionTexelCount = new Uint32Array(REGION_IDS.length);
  const triangleTexelStart = csrStart(triangleCount, function* () { for (let texel = 0; texel < TEXEL_COUNT; texel++) if (triangleOf[texel] >= 0) yield triangleOf[texel]; });
  const triangleTexels = new Uint32Array(triangleTexelStart[triangleCount]);
  {
    const cursor = triangleTexelStart.slice(0, triangleCount);
    for (let texel = 0; texel < TEXEL_COUNT; texel++) {
      const t = triangleOf[texel];
      if (t < 0) continue;
      triangleTexels[cursor[t]++] = texel;
      regionOf[texel] = triangleRegion[t];
      regionTexelCount[triangleRegion[t]]++;
    }
  }
  return {
    bodyMapVersion: BODY_MAP_VERSION, asset, triangleOf, bary, triangleCount, triangles, vertices, vertexCount,
    neighborStart, neighbors, edgeLength, vertexTriangleStart, vertexTriangles, triangleTexelStart, triangleTexels,
    triangleRegion, regionOf, regionTexelCount, gutterFill: buildGutterFill(triangleOf),
  };
}

function csrStart(count: number, keys: () => Generator<number>): Uint32Array {
  const start = new Uint32Array(count + 1);
  for (const key of keys()) start[key + 1]++;
  for (let i = 0; i < count; i++) start[i + 1] += start[i];
  return start;
}

function buildGutterFill(triangleOf: Int32Array): Uint32Array {
  const source = new Int32Array(TEXEL_COUNT).fill(-1);
  for (let texel = 0; texel < TEXEL_COUNT; texel++) if (triangleOf[texel] >= 0) source[texel] = texel;
  const offsets = [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]];
  const pairs: number[] = [];
  for (let pass = 0; pass < 2; pass++) {
    const next = source.slice();
    for (let row = 0; row < MAP_SIZE; row++) for (let column = 0; column < MAP_SIZE; column++) {
      const texel = row * MAP_SIZE + column;
      if (source[texel] >= 0) continue;
      for (const [dx, dy] of offsets) {
        const x = column + dx, y = row + dy;
        if (x < 0 || y < 0 || x >= MAP_SIZE || y >= MAP_SIZE) continue;
        const from = source[y * MAP_SIZE + x];
        if (from >= 0) { next[texel] = from; pairs.push(texel, from); break; }
      }
    }
    source.set(next);
  }
  return Uint32Array.from(pairs);
}

/** Model-space position of a valid texel. */
export function texelPosition(atlas: BodyAtlas, texel: number, out: [number, number, number] = [0, 0, 0]) {
  const t = atlas.triangleOf[texel];
  out[0] = out[1] = out[2] = 0;
  for (let k = 0; k < 3; k++) {
    const v = atlas.triangles[t * 3 + k], w = atlas.bary[texel * 3 + k];
    out[0] += atlas.vertices[v * 3] * w; out[1] += atlas.vertices[v * 3 + 1] * w; out[2] += atlas.vertices[v * 3 + 2] * w;
  }
  return out;
}

/** Region raster for export/inspection: byte 0 is invalid, otherwise REGION_IDS index + 1. */
export function regionIdRaster(raster: RegionRaster): Uint8Array {
  const out = new Uint8Array(TEXEL_COUNT);
  for (let texel = 0; texel < TEXEL_COUNT; texel++) out[texel] = raster.regionOf[texel] + 1;
  return out;
}

/** The surface sample at the welded vertex nearest a model-space point (used for landmarks and fixtures). */
export function surfaceHitNear(atlas: BodyAtlas, point: readonly [number, number, number]): SurfaceHit {
  let best = 0, bestDistance = Infinity;
  for (let v = 0; v < atlas.vertexCount; v++) {
    const d = (atlas.vertices[v * 3] - point[0]) ** 2 + (atlas.vertices[v * 3 + 1] - point[1]) ** 2 + (atlas.vertices[v * 3 + 2] - point[2]) ** 2;
    if (d < bestDistance) { bestDistance = d; best = v; }
  }
  return {
    point: [atlas.vertices[best * 3], atlas.vertices[best * 3 + 1], atlas.vertices[best * 3 + 2]],
    triangle: atlas.vertexTriangles[atlas.vertexTriangleStart[best]],
  };
}
