const canvas = document.querySelector("#canvas");
const frontBoneCanvas = document.querySelector("#frontBoneCanvas");
const sideBoneCanvas = document.querySelector("#sideBoneCanvas");
const gameplayCanvas = document.querySelector("#gameplayCanvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;

const frontBoneRenderer = new THREE.WebGLRenderer({ canvas: frontBoneCanvas, antialias: true, alpha: true });
const sideBoneRenderer = new THREE.WebGLRenderer({ canvas: sideBoneCanvas, antialias: true, alpha: true });
frontBoneRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
sideBoneRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const gameplayRenderer = gameplayCanvas
  ? new THREE.WebGLRenderer({ canvas: gameplayCanvas, antialias: true, alpha: true })
  : null;
if (gameplayRenderer) {
  gameplayRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  gameplayRenderer.shadowMap.enabled = true;
}

const scene = new THREE.Scene();
const studioBackground = new THREE.Color(0x0b0e10);
const plainBackground = new THREE.Color(0x17232b);
scene.background = studioBackground;

const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 1000000);
camera.position.set(6, 5, 7);
camera.layers.enable(3);
const gameplayCamera = new THREE.PerspectiveCamera(70, 1, 0.05, 1000000);
gameplayCamera.layers.enable(3);
gameplayCamera.rotation.order = "YXZ";
const gameplayKeys = new Set();
let gameplayYaw = 0;
let gameplayPitch = 0;
let gameplayLastFrame = performance.now();
let gameplaySpeedMultiplier = 1;
const GAMEPLAY_SPEED_MIN = 0.15;
const GAMEPLAY_SPEED_MAX = 6;
let activeWorkView = null;
let savedWorkViewCamera = null;

const frontBoneCamera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.01, 10000);
// Blockbench's canonical Front view looks from +Z toward the origin.
frontBoneCamera.position.set(0, 0, 100);
frontBoneCamera.lookAt(0, 0, 0);
frontBoneCamera.layers.enable(1);
const sideBoneCamera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.01, 10000);
sideBoneCamera.position.set(100, 0, 0);
sideBoneCamera.lookAt(0, 0, 0);
sideBoneCamera.layers.enable(2);
const referenceViewState = {
  front: { initialized: false, panEnabled: false, followTool: false, center: new THREE.Vector3(0, 1, 0), halfHeight: 5 },
  side: { initialized: false, panEnabled: false, followTool: false, center: new THREE.Vector3(0, 1, 0), halfHeight: 5 }
};
let referenceViewPanDrag = null;

const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.minDistance = 0.0005;
orbit.maxDistance = 500000;
orbit.zoomSpeed = 1.1;
orbit.screenSpacePanning = true;
orbit.zoomToCursor = true;
orbit.target.set(0, 1, 0);
let modelTileCameraLocked = false;

function closeCameraNavigationPlan(distance, near) {
  const safeDistance = Math.max(0, Number(distance) || 0);
  const safeNear = Math.max(.0001, Number(near) || .05);
  const triggerDistance = Math.max(.015, Math.min(.08, safeNear * 2));
  if (safeDistance > triggerDistance) return null;
  const targetDistance = Math.max(.12, triggerDistance * 5);
  return {
    triggerDistance,
    targetDistance,
    near: Math.max(.0001, Math.min(safeNear, targetDistance / 1000))
  };
}

function syncCloseCameraPanSpeed() {
  const distance = Math.max(.0005, camera.position.distanceTo(orbit.target));
  orbit.panSpeed = THREE.MathUtils.clamp(.3 / distance, 1, 12);
}

function keepCloseCameraNavigationResponsive() {
  const distance = camera.position.distanceTo(orbit.target);
  const plan = closeCameraNavigationPlan(distance, camera.near);
  if (!plan) return false;
  const forward = camera.getWorldDirection(new THREE.Vector3()).normalize();
  orbit.target.copy(camera.position).addScaledVector(forward, plan.targetDistance);
  camera.near = plan.near;
  camera.updateProjectionMatrix();
  syncCloseCameraPanSpeed();
  orbit.update();
  return true;
}

orbit.addEventListener("change", syncCloseCameraPanSpeed);
syncCloseCameraPanSpeed();
canvas.addEventListener("wheel", event => {
  if (event.deltaY >= 0 || !orbit.enabled || modelTileCameraLocked) return;
  requestAnimationFrame(keepCloseCameraNavigationResponsive);
}, { passive: true });

function applyModelTileCameraLock() {
  const azimuth = Number(els.modelTileCameraAzimuthInput?.value) || 45;
  const elevation = Math.max(-89, Math.min(89, Number(els.modelTileCameraElevationInput?.value) || 35.264));
  const distance = Math.max(.1, Number(els.modelTileCameraDistanceInput?.value) || 12);
  const targetY = Number(els.modelTileCameraTargetYInput?.value) || 0;
  const az = THREE.MathUtils.degToRad(azimuth);
  const el = THREE.MathUtils.degToRad(elevation);
  const target = new THREE.Vector3(0, targetY, 0);
  camera.position.set(
    target.x + Math.sin(az) * Math.cos(el) * distance,
    target.y + Math.sin(el) * distance,
    target.z + Math.cos(az) * Math.cos(el) * distance
  );
  camera.lookAt(target);
  orbit.target.copy(target);
  orbit.update();
  return { azimuth, elevation, distance, targetY };
}

function toggleModelTileCameraLock() {
  modelTileCameraLocked = !modelTileCameraLocked;
  if (modelTileCameraLocked) {
    const profile = applyModelTileCameraLock();
    orbit.enabled = false;
    if (els.modelTileCameraLockBtn) els.modelTileCameraLockBtn.textContent = "Unlock Isometric Camera";
    if (els.modelTileStatus) els.modelTileStatus.textContent = `Camera locked: azimuth ${profile.azimuth}°, elevation ${profile.elevation}°, distance ${profile.distance}.`;
  } else {
    orbit.enabled = true;
    if (els.modelTileCameraLockBtn) els.modelTileCameraLockBtn.textContent = "Lock Isometric Camera";
    if (els.modelTileStatus) els.modelTileStatus.textContent = "Camera unlocked.";
  }
}

const surfaceGizmoPivot = new THREE.Object3D();
surfaceGizmoPivot.name = "surface edit pivot";
surfaceGizmoPivot.visible = false;
scene.add(surfaceGizmoPivot);

const surfaceTransformGuideGroup = new THREE.Group();
surfaceTransformGuideGroup.name = "surface transform guides";
surfaceTransformGuideGroup.visible = false;
scene.add(surfaceTransformGuideGroup);
const surfaceScaleOriginMarker = new THREE.Mesh(
  new THREE.SphereGeometry(.018, 16, 10),
  new THREE.MeshBasicMaterial({ color: 0xffd35a, transparent: true, opacity: .9, depthTest: false })
);
surfaceScaleOriginMarker.renderOrder = 1200;
surfaceTransformGuideGroup.add(surfaceScaleOriginMarker);
const surfaceScaleAnchorMarker = new THREE.Mesh(
  new THREE.SphereGeometry(.012, 14, 8),
  new THREE.MeshBasicMaterial({ color: 0xff8a4c, transparent: true, opacity: .92, depthTest: false })
);
surfaceScaleAnchorMarker.renderOrder = 1200;
surfaceScaleAnchorMarker.visible = false;
surfaceTransformGuideGroup.add(surfaceScaleAnchorMarker);
const surfaceScaleAnchorLine = new THREE.Line(
  new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
  new THREE.LineBasicMaterial({ color: 0xff8a4c, transparent: true, opacity: .72, depthTest: false })
);
surfaceScaleAnchorLine.renderOrder = 1199;
surfaceScaleAnchorLine.visible = false;
surfaceTransformGuideGroup.add(surfaceScaleAnchorLine);
const surfaceMirrorDotCanvas = document.createElement("canvas");
surfaceMirrorDotCanvas.width = 32;
surfaceMirrorDotCanvas.height = 32;
const surfaceMirrorDotContext = surfaceMirrorDotCanvas.getContext("2d");
surfaceMirrorDotContext.clearRect(0, 0, 32, 32);
surfaceMirrorDotContext.fillStyle = "#ffffff";
surfaceMirrorDotContext.beginPath();
surfaceMirrorDotContext.arc(16, 16, 12, 0, Math.PI * 2);
surfaceMirrorDotContext.fill();
const surfaceMirrorDotTexture = new THREE.CanvasTexture(surfaceMirrorDotCanvas);
const surfaceMirrorGhostMarker = new THREE.Points(
  new THREE.BufferGeometry(),
  new THREE.PointsMaterial({ color: 0x63e6ff, map: surfaceMirrorDotTexture, alphaTest: .2, size: .012, transparent: true, opacity: .72, depthTest: false, sizeAttenuation: true })
);
surfaceMirrorGhostMarker.renderOrder = 1199;
surfaceTransformGuideGroup.add(surfaceMirrorGhostMarker);

const transform = new TransformControls(camera, renderer.domElement);
transform.visible = false;
transform.addEventListener("dragging-changed", event => orbit.enabled = !event.value);
transform.addEventListener("mouseDown", () => {
  if (!pivotEditMode) recordHistory("transform");
  beginScaleDragSession();
});
transform.addEventListener("mouseUp", () => {
  finishScaleDragSession();
  if (typeof finishArmorFittingTransform === "function") finishArmorFittingTransform(transform.object);
});
transform.addEventListener("objectChange", () => {
  if (transform.object === groupPivot) {
    if (pivotEditMode) {
      groupPivot.updateMatrixWorld(true);
      lastGroupMatrix.copy(groupPivot.matrixWorld);
      setStoredPivotForObjects(pivotManagedObjects(), groupPivot.position);
    } else {
      applyGroupPivotDelta();
    }
  } else if (activeTransformMode === "scale") {
    applySingleSidedScaleOffset();
  }
  syncPlayerAvatarBones({ object: transform.object, rebuild: true });
  if (typeof updateArmorFittingMirror === "function") updateArmorFittingMirror(transform.object);
  updateTriangleHelpers();
  syncSelectionOutlineTransforms();
  syncInspector();
  updateState();
  updateScore();
  updateScaleModifierMarkers();
});
scene.add(transform);

const surfaceTransform = new TransformControls(camera, renderer.domElement);
surfaceTransform.visible = false;
surfaceTransform.setMode("translate");
surfaceTransform.setSpace("world");
surfaceTransform.setSize(1.2);
surfaceTransform.addEventListener("dragging-changed", event => orbit.enabled = !event.value);
surfaceTransform.addEventListener("mouseDown", beginSurfaceGizmoDrag);
surfaceTransform.addEventListener("mouseUp", finishSurfaceGizmoDrag);
surfaceTransform.addEventListener("objectChange", applySurfaceGizmoDelta);
scene.add(surfaceTransform);

