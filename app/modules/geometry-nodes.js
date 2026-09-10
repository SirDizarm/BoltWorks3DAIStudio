const GEOMETRY_NODES_STORAGE_KEY = "boltworks.geometryNodes.v1";
const GEOMETRY_NODE_DEFINITIONS = Object.freeze({
  ...Object.fromEntries(Object.entries(BWS_ASSET_NODES).map(([type, node]) => [type, Object.freeze({title:node.title, category:node.category || "Game Assets", input:node.attachment ? "Geometry" : "Seed", inputSockets:[node.attachment ? "Geometry" : "Seed","Texture"], output:"Geometry"})])),
  seed: Object.freeze({ title: "Seed", category: "Inputs", input: null, output: "Seed" }),
  textureRandomizer: Object.freeze({ title: "Texture / Color Randomizer", category: "Inputs", input: "Texture", inputSockets: ["Texture", "Texture 2", "Texture 3", "Texture 4"], output: "Texture" }),
  colorPalette: Object.freeze({title:"Color Palette",category:"Inputs",input:"Texture",inputSockets:["Texture"],output:"Texture"}),
  textureInput: Object.freeze({ title: "Texture Input", category: "Inputs", input: null, output: "Texture" }),
  variant: Object.freeze({ title: "Tree Variant", category: "Inputs", input: "Seed", output: "Seed" }),
  primitive: Object.freeze({ title: "Mesh Primitive", category: "Geometry", input: null, output: "Geometry" }),
  stem: Object.freeze({ title: "Tapered Stem", category: "Geometry", input: "Seed", output: "Geometry" }),
  branchArray: Object.freeze({ title: "Branch Array", category: "Geometry", input: "Geometry", output: "Geometry" }),
  clusterScatter: Object.freeze({ title: "Cluster Scatter", category: "Geometry", input: "Geometry", output: "Geometry" }),
  rocks: Object.freeze({ title: "Rock Generator", category: "Nature", input: "Seed", inputSockets: ["Seed", "Texture"], output: "Geometry" }),
  stoneWall: Object.freeze({ title: "Stone Wall", category: "Nature", input: "Seed", inputSockets: ["Seed", "Upper", "Middle", "Bottom", "Overall"], output: "Geometry" }),
  grass: Object.freeze({ title: "Grass Scatter", category: "Nature Details", input: "Geometry", output: "Geometry" }),
  moss: Object.freeze({ title: "Moss Growth", category: "Nature Details", input: "Geometry", output: "Geometry" }),
  join: Object.freeze({ title: "Join Geometry", category: "Layout", input: "Geometry", inputSockets: ["Geometry", "Geometry 2", "Geometry 3", "Geometry 4"], output: "Geometry", multiInput: true }),
  primitiveTest: Object.freeze({ title: "Primitive Smooth Test", category: "Testing", input: "Seed", output: "Geometry" }),
  roots: Object.freeze({ title: "Root Flare", category: "Growth", input: "Seed", output: "Seed" }),
  trunk: Object.freeze({ title: "Trunk", category: "Growth", input: "Seed", output: "Trunk" }),
  bend: Object.freeze({ title: "Trunk Bend", category: "Modifiers", input: "Trunk", output: "Trunk" }),
  branches: Object.freeze({ title: "Branches", category: "Growth", input: "Trunk", output: "Branches" }),
  smoothJoints: Object.freeze({ title: "Smooth Joints", category: "Modifiers", input: "Branches", output: "Branches" }),
  junctionBlend: Object.freeze({ title: "Junction Blend", category: "Modifiers", input: "Geometry", output: "Geometry" }),
  twigs: Object.freeze({ title: "Twigs", category: "Growth", input: "Branches", output: "Branches" }),
  canopy: Object.freeze({ title: "Canopy", category: "Growth", input: "Branches", output: "Canopy" }),
  knot: Object.freeze({ title: "Cut Knot", category: "Growth", input: "Trunk", output: "Geometry" }),
  cutSurface: Object.freeze({ title: "Cut Rings", category: "Modifiers", input: "Geometry", output: "Geometry" }),
  smoothGeometry: Object.freeze({ title: "Smooth Geometry", category: "Modifiers", input: "Geometry", output: "Geometry", contextOnly: true }),
  transform: Object.freeze({ title: "Output Transform", category: "Modifiers", input: "Geometry", output: "Geometry" }),
  output: Object.freeze({ title: "Group Output", category: "Output", input: "Geometry", inputSockets: ["Geometry", "Geometry 2", "Geometry 3", "Geometry 4"], multiInput: true, output: null })
});
const GEOMETRY_NODE_TYPES = Object.freeze(Object.keys(GEOMETRY_NODE_DEFINITIONS));
const GEOMETRY_NODE_SOURCE_TYPES = Object.freeze(["primitive", "primitiveTest", "stem", "trunk", "rocks", "stoneWall", ...Object.keys(BWS_ASSET_NODES).filter(type => !BWS_ASSET_NODES[type].attachment)]);
const GEOMETRY_NODE_DEFAULT_ORDER = Object.freeze(["seed", "variant", "trunk", "branches", "smoothJoints", "twigs", "canopy", "cutSurface", "output"]);
let geometryNodesRuntimeEnabled = false;
let geometryNodesInitialized = false;
let geometryNodePendingDeleteId = null;
let geometryNodesDetachedWindow = null;
const geometryNodeInteractionByDocument = new WeakMap();

const GEOMETRY_NODE_SURFACE_IDS = Object.freeze({
  sidebar: {
    root: "geometryNodesBody", select: "geometryNodeGraphSelect", newButton: "geometryNodeNewBtn",
    buildButton: "geometryNodeBuildBtn", bakeButton: "geometryNodeBakeBtn", deleteButton: "geometryNodeDeleteBtn",
    copyButton: "geometryNodeCopyBtn", pasteButton: "geometryNodePasteBtn",
    saveClusterButton: "geometryNodeSaveClusterBtn", loadClusterButton: "geometryNodeLoadClusterBtn", fileInput: "geometryNodeClusterFile",
    canvas: "geometryNodeCanvas", status: "geometryNodeStatus"
  },
  detached: {
    root: "geometryNodeDetachedRoot", select: "geometryNodeDetachedGraphSelect", newButton: "geometryNodeDetachedNewBtn",
    buildButton: "geometryNodeDetachedBuildBtn", bakeButton: "geometryNodeDetachedBakeBtn", deleteButton: "geometryNodeDetachedDeleteBtn",
    copyButton: "geometryNodeDetachedCopyBtn", pasteButton: "geometryNodeDetachedPasteBtn",
    saveClusterButton: "geometryNodeDetachedSaveClusterBtn", loadClusterButton: "geometryNodeDetachedLoadClusterBtn", fileInput: "geometryNodeDetachedClusterFile",
    canvas: "geometryNodeDetachedCanvas", status: "geometryNodeDetachedStatus"
  }
});

function geometryNodeId(prefix = "graph") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function defaultGeometryNodeGraph(name = "Procedural Geometry") {
  const nodePositions = {};
  GEOMETRY_NODE_TYPES.forEach((type, index) => { nodePositions[type] = [18 + index * 178, index % 2 ? 26 : 42]; });
  GEOMETRY_NODE_DEFAULT_ORDER.forEach((type, index) => { nodePositions[type] = [18 + index * 178, index % 2 ? 26 : 42]; });
  const nodeOrder = [...GEOMETRY_NODE_DEFAULT_ORDER];
  return {
    id: geometryNodeId("tree"),
    name,
    type: "tree",
    seed: 42,
    params: {
      ...assetNodeDefaults(),
      height: 8,
      variantStyle: "classic",
      variantSeason: "summer",
      variantMaturity: "mature",
      variantAmount: 0.55,
      smoothAxis: "xyz",
      smoothIterations: 2,
      smoothStrength: 0.72,
      smoothPreserveSize: true,
      smoothRoots: true,
      smoothTrunk: true,
      smoothBranches: true,
      smoothTwigs: true,
      smoothCanopy: false,
      smoothJoints: true,
      smoothCutRings: false,
      trunkWidth: 0.82,
      trunkSegments: 6,
      rootCount: 6,
      rootLength: 1.35,
      rootThickness: 0.34,
      trunkBend: 0.22,
      branchCount: 9,
      branchSpread: 66,
      branchLength: 2.6,
      jointSize: 0.85,
      jointTrunkSeams: false,
      twigLength: 0.45,
      twigRise: 0.72,
      canopyEnabled: true,
      canopySize: 1.25,
      canopyDensity: 2,
      knotCount: 3,
      knotSize: 0.3,
      knotInset: 0.04,
      knotRings: 4,
      cutRingCount: 7,
      cutRingDepth: 0.035,
      cutRingContrast: 0.55,
      transformX: 0,
      transformY: 0,
      transformZ: 0,
      transformRotX: 0,
      transformRotY: 0,
      transformRotZ: 0,
      transformScale: 1,
      outputName: name,
      textureName: "",
      textureData: "",
      texturePoolSeed: 0,
      texturePoolUvs: true,
      texturePoolVariation: .75,
      textureRandomize: true,
      textureVariation: 1,
      wallOverallTextureMix: .35,
      primitiveShape: "facetedBallLow",
      primitiveSizeX: 1,
      primitiveSizeY: 1,
      primitiveSizeZ: 1,
      primitiveColor: "#4f8f54",
      stemHeight: 8.5,
      stemBaseRadius: 0.48,
      stemTopRadius: 0.16,
      stemSegments: 9,
      stemSides: 12,
      stemLean: 0.18,
      stemFlare: 0.2,
      stemColor: "#754c35",
      branchArrayCount: 7,
      branchArrayLength: 2.35,
      branchArrayRise: 0.56,
      branchArrayRadius: 0.2,
      branchArrayTaper: 0.28,
      branchArrayTwist: 42,
      branchColor: "#754c35",
      junctionBlendSize: 1.18,
      junctionBlendLength: 1.45,
      clusterScatterCount: 11,
      clusterScatterSize: 1.05,
      clusterScatterSpread: 0.72,
      clusterScatterColor: "#4f8246"
      ,rockProfile: "rounded"
      ,rockArrangement: "cluster"
      ,rockCount: 6
      ,rockSize: 1.25
      ,rockVariation: 0.42
      ,rockSpacing: 1.05
      ,rockColor: "#59635f"
      ,rockColorSecondary: "#7b8782"
      ,rockColorTertiary: "#b1beb8"
      ,rockTextureName: ""
      ,rockAddInnerPanel: true
      ,wallLength: 12
      ,wallHeight: 2.8
      ,wallDepth: 1.15
      ,wallRows: 4
      ,wallColumns: 8
      ,wallDepthLayers: 3
      ,wallIrregularity: 0.32
      ,wallColorVariation: 0.58
      ,wallColor: "#5e6662"
      ,wallColorSecondary: "#7c8782"
      ,wallColorTertiary: "#b4c0ba"
      ,wallTextureName: ""
      ,wallAddInnerPanel: true
      ,joinAddInnerPanel: true
      ,joinPanelInset: 0.16
      ,joinPanelAxis: "auto"
      ,joinPanelColor: "#5e6662"
      ,grassCount: 18
      ,grassHeight: 0.48
      ,grassWidth: 0.045
      ,grassSpread: 0.35
      ,grassAvoidGeometry: true
      ,grassClearance: 0.12
      ,grassGrowNegativeX: true
      ,grassGrowPositiveX: true
      ,grassGrowNegativeZ: true
      ,grassGrowPositiveZ: true
      ,grassColor: "#376f2d"
      ,mossPlacement: "bottom"
      ,mossCoverage: 0.55
      ,mossThickness: 0.12
      ,mossMoisture: 0.72
      ,mossSunlight: 0.3
      ,mossCrackBias: 0.68
      ,mossColor: "#315f2a"
      ,natureOutputMode: "both"
    },
    nodeParams: {},
    nodeOrder,
    nodePositions,
    smoothNodes: [],
    connections: nodeOrder.slice(0, -1).map((fromNodeId, index) => ({ id: geometryNodeId("link"), fromNodeId, toNodeId: nodeOrder[index + 1] })),
    view: { x: 0, y: 0, scale: 1 },
    generatedIds: [],
    centerOutput: false,
    buildVersion: 0
  };
}

function defaultGeometryNodeProjectState() {
  return defaultEmptyGeometryNodeProjectState();
}

function defaultEmptyGeometryNodeProjectState() {
  const graph = defaultGeometryNodeGraph("Untitled Geometry");
  graph.nodeOrder = [];
  graph.nodePositions.seed = [80, 160];
  graph.nodePositions.output = [430, 160];
  graph.connections = [];
  return { version: 1, activeGraphId: graph.id, graphs: [graph] };
}

function geometryNodeNumber(value, fallback, min, max) {
  const number = Number(value);
  return Math.max(min, Math.min(max, Number.isFinite(number) ? number : fallback));
}

function sanitizeGeometryNodeGraph(value, fallbackName = "Procedural Geometry") {
  const fallback = defaultGeometryNodeGraph(fallbackName);
  const source = value && typeof value === "object" ? value : {};
  const params = source.params && typeof source.params === "object" ? source.params : {};
  const positions = source.nodePositions && typeof source.nodePositions === "object" ? source.nodePositions : {};
  const graph = {
    ...fallback,
    id: String(source.id || fallback.id),
    name: String(source.name || fallbackName).trim().slice(0, 80) || fallbackName,
    seed: Math.round(geometryNodeNumber(source.seed, fallback.seed, 0, 999999)),
    params: {
      ...params,
      ...assetNodeSanitize(params),
      height: geometryNodeNumber(params.height, fallback.params.height, 1, 30),
      variantStyle: ["classic", "broad", "round", "tall", "sparse", "bare"].includes(params.variantStyle) ? params.variantStyle : fallback.params.variantStyle,
      variantSeason: ["spring", "summer", "autumn", "winter", "snowy"].includes(params.variantSeason) ? params.variantSeason : fallback.params.variantSeason,
      variantMaturity: ["sapling", "young", "mature", "ancient"].includes(params.variantMaturity) ? params.variantMaturity : fallback.params.variantMaturity,
      variantAmount: geometryNodeNumber(params.variantAmount, fallback.params.variantAmount, 0, 1),
      smoothAxis: ["xyz", "xy", "xz", "yz", "x", "y", "z"].includes(params.smoothAxis) ? params.smoothAxis : fallback.params.smoothAxis,
      smoothIterations: Math.round(geometryNodeNumber(params.smoothIterations, fallback.params.smoothIterations, 1, 2)),
      smoothStrength: geometryNodeNumber(params.smoothStrength, fallback.params.smoothStrength, .05, 1),
      smoothPreserveSize: params.smoothPreserveSize !== false,
      smoothRoots: params.smoothRoots !== false,
      smoothTrunk: params.smoothTrunk !== false,
      smoothBranches: params.smoothBranches !== false,
      smoothTwigs: params.smoothTwigs !== false,
      smoothCanopy: params.smoothCanopy === true,
      smoothJoints: params.smoothJoints !== false,
      smoothCutRings: params.smoothCutRings === true,
      trunkWidth: geometryNodeNumber(params.trunkWidth, fallback.params.trunkWidth, 0.1, 5),
      trunkSegments: Math.round(geometryNodeNumber(params.trunkSegments, fallback.params.trunkSegments, 2, 16)),
      rootCount: Math.round(geometryNodeNumber(params.rootCount, fallback.params.rootCount, 1, 16)),
      rootLength: geometryNodeNumber(params.rootLength, fallback.params.rootLength, .2, 6),
      rootThickness: geometryNodeNumber(params.rootThickness, fallback.params.rootThickness, .05, 2),
      trunkBend: geometryNodeNumber(params.trunkBend, fallback.params.trunkBend, 0, 1.5),
      branchCount: Math.round(geometryNodeNumber(params.branchCount, fallback.params.branchCount, 0, 32)),
      branchSpread: geometryNodeNumber(params.branchSpread, fallback.params.branchSpread, 10, 88),
      branchLength: geometryNodeNumber(params.branchLength, fallback.params.branchLength, 0.3, 10),
      jointSize: geometryNodeNumber(params.jointSize, fallback.params.jointSize, .45, 1.4),
      jointTrunkSeams: params.jointTrunkSeams === true,
      twigLength: geometryNodeNumber(params.twigLength, fallback.params.twigLength, .1, 1.5),
      twigRise: geometryNodeNumber(params.twigRise, fallback.params.twigRise, .1, 1.5),
      canopyEnabled: params.canopyEnabled !== false,
      canopySize: geometryNodeNumber(params.canopySize, fallback.params.canopySize, 0.2, 5),
      canopyDensity: Math.round(geometryNodeNumber(params.canopyDensity, fallback.params.canopyDensity, 1, 4)),
      knotCount: Math.round(geometryNodeNumber(params.knotCount, fallback.params.knotCount, 1, 12)),
      knotSize: geometryNodeNumber(params.knotSize, fallback.params.knotSize, .08, 1.2),
      knotInset: geometryNodeNumber(params.knotInset, fallback.params.knotInset, -.2, .3),
      knotRings: Math.round(geometryNodeNumber(params.knotRings, fallback.params.knotRings, 2, 9)),
      cutRingCount: Math.round(geometryNodeNumber(params.cutRingCount, fallback.params.cutRingCount, 2, 14)),
      cutRingDepth: geometryNodeNumber(params.cutRingDepth, fallback.params.cutRingDepth, .01, .15),
      cutRingContrast: geometryNodeNumber(params.cutRingContrast, fallback.params.cutRingContrast, 0, 1),
      transformX: geometryNodeNumber(params.transformX, fallback.params.transformX, -50, 50),
      transformY: geometryNodeNumber(params.transformY, fallback.params.transformY, -50, 50),
      transformZ: geometryNodeNumber(params.transformZ, fallback.params.transformZ, -50, 50),
      transformRotX: geometryNodeNumber(params.transformRotX, fallback.params.transformRotX, -180, 180),
      transformRotY: geometryNodeNumber(params.transformRotY, fallback.params.transformRotY, -180, 180),
      transformRotZ: geometryNodeNumber(params.transformRotZ, fallback.params.transformRotZ, -180, 180),
      transformScale: geometryNodeNumber(params.transformScale, fallback.params.transformScale, .05, 10),
      outputName: String(params.outputName || source.name || fallbackName).trim().slice(0, 80) || fallbackName,
      textureName: typeof params.textureName === "string" ? params.textureName.slice(0, 160) : fallback.params.textureName,
      textureData: typeof params.textureData === "string" && params.textureData.startsWith("data:image/") ? params.textureData.slice(0, 16000000) : fallback.params.textureData,
      textureRandomize: params.textureRandomize !== false,
      textureVariation: geometryNodeNumber(params.textureVariation, fallback.params.textureVariation, 0, 1),
      primitiveShape: ["box", "sphere", "cylinder", "cone", "torus", "panel", "wedge", "hollowBox", "tube", "curvedPanel", "ring", "arch", "hemisphere", "dome", "capsule", "pyramid", "prism", "tetrahedron", "pyramidFrustum", "facetedBallLow", "facetedBallMedium", "facetedBallHigh", "heart", "stair"].includes(params.primitiveShape) ? params.primitiveShape : fallback.params.primitiveShape,
      primitiveSizeX: geometryNodeNumber(params.primitiveSizeX, fallback.params.primitiveSizeX, .05, 30),
      primitiveSizeY: geometryNodeNumber(params.primitiveSizeY, fallback.params.primitiveSizeY, .05, 30),
      primitiveSizeZ: geometryNodeNumber(params.primitiveSizeZ, fallback.params.primitiveSizeZ, .05, 30),
      primitiveColor: /^#[0-9a-f]{6}$/i.test(params.primitiveColor) ? params.primitiveColor : fallback.params.primitiveColor,
      stemHeight: geometryNodeNumber(params.stemHeight, fallback.params.stemHeight, .2, 40),
      stemBaseRadius: geometryNodeNumber(params.stemBaseRadius, fallback.params.stemBaseRadius, .03, 6),
      stemTopRadius: geometryNodeNumber(params.stemTopRadius, fallback.params.stemTopRadius, .01, 6),
      stemSegments: Math.round(geometryNodeNumber(params.stemSegments, fallback.params.stemSegments, 2, 32)),
      stemSides: Math.round(geometryNodeNumber(params.stemSides, fallback.params.stemSides, 5, 32)),
      stemLean: geometryNodeNumber(params.stemLean, fallback.params.stemLean, 0, 3),
      stemFlare: geometryNodeNumber(params.stemFlare, fallback.params.stemFlare, 0, 2),
      stemColor: /^#[0-9a-f]{6}$/i.test(params.stemColor) ? params.stemColor : fallback.params.stemColor,
      branchArrayCount: Math.round(geometryNodeNumber(params.branchArrayCount, fallback.params.branchArrayCount, 0, 40)),
      branchArrayLength: geometryNodeNumber(params.branchArrayLength, fallback.params.branchArrayLength, .1, 15),
      branchArrayRise: geometryNodeNumber(params.branchArrayRise, fallback.params.branchArrayRise, -.5, 2),
      branchArrayRadius: geometryNodeNumber(params.branchArrayRadius, fallback.params.branchArrayRadius, .02, 3),
      branchArrayTaper: geometryNodeNumber(params.branchArrayTaper, fallback.params.branchArrayTaper, .03, 1),
      branchArrayTwist: geometryNodeNumber(params.branchArrayTwist, fallback.params.branchArrayTwist, -180, 180),
      branchColor: /^#[0-9a-f]{6}$/i.test(params.branchColor) ? params.branchColor : fallback.params.branchColor,
      junctionBlendSize: geometryNodeNumber(params.junctionBlendSize, fallback.params.junctionBlendSize, .2, 4),
      junctionBlendLength: geometryNodeNumber(params.junctionBlendLength, fallback.params.junctionBlendLength, .2, 4),
      clusterScatterCount: Math.round(geometryNodeNumber(params.clusterScatterCount, fallback.params.clusterScatterCount, 0, 64)),
      clusterScatterSize: geometryNodeNumber(params.clusterScatterSize, fallback.params.clusterScatterSize, .05, 8),
      clusterScatterSpread: geometryNodeNumber(params.clusterScatterSpread, fallback.params.clusterScatterSpread, 0, 4),
      clusterScatterColor: /^#[0-9a-f]{6}$/i.test(params.clusterScatterColor) ? params.clusterScatterColor : fallback.params.clusterScatterColor,
      rockProfile: ["rounded", "jagged", "flat", "boulder"].includes(params.rockProfile) ? params.rockProfile : fallback.params.rockProfile,
      rockArrangement: ["single", "cluster", "line", "stack"].includes(params.rockArrangement) ? params.rockArrangement : fallback.params.rockArrangement,
      rockCount: Math.round(geometryNodeNumber(params.rockCount, fallback.params.rockCount, 1, 48)),
      rockSize: geometryNodeNumber(params.rockSize, fallback.params.rockSize, .1, 8),
      rockVariation: geometryNodeNumber(params.rockVariation, fallback.params.rockVariation, 0, 1),
      rockSpacing: geometryNodeNumber(params.rockSpacing, fallback.params.rockSpacing, .2, 4),
      rockColor: /^#[0-9a-f]{6}$/i.test(params.rockColor) ? params.rockColor : fallback.params.rockColor,
      rockColorSecondary: /^#[0-9a-f]{6}$/i.test(params.rockColorSecondary) ? params.rockColorSecondary : fallback.params.rockColorSecondary,
      rockColorTertiary: /^#[0-9a-f]{6}$/i.test(params.rockColorTertiary) ? params.rockColorTertiary : fallback.params.rockColorTertiary,
      rockTextureName: typeof params.rockTextureName === "string" ? params.rockTextureName.slice(0, 160) : fallback.params.rockTextureName,
      rockAddInnerPanel: params.rockAddInnerPanel !== false,
      wallLength: geometryNodeNumber(params.wallLength, fallback.params.wallLength, 1, 500),
      wallHeight: geometryNodeNumber(params.wallHeight, fallback.params.wallHeight, .5, 12),
      wallDepth: geometryNodeNumber(params.wallDepth, fallback.params.wallDepth, .15, 4),
      wallRows: Math.round(geometryNodeNumber(params.wallRows, fallback.params.wallRows, 1, 12)),
      wallColumns: Math.round(geometryNodeNumber(params.wallColumns, fallback.params.wallColumns, 2, 30)),
      wallDepthLayers: Math.round(geometryNodeNumber(params.wallDepthLayers, fallback.params.wallDepthLayers, 1, 4)),
      wallIrregularity: geometryNodeNumber(params.wallIrregularity, fallback.params.wallIrregularity, 0, 1),
      wallColorVariation: geometryNodeNumber(params.wallColorVariation, fallback.params.wallColorVariation, 0, 1),
      wallColor: /^#[0-9a-f]{6}$/i.test(params.wallColor) ? params.wallColor : fallback.params.wallColor,
      wallColorSecondary: /^#[0-9a-f]{6}$/i.test(params.wallColorSecondary) ? params.wallColorSecondary : fallback.params.wallColorSecondary,
      wallColorTertiary: /^#[0-9a-f]{6}$/i.test(params.wallColorTertiary) ? params.wallColorTertiary : fallback.params.wallColorTertiary,
      wallTextureName: typeof params.wallTextureName === "string" ? params.wallTextureName.slice(0, 160) : fallback.params.wallTextureName,
      wallOverallTextureMix: geometryNodeNumber(params.wallOverallTextureMix, fallback.params.wallOverallTextureMix, 0, 1),
      wallAddInnerPanel: params.wallAddInnerPanel !== false,
      joinAddInnerPanel: params.joinAddInnerPanel !== false,
      joinPanelInset: geometryNodeNumber(params.joinPanelInset, fallback.params.joinPanelInset, 0, 1.5),
      joinPanelAxis: ["auto", "x", "y", "z"].includes(params.joinPanelAxis) ? params.joinPanelAxis : fallback.params.joinPanelAxis,
      joinPanelColor: /^#[0-9a-f]{6}$/i.test(params.joinPanelColor) ? params.joinPanelColor : fallback.params.joinPanelColor,
      grassCount: Math.round(geometryNodeNumber(params.grassCount, fallback.params.grassCount, 1, 160)),
      grassHeight: geometryNodeNumber(params.grassHeight, fallback.params.grassHeight, .05, 3),
      grassWidth: geometryNodeNumber(params.grassWidth, fallback.params.grassWidth, .01, .8),
      grassSpread: geometryNodeNumber(params.grassSpread, fallback.params.grassSpread, 0, 3),
      grassAvoidGeometry: params.grassAvoidGeometry !== false,
      grassClearance: geometryNodeNumber(params.grassClearance, fallback.params.grassClearance, 0, 2),
      grassGrowNegativeX: params.grassGrowNegativeX !== false,
      grassGrowPositiveX: params.grassGrowPositiveX !== false,
      grassGrowNegativeZ: params.grassGrowNegativeZ !== false,
      grassGrowPositiveZ: params.grassGrowPositiveZ !== false,
      grassColor: /^#[0-9a-f]{6}$/i.test(params.grassColor) ? params.grassColor : fallback.params.grassColor,
      mossPlacement: ["bottom", "middle", "top", "all"].includes(params.mossPlacement) ? params.mossPlacement : fallback.params.mossPlacement,
      mossCoverage: geometryNodeNumber(params.mossCoverage, fallback.params.mossCoverage, 0, 1),
      mossThickness: geometryNodeNumber(params.mossThickness, fallback.params.mossThickness, .02, .6),
      mossMoisture: geometryNodeNumber(params.mossMoisture, fallback.params.mossMoisture, 0, 1),
      mossSunlight: geometryNodeNumber(params.mossSunlight, fallback.params.mossSunlight, 0, 1),
      mossCrackBias: geometryNodeNumber(params.mossCrackBias, fallback.params.mossCrackBias, 0, 1),
      mossColor: /^#[0-9a-f]{6}$/i.test(params.mossColor) ? params.mossColor : fallback.params.mossColor,
      paletteCount:Math.round(geometryNodeNumber(params.paletteCount,4,1,4)),
      paletteColor1:geometryNodePaletteColor(params,1),paletteColor2:geometryNodePaletteColor(params,2),paletteColor3:geometryNodePaletteColor(params,3),paletteColor4:geometryNodePaletteColor(params,4),
      natureOutputMode: ["both", "stone", "grass"].includes(params.natureOutputMode) ? params.natureOutputMode : fallback.params.natureOutputMode
    },
    nodeParams: source.nodeParams && typeof source.nodeParams === "object"
      ? Object.fromEntries(Object.entries(source.nodeParams).filter(([id, value]) => typeof id === "string" && value && typeof value === "object").slice(0, 80).map(([id, value]) => [id, { ...fallback.params, ...value }]))
      : {},
    nodeOrder: [],
    nodePositions: {},
    smoothNodes: [],
    connections: [],
    view: {
      x: geometryNodeNumber(source.view?.x, 0, -5000, 5000),
      y: geometryNodeNumber(source.view?.y, 0, -5000, 5000),
      scale: geometryNodeNumber(source.view?.scale, 1, .25, 2.5)
    },
    generatedIds: Array.isArray(source.generatedIds) ? source.generatedIds.filter(id => typeof id === "string") : [],
    centerOutput: source.centerOutput === true,
    buildVersion: Math.max(0, Math.round(Number(source.buildVersion) || 0))
  };
  const savedOrder = Array.isArray(source.nodeOrder) ? source.nodeOrder : GEOMETRY_NODE_DEFAULT_ORDER;
  graph.nodeOrder = savedOrder.filter((type, index) => typeof type === "string" && type !== "smoothGeometry" && savedOrder.indexOf(type) === index).slice(0, 80);
  if (!graph.nodeOrder.length && !Array.isArray(source.nodeOrder)) graph.nodeOrder = [...GEOMETRY_NODE_DEFAULT_ORDER];
  for (const type of GEOMETRY_NODE_TYPES) {
    const point = positions[type];
    graph.nodePositions[type] = Array.isArray(point) && point.length >= 2
      ? [geometryNodeNumber(point[0], fallback.nodePositions[type][0], 0, Number.MAX_SAFE_INTEGER), geometryNodeNumber(point[1], fallback.nodePositions[type][1], 0, Number.MAX_SAFE_INTEGER)]
      : [...fallback.nodePositions[type]];
  }
  for (const type of graph.nodeOrder.filter(type => !GEOMETRY_NODE_TYPES.includes(type))) {
    const point = positions[type];
    graph.nodePositions[type] = Array.isArray(point) && point.length >= 2
      ? [geometryNodeNumber(point[0], 40, 0, Number.MAX_SAFE_INTEGER), geometryNodeNumber(point[1], 80, 0, Number.MAX_SAFE_INTEGER)]
      : [40, 80];
  }
  if (Array.isArray(source.smoothNodes)) graph.smoothNodes = source.smoothNodes.slice(0, 48).map((node, index) => ({
    id: String(node?.id || geometryNodeId("smooth")),
    targetId: node?.targetId && graph.nodeOrder.includes(String(node.targetId)) ? String(node.targetId) : null,
    position: Array.isArray(node?.position) ? [geometryNodeNumber(node.position[0], 220 + index * 24, 0, 2200), geometryNodeNumber(node.position[1], 270 + index * 18, 0, 800)] : [220 + index * 24, 270 + index * 18],
    params: {
      axis: ["xyz", "xy", "xz", "yz", "x", "y", "z"].includes(node?.params?.axis) ? node.params.axis : graph.params.smoothAxis,
      iterations: Math.round(geometryNodeNumber(node?.params?.iterations, graph.params.smoothIterations, 1, 2)),
      strength: Math.max(.05, Number.isFinite(Number(node?.params?.strength)) ? Number(node.params.strength) : graph.params.smoothStrength),
      preserveSize: node?.params?.preserveSize !== false
    }
  }));
  if (graph.nodeOrder.includes("smoothGeometry")) {
    graph.nodeOrder = graph.nodeOrder.filter(type => type !== "smoothGeometry");
    const legacyTargets = [["roots", graph.params.smoothRoots], ["trunk", graph.params.smoothTrunk], ["branches", graph.params.smoothBranches], ["twigs", graph.params.smoothTwigs], ["canopy", graph.params.smoothCanopy], ["smoothJoints", graph.params.smoothJoints], ["cutSurface", graph.params.smoothCutRings]];
    legacyTargets.filter(([targetId, enabled]) => enabled && graph.nodeOrder.includes(targetId)).forEach(([targetId], index) => graph.smoothNodes.push({
      id: geometryNodeId("smooth"), targetId,
      position: [graph.nodePositions[targetId][0] + 28 + index * 10, Math.min(800, graph.nodePositions[targetId][1] + 245 + index * 12)],
      params: { axis: graph.params.smoothAxis, iterations: graph.params.smoothIterations, strength: graph.params.smoothStrength, preserveSize: graph.params.smoothPreserveSize }
    }));
  }
  const nodeIds = new Set([...graph.nodeOrder, ...graph.smoothNodes.map(node => node.id)]);
  if (Array.isArray(source.connections)) {
    const rawConnections = [...source.connections];
    if (Array.isArray(source.nodeOrder) && source.nodeOrder.includes("bark")) {
      const incoming = rawConnections.filter(connection => connection?.toNodeId === "bark");
      const outgoing = rawConnections.filter(connection => connection?.fromNodeId === "bark");
      for (const before of incoming) for (const after of outgoing) rawConnections.push({ id: geometryNodeId("link"), fromNodeId: before.fromNodeId, toNodeId: after.toNodeId });
    }
    const legacyInputCounts = new Map();
    const seenInputs = new Set();
    graph.connections = rawConnections.slice(0, 160).map(connection => {
      const fromNodeId = String(connection?.fromNodeId || "");
      const toNodeId = String(connection?.toNodeId || "");
      let toInputIndex = Number(connection?.toInputIndex);
      if (!Number.isInteger(toInputIndex)) {
        const legacyIndex = legacyInputCounts.get(toNodeId) || 0;
        toInputIndex = geometryNodeTypeForId(graph, fromNodeId) === "textureInput" && geometryNodeTypeForId(graph, toNodeId) === "stoneWall" ? 4 : legacyIndex;
        legacyInputCounts.set(toNodeId, legacyIndex + 1);
      }
      return { id: String(connection?.id || geometryNodeId("link")), fromNodeId, toNodeId, toInputIndex };
    }).filter(connection => {
      if (!nodeIds.has(connection.fromNodeId) || !nodeIds.has(connection.toNodeId) || connection.fromNodeId === connection.toNodeId) return false;
      const destinationType = geometryNodeTypeForId(graph, connection.toNodeId) || "smoothGeometry";
      const destinationDefinition = GEOMETRY_NODE_DEFINITIONS[destinationType] || { input: "Geometry" };
      const inputCount = Math.max(1, destinationDefinition.inputSockets?.length || 1);
      connection.toInputIndex = Math.max(0, Math.min(inputCount - 1, Number(connection.toInputIndex) || 0));
      const inputKey = `${connection.toNodeId}:${connection.toInputIndex}`;
      if (seenInputs.has(inputKey)) return false;
      seenInputs.add(inputKey);
      return true;
    });
  } else {
    const orderedIds = graph.nodeOrder.flatMap(type => [type, ...graph.smoothNodes.filter(node => node.targetId === type).map(node => node.id)]);
    graph.connections = orderedIds.slice(0, -1).map((fromNodeId, index) => ({ id: geometryNodeId("link"), fromNodeId, toNodeId: orderedIds[index + 1] }));
  }
  return graph;
}

