import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BODY_MAP_VERSION } from "../domain/contracts";
import { buildBodyAtlas, type BodyAtlas } from "./atlas";
import type { MannequinAsset } from "./mannequin";

/** Node-only (scripts and tests): the full atlas for the checked-in body asset. Browsers fetch the asset instead. */
let cached: BodyAtlas | undefined;
export function loadBodyAtlas(root = process.cwd()): BodyAtlas {
  cached ??= buildBodyAtlas(JSON.parse(readFileSync(join(root, "public", "body", `${BODY_MAP_VERSION}.json`), "utf8")) as MannequinAsset);
  return cached;
}
