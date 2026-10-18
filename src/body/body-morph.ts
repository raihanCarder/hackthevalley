import { BODY_MAP_VERSION } from "../domain/contracts";
import type { BodyAtlas } from "./atlas";
import { decodeShapePack, isNeutralShape, shapeOffsets, type BodyShape, type BodyShapePack, type DecodedShapePack } from "./body-shape";
import { FOCUS_TARGETS, type CameraFocus, type FocusTarget, type MannequinAsset } from "./mannequin";

/**
 * Applies a body shape to the welded surface used for painting and to render-vertex buffers. Pure data (no WebGL):
 * the scene uploads the returned buffers. Triangles, UVs, and texel→triangle data are untouched, so maps, regions,
 * and measurements are identical on every shape.
 */
export interface Morpher {
  /** Positions/normals per render vertex for the shape, plus framing data. Updates the atlas surface in place. */
  apply(shape: BodyShape): Promise<MorphResult>;
}
export interface MorphResult { positions: Float32Array; normals: Float32Array; height: number; focus: Record<FocusTarget, CameraFocus> }

let packPromise: Promise<DecodedShapePack> | undefined;
/** The shape pack is only fetched once a non-default shape is requested. */
function loadPack(): Promise<DecodedShapePack> {
  packPromise ??= fetch(`/body/shape-${BODY_MAP_VERSION}.json`).then(response => {
    if (!response.ok) throw new Error("Body-shape data is unavailable.");
    return response.json();
  }).then(pack => decodeShapePack(pack as BodyShapePack)).catch(error => { packPromise = undefined; throw error; });
  return packPromise;
}

export function createMorpher(asset: MannequinAsset, atlas: BodyAtlas, load: () => Promise<DecodedShapePack> = loadPack): Morpher {
  const defaults = atlas.vertices.slice();
  let defaultHeight = 0;
  for (let v = 0; v < atlas.vertexCount; v++) defaultHeight = Math.max(defaultHeight, defaults[v * 3 + 1]);
  // Welded vertices of each close-up's regions, so presets follow the reshaped part.
  const focusRegions: Record<FocusTarget, RegExp> = {
    face: /^(head|left-eye|right-eye|nose|mouth|left-ear|right-ear)$/,
    "left-hand": /^left-(hand|thumb|.*-finger)$/, "right-hand": /^right-(hand|thumb|.*-finger)$/,
    "left-foot": /^left-(foot|.*-toe)$/, "right-foot": /^right-(foot|.*-toe)$/,
  };
  const focusVertices = Object.fromEntries(FOCUS_TARGETS.map(target => {
    const set = new Set<number>();
    for (const chart of asset.charts) if (focusRegions[target].test(chart.regionId)) {
      for (let r = chart.vertexStart; r < chart.vertexStart + chart.vertexCount; r++) set.add(asset.weld[r]);
    }
    return [target, Uint32Array.from(set)];
  })) as Record<FocusTarget, Uint32Array>;

  return {
    async apply(shape) {
      const offsets = isNeutralShape(shape) ? new Float32Array(atlas.vertexCount * 3) : shapeOffsets(await load(), shape);
      // Reshape the welded surface and keep the feet on the ground.
      let floor = Infinity;
      for (let v = 0; v < atlas.vertexCount; v++) floor = Math.min(floor, defaults[v * 3 + 1] + offsets[v * 3 + 1]);
      let height = 0;
      for (let v = 0; v < atlas.vertexCount; v++) {
        atlas.vertices[v * 3] = defaults[v * 3] + offsets[v * 3];
        atlas.vertices[v * 3 + 1] = defaults[v * 3 + 1] + offsets[v * 3 + 1] - floor;
        atlas.vertices[v * 3 + 2] = defaults[v * 3 + 2] + offsets[v * 3 + 2];
        height = Math.max(height, atlas.vertices[v * 3 + 1]);
      }
      for (let v = 0; v < atlas.vertexCount; v++) for (let i = atlas.neighborStart[v]; i < atlas.neighborStart[v + 1]; i++) {
        const n = atlas.neighbors[i];
        atlas.edgeLength[i] = Math.hypot(atlas.vertices[v * 3] - atlas.vertices[n * 3], atlas.vertices[v * 3 + 1] - atlas.vertices[n * 3 + 1], atlas.vertices[v * 3 + 2] - atlas.vertices[n * 3 + 2]);
      }
      // Area-weighted normals on the welded mesh, so UV seams never show in shading.
      const welded = new Float32Array(atlas.vertexCount * 3);
      const p = atlas.vertices;
      for (let t = 0; t < atlas.triangleCount; t++) {
        const a = atlas.triangles[t * 3], b = atlas.triangles[t * 3 + 1], c = atlas.triangles[t * 3 + 2];
        const e1 = [p[b * 3] - p[a * 3], p[b * 3 + 1] - p[a * 3 + 1], p[b * 3 + 2] - p[a * 3 + 2]];
        const e2 = [p[c * 3] - p[a * 3], p[c * 3 + 1] - p[a * 3 + 1], p[c * 3 + 2] - p[a * 3 + 2]];
        const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
        for (const v of [a, b, c]) { welded[v * 3] += n[0]; welded[v * 3 + 1] += n[1]; welded[v * 3 + 2] += n[2]; }
      }
      const positions = new Float32Array(asset.weld.length * 3), normals = new Float32Array(asset.weld.length * 3);
      asset.weld.forEach((v, r) => {
        const length = Math.hypot(welded[v * 3], welded[v * 3 + 1], welded[v * 3 + 2]) || 1;
        for (let axis = 0; axis < 3; axis++) { positions[r * 3 + axis] = p[v * 3 + axis]; normals[r * 3 + axis] = welded[v * 3 + axis] / length; }
      });
      // Close-up presets move with their part.
      const focus = {} as Record<FocusTarget, CameraFocus>;
      for (const target of FOCUS_TARGETS) {
        const vertices = focusVertices[target];
        const shift = [0, 0, 0];
        for (const v of vertices) for (let axis = 0; axis < 3; axis++) shift[axis] += (p[v * 3 + axis] - defaults[v * 3 + axis]) / vertices.length;
        const preset = asset.focus[target];
        focus[target] = {
          target: preset.target.map((n, axis) => n + shift[axis]) as CameraFocus["target"],
          position: preset.position.map((n, axis) => n + shift[axis]) as CameraFocus["position"],
        };
      }
      return { positions, normals, height: height / defaultHeight, focus };
    },
  };
}
