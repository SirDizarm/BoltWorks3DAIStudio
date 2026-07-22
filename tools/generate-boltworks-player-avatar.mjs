import fs from "node:fs";
import path from "node:path";
import * as THREE from "three";

const outputPath = path.resolve("samples/assets/boltworks-player-avatar.modelerproj");
const referenceArgIndex = process.argv.indexOf("--reference");
const referencePath = referenceArgIndex >= 0 && process.argv[referenceArgIndex + 1]
  ? path.resolve(process.argv[referenceArgIndex + 1])
  : null;
const referenceExtension = referencePath ? path.extname(referencePath).toLowerCase() : "";
const referenceMime = ({ ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".bmp": "image/bmp" })[referenceExtension] || "image/png";
const referenceModeArgIndex = process.argv.indexOf("--reference-mode");
const referenceMode = ["panel", "overlay", "both"].includes(process.argv[referenceModeArgIndex + 1])
  ? process.argv[referenceModeArgIndex + 1]
  : "panel";
const embeddedReference = referencePath && fs.existsSync(referencePath)
  ? {
      name: path.basename(referencePath),
      dataUrl: `data:${referenceMime};base64,${fs.readFileSync(referencePath).toString("base64")}`,
      mode: referenceMode,
      opacity: .45,
      scale: 1,
      offsetX: 0,
      offsetY: 0
    }
  : { name: "", dataUrl: null, mode: "panel", opacity: .45, scale: 1, offsetX: 0, offsetY: 0 };
const objects = [];
let objectId = 1;

const colors = {
  armor: "#6d747a",
  armorLight: "#aeb3b7",
  armorDark: "#353b40",
  edge: "#c5c9cc",
  joint: "#111519",
  visor: "#050709",
  accent: "#ff3b35"
};

const groups = [
  { id: "avatar", name: "BoltWorks Player Avatar", parentId: null },
  { id: "head", name: "Head and Helmet", parentId: "avatar" },
  { id: "torso", name: "Torso and Waist", parentId: "avatar" },
  { id: "left-arm", name: "Left Arm", parentId: "avatar" },
  { id: "right-arm", name: "Right Arm", parentId: "avatar" },
  { id: "left-leg", name: "Left Leg", parentId: "avatar" },
  { id: "right-leg", name: "Right Leg", parentId: "avatar" },
  { id: "identity", name: "Visor and Red Identity Details", parentId: "avatar" }
];

function round(value) {
  return Math.round(value * 1000000) / 1000000;
}

function geometryData(geometry) {
  const source = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  source.computeVertexNormals();
  const position = source.getAttribute("position");
  const normal = source.getAttribute("normal");
  const uv = source.getAttribute("uv");
  const positions = [];
  const normals = [];
  const uvs = [];
  for (let index = 0; index < position.count; index++) {
    positions.push(round(position.getX(index)), round(position.getY(index)), round(position.getZ(index)));
    normals.push(round(normal.getX(index)), round(normal.getY(index)), round(normal.getZ(index)));
    if (uv) uvs.push(round(uv.getX(index)), round(uv.getY(index)));
  }
  source.dispose();
  geometry.dispose();
  return { positions, normals, uvs };
}

function chamferedBox(width, height, depth, chamfer = .035, bevel = .008) {
  const x = width / 2;
  const y = height / 2;
  const cut = Math.min(chamfer, x * .45, y * .45);
  const shape = new THREE.Shape();
  shape.moveTo(-x + cut, -y);
  shape.lineTo(x - cut, -y);
  shape.lineTo(x, -y + cut);
  shape.lineTo(x, y - cut);
  shape.lineTo(x - cut, y);
  shape.lineTo(-x + cut, y);
  shape.lineTo(-x, y - cut);
  shape.lineTo(-x, -y + cut);
  shape.closePath();
  const bevelSize = Math.min(bevel, depth * .18, cut * .45);
  const coreDepth = Math.max(.002, depth - bevelSize * 2);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: coreDepth,
    steps: 1,
    curveSegments: 1,
    bevelEnabled: bevelSize > 0,
    bevelSegments: 1,
    bevelSize,
    bevelThickness: bevelSize
  });
  geometry.translate(0, 0, -coreDepth / 2);
  return geometry;
}

function taperedPlate(topWidth, bottomWidth, height, depth, chamfer = .035, bevel = .008) {
  const top = topWidth / 2;
  const bottom = bottomWidth / 2;
  const y = height / 2;
  const cut = Math.min(chamfer, bottom * .4, y * .35);
  const shape = new THREE.Shape();
  shape.moveTo(-bottom + cut, -y);
  shape.lineTo(bottom - cut, -y);
  shape.lineTo(bottom, -y + cut);
  shape.lineTo(top, y - cut);
  shape.lineTo(top - cut, y);
  shape.lineTo(-top + cut, y);
  shape.lineTo(-top, y - cut);
  shape.lineTo(-bottom, -y + cut);
  shape.closePath();
  const bevelSize = Math.min(bevel, depth * .18, cut * .45);
  const coreDepth = Math.max(.002, depth - bevelSize * 2);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: coreDepth,
    steps: 1,
    curveSegments: 1,
    bevelEnabled: bevelSize > 0,
    bevelSegments: 1,
    bevelSize,
    bevelThickness: bevelSize
  });
  geometry.translate(0, 0, -coreDepth / 2);
  return geometry;
}

function polygonPlate(points, depth, bevel = .006) {
  const shape = new THREE.Shape();
  points.forEach(([x, y], index) => {
    if (!index) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });
  shape.closePath();
  const bevelSize = Math.min(bevel, depth * .18);
  const coreDepth = Math.max(.002, depth - bevelSize * 2);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: coreDepth,
    steps: 1,
    curveSegments: 1,
    bevelEnabled: bevelSize > 0,
    bevelSegments: 1,
    bevelSize,
    bevelThickness: bevelSize
  });
  geometry.translate(0, 0, -coreDepth / 2);
  return geometry;
}

function lightningBolt(width, height, depth) {
  const points = [
    [-.10, .50], [.12, .50], [.025, .10], [.17, .10],
    [-.11, -.50], [-.025, -.08], [-.17, -.08]
  ];
  const shape = new THREE.Shape();
  points.forEach(([x, y], index) => {
    const px = x / .34 * width;
    const py = y * height;
    if (!index) shape.moveTo(px, py);
    else shape.lineTo(px, py);
  });
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, steps: 1, bevelEnabled: false, curveSegments: 1 });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function add(name, groupId, geometry, position, color = colors.armor, rotation = [0, 0, 0], scale = [1, 1, 1], roughness = .5) {
  objects.push({
    id: `avatar-part-${objectId++}`,
    name,
    shape: "custom",
    geometry: geometryData(geometry),
    position: position.map(round),
    rotation: rotation.map(value => round(THREE.MathUtils.radToDeg(value))),
    scale: scale.map(round),
    color,
    roughness,
    opacity: 1,
    materialRule: "metal",
    hidden: false,
    groupId,
    groupName: groups.find(group => group.id === groupId)?.name || null
  });
}

