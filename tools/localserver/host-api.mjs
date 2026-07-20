import { existsSync, readFileSync, unlinkSync } from "node:fs";

export function handleHostApi({ pathname, response, server, pendingProjectFile }) {
  if (pathname === "/__ping") {
    response.writeHead(200, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
    response.end("ok");
    return true;
  }
  if (pathname === "/__shutdown") {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
    response.end(JSON.stringify({ ok: true, stopping: true }));
    setTimeout(() => server.close(() => process.exit(0)), 50);
    return true;
  }
  if (pathname !== "/__modeler/open-project") return false;
  if (!existsSync(pendingProjectFile)) {
    response.writeHead(204, { "cache-control": "no-store" });
    response.end();
    return true;
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
  return true;
}
