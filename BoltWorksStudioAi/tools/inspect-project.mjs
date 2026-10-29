#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const knownShapes = new Set([
  "box", "sphere", "cylinder", "cone", "torus", "panel", "wedge",
  "hollowBox", "tube", "curvedPanel", "ring", "arch", "hemisphere",
  "dome", "capsule", "pyramid", "prism", "tetrahedron",
  "pyramidFrustum", "facetedBallLow", "facetedBallMedium",
  "facetedBallHigh", "heart", "stair", "beveledPanel"
]);

const shapeAliases = new Map([
  ["cube", "box"],
  ["hollowbox", "hollowBox"],
  ["hollow_box", "hollowBox"],
  ["curvedpanel", "curvedPanel"],
  ["curved_panel", "curvedPanel"],
  ["halfsphere", "hemisphere"],
  ["half_sphere", "hemisphere"],
  ["pyramidfrustum", "pyramidFrustum"],
  ["pyramid_frustum", "pyramidFrustum"],
  ["truncatedpyramid", "pyramidFrustum"],
  ["tetra", "tetrahedron"],
  ["stairs", "stair"]
]);

function usage() {
  return [
    "Usage:",
    "  node BoltWorksStudioAi/tools/inspect-project.mjs PROJECT.modelerproj [--json] [--surface-warnings] [--bounds OBJECT_ID]",
    "",
    "Exit code is non-zero when structural errors are found."
  ].join("\n");
}

const args = process.argv.slice(2);
const jsonOutput = args.includes("--json");
const boundsIndex = args.indexOf("--bounds");
const boundsId = boundsIndex >= 0 ? args[boundsIndex + 1] : args.find(arg => arg.startsWith("--bounds="))?.slice(9);
const inputArg = args.find((arg, index) => !arg.startsWith("--") && !(boundsIndex >= 0 && index === boundsIndex + 1));

if (!inputArg || args.includes("--help") || args.includes("-h")) {
  console.log(usage());
  process.exit(inputArg ? 0 : 2);
}
if (boundsIndex >= 0 && (!boundsId || boundsId.startsWith("--"))) {
  console.error("--bounds requires an object ID.");
  process.exit(2);
}

const inputPath = path.resolve(inputArg);
const errors = [];
const warnings = [];

function error(message) {
  errors.push(message);
}

function warn(message) {
  warnings.push(message);
}

function finiteVec3(value) {
  return Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
}

function normalizeShape(shape = "box") {
  const raw = String(shape || "box").trim();
  if (knownShapes.has(raw)) return raw;
  const key = raw.toLowerCase().replace(/[-\s]/g, "_");
  return shapeAliases.get(key) || shapeAliases.get(key.replace(/_/g, "")) || raw;
}

function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

function localBoundsForShape(shape) {
  switch (shape) {
    case "sphere": return [[-.55, -.55, -.55], [.55, .55, .55]];
    case "cylinder": return [[-.48, -.5, -.48], [.48, .5, .48]];
    case "cone": return [[-.55, -.5, -.55], [.55, .5, .55]];
    case "torus": return [[-.56, -.56, -.14], [.56, .56, .14]];
    case "panel": return [[-.5, -.5, -.04], [.5, .5, .04]];
    case "hollowBox": return [[-.5, -.5, -.11], [.5, .5, .11]];
    case "ring": return [[-.5, -.5, -.05], [.5, .5, .05]];
    case "arch": return [[-.5, -.5, -.12], [.5, .5, .12]];
    case "hemisphere": return [[-.55, 0, -.55], [.55, .55, .55]];
    case "dome": return [[-.55, 0, -.55], [.55, .303, .55]];
    case "capsule": return [[-.32, -.67, -.32], [.32, .67, .32]];
    case "pyramid":
    case "pyramidFrustum": return [[-.68, -.5, -.68], [.68, .5, .68]];
    case "prism": return [[-.5, -.42, -.5], [.5, .48, .5]];
    case "facetedBallLow":
    case "facetedBallMedium":
    case "facetedBallHigh": return [[-.58, -.58, -.58], [.58, .58, .58]];
    case "heart": return [[-.78, -.64, -.1], [.78, .56, .1]];
    case "curvedPanel": return [[-.7, -.5, -.7], [.7, .5, .7]];
    default: return [[-.5, -.5, -.5], [.5, .5, .5]];
  }
}

