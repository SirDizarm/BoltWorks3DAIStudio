import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

const JSON_TYPE = "application/json; charset=utf-8";
const NO_STORE = { "cache-control": "no-store" };

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
    deadlineAt: command.deadlineAt
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
    deadlineAt: command.deadlineAt
  };
  if (command.status === "completed") return { ...base, ok: command.ok, result: command.result ?? null, error: command.error ?? null };
  if (command.status === "timed-out") {
    return { ...base, ok: false, error: command.error };
  }
  return base;
}

export function createMcpRelay(options = {}) {
  const token = String(options.token || "").trim() || randomBytes(32).toString("base64url");
  const maxActiveCommands = parsePositiveInteger(options.maxActiveCommands, 64, 1024) || 64;
  const maxStoredResults = parsePositiveInteger(options.maxStoredResults, 128, 4096) || 128;
  const maxWaiters = parsePositiveInteger(options.maxWaiters, 8, 64) || 8;
  const maxBodyBytes = parsePositiveInteger(options.maxBodyBytes, 4 * 1024 * 1024, 16 * 1024 * 1024) || 4 * 1024 * 1024;
  const defaultCommandTimeoutMs = parsePositiveInteger(options.defaultCommandTimeoutMs, 60_000, 10 * 60_000) || 60_000;
  const maxCommandTimeoutMs = parsePositiveInteger(options.maxCommandTimeoutMs, 5 * 60_000, 30 * 60_000) || 5 * 60_000;
  const resultTtlMs = parsePositiveInteger(options.resultTtlMs, 5 * 60_000, 60 * 60_000) || 5 * 60_000;
  const maxLongPollMs = parsePositiveInteger(options.maxLongPollMs, 25_000, 30_000) || 25_000;

  const commands = new Map();
  const queuedIds = [];
  const waiters = new Set();
  let browserHeartbeatAt = 0;
  let browserCapabilities = null;
  let closed = false;

  function activeCount() {
    let count = 0;
    for (const command of commands.values()) {
      if (command.status === "queued" || command.status === "dispatched") count += 1;
    }
    return count;
  }

  function prune(now = Date.now()) {
    for (const command of commands.values()) {
      if ((command.status === "queued" || command.status === "dispatched") && now >= command.deadlineAt) {
        command.status = "timed-out";
        command.completedAt = now;
        command.error = { code: "COMMAND_TIMEOUT", message: "The browser did not complete this command before its deadline." };
      }
    }
    for (let index = queuedIds.length - 1; index >= 0; index -= 1) {
      if (commands.get(queuedIds[index])?.status !== "queued") queuedIds.splice(index, 1);
    }

    const removable = [...commands.values()]
      .filter((command) => command.completedAt && now - command.completedAt >= resultTtlMs)
      .sort((left, right) => left.completedAt - right.completedAt);
    for (const command of removable) commands.delete(command.id);

    const completed = [...commands.values()]
      .filter((command) => command.status === "completed" || command.status === "timed-out")
      .sort((left, right) => right.completedAt - left.completedAt);
    for (const command of completed.slice(maxStoredResults)) commands.delete(command.id);
  }

  function takeNextCommand() {
    prune();
    while (queuedIds.length > 0) {
      const id = queuedIds.shift();
      const command = commands.get(id);
      if (!command || command.status !== "queued") continue;
      command.status = "dispatched";
      command.dispatchedAt = Date.now();
      return command;
    }
    return null;
  }

  function respondToWaiter(waiter, command) {
    waiters.delete(waiter);
    clearTimeout(waiter.timer);
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
      browserConnected: browserHeartbeatAt > 0 && Date.now() - browserHeartbeatAt < 45_000,
      browserHeartbeatAt: browserHeartbeatAt ? new Date(browserHeartbeatAt).toISOString() : null,
      browserCapabilities
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
        if (activeCount() >= maxActiveCommands) {
          sendJson(response, 429, { ok: false, error: "The MCP command queue is full." }, { "retry-after": "1" });
          return;
        }
        const now = Date.now();
        const timeoutMs = Math.max(1_000, parsePositiveInteger(payload.timeoutMs, defaultCommandTimeoutMs, maxCommandTimeoutMs));
        const command = {
          id: randomUUID(),
          method: payload.method.trim(),
          params: payload.params || {},
          status: "queued",
          createdAt: now,
          dispatchedAt: 0,
          completedAt: 0,
          deadlineAt: now + timeoutMs,
          ok: null,
          result: null,
          error: null
        };
        commands.set(command.id, command);
        queuedIds.push(command.id);
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
      browserHeartbeatAt = Date.now();
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
        clearTimeout(waiter.timer);
        waiters.delete(waiter);
      };
      waiter.timer = setTimeout(() => {
        waiters.delete(waiter);
        response.off("close", waiter.onClose);
        sendEmpty(response, 204);
      }, waitMs);
      waiter.timer.unref?.();
      response.once("close", waiter.onClose);
      waiters.add(waiter);
      return true;
    }

    if (pathname === "/__modeler/mcp/result") {
      if (!requireBrowserAccess(request, response)) return true;
      if (method !== "POST") {
        sendJson(response, 405, { ok: false, error: "Use POST to return MCP command results." }, { allow: "POST" });
        return true;
      }
      browserHeartbeatAt = Date.now();
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
        command.status = "completed";
        command.completedAt = Date.now();
        command.ok = payload.ok;
        command.result = payload.result ?? null;
        command.error = payload.error ?? null;
        prune();
        sendJson(response, 200, { ok: true, id: command.id, status: command.status });
      }).catch((error) => {
        sendJson(response, error.statusCode || 400, { ok: false, error: error.message || "Could not read result body." });
      });
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
        browserHeartbeatAt = Date.now();
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
      browserHeartbeatAt = Date.now();
      sendJson(response, 200, status());
      return true;
    }

    sendJson(response, 404, { ok: false, error: "Unknown MCP relay endpoint." });
    return true;
  }

  function close() {
    if (closed) return;
    closed = true;
    for (const waiter of waiters) {
      clearTimeout(waiter.timer);
      waiter.response.off("close", waiter.onClose);
      sendJson(waiter.response, 503, { ok: false, error: "The MCP relay is closing." });
    }
    waiters.clear();
  }

  return Object.freeze({ token, handleHttp, status, close });
}
