/*
 * BoltWorks 3D AI Studio image-to-mesh generator.
 *
 * This file owns image sampling, view-sheet detection, silhouette analysis,
 * height-map generation, voxel/surface construction, and source-like mesh shaping.
 * Editor UI, scene insertion, history, and file loading stay in index.html.
 */
"use strict";

  function clampNumber(value, fallback, min, max) {
    const number = Number(value);
    return Math.max(min, Math.min(max, Number.isFinite(number) ? number : fallback));
  }

    function sampleReliefPixel(imageData, width, height, x, y) {
      const px = Math.max(0, Math.min(width - 1, Math.round(x)));
      const py = Math.max(0, Math.min(height - 1, Math.round(y)));
      const i = (py * width + px) * 4;
      const r = imageData.data[i] || 0;
      const g = imageData.data[i + 1] || 0;
      const b = imageData.data[i + 2] || 0;
      const a = imageData.data[i + 3] ?? 255;
      const luma = r * .2126 + g * .7152 + b * .0722;
      return { r, g, b, a, luma };
    }

    function smoothReliefHeights(heights, mask, cols, rows, passes) {
      let current = heights.slice();
      for (let pass = 0; pass < passes; pass++) {
        const next = current.slice();
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            const index = y * cols + x;
            if (!mask[index]) continue;
            let sum = current[index];
            let count = 1;
            for (let oy = -1; oy <= 1; oy++) {
              for (let ox = -1; ox <= 1; ox++) {
                if (!ox && !oy) continue;
                const nx = x + ox;
                const ny = y + oy;
                if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
                const ni = ny * cols + nx;
                if (!mask[ni]) continue;
                sum += current[ni];
                count++;
              }
            }
            next[index] = sum / count;
          }
        }
        current = next;
      }
      return current;
    }


    function reliefForegroundCheck(pixel, threshold, darkForeground) {
      return pixel.a > 24 && (darkForeground ? pixel.luma <= threshold : pixel.luma >= threshold);
    }

    function detectReliefViewRects(imageData, threshold, darkForeground) {
      const { width, height, data } = imageData;
      const columnHits = new Array(width).fill(0);
      const rowHits = new Array(height).fill(0);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          const a = data[i + 3] ?? 255;
          if (a <= 24) continue;
          const luma = data[i] * .2126 + data[i + 1] * .7152 + data[i + 2] * .0722;
          const hit = darkForeground ? luma <= threshold : luma >= threshold;
          if (!hit) continue;
          columnHits[x]++;
          rowHits[y]++;
        }
      }
      const minColumnHits = Math.max(2, Math.floor(height * .015));
      const rawRuns = [];
      let runStart = -1;
      for (let x = 0; x <= width; x++) {
        const active = x < width && columnHits[x] >= minColumnHits;
        if (active && runStart < 0) runStart = x;
        if ((!active || x === width) && runStart >= 0) {
          if (x - runStart >= Math.max(8, width * .025)) rawRuns.push({ x: runStart, right: x - 1 });
          runStart = -1;
        }
      }
      const mergedRuns = [];
      for (const run of rawRuns) {
        const prev = mergedRuns[mergedRuns.length - 1];
        if (prev && run.x - prev.right < width * .035) {
          prev.right = run.right;
        } else {
          mergedRuns.push({ ...run });
        }
      }
      const minRowHits = Math.max(2, Math.floor(width * .004));
      let top = 0;
      let bottom = height - 1;
      while (top < height - 1 && rowHits[top] < minRowHits) top++;
      while (bottom > top && rowHits[bottom] < minRowHits) bottom--;
      const padX = Math.max(2, Math.round(width * .01));
      const padY = Math.max(2, Math.round(height * .015));
      const runs = mergedRuns
        .map(run => ({
          x: Math.max(0, run.x - padX),
          y: Math.max(0, top - padY),
          w: Math.min(width - Math.max(0, run.x - padX), run.right - run.x + 1 + padX * 2),
          h: Math.min(height - Math.max(0, top - padY), bottom - top + 1 + padY * 2)
        }))
        .filter(rect => rect.w > 8 && rect.h > 8)
        .sort((a, b) => a.x - b.x);
      if (runs.length >= 3) return [runs[0], runs[Math.floor(runs.length / 2)], runs[runs.length - 1]];
      if (runs.length === 2) return [runs[0], runs[1], runs[0]];
      return [
        { x: 0, y: 0, w: Math.floor(width / 3), h: height },
        { x: Math.floor(width / 3), y: 0, w: Math.floor(width / 3), h: height },
        { x: Math.floor(width * 2 / 3), y: 0, w: width - Math.floor(width * 2 / 3), h: height }
      ];
    }

    function buildReliefViewProfile(imageData, rect, rows, threshold, darkForeground) {
      const profile = [];
      for (let y = 0; y < rows; y++) {
        const sy = rect.y + (y / Math.max(1, rows - 1)) * Math.max(1, rect.h - 1);
        let minX = Infinity;
        let maxX = -Infinity;
        let lumaSum = 0;
        let count = 0;
        const samples = Math.max(24, Math.min(180, Math.round(rect.w)));
        for (let x = 0; x < samples; x++) {
          const sx = rect.x + (x / Math.max(1, samples - 1)) * Math.max(1, rect.w - 1);
          const pixel = sampleReliefPixel(imageData, imageData.width, imageData.height, sx, sy);
          if (!reliefForegroundCheck(pixel, threshold, darkForeground)) continue;
          minX = Math.min(minX, x / Math.max(1, samples - 1));
          maxX = Math.max(maxX, x / Math.max(1, samples - 1));
          lumaSum += pixel.luma;
          count++;
        }
        if (!count) {
          profile.push({ active: false, center: .5, width: 0, luma: darkForeground ? 255 : 0 });
        } else {
          profile.push({
            active: true,
            center: (minX + maxX) * .5,
            width: Math.max(0, maxX - minX),
            luma: lumaSum / count
          });
        }
      }
      return profile;
    }

    function smoothReliefProfile(profile, passes) {
      let current = profile.map(row => ({ ...row }));
      for (let pass = 0; pass < passes; pass++) {
        current = current.map((row, index) => {
          let width = row.active ? row.width : 0;
          let center = row.active ? row.center : .5;
          let luma = row.luma;
          let count = row.active ? 1 : 0;
          for (const offset of [-1, 1]) {
            const other = current[index + offset];
            if (!other?.active) continue;
            width += other.width;
            center += other.center;
            luma += other.luma;
            count++;
          }
          if (!count) return { ...row, active: false };
          return { active: true, width: width / count, center: center / count, luma: luma / count };
        });
      }
      return current;
    }

    function createSmoothMannequinSheetGeometry({ scale, depth, back, threshold, smoothPasses, darkForeground, imageData, viewRects, bodyPreset = "auto", sourceName = "" }) {
      const positions = [];
      const uvs = [];
      const meshH = scale;
      const meshW = scale * .72;
      const meshD = Math.max(back, depth, .25) * 2.35;
      const sx = meshW / 3.8;
      const sy = meshH / 6;
      const sz = meshD / 1.65;
      const p = (x, y, z) => [x * sx, y * sy, z * sz];
      const pushTri = (a, b, c) => {
        positions.push(...a.p, ...b.p, ...c.p);
        uvs.push(...a.uv, ...b.uv, ...c.uv);
      };
      const pushQuad = (a, b, c, d) => {
        pushTri(a, b, c);
        pushTri(a, c, d);
      };
      const nameHint = String(sourceName || "").toLowerCase();
      const resolvedPreset = bodyPreset === "auto"
        ? (/female|woman|girl|boob|breast|bust|curvy/.test(nameHint) ? "female" : (/male|man|boy|muscle|pec|bodybuilder/.test(nameHint) ? "male" : "neutral"))
        : bodyPreset;
      const isFemale = resolvedPreset === "female";
      const isMale = resolvedPreset === "male";
      let primitiveParts = 0;
      const ellipsoidPoint = (cx, cy, cz, rx, ry, rz, theta, phi) => ({
        p: p(
          cx + Math.cos(theta) * Math.sin(phi) * rx,
          cy + Math.cos(phi) * ry,
          cz + Math.sin(theta) * Math.sin(phi) * rz
        ),
        uv: [theta / (Math.PI * 2), 1 - phi / Math.PI]
      });
      const addEllipsoid = (cx, cy, cz, rx, ry, rz, rings = 14, segments = 24) => {
        primitiveParts++;
        for (let r = 0; r < rings; r++) {
          const phi0 = (r / rings) * Math.PI;
          const phi1 = ((r + 1) / rings) * Math.PI;
          for (let s = 0; s < segments; s++) {
            const theta0 = (s / segments) * Math.PI * 2;
            const theta1 = ((s + 1) / segments) * Math.PI * 2;
            pushQuad(
              ellipsoidPoint(cx, cy, cz, rx, ry, rz, theta0, phi0),
              ellipsoidPoint(cx, cy, cz, rx, ry, rz, theta1, phi0),
              ellipsoidPoint(cx, cy, cz, rx, ry, rz, theta1, phi1),
              ellipsoidPoint(cx, cy, cz, rx, ry, rz, theta0, phi1)
            );
          }
        }
      };
      const addCapsuleX = (cx, cy, cz, halfLength, ry, rz, rings = 18, segments = 18) => {
        primitiveParts++;
        for (let i = 0; i < rings; i++) {
          const t0 = -1 + (i / rings) * 2;
          const t1 = -1 + ((i + 1) / rings) * 2;
          const capRadius = t => {
            const a = Math.abs(t);
            if (a <= .72) return 1;
            const k = (1 - a) / .28;
            return Math.max(.08, Math.sin(Math.max(0, Math.min(1, k)) * Math.PI * .5));
          };
          for (let s = 0; s < segments; s++) {
            const a0 = (s / segments) * Math.PI * 2;
            const a1 = ((s + 1) / segments) * Math.PI * 2;
            const v = (t, a) => {
              const r = capRadius(t);
              return { p: p(cx + t * halfLength, cy + Math.cos(a) * ry * r, cz + Math.sin(a) * rz * r), uv: [(t + 1) * .5, a / (Math.PI * 2)] };
            };
            pushQuad(v(t0, a0), v(t1, a0), v(t1, a1), v(t0, a1));
          }
        }
      };
      const addCapsuleY = (cx, cy, cz, halfLength, rx, rz, rings = 20, segments = 18) => {
        primitiveParts++;
        for (let i = 0; i < rings; i++) {
          const t0 = -1 + (i / rings) * 2;
          const t1 = -1 + ((i + 1) / rings) * 2;
          const capRadius = t => {
            const a = Math.abs(t);
            if (a <= .72) return 1;
            const k = (1 - a) / .28;
            return Math.max(.08, Math.sin(Math.max(0, Math.min(1, k)) * Math.PI * .5));
          };
          for (let s = 0; s < segments; s++) {
            const a0 = (s / segments) * Math.PI * 2;
            const a1 = ((s + 1) / segments) * Math.PI * 2;
            const v = (t, a) => {
              const r = capRadius(t);
              return { p: p(cx + Math.cos(a) * rx * r, cy + t * halfLength, cz + Math.sin(a) * rz * r), uv: [a / (Math.PI * 2), (t + 1) * .5] };
            };
            pushQuad(v(t0, a0), v(t1, a0), v(t1, a1), v(t0, a1));
          }
        }
      };

      const chestWidth = isMale ? .68 : (isFemale ? .56 : .58);
      const hipWidth = isFemale ? .72 : (isMale ? .55 : .62);
      const shoulderY = 1.28;
      const addFingerSet = side => {
        const baseX = side * 2.1;
        const fingerOffsets = [-.13, -.065, 0, .065, .13];
        fingerOffsets.forEach((offset, index) => {
          const length = index === 0 || index === 4 ? .17 : .23;
          const spreadY = 1.14 + offset * .65;
          const spreadZ = (index - 2) * .035;
          addCapsuleX(baseX + side * (length * .58), spreadY, spreadZ, length, .018, .014, 6, 8);
          addEllipsoid(baseX + side * (length * 1.18), spreadY, spreadZ, .025, .018, .014, 5, 8);
        });
        addCapsuleX(side * 2.06, 1.03, .07, .16, .023, .018, 6, 8);
      };
      const addToeSet = side => {
        [-.055, 0, .055].forEach(offset => {
          addEllipsoid(side * (.24 + offset), -3.05, .43, .045, .025, .055, 5, 8);
        });
      };

      addEllipsoid(0, 2.38, 0, .31, .43, .27, 16, 26);
      addEllipsoid(-.28, 2.37, .01, .05, .13, .035, 8, 10);
      addEllipsoid(.28, 2.37, .01, .05, .13, .035, 8, 10);
      addCapsuleY(0, 1.84, 0, .22, .16, .14, 10, 16);
      addEllipsoid(0, 1.08, .02, chestWidth, .82, isMale ? .36 : .33, 18, 28);
      addEllipsoid(0, .18, -.02, .39, .58, .28, 14, 24);
      addEllipsoid(0, -.68, -.03, hipWidth, isFemale ? .62 : .56, isFemale ? .46 : .39, 16, 28);
      addEllipsoid(-.43, shoulderY, .01, .2, .19, .18, 12, 16);
      addEllipsoid(.43, shoulderY, .01, .2, .19, .18, 12, 16);
      addCapsuleX(-.95, 1.23, 0, .53, isMale ? .16 : .135, isMale ? .145 : .13, 14, 16);
      addCapsuleX(-1.55, 1.18, 0, .55, isMale ? .13 : .115, isMale ? .12 : .105, 14, 16);
      addEllipsoid(-2.08, 1.14, 0, .18, .085, .07, 10, 14);
      addFingerSet(-1);
      addCapsuleX(.95, 1.23, 0, .53, isMale ? .16 : .135, isMale ? .145 : .13, 14, 16);
      addCapsuleX(1.55, 1.18, 0, .55, isMale ? .13 : .115, isMale ? .12 : .105, 14, 16);
      addEllipsoid(2.08, 1.14, 0, .18, .085, .07, 10, 14);
      addFingerSet(1);
      addCapsuleY(-.3, -1.5, 0, .82, isFemale ? .2 : .17, isFemale ? .18 : .16, 18, 16);
      addCapsuleY(.3, -1.5, 0, .82, isFemale ? .2 : .17, isFemale ? .18 : .16, 18, 16);
      addCapsuleY(-.23, -2.42, .02, .6, .125, .12, 14, 14);
      addCapsuleY(.23, -2.42, .02, .6, .125, .12, 14, 14);
      addEllipsoid(-.24, -3.03, .18, .18, .075, .28, 8, 14);
      addEllipsoid(.24, -3.03, .18, .18, .075, .28, 8, 14);
      addToeSet(-1);
      addToeSet(1);
      if (isFemale) {
        addEllipsoid(-.23, 1.03, .28, .2, .23, .16, 12, 16);
        addEllipsoid(.23, 1.03, .28, .2, .23, .16, 12, 16);
        addEllipsoid(-.28, -.74, -.34, .28, .24, .2, 12, 16);
        addEllipsoid(.28, -.74, -.34, .28, .24, .2, 12, 16);
      } else {
        addEllipsoid(-.25, 1.1, .25, .25, .16, .08, 10, 14);
        addEllipsoid(.25, 1.1, .25, .25, .16, .08, 10, 14);
        addEllipsoid(0, .52, .29, .16, .08, .04, 8, 10);
        addEllipsoid(0, .28, .29, .14, .07, .035, 8, 10);
      }
      if (isMale) {
        addEllipsoid(-.75, 1.23, .08, .18, .11, .12, 10, 14);
        addEllipsoid(.75, 1.23, .08, .18, .11, .12, 10, 14);
        addEllipsoid(-.3, -.98, .22, .16, .28, .09, 10, 14);
        addEllipsoid(.3, -.98, .22, .16, .28, .09, 10, 14);
        addEllipsoid(-.3, -2.2, -.12, .14, .25, .11, 10, 14);
        addEllipsoid(.3, -2.2, -.12, .14, .25, .11, 10, 14);
      }

      return {
        positions,
        uvs,
        meta: { mode: "viewSheetDetailedBuildV9", buildMode: "smooth", bodyPreset, resolvedPreset, sourceName, sourceW: imageData.width, sourceH: imageData.height, threshold, darkForeground, smoothPasses, depth, back, viewRects, primitiveParts }
      };
    }

    function createMannequinSheetRebuildGeometry({ scale, depth, back, threshold, darkForeground, imageData, viewRects, bodyPreset = "auto", sourceName = "" }) {
      const positions = [];
      const uvs = [];
      const meshH = scale;
      const meshW = scale * .82;
      const meshD = Math.max(back, depth, .25) * 2.35;
      const sx = meshW / 5.25;
      const sy = meshH / 6.2;
      const sz = meshD / 1.9;
      const p = (x, y, z) => [x * sx, y * sy, z * sz];
      const pushTri = (a, b, c) => {
        positions.push(...a.p, ...b.p, ...c.p);
        uvs.push(...a.uv, ...b.uv, ...c.uv);
      };
      const pushQuad = (a, b, c, d) => {
        pushTri(a, b, c);
        pushTri(a, c, d);
      };
      const nameHint = String(sourceName || "").toLowerCase();
      const resolvedPreset = bodyPreset === "auto"
        ? (/female|woman|girl|boob|breast|bust|curvy/.test(nameHint) ? "female" : (/male|man|boy|muscle|pec|bodybuilder/.test(nameHint) ? "male" : "female"))
        : bodyPreset;
      const isFemale = resolvedPreset === "female";
      const isMale = resolvedPreset === "male";
      const viewRatio = rect => rect && rect.h ? rect.w / rect.h : .32;
      const sideRatio = Math.max(.12, Math.min(.34, viewRatio(viewRects?.[1])));
      const depthScale = Math.max(.82, Math.min(1.18, sideRatio / .22));
      let primitiveParts = 0;
      const ellipsoidPoint = (cx, cy, cz, rx, ry, rz, theta, phi) => ({
        p: p(
          cx + Math.cos(theta) * Math.sin(phi) * rx,
          cy + Math.cos(phi) * ry,
          cz + Math.sin(theta) * Math.sin(phi) * rz
        ),
        uv: [theta / (Math.PI * 2), 1 - phi / Math.PI]
      });
      const addEllipsoid = (cx, cy, cz, rx, ry, rz, rings = 16, segments = 24) => {
        primitiveParts++;
        for (let r = 0; r < rings; r++) {
          const phi0 = (r / rings) * Math.PI;
          const phi1 = ((r + 1) / rings) * Math.PI;
          for (let s = 0; s < segments; s++) {
            const theta0 = (s / segments) * Math.PI * 2;
            const theta1 = ((s + 1) / segments) * Math.PI * 2;
            pushQuad(
              ellipsoidPoint(cx, cy, cz, rx, ry, rz, theta0, phi0),
              ellipsoidPoint(cx, cy, cz, rx, ry, rz, theta1, phi0),
              ellipsoidPoint(cx, cy, cz, rx, ry, rz, theta1, phi1),
              ellipsoidPoint(cx, cy, cz, rx, ry, rz, theta0, phi1)
            );
          }
        }
      };
      const capsuleRadius = t => {
        const a = Math.abs(t);
        if (a <= .72) return 1;
        const k = (1 - a) / .28;
        return Math.max(.08, Math.sin(Math.max(0, Math.min(1, k)) * Math.PI * .5));
      };
      const addCapsuleX = (cx, cy, cz, halfLength, ry, rz, rings = 18, segments = 18) => {
        primitiveParts++;
        for (let i = 0; i < rings; i++) {
          const t0 = -1 + (i / rings) * 2;
          const t1 = -1 + ((i + 1) / rings) * 2;
          for (let s = 0; s < segments; s++) {
            const a0 = (s / segments) * Math.PI * 2;
            const a1 = ((s + 1) / segments) * Math.PI * 2;
            const v = (t, a) => {
              const r = capsuleRadius(t);
              return { p: p(cx + t * halfLength, cy + Math.cos(a) * ry * r, cz + Math.sin(a) * rz * r), uv: [(t + 1) * .5, a / (Math.PI * 2)] };
            };
            pushQuad(v(t0, a0), v(t1, a0), v(t1, a1), v(t0, a1));
          }
        }
      };
      const addCapsuleY = (cx, cy, cz, halfLength, rx, rz, rings = 18, segments = 18) => {
        primitiveParts++;
        for (let i = 0; i < rings; i++) {
          const t0 = -1 + (i / rings) * 2;
          const t1 = -1 + ((i + 1) / rings) * 2;
          for (let s = 0; s < segments; s++) {
            const a0 = (s / segments) * Math.PI * 2;
            const a1 = ((s + 1) / segments) * Math.PI * 2;
            const v = (t, a) => {
              const r = capsuleRadius(t);
              return { p: p(cx + Math.cos(a) * rx * r, cy + t * halfLength, cz + Math.sin(a) * rz * r), uv: [a / (Math.PI * 2), (t + 1) * .5] };
            };
            pushQuad(v(t0, a0), v(t1, a0), v(t1, a1), v(t0, a1));
          }
        }
      };
      const addFingerSet = side => {
        const palmX = side * 2.34;
        addEllipsoid(palmX, 1.12, .02, .17, .085, .065, 10, 14);
        [-2, -1, 0, 1, 2].forEach(i => {
          const length = Math.abs(i) === 2 ? .2 : .27;
          const fy = 1.12 + i * .045;
          const fz = .04 + i * .018;
          addCapsuleX(palmX + side * (.12 + length * .48), fy, fz, length * .5, .017, .013, 6, 8);
          addEllipsoid(palmX + side * (.12 + length), fy, fz, .022, .016, .013, 5, 8);
        });
        addCapsuleX(palmX + side * .03, 1.02, .09, .16, .022, .017, 6, 8);
      };
      const addFoot = side => {
        addEllipsoid(side * .17, -3.02, .2, .18, .075, .31, 8, 14);
        [-.06, 0, .06].forEach(offset => addEllipsoid(side * (.17 + offset), -3.04, .47, .04, .022, .055, 5, 8));
      };
      const chestWidth = isMale ? .72 : .6;
      const waistWidth = isMale ? .43 : .36;
      const hipWidth = isFemale ? .66 : .56;
      const chestDepth = (isMale ? .37 : .34) * depthScale;
      const hipDepth = (isFemale ? .44 : .38) * depthScale;
      addEllipsoid(0, 2.42, 0, .3, .41, .26 * depthScale, 18, 28);
      addEllipsoid(-.28, 2.39, .01, .045, .12, .035, 8, 10);
      addEllipsoid(.28, 2.39, .01, .045, .12, .035, 8, 10);
      addCapsuleY(0, 1.87, 0, .22, .14, .13 * depthScale, 10, 16);
      addEllipsoid(0, 1.08, .02, chestWidth, .78, chestDepth, 18, 28);
      addEllipsoid(0, .23, -.02, waistWidth, .48, .25 * depthScale, 14, 24);
      addEllipsoid(0, -.62, -.03, hipWidth, isFemale ? .55 : .5, hipDepth, 16, 28);
      addEllipsoid(-.48, 1.27, .02, .19, .17, .16 * depthScale, 12, 16);
      addEllipsoid(.48, 1.27, .02, .19, .17, .16 * depthScale, 12, 16);
      addCapsuleX(-1.02, 1.23, 0, .54, isMale ? .145 : .125, (isMale ? .13 : .115) * depthScale, 14, 16);
      addCapsuleX(-1.72, 1.17, 0, .62, isMale ? .115 : .1, (isMale ? .105 : .092) * depthScale, 14, 16);
      addFingerSet(-1);
      addCapsuleX(1.02, 1.23, 0, .54, isMale ? .145 : .125, (isMale ? .13 : .115) * depthScale, 14, 16);
      addCapsuleX(1.72, 1.17, 0, .62, isMale ? .115 : .1, (isMale ? .105 : .092) * depthScale, 14, 16);
      addFingerSet(1);
      addCapsuleY(-.22, -1.45, 0, .78, isFemale ? .18 : .16, (isFemale ? .165 : .15) * depthScale, 18, 16);
      addCapsuleY(.22, -1.45, 0, .78, isFemale ? .18 : .16, (isFemale ? .165 : .15) * depthScale, 18, 16);
      addCapsuleY(-.18, -2.36, .02, .62, .115, .105 * depthScale, 14, 14);
      addCapsuleY(.18, -2.36, .02, .62, .115, .105 * depthScale, 14, 14);
      addFoot(-1);
      addFoot(1);
      if (isFemale) {
        addEllipsoid(-.23, 1.03, .29, .19, .21, .145 * depthScale, 14, 18);
        addEllipsoid(.23, 1.03, .29, .19, .21, .145 * depthScale, 14, 18);
        addEllipsoid(-.25, -.7, -.34, .25, .22, .19 * depthScale, 12, 16);
        addEllipsoid(.25, -.7, -.34, .25, .22, .19 * depthScale, 12, 16);
      } else {
        addEllipsoid(-.23, 1.1, .27, .23, .14, .075 * depthScale, 10, 14);
        addEllipsoid(.23, 1.1, .27, .23, .14, .075 * depthScale, 10, 14);
      }
      if (isMale) {
        addEllipsoid(-.7, 1.25, .08, .16, .1, .105 * depthScale, 10, 14);
        addEllipsoid(.7, 1.25, .08, .16, .1, .105 * depthScale, 10, 14);
        addEllipsoid(-.28, -1.0, .18, .14, .24, .08 * depthScale, 10, 14);
        addEllipsoid(.28, -1.0, .18, .14, .24, .08 * depthScale, 10, 14);
      }
      return {
        positions,
        uvs,
        meta: { mode: "mannequinSheetRebuildV21", buildMode: "anatomy", bodyPreset, resolvedPreset, sourceName, sourceW: imageData.width, sourceH: imageData.height, threshold, darkForeground, depth, back, viewRects, sideRatio, depthScale, primitiveParts, partBasedExporter: true }
      };
    }

    function createSheetSilhouetteMeshV23Geometry({ scale, depth, back, threshold, darkForeground, imageData, viewRects, bodyPreset = "auto", sourceName = "" }) {
      const positions = [];
      const uvs = [];
      const sampleCols = 104;
      const sampleRows = 156;
      const sampleDepth = 56;
      const meshH = scale;
      const meshW = scale * .86;
      const meshD = Math.max(back, depth, .25) * 2.15;
      const [frontRect, sideRect, backRect] = viewRects;
      const nameHint = String(sourceName || "").toLowerCase();
      const resolvedPreset = bodyPreset === "auto"
        ? (/female|woman|girl|boob|breast|bust|curvy/.test(nameHint) ? "female" : (/male|man|boy|muscle|pec|bodybuilder/.test(nameHint) ? "male" : "female"))
        : bodyPreset;
      const isFemale = resolvedPreset === "female";
      const isMale = resolvedPreset === "male";
      const viewRatio = rect => rect && rect.h ? rect.w / rect.h : .26;
      const sideRatio = Math.max(.12, Math.min(.34, viewRatio(sideRect)));
      const depthScale = Math.max(.82, Math.min(1.18, sideRatio / .22));
      const edgeMargin = Math.max(3, imageData.width * .018);
      const pushTri = (a, b, c) => {
        positions.push(...a.p, ...b.p, ...c.p);
        uvs.push(...a.uv, ...b.uv, ...c.uv);
      };
      const pushQuad = (a, b, c, d) => {
        pushTri(a, b, c);
        pushTri(a, c, d);
      };
      const sampleRect = (rect, nx, ny) => {
        if (!rect) return [0, 0, 0, 0];
        const sx = rect.x + Math.max(0, Math.min(1, nx)) * Math.max(1, rect.w - 1);
        const sy = rect.y + Math.max(0, Math.min(1, ny)) * Math.max(1, rect.h - 1);
        return sampleReliefPixel(imageData, imageData.width, imageData.height, sx, sy);
      };
      const viewHalfMode = rect => {
        const touchesLeft = rect.x <= edgeMargin;
        const touchesRight = rect.x + rect.w >= imageData.width - edgeMargin;
        if (!touchesLeft && !touchesRight) return "full";
        if (rect.w > imageData.width * .42) return "full";
        return touchesLeft ? "centerToOuter" : "outerToCenter";
      };
      const frontHalfMode = viewHalfMode(frontRect);
      const backHalfMode = viewHalfMode(backRect);
      const halfViewNx = (fullNx, mode) => {
        const nx = Math.max(0, Math.min(1, fullNx));
        if (mode === "centerToOuter") return Math.abs(nx - .5) * 2;
        if (mode === "outerToCenter") return Math.min(nx, 1 - nx) * 2;
        return nx;
      };
      const sampleView = (view, nx, ny) => {
        if (view === "front") return sampleRect(frontRect, halfViewNx(nx, frontHalfMode), ny);
        if (view === "back") return sampleRect(backRect, halfViewNx(nx, backHalfMode), ny);
        return sampleRect(sideRect, nx, ny);
      };
      const frontMask = new Array(sampleCols * sampleRows).fill(false);
      const backMask = new Array(sampleCols * sampleRows).fill(false);
      const sideMask = new Array(sampleDepth * sampleRows).fill(false);
      for (let y = 0; y < sampleRows; y++) {
        const ny = y / Math.max(1, sampleRows - 1);
        for (let x = 0; x < sampleCols; x++) {
          const nx = x / Math.max(1, sampleCols - 1);
          frontMask[y * sampleCols + x] = reliefForegroundCheck(sampleView("front", nx, ny), threshold, darkForeground);
          backMask[y * sampleCols + x] = reliefForegroundCheck(sampleView("back", nx, ny), threshold, darkForeground);
        }
        for (let z = 0; z < sampleDepth; z++) {
          const nz = z / Math.max(1, sampleDepth - 1);
          sideMask[y * sampleDepth + z] = reliefForegroundCheck(sampleView("side", nz, ny), threshold, darkForeground);
        }
      }
      const rowRuns = (mask, width, row) => {
        const runs = [];
        let start = -1;
        for (let x = 0; x <= width; x++) {
          const active = x < width && mask[row * width + x];
          if (active && start < 0) start = x;
          if ((!active || x === width) && start >= 0) {
            const end = x - 1;
            runs.push({ start, end, width: end - start + 1, center: (start + end) * .5 });
            start = -1;
          }
        }
        return runs;
      };
      const unionRunsAt = row => {
        const merged = new Array(sampleCols).fill(false);
        for (let x = 0; x < sampleCols; x++) merged[x] = frontMask[row * sampleCols + x] || backMask[row * sampleCols + x];
        return rowRuns(merged, sampleCols, 0);
      };
      const centralRun = (runs, center, maxDistance) => {
        let best = null;
        for (const run of runs) {
          const distance = Math.abs(run.center - center);
          if (distance > maxDistance) continue;
          const score = run.width - distance * .45;
          if (!best || score > best.score) best = { ...run, score };
        }
        return best;
      };
      const sideRunAt = row => {
        const runs = rowRuns(sideMask, sampleDepth, row);
        return centralRun(runs, (sampleDepth - 1) * .5, sampleDepth * .45) || runs.sort((a, b) => b.width - a.width)[0] || null;
      };
      const bodyRows = [];
      for (let row = 2; row < sampleRows - 2; row++) {
        const ny = row / Math.max(1, sampleRows - 1);
        const run = centralRun(unionRunsAt(row), (sampleCols - 1) * .5, sampleCols * .32);
        const depthRun = sideRunAt(row);
        if (!run || !depthRun || run.width < 3) continue;
        bodyRows.push({
          ny,
          y: (.5 - ny) * meshH,
          rawRx: Math.max(.035, (run.width / sampleCols) * meshW * .52),
          rawRz: Math.max(.035, (depthRun.width / sampleDepth) * meshD * .48 * depthScale)
        });
      }
      const waistWidths = bodyRows.filter(row => row.ny > .34 && row.ny < .62).map(row => row.rawRx).sort((a, b) => a - b);
      const torsoCap = Math.max(meshW * .09, waistWidths[Math.floor(waistWidths.length * .72)] || meshW * .18);
      const bodyRings = bodyRows.map((entry, i, list) => {
        const window = list.slice(Math.max(0, i - 2), Math.min(list.length, i + 3));
        let rx = window.reduce((sum, row) => sum + row.rawRx, 0) / window.length;
        let rz = window.reduce((sum, row) => sum + row.rawRz, 0) / window.length;
        if (entry.ny > .17 && entry.ny < .36) rx = Math.min(rx, torsoCap * (isMale ? 1.36 : 1.22));
        if (entry.ny > .54 && entry.ny < .76) rx *= isFemale ? 1.08 : 1;
        if (entry.ny > .25 && entry.ny < .46 && isFemale) rz *= 1.06;
        if (entry.ny > .56 && entry.ny < .76 && isFemale) rz *= 1.12;
        return { cx: 0, y: entry.y, cz: 0, rx, rz, ny: entry.ny };
      });
      let surfaceSections = 0;
      const ringPoint = (ring, angle, v = 0) => ({
        p: [ring.cx + Math.cos(angle) * ring.rx, ring.y, ring.cz + Math.sin(angle) * ring.rz],
        uv: [angle / (Math.PI * 2), v]
      });
      const addRingStack = (rings, segments = 32) => {
        if (rings.length < 2) return;
        surfaceSections++;
        for (let r = 0; r < rings.length - 1; r++) {
          const a = rings[r];
          const b = rings[r + 1];
          for (let s = 0; s < segments; s++) {
            const t0 = (s / segments) * Math.PI * 2;
            const t1 = ((s + 1) / segments) * Math.PI * 2;
            pushQuad(ringPoint(a, t0, r / rings.length), ringPoint(b, t0, (r + 1) / rings.length), ringPoint(b, t1, (r + 1) / rings.length), ringPoint(a, t1, r / rings.length));
          }
        }
      };
      const addTubeX = (x0, x1, y0, z0, yRadius0, zRadius0, yRadius1 = yRadius0, zRadius1 = zRadius0, rings = 18, segments = 18) => {
        const stack = [];
        for (let i = 0; i <= rings; i++) {
          const t = i / rings;
          const cap = Math.sin(Math.max(.08, Math.min(.92, t)) * Math.PI);
          stack.push({
            cx: x0 + (x1 - x0) * t,
            y: y0,
            cz: z0,
            rx: (yRadius0 + (yRadius1 - yRadius0) * t) * (.86 + cap * .14),
            rz: (zRadius0 + (zRadius1 - zRadius0) * t) * (.86 + cap * .14)
          });
        }
        surfaceSections++;
        for (let r = 0; r < stack.length - 1; r++) {
          const a = stack[r];
          const b = stack[r + 1];
          for (let s = 0; s < segments; s++) {
            const t0 = (s / segments) * Math.PI * 2;
            const t1 = ((s + 1) / segments) * Math.PI * 2;
            const va = (ring, angle, u) => ({ p: [ring.cx, ring.y + Math.cos(angle) * ring.rx, ring.cz + Math.sin(angle) * ring.rz], uv: [u, angle / (Math.PI * 2)] });
            pushQuad(va(a, t0, r / stack.length), va(b, t0, (r + 1) / stack.length), va(b, t1, (r + 1) / stack.length), va(a, t1, r / stack.length));
          }
        }
      };
      const addTubeY = (x0, y0, y1, z0, xRadius0, zRadius0, xRadius1 = xRadius0, zRadius1 = zRadius0, rings = 22, segments = 18) => {
        const stack = [];
        for (let i = 0; i <= rings; i++) {
          const t = i / rings;
          stack.push({ cx: x0, y: y0 + (y1 - y0) * t, cz: z0, rx: xRadius0 + (xRadius1 - xRadius0) * t, rz: zRadius0 + (zRadius1 - zRadius0) * t });
        }
        addRingStack(stack, segments);
      };
      addRingStack(bodyRings, 36);
      const bodyRadiusAt = ny => {
        let best = bodyRings[0] || { rx: meshW * .08, rz: meshD * .08, y: 0, ny: .5 };
        let bestDistance = Infinity;
        for (const ring of bodyRings) {
          const distance = Math.abs(ring.ny - ny);
          if (distance < bestDistance) {
            best = ring;
            bestDistance = distance;
          }
        }
        return best;
      };
      const armRows = [];
      for (let row = Math.floor(sampleRows * .18); row < Math.floor(sampleRows * .36); row++) {
        const ny = row / Math.max(1, sampleRows - 1);
        const runs = unionRunsAt(row);
        const torso = bodyRadiusAt(ny);
        const shoulderWidth = Math.max(torso.rx / meshW * sampleCols * 2.2, sampleCols * .13);
        const wideRun = runs.find(run => run.width > shoulderWidth * 1.45 && run.start < sampleCols * .18 && run.end > sampleCols * .82);
        if (wideRun) armRows.push({ row, ny, run: wideRun });
      }
      const armSeed = armRows[Math.floor(armRows.length * .55)] || null;
      if (armSeed) {
        const y = (.5 - armSeed.ny) * meshH;
        const shoulder = bodyRadiusAt(armSeed.ny).rx * 1.08;
        const leftEnd = (armSeed.run.start / Math.max(1, sampleCols - 1) - .5) * meshW;
        const rightEnd = (armSeed.run.end / Math.max(1, sampleCols - 1) - .5) * meshW;
        const armThickness = Math.max(meshH * .022, Math.min(meshH * .052, meshH * (armRows.length / sampleRows) * .55));
        addTubeX(-shoulder, leftEnd, y, 0, armThickness * 1.1, armThickness * .9 * depthScale, armThickness * .55, armThickness * .44 * depthScale, 24, 18);
        addTubeX(shoulder, rightEnd, y, 0, armThickness * 1.1, armThickness * .9 * depthScale, armThickness * .55, armThickness * .44 * depthScale, 24, 18);
        [-1, 1].forEach(side => {
          const handX = side < 0 ? leftEnd : rightEnd;
          for (let i = -2; i <= 2; i++) addTubeX(handX, handX + side * meshW * (.035 + Math.abs(i) * .005), y + i * armThickness * .42, 0, armThickness * .16, armThickness * .12, armThickness * .1, armThickness * .08, 4, 8);
        });
      }
      const legRows = [];
      for (let row = Math.floor(sampleRows * .58); row < Math.floor(sampleRows * .96); row++) {
        const ny = row / Math.max(1, sampleRows - 1);
        const runs = unionRunsAt(row).filter(run => run.width > 2);
        const left = runs.filter(run => run.center < sampleCols * .48).sort((a, b) => b.width - a.width)[0];
        const right = runs.filter(run => run.center > sampleCols * .52).sort((a, b) => b.width - a.width)[0];
        if (left && right) legRows.push({ ny, left, right });
      }
      if (legRows.length > 5) {
        const upper = legRows[Math.floor(legRows.length * .08)];
        const lower = legRows[Math.floor(legRows.length * .92)];
        const makeLeg = side => {
          const topRun = side < 0 ? upper.left : upper.right;
          const footRun = side < 0 ? lower.left : lower.right;
          const xTop = (topRun.center / Math.max(1, sampleCols - 1) - .5) * meshW;
          const xFoot = (footRun.center / Math.max(1, sampleCols - 1) - .5) * meshW;
          const yTop = (.5 - upper.ny) * meshH;
          const yFoot = (.5 - lower.ny) * meshH;
          const rTop = Math.max(meshW * .026, (topRun.width / sampleCols) * meshW * .33);
          const rFoot = Math.max(meshW * .018, (footRun.width / sampleCols) * meshW * .28);
          addTubeY(xTop * .82 + xFoot * .18, yTop, yFoot, 0, rTop, rTop * .78 * depthScale, rFoot, rFoot * .78 * depthScale, 28, 18);
          addTubeX(xFoot - side * meshW * .015, xFoot + side * meshW * .09, yFoot - meshH * .005, meshD * .16, rFoot * .42, rFoot * 1.15, rFoot * .34, rFoot * 1.5, 5, 12);
        };
        makeLeg(-1);
        makeLeg(1);
      }
      return {
        positions,
        uvs,
        meta: { mode: "sheetSilhouetteMeshV23", buildMode: "meshRebuild", bodyPreset, resolvedPreset, sourceName, sourceW: imageData.width, sourceH: imageData.height, threshold, darkForeground, depth, back, viewRects, sideRatio, depthScale, sampleCols, sampleRows, sampleDepth, frontHalfMode, backHalfMode, surfaceSections, silhouetteDriven: true, surfaceMeshExporter: true }
      };
    }

    function createSheetSurfaceMeshRemakeGeometry({ scale, depth, back, threshold, darkForeground, imageData, viewRects, bodyPreset = "auto", sourceName = "" }) {
      const positions = [];
      const uvs = [];
      const meshH = scale;
      const meshW = scale * .86;
      const meshD = Math.max(back, depth, .25) * 2.25;
      const sx = meshW / 5.25;
      const sy = meshH / 6.2;
      const sz = meshD / 1.95;
      const p = (x, y, z) => [x * sx, y * sy, z * sz];
      const pushTri = (a, b, c) => {
        positions.push(...a.p, ...b.p, ...c.p);
        uvs.push(...a.uv, ...b.uv, ...c.uv);
      };
      const pushQuad = (a, b, c, d) => {
        pushTri(a, b, c);
        pushTri(a, c, d);
      };
      const nameHint = String(sourceName || "").toLowerCase();
      const resolvedPreset = bodyPreset === "auto"
        ? (/female|woman|girl|boob|breast|bust|curvy/.test(nameHint) ? "female" : (/male|man|boy|muscle|pec|bodybuilder/.test(nameHint) ? "male" : "female"))
        : bodyPreset;
      const isFemale = resolvedPreset === "female";
      const isMale = resolvedPreset === "male";
      const viewRatio = rect => rect && rect.h ? rect.w / rect.h : .26;
      const sideRatio = Math.max(.12, Math.min(.34, viewRatio(viewRects?.[1])));
      const depthScale = Math.max(.82, Math.min(1.18, sideRatio / .22));
      let surfaceSections = 0;
      const ringPoint = (cx, cy, cz, rx, rz, angle, v = 0) => ({
        p: p(cx + Math.cos(angle) * rx, cy, cz + Math.sin(angle) * rz),
        uv: [angle / (Math.PI * 2), v]
      });
      const addRingStack = (rings, segments = 28) => {
        surfaceSections++;
        for (let r = 0; r < rings.length - 1; r++) {
          const a = rings[r];
          const b = rings[r + 1];
          for (let s = 0; s < segments; s++) {
            const t0 = (s / segments) * Math.PI * 2;
            const t1 = ((s + 1) / segments) * Math.PI * 2;
            pushQuad(
              ringPoint(a.cx, a.y, a.cz, a.rx, a.rz, t0, r / rings.length),
              ringPoint(b.cx, b.y, b.cz, b.rx, b.rz, t0, (r + 1) / rings.length),
              ringPoint(b.cx, b.y, b.cz, b.rx, b.rz, t1, (r + 1) / rings.length),
              ringPoint(a.cx, a.y, a.cz, a.rx, a.rz, t1, r / rings.length)
            );
          }
        }
      };
      const addTubeX = (x0, x1, y0, z0, yRadius0, zRadius0, yRadius1 = yRadius0, zRadius1 = zRadius0, rings = 14, segments = 18) => {
        const stack = [];
        for (let i = 0; i <= rings; i++) {
          const t = i / rings;
          const cap = Math.sin(Math.max(.08, Math.min(.92, t)) * Math.PI);
          stack.push({
            cx: x0 + (x1 - x0) * t,
            y: y0,
            cz: z0,
            rx: (yRadius0 + (yRadius1 - yRadius0) * t) * (.86 + cap * .14),
            rz: (zRadius0 + (zRadius1 - zRadius0) * t) * (.86 + cap * .14)
          });
        }
        surfaceSections++;
        for (let r = 0; r < stack.length - 1; r++) {
          const a = stack[r];
          const b = stack[r + 1];
          for (let s = 0; s < segments; s++) {
            const t0 = (s / segments) * Math.PI * 2;
            const t1 = ((s + 1) / segments) * Math.PI * 2;
            const va = (ring, angle, u) => ({ p: p(ring.cx, ring.y + Math.cos(angle) * ring.rx, ring.cz + Math.sin(angle) * ring.rz), uv: [u, angle / (Math.PI * 2)] });
            pushQuad(va(a, t0, r / stack.length), va(b, t0, (r + 1) / stack.length), va(b, t1, (r + 1) / stack.length), va(a, t1, r / stack.length));
          }
        }
      };
      const addTubeY = (x0, y0, y1, z0, xRadius0, zRadius0, xRadius1 = xRadius0, zRadius1 = zRadius0, rings = 16, segments = 18) => {
        const stack = [];
        for (let i = 0; i <= rings; i++) {
          const t = i / rings;
          stack.push({ cx: x0, y: y0 + (y1 - y0) * t, cz: z0, rx: xRadius0 + (xRadius1 - xRadius0) * t, rz: zRadius0 + (zRadius1 - zRadius0) * t });
        }
        addRingStack(stack, segments);
      };
      const body = [
        { y: 2.78, cx: 0, cz: 0, rx: .08, rz: .07 * depthScale },
        { y: 2.52, cx: 0, cz: 0, rx: .29, rz: .25 * depthScale },
        { y: 2.2, cx: 0, cz: 0, rx: .27, rz: .24 * depthScale },
        { y: 1.86, cx: 0, cz: 0, rx: .13, rz: .12 * depthScale },
        { y: 1.42, cx: 0, cz: .02, rx: isMale ? .7 : .62, rz: (isMale ? .35 : .32) * depthScale },
        { y: .94, cx: 0, cz: .04, rx: isMale ? .66 : .57, rz: (isMale ? .37 : .34) * depthScale },
        { y: .42, cx: 0, cz: 0, rx: isMale ? .43 : .36, rz: .25 * depthScale },
        { y: -.05, cx: 0, cz: -.02, rx: isMale ? .48 : .43, rz: .29 * depthScale },
        { y: -.55, cx: 0, cz: -.04, rx: isFemale ? .66 : .56, rz: (isFemale ? .43 : .37) * depthScale },
        { y: -.95, cx: 0, cz: -.02, rx: isFemale ? .55 : .47, rz: (isFemale ? .35 : .31) * depthScale }
      ];
      addRingStack(body, 32);
      addTubeX(-.5, -1.22, 1.28, 0, isMale ? .16 : .13, (isMale ? .14 : .12) * depthScale, isMale ? .14 : .115, (isMale ? .12 : .1) * depthScale, 12, 18);
      addTubeX(-1.22, -2.18, 1.18, 0, isMale ? .13 : .105, (isMale ? .115 : .095) * depthScale, .075, .06 * depthScale, 16, 16);
      addTubeX(.5, 1.22, 1.28, 0, isMale ? .16 : .13, (isMale ? .14 : .12) * depthScale, isMale ? .14 : .115, (isMale ? .12 : .1) * depthScale, 12, 18);
      addTubeX(1.22, 2.18, 1.18, 0, isMale ? .13 : .105, (isMale ? .115 : .095) * depthScale, .075, .06 * depthScale, 16, 16);
      [-1, 1].forEach(side => {
        const palmX = side * 2.32;
        addTubeX(side * 2.14, side * 2.48, 1.13, .02, .07, .05 * depthScale, .055, .04 * depthScale, 6, 12);
        [-2, -1, 0, 1, 2].forEach(i => addTubeX(palmX, side * (2.52 + Math.abs(i) * .025), 1.13 + i * .043, .04 + i * .016, .015, .011 * depthScale, .011, .009 * depthScale, 4, 8));
      });
      addTubeY(-.24, -.82, -2.16, .02, isFemale ? .2 : .17, (isFemale ? .17 : .15) * depthScale, .13, .11 * depthScale, 18, 18);
      addTubeY(.24, -.82, -2.16, .02, isFemale ? .2 : .17, (isFemale ? .17 : .15) * depthScale, .13, .11 * depthScale, 18, 18);
      addTubeY(-.18, -2.08, -3.02, .03, .13, .11 * depthScale, .09, .09 * depthScale, 14, 16);
      addTubeY(.18, -2.08, -3.02, .03, .13, .11 * depthScale, .09, .09 * depthScale, 14, 16);
      addTubeX(-.17, -.42, -3.04, .32, .06, .12 * depthScale, .045, .2 * depthScale, 6, 12);
      addTubeX(.17, .42, -3.04, .32, .06, .12 * depthScale, .045, .2 * depthScale, 6, 12);
      if (isFemale) {
        addTubeX(-.43, -.05, 1.04, .31, .19, .14 * depthScale, .18, .13 * depthScale, 8, 16);
        addTubeX(.43, .05, 1.04, .31, .19, .14 * depthScale, .18, .13 * depthScale, 8, 16);
        addTubeX(-.5, -.08, -.72, -.32, .21, .17 * depthScale, .2, .16 * depthScale, 8, 16);
        addTubeX(.5, .08, -.72, -.32, .21, .17 * depthScale, .2, .16 * depthScale, 8, 16);
      }
      return {
        positions,
        uvs,
        meta: { mode: "sheetSurfaceMeshRemakeV22", buildMode: "meshRebuild", bodyPreset, resolvedPreset, sourceName, sourceW: imageData.width, sourceH: imageData.height, threshold, darkForeground, depth, back, viewRects, sideRatio, depthScale, surfaceSections, surfaceMeshExporter: true }
      };
    }

    function createSolidViewSheetGeometryV43({ imageData, cols, rows, scale, depth, back, threshold, smoothPasses, darkForeground, sourceName = "" }) {
      const viewRects = detectReliefViewRects(imageData, threshold, darkForeground);
      const [frontRect, sideRect, backRect] = viewRects;
      // The solid builder used to silently clamp the UI's higher resolutions to
      // 84 x 144. That is enough for limbs, but not for a face or hand silhouette.
      const gridX = Math.max(18, Math.min(128, Math.round(cols)));
      const gridY = Math.max(24, Math.min(208, Math.round(rows)));
      const gridZ = Math.max(12, Math.min(64, Math.round(gridX * .48)));
      const meshH = scale;
      const meshW = scale * .78;
      const meshD = Math.max(back, depth, .25) * 2.15;
      const sampleRect = (rect, nx, ny) => {
        const sx = rect.x + Math.max(0, Math.min(1, nx)) * Math.max(1, rect.w - 1);
        const sy = rect.y + Math.max(0, Math.min(1, ny)) * Math.max(1, rect.h - 1);
        return sampleReliefPixel(imageData, imageData.width, imageData.height, sx, sy);
      };
      const edgeMargin = Math.max(3, imageData.width * .018);
      const halfMode = rect => {
        const left = rect.x <= edgeMargin;
        const right = rect.x + rect.w >= imageData.width - edgeMargin;
        if ((!left && !right) || rect.w > imageData.width * .42) return "full";
        return left ? "centerToOuter" : "outerToCenter";
      };
      const remapHalf = (nx, mode) => {
        if (mode === "centerToOuter") return Math.abs(nx - .5) * 2;
        if (mode === "outerToCenter") return Math.min(nx, 1 - nx) * 2;
        return nx;
      };
      const frontMode = halfMode(frontRect);
      const backMode = halfMode(backRect);
      const foreground = pixel => reliefForegroundCheck(pixel, threshold, darkForeground);
      const foregroundAt = (rect, nx, ny) => {
        const dx = .38 / Math.max(1, gridX - 1);
        const dy = .38 / Math.max(1, gridY - 1);
        const samples = [
          sampleRect(rect, nx, ny),
          sampleRect(rect, nx - dx, ny),
          sampleRect(rect, nx + dx, ny),
          sampleRect(rect, nx, ny - dy),
          sampleRect(rect, nx, ny + dy)
        ];
        return samples.some(foreground);
      };
      const silhouette = new Uint8Array(gridX * gridY);
      const side = new Uint8Array(gridZ * gridY);
      for (let y = 0; y < gridY; y++) {
        const ny = y / Math.max(1, gridY - 1);
        for (let x = 0; x < gridX; x++) {
          const nx = x / Math.max(1, gridX - 1);
          const front = foregroundAt(frontRect, remapHalf(nx, frontMode), ny);
          const rear = foregroundAt(backRect, remapHalf(1 - nx, backMode), ny);
          silhouette[y * gridX + x] = front || rear ? 1 : 0;
        }
        for (let z = 0; z < gridZ; z++) {
          const nz = z / Math.max(1, gridZ - 1);
          side[y * gridZ + z] = foregroundAt(sideRect, nz, ny) ? 1 : 0;
        }
      }
      const occupied = new Uint8Array(gridX * gridY * gridZ);
      const index = (x, y, z) => (y * gridZ + z) * gridX + x;
      const inside = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < gridX && y < gridY && z < gridZ && occupied[index(x, y, z)] === 1;
      const runsAt = (mask, width, y) => {
        const runs = [];
        let start = -1;
        for (let i = 0; i <= width; i++) {
          const on = i < width && mask[y * width + i];
          if (on && start < 0) start = i;
          if (!on && start >= 0) {
            if (i - start >= 1) runs.push([start, i - 1]);
            start = -1;
          }
        }
        return runs;
      };
      const verticalRadiusAt = (x, y) => {
        let up = 0;
        let down = 0;
        for (let yy = y; yy >= 0 && silhouette[yy * gridX + x]; yy--) up++;
        for (let yy = y; yy < gridY && silhouette[yy * gridX + x]; yy++) down++;
        return Math.max(1, Math.min(up, down));
      };
      const cellX = meshW / gridX;
      const cellY = meshH / gridY;
      const cellZ = meshD / gridZ;
      let voxelCount = 0;
      for (let y = 0; y < gridY; y++) {
        const xRuns = runsAt(silhouette, gridX, y);
        const zRuns = runsAt(side, gridZ, y);
        if (!xRuns.length || !zRuns.length) continue;
        const z0 = zRuns[0][0];
        const z1 = zRuns[zRuns.length - 1][1];
        const zCenter = (z0 + z1) * .5;
        const zRadius = Math.max(1, (z1 - z0 + 1) * .5);
        for (const [x0, x1] of xRuns) {
          for (let x = x0; x <= x1; x++) {
            const horizontalRadius = Math.min(x - x0 + 1, x1 - x + 1) * cellX / cellZ;
            const verticalRadius = verticalRadiusAt(x, y) * cellY / cellZ;
            // Orthographic side views show the torso and an end-on T-pose arm at
            // the same height. Applying that full depth to every X position turns
            // the shoulders, arms, and hands into one broad oval. Limit depth by
            // the local front/back silhouette thickness so narrow anatomy remains
            // narrow while the central torso can still use the full side profile.
            const localRadius = Math.max(.7, Math.min(zRadius, horizontalRadius * 1.08, verticalRadius * .92));
            for (let z = z0; z <= z1; z++) {
              if (!side[y * gridZ + z]) continue;
              if (Math.abs(z - zCenter) > localRadius) continue;
              occupied[index(x, y, z)] = 1;
              voxelCount++;
            }
          }
        }
      }
      // Keep a compact indexed working surface while generating and smoothing.
      // The old implementation first duplicated every triangle vertex, then
      // rebuilt vertex identity with string keys and a Set per vertex. At the
      // detailed body preset that could consume several gigabytes in a browser.
      const vertexIds = new Int32Array((gridX + 1) * (gridY + 1) * (gridZ + 1));
      vertexIds.fill(-1);
      const uniquePositions = [];
      const uniqueUvs = [];
      const detailSides = [];
      const triangles = [];
      const point = (x, y, z) => [
        (x / gridX - .5) * meshW,
        (.5 - y / gridY) * meshH,
        (z / gridZ - .5) * meshD
      ];
      const vertexKey = (x, y, z) => (y * (gridZ + 1) + z) * (gridX + 1) + x;
      const vertex = (x, y, z, u, v, detailSide = 0) => {
        const key = vertexKey(x, y, z);
        let id = vertexIds[key];
        if (id < 0) {
          id = uniquePositions.length / 3;
          vertexIds[key] = id;
          uniquePositions.push(...point(x, y, z));
          uniqueUvs.push(u, v);
          detailSides.push(detailSide);
        } else if (detailSide) {
          const previous = detailSides[id] || 0;
          detailSides[id] = previous && previous !== detailSide ? 0 : detailSide;
        }
        return id;
      };
      const tri = (a, b, c) => {
        triangles.push(a, b, c);
      };
      const quad = (a, b, c, d) => {
        tri(a, b, c);
        tri(a, c, d);
      };
      for (let y = 0; y < gridY; y++) {
        for (let z = 0; z < gridZ; z++) {
          for (let x = 0; x < gridX; x++) {
            if (!inside(x, y, z)) continue;
            const u0 = x / gridX, u1 = (x + 1) / gridX;
            const v0 = 1 - y / gridY, v1 = 1 - (y + 1) / gridY;
            if (!inside(x - 1, y, z)) quad(vertex(x,y,z,u0,v0), vertex(x,y+1,z,u0,v1), vertex(x,y+1,z+1,u1,v1), vertex(x,y,z+1,u1,v0));
            if (!inside(x + 1, y, z)) quad(vertex(x+1,y,z+1,u0,v0), vertex(x+1,y+1,z+1,u0,v1), vertex(x+1,y+1,z,u1,v1), vertex(x+1,y,z,u1,v0));
            if (!inside(x, y - 1, z)) quad(vertex(x,y,z+1,u0,v0), vertex(x+1,y,z+1,u1,v0), vertex(x+1,y,z,u1,v1), vertex(x,y,z,u0,v1));
            if (!inside(x, y + 1, z)) quad(vertex(x,y+1,z,u0,v0), vertex(x+1,y+1,z,u1,v0), vertex(x+1,y+1,z+1,u1,v1), vertex(x,y+1,z+1,u0,v1));
            if (!inside(x, y, z - 1)) quad(vertex(x+1,y,z,u0,v0,-1), vertex(x+1,y+1,z,u1,v0,-1), vertex(x,y+1,z,u1,v1,-1), vertex(x,y,z,u0,v1,-1));
            if (!inside(x, y, z + 1)) quad(vertex(x,y,z+1,u0,v0,1), vertex(x,y+1,z+1,u1,v0,1), vertex(x+1,y+1,z+1,u1,v1,1), vertex(x+1,y,z+1,u0,v1,1));
          }
        }
      }
      const smoothClosedSurface = (passes, amount = .22) => {
        const vertexCount = uniquePositions.length / 3;
        for (let pass = 0; pass < passes; pass++) {
          const sums = new Float64Array(vertexCount * 3);
          const counts = new Uint32Array(vertexCount);
          for (let i = 0; i < triangles.length; i += 3) {
            const a = triangles[i], b = triangles[i + 1], c = triangles[i + 2];
            const ids = [a, b, c];
            for (let corner = 0; corner < 3; corner++) {
              const id = ids[corner];
              const n1 = ids[(corner + 1) % 3];
              const n2 = ids[(corner + 2) % 3];
              sums[id * 3] += uniquePositions[n1 * 3] + uniquePositions[n2 * 3];
              sums[id * 3 + 1] += uniquePositions[n1 * 3 + 1] + uniquePositions[n2 * 3 + 1];
              sums[id * 3 + 2] += uniquePositions[n1 * 3 + 2] + uniquePositions[n2 * 3 + 2];
              counts[id] += 2;
            }
          }
          const next = new Float64Array(uniquePositions.length);
          for (let id = 0; id < vertexCount; id++) {
            const count = counts[id];
            for (let axis = 0; axis < 3; axis++) {
              const offset = id * 3 + axis;
              const current = uniquePositions[offset];
              next[offset] = count ? current + (sums[offset] / count - current) * amount : current;
            }
          }
          for (let i = 0; i < uniquePositions.length; i++) uniquePositions[i] = next[i];
        }
      };
      smoothClosedSurface(Math.max(0, Math.min(4, Math.round(Number.isFinite(Number(smoothPasses)) ? Number(smoothPasses) : 1))));
      const sampleSurfaceDetail = (rect, nx, ny) => {
        const centerPixel = sampleRect(rect, nx, ny);
        const px = 1.6 / Math.max(1, rect.w - 1);
        const py = 1.6 / Math.max(1, rect.h - 1);
        const aroundPixels = [
          sampleRect(rect, nx - px, ny), sampleRect(rect, nx + px, ny),
          sampleRect(rect, nx, ny - py), sampleRect(rect, nx, ny + py),
          sampleRect(rect, nx - px, ny - py), sampleRect(rect, nx + px, ny - py),
          sampleRect(rect, nx - px, ny + py), sampleRect(rect, nx + px, ny + py)
        ];
        // Never turn an outline transition into relief. Those transitions caused
        // the striped wedges across shoulders, hips, feet, and open fingers.
        if (!foreground(centerPixel) || aroundPixels.some(pixel => !foreground(pixel))) return 0;
        const around = aroundPixels.map(pixel => pixel.luma);
        const average = around.reduce((sum, value) => sum + value, 0) / around.length;
        return Math.max(-.35, Math.min(.35, (centerPixel.luma - average) / 96));
      };
      // A visual hull only sees outlines. Add a deliberately shallow relief from
      // the source shading so facial creases and closed-finger seams survive as
      // surface detail without changing the overall anatomy or duplicating views.
      const detailAmount = cellZ * .18;
      for (let id = 0; id < uniquePositions.length / 3; id++) {
        const outward = detailSides[id] || 0;
        if (!outward) continue;
        const offset = id * 3;
        const nx = Math.max(0, Math.min(1, uniquePositions[offset] / meshW + .5));
        const ny = Math.max(0, Math.min(1, .5 - uniquePositions[offset + 1] / meshH));
        const rect = outward > 0 ? frontRect : backRect;
        const mode = outward > 0 ? frontMode : backMode;
        const sourceX = outward > 0
          ? remapHalf(nx, mode)
          : remapHalf(1 - nx, mode);
        uniquePositions[offset + 2] += outward * sampleSurfaceDetail(rect, sourceX, ny) * detailAmount;
      }
      const positions = [];
      const uvs = [];
      for (const id of triangles) {
        positions.push(uniquePositions[id * 3], uniquePositions[id * 3 + 1], uniquePositions[id * 3 + 2]);
        uvs.push(uniqueUvs[id * 2], uniqueUvs[id * 2 + 1]);
      }
      if (positions.length < 9) throw new Error("No solid foreground was found. Try Threshold or Dark foreground.");
      return {
        positions,
        uvs,
        meta: { mode: "solidVisualHullV43", buildMode: "solidVisualHull", sourceName, cols: gridX, rows: gridY, depthSlices: gridZ, sourceW: imageData.width, sourceH: imageData.height, threshold, darkForeground, smoothPasses, depth, back, voxelCount, uniqueVertices: uniquePositions.length / 3, viewRects, frontMode, backMode, localDepthFromSilhouette: true, edgeSafeSurfaceDetail: true, compactSmoothing: true, closedSurface: true }
      };
    }

    function createReliefGeometryFromViewSheet({ imageData, cols, rows, scale, depth, back, threshold, smoothPasses, darkForeground, buildMode = "heightmap", bodyPreset = "auto", sourceName = "" }) {
      const viewRects = detectReliefViewRects(imageData, threshold, darkForeground);
      if (buildMode === "solidVisualHull") {
        return createSolidViewSheetGeometryV43({ imageData, cols, rows, scale, depth, back, threshold, smoothPasses, darkForeground, sourceName });
      }
      const isMeshRemake = buildMode === "meshRebuild";
      if (buildMode === "anatomy") {
        return createMannequinSheetRebuildGeometry({ imageData, viewRects, scale, depth, back, threshold, darkForeground, bodyPreset, sourceName });
      }
      if (buildMode === "smooth") {
        return createSmoothMannequinSheetGeometry({ imageData, viewRects, scale, depth, back, threshold, smoothPasses, darkForeground, bodyPreset, sourceName });
      }
      const [frontRect, sideRect, backRect] = viewRects;
      const gridX = Math.max(12, Math.min(72, Math.round(cols)));
      const gridY = Math.max(16, Math.min(128, Math.round(rows)));
      const gridZ = Math.max(10, Math.min(44, Math.round(gridX * .55)));
      const sourceLikeMeshScale = isMeshRemake ? .92 : 1;
      const meshH = scale * sourceLikeMeshScale;
      const meshW = scale * .82 * sourceLikeMeshScale;
      const meshD = Math.max(back, depth, .25) * 2.15 * sourceLikeMeshScale;
      const frontMask = new Array(gridX * gridY).fill(false);
      const backMask = new Array(gridX * gridY).fill(false);
      const sideMask = new Array(gridZ * gridY).fill(false);
      const sampleRect = (rect, nx, ny) => {
        const sx = rect.x + Math.max(0, Math.min(1, nx)) * Math.max(1, rect.w - 1);
        const sy = rect.y + Math.max(0, Math.min(1, ny)) * Math.max(1, rect.h - 1);
        return sampleReliefPixel(imageData, imageData.width, imageData.height, sx, sy);
      };
      const edgeMargin = Math.max(3, imageData.width * .018);
      const viewHalfMode = rect => {
        const touchesLeft = rect.x <= edgeMargin;
        const touchesRight = rect.x + rect.w >= imageData.width - edgeMargin;
        if (!touchesLeft && !touchesRight) return "full";
        if (rect.w > imageData.width * .42) return "full";
        return touchesLeft ? "centerToOuter" : "outerToCenter";
      };
      const frontHalfMode = viewHalfMode(frontRect);
      const backHalfMode = viewHalfMode(backRect);
      const halfViewNx = (fullNx, mode) => {
        const nx = Math.max(0, Math.min(1, fullNx));
        if (mode === "centerToOuter") return Math.abs(nx - .5) * 2;
        if (mode === "outerToCenter") return Math.min(nx, 1 - nx) * 2;
        return nx;
      };
      const sampleView = (view, nx, ny) => {
        if (view === "front") return sampleRect(frontRect, halfViewNx(nx, frontHalfMode), ny);
        if (view === "back") return sampleRect(backRect, halfViewNx(nx, backHalfMode), ny);
        return sampleRect(sideRect, nx, ny);
      };
      for (let y = 0; y < gridY; y++) {
        const ny = y / Math.max(1, gridY - 1);
        for (let x = 0; x < gridX; x++) {
          const nx = x / Math.max(1, gridX - 1);
          frontMask[y * gridX + x] = reliefForegroundCheck(sampleView("front", nx, ny), threshold, darkForeground);
          backMask[y * gridX + x] = reliefForegroundCheck(sampleView("back", nx, ny), threshold, darkForeground);
        }
        for (let z = 0; z < gridZ; z++) {
          const nz = z / Math.max(1, gridZ - 1);
          sideMask[y * gridZ + z] = reliefForegroundCheck(sampleRect(sideRect, nz, ny), threshold, darkForeground);
        }
      }
      if (smoothPasses > 0) {
        const softenMask = (mask, w, h, passes) => {
          let current = mask.slice();
          for (let pass = 0; pass < passes; pass++) {
            const next = current.slice();
            for (let y = 1; y < h - 1; y++) {
              for (let x = 1; x < w - 1; x++) {
                let hits = 0;
                for (let oy = -1; oy <= 1; oy++) {
                  for (let ox = -1; ox <= 1; ox++) {
                    if (current[(y + oy) * w + x + ox]) hits++;
                  }
                }
                next[y * w + x] = hits >= 4;
              }
            }
            current = next;
          }
          return current;
        };
        const passes = Math.min(2, smoothPasses);
        for (const [target, softened] of [
          [frontMask, softenMask(frontMask, gridX, gridY, passes)],
          [backMask, softenMask(backMask, gridX, gridY, passes)],
          [sideMask, softenMask(sideMask, gridZ, gridY, passes)]
        ]) {
          for (let i = 0; i < target.length; i++) target[i] = softened[i];
        }
      }
      const occupied = new Uint8Array(gridX * gridY * gridZ);
      const voxelIndex = (x, y, z) => (y * gridZ + z) * gridX + x;
      const isVoxel = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < gridX && y < gridY && z < gridZ && occupied[voxelIndex(x, y, z)] === 1;
      const rowRuns = (mask, width, y) => {
        const runs = [];
        let start = -1;
        for (let x = 0; x <= width; x++) {
          const active = x < width && mask[y * width + x];
          if (active && start < 0) start = x;
          if ((!active || x === width) && start >= 0) {
            runs.push({ start, end: x - 1, center: (start + x) * .5, radius: Math.max(.5, (x - start) * .5) });
            start = -1;
          }
        }
        return runs;
      };
      const findRun = (runs, x) => runs.find(run => x >= run.start && x <= run.end) || null;
      const mergeRuns = runs => {
        if (!runs.length) return runs;
        const sorted = runs.slice().sort((a, b) => a.start - b.start);
        const merged = [];
        for (const run of sorted) {
          const last = merged[merged.length - 1];
          if (!last || run.start > last.end + 1) {
            merged.push({ ...run });
          } else {
            last.end = Math.max(last.end, run.end);
            last.center = (last.start + last.end + 1) * .5;
            last.radius = Math.max(.5, (last.end - last.start + 1) * .5);
          }
        }
        return merged;
      };
      const mirrorRun = run => {
        const start = gridX - 1 - run.end;
        const end = gridX - 1 - run.start;
        return { start, end, center: (start + end + 1) * .5, radius: Math.max(.5, (end - start + 1) * .5), role: run.role };
      };
      const makeRun = (start, end, role = "body") => ({
        start,
        end,
        center: (start + end + 1) * .5,
        radius: Math.max(.5, (end - start + 1) * .5),
        role
      });
      const splitTPoseArmRuns = (runs, y) => {
        const ny = y / Math.max(1, gridY - 1);
        if (ny < .18 || ny > .39) return runs;
        const split = [];
        const leftGap = Math.round(gridX * (ny < .28 ? .34 : .365));
        const rightGap = Math.round(gridX * (ny < .28 ? .66 : .635));
        const centerMin = Math.round(gridX * .38);
        const centerMax = Math.round(gridX * .62);
        for (const run of runs) {
          const width = run.end - run.start + 1;
          if (width < gridX * .42 || run.start > centerMin || run.end < centerMax) {
            split.push(run);
            continue;
          }
          const leftEnd = Math.min(run.end, leftGap - 1);
          const bodyStart = Math.max(run.start, leftGap + 1);
          const bodyEnd = Math.min(run.end, rightGap - 1);
          const rightStart = Math.max(run.start, rightGap + 1);
          if (leftEnd - run.start >= 2) split.push(makeRun(run.start, leftEnd, "leftArm"));
          if (bodyEnd - bodyStart >= 2) split.push(makeRun(bodyStart, bodyEnd, "body"));
          if (run.end - rightStart >= 2) split.push(makeRun(rightStart, run.end, "rightArm"));
        }
        return split.length ? split : runs;
      };
      const mirrorDominantHalfBodyRuns = (runs, y) => {
        if (!(frontHalfMode !== "full" || backHalfMode !== "full") || !runs.length) return runs;
        const ny = y / Math.max(1, gridY - 1);
        if (ny < .06 || ny > .95) return runs;
        const center = gridX * .5;
        const bodyLike = runs.filter(run => {
          const width = run.end - run.start + 1;
          const touchesEdge = run.start <= 1 || run.end >= gridX - 2;
          return width >= 2 && !touchesEdge;
        });
        const candidates = bodyLike.length ? bodyLike : runs;
        const best = candidates.slice().sort((a, b) => {
          const aw = a.end - a.start + 1;
          const bw = b.end - b.start + 1;
          const ac = 1 / (1 + Math.abs(a.center - center));
          const bc = 1 / (1 + Math.abs(b.center - center));
          return (bw + bc * 6) - (aw + ac * 6);
        })[0];
        if (!best) return runs;
        if (best.start < center && best.end > center && best.end - best.start > gridX * .22) return runs;
        return mergeRuns([best, mirrorRun(best)]);
      };
      const sideSilhouetteBodyRuns = (y, sideRun) => {
        const ny = y / Math.max(1, gridY - 1);
        if (!sideRun) return [];
        const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
        const smooth = (edge0, edge1, value) => {
          const t = clamp((value - edge0) / Math.max(.0001, edge1 - edge0), 0, 1);
          return t * t * (3 - 2 * t);
        };
        const bell = (value, center, width) => Math.exp(-Math.pow((value - center) / Math.max(.001, width), 2));
        const runFromNorm = (center, width, role = "body") => {
          const half = Math.max(.012, width * .5);
          const start = clamp(Math.round((center - half) * gridX), 1, gridX - 2);
          const end = clamp(Math.round((center + half) * gridX), 1, gridX - 2);
          return end > start ? makeRun(start, end, role) : null;
        };
        if (ny < .145) {
          const headWidth = .12 + bell(ny, .08, .052) * .085;
          return [runFromNorm(.5, headWidth, "head")].filter(Boolean);
        }
        if (ny < .215) {
          const neckToShoulder = smooth(.145, .215, ny);
          return [runFromNorm(.5, .085 + neckToShoulder * .185, "neck")].filter(Boolean);
        }
        if (ny < .535) {
          const shoulder = bell(ny, .24, .052) * .165;
          const chest = bell(ny, .315, .11) * .12;
          const waistCut = bell(ny, .43, .08) * .052;
          const hip = bell(ny, .515, .072) * .13;
          const width = .30 + shoulder + chest - waistCut + hip;
          return [runFromNorm(.5, width, "torso")].filter(Boolean);
        }
        if (ny < .945) {
          const thigh = bell(ny, .62, .105) * .115;
          const kneeCut = bell(ny, .72, .04) * .025;
          const calf = bell(ny, .82, .075) * .06;
          const ankleCut = bell(ny, .925, .045) * .05;
          const legWidth = .112 + thigh + calf - kneeCut - ankleCut;
          const legSpread = .064 + smooth(.535, .67, ny) * .046;
          return [
            runFromNorm(.5 - legSpread, legWidth, "leftLeg"),
            runFromNorm(.5 + legSpread, legWidth, "rightLeg")
          ].filter(Boolean);
        }
        const footWidth = .12 + bell(ny, .965, .023) * .085;
        return [
          runFromNorm(.445, footWidth, "leftFoot"),
          runFromNorm(.555, footWidth, "rightFoot")
        ].filter(Boolean);
      };
      const centeredMannequinBodyRuns = y => {
        const ny = y / Math.max(1, gridY - 1);
        const sideRuns = rowRuns(sideMask, gridZ, y);
        if (!sideRuns.length) return [];
        const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
        const smooth = (edge0, edge1, value) => {
          const t = clamp((value - edge0) / Math.max(.0001, edge1 - edge0), 0, 1);
          return t * t * (3 - 2 * t);
        };
        const bell = (value, center, width) => Math.exp(-Math.pow((value - center) / Math.max(.001, width), 2));
        const runFromNorm = (center, width, role = "body") => {
          const half = Math.max(.012, width * .5);
          const start = clamp(Math.round((center - half) * gridX), 1, gridX - 2);
          const end = clamp(Math.round((center + half) * gridX), 1, gridX - 2);
          return end > start ? makeRun(start, end, role) : null;
        };
        if (ny < .205) {
          const headWidth = .165 + bell(ny, .11, .055) * .065;
          return [runFromNorm(.5, headWidth, "head")].filter(Boolean);
        }
        if (ny < .285) {
          const neckToShoulder = smooth(.205, .285, ny);
          return [runFromNorm(.5, .105 + neckToShoulder * .185, "torso")].filter(Boolean);
        }
        if (ny < .64) {
          const shoulder = bell(ny, .305, .07) * .105;
          const chest = bell(ny, .38, .16) * .065;
          const waistCut = bell(ny, .52, .09) * .058;
          const hip = bell(ny, .61, .07) * .092;
          return [runFromNorm(.5, .245 + shoulder + chest - waistCut + hip, "torso")].filter(Boolean);
        }
        if (ny < .91) {
          const upperLeg = bell(ny, .70, .09) * .052;
          const calf = bell(ny, .81, .07) * .036;
          const ankleCut = bell(ny, .90, .045) * .035;
          const legWidth = .095 + upperLeg + calf - ankleCut;
          const legSpread = .062 + smooth(.64, .74, ny) * .038;
          return [
            runFromNorm(.5 - legSpread, legWidth, "leftLeg"),
            runFromNorm(.5 + legSpread, legWidth, "rightLeg")
          ].filter(Boolean);
        }
        const footWidth = .115 + bell(ny, .935, .025) * .06;
        return [
          runFromNorm(.445, footWidth, "leftFoot"),
          runFromNorm(.555, footWidth, "rightFoot")
        ].filter(Boolean);
      };
      const sourceLikeFemaleBodyRuns = y => {
        const ny = y / Math.max(1, gridY - 1);
        const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
        const smooth = (edge0, edge1, value) => {
          const t = clamp((value - edge0) / Math.max(.0001, edge1 - edge0), 0, 1);
          return t * t * (3 - 2 * t);
        };
        const bell = (value, center, width) => Math.exp(-Math.pow((value - center) / Math.max(.001, width), 2));
        const runFromNorm = (center, width, role = "body") => {
          const half = Math.max(.01, width * .5);
          const start = clamp(Math.round((center - half) * gridX), 1, gridX - 2);
          const end = clamp(Math.round((center + half) * gridX), 1, gridX - 2);
          return end > start ? makeRun(start, end, role) : null;
        };
        const runs = [];
        if (ny < .135) {
          runs.push(runFromNorm(.5, .115 + bell(ny, .08, .048) * .088, "head"));
        } else if (ny < .205) {
          runs.push(runFromNorm(.5, .09 + smooth(.135, .205, ny) * .14, "neck"));
        } else if (ny < .535) {
          const shoulder = bell(ny, .235, .048) * .19;
          const chest = bell(ny, .315, .07) * .055;
          const waistCut = bell(ny, .445, .088) * .044;
          const waistBridge = bell(ny, .455, .12) * .036;
          const hipLead = bell(ny, .525, .065) * .084;
          const torsoWidth = Math.max(.248, .25 + shoulder + chest - waistCut + waistBridge + hipLead);
          runs.push(runFromNorm(.5, torsoWidth, "torso"));
        } else if (ny < .925) {
          const thigh = bell(ny, .63, .095) * .066;
          const kneeCut = bell(ny, .725, .038) * .026;
          const calf = bell(ny, .82, .065) * .038;
          const ankleCut = bell(ny, .91, .05) * .044;
          const legWidth = .076 + thigh + calf - kneeCut - ankleCut;
          const legSpread = .055 + smooth(.76, .91, ny) * .014;
          runs.push(runFromNorm(.5 - legSpread, legWidth, "leftLeg"));
          runs.push(runFromNorm(.5 + legSpread, legWidth, "rightLeg"));
        } else {
          const foot = .068 + bell(ny, .955, .028) * .043;
          runs.push(runFromNorm(.445, foot, "leftFoot"));
          runs.push(runFromNorm(.555, foot, "rightFoot"));
        }
        const filteredRuns = runs.filter(Boolean);
        return ny >= .535 ? filteredRuns : mergeRuns(filteredRuns);
      };
      const sourceLikeFemaleSideProfile = y => {
        const ny = y / Math.max(1, gridY - 1);
        const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
        const smooth = (edge0, edge1, value) => {
          const t = clamp((value - edge0) / Math.max(.0001, edge1 - edge0), 0, 1);
          return t * t * (3 - 2 * t);
        };
        const bell = (value, center, width) => Math.exp(-Math.pow((value - center) / Math.max(.001, width), 2));
        const runFromNorm = (center, width, role = "side") => {
          const half = Math.max(.012, width * .5);
          const start = clamp(Math.round((center - half) * gridZ), 1, gridZ - 2);
          const end = clamp(Math.round((center + half) * gridZ), 1, gridZ - 2);
          return end > start ? makeRun(start, end, role) : null;
        };
        if (ny < .14) return runFromNorm(.5, .19 + bell(ny, .075, .05) * .09, "head");
        if (ny < .205) return runFromNorm(.5, .105 + smooth(.14, .205, ny) * .09, "neck");
        if (ny < .535) {
          const chestDepth = bell(ny, .318, .07) * .165;
          const upperBack = bell(ny, .255, .07) * .038;
          const waistCut = bell(ny, .445, .09) * .038;
          const abdomen = bell(ny, .48, .092) * .028;
          const chestCenter = .49 - bell(ny, .318, .07) * .018 + bell(ny, .47, .07) * .012;
          return runFromNorm(chestCenter, .232 + chestDepth + upperBack + abdomen - waistCut, "torso");
        }
        if (ny < .705) {
          const buttDepth = bell(ny, .592, .072) * .178;
          const pelvisDepth = bell(ny, .655, .045) * .044;
          const hipCenter = .512 + bell(ny, .592, .072) * .035 - bell(ny, .675, .045) * .012;
          return runFromNorm(hipCenter, .245 + buttDepth + pelvisDepth, "hip");
        }
        if (ny < .925) {
          const thigh = bell(ny, .705, .09) * .065;
          const calf = bell(ny, .825, .07) * .045;
          const ankleCut = bell(ny, .91, .05) * .045;
          return runFromNorm(.5, .15 + thigh + calf - ankleCut, "leg");
        }
        return runFromNorm(.492, .108 + bell(ny, .955, .025) * .05, "foot");
      };
      const sideProfiles = [];
      const bodyRuns = [];
      const useSideBodyScaffold = !isMeshRemake && (frontHalfMode !== "full" || backHalfMode !== "full");
      for (let y = 0; y < gridY; y++) {
        const unionRow = new Array(gridX).fill(false);
        for (let x = 0; x < gridX; x++) unionRow[x] = frontMask[y * gridX + x] || backMask[y * gridX + x];
        const unionMask = new Array(gridX).fill(false);
        for (let x = 0; x < gridX; x++) unionMask[x] = unionRow[x];
        const sideRuns = rowRuns(sideMask, gridZ, y);
        const measuredSide = sideRuns.sort((a, b) => {
          const aw = a.end - a.start + 1;
          const bw = b.end - b.start + 1;
          const ac = 1 / (1 + Math.abs(a.center - gridZ * .5));
          const bc = 1 / (1 + Math.abs(b.center - gridZ * .5));
          return (bw + bc * 5) - (aw + ac * 5);
        })[0] || null;
        const bodySide = isMeshRemake ? sourceLikeFemaleSideProfile(y) : measuredSide;
        sideProfiles[y] = bodySide;
        const rawRuns = rowRuns(unionMask, gridX, 0);
        bodyRuns[y] = useSideBodyScaffold ? sideSilhouetteBodyRuns(y, bodySide) : (isMeshRemake ? sourceLikeFemaleBodyRuns(y) : rawRuns);
      }
      let voxelCount = 0;
      for (let y = 0; y < gridY; y++) {
        const side = sideProfiles[y];
        if (!side) continue;
        for (let x = 0; x < gridX; x++) {
          const run = findRun(bodyRuns[y], x);
          if (!run) continue;
          const xCenter = x + .5;
          const xRound = Math.abs(xCenter - run.center) / Math.max(.5, run.radius);
          if (xRound > 1.08) continue;
          const isArmRun = isMeshRemake && /Arm$/.test(run.role || "");
          const zAllowance = isArmRun
            ? Math.min(.36, Math.sqrt(Math.max(0, 1 - xRound * xRound)) * .46)
            : Math.sqrt(Math.max(0, 1 - xRound * xRound)) * 1.08;
          for (let z = 0; z < gridZ; z++) {
            if (!sideMask[y * gridZ + z]) continue;
            const zCenter = z + .5;
            const zRound = Math.abs(zCenter - side.center) / Math.max(.5, side.radius);
            if (zRound > zAllowance) continue;
            occupied[voxelIndex(x, y, z)] = 1;
            voxelCount++;
          }
        }
      }
      const addVoxel = (x, y, z) => {
        if (x < 0 || y < 0 || z < 0 || x >= gridX || y >= gridY || z >= gridZ) return;
        const index = voxelIndex(x, y, z);
        if (!occupied[index]) {
          occupied[index] = 1;
          voxelCount++;
        }
      };
      const clearVoxel = (x, y, z) => {
        if (x < 0 || y < 0 || z < 0 || x >= gridX || y >= gridY || z >= gridZ) return;
        const index = voxelIndex(x, y, z);
        if (occupied[index]) {
          occupied[index] = 0;
          voxelCount--;
        }
      };
      const addTPoseArmTubes = () => {
        const armY = gridY * .238;
        const shoulderY = gridY * .228;
        const zCenter = gridZ * .5;
        const addVoxelEllipsoid = (cx, cy, cz, rx, ry, rz) => {
          const minX = Math.max(1, Math.floor(cx - rx * 1.08));
          const maxX = Math.min(gridX - 2, Math.ceil(cx + rx * 1.08));
          const minY = Math.max(1, Math.floor(cy - ry * 1.08));
          const maxY = Math.min(gridY - 2, Math.ceil(cy + ry * 1.08));
          const minZ = Math.max(1, Math.floor(cz - rz * 1.08));
          const maxZ = Math.min(gridZ - 2, Math.ceil(cz + rz * 1.08));
          for (let y = minY; y <= maxY; y++) {
            const yPart = Math.pow((y + .5 - cy) / Math.max(.5, ry), 2);
            for (let x = minX; x <= maxX; x++) {
              const xPart = Math.pow((x + .5 - cx) / Math.max(.5, rx), 2);
              for (let z = minZ; z <= maxZ; z++) {
                const zPart = Math.pow((z + .5 - cz) / Math.max(.5, rz), 2);
                if (xPart + yPart + zPart <= 1) addVoxel(x, y, z);
              }
            }
          }
        };
        const armRadiusY = Math.max(1.55, gridY * (isMeshRemake ? .022 : .026));
        const armRadiusZ = Math.max(1.7, gridZ * (isMeshRemake ? .066 : .092));
        const addArmSide = (shoulderX, wristX, sideSign) => {
          const minX = Math.max(1, Math.min(shoulderX, wristX));
          const maxX = Math.min(gridX - 2, Math.max(shoulderX, wristX));
          for (let x = minX; x <= maxX; x++) {
            const t = Math.max(0, Math.min(1, sideSign < 0
              ? (shoulderX - x) / Math.max(1, shoulderX - wristX)
              : (x - shoulderX) / Math.max(1, wristX - shoulderX)));
            const shoulderBlend = 1 - t;
            const wristBlend = t;
            const yCenter = armY - shoulderBlend * gridY * .009 + wristBlend * gridY * .004;
            const radiusY = armRadiusY * (.62 + shoulderBlend * .58 + (t > .78 ? .22 : 0));
            const radiusZ = armRadiusZ * (.62 + shoulderBlend * .5 + (t > .78 ? .18 : 0));
            const yStart = Math.max(1, Math.floor(yCenter - radiusY * 1.25));
            const yEnd = Math.min(gridY - 2, Math.ceil(yCenter + radiusY * 1.25));
            const zStart = Math.max(1, Math.floor(zCenter - radiusZ * 1.25));
            const zEnd = Math.min(gridZ - 2, Math.ceil(zCenter + radiusZ * 1.25));
            for (let y = yStart; y <= yEnd; y++) {
              const yPart = Math.pow((y + .5 - yCenter) / Math.max(.5, radiusY), 2);
              for (let z = zStart; z <= zEnd; z++) {
                const zPart = Math.pow((z + .5 - zCenter) / Math.max(.5, radiusZ), 2);
                if (yPart + zPart <= 1) addVoxel(x, y, z);
              }
            }
          }
          addVoxelEllipsoid(
            wristX,
            armY + gridY * .008,
            zCenter,
            gridX * (isMeshRemake ? .021 : .03),
            gridY * (isMeshRemake ? .024 : .036),
            gridZ * (isMeshRemake ? .054 : .082)
          );
          const fingerStart = wristX + sideSign * Math.max(1, gridX * .012);
          for (let i = -2; i <= 2; i++) {
            const fingerY = armY + i * gridY * .006;
            addVoxelEllipsoid(
              fingerStart + sideSign * gridX * (isMeshRemake ? .027 : .018),
              fingerY,
              zCenter + i * gridZ * .014,
              gridX * (isMeshRemake ? .025 : .018),
              gridY * (isMeshRemake ? .0052 : .008),
              gridZ * (isMeshRemake ? .013 : .024)
            );
          }
        };
        addArmSide(Math.floor(gridX * .36), Math.floor(gridX * .005), -1);
        addArmSide(Math.ceil(gridX * .64), Math.ceil(gridX * .995), 1);
        const shoulderRadiusY = Math.max(1.8, gridY * (isMeshRemake ? .026 : .034));
        const shoulderRadiusZ = Math.max(1.95, gridZ * (isMeshRemake ? .076 : .102));
        for (let x = Math.floor(gridX * .34); x <= Math.ceil(gridX * .66); x++) {
          for (let y = Math.floor(shoulderY - shoulderRadiusY); y <= Math.ceil(shoulderY + shoulderRadiusY); y++) {
            for (let z = Math.floor(zCenter - shoulderRadiusZ); z <= Math.ceil(zCenter + shoulderRadiusZ); z++) {
              const nx = (x + .5) / gridX;
              const shoulderLobe = Math.max(
                Math.exp(-Math.pow((nx - .36) / (isMeshRemake ? .055 : .085), 2)),
                Math.exp(-Math.pow((nx - .64) / (isMeshRemake ? .055 : .085), 2))
              );
              const yPart = Math.pow((y + .5 - shoulderY) / Math.max(.5, shoulderRadiusY), 2);
              const zPart = Math.pow((z + .5 - zCenter) / Math.max(.5, shoulderRadiusZ), 2);
              if (shoulderLobe > (isMeshRemake ? .34 : .2) && yPart + zPart <= (isMeshRemake ? 1.02 : 1.15)) addVoxel(x, y, z);
            }
          }
        }
      };
      const addFormEllipsoid = (cx, cy, cz, rx, ry, rz, strength = 1) => {
        const minX = Math.max(0, Math.floor((cx - rx) * gridX));
        const maxX = Math.min(gridX - 1, Math.ceil((cx + rx) * gridX));
        const minY = Math.max(0, Math.floor((cy - ry) * gridY));
        const maxY = Math.min(gridY - 1, Math.ceil((cy + ry) * gridY));
        const minZ = Math.max(0, Math.floor((cz - rz) * gridZ));
        const maxZ = Math.min(gridZ - 1, Math.ceil((cz + rz) * gridZ));
        for (let y = minY; y <= maxY; y++) {
          const ny = (y + .5) / gridY;
          const yPart = Math.pow((ny - cy) / Math.max(.001, ry), 2);
          for (let x = minX; x <= maxX; x++) {
            const nx = (x + .5) / gridX;
            const xPart = Math.pow((nx - cx) / Math.max(.001, rx), 2);
            const run = findRun(bodyRuns[y] || [], x);
            if (!run && Math.abs(nx - cx) > rx * .55) continue;
            for (let z = minZ; z <= maxZ; z++) {
              const nz = (z + .5) / gridZ;
              const zPart = Math.pow((nz - cz) / Math.max(.001, rz), 2);
              if (xPart + yPart + zPart <= strength) addVoxel(x, y, z);
            }
          }
        }
      };
      const carveFormGroove = (cx, cy, cz, rx, ry, rz) => {
        const minX = Math.max(0, Math.floor((cx - rx) * gridX));
        const maxX = Math.min(gridX - 1, Math.ceil((cx + rx) * gridX));
        const minY = Math.max(0, Math.floor((cy - ry) * gridY));
        const maxY = Math.min(gridY - 1, Math.ceil((cy + ry) * gridY));
        const minZ = Math.max(0, Math.floor((cz - rz) * gridZ));
        const maxZ = Math.min(gridZ - 1, Math.ceil((cz + rz) * gridZ));
        for (let y = minY; y <= maxY; y++) {
          const ny = (y + .5) / gridY;
          const yPart = Math.pow((ny - cy) / Math.max(.001, ry), 2);
          for (let x = minX; x <= maxX; x++) {
            const nx = (x + .5) / gridX;
            const xPart = Math.pow((nx - cx) / Math.max(.001, rx), 2);
            for (let z = minZ; z <= maxZ; z++) {
              const nz = (z + .5) / gridZ;
              const zPart = Math.pow((nz - cz) / Math.max(.001, rz), 2);
              if (xPart + yPart + zPart <= 1) clearVoxel(x, y, z);
            }
          }
        }
      };
      // Detailed half-sheet form zones. Let the side silhouette drive most of the body depth,
      // then add compact paired volumes only where a flat silhouette cannot express rounded form.
      const detailedHalfSheet = !isMeshRemake && (frontHalfMode !== "full" || backHalfMode !== "full");
      const pairedGuideScale = detailedHalfSheet ? .74 : 1;
      const slabGuideScale = detailedHalfSheet ? .08 : .32;
      // Keep front chest helpers as compact forward volumes. Do not add paired rear hip
      // ellipsoids as solid voxels: those blobs change the front silhouette too. The
      // backside is now shaped by side/back depth displacement instead.
      if (!isMeshRemake) {
        addFormEllipsoid(.38, .305, .155, .068, .044, .096, pairedGuideScale);
        addFormEllipsoid(.62, .305, .155, .068, .044, .096, pairedGuideScale);
        addFormEllipsoid(.5, .382, .35, .122, .052, .034, slabGuideScale);
        addFormEllipsoid(.5, .405, .66, .122, .052, .034, slabGuideScale);
      } else {
        addFormEllipsoid(.39, .335, .16, .035, .023, .038, .2);
        addFormEllipsoid(.61, .335, .16, .035, .023, .038, .2);
        addFormEllipsoid(.39, .602, .8, .04, .032, .052, .22);
        addFormEllipsoid(.61, .602, .8, .04, .032, .052, .22);
        addFormEllipsoid(.5, .626, .72, .09, .032, .035, .12);
        carveFormGroove(.5, .674, .5, .022, .155, .36);
      }

      // Compact side fill: connect short internal gaps across depth/width so thin limbs
      // and torso slices become solid instead of see-through, without growing the outer silhouette.
      // Arm separation: after the compact fill closes the skin, cut a slim air gap
      // between the hanging arms and torso so the arms read as their own parts. The
      // upper shoulder area is preserved so arms stay attached where they should.
      const carveArmBodySeparation = () => {
        const softBell = (v, center, radius) => { const d = (v - center) / Math.max(radius, .0001); return Math.max(0, 1 - d * d); };
        const yMin = Math.max(1, Math.floor(gridY * .225));
        const yMax = Math.min(gridY - 2, Math.ceil(gridY * .42));
        const gapCenters = [.35, .65];
        const gapHalfWidth = detailedHalfSheet ? .018 : .02;
        for (let y = yMin; y <= yMax; y++) {
          const ny = (y + .5) / gridY;
          const upperArmBand = softBell(ny, .255, .06);
          const forearmBand = softBell(ny, .31, .075);
          const handBand = softBell(ny, .37, .045) * .6;
          const preserveShoulder = softBell(ny, .225, .035) * .9;
          const cutBand = Math.max(upperArmBand, forearmBand, handBand) * (1 - preserveShoulder);
          if (cutBand < .12) continue;
          for (const cx of gapCenters) {
            const minX = Math.max(1, Math.floor((cx - gapHalfWidth * 1.7) * gridX));
            const maxX = Math.min(gridX - 2, Math.ceil((cx + gapHalfWidth * 1.7) * gridX));
            for (let x = minX; x <= maxX; x++) {
              const nx = (x + .5) / gridX;
              const xCut = softBell(nx, cx, gapHalfWidth);
              if (xCut * cutBand < .18) continue;
              for (let z = 1; z < gridZ - 1; z++) {
                const nz = (z + .5) / gridZ;
                const centerDepth = softBell(nz, .5, .36);
                const sideDepth = Math.max(softBell(nz, .24, .23), softBell(nz, .76, .23)) * .34;
                const depthCut = .5 + centerDepth * .42 + sideDepth;
                if (xCut * cutBand * depthCut > .235) clearVoxel(x, y, z);
              }
            }
          }
        }
      };
      const carveSourceLikeAnatomySeparations = () => {
        const softBell = (v, center, radius) => { const d = (v - center) / Math.max(radius, .0001); return Math.max(0, 1 - d * d); };
        const carveAt = (cx, cy, cz, rx, ry, rz, power = .26) => {
          const minX = Math.max(1, Math.floor((cx - rx * 1.4) * gridX));
          const maxX = Math.min(gridX - 2, Math.ceil((cx + rx * 1.4) * gridX));
          const minY = Math.max(1, Math.floor((cy - ry * 1.4) * gridY));
          const maxY = Math.min(gridY - 2, Math.ceil((cy + ry * 1.4) * gridY));
          const minZ = Math.max(1, Math.floor((cz - rz * 1.4) * gridZ));
          const maxZ = Math.min(gridZ - 2, Math.ceil((cz + rz * 1.4) * gridZ));
          for (let y = minY; y <= maxY; y++) {
            const ny = (y + .5) / gridY;
            const yCut = softBell(ny, cy, ry);
            for (let x = minX; x <= maxX; x++) {
              const nx = (x + .5) / gridX;
              const xCut = softBell(nx, cx, rx);
              for (let z = minZ; z <= maxZ; z++) {
                const nz = (z + .5) / gridZ;
                const zCut = softBell(nz, cz, rz);
                if (xCut * yCut * zCut > power) clearVoxel(x, y, z);
              }
            }
          }
        };
        carveAt(.5, .345, .13, .024, .038, .074, .24);
        carveAt(.5, .602, .86, .032, .068, .088, .23);
        carveAt(.5, .705, .5, .047, .088, .44, .16);
        carveAt(.5, .79, .5, .038, .155, .42, .15);
        const handY = .235;
        for (const side of [-1, 1]) {
          const handX = side < 0 ? .065 : .935;
          for (const gapY of [-.034, -.018, -.002, .014, .03]) {
            carveAt(handX, handY + gapY, .5, .049, .0044, .145, .13);
          }
          for (const gapZ of [.38, .46, .54, .62]) {
            carveAt(handX, handY + .001, gapZ, .043, .017, .0085, .14);
          }
          carveAt(handX - side * .038, handY + .004, .5, .017, .025, .12, .22);
        }
      };
      const carveSourceLikeStraightLegWaistV38 = () => {
        const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
        const smooth = (edge0, edge1, value) => {
          const t = clamp((value - edge0) / Math.max(.0001, edge1 - edge0), 0, 1);
          return t * t * (3 - 2 * t);
        };
        const softBell = (v, center, radius) => {
          const d = (v - center) / Math.max(radius, .0001);
          return Math.max(0, 1 - d * d);
        };
        for (let y = Math.max(1, Math.floor(gridY * .60)); y <= Math.min(gridY - 2, Math.ceil(gridY * .985)); y++) {
          const ny = (y + .5) / gridY;
          const footBand = softBell(ny, .955, .05);
          const ankleBand = smooth(.80, .925, ny);
          const gapWidth = .005 + ankleBand * .008 + footBand * .025;
          const gapDepth = .15 + footBand * .16;
          const minX = Math.max(1, Math.floor((.5 - gapWidth * 1.4) * gridX));
          const maxX = Math.min(gridX - 2, Math.ceil((.5 + gapWidth * 1.4) * gridX));
          const minZ = Math.max(1, Math.floor((.5 - gapDepth) * gridZ));
          const maxZ = Math.min(gridZ - 2, Math.ceil((.5 + gapDepth) * gridZ));
          for (let x = minX; x <= maxX; x++) {
            const nx = (x + .5) / gridX;
            const xCut = softBell(nx, .5, gapWidth);
            for (let z = minZ; z <= maxZ; z++) {
              const nz = (z + .5) / gridZ;
              const zCut = softBell(nz, .5, gapDepth);
              if (xCut * zCut > (.24 - footBand * .055)) clearVoxel(x, y, z);
            }
          }
        }
        for (let y = Math.max(1, Math.floor(gridY * .38)); y <= Math.min(gridY - 2, Math.ceil(gridY * .52)); y++) {
          const ny = (y + .5) / gridY;
          const waistBand = softBell(ny, .455, .095);
          if (waistBand < .08) continue;
          for (const cx of [.292, .708]) {
            const rx = .014;
            const minX = Math.max(1, Math.floor((cx - rx * 1.35) * gridX));
            const maxX = Math.min(gridX - 2, Math.ceil((cx + rx * 1.35) * gridX));
            for (let x = minX; x <= maxX; x++) {
              const nx = (x + .5) / gridX;
              const xCut = softBell(nx, cx, rx);
              if (xCut * waistBand < .18) continue;
              for (let z = 1; z < gridZ - 1; z++) {
                const nz = (z + .5) / gridZ;
                const zCut = softBell(nz, .5, .28);
                if (xCut * waistBand * zCut > .52) clearVoxel(x, y, z);
              }
            }
          }
        }
      };
      const fillShortInternalGaps = passes => {
        const isFilled = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < gridX && y < gridY && z < gridZ && occupied[voxelIndex(x, y, z)];
        const fillList = [];
        for (let pass = 0; pass < passes; pass++) {
          fillList.length = 0;
          for (let y = 1; y < gridY - 1; y++) {
            for (let x = 1; x < gridX - 1; x++) {
              let last = -1;
              for (let z = 0; z < gridZ; z++) {
                if (!isFilled(x, y, z)) continue;
                if (last >= 0 && z - last <= 4) for (let zz = last + 1; zz < z; zz++) fillList.push([x, y, zz]);
                last = z;
              }
            }
          }
          for (let y = 1; y < gridY - 1; y++) {
            for (let z = 1; z < gridZ - 1; z++) {
              let last = -1;
              for (let x = 0; x < gridX; x++) {
                if (!isFilled(x, y, z)) continue;
                if (last >= 0 && x - last <= 3) for (let xx = last + 1; xx < x; xx++) fillList.push([xx, y, z]);
                last = x;
              }
            }
          }
          for (const [x, y, z] of fillList) addVoxel(x, y, z);
        }
      };

      // Skin close pass: the thresholded image can leave tiny one-cell gaps between slice rows.
      // Fill only pinholes supported from opposite sides, so the mannequin becomes continuous without inflating the silhouette.
      const closeSkinGaps = passes => {
        const candidates = [];
        const isOn = (x, y, z) => occupied[voxelIndex(x, y, z)] ? 1 : 0;
        for (let pass = 0; pass < passes; pass++) {
          candidates.length = 0;
          for (let y = 1; y < gridY - 1; y++) {
            for (let x = 1; x < gridX - 1; x++) {
              for (let z = 1; z < gridZ - 1; z++) {
                if (isOn(x, y, z)) continue;
                const oppositeY = isOn(x, y - 1, z) && isOn(x, y + 1, z);
                const oppositeX = isOn(x - 1, y, z) && isOn(x + 1, y, z);
                const oppositeZ = isOn(x, y, z - 1) && isOn(x, y, z + 1);
                const neighborCount = isOn(x - 1, y, z) + isOn(x + 1, y, z) + isOn(x, y - 1, z) + isOn(x, y + 1, z) + isOn(x, y, z - 1) + isOn(x, y, z + 1);
                if ((oppositeY && neighborCount >= 3) || (oppositeX && oppositeZ) || neighborCount >= 5) candidates.push([x, y, z]);
              }
            }
          }
          for (const [x, y, z] of candidates) addVoxel(x, y, z);
        }
      };
      addTPoseArmTubes();
      fillShortInternalGaps(isMeshRemake ? 1 : (detailedHalfSheet ? 3 : 1));
      closeSkinGaps(isMeshRemake ? 1 : (detailedHalfSheet ? 4 : 1));
      if (isMeshRemake) {
        carveSourceLikeAnatomySeparations();
        carveSourceLikeStraightLegWaistV38();
      } else {
        carveArmBodySeparation();
        carveFormGroove(.5, .305, .105, .03, .064, .096);
        carveFormGroove(.5, .54, .93, .04, .108, .124);
      }

      const positions = [];
      const uvs = [];
      const point = (x, y, z) => [
        (x / gridX - .5) * meshW,
        (.5 - y / gridY) * meshH,
        (z / gridZ - .5) * meshD
      ];
      const pushTri = (a, b, c) => {
        positions.push(...a.p, ...b.p, ...c.p);
        uvs.push(...a.uv, ...b.uv, ...c.uv);
      };
      const pushQuad = (a, b, c, d) => {
        pushTri(a, b, c);
        pushTri(a, c, d);
      };
      const detailStrength = isMeshRemake ? Math.min(.008, Math.max(.0025, depth * .004)) : Math.min(.035, Math.max(.01, depth * .018));
      const formStrength = isMeshRemake ? Math.min(.14, Math.max(.055, depth * .096)) : Math.min(.18, Math.max(.055, depth * .135));
      const detailContrastStrength = 0;
      const centerGrooveStrength = formStrength * .7;
      const halfDepthStrength = formStrength * .18;
      const clampDetail = amount => {
        const min = isMeshRemake ? -formStrength * .9 : -formStrength * .72;
        const max = isMeshRemake ? formStrength * 1.18 : formStrength * 1.05;
        return Math.max(min, Math.min(max, amount));
      };
      const bell = (value, center, width) => Math.exp(-Math.pow((value - center) / Math.max(.001, width), 2));
      const detailFromPixel = pixel => {
        const raw = darkForeground
          ? (threshold - pixel.luma) / Math.max(1, threshold)
          : (pixel.luma - threshold) / Math.max(1, 255 - threshold);
        return Math.max(-1, Math.min(1, raw * 2 - .65));
      };
      const viewSampleInfo = (view, x, y, z) => {
        if (view === "front") return { view, nx: x / gridX, ny: y / gridY };
        if (view === "back") return { view, nx: x / gridX, ny: y / gridY };
        return { view, nx: z / gridZ, ny: y / gridY };
      };
      const detailAmountFor = (view, x, y, z) => {
        const info = viewSampleInfo(view, x, y, z);
        const pixel = sampleView(info.view, info.nx, info.ny);
        const radiusX = view === "side" ? 1 / Math.max(12, gridZ) : 1 / Math.max(16, gridX);
        const radiusY = 1 / Math.max(20, gridY);
        let total = 0;
        let count = 0;
        for (const offset of [[-radiusX, 0], [radiusX, 0], [0, -radiusY], [0, radiusY], [-radiusX, -radiusY], [radiusX, -radiusY], [-radiusX, radiusY], [radiusX, radiusY]]) {
          const neighbor = sampleView(info.view, info.nx + offset[0], info.ny + offset[1]);
          if (neighbor.a > 24) {
            total += neighbor.luma;
            count++;
          }
        }
        const localAverage = count ? total / count : pixel.luma;
        const localContrast = (pixel.luma - localAverage) / 255;
        const signedContrast = darkForeground ? -localContrast : localContrast;
        const sourceTone = isMeshRemake && pixel.a > 24 ? detailFromPixel(pixel) : 0;
        const sourceToneDetail = isMeshRemake ? Math.max(-.55, Math.min(.72, sourceTone)) * detailStrength * (view === "side" ? .2 : .14) : 0;
        const sourceEdgeDetail = isMeshRemake ? Math.max(-.55, Math.min(.55, signedContrast * 2.6)) * detailStrength * (view === "side" ? .07 : .045) : 0;
        const absoluteVolume = 0;
        const darkGrooveBoost = 0;
        const nx = view === "side" ? z / Math.max(1, gridZ) : x / Math.max(1, gridX);
        const ny = y / Math.max(1, gridY);
        const centerLine = bell(nx, .5, view === "back" ? .045 : .055);
        const torsoBand = bell(ny, .43, .20);
        const chestBand = bell(ny, .342, .06);
        const upperChestBand = bell(ny, .292, .055);
        const hipBand = bell(ny, .575, .088);
        const upperLegBand = bell(ny, .72, .10);
        const shoulderBand = bell(ny, .27, .08);
        const backBand = view === "back" ? Math.max(torsoBand * .55, hipBand * 1.05, upperLegBand * .5) : Math.max(torsoBand * .42, hipBand * .38);
        const leftFormLobe = bell(nx, .38, .085);
        const rightFormLobe = bell(nx, .62, .085);
        const pairedLobes = Math.max(leftFormLobe, rightFormLobe);
        const breastLowerBand = bell(ny, .383, .024);
        const buttLowerBand = bell(ny, .642, .034);
        const meshFrontChestVolume = isMeshRemake && view === "front" ? pairedLobes * chestBand * formStrength * .52 : 0;
        const meshUpperChestFlatten = isMeshRemake && view === "front" ? -bell(nx, .5, .24) * upperChestBand * formStrength * .08 : 0;
        const meshChestCenterGroove = isMeshRemake && view === "front" ? -bell(nx, .5, .024) * chestBand * formStrength * .22 : 0;
        const meshUnderBreastGroove = isMeshRemake && view === "front" ? -pairedLobes * breastLowerBand * formStrength * .14 : 0;
        const meshBackButtVolume = isMeshRemake && view === "back" ? pairedLobes * hipBand * formStrength * .56 : 0;
        const meshButtCenterGroove = isMeshRemake && view === "back" ? -bell(nx, .5, .03) * hipBand * formStrength * .32 : 0;
        const meshUnderButtGroove = isMeshRemake && view === "back" ? -pairedLobes * buttLowerBand * formStrength * .16 : 0;
        const meshPelvisCenterCut = isMeshRemake && (view === "front" || view === "back") ? -bell(nx, .5, .024) * bell(ny, .675, .075) * formStrength * .48 : 0;
        const meshSideChestVolume = isMeshRemake && view === "side" ? bell(nx, .205, .075) * chestBand * formStrength * .98 : 0;
        const meshSideButtVolume = isMeshRemake && view === "side" ? bell(nx, .835, .09) * hipBand * formStrength * 1.05 : 0;
        const frontChestVolume = view === "front" ? pairedLobes * chestBand * formStrength * (isMeshRemake ? .18 : .48) : 0;
        const frontRibVolume = view === "front" ? bell(nx, .5, .20) * torsoBand * formStrength * .022 : 0;
        const backShoulderVolume = view === "back" ? bell(nx, .5, .30) * shoulderBand * formStrength * .09 : 0;
        const backHipVolume = view === "back" ? pairedLobes * hipBand * formStrength * (isMeshRemake ? .22 : .68) : 0;
        const scaffoldFace = useSideBodyScaffold && (view === "front" || view === "back");
        const scaffoldDetailScale = scaffoldFace ? .16 : 1;
        const scaffoldGrooveScale = scaffoldFace ? .08 : 1;
        const centerGroove = view === "front" || view === "back" ? -centerLine * backBand * centerGrooveStrength * scaffoldGrooveScale : 0;
        const halfMode = view === "front" ? frontHalfMode : view === "back" ? backHalfMode : "full";
        const halfT = halfMode === "full" ? 1 : halfViewNx(nx, halfMode);
        const halfCutBand = bell(halfT, 0, .24);
        const halfShoulderBand = bell(halfT, .72, .34);
        const halfCutValley = halfMode === "full" ? 0 : -halfCutBand * Math.max(backBand, .28) * halfDepthStrength * (scaffoldFace ? .35 : 1);
        const halfOuterRise = halfMode === "full" ? 0 : halfShoulderBand * halfDepthStrength * .12;
        const sourceAlignedDetail = sourceToneDetail + sourceEdgeDetail;
        const softScaffoldForm = absoluteVolume + darkGrooveBoost + frontChestVolume + frontRibVolume + backShoulderVolume + backHipVolume + meshFrontChestVolume + meshUpperChestFlatten + meshChestCenterGroove + meshUnderBreastGroove + meshBackButtVolume + meshButtCenterGroove + meshUnderButtGroove + meshPelvisCenterCut + meshSideChestVolume + meshSideButtVolume + halfCutValley + halfOuterRise + sourceAlignedDetail;
        return clampDetail(softScaffoldForm * scaffoldDetailScale + centerGroove);
      };
      const displacePoint = (p, direction, amount) => [
        p[0] + direction[0] * amount,
        p[1] + direction[1] * amount,
        p[2] + direction[2] * amount
      ];
      const detailVertex = (x, y, z, u, vv, view, direction) => {
        const base = point(x, y, z);
        const amount = detailAmountFor(view, x, y, z);
        return { p: displacePoint(base, direction, amount), uv: [u, vv] };
      };
      const v = (x, y, z, u, vv, view = "none", direction = [0, 0, 0]) => {
        if (view !== "none") return detailVertex(x, y, z, u, vv, view, direction);
        return { p: point(x, y, z), uv: [u, vv] };
      };
      const polishLevel = isMeshRemake ? Math.max(1, smoothPasses + 1) : Math.max(1, smoothPasses - 1);
      const maxPatchSpan = isMeshRemake ? Math.max(2, 6 - Math.min(4, Math.max(1, smoothPasses))) : Math.max(3, 9 - Math.min(6, Math.max(1, smoothPasses)));
      const mix = (a, b, t) => a + (b - a) * t;
      const mixArray = (a, b, t) => a.map((value, index) => mix(value, b[index], t));
      const mixVertex = (a, b, t) => ({ p: mixArray(a.p, b.p, t), uv: mixArray(a.uv, b.uv, t) });
      const patchVertex = (a, b, c, d, u, vv) => {
        const top = mixVertex(a, b, u);
        const bottom = mixVertex(d, c, u);
        return mixVertex(top, bottom, vv);
      };
      const pushQuadPatch = (a, b, c, d, stepsU = 1, stepsV = 1) => {
        const uSteps = Math.max(1, Math.round(stepsU));
        const vSteps = Math.max(1, Math.round(stepsV));
        if (uSteps === 1 && vSteps === 1) {
          pushQuad(a, b, c, d);
          return;
        }
        for (let py = 0; py < vSteps; py++) {
          const v0 = py / vSteps;
          const v1 = (py + 1) / vSteps;
          for (let px = 0; px < uSteps; px++) {
            const u0 = px / uSteps;
            const u1 = (px + 1) / uSteps;
            pushQuad(
              patchVertex(a, b, c, d, u0, v0),
              patchVertex(a, b, c, d, u1, v0),
              patchVertex(a, b, c, d, u1, v1),
              patchVertex(a, b, c, d, u0, v1)
            );
          }
        }
      };
      const relaxWeldedPositions = (iterations, strength) => {
        if (positions.length < 9 || iterations <= 0 || strength <= 0) return;
        const vertexX = [];
        const vertexY = [];
        const vertexZ = [];
        const keyToIndex = new Map();
        const occurrenceCount = positions.length / 3;
        const occurrenceToVertex = new Int32Array(occurrenceCount);
        const getVertexIndex = offset => {
          const key = `${positions[offset].toFixed(5)},${positions[offset + 1].toFixed(5)},${positions[offset + 2].toFixed(5)}`;
          if (keyToIndex.has(key)) return keyToIndex.get(key);
          const index = vertexX.length;
          keyToIndex.set(key, index);
          vertexX.push(positions[offset]);
          vertexY.push(positions[offset + 1]);
          vertexZ.push(positions[offset + 2]);
          return index;
        };
        for (let i = 0; i < positions.length; i += 3) {
          occurrenceToVertex[i / 3] = getVertexIndex(i);
        }
        const vertexCount = vertexX.length;
        let currentX = Float64Array.from(vertexX);
        let currentY = Float64Array.from(vertexY);
        let currentZ = Float64Array.from(vertexZ);
        for (let pass = 0; pass < iterations; pass++) {
          const sumX = new Float64Array(vertexCount);
          const sumY = new Float64Array(vertexCount);
          const sumZ = new Float64Array(vertexCount);
          const counts = new Uint32Array(vertexCount);
          const addNeighbor = (target, source) => {
            sumX[target] += currentX[source];
            sumY[target] += currentY[source];
            sumZ[target] += currentZ[source];
            counts[target]++;
          };
          for (let i = 0; i < occurrenceCount; i += 3) {
            const a = occurrenceToVertex[i];
            const b = occurrenceToVertex[i + 1];
            const c = occurrenceToVertex[i + 2];
            addNeighbor(a, b); addNeighbor(a, c);
            addNeighbor(b, a); addNeighbor(b, c);
            addNeighbor(c, a); addNeighbor(c, b);
          }
          const nextX = new Float64Array(vertexCount);
          const nextY = new Float64Array(vertexCount);
          const nextZ = new Float64Array(vertexCount);
          for (let i = 0; i < vertexCount; i++) {
            if (!counts[i]) {
              nextX[i] = currentX[i];
              nextY[i] = currentY[i];
              nextZ[i] = currentZ[i];
              continue;
            }
            nextX[i] = mix(currentX[i], sumX[i] / counts[i], strength);
            nextY[i] = mix(currentY[i], sumY[i] / counts[i], strength);
            nextZ[i] = mix(currentZ[i], sumZ[i] / counts[i], strength);
          }
          currentX = nextX;
          currentY = nextY;
          currentZ = nextZ;
        }
        for (let i = 0; i < positions.length; i += 3) {
          const vertex = occurrenceToVertex[i / 3];
          positions[i] = currentX[vertex];
          positions[i + 1] = currentY[vertex];
          positions[i + 2] = currentZ[vertex];
        }
      };
      const greedyPlane = (w, h, isFilled, pushRect) => {
        const used = new Uint8Array(w * h);
        for (let yy = 0; yy < h; yy++) {
          for (let xx = 0; xx < w; xx++) {
            const start = yy * w + xx;
            if (used[start] || !isFilled(xx, yy)) continue;
            let rectW = 1;
            while (xx + rectW < w && !used[yy * w + xx + rectW] && isFilled(xx + rectW, yy)) rectW++;
            let rectH = 1;
            outer: while (yy + rectH < h) {
              for (let rx = 0; rx < rectW; rx++) {
                const index = (yy + rectH) * w + xx + rx;
                if (used[index] || !isFilled(xx + rx, yy + rectH)) break outer;
              }
              rectH++;
            }
            for (let ry = 0; ry < rectH; ry++) {
              for (let rx = 0; rx < rectW; rx++) used[(yy + ry) * w + xx + rx] = 1;
            }
            pushRect(xx, yy, rectW, rectH);
          }
        }
      };
      let mergedFaceCount = 0;
      for (let z = 0; z < gridZ; z++) {
        greedyPlane(gridX, gridY, (x, y) => isVoxel(x, y, z) && !isVoxel(x, y, z - 1), (x, y, w, h) => {
          mergedFaceCount++;
          pushQuadPatch(v(x, y, z, x / gridX, 1 - y / gridY, "front", [0, 0, -1]), v(x + w, y, z, (x + w) / gridX, 1 - y / gridY, "front", [0, 0, -1]), v(x + w, y + h, z, (x + w) / gridX, 1 - (y + h) / gridY, "front", [0, 0, -1]), v(x, y + h, z, x / gridX, 1 - (y + h) / gridY, "front", [0, 0, -1]), Math.ceil(w / maxPatchSpan), Math.ceil(h / maxPatchSpan));
        });
        greedyPlane(gridX, gridY, (x, y) => isVoxel(x, y, z) && !isVoxel(x, y, z + 1), (x, y, w, h) => {
          mergedFaceCount++;
          pushQuadPatch(v(x, y, z + 1, x / gridX, 1 - y / gridY, "back", [0, 0, 1]), v(x, y + h, z + 1, x / gridX, 1 - (y + h) / gridY, "back", [0, 0, 1]), v(x + w, y + h, z + 1, (x + w) / gridX, 1 - (y + h) / gridY, "back", [0, 0, 1]), v(x + w, y, z + 1, (x + w) / gridX, 1 - y / gridY, "back", [0, 0, 1]), Math.ceil(h / maxPatchSpan), Math.ceil(w / maxPatchSpan));
        });
      }
      for (let x = 0; x < gridX; x++) {
        greedyPlane(gridZ, gridY, (z, y) => isVoxel(x, y, z) && !isVoxel(x - 1, y, z), (z, y, w, h) => {
          mergedFaceCount++;
          pushQuadPatch(v(x, y, z, z / gridZ, 1 - y / gridY, "side", [-1, 0, 0]), v(x, y + h, z, z / gridZ, 1 - (y + h) / gridY, "side", [-1, 0, 0]), v(x, y + h, z + w, (z + w) / gridZ, 1 - (y + h) / gridY, "side", [-1, 0, 0]), v(x, y, z + w, (z + w) / gridZ, 1 - y / gridY, "side", [-1, 0, 0]), Math.ceil(h / maxPatchSpan), Math.ceil(w / maxPatchSpan));
        });
        greedyPlane(gridZ, gridY, (z, y) => isVoxel(x, y, z) && !isVoxel(x + 1, y, z), (z, y, w, h) => {
          mergedFaceCount++;
          pushQuadPatch(v(x + 1, y, z, z / gridZ, 1 - y / gridY, "side", [1, 0, 0]), v(x + 1, y, z + w, (z + w) / gridZ, 1 - y / gridY, "side", [1, 0, 0]), v(x + 1, y + h, z + w, (z + w) / gridZ, 1 - (y + h) / gridY, "side", [1, 0, 0]), v(x + 1, y + h, z, z / gridZ, 1 - (y + h) / gridY, "side", [1, 0, 0]), Math.ceil(w / maxPatchSpan), Math.ceil(h / maxPatchSpan));
        });
      }
      for (let y = 0; y < gridY; y++) {
        greedyPlane(gridX, gridZ, (x, z) => isVoxel(x, y, z) && !isVoxel(x, y - 1, z), (x, z, w, h) => {
          mergedFaceCount++;
          pushQuadPatch(v(x, y, z, x / gridX, z / gridZ), v(x, y, z + h, x / gridX, (z + h) / gridZ), v(x + w, y, z + h, (x + w) / gridX, (z + h) / gridZ), v(x + w, y, z, (x + w) / gridX, z / gridZ), Math.ceil(h / maxPatchSpan), Math.ceil(w / maxPatchSpan));
        });
        greedyPlane(gridX, gridZ, (x, z) => isVoxel(x, y, z) && !isVoxel(x, y + 1, z), (x, z, w, h) => {
          mergedFaceCount++;
          pushQuadPatch(v(x, y + 1, z, x / gridX, z / gridZ), v(x + w, y + 1, z, (x + w) / gridX, z / gridZ), v(x + w, y + 1, z + h, (x + w) / gridX, (z + h) / gridZ), v(x, y + 1, z + h, x / gridX, (z + h) / gridZ), Math.ceil(w / maxPatchSpan), Math.ceil(h / maxPatchSpan));
        });
      }
      if (polishLevel > 0) relaxWeldedPositions(isMeshRemake ? Math.min(7, polishLevel + 2) : (useSideBodyScaffold ? Math.min(8, polishLevel + 4) : Math.min(5, polishLevel + 1)), isMeshRemake ? .22 : (useSideBodyScaffold ? .24 : .16));
      if (positions.length < 9) throw new Error("No sheet foreground was found. Try Threshold or Dark foreground.");
      return {
        positions,
        uvs,
        meta: { mode: isMeshRemake ? "sourceLikeStraightLegWaistMeshV38" : "viewSheetHeightmapArmTubeSeparationV20", buildMode: isMeshRemake ? "meshRebuild" : buildMode, bodyPreset, sourceName, cols: gridX, rows: gridY, depthSlices: gridZ, sourceW: imageData.width, sourceH: imageData.height, threshold, darkForeground, smoothPasses, polishLevel, depth, back, voxelCount, mergedFaceCount, detailStrength, detailContrastStrength, centerGrooveStrength, formStrength, halfDepthStrength, sourceLikeMeshScale, guidedFormVolumes: !isMeshRemake, sideBodyScaffold: useSideBodyScaffold, tallBodyProportions: !isMeshRemake, wideBodyScaffold: !isMeshRemake, preservedArmSpanGuides: !isMeshRemake, filledScaffoldFaces: !isMeshRemake, strongerArmGuides: !isMeshRemake, closedInternalSkin: !isMeshRemake, calmerScaffoldCarving: !isMeshRemake, armTubeSeparation: !isMeshRemake, controlledLegGap: !isMeshRemake, trimmedHipRuns: !isMeshRemake, sourceLikeSheetMesh: isMeshRemake, splitArmMeshRemake: isMeshRemake, sourceLikeLowerDetailScaleMesh: isMeshRemake, sourceLikeImageAlignedMesh: isMeshRemake, sourceLikeFemaleScaffoldMesh: isMeshRemake, sourceLikeControlledArmMesh: isMeshRemake, sourceLikeProfileAnatomyMesh: isMeshRemake, sourceLikeSoftAnatomyMesh: isMeshRemake, sourceLikeBalancedAnatomyMesh: isMeshRemake, sourceLikeStraightLegWaistMesh: isMeshRemake, frontHalfMode, backHalfMode, viewRects }
      };
    }

    function createGeometry(options = {}) {
      const imageData = options.imageData;
      if (!imageData) throw new Error("Load an image first.");
      const sourceW = imageData.width;
      const sourceH = imageData.height;
      const cols = Math.max(8, Math.round(clampNumber(options.cols, 56, 8, 160)));
      const rows = Math.max(8, Math.round(clampNumber(options.rows, 96, 8, 220)));
      const scale = clampNumber(options.scale, 6, .5, 20);
      const depth = clampNumber(options.depth, .9, 0, 5);
      const back = clampNumber(options.back, .22, 0, 3);
      const threshold = clampNumber(options.threshold, 70, 0, 255);
      const smoothPasses = Math.round(clampNumber(options.smoothPasses, 2, 0, 8));
      const darkForeground = !!options.darkForeground;
      const sourceMode = options.sourceMode || "single";
      const buildMode = options.buildMode || "heightmap";
      const bodyPreset = options.bodyPreset || "auto";
      const sourceName = options.sourceName || "reference image";
      if (sourceMode === "sheet") {
        return createReliefGeometryFromViewSheet({ imageData, cols, rows, scale, depth, back, threshold, smoothPasses, darkForeground, buildMode, bodyPreset, sourceName });
      }
      const aspect = sourceW / Math.max(1, sourceH);
      const meshH = scale;
      const meshW = scale * aspect;
      const mask = new Array(cols * rows).fill(false);
      const heights = new Array(cols * rows).fill(0);

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const sx = (x / Math.max(1, cols - 1)) * (sourceW - 1);
          const sy = (y / Math.max(1, rows - 1)) * (sourceH - 1);
          const pixel = sampleReliefPixel(imageData, sourceW, sourceH, sx, sy);
          const inForeground = pixel.a > 24 && (darkForeground ? pixel.luma <= threshold : pixel.luma >= threshold);
          const index = y * cols + x;
          mask[index] = inForeground;
          const normalized = darkForeground
            ? Math.max(0, Math.min(1, (threshold - pixel.luma) / Math.max(1, threshold)))
            : Math.max(0, Math.min(1, (pixel.luma - threshold) / Math.max(1, 255 - threshold)));
          heights[index] = Math.pow(normalized, .75) * depth;
        }
      }
      const smoothHeights = smoothReliefHeights(heights, mask, cols, rows, smoothPasses);
      const positions = [];
      const uvs = [];
      const point = (x, y, z) => [
        (x / Math.max(1, cols - 1) - .5) * meshW,
        (.5 - y / Math.max(1, rows - 1)) * meshH,
        z
      ];
      const uv = (x, y) => [x / Math.max(1, cols - 1), 1 - y / Math.max(1, rows - 1)];
      const pushTri = (a, b, c) => {
        positions.push(...a.p, ...b.p, ...c.p);
        uvs.push(...a.uv, ...b.uv, ...c.uv);
      };
      const pushQuad = (a, b, c, d) => {
        pushTri(a, b, c);
        pushTri(a, c, d);
      };
      const frontVertex = (x, y) => ({ p: point(x, y, smoothHeights[y * cols + x]), uv: uv(x, y) });
      const backVertex = (x, y) => ({ p: point(x, y, -back), uv: uv(x, y) });
      const isValid = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows && mask[y * cols + x];

      for (let y = 0; y < rows - 1; y++) {
        for (let x = 0; x < cols - 1; x++) {
          if (!(isValid(x, y) && isValid(x + 1, y) && isValid(x + 1, y + 1) && isValid(x, y + 1))) continue;
          const a = frontVertex(x, y), b = frontVertex(x + 1, y), c = frontVertex(x + 1, y + 1), d = frontVertex(x, y + 1);
          pushQuad(a, d, c, b);
          if (back > 0) {
            const ba = backVertex(x, y), bb = backVertex(x + 1, y), bc = backVertex(x + 1, y + 1), bd = backVertex(x, y + 1);
            pushQuad(ba, bb, bc, bd);
          }
        }
      }
      if (back > 0) {
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            if (!isValid(x, y)) continue;
            if (!isValid(x, y - 1) && isValid(x + 1, y)) pushQuad(frontVertex(x, y), frontVertex(x + 1, y), backVertex(x + 1, y), backVertex(x, y));
            if (!isValid(x + 1, y) && isValid(x, y + 1)) pushQuad(frontVertex(x, y), backVertex(x, y), backVertex(x, y + 1), frontVertex(x, y + 1));
            if (!isValid(x, y + 1) && isValid(x + 1, y)) pushQuad(frontVertex(x, y), backVertex(x, y), backVertex(x + 1, y), frontVertex(x + 1, y));
            if (!isValid(x - 1, y) && isValid(x, y + 1)) pushQuad(frontVertex(x, y), frontVertex(x, y + 1), backVertex(x, y + 1), backVertex(x, y));
          }
        }
      }
      if (positions.length < 9) throw new Error("No foreground mesh was found. Try lowering/raising Threshold or toggling Dark foreground.");
      return {
        positions,
        uvs,
        meta: { mode: "single", cols, rows, sourceW, sourceH, threshold, darkForeground, smoothPasses, depth, back }
      };
    }

export {
  createGeometry,
  detectReliefViewRects as detectViewRects,
  sampleReliefPixel as samplePixel
};
