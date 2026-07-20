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
scene.background = new THREE.Color(0x0b0e10);

const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 1000000);
camera.position.set(6, 5, 7);

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
scene.add(floor);

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
  cutSideSelect: document.querySelector("#cutSideSelect"),
  cutAmountInput: document.querySelector("#cutAmountInput"),
  cutMeshBtn: document.querySelector("#cutMeshBtn"),
  textureBtn: document.querySelector("#textureBtn"),
  textureEditorBtn: document.querySelector("#textureEditorBtn"),
  rotateTextureBtn: document.querySelector("#rotateTextureBtn"),
  flipTextureBtn: document.querySelector("#flipTextureBtn"),
  clearTextureBtn: document.querySelector("#clearTextureBtn"),
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
