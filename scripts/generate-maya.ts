import { writeFileSync } from "node:fs";
import {
  BODY_MAP_VERSION,
  SCHEMA_VERSION,
  parseDailyEntry,
  type DailyEntry,
  type LocalDate,
  type PainType,
  type RegionId,
} from "../src/domain/contracts";
import {
  createEmptyLayers,
  encodePaintSnapshot,
  getBodyAtlas,
  intensityToByte,
  PaintEngine,
  reduceRegions,
  type PaintLayers,
  type SurfaceHit,
} from "../src/body/map-utils";

/**
 * Maya's maps are painted through the same body pipeline as a visitor's check-in (owner A's paint engine, atlas,
 * lossless encoder, and region reducer), so saved maps, 3D playback, report composites, and observations agree.
 * Fully deterministic: fixed dates, fixed stroke paths, and no randomness.
 */
const atlas = getBodyAtlas();
type Point = [number, number, number];

/** The surface texel of a region/side closest to a model-space point (+X patient-left, +Z front), as a surface hit. */
function surfaceAt(regionId: RegionId, side: "front" | "back", target: Point): SurfaceHit {
  let best = -1, bestDistance = Infinity;
  for (const island of atlas.islands) {
    if (island.regionId !== regionId || island.side !== side) continue;
    for (const texel of atlas.islandTexels[island.id]) {
      const dx = atlas.position[texel * 3] - target[0], dy = atlas.position[texel * 3 + 1] - target[1], dz = atlas.position[texel * 3 + 2] - target[2];
      const distance = dx * dx + dy * dy + dz * dz;
      if (distance < bestDistance) { bestDistance = distance; best = texel; }
    }
  }
  const at = (array: Float32Array): Point => [array[best * 3], array[best * 3 + 1], array[best * 3 + 2]];
  return { point: at(atlas.position), normal: at(atlas.normal), island: atlas.islandOf[best] };
}

/** One brush stroke through surface points, sampled densely like pointer events. */
function stroke(engine: PaintEngine, layer: PainType, intensity: number, radius: number, regionId: RegionId, side: "front" | "back", path: Point[]) {
  engine.beginStroke({ layer, tool: "brush", intensity: intensityToByte(intensity), radius });
  for (let segment = 0; segment < path.length - 1; segment++) {
    const [from, to] = [path[segment], path[segment + 1]];
    for (let step = 0; step <= 8; step++) {
      const t = step / 8;
      engine.strokeTo(surfaceAt(regionId, side, [0, 1, 2].map(axis => from[axis] + (to[axis] - from[axis]) * t) as Point));
    }
  }
  engine.endStroke();
}

/** The four layers drawn for day `index` (0 = Sept 6). */
export function mayaLayers(index: number): PaintLayers {
  const engine = new PaintEngine(atlas, createEmptyLayers());
  if (index < 4) return engine.snapshot(); // Sept 6–9: explicitly saved empty maps
  // Lower-back aching on every remaining day, varying gently in intensity and size.
  const day = index - 4;
  // A broad ache across the lower back: two passes, spread slightly wider on some days.
  const ache = 4.2 + 1.2 * Math.sin(day * .45), radius = .07 + .01 * Math.cos(day * .3);
  stroke(engine, "aching", ache, radius, "back-lower-torso", "back", [[-.13, 1.18, -.12], [0, 1.16, -.145], [.13, 1.18, -.12]]);
  stroke(engine, "aching", ache, radius, "back-lower-torso", "back", [[-.11, 1.07, -.12], [0, 1.05, -.14], [.11, 1.07, -.12]]);
  // Left-thigh burning from Oct 3 (index 27) on the front-outer thigh, lengthening toward the knee.
  if (index >= 27) {
    const thighDay = index - 27;
    const bottom = Math.max(.55, .84 - .02 * thighDay);
    stroke(engine, "burning", 4.5 + Math.min(2, thighDay * .15) + .4 * Math.sin(thighDay), .035 + Math.min(.02, thighDay * .002), "left-thigh", "front",
      [[.19, .92, .08], [.195, bottom, .07]]);
  }
  // Left-calf burning from Oct 10 (index 34), extending down the front-outer calf.
  if (index >= 34) {
    const calfDay = index - 34;
    stroke(engine, "burning", 4.2 + Math.min(1.8, calfDay * .2), .03 + calfDay * .002, "left-calf", "front",
      [[.19, .5, .055], [.19, .45 - .025 * calfDay, .05]]);
  }
  return engine.snapshot();
}

