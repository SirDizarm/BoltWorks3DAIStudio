import fs from "node:fs";
import path from "node:path";
import * as THREE from "three";

// A clean reference-driven rebuild. This deliberately does not reuse the older
// avatar geometry; those versions stay available under samples/assets.
const outputPath = path.resolve("samples/assets/boltworks-player-avatar-v4-reference.modelerproj");
const referencePath = path.resolve(process.argv[process.argv.indexOf("--reference") + 1] || "C:/Users/sir_d/Downloads/ChatGPT Image 22 juli 2026 14_32_51.png");
const objects = [];
let nextId = 1;

const C = {
  silver: "#aeb3b7",
  silver2: "#858b90",
  silver3: "#62696f",
  dark: "#30363b",
  joint: "#111519",
  visor: "#050709",
  red: "#ff3b35"
};

const groups = [
  { id: "avatar", name: "Player Avatar V4 - Reference Rebuild", parentId: null },
  { id: "head", name: "Head", parentId: "avatar" },
  { id: "torso", name: "Torso", parentId: "avatar" },
  { id: "left-arm", name: "Left Arm", parentId: "avatar" },
  { id: "right-arm", name: "Right Arm", parentId: "avatar" },
  { id: "left-leg", name: "Left Leg", parentId: "avatar" },
  { id: "right-leg", name: "Right Leg", parentId: "avatar" },
  { id: "identity", name: "Red Identity Details", parentId: "avatar" }
];

const round = value => Math.round(value * 1e6) / 1e6;

function geometryData(geometry) {
  const source = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  source.computeVertexNormals();
  const p = source.getAttribute("position");
  const n = source.getAttribute("normal");
  const uv = source.getAttribute("uv");
  const positions = [], normals = [], uvs = [];
  for (let i = 0; i < p.count; i++) {
    positions.push(round(p.getX(i)), round(p.getY(i)), round(p.getZ(i)));
    normals.push(round(n.getX(i)), round(n.getY(i)), round(n.getZ(i)));
    if (uv) uvs.push(round(uv.getX(i)), round(uv.getY(i)));
  }
  source.dispose();
  geometry.dispose();
  return { positions, normals, uvs };
}

function add(name, groupId, geometry, position, color = C.silver, rotation = [0, 0, 0], roughness = .38) {
  objects.push({
    id: `player-v4-${nextId++}`,
    name,
    shape: "custom",
    geometry: geometryData(geometry),
    position: position.map(round),
    rotation: rotation.map(v => round(THREE.MathUtils.radToDeg(v))),
    scale: [1, 1, 1],
    color,
    roughness,
    opacity: 1,
    materialRule: color === C.red ? "emissive" : "metal",
    hidden: false,
    groupId,
    groupName: groups.find(g => g.id === groupId)?.name || null
  });
}

// Builds one closed, faceted volume from horizontal octagonal rings.
// Ring values are [localY, fullWidth, fullDepth, optionalZOffset].
function loft(rings, segments = 8, phase = Math.PI / 8) {
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let r = 0; r < rings.length; r++) {
    const [y, width, depth, offsetZ = 0] = rings[r];
    for (let s = 0; s < segments; s++) {
      const a = phase + s / segments * Math.PI * 2;
      positions.push(Math.cos(a) * width / 2, y, Math.sin(a) * depth / 2 + offsetZ);
      uvs.push(s / segments, r / Math.max(1, rings.length - 1));
    }
  }
  for (let r = 0; r < rings.length - 1; r++) {
    for (let s = 0; s < segments; s++) {
      const a = r * segments + s;
      const b = r * segments + (s + 1) % segments;
      const c = (r + 1) * segments + (s + 1) % segments;
      const d = (r + 1) * segments + s;
      indices.push(a, b, d, b, c, d);
    }
  }
  const bottom = positions.length / 3;
  const top = bottom + 1;
  positions.push(0, rings[0][0], rings[0][3] || 0, 0, rings.at(-1)[0], rings.at(-1)[3] || 0);
  uvs.push(.5, .5, .5, .5);
  for (let s = 0; s < segments; s++) {
    indices.push(bottom, (s + 1) % segments, s);
    const offset = (rings.length - 1) * segments;
    indices.push(top, offset + s, offset + (s + 1) % segments);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  return g;
}

