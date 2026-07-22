import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const sourceProject = JSON.parse(readFileSync(join(root, "samples", "showcases", "mosswood-medieval-cottage.modelerproj"), "utf8"));
const wantedTextures = new Set(["Mossy Fieldstone", "Mossy Terracotta Roof"]);
const textureLibrary = sourceProject.textureLibrary.filter(entry => wantedTextures.has(entry.name));

const objects = [];
let objectSerial = 0;
const groupNames = new Map();

const groups = [
  ["blackstone-manor", "Blackstone Timber Manor", null],
  ["foundation", "Masonry Foundation", "blackstone-manor"],
  ["stonework", "Individual Fieldstones", "foundation"],
  ["upper-storey", "Upper Storey", "blackstone-manor"],
  ["plaster", "Aged Plaster Infill", "upper-storey"],
  ["timber", "Heavy Timber Frame", "upper-storey"],
  ["windows", "Leaded Windows", "blackstone-manor"],
  ["doors", "Doors and Ironwork", "blackstone-manor"],
  ["roof", "Shingled Gable Roof", "blackstone-manor"],
  ["chimney", "Stone Chimney", "blackstone-manor"],
  ["stairs", "Exterior Thresholds", "blackstone-manor"],
  ["interior", "Interior Staircase and Railings", "blackstone-manor"],
  ["furnishings", "Interior Furniture and Props", "blackstone-manor"],
  ["basement-furnishings", "Basement Furniture", "furnishings"],
  ["lighting-fixtures", "Lamp and Torch Fixtures", "furnishings"],
  ["details", "Architectural Details", "blackstone-manor"]
].map(([id, name, parentId]) => {
  groupNames.set(id, name);
  return { id, name, parentId };
});

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function add(name, shape, position, scale, color, groupId, options = {}) {
  const id = `${slug(name)}-${String(++objectSerial).padStart(3, "0")}`;
  const object = {
    id,
    name,
    shape,
    position: position.map(value => Number(value.toFixed(4))),
    rotation: (options.rotation || [0, 0, 0]).map(value => Number(value.toFixed(4))),
    scale: scale.map(value => Number(value.toFixed(4))),
    color,
    roughness: options.roughness ?? 0.88,
    hidden: false,
    groupId,
    groupName: groupNames.get(groupId),
    materialRule: "auto"
  };
  if (options.textureName) {
    object.textureName = options.textureName;
    object.textureUrl = null;
    object.textureFlipY = options.textureFlipY ?? true;
    object.textureRotation = options.textureRotation ?? 0;
    object.textureRobloxAssetId = "";
  }
  if (Number.isFinite(options.opacity)) object.opacity = Math.max(0.05, Math.min(1, Number(options.opacity)));
  objects.push(object);
  return object;
}

function box(name, position, scale, color, groupId, options = {}) {
  return add(name, "box", position, scale, color, groupId, options);
}

function beamFront(name, a, b, z, thickness = 0.18, depth = 0.2, groupId = "timber") {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length = Math.hypot(dx, dy);
  const rotationZ = Math.atan2(-dx, dy) * 180 / Math.PI;
  return box(name, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z], [thickness, length, depth], "#34251f", groupId, { rotation: [0, 0, rotationZ], roughness: 0.94 });
}

function beamSide(name, a, b, x, thickness = 0.18, depth = 0.2, groupId = "timber") {
  const dz = b[0] - a[0];
  const dy = b[1] - a[1];
  const length = Math.hypot(dz, dy);
  const rotationX = Math.atan2(dz, dy) * 180 / Math.PI;
  return box(name, [x, (a[1] + b[1]) / 2, (a[0] + b[0]) / 2], [depth, length, thickness], "#34251f", groupId, { rotation: [rotationX, 0, 0], roughness: 0.94 });
}

const stoneColors = ["#77756f", "#686963", "#85827a", "#5f625e", "#74716a"];
const timber = "#34251f";
const plaster = "#b8b4a8";
const glass = "#13242a";
const iron = "#17191a";

box("Basement flagstone floor", [0, 0.05, 0], [7.55, 0.1, 4.75], "#4d504d", "foundation", { roughness: 1, textureName: "Mossy Fieldstone", textureFlipY: true, textureRotation: 0 });

function buildBasementBacking(sideName, z, doorX) {
  const min = -3.62;
  const max = 3.62;
  const gapLeft = doorX - 0.88;
  const gapRight = doorX + 0.88;
  box(`${sideName} inner basement wall left`, [(min + gapLeft) / 2, 1.4, z], [gapLeft - min, 2.65, 0.1], "#575955", "foundation", { roughness: 1, textureName: "Mossy Fieldstone", textureFlipY: true, textureRotation: 0 });
  box(`${sideName} inner basement wall right`, [(gapRight + max) / 2, 1.4, z], [max - gapRight, 2.65, 0.1], "#575955", "foundation", { roughness: 1, textureName: "Mossy Fieldstone", textureFlipY: true, textureRotation: 180 });
}

