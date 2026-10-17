import * as THREE from "three";
import { generateMannequin } from "../../src/body/mannequin";
import { getBodyAtlas } from "../../src/body/atlas";
import { uvToTexel } from "../../src/body/layers";
import type { SurfaceHit } from "../../src/body/paint-engine";

export const asset = generateMannequin();
export const atlas = getBodyAtlas();
const geometry = new THREE.BufferGeometry();
geometry.setAttribute("position", new THREE.Float32BufferAttribute(asset.positions, 3));
geometry.setAttribute("uv", new THREE.Float32BufferAttribute(asset.uvs, 2));
geometry.setIndex(asset.indices);
const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.FrontSide }));
const raycaster = new THREE.Raycaster();
const vertexIsland = new Int16Array(asset.positions.length / 3);
for (const island of asset.islands) vertexIsland.fill(island.id, island.vertexStart, island.vertexStart + island.vertexCount);

export interface Hit extends SurfaceHit { texel: number }
/** Casts a ray through the real mannequin mesh, exactly as the renderer does with a camera ray. */
export function raycast(origin: [number, number, number], direction: [number, number, number]): Hit | null {
  raycaster.set(new THREE.Vector3(...origin), new THREE.Vector3(...direction).normalize());
  const hit = raycaster.intersectObject(mesh, false)[0];
  if (!hit?.face || !hit.uv) return null;
  return {
    point: [hit.point.x, hit.point.y, hit.point.z], normal: [hit.face.normal.x, hit.face.normal.y, hit.face.normal.z],
    island: vertexIsland[hit.face.a], texel: uvToTexel(hit.uv.x, hit.uv.y),
  };
}
/** A ray from a front camera (+Z) toward the body at model-space x/y. */
export const fromFront = (x: number, y: number) => raycast([x, y, 5], [0, 0, -1]);
export const fromBack = (x: number, y: number) => raycast([x, y, -5], [0, 0, 1]);
export const islandOf = (regionId: string, side: "front" | "back") => asset.islands.find(island => island.regionId === regionId && island.side === side)!.id;
export function paintedTexels(layer: Uint8Array, threshold = 13) { let count = 0; for (const value of layer) if (value >= threshold) count++; return count; }
export function islandPainted(layer: Uint8Array, island: number) { let count = 0; for (const texel of atlas.islandTexels[island]) if (layer[texel] >= 13) count++; return count; }
