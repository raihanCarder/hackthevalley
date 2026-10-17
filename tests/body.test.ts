import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { generateMannequin } from "../src/body/mannequin";
import { REGION_IDS } from "../src/domain/contracts";

const asset = generateMannequin();
test("checked-in asset matches its reproducible source and retains attribution", () => {
  const digest = (value: string) => createHash("sha256").update(value).digest("hex");
  assert.equal(digest(readFileSync("public/body/mannequin-v1.json", "utf8").trim()), digest(JSON.stringify(asset)));
  assert.match(readFileSync("public/body/LICENSE.txt", "utf8"), /Permission is hereby granted/);
  assert.match(readFileSync("public/body/PROVENANCE.md", "utf8"), /mannequin-v1/);
});
test("all regions have front and back surfaces and disjoint UV islands", () => {
  assert.deepEqual(new Set(asset.islands.map(island => island.regionId)), new Set(REGION_IDS));
  for (const island of asset.islands) {
    const [u0, v0, u1, v1] = island.bounds;
    assert.ok(u0 > 0 && v0 > 0 && u1 < 1 && v1 < 1);
    for (let vertex = island.vertexStart; vertex < island.vertexStart + island.vertexCount; vertex++) {
      assert.ok(asset.uvs[vertex * 2] >= u0 && asset.uvs[vertex * 2] <= u1);
      assert.ok(asset.uvs[vertex * 2 + 1] >= v0 && asset.uvs[vertex * 2 + 1] <= v1);
    }
    for (const other of asset.islands) if (other.id !== island.id) {
      const [a, b, c, d] = other.bounds;
      assert.ok(u1 <= a || c <= u0 || v1 <= b || d <= v0, `Overlapping UV islands ${island.id}/${other.id}`);
    }
  }
  for (const region of REGION_IDS.filter(id => !id.includes("torso"))) {
    assert.deepEqual(new Set(asset.islands.filter(island => island.regionId === region).map(island => island.side)), new Set(["front", "back"]));
  }
});
test("each mesh triangle is nondegenerate in both model space and UV space with outward winding", () => {
  for (let i = 0; i < asset.indices.length; i += 3) {
    const [a, b, c] = asset.indices.slice(i, i + 3);
    const edge1 = [0, 1, 2].map(axis => asset.positions[b * 3 + axis] - asset.positions[a * 3 + axis]);
    const edge2 = [0, 1, 2].map(axis => asset.positions[c * 3 + axis] - asset.positions[a * 3 + axis]);
    const normal = [edge1[1] * edge2[2] - edge1[2] * edge2[1], edge1[2] * edge2[0] - edge1[0] * edge2[2], edge1[0] * edge2[1] - edge1[1] * edge2[0]];
    assert.ok(Math.hypot(...normal) > 1e-9);
    assert.ok(normal.reduce((sum, n, axis) => sum + n * asset.normals[a * 3 + axis], 0) > 0);
    const uvArea = (asset.uvs[b * 2] - asset.uvs[a * 2]) * (asset.uvs[c * 2 + 1] - asset.uvs[a * 2 + 1]) - (asset.uvs[c * 2] - asset.uvs[a * 2]) * (asset.uvs[b * 2 + 1] - asset.uvs[a * 2 + 1]);
    assert.ok(Math.abs(uvArea) > 1e-9);
  }
});
test("patient-left and patient-right hands and legs are not mirrored in model space", () => {
  for (const island of asset.islands.filter(island => /hand|thigh|calf/.test(island.regionId))) {
    const xs = Array.from({ length: island.vertexCount }, (_, n) => asset.positions[(island.vertexStart + n) * 3]);
    assert.ok(island.regionId.startsWith("left") ? Math.min(...xs) > 0 : Math.max(...xs) < 0);
  }
});

// Feature cases live under tests/body/ (not *.test.ts) so the top-level runner glob loads them exactly once.
import "./body/painting.cases";
import "./body/regions.cases";
import "./body/map-codec.cases";