buildBasementBacking("Front", 2.33, 0);
buildBasementBacking("Rear", -2.33, 2.25);
box("Left inner basement wall", [-3.63, 1.4, 0], [0.1, 2.65, 4.65], "#575955", "foundation", { roughness: 1, textureName: "Mossy Fieldstone", textureFlipY: true, textureRotation: 90 });
box("Right inner basement wall", [3.63, 1.4, 0], [0.1, 2.65, 4.65], "#575955", "foundation", { roughness: 1, textureName: "Mossy Fieldstone", textureFlipY: true, textureRotation: 90 });

function packedStoneSpans(start, end, targetWidth = 0.76, mortar = 0.035) {
  const length = end - start;
  if (length <= 0.08) return [];
  const count = Math.max(1, Math.ceil((length + mortar) / (targetWidth + mortar)));
  const width = (length - mortar * (count - 1)) / count;
  return Array.from({ length: count }, (_, index) => {
    const left = start + index * (width + mortar);
    return { center: left + width / 2, width };
  });
}

function buildLongStoneWall(sideName, z, rear = false) {
  const doorX = rear ? 2.25 : 0;
  const gapLeft = doorX - 0.78;
  const gapRight = doorX + 0.78;
  const leftHalfWidth = Math.min(0.38, gapLeft + 3.35);
  const rightHalfWidth = Math.min(0.38, 3.35 - gapRight);
  for (let row = 0; row < 6; row++) {
    const y = 0.3 + row * 0.46;
    const height = row % 3 === 1 ? 0.42 : 0.4;
    const targetWidth = row % 2 ? 0.7 : 0.78;
    const spans = [
      ...packedStoneSpans(-3.35, gapLeft - leftHalfWidth - 0.035, targetWidth),
      { center: gapLeft - leftHalfWidth / 2, width: leftHalfWidth, closure: "left" },
      { center: gapRight + rightHalfWidth / 2, width: rightHalfWidth, closure: "right" },
      ...packedStoneSpans(gapRight + rightHalfWidth + 0.035, 3.35, targetWidth)
    ];
    spans.forEach((span, index) => {
      const closureDepth = span.closure ? 0.68 : 0.42;
      const closureZ = span.closure ? z - Math.sign(z) * 0.12 : z;
      add(span.closure ? `${sideName} door ${span.closure} half stone row ${row + 1}` : `${sideName} fieldstone row ${row + 1} block ${index + 1}`, "box", [span.center, y, closureZ], [span.width, height, closureDepth], stoneColors[(row * 3 + index + (rear ? 2 : 0)) % stoneColors.length], "stonework", {
        roughness: 1,
        textureName: "Mossy Fieldstone",
        textureFlipY: row % 2 === 0,
        textureRotation: row % 2 ? 180 : 0
      });
    });
  }
}

function buildSideStoneWall(sideName, x) {
  for (let row = 0; row < 6; row++) {
    const y = 0.3 + row * 0.46;
    const height = row % 3 === 2 ? 0.42 : 0.4;
    const spans = packedStoneSpans(-2.04, 2.04, row % 2 ? 0.69 : 0.78);
    spans.forEach((span, index) => {
      add(`${sideName} fieldstone row ${row + 1} block ${index + 1}`, "box", [x, y, span.center], [0.42, height, span.width], stoneColors[(row * 2 + index + 15) % stoneColors.length], "stonework", {
        roughness: 1,
        textureName: "Mossy Fieldstone",
        textureFlipY: row % 2 === 0,
        textureRotation: row % 2 ? 270 : 90
      });
    });
  }
}

buildLongStoneWall("Front", 2.56, false);
buildLongStoneWall("Rear", -2.56, true);
buildSideStoneWall("Left gable", -3.86);
buildSideStoneWall("Right gable", 3.86);

// Alternating quoin blocks close the seams where the independently laid walls meet.
for (const xSign of [-1, 1]) {
  for (const zSign of [-1, 1]) {
    for (let row = 0; row < 6; row++) {
      const y = 0.3 + row * 0.46;
      const alongX = row % 2 === 0;
      box(`Corner quoin ${xSign} ${zSign} row ${row + 1}`, [xSign * 3.72, y, zSign * 2.42], alongX ? [0.72, 0.43, 0.54] : [0.54, 0.43, 0.72], stoneColors[(row + (xSign > 0 ? 1 : 0) + (zSign > 0 ? 2 : 0)) % stoneColors.length], "stonework", {
        roughness: 1,
        textureName: "Mossy Fieldstone",
        textureFlipY: true,
        textureRotation: alongX ? 0 : 90
      });
    }
  }
}

function buildLongPlasterLayers(sideName, sign, color, openings) {
  const wallMin = -3.825;
  const wallMax = 3.825;
  const bottom = Math.min(...openings.map(opening => opening.y - opening.height / 2));
  const top = Math.max(...openings.map(opening => opening.y + opening.height / 2));
  const layers = [
    { label: "outer", z: sign * 2.5 },
    { label: "inner", z: sign * 2.3 }
  ];
  for (const layer of layers) {
    box(`${sideName} ${layer.label} plaster below windows`, [0, (3.1 + bottom) / 2, layer.z], [7.65, bottom - 3.1, 0.12], color, "plaster", { roughness: 0.96 });
    box(`${sideName} ${layer.label} plaster above windows`, [0, (top + 6) / 2, layer.z], [7.65, 6 - top, 0.12], color, "plaster", { roughness: 0.96 });
    let cursor = wallMin;
    for (const opening of [...openings].sort((a, b) => a.x - b.x)) {
      const left = opening.x - opening.width / 2;
      if (left > cursor) box(`${sideName} ${layer.label} plaster pier ${cursor.toFixed(2)}`, [(cursor + left) / 2, (bottom + top) / 2, layer.z], [left - cursor, top - bottom, 0.12], color, "plaster", { roughness: 0.96 });
      cursor = opening.x + opening.width / 2;
    }
    if (cursor < wallMax) box(`${sideName} ${layer.label} plaster pier end`, [(cursor + wallMax) / 2, (bottom + top) / 2, layer.z], [wallMax - cursor, top - bottom, 0.12], color, "plaster", { roughness: 0.96 });
  }
}

