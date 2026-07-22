import { copyFile, cp, mkdir, readdir, rm } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildStudioBundle } from "./studio-bundler.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(root, "dist");
const browserExtensions = new Set([
  ".html", ".css", ".js", ".mjs", ".json", ".png", ".jpg", ".jpeg",
  ".webp", ".gif", ".svg", ".wasm", ".ico"
]);
const excludedRootFiles = new Set([
  "package.json", "package-lock.json"
]);
const runtimeSamples = [
  "3d_ai_modeler.json",
  "new-shapes-model-pack.json",
  "roblox-placement-test-rig-actions.json",
  "roblox-placement-test-rig.json"
];

await rm(output, { recursive: true, force: true });
await mkdir(join(output, "app"), { recursive: true });

for (const entry of await readdir(root, { withFileTypes: true })) {
  if (!entry.isFile() || excludedRootFiles.has(entry.name)) continue;
  if (!browserExtensions.has(extname(entry.name).toLowerCase())) continue;
  await copyFile(join(root, entry.name), join(output, entry.name));
}

await cp(join(root, "ai"), join(output, "ai"), { recursive: true });
await mkdir(join(output, "samples"), { recursive: true });
for (const file of runtimeSamples) {
  await copyFile(join(root, "samples", file), join(output, "samples", file));
}
for (const directory of ["assets", "styles", "panels", "selection", "meshes"]) {
  await cp(join(root, "app", directory), join(output, "app", directory), { recursive: true });
}
await copyFile(join(root, "CNAME"), join(output, "CNAME"));

await buildStudioBundle({ outfile: join(output, "app", "studio-v49.0.0.js") });

const threeSource = join(root, "node_modules", "three");
const threeOutput = join(output, "node_modules", "three");
await mkdir(threeOutput, { recursive: true });
await cp(join(threeSource, "build"), join(threeOutput, "build"), { recursive: true });
await cp(join(threeSource, "examples", "jsm"), join(threeOutput, "examples", "jsm"), { recursive: true });

console.log(`BoltWorks 3D AI Studio Pages edition built in ${output}`);
