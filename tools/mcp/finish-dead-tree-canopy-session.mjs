import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const client = new Client({ name: "boltworks-dead-tree-canopy-finisher", version: "1.0.0" });
const transport = new StdioClientTransport({ command: process.execPath, args: [resolve(here, "server.mjs")], cwd: root, env: { ...process.env }, stderr: "pipe" });
const result = (r, label) => { assert(!r.isError, `${label} failed`); return r.structuredContent; };
try {
  await client.connect(transport);
  const scene = result(await client.callTool({ name: "bws_get_scene", arguments: { detail: "objects" } }), "scene");
  assert.equal(scene.objects?.length, 30, "Expected 21 branches plus 9 canopy clusters.");
  assert.equal(scene.objects?.filter(o => o.groupId === "bare-dead-tree-template").length, 21, "Expected preserved base group.");
  assert.equal(scene.objects?.filter(o => o.groupId === "dead-tree-canopy").length, 9, "Expected a separate nine-cluster canopy group.");
  result(await client.callTool({ name: "bws_add_session_note", arguments: { category: "result", text: "Verified the intact 21-part branch base and separate nine-cluster canopy assembly. The BWS project and six-view QA sheet were saved from the live editor." } }), "result note");
  const stopped = result(await client.callTool({ name: "bws_stop_work_session", arguments: { reason: "Branch template rechecked and sparse canopy version completed, saved, and QA-captured." } }), "stop");
  const report = result(await client.callTool({ name: "bws_get_work_session", arguments: { sinceSequence: 0, includeReport: true } }), "report");
  console.log(JSON.stringify({revision: scene.revision, objectCount: scene.objects?.length, stopped, report: { timing: report.report?.timing, summary: report.report?.summary }}, null, 2));
} finally { await client.close().catch(() => {}); }
