import { readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";

const [, , inputArg, outputArg, sourceClipId = "walk", targetClipId = "run", ...requestedBoneIds] = process.argv;
if (!inputArg || !outputArg) {
  throw new Error("Usage: node tools/retime-animation-tracks.mjs <input.modelerproj> <output.modelerproj> [sourceClipId] [targetClipId] [boneIds...]");
}

const boneIds = requestedBoneIds.length ? requestedBoneIds : [
  "left_thigh", "left_shin", "left_foot",
  "right_thigh", "right_shin", "right_foot"
];
const inputPath = resolve(inputArg);
const outputPath = resolve(outputArg);
const project = JSON.parse(readFileSync(inputPath, "utf8"));
const animation = project?.editor?.rigging?.animation;
const sourceClip = animation?.clips?.[sourceClipId];
const targetClip = animation?.clips?.[targetClipId];
if (!sourceClip) throw new Error(`Source animation clip not found: ${sourceClipId}`);
if (!targetClip) throw new Error(`Target animation clip not found: ${targetClipId}`);

const sourceEnd = Math.max(1, Number(sourceClip.end) || 1);
const targetEnd = Math.max(1, Number(targetClip.end) || 1);
const frameScale = targetEnd / sourceEnd;
const copied = [];

for (const boneId of boneIds) {
  const sourceKeys = sourceClip.keys?.[boneId] || [];
  if (!sourceKeys.length) continue;
  const byFrame = new Map();
  for (const sourceKey of sourceKeys) {
    const frame = Number(sourceKey.frame) === sourceEnd
      ? targetEnd
      : Math.max(0, Math.min(targetEnd, Math.round((Number(sourceKey.frame) || 0) * frameScale)));
    byFrame.set(frame, {
      ...sourceKey,
      frame,
      position: Array.isArray(sourceKey.position) ? [...sourceKey.position] : sourceKey.position,
      rotation: Array.isArray(sourceKey.rotation) ? [...sourceKey.rotation] : sourceKey.rotation
    });
  }
  targetClip.keys[boneId] = [...byFrame.values()].sort((a, b) => a.frame - b.frame);
  copied.push({ boneId, sourceFrames: sourceKeys.map(key => key.frame), targetFrames: targetClip.keys[boneId].map(key => key.frame) });
}

if (animation.activeClipId === targetClipId) animation.keys = targetClip.keys;
project.name = `${project.name || basename(inputPath, ".modelerproj")}-${targetClipId}-legs-retimed`;
project.savedAt = new Date().toISOString();
writeFileSync(outputPath, `${JSON.stringify(project, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ inputPath, outputPath, sourceClipId, targetClipId, sourceEnd, targetEnd, frameScale, copied }, null, 2));
