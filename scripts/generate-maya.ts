import { writeFileSync } from "node:fs";
import { deflateSync, crc32 } from "node:zlib";
import { generateMannequin, type BodyIsland } from "../src/body/mannequin";
import {
  BODY_MAP_VERSION,
  MAP_SIZE,
  PAIN_TYPES,
  SCHEMA_VERSION,
  parseDailyEntry,
  type DailyEntry,
  type LocalDate,
  type PainType,
  type RegionId,
  type RegionalObservation,
} from "../src/domain/contracts";

/**
 * Encodes a 512x512 8-bit grayscale buffer to a valid base64-encoded PNG.
 */
export function encodeGrayscalePng(buffer: Uint8Array, width = MAP_SIZE, height = MAP_SIZE): string {
  const rawScanlines = Buffer.alloc(height * (1 + width));
  for (let y = 0; y < height; y++) {
    rawScanlines[y * (1 + width)] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      rawScanlines[y * (1 + width) + 1 + x] = buffer[y * width + x];
    }
  }

  const idatCompressed = deflateSync(rawScanlines);

  const makeChunk = (type: string, data: Buffer): Buffer => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, "ascii");
    const crc = Buffer.alloc(4);
    const calculatedCrc = crc32(Buffer.concat([typeBuf, data]));
    crc.writeUInt32BE(calculatedCrc, 0);
    return Buffer.concat([len, typeBuf, data, crc]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8-bit depth
  ihdr[9] = 0; // Grayscale
  ihdr[10] = 0; // Deflate
  ihdr[11] = 0; // Default filter
  ihdr[12] = 0; // Non-interlaced

  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    makeChunk("IHDR", ihdr),
    makeChunk("IDAT", idatCompressed),
    makeChunk("IEND", Buffer.alloc(0)),
  ]);

  return png.toString("base64");
}

const mannequin = generateMannequin();

// Precompute valid texel masks per region based on mannequin islands
interface RegionAtlasInfo {
  islands: BodyIsland[];
  pixelCoordinates: Array<[number, number]>;
  center: [number, number];
}

const regionAtlases = new Map<RegionId, RegionAtlasInfo>();

for (const island of mannequin.islands) {
  let info = regionAtlases.get(island.regionId);
  if (!info) {
    info = { islands: [], pixelCoordinates: [], center: [0, 0] };
    regionAtlases.set(island.regionId, info);
  }
  info.islands.push(island);

  const [u0, v0, u1, v1] = island.bounds;
  const xMin = Math.round(u0 * MAP_SIZE);
  const xMax = Math.round(u1 * MAP_SIZE);
  const yMin = Math.round(v0 * MAP_SIZE);
  const yMax = Math.round(v1 * MAP_SIZE);

  for (let y = yMin; y < yMax; y++) {
    for (let x = xMin; x < xMax; x++) {
      info.pixelCoordinates.push([x, y]);
    }
  }
}

// Compute centers
for (const [, info] of regionAtlases) {
  if (info.pixelCoordinates.length > 0) {
    let sumX = 0;
    let sumY = 0;
    for (const [x, y] of info.pixelCoordinates) {
      sumX += x;
      sumY += y;
    }
    info.center = [
      Math.round(sumX / info.pixelCoordinates.length),
      Math.round(sumY / info.pixelCoordinates.length),
    ];
  }
}

function stampPain(
  buffer: Uint8Array,
  regionId: RegionId,
  intensityScale10: number,
  radiusPx: number,
  offsetX = 0,
  offsetY = 0
): void {
  const info = regionAtlases.get(regionId);
  if (!info) return;

  const [cx, cy] = info.center;
  const targetX = cx + offsetX;
  const targetY = cy + offsetY;
  const maxByte = Math.min(255, Math.max(0, Math.round((intensityScale10 / 10) * 255)));

  // Stamp only on texels belonging to this region's islands to prevent bleeding
  for (const [x, y] of info.pixelCoordinates) {
    const dist = Math.hypot(x - targetX, y - targetY);
    if (dist <= radiusPx) {
      const falloff = 1 - dist / radiusPx;
      const stampVal = Math.round(maxByte * falloff);
      const idx = y * MAP_SIZE + x;
      buffer[idx] = Math.max(buffer[idx], stampVal);
    }
  }
}

