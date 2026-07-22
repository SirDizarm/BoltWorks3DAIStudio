const canvas = document.querySelector("#canvas");
const frontBoneCanvas = document.querySelector("#frontBoneCanvas");
const sideBoneCanvas = document.querySelector("#sideBoneCanvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;

const frontBoneRenderer = new THREE.WebGLRenderer({ canvas: frontBoneCanvas, antialias: true, alpha: true });
const sideBoneRenderer = new THREE.WebGLRenderer({ canvas: sideBoneCanvas, antialias: true, alpha: true });
frontBoneRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
sideBoneRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
const studioBackground = new THREE.Color(0x0b0e10);
const plainBackground = new THREE.Color(0x17232b);
scene.background = studioBackground;

const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 1000000);
camera.position.set(6, 5, 7);
camera.layers.enable(3);

const frontBoneCamera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.01, 10000);
frontBoneCamera.position.set(0, 0, 100);
frontBoneCamera.lookAt(0, 0, 0);
frontBoneCamera.layers.enable(1);
const sideBoneCamera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.01, 10000);
sideBoneCamera.position.set(100, 0, 0);
sideBoneCamera.lookAt(0, 0, 0);
sideBoneCamera.layers.enable(2);

const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.minDistance = 0.05;
orbit.maxDistance = 500000;
orbit.target.set(0, 1, 0);

const transform = new TransformControls(camera, renderer.domElement);
transform.visible = false;
transform.addEventListener("dragging-changed", event => orbit.enabled = !event.value);
transform.addEventListener("mouseDown", () => {
  if (!pivotEditMode) recordHistory("transform");
  beginScaleDragSession();
});
transform.addEventListener("mouseUp", () => {
  finishScaleDragSession();
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
  updateTriangleHelpers();
  syncSelectionOutlineTransforms();
  syncInspector();
  updateState();
  updateScore();
});
scene.add(transform);

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
let selected = null;
let facePickMode = false;
let coplanarFacePickMode = false;
let openingPickMode = false;
let lineSketchMode = false;
let dragPushMode = false;
let lineSketchClosed = false;
let lineSketchPlane = null;
let lineSketchPlaneNormal = null;
let lineSketchHover = null;
const lineSketchPoints = [];
let selectedFace = null;
const selectedFaces = [];
let copiedTrianglePatch = null;
let isPaintingTriangles = false;
let isAreaSelectingTriangles = false;
let lastPaintedTriangleKey = null;
let lastPaintLogAt = 0;
let spaceCameraMode = false;
let areaSelectionStart = null;
let activeTransformMode = null;
let dragPushSession = null;
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
const selectionOutlineGroup = new THREE.Group();
selectionOutlineGroup.name = "selected object silhouette";
scene.add(selectionOutlineGroup);
const openingPickGuideGroup = new THREE.Group();
openingPickGuideGroup.name = "opening pick preview";
openingPickGuideGroup.visible = false;
scene.add(openingPickGuideGroup);
let selectedHoleLoopInfo = null;
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
const markerGroup = new THREE.Group();
markerGroup.name = "marker helpers";
scene.add(markerGroup);
const markerHelpers = [];
const cameraDirectorGroup = new THREE.Group();
cameraDirectorGroup.name = "camera director helpers";
scene.add(cameraDirectorGroup);
let customCameraViews = [];
let selectedCustomCameraId = null;
let customCameraIdCounter = 0;
const sceneGroupRegistry = new Map();
let selectedGroupRecordId = null;

