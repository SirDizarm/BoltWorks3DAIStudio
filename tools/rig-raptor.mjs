import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const sourcePath = resolve(process.argv[2] || "../raptor.bbmodel");
const outputPath = resolve(process.argv[3] || "../raptor-rigged.bbmodel");
const project = JSON.parse(readFileSync(sourcePath, "utf8").replace(/^\uFEFF/, ""));
const elements = new Map((project.elements || []).map(element => [element.uuid, element]));
const root = project.outliner?.[0];
if (!root || root.name !== "raptor") throw new Error("Expected the Raptor root group.");

function findGroup(node, name) {
  if (node && typeof node === "object" && node.name === name) return node;
  for (const child of node?.children || []) {
    if (typeof child === "object") {
      const match = findGroup(child, name);
      if (match) return match;
    }
  }
  return null;
}

function bone(uuid, name, origin, children = []) {
  return { name, origin, color: 0, uuid, export: true, isOpen: true, locked: false, visibility: true, autouv: 0, children };
}

function renameChain(start, names) {
  let current = start;
  for (const name of names) {
    if (!current || typeof current !== "object") break;
    current.name = name;
    current = (current.children || []).find(child => typeof child === "object");
  }
}

function animation(uuid, name, length, loop = "loop") {
  return { uuid, name, loop, override: false, length, snapping: 24, selected: false, anim_time_update: "", blend_weight: "", start_delay: "", loop_delay: "", animators: {} };
}

function addTrack(clip, target, channel, frames) {
  if (!target) return;
  const animator = clip.animators[target.uuid] || (clip.animators[target.uuid] = { name: target.name, type: "bone", keyframes: [] });
  for (const [time, values, interpolation = "catmullrom"] of frames) {
    animator.keyframes.push({
      channel,
      time,
      interpolation,
      data_points: [{ x: values[0], y: values[1], z: values[2] }],
      uuid: `${clip.uuid.slice(0, 8)}-${target.uuid.slice(0, 8)}-${String(animator.keyframes.length).padStart(4, "0")}`
    });
  }
}

const originalChildren = [...(root.children || [])];
const bodyId = originalChildren.find(child => typeof child === "string" && elements.get(child)?.name === "body");
const leftHip = findGroup(root, "left_leg");
const rightHip = findGroup(root, "right_leg");
const saddle = findGroup(root, "sadle");
const tailBase = findGroup(root, "tail");
const neck = findGroup(root, "neck");
const leftShoulder = findGroup(root, "left_arm");
const rightShoulder = findGroup(root, "right_arm");
if (![bodyId, leftHip, rightHip, saddle, tailBase, neck, leftShoulder, rightShoulder].every(Boolean)) throw new Error("Raptor hierarchy is incomplete.");

leftHip.name = "left_hip";
rightHip.name = "right_hip";
saddle.name = "saddle_mount";
leftShoulder.name = "left_shoulder";
rightShoulder.name = "right_shoulder";

const leftUpperChildren = [...leftHip.children];
const leftUpper = bone("bc7d11e0-6a13-4dcb-90c1-04b86b1747b0", "left_upper_leg", leftHip.origin, leftUpperChildren);
leftHip.children = [leftUpper];
const rightUpper = (rightHip.children || []).find(child => typeof child === "object");
rightUpper.name = "right_upper_leg";
renameChain(leftUpper.children.find(child => typeof child === "object"), ["left_knee", "left_ankle", "left_foot"]);
renameChain(rightUpper.children.find(child => typeof child === "object"), ["right_knee", "right_ankle", "right_foot"]);

const leftKnee = findGroup(root, "left_knee");
const rightKnee = findGroup(root, "right_knee");
const leftAnkle = findGroup(root, "left_ankle");
const rightAnkle = findGroup(root, "right_ankle");
const leftFoot = findGroup(root, "left_foot");
const rightFoot = findGroup(root, "right_foot");

function splitSickleClaw(foot, side, uuid) {
  const cubeId = (foot.children || []).filter(child => typeof child === "string").find(child => {
    const element = elements.get(child);
    return element && Math.abs(Number(element.origin?.[0]) || 0) > 4 && Math.abs((Number(element.origin?.[2]) || 0) - 12.099238587) < .01;
  });
  if (!cubeId) throw new Error(`Could not identify the ${side} sickle claw.`);
  foot.children = foot.children.filter(child => child !== cubeId);
  const element = elements.get(cubeId);
  const pivotX = side === "left" ? -4.8 : 4.8;
  const claw = bone(uuid, `${side}_sickle_claw`, [pivotX, 1.9, 13.2], [cubeId]);
  foot.children.push(claw);
  return claw;
}

