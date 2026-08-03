import { writeFile } from 'node:fs/promises';

const out = new URL('../samples/showcases/boltworks-gt3-racer-from-scratch.modelerproj', import.meta.url);
const groups = [
  ['car', 'BoltWorks GT3 Racer', null],
  ['chassis', 'Chassis', 'car'],
  ['body', 'Bodywork', 'car'],
  ['cockpit', 'Cockpit and Glass', 'car'],
  ['wheels', 'Wheels and Brakes', 'car'],
  ['aero', 'Aerodynamics', 'car'],
  ['lighting', 'Lighting', 'car'],
  ['livery', 'Generic Racing Livery', 'car'],
  ['interior', 'Interior', 'car'],
];

const objects = [];
let serial = 1;
function add(groupId, name, shape, position, scale, color, rotation = [0, 0, 0], roughness = 0.35, opacity = 1) {
  const group = groups.find(([id]) => id === groupId);
  objects.push({
    id: `gt3-${String(serial++).padStart(3, '0')}`,
    name,
    shape,
    position,
    rotation,
    scale,
    color,
    roughness,
    opacity,
    groupId,
    groupName: group?.[1] ?? groupId,
  });
}

const navy = '#0b1c35';
const navy2 = '#16385f';
const carbon = '#0a0d12';
const black = '#050608';
const yellow = '#edc400';
const red = '#e22a3f';
const glass = '#12364b';
const steel = '#687984';
const white = '#e9f4f7';

// Chassis: the proportions are deliberately built as a low, broad GT car.
add('chassis', 'Carbon floor', 'box', [0, 0.43, 0], [5.9, 0.18, 2.25], carbon, [0, 0, 0], 0.72);
add('chassis', 'Central safety tub', 'box', [-0.15, 0.73, 0], [3.1, 0.45, 1.55], '#202a34', [0, 0, 0], 0.62);
add('chassis', 'Front crash structure', 'box', [2.95, 0.62, 0], [0.72, 0.26, 1.85], '#202a34', [0, 0, 0], 0.62);
add('chassis', 'Rear crash structure', 'box', [-2.92, 0.62, 0], [0.64, 0.3, 1.85], '#202a34', [0, 0, 0], 0.62);
add('chassis', 'Front axle beam', 'cylinder', [1.92, 0.72, 0], [0.11, 2.8, 0.11], steel, [90, 0, 0], 0.28);
add('chassis', 'Rear axle beam', 'cylinder', [-1.82, 0.72, 0], [0.12, 2.94, 0.12], steel, [90, 0, 0], 0.28);

// Main body silhouette.
add('body', 'Lower body shell', 'box', [0, 0.95, 0], [5.55, 0.72, 2.24], navy, [0, 0, 0], 0.24);
add('body', 'Low front nose', 'pyramidFrustum', [2.72, 0.93, 0], [1.38, 1.06, 2.06], navy, [0, 0, -90], 0.22);
add('body', 'Sculpted hood', 'wedge', [1.45, 1.36, 0], [2.35, 0.48, 2.02], navy2, [0, 0, -5], 0.2);
add('body', 'Rear engine deck', 'wedge', [-1.86, 1.37, 0], [1.82, 0.46, 2.06], navy, [0, 180, 3], 0.22);
add('body', 'Front bumper', 'box', [3.05, 0.7, 0], [0.34, 0.34, 2.38], carbon, [0, 0, 0], 0.46);
add('body', 'Rear bumper', 'box', [-2.97, 0.78, 0], [0.3, 0.4, 2.3], carbon, [0, 0, 0], 0.46);
add('body', 'Left side skirt', 'box', [0, 0.64, -1.24], [4.8, 0.2, 0.2], carbon, [0, 0, 0], 0.42);
add('body', 'Right side skirt', 'box', [0, 0.64, 1.24], [4.8, 0.2, 0.2], carbon, [0, 0, 0], 0.42);
add('body', 'Left front fender', 'arch', [1.86, 1.12, -1.28], [1.5, 0.76, 0.34], navy2, [0, 0, 0], 0.2);
add('body', 'Right front fender', 'arch', [1.86, 1.12, 1.28], [1.5, 0.76, 0.34], navy2, [0, 180, 0], 0.2);
add('body', 'Left rear fender', 'arch', [-1.83, 1.16, -1.3], [1.62, 0.82, 0.36], navy, [0, 0, 0], 0.2);
add('body', 'Right rear fender', 'arch', [-1.83, 1.16, 1.3], [1.62, 0.82, 0.36], navy, [0, 180, 0], 0.2);
add('body', 'Roof shell', 'box', [-0.24, 2.1, 0], [1.84, 0.18, 1.76], carbon, [0, 0, 0], 0.3);
add('body', 'Roof scoop', 'wedge', [-0.38, 2.27, 0], [0.66, 0.22, 0.55], carbon, [0, 0, 0], 0.32);
add('body', 'Left door skin', 'panel', [0.0, 1.2, -1.23], [1.94, 0.84, 1], navy, [0, 0, 0], 0.22);
add('body', 'Right door skin', 'panel', [0.0, 1.2, 1.23], [1.94, 0.84, 1], navy, [0, 180, 0], 0.22);

