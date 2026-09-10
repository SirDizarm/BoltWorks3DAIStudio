#!/usr/bin/env node
// Fresh, independent build of a two-storey timber-and-stone cottage matching
// a locally supplied architectural reference sheet.
// Written from scratch against BoltWorksStudioAi/PROJECT_FORMAT.md, SHAPE_CATALOG.md,
// and TEXTURE_WORKFLOW.md — not adapted from any existing built house asset.
import fs from "node:fs";
import path from "node:path";

const root = "D:/Game/BoltWorks3DAIStudio";
const OUT_PATH = path.join(root, "samples/showcases/timberwell-cottage.modelerproj");

let serial = 0;
function nextId(label) {
  serial += 1;
  return `${label}-${String(serial).padStart(3, "0")}`;
}
function r(n) { return Math.round(n * 10000) / 10000; }

const objects = [];
function place(name, shape, groupId, position, scale, color, extra = {}) {
  const obj = {
    id: nextId(shape),
    name,
    shape,
    position: position.map(r),
    rotation: (extra.rotation || [0, 0, 0]).map(r),
    scale: scale.map(r),
    color,
    roughness: extra.roughness ?? 0.85,
    opacity: extra.opacity ?? 1,
    hidden: false,
    groupId,
    groupName: GROUP_LABEL[groupId],
    materialRule: "auto"
  };
  if (extra.textureName) {
    obj.textureName = extra.textureName;
    obj.textureUrl = null;
    obj.textureFlipY = extra.textureFlipY ?? true;
    obj.textureRotation = extra.textureRotation ?? 0;
    obj.textureRobloxAssetId = "";
  }
  if (extra.geometry) obj.geometry = extra.geometry;
  objects.push(obj);
  return obj;
}

// A timber beam running between two (axis, height) points on a wall that faces
// along Z (a gable-end wall). Returns the rotation/length needed to span them.
function spanOnZWall(y0, z0, y1, z1) {
  const dz = z1 - z0;
  const dy = y1 - y0;
  const length = Math.hypot(dz, dy);
  const angle = Math.atan2(dz, dy) * 180 / Math.PI;
  return { midY: (y0 + y1) / 2, midZ: (z0 + z1) / 2, length, angle };
}
// Same, for a wall that faces along X (a long wall).
function spanOnXWall(y0, x0, y1, x1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const length = Math.hypot(dx, dy);
  const angle = Math.atan2(-dx, dy) * 180 / Math.PI;
  return { midY: (y0 + y1) / 2, midX: (x0 + x1) / 2, length, angle };
}

const TIMBER = "#3a2a20";
const PLASTER = "#bdb9ac";
const PLASTER_REAR = "#aca89b";
const STONE_TONES = ["#7a776f", "#6a6960", "#87837a", "#605e57", "#78756c"];
const IRON = "#181a1a";
const GLASS = "#25454d";

const GROUP_LABEL = {};
const groups = [
  ["cottage", "Timberwell Cottage", null],
  ["stone-base", "Stone Ground Floor", "cottage"],
  ["overhang", "Jettied Overhang", "cottage"],
  ["render-infill", "Wall Render Infill", "cottage"],
  ["frame", "Oak Timber Frame", "cottage"],
  ["glazing", "Windows", "cottage"],
  ["entry", "Door and Steps", "cottage"],
  ["roofing", "Shingle Roof", "cottage"],
  ["flues", "Roof Flues", "cottage"]
].map(([id, name, parentId]) => {
  GROUP_LABEL[id] = name;
  return { id, name, parentId };
});

// ---------------------------------------------------------------------------
// Footprint, read off the reference sheet: the long elevation (bottom pair of
// images) carries four upper window bays past the braced gable corner, close
// to double the width of the gable elevation (top pair of images). The stone
// storey is noticeably shorter than the timbered storey above it, and the
// upper floor's sill board oversails the stonework on every side.
// ---------------------------------------------------------------------------
const LONG_HALF = 3.25;   // half-length of the eave walls, along X
const DEEP_HALF = 2.0;    // half-depth of the gable walls, along Z
const STONE_TOP = 1.85;
const SILL_TOP = 2.0;
const EAVE_Y = 4.1;
const RIDGE_Y = EAVE_Y + 2.75;
const DOOR_X = -1.5;

