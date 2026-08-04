#!/usr/bin/env node

import assert from "node:assert/strict";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

const THIS_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(THIS_DIR, "..", "..");
const MCP_SERVER = resolve(THIS_DIR, "server.mjs");
const TOKEN = "boltworks-mcp-smoke-secret";
const REQUIRED_TOOLS = [
  "bws_get_capabilities",
  "bws_get_scene",
  "bws_get_selection",
  "bws_create_objects",
  "bws_update_objects",
  "bws_delete_objects",
  "bws_select_objects",
  "bws_undo",
  "bws_get_audit_log"
];

async function readRequestJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function writeJson(response, status, value) {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body)
  });
  response.end(body);
}

async function startMockRelay() {
  let nextId = 1;
  const results = new Map();
  const calls = [];
  const server = createServer(async (request, response) => {
    if (request.headers.authorization !== `Bearer ${TOKEN}`) {
      writeJson(response, 401, { error: "Unauthorized" });
      return;
    }

    if (request.method === "POST" && request.url === "/__mcp/command") {
      const command = await readRequestJson(request);
      const id = `smoke-${nextId++}`;
      calls.push(command);
      let result;
      if (command.method === "capabilities.get") {
        result = {
          apiVersion: 1,
          sceneRevision: 7,
          methods: ["scene.get", "objects.create", "objects.update", "objects.delete"]
        };
      } else if (command.method === "scene.get") {
        result = { revision: 7, detail: command.params.detail, objectCount: 1 };
      } else {
        result = { revision: 8, accepted: true, method: command.method, params: command.params };
      }
      results.set(id, { id, status: "completed", ok: true, result });
      writeJson(response, 202, { id, status: "queued" });
      return;
    }

    const match = request.method === "GET" && request.url?.match(/^\/__mcp\/result\/([^/?]+)$/);
    if (match) {
      const result = results.get(decodeURIComponent(match[1]));
      writeJson(response, result ? 200 : 404, result || { error: "Not found" });
      return;
    }

    writeJson(response, 404, { error: "Not found" });
  });

  await new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  return {
    url: `http://127.0.0.1:${address.port}`,
    calls,
    close: () => new Promise((resolveClose, rejectClose) => server.close((error) => error ? rejectClose(error) : resolveClose()))
  };
}

const relay = await startMockRelay();
let client;
let transport;
let stderrText = "";

try {
  client = new Client({ name: "boltworks-mcp-smoke-client", version: "1.0.0" });
  transport = new StdioClientTransport({
    command: process.execPath,
    args: [MCP_SERVER],
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      BWS_MCP_URL: relay.url,
      BWS_MCP_TOKEN: TOKEN
    },
    stderr: "pipe"
  });
  transport.stderr?.on("data", (chunk) => {
    stderrText += chunk.toString("utf8");
  });

  await client.connect(transport);

  const listedTools = await client.listTools();
  const toolNames = listedTools.tools.map((tool) => tool.name);
  for (const toolName of REQUIRED_TOOLS) {
    assert(toolNames.includes(toolName), `Missing MCP tool ${toolName}`);
  }

  const listedResources = await client.listResources();
  const manifestResource = listedResources.resources.find((resource) => resource.uri === "boltworks://handbook/manifest");
  assert(manifestResource, "Handbook manifest resource was not listed.");
  const manifestRead = await client.readResource({ uri: manifestResource.uri });
  assert.match(manifestRead.contents[0].text, /BoltWorksStudioAi Authoring Handbook/);

  const capabilities = await client.callTool({ name: "bws_get_capabilities", arguments: {} });
  assert.equal(capabilities.isError, undefined);
  assert.equal(capabilities.structuredContent.sceneRevision, 7);

  const scene = await client.callTool({ name: "bws_get_scene", arguments: { detail: "project" } });
  assert.equal(scene.structuredContent.detail, "project");

  await client.callTool({
    name: "bws_update_objects",
    arguments: { updates: [{ id: "smoke-object", changes: { name: "Renamed" } }], expectedRevision: 7 }
  });
  assert.deepEqual(relay.calls.at(-1).params, {
    objects: [{ id: "smoke-object", patch: { name: "Renamed" } }],
    expectedRevision: 7
  });

  const created = await client.callTool({
    name: "bws_create_objects",
    arguments: { objects: [{ id: "smoke-object", shape: "box" }], expectedRevision: 7 }
  });
  assert.equal(created.structuredContent.accepted, true);
  assert.equal(relay.calls.at(-1).method, "objects.create");
  assert.equal(relay.calls.at(-1).params.expectedRevision, 7);

  await client.callTool({
    name: "bws_select_objects",
    arguments: { ids: ["smoke-object"], expectedRevision: 8 }
  });
  assert.deepEqual(relay.calls.at(-1).params, { ids: ["smoke-object"], expectedRevision: 8 });

  await client.callTool({
    name: "bws_get_audit_log",
    arguments: { limit: 25, sinceSequence: 4 }
  });
  assert.deepEqual(relay.calls.at(-1).params, { limit: 25, sinceSequence: 4 });

  console.log(`BoltWorks MCP smoke check passed: ${REQUIRED_TOOLS.length} tools, ${listedResources.resources.length} resources, live relay bridge verified.`);
} catch (error) {
  if (stderrText) process.stderr.write(stderrText);
  throw error;
} finally {
  await client?.close().catch(() => {});
  await relay.close();
}
