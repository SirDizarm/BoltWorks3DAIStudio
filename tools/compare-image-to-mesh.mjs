#!/usr/bin/env node
//
// One-off comparison render: the old, orphaned Codex-era mannequin-primitive
// generator (tools/image-to-mesh/generator.js, never wired into the app)
// vs. the live, MCP-accessible Image Relief voxel-carve pipeline
// (app/modules/meshes.js, createReliefGeometryFromViewSheet), both run on
// the same reference image. Not part of the shipped app; run once to
// produce a before/after picture, then tools/image-to-mesh/ gets deleted.
//
// Usage: node tools/compare-image-to-mesh.mjs [reference.png] [output.png]

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { Jimp } from "jimp";
import { createGeometry as createDetailedImageMeshGeometry } from "./image-to-mesh/generator.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function extractFunctionSource(source, name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  if (start === -1) throw new Error(`Could not find function ${name}() in source.`);
  // Parameters may use destructuring ("{ a, b }") which has its own braces,
  // so first skip past the balanced parenthesized parameter list before
  // looking for the function body's opening brace.
  let parenDepth = 0;
  let bodyStart = start + marker.length - 1;
  for (; bodyStart < source.length; bodyStart += 1) {
    if (source[bodyStart] === "(") parenDepth += 1;
    else if (source[bodyStart] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) { bodyStart += 1; break; }
    }
  }
  const braceStart = source.indexOf("{", bodyStart);
  let depth = 0;
  let end = braceStart;
  for (; end < source.length; end += 1) {
    if (source[end] === "{") depth += 1;
    else if (source[end] === "}") {
      depth -= 1;
      if (depth === 0) { end += 1; break; }
    }
  }
  return source.slice(start, end);
}

function loadPureFunctions(filePath, names) {
  const source = fs.readFileSync(filePath, "utf8");
  const combined = names.map((name) => extractFunctionSource(source, name)).join("\n\n");
  const context = {};
  vm.createContext(context);
  vm.runInContext(combined, context, { filename: filePath });
  const result = {};
  for (const name of names) result[name] = context[name];
  return result;
}

function imageDataFromJimp(image) {
  return { width: image.bitmap.width, height: image.bitmap.height, data: image.bitmap.data };
}

// --- Minimal shared software rasterizer (same edge-function + z-buffer
// technique as tools/render-modelerproj-preview.mjs, condensed for a single
// two-panel side-by-side comparison of raw {positions} triangle soups). ---

