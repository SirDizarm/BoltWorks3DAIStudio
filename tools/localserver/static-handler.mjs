import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, isAbsolute, join, normalize, relative } from "node:path";

const types = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif",
  ".bmp": "image/bmp", ".ico": "image/x-icon", ".wasm": "application/wasm"
};

export function serveStatic({ root, pathname, response }) {
  const decoded = decodeURIComponent(pathname);
  const requested = normalize(join(root, decoded));
  const relativePath = relative(root, requested);
  if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
    response.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
    response.end("Forbidden");
    return;
  }
  let file = requested;
  if (file.endsWith("\\") || file.endsWith("/")) file = join(file, "index.html");
  if (!existsSync(file) || !statSync(file).isFile()) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }
  response.writeHead(200, { "content-type": types[extname(file).toLowerCase()] || "application/octet-stream" });
  createReadStream(file).pipe(response);
}
