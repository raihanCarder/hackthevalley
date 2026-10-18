import * as THREE from "three";
import { REGION_IDS, type RegionId } from "../../src/domain/contracts";
import { surfaceHitNear } from "../../src/body/atlas";
import { uvToTexel } from "../../src/body/layers";
import { loadBodyAtlas } from "../../src/body/node-atlas";
import type { SurfaceHit } from "../../src/body/paint-engine";

export const atlas = loadBodyAtlas();
export const asset = atlas.asset;
const geometry = new THREE.BufferGeometry();
geometry.setAttribute("position", new THREE.Float32BufferAttribute(asset.positions, 3));
geometry.setAttribute("uv", new THREE.Float32BufferAttribute(asset.uvs, 2));
geometry.setIndex(asset.indices);
const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.FrontSide }));
const raycaster = new THREE.Raycaster();

export interface Hit extends SurfaceHit { texel: number; region: RegionId }
const regionOfTriangle = (t: number) => REGION_IDS[atlas.triangleRegion[t]];
/** Casts a ray through the real body mesh, exactly as the renderer does with a camera ray. */
export function raycast(origin: [number, number, number], direction: [number, number, number]): Hit | null {
  raycaster.set(new THREE.Vector3(...origin), new THREE.Vector3(...direction).normalize());
  const hit = raycaster.intersectObject(mesh, false)[0];
  if (!hit?.face || !hit.uv || hit.faceIndex == null) return null;
  return { point: [hit.point.x, hit.point.y, hit.point.z], triangle: hit.faceIndex, texel: uvToTexel(hit.uv.x, hit.uv.y), region: regionOfTriangle(hit.faceIndex) };
}
/** A ray from a front camera (+Z) toward the body at model-space x/y. */
export const fromFront = (x: number, y: number) => raycast([x, y, 5], [0, 0, -1]);
export const fromBack = (x: number, y: number) => raycast([x, y, -5], [0, 0, 1]);
/** Surface sample at a named landmark of the body asset. */
export function landmark(name: string): Hit {
  const mark = asset.landmarks[name];
  if (!mark) throw new Error(`Unknown landmark ${name}.`);
  const hit = surfaceHitNear(atlas, mark.point);
  // Prefer a triangle of the landmark's own region among those sharing the vertex (boundary vertices touch several).
  const welded = atlas.triangles[hit.triangle * 3] === undefined ? -1 : [0, 1, 2].map(k => atlas.triangles[hit.triangle * 3 + k])
    .find(v => atlas.vertices[v * 3] === hit.point[0] && atlas.vertices[v * 3 + 1] === hit.point[1] && atlas.vertices[v * 3 + 2] === hit.point[2]) ?? -1;
  if (welded >= 0) for (let i = atlas.vertexTriangleStart[welded]; i < atlas.vertexTriangleStart[welded + 1]; i++) {
    const t = atlas.vertexTriangles[i];
    if (regionOfTriangle(t) === mark.regionId) return { point: hit.point, triangle: t, texel: -1, region: mark.regionId };
  }
  return { ...hit, texel: -1, region: regionOfTriangle(hit.triangle) };
}
export function paintedTexels(layer: Uint8Array, threshold = 13) { let count = 0; for (const value of layer) if (value >= threshold) count++; return count; }
export function regionPainted(layer: Uint8Array, region: RegionId) {
  const index = REGION_IDS.indexOf(region);
  let count = 0;
  for (let texel = 0; texel < layer.length; texel++) if (layer[texel] >= 13 && atlas.regionOf[texel] === index) count++;
  return count;
}
/** Interpolated surface normal of a valid texel. */
export function texelNormal(texel: number): [number, number, number] {
  const t = atlas.triangleOf[texel];
  const n: [number, number, number] = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    const v = asset.indices[t * 3 + k], w = atlas.bary[texel * 3 + k];
    for (let axis = 0; axis < 3; axis++) n[axis] += asset.normals[v * 3 + axis] * w;
  }
  const length = Math.hypot(...n) || 1;
  return [n[0] / length, n[1] / length, n[2] / length];
}
