import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { BODY_MAP_VERSION, MAP_SIZE, type RegionId } from "../src/domain/contracts";
import { buildBodyAtlas, regionIdRaster } from "../src/body/atlas";
import type { BodyLandmark, CameraFocus, FocusTarget, MannequinAsset } from "../src/body/mannequin";
import { encodeGrayPng } from "../src/body/png";
import { encodeRegionRaster } from "../src/body/region-raster";
import { decodeShapePack, type BodyShapePack } from "../src/body/body-shape";
import { buildCharts, packCharts } from "./body/charts";
import { buildDiagramView, type DiagramSpec } from "./body/diagram";
import { chestSmoother } from "./body/chest";
import { add, distance, dot, loadSourceMesh, normalize, scaleVec, SOURCE_SHA256, sub, vertexNormals, type Vec3 } from "./body/mesh";
import { classifyTriangles } from "./body/regions";

const round = (value: number, places: number) => Number(value.toFixed(places)) || 0;

/**
 * MakeHuman's default figure is the base mesh plus the averaged young-adult female/male shape (sex 0.5). It is applied
 * to the displayed positions only: regions and UV charts are computed on the base mesh, so the map contract is the
 * same for every body shape. The base positions get the same nipple smoothing as the shape morphs. Feet stay on the ground.
 */
function defaultFigure(mesh: ReturnType<typeof loadSourceMesh>): Vec3[] {
  const pack = decodeShapePack(JSON.parse(readFileSync(`public/body/shape-${BODY_MAP_VERSION}.json`, "utf8")) as BodyShapePack);
  const smoothed = chestSmoother(mesh).smooth(Float64Array.from(mesh.positions.flat()));
  const positions = mesh.positions.map((_, v) => [smoothed[v * 3], smoothed[v * 3 + 1], smoothed[v * 3 + 2]] as Vec3);
  for (const name of ["female-young", "male-young"]) {
    const morph = pack.morphs.get(name)!;
    for (let i = 0; i < morph.indices.length; i++) for (let axis = 0; axis < 3; axis++) positions[morph.indices[i]][axis] += morph.values[i * 3 + axis] * .5;
  }
  const floor = Math.min(...positions.map(p => p[1]));
  return positions.map(([x, y, z]) => [x, y - floor, z]);
}

