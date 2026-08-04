import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { Jimp } from "jimp";
import { Euler, Matrix3, Matrix4, Quaternion, Vector3 } from "three";

const DEFAULT_WIDTH = 1600;
const DEFAULT_HEIGHT = 1200;
const OUTER_MARGIN = 18;
const PANEL_GAP = 16;
const LABEL_HEIGHT = 48;

const VIEWS = [
  { label: "FRONT", toCamera: [0, 0, 1], up: [0, 1, 0] },
  { label: "SIDE", toCamera: [1, 0, 0], up: [0, 1, 0] },
  { label: "BACK", toCamera: [0, 0, -1], up: [0, 1, 0] },
  { label: "ISO", toCamera: [1.45, 0.78, 1.8], up: [0, 1, 0] }
];

const FONT_5X7 = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  N: ["10001", "11001", "11001", "10101", "10011", "10011", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"]
};

function usage() {
  console.error("Usage: node tools/render-modelerproj-preview.mjs <input.modelerproj> [output.png] [--width N] [--height N]");
}

function optionNumber(args, name, fallback) {
  const equals = args.find((arg) => arg.startsWith(`${name}=`));
  const directIndex = args.indexOf(name);
  const raw = equals ? equals.slice(name.length + 1) : directIndex >= 0 ? args[directIndex + 1] : null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 320 ? Math.round(parsed) : fallback;
}

function positionalArguments(args) {
  const values = [];
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === "--width" || value === "--height") {
      index += 1;
      continue;
    }
    if (value.startsWith("--width=") || value.startsWith("--height=")) continue;
    if (!value.startsWith("--")) values.push(value);
  }
  return values;
}

function clamp(value, minimum = 0, maximum = 1) {
  return Math.max(minimum, Math.min(maximum, value));
}

function finiteVector(value, fallback) {
  if (!Array.isArray(value) || value.length < 3) return new Vector3(...fallback);
  const numbers = value.slice(0, 3).map(Number);
  return numbers.every(Number.isFinite) ? new Vector3(...numbers) : new Vector3(...fallback);
}

function parseHexColor(value, fallback = [225, 225, 225]) {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().replace(/^#/, "");
  const expanded = normalized.length === 3
    ? normalized.split("").map((part) => part + part).join("")
    : normalized;
  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) return fallback;
  return [
    Number.parseInt(expanded.slice(0, 2), 16),
    Number.parseInt(expanded.slice(2, 4), 16),
    Number.parseInt(expanded.slice(4, 6), 16)
  ];
}

function writePixel(image, x, y, red, green, blue, alpha = 255) {
  const px = Math.round(x);
  const py = Math.round(y);
  if (px < 0 || py < 0 || px >= image.bitmap.width || py >= image.bitmap.height) return;
  const offset = (py * image.bitmap.width + px) * 4;
  image.bitmap.data[offset] = clamp(Math.round(red), 0, 255);
  image.bitmap.data[offset + 1] = clamp(Math.round(green), 0, 255);
  image.bitmap.data[offset + 2] = clamp(Math.round(blue), 0, 255);
  image.bitmap.data[offset + 3] = clamp(Math.round(alpha), 0, 255);
}

function blendPixel(image, x, y, red, green, blue, alpha = 1) {
  if (x < 0 || y < 0 || x >= image.bitmap.width || y >= image.bitmap.height) return;
  const offset = (y * image.bitmap.width + x) * 4;
  const amount = clamp(alpha);
  const inverse = 1 - amount;
  image.bitmap.data[offset] = Math.round(red * amount + image.bitmap.data[offset] * inverse);
  image.bitmap.data[offset + 1] = Math.round(green * amount + image.bitmap.data[offset + 1] * inverse);
  image.bitmap.data[offset + 2] = Math.round(blue * amount + image.bitmap.data[offset + 2] * inverse);
  image.bitmap.data[offset + 3] = 255;
}

