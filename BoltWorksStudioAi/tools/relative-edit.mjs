#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { Euler, Vector3 } from "three";

const [inputArg, editsArg, outputArg] = process.argv.slice(2);
if (!inputArg || !editsArg || !outputArg) {
  console.error("Usage: node BoltWorksStudioAi/tools/relative-edit.mjs input.modelerproj edits.json output.modelerproj");
  process.exit(2);
}

const inputPath = path.resolve(inputArg);
const outputPath = path.resolve(outputArg);
if (inputPath === outputPath) throw new Error("Use a new output path so the original project stays intact.");

const project = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const edits = JSON.parse(fs.readFileSync(path.resolve(editsArg), "utf8"));
if (project.kind !== "modeler-project" || !Array.isArray(project.scene?.objects)) throw new Error("Input must be a modeler-project with scene.objects.");
if (!Array.isArray(edits.operations)) throw new Error("edits.operations must be an array.");

const objects = project.scene.objects;
const byId = new Map();
for (const object of objects) {
  if (!object.id || byId.has(object.id)) throw new Error(`Missing or duplicate object id: ${object.id}`);
  byId.set(object.id, object);
}
const protectedIds = new Set(edits.protectedIds || []);
const vec3 = (value, label) => {
  if (!Array.isArray(value) || value.length !== 3 || !value.every(Number.isFinite)) throw new Error(`${label} must be three finite numbers.`);
  return value;
};

function bounds(object) {
  const shape = object.shape || "box";
  let min, max;
  if (object.geometry?.positions) {
    const positions = object.geometry.positions;
    if (!Array.isArray(positions) || positions.length < 9 || positions.length % 3 || !positions.every(Number.isFinite)) throw new Error(`${object.id}: invalid geometry positions.`);
    min = [0, 1, 2].map(axis => Math.min(...positions.filter((_, i) => i % 3 === axis)));
    max = [0, 1, 2].map(axis => Math.max(...positions.filter((_, i) => i % 3 === axis)));
  } else if (shape === "box" || shape === "cube") {
    min = [-.5, -.5, -.5]; max = [.5, .5, .5];
  } else if (shape === "panel") {
    min = [-.5, -.5, -.04]; max = [.5, .5, .04];
  } else {
    throw new Error(`${object.id}: relative anchors currently require a box, panel, or custom geometry. ${shape} needs visual bounds review.`);
  }
  const position = vec3(object.position, `${object.id}.position`);
  const rotation = vec3(object.rotation, `${object.id}.rotation`);
  const scale = vec3(object.scale, `${object.id}.scale`);
  const euler = new Euler(...rotation.map(degrees => degrees * Math.PI / 180), "XYZ");
  const points = [];
  for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) {
    points.push(new Vector3(x * scale[0], y * scale[1], z * scale[2]).applyEuler(euler).add(new Vector3(...position)));
  }
  return {
    min: [0, 1, 2].map(axis => Math.min(...points.map(point => point.getComponent(axis)))),
    max: [0, 1, 2].map(axis => Math.max(...points.map(point => point.getComponent(axis))))
  };
}

function anchor(object, side) {
  const box = bounds(object);
  const center = box.min.map((value, axis) => (value + box.max[axis]) / 2);
  const result = [...center];
  const sides = { left: [0, "min"], right: [0, "max"], bottom: [1, "min"], top: [1, "max"], back: [2, "min"], front: [2, "max"] };
  if (side !== "center") {
    const spec = sides[side];
    if (!spec) throw new Error(`Unknown anchor ${side}. Use center, left, right, bottom, top, back, or front.`);
    result[spec[0]] = box[spec[1]][spec[0]];
  }
  return result;
}

const changes = [];
function compact(value) {
  if (value == null || ["string", "number", "boolean"].includes(typeof value)) return value ?? null;
  if (Array.isArray(value) && value.length <= 4 && value.every(item => item == null || ["string", "number", "boolean"].includes(typeof item))) return value;
  return "[complex value]";
}
for (const [index, operation] of edits.operations.entries()) {
  const id = operation.id;
  if (typeof id !== "string" || !id) throw new Error(`Operation ${index} needs an id.`);
  if (protectedIds.has(id)) throw new Error(`${id} is protected by edits.protectedIds.`);
  const existing = byId.get(id);
  if (existing?.locked === true) throw new Error(`${id} is locked in the project. Unlock it in BWS before editing.`);
  if (operation.action === "add" && existing) throw new Error(`${id} already exists; use update.`);
  if (operation.action === "update" && !existing) throw new Error(`${id} does not exist; use add.`);
  if (!["add", "update"].includes(operation.action)) throw new Error(`${id}: action must be add or update.`);
  const before = existing ? structuredClone(existing) : null;
  const fields = operation.fields || {};
  if (fields.id && fields.id !== id) throw new Error(`${id}: fields.id cannot rename an object.`);
  if (fields.positionFrom) throw new Error(`${id}: put positionFrom on the operation, outside fields.`);
  const result = { ...(existing || {}), ...fields, id };
  if (operation.positionFrom) {
    const spec = operation.positionFrom;
    const reference = byId.get(spec.relativeTo);
    if (!reference) throw new Error(`${id}: missing relativeTo object ${spec.relativeTo}.`);
    if (reference.id === id) throw new Error(`${id}: cannot position relative to itself.`);
    const offset = vec3(spec.offset || [0, 0, 0], `${id}.offset`);
    const ownAnchor = spec.ownAnchor || "center";
    const referenceAnchor = anchor(reference, spec.anchor || "center");
    const currentAnchor = anchor({ ...result, position: [0, 0, 0] }, ownAnchor);
    result.position = referenceAnchor.map((value, axis) => Number((value + offset[axis] - currentAnchor[axis]).toFixed(6)));
    if (spec.keepLinked === true) {
      result.relativePlacement = { relativeTo: spec.relativeTo, anchor: spec.anchor || "center", ownAnchor, offset };
    } else {
      delete result.relativePlacement;
    }
  }
  vec3(result.position, `${id}.position`);
  vec3(result.rotation, `${id}.rotation`);
  vec3(result.scale, `${id}.scale`);
  if (operation.action === "add") objects.push(result);
  else Object.assign(existing, result);
  byId.set(id, result);
  const changedFields = Object.keys(result).filter(key => JSON.stringify(before?.[key]) !== JSON.stringify(result[key]));
  const fieldChanges = Object.fromEntries(changedFields.map(key => [key, { before: compact(before?.[key]), after: compact(result[key]) }]));
  changes.push({ action: operation.action, id, fieldChanges, previousPosition: before?.position || null, position: result.position });
}

fs.writeFileSync(outputPath, JSON.stringify(project, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ output: outputPath, changes }, null, 2));
