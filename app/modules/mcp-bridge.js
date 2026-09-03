const mcpBridgeVersion = 2;
const mcpBridgeNextUrl = "/__modeler/mcp/next";
const mcpBridgePreflightUrl = "/__modeler/mcp/preflight";
const mcpBridgeResultUrl = "/__modeler/mcp/result";
const mcpBridgeMaxBatchSize = 256;
const mcpBridgeMaxAuditEntries = 200;
const mcpBridgeMaxStringLength = 512;
const mcpBridgeAllowedShapes = new Set(Object.keys(shapeFactories));
const mcpBridgeAuditEntries = [];
let mcpBridgeAuditSequence = 0;
let mcpBridgeRevision = 0;
let mcpBridgePolling = false;
let mcpBridgePollAbortController = null;

class McpBridgeError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = "McpBridgeError";
    this.code = code;
    this.details = details;
  }
}

function mcpBridgeIsPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function mcpBridgeAssert(condition, code, message, details = null) {
  if (!condition) throw new McpBridgeError(code, message, details);
}

function mcpBridgeFiniteNumber(value, label, { min = -1_000_000, max = 1_000_000 } = {}) {
  const number = Number(value);
  mcpBridgeAssert(Number.isFinite(number), "INVALID_PARAMS", `${label} must be a finite number.`);
  mcpBridgeAssert(number >= min && number <= max, "INVALID_PARAMS", `${label} must be between ${min} and ${max}.`);
  return number;
}

function mcpBridgeInteger(value, label, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const number = Number(value);
  mcpBridgeAssert(Number.isSafeInteger(number), "INVALID_PARAMS", `${label} must be an integer.`);
  mcpBridgeAssert(number >= min && number <= max, "INVALID_PARAMS", `${label} must be between ${min} and ${max}.`);
  return number;
}

function mcpBridgeString(value, label, { required = false, nullable = false, maxLength = mcpBridgeMaxStringLength } = {}) {
  if (value === null && nullable) return null;
  mcpBridgeAssert(typeof value === "string", "INVALID_PARAMS", `${label} must be a string${nullable ? " or null" : ""}.`);
  const text = value.trim();
  if (required) mcpBridgeAssert(text.length > 0, "INVALID_PARAMS", `${label} cannot be empty.`);
  mcpBridgeAssert(text.length <= maxLength, "INVALID_PARAMS", `${label} cannot exceed ${maxLength} characters.`);
  return text;
}

function mcpBridgeVector(value, label, { scale = false } = {}) {
  mcpBridgeAssert(Array.isArray(value) && value.length === 3, "INVALID_PARAMS", `${label} must contain exactly three numbers.`);
  const vector = value.map((component, index) => mcpBridgeFiniteNumber(component, `${label}[${index}]`));
  if (scale) {
    vector.forEach((component, index) => {
      mcpBridgeAssert(Math.abs(component) >= .000001, "INVALID_PARAMS", `${label}[${index}] cannot be zero.`);
    });
  }
  return vector;
}

