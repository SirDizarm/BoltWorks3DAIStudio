#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Jimp } from "jimp";
import { MeshBasicMaterial } from "three";
import { MarchingCubes } from "three/examples/jsm/objects/MarchingCubes.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const defaultReference = "C:/Users/sir_d/Downloads/PNG/female.png";
const defaultOutput = path.join(repoRoot, "samples", "assets", "female-t-pose-player-model.modelerproj");
const TARGET_HEIGHT = 1.72;

function parseArgs(argv) {
  const options = { reference: defaultReference, output: defaultOutput, open: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--reference" && argv[index + 1]) options.reference = argv[++index];
    else if (arg === "--output" && argv[index + 1]) options.output = argv[++index];
    else if (arg === "--open") options.open = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  options.reference = path.resolve(options.reference);
  options.output = path.resolve(options.output);
  return options;
}

function usage() {
  return [
    "Generate a smooth adult female T-pose player mannequin from the supplied three-view sheet.",
    "",
    "Usage:",
    "  node tools/generate-female-t-pose.mjs [--reference IMAGE] [--output PROJECT] [--open]"
  ].join("\n");
}

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a, value) => [a[0] * value, a[1] * value, a[2] * value];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0]
];
const lengthOf = value => Math.hypot(value[0], value[1], value[2]);
const normalize = value => {
  const length = lengthOf(value) || 1;
  return scale(value, 1 / length);
};
const clamp01 = value => Math.max(0, Math.min(1, value));

function closestSection(sections, axis, value) {
  let best = sections[0];
  let distance = Infinity;
  for (const section of sections) {
    const nextDistance = Math.abs(section[axis] - value);
    if (nextDistance < distance) {
      distance = nextDistance;
      best = section;
    }
  }
  return best;
}

function orientFaces(vertices, faces, outwardAt) {
  return faces.map(face => {
    const [a, b, c] = face.map(index => vertices[index]);
    const normal = cross(sub(b, a), sub(c, a));
    const center = scale(add(add(a, b), c), 1 / 3);
    return dot(normal, outwardAt(center)) < 0 ? [face[0], face[2], face[1]] : face;
  });
}

function loftY(sections, segments = 28) {
  const vertices = [];
  const faces = [];
  for (const section of sections) {
    for (let segment = 0; segment < segments; segment += 1) {
      const angle = (segment / segments) * Math.PI * 2;
      const sine = Math.sin(angle);
      const depth = sine >= 0 ? section.front : section.back;
      vertices.push([
        section.x + Math.cos(angle) * section.rx,
        section.y,
        section.z + sine * depth
      ]);
    }
  }
  for (let ring = 0; ring < sections.length - 1; ring += 1) {
    for (let segment = 0; segment < segments; segment += 1) {
      const next = (segment + 1) % segments;
      const a = ring * segments + segment;
      const b = ring * segments + next;
      const d = (ring + 1) * segments + segment;
      const c = (ring + 1) * segments + next;
      faces.push([a, d, c], [a, c, b]);
    }
  }
  const bottomCenter = vertices.push([sections[0].x, sections[0].y, sections[0].z]) - 1;
  const top = sections.at(-1);
  const topCenter = vertices.push([top.x, top.y, top.z]) - 1;
  for (let segment = 0; segment < segments; segment += 1) {
    const next = (segment + 1) % segments;
    faces.push([bottomCenter, segment, next]);
    const ringStart = (sections.length - 1) * segments;
    faces.push([topCenter, ringStart + next, ringStart + segment]);
  }
  const minY = sections[0].y;
  const maxY = top.y;
  const oriented = orientFaces(vertices, faces, point => {
    if (Math.abs(point[1] - minY) < 1e-5) return [0, -1, 0];
    if (Math.abs(point[1] - maxY) < 1e-5) return [0, 1, 0];
    const section = closestSection(sections, "y", point[1]);
    return [point[0] - section.x, 0, point[2] - section.z];
  });
  return { vertices, faces: oriented };
}

function loftX(sections, segments = 22) {
  const vertices = [];
  const faces = [];
  for (const section of sections) {
    for (let segment = 0; segment < segments; segment += 1) {
      const angle = (segment / segments) * Math.PI * 2;
      vertices.push([
        section.x,
        section.y + Math.cos(angle) * section.ry,
        section.z + Math.sin(angle) * section.rz
      ]);
    }
  }
  for (let ring = 0; ring < sections.length - 1; ring += 1) {
    for (let segment = 0; segment < segments; segment += 1) {
      const next = (segment + 1) % segments;
      const a = ring * segments + segment;
      const b = ring * segments + next;
      const d = (ring + 1) * segments + segment;
      const c = (ring + 1) * segments + next;
      faces.push([a, b, c], [a, c, d]);
    }
  }
  const first = sections[0];
  const last = sections.at(-1);
  const firstCenter = vertices.push([first.x, first.y, first.z]) - 1;
  const lastCenter = vertices.push([last.x, last.y, last.z]) - 1;
  for (let segment = 0; segment < segments; segment += 1) {
    const next = (segment + 1) % segments;
    faces.push([firstCenter, next, segment]);
    const ringStart = (sections.length - 1) * segments;
    faces.push([lastCenter, ringStart + segment, ringStart + next]);
  }
  const minX = Math.min(first.x, last.x);
  const maxX = Math.max(first.x, last.x);
  const oriented = orientFaces(vertices, faces, point => {
    if (Math.abs(point[0] - minX) < 1e-5) return [-1, 0, 0];
    if (Math.abs(point[0] - maxX) < 1e-5) return [1, 0, 0];
    const section = closestSection(sections, "x", point[0]);
    return [0, point[1] - section.y, point[2] - section.z];
  });
  return { vertices, faces: oriented };
}

