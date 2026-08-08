import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

const JSON_TYPE = "application/json; charset=utf-8";
const NO_STORE = { "cache-control": "no-store" };
const WORK_SESSION_METHODS = new Set([
  "work_session.start",
  "work_session.get",
  "work_session.note",
  "work_session.stop"
]);
const READ_ONLY_COMMAND_METHODS = new Set([
  "capabilities.get",
  "scene.get",
  "selection.get",
  "audit.get",
  "work_session.get"
]);
const DEFAULT_WORK_SESSION_DURATION_MS = 15 * 60_000;
const MAX_WORK_SESSION_DURATION_MS = 24 * 60 * 60_000;
const MAX_WORK_SESSION_GOAL_LENGTH = 2_000;
const MAX_WORK_SESSION_NOTE_LENGTH = 4_000;

function sendJson(response, statusCode, value, extraHeaders = {}) {
  if (response.writableEnded || response.destroyed) return;
  response.writeHead(statusCode, {
    "content-type": JSON_TYPE,
    ...NO_STORE,
    ...extraHeaders
  });
  response.end(JSON.stringify(value));
}

function sendEmpty(response, statusCode, extraHeaders = {}) {
  if (response.writableEnded || response.destroyed) return;
  response.writeHead(statusCode, { ...NO_STORE, ...extraHeaders });
  response.end();
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizedHost(request) {
  return String(request?.headers?.host || "").trim().toLowerCase();
}

function isLoopbackHost(request) {
  const host = normalizedHost(request);
  if (!host) return false;
  const hostname = host.startsWith("[") ? host.slice(1, host.indexOf("]")) : host.split(":", 1)[0];
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
}

function isSameOriginBrowserRequest(request) {
  if (!isLoopbackHost(request)) return false;
  const fetchSite = String(request.headers["sec-fetch-site"] || "").toLowerCase();
  if (fetchSite && fetchSite !== "same-origin") {
    return false;
  }
  const origin = String(request.headers.origin || "").trim();
  if (!origin) return fetchSite === "same-origin";
  try {
    const originUrl = new URL(origin);
    return originUrl.protocol === "http:" && originUrl.host.toLowerCase() === normalizedHost(request);
  } catch {
    return false;
  }
}

function tokensMatch(actual, expected) {
  const left = Buffer.from(String(actual || ""));
  const right = Buffer.from(String(expected || ""));
  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
}

function suppliedToken(request) {
  const authorization = String(request?.headers?.authorization || "");
  if (/^Bearer\s+/i.test(authorization)) return authorization.replace(/^Bearer\s+/i, "").trim();
  return String(request?.headers?.["x-bws-mcp-token"] || "").trim();
}

function parsePositiveInteger(value, fallback, maximum) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return fallback;
  return Math.min(Math.floor(number), maximum);
}

function isMutatingCommandMethod(method) {
  const normalized = String(method || "").trim();
  return normalized.length > 0 && !READ_ONLY_COMMAND_METHODS.has(normalized) && !WORK_SESSION_METHODS.has(normalized);
}

