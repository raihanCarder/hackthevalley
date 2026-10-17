import { mkdirSync, writeFileSync } from "node:fs";
import { generateMannequin } from "../src/body/mannequin";

const asset = generateMannequin();
mkdirSync("public/body", { recursive: true });
writeFileSync("public/body/mannequin-v1.json", JSON.stringify(asset) + "\n");
console.log(`Generated ${asset.bodyMapVersion}: ${asset.islands.length} islands, ${asset.indices.length / 3} triangles.`);