function ellipsoid({ center, radii, basisX = [1, 0, 0], basisY = [0, 1, 0], basisZ = [0, 0, 1], latitudes = 14, longitudes = 24 }) {
  const vertices = [];
  const faces = [];
  const toWorld = ([x, y, z]) => add(center, add(scale(basisX, x), add(scale(basisY, y), scale(basisZ, z))));
  const top = vertices.push(toWorld([0, radii[1], 0])) - 1;
  for (let latitude = 1; latitude < latitudes; latitude += 1) {
    const phi = (latitude / latitudes) * Math.PI;
    for (let longitude = 0; longitude < longitudes; longitude += 1) {
      const theta = (longitude / longitudes) * Math.PI * 2;
      vertices.push(toWorld([
        Math.sin(phi) * Math.cos(theta) * radii[0],
        Math.cos(phi) * radii[1],
        Math.sin(phi) * Math.sin(theta) * radii[2]
      ]));
    }
  }
  const bottom = vertices.push(toWorld([0, -radii[1], 0])) - 1;
  for (let longitude = 0; longitude < longitudes; longitude += 1) {
    const next = (longitude + 1) % longitudes;
    faces.push([top, 1 + longitude, 1 + next]);
  }
  for (let latitude = 0; latitude < latitudes - 2; latitude += 1) {
    const ring = 1 + latitude * longitudes;
    const nextRing = ring + longitudes;
    for (let longitude = 0; longitude < longitudes; longitude += 1) {
      const next = (longitude + 1) % longitudes;
      faces.push([ring + longitude, nextRing + longitude, nextRing + next]);
      faces.push([ring + longitude, nextRing + next, ring + next]);
    }
  }
  const finalRing = 1 + (latitudes - 2) * longitudes;
  for (let longitude = 0; longitude < longitudes; longitude += 1) {
    const next = (longitude + 1) % longitudes;
    faces.push([bottom, finalRing + next, finalRing + longitude]);
  }
  const oriented = orientFaces(vertices, faces, point => {
    const relative = sub(point, center);
    return add(
      scale(basisX, dot(relative, basisX) / (radii[0] * radii[0])),
      add(
        scale(basisY, dot(relative, basisY) / (radii[1] * radii[1])),
        scale(basisZ, dot(relative, basisZ) / (radii[2] * radii[2]))
      )
    );
  });
  return { vertices, faces: oriented };
}

function mirrorX(mesh) {
  return {
    vertices: mesh.vertices.map(([x, y, z]) => [-x, y, z]),
    faces: mesh.faces.map(([a, b, c]) => [a, c, b])
  };
}

function fingerMesh(start, end, width, thickness) {
  const direction = normalize(sub(end, start));
  const center = scale(add(start, end), 0.5);
  const basisZ = [0, 0, 1];
  let basisX = normalize(cross(direction, basisZ));
  if (lengthOf(basisX) < 0.5) basisX = [1, 0, 0];
  return ellipsoid({
    center,
    radii: [width, lengthOf(sub(end, start)) * 0.52, thickness],
    basisX,
    basisY: direction,
    basisZ,
    latitudes: 8,
    longitudes: 12
  });
}

function emitMesh(mesh, output, componentName) {
  const normalSums = mesh.vertices.map(() => [0, 0, 0]);
  for (const [a, b, c] of mesh.faces) {
    const faceNormal = cross(sub(mesh.vertices[b], mesh.vertices[a]), sub(mesh.vertices[c], mesh.vertices[a]));
    if (lengthOf(faceNormal) < 1e-10) continue;
    for (const index of [a, b, c]) normalSums[index] = add(normalSums[index], faceNormal);
  }
  const smoothNormals = normalSums.map(normalize);
  let emitted = 0;
  for (const face of mesh.faces) {
    const [a, b, c] = face;
    const faceNormal = cross(sub(mesh.vertices[b], mesh.vertices[a]), sub(mesh.vertices[c], mesh.vertices[a]));
    if (lengthOf(faceNormal) < 1e-10) continue;
    for (const index of face) {
      const vertex = mesh.vertices[index];
      output.positions.push(...vertex);
      output.normals.push(...smoothNormals[index]);
      output.uvs.push(clamp01(0.5 + vertex[0] / 1.55), clamp01(vertex[1] / TARGET_HEIGHT));
    }
    emitted += 1;
  }
  output.components.push({ name: componentName, triangles: emitted });
}

