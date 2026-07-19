import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../mobile.html", import.meta.url), "utf8");

for (const required of [
  "Mobile JSON Viewer",
  "jsonInput",
  "Render",
  "Download",
  "OrbitControls",
  "shapeFactories",
  "makeWedgeGeometry",
  "makeRingLikeGeometry",
  "makeHemisphereGeometry",
  "makePrismGeometry",
  "makeHeartGeometry",
  "cutSpecFromObject",
  "applyGeometryCuts",
  "clipGeometrySide",
  "top-remove",
  "bottom-cut",
  "hollowBox",
  "curvedPanel",
  "hemisphere",
  "pyramidFrustum",
  "CapsuleGeometry",
  "TetrahedronGeometry",
  "geometryFromData",
  "normalizeJson",
  "scene.objects",
  "actions",
  "localStorage",
  "mobileModelJson",
  "frameModel",
  "downloadJson",
  "Drag orbit | pinch zoom"
]) {
  if (!html.includes(required)) {
    throw new Error(`Missing expected mobile viewer feature: ${required}`);
  }
}

console.log("Mobile JSON Viewer smoke check passed.");