function buildSidePlasterLayers(sideName, sign, color, opening) {
  const wallMin = -2.375;
  const wallMax = 2.375;
  const bottom = opening.y - opening.height / 2;
  const top = opening.y + opening.height / 2;
  const layers = [
    { label: "outer", x: sign * 3.82 },
    { label: "inner", x: sign * 3.6 }
  ];
  for (const layer of layers) {
    box(`${sideName} ${layer.label} plaster below window`, [layer.x, (3.1 + bottom) / 2, 0], [0.12, bottom - 3.1, 4.75], color, "plaster", { roughness: 0.96 });
    box(`${sideName} ${layer.label} plaster above window`, [layer.x, (top + 6) / 2, 0], [0.12, 6 - top, 4.75], color, "plaster", { roughness: 0.96 });
    const rearEdge = opening.z - opening.width / 2;
    const frontEdge = opening.z + opening.width / 2;
    box(`${sideName} ${layer.label} rear plaster pier`, [layer.x, (bottom + top) / 2, (wallMin + rearEdge) / 2], [0.12, top - bottom, rearEdge - wallMin], color, "plaster", { roughness: 0.96 });
    box(`${sideName} ${layer.label} front plaster pier`, [layer.x, (bottom + top) / 2, (frontEdge + wallMax) / 2], [0.12, top - bottom, wallMax - frontEdge], color, "plaster", { roughness: 0.96 });
  }
}

buildLongPlasterLayers("Front", 1, plaster, [
  { x: -2.25, y: 4.72, width: 0.92, height: 1.28 },
  { x: 0, y: 4.72, width: 0.92, height: 1.28 },
  { x: 2.25, y: 4.72, width: 0.92, height: 1.28 }
]);
buildLongPlasterLayers("Rear", -1, "#aaa99f", [
  { x: -2.1, y: 4.72, width: 0.86, height: 1.22 },
  { x: 0.15, y: 4.72, width: 0.86, height: 1.22 },
  { x: 2.4, y: 4.72, width: 0.86, height: 1.22 }
]);
buildSidePlasterLayers("Left", -1, "#b0ada3", { z: 0, y: 4.78, width: 1.55, height: 1.32 });
buildSidePlasterLayers("Right", 1, plaster, { z: 0.2, y: 4.8, width: 1.0, height: 1.26 });

for (const x of [-3.72, -1.3, 1.3, 3.72]) {
  box(`Front vertical timber ${x}`, [x, 4.55, 2.64], [0.2, 3.05, 0.23], timber, "timber", { roughness: 0.95 });
}
for (const x of [-3.72, -1.2, 1.35, 3.72]) {
  box(`Rear vertical timber ${x}`, [x, 4.55, -2.64], [0.2, 3.05, 0.23], timber, "timber", { roughness: 0.95 });
}
for (const y of [3.03, 3.82, 5.62, 6.04]) {
  box(`Front horizontal timber ${y}`, [0, y, 2.66], [7.9, 0.2, 0.25], timber, "timber", { roughness: 0.95 });
  box(`Rear horizontal timber ${y}`, [0, y, -2.66], [7.9, 0.2, 0.25], timber, "timber", { roughness: 0.95 });
}

for (const x of [-3.88, 3.88]) {
  for (const z of [-2.28, -1.14, 1.14, 2.28]) {
    box(`${x < 0 ? "Left" : "Right"} gable vertical timber ${z}`, [x, 4.55, z], [0.24, 3.05, 0.19], timber, "timber", { roughness: 0.95 });
  }
  for (const y of [3.03, 3.85, 5.65, 6.04]) {
    box(`${x < 0 ? "Left" : "Right"} gable horizontal timber ${y}`, [x, y, 0], [0.25, 0.2, 4.95], timber, "timber", { roughness: 0.95 });
  }
}

// Heavy corner posts bind both wall planes into visible traditional house "knots".
for (const x of [-3.9, 3.9]) {
  for (const z of [-2.64, 2.64]) {
    box(`Upper storey corner post ${x} ${z}`, [x, 4.55, z], [0.34, 3.12, 0.34], timber, "timber", { roughness: 0.97 });
  }
}