function cleanText(value, maximumLength, fieldName, { required = false } = {}) {
  const normalized = String(value ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();
  if (required && !normalized) {
    const error = new Error(`${fieldName} is required.`);
    error.code = "INVALID_WORK_SESSION_INPUT";
    error.statusCode = 400;
    throw error;
  }
  if (normalized.length > maximumLength) {
    const error = new Error(`${fieldName} must be at most ${maximumLength} characters.`);
    error.code = "INVALID_WORK_SESSION_INPUT";
    error.statusCode = 400;
    throw error;
  }
  return normalized;
}

function workSessionError(code, message, statusCode = 409) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function publicError(error, fallbackCode = "WORK_SESSION_ERROR") {
  return {
    code: typeof error?.code === "string" ? error.code : fallbackCode,
    message: error instanceof Error ? error.message : String(error || "Unknown work-session error.")
  };
}

function invalidBrowserAudit(message) {
  const error = new Error(message);
  error.code = "INVALID_BROWSER_AUDIT";
  error.statusCode = 400;
  return error;
}

function normalizeBrowserAudit(value) {
  if (value === undefined || value === null) return null;
  if (!isRecord(value)) throw invalidBrowserAudit("Result audit must be a JSON object when supplied.");
  if (!Array.isArray(value.targetIds) || value.targetIds.length > 256) {
    throw invalidBrowserAudit("Result audit targetIds must be an array containing at most 256 object IDs.");
  }
  const targetIds = value.targetIds.map((id, index) => {
    if (typeof id !== "string") throw invalidBrowserAudit(`Result audit targetIds[${index}] must be a string.`);
    const normalized = id.trim();
    if (!normalized || normalized.length > 128 || /[\u0000-\u001f\u007f]/.test(normalized)) {
      throw invalidBrowserAudit(`Result audit targetIds[${index}] must be a non-empty object ID of at most 128 characters without control characters.`);
    }
    return normalized;
  });
  const beforeRevision = Number(value.beforeRevision);
  const afterRevision = Number(value.afterRevision);
  if (!Number.isSafeInteger(beforeRevision) || beforeRevision < 0) {
    throw invalidBrowserAudit("Result audit beforeRevision must be a non-negative safe integer.");
  }
  if (!Number.isSafeInteger(afterRevision) || afterRevision < 0 || afterRevision < beforeRevision) {
    throw invalidBrowserAudit("Result audit afterRevision must be a non-negative safe integer at or after beforeRevision.");
  }
  return { targetIds, beforeRevision, afterRevision };
}

async function readJsonBody(request, maximumBytes) {
  const contentType = String(request.headers["content-type"] || "").toLowerCase();
  if (!contentType.startsWith("application/json")) {
    const error = new Error("Content-Type must be application/json.");
    error.statusCode = 415;
    throw error;
  }
  const declaredLength = Number(request.headers["content-length"] || 0);
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    const error = new Error(`JSON body exceeds the ${maximumBytes} byte limit.`);
    error.statusCode = 413;
    throw error;
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maximumBytes) {
      const error = new Error(`JSON body exceeds the ${maximumBytes} byte limit.`);
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (size === 0) {
    const error = new Error("A JSON body is required.");
    error.statusCode = 400;
    throw error;
  }
  try {
    return JSON.parse(Buffer.concat(chunks, size).toString("utf8"));
  } catch {
    const error = new Error("The request body is not valid JSON.");
    error.statusCode = 400;
    throw error;
  }
}

function publicCommand(command) {
  return {
    id: command.id,
    method: command.method,
    params: command.params,
    createdAt: command.createdAt,
    deadlineAt: command.deadlineAt,
    ...(command.workSession ? { workSession: { ...command.workSession } } : {})
  };
}

function publicResult(command) {
  const base = {
    id: command.id,
    status: command.status,
    method: command.method,
    createdAt: command.createdAt,
    dispatchedAt: command.dispatchedAt || null,
    completedAt: command.completedAt || null,
    deadlineAt: command.deadlineAt,
    ...(command.workSession ? { workSession: { ...command.workSession } } : {})
  };
  if (command.status === "completed") return { ...base, ok: command.ok, result: command.result ?? null, error: command.error ?? null };
  if (command.status === "timed-out") {
    return { ...base, ok: false, error: command.error };
  }
  return base;
}

export function createMcpRelay(options = {}) {
  const token = String(options.token || "").trim() || randomBytes(32).toString("base64url");
  const clock = typeof options.now === "function" ? options.now : Date.now;
  const scheduleTimeout = typeof options.setTimeout === "function" ? options.setTimeout : setTimeout;
  const cancelTimeout = typeof options.clearTimeout === "function" ? options.clearTimeout : clearTimeout;
  const maxActiveCommands = parsePositiveInteger(options.maxActiveCommands, 64, 1024) || 64;
  const maxStoredResults = parsePositiveInteger(options.maxStoredResults, 128, 4096) || 128;
  const maxWaiters = parsePositiveInteger(options.maxWaiters, 8, 64) || 8;
  const maxBodyBytes = parsePositiveInteger(options.maxBodyBytes, 4 * 1024 * 1024, 16 * 1024 * 1024) || 4 * 1024 * 1024;
  const defaultCommandTimeoutMs = parsePositiveInteger(options.defaultCommandTimeoutMs, 60_000, 10 * 60_000) || 60_000;
  const maxCommandTimeoutMs = parsePositiveInteger(options.maxCommandTimeoutMs, 5 * 60_000, 30 * 60_000) || 5 * 60_000;
  const resultTtlMs = parsePositiveInteger(options.resultTtlMs, 5 * 60_000, 60 * 60_000) || 5 * 60_000;
  const maxLongPollMs = parsePositiveInteger(options.maxLongPollMs, 25_000, 30_000) || 25_000;
  const minWorkSessionDurationMs = parsePositiveInteger(options.minWorkSessionDurationMs, 1_000, MAX_WORK_SESSION_DURATION_MS) || 1_000;
  const maxWorkSessionEvents = parsePositiveInteger(options.maxWorkSessionEvents, 2_000, 20_000) || 2_000;

  const commands = new Map();
  const queuedIds = [];
  const waiters = new Set();
  let browserHeartbeatAt = 0;
  let browserCapabilities = null;
  let workSession = null;
  let workSessionGateEnabled = false;
  let workSessionExpiryTimer = null;
  let closed = false;

  function now() {
    const value = Number(clock());
    return Number.isFinite(value) ? Math.floor(value) : Date.now();
  }

  function isoTimestamp(value) {
    return Number.isFinite(value) && value > 0 ? new Date(value).toISOString() : null;
  }

  function sessionElapsedMs(session, at = now()) {
    if (!session) return 0;
    const endAt = session.status === "paused"
      ? session.pausedAt
      : ((session.status === "stopped" || session.status === "expired") ? session.endedAt : at);
    return Math.max(0, (endAt || at) - session.startedAt - session.totalPausedMs);
  }

  function sessionRemainingMs(session, at = now()) {
    if (!session || session.status === "stopped" || session.status === "expired") return 0;
    const referenceAt = session.status === "paused" ? session.pausedAt : at;
    return Math.max(0, session.deadlineAt - referenceAt);
  }

  function appendSessionEvent(type, actor, fields = {}, at = now()) {
    if (!workSession) return null;
    const event = {
      sequence: workSession.nextSequence,
      timestamp: new Date(at).toISOString(),
      elapsedMs: sessionElapsedMs(workSession, at),
      type,
      actor,
      label: typeof fields.label === "string" && fields.label ? fields.label : type,
      ok: fields.ok !== false,
      ...(fields.commandId ? { commandId: fields.commandId } : {}),
      ...(fields.method ? { method: fields.method } : {}),
      ...(fields.outcome ? { outcome: fields.outcome } : {}),
      ...(fields.code ? { code: fields.code } : {}),
      ...(isRecord(fields.details) ? { details: fields.details } : {})
    };
    workSession.nextSequence += 1;
    workSession.events.push(event);
    if (workSession.events.length > maxWorkSessionEvents) {
      workSession.events.splice(0, workSession.events.length - maxWorkSessionEvents);
    }
    return event;
  }

  function publicWorkSession(session = workSession, at = now()) {
    if (!session) return null;
    return {
      id: session.id,
      goal: session.goal,
      status: session.status,
      durationMs: session.durationMs,
      startedAt: session.startedAt,
      deadlineAt: session.deadlineAt,
      pausedAt: session.pausedAt || null,
      endedAt: session.endedAt || null,
      totalPausedMs: session.totalPausedMs,
      generation: session.generation,
      remainingMs: sessionRemainingMs(session, at),
      elapsedMs: sessionElapsedMs(session, at),
      endReason: session.endReason,
      attention: session.attention ? { ...session.attention } : null,
      counters: { ...session.counters }
    };
  }

  function currentSceneRevision() {
    const revision = Number(browserCapabilities?.sceneRevision ?? browserCapabilities?.revision);
    return Number.isInteger(revision) && revision >= 0 ? revision : 0;
  }

  function currentProjectName() {
    const name = String(
      browserCapabilities?.projectName ?? browserCapabilities?.sceneName ?? browserCapabilities?.name ?? ""
    )
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .trim()
      .slice(0, 300);
    return name || "Current BoltWorks project";
  }

  function reportEvent(event) {
    const failed = event.ok === false;
    const isNote = event.type === "note";
    const details = isRecord(event.details) ? event.details : null;
    const targetIds = Array.isArray(details?.targetIds)
      ? details.targetIds.filter((id) => typeof id === "string").slice(0, 256)
      : [];
    const beforeRevision = Number(details?.beforeRevision);
    const afterRevision = Number(details?.afterRevision);
    const actor = event.actor === "mcp"
      ? "mcp"
      : (event.actor === "human" ? "human" : (event.actor === "browser" ? "editor" : "system"));
    const kind = isNote
      ? "note"
      : (failed ? "error" : (event.type.startsWith("command.") ? "action" : (actor === "human" ? "human" : "checkpoint")));
    return {
      sequence: event.sequence,
      timestamp: event.timestamp,
      elapsedMs: event.elapsedMs,
      kind,
      actor,
      ...(event.method ? { method: event.method } : {}),
      label: event.label,
      ...(isNote ? { note: event.details?.text || event.label } : {}),
      ok: event.ok,
      replayable: false,
      targetIds,
      ...(Number.isSafeInteger(beforeRevision) && beforeRevision >= 0 ? { beforeRevision } : {}),
      ...(Number.isSafeInteger(afterRevision) && afterRevision >= 0 ? { afterRevision } : {}),
      ...(failed ? {
        error: {
          code: event.code || "WORK_SESSION_EVENT_FAILED",
          message: event.label
        }
      } : {})
    };
  }

  function buildWorkSessionReport(session = workSession, at = now()) {
    if (!session) return null;
    const snapshot = publicWorkSession(session, at);
    const notes = session.events
      .filter((event) => event.type === "note")
      .map((event) => ({
        sequence: event.sequence,
        timestamp: event.timestamp,
        category: event.details?.category || "progress",
        text: event.details?.text || ""
      }));
    const schemaEvents = session.events.map(reportEvent);
    const successfulActions = schemaEvents
      .filter((event) => event.kind === "action" && event.ok && event.label.startsWith("Completed "))
      .map((event) => event.label);
    const issues = schemaEvents
      .filter((event) => event.kind === "error")
      .map((event) => event.label);
    const humanPresent = session.events.some((event) => event.actor === "human");
    const mcpPresent = session.events.some((event) => event.actor === "mcp") || session.counters.accepted > 0;
    const outcome = session.status === "running" || session.status === "paused"
      ? "active"
      : (session.status === "stopped" && session.endReason === "completed" ? "completed" : "partial");
    const timingEndReason = session.status === "running" || session.status === "paused"
      ? "active"
      : (session.status === "expired"
          ? "time-limit"
          : (session.endReason === "completed" ? "completed" : "user-stop"));
    const endRevision = Math.max(session.endRevision, currentSceneRevision());
    return {
      kind: "boltworks-ai-work-session",
      version: 1,
      id: session.id,
      project: {
        name: session.projectName,
        kind: "modeler-project",
        version: 1,
        startRevision: session.startRevision,
        endRevision
      },
      goal: session.goal,
      actor: {
        type: humanPresent && mcpPresent ? "mixed" : (humanPresent ? "human" : "ai"),
        client: "BoltWorks MCP work session"
      },
      timing: {
        budgetMs: session.durationMs,
        startedAt: isoTimestamp(session.startedAt),
        deadlineAt: isoTimestamp(session.deadlineAt),
        endedAt: isoTimestamp(session.endedAt),
        elapsedMs: snapshot.elapsedMs,
        endReason: timingEndReason
      },
      references: [],
      events: schemaEvents,
      metrics: {
        eventCount: schemaEvents.length,
        mutationCount: session.counters.completed + session.counters.failed
      },
      summary: {
        outcome,
        completed: successfulActions,
        issues,
        nextSteps: [],
        workflowNotes: notes.map((note) => `[${note.category}] ${note.text}`)
      },
      artifacts: []
    };
  }

  function clearWorkSessionExpiryTimer() {
    if (workSessionExpiryTimer !== null) {
      cancelTimeout(workSessionExpiryTimer);
      workSessionExpiryTimer = null;
    }
  }

  function commandBelongsToCurrentSession(command) {
    return Boolean(workSession && command?.workSession?.id === workSession.id);
  }

  function recordCommandEvent(command, counter, type, fields = {}, at = now()) {
    if (!commandBelongsToCurrentSession(command)) return;
    if (counter && Object.hasOwn(workSession.counters, counter)) workSession.counters[counter] += 1;
    appendSessionEvent(type, fields.actor || "relay", {
      label: fields.label || type,
      ok: fields.ok,
      commandId: command.id,
      method: command.method,
      outcome: fields.outcome,
      code: fields.code,
      details: fields.details
    }, at);
  }

  function removeInactiveQueuedIds() {
    for (let index = queuedIds.length - 1; index >= 0; index -= 1) {
      if (commands.get(queuedIds[index])?.status !== "queued") queuedIds.splice(index, 1);
    }
  }

  function cancelQueuedMutations(code, message, at = now()) {
    for (const command of commands.values()) {
      if (command.status !== "queued" || !isMutatingCommandMethod(command.method)) continue;
      command.status = "completed";
      command.completedAt = at;
      command.ok = false;
      command.result = null;
      command.error = { code, message };
      recordCommandEvent(command, "cancelled", "command.cancelled", {
        actor: "relay",
        label: `Cancelled ${command.method}`,
        ok: false,
        outcome: "cancelled",
        code
      }, at);
    }
    removeInactiveQueuedIds();
  }

  function expireWorkSession(at = now()) {
    if (!workSession || workSession.status !== "running" || at < workSession.deadlineAt) return false;
    clearWorkSessionExpiryTimer();
    const expiryAt = workSession.deadlineAt;
    workSession.status = "expired";
    workSession.attention = null;
    workSession.endedAt = expiryAt;
    workSession.endReason = "time-limit";
    workSession.generation += 1;
    appendSessionEvent("session.expired", "relay", {
      label: "Time limit reached",
      outcome: "expired",
      code: "WORK_SESSION_EXPIRED",
      details: { deadlineAt: expiryAt }
    }, expiryAt);
    cancelQueuedMutations(
      "WORK_SESSION_EXPIRED",
      "The timed work session expired before this command was dispatched.",
      expiryAt
    );
    return true;
  }

  function refreshWorkSession(at = now()) {
    expireWorkSession(at);
    return workSession;
  }

  function scheduleWorkSessionExpiry() {
    clearWorkSessionExpiryTimer();
    if (!workSession || workSession.status !== "running" || closed) return;
    const delayMs = Math.max(0, workSession.deadlineAt - now());
    workSessionExpiryTimer = scheduleTimeout(() => {
      workSessionExpiryTimer = null;
      refreshWorkSession(now());
    }, delayMs + 1);
    workSessionExpiryTimer?.unref?.();
  }

  function sessionResponse({ sinceSequence = 0, includeReport = false } = {}) {
    const at = now();
    refreshWorkSession(at);
    const normalizedSequence = parsePositiveInteger(sinceSequence, 0, Number.MAX_SAFE_INTEGER);
    return {
      ok: true,
      serverTime: at,
      session: publicWorkSession(workSession, at),
      events: workSession
        ? workSession.events.filter((event) => event.sequence > normalizedSequence).map((event) => ({
            ...event,
            ...(event.details ? { details: { ...event.details } } : {})
          }))
        : [],
      latestSequence: workSession ? workSession.nextSequence - 1 : 0,
      reportAvailable: Boolean(workSession),
      ...(includeReport ? { report: buildWorkSessionReport(workSession, at) } : {})
    };
  }

  function requireWorkSession() {
    refreshWorkSession(now());
    if (!workSession) throw workSessionError("WORK_SESSION_REQUIRED", "No timed work session exists.");
    return workSession;
  }

  function startWorkSession(params, actor) {
    refreshWorkSession(now());
    if (workSession && (workSession.status === "running" || workSession.status === "paused")) {
      throw workSessionError("WORK_SESSION_ACTIVE", "Stop the current timed work session before starting another one.");
    }
    const goal = cleanText(params?.goal, MAX_WORK_SESSION_GOAL_LENGTH, "goal", { required: true });
    const rawDuration = params?.durationMs === undefined ? DEFAULT_WORK_SESSION_DURATION_MS : Number(params.durationMs);
    if (!Number.isInteger(rawDuration) || rawDuration < minWorkSessionDurationMs || rawDuration > MAX_WORK_SESSION_DURATION_MS) {
      throw workSessionError(
        "INVALID_WORK_SESSION_INPUT",
        `durationMs must be an integer between ${minWorkSessionDurationMs} and ${MAX_WORK_SESSION_DURATION_MS}.`,
        400
      );
    }
    const startedAt = now();
    workSessionGateEnabled = true;
    workSession = {
      id: randomUUID(),
      goal,
      status: "running",
      durationMs: rawDuration,
      startedAt,
      deadlineAt: startedAt + rawDuration,
      pausedAt: 0,
      endedAt: 0,
      totalPausedMs: 0,
      generation: 1,
      endReason: null,
      attention: null,
      projectName: currentProjectName(),
      startRevision: currentSceneRevision(),
      endRevision: currentSceneRevision(),
      nextSequence: 1,
      events: [],
      counters: {
        accepted: 0,
        dispatched: 0,
        completed: 0,
        failed: 0,
        rejected: 0,
        cancelled: 0,
        timedOut: 0,
        notes: 0
      }
    };
    appendSessionEvent("session.started", actor, {
      label: "Timed work session started",
      details: { goal, durationMs: rawDuration, deadlineAt: workSession.deadlineAt }
    }, startedAt);
    scheduleWorkSessionExpiry();
    return sessionResponse();
  }

  function pauseWorkSession(params, actor) {
    const session = requireWorkSession();
    if (session.status !== "running") {
      throw workSessionError("WORK_SESSION_NOT_RUNNING", `Cannot pause a work session while it is ${session.status}.`);
    }
    const at = now();
    session.status = "paused";
    session.pausedAt = at;
    session.generation += 1;
    session.attention = {
      required: true,
      priority: "normal",
      code: "HUMAN_INPUT_MAY_BE_AVAILABLE",
      message: "The human may have new input.",
      aiDirective: "Pause work and ask the human whether there is new input before resuming.",
      requestedAt: at
    };
    clearWorkSessionExpiryTimer();
    const reason = cleanText(params?.reason, 500, "reason") || "paused by the human operator";
    appendSessionEvent("session.paused", actor, {
      label: "The human may have new input.",
      outcome: "paused",
      details: { reason, remainingMs: sessionRemainingMs(session, at), attention: { ...session.attention } }
    }, at);
    cancelQueuedMutations("WORK_SESSION_PAUSED", "The timed work session was paused before this command was dispatched.", at);
    return sessionResponse();
  }

  function resumeWorkSession(params, actor) {
    const session = requireWorkSession();
    if (session.status !== "paused") {
      throw workSessionError("WORK_SESSION_NOT_PAUSED", `Cannot resume a work session while it is ${session.status}.`);
    }
    const at = now();
    const pausedDurationMs = Math.max(0, at - session.pausedAt);
    session.totalPausedMs += pausedDurationMs;
    session.deadlineAt += pausedDurationMs;
    session.pausedAt = 0;
    session.status = "running";
    session.generation += 1;
    session.attention = null;
    const reason = cleanText(params?.reason, 500, "reason") || "resumed by the human operator";
    appendSessionEvent("session.resumed", actor, {
      label: "Timed work session resumed",
      details: { reason, pausedDurationMs, deadlineAt: session.deadlineAt }
    }, at);
    scheduleWorkSessionExpiry();
    return sessionResponse();
  }

  function extendWorkSession(params, actor) {
    const session = requireWorkSession();
    if (session.status !== "running" && session.status !== "paused") {
      throw workSessionError("WORK_SESSION_NOT_ACTIVE", `Cannot extend a work session while it is ${session.status}.`);
    }
    const extendMs = Number(params?.extendMs);
    if (!Number.isInteger(extendMs) || extendMs < minWorkSessionDurationMs || session.durationMs + extendMs > MAX_WORK_SESSION_DURATION_MS) {
      throw workSessionError(
        "INVALID_WORK_SESSION_INPUT",
        `extendMs must be an integer of at least ${minWorkSessionDurationMs}, and total duration cannot exceed ${MAX_WORK_SESSION_DURATION_MS}.`,
        400
      );
    }
    const at = now();
    session.durationMs += extendMs;
    session.deadlineAt += extendMs;
    appendSessionEvent("session.extended", actor, {
      label: "Timed work session extended",
      details: { extendMs, durationMs: session.durationMs, deadlineAt: session.deadlineAt }
    }, at);
    scheduleWorkSessionExpiry();
    return sessionResponse();
  }

  function stopWorkSession(params, actor) {
    const session = requireWorkSession();
    if (session.status === "stopped" || session.status === "expired") return sessionResponse();
    const at = now();
    if (session.status === "paused") {
      session.totalPausedMs += Math.max(0, at - session.pausedAt);
      session.pausedAt = 0;
    }
    session.status = "stopped";
    session.endedAt = at;
    session.endReason = cleanText(params?.reason, 500, "reason") || "completed";
    session.generation += 1;
    session.attention = {
      required: true,
      priority: "urgent",
      code: "HUMAN_ATTENTION_REQUIRED",
      message: "I need your attention!",
      aiDirective: "Stop work and ask the human what needs attention before taking any further action.",
      requestedAt: at
    };
    clearWorkSessionExpiryTimer();
    appendSessionEvent("session.stopped", actor, {
      label: "I need your attention!",
      outcome: "stopped",
      details: { reason: session.endReason, attention: { ...session.attention } }
    }, at);
    cancelQueuedMutations("WORK_SESSION_STOPPED", "The timed work session stopped before this command was dispatched.", at);
    return sessionResponse();
  }

  function clearWorkSession() {
    refreshWorkSession(now());
    if (workSession && (workSession.status === "running" || workSession.status === "paused")) {
      throw workSessionError("WORK_SESSION_ACTIVE", "Stop the timed work session before clearing its history.");
    }
    clearWorkSessionExpiryTimer();
    workSession = null;
    return sessionResponse();
  }

  function addWorkSessionNote(params, actor) {
    const session = requireWorkSession();
    const text = cleanText(params?.text, MAX_WORK_SESSION_NOTE_LENGTH, "text", { required: true });
    const category = cleanText(params?.category, 64, "category") || "progress";
    session.counters.notes += 1;
    appendSessionEvent("note", actor, {
      label: `Session note: ${category}`,
      details: { category, text }
    }, now());
    return sessionResponse();
  }

  function performSessionAction(action, params, actor) {
    if (action === "start") return startWorkSession(params, actor);
    if (action === "get") return sessionResponse({
      sinceSequence: params?.sinceSequence,
      includeReport: params?.includeReport === true
    });
    if (action === "note") return addWorkSessionNote(params, actor);
    if (action === "stop") return stopWorkSession(params, actor);
    if (action === "pause") return pauseWorkSession(params, actor);
    if (action === "resume") return resumeWorkSession(params, actor);
    if (action === "extend") return extendWorkSession(params, actor);
    if (action === "clear") return clearWorkSession();
    throw workSessionError("INVALID_WORK_SESSION_ACTION", `Unknown work-session action: ${String(action || "(missing)")}.`, 400);
  }

  function activeCount() {
    let count = 0;
    for (const command of commands.values()) {
      if (command.status === "queued" || command.status === "dispatched") count += 1;
    }
    return count;
  }

  function prune(at = now()) {
    refreshWorkSession(at);
    for (const command of commands.values()) {
      if ((command.status === "queued" || command.status === "dispatched") && at >= command.deadlineAt) {
        command.status = "timed-out";
        command.completedAt = at;
        command.error = { code: "COMMAND_TIMEOUT", message: "The browser did not complete this command before its deadline." };
        recordCommandEvent(command, "timedOut", "command.timed-out", {
          actor: "relay",
          label: `Timed out ${command.method}`,
          ok: false,
          outcome: "timed-out",
          code: "COMMAND_TIMEOUT"
        }, at);
      }
    }
    removeInactiveQueuedIds();

    const removable = [...commands.values()]
      .filter((command) => command.completedAt && at - command.completedAt >= resultTtlMs)
      .sort((left, right) => left.completedAt - right.completedAt);
    for (const command of removable) commands.delete(command.id);

    const completed = [...commands.values()]
      .filter((command) => command.status === "completed" || command.status === "timed-out")
      .sort((left, right) => right.completedAt - left.completedAt);
    for (const command of completed.slice(maxStoredResults)) commands.delete(command.id);
  }

  function dispatchErrorFor(command, at) {
    if (!isMutatingCommandMethod(command.method) || !workSessionGateEnabled) return null;
    refreshWorkSession(at);
    if (!workSession) {
      return {
        code: "WORK_SESSION_REQUIRED",
        message: "Start a timed work session before dispatching a mutating editor command."
      };
    }
    if (workSession.status !== "running") {
      const code = workSession.status === "paused"
        ? "WORK_SESSION_PAUSED"
        : (workSession.status === "expired" ? "WORK_SESSION_EXPIRED" : "WORK_SESSION_STOPPED");
      return { code, message: `The timed work session is ${workSession.status}.` };
    }
    if (!command.workSession) {
      return {
        code: "WORK_SESSION_CONTEXT_REQUIRED",
        message: "This queued mutation predates the active timed work session and cannot be dispatched safely."
      };
    }
    if (command.workSession.id !== workSession.id || command.workSession.generation !== workSession.generation) {
      return {
        code: "WORK_SESSION_CONTEXT_STALE",
        message: "The timed work-session context changed before this command was dispatched."
      };
    }
    if (at >= workSession.deadlineAt) {
      refreshWorkSession(at);
      return {
        code: "WORK_SESSION_EXPIRED",
        message: "The timed work session expired before this command was dispatched."
      };
    }
    command.workSession.deadlineAt = workSession.deadlineAt;
    return null;
  }

  function cancelCommandAtDispatch(command, error, at) {
    command.status = "completed";
    command.completedAt = at;
    command.ok = false;
    command.result = null;
    command.error = error;
    recordCommandEvent(command, "cancelled", "command.cancelled", {
      actor: "relay",
      label: `Cancelled ${command.method}`,
      ok: false,
      outcome: "cancelled",
      code: error.code
    }, at);
  }

  function takeNextCommand() {
    prune();
    while (queuedIds.length > 0) {
      const id = queuedIds.shift();
      const command = commands.get(id);
      if (!command || command.status !== "queued") continue;
      const dispatchedAt = now();
      const dispatchError = dispatchErrorFor(command, dispatchedAt);
      if (command.status !== "queued") continue;
      if (dispatchError) {
        cancelCommandAtDispatch(command, dispatchError, dispatchedAt);
        continue;
      }
      command.status = "dispatched";
      command.dispatchedAt = dispatchedAt;
      recordCommandEvent(command, "dispatched", "command.dispatched", {
        actor: "relay",
        label: `Dispatched ${command.method}`,
        outcome: "dispatched"
      }, dispatchedAt);
      return command;
    }
    return null;
  }

  function respondToWaiter(waiter, command) {
    waiters.delete(waiter);
    cancelTimeout(waiter.timer);
    waiter.response.off("close", waiter.onClose);
    sendJson(waiter.response, 200, publicCommand(command));
  }

  function wakeOneWaiter() {
    const waiter = waiters.values().next().value;
    if (!waiter) return;
    const command = takeNextCommand();
    if (command) respondToWaiter(waiter, command);
  }

  function requireMcpToken(request, response) {
    if (!isLoopbackHost(request)) {
      sendJson(response, 403, { ok: false, error: "MCP relay requests are accepted only through a loopback host." });
      return false;
    }
    if (!tokensMatch(suppliedToken(request), token)) {
      sendJson(response, 401, { ok: false, error: "A valid MCP launch token is required." }, { "www-authenticate": "Bearer" });
      return false;
    }
    return true;
  }

  function requireBrowserAccess(request, response) {
    if (isSameOriginBrowserRequest(request) || (isLoopbackHost(request) && tokensMatch(suppliedToken(request), token))) return true;
    sendJson(response, 403, { ok: false, error: "Browser relay requests must come from the BoltWorks same-origin page." });
    return false;
  }

  function status() {
    prune();
    let queued = 0;
    let dispatched = 0;
    let completed = 0;
    let timedOut = 0;
    for (const command of commands.values()) {
      if (command.status === "queued") queued += 1;
      else if (command.status === "dispatched") dispatched += 1;
      else if (command.status === "completed") completed += 1;
      else if (command.status === "timed-out") timedOut += 1;
    }
    return {
      ok: true,
      relay: closed ? "closed" : "ready",
      queued,
      dispatched,
      completed,
      timedOut,
      waitingBrowsers: waiters.size,
      browserConnected: browserHeartbeatAt > 0 && now() - browserHeartbeatAt < 45_000,
      browserHeartbeatAt: browserHeartbeatAt ? new Date(browserHeartbeatAt).toISOString() : null,
      browserCapabilities,
      workSessionGateEnabled,
      workSession: publicWorkSession(workSession)
    };
  }

  function handleHttp({ pathname, request, response, url }) {
    if (!pathname.startsWith("/__mcp/") && !pathname.startsWith("/__modeler/mcp/")) return false;
    if (!request) {
      sendJson(response, 500, { ok: false, error: "The local host did not pass the HTTP request to the MCP relay." });
      return true;
    }
    if (closed) {
      sendJson(response, 503, { ok: false, error: "The MCP relay is closed." });
      return true;
    }

    const method = String(request.method || "GET").toUpperCase();

    if (pathname === "/__mcp/command") {
      if (!requireMcpToken(request, response)) return true;
      if (method !== "POST") {
        sendJson(response, 405, { ok: false, error: "Use POST for MCP commands." }, { allow: "POST" });
        return true;
      }
      void readJsonBody(request, maxBodyBytes).then((payload) => {
        prune();
        if (!isRecord(payload) || typeof payload.method !== "string" || !payload.method.trim() || payload.method.length > 128) {
          sendJson(response, 400, { ok: false, error: "Command body must contain a non-empty method string of at most 128 characters." });
          return;
        }
        if (payload.params !== undefined && !isRecord(payload.params)) {
          sendJson(response, 400, { ok: false, error: "Command params must be a JSON object when supplied." });
          return;
        }
        const commandMethod = payload.method.trim();
        const commandParams = payload.params || {};
        const createdAt = now();
        const timeoutMs = Math.max(1_000, parsePositiveInteger(payload.timeoutMs, defaultCommandTimeoutMs, maxCommandTimeoutMs));
        const command = {
          id: randomUUID(),
          method: commandMethod,
          params: commandParams,
          status: "queued",
          createdAt,
          dispatchedAt: 0,
          completedAt: 0,
          deadlineAt: createdAt + timeoutMs,
          ok: null,
          result: null,
          error: null
        };

        if (WORK_SESSION_METHODS.has(commandMethod)) {
          const action = commandMethod.slice("work_session.".length);
          command.status = "completed";
          command.dispatchedAt = createdAt;
          command.completedAt = createdAt;
          try {
            command.ok = true;
            command.result = performSessionAction(action, commandParams, "mcp");
          } catch (error) {
            command.ok = false;
            command.result = null;
            command.error = publicError(error);
          }
          commands.set(command.id, command);
          prune();
          sendJson(response, 202, publicResult(command), { location: `/__mcp/result/${command.id}` });
          return;
        }

        if (isMutatingCommandMethod(commandMethod) && workSessionGateEnabled) {
          refreshWorkSession(createdAt);
          let gateError = null;
          if (!workSession) {
            gateError = {
              code: "WORK_SESSION_REQUIRED",
              message: "Start a timed work session before submitting a mutating editor command."
            };
          } else if (workSession.status !== "running") {
            const code = workSession.status === "paused"
              ? "WORK_SESSION_PAUSED"
              : (workSession.status === "expired" ? "WORK_SESSION_EXPIRED" : "WORK_SESSION_STOPPED");
            gateError = { code, message: `The timed work session is ${workSession.status}.` };
          }
          if (gateError) {
            if (workSession) {
              workSession.counters.rejected += 1;
              appendSessionEvent("command.rejected", "relay", {
                label: `Rejected ${commandMethod}`,
                ok: false,
                commandId: command.id,
                method: commandMethod,
                outcome: "rejected",
                code: gateError.code
              }, createdAt);
            }
            sendJson(response, 409, { ok: false, error: gateError });
            return;
          }
          command.workSession = {
            id: workSession.id,
            generation: workSession.generation,
            status: "running",
            deadlineAt: workSession.deadlineAt
          };
        }

        if (activeCount() >= maxActiveCommands) {
          sendJson(response, 429, { ok: false, error: "The MCP command queue is full." }, { "retry-after": "1" });
          return;
        }
        commands.set(command.id, command);
        queuedIds.push(command.id);
        recordCommandEvent(command, "accepted", "command.accepted", {
          actor: "mcp",
          label: `Accepted ${command.method}`,
          outcome: "queued"
        }, createdAt);
        wakeOneWaiter();
        sendJson(response, 202, publicResult(command), { location: `/__mcp/result/${command.id}` });
      }).catch((error) => {
        sendJson(response, error.statusCode || 400, { ok: false, error: error.message || "Could not read command body." });
      });
      return true;
    }

    if (pathname.startsWith("/__mcp/result/")) {
      if (!requireMcpToken(request, response)) return true;
      if (method !== "GET") {
        sendJson(response, 405, { ok: false, error: "Use GET for MCP command results." }, { allow: "GET" });
        return true;
      }
      const id = pathname.slice("/__mcp/result/".length);
      if (!/^[0-9a-f-]{36}$/i.test(id)) {
        sendJson(response, 400, { ok: false, error: "Invalid command id." });
        return true;
      }
      prune();
      const command = commands.get(id);
      if (!command) {
        sendJson(response, 404, { ok: false, error: "Unknown or expired command id." });
        return true;
      }
      const pending = command.status === "queued" || command.status === "dispatched";
      sendJson(response, pending ? 202 : 200, publicResult(command), pending ? { "retry-after": "1" } : {});
      return true;
    }

    if (pathname === "/__mcp/status") {
      if (!requireMcpToken(request, response)) return true;
      if (method !== "GET") {
        sendJson(response, 405, { ok: false, error: "Use GET for MCP relay status." }, { allow: "GET" });
        return true;
      }
      sendJson(response, 200, status());
      return true;
    }

    if (pathname === "/__modeler/mcp/next") {
      if (!requireBrowserAccess(request, response)) return true;
      if (method !== "GET") {
        sendJson(response, 405, { ok: false, error: "Use GET to poll MCP commands." }, { allow: "GET" });
        return true;
      }
      browserHeartbeatAt = now();
      const command = takeNextCommand();
      if (command) {
        sendJson(response, 200, publicCommand(command));
        return true;
      }
      const requestUrl = url || new URL(request.url || pathname, `http://${normalizedHost(request)}`);
      const waitMs = parsePositiveInteger(requestUrl.searchParams.get("waitMs"), 0, maxLongPollMs);
      if (waitMs === 0) {
        sendEmpty(response, 204);
        return true;
      }
      if (waiters.size >= maxWaiters) {
        sendJson(response, 429, { ok: false, error: "Too many browser command polls are already waiting." }, { "retry-after": "1" });
        return true;
      }
      const waiter = { response, timer: null, onClose: null };
      waiter.onClose = () => {
        cancelTimeout(waiter.timer);
        waiters.delete(waiter);
      };
      waiter.timer = scheduleTimeout(() => {
        waiters.delete(waiter);
        response.off("close", waiter.onClose);
        sendEmpty(response, 204);
      }, waitMs);
      waiter.timer.unref?.();
      response.once("close", waiter.onClose);
      waiters.add(waiter);
      return true;
    }

    if (pathname === "/__modeler/mcp/preflight") {
      if (!requireBrowserAccess(request, response)) return true;
      if (method !== "POST") {
        sendJson(response, 405, { ok: false, error: "Use POST to preflight an MCP command." }, { allow: "POST" });
        return true;
      }
      browserHeartbeatAt = now();
      void readJsonBody(request, Math.min(maxBodyBytes, 16 * 1024)).then((payload) => {
        const id = typeof payload?.id === "string" ? payload.id.trim() : "";
        if (!isRecord(payload) || !id || id.length > 128) {
          sendJson(response, 400, {
            ok: false,
            error: { code: "INVALID_PREFLIGHT_INPUT", message: "Preflight requests require a valid command id." }
          });
          return;
        }
        const command = commands.get(id);
        if (!command) {
          sendJson(response, 404, {
            ok: false,
            error: { code: "COMMAND_NOT_FOUND", message: "Unknown or expired command id." }
          });
          return;
        }
        if (command.status !== "dispatched") {
          sendJson(response, 409, {
            ok: false,
            error: {
              code: "COMMAND_NOT_DISPATCHED",
              message: `Command cannot be preflighted while its status is ${command.status}.`
            }
          });
          return;
        }
        const preflightAt = now();
        const preflightError = dispatchErrorFor(command, preflightAt);
        if (preflightError) {
          sendJson(response, 409, { ok: false, error: preflightError });
          return;
        }
        sendJson(response, 200, {
          ok: true,
          id: command.id,
          status: command.status,
          workSession: publicWorkSession(workSession, preflightAt)
        });
      }).catch((error) => {
        sendJson(response, error.statusCode || 400, {
          ok: false,
          error: publicError(error, "INVALID_PREFLIGHT_INPUT")
        });
      });
      return true;
    }

    if (pathname === "/__modeler/mcp/result") {
      if (!requireBrowserAccess(request, response)) return true;
      if (method !== "POST") {
        sendJson(response, 405, { ok: false, error: "Use POST to return MCP command results." }, { allow: "POST" });
        return true;
      }
      browserHeartbeatAt = now();
      void readJsonBody(request, maxBodyBytes).then((payload) => {
        if (!isRecord(payload) || typeof payload.id !== "string" || typeof payload.ok !== "boolean") {
          sendJson(response, 400, { ok: false, error: "Result body must contain id and boolean ok fields." });
          return;
        }
        const command = commands.get(payload.id);
        if (!command) {
          sendJson(response, 404, { ok: false, error: "Unknown or expired command id." });
          return;
        }
        if (command.status !== "dispatched") {
          sendJson(response, 409, { ok: false, error: `Command cannot accept a result while its status is ${command.status}.` });
          return;
        }
        if (payload.error !== undefined && payload.error !== null && !isRecord(payload.error) && typeof payload.error !== "string") {
          sendJson(response, 400, { ok: false, error: "Result error must be a string or JSON object when supplied." });
          return;
        }
        const audit = normalizeBrowserAudit(payload.audit);
        command.status = "completed";
        command.completedAt = now();
        command.ok = payload.ok;
        command.result = payload.result ?? null;
        command.error = payload.error ?? null;
        if (commandBelongsToCurrentSession(command)) {
          const resultRevision = Number(isRecord(payload.result) ? payload.result.revision : NaN);
          if (Number.isInteger(resultRevision) && resultRevision >= 0) {
            workSession.endRevision = Math.max(workSession.endRevision, resultRevision);
          }
          if (audit) workSession.endRevision = Math.max(workSession.endRevision, audit.afterRevision);
        }
        const errorCode = isRecord(command.error) && typeof command.error.code === "string"
          ? command.error.code
          : undefined;
        recordCommandEvent(
          command,
          payload.ok ? "completed" : "failed",
          payload.ok ? "command.completed" : "command.failed",
          {
            actor: "browser",
            label: `${payload.ok ? "Completed" : "Failed"} ${command.method}`,
            ok: payload.ok,
            outcome: payload.ok ? "completed" : "failed",
            code: errorCode,
            details: audit
          },
          command.completedAt
        );
        prune();
        sendJson(response, 200, { ok: true, id: command.id, status: command.status });
      }).catch((error) => {
        sendJson(response, error.statusCode || 400, { ok: false, error: error.message || "Could not read result body." });
      });
      return true;
    }

    if (pathname === "/__modeler/mcp/session") {
      if (!requireBrowserAccess(request, response)) return true;
      const requestUrl = url || new URL(request.url || pathname, `http://${normalizedHost(request)}`);
      if (method === "GET") {
        const sinceSequence = parsePositiveInteger(
          requestUrl.searchParams.get("sinceSequence"),
          0,
          Number.MAX_SAFE_INTEGER
        );
        if (requestUrl.searchParams.get("download") === "1") {
          refreshWorkSession(now());
          if (!workSession) {
            sendJson(response, 404, {
              ok: false,
              error: {
                code: "WORK_SESSION_REQUIRED",
                message: "No timed work session exists, so there is no report to download."
              }
            });
            return true;
          }
          const report = buildWorkSessionReport(workSession, now());
          sendJson(response, 200, report, {
            "content-disposition": `attachment; filename="boltworks-ai-work-session-${workSession.id}.json"`
          });
          return true;
        }
        sendJson(response, 200, sessionResponse({
          sinceSequence,
          includeReport: requestUrl.searchParams.get("includeReport") === "1"
        }));
        return true;
      }
      if (method === "POST") {
        void readJsonBody(request, Math.min(maxBodyBytes, 64 * 1024)).then((payload) => {
          if (!isRecord(payload) || typeof payload.action !== "string" || !payload.action.trim()) {
            sendJson(response, 400, {
              ok: false,
              error: {
                code: "INVALID_WORK_SESSION_ACTION",
                message: "Work-session requests require a non-empty action string."
              }
            });
            return;
          }
          try {
            sendJson(response, 200, performSessionAction(payload.action.trim(), payload, "human"));
          } catch (error) {
            sendJson(response, error?.statusCode || 400, { ok: false, error: publicError(error) });
          }
        }).catch((error) => {
          sendJson(response, error.statusCode || 400, {
            ok: false,
            error: publicError(error, "INVALID_WORK_SESSION_INPUT")
          });
        });
        return true;
      }
      sendJson(response, 405, { ok: false, error: "Use GET or POST for timed work sessions." }, { allow: "GET, POST" });
      return true;
    }

    if (pathname === "/__modeler/mcp/heartbeat") {
      if (!requireBrowserAccess(request, response)) return true;
      if (method !== "POST") {
        sendJson(response, 405, { ok: false, error: "Use POST for browser heartbeats." }, { allow: "POST" });
        return true;
      }
      void readJsonBody(request, Math.min(maxBodyBytes, 64 * 1024)).then((payload) => {
        if (!isRecord(payload)) {
          sendJson(response, 400, { ok: false, error: "Heartbeat body must be a JSON object." });
          return;
        }
        browserHeartbeatAt = now();
        browserCapabilities = isRecord(payload.capabilities) ? payload.capabilities : null;
        sendJson(response, 200, status());
      }).catch((error) => {
        sendJson(response, error.statusCode || 400, { ok: false, error: error.message || "Could not read heartbeat body." });
      });
      return true;
    }

    if (pathname === "/__modeler/mcp/status") {
      if (!requireBrowserAccess(request, response)) return true;
      if (method !== "GET") {
        sendJson(response, 405, { ok: false, error: "Use GET for browser relay status." }, { allow: "GET" });
        return true;
      }
      browserHeartbeatAt = now();
      sendJson(response, 200, status());
      return true;
    }

    sendJson(response, 404, { ok: false, error: "Unknown MCP relay endpoint." });
    return true;
  }

  function close() {
    if (closed) return;
    closed = true;
    clearWorkSessionExpiryTimer();
    for (const waiter of waiters) {
      cancelTimeout(waiter.timer);
      waiter.response.off("close", waiter.onClose);
      sendJson(waiter.response, 503, { ok: false, error: "The MCP relay is closing." });
    }
    waiters.clear();
  }

  return Object.freeze({ token, handleHttp, status, close });
}
