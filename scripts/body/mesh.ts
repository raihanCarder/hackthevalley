import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export type Vec3 = [number, number, number];
export const SOURCE_PATH = "scripts/body/source/makehuman-hm08-base.obj";
export const SOURCE_SHA256 = "8e761e6624b8f54536409135d1636da63b32486a90d4897f84e121d144f6fb4c";
/** Final standing height in metres; keeps the existing camera framing (orbit target y = 1). */
export const BODY_HEIGHT = 1.96;

export interface SourceMesh {
  /** Welded vertex positions in metres: +Y up (feet at 0), +Z front, +X patient-left. */
  positions: Vec3[];
  /** Triangles as welded vertex indices, outward winding. */
  triangles: [number, number, number][];
  /** "body", "left-eye", or "right-eye" per triangle. */
  part: ("body" | "left-eye" | "right-eye")[];
  /** Skeleton joints (centroid of each MakeHuman joint helper), in the same space. */
  joints: Map<string, Vec3>;
  /** Original OBJ vertex index of each welded vertex (morph targets are indexed this way). */
  sourceIndex: number[];
  /** Metres per source unit (source offsets scale by this; translation does not apply to offsets). */
  scale: number;
}

const KEEP = new Map([["body", "body"], ["helper-l-eye", "left-eye"], ["helper-r-eye", "right-eye"]] as const);

export function loadSourceMesh(path = SOURCE_PATH): SourceMesh {
  const bytes = readFileSync(path);
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== SOURCE_SHA256) throw new Error(`Unexpected source mesh ${path} (sha256 ${digest}).`);
  const raw: Vec3[] = [];
  const faces: { group: string; vertices: number[] }[] = [];
  let group = "";
  for (const line of bytes.toString("utf8").split("\n")) {
    if (line.startsWith("v ")) raw.push(line.slice(2).trim().split(/\s+/).map(Number) as Vec3);
    else if (line.startsWith("g ")) group = line.slice(2).trim();
    else if (line.startsWith("f ")) faces.push({ group, vertices: line.slice(2).trim().split(/\s+/).map(token => Number(token.split("/")[0]) - 1) });
  }

  // Joints: centroid of each joint helper's vertices (in source units).
  const jointVertices = new Map<string, Set<number>>();
  for (const face of faces) if (face.group.startsWith("joint-")) {
    const set = jointVertices.get(face.group) ?? new Set<number>();
    face.vertices.forEach(index => set.add(index));
    jointVertices.set(face.group, set);
  }

  const kept = faces.filter(face => KEEP.has(face.group as never));
  const used = new Set(kept.flatMap(face => face.vertices));
  let minY = Infinity, maxY = -Infinity;
  for (const face of kept) if (face.group === "body") for (const index of face.vertices) { minY = Math.min(minY, raw[index][1]); maxY = Math.max(maxY, raw[index][1]); }
  const scale = BODY_HEIGHT / (maxY - minY);
  const transform = ([x, y, z]: Vec3): Vec3 => [x * scale, (y - minY) * scale, z * scale];

  const remap = new Map<number, number>();
  const positions: Vec3[] = [];
  const sourceIndex: number[] = [];
  for (const index of [...used].sort((a, b) => a - b)) { remap.set(index, positions.length); sourceIndex.push(index); positions.push(transform(raw[index])); }
  const triangles: [number, number, number][] = [];
  const part: SourceMesh["part"] = [];
  for (const face of kept) {
    const v = face.vertices.map(index => remap.get(index)!);
    const label = KEEP.get(face.group as never)!;
    if (v.length === 3) { triangles.push([v[0], v[1], v[2]]); part.push(label); continue; }
    // Quads: split along the shorter diagonal for even shading.
    const d02 = distance(positions[v[0]], positions[v[2]]), d13 = distance(positions[v[1]], positions[v[3]]);
    const pair: [number, number, number][] = d02 <= d13 ? [[v[0], v[1], v[2]], [v[0], v[2], v[3]]] : [[v[0], v[1], v[3]], [v[1], v[2], v[3]]];
    for (const triangle of pair) { triangles.push(triangle); part.push(label); }
  }
  const joints = new Map<string, Vec3>();
  for (const [name, set] of jointVertices) {
    const sum: Vec3 = [0, 0, 0];
    for (const index of set) for (let axis = 0; axis < 3; axis++) sum[axis] += raw[index][axis] / set.size;
    joints.set(name.slice("joint-".length), transform(sum));
  }
  return { positions, triangles, part, joints, sourceIndex, scale };
}

export const distance = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const scaleVec = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const normalize = (a: Vec3): Vec3 => { const length = Math.hypot(...a) || 1; return [a[0] / length, a[1] / length, a[2] / length]; };

/** Area-weighted smooth vertex normals over the welded mesh. */
export function vertexNormals(positions: Vec3[], triangles: [number, number, number][]): Vec3[] {
  const normals: Vec3[] = positions.map(() => [0, 0, 0]);
  for (const [a, b, c] of triangles) {
    const n = cross(sub(positions[b], positions[a]), sub(positions[c], positions[a]));
    for (const index of [a, b, c]) for (let axis = 0; axis < 3; axis++) normals[index][axis] += n[axis];
  }
  return normals.map(normalize);
}
