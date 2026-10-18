import { writeFileSync } from "node:fs";
import { BODY_MAP_VERSION, SCHEMA_VERSION, parseDailyEntry, type DailyEntry, type LocalDate, type PainType, type RegionId } from "../src/domain/contracts";
import { PaintEngine, intensityToByte, encodePaintSnapshot, reduceRegions, type SurfaceHit } from "../src/body/map-utils";
import { loadBodyAtlas } from "../src/body/node-atlas";
import { listCalendarDates } from "../src/timeline/analysis";

const atlas = loadBodyAtlas();
const FACING = { front: [0, 0, 1], back: [0, 0, -1] } as const;

/** The centre of a region's surface facing one way: the region vertex nearest the centroid of its facing vertices. */
function regionCentre(region: RegionId, side: "front" | "back"): SurfaceHit {
  const { asset } = atlas;
  const facing = FACING[side];
  const candidates: number[] = [];
  for (const chart of asset.charts) if (chart.regionId === region) {
    for (let v = chart.vertexStart; v < chart.vertexStart + chart.vertexCount; v++) {
      if (asset.normals[v * 3] * facing[0] + asset.normals[v * 3 + 1] * facing[1] + asset.normals[v * 3 + 2] * facing[2] > .5) candidates.push(v);
    }
  }
  const centroid = [0, 1, 2].map(axis => candidates.reduce((sum, v) => sum + asset.positions[v * 3 + axis], 0) / candidates.length);
  let best = candidates[0], distance = Infinity;
  for (const v of candidates) {
    const d = centroid.reduce((sum, value, axis) => sum + (asset.positions[v * 3 + axis] - value) ** 2, 0);
    if (d < distance) { distance = d; best = v; }
  }
  const chart = asset.charts.find(item => best >= item.vertexStart && best < item.vertexStart + item.vertexCount)!;
  let triangle = chart.triangleStart;
  for (let t = chart.triangleStart; t < chart.triangleStart + chart.triangleCount; t++) {
    if ([0, 1, 2].some(k => asset.indices[t * 3 + k] === best)) { triangle = t; break; }
  }
  return { point: [asset.positions[best * 3], asset.positions[best * 3 + 1], asset.positions[best * 3 + 2]], triangle };
}

/** One stamp at a region centre; PaintEngine owns geodesic spreading and the UV row convention. */
function paint(engine: PaintEngine, region: RegionId, side: "front" | "back", layer: PainType, intensity: number, radius: number) {
  engine.beginStroke({ layer, tool: "brush", intensity: intensityToByte(intensity), radius });
  engine.strokeTo(regionCentre(region, side));
  engine.endStroke();
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

// Explicit synthetic note ratings use the same target intensity as that day's painting.
const NOTE_ACHING_RATINGS: Record<string, number> = {
  "2026-09-21": 5, "2026-09-25": 4, "2026-09-30": 6,
  "2026-10-01": 4, "2026-10-07": 4, "2026-10-17": 4,
};

export async function generateMayaEntries(): Promise<DailyEntry[]> {
  const dates = listCalendarDates("2026-09-06" as LocalDate, "2026-10-17" as LocalDate);
  const entries: DailyEntry[] = [];
  for (const [i, localDate] of dates.entries()) {
    const engine = new PaintEngine(atlas);
    if (i >= 4) {
      const day = i - 4;
      // Surface radii in metres on the mannequin-v2 body (geodesic brush), growing as the leg burning extends.
      paint(engine, "back-lower-torso", "back", "aching", NOTE_ACHING_RATINGS[localDate] ?? 4.2 + 1.2 * Math.sin(day * .45), .095 + .01 * Math.cos(day * .3));
      if (i >= 27) paint(engine, "left-thigh", "front", "burning", 4.5 + Math.min(2, (i - 27) * .15) + .4 * Math.sin(i - 27), .06 + Math.min(.045, (i - 27) * .0035));
      if (i >= 34) paint(engine, "left-calf", "front", "burning", 4.2 + Math.min(1.8, (i - 34) * .2), .04 + Math.min(.035, (i - 34) * .005));
    }
    const layers = engine.snapshot();
    entries.push(parseDailyEntry({ id: `maya-${localDate}`, profileId: "maya-synthetic", localDate,
      timeZone: "America/Toronto", updatedAt: `${localDate}T20:30:00.000Z`, schemaVersion: SCHEMA_VERSION,
      bodyMapVersion: BODY_MAP_VERSION, maps: await encodePaintSnapshot(layers),
      observations: reduceRegions(layers), note: MAYA_NOTES[localDate] }));
  }
  return entries;
}

async function main() {
  const entries = await generateMayaEntries();
  const present = (region: RegionId, pain: PainType) => entries.filter(e => e.observations.some(o => o.regionId === region && o.painType === pain));
  if (entries.length !== 42 || present("back-lower-torso", "aching").length !== 38 ||
    entries.filter(e => !e.observations.length).length !== 4 ||
    present("left-thigh", "burning")[0]?.localDate !== "2026-10-03" ||
    present("left-calf", "burning")[0]?.localDate !== "2026-10-10") throw new Error("Maya acceptance metrics did not match.");
  writeFileSync("src/demo/maya-data.json", JSON.stringify(entries, null, 2) + "\n");
  console.log("Generated 42 check-ins through PaintEngine, shared reducer and lossless codec (38 aching, 4 empty; thigh Oct 3, calf Oct 10).");
}
if (process.argv[1]?.endsWith("generate-maya.ts")) {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}