function mcpBridgeColor(value, label) {
  const text = mcpBridgeString(value, label, { required: true, maxLength: 9 });
  mcpBridgeAssert(/^#[0-9a-f]{6}$/i.test(text), "INVALID_PARAMS", `${label} must use #RRGGBB format.`);
  return text.toUpperCase();
}

const mcpBridgeMaxGeometryVertices = 200_000;

function mcpBridgeNumberArray(value, label, { minLength = 0, multipleOf = 1, integer = false, min = -1_000_000, max = 1_000_000 } = {}) {
  mcpBridgeAssert(Array.isArray(value), "INVALID_PARAMS", `${label} must be an array.`);
  mcpBridgeAssert(value.length >= minLength, "INVALID_PARAMS", `${label} must contain at least ${minLength} numbers.`);
  mcpBridgeAssert(value.length % multipleOf === 0, "INVALID_PARAMS", `${label} length must be a multiple of ${multipleOf}.`);
  return value.map((component, index) => {
    const number = Number(component);
    mcpBridgeAssert(Number.isFinite(number), "INVALID_PARAMS", `${label}[${index}] must be a finite number.`);
    mcpBridgeAssert(number >= min && number <= max, "INVALID_PARAMS", `${label}[${index}] must be between ${min} and ${max}.`);
    if (integer) mcpBridgeAssert(Number.isInteger(number), "INVALID_PARAMS", `${label}[${index}] must be an integer.`);
    return number;
  });
}

const mcpBridgeGeometryKeys = new Set(["positions", "normals", "colors", "uvs", "indices"]);

function mcpBridgeGeometry(value, label) {
  mcpBridgeAssertAllowedKeys(value, mcpBridgeGeometryKeys, label);
  mcpBridgeAssert(Object.prototype.hasOwnProperty.call(value, "positions"), "INVALID_PARAMS", `${label}.positions is required.`);
  const positions = mcpBridgeNumberArray(value.positions, `${label}.positions`, { minLength: 9, multipleOf: 3 });
  mcpBridgeAssert(positions.length / 3 <= mcpBridgeMaxGeometryVertices, "LIMIT_EXCEEDED", `${label}.positions cannot exceed ${mcpBridgeMaxGeometryVertices} vertices.`);
  const geometry = { positions };
  if (Object.prototype.hasOwnProperty.call(value, "normals")) {
    const normals = mcpBridgeNumberArray(value.normals, `${label}.normals`, { multipleOf: 3, min: -1, max: 1 });
    mcpBridgeAssert(normals.length === positions.length, "INVALID_PARAMS", `${label}.normals must contain the same number of components as ${label}.positions.`);
    geometry.normals = normals;
  }
  if (Object.prototype.hasOwnProperty.call(value, "colors")) {
    const colors = mcpBridgeNumberArray(value.colors, `${label}.colors`, { multipleOf: 3, min: 0, max: 1 });
    mcpBridgeAssert(colors.length === positions.length, "INVALID_PARAMS", `${label}.colors must contain the same number of components as ${label}.positions.`);
    geometry.colors = colors;
  }
  if (Object.prototype.hasOwnProperty.call(value, "uvs")) {
    const uvs = mcpBridgeNumberArray(value.uvs, `${label}.uvs`, { multipleOf: 2 });
    mcpBridgeAssert(uvs.length === (positions.length / 3) * 2, "INVALID_PARAMS", `${label}.uvs must contain exactly two numbers per vertex.`);
    geometry.uvs = uvs;
  }
  if (Object.prototype.hasOwnProperty.call(value, "indices")) {
    geometry.indices = mcpBridgeNumberArray(value.indices, `${label}.indices`, {
      multipleOf: 3, integer: true, min: 0, max: Math.max(0, positions.length / 3 - 1)
    });
  }
  return geometry;
}

// Kept well under the relay's HTTP body cap (see maxBodyBytes in
// tools/localserver/mcp-relay.mjs) so an oversized image is rejected here
// with a clear error instead of failing lower in the stack.
const mcpBridgeMaxImageDataUrlLength = 10_000_000;

function mcpBridgeImageDataUrl(value, label) {
  mcpBridgeAssert(typeof value === "string" && value.length > 0, "INVALID_PARAMS", `${label} must be a non-empty string.`);
  mcpBridgeAssert(/^data:image\/(png|jpe?g|webp|gif|bmp);base64,/i.test(value), "INVALID_PARAMS", `${label} must be a base64 image data URL (data:image/<type>;base64,...).`);
  mcpBridgeAssert(value.length <= mcpBridgeMaxImageDataUrlLength, "LIMIT_EXCEEDED", `${label} exceeds the maximum accepted size.`);
  return value;
}

function mcpBridgeAssertAllowedKeys(value, allowedKeys, label) {
  mcpBridgeAssert(mcpBridgeIsPlainObject(value), "INVALID_PARAMS", `${label} must be an object.`);
  const unexpected = Object.keys(value).filter(key => !allowedKeys.has(key));
  mcpBridgeAssert(!unexpected.length, "INVALID_PARAMS", `${label} contains unsupported fields.`, { fields: unexpected });
}

function mcpBridgeBatch(params, key) {
  mcpBridgeAssert(mcpBridgeIsPlainObject(params), "INVALID_PARAMS", "params must be an object.");
  const batch = params[key];
  mcpBridgeAssert(Array.isArray(batch), "INVALID_PARAMS", `params.${key} must be an array.`);
  mcpBridgeAssert(batch.length > 0, "INVALID_PARAMS", `params.${key} cannot be empty.`);
  mcpBridgeAssert(batch.length <= mcpBridgeMaxBatchSize, "LIMIT_EXCEEDED", `A batch can contain at most ${mcpBridgeMaxBatchSize} entries.`);
  return batch;
}

function mcpBridgeExactObject(id, label = "id") {
  const exactId = mcpBridgeString(id, label, { required: true, maxLength: 128 });
  const mesh = findObject(exactId);
  mcpBridgeAssert(mesh?.userData?.id === exactId, "OBJECT_NOT_FOUND", `No object exists with the exact ID '${exactId}'.`, { id: exactId });
  return mesh;
}

function mcpBridgeUniqueIds(ids, label = "ids", { allowEmpty = false } = {}) {
  mcpBridgeAssert(Array.isArray(ids), "INVALID_PARAMS", `${label} must be an array.`);
  mcpBridgeAssert(allowEmpty || ids.length > 0, "INVALID_PARAMS", `${label} cannot be empty.`);
  mcpBridgeAssert(ids.length <= mcpBridgeMaxBatchSize, "LIMIT_EXCEEDED", `${label} can contain at most ${mcpBridgeMaxBatchSize} IDs.`);
  const normalized = ids.map((id, index) => mcpBridgeString(id, `${label}[${index}]`, { required: true, maxLength: 128 }));
  mcpBridgeAssert(new Set(normalized).size === normalized.length, "INVALID_PARAMS", `${label} cannot contain duplicate IDs.`);
  return normalized;
}

const mcpBridgeCreateKeys = new Set([
  "id", "shape", "name", "position", "rotation", "scale", "color", "roughness", "opacity",
  "materialRule", "hidden", "groupId", "groupName", "linkId", "linkColor", "bevel", "depth",
  "direction", "pivot", "playerAvatar", "playerHeadOffset", "geometry"
]);

const mcpBridgeUpdateKeys = new Set([
  "name", "position", "rotation", "scale", "color", "roughness", "opacity", "materialRule", "hidden",
  "groupId", "groupName", "linkId", "linkColor", "pivot", "playerAvatar", "playerHeadOffset"
]);

function mcpBridgeOptionalText(spec, key, label, { nullable = false, maxLength = 256 } = {}) {
  if (!Object.prototype.hasOwnProperty.call(spec, key)) return undefined;
  return mcpBridgeString(spec[key], label, { nullable, maxLength });
}

function mcpBridgeValidateCreateSpec(value, index) {
  const label = `objects[${index}]`;
  mcpBridgeAssertAllowedKeys(value, mcpBridgeCreateKeys, label);
  const shapeInput = Object.prototype.hasOwnProperty.call(value, "shape")
    ? mcpBridgeString(value.shape, `${label}.shape`, { required: true, maxLength: 64 })
    : "box";
  const shape = normalizeShapeName(shapeInput);
  mcpBridgeAssert(mcpBridgeAllowedShapes.has(shape), "UNSUPPORTED_SHAPE", `Unsupported shape '${shapeInput}'.`, {
    supportedShapes: [...mcpBridgeAllowedShapes]
  });
  const spec = { shape };
  if (Object.prototype.hasOwnProperty.call(value, "id")) spec.id = mcpBridgeString(value.id, `${label}.id`, { required: true, maxLength: 128 });
  if (Object.prototype.hasOwnProperty.call(value, "name")) spec.name = mcpBridgeString(value.name, `${label}.name`, { required: true, maxLength: 256 });
  if (Object.prototype.hasOwnProperty.call(value, "position")) spec.position = mcpBridgeVector(value.position, `${label}.position`);
  if (Object.prototype.hasOwnProperty.call(value, "rotation")) spec.rotation = mcpBridgeVector(value.rotation, `${label}.rotation`);
  if (Object.prototype.hasOwnProperty.call(value, "scale")) spec.scale = mcpBridgeVector(value.scale, `${label}.scale`, { scale: true });
  if (Object.prototype.hasOwnProperty.call(value, "color")) spec.color = mcpBridgeColor(value.color, `${label}.color`);
  if (Object.prototype.hasOwnProperty.call(value, "roughness")) spec.roughness = mcpBridgeFiniteNumber(value.roughness, `${label}.roughness`, { min: 0, max: 1 });
  if (Object.prototype.hasOwnProperty.call(value, "opacity")) spec.opacity = mcpBridgeFiniteNumber(value.opacity, `${label}.opacity`, { min: .05, max: 1 });
  if (Object.prototype.hasOwnProperty.call(value, "materialRule")) {
    const materialRule = mcpBridgeString(value.materialRule, `${label}.materialRule`, { required: true, maxLength: 64 });
    mcpBridgeAssert(normalizeMaterialRule(materialRule) === materialRule, "INVALID_PARAMS", `${label}.materialRule is not supported.`);
    spec.materialRule = materialRule;
  }
  if (Object.prototype.hasOwnProperty.call(value, "hidden")) {
    mcpBridgeAssert(typeof value.hidden === "boolean", "INVALID_PARAMS", `${label}.hidden must be a boolean.`);
    spec.hidden = value.hidden;
  }
  for (const key of ["groupId", "groupName", "linkId", "linkColor", "direction"]) {
    const text = mcpBridgeOptionalText(value, key, `${label}.${key}`, { nullable: true });
    if (text !== undefined) spec[key] = text;
  }
  for (const key of ["bevel", "depth"]) {
    if (Object.prototype.hasOwnProperty.call(value, key)) spec[key] = mcpBridgeFiniteNumber(value[key], `${label}.${key}`, { min: 0, max: 100_000 });
  }
  if (Object.prototype.hasOwnProperty.call(value, "pivot")) spec.pivot = value.pivot === null ? null : mcpBridgeVector(value.pivot, `${label}.pivot`);
  if (Object.prototype.hasOwnProperty.call(value, "playerAvatar")) {
    mcpBridgeAssert(typeof value.playerAvatar === "boolean", "INVALID_PARAMS", `${label}.playerAvatar must be a boolean.`);
    spec.playerAvatar = value.playerAvatar;
  }
  if (Object.prototype.hasOwnProperty.call(value, "playerHeadOffset")) {
    spec.playerHeadOffset = value.playerHeadOffset === null ? null : mcpBridgeVector(value.playerHeadOffset, `${label}.playerHeadOffset`);
  }
  if (Object.prototype.hasOwnProperty.call(value, "geometry")) spec.geometry = mcpBridgeGeometry(value.geometry, `${label}.geometry`);
  return spec;
}

function mcpBridgeValidateUpdatePatch(value, label) {
  mcpBridgeAssertAllowedKeys(value, mcpBridgeUpdateKeys, label);
  mcpBridgeAssert(Object.keys(value).length > 0, "INVALID_PARAMS", `${label} cannot be empty.`);
  const patch = {};
  if (Object.prototype.hasOwnProperty.call(value, "name")) patch.name = mcpBridgeString(value.name, `${label}.name`, { required: true, maxLength: 256 });
  if (Object.prototype.hasOwnProperty.call(value, "position")) patch.position = mcpBridgeVector(value.position, `${label}.position`);
  if (Object.prototype.hasOwnProperty.call(value, "rotation")) patch.rotation = mcpBridgeVector(value.rotation, `${label}.rotation`);
  if (Object.prototype.hasOwnProperty.call(value, "scale")) patch.scale = mcpBridgeVector(value.scale, `${label}.scale`, { scale: true });
  if (Object.prototype.hasOwnProperty.call(value, "color")) patch.color = mcpBridgeColor(value.color, `${label}.color`);
  if (Object.prototype.hasOwnProperty.call(value, "roughness")) patch.roughness = mcpBridgeFiniteNumber(value.roughness, `${label}.roughness`, { min: 0, max: 1 });
  if (Object.prototype.hasOwnProperty.call(value, "opacity")) patch.opacity = mcpBridgeFiniteNumber(value.opacity, `${label}.opacity`, { min: .05, max: 1 });
  if (Object.prototype.hasOwnProperty.call(value, "materialRule")) {
    const materialRule = mcpBridgeString(value.materialRule, `${label}.materialRule`, { required: true, maxLength: 64 });
    mcpBridgeAssert(normalizeMaterialRule(materialRule) === materialRule, "INVALID_PARAMS", `${label}.materialRule is not supported.`);
    patch.materialRule = materialRule;
  }
  if (Object.prototype.hasOwnProperty.call(value, "hidden")) {
    mcpBridgeAssert(typeof value.hidden === "boolean", "INVALID_PARAMS", `${label}.hidden must be a boolean.`);
    patch.hidden = value.hidden;
  }
  for (const key of ["groupId", "groupName", "linkId", "linkColor"]) {
    const text = mcpBridgeOptionalText(value, key, `${label}.${key}`, { nullable: true });
    if (text !== undefined) patch[key] = text;
  }
  if (Object.prototype.hasOwnProperty.call(value, "pivot")) patch.pivot = value.pivot === null ? null : mcpBridgeVector(value.pivot, `${label}.pivot`);
  if (Object.prototype.hasOwnProperty.call(value, "playerAvatar")) {
    mcpBridgeAssert(typeof value.playerAvatar === "boolean", "INVALID_PARAMS", `${label}.playerAvatar must be a boolean.`);
    patch.playerAvatar = value.playerAvatar;
  }
  if (Object.prototype.hasOwnProperty.call(value, "playerHeadOffset")) {
    patch.playerHeadOffset = value.playerHeadOffset === null ? null : mcpBridgeVector(value.playerHeadOffset, `${label}.playerHeadOffset`);
  }
  return patch;
}

function mcpBridgeMeshMaterials(mesh) {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

function mcpBridgeApplyUpdate(mesh, patch) {
  if (patch.name !== undefined) mesh.name = patch.name;
  if (patch.position) mesh.position.fromArray(patch.position);
  if (patch.rotation) {
    mesh.rotation.set(
      THREE.MathUtils.degToRad(patch.rotation[0]),
      THREE.MathUtils.degToRad(patch.rotation[1]),
      THREE.MathUtils.degToRad(patch.rotation[2])
    );
  }
  if (patch.scale) mesh.scale.fromArray(patch.scale);
  if (patch.color !== undefined) {
    mesh.userData.color = patch.color;
    for (const material of mcpBridgeMeshMaterials(mesh)) material?.color?.set(patch.color);
  }
  if (patch.roughness !== undefined) {
    mesh.userData.roughness = patch.roughness;
    for (const material of mcpBridgeMeshMaterials(mesh)) {
      if (material && "roughness" in material) material.roughness = patch.roughness;
    }
  }
  if (patch.opacity !== undefined) {
    mesh.userData.opacity = patch.opacity;
    for (const material of mcpBridgeMeshMaterials(mesh)) {
      if (!material) continue;
      material.opacity = patch.opacity;
      material.transparent = patch.opacity < .999;
      material.depthWrite = patch.opacity >= .999;
      material.needsUpdate = true;
    }
  }
  if (patch.materialRule !== undefined) {
    mesh.userData.materialRule = patch.materialRule;
    for (const material of mcpBridgeMeshMaterials(mesh)) {
      if (material && "metalness" in material) material.metalness = patch.materialRule === "metal" ? .52 : .05;
    }
  }
  if (patch.opacity !== undefined || patch.materialRule !== undefined) syncMeshRenderCulling(mesh);
  if (patch.hidden !== undefined) {
    mesh.userData.hidden = patch.hidden;
    mesh.visible = !patch.hidden;
  }
  for (const key of ["groupId", "groupName", "linkId", "linkColor"]) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) mesh.userData[key] = patch[key];
  }
  if (Object.prototype.hasOwnProperty.call(patch, "pivot")) mesh.userData.pivot = patch.pivot ? [...patch.pivot] : null;
  if (patch.playerAvatar !== undefined) mesh.userData.playerAvatar = patch.playerAvatar;
  if (Object.prototype.hasOwnProperty.call(patch, "playerHeadOffset")) {
    mesh.userData.playerHeadOffset = patch.playerHeadOffset ? [...patch.playerHeadOffset] : null;
  }
  for (const material of mcpBridgeMeshMaterials(mesh)) {
    if (material) material.needsUpdate = true;
  }
  mesh.updateMatrixWorld(true);
}