// Feet and legs: long, slim proportions matching the reference sheet.
for (const side of [-1, 1]) {
  const isLeft = side < 0;
  const group = isLeft ? "left-leg" : "right-leg";
  const label = isLeft ? "Left" : "Right";
  const x = side * .12;
  add(`${label} foot armored sole`, group, chamferedBox(.19, .075, .34, .038, .010), [x, .045, -.065], colors.armorDark);
  add(`${label} foot upper shell`, group, taperedPlate(.155, .19, .11, .255, .032, .010), [x, .115, -.105], colors.armorLight, [-.16, 0, 0]);
  add(`${label} toe cap`, group, chamferedBox(.175, .07, .105, .025, .007), [x, .095, -.235], colors.edge, [-.08, 0, 0]);
  add(`${label} heel block`, group, chamferedBox(.14, .075, .13, .022, .007), [x, .115, .09], colors.armor);
  add(`${label} ankle joint`, group, new THREE.CylinderGeometry(.058, .058, .075, 10), [x, .19, .01], colors.joint, [0, 0, 0], [1, 1, .82]);
  add(`${label} lower leg core`, group, new THREE.CylinderGeometry(.066, .075, .34, 8), [x, .385, .02], colors.joint, [0, 0, 0], [1, 1, .78]);
  add(`${label} shin main armor`, group, taperedPlate(.125, .145, .30, .064, .028, .009), [x, .405, -.088], colors.armorLight);
  add(`${label} shin center facet`, group, taperedPlate(.074, .096, .215, .025, .019, .004), [x, .415, -.135], colors.armor);
  add(`${label} calf rear armor`, group, taperedPlate(.105, .125, .235, .048, .024, .007), [x, .405, .095], colors.armorDark);
  add(`${label} knee joint`, group, new THREE.SphereGeometry(.078, 8, 6), [x, .61, 0], colors.joint, [0, 0, 0], [1, .82, .9]);
  add(`${label} knee red ring`, "identity", new THREE.TorusGeometry(.047, .010, 6, 12), [x, .61, -.068], colors.accent);
  add(`${label} knee cap`, group, chamferedBox(.102, .09, .03, .02, .005), [x, .62, -.097], colors.armorDark);
  add(`${label} thigh core`, group, new THREE.CylinderGeometry(.078, .072, .31, 8), [x, .805, 0], colors.joint, [0, 0, side * .018], [1, 1, .82]);
  add(`${label} thigh front armor`, group, taperedPlate(.16, .132, .27, .058, .03, .009), [x, .815, -.087], colors.armorLight, [0, 0, side * .018]);
  add(`${label} thigh center facet`, group, taperedPlate(.105, .085, .19, .025, .021, .004), [x, .82, -.128], colors.armor, [0, 0, side * .018]);
  add(`${label} hip joint`, group, new THREE.SphereGeometry(.072, 8, 6), [x, .985, 0], colors.joint, [0, 0, 0], [1, .85, .92]);
}

// Pelvis, waist, and athletic torso.
add("Pelvis mechanical core", "torso", new THREE.CylinderGeometry(.19, .175, .18, 8), [0, 1.02, 0], colors.joint, [0, 0, 0], [1, 1, .72]);
add("Pelvis armor belt", "torso", taperedPlate(.34, .30, .14, .205, .044, .011), [0, 1.045, 0], colors.armorLight);
add("Pelvis front plate", "torso", taperedPlate(.18, .145, .115, .03, .022, .005), [0, 1.045, -.118], colors.armor);
add("Waist flexible core", "torso", new THREE.CylinderGeometry(.175, .18, .23, 10), [0, 1.17, 0], colors.joint, [0, 0, 0], [1, 1, .74]);
for (const [index, y] of [1.105, 1.17, 1.235].entries()) {
  add(`Waist rib ${index + 1}`, "torso", new THREE.TorusGeometry(.165, .016, 5, 12), [0, y, 0], colors.armorDark, [Math.PI / 2, 0, 0], [1, .74, 1]);
}
add("Torso structural core", "torso", new THREE.CylinderGeometry(.245, .165, .39, 8), [0, 1.39, 0], colors.joint, [0, 0, 0], [1, 1, .66]);
add("Chest outer tapered armor", "torso", taperedPlate(.43, .30, .35, .065, .052, .011), [0, 1.405, -.155], colors.armor);
add("Chest raised tapered armor", "torso", taperedPlate(.305, .205, .265, .038, .04, .008), [0, 1.415, -.208], colors.armorLight);
add("Left pectoral facet", "torso", taperedPlate(.145, .095, .18, .023, .024, .004), [-.08, 1.46, -.249], colors.edge, [0, 0, -.045]);
add("Right pectoral facet", "torso", taperedPlate(.145, .095, .18, .023, .024, .004), [.08, 1.46, -.249], colors.armor, [0, 0, .045]);
add("Chest black emblem field", "identity", taperedPlate(.155, .12, .18, .018, .025, .004), [0, 1.405, -.265], colors.visor);
add("Upper collar armor", "torso", taperedPlate(.36, .31, .075, .10, .026, .008), [0, 1.575, -.015], colors.armorLight);
add("Back outer armor", "torso", taperedPlate(.35, .27, .30, .052, .048, .009), [0, 1.405, .155], colors.armor);
add("Back black identity field", "identity", chamferedBox(.18, .145, .021, .028, .004), [0, 1.41, .19], colors.visor);

// Chest lightning and rear BW-inspired strokes.
add("Chest lightning emblem", "identity", lightningBolt(.066, .145, .012), [0, 1.415, -.28], colors.accent);
for (const [index, x] of [-.052, 0, .052].entries()) {
  add(`Rear identity stroke ${index + 1}`, "identity", chamferedBox(.035, .085, .013, .008, .002), [x, 1.415, .25], colors.accent, [0, 0, index === 1 ? .18 : -.18]);
}