// ---------------------------------------------------------------------------
// Stone ground floor. Coursed in five bands with a door gap in the front wall
// and a small window gap beside it; corner stones alternate long/short to
// close the miters instead of leaving a hollow seam.
// ---------------------------------------------------------------------------
function stoneCourse(fromU, toU, targetWidth) {
  const span = toU - fromU;
  if (span <= 0.05) return [];
  const count = Math.max(1, Math.round(span / targetWidth));
  const width = span / count;
  const blocks = [];
  for (let i = 0; i < count; i++) blocks.push({ center: fromU + width * (i + 0.5), width: width - 0.03 });
  return blocks;
}

function stoneWall(label, groupId, axisIsX, fixedCoord, openings) {
  const half = axisIsX ? LONG_HALF : DEEP_HALF;
  for (let course = 0; course < 5; course++) {
    const y = 0.22 + course * 0.34;
    const h = course % 2 === 0 ? 0.32 : 0.3;
    const targetWidth = course % 2 === 0 ? 0.62 : 0.5;
    let cursor = -half + 0.08;
    const cut = [];
    const sortedOpenings = openings.filter(o => y >= o.yMin && y <= o.yMax).sort((a, b) => a.center - b.center);
    for (const opening of sortedOpenings) {
      const left = opening.center - opening.halfWidth;
      const right = opening.center + opening.halfWidth;
      if (left > cursor) cut.push(...stoneCourse(cursor, left, targetWidth));
      cursor = right;
    }
    cut.push(...stoneCourse(cursor, half - 0.08, targetWidth));
    cut.forEach((block, index) => {
      const tone = STONE_TONES[(course * 5 + index) % STONE_TONES.length];
      const pos = axisIsX ? [block.center, y, fixedCoord] : [fixedCoord, y, block.center];
      const scale = axisIsX ? [block.width, h, 0.34] : [0.34, h, block.width];
      place(`${label} course ${course + 1} stone ${index + 1}`, "box", groupId, pos, scale, tone, {
        roughness: 1, textureName: "Weathered Fieldstone", textureFlipY: course % 2 === 0, textureRotation: axisIsX ? 0 : 90
      });
    });
  }
}

const doorOpening = { center: DOOR_X, halfWidth: 0.55, yMin: 0, yMax: 1.85 };
const stoneWindowOpening = { center: 1.55, halfWidth: 0.3, yMin: 0.75, yMax: 1.35 };
stoneWall("Front stone wall", "stone-base", true, DEEP_HALF, [doorOpening, stoneWindowOpening]);
stoneWall("Rear stone wall", "stone-base", true, -DEEP_HALF, []);
stoneWall("Left gable stone wall", "stone-base", false, -LONG_HALF, []);
stoneWall("Right gable stone wall", "stone-base", false, LONG_HALF, []);

for (const xs of [-1, 1]) {
  for (const zs of [-1, 1]) {
    for (let course = 0; course < 5; course++) {
      const y = 0.22 + course * 0.34;
      const wide = course % 2 === 0;
      place(`Corner stone ${xs}/${zs} course ${course + 1}`, "box", "stone-base",
        [xs * (LONG_HALF + 0.02), y, zs * (DEEP_HALF + 0.02)],
        wide ? [0.6, 0.32, 0.42] : [0.42, 0.32, 0.6],
        STONE_TONES[((course + xs + zs) % STONE_TONES.length + STONE_TONES.length) % STONE_TONES.length],
        { roughness: 1, textureName: "Weathered Fieldstone", textureFlipY: true, textureRotation: wide ? 0 : 90 });
    }
  }
}

// Small stone-set window beside the door.
{
  const { center: wx, yMin, yMax } = stoneWindowOpening;
  const wy = (yMin + yMax) / 2;
  const wh = yMax - yMin;
  place("Stone window recess", "box", "glazing", [wx, wy, DEEP_HALF - 0.02], [0.5, wh, 0.32], "#121314", "glazing", { roughness: 1 });
  place("Stone window glass", "box", "glazing", [wx, wy, DEEP_HALF], [0.42, wh - 0.08, 0.05], GLASS, "glazing", { roughness: 0.2, opacity: 0.4 });
  place("Stone window frame", "box", "glazing", [wx, wy, DEEP_HALF + 0.03], [0.54, wh + 0.08, 0.1], TIMBER, "glazing", { textureName: "Hand-Hewn Oak", textureFlipY: true });
}