function buildFemaleMannequin() {
  const output = { positions: [], normals: [], uvs: [], components: [] };

  emitMesh(loftY([
    { x: 0, y: 0.70, z: 0, rx: 0.175, front: 0.105, back: 0.115 },
    { x: 0, y: 0.76, z: 0, rx: 0.202, front: 0.125, back: 0.145 },
    { x: 0, y: 0.84, z: 0, rx: 0.218, front: 0.14, back: 0.158 },
    { x: 0, y: 0.93, z: 0, rx: 0.202, front: 0.125, back: 0.135 },
    { x: 0, y: 1.03, z: 0, rx: 0.148, front: 0.102, back: 0.095 },
    { x: 0, y: 1.13, z: 0, rx: 0.17, front: 0.108, back: 0.098 },
    { x: 0, y: 1.24, z: 0, rx: 0.205, front: 0.12, back: 0.102 },
    { x: 0, y: 1.34, z: 0, rx: 0.22, front: 0.13, back: 0.105 },
    { x: 0, y: 1.42, z: 0, rx: 0.245, front: 0.105, back: 0.102 },
    { x: 0, y: 1.455, z: 0, rx: 0.17, front: 0.085, back: 0.085 }
  ], 36), output, "torso and pelvis");

  // These forms are deliberately sunk well into the torso volume. Only the
  // anatomical contour remains visible instead of a pair of attached spheres.
  emitMesh(ellipsoid({ center: [0.086, 1.30, 0.098], radii: [0.086, 0.078, 0.064], latitudes: 12, longitudes: 22 }), output, "right breast contour");
  emitMesh(mirrorX(ellipsoid({ center: [0.086, 1.30, 0.098], radii: [0.086, 0.078, 0.064], latitudes: 12, longitudes: 22 })), output, "left breast contour");
  emitMesh(ellipsoid({ center: [0.09, 0.855, -0.103], radii: [0.12, 0.11, 0.082], latitudes: 12, longitudes: 22 }), output, "right glute contour");
  emitMesh(mirrorX(ellipsoid({ center: [0.09, 0.855, -0.103], radii: [0.12, 0.11, 0.082], latitudes: 12, longitudes: 22 })), output, "left glute contour");

  emitMesh(loftY([
    { x: 0, y: 1.43, z: -0.002, rx: 0.066, front: 0.06, back: 0.058 },
    { x: 0, y: 1.50, z: 0, rx: 0.052, front: 0.048, back: 0.048 }
  ], 24), output, "neck");
  emitMesh(loftY([
    { x: 0, y: 1.485, z: 0.012, rx: 0.038, front: 0.064, back: 0.045 },
    { x: 0, y: 1.515, z: 0.007, rx: 0.065, front: 0.082, back: 0.07 },
    { x: 0, y: 1.555, z: 0.005, rx: 0.082, front: 0.088, back: 0.085 },
    { x: 0, y: 1.61, z: 0.002, rx: 0.087, front: 0.084, back: 0.095 },
    { x: 0, y: 1.665, z: -0.003, rx: 0.08, front: 0.075, back: 0.096 },
    { x: 0, y: 1.705, z: -0.004, rx: 0.052, front: 0.052, back: 0.068 },
    { x: 0, y: 1.72, z: -0.003, rx: 0.018, front: 0.02, back: 0.025 }
  ], 32), output, "head");
  emitMesh(ellipsoid({ center: [0.087, 1.595, -0.002], radii: [0.012, 0.028, 0.015], latitudes: 8, longitudes: 14 }), output, "right ear");
  emitMesh(mirrorX(ellipsoid({ center: [0.087, 1.595, -0.002], radii: [0.012, 0.028, 0.015], latitudes: 8, longitudes: 14 })), output, "left ear");
  emitMesh(ellipsoid({ center: [0, 1.59, 0.096], radii: [0.012, 0.026, 0.021], basisX: [1, 0, 0], basisY: [0, 1, 0], basisZ: [0, 0, 1], latitudes: 8, longitudes: 14 }), output, "nose");

  const rightArm = loftX([
    { x: 0.19, y: 1.405, z: 0, ry: 0.082, rz: 0.075 },
    { x: 0.26, y: 1.402, z: 0, ry: 0.075, rz: 0.069 },
    { x: 0.37, y: 1.392, z: 0, ry: 0.059, rz: 0.056 },
    { x: 0.48, y: 1.382, z: 0, ry: 0.047, rz: 0.047 },
    { x: 0.56, y: 1.375, z: 0, ry: 0.052, rz: 0.045 },
    { x: 0.635, y: 1.37, z: 0, ry: 0.034, rz: 0.029 }
  ], 24);
  emitMesh(rightArm, output, "right arm");
  emitMesh(mirrorX(rightArm), output, "left arm");

  const palm = ellipsoid({
    center: [0.674, 1.37, 0], radii: [0.055, 0.047, 0.023],
    basisX: [0, 1, 0], basisY: [1, 0, 0], basisZ: [0, 0, -1], latitudes: 9, longitudes: 16
  });
  emitMesh(palm, output, "right palm");
  emitMesh(mirrorX(palm), output, "left palm");
  const fingerSpecs = [
    [[0.706, 1.405, 0], [0.754, 1.438, 0], 0.010, 0.008],
    [[0.714, 1.385, 0], [0.768, 1.397, 0], 0.010, 0.008],
    [[0.715, 1.365, 0], [0.769, 1.36, 0], 0.0095, 0.0075],
    [[0.708, 1.345, 0], [0.755, 1.323, 0], 0.0085, 0.007],
    [[0.675, 1.411, 0], [0.712, 1.466, 0], 0.011, 0.008]
  ];
  fingerSpecs.forEach((spec, index) => {
    const finger = fingerMesh(...spec);
    emitMesh(finger, output, `right finger ${index + 1}`);
    emitMesh(mirrorX(finger), output, `left finger ${index + 1}`);
  });

  const thigh = loftY([
    { x: 0.118, y: 0.91, z: -0.004, rx: 0.108, front: 0.11, back: 0.12 },
    { x: 0.118, y: 0.87, z: -0.004, rx: 0.109, front: 0.112, back: 0.122 },
    { x: 0.116, y: 0.78, z: 0, rx: 0.101, front: 0.103, back: 0.105 },
    { x: 0.108, y: 0.64, z: 0.002, rx: 0.082, front: 0.087, back: 0.086 },
    { x: 0.103, y: 0.53, z: 0.003, rx: 0.065, front: 0.068, back: 0.066 },
    { x: 0.102, y: 0.48, z: 0.005, rx: 0.058, front: 0.057, back: 0.057 }
  ], 28);
  emitMesh(thigh, output, "right thigh");
  emitMesh(mirrorX(thigh), output, "left thigh");
  const shin = loftY([
    { x: 0.102, y: 0.49, z: 0.005, rx: 0.058, front: 0.058, back: 0.058 },
    { x: 0.101, y: 0.42, z: 0.003, rx: 0.059, front: 0.064, back: 0.062 },
    { x: 0.096, y: 0.31, z: 0, rx: 0.064, front: 0.07, back: 0.068 },
    { x: 0.091, y: 0.17, z: 0.006, rx: 0.046, front: 0.052, back: 0.05 },
    { x: 0.089, y: 0.075, z: 0.012, rx: 0.034, front: 0.04, back: 0.038 }
  ], 26);
  emitMesh(shin, output, "right lower leg");
  emitMesh(mirrorX(shin), output, "left lower leg");
  const foot = ellipsoid({
    center: [0.089, 0.035, 0.045], radii: [0.052, 0.105, 0.035],
    basisX: [1, 0, 0], basisY: [0, 0, 1], basisZ: [0, -1, 0], latitudes: 10, longitudes: 20
  });
  emitMesh(foot, output, "right foot");
  emitMesh(mirrorX(foot), output, "left foot");

  return output;
}

