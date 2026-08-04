#!/usr/bin/env node

import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

const THIS_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(THIS_DIR, "..", "..");
const MCP_SERVER = resolve(THIS_DIR, "server.mjs");
const TEMP_ID = `mcp-live-check-${process.pid}-${Date.now()}`;

function resultOf(response, label) {
  assert.equal(response?.isError, undefined, `${label} returned an MCP tool error.`);
  assert(response?.structuredContent && typeof response.structuredContent === "object", `${label} returned no structured result.`);
  return response.structuredContent;
}

const client = new Client({ name: "boltworks-mcp-live-check", version: "1.0.0" });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [MCP_SERVER],
  cwd: REPO_ROOT,
  env: { ...process.env },
  stderr: "pipe"
});

let stderrText = "";
let created = false;
transport.stderr?.on("data", (chunk) => {
  stderrText += chunk.toString("utf8");
});

try {
  await client.connect(transport);

  const capabilities = resultOf(
    await client.callTool({ name: "bws_get_capabilities", arguments: {} }),
    "bws_get_capabilities"
  );
  assert(capabilities.methods?.["objects.create"], "The live BWS bridge does not expose objects.create.");

  const before = resultOf(
    await client.callTool({ name: "bws_get_scene", arguments: { detail: "summary" } }),
    "bws_get_scene before create"
  );

  const createResult = resultOf(
    await client.callTool({
      name: "bws_create_objects",
      arguments: {
        expectedRevision: before.revision,
        objects: [{
          id: TEMP_ID,
          shape: "box",
          name: "MCP live verification (temporary)",
          position: [0, 0.1, 0],
          rotation: [0, 0, 0],
          scale: [0.1, 0.1, 0.1],
          color: "#29D3B2",
          roughness: 0.5
        }]
      }
    }),
    "bws_create_objects"
  );
  created = createResult.createdIds?.includes(TEMP_ID) === true;
  assert(created, "The live editor did not report the temporary object as created.");

  const withObject = resultOf(
    await client.callTool({ name: "bws_get_scene", arguments: { detail: "objects" } }),
    "bws_get_scene after create"
  );
  assert(withObject.objects?.some((object) => object.id === TEMP_ID), "The temporary object could not be read back from the live scene.");

  const undoResult = resultOf(
    await client.callTool({ name: "bws_undo", arguments: { expectedRevision: createResult.revision } }),
    "bws_undo"
  );
  created = false;

  const restored = resultOf(
    await client.callTool({ name: "bws_get_scene", arguments: { detail: "objects" } }),
    "bws_get_scene after undo"
  );
  assert(!restored.objects?.some((object) => object.id === TEMP_ID), "Undo left the temporary object in the live scene.");
  assert.equal(restored.objects?.length, before.objectCount, "Undo did not restore the original live object count.");

  const audit = resultOf(
    await client.callTool({ name: "bws_get_audit_log", arguments: { limit: 50 } }),
    "bws_get_audit_log"
  );
  assert(audit.entries?.some((entry) => entry.method === "objects.create" && entry.ok), "The live audit log did not record object creation.");
  assert(audit.entries?.some((entry) => entry.method === "undo" && entry.ok), "The live audit log did not record undo.");

  console.log(
    `BoltWorks MCP live check passed: revision ${before.revision} -> ${createResult.revision} -> ${undoResult.revision}; temporary object created, inspected, audited, and undone.`
  );
} catch (error) {
  if (stderrText) process.stderr.write(stderrText);
  throw error;
} finally {
  if (created) {
    try {
      const current = resultOf(
        await client.callTool({ name: "bws_get_scene", arguments: { detail: "summary" } }),
        "cleanup scene read"
      );
      await client.callTool({
        name: "bws_delete_objects",
        arguments: { ids: [TEMP_ID], expectedRevision: current.revision }
      });
    } catch {
      // The isolated live-check scene is discarded when its local host closes.
    }
  }
  await client.close().catch(() => {});
}
