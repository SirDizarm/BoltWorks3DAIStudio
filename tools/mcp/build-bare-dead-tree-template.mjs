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
const GROUP_ID = "bare-dead-tree-template";
const GROUP_NAME = "Bare Dead Tree — Canopy Template";

function resultOf(response, label) {
  assert.equal(response?.isError, undefined, `${label} returned an MCP tool error.`);
  assert(response?.structuredContent && typeof response.structuredContent === "object", `${label} returned no structured result.`);
  return response.structuredContent;
}

function branch(id, name, start, end, diameter, color = "#4B2D20") {
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
    id, shape: "cylinder", name,
    position: a.clone().add(b).multiplyScalar(0.5).toArray(),
    rotation: [THREE.MathUtils.radToDeg(euler.x), THREE.MathUtils.radToDeg(euler.y), THREE.MathUtils.radToDeg(euler.z)],
    scale: [diameter, length, diameter], color, roughness: 0.96,
    groupId: GROUP_ID, groupName: GROUP_NAME
  };
}

const trunk = (id, name, position, scale, rotation, color) => ({
  id, shape: "pyramidFrustum", name, position, scale, rotation, color,
  roughness: 0.97, groupId: GROUP_ID, groupName: GROUP_NAME
});

const objects = [
  trunk("dead-tree-trunk-base", "Dead tree — flared base", [-0.05, 1.10, 0], [0.78, 2.20, 0.68], [0, 7, -4], "#5A3928"),
  trunk("dead-tree-trunk-lower", "Dead tree — lower S-curve", [0.12, 2.95, 0.02], [0.59, 1.72, 0.53], [2, -10, 9], "#513121"),
  trunk("dead-tree-trunk-mid", "Dead tree — upper S-curve", [-0.08, 4.35, -0.01], [0.43, 1.55, 0.39], [-3, 12, -8], "#4A2B1D"),
  trunk("dead-tree-trunk-crown", "Dead tree — crown leader", [0.16, 6.05, 0.02], [0.30, 1.95, 0.28], [4, -9, 5], "#422619"),

  branch("dead-tree-left-low", "Dead tree — left lower limb", [-0.03, 3.20, 0.02], [-1.22, 4.04, 0.04], 0.35),
  branch("dead-tree-left-low-tip-a", "Dead tree — left lower fork A", [-1.18, 4.00, 0.04], [-1.98, 4.72, 0.10], 0.19, "#422619"),
  branch("dead-tree-left-low-tip-b", "Dead tree — left lower fork B", [-1.28, 4.05, 0.03], [-2.12, 4.13, -0.16], 0.16, "#422619"),
  branch("dead-tree-left-low-twig", "Dead tree — left lower twig", [-1.71, 4.47, 0.08], [-1.86, 5.08, 0.14], 0.11, "#3A2117"),

  branch("dead-tree-right-main", "Dead tree — right main limb", [0.00, 4.18, -0.01], [1.38, 4.94, -0.04], 0.31),
  branch("dead-tree-right-tip-a", "Dead tree — right fork A", [1.34, 4.92, -0.04], [2.22, 5.56, 0.03], 0.17, "#422619"),
  branch("dead-tree-right-tip-b", "Dead tree — right fork B", [1.23, 4.86, -0.02], [1.77, 4.72, 0.36], 0.14, "#422619"),
  branch("dead-tree-right-twig", "Dead tree — right outer twig", [2.10, 5.47, 0.03], [2.52, 5.97, 0.08], 0.10, "#3A2117"),

  branch("dead-tree-left-mid", "Dead tree — left middle limb", [-0.04, 4.55, 0.00], [-1.08, 5.43, 0.03], 0.25),
  branch("dead-tree-left-mid-tip-a", "Dead tree — left middle fork A", [-1.04, 5.39, 0.03], [-1.83, 5.88, 0.10], 0.14, "#422619"),
  branch("dead-tree-left-mid-tip-b", "Dead tree — left middle fork B", [-0.93, 5.34, 0.03], [-1.15, 6.16, -0.07], 0.12, "#3A2117"),

  branch("dead-tree-crown-left", "Dead tree — crown left fork", [0.10, 6.22, 0.02], [-0.60, 7.05, 0.04], 0.20),
  branch("dead-tree-crown-left-tip", "Dead tree — crown left twig", [-0.56, 7.00, 0.04], [-1.03, 7.63, 0.05], 0.11, "#3A2117"),
  branch("dead-tree-crown-right", "Dead tree — crown right fork", [0.20, 6.67, 0.01], [0.78, 7.50, -0.01], 0.17),
  branch("dead-tree-crown-right-tip", "Dead tree — crown right twig", [0.75, 7.45, -0.01], [1.26, 8.10, 0.02], 0.10, "#3A2117"),
  branch("dead-tree-top", "Dead tree — top twig", [0.26, 7.55, 0.01], [0.42, 8.75, 0.01], 0.12, "#3A2117"),
  branch("dead-tree-top-fork", "Dead tree — top fork", [0.35, 8.10, 0.01], [-0.08, 8.66, 0.04], 0.085, "#321B14")
];

const client = new Client({ name: "boltworks-bare-dead-tree-builder", version: "1.0.0" });
const transport = new StdioClientTransport({
  command: process.execPath, args: [MCP_SERVER], cwd: REPO_ROOT,
  env: { ...process.env }, stderr: "pipe"
});

try {
  await client.connect(transport);
  const capabilities = resultOf(await client.callTool({ name: "bws_get_capabilities", arguments: {} }), "capabilities");
  const before = resultOf(await client.callTool({ name: "bws_get_scene", arguments: { detail: "summary" } }), "scene before");
  assert.equal(before.objectCount, 0, "Expected an empty workspace before building the bare tree.");
  const session = resultOf(await client.callTool({
    name: "bws_start_work_session",
    arguments: { goal: "Create and visually refine one editable bare dead-tree template from the supplied reference: an S-curved tapered trunk and spindly branches, deliberately without a canopy so it can anchor future foliage.", durationSeconds: 1200, unlimited: false }
  }), "start work session");
  const created = resultOf(await client.callTool({ name: "bws_create_objects", arguments: { objects, expectedRevision: before.revision } }), "create bare tree");
  resultOf(await client.callTool({ name: "bws_add_session_note", arguments: { category: "progress", text: `Created ${objects.length} editable trunk and branch components for a leafless, canopy-ready dead tree.` } }), "session note");
  const after = resultOf(await client.callTool({ name: "bws_get_scene", arguments: { detail: "objects" } }), "scene after");
  console.log(JSON.stringify({ capabilitiesRevision: capabilities.revision, session: session.session, createdIds: created.createdIds, revision: after.revision, objectCount: after.objects?.length, objects: after.objects }, null, 2));
} finally { await client.close().catch(() => {}); }