function sanitizeGeometryNodeProjectState(value, { allowEmpty = false } = {}) {
  const source = value && typeof value === "object" ? value : {};
  const graphs = Array.isArray(source.graphs)
    ? source.graphs.slice(0, 24).map((graph, index) => sanitizeGeometryNodeGraph(graph, `Procedural Geometry ${index + 1}`))
    : [];
  if (!graphs.length && !allowEmpty && !Array.isArray(source.graphs)) graphs.push(defaultEmptyGeometryNodeProjectState().graphs[0]);
  const activeGraphId = graphs.some(graph => graph.id === source.activeGraphId) ? source.activeGraphId : (graphs[0]?.id || null);
  return { version: 1, activeGraphId, graphs };
}

function loadGeometryNodeDraft() {
  try {
    return sanitizeGeometryNodeProjectState(JSON.parse(localStorage.getItem(GEOMETRY_NODES_STORAGE_KEY) || "null"));
  } catch {
    return defaultGeometryNodeProjectState();
  }
}

let geometryNodeProjectState = loadGeometryNodeDraft();

function geometryNodeDraftState() {
  const draft = JSON.parse(JSON.stringify(geometryNodeProjectState));
  for (const graph of draft.graphs || []) {
    if (graph.params) graph.params.textureData = "";
    for (const params of Object.values(graph.nodeParams || {})) {
      if (params) params.textureData = "";
    }
  }
  return draft;
}

function saveGeometryNodeDraft() {
  try {
    localStorage.setItem(GEOMETRY_NODES_STORAGE_KEY, JSON.stringify(geometryNodeDraftState()));
    return true;
  } catch (error) {
    console.warn("Geometry Nodes draft could not be saved.", error);
    return false;
  }
}

function activeGeometryNodeGraph() {
  return geometryNodeProjectState.graphs.find(graph => graph.id === geometryNodeProjectState.activeGraphId) || null;
}

function serializeOptionalPluginProjectData() {
  return { "geometry-nodes": JSON.parse(JSON.stringify(geometryNodeProjectState)) };
}

function geometryNodeClusterPayload(graph) {
  const cleanGraph = JSON.parse(JSON.stringify(graph));
  cleanGraph.generatedIds = [];
  cleanGraph.buildVersion = 0;
  return {
    kind: "boltworks-node-cluster",
    version: 1,
    name: graph.name,
    savedAt: new Date().toISOString(),
    graph: cleanGraph
  };
}

function geometryNodeClusterString(graph, pretty = false) {
  return JSON.stringify(geometryNodeClusterPayload(graph), null, pretty ? 2 : 0);
}

function geometryNodeClusterFileName(graph) {
  const base = String(graph?.name || "node-cluster").trim().replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "node-cluster";
  return `${base}.bwnc`;
}

function setGeometryNodeStatus(message) {
  const mainStatus = document.getElementById("geometryNodeStatus");
  if (mainStatus) mainStatus.textContent = message;
  const detachedStatus = liveGeometryNodesDetachedWindow()?.document.getElementById("geometryNodeDetachedStatus");
  if (detachedStatus) detachedStatus.textContent = message;
}

function importGeometryNodeClusterText(text, sourceLabel = "node string") {
  let payload;
  try {
    payload = JSON.parse(String(text || "").trim());
  } catch {
    setGeometryNodeStatus(`Could not load ${sourceLabel}: it is not valid JSON.`);
    return false;
  }
  if (!payload || payload.kind !== "boltworks-node-cluster" || payload.version !== 1 || !payload.graph) {
    setGeometryNodeStatus(`Could not load ${sourceLabel}: expected a BoltWorks node cluster version 1.`);
    return false;
  }
  const imported = sanitizeGeometryNodeGraph(payload.graph, String(payload.name || "Imported Node Cluster"));
  imported.id = geometryNodeId("cluster");
  imported.generatedIds = [];
  imported.buildVersion = 0;
  const baseName = String(payload.name || imported.name || "Imported Node Cluster").trim().slice(0, 70) || "Imported Node Cluster";
  let name = baseName;
  let suffix = 2;
  const names = new Set(geometryNodeProjectState.graphs.map(graph => graph.name.toLowerCase()));
  while (names.has(name.toLowerCase())) name = `${baseName} ${suffix++}`.slice(0, 80);
  imported.name = name;
  imported.params.outputName = name;
  geometryNodeProjectState.graphs.push(imported);
  geometryNodeProjectState.activeGraphId = imported.id;
  saveGeometryNodeDraft();
  renderGeometryNodeEditor();
  setGeometryNodeStatus(`Loaded node cluster “${name}” as a new editable graph.`);
  log(`Loaded Geometry Nodes cluster ${name}.`, { source: sourceLabel, nodes: imported.nodeOrder.length + imported.smoothNodes.length, connections: imported.connections.length });
  return true;
}

async function copyGeometryNodeClusterString(doc = document) {
  const graph = activeGeometryNodeGraph();
  if (!graph) return false;
  const value = geometryNodeClusterString(graph);
  let copied = false;
  try {
    await doc.defaultView.navigator.clipboard.writeText(value);
    copied = true;
  } catch {
    const area = doc.createElement("textarea");
    area.value = value;
    area.style.position = "fixed";
    area.style.opacity = "0";
    doc.body.append(area);
    area.select();
    try { copied = !!doc.execCommand?.("copy"); } catch {}
    area.remove();
  }
  setGeometryNodeStatus(copied ? `Copied “${graph.name}” as a portable node string.` : "Clipboard access was blocked. Use Save .bwnc instead.");
  return copied;
}

function pasteGeometryNodeClusterString(doc = document) {
  const value = doc.defaultView.prompt("Paste a BoltWorks node-cluster string. It will be added as a new graph:", "");
  if (value == null) return false;
  return importGeometryNodeClusterText(value, "pasted node string");
}

