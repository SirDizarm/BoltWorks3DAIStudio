import { readFileSync } from "node:fs";
import vm from "node:vm";
import * as THREE from "three";
import { studioModuleOrder } from "../app/source-composer.mjs";
import { createMeshFactory } from "../app/meshes/factory.js";
import { createGeometry as createDetailedImageMeshGeometry } from "./image-to-mesh/generator.js";

const documentSource = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const moduleSources = new Map(studioModuleOrder.map(name => [
  name,
  readFileSync(new URL(`../app/modules/${name}.js`, import.meta.url), "utf8")
]));
const applicationSource = [...moduleSources.values()].join("\n");
const styleSource = readFileSync(new URL("../app/styles/studio.css", import.meta.url), "utf8");
const panelCollapseSource = readFileSync(new URL("../app/panels/panel-collapse.js", import.meta.url), "utf8");
const toolDockingSource = readFileSync(new URL("../app/panels/tool-docking.js", import.meta.url), "utf8");
const directBundle = readFileSync(new URL("../app/studio-v49.60.81.js", import.meta.url), "utf8");
const authoringManifest = JSON.parse(readFileSync(new URL("../BoltWorksStudioAi/manifest.json", import.meta.url), "utf8"));
const projectSchema = JSON.parse(readFileSync(new URL("../BoltWorksStudioAi/schemas/modeler-project.schema.json", import.meta.url), "utf8"));
const uvTopologyTest = JSON.parse(readFileSync(new URL("../samples/showcases/uv-topology-test.modelerproj", import.meta.url), "utf8"));
const humanWalkCycle = JSON.parse(readFileSync(new URL("../samples/assets/human-walk-rig-smoke.modelerproj", import.meta.url), "utf8"));
const minecraftRigSmoke = JSON.parse(readFileSync(new URL("../samples/assets/minecraft-rig-smoke.bbmodel", import.meta.url), "utf8"));
const raptorRig = JSON.parse(readFileSync(new URL("../samples/assets/raptor-rigged.bbmodel", import.meta.url), "utf8"));
const panelsSource = moduleSources.get("panels") || "";
const meshesSource = moduleSources.get("meshes") || "";
const viewportSource = moduleSources.get("viewport") || "";
const aiViewerSource = moduleSources.get("ai-viewer") || "";
const minecraftSource = moduleSources.get("minecraft") || "";
const riggingSource = moduleSources.get("rigging") || "";
const poseStraightenerSource = moduleSources.get("pose-straightener") || "";
const autoSaveUpdateSource = moduleSources.get("autosave-update") || "";
// Preserve the existing checks while testing the new canonical modular source as
// one logical application, exactly as the Pages builder and local server do.
const html = `${documentSource}\n${styleSource}\n${panelCollapseSource}\n${toolDockingSource}\n${applicationSource}`;

for (const gameplayPreviewBehavior of [
  "function playGameplayPreview()",
  "function pauseGameplayPreview()",
  "if (gameplayPlaybackPaused) return;",
  "function syncGameplayFollowCamera()",
  "function buildGameplayArena()",
  "function gameplayMovementBlocked(nextOffset)",
  "function updateGameplayArena(deltaSeconds)",
  "const projectilesEnabled = !!els.gameplayProjectilesInput?.checked",
  "const projectileLaneTarget = character.clone()",
  'updateGameplayArenaStatus("Projectile dodged!")',
  "function startGameplayJump()",
  "function startGameplayUpperBodyAction(kind",
  "gameplayUpperBodyAction.startedAt = performance.now()",
  'const offensiveActionActive = ["slash", "thrust"].includes(gameplayUpperBodyAction?.kind)',
  "gameplayMouseButtons.has(2) && !offensiveActionActive",
  "function releaseGameplayUpperBodyAction(kind",
  "function applyGameplayUpperBodyAction(poses)",
  "const reachedLastFrame = elapsedMs >= durationMs",
  'action.kind === "slash" && reachedLastFrame && (action.held || gameplayMouseButtons.has(0))',
  'startGameplayUpperBodyAction("thrust", { held: true })',
  "reachedLastFrame && action.holdLastFrame ? finalFrame",
  "holdLastFrame: true",
  "gameplayUpperBodyAction.held = false",
  "function applyGameplayCrawlEquipmentStow()",
  "function releaseGameplayControl()",
  "animationState.playing = false;",
  'startGameplayUpperBodyAction("slash", { held: true })',
  'startGameplayUpperBodyAction("shieldBlock", { held: true })',
  "gameplayCameraTargetBase.clone().add(gameplayCharacterOffset)",
  "gameplayYaw = gameplayCharacterYaw + Math.PI",
  "const forward = new THREE.Vector3(Math.sin(gameplayCharacterYaw), 0, Math.cos(gameplayCharacterYaw))",
  "const right = new THREE.Vector3(-Math.cos(gameplayCharacterYaw), 0, Math.sin(gameplayCharacterYaw))",
  "pose.position.x = rootAnchor.x + gameplayCharacterOffset.x",
  "pose.position.z = rootAnchor.z + gameplayCharacterOffset.z",
  'setGameplayCharacterAnimation(running ? "run" : "walk")',
  "const horizontalDirection = els.gameplayInvertMouseXInput?.checked ? 1 : -1",
  "const verticalDirection = els.gameplayInvertMouseYInput?.checked ? -1 : 1",
  "gameplayCharacterYaw += event.movementX * .0025 * horizontalDirection",
  "gameplayCameraOrbitOffset += event.movementX * .0025 * horizontalDirection",
  "gameplayPitch + event.movementY * .0018 * verticalDirection",
  "if (!gameplayCameraLocked) return;",
  "applyGameplayUpperBodyAction(poses)"
]) {
  if (!panelsSource.includes(gameplayPreviewBehavior)) {
    throw new Error(`Gameplay Preview must keep a centered follow camera and layer combat above independent locomotion: ${gameplayPreviewBehavior}`);
  }
}
if (!panelsSource.includes("boneRigGroup,")
    || !panelsSource.includes("boneRingGuideGroup,")
    || !riggingSource.includes('typeof gameplayPreviewVisible === "function" && gameplayPreviewVisible()')
    || !riggingSource.includes("state.center.copy(target)")) {
  throw new Error("Gameplay Preview must hide editor bone guides and keep both reference cameras centered on the moving character.");
}
for (const stencilFeature of [
  'data-texture-tool="stencil"',
  'id="textureEditorChooseStencilBtn"',
  'id="textureEditorStencilScale"',
  'id="textureEditorStencilRotation"',
  'id="textureEditorStencilOpacity"',
  'id="textureEditorStampStencilBtn"'
]) {
  if (!documentSource.includes(stencilFeature)) throw new Error(`Texture Editor stencil UI is missing: ${stencilFeature}`);
}
for (const stencilBehavior of [
  "function loadTextureEditorStencilFile(file)",
  "function drawTextureEditorStencil(context, source, center",
  "function stampTextureEditorStencil()",
  'textureEditorState.tool === "stencil"',
  "textureEditorClipToActiveMask(context, mesh, source)"
]) {
  if (!meshesSource.includes(stencilBehavior) && !panelsSource.includes(stencilBehavior)) {
    throw new Error(`Texture Editor stencil behavior is missing: ${stencilBehavior}`);
  }
}
if (!panelsSource.includes("if (document.pointerLockElement === gameplayCanvas) return;")
    || !panelsSource.includes("shoulder|clavicle|arm|forearm|elbow|hand|wrist|finger|thumb|neck|head|skull|sword|shield")
    || panelsSource.includes("root|pelvis|hips?|thigh|upper leg|shin|calf|lower leg|ankle|foot|feet|toe")) {
  throw new Error("Gameplay combat must preserve held movement input and stay isolated from torso and leg locomotion.");
}
if (!documentSource.includes('id="gameplayPreviewPlayBtn"')
    || !documentSource.includes('id="gameplayPreviewPauseBtn"')
    || !viewportSource.includes('gameplayPreviewPlayBtn: document.querySelector("#gameplayPreviewPlayBtn")')) {
  throw new Error("Gameplay Preview must expose its own permanent Play and Pause controls.");
}
if (!panelsSource.includes("characterYaw.clone().multiply(authoredRotation)") || panelsSource.includes("pose.rotation.y += gameplayCharacterYaw")) {
  throw new Error("Gameplay steering must compose world yaw with authored forward lean without introducing sideways sprint roll.");
}
if (!panelsSource.includes("gameplayCameraTargetBase.set(rootAnchor.x, headAnchor.y, rootAnchor.z)")
    || !panelsSource.includes("gameplayPitch = 0")
    || !panelsSource.includes('event.code === "KeyC"')
    || !panelsSource.includes("Camera centered on the fitted head line")
    || !riggingSource.includes("gameplayReferenceTargetBase.clone().add(gameplayCharacterOffset)")) {
  throw new Error("Gameplay camera must stay level on the fitted head line, offer instant recentering, and keep reference views on the whole body.");
}
if (!panelsSource.includes("pose.rotation?.isEuler")
    || !panelsSource.includes("pose.rotation = new THREE.Euler().setFromQuaternion")) {
  throw new Error("Gameplay playback must normalize imported Vector3 root rotations before composing character yaw.");
}
if (!documentSource.includes('id="gameplayStrideSyncInput" type="checkbox" checked')
    || !documentSource.includes('id="gameplayStrideScaleInput" type="range"')
    || !panelsSource.includes("function gameplayClipStrideSpeed(kind)")
    || !panelsSource.includes("strideDistance / cycleSeconds * gameplayStrideScale()")
    || !panelsSource.includes("function advanceGameplayCharacterAnimation(deltaSeconds")
    || !panelsSource.includes("gameplayLocomotionClock * fps")
    || !panelsSource.includes("if (gameplayPreviewVisible()) updateGameplayPreview(gameplayDelta);\n  else updateAnimation(gameplayDelta);")) {
  throw new Error("Gameplay Preview must synchronize ground travel and animation playback to the authored foot cycle, with an adjustable stride length.");
}
if (riggingSource.includes("gameplayAnimationPlaybackRate") || panelsSource.includes("function gameplayAnimationPlaybackRate")) {
  throw new Error("Gameplay locomotion must own its continuous preview clock instead of depending on the editor timeline playback flag.");
}
if (!panelsSource.includes("animationState.keys === clip?.keys")
    || !riggingSource.includes("const requestedClipLoaded = id === animationState.activeClipId")
    || !riggingSource.includes("if (id !== animationState.activeClipId) syncActiveAnimationClip();")) {
  throw new Error("Gameplay clip loading must recover stale active-clip IDs without overwriting the clip's real keyed animation.");
}
if (panelsSource.includes("gameplayCharacterYaw = Math.atan2(direction.x, direction.z)")) {
  throw new Error("Gameplay strafing must not rewrite character yaw and spin the rear follow camera.");
}
if (panelsSource.includes("const crateOffsets") || panelsSource.includes("gameplayArenaGroup.add(target)")) {
  throw new Error("Gameplay Preview must keep its arena clear of collision props and target objects.");
}
if (panelsSource.includes('gameplayKeys.has("ControlLeft")') || panelsSource.includes('setGameplayCharacterAnimation(crawling ?')) {
  throw new Error("Gameplay crawl must remain disabled until its replacement animation is ready.");
}
if (!panelsSource.includes('["KeyF", "KeyB"].includes(event.code)')
    || !panelsSource.includes("is reserved for a future spell animation")) {
  throw new Error("Gameplay B/F controls must remain reserved for dedicated spell animations.");
}
if (!viewportSource.includes("const gameplayMouseButtons = new Set()")
    || !viewportSource.includes("const gameplayCameraTargetBase = new THREE.Vector3()")
    || !viewportSource.includes("const gameplayReferenceTargetBase = new THREE.Vector3()")
    || !viewportSource.includes("let gameplayUpperBodyAction = null")
    || !viewportSource.includes("const gameplayArenaGroup = new THREE.Group()")
    || !viewportSource.includes('let gameplayLocomotionKind = "idle"')) {
  throw new Error("Gameplay Preview must retain independent movement, camera-follow, and upper-body action state.");
}
if (!documentSource.includes('id="gameplayProjectilesInput" type="checkbox"')
    || !documentSource.includes('id="gameplayInvertMouseXInput" type="checkbox"')
    || !documentSource.includes('id="gameplayInvertMouseYInput" type="checkbox"')
    || documentSource.includes('id="gameplayProjectilesInput" type="checkbox" checked')) {
  throw new Error("Gameplay projectiles must live in Preview Tools and remain disabled by default.");
}
for (const gripChainBehavior of [
  'suffix: "middle", label: "Middle"',
  'suffix: "tip", label: "Tip"',
  'Pose each knuckle, middle, and tip joint'
]) {
  if (!riggingSource.includes(gripChainBehavior)) {
    throw new Error(`Grip-hand repair must create articulated three-joint finger chains: ${gripChainBehavior}`);
  }
}