function fillRect(image, x, y, width, height, color) {
  const startX = Math.max(0, Math.floor(x));
  const startY = Math.max(0, Math.floor(y));
  const endX = Math.min(image.bitmap.width, Math.ceil(x + width));
  const endY = Math.min(image.bitmap.height, Math.ceil(y + height));
  for (let py = startY; py < endY; py += 1) {
    for (let px = startX; px < endX; px += 1) {
      writePixel(image, px, py, color[0], color[1], color[2], color[3] ?? 255);
    }
  }
}

function strokeRect(image, x, y, width, height, color, thickness = 1) {
  fillRect(image, x, y, width, thickness, color);
  fillRect(image, x, y + height - thickness, width, thickness, color);
  fillRect(image, x, y, thickness, height, color);
  fillRect(image, x + width - thickness, y, thickness, height, color);
}

function drawText(image, text, x, y, scale, color) {
  let cursor = x;
  for (const rawCharacter of String(text).toUpperCase()) {
    const glyph = FONT_5X7[rawCharacter] ?? FONT_5X7[" "];
    for (let row = 0; row < glyph.length; row += 1) {
      for (let column = 0; column < glyph[row].length; column += 1) {
        if (glyph[row][column] !== "1") continue;
        fillRect(image, cursor + column * scale, y + row * scale, scale, scale, color);
      }
    }
    cursor += 6 * scale;
  }
}

function textWidth(text, scale) {
  return Math.max(0, String(text).length * 6 * scale - scale);
}

function fillCanvasBackground(image) {
  const width = image.bitmap.width;
  const height = image.bitmap.height;
  for (let y = 0; y < height; y += 1) {
    const vertical = y / Math.max(1, height - 1);
    for (let x = 0; x < width; x += 1) {
      const horizontal = Math.abs(x / Math.max(1, width - 1) - 0.5) * 2;
      const glow = (1 - horizontal) * 5;
      writePixel(image, x, y, 8 + glow + vertical * 4, 12 + glow + vertical * 5, 16 + glow + vertical * 7, 255);
    }
  }
}

function drawPanelBackground(image, panel) {
  for (let y = panel.y; y < panel.y + panel.height; y += 1) {
    const t = (y - panel.y) / Math.max(1, panel.height - 1);
    for (let x = panel.x; x < panel.x + panel.width; x += 1) {
      const centerDistance = Math.abs((x - panel.x) / panel.width - 0.5) * 2;
      const glow = (1 - centerDistance) * 7;
      writePixel(image, x, y, 16 + glow + t * 7, 23 + glow + t * 8, 29 + glow + t * 10, 255);
    }
  }

  const contentTop = panel.y + LABEL_HEIGHT;
  const gridColor = [38, 52, 61, 255];
  const gridStep = Math.max(44, Math.round(panel.width / 12));
  for (let x = panel.x + gridStep; x < panel.x + panel.width; x += gridStep) {
    fillRect(image, x, contentTop, 1, panel.height - LABEL_HEIGHT, gridColor);
  }
  for (let y = contentTop + gridStep; y < panel.y + panel.height; y += gridStep) {
    fillRect(image, panel.x, y, panel.width, 1, gridColor);
  }
}

function readVertexColor(colors, vertexIndex, fallback) {
  if (!Array.isArray(colors) || colors.length < (vertexIndex + 1) * 3) return fallback;
  const values = colors.slice(vertexIndex * 3, vertexIndex * 3 + 3).map(Number);
  if (!values.every(Number.isFinite)) return fallback;
  const maximum = Math.max(...values.map(Math.abs));
  return maximum <= 1.001 ? values.map((part) => clamp(part) * 255) : values.map((part) => clamp(part, 0, 255));
}

