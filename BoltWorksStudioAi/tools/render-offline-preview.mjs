#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  BoxGeometry, CapsuleGeometry, ConeGeometry, CylinderGeometry,
  RingGeometry, SphereGeometry, TorusGeometry
} from "three";

const args = process.argv.slice(2);
if (!args.length || args.includes("--help")) {
  console.log("Usage: node BoltWorksStudioAi/tools/render-offline-preview.mjs input.modelerproj [output.png] [--width N] [--height N]");
  process.exit(args.includes("--help") ? 0 : 2);
}
const input = path.resolve(args[0]);
const output = args[1] && !args[1].startsWith("--")
  ? path.resolve(args[1])
  : path.join(path.dirname(input), `${path.basename(input, path.extname(input))}-preview.png`);
const optionStart = args[1] && !args[1].startsWith("--") ? 2 : 1;
const options = args.slice(optionStart);
const project = JSON.parse(fs.readFileSync(input, "utf8"));
if (!Array.isArray(project.scene?.objects)) throw new Error("Input needs scene.objects.");

const factories = {
  box: () => new BoxGeometry(1, 1, 1),
  cube: () => new BoxGeometry(1, 1, 1),
  panel: () => new BoxGeometry(1, 1, .08),
  sphere: () => new SphereGeometry(.55, 18, 12),
  cylinder: () => new CylinderGeometry(.48, .48, 1, 18),
  cone: () => new ConeGeometry(.55, 1, 18),
  torus: () => new TorusGeometry(.42, .14, 8, 24),
  ring: () => new RingGeometry(.28, .5, 24),
  capsule: () => new CapsuleGeometry(.32, .7, 8, 16)
};

const unsupported = [];
let converted = 0;
for (const object of project.scene.objects) {
  if (object.geometry?.positions?.length) continue;
  const factory = factories[object.shape];
  if (!factory) {
    unsupported.push(`${object.id || object.name || "unnamed"} (${object.shape})`);
    continue;
  }
  const primitive = factory();
  const expanded = primitive.index ? primitive.toNonIndexed() : primitive;
  object.geometry = {
    positions: [...expanded.getAttribute("position").array],
    normals: [...expanded.getAttribute("normal").array]
  };
  if (expanded !== primitive) expanded.dispose();
  primitive.dispose();
  converted++;
}

if (unsupported.length) console.warn(`Preview omits unsupported primitives: ${unsupported.join(", ")}`);
if (converted === 0 && !project.scene.objects.some(object => object.geometry?.positions?.length)) {
  throw new Error("No renderable objects. Supply custom geometry or one of the supported primitives.");
}
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "bws-preview-"));
try {
  const intermediate = path.join(temp, "preview-source.modelerproj");
  fs.writeFileSync(intermediate, JSON.stringify(project));
  const renderer = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "tools", "render-modelerproj-preview.mjs");
  const result = spawnSync(process.execPath, [renderer, intermediate, output, ...options], { encoding: "utf8" });
  if (result.stdout) process.stdout.write(result.stdout.replaceAll(intermediate, input));
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  process.exitCode = result.status || 0;
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
