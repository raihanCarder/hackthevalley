import test from "node:test";
import assert from "node:assert/strict";
import { PAIN_TYPES } from "../../src/domain/contracts";
import { PaintEngine, type StrokeOptions } from "../../src/body/paint-engine";
import { createEmptyLayers, intensityToByte, MAX_UNDO_STROKES, TEXEL_COUNT } from "../../src/body/layers";
import { surfaceHitNear, texelPosition } from "../../src/body/atlas";
import { reduceRegions } from "../../src/body/regions";
import { asset, atlas, fromFront, landmark, paintedTexels, regionPainted, texelNormal } from "./helpers";

const brush = (layer: (typeof PAIN_TYPES)[number], intensity: number, radius = .035): StrokeOptions => ({ layer, tool: "brush", intensity: intensityToByte(intensity), radius });
function paint(engine: PaintEngine, options: StrokeOptions, ...hits: (ReturnType<typeof fromFront>)[]) {
  engine.beginStroke(options);
  for (const hit of hits) engine.strokeTo(hit);
  return engine.endStroke();
}
const texelArea = 1 / asset.texelsPerMetre ** 2;

test("painting marks the hit surface with a soft edge and misses leave no mark", () => {
  const engine = new PaintEngine(atlas);
  const hit = landmark("left-calf-middle");
  assert.equal(hit.region, "left-calf");
  paint(engine, brush("aching", 6), hit);
  const layer = engine.peek().aching;
  let peak = 0;
  const values = new Set<number>();
  for (let texel = 0; texel < TEXEL_COUNT; texel++) if (layer[texel]) { peak = Math.max(peak, layer[texel]); values.add(layer[texel]); }
  assert.equal(peak, intensityToByte(6), "centre reaches the selected intensity");
  assert.ok(values.size > 5, "soft falloff produces intermediate values");

  const missed = new PaintEngine(atlas);
  assert.equal(fromFront(.9, 1.9), null, "ray beside the body misses");
  assert.equal(paint(missed, brush("burning", 9), null, fromFront(.9, 1.9), null), false);
  assert.ok(missed.isEmpty());
  assert.equal(missed.canUndo, false, "a stroke that marked nothing is not an undo step");
});

test("a stamp centred on a UV chart seam covers the full area on both sides", () => {
  // Geodesic distance runs on the welded surface, so chart boundaries never cut a mark short.
  const chartsOfVertex = new Map<number, Set<number>>();
  asset.charts.forEach((chart, id) => {
    for (let v = chart.vertexStart; v < chart.vertexStart + chart.vertexCount; v++) {
      const welded = asset.weld[v];
      chartsOfVertex.set(welded, (chartsOfVertex.get(welded) ?? new Set()).add(id));
    }
  });
  for (const name of ["left-calf-middle", "abdomen", "lower-back", "left-upper-arm"]) {
    // The seam vertex (shared by two charts, at least one in this region) nearest the landmark.
    const mark = landmark(name);
    let seam = -1, best = Infinity;
    for (const [welded, charts] of chartsOfVertex) {
      if (charts.size < 2 || ![...charts].some(id => asset.charts[id].regionId === mark.region)) continue;
      const d = Math.hypot(atlas.vertices[welded * 3] - mark.point[0], atlas.vertices[welded * 3 + 1] - mark.point[1], atlas.vertices[welded * 3 + 2] - mark.point[2]);
      if (d < best) { best = d; seam = welded; }
    }
    assert.ok(seam >= 0, `${name}: has a seam`);
    const hit = { point: [atlas.vertices[seam * 3], atlas.vertices[seam * 3 + 1], atlas.vertices[seam * 3 + 2]] as [number, number, number], triangle: atlas.vertexTriangles[atlas.vertexTriangleStart[seam]] };
    const engine = new PaintEngine(atlas);
    const radius = .04;
    engine.beginStroke(brush("burning", 10, radius)); engine.strokeTo(hit); engine.endStroke();
    const layer = engine.peek().burning;
    const touched = new Set<number>();
    let area = 0;
    for (let texel = 0; texel < TEXEL_COUNT; texel++) if (layer[texel] >= 13) {
      area += texelArea;
      const t = atlas.triangleOf[texel];
      touched.add(asset.charts.findIndex(chart => t >= chart.triangleStart && t < chart.triangleStart + chart.triangleCount));
    }
    const expected = Math.PI * (radius * .93) ** 2;
    for (const id of chartsOfVertex.get(seam)!) assert.ok(touched.has(id), `${name}: paint reaches chart ${id} on both sides of the seam`);
    assert.ok(area > expected * .6 && area < expected * 2.2, `${name}: painted area ${(area * 1e4).toFixed(1)} cm² vs ${(expected * 1e4).toFixed(1)} cm²`);
  }
});

