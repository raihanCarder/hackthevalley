import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { inflateSync } from "node:zlib";
import { BODY_MAP_VERSION, MAP_SIZE, PAIN_TYPES, SCHEMA_VERSION } from "../../src/domain/contracts";
import {
  createEmptyLayers, decodePaintSnapshot, encodePaintSnapshot, MapValidationError, MAX_ENTRY_PAYLOAD_BYTES, MAX_NOTE_CHARACTERS,
  PaintEngine, reduceRegions, validateEntryPayload,
} from "../../src/body/map-utils";
import { base64ToBytes, bytesToBase64, decodeGrayPng, encodeGrayPng } from "../../src/body/png";
import { atlas, landmark } from "./helpers";

function seeded(seed: number) { return () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32; }
function noiseLayers() {
  const random = seeded(7);
  const layers = createEmptyLayers();
  for (const type of PAIN_TYPES) for (let i = 0; i < layers[type].length; i++) layers[type][i] = random() < .5 ? 0 : Math.floor(random() * 256);
  return layers;
}
async function rejects(promise: Promise<unknown>, code: string) {
  await assert.rejects(promise, (error: unknown) => error instanceof MapValidationError && error.code === code);
}
function rewriteChunk(png: Uint8Array, type: string, edit: (data: Uint8Array) => void) {
  const copy = png.slice();
  const view = new DataView(copy.buffer);
  for (let offset = 8; offset < copy.length;) {
    const length = view.getUint32(offset);
    if (String.fromCharCode(...copy.subarray(offset + 4, offset + 8)) === type) {
      edit(copy.subarray(offset + 8, offset + 8 + length));
      let c = 0xffffffff;
      for (let i = offset + 4; i < offset + 8 + length; i++) { c ^= copy[i]; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; }
      view.setUint32(offset + 8 + length, (c ^ 0xffffffff) >>> 0);
    }
    offset += 12 + length;
  }
  return copy;
}
function entryFor(maps: object, extra: object = {}) {
  return { id: "e1", profileId: "visitor", localDate: "2026-10-17", timeZone: "America/Toronto", updatedAt: "2026-10-17T20:00:00.000Z", schemaVersion: SCHEMA_VERSION, bodyMapVersion: BODY_MAP_VERSION, maps, observations: [], ...extra };
}

test("all four layers round-trip exactly through lossless PNG, including full-range noise", async () => {
  for (const layers of [noiseLayers(), createEmptyLayers()]) {
    const snapshot = await encodePaintSnapshot(layers);
    assert.equal(snapshot.bodyMapVersion, BODY_MAP_VERSION);
    assert.deepEqual(await decodePaintSnapshot(JSON.parse(JSON.stringify(snapshot))), layers);
  }
  const engine = new PaintEngine(atlas);
  engine.beginStroke({ layer: "aching", tool: "brush", intensity: 140, radius: .05 }); engine.strokeTo(landmark("lower-back")); engine.endStroke();
  const snapshot = await encodePaintSnapshot(engine.peek());
  const total = PAIN_TYPES.reduce((sum, type) => sum + snapshot.layers[type].length, 0);
  assert.ok(total < 20_000, `sparse maps compress (${total} base64 chars)`);
});

test("encoder output is a standard PNG that zlib can inflate", async () => {
  const pixels = noiseLayers().burning;
  const png = await encodeGrayPng(pixels, MAP_SIZE, MAP_SIZE);
  const view = new DataView(png.buffer);
  const idatLength = view.getUint32(33);
  assert.equal(String.fromCharCode(...png.subarray(37, 41)), "IDAT");
  assert.equal(inflateSync(png.subarray(41, 41 + idatLength)).length, MAP_SIZE * (MAP_SIZE + 1));
  assert.deepEqual(base64ToBytes(bytesToBase64(png)), png);
  for (const text of ["", "QQ==", "QUI=", "QUJD"]) assert.equal(bytesToBase64(base64ToBytes(text)), text);
});

