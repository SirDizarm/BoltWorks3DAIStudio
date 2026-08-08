# AI work sessions

## Purpose and current status

An AI work session is one bounded, inspectable period of work on a BoltWorks
project. Its durable report records the goal, real elapsed time, visible actions,
results, artifacts, and factual workflow notes. The report is designed for
human review, AI handoff, future replay, and later workflow comparison.

The canonical report is a sidecar JSON file with the extension
`.bws-session.json`. Its schema is
`schemas/ai-work-session.schema.json`.

The schema defines the durable v1 contract. Runtime session controls, complete
delta replay, knowledge-set promotion, and MP4 rendering may be introduced in
stages. A client must not claim that an older audit entry or a report lacking
replay deltas can reconstruct the scene.

## Keep reports separate from projects

The editable `.modelerproj` remains the source of truth for geometry, materials,
textures, editor state, and references. Do not embed a complete work-session
event stream in every saved project. Save the full report beside the project:

```text
female-t-pose-player-model.modelerproj
female-t-pose-player-model.session.bws-session.json
female-t-pose-player-model-qa-sheet.png
```

The project may contain a small `ai.sessionSummaries` entry that names the
session, its goal and times, and the relative report path plus SHA-256 hash. A
missing or damaged sidecar must never prevent the project itself from loading.

## Minimal report

```json
{
  "kind": "boltworks-ai-work-session",
  "version": 1,
  "id": "session-2026-08-04-female-hands",
  "project": {
    "name": "female-t-pose-player-model",
    "kind": "modeler-project",
    "version": 1,
    "baseProjectSha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    "startRevision": 12,
    "endRevision": 18
  },
  "goal": "Refine the hands while preserving the T-pose proportions.",
  "actor": {
    "type": "ai",
    "client": "codex"
  },
  "timing": {
    "budgetMs": 900000,
    "startedAt": "2026-08-04T08:00:00.000Z",
    "deadlineAt": "2026-08-04T08:15:00.000Z",
    "endedAt": "2026-08-04T08:14:54.000Z",
    "elapsedMs": 894000,
    "endReason": "completed"
  },
  "references": [],
  "events": [],
  "metrics": {
    "eventCount": 0,
    "mutationCount": 0
  },
  "summary": {
    "outcome": "completed",
    "completed": ["Adjusted both hand silhouettes."],
    "issues": [],
    "nextSteps": ["Inspect finger spacing in the front QA view."],
    "workflowNotes": ["Compared the same named landmark from the front and side references."]
  },
  "artifacts": []
}
```

`workflowNotes` contains concise, factual and user-visible information: tools
used, measurements checked, observable tradeoffs, failed attempts, and useful
next steps. It must not request, expose, or store hidden reasoning, private
chain-of-thought, credentials, tokens, or unrelated personal data.

## Event contract

Every event has a monotonic `sequence`, timestamp, elapsed time, actor, visible
label, affected stable object IDs, and success state. The main event kinds are:

- `action`: a scene mutation or other explicit tool action;
- `checkpoint`: a named review point, normally linked to a QA artifact;
- `note`: a factual handoff or workflow observation;
- `undo`: a recorded reversal linked with `undoOfSequence`;
- `error`: a refused or failed operation with a public error code and message;
- `human`: a human edit or decision that belongs in the shared timeline.

Selection and camera navigation may be retained for viewer context, but they
should not be counted as geometry mutations unless they change saved project
state.

### Replay-ready deltas

A replayable event stores a normalized `forward` operation and, when safe
reverse scrubbing is supported, its smallest useful `inverse` operation:

```json
{
  "sequence": 3,
  "timestamp": "2026-08-04T08:03:12.000Z",
  "elapsedMs": 192000,
  "kind": "action",
  "actor": "mcp",
  "method": "objects.update",
  "label": "Narrowed the left hand",
  "ok": true,
  "replayable": true,
  "beforeRevision": 14,
  "afterRevision": 15,
  "targetIds": ["hand-left"],
  "forward": {
    "method": "objects.update",
    "params": {
      "objects": [
        { "id": "hand-left", "patch": { "scale": [0.8, 1, 0.8] } }
      ]
    }
  },
  "inverse": {
    "method": "objects.update",
    "params": {
      "objects": [
        { "id": "hand-left", "patch": { "scale": [1, 1, 1] } }
      ]
    }
  }
}
```