function createReferenceSurfaceTransform(referenceCamera, referenceCanvas) {
  const control = new TransformControls(referenceCamera, referenceCanvas);
  control.visible = false;
  control.setMode("translate");
  control.setSpace("world");
  control.setSize(1.0);
  control.addEventListener("dragging-changed", event => orbit.enabled = !event.value);
  control.addEventListener("mouseDown", beginSurfaceGizmoDrag);
  control.addEventListener("mouseUp", finishSurfaceGizmoDrag);
  control.addEventListener("objectChange", applySurfaceGizmoDelta);
  scene.add(control);
  return control;
}

const surfaceFrontTransform = createReferenceSurfaceTransform(frontBoneCamera, frontBoneCanvas);
const surfaceSideTransform = createReferenceSurfaceTransform(sideBoneCamera, sideBoneCanvas);
const surfaceTransforms = [surfaceTransform, surfaceFrontTransform, surfaceSideTransform];

const grid = new THREE.GridHelper(18, 18, 0x7f929c, 0x34424a);
grid.visible = true;
grid.position.y = 0;
grid.renderOrder = -1000;
grid.material.transparent = true;
grid.material.opacity = 0.9;
grid.material.depthTest = true;
grid.material.depthWrite = false;
scene.add(grid);
const gridLabelGroup = new THREE.Group();
gridLabelGroup.name = "grid direction labels";
scene.add(gridLabelGroup);

function createPhotoTexture({ kind = "sky", size = 512 } = {}) {
  const textureCanvas = document.createElement("canvas");
  const isScenicBackground = kind === "sky" || kind === "sunset";
  const isSunset = kind === "sunset";
  textureCanvas.width = isScenicBackground ? size * 2 : size;
  textureCanvas.height = size;
  const context = textureCanvas.getContext("2d");
  if (isScenicBackground) {
    const sky = context.createLinearGradient(0, 0, 0, size);
    sky.addColorStop(0, isSunset ? "#302b63" : "#4f94c8");
    sky.addColorStop(.48, isSunset ? "#bb5c67" : "#a9d3e8");
    sky.addColorStop(.76, isSunset ? "#f1ad6b" : "#e7eee3");
    sky.addColorStop(1, isSunset ? "#6c624c" : "#8ca579");
    context.fillStyle = sky;
    context.fillRect(0, 0, textureCanvas.width, size);

    const sunX = size * (isSunset ? .58 : 1.55);
    const sunY = size * (isSunset ? .61 : .22);
    const sun = context.createRadialGradient(sunX, sunY, 2, sunX, sunY, size * (isSunset ? .24 : .18));
    sun.addColorStop(0, isSunset ? "rgba(255,239,177,1)" : "rgba(255,249,204,.96)");
    sun.addColorStop(.18, isSunset ? "rgba(255,155,92,.68)" : "rgba(255,237,174,.5)");
    sun.addColorStop(1, "rgba(255,225,160,0)");
    context.fillStyle = sun;
    context.fillRect(0, 0, textureCanvas.width, size);

    context.fillStyle = isSunset ? "rgba(255,213,206,.25)" : "rgba(255,255,255,.48)";
    [[.14,.2,.12],[.35,.29,.09],[.7,.18,.13],[.86,.34,.08]].forEach(([x,y,w]) => {
      context.beginPath();
      context.ellipse(textureCanvas.width * x, size * y, textureCanvas.width * w, size * .028, 0, 0, Math.PI * 2);
      context.ellipse(textureCanvas.width * (x + w * .22), size * (y - .025), textureCanvas.width * w * .55, size * .04, 0, 0, Math.PI * 2);
      context.fill();
    });

    const horizonY = size * .76;
    context.fillStyle = isSunset ? "#4f4a42" : "#6f8867";
    context.beginPath();
    context.moveTo(0, size);
    context.lineTo(0, horizonY);
    for (let x = 0; x <= textureCanvas.width; x += 32) {
      const height = 24 + Math.sin(x * .018) * 18 + Math.sin(x * .047) * 9;
      context.lineTo(x, horizonY - height);
    }
    context.lineTo(textureCanvas.width, size);
    context.closePath();
    context.fill();
  } else {
    const isRoad = kind === "road";
    context.fillStyle = isRoad ? "#303437" : "#496f36";
    context.fillRect(0, 0, size, size);
    for (let i = 0; i < 4800; i++) {
      const x = (Math.sin(i * 12.9898) * 43758.5453 % 1 + 1) % 1 * size;
      const y = (Math.sin(i * 78.233) * 19642.349 % 1 + 1) % 1 * size;
      const tone = 35 + (i % 7) * 4;
      context.fillStyle = isRoad
        ? `rgba(${tone},${tone + 2},${tone + 3},.28)`
        : `rgba(${42 + i % 30},${88 + i % 45},${30 + i % 20},.34)`;
      if (isRoad) context.fillRect(x, y, 1 + i % 2, 1 + (i % 3 === 0 ? 1 : 0));
      else context.fillRect(x, y, 1, 3 + i % 5);
    }
  }
  const texture = new THREE.CanvasTexture(textureCanvas);
  if ("colorSpace" in texture && THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const skyTexture = createPhotoTexture({ kind: "sky", size: 512 });
const sunsetTexture = createPhotoTexture({ kind: "sunset", size: 512 });
const roadTexture = createPhotoTexture({ kind: "road", size: 512 });
const grassTexture = createPhotoTexture({ kind: "grass", size: 512 });
roadTexture.wrapS = roadTexture.wrapT = THREE.RepeatWrapping;
grassTexture.wrapS = grassTexture.wrapT = THREE.RepeatWrapping;
roadTexture.repeat.set(28, 3);
grassTexture.repeat.set(28, 8);

const photoEnvironment = new THREE.Group();
photoEnvironment.name = "road and grass photo environment";
photoEnvironment.traverse(object => object.layers.set(3));
scene.add(photoEnvironment);

const road = new THREE.Mesh(
  new THREE.PlaneGeometry(160, 10),
  new THREE.MeshStandardMaterial({ map: roadTexture, color: 0x9aa0a2, roughness: .96, metalness: .02 })
);
road.rotation.x = -Math.PI / 2;
road.position.y = -.025;
road.receiveShadow = true;
road.layers.set(3);
photoEnvironment.add(road);

const grassMaterial = new THREE.MeshStandardMaterial({ map: grassTexture, color: 0x86a968, roughness: 1 });
for (const side of [-1, 1]) {
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(160, 50), grassMaterial);
  grass.rotation.x = -Math.PI / 2;
  grass.position.set(0, -.04, side * 30);
  grass.receiveShadow = true;
  grass.layers.set(3);
  photoEnvironment.add(grass);
}

const shoulderMaterial = new THREE.MeshStandardMaterial({ color: 0x777b76, roughness: .95 });
const edgeMaterial = new THREE.MeshStandardMaterial({ color: 0xf1eee2, roughness: .72 });
for (const side of [-1, 1]) {
  const shoulder = new THREE.Mesh(new THREE.PlaneGeometry(160, .85), shoulderMaterial);
  shoulder.rotation.x = -Math.PI / 2;
  shoulder.position.set(0, -.012, side * 5.38);
  shoulder.receiveShadow = true;
  shoulder.layers.set(3);
  photoEnvironment.add(shoulder);
  const edgeLine = new THREE.Mesh(new THREE.BoxGeometry(160, .018, .12), edgeMaterial);
  edgeLine.position.set(0, .002, side * 4.72);
  edgeLine.receiveShadow = true;
  edgeLine.layers.set(3);
  photoEnvironment.add(edgeLine);
}

const roadFog = new THREE.Fog(0xb3ced8, 55, 175);
const sunsetFog = new THREE.Fog(0xc7836f, 55, 175);
let suppressViewportEnvironment = false;
const hemi = new THREE.HemisphereLight(0xe9f7ff, 0x283030, 1.8);
scene.add(hemi);

const key = new THREE.DirectionalLight(0xffffff, 3.2);
key.position.set(4, 8, 5);
key.castShadow = true;
scene.add(key);

const fill = new THREE.PointLight(0xffffff, 1.2, 50);
fill.position.set(0, 14, 0);
scene.add(fill);

const primarySpotTarget = new THREE.Object3D();
const mirrorSpotTarget = new THREE.Object3D();
scene.add(primarySpotTarget);
scene.add(mirrorSpotTarget);

const primarySpot = new THREE.SpotLight(0xffffff, 10, 120, THREE.MathUtils.degToRad(24), 0.32, 1.1);
primarySpot.position.set(-6, 5, 6);
primarySpot.target = primarySpotTarget;
scene.add(primarySpot);
scene.add(primarySpot.target);

const mirrorSpot = new THREE.SpotLight(0xffffff, 10, 120, THREE.MathUtils.degToRad(24), 0.32, 1.1);
mirrorSpot.position.set(6, 5, 6);
mirrorSpot.target = mirrorSpotTarget;
scene.add(mirrorSpot);
scene.add(mirrorSpot.target);

const primarySpotHelper = new THREE.SpotLightHelper(primarySpot, 0x8bd3ff);
const mirrorSpotHelper = new THREE.SpotLightHelper(mirrorSpot, 0xe1b14b);
scene.add(primarySpotHelper);
scene.add(mirrorSpotHelper);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(40, 40),
  new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.22 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
floor.visible = false;
scene.add(floor);

const studioFloor = new THREE.Mesh(
  new THREE.PlaneGeometry(80, 80),
  new THREE.MeshStandardMaterial({
    color: 0x252b30,
    roughness: .9,
    metalness: .04
  })
);
studioFloor.name = "matte studio floor";
studioFloor.rotation.x = -Math.PI / 2;
studioFloor.position.y = -.03;
studioFloor.receiveShadow = true;
studioFloor.visible = false;
studioFloor.layers.set(3);
scene.add(studioFloor);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const lastCanvasPointer = new THREE.Vector2();
const objects = [];
const liveMirrorPreviewGroup = new THREE.Group();
liveMirrorPreviewGroup.name = "live mirror previews";
liveMirrorPreviewGroup.userData.editorHelper = true;
scene.add(liveMirrorPreviewGroup);
const liveMirrorPreviewBySourceId = new Map();
let selected = null;
let facePickMode = false;
let coplanarFacePickMode = false;
let connectedTrianglePickMode = false;
let openingPickMode = false;
let lineSketchMode = false;
let triangleBuildMode = false;
let triangleBuildMeshId = null;
let triangleBuildHover = null;
const triangleBuildPoints = [];
let dragPushMode = false;
let pullToTargetSession = null;
let lineSketchClosed = false;
let lineSketchPlane = null;
let lineSketchPlaneNormal = null;
let lineSketchHover = null;
const lineSketchPoints = [];
let knifeCutMode = false;
let knifeCutMesh = null;
let knifeCutHover = null;
const knifeCutPoints = [];
let selectedFace = null;
const selectedFaces = [];
let surfaceComponentMode = "none";
let surfaceSelectionSource = "none";
const selectedSurfaceVertices = [];
const selectedSurfaceEdges = [];
let connectVerticesMode = false;
let connectVerticesTarget = null;
let copiedTrianglePatch = null;
let isPaintingTriangles = false;
let isAreaSelectingTriangles = false;
let lastPaintedTriangleKey = null;
let lastPaintLogAt = 0;
let spaceCameraMode = false;
let areaSelectionStart = null;
let activeTransformMode = null;
let dragPushSession = null;
let surfaceGizmoDragging = false;
let surfaceGizmoSyncing = false;
let surfaceGizmoMovedDistance = 0;
let surfaceGizmoMode = "translate";
let surfaceTransformTarget = "model";
let surfaceScaleAllAxes = false;
let surfaceGizmoOneSidedScale = false;
let surfaceGizmoScaleHandleSigns = { x: 1, y: 1, z: 1 };
let activeSurfaceTransform = surfaceTransform;
const surfaceGizmoLastPosition = new THREE.Vector3();
const surfaceGizmoLastScale = new THREE.Vector3(1, 1, 1);
const surfaceGizmoScaleCenter = new THREE.Vector3();
const surfaceGizmoLastQuaternion = new THREE.Quaternion();
let checkedIds = new Set();
let activeGroupIds = [];
const groupPivot = new THREE.Object3D();
groupPivot.name = "group pivot";
scene.add(groupPivot);
let lastGroupMatrix = new THREE.Matrix4();
let currentTransformTargetKey = "";
let pivotEditMode = false;
let pivotReturnMode = "rotate";
let isShiftHeld = false;
let isCtrlHeld = false;
const scaleModifierMarkers = new THREE.Group();
scaleModifierMarkers.name = "scale modifier markers";
scaleModifierMarkers.visible = false;
scene.add(scaleModifierMarkers);
const scaleMarkerArrows = [
  new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), .8, 0xffb347, .18, .1),
  new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), .8, 0x66ddaa, .18, .1),
  new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(), .8, 0x66aaff, .18, .1),
  new THREE.ArrowHelper(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(), .8, 0xffb347, .18, .1),
  new THREE.ArrowHelper(new THREE.Vector3(0, -1, 0), new THREE.Vector3(), .8, 0x66ddaa, .18, .1),
  new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), new THREE.Vector3(), .8, 0x66aaff, .18, .1)
];
scaleMarkerArrows.forEach(arrow => scaleModifierMarkers.add(arrow));

