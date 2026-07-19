import { Jimp } from "jimp";
import { createGeometry } from "../image-to-mesh-generator.js";

const source = process.argv[2];
if (!source) throw new Error("Usage: node tools/benchmark-relief.mjs <view-sheet.png>");

const image = await Jimp.read(source);
const imageData = {
  width: image.bitmap.width,
  height: image.bitmap.height,
  data: image.bitmap.data
};
const before = process.memoryUsage();
const started = performance.now();
const result = createGeometry({
  imageData,
  cols: 56,
  rows: 96,
  scale: 6,
  depth: .9,
  back: .22,
  threshold: 70,
  smoothPasses: 2,
  darkForeground: false,
  sourceMode: "sheet",
  buildMode: "meshRebuild",
  bodyPreset: "auto",
  sourceName: source
});
const after = process.memoryUsage();

console.log(JSON.stringify({
  mode: result.meta.mode,
  buildMode: result.meta.buildMode,
  triangles: result.positions.length / 9,
  mergedFaces: result.meta.mergedFaceCount,
  elapsedMs: Math.round(performance.now() - started),
  heapDeltaMb: Math.round((after.heapUsed - before.heapUsed) / 1024 / 1024),
  rssDeltaMb: Math.round((after.rss - before.rss) / 1024 / 1024),
  grid: [result.meta.cols, result.meta.rows, result.meta.depthSlices]
}, null, 2));