// ---------------------------------------------------------------------------
// Jettied sill: the upper storey oversails the stonework on every side,
// carried on a continuous board with a heavier bearing beam beneath it.
// ---------------------------------------------------------------------------
const OVERSAIL = 0.14;
place("Front sill board", "box", "overhang", [0, SILL_TOP, DEEP_HALF + OVERSAIL / 2], [LONG_HALF * 2 + OVERSAIL * 2, 0.12, OVERSAIL], TIMBER, { textureName: "Hand-Hewn Oak", textureFlipY: true });
place("Rear sill board", "box", "overhang", [0, SILL_TOP, -DEEP_HALF - OVERSAIL / 2], [LONG_HALF * 2 + OVERSAIL * 2, 0.12, OVERSAIL], TIMBER, { textureName: "Hand-Hewn Oak", textureFlipY: true });
place("Left sill board", "box", "overhang", [-LONG_HALF - OVERSAIL / 2, SILL_TOP, 0], [OVERSAIL, 0.12, DEEP_HALF * 2 + OVERSAIL * 2], TIMBER, { textureName: "Hand-Hewn Oak", textureFlipY: true });
place("Right sill board", "box", "overhang", [LONG_HALF + OVERSAIL / 2, SILL_TOP, 0], [OVERSAIL, 0.12, DEEP_HALF * 2 + OVERSAIL * 2], TIMBER, { textureName: "Hand-Hewn Oak", textureFlipY: true });
place("Front bearing beam", "box", "overhang", [0, SILL_TOP + 0.1, DEEP_HALF], [LONG_HALF * 2 + 0.1, 0.18, 0.24], TIMBER, { textureName: "Hand-Hewn Oak", textureFlipY: true });
place("Rear bearing beam", "box", "overhang", [0, SILL_TOP + 0.1, -DEEP_HALF], [LONG_HALF * 2 + 0.1, 0.18, 0.24], TIMBER, { textureName: "Hand-Hewn Oak", textureFlipY: true });
place("Left bearing beam", "box", "overhang", [-LONG_HALF, SILL_TOP + 0.1, 0], [0.24, 0.18, DEEP_HALF * 2 + 0.1], TIMBER, { textureName: "Hand-Hewn Oak", textureFlipY: true });
place("Right bearing beam", "box", "overhang", [LONG_HALF, SILL_TOP + 0.1, 0], [0.24, 0.18, DEEP_HALF * 2 + 0.1], TIMBER, { textureName: "Hand-Hewn Oak", textureFlipY: true });

// ---------------------------------------------------------------------------
// Upper storey render, split around window openings so each pane keeps a
// real reveal instead of a single sheet with a hole punched in it.
// ---------------------------------------------------------------------------
function renderWall(label, axisIsX, sign, fixedU, color, openings) {
  const half = axisIsX ? LONG_HALF : DEEP_HALF;
  const bottom = Math.min(...openings.map(o => o.y - o.h / 2));
  const top = Math.max(...openings.map(o => o.y + o.h / 2));
  for (const depth of [fixedU - sign * 0.05, fixedU - sign * 0.2]) {
    const below = { c: (SILL_TOP + 0.18 + bottom) / 2, s: bottom - SILL_TOP - 0.18 };
    const above = { c: (top + EAVE_Y) / 2, s: EAVE_Y - top };
    const belowPos = axisIsX ? [0, below.c, depth] : [depth, below.c, 0];
    const belowScale = axisIsX ? [half * 2 - 0.08, below.s, 0.1] : [0.1, below.s, half * 2 - 0.08];
    place(`${label} render below openings`, "box", "render-infill", belowPos, belowScale, color, { roughness: 0.95 });
    const abovePos = axisIsX ? [0, above.c, depth] : [depth, above.c, 0];
    const aboveScale = axisIsX ? [half * 2 - 0.08, above.s, 0.1] : [0.1, above.s, half * 2 - 0.08];
    place(`${label} render above openings`, "box", "render-infill", abovePos, aboveScale, color, { roughness: 0.95 });
    let cursor = -half + 0.08;
    for (const opening of [...openings].sort((a, b) => a.u - b.u)) {
      const left = opening.u - opening.w / 2;
      if (left > cursor) {
        const midU = (cursor + left) / 2;
        const pierPos = axisIsX ? [midU, (bottom + top) / 2, depth] : [depth, (bottom + top) / 2, midU];
        const pierScale = axisIsX ? [left - cursor, top - bottom, 0.1] : [0.1, top - bottom, left - cursor];
        place(`${label} pier ${cursor.toFixed(2)}`, "box", "render-infill", pierPos, pierScale, color, { roughness: 0.95 });
      }
      cursor = opening.u + opening.w / 2;
    }
    if (cursor < half - 0.08) {
      const midU = (cursor + half - 0.08) / 2;
      const pierPos = axisIsX ? [midU, (bottom + top) / 2, depth] : [depth, (bottom + top) / 2, midU];
      const pierScale = axisIsX ? [half - 0.08 - cursor, top - bottom, 0.1] : [0.1, top - bottom, half - 0.08 - cursor];
      place(`${label} end pier`, "box", "render-infill", pierPos, pierScale, color, { roughness: 0.95 });
    }
  }
}