// Cockpit, made as independent glass panels so it can be reshaped with Surface Edit.
add('cockpit', 'Windshield', 'panel', [0.58, 1.73, 0], [1.6, 0.86, 1], glass, [-90, 60, 90], 0.08, 0.62);
add('cockpit', 'Rear window', 'panel', [-1.02, 1.73, 0], [1.56, 0.72, 1], glass, [90, 60, -90], 0.08, 0.62);
add('cockpit', 'Left main side window', 'panel', [-0.16, 1.75, -0.88], [1.36, 0.52, 1], glass, [0, 0, 0], 0.08, 0.62);
add('cockpit', 'Right main side window', 'panel', [-0.16, 1.75, 0.88], [1.36, 0.52, 1], glass, [0, 180, 0], 0.08, 0.62);
add('cockpit', 'Left front side glass', 'wedge', [0.62, 1.76, -0.88], [0.36, 0.5, 0.06], glass, [0, 180, 0], 0.08, 0.62);
add('cockpit', 'Right front side glass', 'wedge', [0.62, 1.76, 0.88], [0.36, 0.5, 0.06], glass, [0, 180, 0], 0.08, 0.62);
add('cockpit', 'Left rear quarter glass', 'wedge', [-1.04, 1.76, -0.88], [0.3, 0.5, 0.06], glass, [0, 0, 0], 0.08, 0.62);
add('cockpit', 'Right rear quarter glass', 'wedge', [-1.04, 1.76, 0.88], [0.3, 0.5, 0.06], glass, [0, 0, 0], 0.08, 0.62);

// Four independent wheel assemblies.
for (const [corner, x, z, radius] of [
  ['Front left', 1.88, -1.5, 1.22], ['Front right', 1.88, 1.5, 1.22],
  ['Rear left', -1.82, -1.52, 1.34], ['Rear right', -1.82, 1.52, 1.34],
]) {
  const outside = z < 0 ? z - 0.1 : z + 0.1;
  add('wheels', `${corner} tire`, 'torus', [x, 0.72, z], [radius, radius, radius], black, [0, 0, 0], 0.9);
  add('wheels', `${corner} white sidewall`, 'ring', [x, 0.72, outside], [radius * 0.88, radius * 0.88, 0.12], white, [0, 0, 0], 0.34);
  add('wheels', `${corner} dark rim`, 'ring', [x, 0.72, outside * 1.01], [radius * 0.72, radius * 0.72, 0.22], '#111a24', [0, 0, 0], 0.18);
  add('wheels', `${corner} brake disc`, 'cylinder', [x, 0.72, z < 0 ? z + 0.03 : z - 0.03], [radius * 0.49, 0.06, radius * 0.49], steel, [90, 0, 0], 0.24);
  add('wheels', `${corner} center lock`, 'facetedBallLow', [x, 0.72, outside * 1.03], [0.2, 0.2, 0.14], red, [0, 0, 0], 0.16);
  add('wheels', `${corner} caliper`, 'box', [x - 0.2, 0.8, outside * 0.99], [0.16, 0.34, 0.1], yellow, [0, 0, 0], 0.26);
}