// Arms and hands with clear shoulder, elbow, wrist, palm, and finger separation.
for (const side of [-1, 1]) {
  const isLeft = side < 0;
  const group = isLeft ? "left-arm" : "right-arm";
  const label = isLeft ? "Left" : "Right";
  add(`${label} shoulder joint`, group, new THREE.SphereGeometry(.073, 8, 6), [side * .305, 1.49, 0], colors.joint);
  add(`${label} shoulder outer shell`, group, taperedPlate(.135, .16, .14, .165, .032, .009), [side * .345, 1.49, -.005], colors.armorLight, [0, 0, side * .18]);
  add(`${label} shoulder front facet`, group, taperedPlate(.105, .125, .09, .034, .021, .005), [side * .35, 1.51, -.103], colors.edge, [0, 0, side * .18]);
  add(`${label} upper arm core`, group, new THREE.CylinderGeometry(.059, .053, .27, 8), [side * .365, 1.315, 0], colors.joint, [0, 0, side * .045], [1, 1, .80]);
  add(`${label} upper arm armor`, group, taperedPlate(.105, .12, .225, .047, .022, .007), [side * .37, 1.315, -.07], colors.armor, [0, 0, side * .045]);
  add(`${label} upper arm outer facet`, group, taperedPlate(.065, .078, .15, .026, .015, .004), [side * .423, 1.32, -.015], colors.armorDark, [0, Math.PI / 2, side * .045]);
  add(`${label} elbow joint`, group, new THREE.SphereGeometry(.061, 8, 6), [side * .378, 1.14, 0], colors.joint, [0, 0, 0], [1, .84, .92]);
  add(`${label} elbow red ring`, "identity", new THREE.TorusGeometry(.039, .009, 6, 12), [side * .378, 1.14, -.054], colors.accent);
  add(`${label} lower arm core`, group, new THREE.CylinderGeometry(.049, .062, .28, 8), [side * .385, .965, 0], colors.joint, [0, 0, side * .018], [1, 1, .78]);
  add(`${label} forearm armor`, group, taperedPlate(.10, .12, .235, .047, .022, .007), [side * .39, .97, -.066], colors.armorLight, [0, 0, side * .018]);
  add(`${label} forearm inset`, group, taperedPlate(.055, .072, .15, .022, .013, .003), [side * .39, .985, -.103], colors.armor, [0, 0, side * .018]);
  add(`${label} wrist joint`, group, new THREE.CylinderGeometry(.039, .042, .055, 8), [side * .394, .80, 0], colors.joint);
  add(`${label} palm`, group, taperedPlate(.082, .095, .095, .095, .018, .006), [side * .398, .73, -.005], colors.armorDark);
  for (const [fingerIndex, z] of [-.052, -.017, .018, .053].entries()) {
    add(`${label} finger ${fingerIndex + 1}`, group, chamferedBox(.017, .105, .021, .004, .0015), [side * .40, .635, z * .72], colors.armorLight, [0, 0, side * .025]);
  }
  add(`${label} thumb`, group, chamferedBox(.022, .072, .028, .005, .002), [side * .435, .705, -.01], colors.armorLight, [0, 0, side * .34]);
}

// Helmet and neck. The outer octagon is layered instead of a single block.
add("Neck mechanical column", "head", new THREE.CylinderGeometry(.058, .07, .105, 10), [0, 1.61, 0], colors.joint);
add("Helmet armored shell", "head", chamferedBox(.275, .25, .255, .052, .012), [0, 1.715, 0], colors.armorDark);
add("Helmet crown plate", "head", chamferedBox(.185, .035, .105, .014, .004), [0, 1.835, -.005], colors.armorLight);
add("Helmet brow plate", "head", taperedPlate(.225, .255, .055, .042, .018, .005), [0, 1.80, -.145], colors.armor);
add("Faceplate metallic rim", "head", chamferedBox(.245, .205, .046, .044, .008), [0, 1.71, -.145], colors.edge);
add("Inset black face visor", "identity", chamferedBox(.205, .165, .024, .036, .004), [0, 1.707, -.18], colors.visor);
add("Left red eye", "identity", chamferedBox(.020, .075, .011, .007, .002), [-.052, 1.715, -.198], colors.accent);
add("Right red eye", "identity", chamferedBox(.020, .075, .011, .007, .002), [.052, 1.715, -.198], colors.accent);
for (const side of [-1, 1]) {
  const label = side < 0 ? "Left" : "Right";
  add(`${label} helmet side module`, "head", new THREE.CylinderGeometry(.057, .057, .045, 10), [side * .15, 1.715, 0], colors.armorLight, [0, 0, Math.PI / 2]);
  add(`${label} helmet side inset`, "head", new THREE.CylinderGeometry(.035, .035, .052, 10), [side * .152, 1.715, 0], colors.joint, [0, 0, Math.PI / 2]);
}

// Reference rebuild v2. The previous prototype above is deliberately discarded:
// this output is reconstructed from the clean front/side/back turnaround supplied by the user.
objects.length = 0;
objectId = 1;

const frontZ = -.095;

function addRing(name, groupId, position, outerRadius, color = colors.accent, rotation = [0, 0, 0]) {
  add(name, groupId, new THREE.TorusGeometry(outerRadius, outerRadius * .18, 6, 16), position, color, rotation, [1, 1, 1], .34);
}

function addPanelBolt(name, groupId, x, y, z) {
  add(name, groupId, new THREE.CylinderGeometry(.006, .006, .005, 8), [x, y, z], colors.joint, [Math.PI / 2, 0, 0], [1, 1, 1], .42);
}

