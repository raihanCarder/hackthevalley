import { BODY_MAP_VERSION, MAP_SIZE, REGION_IDS, type RegionId } from "../domain/contracts";
import { TEXEL_COUNT } from "./layers";
import { generateMannequin, type BodyIsland, type MannequinAsset } from "./mannequin";

/**
 * Versioned region-ID atlas and per-texel surface data for `mannequin-v1`.
 * Pure data: no DOM, WebGL, or renderer imports, so server code can use it.
 */
export interface BodyAtlas {
  bodyMapVersion: typeof BODY_MAP_VERSION;
  islands: BodyIsland[];
  /** Island ID per texel, -1 where no triangle covers the texel centre (gutters, collapsed pole halves). */
  islandOf: Int16Array;
  /** Index into REGION_IDS per texel, -1 for invalid texels. */
  regionOf: Int8Array;
  /** Model-space surface position and unit normal per valid texel (xyz triples). */
  position: Float32Array;
  normal: Float32Array;
  islandTexels: Uint32Array[];
  islandBox: Float32Array[];
  /** Islands of the same component that share a seam, e.g. calf front/back or the four torso patches. */
  seamNeighbors: number[][];
  regionTexelCount: Uint32Array;
  /** Display-only gutter fill: pairs of [invalid texel, nearest valid texel] within two texels of an island. */
  gutterFill: Uint32Array;
}

export function buildBodyAtlas(asset: MannequinAsset): BodyAtlas {
  if (asset.bodyMapVersion !== BODY_MAP_VERSION || asset.mapSize !== MAP_SIZE) throw new Error("Unsupported body asset version.");
  const islandOf = new Int16Array(TEXEL_COUNT).fill(-1);
  const position = new Float32Array(TEXEL_COUNT * 3);
  const normal = new Float32Array(TEXEL_COUNT * 3);
  const vertexIsland = new Int16Array(asset.positions.length / 3).fill(-1);
  for (const island of asset.islands) vertexIsland.fill(island.id, island.vertexStart, island.vertexStart + island.vertexCount);

  for (let i = 0; i < asset.indices.length; i += 3) {
    const a = asset.indices[i], b = asset.indices[i + 1], c = asset.indices[i + 2];
    const island = vertexIsland[a];
    if (island < 0 || vertexIsland[b] !== island || vertexIsland[c] !== island) throw new Error("A triangle crosses UV islands.");
    // Pixel space: x = u * size, y = (1 - v) * size; texel centres sit at +0.5.
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
        islandOf[texel] = island;
        const la = wa / area, lb = wb / area, lc = wc / area;
        let length = 0;
        for (let axis = 0; axis < 3; axis++) {
          position[texel * 3 + axis] = asset.positions[a * 3 + axis] * la + asset.positions[b * 3 + axis] * lb + asset.positions[c * 3 + axis] * lc;
          const n = asset.normals[a * 3 + axis] * la + asset.normals[b * 3 + axis] * lb + asset.normals[c * 3 + axis] * lc;
          normal[texel * 3 + axis] = n;
          length += n * n;
        }
        length = Math.sqrt(length) || 1;
        for (let axis = 0; axis < 3; axis++) normal[texel * 3 + axis] /= length;
      }
    }
  }

  const regionIndex = new Map<RegionId, number>(REGION_IDS.map((id, index) => [id, index]));
  const regionOf = new Int8Array(TEXEL_COUNT).fill(-1);
  const regionTexelCount = new Uint32Array(REGION_IDS.length);
  const texelLists: number[][] = asset.islands.map(() => []);
  for (let texel = 0; texel < TEXEL_COUNT; texel++) {
    const island = islandOf[texel];
    if (island < 0) continue;
    const region = regionIndex.get(asset.islands[island].regionId)!;
    regionOf[texel] = region;
    regionTexelCount[region]++;
    texelLists[island].push(texel);
  }
  const islandTexels = texelLists.map(list => Uint32Array.from(list));
  const islandBox = islandTexels.map(texels => {
    const box = new Float32Array([Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]);
    for (const texel of texels) for (let axis = 0; axis < 3; axis++) {
      box[axis] = Math.min(box[axis], position[texel * 3 + axis]);
      box[axis + 3] = Math.max(box[axis + 3], position[texel * 3 + axis]);
    }
    return box;
  });
  const seamNeighbors = asset.islands.map(island => asset.islands.filter(other => other.id !== island.id && other.part === island.part).map(other => other.id));

  return { bodyMapVersion: BODY_MAP_VERSION, islands: asset.islands, islandOf, regionOf, position, normal, islandTexels, islandBox, seamNeighbors, regionTexelCount, gutterFill: buildGutterFill(islandOf) };
}

function buildGutterFill(islandOf: Int16Array): Uint32Array {
  const source = new Int32Array(TEXEL_COUNT).fill(-1);
  for (let texel = 0; texel < TEXEL_COUNT; texel++) if (islandOf[texel] >= 0) source[texel] = texel;
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

let defaultAtlas: BodyAtlas | undefined;
/** The atlas for the checked-in mannequin, built from the same reproducible generator as `public/body/mannequin-v1.json`. */
export function getBodyAtlas(): BodyAtlas {
  defaultAtlas ??= buildBodyAtlas(generateMannequin());
  return defaultAtlas;
}

/** Region raster for export/inspection: byte 0 is invalid, otherwise REGION_IDS index + 1. */
export function regionIdRaster(atlas: BodyAtlas = getBodyAtlas()): Uint8Array {
  const raster = new Uint8Array(TEXEL_COUNT);
  for (let texel = 0; texel < TEXEL_COUNT; texel++) raster[texel] = atlas.regionOf[texel] + 1;
  return raster;
}