function plate(points, depth = .018, bevel = .003) {
  const shape = new THREE.Shape();
  points.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y));
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(.002, depth - bevel * 2), steps: 1, curveSegments: 1,
    bevelEnabled: bevel > 0, bevelSegments: 1, bevelSize: bevel, bevelThickness: bevel
  });
  g.translate(0, 0, -(depth - bevel * 2) / 2);
  return g;
}

function octPlate(width, height, depth = .018, cut = .025) {
  const x = width / 2, y = height / 2, c = Math.min(cut, x * .42, y * .42);
  return plate([[-x + c,-y],[x-c,-y],[x,-y+c],[x,y-c],[x-c,y],[-x+c,y],[-x,y-c],[-x,-y+c]], depth);
}

function torus(radius, tube = .009) {
  return new THREE.TorusGeometry(radius, tube, 6, 16);
}

function disc(radius, depth, segments = 12) {
  return new THREE.CylinderGeometry(radius, radius, depth, segments);
}

function box(width, height, depth, bevel = .012) {
  return octPlate(width, height, depth, bevel);
}

function wedgeFoot(width, height, length) {
  const x = width / 2, zf = -length * .58, zb = length * .42;
  const p = [
    -x,0,zf, x,0,zf, x,0,zb, -x,0,zb,
    -x*.88,height*.58,zf, x*.88,height*.58,zf,
    x*.72,height,zb*.55, -x*.72,height,zb*.55
  ];
  const faces = [
    0,2,1,0,3,2, 4,5,6,4,6,7,
    0,1,5,0,5,4, 1,2,6,1,6,5,
    2,3,7,2,7,6, 3,0,4,3,4,7
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(p,3));
  g.setIndex(faces);
  return g;
}

function lightning() {
  return plate([[-.018,.072],[.025,.072],[.005,.018],[.038,.018],[-.026,-.082],[-.005,-.018],[-.038,-.018]], .010, 0);
}

function ringAt(name, group, pos, radius, rotation = [Math.PI/2,0,0], color = C.red, tube = .008) {
  add(name, group, torus(radius, tube), pos, color, rotation, .25);
}

function identityBar(name, from, to, z = .179, thickness = .012) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const length = Math.hypot(dx, dy);
  const angle = Math.atan2(-dx, dy);
  add(name, "identity", box(thickness, length, .010, .003), [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, z], C.red, [0, 0, angle]);
}

function sidePlate(name, group, side, points, pos, color = C.silver, depth = .022) {
  add(name, group, plate(points, depth), pos, color, [0, side * Math.PI / 2, 0]);
}