// Feet, ankles, shins, knees and thighs.
for (const side of [-1, 1]) {
  const left = side < 0;
  const group = left ? "left-leg" : "right-leg";
  const label = left ? "Left" : "Right";
  const x = side * .125;

  add(`${label} foot black sole`, group, chamferedBox(.19, .045, .34, .025, .006), [x, .028, -.055], colors.joint);
  add(`${label} foot main shell`, group, polygonPlate([[-.085,-.06],[.085,-.06],[.075,.055],[.035,.105],[-.055,.105],[-.085,.045]], .255, .007), [x, .105, -.105], colors.armorLight, [-Math.PI / 2, 0, 0]);
  add(`${label} foot toe facet`, group, chamferedBox(.17, .062, .105, .018, .004), [x, .078, -.235], colors.edge, [-.05, 0, 0]);
  add(`${label} foot instep facet`, group, taperedPlate(.12, .165, .09, .045, .018, .005), [x, .145, -.13], colors.armor);
  add(`${label} heel armor`, group, chamferedBox(.13, .095, .12, .022, .006), [x, .105, .095], colors.armorDark);
  add(`${label} ankle block`, group, new THREE.CylinderGeometry(.058, .058, .095, 10), [x, .185, 0], colors.joint, [0, 0, 0], [1, 1, .86]);
  addRing(`${label} outer ankle ring`, "identity", [x + side * .058, .185, 0], .036, colors.accent, [0, Math.PI / 2, 0]);

  add(`${label} shin mechanical core`, group, new THREE.CylinderGeometry(.067, .052, .31, 8), [x, .36, 0], colors.joint, [0, 0, 0], [1, 1, .68]);
  add(`${label} shin full front armor`, group, polygonPlate([[-.062,.17],[.062,.17],[.075,.09],[.058,-.15],[.035,-.18],[-.035,-.18],[-.058,-.15],[-.075,.09]], .045, .006), [x, .37, -.078], colors.armorLight);
  add(`${label} shin left facet`, group, polygonPlate([[-.055,.14],[0,.17],[0,-.15],[-.035,-.17],[-.058,-.13]], .014, .002), [x-.002, .37, -.108], colors.armor);
  add(`${label} shin right facet`, group, polygonPlate([[0,.17],[.055,.14],[.058,-.13],[.035,-.17],[0,-.15]], .014, .002), [x+.002, .37, -.108], colors.edge);
  add(`${label} calf rear shell`, group, polygonPlate([[-.055,.14],[.055,.14],[.065,.03],[.045,-.15],[-.045,-.15],[-.065,.03]], .032, .005), [x, .37, .062], colors.armor);

  add(`${label} knee mechanical joint`, group, new THREE.SphereGeometry(.083, 10, 7), [x, .575, 0], colors.joint, [0, 0, 0], [1, .9, .95]);
  add(`${label} knee front hub`, group, new THREE.CylinderGeometry(.061, .061, .035, 12), [x, .575, -.072], colors.armorDark, [Math.PI / 2, 0, 0]);
  addRing(`${label} knee red ring`, "identity", [x, .575, -.093], .048);
  add(`${label} knee center cap`, group, new THREE.CylinderGeometry(.034, .034, .041, 12), [x, .575, -.098], colors.joint, [Math.PI / 2, 0, 0]);

  add(`${label} thigh mechanical core`, group, new THREE.CylinderGeometry(.081, .073, .31, 10), [x, .775, 0], colors.joint, [0, 0, side * .015], [1, 1, .70]);
  add(`${label} thigh broad armor`, group, polygonPlate([[-.078,.17],[.078,.17],[.09,.11],[.07,-.15],[.045,-.18],[-.045,-.18],[-.07,-.15],[-.09,.11]], .05, .007), [x, .785, -.078], colors.armorLight, [0, 0, side * .015]);
  add(`${label} thigh inner facet`, group, polygonPlate([[0,.16],[.066,.14],[.075,-.13],[.04,-.17],[0,-.15]], .014, .002), [x, .785, -.114], colors.armor, [0, 0, side * .015]);
  add(`${label} thigh outer facet`, group, polygonPlate([[-.066,.14],[0,.16],[0,-.15],[-.04,-.17],[-.075,-.13]], .014, .002), [x, .785, -.114], colors.edge, [0, 0, side * .015]);
  add(`${label} thigh rear armor`, group, polygonPlate([[-.065,.15],[.065,.15],[.078,.08],[.058,-.15],[.035,-.17],[-.035,-.17],[-.058,-.15],[-.078,.08]], .032, .005), [x, .785, .066], colors.armor);
  add(`${label} hip black drum`, group, new THREE.CylinderGeometry(.086, .086, .105, 12), [x, .98, 0], colors.joint, [0, 0, Math.PI / 2]);
  addRing(`${label} outer hip red ring`, "identity", [x + side * .062, .98, 0], .049, colors.accent, [0, Math.PI / 2, 0]);
}

// Pelvis and narrow segmented waist.
add("Pelvis inner mechanism", "torso", new THREE.CylinderGeometry(.19, .18, .17, 10), [0, 1.00, 0], colors.joint, [0, 0, 0], [1, 1, .72]);
add("Pelvis silver belt", "torso", polygonPlate([[-.205,.055],[-.15,.115],[-.055,.085],[0,.035],[.055,.085],[.15,.115],[.205,.055],[.17,-.07],[.08,-.11],[-.08,-.11],[-.17,-.07]], .18, .008), [0, 1.035, -.055], colors.armorLight);
add("Pelvis center codpiece", "torso", polygonPlate([[-.075,.075],[.075,.075],[.095,.015],[.045,-.11],[-.045,-.11],[-.095,.015]], .035, .005), [0, 1.015, -.16], colors.armor);
add("Waist flexible column", "torso", new THREE.CylinderGeometry(.145, .155, .235, 10), [0, 1.16, 0], colors.joint, [0, 0, 0], [1, 1, .70]);
for (const [index, y] of [1.09, 1.15, 1.21].entries()) {
  add(`Waist horizontal segment ${index + 1}`, "torso", chamferedBox(.275, .037, .16, .012, .003), [0, y, -.025], colors.armorDark);
}

// Chest: dark structural shell, split silver breastplates, inset hexagonal identity panel.
add("Chest dark structural shell", "torso", new THREE.CylinderGeometry(.245, .16, .38, 8), [0, 1.40, 0], colors.armorDark, [0, 0, 0], [1, 1, .68]);
add("Chest left outer breastplate", "torso", polygonPlate([[-.23,.14],[-.16,.19],[-.035,.155],[-.07,.045],[-.115,-.14],[-.19,-.10]], .043, .006), [0, 1.41, -.105], colors.armorLight);
add("Chest right outer breastplate", "torso", polygonPlate([[.23,.14],[.16,.19],[.035,.155],[.07,.045],[.115,-.14],[.19,-.10]], .043, .006), [0, 1.41, -.105], colors.edge);
add("Chest lower left plate", "torso", polygonPlate([[-.19,-.09],[-.11,-.14],[-.075,-.04],[-.105,.015],[-.205,.025]], .035, .005), [0, 1.39, -.115], colors.armor);
add("Chest lower right plate", "torso", polygonPlate([[.19,-.09],[.11,-.14],[.075,-.04],[.105,.015],[.205,.025]], .035, .005), [0, 1.39, -.115], colors.armorLight);
add("Chest black hexagonal field", "identity", polygonPlate([[-.10,.13],[.10,.13],[.135,.055],[.10,-.12],[-.10,-.12],[-.135,.055]], .026, .004), [0, 1.405, -.145], colors.visor);
add("Chest lightning emblem", "identity", lightningBolt(.072, .18, .012), [0, 1.41, -.164], colors.accent);
add("Chest lower center block", "torso", taperedPlate(.15, .12, .09, .07, .018, .006), [0, 1.245, -.09], colors.armorDark);
add("Upper back armor shell", "torso", polygonPlate([[-.215,.15],[-.16,.19],[.16,.19],[.215,.15],[.205,-.12],[.13,-.17],[-.13,-.17],[-.205,-.12]], .045, .006), [0, 1.405, .102], colors.armor);
add("Back black identity field", "identity", polygonPlate([[-.10,.12],[.10,.12],[.13,.06],[.10,-.11],[-.10,-.11],[-.13,.06]], .021, .003), [0, 1.415, .135], colors.visor);