function collectModel(project) {
  const sceneObjects = Array.isArray(project?.scene?.objects) ? project.scene.objects : [];
  const vertices = [];
  const triangles = [];
  const skipped = [];

  for (const object of sceneObjects) {
    if (object?.hidden) continue;
    const geometry = object?.geometry;
    const positions = geometry?.positions;
    if (!Array.isArray(positions) || positions.length < 9) {
      skipped.push(object?.name ?? object?.id ?? "unnamed object");
      continue;
    }

    const position = finiteVector(object.position, [0, 0, 0]);
    const rotation = finiteVector(object.rotation, [0, 0, 0]).multiplyScalar(Math.PI / 180);
    const scale = finiteVector(object.scale, [1, 1, 1]);
    const quaternion = new Quaternion().setFromEuler(new Euler(rotation.x, rotation.y, rotation.z, "XYZ"));
    const matrix = new Matrix4().compose(position, quaternion, scale);
    const normalMatrix = new Matrix3().getNormalMatrix(matrix);
    const normalValues = Array.isArray(geometry.normals) ? geometry.normals : [];
    const colorValues = Array.isArray(geometry.colors) ? geometry.colors : [];
    const baseColor = parseHexColor(object.color);
    const vertexOffset = vertices.length;
    const vertexCount = Math.floor(positions.length / 3);

    for (let vertexIndex = 0; vertexIndex < vertexCount; vertexIndex += 1) {
      const sourceOffset = vertexIndex * 3;
      const point = new Vector3(
        Number(positions[sourceOffset]),
        Number(positions[sourceOffset + 1]),
        Number(positions[sourceOffset + 2])
      );
      if (![point.x, point.y, point.z].every(Number.isFinite)) point.set(0, 0, 0);
      point.applyMatrix4(matrix);

      let normal = null;
      if (normalValues.length >= sourceOffset + 3) {
        normal = new Vector3(
          Number(normalValues[sourceOffset]),
          Number(normalValues[sourceOffset + 1]),
          Number(normalValues[sourceOffset + 2])
        );
        if (![normal.x, normal.y, normal.z].every(Number.isFinite) || normal.lengthSq() < 1e-12) {
          normal = null;
        } else {
          normal.applyMatrix3(normalMatrix).normalize();
        }
      }

      vertices.push({
        point,
        normal,
        color: readVertexColor(colorValues, vertexIndex, baseColor)
      });
    }

    const rawIndices = Array.isArray(geometry.indices) && geometry.indices.length >= 3
      ? geometry.indices.map(Number)
      : Array.from({ length: vertexCount }, (_, index) => index);
    const opacity = clamp(Number.isFinite(Number(object.opacity)) ? Number(object.opacity) : 1);
    const roughness = clamp(Number.isFinite(Number(object.roughness)) ? Number(object.roughness) : 0.6);

    for (let index = 0; index + 2 < rawIndices.length; index += 3) {
      const localA = Math.floor(rawIndices[index]);
      const localB = Math.floor(rawIndices[index + 1]);
      const localC = Math.floor(rawIndices[index + 2]);
      if ([localA, localB, localC].some((value) => value < 0 || value >= vertexCount)) continue;
      if (localA === localB || localB === localC || localC === localA) continue;
      triangles.push({
        a: vertexOffset + localA,
        b: vertexOffset + localB,
        c: vertexOffset + localC,
        opacity,
        roughness
      });
    }
  }

  if (!vertices.length || !triangles.length) {
    throw new Error("The project contains no renderable custom triangle geometry.");
  }
  return { vertices, triangles, skipped };
}

function cameraBasis(view) {
  const toCamera = new Vector3(...view.toCamera).normalize();
  const upHint = new Vector3(...view.up).normalize();
  let right = new Vector3().crossVectors(upHint, toCamera);
  if (right.lengthSq() < 1e-10) right = new Vector3(1, 0, 0);
  right.normalize();
  const up = new Vector3().crossVectors(toCamera, right).normalize();
  return { toCamera, right, up };
}

