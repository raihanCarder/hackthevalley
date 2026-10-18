import { writeFileSync } from "node:fs";
import { BODY_MAP_VERSION } from "../src/domain/contracts";
import { encodeMorph, type BodyShapePack } from "../src/body/body-shape";
import { bytesToBase64 } from "../src/body/png";
import { loadSourceMesh } from "./body/mesh";
import { classifyTriangles } from "./body/regions";
import { loadTarget, parseTarget, TARGET_COMMIT, targetPaths } from "./body/targets";

/**
 * Derives the committed body-shape pack (public/body/shape-<version>.json) from pinned CC0 MakeHuman targets.
 * Needs network access the first time (targets are cached in node_modules/.cache). Breast and genital modifiers are
 * deliberately not used.
 */
export const CHEST_CAP = .35;

async function main() {
  const mesh = loadSourceMesh();
  const welded = new Map(mesh.sourceIndex.map((source, welded) => [source, welded]));
  const files: BodyShapePack["source"]["files"] = [];
  const targets = new Map<string, Map<number, [number, number, number]>>();
  for (const path of targetPaths()) {
    const { text, sha256 } = await loadTarget(path);
    files.push({ path: `makehuman/data/targets/${path}`, sha256 });
    targets.set(path, parseTarget(text));
  }
  /** Weighted sum of targets as dense welded offsets in metres. */
  const combine = (parts: [string, number][]) => {
    const out = new Float64Array(mesh.positions.length * 3);
    for (const [path, weight] of parts) for (const [source, offset] of targets.get(path)!) {
      const v = welded.get(source);
      if (v === undefined) continue; // helper geometry we do not keep
      for (let axis = 0; axis < 3; axis++) out[v * 3 + axis] += offset[axis] * mesh.scale * weight;
    }
    return out;
  };
  const sparse = (dense: Float64Array) => {
    const indices: number[] = [], values: number[] = [];
    for (let v = 0; v < dense.length / 3; v++) {
      if (Math.abs(dense[v * 3]) + Math.abs(dense[v * 3 + 1]) + Math.abs(dense[v * 3 + 2]) < 1e-7) continue;
      indices.push(v); values.push(dense[v * 3], dense[v * 3 + 1], dense[v * 3 + 2]);
    }
    return encodeMorph(indices, values);
  };
  const races = ["african", "asian", "caucasian"];
  const morphs: BodyShapePack["morphs"] = {};
  for (const sex of ["female", "male"]) {
    for (const age of ["young", "old"]) {
      // Equal ethnic average (no ethnicity control is offered) plus the universal average-muscle/weight target.
      morphs[`${sex}-${age}`] = sparse(combine([...races.map(race => [`macrodetails/${race}-${sex}-${age}.target`, 1 / 3] as [string, number]),
        [`macrodetails/universal-${sex}-${age}-averagemuscle-averageweight.target`, 1]]));
    }
    for (const [name, variant] of [["minmuscle", "minmuscle-averageweight"], ["maxmuscle", "maxmuscle-averageweight"], ["minweight", "averagemuscle-minweight"], ["maxweight", "averagemuscle-maxweight"]]) {
      morphs[`${sex}-${name}`] = sparse(combine([[`macrodetails/universal-${sex}-young-${variant}.target`, 1]]));
    }
    for (const height of ["min", "max"]) morphs[`${sex}-${height}height`] = sparse(combine([[`macrodetails/height/${sex}-young-averagemuscle-averageweight-${height}height.target`, 1]]));
  }
  for (const side of ["incr", "decr"]) {
    morphs[`waist-${side}`] = sparse(combine([[`measure/measure-waist-circ-${side}.target`, 1]]));
    morphs[`shoulders-${side}`] = sparse(combine([[`measure/measure-shoulder-dist-${side}.target`, 1]]));
    morphs[`hips-${side}`] = sparse(combine([[`hip/hip-scale-horiz-${side}.target`, 1]]));
    morphs[`legs-${side}`] = sparse(combine([[`measure/measure-upperleg-height-${side}.target`, 1], [`measure/measure-lowerleg-height-${side}.target`, 1]]));
  }
  // Front chest vertices, where the female side of the sex slider is capped.
  const regions = classifyTriangles(mesh);
  const chest = new Set<number>();
  mesh.triangles.forEach((triangle, t) => { if (regions[t] === "front-upper-torso") triangle.forEach(v => chest.add(v)); });
  const chestBytes = new Uint8Array(chest.size * 4);
  const view = new DataView(chestBytes.buffer);
  [...chest].sort((a, b) => a - b).forEach((v, i) => view.setUint32(i * 4, v, true));

  const pack: BodyShapePack = {
    bodyMapVersion: BODY_MAP_VERSION, vertexCount: mesh.positions.length, chestCap: CHEST_CAP, chest: bytesToBase64(chestBytes), morphs,
    source: { name: "MakeHuman morph targets", commit: TARGET_COMMIT, license: "CC0-1.0", files },
  };
  writeFileSync(`public/body/shape-${BODY_MAP_VERSION}.json`, JSON.stringify(pack) + "\n");
  const size = JSON.stringify(pack).length;
  console.log(`Generated body-shape pack: ${Object.keys(morphs).length} morphs from ${files.length} CC0 targets, ${(size / 1024).toFixed(0)} KB.`);
}

if (process.argv[1]?.endsWith("generate-body-shape.ts")) main().catch(error => { console.error(error); process.exitCode = 1; });