// BW rear mark built from separate red strokes.
add("Back B spine", "identity", chamferedBox(.017, .14, .012, .004, .001), [-.062, 1.42, .152], colors.accent);
add("Back B top stroke", "identity", chamferedBox(.047, .015, .012, .004, .001), [-.038, 1.482, .152], colors.accent);
add("Back B center stroke", "identity", chamferedBox(.047, .015, .012, .004, .001), [-.038, 1.425, .152], colors.accent);
add("Back B bottom stroke", "identity", chamferedBox(.047, .015, .012, .004, .001), [-.038, 1.363, .152], colors.accent);
add("Back B upper curve", "identity", chamferedBox(.015, .05, .012, .004, .001), [-.015, 1.454, .152], colors.accent, [0, 0, -.16]);
add("Back B lower curve", "identity", chamferedBox(.015, .05, .012, .004, .001), [-.015, 1.394, .152], colors.accent, [0, 0, .16]);
add("Back W left stroke", "identity", chamferedBox(.018, .115, .012, .004, .001), [.023, 1.42, .152], colors.accent, [0, 0, .22]);
add("Back W center stroke", "identity", chamferedBox(.018, .09, .012, .004, .001), [.055, 1.405, .152], colors.accent, [0, 0, -.24]);
add("Back W right stroke", "identity", chamferedBox(.018, .115, .012, .004, .001), [.085, 1.42, .152], colors.accent, [0, 0, .22]);

// Shoulder caps, articulated arms, wrists, palms and four fingers.
for (const side of [-1, 1]) {
  const left = side < 0;
  const group = left ? "left-arm" : "right-arm";
  const label = left ? "Left" : "Right";
  const x = side * .36;
  add(`${label} shoulder black joint`, group, new THREE.SphereGeometry(.082, 10, 7), [side * .29, 1.49, 0], colors.joint, [0, 0, 0], [1, .92, .98]);
  add(`${label} shoulder armored cap`, group, new THREE.SphereGeometry(.105, 8, 5), [x, 1.49, -.01], colors.armorLight, [0, side * -.12, side * .12], [1, .82, .72]);
  add(`${label} shoulder outer facet`, group, taperedPlate(.10, .072, .105, .024, .017, .004), [side * .402, 1.49, -.045], colors.armor, [0, side * -.12, side * .12]);
  add(`${label} shoulder side hub`, group, new THREE.CylinderGeometry(.062, .062, .045, 12), [side * .305, 1.49, 0], colors.armorDark, [0, 0, Math.PI / 2]);
  addRing(`${label} shoulder side red ring`, "identity", [side * .332, 1.49, 0], .045, colors.accent, [0, Math.PI / 2, 0]);

  add(`${label} upper arm core`, group, new THREE.CylinderGeometry(.052, .058, .26, 9), [side * .39, 1.30, 0], colors.joint, [0, 0, side * .05], [1, 1, .68]);
  add(`${label} upper arm front armor`, group, polygonPlate([[-.052,.13],[.052,.13],[.065,.07],[.045,-.12],[.02,-.14],[-.035,-.135],[-.06,-.08]], .036, .005), [side * .395, 1.30, -.052], colors.armorLight, [0, 0, side * .05]);
  add(`${label} upper arm outer armor`, group, taperedPlate(.075, .095, .19, .035, .016, .004), [side * .445, 1.30, -.01], colors.armor, [0, Math.PI / 2, side * .05]);

  add(`${label} elbow joint`, group, new THREE.SphereGeometry(.067, 10, 7), [side * .405, 1.11, 0], colors.joint, [0, 0, 0], [1, .9, .96]);
  add(`${label} elbow front hub`, group, new THREE.CylinderGeometry(.047, .047, .034, 12), [side * .405, 1.11, -.062], colors.armorDark, [Math.PI / 2, 0, 0]);
  addRing(`${label} elbow red ring`, "identity", [side * .405, 1.11, -.082], .037);

  add(`${label} forearm core`, group, new THREE.CylinderGeometry(.047, .058, .285, 9), [side * .41, .91, 0], colors.joint, [0, 0, side * .015], [1, 1, .66]);
  add(`${label} forearm long armor`, group, polygonPlate([[-.055,.145],[.055,.145],[.065,.075],[.04,-.14],[.015,-.16],[-.04,-.145],[-.062,-.06]], .04, .005), [side * .413, .915, -.052], colors.armorLight, [0, 0, side * .015]);
  add(`${label} forearm center facet`, group, polygonPlate([[-.018,.12],[.043,.10],[.035,-.11],[0,-.145],[-.025,-.11]], .014, .002), [side * .413, .915, -.081], colors.armor);
  add(`${label} forearm rear armor`, group, polygonPlate([[-.048,.125],[.048,.125],[.058,.055],[.036,-.13],[0,-.15],[-.04,-.13],[-.058,-.04]], .028, .004), [side * .413, .915, .048], colors.armor);
  add(`${label} wrist joint`, group, new THREE.CylinderGeometry(.039, .043, .062, 9), [side * .416, .72, 0], colors.joint);
  add(`${label} hand palm shell`, group, polygonPlate([[-.045,.06],[.045,.06],[.055,.015],[.035,-.07],[-.035,-.07],[-.055,.015]], .075, .005), [side * .42, .655, -.02], colors.armor);
  for (const [fingerIndex, offset] of [-.032, -.011, .011, .032].entries()) {
    add(`${label} articulated finger ${fingerIndex + 1}`, group, chamferedBox(.014, .105, .018, .003, .001), [side * .423, .565, offset], colors.armorDark, [0, 0, side * .08]);
    add(`${label} finger joint ${fingerIndex + 1}`, group, new THREE.SphereGeometry(.009, 6, 4), [side * .423, .61, offset], colors.joint);
  }
  add(`${label} articulated thumb`, group, chamferedBox(.019, .08, .024, .004, .001), [side * .462, .625, -.018], colors.armorDark, [0, 0, side * .42]);
}