// Feet, ankles, legs and hips. Proportions follow the 1.80 m reference.
for (const side of [-1, 1]) {
  const left = side < 0;
  const group = left ? "left-leg" : "right-leg";
  const label = left ? "Left" : "Right";
  const x = side * .132;
  add(`${label} foot dark sole`, group, wedgeFoot(.215,.055,.34), [x,.018,-.066], C.dark);
  add(`${label} foot armored shell`, group, wedgeFoot(.202,.115,.33), [x,.057,-.088], C.silver);
  add(`${label} toe upper facet`, group, plate([[-.075,-.032],[.075,-.032],[.052,.035],[-.045,.055]],.022), [x,.115,-.205], C.silver2, [-.16,0,0]);
  sidePlate(`${label} foot outer side armor`, group, side, [[-.135,-.045],[-.11,.035],[.045,.06],[.12,.015],[.105,-.045]], [x+side*.088,.07,-.045], C.silver2, .018);
  add(`${label} heel armor`, group, box(.16,.075,.075,.012), [x,.075,.085], C.silver3);
  add(`${label} ankle mechanism`, group, disc(.055,.07,12), [x,.18,0], C.joint, [0,0,Math.PI/2]);
  ringAt(`${label} ankle red outer ring`, "identity", [x+side*.039,.18,0], .034, [0,Math.PI/2,0]);
  add(`${label} shin inner mechanism`, group, loft([[-.15,.085,.095],[-.05,.10,.115],[.11,.09,.105],[.15,.07,.085]]), [x,.38,.01], C.joint);
  add(`${label} shin faceted armor`, group, loft([[-.15,.145,.155,-.012],[-.10,.175,.175,-.020],[.10,.185,.165,-.024],[.15,.145,.14,-.012]]), [x,.38,-.01], C.silver);
  add(`${label} shin front ridge`, group, plate([[-.035,-.13],[.035,-.13],[.052,.095],[0,.135],[-.052,.095]],.026), [x,.385,-.116], C.silver2);
  add(`${label} shin rear armor`, group, plate([[-.052,-.13],[.052,-.13],[.068,.095],[0,.135],[-.068,.095]],.022), [x,.385,.092], C.silver2, [0,Math.PI,0]);
  sidePlate(`${label} shin outer side plate`, group, side, [[-.09,-.14],[.075,-.12],[.105,.07],[.045,.145],[-.07,.12]], [x+side*.078,.38,.0], C.silver2, .018);
  add(`${label} knee black joint`, group, disc(.068,.085,12), [x,.595,0], C.joint, [Math.PI/2,0,0]);
  ringAt(`${label} knee red ring`, "identity", [x,.595,-.047], .044);
  add(`${label} knee center cap`, group, disc(.033,.025,10), [x,.595,-.061], C.dark, [Math.PI/2,0,0]);
  add(`${label} thigh core`, group, loft([[-.15,.12,.105],[-.05,.15,.13],[.12,.145,.125],[.15,.115,.095]]), [x,.81,.01], C.joint);
  add(`${label} thigh faceted armor`, group, loft([[-.15,.185,.165,-.012],[-.10,.225,.19,-.022],[.10,.235,.195,-.025],[.15,.19,.16,-.012]]), [x,.81,-.008], C.silver);
  add(`${label} thigh front center facet`, group, plate([[-.042,-.13],[.042,-.13],[.06,.11],[0,.145],[-.06,.11]],.026), [x,.815,-.143], C.silver2);
  add(`${label} thigh rear armor`, group, plate([[-.065,-.13],[.065,-.13],[.082,.105],[0,.145],[-.082,.105]],.022), [x,.815,.108], C.silver2, [0,Math.PI,0]);
  sidePlate(`${label} thigh outer side plate`, group, side, [[-.11,-.145],[.085,-.12],[.125,.065],[.075,.15],[-.085,.135]], [x+side*.095,.81,.005], C.silver2, .020);
  add(`${label} hip black joint`, group, disc(.072,.09,12), [x,.995,0], C.joint, [0,0,Math.PI/2]);
  ringAt(`${label} hip red side ring`, "identity", [x+side*.052,.995,0], .041, [0,Math.PI/2,0]);
}

// Pelvis and flexible waist.
add("Pelvis mechanical core", "torso", loft([[-.085,.27,.17],[-.02,.32,.19],[.07,.29,.18],[.085,.24,.15]]), [0,1.055,0], C.joint);
add("Pelvis main armor", "torso", loft([[-.075,.285,.17,-.012],[-.025,.415,.215,-.022],[.055,.38,.21,-.020],[.075,.29,.16,-.008]]), [0,1.07,-.003], C.silver);
add("Pelvis front shield", "torso", plate([[-.115,.062],[.115,.062],[.075,-.09],[-.075,-.09]],.028), [0,1.055,-.126], C.silver2);
for (const side of [-1,1]) sidePlate(`${side < 0 ? "Left" : "Right"} pelvis side shell`, "torso", side, [[-.13,-.082],[.11,-.072],[.155,.015],[.09,.098],[-.08,.082]], [side*.19,1.065,0], C.silver3, .024);
add("Waist flexible core", "torso", loft([[-.11,.22,.19],[.10,.215,.19]]), [0,1.22,0], C.joint);
for (const [i,y] of [1.145,1.19,1.235,1.28].entries()) add(`Waist segment ${i+1}`, "torso", box(.225-i*.006,.025,.19,.006), [0,y,-.005], i%2 ? C.dark : C.silver3);