function saveGeometryNodeClusterFile(doc = document) {
  const graph = activeGeometryNodeGraph();
  if (!graph) return;
  const blob = new Blob([geometryNodeClusterString(graph, true)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = doc.createElement("a");
  anchor.href = url;
  anchor.download = geometryNodeClusterFileName(graph);
  doc.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  setGeometryNodeStatus(`Saved “${graph.name}” as ${anchor.download}.`);
}

async function loadGeometryNodeClusterFile(file) {
  if (!file) return false;
  if (!String(file.name || "").toLowerCase().endsWith(".bwnc")) {
    setGeometryNodeStatus("Choose a .bwnc BoltWorks node-cluster file.");
    return false;
  }
  try {
    return importGeometryNodeClusterText(await file.text(), file.name);
  } catch (error) {
    setGeometryNodeStatus(`Could not read ${file.name}: ${error?.message || error}`);
    return false;
  }
}

function restoreOptionalPluginProjectData(pluginData = {}) {
  geometryNodeProjectState = sanitizeGeometryNodeProjectState(pluginData["geometry-nodes"], { allowEmpty: true });
  saveGeometryNodeDraft();
  if (geometryNodesRuntimeEnabled) renderGeometryNodeEditor();
}

function resetGeometryNodeProjectState() {
  geometryNodeProjectState = defaultEmptyGeometryNodeProjectState();
  saveGeometryNodeDraft();
  if (geometryNodesRuntimeEnabled) renderGeometryNodeEditor();
}

function geometryNodeEscape(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function geometryNodeField(label, key, value, { min = 0, max = 100, step = 1, type = "number", instanceId = "" } = {}) {
  const instance = instanceId ? ` data-geometry-instance-param="${geometryNodeEscape(instanceId)}"` : "";
  if (type === "checkbox") return `<label><span>${geometryNodeEscape(label)}</span><input data-geometry-param="${key}"${instance} type="checkbox" ${value ? "checked" : ""}></label>`;
  const limits = type === "number" ? `${min == null ? "" : ` min="${min}"`}${max == null ? "" : ` max="${max}"`} step="${step}"` : "";
  return `<label><span>${geometryNodeEscape(label)}</span><input data-geometry-param="${key}"${instance} type="${type}"${limits} value="${geometryNodeEscape(value)}"></label>`;
}

function geometryNodeSelectField(label, key, value, options, instanceId = "") {
  const instance = instanceId ? ` data-geometry-instance-param="${geometryNodeEscape(instanceId)}"` : "";
  return `<label><span>${geometryNodeEscape(label)}</span><select data-geometry-param="${key}"${instance}>${options.map(([optionValue, optionLabel]) => `<option value="${optionValue}" ${value === optionValue ? "selected" : ""}>${geometryNodeEscape(optionLabel)}</option>`).join("")}</select></label>`;
}

function geometryNodeTextureOptions(selected) {
  const options = [["", "None"]];
  if (typeof textureLibrary !== "undefined") {
    for (const entry of textureLibrary.values()) options.push([entry.name, entry.name]);
  }
  if (selected && !options.some(([value]) => value === selected)) options.push([selected, selected]);
  return options;
}

function geometryNodeTextureConnectionNote(graph, instanceId) {
  const connected = graph?.connections?.some(connection => (
    connection.toNodeId === instanceId && geometryNodeTypeForId(graph, connection.fromNodeId) === "textureInput"
  ));
  return `<p class="geometry-node-card-note">Texture: ${connected ? "connected input" : "connect a Texture Input node"}</p>`;
}

function geometryNodeShortTextureName(name) {
  const value = String(name || "");
  return value.length > 10 ? `${value.slice(0, 10)}...` : value;
}

function geometryNodeFields(graph, type, instanceId = type) {
  const p = graph.nodeParams?.[instanceId] || graph.params;
  if (BWS_ASSET_NODES[type]) return assetNodeFields(type, p, instanceId);
  if (!GEOMETRY_NODE_DEFINITIONS[type]) return '<p class="geometry-node-card-note">This node comes from a newer BWS build. Its saved data and connections are being preserved. Refresh or update BWS to edit and build it.</p>';
  if (type === "smoothGeometry") {
    const node = graph.smoothNodes.find(item => item.id === instanceId);
    const settings = node?.params || { axis: "xyz", iterations: 2, strength: .72, preserveSize: true };
    return geometryNodeSelectField("Axes", "axis", settings.axis, [["xyz", "XYZ"], ["xy", "XY"], ["xz", "XZ"], ["yz", "YZ"], ["x", "X only"], ["y", "Y only"], ["z", "Z only"]], instanceId)
      + geometryNodeField("Passes", "iterations", settings.iterations, { min: 1, max: 2, instanceId })
      + geometryNodeField("Strength", "strength", settings.strength, { min: .05, max: null, step: .05, instanceId })
      + geometryNodeField("Keep size", "preserveSize", settings.preserveSize, { type: "checkbox", instanceId });
  }
  if (type === "seed") return geometryNodeField("Value", "seed", graph.seed, { min: 0, max: 999999 });
  if(type==="colorPalette")return geometryNodeField("Active colors","paletteCount",geometryNodeNumber(p.paletteCount,4,1,4),{min:1,max:4,instanceId})+[1,2,3,4].map((n)=>geometryNodeField("Color "+n,"paletteColor"+n,geometryNodePaletteColor(p,n),{type:"color",instanceId})).join("")+'<p class="geometry-node-card-note">Connect an optional texture to tint it, or use colors alone. Connect to a generator Texture socket or a Texture / Color Randomizer. Active colors are selected per part using the graph seed.</p>';
  if (type === "textureRandomizer") return geometryNodeField("Seed offset", "texturePoolSeed", geometryNodeNumber(p.texturePoolSeed, 0, 0, 999999), { min:0, max:999999, instanceId })
    + geometryNodeField("Vary UVs", "texturePoolUvs", p.texturePoolUvs !== false, {type:"checkbox", instanceId})
    + geometryNodeField("UV variation", "texturePoolVariation", geometryNodeNumber(p.texturePoolVariation, .75, 0, 1), {min:0,max:1,step:.05,instanceId})
    + '<p class="geometry-node-card-note">Connect up to four Texture Inputs or Color Palettes here, then connect this output to a generator texture socket. One color/texture choice is selected per part, not blended. Graph seed + offset repeat the result.</p>';
  if (type === "textureInput") {
    const textureName = p.textureName || "No texture imported";
    return `<label class="geometry-node-texture-picker"><span>Image file</span><span class="geometry-node-file-button">Choose image</span><input class="geometry-node-file-input" type="file" accept="image/*" data-geometry-texture-input data-geometry-texture-instance="${geometryNodeEscape(instanceId)}"></label><p class="geometry-node-card-note geometry-node-texture-name" data-geometry-texture-name title="${geometryNodeEscape(textureName)}">${geometryNodeEscape(geometryNodeShortTextureName(textureName))}</p>`
      + geometryNodeField("Randomize", "textureRandomize", p.textureRandomize, { type: "checkbox", instanceId })
      + geometryNodeField("Variation", "textureVariation", p.textureVariation, { min: 0, max: 1, step: .05, instanceId });
  }
  if (type === "variant") return geometryNodeSelectField("Shape", "variantStyle", p.variantStyle, [["classic", "Classic"], ["broad", "Broad oak"], ["round", "Round crown"], ["tall", "Tall pine"], ["sparse", "Sparse"], ["bare", "Bare / dead"]]) + geometryNodeSelectField("Season", "variantSeason", p.variantSeason, [["spring", "Spring"], ["summer", "Summer"], ["autumn", "Autumn"], ["winter", "Winter"], ["snowy", "Snowy"]]) + geometryNodeSelectField("Age", "variantMaturity", p.variantMaturity, [["sapling", "Sapling"], ["young", "Young"], ["mature", "Mature"], ["ancient", "Ancient"]]) + geometryNodeField("Variation", "variantAmount", p.variantAmount, { min: 0, max: 1, step: .05 });
  if (type === "primitive") return geometryNodeSelectField("Shape", "primitiveShape", p.primitiveShape, [["box", "Cube"], ["sphere", "Sphere"], ["cylinder", "Cylinder"], ["cone", "Cone"], ["torus", "Torus"], ["panel", "Panel"], ["wedge", "Wedge"], ["hollowBox", "Hollow box"], ["tube", "Tube"], ["curvedPanel", "Curved panel"], ["ring", "Ring"], ["arch", "Arch"], ["hemisphere", "Hemisphere"], ["dome", "Dome"], ["capsule", "Capsule"], ["pyramid", "Pyramid"], ["prism", "Prism"], ["tetrahedron", "Tetrahedron"], ["pyramidFrustum", "Pyramid frustum"], ["facetedBallLow", "Low-poly cluster"], ["facetedBallMedium", "Detailed cluster"], ["facetedBallHigh", "High-detail cluster"], ["heart", "Heart"], ["stair", "Stair"]]) + geometryNodeField("Size X", "primitiveSizeX", p.primitiveSizeX, { min: .05, max: 30, step: .05 }) + geometryNodeField("Size Y", "primitiveSizeY", p.primitiveSizeY, { min: .05, max: 30, step: .05 }) + geometryNodeField("Size Z", "primitiveSizeZ", p.primitiveSizeZ, { min: .05, max: 30, step: .05 }) + geometryNodeField("Color", "primitiveColor", p.primitiveColor, { type: "color" });
  if (type === "stem") return geometryNodeField("Height", "stemHeight", p.stemHeight, { min: .2, max: 40, step: .1 }) + geometryNodeField("Base radius", "stemBaseRadius", p.stemBaseRadius, { min: .03, max: 6, step: .02 }) + geometryNodeField("Top radius", "stemTopRadius", p.stemTopRadius, { min: .01, max: 6, step: .02 }) + geometryNodeField("Segments", "stemSegments", p.stemSegments, { min: 2, max: 32 }) + geometryNodeField("Sides", "stemSides", p.stemSides, { min: 5, max: 32 }) + geometryNodeField("Lean", "stemLean", p.stemLean, { min: 0, max: 3, step: .02 }) + geometryNodeField("Root flare", "stemFlare", p.stemFlare, { min: 0, max: 2, step: .02 }) + geometryNodeField("Color", "stemColor", p.stemColor, { type: "color" });
  if (type === "branchArray") return geometryNodeField("Count", "branchArrayCount", p.branchArrayCount, { min: 0, max: 40 }) + geometryNodeField("Length", "branchArrayLength", p.branchArrayLength, { min: .1, max: 15, step: .05 }) + geometryNodeField("Rise", "branchArrayRise", p.branchArrayRise, { min: -.5, max: 2, step: .02 }) + geometryNodeField("Base radius", "branchArrayRadius", p.branchArrayRadius, { min: .02, max: 3, step: .02 }) + geometryNodeField("Tip ratio", "branchArrayTaper", p.branchArrayTaper, { min: .03, max: 1, step: .02 }) + geometryNodeField("Twist", "branchArrayTwist", p.branchArrayTwist, { min: -180, max: 180, step: 1 }) + geometryNodeField("Color", "branchColor", p.branchColor, { type: "color" });
  if (type === "clusterScatter") return geometryNodeField("Count", "clusterScatterCount", p.clusterScatterCount, { min: 0, max: 64 }) + geometryNodeField("Size", "clusterScatterSize", p.clusterScatterSize, { min: .05, max: 8, step: .05 }) + geometryNodeField("Spread", "clusterScatterSpread", p.clusterScatterSpread, { min: 0, max: 4, step: .05 }) + geometryNodeField("Color", "clusterScatterColor", p.clusterScatterColor, { type: "color" });
  if (type === "rocks") return geometryNodeSelectField("Profile", "rockProfile", p.rockProfile, [["rounded", "Rounded"], ["jagged", "Jagged"], ["flat", "Flat fieldstone"], ["boulder", "Boulder"]]) + geometryNodeSelectField("Arrangement", "rockArrangement", p.rockArrangement, [["single", "Single"], ["cluster", "Cluster"], ["line", "Line"], ["stack", "Stacked"]]) + geometryNodeField("Count", "rockCount", p.rockCount, { min: 1, max: 48 }) + geometryNodeField("Size", "rockSize", p.rockSize, { min: .1, max: 8, step: .05 }) + geometryNodeField("Variation", "rockVariation", p.rockVariation, { min: 0, max: 1, step: .05 }) + geometryNodeField("Spacing", "rockSpacing", p.rockSpacing, { min: .2, max: 4, step: .05 }) + geometryNodeField("Color", "rockColor", p.rockColor, { type: "color" }) + geometryNodeField("Color 2", "rockColorSecondary", p.rockColorSecondary, { type: "color" }) + geometryNodeField("Color 3", "rockColorTertiary", p.rockColorTertiary, { type: "color" }) + geometryNodeTextureConnectionNote(graph, instanceId) + geometryNodeSelectField("Nature output", "natureOutputMode", p.natureOutputMode, [["both", "Stone + grass surface"], ["stone", "Stone only"], ["grass", "Grass surface only"]]);
  if (type === "stoneWall") return geometryNodeField("Length", "wallLength", p.wallLength, { min: 1, max: 500, step: .5 }) + geometryNodeField("Height", "wallHeight", p.wallHeight, { min: .5, max: 12, step: .1 }) + geometryNodeField("Depth", "wallDepth", p.wallDepth, { min: .3, max: 6, step: .05 }) + geometryNodeField("Rows", "wallRows", p.wallRows, { min: 1, max: 12 }) + geometryNodeField("Stones / 7 units", "wallColumns", p.wallColumns, { min: 2, max: 30 }) + geometryNodeField("Depth layers", "wallDepthLayers", p.wallDepthLayers, { min: 1, max: 4 }) + geometryNodeField("Shape variation", "wallIrregularity", p.wallIrregularity, { min: 0, max: 1, step: .05 }) + geometryNodeField("Color variation", "wallColorVariation", p.wallColorVariation, { min: 0, max: 1, step: .05 }) + geometryNodeField("Base color", "wallColor", p.wallColor, { type: "color" }) + geometryNodeField("Color 2", "wallColorSecondary", p.wallColorSecondary, { type: "color" }) + geometryNodeField("Color 3", "wallColorTertiary", p.wallColorTertiary, { type: "color" }) + geometryNodeField("Overall mix", "wallOverallTextureMix", p.wallOverallTextureMix, { min: 0, max: 1, step: .05 }) + '<p class="geometry-node-card-note">Upper, Middle, and Bottom texture their wall zones. Overall randomly replaces them using Overall mix.</p>' + geometryNodeSelectField("Nature output", "natureOutputMode", p.natureOutputMode, [["both", "Stone + grass surface"], ["stone", "Stone only"], ["grass", "Grass surface only"]]);
  if (type === "grass") return geometryNodeField("Clump count", "grassCount", p.grassCount, { min: 1, max: 160 }) + geometryNodeField("Height", "grassHeight", p.grassHeight, { min: .05, max: 3, step: .02 }) + geometryNodeField("Width", "grassWidth", p.grassWidth, { min: .01, max: .8, step: .01 }) + geometryNodeField("Edge spread", "grassSpread", p.grassSpread, { min: 0, max: 3, step: .05 }) + geometryNodeField("Avoid source geometry", "grassAvoidGeometry", p.grassAvoidGeometry, { type: "checkbox" }) + geometryNodeField("Mask clearance", "grassClearance", p.grassClearance, { min: 0, max: 2, step: .02 }) + geometryNodeField("Grow on −X side", "grassGrowNegativeX", p.grassGrowNegativeX, { type: "checkbox" }) + geometryNodeField("Grow on +X side", "grassGrowPositiveX", p.grassGrowPositiveX, { type: "checkbox" }) + geometryNodeField("Grow on −Z side", "grassGrowNegativeZ", p.grassGrowNegativeZ, { type: "checkbox" }) + geometryNodeField("Grow on +Z side", "grassGrowPositiveZ", p.grassGrowPositiveZ, { type: "checkbox" }) + geometryNodeField("Color", "grassColor", p.grassColor, { type: "color" });
  if (type === "moss") return geometryNodeSelectField("Height zone", "mossPlacement", p.mossPlacement, [["bottom", "Bottom"], ["middle", "Middle"], ["top", "Top"], ["all", "All heights"]]) + geometryNodeField("Coverage", "mossCoverage", p.mossCoverage, { min: 0, max: 1, step: .05 }) + geometryNodeField("Cushion height", "mossThickness", p.mossThickness, { min: .02, max: .6, step: .01 }) + geometryNodeField("Moisture", "mossMoisture", p.mossMoisture, { min: 0, max: 1, step: .05 }) + geometryNodeField("Sun exposure", "mossSunlight", p.mossSunlight, { min: 0, max: 1, step: .05 }) + geometryNodeField("Crack preference", "mossCrackBias", p.mossCrackBias, { min: 0, max: 1, step: .05 }) + geometryNodeField("Color", "mossColor", p.mossColor, { type: "color" });
  if (type === "join") return geometryNodeField("Add inner panel", "joinAddInnerPanel", p.joinAddInnerPanel, { type: "checkbox" }) + geometryNodeSelectField("Panel direction", "joinPanelAxis", p.joinPanelAxis, [["auto", "Auto / thinnest side"], ["x", "X direction"], ["y", "Y direction"], ["z", "Z direction"]]) + geometryNodeField("Panel inset", "joinPanelInset", p.joinPanelInset, { min: 0, max: 1.5, step: .02 }) + geometryNodeField("Panel color", "joinPanelColor", p.joinPanelColor, { type: "color" }) + '<p class="geometry-node-card-note">Combines all connected geometry streams before CiS.</p>';
  if (type === "primitiveTest") return '<p class="geometry-node-card-note">Builds cube, pentagon, and low-cone before/after pairs.</p>';
  if (type === "roots") return geometryNodeField("Count", "rootCount", p.rootCount, { min: 1, max: 16 }) + geometryNodeField("Length", "rootLength", p.rootLength, { min: .2, max: 6, step: .05 }) + geometryNodeField("Thickness", "rootThickness", p.rootThickness, { min: .05, max: 2, step: .05 });
  if (type === "trunk") return geometryNodeField("Height", "height", p.height, { min: 1, max: 30, step: .25 }) + geometryNodeField("Width", "trunkWidth", p.trunkWidth, { min: .1, max: 5, step: .05 }) + geometryNodeField("Segments", "trunkSegments", p.trunkSegments, { min: 2, max: 16 });
  if (type === "bend") return geometryNodeField("Strength", "trunkBend", p.trunkBend, { min: 0, max: 1.5, step: .02 });
  if (type === "branches") return geometryNodeField("Count", "branchCount", p.branchCount, { min: 0, max: 32 }) + geometryNodeField("Spread", "branchSpread", p.branchSpread, { min: 10, max: 88 }) + geometryNodeField("Length", "branchLength", p.branchLength, { min: .3, max: 10, step: .1 });
  if (type === "smoothJoints") return geometryNodeField("Blend size", "jointSize", p.jointSize, { min: .45, max: 1.4, step: .02 }) + geometryNodeField("Seam bulbs", "jointTrunkSeams", p.jointTrunkSeams, { type: "checkbox" });
  if (type === "junctionBlend") return geometryNodeField("Collar size", "junctionBlendSize", p.junctionBlendSize, { min: .2, max: 4, step: .02 }) + geometryNodeField("Collar length", "junctionBlendLength", p.junctionBlendLength, { min: .2, max: 4, step: .02 });
  if (type === "twigs") return geometryNodeField("Length", "twigLength", p.twigLength, { min: .1, max: 1.5, step: .05 }) + geometryNodeField("Rise", "twigRise", p.twigRise, { min: .1, max: 1.5, step: .05 });
  if (type === "canopy") return geometryNodeField("Enabled", "canopyEnabled", p.canopyEnabled, { type: "checkbox" }) + geometryNodeField("Cluster size", "canopySize", p.canopySize, { min: .2, max: 5, step: .05 }) + geometryNodeField("Density", "canopyDensity", p.canopyDensity, { min: 1, max: 4 });
  if (type === "knot") return geometryNodeField("Count", "knotCount", p.knotCount, { min: 1, max: 12 }) + geometryNodeField("Size", "knotSize", p.knotSize, { min: .08, max: 1.2, step: .02 }) + geometryNodeField("Inset", "knotInset", p.knotInset, { min: -.2, max: .3, step: .01 }) + geometryNodeField("Rings", "knotRings", p.knotRings, { min: 2, max: 9 });
  if (type === "cutSurface") return geometryNodeField("Rings", "cutRingCount", p.cutRingCount, { min: 2, max: 14 }) + geometryNodeField("Depth", "cutRingDepth", p.cutRingDepth, { min: .01, max: .15, step: .005 }) + geometryNodeField("Contrast", "cutRingContrast", p.cutRingContrast, { min: 0, max: 1, step: .05 });
  if (type === "transform") return geometryNodeField("X", "transformX", p.transformX, { min: -50, max: 50, step: .1 }) + geometryNodeField("Y", "transformY", p.transformY, { min: -50, max: 50, step: .1 }) + geometryNodeField("Z", "transformZ", p.transformZ, { min: -50, max: 50, step: .1 }) + geometryNodeField("Rotate X", "transformRotX", p.transformRotX, { min: -180, max: 180, step: 1 }) + geometryNodeField("Rotate Y", "transformRotY", p.transformRotY, { min: -180, max: 180, step: 1 }) + geometryNodeField("Rotate Z", "transformRotZ", p.transformRotZ, { min: -180, max: 180, step: 1 }) + geometryNodeField("Scale", "transformScale", p.transformScale, { min: .05, max: 10, step: .05 });
  if (type === "output") return geometryNodeField("Name", "outputName", p.outputName, { type: "text" });
  return "";
}

function geometryNodeTypeForId(graph, nodeId) {
  if (graph.nodeOrder.includes(nodeId)) {
    if (GEOMETRY_NODE_DEFINITIONS[nodeId]) return nodeId;
    const baseType = String(nodeId).split("::")[0];
    return GEOMETRY_NODE_DEFINITIONS[baseType] ? baseType : null;
  }
  return graph.smoothNodes.some(node => node.id === nodeId) ? "smoothGeometry" : null;
}

function geometryNodeResolvedSourceId(graph, nodeId, visited = new Set()) {
  if (!nodeId || visited.has(nodeId)) return null;
  visited.add(nodeId);
  const type = geometryNodeTypeForId(graph, nodeId);
  if (type !== "smoothGeometry") return nodeId;
  const incoming = graph.connections.find(connection => connection.toNodeId === nodeId);
  return geometryNodeResolvedSourceId(graph, incoming?.fromNodeId, visited);
}

function geometryNodeCard(graph, type, instanceId = type) {
  const definition = GEOMETRY_NODE_DEFINITIONS[type] || { title: `Unsupported: ${type}`, category: "Compatibility", input: "Geometry", output: "Geometry" };
  const smoothNode = type === "smoothGeometry" ? graph.smoothNodes.find(node => node.id === instanceId) : null;
  const position = smoothNode?.position || graph.nodePositions[instanceId] || graph.nodePositions[type] || [18, 42];
  const sourceId = smoothNode ? geometryNodeResolvedSourceId(graph, instanceId) : null;
  const targetTitle = sourceId ? GEOMETRY_NODE_DEFINITIONS[geometryNodeTypeForId(graph, sourceId)]?.title : "";
  const instanceLabel = !smoothNode && instanceId !== type ? ` ${instanceId.split("::").pop()}` : "";
  const title = smoothNode && targetTitle ? `${definition.title}: ${targetTitle}` : `${definition.title}${instanceLabel}`;
  const outputConnected = graph.connections.some(connection => connection.fromNodeId === instanceId);
  const active = geometryNodeActiveNodeIds(graph).has(instanceId);
  const inputLabels = definition.inputSockets || (definition.input ? [definition.input] : []);
  const inputSocket = inputLabels.map((label, index) => {
    const connected = graph.connections.some(connection => connection.toNodeId === instanceId && (Number(connection.toInputIndex) || 0) === index);
    return `<div class="geometry-node-socket input-socket"><button type="button" class="geometry-node-port input ${connected ? "connected" : ""}" data-geometry-input-index="${index}" data-geometry-connect-to="${geometryNodeEscape(instanceId)}" title="Connect ${geometryNodeEscape(label)} into ${geometryNodeEscape(title)}" aria-label="Connect ${geometryNodeEscape(label)} into ${geometryNodeEscape(title)}"></button><span>${geometryNodeEscape(label)}</span></div>`;
  }).join("");
  const outputSocket = definition.output ? `<div class="geometry-node-socket output-socket"><span>${geometryNodeEscape(definition.output)}</span><button type="button" class="geometry-node-port output ${outputConnected ? "connected" : ""}" data-geometry-connect-from="${geometryNodeEscape(instanceId)}" title="Start connection from ${geometryNodeEscape(title)}" aria-label="Start connection from ${geometryNodeEscape(title)}">+</button></div>` : "";
  const rawFields = geometryNodeFields(graph, type, instanceId);
  const fields = instanceId !== type ? rawFields.replaceAll('data-geometry-param="', `data-geometry-instance-param="${geometryNodeEscape(instanceId)}" data-geometry-param="`) : rawFields;
  return `<article class="geometry-node-card ${type === "output" ? "output" : ""} ${active ? "" : "inactive"}" data-geometry-node="${geometryNodeEscape(instanceId)}" data-geometry-node-type="${type}" style="left:${position[0]}px;top:${position[1]}px"><div class="geometry-node-title" data-geometry-drag="${geometryNodeEscape(instanceId)}"><span>${geometryNodeEscape(title)}</span><button type="button" data-geometry-remove-node="${geometryNodeEscape(instanceId)}" title="Remove ${geometryNodeEscape(definition.title)} node" aria-label="Remove ${geometryNodeEscape(definition.title)} node">×</button></div>${inputSocket}<div class="geometry-node-fields">${fields}</div>${outputSocket}</article>`;
}

function geometryNodePaletteMarkup(graph) {
  const categories = [...new Set(GEOMETRY_NODE_TYPES.map(type => GEOMETRY_NODE_DEFINITIONS[type].category))];
  return categories.map(category => `<section><strong>${category}</strong>${GEOMETRY_NODE_TYPES.filter(type => GEOMETRY_NODE_DEFINITIONS[type].category === category).map(type => {
    const count = graph.nodeOrder.filter(nodeId => geometryNodeTypeForId(graph, nodeId) === type).length;
    return `<button type="button" data-geometry-add-node="${type}">+ ${geometryNodeEscape(GEOMETRY_NODE_DEFINITIONS[type].title)}${count ? ` (${count})` : ""}</button>`;
  }).join("")}</section>`).join("");
}

function geometryNodeCanvasSize(graph) {
  const points = [...graph.nodeOrder.map(type => graph.nodePositions[type] || [0, 0]), ...graph.smoothNodes.map(node => node.position)];
  return {
    width: Math.max(2200, ...points.map(point => point[0] + 260)),
    height: Math.max(1100, ...points.map(point => point[1] + 300))
  };
}

function geometryNodeRulersMarkup({ width, height }) {
  const xTicks = Array.from({ length: Math.ceil(width / 100) + 1 }, (_, index) => `<span style="left:${index * 100}px">${index * 100}</span>`).join("");
  const yTicks = Array.from({ length: Math.ceil(height / 100) + 1 }, (_, index) => `<span style="top:${index * 100}px">${index * 100}</span>`).join("");
  return `<div class="geometry-node-ruler-x" aria-hidden="true">${xTicks}</div><div class="geometry-node-ruler-y" aria-hidden="true">${yTicks}</div>`;
}

function geometryNodeSurface(doc, kind = "sidebar") {
  const ids = GEOMETRY_NODE_SURFACE_IDS[kind];
  if (!doc || !ids) return null;
  return Object.fromEntries(Object.entries(ids).map(([key, id]) => [key, doc.getElementById(id)]));
}

function liveGeometryNodesDetachedWindow() {
  if (geometryNodesDetachedWindow?.closed) geometryNodesDetachedWindow = null;
  return geometryNodesDetachedWindow;
}

function geometryNodeLinkPath(from, to) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const handle = Math.max(42, Math.min(260, Math.abs(dx) * .46 + Math.abs(dy) * .22 + (dx < 0 ? 70 : 0)));
  return `M ${from[0]} ${from[1]} C ${from[0] + handle} ${from[1]}, ${to[0] - handle} ${to[1]}, ${to[0]} ${to[1]}`;
}

function geometryNodePortPoint(canvas, nodeId, direction, portIndex = 0) {
  const canvasBounds = canvas.getBoundingClientRect();
  const scaleX = canvasBounds.width / Math.max(1, canvas.offsetWidth);
  const scaleY = canvasBounds.height / Math.max(1, canvas.offsetHeight);
  const ports = canvas.querySelectorAll(`[data-geometry-node="${nodeId}"] .geometry-node-port.${direction}`);
  const port = ports[portIndex] || ports[0];
  const portBounds = port?.getBoundingClientRect();
  return portBounds ? [(portBounds.left + portBounds.width / 2 - canvasBounds.left) / scaleX, (portBounds.top + portBounds.height / 2 - canvasBounds.top) / scaleY] : null;
}

function renderGeometryNodeLinks(canvas, graph, doc = canvas?.ownerDocument) {
  const svg = canvas?.querySelector(".geometry-node-links");
  if (!canvas || !svg || !graph) return;
  const links = graph.connections.map(connection => {
    const from = geometryNodePortPoint(canvas, connection.fromNodeId, "output");
    const to = geometryNodePortPoint(canvas, connection.toNodeId, "input", Math.max(0, Number(connection.toInputIndex) || 0));
    if (!from || !to) return "";
    const path = geometryNodeLinkPath(from, to);
    return `<path class="geometry-node-link-hit" data-geometry-link="${geometryNodeEscape(connection.id)}" d="${path}"></path><path class="geometry-node-link" d="${path}"></path>`;
  });
  const interaction = geometryNodeInteractionByDocument.get(doc);
  if (interaction?.pendingFrom && interaction.pointer) {
    const from = geometryNodePortPoint(canvas, interaction.pendingFrom, "output");
    if (from) links.push(`<path class="geometry-node-link pending" d="${geometryNodeLinkPath(from, interaction.pointer)}"></path>`);
  }
  svg.innerHTML = links.join("");
}

function fitGeometryNodeSidebarOverview() {
  const viewport = document.getElementById("geometryNodeViewport");
  const canvas = document.getElementById("geometryNodeCanvas");
  if (!viewport || !canvas || viewport.hidden) return;
  const scale = Math.min(1, Math.max(.12, (viewport.clientWidth - 2) / Math.max(1, canvas.offsetWidth)));
  canvas.style.transform = `scale(${scale})`;
  canvas.style.transformOrigin = "top left";
  const fittedHeight = Math.ceil(canvas.offsetHeight * scale);
  viewport.style.height = `${fittedHeight}px`;
  viewport.style.minHeight = `${fittedHeight}px`;
  geometryNodeRefreshRulers(canvas);
  viewport.dataset.fitLabel = scale < .95 ? "Overview — open the detached editor for full-size controls" : "";
}

function renderGeometryNodeSurface(doc, kind = "sidebar") {
  const surface = geometryNodeSurface(doc, kind);
  if (!surface?.canvas || !surface.select) return;
  const { canvas, select, status } = surface;
  if(kind==="sidebar"&&canvas.parentElement){canvas.parentElement.hidden=true;canvas.parentElement.style.display="none";}
  if (!geometryNodesRuntimeEnabled) {
    canvas.replaceChildren();
    select.replaceChildren();
    if (status) status.textContent = "Plugin unloaded. Saved node graphs remain in this project.";
    return;
  }
  select.innerHTML = geometryNodeProjectState.graphs.map(graph => `<option value="${geometryNodeEscape(graph.id)}" ${graph.id === geometryNodeProjectState.activeGraphId ? "selected" : ""}>${geometryNodeEscape(graph.name)}</option>`).join("");
  const graph = activeGeometryNodeGraph();
  if (surface.deleteButton) surface.deleteButton.textContent = graph && geometryNodePendingDeleteId === graph.id ? "Confirm delete graph" : "Delete graph";
  for (const button of [surface.buildButton, surface.root?.querySelector("[data-geometry-center-output]"), surface.bakeButton, surface.deleteButton, surface.copyButton, surface.saveClusterButton]) {
    if (button) button.disabled = !graph;
  }
  if (!graph) {
    canvas.innerHTML = '<div class="geometry-node-empty">No graph in this project. Choose New graph to begin.</div>';
    if (status) status.textContent = "No saved graph.";
    return;
  }
  geometryNodeInstallLayoutTools(surface,doc);
  const palette = surface.root?.querySelector("[data-geometry-node-palette]");
  if (palette) palette.innerHTML = geometryNodePaletteMarkup(graph);
  const canvasSize = geometryNodeCanvasSize(graph);
  canvas.style.width = `${canvasSize.width}px`;
  canvas.style.height = `${canvasSize.height}px`;
  canvas.innerHTML = `${geometryNodeRulersMarkup(canvasSize)}<svg class="geometry-node-links" aria-hidden="true"></svg>${graph.nodeOrder.map(nodeId => geometryNodeCard(graph, geometryNodeTypeForId(graph, nodeId), nodeId)).join("")}${graph.smoothNodes.map(node => geometryNodeCard(graph, "smoothGeometry", node.id)).join("")}`;
  if (kind === "detached") {
    canvas.style.transform = `translate(${graph.view.x}px, ${graph.view.y}px) scale(${graph.view.scale})`;
    canvas.style.transformOrigin = "top left";
    const zoomLabel = surface.root?.querySelector("[data-geometry-zoom-label]");
    if (zoomLabel) zoomLabel.textContent = `${Math.round(graph.view.scale * 100)}%`;
  }
  doc.defaultView?.requestAnimationFrame(() => {geometryNodeExpandCanvas(canvas);renderGeometryNodeLinks(canvas, graph, doc);geometryNodeRefreshRulers(canvas);geometryNodeRepairOverlap(surface,graph);});
  if (kind === "sidebar") doc.defaultView?.requestAnimationFrame(fitGeometryNodeSidebarOverview);
  if (kind === "detached") doc.title = `BoltWorks Geometry Nodes — ${graph.name}`;
  const hasGeometrySource = GEOMETRY_NODE_SOURCE_TYPES.some(type => graph.nodeOrder.some(nodeId => geometryNodeTypeForId(graph, nodeId) === type));
  const unsupportedTypes = graph.nodeOrder.filter(nodeId => !geometryNodeTypeForId(graph, nodeId));
  const missingRequired = [hasGeometrySource ? null : "geometry", graph.nodeOrder.some(nodeId => geometryNodeTypeForId(graph, nodeId) === "output") ? null : "output"].filter(Boolean);
  if (surface.buildButton) surface.buildButton.disabled = missingRequired.length > 0 || unsupportedTypes.length > 0;
  if (status) status.textContent = unsupportedTypes.length
    ? `Update or refresh BWS to build this graph. Preserved unsupported node${unsupportedTypes.length === 1 ? "" : "s"}: ${unsupportedTypes.join(", ")}.`
    : missingRequired.length
    ? `Add ${missingRequired.map(type => type === "geometry" ? "a geometry source" : GEOMETRY_NODE_DEFINITIONS[type].title).join(" and ")} before building.`
    : graph.generatedIds.length
    ? `${graph.name} is linked to ${graph.generatedIds.length} generated parts. Build again to update them.`
    : `${graph.name} is saved and ready to build. ${graph.connections.length} manual connection${graph.connections.length === 1 ? "" : "s"}.`;
}

function renderGeometryNodeEditor() {
  renderGeometryNodeSurface(document, "sidebar");
  const detachedWindow = liveGeometryNodesDetachedWindow();
  if (detachedWindow) renderGeometryNodeSurface(detachedWindow.document, "detached");
}

function geometryNodeDetachedMarkup(styleUrl) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BoltWorks Geometry Nodes</title><link rel="stylesheet" href="${geometryNodeEscape(styleUrl)}"><style>html,body{width:100%;height:100%;margin:0;overflow:hidden}.geometry-node-popout-body{display:block!important;background:#0b1012;color:#f2f6f5}.geometry-node-popout-shell{box-sizing:border-box;display:grid;grid-template-rows:auto auto auto minmax(0,1fr) auto;gap:10px;width:100%;height:100%;padding:14px}.geometry-node-popout-header{display:flex;align-items:center;justify-content:space-between;gap:12px}.geometry-node-popout-header h1{margin:0;font-size:18px}.geometry-node-popout-shell .geometry-node-toolbar{display:grid;grid-template-columns:minmax(180px,1fr) auto}.geometry-node-popout-shell .geometry-node-actions{display:flex;flex-wrap:wrap;margin:0}.geometry-node-popout-shell .geometry-node-actions .danger{margin-left:auto}.geometry-node-popout-shell .geometry-node-viewport{min-height:0;height:100%;overflow:hidden}.geometry-node-popout-shell .geometry-node-canvas{position:relative;width:2200px;height:1100px}.geometry-node-popout-shell .geometry-node-links{position:absolute;inset:0;width:100%;height:100%}.geometry-node-popout-shell .geometry-node-card{position:absolute;width:154px}.geometry-node-popout-shell .geometry-node-title{display:flex;align-items:center;justify-content:space-between;padding:7px 9px}.geometry-node-popout-shell .geometry-node-fields{display:grid;gap:6px;padding:8px}.geometry-node-popout-shell .geometry-node-socket{position:relative;display:flex;padding:4px 8px}.geometry-node-popout-shell .output-socket{justify-content:flex-end}.geometry-node-popout-shell .geometry-node-port{position:absolute;top:50%;transform:translateY(-50%)}.geometry-node-popout-shell .geometry-node-port.input{left:-8px}.geometry-node-popout-shell .geometry-node-port.output{right:-8px}.geometry-node-popout-shell>.api-note{margin:0}</style></head><body class="geometry-node-popout-body"><main id="geometryNodeDetachedRoot" class="geometry-node-popout-shell"><header class="geometry-node-popout-header"><h1>Geometry Nodes</h1><span class="plugin-ready">Wheel: zoom · Middle drag or Space + drag: pan</span></header><div class="geometry-node-toolbar"><select id="geometryNodeDetachedGraphSelect" aria-label="Geometry node graph"></select><button id="geometryNodeDetachedNewBtn" type="button">New graph</button><button type="button" data-geometry-tree-template>Tree template</button><button type="button" data-geometry-house-template>House template</button><details class="geometry-node-palette"><summary>+ Add node</summary><div class="geometry-node-palette-list" data-geometry-node-palette></div></details></div><div class="geometry-node-actions"><button id="geometryNodeDetachedBuildBtn" class="primary" type="button">Build / Update Geometry</button><button type="button" data-geometry-center-output title="Rebuild active graph; center X/Z and rest its base on Y=0. Future builds stay centered.">Regenerate centered</button><button id="geometryNodeDetachedBakeBtn" type="button">Bake &amp; Detach</button><div class="geometry-node-view-tools"><button type="button" data-geometry-view="zoom-out" title="Zoom out">−</button><span data-geometry-zoom-label>100%</span><button type="button" data-geometry-view="zoom-in" title="Zoom in">+</button><button type="button" data-geometry-view="fit">Fit graph</button></div><button id="geometryNodeDetachedDeleteBtn" class="danger" type="button">Delete graph</button></div><div class="geometry-node-viewport"><div id="geometryNodeDetachedCanvas" class="geometry-node-canvas" aria-label="Procedural geometry node graph"></div></div><p id="geometryNodeDetachedStatus" class="api-note">Ready.</p></main></body></html>`;
}

function geometryNodeDetachedMarkupWithSharing(styleUrl) {
  const shareMarkup = '<div class="geometry-node-share-actions"><button id="geometryNodeDetachedCopyBtn" type="button">Copy node string</button><button id="geometryNodeDetachedPasteBtn" type="button">Paste node string</button><button id="geometryNodeDetachedSaveClusterBtn" type="button">Save .bwnc</button><button id="geometryNodeDetachedLoadClusterBtn" type="button">Load .bwnc</button><input id="geometryNodeDetachedClusterFile" type="file" accept=".bwnc,application/json" hidden></div>';
  return geometryNodeDetachedMarkup(styleUrl)
    .replace("grid-template-rows:auto auto auto minmax(0,1fr) auto", "grid-template-rows:auto auto auto auto minmax(0,1fr) auto")
    .replace('<div class="geometry-node-viewport">', `${shareMarkup}<div class="geometry-node-viewport">`);
}

function openGeometryNodesDetachedWindow() {
  if (!geometryNodesRuntimeEnabled) return;
  const existing = liveGeometryNodesDetachedWindow();
  if (existing) {
    existing.focus();
    return;
  }
  const popup = window.open("", "bws-geometry-nodes", "popup=yes,width=1120,height=760,resizable=yes,scrollbars=yes");
  if (!popup) {
    const status = document.getElementById("geometryNodeStatus");
    if (status) status.textContent = "The detached editor was blocked by the browser. Allow pop-ups for this local studio and try again.";
    return;
  }
  geometryNodesDetachedWindow = popup;
  const styleUrl = new URL("app/styles/studio.css", window.location.href).href;
  popup.addEventListener("load", () => {
    if (geometryNodesDetachedWindow !== popup || popup.closed) return;
    bindGeometryNodeSurface(popup.document, "detached");
    renderGeometryNodeSurface(popup.document, "detached");
  }, { once: true });
  popup.document.open();
  popup.document.write(geometryNodeDetachedMarkupWithSharing(styleUrl));
  popup.document.close();
  popup.addEventListener("beforeunload", () => {
    if (geometryNodesDetachedWindow === popup) geometryNodesDetachedWindow = null;
  }, { once: true });
  bindGeometryNodeSurface(popup.document, "detached");
  renderGeometryNodeSurface(popup.document, "detached");
  popup.focus();
}

function geometryNodePrng(seed) {
  let value = (Math.round(seed) || 1) >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let result = value;
    result = Math.imul(result ^ result >>> 15, result | 1);
    result ^= result + Math.imul(result ^ result >>> 7, result | 61);
    return ((result ^ result >>> 14) >>> 0) / 4294967296;
  };
}

function geometryNodeSegmentSpec({ shape = "cylinder", name, start, end, width, color, group }) {
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = Math.max(.01, direction.length());
  const rotation = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()), "XYZ");
  const radialScale = shape === "pyramidFrustum" ? width / 1.36 : width / .96;
  return {
    shape, name, position: start.clone().add(end).multiplyScalar(.5).toArray(),
    rotation: [rotation.x, rotation.y, rotation.z].map(THREE.MathUtils.radToDeg),
    scale: [radialScale, length, radialScale], color, roughness: .82,
    groupId: group.id, groupName: group.name
  };
}

