# BoltWorks Studio local MCP setup

BoltWorks Studio's MCP server gives an AI client controlled access to the same live local editor that a person sees. It runs on your own computer, requires no BoltWorks login, and does not send the scene to a BoltWorks cloud service.

## What is exposed

The server provides read tools for capabilities, scene state, selection, and the audit log; write tools for creating, updating, selecting, and deleting exact object IDs; and one-step undo. It also exposes the authoring handbook, project schema, minimal project, medieval-house library, and mesh QA codes as MCP resources.

The editor remains the source of truth. Writes can include `expectedRevision`, which prevents an AI from silently overwriting a newer human or AI edit.

## Start BoltWorks first

1. Install dependencies once with `npm install`.
2. Start the normal local BoltWorks server and open the editor in the browser.
3. Keep that browser tab open. The local host writes a short-lived connection token to `.runtime/mcp-session.json`.
4. Start or reconnect the MCP client.

The MCP server reads the local session file automatically. You can override discovery with `BWS_MCP_URL` and `BWS_MCP_TOKEN`. `BWS_HOST_URL` remains accepted as a legacy URL alias.

## MCP client configuration

Use an absolute path. A Windows-style client configuration looks like this:

```json
{
  "mcpServers": {
    "boltworks-studio": {
      "command": "node",
      "args": [
        "D:\\Game\\BoltWorks3DAIStudio\\tools\\mcp\\server.mjs"
      ],
      "cwd": "D:\\Game\\BoltWorks3DAIStudio"
    }
  }
}
```

If automatic session discovery is not appropriate for your client, provide explicit local settings:

```json
{
  "env": {
    "BWS_MCP_URL": "http://127.0.0.1:4173",
    "BWS_MCP_TOKEN": "the-token-created-by-the-running-local-host"
  }
}
```

By default the bridge refuses non-loopback hosts. `BWS_ALLOW_REMOTE_HOST=1` exists for intentionally secured advanced setups; it should not be enabled for ordinary local use.

## Verify the installation

The smoke check launches a real stdio MCP client and server against a mock local relay. It checks all tools, lists and reads resources, and verifies one read and one write request:

```powershell
node tools/mcp/smoke-check.mjs
```

For interactive protocol inspection:

```powershell
npx @modelcontextprotocol/inspector node tools/mcp/server.mjs
```

## Recommended AI workflow

1. Call `bws_get_capabilities`.
2. Read the relevant handbook resources.
3. Call `bws_get_scene` with `detail: "summary"`, then request more detail only when needed.
4. Read `bws_get_selection` before changing selected work.
5. Write by exact object ID and include the last observed `expectedRevision`.
6. Inspect the scene again and use the existing BoltWorks cameras and QA sheet for visual verification.
7. Read `bws_get_audit_log` for a traceable history of MCP/AI operations. Use `bws_undo` if the most recent edit is wrong.

The MCP server writes protocol messages only to stdout. Diagnostics go to stderr so stdio framing stays valid.

## Current scope and roadmap

The implementation in v49.25.0 is **MCP v1**. It is the first working local bridge between an MCP-compatible AI client and the open BoltWorks editor, not the final AI modeling interface. Its present scope is deliberate: discover capabilities and documentation, inspect the scene and selection, perform exact-ID object edits, undo safely, and retain an auditable history.

The next major MCP milestone is Reference Match / Image-to-Mesh. Planned additions include calibrated multi-view references, measurable landmarks, editable silhouette guides, topology and surface-edit commands, visual-difference checks, repeatable QA cameras, and recoverable checkpoints. The intended result is an AI workflow that can construct and refine an editable `.modelerproj` mesh from reference images while a person can inspect, correct, replay, or undo every stage.