// Chest: one coherent tapered volume with planar armor panels.
add("Torso faceted structural body", "torso", loft([[-.18,.31,.205],[-.10,.38,.235],[.08,.49,.27],[.16,.44,.235],[.18,.36,.205]]), [0,1.43,0], C.dark);
add("Torso front armor shell", "torso", loft([[-.16,.29,.145,-.038],[-.08,.37,.17,-.048],[.08,.47,.195,-.058],[.15,.42,.165,-.042]]), [0,1.43,-.040], C.silver2);
add("Left chest armor facet", "torso", plate([[-.215,.14],[-.025,.16],[-.062,.015],[-.14,-.13],[-.215,-.07]],.028), [0,1.43,-.154], C.silver);
add("Right chest armor facet", "torso", plate([[.215,.14],[.025,.16],[.062,.015],[.14,-.13],[.215,-.07]],.028), [0,1.43,-.157], C.silver);
add("Chest center black hex", "identity", plate([[-.09,.105],[.09,.105],[.12,.02],[.08,-.11],[-.08,-.11],[-.12,.02]],.022), [0,1.425,-.177], C.visor);
add("Chest red lightning", "identity", lightning(), [0,1.425,-.190], C.red);
add("Left collar plate", "torso", plate([[-.19,.035],[-.025,.07],[-.055,-.025],[-.15,-.055]],.023), [0,1.59,-.115], C.silver);
add("Right collar plate", "torso", plate([[.19,.035],[.025,.07],[.055,-.025],[.15,-.055]],.023), [0,1.59,-.117], C.silver2);
add("Back faceted armor shell", "torso", loft([[-.15,.29,.13,.040],[-.05,.37,.16,.050],[.10,.44,.18,.055],[.15,.38,.15,.040]]), [0,1.43,.055], C.silver2);
add("Back black identity hex", "identity", plate([[-.09,.105],[.09,.105],[.12,.02],[.08,-.11],[-.08,-.11],[-.12,.02]],.022), [0,1.44,.166], C.visor, [0,Math.PI,0]);
for (const side of [-1,1]) {
  const label = side < 0 ? "Left" : "Right";
  sidePlate(`${label} rib side armor`, "torso", side, [[-.17,-.14],[.13,-.12],[.18,.02],[.12,.16],[-.10,.15],[-.19,.04]], [side*.225,1.43,.005], C.silver3, .028);
  sidePlate(`${label} upper chest side facet`, "torso", side, [[-.12,-.01],[.07,-.035],[.17,.035],[.105,.13],[-.065,.14]], [side*.242,1.49,-.005], C.silver, .024);
}

// Back BW mark, made from separate editable red strokes.
add("Back B vertical", "identity", box(.014,.115,.010,.003), [-.058,1.44,.179], C.red);
add("Back B upper", "identity", box(.050,.014,.010,.003), [-.032,1.488,.179], C.red);
add("Back B middle", "identity", box(.045,.014,.010,.003), [-.034,1.44,.179], C.red);
add("Back B lower", "identity", box(.050,.014,.010,.003), [-.032,1.392,.179], C.red);
add("Back B upper curve", "identity", box(.014,.050,.010,.003), [-.005,1.466,.179], C.red);
add("Back B lower curve", "identity", box(.014,.050,.010,.003), [-.005,1.414,.179], C.red);
const backWPoints = [[.012,1.49],[.032,1.39],[.058,1.455],[.082,1.39],[.108,1.49]];
for (let i = 0; i < backWPoints.length - 1; i++) identityBar(`Back W stroke ${i + 1}`, backWPoints[i], backWPoints[i + 1]);