export function buildBody() {
  const mesh = loadSourceMesh();
  const regions = classifyTriangles(mesh);
  const charts = buildCharts(mesh.positions, mesh.triangles, regions);
  const { charts: packed, texelsPerMetre } = packCharts(charts, MAP_SIZE);
  // Everything displayed (and every landmark, preset, and diagram) uses MakeHuman's default figure.
  mesh.positions = defaultFigure(mesh);
  const normals = vertexNormals(mesh.positions, mesh.triangles);

  // Render vertices: one per (chart, welded vertex); triangles grouped by chart.
  const asset: MannequinAsset = {
    bodyMapVersion: BODY_MAP_VERSION, mapSize: MAP_SIZE, texelsPerMetre: round(texelsPerMetre, 2),
    positions: [], normals: [], uvs: [], indices: [], weld: [], charts: [], landmarks: {}, focus: {} as Record<FocusTarget, CameraFocus>,
    source: { name: "MakeHuman hm08 base mesh", url: "https://github.com/makehumancommunity/makehuman/blob/3c701a8e52f09e69922e8b598d23be2d7dfc49e3/makehuman/data/3dobjs/base.obj", sha256: SOURCE_SHA256, license: "CC0-1.0" },
  };
  const triangleRegions: RegionId[] = [];
  packed.forEach((chart, id) => {
    const vertexStart = asset.weld.length, triangleStart = asset.indices.length / 3;
    const local = new Map<number, number>();
    for (const [welded, [u, v]] of [...chart.uv.entries()].sort((a, b) => a[0] - b[0])) {
      local.set(welded, asset.weld.length);
      asset.weld.push(welded);
      asset.positions.push(...mesh.positions[welded].map(n => round(n, 5)));
      asset.normals.push(...normals[welded].map(n => round(n, 4)));
      const px = chart.offset[0] + (u - chart.min[0]) * texelsPerMetre, py = chart.offset[1] + (v - chart.min[1]) * texelsPerMetre;
      asset.uvs.push(round(px / MAP_SIZE, 6), round(1 - py / MAP_SIZE, 6));
    }
    for (const t of [...chart.triangles].sort((a, b) => a - b)) {
      asset.indices.push(...mesh.triangles[t].map(v => local.get(v)!));
      triangleRegions.push(chart.region);
    }
    const us = [], vs = [];
    for (let i = vertexStart; i < asset.weld.length; i++) { us.push(asset.uvs[i * 2]); vs.push(asset.uvs[i * 2 + 1]); }
    asset.charts.push({
      id, regionId: chart.region, bounds: [Math.min(...us), Math.min(...vs), Math.max(...us), Math.max(...vs)].map(n => round(n, 6)) as [number, number, number, number],
      vertexStart, vertexCount: asset.weld.length - vertexStart, triangleStart, triangleCount: asset.indices.length / 3 - triangleStart,
    });
  });

  // Landmarks: the welded vertex of a region nearest a target point among those facing a direction.
  const regionVertices = new Map<RegionId, Set<number>>();
  mesh.triangles.forEach((triangle, t) => { const set = regionVertices.get(regions[t]) ?? new Set<number>(); triangle.forEach(v => set.add(v)); regionVertices.set(regions[t], set); });
  const j = (name: string) => mesh.joints.get(name)!;
  const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => add(a, scaleVec(sub(b, a), t));
  const landmark = (name: string, regionId: RegionId, target: Vec3, facing?: Vec3) => {
    let best = -1, bestDistance = Infinity;
    for (const v of regionVertices.get(regionId) ?? []) {
      if (facing && dot(normals[v], normalize(facing)) < .5) continue;
      const d = distance(mesh.positions[v], target);
      if (d < bestDistance) { bestDistance = d; best = v; }
    }
    if (best < 0) throw new Error(`No surface found for landmark ${name}.`);
    asset.landmarks[name] = { point: mesh.positions[best].map(n => round(n, 5)) as Vec3, normal: normals[best].map(n => round(n, 4)) as Vec3, regionId } satisfies BodyLandmark;
  };
  const front: Vec3 = [0, 0, 1], back: Vec3 = [0, 0, -1];
  landmark("chest", "front-upper-torso", [.07, 1.45, .2], front);
  landmark("abdomen", "front-lower-torso", [.04, 1.25, .17], front);
  landmark("upper-back", "back-upper-torso", [.07, 1.48, -.1], back);
  landmark("lower-back", "back-lower-torso", [0, 1.25, -.08], back);
  landmark("lower-back-left", "back-lower-torso", [.08, 1.26, -.08], back);
  landmark("lower-back-right", "back-lower-torso", [-.08, 1.26, -.08], back);
  landmark("pelvis-back", "pelvis", [.07, 1.02, -.12], back);
  for (const [side, s, sign] of [["left", "l", 1], ["right", "r", -1]] as const) {
    const outer: Vec3 = [.5 * sign, 0, 1];
    for (const [t, suffix] of [[.3, "upper"], [.55, "middle"], [.8, "lower"]] as const) {
      landmark(`${side}-thigh-${suffix}`, `${side}-thigh`, add(lerp(j(`${s}-upper-leg`), j(`${s}-knee`), t), [.03 * sign, 0, .25]), outer);
      landmark(`${side}-calf-${suffix}`, `${side}-calf`, add(lerp(j(`${s}-knee`), j(`${s}-ankle`), t), [.02 * sign, 0, .25]), outer);
    }
    landmark(`${side}-upper-arm`, `${side}-upper-arm`, add(lerp(j(`${s}-shoulder`), j(`${s}-elbow`), .5), [0, 0, .2]), front);
    landmark(`${side}-forearm`, `${side}-forearm`, add(lerp(j(`${s}-elbow`), j(`${s}-hand`), .5), [0, 0, .2]), front);
    landmark(`${side}-hand-back`, `${side}-hand`, add(j(`${s}-hand-2`), [.04 * sign, 0, 0]), [sign, .2, 0]);
    // Digit tips: the vertex of each digit farthest from its knuckle (robust to the default figure's pose).
    const tip = (name: string, regionId: RegionId, knuckle: Vec3) => {
      let best = -1, far = -1;
      for (const v of regionVertices.get(regionId) ?? []) { const d = distance(mesh.positions[v], knuckle); if (d > far) { far = d; best = v; } }
      landmark(name, regionId, mesh.positions[best]);
    };
    tip(`${side}-thumb-tip`, `${side}-thumb`, j(`${s}-finger-1-2`));
    tip(`${side}-index-tip`, `${side}-index-finger`, j(`${s}-finger-2-1`));
    tip(`${side}-middle-tip`, `${side}-middle-finger`, j(`${s}-finger-3-1`));
    tip(`${side}-little-tip`, `${side}-little-finger`, j(`${s}-finger-5-1`));
    landmark(`${side}-foot-top`, `${side}-foot`, add(lerp(j(`${s}-ankle`), j(`${s}-foot-1`), .6), [0, .05, 0]), [0, 1, .3]);
    tip(`${side}-big-toe`, `${side}-big-toe`, j(`${s}-toe-1-1`));
    tip(`${side}-little-toe`, `${side}-little-toe`, j(`${s}-toe-5-1`));
    landmark(`${side}-ear`, `${side}-ear`, [.09 * sign, 1.8, 0], [sign, 0, 0]);
    landmark(`${side}-eye`, `${side}-eye`, add(j(`${s}-eye`), [0, 0, .05]), front);
  }
  landmark("nose-tip", "nose", [0, 1.79, .25], front);
  landmark("mouth", "mouth", [0, 1.735, .2], front);
  landmark("forehead", "head", [0, 1.87, .17], front);
  landmark("head-top", "head", [0, 2.1, 0], [0, 1, 0]);
  landmark("neck-front", "neck", [0, 1.64, .1], front);

  // Camera focus presets for small parts.
  const centroid = (ids: RegionId[]) => {
    const sum: Vec3 = [0, 0, 0]; let n = 0;
    for (const id of ids) for (const v of regionVertices.get(id) ?? []) { for (let a = 0; a < 3; a++) sum[a] += mesh.positions[v][a]; n++; }
    return scaleVec(sum, 1 / n);
  };
  const focus = (target: Vec3, from: Vec3, distanceToTarget: number): CameraFocus =>
    ({ target: target.map(n => round(n, 4)) as Vec3, position: add(target, scaleVec(normalize(from), distanceToTarget)).map(n => round(n, 4)) as Vec3 });
  const digits = (side: string) => ["hand", "thumb", "index-finger", "middle-finger", "ring-finger", "little-finger"].map(part => `${side}-${part}` as RegionId);
  const toes = (side: string) => ["foot", "big-toe", "second-toe", "third-toe", "fourth-toe", "little-toe"].map(part => `${side}-${part}` as RegionId);
  const eyes = scaleVec(add(j("l-eye"), j("r-eye")), .5);
  asset.focus = {
    face: focus([0, eyes[1] - .02, eyes[2] - .03], [0, .05, 1], .62),
    "left-hand": focus(centroid(digits("left")), [.85, .35, .55], .62),
    "right-hand": focus(centroid(digits("right")), [-.85, .35, .55], .62),
    "left-foot": focus(centroid(toes("left")), [.3, .8, .75], .62),
    "right-foot": focus(centroid(toes("right")), [-.3, .8, .75], .62),
  };

  // 2D diagram views traced from the same mesh and labels.
  const views: DiagramSpec[] = [
    { id: "front", label: "Front", note: "Your left is on the right", toward: [0, 0, 1], up: [0, 1, 0], center: [0, .98], size: [1.3, 2.02], width: 300 },
    { id: "back", label: "Back", note: "Your left is on the left", toward: [0, 0, -1], up: [0, 1, 0], center: [0, .98], size: [1.3, 2.02], width: 300 },
    { id: "face", label: "Face", note: "Your left is on the right", toward: [0, 0, 1], up: [0, 1, 0], center: [0, 1.79], size: [.24, .26], width: 220, include: region => ["head", "neck", "left-eye", "right-eye", "nose", "mouth", "left-ear", "right-ear"].includes(region) },
    { id: "left-hand", label: "Your left hand", note: "Back of the hand", toward: [1, .15, 0], up: [0, 1, 0], center: j("l-finger-3-1"), size: [.22, .22], width: 200, include: region => digits("left").includes(region) },
    { id: "right-hand", label: "Your right hand", note: "Back of the hand", toward: [-1, .15, 0], up: [0, 1, 0], center: j("r-finger-3-1"), size: [.22, .22], width: 200, include: region => digits("right").includes(region) },
    { id: "left-foot", label: "Your left foot", note: "From above, toes at the bottom", toward: [0, 1, 0], up: [0, 0, -1], center: add(j("l-foot-1"), [0, 0, -.04]), size: [.17, .3], width: 130, include: region => toes("left").includes(region) },
    { id: "right-foot", label: "Your right foot", note: "From above, toes at the bottom", toward: [0, 1, 0], up: [0, 0, -1], center: add(j("r-foot-1"), [0, 0, -.04]), size: [.17, .3], width: 130, include: region => toes("right").includes(region) },
  ];
  const diagram = { bodyMapVersion: BODY_MAP_VERSION, views: views.map(spec => buildDiagramView(spec, mesh.positions, mesh.triangles, regions)) };
  return { asset, diagram, triangleRegions };
}