Do not store a complete scene or project snapshot for every event. Use these
operation-specific inverse deltas:

- create -> delete only the newly created stable IDs;
- update -> restore only the fields changed by that event;
- delete -> restore only the deleted object records and required membership;
- undo -> link to the original sequence and preserve the resulting revisions.

Replay must verify the base-project hash and expected revisions. A mismatched
base or unsupported operation is reported and left unapplied. Mark an event
`replayable: false` rather than pretending that it can be reproduced. The
current MCP audit log is useful evidence, but its intentionally summarized
parameters are not a substitute for these replay deltas.

## Real timer semantics

When a person gives the AI a time budget, BoltWorks owns the deadline. The AI's
self-reported sense of time is not authoritative.

1. Record `budgetMs`, `startedAt`, and server-authoritative `deadlineAt` and
   elapsed time.
2. Check the deadline immediately before every mutating operation.
3. At or after the deadline, reject new mutations with
   `WORK_SESSION_EXPIRED`, append exactly one checkpoint labeled
   `Time limit reached`, and set `timing.endReason` to `time-limit`.
4. Continue to allow safe reads, finalization, report export, and QA evidence.
5. Treat Stop as terminal. An extension or restart is explicit and auditable.

Wall-clock timestamps make reports understandable. Server-authoritative
deadline checks keep enforcement independent of a client's own countdown.

## Human attention contract

The live session response contains `attention: null` or a machine-readable
attention object with `required`, `priority`, `code`, `message`, `aiDirective`,
and `requestedAt`.

- Pause raises `HUMAN_INPUT_MAY_BE_AVAILABLE`. The AI must pause mutations and
  ask whether the human has new input before it resumes.
- Resume clears the attention signal.
- Stop raises urgent `HUMAN_ATTENTION_REQUIRED` with the visible message
  `I need your attention!`. The AI must stop work and ask what needs attention
  before taking any further action.

An MCP client must read or poll `bws_get_work_session` to receive these signals.
The contract does not claim that a disconnected AI can receive an unsolicited
chat message.

## Human AI Viewer

A viewer should consume events incrementally with a `sinceSequence` cursor and
show:

- elapsed time, remaining budget, and terminal reason;
- operation label, method, target IDs, revisions, and success/error state;
- checkpoints, linked previews, and QA sheets;
- which actions are replayable and which are context only.

Clicking an event should select or frame its stable target IDs when they still
exist. A checkpoint is a named event with hashes and artifact references, not a
hidden full-scene snapshot.

## MCP session lifecycle

The v1 work-session contract reserves these MCP tools:

- `bws_start_work_session`: start one bounded session with a goal and time
  budget;
- `bws_get_work_session`: read current timing, summary, and events after an
  optional sequence cursor;
- `bws_add_session_note`: add a factual user-visible note or checkpoint label;
- `bws_stop_work_session`: stop/finalize the session and return an exportable
  report.

Mutating scene tools remain the source of actual modeling events. Session tools
must not provide a second unvalidated mutation path. Existing exact-ID and
`expectedRevision` safeguards still apply.

## Export, knowledge, replay, and video

Export the report explicitly as `.bws-session.json`; optionally download it
together with the final project and QA artifacts. A future bundle may package
these files without changing their individual formats.

Adding a report to a shared knowledge set must be an explicit, sanitized action.
A compact repository layout is preferred:

```text
BoltWorksStudioAi/work-sessions/index.json
BoltWorksStudioAi/work-sessions/session-id.bws-session.json
```

Future replay can apply verified forward deltas to the hashed base project and
can reverse events that contain valid inverse deltas. MP4 export is a later
derived renderer: it may animate the visible event timeline or selected
checkpoints, but the video is not canonical project state and cannot replace the
JSON report. Reports created before complete delta capture may be visualized as
an audit timeline, but they cannot honestly reproduce every modeling step.

## Size and privacy limits

- Never include connection tokens, authorization headers, or credentials.
- Do not duplicate project `textureLibrary` data or base64 image data in events.
- Reference large images and QA artifacts by relative path/URI and SHA-256.
- Apply event-count and report-byte limits before durable export.
- Keep full deleted-object data only when required for one inverse delta; never
  use it as a disguised complete-scene snapshot.