test("geodesic stamps never cross gaps: fingertips, the back of the hand, and thin parts", () => {
  const engine = new PaintEngine(atlas);
  paint(engine, brush("sharp", 10, .03), landmark("left-index-tip"));
  assert.ok(regionPainted(engine.peek().sharp, "left-index-finger") > 0);
  for (const other of ["left-middle-finger", "left-thumb", "left-ring-finger", "left-little-finger", "left-thigh"] as const) {
    assert.equal(regionPainted(engine.peek().sharp, other), 0, `index fingertip paint stays off ${other}`);
  }

  const hand = new PaintEngine(atlas);
  const back = landmark("left-hand-back");
  paint(hand, brush("aching", 10, .025), back);
  const hitNormal = texelNormal(atlas.triangleTexels[atlas.triangleTexelStart[back.triangle]]);
  const layer = hand.peek().aching;
  let palm = 0;
  for (let texel = 0; texel < TEXEL_COUNT; texel++) {
    if (layer[texel] < 13) continue;
    const n = texelNormal(texel);
    if (n[0] * hitNormal[0] + n[1] * hitNormal[1] + n[2] * hitNormal[2] < -.3) palm++;
  }
  assert.equal(palm, 0, "back-of-hand paint does not reach the palm");

  const ear = new PaintEngine(atlas);
  paint(ear, brush("tingling", 10, .015), landmark("left-ear"));
  assert.ok(regionPainted(ear.peek().tingling, "left-ear") > 0);
  assert.equal(regionPainted(ear.peek().tingling, "right-ear"), 0);
});

test("maximum blending: repeated or weaker passes never inflate or reduce a mark", () => {
  const engine = new PaintEngine(atlas);
  const hit = landmark("left-thigh-middle");
  for (let i = 0; i < 5; i++) paint(engine, brush("burning", 4), hit);
  const once = engine.snapshot().burning;
  assert.equal(once.reduce((max, value) => Math.max(max, value), 0), intensityToByte(4));
  paint(engine, brush("burning", 2), hit);
  assert.deepEqual(engine.peek().burning, once);
});

test("overlapping sensations stay independent; erasing affects only the selected layer", () => {
  const engine = new PaintEngine(atlas);
  const hit = landmark("lower-back");
  paint(engine, brush("aching", 4), hit);
  paint(engine, brush("burning", 7), hit);
  const centre = (layer: Uint8Array) => layer.reduce((max, value) => Math.max(max, value), 0);
  assert.equal(centre(engine.peek().aching), intensityToByte(4));
  assert.equal(centre(engine.peek().burning), intensityToByte(7));
  const aching = engine.snapshot().aching;
  paint(engine, { layer: "burning", tool: "eraser", intensity: 0, radius: .06 }, hit);
  assert.equal(paintedTexels(engine.peek().burning, 1), 0);
  assert.deepEqual(engine.peek().aching, aching, "aching survives erasing burning");
  assert.deepEqual(reduceRegions(engine.peek()).map(o => `${o.regionId}:${o.painType}`), ["back-lower-torso:aching"]);
});

test("undo restores the prior map of one layer, is bounded to ten strokes, and cancel discards a stroke", () => {
  const engine = new PaintEngine(atlas);
  paint(engine, brush("tingling", 5), landmark("right-thigh-middle"));
  const before = engine.snapshot();
  paint(engine, brush("sharp", 9), landmark("right-thigh-middle"));
  paint(engine, brush("tingling", 9), landmark("right-thigh-middle"));
  assert.ok(engine.undo());
  assert.ok(engine.undo());
  assert.deepEqual(engine.snapshot(), before);

  const bounded = new PaintEngine(atlas);
  const spots = ["chest", "abdomen", "left-upper-arm", "right-upper-arm", "left-forearm", "right-forearm", "left-thigh-upper", "right-thigh-upper", "left-calf-upper", "right-calf-upper", "forehead", "upper-back", "lower-back", "neck-front"];
  for (const [i, spot] of spots.entries()) paint(bounded, brush("aching", 1 + (i % 10), .02), landmark(spot));
  let undone = 0;
  while (bounded.undo()) undone++;
  assert.equal(undone, MAX_UNDO_STROKES);
  assert.ok(!bounded.isEmpty(), "strokes older than the undo window remain");

  const cancelled = new PaintEngine(atlas);
  cancelled.beginStroke(brush("burning", 8));
  cancelled.strokeTo(landmark("left-thigh-middle"));
  assert.ok(paintedTexels(cancelled.peek().burning) > 0, "stroke is visible while in progress");
  cancelled.cancelStroke();
  assert.ok(cancelled.isEmpty());
  assert.equal(cancelled.canUndo, false);
});