async function main() {
  const { asset, diagram } = buildBody();
  const atlas = buildBodyAtlas(asset);
  rmSync("public/body/mannequin-v1.json", { force: true });
  rmSync("public/body/region-atlas-mannequin-v1.png", { force: true });
  writeFileSync(`public/body/${BODY_MAP_VERSION}.json`, JSON.stringify(asset) + "\n");
  writeFileSync(`public/body/region-atlas-${BODY_MAP_VERSION}.png`, await encodeGrayPng(regionIdRaster(atlas), MAP_SIZE, MAP_SIZE));
  writeFileSync("src/body/region-raster-data.ts", `// Generated by npm run body:generate. Do not edit.\nexport const REGION_RASTER_BODY_MAP_VERSION = "${BODY_MAP_VERSION}";\nexport const REGION_RASTER_RLE = "${encodeRegionRaster(atlas.regionOf)}";\n`);
  writeFileSync("src/body/diagram-data.ts", `// Generated by npm run body:generate. Do not edit.\nimport type { BodyDiagramData } from "./diagram";\n\nexport const BODY_DIAGRAM: BodyDiagramData = ${JSON.stringify(diagram)};\n`);
  const valid = atlas.regionTexelCount.reduce((sum, n) => sum + n, 0);
  console.log(`Generated ${asset.bodyMapVersion}: ${asset.charts.length} charts, ${asset.indices.length / 3} triangles, ${asset.weld.length} render vertices, ${atlas.vertexCount} surface vertices, ${(1000 / asset.texelsPerMetre).toFixed(2)} mm per texel, ${valid} valid texels.`);
}

if (process.argv[1]?.endsWith("generate-body.ts")) main().catch(error => { console.error(error); process.exitCode = 1; });
