export const SCHEMA_VERSION = 1 as const;
export const BODY_MAP_VERSION = "mannequin-v1" as const;
export const MAP_SIZE = 512 as const;
export const PAIN_TYPES = ["burning", "sharp", "aching", "tingling"] as const;
export type PainType = (typeof PAIN_TYPES)[number];
export const PAIN_LABELS: Record<PainType, string> = {
  burning: "Burning", sharp: "Sharp / stabbing", aching: "Aching / dull", tingling: "Tingling / numbness",
};
export const REGION_IDS = [
  "head", "neck", "front-upper-torso", "front-lower-torso", "back-upper-torso", "back-lower-torso", "pelvis",
  "left-upper-arm", "right-upper-arm", "left-forearm", "right-forearm", "left-hand", "right-hand",
  "left-thigh", "right-thigh", "left-calf", "right-calf", "left-foot", "right-foot",
] as const;
export type RegionId = (typeof REGION_IDS)[number];
export type LocalDate = string & { readonly __localDate: unique symbol };
export type CameraView = "front" | "back" | "left" | "right";
export type InteractionMode = "rotate" | "paint";

export interface RegionalObservation {
  regionId: RegionId;
  painType: PainType;
  meanIntensity: number;
  peakIntensity: number;
  mapCoverage: number;
}
export interface PaintSnapshot {
  bodyMapVersion: typeof BODY_MAP_VERSION;
  width: typeof MAP_SIZE;
  height: typeof MAP_SIZE;
  encoding: "png-base64";
  layers: Record<PainType, string>;
}
export interface DailyEntry {
  id: string;
  profileId: string;
  localDate: LocalDate;
  timeZone: string;
  updatedAt: string;
  schemaVersion: typeof SCHEMA_VERSION;
  bodyMapVersion: typeof BODY_MAP_VERSION;
  maps: PaintSnapshot;
  note?: string;
  observations: RegionalObservation[];
}
/** null means no recorded check-in; an entry with zero maps is still recorded. */
export type DailyRecord = DailyEntry | null;

export function parseLocalDate(value: unknown): LocalDate {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Expected a local date (YYYY-MM-DD).");
  const [year, month, day] = value.split("-").map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1]) throw new Error("Invalid calendar date.");
  return value as LocalDate;
}
export function parseRegionId(value: unknown): RegionId {
  if (!REGION_IDS.includes(value as RegionId)) throw new Error("Unknown body region.");
  return value as RegionId;
}
export function parsePainType(value: unknown): PainType {
  if (!PAIN_TYPES.includes(value as PainType)) throw new Error("Unknown pain type.");
  return value as PainType;
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected an object.");
  return value as Record<string, unknown>;
}
function nonempty(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Missing ${name}.`);
  return value;
}
function bounded(value: unknown, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > max) throw new Error("Measurement outside its range.");
  return value;
}
export function assertVersions(value: { schemaVersion?: unknown; bodyMapVersion?: unknown }): void {
  if (value.schemaVersion !== SCHEMA_VERSION) throw new Error("Unsupported entry schema version.");
  if (value.bodyMapVersion !== BODY_MAP_VERSION) throw new Error("Unsupported body-map version; the map cannot be restored.");
}
/** Structural contract only. Image decoding and payload limits belong to task 3.2. */
export function parseDailyEntry(value: unknown): DailyEntry {
  const entry = object(value);
  assertVersions(entry);
  const maps = object(entry.maps);
  if (maps.bodyMapVersion !== BODY_MAP_VERSION) throw new Error("Unsupported snapshot body-map version.");
  if (maps.width !== MAP_SIZE || maps.height !== MAP_SIZE || maps.encoding !== "png-base64") throw new Error("Unsupported paint-map format.");
  const layers = object(maps.layers);
  const parsedLayers = Object.fromEntries(PAIN_TYPES.map(type => [type, nonempty(layers[type], `${type} layer`)])) as Record<PainType, string>;
  if (!Array.isArray(entry.observations)) throw new Error("Expected regional observations.");
  const seen = new Set<string>();
  const observations = entry.observations.map(value => {
    const row = object(value);
    const regionId = parseRegionId(row.regionId);
    const painType = parsePainType(row.painType);
    const key = `${regionId}:${painType}`;
    if (seen.has(key)) throw new Error("Duplicate regional observation.");
    seen.add(key);
    const meanIntensity = bounded(row.meanIntensity, 10);
    const peakIntensity = bounded(row.peakIntensity, 10);
    if (meanIntensity > peakIntensity) throw new Error("Mean intensity exceeds peak.");
    return { regionId, painType, meanIntensity, peakIntensity, mapCoverage: bounded(row.mapCoverage, 1) };
  });
  const timeZone = nonempty(entry.timeZone, "time zone");
  try { new Intl.DateTimeFormat("en", { timeZone }); } catch { throw new Error("Invalid time-zone label."); }
  const updatedAt = nonempty(entry.updatedAt, "updated timestamp");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(updatedAt) || !Number.isFinite(Date.parse(updatedAt))) throw new Error("Expected a UTC timestamp.");
  if (entry.note !== undefined && typeof entry.note !== "string") throw new Error("Expected a written note.");
  return {
    id: nonempty(entry.id, "entry id"), profileId: nonempty(entry.profileId, "profile id"),
    localDate: parseLocalDate(entry.localDate), timeZone, updatedAt,
    schemaVersion: SCHEMA_VERSION, bodyMapVersion: BODY_MAP_VERSION,
    maps: { bodyMapVersion: BODY_MAP_VERSION, width: MAP_SIZE, height: MAP_SIZE, encoding: "png-base64", layers: parsedLayers },
    note: entry.note as string | undefined, observations,
  };
}