if (
  !studioModuleOrder.includes("pose-straightener")
  || !documentSource.includes('id="poseStraightenerPanel"')
  || !documentSource.includes('id="poseStraightenerFinishBtn"')
  || !documentSource.includes('id="poseStraightenerStraightenBtn"')
  || !documentSource.includes('id="poseStraightenerApplyBtn"')
  || !poseStraightenerSource.includes("function poseStraightenerAddPointFromEvent")
  || !poseStraightenerSource.includes("function poseStraightenerSelectJointFromEvent")
  || !poseStraightenerSource.includes("const poseStraightenerTransform = new TransformControls")
  || !poseStraightenerSource.includes("function finishPoseStraightenerChain")
  || !poseStraightenerSource.includes("function straightenPoseStraightenerChain")
  || !poseStraightenerSource.includes('recordHistory("pose straighten mesh")')
  || !panelsSource.includes("poseStraightenerAddPointFromEvent(event)")
  || !styleSource.includes(".pose-straightener-panel")
) {
  throw new Error("Pose Straightener must provide a manual variable-joint mesh deformation workflow with direct node rotation under Model Tools.");
}

if (
  !studioModuleOrder.includes("autosave-update")
  || studioModuleOrder.indexOf("autosave-update") <= studioModuleOrder.indexOf("import-export")
  || studioModuleOrder.indexOf("autosave-update") >= studioModuleOrder.indexOf("panels")
  || !documentSource.includes('id="autoSaveStatus"')
  || !documentSource.includes('id="updateAvailableBtn"')
  || !autoSaveUpdateSource.includes('indexedDB.open(BWS_RECOVERY_DB_NAME, 1)')
  || !autoSaveUpdateSource.includes("function saveProjectAutoRecoveryNow")
  || !autoSaveUpdateSource.includes("function restoreAutoSavedProjectIfBlank")
  || !autoSaveUpdateSource.includes("function checkForBwsUpdate")
  || !autoSaveUpdateSource.includes('location.replace(nextUrl.href)')
  || !moduleSources.get("import-export")?.includes("scheduleProjectAutoSave")
  || !panelsSource.includes("restoreAutoSavedProjectIfBlank")
  || !styleSource.includes(".update-available-btn")
) {
  throw new Error("Online mode must auto-save projects locally and offer a recovery-safe update button without silently reloading the page.");
}

if (
  !panelsSource.includes('document.addEventListener("contextmenu", event => event.preventDefault())')
  || !panelsSource.includes('projectNameInput?.addEventListener("dblclick"')
  || !panelsSource.includes("navigator.clipboard.writeText(value)")
  || !/body\s*\{[^}]*user-select:\s*none/s.test(styleSource)
  || !/input, textarea[^}]*user-select:\s*text/s.test(styleSource)
) {
  throw new Error("Editor mouse interactions must suppress browser menus and accidental text selection while preserving text inputs and name copying.");
}

if (
  !documentSource.includes('id="selectConnectedBtn"')
  || !documentSource.includes("Select Connected")
  || !meshesSource.includes("function setConnectedTrianglePickMode")
  || !panelsSource.includes("if (connectedTrianglePickMode && hit)")
  || !panelsSource.includes("selectConnectedTrianglesFromHit(hit, { append: additiveSelectionRequested(event) })")
  || panelsSource.includes("Released the current surface selection with a double-click.")
) {
  throw new Error("Selection Tools must provide Select Connected, and double-click must still expand to the complete connected triangle island.");
}

if (
  !documentSource.includes('id="selectionHighlightToggleBtn"')
  || !meshesSource.includes("function setSelectionHighlightVisible")
  || !meshesSource.includes("if (!selectionHighlightVisible) return;")
  || !panelsSource.includes("setSelectionHighlightVisible(!selectionHighlightVisible)")
  || !viewportSource.includes('localStorage.getItem("boltworks.selectionHighlightVisible") === "true"')
) {
  throw new Error("The selected-mesh blue silhouette must have a remembered, non-destructive visibility toggle.");
}

if (
  !styleSource.includes("body.footer-info-collapsed .bottom > *")
  || /footer-info-collapsed\s+\.persistent-notice/.test(styleSource)
  || /animator-workspace-active\s+\.persistent-notices/.test(styleSource)
  || /mobile-layout\s+\.persistent-notices\s*\{[^}]*display\s*:\s*none/s.test(styleSource)
) {
  throw new Error("The lower information panel may collapse, but the version and copyright notices must always remain visible.");
}

if (
  minecraftRigSmoke.meta?.model_format !== "modded_entity"
  || minecraftRigSmoke.elements?.length !== 2
  || minecraftRigSmoke.outliner?.[0]?.children?.[1]?.uuid !== "bone-arm"
  || minecraftRigSmoke.animations?.[0]?.animators?.["bone-arm"]?.keyframes?.length !== 3
) {
  throw new Error("The Minecraft smoke fixture must preserve cuboids, nested bones, and animation keys.");
}

{
  const clips = new Map((raptorRig.animations || []).map(clip => [clip.name, clip]));
  for (const name of ["Swim", "Turn Left", "Turn Right", "Sleep"]) {
    if (!clips.has(name)) throw new Error(`The rigged raptor must include its ${name} animation.`);
  }
  const swimTracks = [...Object.values(clips.get("Swim").animators || {})];
  const swimNames = new Set(swimTracks.map(track => track.name));
  if (!["pelvis_body", "neck", "head", "tail_base", "tail_tip"].every(name => swimNames.has(name))) {
    throw new Error("Raptor swimming must travel through the body, head, and complete tail hierarchy.");
  }
  for (const name of ["Turn Left", "Turn Right"]) {
    const trackNames = new Set(Object.values(clips.get(name).animators || {}).map(track => track.name));
    if (!["left_upper_leg", "left_knee", "left_foot", "right_upper_leg", "right_knee", "right_foot"].every(part => trackNames.has(part))) {
      throw new Error(`${name} must animate both connected stepping leg chains.`);
    }
  }
  if ((clips.get("Sleep").loop !== "loop") || Object.keys(clips.get("Sleep").animators || {}).length < 15) {
    throw new Error("Raptor sleep must remain a complete looping laid-down pose.");
  }
}

if (meshesSource.includes("cullCoincidentOpposingMergeTriangles") || meshesSource.includes("culledInternalTriangles")) {
  throw new Error("Merge Mesh must preserve source triangles instead of heuristically deleting coincident surfaces.");
}

if (/depthWrite\s*=\s*[^;\n]*textureHasTransparency/.test(meshesSource) || /depthWrite\s*=\s*[^;\n]*textureHasTransparency/.test(readFileSync(new URL("../app/modules/import-export.js", import.meta.url), "utf8"))) {
  throw new Error("Texture alpha must not disable depth writing; only sub-1 mesh opacity may do that.");
}
if (meshesSource.includes('materialRule === "glass" || opacity < .999 || !!mesh.userData?.textureHasTransparency')) {
  throw new Error("Texture alpha must not force double-sided interior rendering for opaque meshes.");
}

if (!riggingSource.includes("syncBoneTransformGizmo") || !riggingSource.includes("pickBoneFromMainPointer") || !riggingSource.includes("new TransformControls(camera, renderer.domElement)")) {
  throw new Error("Rigging must keep the main-viewport bone TransformControls gizmo and bone picking helpers.");
}
if (!(moduleSources.get("panels") || "").includes("pickBoneFromMainPointer") || !(moduleSources.get("panels") || "").includes("selectBoneFromViewport")) {
  throw new Error("The main canvas pointer handler must let users click bone joints to select and manipulate them.");
}

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
  const context = { THREE, rigBones: [], rigPoseChannels: new Map(), mirrorBoneEdits: true };
  context.boneById = id => context.rigBones.find(bone => bone.id === id) || null;
  vm.createContext(context);
  vm.runInContext([
    "mirroredBoneId",
    "mirrorBoneEdit"
  ].map(name => functionSource(riggingSource, name)).join("\n"), context);
  const leftShin = {
    id: "left_shin",
    position: new THREE.Vector3(1.1, 2.4, -.2),
    rotation: new THREE.Vector3(.2, .3, -.4),
    tail: new THREE.Vector3(1.1, 1.2, -.2)
  };
  const rightShin = {
    id: "right_shin",
    position: new THREE.Vector3(-.8, 2.2, 0),
    rotation: new THREE.Vector3(),
    tail: new THREE.Vector3(-.8, 1, 0)
  };
  context.rigBones.push(leftShin, rightShin);
  context.mirrorBoneEdit(leftShin);
  const mirroredChannel = context.rigPoseChannels.get("right_shin");
  if (!mirroredChannel
      || Math.abs(mirroredChannel.position.x + 1.1) > 1e-6
      || Math.abs(mirroredChannel.position.y - 2.4) > 1e-6
      || Math.abs(mirroredChannel.position.z + .2) > 1e-6
      || Math.abs(mirroredChannel.rotation.x - .2) > 1e-6
      || Math.abs(mirroredChannel.rotation.y + .3) > 1e-6
      || Math.abs(mirroredChannel.rotation.z - .4) > 1e-6) {
    throw new Error("Mirrored T-Pose edits must update the opposite joint's branch-local pose channel before hierarchy solving.");
  }
}

{
  const context = {};
  vm.createContext(context);
  vm.runInContext(functionSource(viewportSource, "closeCameraNavigationPlan"), context);
  if (context.closeCameraNavigationPlan(.5, .01) !== null) {
    throw new Error("Normal camera distances must not retarget the orbit focus.");
  }
  const closePlan = context.closeCameraNavigationPlan(.005, .01);
  if (!closePlan || closePlan.targetDistance < .12 || closePlan.near > .001) {
    throw new Error("Very close camera zoom must move the focus forward and reduce the near plane instead of locking.");
  }
  if (
    !viewportSource.includes("orbit.minDistance = 0.0005")
    || !viewportSource.includes("orbit.zoomToCursor = true")
    || !viewportSource.includes("requestAnimationFrame(keepCloseCameraNavigationResponsive)")
    || !viewportSource.includes("orbit.panSpeed = THREE.MathUtils.clamp")
  ) {
    throw new Error("Orbit controls must keep close-up zooming and panning responsive.");
  }
}

