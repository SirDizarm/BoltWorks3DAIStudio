import { lstat, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const THIS_DIR = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(THIS_DIR, "..", "..");
const SESSION_FILE = process.env.BWS_MCP_SESSION_FILE
  ? resolve(process.env.BWS_MCP_SESSION_FILE)
  : resolve(REPO_ROOT, ".runtime", "mcp-session.json");
const DEFAULT_HOST_URL = "http://127.0.0.1:4173";
const SESSION_FILE_LIMIT = 16 * 1024;
const RESPONSE_LIMIT = 8 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 10_000;
const DEFAULT_COMMAND_TIMEOUT_MS = 60_000;

function safeErrorMessage(error) {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object") {
    const message = typeof error.message === "string" ? error.message : "Unknown MCP relay error.";
    return typeof error.code === "string" ? `${error.code}: ${message}` : message;
  }
  return String(error || "Unknown MCP relay error.");
}

async function readSessionFile() {
  let stat;
  try {
    stat = await lstat(SESSION_FILE);
  } catch (error) {
    if (error?.code === "ENOENT") return {};
    throw new Error(`Could not inspect the BoltWorks MCP session file: ${safeErrorMessage(error)}`);
  }

  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new Error("The BoltWorks MCP session path must be a regular, non-symbolic-link file.");
  }
  if (stat.size > SESSION_FILE_LIMIT) {
    throw new Error("The BoltWorks MCP session file is unexpectedly large and was not read.");
  }

  try {
    const parsed = JSON.parse(await readFile(SESSION_FILE, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    throw new Error(`The BoltWorks MCP session file is invalid JSON: ${safeErrorMessage(error)}`);
  }
}

function normalizeHostUrl(candidate) {
  let url;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error("BWS_MCP_URL must be a valid http:// or https:// URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("BWS_MCP_URL must use http:// or https://.");
  }

  const loopbackHosts = new Set(["127.0.0.1", "localhost", "[::1]"]);
  if (!loopbackHosts.has(url.hostname.toLowerCase()) && process.env.BWS_ALLOW_REMOTE_HOST !== "1") {
    throw new Error(
      "BoltWorks MCP only connects to the local computer by default. Set BWS_ALLOW_REMOTE_HOST=1 only if you intentionally secured a remote relay."
    );
  }

  url.pathname = url.pathname.replace(/\/$/, "");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

export async function resolveRelayConfiguration() {
  const session = await readSessionFile();
  const hostUrl = normalizeHostUrl(
    process.env.BWS_MCP_URL || process.env.BWS_HOST_URL || session.hostUrl || DEFAULT_HOST_URL
  );
  const token = process.env.BWS_MCP_TOKEN || session.token;

  if (typeof token !== "string" || token.length < 1) {
    throw new Error(
      "No BoltWorks MCP token is available. Start the local BoltWorks server first, or set BWS_MCP_TOKEN for the relay you configured."
    );
  }

  return { hostUrl, token };
}

async function readJsonResponse(response) {
  const text = await response.text();
  if (text.length > RESPONSE_LIMIT) {
    throw new Error("The BoltWorks relay response exceeded the MCP safety limit.");
  }
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`The BoltWorks relay returned invalid JSON (HTTP ${response.status}).`);
  }
}

async function relayFetch(url, options = {}) {
  try {
    return await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
  } catch (error) {
    throw new Error(`Could not reach the local BoltWorks relay: ${safeErrorMessage(error)}`);
  }
}

function relayHeaders(token, includeJson = false) {
  return {
    Authorization: `Bearer ${token}`,
    ...(includeJson ? { "Content-Type": "application/json" } : {})
  };
}

function wait(milliseconds) {
  return new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));
}

export async function runHostCommand(method, params = {}, options = {}) {
  const { hostUrl, token } = await resolveRelayConfiguration();
  const timeoutMs = Number.isInteger(options.timeoutMs)
    ? Math.min(Math.max(options.timeoutMs, 1_000), 300_000)
    : DEFAULT_COMMAND_TIMEOUT_MS;

  const queuedResponse = await relayFetch(`${hostUrl}/__mcp/command`, {
    method: "POST",
    headers: relayHeaders(token, true),
    body: JSON.stringify({ method, params, timeoutMs })
  });
  const queued = await readJsonResponse(queuedResponse);
  if (!queuedResponse.ok || typeof queued.id !== "string") {
    throw new Error(safeErrorMessage(queued.error || queued.message || `BoltWorks rejected ${method} (HTTP ${queuedResponse.status}).`));
  }

  const deadline = Date.now() + timeoutMs + REQUEST_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const resultResponse = await relayFetch(
      `${hostUrl}/__mcp/result/${encodeURIComponent(queued.id)}`,
      { headers: relayHeaders(token) }
    );
    const payload = await readJsonResponse(resultResponse);

    if (resultResponse.status === 202 || payload.status === "queued" || payload.status === "pending") {
      await wait(100);
      continue;
    }
    if (!resultResponse.ok) {
      throw new Error(safeErrorMessage(payload.error || payload.message || `BoltWorks relay failed (HTTP ${resultResponse.status}).`));
    }
    if (payload.status === "timed-out") {
      throw new Error(`BoltWorks timed out while running ${method}.`);
    }
    if (payload.status !== "completed") {
      throw new Error(`BoltWorks returned an unexpected relay state for ${method}.`);
    }
    if (payload.ok === false) {
      throw new Error(safeErrorMessage(payload.error || `BoltWorks could not complete ${method}.`));
    }
    return payload.result;
  }

  throw new Error(`Timed out waiting for BoltWorks to complete ${method}.`);
}
