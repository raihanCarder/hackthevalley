import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MAP_SIZE, parseDailyEntry, REGION_IDS, BODY_MAP_VERSION, SCHEMA_VERSION, type RegionId } from "../../src/domain/contracts";
import { regionIdRaster } from "../../src/body/atlas";
import { createEmptyLayers, intensityToByte, PRESENCE_THRESHOLD, TEXEL_COUNT } from "../../src/body/layers";
import { PaintEngine } from "../../src/body/paint-engine";
import { decodeGrayPng } from "../../src/body/png";
import { getRegionRaster } from "../../src/body/region-raster";
import { reduceRegions } from "../../src/body/regions";
import { asset, atlas, fromBack, fromFront, landmark, raycast } from "./helpers";

test("atlas texels stay inside their chart bounds; gutters and unused texels are invalid", () => {
  for (let texel = 0; texel < TEXEL_COUNT; texel++) {
    const t = atlas.triangleOf[texel];
    if (t < 0) { assert.equal(atlas.regionOf[texel], -1); continue; }
    const chart = asset.charts.find(item => t >= item.triangleStart && t < item.triangleStart + item.triangleCount)!;
    const [u0, v0, u1, v1] = chart.bounds;
    const u = (texel % MAP_SIZE + .5) / MAP_SIZE, v = 1 - (Math.floor(texel / MAP_SIZE) + .5) / MAP_SIZE;
    assert.ok(u >= u0 - 1e-6 && u <= u1 + 1e-6 && v >= v0 - 1e-6 && v <= v1 + 1e-6, `texel ${texel} outside chart ${chart.id}`);
    assert.equal(REGION_IDS[atlas.regionOf[texel]], chart.regionId);
  }
  assert.equal(atlas.triangleOf[0], -1);
});

test("every one of the 45 regions has painted-area capacity, including each finger, toe, and facial feature", () => {
  for (const [index, region] of REGION_IDS.entries()) {
    const minimum = /finger|thumb|toe|eye|ear|nose|mouth/.test(region) ? 80 : 1000;
    assert.ok(atlas.regionTexelCount[index] >= minimum, `${region} has ${atlas.regionTexelCount[index]} texels`);
  }
});

test("known anatomical spots map to the correct patient-relative regions", () => {
  const cases: [ReturnType<typeof fromFront>, RegionId][] = [
    [fromBack(0, 1.25), "back-lower-torso"], [fromFront(.04, 1.25), "front-lower-torso"], [fromBack(.06, 1.48), "back-upper-torso"],
    [fromFront(.06, 1.44), "front-upper-torso"], [fromFront(0, 1.64), "neck"], [fromFront(0, 1.9), "head"],
    // Patient-left is +X: the viewer's right from the front, the viewer's left from behind.
    [fromFront(.2, .3), "left-calf"], [fromFront(-.2, .3), "right-calf"], [fromBack(.2, .3), "left-calf"],
    [fromFront(.16, .75), "left-thigh"], [fromFront(-.16, .75), "right-thigh"],
    [raycast([0, 1.79, 1], [0, 0, -1]), "nose"], [raycast([0, 1.733, 1], [0, 0, -1]), "mouth"],
    [raycast([.037, 1.819, 1], [0, 0, -1]), "left-eye"], [raycast([-.037, 1.819, 1], [0, 0, -1]), "right-eye"],
    [raycast([1, 1.8, .02], [-1, 0, 0]), "left-ear"], [raycast([-1, 1.8, .02], [1, 0, 0]), "right-ear"],
  ];
  for (const [hit, region] of cases) assert.equal(hit?.region, region);
  for (const [name, region] of [["left-thumb-tip", "left-thumb"], ["left-index-tip", "left-index-finger"], ["left-middle-tip", "left-middle-finger"], ["left-little-tip", "left-little-finger"],
    ["right-index-tip", "right-index-finger"], ["left-big-toe", "left-big-toe"], ["right-little-toe", "right-little-toe"], ["left-hand-back", "left-hand"], ["left-foot-top", "left-foot"]] as const) {
    assert.equal(landmark(name).region, region, name);
  }
});

test("left/right regions sit on the patient's own side of the body", () => {
  for (const chart of asset.charts) {
    const side = chart.regionId.startsWith("left-") ? 1 : chart.regionId.startsWith("right-") ? -1 : 0;
    if (!side) continue;
    // Midline vertices (x ≈ 0, e.g. the inner thigh at the crotch) may be shared; nothing reaches the other side.
    for (let v = chart.vertexStart; v < chart.vertexStart + chart.vertexCount; v++) assert.ok(asset.positions[v * 3] * side > -.01, `${chart.regionId} vertex on the wrong side`);
  }
});