// Diagonal braces only appear as complete X assemblies inside closed timber bays.
for (const wallX of [-3.93, 3.93]) {
  const sideName = wallX < 0 ? "Left" : "Right";
  for (const [bayName, rearZ, frontZ] of [["rear", -2.4, -1.02], ["front", 1.02, 2.4]]) {
    beamSide(`${sideName} ${bayName} framed brace rising`, [rearZ, 2.88], [frontZ, 5.8], wallX);
    beamSide(`${sideName} ${bayName} framed brace falling`, [frontZ, 2.88], [rearZ, 5.8], wallX);
  }
}

add("Left gable plaster half rear", "wedge", [-3.77, 7.49, -1.3], [2.6, 2.9, 0.23], plaster, "plaster", { rotation: [0, -90, 0], roughness: 0.96 });
add("Left gable plaster half front", "wedge", [-3.77, 7.49, 1.3], [2.6, 2.9, 0.23], plaster, "plaster", { rotation: [0, 90, 0], roughness: 0.96 });
add("Right gable plaster half rear", "wedge", [3.77, 7.49, -1.3], [2.6, 2.9, 0.23], "#aaa99f", "plaster", { rotation: [0, -90, 0], roughness: 0.96 });
add("Right gable plaster half front", "wedge", [3.77, 7.49, 1.3], [2.6, 2.9, 0.23], "#aaa99f", "plaster", { rotation: [0, 90, 0], roughness: 0.96 });

for (const x of [-3.93, 3.93]) {
  beamSide(`${x < 0 ? "Left" : "Right"} rear gable rafter`, [-2.72, 6.05], [0, 9.02], x, 0.2, 0.25);
  beamSide(`${x < 0 ? "Left" : "Right"} front gable rafter`, [0, 9.02], [2.72, 6.05], x, 0.2, 0.25);
  box(`${x < 0 ? "Left" : "Right"} gable tie beam`, [x, 6.14, 0], [0.26, 0.22, 5.55], timber, "timber", { roughness: 0.95 });
  box(`${x < 0 ? "Left" : "Right"} gable king post`, [x, 7.5, 0], [0.26, 2.72, 0.22], timber, "timber", { roughness: 0.95 });
}

function addFrontWindow(name, x, y, z, width = 0.82, height = 1.15, sideRotation = 0) {
  const side = Math.abs(sideRotation) === 90;
  const wallSign = side ? Math.sign(x) : Math.sign(z);
  const glassPosition = side
    ? [wallSign * 3.71, y, z]
    : [x, y, wallSign * 2.41];
  const glassWidth = width + 0.08;
  const glassHeight = height + 0.12;
  const glassDepth = 0.5;
  const glassScale = side ? [glassDepth, glassHeight, glassWidth] : [glassWidth, glassHeight, glassDepth];
  add(`${name} transparent leaded glass`, "box", glassPosition, glassScale, "#24444c", "windows", { roughness: 0.18, opacity: 0.38 });
  if (!side) {
    const frameZ = wallSign * 2.43;
    const frameDepth = 0.66;
    const glassFace = glassPosition[2] + wallSign * (glassDepth / 2 + 0.018);
    box(`${name} left jamb`, [x - width / 2 - 0.1, y, frameZ], [0.22, height + 0.38, frameDepth], timber, "windows");
    box(`${name} right jamb`, [x + width / 2 + 0.1, y, frameZ], [0.22, height + 0.38, frameDepth], timber, "windows");
    box(`${name} lintel`, [x, y + height / 2 + 0.15, frameZ], [width + 0.48, 0.22, frameDepth], timber, "windows");
    box(`${name} sill`, [x, y - height / 2 - 0.15, frameZ], [width + 0.48, 0.22, frameDepth], timber, "windows");
    box(`${name} center lead`, [x, y, glassFace], [0.035, height, 0.036], iron, "windows", { roughness: 0.55 });
    beamFront(`${name} lattice one`, [x - width / 2, y - height / 2], [x + width / 2, y + height / 2], glassFace, 0.035, 0.036, "windows");
    beamFront(`${name} lattice two`, [x + width / 2, y - height / 2], [x - width / 2, y + height / 2], glassFace, 0.035, 0.036, "windows");
  } else {
    const frameX = wallSign * 3.71;
    const frameDepth = 0.66;
    const glassFace = glassPosition[0] + wallSign * (glassDepth / 2 + 0.018);
    box(`${name} rear jamb`, [frameX, y, z - width / 2 - 0.1], [frameDepth, height + 0.38, 0.22], timber, "windows");
    box(`${name} front jamb`, [frameX, y, z + width / 2 + 0.1], [frameDepth, height + 0.38, 0.22], timber, "windows");
    box(`${name} lintel`, [frameX, y + height / 2 + 0.15, z], [frameDepth, 0.22, width + 0.48], timber, "windows");
    box(`${name} sill`, [frameX, y - height / 2 - 0.15, z], [frameDepth, 0.22, width + 0.48], timber, "windows");
    box(`${name} center lead`, [glassFace, y, z], [0.036, height, 0.035], iron, "windows", { roughness: 0.55 });
    beamSide(`${name} lattice one`, [z - width / 2, y - height / 2], [z + width / 2, y + height / 2], glassFace, 0.035, 0.036, "windows");
    beamSide(`${name} lattice two`, [z + width / 2, y - height / 2], [z - width / 2, y + height / 2], glassFace, 0.035, 0.036, "windows");
  }
}