function vertexLight(normal, faceNormal, basis, lightDirection, fillDirection, roughness) {
  const oriented = (normal ?? faceNormal).clone();
  if (oriented.dot(faceNormal) < 0) oriented.negate();
  const diffuse = Math.max(0, oriented.dot(lightDirection));
  const fill = Math.max(0, oriented.dot(fillDirection));
  const cameraFill = Math.max(0, oriented.dot(basis.toCamera));
  const rim = Math.pow(1 - Math.abs(oriented.dot(basis.toCamera)), 2);
  const specular = Math.pow(Math.max(0, oriented.dot(lightDirection.clone().add(basis.toCamera).normalize())), 20)
    * (1 - roughness);
  // A preview sheet must remain readable even when imported normals are noisy or
  // a surface faces away from the key light. The camera fill keeps the complete
  // silhouette visible while the directional terms still describe the form.
  return clamp(
    0.46 + cameraFill * 0.22 + diffuse * 0.34 + fill * 0.10 + rim * 0.08 + specular * 0.16,
    0.40,
    1.22
  );
}

function edgeFunction(ax, ay, bx, by, px, py) {
  return (px - ax) * (by - ay) - (py - ay) * (bx - ax);
}

function renderTriangle(image, panel, content, depthBuffer, projected, model, triangle, lighting) {
  const p0 = projected[triangle.a];
  const p1 = projected[triangle.b];
  const p2 = projected[triangle.c];
  const vertex0 = model.vertices[triangle.a];
  const vertex1 = model.vertices[triangle.b];
  const vertex2 = model.vertices[triangle.c];
  const faceNormal = new Vector3()
    .subVectors(vertex1.point, vertex0.point)
    .cross(new Vector3().subVectors(vertex2.point, vertex0.point));
  if (faceNormal.lengthSq() < 1e-14) return;
  faceNormal.normalize();
  if (faceNormal.dot(lighting.basis.toCamera) < 0) faceNormal.negate();

  const intensity0 = vertexLight(vertex0.normal, faceNormal, lighting.basis, lighting.key, lighting.fill, triangle.roughness);
  const intensity1 = vertexLight(vertex1.normal, faceNormal, lighting.basis, lighting.key, lighting.fill, triangle.roughness);
  const intensity2 = vertexLight(vertex2.normal, faceNormal, lighting.basis, lighting.key, lighting.fill, triangle.roughness);
  const area = edgeFunction(p0.x, p0.y, p1.x, p1.y, p2.x, p2.y);
  if (Math.abs(area) < 0.01) return;
  const inverseArea = 1 / area;

  const minimumX = Math.max(content.x, Math.floor(Math.min(p0.x, p1.x, p2.x)));
  const maximumX = Math.min(content.x + content.width - 1, Math.ceil(Math.max(p0.x, p1.x, p2.x)));
  const minimumY = Math.max(content.y, Math.floor(Math.min(p0.y, p1.y, p2.y)));
  const maximumY = Math.min(content.y + content.height - 1, Math.ceil(Math.max(p0.y, p1.y, p2.y)));
  if (minimumX > maximumX || minimumY > maximumY) return;

  for (let y = minimumY; y <= maximumY; y += 1) {
    for (let x = minimumX; x <= maximumX; x += 1) {
      const sampleX = x + 0.5;
      const sampleY = y + 0.5;
      const weight0 = edgeFunction(p1.x, p1.y, p2.x, p2.y, sampleX, sampleY) * inverseArea;
      const weight1 = edgeFunction(p2.x, p2.y, p0.x, p0.y, sampleX, sampleY) * inverseArea;
      const weight2 = 1 - weight0 - weight1;
      if (weight0 < -1e-5 || weight1 < -1e-5 || weight2 < -1e-5) continue;

      const depth = p0.depth * weight0 + p1.depth * weight1 + p2.depth * weight2;
      const localX = x - panel.x;
      const localY = y - panel.y;
      const depthIndex = localY * panel.width + localX;
      if (depth <= depthBuffer[depthIndex]) continue;
      depthBuffer[depthIndex] = depth;

      const intensity = intensity0 * weight0 + intensity1 * weight1 + intensity2 * weight2;
      const red = (vertex0.color[0] * weight0 + vertex1.color[0] * weight1 + vertex2.color[0] * weight2) * intensity;
      const green = (vertex0.color[1] * weight0 + vertex1.color[1] * weight1 + vertex2.color[1] * weight2) * intensity;
      const blue = (vertex0.color[2] * weight0 + vertex1.color[2] * weight1 + vertex2.color[2] * weight2) * intensity;
      blendPixel(image, x, y, red, green, blue, triangle.opacity);
    }
  }
}