function updateScaleModifierMarkers() {
  const show = activeTransformMode === "scale" && (isShiftHeld || isCtrlHeld) && transform.visible && transform.object;
  scaleModifierMarkers.visible = !!show;
  if (!show) return;
  const object = transform.object;
  const center = new THREE.Vector3(); object.getWorldPosition(center);
  const bounds = new THREE.Box3().setFromObject(object);
  const size = bounds.getSize(new THREE.Vector3());
  const half = Math.max(.35, Math.max(size.x, size.y, size.z) * .55);
  scaleModifierMarkers.position.copy(center);
  scaleMarkerArrows.forEach((arrow, index) => {
    const axis = index % 3;
    const negative = index >= 3;
    const direction = arrow.getWorldDirection(new THREE.Vector3());
    const offset = direction.clone().multiplyScalar(half);
    arrow.position.copy(offset);
    arrow.setLength(Math.max(.5, half * .55));
    const activeAxis = String(transform.axis || "").toUpperCase();
    const axisName = ["X", "Y", "Z"][axis];
    arrow.visible = activeAxis ? activeAxis.includes(axisName) && (isCtrlHeld || !negative) : (isCtrlHeld || !negative);
  });
}
let scaleDragState = null;
let pendingScenePick = null;
let idCounter = 1;
let isRestoring = false;
const history = [];
const maxHistory = 80;
const METERS_PER_ROBLOX_STUD = 0.28;
const ROBLOX_STUDS_PER_METER = 1 / METERS_PER_ROBLOX_STUD;
const faceMarker = new THREE.Group();
faceMarker.name = "selected triangle markers";
faceMarker.visible = false;
scene.add(faceMarker);
const surfaceComponentMarker = new THREE.Group();
surfaceComponentMarker.name = "selected vertex and edge markers";
surfaceComponentMarker.visible = false;
scene.add(surfaceComponentMarker);
const connectVerticesGuideGroup = new THREE.Group();
connectVerticesGuideGroup.name = "connect vertices preview";
connectVerticesGuideGroup.userData.editorHelper = true;
connectVerticesGuideGroup.visible = false;
scene.add(connectVerticesGuideGroup);
const modelingEdgesOverlay = new THREE.Group();
modelingEdgesOverlay.name = "visible modeling edges";
modelingEdgesOverlay.visible = false;
scene.add(modelingEdgesOverlay);
const knifeCutGuideGroup = new THREE.Group();
knifeCutGuideGroup.name = "knife cut guides";
knifeCutGuideGroup.visible = false;
scene.add(knifeCutGuideGroup);
const selectionOutlineGroup = new THREE.Group();
selectionOutlineGroup.name = "selected object silhouette";
scene.add(selectionOutlineGroup);
let selectionHighlightVisible = localStorage.getItem("boltworks.selectionHighlightVisible") === "true";
const openingPickGuideGroup = new THREE.Group();
openingPickGuideGroup.name = "opening pick preview";
openingPickGuideGroup.visible = false;
scene.add(openingPickGuideGroup);
const meshIntegrityGuideGroup = new THREE.Group();
meshIntegrityGuideGroup.name = "mesh integrity issue guide";
meshIntegrityGuideGroup.visible = false;
scene.add(meshIntegrityGuideGroup);
let selectedHoleLoopInfo = null;
let holeRepairState = { meshId: null, loops: [], index: -1 };
let meshIntegrityState = { meshId: null, issues: [], index: -1, report: null };
let removeDoublesState = { meshId: null, tolerance: null, plan: null };
let meshStatisticsState = { meshId: null, stats: null, text: "" };
let decimateState = { meshId: null, settingsKey: "", plan: null };
let lodGeneratorState = { targetKey: "", settingsKey: "", plan: null };
let lodRepairState = { targetKey: "", plans: [] };
let uvUnwrapState = { meshId: null, settingsKey: "", plan: null };
let lastBakedTextureAtlas = { meshId: null, dataUrl: null, fileName: null, atlasSize: 0, sourceTextureUrl: null, sourceTextureName: null };
let hoveredHoleLoopInfo = null;
const lineSketchGroup = new THREE.Group();
lineSketchGroup.name = "line sketch guides";
scene.add(lineSketchGroup);
const lineSketchCursor = new THREE.Mesh(
  new THREE.SphereGeometry(1, 12, 10),
  new THREE.MeshBasicMaterial({
    color: "#8bd3ff",
    transparent: true,
    opacity: .88,
    depthWrite: false
  })
);
lineSketchCursor.name = "line sketch cursor";
lineSketchCursor.visible = false;
scene.add(lineSketchCursor);
const triangleBuildGroup = new THREE.Group();
triangleBuildGroup.name = "manual triangle build guides";
triangleBuildGroup.visible = false;
scene.add(triangleBuildGroup);
const triangleBuildCursor = new THREE.Mesh(
  new THREE.SphereGeometry(1, 12, 10),
  new THREE.MeshBasicMaterial({ color: "#ff7a59", transparent: true, opacity: .95, depthWrite: false })
);
triangleBuildCursor.name = "manual triangle build cursor";
triangleBuildCursor.visible = false;
scene.add(triangleBuildCursor);
const markerGroup = new THREE.Group();
markerGroup.name = "marker helpers";
scene.add(markerGroup);
const modelTileNeighbourPreviewGroup = new THREE.Group();
modelTileNeighbourPreviewGroup.name = "model tile neighbour preview";
modelTileNeighbourPreviewGroup.visible = false;
scene.add(modelTileNeighbourPreviewGroup);
const markerHelpers = [];
const cameraDirectorGroup = new THREE.Group();
cameraDirectorGroup.name = "camera director helpers";
scene.add(cameraDirectorGroup);
let customCameraViews = [];
let selectedCustomCameraId = null;
let activeCustomCameraId = null;
let customCameraIdCounter = 0;
let playerLookDrag = null;
let referenceImageState = {
  name: "",
  dataUrl: null,
  mode: "panel",
  opacity: .45,
  scale: 1,
  offsetX: 0,
  offsetY: 0
};
const sceneGroupRegistry = new Map();
let selectedGroupRecordId = null;