// Generate the 42 dates: 2026-09-06 to 2026-10-17
function getMayaDates(): LocalDate[] {
  const dates: LocalDate[] = [];
  for (let d = 6; d <= 30; d++) dates.push(`2026-09-${String(d).padStart(2, "0")}` as LocalDate);
  for (let d = 1; d <= 17; d++) dates.push(`2026-10-${String(d).padStart(2, "0")}` as LocalDate);
  return dates;
}

const MAYA_NOTES: Record<string, string> = {
  "2026-09-06": "Feeling good today after a long morning walk in the park. No noticeable back discomfort.",
  "2026-09-07": "Labor Day holiday. Relaxed with family, did light yard work. Zero pain throughout the day.",
  "2026-09-08": "First day back at my desk. Did regular standing breaks; body felt comfortable all day.",
  "2026-09-09": "Smooth workday. Stretched during lunch break. Completely pain-free.",
  "2026-09-10": "Noticed a dull ache developing across my lower back around 4 PM after sitting at my desk for 5 consecutive hours.",
  "2026-09-11": "Lower back ache returned by late afternoon. Standing up helped ease the tightness somewhat.",
  "2026-09-12": "Mild ache lingering on Saturday morning. Better after walking around the neighborhood.",
  "2026-09-13": "Quiet Sunday. Gentle yoga helped loosen lower back tightness.",
  "2026-09-14": "Back ache began earlier today, around 2 PM. Swapped to my ergonomic chair.",
  "2026-09-15": "Persistent lower back ache during computer work. Heating pad provided partial relief for about an hour.",
  "2026-09-16": "Lower back ache present from late morning onward. Taking 5-minute walking breaks helps.",
  "2026-09-17": "Steady ache in lumbar region. Discomfort increases after 45 minutes of continuous sitting.",
  "2026-09-18": "Noticeable lower back stiffness today. Applied a warm compress before dinner.",
  "2026-09-19": "Weekend rest. Ache is mild today, noticeable mostly when bending forward.",
  "2026-09-20": "Ache flared slightly after vacuuming, but settled down with resting on the couch.",
  "2026-09-21": "Long sprint planning meeting today. Back ache intensified toward 5/10 by end of day.",
  "2026-09-22": "Achy lower back throughout the workday. Alternated between standing desk and sitting.",
  "2026-09-23": "Lower back tightness. Used foam roller in the evening with partial relief.",
  "2026-09-24": "Dull ache present across lower lumbar area. Standing up periodically keeps it manageable.",
  "2026-09-25": "Back ache steady around 4/10 after long spreadsheet review session.",
  "2026-09-26": "Lighter ache today while staying active doing errands around the house.",
  "2026-09-27": "Moderate stiffness waking up. Took a hot shower which helped ease the muscle tension.",
  "2026-09-28": "Lower back aching began around 1 PM. Switched between sitting and standing every 30 minutes.",
  "2026-09-29": "Ache feels deep across the lower back. Warm bath in evening gave temporary comfort.",
  "2026-09-30": "End of month push. Back ache peaked around 6/10 after 7 hours of seated desk work.",
  "2026-10-01": "Lower back ache is steady around 4/10 after long spreadsheet sessions.",
  "2026-10-02": "Dull ache in lower back. Sitting in commute traffic aggravated the stiffness.",
  "2026-10-03": "New sensation today: burning feeling appeared on the front-outer aspect of my left thigh during an afternoon design review. Sitting aggravated it.",
  "2026-10-04": "Both lower back ache and left thigh burning present today. Walking around gave partial relief from the burning.",
  "2026-10-05": "Lower back still achy, and left thigh burning flared up whenever seated for more than 30 minutes.",
  "2026-10-06": "Left thigh burning continues during desk work. Putting a cushion under knees helped slightly.",
  "2026-10-07": "Lower back ache at 4/10; left thigh burning felt hot and uncomfortable through the afternoon.",
  "2026-10-08": "Left thigh burning continues when driving or sitting. Back ache remains at baseline.",
  "2026-10-09": "Thigh burning noticeable again after lunch. Stood for the remaining meetings of the day.",
  "2026-10-10": "The burning sensation has spread downward from my left thigh into my calf. Walking around helped ease the tension slightly.",
  "2026-10-11": "Both left thigh and left calf burning today alongside lower back ache. Ice pack gave partial temporary relief.",
  "2026-10-12": "Left leg burning feels sharper today while seated. Calf feels tight and sensitive.",
  "2026-10-13": "Both lower back ache and left leg burning present today. Left calf feels hot and tight.",
  "2026-10-14": "Burning pain radiating from left thigh to calf during late afternoon presentations. Standing helped.",
  "2026-10-15": "Lower back ache and left leg burning flared up together after 3 hours of driving.",
  "2026-10-16": "Left leg burning is persistent when sitting. Gentle walking provides temporary relief.",
  "2026-10-17": "Lower back ache (4/10) with flare of burning pain in left thigh and calf after back-to-back seated meetings. Heat pack and walking offered partial temporary relief.",
};