{
  const context = { THREE, round: (value, digits = 4) => Number(Number(value).toFixed(digits)) };
  vm.createContext(context);
  vm.runInContext([
    "vertexKey",
    "topologyEdgeCounts",
    "materialIndexForTriangle",
    "geometryWithManualTriangle"
  ].map(name => functionSource(meshesSource, name)).join("\n"), context);
  const point = (x, y, z = 0) => new THREE.Vector3(x, y, z);
  const sourceGeometry = new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute([
    0, 0, 0, 1, 0, 0, 0, 1, 0,
    2, 0, 0, 3, 0, 0, 2, 1, 0
  ], 3));
  sourceGeometry.setAttribute("uv", new THREE.Float32BufferAttribute([
    0, 0, 1, 0, 0, 1,
    0, 0, 1, 0, 0, 1
  ], 2));
  const picks = [point(0, 0), point(0, 1), point(2, 0)].map(localPoint => ({
    localPoint,
    key: context.vertexKey(localPoint)
  }));
  const built = context.geometryWithManualTriangle({ geometry: sourceGeometry }, picks);
  if (!built.geometry || built.geometry.getAttribute("position").count !== 9) {
    throw new Error("Build Triangle must append one real face from three existing mesh corner points.");
  }
  const duplicate = context.geometryWithManualTriangle({ geometry: sourceGeometry }, [point(0, 0), point(1, 0), point(0, 1)].map(localPoint => ({
    localPoint,
    key: context.vertexKey(localPoint)
  })));
  if (duplicate.geometry || !duplicate.reason.includes("already exists")) {
    throw new Error("Build Triangle must reject a face that already exists.");
  }
  const nonManifoldGeometry = new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute([
    0, 0, 0, 1, 0, 0, 0, 1, 0,
    0, 0, 0, 0, 1, 0, -1, 0, 0,
    2, 0, 0, 3, 0, 0, 2, 1, 0
  ], 3));
  const unsafe = context.geometryWithManualTriangle({ geometry: nonManifoldGeometry }, picks);
  if (unsafe.geometry || !unsafe.reason.includes("non-manifold")) {
    throw new Error("Build Triangle must reject a third face on an edge that already has two faces.");
  }
  built.geometry.dispose();
  sourceGeometry.dispose();
  nonManifoldGeometry.dispose();
}

{
  const context = { THREE, geometryToData: () => ({}) };
  vm.createContext(context);
  vm.runInContext([
    "axisIndex",
    "component",
    "setComponent",
    "swapAttributeVertices",
    "mirrorMeshAcrossWorldPlane"
  ].map(name => functionSource(meshesSource, name)).join("\n"), context);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([
    -.5, 0, 0, .5, 0, 0, 0, 1, 0
  ], 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, .5, 1], 2));
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  mesh.position.set(-2, 3, 4);
  mesh.updateWorldMatrix(true, false);
  const before = [0, 1, 2].map(index => new THREE.Vector3().fromBufferAttribute(mesh.geometry.getAttribute("position"), index).applyMatrix4(mesh.matrixWorld));
  context.mirrorMeshAcrossWorldPlane(mesh, "x", new THREE.Vector3(0, 0, 0));
  mesh.updateWorldMatrix(true, false);
  const after = [0, 1, 2].map(index => new THREE.Vector3().fromBufferAttribute(mesh.geometry.getAttribute("position"), index).applyMatrix4(mesh.matrixWorld));
  const exactOpposite = before.every(point => after.some(candidate => (
    Math.abs(candidate.x + point.x) < 1e-6
    && Math.abs(candidate.y - point.y) < 1e-6
    && Math.abs(candidate.z - point.z) < 1e-6
  )));
  if (!exactOpposite || Math.abs(mesh.position.x - 2) > 1e-6) {
    throw new Error(`Mirrored triangle patches must keep Y/Z and land at the exact opposite X coordinates. ${JSON.stringify({
      position: mesh.position.toArray(),
      before: before.map(point => point.toArray()),
      after: after.map(point => point.toArray())
    })}`);
  }
  mesh.geometry.dispose();
  mesh.material.dispose();
}

{
  const first = { userData: { id: "first" } };
  const second = { userData: { id: "second" } };
  const context = {
    selected: null,
    selectedGroupRecordId: null,
    selectedFaces: [],
    checked: [],
    active: [],
    checkedObjects: () => context.checked,
    activeGroupObjects: () => context.active,
    selectedFaceMeshes: () => context.faceMeshes || [],
    groupRecord: id => id ? { id } : null,
    descendantMeshesForGroup: () => [first, second]
  };
  vm.createContext(context);
  vm.runInContext([
    "uniqueMeshList",
    "meshActionCandidates",
    "resolveSelectionTargets",
    "singleMeshTarget",
    "mergeSelectionTargets"
  ].map(name => functionSource(meshesSource, name)).join("\n"), context);

  context.checked = [first, second];
  if (context.singleMeshTarget() !== null) {
    throw new Error("Single-mesh tools must not silently edit the first mesh in a multi-selection.");
  }
  context.checked = [first];
  context.selected = second;
  if (context.singleMeshTarget() !== second) {
    throw new Error("Single-mesh tools must prefer the explicitly selected mesh.");
  }
  context.selected = null;
  context.active = [first, second];
  if (context.mergeSelectionTargets().length !== 2) {
    throw new Error("Merge Mesh must prefer a complete multi-selection over one stale checked mesh.");
  }
  context.active = [];
  context.selected = second;
  if (context.mergeSelectionTargets().length !== 2) {
    throw new Error("Merge Mesh must combine an active mesh with an additional checked mesh.");
  }
}

{
  const context = { THREE };
  vm.createContext(context);
  vm.runInContext([
    "minecraftVec",
    "minecraftChildren",
    "blockbenchAutoFaceUvs",
    "rotateBlockbenchUvPoint",
    "blockbenchCubeGeometryData"
  ].map(name => functionSource(minecraftSource, name)).join("\n"), context);
  if (context.minecraftVec("6 7 16").join(",") !== "6,7,16" || context.minecraftChildren("cube-uuid ").join("") !== "cube-uuid") {
    throw new Error("Blockbench space-separated vectors and single-child UUID strings must import intact.");
  }
  const geometry = context.blockbenchCubeGeometryData(minecraftRigSmoke.elements[0], 32, 32, true);
  if (geometry.positions.length !== 108 || geometry.uvs.length !== 72) {
    throw new Error("Blockbench cuboids must generate six textured faces with per-corner UV coordinates.");
  }
  const uniqueUvs = new Set(Array.from(geometry.uvs, value => Number(value).toFixed(4)));
  if (uniqueUvs.size < 6 || Math.max(...geometry.uvs) >= 1 || Math.min(...geometry.uvs) < 0) {
    throw new Error("Blockbench face rectangles must map into their atlas regions instead of repeating the full texture.");
  }
}
{
  const context = {
    minecraftProject: { sourceName: "raptor-rigged.bbmodel" },
    minecraftAnimationClips: [{ name: "Idle" }, { name: "Walk" }, { name: "Jump" }],
    minecraftAnimationSequence: [0, 1, 2, 0],
    activeMinecraftAnimation: 1,
    animationState: { fps: 20, end: 24, frame: 6, keys: { "bone-leg": [{ frame: 6, position: [0, 0, 0], rotation: [.4, 0, 0] }] } }
  };
  vm.createContext(context);
  vm.runInContext([
    "animationSequenceClipIndices",
    "persistActiveMinecraftAnimationState",
    "serializeMinecraftWorkspace"
  ].map(name => functionSource(minecraftSource, name)).join("\n"), context);
  const saved = context.serializeMinecraftWorkspace();
  if (saved.clips.length !== 3 || saved.activeAnimation !== 1 || saved.animationSequence?.join(",") !== "0,1,2,0" || saved.clips[1].bwsState?.keys?.["bone-leg"]?.[0]?.frame !== 6) {
    throw new Error("Minecraft project serialization must retain every clip, the active clip, and its edited keys.");
  }
}
{
  const context = { THREE, rigBones: [], rigPoseChannels: new Map() };
  context.boneById = id => context.rigBones.find(bone => bone.id === id) || null;
  vm.createContext(context);
  vm.runInContext(functionSource(minecraftSource, "resolveBlockbenchBoneRestTransforms"), context);
  const root = {
    id: "root", parentId: null,
    position: new THREE.Vector3(), rotation: new THREE.Vector3(), tail: new THREE.Vector3(),
    blockbenchSourcePosition: new THREE.Vector3(0, 0, 0), blockbenchLocalRotation: new THREE.Vector3(0, Math.PI / 2, 0)
  };
  const child = {
    id: "child", parentId: "root",
    position: new THREE.Vector3(), rotation: new THREE.Vector3(), tail: new THREE.Vector3(),
    blockbenchSourcePosition: new THREE.Vector3(1, 0, 0), blockbenchLocalRotation: new THREE.Vector3()
  };
  context.rigBones.push(root, child);
  context.resolveBlockbenchBoneRestTransforms();
  if (Math.abs(child.position.z + 1) > 1e-6 || Math.abs(child.position.x) > 1e-6) {
    throw new Error("Nested Blockbench bone origins must follow their parent rotation in the imported rest pose.");
  }
}