function darkenDepthEdges(image, panel, content, depthBuffer, depthSpan) {
  // Only strong depth breaks should become creases. A low threshold turns dense
  // organic topology into a dark wireframe, which is the opposite of a useful
  // model preview.
  const threshold = Math.max(1e-5, depthSpan * 0.075);
  const edgePixels = [];
  const localLeft = content.x - panel.x;
  const localTop = content.y - panel.y;
  const localRight = localLeft + content.width - 1;
  const localBottom = localTop + content.height - 1;
  const neighbors = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  for (let localY = localTop; localY <= localBottom; localY += 1) {
    for (let localX = localLeft; localX <= localRight; localX += 1) {
      const index = localY * panel.width + localX;
      const depth = depthBuffer[index];
      if (!Number.isFinite(depth)) continue;
      let isEdge = false;
      for (const [dx, dy] of neighbors) {
        const neighborX = localX + dx;
        const neighborY = localY + dy;
        if (neighborX < localLeft || neighborX > localRight || neighborY < localTop || neighborY > localBottom) {
          isEdge = true;
          break;
        }
        const neighborDepth = depthBuffer[neighborY * panel.width + neighborX];
        if (!Number.isFinite(neighborDepth) || Math.abs(neighborDepth - depth) > threshold) {
          isEdge = true;
          break;
        }
      }
      if (isEdge) edgePixels.push([panel.x + localX, panel.y + localY]);
    }
  }

  for (const [x, y] of edgePixels) {
    const offset = (y * image.bitmap.width + x) * 4;
    image.bitmap.data[offset] = Math.round(image.bitmap.data[offset] * 0.72);
    image.bitmap.data[offset + 1] = Math.round(image.bitmap.data[offset + 1] * 0.75);
    image.bitmap.data[offset + 2] = Math.round(image.bitmap.data[offset + 2] * 0.78);
  }
}

