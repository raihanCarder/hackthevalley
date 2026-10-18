import { distance, type SourceMesh, type Vec3 } from "./mesh";

/**
 * Nipple and areola vertices (right side, then left) of the pinned hm08 source mesh: exactly the vertices moved by
 * MakeHuman's CC0 breast/nipple-point and breast/nipple-size targets at the same commit. The targets themselves are
 * never applied; they only locate the area. Indices are stable because the source mesh is pinned by SHA-256.
 */
export const NIPPLE_SOURCE_RANGES = [[1778, 1809], [8450, 8481]] as const;
/** Surface within this distance (metres) of each nipple is smoothed; the effect fades out towards the edge. */
const RADIUS = .06;
/** The body-shape chest cap is full within this distance (metres) of each nipple and fades out smoothly by the outer one. */
export const CHEST_CAP_RADII = { inner: .1, outer: .22 } as const;
/** Laplacian passes; with the falloff below this fills the nipple in while the wider chest keeps its shape. */
const PASSES = 600;
const STEP = .5;

/**
 * The MakeHuman base mesh and its sex/age targets model nipples. The figure is a neutral mannequin, so both generators
 * pass the base positions and every shape morph through this one fixed linear filter: because it is linear, the sum
 * (default figure plus any slider blend) is smooth too, on every body shape. Only positions move: triangles, UVs,
 * regions, and maps are unaffected.
 */
export function chestSmoother(mesh: SourceMesh) {
  const count = mesh.positions.length;
  const neighbors = mesh.positions.map(() => new Set<number>());
  for (const [a, b, c] of mesh.triangles) { neighbors[a].add(b).add(c); neighbors[b].add(a).add(c); neighbors[c].add(a).add(b); }
  // Each nipple's centre: the centroid of that side's nipple and areola vertices.
  const welded = new Map(mesh.sourceIndex.map((source, v) => [source, v]));
  const centers: Vec3[] = NIPPLE_SOURCE_RANGES.map(([first, last]) => {
    const sum: Vec3 = [0, 0, 0];
    for (let source = first; source <= last; source++) {
      const v = welded.get(source);
      if (v === undefined) throw new Error(`Nipple vertex ${source} is missing from the source mesh.`);
      for (let axis = 0; axis < 3; axis++) sum[axis] += mesh.positions[v][axis] / (last - first + 1);
    }
    return sum;
  });

  const weights = new Map<number, number>();
  for (let v = 0; v < count; v++) {
    const d = Math.min(...centers.map(center => distance(mesh.positions[v], center)));
    if (d < RADIUS) weights.set(v, (1 - (d / RADIUS) ** 2) ** 2);
  }
  const affected = [...weights.keys()];

  /** Smooths a dense welded xyz field (positions or morph offsets) and returns a new array. */
  const smooth = (field: Float64Array): Float64Array => {
    let current = Float64Array.from(field);
    for (let pass = 0; pass < PASSES; pass++) {
      const next = Float64Array.from(current);
      for (const v of affected) {
        const ring = neighbors[v], w = STEP * weights.get(v)!;
        for (let axis = 0; axis < 3; axis++) {
          let mean = 0;
          for (const n of ring) mean += current[n * 3 + axis];
          next[v * 3 + axis] += w * (mean / ring.size - current[v * 3 + axis]);
        }
      }
      current = next;
    }
    return current;
  };
  return { centers, smooth };
}
