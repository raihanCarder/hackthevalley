import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { BODY_MAP_VERSION, MAP_SIZE, REGION_IDS } from "../src/domain/contracts";
import { FOCUS_TARGETS } from "../src/body/mannequin";
import { encodeRegionRaster } from "../src/body/region-raster";
import { REGION_RASTER_RLE } from "../src/body/region-raster-data";
import { BODY_DIAGRAM } from "../src/body/diagram-data";
import { buildBody } from "../scripts/generate-body";
import { asset, atlas } from "./body/helpers";

test("the checked-in body asset, region raster, and 2D diagram reproduce from the pinned CC0 source mesh", () => {
  const built = buildBody();
  const digest = (value: string) => createHash("sha256").update(value).digest("hex");
  assert.equal(digest(readFileSync(`public/body/${BODY_MAP_VERSION}.json`, "utf8").trim()), digest(JSON.stringify(built.asset)));
  assert.deepEqual(BODY_DIAGRAM, JSON.parse(JSON.stringify(built.diagram)));
  assert.equal(REGION_RASTER_RLE, encodeRegionRaster(atlas.regionOf));
  assert.equal(asset.source.license, "CC0-1.0");
  assert.equal(createHash("sha256").update(readFileSync("scripts/body/source/makehuman-hm08-base.obj")).digest("hex"), asset.source.sha256);
  assert.match(readFileSync("scripts/body/source/LICENSE-CC0.md", "utf8"), /CC0 1\.0 Universal/);
  assert.match(readFileSync("public/body/PROVENANCE.md", "utf8"), /mannequin-v2[\s\S]*CC0/);
});

test("every region has its own UV charts; charts are disjoint and no texel is shared by two triangles", () => {
  assert.deepEqual(new Set(asset.charts.map(chart => chart.regionId)), new Set(REGION_IDS));
  const rects = asset.charts.map(chart => chart.bounds.map(n => n * MAP_SIZE));
  rects.forEach((a, i) => rects.forEach((b, j) => {
    if (i < j) assert.ok(a[2] + 4 <= b[0] || b[2] + 4 <= a[0] || a[3] + 4 <= b[1] || b[3] + 4 <= a[1], `charts ${i} and ${j} are closer than the display gutter`);
  }));
  // Rasterize every triangle with texel-centre sampling and count coverage: folds or overlaps would cover a texel twice.
  const coverage = new Uint8Array(MAP_SIZE * MAP_SIZE);
  for (let t = 0; t < asset.indices.length / 3; t++) {
    const p = [0, 1, 2].map(k => { const v = asset.indices[t * 3 + k]; return [asset.uvs[v * 2] * MAP_SIZE, (1 - asset.uvs[v * 2 + 1]) * MAP_SIZE]; });
    const area = (p[1][0] - p[0][0]) * (p[2][1] - p[0][1]) - (p[2][0] - p[0][0]) * (p[1][1] - p[0][1]);
    assert.ok(Math.abs(area) > 1e-9, `triangle ${t} is degenerate in UV space`);
    for (let row = Math.floor(Math.min(...p.map(q => q[1]))); row <= Math.ceil(Math.max(...p.map(q => q[1]))); row++) {
      for (let column = Math.floor(Math.min(...p.map(q => q[0]))); column <= Math.ceil(Math.max(...p.map(q => q[0]))); column++) {
        const x = column + .5, y = row + .5;
        const w = [0, 1, 2].map(k => { const [a, b] = [p[(k + 1) % 3], p[(k + 2) % 3]]; return ((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0])) / area; });
        if (w.every(value => value > 1e-4)) coverage[row * MAP_SIZE + column]++;
      }
    }
  }
  assert.equal(coverage.reduce((max, n) => Math.max(max, n), 0), 1);
});

test("triangles are non-degenerate with outward winding and smooth normals", () => {
  for (let i = 0; i < asset.indices.length; i += 3) {
    const [a, b, c] = asset.indices.slice(i, i + 3);
    const edge1 = [0, 1, 2].map(axis => asset.positions[b * 3 + axis] - asset.positions[a * 3 + axis]);
    const edge2 = [0, 1, 2].map(axis => asset.positions[c * 3 + axis] - asset.positions[a * 3 + axis]);
    const normal = [edge1[1] * edge2[2] - edge1[2] * edge2[1], edge1[2] * edge2[0] - edge1[0] * edge2[2], edge1[0] * edge2[1] - edge1[1] * edge2[0]];
    assert.ok(Math.hypot(...normal) > 1e-12);
    const vertexNormal = [0, 1, 2].map(axis => asset.normals[a * 3 + axis] + asset.normals[b * 3 + axis] + asset.normals[c * 3 + axis]);
    assert.ok(normal.reduce((sum, n, axis) => sum + n * vertexNormal[axis], 0) > 0, `triangle ${i / 3} faces inward`);
  }
  // Seams duplicate vertices for UVs only: duplicates share one position and one normal, so shading is smooth.
  const first = new Map<number, number>();
  asset.weld.forEach((welded, render) => {
    const original = first.get(welded);
    if (original === undefined) { first.set(welded, render); return; }
    for (let axis = 0; axis < 3; axis++) {
      assert.equal(asset.positions[render * 3 + axis], asset.positions[original * 3 + axis]);
      assert.equal(asset.normals[render * 3 + axis], asset.normals[original * 3 + axis]);
    }
  });
});

test("camera focus presets look at the face, each hand, and each foot from close by", () => {
  for (const target of FOCUS_TARGETS) {
    const preset = asset.focus[target];
    const reach = Math.hypot(...preset.position.map((n, axis) => n - preset.target[axis]));
    assert.ok(reach > .3 && reach < .8, `${target} camera distance ${reach}`);
    const sign = target.startsWith("left") ? 1 : target.startsWith("right") ? -1 : 0;
    if (sign) assert.ok(preset.target[0] * sign > .1, `${target} looks at the patient's own side`);
  }
  assert.ok(asset.focus["left-foot"].target[1] < .15 && asset.focus.face.target[1] > 1.7);
});

test("the 2D diagram is traced from the same regions: full body front/back plus face, hand, and foot close-ups", () => {
  const view = (id: string) => BODY_DIAGRAM.views.find(item => item.id === id)!;
  const regions = (id: string) => new Set(view(id).regions.map(region => region.regionId));
  assert.equal(BODY_DIAGRAM.bodyMapVersion, BODY_MAP_VERSION);
  for (const region of REGION_IDS) assert.ok(regions("front").has(region) || regions("back").has(region), `${region} appears on the front or back view`);
  assert.deepEqual(regions("face"), new Set(["head", "neck", "left-eye", "right-eye", "nose", "mouth", "left-ear", "right-ear"]));
  for (const side of ["left", "right"]) {
    assert.deepEqual(regions(`${side}-hand`), new Set(["hand", "thumb", "index-finger", "middle-finger", "ring-finger", "little-finger"].map(part => `${side}-${part}`)));
    assert.deepEqual(regions(`${side}-foot`), new Set(["foot", "big-toe", "second-toe", "third-toe", "fourth-toe", "little-toe"].map(part => `${side}-${part}`)));
  }
  for (const item of BODY_DIAGRAM.views) for (const region of item.regions) assert.match(region.d, /^M[\d .LZM]+$/);
});

// Feature cases live under tests/body/ (not *.test.ts) so the top-level runner glob loads them exactly once.
import "./body/painting.cases";
import "./body/regions.cases";
import "./body/map-codec.cases";