const PRESENCE_THRESHOLD_BYTE = 13; // 13/255 from design.md Decision 5

function reduceRegion(
  buffer: Uint8Array,
  regionId: RegionId,
  painType: PainType
): RegionalObservation | null {
  const info = regionAtlases.get(regionId);
  if (!info || info.pixelCoordinates.length === 0) return null;

  let maxByte = 0;
  let sumByte = 0;
  let coveredCount = 0;
  const totalValid = info.pixelCoordinates.length;

  for (const [x, y] of info.pixelCoordinates) {
    const byte = buffer[y * MAP_SIZE + x];
    if (byte > maxByte) maxByte = byte;
    sumByte += byte;
    if (byte >= PRESENCE_THRESHOLD_BYTE) {
      coveredCount++;
    }
  }

  if (coveredCount === 0 && maxByte < PRESENCE_THRESHOLD_BYTE) {
    return null;
  }

  const peakIntensity = Number(((maxByte / 255) * 10).toFixed(1));
  const meanIntensity = Number((((sumByte / 255) * 10) / totalValid).toFixed(2));
  const mapCoverage = Number((coveredCount / totalValid).toFixed(3));

  return {
    regionId,
    painType,
    peakIntensity,
    meanIntensity: Math.min(meanIntensity, peakIntensity),
    mapCoverage,
  };
}

