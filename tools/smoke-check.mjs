import { readFileSync } from "node:fs";
import { studioModuleOrder } from "../app/source-composer.mjs";
import { createMeshFactory } from "../app/meshes/factory.js";

const documentSource = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const moduleSources = new Map(studioModuleOrder.map(name => [
  name,
  readFileSync(new URL(`../app/modules/${name}.js`, import.meta.url), "utf8")
]));
const applicationSource = [...moduleSources.values()].join("\n");
const styleSource = readFileSync(new URL("../app/styles/studio.css", import.meta.url), "utf8");
const panelCollapseSource = readFileSync(new URL("../app/panels/panel-collapse.js", import.meta.url), "utf8");
const directBundle = readFileSync(new URL("../app/studio-v48.0.12.js", import.meta.url), "utf8");
// Preserve the existing checks while testing the new canonical modular source as
// one logical application, exactly as the Pages builder and local server do.
const html = `${documentSource}\n${styleSource}\n${panelCollapseSource}\n${applicationSource}`;

const facetedBallBuilders = {
  box: () => "box",
  facetedBallLow: () => "faceted-20",
  facetedBallMedium: () => "faceted-80",
  facetedBallHigh: () => "faceted-320"
};
const facetedBallFactory = createMeshFactory({ builders: facetedBallBuilders });
for (const [shape, expected] of [
  ["facetedBallLow", "faceted-20"],
  ["facetedBallMedium", "faceted-80"],
  ["facetedBallHigh", "faceted-320"]
]) {
  if (facetedBallFactory.shapeFactories[shape]?.() !== expected) {
    throw new Error(`${shape} must keep its registered geometry instead of falling back to box.`);
  }
}

if (!documentSource.includes('<script defer src="./app/studio-v48.0.12.js"></script>')) {
  throw new Error("index.html must load the direct-open classic studio bundle.");
}
if (documentSource.includes('type="module" src="./app/studio-v48.0.12.js') || documentSource.includes('type="importmap"')) {
  throw new Error("Direct index opening cannot depend on module loading or an import map.");
}
if (!directBundle.startsWith("/* Generated from app/modules.")) {
  throw new Error("Missing generated direct-open studio bundle.");
}
const imageToMeshGenerator = readFileSync(new URL("./image-to-mesh/generator.js", import.meta.url), "utf8");

