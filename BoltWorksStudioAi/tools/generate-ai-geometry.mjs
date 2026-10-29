#!/usr/bin/env node

// Convert a small, text-friendly geometry recipe into ordinary BWS objects.
// The output is a portable project; no plugin or live editor connection is used.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Euler, Vector3 } from "three";

const EPS = 1e-8;
const finite = value => Number.isFinite(value);
const vec3 = (value, label) => {
  if (!Array.isArray(value) || value.length !== 3 || !value.every(finite)) throw new Error(`${label} must be three finite numbers.`);
  return value;
};
const add = (a, b) => a.map((value, i) => value + b[i]);
const sub = (a, b) => a.map((value, i) => value - b[i]);
const mul = (a, amount) => a.map(value => value * amount);
const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const length = a => Math.hypot(...a);
const unit = (a, label) => {
  const size = length(a);
  if (size < EPS) throw new Error(`${label} has zero length.`);
  return mul(a, 1 / size);
};

function triangle(positions, uvs, a, b, c, ua, ub, uc) {
  positions.push(...a, ...b, ...c);
  uvs.push(...ua, ...ub, ...uc);
}

function quad(positions, uvs, a, b, c, d, u0, u1, v0, v1) {
  triangle(positions, uvs, a, b, c, [u0, v0], [u0, v1], [u1, v1]);
  triangle(positions, uvs, a, c, d, [u0, v0], [u1, v1], [u1, v0]);
}

export function makeStrap(spec) {
  const id = String(spec.id || "").trim();
  if (!id) throw new Error("Each strap needs an id.");
  const points = spec.points;
  if (!Array.isArray(points) || points.length < 2 || points.length > 256) throw new Error(`${id}: points must contain 2–256 positions.`);
  points.forEach((point, i) => vec3(point, `${id}.points[${i}]`));
  for (let i = 1; i < points.length; i++) if (length(sub(points[i], points[i - 1])) < EPS) throw new Error(`${id}: neighboring points must differ.`);
  const width = Number(spec.width), thickness = Number(spec.thickness);
  if (!finite(width) || width <= 0 || !finite(thickness) || thickness <= 0) throw new Error(`${id}: width and thickness must be positive.`);
  if (spec.roughness != null && (!finite(spec.roughness) || spec.roughness < 0 || spec.roughness > 1)) throw new Error(`${id}: roughness must be between 0 and 1.`);
  const desiredAxis = unit(vec3(spec.widthAxis || [0, 0, 1], `${id}.widthAxis`), `${id}.widthAxis`);
  const center = mul(points.reduce(add, [0, 0, 0]), 1 / points.length);
  const local = points.map(point => sub(point, center));
  const distances = [0];
  for (let i = 1; i < points.length; i++) distances.push(distances[i - 1] + length(sub(points[i], points[i - 1])));
  const frames = local.map((point, i) => {
    const incoming = i ? unit(sub(local[i], local[i - 1]), `${id}.tangent`) : null;
    const outgoing = i + 1 < local.length ? unit(sub(local[i + 1], local[i]), `${id}.tangent`) : null;
    const tangent = unit(incoming && outgoing ? add(incoming, outgoing) : incoming || outgoing, `${id}.tangent`);
    let lateral = sub(desiredAxis, mul(tangent, dot(desiredAxis, tangent)));
    if (length(lateral) < EPS) {
      const fallback = Math.abs(tangent[1]) < .9 ? [0, 1, 0] : [1, 0, 0];
      lateral = sub(fallback, mul(tangent, dot(fallback, tangent)));
    }
    lateral = unit(lateral, `${id}.lateral`);
    const depth = unit(cross(tangent, lateral), `${id}.depth`);
    // Cross-section corners, seen looking along the path.
    return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([side, face]) =>
      add(add(point, mul(lateral, side * width / 2)), mul(depth, face * thickness / 2)));
  });
  const positions = [], uvs = [];
  for (let i = 0; i + 1 < frames.length; i++) {
    const u0 = distances[i] / distances.at(-1), u1 = distances[i + 1] / distances.at(-1);
    for (let side = 0; side < 4; side++) {
      const next = (side + 1) % 4;
      quad(positions, uvs, frames[i][side], frames[i][next], frames[i + 1][next], frames[i + 1][side], u0, u1, 0, 1);
    }
  }
  const first = frames[0], last = frames.at(-1);
  triangle(positions, uvs, first[0], first[2], first[1], [0, 0], [1, 1], [1, 0]);
  triangle(positions, uvs, first[0], first[3], first[2], [0, 0], [0, 1], [1, 1]);
  triangle(positions, uvs, last[0], last[1], last[2], [0, 0], [1, 0], [1, 1]);
  triangle(positions, uvs, last[0], last[2], last[3], [0, 0], [1, 1], [0, 1]);
  if (positions.length > 9000000) throw new Error(`${id}: geometry exceeds the BWS mesh limit.`);
  return {
    id, name: spec.name || id, shape: "custom", geometry: { positions, uvs },
    position: center, rotation: [0, 0, 0], scale: [1, 1, 1],
    color: spec.color || "#87694d", roughness: spec.roughness ?? .85,
    ...(spec.groupId ? { groupId: spec.groupId } : {})
  };
}

function textureData(layer, recipeDir) {
  if (layer.dataUrl) {
    if (!/^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i.test(layer.dataUrl)) throw new Error(`${layer.id || "layer"}: invalid embedded image dataUrl.`);
    return layer.dataUrl;
  }
  if (!layer.imagePath) throw new Error(`${layer.id || "layer"}: supply imagePath or dataUrl.`);
  const imagePath = path.resolve(recipeDir, layer.imagePath);
  const extension = path.extname(imagePath).toLowerCase();
  const mime = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif" }[extension];
  if (!mime) throw new Error(`${imagePath}: unsupported image extension.`);
  return `data:${mime};base64,${fs.readFileSync(imagePath).toString("base64")}`;
}