// Neck and helmet reconstructed from the front and profile silhouettes.
add("Neck central column", "head", new THREE.CylinderGeometry(.062, .07, .12, 10), [0, 1.585, 0], colors.joint);
add("Neck front rib", "head", chamferedBox(.095, .08, .055, .014, .003), [0, 1.59, -.07], colors.armorDark);
add("Helmet dark core", "head", new THREE.SphereGeometry(.16, 8, 6), [0, 1.72, 0], colors.armorDark, [0, 0, 0], [1, .86, .82]);
add("Helmet top crown", "head", polygonPlate([[-.105,.045],[-.075,.075],[.075,.075],[.105,.045],[.12,-.04],[-.12,-.04]], .14, .006), [0, 1.815, -.005], colors.armorLight);
add("Helmet left brow shell", "head", polygonPlate([[-.13,.09],[-.045,.125],[-.055,.075],[-.105,.025],[-.135,-.035]], .043, .005), [0, 1.72, -.112], colors.armorLight);
add("Helmet right brow shell", "head", polygonPlate([[.13,.09],[.045,.125],[.055,.075],[.105,.025],[.135,-.035]], .043, .005), [0, 1.72, -.112], colors.edge);
add("Helmet left jaw shell", "head", polygonPlate([[-.135,.04],[-.105,-.025],[-.06,-.105],[-.025,-.125],[-.04,-.075],[-.085,-.035]], .041, .005), [0, 1.70, -.116], colors.armor);
add("Helmet right jaw shell", "head", polygonPlate([[.135,.04],[.105,-.025],[.06,-.105],[.025,-.125],[.04,-.075],[.085,-.035]], .041, .005), [0, 1.70, -.116], colors.armorLight);
add("Helmet black face visor", "identity", polygonPlate([[-.09,.105],[.09,.105],[.115,.07],[.115,-.065],[.075,-.11],[-.075,-.11],[-.115,-.065],[-.115,.07]], .022, .003), [0, 1.715, -.151], colors.visor);
add("Helmet visor inner bevel", "head", polygonPlate([[-.10,.115],[.10,.115],[.126,.075],[.126,-.072],[.082,-.122],[-.082,-.122],[-.126,-.072],[-.126,.075]], .011, .002), [0, 1.715, -.143], colors.edge);
add("Helmet visor black inset", "identity", polygonPlate([[-.088,.098],[.088,.098],[.108,.065],[.108,-.058],[.07,-.10],[-.07,-.10],[-.108,-.058],[-.108,.065]], .015, .002), [0, 1.715, -.161], colors.visor);
add("Left glowing visor eye", "identity", chamferedBox(.018, .075, .010, .006, .0015), [-.047, 1.72, -.174], colors.accent);
add("Right glowing visor eye", "identity", chamferedBox(.018, .075, .010, .006, .0015), [.047, 1.72, -.174], colors.accent);
add("Helmet rear upper plate", "head", taperedPlate(.22, .25, .105, .035, .024, .005), [0, 1.78, .112], colors.armorLight);
add("Helmet rear lower plate", "head", taperedPlate(.25, .205, .13, .035, .024, .005), [0, 1.67, .112], colors.armor);
for (const side of [-1, 1]) {
  const label = side < 0 ? "Left" : "Right";
  add(`${label} helmet ear housing`, "head", new THREE.CylinderGeometry(.06, .06, .05, 10), [side * .16, 1.72, 0], colors.armorLight, [0, 0, Math.PI / 2]);
  add(`${label} helmet ear dark cap`, "head", new THREE.CylinderGeometry(.041, .041, .056, 10), [side * .164, 1.72, 0], colors.joint, [0, 0, Math.PI / 2]);
  add(`${label} helmet side cheek`, "head", polygonPlate([[-.045,.08],[.045,.06],[.05,-.075],[0,-.11],[-.04,-.055]], .04, .005), [side * .135, 1.70, -.045], colors.armor, [0, Math.PI / 2, 0]);
}

// Small panel fasteners visible in the clean turnaround.
for (const [index, [x, y]] of [
  [-.17,1.53],[.17,1.53],[-.18,1.34],[.18,1.34],[-.065,1.52],[.065,1.52],
  [-.16,1.02],[.16,1.02],[-.055,.88],[.055,.88],[-.055,.40],[.055,.40]
].entries()) addPanelBolt(`Armor fastener ${index + 1}`, "identity", x, y, -.13);

// Humanoid rebuild v3: organic low-poly cores with separate triangular armor shards.
// The v2 slab-built result is archived under samples/assets/version-tests before this pass.
objects.length = 0;
objectId = 1;

function triangularPlate(name, groupId, points, position, color = colors.armorLight, depth = .018, rotation = [0, 0, 0]) {
  add(name, groupId, polygonPlate(points, depth, Math.min(.003, depth * .18)), position, color, rotation);
}

function lowPolyCapsule(radius, length, depthScale = .72) {
  const geometry = new THREE.CapsuleGeometry(radius, length, 3, 8);
  geometry.scale(1, 1, depthScale);
  return geometry;
}

// Human-proportioned legs: rounded inner mechanisms with triangular plates floating above them.
for (const side of [-1, 1]) {
  const left = side < 0;
  const group = left ? "left-leg" : "right-leg";
  const label = left ? "Left" : "Right";
  const x = side * .115;

  add(`${label} foot flexible core`, group, lowPolyCapsule(.064, .19, .82), [x, .085, -.085], colors.joint, [Math.PI / 2, 0, 0], [1.05, 1, 1]);
  triangularPlate(`${label} foot upper left triangle`, group, [[-.085,-.045],[.02,.075],[.075,-.045]], [x, .13, -.175], colors.armorLight, .025, [-.08, 0, 0]);
  triangularPlate(`${label} foot upper right triangle`, group, [[-.075,-.045],[-.02,.075],[.085,-.045]], [x, .13, -.177], colors.armor, .018, [-.08, 0, 0]);
  add(`${label} narrow sole`, group, chamferedBox(.175, .035, .32, .02, .004), [x, .025, -.075], colors.armorDark);
  add(`${label} ankle ball`, group, new THREE.SphereGeometry(.058, 8, 6), [x, .19, 0], colors.joint, [0, 0, 0], [1, 1, .82]);
  addRing(`${label} ankle side ring`, "identity", [x + side * .056, .19, 0], .034, colors.accent, [0, Math.PI / 2, 0]);

  add(`${label} lower leg organic core`, group, lowPolyCapsule(.058, .255, .65), [x, .375, 0], colors.joint);
  triangularPlate(`${label} shin upper triangle`, group, [[-.06,.15],[.06,.15],[-.035,-.16]], [x, .375, -.063], colors.armorLight, .024);
  triangularPlate(`${label} shin lower triangle`, group, [[.06,.15],[.035,-.16],[-.035,-.16]], [x, .375, -.066], colors.armor, .021);
  triangularPlate(`${label} shin center facet`, group, [[-.012,.13],[.03,.06],[.004,-.12]], [x, .375, -.081], colors.edge, .012);
  triangularPlate(`${label} calf rear upper triangle`, group, [[-.052,.13],[.052,.13],[0,-.07]], [x, .38, .058], colors.armor, .021, [0, Math.PI, 0]);
  triangularPlate(`${label} calf rear lower triangle`, group, [[-.045,.07],[.045,.07],[0,-.15]], [x, .37, .06], colors.armorDark, .018, [0, Math.PI, 0]);

  add(`${label} knee ball`, group, new THREE.SphereGeometry(.072, 10, 7), [x, .585, 0], colors.joint, [0, 0, 0], [1, .94, .9]);
  add(`${label} knee floating cap`, group, new THREE.CylinderGeometry(.052, .052, .026, 12), [x, .585, -.063], colors.armorDark, [Math.PI / 2, 0, 0]);
  addRing(`${label} knee luminous ring`, "identity", [x, .585, -.08], .041);

  add(`${label} thigh organic core`, group, lowPolyCapsule(.074, .255, .67), [x, .79, 0], colors.joint, [0, 0, side * .018]);
  triangularPlate(`${label} thigh left surface triangle`, group, [[-.075,.16],[.075,.16],[-.04,-.16]], [x, .79, -.078], colors.armorLight, .025, [0, 0, side * .018]);
  triangularPlate(`${label} thigh right surface triangle`, group, [[.075,.16],[.04,-.16],[-.04,-.16]], [x, .79, -.08], colors.armor, .021, [0, 0, side * .018]);
  triangularPlate(`${label} thigh left edge facet`, group, [[-.075,.14],[-.04,-.14],[-.066,-.08]], [x, .79, -.094], colors.edge, .014, [0, 0, side * .018]);
  triangularPlate(`${label} thigh right edge facet`, group, [[.075,.14],[.04,-.14],[.066,-.08]], [x, .79, -.095], colors.armorLight, .012, [0, 0, side * .018]);
  triangularPlate(`${label} thigh rear shard`, group, [[-.06,.14],[.06,.14],[0,-.15]], [x, .79, .068], colors.armor, .021, [0, Math.PI, side * -.018]);
  add(`${label} hip ball`, group, new THREE.SphereGeometry(.077, 10, 7), [x, .985, 0], colors.joint, [0, 0, 0], [1, .92, .82]);
  addRing(`${label} hip outer ring`, "identity", [x + side * .069, .985, 0], .042, colors.accent, [0, Math.PI / 2, 0]);
}

