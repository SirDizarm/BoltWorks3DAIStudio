#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";
import { runHostCommand } from "./host-client.mjs";
import { registerKnowledgeResources } from "./resources.mjs";

const MAX_OBJECTS_PER_CALL = 256;
const MAX_AUDIT_ITEMS = 200;

const jsonObject = z.record(z.string(), z.unknown());
const exactId = z.string().trim().min(1).max(128);
const expectedRevision = z.number().int().nonnegative().optional().describe(
  "Optional scene revision used for optimistic concurrency. The write is rejected if the scene changed after it was inspected."
);
const idList = z.array(exactId).min(1).max(MAX_OBJECTS_PER_CALL).refine(
  (ids) => new Set(ids).size === ids.length,
  "IDs must be unique."
);

function structuredResult(result) {
  if (result && typeof result === "object" && !Array.isArray(result)) return result;
  return { result };
}

function formatResult(result) {
  const structuredContent = structuredResult(result);
  return {
    content: [{ type: "text", text: JSON.stringify(structuredContent, null, 2) }],
    structuredContent
  };
}

function toolFailure(error) {
  const message = error instanceof Error ? error.message : String(error || "Unknown BoltWorks MCP error.");
  return {
    isError: true,
    content: [{ type: "text", text: message }]
  };
}

function registerRelayTool(server, name, config, method, buildParams = (args) => args) {
  server.registerTool(name, config, async (args) => {
    try {
      return formatResult(await runHostCommand(method, buildParams(args)));
    } catch (error) {
      return toolFailure(error);
    }
  });
}

async function createServer() {
  const server = new McpServer({
    name: "boltworks-studio-local",
    version: "1.0.0"
  });

  await registerKnowledgeResources(server);

  registerRelayTool(
    server,
    "bws_get_capabilities",
    {
      title: "Get BoltWorks capabilities",
      description: "Read the live editor's supported MCP command contract, limits, and current scene revision.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    "capabilities.get"
  );

  registerRelayTool(
    server,
    "bws_get_scene",
    {
      title: "Get BoltWorks scene",
      description: "Inspect the live editable scene. Use summary first, objects for object data, or project only when complete editable project detail is necessary.",
      inputSchema: z.object({
        detail: z.enum(["summary", "objects", "project"]).default("summary")
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    "scene.get"
  );

  registerRelayTool(
    server,
    "bws_get_selection",
    {
      title: "Get BoltWorks selection",
      description: "Read the exact object and surface selection in the live editor.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    "selection.get"
  );

  registerRelayTool(
    server,
    "bws_create_objects",
    {
      title: "Create BoltWorks objects",
      description: "Create one or more editable scene objects. Inspect capabilities and the scene first; include expectedRevision for safe collaborative writes.",
      inputSchema: z.object({
        objects: z.array(jsonObject).min(1).max(MAX_OBJECTS_PER_CALL),
        expectedRevision
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
    },
    "objects.create"
  );

  registerRelayTool(
    server,
    "bws_update_objects",
    {
      title: "Update BoltWorks objects",
      description: "Update existing objects by exact immutable IDs. Names are not accepted as identity. Include expectedRevision to avoid overwriting newer edits.",
      inputSchema: z.object({
        updates: z.array(z.object({
          id: exactId,
          changes: jsonObject
        })).min(1).max(MAX_OBJECTS_PER_CALL),
        expectedRevision
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    "objects.update",
    ({ updates, expectedRevision: revision }) => ({
      objects: updates.map(({ id, changes }) => ({ id, patch: changes })),
      ...(revision === undefined ? {} : { expectedRevision: revision })
    })
  );

  registerRelayTool(
    server,
    "bws_delete_objects",
    {
      title: "Delete BoltWorks objects",
      description: "Delete objects by exact immutable IDs. This is destructive; inspect selection and scene revision first.",
      inputSchema: z.object({ ids: idList, expectedRevision }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false }
    },
    "objects.delete"
  );

  registerRelayTool(
    server,
    "bws_select_objects",
    {
      title: "Select BoltWorks objects",
      description: "Replace the live editor object selection with exact IDs. Pass an empty list to clear object selection.",
      inputSchema: z.object({
        ids: z.array(exactId).max(MAX_OBJECTS_PER_CALL).refine(
          (ids) => new Set(ids).size === ids.length,
          "IDs must be unique."
        ),
        expectedRevision
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    "selection.set"
  );

  registerRelayTool(
    server,
    "bws_undo",
    {
      title: "Undo last BoltWorks edit",
      description: "Undo the most recent live editor history entry, optionally only if the inspected scene revision is still current.",
      inputSchema: z.object({ expectedRevision }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false }
    },
    "undo"
  );

  registerRelayTool(
    server,
    "bws_get_audit_log",
    {
      title: "Get BoltWorks audit log",
      description: "Read recent MCP/AI editor operations for verification, replay context, and collaborative handoff.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(MAX_AUDIT_ITEMS).default(100),
        sinceSequence: z.number().int().nonnegative().optional().describe(
          "Return only MCP audit entries with a sequence number greater than this value."
        )
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    "audit.get"
  );

  return server;
}

serveStdio(createServer, {
  onerror(error) {
    process.stderr.write(`[BoltWorks MCP] ${error instanceof Error ? error.message : String(error)}\n`);
  }
});
