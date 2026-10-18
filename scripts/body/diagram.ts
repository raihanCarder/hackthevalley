import { REGION_IDS, type RegionId } from "../../src/domain/contracts";
import type { DiagramView } from "../../src/body/diagram";
import type { Vec3 } from "./mesh";
import { orthoView, renderLabels, type LabelImage } from "./raster";

/**
 * Builds the 2D body diagram from the same mesh and region labels as the 3D body: each view is an orthographic
 * render of region labels, traced into one outline path per region, so the 2D and 3D maps always agree.
 */
export interface DiagramSpec { id: string; label: string; toward: Vec3; up: Vec3; center: [number, number] | Vec3; size: [number, number]; width: number; note?: string; include?: (region: RegionId) => boolean }

export function buildDiagramView(spec: DiagramSpec, positions: Vec3[], triangles: [number, number, number][], regions: RegionId[]): DiagramView {
  let center = spec.center as [number, number];
  if (spec.center.length === 3) {
    // Centre on a model-space point.
    const probe = orthoView(spec.toward, spec.up, [0, 0], [1, 1], 4);
    const p = spec.center as Vec3;
    center = [p[0] * probe.right[0] + p[1] * probe.right[1] + p[2] * probe.right[2], p[0] * probe.up[0] + p[1] * probe.up[1] + p[2] * probe.up[2]];
  }
  const view = orthoView(spec.toward, spec.up, center, spec.size, spec.width);
  // Close-up views render only their own regions, so nothing else (the shin above a foot, the other hand) occludes them.
  const keep = triangles.map((_, t) => !spec.include || spec.include(regions[t]));
  const image = renderLabels(view, positions, triangles.filter((_, t) => keep[t]), regions.filter((_, t) => keep[t]).map(region => REGION_IDS.indexOf(region)));
  const present = [...new Set(Array.from(image.label).filter(value => value >= 0))].sort((a, b) => a - b);
  return {
    id: spec.id, label: spec.label, note: spec.note, width: image.width, height: image.height,
    outline: tracePath(image, value => value >= 0),
    regions: present.map(index => ({ regionId: REGION_IDS[index], d: tracePath(image, value => value === index) })),
  };
}

/** Traces pixel-boundary loops of a mask, simplifies them, and returns one SVG path (even-odd fill keeps holes). */
function tracePath(image: LabelImage, inside: (label: number) => boolean): string {
  const { width, height, label } = image;
  const at = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height && inside(label[y * width + x]);
  // Directed boundary edges with the region on the right (y grows downward).
  const edges = new Map<string, [number, number][]>();
  const addEdge = (x0: number, y0: number, x1: number, y1: number) => {
    const key = `${x0},${y0}`;
    edges.set(key, [...(edges.get(key) ?? []), [x1, y1]]);
  };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (!at(x, y)) continue;
    if (!at(x, y - 1)) addEdge(x, y, x + 1, y);
    if (!at(x + 1, y)) addEdge(x + 1, y, x + 1, y + 1);
    if (!at(x, y + 1)) addEdge(x + 1, y + 1, x, y + 1);
    if (!at(x - 1, y)) addEdge(x, y + 1, x, y);
  }
  const loops: [number, number][][] = [];
  for (const startKey of [...edges.keys()].sort()) {
    while (edges.get(startKey)?.length) {
      const [sx, sy] = startKey.split(",").map(Number);
      const loop: [number, number][] = [[sx, sy]];
      let key = startKey;
      for (let guard = 0; guard < width * height * 4; guard++) {
        const list = edges.get(key);
        if (!list?.length) break;
        const [nx, ny] = list.shift()!;
        key = `${nx},${ny}`;
        if (nx === sx && ny === sy) break;
        loop.push([nx, ny]);
      }
      if (loop.length >= 3) loops.push(simplify(loop, .7));
    }
  }
  return loops.filter(loop => loop.length >= 3).map(loop => `M${loop.map(([x, y]) => `${x} ${y}`).join("L")}Z`).join("");
}

/** Ramer–Douglas–Peucker on a closed loop. */
function simplify(points: [number, number][], tolerance: number): [number, number][] {
  if (points.length <= 4) return points;
  const reduce = (from: number, to: number, keep: boolean[]) => {
    const [ax, ay] = points[from], [bx, by] = points[to % points.length];
    let worst = -1, index = -1;
    for (let i = from + 1; i < to; i++) {
      const [px, py] = points[i];
      const length = Math.hypot(bx - ax, by - ay);
      const d = length ? Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / length : Math.hypot(px - ax, py - ay);
      if (d > worst) { worst = d; index = i; }
    }
    if (worst > tolerance) { keep[index] = true; reduce(from, index, keep); reduce(index, to, keep); }
  };
  const keep = points.map(() => false);
  const far = points.reduce((best, p, i) => Math.hypot(p[0] - points[0][0], p[1] - points[0][1]) > Math.hypot(points[best][0] - points[0][0], points[best][1] - points[0][1]) ? i : best, 0);
  keep[0] = keep[far] = true;
  reduce(0, far, keep);
  reduce(far, points.length, keep);
  return points.filter((_, i) => keep[i]);
}