export function makeStack(spec, recipeDir, textureLibrary) {
  const id = String(spec.id || "").trim();
  if (!id) throw new Error("Each stack needs an id.");
  const layers = spec.layers;
  if (!Array.isArray(layers) || !layers.length || layers.length > 128) throw new Error(`${id}: layers must contain 1–128 entries.`);
  const origin = vec3(spec.position || [0, 0, 0], `${id}.position`);
  const stackRotation = vec3(spec.rotation || [0, 0, 0], `${id}.rotation`);
  const normal = new Vector3(0, 0, 1).applyEuler(new Euler(...stackRotation.map(degrees => degrees * Math.PI / 180), "XYZ")).toArray();
  const spacing = spec.spacing ?? .03;
  if (!finite(spacing) || spacing <= 0) throw new Error(`${id}: spacing must be positive.`);
  const objects = [];
  for (const [index, layer] of layers.entries()) {
    const layerId = layer.id || `${id}-layer-${index + 1}`;
    const size = layer.size;
    if (!Array.isArray(size) || size.length !== 2 || !size.every(value => finite(value) && value > 0)) throw new Error(`${layerId}: size must be positive [width, height].`);
    const thickness = layer.thickness ?? .01;
    if (!finite(thickness) || thickness <= 0 || thickness >= spacing) throw new Error(`${layerId}: thickness must be positive and smaller than spacing.`);
    if (layer.opacity != null && (!finite(layer.opacity) || layer.opacity < .05 || layer.opacity > 1)) throw new Error(`${layerId}: opacity must be between 0.05 and 1.`);
    if (layer.roughness != null && (!finite(layer.roughness) || layer.roughness < 0 || layer.roughness > 1)) throw new Error(`${layerId}: roughness must be between 0 and 1.`);
    const textureName = layer.textureName || `${id} layer ${index + 1}`;
    if (textureLibrary.some(item => item.name === textureName)) throw new Error(`${layerId}: duplicate texture name ${textureName}.`);
    textureLibrary.push({ name: textureName, dataUrl: textureData(layer, recipeDir), robloxAssetId: "" });
    const offset = vec3(layer.offset || [0, 0, 0], `${layerId}.offset`);
    const depth = (index - (layers.length - 1) / 2) * spacing;
    objects.push({
      id: layerId, name: layer.name || layerId, shape: "panel",
      position: add(add(origin, offset), mul(normal, depth)),
      rotation: vec3(layer.rotation || stackRotation, `${layerId}.rotation`),
      scale: [size[0], size[1], thickness / .08],
      color: "#ffffff", roughness: layer.roughness ?? .85,
      opacity: layer.opacity ?? 1, doubleSided: true,
      textureName, textureUrl: null, textureHasTransparency: layer.hasTransparency !== false,
      ...(spec.groupId ? { groupId: spec.groupId } : {})
    });
  }
  return objects;
}

export function generate(recipe, recipeDir, baseProject = null) {
  const project = baseProject ? structuredClone(baseProject) : {
    kind: "modeler-project", version: 1, name: recipe.name || "AI geometry",
    savedAt: new Date().toISOString(), textureLibrary: [],
    scene: { version: 2, coordinateSystem: {}, shapeConventions: {}, groups: [], objects: [], boneHierarchy: [] },
    editor: { projectName: recipe.name || "AI geometry" }
  };
  if (project.kind !== "modeler-project" || !Array.isArray(project.scene?.objects) || !Array.isArray(project.textureLibrary)) throw new Error("Base project must be a modeler-project.");
  if (!Array.isArray(project.scene.groups)) project.scene.groups = [];
  const ids = new Set(project.scene.objects.map(object => object.id));
  const addObject = object => { if (ids.has(object.id)) throw new Error(`Duplicate object id: ${object.id}.`); ids.add(object.id); project.scene.objects.push(object); };
  const ensureGroup = spec => {
    if (spec.groupId && !project.scene.groups.some(group => group.id === spec.groupId)) {
      project.scene.groups.push({ id: spec.groupId, name: spec.groupName || spec.groupId, parentId: null });
    }
  };
  for (const strap of recipe.straps || []) { ensureGroup(strap); addObject(makeStrap(strap)); }
  for (const stack of recipe.stacks || []) { ensureGroup(stack); for (const object of makeStack(stack, recipeDir, project.textureLibrary)) addObject(object); }
  if (project.scene.objects.length === 0) throw new Error("Recipe must produce at least one object.");
  return project;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [recipeArg, outputArg, baseArg] = process.argv.slice(2);
  if (!recipeArg || !outputArg) {
    console.error("Usage: node BoltWorksStudioAi/tools/generate-ai-geometry.mjs recipe.json output.modelerproj [base.modelerproj]");
    process.exit(2);
  }
  const recipePath = path.resolve(recipeArg), outputPath = path.resolve(outputArg);
  if ([recipePath, baseArg && path.resolve(baseArg)].includes(outputPath)) throw new Error("Output must be a new file; inputs are preserved.");
  const recipe = JSON.parse(fs.readFileSync(recipePath, "utf8"));
  const base = baseArg ? JSON.parse(fs.readFileSync(path.resolve(baseArg), "utf8")) : null;
  const result = generate(recipe, path.dirname(recipePath), base);
  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, { flag: "wx" });
  console.log(`Wrote ${result.scene.objects.length} objects and ${result.textureLibrary.length} textures to ${outputPath}`);
}