// Aero package: splitter, diffuser and the prominent GT3 rear wing.
add('aero', 'Front splitter', 'box', [3.16, 0.5, 0], [0.62, 0.08, 2.78], black, [0, 0, 0], 0.38);
add('aero', 'Splitter left fence', 'panel', [3.08, 0.58, -1.32], [0.55, 0.32, 1], carbon, [0, 0, 0], 0.4);
add('aero', 'Splitter right fence', 'panel', [3.08, 0.58, 1.32], [0.55, 0.32, 1], carbon, [0, 180, 0], 0.4);
add('aero', 'Rear diffuser', 'wedge', [-3.06, 0.53, 0], [0.74, 0.26, 2.52], black, [0, 180, 0], 0.4);
add('aero', 'Diffuser center fin', 'panel', [-3.06, 0.54, 0], [0.64, 0.28, 1], carbon, [90, 0, 0], 0.44);
add('aero', 'Rear wing lower plane', 'curvedPanel', [-2.34, 2.04, 0], [0.82, 2.8, 0.34], carbon, [90, 0, 0], 0.26);
add('aero', 'Rear wing upper plane', 'curvedPanel', [-2.34, 2.2, 0], [0.78, 2.8, 0.28], black, [90, 0, 0], 0.24);
add('aero', 'Left wing support', 'box', [-2.2, 1.67, -0.72], [0.16, 0.82, 0.12], carbon, [0, 0, 0], 0.36);
add('aero', 'Right wing support', 'box', [-2.2, 1.67, 0.72], [0.16, 0.82, 0.12], carbon, [0, 0, 0], 0.36);
add('aero', 'Left wing endplate', 'panel', [-2.34, 2.12, -1.38], [0.56, 0.5, 1], red, [0, 0, 0], 0.3);
add('aero', 'Right wing endplate', 'panel', [-2.34, 2.12, 1.38], [0.56, 0.5, 1], red, [0, 180, 0], 0.3);
add('aero', 'Left side intake', 'hollowBox', [-0.95, 1.23, -1.27], [0.8, 0.36, 0.2], black, [0, 0, 0], 0.44);
add('aero', 'Right side intake', 'hollowBox', [-0.95, 1.23, 1.27], [0.8, 0.36, 0.2], black, [0, 180, 0], 0.44);
add('aero', 'Left hood vent', 'hollowBox', [1.45, 1.62, -0.48], [0.72, 0.08, 0.26], carbon, [0, 0, -5], 0.44);
add('aero', 'Right hood vent', 'hollowBox', [1.45, 1.62, 0.48], [0.72, 0.08, 0.26], carbon, [0, 0, -5], 0.44);

// Lighting is intentionally simple and reusable for future vehicle assets.
add('lighting', 'Left headlight', 'sphere', [2.78, 1.16, -0.78], [0.4, 0.22, 0.32], '#d9f7ff', [0, 0, 0], 0.04);
add('lighting', 'Right headlight', 'sphere', [2.78, 1.16, 0.78], [0.4, 0.22, 0.32], '#d9f7ff', [0, 0, 0], 0.04);
add('lighting', 'Left DRL', 'capsule', [2.96, 0.98, -0.9], [0.11, 0.44, 0.11], white, [0, 0, 90], 0.04);
add('lighting', 'Right DRL', 'capsule', [2.96, 0.98, 0.9], [0.11, 0.44, 0.11], white, [0, 0, 90], 0.04);
add('lighting', 'Left tail lamp', 'capsule', [-2.96, 1.14, -0.75], [0.1, 0.4, 0.1], red, [0, 0, 90], 0.06);
add('lighting', 'Right tail lamp', 'capsule', [-2.96, 1.14, 0.75], [0.1, 0.4, 0.1], red, [0, 0, 90], 0.06);
add('lighting', 'Center rear light bar', 'capsule', [-3.0, 1.14, 0], [0.08, 0.66, 0.08], red, [0, 0, 90], 0.06);