test("snapshots and loads never alias engine buffers", () => {
  const engine = new PaintEngine(atlas);
  paint(engine, brush("aching", 5), landmark("left-calf-middle"));
  const snapshot = engine.snapshot();
  snapshot.aching.fill(255);
  assert.notEqual(engine.peek().aching[0], 255);
  const valid = atlas.triangleTexels[0];
  const source = createEmptyLayers();
  source.sharp[valid] = 200;
  engine.load(source);
  source.sharp.fill(0);
  assert.equal(engine.peek().sharp[valid], 200);
  assert.equal(engine.canUndo, false, "loading a map starts a fresh undo history");
});

test("fast strokes are joined along the surface without gaps, but never bridge separate fingers or a jump", () => {
  const engine = new PaintEngine(atlas);
  const top = landmark("left-thigh-upper"), bottom = landmark("left-thigh-lower");
  // Surface samples about 5 cm apart (fast pointer moves; the renderer itself samples every half brush radius).
  const samples = [0, .2, .4, .6, .8, 1].map(t => surfaceHitNear(atlas, [0, 1, 2].map(axis => top.point[axis] + (bottom.point[axis] - top.point[axis]) * t) as [number, number, number]));
  paint(engine, brush("aching", 7, .02), ...samples.map(hit => ({ ...hit, texel: -1, region: top.region })));
  // Every surface point near the straight path between the two samples is painted.
  const layer = engine.peek().aching;
  const thigh = atlas.triangleRegion[top.triangle];
  const [a, b] = [top.point, bottom.point];
  const p: [number, number, number] = [0, 0, 0];
  for (let t = 0; t <= 1.0001; t += .05) {
    const target = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    let nearest = -1, best = Infinity;
    for (let texel = 0; texel < TEXEL_COUNT; texel++) {
      if (atlas.regionOf[texel] !== thigh) continue;
      texelPosition(atlas, texel, p);
      const d = (p[0] - target[0]) ** 2 + (p[1] - target[1]) ** 2 + (p[2] - target[2]) ** 2;
      if (d < best) { best = d; nearest = texel; }
    }
    if (Math.sqrt(best) < .012) assert.ok(layer[nearest] >= 13, `gap at ${(t * 100).toFixed(0)}% of the stroke`);
  }

  // Index fingertip to middle fingertip: close in space, far along the skin, so two separate marks.
  const index = landmark("left-index-tip"), middle = landmark("left-middle-tip");
  const joined = new PaintEngine(atlas);
  paint(joined, brush("burning", 7, .012), index, middle);
  const separate = new PaintEngine(atlas);
  paint(separate, brush("burning", 7, .012), index);
  paint(separate, brush("burning", 7, .012), middle);
  assert.deepEqual(joined.peek().burning, separate.peek().burning);
  assert.equal(regionPainted(joined.peek().burning, "left-hand"), 0, "no paint across the back of the hand between fingertips");

  // A miss between samples (dragging off the body) breaks the path as well.
  const broken = new PaintEngine(atlas);
  paint(broken, brush("burning", 7, .02), top, null, bottom);
  const unbroken = new PaintEngine(atlas);
  paint(unbroken, brush("burning", 7, .02), top);
  paint(unbroken, brush("burning", 7, .02), bottom);
  assert.deepEqual(broken.peek().burning, unbroken.peek().burning);
});

test("retracing a stroke with the eraser removes it completely, including the soft rim", () => {
  const engine = new PaintEngine(atlas);
  const path = ["right-thigh-upper", "right-thigh-middle", "right-thigh-lower"].map(landmark);
  paint(engine, brush("burning", 7), ...path);
  paint(engine, { layer: "burning", tool: "eraser", intensity: 0, radius: .035 }, ...path);
  assert.equal(paintedTexels(engine.peek().burning, 1), 0);
  assert.ok(engine.undo());
  assert.ok(paintedTexels(engine.peek().burning) > 0, "undo restores the erased stroke");
});
