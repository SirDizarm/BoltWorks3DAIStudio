#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";
import { runHostCommand } from "./host-client.mjs";
import { registerKnowledgeResources } from "./resources.mjs";

const MAX_OBJECTS_PER_CALL = 256;
const MAX_AUDIT_ITEMS = 200;

const REFERENCE_IMAGE_MIME_TYPES = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".bmp": "image/bmp"
};

function referenceImageFileToDataUrl(imagePath) {
  const resolved = path.resolve(imagePath);
  const extension = path.extname(resolved).toLowerCase();
  const mimeType = REFERENCE_IMAGE_MIME_TYPES[extension];
  if (!mimeType) {
    throw new Error(`Unsupported reference image type '${extension}'. Supported: ${Object.keys(REFERENCE_IMAGE_MIME_TYPES).join(", ")}.`);
  }
  const bytes = fs.readFileSync(resolved);
  return `data:${mimeType};base64,${bytes.toString("base64")}`;
}

const jsonObject = z.record(z.string(), z.unknown());
const exactId = z.string().trim().min(1).max(128);
const vector3 = z.tuple([z.number(), z.number(), z.number()]).describe(
  "Exactly three finite numbers: [x, y, z]. Rotation values are degrees."
);
const nonZeroScale3 = vector3.refine(
  (value) => value.every((component) => Math.abs(component) >= 0.000001),
  "Scale components cannot be zero."
);
const hexColor = z.string().regex(/^#[0-9a-f]{6}$/i).describe("Color in #RRGGBB format, for example #40C7A5.");
const createObjectSpec = z.object({
  id: exactId.optional().describe("Optional immutable object ID. Omit it to let BoltWorks generate one."),
  shape: z.enum([
    "box", "sphere", "cylinder", "cone", "torus", "panel", "wedge", "hollowBox", "tube",
    "curvedPanel", "ring", "arch", "hemisphere", "dome", "capsule", "pyramid", "prism",
    "tetrahedron", "pyramidFrustum", "facetedBallLow", "facetedBallMedium", "facetedBallHigh",
    "heart", "stair"
  ]).default("box").describe("Primitive shape. Shape dimensions always come from scale; do not use height, radius, radiusTop, or radiusBottom."),
  name: z.string().trim().min(1).max(256).optional(),
  position: vector3.optional().describe("World position [x, y, z]. Defaults to [0, 0.5, 0]."),
  rotation: vector3.optional().describe("Euler rotation [x, y, z] in degrees."),
  scale: nonZeroScale3.optional().describe("Object dimensions as [x, y, z]. For a cylinder, y is its height and x/z are its diameter scales."),
  color: hexColor.optional().describe("Base object color. The field name is color, not baseColor."),
  roughness: z.number().min(0).max(1).optional(),
  opacity: z.number().min(0.05).max(1).optional(),
  materialRule: z.string().trim().min(1).max(64).optional(),
  hidden: z.boolean().optional(),
  groupId: z.string().trim().max(256).nullable().optional(),
  groupName: z.string().trim().max(256).nullable().optional(),
  linkId: z.string().trim().max(256).nullable().optional(),
  linkColor: z.string().trim().max(256).nullable().optional(),
  bevel: z.number().min(0).max(100_000).optional(),
  depth: z.number().min(0).max(100_000).optional(),
  direction: z.string().trim().max(256).nullable().optional(),
  pivot: vector3.nullable().optional(),
  playerAvatar: z.boolean().optional(),
  playerHeadOffset: vector3.nullable().optional(),
  geometry: jsonObject.optional()
}).strict().describe(
  "One editable BoltWorks object. Example: {\"shape\":\"cylinder\",\"name\":\"Body\",\"position\":[0,1,0],\"rotation\":[0,0,0],\"scale\":[1,2,1],\"color\":\"#40C7A5\"}."
);
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
    "bws_start_work_session",
    {
  title: "Start BoltWorks work session",
  description: "Start an authoritative AI work session. By default it is timed; set unlimited to start a session with no time limit. Once started, editor mutations require the active session and stop automatically when it is paused or stopped.",
  inputSchema: z.object({
    goal: z.string().trim().min(1).max(2_000).describe("Concrete outcome to pursue during this timed session."),
    durationSeconds: z.number().int().min(1).max(86_400).default(900),
    unlimited: z.boolean().default(false).describe("Start without an automatic time limit.")
  }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
    },
    "work_session.start",
  ({ goal, durationSeconds, unlimited }) => ({
    goal,
    ...(unlimited ? { unlimited: true } : { durationMs: durationSeconds * 1_000 })
  })
);

  registerRelayTool(
    server,
    "bws_get_work_session",
    {
      title: "Get timed BoltWorks work session",
      description: "Read the authoritative timer, factual event history, counters, human-attention signal, and optionally the downloadable work-session report. If session.attention.required is true, follow its aiDirective before doing more work. This remains available after the timer expires.",
      inputSchema: z.object({
        sinceSequence: z.number().int().nonnegative().default(0),
        includeReport: z.boolean().default(false)
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    "work_session.get"
  );

  registerRelayTool(
    server,
    "bws_add_session_note",
    {
      title: "Add factual BoltWorks session note",
      description: "Add a factual progress, decision, or result note to the active session history. Record observable work only; do not include hidden chain-of-thought or private reasoning.",
      inputSchema: z.object({
        text: z.string().trim().min(1).max(4_000),
        category: z.string().trim().min(1).max(64).default("progress")
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
    },
    "work_session.note"
  );

  registerRelayTool(
    server,
    "bws_stop_work_session",
    {
      title: "Stop timed BoltWorks work session",
      description: "Stop the current timed AI work session, cancel pending editor mutations, and raise the urgent human-attention signal 'I need your attention!'. Reads and the final factual report remain available.",
      inputSchema: z.object({
        reason: z.string().trim().max(500).optional()
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    "work_session.stop"
  );

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
      description: "Create one or more editable scene objects. Pass one object with an objects array; each item uses shape, position [x,y,z], rotation in degrees, scale [x,y,z], and color #RRGGBB. Primitive dimensions are controlled only by scale: never send height/radius/radiusTop/baseColor. Inspect capabilities and the scene first; include expectedRevision for safe collaborative writes.",
      inputSchema: z.object({
        objects: z.array(createObjectSpec).min(1).max(MAX_OBJECTS_PER_CALL).describe("Editable objects to create. This field must be an array inside the tool argument object, not a top-level array."),
        expectedRevision
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
    },
    "objects.create"
  );

  registerRelayTool(
    server,
    "bws_create_mesh_from_reference_image",
    {
      title: "Create BoltWorks mesh from a reference image",
      description: "Generate a real editable mesh from a reference image via visual-hull silhouette carving (the same pipeline behind the editor's Image to Mesh panel). Use sourceMode 'sheet' (default) for front/side/back or front/left/right/back views laid out left-to-right; four-view sheets retain independent left/right profiles for asymmetric clothing and accessories. Use 'single' for one-view depth relief. Provide imagePath (preferred, a local file path read and base64-encoded here) or imageBase64. Inspect capabilities and the scene first; include expectedRevision for safe collaborative writes.",
      inputSchema: z.object({
        imagePath: z.string().trim().min(1).optional().describe("Absolute local path to the reference image (png/jpg/jpeg/webp/gif/bmp)."),
        imageBase64: z.string().trim().min(1).optional().describe("Base64 image data URL (data:image/<type>;base64,...); only used if imagePath is omitted."),
        params: jsonObject.optional().describe(
          "referenceMatch.createMesh params: sourceMode ('single'|'sheet'), buildMode ('hybridV47' continuous mesh reshaped by V30 silhouette | 'recoveredV30' original | 'solidVisualHull' four-view face/fingers | 'standard'), cols, rows, heightScale, depth, back, threshold, darkForeground, " +
          "plus placement/material fields also used by bws_create_objects (id, name, position, rotation, scale, color, roughness, opacity, materialRule, hidden, groupId, groupName, linkId, linkColor, pivot)."
        ),
        expectedRevision
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
    },
    "referenceMatch.createMesh",
    ({ imagePath, imageBase64, params = {}, expectedRevision: revision }) => {
      if (!imagePath && !imageBase64) throw new Error("Provide either imagePath or imageBase64.");
      return {
        ...params,
        imageDataUrl: imagePath ? referenceImageFileToDataUrl(imagePath) : imageBase64,
        ...(revision === undefined ? {} : { expectedRevision: revision })
      };
    }
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
