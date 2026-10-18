import type { RegionId } from "../../src/domain/contracts";
import { dot, sub, type SourceMesh, type Vec3 } from "./mesh";

/**
 * Assigns every triangle of the source mesh to one stable, patient-relative region.
 * Limbs, hands, fingers, feet, and toes use the nearest labelled bone segment of the MakeHuman skeleton.
 * Torso, pelvis, neck, and head use anatomical height/front-back planes; facial features use small volumes
 * around the eyelids, nose, lips, and ears. All rules are deterministic and documented in docs/body-contract.md.
 */
type Side = "left" | "right";
interface Bone { a: Vec3; b: Vec3; region: RegionId | "torso" | "head" | "neck" }

const FINGERS = ["thumb", "index-finger", "middle-finger", "ring-finger", "little-finger"] as const;
const TOES = ["big-toe", "second-toe", "third-toe", "fourth-toe", "little-toe"] as const;

function bones(mesh: SourceMesh): Bone[] {
  const j = (name: string) => { const value = mesh.joints.get(name); if (!value) throw new Error(`Missing joint ${name}.`); return value; };
  const list: Bone[] = [];
  const chain = (names: string[], region: Bone["region"]) => { for (let i = 0; i < names.length - 1; i++) list.push({ a: j(names[i]), b: j(names[i + 1]), region }); };
  chain(["pelvis", "spine-4", "spine-3", "spine-2", "spine-1", "neck"], "torso");
  chain(["neck", "head"], "neck");
  chain(["head", "head-2"], "head");
  chain(["head", "jaw"], "head");
  for (const side of ["left", "right"] as Side[]) {
    const s = side === "left" ? "l" : "r";
    chain([`${s}-clavicle`, `${s}-shoulder`], "torso");
    chain([`${s}-shoulder`, `${s}-elbow`], `${side}-upper-arm`);
    chain([`${s}-elbow`, `${s}-hand`], `${side}-forearm`);
    chain([`${s}-hand`, `${s}-hand-2`], `${side}-hand`);
    chain([`${s}-hand`, `${s}-hand-3`], `${side}-hand`);
    chain([`${s}-hand-3`, `${s}-finger-1-1`, `${s}-finger-1-2`], `${side}-hand`);
    for (let n = 2; n <= 5; n++) chain([`${s}-hand-2`, `${s}-finger-${n}-1`], `${side}-hand`);
    chain([`${s}-finger-1-2`, `${s}-finger-1-3`, `${s}-finger-1-4`], `${side}-thumb`);
    for (let n = 2; n <= 5; n++) chain([1, 2, 3, 4].map(k => `${s}-finger-${n}-${k}`), `${side}-${FINGERS[n - 1]}`);
    chain([`${s}-upper-leg`, `${s}-knee`], `${side}-thigh`);
    chain([`${s}-knee`, `${s}-ankle`], `${side}-calf`);
    chain([`${s}-ankle`, `${s}-foot-1`], `${side}-foot`);
    for (let n = 1; n <= 5; n++) chain([`${s}-ankle`, `${s}-toe-${n}-1`], `${side}-foot`);
    chain([`${s}-toe-1-1`, `${s}-toe-1-2`, `${s}-toe-1-3`], `${side}-big-toe`);
    for (let n = 2; n <= 5; n++) chain([1, 2, 3, 4].map(k => `${s}-toe-${n}-${k}`), `${side}-${TOES[n - 1]}`);
  }
  return list;
}

function segmentDistance(p: Vec3, bone: Bone) {
  const ab = sub(bone.b, bone.a);
  const t = Math.max(0, Math.min(1, dot(sub(p, bone.a), ab) / (dot(ab, ab) || 1)));
  return Math.hypot(p[0] - bone.a[0] - ab[0] * t, p[1] - bone.a[1] - ab[1] * t, p[2] - bone.a[2] - ab[2] * t);
}