const els = {
  viewportRoot: document.querySelector(".viewport"),
  workViewFrontBtn: document.querySelector("#workViewFrontBtn"),
  workViewSideBtn: document.querySelector("#workViewSideBtn"),
  workViewTopBtn: document.querySelector("#workViewTopBtn"),
  workViewRestoreBtn: document.querySelector("#workViewRestoreBtn"),
  workViewAxisLabel: document.querySelector("#workViewAxisLabel"),
  frontReferenceWorkBtn: document.querySelector("#frontReferenceWorkBtn"),
  sideReferenceWorkBtn: document.querySelector("#sideReferenceWorkBtn"),
  frontReferencePanBtn: document.querySelector("#frontReferencePanBtn"),
  frontReferenceFollowBtn: document.querySelector("#frontReferenceFollowBtn"),
  frontReferenceFitBtn: document.querySelector("#frontReferenceFitBtn"),
  sideReferencePanBtn: document.querySelector("#sideReferencePanBtn"),
  sideReferenceFollowBtn: document.querySelector("#sideReferenceFollowBtn"),
  sideReferenceFitBtn: document.querySelector("#sideReferenceFitBtn"),
  referenceViewportsToggleBtn: document.querySelector("#referenceViewportsToggleBtn"),
  gameplayPreview: document.querySelector("#gameplayPreview"),
  gameplayPreviewOpenBtn: document.querySelector("#gameplayPreviewOpenBtn"),
  gameplayPreviewResetBtn: document.querySelector("#gameplayPreviewResetBtn"),
  gameplayPreviewCloseBtn: document.querySelector("#gameplayPreviewCloseBtn"),
  gameplayHintText: document.querySelector("#gameplayHintText"),
  tree: document.querySelector("#sceneTree"),
  goToSelectedMeshBtn: document.querySelector("#goToSelectedMeshBtn"),
  log: document.querySelector("#log"),
  stateOutput: document.querySelector("#stateOutput"),
  selectionBox: document.querySelector("#selectionBox"),
  addMeshSection: document.querySelector("#addMeshSection"),
  addMeshToggle: document.querySelector("#addMeshToggle"),
  toolbarPicker: document.querySelector("#toolbarPicker"),
  toggleToolbarTransform: document.querySelector("#toggleToolbarTransform"),
  toggleToolbarMirror: document.querySelector("#toggleToolbarMirror"),
  toggleToolbarScene: document.querySelector("#toggleToolbarScene"),
  toggleToolbarProjectFiles: document.querySelector("#toggleToolbarProjectFiles"),
  toolbarTransformGroup: document.querySelector("#toolbarTransformGroup"),
  toolbarMirrorGroup: document.querySelector("#toolbarMirrorGroup"),
  toolbarSelectionToolsGroup: document.querySelector("#toolbarSelectionToolsGroup"),
  toolbarLineToolsGroup: document.querySelector("#toolbarLineToolsGroup"),
  toolbarMarkerToolsGroup: document.querySelector("#toolbarMarkerToolsGroup"),
  toolbarTriEditorGroup: document.querySelector("#toolbarTriEditorGroup"),
  toolbarMiscToolsGroup: document.querySelector("#toolbarMiscToolsGroup"),
  toolbarFaceEditGroup: document.querySelector("#toolbarFaceEditGroup"),
  toolbarSceneGroup: document.querySelector("#toolbarSceneGroup"),
  toolbarProjectFilesGroup: document.querySelector("#toolbarProjectFilesGroup"),
  toolbarViewsGroup: document.querySelector("#toolbarViewsGroup"),
  toolbarImportExportGroup: document.querySelector("#toolbarImportExportGroup"),
  inspectorSection: document.querySelector("#inspectorSection"),
  inspectorToggle: document.querySelector("#inspectorToggle"),
  utilitiesSection: document.querySelector("#utilitiesSection"),
  utilitiesToggle: document.querySelector("#utilitiesToggle"),
  aiViewerSection: document.querySelector("#aiViewerSection"),
  aiViewerToggle: document.querySelector("#aiViewerToggle"),
  aiViewerBody: document.querySelector("#aiViewerBody"),
  aiViewerHeaderState: document.querySelector("#aiViewerHeaderState"),
  aiViewerConnectionStatus: document.querySelector("#aiViewerConnectionStatus"),
  aiViewerSessionStatus: document.querySelector("#aiViewerSessionStatus"),
  aiViewerTimer: document.querySelector("#aiViewerTimer"),
  aiViewerGoalInput: document.querySelector("#aiViewerGoalInput"),
  aiViewerDurationInput: document.querySelector("#aiViewerDurationInput"),
  aiViewerStartBtn: document.querySelector("#aiViewerStartBtn"),
  aiViewerPauseBtn: document.querySelector("#aiViewerPauseBtn"),
  aiViewerResumeBtn: document.querySelector("#aiViewerResumeBtn"),
  aiViewerExtendBtn: document.querySelector("#aiViewerExtendBtn"),
  aiViewerStopBtn: document.querySelector("#aiViewerStopBtn"),
  aiViewerClearBtn: document.querySelector("#aiViewerClearBtn"),
  aiViewerAttention: document.querySelector("#aiViewerAttention"),
  aiViewerAttentionMessage: document.querySelector("#aiViewerAttentionMessage"),
  aiViewerAttentionDirective: document.querySelector("#aiViewerAttentionDirective"),
  aiViewerCurrentAction: document.querySelector("#aiViewerCurrentAction"),
  aiViewerMetricEvents: document.querySelector("#aiViewerMetricEvents"),
  aiViewerMetricCompleted: document.querySelector("#aiViewerMetricCompleted"),
  aiViewerMetricFailed: document.querySelector("#aiViewerMetricFailed"),
  aiViewerMetricObjects: document.querySelector("#aiViewerMetricObjects"),
  aiViewerFeedCount: document.querySelector("#aiViewerFeedCount"),
  aiViewerFeed: document.querySelector("#aiViewerFeed"),
  aiViewerDownloadBtn: document.querySelector("#aiViewerDownloadBtn"),
  cameraViewsSection: document.querySelector("#cameraViewsSection"),
  cameraViewsToggle: document.querySelector("#cameraViewsToggle"),
  cameraControlsOpenBtn: document.querySelector("#cameraControlsOpenBtn"),
  referenceImageSection: document.querySelector("#referenceImageSection"),
  referenceImageToggle: document.querySelector("#referenceImageToggle"),
  loadReferenceImageBtn: document.querySelector("#loadReferenceImageBtn"),
  clearReferenceImageBtn: document.querySelector("#clearReferenceImageBtn"),
  referenceImageFile: document.querySelector("#referenceImageFile"),
  referenceImageMode: document.querySelector("#referenceImageMode"),
  referenceImageOpacity: document.querySelector("#referenceImageOpacity"),
  referenceImageOpacityValue: document.querySelector("#referenceImageOpacityValue"),
  referenceImageScale: document.querySelector("#referenceImageScale"),
  referenceImageOffsetX: document.querySelector("#referenceImageOffsetX"),
  referenceImageOffsetY: document.querySelector("#referenceImageOffsetY"),
  referenceImagePreview: document.querySelector("#referenceImagePreview"),
  referenceImagePreviewImg: document.querySelector("#referenceImagePreviewImg"),
  referenceImageEmpty: document.querySelector("#referenceImageEmpty"),
  referenceImageName: document.querySelector("#referenceImageName"),
  referenceImageOverlay: document.querySelector("#referenceImageOverlay"),
  referenceImageOverlayImg: document.querySelector("#referenceImageOverlayImg"),
  addCustomCameraBtn: document.querySelector("#addCustomCameraBtn"),
  addPlayerCameraBtn: document.querySelector("#addPlayerCameraBtn"),
  viewCustomCameraBtn: document.querySelector("#viewCustomCameraBtn"),
  detachCustomCameraBtn: document.querySelector("#detachCustomCameraBtn"),
  updateCustomCameraBtn: document.querySelector("#updateCustomCameraBtn"),
  deleteCustomCameraBtn: document.querySelector("#deleteCustomCameraBtn"),
  customCameraList: document.querySelector("#customCameraList"),
  customCameraTypeLabel: document.querySelector("#customCameraTypeLabel"),
  customCameraNameInput: document.querySelector("#customCameraNameInput"),
  customCameraPosX: document.querySelector("#customCameraPosX"),
  customCameraPosY: document.querySelector("#customCameraPosY"),
  customCameraPosZ: document.querySelector("#customCameraPosZ"),
  customCameraTargetX: document.querySelector("#customCameraTargetX"),
  customCameraTargetY: document.querySelector("#customCameraTargetY"),
  customCameraTargetZ: document.querySelector("#customCameraTargetZ"),
  showCustomCamerasInput: document.querySelector("#showCustomCamerasInput"),
  gameOptimizeRatioInput: document.querySelector("#gameOptimizeRatioInput"),
  gameCharacterLodInput: document.querySelector("#gameCharacterLodInput"),
  exportGameCopyBtn: document.querySelector("#exportGameCopyBtn"),
  pixelRenderWidthInput: document.querySelector("#pixelRenderWidthInput"),
  pixelTransparentInput: document.querySelector("#pixelTransparentInput"),
  savePixelRenderBtn: document.querySelector("#savePixelRenderBtn"),
  gameOptimizeStats: document.querySelector("#gameOptimizeStats"),
  imageReliefMeshPlugin: document.querySelector("#imageReliefMeshPlugin"),
  sceneRenderingTools: document.querySelector("#sceneRenderingTools"),
  bonePlacementSection: document.querySelector("#bonePlacementSection"),
  tPoseFittingStatus: document.querySelector("#tPoseFittingStatus"),
  addGripHandsBtn: document.querySelector("#addGripHandsBtn"),
  boneAxisFreeBtn: document.querySelector("#boneAxisFreeBtn"),
  boneAxisXBtn: document.querySelector("#boneAxisXBtn"),
  boneAxisYBtn: document.querySelector("#boneAxisYBtn"),
  boneAxisZBtn: document.querySelector("#boneAxisZBtn"),
  boneModeMoveBtn: document.querySelector("#boneModeMoveBtn"),
  boneModeRotateBtn: document.querySelector("#boneModeRotateBtn"),
  boneModeScaleBtn: document.querySelector("#boneModeScaleBtn"),
  rigTransformToolLabel: document.querySelector("#rigTransformToolLabel"),
  boneRotationStepInput: document.querySelector("#boneRotationStepInput"),
  boneRotationStepStatus: document.querySelector("#boneRotationStepStatus"),
  glueBoneBtn: document.querySelector("#glueBoneBtn"),
  selectedBoneLabel: document.querySelector("#selectedBoneLabel"),
  addRootBoneBtn: document.querySelector("#addRootBoneBtn"),
  addChildBoneBtn: document.querySelector("#addChildBoneBtn"),
  deleteBoneBtn: document.querySelector("#deleteBoneBtn"),
  importBoneStructureBtn: document.querySelector("#importBoneStructureBtn"),
  boneStructureFile: document.querySelector("#boneStructureFile"),
  boneList: document.querySelector("#boneList"),
  boneNameInput: document.querySelector("#boneNameInput"),
  boneParentSelect: document.querySelector("#boneParentSelect"),
  bonePosX: document.querySelector("#bonePosX"),
  bonePosY: document.querySelector("#bonePosY"),
  bonePosZ: document.querySelector("#bonePosZ"),
  boneRotX: document.querySelector("#boneRotX"),
  boneRotY: document.querySelector("#boneRotY"),
  boneRotZ: document.querySelector("#boneRotZ"),
  showBonesInput: document.querySelector("#showBonesInput"),
  boneGuideScaleInput: document.querySelector("#boneGuideScaleInput"),
  boneGuideScaleValue: document.querySelector("#boneGuideScaleValue"),
  mirrorBoneEditsInput: document.querySelector("#mirrorBoneEditsInput"),
  armorMountBtn: document.querySelector("#armorMountBtn"),
  markSkinBtn: document.querySelector("#markSkinBtn"),
  markArmorBtn: document.querySelector("#markArmorBtn"),
  attachArmorBtn: document.querySelector("#attachArmorBtn"),
  selectTargetBoneBtn: document.querySelector("#selectTargetBoneBtn"),
  selectTargetSkinBtn: document.querySelector("#selectTargetSkinBtn"),
  selectTargetArmorBtn: document.querySelector("#selectTargetArmorBtn"),
  selectTargetStatus: document.querySelector("#selectTargetStatus"),
  modelSelectTargetAllBtn: document.querySelector("#modelSelectTargetAllBtn"),
  modelSelectTargetSkinBtn: document.querySelector("#modelSelectTargetSkinBtn"),
  modelSelectTargetArmorBtn: document.querySelector("#modelSelectTargetArmorBtn"),
  modelSelectTargetBoneBtn: document.querySelector("#modelSelectTargetBoneBtn"),
  selectionHighlightToggleBtn: document.querySelector("#selectionHighlightToggleBtn"),
  rigModelOpacityInput: document.querySelector("#rigModelOpacityInput"),
  rigModelOpacityValue: document.querySelector("#rigModelOpacityValue"),
  animationSection: document.querySelector("#animationSection"),
  animationToggle: document.querySelector("#animationToggle"),
  animationClipSelect: document.querySelector("#animationClipSelect"),
  animationClipAddBtn: document.querySelector("#animationClipAddBtn"),
  animationClipDeleteBtn: document.querySelector("#animationClipDeleteBtn"),
  animationPlayBtn: document.querySelector("#animationPlayBtn"),
  animationStopBtn: document.querySelector("#animationStopBtn"),
  animationPrevBtn: document.querySelector("#animationPrevBtn"),
  animationNextBtn: document.querySelector("#animationNextBtn"),
  animationResetBtn: document.querySelector("#animationResetBtn"),
  animationFpsInput: document.querySelector("#animationFpsInput"),
  animationEndInput: document.querySelector("#animationEndInput"),
  animationFrameLabel: document.querySelector("#animationFrameLabel"),
  animationTimeLabel: document.querySelector("#animationTimeLabel"),
  animationScrubber: document.querySelector("#animationScrubber"),
  animationTrackList: document.querySelector("#animationTrackList"),
  animationKeyBtn: document.querySelector("#animationKeyBtn"),
  animationDeleteFrameBtn: document.querySelector("#animationDeleteFrameBtn"),
  animationClearBtn: document.querySelector("#animationClearBtn"),
  animationExportBtn: document.querySelector("#animationExportBtn"),
  animationSheetViewSelect: document.querySelector("#animationSheetViewSelect"),
  animationExportRangeSelect: document.querySelector("#animationExportRangeSelect"),
  animationSheetFramesInput: document.querySelector("#animationSheetFramesInput"),
  animationExportBonesInput: document.querySelector("#animationExportBonesInput"),
  animationVideoDurationInput: document.querySelector("#animationVideoDurationInput"),
  animationVideoQualitySelect: document.querySelector("#animationVideoQualitySelect"),
  animationVideoLengthModeSelect: document.querySelector("#animationVideoLengthModeSelect"),
  animationSequenceClipSelect: document.querySelector("#animationSequenceClipSelect"),
  animationSequenceAddBtn: document.querySelector("#animationSequenceAddBtn"),
  animationSequencePreviewBtn: document.querySelector("#animationSequencePreviewBtn"),
  animationSequenceClearBtn: document.querySelector("#animationSequenceClearBtn"),
  animationUseSequenceInput: document.querySelector("#animationUseSequenceInput"),
  animationSequenceList: document.querySelector("#animationSequenceList"),
  animationSheetExportBtn: document.querySelector("#animationSheetExportBtn"),
  animationWebmExportBtn: document.querySelector("#animationWebmExportBtn"),
  animationMp4ExportBtn: document.querySelector("#animationMp4ExportBtn"),
  animatorWorkspaceOpenBtn: document.querySelector("#animatorWorkspaceOpenBtn"),
  animatorTimelineCollapseBtn: document.querySelector("#animatorTimelineCollapseBtn"),
  animatorClipSelect: document.querySelector("#animatorClipSelect"),
  workspaceSelect: document.querySelector("#workspaceSelect"),
  importBbmodelBtn: document.querySelector("#importBbmodelBtn"),
  importBbmodelFile: document.querySelector("#importBbmodelFile"),
  minecraftSection: document.querySelector("#minecraftSection"),
  minecraftToggle: document.querySelector("#minecraftToggle"),
  minecraftImportBtn: document.querySelector("#minecraftImportBtn"),
  minecraftImportStatus: document.querySelector("#minecraftImportStatus"),
  minecraftPlayerRigBtn: document.querySelector("#minecraftPlayerRigBtn"),
  minecraftPlayerRigStatus: document.querySelector("#minecraftPlayerRigStatus"),
  minecraftAnimationSelect: document.querySelector("#minecraftAnimationSelect"),
  minecraftLoaderSelect: document.querySelector("#minecraftLoaderSelect"),
  minecraftModIdInput: document.querySelector("#minecraftModIdInput"),
  minecraftPackageInput: document.querySelector("#minecraftPackageInput"),
  minecraftModelNameInput: document.querySelector("#minecraftModelNameInput"),
  minecraftEntityClassInput: document.querySelector("#minecraftEntityClassInput"),
  minecraftTextureInput: document.querySelector("#minecraftTextureInput"),
  minecraftAddColorInput: document.querySelector("#minecraftAddColorInput"),
  minecraftOutputColorInput: document.querySelector("#minecraftOutputColorInput"),
  minecraftSaveTextureBtn: document.querySelector("#minecraftSaveTextureBtn"),
  minecraftTextureOutputStatus: document.querySelector("#minecraftTextureOutputStatus"),
  minecraftExportJavaBtn: document.querySelector("#minecraftExportJavaBtn"),
  pluginManagerSection: document.querySelector("#pluginManagerSection"),
  pluginManagerToggle: document.querySelector("#pluginManagerToggle"),
  pluginManagerBody: document.querySelector("#pluginManagerBody"),
  pluginCountLabel: document.querySelector("#pluginCountLabel"),
  pluginTemplateBtn: document.querySelector("#pluginTemplateBtn"),
  pluginImportBtn: document.querySelector("#pluginImportBtn"),
  pluginImportFile: document.querySelector("#pluginImportFile"),
  pluginList: document.querySelector("#pluginList"),
  statusSection: document.querySelector("#statusSection"),
  statusToggle: document.querySelector("#statusToggle"),
  selectAllBtn: document.querySelector("#selectAllBtn"),
  deselectAllBtn: document.querySelector("#deselectAllBtn"),
  hideAllBtn: document.querySelector("#hideAllBtn"),
  unhideAllBtn: document.querySelector("#unhideAllBtn"),
  projectNameInput: document.querySelector("#projectNameInput"),
  newWorkspaceBtn: document.querySelector("#newWorkspaceBtn"),
  saveProjectBtn: document.querySelector("#saveProjectBtn"),
  loadProjectBtn: document.querySelector("#loadProjectBtn"),
  insertObjBtn: document.querySelector("#insertObjBtn"),
  loadProjectUrlBtn: document.querySelector("#loadProjectUrlBtn"),
  stopServerBtn: document.querySelector("#stopServerBtn"),
  importProjectFile: document.querySelector("#importProjectFile"),
  insertObjFile: document.querySelector("#insertObjFile"),
  importObjBtn: document.querySelector("#importObjBtn"),
  importObjFolderBtn: document.querySelector("#importObjFolderBtn"),
  importObjFile: document.querySelector("#importObjFile"),
  importObjFolderFile: document.querySelector("#importObjFolderFile"),
  importFile: document.querySelector("#importFile"),
  importDaeFile: document.querySelector("#importDaeFile"),
  undoBtn: document.querySelector("#undoBtn"),
  groupBtn: document.querySelector("#groupBtn"),
  ungroupBtn: document.querySelector("#ungroupBtn"),
  mergeMeshBtn: document.querySelector("#mergeMeshBtn"),
  pivotBtn: document.querySelector("#pivotBtn"),
  centerPivotBtn: document.querySelector("#centerPivotBtn"),
  rotationSnapSelect: document.querySelector("#rotationSnapSelect"),
  facePickBtn: document.querySelector("#facePickBtn"),
  faceRegionBtn: document.querySelector("#faceRegionBtn"),
  selectConnectedBtn: document.querySelector("#selectConnectedBtn"),
  openingPickBtn: document.querySelector("#openingPickBtn"),
  lineToolBtn: document.querySelector("#lineToolBtn"),
  triangleBuildBtn: document.querySelector("#triangleBuildBtn"),
  clearTriangleBuildBtn: document.querySelector("#clearTriangleBuildBtn"),
  closeLineBtn: document.querySelector("#closeLineBtn"),
  makeFaceBtn: document.querySelector("#makeFaceBtn"),
  fillLineBtn: document.querySelector("#fillLineBtn"),
  cutHoleSketchBtn: document.querySelector("#cutHoleSketchBtn"),
  clearLineBtn: document.querySelector("#clearLineBtn"),
  paintTriBtn: document.querySelector("#paintTriBtn"),
  paintTriInput: document.querySelector("#paintTriInput"),
  areaTriBtn: document.querySelector("#areaTriBtn"),
  areaTriInput: document.querySelector("#areaTriInput"),
  markerBtn: document.querySelector("#markerBtn"),
  clearTriBtn: document.querySelector("#clearTriBtn"),
  deleteTriBtn: document.querySelector("#deleteTriBtn"),
  extractTriBtn: document.querySelector("#extractTriBtn"),
  fillHoleBtn: document.querySelector("#fillHoleBtn"),
  bridgeMeshesBtn: document.querySelector("#bridgeMeshesBtn"),
  loftAxisSelect: document.querySelector("#loftAxisSelect"),
  loftPointsInput: document.querySelector("#loftPointsInput"),
  loftCheckedBtn: document.querySelector("#loftCheckedBtn"),
  symmetryAxisSelect: document.querySelector("#symmetryAxisSelect"),
  symmetryPlaneInput: document.querySelector("#symmetryPlaneInput"),
  liveMirrorBtn: document.querySelector("#liveMirrorBtn"),
  applyLiveMirrorBtn: document.querySelector("#applyLiveMirrorBtn"),
  mirrorCopyBtn: document.querySelector("#mirrorCopyBtn"),
  digIntoBtn: document.querySelector("#digIntoBtn"),
  removeMarksBtn: document.querySelector("#removeMarksBtn"),
  copyTriBtn: document.querySelector("#copyTriBtn"),
  pasteTriBtn: document.querySelector("#pasteTriBtn"),
  pasteMirroredTriBtn: document.querySelector("#pasteMirroredTriBtn"),
  extendFaceBtn: document.querySelector("#extendFaceBtn"),
  pullFaceBtn: document.querySelector("#pullFaceBtn"),
  pullToTargetBtn: document.querySelector("#pullToTargetBtn"),
  pushFaceBtn: document.querySelector("#pushFaceBtn"),
  surfaceEditorOpenBtn: document.querySelector("#surfaceEditorOpenBtn"),
  surfaceEditorWindow: document.querySelector("#surfaceEditorWindow"),
  surfaceEditorCloseBtn: document.querySelector("#surfaceEditorCloseBtn"),
  surfaceEditorSelection: document.querySelector("#surfaceEditorSelection"),
  surfaceSelectVertexBtn: document.querySelector("#surfaceSelectVertexBtn"),
  connectVerticesBtn: document.querySelector("#connectVerticesBtn"),
  surfaceSelectEdgeBtn: document.querySelector("#surfaceSelectEdgeBtn"),
  surfaceSelectTriangleBtn: document.querySelector("#surfaceSelectTriangleBtn"),
  surfaceSelectFaceBtn: document.querySelector("#surfaceSelectFaceBtn"),
  deleteSelectedSurfaceBtn: document.querySelector("#deleteSelectedSurfaceBtn"),
  surfaceMouseModeBtn: document.querySelector("#surfaceMouseModeBtn"),
  surfaceValueModeBtn: document.querySelector("#surfaceValueModeBtn"),
  surfaceTransformModelBtn: document.querySelector("#surfaceTransformModelBtn"),
  surfaceTransformSelectionBtn: document.querySelector("#surfaceTransformSelectionBtn"),
  autoSurfaceDragInput: document.querySelector("#autoSurfaceDragInput"),
  showModelingEdgesInput: document.querySelector("#showModelingEdgesInput"),
  surfaceMouseFalloffSelect: document.querySelector("#surfaceMouseFalloffSelect"),
  insetAmountInput: document.querySelector("#insetAmountInput"),
  insetFaceBtn: document.querySelector("#insetFaceBtn"),
  extrudeRegionBtn: document.querySelector("#extrudeRegionBtn"),
  modelToolsOpenBtn: document.querySelector("#modelToolsOpenBtn"),
  modelToolsWindow: document.querySelector("#modelToolsWindow"),
  modelToolsCloseBtn: document.querySelector("#modelToolsCloseBtn"),
  modelToolsBody: document.querySelector("#modelToolsBody"),
  outputToolsOpenBtn: document.querySelector("#outputToolsOpenBtn"),
  outputToolsWindow: document.querySelector("#outputToolsWindow"),
  outputToolsCloseBtn: document.querySelector("#outputToolsCloseBtn"),
  outputToolsBody: document.querySelector("#outputToolsBody"),
  dragPushBtn: document.querySelector("#dragPushBtn"),
  bevelTypeSelect: document.querySelector("#bevelTypeSelect"),
  bevelSizeInput: document.querySelector("#bevelSizeInput"),
  bevelDepthInput: document.querySelector("#bevelDepthInput"),
  edgeBevelWidthInput: document.querySelector("#edgeBevelWidthInput"),
  edgeBevelBtn: document.querySelector("#edgeBevelBtn"),
  cornerBevelModeSelect: document.querySelector("#cornerBevelModeSelect"),
  cornerBevelWidthInput: document.querySelector("#cornerBevelWidthInput"),
  cornerBevelPixelsInput: document.querySelector("#cornerBevelPixelsInput"),
  cornerBevelWidthRange: document.querySelector("#cornerBevelWidthRange"),
  cornerBevelWidthLabel: document.querySelector("#cornerBevelWidthLabel"),
  cornerBevelPixelsLabel: document.querySelector("#cornerBevelPixelsLabel"),
  cornerBevelDragLabel: document.querySelector("#cornerBevelDragLabel"),
  cornerBevelBtn: document.querySelector("#cornerBevelBtn"),
  subdivideLevelsInput: document.querySelector("#subdivideLevelsInput"),
  subdivideSelectedBtn: document.querySelector("#subdivideSelectedBtn"),
  loopCutAxisSelect: document.querySelector("#loopCutAxisSelect"),
  loopCutPositionInput: document.querySelector("#loopCutPositionInput"),
  loopCutCountInput: document.querySelector("#loopCutCountInput"),
  loopCutBtn: document.querySelector("#loopCutBtn"),
  knifeCutModeBtn: document.querySelector("#knifeCutModeBtn"),
  knifeCutCancelBtn: document.querySelector("#knifeCutCancelBtn"),
  knifeCutThroughInput: document.querySelector("#knifeCutThroughInput"),
  planeCutAxisSelect: document.querySelector("#planeCutAxisSelect"),
  planeCutPositionInput: document.querySelector("#planeCutPositionInput"),
  planeCutResultSelect: document.querySelector("#planeCutResultSelect"),
  planeCutCapInput: document.querySelector("#planeCutCapInput"),
  planeCutBtn: document.querySelector("#planeCutBtn"),
  bridgeEdgeLoopsBtn: document.querySelector("#bridgeEdgeLoopsBtn"),
  recalculateNormalsBtn: document.querySelector("#recalculateNormalsBtn"),
  flipNormalsBtn: document.querySelector("#flipNormalsBtn"),
  holeRepairStatus: document.querySelector("#holeRepairStatus"),
  holeRepairUvProjectionSelect: document.querySelector("#holeRepairUvProjectionSelect"),
  rotateSelectedUvLeftBtn: document.querySelector("#rotateSelectedUvLeftBtn"),
  rotateSelectedUvRightBtn: document.querySelector("#rotateSelectedUvRightBtn"),
  flipSelectedUvUBtn: document.querySelector("#flipSelectedUvUBtn"),
  flipSelectedUvVBtn: document.querySelector("#flipSelectedUvVBtn"),
  findHolesBtn: document.querySelector("#findHolesBtn"),
  previousHoleBtn: document.querySelector("#previousHoleBtn"),
  nextHoleBtn: document.querySelector("#nextHoleBtn"),
  frameHoleBtn: document.querySelector("#frameHoleBtn"),
  repairSelectedHoleBtn: document.querySelector("#repairSelectedHoleBtn"),
  repairAllHolesBtn: document.querySelector("#repairAllHolesBtn"),
  meshIntegrityStatus: document.querySelector("#meshIntegrityStatus"),
  checkNonManifoldBtn: document.querySelector("#checkNonManifoldBtn"),
  previousMeshIssueBtn: document.querySelector("#previousMeshIssueBtn"),
  nextMeshIssueBtn: document.querySelector("#nextMeshIssueBtn"),
  frameMeshIssueBtn: document.querySelector("#frameMeshIssueBtn"),
  clearMeshIssuesBtn: document.querySelector("#clearMeshIssuesBtn"),
  removeDoublesStatus: document.querySelector("#removeDoublesStatus"),
  removeDoublesToleranceInput: document.querySelector("#removeDoublesToleranceInput"),
  analyzeDoublesBtn: document.querySelector("#analyzeDoublesBtn"),
  removeDoublesBtn: document.querySelector("#removeDoublesBtn"),
  meshStatisticsStatus: document.querySelector("#meshStatisticsStatus"),
  meshStatisticsReport: document.querySelector("#meshStatisticsReport"),
  calculateMeshStatisticsBtn: document.querySelector("#calculateMeshStatisticsBtn"),
  copyMeshStatisticsBtn: document.querySelector("#copyMeshStatisticsBtn"),
  decimateStatus: document.querySelector("#decimateStatus"),
  decimateReductionInput: document.querySelector("#decimateReductionInput"),
  decimateFeatureAngleInput: document.querySelector("#decimateFeatureAngleInput"),
  decimatePreserveBoundariesInput: document.querySelector("#decimatePreserveBoundariesInput"),
  decimatePreserveUvSeamsInput: document.querySelector("#decimatePreserveUvSeamsInput"),
  decimatePreserveMaterialsInput: document.querySelector("#decimatePreserveMaterialsInput"),
  analyzeDecimateBtn: document.querySelector("#analyzeDecimateBtn"),
  applyDecimateBtn: document.querySelector("#applyDecimateBtn"),
  lodGeneratorStatus: document.querySelector("#lodGeneratorStatus"),
  lod1ReductionInput: document.querySelector("#lod1ReductionInput"),
  lod2ReductionInput: document.querySelector("#lod2ReductionInput"),
  lod3ReductionInput: document.querySelector("#lod3ReductionInput"),
  lodFeatureAngleInput: document.querySelector("#lodFeatureAngleInput"),
  lodPreserveBoundariesInput: document.querySelector("#lodPreserveBoundariesInput"),
  lodPreserveUvSeamsInput: document.querySelector("#lodPreserveUvSeamsInput"),
  lodPreserveMaterialsInput: document.querySelector("#lodPreserveMaterialsInput"),
  lodHideGeneratedInput: document.querySelector("#lodHideGeneratedInput"),
  analyzeLodGeneratorBtn: document.querySelector("#analyzeLodGeneratorBtn"),
  repairLodMeshBtn: document.querySelector("#repairLodMeshBtn"),
  generateLodGeneratorBtn: document.querySelector("#generateLodGeneratorBtn"),
  uvUnwrapStatus: document.querySelector("#uvUnwrapStatus"),
  uvUnwrapSeamAngleInput: document.querySelector("#uvUnwrapSeamAngleInput"),
  uvUnwrapPaddingInput: document.querySelector("#uvUnwrapPaddingInput"),
  uvAtlasSizeSelect: document.querySelector("#uvAtlasSizeSelect"),
  analyzeUvUnwrapBtn: document.querySelector("#analyzeUvUnwrapBtn"),
  applyUvUnwrapBtn: document.querySelector("#applyUvUnwrapBtn"),
  bakeTextureAtlasBtn: document.querySelector("#bakeTextureAtlasBtn"),
  uvPngExportSelect: document.querySelector("#uvPngExportSelect"),
  uvPngExportCount: document.querySelector("#uvPngExportCount"),
  exportUvPngBtn: document.querySelector("#exportUvPngBtn"),
  modelTileWidthInput: document.querySelector("#modelTileWidthInput"),
  modelTileDepthInput: document.querySelector("#modelTileDepthInput"),
  modelTileHeightInput: document.querySelector("#modelTileHeightInput"),
  modelTileFacingSelect: document.querySelector("#modelTileFacingSelect"),
  modelTileRotateBtn: document.querySelector("#modelTileRotateBtn"),
  modelTileExportBtn: document.querySelector("#modelTileExportBtn"),
  modelTileCenterBtn: document.querySelector("#modelTileCenterBtn"),
  modelTileCameraAzimuthInput: document.querySelector("#modelTileCameraAzimuthInput"),
  modelTileCameraElevationInput: document.querySelector("#modelTileCameraElevationInput"),
  modelTileCameraDistanceInput: document.querySelector("#modelTileCameraDistanceInput"),
  modelTileCameraTargetYInput: document.querySelector("#modelTileCameraTargetYInput"),
  modelTileCameraLockBtn: document.querySelector("#modelTileCameraLockBtn"),
  modelTileViewSetSelect: document.querySelector("#modelTileViewSetSelect"),
  modelTileHideFloorInput: document.querySelector("#modelTileHideFloorInput"),
  modelTileNeighbourPreviewInput: document.querySelector("#modelTileNeighbourPreviewInput"),
  modelTileNeighbourOpacityInput: document.querySelector("#modelTileNeighbourOpacityInput"),
  modelTileNeighbourOpacityValue: document.querySelector("#modelTileNeighbourOpacityValue"),
  modelTileTextureRepeatUInput: document.querySelector("#modelTileTextureRepeatUInput"),
  modelTileTextureRepeatVInput: document.querySelector("#modelTileTextureRepeatVInput"),
  modelTileTextureEdgeTrimInput: document.querySelector("#modelTileTextureEdgeTrimInput"),
  modelTileTextureRepeatBtn: document.querySelector("#modelTileTextureRepeatBtn"),
  modelTileTextureResetBtn: document.querySelector("#modelTileTextureResetBtn"),
  modelTileStatus: document.querySelector("#modelTileStatus"),
  gameAssetIdInput: document.querySelector("#gameAssetIdInput"),
  gameAssetIconInput: document.querySelector("#gameAssetIconInput"),
  gameAssetInventoryWidthInput: document.querySelector("#gameAssetInventoryWidthInput"),
  gameAssetInventoryHeightInput: document.querySelector("#gameAssetInventoryHeightInput"),
  gameAssetTypeSelect: document.querySelector("#gameAssetTypeSelect"),
  gameAssetSlotSelect: document.querySelector("#gameAssetSlotSelect"),
  gameAssetBoneInput: document.querySelector("#gameAssetBoneInput"),
  gameAssetHidePartsInput: document.querySelector("#gameAssetHidePartsInput"),
  gameAssetSaveBtn: document.querySelector("#gameAssetSaveBtn"),
  gameAssetExportBtn: document.querySelector("#gameAssetExportBtn"),
  gameAssetHumanoidRigBtn: document.querySelector("#gameAssetHumanoidRigBtn"),
  gameAssetStatus: document.querySelector("#gameAssetStatus"),
  edgeSlideAxisSelect: document.querySelector("#edgeSlideAxisSelect"),
  edgeSlideAmountInput: document.querySelector("#edgeSlideAmountInput"),
  edgeSlideBtn: document.querySelector("#edgeSlideBtn"),
  surfaceScaleAxisSelect: document.querySelector("#surfaceScaleAxisSelect"),
  surfaceScaleAmountInput: document.querySelector("#surfaceScaleAmountInput"),
  surfaceScaleBtn: document.querySelector("#surfaceScaleBtn"),
  surfaceScaleGizmoBtn: document.querySelector("#surfaceScaleGizmoBtn"),
  surfaceRotateGizmoBtn: document.querySelector("#surfaceRotateGizmoBtn"),
  surfaceScaleAllAxesBtn: document.querySelector("#surfaceScaleAllAxesBtn"),
  relaxModeSelect: document.querySelector("#relaxModeSelect"),
  relaxStrengthInput: document.querySelector("#relaxStrengthInput"),
  relaxIterationsInput: document.querySelector("#relaxIterationsInput"),
  relaxPreserveBoundaryInput: document.querySelector("#relaxPreserveBoundaryInput"),
  relaxVerticesBtn: document.querySelector("#relaxVerticesBtn"),
  weldVertexTargetSelect: document.querySelector("#weldVertexTargetSelect"),
  weldVerticesBtn: document.querySelector("#weldVerticesBtn"),
  dissolveSelectedBtn: document.querySelector("#dissolveSelectedBtn"),
  dragPushAxisSelect: document.querySelector("#dragPushAxisSelect"),
  dragPushStepInput: document.querySelector("#dragPushStepInput"),
  softRadiusInput: document.querySelector("#softRadiusInput"),
  softPullBtn: document.querySelector("#softPullBtn"),
  softPushBtn: document.querySelector("#softPushBtn"),
  connectFaceInput: document.querySelector("#connectFaceInput"),
  nameInput: document.querySelector("#nameInput"),
  posX: document.querySelector("#posX"),
  posY: document.querySelector("#posY"),
  posZ: document.querySelector("#posZ"),
  rotX: document.querySelector("#rotX"),
  rotY: document.querySelector("#rotY"),
  rotZ: document.querySelector("#rotZ"),
  scaleX: document.querySelector("#scaleX"),
  scaleY: document.querySelector("#scaleY"),
  scaleZ: document.querySelector("#scaleZ"),
  colorInput: document.querySelector("#colorInput"),
  colorHexInput: document.querySelector("#colorHexInput"),
  addColorToSceneBtn: document.querySelector("#addColorToSceneBtn"),
  roughInput: document.querySelector("#roughInput"),
  roughValue: document.querySelector("#roughValue"),
  opacityInput: document.querySelector("#opacityInput"),
  opacityValue: document.querySelector("#opacityValue"),
  cutSideSelect: document.querySelector("#cutSideSelect"),
  cutAmountInput: document.querySelector("#cutAmountInput"),
  cutMeshBtn: document.querySelector("#cutMeshBtn"),
  textureBtn: document.querySelector("#textureBtn"),
  textureEditorBtn: document.querySelector("#textureEditorBtn"),
  rotateTextureBtn: document.querySelector("#rotateTextureBtn"),
  flipTextureBtn: document.querySelector("#flipTextureBtn"),
  clearTextureBtn: document.querySelector("#clearTextureBtn"),
  saveTextureImageBtn: document.querySelector("#saveTextureImageBtn"),
  textureFile: document.querySelector("#textureFile"),
  textureName: document.querySelector("#textureName"),
  textureLibraryPanel: document.querySelector("#textureLibraryPanel"),
  textureLibraryCount: document.querySelector("#textureLibraryCount"),
  textureLibrarySelect: document.querySelector("#textureLibrarySelect"),
  textureLibraryUrlInput: document.querySelector("#textureLibraryUrlInput"),
  loadTextureLibraryUrlBtn: document.querySelector("#loadTextureLibraryUrlBtn"),
  addLibraryTextureBtn: document.querySelector("#addLibraryTextureBtn"),
  textureLibraryUrlStatus: document.querySelector("#textureLibraryUrlStatus"),
  textureRobloxIdRow: document.querySelector("#textureRobloxIdRow"),
  textureRobloxIdInput: document.querySelector("#textureRobloxIdInput"),
  applyLibraryTextureBtn: document.querySelector("#applyLibraryTextureBtn"),
  textureEditorModal: document.querySelector("#textureEditorModal"),
  textureEditorCanvas: document.querySelector("#textureEditorCanvas"),
  textureEditorPointerPreview: document.querySelector("#textureEditorPointerPreview"),
  textureEditorMeshName: document.querySelector("#textureEditorMeshName"),
  textureEditorPartSelect: document.querySelector("#textureEditorPartSelect"),
  textureEditorInfo: document.querySelector("#textureEditorInfo"),
  textureEditorCloseBtn: document.querySelector("#textureEditorCloseBtn"),
  textureEditorApplyBtn: document.querySelector("#textureEditorApplyBtn"),
  textureEditorResetBtn: document.querySelector("#textureEditorResetBtn"),
  textureEditorTool: document.querySelector("#textureEditorTool"),
  textureEditorToolButtons: [...document.querySelectorAll("[data-texture-tool]")],
  textureEditorClearSelectionBtn: document.querySelector("#textureEditorClearSelectionBtn"),
  textureEditorSelectionStatus: document.querySelector("#textureEditorSelectionStatus"),
  textureEditorShapeButtons: [...document.querySelectorAll("[data-texture-shape]")],
  textureEditorShapeFilled: document.querySelector("#textureEditorShapeFilled"),
  textureEditorSymmetryButtons: [...document.querySelectorAll("[data-texture-symmetry]")],
  textureEditorToolSettings: [...document.querySelectorAll("[data-texture-setting]")],
  textureEditorIdleHint: document.querySelector("#textureEditorIdleHint"),
  textureEditorChannelButtons: [...document.querySelectorAll("[data-texture-channel]")],
  textureEditorChannelInfo: document.querySelector("#textureEditorChannelInfo"),
  textureEditorColorLabel: document.querySelector("#textureEditorColorLabel"),
  textureEditorColor: document.querySelector("#textureEditorColor"),
  textureEditorChannelValue: document.querySelector("#textureEditorChannelValue"),
  textureEditorChannelValueLabel: document.querySelector("#textureEditorChannelValueLabel"),
  textureEditorChannelValueOutput: document.querySelector("#textureEditorChannelValueOutput"),
  textureEditorBrushSize: document.querySelector("#textureEditorBrushSize"),
  textureEditorPixelPen: document.querySelector("#textureEditorPixelPen"),
  textureEditorBrushPreview: document.querySelector("#textureEditorBrushPreview"),
  textureEditorPreviewLabel: document.querySelector("#textureEditorPreviewLabel"),
  textureEditorHardness: document.querySelector("#textureEditorHardness"),
  textureEditorOpacity: document.querySelector("#textureEditorOpacity"),
  textureEditorHammerRadius: document.querySelector("#textureEditorHammerRadius"),
  textureEditorShowUv: document.querySelector("#textureEditorShowUv"),
  textureEditorUvWidth: document.querySelector("#textureEditorUvWidth"),
  textureEditorUvHeight: document.querySelector("#textureEditorUvHeight"),
  textureEditorApplyUvScaleBtn: document.querySelector("#textureEditorApplyUvScaleBtn"),
  textureEditorEditUv: document.querySelector("#textureEditorEditUv"),
  textureEditorScaleUv: document.querySelector("#textureEditorScaleUv"),
  textureEditorSelectedOnly: document.querySelector("#textureEditorSelectedOnly"),
  textureEditorBaseColorSource: document.querySelector("#textureEditorBaseColorSource"),
  textureEditorTextureUrl: document.querySelector("#textureEditorTextureUrl"),
  textureEditorLoadUrlBtn: document.querySelector("#textureEditorLoadUrlBtn"),
  textureEditorChooseFileBtn: document.querySelector("#textureEditorChooseFileBtn"),
  textureEditorTextureFile: document.querySelector("#textureEditorTextureFile"),
  textureEditorTextureStatus: document.querySelector("#textureEditorTextureStatus"),
  textureEditorUndoBtn: document.querySelector("#textureEditorUndoBtn"),
  textureEditorZoomOutBtn: document.querySelector("#textureEditorZoomOutBtn"),
  textureEditorZoomResetBtn: document.querySelector("#textureEditorZoomResetBtn"),
  textureEditorZoomInBtn: document.querySelector("#textureEditorZoomInBtn"),
  textureEditorZoomValue: document.querySelector("#textureEditorZoomValue"),
  textureEditorLayerCount: document.querySelector("#textureEditorLayerCount"),
  textureEditorLayerList: document.querySelector("#textureEditorLayerList"),
  textureEditorAddLayerBtn: document.querySelector("#textureEditorAddLayerBtn"),
  textureEditorDuplicateLayerBtn: document.querySelector("#textureEditorDuplicateLayerBtn"),
  textureEditorLayerUpBtn: document.querySelector("#textureEditorLayerUpBtn"),
  textureEditorLayerDownBtn: document.querySelector("#textureEditorLayerDownBtn"),
  textureEditorMergeDownBtn: document.querySelector("#textureEditorMergeDownBtn"),
  textureEditorDeleteLayerBtn: document.querySelector("#textureEditorDeleteLayerBtn"),
  groupEditorModal: document.querySelector("#groupEditorModal"),
  groupEditorTitle: document.querySelector("#groupEditorTitle"),
  groupEditorInfo: document.querySelector("#groupEditorInfo"),
  groupEditorNameInput: document.querySelector("#groupEditorNameInput"),
  groupEditorFacts: document.querySelector("#groupEditorFacts"),
  groupEditorChildGroups: document.querySelector("#groupEditorChildGroups"),
  groupEditorTextures: document.querySelector("#groupEditorTextures"),
  groupEditorMeshes: document.querySelector("#groupEditorMeshes"),
  groupEditorCloseBtn: document.querySelector("#groupEditorCloseBtn"),
  groupEditorCancelBtn: document.querySelector("#groupEditorCancelBtn"),
  groupEditorSaveBtn: document.querySelector("#groupEditorSaveBtn"),
  meshDetailsModal: document.querySelector("#meshDetailsModal"),
  meshDetailsTitle: document.querySelector("#meshDetailsTitle"),
  meshDetailsInfo: document.querySelector("#meshDetailsInfo"),
  meshDetailsNameInput: document.querySelector("#meshDetailsNameInput"),
  meshMaterialRuleSelect: document.querySelector("#meshMaterialRuleSelect"),
  meshMaterialRuleInfo: document.querySelector("#meshMaterialRuleInfo"),
  meshDetailsFacts: document.querySelector("#meshDetailsFacts"),
  meshDetailsTexturePreview: document.querySelector("#meshDetailsTexturePreview"),
  meshDetailsShowUvInput: document.querySelector("#meshDetailsShowUvInput"),
  meshDetailsFutureNotes: document.querySelector("#meshDetailsFutureNotes"),
  meshDetailsCloseBtn: document.querySelector("#meshDetailsCloseBtn"),
  meshDetailsCancelBtn: document.querySelector("#meshDetailsCancelBtn"),
  meshDetailsSaveBtn: document.querySelector("#meshDetailsSaveBtn"),
  viewSpaceInput: document.querySelector("#viewSpaceInput"),
  shotSpaceInput: document.querySelector("#shotSpaceInput"),
  environmentSelect: document.querySelector("#environmentSelect"),
  backgroundSelect: document.querySelector("#backgroundSelect"),
  showGridInput: document.querySelector("#showGridInput"),
  useCurrentZoomInShotsInput: document.querySelector("#useCurrentZoomInShotsInput"),
  hideGridInShotsInput: document.querySelector("#hideGridInShotsInput"),
  showLightGuidesInput: document.querySelector("#showLightGuidesInput"),
  enablePrimaryLightInput: document.querySelector("#enablePrimaryLightInput"),
  enableMirrorLightInput: document.querySelector("#enableMirrorLightInput"),
  lightPosXInput: document.querySelector("#lightPosXInput"),
  lightPosYInput: document.querySelector("#lightPosYInput"),
  lightPosZInput: document.querySelector("#lightPosZInput"),
  lightTargetXInput: document.querySelector("#lightTargetXInput"),
  lightTargetYInput: document.querySelector("#lightTargetYInput"),
  lightTargetZInput: document.querySelector("#lightTargetZInput"),
  lightIntensityInput: document.querySelector("#lightIntensityInput"),
  lightAngleInput: document.querySelector("#lightAngleInput"),
  previewFrontBtn: document.querySelector("#previewFrontBtn"),
  previewBackBtn: document.querySelector("#previewBackBtn"),
  previewLeftBtn: document.querySelector("#previewLeftBtn"),
  previewRightBtn: document.querySelector("#previewRightBtn"),
  previewTopBtn: document.querySelector("#previewTopBtn"),
  previewIsoBtn: document.querySelector("#previewIsoBtn"),
  reliefImageBtn: document.querySelector("#reliefImageBtn"),
  reliefImageFile: document.querySelector("#reliefImageFile"),
  reliefImageName: document.querySelector("#reliefImageName"),
  reliefGridXInput: document.querySelector("#reliefGridXInput"),
  reliefGridYInput: document.querySelector("#reliefGridYInput"),
  reliefScaleInput: document.querySelector("#reliefScaleInput"),
  reliefDepthInput: document.querySelector("#reliefDepthInput"),
  reliefBackInput: document.querySelector("#reliefBackInput"),
  reliefThresholdInput: document.querySelector("#reliefThresholdInput"),
  reliefDetailInput: document.querySelector("#reliefDetailInput"),
  reliefSourceModeInput: document.querySelector("#reliefSourceModeInput"),
  reliefBuildModeInput: document.querySelector("#reliefBuildModeInput"),
  reliefDarkForegroundInput: document.querySelector("#reliefDarkForegroundInput"),
  createReliefMeshBtn: document.querySelector("#createReliefMeshBtn"),
  saveFrontPngBtn: document.querySelector("#saveFrontPngBtn"),
  saveBackPngBtn: document.querySelector("#saveBackPngBtn"),
  saveLeftPngBtn: document.querySelector("#saveLeftPngBtn"),
  saveRightPngBtn: document.querySelector("#saveRightPngBtn"),
  saveTopPngBtn: document.querySelector("#saveTopPngBtn"),
  saveIsoPngBtn: document.querySelector("#saveIsoPngBtn"),
  saveQaSheetBtn: document.querySelector("#saveQaSheetBtn"),
  resetZoomBtn: document.querySelector("#resetZoomBtn"),
  flat2dLookInput: document.querySelector("#flat2dLookInput"),
  modelTileFlat2dLookInput: document.querySelector("#modelTileFlat2dLookInput"),
  modelTileSnapBtn: document.querySelector("#modelTileSnapBtn"),
  hudText: document.querySelector("#hudText")
};