// A generic livery in independent pieces (not copied branding).
add('livery', 'Left yellow door panel', 'panel', [0.02, 1.18, -1.255], [1.88, 0.7, 1], yellow, [0, 0, 0], 0.3);
add('livery', 'Right yellow door panel', 'panel', [0.02, 1.18, 1.255], [1.88, 0.7, 1], yellow, [0, 180, 0], 0.3);
add('livery', 'Left navy race field', 'panel', [0.08, 1.18, -1.272], [0.6, 0.52, 1], navy, [0, 0, 0], 0.2);
add('livery', 'Right navy race field', 'panel', [0.08, 1.18, 1.272], [0.6, 0.52, 1], navy, [0, 180, 0], 0.2);
add('livery', 'Roof red stripe', 'panel', [-0.18, 2.205, 0], [1.7, 0.28, 1], red, [90, 0, 0], 0.16);
add('livery', 'Hood red stripe', 'panel', [1.15, 1.62, 0], [1.44, 0.2, 1], red, [0, 0, -5], 0.18);
add('livery', 'Left splitter accent', 'capsule', [3.2, 0.57, -0.96], [0.06, 0.68, 0.06], red, [0, 0, 90], 0.14);
add('livery', 'Right splitter accent', 'capsule', [3.2, 0.57, 0.96], [0.06, 0.68, 0.06], red, [0, 0, 90], 0.14);
add('livery', 'Left mirror', 'sphere', [0.44, 1.58, -1.12], [0.22, 0.12, 0.16], red, [0, 0, 0], 0.2);
add('livery', 'Right mirror', 'sphere', [0.44, 1.58, 1.12], [0.22, 0.12, 0.16], red, [0, 0, 0], 0.2);

add('interior', 'Driver seat', 'capsule', [-0.32, 1.24, -0.42], [0.44, 0.74, 0.5], carbon, [0, 0, -10], 0.75);
add('interior', 'Passenger seat', 'capsule', [-0.32, 1.24, 0.42], [0.44, 0.74, 0.5], carbon, [0, 0, -10], 0.75);
add('interior', 'Dashboard', 'box', [0.5, 1.34, 0], [0.44, 0.32, 1.7], '#1d242b', [0, 0, -7], 0.58);
add('interior', 'Steering wheel', 'torus', [0.25, 1.47, -0.42], [0.46, 0.46, 0.46], black, [0, 90, 0], 0.45);
add('interior', 'Roll cage bar', 'cylinder', [-0.62, 1.75, 0], [0.05, 1.4, 0.05], '#9aa5ac', [90, 0, 0], 0.22);

const project = {
  kind: 'modeler-project',
  version: 1,
  name: 'boltworks-gt3-racer-from-scratch',
  savedAt: new Date().toISOString(),
  textureLibrary: [],
  scene: {
    version: 2,
    coordinateSystem: {
      handedness: 'right-handed', units: 'meters', upAxis: '+Y', groundPlane: 'XZ',
      rotationUnits: 'degrees', eulerOrder: 'XYZ', objectPositions: 'world space', geometryAndPivots: 'object-local space',
    },
    groups: groups.map(([id, name, parentId]) => ({ id, name, parentId })),
    objects,
  },
  editor: {
    projectName: 'boltworks-gt3-racer-from-scratch', selectedId: null, selectedGroupId: null,
    checkedIds: [], activeGroupIds: [], activeTransformMode: null, facePickMode: false,
    view: { cameraPosition: [9.5, 5.2, 9.5], orbitTarget: [0, 1.3, 0], cameraUp: [0, 1, 0], viewSpace: 1.5, shotZoom: 0.95, environment: 'studio', background: 'studio', showGrid: true, useCurrentZoomInShots: true, hideGridInShots: true },
    panels: { addMeshCollapsed: false, inspectorCollapsed: false, utilitiesCollapsed: true, statusCollapsed: true },
    tools: { rotationSnap: 0, bevelType: 'outer', bevelSize: 0.16, bevelDepth: 0.18, dragPushAxis: 'normal', dragPushStep: 0.01, connectFace: false, coplanarFaceSelection: false },
  },
};

await writeFile(out, `${JSON.stringify(project, null, 2)}\n`);
console.log(`Created ${out.pathname} with ${objects.length} editable meshes from a blank scene.`);