for (const x of [-2.25, 0, 2.25]) addFrontWindow(`Front upper window ${x}`, x, 4.72, 2.76, 0.82, 1.18, 0);
for (const x of [-2.1, 0.15, 2.4]) addFrontWindow(`Rear upper window ${x}`, x, 4.72, -2.76, 0.76, 1.12, 180);
addFrontWindow("Left gable triple window", -4.04, 4.78, 0, 1.45, 1.22, -90);
addFrontWindow("Right gable upper window", 4.04, 4.8, 0.2, 0.9, 1.16, 90);

function addDoor(name, x, z, facing = "front") {
  const rear = facing === "rear";
  const sign = rear ? -1 : 1;
  const innerZ = z - sign * 0.17;
  box(`${name} dark recess`, [x, 1.43, z], [1.22, 2.35, 0.24], "#161719", "doors", { roughness: 1 });
  add(`${name} oak slab`, "panel", [x, 1.43, z + sign * 0.16], [1.08, 2.2, 1], "#4a3327", "doors", { rotation: [0, rear ? 180 : 0, 0], roughness: 0.92 });
  for (const offset of [-0.34, 0, 0.34]) box(`${name} plank ${offset}`, [x + offset, 1.43, z + sign * 0.215], [0.035, 2.1, 0.04], "#2d211c", "doors", { roughness: 0.95 });
  box(`${name} left jamb`, [x - 0.67, 1.48, z + sign * 0.19], [0.2, 2.55, 0.23], timber, "doors");
  box(`${name} right jamb`, [x + 0.67, 1.48, z + sign * 0.19], [0.2, 2.55, 0.23], timber, "doors");
  box(`${name} lintel`, [x, 2.77, z + sign * 0.19], [1.55, 0.22, 0.23], timber, "doors");
  for (const y of [0.9, 1.92]) box(`${name} iron strap ${y}`, [x - 0.15, y, z + sign * 0.245], [0.68, 0.07, 0.045], iron, "doors", { roughness: 0.45 });
  add(`${name} ring handle`, "torus", [x + 0.33, 1.45, z + sign * 0.28], [0.18, 0.18, 0.18], iron, "doors", { rotation: [0, rear ? 180 : 0, 0], roughness: 0.35 });

  add(`${name} interior oak face`, "panel", [x, 1.43, innerZ], [1.08, 2.2, 1], "#4a3327", "doors", { rotation: [0, rear ? 0 : 180, 0], roughness: 0.92 });
  for (const offset of [-0.34, 0, 0.34]) box(`${name} interior plank ${offset}`, [x + offset, 1.43, innerZ - sign * 0.035], [0.035, 2.1, 0.035], "#2d211c", "doors", { roughness: 0.95 });
  box(`${name} interior left jamb`, [x - 0.67, 1.48, z - sign * 0.2], [0.2, 2.55, 0.24], timber, "doors");
  box(`${name} interior right jamb`, [x + 0.67, 1.48, z - sign * 0.2], [0.2, 2.55, 0.24], timber, "doors");
  box(`${name} interior lintel`, [x, 2.77, z - sign * 0.2], [1.55, 0.22, 0.24], timber, "doors");
  for (const y of [0.9, 1.92]) box(`${name} interior iron strap ${y}`, [x + 0.15, y, innerZ - sign * 0.065], [0.68, 0.07, 0.04], iron, "doors", { roughness: 0.45 });
  add(`${name} interior ring handle`, "torus", [x - 0.33, 1.45, innerZ - sign * 0.09], [0.18, 0.18, 0.18], iron, "doors", { rotation: [0, rear ? 0 : 180, 0], roughness: 0.35 });
}

addDoor("Front entry door", 0, 2.68, "front");
addDoor("Rear service door", 2.25, -2.68, "rear");

for (const x of [-3.55, -2.75, -1.95, -1.15, -0.35, 0.45, 1.25, 2.05, 2.85, 3.65]) {
  box(`Front exposed floor joist ${x}`, [x, 2.91, 2.79], [0.18, 0.22, 0.55], timber, "details", { roughness: 0.96 });
  box(`Rear exposed floor joist ${x}`, [x, 2.91, -2.79], [0.18, 0.22, 0.55], timber, "details", { roughness: 0.96 });
}

// The floor stops at the stairwell, with a clear walk-on opening at the front end.
box("Upper floor main deck", [0.6, 2.88, 0], [5.9, 0.16, 4.4], "#4b3528", "interior", { roughness: 0.95 });
box("Upper floor stair entry deck", [-2.95, 2.88, 1.9], [1.2, 0.16, 0.5], "#4b3528", "interior", { roughness: 0.95 });

// Upper flight follows the left wall, descending from the open front entry to the rear corner.
for (let step = 0; step < 7; step++) {
  const top = 2.78 - step * 0.23;
  const z = 1.43 - step * 0.48;
  box(`Interior upper flight tread ${step + 1}`, [-2.95, (0.1 + top) / 2, z], [1.02, top - 0.1, 0.52], "#563b2a", "interior", { roughness: 0.94 });
}
box("Interior L stair turning landing", [-2.95, 0.7, -1.78], [1.08, 1.2, 0.72], "#563b2a", "interior", { roughness: 0.94 });

