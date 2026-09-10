#!/usr/bin/env node

import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const client = new Client({ name: "boltworks-project-reader", version: "1.0.0" });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [resolve(here, "server.mjs")],
  cwd: root,
  env: { ...process.env },
  stderr: "pipe"
});

try {
  await client.connect(transport);
  const response = await client.callTool({ name: "bws_get_scene", arguments: { detail: "objects" } });
  assert.equal(response?.isError, undefined, "Project read returned an MCP error.");
  console.log(JSON.stringify(response.structuredContent, null, 2));
} finally {
  await client.close().catch(() => {});
}