// Window bay centers along the long walls, read off the reference: a narrow
// bay close to the braced corner, then three broader bays toward the far end.
const UPPER_WINDOW_Y = 3.3;
const frontBays = [
  { u: -2.55, w: 0.5, h: 0.85 },
  { u: -1.5, w: 0.62, h: 0.9 },
  { u: -0.25, w: 0.62, h: 0.9 },
  { u: 1.15, w: 0.62, h: 0.9 },
  { u: 2.4, w: 0.5, h: 0.85 }
].map(b => ({ ...b, y: UPPER_WINDOW_Y }));
const rearBays = frontBays.map(b => ({ ...b }));
const gableWindow = { u: 0, w: 0.66, h: 0.95, y: UPPER_WINDOW_Y };

renderWall("Front", true, 1, DEEP_HALF, PLASTER, frontBays.map(b => ({ u: b.u, y: b.y, w: b.w, h: b.h })));
renderWall("Rear", true, -1, -DEEP_HALF, PLASTER_REAR, rearBays.map(b => ({ u: b.u, y: b.y, w: b.w, h: b.h })));
renderWall("Left gable", false, -1, -LONG_HALF, PLASTER_REAR, [{ u: gableWindow.u, y: gableWindow.y, w: gableWindow.w, h: gableWindow.h }]);
renderWall("Right gable", false, 1, LONG_HALF, PLASTER, [{ u: gableWindow.u, y: gableWindow.y, w: gableWindow.w, h: gableWindow.h }]);

// ---------------------------------------------------------------------------
// Oak timber frame: corner posts, intermediate studs either side of each
// window, three horizontal rails, and diagonal braces at both ends plus one
// decorative brace pair worked into the long wall (matching the reference).
// ---------------------------------------------------------------------------
function frameStuds(axisIsX, sign, fixedU, xs) {
  for (const u of xs) {
    const pos = axisIsX ? [u, (SILL_TOP + EAVE_Y) / 2, fixedU - sign * 0.05] : [fixedU - sign * 0.05, (SILL_TOP + EAVE_Y) / 2, u];
    const scale = axisIsX ? [0.15, EAVE_Y - SILL_TOP, 0.16] : [0.16, EAVE_Y - SILL_TOP, 0.15];
    place(`Stud ${axisIsX ? "x" : "z"}=${u}`, "box", "frame", pos, scale, TIMBER, { textureName: "Hand-Hewn Oak", textureFlipY: true });
  }
}
frameStuds(true, 1, DEEP_HALF, [-LONG_HALF, -2.05, -0.88, 0.45, 1.78, LONG_HALF]);
frameStuds(true, -1, -DEEP_HALF, [-LONG_HALF, -2.05, -0.88, 0.45, 1.78, LONG_HALF]);
frameStuds(false, -1, -LONG_HALF, [-DEEP_HALF, -0.33, 0.33, DEEP_HALF]);
frameStuds(false, 1, LONG_HALF, [-DEEP_HALF, -0.33, 0.33, DEEP_HALF]);

function frameRails(axisIsX, sign, fixedU, half) {
  // Sill rail below the window band and head rail under the eave only — an
  // intermediate rail at window-band height would run full-width straight
  // through the middle of every opening.
  for (const y of [2.65, EAVE_Y - 0.08]) {
    const pos = axisIsX ? [0, y, fixedU - sign * 0.05] : [fixedU - sign * 0.05, y, 0];
    const scale = axisIsX ? [half * 2 - 0.02, 0.13, 0.18] : [0.18, 0.13, half * 2 - 0.02];
    place(`Rail y=${y} ${axisIsX ? "long" : "gable"}`, "box", "frame", pos, scale, TIMBER, { textureName: "Hand-Hewn Oak", textureFlipY: true });
  }
}
frameRails(true, 1, DEEP_HALF, LONG_HALF);
frameRails(true, -1, -DEEP_HALF, LONG_HALF);
frameRails(false, -1, -LONG_HALF, DEEP_HALF);
frameRails(false, 1, LONG_HALF, DEEP_HALF);