function mcpBridgeTriangleCount(mesh) {
  if (!mesh?.geometry) return 0;
  return Math.floor((mesh.geometry.index?.count || mesh.geometry.getAttribute("position")?.count || 0) / 3);
}

function mcpBridgeCapabilitiesResult() {
  return {
    bridgeVersion: mcpBridgeVersion,
    revision: mcpBridgeRevision,
    transport: {
      commandEndpoint: "/__mcp/command",
      browserNextEndpoint: mcpBridgeNextUrl,
      browserResultEndpoint: mcpBridgeResultUrl
    },
    methods: {
      "capabilities.get": {},
      "scene.get": { detail: ["summary", "objects", "project"] },
      "selection.get": {},
      "objects.create": { maxBatchSize: mcpBridgeMaxBatchSize, shapes: [...mcpBridgeAllowedShapes], geometry: { maxVertices: mcpBridgeMaxGeometryVertices } },
      "objects.combineShell": { minObjects: 2, maxBatchSize: mcpBridgeMaxBatchSize, resolution: { min: 18, max: 64 }, replacesSources: true, undoable: true },
      "objects.update": { maxBatchSize: mcpBridgeMaxBatchSize, exactIdsRequired: true },
      "objects.delete": { maxBatchSize: mcpBridgeMaxBatchSize, exactIdsRequired: true },
      "selection.set": { maxBatchSize: mcpBridgeMaxBatchSize, exactIdsRequired: true },
      "referenceMatch.createMesh": {
        sourceModes: ["single", "sheet"],
        maxImageDataUrlLength: mcpBridgeMaxImageDataUrlLength,
        cols: { min: 8, max: 160 },
        rows: { min: 8, max: 220 }
      },
      undo: {},
      "audit.get": { maxEntries: mcpBridgeMaxAuditEntries },
      "work_session.start": { relayLocal: true, realDeadline: true },
      "work_session.get": { relayLocal: true },
      "work_session.note": { relayLocal: true, factualNotesOnly: true },
      "work_session.stop": { relayLocal: true }
    },
    studio: projectCapabilities()
  };
}

