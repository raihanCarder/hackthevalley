import { mkdirSync, writeFileSync } from "node:fs";
import { buildBodyAtlas, regionIdRaster } from "../src/body/atlas";
import { generateMannequin } from "../src/body/mannequin";
import { encodeGrayPng } from "../src/body/png";
import { MAP_SIZE } from "../src/domain/contracts";

async function main() {
  const asset = generateMannequin();
  mkdirSync("public/body", { recursive: true });
  writeFileSync("public/body/mannequin-v1.json", JSON.stringify(asset) + "\n");
  console.log(`Generated ${asset.bodyMapVersion}: ${asset.islands.length} islands, ${asset.indices.length / 3} triangles.`);
  // Inspection copy of the region-ID atlas: 0 = invalid texel, otherwise REGION_IDS index + 1. Runtime code derives the same raster.
  writeFileSync(`public/body/region-atlas-${asset.bodyMapVersion}.png`, await encodeGrayPng(regionIdRaster(buildBodyAtlas(asset)), MAP_SIZE, MAP_SIZE));
  console.log(`Generated region-ID atlas for ${asset.bodyMapVersion}.`);
}
main();
