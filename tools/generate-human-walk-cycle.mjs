import fs from "node:fs";
import path from "node:path";

const root = path.resolve(".");
const sourcePath = path.join(root, "samples", "assets", "female-t-pose-player-model.modelerproj");
const outputPath = path.join(root, "samples", "assets", "human-player-walk-cycle.modelerproj");
const project = JSON.parse(fs.readFileSync(sourcePath, "utf8"));

const bone = (id, name, position, tail, parentId = null) => ({ id, name, parentId, role: null, avatarObjectId: null, position, tail, rotation: [0, 0, 0] });
const bones = [
  bone("walk-root", "Root", [0, 0.78, 0], [0, 0.92, 0]),
  bone("walk-spine", "Spine", [0, 0.78, 0], [0, 1.12, 0], "walk-root"),
  bone("walk-chest", "Chest", [0, 1.12, 0], [0, 1.48, 0], "walk-spine"),
  bone("walk-head", "Head", [0, 1.48, 0], [0, 1.70, 0], "walk-chest"),
  bone("walk-upper-arm-l", "Upper Arm L", [-0.15, 1.31, 0], [-0.48, 1.29, 0], "walk-chest"),
  bone("walk-forearm-l", "Forearm L", [-0.48, 1.29, 0], [-0.77, 1.27, 0], "walk-upper-arm-l"),
  bone("walk-upper-arm-r", "Upper Arm R", [0.15, 1.31, 0], [0.48, 1.29, 0], "walk-chest"),
  bone("walk-forearm-r", "Forearm R", [0.48, 1.29, 0], [0.77, 1.27, 0], "walk-upper-arm-r"),
  bone("walk-thigh-l", "Thigh L", [-0.12, 0.78, 0], [-0.12, 0.43, 0], "walk-root"),
  bone("walk-shin-l", "Shin L", [-0.12, 0.43, 0], [-0.12, 0.09, 0.01], "walk-thigh-l"),
  bone("walk-foot-l", "Foot L", [-0.12, 0.09, 0.01], [-0.12, 0.05, 0.20], "walk-shin-l"),
  bone("walk-thigh-r", "Thigh R", [0.12, 0.78, 0], [0.12, 0.43, 0], "walk-root"),
  bone("walk-shin-r", "Shin R", [0.12, 0.43, 0], [0.12, 0.09, 0.01], "walk-thigh-r"),
  bone("walk-foot-r", "Foot R", [0.12, 0.09, 0.01], [0.12, 0.05, 0.20], "walk-shin-r")
];
const humanMeshId = project.scene.objects[0]?.id || null;
bones.forEach(item => { item.avatarObjectId = humanMeshId; });
const deg = value => value * Math.PI / 180;
const key = (frame, rotations = {}, lift = 0) => Object.fromEntries(bones.map(item => [item.id, {
  frame,
  position: [item.position[0], item.position[1] + lift, item.position[2]],
  rotation: (rotations[item.id] || [0, 0, 0]).map(deg)
}]));
const keys = {};
for (const item of bones) keys[item.id] = [];
for (const pose of [
  key(0, { "walk-thigh-l": [-28, 0, 0], "walk-shin-l": [5, 0, 0], "walk-foot-l": [12, 0, 0], "walk-thigh-r": [22, 0, 0], "walk-shin-r": [8, 0, 0], "walk-foot-r": [-12, 0, 0], "walk-upper-arm-l": [18, 0, 82], "walk-forearm-l": [8, 0, 0], "walk-upper-arm-r": [-18, 0, -82], "walk-forearm-r": [8, 0, 0] }),
  key(4, { "walk-thigh-l": [-18, 0, 0], "walk-shin-l": [16, 0, 0], "walk-foot-l": [4, 0, 0], "walk-thigh-r": [16, 0, 0], "walk-shin-r": [30, 0, 0], "walk-foot-r": [-18, 0, 0], "walk-upper-arm-l": [12, 0, 82], "walk-forearm-l": [10, 0, 0], "walk-upper-arm-r": [-12, 0, -82], "walk-forearm-r": [10, 0, 0] }, -.025),
  key(8, { "walk-thigh-l": [7, 0, 0], "walk-shin-l": [8, 0, 0], "walk-foot-l": [-6, 0, 0], "walk-thigh-r": [-7, 0, 0], "walk-shin-r": [55, 0, 0], "walk-foot-r": [-30, 0, 0], "walk-upper-arm-l": [-4, 0, 82], "walk-forearm-l": [12, 0, 0], "walk-upper-arm-r": [4, 0, -82], "walk-forearm-r": [12, 0, 0] }, .015),
  key(12, { "walk-thigh-l": [22, 0, 0], "walk-shin-l": [8, 0, 0], "walk-foot-l": [-12, 0, 0], "walk-thigh-r": [-28, 0, 0], "walk-shin-r": [5, 0, 0], "walk-foot-r": [12, 0, 0], "walk-upper-arm-l": [-18, 0, 82], "walk-forearm-l": [8, 0, 0], "walk-upper-arm-r": [18, 0, -82], "walk-forearm-r": [8, 0, 0] }),
  key(16, { "walk-thigh-l": [16, 0, 0], "walk-shin-l": [30, 0, 0], "walk-foot-l": [-18, 0, 0], "walk-thigh-r": [-18, 0, 0], "walk-shin-r": [16, 0, 0], "walk-foot-r": [4, 0, 0], "walk-upper-arm-l": [-12, 0, 82], "walk-forearm-l": [10, 0, 0], "walk-upper-arm-r": [12, 0, -82], "walk-forearm-r": [10, 0, 0] }, -.025),
  key(20, { "walk-thigh-l": [-7, 0, 0], "walk-shin-l": [55, 0, 0], "walk-foot-l": [-30, 0, 0], "walk-thigh-r": [7, 0, 0], "walk-shin-r": [8, 0, 0], "walk-foot-r": [-6, 0, 0], "walk-upper-arm-l": [4, 0, 82], "walk-forearm-l": [12, 0, 0], "walk-upper-arm-r": [-4, 0, -82], "walk-forearm-r": [12, 0, 0] }, .015),
  key(24, { "walk-thigh-l": [-28, 0, 0], "walk-shin-l": [5, 0, 0], "walk-foot-l": [12, 0, 0], "walk-thigh-r": [22, 0, 0], "walk-shin-r": [8, 0, 0], "walk-foot-r": [-12, 0, 0], "walk-upper-arm-l": [18, 0, 82], "walk-forearm-l": [8, 0, 0], "walk-upper-arm-r": [-18, 0, -82], "walk-forearm-r": [8, 0, 0] })
]) for (const [id, item] of Object.entries(pose)) keys[id].push(item);

project.name = "human-player-walk-cycle";
project.editor.projectName = project.name;
project.editor.rigging = { selectedBoneId: "walk-root", showGuides: true, bones, animation: { fps: 24, end: 24, frame: 0, keys } };
project.editor.view = { ...(project.editor.view || {}), cameraPosition: [2.5, 1.25, 3.4], orbitTarget: [0, 0.9, 0], viewSpace: 0.45, shotZoom: 0.9 };
fs.writeFileSync(outputPath, `${JSON.stringify(project, null, 2)}\n`, "utf8");
console.log(`Generated ${outputPath} with ${bones.length} bones and a 24-frame walk cycle.`);
