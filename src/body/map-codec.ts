import { BODY_MAP_VERSION, MAP_SIZE, PAIN_TYPES, parseDailyEntry, SCHEMA_VERSION, type DailyEntry, type PaintSnapshot, type RegionalObservation } from "../domain/contracts";
import type { BodyAtlas } from "./atlas";
import { assertLayers, createEmptyLayers, type PaintLayers } from "./layers";
import { base64ToBytes, bytesToBase64, decodeGrayPng, encodeGrayPng, MapValidationError } from "./png";
import { reduceRegions } from "./regions";

/** A complete check-in request, including all four encoded maps and the note, may not exceed 6 MiB. */
export const MAX_ENTRY_PAYLOAD_BYTES = 6 * 1024 * 1024;
/** Original written notes are limited to 4,000 characters (Unicode code points). */
export const MAX_NOTE_CHARACTERS = 4000;

export async function encodePaintSnapshot(layers: PaintLayers): Promise<PaintSnapshot> {
  assertLayers(layers);
  const encoded = await Promise.all(PAIN_TYPES.map(async type => [type, bytesToBase64(await encodeGrayPng(layers[type], MAP_SIZE, MAP_SIZE))] as const));
  return { bodyMapVersion: BODY_MAP_VERSION, width: MAP_SIZE, height: MAP_SIZE, encoding: "png-base64", layers: Object.fromEntries(encoded) as PaintSnapshot["layers"] };
}

/** Validates and decodes a stored snapshot. Incompatible versions are rejected; never remapped or replaced with an empty map. */
export async function decodePaintSnapshot(value: unknown): Promise<PaintLayers> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new MapValidationError("format", "Expected a paint-map snapshot.");
  const snapshot = value as Record<string, unknown>;
  if (snapshot.bodyMapVersion !== BODY_MAP_VERSION) {
    throw new MapValidationError("version", `This painting was made for body map “${String(snapshot.bodyMapVersion)}” and can’t be shown on ${BODY_MAP_VERSION}.`);
  }
  if (snapshot.width !== MAP_SIZE || snapshot.height !== MAP_SIZE) throw new MapValidationError("dimensions", `Paint maps must be ${MAP_SIZE}x${MAP_SIZE}.`);
  if (snapshot.encoding !== "png-base64") throw new MapValidationError("format", "Unsupported paint-map encoding.");
  const encoded = snapshot.layers;
  if (!encoded || typeof encoded !== "object") throw new MapValidationError("format", "Expected four paint layers.");
  let total = 0;
  for (const type of PAIN_TYPES) {
    const layer = (encoded as Record<string, unknown>)[type];
    if (typeof layer !== "string" || !layer) throw new MapValidationError("format", `Missing the ${type} paint layer.`);
    total += layer.length;
  }
  if (total > MAX_ENTRY_PAYLOAD_BYTES) throw new MapValidationError("too-large", "Paint maps exceed the 6 MiB check-in limit.");
  const layers = createEmptyLayers();
  for (const type of PAIN_TYPES) layers[type] = await decodeGrayPng(base64ToBytes((encoded as Record<string, string>)[type]), MAP_SIZE, MAP_SIZE);
  return layers;
}

export interface ValidatedEntry {
  /** The parsed entry with observations recomputed from its decoded maps. */
  entry: DailyEntry;
  layers: PaintLayers;
  /** Whether the submitted observations agreed with the server-side recomputation. */
  submittedObservationsMatched: boolean;
}

function codePoints(text: string) { let count = 0; for (const _ of text) count++; return count; }

/**
 * Server/browser check-in payload validation: size, note length, versions, entry structure, and lossless map decoding.
 * Observations are recomputed with the shared reducer rather than trusting client-provided values.
 * `byteLength` should be the raw request size when available; otherwise the JSON size is measured.
 */
export async function validateEntryPayload(value: unknown, options: { byteLength?: number; atlas?: BodyAtlas } = {}): Promise<ValidatedEntry> {
  let size = options.byteLength;
  if (size === undefined) {
    try { size = new TextEncoder().encode(JSON.stringify(value)).length; } catch { throw new MapValidationError("format", "Check-in payload is not serializable."); }
  }
  if (size > MAX_ENTRY_PAYLOAD_BYTES) throw new MapValidationError("too-large", "Check-in exceeds the 6 MiB limit.");
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new MapValidationError("format", "Expected a check-in entry.");
  const raw = value as Record<string, unknown>;
  const maps = raw.maps as Record<string, unknown> | undefined;
  if (raw.bodyMapVersion !== BODY_MAP_VERSION || (maps && maps.bodyMapVersion !== BODY_MAP_VERSION)) {
    throw new MapValidationError("version", `This check-in uses an unsupported body map; only ${BODY_MAP_VERSION} can be restored.`);
  }
  if (raw.schemaVersion !== SCHEMA_VERSION) throw new MapValidationError("version", "Unsupported entry schema version.");
  if (typeof raw.note === "string" && codePoints(raw.note) > MAX_NOTE_CHARACTERS) throw new MapValidationError("note-too-long", `Notes are limited to ${MAX_NOTE_CHARACTERS.toLocaleString("en")} characters.`);
  let entry: DailyEntry;
  try { entry = parseDailyEntry(value); } catch (error) { throw new MapValidationError("format", (error as Error).message); }
  const layers = await decodePaintSnapshot(entry.maps);
  const observations = reduceRegions(layers, options.atlas);
  return { entry: { ...entry, observations }, layers, submittedObservationsMatched: sameObservations(entry.observations, observations) };
}

function sameObservations(a: RegionalObservation[], b: RegionalObservation[]) {
  if (a.length !== b.length) return false;
  const key = (o: RegionalObservation) => `${o.regionId}:${o.painType}`;
  const expected = new Map(b.map(o => [key(o), o]));
  return a.every(o => {
    const match = expected.get(key(o));
    return !!match && Math.abs(match.meanIntensity - o.meanIntensity) < 1e-3 && Math.abs(match.peakIntensity - o.peakIntensity) < 1e-3 && Math.abs(match.mapCoverage - o.mapCoverage) < 1e-5;
  });
}