function mcpBridgeSceneResult(params) {
  mcpBridgeAssert(mcpBridgeIsPlainObject(params), "INVALID_PARAMS", "params must be an object.");
  mcpBridgeAssertAllowedKeys(params, new Set(["detail"]), "params");
  const detail = params.detail === undefined ? "summary" : mcpBridgeString(params.detail, "params.detail", { required: true, maxLength: 32 });
  mcpBridgeAssert(["summary", "objects", "project"].includes(detail), "INVALID_PARAMS", "params.detail must be summary, objects, or project.");
  const project = projectState();
  if (detail === "project") return { revision: mcpBridgeRevision, project };
  if (detail === "objects") {
    return {
      revision: mcpBridgeRevision,
      coordinateSystem: project.scene.coordinateSystem,
      groups: project.scene.groups,
      hierarchy: project.scene.hierarchy,
      objects: project.scene.objects
    };
  }
  const triangleCount = objects.reduce((total, mesh) => total + mcpBridgeTriangleCount(mesh), 0);
  return {
    revision: mcpBridgeRevision,
    name: project.name,
    objectCount: objects.length,
    triangleCount,
    groupCount: project.scene.groups?.length || 0,
    selectedId: selected?.userData?.id || null,
    selectedIds: activeGroupIds.length ? [...activeGroupIds] : (selected?.userData?.id ? [selected.userData.id] : []),
    checkedIds: [...checkedIds]
  };
}