for (const required of [
  "BoltWorks 3D AI Studio",
  "persistent-notices",
  "flex-direction: column;",
  "© 2026 Daniel Rydin",
  "BoltWorks branding and visual assets. All rights reserved.",
  "window.ModelerStudio",
  "data-local-host-only hidden",
  "detectLocalHost",
  "METERS_PER_ROBLOX_STUD",
  "ROBLOX_STUDS_PER_METER",
  "preserveDrawingBuffer: true",
  "wedge: makeWedgeGeometry",
  "hollowBox: makeHollowBoxGeometry",
  "tube: () => makeRingLikeGeometry",
  "curvedPanel: makeCurvedPanelGeometry",
  "ring: () => makeRingLikeGeometry",
  "new THREE.ExtrudeGeometry(shape",
  "makeRingShape",
  "makeArcBandShape",
  "orientExtrudedGeometry",
  "arch: makeArchGeometry",
  "hemisphere: makeHemisphereGeometry",
  "dome: () => makeHemisphereGeometry",
  "capsule: () => new THREE.CapsuleGeometry",
  "pyramid: () => {",
  "prism: makePrismGeometry",
  "tetrahedron: () => new THREE.TetrahedronGeometry",
  "pyramidFrustum: () => {",
  "facetedBallLow: () => new THREE.IcosahedronGeometry(.58, 0)",
  "facetedBallMedium: () => new THREE.IcosahedronGeometry(.58, 1)",
  "facetedBallHigh: () => new THREE.IcosahedronGeometry(.58, 2)",
  "heart: makeHeartGeometry",
  "makeHemisphereGeometry",
  "makePrismGeometry",
  "makeHeartGeometry",
  "cutSpecFromObject",
  "applyGeometryCuts",
  "clipGeometrySide",
  "top-remove",
  "bottom-cut",
  "cutSideSelect",
  "cutAmountInput",
  "cutMeshBtn",
  "cutSelectedMesh",
  "coplanarRegionBoundary",
  "insetConvexPolygon",
  "makeInsetBeveledPolygonGeometry",
  "THREE.ShapeUtils.triangulateShape(inner, [])",
  "region.boundary.length >= 3",
  "Cut the selected part",
  "View Space",
  "Shot Zoom",
  "Background &amp; Environment",
  "Road &amp; Grass",
  "Studio Floor",
  "No Ground",
  "<option value=\"plain\" selected>No Ground</option>",
  "Blue Sky",
  "Sunset",
  "Dark Studio",
  "<option value=\"plain\" selected>Neutral</option>",
  "Show Grid Overlay",
  "Use Current Zoom In Shots",
  "Hide Grid In Shots",
  "previewFrontBtn",
  "previewBackBtn",
  "previewLeftBtn",
  "previewRightBtn",
  "previewTopBtn",
  "previewIsoBtn",
  "resetZoomBtn",
  "viewSpaceInput",
  "shotSpaceInput",
  "environmentSelect",
  "backgroundSelect",
  "showGridInput",
  "useCurrentZoomInShotsInput",
  "hideGridInShotsInput",
  "viewSpaceMultiplier",
  "shotSpaceMultiplier",
  "syncGridVisibility",
  "road and grass photo environment",
  "matte studio floor",
  "photoEnvironment.visible",
  "suppressViewportEnvironment",
  "skyTexture",
  "sunsetTexture",
  ".copyright-notice",
  "updateViewScale",
  "orbit.maxDistance",
  "stair: makeStairGeometry",
  "shapeAliases",
  "Hollow Box",
  "Curved Panel",
  "Half Sphere",
  "Dome",
  "Capsule",
  "Pyramid",
  "Prism",
  "Tetrahedron",
  "Pyramid Frustum",
  "bonePlacementSection",
  "data-collapse-persist=\"bone-placement\"",
  ".compact-row.bone-axis-row",
  "grid-template-columns: auto repeat(4, minmax(42px, 1fr))",
  "#utilitiesBody {\n  overflow: visible;",
  "overflow-y: auto;",
  "direction: rtl;",
  ".left > * {\n  direction: ltr;",
  ".tree-controls {\n  display: flex;\n  gap: 8px;\n  align-items: center;\n  flex-wrap: wrap;",
  "--scene-tree-content-width: 520px;",
  "overflow-x: auto;\n  overflow-y: hidden;",
  "#addMeshBody {\n  overflow: visible;",
  "panelCollapseStoragePrefix",
  "Heart",
  "TransformControls",
  "Flip X",
  "Flip Y",
  "Flip Z",
  "data-flip-axis",
  "MTLLoader",
  "OBJExporter",
  "OrbitControls",
  "exportCollada",
  "exportColladaPackage",
  "Export Roblox Pack",
  "exportObjPartsBtn",
  "exportObjParts",
  "safeFileName",
  "Import every OBJ file as its own MeshPart in Roblox Studio.",
  "textureAssets",
  "Roblox Texture ID",
  "Mesh Details",
  "meshDetailsModal",
  "meshMaterialRuleSelect",
  "Open mesh details for",
  "materialRule",
  "Paper",
  "Upholstery",
  "Hide All",
  "Un Hide All",
  "textureRobloxAssetId",
  "reconcileTextureRobloxIds",
  "collectRobloxTextureCatalog",
  "downloadDataUrl",
  "captureViewsBtn",
  "if (data?.scene?.objects)",
  "loadProjectData(data, fileName)",
  "Save Views",
  "captureView",
  "captureViews",
  "previewShotView",
  "screenshotViewDirections",
  "toDataURL(\"image/png\")",
  "reference screenshots for AI review",
  "Selection Tool",
  "Line Tool",
  "Marker Tool",
  "Tri Editor",
  "toolbarSelectionToolsGroup",
  "toolbarLineToolsGroup",
  "toolbarMarkerToolsGroup",
  "toolbarTriEditorGroup",
  "Face edit tools",
  "Select Tri",
  "Paint",
  "paintTriInput",
  "Area Select",
  "areaTriBtn",
  "areaTriInput",
  "selectionBox",
  "Clear Tri",
  "Delete Tri",
  "Extract Tri",
  "Fill Hole",
  "Remove Marks",
  "Copy Tri",
  "Paste Tri",
  "Extend",
  "Pull",
  "Push",
  "Drag/Push",
  "dragPushBtn",
  "dragPushAxisSelect",
  "dragPushStepInput",
  "Connect",
  "connectFaceInput",
  "rotationSnapSelect",
  "applyRotationSnap",
  "setRotationSnap",
  "markerBtn",
  "clearTriBtn",
  "areaTriBtn",
  "areaTriInput",
  "deleteTriBtn",
  "extractTriBtn",
  "fillHoleBtn",
  "removeMarksBtn",
  "copyTriBtn",
  "pasteTriBtn",
  "extendFaceBtn",
  "pullFaceBtn",
  "pushFaceBtn",
  "markerGroup",
  "markerHelpers",
  "selectedFaces",
  "selectedTriangles",
  "activeTransformMode",
  "setTransformMode",
  "updateTransformAttachment",
  "flipSelectedParts",
  "mirrorMeshGeometry",
  "Mirror selected part around its own",
  "triangleLocalPoints",
  "triangleLocalUvs",
  "worldTrianglePoints",
  "worldFaceNormal",
  "makeTriangleGeometry",
  "clearSelectedTriangles",
  "makeSelectionMarker",
  "makeSelectionMarkerBatch",
  "updateTriangleHelpers",
  "markerKey",
  "removeMarkerAt",
  "clearMarkers",
  "addMarkerFromSelectedTriangle",
  "removeMarkersForSelection",
  "clearTriangleSelection",
  "deleteSelectedTriangles",
  "extractSelectedTriangles",
  "deleteMarkersByTriangleSignatures",
  "triangleSignature",
  "vertexKey",
  "faceFromLocalTriangle",
  "meshTriangleFaces",
  "localUvs",
  "setTriangleSelection",
  "selectTrianglesInScreenRect",
  "connectedTriangleFaces",
  "selectConnectedTrianglesFromHit",
  "projectWorldPointToCanvas",
  "finishAreaSelection",
  "updateSelectionBox",
  "copySelectedTriangles",
  "pasteCopiedTriangles",
  "fillSelectedHole",
  "copiedTrianglePatch",
  "makeTrianglePatchSpec",
  "patchUvs",
  "textureUrl: firstMesh.userData.textureUrl",
  "textureFlipY: firstMesh.userData.textureFlipY",
  "paintTriangleFromPointer",
  "lastPaintLogAt",
  "performance.now",
  "finishTrianglePainting",
  "spaceCameraMode",
  "Hold Space to orbit camera",
  "Area mode: drag a rectangle",
  "dblclick",
  "Camera orbit override",
  "hitFromPointerEvent",
  "localTriangle",
  "redrawMarker",
  "extendSelectedFaces",
  "moveSelectedSideVertices",
  "connectedFaceDistance",
  "faceLengthResolver",
  "Extend selected triangle side",
  "mesh.userData.shape = \"custom\"",
  "mesh.userData.geometry = geometryToData(geometry)",
  "pullSelectedFaces",
  "pushSelectedFaces",
  "makePulledSelectionSpec",
  "addTriangleBothSides",
  "addQuadBothSides",
  "pulled triangle extrusion",
  "one editable extrusion",
  "transform.setSpace(activeTransformMode === \"rotate\" ? \"local\" : \"world\")",
  "pickFace(hit, { append: event.shiftKey })",
  "pickFace(hit, { append: true, toggleExisting: false, silent: true })",
  "Finished paint selection",
  "Hold Shift to add/remove more",
  "Click Marker again on the same triangle to remove it",
  "Triangle cursor: click a mesh triangle",
  "library_images",
  "TEXCOORD",
  "bind_vertex_input",
  "<diffuse><texture",
  "exportDaeBtn",
  "OBJLoader",
  "ColladaLoader",
  "importObjText",
  "importObjFiles",
  "importObjBtn",
  "importDaeText",
  "importDaeBtn",
  "importJsonData",
  "facePickBtn",
  "bevelFaceBtn",
  "bevelTypeSelect",
  "bevelSizeInput",
  "bevelDepthInput",
  "makeInsetBeveledPanelGeometry",
  "makeGeometryDataForShape",
  "textureInfoFromMaterial",
  "applyTextureToMesh",
  "textureUrl",
  "textureBtn",
  "rotateTextureBtn",
  "flipTextureBtn",
  "textureFile",
  "Add Texture",
  "Rotate Texture",
  "Flip Texture",
  "Clear Texture",
  "textureFlipY",
  "textureRotation",
  "transformTextureUv",
  "normalizeTextureRotation(-textureRotation)",
  "geometry.setAttribute(\"uv\"",
  "manager.setURLModifier",
  "pickFace",
  "bevelSelectedFace",
  "createBevelFacePatch",
  "coplanarConnectedFaces",
  "selected.material.transparent = false",
  "selected.material.opacity = 1",
  "selected.material.wireframe = false",
  "position.getX(i) * METERS_PER_ROBLOX_STUD",
  "unitScale: ROBLOX_STUDS_PER_METER",
  "preserveScale: true"
]) {
  if (!html.includes(required)) {
    throw new Error(`Missing expected editor feature: ${required}`);
  }
}

