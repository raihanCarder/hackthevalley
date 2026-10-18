import { cross, distance, sub, type SourceMesh, type Vec3 } from "./mesh";

/**
 * Nipple and areola vertices (right side, then left) of the pinned hm08 source mesh: exactly the vertices moved by
 * MakeHuman's CC0 breast/nipple-point and breast/nipple-size targets at the same commit. The targets themselves are
 * never applied; they only locate the area. Indices are stable because the source mesh is pinned by SHA-256.
 */
export const NIPPLE_SOURCE_RANGES = [[1778, 1809], [8450, 8481]] as const;
/** Gaussian blur width (metres on the source mesh): about the size of the nipple and areola, far smaller than the chest. */
const SIGMA = .01;
/** The blur applies fully within the inner distance of each nipple's centre and fades out by the outer one. */
const BLEND_RADII = { inner: .015, outer: .04 } as const;
/** The body-shape chest cap is full within this distance (metres) of each nipple and fades out smoothly by the outer one. */
export const CHEST_CAP_RADII = { inner: .1, outer: .22 } as const;

const smoothstep = (t: number) => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); };

/**
 * The MakeHuman base mesh and its sex/age targets model nipples. The figure is a neutral mannequin, so both generators
 * pass the base positions and every shape morph through this one fixed linear filter: because it is linear, the sum
 * (default figure plus any slider blend) is smooth too, on every body shape.
 *
 * Around each nipple the surface is replaced by an area-weighted Gaussian blur over true distance, which removes
 * centimetre-scale bumps but barely changes the much broader chest curve. Measuring by distance and area (not by mesh
 * neighbours) matters: the nipple is a very dense patch of tiny triangles inside much coarser skin. Only positions
 * move: triangles, UVs, regions, and maps are unaffected.
 */
export function chestSmoother(mesh: SourceMesh) {
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

  // Surface area each vertex stands for (a third of its triangles).
  const area = new Float64Array(mesh.positions.length);
  for (const [a, b, c] of mesh.triangles) {
    const third = Math.hypot(...cross(sub(mesh.positions[b], mesh.positions[a]), sub(mesh.positions[c], mesh.positions[a]))) / 6;
    area[a] += third; area[b] += third; area[c] += third;
  }
  const reach = BLEND_RADII.outer + 3 * SIGMA;
  const nearby = mesh.positions.flatMap((position, v) => centers.some(center => distance(position, center) < reach) ? [v] : []);
  // For each blended vertex: its blend strength and normalised kernel over nearby surface.
  const kernels = nearby.flatMap(v => {
    const d = Math.min(...centers.map(center => distance(mesh.positions[v], center)));
    const blend = smoothstep((BLEND_RADII.outer - d) / (BLEND_RADII.outer - BLEND_RADII.inner));
    if (!blend) return [];
    const terms: [number, number][] = [];
    let total = 0;
    for (const u of nearby) {
      const r = distance(mesh.positions[u], mesh.positions[v]);
      if (r > 3 * SIGMA) continue;
      const k = Math.exp(-(r * r) / (2 * SIGMA * SIGMA)) * area[u];
      terms.push([u, k]); total += k;
    }
    return [{ v, blend, terms: terms.map(([u, k]) => [u, k / total] as [number, number]) }];
  });

  /** Blurs both nipple areas of a dense welded xyz field (positions or morph offsets) and returns a new array. */
  const smooth = (field: Float64Array): Float64Array => {
    const out = Float64Array.from(field);
    for (const { v, blend, terms } of kernels) for (let axis = 0; axis < 3; axis++) {
      let blurred = 0;
      for (const [u, k] of terms) blurred += k * field[u * 3 + axis];
      out[v * 3 + axis] = field[v * 3 + axis] + blend * (blurred - field[v * 3 + axis]);
    }
    return out;
  };
  return { centers, smooth };
}
