import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MAP_SIZE, parseDailyEntry, REGION_IDS, BODY_MAP_VERSION, SCHEMA_VERSION } from "../../src/domain/contracts";
import { regionIdRaster } from "../../src/body/atlas";
import { createEmptyLayers, intensityToByte, PRESENCE_THRESHOLD, TEXEL_COUNT } from "../../src/body/layers";
import { PaintEngine } from "../../src/body/paint-engine";
import { decodeGrayPng } from "../../src/body/png";
import { reduceRegions } from "../../src/body/regions";
import { asset, atlas, fromBack, fromFront, raycast } from "./helpers";

const regionAt = (hit: ReturnType<typeof fromFront>) => REGION_IDS[atlas.regionOf[hit!.texel]];

test("atlas texels stay inside their island tiles; gutters and unused texels are invalid", () => {
  for (let texel = 0; texel < TEXEL_COUNT; texel++) {
    const island = atlas.islandOf[texel];
    if (island < 0) { assert.equal(atlas.regionOf[texel], -1); continue; }
    const [u0, v0, u1, v1] = atlas.islands[island].bounds;
    const u = (texel % MAP_SIZE + .5) / MAP_SIZE, v = 1 - (Math.floor(texel / MAP_SIZE) + .5) / MAP_SIZE;
    assert.ok(u > u0 && u < u1 && v > v0 && v < v1, `texel ${texel} outside island ${island}`);
    assert.equal(REGION_IDS[atlas.regionOf[texel]], atlas.islands[island].regionId);
  }
  assert.equal(atlas.islandOf[0], -1);
  for (const [index, count] of atlas.regionTexelCount.entries()) assert.ok(count > 2000, `${REGION_IDS[index]} has texels`);
  assert.equal(atlas.islandTexels.length, asset.islands.length);
});

test("known lower-back, abdomen, and patient-left/right calf patches map to the correct regions", () => {
  assert.equal(regionAt(fromBack(0, 1.15)), "back-lower-torso");
  assert.equal(regionAt(fromFront(0, 1.15)), "front-lower-torso");
  assert.equal(regionAt(fromBack(0, 1.45)), "back-upper-torso");
  assert.equal(regionAt(fromFront(.135, .33)), "left-calf", "patient-left is +X, the viewer's right from the front");
  assert.equal(regionAt(fromFront(-.135, .33)), "right-calf");
  assert.equal(regionAt(fromBack(.135, .33)), "left-calf", "same patient side from behind");
  assert.equal(regionAt(raycast([.51, .89, 5], [0, 0, -1])), "left-hand");
  assert.equal(regionAt(fromFront(.12, .75)), "left-thigh");
});

test("painting only the left calf from the front yields left-calf observations and zero for the right calf", () => {
  const engine = new PaintEngine(atlas);
  engine.beginStroke({ layer: "aching", tool: "brush", intensity: intensityToByte(6), radius: .035 });
  engine.strokeTo(fromFront(.135, .4));
  engine.strokeTo(fromFront(.135, .25));
  engine.endStroke();
  const observations = reduceRegions(engine.peek(), atlas);
  assert.deepEqual(observations.map(o => o.regionId), ["left-calf"]);
  const [calf] = observations;
  assert.equal(calf.peakIntensity, 6);
  assert.ok(calf.mapCoverage > 0 && calf.mapCoverage < 1 && calf.meanIntensity > 0 && calf.meanIntensity < calf.peakIntensity);
  assert.ok(!observations.some(o => o.regionId === "right-calf"));
});

test("reducer: mean includes unpainted texels, peak is the maximum, coverage uses the presence threshold", () => {
  const layers = createEmptyLayers();
  const lowerBack = REGION_IDS.indexOf("back-lower-torso");
  const texels = [...atlas.islandTexels.entries()].filter(([island]) => atlas.islands[island].regionId === "back-lower-torso").flatMap(([, list]) => [...list]);
  const count = atlas.regionTexelCount[lowerBack];
  assert.equal(texels.length, count);
  texels.slice(0, 100).forEach(texel => { layers.aching[texel] = 255; });
  texels.slice(100, 300).forEach(texel => { layers.aching[texel] = 51; });
  texels.slice(300, 400).forEach(texel => { layers.aching[texel] = PRESENCE_THRESHOLD - 1; }); // residue, ignored
  const [observation, ...rest] = reduceRegions(layers, atlas);
  assert.equal(rest.length, 0);
  assert.equal(observation.regionId, "back-lower-torso");
  assert.equal(observation.painType, "aching");
  assert.equal(observation.peakIntensity, 10);
  assert.equal(observation.mapCoverage, Math.round(300 / count * 1e6) / 1e6);
  assert.equal(observation.meanIntensity, Math.round((100 * 255 + 200 * 51) / count / 255 * 10 * 1e4) / 1e4);

  const threshold = createEmptyLayers();
  threshold.burning[texels[0]] = PRESENCE_THRESHOLD;
  assert.equal(reduceRegions(threshold, atlas).length, 1, "a value at the threshold is present");
  threshold.burning[texels[0]] = PRESENCE_THRESHOLD - 1;
  assert.deepEqual(reduceRegions(threshold, atlas), [], "below the threshold is unpainted");

  const gutter = createEmptyLayers();
  gutter.sharp[0] = 255; // invalid atlas texel
  assert.deepEqual(reduceRegions(gutter, atlas), []);
  assert.deepEqual(reduceRegions(createEmptyLayers(), atlas), [], "an explicit empty map has no observations");
});

test("reduced observations satisfy the shared entry contract in a stable order", () => {
  const engine = new PaintEngine(atlas);
  for (const [layer, hit] of [["tingling", fromFront(.12, .75)], ["burning", fromFront(.12, .75)], ["aching", fromBack(0, 1.15)]] as const) {
    engine.beginStroke({ layer, tool: "brush", intensity: 200, radius: .05 }); engine.strokeTo(hit); engine.endStroke();
  }
  const observations = reduceRegions(engine.peek(), atlas);
  assert.deepEqual(observations.map(o => `${o.regionId}:${o.painType}`), ["back-lower-torso:aching", "left-thigh:burning", "left-thigh:tingling"]);
  const entry = parseDailyEntry({
    id: "e", profileId: "p", localDate: "2026-10-17", timeZone: "UTC", updatedAt: "2026-10-17T12:00:00.000Z", schemaVersion: SCHEMA_VERSION, bodyMapVersion: BODY_MAP_VERSION,
    maps: { bodyMapVersion: BODY_MAP_VERSION, width: MAP_SIZE, height: MAP_SIZE, encoding: "png-base64", layers: { burning: "x", sharp: "x", aching: "x", tingling: "x" } }, observations,
  });
  assert.equal(entry.observations.length, 3);
});

test("checked-in region-ID atlas image matches the generator", async () => {
  const png = readFileSync("public/body/region-atlas-mannequin-v1.png");
  const pixels = await decodeGrayPng(new Uint8Array(png), MAP_SIZE, MAP_SIZE);
  assert.deepEqual(pixels, regionIdRaster(atlas));
});
