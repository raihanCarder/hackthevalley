import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BODY_MAP_VERSION } from "../../src/domain/contracts";
import { BODY_SHAPE_SLIDERS, DEFAULT_BODY_SHAPE, decodeShapePack, isDefaultShape, normalizeShape, shapeOffsets, type BodyShape, type BodyShapePack } from "../../src/body/body-shape";
import { createMorpher } from "../../src/body/body-morph";
import { buildBodyAtlas, surfaceHitNear } from "../../src/body/atlas";
import { PaintEngine } from "../../src/body/paint-engine";
import { reduceRegions } from "../../src/body/regions";
import { intensityToByte } from "../../src/body/layers";
import type { MannequinAsset } from "../../src/body/mannequin";
import { NIPPLE_SOURCE_RANGES } from "../../scripts/body/chest";
import { loadSourceMesh } from "../../scripts/body/mesh";

const raw = JSON.parse(readFileSync(`public/body/shape-${BODY_MAP_VERSION}.json`, "utf8")) as BodyShapePack;
const pack = decodeShapePack(raw);
const asset = () => JSON.parse(readFileSync(`public/body/${BODY_MAP_VERSION}.json`, "utf8")) as MannequinAsset;
const shape = (partial: Partial<BodyShape>): BodyShape => ({ ...DEFAULT_BODY_SHAPE, ...partial });
const morphed = async (partial: Partial<BodyShape>) => {
  const fresh = asset();
  const atlas = buildBodyAtlas(fresh);
  const result = await createMorpher(fresh, atlas, async () => pack).apply(shape(partial));
  return { atlas, result, asset: fresh };
};

test("stored shapes are clamped and completed; the default shape adds no offset", () => {
  assert.deepEqual(normalizeShape(null), DEFAULT_BODY_SHAPE);
  assert.deepEqual(normalizeShape({ sex: 2, weight: -1, height: "tall", legs: .7 }), { ...DEFAULT_BODY_SHAPE, sex: 1, weight: 0, legs: .7 });
  assert.ok(isDefaultShape(DEFAULT_BODY_SHAPE) && !isDefaultShape(shape({ muscle: .6 })));
  assert.ok(shapeOffsets(pack, DEFAULT_BODY_SHAPE).every(value => Math.abs(value) < 1e-9));
  for (const slider of BODY_SHAPE_SLIDERS) {
    const extreme = shapeOffsets(pack, shape({ [slider]: slider === "age" ? 1 : 0 }));
    assert.ok(extreme.some(value => Math.abs(value) > 1e-3), `${slider} changes the figure`);
  }
});

test("the shape pack comes only from pinned CC0 MakeHuman targets, with no breast or genital modifiers", () => {
  assert.equal(raw.source.license, "CC0-1.0");
  assert.equal(raw.source.commit, "3c701a8e52f09e69922e8b598d23be2d7dfc49e3");
  assert.ok(raw.source.files.length >= 38 && raw.source.files.every(file => /^[0-9a-f]{64}$/.test(file.sha256)));
  assert.ok(raw.source.files.every(file => !/breast|genital|cup/.test(file.path)));
  assert.equal(raw.vertexCount, buildBodyAtlas(asset()).vertexCount);
  assert.ok(raw.chestCap > 0 && raw.chestCap < 1);
});

test("reshaping never changes maps: triangles, texels, regions, and measurements are identical on every shape", async () => {
  const reference = buildBodyAtlas(asset());
  const engine = new PaintEngine(reference);
  engine.beginStroke({ layer: "aching", tool: "brush", intensity: intensityToByte(6), radius: .04 });
  engine.strokeTo(surfaceHitNear(reference, reference.asset.landmarks["lower-back"].point));
  engine.endStroke();
  const layers = engine.snapshot();
  for (const partial of [{ sex: 0 }, { sex: 1, muscle: 1 }, { weight: 1, waist: 1 }, { height: 0, legs: 1 }, { age: 1, shoulders: 0, hips: 1 }] as Partial<BodyShape>[]) {
    const { atlas } = await morphed(partial);
    assert.deepEqual(atlas.triangleOf, reference.triangleOf);
    assert.deepEqual(atlas.regionOf, reference.regionOf);
    assert.deepEqual(reduceRegions(layers, atlas), reduceRegions(layers, reference), "measurements do not depend on shape");
    assert.ok(atlas.vertices.some((value, i) => Math.abs(value - reference.vertices[i]) > 1e-3), "the surface did move");
    // Painting still works on the reshaped surface and lands in the same region.
    const reshaped = new PaintEngine(atlas);
    const p = atlas.vertices;
    const calf = reference.asset.landmarks["left-calf-middle"].point;
    let nearest = 0, best = Infinity;
    for (let v = 0; v < reference.vertexCount; v++) {
      const d = (reference.vertices[v * 3] - calf[0]) ** 2 + (reference.vertices[v * 3 + 1] - calf[1]) ** 2 + (reference.vertices[v * 3 + 2] - calf[2]) ** 2;
      if (d < best) { best = d; nearest = v; }
    }
    reshaped.beginStroke({ layer: "burning", tool: "brush", intensity: 200, radius: .03 });
    reshaped.strokeTo({ point: [p[nearest * 3], p[nearest * 3 + 1], p[nearest * 3 + 2]], triangle: atlas.vertexTriangles[atlas.vertexTriangleStart[nearest]] });
    reshaped.endStroke();
    assert.deepEqual(reduceRegions(reshaped.peek(), atlas).map(o => o.regionId), ["left-calf"]);
  }
});

