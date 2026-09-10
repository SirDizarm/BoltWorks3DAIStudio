import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const asResult = (r) => { assert(!r.isError, "MCP action failed"); return r.structuredContent; };
const client = new Client({ name: "boltworks-dead-tree-finisher", version: "1.0.0" });
const transport = new StdioClientTransport({ command: process.execPath, args: [resolve(here, "server.mjs")], cwd: root, env: { ...process.env }, stderr: "pipe" });
try {
  await client.connect(transport);
  const scene = asResult(await client.callTool({ name: "bws_get_scene", arguments: { detail: "objects" } }));
  assert.equal(scene.objects?.length, 21, "Expected the 21-part bare tree.");
  asResult(await client.callTool({ name: "bws_add_session_note", arguments: { category: "result", text: "Completed visual and ground-plane QA for the bare canopy template. The saved asset contains 21 independently editable trunk, limb, fork, and twig pieces; no foliage was added." } }));
  const stopped = asResult(await client.callTool({ name: "bws_stop_work_session", arguments: { reason: "Bare dead-tree canopy template completed, visually reviewed, and saved as an editable BWS project." } }));
  const report = asResult(await client.callTool({ name: "bws_get_work_session", arguments: { sinceSequence: 0, includeReport: true } }));
  console.log(JSON.stringify({ sceneRevision: scene.revision, objectCount: scene.objects?.length, stopped, report }, null, 2));
} finally { await client.close().catch(() => {}); }