test("painting only the left calf from the front yields left-calf observations and none for the right calf", () => {
  const engine = new PaintEngine(atlas);
  engine.beginStroke({ layer: "aching", tool: "brush", intensity: intensityToByte(6), radius: .03 });
  engine.strokeTo(landmark("left-calf-upper"));
  engine.strokeTo(landmark("left-calf-middle"));
  engine.endStroke();
  const observations = reduceRegions(engine.peek());
  assert.deepEqual(observations.map(o => o.regionId), ["left-calf"]);
  const [calf] = observations;
  assert.equal(calf.peakIntensity, 6);
  assert.ok(calf.mapCoverage > 0 && calf.mapCoverage < 1 && calf.meanIntensity > 0 && calf.meanIntensity < calf.peakIntensity);
});

test("reducer: mean includes unpainted texels, peak is the maximum, coverage uses the presence threshold", () => {
  const layers = createEmptyLayers();
  const lowerBack = REGION_IDS.indexOf("back-lower-torso");
  const texels: number[] = [];
  for (let texel = 0; texel < TEXEL_COUNT; texel++) if (atlas.regionOf[texel] === lowerBack) texels.push(texel);
  const count = atlas.regionTexelCount[lowerBack];
  assert.equal(texels.length, count);
  texels.slice(0, 100).forEach(texel => { layers.aching[texel] = 255; });
  texels.slice(100, 300).forEach(texel => { layers.aching[texel] = 51; });
  texels.slice(300, 400).forEach(texel => { layers.aching[texel] = PRESENCE_THRESHOLD - 1; }); // residue, ignored
  const [observation, ...rest] = reduceRegions(layers);
  assert.equal(rest.length, 0);
  assert.equal(observation.regionId, "back-lower-torso");
  assert.equal(observation.peakIntensity, 10);
  assert.equal(observation.mapCoverage, Math.round(300 / count * 1e6) / 1e6);
  assert.equal(observation.meanIntensity, Math.round((100 * 255 + 200 * 51) / count / 255 * 10 * 1e4) / 1e4);

  const threshold = createEmptyLayers();
  threshold.burning[texels[0]] = PRESENCE_THRESHOLD;
  assert.equal(reduceRegions(threshold).length, 1, "a value at the threshold is present");
  threshold.burning[texels[0]] = PRESENCE_THRESHOLD - 1;
  assert.deepEqual(reduceRegions(threshold), [], "below the threshold is unpainted");
  const gutter = createEmptyLayers();
  gutter.sharp[0] = 255; // invalid atlas texel
  assert.deepEqual(reduceRegions(gutter), []);
  assert.deepEqual(reduceRegions(createEmptyLayers()), [], "an explicit empty map has no observations");
});

test("reduced observations satisfy the shared entry contract in a stable order", () => {
  const engine = new PaintEngine(atlas);
  for (const [layer, spot] of [["tingling", "left-thigh-middle"], ["burning", "left-thigh-middle"], ["aching", "lower-back"], ["sharp", "left-index-tip"]] as const) {
    engine.beginStroke({ layer, tool: "brush", intensity: 200, radius: .02 }); engine.strokeTo(landmark(spot)); engine.endStroke();
  }
  const observations = reduceRegions(engine.peek());
  assert.deepEqual(observations.map(o => `${o.regionId}:${o.painType}`), ["back-lower-torso:aching", "left-thigh:burning", "left-thigh:tingling", "left-index-finger:sharp"]);
  const entry = parseDailyEntry({
    id: "e", profileId: "p", localDate: "2026-10-17", timeZone: "UTC", updatedAt: "2026-10-17T12:00:00.000Z", schemaVersion: SCHEMA_VERSION, bodyMapVersion: BODY_MAP_VERSION,
    maps: { bodyMapVersion: BODY_MAP_VERSION, width: MAP_SIZE, height: MAP_SIZE, encoding: "png-base64", layers: { burning: "x", sharp: "x", aching: "x", tingling: "x" } }, observations,
  });
  assert.equal(entry.observations.length, 4);
});

test("the embedded region raster and the inspection image both match the atlas built from the asset", async () => {
  const raster = getRegionRaster();
  assert.deepEqual(raster.regionOf, atlas.regionOf);
  assert.deepEqual(raster.regionTexelCount, atlas.regionTexelCount);
  const png = readFileSync(`public/body/region-atlas-${BODY_MAP_VERSION}.png`);
  assert.deepEqual(await decodeGrayPng(new Uint8Array(png), MAP_SIZE, MAP_SIZE), regionIdRaster(atlas));
});
