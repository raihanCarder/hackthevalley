import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

async function testFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => entry.isDirectory()
    ? testFiles(join(directory, entry.name))
    : entry.name.endsWith(".test.ts") ? [join(directory, entry.name)] : []));
  return nested.flat().sort();
}
const files = await testFiles("tests");
if (!files.length) throw new Error("No unit tests were found.");
const result = spawnSync(process.execPath, ["--import", "tsx", "--test", ...files], { stdio: "inherit" });
process.exitCode = result.status ?? 1;