function mix(a, b, amount) {
  return a + (b - a) * amount;
}

function interpolateSections(sections, axis, value) {
  if (value <= sections[0][axis]) return sections[0];
  if (value >= sections.at(-1)[axis]) return sections.at(-1);
  for (let index = 0; index < sections.length - 1; index += 1) {
    const first = sections[index];
    const second = sections[index + 1];
    if (value < first[axis] || value > second[axis]) continue;
    const amount = (value - first[axis]) / Math.max(1e-9, second[axis] - first[axis]);
    const previous = sections[Math.max(0, index - 1)];
    const next = sections[Math.min(sections.length - 1, index + 2)];
    const catmullRom = (p0, p1, p2, p3, t) => {
      const t2 = t * t;
      const t3 = t2 * t;
      return 0.5 * (
        2 * p1
        + (-p0 + p2) * t
        + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
        + (-p0 + 3 * p1 - 3 * p2 + p3) * t3
      );
    };
    const result = {};
    for (const key of Object.keys(first)) {
      if (key === axis) result[key] = value;
      else if (typeof first[key] === "number") {
        result[key] = catmullRom(previous[key], first[key], second[key], next[key], amount);
      } else result[key] = first[key];
    }
    return result;
  }
  return sections.at(-1);
}

function sdEllipsoid(x, y, z, center, radii) {
  const dx = (x - center[0]) / radii[0];
  const dy = (y - center[1]) / radii[1];
  const dz = (z - center[2]) / radii[2];
  return (Math.hypot(dx, dy, dz) - 1) * Math.min(radii[0], radii[1], radii[2]);
}

