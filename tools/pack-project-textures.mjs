import { readFile, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";

const [inputArg, outputArg] = process.argv.slice(2);
if (!inputArg || !outputArg) {
  throw new Error("Usage: node tools/pack-project-textures.mjs <input.modelerproj> <output.modelerproj>");
}

const inputPath = resolve(inputArg);
const outputPath = resolve(outputArg);
const project = JSON.parse(await readFile(inputPath, "utf8"));
if (project?.kind !== "modeler-project" || !Array.isArray(project?.scene?.objects)) {
  throw new Error("Input must be a BoltWorks modeler project.");
}

const mimeByExtension = new Map([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".gif", "image/gif"],
  [".bmp", "image/bmp"]
]);

let packed = 0;
const originalUrlByName = new Map();
for (const entry of project.textureLibrary || []) {
  if (!entry?.name || !entry?.dataUrl || /^data:/i.test(entry.dataUrl)) continue;
  if (/^https?:/i.test(entry.dataUrl)) {
    throw new Error(`Remote texture cannot be packed without downloading first: ${entry.dataUrl}`);
  }
  const sourceUrl = entry.dataUrl;
  const sourcePath = resolve(process.cwd(), sourceUrl.replaceAll("/", "\\"));
  const mime = mimeByExtension.get(extname(sourcePath).toLowerCase());
  if (!mime) throw new Error(`Unsupported texture type: ${sourcePath}`);
  const bytes = await readFile(sourcePath);
  originalUrlByName.set(entry.name, sourceUrl);
  entry.dataUrl = `data:${mime};base64,${bytes.toString("base64")}`;
  packed++;
}

const libraryNames = new Set((project.textureLibrary || []).map(entry => entry?.name).filter(Boolean));
for (const object of project.scene.objects) {
  if (!object?.textureName || !libraryNames.has(object.textureName)) continue;
  const originalUrl = originalUrlByName.get(object.textureName);
  if (!object.textureUrl || object.textureUrl === originalUrl || /^data:/i.test(object.textureUrl)) {
    object.textureUrl = null;
    object.color = "#ffffff";
  }
}

await writeFile(outputPath, `${JSON.stringify(project, null, 2)}\n`, "utf8");
console.log(`Packed ${packed} texture${packed === 1 ? "" : "s"} into ${outputPath}`);
