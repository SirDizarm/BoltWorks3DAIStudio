import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const client = new Client({ name: "boltworks-dead-tree-qa", version: "1.0.0" });
const transport = new StdioClientTransport({ command: process.execPath, args: [resolve(here, "server.mjs")], cwd: root, env: { ...process.env }, stderr: "pipe" });
try {
  await client.connect(transport);
  const scene = await client.callTool({ name: "bws_get_scene", arguments: { detail: "summary" } });
  const revision = scene.structuredContent.revision;
  const updated = await client.callTool({ name: "bws_update_objects", arguments: { updates: [{ id: "dead-tree-trunk-base", changes: { position: [-0.05, 1.16, 0] } }], expectedRevision: revision } });
  const note = await client.callTool({ name: "bws_add_session_note", arguments: { category: "progress", text: "Raised the flared base slightly after ground-plane QA so the editable model clears Y=0." } });
  console.log(JSON.stringify({ revision: updated.structuredContent.revision, note: note.structuredContent }, null, 2));
} finally { await client.close().catch(() => {}); }
