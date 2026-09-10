import { readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";

const [, , inputArg, outputArg, clipId = "walk", sourceRootId = "left_thigh"] = process.argv;
if (!inputArg || !outputArg) {
  throw new Error("Usage: node tools/mirror-animation-branch.mjs <input.modelerproj> <output.modelerproj> [clipId] [sourceRootId]");
}

const inputPath = resolve(inputArg);
const outputPath = resolve(outputArg);
const project = JSON.parse(readFileSync(inputPath, "utf8"));
const rigging = project?.editor?.rigging;
const animation = rigging?.animation;
const clip = animation?.clips?.[clipId];
const bones = rigging?.bones || [];
if (!clip) throw new Error(`Animation clip not found: ${clipId}`);

const boneById = id => bones.find(bone => bone.id === id);
const oppositeId = id => {
  if (id.includes("left_")) return id.replace("left_", "right_");
  if (id.includes("right_")) return id.replace("right_", "left_");
  if (id.endsWith("_l")) return `${id.slice(0, -2)}_r`;
  if (id.endsWith("_r")) return `${id.slice(0, -2)}_l`;
  return null;
};
const sourceRoot = boneById(sourceRootId);
if (!sourceRoot || !boneById(oppositeId(sourceRoot.id))) throw new Error(`Mirrored source bone not found: ${sourceRootId}`);

const branchIds = new Set([sourceRoot.id]);
let changed = true;
while (changed) {
  changed = false;
  for (const bone of bones) {
    if (!branchIds.has(bone.id) && branchIds.has(bone.parentId)) {
      branchIds.add(bone.id);
      changed = true;
    }
  }
}

const vector = (value, fallback = [0, 0, 0]) => Array.isArray(value) ? value.slice(0, 3).map(Number) : [...fallback];
const mirroredKey = (key, source, target, frame) => {
  const sourceRestPosition = vector(source.bindPosition, vector(source.position));
  const targetRestPosition = vector(target.bindPosition, vector(target.position));
  const sourceRestRotation = vector(source.bindRotation);
  const targetRestRotation = vector(target.bindRotation);
  const position = vector(key.position, sourceRestPosition);
  const rotation = vector(key.rotation, sourceRestRotation);
  const positionDelta = position.map((value, index) => value - sourceRestPosition[index]);
  const rotationDelta = rotation.map((value, index) => value - sourceRestRotation[index]);
  return {
    frame,
    position: [
      targetRestPosition[0] - positionDelta[0],
      targetRestPosition[1] + positionDelta[1],
      targetRestPosition[2] + positionDelta[2]
    ],
    rotation: [
      targetRestRotation[0] + rotationDelta[0],
      targetRestRotation[1] - rotationDelta[1],
      targetRestRotation[2] - rotationDelta[2]
    ]
  };
};

const end = Math.max(1, Number(clip.end) || Number(animation.end) || 1);
const offset = Math.round(end / 2);
const copied = [];
for (const source of bones.filter(bone => branchIds.has(bone.id))) {
  const target = boneById(oppositeId(source.id));
  const sourceKeys = clip.keys?.[source.id] || [];
  if (!target || !sourceKeys.length) continue;
  const byFrame = new Map();
  for (const sourceKey of sourceKeys) {
    const sourceFrame = Number(sourceKey.frame) === end ? 0 : Number(sourceKey.frame) || 0;
    const shiftedFrame = (sourceFrame + offset) % end;
    byFrame.set(shiftedFrame, mirroredKey(sourceKey, source, target, shiftedFrame));
  }
  if (byFrame.has(0)) {
    const first = byFrame.get(0);
    byFrame.set(end, { ...first, frame: end, position: [...first.position], rotation: [...first.rotation] });
  }
  clip.keys[target.id] = [...byFrame.values()].sort((a, b) => a.frame - b.frame);
  copied.push({ source: source.id, target: target.id, frames: clip.keys[target.id].map(key => key.frame) });
}

if (animation.activeClipId === clipId) animation.keys = clip.keys;
project.name = `${project.name || basename(inputPath, ".modelerproj")}-right-leg-mirrored`;
project.savedAt = new Date().toISOString();
writeFileSync(outputPath, `${JSON.stringify(project, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ inputPath, outputPath, clipId, sourceRootId, offset, copied }, null, 2));
