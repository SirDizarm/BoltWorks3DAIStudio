#!/usr/bin/env node

import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

const THIS_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(THIS_DIR, "..", "..");
const MCP_SERVER = resolve(THIS_DIR, "server.mjs");

function resultOf(response, label) {
  assert.equal(response?.isError, undefined, `${label} returned an MCP tool error.`);
  assert(response?.structuredContent && typeof response.structuredContent === "object", `${label} returned no structured result.`);
  return response.structuredContent;
}

const client = new Client({ name: "boltworks-oak-session-finisher", version: "1.0.0" });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [MCP_SERVER],
  cwd: REPO_ROOT,
  env: { ...process.env },
  stderr: "pipe"
});

try {
  await client.connect(transport);
  const scene = resultOf(await client.callTool({ name: "bws_get_scene", arguments: { detail: "objects" } }), "scene");
  const note = resultOf(await client.callTool({
    name: "bws_add_session_note",
    arguments: {
      category: "result",
      text: "Reviewed the oak in front and isometric framing. The silhouette reads cleanly, the trunk reaches the ground, branches remain visible between foliage clusters, and all 18 parts share the oak asset group. Saved the editable project, exported a standard GLB, exported an OBJ+MTL ZIP, and saved the six-panel QA sheet."
    }
  }), "result note");
  const stopped = resultOf(await client.callTool({
    name: "bws_stop_work_session",
    arguments: { reason: "Type A low-poly deciduous oak completed, reviewed, saved, and exported." }
  }), "stop session");
  const report = resultOf(await client.callTool({
    name: "bws_get_work_session",
    arguments: { sinceSequence: 0, includeReport: true }
  }), "session report");
  console.log(JSON.stringify({
    sceneRevision: scene.revision,
    objectCount: scene.objects?.length,
    groupedCount: scene.objects?.filter((object) => object.groupId === "oak-type-a").length,
    note,
    stopped,
    report
  }, null, 2));
} finally {
  await client.close().catch(() => {});
}
