import { createServer } from "node:http";
import { createMcpRelay } from "./mcp-relay.mjs";

const TOKEN = "mcp-session-smoke-token";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

const relay = createMcpRelay({
  token: TOKEN,
  minWorkSessionDurationMs: 20,
  defaultCommandTimeoutMs: 2_000,
  maxCommandTimeoutMs: 2_000
});

const server = createServer((request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host}`);
  if (!relay.handleHttp({ pathname: url.pathname, request, response, url })) {
    response.writeHead(404).end();
  }
});

await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});

const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;

async function request(pathname, { method = "GET", body, browser = false } = {}) {
  const headers = browser
    ? { origin: baseUrl, "sec-fetch-site": "same-origin" }
    : { authorization: `Bearer ${TOKEN}` };
  if (body !== undefined) headers["content-type"] = "application/json";
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let value = null;
  if (text) {
    try {
      value = JSON.parse(text);
    } catch {
      throw new Error(`${method} ${pathname} returned invalid JSON: ${text}`);
    }
  }
  return { response, status: response.status, value };
}

async function submit(method, params = {}) {
  return request("/__mcp/command", { method: "POST", body: { method, params } });
}

async function result(id) {
  return request(`/__mcp/result/${id}`);
}

async function nextCommand() {
  return request("/__modeler/mcp/next?waitMs=0", { browser: true });
}

async function complete(id, revision, audit = null) {
  const targetIds = Array.isArray(audit?.targetIds) ? audit.targetIds : [];
  return request("/__modeler/mcp/result", {
    method: "POST",
    browser: true,
    body: {
      id,
      ok: true,
      result: {
        revision,
        ...(targetIds.length > 0 ? { updatedIds: targetIds } : {})
      },
      ...(audit ? { audit } : {})
    }
  });
}

async function fail(id, code, message) {
  return request("/__modeler/mcp/result", {
    method: "POST",
    browser: true,
    body: { id, ok: false, error: { code, message } }
  });
}

async function preflight(id) {
  return request("/__modeler/mcp/preflight", {
    method: "POST",
    browser: true,
    body: { id }
  });
}

async function sessionAction(action, fields = {}) {
  return request("/__modeler/mcp/session", {
    method: "POST",
    browser: true,
    body: { action, ...fields }
  });
}

function validateReport(report) {
  const topLevel = [
    "actor", "artifacts", "events", "goal", "id", "kind", "metrics",
    "project", "references", "summary", "timing", "version"
  ];
  assert(JSON.stringify(Object.keys(report).sort()) === JSON.stringify(topLevel), "Report top-level shape changed.");
  assert(report.kind === "boltworks-ai-work-session" && report.version === 1, "Report identity is invalid.");
  assert(typeof report.id === "string" && report.id.length > 0, "Report id is missing.");
  assert(typeof report.goal === "string" && report.goal.length > 0, "Report goal is missing.");
  assert(report.project.kind === "modeler-project" && report.project.version === 1, "Project reference is invalid.");
  assert(report.project.name.length <= 300, "Project name was not bounded to the schema limit.");
  assert(Number.isInteger(report.project.startRevision) && Number.isInteger(report.project.endRevision), "Project revisions are invalid.");
  assert(["ai", "human", "mixed"].includes(report.actor.type), "Report actor is invalid.");
  assert(Number.isInteger(report.timing.budgetMs) && report.timing.budgetMs > 0, "Report budget is invalid.");
  assert(["active", "completed", "time-limit", "user-stop", "error"].includes(report.timing.endReason), "Report end reason is invalid.");
  assert(Array.isArray(report.events) && report.metrics.eventCount === report.events.length, "Report event metrics are invalid.");
  for (const event of report.events) {
    assert(Number.isInteger(event.sequence) && event.sequence > 0, "Report event sequence is invalid.");
    assert(typeof event.timestamp === "string" && Number.isFinite(Date.parse(event.timestamp)), "Report event timestamp is invalid.");
    assert(["action", "checkpoint", "note", "undo", "error", "human"].includes(event.kind), "Report event kind is invalid.");
    assert(["mcp", "human", "editor", "system"].includes(event.actor), "Report event actor is invalid.");
    assert(typeof event.ok === "boolean" && event.replayable === false && Array.isArray(event.targetIds), "Report event contract is invalid.");
    if (event.kind === "error") assert(event.error?.code && event.error?.message, "Error event lacks its error envelope.");
  }
  assert(Array.isArray(report.references) && Array.isArray(report.artifacts), "Report collections are invalid.");
  assert(["active", "completed", "partial", "failed"].includes(report.summary.outcome), "Report summary outcome is invalid.");
  for (const key of ["completed", "issues", "nextSteps", "workflowNotes"]) {
    assert(Array.isArray(report.summary[key]), `Report summary ${key} is invalid.`);
  }
}

try {
  const heartbeat = await request("/__modeler/mcp/heartbeat", {
    method: "POST",
    browser: true,
    body: {
      capabilities: {
        projectName: `Session smoke ${"x".repeat(400)}`,
        sceneRevision: 7
      }
    }
  });
  assert(heartbeat.status === 200, "Browser heartbeat failed.");

  const legacy = await submit("object.move", { id: "legacy", x: 1 });
  assert(legacy.status === 202 && legacy.value.status === "queued", "Legacy mutation should work before the first session.");
  const legacyDispatch = await nextCommand();
  assert(legacyDispatch.status === 200 && legacyDispatch.value.id === legacy.value.id, "Legacy mutation was not dispatched.");
  assert((await complete(legacy.value.id, 8)).status === 200, "Legacy mutation could not complete.");

  const started = await submit("work_session.start", { goal: "Exercise the bounded session lifecycle.", durationMs: 2_000 });
  assert(started.status === 202 && started.value.ok === true, "MCP work-session start failed.");
  const firstSession = started.value.result.session;
  assert(firstSession.status === "running" && firstSession.generation === 1, "Started session is not running.");

  const mutation = await submit("object.move", { id: "session-object", y: 2 });
  assert(mutation.status === 202 && mutation.value.workSession?.id === firstSession.id, "Mutation lacks exact work-session context.");
  const dispatchedMutation = await nextCommand();
  assert(dispatchedMutation.value.workSession?.generation === firstSession.generation, "Dispatched mutation lost its generation.");
  assert((await complete(mutation.value.id, 9)).status === 200, "Session mutation could not complete.");

  const queued = await submit("object.scale", { id: "queued", scale: 2 });
  assert(queued.status === 202, "Queued mutation was not accepted.");
  const paused = await sessionAction("pause", { reason: "Smoke-test pause" });
  assert(paused.status === 200 && paused.value.session.status === "paused", "Pause failed.");
  assert(paused.value.session.attention?.required === true, "Pause did not request human input attention.");
  assert(paused.value.session.attention?.code === "HUMAN_INPUT_MAY_BE_AVAILABLE", "Pause returned the wrong attention code.");
  assert(/ask the human/i.test(paused.value.session.attention?.aiDirective || ""), "Pause did not give the AI a human-input directive.");
  const cancelled = await result(queued.value.id);
  assert(cancelled.status === 200 && cancelled.value.error?.code === "WORK_SESSION_PAUSED", "Pause did not cancel queued mutation.");
  const blocked = await submit("object.delete", { id: "blocked" });
  assert(blocked.status === 409 && blocked.value.error?.code === "WORK_SESSION_PAUSED", "Paused mutation was not rejected.");

  const read = await submit("scene.get");
  assert(read.status === 202, "Read-only command should remain available while paused.");
  const dispatchedRead = await nextCommand();
  assert(dispatchedRead.status === 200 && dispatchedRead.value.id === read.value.id, "Paused read command was not dispatched.");
  assert((await complete(read.value.id, 9)).status === 200, "Paused read command could not complete.");

  const resumed = await sessionAction("resume", { reason: "Smoke-test resume" });
  assert(resumed.status === 200 && resumed.value.session.status === "running", "Resume failed.");
  assert(resumed.value.session.attention === null, "Resume did not clear the human-attention signal.");
  assert(resumed.value.session.generation > firstSession.generation, "Resume did not advance the session generation.");
  const noted = await submit("work_session.note", { category: "verification", text: "Only factual, user-visible workflow notes are retained." });
  assert(noted.status === 202 && noted.value.ok === true, "MCP session note failed.");
  const stopped = await submit("work_session.stop", { reason: "completed" });
  assert(stopped.status === 202 && stopped.value.result.session.status === "stopped", "MCP session stop failed.");
  assert(stopped.value.result.session.attention?.priority === "urgent", "Stop did not raise urgent human attention.");
  assert(stopped.value.result.session.attention?.code === "HUMAN_ATTENTION_REQUIRED", "Stop returned the wrong attention code.");
  assert(stopped.value.result.session.attention?.message === "I need your attention!", "Stop returned the wrong attention message.");
  assert(stopped.value.result.events.some((event) => event.label === "I need your attention!"), "Stop attention was not recorded in the visible event history.");

  const reportDownload = await request("/__modeler/mcp/session?download=1", { browser: true });
  assert(reportDownload.status === 200, "Session report download failed.");
  assert(/attachment/i.test(reportDownload.response.headers.get("content-disposition") || ""), "Report is not marked as a download.");
  validateReport(reportDownload.value);
  assert(reportDownload.value.project.startRevision === 7 && reportDownload.value.project.endRevision >= 9, "Report revisions are incorrect.");
  assert(reportDownload.value.summary.workflowNotes.some((note) => note.includes("factual")), "Factual session note was not reported.");

  const short = await submit("work_session.start", { goal: "Verify automatic expiry.", durationMs: 80 });
  assert(short.status === 202 && short.value.result.session.status === "running", "Short session did not start.");
  const expiresQueued = await submit("object.rotate", { id: "expires" });
  assert(expiresQueued.status === 202, "Expiry mutation was not queued.");
  await sleep(160);
  const expiredResult = await result(expiresQueued.value.id);
  assert(expiredResult.status === 200 && expiredResult.value.error?.code === "WORK_SESSION_EXPIRED", "Expiry did not cancel queued mutation.");
  const expiredSession = await request("/__modeler/mcp/session?includeReport=1", { browser: true });
  assert(expiredSession.status === 200 && expiredSession.value.session.status === "expired", "Session did not expire automatically.");
  assert(expiredSession.value.report.timing.endReason === "time-limit", "Expiry report has the wrong end reason.");
  const blockedAfterExpiry = await submit("object.move", { id: "after-expiry" });
  assert(blockedAfterExpiry.status === 409 && blockedAfterExpiry.value.error?.code === "WORK_SESSION_EXPIRED", "Post-expiry mutation was not rejected.");
  const readableAfterExpiry = await submit("scene.get");
  assert(readableAfterExpiry.status === 202, "Read-only command should remain available after expiry.");
  const dispatchedAfterExpiryRead = await nextCommand();
  assert(dispatchedAfterExpiryRead.status === 200 && dispatchedAfterExpiryRead.value.id === readableAfterExpiry.value.id, "Post-expiry read command was not dispatched.");
  assert((await complete(readableAfterExpiry.value.id, 9)).status === 200, "Post-expiry read command could not complete.");

  const regressionFailures = [];
  const expectRegression = (condition, message) => {
    if (!condition) regressionFailures.push(message);
  };

  const preflightSessionStart = await submit("work_session.start", {
    goal: "Verify live mutation preflight after pause and stop.",
    durationMs: 2_000
  });
  assert(preflightSessionStart.status === 202 && preflightSessionStart.value.result.session.status === "running", "Preflight regression session did not start.");

  const dispatchedBeforePause = await submit("object.move", { id: "preflight-pause-target", x: 1 });
  assert(dispatchedBeforePause.status === 202, "Preflight pause mutation was not queued.");
  const pauseDispatch = await nextCommand();
  assert(pauseDispatch.status === 200 && pauseDispatch.value.id === dispatchedBeforePause.value.id, "Preflight pause mutation was not dispatched.");
  const allowedBeforePause = await preflight(dispatchedBeforePause.value.id);
  expectRegression(
    allowedBeforePause.status === 200 && allowedBeforePause.value?.ok === true,
    `Live preflight must allow a current dispatched mutation before pause (received HTTP ${allowedBeforePause.status}).`
  );

  const pauseDuringDispatch = await sessionAction("pause", { reason: "Preflight regression pause" });
  assert(pauseDuringDispatch.status === 200 && pauseDuringDispatch.value.session.status === "paused", "Preflight regression pause failed.");
  const deniedAfterPause = await preflight(dispatchedBeforePause.value.id);
  expectRegression(
    deniedAfterPause.status === 409 && deniedAfterPause.value?.error?.code === "WORK_SESSION_PAUSED",
    `Live preflight must deny an already-dispatched mutation after pause with WORK_SESSION_PAUSED (received HTTP ${deniedAfterPause.status}, code ${deniedAfterPause.value?.error?.code || "none"}).`
  );
  assert((await fail(dispatchedBeforePause.value.id, "WORK_SESSION_PAUSED", "Mutation denied by live preflight after pause.")).status === 200, "Paused dispatched mutation could not return its preflight denial.");

  const resumedForStop = await sessionAction("resume", { reason: "Preflight regression resume" });
  assert(resumedForStop.status === 200 && resumedForStop.value.session.status === "running", "Preflight regression resume failed.");
  const dispatchedBeforeStop = await submit("object.rotate", { id: "preflight-stop-target", y: 15 });
  assert(dispatchedBeforeStop.status === 202, "Preflight stop mutation was not queued.");
  const stopDispatch = await nextCommand();
  assert(stopDispatch.status === 200 && stopDispatch.value.id === dispatchedBeforeStop.value.id, "Preflight stop mutation was not dispatched.");
  const allowedBeforeStop = await preflight(dispatchedBeforeStop.value.id);
  expectRegression(
    allowedBeforeStop.status === 200 && allowedBeforeStop.value?.ok === true,
    `Live preflight must allow a current dispatched mutation before stop (received HTTP ${allowedBeforeStop.status}).`
  );

  const stoppedDuringDispatch = await sessionAction("stop", { reason: "Preflight regression stop" });
  assert(stoppedDuringDispatch.status === 200 && stoppedDuringDispatch.value.session.status === "stopped", "Preflight regression stop failed.");
  const deniedAfterStop = await preflight(dispatchedBeforeStop.value.id);
  expectRegression(
    deniedAfterStop.status === 409 && deniedAfterStop.value?.error?.code === "WORK_SESSION_STOPPED",
    `Live preflight must deny an already-dispatched mutation after stop with WORK_SESSION_STOPPED (received HTTP ${deniedAfterStop.status}, code ${deniedAfterStop.value?.error?.code || "none"}).`
  );
  assert((await fail(dispatchedBeforeStop.value.id, "WORK_SESSION_STOPPED", "Mutation denied by live preflight after stop.")).status === 200, "Stopped dispatched mutation could not return its preflight denial.");

  const auditHeartbeat = await request("/__modeler/mcp/heartbeat", {
    method: "POST",
    browser: true,
    body: {
      capabilities: {
        projectName: "Audit metadata regression project",
        sceneRevision: 21
      }
    }
  });
  assert(auditHeartbeat.status === 200, "Audit metadata regression heartbeat failed.");
  const auditSessionStart = await submit("work_session.start", {
    goal: "Verify browser audit metadata reaches the session report.",
    durationMs: 2_000
  });
  assert(auditSessionStart.status === 202 && auditSessionStart.value.result.session.status === "running", "Audit metadata regression session did not start.");
  const auditedMutation = await submit("object.move", { id: "audit-target-a", z: 3 });
  assert(auditedMutation.status === 202, "Audited mutation was not queued.");
  const auditDispatch = await nextCommand();
  assert(auditDispatch.status === 200 && auditDispatch.value.id === auditedMutation.value.id, "Audited mutation was not dispatched.");
  const expectedAudit = {
    targetIds: ["audit-target-a", "audit-target-b"],
    beforeRevision: 21,
    afterRevision: 22
  };
  assert((await complete(auditedMutation.value.id, expectedAudit.afterRevision, expectedAudit)).status === 200, "Audited mutation could not complete.");
  const stoppedAuditSession = await sessionAction("stop", { reason: "Audit metadata regression complete" });
  assert(stoppedAuditSession.status === 200 && stoppedAuditSession.value.session.status === "stopped", "Audit metadata regression session did not stop.");
  const auditReportDownload = await request("/__modeler/mcp/session?download=1", { browser: true });
  assert(auditReportDownload.status === 200, "Audit metadata regression report download failed.");
  validateReport(auditReportDownload.value);
  const auditedEvent = auditReportDownload.value.events.find((event) => (
    event.method === "object.move"
    && event.ok === true
    && event.label === "Completed object.move"
  ));
  expectRegression(Boolean(auditedEvent), "Completed browser mutation is missing from the work-session report.");
  if (auditedEvent) {
    expectRegression(
      JSON.stringify(auditedEvent.targetIds) === JSON.stringify(expectedAudit.targetIds),
      `Report targetIds must preserve the browser result exactly (received ${JSON.stringify(auditedEvent.targetIds)}).`
    );
    expectRegression(
      auditedEvent.beforeRevision === expectedAudit.beforeRevision,
      `Report beforeRevision must come from the browser result (received ${String(auditedEvent.beforeRevision)}).`
    );
    expectRegression(
      auditedEvent.afterRevision === expectedAudit.afterRevision,
      `Report afterRevision must come from the browser result (received ${String(auditedEvent.afterRevision)}).`
    );
  }

  assert(
    regressionFailures.length === 0,
    `Focused MCP session regressions failed:\n- ${regressionFailures.join("\n- ")}`
  );

  console.log("MCP timed work-session smoke check passed.");
} finally {
  relay.close();
  await new Promise((resolve) => server.close(resolve));
}