function geometryNodeTubeGeometry(points, radii, sides = 10, { flatBase = false } = {}) {
  const vertices = [];
  const indices = [];
  const ringCount = points.length;
  for (let ring = 0; ring < ringCount; ring++) {
    const previous = points[Math.max(0, ring - 1)];
    const next = points[Math.min(ringCount - 1, ring + 1)];
    const tangent = next.clone().sub(previous).normalize();
    const rotation = flatBase && ring === 0
      ? new THREE.Quaternion()
      : new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
    const radius = Math.max(.005, Number(radii[ring] ?? radii.at(-1) ?? .1));
    for (let side = 0; side < sides; side++) {
      const angle = side / sides * Math.PI * 2;
      const offset = new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius).applyQuaternion(rotation);
      vertices.push(...points[ring].clone().add(offset).toArray());
    }
  }
  for (let ring = 0; ring < ringCount - 1; ring++) for (let side = 0; side < sides; side++) {
    const nextSide = (side + 1) % sides;
    const a = ring * sides + side;
    const b = ring * sides + nextSide;
    const c = (ring + 1) * sides + side;
    const d = (ring + 1) * sides + nextSide;
    indices.push(a, c, b, b, c, d);
  }
  const bottomCenter = vertices.length / 3;
  vertices.push(...points[0].toArray());
  const topCenter = vertices.length / 3;
  vertices.push(...points.at(-1).toArray());
  for (let side = 0; side < sides; side++) {
    const nextSide = (side + 1) % sides;
    indices.push(bottomCenter, nextSide, side);
    const topStart = (ringCount - 1) * sides;
    indices.push(topCenter, topStart + side, topStart + nextSide);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function geometryNodeContinuousTrunkGeometry(points, baseWidth, sides = 10, { topRatio = .48, rootFlare = 0 } = {}) {
  const radii = points.map((_, ring) => {
    const progress = ring / Math.max(1, points.length - 1);
    const tapered = THREE.MathUtils.lerp(baseWidth * .5, baseWidth * .5 * topRatio, progress);
    return tapered * (ring === 0 ? 1 + rootFlare : 1);
  });
  return geometryNodeTubeGeometry(points, radii, sides, { flatBase: true });
}

function geometryNodeCurvedBranchGeometry(start, end, baseRadius, tipRatio, sides = 10) {
  const direction = end.clone().sub(start);
  const up = new THREE.Vector3(0, Math.max(.08, direction.length() * .08), 0);
  const points = [
    start.clone(),
    start.clone().addScaledVector(direction, .2).addScaledVector(up, .3),
    start.clone().addScaledVector(direction, .58).addScaledVector(up, .2),
    end.clone()
  ];
  const radii = [baseRadius * 1.18, baseRadius, baseRadius * .68, baseRadius * tipRatio];
  return geometryNodeTubeGeometry(points, radii, sides);
}

function geometryNodeSmoothGeometry(sourceGeometry, { iterations = 2, strength = .72, axis = "xyz", preserveSize = true } = {}) {
  const prepared = sourceGeometry.clone();
  for (const attribute of Object.keys(prepared.attributes)) if (attribute !== "position") prepared.deleteAttribute(attribute);
  let geometry = mergeVertices(prepared, 1e-5);
  if (geometry !== prepared) prepared.dispose();
  const affectedAxes = ["x", "y", "z"].map((name, index) => axis.includes(name) ? index : -1).filter(index => index >= 0);
  for (let pass = 0; pass < iterations; pass++) {
    const position = geometry.getAttribute("position");
    const vertices = Array.from({ length: position.count }, (_, index) => new THREE.Vector3().fromBufferAttribute(position, index));
    const indices = geometry.index ? Array.from(geometry.index.array) : Array.from({ length: position.count }, (_, index) => index);
    const neighbors = vertices.map(() => new Set());
    const edges = new Map();
    const edge = (a, b, opposite) => {
      neighbors[a].add(b);
      neighbors[b].add(a);
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      const record = edges.get(key) || { a: Math.min(a, b), b: Math.max(a, b), opposite: [] };
      record.opposite.push(opposite);
      edges.set(key, record);
    };
    for (let index = 0; index < indices.length; index += 3) {
      const [a, b, c] = indices.slice(index, index + 3);
      edge(a, b, c); edge(b, c, a); edge(c, a, b);
    }
    const blendAxes = (base, target) => {
      const result = base.clone();
      for (const component of affectedAxes) result.setComponent(component, THREE.MathUtils.lerp(base.getComponent(component), target.getComponent(component), strength));
      return result;
    };
    const nextVertices = vertices.map((vertex, index) => {
      const adjacent = [...neighbors[index]];
      if (adjacent.length < 3) return vertex.clone();
      const beta = adjacent.length === 3 ? 3 / 16 : 3 / (8 * adjacent.length);
      const target = vertex.clone().multiplyScalar(1 - adjacent.length * beta);
      adjacent.forEach(neighbor => target.addScaledVector(vertices[neighbor], beta));
      return blendAxes(vertex, target);
    });
    const edgeIndexes = new Map();
    for (const [key, record] of edges) {
      const midpoint = vertices[record.a].clone().add(vertices[record.b]).multiplyScalar(.5);
      let target = midpoint;
      if (record.opposite.length === 2) target = vertices[record.a].clone().add(vertices[record.b]).multiplyScalar(3 / 8)
        .addScaledVector(vertices[record.opposite[0]], 1 / 8).addScaledVector(vertices[record.opposite[1]], 1 / 8);
      edgeIndexes.set(key, nextVertices.length);
      nextVertices.push(blendAxes(midpoint, target));
    }
    const edgeIndex = (a, b) => edgeIndexes.get(a < b ? `${a}:${b}` : `${b}:${a}`);
    const nextIndices = [];
    for (let index = 0; index < indices.length; index += 3) {
      const [a, b, c] = indices.slice(index, index + 3);
      const ab = edgeIndex(a, b), bc = edgeIndex(b, c), ca = edgeIndex(c, a);
      nextIndices.push(a, ab, ca, b, bc, ab, c, ca, bc, ab, bc, ca);
    }
    if (preserveSize) {
      const before = new THREE.Box3().setFromPoints(vertices);
      const after = new THREE.Box3().setFromPoints(nextVertices);
      const beforeCenter = before.getCenter(new THREE.Vector3());
      const afterCenter = after.getCenter(new THREE.Vector3());
      for (const component of affectedAxes) {
        const beforeSpan = before.max.getComponent(component) - before.min.getComponent(component);
        const afterSpan = after.max.getComponent(component) - after.min.getComponent(component);
        if (afterSpan <= 1e-8) continue;
        const scale = beforeSpan / afterSpan;
        nextVertices.forEach(vertex => vertex.setComponent(component, beforeCenter.getComponent(component) + (vertex.getComponent(component) - afterCenter.getComponent(component)) * scale));
      }
    }
    const next = new THREE.BufferGeometry();
    next.setAttribute("position", new THREE.Float32BufferAttribute(nextVertices.flatMap(vertex => vertex.toArray()), 3));
    next.setIndex(nextIndices);
    next.computeVertexNormals();
    next.computeBoundingBox();
    next.computeBoundingSphere();
    geometry.dispose();
    geometry = next;
  }
  return geometry;
}

function geometryNodeActiveNodeIds(graph) {
  const active = new Set();
  const outputId = graph.nodeOrder.find(nodeId => geometryNodeTypeForId(graph, nodeId) === "output");
  const stack = outputId ? [outputId] : [];
  while (stack.length) {
    const nodeId = stack.pop();
    if (active.has(nodeId)) continue;
    active.add(nodeId);
    graph.connections.filter(connection => connection.toNodeId === nodeId).forEach(connection => stack.push(connection.fromNodeId));
  }
  return active;
}

function geometryNodeSmoothModifiers(graph, targetId, activeNodeIds = geometryNodeActiveNodeIds(graph)) {
  const result = [];
  const visited = new Set();
  const walk = nodeId => {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    for (const connection of graph.connections.filter(item => item.fromNodeId === nodeId)) {
      if (!activeNodeIds.has(connection.toNodeId) || geometryNodeTypeForId(graph, connection.toNodeId) !== "smoothGeometry") continue;
      const modifier = graph.smoothNodes.find(node => node.id === connection.toNodeId);
      if (modifier) result.push(modifier);
      walk(connection.toNodeId);
    }
  };
  walk(targetId);
  return result;
}

function geometryNodeApplySmoothModifiers(sourceGeometry, modifiers) {
  let geometry = sourceGeometry;
  for (const modifier of modifiers) {
    const smoothed = geometryNodeSmoothGeometry(geometry, modifier.params);
    geometry.dispose();
    geometry = smoothed;
  }
  return geometry;
}

function geometryNodeGeneratedTarget(name) {
  if (/ Mesh primitive /.test(name)) return "primitive";
  if (/ Rock /.test(name)) return "rocks";
  if (/ Wall stone /.test(name)) return "stoneWall";
  if (/ Grass sheets/.test(name)) return "grass";
  if (/ Moss /.test(name)) return "moss";
  if (/ Stem continuous/.test(name)) return "stem";
  if (/ Branch array /.test(name)) return "branchArray";
  if (/ Cluster scatter /.test(name)) return "clusterScatter";
  if (/ Junction blend /.test(name)) return "junctionBlend";
  if (/ Root /.test(name)) return "roots";
  if (/ Trunk /.test(name)) return "trunk";
  if (/ Branch /.test(name)) return "branches";
  if (/ Twig /.test(name)) return "twigs";
  if (/ Canopy | Snow /.test(name)) return "canopy";
  if (/ Joint blend /.test(name)) return "smoothJoints";
  if (/ Knot /.test(name)) return "knot";
  if (/ Cut ring /.test(name)) return "cutSurface";
  return null;
}

function geometryNodeTextureSourceParams(graph, nodeId, visited = new Set()) {
  if (!graph || visited.has(nodeId) || visited.size >= 8) return null;
  const next = new Set(visited); next.add(nodeId);
  const type = geometryNodeTypeForId(graph, nodeId);
  const p = graph.nodeParams?.[nodeId] || graph.params;
  if(type==="colorPalette"){
   const link=graph.connections.find(c=>c.toNodeId===nodeId&&(Number(c.toInputIndex)||0)===0),input=link?geometryNodeTextureSourceParams(graph,link.fromNodeId,next):null;
   const textures=input?.textureChoices?.length?input.textureChoices:[input||{}],count=Math.round(geometryNodeNumber(p.paletteCount,4,1,4)),choices=[];
   for(let i=1;i<=count;i++)for(const texture of textures)choices.push({...texture,materialColor:geometryNodePaletteColor(p,i),textureChoices:undefined});
   return {...choices[0],textureChoices:choices.slice(0,128),texturePoolSeed:input?.texturePoolSeed||0,texturePoolUvs:input?.texturePoolUvs??input?.textureRandomize??false,texturePoolVariation:input?.texturePoolVariation??input?.textureVariation??0};
  }
  if (type === "textureInput") return p?.textureData ? p : null;
  if (type !== "textureRandomizer") return null;
  const choices = [];
  const links = (graph.connections || []).filter(c => c.toNodeId === nodeId).sort((a,b)=>(Number(a.toInputIndex)||0)-(Number(b.toInputIndex)||0));
  for (const link of links) {
    const input = geometryNodeTextureSourceParams(graph, link.fromNodeId, next);
    if (input?.textureChoices) choices.push(...input.textureChoices);
    else if (input?.textureData||input?.materialColor) choices.push(input);
    if (choices.length >= 32) break;
  }
  if (!choices.length) return null;
  // First image keeps legacy texture-presence guards compatible. Selection is per mesh below.
  return {...choices[0], textureChoices:choices.slice(0,32), textureRandomize:false,
    texturePoolSeed:Math.round(geometryNodeNumber(p.texturePoolSeed,0,0,999999)),
    texturePoolUvs:p.texturePoolUvs !== false,
    texturePoolVariation:geometryNodeNumber(p.texturePoolVariation,.75,0,1)};
}
function geometryNodeTextureInputParams(graph, targetId, inputIndex = 1) {
  const connection = graph?.connections?.find(c => c.toNodeId === targetId && (Number(c.toInputIndex)||0) === inputIndex);
  return connection ? geometryNodeTextureSourceParams(graph, connection.fromNodeId) : null;
}
function geometryNodeTexturePartSeed(graph, targetId, name, offset = 0) {
  let hash = ((Number(graph?.seed)||0) + offset) >>> 0;
  for (const c of String(targetId) + ":" + String(name)) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619) >>> 0;
  return hash;
}
function geometryNodePickPartTexture(params, graph, targetId, name) {
  if (!params?.textureChoices?.length) return params;
  const random = geometryNodePrng(geometryNodeTexturePartSeed(graph,targetId,name,params.texturePoolSeed));
  const choice = params.textureChoices[Math.floor(random()*params.textureChoices.length)];
  return {...choice, textureRandomize:params.texturePoolUvs, textureVariation:params.texturePoolVariation};
}

function geometryNodeRandomizeTextureUvs(geometry, random, amount = 1) {
  const uv = geometry?.getAttribute?.("uv");
  const strength = THREE.MathUtils.clamp(Number(amount) || 0, 0, 1);
  if (!uv || strength <= 0) return;
  const turn = Math.floor(random() * 4);
  const cosine = [1, 0, -1, 0][turn];
  const sine = [0, 1, 0, -1][turn];
  const scale = 1 + (random() - .5) * strength * .9;
  const offsetU = (random() - .5) * strength * 1.8;
  const offsetV = (random() - .5) * strength * 1.8;
  const mirrorU = random() < strength * .5 ? -1 : 1;
  const mirrorV = random() < strength * .5 ? -1 : 1;
  for (let index = 0; index < uv.count; index++) {
    const u = (uv.getX(index) - .5) * scale * mirrorU;
    const v = (uv.getY(index) - .5) * scale * mirrorV;
    uv.setXY(index, u * cosine - v * sine + .5 + offsetU, u * sine + v * cosine + .5 + offsetV);
  }
  uv.needsUpdate = true;
}