test("reshaped figures stand on the ground; height and leg sliders change stature; the chest stays capped", async () => {
  const heights: Record<string, number> = {};
  for (const [name, partial] of [["default", {}], ["short", { height: 0 }], ["tall", { height: 1 }], ["long legs", { legs: 1 }]] as [string, Partial<BodyShape>][]) {
    const { atlas, result } = await morphed(partial);
    let floor = Infinity;
    for (let v = 0; v < atlas.vertexCount; v++) floor = Math.min(floor, atlas.vertices[v * 3 + 1]);
    assert.ok(Math.abs(floor) < 1e-6, `${name}: feet on the ground`);
    heights[name] = result.height;
  }
  assert.equal(heights.default, 1);
  assert.ok(heights.short < .95 && heights.tall > 1.05 && heights.tall < 1.25 && heights["long legs"] > 1.02, JSON.stringify(heights));
  // The female side of the sex slider is scaled down over the breasts.
  const female = shapeOffsets(pack, shape({ sex: 0 }));
  const uncapped = shapeOffsets({ ...pack, chestCap: 1 }, shape({ sex: 0 }));
  let capped = 0, full = 0;
  pack.chest.forEach((strength, v) => { if (strength === 1) { capped += Math.hypot(female[v * 3], female[v * 3 + 1], female[v * 3 + 2]); full += Math.hypot(uncapped[v * 3], uncapped[v * 3 + 1], uncapped[v * 3 + 2]); } });
  assert.ok(capped <= full * pack.chestCap + 1e-6 && capped > 0);
});

test("the chest cap fades out smoothly, leaving no seam at the neck, shoulders, or under the chest", () => {
  const body = asset();
  const edges: [number, number][] = [];
  for (let t = 0; t < body.indices.length; t += 3) {
    const [a, b, c] = [0, 1, 2].map(i => body.weld[body.indices[t + i]]);
    for (const [u, v] of [[a, b], [b, c], [c, a]]) if (pack.chest[u] !== pack.chest[v]) edges.push([u, v]);
  }
  assert.ok(edges.length > 0);
  for (const sex of [0, .25]) {
    const largestJump = (offsets: Float32Array) => Math.max(...edges.map(([u, v]) =>
      Math.hypot(offsets[u * 3] - offsets[v * 3], offsets[u * 3 + 1] - offsets[v * 3 + 1], offsets[u * 3 + 2] - offsets[v * 3 + 2])));
    // A hard-edged cap tore the surface (55 mm across one edge at sex 0, against 12 mm uncapped).
    const capped = largestJump(shapeOffsets(pack, shape({ sex }))), uncapped = largestJump(shapeOffsets({ ...pack, chestCap: 1 }, shape({ sex })));
    assert.ok(capped <= uncapped * 1.25, `sex ${sex}: ${(capped * 1000).toFixed(1)} mm vs ${(uncapped * 1000).toFixed(1)} mm uncapped`);
  }
});

test("the chest has no nipples on any body shape", async () => {
  const welded = new Map(loadSourceMesh().sourceIndex.map((source, v) => [source, v]));
  const nipple = NIPPLE_SOURCE_RANGES.flatMap(([first, last]) => Array.from({ length: last - first + 1 }, (_, i) => welded.get(first + i)!));
  for (const partial of [{}, { sex: 0 }, { sex: 1 }, { sex: 0, weight: 1, muscle: 1 }, { sex: 0, weight: 0, muscle: 0 }, { sex: 1, weight: 1, muscle: 1 }, { sex: 0, age: 1 }] as Partial<BodyShape>[]) {
    const { atlas, result, asset: body } = await morphed(partial);
    const p = atlas.vertices, normal = new Float32Array(atlas.vertexCount * 3);
    body.weld.forEach((v, r) => { for (let axis = 0; axis < 3; axis++) normal[v * 3 + axis] = result.normals[r * 3 + axis]; });
    // Height of each nipple-area vertex above the mean of its three-ring neighbourhood, along the surface normal.
    // The modelled nipples stood 3.5–4.6 mm proud; smooth skin with the chest's own curvature stays well under 1 mm.
    let worst = 0;
    for (const v of nipple) {
      const ring = new Set([v]);
      for (let step = 0; step < 3; step++) for (const u of [...ring]) for (let i = atlas.neighborStart[u]; i < atlas.neighborStart[u + 1]; i++) ring.add(atlas.neighbors[i]);
      ring.delete(v);
      let height = 0;
      for (let axis = 0; axis < 3; axis++) {
        let mean = 0;
        for (const u of ring) mean += p[u * 3 + axis];
        height += (p[v * 3 + axis] - mean / ring.size) * normal[v * 3 + axis];
      }
      worst = Math.max(worst, height);
    }
    assert.ok(worst < 5e-4, `${JSON.stringify(partial)}: nipple area stands ${(worst * 1000).toFixed(2)} mm proud`);
  }
});