// Lower flight turns right and remains tight against the rear wall.
for (let step = 0; step < 6; step++) {
  const top = 1.18 - step * 0.18;
  const x = -2.52 + step * 0.4;
  box(`Interior lower flight tread ${step + 1}`, [x, (0.1 + top) / 2, -1.78], [0.46, top - 0.1, 1.02], "#563b2a", "interior", { roughness: 0.94 });
}

// Guard the long edge but leave the top 0.7 metres completely open for walking onto the stairs.
for (const z of [-1.42, -0.72, -0.02, 0.62]) box(`Upper stairwell guard post ${z}`, [-2.35, 3.38, z], [0.12, 0.88, 0.12], timber, "interior", { roughness: 0.95 });
box("Upper stairwell guard handrail", [-2.35, 3.79, -0.4], [0.14, 0.14, 2.18], timber, "interior", { roughness: 0.95 });

for (const z of [0.98, 0.26, -0.46, -1.16]) {
  const progress = (1.43 - z) / 2.88;
  const stepTop = 2.78 - progress * 1.38;
  box(`Upper flight railing post ${z}`, [-2.4, stepTop + 0.43, z], [0.1, 0.86, 0.1], timber, "interior", { roughness: 0.95 });
}
beamSide("Upper flight sloping handrail", [1.05, 3.5], [-1.38, 2.16], -2.4, 0.12, 0.12, "interior");
for (const x of [-2.45, -1.8, -1.15, -0.52]) {
  const progress = (x + 2.45) / 1.93;
  const stepTop = 1.18 - progress * 0.9;
  box(`Lower flight railing post ${x}`, [x, stepTop + 0.43, -1.18], [0.1, 0.86, 0.1], timber, "interior", { roughness: 0.95 });
}
beamFront("Lower flight sloping handrail", [-2.5, 2.0], [-0.45, 1.02], -1.18, 0.12, 0.12, "interior");