for (const xs of [-1, 1]) {
  for (const zs of [-1, 1]) {
    place(`Corner post ${xs}/${zs}`, "box", "frame", [xs * LONG_HALF, (SILL_TOP + EAVE_Y) / 2, zs * DEEP_HALF], [0.24, EAVE_Y - SILL_TOP + 0.06, 0.24], TIMBER, { roughness: 0.9, textureName: "Hand-Hewn Oak", textureFlipY: true });
  }
}

function crossBrace(label, axisIsX, sign, fixedU, u0, u1) {
  const bottom = SILL_TOP + 0.22;
  const top = EAVE_Y - 0.2;
  const rising = axisIsX ? spanOnXWall(bottom, u0, top, u1) : spanOnZWall(bottom, u0, top, u1);
  const falling = axisIsX ? spanOnXWall(top, u0, bottom, u1) : spanOnZWall(top, u0, bottom, u1);
  const depth = fixedU - sign * 0.05;
  if (axisIsX) {
    place(`${label} rising`, "box", "frame", [rising.midX, rising.midY, depth], [0.15, rising.length, 0.16], TIMBER, { rotation: [0, 0, rising.angle], textureName: "Hand-Hewn Oak", textureFlipY: true });
    place(`${label} falling`, "box", "frame", [falling.midX, falling.midY, depth], [0.15, falling.length, 0.16], TIMBER, { rotation: [0, 0, falling.angle], textureName: "Hand-Hewn Oak", textureFlipY: true });
  } else {
    place(`${label} rising`, "box", "frame", [depth, rising.midY, rising.midZ], [0.16, rising.length, 0.15], TIMBER, { rotation: [rising.angle, 0, 0], textureName: "Hand-Hewn Oak", textureFlipY: true });
    place(`${label} falling`, "box", "frame", [depth, falling.midY, falling.midZ], [0.16, falling.length, 0.15], TIMBER, { rotation: [falling.angle, 0, 0], textureName: "Hand-Hewn Oak", textureFlipY: true });
  }
}

crossBrace("Left gable brace", false, -1, -LONG_HALF, -DEEP_HALF, -0.4);
crossBrace("Right gable brace", false, 1, LONG_HALF, DEEP_HALF, 0.4);
crossBrace("Front near-corner brace", true, 1, DEEP_HALF, -LONG_HALF, -2.35);
// Decorative diagonal accent between two of the front bays, matching the reference.
crossBrace("Front mid brace", true, 1, DEEP_HALF, -0.02, 1.5);

// ---------------------------------------------------------------------------
// Gable triangles: render infill split into two raking halves, ridge king
// post, collar/tie beam, paired rafters, and a louvered vent at the apex.
// ---------------------------------------------------------------------------
// The gable end is a triangle: build it directly as two custom-geometry
// wedges (one per roof pitch) rather than relying on the built-in "wedge"
// shape, so the exact slope always matches this cottage's own roof angle.
function gableFill(xSign, tint) {
  const z0 = -DEEP_HALF, z1 = DEEP_HALF, zMid = 0;
  const yBase = EAVE_Y, yPeak = RIDGE_Y;
  const thickness = 0.16;
  function tri(name, za, zb) {
    const positions = [
      xSign * LONG_HALF, yBase, za,
      xSign * LONG_HALF, yBase, zb,
      xSign * LONG_HALF, yPeak, zMid,
      xSign * LONG_HALF + xSign * thickness, yBase, za,
      xSign * LONG_HALF + xSign * thickness, yPeak, zMid,
      xSign * LONG_HALF + xSign * thickness, yBase, zb
    ];
    place(name, "box", "render-infill", [0, 0, 0], [1, 1, 1], tint, { geometry: { positions }, roughness: 0.95 });
  }
  tri(`Gable fill ${xSign > 0 ? "right" : "left"} rear`, z0, zMid);
  tri(`Gable fill ${xSign > 0 ? "right" : "left"} front`, zMid, z1);
}
gableFill(-1, PLASTER_REAR);
gableFill(1, PLASTER);

