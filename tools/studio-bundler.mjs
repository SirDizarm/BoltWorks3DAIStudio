import { mkdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { composeStudioSource } from "../app/source-composer.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export async function buildStudioBundle({ outfile = join(root, "app", "studio-v48.0.13.js"), write = true } = {}) {
  const entrySource = await composeStudioSource(name =>
    readFile(join(root, "app", "modules", `${name}.js`), "utf8")
  );
  if (write) await mkdir(dirname(outfile), { recursive: true });
  const result = await build({
    stdin: {
      contents: entrySource,
      loader: "js",
      resolveDir: join(root, "app"),
      sourcefile: "studio-entry.js"
    },
    banner: { js: "/* Generated from app/modules. Do not edit this bundle directly. */" },
    bundle: true,
    format: "iife",
    target: ["es2020"],
    legalComments: "none",
    minify: false,
    outfile,
    write
  });
  if (write) return readFile(outfile, "utf8");
  const output = result.outputFiles?.find(file => file.path.endsWith(".js"));
  if (!output) throw new Error("Studio bundler did not produce JavaScript output");
  return output.text;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const source = await buildStudioBundle();
  console.log(`Direct-open studio bundle built (${source.length} bytes).`);
}