// Retained as an optional showcase set, disabled for the clean architectural house layout.
if (false) {
// Upper-storey furniture: a usable dining/work table, chairs, a stocked bookcase and a storage chest.
box("Upper oak table top", [0.75, 3.72, 0.45], [1.75, 0.16, 1.05], "#5a3d2b", "upper-furnishings", { roughness: 0.94 });
for (const x of [0.08, 1.42]) {
  for (const z of [0.07, 0.83]) {
    box(`Upper oak table leg ${x} ${z}`, [x, 3.36, z], [0.14, 0.64, 0.14], "#3f2b21", "upper-furnishings", { roughness: 0.96 });
  }
}

function addUpperChair(name, x, z, backZ) {
  box(`${name} seat`, [x, 3.42, z], [0.58, 0.12, 0.58], "#4d3426", "upper-furnishings", { roughness: 0.95 });
  for (const dx of [-0.22, 0.22]) {
    for (const dz of [-0.22, 0.22]) {
      box(`${name} leg ${dx} ${dz}`, [x + dx, 3.2, z + dz], [0.09, 0.42, 0.09], "#34251f", "upper-furnishings", { roughness: 0.96 });
    }
  }
  box(`${name} back left`, [x - 0.23, 3.82, backZ], [0.09, 0.88, 0.1], "#34251f", "upper-furnishings", { roughness: 0.96 });
  box(`${name} back right`, [x + 0.23, 3.82, backZ], [0.09, 0.88, 0.1], "#34251f", "upper-furnishings", { roughness: 0.96 });
  box(`${name} back rail`, [x, 4.02, backZ], [0.55, 0.12, 0.11], "#4d3426", "upper-furnishings", { roughness: 0.95 });
}

addUpperChair("Front table chair", 0.75, 1.35, 1.58);
addUpperChair("Rear table chair", 0.75, -0.45, -0.68);

box("Upper bookcase back", [0.55, 4.12, -2.17], [1.88, 2.12, 0.1], "#2f211b", "upper-furnishings", { roughness: 0.97 });
box("Upper bookcase left stile", [-0.36, 4.12, -2.08], [0.16, 2.18, 0.34], "#493124", "upper-furnishings", { roughness: 0.96 });
box("Upper bookcase right stile", [1.46, 4.12, -2.08], [0.16, 2.18, 0.34], "#493124", "upper-furnishings", { roughness: 0.96 });
for (const y of [3.08, 3.58, 4.08, 4.58, 5.08]) {
  box(`Upper bookcase shelf ${y}`, [0.55, y, -2.05], [1.92, 0.12, 0.4], "#523829", "upper-furnishings", { roughness: 0.95 });
}
const bookColors = ["#6d2f2d", "#31506d", "#736238", "#3f6044", "#6b4a71", "#8a6337"];
let bookIndex = 0;
for (const shelfY of [3.84, 4.34, 4.84]) {
  for (const bookX of [-0.2, 0.02, 0.25, 0.49, 0.73, 0.98, 1.2]) {
    const height = 0.27 + ((bookIndex * 7) % 5) * 0.035;
    box(`Upper book ${++bookIndex}`, [bookX, shelfY - (0.36 - height) / 2, -1.99], [0.14, height, 0.22], bookColors[bookIndex % bookColors.length], "upper-furnishings", { roughness: 0.82 });
  }
}
box("Upper storage chest body", [2.55, 3.38, 1.55], [1.15, 0.66, 0.65], "#4d3325", "upper-furnishings", { roughness: 0.96 });
box("Upper storage chest lid", [2.55, 3.75, 1.55], [1.23, 0.12, 0.72], "#62432f", "upper-furnishings", { roughness: 0.94 });
box("Upper storage chest iron band left", [2.2, 3.43, 1.88], [0.08, 0.72, 0.04], iron, "upper-furnishings", { roughness: 0.45 });
box("Upper storage chest iron band right", [2.9, 3.43, 1.88], [0.08, 0.72, 0.04], iron, "upper-furnishings", { roughness: 0.45 });

// Basement workshop and storage, kept clear of both doors and the L-stair circulation path.
box("Basement workbench top", [2.55, 0.9, 0.55], [1.65, 0.17, 0.78], "#4b3327", "basement-furnishings", { roughness: 0.97 });
for (const x of [1.9, 3.2]) {
  for (const z of [0.28, 0.82]) {
    box(`Basement workbench leg ${x} ${z}`, [x, 0.48, z], [0.16, 0.82, 0.16], "#34251f", "basement-furnishings", { roughness: 0.97 });
  }
}
box("Basement workbench lower brace", [2.55, 0.42, 0.55], [1.42, 0.13, 0.55], "#3d2a21", "basement-furnishings", { roughness: 0.97 });
box("Basement tool chest", [1.25, 0.43, 0.78], [0.82, 0.66, 0.66], "#4a3024", "basement-furnishings", { roughness: 0.96 });
box("Basement tool chest lid", [1.25, 0.79, 0.78], [0.9, 0.12, 0.72], "#63432d", "basement-furnishings", { roughness: 0.94 });

function addBarrel(name, x, z, height = 1.02, radius = 0.5) {
  add(`${name} staves`, "cylinder", [x, 0.1 + height / 2, z], [radius, height, radius], "#65452f", "basement-furnishings", { roughness: 0.94 });
  for (const y of [0.2, 0.1 + height / 2, height]) {
    add(`${name} iron hoop ${y}`, "torus", [x, y, z], [radius * 1.04, 0.08, radius * 1.04], iron, "basement-furnishings", { roughness: 0.42 });
  }
}

addBarrel("Rear cellar barrel", 1.0, -1.7, 1.05, 0.52);
addBarrel("Right cellar barrel", 2.15, -1.35, 0.9, 0.46);
box("Cellar supply crate", [0.05, 0.43, -1.65], [0.78, 0.66, 0.72], "#5a402d", "basement-furnishings", { roughness: 0.97 });
box("Cellar supply crate cross rail", [0.05, 0.43, -1.285], [0.68, 0.1, 0.045], "#2f251f", "basement-furnishings", { roughness: 0.96 });
add("Cellar grain sack one", "sphere", [0.15, 0.35, -0.7], [0.48, 0.62, 0.42], "#867b63", "basement-furnishings", { roughness: 1 });
add("Cellar grain sack two", "sphere", [0.72, 0.3, -0.62], [0.42, 0.54, 0.38], "#746b58", "basement-furnishings", { roughness: 1 });

box("Cellar wall shelf left support", [3.34, 1.25, -0.45], [0.22, 2.25, 0.18], "#34251f", "basement-furnishings", { roughness: 0.97 });
box("Cellar wall shelf right support", [3.34, 1.25, 1.25], [0.22, 2.25, 0.18], "#34251f", "basement-furnishings", { roughness: 0.97 });
for (const y of [0.5, 1.18, 1.86]) {
  box(`Cellar wall shelf ${y}`, [3.18, y, 0.4], [0.52, 0.12, 1.95], "#4b3428", "basement-furnishings", { roughness: 0.96 });
}
for (const [index, z] of [-0.25, 0.08, 0.41, 0.74, 1.05].entries()) {
  add(`Cellar shelf bottle ${index + 1}`, "cylinder", [3.05, 1.48, z], [0.1, 0.45, 0.1], index % 2 ? "#425a45" : "#5b4634", "basement-furnishings", { roughness: 0.55 });
}
}

// One empty bookcase sits against the windowless right basement wall, away from both doors and stairs.
box("Basement empty bookcase back", [3.53, 1.25, 0.4], [0.1, 2.25, 1.7], "#2f211b", "basement-furnishings", { roughness: 0.97 });
box("Basement empty bookcase rear stile", [3.38, 1.25, -0.42], [0.34, 2.3, 0.16], "#493124", "basement-furnishings", { roughness: 0.96 });
box("Basement empty bookcase front stile", [3.38, 1.25, 1.22], [0.34, 2.3, 0.16], "#493124", "basement-furnishings", { roughness: 0.96 });
for (const y of [0.14, 0.68, 1.22, 1.76, 2.3]) {
  box(`Basement empty bookcase shelf ${y}`, [3.36, y, 0.4], [0.4, 0.12, 1.82], "#523829", "basement-furnishings", { roughness: 0.95 });
}

