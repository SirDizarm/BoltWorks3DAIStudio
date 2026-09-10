import fs from "node:fs";
import path from "node:path";

const outputPath = path.resolve("samples/assets/segmented-human-walk-cycle.modelerproj");
const groups = [{ id: "human", name: "Segmented Human Player", parentId: null }];
const objects = [];
const add = (id, name, shape, position, scale, color, boneId, rotation = [0, 0, 0]) => objects.push({ id, name, shape, position, rotation, scale, color, roughness: .72, groupId: "human", groupName: "Segmented Human Player", boneId });
const skin = "#c88d72", shirt = "#3266a8", pants = "#26364d", shoe = "#171b22", hair = "#38291f";
add("human-torso", "Torso", "capsule", [0, 1.15, 0], [.42, .62, .25], shirt, "walk-chest");
add("human-head", "Head", "sphere", [0, 1.72, 0], [.24, .28, .24], skin, "walk-head");
add("human-hair", "Hair", "sphere", [0, 1.84, .01], [.25, .14, .25], hair, "walk-head");
add("human-upper-arm-l", "Upper Arm L", "cylinder", [-.32, 1.28, 0], [.11, .32, .11], shirt, "walk-upper-arm-l", [0, 0, 90]);
add("human-forearm-l", "Forearm L", "cylinder", [-.60, 1.24, 0], [.09, .29, .09], skin, "walk-forearm-l", [0, 0, 90]);
add("human-upper-arm-r", "Upper Arm R", "cylinder", [.32, 1.28, 0], [.11, .32, .11], shirt, "walk-upper-arm-r", [0, 0, 90]);
add("human-forearm-r", "Forearm R", "cylinder", [.60, 1.24, 0], [.09, .29, .09], skin, "walk-forearm-r", [0, 0, 90]);
add("human-thigh-l", "Thigh L", "cylinder", [-.13, .82, 0], [.14, .38, .14], pants, "walk-thigh-l");
add("human-shin-l", "Shin L", "cylinder", [-.13, .42, 0], [.11, .38, .11], skin, "walk-shin-l");
add("human-foot-l", "Foot L", "box", [-.13, .10, -.06], [.20, .10, .34], shoe, "walk-foot-l");
add("human-thigh-r", "Thigh R", "cylinder", [.13, .82, 0], [.14, .38, .14], pants, "walk-thigh-r");
add("human-shin-r", "Shin R", "cylinder", [.13, .42, 0], [.11, .38, .11], skin, "walk-shin-r");
add("human-foot-r", "Foot R", "box", [.13, .10, -.06], [.20, .10, .34], shoe, "walk-foot-r");

const bones = [
  ["walk-root", "Root", [0, .08, 0], null], ["walk-spine", "Spine", [0, .82, 0], "walk-root"], ["walk-chest", "Chest", [0, 1.18, 0], "walk-spine"], ["walk-head", "Head", [0, 1.68, 0], "walk-chest"],
  ["walk-upper-arm-l", "Upper Arm L", [-.23, 1.28, 0], "walk-chest"], ["walk-forearm-l", "Forearm L", [-.55, 1.25, 0], "walk-upper-arm-l"], ["walk-upper-arm-r", "Upper Arm R", [.23, 1.28, 0], "walk-chest"], ["walk-forearm-r", "Forearm R", [.55, 1.25, 0], "walk-upper-arm-r"],
  ["walk-thigh-l", "Thigh L", [-.13, .82, 0], "walk-root"], ["walk-shin-l", "Shin L", [-.13, .42, 0], "walk-thigh-l"], ["walk-foot-l", "Foot L", [-.13, .1, 0], "walk-shin-l"], ["walk-thigh-r", "Thigh R", [.13, .82, 0], "walk-root"], ["walk-shin-r", "Shin R", [.13, .42, 0], "walk-thigh-r"], ["walk-foot-r", "Foot R", [.13, .1, 0], "walk-shin-r"]
].map(([id, name, position, parentId]) => ({ id, name, parentId, role: null, avatarObjectId: objects.find(object => object.boneId === id)?.id || null, position, rotation: [0, 0, 0] }));
const rotations = pose => bones.map(bone => ({ frame: pose.frame, position: bone.position.slice(), rotation: (pose[bone.id] || [0, 0, 0]).map(value => value * Math.PI / 180) }));
const poses = [
  { frame: 0, "walk-thigh-l": [-22, 0, 0], "walk-shin-l": [18, 0, 0], "walk-foot-l": [-8, 0, 0], "walk-thigh-r": [22, 0, 0], "walk-shin-r": [-18, 0, 0], "walk-foot-r": [8, 0, 0], "walk-upper-arm-l": [18, 0, 0], "walk-upper-arm-r": [-18, 0, 0] },
  { frame: 6 },
  { frame: 12, "walk-thigh-l": [22, 0, 0], "walk-shin-l": [-18, 0, 0], "walk-foot-l": [8, 0, 0], "walk-thigh-r": [-22, 0, 0], "walk-shin-r": [18, 0, 0], "walk-foot-r": [-8, 0, 0], "walk-upper-arm-l": [-18, 0, 0], "walk-upper-arm-r": [18, 0, 0] },
  { frame: 18 },
  { frame: 24, "walk-thigh-l": [-22, 0, 0], "walk-shin-l": [18, 0, 0], "walk-foot-l": [-8, 0, 0], "walk-thigh-r": [22, 0, 0], "walk-shin-r": [-18, 0, 0], "walk-foot-r": [8, 0, 0], "walk-upper-arm-l": [18, 0, 0], "walk-upper-arm-r": [-18, 0, 0] }
];
const keys = Object.fromEntries(bones.map(bone => [bone.id, []]));
for (const pose of poses) rotations(pose).forEach((key, index) => keys[bones[index].id].push(key));
const project = { kind: "modeler-project", version: 1, name: "segmented-human-walk-cycle", savedAt: new Date().toISOString(), textureLibrary: [], scene: { version: 1, coordinateSystem: "Y-up right-handed; front faces -Z", groups, objects }, editor: { projectName: "segmented-human-walk-cycle", selectedId: null, selectedGroupId: "human", checkedIds: [], activeGroupIds: ["human"], activeTransformMode: "move", facePickMode: false, referenceImage: { name: "", dataUrl: null, mode: "panel", opacity: .48, scale: 1, offsetX: 0, offsetY: 0 }, cameraViews: { selectedId: null, showMarkers: false, views: [] }, view: { cameraPosition: [2.4, 1.3, 3.2], orbitTarget: [0, .95, 0], cameraUp: [0, 1, 0], viewSpace: .45, shotZoom: .9, environment: "studio", background: "dark", showGrid: true }, panels: {}, toolbars: {}, tools: {}, lighting: { showGuides: false, enablePrimary: true, enableMirror: true, lampPosition: [-3, 4, -4], lampTarget: [0, 1, 0], intensity: 12, angle: 32 }, rigging: { selectedBoneId: "walk-root", showGuides: true, bones, animation: { fps: 24, end: 24, frame: 0, keys } } } };
fs.writeFileSync(outputPath, `${JSON.stringify(project, null, 2)}\n`, "utf8");
console.log(`Generated ${outputPath} with ${objects.length} bound mesh parts and ${bones.length} bones.`);