function sdLoftY(x, y, z, sections) {
  const first = sections[0];
  const last = sections.at(-1);
  const sampleY = Math.max(first.y, Math.min(last.y, y));
  const section = interpolateSections(sections, "y", sampleY);
  const relativeZ = z - section.z;
  const depth = relativeZ >= 0 ? section.front : section.back;
  const radial = (Math.hypot((x - section.x) / section.rx, relativeZ / depth) - 1) * Math.min(section.rx, depth);
  const axial = y < first.y ? first.y - y : y > last.y ? y - last.y : 0;
  if (axial <= 0) return radial;
  return Math.hypot(Math.max(radial, 0), axial) + Math.min(Math.max(radial, axial), 0);
}

function sdLoftX(x, y, z, sections) {
  const first = sections[0];
  const last = sections.at(-1);
  const sampleX = Math.max(first.x, Math.min(last.x, x));
  const section = interpolateSections(sections, "x", sampleX);
  const radial = (Math.hypot((y - section.y) / section.ry, (z - section.z) / section.rz) - 1) * Math.min(section.ry, section.rz);
  const axial = x < first.x ? first.x - x : x > last.x ? x - last.x : 0;
  if (axial <= 0) return radial;
  return Math.hypot(Math.max(radial, 0), axial) + Math.min(Math.max(radial, axial), 0);
}

function sdCapsule(x, y, z, start, end, radius) {
  const abX = end[0] - start[0];
  const abY = end[1] - start[1];
  const abZ = end[2] - start[2];
  const apX = x - start[0];
  const apY = y - start[1];
  const apZ = z - start[2];
  const denominator = abX * abX + abY * abY + abZ * abZ || 1;
  const amount = Math.max(0, Math.min(1, (apX * abX + apY * abY + apZ * abZ) / denominator));
  return Math.hypot(apX - abX * amount, apY - abY * amount, apZ - abZ * amount) - radius;
}

function smoothMinimum(a, b, radius) {
  const blend = Math.max(radius - Math.abs(a - b), 0) / Math.max(radius, 1e-9);
  return Math.min(a, b) - blend * blend * radius * 0.25;
}