function localBoundsFromGeometry(geometry) {
  const positions = geometry?.positions;
  if (!Array.isArray(positions) || positions.length < 3) return null;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let index = 0; index + 2 < positions.length; index += 3) {
    for (let axis = 0; axis < 3; axis++) {
      const value = Number(positions[index + axis]);
      if (!Number.isFinite(value)) continue;
      min[axis] = Math.min(min[axis], value);
      max[axis] = Math.max(max[axis], value);
    }
  }
  return min.every(Number.isFinite) && max.every(Number.isFinite) ? [min, max] : null;
}

function rotateX([x, y, z], angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [x, y * c - z * s, y * s + z * c];
}

function rotateY([x, y, z], angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [x * c + z * s, y, -x * s + z * c];
}

function rotateZ([x, y, z], angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [x * c - y * s, x * s + y * c, z];
}

function objectBounds(object) {
  if (!finiteVec3(object.position) || !finiteVec3(object.rotation) || !finiteVec3(object.scale)) return null;
  const local = localBoundsFromGeometry(object.geometry) || localBoundsForShape(normalizeShape(object.shape));
  const [min, max] = local;
  const corners = [];
  const radians = object.rotation.map(value => value * Math.PI / 180);
  for (const x of [min[0], max[0]]) {
    for (const y of [min[1], max[1]]) {
      for (const z of [min[2], max[2]]) {
        let point = [x * object.scale[0], y * object.scale[1], z * object.scale[2]];
        point = rotateX(point, radians[0]);
        point = rotateY(point, radians[1]);
        point = rotateZ(point, radians[2]);
        corners.push(point.map((value, axis) => value + object.position[axis]));
      }
    }
  }
  return {
    min: [0, 1, 2].map(axis => Math.min(...corners.map(point => point[axis]))),
    max: [0, 1, 2].map(axis => Math.max(...corners.map(point => point[axis])))
  };
}

function roundVec(values) {
  return values.map(value => Math.round(value * 1000) / 1000);
}

let data;
try {
  data = JSON.parse(fs.readFileSync(inputPath, "utf8"));
} catch (cause) {
  console.error(`Could not read project: ${cause.message}`);
  process.exit(2);
}

const isProject = data?.kind === "modeler-project";
const scene = isProject ? data.scene : data;
const objects = Array.isArray(scene?.objects) ? scene.objects : [];
const groups = Array.isArray(scene?.groups) ? scene.groups : [];
const textures = isProject && Array.isArray(data.textureLibrary) ? data.textureLibrary : [];

if (isProject && data.version !== 1) warn(`Project version is ${data.version}; current canonical wrapper version is 1.`);
if (!scene || !Array.isArray(scene.objects)) error("No scene.objects array was found.");
if (!isProject) warn("This is a legacy scene JSON, not a portable modeler-project wrapper.");
if (!objects.length) error("The scene contains no objects.");

for (const id of duplicateValues(objects.map(object => object?.id).filter(Boolean))) error(`Duplicate object id: ${id}`);
for (const id of duplicateValues(groups.map(group => group?.id).filter(Boolean))) error(`Duplicate group id: ${id}`);
for (const name of duplicateValues(textures.map(texture => texture?.name).filter(Boolean))) error(`Duplicate texture name: ${name}`);

