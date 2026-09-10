#!/usr/bin/env node

import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

const THIS_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(THIS_DIR, "..", "..");
const MCP_SERVER = resolve(THIS_DIR, "server.mjs");
const GROUP_ID = "oak-type-a";
const GROUP_NAME = "Low Poly Deciduous Oak — Type A";

function resultOf(response, label) {
  assert.equal(response?.isError, undefined, `${label} returned an MCP tool error.`);
  assert(response?.structuredContent && typeof response.structuredContent === "object", `${label} returned no structured result.`);
  return response.structuredContent;
}

function branch(id, name, start, end, diameter, color = "#5a3420") {
  const a = new THREE.Vector3(...start);
  const b = new THREE.Vector3(...end);
  const direction = b.clone().sub(a);
  const length = direction.length();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.clone().normalize()
  );
  const euler = new THREE.Euler().setFromQuaternion(quaternion, "XYZ");
  return {
    id,
    shape: "cylinder",
    name,
    position: a.clone().add(b).multiplyScalar(0.5).toArray(),
    rotation: [THREE.MathUtils.radToDeg(euler.x), THREE.MathUtils.radToDeg(euler.y), THREE.MathUtils.radToDeg(euler.z)],
    scale: [diameter, length, diameter],
    color,
    roughness: 0.92,
    groupId: GROUP_ID,
    groupName: GROUP_NAME
  };
}

function foliage(id, name, position, scale, color, rotation = [0, 0, 0]) {
  return {
    id,
    shape: "facetedBallLow",
    name,
    position,
    rotation,
    scale,
    color,
    roughness: 0.88,
    groupId: GROUP_ID,
    groupName: GROUP_NAME
  };
}

const objects = [
  {
    id: "oak-trunk-base",
    shape: "pyramidFrustum",
    name: "Oak trunk — flared base",
    position: [0, 1.35, 0],
    rotation: [0, 7, -2],
    scale: [1.15, 2.7, 1.02],
    color: "#65402a",
    roughness: 0.95,
    groupId: GROUP_ID,
    groupName: GROUP_NAME
  },
  {
    id: "oak-trunk-upper",
    shape: "pyramidFrustum",
    name: "Oak trunk — upper taper",
    position: [0.03, 3.25, 0.01],
    rotation: [1, -8, 2],
    scale: [0.82, 2.15, 0.72],
    color: "#5a3420",
    roughness: 0.95,
    groupId: GROUP_ID,
    groupName: GROUP_NAME
  },
  branch("oak-branch-left-main", "Oak branch — left main", [-0.05, 3.05, 0], [-1.65, 4.15, 0.18], 0.55),
  branch("oak-branch-left-tip", "Oak branch — left tip", [-1.62, 4.12, 0.18], [-2.35, 4.72, 0.28], 0.34),
  branch("oak-branch-right-main", "Oak branch — right main", [0.08, 3.35, 0], [1.5, 4.45, -0.08], 0.52),
  branch("oak-branch-right-tip", "Oak branch — right tip", [1.48, 4.42, -0.08], [2.18, 4.95, 0.12], 0.31),
  branch("oak-branch-crown", "Oak branch — crown leader", [0.03, 4.05, 0], [0.25, 5.65, 0.06], 0.43),
  branch("oak-branch-front", "Oak branch — front", [0.02, 3.65, 0.05], [-0.35, 4.55, 1.05], 0.37),
  branch("oak-branch-back", "Oak branch — back", [0.08, 3.9, -0.03], [0.65, 4.78, -0.95], 0.33),
  foliage("oak-foliage-crown", "Oak foliage — crown", [0.15, 6.05, 0], [2.35, 2.05, 2.05], "#527a32", [0, 14, 4]),
  foliage("oak-foliage-upper-left", "Oak foliage — upper left", [-1.25, 5.75, 0.18], [1.75, 1.65, 1.65], "#5d8737", [8, -10, -5]),
  foliage("oak-foliage-upper-right", "Oak foliage — upper right", [1.25, 5.6, -0.18], [1.8, 1.55, 1.6], "#47702e", [-5, 18, 8]),
  foliage("oak-foliage-left", "Oak foliage — left crown", [-2.15, 4.75, 0.25], [1.65, 1.55, 1.5], "#4e7c31", [4, 22, -6]),
  foliage("oak-foliage-right", "Oak foliage — right crown", [2.0, 4.95, 0.12], [1.6, 1.45, 1.5], "#648d3c", [-8, -12, 5]),
  foliage("oak-foliage-front", "Oak foliage — front crown", [-0.35, 4.65, 1.12], [1.55, 1.35, 1.45], "#6a913e", [12, 9, 4]),
  foliage("oak-foliage-back", "Oak foliage — rear crown", [0.7, 4.9, -1.0], [1.6, 1.4, 1.35], "#3f6829", [-6, 17, -3]),
  foliage("oak-foliage-lower-left", "Oak foliage — lower left", [-1.05, 4.15, 0.45], [1.35, 1.2, 1.2], "#557f34", [7, -16, 10]),
  foliage("oak-foliage-lower-right", "Oak foliage — lower right", [1.0, 4.25, 0.45], [1.3, 1.15, 1.2], "#73974a", [-4, 25, -8])
];

const client = new Client({ name: "boltworks-oak-builder", version: "1.0.0" });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [MCP_SERVER],
  cwd: REPO_ROOT,
  env: { ...process.env },
  stderr: "pipe"
});

try {
  await client.connect(transport);
  const capabilities = resultOf(await client.callTool({ name: "bws_get_capabilities", arguments: {} }), "capabilities");
  const before = resultOf(await client.callTool({ name: "bws_get_scene", arguments: { detail: "summary" } }), "scene before");
  assert.equal(before.objectCount, 0, "Expected an empty workspace before building the oak.");

  const session = resultOf(await client.callTool({
    name: "bws_start_work_session",
    arguments: {
      goal: "Create and visually refine one game-ready low-poly deciduous oak Type A from the supplied reference, keeping every trunk, branch, and foliage mass editable.",
      durationSeconds: 1200,
      unlimited: false
    }
  }), "start work session");

  const created = resultOf(await client.callTool({
    name: "bws_create_objects",
    arguments: { objects, expectedRevision: before.revision }
  }), "create oak");

  resultOf(await client.callTool({
    name: "bws_add_session_note",
    arguments: {
      category: "progress",
      text: `Built the Type A deciduous oak blockout as ${objects.length} editable low-poly parts: two tapered trunk sections, seven directional branches, and nine varied faceted foliage masses.`
    }
  }), "session note");

  const after = resultOf(await client.callTool({ name: "bws_get_scene", arguments: { detail: "objects" } }), "scene after");
  console.log(JSON.stringify({
    capabilitiesRevision: capabilities.revision,
    session: session.session,
    createdIds: created.createdIds,
    revision: after.revision,
    objectCount: after.objects?.length,
    objects: after.objects?.map(({ id, name, shape, position, rotation, scale }) => ({ id, name, shape, position, rotation, scale }))
  }, null, 2));
} finally {
  await client.close().catch(() => {});
}