// Decorative fixtures reserve sensible lamp positions; a later light component can attach here.
function addWallTorch(name, position, groupId = "lighting-fixtures") {
  box(`${name} wall plate`, [position[0], position[1] - 0.28, position[2]], [0.28, 0.4, 0.1], iron, groupId, { roughness: 0.48 });
  add(`${name} wooden shaft`, "cylinder", [position[0], position[1], position[2] + 0.1], [0.08, 0.72, 0.08], "#4b3124", groupId, { rotation: [18, 0, 0], roughness: 0.92 });
  add(`${name} flame placeholder`, "facetedBallLow", [position[0], position[1] + 0.45, position[2] + 0.22], [0.2, 0.36, 0.2], "#d57824", groupId, { roughness: 0.35 });
}

addWallTorch("Basement front wall torch", [1.55, 1.75, 2.26]);
addWallTorch("Basement rear wall torch", [-0.75, 1.75, -2.26]);
addWallTorch("Upper rear timber-post sconce", [1.35, 5.05, -2.27]);

add("Front shingled roof slope", "panel", [0, 7.535, 1.36], [8.8, 4.08, 1], "#5a5b57", "roof", { rotation: [-42.4842, 0, 0], roughness: 1, textureName: "Mossy Terracotta Roof", textureFlipY: true, textureRotation: 0 });
add("Rear shingled roof slope", "panel", [0, 7.535, -1.36], [8.8, 4.08, 1], "#555754", "roof", { rotation: [42.4842, 0, 0], roughness: 1, textureName: "Mossy Terracotta Roof", textureFlipY: true, textureRotation: 180 });
box("Heavy oak ridge beam", [0, 9.08, 0], [9.15, 0.22, 0.25], timber, "roof", { roughness: 0.97 });
box("Front oak eave", [0, 6.0, 2.86], [9.0, 0.22, 0.24], timber, "roof", { roughness: 0.97 });
box("Rear oak eave", [0, 6.0, -2.86], [9.0, 0.22, 0.24], timber, "roof", { roughness: 0.97 });

for (let index = -5; index <= 5; index++) {
  add(`Ridge cap ${index + 6}`, "cylinder", [index * 0.78, 9.18, 0], [0.24, 0.82, 0.24], "#555754", "roof", { rotation: [0, 0, 90], roughness: 1, textureName: "Mossy Terracotta Roof", textureFlipY: true, textureRotation: 90 });
}

box("Chimney main stack", [2.35, 8.12, -0.72], [0.8, 2.35, 0.78], "#6f706b", "chimney", { roughness: 1, textureName: "Mossy Fieldstone", textureFlipY: true, textureRotation: 0 });
box("Chimney shoulder", [2.35, 9.22, -0.72], [1.0, 0.22, 0.98], "#777872", "chimney", { roughness: 1, textureName: "Mossy Fieldstone", textureFlipY: true, textureRotation: 90 });
box("Chimney cap", [2.35, 9.48, -0.72], [1.15, 0.26, 1.1], "#555754", "chimney", { roughness: 1, textureName: "Mossy Fieldstone", textureFlipY: true, textureRotation: 180 });
add("Chimney dark flue", "hollowBox", [2.35, 9.64, -0.72], [0.68, 0.32, 0.68], "#181a1a", "chimney", { rotation: [90, 0, 0], roughness: 1 });

box("Front threshold", [0, 0.16, 2.98], [1.55, 0.22, 0.62], "#777872", "details", { roughness: 1, textureName: "Mossy Fieldstone", textureFlipY: true, textureRotation: 0 });
box("Rear threshold", [2.25, 0.16, -2.98], [1.55, 0.22, 0.62], "#777872", "details", { roughness: 1, textureName: "Mossy Fieldstone", textureFlipY: true, textureRotation: 180 });

const project = {
  kind: "modeler-project",
  version: 1,
  name: "blackstone-timber-manor",
  savedAt: new Date().toISOString(),
  capabilities: {
    source: "single four-view architectural reference",
    exteriorViews: ["front", "back", "left", "right", "top", "iso"],
    editableParts: true,
    embeddedTextures: true
  },
  textureLibrary,
  scene: {
    version: 2,
    coordinateSystem: sourceProject.scene.coordinateSystem,
    shapeConventions: sourceProject.scene.shapeConventions || {
      defaultOrigin: "Built-in geometry is centered on its local origin before object transforms."
    },
    groups,
    hierarchy: groups,
    objects,
    boneHierarchy: []
  },
  editor: {
    projectName: "blackstone-timber-manor",
    selectedId: null,
    selectedGroupId: null,
    checkedIds: [],
    activeGroupIds: [],
    activeTransformMode: null,
    facePickMode: false,
    view: {
      cameraPosition: [12, 10, 13],
      orbitTarget: [0, 4.45, 0],
      cameraUp: [0, 1, 0],
      viewSpace: 1.5,
      shotZoom: 0.88,
      environment: "plain",
      background: "plain",
      showGrid: true,
      useCurrentZoomInShots: false,
      hideGridInShots: true
    }
  }
};

const output = join(root, "samples", "showcases", "blackstone-timber-manor.modelerproj");
writeFileSync(output, JSON.stringify(project, null, 2));
console.log(`Created ${output} with ${objects.length} editable objects and ${textureLibrary.length} embedded textures.`);