for (const removed of [
  "A" + "I Modeler Studio",
  "window.Modeler" + "A" + "I",
  "Ol" + "lama",
  "A" + "I Train" + "ing Hooks",
  "Reward " + "score",
  "Model " + "Prompt",
  "Fix " + "Feedback",
  "Ask Ol" + "lama",
  "Run " + "Batch",
  "batch" + "RunBtn",
  "prompt" + "Input",
  "feedback" + "Input",
  "edit" + "CommandInput",
  "draft" + "PlanFromPrompt",
  "askOl" + "lamaForPlan",
  "run" + "BatchAttempts",
  "export" + "BatchDataset",
  "fitSizeBtn",
  "fitSizeInput",
  "fitModelToSize",
  "Fit Size",
  "Target max model size",
  "addQuad(positions, of1, ob1, ib1, if1)",
  "addQuad(positions, ob0, of0, if0, ib0)",
  "aria-label=\"Primitive tools\"",
  "Pick Face",
  "new THREE.PlaneGeometry(Math.max(.05, width * .92)",
  "wireframe: true"
]) {
  if (html.includes(removed)) {
    throw new Error(`Removed feature still present: ${removed}`);
  }
}

for (const brokenText of ["Â", "â", "�"]) {
  if (html.includes(brokenText)) {
    throw new Error(`Corrupted text still present: ${brokenText}`);
  }
}