function mcpBridgeSelectionResult() {
  const ids = activeGroupIds.length ? [...activeGroupIds] : (selected?.userData?.id ? [selected.userData.id] : []);
  return {
    revision: mcpBridgeRevision,
    primaryId: selected?.userData?.id || null,
    ids,
    checkedIds: [...checkedIds],
    objects: ids.map(id => objects.find(mesh => mesh.userData.id === id)).filter(Boolean).map(serializeObject)
  };
}

function mcpBridgeCreateObjects(params) {
  mcpBridgeAssertAllowedKeys(params, new Set(["objects", "expectedRevision"]), "params");
  const batch = mcpBridgeBatch(params, "objects");
  const specs = batch.map(mcpBridgeValidateCreateSpec);
  const requestedIds = specs.filter(spec => spec.id).map(spec => spec.id);
  mcpBridgeAssert(new Set(requestedIds).size === requestedIds.length, "INVALID_PARAMS", "The batch contains duplicate object IDs.");
  for (const id of requestedIds) {
    mcpBridgeAssert(!objects.some(mesh => mesh.userData.id === id), "ID_CONFLICT", `An object already exists with ID '${id}'.`, { id });
  }
  recordHistory();
  const created = specs.map(spec => addObject(spec, { record: false, select: false, update: false }));
  updateAll();
  mcpBridgeRevision++;
  return {
    revision: mcpBridgeRevision,
    createdIds: created.map(mesh => mesh.userData.id),
    objects: created.map(serializeObject)
  };
}

const mcpBridgeReferenceMatchKeys = new Set([
  "imageDataUrl", "sourceMode", "buildMode", "cols", "rows", "heightScale", "depth", "back", "threshold", "darkForeground",
  "id", "name", "position", "rotation", "scale", "color", "roughness", "opacity", "materialRule", "hidden",
  "groupId", "groupName", "linkId", "linkColor", "pivot"
]);

// Builds a mesh from a reference image using the same relief carving
// pipeline (buildReliefGeometry, app/modules/meshes.js) that already backs
// the editor's "Load image" panel, so there is exactly one implementation
// of the algorithm behind both the UI and the MCP command.
async function mcpBridgeCreateMeshFromReferenceImage(params) {
  mcpBridgeAssertAllowedKeys(params, mcpBridgeReferenceMatchKeys, "params");
  const imageDataUrl = mcpBridgeImageDataUrl(params.imageDataUrl, "params.imageDataUrl");
  const sourceMode = params.sourceMode === undefined
    ? "sheet"
    : mcpBridgeString(params.sourceMode, "params.sourceMode", { required: true, maxLength: 16 });
  mcpBridgeAssert(["single", "sheet"].includes(sourceMode), "INVALID_PARAMS", "params.sourceMode must be 'single' or 'sheet'.");
  const buildMode = params.buildMode === undefined
    ? (sourceMode === "sheet" ? "hybridV47" : "standard")
    : mcpBridgeString(params.buildMode, "params.buildMode", { required: true, maxLength: 24 });
  mcpBridgeAssert(["standard", "solidVisualHull", "recoveredV30", "hybridV46", "hybridV47"].includes(buildMode), "INVALID_PARAMS", "params.buildMode must be 'standard', 'solidVisualHull', 'recoveredV30', 'hybridV46', or 'hybridV47'.");
  const cols = params.cols === undefined ? (buildMode === "solidVisualHull" || buildMode === "hybridV47" ? 160 : 56) : mcpBridgeInteger(params.cols, "params.cols", { min: 8, max: 160 });
  const rows = params.rows === undefined ? (buildMode === "solidVisualHull" || buildMode === "hybridV47" ? 220 : 96) : mcpBridgeInteger(params.rows, "params.rows", { min: 8, max: 220 });
  const heightScale = params.heightScale === undefined ? 6 : mcpBridgeFiniteNumber(params.heightScale, "params.heightScale", { min: .5, max: 20 });
  const depth = params.depth === undefined ? .9 : mcpBridgeFiniteNumber(params.depth, "params.depth", { min: 0, max: 5 });
  const back = params.back === undefined ? .22 : mcpBridgeFiniteNumber(params.back, "params.back", { min: 0, max: 3 });
  const threshold = params.threshold === undefined ? 70 : mcpBridgeFiniteNumber(params.threshold, "params.threshold", { min: 0, max: 255 });
  const smoothPasses = 4;
  let darkForeground = false;
  if (params.darkForeground !== undefined) {
    mcpBridgeAssert(typeof params.darkForeground === "boolean", "INVALID_PARAMS", "params.darkForeground must be a boolean.");
    darkForeground = params.darkForeground;
  }

  const objectSpecSource = Object.fromEntries(
    Object.entries(params).filter(([key]) => mcpBridgeCreateKeys.has(key) && key !== "geometry" && key !== "shape")
  );
  if (Object.prototype.hasOwnProperty.call(objectSpecSource, "id")) {
    mcpBridgeAssert(!objects.some(mesh => mesh.userData.id === objectSpecSource.id), "ID_CONFLICT", `An object already exists with ID '${objectSpecSource.id}'.`, { id: objectSpecSource.id });
  }
  const objectSpec = mcpBridgeValidateCreateSpec(objectSpecSource, 0);

  const { imageData } = await decodeImageDataUrl(imageDataUrl);
  const { positions, uvs, meta } = buildReliefGeometry({
    imageData, cols, rows, scale: heightScale, depth, back, threshold, smoothPasses, darkForeground,
    sourceMode, buildMode, sourceName: objectSpec.name || "reference match image"
  });

  recordHistory("reference match mesh");
  const mesh = addObject({
    ...objectSpec,
    shape: "imageRelief",
    name: objectSpec.name || "reference match mesh",
    geometry: { positions, uvs }
  }, { record: false, select: false, update: false });
  mesh.userData.reliefSource = { ...meta };
  updateAll();
  mcpBridgeRevision++;
  return {
    revision: mcpBridgeRevision,
    createdIds: [mesh.userData.id],
    objects: [serializeObject(mesh)],
    triangleCount: positions.length / 9,
    meta
  };
}

