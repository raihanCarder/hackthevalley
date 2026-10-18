import { readFileSync } from "node:fs";
import { BODY_MAP_VERSION } from "../../src/domain/contracts";
import type { MannequinAsset } from "../../src/body/mannequin";

/** Named surface points of the current body asset (metres; +X patient-left, +Z front). */
const asset = JSON.parse(readFileSync(`public/body/${BODY_MAP_VERSION}.json`, "utf8")) as MannequinAsset;
export function landmark(name: string): [number, number, number] {
  const mark = asset.landmarks[name];
  if (!mark) throw new Error(`Unknown body landmark ${name}.`);
  return mark.point;
}

// Named front/back views stand 2.9 m from the orbit target (0, 1, 0) with a 40° vertical field of view.
const DISTANCE = 2.9;
/** Page coordinates of a model-space point in the named front or back view of a canvas bounding box. */
export function project(box: { x: number; y: number; width: number; height: number }, [x, y, z]: readonly number[], view: "front" | "back" = "front"): [number, number] {
  const t = Math.tan(20 * Math.PI / 180), aspect = box.width / box.height;
  const depth = view === "front" ? DISTANCE - z : DISTANCE + z;
  const screenX = view === "front" ? x : -x;
  return [box.x + (screenX / (depth * t * aspect) + 1) / 2 * box.width, box.y + (1 - (y - 1) / (depth * t)) / 2 * box.height];
}
