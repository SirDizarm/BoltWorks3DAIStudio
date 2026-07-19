import { copyFile, cp, mkdir, readdir, rm } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(root, "dist");
const browserExtensions = new Set([
  ".html", ".css", ".js", ".mjs", ".json", ".png", ".jpg", ".jpeg",
  ".webp", ".gif", ".svg", ".wasm", ".ico"
]);
const excludedRootFiles = new Set([
  "index_old.html", "package.json", "package-lock.json", "server.log", "server.err.log"
]);

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const entry of await readdir(root, { withFileTypes: true })) {
  if (!entry.isFile() || excludedRootFiles.has(entry.name)) continue;
  if (!browserExtensions.has(extname(entry.name).toLowerCase())) continue;
  await copyFile(join(root, entry.name), join(output, entry.name));
}

for (const directory of ["deps", "samples"]) {
  await cp(join(root, directory), join(output, directory), { recursive: true });
}

const threeSource = join(root, "node_modules", "three");
const threeOutput = join(output, "node_modules", "three");
await mkdir(threeOutput, { recursive: true });
await cp(join(threeSource, "build"), join(threeOutput, "build"), { recursive: true });
await cp(join(threeSource, "examples", "jsm"), join(threeOutput, "examples", "jsm"), { recursive: true });

console.log(`BoltWorks 3D AI Studio web edition built in ${output}`);