// Arms and hands.
for (const side of [-1, 1]) {
  const left = side < 0;
  const group = left ? "left-arm" : "right-arm";
  const label = left ? "Left" : "Right";
  const shoulderX = side*.302;
  add(`${label} shoulder black joint`, group, disc(.072,.085,12), [shoulderX,1.51,0], C.joint, [0,0,Math.PI/2]);
  ringAt(`${label} shoulder red ring`, "identity", [shoulderX+side*.048,1.51,0], .043, [0,Math.PI/2,0]);
  add(`${label} shoulder armor shell`, group, loft([[-.07,.15,.155],[-.02,.20,.19],[.055,.18,.17],[.075,.125,.135]]), [side*.35,1.51,-.003], C.silver, [0,0,side*.10]);
  sidePlate(`${label} shoulder outer cap`, group, side, [[-.105,-.07],[.09,-.055],[.13,.02],[.06,.09],[-.07,.075]], [side*.438,1.51,0], C.silver2, .020);
  add(`${label} upper arm core`, group, loft([[-.13,.085,.11],[.11,.095,.12],[.13,.075,.095]]), [side*.37,1.31,0], C.joint, [0,0,side*.035]);
  add(`${label} upper arm faceted armor`, group, loft([[-.12,.122,.135,-.010],[-.08,.155,.155,-.016],[.08,.15,.148,-.015],[.12,.115,.125,-.008]]), [side*.372,1.31,-.010], C.silver2, [0,0,side*.035]);
  add(`${label} upper arm light face`, group, plate([[-.042,-.105],[.042,-.105],[.058,.085],[0,.115],[-.058,.085]],.024), [side*.372,1.31,-.119], C.silver);
  add(`${label} upper arm rear face`, group, plate([[-.04,-.105],[.04,-.105],[.055,.082],[0,.112],[-.055,.082]],.020), [side*.372,1.31,.090], C.silver3, [0,Math.PI,0]);
  sidePlate(`${label} upper arm side plate`, group, side, [[-.075,-.105],[.065,-.09],[.09,.065],[.035,.115],[-.06,.09]], [side*.433,1.31,.0], C.silver, .016);
  add(`${label} elbow joint`, group, disc(.058,.075,12), [side*.384,1.13,0], C.joint, [Math.PI/2,0,0]);
  ringAt(`${label} elbow red ring`, "identity", [side*.384,1.13,-.043], .036);
  add(`${label} forearm core`, group, loft([[-.14,.075,.10],[.11,.09,.12],[.14,.07,.09]]), [side*.39,.94,0], C.joint, [0,0,side*.018]);
  add(`${label} forearm faceted armor`, group, loft([[-.13,.112,.13,-.008],[-.09,.15,.155,-.016],[.09,.155,.155,-.018],[.13,.108,.125,-.008]]), [side*.392,.94,-.009], C.silver, [0,0,side*.018]);
  add(`${label} forearm center facet`, group, plate([[-.038,-.11],[.038,-.11],[.055,.09],[0,.12],[-.055,.09]],.024), [side*.392,.94,-.119], C.silver2);
  add(`${label} forearm rear facet`, group, plate([[-.038,-.11],[.038,-.11],[.054,.088],[0,.118],[-.054,.088]],.020), [side*.392,.94,.090], C.silver3, [0,Math.PI,0]);
  sidePlate(`${label} forearm side plate`, group, side, [[-.085,-.12],[.065,-.105],[.10,.07],[.045,.125],[-.065,.10]], [side*.448,.94,0], C.silver2, .016);
  add(`${label} wrist joint`, group, disc(.038,.06,10), [side*.395,.77,0], C.joint, [0,0,Math.PI/2]);
  add(`${label} armored palm`, group, loft([[-.055,.09,.115],[.05,.10,.12],[.06,.082,.098]]), [side*.398,.695,-.005], C.silver3);
  for (const [i,z] of [-.036,-.012,.012,.036].entries()) {
    add(`${label} finger ${i+1} upper`, group, loft([[-.028,.018,.018],[.026,.016,.016]],6), [side*.398,.625,z], C.dark, [0,0,side*.035]);
    add(`${label} finger ${i+1} tip`, group, loft([[-.027,.016,.016],[.025,.012,.012]],6), [side*.398,.574,z], C.silver3, [0,0,side*.025]);
  }
  add(`${label} thumb`, group, loft([[-.04,.022,.022],[.04,.016,.016]],6), [side*.444,.66,-.035], C.dark, [0,0,side*.52]);
}

// Neck and helmet.
add("Neck mechanical column", "head", loft([[-.055,.095,.105],[.055,.09,.10]]), [0,1.61,0], C.joint);
for (const y of [1.575,1.61,1.645]) add(`Neck ring ${y}`, "head", disc(.052,.018,10), [0,y,0], C.dark);
add("Helmet faceted volume", "head", loft([[-.12,.25,.215],[-.085,.325,.26],[.045,.345,.275],[.105,.285,.24],[.125,.22,.20]]), [0,1.69,0], C.silver2);
add("Helmet crown front facet", "head", plate([[-.105,.035],[-.075,.075],[.075,.075],[.105,.035],[.065,-.02],[-.065,-.02]],.025), [0,1.755,-.126], C.silver);
add("Helmet left cheek facet", "head", plate([[-.12,.065],[-.07,.095],[-.072,-.095],[-.115,-.06]],.024), [0,1.675,-.129], C.silver);
add("Helmet right cheek facet", "head", plate([[.12,.065],[.07,.095],[.072,-.095],[.115,-.06]],.024), [0,1.675,-.131], C.silver);
add("Helmet rear octagonal armor", "head", octPlate(.245,.225,.024,.042), [0,1.69,.148], C.silver, [0,Math.PI,0]);
add("Helmet black octagonal visor", "identity", octPlate(.235,.215,.025,.040), [0,1.685,-.167], C.visor);
add("Left red eye", "identity", box(.015,.068,.010,.006), [-.052,1.69,-.181], C.red);
add("Right red eye", "identity", box(.015,.068,.010,.006), [.052,1.69,-.181], C.red);
for (const side of [-1,1]) {
  const label = side < 0 ? "Left" : "Right";
  add(`${label} ear housing`, "head", disc(.052,.035,10), [side*.145,1.695,0], C.dark, [0,0,Math.PI/2]);
  ringAt(`${label} ear silver rim`, "head", [side*.166,1.695,0], .038, [0,Math.PI/2,0], C.silver, .008);
  add(`${label} ear center`, "head", disc(.026,.012,8), [side*.177,1.695,0], C.joint, [0,0,Math.PI/2]);
}

