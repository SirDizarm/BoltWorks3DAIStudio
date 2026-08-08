import { readFileSync } from "node:fs";
import vm from "node:vm";
import * as THREE from "three";
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
const toolDockingSource = readFileSync(new URL("../app/panels/tool-docking.js", import.meta.url), "utf8");
const directBundle = readFileSync(new URL("../app/studio-v49.25.10.js", import.meta.url), "utf8");
const authoringManifest = JSON.parse(readFileSync(new URL("../BoltWorksStudioAi/manifest.json", import.meta.url), "utf8"));
const projectSchema = JSON.parse(readFileSync(new URL("../BoltWorksStudioAi/schemas/modeler-project.schema.json", import.meta.url), "utf8"));
const uvTopologyTest = JSON.parse(readFileSync(new URL("../samples/showcases/uv-topology-test.modelerproj", import.meta.url), "utf8"));
const panelsSource = moduleSources.get("panels") || "";
const meshesSource = moduleSources.get("meshes") || "";
const aiViewerSource = moduleSources.get("ai-viewer") || "";
// Preserve the existing checks while testing the new canonical modular source as
// one logical application, exactly as the Pages builder and local server do.
const html = `${documentSource}\n${styleSource}\n${panelCollapseSource}\n${toolDockingSource}\n${applicationSource}`;

if (!authoringManifest.machineResources?.styleLibraries?.includes("libraries/medieval-house/README.md")) {
  throw new Error("BoltWorksStudioAi manifest must expose the medieval house style library.");
}
if (!authoringManifest.machineResources?.testProtocols?.includes("../docs/MESH_TEST_CODES.md")) {
  throw new Error("BoltWorksStudioAi manifest must expose the shared mesh test code protocol.");
}
if (!projectSchema.$defs?.object?.properties?.opacity || !projectSchema.$defs?.editor?.properties?.cameraViews) {
  throw new Error("Project schema must describe transparent materials and custom camera views.");
}
if (
  ["cameraControlsOpenBtn", "modelToolsOpenBtn", "outputToolsOpenBtn"].some(id => (
    panelsSource.includes(`${id}?.classList.toggle("active"`)
    || !panelsSource.includes(`${id}?.classList.remove("active")`)
  ))
  || meshesSource.includes('surfaceEditorOpenBtn?.classList.toggle("active"')
  || !meshesSource.includes('surfaceEditorOpenBtn?.classList.remove("active")')
) {
  throw new Error("Dock-section shortcuts must remain momentary launchers instead of persistent active tools.");
}
const uvTestTexture = uvTopologyTest.textureLibrary?.find(texture => texture.name === "UV Topology Grid A1-D4");
const uvTestObject = uvTopologyTest.scene?.objects?.find(object => object.id === "uv-test-main-block");
if (
  uvTopologyTest.kind !== "modeler-project"
  || !uvTestTexture?.dataUrl?.startsWith("data:image/svg+xml;base64,")
  || uvTestObject?.textureName !== uvTestTexture.name
  || uvTopologyTest.editor?.selectedId !== uvTestObject.id
) {
  throw new Error("The UV topology test project must embed its diagnostic texture and select the editable block.");
}

function functionSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`Missing ${name} in the mesh module.`);
  const parametersStart = source.indexOf("(", start);
  let parameterDepth = 0;
  let parametersEnd = -1;
  for (let index = parametersStart; index < source.length; index++) {
    if (source[index] === "(") parameterDepth++;
    if (source[index] === ")") parameterDepth--;
    if (parameterDepth === 0) {
      parametersEnd = index;
      break;
    }
  }
  const bodyStart = source.indexOf("{", parametersEnd);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index++) {
    if (source[index] === "{") depth++;
    if (source[index] === "}") depth--;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Could not isolate ${name} from the mesh module.`);
}

{
  const context = {};
  vm.createContext(context);
  vm.runInContext([
    "finiteNumber",
    "humanize",
    "eventTitle",
    "detailText",
    "eventObjectIds"
  ].map(name => functionSource(aiViewerSource, name)).join("\n"), context);

  const schemaEvent = {
    label: "Moved reference mesh",
    targetIds: ["mesh-a", "mesh-b"],
    details: { objectIds: ["legacy-id"] }
  };
  const schemaIds = Array.from(context.eventObjectIds(schemaEvent));
  if (JSON.stringify(schemaIds) !== JSON.stringify(["mesh-a", "mesh-b"])) {
    throw new Error("AI Viewer must prefer schema-level event targetIds over legacy detail fields.");
  }
  const schemaDetail = context.detailText(schemaEvent);
  if (!schemaDetail.includes("2 objects: mesh-a, mesh-b")) {
    throw new Error("AI Viewer event details must describe schema-level targetIds.");
  }

  const legacyIds = Array.from(context.eventObjectIds({ details: { affectedObjectIds: ["legacy-a"] } }));
  if (JSON.stringify(legacyIds) !== JSON.stringify(["legacy-a"])) {
    throw new Error("AI Viewer must retain legacy nested object-ID compatibility.");
  }
}

function createUvBridgeFixture() {
  const positions = [];
  const uvs = [];
  for (const { centerZ, removedNormalZ } of [
    { centerZ: -1.5, removedNormalZ: 1 },
    { centerZ: 1.5, removedNormalZ: -1 }
  ]) {
    const source = new THREE.BoxGeometry(2, 2, 2).toNonIndexed();
    const position = source.getAttribute("position");
    const uv = source.getAttribute("uv");
    for (let index = 0; index + 2 < position.count; index += 3) {
      const points = [0, 1, 2].map(offset => new THREE.Vector3(
        position.getX(index + offset),
        position.getY(index + offset),
        position.getZ(index + offset) + centerZ
      ));
      const normal = new THREE.Vector3().crossVectors(
        points[1].clone().sub(points[0]),
        points[2].clone().sub(points[0])
      ).normalize();
      if (normal.z * removedNormalZ > 0.9) continue;
      positions.push(...points.flatMap(point => point.toArray()));
      for (const offset of [0, 1, 2]) uvs.push(uv.getX(index + offset), uv.getY(index + offset));
    }
    source.dispose();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  return geometry;
}

function createOpenUvCubeFixture() {
  const source = new THREE.BoxGeometry(2, 2, 2).toNonIndexed();
  const position = source.getAttribute("position");
  const uv = source.getAttribute("uv");
  const positions = [];
  const uvs = [];
  for (let index = 0; index < position.count; index += 3) {
    const points = [0, 1, 2].map(offset => new THREE.Vector3(
      position.getX(index + offset), position.getY(index + offset), position.getZ(index + offset)
    ));
    const normal = new THREE.Vector3().crossVectors(
      points[1].clone().sub(points[0]), points[2].clone().sub(points[0])
    ).normalize();
    if (normal.y > .9) continue;
    positions.push(...points.flatMap(point => point.toArray()));
    for (const offset of [0, 1, 2]) uvs.push(uv.getX(index + offset), uv.getY(index + offset));
  }
  source.dispose();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.addGroup(0, positions.length / 3, 2);
  return geometry;
}

function createSingleTriangleUvHoleFixture() {
  const source = new THREE.BoxGeometry(2, 2, 2).toNonIndexed();
  const position = source.getAttribute("position");
  const uv = source.getAttribute("uv");
  const positions = [];
  const uvs = [];
  const removedUvsByKey = new Map();
  let removed = false;
  for (let index = 0; index < position.count; index += 3) {
    const points = [0, 1, 2].map(offset => new THREE.Vector3(
      position.getX(index + offset), position.getY(index + offset), position.getZ(index + offset)
    ));
    const normal = new THREE.Vector3().crossVectors(
      points[1].clone().sub(points[0]), points[2].clone().sub(points[0])
    ).normalize();
    if (!removed && normal.y > .9) {
      points.forEach((point, offset) => removedUvsByKey.set(
        point.toArray().map(value => Number(value.toFixed(4))).join(","),
        new THREE.Vector2(uv.getX(index + offset), uv.getY(index + offset))
      ));
      removed = true;
      continue;
    }
    positions.push(...points.flatMap(point => point.toArray()));
    for (const offset of [0, 1, 2]) uvs.push(uv.getX(index + offset), uv.getY(index + offset));
  }
  source.dispose();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.addGroup(0, positions.length / 3, 2);
  return { geometry, removedUvsByKey };
}

{
  const messages = [];
  const history = [];
  const context = {
    THREE,
    round: (value, places = 4) => Number(Number(value).toFixed(places)),
    selectedSurfaceEdges: [],
    selectedSurfaceVertices: [],
    selectedFaces: [],
    selectedFace: null,
    geometryFromPositions(positions) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geometry.computeVertexNormals();
      geometry.computeBoundingSphere();
      return geometry;
    },
    recordHistory: label => history.push(label),
    replaceEditableMeshGeometry: (mesh, geometry) => { mesh.geometry = geometry; },
    surfaceEdgeKey: (mesh, a, b) => `${mesh.userData.id}:${context.localEdgeSignature(a, b)}`,
    updateFaceMarker() {},
    updateSurfaceComponentMarker() {},
    updateAll() {},
    syncSurfaceEditorUi() {},
    updateSurfaceGizmoAttachment() {},
    log: (message, details) => messages.push({ message, details })
  };
  vm.createContext(context);
  vm.runInContext([
    "vertexKey",
    "localEdgeSignature",
    "topologyEdgeCounts",
    "bridgeBoundaryTopology",
    "alignBridgeBoundaryLoops",
    "bridgeSelectedEdgeLoops"
  ].map(name => functionSource(meshesSource, name)).join("\n"), context);

  const mesh = {
    name: "Automated UV bridge box",
    userData: { id: "automated-uv-bridge-box" },
    geometry: createUvBridgeFixture()
  };
  const before = context.bridgeBoundaryTopology(mesh.geometry.clone());
  if (before.loops.length !== 2 || before.loops.some(loop => loop.points.length !== 4)) {
    throw new Error("Bridge regression fixture must contain two four-vertex boundary loops.");
  }
  context.selectedSurfaceEdges.push(...before.loops.map(loop => ({
    mesh,
    localA: loop.points[0].clone(),
    localB: loop.points[1].clone()
  })));
  const fixtureAlignment = context.alignBridgeBoundaryLoops(before.loops[0], before.loops[1]);
  const fixtureSourcePosition = mesh.geometry.getAttribute("position");
  const fixtureTriangles = [];
  for (let index = 0; index + 2 < fixtureSourcePosition.count; index += 3) {
    fixtureTriangles.push([0, 1, 2].map(offset => context.vertexKey(new THREE.Vector3(
      fixtureSourcePosition.getX(index + offset),
      fixtureSourcePosition.getY(index + offset),
      fixtureSourcePosition.getZ(index + offset)
    ))));
  }
  for (let index = 0; index < fixtureAlignment.loopA.points.length; index++) {
    const next = (index + 1) % fixtureAlignment.loopA.points.length;
    const a = context.vertexKey(fixtureAlignment.loopA.points[index]);
    const aNext = context.vertexKey(fixtureAlignment.loopA.points[next]);
    const b = context.vertexKey(fixtureAlignment.loopB.points[index]);
    const bNext = context.vertexKey(fixtureAlignment.loopB.points[next]);
    fixtureTriangles.push([a, b, aNext], [aNext, b, bNext]);
  }
  const fixtureEdgeCounts = context.topologyEdgeCounts(fixtureTriangles);
  const bridged = context.bridgeSelectedEdgeLoops();
  const bridgeLog = messages.at(-1);
  const bridgedPosition = mesh.geometry.getAttribute("position");
  const bridgedUv = mesh.geometry.getAttribute("uv");
  const triangles = [];
  for (let index = 0; index + 2 < bridgedPosition.count; index += 3) {
    triangles.push([0, 1, 2].map(offset => context.vertexKey(new THREE.Vector3(
      bridgedPosition.getX(index + offset),
      bridgedPosition.getY(index + offset),
      bridgedPosition.getZ(index + offset)
    ))));
  }
  const finalEdgeCounts = context.topologyEdgeCounts(triangles);
  if (
    bridged !== mesh
    || history.join(",") !== "bridge edge loops"
    || bridgeLog?.details?.createdTriangles !== 8
    || bridgeLog?.details?.remainingBoundaryEdges !== 0
    || bridgeLog?.details?.uvExtended !== true
    || bridgedPosition.count !== 84
    || bridgedUv?.count !== bridgedPosition.count
    || context.selectedSurfaceEdges.length !== 4
    || [...finalEdgeCounts.values()].some(count => count !== 2)
  ) {
    throw new Error(`Bridge Edge Loops must close two square UV boundary loops with four manifold quads. ${JSON.stringify({
      returnedMesh: bridged === mesh,
      history,
      bridgeDetails: bridgeLog?.details,
      positionCount: bridgedPosition.count,
      uvCount: bridgedUv?.count,
      selectedEdges: context.selectedSurfaceEdges.length,
      nonTwoManifoldEdges: [...finalEdgeCounts.values()].filter(count => count !== 2).length,
      fixtureNonTwoEdges: [...fixtureEdgeCounts.entries()].filter(([, count]) => count !== 2),
      loops: before.loops.map(loop => loop.keys),
      aligned: [fixtureAlignment.loopA.keys, fixtureAlignment.loopB.keys]
    })}`);
  }
}

{
  const context = {
    THREE,
    round: (value, places = 4) => Number(Number(value).toFixed(places)),
    triangleCenter(points) {
      return points.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / points.length);
    }
  };
  vm.createContext(context);
  vm.runInContext([
    "vertexKey",
    "bridgeBoundaryTopology",
    "basisFromPoints",
    "segmentsIntersect2d",
    "materialIndexForTriangle",
    "holeRepairPlanarUvs",
    "holeRepairAdjacentSurfaceUvs",
    "safeHoleCapPlan",
    "geometryWithHoleCaps",
    "topologyEdgeCounts"
  ].map(name => functionSource(meshesSource, name)).join("\n"), context);
  const source = createOpenUvCubeFixture();
  const before = context.bridgeBoundaryTopology(source);
  const loop = before.loops[0];
  const plan = context.safeHoleCapPlan(source, loop);
  const autoUvs = context.holeRepairPlanarUvs(loop.points, new THREE.Vector3(0, 1, 0), { projection: "auto" });
  const rotatedUvs = context.holeRepairPlanarUvs(loop.points, new THREE.Vector3(0, 1, 0), { projection: "y", rotation: 90 });
  const stableWorldProjection = autoUvs.every((uvPoint, index) => {
    const point = loop.points[index];
    return Math.abs(uvPoint.x - (point.x + 1) / 2) < 1e-6
      && Math.abs(uvPoint.y - (point.z + 1) / 2) < 1e-6;
  });
  const rotationWorks = rotatedUvs.every((uvPoint, index) =>
    Math.abs(uvPoint.x - (1 - autoUvs[index].y)) < 1e-6
    && Math.abs(uvPoint.y - autoUvs[index].x) < 1e-6);
  const repaired = context.geometryWithHoleCaps(source, [{ loop, plan }]);
  const after = context.bridgeBoundaryTopology(repaired);
  const position = repaired.getAttribute("position");
  const uv = repaired.getAttribute("uv");
  const triangles = [];
  for (let index = 0; index < position.count; index += 3) {
    triangles.push([0, 1, 2].map(offset => context.vertexKey(new THREE.Vector3(
      position.getX(index + offset), position.getY(index + offset), position.getZ(index + offset)
    ))));
  }
  const edgeCounts = context.topologyEdgeCounts(triangles);
  if (
    before.loops.length !== 1
    || loop?.points.length !== 4
    || !plan.safe
    || !stableWorldProjection
    || !rotationWorks
    || plan.materialIndex !== 2
    || after.loops.length !== 0
    || position.count !== 36
    || uv?.count !== position.count
    || repaired.groups.at(-1)?.materialIndex !== 2
    || [...edgeCounts.values()].some(count => count !== 2)
  ) {
    throw new Error(`Find and Repair Holes must cap one UV cube opening inside the same manifold mesh. ${JSON.stringify({
      beforeHoles: before.loops.length,
      boundaryVertices: loop?.points.length,
      safe: plan.safe,
      reason: plan.reason,
      stableWorldProjection,
      rotationWorks,
      materialIndex: plan.materialIndex,
      afterHoles: after.loops.length,
      positionCount: position.count,
      uvCount: uv?.count,
      finalMaterial: repaired.groups.at(-1)?.materialIndex,
      invalidEdges: [...edgeCounts.values()].filter(count => count !== 2).length
    })}`);
  }
  source.dispose();
  repaired.dispose();

  const singleTriangleFixture = createSingleTriangleUvHoleFixture();
  const triangleSource = singleTriangleFixture.geometry;
  const triangleBefore = context.bridgeBoundaryTopology(triangleSource);
  const triangleLoop = triangleBefore.loops[0];
  const trianglePlan = context.safeHoleCapPlan(triangleSource, triangleLoop, { projection: "auto" });
  const inheritedUvMatches = triangleLoop.keys.every((key, index) => {
    const expected = singleTriangleFixture.removedUvsByKey.get(key);
    return expected && trianglePlan.planarUvs[index].distanceTo(expected) < 1e-6;
  });
  const explicitPlan = context.safeHoleCapPlan(triangleSource, triangleLoop, { projection: "y" });
  const triangleRepaired = context.geometryWithHoleCaps(triangleSource, [{ loop: triangleLoop, plan: trianglePlan }]);
  const triangleAfter = context.bridgeBoundaryTopology(triangleRepaired);
  if (
    triangleBefore.loops.length !== 1
    || triangleLoop?.points.length !== 3
    || !trianglePlan.safe
    || trianglePlan.uvSource !== "adjacent-face"
    || !inheritedUvMatches
    || explicitPlan.uvSource !== "planar-projection"
    || triangleAfter.loops.length !== 0
  ) {
    throw new Error(`A repaired triangle must inherit UV scale and alignment from its coplanar neighbor. ${JSON.stringify({
      beforeHoles: triangleBefore.loops.length,
      boundaryVertices: triangleLoop?.points.length,
      safe: trianglePlan.safe,
      uvSource: trianglePlan.uvSource,
      inheritedUvMatches,
      explicitUvSource: explicitPlan.uvSource,
      afterHoles: triangleAfter.loops.length
    })}`);
  }
  triangleSource.dispose();
  triangleRepaired.dispose();
}

{
  const context = { THREE };
  vm.createContext(context);
  vm.runInContext(functionSource(meshesSource, "transformUvPointAroundCenter"), context);
  const center = new THREE.Vector2(.5, .5);
  const source = new THREE.Vector2(.75, .25);
  const left = context.transformUvPointAroundCenter(source, center, { rotation: 90 });
  const right = context.transformUvPointAroundCenter(source, center, { rotation: -90 });
  const horizontal = context.transformUvPointAroundCenter(source, center, { flipU: true });
  const vertical = context.transformUvPointAroundCenter(source, center, { flipV: true });
  const same = (actual, expected) => actual.distanceTo(expected) < 1e-8;
  if (
    !same(left, new THREE.Vector2(.75, .75))
    || !same(right, new THREE.Vector2(.25, .25))
    || !same(horizontal, new THREE.Vector2(.25, .25))
    || !same(vertical, new THREE.Vector2(.75, .75))
  ) {
    throw new Error("Selected Face UV must rotate and flip UV corners around the selected region center without changing geometry.");
  }
}

{
  const context = {
    THREE,
    round: (value, places = 4) => Number(Number(value).toFixed(places))
  };
  vm.createContext(context);
  vm.runInContext([
    "vertexKey",
    "meshIntegrityReport"
  ].map(name => functionSource(meshesSource, name)).join("\n"), context);

  const closedCube = new THREE.BoxGeometry(2, 2, 2).toNonIndexed();
  const closedReport = context.meshIntegrityReport(closedCube);
  const openCube = createSingleTriangleUvHoleFixture().geometry;
  const openReport = context.meshIntegrityReport(openCube);
  const nonManifold = new THREE.BufferGeometry();
  nonManifold.setAttribute("position", new THREE.Float32BufferAttribute([
    0, 0, 0, 1, 0, 0, 0, 1, 0,
    1, 0, 0, 0, 0, 0, 0, -1, 0,
    0, 0, 0, 1, 0, 0, 0, 0, 1
  ], 3));
  const nonManifoldReport = context.meshIntegrityReport(nonManifold);
  const bowTie = new THREE.BufferGeometry();
  bowTie.setAttribute("position", new THREE.Float32BufferAttribute([
    0, 0, 0, 1, 0, 0, 0, 1, 0,
    0, 0, 0, -1, 0, 0, 0, -1, 0
  ], 3));
  const bowTieReport = context.meshIntegrityReport(bowTie);
  if (
    !closedReport.closed
    || !closedReport.manifold
    || closedReport.issues.length
    || openReport.boundaryEdges !== 3
    || nonManifoldReport.nonManifoldEdges !== 1
    || bowTieReport.nonManifoldVertices !== 1
  ) {
    throw new Error(`Non-manifold Check must distinguish closed, open, triple-edge, and disconnected-fan topology. ${JSON.stringify({
      closed: closedReport,
      openBoundaryEdges: openReport.boundaryEdges,
      nonManifoldEdges: nonManifoldReport.nonManifoldEdges,
      nonManifoldVertices: bowTieReport.nonManifoldVertices
    })}`);
  }
  closedCube.dispose();
  openCube.dispose();
  nonManifold.dispose();
  bowTie.dispose();
}

{
  const context = { THREE };
  vm.createContext(context);
  vm.runInContext([
    "topologyEdgeCounts",
    "topologyIsClosedTriangleMesh",
    "materialIndexForTriangle",
    "removeDoublesPreciseKey",
    "removeDoublesPlan",
    "geometryFromWeldedTriangles"
  ].map(name => functionSource(meshesSource, name)).join("\n"), context);

  const fixture = new THREE.BufferGeometry();
  fixture.setAttribute("position", new THREE.Float32BufferAttribute([
    0, 0, 0, 1, 0, 0, 1, 1, 0,
    .0004, 0, 0, 1.0004, 1, 0, 0, 1, 0
  ], 3));
  const fixtureUvs = [
    0, 0, 1, 0, 1, 1,
    .1, .1, .9, .9, 0, 1
  ];
  fixture.setAttribute("uv", new THREE.Float32BufferAttribute(fixtureUvs, 2));
  fixture.addGroup(0, 3, 1);
  fixture.addGroup(3, 3, 2);
  const plan = context.removeDoublesPlan(fixture, .001);
  const unchangedPlan = context.removeDoublesPlan(fixture, .0001);
  if (
    !plan.safe
    || plan.mergedVertices !== 2
    || plan.clusters !== 2
    || plan.beforeTriangles !== 2
    || plan.afterTriangles !== 2
    || unchangedPlan.changed
  ) {
    throw new Error(`Remove Doubles must merge only distinct nearby logical positions inside tolerance. ${JSON.stringify({
      mergedVertices: plan.mergedVertices,
      clusters: plan.clusters,
      safe: plan.safe,
      unchangedAtSmallerTolerance: !unchangedPlan.changed
    })}`);
  }
  const repaired = context.geometryFromWeldedTriangles(fixture, plan.triangles);
  const repairedUvs = [...repaired.getAttribute("uv").array];
  if (
    repaired.getAttribute("position").count !== 6
    || repairedUvs.some((value, index) => Math.abs(value - fixtureUvs[index]) > 1e-6)
    || repaired.groups.length !== 2
    || repaired.groups[0].materialIndex !== 1
    || repaired.groups[1].materialIndex !== 2
  ) {
    throw new Error("Remove Doubles must preserve per-corner UVs and material groups while snapping geometry.");
  }

  const blocked = new THREE.BufferGeometry();
  blocked.setAttribute("position", new THREE.Float32BufferAttribute([
    0, 0, 0, 1, 0, 0, 0, 1, 0,
    1.0002, 0, 0, .0002, 0, 0, 0, -1, 0,
    .0004, 0, 0, 1.0004, 0, 0, 0, 0, 1
  ], 3));
  const blockedPlan = context.removeDoublesPlan(blocked, .001);
  if (blockedPlan.safe || blockedPlan.nonManifoldEdgeCount !== 1) {
    throw new Error("Remove Doubles must reject a merge that would create an edge shared by three triangles.");
  }
  fixture.dispose();
  repaired.dispose();
  blocked.dispose();
}

{
  const context = {
    THREE,
    round: (value, places = 4) => Number(Number(value).toFixed(places))
  };
  vm.createContext(context);
  vm.runInContext([
    "vertexKey",
    "meshIntegrityReport",
    "topologyEdgeCounts",
    "meshStatisticsReport"
  ].map(name => functionSource(meshesSource, name)).join("\n"), context);
  const cube = new THREE.BoxGeometry(2, 4, 6);
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(10, 20, 30),
    new THREE.Quaternion(),
    new THREE.Vector3(2, .5, 1)
  );
  const stats = context.meshStatisticsReport(cube, matrix);
  const openCube = createSingleTriangleUvHoleFixture().geometry;
  const openStats = context.meshStatisticsReport(openCube, new THREE.Matrix4());
  const closeVector = (actual, expected) => actual.distanceTo(expected) < 1e-8;
  if (
    stats.triangles !== 12
    || stats.weldedVertices !== 8
    || stats.uniqueEdges !== 18
    || !stats.closed
    || !stats.manifold
    || !stats.volumeReliable
    || Math.abs(stats.localVolume - 48) > 1e-8
    || Math.abs(stats.worldVolume - 48) > 1e-8
    || !closeVector(stats.localSize, new THREE.Vector3(2, 4, 6))
    || !closeVector(stats.worldSize, new THREE.Vector3(4, 2, 6))
    || stats.uvChannels.join(",") !== "uv"
    || stats.approximateGeometryBytes <= 0
    || openStats.boundaryEdges !== 3
    || openStats.volumeReliable
    || openStats.worldVolume !== null
  ) {
    throw new Error(`Mesh Statistics must report indexed geometry, transformed dimensions, reliable closed volume, UV data, memory, and open topology correctly. ${JSON.stringify({
      triangles: stats.triangles,
      weldedVertices: stats.weldedVertices,
      uniqueEdges: stats.uniqueEdges,
      localSize: stats.localSize.toArray(),
      worldSize: stats.worldSize.toArray(),
      localVolume: stats.localVolume,
      worldVolume: stats.worldVolume,
      openBoundaryEdges: openStats.boundaryEdges,
      openVolumeReliable: openStats.volumeReliable
    })}`);
  }
  cube.dispose();
  openCube.dispose();
}

{
  const context = { THREE };
  vm.createContext(context);
  vm.runInContext([
    "topologyEdgeCounts",
    "topologyIsClosedTriangleMesh",
    "materialIndexForTriangle",
    "removeDoublesPreciseKey",
    "geometryFromWeldedTriangles",
    "decimateNormalizedSettings",
    "decimateAttributeKey",
    "protectedDecimatePlan"
  ].map(name => functionSource(meshesSource, name)).join("\n"), context);
  const source = new THREE.PlaneGeometry(4, 4, 6, 6).toNonIndexed();
  const beforeUvs = !!source.getAttribute("uv");
  const plan = context.protectedDecimatePlan(source, {
    reduction: 35,
    featureAngle: 35,
    preserveBoundaries: true,
    preserveUvSeams: true,
    preserveMaterials: true
  });
  if (
    !plan.safe
    || plan.afterTriangles >= plan.beforeTriangles
    || plan.removedTriangles <= 0
    || plan.boundaryEdgesAfter > plan.boundaryEdgesBefore
    || plan.nonManifoldEdges !== 0
  ) {
    throw new Error(`Protected Decimate must reduce a dense surface while retaining its boundary and manifold edge safety. ${JSON.stringify({
      safe: plan.safe,
      beforeTriangles: plan.beforeTriangles,
      afterTriangles: plan.afterTriangles,
      boundaryEdgesBefore: plan.boundaryEdgesBefore,
      boundaryEdgesAfter: plan.boundaryEdgesAfter,
      nonManifoldEdges: plan.nonManifoldEdges,
      reason: plan.reason
    })}`);
  }
  const result = context.geometryFromWeldedTriangles(source, plan.triangles);
  if (
    !beforeUvs
    || !result.getAttribute("uv")
    || result.getAttribute("uv").count !== result.getAttribute("position").count
  ) {
    throw new Error("Protected Decimate must preserve per-corner UV data on every surviving triangle.");
  }
  source.dispose();
  result.dispose();
}

{
  const context = { THREE };
  vm.createContext(context);
  vm.runInContext([
    "topologyEdgeCounts",
    "topologyIsClosedTriangleMesh",
    "materialIndexForTriangle",
    "removeDoublesPreciseKey",
    "geometryFromWeldedTriangles",
    "decimateNormalizedSettings",
    "decimateAttributeKey",
    "protectedDecimatePlan",
    "lodNormalizedSettings",
    "buildProtectedLodPlan"
  ].map(name => functionSource(meshesSource, name)).join("\n"), context);
  const source = new THREE.SphereGeometry(2, 24, 16).toNonIndexed();
  const originalPositions = [...source.getAttribute("position").array];
  const plan = context.buildProtectedLodPlan(source, {
    lod1: 10,
    lod2: 25,
    lod3: 65,
    featureAngle: 50,
    preserveBoundaries: true,
    preserveUvSeams: true,
    preserveMaterials: true,
    hideGenerated: true
  });
  const counts = [plan.originalTriangles, ...plan.levels.map(level => level.triangleCount)];
  const strictlyDescending = counts.every((count, index) => index === 0 || count < counts[index - 1]);
  const retainedUvs = plan.levels.every(level => {
    const position = level.geometry.getAttribute("position");
    const uv = level.geometry.getAttribute("uv");
    return !!uv && uv.count === position.count;
  });
  if (
    !plan.safe
    || plan.levels.length !== 3
    || !strictlyDescending
    || !retainedUvs
    || !plan.reason.includes("4 models total")
    || !plan.reason.includes("LOD0 Original")
    || !plan.reason.includes("LOD1 Preview")
    || source.getAttribute("position").array.some((value, index) => value !== originalPositions[index])
  ) {
    throw new Error(`LOD Generator must produce three progressively lighter UV-safe geometries without changing LOD0. ${JSON.stringify({
      safe: plan.safe,
      levels: plan.levels.length,
      counts,
      retainedUvs,
      reason: plan.reason
    })}`);
  }
  plan.levels.forEach(level => level.geometry.dispose());
  source.dispose();
}

{
  const context = { THREE, round: (value, places = 4) => Number(Number(value).toFixed(places)) };
  vm.createContext(context);
  vm.runInContext([
    "vertexKey",
    "materialIndexForTriangle",
    "uvUnwrapNormalizedSettings",
    "smartUvProjection",
    "buildSmartUvLayoutPlan"
  ].map(name => functionSource(meshesSource, name)).join("\n"), context);
  const source = new THREE.BoxGeometry(2, 2, 2).toNonIndexed();
  const originalPositions = [...source.getAttribute("position").array];
  const plan = context.buildSmartUvLayoutPlan(source, { seamAngle: 45, padding: 2, atlasSize: 1024 });
  const uvValues = plan.uvs ? [...plan.uvs] : [];
  const packedOverlap = plan.islands.some((island, index) => plan.islands.slice(index + 1).some(other => {
    const a = island.packedBounds;
    const b = other.packedBounds;
    return a.minU < b.maxU - 1e-7 && a.maxU > b.minU + 1e-7 && a.minV < b.maxV - 1e-7 && a.maxV > b.minV + 1e-7;
  }));
  if (
    !plan.safe
    || plan.triangleCount !== 12
    || plan.islands.length !== 6
    || uvValues.length !== source.getAttribute("position").count * 2
    || uvValues.some(value => !Number.isFinite(value) || value < 0 || value > 1)
    || packedOverlap
    || source.getAttribute("position").array.some((value, index) => value !== originalPositions[index])
  ) {
    throw new Error(`UV Unwrap must pack six cube faces into finite, non-overlapping islands without changing source geometry. ${JSON.stringify({
      safe: plan.safe,
      triangles: plan.triangleCount,
      islands: plan.islands.length,
      packedOverlap
    })}`);
  }
  plan.sourceGeometry.dispose();
  source.dispose();
}

{
  const messages = [];
  const history = [];
  const context = {
    THREE,
    round: (value, places = 4) => Number(Number(value).toFixed(places)),
    selected: null,
    selectedFace: null,
    selectedFaces: [],
    selectedSurfaceEdges: [],
    selectedSurfaceVertices: [],
    recordHistory: label => history.push(label),
    replaceEditableMeshGeometry: (mesh, geometry) => { mesh.geometry = geometry; },
    clearSelectedSurfaceComponents() {
      context.selectedSurfaceEdges.length = 0;
      context.selectedSurfaceVertices.length = 0;
    },
    updateFaceMarker() {},
    updateAll() {},
    syncSurfaceEditorUi() {},
    updateSurfaceGizmoAttachment() {},
    log: (message, details) => messages.push({ message, details })
  };
  vm.createContext(context);
  vm.runInContext([
    "vertexKey",
    "swapAttributeVertices",
    "normalEditTargetMesh",
    "swapTriangleCorners",
    "finishNormalEdit",
    "flipSelectedFaceNormals",
    "recalculateSelectedMeshNormals"
  ].map(name => functionSource(meshesSource, name)).join("\n"), context);

  const repairGeometry = new THREE.BoxGeometry(2, 2, 2).toNonIndexed();
  context.swapTriangleCorners(repairGeometry, 0);
  const repairMesh = {
    isMesh: true,
    name: "Automated normals repair box",
    geometry: repairGeometry
  };
  context.selected = repairMesh;
  const repaired = context.recalculateSelectedMeshNormals();
  const repairedPosition = repairMesh.geometry.getAttribute("position");
  const repairedUv = repairMesh.geometry.getAttribute("uv");
  const directedEdges = new Map();
  let signedVolume = 0;
  for (let index = 0; index + 2 < repairedPosition.count; index += 3) {
    const points = [0, 1, 2].map(offset => new THREE.Vector3(
      repairedPosition.getX(index + offset),
      repairedPosition.getY(index + offset),
      repairedPosition.getZ(index + offset)
    ));
    const keys = points.map(context.vertexKey);
    for (const [fromIndex, toIndex] of [[0, 1], [1, 2], [2, 0]]) {
      const from = keys[fromIndex];
      const to = keys[toIndex];
      const signature = [from, to].sort().join("|");
      if (!directedEdges.has(signature)) directedEdges.set(signature, []);
      directedEdges.get(signature).push(`${from}>${to}`);
    }
    signedVolume += points[0].dot(new THREE.Vector3().crossVectors(points[1], points[2])) / 6;
  }
  const inconsistentEdges = [...directedEdges.entries()].filter(([, directions]) => (
    directions.length !== 2 || directions[0] === directions[1]
  ));
  const repairLog = messages.at(-1);
  if (
    repaired !== repairMesh
    || history.at(-1) !== "recalculate outside normals"
    || repairLog?.details?.flippedTriangles < 1
    || repairLog?.details?.closedComponents !== 1
    || repairLog?.details?.uvPreserved !== true
    || repairedUv?.count !== repairedPosition.count
    || inconsistentEdges.length
    || signedVolume <= 0
  ) {
    throw new Error(`Recalculate Outside must restore consistent outward winding without losing UVs. ${JSON.stringify({
      returnedMesh: repaired === repairMesh,
      history,
      details: repairLog?.details,
      inconsistentEdges: inconsistentEdges.length,
      signedVolume,
      uvCount: repairedUv?.count,
      positionCount: repairedPosition.count
    })}`);
  }

  const flipGeometry = new THREE.BoxGeometry(2, 2, 2).toNonIndexed();
  const beforePosition = flipGeometry.getAttribute("position");
  const beforeUv = flipGeometry.getAttribute("uv");
  const expectedSecond = [beforePosition.getX(2), beforePosition.getY(2), beforePosition.getZ(2)];
  const expectedThird = [beforePosition.getX(1), beforePosition.getY(1), beforePosition.getZ(1)];
  const expectedUvSecond = [beforeUv.getX(2), beforeUv.getY(2)];
  const expectedUvThird = [beforeUv.getX(1), beforeUv.getY(1)];
  const flipMesh = { isMesh: true, name: "Automated face flip box", geometry: flipGeometry };
  context.selected = flipMesh;
  context.selectedFaces.push({ mesh: flipMesh, faceIndex: 0 });
  context.selectedFace = context.selectedFaces[0];
  const flipped = context.flipSelectedFaceNormals();
  const flippedPosition = flipMesh.geometry.getAttribute("position");
  const flippedUv = flipMesh.geometry.getAttribute("uv");
  const actualSecond = [flippedPosition.getX(1), flippedPosition.getY(1), flippedPosition.getZ(1)];
  const actualThird = [flippedPosition.getX(2), flippedPosition.getY(2), flippedPosition.getZ(2)];
  const actualUvSecond = [flippedUv.getX(1), flippedUv.getY(1)];
  const actualUvThird = [flippedUv.getX(2), flippedUv.getY(2)];
  if (
    flipped !== flipMesh
    || history.at(-1) !== "flip selected face normals"
    || JSON.stringify(actualSecond) !== JSON.stringify(expectedSecond)
    || JSON.stringify(actualThird) !== JSON.stringify(expectedThird)
    || JSON.stringify(actualUvSecond) !== JSON.stringify(expectedUvSecond)
    || JSON.stringify(actualUvThird) !== JSON.stringify(expectedUvThird)
  ) {
    throw new Error("Flip Selected Faces must reverse the selected winding and its per-corner UVs as one undoable edit.");
  }
}

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

if (!documentSource.includes('<script defer src="./app/studio-v49.25.10.js?v=49.25.10"></script>')) {
  throw new Error("index.html must load the direct-open classic studio bundle.");
}
if (applicationSource.includes('camera.up.set(0, viewName === "top" ? 0 : 1')) {
  throw new Error("Top view must not replace the OrbitControls world-up axis.");
}
if (documentSource.includes('type="module" src="./app/studio-v49.25.10.js') || documentSource.includes('type="importmap"')) {
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
  "tool-docking.js?v=49.25.10",
  "function dockBoltWorksToolGroups",
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
  "loftCheckedBtn",
  "loftPointsInput",
  "mirrorCopyBtn",
  "liveMirrorBtn",
  "applyLiveMirrorBtn",
  "softPullBtn",
  "softPushBtn",
  "resetZoomBtn",
  "Camera Views",
  "Reference Image",
  "referenceImageOverlay",
  "data-collapse-persist=\"camera-views\"",
  "Add Camera Here",
  "Create Player + View Here",
  "Detach / See Player",
  "customCameraList",
  "showCustomCamerasInput",
  "function addCustomCameraView()",
  "function addPlayerCameraOnSelectedJoint()",
  "bone.position.copy(camera.position)",
  "joint.layers.disable(0)",
  "playerAvatar: !!playerAvatar",
  "function lowPolyPlayerAvatarGeometryData()",
  "BoltWorks Player Avatar",
  "geometry.setAttribute(\"color\"",
  "function syncPlayerAvatarBones",
  "function activateCustomCameraView",
  "function restoreCustomCameraViews",
  "function restoreReferenceImageState",
  "function loftCheckedProfiles",
  "function mirrorCopySelection",
  "function syncLiveMirrorPreview",
  "function toggleLiveMirror",
  "function applyLiveMirrorSelection",
  "function softMoveSelectedFaces",
  "function softMoveFacesByDistance",
  "function setSurfaceEditorOpen",
  "function setSurfaceInteractionMode",
  "function armContextualSurfaceDrag",
  "function setSurfaceSelectionMode",
  "function updateSurfaceGizmoAttachment",
  "function applySurfaceGizmoDelta",
  "function toggleSurfaceMouseMode",
  "function prioritizeUnselectedSurfaceTriangle",
  "surfaceTransform.pointerHover(surfaceTransform._getPointer(event))",
  "surfaceGizmoPivot",
  "surfaceTransform",
  "createReferenceSurfaceTransform",
  "surfaceFrontTransform",
  "surfaceSideTransform",
  "finishReferenceSurfaceDrag",
  "setTranslationSnap",
  "const surfaceTransformWasVisible = surfaceTransform.visible",
  "surfaceTransform.visible = false",
  "surfaceGizmoState",
  "selectedSurfaceComponents",
  "function previewIsoOrReference",
  "function captureReferenceImage",
  "view: \"reference\"",
  "function detachCustomCameraView",
  "function movePlayerCameraLook",
  "activeCustomCameraId = view.id",
  "if (view.id === activeCustomCameraId) continue",
  "canvas.addEventListener(\"pointerdown\"",
  "cameraDirectorGroup.visible = false",
  "cameraViewsCollapsed",
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
  "function additiveSelectionRequested(event)",
  "event?.shiftKey || event?.ctrlKey || event?.metaKey",
  "Multi-select: Shift/Ctrl+click",
  "function mirrorMeshAcrossWorldPlane(mesh, axis, center)",
  "groupBoundsCenter(targets)",
  "parts around their shared ${axis.toUpperCase()} center",
  "Duplicated ${copies.length} object",
  "delete data.id",
  "removeObject(mesh, { record: false, update: false })",
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
  "createMergedMaterialAtlas",
  "loadMergeTextureImage",
  "generatedMaterialAtlas",
  "Material Atlas",
  "materialAtlas.mapUv",
  "group-hide-btn",
  "setHiddenTargets(meshes, hide)",
  "surfaces.length > 16 ? 1536 : 2048",
  "downscaledMergedTextureCount",
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
  "loadProjectUrlBtn",
  "loadProjectFromUrl",
  "validateRemoteProjectUrl",
  "validateRemoteProjectData",
  "MAX_REMOTE_PROJECT_BYTES",
  "credentials: \"omit\"",
  "Project URL load failed",
  "Save Views",
  "captureView",
  "captureViews",
  "previewShotView",
  "screenshotViewDirections",
  "toDataURL(\"image/png\")",
  "reference screenshots for AI review",
  "Selection tools",
  "Line Tool",
  "Marker tools",
  "Triangle editor tools",
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
  "Delete Selected Model",
  "Delete Selected Face",
  "deleteSelectedSurfaceBtn",
  "rotateSelectedUvLeftBtn",
  "rotateSelectedUvRightBtn",
  "flipSelectedUvUBtn",
  "flipSelectedUvVBtn",
  "transformSelectedSurfaceUvs",
  "transformUvPointAroundCenter",
  "Selected Face UV",
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
  "insetAmountInput",
  "insetFaceBtn",
  "insetSelectedFace",
  "surfaceEditorOpenBtn",
  "cameraControlsOpenBtn",
  "Camera Controls",
  "surfaceEditorWindow",
  "surfaceMouseModeBtn",
  "surfaceValueModeBtn",
  "autoSurfaceDragInput",
  "showModelingEdgesInput",
  "Show Modeling Edges",
  "modelingEdgesOverlay",
  "updateModelingEdgesOverlay",
  "surfaceMouseFalloffSelect",
  "surfaceSelectTriangleBtn",
  "surfaceSelectFaceBtn",
  "surfaceSelectVertexBtn",
  "surfaceSelectEdgeBtn",
  "modelToolsOpenBtn",
  "modelToolsWindow",
  "modelToolsBody",
  "outputToolsOpenBtn",
  "outputToolsWindow",
  "outputToolsBody",
  "goToSelectedMeshBtn",
  "function goToSelectedMesh",
  "data-collapse-persist=\"model-tools\"",
  "data-collapse-persist=\"surface-edit\"",
  "data-collapse-persist=\"files-output\"",
  "docked-tools-section",
  "Go to Selected Mesh",
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
  "historyLabel: \"pull selected region\"",
  "historyLabel: \"push selected region\"",
  "distance: -depth",
  "buildExtrudedRegionGeometry",
  "transform.setSpace(activeTransformMode === \"rotate\" ? \"local\" : \"world\")",
  "pickSurfaceComponentFromHit(hit, { append: additiveSelectionRequested(event) })",
  "function pickSurfaceVertex",
  "function pickSurfaceEdge",
  "function moveSelectedSurfaceComponentsByWorldDelta",
  "pickFace(hit, { append: true, toggleExisting: false, silent: true })",
  "Finished paint selection",
  "Hold Shift or Ctrl to add/remove more",
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
  "edgeBevelWidthInput",
  "edgeBevelBtn",
  "bevelSelectedEdge",
  "subdivideLevelsInput",
  "subdivideSelectedBtn",
  "subdivideSelectedSurface",
  "loopCutAxisSelect",
  "loopCutPositionInput",
  "loopCutCountInput",
  "loopCutBtn",
  "applyLoopCut",
  "knifeCutModeBtn",
  "knifeCutThroughInput",
  "planeCutAxisSelect",
  "planeCutResultSelect",
  "planeCutCapInput",
  "planeCutBtn",
  "splitGeometryAtCutPlane",
  "appendPlaneCutCaps",
  "applyPlaneCut",
  "setKnifeCutMode",
  "applyKnifeCutStroke",
  "Knife / Plane Cut",
  "bridgeEdgeLoopsBtn",
  "bridgeSelectedEdgeLoops",
  "bridgeBoundaryTopology",
  "alignBridgeBoundaryLoops",
  "Bridge Edge Loops",
  "Bridge Selected Loops",
  "findHolesBtn",
  "findSelectedMeshHoles",
  "repairFoundHoles",
  "safeHoleCapPlan",
  "holeRepairPlanarUvs",
  "Find and Repair Holes",
  "Repair All Safe",
  "checkNonManifoldBtn",
  "meshIntegrityReport",
  "Non-manifold Check",
  "Check Selected Mesh",
  "Frame Issue",
  "removeDoublesToleranceInput",
  "analyzeDoublesBtn",
  "removeDoublesBtn",
  "removeDoublesPlan",
  "analyzeSelectedMeshDoubles",
  "removeAnalyzedDoubles",
  "Remove Doubles",
  "Analyze Doubles",
  "Remove Analyzed Doubles",
  "meshStatisticsReport",
  "meshStatisticsForMesh",
  "calculateMeshStatisticsBtn",
  "copyMeshStatisticsBtn",
  "calculateSelectedMeshStatistics",
  "copyMeshStatisticsReport",
  "Mesh Statistics",
  "Calculate Statistics",
  "Copy Report",
  "decimateReductionInput",
  "decimateFeatureAngleInput",
  "analyzeDecimateBtn",
  "applyDecimateBtn",
  "protectedDecimatePlan",
  "analyzeSelectedMeshDecimation",
  "applyAnalyzedDecimation",
  "Protected Decimate",
  "Analyze Decimation",
  "Apply Safe Decimation",
  "lod1ReductionInput",
  "lod2ReductionInput",
  "lod3ReductionInput",
  "analyzeLodGeneratorBtn",
  "generateLodGeneratorBtn",
  "buildProtectedLodPlan",
  "analyzeSelectedMeshLodSet",
  "generateAnalyzedLodSet",
  "sortSurfaceEditorToolsAlphabetically",
  "LOD Generator",
  "Analyze LOD Set",
  "Generate LOD Set",
  "models total",
  "Original",
  "Preview",
  "uvUnwrapSeamAngleInput",
  "uvUnwrapPaddingInput",
  "uvAtlasSizeSelect",
  "analyzeUvUnwrapBtn",
  "applyUvUnwrapBtn",
  "bakeTextureAtlasBtn",
  "uvPngExportSelect",
  "uvPngExportCount",
  "exportUvPngBtn",
  "buildSmartUvLayoutPlan",
  "analyzeSelectedMeshUvLayout",
  "applyAnalyzedUvUnwrap",
  "bakeAnalyzedTextureAtlas",
  "exportAnalyzedUvLayout",
  "UV Unwrap / Texture Atlas",
  "Analyze UV Layout",
  "Bake Texture Atlas",
  "Original Texture (Mesh Details)",
  "Baked UV Atlas Only",
  "UV Guide Only",
  "All 3 PNG Files",
  "Export Selected PNG(s)",
  "exportSelectedUvPngs",
  "exportCurrentMeshTexture",
  "currentUvSourceTexture",
  "exportLastBakedTextureAtlas",
  "exportSelectedObjBtn",
  "Export Selected OBJ",
  "Model triangles:",
  "Selected faces:",
  "edgeSlideAxisSelect",
  "edgeSlideAmountInput",
  "edgeSlideBtn",
  "slideSelectedEdges",
  "inferredEdgeSlideDirection",
  "surfaceScaleAxisSelect",
  "surfaceScaleAmountInput",
  "surfaceScaleBtn",
  "scaleSelectedSurface",
  "scale selected surface",
  "Scale Selected Surface",
  "relaxModeSelect",
  "relaxStrengthInput",
  "relaxIterationsInput",
  "relaxPreserveBoundaryInput",
  "relaxVerticesBtn",
  "relaxSelectedVertices",
  "prepareRelaxVertexPlan",
  "settleSurfacePointerInteraction",
  "Relax Selected Vertices",
  "Smooth / Relax Vertices",
  "weldVertexTargetSelect",
  "weldVerticesBtn",
  "weldSelectedVertices",
  "geometryFromWeldedTriangles",
  "topologyEdgeCounts",
  "topologyIsClosedTriangleMesh",
  "assignWeldFlatRegions",
  "retriangulateWeldedFlatQuads",
  "retriangulatedQuads",
  "__boltworks_welded_vertex__",
  "weld selected vertices",
  "Weld Selected Vertices",
  "dissolveSelectedBtn",
  "dissolveSelectedSurfaceComponent",
  "dissolveSelectedEdge",
  "dissolveSelectedVertex",
  "reportDissolveResult",
  "orderedDissolveBoundary",
  "dissolvedSurfaceEdges",
  "Dissolve Selected",
  "DISSOLVE COMPLETE: 1 modeling edge removed",
  "extrudeRegionBtn",
  "extrudeSelectedRegion",
  "buildExtrudedRegionGeometry",
  "edgeBevelProtectedEdges",
  "localEdgeSignature",
  "clipGeometryByLocalPlane",
  "capUvForEntry",
  "capUAxis: edgeDirection",
  "makeInsetBeveledPanelGeometry",
  "makeGeometryDataForShape",
  "textureInfoFromMaterial",
  "applyTextureToMesh",
  "textureUrl",
  "textureBtn",
  "rotateTextureBtn",
  "flipTextureBtn",
  "saveTextureImageBtn",
  "textureFile",
  "Add Texture",
  "Rotate Texture",
  "Flip Texture",
  "Clear Texture",
  "Save Image",
  "saveSelectedTextureImages",
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
  "selected.material.transparent = opacity < .999",
  "selected.material.opacity = opacity",
  "opacityInput",
  "Opacity",
  "mesh.material.depthWrite = materialOpacity >= .999",
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
  "toggleToolbarSelectionTools",
  "toggleToolbarLineTools",
  "toggleToolbarMarkerTools",
  "toggleToolbarTriEditor",
  "toggleToolbarMiscTools",
  "toggleToolbarFaceEdit",
  "toggleToolbarViews",
  "toggleToolbarImportExport",
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

if (!documentSource.includes("BoltWorks 3D AI Studio v49.25.10 Experimental") || !documentSource.includes("v49.25.10 Experimental preview")) {
  throw new Error("The document must expose the single canonical v49.25.10 version.");
}

for (const attentionElement of ["aiViewerAttention", "aiViewerAttentionMessage", "aiViewerAttentionDirective"]) {
  if (!documentSource.includes(`id="${attentionElement}"`)) {
    throw new Error(`Missing Human AI Viewer attention element: ${attentionElement}`);
  }
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
if (!moduleSources.get("import-export").includes("hydrateProjectTextureReferences(data.scene, data.textureLibrary || [])")) {
  throw new Error("Self-contained project textures must be restored from the project texture library.");
}
if (!moduleSources.get("import-export").includes("materialTextureReferenceFields()") || !moduleSources.get("import-export").includes("object[urlKey] = null;")) {
  throw new Error("Saved projects must deduplicate every material channel through the project texture library.");
}
if (!moduleSources.get("import-export").includes("await waitForSceneTextures();")) {
  throw new Error("PNG captures must wait for project textures before rendering.");
}
if (!documentSource.includes('id="saveQaSheetBtn"') || !moduleSources.get("import-export").includes("async function saveQaSheet()")) {
  throw new Error("The six-view AI QA sheet export must remain available.");
}
for (const texturePaintControl of [
  'data-texture-tool="pen"',
  'data-texture-tool="brush"',
  'data-texture-tool="spray"',
  'data-texture-tool="shape"',
  'data-texture-tool="selectRect"',
  'data-texture-tool="selectEllipse"',
  'data-texture-tool="selectLasso"',
  'value="none"',
  'value="eraser"',
  'value="eyedropper"',
  'value="fill"',
  'id="textureEditorHardness"',
  'id="textureEditorOpacity"',
  'id="textureEditorChannelValue"',
  'id="textureEditorChannelValueLabel"',
  'id="textureEditorChannelValueOutput"',
  'id="textureEditorBrushPreview"',
  'id="textureEditorZoomResetBtn"',
  'id="textureEditorUndoBtn"',
  'id="textureEditorIdleHint"',
  'id="textureEditorClearSelectionBtn"',
  'id="textureEditorSelectionStatus"',
  'id="textureEditorShapeFilled"',
  'id="textureEditorLayerCount"',
  'id="textureEditorLayerList"',
  'id="textureEditorAddLayerBtn"',
  'id="textureEditorDuplicateLayerBtn"',
  'id="textureEditorLayerUpBtn"',
  'id="textureEditorLayerDownBtn"',
  'id="textureEditorMergeDownBtn"',
  'id="textureEditorDeleteLayerBtn"',
  'data-texture-shape="rectangle"',
  'data-texture-shape="ellipse"',
  'data-texture-shape="triangle"',
  'data-texture-shape="diamond"',
  'data-texture-shape="star"',
  'data-texture-shape="heart"',
  'data-texture-symmetry="none"',
  'data-texture-symmetry="u"',
  'data-texture-symmetry="v"',
  'data-texture-symmetry="uv"',
  'data-texture-setting="hardness"',
  'data-texture-setting="channelValue"',
  'data-texture-channel="baseColor"',
  'data-texture-channel="roughness"',
  'data-texture-channel="metalness"',
  'data-texture-channel="emissive"'
]) {
  if (!documentSource.includes(texturePaintControl)) throw new Error(`M20 texture paint control is missing: ${texturePaintControl}`);
}
if (!documentSource.includes('<div class="texture-editor-workspace">') ||
    !documentSource.includes('<aside class="texture-editor-layer-panel" aria-label="Texture paint layers">')) {
  throw new Error("M20 texture layers must live in a dedicated workspace sidebar beside the texture canvas.");
}
for (const layerSidebarStyle of [
  ".texture-editor-workspace {",
  "grid-template-columns: minmax(0, 1fr) 220px;",
  "grid-template-rows: auto auto minmax(0, 1fr);",
  "overflow-y: auto;"
]) {
  if (!styleSource.includes(layerSidebarStyle)) throw new Error(`M20 vertical layer sidebar style is missing: ${layerSidebarStyle}`);
}
for (const texturePaintBehavior of [
  "function syncTextureEditorToolSettings(tool = \"none\")",
  "function setTextureEditorTool(tool = \"none\")",
  "if (!tool || tool === \"none\") return \"default\";",
  "const activeTool = textureEditorState.tool || \"brush\";",
  "setTextureEditorTool(activeTool);",
  "function setTextureEditorZoom(nextZoom, anchor = null, pointerEvent = null)",
  "if (pointerEvent) syncTextureEditorPointerPreview(pointerEvent);",
  "function observeTextureEditorStage()",
  "textureEditorResizeObserver.observe(stage);",
  "els.textureEditorModal?.classList.contains(\"open\")",
  "const displayRect = canvas.getBoundingClientRect();",
  "function renderTextureEditorBrushPreview()",
  "function stampTextureEditorSpray(context, point, settings, sprayDots = null)",
  "function stampTextureEditorPen(context, point, settings)",
  "function cloneTextureEditorCanvas(source)",
  "function captureTextureEditorPixels(source)",
  "function canvasFromTextureEditorPixels(source)",
  "function snapshotTextureEditor()",
  "function undoTextureEditorPaint()",
  "function fillTextureEditorIsland(point)",
  "function sampleTextureEditorColor(point)",
  "function textureEditorSelectionPath(",
  "function textureEditorClipToActiveMask(",
  "function syncTextureEditorSelectionUi()",
  "function clearTextureEditorSelection()",
  "function textureEditorShapePath(",
  "function drawTextureEditorShape(",
  "function textureEditorSymmetryTransforms()",
  "function textureEditorSymmetryPoints(point, source)",
  "function withTextureEditorSymmetry(context, source, draw)",
  "function setTextureEditorSymmetry(mode)",
  "function textureEditorChannelPaintColor()",
  "function syncTextureEditorChannelValueUi()",
  "channel === \"roughness\" || channel === \"metalness\"",
  "channel === \"roughness\" ? pixel[1] : pixel[2]",
  "textureEditorClipToActiveMask(context, mesh, source);",
  "textureEditorDrafts.set(textureEditorDraftKey(textureEditorState.meshId, channelData.channel)",
  "textureEditorState.originalCanvas = originalCanvas",
  "originalPixels: cloneTextureEditorPixels(textureEditorState.originalPixels)",
  "sourceDataUrl: composite?.toDataURL(\"image/png\")",
  "function compositeTextureEditorLayers()",
  "function renderTextureEditorLayerUi()",
  "function addTextureEditorLayer()",
  "function duplicateTextureEditorLayer()",
  "function mergeTextureEditorLayerDown()",
  "function deleteTextureEditorLayer()",
  "activeLayerId: textureEditorState.activeLayerId",
  "draft.textureUrl === channelData.url",
  "Keep the frozen pre-edit pixels after Apply",
  "function applyMaterialTextureChannel(mesh, channel, textureUrl, textureName)",
  "function switchTextureEditorChannel(channel)",
  "roughnessTextureUrl",
  "metalnessTextureUrl",
  "emissiveTextureUrl"
]) {
  if (!meshesSource.includes(texturePaintBehavior)) throw new Error(`M20 texture paint behavior is missing: ${texturePaintBehavior}`);
}
if (meshesSource.includes("textureEditorDrafts.delete(mesh.userData.id);")) {
  throw new Error("Apply Texture must preserve the frozen original so Restore Original survives reopening the editor.");
}

console.log("BoltWorks 3D AI Studio smoke check passed.");
