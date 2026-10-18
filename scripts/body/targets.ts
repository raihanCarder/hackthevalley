import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * CC0 MakeHuman morph targets used for body-shape sliders, pinned to the same commit as the base mesh. They are fetched
 * once into node_modules/.cache (not committed); `npm run body:targets` derives the compact committed shape files.
 */
export const TARGET_COMMIT = "3c701a8e52f09e69922e8b598d23be2d7dfc49e3";
const CACHE = join("node_modules", ".cache", "makehuman-targets", TARGET_COMMIT);

export function targetPaths(): string[] {
  const paths: string[] = [];
  for (const race of ["african", "asian", "caucasian"]) for (const sex of ["female", "male"]) for (const age of ["young", "old"]) paths.push(`macrodetails/${race}-${sex}-${age}.target`);
  for (const sex of ["female", "male"]) {
    for (const age of ["young", "old"]) paths.push(`macrodetails/universal-${sex}-${age}-averagemuscle-averageweight.target`);
    for (const variant of ["minmuscle-averageweight", "maxmuscle-averageweight", "averagemuscle-minweight", "averagemuscle-maxweight"]) paths.push(`macrodetails/universal-${sex}-young-${variant}.target`);
    for (const height of ["min", "max"]) paths.push(`macrodetails/height/${sex}-young-averagemuscle-averageweight-${height}height.target`);
  }
  for (const side of ["incr", "decr"]) paths.push(
    `measure/measure-waist-circ-${side}.target`, `measure/measure-shoulder-dist-${side}.target`, `hip/hip-scale-horiz-${side}.target`,
    `measure/measure-upperleg-height-${side}.target`, `measure/measure-lowerleg-height-${side}.target`,
  );
  return paths;
}

/** Downloads (once) and returns the raw bytes of a target, verifying that the file declares its CC0 release. */
export async function loadTarget(path: string): Promise<{ text: string; sha256: string }> {
  const file = join(CACHE, path);
  if (!existsSync(file)) {
    const response = await fetch(`https://raw.githubusercontent.com/makehumancommunity/makehuman/${TARGET_COMMIT}/makehuman/data/targets/${path}`);
    if (!response.ok) throw new Error(`Could not download MakeHuman target ${path} (HTTP ${response.status}).`);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, Buffer.from(await response.arrayBuffer()));
  }
  const bytes = readFileSync(file);
  const text = bytes.toString("utf8");
  if (!/released as CC0/.test(text)) throw new Error(`Target ${path} does not declare a CC0 release.`);
  return { text, sha256: createHash("sha256").update(bytes).digest("hex") };
}

/** Parses "index dx dy dz" lines (source vertex index, offset in source units). */
export function parseTarget(text: string): Map<number, [number, number, number]> {
  const offsets = new Map<number, [number, number, number]>();
  for (const line of text.split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const [index, x, y, z] = line.trim().split(/\s+/).map(Number);
    if ([index, x, y, z].some(Number.isNaN)) continue;
    offsets.set(index, [x, y, z]);
  }
  return offsets;
}
