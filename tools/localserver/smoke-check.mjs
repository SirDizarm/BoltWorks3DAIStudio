import { spawn } from "node:child_process";

const port = 4187;
const child = spawn(process.execPath, [new URL("../server.mjs", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")], {
  cwd: new URL("../..", import.meta.url),
  env: { ...process.env, PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"]
});

const waitForPing = async () => {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/__ping`);
      if (response.ok && await response.text() === "ok") return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error("Local server did not become ready");
};

try {
  await waitForPing();
  const [page, bundle, styles, branding] = await Promise.all([
    fetch(`http://127.0.0.1:${port}/`),
    fetch(`http://127.0.0.1:${port}/app/studio-v48.0.11.js`),
    fetch(`http://127.0.0.1:${port}/app/styles/studio.css`),
    fetch(`http://127.0.0.1:${port}/app/assets/branding/boltworks-logo.png`)
  ]);
  const bundleText = await bundle.text();
  if (!page.ok || !styles.ok || !branding.ok || !bundle.ok || !bundleText.includes("window.ModelerStudio")) {
    throw new Error("Local server did not serve the composed canonical application");
  }
  const shutdown = await fetch(`http://127.0.0.1:${port}/__shutdown`);
  if (!shutdown.ok) throw new Error("Local shutdown endpoint failed");
  console.log(`Local server smoke check passed (${bundleText.length} composed bytes).`);
} finally {
  const timeout = setTimeout(() => child.kill(), 3000);
  await new Promise(resolve => child.once("exit", resolve));
  clearTimeout(timeout);
}