const leftClaw = splitSickleClaw(leftFoot, "left", "b5eb2631-fc17-41c2-8e0f-ab62f738386d");
const rightClaw = splitSickleClaw(rightFoot, "right", "a79b61b6-e7ca-44a5-827f-bbc65eb00ddf");

const leftForearm = (leftShoulder.children || []).find(child => typeof child === "object");
const rightForearm = (rightShoulder.children || []).find(child => typeof child === "object");
leftForearm.name = "left_forearm";
rightForearm.name = "right_forearm";
leftForearm.origin = [-5, 17, -8];
rightForearm.origin = [5, 17, -8];

renameChain(tailBase, ["tail_base", "tail_02", "tail_03", "tail_04", "tail_05", "tail_06", "tail_tip"]);
const tailBones = ["tail_base", "tail_02", "tail_03", "tail_04", "tail_05", "tail_06", "tail_tip"].map(name => findGroup(root, name));
const head = findGroup(root, "head");
const jaw = findGroup(root, "jaw");
head.origin = [0, 37, -8.5];

const pelvis = bone("6bcf0eb3-d4db-4cf9-a0e3-8ac264a6b301", "pelvis_body", [0, 23, 0], [
  bodyId, saddle, leftHip, rightHip, tailBase, neck, leftShoulder, rightShoulder
]);
root.children = [pelvis];
root.isOpen = true;

const idle = animation("78214ed0-03d5-461d-9437-070a266598f0", "Idle", 2, "loop");
addTrack(idle, pelvis, "position", [[0,[0,0,0]],[1,[0,-.25,0]],[2,[0,0,0]]]);
tailBones.forEach((part, index) => addTrack(idle, part, "rotation", [[0,[0,0,0]],[.5,[0,3 + index * 1.25,0]],[1,[0,0,0]],[1.5,[0,-3 - index * 1.25,0]],[2,[0,0,0]]]));
addTrack(idle, head, "rotation", [[0,[0,-2,0]],[1,[1.5,2,0]],[2,[0,-2,0]]]);
addTrack(idle, jaw, "rotation", [[0,[0,0,0]],[.8,[-2,0,0]],[1.05,[-7,0,0]],[1.3,[0,0,0]],[2,[0,0,0]]]);
addTrack(idle, leftShoulder, "rotation", [[0,[-2,0,0]],[1,[2,0,0]],[2,[-2,0,0]]]);
addTrack(idle, rightShoulder, "rotation", [[0,[2,0,0]],[1,[-2,0,0]],[2,[2,0,0]]]);
addTrack(idle, leftClaw, "rotation", [[0,[0,0,0]],[1,[-6,0,0]],[2,[0,0,0]]]);
addTrack(idle, rightClaw, "rotation", [[0,[-6,0,0]],[1,[0,0,0]],[2,[-6,0,0]]]);

function locomotion(uuid, name, length) {
  const clip = animation(uuid, name, length, "loop");
  const times = Array.from({ length: 9 }, (_, index) => length * index / 8);
  const frames = values => times.map((time, index) => [time, values[index], "linear"]);
  const shifted = values => [...values.slice(4, 8), ...values.slice(0, 4), values[4]];
  const passingStart = values => {
    const cycle = values.slice(0, 8);
    const rephased = [...cycle.slice(2), ...cycle.slice(0, 2)];
    return [...rephased, rephased[0]];
  };
  const rotations = values => frames(values.map(value => [value, 0, 0]));

  // One full symmetrical gait: left contact -> passing -> right contact -> passing.
  // Run and Sprint reuse these poses at shorter clip lengths so speed changes
  // cannot stretch or invert the connected leg hierarchy.
  const upper = passingStart([24, 17, 0, -17, -24, -17, 0, 17, 24]);
  const knee = passingStart([-8, -6, -10, -22, -34, -38, -28, -15, -8]);
  const ankle = passingStart([4, 1, 5, 10, 13, 15, 10, 6, 4]);
  const foot = passingStart([-6, -2, 5, 10, 6, -2, -8, -10, -6]);
  const bodyBob = passingStart([0, -.35, -.7, -.35, 0, -.35, -.7, -.35, 0]);
  addTrack(clip, pelvis, "position", frames(bodyBob.map(value => [0, value, 0])));
  addTrack(clip, leftUpper, "rotation", rotations(upper));
  addTrack(clip, rightUpper, "rotation", rotations(shifted(upper)));
  addTrack(clip, leftKnee, "rotation", rotations(knee));
  addTrack(clip, rightKnee, "rotation", rotations(shifted(knee)));
  addTrack(clip, leftAnkle, "rotation", rotations(ankle));
  addTrack(clip, rightAnkle, "rotation", rotations(shifted(ankle)));
  addTrack(clip, leftFoot, "rotation", rotations(foot));
  addTrack(clip, rightFoot, "rotation", rotations(shifted(foot)));

  const tailWave = passingStart([0, .5, 1, .5, 0, -.5, -1, -.5, 0]);
  tailBones.forEach((part, index) => {
    const amplitude = 4.5 + index * .8;
    addTrack(clip, part, "rotation", frames(tailWave.map(value => [0, value * amplitude, 0])));
  });
  const neckPitch = passingStart([-1, -.5, 0, .5, 1, .5, 0, -.5, -1]);
  addTrack(clip, neck, "rotation", rotations(neckPitch));
  addTrack(clip, head, "rotation", rotations(neckPitch.map(value => -value * .6)));
  addTrack(clip, leftShoulder, "rotation", rotations(upper.map(value => -value * .18)));
  addTrack(clip, rightShoulder, "rotation", rotations(shifted(upper).map(value => -value * .18)));
  return clip;
}