for (const xSign of [-1, 1]) {
  const rearRafter = spanOnZWall(EAVE_Y, -DEEP_HALF * 0.95, RIDGE_Y, 0);
  const frontRafter = spanOnZWall(RIDGE_Y, 0, EAVE_Y, DEEP_HALF * 0.95);
  place(`${xSign > 0 ? "Right" : "Left"} rear rafter`, "box", "frame", [xSign * LONG_HALF, rearRafter.midY, rearRafter.midZ], [0.15, rearRafter.length, 0.18], TIMBER, { rotation: [rearRafter.angle, 0, 0], textureName: "Hand-Hewn Oak", textureFlipY: true });
  place(`${xSign > 0 ? "Right" : "Left"} front rafter`, "box", "frame", [xSign * LONG_HALF, frontRafter.midY, frontRafter.midZ], [0.15, frontRafter.length, 0.18], TIMBER, { rotation: [frontRafter.angle, 0, 0], textureName: "Hand-Hewn Oak", textureFlipY: true });
  place(`${xSign > 0 ? "Right" : "Left"} tie beam`, "box", "frame", [xSign * LONG_HALF, EAVE_Y + 0.06, 0], [0.18, 0.15, DEEP_HALF * 1.9], TIMBER, { textureName: "Hand-Hewn Oak", textureFlipY: true });
  place(`${xSign > 0 ? "Right" : "Left"} king post`, "box", "frame", [xSign * LONG_HALF, (EAVE_Y + RIDGE_Y) / 2 + 0.25, 0], [0.18, RIDGE_Y - EAVE_Y - 0.5, 0.15], TIMBER, { textureName: "Hand-Hewn Oak", textureFlipY: true });
}
// Louvered vent at the left gable's peak.
for (let i = 0; i < 4; i++) {
  place(`Vent slat ${i}`, "box", "frame", [-LONG_HALF, RIDGE_Y - 0.5 - i * 0.09, 0], [0.04, 0.03, 0.32], IRON, { roughness: 0.9 });
}
place("Vent surround", "box", "frame", [-LONG_HALF, RIDGE_Y - 0.66, 0], [0.07, 0.4, 0.38], TIMBER, { textureName: "Hand-Hewn Oak", textureFlipY: true });

// ---------------------------------------------------------------------------
// Windows: timber surround, sill and lintel, transparent leaded glass, and a
// diagonal lattice pair worked from the same beam helper as the bracing.
// ---------------------------------------------------------------------------
function window(label, axisIsX, sign, fixedU, bay) {
  const { u, w, h, y } = bay;
  const depth = fixedU - sign * 0.06;
  const glassPos = axisIsX ? [u, y, depth] : [depth, y, u];
  const glassScale = axisIsX ? [w, h, 0.05] : [0.05, h, w];
  place(`${label} glass`, "box", "glazing", glassPos, glassScale, GLASS, { roughness: 0.2, opacity: 0.4 });
  const framePos = axisIsX ? [u, y, fixedU - sign * 0.02] : [fixedU - sign * 0.02, y, u];
  place(`${label} frame`, "box", "glazing", framePos, axisIsX ? [w + 0.14, h + 0.14, 0.14] : [0.14, h + 0.14, w + 0.14], TIMBER, { textureName: "Hand-Hewn Oak", textureFlipY: true });
  place(`${label} recess`, "box", "glazing", axisIsX ? [u, y, fixedU - sign * 0.1] : [fixedU - sign * 0.1, y, u], axisIsX ? [w + 0.04, h + 0.04, 0.16] : [0.16, h + 0.04, w + 0.04], "#121314", { roughness: 1 });
  const latticeZ = depth + sign * 0.03;
  const a = axisIsX ? spanOnXWall(y - h / 2, u - w / 2, y + h / 2, u + w / 2) : spanOnZWall(y - h / 2, u - w / 2, y + h / 2, u + w / 2);
  const b = axisIsX ? spanOnXWall(y - h / 2, u + w / 2, y + h / 2, u - w / 2) : spanOnZWall(y - h / 2, u + w / 2, y + h / 2, u - w / 2);
  if (axisIsX) {
    place(`${label} lattice a`, "box", "glazing", [a.midX, a.midY, latticeZ], [a.length, 0.025, 0.025], IRON, { rotation: [0, 0, a.angle], roughness: 0.5, textureName: "Hammered Iron", textureFlipY: true });
    place(`${label} lattice b`, "box", "glazing", [b.midX, b.midY, latticeZ], [b.length, 0.025, 0.025], IRON, { rotation: [0, 0, b.angle], roughness: 0.5, textureName: "Hammered Iron", textureFlipY: true });
  } else {
    place(`${label} lattice a`, "box", "glazing", [latticeZ, a.midY, a.midZ], [0.025, a.length, 0.025], IRON, { rotation: [a.angle, 0, 0], roughness: 0.5, textureName: "Hammered Iron", textureFlipY: true });
    place(`${label} lattice b`, "box", "glazing", [latticeZ, b.midY, b.midZ], [0.025, b.length, 0.025], IRON, { rotation: [b.angle, 0, 0], roughness: 0.5, textureName: "Hammered Iron", textureFlipY: true });
  }
}
frontBays.forEach((bay, i) => window(`Front window ${i}`, true, 1, DEEP_HALF, bay));
rearBays.forEach((bay, i) => window(`Rear window ${i}`, true, -1, -DEEP_HALF, bay));
window("Left gable window", false, -1, -LONG_HALF, gableWindow);
window("Right gable window", false, 1, LONG_HALF, gableWindow);