for (const required of [
  'const isMeshRemake = buildMode === "meshRebuild"',
  'buildMode === "solidVisualHull"',
  "createSolidViewSheetGeometryV43",
  "occurrenceToVertex",
  "Float64Array.from(vertexX)",
  "new Uint32Array(vertexCount)",
  "sourceLikeStraightLegWaistMeshV38"
]) {
  if (!imageToMeshGenerator.includes(required)) {
    throw new Error(`Missing expected joined image-to-mesh path: ${required}`);
  }
}

for (const regression of ["restoreTriangleWinding", "repairedTriangleWinding", "meshRebuildLegacy"]) {
  if (imageToMeshGenerator.includes(regression) || html.includes(regression)) {
    throw new Error(`Relief reconstruction regression returned: ${regression}`);
  }
}

if (!documentSource.includes("BoltWorks 3D AI Studio v48.0.12 Experimental") || !documentSource.includes("v48.0.12 Experimental preview")) {
  throw new Error("The document must expose the single canonical v48.0.12 version.");
}

for (const expectedDefault of [
  'id="reliefGridXInput" type="number" min="8" max="160" step="1" value="56"',
  'id="reliefGridYInput" type="number" min="8" max="220" step="1" value="96"',
  'id="reliefThresholdInput" type="number" min="0" max="255" step="1" value="70"',
  'id="reliefSmoothInput" type="number" min="0" max="8" step="1" value="2"',
  '<option value="single">Single height image</option>',
  '<option value="sheet">View sheet to one model</option>'
]) {
  if (!html.includes(expectedDefault)) throw new Error(`Missing detailed view-sheet default: ${expectedDefault}`);
}

for (const moduleName of studioModuleOrder) {
  if (!moduleSources.get(moduleName)?.trim()) throw new Error(`Empty canonical module: ${moduleName}`);
}

for (const removedSelectionOverlayFeature of ["Select Part Overlay", "showSelectionOverlayInput", "updateSelectionGuides", "selectionGuides", "fillHolePreviewGroup", "updateFillHolePreview"]) {
  if (html.includes(removedSelectionOverlayFeature)) {
    throw new Error(`Removed selection overlay must not return: ${removedSelectionOverlayFeature}`);
  }
}
if (!moduleSources.get("meshes").includes("side: THREE.BackSide") || !moduleSources.get("meshes").includes("outline.matrix.copy(mesh.matrixWorld).scale(selectionOutlinePadding);")) {
  throw new Error("Selected objects must use a silhouette outline synchronized from the mesh world matrix.");
}
if (!moduleSources.get("panels").includes("syncSelectionOutlineTransforms();")) {
  throw new Error("The selected-object silhouette must follow transforms on every rendered frame.");
}
if (!moduleSources.get("meshes").includes("shape.absarc(0, 0, .34, 0, Math.PI, false);")) {
  throw new Error("Arch must remain one continuous extruded geometry, not disconnected mesh islands.");
}
if (!moduleSources.get("meshes").includes("setCoplanarFacePickMode(false, { activatePicker: false });")) {
  throw new Error("Object transforms must deactivate surface editing modes.");
}
if (!moduleSources.get("panels").includes("transform.visible && transform.axis")) {
  throw new Error("Gizmo pointer events must not leak through to mesh face selection.");
}

console.log("BoltWorks 3D AI Studio smoke check passed.");