function mcpBridgeUpdateObjects(params) {
  mcpBridgeAssertAllowedKeys(params, new Set(["objects", "expectedRevision"]), "params");
  const batch = mcpBridgeBatch(params, "objects");
  const updates = batch.map((entry, index) => {
    mcpBridgeAssert(mcpBridgeIsPlainObject(entry), "INVALID_PARAMS", `objects[${index}] must be an object.`);
    const entryKeys = Object.keys(entry);
    mcpBridgeAssert(entryKeys.includes("id"), "INVALID_PARAMS", `objects[${index}].id is required.`);
    const id = mcpBridgeString(entry.id, `objects[${index}].id`, { required: true, maxLength: 128 });
    const patchSource = Object.prototype.hasOwnProperty.call(entry, "patch")
      ? entry.patch
      : Object.fromEntries(Object.entries(entry).filter(([key]) => key !== "id"));
    if (Object.prototype.hasOwnProperty.call(entry, "patch")) {
      mcpBridgeAssertAllowedKeys(entry, new Set(["id", "patch"]), `objects[${index}]`);
    }
    return {
      id,
      mesh: mcpBridgeExactObject(id, `objects[${index}].id`),
      patch: mcpBridgeValidateUpdatePatch(patchSource, `objects[${index}].patch`)
    };
  });
  mcpBridgeAssert(new Set(updates.map(update => update.id)).size === updates.length, "INVALID_PARAMS", "The batch contains duplicate object IDs.");
  recordHistory();
  updates.forEach(update => mcpBridgeApplyUpdate(update.mesh, update.patch));
  updateAll();
  mcpBridgeRevision++;
  return {
    revision: mcpBridgeRevision,
    updatedIds: updates.map(update => update.id),
    objects: updates.map(update => serializeObject(update.mesh))
  };
}

function mcpBridgeDeleteObjects(params) {
  mcpBridgeAssertAllowedKeys(params, new Set(["ids", "expectedRevision"]), "params");
  const ids = mcpBridgeUniqueIds(params.ids);
  const meshes = ids.map((id, index) => mcpBridgeExactObject(id, `ids[${index}]`));
  const removesPrimarySelection = !!selected && ids.includes(selected.userData.id);
  recordHistory();
  if (removesPrimarySelection) selected = null;
  meshes.forEach(mesh => removeObject(mesh, { record: false, update: false }));
  // Refresh both the transform attachment and the UI exactly once after the
  // complete batch. removeObject intentionally runs without its own updates.
  if (removesPrimarySelection) selectObject(null, { keepGroup: true });
  else updateAll();
  mcpBridgeRevision++;
  return { revision: mcpBridgeRevision, deletedIds: ids };
}

async function mcpBridgeCombineShell(params) {
  mcpBridgeAssertAllowedKeys(params, new Set(["ids", "name", "resolution", "expectedRevision"]), "params");
  const ids = mcpBridgeUniqueIds(params.ids);
  mcpBridgeAssert(ids.length >= 2, "INVALID_PARAMS", "objects.combineShell needs at least two object IDs.");
  const meshes = ids.map((id, index) => mcpBridgeExactObject(id, `ids[${index}]`));
  const name = params.name === undefined
    ? "AI Generated Shell"
    : mcpBridgeString(params.name, "params.name", { required: true, maxLength: 120 });
  const resolution = params.resolution === undefined
    ? null
    : mcpBridgeInteger(params.resolution, "params.resolution", { min: 18, max: 64 });
  const result = await combineMeshesIntoShell(meshes, { name, resolution, announce: false });
  mcpBridgeRevision++;
  return {
    revision: mcpBridgeRevision,
    createdIds: [result.mesh.userData.id],
    deletedIds: ids,
    object: serializeObject(result.mesh),
    shell: {
      connectedComponents: result.shellCount,
      sourceTriangles: result.sourceTriangles,
      outputTriangles: result.outputTriangles,
      resolution: result.resolution,
      dimensions: result.dimensions
    }
  };
}

function mcpBridgeSelectObjects(params) {
  mcpBridgeAssertAllowedKeys(params, new Set(["ids", "expectedRevision"]), "params");
  const ids = mcpBridgeUniqueIds(params.ids, "ids", { allowEmpty: true });
  const meshes = ids.map((id, index) => mcpBridgeExactObject(id, `ids[${index}]`));
  activeGroupIds = ids.length > 1 ? [...ids] : [];
  selectedGroupRecordId = null;
  selectObject(meshes[0] || null, { keepGroup: true });
  mcpBridgeRevision++;
  return { revision: mcpBridgeRevision, selectedIds: ids, primaryId: meshes[0]?.userData?.id || null };
}

function mcpBridgeUndo() {
  mcpBridgeAssert(history.length > 0, "NOTHING_TO_UNDO", "There is no scene mutation to undo.");
  undo();
  mcpBridgeRevision++;
  return { revision: mcpBridgeRevision, scene: mcpBridgeSceneResult({ detail: "summary" }) };
}

function mcpBridgeAuditResult(params) {
  mcpBridgeAssertAllowedKeys(params, new Set(["limit", "sinceSequence"]), "params");
  const limit = params.limit === undefined
    ? 50
    : mcpBridgeInteger(params.limit, "params.limit", { min: 1, max: mcpBridgeMaxAuditEntries });
  const sinceSequence = params.sinceSequence === undefined
    ? 0
    : mcpBridgeInteger(params.sinceSequence, "params.sinceSequence", { min: 0 });
  const entries = mcpBridgeAuditEntries.filter(entry => entry.sequence > sinceSequence).slice(-limit);
  return { revision: mcpBridgeRevision, entries, latestSequence: mcpBridgeAuditSequence };
}

