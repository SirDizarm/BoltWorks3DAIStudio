import fs from "node:fs";
import path from "node:path";

const root = path.resolve(".");
const texturePath = path.join(root, "assets", "textures", "uv-topology-grid.svg");
const outputPath = path.join(root, "samples", "showcases", "uv-topology-test.modelerproj");
const textureName = "UV Topology Grid A1-D4";

if (!fs.existsSync(texturePath)) throw new Error(`Missing texture: ${texturePath}`);

const textureDataUrl = `data:image/svg+xml;base64,${fs.readFileSync(texturePath).toString("base64")}`;
const groups = [
  { id: "uv-edit", name: "EDIT THIS - UV and topology test", parentId: null },
  { id: "uv-reference", name: "REFERENCE - keep unchanged", parentId: null },
  { id: "uv-stage", name: "Display stage", parentId: null }
];

function object({ id, name, shape = "box", position, scale, color = "#ffffff", roughness = .48, groupId, textured = false }) {
  const group = groups.find(entry => entry.id === groupId);
  return {
    id,
    name,
    shape,
    position,
    rotation: [0, 0, 0],
    scale,
    color,
    roughness,
    opacity: 1,
    materialRule: textured ? "auto" : "metal",
    hidden: false,
    groupId,
    groupName: group?.name || null,
    textureUrl: null,
    textureName: textured ? textureName : null,
    textureFlipY: true,
    textureRotation: 0,
    textureRobloxAssetId: ""
  };
}

const mainId = "uv-test-main-block";
const project = {
  kind: "modeler-project",
  version: 1,
  name: "uv-topology-test",
  savedAt: new Date().toISOString(),
  textureLibrary: [{ name: textureName, dataUrl: textureDataUrl, robloxAssetId: "" }],
  scene: {
    version: 2,
    coordinateSystem: {
      handedness: "right-handed",
      units: "meters",
      upAxis: "+Y",
      groundPlane: "XZ",
      rotationUnits: "degrees",
      eulerOrder: "XYZ",
      objectPositions: "world space",
      geometryAndPivots: "object-local space"
    },
    groups,
    objects: [
      object({
        id: mainId,
        name: "EDIT ME - Textured topology block",
        position: [-.85, 1.25, 0],
        scale: [2.1, 2.1, 2.1],
        groupId: "uv-edit",
        textured: true
      }),
      object({
        id: "uv-test-reference-block",
        name: "REFERENCE - Original textured block",
        position: [1.55, .72, .15],
        scale: [.82, .82, .82],
        groupId: "uv-reference",
        textured: true
      }),
      object({
        id: "uv-test-plinth",
        name: "Test display plinth",
        position: [0, .08, 0],
        scale: [4.8, .16, 3.5],
        color: "#202b34",
        roughness: .8,
        groupId: "uv-stage"
      })
    ]
  },
  editor: {
    projectName: "uv-topology-test",
    selectedId: mainId,
    selectedGroupId: null,
    checkedIds: [],
    activeGroupIds: [],
    activeTransformMode: null,
    facePickMode: false,
    cameraViews: {
      selectedId: "uv-test-iso",
      showMarkers: false,
      views: [
        { id: "uv-test-iso", name: "UV Test Iso", type: "director", position: [5.4, 4.1, 6.2], target: [0, 1.05, 0], up: [0, 1, 0], fov: 42 },
        { id: "uv-test-front", name: "UV Test Front", type: "director", position: [0, 1.25, -7], target: [0, 1.15, 0], up: [0, 1, 0], fov: 42 }
      ]
    },
    view: {
      cameraPosition: [5.4, 4.1, 6.2],
      orbitTarget: [0, 1.05, 0],
      cameraUp: [0, 1, 0],
      viewSpace: 1.15,
      shotZoom: .9,
      environment: "studio",
      background: "dark",
      showGrid: true,
      useCurrentZoomInShots: true,
      hideGridInShots: true
    },
    panels: {
      addMeshCollapsed: false,
      inspectorCollapsed: false,
      utilitiesCollapsed: true,
      cameraViewsCollapsed: true,
      statusCollapsed: true
    },
    toolbars: {},
    tools: {
      rotationSnap: 0,
      bevelType: "outer",
      bevelSize: .08,
      bevelDepth: .08,
      dragPushAxis: "free",
      dragPushStep: .01,
      connectFace: false,
      coplanarFaceSelection: false
    },
    lighting: {
      showGuides: false,
      enablePrimary: true,
      enableMirror: true,
      lampPosition: [-4, 6, -5],
      lampTarget: [0, 1, 0],
      intensity: 10,
      angle: 32
    },
    rigging: { selectedBoneId: null, showGuides: false, bones: [] }
  }
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(project, null, 2)}\n`, "utf8");

if (process.argv.includes("--open")) {
  const pendingPath = path.join(root, ".runtime", "pending-open-project.json");
  fs.mkdirSync(path.dirname(pendingPath), { recursive: true });
  fs.writeFileSync(pendingPath, JSON.stringify({ fileName: path.basename(outputPath), data: project }), "utf8");
}

console.log(`Generated ${outputPath} with embedded texture ${path.relative(root, texturePath)}.`);