function geometryNodeTextureSpec(textureName, graph = null, targetId = null, textureParamsOverride = undefined) {
  const textureParams = textureParamsOverride === undefined ? geometryNodeTextureInputParams(graph, targetId) : textureParamsOverride;
  if (textureParams?.textureData) {
    return { textureUrl: textureParams.textureData, textureName: textureParams.textureName || "Embedded texture" };
  }
  const name = String(textureName || "").trim();
  const entry = name && typeof textureLibrary !== "undefined" ? textureLibrary.get(name) : null;
  return { textureUrl: entry?.dataUrl || null, textureName: entry?.name || (name || null) };
}

function geometryNodeCustomSpec(geometry, { name, position, color, group, rotation = [0, 0, 0], roughness = .78, textureName = "", graph = null, targetId = null, textureParams = undefined, textureKey = name }) {
  const sourceTexture = textureParams === undefined ? geometryNodeTextureInputParams(graph,targetId) : textureParams;
  const selectedTexture = geometryNodePickPartTexture(sourceTexture,graph,targetId,textureKey);
  if(selectedTexture?.materialColor)color=selectedTexture.materialColor;
  const assetType = graph ? geometryNodeTypeForId(graph,targetId) : null;
  if ((sourceTexture?.textureChoices || BWS_ASSET_NODES[assetType]) && selectedTexture?.textureData && selectedTexture.textureRandomize !== false) {
    geometryNodeRandomizeTextureUvs(geometry, geometryNodePrng(geometryNodeTexturePartSeed(graph,targetId,textureKey,sourceTexture?.texturePoolSeed || 0)), selectedTexture.textureVariation ?? 1);
  }
  const data = geometryToData(geometry);
  geometry.dispose();
  return { shape: "custom", geometry: data, name, position, rotation, scale: [1, 1, 1], color, roughness, ...geometryNodeTextureSpec(textureName, graph, targetId, selectedTexture), groupId: group.id, groupName: group.name };
}

function geometryNodeInnerPanelSpec(bounds, { name, group, color, roughness = .78, inset = 0.16, axis = "auto" }) {
  if (!bounds || bounds.isEmpty?.()) return null;
  const size = bounds.getSize(new THREE.Vector3());
  if (!Number.isFinite(size.x) || !Number.isFinite(size.y) || !Number.isFinite(size.z)) return null;
  const padding = Math.max(0, Number(inset) || 0);
  const spanX = Math.max(0.1, size.x - padding * 2);
  const spanY = Math.max(0.1, size.y - padding * 2);
  const spanZ = Math.max(0.1, size.z - padding * 2);
  const spans = [spanX, spanY, spanZ];
  const minSpan = Math.min(...spans);
  const thinAxis = axis === "x" ? 0 : axis === "y" ? 1 : axis === "z" ? 2 : spans.indexOf(minSpan);
  const thickness = Math.max(0.02, minSpan * 0.2);
  const sizeX = thinAxis === 0 ? thickness : spanX;
  const sizeY = thinAxis === 1 ? thickness : spanY;
  const sizeZ = thinAxis === 2 ? thickness : spanZ;
  const geometry = new THREE.BoxGeometry(sizeX, sizeY, sizeZ);
  const position = bounds.getCenter(new THREE.Vector3());
  return geometryNodeCustomSpec(geometry, { name, position: position.toArray(), color, roughness, group });
}