function mcpBridgeNormalizeMethod(method) {
  return mcpBridgeString(method, "method", { required: true, maxLength: 80 });
}

function mcpBridgeIsMutation(method) {
  return ["objects.create", "objects.combineShell", "objects.update", "objects.delete", "selection.set", "undo", "referenceMatch.createMesh"].includes(method);
}

function mcpBridgeValidateExpectedRevision(command, params, method) {
  const raw = command.expectedRevision ?? params.expectedRevision;
  if (raw === undefined) return;
  const expectedRevision = mcpBridgeInteger(raw, "expectedRevision", { min: 0 });
  mcpBridgeAssert(expectedRevision === mcpBridgeRevision, "REVISION_CONFLICT", `Expected revision ${expectedRevision}, but the live scene is revision ${mcpBridgeRevision}.`, {
    expectedRevision,
    actualRevision: mcpBridgeRevision,
    mutation: mcpBridgeIsMutation(method)
  });
}

function mcpBridgeValidateWorkSession(command, method) {
  if (!mcpBridgeIsMutation(method) || command.workSession === undefined) return;
  const session = command.workSession;
  mcpBridgeAssert(mcpBridgeIsPlainObject(session), "SESSION_INVALID", "The timed work-session context is invalid.");
  const sessionId = mcpBridgeString(session.id, "workSession.id", { required: true, maxLength: 128 });
  const generation = mcpBridgeInteger(session.generation, "workSession.generation", { min: 1 });
  if (session.status !== undefined) {
    mcpBridgeAssert(session.status === "running", "SESSION_NOT_RUNNING", "The timed work session is no longer running.", {
      sessionId,
      generation,
      status: session.status
    });
  }
  if (session.unlimited === true) return;
  const deadlineAt = typeof session.deadlineAt === "number"
    ? session.deadlineAt
    : Date.parse(String(session.deadlineAt || ""));
  mcpBridgeAssert(Number.isFinite(deadlineAt), "SESSION_INVALID", "The timed work-session deadline is invalid.", {
    sessionId,
    generation
  });
  mcpBridgeAssert(Date.now() < deadlineAt, "SESSION_TIME_LIMIT", "The timed work session has reached its deadline. Start or resume a session before making more changes.", {
    sessionId,
    generation,
    deadlineAt: new Date(deadlineAt).toISOString()
  });
}

function mcpBridgeAuditParams(method, params) {
  if (["objects.create", "objects.update"].includes(method)) {
    return {
      count: Array.isArray(params.objects) ? params.objects.length : 0,
      ids: Array.isArray(params.objects) ? params.objects.map(entry => entry?.id).filter(Boolean).slice(0, mcpBridgeMaxBatchSize) : []
    };
  }
  if (["objects.combineShell", "objects.delete", "selection.set"].includes(method)) {
    return { count: Array.isArray(params.ids) ? params.ids.length : 0, ids: Array.isArray(params.ids) ? params.ids.slice(0, mcpBridgeMaxBatchSize) : [] };
  }
  if (method === "referenceMatch.createMesh") {
    // Never write the (potentially multi-MB) base64 image into the audit log.
    const { imageDataUrl, ...rest } = params;
    return { ...rest, imageDataUrlLength: typeof imageDataUrl === "string" ? imageDataUrl.length : 0 };
  }
  return { ...params };
}

function mcpBridgeResultIds(result) {
  if (!mcpBridgeIsPlainObject(result)) return [];
  for (const key of ["createdIds", "updatedIds", "deletedIds", "selectedIds"]) {
    if (Array.isArray(result[key])) return result[key].filter(id => typeof id === "string").slice(0, mcpBridgeMaxBatchSize);
  }
  return [];
}

function mcpBridgeAppendAudit({ command, method, params, beforeRevision, ok, result = null, error = null }) {
  const entry = {
    sequence: ++mcpBridgeAuditSequence,
    timestamp: new Date().toISOString(),
    actor: "mcp",
    method,
    params: mcpBridgeAuditParams(method, params),
    beforeRevision,
    afterRevision: mcpBridgeRevision,
    ok
  };
  if (typeof command?.id === "string" && command.id.trim()) entry.commandId = command.id;
  if (mcpBridgeIsPlainObject(command?.workSession)) {
    entry.workSession = {
      id: String(command.workSession.id || ""),
      generation: Number(command.workSession.generation) || 0
    };
  }
  const targetIds = mcpBridgeResultIds(result);
  if (targetIds.length) entry.targetIds = targetIds;
  if (error) entry.error = { code: error.code || "INTERNAL_ERROR", message: error.message || String(error) };
  mcpBridgeAuditEntries.push(entry);
  if (mcpBridgeAuditEntries.length > mcpBridgeMaxAuditEntries) mcpBridgeAuditEntries.splice(0, mcpBridgeAuditEntries.length - mcpBridgeMaxAuditEntries);
  return entry;
}

function mcpBridgeLatestAuditForCommand(commandId) {
  for (let index = mcpBridgeAuditEntries.length - 1; index >= 0; index -= 1) {
    if (mcpBridgeAuditEntries[index]?.commandId === commandId) return mcpBridgeAuditEntries[index];
  }
  return null;
}

function mcpBridgeRelayAuditPayload(commandId) {
  const entry = mcpBridgeLatestAuditForCommand(commandId);
  if (!entry) return null;
  return {
    targetIds: Array.isArray(entry.targetIds) ? entry.targetIds.slice(0, mcpBridgeMaxBatchSize) : [],
    beforeRevision: entry.beforeRevision,
    afterRevision: entry.afterRevision
  };
}

