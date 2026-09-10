import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const GROUP_ID = "dead-tree-canopy";
const GROUP_NAME = "Dead Tree — Sparse Leaf Canopy";
const foliage = (id, name, position, scale, color, rotation) => ({ id, name, shape: "facetedBallLow", position, scale, color, rotation, roughness: 0.9, groupId: GROUP_ID, groupName: GROUP_NAME });
const leaves = [
  foliage("canopy-left-low", "Canopy — left lower cluster", [-1.54, 4.37, 0.02], [0.82, 0.70, 0.62], "#526F32", [8, 12, -5]),
  foliage("canopy-left-outer", "Canopy — left outer cluster", [-2.00, 4.70, 0.08], [0.64, 0.60, 0.55], "#6E8B42", [-5, 20, 9]),
  foliage("canopy-left-middle", "Canopy — left middle cluster", [-1.25, 5.55, 0.02], [0.78, 0.67, 0.58], "#48652F", [7, -12, -8]),
  foliage("canopy-left-tip", "Canopy — left crown tip", [-1.00, 6.55, 0.03], [0.49, 0.49, 0.44], "#76934B", [0, 18, 5]),
  foliage("canopy-right-low", "Canopy — right lower cluster", [1.38, 4.92, -0.04], [0.78, 0.68, 0.60], "#547436", [-6, 10, 7]),
  foliage("canopy-right-outer", "Canopy — right outer cluster", [2.08, 5.53, 0.03], [0.62, 0.58, 0.52], "#6F8C43", [8, -16, -4]),
  foliage("canopy-upper-left", "Canopy — upper left crown", [-0.59, 7.03, 0.04], [0.61, 0.56, 0.50], "#3F5D2A", [-4, 17, 6]),
  foliage("canopy-upper-right", "Canopy — upper right crown", [0.80, 7.53, 0], [0.58, 0.54, 0.48], "#5B7B39", [6, -13, -7]),
  foliage("canopy-top", "Canopy — top crown", [0.32, 8.32, 0.01], [0.52, 0.70, 0.46], "#7E9A50", [4, 9, 2])
];
const client = new Client({ name: "boltworks-dead-tree-canopy", version: "1.0.0" });
const transport = new StdioClientTransport({ command: process.execPath, args: [resolve(here, "server.mjs")], cwd: root, env: { ...process.env }, stderr: "pipe" });
const result = (r, label) => { assert(!r.isError, `${label} failed`); return r.structuredContent; };
try {
  await client.connect(transport);
  const capabilities = result(await client.callTool({ name: "bws_get_capabilities", arguments: {} }), "capabilities");
  const before = result(await client.callTool({ name: "bws_get_scene", arguments: { detail: "objects" } }), "scene");
  const selection = result(await client.callTool({ name: "bws_get_selection", arguments: {} }), "selection");
  assert.equal(before.objects?.length, 21, "Expected the repaired 21-part branch template.");
  assert.equal(before.objects?.filter(o => o.groupId === "bare-dead-tree-template").length, 21, "Expected all base parts in the template group.");
  const session = result(await client.callTool({ name: "bws_start_work_session", arguments: { goal: "Inspect and preserve the editable bare dead-tree template, repair any visible flying or disconnected parts, then create a separate sparse low-poly canopy version without altering the reusable branch base.", durationSeconds: 1200, unlimited: false } }), "session");
  result(await client.callTool({ name: "bws_add_session_note", arguments: { category: "progress", text: `Loaded the 21-part base template at revision ${before.revision}. Joint review found no disconnected components; each limb endpoint overlaps a trunk or parent limb. Selection was ${selection.selectedIds?.length || 0} parts.` } }), "inspection note");
  const created = result(await client.callTool({ name: "bws_create_objects", arguments: { objects: leaves, expectedRevision: before.revision } }), "canopy create");
  result(await client.callTool({ name: "bws_add_session_note", arguments: { category: "progress", text: "Added nine small, varied low-poly foliage clusters in a separate canopy group, leaving the branch group fully editable and exposed through the silhouette." } }), "canopy note");
  const after = result(await client.callTool({ name: "bws_get_scene", arguments: { detail: "summary" } }), "after");
  console.log(JSON.stringify({ capabilitiesRevision: capabilities.revision, session: session.session, beforeRevision: before.revision, afterRevision: after.revision, beforeCount: before.objects?.length, afterCount: after.objectCount, created: created.createdIds }, null, 2));
} finally { await client.close().catch(() => {}); }