const walk = locomotion("3ac70990-4255-4120-bb51-f3eb81275e2e", "Walk", 1.2);
const run = locomotion("af739c76-46b2-4cda-a83a-480196769fb4", "Run", .8);
const sprint = locomotion("27c064ae-564e-442c-bb7f-44d420471769", "Sprint", .6);

const jump = animation("5d183983-18ef-4dbd-840b-06451db3bb84", "Jump", 1, "once");
addTrack(jump, pelvis, "position", [[0,[0,0,0]],[.18,[0,-3,0]],[.42,[0,2.5,-1]],[.72,[0,1,0]],[.9,[0,-2,0]],[1,[0,0,0]],]);
for (const [upper, kneePart, anklePart, footPart, side] of [[leftUpper,leftKnee,leftAnkle,leftFoot,-1],[rightUpper,rightKnee,rightAnkle,rightFoot,1]]) {
  addTrack(jump, upper, "rotation", [[0,[0,0,0]],[.18,[-18,0,side*3]],[.42,[28,0,side*2]],[.72,[12,0,0]],[.9,[-12,0,0]],[1,[0,0,0]]]);
  addTrack(jump, kneePart, "rotation", [[0,[0,0,0]],[.18,[-45,0,0]],[.42,[-12,0,0]],[.72,[-25,0,0]],[.9,[-38,0,0]],[1,[0,0,0]]]);
  addTrack(jump, anklePart, "rotation", [[0,[0,0,0]],[.18,[20,0,0]],[.42,[6,0,0]],[.72,[14,0,0]],[.9,[20,0,0]],[1,[0,0,0]]]);
  addTrack(jump, footPart, "rotation", [[0,[0,0,0]],[.18,[12,0,0]],[.42,[-14,0,0]],[.72,[-5,0,0]],[.9,[10,0,0]],[1,[0,0,0]]]);
}
tailBones.forEach((part, index) => addTrack(jump, part, "rotation", [[0,[0,0,0]],[.18,[-8-index*2,0,0]],[.42,[10+index*2,0,0]],[.72,[5+index,0,0]],[1,[0,0,0]]]));
addTrack(jump, neck, "rotation", [[0,[0,0,0]],[.18,[-12,0,0]],[.42,[8,0,0]],[.9,[-6,0,0]],[1,[0,0,0]]]);
addTrack(jump, head, "rotation", [[0,[0,0,0]],[.18,[8,0,0]],[.42,[-5,0,0]],[.9,[4,0,0]],[1,[0,0,0]]]);

const chew = animation("d42a405f-e2f1-4cb5-991e-2031c8d1ae13", "Chew", .75, "loop");
addTrack(chew, jaw, "rotation", [[0,[0,0,0]],[.18,[-14,0,0]],[.34,[-2,0,0]],[.52,[-11,0,0]],[.75,[0,0,0]]]);
addTrack(chew, head, "rotation", [[0,[0,0,0]],[.38,[2,0,0]],[.75,[0,0,0]]]);

idle.selected = true;
project.animations = [idle, walk, run, sprint, jump, chew];
project.name = "raptor_rigged";
project.model_identifier = project.model_identifier || "raptor_rigged";
writeFileSync(outputPath, `${JSON.stringify(project)}\n`);
console.log(`Created ${outputPath} with ${project.elements.length} cuboids, a connected ${tailBones.length}-part tail, and ${project.animations.length} animation clips.`);