async function mcpBridgeExecuteCommand(command) {
  mcpBridgeAssert(mcpBridgeIsPlainObject(command), "INVALID_REQUEST", "The command must be an object.");
  const method = mcpBridgeNormalizeMethod(command.method);
  const params = command.params === undefined ? {} : command.params;
  mcpBridgeAssert(mcpBridgeIsPlainObject(params), "INVALID_PARAMS", "params must be an object.");
  const beforeRevision = mcpBridgeRevision;
  try {
    mcpBridgeValidateWorkSession(command, method);
    mcpBridgeValidateExpectedRevision(command, params, method);
    let result;
    if (method === "capabilities.get") {
      mcpBridgeAssertAllowedKeys(params, new Set(), "params");
      result = mcpBridgeCapabilitiesResult();
    }
    else if (method === "scene.get") result = mcpBridgeSceneResult(params);
    else if (method === "selection.get") {
      mcpBridgeAssertAllowedKeys(params, new Set(), "params");
      result = mcpBridgeSelectionResult();
    }
    else if (method === "objects.create") result = mcpBridgeCreateObjects(params);
    else if (method === "objects.combineShell") result = await mcpBridgeCombineShell(params);
    else if (method === "referenceMatch.createMesh") result = await mcpBridgeCreateMeshFromReferenceImage(params);
    else if (method === "objects.update") result = mcpBridgeUpdateObjects(params);
    else if (method === "objects.delete") result = mcpBridgeDeleteObjects(params);
    else if (method === "selection.set") result = mcpBridgeSelectObjects(params);
    else if (method === "undo") {
      mcpBridgeAssertAllowedKeys(params, new Set(["expectedRevision"]), "params");
      result = mcpBridgeUndo();
    }
    else if (method === "audit.get") result = mcpBridgeAuditResult(params);
    else throw new McpBridgeError("METHOD_NOT_FOUND", `Unknown MCP bridge method '${method}'.`);
    mcpBridgeAppendAudit({ command, method, params, beforeRevision, ok: true, result });
    return result;
  }
  catch (error) {
    mcpBridgeAppendAudit({ command, method, params, beforeRevision, ok: false, error });
    throw error;
  }
}

function mcpBridgeErrorPayload(error) {
  const payload = {
    code: error?.code || "INTERNAL_ERROR",
    message: error?.message || "The browser bridge could not complete the command."
  };
  if (error?.details !== null && error?.details !== undefined) payload.details = error.details;
  return payload;
}

function mcpBridgeDelay(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function mcpBridgePreflightRelayCommand(command) {
  const method = mcpBridgeNormalizeMethod(command?.method);
  if (!mcpBridgeIsMutation(method) || command?.workSession === undefined) return;
  const id = mcpBridgeString(command?.id, "id", { required: true, maxLength: 128 });
  const response = await fetch(mcpBridgePreflightUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    cache: "no-store",
    body: JSON.stringify({ id })
  });
  let payload = null;
  try {
    payload = await response.json();
  }
  catch {
    // A malformed relay response is handled as a failed preflight below.
  }
  if (response.ok && payload?.ok === true) return;
  const relayError = mcpBridgeIsPlainObject(payload?.error) ? payload.error : null;
  throw new McpBridgeError(
    typeof relayError?.code === "string" ? relayError.code : "SESSION_PREFLIGHT_FAILED",
    typeof relayError?.message === "string"
      ? relayError.message
      : `The timed work session could not be verified immediately before this mutation (HTTP ${response.status}).`
  );
}

async function mcpBridgePostResult(payload) {
  const response = await fetch(mcpBridgeResultUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`MCP result relay returned HTTP ${response.status}.`);
}

async function mcpBridgeHandleRelayCommand(command) {
  const id = command?.id;
  if (typeof id !== "string" || !id.trim()) return;
  try {
    await mcpBridgePreflightRelayCommand(command);
    const result = await mcpBridgeExecuteCommand(command);
    await mcpBridgePostResult({ id, ok: true, result, audit: mcpBridgeRelayAuditPayload(id) });
  }
  catch (error) {
    try {
      await mcpBridgePostResult({
        id,
        ok: false,
        error: mcpBridgeErrorPayload(error),
        audit: mcpBridgeRelayAuditPayload(id)
      });
    }
    catch {
      // The relay owns transport diagnostics. The editor stays quiet and retries polling.
    }
  }
}

async function mcpBridgePollLoop() {
  while (mcpBridgePolling) {
    try {
      mcpBridgePollAbortController = new AbortController();
      const timeoutId = setTimeout(() => mcpBridgePollAbortController?.abort(), 30_000);
      let response;
      try {
        response = await fetch(`${mcpBridgeNextUrl}?waitMs=25000`, {
          method: "GET",
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal: mcpBridgePollAbortController.signal
        });
      }
      finally {
        clearTimeout(timeoutId);
      }
      if (!mcpBridgePolling) break;
      if (response.status === 204) continue;
      if (!response.ok) {
        await mcpBridgeDelay(response.status === 404 ? 2_500 : 1_000);
        continue;
      }
      const command = await response.json();
      await mcpBridgeHandleRelayCommand(command);
    }
    catch (error) {
      if (!mcpBridgePolling) break;
      if (error?.name !== "AbortError") await mcpBridgeDelay(1_000);
    }
    finally {
      mcpBridgePollAbortController = null;
    }
  }
}

function mcpBridgeCanPollHere() {
  return ["127.0.0.1", "localhost", "::1"].includes(window.location.hostname);
}

function mcpBridgeStartPolling() {
  if (mcpBridgePolling || !mcpBridgeCanPollHere()) return false;
  mcpBridgePolling = true;
  void mcpBridgePollLoop();
  return true;
}

function mcpBridgeStopPolling() {
  mcpBridgePolling = false;
  mcpBridgePollAbortController?.abort();
}

window.BoltWorksMcpBridge = Object.freeze({
  version: mcpBridgeVersion,
  execute: mcpBridgeExecuteCommand,
  startPolling: mcpBridgeStartPolling,
  stopPolling: mcpBridgeStopPolling,
  status: () => ({
    version: mcpBridgeVersion,
    revision: mcpBridgeRevision,
    polling: mcpBridgePolling,
    auditEntries: mcpBridgeAuditEntries.length
  })
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mcpBridgeStartPolling, { once: true });
}
else {
  queueMicrotask(mcpBridgeStartPolling);
}

window.addEventListener("pagehide", mcpBridgeStopPolling, { once: true });