const groupById = new Map(groups.filter(group => group?.id).map(group => [group.id, group]));
for (const group of groups) {
  if (!group?.id) error("A group has no id.");
  if (!group?.name) error(`Group ${group?.id || "<unknown>"} has no name.`);
  if (group?.parentId && !groupById.has(group.parentId)) error(`Group ${group.id} references missing parent ${group.parentId}.`);
  const ancestry = new Set([group?.id]);
  let parentId = group?.parentId;
  while (parentId) {
    if (ancestry.has(parentId)) {
      error(`Group cycle detected at ${group.id}.`);
      break;
    }
    ancestry.add(parentId);
    parentId = groupById.get(parentId)?.parentId || null;
  }
}

const textureByName = new Map();
for (const texture of textures) {
  if (!texture?.name) error("A texture library entry has no name.");
  else textureByName.set(texture.name, texture);
  if (!/^data:image\/[A-Za-z0-9.+-]+;base64,/.test(texture?.dataUrl || "")) {
    error(`Texture ${texture?.name || "<unknown>"} is not an embedded image data URL.`);
  }
}

const boundsByObject = [];
let legacyMissingIds = 0;
const legacyDefaultTransforms = { position: 0, rotation: 0, scale: 0 };
for (const [index, object] of objects.entries()) {
  const label = object?.name || object?.id || `object[${index}]`;
  if (!object?.id) {
    if (isProject) error(`${label} has no id.`);
    else legacyMissingIds++;
  }
  if (!object?.name) error(`${label} has no name.`);
  const shape = normalizeShape(object?.shape);
  if (!knownShapes.has(shape) && !object?.geometry) {
    error(`${label} uses unknown shape ${JSON.stringify(object?.shape)}; the studio would silently fall back to a box.`);
  }
  if (shape === "beveledPanel" && !object?.geometry) error(`${label} is a beveledPanel without generated geometry.`);
  if (object?.geometry) {
    const positions = object.geometry.positions;
    if (!Array.isArray(positions) || positions.length < 9 || positions.length % 3 !== 0 || !positions.every(Number.isFinite)) {
      error(`${label} has invalid custom geometry positions.`);
    }
    if (Array.isArray(object.geometry.uvs) && object.geometry.uvs.length % 2 !== 0) warn(`${label} has an odd UV value count.`);
  }
  for (const field of ["position", "rotation", "scale"]) {
    if (!finiteVec3(object?.[field])) {
      if (!isProject && object?.[field] == null) legacyDefaultTransforms[field]++;
      else error(`${label}.${field} must contain exactly three finite numbers.`);
    }
  }
  if (finiteVec3(object?.scale)) {
    if (object.scale.some(value => value === 0)) error(`${label} has a zero scale component.`);
    if (object.scale.some(value => value < 0)) warn(`${label} has negative scale; verify normals and mirroring in QA.`);
  }
  if (!/^#[0-9A-Fa-f]{6}$/.test(object?.color || "")) error(`${label} has invalid color ${JSON.stringify(object?.color)}.`);
  if (!Number.isFinite(object?.roughness) || object.roughness < 0 || object.roughness > 1) error(`${label}.roughness must be between 0 and 1.`);
  if (object?.groupId && !groupById.has(object.groupId)) error(`${label} references missing group ${object.groupId}.`);
  if (object?.textureName && !textureByName.has(object.textureName) && !object?.textureUrl) {
    error(`${label} references missing texture ${object.textureName}.`);
  }
  if (object?.textureUrl && !String(object.textureUrl).startsWith("data:image/")) {
    warn(`${label} uses a non-embedded textureUrl and may not be portable.`);
  }
  const bounds = objectBounds({
    ...object,
    position: finiteVec3(object?.position) ? object.position : [0, .5, 0],
    rotation: finiteVec3(object?.rotation) ? object.rotation : [0, 0, 0],
    scale: finiteVec3(object?.scale) ? object.scale : [1, 1, 1]
  });
  if (bounds) boundsByObject.push({ id: object.id, name: object.name, ...bounds });
}

if (legacyMissingIds) warn(`${legacyMissingIds} legacy objects have no saved id; the studio will assign runtime ids while loading.`);
for (const [field, count] of Object.entries(legacyDefaultTransforms)) {
  if (count) warn(`${count} legacy objects omit ${field}; the studio loader will apply its default ${field}.`);
}

let sceneBounds = null;
if (boundsByObject.length) {
  sceneBounds = {
    min: [0, 1, 2].map(axis => Math.min(...boundsByObject.map(bounds => bounds.min[axis]))),
    max: [0, 1, 2].map(axis => Math.max(...boundsByObject.map(bounds => bounds.max[axis])))
  };
  sceneBounds.size = sceneBounds.max.map((value, axis) => value - sceneBounds.min[axis]);
  sceneBounds.min = roundVec(sceneBounds.min);
  sceneBounds.max = roundVec(sceneBounds.max);
  sceneBounds.size = roundVec(sceneBounds.size);
}

const belowGround = boundsByObject
  .filter(bounds => bounds.min[1] < -.001)
  .map(bounds => ({ id: bounds.id, name: bounds.name, minimumY: Math.round(bounds.min[1] * 1000) / 1000 }));

const boundsLookup = new Map(boundsByObject.filter(entry => entry.id).map(entry => [entry.id, entry]));
function boundsSummary(entry) {
  if (!entry) return null;
  const size = entry.max.map((value, axis) => value - entry.min[axis]);
  return {
    min: roundVec(entry.min), max: roundVec(entry.max), size: roundVec(size),
    center: roundVec(entry.min.map((value, axis) => (value + entry.max[axis]) / 2)),
    fractionOfSceneSize: sceneBounds?.size.map((value, axis) => value > 0 ? Math.round(size[axis] / value * 1000) / 1000 : null) || null
  };
}

// A conservative axis-aligned heuristic. Intersections can be intentional;
// these are review candidates, never automatic geometry changes.
const potentialCoplanarFaces = [];
const potentialVolumeOverlaps = [];
if (args.includes("--surface-warnings")) {
  const candidates = objects.map(object => ({ object, bounds: boundsLookup.get(object.id) }))
    .filter(entry => entry.bounds && finiteVec3(entry.object.rotation) && entry.object.rotation.every(angle => Math.abs(angle / 90 - Math.round(angle / 90)) < .00001));
  for (let left = 0; left < candidates.length && (potentialCoplanarFaces.length < 30 || potentialVolumeOverlaps.length < 30); left++) {
    for (let right = left + 1; right < candidates.length && (potentialCoplanarFaces.length < 30 || potentialVolumeOverlaps.length < 30); right++) {
      const a = candidates[left], b = candidates[right];
      if (a.object.hidden || b.object.hidden) continue;
      const intersection = [0, 1, 2].map(axis => Math.max(0, Math.min(a.bounds.max[axis], b.bounds.max[axis]) - Math.max(a.bounds.min[axis], b.bounds.min[axis])));
      const intersectionVolume = intersection.reduce((product, value) => product * value, 1);
      const volumes = [a.bounds, b.bounds].map(bounds => bounds.max.map((value, axis) => value - bounds.min[axis]).reduce((product, value) => product * value, 1));
      if (intersectionVolume > .000001 && intersectionVolume / Math.min(...volumes) > .1 && potentialVolumeOverlaps.length < 30) {
        potentialVolumeOverlaps.push({ ids: [a.object.id, b.object.id], approximateSharedVolume: Math.round(intersectionVolume * 1000) / 1000 });
      }
      for (let axis = 0; axis < 3; axis++) {
        const other = [0, 1, 2].filter(value => value !== axis);
        const overlap = other.map(value => Math.min(a.bounds.max[value], b.bounds.max[value]) - Math.max(a.bounds.min[value], b.bounds.min[value]));
        if (overlap.some(value => value < .02)) continue;
        // Opposite min/max faces merely touching are ordinary butt joints.
        const matchingFace = Math.abs(a.bounds.min[axis] - b.bounds.min[axis]) < .002 ||
          Math.abs(a.bounds.max[axis] - b.bounds.max[axis]) < .002;
        if (matchingFace && potentialCoplanarFaces.length < 30) {
          potentialCoplanarFaces.push({ ids: [a.object.id, b.object.id], axis: "XYZ"[axis], overlap: roundVec(overlap) });
          break;
        }
      }
    }
  }
}

const report = {
  valid: errors.length === 0,
  file: inputPath,
  format: isProject ? "modeler-project" : "legacy-scene",
  projectName: isProject ? data.name : path.basename(inputPath),
  counts: {
    objects: objects.length,
    groups: groups.length,
    textures: textures.length,
    hiddenObjects: objects.filter(object => object?.hidden).length,
    customGeometryObjects: objects.filter(object => object?.geometry).length,
    texturedObjects: objects.filter(object => object?.textureName || object?.textureUrl).length
  },
  approximateSceneBounds: sceneBounds,
  belowGroundObjects: belowGround,
  potentialCoplanarFaces,
  potentialVolumeOverlaps,
  groups: groups.map(group => ({ id: group.id, name: group.name, parentId: group.parentId || null })),
  objects: objects.map(object => ({
    id: object.id,
    name: object.name,
    shape: normalizeShape(object.shape),
    groupId: object.groupId || null,
    position: object.position,
    rotation: object.rotation,
    scale: object.scale,
    textureName: object.textureName || null,
    hidden: !!object.hidden,
    approximateBounds: boundsSummary(boundsLookup.get(object.id))
  })),
  errors,
  warnings,
  nextStep: errors.length
    ? "Correct structural errors before loading the project."
    : "Load this exact file in BoltWorks Studio, create a fresh QA Sheet, and inspect all six views."
};

if (boundsId) {
  const match = objects.find(object => object.id === boundsId);
  if (!match) {
    console.error(`Object ID not found: ${boundsId}`);
    process.exitCode = 1;
  } else {
    const detail = { id: boundsId, name: match.name, shape: normalizeShape(match.shape), bounds: boundsSummary(boundsLookup.get(boundsId)) };
    console.log(jsonOutput ? JSON.stringify(detail, null, 2) : `${detail.id}: min ${detail.bounds.min.join(", ")} | max ${detail.bounds.max.join(", ")} | size ${detail.bounds.size.join(", ")} | fraction of scene size ${detail.bounds.fractionOfSceneSize.join(", ")}`);
  }
} else if (jsonOutput) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`BoltWorksStudioAi inspection: ${report.projectName}`);
  console.log(`Format: ${report.format}`);
  console.log(`Objects: ${report.counts.objects} | Groups: ${report.counts.groups} | Textures: ${report.counts.textures}`);
  if (sceneBounds) console.log(`Approximate bounds: min ${sceneBounds.min.join(", ")} | max ${sceneBounds.max.join(", ")} | size ${sceneBounds.size.join(", ")}`);
  console.log(`Objects extending below Y=0: ${belowGround.length}`);
  if (args.includes("--surface-warnings")) console.log(`Potential coplanar face pairs: ${potentialCoplanarFaces.length}${potentialCoplanarFaces.length === 30 ? " (first 30 shown)" : ""}`);
  if (args.includes("--surface-warnings")) console.log(`Potential volume overlaps: ${potentialVolumeOverlaps.length}${potentialVolumeOverlaps.length === 30 ? " (first 30 shown)" : ""}`);
  if (errors.length) {
    console.log("Errors:");
    for (const message of errors) console.log(`  - ${message}`);
  }
  if (warnings.length) {
    console.log("Warnings:");
    for (const message of warnings) console.log(`  - ${message}`);
  }
  for (const pair of potentialCoplanarFaces) console.log(`  - Check coplanar ${pair.axis} faces: ${pair.ids.join(" / ")}`);
  for (const pair of potentialVolumeOverlaps) console.log(`  - Check intentional overlap: ${pair.ids.join(" / ")} (approximate volume ${pair.approximateSharedVolume})`);
  console.log(errors.length ? "FAILED" : "STRUCTURE OK — visual QA is still required.");
}

process.exitCode = process.exitCode || (errors.length ? 1 : 0);