// Generate the 42 dates: 2026-09-06 to 2026-10-17
function getMayaDates(): LocalDate[] {
  const dates: LocalDate[] = [];
  // September 06 to 30 (25 days)
  for (let d = 6; d <= 30; d++) {
    const dayStr = d < 10 ? `0${d}` : `${d}`;
    dates.push(`2026-09-${dayStr}` as LocalDate);
  }
  // October 01 to 17 (17 days)
  for (let d = 1; d <= 17; d++) {
    const dayStr = d < 10 ? `0${d}` : `${d}`;
    dates.push(`2026-10-${dayStr}` as LocalDate);
  }
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

export function generateMayaEntries(): DailyEntry[] {
  const dates = getMayaDates();
  const entries: DailyEntry[] = [];

  for (let i = 0; i < dates.length; i++) {
    const localDate = dates[i];
    const isEarlyEmpty = i < 4; // Sept 6, 7, 8, 9 (4 days) are explicitly empty check-ins

    // Create 4 independent 512x512 buffers
    const buffers: Record<PainType, Uint8Array> = {
      burning: new Uint8Array(MAP_SIZE * MAP_SIZE),
      sharp: new Uint8Array(MAP_SIZE * MAP_SIZE),
      aching: new Uint8Array(MAP_SIZE * MAP_SIZE),
      tingling: new Uint8Array(MAP_SIZE * MAP_SIZE),
    };

    const observations: RegionalObservation[] = [];

    if (!isEarlyEmpty) {
      // 1. Lower back aching on all 38 remaining days (Sept 10 - Oct 17)
      // Slight day-to-day intensity variation (between 3.8 and 6.4)
      const dayOffset = i - 4;
      const achingIntensity = 4.2 + 1.2 * Math.sin(dayOffset * 0.45);
      const achingRadius = 18 + Math.round(3 * Math.cos(dayOffset * 0.3));
      stampPain(buffers.aching, "back-lower-torso", achingIntensity, achingRadius);

      const backObs = reduceRegion(buffers.aching, "back-lower-torso", "aching");
      if (backObs) observations.push(backObs);

      // 2. Left thigh burning starting October 3 (index 27)
      // Sept 6 is idx 0; Sept 30 is idx 24; Oct 1 is idx 25; Oct 2 is idx 26; Oct 3 is idx 27.
      const isThighBurning = i >= 27;
      if (isThighBurning) {
        const thighDay = i - 27;
        const thighIntensity = 4.5 + Math.min(2.0, thighDay * 0.15) + 0.4 * Math.sin(thighDay);
        const thighRadius = 14 + Math.min(8, thighDay);
        stampPain(buffers.burning, "left-thigh", thighIntensity, thighRadius);

        const thighObs = reduceRegion(buffers.burning, "left-thigh", "burning");
        if (thighObs) observations.push(thighObs);
      }

      // 3. Left calf burning starting October 10 (index 34)
      // Oct 10 is idx 34 (7 days before end: idx 34 to 41 = 8 days).
      const isCalfBurning = i >= 34;
      if (isCalfBurning) {
        const calfDay = i - 34;
        const calfIntensity = 4.2 + Math.min(1.8, calfDay * 0.2);
        const calfRadius = 12 + Math.min(6, calfDay);
        stampPain(buffers.burning, "left-calf", calfIntensity, calfRadius);

        const calfObs = reduceRegion(buffers.burning, "left-calf", "burning");
        if (calfObs) observations.push(calfObs);
      }
    }

    // Encode all 4 layers to PNG base64
    const layers = {
      burning: encodeGrayscalePng(buffers.burning),
      sharp: encodeGrayscalePng(buffers.sharp),
      aching: encodeGrayscalePng(buffers.aching),
      tingling: encodeGrayscalePng(buffers.tingling),
    };

    const entry: DailyEntry = {
      id: `maya-${localDate}`,
      profileId: "maya-synthetic",
      localDate,
      timeZone: "America/Toronto",
      updatedAt: `${localDate}T20:30:00.000Z`,
      schemaVersion: SCHEMA_VERSION,
      bodyMapVersion: BODY_MAP_VERSION,
      maps: {
        bodyMapVersion: BODY_MAP_VERSION,
        width: MAP_SIZE,
        height: MAP_SIZE,
        encoding: "png-base64",
        layers,
      },
      note: MAYA_NOTES[localDate] || "Check-in recorded.",
      observations,
    };

    // Verify contract compliance
    const validated = parseDailyEntry(entry);
    entries.push(validated);
  }

  return entries;
}

// Generate and save
const mayaEntries = generateMayaEntries();

// Verification counts
const achingBackDays = mayaEntries.filter(e =>
  e.observations.some(o => o.regionId === "back-lower-torso" && o.painType === "aching" && o.mapCoverage > 0)
).length;

const thighBurningFirstDate = mayaEntries.find(e =>
  e.observations.some(o => o.regionId === "left-thigh" && o.painType === "burning" && o.mapCoverage > 0)
)?.localDate;

const calfBurningFirstDate = mayaEntries.find(e =>
  e.observations.some(o => o.regionId === "left-calf" && o.painType === "burning" && o.mapCoverage > 0)
)?.localDate;

const emptyCheckInDays = mayaEntries.filter(e => e.observations.length === 0).length;

console.log("--- Maya Synthetic Data Verification ---");
console.log(`Total check-ins: ${mayaEntries.length} (expected 42)`);
console.log(`Lower-back aching days: ${achingBackDays} (expected 38)`);
console.log(`Explicit empty check-in days: ${emptyCheckInDays} (expected 4)`);
console.log(`Left-thigh burning first date: ${thighBurningFirstDate} (expected 2026-10-03)`);
console.log(`Left-calf burning first date: ${calfBurningFirstDate} (expected 2026-10-10)`);

if (
  mayaEntries.length !== 42 ||
  achingBackDays !== 38 ||
  emptyCheckInDays !== 4 ||
  thighBurningFirstDate !== "2026-10-03" ||
  calfBurningFirstDate !== "2026-10-10"
) {
  throw new Error("Maya synthetic dataset did not meet required acceptance metrics!");
}

// Write JSON dataset
writeFileSync("src/demo/maya-data.json", JSON.stringify(mayaEntries, null, 2) + "\n");

// Write TypeScript wrapper
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