const textureEditorState = {
  open: false,
  meshId: null,
  sourceCanvas: null,
  originalCanvas: null,
  originalPixels: null,
  originalDataUrl: null,
  textureName: "Texture",
  channel: "baseColor",
  drawingRect: null,
  isPainting: false,
  lastPoint: null,
  tool: "brush",
  hoverPoint: null,
  undoStack: [],
  strokeSnapshotTaken: false,
  zoom: 1,
  panX: 0,
  panY: 0,
  isPanning: false,
  panStart: null,
  renderFrame: 0,
  selection: null,
  selectionDraft: null,
  isSelecting: false,
  shape: "rectangle",
  symmetry: "none",
  shapeStart: null,
  shapeEnd: null,
  isDrawingShape: false,
  uvLayoutDrag: null,
  layers: [],
  activeLayerId: null,
  layerCounter: 0
};

const textureLibrary = new Map();
const textureEditorDrafts = new Map();
const textureSourceCache = new Map();
const reliefImageState = {
  dataUrl: "",
  name: "",
  image: null,
  canvas: null,
  imageData: null
};
const meshDetailsState = {
  meshId: null
};
const materialRules = {
  auto: {
    label: "Auto",
    hardness: "Default",
    behavior: "Keeps the current mesh behavior until a future deformation tool uses a specific rule.",
    usage: "Useful when you have not classified the part yet."
  },
  metal: {
    label: "Metal",
    hardness: "Medium",
    behavior: "Bends, dents, folds, and usually stays connected.",
    usage: "Use for doors, hoods, roofs, panels, and structural body parts."
  },
  glass: {
    label: "Glass",
    hardness: "Brittle",
    behavior: "Shatters, vanishes, or breaks into shards instead of bending.",
    usage: "Use for windows, windshields, and lenses."
  },
  plastic: {
    label: "Plastic",
    hardness: "Low",
    behavior: "Cracks, splits, and can snap into loose chunks.",
    usage: "Use for bumpers, trim, mirrors, dashboards, and covers."
  },
  paper: {
    label: "Paper",
    hardness: "Fragile",
    behavior: "Crushes, wrinkles, folds, and collapses easily with almost no resistance.",
    usage: "Use for documents, cardboard, napkins, bags, wrappers, and thin paper props."
  },
  upholstery: {
    label: "Upholstery",
    hardness: "Padded",
    behavior: "Compresses a little and keeps its overall shape instead of denting like metal or snapping like plastic.",
    usage: "Use for seats, cushions, padded panels, and other stuffed interior parts."
  },
  rubber: {
    label: "Rubber",
    hardness: "Soft",
    behavior: "Compresses and squashes more than it tears.",
    usage: "Use for tires, seals, hoses, and soft trim."
  },
  hard: {
    label: "Hard",
    hardness: "Rigid",
    behavior: "Barely deforms and acts more like a blocker for nearby parts.",
    usage: "Use for engine blocks, rims, axles, and heavy reinforced parts."
  }
};