function buildFemaleOrganicMannequin(resolution = 144) {
  const torso = [
    { x: 0, y: 0.755, z: 0.008, rx: 0.072, front: 0.074, back: 0.074 },
    { x: 0, y: 0.805, z: 0.001, rx: 0.132, front: 0.097, back: 0.106 },
    { x: 0, y: 0.86, z: -0.003, rx: 0.174, front: 0.110, back: 0.122 },
    { x: 0, y: 0.92, z: -0.002, rx: 0.183, front: 0.113, back: 0.124 },
    { x: 0, y: 0.98, z: 0.001, rx: 0.173, front: 0.106, back: 0.108 },
    { x: 0, y: 1.04, z: 0.003, rx: 0.150, front: 0.096, back: 0.095 },
    { x: 0, y: 1.10, z: 0.004, rx: 0.136, front: 0.088, back: 0.086 },
    { x: 0, y: 1.16, z: 0.004, rx: 0.150, front: 0.093, back: 0.089 },
    { x: 0, y: 1.23, z: 0.002, rx: 0.171, front: 0.100, back: 0.093 },
    { x: 0, y: 1.30, z: 0, rx: 0.187, front: 0.103, back: 0.096 },
    { x: 0, y: 1.36, z: -0.002, rx: 0.198, front: 0.099, back: 0.095 },
    { x: 0, y: 1.40, z: -0.004, rx: 0.196, front: 0.088, back: 0.091 },
    { x: 0, y: 1.435, z: -0.004, rx: 0.135, front: 0.071, back: 0.075 }
  ];
  const neck = [
    { x: 0, y: 1.405, z: -0.006, rx: 0.068, front: 0.058, back: 0.058 },
    { x: 0, y: 1.50, z: -0.004, rx: 0.052, front: 0.049, back: 0.05 },
    { x: 0, y: 1.53, z: -0.002, rx: 0.058, front: 0.055, back: 0.057 }
  ];
  const arm = [
    { x: 0.155, y: 1.397, z: -0.002, ry: 0.062, rz: 0.058 },
    { x: 0.220, y: 1.390, z: -0.001, ry: 0.068, rz: 0.060 },
    { x: 0.305, y: 1.376, z: 0, ry: 0.058, rz: 0.051 },
    { x: 0.395, y: 1.365, z: 0.001, ry: 0.045, rz: 0.041 },
    { x: 0.480, y: 1.359, z: 0.002, ry: 0.041, rz: 0.036 },
    { x: 0.545, y: 1.358, z: 0.002, ry: 0.045, rz: 0.039 },
    { x: 0.615, y: 1.354, z: 0.002, ry: 0.034, rz: 0.029 },
    { x: 0.665, y: 1.351, z: 0.002, ry: 0.028, rz: 0.023 }
  ];
  const leg = [
    { x: 0.090, y: 0.055, z: 0.010, rx: 0.032, front: 0.037, back: 0.033 },
    { x: 0.092, y: 0.15, z: 0.007, rx: 0.040, front: 0.045, back: 0.043 },
    { x: 0.096, y: 0.28, z: 0.001, rx: 0.056, front: 0.060, back: 0.066 },
    { x: 0.098, y: 0.40, z: 0.001, rx: 0.061, front: 0.065, back: 0.070 },
    { x: 0.100, y: 0.49, z: 0.003, rx: 0.052, front: 0.054, back: 0.053 },
    { x: 0.101, y: 0.55, z: 0.002, rx: 0.055, front: 0.057, back: 0.058 },
    { x: 0.103, y: 0.64, z: -0.001, rx: 0.068, front: 0.072, back: 0.076 },
    { x: 0.105, y: 0.74, z: -0.003, rx: 0.080, front: 0.086, back: 0.091 },
    { x: 0.106, y: 0.83, z: -0.004, rx: 0.088, front: 0.093, back: 0.099 },
    { x: 0.105, y: 0.90, z: -0.004, rx: 0.087, front: 0.092, back: 0.099 },
    { x: 0.103, y: 0.965, z: -0.002, rx: 0.081, front: 0.087, back: 0.095 }
  ];
  const fingers = [
    [[0.708, 1.405, 0.001], [0.761, 1.438, 0.001], 0.0095],
    [[0.716, 1.386, 0.001], [0.775, 1.399, 0.001], 0.009],
    [[0.718, 1.367, 0.001], [0.779, 1.364, 0.001], 0.0088],
    [[0.712, 1.347, 0.001], [0.765, 1.326, 0.001], 0.0082],
    [[0.684, 1.411, 0.006], [0.721, 1.466, 0.008], 0.010]
  ];

  const bodySdf = (x, y, z) => {
    let distance = sdLoftY(x, y, z, torso);
    distance = smoothMinimum(distance, sdLoftY(x, y, z, neck), 0.028);

    // Head, jaw and chin are blended instead of stacked as visible primitives.
    distance = smoothMinimum(distance, sdEllipsoid(x, y, z, [0, 1.625, -0.008], [0.087, 0.095, 0.094]), 0.024);
    distance = smoothMinimum(distance, sdEllipsoid(x, y, z, [0, 1.565, 0.024], [0.071, 0.071, 0.077]), 0.019);
    distance = smoothMinimum(distance, sdEllipsoid(x, y, z, [0, 1.515, 0.037], [0.048, 0.035, 0.052]), 0.012);
    distance = smoothMinimum(distance, sdEllipsoid(x, y, z, [0, 1.59, 0.096], [0.012, 0.026, 0.024]), 0.007);
    distance = smoothMinimum(distance, sdEllipsoid(x, y, z, [0.086, 1.59, -0.002], [0.012, 0.027, 0.016]), 0.006);
    distance = smoothMinimum(distance, sdEllipsoid(x, y, z, [-0.086, 1.59, -0.002], [0.012, 0.027, 0.016]), 0.006);

    // These contours merge into the torso field, avoiding ball-like seams.
    distance = smoothMinimum(distance, sdEllipsoid(x, y, z, [0.065, 1.250, 0.074], [0.066, 0.060, 0.050]), 0.040);
    distance = smoothMinimum(distance, sdEllipsoid(x, y, z, [-0.065, 1.250, 0.074], [0.066, 0.060, 0.050]), 0.040);
    distance = smoothMinimum(distance, sdEllipsoid(x, y, z, [0.072, 0.842, -0.064], [0.090, 0.090, 0.059]), 0.048);
    distance = smoothMinimum(distance, sdEllipsoid(x, y, z, [-0.072, 0.842, -0.064], [0.090, 0.090, 0.059]), 0.048);

    for (const side of [-1, 1]) {
      distance = smoothMinimum(distance, sdLoftX(side * x, y, z, arm), 0.046);
      distance = smoothMinimum(distance, sdEllipsoid(x, y, z, [side * 0.700, 1.360, 0.002], [0.060, 0.041, 0.023]), 0.018);
      distance = smoothMinimum(distance, sdLoftY(side * x, y, z, leg), 0.052);
      distance = smoothMinimum(distance, sdEllipsoid(x, y, z, [side * 0.09, 0.036, -0.010], [0.050, 0.034, 0.064]), 0.016);
      distance = smoothMinimum(distance, sdEllipsoid(x, y, z, [side * 0.09, 0.031, 0.074], [0.050, 0.030, 0.100]), 0.016);
      distance = smoothMinimum(distance, sdEllipsoid(x, y, z, [side * 0.09, 0.024, 0.154], [0.058, 0.024, 0.070]), 0.013);
      distance = smoothMinimum(distance, sdEllipsoid(x, y, z, [side * 0.09, 0.020, 0.202], [0.052, 0.019, 0.034]), 0.010);
      for (const [start, end, radius] of fingers) {
        distance = smoothMinimum(
          distance,
          sdCapsule(x, y, z, [side * start[0], start[1], start[2]], [side * end[0], end[1], end[2]], radius),
          0.007
        );
      }
    }
    return distance;
  };

  const domain = { min: [-0.84, -0.045, -0.245], max: [0.84, 1.765, 0.245] };
  const marching = new MarchingCubes(resolution, new MeshBasicMaterial(), false, false, 150000);
  // Keep the iso surface a hair away from exact zero-valued grid corners.
  // At exactly 0 Marching Cubes can collapse several corners onto the same
  // point, producing zero-area/non-manifold triangles even though the visible
  // surface looks closed. This offset is far below a visible modeling step.
  marching.isolation = 0.000037;
  marching.field.fill(0.25);
  const half = resolution / 2;
  for (let zIndex = 1; zIndex < resolution - 1; zIndex += 1) {
    const internalZ = (zIndex - half) / half;
    const z = mix(domain.min[2], domain.max[2], (internalZ + 1) * 0.5);
    for (let yIndex = 1; yIndex < resolution - 1; yIndex += 1) {
      const internalY = (yIndex - half) / half;
      const y = mix(domain.min[1], domain.max[1], (internalY + 1) * 0.5);
      const row = yIndex * resolution + zIndex * resolution * resolution;
      for (let xIndex = 1; xIndex < resolution - 1; xIndex += 1) {
        const internalX = (xIndex - half) / half;
        const x = mix(domain.min[0], domain.max[0], (internalX + 1) * 0.5);
        marching.field[row + xIndex] = bodySdf(x, y, z);
      }
    }
  }
  marching.update();

  const rawPositions = marching.geometry.getAttribute("position").array;
  const vertexCount = marching.geometry.drawRange.count;
  const positions = [];
  const normals = [];
  const uvs = [];
  const epsilon = 0.002;
  const worldVertex = index => [
    mix(domain.min[0], domain.max[0], (rawPositions[index * 3] + 1) * 0.5),
    mix(domain.min[1], domain.max[1], (rawPositions[index * 3 + 1] + 1) * 0.5),
    mix(domain.min[2], domain.max[2], (rawPositions[index * 3 + 2] + 1) * 0.5)
  ];
  const gradient = point => normalize([
    bodySdf(point[0] + epsilon, point[1], point[2]) - bodySdf(point[0] - epsilon, point[1], point[2]),
    bodySdf(point[0], point[1] + epsilon, point[2]) - bodySdf(point[0], point[1] - epsilon, point[2]),
    bodySdf(point[0], point[1], point[2] + epsilon) - bodySdf(point[0], point[1], point[2] - epsilon)
  ]);
  for (let triangle = 0; triangle < vertexCount; triangle += 3) {
    const vertices = [worldVertex(triangle), worldVertex(triangle + 1), worldVertex(triangle + 2)];
    const outward = normalize(add(add(gradient(vertices[0]), gradient(vertices[1])), gradient(vertices[2])));
    const geometric = cross(sub(vertices[1], vertices[0]), sub(vertices[2], vertices[0]));
    // Keep every non-collapsed Marching Cubes triangle. Removing tiny triangles
    // opens equally tiny boundary loops, while the offset isolation value above
    // prevents the exact grid-corner collapses that originally caused them.
    if (dot(geometric, outward) < 0) [vertices[1], vertices[2]] = [vertices[2], vertices[1]];
    for (const vertex of vertices) {
      positions.push(...vertex);
      normals.push(...gradient(vertex));
      uvs.push(clamp01(0.5 + vertex[0] / 1.68), clamp01(vertex[1] / TARGET_HEIGHT));
    }
  }
  return {
    positions,
    normals,
    uvs,
    components: [{ name: "seamless organic female body", triangles: positions.length / 9 }]
  };
}