function geometryNodeRockGeometry(profile, size, variation, random, wallStone = false) {
  const settings = {
    rounded: { sides: 11, height: .68, depth: .82, rings: [.7, 1, 1.04, .9, .55] },
    jagged: { sides: 7, height: .82, depth: .86, rings: [.68, 1.04, .9, 1, .42] },
    flat: { sides: 9, height: .46, depth: .86, rings: [.78, 1.05, 1, .86, .58] },
    boulder: { sides: 9, height: .96, depth: .9, rings: [.7, .98, 1.04, .88, .48] }
  }[wallStone ? "flat" : profile] || { sides: 9, height: .7, depth: .86, rings: [.7, 1, 1, .85, .5] };
  const vertices = [], uvs = [], indices = [];
  const sideNoise = Array.from({ length: settings.sides }, () => 1 + (random() - .5) * variation * .62);
  const angleOffsets = Array.from({ length: settings.sides }, () => (random() - .5) * Math.PI * 2 / settings.sides * variation * .48);
  // The side strip duplicates side zero at U=1. Keep both UV vertices at the
  // exact same position by sampling deformation once per unique ring/side.
  const ringNoiseByRing = settings.rings.map(() => Array.from(
    { length: settings.sides },
    () => 1 + (random() - .5) * variation * .2
  ));
  const ringShifts = settings.rings.map((_, ring) => ({
    x: (random() - .5) * size * variation * .14 * Math.sin(ring / (settings.rings.length - 1) * Math.PI),
    z: (random() - .5) * size * variation * .14 * Math.sin(ring / (settings.rings.length - 1) * Math.PI)
  }));
  const xStretch = .82 + random() * .42;
  const zStretch = .8 + random() * .4;
  const xBias = (random() - .5) * size * .14;
  const zBias = (random() - .5) * size * .12;
  for (let ring = 0; ring < settings.rings.length; ring++) {
    const t = ring / (settings.rings.length - 1);
    const y = t * settings.height * size;
    for (let side = 0; side <= settings.sides; side++) {
      const wrappedSide = side % settings.sides;
      const angle = wrappedSide / settings.sides * Math.PI * 2 + angleOffsets[wrappedSide];
      const radius = settings.rings[ring] * sideNoise[wrappedSide] * ringNoiseByRing[ring][wrappedSide];
      const crownShift = Math.sin(t * Math.PI) * 1.4;
      vertices.push(
        Math.cos(angle) * size * .56 * xStretch * radius + xBias * crownShift + ringShifts[ring].x,
        y + Math.sin(angle * 2.1 + ring) * size * variation * .025,
        Math.sin(angle) * size * .56 * settings.depth * zStretch * radius + zBias * crownShift + ringShifts[ring].z
      );
      uvs.push(side / settings.sides, t);
    }
  }
  const stride = settings.sides + 1;
  for (let ring = 0; ring < settings.rings.length - 1; ring++) for (let side = 0; side < settings.sides; side++) {
    const a = ring * stride + side, b = a + 1, c = a + stride, d = c + 1;
    indices.push(a, c, b, b, c, d);
  }
  const bottomRim = vertices.length / 3;
  const topRingStart = (settings.rings.length - 1) * stride;
  for (let side = 0; side < settings.sides; side++) {
    const source = side;
    vertices.push(vertices[source * 3], vertices[source * 3 + 1], vertices[source * 3 + 2]);
    const angle = side / settings.sides * Math.PI * 2;
    uvs.push(.5 + Math.cos(angle) * .48, .5 + Math.sin(angle) * .48);
  }
  const topRim = vertices.length / 3;
  for (let side = 0; side < settings.sides; side++) {
    const source = topRingStart + side;
    vertices.push(vertices[source * 3], vertices[source * 3 + 1], vertices[source * 3 + 2]);
    const angle = side / settings.sides * Math.PI * 2;
    uvs.push(.5 + Math.cos(angle) * .48, .5 + Math.sin(angle) * .48);
  }
  const bottomCenter = vertices.length / 3;
  vertices.push(0, 0, 0); uvs.push(.5, .5);
  const topCenter = vertices.length / 3;
  vertices.push(xBias * 1.45, settings.height * size * 1.02, zBias * 1.45); uvs.push(.5, .5);
  for (let side = 0; side < settings.sides; side++) {
    const next = (side + 1) % settings.sides;
    indices.push(bottomCenter, bottomRim + side, bottomRim + next);
    indices.push(topCenter, topRim + next, topRim + side);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.translate(0, -geometry.boundingBox.min.y, 0);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function geometryNodeMossOverlayGeometry(surface, placement, coverage, thickness, minY, span, random) {
  const position = surface.geometry?.getAttribute("position");
  if (!position) return null;
  const sourceIndices = surface.geometry.index?.array || Array.from({ length: position.count }, (_, index) => index);
  const vertices = [], indices = [], eligible = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const edgeA = new THREE.Vector3(), edgeB = new THREE.Vector3(), normal = new THREE.Vector3();
  for (let index = 0; index < sourceIndices.length; index += 3) {
    a.fromBufferAttribute(position, sourceIndices[index]);
    b.fromBufferAttribute(position, sourceIndices[index + 1]);
    c.fromBufferAttribute(position, sourceIndices[index + 2]);
    edgeA.subVectors(b, a); edgeB.subVectors(c, a); normal.crossVectors(edgeA, edgeB).normalize();
    if (normal.y < -.15) continue;
    const localY = (a.y + b.y + c.y) / 3;
    const normalized = surface.kind === "rock"
      ? localY / Math.max(.001, surface.size.y)
      : (surface.position.y + localY - minY) / span;
    const inBand = placement === "all"
      || (placement === "bottom" && normalized <= .42)
      || (placement === "middle" && normalized > .26 && normalized < .74)
      || (placement === "top" && normalized >= .56);
    if (!inBand) continue;
    eligible.push({ a: a.clone(), b: b.clone(), c: c.clone(), normal: normal.clone(), area: edgeA.cross(edgeB).length() * .5 });
  }
  if (!eligible.length) return null;
  const patchCount = Math.max(2, Math.round(2 + coverage * 9));
  for (let patch = 0; patch < patchCount; patch++) {
    const face = eligible[Math.floor(random() * eligible.length)];
    const rootA = Math.sqrt(random()), rootB = random();
    const center = face.a.clone().multiplyScalar(1 - rootA)
      .add(face.b.clone().multiplyScalar(rootA * (1 - rootB)))
      .add(face.c.clone().multiplyScalar(rootA * rootB));
    const tangent = face.b.clone().sub(face.a).normalize();
    // Keep this basis right-handed. Reversing tangent/normal mirrors the sphere
    // and turns every visible moss face inward under back-face culling.
    const bitangent = new THREE.Vector3().crossVectors(tangent, face.normal).normalize();
    const sourceLimit = Math.max(.08, Math.min(surface.size.x, surface.size.y, surface.size.z) * .42);
    const radius = THREE.MathUtils.clamp(Math.sqrt(Math.max(.0001, face.area)) * (.3 + random() * .3), .055, sourceLimit);
    const radiusX = radius * (.8 + random() * .55);
    const radiusY = radius * (.62 + random() * .5);
    const radiusNormal = Math.max(thickness * (1.15 + random() * .55), radius * (.42 + random() * .18));
    const patchCenter = center.clone().addScaledVector(face.normal, -radiusNormal * .64);
    const lump = new THREE.SphereGeometry(1, 7, 4);
    const lumpPosition = lump.getAttribute("position");
    const offset = vertices.length / 3;
    for (let vertex = 0; vertex < lumpPosition.count; vertex++) {
      const localX = lumpPosition.getX(vertex), localY = lumpPosition.getY(vertex), localZ = lumpPosition.getZ(vertex);
      const point = patchCenter.clone()
        .addScaledVector(tangent, localX * radiusX)
        .addScaledVector(face.normal, localY * radiusNormal)
        .addScaledVector(bitangent, localZ * radiusY);
      point.y = Math.max(.004 - surface.position.y, point.y);
      vertices.push(point.x, point.y, point.z);
    }
    const lumpIndices = lump.index?.array || Array.from({ length: lumpPosition.count }, (_, index) => index);
    for (const index of lumpIndices) indices.push(offset + Number(index));
    lump.dispose();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function geometryNodeCrackMossGeometry(surfaces, placement, density, thickness, minY, span, random) {
  const vertices = [], indices = [];
  const wallSurfaces = surfaces.filter(item => item.kind === "wall");
  const minWallZ = Math.min(...wallSurfaces.map(surface => surface.position.z));
  const maxWallZ = Math.max(...wallSurfaces.map(surface => surface.position.z));
  const hasSeparateFaces = maxWallZ - minWallZ > .05;
  for (const surface of wallSurfaces) {
    const normalized = (surface.position.y + surface.size.y * .5 - minY) / span;
    const inBand = placement === "all"
      || (placement === "bottom" && normalized <= .46)
      || (placement === "middle" && normalized > .24 && normalized < .76)
      || (placement === "top" && normalized >= .54);
    if (!inBand) continue;
    const faceSigns = hasSeparateFaces ? [surface.position.z <= (minWallZ + maxWallZ) * .5 ? -1 : 1] : [-1, 1];
    for (const faceSign of faceSigns) {
      if (random() > density) continue;
      const edge = random() < .78 ? (random() < .5 ? -1 : 1) : 0;
      const center = new THREE.Vector3(
        surface.position.x + edge * surface.size.x * .45 + (random() - .5) * surface.size.x * .14,
        surface.position.y + surface.size.y * (.12 + random() * .72),
        surface.position.z + faceSign * surface.size.z * .24
      );
      const radiusX = Math.max(.065, Math.min(surface.size.x * .34, surface.size.y * (.24 + random() * .3)));
      const radiusY = radiusX * (.68 + random() * .58);
      const lobes = 2 + Math.floor(random() * 4);
      for (let lobe = 0; lobe < lobes; lobe++) {
        const lobeCenter = center.clone().add(new THREE.Vector3((random() - .5) * radiusX * 1.15, (random() - .5) * radiusY * 1.2, faceSign * lobe * .004));
        const radiusDepth = Math.max(thickness * (1.35 + random() * .45), radiusX * (.48 + random() * .16), surface.size.z * .3);
        const lump = new THREE.SphereGeometry(1, 7, 5);
        const lumpPositions = lump.getAttribute("position");
        const offset = vertices.length / 3;
        for (let vertex = 0; vertex < lumpPositions.count; vertex++) {
          const localX = lumpPositions.getX(vertex), localY = lumpPositions.getY(vertex), localZ = lumpPositions.getZ(vertex);
          const wobble = 1 + Math.sin((localX + lobe * .37) * 5.3 + localY * 3.7) * .07;
          vertices.push(
            lobeCenter.x + localX * radiusX * wobble,
            Math.max(.004, lobeCenter.y + localY * radiusY * wobble),
            lobeCenter.z + localZ * radiusDepth * wobble
          );
        }
        const lumpIndices = lump.index?.array || Array.from({ length: lumpPositions.count }, (_, index) => index);
        for (const index of lumpIndices) indices.push(offset + Number(index));
        lump.dispose();
      }
    }
  }
  if (!vertices.length) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function geometryNodeFitGeometry(geometry, sizeX, sizeY, sizeZ) {
  geometry.computeBoundingBox();
  const current = geometry.boundingBox.getSize(new THREE.Vector3());
  geometry.scale(sizeX / Math.max(.001, current.x), sizeY / Math.max(.001, current.y), sizeZ / Math.max(.001, current.z));
  geometry.computeBoundingBox();
  geometry.translate(0, -geometry.boundingBox.min.y, 0);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function geometryNodeGrassGeometry(blades, height, width, random) {
  const vertices = [];
  const indices = [];
  const addTriangle = (a, b, c) => {
    const start = vertices.length / 3;
    vertices.push(...a, ...b, ...c);
    indices.push(start, start + 1, start + 2, start + 2, start + 1, start);
  };
  for (const base of blades) {
    for (let sprout = 0; sprout < 4; sprout++) {
      const angle = sprout / 4 * Math.PI * 2 + random() * .65;
      const bladeHeight = height * (.62 + random() * .62);
      const bladeWidth = width * (.65 + random() * .55);
      const tangent = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
      const lateral = new THREE.Vector3(-tangent.z, 0, tangent.x).multiplyScalar(bladeWidth);
      const root = base.clone().addScaledVector(tangent, random() * width * 1.8);
      const middle = root.clone().add(new THREE.Vector3(tangent.x * bladeHeight * .12, bladeHeight * .56, tangent.z * bladeHeight * .12));
      const tip = root.clone().add(new THREE.Vector3(tangent.x * bladeHeight * (.22 + random() * .24), bladeHeight, tangent.z * bladeHeight * (.22 + random() * .24)));
      const rootLeft = root.clone().sub(lateral), rootRight = root.clone().add(lateral);
      const middleLeft = middle.clone().addScaledVector(lateral, -.45), middleRight = middle.clone().addScaledVector(lateral, .45);
      addTriangle(rootLeft.toArray(), rootRight.toArray(), middleLeft.toArray());
      addTriangle(rootRight.toArray(), middleRight.toArray(), middleLeft.toArray());
      addTriangle(middleLeft.toArray(), middleRight.toArray(), tip.toArray());
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function geometryNodeGrassPointBlocked(x, z, surfaces, clearance) {
  return surfaces.some(surface => {
    const angle = -(surface.rotationY || 0);
    const offsetX = x - surface.position.x;
    const offsetZ = z - surface.position.z;
    const localX = offsetX * Math.cos(angle) - offsetZ * Math.sin(angle);
    const localZ = offsetX * Math.sin(angle) + offsetZ * Math.cos(angle);
    const halfX = Math.max(.001, surface.size.x * .5 + clearance);
    const halfZ = Math.max(.001, surface.size.z * .5 + clearance);
    const dx = localX / halfX;
    const dz = localZ / halfZ;
    if (surface.kind === "wall") return Math.abs(dx) <= 1 && Math.abs(dz) <= 1;
    return dx * dx + dz * dz <= 1;
  });
}

function buildGeometryNodeTree({ centerOutput = false, graphOverride = null, previewOnly = false } = {}) {
  const graph = graphOverride || activeGeometryNodeGraph();
  const previewMeshes=new Map();
  const lookupMesh=id=>previewOnly?previewMeshes.get(id):findObject(id);
  if (!graph || !GEOMETRY_NODE_SOURCE_TYPES.some(type => graph.nodeOrder.some(nodeId => geometryNodeTypeForId(graph, nodeId) === type)) || !graph.nodeOrder.some(nodeId => geometryNodeTypeForId(graph, nodeId) === "output")) return;
  // Reject oversized asset graphs before replacing an existing generated result.
  const requestedAssetNodes = geometryNodeActiveNodeIds(graph);
  if ([...requestedAssetNodes].some(id => geometryNodeTypeForId(graph, id) === "houseBatch")) {if(previewOnly)throw Error("House Batch is not supported as a nature source.");return buildHouseBatch(graph);}
  let assetPartBudget = 0;
  for (const nodeId of requestedAssetNodes) {
    const type = geometryNodeTypeForId(graph, nodeId);
    if (!BWS_ASSET_NODES[type] || BWS_ASSET_NODES[type].attachment) continue;
    const values = assetNodeSanitize(graph.nodeParams?.[nodeId] || graph.params);
    assetPartBudget += type === "houseLayout" ? 2500 : type === "brickWall" ? ((values.brickColumns + 1) * values.brickRows + 1) * values.brickCopies
      : type === "groundTiles" ? values.tileColumns * values.tileRows + 1 : 64;
  }
  if (assetPartBudget > 3000) { setGeometryNodeStatus("Too many asset parts. Reduce counts or build smaller graphs (limit 3000 parts)."); return; }
  if(!previewOnly)recordHistory("build geometry node tree");
  if (centerOutput) graph.centerOutput = true;
  for (const id of previewOnly?[]:graph.generatedIds) {
    const mesh = lookupMesh(id);
    if (mesh) removeObject(mesh, { record: false, update: false });
  }
  const p = graph.params;
  const activeNodeIds = geometryNodeActiveNodeIds(graph);
  const activeNodes = new Set([...activeNodeIds, ...[...activeNodeIds].map(nodeId => geometryNodeTypeForId(graph, nodeId)).filter(Boolean)]);
  const useVariant = activeNodes.has("variant");
  const style = useVariant ? p.variantStyle : "classic";
  const season = useVariant ? p.variantSeason : "summer";
  const maturity = useVariant ? p.variantMaturity : "mature";
  const maturityProfile = {
    sapling: { height: .48, width: .55, branches: .45, canopy: .62 },
    young: { height: .74, width: .72, branches: .72, canopy: .82 },
    mature: { height: 1, width: 1, branches: 1, canopy: 1 },
    ancient: { height: 1.12, width: 1.42, branches: 1.34, canopy: 1.2 }
  }[maturity];
  const styleProfile = {
    classic: { height: 1, width: 1, branches: 1, branchLength: 1, canopy: 1, density: 1 },
    broad: { height: .88, width: 1.18, branches: 1.15, branchLength: 1.35, canopy: 1.18, density: 1.12 },
    round: { height: .92, width: 1, branches: .86, branchLength: 1.05, canopy: 1.35, density: 1.18 },
    tall: { height: 1.32, width: .72, branches: 1.22, branchLength: .7, canopy: .82, density: 1 },
    sparse: { height: 1.08, width: .82, branches: .62, branchLength: .86, canopy: .72, density: .5 },
    bare: { height: 1.05, width: 1.08, branches: 1.28, branchLength: 1.08, canopy: 0, density: 0 }
  }[style];
  const variation = useVariant ? .35 + p.variantAmount * 1.3 : 1;
  const usesGenericStem = activeNodes.has("stem");
  const usesGenericBranches = activeNodes.has("branchArray");
  const usesGenericClusters = activeNodes.has("clusterScatter");
  const effectiveHeight = usesGenericStem ? p.stemHeight : p.height * maturityProfile.height * styleProfile.height;
  const effectiveTrunkWidth = usesGenericStem ? p.stemBaseRadius * 2 : p.trunkWidth * maturityProfile.width * styleProfile.width;
  const effectiveTrunkSegments = usesGenericStem ? p.stemSegments : p.trunkSegments;
  const effectiveBranchCount = usesGenericBranches ? p.branchArrayCount : Math.max(0, Math.round(p.branchCount * maturityProfile.branches * styleProfile.branches));
  const effectiveBranchLength = usesGenericBranches ? p.branchArrayLength : p.branchLength * maturityProfile.height * styleProfile.branchLength;
  const effectiveCanopySize = p.canopySize * maturityProfile.canopy * styleProfile.canopy;
  const effectiveCanopyDensity = Math.max(1, Math.round(p.canopyDensity * styleProfile.density));
  const canopyColors = {
    spring: ["#79a94d", "#a0c95b", "#5f963e"],
    summer: ["#3f7437", "#568843", "#315f31"],
    autumn: ["#b64a2b", "#dd7728", "#e4a52b", "#8f3028"],
    winter: ["#23464a", "#315c5b", "#1d383d"],
    snowy: ["#3b7045", "#527f50", "#2e5c3d"]
  }[season];
  graph.buildVersion += 1;
  const outputName = String(p.outputName || graph.name || "Procedural Geometry").trim() || "Procedural Geometry";
  graph.name = outputName;
  const groupId = `geometry-nodes-${graph.id}`;
  const existingGroup = previewOnly?null:groupRecord(groupId);
  const group = existingGroup || (previewOnly?{id:groupId,name:outputName}:createSceneGroupRecord({ id: groupId, name: outputName }));
  group.name = outputName;
  const random = geometryNodePrng(graph.seed);
  const generated = [];
  const natureSurfaces = [];
  const addGenerated = spec => {
    const mesh = previewOnly?geometryNodePreviewMesh(spec,previewMeshes):addObject(spec, { record: false, select: false, update: false });
    generated.push(mesh.userData.id);
    return mesh;
  };
  for (const nodeId of graph.nodeOrder) {
    const type = geometryNodeTypeForId(graph, nodeId);
    if (!activeNodeIds.has(nodeId) || !BWS_ASSET_NODES[type] || BWS_ASSET_NODES[type].attachment) continue;
    assetNodeBuild(type, graph.nodeParams?.[nodeId] || graph.params, {
      graph, nodeId, group, outputName, attachments:buildingAttachments(graph,nodeId,activeNodeIds),
      emit: spec => { const mesh = addGenerated(spec); mesh.userData.geometryNodeSourceId = nodeId; }
    });
  }
  if (activeNodes.has("primitive")) addGenerated({
    shape: p.primitiveShape, name: `${outputName} Mesh primitive 1`, position: [0, p.primitiveSizeY * .5, 0], rotation: [0, 0, 0],
    scale: [p.primitiveSizeX, p.primitiveSizeY, p.primitiveSizeZ], color: p.primitiveColor, roughness: .82,
    groupId: group.id, groupName: group.name
  });
  if (activeNodes.has("rocks")) {
    const count = p.rockArrangement === "single" ? 1 : p.rockCount;
    const stackSlots = [];
    const clusterSlots = [];
    const stackPlaced = [];
    const rockMeshes = [];
    const rockPalette = [p.rockColor, p.rockColorSecondary, p.rockColorTertiary].map(color => new THREE.Color(color));
    const rockTextureParams = geometryNodeTextureInputParams(graph, "rocks");
    if (p.rockArrangement === "stack") {
      let remaining = count;
      const baseCount = Math.max(1, Math.ceil((Math.sqrt(8 * count + 1) - 1) / 2));
      for (let layer = 0; remaining > 0; layer++) {
        const layerCount = Math.min(Math.max(1, baseCount - layer), remaining);
        for (let inLayer = 0; inLayer < layerCount; inLayer++) stackSlots.push({ layer, inLayer, layerCount });
        remaining -= layerCount;
      }
    }
    for (let index = 0; index < count; index++) {
      const sizeSample = Math.pow(random(), 1.35);
      let scale = p.rockSize * (.42 + sizeSample * (1.08 + p.rockVariation * .36));
      let x = 0, z = 0, y = 0;
      if (p.rockArrangement === "stack") {
        const { layer, inLayer, layerCount } = stackSlots[index];
        scale *= Math.max(.58, 1.16 - layer * .16);
      }
      const geometry = geometryNodeRockGeometry(p.rockProfile, scale, p.rockVariation, random);
      if (rockTextureParams?.textureData && rockTextureParams.textureRandomize !== false) geometryNodeRandomizeTextureUvs(geometry, random, rockTextureParams.textureVariation);
      const bounds = geometry.boundingBox.getSize(new THREE.Vector3());
      if (p.rockArrangement === "line") x = (index - (count - 1) / 2) * p.rockSpacing * p.rockSize;
      else if (p.rockArrangement === "cluster" && index) {
        const anchor = clusterSlots[Math.floor(random() * clusterSlots.length)];
        const angle = random() * Math.PI * 2;
        const footprintRadius = Math.max(bounds.x, bounds.z) * .5;
        const distance = (anchor.radius + footprintRadius) * (.58 + random() * .28);
        x = anchor.x + Math.cos(angle) * distance;
        z = anchor.z + Math.sin(angle) * distance;
      } else if (p.rockArrangement === "stack") {
        const { layer, inLayer, layerCount } = stackSlots[index];
        x = (inLayer - (layerCount - 1) / 2) * p.rockSize * p.rockSpacing * .66 + (random() - .5) * p.rockSize * .055;
        z = (random() - .5) * p.rockSize * .1;
        if (layer) {
          let supports = stackPlaced.filter(item => item.layer === layer - 1 && Math.abs(item.x - x) <= (item.width + bounds.x) * .54);
          if (!supports.length) {
            const candidates = stackPlaced.filter(item => item.layer === layer - 1);
            supports = candidates.sort((left, right) => Math.abs(left.x - x) - Math.abs(right.x - x)).slice(0, 1);
          }
          const supportTop = Math.min(...supports.map(item => item.y + item.height));
          const overlap = Math.min(bounds.y, ...supports.map(item => item.height)) * (.16 + random() * .08);
          y = Math.max(0, supportTop - overlap);
        }
        stackPlaced.push({ layer, x, z, y, width: bounds.x, height: bounds.y, depth: bounds.z });
      }
      if (p.rockArrangement === "cluster") clusterSlots.push({ x, z, radius: Math.max(bounds.x, bounds.z) * .5 });
      const position = new THREE.Vector3(x, y, z);
      const rotationY = random() * Math.PI * 2;
      natureSurfaces.push({ kind: "rock", position, size: bounds.clone(), rotationY, geometry: geometry.clone() });
      const shade = rockPalette[Math.floor(random() * rockPalette.length)].clone().offsetHSL((random() - .5) * .018, 0, (random() - .5) * .1);
      rockMeshes.push(addGenerated(geometryNodeCustomSpec(geometry, { name: `${outputName} Rock ${index + 1}`, position: position.toArray(), rotation: [0, THREE.MathUtils.radToDeg(rotationY), 0], color: `#${shade.getHexString()}`, roughness: .94, textureName: p.rockTextureName, graph, targetId: "rocks", group })));
    }
    if (rockMeshes.length) {
      const clusterBounds = new THREE.Box3().makeEmpty();
      for (const surface of natureSurfaces.filter(surface => surface.kind === "rock")) {
        const positions = surface.geometry.getAttribute("position");
        const cosine = Math.cos(surface.rotationY), sine = Math.sin(surface.rotationY);
        for (let vertex = 0; vertex < positions.count; vertex++) {
          const localX = positions.getX(vertex), localY = positions.getY(vertex), localZ = positions.getZ(vertex);
          clusterBounds.expandByPoint(new THREE.Vector3(
            localX * cosine + localZ * sine + surface.position.x,
            localY + surface.position.y,
            -localX * sine + localZ * cosine + surface.position.z
          ));
        }
      }
      const center = clusterBounds.getCenter(new THREE.Vector3());
      const centerX = center.x, centerZ = center.z;
      for (const surface of natureSurfaces.filter(surface => surface.kind === "rock")) {
        surface.position.x -= centerX;
        surface.position.z -= centerZ;
      }
      for (const mesh of rockMeshes) {
        mesh.position.x -= centerX;
        mesh.position.z -= centerZ;
      }
      clusterBounds.translate(new THREE.Vector3(-centerX, 0, -centerZ));
    }
  }
  if (activeNodes.has("stoneWall")) {
    const wallNodeIds = graph.nodeOrder.filter(nodeId => geometryNodeTypeForId(graph, nodeId) === "stoneWall");
    const sharedWallParams = {};
    const wallParamKeys = ["wallLength", "wallHeight", "wallDepth", "wallRows", "wallColumns", "wallDepthLayers", "wallIrregularity", "wallColorVariation", "wallColor", "wallColorSecondary", "wallColorTertiary", "wallTextureName", "wallOverallTextureMix", "natureOutputMode"];
    for (const key of wallParamKeys) sharedWallParams[key] = p[key];
    for (const wallNodeId of wallNodeIds) {
      if (graph.nodeParams?.[wallNodeId]) Object.assign(p, graph.nodeParams[wallNodeId]);
    const wallPalette = [p.wallColor, p.wallColorSecondary, p.wallColorTertiary].map(color => new THREE.Color(color));
    const wallUpperTexture = geometryNodeTextureInputParams(graph, wallNodeId, 1);
    const wallMiddleTexture = geometryNodeTextureInputParams(graph, wallNodeId, 2);
    const wallBottomTexture = geometryNodeTextureInputParams(graph, wallNodeId, 3);
    const wallOverallTexture = geometryNodeTextureInputParams(graph, wallNodeId, 4);
    const wallBounds = new THREE.Box3().makeEmpty();
    const rowHeight = p.wallHeight / p.wallRows;
    const referenceColumns = Math.max(2, Math.round(p.wallColumns * p.wallLength / 7));
    const depthLayers = Math.max(1, p.wallDepthLayers);
    for (let layer = 0; layer < depthLayers; layer++) {
      const layerOffset = depthLayers === 1 ? 0 : THREE.MathUtils.lerp(-p.wallDepth * .24, p.wallDepth * .24, layer / (depthLayers - 1));
      for (let row = 0; row < p.wallRows; row++) {
        const rowRatio = p.wallRows <= 1 ? 0 : row / (p.wallRows - 1);
        const wallZoneTexture = rowRatio >= .67 ? wallUpperTexture : rowRatio >= .34 ? wallMiddleTexture : wallBottomTexture;
        const courseCount = Math.max(3, Math.round(referenceColumns * (.78 + rowRatio * .24) + (random() - .5) * 2));
        const nominalWidth = p.wallLength / courseCount;
        const overlap = nominalWidth * (.035 + p.wallIrregularity * .025);
        const usableWidth = p.wallLength + overlap * (courseCount - 1);
        const widthWeights = Array.from({ length: courseCount }, () => .7 + Math.pow(random(), 1.25) * (.52 + p.wallIrregularity * .3));
        const weightTotal = widthWeights.reduce((sum, value) => sum + value, 0);
        let cursor = -p.wallLength * .5;
        for (let column = 0; column < courseCount; column++) {
          const stoneWidth = usableWidth * widthWeights[column] / weightTotal;
          const courseHeightBias = 1.08 - rowRatio * .1;
          const stoneHeight = rowHeight * courseHeightBias * (.94 + random() * (.1 + p.wallIrregularity * .1));
          const stoneDepth = p.wallDepth * (depthLayers === 1 ? .92 : (.58 + random() * .12));
          const x = cursor + stoneWidth * .5;
          cursor += stoneWidth - overlap;
          const y = row * rowHeight * .84 + random() * rowHeight * .025;
          const z = layerOffset + (random() - .5) * Math.min(stoneDepth * .12, p.wallDepth * .07);
          const profileRoll = random();
          const stoneProfile = profileRoll < .62 ? "flat" : profileRoll < .86 ? "rounded" : "boulder";
          const geometry = geometryNodeRockGeometry(stoneProfile, 1, Math.min(1, p.wallIrregularity * 1.08), random);
          geometryNodeFitGeometry(geometry, stoneWidth, stoneHeight, stoneDepth);
          const useOverallTexture = wallOverallTexture?.textureData && (!wallZoneTexture?.textureData || random() < p.wallOverallTextureMix);
          const wallTextureParams = useOverallTexture ? wallOverallTexture : wallZoneTexture;
          if (wallTextureParams?.textureData && wallTextureParams.textureRandomize !== false) geometryNodeRandomizeTextureUvs(geometry, random, wallTextureParams.textureVariation);
          const position = new THREE.Vector3(x, y, z);
          const rotationY = THREE.MathUtils.degToRad((random() - .5) * (4 + p.wallIrregularity * 5));
          wallBounds.expandByPoint(position);
          wallBounds.expandByPoint(new THREE.Vector3(
            position.x + stoneWidth,
            position.y + stoneHeight,
            position.z + stoneDepth
          ));
          natureSurfaces.push({ kind: "wall", position, size: new THREE.Vector3(stoneWidth, stoneHeight, stoneDepth), rotationY, geometry: geometry.clone(), outerLayer: layer === 0 || layer === depthLayers - 1 });
          const shade = wallPalette[Math.floor(random() * wallPalette.length)].clone().offsetHSL(
            (random() - .5) * .12 * p.wallColorVariation,
            (random() - .5) * .32 * p.wallColorVariation,
            (random() - .5) * .34 * p.wallColorVariation
          );
          const shadeHsl = {};
          shade.getHSL(shadeHsl);
          shade.setHSL(shadeHsl.h, THREE.MathUtils.clamp(shadeHsl.s, .025, .32), THREE.MathUtils.clamp(shadeHsl.l, .27, .68));
          if (p.natureOutputMode !== "grass") addGenerated(geometryNodeCustomSpec(geometry, { name: `${outputName} Wall stone ${layer + 1}.${row + 1}.${column + 1}`, position: position.toArray(), rotation: [0, THREE.MathUtils.radToDeg(rotationY), 0], color: `#${shade.getHexString()}`, roughness: .9 + random() * .09, textureName: p.wallTextureName, graph, targetId: wallNodeId, textureParams: wallTextureParams, group }));
        }
      }
    }
    }
    Object.assign(p, sharedWallParams);
  }
  if (activeNodes.has("moss") && natureSurfaces.length) {
    const mossSurfaces = natureSurfaces.filter(surface => surface.kind !== "wall" || surface.outerLayer !== false);
    const minY = Math.min(...mossSurfaces.map(surface => surface.position.y));
    const maxY = Math.max(...mossSurfaces.map(surface => surface.position.y + surface.size.y));
    const span = Math.max(.01, maxY - minY);
    const habitatCoverage = Math.min(1, p.mossCoverage * (.48 + p.mossMoisture * .82) * (1 - p.mossSunlight * .58));
    mossSurfaces.forEach((surface, index) => {
      const surfaceCoverage = habitatCoverage * (1 - p.mossCrackBias * .55);
      if (random() > Math.max(.08, surfaceCoverage)) return;
      const geometry = geometryNodeMossOverlayGeometry(surface, p.mossPlacement, surfaceCoverage, p.mossThickness, minY, span, random);
      if (!geometry) return;
      addGenerated(geometryNodeCustomSpec(geometry, { name: `${outputName} Moss ${index + 1}`, position: surface.position.toArray(), rotation: [0, THREE.MathUtils.radToDeg(surface.rotationY), 0], color: p.mossColor, roughness: 1, group }));
    });
    const crackGeometry = geometryNodeCrackMossGeometry(mossSurfaces, p.mossPlacement, habitatCoverage * p.mossCrackBias, p.mossThickness, minY, span, random);
    if (crackGeometry) addGenerated(geometryNodeCustomSpec(crackGeometry, { name: `${outputName} Moss cracks`, position: [0, 0, 0], color: p.mossColor, roughness: 1, group }));
  }
  natureSurfaces.forEach(surface => surface.geometry?.dispose());
  if (activeNodes.has("grass") && natureSurfaces.length) {
    const grassNodeIds = graph.nodeOrder.filter(nodeId => geometryNodeTypeForId(graph, nodeId) === "grass");
    const sharedGrassParams = {};
    const grassParamKeys = ["grassCount", "grassHeight", "grassWidth", "grassSpread", "grassAvoidGeometry", "grassClearance", "grassGrowNegativeX", "grassGrowPositiveX", "grassGrowNegativeZ", "grassGrowPositiveZ", "grassColor"];
    for (const key of grassParamKeys) sharedGrassParams[key] = p[key];
    for (const grassNodeId of grassNodeIds) {
      if (graph.nodeParams?.[grassNodeId]) Object.assign(p, graph.nodeParams[grassNodeId]);
    const blades = [];
    const grassSides = [
      p.grassGrowNegativeZ && { axis: "z", sign: -1 },
      p.grassGrowPositiveZ && { axis: "z", sign: 1 },
      p.grassGrowNegativeX && { axis: "x", sign: -1 },
      p.grassGrowPositiveX && { axis: "x", sign: 1 }
    ].filter(Boolean);
    const natureBounds = natureSurfaces.reduce((bounds, surface) => {
      const halfX = surface.size.x * .5;
      const halfZ = surface.size.z * .5;
      bounds.minX = Math.min(bounds.minX, surface.position.x - halfX);
      bounds.maxX = Math.max(bounds.maxX, surface.position.x + halfX);
      bounds.minZ = Math.min(bounds.minZ, surface.position.z - halfZ);
      bounds.maxZ = Math.max(bounds.maxZ, surface.position.z + halfZ);
      return bounds;
    }, { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity });
    const bladeReach = p.grassWidth * 2 + p.grassHeight * .12;
    const clearance = p.grassClearance + bladeReach;
    const maxAttempts = Math.max(40, p.grassCount * 36);
    for (let attempt = 0; grassSides.length && blades.length < p.grassCount && attempt < maxAttempts; attempt++) {
      const growthSide = grassSides[attempt % grassSides.length];
      const outside = clearance + random() * p.grassSpread;
      const x = growthSide.axis === "x"
        ? (growthSide.sign < 0 ? natureBounds.minX - outside : natureBounds.maxX + outside)
        : THREE.MathUtils.lerp(natureBounds.minX, natureBounds.maxX, random());
      const z = growthSide.axis === "z"
        ? (growthSide.sign < 0 ? natureBounds.minZ - outside : natureBounds.maxZ + outside)
        : THREE.MathUtils.lerp(natureBounds.minZ, natureBounds.maxZ, random());
      if (p.grassAvoidGeometry && geometryNodeGrassPointBlocked(x, z, natureSurfaces, clearance)) continue;
      blades.push(new THREE.Vector3(x, .015, z));
    }
    if (blades.length) addGenerated(geometryNodeCustomSpec(geometryNodeGrassGeometry(blades, p.grassHeight, p.grassWidth, random), { name: `${outputName} Grass sheets ${grassNodeId}`, position: [0, 0, 0], color: p.grassColor, group }));
    }
    Object.assign(p, sharedGrassParams);
  }
  if (activeNodes.has("primitiveTest")) {
    const smoothModifiers = geometryNodeSmoothModifiers(graph, "primitiveTest", activeNodeIds);
    const testShapes = [
      ["Cube", () => new THREE.BoxGeometry(1.5, 1.5, 1.5)],
      ["Pentagon", () => new THREE.CylinderGeometry(.82, .82, 1.55, 5, 1, false)],
      ["Low cone", () => new THREE.ConeGeometry(.9, 1.7, 5, 1, false)]
    ];
    testShapes.forEach(([label, createGeometry], index) => {
      const x = (index - 1) * 2.6;
      const original = createGeometry();
      addGenerated(geometryNodeCustomSpec(original, { name: `${outputName} QA ${label} original`, position: [x, 1, -2], color: "#a85a3a", group }));
      const result = geometryNodeApplySmoothModifiers(createGeometry(), smoothModifiers);
      addGenerated(geometryNodeCustomSpec(result, { name: `${outputName} QA ${label} ${smoothModifiers.length ? "smoothed" : "copy"}`, position: [x, 1, 2], color: "#40a783", group }));
    });
  }
  if (activeNodes.has("roots")) {
    for (let index = 0; index < p.rootCount; index++) {
      const angle = index * Math.PI * 2 / p.rootCount + (random() - .5) * .28;
      const length = p.rootLength * (.78 + random() * .38);
      const start = new THREE.Vector3(0, p.rootThickness * .38, 0);
      const end = new THREE.Vector3(Math.cos(angle) * length, .04, Math.sin(angle) * length);
      addGenerated(geometryNodeSegmentSpec({
        shape: "pyramidFrustum", name: `${outputName} Root ${index + 1}`, start, end,
        width: p.rootThickness * (.8 + random() * .35), color: index % 2 ? "#593523" : "#68402a", group
      }));
    }
  }
  const trunkPoints = [new THREE.Vector3(0, 0, 0)];
  const segmentHeight = effectiveHeight / effectiveTrunkSegments;
  for (let index = 1; index <= effectiveTrunkSegments; index++) {
    const previous = trunkPoints[index - 1];
    const lean = index / effectiveTrunkSegments;
    trunkPoints.push(new THREE.Vector3(
      previous.x + (random() - .5) * (usesGenericStem ? p.stemLean : (activeNodes.has("bend") ? p.trunkBend : .22)) * lean * variation,
      index * segmentHeight,
      previous.z + (random() - .5) * (usesGenericStem ? p.stemLean : (activeNodes.has("bend") ? p.trunkBend : .22)) * lean * variation
    ));
  }
  if (activeNodes.has("trunk") || usesGenericStem) addGenerated(geometryNodeCustomSpec(
    geometryNodeContinuousTrunkGeometry(trunkPoints, effectiveTrunkWidth, usesGenericStem ? p.stemSides : (activeNodes.has("smoothJoints") ? 12 : 8), {
      topRatio: usesGenericStem ? p.stemTopRadius / Math.max(.001, p.stemBaseRadius) : .48,
      rootFlare: usesGenericStem ? p.stemFlare : 0
    }),
    { name: `${outputName} ${usesGenericStem ? "Stem" : "Trunk"} continuous`, position: [0, 0, 0], color: usesGenericStem ? p.stemColor : "#65402b", group }
  ));
  const branchTips = [];
  const branchJoints = [];
  if (activeNodes.has("branches") || usesGenericBranches) for (let index = 0; index < effectiveBranchCount; index++) {
    const vertical = effectiveBranchCount <= 1 ? .72 : .3 + index / Math.max(1, effectiveBranchCount - 1) * .58;
    const trunkIndex = Math.max(1, Math.min(effectiveTrunkSegments - 1, Math.round(vertical * effectiveTrunkSegments)));
    const start = trunkPoints[trunkIndex].clone();
    const angle = index * (Math.PI * 2 / Math.max(1, effectiveBranchCount)) + THREE.MathUtils.degToRad(usesGenericBranches ? p.branchArrayTwist : 0) + (random() - .5) * .7 * variation;
    const elevation = usesGenericBranches ? Math.atan(p.branchArrayRise) : THREE.MathUtils.degToRad(90 - p.branchSpread + (random() - .5) * 18 * variation);
    const length = effectiveBranchLength * (.82 + (random() - .5) * .48 * variation) * (1.08 - vertical * .24);
    const horizontal = Math.cos(elevation) * length;
    const end = start.clone().add(new THREE.Vector3(Math.cos(angle) * horizontal, Math.sin(elevation) * length, Math.sin(angle) * horizontal));
    const branchRadius = usesGenericBranches ? p.branchArrayRadius * (1.08 - vertical * .26) : effectiveTrunkWidth * (.25 + (1 - vertical) * .13) * .5;
    if (usesGenericBranches) addGenerated(geometryNodeCustomSpec(
      geometryNodeCurvedBranchGeometry(start, end, branchRadius, p.branchArrayTaper, Math.max(7, Math.min(18, p.stemSides))),
      { name: `${outputName} Branch array ${index + 1}`, position: [0, 0, 0], color: p.branchColor, group }
    ));
    else addGenerated(geometryNodeSegmentSpec({ shape: "cylinder", name: `${outputName} Branch ${index + 1}`, start, end, width: branchRadius * 2, color: "#603a28", group }));
    branchJoints.push({ position: start.clone(), size: usesGenericBranches ? branchRadius : effectiveTrunkWidth * (.42 - vertical * .08), direction: end.clone().sub(start).normalize() });
    branchTips.push(end);
    if (activeNodes.has("twigs")) {
      const twigStart = start.clone().lerp(end, .62);
      const twigAngle = angle + (random() > .5 ? 1 : -1) * (.45 + random() * .5);
      const twigLength = length * p.twigLength * (.8 + random() * .4);
      const twigEnd = twigStart.clone().add(new THREE.Vector3(Math.cos(twigAngle) * twigLength * .65, twigLength * p.twigRise, Math.sin(twigAngle) * twigLength * .65));
      addGenerated(geometryNodeSegmentSpec({ shape: "cylinder", name: `${outputName} Twig ${index + 1}`, start: twigStart, end: twigEnd, width: effectiveTrunkWidth * .14, color: "#563223", group }));
      branchJoints.push({ position: twigStart, size: effectiveTrunkWidth * .14 });
      branchTips.push(twigEnd);
    }
  }
  if (activeNodes.has("smoothJoints")) {
    const smoothPoints = [...branchJoints];
    if (p.jointTrunkSeams) for (let index = 1; index < trunkPoints.length - 1; index++) {
      smoothPoints.push({ position: trunkPoints[index], size: effectiveTrunkWidth * (1 - index / effectiveTrunkSegments * .52) * .46 });
    }
    smoothPoints.forEach(({ position, size }, index) => addGenerated({
      shape: "sphere", name: `${outputName} Joint blend ${index + 1}`, position: position.toArray(), rotation: [0, 0, 0],
      scale: [size * p.jointSize / .55, size * p.jointSize * 1.28 / .55, size * p.jointSize / .55],
      color: index % 2 ? "#65402d" : "#6b4631", roughness: .84, groupId: group.id, groupName: group.name
    }));
  }
  if (activeNodes.has("junctionBlend")) branchJoints.forEach(({ position, size, direction }, index) => {
    const branchDirection = direction || new THREE.Vector3(0, 1, 0);
    const rotation = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), branchDirection), "XYZ");
    const collarRadius = size * p.junctionBlendSize;
    addGenerated({
      shape: "sphere", name: `${outputName} Junction blend ${index + 1}`,
      position: position.clone().addScaledVector(branchDirection, collarRadius * .32).toArray(),
      rotation: [rotation.x, rotation.y, rotation.z].map(THREE.MathUtils.radToDeg),
      scale: [collarRadius / .55, collarRadius * p.junctionBlendLength / .55, collarRadius / .55],
      color: usesGenericBranches ? p.branchColor : "#65402d", roughness: .82, groupId: group.id, groupName: group.name
    });
  });
  if ((activeNodes.has("canopy") || usesGenericClusters) && (usesGenericClusters || p.canopyEnabled) && (usesGenericClusters || styleProfile.canopy > 0)) {
    const crown = trunkPoints.at(-1);
    const canopyPoints = [crown, ...branchTips.filter((_, index) => index % 2 === 0)];
    const totalClusters = usesGenericClusters ? p.clusterScatterCount : canopyPoints.length * effectiveCanopyDensity;
    for (let clusterIndex = 0; clusterIndex < totalClusters; clusterIndex++) {
        const pointIndex = clusterIndex % canopyPoints.length;
        const density = Math.floor(clusterIndex / canopyPoints.length);
        const point = canopyPoints[pointIndex];
        const sizeBase = usesGenericClusters ? p.clusterScatterSize : effectiveCanopySize;
        const spread = usesGenericClusters ? p.clusterScatterSpread : sizeBase;
        const size = sizeBase * (.88 + (random() - .5) * .42 * variation);
        const position = point.clone().add(new THREE.Vector3((random() - .5) * spread, (random() - .25) * spread * .65, (random() - .5) * spread));
        addGenerated({
          shape: "facetedBallLow", name: `${outputName} ${usesGenericClusters ? "Cluster scatter" : "Canopy"} ${pointIndex + 1}.${density + 1}`,
          position: position.toArray(), rotation: [random() * 35, random() * 360, random() * 35],
          scale: [size * (1 + random() * .24), size * (.85 + random() * .32), size * (1 + random() * .24)],
          color: usesGenericClusters ? p.clusterScatterColor : canopyColors[(pointIndex + density) % canopyColors.length], roughness: .9,
          groupId: group.id, groupName: group.name
        });
        if (!usesGenericClusters && season === "snowy") addGenerated({
          shape: "facetedBallLow", name: `${outputName} Snow ${pointIndex + 1}.${density + 1}`,
          position: position.clone().add(new THREE.Vector3(0, size * .48, 0)).toArray(), rotation: [0, random() * 360, 0],
          scale: [size * .78, size * .24, size * .78], color: density % 2 ? "#f2f5ed" : "#dce8e5", roughness: 1,
          groupId: group.id, groupName: group.name
        });
    }
  }
  if (activeNodes.has("knot")) for (let index = 0; index < p.knotCount; index++) {
    const vertical = .2 + (index + .5) / p.knotCount * .62;
    const segmentIndex = Math.min(effectiveTrunkSegments - 1, Math.floor(vertical * effectiveTrunkSegments));
    const localT = vertical * effectiveTrunkSegments - segmentIndex;
    const taper = 1 - vertical * .52;
    const point = trunkPoints[segmentIndex].clone().lerp(trunkPoints[segmentIndex + 1], localT);
    const angle = index * Math.PI * 2 / p.knotCount + (random() - .5) * .7;
    const radial = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const surfaceRadius = effectiveTrunkWidth * taper * .5;
    const knotRadius = Math.max(.055, effectiveTrunkWidth * taper * p.knotSize);
    const faceCenter = point.clone().addScaledVector(radial, surfaceRadius - p.knotInset);
    const stubStart = point.clone().addScaledVector(radial, Math.max(.02, surfaceRadius - knotRadius * .9));
    addGenerated(geometryNodeSegmentSpec({
      shape: "cylinder", name: `${outputName} Knot ${index + 1} inward branch`, start: stubStart, end: faceCenter.clone().addScaledVector(radial, .012),
      width: knotRadius * 1.7, color: "#583522", group
    }));
    const rotation = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), radial), "XYZ");
    const rotationDegrees = [rotation.x, rotation.y, rotation.z].map(THREE.MathUtils.radToDeg);
    for (let ring = 0; ring < p.knotRings; ring++) {
      const progress = ring / Math.max(1, p.knotRings - 1);
      const radius = knotRadius * (1 - progress * .76);
      addGenerated({
        shape: "cylinder", name: `${outputName} Knot ${index + 1} cut ring ${ring + 1}`,
        position: faceCenter.clone().addScaledVector(radial, .018 + ring * .006).toArray(), rotation: rotationDegrees,
        scale: [radius * 2 / .96, .018, radius * 2 / .96], color: ring % 2 ? "#81502e" : "#c28a4d", roughness: .92,
        groupId: group.id, groupName: group.name
      });
    }
  }
  if (activeNodes.has("cutSurface")) {
    const outerRadius = effectiveTrunkWidth * .52;
    const paleWood = new THREE.Color("#c58b4e");
    const darkWood = new THREE.Color("#694126");
    for (let index = 0; index < p.cutRingCount; index++) {
      const progress = index / Math.max(1, p.cutRingCount - 1);
      const radius = outerRadius * (1 - progress * .86);
      const ringColor = paleWood.clone().lerp(darkWood, (index % 2 ? .3 : .08) + p.cutRingContrast * (index % 2 ? .48 : .16));
      addGenerated({
        shape: "cylinder", name: `${outputName} Cut ring ${index + 1}`,
        position: [trunkPoints[0].x, -p.cutRingDepth * (.52 + index * .12), trunkPoints[0].z], rotation: [0, 0, 0],
        scale: [radius * 2 / .96, p.cutRingDepth, radius * 2 / .96], color: `#${ringColor.getHexString()}`, roughness: .92,
        groupId: group.id, groupName: group.name
      });
    }
  }
  if (activeNodes.has("join") && p.joinAddInnerPanel) {
    const joinedBounds = new THREE.Box3().makeEmpty();
    const wallIds = generated.filter(id => {
      const mesh = lookupMesh(id);
      return mesh && geometryNodeGeneratedTarget(mesh.name) === "stoneWall";
    });
    const boundsIds = wallIds.length ? wallIds : generated.filter(id => {
      const mesh = lookupMesh(id);
      const target = mesh ? geometryNodeGeneratedTarget(mesh.name) : null;
      return target !== "grass" && target !== "moss" && !mesh?.name.includes(" QA ");
    });
    for (const id of boundsIds) {
      const mesh = lookupMesh(id);
      if (mesh) joinedBounds.expandByObject(mesh);
    }
    const panel = geometryNodeInnerPanelSpec(joinedBounds, {
      name: `${outputName} Join inner panel`,
      color: p.joinPanelColor,
      group,
      roughness: .95,
      inset: p.joinPanelInset,
      axis: p.joinPanelAxis
    });
    if (panel) addGenerated(panel);
  }
  for (const id of generated) {
    const mesh = lookupMesh(id);
    if (!mesh || mesh.name.includes(" QA ")) continue;
    const targetId = mesh.userData.geometryNodeSourceId || geometryNodeGeneratedTarget(mesh.name);
    const modifiers = targetId ? geometryNodeSmoothModifiers(graph, targetId, activeNodeIds) : [];
    if (!modifiers.length) continue;
    mesh.geometry = geometryNodeApplySmoothModifiers(mesh.geometry, modifiers);
    mesh.userData.shape = "custom";
    mesh.userData.geometry = geometryToData(mesh.geometry);
  }
  if (activeNodes.has("transform")) {
    const offset = new THREE.Vector3(p.transformX, p.transformY, p.transformZ);
    for (const id of generated) {
      const mesh = lookupMesh(id);
      if (!mesh) continue;
      mesh.position.multiplyScalar(p.transformScale).add(offset);
      mesh.scale.multiplyScalar(p.transformScale);
      mesh.rotation.x += THREE.MathUtils.degToRad(p.transformRotX);
      mesh.rotation.y += THREE.MathUtils.degToRad(p.transformRotY);
      mesh.rotation.z += THREE.MathUtils.degToRad(p.transformRotZ);
    }
  }
  if (graph.centerOutput && generated.length) {
    const bounds = new THREE.Box3().makeEmpty();
    const meshes = generated.map(id => lookupMesh(id)).filter(Boolean);
    for (const mesh of meshes) { mesh.updateWorldMatrix(true, false); bounds.expandByObject(mesh); }
    if (!bounds.isEmpty() && [bounds.min.x,bounds.min.y,bounds.min.z,bounds.max.x,bounds.max.y,bounds.max.z].every(Number.isFinite)) {
      const middle = bounds.getCenter(new THREE.Vector3());
      const shift = new THREE.Vector3(middle.x, bounds.min.y, middle.z);
      for (const mesh of meshes) {
        const position = mesh.getWorldPosition(new THREE.Vector3()).sub(shift);
        if (mesh.parent) mesh.parent.worldToLocal(position);
        mesh.position.copy(position); mesh.updateMatrixWorld(true);
      }
    }
  }
  if(previewOnly){for(const surface of natureSurfaces)surface.geometry?.dispose();return [...previewMeshes.values()];}
  graph.generatedIds = generated;
  saveGeometryNodeDraft();
  updateAll();
  renderGeometryNodeEditor();
  log(`Built ${outputName} from its Geometry Nodes graph.`, { parts: generated.length, seed: graph.seed, nodes: graph.nodeOrder.length, canopy: activeNodes.has("canopy") && p.canopyEnabled });
}

function bakeGeometryNodeTree() {
  const graph = activeGeometryNodeGraph();
  if (!graph || !graph.generatedIds.length) return;
  const count = graph.generatedIds.length;
  graph.generatedIds = [];
  saveGeometryNodeDraft();
  renderGeometryNodeEditor();
  log(`Baked ${count} generated geometry parts. They are now ordinary editable BWS objects; the graph remains saved for future builds.`);
}

function deleteGeometryNodeGraph() {
  const graph = activeGeometryNodeGraph();
  if (!graph) return;
  if (geometryNodePendingDeleteId !== graph.id) {
    geometryNodePendingDeleteId = graph.id;
    renderGeometryNodeEditor();
    setGeometryNodeStatus('Click Confirm delete graph to remove "' + graph.name + '". Scene models are kept. Switch graphs to cancel.');
    return;
  }
  recordHistory("delete geometry node graph");
  geometryNodeProjectState.graphs = geometryNodeProjectState.graphs.filter(item => item.id !== graph.id);
  geometryNodeProjectState.activeGraphId = geometryNodeProjectState.graphs[0]?.id || null;
  geometryNodePendingDeleteId = null;
  saveGeometryNodeDraft();
  renderGeometryNodeEditor();
  log('Deleted Geometry Nodes graph ' + graph.name + '. Scene objects were kept.');
}

function createGeometryNodeGraph() { createGeometryNodeBoard(false); }
function createGeometryTreeTemplate() { createGeometryNodeBoard(true); }
function createGeometryHouseTemplate() {
  if(geometryNodeProjectState.graphs.length>=24){setGeometryNodeStatus("Graph limit reached. Save/delete an unused graph first.");return;}
  recordHistory("new house template graph");
  const graph=defaultGeometryNodeGraph("Timber house");
  graph.nodeOrder=["seed","houseLayout","floor","window","window::2","door","diagonalBracing","foundation","facadeDetails","balcony","staircase","roof","chimney","output"];
  graph.nodeParams["window::2"]={...graph.params,windowLevel:1,windowWidth:.8};
  graph.connections=graph.nodeOrder.slice(0,-1).map((fromNodeId,i)=>({id:geometryNodeId("link"),fromNodeId,toNodeId:graph.nodeOrder[i+1],toInputIndex:0}));
  graph.nodeOrder.forEach((id,i)=>{graph.nodePositions[id]=[40+i*190,60];});
  graph.centerOutput=true;
  geometryNodePendingDeleteId=null;
  geometryNodeProjectState.graphs.push(graph);geometryNodeProjectState.activeGraphId=graph.id;
  saveGeometryNodeDraft();renderGeometryNodeEditor();
}
function createGeometryNodeBoard(useTree) {
  if (geometryNodeProjectState.graphs.length >= 24) { setGeometryNodeStatus("Graph limit reached. Save and delete an unused graph first."); return; }
  recordHistory(useTree ? "new tree template graph" : "new empty geometry graph");
  const name = (useTree ? "Tree template " : "Untitled Geometry ") + (geometryNodeProjectState.graphs.length + 1);
  const graph = useTree ? defaultGeometryNodeGraph(name) : defaultEmptyGeometryNodeProjectState().graphs[0];
  graph.name = name; graph.params.outputName = name;
  geometryNodePendingDeleteId = null;
  geometryNodeProjectState.graphs.push(graph);
  geometryNodeProjectState.activeGraphId = graph.id;
  saveGeometryNodeDraft();
  renderGeometryNodeEditor();
}

function geometryNodePosition(graph, nodeId) {
  return graph.smoothNodes.find(node => node.id === nodeId)?.position || graph.nodePositions[nodeId] || [18, 42];
}

function geometryNodeHasPath(graph, fromNodeId, toNodeId) {
  const stack = [fromNodeId];
  const visited = new Set();
  while (stack.length) {
    const current = stack.pop();
    if (current === toNodeId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    graph.connections.filter(connection => connection.fromNodeId === current).forEach(connection => stack.push(connection.toNodeId));
  }
  return false;
}

function connectGeometryNodes(fromNodeId, toNodeId, requestedInputIndex = 0) {
  const graph = activeGeometryNodeGraph();
  const fromType = graph && geometryNodeTypeForId(graph, fromNodeId);
  const toType = graph && geometryNodeTypeForId(graph, toNodeId);
  const fromDefinition = GEOMETRY_NODE_DEFINITIONS[fromType] || { output: "Geometry" };
  const toDefinition = GEOMETRY_NODE_DEFINITIONS[toType] || { input: "Geometry" };
  if (!graph || !fromType || !toType || fromNodeId === toNodeId || !fromDefinition.output || !toDefinition.input) return false;
  const inputLabels = toDefinition.inputSockets || [toDefinition.input];
  const toInputIndex = Math.max(0, Math.min(inputLabels.length - 1, Number(requestedInputIndex) || 0));
  const expectedInput = inputLabels[toInputIndex];
  const expectsTexture = /^Texture(?: [2-4])?$/.test(expectedInput) || ["Upper", "Middle", "Bottom", "Overall"].includes(expectedInput);
  if ((fromDefinition.output === "Texture" || expectsTexture) && (fromDefinition.output !== "Texture" || !expectsTexture)) return false;
  if (["Upper", "Middle", "Bottom", "Overall"].includes(expectedInput) && fromDefinition.output !== "Texture") return false;
  if ((fromDefinition.output === "Seed" || expectedInput === "Seed") && fromDefinition.output !== expectedInput) return false;
  if (geometryNodeHasPath(graph, toNodeId, fromNodeId)) return false;
  if (graph.connections.some(connection => connection.fromNodeId === fromNodeId && connection.toNodeId === toNodeId && (Number(connection.toInputIndex) || 0) === toInputIndex)) return true;
  graph.connections = graph.connections.filter(connection => connection.toNodeId !== toNodeId || (Number(connection.toInputIndex) || 0) !== toInputIndex);
  graph.connections.push({ id: geometryNodeId("link"), fromNodeId, toNodeId, toInputIndex });
  const smoothNode = graph.smoothNodes.find(node => node.id === toNodeId);
  if (smoothNode) smoothNode.targetId = geometryNodeResolvedSourceId(graph, fromNodeId);
  saveGeometryNodeDraft();
  renderGeometryNodeEditor();
  return true;
}

function disconnectGeometryNodeLink(linkId) {
  const graph = activeGeometryNodeGraph();
  if (!graph || !graph.connections.some(connection => connection.id === linkId)) return;
  graph.connections = graph.connections.filter(connection => connection.id !== linkId);
  saveGeometryNodeDraft();
  renderGeometryNodeEditor();
}

function geometryNodeFindOpenPosition(graph, preferred = null) {
  const occupied = [...graph.nodeOrder.map(id => geometryNodePosition(graph, id)), ...graph.smoothNodes.map(node => node.position)];
  const collides = point => occupied.some(other => Math.abs(other[0] - point[0]) < 174 && Math.abs(other[1] - point[1]) < 235);
  if (preferred) {
    const point = [...preferred];
    for (let attempt = 0; attempt < 24 && collides(point); attempt++) {
      point[1] += 245;
      if (point[1] > 1900) { point[1] = 70 + (attempt % 3) * 245; point[0] += 190; }
    }
    return point;
  }
  for (let row = 0; row < 9; row++) for (let column = 0; column < 18; column++) {
    const point = [70 + column * 190, 70 + row * 245];
    if (!collides(point)) return point;
  }
  return [120, 2100];
}

function addGeometryNodeType(type, position = null) {
  const graph = activeGeometryNodeGraph();
  if (!graph || !GEOMETRY_NODE_DEFINITIONS[type]) return;
  if (type === "smoothGeometry") {
    addGeometryNodeModifier(null, type, position, false);
    return;
  }
  const instanceCount = graph.nodeOrder.filter(nodeId => geometryNodeTypeForId(graph, nodeId) === type).length;
  const nodeId = instanceCount ? `${type}::${instanceCount + 1}` : type;
  if (instanceCount) {
    graph.nodeParams ||= {};
    graph.nodeParams[nodeId] = { ...graph.params };
    if (type === "textureInput") Object.assign(graph.nodeParams[nodeId], { textureName: "", textureData: "", textureRandomize: true, textureVariation: 1 });
  }
  const canonicalIndex = GEOMETRY_NODE_TYPES.indexOf(type);
  const insertIndex = graph.nodeOrder.findIndex(existingId => GEOMETRY_NODE_TYPES.indexOf(geometryNodeTypeForId(graph, existingId)) > canonicalIndex);
  graph.nodeOrder.splice(insertIndex >= 0 ? insertIndex : graph.nodeOrder.length, 0, nodeId);
  graph.nodePositions[nodeId] = geometryNodeFindOpenPosition(graph, position);
  saveGeometryNodeDraft();
  renderGeometryNodeEditor();
  return nodeId;
}

function addGeometryNodeModifier(targetId = null, type = "smoothGeometry", position = null, insertIntoFlow = true) {
  const graph = activeGeometryNodeGraph();
  const targetType = graph && targetId ? geometryNodeTypeForId(graph, targetId) : null;
  if (!graph || type !== "smoothGeometry" || (targetId && (!targetType || !GEOMETRY_NODE_DEFINITIONS[targetType].output))) return;
  const targetPosition = targetId ? geometryNodePosition(graph, targetId) : [260, 240];
  const siblings = targetId ? graph.smoothNodes.filter(node => node.targetId === geometryNodeResolvedSourceId(graph, targetId)) : [];
  const node = {
    id: geometryNodeId("smooth"),
    targetId: targetId ? geometryNodeResolvedSourceId(graph, targetId) : null,
    position: geometryNodeFindOpenPosition(graph, position || [Math.min(4200, targetPosition[0] + 190 + siblings.length * 26), Math.min(2200, targetPosition[1] + siblings.length * 38)]),
    params: { axis: "xyz", iterations: 2, strength: .72, preserveSize: true }
  };
  graph.smoothNodes.push(node);
  if (targetId && insertIntoFlow) {
    const outgoing = graph.connections.find(connection => connection.fromNodeId === targetId);
    if (outgoing) {
      graph.connections = graph.connections.filter(connection => connection.id !== outgoing.id);
      graph.connections.push({ id: geometryNodeId("link"), fromNodeId: node.id, toNodeId: outgoing.toNodeId });
    }
    graph.connections.push({ id: geometryNodeId("link"), fromNodeId: targetId, toNodeId: node.id });
  }
  saveGeometryNodeDraft();
  renderGeometryNodeEditor();
}

function removeGeometryNodeType(nodeId) {
  const graph = activeGeometryNodeGraph();
  if (!graph) return;
  if (graph.smoothNodes.some(node => node.id === nodeId)) graph.smoothNodes = graph.smoothNodes.filter(node => node.id !== nodeId);
  else if (graph.nodeOrder.includes(nodeId)) graph.nodeOrder = graph.nodeOrder.filter(nodeType => nodeType !== nodeId);
  else return;
  graph.connections = graph.connections.filter(connection => connection.fromNodeId !== nodeId && connection.toNodeId !== nodeId);
  saveGeometryNodeDraft();
  renderGeometryNodeEditor();
}

function closeGeometryNodeContextMenu(doc) {
  doc?.querySelector(".geometry-node-context-menu")?.remove();
}

function mountGeometryNodeContextMenu(doc, html, clientX, clientY) {
  closeGeometryNodeContextMenu(doc);
  const menu = doc.createElement("div");
  menu.className = "geometry-node-context-menu";
  menu.setAttribute("role", "menu");
  menu.innerHTML = html;
  if (menu.querySelector(".geometry-node-context-library")) menu.classList.add("geometry-node-library-menu");
  doc.body.append(menu);
  const fitMenu = () => {
    const viewportWidth = doc.defaultView?.innerWidth || 1024;
    const viewportHeight = doc.defaultView?.innerHeight || 768;
    const bounds = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(clientX, viewportWidth - bounds.width - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(clientY, viewportHeight - bounds.height - 8))}px`;
  };
  fitMenu();
  menu.querySelectorAll("details").forEach(details => details.addEventListener("toggle", () => doc.defaultView?.requestAnimationFrame(fitMenu)));
}

function openGeometryNodeContextMenu(doc, card, clientX, clientY) {
  const graph = activeGeometryNodeGraph();
  const targetId = card?.dataset.geometryNode;
  const targetType = card?.dataset.geometryNodeType;
  const definition = GEOMETRY_NODE_DEFINITIONS[targetType];
  if (!graph || !targetId || !definition) return;
  const position = geometryNodePosition(graph, targetId);
  const attachedCount = graph.smoothNodes.filter(node => geometryNodeResolvedSourceId(graph, node.id) === geometryNodeResolvedSourceId(graph, targetId)).length;
  const compatibleTypes = definition.output ? GEOMETRY_NODE_TYPES.filter(type => {
    const candidate = GEOMETRY_NODE_DEFINITIONS[type];
    if (!candidate.input || type === targetType || type === "output") return false;
    return type === "smoothGeometry" || candidate.input === definition.output || candidate.input === "Geometry" || definition.output === "Geometry";
  }) : [];
  const compatibleButtons = compatibleTypes.map(type => `<button type="button" role="menuitem" data-geometry-attach-type="${type}" data-geometry-target-node="${geometryNodeEscape(targetId)}">+ ${geometryNodeEscape(GEOMETRY_NODE_DEFINITIONS[type].title)}</button>`).join("");
  const actions = definition.output
    ? `<span class="geometry-node-context-label">Connect or modify</span><button type="button" role="menuitem" data-geometry-start-link="${geometryNodeEscape(targetId)}">+ Draw connection</button>${compatibleButtons || '<span class="geometry-node-context-note">No unused compatible cards.</span>'}`
    : `<span class="geometry-node-context-note">This node has no output socket.</span>`;
  mountGeometryNodeContextMenu(doc, `<strong>${geometryNodeEscape(definition.title)}</strong>${actions}<details><summary>Advanced values</summary><dl><dt>Node ID</dt><dd>${geometryNodeEscape(targetId)}</dd><dt>Input</dt><dd>${geometryNodeEscape(definition.input || "None")}</dd><dt>Output</dt><dd>${geometryNodeEscape(definition.output || "None")}</dd><dt>Position</dt><dd>X ${Math.round(position[0])}, Y ${Math.round(position[1])}</dd><dt>Incoming</dt><dd>${graph.connections.filter(connection => connection.toNodeId === targetId).length}</dd><dt>Outgoing</dt><dd>${graph.connections.filter(connection => connection.fromNodeId === targetId).length}</dd><dt>Modifiers</dt><dd>${attachedCount}</dd></dl></details>`, clientX, clientY);
}

function openGeometryNodeBoardMenu(doc, canvasPoint, clientX, clientY) {
  const graph = activeGeometryNodeGraph();
  if (!graph) return;
  const categories = [...new Set(GEOMETRY_NODE_TYPES.map(type => GEOMETRY_NODE_DEFINITIONS[type].category))];
  const list = categories.map(category => `<section><span class="geometry-node-context-label">${category}</span>${GEOMETRY_NODE_TYPES.filter(type => GEOMETRY_NODE_DEFINITIONS[type].category === category).map(type => {
    const count = graph.nodeOrder.filter(nodeId => geometryNodeTypeForId(graph, nodeId) === type).length;
    return `<button type="button" data-geometry-add-node="${type}" data-geometry-add-x="${Math.round(canvasPoint[0])}" data-geometry-add-y="${Math.round(canvasPoint[1])}">+ ${geometryNodeEscape(GEOMETRY_NODE_DEFINITIONS[type].title)}${count ? ` (${count})` : ""}</button>`;
  }).join("")}</section>`).join("");
  mountGeometryNodeContextMenu(doc, `<strong>Add node here</strong><div class="geometry-node-context-library">${list}</div>`, clientX, clientY);
}

function openGeometryNodeLinkMenu(doc, linkId, clientX, clientY) {
  mountGeometryNodeContextMenu(doc, `<strong>Connection</strong><button type="button" class="danger" data-geometry-disconnect="${geometryNodeEscape(linkId)}">Disconnect</button>`, clientX, clientY);
}

function geometryNodeCanvasPoint(canvas, clientX, clientY) {
  const graph = activeGeometryNodeGraph();
  if (canvas?.id === GEOMETRY_NODE_SURFACE_IDS.detached.canvas && graph) {
    const viewportBounds = canvas.parentElement.getBoundingClientRect();
    const scale = Math.max(.01, Number(graph.view?.scale) || 1);
    return [
      Math.max(0, (clientX - viewportBounds.left - (Number(graph.view?.x) || 0)) / scale),
      Math.max(0, (clientY - viewportBounds.top - (Number(graph.view?.y) || 0)) / scale)
    ];
  }
  const bounds = canvas.getBoundingClientRect();
  return [
    (clientX - bounds.left) * canvas.offsetWidth / Math.max(1, bounds.width),
    (clientY - bounds.top) * canvas.offsetHeight / Math.max(1, bounds.height)
  ];
}

function startGeometryNodeConnection(doc, canvas, nodeId) {
  const interaction = geometryNodeInteractionByDocument.get(doc);
  if (!interaction) return;
  interaction.pendingFrom = nodeId;
  interaction.pointer = geometryNodePortPoint(canvas, nodeId, "output") || geometryNodePosition(activeGeometryNodeGraph(), nodeId);
  canvas.querySelectorAll(".geometry-node-port.output").forEach(port => port.classList.toggle("connecting", port.dataset.geometryConnectFrom === nodeId));
  renderGeometryNodeLinks(canvas, activeGeometryNodeGraph(), doc);
}

function cancelGeometryNodeConnection(doc, canvas) {
  const interaction = geometryNodeInteractionByDocument.get(doc);
  if (!interaction) return;
  interaction.pendingFrom = null;
  interaction.pointer = null;
  canvas?.querySelectorAll(".geometry-node-port.connecting").forEach(port => port.classList.remove("connecting"));
  if (canvas) renderGeometryNodeLinks(canvas, activeGeometryNodeGraph(), doc);
}

function fitGeometryNodeDetachedView(graph, viewport) {
  const points = [...graph.nodeOrder.map(id => geometryNodePosition(graph, id)), ...graph.smoothNodes.map(node => node.position)];
  if (!points.length || !viewport) return;
  const minX = Math.min(...points.map(point => point[0])) - 45;
  const minY = Math.min(...points.map(point => point[1])) - 45;
  const maxX = Math.max(...points.map(point => point[0])) + 205;
  const maxY = Math.max(...points.map(point => point[1])) + 300;
  const scale = Math.max(.25, Math.min(1.5, Math.min((viewport.clientWidth - 24) / Math.max(1, maxX - minX), (viewport.clientHeight - 24) / Math.max(1, maxY - minY))));
  graph.view.scale = scale;
  graph.view.x = (viewport.clientWidth - (maxX - minX) * scale) / 2 - minX * scale;
  graph.view.y = (viewport.clientHeight - (maxY - minY) * scale) / 2 - minY * scale;
}

function updateGeometryNodeDetachedView(surface, graph, doc) {
  if (!surface?.canvas || !graph) return;
  surface.canvas.style.transform = `translate(${graph.view.x}px, ${graph.view.y}px) scale(${graph.view.scale})`;
  surface.canvas.style.transformOrigin = "top left";
  const label = surface.root?.querySelector("[data-geometry-zoom-label]");
  if (label) label.textContent = `${Math.round(graph.view.scale * 100)}%`;
  doc.defaultView?.requestAnimationFrame(() => {renderGeometryNodeLinks(surface.canvas, graph, doc);geometryNodeRefreshRulers(surface.canvas);});
}

function renderGeometryNodeMirror(sourceKind) {
  if (sourceKind === "detached") renderGeometryNodeSurface(document, "sidebar");
  else {
    const detachedWindow = liveGeometryNodesDetachedWindow();
    if (detachedWindow) renderGeometryNodeSurface(detachedWindow.document, "detached");
  }
}

function bindGeometryNodeSurface(doc, kind = "sidebar") {
  const surface = geometryNodeSurface(doc, kind);
  if (!surface?.root || surface.root.dataset.geometryNodesBound === "true") return;
  surface.root.dataset.geometryNodesBound = "true";
  const interaction = { pendingFrom: null, pointer: null, spaceKey: false };
  geometryNodeInteractionByDocument.set(doc, interaction);
  surface.newButton?.addEventListener("click", createGeometryNodeGraph);
  surface.root.querySelector("[data-geometry-tree-template]")?.addEventListener("click", createGeometryTreeTemplate);
  surface.root.querySelector("[data-geometry-house-template]")?.addEventListener("click", createGeometryHouseTemplate);
  surface.buildButton?.addEventListener("click", buildGeometryNodeTree);
  surface.root.querySelector("[data-geometry-center-output]")?.addEventListener("click", () => buildGeometryNodeTree({centerOutput:true}));
  surface.bakeButton?.addEventListener("click", bakeGeometryNodeTree);
  surface.deleteButton?.addEventListener("click", deleteGeometryNodeGraph);
  surface.copyButton?.addEventListener("click", () => copyGeometryNodeClusterString(doc));
  surface.pasteButton?.addEventListener("click", () => pasteGeometryNodeClusterString(doc));
  surface.saveClusterButton?.addEventListener("click", () => saveGeometryNodeClusterFile(doc));
  surface.loadClusterButton?.addEventListener("click", () => surface.fileInput?.click());
  surface.fileInput?.addEventListener("change", async event => {
    await loadGeometryNodeClusterFile(event.target.files?.[0]);
    event.target.value = "";
  });
  surface.root.addEventListener("click", event => {
    const graph = activeGeometryNodeGraph();
    const wallCopy = event.target.closest("[data-geometry-wall-copy]");
    if (wallCopy && graph) {
      const nodeId=wallCopy.dataset.geometryWallCopy;
      const values=graph.nodeParams?.[nodeId] || graph.params;
      const count=assetNodeSanitize(values).brickCopies;
      if(count>=12){setGeometryNodeStatus("Maximum 12 wall copies per node. Use fewer bricks for larger repeats.");return;}
      values.brickCopies=count+1;
      values.brickRepeat=true;
      saveGeometryNodeDraft();
      renderGeometryNodeEditor();
      buildGeometryNodeTree();
      return;
    }
    const outputPort = event.target.closest("[data-geometry-connect-from]");
    if (outputPort) {
      startGeometryNodeConnection(doc, surface.canvas, outputPort.dataset.geometryConnectFrom);
      return;
    }
    const inputPort = event.target.closest("[data-geometry-connect-to]");
    if (inputPort && interaction.pendingFrom) {
      const fromNodeId = interaction.pendingFrom;
      cancelGeometryNodeConnection(doc, surface.canvas);
      connectGeometryNodes(fromNodeId, inputPort.dataset.geometryConnectTo, Number(inputPort.dataset.geometryInputIndex) || 0);
      return;
    }
    const viewButton = event.target.closest("[data-geometry-view]");
    if (viewButton && graph && kind === "detached") {
      if (viewButton.dataset.geometryView === "fit") fitGeometryNodeDetachedView(graph, surface.canvas.parentElement);
      else {
        const factor = viewButton.dataset.geometryView === "zoom-in" ? 1.2 : 1 / 1.2;
        graph.view.scale = geometryNodeNumber(graph.view.scale * factor, graph.view.scale, .25, 2.5);
      }
      updateGeometryNodeDetachedView(surface, graph, doc);
      saveGeometryNodeDraft();
      return;
    }
    const addButton = event.target.closest("[data-geometry-add-node]");
    if (addButton) {
      const x = Number(addButton.dataset.geometryAddX);
      const y = Number(addButton.dataset.geometryAddY);
      addGeometryNodeType(addButton.dataset.geometryAddNode, Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null);
      return;
    }
    const removeButton = event.target.closest("[data-geometry-remove-node]");
    if (removeButton) removeGeometryNodeType(removeButton.dataset.geometryRemoveNode);
  });
  doc.addEventListener("click", event => {
    const menu = event.target.closest(".geometry-node-context-menu");
    if (!menu) return;
    const attachButton = event.target.closest("[data-geometry-attach-type]");
    const startButton = event.target.closest("[data-geometry-start-link]");
    const addButton = event.target.closest("[data-geometry-add-node]");
    const disconnectButton = event.target.closest("[data-geometry-disconnect]");
    if (attachButton) {
      const targetId = attachButton.dataset.geometryTargetNode;
      const type = attachButton.dataset.geometryAttachType;
      if (type === "smoothGeometry") addGeometryNodeModifier(targetId, type);
      else {
        const targetPosition = geometryNodePosition(activeGeometryNodeGraph(), targetId);
        const addedId = addGeometryNodeType(type, [targetPosition[0] + 190, targetPosition[1] + 245]);
        connectGeometryNodes(targetId, addedId || type);
      }
    }
    else if (startButton) startGeometryNodeConnection(doc, surface.canvas, startButton.dataset.geometryStartLink);
    else if (addButton) addGeometryNodeType(addButton.dataset.geometryAddNode, [Number(addButton.dataset.geometryAddX), Number(addButton.dataset.geometryAddY)]);
    else if (disconnectButton) disconnectGeometryNodeLink(disconnectButton.dataset.geometryDisconnect);
    if (attachButton || startButton || addButton || disconnectButton) closeGeometryNodeContextMenu(doc);
  });
  surface.select?.addEventListener("change", event => {
    geometryNodePendingDeleteId = null;
    geometryNodeProjectState.activeGraphId = event.target.value;
    saveGeometryNodeDraft();
    renderGeometryNodeEditor();
  });
  const canvas = surface.canvas;
  surface.root.addEventListener("contextmenu", event => {
    event.preventDefault();
    const link = event.target.closest("[data-geometry-link]");
    if (link) {
      openGeometryNodeLinkMenu(doc, link.dataset.geometryLink, event.clientX, event.clientY);
      return;
    }
    const card = event.target.closest(".geometry-node-card");
    if (card) {
      openGeometryNodeContextMenu(doc, card, event.clientX, event.clientY);
      return;
    }
    if (event.target.closest(".geometry-node-canvas")) openGeometryNodeBoardMenu(doc, geometryNodeCanvasPoint(surface.canvas, event.clientX, event.clientY), event.clientX, event.clientY);
  });
  doc.addEventListener("contextmenu", event => event.preventDefault());
  doc.addEventListener("pointerdown", event => {
    if (!event.target.closest(".geometry-node-context-menu")) closeGeometryNodeContextMenu(doc);
  });
  doc.addEventListener("keydown", event => {
    if (event.code === "Space" && !event.target.matches("input,select,textarea")) interaction.spaceKey = true;
    if (event.key === "Escape") {
      closeGeometryNodeContextMenu(doc);
      cancelGeometryNodeConnection(doc, canvas);
    }
  });
  doc.addEventListener("keyup", event => { if (event.code === "Space") interaction.spaceKey = false; });
  doc.defaultView?.addEventListener("blur", () => { interaction.spaceKey = false; });
  canvas?.addEventListener("pointermove", event => {
    if (!interaction.pendingFrom) return;
    interaction.pointer = geometryNodeCanvasPoint(canvas, event.clientX, event.clientY);
    renderGeometryNodeLinks(canvas, activeGeometryNodeGraph(), doc);
  });
  if (kind === "detached") {
    const viewport = canvas?.parentElement;
    viewport?.addEventListener("wheel", event => {
      event.preventDefault();
      const graph = activeGeometryNodeGraph();
      if (!graph) return;
      const before = geometryNodeCanvasPoint(canvas, event.clientX, event.clientY);
      const oldScale = graph.view.scale;
      graph.view.scale = geometryNodeNumber(oldScale * Math.exp(-event.deltaY * .0012), oldScale, .25, 2.5);
      graph.view.x += before[0] * (oldScale - graph.view.scale);
      graph.view.y += before[1] * (oldScale - graph.view.scale);
      updateGeometryNodeDetachedView(surface, graph, doc);
      saveGeometryNodeDraft();
    }, { passive: false });
    viewport?.addEventListener("pointerdown", event => {
      const shouldPan = event.button === 1 || (event.button === 0 && interaction.spaceKey && !event.target.closest(".geometry-node-card"));
      const graph = activeGeometryNodeGraph();
      if (!shouldPan || !graph) return;
      event.preventDefault();
      const start = [event.clientX, event.clientY];
      const origin = [graph.view.x, graph.view.y];
      viewport.setPointerCapture?.(event.pointerId);
      const move = moveEvent => {
        graph.view.x = origin[0] + moveEvent.clientX - start[0];
        graph.view.y = origin[1] + moveEvent.clientY - start[1];
        updateGeometryNodeDetachedView(surface, graph, doc);
      };
      const finish = () => {
        viewport.removeEventListener("pointermove", move);
        viewport.removeEventListener("pointerup", finish);
        viewport.removeEventListener("pointercancel", finish);
        saveGeometryNodeDraft();
      };
      viewport.addEventListener("pointermove", move);
      viewport.addEventListener("pointerup", finish);
      viewport.addEventListener("pointercancel", finish);
    });
  }
  canvas?.addEventListener("input", event => {
    const input = event.target.closest("[data-geometry-param]");
    const graph = activeGeometryNodeGraph();
    if (!input || !graph) return;
    const key = input.dataset.geometryParam;
    const value = input.type === "checkbox" ? input.checked : (input.type === "number" ? Number(input.value) : input.value);
    const instanceId = input.dataset.geometryInstanceParam;
    if (instanceId) {
      const modifier = graph.smoothNodes.find(node => node.id === instanceId);
      if (modifier) modifier.params[key] = value;
      else if (graph.nodeParams?.[instanceId]) graph.nodeParams[instanceId][key] = value;
      else graph.params[key] = value;
    } else if (key === "seed") graph.seed = Math.round(geometryNodeNumber(value, graph.seed, 0, 999999));
    else graph.params[key] = value;
    if (key === "outputName" && String(value).trim()) graph.name = String(value).trim().slice(0, 80);
    saveGeometryNodeDraft();
    renderGeometryNodeMirror(kind);
  });
  canvas?.addEventListener("change", event => {
    const input = event.target.closest("[data-geometry-param]");
    if (input && (input.type !== "checkbox" || !event.defaultPrevented)) input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  canvas?.addEventListener("change", event => {
    const textureInput = event.target.closest("[data-geometry-texture-input]");
    const graph = activeGeometryNodeGraph();
    if (!textureInput || !graph) return;
    const file = textureInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const instanceId = textureInput.dataset.geometryTextureInstance;
      const target = instanceId && instanceId !== "textureInput" ? graph.nodeParams?.[instanceId] : graph.params;
      if (!target || typeof reader.result !== "string" || !reader.result.startsWith("data:image/")) return;
      target.textureName = file.name.slice(0, 160);
      target.textureData = reader.result;
      saveGeometryNodeDraft();
      renderGeometryNodeEditor();
    };
    reader.onerror = () => {
      const status = document.querySelector("[data-geometry-texture-name]");
      if (status) status.textContent = "Texture import failed";
    };
    reader.readAsDataURL(file);
  });
  canvas?.addEventListener("pointerdown", event => {
    if (event.target.closest("[data-geometry-remove-node]")) return;
    const handle = event.target.closest("[data-geometry-drag]");
    const graph = activeGeometryNodeGraph();
    if (!handle || !graph || event.button !== 0) return;
    const nodeId = handle.dataset.geometryDrag;
    const card = handle.closest(".geometry-node-card");
    const modifier = graph.smoothNodes.find(node => node.id === nodeId);
    const origin = [...(modifier?.position || graph.nodePositions[nodeId])];
    const start = [event.clientX, event.clientY];
    handle.setPointerCapture(event.pointerId);
    const move = moveEvent => {
      const scale = canvas.getBoundingClientRect().width / Math.max(1,canvas.offsetWidth);
      const x = geometryNodeNumber(origin[0] + (moveEvent.clientX - start[0]) / scale, origin[0], 0, Number.MAX_SAFE_INTEGER);
      const y = geometryNodeNumber(origin[1] + (moveEvent.clientY - start[1]) / scale, origin[1], 0, Number.MAX_SAFE_INTEGER);
      if (modifier) modifier.position = [x, y];
      else graph.nodePositions[nodeId] = [x, y];
      card.style.left = `${x}px`;
      card.style.top = `${y}px`;
      geometryNodeExpandCanvas(canvas);
      renderGeometryNodeLinks(canvas, graph, doc);
      geometryNodeRefreshRulers(canvas,[x,y]);
    };
    const finish = () => {
      geometryNodeRefreshRulers(canvas);
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", finish);
      handle.removeEventListener("pointercancel", finish);
      saveGeometryNodeDraft();
      renderGeometryNodeMirror(kind);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", finish);
    handle.addEventListener("pointercancel", finish);
  });
}

function initializeGeometryNodes() {
  if (geometryNodesInitialized) return;
  geometryNodesInitialized = true;
  bindGeometryNodeSurface(document, "sidebar");
  document.querySelector("#geometryNodeDetachBtn")?.addEventListener("click", openGeometryNodesDetachedWindow);
  if (typeof ResizeObserver === "function") new ResizeObserver(fitGeometryNodeSidebarOverview).observe(document.getElementById("geometryNodeViewport"));
  else window.addEventListener("resize", fitGeometryNodeSidebarOverview);
  window.addEventListener("beforeunload", () => liveGeometryNodesDetachedWindow()?.close());
}

function setGeometryNodesPluginEnabled(enabled) {
  geometryNodesRuntimeEnabled = !!enabled;
  initializeGeometryNodes();
  if (!geometryNodesRuntimeEnabled) liveGeometryNodesDetachedWindow()?.close();
  renderGeometryNodeEditor();
}

setGeometryNodesPluginEnabled(pluginManifestById("geometry-nodes")?.enabled === true);

const geometryNodeLayoutSeen=new WeakSet();
function geometryNodeLayoutPrefs(){try{const p=JSON.parse(localStorage.getItem("bws-node-layout")||"{}");return {x:Math.max(20,Math.min(400,Number(p.x)||70)),y:Math.max(20,Math.min(400,Number(p.y)||70))};}catch{return {x:70,y:70};}}
function geometryNodeInstallLayoutTools(surface,doc){
if(surface.root.querySelector("[data-node-layout-tools]"))return;const p=geometryNodeLayoutPrefs(),bar=doc.createElement("div");bar.dataset.nodeLayoutTools="true";bar.style.cssText="display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:6px 0";
const button=doc.createElement("button");button.type="button";button.textContent="Arrange nodes";bar.appendChild(button);
for(const key of ["x","y"]){const label=doc.createElement("label");label.textContent=(key==="x"?"Horizontal":"Vertical")+" padding ";const input=doc.createElement("input");input.type="number";input.min="20";input.max="400";input.step="10";input.value=p[key];input.dataset.layoutAxis=key;input.style.width="65px";label.appendChild(input);bar.appendChild(label);}
const arrange=()=>{const graph=activeGeometryNodeGraph();if(graph)geometryNodeArrangeMeasured(surface,graph);};button.addEventListener("click",arrange);bar.addEventListener("change",()=>{const values={};for(const input of bar.querySelectorAll("input")){const value=Math.max(20,Math.min(400,Number(input.value)||70));input.value=value;values[input.dataset.layoutAxis]=value;}try{localStorage.setItem("bws-node-layout",JSON.stringify(values));}catch{}arrange();});
(surface.root.querySelector(".geometry-node-actions")||surface.root.querySelector(".geometry-node-toolbar")||surface.root).appendChild(bar);
}
function geometryNodeMeasuredCards(canvas){return [...canvas.querySelectorAll(".geometry-node-card")].map(el=>({el,id:el.dataset.geometryNode,x:parseFloat(el.style.left)||0,y:parseFloat(el.style.top)||0,w:el.offsetWidth||154,h:el.offsetHeight||300}));}
function geometryNodeExpandCanvas(canvas){const cards=geometryNodeMeasuredCards(canvas);if(!cards.length)return;canvas.style.width=Math.max(2200,...cards.map(c=>c.x+c.w+500))+"px";canvas.style.height=Math.max(1100,...cards.map(c=>c.y+c.h+500))+"px";}
function geometryNodeRepairOverlap(surface,graph){if(geometryNodeLayoutSeen.has(graph))return;const cards=geometryNodeMeasuredCards(surface.canvas);if(!cards.length||!cards[0].el.offsetHeight)return;geometryNodeLayoutSeen.add(graph);if(cards.some((a,i)=>cards.slice(i+1).some(b=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y)))geometryNodeArrangeMeasured(surface,graph);}
function geometryNodeArrangeMeasured(surface,graph){const cards=geometryNodeMeasuredCards(surface.canvas);if(!cards.length)return;recordHistory("arrange geometry nodes");const p=geometryNodeLayoutPrefs(),columns=cards.length;let y=50;for(let i=0;i<cards.length;i+=columns){let x=50,height=0;for(const c of cards.slice(i,i+columns)){const smooth=graph.smoothNodes.find(n=>n.id===c.id);if(smooth)smooth.position=[x,y];else graph.nodePositions[c.id]=[x,y];height=Math.max(height,c.h);x+=c.w+p.x;}y+=height+p.y;}geometryNodeLayoutSeen.add(graph);saveGeometryNodeDraft();renderGeometryNodeEditor();}
function geometryNodeRefreshRulers(canvas,point=null){
const viewport=canvas?.parentElement,doc=canvas?.ownerDocument;if(!viewport||!doc||!canvas.offsetWidth)return;let overlay=viewport.querySelector(":scope > [data-node-rulers]");
if(!overlay){overlay=doc.createElement("div");overlay.dataset.nodeRulers="true";overlay.style.cssText="position:absolute;inset:0;pointer-events:none;z-index:20;overflow:hidden";viewport.style.position="relative";viewport.appendChild(overlay);}
canvas.querySelectorAll(".geometry-node-ruler-x,.geometry-node-ruler-y").forEach(el=>el.style.display="none");const c=canvas.getBoundingClientRect(),v=viewport.getBoundingClientRect(),scale=c.width/canvas.offsetWidth;if(!scale)return;const ox=c.left-v.left,oy=c.top-v.top,w=viewport.clientWidth,h=viewport.clientHeight,step=Math.pow(10,Math.ceil(Math.log10(60/scale)));overlay.replaceChildren();
function item(css,text){const el=doc.createElement("div");el.style.cssText="position:absolute;"+css;if(text!==undefined)el.textContent=text;overlay.appendChild(el);}
item("left:0;top:0;right:0;height:22px;background:#18262a;border-bottom:1px solid #61747b");item("left:0;top:22px;bottom:0;width:30px;background:#18262a;border-right:1px solid #61747b");
for(let n=Math.ceil(-ox/(step*scale));n*step*scale+ox<w;n++){const x=n*step*scale+ox;if(x>=30)item("top:0;left:"+x+"px;height:22px;border-left:1px solid #82999f;padding-left:3px;font:10px monospace;color:#d7e7e9",Math.round(n*step));}
for(let n=Math.ceil(-oy/(step*scale));n*step*scale+oy<h;n++){const y=n*step*scale+oy;if(y>=22)item("left:0;top:"+y+"px;width:30px;border-top:1px solid #82999f;font:9px monospace;color:#d7e7e9",Math.round(n*step));}
if(point){item("left:"+(ox+point[0]*scale)+"px;top:22px;bottom:0;border-left:1px dashed #63d8bd");item("left:30px;right:0;top:"+(oy+point[1]*scale)+"px;border-top:1px dashed #63d8bd");}
}
function geometryNodePaletteColor(p,n){const defaults=["#908676","#a39780","#786f62","#b1a58b"],value=p?.["paletteColor"+n];return /^#[0-9a-f]{6}$/i.test(value)?value:defaults[n-1];}

function geometryNodePreviewMesh(spec,collection){const g=spec.geometry?geometryFromData(spec.geometry):shapeFactories[spec.shape]?.();if(!g)throw Error("Unsupported preview geometry: "+spec.shape);const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:spec.color||"#ffffff",roughness:spec.roughness??.85,side:spec.doubleSided?THREE.DoubleSide:THREE.FrontSide}));m.name=spec.name||"Node output";m.position.fromArray(spec.position||[0,0,0]);m.rotation.set(...(spec.rotation||[0,0,0]).map(v=>THREE.MathUtils.degToRad(v)));m.scale.fromArray(spec.scale||[1,1,1]);m.userData={id:"scene-preview-"+collection.size,shape:spec.shape,_sceneTextureUrl:spec.textureUrl||null};m.updateMatrixWorld(true);collection.set(m.userData.id,m);return m;}
