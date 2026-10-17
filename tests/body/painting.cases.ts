import test from "node:test";
import assert from "node:assert/strict";
import { PAIN_TYPES } from "../../src/domain/contracts";
import { PaintEngine, type StrokeOptions } from "../../src/body/paint-engine";
import { createEmptyLayers, intensityToByte, MAX_UNDO_STROKES } from "../../src/body/layers";
import { reduceRegions } from "../../src/body/regions";
import { atlas, fromBack, fromFront, islandOf, islandPainted, paintedTexels, raycast } from "./helpers";

const brush = (layer: (typeof PAIN_TYPES)[number], intensity: number, radius = .035): StrokeOptions => ({ layer, tool: "brush", intensity: intensityToByte(intensity), radius });
function paint(engine: PaintEngine, options: StrokeOptions, ...hits: (ReturnType<typeof fromFront>)[]) {
  engine.beginStroke(options);
  for (const hit of hits) engine.strokeTo(hit);
  return engine.endStroke();
}

test("raycast-to-UV painting marks the hit surface with a soft edge and misses leave no mark", () => {
  const engine = new PaintEngine(atlas);
  const hit = fromFront(.135, .33)!;
  assert.equal(atlas.islands[hit.island].regionId, "left-calf");
  paint(engine, brush("aching", 6), hit);
  const layer = engine.peek().aching;
  assert.equal(layer[hit.texel], intensityToByte(6), "centre reaches the selected intensity");
  const values = new Set(Array.from(atlas.islandTexels[hit.island], texel => layer[texel]).filter(Boolean));
  assert.ok(values.size > 5, "soft falloff produces intermediate values");

  const missed = new PaintEngine(atlas);
  assert.equal(fromFront(.7, 1.6), null, "ray beside the body misses");
  assert.equal(paint(missed, brush("burning", 9), null, fromFront(.7, 1.6), null), false);
  assert.ok(missed.isEmpty());
  assert.equal(missed.canUndo, false, "a stroke that marked nothing is not an undo step");
});

test("maximum blending: repeated or weaker passes never inflate or reduce a mark", () => {
  const engine = new PaintEngine(atlas);
  const hit = fromFront(.12, .75)!;
  for (let i = 0; i < 5; i++) paint(engine, brush("burning", 4), hit);
  const once = engine.snapshot().burning;
  assert.equal(once.reduce((max, value) => Math.max(max, value), 0), intensityToByte(4));
  paint(engine, brush("burning", 2), hit);
  assert.deepEqual(engine.peek().burning, once);
});

test("overlapping sensations stay independent; erasing affects only the selected layer", () => {
  const engine = new PaintEngine(atlas);
  const hit = fromBack(0, 1.15)!;
  paint(engine, brush("aching", 4), hit);
  paint(engine, brush("burning", 7), hit);
  assert.equal(engine.peek().aching[hit.texel], intensityToByte(4));
  assert.equal(engine.peek().burning[hit.texel], intensityToByte(7));
  const aching = engine.snapshot().aching;
  paint(engine, { layer: "burning", tool: "eraser", intensity: 0, radius: .06 }, hit);
  assert.equal(engine.peek().burning[hit.texel], 0);
  assert.deepEqual(engine.peek().aching, aching, "aching survives erasing burning");
  const observations = reduceRegions(engine.peek(), atlas);
  assert.deepEqual(observations.map(o => `${o.regionId}:${o.painType}`), ["back-lower-torso:aching"]);
});

test("undo restores the prior map of one layer, is bounded to ten strokes, and cancel discards a stroke", () => {
  const engine = new PaintEngine(atlas);
  paint(engine, brush("tingling", 5), fromFront(-.12, .75));
  const before = engine.snapshot();
  paint(engine, brush("sharp", 9), fromFront(-.12, .75));
  paint(engine, brush("tingling", 9), fromFront(-.12, .75));
  assert.ok(engine.undo());
  assert.ok(engine.undo());
  assert.deepEqual(engine.snapshot(), before);

  const bounded = new PaintEngine(atlas);
  for (let i = 0; i < MAX_UNDO_STROKES + 4; i++) paint(bounded, brush("aching", 1 + (i % 10)), fromFront(-.4 + i * .06, 1.3));
  let undone = 0;
  while (bounded.undo()) undone++;
  assert.equal(undone, MAX_UNDO_STROKES);
  assert.ok(!bounded.isEmpty(), "strokes older than the undo window remain");

  const cancelled = new PaintEngine(atlas);
  cancelled.beginStroke(brush("burning", 8));
  cancelled.strokeTo(fromFront(.12, .75));
  assert.ok(paintedTexels(cancelled.peek().burning) > 0, "stroke is visible while in progress");
  cancelled.cancelStroke();
  assert.ok(cancelled.isEmpty());
  assert.equal(cancelled.canUndo, false);
});

