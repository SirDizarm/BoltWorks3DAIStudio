function round(value, digits = 3) {
  const scale = 10 ** digits;
  return Math.round((Number(value) || 0) * scale) / scale;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function boxSpec(name, position, scale, color, extra = {}) {
  return { op: "add", shape: "box", name, position, scale, color, ...extra };
}

function cylinderSpec(name, position, scale, color, extra = {}) {
  return { op: "add", shape: "cylinder", name, position, scale, color, ...extra };
}

function ringSpec(name, position, scale, color, extra = {}) {
  return { op: "add", shape: "ring", name, position, scale, color, ...extra };
}

function prismSpec(name, position, scale, color, extra = {}) {
  return { op: "add", shape: "prism", name, position, scale, color, ...extra };
}

function lineCableSpecs(points = [], {
  namePrefix = "cable",
  color = "#4f535a",
  thickness = 0.05
} = {}) {
  const specs = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const dz = b[2] - a[2];
    const length = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.001;
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    const yaw = Math.atan2(dx, dz) * 180 / Math.PI;
    const pitch = -Math.atan2(dy, Math.sqrt(dx * dx + dz * dz)) * 180 / Math.PI;
    specs.push(cylinderSpec(`${namePrefix}_${i + 1}`, mid, [thickness, length / 2, thickness], color, {
      rotation: [pitch, yaw, 0]
    }));
  }
  return specs;
}

function buildTrussBoomSegment(options = {}) {
  const length = clamp(options.length ?? 6, 2, 40);
  const width = clamp(options.width ?? 0.9, 0.2, 6);
  const height = clamp(options.height ?? 0.9, 0.2, 6);
  const beam = clamp(options.beam ?? 0.1, 0.04, Math.min(width, height) * 0.45);
  const color = options.color || "#aa6f48";
  const accent = options.accent || "#d7a25a";
  const halfL = length / 2;
  const halfW = width / 2;
  const halfH = height / 2;
  const strutLength = Math.sqrt((length / 2) ** 2 + height ** 2);
  const strutPitch = Math.atan2(height, length / 2) * 180 / Math.PI;

  return {
    kind: "truss_boom_segment",
    summary: `Truss boom segment ${round(length)} x ${round(width)} x ${round(height)}`,
    objects: [
      boxSpec("boom_top_left", [0, halfH, -halfW], [length, beam, beam], color),
      boxSpec("boom_top_right", [0, halfH, halfW], [length, beam, beam], color),
      boxSpec("boom_bottom_left", [0, -halfH, -halfW], [length, beam, beam], color),
      boxSpec("boom_bottom_right", [0, -halfH, halfW], [length, beam, beam], color),
      boxSpec("boom_end_front", [-halfL, 0, 0], [beam, height, width], accent),
      boxSpec("boom_end_back", [halfL, 0, 0], [beam, height, width], accent),
      cylinderSpec("boom_diag_a", [-length / 4, 0, 0], [beam * 0.45, strutLength / 2, beam * 0.45], accent, { rotation: [0, 0, 90 - strutPitch] }),
      cylinderSpec("boom_diag_b", [length / 4, 0, 0], [beam * 0.45, strutLength / 2, beam * 0.45], accent, { rotation: [0, 0, strutPitch - 90] }),
      cylinderSpec("boom_side_pin_front", [-halfL, 0, halfW], [beam * 0.6, width / 2, beam * 0.6], "#3f4349", { rotation: [90, 0, 0] }),
      cylinderSpec("boom_side_pin_back", [halfL, 0, -halfW], [beam * 0.6, width / 2, beam * 0.6], "#3f4349", { rotation: [90, 0, 0] })
    ]
  };
}

function buildHookBlock(options = {}) {
  const width = clamp(options.width ?? 0.9, 0.2, 8);
  const height = clamp(options.height ?? 1.2, 0.2, 8);
  const depth = clamp(options.depth ?? 0.45, 0.08, 4);
  const ringRadius = clamp(options.ringRadius ?? 0.24, 0.08, 2);
  const color = options.color || "#7b5538";
  const metal = options.metal || "#4e5058";
  return {
    kind: "hook_block",
    summary: `Hook block ${round(width)} x ${round(height)} x ${round(depth)}`,
    objects: [
      boxSpec("hook_body", [0, 0, 0], [width, height, depth], color),
      cylinderSpec("hook_pulley", [0, height * 0.22, 0], [depth * 0.42, width * 0.35, depth * 0.42], metal, { rotation: [0, 0, 90] }),
      ringSpec("hook_ring", [0, height * 0.68, 0], [ringRadius * 2.2, ringRadius * 2.2, depth * 0.8], "#7ae7f0"),
      prismSpec("hook_tip", [0, -height * 0.72, 0], [width * 0.55, height * 0.5, depth * 0.9], metal, { rotation: [180, 0, 0] })
    ]
  };
}