function boundsOf(positions) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let index = 0; index < positions.length; index += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], positions[index + axis]);
      max[axis] = Math.max(max[axis], positions[index + axis]);
    }
  }
  return { min, max, size: max.map((value, axis) => value - min[axis]) };
}

function rounded(values, digits = 6) {
  const factor = 10 ** digits;
  return values.map(value => Math.round(value * factor) / factor);
}

const options = parseArgs(process.argv.slice(2));
if (options.help) {
  console.log(usage());
  process.exit(0);
}
if (!fs.existsSync(options.reference)) throw new Error(`Reference image not found: ${options.reference}`);
const referenceImage = await Jimp.read(options.reference);
if (referenceImage.bitmap.width < 1000 || referenceImage.bitmap.height < 500) {
  throw new Error("The reference sheet must contain readable front, side and back views.");
}

const generated = buildFemaleOrganicMannequin();
const finalBounds = boundsOf(generated.positions);
const triangleCount = generated.positions.length / 9;
const embeddedReference = {
  name: path.basename(options.reference),
  dataUrl: `data:image/png;base64,${fs.readFileSync(options.reference).toString("base64")}`,
  mode: "panel",
  opacity: 0.5,
  scale: 1,
  offsetX: 0,
  offsetY: 0
};

const body = {
  id: "female-body",
  name: "Female T-Pose Mannequin",
  shape: "custom",
  geometry: {
    positions: rounded(generated.positions),
    normals: rounded(generated.normals),
    uvs: rounded(generated.uvs)
  },
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  color: "#ECEAE7",
  roughness: 0.64,
  opacity: 1,
  hidden: false,
  groupId: "female-root",
  groupName: "Female Player Model",
  materialRule: "soft-organic",
  playerAvatar: true,
  playerHeadOffset: [0, 1.61, 0.012],
  objectIntent: "Gameplay player reference mannequin",
  aiSource: {
    kind: "three-view-procedural-reconstruction",
    referenceName: path.basename(options.reference),
    sourceViews: ["front", "side", "back"],
    targetHeightMeters: TARGET_HEIGHT,
    armSpanMeters: finalBounds.size[0],
    triangleCount,
    componentCount: generated.components.length,
    components: generated.components
  }
};