/** Region for one body vertex. Exported for inspection and tests. */
export function vertexRegion(p: Vec3, mesh: SourceMesh, skeleton: Bone[]): RegionId {
  const j = (name: string) => mesh.joints.get(name)!;
  const [x, y, z] = p;
  const side: Side = x >= 0 ? "left" : "right";
  const s = side === "left" ? "l" : "r";
  const ax = Math.abs(x);

  // Facial features first: eyelids, nose, lips, ears.
  const lid = j(`${s}-upperlid`), lower = j(`${s}-lowerlid`);
  const eye: Vec3 = [(lid[0] + lower[0]) / 2, (lid[1] + lower[1]) / 2, (lid[2] + lower[2]) / 2];
  if (((x - eye[0]) / .021) ** 2 + ((y - eye[1]) / .013) ** 2 < 1 && z > eye[2] - .03) return `${side}-eye`;
  const head = j("head");
  if (y > 1.755 && y < 1.83 && ax > .064 && z > head[2] - .045 && z < head[2] + .05) return `${side}-ear`;
  if (y > 1.768 && y < 1.83 && ax < .013 + (1.83 - y) * .3 && z > .175) return "nose";
  if (((x / .03) ** 2 + ((y - 1.733) / .018) ** 2) < 1 && z > .16) return "mouth";

  let best = skeleton[0], bestDistance = Infinity;
  for (const bone of skeleton) {
    const d = segmentDistance(p, bone);
    if (d < bestDistance) { bestDistance = d; best = bone; }
  }
  let region = best.region;

  // Head/neck boundary follows the jawline (lower at the chin, higher at the nape); the neck meets the torso
  // at the base of the throat in front and at the base of the skull behind.
  if (region === "head" || region === "neck" || (region === "torso" && y > 1.55)) {
    if (y > 1.725 - .28 * z) return "head";
    if (y > 1.62 - .3 * z && ax < .085) return "neck";
    region = "torso";
  }
  if (region === `${side}-upper-arm` || region === "torso") {
    // Deltoid and armpit belong to the upper arm beyond the shoulder joint.
    const shoulder = j(`${s}-shoulder`), elbow = j(`${s}-elbow`);
    const axis = sub(elbow, shoulder);
    const t = dot(sub(p, shoulder), axis) / dot(axis, axis);
    const closest = [shoulder[0] + axis[0] * t, shoulder[1] + axis[1] * t, shoulder[2] + axis[2] * t];
    const radial = Math.hypot(x - closest[0], y - closest[1], z - closest[2]);
    if (region === "torso" && t > .02 && radial < .068) region = `${side}-upper-arm`;
    if (region === `${side}-upper-arm` && (t < -.02 || (t < .25 && radial > .075))) region = "torso";
  }
  if (region === `${side}-thigh`) {
    // Groin crease in front, gluteal fold behind: above it is the pelvis.
    const crease = z >= 0 ? .93 + .45 * Math.max(0, ax - .05) : .87 + .3 * Math.max(0, ax - .05);
    if (y > crease) region = "torso";
  }
  if (region === `${side}-calf` && y < j(`${s}-ankle`)[1]) region = `${side}-foot`;
  if (region === "torso") {
    if (y < 1.13) return "pelvis";
    const front = z > .018;
    return y > 1.36 ? (front ? "front-upper-torso" : "back-upper-torso") : (front ? "front-lower-torso" : "back-lower-torso");
  }
  return region as RegionId;
}

export function classifyTriangles(mesh: SourceMesh): RegionId[] {
  const skeleton = bones(mesh);
  const vertex = mesh.positions.map(p => vertexRegion(p, mesh, skeleton));
  let regions = mesh.triangles.map((triangle, index) => {
    if (mesh.part[index] !== "body") return mesh.part[index] as RegionId;
    // Majority of the three corners; ties go to the first corner.
    const [a, b, c] = triangle.map(i => vertex[i]);
    return b === c ? b : a;
  });
  // Smooth jagged boundaries: two passes of a majority filter over edge-adjacent body triangles.
  const edgeOwners = new Map<string, number[]>();
  mesh.triangles.forEach((triangle, index) => {
    for (let k = 0; k < 3; k++) {
      const [u, v] = [triangle[k], triangle[(k + 1) % 3]].sort((m, n) => m - n);
      const key = `${u}:${v}`;
      edgeOwners.set(key, [...(edgeOwners.get(key) ?? []), index]);
    }
  });
  const neighbors = mesh.triangles.map(() => [] as number[]);
  for (const owners of edgeOwners.values()) for (const a of owners) for (const b of owners) if (a !== b) neighbors[a].push(b);
  for (let pass = 0; pass < 2; pass++) {
    regions = regions.map((region, index) => {
      if (mesh.part[index] !== "body") return region;
      const votes = new Map<RegionId, number>([[region, 1]]);
      for (const other of neighbors[index]) if (mesh.part[other] === "body") votes.set(regions[other], (votes.get(regions[other]) ?? 0) + 1);
      let best = region, count = 1;
      for (const [candidate, n] of votes) if (n > count) { best = candidate; count = n; }
      return count >= 3 ? best : region;
    });
  }
  return regions;
}
