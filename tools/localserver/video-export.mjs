import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import bundledFfmpegPath from "ffmpeg-static";

const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
const ffmpegCommand = process.env.BWS_FFMPEG_PATH || bundledFfmpegPath || "ffmpeg";
let availabilityPromise;

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegCommand, args, { windowsHide: true });
    let stderr = "";
    child.stderr.on("data", chunk => { stderr += chunk.toString(); });
    child.once("error", reject);
    child.once("close", code => {
      if (code === 0) { resolve(stderr); return; }
      const detail = stderr.trim().split(/\r?\n/).slice(-8).join("\n");
      reject(new Error(detail || `FFmpeg exited with code ${code}.`));
    });
  });
}

async function ffmpegAvailable() {
  availabilityPromise ||= runFfmpeg(["-version"]).then(() => true, () => false);
  return availabilityPromise;
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", chunk => {
      size += chunk.length;
      if (size > MAX_VIDEO_BYTES) {
        reject(new Error("The temporary WebM exceeds the 200 MB local conversion limit."));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.once("end", () => resolve(Buffer.concat(chunks)));
    request.once("error", reject);
  });
}

function safeBaseName(value) {
  return basename(String(value || "boltworks-animation.webm"))
    .replace(/\.webm$/i, "")
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^-+|-+$/g, "") || "boltworks-animation";
}

export async function handleVideoExport({ pathname, request, response }) {
  if (pathname === "/api/video/mp4/status" && request.method === "GET") {
    const available = await ffmpegAvailable();
    response.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
    response.end(JSON.stringify({ available, encoder: "ffmpeg", localServer: true }));
    return true;
  }
  if (pathname !== "/api/video/mp4" || request.method !== "POST") return false;

  if (!await ffmpegAvailable()) {
    response.writeHead(503, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: "MP4 export needs FFmpeg installed locally or BWS_FFMPEG_PATH set to ffmpeg.exe." }));
    return true;
  }

  const temporaryDirectory = mkdtempSync(join(tmpdir(), "boltworks-video-"));
  const inputPath = join(temporaryDirectory, "input.webm");
  const outputPath = join(temporaryDirectory, "output.mp4");
  try {
    const input = await readBody(request);
    if (!input.length) throw new Error("No WebM animation was supplied for conversion.");
    writeFileSync(inputPath, input);
    await runFfmpeg([
      "-y", "-i", inputPath, "-an", "-c:v", "libx264", "-preset", "medium",
      "-crf", "18", "-vf", "pad=ceil(iw/2)*2:ceil(ih/2)*2", "-pix_fmt", "yuv420p",
      "-movflags", "+faststart", outputPath
    ]);
    const output = readFileSync(outputPath);
    const fileName = `${safeBaseName(request.headers["x-boltworks-filename"])}.mp4`;
    response.writeHead(200, {
      "content-type": "video/mp4",
      "content-length": output.length,
      "content-disposition": `attachment; filename="${fileName}"`,
      "cache-control": "no-store"
    });
    response.end(output);
  } catch (error) {
    if (!response.headersSent) response.writeHead(500, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: error?.message || "MP4 conversion failed." }));
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
  return true;
}