{
  const context = { THREE, rigBones: [], rigPoseChannels: new Map() };
  context.boneById = id => context.rigBones.find(bone => bone.id === id) || null;
  vm.createContext(context);
  vm.runInContext([
    "boneQuaternionFromRotation",
    "resolveBoneRestFrame",
    "refreshRigRestFrames",
    "poseBoneWithChildren",
    "poseRigHierarchy"
  ].map(name => functionSource(riggingSource, name)).join("\n"), context);
  const root = {
    id: "root", parentId: null,
    position: new THREE.Vector3(0, 2, 0), bindPosition: new THREE.Vector3(0, 1, 0),
    rotation: new THREE.Vector3(), bindRotation: new THREE.Vector3(),
    tail: new THREE.Vector3(0, 2.25, 0), bindTail: new THREE.Vector3(0, 1.25, 0), tailOffset: new THREE.Vector3(0, .25, 0)
  };
  const child = {
    id: "child", parentId: "root",
    position: new THREE.Vector3(1, 2, 0), bindPosition: new THREE.Vector3(1, 2, 0),
    rotation: new THREE.Vector3(), bindRotation: new THREE.Vector3(),
    tail: new THREE.Vector3(1, 2.25, 0), bindTail: new THREE.Vector3(1, 2.25, 0), tailOffset: new THREE.Vector3(0, .25, 0)
  };
  context.rigBones.push(root, child);
  context.poseRigHierarchy();
  if (Math.abs(root.position.y - 2) > 1e-6 || Math.abs(child.position.y - 3) > 1e-6) {
    throw new Error("Animated root translation must move the complete child hierarchy without separating model parts.");
  }

  context.rigPoseChannels.clear();
  const torso = {
    id: "torso", parentId: null,
    position: new THREE.Vector3(), bindPosition: new THREE.Vector3(),
    rotation: new THREE.Vector3(), bindRotation: new THREE.Vector3(),
    tail: new THREE.Vector3(0, .25, 0), bindTail: new THREE.Vector3(0, .25, 0)
  };
  const arm = {
    id: "arm", parentId: "torso",
    position: new THREE.Vector3(1, 0, 0), bindPosition: new THREE.Vector3(1, 0, 0),
    rotation: new THREE.Vector3(0, 0, Math.PI / 2), bindRotation: new THREE.Vector3(),
    tail: new THREE.Vector3(2, 0, 0), bindTail: new THREE.Vector3(2, 0, 0)
  };
  const hand = {
    id: "hand", parentId: "arm",
    position: new THREE.Vector3(2, 0, 0), bindPosition: new THREE.Vector3(2, 0, 0),
    rotation: new THREE.Vector3(), bindRotation: new THREE.Vector3(),
    tail: new THREE.Vector3(2.2, 0, 0), bindTail: new THREE.Vector3(2.2, 0, 0)
  };
  const otherArm = {
    id: "other-arm", parentId: "torso",
    position: new THREE.Vector3(-1, 0, 0), bindPosition: new THREE.Vector3(-1, 0, 0),
    rotation: new THREE.Vector3(), bindRotation: new THREE.Vector3(),
    tail: new THREE.Vector3(-2, 0, 0), bindTail: new THREE.Vector3(-2, 0, 0)
  };
  context.rigBones.splice(0, context.rigBones.length, torso, arm, hand, otherArm);
  context.poseRigHierarchy();
  if (Math.abs(hand.position.x - 1) > 1e-6 || Math.abs(hand.position.y - 1) > 1e-6) {
    throw new Error("Rotating a parent joint must carry its hand/item descendants around that joint.");
  }
  if (Math.abs(otherArm.position.x + 1) > 1e-6 || Math.abs(otherArm.position.y) > 1e-6) {
    throw new Error("Rotating one arm must not move an unrelated sibling branch.");
  }
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
    resolveSelectionTargets: mode => (
      mode === "faces"
        ? [...new Set(context.selectedFaces.map(face => face.mesh).filter(Boolean))]
        : (context.selected ? [context.selected] : [])
    ),
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

  const curvedPoints = Array.from({ length: 15 }, (_, index) => {
    const angle = index / 15 * Math.PI * 2;
    return new THREE.Vector3(Math.cos(angle), Math.sin(angle), Math.sin(angle * 3) * .16);
  });
  const curvedLoop = {
    points: curvedPoints,
    keys: curvedPoints.map(point => context.vertexKey(point)),
    edgeSignatures: new Set(curvedPoints.map((point, index) => [
      context.vertexKey(point),
      context.vertexKey(curvedPoints[(index + 1) % curvedPoints.length])
    ].sort().join("|")))
  };
  const curvedSource = new THREE.BufferGeometry();
  curvedSource.setAttribute("position", new THREE.Float32BufferAttribute([], 3));
  const curvedBasis = context.basisFromPoints(curvedPoints);
  const curvedBox = new THREE.Box3().setFromPoints(curvedPoints);
  const curvedDiagonal = curvedBox.getSize(new THREE.Vector3()).length();
  const curvedDeviation = curvedPoints.reduce((maximum, point) => Math.max(
    maximum,
    Math.abs(point.clone().sub(curvedBasis.center).dot(curvedBasis.zAxis))
  ), 0) / curvedDiagonal;
  const curvedPlan = context.safeHoleCapPlan(curvedSource, curvedLoop, { projection: "auto" });
  if (curvedDeviation <= .05 || curvedDeviation >= .08 || !curvedPlan.safe || curvedPlan.triangles.length !== 13) {
    throw new Error(`Find and Repair Holes must accept gently curved imported openings without accepting strongly folded loops. ${JSON.stringify({
      curvedDeviation,
      safe: curvedPlan.safe,
      reason: curvedPlan.reason,
      triangles: curvedPlan.triangles?.length
    })}`);
  }
  curvedSource.dispose();

  const foldedPoints = Array.from({ length: 15 }, (_, index) => {
    const angle = index / 15 * Math.PI * 2;
    return new THREE.Vector3(Math.cos(angle), Math.sin(angle), Math.sin(angle * 3) * .4);
  });
  const foldedLoop = {
    points: foldedPoints,
    keys: foldedPoints.map(point => context.vertexKey(point)),
    edgeSignatures: new Set(foldedPoints.map((point, index) => [
      context.vertexKey(point),
      context.vertexKey(foldedPoints[(index + 1) % foldedPoints.length])
    ].sort().join("|")))
  };
  const foldedPlan = context.safeHoleCapPlan(new THREE.BufferGeometry().setAttribute(
    "position",
    new THREE.Float32BufferAttribute([], 3)
  ), foldedLoop, { projection: "auto" });
  if (foldedPlan.safe || foldedPlan.reason !== "boundary is too twisted to cap safely") {
    throw new Error("Find and Repair Holes must continue refusing strongly folded boundaries.");
  }

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
    "removeDoublesPlan",
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
    "removeDoublesPlan",
    "geometryFromWeldedTriangles",
    "decimateNormalizedSettings",
    "decimateAttributeKey",
    "protectedDecimatePlan",
    "lodNormalizedSettings",
    "buildProtectedLodPlan",
    "buildLodMeshRepairPlan",
    "lodPartLevel",
    "buildGroupLodPlan"
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
  const allSeamSource = source.clone();
  const allSeamUvs = new Float32Array(allSeamSource.getAttribute("position").count * 2);
  for (let triangle = 0; triangle < allSeamSource.getAttribute("position").count / 3; triangle++) {
    const base = triangle * 6;
    const offset = (triangle % 97) / 100;
    allSeamUvs.set([offset, 0, Math.min(1, offset + .01), 0, offset, .01], base);
  }
  allSeamSource.setAttribute("uv", new THREE.BufferAttribute(allSeamUvs, 2));
  const allSeamPlan = context.buildProtectedLodPlan(allSeamSource, {
    lod1: 10,
    lod2: 25,
    lod3: 65,
    featureAngle: 50,
    preserveBoundaries: true,
    preserveUvSeams: true,
    preserveMaterials: true
  });
  if (!allSeamPlan.safe || !allSeamPlan.usedUvSeamFallback || !allSeamPlan.reason.includes("UV seams covered every reducible edge")) {
    throw new Error(`LOD Generator must retain usable imported UVs without letting a pathological all-seam layout block every level. ${JSON.stringify({
      safe: allSeamPlan.safe,
      usedUvSeamFallback: allSeamPlan.usedUvSeamFallback,
      levels: allSeamPlan.levels.length,
      reason: allSeamPlan.reason
    })}`);
  }
  const duplicateSource = new THREE.BufferGeometry();
  const sourcePositions = [...source.getAttribute("position").array];
  const sourceUvs = [...source.getAttribute("uv").array];
  duplicateSource.setAttribute("position", new THREE.Float32BufferAttribute([...sourcePositions, ...sourcePositions], 3));
  duplicateSource.setAttribute("uv", new THREE.Float32BufferAttribute([...sourceUvs, ...sourceUvs], 2));
  const blockedDuplicatePlan = context.buildProtectedLodPlan(duplicateSource, {
    lod1: 10,
    lod2: 25,
    lod3: 65,
    featureAngle: 50,
    preserveBoundaries: true,
    preserveUvSeams: true,
    preserveMaterials: true
  });
  const repairPlan = context.buildLodMeshRepairPlan(duplicateSource);
  const repairedDuplicateSource = context.geometryFromWeldedTriangles(duplicateSource, repairPlan.triangles);
  const repairedLodPlan = context.buildProtectedLodPlan(repairedDuplicateSource, {
    lod1: 10,
    lod2: 25,
    lod3: 65,
    featureAngle: 50,
    preserveBoundaries: true,
    preserveUvSeams: true,
    preserveMaterials: true
  });
  if (
    blockedDuplicatePlan.safe
    || !repairPlan.safe
    || repairPlan.removedDuplicate !== plan.originalTriangles
    || repairPlan.afterTriangles !== plan.originalTriangles
    || repairPlan.nonManifoldEdgeCount !== 0
    || !repairedLodPlan.safe
    || repairedLodPlan.levels.length !== 3
    || repairedDuplicateSource.getAttribute("uv").count !== repairedDuplicateSource.getAttribute("position").count
  ) {
    throw new Error(`Repair Mesh for LOD must safely remove imported overlapping face layers and unblock protected LOD generation. ${JSON.stringify({
      blockedBeforeRepair: !blockedDuplicatePlan.safe,
      repairSafe: repairPlan.safe,
      removedDuplicate: repairPlan.removedDuplicate,
      expectedDuplicate: plan.originalTriangles,
      nonManifoldEdgesAfter: repairPlan.nonManifoldEdgeCount,
      lodSafeAfterRepair: repairedLodPlan.safe,
      levelsAfterRepair: repairedLodPlan.levels.length
    })}`);
  }
  const cube = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
  const groupPlan = context.buildGroupLodPlan({
    key: "group:test",
    groupId: "test",
    name: "Test Group",
    meshes: [
      { name: "Sphere", userData: { id: "sphere" }, geometry: source },
      { name: "Cube", userData: { id: "cube" }, geometry: cube }
    ]
  }, context.lodNormalizedSettings({
    lod1: 10,
    lod2: 25,
    lod3: 65,
    featureAngle: 50,
    preserveBoundaries: true,
    preserveUvSeams: true,
    preserveMaterials: true,
    hideGenerated: true
  }));
  if (
    !groupPlan.safe
    || groupPlan.parts.length !== 2
    || !groupPlan.levelTriangleCounts.every((count, index) => count < [groupPlan.originalTriangles, ...groupPlan.levelTriangleCounts][index])
  ) {
    throw new Error(`Grouped LOD must create complete progressively lighter levels while retaining low-poly parts. ${JSON.stringify({
      safe: groupPlan.safe,
      parts: groupPlan.parts.length,
      counts: [groupPlan.originalTriangles, ...groupPlan.levelTriangleCounts],
      reason: groupPlan.reason
    })}`);
  }
  groupPlan.parts.forEach(part => part.plan.levels.forEach(level => level.geometry.dispose()));
  plan.levels.forEach(level => level.geometry.dispose());
  blockedDuplicatePlan.levels.forEach(level => level.geometry.dispose());
  repairedLodPlan.levels.forEach(level => level.geometry.dispose());
  allSeamPlan.levels.forEach(level => level.geometry.dispose());
  allSeamSource.dispose();
  repairedDuplicateSource.dispose();
  duplicateSource.dispose();
  cube.dispose();
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
    resolveSelectionTargets: mode => (
      mode === "faces"
        ? [...new Set(context.selectedFaces.map(face => face.mesh).filter(Boolean))]
        : (context.selected ? [context.selected] : [])
    ),
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

if (!documentSource.includes('<script defer src="./app/studio-v49.60.81.js?v=49.60.81"></script>')) {
  throw new Error("index.html must load the direct-open classic studio bundle.");
}
for (const required of ["modelToolsMeshColorInput", "modelToolsApplyMeshColorBtn", "modelToolsPaintFacesBtn"]) {
  if (!documentSource.includes(required)) throw new Error(`Model Tools mesh coloring is missing ${required}.`);
}
for (const required of ["applySolidColorToMeshes", "paintSelectedFacesSolidColor", 'recordHistory("paint selected faces")']) {
  if (!moduleSources.get("panels")?.includes(required)) throw new Error(`Mesh coloring behavior is missing ${required}.`);
}
for (const required of ["exportGameCharacterBtn", "exportGameCharacterPackage", "gameCharacterCompactGlbSkins", "gameCharacterLodInput", "gameCharacterBuildGlb", "GLTFExporter"]) {
  if (!documentSource.includes(required) && !applicationSource.includes(required)) {
    throw new Error(`Realtime game-character export is missing ${required}.`);
  }
}
for (const required of ['bone.role === "itemSocket"', '? "equipment" : "rigidPart"', "const boundObjects = objects.filter"]) {
  if (!moduleSources.get("import-export")?.includes(required)) {
    throw new Error(`Realtime game-character export is missing detachable-part or hand-slot support: ${required}.`);
  }
}
if ((documentSource.match(/id="animationSection"/g) || []).length !== 1 || documentSource.includes("animationSectionDuplicate")) {
  throw new Error("The studio must expose exactly one Timeline / Animator panel.");
}
for (const skeletalRequirement of ["new THREE.SkinnedMesh", "new THREE.Skeleton", 'setAttribute("skinIndex"', 'setAttribute("skinWeight"', "applySkinnedPose"]) {
  if (!applicationSource.includes(skeletalRequirement)) throw new Error(`Missing real skeletal animation requirement: ${skeletalRequirement}`);
}
const walkRig = humanWalkCycle.editor?.rigging;
const requiredWalkBones = ["walk-root", "walk-thigh-l", "walk-shin-l", "walk-foot-l", "walk-thigh-r", "walk-shin-r", "walk-foot-r"];
if (!walkRig || requiredWalkBones.some(id => !walkRig.bones.some(bone => bone.id === id))) {
  throw new Error("The human walk sample must contain a complete parented leg skeleton.");
}
for (const kneeId of ["walk-shin-l", "walk-shin-r"]) {
  const keys = walkRig.animation?.keys?.[kneeId] || [];
  if (keys.length !== 7 || keys.some(key => Number(key.rotation?.[0]) < 0)) {
    throw new Error(`${kneeId} must use seven forward-flexing walk poses without a reversed knee.`);
  }
}
if (applicationSource.includes('camera.up.set(0, viewName === "top" ? 0 : 1')) {
  throw new Error("Top view must not replace the OrbitControls world-up axis.");
}
if (documentSource.includes('type="module" src="./app/studio-v49.50.0.js') || documentSource.includes('type="importmap"')) {
  throw new Error("Direct index opening cannot depend on module loading or an import map.");
}
if (!directBundle.startsWith("/* Generated from app/modules.")) {
  throw new Error("Missing generated direct-open studio bundle.");
}
for (const required of [
  "BoltWorks 3D AI Studio",
  "persistent-notices",
  "flex-direction: column;",
  "© 2026 Daniel Rydin",
  "BoltWorks branding and visual assets. All rights reserved.",
  "window.ModelerStudio",
  "tool-docking.js?v=49.60.81",
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
  "pullToTargetBtn",
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
  "joint.layers.enable(0)",
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
  "descendantMeshesForGroup(sourceGroup.id)",
  "hierarchyPreserved: !!sourceGroup",
  "copyOrPasteStepRequired: false",
  "selected group or selected/checked parts",
  "function syncLiveMirrorPreview",
  "function toggleLiveMirror",
  "function applyLiveMirrorSelection",
  "function softMoveSelectedFaces",
  "function setPullToTargetSession",
  "function pullSelectedRegionToHit",
  "function modelTileGroundTargets",
  "gameAssetKitDetails",
  "function saveGameAssetMetadata",
  "function exportCharacterPackage",
  "boltworks-character-package",
  "modelTileHideFloorInput",
  "tile export floor anchor",
  "function shotCanvas(shot)",
  "function alphaBounds(source)",
  "const maxAnchorWidth",
  "anchorCenterX",
  "groundTargetsForRender",
  "materialSnapshots",
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
  "--scene-tree-content-width: 100%;",
  "overflow-x: hidden;\n  overflow-y: hidden;",
  "#addMeshBody {\n  overflow: visible;",
  "panelCollapseStoragePrefix",
  "Heart",
  "TransformControls",
  "function additiveSelectionRequested(event)",
  "event?.shiftKey || event?.ctrlKey || event?.metaKey",
  "Multi-select: Shift/Ctrl+click",
  'addObject({ shape: btn.dataset.add }, { select: true })',
  "candidates.checked.length === 1",
  "if (candidates.active.length >= 2) return uniqueMeshList(candidates.active)",
  "sourceGroupId: typeof lod.sourceGroupId",
  'key: `group:${record.id}:${groupMeshes.map(mesh => mesh.userData.id).join(",")}`',
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
  "context.rect(x, y, cellSize, cellSize)",
  "context.clip()",
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
  "Build Triangle",
  "Clear Triangle Points",
  "geometryWithManualTriangle",
  "Created one real triangle face",
  "noticeRailCollapseBtn",
  "Minimize Lower Panel",
  "Expand Lower Panel",
  "boltworks.bottomInfoCollapsed",
  "Marker tools",
  "Triangle editor tools",
  "toolbarSelectionToolsGroup",
  "toolbarLineToolsGroup",
  "toolbarMarkerToolsGroup",
  "toolbarTriEditorGroup",
  "Face edit tools",
  "Select Tri",
  "Paint",
  "Hover Select",
  "paintTriBtn",
  "paintTriInput",
  "modelToolsStencilBtn",
  "textureStencilBtn",
  "Open Stencil / Sigil Editor",
  "openTextureStencilEditor",
  "Created a UV layout",
  "latest editor clips",
  "Combat fully owns the upper body",
  "animationDeleteSelectedKeyBtn",
  "Delete Selected Key",
  "Delete All Keys at Frame",
  "Clear Entire Clip",
  "deleteSelectedAnimationKeys",
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
  "connectVerticesBtn",
  "Connect Vertices",
  "Choose Target Vertex",
  "Apply Connection",
  "pickConnectVertexTargetFromHit",
  "if (connectVerticesMode)",
  "handleConnectVerticesButton",
  "connectVerticesGuideGroup",
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
  "transformSnapSettings",
  "applyControlSnap",
  "applyRotationSnap",
  "setTranslationSnap",
  "setRotationSnap",
  "boneRotationStepInput",
  "Hold Ctrl or Shift for steps",
  "function syncBoneRotationSnap",
  "boneTransform.setRotationSnap(radians)",
  "boneJoystickGroup.visible = false",
  "armor-check",
  "function setObjectRigRole",
  "None of the checked parts are marked Armor",
  "Remove Armor Bone",
  "No extra mount object is added to the scene",
  "activeSkinRuntime?.threeBones?.get(bone.id)",
  "A mesh explicitly marked Skin & Bone is enough to restore the skinned",
  "applySkinnedPose(poses);\n    // The body and rigid equipment share one pose.",
  "elapsedFrames * frameDuration",
  "function updateAnimationPlaybackPanel()",
  "{ lightweightPanel: true }",
  "item.object !== activeSkinRuntime?.avatar",
  "if (object === activeSkinRuntime?.avatar) continue;",
  "function setTPoseFittingMode(enabled)",
  "function finishArmorFittingTransform(controlObject)",
  "function mirroredArmorForObject(source)",
  "function addGripHandRig()",
  "Grip Socket ${side}",
  "const oldBoneObjects = new Set(activeSkinRuntime.threeBones.values())",
  "Grip hands fitted: added ${added} and realigned ${realigned}",
  "setScaleSnap",
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
  "pullToTargetBtn",
  "pushFaceBtn",
  "markerGroup",
  "markerHelpers",
  "selectedFaces",
  "selectedTriangles",
  "activeTransformMode",
  "textureLibraryUrlInput",
  "loadTextureLibraryUrlBtn",
  "addLibraryTextureBtn",
  "applyTextureLibraryUrl",
  "selectedTargets.length ? selectedTargets : [...objects]",
  "Use on Model",
  "els.textureBtn.disabled = false",
  "els.addLibraryTextureBtn.disabled = false",
  "alwaysAvailableTextureControls",
  "els.textureFile,",
  "els.textureBtn.textContent = \"Add Texture\"",
  "els.textureFile.value = \"\"",
  "Added texture ${libraryName || file.name} to the project library",
  "if (els.showBonesInput) els.showBonesInput.checked = false",
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
  "pasteCopiedTrianglesMirrored",
  "pasteMirroredTriBtn",
  "Paste Mirrored",
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
  "pullSelectedRegionToHit",
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
  "insertSpecsIntoScene",
  "insertObjFiles",
  "insertObjBtn",
  "existing workspace parts were kept",
  "exportObjMaterialBundle",
  "mtllib",
  "map_Kd",
  "OBJ + MTL material bundle",
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
  "buildLodMeshRepairPlan",
  "repairSelectedMeshForLod",
  "repairLodMeshBtn",
  "Repair Mesh for LOD",
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
  "syncMinecraftTextureRendering",
  "material.map.magFilter = THREE.NearestFilter",
  "material.map.minFilter = THREE.NearestFilter",
  "material.map.generateMipmaps = false",
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
  "mesh.material.depthWrite = materialOpacity >= .9",
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

for (const regression of ["restoreTriangleWinding", "repairedTriangleWinding", "meshRebuildLegacy"]) {
  if (html.includes(regression)) {
    throw new Error(`Relief reconstruction regression returned: ${regression}`);
  }
}

if (!documentSource.includes("BoltWorks 3D AI Studio v49.60.81 Experimental") || !documentSource.includes("v49.60.81 Experimental preview")) {
  throw new Error("The document must expose the single canonical v49.60.81 version.");
}

if (!documentSource.includes('id="toolbarUndoGroup"') || !documentSource.includes('id="toolbarCameraControlsLauncherGroup"')) {
  throw new Error("Minecraft and animator workspaces must expose dedicated Undo and Camera Controls toolbar groups.");
}
if (!styleSource.includes(":not(#toolbarCameraControlsLauncherGroup):not(#toolbarUndoGroup)")) {
  throw new Error("Animator workspace must keep Undo and Camera Controls visible.");
}
if (!moduleSources.get("meshes").includes('context.imageSmoothingEnabled = false;') || !styleSource.includes("image-rendering: pixelated;")) {
  throw new Error("The texture editor must preserve crisp Minecraft pixels while zooming.");
}
for (const textureEditorFeature of [
  'id="textureEditorPartSelect"',
  'id="textureEditorPixelPen"',
  "function switchTextureEditorPart(meshId)",
  "const isolatedTriangles = selectedTriangles.length ? selectedTriangles : allTriangles;"
]) {
  if (!html.includes(textureEditorFeature)) throw new Error(`Missing texture editor part/pixel/isolation feature: ${textureEditorFeature}`);
}
for (const exactPaintPreviewFeature of [
  "function textureEditorPenStampRect(point, settings)",
  "const size = Math.max(1, Math.round(settings.pixelPerfect ? 1 : settings.size));",
  "context.fillRect(stamp.left, stamp.top, stamp.size, stamp.size);",
  "const stamp = textureEditorPenStampRect(sourcePoint, settings);",
  "internalLeft = drawRect.left + stamp.left * sourceScaleX;",
  "const preview = document.createElement(\"canvas\");",
  "context.imageSmoothingEnabled = false;",
  "Exact preview: ${sizeLabel} hard square",
  "Exact preview: ${sizeLabel} soft brush"
]) {
  if (!moduleSources.get("meshes").includes(exactPaintPreviewFeature)) throw new Error(`Missing exact pen/brush preview behavior: ${exactPaintPreviewFeature}`);
}
for (const fullTexturePaintFeature of [
  'id="textureEditorTextureUrl"',
  'id="textureEditorLoadUrlBtn"',
  'id="textureEditorChooseFileBtn"',
  'id="textureEditorTextureFile"',
  "async function loadTextureEditorTextureUrl()",
  "async function replaceTextureEditorBaseColor(dataUrl, textureName)",
  "if (els.textureEditorSelectedOnly?.checked) {"
]) {
  if (!html.includes(fullTexturePaintFeature)) throw new Error(`Missing full-texture/URL paint feature: ${fullTexturePaintFeature}`);
}
if (!styleSource.includes("grid-template-rows: auto auto auto auto minmax(0, 1fr) auto;") || !styleSource.includes("min-height: 44px;")) {
  throw new Error("The texture editor must reserve a visible row for its paint-tool controls.");
}
if (!styleSource.includes("grid-template-rows: auto auto minmax(44px, 1fr);") || !styleSource.includes("height: min(96vh, 1000px);")) {
  throw new Error("The texture editor must reserve visible, scrollable space for Layers.");
}
if (styleSource.includes('body[data-workspace="minecraft"] #cameraViewsSection,')) {
  throw new Error("Minecraft workspace must not hide Camera Controls.");
}

for (const attentionElement of ["aiViewerAttention", "aiViewerAttentionMessage", "aiViewerAttentionDirective"]) {
  if (!documentSource.includes(`id="${attentionElement}"`)) {
    throw new Error(`Missing Human AI Viewer attention element: ${attentionElement}`);
  }
}

for (const expectedDefault of [
  'id="reliefGridXInput" type="number" min="8" max="160" step="1" value="160"',
  'id="reliefGridYInput" type="number" min="8" max="220" step="1" value="220"',
  'id="reliefThresholdInput" type="number" min="0" max="255" step="1" value="70"',
  'id="reliefDetailInput" type="number" min="0" max="200" step="5" value="100"',
  '<option value="single">Single height image</option>',
  '<option value="sheet" selected>View sheet to one model</option>',
  '<option value="hybridV47" selected>Hybrid — continuous mesh + V30 shape</option>',
  '<option value="recoveredV30">Recovered V30 original</option>',
  '<option value="solidVisualHull">Four-view detailed human</option>'
]) {
  if (!html.includes(expectedDefault)) throw new Error(`Missing detailed view-sheet default: ${expectedDefault}`);
}
if (html.includes('id="reliefSmoothInput"') || moduleSources.get("viewport").includes("reliefSmoothInput")) {
  throw new Error("Image-to-Mesh smoothing must be automatic, not exposed as a user control.");
}
if (!meshesSource.includes("const smoothPasses = 4;")) {
  throw new Error("Image-to-Mesh must retain the verified automatic source-matching surface finish.");
}
for (const detailedMeshRequirement of ["createDetailedImageMeshGeometry", 'buildMode === "solidVisualHull"', 'buildMode === "recoveredV30"', 'buildMode === "hybridV47"', "continuousV30SilhouetteHybridV47", "v30SilhouetteGuideOnly", "continuousSolidTopology", "guideTrianglesExcluded", "reducedChestHipDepth", "sourceDrivenFaceFingerDetail", "sourceLikeLowerDetailScaleMeshV30Recovered", "recoveredFromCommit", "solidVisualHullV45", "regionalDetailScale", "v30SourceReliefRecovery", "fourSurfaceDetail", "multiScaleSurfaceDetail", "sizePreservingSurfaceSmoothing"]) {
  const source = ["continuousV30SilhouetteHybridV47", "v30SilhouetteGuideOnly", "continuousSolidTopology", "guideTrianglesExcluded", "reducedChestHipDepth", "sourceDrivenFaceFingerDetail", "sourceLikeLowerDetailScaleMeshV30Recovered", "recoveredFromCommit", "solidVisualHullV45", "regionalDetailScale", "v30SourceReliefRecovery", "fourSurfaceDetail", "multiScaleSurfaceDetail", "sizePreservingSurfaceSmoothing"].includes(detailedMeshRequirement) ? directBundle : applicationSource;
  if (!source.includes(detailedMeshRequirement)) throw new Error(`Missing detailed image-to-mesh requirement: ${detailedMeshRequirement}`);
}
if (!moduleSources.get("plugins").includes('id: "image-relief-mesh-lab"') || !moduleSources.get("plugins").includes('name: "Image to Mesh"')) {
  throw new Error("The restored Image-to-Mesh panel must be enabled in the studio UI.");
}
for (const minecraftRequirement of [
  'id="workspaceSelect"',
  'id="importBbmodelBtn"',
  'id="minecraftSection"',
  'id="minecraftExportJavaBtn"',
  'id="pluginManagerSection"',
  'id="minecraftAddColorInput"',
  'id="minecraftOutputColorInput"',
  'id="minecraftSaveTextureBtn"',
  'id="minecraftAnimationSelect"',
  'id="minecraftPlayerRigBtn"',
  'id="minecraftPlayerRigStatus"'
]) {
  if (!html.includes(minecraftRequirement)) throw new Error(`Missing Minecraft/plugin UI requirement: ${minecraftRequirement}`);
}
for (const minecraftSourceRequirement of [
  "importBlockbenchProject",
  "collectBlockbenchHierarchy",
  "importBlockbenchAnimation",
  "activateMinecraftAnimation",
  "resolveBoneRestFrame",
  "serializeMinecraftWorkspace",
  "restoreMinecraftWorkspace",
  "minecraftPlayerRigBoneMap",
  "minecraftPlayerAnimationPresets",
  "addMinecraftPlayerRigAnimations",
  'clip("Idle"',
  'clip("Wave"',
  'clip("Walk"',
  'clip("Run"',
  'clip("Sprint"',
  'clip("Jump"',
  'clip("Fight"',
  'clip("Block"',
  'clip("Crawl"',
  'clip("Swim"',
  "minecraftObjectsByBone",
  "generateNeoForgeModelSource",
  "generateNeoForgeAnimationsSource",
  "exportNeoForgeJava",
  "initializeMinecraftTools",
  'color: "#ffffff", roughness: 1',
  "textureHasTransparency: !!texture",
  "material.transparent = false",
  "material.alphaTest = .1",
  "mesh.receiveShadow = !minecraft",
  "const flatAxes =",
  "flatAxes[index]",
  "THREE.NearestFilter",
  "tintMinecraftTexture",
  "textureDataUrl"
]) {
  if (!applicationSource.includes(minecraftSourceRequirement)) throw new Error(`Missing Minecraft source requirement: ${minecraftSourceRequirement}`);
}
for (const clipName of ["Walk", "Run", "Sprint"]) {
  const clipStart = applicationSource.indexOf(`clip("${clipName}"`);
  const nextClip = applicationSource.indexOf("\n    clip(\"", clipStart + 1);
  const clipSource = applicationSource.slice(clipStart, nextClip < 0 ? undefined : nextClip);
  const bodyTrack = clipSource.match(/^\s*body:\s*(.+)$/m)?.[1] || "";
  const bodyRotations = [...bodyTrack.matchAll(/\[\d+,\s*\[([^\]]+)\]/g)].map(match => match[1]);
  if (!bodyRotations.length || bodyRotations.some(rotation => rotation.split(",").some(value => Number(value.trim()) !== 0))) {
    throw new Error(`${clipName} must keep the Minecraft player body upright at every keyframe.`);
  }
  const headTrack = clipSource.match(/^\s*head:\s*(.+)$/m)?.[1] || "";
  const headRotations = [...headTrack.matchAll(/\[\d+,\s*\[([^\]]+)\]/g)].map(match => match[1]);
  if (!headRotations.length || headRotations.some(rotation => rotation.split(",").some(value => Number(value.trim()) !== 0))) {
    throw new Error(`${clipName} must keep the Minecraft player head upright at every keyframe.`);
  }
}
{
  const waveStart = applicationSource.indexOf('clip("Wave"');
  const nextClip = applicationSource.indexOf("\n    clip(\"", waveStart + 1);
  const waveSource = applicationSource.slice(waveStart, nextClip < 0 ? undefined : nextClip);
  if (waveStart < 0 || !waveSource.includes("leftArm:") || !waveSource.includes("rightArm:")) {
    throw new Error("The Minecraft Wave preset must animate the semantic left arm while preserving the right arm.");
  }
  const leftWaveTrack = waveSource.match(/^\s*leftArm:\s*(.+)$/m)?.[1] || "";
  const raisedAngles = [...leftWaveTrack.matchAll(/\[\d+,\s*\[([^\]]+)\]/g)]
    .map(match => match[1].split(",").map(value => Number(value.trim())));
  if (raisedAngles.length < 5 || raisedAngles.some(rotation => rotation[0] < 20 || Math.abs(rotation[2]) < 100)) {
    throw new Error("The Minecraft Wave preset must keep the left arm raised beside the head throughout its loop.");
  }
}
if (!moduleSources.get("rigging")?.includes('let boneGizmoToolMode = "translate"')
  || !moduleSources.get("rigging")?.includes("let boneGizmoEnabled = false")) {
  throw new Error("The bone gizmo must begin inactive in Move mode and preserve the user's explicit tool choice.");
}
if ((moduleSources.get("meshes").match(/syncMinecraftTextureRendering\(mesh\);/g) || []).length < 2) {
  throw new Error("Minecraft pixel filtering must be reapplied when textured meshes are created or restored by Undo.");
}
for (const skinImportRequirement of [
  "function expandBlockbenchSkinProject(project)",
  "project.skin_model || \"steve\"",
  "const rightArmFrom = [4, 12, -2]",
  "const leftArmFrom = [-4 - armWidth, 12, -2]",
  "group(\"right-leg\", \"right_leg\", [2, 12, 0]",
  "group(\"left-leg\", \"left_leg\", [-2, 12, 0]",
  "group(\"right-arm\", \"right_arm\"",
  "Built the ${parsedProject.skin_model || \"steve\"} body"
]) {
  if (!moduleSources.get("minecraft").includes(skinImportRequirement)) throw new Error(`Missing Blockbench skin import requirement: ${skinImportRequirement}`);
}
if (!moduleSources.get("import-export").includes("minecraft: serializeMinecraftWorkspace()") || !moduleSources.get("import-export").includes("restoreMinecraftWorkspace(editor.minecraft || null)")) {
  throw new Error("Saved projects must preserve every named Minecraft animation clip and the active clip.");
}
if (!moduleSources.get("rigging").includes("object.quaternion.copy(rotationDelta)") || !moduleSources.get("rigging").includes("boneQuaternion")) {
  throw new Error("Rigid animation bindings must use quaternion deltas so nested legs cannot wrap into full spins.");
}
if (!moduleSources.get("rigging").includes("bone.position.copy(bone.bindPosition)") || !moduleSources.get("rigging").includes("bone.rotation.copy(bone.bindRotation)")) {
  throw new Error("Animation frame evaluation must restart from the bind pose so reverse scrubbing is absolute and reversible.");
}
if (moduleSources.get("rigging").includes("function resolveAnimatedBoneHierarchy()")) {
  throw new Error("Animation playback must not reinterpret the editor's world-space rotations through a second hierarchy evaluator.");
}
for (const rotationConsistencyRequirement of [
  "poseRigHierarchy();",
  "bindingRest: serializeAnimationBindingRest()",
  "restoreSerializedAnimationBindingRest(data.animation?.bindingRest)",
  "rebuildMinecraftAnimationBindingRest()",
  "Undo/project snapshots already contain the exact live mesh and bone pose",
  "bindPosition: bone.bindPosition?.toArray()",
  "bindRotation: bone.bindRotation?.toArray()"
]) {
  if (!moduleSources.get("rigging").includes(rotationConsistencyRequirement)) throw new Error(`Missing animation/Undo rotation consistency requirement: ${rotationConsistencyRequirement}`);
}
if (!moduleSources.get("rigging").includes("function prepareAnimationBindingRest()") || !moduleSources.get("rigging").includes("captureAnimationBindingRest()")) {
  throw new Error("Rigid meshes must capture their binding rest from the true bind skeleton before animation frame zero is applied.");
}
for (const glueRestRequirement of [
  "function initializeBoneRestState(",
  "function captureRigBindPose()",
  "if (!bonesGlued && !activeSkinRuntime)",
  "object.userData.rigBoneId = closestBone.id"
]) {
  if (!moduleSources.get("rigging").includes(glueRestRequirement)) throw new Error(`Missing stable bone-glue requirement: ${glueRestRequirement}`);
}
if (!moduleSources.get("import-export").includes("rigBoneId: mesh.userData.rigBoneId || null") || !moduleSources.get("meshes").includes("rigBoneId: typeof rigBoneId")) {
  throw new Error("Custom rigid bone glue assignments must survive project save and load.");
}
if (moduleSources.get("panels").includes('animationToggle?.addEventListener("click"')) {
  throw new Error("Timeline collapse must use only the shared persisted panel handler, not a second animator-specific toggle.");
}
for (const emptyAnimationRequirement of ["function animationHasKeys()", "if (!animationHasKeys())", "Add at least one keyed pose before playing the animation."]) {
  if (!applicationSource.includes(emptyAnimationRequirement)) throw new Error(`Missing empty-animation safety requirement: ${emptyAnimationRequirement}`);
}
if (!moduleSources.get("plugins").includes('kind: "boltworks-plugin"') || !moduleSources.get("plugins").includes("validPluginManifest")) {
  throw new Error("The studio must expose the manifest-based plugin foundation.");
}
{
  const width = 300;
  const height = 160;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel++) data[pixel * 4 + 3] = 255;
  for (const [x0, x1] of [[10, 82], [112, 150], [188, 260]]) {
    for (let y = 8; y < 152; y++) for (let x = x0; x < x1; x++) {
      const offset = (y * width + x) * 4;
      const tone = 205 + ((x + y) % 36);
      data[offset] = data[offset + 1] = data[offset + 2] = tone;
    }
  }
  const hybrid = createDetailedImageMeshGeometry({
    imageData: { width, height, data }, sourceMode: "sheet", buildMode: "hybridV47",
    cols: 56, rows: 96, scale: 6, depth: .9, back: .22, threshold: 70, smoothPasses: 4
  });
  if (!hybrid.meta?.hybridV47 || !hybrid.meta?.v30SilhouetteGuideOnly || !hybrid.meta?.continuousSolidTopology || !hybrid.meta?.guideTrianglesExcluded || !hybrid.meta?.reducedChestHipDepth || !hybrid.meta?.sourceDrivenFaceFingerDetail || hybrid.meta?.guideCommit !== "4cf2f6f") {
    throw new Error("Hybrid Image-to-Mesh must keep continuous solid topology while using V30 only as a silhouette guide.");
  }
}
{
  const width = 400;
  const height = 160;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel++) data[pixel * 4 + 3] = 255;
  const fill = (x0, x1, y0 = 8, y1 = 152) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const offset = (y * width + x) * 4;
      data[offset] = data[offset + 1] = data[offset + 2] = 255;
    }
  };
  fill(10, 90);       // front
  fill(112, 154);     // left profile: deliberately deeper clothing
  fill(190, 212);     // right profile: slim side
  fill(250, 330);     // back
  const fourView = createDetailedImageMeshGeometry({
    imageData: { width, height, data }, sourceMode: "sheet", buildMode: "solidVisualHull",
    cols: 64, rows: 96, scale: 6, depth: .9, back: .22, threshold: 70, smoothPasses: 0
  });
  if (fourView.meta?.viewLayout !== "front-left-right-back" || !fourView.meta?.independentSideProfiles || fourView.meta?.viewRects?.length !== 4) {
    throw new Error("Detailed Image-to-Mesh must detect Front / Left / Right / Back and retain independent side profiles.");
  }
  if (!fourView.meta?.v30SourceReliefRecovery || !fourView.meta?.fourSurfaceDetail || !fourView.meta?.multiScaleSurfaceDetail || !(fourView.meta?.detailPeak > 0) || !(fourView.meta?.detailedVertexCount > 0)) {
    throw new Error("Detailed Image-to-Mesh must apply measurable source-driven surface relief.");
  }
  const boundsByHalf = side => {
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let offset = 0; offset < fourView.positions.length; offset += 3) {
      const x = fourView.positions[offset];
      if ((side < 0 && x >= -.5) || (side > 0 && x <= .5)) continue;
      minZ = Math.min(minZ, fourView.positions[offset + 2]);
      maxZ = Math.max(maxZ, fourView.positions[offset + 2]);
    }
    return maxZ - minZ;
  };
  if (!(boundsByHalf(-1) > boundsByHalf(1) + .08)) {
    throw new Error("Four-view reconstruction must keep asymmetric left/right depth instead of averaging both profiles.");
  }
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
if (!documentSource.includes('id="animationSheetViewSelect"') || !documentSource.includes('id="animationSheetFramesInput"') || !documentSource.includes('id="animationSheetExportBtn"') || !moduleSources.get("import-export").includes("async function saveAnimationMotionSheets")) {
  throw new Error("The multi-angle animation motion sheet exporter must remain available.");
}
if (!moduleSources.get("import-export").includes("transparent: true, useCurrentZoom: false")) {
  throw new Error("Animation motion sheets must render with transparent game-ready frames.");
}
if (!moduleSources.get("import-export").includes("setCameraToView(viewName") || !moduleSources.get("import-export").includes("renderer.setClearAlpha(0)")) {
  throw new Error("Transparent animation capture must reapply isolation after camera framing updates the viewport environment.");
}
if (!documentSource.includes('id="animationWebmExportBtn"') || !moduleSources.get("import-export").includes("async function exportAnimationWebm")) {
  throw new Error("The transparent WebM animation exporter must remain available.");
}
if (!documentSource.includes('id="animationMp4ExportBtn"') || !moduleSources.get("import-export").includes("async function exportAnimationMp4") || !moduleSources.get("panels").includes("exportAnimationMp4")) {
  throw new Error("Animation export must provide local-server MP4 conversion.");
}
if (!documentSource.includes('id="animationExportRangeSelect"') || !moduleSources.get("import-export").includes("function animationExportEndFrame") || !moduleSources.get("panels").includes("animationExportRangeSelect")) {
  throw new Error("Animation exports must support current-frame and full-animation ranges.");
}
if (!documentSource.includes('id="animatorWorkspaceOpenBtn"') || documentSource.includes('id="animatorWorkspaceCloseBtn"') || !documentSource.includes('id="animatorClipSelect"')) {
  throw new Error("The dedicated Animator workspace navigation and clip selector must remain available.");
}
if (!moduleSources.get("animator-workspace")?.includes("function setAnimatorWorkspace") || !moduleSources.get("rigging").includes("animation-timeline-grid") || !moduleSources.get("rigging").includes("function deleteAnimationFrameKeys")) {
  throw new Error("The dedicated Animator workspace must provide a readable timeline and frame-key editing.");
}
if (!moduleSources.get("animator-workspace")?.includes("setAnimatorWorkspace(!animatorWorkspaceActive)") || !moduleSources.get("animator-workspace")?.includes('"Back to Modeling" : "Animator Workspace"')) {
  throw new Error("The top Animator Workspace button must toggle both entering and leaving animation mode.");
}
if (!documentSource.includes('id="animatorTimelineCollapseBtn"') || !moduleSources.get("animator-workspace")?.includes("function setAnimatorTimelineCollapsed") || !styleSource.includes(".app.animator-mode.timeline-collapsed")) {
  throw new Error("The Animator timeline must be minimizable while keeping the workspace open.");
}
if (!documentSource.includes('id="selectTargetBoneBtn"') || !documentSource.includes('id="selectTargetSkinBtn"') || !documentSource.includes('id="selectTargetArmorBtn"') || !moduleSources.get("rigging")?.includes("function rigTargetedObjectHit") || !moduleSources.get("panels")?.includes("viewportSelectionTarget === \"bone\"")) {
  throw new Error("Animator viewport selection must be targetable to bones, skin, or armor.");
}
if (!documentSource.includes('id="modelSelectTargetAllBtn"') || !documentSource.includes('id="modelSelectTargetSkinBtn"') || !documentSource.includes('id="modelSelectTargetArmorBtn"') || !documentSource.includes('id="modelSelectTargetBoneBtn"') || !moduleSources.get("rigging")?.includes("function setModelingSelectionTarget") || !moduleSources.get("rigging")?.includes("function activeViewportSelectionTarget") || !moduleSources.get("rigging")?.includes("function viewportTargetedObjectHit") || !moduleSources.get("rigging")?.includes("if (!activeViewportSelectionTargetsBones()) return null") || !moduleSources.get("panels")?.includes("const viewportSelectionTarget = activeViewportSelectionTarget()")) {
  throw new Error("Modeling and Animator viewport selection filters must prevent skin, armor, and bone picking from bypassing the chosen target.");
}
if (documentSource.includes('id="tPoseFittingBtn"') || !moduleSources.get("rigging")?.includes('const T_POSE_CLIP_ID = "__t_pose_fitting__"') || !moduleSources.get("rigging")?.includes("T-Pose / Rig Fitting</option>") || !moduleSources.get("animator-workspace")?.includes("T-Pose / Rig Fitting</option>") || !moduleSources.get("rigging")?.includes("restoreAnimationBindPose({ render: false });") || !moduleSources.get("rigging")?.includes("if (tPoseFittingMode) {\n    animationState.playing = false;") || !moduleSources.get("meshes")?.includes("const animatorRigObjectTransform") || !moduleSources.get("meshes")?.includes("const selectedStoredPivotActive = !animatorRigObjectTransform")) {
  throw new Error("T-Pose must be a dedicated Animation Clip menu state that restores and holds the fitted bind pose instead of a separate mode button.");
}
if (!moduleSources.get("rigging")?.includes("function restoreAnimationBindPose({ render = true } = {}) {\n  // A real clip leaves its local pose channels cached") || !moduleSources.get("rigging")?.includes("rigPoseChannels.set(bone.id, {\n      position: bone.position.clone(),\n      rotation: bone.rotation.clone()")) {
  throw new Error("T-Pose restore must replace stale animation channels with the fitted bind pose before hierarchy resolution.");
}
if (!moduleSources.get("rigging")?.includes("function rebaseAnimationKeysToBindPose(previousBindPose)") || !moduleSources.get("rigging")?.includes("const animationDelta = keyedQuaternion.multiply(oldBindQuaternion.clone().invert())") || !moduleSources.get("rigging")?.includes("const rebasedQuaternion = animationDelta.multiply(newBindQuaternion)") || !moduleSources.get("rigging")?.includes("rebaseAnimationKeysToBindPose(previousBindPose);")) {
  throw new Error("T-Pose Fitting and Glue must rebase every animation clip onto the newly fitted bind pose instead of restoring old absolute bone transforms.");
}
if (!moduleSources.get("rigging")?.includes("function repairMissingAnimationBindingRest()") || !moduleSources.get("rigging")?.includes("repairMissingAnimationBindingRest();") || !moduleSources.get("rigging")?.includes("if (!tPoseFittingMode) setTPoseFittingMode(true);") || !moduleSources.get("rigging")?.includes("Bone-to-part assignments were preserved so every limb can be glued again.")) {
  throw new Error("Glue must repair missing rigid limb bindings and always capture its rest state from T-Pose / Rig Fitting.");
}
if (!documentSource.includes('id="centerPivotBtn"') || !moduleSources.get("meshes")?.includes('["translate", "rotate", "scale"].includes(activeTransformMode)') || !moduleSources.get("meshes")?.includes("transform.attach(groupPivot)")) {
  throw new Error("A stored or centered single-mesh pivot must position the Move, Rotate, and Scale gizmos consistently.");
}
if (!documentSource.includes('<span>Mirror L/R</span>') || !moduleSources.get("rigging")?.includes("function armorSide") || !moduleSources.get("rigging")?.includes("exactNameMatches") || !moduleSources.get("rigging")?.includes("rememberArmorMirrorPair") || !moduleSources.get("rigging")?.includes("function updateArmorBindingRest") || !moduleSources.get("rigging")?.includes("no opposite armor counterpart was found") || moduleSources.get("rigging")?.includes("if (!tPoseFittingMode || !mirrorBoneEdits) return null")) {
  throw new Error("Armor fitting must expose Mirror L/R beside the target selectors, find opposite armor beyond strict bone assignments, and remain active outside T-Pose Fitting.");
}
if (!documentSource.includes('id="rigTransformToolLabel"') || !moduleSources.get("rigging")?.includes("function setRigTargetTransformMode") || !moduleSources.get("rigging")?.includes("function ensureRigObjectMoveTool") || !moduleSources.get("panels")?.includes('setRigTargetTransformMode("translate")')) {
  throw new Error("Skin and armor selection must activate the regular object Move/Rotate gizmo from the Animator side panel.");
}
if (!documentSource.includes('id="boneModeScaleBtn"') || !moduleSources.get("panels")?.includes('setRigTargetTransformMode("scale")') || !documentSource.includes('id="surfaceTransformModelBtn"') || !documentSource.includes('id="surfaceTransformSelectionBtn"') || !documentSource.includes('id="surfaceScaleGizmoBtn"') || !documentSource.includes('id="surfaceRotateGizmoBtn"') || !documentSource.includes('id="surfaceScaleAllAxesBtn"') || !moduleSources.get("meshes")?.includes("function setSurfaceTransformTarget") || !moduleSources.get("meshes")?.includes("function setSurfaceScaleAllAxes") || !moduleSources.get("meshes")?.includes("function updateSurfaceTransformGuides") || !moduleSources.get("meshes")?.includes("function surfacePointMapsScaleHandlePoint") || !moduleSources.get("meshes")?.includes("function scaleSelectedSurfaceByWorldFactors") || !moduleSources.get("meshes")?.includes("scaleHeldSideFromCenter") || !moduleSources.get("meshes")?.includes("oneSided: surfaceGizmoOneSidedScale") || !moduleSources.get("meshes")?.includes("function rotateSelectedSurfaceByWorldQuaternion") || !moduleSources.get("meshes")?.includes("function mirroredSurfacePointMaps") || !moduleSources.get("meshes")?.includes("mirroredMovement.x *= -1") || !moduleSources.get("viewport")?.includes("surfaceScaleOriginMarker") || !moduleSources.get("viewport")?.includes("surfaceScaleAnchorMarker") || !moduleSources.get("viewport")?.includes("surfaceScaleAnchorLine") || !moduleSources.get("viewport")?.includes("surfaceMirrorDotTexture") || !moduleSources.get("viewport")?.includes("surfaceMirrorGhostMarker")) {
  throw new Error("Animator armor/skin editing and Whole Face surface editing must provide model/selection transform targeting with interactive Move, Rotate, and Scale gizmos.");
}
if (documentSource.includes('id="skeletonModeInput"') || documentSource.includes("Skeleton Mode") || moduleSources.get("rigging")?.includes("skeletonDisplayMode")) {
  throw new Error("The unreliable Skeleton Mode must be removed from the editor and saved rig state.");
}
if (!documentSource.includes('id="newWorkspaceBtn"') || !moduleSources.get("autosave-update")?.includes("async function clearBwsRecoveryRecord") || !moduleSources.get("panels")?.includes("New empty workspace started")) {
  throw new Error("Project controls must provide a recovery-safe New Workspace action.");
}
if (moduleSources.get("rigging")?.includes("min-width:${timelineWidth}px") || !moduleSources.get("rigging")?.includes("--timeline-grid-size:${timelineGridSize}%") || !styleSource.includes("overflow-x: hidden") || !styleSource.includes("grid-template-columns: var(--animation-track-label-width, clamp(130px, 14vw, 190px)) minmax(0, 1fr)")) {
  throw new Error("Animator bone tracks must scale to the available screen width without a horizontal scrollbar.");
}
if (!styleSource.includes("width: calc(100% - var(--animation-track-label-width) - 2px + var(--animation-scrubber-thumb-size) - var(--animation-timeline-scrollbar-width, 0px))") || !styleSource.includes("margin-left: calc(var(--animation-track-label-width) + 1px - var(--animation-scrubber-thumb-half))") || !styleSource.includes(".animation-scrubber::-webkit-slider-thumb") || !styleSource.includes("padding: 0;\n  border: 0;") || !moduleSources.get("rigging")?.includes("offsetWidth - els.animationTrackList.clientWidth - borderWidth")) {
  throw new Error("The animation scrubber must line up with the frame lane after the bone-name column.");
}
if (moduleSources.get("import-export")?.includes("groupCheck.indeterminate") || !moduleSources.get("import-export")?.includes("tree-group-disclosure") || !moduleSources.get("import-export")?.includes("collapsedSceneGroupIds") || !styleSource.includes(".app.animator-mode .tree-group-count") || !styleSource.includes("grid-template-columns: 220px minmax(0, 1fr) 300px")) {
  throw new Error("The Animator hierarchy must use compact collapsible groups without marking ancestor groups as selected.");
}
if (!moduleSources.get("import-export")?.includes("group-info-btn") || !moduleSources.get("import-export")?.includes("openGroupEditor(record.id)") || !styleSource.includes(".app.animator-mode .object-row") || !styleSource.includes("display: none;")) {
  throw new Error("Animator hierarchy groups must expose a separate information button without overflowing individual mesh rows.");
}
if (!documentSource.includes('id="referenceViewportsToggleBtn"') || !moduleSources.get("import-export")?.includes("function setReferenceViewportsCollapsed") || !moduleSources.get("panels")?.includes("referenceViewportsToggleBtn") || !styleSource.includes(".viewport.reference-views-collapsed")) {
  throw new Error("The Front and Side reference view column must have a compact collapse arrow.");
}
if (!documentSource.includes('id="animationVideoDurationInput"') || !moduleSources.get("import-export")?.includes("Math.max(1, Math.round(videoDurationSeconds * fps))") || !moduleSources.get("panels")?.includes("durationSeconds: Number(els.animationVideoDurationInput?.value) || 6")) {
  throw new Error("WebM and MP4 animation exports must loop to the selected video duration.");
}
if (!documentSource.includes('id="animationSequenceClipSelect"') || !documentSource.includes('id="animationUseSequenceInput"') || !moduleSources.get("minecraft")?.includes("animationSequenceClipIndices") || !moduleSources.get("minecraft")?.includes("previewMinecraftAnimationSequence") || !moduleSources.get("minecraft")?.includes("animationSequence: animationSequenceClipIndices()")) {
  throw new Error("Connected animation sequences must be editable, previewable, and saved with Minecraft projects.");
}
if (!documentSource.includes('id="animationVideoQualitySelect"') || !moduleSources.get("import-export")?.includes("qualityScale = 1.5") || !moduleSources.get("import-export")?.includes("renderer.setPixelRatio(Math.min(4") || !moduleSources.get("import-export")?.includes("renderConnectedAnimationWebm")) {
  throw new Error("Animation video export must support supersampled high-quality connected sequences.");
}
if (!documentSource.includes('id="animationVideoLengthModeSelect"') || !moduleSources.get("import-export")?.includes("endOnLastClip ? plan.length") || !moduleSources.get("panels")?.includes('animationVideoLengthModeSelect?.value === "clips"')) {
  throw new Error("Video export must support fixed seconds or ending exactly on the final connected clip.");
}
if (!moduleSources.get("import-export")?.includes("Math.floor(30000 / Math.max(1, cellWidth))") || !moduleSources.get("import-export")?.includes("sourceFrame % (sheet.columns || sheet.shots.length)")) {
  throw new Error("High-resolution animation frames must wrap safely before reaching browser canvas width limits.");
}
if (!moduleSources.get("rigging")?.includes("function animationJumpLift") || !moduleSources.get("rigging")?.includes("Math.sin(Math.PI * phase)") || !moduleSources.get("rigging")?.includes("rigBones.filter(candidate => !candidate.parentId)") || !moduleSources.get("rigging")?.includes("pose.position.y += jumpLift")) {
  throw new Error("Jump clips must lift the root hierarchy through a visible vertical arc.");
}
for (const cleanCaptureRequirement of ["surfaceComponentMarker.visible = false", "modelingEdgesOverlay.visible = false", "knifeCutGuideGroup.visible = false", "meshIntegrityGuideGroup.visible = false"]) {
  if (!moduleSources.get("import-export")?.includes(cleanCaptureRequirement)) throw new Error(`Animation capture must hide editor helper: ${cleanCaptureRequirement}`);
}
if (!moduleSources.get("import-export")?.includes("front: new THREE.Vector3(0, 0, 1)") || !moduleSources.get("import-export")?.includes("back: new THREE.Vector3(0, 0, -1)")) {
  throw new Error("Front and Back animation exports must use Blockbench's canonical facing orientation.");
}
if (!moduleSources.get("viewport")?.includes("frontBoneCamera.position.set(0, 0, 100)")) {
  throw new Error("The Front X/Y reference camera must face the same side as the canonical Front work view.");
}
if (!moduleSources.get("rigging")?.includes("referenceCamera.position.set(state.center.x, state.center.y, state.center.z + 100)")) {
  throw new Error("Fitting the Front X/Y reference camera must preserve the canonical front direction.");
}
for (const referenceControl of ["frontReferencePanBtn", "frontReferenceFollowBtn", "frontReferenceFitBtn", "sideReferencePanBtn", "sideReferenceFollowBtn", "sideReferenceFitBtn"]) {
  if (!documentSource.includes(`id="${referenceControl}"`)) throw new Error(`Missing reference-view navigation control: ${referenceControl}`);
}
if (!moduleSources.get("rigging")?.includes("if (!state.initialized) fitBoneCamera")
  || !moduleSources.get("rigging")?.includes("function beginReferenceViewPan")
  || !moduleSources.get("rigging")?.includes("function updateReferenceViewFollowing")) {
  throw new Error("Reference views must preserve zoom on resize and support explicit panning, tool following, and model fitting.");
}
if (!moduleSources.get("meshes")?.includes('[["FRONT", "front"], ["BACK", "back"], ["LEFT", "left"], ["RIGHT", "right"]]')
  || !moduleSources.get("meshes")?.includes("alphaTest: .08")
  || !moduleSources.get("meshes")?.includes("mesh.renderOrder = -900")) {
  throw new Error("World directions must use readable depth-tested markings on the grid.");
}
const rotationButtonRiggingSource = moduleSources.get("rigging") || "";
const nodePickerSource = rotationButtonRiggingSource.slice(rotationButtonRiggingSource.indexOf("function selectAnimationNodeBone"), rotationButtonRiggingSource.indexOf("function showAnimationNodeRotationTool"));
if (nodePickerSource.includes('setBoneGizmoEnabled(true, "rotate")')) {
  throw new Error("Selecting a bone from the timeline picker must not reactivate Rotate or its joystick.");
}
if (!rotationButtonRiggingSource.includes("function showAnimationNodeRotationTool") || !rotationButtonRiggingSource.includes('setBoneGizmoEnabled(true, "rotate")')) {
  throw new Error("Selected Node must provide an explicit button for showing the rotation tool.");
}
if (!documentSource.includes('id="animationNodeSaveFrameBtn"')
  || !rotationButtonRiggingSource.includes("function keySelectedBonePoseAtCurrentFrame")
  || !rotationButtonRiggingSource.includes("list.findIndex(item => item.frame === animationState.frame)")) {
  throw new Error("Selected Node must save or replace only the selected bone pose at the current frame.");
}
if (!documentSource.includes('id="animationKeyCopyBtn"')
  || !documentSource.includes('id="animationKeyPasteMirroredBtn"')
  || !rotationButtonRiggingSource.includes("function copySelectedAnimationKeys")
  || !rotationButtonRiggingSource.includes("function pasteCopiedAnimationKeys")
  || !rotationButtonRiggingSource.includes("animationState.frame + entry.frame - animationKeyClipboard.originFrame")
  || !rotationButtonRiggingSource.includes("targetRestPosition.x - positionDelta[0]")) {
  throw new Error("The timeline must copy selected keys and paste them at the playhead on the same or mirrored bones.");
}
if (!documentSource.includes('aria-label="Animation timeline playhead"')
  || !rotationButtonRiggingSource.includes("function selectAllAnimationKeysAtCurrentFrame")
  || !moduleSources.get("panels")?.includes('animationScrubber?.addEventListener("pointerup"')) {
  throw new Error("Clicking the animation playhead must select every keyed bone at its current frame.");
}
if (!documentSource.includes('id="animationDetailFrameLabel"')
  || !rotationButtonRiggingSource.includes('els.animationDetailFrameLabel.textContent = `Frame ${animationState.frame} / ${animationState.end}`')) {
  throw new Error("AI Detail Cameras must display the same live frame readout as the animation timeline.");
}
if (!documentSource.includes('id="animationNodeRotX" type="number" step="0.1"')
  || !documentSource.includes('id="animationNodePosX" type="number" step="0.001"')
  || !rotationButtonRiggingSource.includes("function applyAnimationNodeExactValues")) {
  throw new Error("Selected Node must support editable exact position and one-decimal rotation values.");
}
const exactPoseSource = rotationButtonRiggingSource.slice(rotationButtonRiggingSource.indexOf("function applyAnimationNodeExactValues"), rotationButtonRiggingSource.indexOf("function keySelectedBonePoseAtCurrentFrame"));
if (!exactPoseSource.includes("channel.position.clone()")
  || exactPoseSource.includes("prepareLooseBoneHierarchy()")
  || exactPoseSource.includes("commitLooseBoneRotation")) {
  throw new Error("Exact animation rotation must preserve the selected bone position and must not rebase the fitted rig.");
}
if (documentSource.includes('id="animationNodePosOffsetX"') || documentSource.includes('id="animationNodeRotOffsetX"')) {
  throw new Error("Selected Node should use direct visual pose saving instead of manual offset fields.");
}
if (!moduleSources.get("rigging")?.includes('`Hand ${side}`, `Forearm ${side}`')
  || !moduleSources.get("rigging")?.includes('`Thumb ${side}`, `Index ${side}`, `Middle ${side}`, `Ring ${side}`, `Pinky ${side}`')) {
  throw new Error("Hand vertices must be weighted to the hand and grip-finger bones so wrist twists and grip poses deform the mesh.");
}
if (!moduleSources.get("import-export")?.includes("? rigModelOpacity")
  || !moduleSources.get("import-export")?.includes("editsRigPreviewOpacity")) {
  throw new Error("Animator inspector opacity must mirror and control the visible rig opacity.");
}
if (!html.includes('id="flat2dLookInput"') || !moduleSources.get("panels")?.includes("function setFlat2dLook") || !moduleSources.get("panels")?.includes("new THREE.MeshBasicMaterial")) {
  throw new Error("Flat 2D Look must provide a visible toggle and unlit model rendering.");
}
if (!moduleSources.get("import-export")?.includes('setCameraToView(viewName, { useCurrentZoom: false });')) {
  throw new Error("Camera view buttons must use absolute repeatable framing instead of inheriting the previous camera distance.");
}
if (!moduleSources.get("import-export")?.includes("orbit.enableDamping = false") || !moduleSources.get("import-export")?.includes("orbit.enableDamping = dampingWasEnabled")) {
  throw new Error("Absolute camera presets must clear pending damped orbit movement before displaying the chosen view.");
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
  "grid-template-rows: auto auto minmax(44px, 1fr);",
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
