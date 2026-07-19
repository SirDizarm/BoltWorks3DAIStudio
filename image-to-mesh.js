#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { Jimp } from 'jimp';

const config = {
  depthScale: 0.5,
  smoothRadius: 2,
  gridStep: 1,
  threshold: 10
};

async function loadImageAsHeightmap(imagePath) {
  const image = await Jimp.read(imagePath);

  image.greyscale();

  const w = image.bitmap.width;
  const h = image.bitmap.height;
  const { data } = image.bitmap;

  const heightmap = [];

  for (let y = 0; y < h; y += config.gridStep) {
    const row = [];

    for (let x = 0; x < w; x += config.gridStep) {
      const idx = (y * w + x) * 4;

      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      const brightness = (r + g + b) / 3;
      row.push(brightness);
    }

    heightmap.push(row);
  }

  return heightmap;
}

function smoothHeightmap(map, radius) {
  if (radius <= 0) return map;

  const h = map.length;
  const w = map[0].length;
  const out = Array.from({ length: h }, () => Array(w).fill(0));

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let count = 0;

      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const ny = y + dy;
          const nx = x + dx;

          if (ny < 0 || ny >= h || nx < 0 || nx >= w) continue;

          sum += map[ny][nx];
          count++;
        }
      }

      out[y][x] = sum / count;
    }
  }

  return out;
}

function buildMeshFromHeightmap(map) {
  const h = map.length;
  const w = map[0].length;

  const vertices = [];
  const faces = [];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const brightness = map[y][x];
      const z =
        brightness < config.threshold
          ? 0
          : (brightness / 255) * config.depthScale;

      vertices.push({ x, y, z });
    }
  }

  const index = (x, y) => y * w + x;

  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const v1 = index(x, y) + 1;
      const v2 = index(x + 1, y) + 1;
      const v3 = index(x, y + 1) + 1;
      const v4 = index(x + 1, y + 1) + 1;

      faces.push([v1, v2, v3]);
      faces.push([v2, v4, v3]);
    }
  }

  return { vertices, faces };
}

function exportOBJ(mesh, outPath) {
  const lines = [];

  for (const v of mesh.vertices) {
    lines.push(`v ${v.x} ${-v.y} ${v.z}`);
  }

  for (const f of mesh.faces) {
    lines.push(`f ${f[0]} ${f[1]} ${f[2]}`);
  }

  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
  console.log(`OBJ written to ${outPath}`);
}

function exportJSON(mesh, outPath) {
  fs.writeFileSync(outPath, JSON.stringify(mesh, null, 2), 'utf8');
  console.log(`JSON written to ${outPath}`);
}

async function main() {
  const [, , inputImage, outputBase] = process.argv;

  if (!inputImage || !outputBase) {
    console.error('Usage: node image-to-mesh.js <input.png> <outputBase>');
    process.exit(1);
  }

  const imagePath = path.resolve(inputImage);
  const base = path.resolve(outputBase);

  console.log(`Loading image: ${imagePath}`);

  const rawMap = await loadImageAsHeightmap(imagePath);

  console.log('Smoothing heightmap...');
  const smoothMap = smoothHeightmap(rawMap, config.smoothRadius);

  console.log('Building mesh...');
  const mesh = buildMeshFromHeightmap(smoothMap);

  exportOBJ(mesh, `${base}.obj`);
  exportJSON(mesh, `${base}.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});