// Rounded pelvis, segmented abdomen and athletic tapered torso.
add("Humanoid pelvis core", "torso", new THREE.SphereGeometry(.19, 10, 7), [0, 1.03, 0], colors.joint, [0, 0, 0], [1, .58, .62]);
add("Humanoid pelvis armor shell", "torso", new THREE.SphereGeometry(.18, 8, 5), [0, 1.04, -.035], colors.armorDark, [0, 0, 0], [1, .52, .52]);
triangularPlate("Pelvis left wing", "torso", [[-.18,.07],[0,.09],[-.065,-.08]], [0, 1.04, -.095], colors.armorLight, .025);
triangularPlate("Pelvis right wing", "torso", [[.18,.07],[0,.09],[.065,-.08]], [0, 1.04, -.097], colors.edge, .022);
triangularPlate("Pelvis center shield", "torso", [[-.07,.07],[.07,.07],[0,-.11]], [0, 1.02, -.115], colors.armor, .022);
add("Flexible abdomen", "torso", lowPolyCapsule(.135, .13, .62), [0, 1.19, 0], colors.joint);
for (const [index, y] of [1.125, 1.18, 1.235].entries()) add(`Abdominal armor band ${index + 1}`, "torso", chamferedBox(.235 - index * .015, .026, .11, .008, .002), [0, y, -.045], colors.armorDark);

add("Athletic chest core", "torso", new THREE.CylinderGeometry(.235, .145, .36, 8), [0, 1.405, 0], colors.armorDark, [0, 0, 0], [1, 1, .64]);
triangularPlate("Chest left clavicle triangle", "torso", [[-.225,.15],[-.025,.17],[-.09,.015]], [0, 1.415, -.105], colors.armorLight, .032);
triangularPlate("Chest right clavicle triangle", "torso", [[.225,.15],[.025,.17],[.09,.015]], [0, 1.415, -.107], colors.edge, .027);
triangularPlate("Chest left lower triangle", "torso", [[-.205,.11],[-.09,.015],[-.12,-.15]], [0, 1.405, -.108], colors.armor, .024);
triangularPlate("Chest right lower triangle", "torso", [[.205,.11],[.09,.015],[.12,-.15]], [0, 1.405, -.11], colors.armorLight, .021);
add("Chest inset identity hex", "identity", polygonPlate([[-.09,.12],[.09,.12],[.12,.04],[.085,-.12],[-.085,-.12],[-.12,.04]], .023, .003), [0, 1.405, -.14], colors.visor);
add("Chest red lightning", "identity", lightningBolt(.066, .17, .011), [0, 1.41, -.157], colors.accent);
triangularPlate("Back left scapula triangle", "torso", [[-.21,.15],[-.02,.17],[-.10,-.14]], [0, 1.41, .105], colors.armor, .025, [0, Math.PI, 0]);
triangularPlate("Back right scapula triangle", "torso", [[.21,.15],[.02,.17],[.10,-.14]], [0, 1.41, .107], colors.armorLight, .021, [0, Math.PI, 0]);
add("Back identity hex", "identity", polygonPlate([[-.085,.105],[.085,.105],[.11,.04],[.08,-.10],[-.08,-.10],[-.11,.04]], .02, .003), [0, 1.42, .13], colors.visor);

// Humanlike shoulders and arms: small ball joints, rounded cores, triangular armor coverage.
for (const side of [-1, 1]) {
  const left = side < 0;
  const group = left ? "left-arm" : "right-arm";
  const label = left ? "Left" : "Right";
  const x = side * .345;
  add(`${label} shoulder ball`, group, new THREE.SphereGeometry(.075, 10, 7), [side * .28, 1.49, 0], colors.joint, [0, 0, 0], [1, .96, .9]);
  add(`${label} shoulder floating shell`, group, new THREE.SphereGeometry(.095, 8, 5), [x, 1.49, 0], colors.armorLight, [0, 0, side * .12], [1, .76, .66]);
  triangularPlate(`${label} shoulder triangular guard`, group, [[-.065,.055],[.055,.065],[.04,-.055]], [x, 1.50, -.066], colors.armor, .016, [0, 0, side * .12]);
  addRing(`${label} shoulder outer ring`, "identity", [side * .315, 1.49, 0], .041, colors.accent, [0, Math.PI / 2, 0]);

  add(`${label} upper arm muscle core`, group, lowPolyCapsule(.052, .17, .64), [side * .375, 1.315, 0], colors.joint, [0, 0, side * .045]);
  triangularPlate(`${label} upper arm left surface triangle`, group, [[-.05,.12],[.05,.11],[-.035,-.12]], [side * .378, 1.315, -.052], colors.armorLight, .022, [0, 0, side * .045]);
  triangularPlate(`${label} upper arm right surface triangle`, group, [[.05,.11],[.035,-.12],[-.035,-.12]], [side * .378, 1.315, -.054], colors.armor, .017, [0, 0, side * .045]);
  add(`${label} elbow ball`, group, new THREE.SphereGeometry(.059, 9, 6), [side * .39, 1.135, 0], colors.joint, [0, 0, 0], [1, .95, .9]);
  addRing(`${label} elbow luminous ring`, "identity", [side * .39, 1.135, -.064], .034);
  add(`${label} forearm muscle core`, group, lowPolyCapsule(.05, .19, .62), [side * .397, .95, 0], colors.joint, [0, 0, side * .018]);
  triangularPlate(`${label} forearm left surface triangle`, group, [[-.052,.14],[.052,.12],[-.028,-.145]], [side * .40, .95, -.052], colors.armorLight, .022, [0, 0, side * .018]);
  triangularPlate(`${label} forearm right surface triangle`, group, [[.052,.12],[.028,-.145],[-.028,-.145]], [side * .40, .95, -.054], colors.armor, .018, [0, 0, side * .018]);
  add(`${label} wrist ball`, group, new THREE.SphereGeometry(.038, 8, 5), [side * .402, .775, 0], colors.joint);
  add(`${label} compact palm`, group, lowPolyCapsule(.041, .045, .72), [side * .405, .705, -.005], colors.armorDark);
  triangularPlate(`${label} palm plate`, group, [[-.038,.045],[.038,.045],[0,-.05]], [side * .405, .705, -.046], colors.armor, .015);
  for (const [fingerIndex, z] of [-.027, -.009, .009, .027].entries()) add(`${label} slim finger ${fingerIndex + 1}`, group, lowPolyCapsule(.008, .055, .85), [side * .407, .63, z], colors.armorDark, [0, 0, side * .04]);
  add(`${label} slim thumb`, group, lowPolyCapsule(.009, .05, .85), [side * .438, .68, -.008], colors.armorDark, [0, 0, side * .42]);
}