export async function generateMayaEntries(): Promise<DailyEntry[]> {
  const entries: DailyEntry[] = [];
  for (const [index, localDate] of getMayaDates().entries()) {
    const layers = mayaLayers(index);
    entries.push(parseDailyEntry({
      id: `maya-${localDate}`,
      profileId: "maya-synthetic",
      localDate,
      timeZone: "America/Toronto",
      updatedAt: `${localDate}T20:30:00.000Z`,
      schemaVersion: SCHEMA_VERSION,
      bodyMapVersion: BODY_MAP_VERSION,
      maps: await encodePaintSnapshot(layers),
      note: MAYA_NOTES[localDate] || "Check-in recorded.",
      observations: reduceRegions(layers, atlas),
    }));
  }
  return entries;
}

function verify(entries: DailyEntry[]) {
  const daysWith = (regionId: RegionId, painType: PainType) => entries.filter(entry => entry.observations.some(o => o.regionId === regionId && o.painType === painType));
  const thigh = daysWith("left-thigh", "burning"), calf = daysWith("left-calf", "burning");
  const checks = {
    "42 check-ins": entries.length === 42,
    "38 days of lower-back aching": daysWith("back-lower-torso", "aching").length === 38,
    "4 explicit empty check-ins": entries.filter(entry => entry.observations.length === 0).length === 4,
    "left-thigh burning first on Oct 3": thigh[0]?.localDate === "2026-10-03" && thigh.length === 15,
    "left-calf burning first on Oct 10": calf[0]?.localDate === "2026-10-10" && calf.length === 8,
    "only the three planned region/sensations": entries.every(entry => entry.observations.every(o => ["back-lower-torso:aching", "left-thigh:burning", "left-calf:burning"].includes(`${o.regionId}:${o.painType}`))),
  };
  for (const [name, ok] of Object.entries(checks)) console.log(`${ok ? "ok  " : "FAIL"} ${name}`);
  if (Object.values(checks).some(ok => !ok)) throw new Error("Maya synthetic dataset did not meet required acceptance metrics!");
}

async function main() {
  const mayaEntries = await generateMayaEntries();
  verify(mayaEntries);
  writeFileSync("src/demo/maya-data.json", JSON.stringify(mayaEntries, null, 2) + "\n");
  const mayaTsCode = `import type { DailyEntry, LocalDate } from "../domain/contracts";
import mayaDataRaw from "./maya-data.json";

export interface SyntheticProfile {
  id: string;
  name: string;
  isSynthetic: true;
  isReadOnly: true;
  description: string;
  dateRange: { start: LocalDate; end: LocalDate };
}

export const MAYA_PROFILE: SyntheticProfile = {
  id: "maya-synthetic",
  name: "Maya",
  isSynthetic: true,
  isReadOnly: true,
  description: "Six-week synthetic patient history demonstrating lower-back aching and radiating left-leg burning.",
  dateRange: {
    start: "2026-09-06" as LocalDate,
    end: "2026-10-17" as LocalDate,
  },
};

export const MAYA_ENTRIES: readonly DailyEntry[] = Object.freeze(mayaDataRaw as DailyEntry[]);

export function getMayaEntry(date: string): DailyEntry | null {
  return MAYA_ENTRIES.find(entry => entry.localDate === date) ?? null;
}

export function listMayaEntries(): DailyEntry[] {
  return [...MAYA_ENTRIES];
}
`;
  writeFileSync("src/demo/maya.ts", mayaTsCode);
  console.log("Successfully generated src/demo/maya-data.json and src/demo/maya.ts.");
}

if (process.argv[1]?.endsWith("generate-maya.ts")) main().catch(error => { console.error(error); process.exitCode = 1; });