function subtract(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function length(a) { return Math.sqrt(dot(a, a)); }
function normalize(a) { const l = length(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
function clamp(value, min = 0, max = 1) { return Math.max(min, Math.min(max, value)); }

function cameraBasis() {
  const toCamera = normalize([1.15, 0.55, 1.6]);
  const upHint = [0, 1, 0];
  const right = normalize(cross(upHint, toCamera));
  const up = normalize(cross(toCamera, right));
  return { toCamera, right, up };
}

function renderPositionsToPanel(image, positions, panel, tint) {
  const basis = cameraBasis();
  const vertexCount = Math.floor(positions.length / 3);
  const projected = new Array(vertexCount);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < vertexCount; i += 1) {
    const point = [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]];
    const x = dot(point, basis.right);
    const y = dot(point, basis.up);
    const depth = dot(point, basis.toCamera);
    projected[i] = { x, y, depth };
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  const extentX = Math.max(1e-6, maxX - minX);
  const extentY = Math.max(1e-6, maxY - minY);
  const scale = Math.min(panel.width / extentX, panel.height / extentY) * 0.86;
  const centerX = (minX + maxX) * 0.5;
  const centerY = (minY + maxY) * 0.5;
  for (const p of projected) {
    p.x = panel.x + panel.width * 0.5 + (p.x - centerX) * scale;
    p.y = panel.y + panel.height * 0.5 - (p.y - centerY) * scale;
  }

  const depthBuffer = new Float32Array(panel.width * panel.height).fill(-Infinity);
  const light = normalize([0.5, 0.8, 0.65]);
  const triangleCount = Math.floor(vertexCount / 3);
  for (let t = 0; t < triangleCount; t += 1) {
    const ia = t * 3, ib = t * 3 + 1, ic = t * 3 + 2;
    const pa = projected[ia], pb = projected[ib], pc = projected[ic];
    const va = [positions[ia * 3], positions[ia * 3 + 1], positions[ia * 3 + 2]];
    const vb = [positions[ib * 3], positions[ib * 3 + 1], positions[ib * 3 + 2]];
    const vc = [positions[ic * 3], positions[ic * 3 + 1], positions[ic * 3 + 2]];
    let normal = normalize(cross(subtract(vb, va), subtract(vc, va)));
    if (dot(normal, basis.toCamera) < 0) normal = normal.map((v) => -v);
    const intensity = clamp(0.42 + Math.max(0, dot(normal, light)) * 0.55 + Math.max(0, dot(normal, basis.toCamera)) * 0.15, 0.32, 1.05);

    const area = (pb.x - pa.x) * (pc.y - pa.y) - (pb.y - pa.y) * (pc.x - pa.x);
    if (Math.abs(area) < 0.01) continue;
    const invArea = 1 / area;
    const minPX = Math.max(panel.x, Math.floor(Math.min(pa.x, pb.x, pc.x)));
    const maxPX = Math.min(panel.x + panel.width - 1, Math.ceil(Math.max(pa.x, pb.x, pc.x)));
    const minPY = Math.max(panel.y, Math.floor(Math.min(pa.y, pb.y, pc.y)));
    const maxPY = Math.min(panel.y + panel.height - 1, Math.ceil(Math.max(pa.y, pb.y, pc.y)));
    if (minPX > maxPX || minPY > maxPY) continue;

    for (let y = minPY; y <= maxPY; y += 1) {
      for (let x = minPX; x <= maxPX; x += 1) {
        const sx = x + 0.5, sy = y + 0.5;
        const w0 = ((pb.x - sx) * (pc.y - sy) - (pb.y - sy) * (pc.x - sx)) * invArea;
        const w1 = ((pc.x - sx) * (pa.y - sy) - (pc.y - sy) * (pa.x - sx)) * invArea;
        const w2 = 1 - w0 - w1;
        if (w0 < -1e-4 || w1 < -1e-4 || w2 < -1e-4) continue;
        const depth = pa.depth * w0 + pb.depth * w1 + pc.depth * w2;
        const localIndex = (y - panel.y) * panel.width + (x - panel.x);
        if (depth <= depthBuffer[localIndex]) continue;
        depthBuffer[localIndex] = depth;
        const offset = (y * image.bitmap.width + x) * 4;
        image.bitmap.data[offset] = Math.round(tint[0] * intensity);
        image.bitmap.data[offset + 1] = Math.round(tint[1] * intensity);
        image.bitmap.data[offset + 2] = Math.round(tint[2] * intensity);
        image.bitmap.data[offset + 3] = 255;
      }
    }
  }
}

function filterTriangles(positions, predicate) {
  const filtered = [];
  for (let offset = 0; offset < positions.length; offset += 9) {
    const center = [
      (positions[offset] + positions[offset + 3] + positions[offset + 6]) / 3,
      (positions[offset + 1] + positions[offset + 4] + positions[offset + 7]) / 3,
      (positions[offset + 2] + positions[offset + 5] + positions[offset + 8]) / 3
    ];
    if (predicate(center)) filtered.push(...positions.slice(offset, offset + 9));
  }
  return filtered;
}

async function main() {
  const args = process.argv.slice(2);
  const referencePath = path.resolve(args[0] ?? path.join(root, "samples", "reference", "female_t_pose.png"));
  const outputPath = path.resolve(args[1] ?? path.join(root, "samples", "reference", "codex-image-to-mesh-comparison.png"));
  if (!fs.existsSync(referencePath)) throw new Error(`Reference image not found: ${referencePath}`);

  const sourceImage = await Jimp.read(referencePath);
  const imageData = imageDataFromJimp(sourceImage);
  const threshold = 70;
  const darkForeground = false;
  const scale = 6;
  const depth = 0.9;
  const back = 0.22;
  const qaDetailStrength = Number(process.env.DETAIL_STRENGTH ?? 1);
  const qaSmoothPasses = Number(process.env.SMOOTH_PASSES ?? 4);
  const qaBuildMode = process.env.BUILD_MODE || "solidVisualHull";
  const qaStandardCols = Number(process.env.STANDARD_COLS ?? 84);
  const qaStandardRows = Number(process.env.STANDARD_ROWS ?? 144);

  // --- STANDARD: the same sheet-aware hull at a lower editing resolution ---
  const oldGeometry = createDetailedImageMeshGeometry({
    imageData, cols: qaStandardCols, rows: qaStandardRows, scale, depth, back, threshold, smoothPasses: qaSmoothPasses, detailStrength: qaDetailStrength * .5,
    darkForeground, sourceMode: "sheet", buildMode: qaBuildMode, sourceName: path.basename(referencePath)
  });
  // --- DETAILED: restored high-resolution closed hull with face/finger relief ---
  const newGeometry = createDetailedImageMeshGeometry({
    imageData, cols: 160, rows: 220, scale, depth, back, threshold, smoothPasses: qaSmoothPasses, detailStrength: qaDetailStrength,
    darkForeground, sourceMode: "sheet", buildMode: "solidVisualHull", sourceName: path.basename(referencePath)
  });

  const panelWidth = 640;
  const panelHeight = 820;
  const margin = 24;
  const gap = 24;
  const width = margin * 2 + panelWidth * 2 + gap;
  const height = margin * 2 + panelHeight;
  const image = new Jimp({ width, height, color: 0x14161cff });

  const oldPanel = { x: margin, y: margin, width: panelWidth, height: panelHeight };
  const newPanel = { x: margin + panelWidth + gap, y: margin, width: panelWidth, height: panelHeight };
  renderPositionsToPanel(image, oldGeometry.positions, oldPanel, [214, 128, 96]);
  renderPositionsToPanel(image, newGeometry.positions, newPanel, [120, 176, 224]);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  await image.write(outputPath);

  const detailOutputPath = outputPath.replace(/(\.[^.]+)$/i, "-details$1");
  const detailImage = new Jimp({ width: 1248, height: 624, color: 0x14161cff });
  const facePositions = filterTriangles(newGeometry.positions, point => Math.abs(point[0]) < scale * .14 && point[1] > scale * .30);
  const handPositions = filterTriangles(newGeometry.positions, point => point[0] > scale * .31 && point[1] > scale * .08);
  renderPositionsToPanel(detailImage, facePositions, { x: 20, y: 20, width: 594, height: 584 }, [120, 176, 224]);
  renderPositionsToPanel(detailImage, handPositions, { x: 634, y: 20, width: 594, height: 584 }, [120, 176, 224]);
  await detailImage.write(detailOutputPath);

  const oldTriangles = oldGeometry.positions.length / 9;
  const newTriangles = newGeometry.positions.length / 9;
  console.log(`STANDARD visual hull: ${oldTriangles.toLocaleString("en-US")} triangles, voxelCount=${oldGeometry.meta?.voxelCount ?? "n/a"}`);
  console.log(`DETAILED face/finger hull: ${newTriangles.toLocaleString("en-US")} triangles, uniqueVertices=${newGeometry.meta?.uniqueVertices ?? "n/a"}, detailPeak=${Number(newGeometry.meta?.detailPeak || 0).toFixed(5)}, detailedVertices=${newGeometry.meta?.detailedVertexCount ?? 0}`);
  console.log(`Comparison image: ${outputPath} (${width}x${height}, left=standard, right=detailed)`);
  console.log(`Face/finger close-up: ${detailOutputPath}`);
}

main().catch((error) => {
  console.error(error?.stack ?? error?.message ?? String(error));
  process.exitCode = 1;
});
