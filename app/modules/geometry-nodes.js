// Graph persistence and shared scene math only; interactive runtime is external.
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

const GEOMETRY_NODE_DEFAULT_ORDER = Object.freeze(["seed", "variant", "trunk", "branches", "smoothJoints", "twigs", "canopy", "cutSurface", "output"]);

let geometryNodesRuntimeEnabled = false;

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

function geometryNodeTypeForId(graph, nodeId) {
  if (graph.nodeOrder.includes(nodeId)) {
    if (GEOMETRY_NODE_DEFINITIONS[nodeId]) return nodeId;
    const baseType = String(nodeId).split("::")[0];
    return GEOMETRY_NODE_DEFINITIONS[baseType] ? baseType : null;
  }
  return graph.smoothNodes.some(node => node.id === nodeId) ? "smoothGeometry" : null;
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

function geometryNodePaletteColor(p,n){const defaults=["#908676","#a39780","#786f62","#b1a58b"],value=p?.["paletteColor"+n];return /^#[0-9a-f]{6}$/i.test(value)?value:defaults[n-1];}

function geometryNodePreviewMesh(spec,collection){const g=spec.geometry?geometryFromData(spec.geometry):shapeFactories[spec.shape]?.();if(!g)throw Error("Unsupported preview geometry: "+spec.shape);const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:spec.color||"#ffffff",roughness:spec.roughness??.85,side:spec.doubleSided?THREE.DoubleSide:THREE.FrontSide}));m.name=spec.name||"Node output";m.position.fromArray(spec.position||[0,0,0]);m.rotation.set(...(spec.rotation||[0,0,0]).map(v=>THREE.MathUtils.degToRad(v)));m.scale.fromArray(spec.scale||[1,1,1]);m.userData={id:"scene-preview-"+collection.size,shape:spec.shape,_sceneTextureUrl:spec.textureUrl||null};m.updateMatrixWorld(true);collection.set(m.userData.id,m);return m;}
// Editor UI and graph generation now belong to the installed Geometry Nodes package.
function renderGeometryNodeEditor(){}
function setGeometryNodesPluginEnabled(enabled){geometryNodesRuntimeEnabled=!!enabled;}
async function buildGeometryNodeTree(options={}){
 if(!options.previewOnly)throw Error('Open the installed Geometry Nodes plugin to build or update a graph.');
 return bwsRequestGraphPreview(options.graphOverride||activeGeometryNodeGraph());
}