function renderPanel(image, model, view, panel) {
  drawPanelBackground(image, panel);
  const basis = cameraBasis(view);
  const content = {
    x: panel.x + 20,
    y: panel.y + LABEL_HEIGHT + 14,
    width: panel.width - 40,
    height: panel.height - LABEL_HEIGHT - 32
  };

  const rawProjected = model.vertices.map(({ point }) => ({
    x: point.dot(basis.right),
    y: point.dot(basis.up),
    depth: point.dot(basis.toCamera)
  }));
  let minimumX = Infinity;
  let maximumX = -Infinity;
  let minimumY = Infinity;
  let maximumY = -Infinity;
  let minimumDepth = Infinity;
  let maximumDepth = -Infinity;
  for (const point of rawProjected) {
    minimumX = Math.min(minimumX, point.x);
    maximumX = Math.max(maximumX, point.x);
    minimumY = Math.min(minimumY, point.y);
    maximumY = Math.max(maximumY, point.y);
    minimumDepth = Math.min(minimumDepth, point.depth);
    maximumDepth = Math.max(maximumDepth, point.depth);
  }
  const extentX = Math.max(1e-6, maximumX - minimumX);
  const extentY = Math.max(1e-6, maximumY - minimumY);
  const scale = Math.min(content.width / extentX, content.height / extentY) * 0.91;
  const centerX = (minimumX + maximumX) * 0.5;
  const centerY = (minimumY + maximumY) * 0.5;
  const projected = rawProjected.map((point) => ({
    x: content.x + content.width * 0.5 + (point.x - centerX) * scale,
    y: content.y + content.height * 0.5 - (point.y - centerY) * scale,
    depth: point.depth
  }));

  const depthBuffer = new Float32Array(panel.width * panel.height);
  depthBuffer.fill(Number.NEGATIVE_INFINITY);
  const key = basis.toCamera.clone().multiplyScalar(0.72)
    .add(basis.up.clone().multiplyScalar(0.65))
    .add(basis.right.clone().multiplyScalar(-0.34))
    .normalize();
  const fill = basis.toCamera.clone().multiplyScalar(0.35)
    .add(basis.right.clone().multiplyScalar(0.75))
    .add(basis.up.clone().multiplyScalar(0.15))
    .normalize();
  const lighting = { basis, key, fill };

  for (const triangle of model.triangles) {
    renderTriangle(image, panel, content, depthBuffer, projected, model, triangle, lighting);
  }
  darkenDepthEdges(image, panel, content, depthBuffer, maximumDepth - minimumDepth);

  const labelScale = 4;
  const labelWidth = textWidth(view.label, labelScale) + 30;
  fillRect(image, panel.x + 12, panel.y + 10, labelWidth, 7 * labelScale + 16, [7, 12, 16, 255]);
  drawText(image, view.label, panel.x + 27, panel.y + 18, labelScale, [255, 205, 86, 255]);
  strokeRect(image, panel.x, panel.y, panel.width, panel.height, [67, 91, 105, 255], 2);
}

function createPanels(width, height) {
  const panelWidth = Math.floor((width - OUTER_MARGIN * 2 - PANEL_GAP) / 2);
  const panelHeight = Math.floor((height - OUTER_MARGIN * 2 - PANEL_GAP) / 2);
  return VIEWS.map((view, index) => ({
    ...view,
    x: OUTER_MARGIN + (index % 2) * (panelWidth + PANEL_GAP),
    y: OUTER_MARGIN + Math.floor(index / 2) * (panelHeight + PANEL_GAP),
    width: panelWidth,
    height: panelHeight
  }));
}

async function main() {
  const args = process.argv.slice(2);
  const positional = positionalArguments(args);
  if (!positional.length) {
    usage();
    process.exitCode = 1;
    return;
  }

  const inputPath = path.resolve(positional[0]);
  const width = optionNumber(args, "--width", DEFAULT_WIDTH);
  const height = optionNumber(args, "--height", DEFAULT_HEIGHT);
  const outputPath = path.resolve(positional[1] ?? path.join(
    path.dirname(inputPath),
    `${path.basename(inputPath, path.extname(inputPath))}-preview.png`
  ));
  if (!fs.existsSync(inputPath)) throw new Error(`Project not found: ${inputPath}`);

  const project = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const model = collectModel(project);
  const image = new Jimp({ width, height, color: 0x000000ff });
  fillCanvasBackground(image);
  const panels = createPanels(width, height);
  for (let index = 0; index < panels.length; index += 1) {
    renderPanel(image, model, VIEWS[index], panels[index]);
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  await image.write(outputPath);
  console.log(`Rendered ${model.triangles.length.toLocaleString("en-US")} triangles from ${project?.scene?.objects?.length ?? 0} scene objects.`);
  if (model.skipped.length) console.log(`Skipped non-custom objects: ${model.skipped.join(", ")}`);
  console.log(`Preview: ${outputPath} (${width}x${height})`);
}

main().catch((error) => {
  console.error(error?.stack ?? error?.message ?? String(error));
  process.exitCode = 1;
});