// ---------------------------------------------------------------------------
// Door: recessed dark reveal, plank slab with strap hinges and ring handle,
// heavy jambs and lintel, three stone steps leading up from grade.
// ---------------------------------------------------------------------------
{
  const x = DOOR_X, z = DEEP_HALF;
  place("Door recess", "box", "entry", [x, 0.95, z - 0.06], [1.0, 1.9, 0.2], "#101112", "entry", { roughness: 1 });
  place("Door slab", "panel", "entry", [x, 0.95, z + 0.02], [0.88, 1.78, 1], "#48331f", "entry", { textureName: "Hand-Hewn Oak", textureFlipY: true, roughness: 0.9 });
  for (const dx of [-0.27, 0, 0.27]) place(`Door plank line ${dx}`, "box", "entry", [x + dx, 0.95, z + 0.06], [0.025, 1.7, 0.03], "#2a1c12", { roughness: 0.95 });
  place("Door left jamb", "box", "entry", [x - 0.54, 1.0, z + 0.02], [0.16, 2.05, 0.2], TIMBER, { textureName: "Hand-Hewn Oak", textureFlipY: true });
  place("Door right jamb", "box", "entry", [x + 0.54, 1.0, z + 0.02], [0.16, 2.05, 0.2], TIMBER, { textureName: "Hand-Hewn Oak", textureFlipY: true });
  place("Door lintel", "box", "entry", [x, 2.02, z + 0.02], [1.24, 0.18, 0.2], TIMBER, { textureName: "Hand-Hewn Oak", textureFlipY: true });
  for (const y of [0.58, 1.35]) place(`Door strap ${y}`, "box", "entry", [x - 0.1, y, z + 0.13], [0.55, 0.06, 0.03], IRON, { roughness: 0.4, textureName: "Hammered Iron", textureFlipY: true });
  place("Door ring handle", "torus", "entry", [x + 0.26, 0.95, z + 0.14], [0.13, 0.13, 0.13], IRON, { roughness: 0.3, textureName: "Hammered Iron", textureFlipY: true });

  for (let i = 0; i < 3; i++) {
    const stepY = 0.22 - i * 0.07;
    const stepZ = z + 0.18 + i * 0.24;
    place(`Step ${i + 1}`, "box", "entry", [x, stepY, stepZ], [1.05 - i * 0.16, 0.14, 0.26], "#726f66", { roughness: 1, textureName: "Weathered Fieldstone", textureFlipY: true });
  }
}