const els = {
  tree: document.querySelector("#sceneTree"),
  log: document.querySelector("#log"),
  stateOutput: document.querySelector("#stateOutput"),
  selectionBox: document.querySelector("#selectionBox"),
  addMeshSection: document.querySelector("#addMeshSection"),
  addMeshToggle: document.querySelector("#addMeshToggle"),
  toolbarPicker: document.querySelector("#toolbarPicker"),
  toggleToolbarTransform: document.querySelector("#toggleToolbarTransform"),
  toggleToolbarMirror: document.querySelector("#toggleToolbarMirror"),
  toggleToolbarSelectionTools: document.querySelector("#toggleToolbarSelectionTools"),
  toggleToolbarLineTools: document.querySelector("#toggleToolbarLineTools"),
  toggleToolbarMarkerTools: document.querySelector("#toggleToolbarMarkerTools"),
  toggleToolbarTriEditor: document.querySelector("#toggleToolbarTriEditor"),
  toggleToolbarMiscTools: document.querySelector("#toggleToolbarMiscTools"),
  toggleToolbarFaceEdit: document.querySelector("#toggleToolbarFaceEdit"),
  toggleToolbarScene: document.querySelector("#toggleToolbarScene"),
  toggleToolbarProjectFiles: document.querySelector("#toggleToolbarProjectFiles"),
  toggleToolbarViews: document.querySelector("#toggleToolbarViews"),
  toggleToolbarImportExport: document.querySelector("#toggleToolbarImportExport"),
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
  cameraViewsSection: document.querySelector("#cameraViewsSection"),
  cameraViewsToggle: document.querySelector("#cameraViewsToggle"),
  addCustomCameraBtn: document.querySelector("#addCustomCameraBtn"),
  viewCustomCameraBtn: document.querySelector("#viewCustomCameraBtn"),
  updateCustomCameraBtn: document.querySelector("#updateCustomCameraBtn"),
  deleteCustomCameraBtn: document.querySelector("#deleteCustomCameraBtn"),
  customCameraList: document.querySelector("#customCameraList"),
  customCameraNameInput: document.querySelector("#customCameraNameInput"),
  customCameraPosX: document.querySelector("#customCameraPosX"),
  customCameraPosY: document.querySelector("#customCameraPosY"),
  customCameraPosZ: document.querySelector("#customCameraPosZ"),
  customCameraTargetX: document.querySelector("#customCameraTargetX"),
  customCameraTargetY: document.querySelector("#customCameraTargetY"),
  customCameraTargetZ: document.querySelector("#customCameraTargetZ"),
  showCustomCamerasInput: document.querySelector("#showCustomCamerasInput"),
  imageReliefMeshPlugin: document.querySelector("#imageReliefMeshPlugin"),
  sceneRenderingTools: document.querySelector("#sceneRenderingTools"),
  boneAxisFreeBtn: document.querySelector("#boneAxisFreeBtn"),
  boneAxisXBtn: document.querySelector("#boneAxisXBtn"),
  boneAxisYBtn: document.querySelector("#boneAxisYBtn"),
  boneAxisZBtn: document.querySelector("#boneAxisZBtn"),
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
  statusSection: document.querySelector("#statusSection"),
  statusToggle: document.querySelector("#statusToggle"),
  selectAllBtn: document.querySelector("#selectAllBtn"),
  deselectAllBtn: document.querySelector("#deselectAllBtn"),
  hideAllBtn: document.querySelector("#hideAllBtn"),
  unhideAllBtn: document.querySelector("#unhideAllBtn"),
  projectNameInput: document.querySelector("#projectNameInput"),
  saveProjectBtn: document.querySelector("#saveProjectBtn"),
  loadProjectBtn: document.querySelector("#loadProjectBtn"),
  stopServerBtn: document.querySelector("#stopServerBtn"),
  importProjectFile: document.querySelector("#importProjectFile"),
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
  openingPickBtn: document.querySelector("#openingPickBtn"),
  lineToolBtn: document.querySelector("#lineToolBtn"),
  closeLineBtn: document.querySelector("#closeLineBtn"),
  makeFaceBtn: document.querySelector("#makeFaceBtn"),
  fillLineBtn: document.querySelector("#fillLineBtn"),
  cutHoleSketchBtn: document.querySelector("#cutHoleSketchBtn"),
  clearLineBtn: document.querySelector("#clearLineBtn"),
  paintTriInput: document.querySelector("#paintTriInput"),
  areaTriBtn: document.querySelector("#areaTriBtn"),
  areaTriInput: document.querySelector("#areaTriInput"),
  markerBtn: document.querySelector("#markerBtn"),
  clearTriBtn: document.querySelector("#clearTriBtn"),
  deleteTriBtn: document.querySelector("#deleteTriBtn"),
  extractTriBtn: document.querySelector("#extractTriBtn"),
  fillHoleBtn: document.querySelector("#fillHoleBtn"),
  bridgeMeshesBtn: document.querySelector("#bridgeMeshesBtn"),
  digIntoBtn: document.querySelector("#digIntoBtn"),
  removeMarksBtn: document.querySelector("#removeMarksBtn"),
  copyTriBtn: document.querySelector("#copyTriBtn"),
  pasteTriBtn: document.querySelector("#pasteTriBtn"),
  extendFaceBtn: document.querySelector("#extendFaceBtn"),
  pullFaceBtn: document.querySelector("#pullFaceBtn"),
  pushFaceBtn: document.querySelector("#pushFaceBtn"),
  dragPushBtn: document.querySelector("#dragPushBtn"),
  bevelTypeSelect: document.querySelector("#bevelTypeSelect"),
  bevelSizeInput: document.querySelector("#bevelSizeInput"),
  bevelDepthInput: document.querySelector("#bevelDepthInput"),
  dragPushAxisSelect: document.querySelector("#dragPushAxisSelect"),
  dragPushStepInput: document.querySelector("#dragPushStepInput"),
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
  textureRobloxIdRow: document.querySelector("#textureRobloxIdRow"),
  textureRobloxIdInput: document.querySelector("#textureRobloxIdInput"),
  applyLibraryTextureBtn: document.querySelector("#applyLibraryTextureBtn"),
  importLibraryTextureBtn: document.querySelector("#importLibraryTextureBtn"),
  textureEditorModal: document.querySelector("#textureEditorModal"),
  textureEditorCanvas: document.querySelector("#textureEditorCanvas"),
  textureEditorMeshName: document.querySelector("#textureEditorMeshName"),
  textureEditorInfo: document.querySelector("#textureEditorInfo"),
  textureEditorCloseBtn: document.querySelector("#textureEditorCloseBtn"),
  textureEditorApplyBtn: document.querySelector("#textureEditorApplyBtn"),
  textureEditorResetBtn: document.querySelector("#textureEditorResetBtn"),
  textureEditorTool: document.querySelector("#textureEditorTool"),
  textureEditorColor: document.querySelector("#textureEditorColor"),
  textureEditorBrushSize: document.querySelector("#textureEditorBrushSize"),
  textureEditorHammerRadius: document.querySelector("#textureEditorHammerRadius"),
  textureEditorShowUv: document.querySelector("#textureEditorShowUv"),
  textureEditorSelectedOnly: document.querySelector("#textureEditorSelectedOnly"),
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
  reliefSmoothInput: document.querySelector("#reliefSmoothInput"),
  reliefSourceModeInput: document.querySelector("#reliefSourceModeInput"),
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
  hudText: document.querySelector("#hudText")
};

const textureEditorState = {
  open: false,
  meshId: null,
  sourceCanvas: null,
  originalDataUrl: null,
  textureName: "Texture",
  drawingRect: null,
  isPainting: false,
  lastPoint: null,
  tool: "brush",
  hoverPoint: null
};

const textureLibrary = new Map();
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