test("malformed images, dimensions, and formats are rejected with explicit codes", async () => {
  const good = await encodeGrayPng(new Uint8Array(MAP_SIZE * MAP_SIZE), MAP_SIZE, MAP_SIZE);
  await rejects(decodeGrayPng(good.slice(0, 40), MAP_SIZE, MAP_SIZE), "corrupt");
  await rejects(decodeGrayPng(new Uint8Array(100), MAP_SIZE, MAP_SIZE), "format");
  await rejects(decodeGrayPng(await encodeGrayPng(new Uint8Array(256 * 256), 256, 256), MAP_SIZE, MAP_SIZE), "dimensions");
  const flipped = good.slice(); flipped[50] ^= 0xff;
  await rejects(decodeGrayPng(flipped, MAP_SIZE, MAP_SIZE), "corrupt");
  await rejects(decodeGrayPng(rewriteChunk(good, "IHDR", data => { data[9] = 2; }), MAP_SIZE, MAP_SIZE), "format"); // RGB
  await rejects(decodeGrayPng(rewriteChunk(good, "IHDR", data => { data[8] = 16; }), MAP_SIZE, MAP_SIZE), "format");
  // Declares 512x512 but holds 511 rows of image data.
  const short = await encodeGrayPng(new Uint8Array(MAP_SIZE * 511), MAP_SIZE, 511);
  await rejects(decodeGrayPng(rewriteChunk(short, "IHDR", data => { new DataView(data.buffer, data.byteOffset).setUint32(4, MAP_SIZE); }), MAP_SIZE, MAP_SIZE), "corrupt");
  // Holds more data than declared (decompression is bounded).
  const tall = await encodeGrayPng(new Uint8Array(MAP_SIZE * 600), MAP_SIZE, 600);
  await rejects(decodeGrayPng(rewriteChunk(tall, "IHDR", data => { new DataView(data.buffer, data.byteOffset).setUint32(4, MAP_SIZE); }), MAP_SIZE, MAP_SIZE), "corrupt");
  const snapshot = await encodePaintSnapshot(createEmptyLayers());
  await rejects(decodePaintSnapshot({ ...snapshot, layers: { ...snapshot.layers, sharp: "not base64!" } }), "corrupt");
  await rejects(decodePaintSnapshot({ ...snapshot, layers: { aching: snapshot.layers.aching } }), "format");
  await rejects(decodePaintSnapshot({ ...snapshot, width: 256 }), "dimensions");
  await rejects(decodePaintSnapshot({ ...snapshot, encoding: "raw" }), "format");
  await rejects(decodePaintSnapshot({ ...snapshot, layers: { ...snapshot.layers, burning: "A".repeat(MAX_ENTRY_PAYLOAD_BYTES) } }), "too-large");
});

test("incompatible body-map versions are rejected rather than remapped or emptied", async () => {
  const snapshot = await encodePaintSnapshot(createEmptyLayers());
  await rejects(decodePaintSnapshot({ ...snapshot, bodyMapVersion: "mannequin-v1" }), "version");
  await rejects(validateEntryPayload(entryFor(snapshot, { bodyMapVersion: "mannequin-v0" })), "version");
  await rejects(validateEntryPayload(entryFor({ ...snapshot, bodyMapVersion: "mannequin-v0" })), "version");
  await rejects(validateEntryPayload(entryFor(snapshot, { schemaVersion: 99 })), "version");
});

test("entry payload validation bounds size and notes and recomputes observations on the server", async () => {
  const engine = new PaintEngine(atlas);
  engine.beginStroke({ layer: "burning", tool: "brush", intensity: 230, radius: .05 }); engine.strokeTo(landmark("left-thigh-middle")); engine.endStroke();
  const maps = await encodePaintSnapshot(engine.peek());
  const honest = await validateEntryPayload(entryFor(maps, { observations: reduceRegions(engine.peek()), note: "Worse after sitting." }));
  assert.equal(honest.submittedObservationsMatched, true);
  assert.deepEqual(honest.layers, engine.peek());
  assert.equal(honest.entry.note, "Worse after sitting.");

  const inflated = await validateEntryPayload(entryFor(maps, { observations: [{ regionId: "head", painType: "sharp", meanIntensity: 9, peakIntensity: 10, mapCoverage: 1 }] }));
  assert.equal(inflated.submittedObservationsMatched, false);
  assert.deepEqual(inflated.entry.observations.map(o => o.regionId), ["left-thigh"], "client counts are replaced by recomputed values");

  await validateEntryPayload(entryFor(maps, { note: "😀".repeat(MAX_NOTE_CHARACTERS) })); // code points, not UTF-16 units
  await rejects(validateEntryPayload(entryFor(maps, { note: "a".repeat(MAX_NOTE_CHARACTERS + 1) })), "note-too-long");
  await rejects(validateEntryPayload(entryFor(maps), { byteLength: MAX_ENTRY_PAYLOAD_BYTES + 1 }), "too-large");
  await rejects(validateEntryPayload(entryFor(maps, { localDate: "2026-02-30" })), "format");
  const empty = await validateEntryPayload(entryFor(await encodePaintSnapshot(createEmptyLayers())));
  assert.deepEqual(empty.entry.observations, [], "an explicitly saved empty map is valid and has no observations");
});

test("server-consumed map utilities import no browser, React, or Three.js modules", () => {
  assert.equal(typeof (globalThis as { window?: unknown }).window, "undefined");
  const seen = new Set<string>();
  const visit = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /from "(three|react|react-dom|next)[/"]|document\.|window\./, `${file} must stay server-safe`);
    for (const [, path] of source.matchAll(/from "(\.{1,2}\/[^"]+)"/g)) visit(join(dirname(file), path) + ".ts");
  };
  visit("src/body/map-utils.ts");
  assert.ok(seen.size >= 7);
});
