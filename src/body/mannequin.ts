import { BODY_MAP_VERSION, MAP_SIZE, type RegionId } from "../domain/contracts";

export interface BodyIsland {
  id: number;
  part: string;
  regionId: RegionId;
  side: "front" | "back";
  bounds: [number, number, number, number];
  vertexStart: number;
  vertexCount: number;
}
export interface MannequinAsset {
  bodyMapVersion: typeof BODY_MAP_VERSION;
  mapSize: typeof MAP_SIZE;
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
  islands: BodyIsland[];
}
type Vector = [number, number, number];
interface Part { name: string; region: RegionId; center: Vector; radius: Vector; tilt?: number; torso?: boolean }

/** Original stylized A-pose mannequin. Pure data generator; no browser or renderer dependency. */
export function generateMannequin(): MannequinAsset {
  const asset: MannequinAsset = { bodyMapVersion: BODY_MAP_VERSION, mapSize: MAP_SIZE, positions: [], normals: [], uvs: [], indices: [], islands: [] };
  const parts: Part[] = [
    { name: "head", region: "head", center: [0, 1.83, 0], radius: [.115, .155, .105] },
    { name: "neck", region: "neck", center: [0, 1.64, 0], radius: [.073, .115, .073] },
    { name: "torso", region: "front-upper-torso", center: [0, 1.31, 0], radius: [.25, .345, .145], torso: true },
    { name: "pelvis", region: "pelvis", center: [0, 1.005, 0], radius: [.215, .17, .145] },
  ];
  for (const side of ["left", "right"] as const) {
    const sign = side === "left" ? 1 : -1;
    parts.push(
      { name: `${side}-upper-arm`, region: `${side}-upper-arm`, center: [sign * .315, 1.43, 0], radius: [.085, .225, .085], tilt: sign * .33 },
      { name: `${side}-forearm`, region: `${side}-forearm`, center: [sign * .435, 1.12, 0], radius: [.065, .195, .068], tilt: sign * .3 },
      { name: `${side}-hand`, region: `${side}-hand`, center: [sign * .51, .89, 0], radius: [.064, .115, .043], tilt: sign * .2 },
      { name: `${side}-thigh`, region: `${side}-thigh`, center: [sign * .12, .735, 0], radius: [.106, .285, .113], tilt: sign * .025 },
      { name: `${side}-calf`, region: `${side}-calf`, center: [sign * .135, .315, -.005], radius: [.078, .235, .085] },
      { name: `${side}-foot`, region: `${side}-foot`, center: [sign * .135, .065, .065], radius: [.083, .065, .16] },
    );
  }
  for (const part of parts) {
    for (const side of ["front", "back"] as const) {
      const ranges = part.torso ? [[-Math.PI / 2, 0], [0, Math.PI / 2]] : [[-Math.PI / 2, Math.PI / 2]];
      for (const [low, high] of ranges) {
        const regionId: RegionId = part.torso ? `${side}-${low === 0 ? "upper" : "lower"}-torso` : part.region;
        const id = asset.islands.length;
        // 8x8 atlas, 64px tiles, 4px gutter on every side, v points upward.
        const u0 = ((id % 8) * 64 + 4) / MAP_SIZE;
        const v0 = (Math.floor(id / 8) * 64 + 4) / MAP_SIZE;
        const u1 = u0 + 56 / MAP_SIZE;
        const v1 = v0 + 56 / MAP_SIZE;
        const vertexStart = asset.positions.length / 3;
        const rows = part.torso ? 8 : 16;
        const columns = 16;
        const angle = part.tilt ?? 0;
        const c = Math.cos(angle), s = Math.sin(angle);
        for (let row = 0; row <= rows; row++) {
          const latitude = low + (high - low) * row / rows;
          for (let column = 0; column <= columns; column++) {
            const longitude = column / columns * Math.PI + (side === "back" ? Math.PI : 0);
            const nx = Math.cos(latitude) * Math.cos(longitude);
            const ny = Math.sin(latitude);
            const nz = Math.cos(latitude) * Math.sin(longitude);
            const x = nx * part.radius[0], y = ny * part.radius[1], z = nz * part.radius[2];
            asset.positions.push(...[part.center[0] + x * c - y * s, part.center[1] + x * s + y * c, part.center[2] + z].map(n => Number(n.toFixed(7)) || 0));
            const normal = [nx / part.radius[0], ny / part.radius[1], nz / part.radius[2]];
            const length = Math.hypot(...normal);
            asset.normals.push(...[(normal[0] * c - normal[1] * s) / length, (normal[0] * s + normal[1] * c) / length, normal[2] / length].map(n => Number(n.toFixed(7)) || 0));
            asset.uvs.push(u0 + (u1 - u0) * column / columns, v0 + (v1 - v0) * row / rows);
          }
        }
        for (let row = 0; row < rows; row++) {
          for (let column = 0; column < columns; column++) {
            const a = vertexStart + row * (columns + 1) + column;
            const b = a + columns + 1;
            // Pole fans: omit the collapsed triangle at each pole.
            if (!(row === 0 && low === -Math.PI / 2)) asset.indices.push(a, b, a + 1);
            if (!(row === rows - 1 && high === Math.PI / 2)) asset.indices.push(a + 1, b, b + 1);
          }
        }
        asset.islands.push({ id, part: part.name, regionId, side, bounds: [u0, v0, u1, v1], vertexStart, vertexCount: (rows + 1) * (columns + 1) });
      }
    }
  }
  return asset;
}
