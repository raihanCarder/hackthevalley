import type { BODY_MAP_VERSION, MAP_SIZE, RegionId } from "../domain/contracts";

/**
 * The checked-in body asset (`public/body/mannequin-v2.json`), produced by `npm run body:generate` from the CC0
 * MakeHuman base mesh. Render vertices are duplicated along UV chart seams; `weld` maps each one back to its
 * welded surface vertex so painting can measure distance across seams on the real surface.
 */
export type Vec3 = [number, number, number];
export interface BodyChart {
  id: number;
  regionId: RegionId;
  /** UV bounds [u0, v0, u1, v1], origin bottom-left. */
  bounds: [number, number, number, number];
  vertexStart: number;
  vertexCount: number;
  triangleStart: number;
  triangleCount: number;
}
export interface BodyLandmark { point: Vec3; normal: Vec3; regionId: RegionId }
export const FOCUS_TARGETS = ["face", "left-hand", "right-hand", "left-foot", "right-foot"] as const;
export type FocusTarget = (typeof FOCUS_TARGETS)[number];
export interface CameraFocus { target: Vec3; position: Vec3 }
export interface MannequinAsset {
  bodyMapVersion: typeof BODY_MAP_VERSION;
  mapSize: typeof MAP_SIZE;
  /** Atlas resolution on the body surface. */
  texelsPerMetre: number;
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
  weld: number[];
  /** Painted-on top and shorts (display only; never affects maps): [top zone, shorts zone, base-mesh height] per render vertex. */
  garment: number[];
  charts: BodyChart[];
  /** Named surface points used by camera presets, tests, and the synthetic history. */
  landmarks: Record<string, BodyLandmark>;
  focus: Record<FocusTarget, CameraFocus>;
  source: { name: string; url: string; sha256: string; license: string };
}