function buildCrawlerBase(options = {}) {
  const width = clamp(options.width ?? 4, 1, 20);
  const depth = clamp(options.depth ?? 2.8, 1, 20);
  const height = clamp(options.height ?? 0.7, 0.15, 6);
  const color = options.color || "#6b5648";
  const track = options.trackColor || "#43464d";
  return {
    kind: "crawler_base",
    summary: `Crawler base ${round(width)} x ${round(depth)} x ${round(height)}`,
    objects: [
      boxSpec("crawler_platform", [0, 0, 0], [width, height, depth], color),
      boxSpec("crawler_track_left", [0, -height * 0.28, -depth * 0.38], [width * 1.02, height * 0.78, depth * 0.24], track),
      boxSpec("crawler_track_right", [0, -height * 0.28, depth * 0.38], [width * 1.02, height * 0.78, depth * 0.24], track),
      cylinderSpec("crawler_sprocket_front_left", [-width * 0.42, -height * 0.08, -depth * 0.38], [height * 0.26, depth * 0.12, height * 0.26], "#7e828b", { rotation: [90, 0, 0] }),
      cylinderSpec("crawler_sprocket_back_left", [width * 0.42, -height * 0.08, -depth * 0.38], [height * 0.26, depth * 0.12, height * 0.26], "#7e828b", { rotation: [90, 0, 0] }),
      cylinderSpec("crawler_sprocket_front_right", [-width * 0.42, -height * 0.08, depth * 0.38], [height * 0.26, depth * 0.12, height * 0.26], "#7e828b", { rotation: [90, 0, 0] }),
      cylinderSpec("crawler_sprocket_back_right", [width * 0.42, -height * 0.08, depth * 0.38], [height * 0.26, depth * 0.12, height * 0.26], "#7e828b", { rotation: [90, 0, 0] })
    ]
  };
}

function buildOperatorCabin(options = {}) {
  const width = clamp(options.width ?? 1.8, 0.4, 12);
  const height = clamp(options.height ?? 1.6, 0.4, 12);
  const depth = clamp(options.depth ?? 1.4, 0.4, 12);
  const color = options.color || "#c4744a";
  return {
    kind: "operator_cabin",
    summary: `Operator cabin ${round(width)} x ${round(height)} x ${round(depth)}`,
    objects: [
      boxSpec("cabin_body", [0, 0, 0], [width, height, depth], color),
      boxSpec("cabin_window_front", [width * 0.36, height * 0.1, 0], [width * 0.08, height * 0.5, depth * 0.56], "#7ae7f0", { roughness: 0.15 }),
      boxSpec("cabin_window_side", [0, height * 0.15, depth * 0.34], [width * 0.44, height * 0.42, depth * 0.08], "#7ae7f0", { roughness: 0.15 }),
      boxSpec("cabin_counterweight_mount", [-width * 0.56, -height * 0.08, 0], [width * 0.18, height * 0.36, depth * 0.56], "#6b5648")
    ]
  };
}

function buildSimpleCrawlerCrane(options = {}) {
  const accent = options.accent || "#d7a25a";
  const base = buildCrawlerBase({ width: options.baseWidth ?? 4.4, depth: options.baseDepth ?? 3, height: options.baseHeight ?? 0.75, color: options.baseColor || "#5f5249" });
  const cabin = buildOperatorCabin({ width: 1.9, height: 1.55, depth: 1.4, color: options.cabinColor || "#b86e46" });
  const boom = buildTrussBoomSegment({ length: options.boomLength ?? 6.8, width: 0.9, height: 1, color: options.boomColor || "#9f6948", accent });
  const hook = buildHookBlock({ width: 0.85, height: 1.05, depth: 0.4, color: "#8d6446" });
  const boomOffset = [1.35, 2.55, 0];
  const hookOffset = [boomOffset[0] + 3.55, boomOffset[1] - 2.2, 0];
  const cablePoints = [
    [boomOffset[0] - 3.2, boomOffset[1] + 0.52, 0],
    [hookOffset[0], hookOffset[1] + 0.62, 0]
  ];
  const objects = [
    ...base.objects,
    ...cabin.objects.map(spec => ({ ...spec, position: [round(spec.position[0] - 0.35), round(spec.position[1] + 1.1), round(spec.position[2])] })),
    boxSpec("counterweight", [-2.25, 1.15, 0], [1.1, 1.2, 1.6], "#6e6158"),
    cylinderSpec("slew_ring", [0.2, 0.82, 0], [0.2, 1, 0.2], "#666a73"),
    ringSpec("slew_ring_outer", [0.2, 0.82, 0], [1.8, 1.8, 0.18], "#7a7f88"),
    ...boom.objects.map(spec => ({
      ...spec,
      position: [round(spec.position[0] + boomOffset[0]), round(spec.position[1] + boomOffset[1]), round(spec.position[2])],
      rotation: [
        round((spec.rotation?.[0] || 0)),
        round((spec.rotation?.[1] || 0)),
        round((spec.rotation?.[2] || 0) + 58)
      ]
    })),
    ...hook.objects.map(spec => ({ ...spec, position: [round(spec.position[0] + hookOffset[0]), round(spec.position[1] + hookOffset[1]), round(spec.position[2])] })),
    ...lineCableSpecs(cablePoints, { namePrefix: "crane_cable", thickness: 0.045 })
  ];
  return {
    kind: "simple_crawler_crane",
    summary: "Simple procedural crawler crane assembly",
    objects
  };
}

