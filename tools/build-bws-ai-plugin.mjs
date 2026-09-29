import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const folder = resolve(root, "plugins", "bws-ai-modeling");
const manifest = JSON.parse(await readFile(resolve(folder, "manifest.json"), "utf8"));
const files = {};
for (const [name, mediaType] of [["ai-tools.json", "application/json"], ["README.md", "text/markdown"], ["SPEC.md", "text/markdown"]]) {
  files[name] = { mediaType, data: await readFile(resolve(folder, name), "utf8") };
}
const output = { kind: "boltworks-plugin-package", packageVersion: 1, manifest, files };
await writeFile(resolve(folder, "plugin.bwsplugin"), JSON.stringify(output, null, 2) + "\n", "utf8");
console.log(`Built ${manifest.name} ${manifest.version} (${Object.keys(files).length} files).`);