// Oval humanlike helmet around a mechanical neck.
add("Humanoid neck", "head", lowPolyCapsule(.055, .035, .75), [0, 1.60, 0], colors.joint);
add("Oval helmet core", "head", new THREE.SphereGeometry(.155, 10, 7), [0, 1.72, 0], colors.armorDark, [1, .92, .83]);
triangularPlate("Helmet crown left triangle", "head", [[-.12,.07],[-.015,.13],[-.035,.015]], [0, 1.72, -.118], colors.armorLight, .023);
triangularPlate("Helmet crown right triangle", "head", [[.12,.07],[.015,.13],[.035,.015]], [0, 1.72, -.12], colors.edge, .019);
triangularPlate("Helmet jaw left triangle", "head", [[-.12,.045],[-.035,.015],[-.065,-.115]], [0, 1.705, -.12], colors.armor, .019);
triangularPlate("Helmet jaw right triangle", "head", [[.12,.045],[.035,.015],[.065,-.115]], [0, 1.705, -.122], colors.armorLight, .016);
add("Rounded black face visor", "identity", polygonPlate([[-.085,.095],[.085,.095],[.108,.055],[.105,-.055],[.065,-.10],[-.065,-.10],[-.105,-.055],[-.108,.055]], .019, .003), [0, 1.715, -.145], colors.visor);
add("Left narrow red eye", "identity", chamferedBox(.017, .068, .009, .005, .001), [-.046, 1.72, -.16], colors.accent);
add("Right narrow red eye", "identity", chamferedBox(.017, .068, .009, .005, .001), [.046, 1.72, -.16], colors.accent);
for (const side of [-1, 1]) {
  add(`${side < 0 ? "Left" : "Right"} ear joint`, "head", new THREE.CylinderGeometry(.044, .044, .035, 10), [side * .158, 1.72, 0], colors.joint, [0, 0, Math.PI / 2]);
  addRing(`${side < 0 ? "Left" : "Right"} ear ring`, "identity", [side * .18, 1.72, 0], .032, colors.armorLight, [0, Math.PI / 2, 0]);
}

// Compact rear BW mark retained as editable red strokes.
add("Humanoid back B spine", "identity", chamferedBox(.014, .115, .009, .003, .001), [-.052, 1.42, .146], colors.accent);
add("Humanoid back B upper", "identity", chamferedBox(.042, .013, .009, .003, .001), [-.03, 1.465, .146], colors.accent);
add("Humanoid back B lower", "identity", chamferedBox(.042, .013, .009, .003, .001), [-.03, 1.405, .146], colors.accent);
add("Humanoid back W left", "identity", chamferedBox(.014, .09, .009, .003, .001), [.02, 1.42, .146], colors.accent, [0, 0, .24]);
add("Humanoid back W middle", "identity", chamferedBox(.014, .07, .009, .003, .001), [.05, 1.41, .146], colors.accent, [0, 0, -.24]);
add("Humanoid back W right", "identity", chamferedBox(.014, .09, .009, .003, .001), [.078, 1.42, .146], colors.accent, [0, 0, .24]);

const project = {
  kind: "modeler-project",
  version: 1,
  name: "boltworks-player-avatar",
  savedAt: new Date().toISOString(),
  textureLibrary: [],
  scene: {
    version: 1,
    coordinateSystem: "Y-up right-handed; front faces -Z",
    groups,
    objects
  },
  editor: {
    projectName: "boltworks-player-avatar",
    selectedId: null,
    selectedGroupId: "avatar",
    checkedIds: [],
    activeGroupIds: ["avatar"],
    activeTransformMode: "move",
    facePickMode: false,
    referenceImage: embeddedReference,
    cameraViews: {
      selectedId: "avatar-front",
      showMarkers: false,
      views: [
        { id: "avatar-front", name: "Avatar Front", type: "director", position: [0, .95, -2.9], target: [0, .92, 0], up: [0, 1, 0], fov: 42 },
        { id: "avatar-left", name: "Avatar Left", type: "director", position: [-2.9, .95, 0], target: [0, .92, 0], up: [0, 1, 0], fov: 42 },
        { id: "avatar-back", name: "Avatar Back", type: "director", position: [0, .95, 2.9], target: [0, .92, 0], up: [0, 1, 0], fov: 42 },
        { id: "avatar-iso", name: "Avatar Iso", type: "director", position: [2.15, 1.55, -2.35], target: [0, .95, 0], up: [0, 1, 0], fov: 42 }
      ]
    },
    view: {
      cameraPosition: [2.5, 1.65, -2.7],
      orbitTarget: [0, .95, 0],
      cameraUp: [0, 1, 0],
      viewSpace: .45,
      shotZoom: .85,
      environment: "studio",
      background: "dark",
      showGrid: true,
      useCurrentZoomInShots: true,
      hideGridInShots: true
    },
    panels: { addMeshCollapsed: false, inspectorCollapsed: false, utilitiesCollapsed: false, cameraViewsCollapsed: false, statusCollapsed: false },
    toolbars: {},
    tools: {},
    lighting: { showGuides: false, enablePrimary: true, enableMirror: true, lampPosition: [-3, 4, -4], lampTarget: [0, 1, 0], intensity: 11, angle: 34 },
    rigging: { selectedBoneId: null, showGuides: false, bones: [] }
  }
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(project, null, 2)}\n`, "utf8");
if (process.argv.includes("--open")) {
  const pendingPath = path.resolve(".runtime/pending-open-project.json");
  fs.mkdirSync(path.dirname(pendingPath), { recursive: true });
  fs.writeFileSync(pendingPath, JSON.stringify({ fileName: path.basename(outputPath), data: project }), "utf8");
}
console.log(`Generated ${outputPath} with ${objects.length} editable parts.`);