// BWS' named Front view looks from +Z toward the origin. The reference build
// was authored facing -Z, so rotate the complete editable assembly once here.
// This preserves every local bevel, logo and foot direction without mirroring it.
const faceBwsFront = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
for (const object of objects) {
  const p = new THREE.Vector3(...object.position).applyQuaternion(faceBwsFront);
  object.position = [round(p.x), round(p.y), round(p.z)];
  const local = new THREE.Quaternion().setFromEuler(new THREE.Euler(
    THREE.MathUtils.degToRad(object.rotation[0]),
    THREE.MathUtils.degToRad(object.rotation[1]),
    THREE.MathUtils.degToRad(object.rotation[2]),
    "XYZ"
  ));
  const e = new THREE.Euler().setFromQuaternion(faceBwsFront.clone().multiply(local), "XYZ");
  object.rotation = [round(THREE.MathUtils.radToDeg(e.x)), round(THREE.MathUtils.radToDeg(e.y)), round(THREE.MathUtils.radToDeg(e.z))];
}

const ref = fs.existsSync(referencePath) ? {
  name: path.basename(referencePath),
  dataUrl: `data:image/png;base64,${fs.readFileSync(referencePath).toString("base64")}`,
  mode: "panel", opacity: .48, scale: 1, offsetX: 0, offsetY: 0
} : { name: "", dataUrl: null, mode: "panel", opacity: .48, scale: 1, offsetX: 0, offsetY: 0 };

const project = {
  kind: "modeler-project", version: 1, name: "boltworks-player-avatar-v4-reference", savedAt: new Date().toISOString(), textureLibrary: [],
  scene: { version: 1, coordinateSystem: "Y-up right-handed; front faces -Z", groups, objects },
  editor: {
    projectName: "boltworks-player-avatar-v4-reference", selectedId: null, selectedGroupId: "avatar", checkedIds: [], activeGroupIds: ["avatar"], activeTransformMode: "move", facePickMode: false,
    referenceImage: ref,
    cameraViews: { selectedId: "avatar-front", showMarkers: false, views: [
      { id:"avatar-front",name:"Avatar Front",type:"director",position:[0,.92,3.0],target:[0,.92,0],up:[0,1,0],fov:38,role:"Reference" },
      { id:"avatar-left",name:"Avatar Left",type:"director",position:[-3.0,.92,0],target:[0,.92,0],up:[0,1,0],fov:38,role:"Reference" },
      { id:"avatar-back",name:"Avatar Back",type:"director",position:[0,.92,-3.0],target:[0,.92,0],up:[0,1,0],fov:38,role:"Reference" },
      { id:"avatar-iso",name:"Avatar Iso",type:"director",position:[2.35,1.45,-2.65],target:[0,.95,0],up:[0,1,0],fov:40,role:"Inspection" }
    ]},
    view: { cameraPosition:[2.35,1.45,-2.65],orbitTarget:[0,.95,0],cameraUp:[0,1,0],viewSpace:.45,shotZoom:.93,environment:"studio",background:"dark",showGrid:true,useCurrentZoomInShots:true,hideGridInShots:true },
    panels:{addMeshCollapsed:false,inspectorCollapsed:false,utilitiesCollapsed:false,cameraViewsCollapsed:false,statusCollapsed:false}, toolbars:{}, tools:{},
    lighting:{showGuides:false,enablePrimary:true,enableMirror:true,lampPosition:[-3,4,-4],lampTarget:[0,1,0],intensity:12,angle:32},
    rigging:{selectedBoneId:null,showGuides:false,bones:[]}
  }
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(project, null, 2)}\n`, "utf8");
if (process.argv.includes("--open")) {
  const pendingPath = path.resolve(".runtime/pending-open-project.json");
  fs.mkdirSync(path.dirname(pendingPath), { recursive: true });
  fs.writeFileSync(pendingPath, JSON.stringify({ fileName:path.basename(outputPath), data:project }), "utf8");
}
console.log(`Generated ${outputPath} with ${objects.length} new editable parts and ${objects.reduce((sum,o)=>sum+o.geometry.positions.length/9,0)} triangles.`);
