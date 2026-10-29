#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const aiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const studioRoot = path.resolve(aiRoot, "..");
const input = path.join(aiRoot, "examples", "offline-ai-base.modelerproj");
const recipe = path.join(aiRoot, "examples", "offline-ai-edits.json");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "bws-offline-ai-"));
const hash = file => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const inputHash = hash(input);
const run = (script, args) => spawnSync(process.execPath, [script, ...args], { cwd: studioRoot, encoding: "utf8" });

try {
  const output = path.join(temp, "result.modelerproj");
  const edit = run(path.join(aiRoot, "tools", "relative-edit.mjs"), [input, recipe, output]);
  assert.equal(edit.status, 0, edit.stderr);
  const diff = JSON.parse(edit.stdout);
  assert.deepEqual(diff.changes.map(change => change.id), ["hand-left"]);
  assert.deepEqual(diff.changes[0].position, [1, .9, 0]);
  assert.deepEqual(diff.changes[0].fieldChanges.position.after, [1, .9, 0]);
  const project = JSON.parse(fs.readFileSync(output, "utf8"));
  assert.equal(project.scene.objects.find(object => object.id === "head").locked, true);
  assert.equal(project.scene.objects.find(object => object.id === "hand-left").relativePlacement.relativeTo, "arm-left");
  assert.equal(hash(input), inputHash, "source project was modified");

  const inspect = run(path.join(aiRoot, "tools", "inspect-project.mjs"), [output, "--json", "--surface-warnings"]);
  assert.equal(inspect.status, 0, inspect.stderr);
  const report = JSON.parse(inspect.stdout);
  assert.equal(report.valid, true);
  assert.equal(report.counts.objects, 3);
  assert.equal(report.potentialCoplanarFaces.length, 0, "touching arm and hand should not trigger z-fighting warning");

  const queried = run(path.join(aiRoot, "tools", "inspect-project.mjs"), [output, "--bounds", "hand-left", "--json"]);
  assert.equal(queried.status, 0, queried.stderr);
  assert.deepEqual(JSON.parse(queried.stdout).bounds.size, [.3, .2, .3]);

  const blocked = path.join(temp, "blocked.json");
  fs.writeFileSync(blocked, JSON.stringify({ operations: [{ action: "update", id: "head", fields: { color: "#ffffff" } }] }));
  const deniedOutput = path.join(temp, "denied.modelerproj");
  const denied = run(path.join(aiRoot, "tools", "relative-edit.mjs"), [input, blocked, deniedOutput]);
  assert.notEqual(denied.status, 0);
  assert.match(denied.stderr, /locked in the project/);
  assert.equal(fs.existsSync(deniedOutput), false);

  if (process.argv.includes("--preview")) {
    const preview = path.join(temp, "preview.png");
    const rendered = run(path.join(aiRoot, "tools", "render-offline-preview.mjs"), [output, preview, "--width", "640", "--height", "480"]);
    assert.equal(rendered.status, 0, rendered.stderr);
    assert.ok(fs.statSync(preview).size > 1000, "preview should contain image data");
  }
  console.log(`Offline AI workflow OK${process.argv.includes("--preview") ? " with preview" : ""}.`);
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