export function createMeshFactory({ builders = {} } = {}) {
  const shapeFactories = {
    box: builders.box,
    sphere: builders.sphere,
    cylinder: builders.cylinder,
    cone: builders.cone,
    torus: builders.torus,
    panel: builders.panel,
    wedge: builders.wedge,
    hollowBox: builders.hollowBox,
    tube: builders.tube,
    curvedPanel: builders.curvedPanel,
    ring: builders.ring,
    arch: builders.arch,
    hemisphere: builders.hemisphere,
    dome: builders.dome,
    capsule: builders.capsule,
    pyramid: builders.pyramid,
    prism: builders.prism,
    tetrahedron: builders.tetrahedron,
    pyramidFrustum: builders.pyramidFrustum,
    heart: builders.heart,
    stair: builders.stair
  };

  const shapeAliases = {
    cube: "box",
    hollowbox: "hollowBox",
    hollow_box: "hollowBox",
    "hollow box": "hollowBox",
    curvedpanel: "curvedPanel",
    curved_panel: "curvedPanel",
    "curved panel": "curvedPanel",
    beveledpanel: "beveledPanel",
    beveled_panel: "beveledPanel",
    "beveled panel": "beveledPanel",
    halfsphere: "hemisphere",
    half_sphere: "hemisphere",
    "half sphere": "hemisphere",
    hemi: "hemisphere",
    pyramidfrustum: "pyramidFrustum",
    pyramid_frustum: "pyramidFrustum",
    "pyramid frustum": "pyramidFrustum",
    truncatedpyramid: "pyramidFrustum",
    truncated_pyramid: "pyramidFrustum",
    "truncated pyramid": "pyramidFrustum",
    tetra: "tetrahedron",
    stairs: "stair"
  };

  function normalizeShapeName(shape = "box") {
    const value = String(shape || "box").trim();
    const key = value.toLowerCase();
    return shapeFactories[value]
      ? value
      : (shapeAliases[key] || shapeAliases[key.replace(/[-\s]/g, "_")] || shapeAliases[key.replace(/[-_\s]/g, "")] || key);
  }

  const proceduralCatalog = {
    truss_boom_segment: {
      label: "Truss Boom Segment",
      description: "Lattice boom section for cranes, gantries, or sci-fi support arms.",
      parameters: ["length", "width", "height", "beam", "color", "accent"]
    },
    hook_block: {
      label: "Hook Block",
      description: "Simple pulley and hook unit for crane assemblies.",
      parameters: ["width", "height", "depth", "ringRadius", "color", "metal"]
    },
    crawler_base: {
      label: "Crawler Base",
      description: "Tracked base for construction or salvage vehicles.",
      parameters: ["width", "depth", "height", "color", "trackColor"]
    },
    operator_cabin: {
      label: "Operator Cabin",
      description: "Cab shell with front and side glazing.",
      parameters: ["width", "height", "depth", "color"]
    },
    simple_crawler_crane: {
      label: "Simple Crawler Crane",
      description: "Starter procedural crane assembly built from reusable sub-parts.",
      parameters: ["baseWidth", "baseDepth", "baseHeight", "boomLength", "baseColor", "boomColor", "cabinColor", "accent"]
    }
  };

  function buildProceduralAssembly(kind, options = {}) {
    switch (String(kind || "").trim().toLowerCase()) {
      case "truss_boom_segment":
      case "trussboomsegment":
      case "boom":
        return buildTrussBoomSegment(options);
      case "hook_block":
      case "hookblock":
      case "hook":
        return buildHookBlock(options);
      case "crawler_base":
      case "crawlerbase":
      case "trackbase":
        return buildCrawlerBase(options);
      case "operator_cabin":
      case "operatorcabin":
      case "cabin":
        return buildOperatorCabin(options);
      case "simple_crawler_crane":
      case "simplecrawlercrane":
      case "crane":
        return buildSimpleCrawlerCrane(options);
      default:
        return null;
    }
  }

  return {
    shapeFactories,
    shapeAliases,
    normalizeShapeName,
    proceduralCatalog,
    buildProceduralAssembly,
    listShapes: () => Object.keys(shapeFactories),
    listProceduralTemplates: () => Object.entries(proceduralCatalog).map(([key, meta]) => ({ key, ...meta }))
  };
}
