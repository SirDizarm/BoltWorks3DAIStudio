import { createServer } from "node:http";
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildStudioBundle } from "./studio-bundler.mjs";
import { handleHostApi } from "./localserver/host-api.mjs";
import { createMcpRelay } from "./localserver/mcp-relay.mjs";
import { serveStatic } from "./localserver/static-handler.mjs";
import { handleVideoExport } from "./localserver/video-export.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT || 4173);
const pendingProjectFile = process.env.MODELER_PENDING_PROJECT_FILE
  ? normalize(process.env.MODELER_PENDING_PROJECT_FILE)
  : join(root, ".runtime", "pending-open-project.json");
const mcpSessionFile = process.env.BWS_MCP_SESSION_FILE
  ? normalize(process.env.BWS_MCP_SESSION_FILE)
  : join(root, ".runtime", "mcp-session.json");
// 12 MB gives a base64-encoded reference photo (referenceMatch.createMesh)
// headroom above the relay's previous 4 MB default, while staying under its
// 16 MB hard cap.
const mcpRelay = createMcpRelay({ token: process.env.BWS_MCP_TOKEN, maxBodyBytes: 12 * 1024 * 1024 });
// Use the bundle actually referenced by the editor, not a retired version.
const studioScript = readFileSync(join(root, "index.html"), "utf8")
  .match(/(?:src|data-bws-bundle)=["']\.\/(studio-v[\d.]+\.js)(?:\?[^"']*)?["']/i)?.[1];
if (!studioScript) throw new Error("Cannot locate the editor studio bundle in index.html.");
const studioPath = `/${studioScript}`;
const studioFile = join(root, studioScript);
await buildStudioBundle({ outfile: studioFile });

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "127.0.0.1"}`);
  if (await handleVideoExport({ pathname: url.pathname, request, response })) return;
  if (handleHostApi({ pathname: url.pathname, request, response, server, pendingProjectFile, mcpRelay, url })) return;
  if (url.pathname === studioPath || url.pathname === "/app/studio-v49.64.7.js") {
    // Rebuilds must reach the browser without retaining the server's startup bundle.
    let source;
    try { source = readFileSync(studioFile); }
    catch {
      response.writeHead(503, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
      response.end("Studio build is unavailable. Rebuild Studio and reload.");
      return;
    }
    response.writeHead(200, {
      "content-type": "text/javascript; charset=utf-8",
      "cache-control": "no-store"
    });
    response.end(source);
    return;
  }
  serveStatic({ root, pathname: url.pathname, response });
});

function removeOwnMcpSession() {
  try {
    const current = JSON.parse(readFileSync(mcpSessionFile, "utf8"));
    if (current?.pid === process.pid && current?.token === mcpRelay.token) unlinkSync(mcpSessionFile);
  } catch {
    // A missing or replaced session belongs to no cleanup action here.
  }
}

server.on("close", () => {
  mcpRelay.close();
  removeOwnMcpSession();
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => server.close(() => process.exit(0)));
}

server.listen(port, "127.0.0.1", () => {
  const hostUrl = `http://127.0.0.1:${port}`;
  mkdirSync(dirname(mcpSessionFile), { recursive: true });
  writeFileSync(mcpSessionFile, `${JSON.stringify({
    hostUrl,
    token: mcpRelay.token,
    pid: process.pid,
    startedAt: new Date().toISOString()
  }, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  console.log(`BoltWorks 3D AI Studio local edition running at ${hostUrl}`);
  console.log(`Local MCP relay ready. Start an AI connection with: npm run mcp`);
});
