import { createReadStream, existsSync, readFileSync, statSync, unlinkSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const root = normalize(new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const port = Number(process.env.PORT || 4173);
const pendingProjectFile = process.env.MODELER_PENDING_PROJECT_FILE
  ? normalize(process.env.MODELER_PENDING_PROJECT_FILE)
  : join(root, ".runtime", "pending-open-project.json");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".ico": "image/x-icon",
  ".wasm": "application/wasm"
};

const server = createServer((request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host}`);
  if (url.pathname === "/__ping") {
    response.writeHead(200, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
    response.end("ok");
    return;
  }
  if (url.pathname === "/__shutdown") {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
    response.end(JSON.stringify({ ok: true, stopping: true }));
    setTimeout(() => {
      server.close(() => process.exit(0));
    }, 50);
    return;
  }
  if (url.pathname === "/__modeler/open-project") {
    if (!existsSync(pendingProjectFile)) {
      response.writeHead(204, { "cache-control": "no-store" });
      response.end();
      return;
    }
    try {
      const text = readFileSync(pendingProjectFile, "utf8");
      unlinkSync(pendingProjectFile);
      response.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      response.end(text);
    } catch {
      response.writeHead(500, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
      response.end("Could not read pending project");
    }
    return;
  }
  const safePath = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
  let file = join(root, safePath);
  if (file.endsWith("\\") || file.endsWith("/")) file = join(file, "index.html");
  if (!existsSync(file) || !statSync(file).isFile()) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }
  response.writeHead(200, { "content-type": types[extname(file)] || "application/octet-stream" });
  createReadStream(file).pipe(response);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`BoltWorks 3D AI Studio running at http://127.0.0.1:${port}`);
});