const project = {
  kind: "modeler-project",
  version: 1,
  name: "female-t-pose-player-model",
  savedAt: new Date().toISOString(),
  description: "Smooth neutral adult female T-pose mannequin reconstructed from the supplied front, side and back sheet.",
  tags: ["player", "female", "t-pose", "reference-match", "rig-candidate"],
  textureLibrary: [],
  scene: {
    version: 2,
    coordinateSystem: {
      handedness: "right-handed", units: "meters", upAxis: "+Y", groundPlane: "XZ",
      rotationUnits: "degrees", eulerOrder: "XYZ", objectPositions: "world space",
      geometryAndPivots: "object-local space"
    },
    shapeConventions: { defaultOrigin: "The mannequin stands on Y=0 and faces +Z." },
    groups: [{ id: "female-root", name: "Female Player Model", parentId: null }],
    objects: [body],
    boneHierarchy: []
  },
  editor: {
    projectName: "female-t-pose-player-model",
    selectedId: "female-body",
    selectedGroupId: "female-root",
    checkedIds: [],
    activeGroupIds: ["female-root"],
    activeTransformMode: null,
    facePickMode: false,
    referenceImage: embeddedReference,
    cameraViews: {
      selectedId: "female-front",
      showMarkers: false,
      views: [
        { id: "female-front", name: "Female Front", type: "director", position: [0, 0.88, 3.2], target: [0, 0.88, 0], up: [0, 1, 0], fov: 32, role: "Reference" },
        { id: "female-side", name: "Female Side", type: "director", position: [-3.2, 0.88, 0], target: [0, 0.88, 0], up: [0, 1, 0], fov: 32, role: "Reference" },
        { id: "female-back", name: "Female Back", type: "director", position: [0, 0.88, -3.2], target: [0, 0.88, 0], up: [0, 1, 0], fov: 32, role: "Reference" },
        { id: "female-iso", name: "Female Iso", type: "director", position: [2.55, 1.35, 2.8], target: [0, 0.92, 0], up: [0, 1, 0], fov: 36, role: "Inspection" }
      ]
    },
    view: {
      cameraPosition: [2.55, 1.35, 2.8], orbitTarget: [0, 0.92, 0], cameraUp: [0, 1, 0],
      viewSpace: 0.45, shotZoom: 0.93, environment: "studio", background: "dark",
      showGrid: true, useCurrentZoomInShots: true, hideGridInShots: true
    },
    panels: { addMeshCollapsed: false, inspectorCollapsed: false, utilitiesCollapsed: false, cameraViewsCollapsed: false, statusCollapsed: false },
    toolbars: {}, tools: {},
    lighting: { showGuides: false, enablePrimary: true, enableMirror: true, lampPosition: [-3, 4, 4], lampTarget: [0, 0.95, 0], intensity: 11, angle: 34 },
    rigging: { selectedBoneId: null, showGuides: false, bones: [] }
  }
};

fs.mkdirSync(path.dirname(options.output), { recursive: true });
fs.writeFileSync(options.output, `${JSON.stringify(project, null, 2)}\n`, "utf8");
if (options.open) {
  const pendingPath = path.join(repoRoot, ".runtime", "pending-open-project.json");
  fs.mkdirSync(path.dirname(pendingPath), { recursive: true });
  fs.writeFileSync(pendingPath, JSON.stringify({ fileName: path.basename(options.output), data: project }), "utf8");
}

console.log(JSON.stringify({
  output: options.output,
  reference: options.reference,
  generatorMode: "threeViewImplicitFemaleV5",
  triangles: triangleCount,
  vertices: generated.positions.length / 3,
  components: generated.components.length,
  bounds: {
    min: finalBounds.min.map(value => Number(value.toFixed(4))),
    max: finalBounds.max.map(value => Number(value.toFixed(4))),
    size: finalBounds.size.map(value => Number(value.toFixed(4)))
  },
  pendingOpen: options.open
}, null, 2));
