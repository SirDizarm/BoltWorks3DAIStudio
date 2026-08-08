# BoltWorks Studio local MCP setup

BoltWorks Studio's MCP server gives an AI client controlled access to the same live local editor that a person sees. It runs on your own computer, requires no BoltWorks login, and does not send the scene to a BoltWorks cloud service.

## What is exposed

The server provides read tools for capabilities, scene state, selection, the audit log, and the current timed work session; write tools for creating, updating, selecting, and deleting exact object IDs; one-step undo; and a bounded work-session lifecycle. It also exposes the authoring handbook, project schema, work-session guide and schema, minimal project, medieval-house library, and mesh QA codes as MCP resources.

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
3. When the person requested a time limit, call `bws_start_work_session` with the visible goal and duration before the first mutation.
4. Call `bws_get_scene` with `detail: "summary"`, then request more detail only when needed.
5. Read `bws_get_selection` before changing selected work.
6. Write by exact object ID and include the last observed `expectedRevision`.
7. Inspect the scene again and use the existing BoltWorks cameras and QA sheet for visual verification.
8. Add only concise, factual progress or checkpoint notes with `bws_add_session_note`; do not store hidden reasoning.
9. Read `bws_get_audit_log` for a traceable history of MCP/AI operations. Use `bws_undo` if the most recent edit is wrong.
10. Call `bws_stop_work_session` when the bounded task ends and retain the returned report with the project and QA evidence.

The MCP server writes protocol messages only to stdout. Diagnostics go to stderr so stdio framing stays valid.

## Timed AI work sessions

The v1 lifecycle is intentionally small:

- `bws_start_work_session` starts one session with a user-visible goal and a real duration in milliseconds;
- `bws_get_work_session` returns server-owned timing and new events, optionally after a previously observed sequence number;
- `bws_add_session_note` appends a factual, user-visible note to the shared timeline;
- `bws_stop_work_session` ends the session and returns its report.

The local relay owns the deadline. It checks the deadline immediately before every scene mutation instead of trusting an AI to estimate elapsed time. At or after the deadline, new mutations are refused with `SESSION_TIME_LIMIT`, while safe reads, inspection, finalization, and report retrieval remain available. A person can watch the same state in the Human AI Viewer, including elapsed and remaining time, actions, notes, target IDs, and terminal reason.

Pause and Stop also expose a machine-readable `session.attention` object. Pause uses `HUMAN_INPUT_MAY_BE_AVAILABLE` and instructs the connected AI to ask whether the person has new input before resuming. Stop uses urgent `HUMAN_ATTENTION_REQUIRED`, displays `I need your attention!`, and blocks further scene mutations. An MCP client must still poll `bws_get_work_session` between actions; this local relay cannot inject an unsolicited message into a disconnected AI conversation or replace that client's own emergency Stop control.

The compact MCP audit log remains useful evidence, but it is not a complete replay format. A durable session report uses the sidecar contract in `AI_WORK_SESSIONS.md` and `schemas/ai-work-session.schema.json`. Workflow notes must describe observable actions, checks, outcomes, and next steps only; they must never request or expose private chain-of-thought, credentials, tokens, or hidden model state.

## Current scope and roadmap

The implementation is **MCP v1**. It is the first working local bridge between an MCP-compatible AI client and the open BoltWorks editor, not the final AI modeling interface. Its present scope is deliberate: discover capabilities and documentation, inspect the scene and selection, perform exact-ID object edits, undo safely, run a server-timed session visible to a person, and retain an auditable history.

The next major MCP milestone is Reference Match / Image-to-Mesh. Planned additions include calibrated multi-view references, measurable landmarks, editable silhouette guides, topology and surface-edit commands, visual-difference checks, repeatable QA cameras, and recoverable checkpoints. The intended result is an AI workflow that can construct and refine an editable `.modelerproj` mesh from reference images while a person can inspect, correct, replay, or undo every stage.

Full forward/backward replay is a later milestone and requires verified operation deltas that are not present in every current audit entry. MP4 export is likewise a future derived view of that event timeline; it cannot replace the editable project or the JSON session report.