test("snapshots and loads never alias engine buffers", () => {
  const engine = new PaintEngine(atlas);
  paint(engine, brush("aching", 5), fromFront(.135, .33));
  const snapshot = engine.snapshot();
  snapshot.aching.fill(255);
  assert.notEqual(engine.peek().aching[0], 255);
  const source = createEmptyLayers();
  source.sharp[atlas.islandTexels[0][0]] = 200;
  engine.load(source);
  source.sharp.fill(0);
  assert.equal(engine.peek().sharp[atlas.islandTexels[0][0]], 200);
  assert.equal(engine.canUndo, false, "loading a map starts a fresh undo history");
  const viewer = new PaintEngine(atlas, engine.snapshot());
  paint(engine, brush("burning", 9), fromFront(.12, .75));
  assert.ok(new PaintEngine(atlas, viewer.snapshot()).peek().burning.every(value => value === 0), "a separately loaded copy is unaffected by later edits");
});

test("front painting does not mark the back of thin limbs", () => {
  const engine = new PaintEngine(atlas);
  for (const [x, y, region] of [[.51, .89, "left-hand"], [.135, .33, "left-calf"]] as const) {
    const hit = fromFront(x, y)!;
    assert.equal(atlas.islands[hit.island].regionId, region);
    paint(engine, brush("sharp", 10, .08), hit);
    assert.ok(islandPainted(engine.peek().sharp, islandOf(region, "front")) > 0);
    assert.equal(islandPainted(engine.peek().sharp, islandOf(region, "back")), 0, `${region} back stays clean`);
  }
});

test("seam neighbours: a mark on the side of a limb continues across its front/back seam", () => {
  const engine = new PaintEngine(atlas);
  const side = raycast([2, .33, -.005], [-1, 0, 0])!; // patient-left side of the left calf
  assert.equal(atlas.islands[side.island].regionId, "left-calf");
  paint(engine, brush("burning", 8), side);
  assert.ok(islandPainted(engine.peek().burning, islandOf("left-calf", "front")) > 0);
  assert.ok(islandPainted(engine.peek().burning, islandOf("left-calf", "back")) > 0);
  assert.equal(islandPainted(engine.peek().burning, islandOf("left-thigh", "front")), 0);
});

test("fast strokes are interpolated without gaps, but never bridge unrelated surfaces", () => {
  const engine = new PaintEngine(atlas);
  const top = fromFront(.12, .82)!, bottom = fromFront(.12, .5)!;
  assert.equal(top.island, bottom.island);
  // The renderer raycasts screen samples at most ~half a brush radius apart; the engine must still join samples
  // that arrive several radii apart (fast pointer events), here every 6 cm with a 2 cm brush.
  const samples = [.82, .76, .7, .64, .58, .52, .5].map(y => fromFront(.12, y));
  paint(engine, brush("aching", 7, .02), ...samples);
  for (let y = .82; y >= .5; y -= .01) {
    const sample = fromFront(.12, y)!;
    assert.ok(engine.peek().aching[sample.texel] >= 13, `gap at y=${y.toFixed(2)}`);
  }

  // Right thigh to left thigh in one jump: unrelated islands, so only two separate stamps.
  const right = fromFront(-.12, .75)!, left = fromFront(.12, .75)!;
  const joined = new PaintEngine(atlas);
  paint(joined, brush("burning", 7), right, left);
  const separate = new PaintEngine(atlas);
  paint(separate, brush("burning", 7), right);
  paint(separate, brush("burning", 7), left);
  assert.deepEqual(joined.peek().burning, separate.peek().burning);
  assert.deepEqual(reduceRegions(joined.peek(), atlas).map(o => o.regionId), ["left-thigh", "right-thigh"]);

  // A miss between samples (dragging off the body) breaks the path as well.
  const broken = new PaintEngine(atlas);
  paint(broken, brush("burning", 7, .02), top, null, bottom);
  assert.ok(broken.peek().burning[fromFront(.12, .66)!.texel] < 13);
});

test("retracing a stroke with the eraser removes it completely, including the soft rim", () => {
  const engine = new PaintEngine(atlas);
  const path = [.8, .74, .68, .62].map(y => fromFront(-.12, y));
  paint(engine, brush("burning", 7), ...path);
  paint(engine, { layer: "burning", tool: "eraser", intensity: 0, radius: .035 }, ...path);
  assert.equal(paintedTexels(engine.peek().burning, 1), 0);
  assert.ok(engine.undo());
  assert.ok(paintedTexels(engine.peek().burning) > 0, "undo restores the erased stroke");
});