// ---------------------------------------------------------------------------
// Roof: two pitched shingle skins, ridge beam, eave boards, ridge caps, and
// three small chimney flues along the ridge.
// ---------------------------------------------------------------------------
const OVERHANG = 0.32;
const roofRun = DEEP_HALF + OVERHANG;
const roofRise = RIDGE_Y - EAVE_Y;
const roofLength = Math.hypot(roofRun, roofRise);
const roofTiltFromVertical = Math.atan2(roofRun, roofRise) * 180 / Math.PI;
for (const zSign of [1, -1]) {
  place(`${zSign > 0 ? "Front" : "Rear"} roof skin`, "panel", "roofing",
    [0, (EAVE_Y + RIDGE_Y) / 2, zSign * roofRun / 2],
    [LONG_HALF * 2 + OVERHANG * 2, roofLength, 1],
    zSign > 0 ? "#59584f" : "#514f47",
    { rotation: [zSign > 0 ? -roofTiltFromVertical : roofTiltFromVertical, 0, 0], roughness: 1, textureName: "Weathered Shingle", textureFlipY: true, textureRotation: zSign > 0 ? 0 : 180 });
}
place("Ridge beam", "box", "roofing", [0, RIDGE_Y + 0.07, 0], [LONG_HALF * 2 + 0.3, 0.18, 0.2], TIMBER, { textureName: "Hand-Hewn Oak", textureFlipY: true });
for (const zSign of [1, -1]) {
  place(`${zSign > 0 ? "Front" : "Rear"} eave board`, "box", "roofing", [0, EAVE_Y - 0.05, zSign * (roofRun - 0.05)], [LONG_HALF * 2 + 0.26, 0.18, 0.2], TIMBER, { textureName: "Hand-Hewn Oak", textureFlipY: true });
}
for (let i = -4; i <= 4; i++) {
  place(`Ridge cap ${i + 5}`, "cylinder", "roofing", [i * 0.72, RIDGE_Y + 0.15, 0], [0.19, 0.74, 0.19], "#514f47", { rotation: [0, 0, 90], roughness: 1, textureName: "Weathered Shingle", textureFlipY: true, textureRotation: 90 });
}

function chimneyFlue(x) {
  place(`Flue base ${x}`, "box", "flues", [x, RIDGE_Y + 0.26, 0], [0.3, 0.38, 0.3], "#75726a", { roughness: 1, textureName: "Weathered Fieldstone", textureFlipY: true });
  place(`Flue cap ${x}`, "box", "flues", [x, RIDGE_Y + 0.47, 0], [0.38, 0.08, 0.38], "#514f47", { roughness: 1 });
  place(`Flue pipe ${x}`, "cylinder", "flues", [x, RIDGE_Y + 0.55, 0], [0.09, 0.2, 0.09], "#161719", { roughness: 1 });
}
chimneyFlue(-1.4);
chimneyFlue(0.3);
chimneyFlue(1.9);

// ---------------------------------------------------------------------------
// Texture library — sourced directly from the raw PNG assets, encoded here,
// not carried over from any pre-built project file.
// ---------------------------------------------------------------------------
function dataUrl(relPath) {
  const bytes = fs.readFileSync(path.join(root, relPath));
  return `data:image/png;base64,${bytes.toString("base64")}`;
}
const textureLibrary = [
  { name: "Weathered Fieldstone", dataUrl: dataUrl("samples/showcases/textures/mossy-fieldstone.png"), robloxAssetId: "" },
  { name: "Weathered Shingle", dataUrl: dataUrl("samples/showcases/textures/mossy-terracotta-roof.png"), robloxAssetId: "" },
  { name: "Hand-Hewn Oak", dataUrl: dataUrl("assets/textures/aged-dark-oak-beams.png"), robloxAssetId: "" },
  { name: "Hammered Iron", dataUrl: dataUrl("assets/textures/hammered-black-iron.png"), robloxAssetId: "" }
];

const project = {
  kind: "modeler-project",
  version: 1,
  name: "timberwell-cottage",
  savedAt: new Date().toISOString(),
  textureLibrary,
  scene: {
    version: 2,
    coordinateSystem: {
      handedness: "right-handed",
      units: "meters",
      upAxis: "+Y",
      groundPlane: "XZ",
      rotationUnits: "degrees",
      eulerOrder: "XYZ",
      objectPositions: "world space",
      geometryAndPivots: "object-local space"
    },
    shapeConventions: {
      defaultOrigin: "Built-in geometry is centered on its local origin before object transforms."
    },
    groups,
    hierarchy: groups,
    objects,
    boneHierarchy: []
  },
  editor: {
    projectName: "timberwell-cottage",
    selectedId: null,
    selectedGroupId: null,
    checkedIds: [],
    activeGroupIds: [],
    activeTransformMode: null,
    facePickMode: false,
    view: {
      cameraPosition: [8.5, 6.5, 8.5],
      orbitTarget: [0, 2.8, 0],
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

fs.writeFileSync(OUT_PATH, JSON.stringify(project, null, 2));
console.log(`Wrote ${OUT_PATH} with ${objects.length} objects and ${textureLibrary.length} textures.`);
