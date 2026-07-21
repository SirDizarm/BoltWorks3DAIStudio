import { createServer } from "node:http";
import { dirname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildStudioBundle } from "./studio-bundler.mjs";
import { handleHostApi } from "./localserver/host-api.mjs";
import { serveStatic } from "./localserver/static-handler.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT || 4173);
const pendingProjectFile = process.env.MODELER_PENDING_PROJECT_FILE
  ? normalize(process.env.MODELER_PENDING_PROJECT_FILE)
  : join(root, ".runtime", "pending-open-project.json");
const studioSource = await buildStudioBundle({ outfile: join(root, "app", "studio-v48.0.11.js") });

const server = createServer((request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "127.0.0.1"}`);
  if (handleHostApi({ pathname: url.pathname, response, server, pendingProjectFile })) return;
  if (url.pathname === "/app/studio-v48.0.11.js") {
    response.writeHead(200, {
      "content-type": "text/javascript; charset=utf-8",
      "cache-control": "no-store"
    });
    response.end(studioSource);
    return;
  }
  serveStatic({ root, pathname: url.pathname, response });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`BoltWorks 3D AI Studio local edition running at http://127.0.0.1:${port}`);
});
