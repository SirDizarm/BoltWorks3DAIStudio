import { createGeometry as createDetailedImageMeshGeometry } from "../tools/image-to-mesh/generator.js";

function geometryFromPositions(positions) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function addQuad(positions, a, b, c, d) {
  positions.push(...a, ...b, ...c, ...a, ...c, ...d);
}

function addTriangleBothSides(positions, a, b, c) {
  positions.push(...a, ...b, ...c, ...a, ...c, ...b);
}

function addQuadBothSides(positions, a, b, c, d) {
  addTriangleBothSides(positions, a, b, c);
  addTriangleBothSides(positions, a, c, d);
}

function addBoxToPositions(positions, center, size) {
  const [cx, cy, cz] = center;
  const [sx, sy, sz] = size.map(value => value / 2);
  const v = {
    lbf: [cx - sx, cy - sy, cz + sz],
    rbf: [cx + sx, cy - sy, cz + sz],
    rtf: [cx + sx, cy + sy, cz + sz],
    ltf: [cx - sx, cy + sy, cz + sz],
    lbb: [cx - sx, cy - sy, cz - sz],
    rbb: [cx + sx, cy - sy, cz - sz],
    rtb: [cx + sx, cy + sy, cz - sz],
    ltb: [cx - sx, cy + sy, cz - sz]
  };
  addQuad(positions, v.lbf, v.rbf, v.rtf, v.ltf);
  addQuad(positions, v.rbb, v.lbb, v.ltb, v.rtb);
  addQuad(positions, v.lbb, v.lbf, v.ltf, v.ltb);
  addQuad(positions, v.rbf, v.rbb, v.rtb, v.rtf);
  addQuad(positions, v.ltf, v.rtf, v.rtb, v.ltb);
  addQuad(positions, v.lbb, v.rbb, v.rbf, v.lbf);
}

function makeCompositeBoxGeometry(boxes) {
  const positions = [];
  for (const box of boxes) addBoxToPositions(positions, box.center, box.size);
  return geometryFromPositions(positions);
}

function makeWedgeGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(-.5, -.5);
  shape.lineTo(.5, -.5);
  shape.lineTo(.5, .5);
  shape.lineTo(-.5, -.5);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, steps: 1 });
  geometry.translate(0, 0, -.5);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function orientExtrudedGeometry(geometry, depth, axis) {
  geometry.translate(0, 0, -depth / 2);
  if (axis === "y") geometry.rotateX(Math.PI / 2);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function makeRingShape(innerRadius, outerRadius, segments) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, innerRadius, Math.PI * 2, 0, true);
  shape.holes.push(hole);
  return shape;
}

function makeArcBandShape(innerRadius, outerRadius, segments, start, end) {
  const shape = new THREE.Shape();
  for (let i = 0; i <= segments; i++) {
    const angle = start + (end - start) * (i / segments);
    const x = Math.cos(angle) * outerRadius;
    const y = Math.sin(angle) * outerRadius;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  for (let i = segments; i >= 0; i--) {
    const angle = start + (end - start) * (i / segments);
    shape.lineTo(Math.cos(angle) * innerRadius, Math.sin(angle) * innerRadius);
  }
  shape.closePath();
  return shape;
}

function makeRingLikeGeometry({ innerRadius = .28, outerRadius = .5, depth = .1, segments = 48, start = 0, end = Math.PI * 2, axis = "z" } = {}) {
  const isFullRing = Math.abs(end - start) >= Math.PI * 2 - .001;
  const shape = isFullRing
    ? makeRingShape(innerRadius, outerRadius, segments)
    : makeArcBandShape(innerRadius, outerRadius, segments, start, end);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    steps: 1,
    curveSegments: segments
  });
  return orientExtrudedGeometry(geometry, depth, axis);
}

function makeCurvedPanelGeometry() {
  const geometry = makeRingLikeGeometry({ innerRadius: .58, outerRadius: .68, depth: 1, segments: 24, start: THREE.MathUtils.degToRad(55), end: THREE.MathUtils.degToRad(125), axis: "y" });
  geometry.center();
  geometry.computeVertexNormals();
  return geometry;
}

function makeHollowBoxGeometry() {
  return makeCompositeBoxGeometry([
    { center: [0, .42, 0], size: [1, .16, .22] },
    { center: [0, -.42, 0], size: [1, .16, .22] },
    { center: [-.42, 0, 0], size: [.16, .68, .22] },
    { center: [.42, 0, 0], size: [.16, .68, .22] }
  ]);
}

function makeArchGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(-.5, -.5);
  shape.lineTo(-.5, 0);
  shape.absarc(0, 0, .5, Math.PI, 0, true);
  shape.lineTo(.5, -.5);
  shape.lineTo(.34, -.5);
  shape.lineTo(.34, 0);
  shape.absarc(0, 0, .34, 0, Math.PI, false);
  shape.lineTo(-.34, -.5);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: .24,
    bevelEnabled: false,
    curveSegments: 28
  });
  geometry.center();
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function makeStairGeometry() {
  const positions = [];
  const steps = 4;
  for (let i = 0; i < steps; i++) {
    addBoxToPositions(positions, [0, -.5 + (i + 1) / steps / 2, -.5 + (i + .5) / steps], [1, (i + 1) / steps, 1 / steps]);
  }
  return geometryFromPositions(positions);
}

function makeHemisphereGeometry({ radius = .55, heightScale = 1, segments = 32, rings = 12 } = {}) {
  const positions = [];
  for (let y = 0; y < rings; y++) {
    const phi0 = y / rings * Math.PI / 2;
    const phi1 = (y + 1) / rings * Math.PI / 2;
    for (let x = 0; x < segments; x++) {
      const theta0 = x / segments * Math.PI * 2;
      const theta1 = (x + 1) / segments * Math.PI * 2;
      const point = (phi, theta) => [
        Math.sin(phi) * Math.cos(theta) * radius,
        Math.cos(phi) * radius * heightScale,
        Math.sin(phi) * Math.sin(theta) * radius
      ];
      addQuad(positions, point(phi0, theta0), point(phi0, theta1), point(phi1, theta1), point(phi1, theta0));
    }
  }
  const center = [0, 0, 0];
  for (let x = 0; x < segments; x++) {
    const theta0 = x / segments * Math.PI * 2;
    const theta1 = (x + 1) / segments * Math.PI * 2;
    const p0 = [Math.cos(theta0) * radius, 0, Math.sin(theta0) * radius];
    const p1 = [Math.cos(theta1) * radius, 0, Math.sin(theta1) * radius];
    positions.push(...center, ...p0, ...p1);
  }
  return geometryFromPositions(positions);
}

function makePrismGeometry() {
  const positions = [];
  const front = [[-.5, -.42, .5], [.5, -.42, .5], [0, .48, .5]];
  const back = [[-.5, -.42, -.5], [.5, -.42, -.5], [0, .48, -.5]];
  positions.push(...front[0], ...front[1], ...front[2]);
  positions.push(...back[0], ...back[2], ...back[1]);
  addQuad(positions, back[0], front[0], front[2], back[2]);
  addQuad(positions, front[1], back[1], back[2], front[2]);
  addQuad(positions, back[1], front[1], front[0], back[0]);
  return geometryFromPositions(positions);
}

function makeHeartGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, .24);
  shape.bezierCurveTo(-.52, .72, -1.02, .12, -.52, -.34);
  shape.bezierCurveTo(-.2, -.64, 0, -.82, 0, -.82);
  shape.bezierCurveTo(0, -.82, .2, -.64, .52, -.34);
  shape.bezierCurveTo(1.02, .12, .52, .72, 0, .24);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: .2,
    bevelEnabled: true,
    bevelThickness: .025,
    bevelSize: .025,
    bevelSegments: 2
  });
  geometry.center();
  geometry.scale(.78, .78, 1);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

const meshFactory = createMeshFactory({
  builders: {
    box: () => new THREE.BoxGeometry(1, 1, 1),
    sphere: () => new THREE.SphereGeometry(0.55, 32, 18),
    cylinder: () => new THREE.CylinderGeometry(0.48, 0.48, 1, 32),
    cone: () => new THREE.ConeGeometry(0.55, 1, 32),
    torus: () => new THREE.TorusGeometry(0.42, 0.14, 16, 40),
    panel: () => new THREE.BoxGeometry(1, 1, .08),
    wedge: makeWedgeGeometry,
    hollowBox: makeHollowBoxGeometry,
    tube: () => makeRingLikeGeometry({ innerRadius: .32, outerRadius: .5, depth: 1, segments: 48, axis: "y" }),
    curvedPanel: makeCurvedPanelGeometry,
    ring: () => makeRingLikeGeometry({ innerRadius: .28, outerRadius: .5, depth: .1, segments: 48, axis: "z" }),
    arch: makeArchGeometry,
    hemisphere: makeHemisphereGeometry,
    dome: () => makeHemisphereGeometry({ radius: .55, heightScale: .55, segments: 32, rings: 10 }),
    capsule: () => new THREE.CapsuleGeometry(.32, .7, 8, 24),
    pyramid: () => {
      const geometry = new THREE.ConeGeometry(.68, 1, 4);
      geometry.rotateY(Math.PI / 4);
      return geometry;
    },
    prism: makePrismGeometry,
    tetrahedron: () => new THREE.TetrahedronGeometry(.68, 0),
    pyramidFrustum: () => {
      const geometry = new THREE.CylinderGeometry(.28, .68, 1, 4, 1, false);
      geometry.rotateY(Math.PI / 4);
      return geometry;
    },
    facetedBallLow: () => new THREE.IcosahedronGeometry(.58, 0),
    facetedBallMedium: () => new THREE.IcosahedronGeometry(.58, 1),
    facetedBallHigh: () => new THREE.IcosahedronGeometry(.58, 2),
    heart: makeHeartGeometry,
    stair: makeStairGeometry
  }
});

const {
  shapeFactories,
  shapeAliases,
  normalizeShapeName,
  proceduralCatalog,
  buildProceduralAssembly,
  listProceduralTemplates
} = meshFactory;


function normalizeTextureRotation(value = 0) {
  const number = Number(value) || 0;
  return ((number % 360) + 360) % 360;
}

function isImageFileName(name = "") {
  return /\.(png|jpe?g|webp|bmp|gif)$/i.test(String(name || ""));
}

function normalizeRobloxAssetId(value = "") {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^rbxassetid:\/\/\d+$/i.test(text)) return `rbxassetid://${text.match(/\d+$/)[0]}`;
  if (/^\d+$/.test(text)) return `rbxassetid://${text}`;
  return text;
}

function normalizeMaterialRule(value = "") {
  const key = String(value || "").trim();
  return materialRules[key] ? key : "auto";
}

function nextTextureLibraryName(name = "Texture") {
  const clean = String(name || "Texture").trim() || "Texture";
  if (!textureLibrary.has(clean)) return clean;
  let index = 2;
  while (textureLibrary.has(`${clean} (${index})`)) index++;
  return `${clean} (${index})`;
}

function registerTextureAsset(name, dataUrl, { replace = false, robloxAssetId = null } = {}) {
  if (!name || !dataUrl) return null;
  const existing = textureLibrary.get(name);
  const normalizedRobloxAssetId = normalizeRobloxAssetId(robloxAssetId ?? existing?.robloxAssetId ?? "");
  if (existing && existing.dataUrl === dataUrl) {
    if (robloxAssetId !== null && existing.robloxAssetId !== normalizedRobloxAssetId) {
      existing.robloxAssetId = normalizedRobloxAssetId;
    }
    return existing.name;
  }
  const storedName = replace ? name : (existing ? nextTextureLibraryName(name) : name);
  textureLibrary.set(storedName, {
    name: storedName,
    dataUrl,
    robloxAssetId: normalizedRobloxAssetId
  });
  return storedName;
}

function serializeTextureLibrary() {
  syncCurrentTextureRobloxId({ writeInput: true });
  return [...textureLibrary.values()].map(entry => ({
    name: entry.name,
    dataUrl: entry.dataUrl,
    robloxAssetId: normalizeRobloxAssetId(entry.robloxAssetId || "")
  }));
}

function restoreTextureLibrary(entries = [], { replace = false } = {}) {
  if (replace) textureLibrary.clear();
  for (const entry of entries || []) {
    if (!entry?.name || !entry?.dataUrl) continue;
    registerTextureAsset(entry.name, entry.dataUrl, { replace: true, robloxAssetId: entry.robloxAssetId || "" });
  }
  refreshTextureLibraryUi();
}

function currentTextureLibraryName() {
  const targets = textureTargetObjects();
  if (targets.length !== 1) return "";
  const match = [...textureLibrary.values()].find(entry => entry.dataUrl === targets[0].userData.textureUrl);
  return match?.name || "";
}

function meshDetailsMesh() {
  return meshDetailsState.meshId ? findObject(meshDetailsState.meshId) : null;
}

function materialRuleMeta(rule) {
  return materialRules[normalizeMaterialRule(rule)];
}

function materialRulePill(rule) {
  return materialRuleMeta(rule)?.label || materialRules.auto.label;
}

function populateMaterialRuleSelect() {
  if (!els.meshMaterialRuleSelect) return;
  if (els.meshMaterialRuleSelect.options.length) return;
  for (const [key, meta] of Object.entries(materialRules)) {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = meta.label;
    els.meshMaterialRuleSelect.append(option);
  }
}

function renderMeshMaterialRuleInfo(rule) {
  if (!els.meshMaterialRuleInfo) return;
  const meta = materialRuleMeta(rule);
  els.meshMaterialRuleInfo.innerHTML = `
    <div><strong>Hardness</strong> ${meta.hardness}</div>
    <div><strong>Behavior</strong> ${meta.behavior}</div>
    <div><strong>Good For</strong> ${meta.usage}</div>
  `;
  if (els.meshDetailsFutureNotes) {
    els.meshDetailsFutureNotes.textContent = `Future deformation and simulation tools can use the ${meta.label.toLowerCase()} rule to treat this mesh more intelligently.`;
  }
}

function refreshMeshDetails() {
  const mesh = meshDetailsMesh();
  if (!mesh) return;
  populateMaterialRuleSelect();
  const textureType = mesh.userData.textureUrl ? "texture" : (mesh.userData.geometry ? "mesh" : mesh.userData.shape);
  const position = mesh.position.toArray().map(round).join(", ");
  const rotation = [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z].map(v => round(THREE.MathUtils.radToDeg(v))).join(", ");
  const scale = mesh.scale.toArray().map(round).join(", ");
  const group = groupRecord(mesh.userData.groupId)?.name || mesh.userData.groupName || "None";
  const triangles = Math.round((mesh.geometry.index ? mesh.geometry.index.count : mesh.geometry.getAttribute("position")?.count || 0) / 3);
  const vertices = mesh.geometry.getAttribute("position")?.count || 0;

  els.meshDetailsTitle.textContent = `Mesh Details - ${mesh.name}`;
  els.meshDetailsNameInput.value = mesh.name;
  els.meshMaterialRuleSelect.value = normalizeMaterialRule(mesh.userData.materialRule || "auto");
  renderMeshMaterialRuleInfo(els.meshMaterialRuleSelect.value);
  els.meshDetailsFacts.innerHTML = `
    <div><strong>Mesh ID</strong><code>${mesh.userData.id}</code></div>
    <div><strong>Shape</strong>${mesh.userData.shape}</div>
    <div><strong>Render Type</strong>${textureType}</div>
    <div><strong>Group</strong>${group}</div>
    <div><strong>Triangles</strong>${triangles}</div>
    <div><strong>Vertices</strong>${vertices}</div>
    <div><strong>Position</strong>${position}</div>
    <div><strong>Rotation</strong>${rotation}</div>
    <div><strong>Scale</strong>${scale}</div>
    <div><strong>Texture</strong>${mesh.userData.textureName || "None"}</div>
  `;
  if (mesh.userData.textureUrl) {
    const safeName = mesh.userData.textureName || "Texture";
    const showUvGuide = !!els.meshDetailsShowUvInput?.checked;
    els.meshDetailsTexturePreview.innerHTML = `<div class="mesh-details-image-stage"><img src="${mesh.userData.textureUrl}" alt="${safeName} preview" />${showUvGuide ? '<canvas aria-hidden="true"></canvas>' : ""}</div><div class="api-note">${safeName}${showUvGuide ? " - UV Guide overlay" : ""}</div>`;
    if (showUvGuide) {
      const image = els.meshDetailsTexturePreview.querySelector("img");
      const canvas = els.meshDetailsTexturePreview.querySelector("canvas");
      const drawOverlay = () => drawMeshDetailsUvGuide(mesh, image, canvas);
      if (image.complete) drawOverlay();
      else image.addEventListener("load", drawOverlay, { once: true });
    }
  } else {
    els.meshDetailsTexturePreview.innerHTML = `<div class="api-note">No texture assigned to this mesh yet.</div>`;
  }
}

function openMeshDetails(meshId) {
  const mesh = findObject(meshId);
  if (!mesh) return;
  meshDetailsState.meshId = mesh.userData.id;
  if (els.meshDetailsShowUvInput) els.meshDetailsShowUvInput.checked = false;
  refreshMeshDetails();
  els.meshDetailsModal.classList.add("open");
  els.meshDetailsModal.setAttribute("aria-hidden", "false");
  els.meshDetailsNameInput.focus();
  els.meshDetailsNameInput.select();
}

function drawMeshDetailsUvGuide(mesh, image, canvas) {
  const geometry = mesh?.geometry;
  const uv = geometry?.getAttribute("uv");
  const position = geometry?.getAttribute("position");
  if (!canvas || !image || !uv || !position) return;
  const width = Math.max(1, image.naturalWidth || 1024);
  const height = Math.max(1, image.naturalHeight || 1024);
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.clearRect(0, 0, width, height);
  context.lineJoin = "round";
  context.lineCap = "round";
  const index = geometry.index;
  const triangleCount = Math.floor((index ? index.count : position.count) / 3);
  const surface = {
    textureFlipY: mesh.userData.textureFlipY ?? true,
    textureRotation: normalizeTextureRotation(mesh.userData.textureRotation || 0)
  };
  for (let triangleIndex = 0; triangleIndex < triangleCount; triangleIndex++) {
    const points = [0, 1, 2].map(corner => {
      const sourceIndex = triangleIndex * 3 + corner;
      const vertexIndex = index ? index.getX(sourceIndex) : sourceIndex;
      const [u, v] = transformedMergeUv([uv.getX(vertexIndex), uv.getY(vertexIndex)], surface);
      return [u * width, (1 - v) * height];
    });
    context.beginPath();
    context.moveTo(points[0][0], points[0][1]);
    context.lineTo(points[1][0], points[1][1]);
    context.lineTo(points[2][0], points[2][1]);
    context.closePath();
    context.strokeStyle = "rgba(0, 0, 0, 0.92)";
    context.lineWidth = Math.max(3, width / 300);
    context.stroke();
    context.strokeStyle = "rgba(75, 220, 255, 0.96)";
    context.lineWidth = Math.max(1.5, width / 600);
    context.stroke();
  }
}

function closeMeshDetails() {
  meshDetailsState.meshId = null;
  els.meshDetailsModal.classList.remove("open");
  els.meshDetailsModal.setAttribute("aria-hidden", "true");
}

function saveMeshDetails() {
  const mesh = meshDetailsMesh();
  if (!mesh) {
    closeMeshDetails();
    return;
  }
  const nextName = String(els.meshDetailsNameInput.value || "").trim();
  const nextRule = normalizeMaterialRule(els.meshMaterialRuleSelect.value);
  if (!nextName) {
    log("Enter a mesh name before saving.");
    return;
  }
  recordHistory("save mesh details");
  mesh.name = nextName;
  mesh.userData.materialRule = nextRule;
  syncMeshRenderCulling(mesh);
  refreshMeshDetails();
  updateAll();
  log(`Saved mesh details for ${mesh.name}.`, {
    mesh: mesh.userData.id,
    materialRule: nextRule
  });
  closeMeshDetails();
}

function selectedTextureLibraryEntry() {
  const name = els.textureLibrarySelect?.value;
  return name ? textureLibrary.get(name) || null : null;
}

function textureLibraryEntryForTexture(textureUrl, textureName) {
  if (!textureUrl && !textureName) return null;
  return [...textureLibrary.values()].find(entry =>
    (textureName && entry.name === textureName) ||
    (textureUrl && entry.dataUrl === textureUrl)
  ) || null;
}

function syncTextureRobloxIdInput() {
  const entry = selectedTextureLibraryEntry();
  if (els.textureRobloxIdRow) els.textureRobloxIdRow.hidden = !entry;
  if (els.textureRobloxIdInput) {
    els.textureRobloxIdInput.disabled = !entry;
    els.textureRobloxIdInput.value = entry?.robloxAssetId || "";
  }
}

function syncMeshesForTextureRobloxId(textureEntry) {
  if (!textureEntry) return;
  const normalized = normalizeRobloxAssetId(textureEntry.robloxAssetId || "");
  for (const mesh of objects) {
    if (mesh.userData.textureName === textureEntry.name || mesh.userData.textureUrl === textureEntry.dataUrl) {
      mesh.userData.textureRobloxAssetId = normalized;
    }
  }
}

function syncCurrentTextureRobloxId({ refresh = false, writeInput = true } = {}) {
  const entry = selectedTextureLibraryEntry();
  if (!entry || !els.textureRobloxIdInput) return null;
  const normalized = normalizeRobloxAssetId(els.textureRobloxIdInput.value);
  entry.robloxAssetId = normalized;
  syncMeshesForTextureRobloxId(entry);
  if (writeInput) els.textureRobloxIdInput.value = normalized;
  if (refresh) {
    const name = entry.name;
    refreshTextureLibraryUi();
    if (textureLibrary.has(name)) els.textureLibrarySelect.value = name;
    syncTextureRobloxIdInput();
  }
  return entry;
}

function reconcileTextureRobloxIds() {
  for (const mesh of objects) {
    const meshId = normalizeRobloxAssetId(mesh.userData.textureRobloxAssetId || "");
    let entry = textureLibraryEntryForTexture(mesh.userData.textureUrl, mesh.userData.textureName);
    if (!entry && mesh.userData.textureUrl) {
      const storedName = registerTextureAsset(
        mesh.userData.textureName || `${mesh.name || "mesh"}_texture`,
        mesh.userData.textureUrl,
        { replace: false, robloxAssetId: meshId }
      );
      if (storedName) {
        mesh.userData.textureName = storedName;
        entry = textureLibrary.get(storedName) || null;
      }
    }
    if (entry && meshId && !entry.robloxAssetId) entry.robloxAssetId = meshId;
  }
  for (const entry of textureLibrary.values()) syncMeshesForTextureRobloxId(entry);
  refreshTextureLibraryUi();
}

function refreshTextureLibraryUi() {
  if (!els.textureLibrarySelect || !els.textureLibraryCount) return;
  const previous = els.textureLibrarySelect.value || currentTextureLibraryName();
  els.textureLibrarySelect.innerHTML = "";
  const entries = [...textureLibrary.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
  if (!entries.length) {
    const option = document.createElement("option");
    option.textContent = "No stored textures yet";
    option.disabled = true;
    option.selected = true;
    els.textureLibrarySelect.append(option);
  } else {
    for (const entry of entries) {
      const option = document.createElement("option");
      option.value = entry.name;
      option.textContent = `${entry.name}${entry.robloxAssetId ? "  [Roblox ID]" : ""}`;
      els.textureLibrarySelect.append(option);
    }
    if (previous && textureLibrary.has(previous)) els.textureLibrarySelect.value = previous;
    else els.textureLibrarySelect.selectedIndex = 0;
  }
  els.textureLibraryCount.textContent = `${entries.length} stored`;
  els.applyLibraryTextureBtn.disabled = entries.length === 0;
  syncTextureRobloxIdInput();
}

function setTextureLibraryPanelOpen(open) {
  if (!els.textureLibraryPanel) return;
  els.textureLibraryPanel.hidden = !open;
  if (open) refreshTextureLibraryUi();
}

function applyTextureTransform(texture, { textureFlipY = true, textureRotation = 0 } = {}) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = textureFlipY;
  texture.center.set(.5, .5);
  texture.rotation = THREE.MathUtils.degToRad(normalizeTextureRotation(textureRotation));
}

function clampLightAngleDegrees(value) {
  return Math.max(5, Math.min(80, Number(value) || 24));
}

function clampLightIntensity(value) {
  return Math.max(0, Math.min(40, Number(value) || 0));
}

function setSectionCollapsed(section, toggle, collapsed) {
  if (!section || !toggle) return;
  section.classList.toggle("collapsed", collapsed);
  toggle.setAttribute("aria-expanded", String(!collapsed));
}

function toggleSection(section, toggle) {
  if (!section || !toggle) return;
  setSectionCollapsed(section, toggle, !section.classList.contains("collapsed"));
}

function syncSpotLightRig() {
  const showGuides = els.showLightGuidesInput?.checked ?? false;
  const enablePrimary = els.enablePrimaryLightInput?.checked ?? false;
  const enableMirror = els.enableMirrorLightInput?.checked ?? false;
  const posX = Number(els.lightPosXInput?.value) || -6;
  const posY = Number(els.lightPosYInput?.value) || 5;
  const posZ = Number(els.lightPosZInput?.value) || 6;
  const targetX = Number(els.lightTargetXInput?.value) || 0;
  const targetY = Number(els.lightTargetYInput?.value) || 1.5;
  const targetZ = Number(els.lightTargetZInput?.value) || 0;
  const intensity = clampLightIntensity(els.lightIntensityInput?.value);
  const angleRad = THREE.MathUtils.degToRad(clampLightAngleDegrees(els.lightAngleInput?.value));

  primarySpot.position.set(posX, posY, posZ);
  primarySpotTarget.position.set(targetX, targetY, targetZ);
  primarySpot.intensity = enablePrimary ? intensity : 0;
  primarySpot.angle = angleRad;
  primarySpot.visible = enablePrimary;

  mirrorSpot.position.set(-posX, posY, posZ);
  mirrorSpotTarget.position.set(-targetX, targetY, targetZ);
  mirrorSpot.intensity = enableMirror ? intensity : 0;
  mirrorSpot.angle = angleRad;
  mirrorSpot.visible = enableMirror;

  primarySpot.target.updateMatrixWorld(true);
  mirrorSpot.target.updateMatrixWorld(true);
  primarySpot.updateMatrixWorld(true);
  mirrorSpot.updateMatrixWorld(true);
  primarySpotHelper.visible = showGuides && enablePrimary;
  mirrorSpotHelper.visible = showGuides && enableMirror;
  primarySpotHelper.update();
  mirrorSpotHelper.update();
}

function disposeObject3DTree(object) {
  if (!object) return;
  object.traverse(node => {
    if (node.geometry) node.geometry.dispose();
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (!material) continue;
      if (material.map) material.map.dispose();
      material.dispose?.();
    }
  });
}

function clearGuideGroup(group) {
  while (group.children.length) {
    const child = group.children[group.children.length - 1];
    group.remove(child);
    disposeObject3DTree(child);
  }
}

function makeGuideLabelTexture(text, {
  width = 512,
  height = 160,
  textColor = "#f3f7fb",
  bgColor = "rgba(9,12,17,0.68)",
  strokeColor = "rgba(0,0,0,0.4)"
} = {}) {
  const labelCanvas = document.createElement("canvas");
  labelCanvas.width = width;
  labelCanvas.height = height;
  const ctx = labelCanvas.getContext("2d");
  if (!ctx) return null;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = bgColor;
  ctx.beginPath();
  const radius = 26;
  ctx.moveTo(radius, 0);
  ctx.lineTo(width - radius, 0);
  ctx.quadraticCurveTo(width, 0, width, radius);
  ctx.lineTo(width, height - radius);
  ctx.quadraticCurveTo(width, height, width - radius, height);
  ctx.lineTo(radius, height);
  ctx.quadraticCurveTo(0, height, 0, height - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = strokeColor;
  ctx.stroke();
  ctx.fillStyle = textColor;
  ctx.font = "700 78px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, width / 2, height / 2 + 4);
  const texture = new THREE.CanvasTexture(labelCanvas);
  texture.needsUpdate = true;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeFlatGuideLabel(text, width = 2.2, height = 0.7) {
  const texture = makeGuideLabelTexture(text);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 12;
  return mesh;
}

function buildGridLabels() {
  clearGuideGroup(gridLabelGroup);
  const labels = [
    { text: "FRONT", axis: "front" },
    { text: "BACK", axis: "back" },
    { text: "LEFT", axis: "left" },
    { text: "RIGHT", axis: "right" }
  ];
  for (const spec of labels) {
    const mesh = makeFlatGuideLabel(spec.text);
    mesh.userData.axis = spec.axis;
    gridLabelGroup.add(mesh);
  }
}

function updateGridLabels() {
  const scale = grid.scale.x || 1;
  const halfSize = 9 * scale;
  const offset = Math.max(0.9, halfSize * 0.12);
  const labelY = 0.03;
  for (const mesh of gridLabelGroup.children) {
    mesh.scale.setScalar(scale);
    mesh.rotation.set(-Math.PI / 2, 0, 0);
    switch (mesh.userData.axis) {
      case "front":
        mesh.position.set(0, labelY, halfSize + offset);
        mesh.rotation.z = Math.PI;
        break;
      case "back":
        mesh.position.set(0, labelY, -halfSize - offset);
        break;
      case "left":
        mesh.position.set(-halfSize - offset, labelY, 0);
        mesh.rotation.z = Math.PI / 2;
        break;
      case "right":
        mesh.position.set(halfSize + offset, labelY, 0);
        mesh.rotation.z = -Math.PI / 2;
        break;
    }
  }
  gridLabelGroup.visible = grid.visible;
}

function makeGuideCircle(radius = 1, color = 0x55ff99, segments = 40) {
  const points = [];
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(t) * radius, Math.sin(t) * radius, 0));
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  return new THREE.LineLoop(
    geometry,
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95 })
  );
}

function orientGuideToAxis(object, axisVec) {
  object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), axisVec.clone().normalize());
  return object;
}

const selectionOutlineTargets = new WeakMap();
const selectionOutlinePadding = new THREE.Vector3(1.025, 1.025, 1.025);

function selectedObjectOutlineTargets() {
  const transformTargets = transformTargetObjects().filter(mesh => mesh.visible && !mesh.userData?.hidden);
  if (transformTargets.length) return transformTargets;
  return selected && selected.visible && !selected.userData?.hidden ? [selected] : [];
}

function clearSelectionOutline() {
  while (selectionOutlineGroup.children.length) {
    const outline = selectionOutlineGroup.children[selectionOutlineGroup.children.length - 1];
    selectionOutlineGroup.remove(outline);
    outline.geometry?.dispose?.();
    outline.material?.dispose?.();
  }
}

function syncSelectionOutlineTransforms() {
  for (const outline of selectionOutlineGroup.children) {
    const mesh = selectionOutlineTargets.get(outline);
    if (!mesh) continue;
    mesh.updateWorldMatrix(true, false);
    outline.matrix.copy(mesh.matrixWorld).scale(selectionOutlinePadding);
    outline.matrixWorldNeedsUpdate = true;
    outline.visible = mesh.visible && !mesh.userData?.hidden;
  }
}

function updateSelectionOutline() {
  clearSelectionOutline();
  for (const mesh of selectedObjectOutlineTargets()) {
    const outline = new THREE.Mesh(
      mesh.geometry.clone(),
      new THREE.MeshBasicMaterial({
        color: 0x59d7ff,
        side: THREE.BackSide,
        depthTest: true,
        depthWrite: false,
        toneMapped: false
      })
    );
    outline.name = "selected object silhouette";
    outline.userData.editorHelper = true;
    outline.matrixAutoUpdate = false;
    outline.frustumCulled = false;
    outline.renderOrder = 19;
    selectionOutlineTargets.set(outline, mesh);
    selectionOutlineGroup.add(outline);
  }
  syncSelectionOutlineTransforms();
}

function updateCrashPreview() {
  return;
}

function makeMaterial(color = "#40c7a5", roughness = .6, textureUrl = null, textureFlipY = true, textureRotation = 0) {
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness: .05,
    side: THREE.FrontSide,
    transparent: false,
    opacity: 1,
    wireframe: false,
    depthWrite: true
  });
  if (textureUrl) {
    const texture = loadTextureInstance(textureUrl);
    applyTextureTransform(texture, { textureFlipY, textureRotation });
    material.map = texture;
    material.needsUpdate = true;
  }
  return material;
}

function primaryMeshMaterial(mesh) {
  const materials = Array.isArray(mesh?.material) ? mesh.material : [mesh?.material];
  return materials.find(material => material?.isMaterial) || null;
}

function syncMeshRenderCulling(mesh) {
  if (!mesh?.isMesh || mesh.userData?.editorHelper) return;
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const materialRule = normalizeMaterialRule(mesh.userData?.materialRule || "auto");
  const opacity = Number(mesh.userData?.opacity ?? primaryMeshMaterial(mesh)?.opacity ?? 1);
  const needsInteriorView = materialRule === "glass" || opacity < .999;
  for (const material of materials) {
    if (!material?.isMaterial) continue;
    material.side = needsInteriorView ? THREE.DoubleSide : THREE.FrontSide;
    material.needsUpdate = true;
  }
  mesh.frustumCulled = true;
  if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
}

let textureUiRefreshScheduled = false;

function scheduleTextureUiRefresh() {
  if (textureUiRefreshScheduled) return;
  textureUiRefreshScheduled = true;
  requestAnimationFrame(() => {
    textureUiRefreshScheduled = false;
    renderTree();
    syncInspectorSoft();
    updateState();
  });
}

function loadTextureInstance(textureUrl, onLoad = null) {
  let entry = textureSourceCache.get(textureUrl);
  if (!entry) {
    entry = { source: null, loaded: false, callbacks: [] };
    textureSourceCache.set(textureUrl, entry);
    entry.source = new THREE.TextureLoader().load(textureUrl, loadedTexture => {
      entry.loaded = true;
      const callbacks = entry.callbacks.splice(0);
      for (const callback of callbacks) callback(loadedTexture);
    });
  }

  const texture = entry.source.clone();
  const notify = source => {
    texture.needsUpdate = true;
    onLoad?.(source);
  };
  if (entry.loaded) notify(entry.source);
  else entry.callbacks.push(notify);
  return texture;
}

function stringHash(value = "") {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function sampleTextureDisplayColor(image, seed = 0) {
  const width = image?.naturalWidth || image?.videoWidth || image?.width || 0;
  const height = image?.naturalHeight || image?.videoHeight || image?.height || 0;
  if (!width || !height) return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(image, 0, 0, width, height);
  const probes = [
    [.5, .5],
    [.22, .22],
    [.78, .22],
    [.22, .78],
    [.78, .78],
    [.36, .64],
    [.64, .36]
  ];
  const offset = Math.abs(seed) % probes.length;
  for (let i = 0; i < probes.length; i++) {
    const [u, v] = probes[(i + offset) % probes.length];
    const x = Math.min(width - 1, Math.max(0, Math.floor(u * (width - 1))));
    const y = Math.min(height - 1, Math.max(0, Math.floor(v * (height - 1))));
    const rgba = context.getImageData(x, y, 1, 1).data;
    if (rgba[3] > 24) return new THREE.Color(rgba[0] / 255, rgba[1] / 255, rgba[2] / 255);
  }
  return null;
}

function maybeApplyTextureDisplayColor(mesh, image) {
  if (!mesh || !image) return;
  const sampled = sampleTextureDisplayColor(image, stringHash(`${mesh.name}|${mesh.userData.textureName || ""}`));
  if (!sampled) return;
  mesh.userData.textureDisplayColor = `#${sampled.getHexString()}`;
}

function applyTextureToMesh(mesh, textureUrl, textureName = "Texture", textureFlipY = true, textureRotation = 0) {
  if (!mesh) return;
  if (mesh.material.map) mesh.material.map.dispose();
  mesh.material.map = null;
  if (textureUrl) {
    const texture = loadTextureInstance(textureUrl, loadedTexture => {
      maybeApplyTextureDisplayColor(mesh, loadedTexture.image);
      scheduleTextureUiRefresh();
    });
    applyTextureTransform(texture, { textureFlipY, textureRotation });
    mesh.material.map = texture;
  } else {
    delete mesh.userData.textureDisplayColor;
  }
  const materialOpacity = Number(mesh.userData?.opacity ?? mesh.material.opacity ?? 1);
  const textureHasTransparency = !!mesh.userData?.textureHasTransparency;
  mesh.material.transparent = materialOpacity < .999 || textureHasTransparency;
  // Texture alpha still writes depth so opaque texels occlude correctly;
  // only a translucent mesh opacity disables depth writing.
  mesh.material.depthWrite = materialOpacity >= .999;
  mesh.material.needsUpdate = true;
  mesh.userData.textureUrl = textureUrl || null;
  mesh.userData.textureName = textureUrl ? textureName : null;
  const libraryEntry = textureUrl ? textureLibraryEntryForTexture(textureUrl, textureName) : null;
  mesh.userData.textureRobloxAssetId = textureUrl
    ? normalizeRobloxAssetId(libraryEntry?.robloxAssetId || mesh.userData.textureRobloxAssetId || "")
    : "";
  mesh.userData.textureFlipY = textureUrl ? textureFlipY : true;
  mesh.userData.textureRotation = textureUrl ? normalizeTextureRotation(textureRotation) : 0;
  for (const channel of ["roughness", "metalness", "emissive"]) {
    const config = materialTextureChannels[channel];
    const channelTexture = mesh.material[config.mapKey];
    if (channelTexture) configureMaterialChannelTexture(channelTexture, channel, mesh);
  }
}

const materialTextureChannels = {
  baseColor: {
    label: "Base Color",
    urlKey: "textureUrl",
    nameKey: "textureName",
    mapKey: "map",
    info: "Choose a paint tool and color. This channel controls the visible color and artwork of the material."
  },
  roughness: {
    label: "Roughness",
    urlKey: "roughnessTextureUrl",
    nameKey: "roughnessTextureName",
    mapKey: "roughnessMap",
    info: "Choose a paint tool, then paint a value: 0% is black, smooth and glossy; 100% is white, rough and matte. Color is not used."
  },
  metalness: {
    label: "Metalness",
    urlKey: "metalnessTextureUrl",
    nameKey: "metalnessTextureName",
    mapKey: "metalnessMap",
    info: "Choose a paint tool, then paint a value: 0% is non-metal and 100% is metal. Use intermediate values only when the material needs a transition."
  },
  emissive: {
    label: "Emissive",
    urlKey: "emissiveTextureUrl",
    nameKey: "emissiveTextureName",
    mapKey: "emissiveMap",
    info: "Choose a paint tool, glow color and strength. Painted areas emit that color independently of the scene lighting."
  }
};

function normalizedMaterialTextureChannel(channel) {
  return materialTextureChannels[channel] ? channel : "baseColor";
}

function materialTextureChannelData(mesh, channel = "baseColor") {
  const normalized = normalizedMaterialTextureChannel(channel);
  const config = materialTextureChannels[normalized];
  return {
    channel: normalized,
    config,
    url: mesh?.userData?.[config.urlKey] || null,
    name: mesh?.userData?.[config.nameKey] || `${mesh?.name || "Mesh"} ${config.label}`
  };
}

function configureMaterialChannelTexture(texture, channel, mesh) {
  applyTextureTransform(texture, {
    textureFlipY: mesh.userData.textureFlipY ?? true,
    textureRotation: mesh.userData.textureRotation || 0
  });
  if ("colorSpace" in texture) {
    texture.colorSpace = channel === "roughness" || channel === "metalness"
      ? (THREE.NoColorSpace || "")
      : (THREE.SRGBColorSpace || texture.colorSpace);
  }
}

function applyMaterialTextureChannel(mesh, channel, textureUrl, textureName) {
  if (!mesh) return;
  const { channel: normalized, config } = materialTextureChannelData(mesh, channel);
  if (normalized === "baseColor") {
    applyTextureToMesh(
      mesh,
      textureUrl,
      textureName || "Texture",
      mesh.userData.textureFlipY ?? true,
      mesh.userData.textureRotation || 0
    );
    return;
  }
  const previous = mesh.material[config.mapKey];
  if (previous) previous.dispose();
  mesh.material[config.mapKey] = null;
  if (textureUrl) {
    const texture = loadTextureInstance(textureUrl, () => scheduleTextureUiRefresh());
    configureMaterialChannelTexture(texture, normalized, mesh);
    mesh.material[config.mapKey] = texture;
  }
  mesh.userData[config.urlKey] = textureUrl || null;
  mesh.userData[config.nameKey] = textureUrl ? (textureName || `${mesh.name} ${config.label}`) : null;
  if (normalized === "metalness") mesh.material.metalness = textureUrl ? 1 : (normalizeMaterialRule(mesh.userData.materialRule) === "metal" ? .52 : .05);
  if (normalized === "emissive") {
    mesh.material.emissive.set(textureUrl ? 0xffffff : 0x000000);
    mesh.material.emissiveIntensity = textureUrl ? 1 : 0;
  }
  mesh.material.needsUpdate = true;
}

function textureEditorMesh() {
  return textureEditorState.meshId ? findObject(textureEditorState.meshId) : null;
}

function selectedTextureEditorMesh() {
  return selected && selected.userData.textureUrl && selected.geometry?.getAttribute("uv") ? selected : null;
}

function syncTextureEditorButton() {
  const mesh = selectedTextureEditorMesh();
  els.textureEditorBtn.disabled = !mesh;
  els.textureEditorBtn.title = mesh
    ? "Open the selected mesh texture and UV editor"
    : "Select one textured mesh with UVs to open the texture editor";
}

function readImageToCanvas(image) {
  const width = image?.naturalWidth || image?.videoWidth || image?.width || 0;
  const height = image?.naturalHeight || image?.videoHeight || image?.height || 0;
  if (!width || !height) throw new Error("Texture image is not ready yet.");
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, 0, 0, width, height);
  return canvas;
}

function cloneTextureEditorCanvas(source) {
  if (!source?.width || !source?.height) return null;
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  canvas.getContext("2d", { willReadFrequently: true }).drawImage(source, 0, 0);
  return canvas;
}

function captureTextureEditorPixels(source) {
  if (!source?.width || !source?.height) return null;
  const imageData = source.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, source.width, source.height);
  return {
    width: imageData.width,
    height: imageData.height,
    data: new Uint8ClampedArray(imageData.data)
  };
}

function cloneTextureEditorPixels(source) {
  if (!source?.width || !source?.height || !source?.data) return null;
  return {
    width: source.width,
    height: source.height,
    data: new Uint8ClampedArray(source.data)
  };
}

function canvasFromTextureEditorPixels(source) {
  if (!source?.width || !source?.height || !source?.data) return null;
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const imageData = context.createImageData(source.width, source.height);
  imageData.data.set(source.data);
  context.putImageData(imageData, 0, 0);
  return canvas;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not read the texture image."));
    image.src = url;
  });
}

function transformTextureUvForDisplay(u, v, mesh) {
  return transformTextureUv(u, v, {
    textureFlipY: mesh.userData.textureFlipY ?? true,
    textureRotation: mesh.userData.textureRotation || 0
  });
}

function uvTrianglesForMesh(mesh) {
  if (!mesh?.geometry) return [];
  const source = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
  const uv = source.getAttribute("uv");
  if (!uv) return [];
  const triangles = [];
  for (let i = 0; i < uv.count; i += 3) {
    triangles.push([0, 1, 2].map(offset => {
      const [u, v] = transformTextureUvForDisplay(uv.getX(i + offset), uv.getY(i + offset), mesh);
      return { u, v, faceIndex: i / 3 };
    }));
  }
  if (source !== mesh.geometry) source.dispose();
  return triangles;
}

function selectedUvTrianglesForMesh(mesh) {
  return selectedFaces
    .filter(face => (face.mesh === mesh || face.mesh?.userData?.id === mesh.userData.id) && face.localUvs?.length === 3)
    .map(face => face.localUvs.map(uv => {
      const [u, v] = transformTextureUvForDisplay(uv.x, uv.y, mesh);
      return { u, v, faceIndex: face.faceIndex };
    }));
}

function textureEditorMaskTriangles(mesh) {
  const selectedTriangles = selectedUvTrianglesForMesh(mesh);
  return els.textureEditorSelectedOnly?.checked && selectedTriangles.length
    ? selectedTriangles
    : uvTrianglesForMesh(mesh);
}

function textureEditorCursor(tool = "none") {
  if (!tool || tool === "none") return "default";
  if (tool === "pan") return textureEditorState.isPanning ? "grabbing" : "grab";
  if (tool === "shape" || tool.startsWith("select")) return "crosshair";
  const svg = tool === "hammer"
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path fill="#f4f7fb" stroke="#11181d" stroke-width="1.8" d="M8 7h9l3 3-3 3H13l6 10-3 2-7-11z"/><rect x="5.5" y="5.5" width="11" height="5" rx="1.5" fill="#ffb84d" stroke="#11181d" stroke-width="1.5"/></svg>`
    : tool === "eyedropper"
      ? `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path fill="#7dd3fc" stroke="#11181d" stroke-width="2" d="m20 4 8 8-4 4-2-2-9 9-5 1 1-5 9-9-2-2z"/></svg>`
      : tool === "fill"
        ? `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path fill="#f4f7fb" stroke="#11181d" stroke-width="2" d="m7 5 13 13-8 8-9-9z"/><path fill="#ff7f50" d="m6 16 7 7 5-5-7-7z"/><path fill="#7dd3fc" stroke="#11181d" stroke-width="1.5" d="M23 19s4 5 4 7a4 4 0 0 1-8 0c0-2 4-7 4-7z"/></svg>`
        : tool === "eraser"
          ? `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path fill="#f4a8b8" stroke="#11181d" stroke-width="2" d="m5 20 12-14 10 9-10 12H9z"/><path fill="#f4f7fb" d="m9 20 5 5h3l4-5-7-6z"/></svg>`
          : tool === "pen"
            ? `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path fill="#7dd3fc" stroke="#11181d" stroke-width="2" d="m22 4 6 6L12 26 4 28l2-8z"/><path fill="#11181d" d="m4 28 2-8 6 6z"/></svg>`
            : tool === "spray"
              ? `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path fill="#7dd3fc" stroke="#11181d" stroke-width="2" d="M9 11h13v17H9z"/><path fill="#f4f7fb" stroke="#11181d" stroke-width="2" d="M12 6h8v5h-8z"/><circle cx="6" cy="8" r="1.4" fill="#7dd3fc"/><circle cx="3" cy="5" r="1" fill="#7dd3fc"/><circle cx="7" cy="3" r="1" fill="#7dd3fc"/></svg>`
              : `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path fill="#7dd3fc" stroke="#11181d" stroke-width="2" d="m20 3 7 7-12 12-7-7z"/><path fill="#ffb84d" stroke="#11181d" stroke-width="2" d="M8 15c-5 4-5 9-3 14 6-1 10-4 10-8z"/><path fill="#f4f7fb" d="m18 5 7 7-3 3-7-7z"/></svg>`;
  // The browser binds the SVG cursor to the pointer at this hotspot. Each
  // drawing tool needs its own contact point; sharing 6/6 made the visible
  // tool feel as if it was attached to the mouse with a loose string.
  const hotspot = tool === "pen"
    ? [4, 28]
    : tool === "brush"
      ? [5, 29]
      : tool === "spray"
        ? [5, 8]
        : tool === "eraser"
          ? [9, 26]
          : tool === "eyedropper"
            ? [8, 24]
            : tool === "fill"
              ? [23, 26]
              : tool === "hammer"
                ? [6, 8]
                : [6, 6];
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") ${hotspot[0]} ${hotspot[1]}, crosshair`;
}

function syncTextureEditorToolSettings(tool = "none") {
  const visibleSettings = {
    pen: ["color", "channelValue", "size", "opacity"],
    brush: ["color", "channelValue", "size", "hardness", "opacity"],
    spray: ["color", "channelValue", "size", "opacity"],
    eraser: ["size", "hardness", "opacity"],
    eyedropper: [],
    fill: ["color", "channelValue", "opacity"],
    shape: ["color", "channelValue", "size", "opacity", "shape"],
    selectRect: [],
    selectEllipse: [],
    selectLasso: [],
    pan: [],
    hammer: ["hammer"]
  }[tool] || [];
  const channel = normalizedMaterialTextureChannel(textureEditorState.channel);
  for (const control of els.textureEditorToolSettings || []) {
    const setting = control.dataset.textureSetting;
    const channelAllowsSetting = setting === "color"
      ? channel === "baseColor" || channel === "emissive"
      : setting === "channelValue"
        ? channel !== "baseColor"
        : true;
    control.hidden = !visibleSettings.includes(setting) || !channelAllowsSetting;
  }
  if (els.textureEditorIdleHint) els.textureEditorIdleHint.hidden = tool !== "none";
}

function setTextureEditorTool(tool = "none") {
  textureEditorState.tool = tool;
  if (els.textureEditorTool) els.textureEditorTool.value = tool;
  for (const button of els.textureEditorToolButtons || []) {
    const active = button.dataset.textureTool === tool;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  }
  syncTextureEditorToolSettings(tool);
  syncTextureEditorCursor();
  hideTextureEditorPointerPreview();
  renderTextureEditorBrushPreview();
  renderTextureEditor();
}

function syncTextureEditorCursor() {
  if (!els.textureEditorCanvas) return;
  const tool = textureEditorState.tool || els.textureEditorTool?.value || "none";
  els.textureEditorCanvas.style.cursor = textureEditorCursor(tool);
}

function textureEditorTrianglesPath(context, triangles, width, height, offsetX = 0, offsetY = 0) {
  context.beginPath();
  for (const triangle of triangles) {
    triangle.forEach((point, index) => {
      const x = offsetX + point.u * width;
      const y = offsetY + point.v * height;
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.closePath();
  }
}

function currentTextureEditorCanvas() {
  const active = textureEditorState.layers.find(layer => layer.id === textureEditorState.activeLayerId);
  if (active?.canvas) textureEditorState.sourceCanvas = active.canvas;
  return active?.canvas || textureEditorState.sourceCanvas;
}

function nextTextureEditorLayerId() {
  textureEditorState.layerCounter += 1;
  return `paint-layer-${Date.now()}-${textureEditorState.layerCounter}`;
}

function createTextureEditorLayer(name, canvas, visible = true, id = nextTextureEditorLayerId()) {
  return { id, name: name || "Paint Layer", canvas, visible: visible !== false };
}

function cloneTextureEditorLayers(layers = textureEditorState.layers) {
  return layers.map(layer => ({
    id: layer.id,
    name: layer.name,
    visible: layer.visible !== false,
    canvas: cloneTextureEditorCanvas(layer.canvas)
  }));
}

function compositeTextureEditorLayers() {
  const layers = textureEditorState.layers || [];
  const reference = layers.find(layer => layer.canvas)?.canvas || textureEditorState.sourceCanvas;
  if (!reference) return null;
  const canvas = document.createElement("canvas");
  canvas.width = reference.width;
  canvas.height = reference.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  for (const layer of layers) {
    if (layer.visible !== false && layer.canvas) context.drawImage(layer.canvas, 0, 0, canvas.width, canvas.height);
  }
  return canvas;
}

function setActiveTextureEditorLayer(id) {
  const layer = textureEditorState.layers.find(candidate => candidate.id === id);
  if (!layer) return;
  textureEditorState.activeLayerId = layer.id;
  textureEditorState.sourceCanvas = layer.canvas;
  renderTextureEditorLayerUi();
  renderTextureEditor();
}

function renderTextureEditorLayerUi() {
  const layers = textureEditorState.layers || [];
  const activeIndex = layers.findIndex(layer => layer.id === textureEditorState.activeLayerId);
  if (els.textureEditorLayerCount) {
    els.textureEditorLayerCount.textContent = `${layers.length} layer${layers.length === 1 ? "" : "s"}`;
  }
  if (els.textureEditorLayerList) {
    els.textureEditorLayerList.replaceChildren();
    [...layers].reverse().forEach(layer => {
      const row = document.createElement("div");
      row.className = `texture-editor-layer-row${layer.id === textureEditorState.activeLayerId ? " active" : ""}`;
      const visibility = document.createElement("button");
      visibility.type = "button";
      visibility.className = "texture-editor-layer-visibility";
      visibility.textContent = layer.visible === false ? "Off" : "On";
      visibility.title = layer.visible === false ? `Show ${layer.name}` : `Hide ${layer.name}`;
      visibility.addEventListener("click", event => {
        event.stopPropagation();
        snapshotTextureEditor();
        layer.visible = layer.visible === false;
        renderTextureEditorLayerUi();
        renderTextureEditor();
      });
      const select = document.createElement("button");
      select.type = "button";
      select.textContent = layer.name;
      select.title = `Paint on ${layer.name}`;
      select.addEventListener("click", () => setActiveTextureEditorLayer(layer.id));
      row.append(visibility, select);
      els.textureEditorLayerList.append(row);
    });
  }
  if (els.textureEditorAddLayerBtn) els.textureEditorAddLayerBtn.disabled = layers.length === 0 || !currentTextureEditorCanvas();
  if (els.textureEditorDuplicateLayerBtn) els.textureEditorDuplicateLayerBtn.disabled = activeIndex < 0;
  if (els.textureEditorLayerUpBtn) els.textureEditorLayerUpBtn.disabled = activeIndex < 0 || activeIndex >= layers.length - 1;
  if (els.textureEditorLayerDownBtn) els.textureEditorLayerDownBtn.disabled = activeIndex <= 0;
  if (els.textureEditorMergeDownBtn) els.textureEditorMergeDownBtn.disabled = activeIndex <= 0;
  if (els.textureEditorDeleteLayerBtn) els.textureEditorDeleteLayerBtn.disabled = layers.length <= 1 || activeIndex < 0;
}

function addTextureEditorLayer() {
  const source = currentTextureEditorCanvas();
  if (!source) return;
  snapshotTextureEditor();
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const layer = createTextureEditorLayer(`Paint ${textureEditorState.layers.length}` , canvas);
  textureEditorState.layers.push(layer);
  setActiveTextureEditorLayer(layer.id);
}

function duplicateTextureEditorLayer() {
  const active = textureEditorState.layers.find(layer => layer.id === textureEditorState.activeLayerId);
  if (!active) return;
  snapshotTextureEditor();
  const index = textureEditorState.layers.indexOf(active);
  const duplicate = createTextureEditorLayer(`${active.name} Copy`, cloneTextureEditorCanvas(active.canvas), active.visible);
  textureEditorState.layers.splice(index + 1, 0, duplicate);
  setActiveTextureEditorLayer(duplicate.id);
}

function moveTextureEditorLayer(direction) {
  const layers = textureEditorState.layers;
  const index = layers.findIndex(layer => layer.id === textureEditorState.activeLayerId);
  const target = index + Math.sign(direction || 0);
  if (index < 0 || target < 0 || target >= layers.length) return;
  snapshotTextureEditor();
  [layers[index], layers[target]] = [layers[target], layers[index]];
  renderTextureEditorLayerUi();
  renderTextureEditor();
}

function mergeTextureEditorLayerDown() {
  const layers = textureEditorState.layers;
  const index = layers.findIndex(layer => layer.id === textureEditorState.activeLayerId);
  if (index <= 0) return;
  snapshotTextureEditor();
  const active = layers[index];
  const below = layers[index - 1];
  const merged = document.createElement("canvas");
  merged.width = below.canvas.width;
  merged.height = below.canvas.height;
  const context = merged.getContext("2d", { willReadFrequently: true });
  if (below.visible) context.drawImage(below.canvas, 0, 0);
  if (active.visible) context.drawImage(active.canvas, 0, 0);
  below.canvas = merged;
  below.visible = true;
  layers.splice(index, 1);
  setActiveTextureEditorLayer(below.id);
}

function deleteTextureEditorLayer() {
  const layers = textureEditorState.layers;
  const index = layers.findIndex(layer => layer.id === textureEditorState.activeLayerId);
  if (index < 0 || layers.length <= 1) return;
  snapshotTextureEditor();
  layers.splice(index, 1);
  const next = layers[Math.min(index, layers.length - 1)];
  setActiveTextureEditorLayer(next.id);
}

function updateTextureEditorUndoButton() {
  if (els.textureEditorUndoBtn) els.textureEditorUndoBtn.disabled = textureEditorState.undoStack.length === 0;
}

function updateTextureEditorResetButton() {
  if (els.textureEditorResetBtn) {
    els.textureEditorResetBtn.disabled = !textureEditorState.open || !textureEditorState.originalPixels;
  }
}

function snapshotTextureEditor() {
  if (!currentTextureEditorCanvas()) return;
  textureEditorState.undoStack.push({
    layers: cloneTextureEditorLayers(),
    activeLayerId: textureEditorState.activeLayerId
  });
  if (textureEditorState.undoStack.length > 30) textureEditorState.undoStack.shift();
  updateTextureEditorUndoButton();
}

function undoTextureEditorPaint() {
  const previous = textureEditorState.undoStack.pop();
  if (!previous) return;
  if (previous.layers?.length) {
    textureEditorState.layers = cloneTextureEditorLayers(previous.layers);
    textureEditorState.activeLayerId = textureEditorState.layers.some(layer => layer.id === previous.activeLayerId)
      ? previous.activeLayerId
      : textureEditorState.layers.at(-1)?.id || null;
    textureEditorState.sourceCanvas = currentTextureEditorCanvas();
  } else if (previous.width && previous.height) {
    currentTextureEditorCanvas()?.getContext("2d").putImageData(previous, 0, 0);
  }
  updateTextureEditorUndoButton();
  renderTextureEditorLayerUi();
  renderTextureEditor();
}

function uvPointInsideTriangle(point, triangle) {
  const [a, b, c] = triangle;
  const denominator = (b.v - c.v) * (a.u - c.u) + (c.u - b.u) * (a.v - c.v);
  if (Math.abs(denominator) < 1e-10) return false;
  const first = ((b.v - c.v) * (point.u - c.u) + (c.u - b.u) * (point.v - c.v)) / denominator;
  const second = ((c.v - a.v) * (point.u - c.u) + (a.u - c.u) * (point.v - c.v)) / denominator;
  const third = 1 - first - second;
  return first >= -1e-6 && second >= -1e-6 && third >= -1e-6;
}

function uvPointsMatch(a, b) {
  return Math.abs(a.u - b.u) < 1e-6 && Math.abs(a.v - b.v) < 1e-6;
}

function uvTrianglesShareEdge(first, second) {
  let shared = 0;
  for (const a of first) {
    if (second.some(b => uvPointsMatch(a, b))) shared += 1;
  }
  return shared >= 2;
}

function textureEditorIslandAtPoint(mesh, point) {
  const triangles = textureEditorMaskTriangles(mesh);
  const uvPoint = { u: point.x / Math.max(1, currentTextureEditorCanvas().width), v: point.y / Math.max(1, currentTextureEditorCanvas().height) };
  const startIndex = triangles.findIndex(triangle => uvPointInsideTriangle(uvPoint, triangle));
  if (startIndex < 0) return [];
  const island = [];
  const visited = new Set([startIndex]);
  const queue = [startIndex];
  while (queue.length) {
    const index = queue.shift();
    island.push(triangles[index]);
    for (let candidate = 0; candidate < triangles.length; candidate += 1) {
      if (visited.has(candidate) || !uvTrianglesShareEdge(triangles[index], triangles[candidate])) continue;
      visited.add(candidate);
      queue.push(candidate);
    }
  }
  return island;
}

function textureEditorClipToTriangles(context, triangles, source) {
  textureEditorTrianglesPath(context, triangles, source.width, source.height);
  context.clip();
}

function textureEditorSelectionPath(context, selection, widthScale = 1, heightScale = 1, offsetX = 0, offsetY = 0) {
  if (!selection) return false;
  const points = selection.points || [];
  if (points.length < 2) return false;
  const point = value => ({ x: offsetX + value.x * widthScale, y: offsetY + value.y * heightScale });
  const first = point(points[0]);
  const last = point(points[points.length - 1]);
  context.beginPath();
  if (selection.type === "ellipse") {
    const centerX = (first.x + last.x) * .5;
    const centerY = (first.y + last.y) * .5;
    context.ellipse(centerX, centerY, Math.max(.5, Math.abs(last.x - first.x) * .5), Math.max(.5, Math.abs(last.y - first.y) * .5), 0, 0, Math.PI * 2);
  } else if (selection.type === "lasso") {
    context.moveTo(first.x, first.y);
    for (let index = 1; index < points.length; index += 1) {
      const current = point(points[index]);
      context.lineTo(current.x, current.y);
    }
    context.closePath();
  } else {
    context.rect(Math.min(first.x, last.x), Math.min(first.y, last.y), Math.max(1, Math.abs(last.x - first.x)), Math.max(1, Math.abs(last.y - first.y)));
  }
  return true;
}

function textureEditorClipToSelection(context, source) {
  if (!textureEditorState.selection) return;
  if (textureEditorSelectionPath(context, textureEditorState.selection)) context.clip();
}

function textureEditorClipToActiveMask(context, mesh, source, triangles = null) {
  textureEditorClipToTriangles(context, triangles || textureEditorMaskTriangles(mesh), source);
  textureEditorClipToSelection(context, source);
}

function syncTextureEditorSelectionUi() {
  const selection = textureEditorState.selection;
  if (els.textureEditorSelectionStatus) {
    els.textureEditorSelectionStatus.textContent = selection
      ? `${selection.type === "ellipse" ? "Ellipse" : selection.type === "lasso" ? "Lasso" : "Rectangle"} paint selection active`
      : "No paint selection";
  }
  if (els.textureEditorClearSelectionBtn) els.textureEditorClearSelectionBtn.disabled = !selection;
}

function clearTextureEditorSelection() {
  textureEditorState.selection = null;
  textureEditorState.selectionDraft = null;
  textureEditorState.isSelecting = false;
  syncTextureEditorSelectionUi();
  renderTextureEditor();
}

function textureEditorShapePath(context, shape, start, end) {
  const left = Math.min(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const right = Math.max(start.x, end.x);
  const bottom = Math.max(start.y, end.y);
  const width = Math.max(1, right - left);
  const height = Math.max(1, bottom - top);
  const centerX = left + width * .5;
  const centerY = top + height * .5;
  context.beginPath();
  if (shape === "ellipse") {
    context.ellipse(centerX, centerY, width * .5, height * .5, 0, 0, Math.PI * 2);
  } else if (shape === "triangle") {
    context.moveTo(centerX, top);
    context.lineTo(right, bottom);
    context.lineTo(left, bottom);
    context.closePath();
  } else if (shape === "diamond") {
    context.moveTo(centerX, top);
    context.lineTo(right, centerY);
    context.lineTo(centerX, bottom);
    context.lineTo(left, centerY);
    context.closePath();
  } else if (shape === "star") {
    const outer = Math.min(width, height) * .5;
    const inner = outer * .45;
    for (let index = 0; index < 10; index += 1) {
      const angle = -Math.PI / 2 + index * Math.PI / 5;
      const radius = index % 2 === 0 ? outer : inner;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.closePath();
  } else if (shape === "heart") {
    context.moveTo(centerX, bottom);
    context.bezierCurveTo(left - width * .1, centerY + height * .15, left, top, centerX, top + height * .28);
    context.bezierCurveTo(right, top, right + width * .1, centerY + height * .15, centerX, bottom);
    context.closePath();
  } else {
    context.rect(left, top, width, height);
  }
}

function normalizedTextureEditorSymmetry(mode) {
  return ["u", "v", "uv"].includes(mode) ? mode : "none";
}

function textureEditorSymmetryTransforms() {
  const mode = normalizedTextureEditorSymmetry(textureEditorState.symmetry);
  const transforms = [{ flipU: false, flipV: false }];
  if (mode === "u" || mode === "uv") transforms.push({ flipU: true, flipV: false });
  if (mode === "v" || mode === "uv") transforms.push({ flipU: false, flipV: true });
  if (mode === "uv") transforms.push({ flipU: true, flipV: true });
  return transforms;
}

function transformedTextureEditorPoint(point, source, transform) {
  return {
    x: transform.flipU ? source.width - point.x : point.x,
    y: transform.flipV ? source.height - point.y : point.y
  };
}

function textureEditorSymmetryPoints(point, source) {
  const points = textureEditorSymmetryTransforms().map(transform => transformedTextureEditorPoint(point, source, transform));
  return points.filter((candidate, index) => points.findIndex(point => Math.abs(point.x - candidate.x) < .001 && Math.abs(point.y - candidate.y) < .001) === index);
}

function withTextureEditorSymmetry(context, source, draw) {
  for (const transform of textureEditorSymmetryTransforms()) {
    context.save();
    context.translate(transform.flipU ? source.width : 0, transform.flipV ? source.height : 0);
    context.scale(transform.flipU ? -1 : 1, transform.flipV ? -1 : 1);
    draw(transform);
    context.restore();
  }
}

function setTextureEditorSymmetry(mode) {
  textureEditorState.symmetry = normalizedTextureEditorSymmetry(mode);
  for (const button of els.textureEditorSymmetryButtons || []) {
    const active = button.dataset.textureSymmetry === textureEditorState.symmetry;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  }
  renderTextureEditor();
}

function drawTextureEditorShape(start, end) {
  const mesh = textureEditorMesh();
  const source = currentTextureEditorCanvas();
  if (!mesh || !source || !start || !end) return false;
  const settings = textureEditorBrushSettings();
  const context = source.getContext("2d");
  context.save();
  textureEditorClipToActiveMask(context, mesh, source);
  context.globalAlpha = settings.opacity;
  context.fillStyle = settings.color;
  context.strokeStyle = settings.color;
  context.lineWidth = Math.max(1, settings.size);
  context.lineJoin = "round";
  withTextureEditorSymmetry(context, source, () => {
    textureEditorShapePath(context, textureEditorState.shape || "rectangle", start, end);
    if (els.textureEditorShapeFilled?.checked) context.fill();
    else context.stroke();
  });
  context.restore();
  requestTextureEditorRender();
  return true;
}

function textureEditorChannelValue() {
  return Math.max(0, Math.min(100, Number(els.textureEditorChannelValue?.value) || 0));
}

function textureEditorChannelPaintColor() {
  const channel = normalizedMaterialTextureChannel(textureEditorState.channel);
  const color = els.textureEditorColor?.value || "#ff7f50";
  const value = textureEditorChannelValue();
  if (channel === "roughness" || channel === "metalness") {
    const component = Math.round((value / 100) * 255).toString(16).padStart(2, "0");
    return `#${component}${component}${component}`;
  }
  if (channel !== "emissive") return color;
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
  if (!match) return color;
  const strength = value / 100;
  return `#${match.slice(1).map(component => Math.round(parseInt(component, 16) * strength).toString(16).padStart(2, "0")).join("")}`;
}

function syncTextureEditorChannelValueUi() {
  const channel = normalizedMaterialTextureChannel(textureEditorState.channel);
  const value = textureEditorChannelValue();
  if (els.textureEditorColorLabel) {
    els.textureEditorColorLabel.textContent = channel === "emissive" ? "Glow Color" : "Brush Color";
  }
  if (els.textureEditorChannelValueLabel) {
    els.textureEditorChannelValueLabel.textContent = channel === "roughness"
      ? "Roughness"
      : channel === "metalness"
        ? "Metalness"
        : "Glow Strength";
  }
  if (els.textureEditorChannelValueOutput) {
    els.textureEditorChannelValueOutput.textContent = channel === "roughness"
      ? `${value}% rough`
      : channel === "metalness"
        ? (value === 0 ? "Non-metal" : value === 100 ? "Metal" : `${value}% metal`)
        : `${value}%`;
  }
}

function textureEditorBrushSettings() {
  return {
    size: Math.max(1, Math.min(256, Number(els.textureEditorBrushSize.value) || 12)),
    hardness: Math.max(0, Math.min(1, (Number(els.textureEditorHardness.value) || 0) / 100)),
    opacity: Math.max(.01, Math.min(1, (Number(els.textureEditorOpacity.value) || 100) / 100)),
    color: textureEditorChannelPaintColor()
  };
}

function stampTextureEditorBrush(context, point, settings, erasing = false) {
  const radius = settings.size * .5;
  const innerRadius = Math.max(0, radius * settings.hardness);
  context.save();
  if (erasing) context.globalCompositeOperation = "destination-out";
  const gradient = context.createRadialGradient(point.x, point.y, innerRadius, point.x, point.y, radius);
  const opaqueColor = erasing ? `rgba(0,0,0,${settings.opacity})` : settings.color;
  const transparentColor = erasing ? "rgba(0,0,0,0)" : `${settings.color}00`;
  gradient.addColorStop(0, opaqueColor);
  gradient.addColorStop(Math.min(.999, settings.hardness), opaqueColor);
  gradient.addColorStop(1, transparentColor);
  context.globalAlpha = erasing ? 1 : settings.opacity;
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(point.x, point.y, radius, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function stampTextureEditorPen(context, point, settings) {
  context.save();
  context.globalAlpha = settings.opacity;
  context.fillStyle = settings.color;
  context.beginPath();
  context.arc(point.x, point.y, Math.max(.5, settings.size * .5), 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function textureEditorSprayDots(settings) {
  const radius = settings.size * .5;
  const dots = Math.max(8, Math.round(settings.size * .8));
  return Array.from({ length: dots }, () => {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.sqrt(Math.random()) * radius;
    return {
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      radius: Math.max(.55, settings.size * (.012 + Math.random() * .018))
    };
  });
}

function stampTextureEditorSpray(context, point, settings, sprayDots = null) {
  context.save();
  context.fillStyle = settings.color;
  context.globalAlpha = Math.min(1, settings.opacity * .42);
  for (const dot of sprayDots || textureEditorSprayDots(settings)) {
    context.beginPath();
    context.arc(point.x + dot.x, point.y + dot.y, dot.radius, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function renderTextureEditorBrushPreview() {
  const canvas = els.textureEditorBrushPreview;
  if (!canvas) return;
  const context = canvas.getContext("2d");
  const settings = textureEditorBrushSettings();
  const tool = textureEditorState.tool || "none";
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#10171c";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "rgba(255,255,255,.08)";
  for (let x = 0; x < canvas.width; x += 9) {
    context.beginPath(); context.moveTo(x, 0); context.lineTo(x, canvas.height); context.stroke();
  }
  const previewSize = Math.max(3, Math.min(42, 3 + settings.size / 6));
  const center = { x: canvas.width / 2, y: canvas.height / 2 };
  if (tool === "spray") {
    const previewSettings = { ...settings, size: previewSize * 2, opacity: 1 };
    stampTextureEditorSpray(context, center, previewSettings);
  } else if (["pen", "brush", "eraser"].includes(tool)) {
    const previewSettings = { ...settings, size: previewSize * 2, hardness: tool === "pen" ? 1 : settings.hardness, opacity: 1 };
    if (tool === "pen") stampTextureEditorPen(context, center, previewSettings);
    else stampTextureEditorBrush(context, center, previewSettings, false);
    context.strokeStyle = tool === "eraser" ? "#f4a8b8" : "rgba(255,255,255,.85)";
    context.lineWidth = 1;
    context.beginPath(); context.arc(center.x, center.y, previewSize, 0, Math.PI * 2); context.stroke();
  } else {
    context.fillStyle = "#aebbc4";
    context.font = "12px sans-serif";
    context.textAlign = "center";
    context.fillText(tool === "fill" ? "UV island" : tool === "hammer" ? "Impact radius" : tool === "pan" ? "Drag canvas" : "Sample color", center.x, center.y + 4);
  }
}

function fitTextureRect(sourceWidth, sourceHeight, targetWidth, targetHeight) {
  const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return {
    left: (targetWidth - width) / 2,
    top: (targetHeight - height) / 2,
    width,
    height
  };
}

function textureEditorPointFromEvent(event) {
  const canvas = els.textureEditorCanvas;
  const { x: localX, y: localY } = textureEditorCanvasPointFromEvent(event);
  const drawRect = textureEditorState.drawingRect;
  if (!drawRect) return null;
  const inside = localX >= drawRect.left && localX <= drawRect.left + drawRect.width && localY >= drawRect.top && localY <= drawRect.top + drawRect.height;
  if (!inside) return null;
  const source = currentTextureEditorCanvas();
  if (!source) return null;
  return {
    x: ((localX - drawRect.left) / drawRect.width) * source.width,
    y: ((localY - drawRect.top) / drawRect.height) * source.height
  };
}

function textureEditorCanvasPointFromEvent(event) {
  const canvas = els.textureEditorCanvas;
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (canvas.width / Math.max(1, rect.width)),
    y: (event.clientY - rect.top) * (canvas.height / Math.max(1, rect.height))
  };
}

function hideTextureEditorPointerPreview() {
  const preview = els.textureEditorPointerPreview;
  if (!preview) return;
  preview.style.display = "none";
}

function syncTextureEditorPointerPreview(event) {
  const preview = els.textureEditorPointerPreview;
  const canvas = els.textureEditorCanvas;
  const source = currentTextureEditorCanvas();
  const drawRect = textureEditorState.drawingRect;
  const tool = textureEditorState.tool || "brush";
  if (!preview || !canvas || !source || !drawRect || !["pen", "brush", "spray", "eraser", "hammer"].includes(tool)) {
    hideTextureEditorPointerPreview();
    return;
  }
  const sourcePoint = textureEditorPointFromEvent(event);
  if (!sourcePoint) {
    hideTextureEditorPointerPreview();
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const cssX = event.clientX - rect.left;
  const cssY = event.clientY - rect.top;
  const sourceDiameter = tool === "hammer"
    ? Math.max(4, Math.min(512, Number(els.textureEditorHammerRadius.value) || 48)) * 2
    : Math.max(1, Number(els.textureEditorBrushSize.value) || 12);
  const internalDiameter = (sourceDiameter / Math.max(1, source.width)) * drawRect.width;
  const cssDiameter = Math.max(4, internalDiameter * (rect.width / Math.max(1, canvas.width)));
  preview.className = `texture-editor-pointer-preview ${tool}`;
  preview.style.display = "block";
  preview.style.width = `${cssDiameter}px`;
  preview.style.height = `${cssDiameter}px`;
  preview.style.transform = `translate3d(${cssX - cssDiameter / 2}px, ${cssY - cssDiameter / 2}px, 0)`;
}

function requestTextureEditorRender() {
  if (textureEditorState.renderFrame) return;
  textureEditorState.renderFrame = requestAnimationFrame(() => {
    textureEditorState.renderFrame = 0;
    renderTextureEditor();
  });
}

let textureEditorResizeObserver = null;

function observeTextureEditorStage() {
  const stage = els.textureEditorCanvas?.parentElement;
  if (!stage || textureEditorResizeObserver || typeof ResizeObserver === "undefined") return;
  textureEditorResizeObserver = new ResizeObserver(() => {
    if (!textureEditorState.open || !els.textureEditorModal?.classList.contains("open")) return;
    requestTextureEditorRender();
  });
  textureEditorResizeObserver.observe(stage);
}

function setTextureEditorZoom(nextZoom, anchor = null, pointerEvent = null) {
  const canvas = els.textureEditorCanvas;
  const source = currentTextureEditorCanvas();
  if (!canvas || !source) return;
  const oldRect = textureEditorState.drawingRect;
  const zoom = Math.max(.25, Math.min(8, nextZoom));
  if (anchor && oldRect) {
    const u = (anchor.x - oldRect.left) / oldRect.width;
    const v = (anchor.y - oldRect.top) / oldRect.height;
    const base = fitTextureRect(source.width, source.height, canvas.width, canvas.height);
    const width = base.width * zoom;
    const height = base.height * zoom;
    textureEditorState.panX = anchor.x - (canvas.width - width) / 2 - u * width;
    textureEditorState.panY = anchor.y - (canvas.height - height) / 2 - v * height;
  }
  textureEditorState.zoom = zoom;
  renderTextureEditor();
  // A wheel event can change the on-screen brush diameter without moving the
  // pointer. Recalculate the lightweight preview immediately from that same
  // event so it scales during the scroll gesture instead of after mousemove.
  if (pointerEvent) syncTextureEditorPointerPreview(pointerEvent);
}

function drawUvTriangleOverlay(context, triangle, drawRect, color, lineWidth = 1.6) {
  context.beginPath();
  triangle.forEach((point, index) => {
    const x = drawRect.left + point.u * drawRect.width;
    const y = drawRect.top + point.v * drawRect.height;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.closePath();
  context.strokeStyle = color;
  context.lineWidth = lineWidth;
  context.stroke();
}

function renderTextureEditor() {
  if (!textureEditorState.open) return;
  const mesh = textureEditorMesh();
  const source = compositeTextureEditorLayers();
  const canvas = els.textureEditorCanvas;
  if (!mesh || !source || !canvas) return;
  const displayRect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.round(displayRect.width));
  canvas.height = Math.max(1, Math.round(displayRect.height));
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  const baseRect = fitTextureRect(source.width, source.height, canvas.width, canvas.height);
  const zoom = textureEditorState.zoom || 1;
  const drawRect = {
    width: baseRect.width * zoom,
    height: baseRect.height * zoom,
    left: (canvas.width - baseRect.width * zoom) / 2 + (textureEditorState.panX || 0),
    top: (canvas.height - baseRect.height * zoom) / 2 + (textureEditorState.panY || 0)
  };
  textureEditorState.drawingRect = drawRect;
  context.drawImage(source, drawRect.left, drawRect.top, drawRect.width, drawRect.height);

  const allTriangles = uvTrianglesForMesh(mesh);
  const selectedTriangles = selectedUvTrianglesForMesh(mesh);
  const onlySelected = !!els.textureEditorSelectedOnly.checked && selectedTriangles.length;
  if (onlySelected) {
    context.fillStyle = "rgba(0, 0, 0, 0.55)";
    context.fillRect(drawRect.left, drawRect.top, drawRect.width, drawRect.height);
    context.save();
    textureEditorTrianglesPath(context, selectedTriangles, drawRect.width, drawRect.height, drawRect.left, drawRect.top);
    context.clip();
    context.drawImage(source, drawRect.left, drawRect.top, drawRect.width, drawRect.height);
    context.restore();
  }
  if (els.textureEditorShowUv.checked) {
    if (!onlySelected) {
      for (const triangle of allTriangles) drawUvTriangleOverlay(context, triangle, drawRect, "rgba(93, 223, 255, 0.85)", 1.5);
    }
    for (const triangle of selectedTriangles) drawUvTriangleOverlay(context, triangle, drawRect, "rgba(255, 191, 71, 1)", 2.3);
  }

  const symmetry = normalizedTextureEditorSymmetry(textureEditorState.symmetry);
  if (symmetry !== "none") {
    context.save();
    context.setLineDash([8, 6]);
    context.lineWidth = 1.5;
    context.strokeStyle = "rgba(45, 212, 191, .95)";
    if (symmetry === "u" || symmetry === "uv") {
      const centerX = drawRect.left + drawRect.width * .5;
      context.beginPath();
      context.moveTo(centerX, drawRect.top);
      context.lineTo(centerX, drawRect.top + drawRect.height);
      context.stroke();
    }
    if (symmetry === "v" || symmetry === "uv") {
      const centerY = drawRect.top + drawRect.height * .5;
      context.beginPath();
      context.moveTo(drawRect.left, centerY);
      context.lineTo(drawRect.left + drawRect.width, centerY);
      context.stroke();
    }
    context.restore();
  }

  const paintSelection = textureEditorState.selectionDraft || textureEditorState.selection;
  if (paintSelection) {
    context.save();
    const hasPath = textureEditorSelectionPath(
      context,
      paintSelection,
      drawRect.width / Math.max(1, source.width),
      drawRect.height / Math.max(1, source.height),
      drawRect.left,
      drawRect.top
    );
    if (hasPath) {
      context.fillStyle = "rgba(45, 212, 191, 0.12)";
      context.fill();
      context.setLineDash([7, 5]);
      context.lineWidth = 2;
      context.strokeStyle = "rgba(94, 234, 212, 1)";
      context.stroke();
    }
    context.restore();
  }

  if (textureEditorState.isDrawingShape && textureEditorState.shapeStart && textureEditorState.shapeEnd) {
    const mapPoint = point => ({
      x: drawRect.left + (point.x / Math.max(1, source.width)) * drawRect.width,
      y: drawRect.top + (point.y / Math.max(1, source.height)) * drawRect.height
    });
    context.save();
    for (const transform of textureEditorSymmetryTransforms()) {
      const previewStart = mapPoint(transformedTextureEditorPoint(textureEditorState.shapeStart, source, transform));
      const previewEnd = mapPoint(transformedTextureEditorPoint(textureEditorState.shapeEnd, source, transform));
      textureEditorShapePath(context, textureEditorState.shape || "rectangle", previewStart, previewEnd);
      context.setLineDash([6, 4]);
      context.lineWidth = 2;
      context.strokeStyle = "rgba(255, 191, 71, 1)";
      context.stroke();
    }
    context.restore();
  }

  const mirroredPointerTools = new Set(["pen", "brush", "spray", "eraser", "hammer"]);
  if (symmetry !== "none" && textureEditorState.hoverPoint && mirroredPointerTools.has(textureEditorState.tool)) {
    const settings = textureEditorBrushSettings();
    const sourceRadius = textureEditorState.tool === "hammer"
      ? Math.max(4, Math.min(512, Number(els.textureEditorHammerRadius?.value) || 48))
      : Math.max(1, settings.size * .5);
    const displayRadius = sourceRadius * (drawRect.width / Math.max(1, source.width));
    const mirroredPoints = textureEditorSymmetryPoints(textureEditorState.hoverPoint, source).slice(1);
    context.save();
    context.setLineDash([5, 4]);
    context.lineWidth = 1.5;
    context.strokeStyle = "rgba(94, 234, 212, .95)";
    context.fillStyle = "rgba(45, 212, 191, .08)";
    for (const mirroredPoint of mirroredPoints) {
      const x = drawRect.left + (mirroredPoint.x / Math.max(1, source.width)) * drawRect.width;
      const y = drawRect.top + (mirroredPoint.y / Math.max(1, source.height)) * drawRect.height;
      context.beginPath();
      context.arc(x, y, Math.max(2, displayRadius), 0, Math.PI * 2);
      context.fill();
      context.stroke();
    }
    context.restore();
  }

  els.textureEditorInfo.textContent = selectedTriangles.length
    ? `${onlySelected ? "Isolating" : "Showing"} ${selectedTriangles.length} selected triangle${selectedTriangles.length === 1 ? "" : "s"} on ${mesh.name}.`
    : `No triangles selected on ${mesh.name} yet, so tools affect the visible UV area.`;
  if (els.textureEditorZoomValue) els.textureEditorZoomValue.textContent = `${Math.round(zoom * 100)}%`;
  syncTextureEditorSelectionUi();
  renderTextureEditorBrushPreview();
}

function textureEditorStrokeTo(point) {
  const mesh = textureEditorMesh();
  const source = currentTextureEditorCanvas();
  if (!mesh || !source || !point) return;
  const context = source.getContext("2d");
  const settings = textureEditorBrushSettings();
  const erasing = textureEditorState.tool === "eraser";
  const from = textureEditorState.lastPoint || point;
  const distance = Math.hypot(point.x - from.x, point.y - from.y);
  const steps = Math.max(1, Math.ceil(distance / Math.max(1, settings.size * .18)));
  context.save();
  textureEditorClipToActiveMask(context, mesh, source);
  for (let step = 0; step <= steps; step += 1) {
    const amount = step / steps;
    const stampPoint = {
      x: from.x + (point.x - from.x) * amount,
      y: from.y + (point.y - from.y) * amount
    };
    const sprayDots = textureEditorState.tool === "spray" ? textureEditorSprayDots(settings) : null;
    withTextureEditorSymmetry(context, source, () => {
      if (textureEditorState.tool === "spray") stampTextureEditorSpray(context, stampPoint, settings, sprayDots);
      else if (textureEditorState.tool === "pen") stampTextureEditorPen(context, stampPoint, settings);
      else stampTextureEditorBrush(context, stampPoint, settings, erasing);
    });
  }
  context.restore();
  textureEditorState.lastPoint = point;
  requestTextureEditorRender();
}

function sampleTextureEditorColor(point) {
  const source = compositeTextureEditorLayers();
  if (!source || !point) return;
  const pixel = source.getContext("2d", { willReadFrequently: true }).getImageData(
    Math.max(0, Math.min(source.width - 1, Math.floor(point.x))),
    Math.max(0, Math.min(source.height - 1, Math.floor(point.y))),
    1,
    1
  ).data;
  const channel = normalizedMaterialTextureChannel(textureEditorState.channel);
  if (channel === "roughness" || channel === "metalness") {
    const component = channel === "roughness" ? pixel[1] : pixel[2];
    els.textureEditorChannelValue.value = String(Math.round((component / 255) * 100));
  } else {
    els.textureEditorColor.value = `#${[pixel[0], pixel[1], pixel[2]].map(value => value.toString(16).padStart(2, "0")).join("")}`;
    if (channel === "emissive") els.textureEditorChannelValue.value = "100";
  }
  els.textureEditorOpacity.value = String(Math.max(1, Math.round((pixel[3] / 255) * 100)));
  syncTextureEditorChannelValueUi();
  renderTextureEditor();
}

function fillTextureEditorIsland(point) {
  const mesh = textureEditorMesh();
  const source = currentTextureEditorCanvas();
  if (!mesh || !source || !point) return false;
  const islands = textureEditorSymmetryPoints(point, source)
    .map(symmetryPoint => textureEditorIslandAtPoint(mesh, symmetryPoint))
    .filter(island => island.length);
  const uniqueIslands = [];
  const islandKeys = new Set();
  for (const island of islands) {
    const key = island
      .map(triangle => triangle.map(vertex => `${vertex.u.toFixed(6)},${vertex.v.toFixed(6)}`).join(";"))
      .sort()
      .join("|");
    if (islandKeys.has(key)) continue;
    islandKeys.add(key);
    uniqueIslands.push(island);
  }
  if (!uniqueIslands.length) {
    log("Texture Fill needs a click inside one visible UV island.");
    return false;
  }
  snapshotTextureEditor();
  const settings = textureEditorBrushSettings();
  const context = source.getContext("2d");
  for (const island of uniqueIslands) {
    context.save();
    textureEditorClipToActiveMask(context, mesh, source, island);
    context.globalAlpha = settings.opacity;
    context.fillStyle = settings.color;
    context.fillRect(0, 0, source.width, source.height);
    context.restore();
  }
  renderTextureEditor();
  return true;
}

function applyGlassBreakEffect(point) {
  const mesh = textureEditorMesh();
  const source = currentTextureEditorCanvas();
  if (!mesh || !source || !point) return;
  snapshotTextureEditor();
  const maskTriangles = textureEditorMaskTriangles(mesh);
  const context = source.getContext("2d", { willReadFrequently: true });
  const radius = Math.max(4, Math.min(512, Number(els.textureEditorHammerRadius.value) || 48));
  context.save();
  textureEditorTrianglesPath(context, maskTriangles, source.width, source.height);
  context.clip();
  textureEditorClipToSelection(context, source);
  for (const effectPoint of textureEditorSymmetryPoints(point, source)) {
    const hitCount = 1 + Math.floor(Math.random() * 2);
    for (let hit = 0; hit < hitCount; hit++) {
    const centerX = effectPoint.x + (Math.random() - .5) * radius * 0.18;
    const centerY = effectPoint.y + (Math.random() - .5) * radius * 0.18;
    const currentRadius = radius * (.9 + Math.random() * .2);
    const rayCount = 14 + Math.floor(Math.random() * 8);

    context.save();
    context.beginPath();
    context.arc(centerX, centerY, currentRadius, 0, Math.PI * 2);
    context.clip();

    const frost = context.createRadialGradient(centerX, centerY, currentRadius * 0.04, centerX, centerY, currentRadius);
    frost.addColorStop(0, "rgba(255,255,255,0.92)");
    frost.addColorStop(.12, "rgba(235,245,255,0.82)");
    frost.addColorStop(.45, "rgba(210,225,245,0.34)");
    frost.addColorStop(1, "rgba(210,225,245,0)");
    context.fillStyle = frost;
    context.beginPath();
    context.arc(centerX, centerY, currentRadius, 0, Math.PI * 2);
    context.fill();

    context.globalCompositeOperation = "multiply";
    const darkCore = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, currentRadius * 0.24);
    darkCore.addColorStop(0, "rgba(24, 28, 36, 0.92)");
    darkCore.addColorStop(.55, "rgba(70, 82, 100, 0.32)");
    darkCore.addColorStop(1, "rgba(70, 82, 100, 0)");
    context.fillStyle = darkCore;
    context.beginPath();
    context.arc(centerX, centerY, currentRadius * 0.24, 0, Math.PI * 2);
    context.fill();

    context.globalCompositeOperation = "screen";
    context.strokeStyle = "rgba(255, 255, 255, 0.98)";
    context.lineWidth = Math.max(1.1, currentRadius / 26);
    context.lineCap = "round";
    for (let i = 0; i < rayCount; i++) {
      const baseAngle = (Math.PI * 2 * i) / rayCount + (Math.random() - .5) * 0.24;
      const segments = 4 + Math.floor(Math.random() * 3);
      const length = currentRadius * (.52 + Math.random() * .5);
      let lastX = centerX;
      let lastY = centerY;
      context.beginPath();
      context.moveTo(lastX, lastY);
      for (let step = 1; step <= segments; step++) {
        const distance = length * (step / segments);
        const jitter = (Math.random() - .5) * currentRadius * 0.16;
        const angle = baseAngle + (Math.random() - .5) * 0.22;
        const nextX = centerX + Math.cos(angle) * distance - Math.sin(angle) * jitter;
        const nextY = centerY + Math.sin(angle) * distance + Math.cos(angle) * jitter;
        context.lineTo(nextX, nextY);
        lastX = nextX;
        lastY = nextY;
        if (step >= 2 && Math.random() > .48) {
          const branchAngle = angle + (Math.random() > .5 ? 1 : -1) * (.28 + Math.random() * .42);
          const branchLength = currentRadius * (.12 + Math.random() * .26);
          context.moveTo(lastX, lastY);
          context.lineTo(lastX + Math.cos(branchAngle) * branchLength, lastY + Math.sin(branchAngle) * branchLength);
          context.moveTo(lastX, lastY);
        }
      }
      context.stroke();
    }

    context.globalCompositeOperation = "source-over";
    context.strokeStyle = "rgba(255,255,255,0.75)";
    context.lineWidth = Math.max(0.8, currentRadius / 40);
    context.beginPath();
    context.arc(centerX, centerY, currentRadius * 0.18, 0, Math.PI * 2);
    context.stroke();
    context.restore();
    }
  }
  context.restore();
  renderTextureEditor();
}

function textureEditorDraftKey(meshId, channel = "baseColor") {
  return `${meshId}:${normalizedMaterialTextureChannel(channel)}`;
}

function defaultMaterialChannelCanvas(mesh, channel, width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, width || 1024);
  canvas.height = Math.max(1, height || 1024);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.fillStyle = channel === "roughness" ? "#ffffff" : "#000000";
  context.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}

function persistTextureEditorDraft() {
  if (!textureEditorState.meshId || !textureEditorState.sourceCanvas) return;
  const mesh = textureEditorMesh();
  const channelData = materialTextureChannelData(mesh, textureEditorState.channel);
  const composite = compositeTextureEditorLayers();
  textureEditorDrafts.set(textureEditorDraftKey(textureEditorState.meshId, channelData.channel), {
    sourceCanvas: textureEditorState.sourceCanvas,
    sourceDataUrl: composite?.toDataURL("image/png") || textureEditorState.sourceCanvas.toDataURL("image/png"),
    layers: textureEditorState.layers.map(layer => ({
      id: layer.id,
      name: layer.name,
      visible: layer.visible !== false,
      dataUrl: layer.canvas.toDataURL("image/png")
    })),
    activeLayerId: textureEditorState.activeLayerId,
    originalCanvas: textureEditorState.originalCanvas,
    originalPixels: cloneTextureEditorPixels(textureEditorState.originalPixels),
    originalDataUrl: textureEditorState.originalDataUrl,
    textureUrl: channelData.url,
    undoStack: textureEditorState.undoStack,
    textureName: textureEditorState.textureName,
    tool: textureEditorState.tool,
    symmetry: textureEditorState.symmetry,
    color: els.textureEditorColor?.value || "#ff7f50",
    channelValue: textureEditorChannelValue(),
    zoom: textureEditorState.zoom,
    panX: textureEditorState.panX,
    panY: textureEditorState.panY
  });
}

function syncTextureEditorChannelUi(channel) {
  const normalized = normalizedMaterialTextureChannel(channel);
  const config = materialTextureChannels[normalized];
  for (const button of els.textureEditorChannelButtons || []) {
    button.classList.toggle("active", button.dataset.textureChannel === normalized);
  }
  if (els.textureEditorChannelInfo) els.textureEditorChannelInfo.textContent = config.info;
  if (els.textureEditorApplyBtn) els.textureEditorApplyBtn.textContent = `Apply ${config.label}`;
  syncTextureEditorChannelValueUi();
  syncTextureEditorToolSettings(textureEditorState.tool);
}

async function loadTextureEditorChannel(mesh, channel = "baseColor") {
  const channelData = materialTextureChannelData(mesh, channel);
  const baseImage = mesh.material.map?.image || await loadImage(mesh.userData.textureUrl);
  const channelMap = mesh.material[channelData.config.mapKey];
  const channelImage = channelData.url
    ? (channelMap?.image || await loadImage(channelData.url))
    : null;
  const liveTextureCanvas = channelImage
    ? readImageToCanvas(channelImage)
    : defaultMaterialChannelCanvas(
      mesh,
      channelData.channel,
      baseImage?.naturalWidth || baseImage?.width,
      baseImage?.naturalHeight || baseImage?.height
    );
  const draft = textureEditorDrafts.get(textureEditorDraftKey(mesh.userData.id, channelData.channel));
  const draftMatchesTexture = !!draft && draft.textureUrl === channelData.url;
  const draftSourceCanvas = draftMatchesTexture && draft.sourceDataUrl
    ? readImageToCanvas(await loadImage(draft.sourceDataUrl))
    : null;
  const restoredLayers = [];
  if (draftMatchesTexture && draft?.layers?.length) {
    for (const savedLayer of draft.layers) {
      const image = await loadImage(savedLayer.dataUrl);
      restoredLayers.push(createTextureEditorLayer(
        savedLayer.name,
        readImageToCanvas(image),
        savedLayer.visible,
        savedLayer.id
      ));
    }
  }
  const originalDataUrl = draftMatchesTexture && draft.originalDataUrl
    ? draft.originalDataUrl
    : liveTextureCanvas.toDataURL("image/png");
  const originalCanvas = readImageToCanvas(await loadImage(originalDataUrl));
  textureEditorState.meshId = mesh.userData.id;
  textureEditorState.channel = channelData.channel;
  textureEditorState.textureName = channelData.name;
  const initialCanvas = draftSourceCanvas || (draftMatchesTexture ? draft?.sourceCanvas : null) || liveTextureCanvas;
  textureEditorState.layers = restoredLayers.length
    ? restoredLayers
    : [createTextureEditorLayer("Base", initialCanvas)];
  textureEditorState.activeLayerId = textureEditorState.layers.some(layer => layer.id === draft?.activeLayerId)
    ? draft.activeLayerId
    : textureEditorState.layers.at(-1).id;
  textureEditorState.sourceCanvas = currentTextureEditorCanvas();
  textureEditorState.originalCanvas = originalCanvas;
  textureEditorState.originalPixels = draftMatchesTexture && draft?.originalPixels
    ? cloneTextureEditorPixels(draft.originalPixels)
    : captureTextureEditorPixels(originalCanvas);
  textureEditorState.originalDataUrl = originalDataUrl;
  textureEditorState.isPainting = false;
  textureEditorState.lastPoint = null;
  textureEditorState.hoverPoint = null;
  textureEditorState.tool = draftMatchesTexture ? (draft?.tool || "brush") : "brush";
  textureEditorState.symmetry = draftMatchesTexture ? normalizedTextureEditorSymmetry(draft?.symmetry) : "none";
  textureEditorState.undoStack = draftMatchesTexture ? (draft?.undoStack || []) : [];
  textureEditorState.zoom = draftMatchesTexture ? (draft?.zoom || 1) : 1;
  textureEditorState.panX = draftMatchesTexture ? (draft?.panX || 0) : 0;
  textureEditorState.panY = draftMatchesTexture ? (draft?.panY || 0) : 0;
  textureEditorState.strokeSnapshotTaken = false;
  textureEditorState.open = true;
  if (els.textureEditorColor) {
    els.textureEditorColor.value = draftMatchesTexture && draft?.color
      ? draft.color
      : channelData.channel === "emissive"
        ? "#ffffff"
        : "#ff7f50";
  }
  if (els.textureEditorChannelValue) {
    els.textureEditorChannelValue.value = String(draftMatchesTexture && Number.isFinite(Number(draft?.channelValue))
      ? Number(draft.channelValue)
      : 100);
  }
  els.textureEditorMeshName.textContent = `${mesh.name} - ${channelData.config.label}`;
  syncTextureEditorChannelUi(channelData.channel);
  setTextureEditorTool(textureEditorState.tool);
  setTextureEditorSymmetry(textureEditorState.symmetry);
  updateTextureEditorUndoButton();
  updateTextureEditorResetButton();
  renderTextureEditorLayerUi();
  renderTextureEditor();
}

async function switchTextureEditorChannel(channel) {
  if (!textureEditorState.open) return;
  const mesh = textureEditorMesh();
  if (!mesh || normalizedMaterialTextureChannel(channel) === textureEditorState.channel) return;
  const activeTool = textureEditorState.tool || "brush";
  const activeSymmetry = textureEditorState.symmetry || "none";
  persistTextureEditorDraft();
  try {
    await loadTextureEditorChannel(mesh, channel);
    // Keep the compact tool controls stable while moving between material
    // channels. The active tool remains selected, while channel-specific
    // controls swap between color, grayscale value, and glow strength.
    setTextureEditorTool(activeTool);
    setTextureEditorSymmetry(activeSymmetry);
  } catch (error) {
    log(`Could not open the material channel: ${error.message}`);
  }
}

async function openTextureEditor() {
  const mesh = selectedTextureEditorMesh();
  if (!mesh) {
    log("Select one textured mesh with UVs before opening the texture editor.");
    return;
  }
  try {
    await loadTextureEditorChannel(mesh, "baseColor");
    els.textureEditorModal.classList.add("open");
    els.textureEditorModal.setAttribute("aria-hidden", "false");
    observeTextureEditorStage();
    // Loading the channel happens while the modal is hidden, when its stage
    // has no final layout yet. Render again only after opening it so the
    // canvas backing size and its CSS size share the same aspect ratio.
    renderTextureEditor();
    requestTextureEditorRender();
  } catch (error) {
    log(`Texture editor failed to open: ${error.message}`);
  }
}

function closeTextureEditor() {
  persistTextureEditorDraft();
  if (textureEditorState.renderFrame) cancelAnimationFrame(textureEditorState.renderFrame);
  textureEditorState.renderFrame = 0;
  hideTextureEditorPointerPreview();
  textureEditorState.open = false;
  textureEditorState.meshId = null;
  textureEditorState.sourceCanvas = null;
  textureEditorState.layers = [];
  textureEditorState.activeLayerId = null;
  textureEditorState.originalCanvas = null;
  textureEditorState.originalPixels = null;
  textureEditorState.originalDataUrl = null;
  textureEditorState.channel = "baseColor";
  textureEditorState.drawingRect = null;
  textureEditorState.isPainting = false;
  textureEditorState.lastPoint = null;
  textureEditorState.hoverPoint = null;
  textureEditorState.undoStack = [];
  textureEditorState.isPanning = false;
  textureEditorState.panStart = null;
  textureEditorState.strokeSnapshotTaken = false;
  textureEditorState.selection = null;
  textureEditorState.selectionDraft = null;
  textureEditorState.isSelecting = false;
  textureEditorState.shapeStart = null;
  textureEditorState.shapeEnd = null;
  textureEditorState.isDrawingShape = false;
  textureEditorState.symmetry = "none";
  for (const button of els.textureEditorSymmetryButtons || []) {
    const active = button.dataset.textureSymmetry === "none";
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  }
  syncTextureEditorSelectionUi();
  updateTextureEditorUndoButton();
  updateTextureEditorResetButton();
  renderTextureEditorLayerUi();
  els.textureEditorModal.classList.remove("open");
  els.textureEditorModal.setAttribute("aria-hidden", "true");
}

function resetTextureEditorCanvas() {
  if (!textureEditorState.originalPixels) {
    log("Restore Original could not find the pristine texture snapshot for this editing session.");
    return;
  }
  snapshotTextureEditor();
  const original = canvasFromTextureEditorPixels(textureEditorState.originalPixels);
  const base = createTextureEditorLayer("Base", original);
  textureEditorState.layers = [base];
  textureEditorState.activeLayerId = base.id;
  textureEditorState.sourceCanvas = original;
  const draft = textureEditorDrafts.get(textureEditorDraftKey(textureEditorState.meshId, textureEditorState.channel));
  if (draft) {
    draft.sourceCanvas = textureEditorState.sourceCanvas;
    draft.sourceDataUrl = textureEditorState.sourceCanvas.toDataURL("image/png");
    draft.layers = [{ id: base.id, name: base.name, visible: true, dataUrl: draft.sourceDataUrl }];
    draft.activeLayerId = base.id;
  }
  updateTextureEditorUndoButton();
  renderTextureEditorLayerUi();
  renderTextureEditor();
  log("Restored the texture editor to the original texture from before this editing session.");
}

function applyTextureEditorChanges() {
  const mesh = textureEditorMesh();
  const source = compositeTextureEditorLayers();
  if (!mesh || !source) return;
  recordHistory("edit texture");
  const dataUrl = source.toDataURL("image/png");
  const channelData = materialTextureChannelData(mesh, textureEditorState.channel);
  const textureName = channelData.name || textureEditorState.textureName || `${mesh.name} ${channelData.config.label}`;
  registerTextureAsset(textureName, dataUrl, { replace: true });
  applyMaterialTextureChannel(mesh, channelData.channel, dataUrl, textureName);
  refreshTextureLibraryUi();
  syncInspector();
  updateAll();
  persistTextureEditorDraft();
  // Keep the frozen pre-edit pixels after Apply so Restore Original still
  // reaches the baked/source texture when this editor is opened again.
  // Loading a different texture invalidates the draft through textureUrl.
  log(`Applied ${channelData.config.label} channel to ${mesh.name}.`);
}

function geometryFromData(data) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(data.positions, 3));
  if (data.normals?.length === data.positions.length) geometry.setAttribute("normal", new THREE.Float32BufferAttribute(data.normals, 3));
  if (data.colors?.length === data.positions.length) geometry.setAttribute("color", new THREE.Float32BufferAttribute(data.colors, 3));
  if (data.uvs?.length) geometry.setAttribute("uv", new THREE.Float32BufferAttribute(data.uvs, 2));
  if (data.indices?.length) geometry.setIndex(data.indices);
  geometry.computeBoundingSphere();
  if (!geometry.getAttribute("normal")) geometry.computeVertexNormals();
  return geometry;
}

function geometryToData(geometry) {
  const source = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  source.computeVertexNormals();
  const position = source.getAttribute("position");
  const normal = source.getAttribute("normal");
  const color = source.getAttribute("color");
  const uv = source.getAttribute("uv");
  const positions = [];
  const normals = [];
  const colors = [];
  const uvs = [];
  for (let i = 0; i < position.count; i++) {
    positions.push(round(position.getX(i)), round(position.getY(i)), round(position.getZ(i)));
    normals.push(round(normal.getX(i)), round(normal.getY(i)), round(normal.getZ(i)));
    if (color) colors.push(round(color.getX(i)), round(color.getY(i)), round(color.getZ(i)));
    if (uv) uvs.push(round(uv.getX(i)), round(uv.getY(i)));
  }
  source.dispose();
  return { positions, normals, colors, uvs };
}

function axisIndex(axis) {
  return { x: 0, y: 1, z: 2 }[axis] ?? 0;
}

function component(vector, index) {
  return index === 0 ? vector.x : index === 1 ? vector.y : vector.z;
}

function setComponent(vector, index, value) {
  if (index === 0) vector.x = value;
  else if (index === 1) vector.y = value;
  else vector.z = value;
  return vector;
}

function cutSpecFromObject(spec = {}) {
  const result = {};
  const readDirect = side => {
    const keys = side === "top"
      ? ["top-remove", "top_cut", "top-cut", "topRemove", "topCut", "removeTop", "cutTop"]
      : ["bottom-remove", "bottom_cut", "bottom-cut", "bottomRemove", "bottomCut", "removeBottom", "cutBottom"];
    for (const key of keys) if (spec[key] !== undefined) return spec[key];
    if (spec.cut?.[side] !== undefined) return spec.cut[side];
    if (spec.cuts?.[side] !== undefined) return spec.cuts[side];
    if (spec.clip?.[side] !== undefined) return spec.clip[side];
    if (typeof spec.modifiers === "object" && spec.modifiers?.[side] !== undefined) return spec.modifiers[side];
    const keyPattern = new RegExp(`^${side}[-_ ]?(?:remove|cut):(.+)$`, "i");
    for (const key of Object.keys(spec)) {
      const match = key.match(keyPattern);
      if (match) return match[1];
    }
    return null;
  };
  const readText = side => {
    const text = [spec.modifier, spec.modifiers, spec.edit, spec.command]
      .filter(value => typeof value === "string")
      .join(" ");
    const match = text.match(new RegExp(`${side}\\s*[-_ ]\\s*(?:remove|cut)\\s*:\\s*([+-]?[0-9.]+\\s*%?|[+-]?[0-9.]+\\s*(?:u|unit|units|stud|studs)?)`, "i"));
    return match ? match[1] : null;
  };
  for (const side of ["top", "bottom"]) {
    const value = readDirect(side) ?? readText(side);
    if (value !== null && value !== undefined && value !== "") result[side] = value;
  }
  return Object.keys(result).length ? result : null;
}

function cutDistance(value, span) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "string") {
    const text = value.trim().toLowerCase();
    const number = Number.parseFloat(text);
    if (!Number.isFinite(number)) return 0;
    if (text.endsWith("%")) return span * Math.max(0, Math.min(.98, number / 100));
    if (/(u|unit|units|stud|studs)$/.test(text)) return Math.max(0, Math.min(span * .98, number));
    return number <= 1 ? span * Math.max(0, Math.min(.98, number)) : Math.max(0, Math.min(span * .98, number));
  }
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return number <= 1 ? span * Math.max(0, Math.min(.98, number)) : Math.max(0, Math.min(span * .98, number));
}

function geometryClipVertex(position, uv, index) {
  return {
    point: new THREE.Vector3(position.getX(index), position.getY(index), position.getZ(index)),
    uv: uv ? new THREE.Vector2(uv.getX(index), uv.getY(index)) : null
  };
}

function lerpClipVertex(a, b, t) {
  return {
    point: a.point.clone().lerp(b.point, t),
    uv: a.uv && b.uv ? a.uv.clone().lerp(b.uv, t) : null
  };
}

function pushClipTriangle(buffers, a, b, c) {
  buffers.positions.push(...a.point.toArray(), ...b.point.toArray(), ...c.point.toArray());
  if (buffers.hasUv) {
    for (const vertex of [a, b, c]) {
      const uv = vertex.uv || new THREE.Vector2(.5, .5);
      buffers.uvs.push(uv.x, uv.y);
    }
  }
}

function clipGeometryCoordinate(geometry, {
  axis = "y",
  plane = 0,
  keepSide = "negative",
  cap = true,
  returnLoops = false
} = {}) {
  const source = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  const index = axisIndex(axis);
  const keepSign = keepSide === "positive" ? -1 : 1;
  const position = source.getAttribute("position");
  const uv = source.getAttribute("uv");
  const buffers = { positions: [], uvs: [], hasUv: Boolean(uv) };
  const capVertices = new Map();
  const capEdges = new Map();
  const axes = [0, 1, 2].filter(axisIndexValue => axisIndexValue !== index);
  const edgePointEpsilon = .0001;
  const inside = vertex => keepSign * (vertex.point.getComponent(index) - plane) <= .00001;
  const intersection = (a, b) => {
    const da = a.point.getComponent(index) - plane;
    const db = b.point.getComponent(index) - plane;
    const t = da / (da - db);
    const vertex = lerpClipVertex(a, b, t);
    vertex.point.setComponent(index, plane);
    return vertex;
  };
  const capVertexKey = point => point.toArray().map(value => Math.round(value * 10000)).join(",");
  const capEdgeKey = (a, b) => a < b ? `${a}|${b}` : `${b}|${a}`;
  const pointToCapVertex2 = vertex => new THREE.Vector2(
    vertex.point.getComponent(axes[0]),
    vertex.point.getComponent(axes[1])
  );
  const signedArea2 = points => {
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      area += a.x * b.y - b.x * a.y;
    }
    return area * .5;
  };
  const pointInPolygon2 = (point, polygon) => {
    let insidePolygon = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[i];
      const b = polygon[j];
      const intersects = ((a.y > point.y) !== (b.y > point.y))
        && (point.x < ((b.x - a.x) * (point.y - a.y)) / ((b.y - a.y) || 1e-9) + a.x);
      if (intersects) insidePolygon = !insidePolygon;
    }
    return insidePolygon;
  };
  const registerCapVertex = vertex => {
    const key = capVertexKey(vertex.point);
    if (!capVertices.has(key)) capVertices.set(key, {
      id: key,
      point: vertex.point.clone(),
      uv: vertex.uv ? vertex.uv.clone() : null
    });
    return key;
  };
  const registerCapEdge = (a, b) => {
    if (a.point.distanceToSquared(b.point) <= edgePointEpsilon * edgePointEpsilon) return;
    const idA = registerCapVertex(a);
    const idB = registerCapVertex(b);
    if (idA === idB) return;
    const key = capEdgeKey(idA, idB);
    if (capEdges.has(key)) capEdges.delete(key);
    else capEdges.set(key, [idA, idB]);
  };
  const collectCapEdges = polygon => {
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i];
      const b = polygon[(i + 1) % polygon.length];
      const aOnPlane = Math.abs(a.point.getComponent(index) - plane) < edgePointEpsilon;
      const bOnPlane = Math.abs(b.point.getComponent(index) - plane) < edgePointEpsilon;
      if (aOnPlane && bOnPlane) registerCapEdge(a, b);
    }
  };
  const buildCapLoops = () => {
    const adjacency = new Map();
    for (const [a, b] of capEdges.values()) {
      if (!adjacency.has(a)) adjacency.set(a, []);
      if (!adjacency.has(b)) adjacency.set(b, []);
      adjacency.get(a).push(b);
      adjacency.get(b).push(a);
    }
    const unused = new Set(capEdges.keys());
    const loops = [];
    while (unused.size) {
      const firstKey = unused.values().next().value;
      const [start, nextStart] = capEdges.get(firstKey);
      const loop = [start];
      let previous = start;
      let current = nextStart;
      unused.delete(firstKey);
      let guard = 0;
      while (guard++ < 10000) {
        loop.push(current);
        const neighbors = (adjacency.get(current) || []).filter(id => id !== previous);
        if (current === start) break;
        let next = neighbors[0];
        if (neighbors.length > 1) {
          const prevPoint = pointToCapVertex2(capVertices.get(previous));
          const currentPoint = pointToCapVertex2(capVertices.get(current));
          const incoming = prevPoint.clone().sub(currentPoint).normalize();
          let bestAngle = Infinity;
          for (const candidate of neighbors) {
            const candidatePoint = pointToCapVertex2(capVertices.get(candidate));
            const outgoing = candidatePoint.clone().sub(currentPoint).normalize();
            const angle = Math.atan2(
              incoming.x * outgoing.y - incoming.y * outgoing.x,
              incoming.x * outgoing.x + incoming.y * outgoing.y
            );
            const normalized = angle <= 0 ? angle + Math.PI * 2 : angle;
            if (normalized < bestAngle) {
              bestAngle = normalized;
              next = candidate;
            }
          }
        }
        if (!next) break;
        const nextEdgeKey = capEdgeKey(current, next);
        unused.delete(nextEdgeKey);
        previous = current;
        current = next;
        if (current === start) {
          loop.push(start);
          break;
        }
      }
      const uniqueLoop = loop.slice(0, -1).filter((id, idx, array) => idx === 0 || id !== array[idx - 1]);
      if (uniqueLoop.length >= 3) loops.push(uniqueLoop);
    }
    return loops;
  };
  const triangulateCapLoops = loops => {
    const loopEntries = loops.map((ids, loopIndex) => {
      const points2 = ids.map(id => pointToCapVertex2(capVertices.get(id)));
      return {
        loopIndex,
        ids,
        points2,
        area: signedArea2(points2),
        absArea: Math.abs(signedArea2(points2)),
        parent: -1,
        depth: 0
      };
    }).filter(entry => entry.points2.length >= 3 && entry.absArea > 1e-8);

    loopEntries.sort((a, b) => b.absArea - a.absArea);
    for (let i = 0; i < loopEntries.length; i++) {
      const child = loopEntries[i];
      const testPoint = child.points2[0];
      for (let j = i - 1; j >= 0; j--) {
        const parent = loopEntries[j];
        if (pointInPolygon2(testPoint, parent.points2)) {
          child.parent = parent.loopIndex;
          child.depth = parent.depth + 1;
          break;
        }
      }
    }

    const desiredNormal = new THREE.Vector3();
    desiredNormal.setComponent(index, keepSide === "negative" ? 1 : -1);

    for (const entry of loopEntries) {
      if (entry.depth % 2 !== 0) continue;
      const contour = entry.points2.map(point => point.clone());
      const holeEntries = loopEntries.filter(candidate => candidate.parent === entry.loopIndex && candidate.depth === entry.depth + 1);
      const holes = holeEntries.map(hole => hole.points2.map(point => point.clone()));

      if (!THREE.ShapeUtils.isClockWise(contour)) contour.reverse(), entry.ids.reverse();
      holeEntries.forEach((holeEntry, holeIndex) => {
        if (THREE.ShapeUtils.isClockWise(holes[holeIndex])) {
          holes[holeIndex].reverse();
          holeEntry.ids.reverse();
        }
      });

      const faces = THREE.ShapeUtils.triangulateShape(contour, holes);
      const flattenedIds = [entry.ids, ...holeEntries.map(hole => hole.ids)].flat();
      for (const face of faces) {
        const a = capVertices.get(flattenedIds[face[0]]);
        const b = capVertices.get(flattenedIds[face[1]]);
        const c = capVertices.get(flattenedIds[face[2]]);
        if (!a || !b || !c) continue;
        const normal = new THREE.Vector3().subVectors(b.point, a.point).cross(new THREE.Vector3().subVectors(c.point, a.point));
        if (normal.dot(desiredNormal) >= 0) pushClipTriangle(buffers, a, b, c);
        else pushClipTriangle(buffers, a, c, b);
      }
    }
  };

  for (let i = 0; i < position.count; i += 3) {
    let polygon = [
      geometryClipVertex(position, uv, i),
      geometryClipVertex(position, uv, i + 1),
      geometryClipVertex(position, uv, i + 2)
    ];
    const clipped = [];
    for (let j = 0; j < polygon.length; j++) {
      const current = polygon[j];
      const next = polygon[(j + 1) % polygon.length];
      const currentInside = inside(current);
      const nextInside = inside(next);
      if (currentInside && nextInside) clipped.push(next);
      else if (currentInside && !nextInside) clipped.push(intersection(current, next));
      else if (!currentInside && nextInside) clipped.push(intersection(current, next), next);
    }
    polygon = clipped;
    if (polygon.length >= 3) {
      collectCapEdges(polygon);
      for (let j = 1; j < polygon.length - 1; j++) pushClipTriangle(buffers, polygon[0], polygon[j], polygon[j + 1]);
    }
  }
  const loopIds = buildCapLoops();
  if (cap) triangulateCapLoops(loopIds);
  const loopPoints = loopIds
    .map(ids => ids.map(id => capVertices.get(id)?.point?.clone()).filter(Boolean))
    .filter(loop => loop.length >= 3);

  source.dispose();
  const clippedGeometry = new THREE.BufferGeometry();
  clippedGeometry.setAttribute("position", new THREE.Float32BufferAttribute(buffers.positions, 3));
  if (buffers.hasUv && buffers.uvs.length / 2 === buffers.positions.length / 3) clippedGeometry.setAttribute("uv", new THREE.Float32BufferAttribute(buffers.uvs, 2));
  clippedGeometry.computeVertexNormals();
  clippedGeometry.computeBoundingBox();
  clippedGeometry.computeBoundingSphere();
  if (returnLoops) return { geometry: clippedGeometry, loops: loopPoints };
  return clippedGeometry;
}

function clipGeometrySide(geometry, side, value, axis = "y") {
  const source = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  source.computeBoundingBox();
  const index = axisIndex(axis);
  const min = component(source.boundingBox.min, index);
  const max = component(source.boundingBox.max, index);
  const span = max - min;
  const amount = cutDistance(value, span);
  if (span <= .0001 || amount <= .0001) return source;
  const plane = side === "top" ? max - amount : min + amount;
  const keepSide = side === "top" ? "negative" : "positive";
  const clipped = clipGeometryCoordinate(source, { axis, plane, keepSide });
  source.dispose();
  return clipped;
}

function applyGeometryCuts(geometry, spec = {}) {
  const cuts = cutSpecFromObject(spec);
  if (!cuts) return geometry;
  let result = geometry;
  if (cuts.top !== undefined) {
    const next = clipGeometrySide(result, "top", cuts.top);
    if (next !== result) result.dispose();
    result = next;
  }
  if (cuts.bottom !== undefined) {
    const next = clipGeometrySide(result, "bottom", cuts.bottom);
    if (next !== result) result.dispose();
    result = next;
  }
  return result;
}

function swapAttributeVertices(attribute, a, b) {
  if (!attribute) return;
  const itemSize = attribute.itemSize;
  const temp = [];
  for (let i = 0; i < itemSize; i++) temp[i] = attribute.getComponent(a, i);
  for (let i = 0; i < itemSize; i++) attribute.setComponent(a, i, attribute.getComponent(b, i));
  for (let i = 0; i < itemSize; i++) attribute.setComponent(b, i, temp[i]);
  attribute.needsUpdate = true;
}

function mirrorLocalPoint(point, axis, center) {
  const index = axisIndex(axis);
  const mirrored = point.clone();
  setComponent(mirrored, index, component(center, index) * 2 - component(point, index));
  return mirrored;
}

function mirrorLocalNormal(normal, axis) {
  const index = axisIndex(axis);
  const mirrored = normal.clone();
  setComponent(mirrored, index, -component(mirrored, index));
  return mirrored.normalize();
}

function mirrorMeshGeometry(mesh, axis) {
  const index = axisIndex(axis);
  const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  geometry.computeBoundingBox();
  const center = geometry.boundingBox.getCenter(new THREE.Vector3());
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const uv = geometry.getAttribute("uv");

  for (let i = 0; i < position.count; i++) {
    const value = position.getComponent(i, index);
    position.setComponent(i, index, component(center, index) * 2 - value);
  }
  position.needsUpdate = true;

  for (let i = 0; i < position.count; i += 3) {
    swapAttributeVertices(position, i + 1, i + 2);
    swapAttributeVertices(normal, i + 1, i + 2);
    swapAttributeVertices(uv, i + 1, i + 2);
  }

  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  mesh.geometry.dispose();
  mesh.geometry = geometry;
  mesh.userData.shape = "custom";
  mesh.userData.geometry = geometryToData(geometry);
  mesh.userData.bevel = null;
  mesh.userData.depth = null;
  mesh.userData.direction = null;

  for (const face of selectedFaces.filter(face => face.mesh === mesh)) {
    face.localTrianglePoints = face.localTrianglePoints.map(point => mirrorLocalPoint(point, axis, center));
    face.localNormal = mirrorLocalNormal(face.localNormal, axis);
    face.localPoint = triangleCenter(face.localTrianglePoints);
    face.point = face.localPoint.clone().applyMatrix4(mesh.matrixWorld);
    face.hitPoint = face.point.clone();
    face.trianglePoints = face.localTrianglePoints.map(point => point.clone().applyMatrix4(mesh.matrixWorld));
    face.normalWorld = face.localNormal.clone().transformDirection(mesh.matrixWorld).normalize();
  }

  for (const marker of markerHelpers.filter(marker => marker.userData.targetId === mesh.userData.id)) {
    marker.userData.localTriangle = marker.userData.localTriangle
      .map(point => mirrorLocalPoint(new THREE.Vector3(...point), axis, center).toArray().map(round));
    marker.userData.localNormal = mirrorLocalNormal(new THREE.Vector3(...marker.userData.localNormal), axis).toArray().map(round);
  }
}

function makeInsetBeveledPanelGeometry({ width = 1, height = 1, outerZ = 0, innerZ = -.16, bevel = .12, direction = "front" } = {}) {
  const hw = width / 2;
  const hh = height / 2;
  const iw = Math.max(.05, hw - bevel);
  const ih = Math.max(.05, hh - bevel);
  const sign = direction === "back" ? -1 : 1;
  const outer = outerZ * sign;
  const inner = innerZ * sign;
  const v = [
    [-hw, -hh, outer], [hw, -hh, outer], [hw, hh, outer], [-hw, hh, outer],
    [-iw, -ih, inner], [iw, -ih, inner], [iw, ih, inner], [-iw, ih, inner]
  ];
  const faces = [
    [0, 1, 5], [0, 5, 4],
    [1, 2, 6], [1, 6, 5],
    [2, 3, 7], [2, 7, 6],
    [3, 0, 4], [3, 4, 7],
    [4, 5, 6], [4, 6, 7]
  ];
  return {
    positions: faces.flatMap(face => face.flatMap(index => v[index]))
  };
}

function makeGeometryDataForShape(shape, scale = [1, 1, 1], action = {}) {
  shape = normalizeShapeName(shape);
  if (shape !== "beveledPanel") return action.geometry || null;
  return makeInsetBeveledPanelGeometry({
    width: Math.max(.1, scale[0] || 1),
    height: Math.max(.1, scale[1] || 1),
    bevel: Math.min(Math.max(.06, action.bevel ?? .16), Math.max(scale[0] || 1, scale[1] || 1) * .35),
    innerZ: action.depth ?? .18,
    direction: action.direction || "front"
  });
}

function createMesh(spec = {}) {
  let { id = null, shape = "box", geometry, name, position = [0, .5, 0], rotation = [0, 0, 0], scale = [1, 1, 1], color = "#40c7a5", roughness = .6, opacity = 1, textureUrl = null, textureName = null, textureRobloxAssetId = "", textureFlipY = true, textureRotation = 0, textureHasTransparency = false, roughnessTextureUrl = null, roughnessTextureName = null, metalnessTextureUrl = null, metalnessTextureName = null, emissiveTextureUrl = null, emissiveTextureName = null, materialRule = "auto", bevel = null, depth = null, direction = null, pivot = null, hidden = false, linkId = null, linkColor = null, groupId = null, groupName = null, playerAvatar = false, playerHeadOffset = null, liveMirror = null, lod = null, minecraft = null, edgeBevelProtectedEdges = [], dissolvedSurfaceEdges = [] } = spec;
  shape = normalizeShapeName(shape);
  const defaultOrdinal = idCounter;
  const preferredId = typeof id === "string" && id.trim() ? id.trim() : null;
  const objectId = preferredId || `obj-${idCounter++}`;
  const numericId = preferredId?.match(/^obj-(\d+)$/i);
  if (numericId) idCounter = Math.max(idCounter, Number(numericId[1]) + 1);
  const baseGeometry = geometry ? geometryFromData(geometry) : (shapeFactories[shape]?.() ?? shapeFactories.box());
  const meshGeometry = applyGeometryCuts(baseGeometry, spec);
  const cuts = cutSpecFromObject(spec);
  const normalizedMaterialRule = normalizeMaterialRule(materialRule);
  const mesh = new THREE.Mesh(meshGeometry, makeMaterial(color, roughness));
  mesh.material.vertexColors = !!meshGeometry.getAttribute("color");
  mesh.material.metalness = normalizedMaterialRule === "metal" ? .52 : .05;
  const materialOpacity = Math.max(.05, Math.min(1, Number(opacity) || 1));
  mesh.material.opacity = materialOpacity;
  mesh.material.transparent = materialOpacity < .999 || !!textureHasTransparency;
  mesh.material.depthWrite = materialOpacity >= .999;
  mesh.material.needsUpdate = true;
  mesh.name = name || `${shape} ${defaultOrdinal}`;
  mesh.userData = {
    id: objectId,
    shape,
    geometry: geometry || null,
    color,
    roughness,
    opacity: materialOpacity,
    textureUrl,
    textureName,
    textureRobloxAssetId: normalizeRobloxAssetId(textureRobloxAssetId || ""),
    textureFlipY,
    textureRotation: normalizeTextureRotation(textureRotation),
    textureHasTransparency: !!textureHasTransparency,
    roughnessTextureUrl,
    roughnessTextureName,
    metalnessTextureUrl,
    metalnessTextureName,
    emissiveTextureUrl,
    emissiveTextureName,
    materialRule: normalizedMaterialRule,
    pivot: Array.isArray(pivot) ? pivot.map(Number) : null,
    hidden: !!hidden,
    linkId: typeof linkId === "string" && linkId.trim() ? linkId.trim() : null,
    linkColor: typeof linkColor === "string" && linkColor.trim() ? linkColor.trim() : null,
    groupId: typeof groupId === "string" && groupId.trim() ? groupId.trim() : null,
    groupName: typeof groupName === "string" && groupName.trim() ? groupName.trim() : null,
    bevel,
    depth,
    direction,
    cuts,
    playerAvatar: !!playerAvatar,
    playerHeadOffset: Array.isArray(playerHeadOffset) ? playerHeadOffset.map(Number) : null,
    liveMirror: liveMirror?.enabled ? {
      enabled: true,
      axis: ["x", "y", "z"].includes(liveMirror.axis) ? liveMirror.axis : "x",
      plane: Number(liveMirror.plane) || 0
    } : null,
    lod: lod && Number.isInteger(Number(lod.level)) ? {
      setId: String(lod.setId || ""),
      level: Math.max(0, Number(lod.level) || 0),
      sourceId: String(lod.sourceId || objectId),
      sourceGroupId: typeof lod.sourceGroupId === "string" && lod.sourceGroupId.trim() ? lod.sourceGroupId.trim() : null,
      reduction: Math.max(0, Number(lod.reduction) || 0),
      triangleCount: Math.max(0, Number(lod.triangleCount) || 0),
      screenCoverage: Math.max(0, Math.min(1, Number(lod.screenCoverage) || 0))
    } : null,
    minecraft: minecraft && typeof minecraft === "object" ? JSON.parse(JSON.stringify(minecraft)) : null,
    edgeBevelProtectedEdges: Array.isArray(edgeBevelProtectedEdges) ? edgeBevelProtectedEdges.filter(value => typeof value === "string") : [],
    dissolvedSurfaceEdges: Array.isArray(dissolvedSurfaceEdges) ? dissolvedSurfaceEdges.filter(value => typeof value === "string") : []
  };
  mesh.position.fromArray(position);
  mesh.rotation.set(
    THREE.MathUtils.degToRad(rotation[0] || 0),
    THREE.MathUtils.degToRad(rotation[1] || 0),
    THREE.MathUtils.degToRad(rotation[2] || 0)
  );
  mesh.scale.fromArray(scale);
  mesh.visible = !hidden;
  mesh.castShadow = true;
  // Minecraft cuboids keep casting onto the floor, but disabling received
  // shadows prevents dense self-shadow acne and also survives project reloads.
  mesh.receiveShadow = !minecraft;
  if (textureUrl) {
    applyTextureToMesh(mesh, textureUrl, textureName || "Texture", textureFlipY, textureRotation);
  }
  if (roughnessTextureUrl) applyMaterialTextureChannel(mesh, "roughness", roughnessTextureUrl, roughnessTextureName);
  if (metalnessTextureUrl) applyMaterialTextureChannel(mesh, "metalness", metalnessTextureUrl, metalnessTextureName);
  if (emissiveTextureUrl) applyMaterialTextureChannel(mesh, "emissive", emissiveTextureUrl, emissiveTextureName);
  syncMeshRenderCulling(mesh);
  return mesh;
}

function addObject(spec = {}, { record = true, select = false, update = true } = {}) {
  if (record) recordHistory("add");
  const mesh = createMesh(spec);
  scene.add(mesh);
  objects.push(mesh);
  if (select) selectObject(mesh);
  if (update) updateAll();
  return mesh;
}
function reliefNumber(input, fallback, min, max) {
  const value = Number(input?.value);
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : fallback));
}

function sampleReliefPixel(imageData, width, height, x, y) {
  const px = Math.max(0, Math.min(width - 1, Math.round(x)));
  const py = Math.max(0, Math.min(height - 1, Math.round(y)));
  const i = (py * width + px) * 4;
  const r = imageData.data[i] || 0;
  const g = imageData.data[i + 1] || 0;
  const b = imageData.data[i + 2] || 0;
  const a = imageData.data[i + 3] ?? 255;
  const luma = r * .2126 + g * .7152 + b * .0722;
  return { r, g, b, a, luma };
}

function smoothReliefHeights(heights, mask, cols, rows, passes) {
  let current = heights.slice();
  for (let pass = 0; pass < passes; pass++) {
    const next = current.slice();
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const index = y * cols + x;
        if (!mask[index]) continue;
        let sum = current[index];
        let count = 1;
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            if (!ox && !oy) continue;
            const nx = x + ox;
            const ny = y + oy;
            if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
            const ni = ny * cols + nx;
            if (!mask[ni]) continue;
            sum += current[ni];
            count++;
          }
        }
        next[index] = sum / count;
      }
    }
    current = next;
  }
  return current;
}


function reliefForegroundCheck(pixel, threshold, darkForeground) {
  return pixel.a > 24 && (darkForeground ? pixel.luma <= threshold : pixel.luma >= threshold);
}

function detectReliefViewRects(imageData, threshold, darkForeground) {
  const { width, height, data } = imageData;
  const columnHits = new Array(width).fill(0);
  const rowHits = new Array(height).fill(0);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const a = data[i + 3] ?? 255;
      if (a <= 24) continue;
      const luma = data[i] * .2126 + data[i + 1] * .7152 + data[i + 2] * .0722;
      const hit = darkForeground ? luma <= threshold : luma >= threshold;
      if (!hit) continue;
      columnHits[x]++;
      rowHits[y]++;
    }
  }
  const minColumnHits = Math.max(2, Math.floor(height * .015));
  const rawRuns = [];
  let runStart = -1;
  for (let x = 0; x <= width; x++) {
    const active = x < width && columnHits[x] >= minColumnHits;
    if (active && runStart < 0) runStart = x;
    if ((!active || x === width) && runStart >= 0) {
      if (x - runStart >= Math.max(8, width * .025)) rawRuns.push({ x: runStart, right: x - 1 });
      runStart = -1;
    }
  }
  const mergedRuns = [];
  for (const run of rawRuns) {
    const prev = mergedRuns[mergedRuns.length - 1];
    if (prev && run.x - prev.right < width * .035) {
      prev.right = run.right;
    } else {
      mergedRuns.push({ ...run });
    }
  }
  const minRowHits = Math.max(2, Math.floor(width * .004));
  let top = 0;
  let bottom = height - 1;
  while (top < height - 1 && rowHits[top] < minRowHits) top++;
  while (bottom > top && rowHits[bottom] < minRowHits) bottom--;
  const padX = Math.max(2, Math.round(width * .01));
  const padY = Math.max(2, Math.round(height * .015));
  const runs = mergedRuns
    .map(run => ({
      x: Math.max(0, run.x - padX),
      y: Math.max(0, top - padY),
      w: Math.min(width - Math.max(0, run.x - padX), run.right - run.x + 1 + padX * 2),
      h: Math.min(height - Math.max(0, top - padY), bottom - top + 1 + padY * 2)
    }))
    .filter(rect => rect.w > 8 && rect.h > 8)
    .sort((a, b) => a.x - b.x);
  if (runs.length >= 3) return [runs[0], runs[Math.floor(runs.length / 2)], runs[runs.length - 1]];
  if (runs.length === 2) return [runs[0], runs[1], runs[0]];
  return [
    { x: 0, y: 0, w: Math.floor(width / 3), h: height },
    { x: Math.floor(width / 3), y: 0, w: Math.floor(width / 3), h: height },
    { x: Math.floor(width * 2 / 3), y: 0, w: width - Math.floor(width * 2 / 3), h: height }
  ];
}

function buildReliefViewProfile(imageData, rect, rows, threshold, darkForeground) {
  const profile = [];
  for (let y = 0; y < rows; y++) {
    const sy = rect.y + (y / Math.max(1, rows - 1)) * Math.max(1, rect.h - 1);
    let minX = Infinity;
    let maxX = -Infinity;
    let lumaSum = 0;
    let count = 0;
    const samples = Math.max(24, Math.min(180, Math.round(rect.w)));
    for (let x = 0; x < samples; x++) {
      const sx = rect.x + (x / Math.max(1, samples - 1)) * Math.max(1, rect.w - 1);
      const pixel = sampleReliefPixel(imageData, imageData.width, imageData.height, sx, sy);
      if (!reliefForegroundCheck(pixel, threshold, darkForeground)) continue;
      minX = Math.min(minX, x / Math.max(1, samples - 1));
      maxX = Math.max(maxX, x / Math.max(1, samples - 1));
      lumaSum += pixel.luma;
      count++;
    }
    if (!count) {
      profile.push({ active: false, center: .5, width: 0, luma: darkForeground ? 255 : 0 });
    } else {
      profile.push({
        active: true,
        center: (minX + maxX) * .5,
        width: Math.max(0, maxX - minX),
        luma: lumaSum / count
      });
    }
  }
  return profile;
}

function smoothReliefProfile(profile, passes) {
  let current = profile.map(row => ({ ...row }));
  for (let pass = 0; pass < passes; pass++) {
    current = current.map((row, index) => {
      let width = row.active ? row.width : 0;
      let center = row.active ? row.center : .5;
      let luma = row.luma;
      let count = row.active ? 1 : 0;
      for (const offset of [-1, 1]) {
        const other = current[index + offset];
        if (!other?.active) continue;
        width += other.width;
        center += other.center;
        luma += other.luma;
        count++;
      }
      if (!count) return { ...row, active: false };
      return { active: true, width: width / count, center: center / count, luma: luma / count };
    });
  }
  return current;
}

// A front/back reference sheet is often cropped tight against one extended
// arm, cutting the other arm off-frame entirely (confirmed on the sample
// T-pose sheet: the front and back panels each only contain one full arm).
// The carve above faithfully reconstructs only what the image shows, which
// then reconstructs as a lopsided half-body. Rather than requiring a manual
// mirror step afterward (the previous workflow), pick whichever half of the
// carved body reaches further from center — the side that was actually
// captured in frame — and mirror it across the center plane so the output
// is always one complete, symmetric body.
function mirrorReliefGeometryToSymmetricHalf(positions, uvs) {
  const vertexCount = Math.floor(positions.length / 3);
  let maxLeftReach = 0;
  let maxRightReach = 0;
  let leftVertexCount = 0;
  let rightVertexCount = 0;
  for (let i = 0; i < vertexCount; i++) {
    const x = positions[i * 3];
    if (x < -1e-4) {
      leftVertexCount++;
      maxLeftReach = Math.max(maxLeftReach, -x);
    } else if (x > 1e-4) {
      rightVertexCount++;
      maxRightReach = Math.max(maxRightReach, x);
    }
  }
  const keepRight = maxLeftReach !== maxRightReach ? maxRightReach > maxLeftReach : rightVertexCount >= leftVertexCount;

  const keptPositions = [];
  const keptUvs = [];
  const triangleCount = Math.floor(vertexCount / 3);
  for (let t = 0; t < triangleCount; t++) {
    const base = t * 9;
    const uvBase = t * 6;
    // Split by centroid, not "any vertex on this side" — the torso/leg rings
    // are already centered at x=0, so most of their triangles have at least
    // one vertex on each side. Filtering by "touches the kept side" kept
    // almost the whole body both times, and mirroring that duplicated the
    // entire figure into conjoined twins instead of completing one.
    const centroidX = (positions[base] + positions[base + 3] + positions[base + 6]) / 3;
    const belongsToKeptHalf = keepRight ? centroidX >= 0 : centroidX <= 0;
    if (!belongsToKeptHalf) continue;
    for (let k = 0; k < 9; k++) keptPositions.push(positions[base + k]);
    for (let k = 0; k < 6; k++) keptUvs.push(uvs[uvBase + k]);
  }

  const mirroredPositions = [];
  const mirroredUvs = [];
  const keptTriangleCount = Math.floor(keptPositions.length / 9);
  for (let t = 0; t < keptTriangleCount; t++) {
    const base = t * 9;
    const uvBase = t * 6;
    // Mirroring x flips triangle winding, so vertex order is reversed
    // (a, c, b instead of a, b, c) to keep outward-facing normals correct.
    mirroredPositions.push(
      -keptPositions[base], keptPositions[base + 1], keptPositions[base + 2],
      -keptPositions[base + 6], keptPositions[base + 7], keptPositions[base + 8],
      -keptPositions[base + 3], keptPositions[base + 4], keptPositions[base + 5]
    );
    mirroredUvs.push(
      keptUvs[uvBase], keptUvs[uvBase + 1],
      keptUvs[uvBase + 4], keptUvs[uvBase + 5],
      keptUvs[uvBase + 2], keptUvs[uvBase + 3]
    );
  }

  return {
    positions: [...keptPositions, ...mirroredPositions],
    uvs: [...keptUvs, ...mirroredUvs],
    keptSide: keepRight ? "right" : "left"
  };
}

function createReliefGeometryFromViewSheet({ imageData, cols, rows, scale, depth, back, threshold, smoothPasses, darkForeground }) {
  const viewRects = detectReliefViewRects(imageData, threshold, darkForeground);
  const [frontRect, sideRect, backRect] = viewRects;
  // Matches the single-view mode's input ceiling (reliefGridXInput/reliefGridYInput,
  // 8-160 / 8-220 in index.html) instead of an unrelated lower ceiling that used to
  // silently cap view-sheet detail well below what a caller could actually request.
  const gridX = Math.max(12, Math.min(160, Math.round(cols)));
  const gridY = Math.max(16, Math.min(220, Math.round(rows)));
  const gridZ = Math.max(10, Math.min(88, Math.round(gridX * .55)));
  const meshH = scale;
  const meshW = scale * .52;
  const meshD = Math.max(back, depth, .25) * 2.4;
  const frontMask = new Array(gridX * gridY).fill(false);
  const backMask = new Array(gridX * gridY).fill(false);
  const sideMask = new Array(gridZ * gridY).fill(false);
  const sampleRect = (rect, nx, ny) => {
    const sx = rect.x + Math.max(0, Math.min(1, nx)) * Math.max(1, rect.w - 1);
    const sy = rect.y + Math.max(0, Math.min(1, ny)) * Math.max(1, rect.h - 1);
    return sampleReliefPixel(imageData, imageData.width, imageData.height, sx, sy);
  };
  for (let y = 0; y < gridY; y++) {
    const ny = y / Math.max(1, gridY - 1);
    for (let x = 0; x < gridX; x++) {
      const nx = x / Math.max(1, gridX - 1);
      frontMask[y * gridX + x] = reliefForegroundCheck(sampleRect(frontRect, nx, ny), threshold, darkForeground);
      backMask[y * gridX + x] = reliefForegroundCheck(sampleRect(backRect, 1 - nx, ny), threshold, darkForeground);
    }
    for (let z = 0; z < gridZ; z++) {
      const nz = z / Math.max(1, gridZ - 1);
      sideMask[y * gridZ + z] = reliefForegroundCheck(sampleRect(sideRect, nz, ny), threshold, darkForeground);
    }
  }
  if (smoothPasses > 0) {
    const softenMask = (mask, w, h, passes) => {
      let current = mask.slice();
      for (let pass = 0; pass < passes; pass++) {
        const next = current.slice();
        for (let y = 1; y < h - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
            let hits = 0;
            for (let oy = -1; oy <= 1; oy++) {
              for (let ox = -1; ox <= 1; ox++) {
                if (current[(y + oy) * w + x + ox]) hits++;
              }
            }
            next[y * w + x] = hits >= 4;
          }
        }
        current = next;
      }
      return current;
    };
    const passes = Math.min(2, smoothPasses);
    for (const [target, softened] of [
      [frontMask, softenMask(frontMask, gridX, gridY, passes)],
      [backMask, softenMask(backMask, gridX, gridY, passes)],
      [sideMask, softenMask(sideMask, gridZ, gridY, passes)]
    ]) {
      for (let i = 0; i < target.length; i++) target[i] = softened[i];
    }
  }
  const occupied = new Uint8Array(gridX * gridY * gridZ);
  const voxelIndex = (x, y, z) => (y * gridZ + z) * gridX + x;
  const isVoxel = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < gridX && y < gridY && z < gridZ && occupied[voxelIndex(x, y, z)] === 1;
  const rowRuns = (mask, width, y) => {
    const runs = [];
    let start = -1;
    for (let x = 0; x <= width; x++) {
      const active = x < width && mask[y * width + x];
      if (active && start < 0) start = x;
      if ((!active || x === width) && start >= 0) {
        runs.push({ start, end: x - 1, center: (start + x) * .5, radius: Math.max(.5, (x - start) * .5) });
        start = -1;
      }
    }
    return runs;
  };
  const findRun = (runs, x) => runs.find(run => x >= run.start && x <= run.end) || null;
  const sideProfiles = [];
  const bodyRuns = [];
  for (let y = 0; y < gridY; y++) {
    const unionRow = new Array(gridX).fill(false);
    for (let x = 0; x < gridX; x++) unionRow[x] = frontMask[y * gridX + x] || backMask[y * gridX + x];
    const unionMask = new Array(gridX).fill(false);
    for (let x = 0; x < gridX; x++) unionMask[x] = unionRow[x];
    bodyRuns[y] = rowRuns(unionMask, gridX, 0);
    const sideRuns = rowRuns(sideMask, gridZ, y);
    const largestSide = sideRuns.sort((a, b) => (b.end - b.start) - (a.end - a.start))[0] || null;
    sideProfiles[y] = largestSide;
  }
  // `point()` below naively maps grid column gridX/2 to mesh-X 0. That only
  // lands on the body's true centerline if the detected view rect happens to
  // crop the figure symmetrically — false whenever the sheet is cropped tight
  // against one outstretched arm (confirmed on the sample T-pose sheet: the
  // torso sits near one edge of its panel, with the rest of the panel width
  // taken up by the extended arm). The leg rows aren't affected by that crop,
  // so they give a robust estimate of where the body actually is; take the
  // median across the leg region and use that as the center instead of
  // assuming gridX/2.
  //
  // A row's legs can appear as one merged run (feet together) or two
  // separate runs (feet apart, e.g. a normal standing pose) — using "the
  // widest run's own center" only handles the merged case; with two
  // separate runs it locks onto whichever leg happens to be marginally
  // wider that row instead of the true centerline, which doubled the head
  // and a leg when first tried on a standing-apart robot reference. Using
  // the midpoint between the outermost edges of ALL runs in the row handles
  // both cases: it reduces to a merged run's own center, and finds the true
  // gap-center between two separate legs.
  const legCenterSamples = [];
  for (let y = Math.floor(gridY * .55); y < Math.floor(gridY * .9); y++) {
    const runs = bodyRuns[y] || [];
    if (!runs.length) continue;
    const minStart = Math.min(...runs.map(run => run.start));
    const maxEnd = Math.max(...runs.map(run => run.end));
    legCenterSamples.push((minStart + maxEnd) / 2);
  }
  legCenterSamples.sort((a, b) => a - b);
  const bodyCenterGridX = legCenterSamples.length
    ? legCenterSamples[Math.floor(legCenterSamples.length / 2)]
    : gridX / 2;
  const centerFrac = bodyCenterGridX / gridX;
  let voxelCount = 0;
  for (let y = 0; y < gridY; y++) {
    const side = sideProfiles[y];
    if (!side) continue;
    for (let x = 0; x < gridX; x++) {
      const run = findRun(bodyRuns[y], x);
      if (!run) continue;
      const xCenter = x + .5;
      const xRound = Math.abs(xCenter - run.center) / Math.max(.5, run.radius);
      if (xRound > 1.08) continue;
      const zAllowance = Math.sqrt(Math.max(0, 1 - xRound * xRound)) * 1.08;
      for (let z = 0; z < gridZ; z++) {
        if (!sideMask[y * gridZ + z]) continue;
        const zCenter = z + .5;
        const zRound = Math.abs(zCenter - side.center) / Math.max(.5, side.radius);
        if (zRound > zAllowance) continue;
        occupied[voxelIndex(x, y, z)] = 1;
        voxelCount++;
      }
    }
  }
  const positions = [];
  const uvs = [];
  const point = (x, y, z) => [
    (x / gridX - centerFrac) * meshW,
    (.5 - y / gridY) * meshH,
    (z / gridZ - .5) * meshD
  ];
  const pushTri = (a, b, c) => {
    positions.push(...a.p, ...b.p, ...c.p);
    uvs.push(...a.uv, ...b.uv, ...c.uv);
  };
  const pushQuad = (a, b, c, d) => {
    pushTri(a, b, c);
    pushTri(a, c, d);
  };
  const detailStrength = Math.min(.22, Math.max(.04, depth * .12));
  const detailContrastStrength = detailStrength * 2.8;
  // Per-vertex surface detail (sampling the source image directly at each
  // subdivided vertex, with no spatial pre-filtering) was tried and measured:
  // rendering it with only the absolute-brightness term and only the local-
  // contrast term, in isolation, each independently reproduced the same
  // fuzzy/spiky surface — because at the resolutions this mode now supports,
  // a single-point sample lands inside the source photo's own per-pixel grain
  // (compression noise, dither, anti-aliasing), not real shading. The plain
  // voxel-carved surface (no displacement) was clean by comparison, so
  // detail stays off until this has a real box/gaussian pre-filter over the
  // sampled image rather than a handful of unblurred neighbor points.
  const detailAmountFor = () => 0;
  const displacePoint = (p, direction, amount) => [
    p[0] + direction[0] * amount,
    p[1] + direction[1] * amount,
    p[2] + direction[2] * amount
  ];
  const detailVertex = (x, y, z, u, vv, view, direction) => {
    const base = point(x, y, z);
    const amount = detailAmountFor(view, x, y, z);
    return { p: displacePoint(base, direction, amount), uv: [u, vv] };
  };
  const v = (x, y, z, u, vv, view = "none", direction = [0, 0, 0]) => {
    if (view !== "none") return detailVertex(x, y, z, u, vv, view, direction);
    return { p: point(x, y, z), uv: [u, vv] };
  };
  const polishLevel = Math.max(0, smoothPasses - 2);
  const maxPatchSpan = polishLevel > 0 ? Math.max(2, 8 - polishLevel) : Infinity;
  const mix = (a, b, t) => a + (b - a) * t;
  const mixArray = (a, b, t) => a.map((value, index) => mix(value, b[index], t));
  const mixVertex = (a, b, t) => ({ p: mixArray(a.p, b.p, t), uv: mixArray(a.uv, b.uv, t) });
  const patchVertex = (a, b, c, d, u, vv) => {
    const top = mixVertex(a, b, u);
    const bottom = mixVertex(d, c, u);
    return mixVertex(top, bottom, vv);
  };
  const pushQuadPatch = (a, b, c, d, stepsU = 1, stepsV = 1) => {
    const uSteps = Math.max(1, Math.round(stepsU));
    const vSteps = Math.max(1, Math.round(stepsV));
    if (uSteps === 1 && vSteps === 1) {
      pushQuad(a, b, c, d);
      return;
    }
    for (let py = 0; py < vSteps; py++) {
      const v0 = py / vSteps;
      const v1 = (py + 1) / vSteps;
      for (let px = 0; px < uSteps; px++) {
        const u0 = px / uSteps;
        const u1 = (px + 1) / uSteps;
        pushQuad(
          patchVertex(a, b, c, d, u0, v0),
          patchVertex(a, b, c, d, u1, v0),
          patchVertex(a, b, c, d, u1, v1),
          patchVertex(a, b, c, d, u0, v1)
        );
      }
    }
  };
  const relaxWeldedPositions = (iterations, strength) => {
    if (positions.length < 9 || iterations <= 0 || strength <= 0) return;
    const vertices = [];
    const faces = [];
    const keyToIndex = new Map();
    const getVertexIndex = offset => {
      const key = `${positions[offset].toFixed(5)},${positions[offset + 1].toFixed(5)},${positions[offset + 2].toFixed(5)}`;
      if (keyToIndex.has(key)) return keyToIndex.get(key);
      const index = vertices.length;
      keyToIndex.set(key, index);
      vertices.push([positions[offset], positions[offset + 1], positions[offset + 2]]);
      return index;
    };
    for (let i = 0; i < positions.length; i += 9) {
      faces.push([getVertexIndex(i), getVertexIndex(i + 3), getVertexIndex(i + 6)]);
    }
    const neighbors = vertices.map(() => new Set());
    for (const [a, b, c] of faces) {
      neighbors[a].add(b); neighbors[a].add(c);
      neighbors[b].add(a); neighbors[b].add(c);
      neighbors[c].add(a); neighbors[c].add(b);
    }
    let current = vertices.map(vertex => vertex.slice());
    for (let pass = 0; pass < iterations; pass++) {
      const next = current.map(vertex => vertex.slice());
      for (let i = 0; i < current.length; i++) {
        const list = [...neighbors[i]];
        if (!list.length) continue;
        const average = [0, 0, 0];
        for (const ni of list) {
          average[0] += current[ni][0];
          average[1] += current[ni][1];
          average[2] += current[ni][2];
        }
        average[0] /= list.length;
        average[1] /= list.length;
        average[2] /= list.length;
        next[i] = [
          mix(current[i][0], average[0], strength),
          mix(current[i][1], average[1], strength),
          mix(current[i][2], average[2], strength)
        ];
      }
      current = next;
    }
    for (let i = 0; i < positions.length; i += 3) {
      const key = `${positions[i].toFixed(5)},${positions[i + 1].toFixed(5)},${positions[i + 2].toFixed(5)}`;
      const vertex = current[keyToIndex.get(key)];
      if (!vertex) continue;
      positions[i] = vertex[0];
      positions[i + 1] = vertex[1];
      positions[i + 2] = vertex[2];
    }
  };
  const greedyPlane = (w, h, isFilled, pushRect) => {
    const used = new Uint8Array(w * h);
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        const start = yy * w + xx;
        if (used[start] || !isFilled(xx, yy)) continue;
        let rectW = 1;
        while (xx + rectW < w && !used[yy * w + xx + rectW] && isFilled(xx + rectW, yy)) rectW++;
        let rectH = 1;
        outer: while (yy + rectH < h) {
          for (let rx = 0; rx < rectW; rx++) {
            const index = (yy + rectH) * w + xx + rx;
            if (used[index] || !isFilled(xx + rx, yy + rectH)) break outer;
          }
          rectH++;
        }
        for (let ry = 0; ry < rectH; ry++) {
          for (let rx = 0; rx < rectW; rx++) used[(yy + ry) * w + xx + rx] = 1;
        }
        pushRect(xx, yy, rectW, rectH);
      }
    }
  };
  let mergedFaceCount = 0;
  for (let z = 0; z < gridZ; z++) {
    greedyPlane(gridX, gridY, (x, y) => isVoxel(x, y, z) && !isVoxel(x, y, z - 1), (x, y, w, h) => {
      mergedFaceCount++;
      pushQuadPatch(v(x, y, z, x / gridX, 1 - y / gridY, "front", [0, 0, -1]), v(x + w, y, z, (x + w) / gridX, 1 - y / gridY, "front", [0, 0, -1]), v(x + w, y + h, z, (x + w) / gridX, 1 - (y + h) / gridY, "front", [0, 0, -1]), v(x, y + h, z, x / gridX, 1 - (y + h) / gridY, "front", [0, 0, -1]), Math.ceil(w / maxPatchSpan), Math.ceil(h / maxPatchSpan));
    });
    greedyPlane(gridX, gridY, (x, y) => isVoxel(x, y, z) && !isVoxel(x, y, z + 1), (x, y, w, h) => {
      mergedFaceCount++;
      pushQuadPatch(v(x, y, z + 1, x / gridX, 1 - y / gridY, "back", [0, 0, 1]), v(x, y + h, z + 1, x / gridX, 1 - (y + h) / gridY, "back", [0, 0, 1]), v(x + w, y + h, z + 1, (x + w) / gridX, 1 - (y + h) / gridY, "back", [0, 0, 1]), v(x + w, y, z + 1, (x + w) / gridX, 1 - y / gridY, "back", [0, 0, 1]), Math.ceil(h / maxPatchSpan), Math.ceil(w / maxPatchSpan));
    });
  }
  for (let x = 0; x < gridX; x++) {
    greedyPlane(gridZ, gridY, (z, y) => isVoxel(x, y, z) && !isVoxel(x - 1, y, z), (z, y, w, h) => {
      mergedFaceCount++;
      pushQuadPatch(v(x, y, z, z / gridZ, 1 - y / gridY, "side", [-1, 0, 0]), v(x, y + h, z, z / gridZ, 1 - (y + h) / gridY, "side", [-1, 0, 0]), v(x, y + h, z + w, (z + w) / gridZ, 1 - (y + h) / gridY, "side", [-1, 0, 0]), v(x, y, z + w, (z + w) / gridZ, 1 - y / gridY, "side", [-1, 0, 0]), Math.ceil(h / maxPatchSpan), Math.ceil(w / maxPatchSpan));
    });
    greedyPlane(gridZ, gridY, (z, y) => isVoxel(x, y, z) && !isVoxel(x + 1, y, z), (z, y, w, h) => {
      mergedFaceCount++;
      pushQuadPatch(v(x + 1, y, z, z / gridZ, 1 - y / gridY, "side", [1, 0, 0]), v(x + 1, y, z + w, (z + w) / gridZ, 1 - y / gridY, "side", [1, 0, 0]), v(x + 1, y + h, z + w, (z + w) / gridZ, 1 - (y + h) / gridY, "side", [1, 0, 0]), v(x + 1, y + h, z, z / gridZ, 1 - (y + h) / gridY, "side", [1, 0, 0]), Math.ceil(w / maxPatchSpan), Math.ceil(h / maxPatchSpan));
    });
  }
  for (let y = 0; y < gridY; y++) {
    greedyPlane(gridX, gridZ, (x, z) => isVoxel(x, y, z) && !isVoxel(x, y - 1, z), (x, z, w, h) => {
      mergedFaceCount++;
      pushQuadPatch(v(x, y, z, x / gridX, z / gridZ), v(x, y, z + h, x / gridX, (z + h) / gridZ), v(x + w, y, z + h, (x + w) / gridX, (z + h) / gridZ), v(x + w, y, z, (x + w) / gridX, z / gridZ), Math.ceil(h / maxPatchSpan), Math.ceil(w / maxPatchSpan));
    });
    greedyPlane(gridX, gridZ, (x, z) => isVoxel(x, y, z) && !isVoxel(x, y + 1, z), (x, z, w, h) => {
      mergedFaceCount++;
      pushQuadPatch(v(x, y + 1, z, x / gridX, z / gridZ), v(x + w, y + 1, z, (x + w) / gridX, z / gridZ), v(x + w, y + 1, z + h, (x + w) / gridX, (z + h) / gridZ), v(x, y + 1, z + h, x / gridX, (z + h) / gridZ), Math.ceil(w / maxPatchSpan), Math.ceil(h / maxPatchSpan));
    });
  }
  if (polishLevel > 0) relaxWeldedPositions(Math.min(4, polishLevel), .12);
  if (positions.length < 9) throw new Error("No sheet foreground was found. Try Threshold or Dark foreground.");
  const symmetric = mirrorReliefGeometryToSymmetricHalf(positions, uvs);
  return {
    positions: symmetric.positions,
    uvs: symmetric.uvs,
    meta: {
      mode: "viewSheetOvalHullDetailPolished", cols: gridX, rows: gridY, depthSlices: gridZ, sourceW: imageData.width, sourceH: imageData.height,
      threshold, darkForeground, smoothPasses, polishLevel, depth, back, voxelCount, mergedFaceCount, detailStrength, detailContrastStrength, viewRects,
      mirroredFromSide: symmetric.keptSide
    }
  };
}

function buildReliefGeometry({ imageData, cols, rows, scale, depth, back, threshold, smoothPasses, detailStrength = 1, darkForeground, sourceMode = "single", buildMode = "standard", sourceName = "reference image" }) {
  if (!imageData) throw new Error("No source image data was provided.");
  const sourceW = imageData.width;
  const sourceH = imageData.height;
  if (sourceMode === "sheet") {
    const detailed = buildMode === "solidVisualHull";
    const recoveredV30 = buildMode === "recoveredV30";
    const hybridV46 = buildMode === "hybridV46";
    const hybridV47 = buildMode === "hybridV47";
    return createDetailedImageMeshGeometry({
      imageData,
      cols: detailed || recoveredV30 || hybridV46 || hybridV47 ? cols : Math.min(cols, 84),
      rows: detailed || recoveredV30 || hybridV46 || hybridV47 ? rows : Math.min(rows, 144),
      scale, depth, back, threshold, smoothPasses, detailStrength: detailed || recoveredV30 || hybridV46 || hybridV47 ? detailStrength : detailStrength * .5, darkForeground,
      sourceMode: "sheet", buildMode: hybridV47 ? "hybridV47" : (hybridV46 ? "hybridV46" : (recoveredV30 ? "recoveredV30" : "solidVisualHull")), sourceName
    });
  }
  const aspect = sourceW / Math.max(1, sourceH);
  const meshH = scale;
  const meshW = scale * aspect;
  const mask = new Array(cols * rows).fill(false);
  const heights = new Array(cols * rows).fill(0);

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const sx = (x / Math.max(1, cols - 1)) * (sourceW - 1);
      const sy = (y / Math.max(1, rows - 1)) * (sourceH - 1);
      const pixel = sampleReliefPixel(imageData, sourceW, sourceH, sx, sy);
      const inForeground = pixel.a > 24 && (darkForeground ? pixel.luma <= threshold : pixel.luma >= threshold);
      const index = y * cols + x;
      mask[index] = inForeground;
      const normalized = darkForeground
        ? Math.max(0, Math.min(1, (threshold - pixel.luma) / Math.max(1, threshold)))
        : Math.max(0, Math.min(1, (pixel.luma - threshold) / Math.max(1, 255 - threshold)));
      heights[index] = Math.pow(normalized, .75) * depth;
    }
  }
  const smoothHeights = smoothReliefHeights(heights, mask, cols, rows, smoothPasses);
  const positions = [];
  const uvs = [];
  const point = (x, y, z) => [
    (x / Math.max(1, cols - 1) - .5) * meshW,
    (.5 - y / Math.max(1, rows - 1)) * meshH,
    z
  ];
  const uv = (x, y) => [x / Math.max(1, cols - 1), 1 - y / Math.max(1, rows - 1)];
  const pushTri = (a, b, c) => {
    positions.push(...a.p, ...b.p, ...c.p);
    uvs.push(...a.uv, ...b.uv, ...c.uv);
  };
  const pushQuad = (a, b, c, d) => {
    pushTri(a, b, c);
    pushTri(a, c, d);
  };
  const frontVertex = (x, y) => ({ p: point(x, y, smoothHeights[y * cols + x]), uv: uv(x, y) });
  const backVertex = (x, y) => ({ p: point(x, y, -back), uv: uv(x, y) });
  const isValid = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows && mask[y * cols + x];

  for (let y = 0; y < rows - 1; y++) {
    for (let x = 0; x < cols - 1; x++) {
      if (!(isValid(x, y) && isValid(x + 1, y) && isValid(x + 1, y + 1) && isValid(x, y + 1))) continue;
      const a = frontVertex(x, y), b = frontVertex(x + 1, y), c = frontVertex(x + 1, y + 1), d = frontVertex(x, y + 1);
      pushQuad(a, d, c, b);
      if (back > 0) {
        const ba = backVertex(x, y), bb = backVertex(x + 1, y), bc = backVertex(x + 1, y + 1), bd = backVertex(x, y + 1);
        pushQuad(ba, bb, bc, bd);
      }
    }
  }
  if (back > 0) {
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (!isValid(x, y)) continue;
        if (!isValid(x, y - 1) && isValid(x + 1, y)) pushQuad(frontVertex(x, y), frontVertex(x + 1, y), backVertex(x + 1, y), backVertex(x, y));
        if (!isValid(x + 1, y) && isValid(x, y + 1)) pushQuad(frontVertex(x, y), backVertex(x, y), backVertex(x, y + 1), frontVertex(x, y + 1));
        if (!isValid(x, y + 1) && isValid(x + 1, y)) pushQuad(frontVertex(x, y), backVertex(x, y), backVertex(x + 1, y), frontVertex(x + 1, y));
        if (!isValid(x - 1, y) && isValid(x, y + 1)) pushQuad(frontVertex(x, y), frontVertex(x, y + 1), backVertex(x, y + 1), backVertex(x, y));
      }
    }
  }
  if (positions.length < 9) throw new Error("No foreground mesh was found. Try lowering/raising Threshold or toggling Dark foreground.");
  return {
    positions,
    uvs,
    meta: { mode: "single", cols, rows, sourceW, sourceH, threshold, darkForeground, smoothPasses, depth, back }
  };
}

function createReliefGeometryFromImage() {
  const imageData = reliefImageState.imageData;
  const image = reliefImageState.image;
  if (!imageData || !image) throw new Error("Load an image first.");
  const cols = Math.max(8, Math.round(reliefNumber(els.reliefGridXInput, 56, 8, 160)));
  const rows = Math.max(8, Math.round(reliefNumber(els.reliefGridYInput, 96, 8, 220)));
  const scale = reliefNumber(els.reliefScaleInput, 6, .5, 20);
  const depth = reliefNumber(els.reliefDepthInput, .9, 0, 5);
  const back = reliefNumber(els.reliefBackInput, .22, 0, 3);
  const threshold = reliefNumber(els.reliefThresholdInput, 70, 0, 255);
  const smoothPasses = 4;
  const detailStrength = reliefNumber(els.reliefDetailInput, 100, 0, 200) / 100;
  const darkForeground = !!els.reliefDarkForegroundInput?.checked;
  const sourceMode = els.reliefSourceModeInput?.value === "sheet" ? "sheet" : "single";
  const selectedBuildMode = els.reliefBuildModeInput?.value;
  const buildMode = ["standard", "solidVisualHull", "recoveredV30"].includes(selectedBuildMode) ? selectedBuildMode : "hybridV47";
  return buildReliefGeometry({
    imageData, cols, rows, scale, depth, back, threshold, smoothPasses, detailStrength, darkForeground,
    sourceMode, buildMode, sourceName: reliefImageState.name
  });
}

// Shared by the "Load image" UI panel and the MCP referenceMatch.createMesh
// bridge command, so there is exactly one place that turns image bytes into
// the ImageData the relief builders consume.
async function decodeImageDataUrl(dataUrl) {
  const image = await loadImage(dataUrl);
  const canvas = readImageToCanvas(image);
  const imageData = canvas.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, canvas.width, canvas.height);
  return { image, canvas, imageData };
}

async function loadReliefImageFile(file) {
  if (!file) return;
  const dataUrl = await readFileAsDataUrl(file);
  const { image, canvas, imageData } = await decodeImageDataUrl(dataUrl);
  reliefImageState.dataUrl = dataUrl;
  reliefImageState.name = file.name || "reference image";
  reliefImageState.image = image;
  reliefImageState.canvas = canvas;
  reliefImageState.imageData = imageData;
  if (els.reliefImageName) els.reliefImageName.textContent = `${reliefImageState.name} (${canvas.width}x${canvas.height})`;
  log(`Loaded relief source image: ${reliefImageState.name} (${canvas.width} x ${canvas.height}).`);
}

function createReliefMeshFromLoadedImage() {
  try {
    recordHistory("image relief mesh");
    const { positions, uvs, meta } = createReliefGeometryFromImage();
    const baseName = reliefImageState.name.replace(/\.[^.]+$/, "") || "image relief";
    const mesh = addObject({
      shape: "imageRelief",
      name: `${baseName} relief mesh`,
      geometry: { positions, uvs },
      color: meta.recoveredV30 || meta.hybridV46 || meta.hybridV47 ? "#f2f4f1" : "#d8d8d8",
      roughness: meta.recoveredV30 || meta.hybridV46 || meta.hybridV47 ? .72 : .48,
      position: [0, 0, 0]
    }, { record: false });
    if ((meta.recoveredV30 || meta.hybridV46 || meta.hybridV47) && mesh?.geometry) {
      mesh.geometry = mergeVertices(mesh.geometry, 1e-4);
      mesh.geometry.computeVertexNormals();
      mesh.geometry.computeBoundingSphere();
      mesh.material.side = THREE.DoubleSide;
      mesh.material.metalness = 0;
      mesh.material.needsUpdate = true;
    }
    mesh.userData.reliefSource = { ...meta, sourceName: reliefImageState.name };
    frameSelected();
    log(`Created image mesh from ${reliefImageState.name}: ${positions.length / 9} triangles, grid ${meta.cols} x ${meta.rows}.`);
  } catch (error) {
    log(`Relief mesh failed: ${error.message}`);
    alert(error.message);
  }
}

function addProceduralAssembly(kind, options = {}, { record = true, offset = [0, 0, 0], prefix = "" } = {}) {
  const assembly = buildProceduralAssembly(kind, options);
  if (!assembly?.objects?.length) return null;
  if (record) recordHistory("add");
  const [ox = 0, oy = 0, oz = 0] = offset || [0, 0, 0];
  const created = [];
  for (const spec of assembly.objects) {
    const position = Array.isArray(spec.position) ? spec.position : [0, 0, 0];
    created.push(addObject({
      ...spec,
      name: prefix ? `${prefix}${spec.name}` : spec.name,
      position: [
        round((position[0] || 0) + ox),
        round((position[1] || 0) + oy),
        round((position[2] || 0) + oz)
      ]
    }, { record: false }));
  }
  if (created.length) selectObject(created[created.length - 1]);
  log(`Added procedural assembly ${assembly.kind} with ${created.length} parts.`);
  return {
    kind: assembly.kind,
    summary: assembly.summary,
    count: created.length,
    ids: created.map(mesh => mesh.userData.id),
    names: created.map(mesh => mesh.name)
  };
}

function updateTransformAttachment() {
  transform.detach();
  transform.visible = false;
  finishScaleDragSession();
  const transformTargets = transformTargetObjects();
  const pivotTargets = pivotManagedObjects();
  if (pivotEditMode && !pivotTargets.length) {
    pivotEditMode = false;
    els.pivotBtn.classList.remove("active");
  }
  if (pivotTargets.length && (pivotEditMode || transformTargets.length > 1 || (selected && activeTransformMode === "rotate" && Array.isArray(selected.userData?.pivot) && selected.userData.pivot.length === 3))) {
    syncGroupPivotToObjects(pivotTargets);
    if (!activeTransformMode && !pivotEditMode) return;
    transform.setMode(pivotEditMode ? "translate" : activeTransformMode);
    transform.setSpace(pivotEditMode ? "world" : (activeTransformMode === "rotate" ? "local" : "world"));
    transform.attach(groupPivot);
    transform.visible = true;
    return;
  }
  currentTransformTargetKey = "";
  if (pivotEditMode) return;
  if (!activeTransformMode) return;
  if (selected) {
    transform.attach(selected);
    transform.visible = true;
  }
}

function setTransformMode(mode) {
  const nextMode = activeTransformMode === mode ? null : mode;
  if (pivotEditMode) setPivotEditMode(false, { silent: true });
  if (nextMode && dragPushMode) setDragPushMode(false, { silent: true });
  if (nextMode) {
    setFacePickMode(false);
    setCoplanarFacePickMode(false, { activatePicker: false });
    setOpeningPickMode(false);
    setLineSketchMode(false);
    els.paintTriInput.checked = false;
    els.areaTriInput.checked = false;
    clearSelectedTriangles();
    updateTriangleHelpers();
  }
  finishScaleDragSession();
  activeTransformMode = nextMode;
  document.querySelectorAll("[data-mode]").forEach(btn => btn.classList.toggle("active", activeTransformMode === btn.dataset.mode));
  if (activeTransformMode) {
    transform.setMode(activeTransformMode);
    transform.setSpace(activeTransformMode === "rotate" ? "local" : "world");
  }
  updateTransformAttachment();
  els.hudText.textContent = activeTransformMode
    ? `${activeTransformMode[0].toUpperCase()}${activeTransformMode.slice(1)} gizmo active | Click ${activeTransformMode} again to turn it off`
    : "Orbit: drag | Select: click | Multi-select: Shift/Ctrl+click | Transform tools: toggle Move/Rotate/Scale";
}

function setDragPushMode(enabled, { silent = false } = {}) {
  finishDragPushSession();
  dragPushMode = !!enabled;
  els.dragPushBtn?.classList.toggle("active", dragPushMode);
  if (dragPushMode) {
    if (activeTransformMode) setTransformMode(activeTransformMode);
    setFacePickMode(true);
    els.hudText.textContent = `Surface mouse mode: ${surfaceAxisMode() === "free" ? "drag the X/Y/Z arrows" : `drag the locked ${surfaceAxisMode().toUpperCase()} arrow or the selected face left/right`} in snapped ${Number(els.dragPushStepInput?.value || .01)} steps`;
  } else {
    els.hudText.textContent = facePickMode
      ? "Triangle cursor: click a mesh triangle, double-click connected, then use Marker, Extend, Pull, Push, or Bevel Face"
      : "Orbit: drag | Select: click | Multi-select: Shift/Ctrl+click | Transform tools: toggle Move/Rotate/Scale";
  }
  updateSurfaceGizmoAttachment();
  if (!silent) log(dragPushMode ? "Drag/Push mode enabled." : "Drag/Push mode disabled.");
}

function surfaceInteractionMode() {
  const mode = els.surfaceEditorWindow?.dataset.interactionMode;
  if (mode === "value" || mode === "mouse") return mode;
  return "off";
}

function surfaceComponentSelectionCount() {
  if (surfaceComponentMode === "vertex") return selectedSurfaceVertices.length;
  if (surfaceComponentMode === "edge") return selectedSurfaceEdges.length;
  if (surfaceComponentMode === "none") return 0;
  return selectedFaces.length;
}

function surfaceAxisMode() {
  const axis = String(els.dragPushAxisSelect?.value || "free").toLowerCase();
  return ["x", "y", "z"].includes(axis) ? axis : "free";
}

function syncSurfaceAxisUi() {
  if (!els.dragPushAxisSelect) return;
  els.dragPushAxisSelect.dataset.axis = surfaceAxisMode();
}

function syncSurfaceEditorUi() {
  const mode = surfaceInteractionMode();
  const selectedCount = surfaceComponentSelectionCount();
  const componentOnlyMode = surfaceComponentMode === "vertex" || surfaceComponentMode === "edge";
  els.surfaceMouseModeBtn?.classList.toggle("active", mode === "mouse");
  els.surfaceValueModeBtn?.classList.toggle("active", mode === "value");
  if (els.surfaceValueModeBtn) els.surfaceValueModeBtn.disabled = componentOnlyMode;
  els.surfaceSelectVertexBtn?.classList.toggle("active", surfaceSelectionSource === "surface" && facePickMode && surfaceComponentMode === "vertex");
  els.surfaceSelectEdgeBtn?.classList.toggle("active", surfaceSelectionSource === "surface" && facePickMode && surfaceComponentMode === "edge");
  els.surfaceSelectTriangleBtn?.classList.toggle("active", surfaceSelectionSource === "surface" && facePickMode && surfaceComponentMode === "triangle");
  els.surfaceSelectFaceBtn?.classList.toggle("active", surfaceSelectionSource === "surface" && facePickMode && surfaceComponentMode === "face");
  if (els.deleteSelectedSurfaceBtn) {
    const canDeleteSelectedFace = (surfaceComponentMode === "triangle" || surfaceComponentMode === "face") && selectedFaces.length > 0;
    els.deleteSelectedSurfaceBtn.disabled = !canDeleteSelectedFace;
    els.deleteSelectedSurfaceBtn.title = canDeleteSelectedFace
      ? `Delete ${selectedFaces.length} selected surface triangle${selectedFaces.length === 1 ? "" : "s"} without deleting the model`
      : "Select a Triangle or Whole Face to delete it without deleting the model";
  }
  const canEditSelectedUv = (surfaceComponentMode === "triangle" || surfaceComponentMode === "face") && selectedFaces.length > 0;
  for (const button of [els.rotateSelectedUvLeftBtn, els.rotateSelectedUvRightBtn, els.flipSelectedUvUBtn, els.flipSelectedUvVBtn]) {
    if (button) button.disabled = !canEditSelectedUv;
  }
  els.surfaceEditorOpenBtn?.classList.remove("active");
  els.knifeCutModeBtn?.classList.toggle("active", knifeCutMode);
  if (els.knifeCutCancelBtn) els.knifeCutCancelBtn.disabled = knifeCutPoints.length === 0;
  if (els.planeCutCapInput) els.planeCutCapInput.disabled = els.planeCutResultSelect?.value === "both";
  if (els.dissolveSelectedBtn) {
    els.dissolveSelectedBtn.disabled = !(
      (surfaceComponentMode === "edge" && selectedSurfaceEdges.length === 1)
      || (surfaceComponentMode === "vertex" && selectedSurfaceVertices.length === 1)
    );
  }
  if (els.bridgeEdgeLoopsBtn) {
    els.bridgeEdgeLoopsBtn.disabled = !(surfaceComponentMode === "edge" && selectedSurfaceEdges.length >= 2);
  }
  const minecraftCornerBevel = els.cornerBevelModeSelect?.value === "minecraft";
  if (els.cornerBevelWidthLabel) els.cornerBevelWidthLabel.hidden = minecraftCornerBevel;
  if (els.cornerBevelDragLabel) els.cornerBevelDragLabel.hidden = minecraftCornerBevel;
  if (els.cornerBevelPixelsLabel) els.cornerBevelPixelsLabel.hidden = !minecraftCornerBevel;
  if (els.cornerBevelBtn) {
    const canBevelCorner = surfaceComponentMode === "vertex" && selectedSurfaceVertices.length === 1;
    els.cornerBevelBtn.disabled = !canBevelCorner;
    els.cornerBevelBtn.title = canBevelCorner
      ? (minecraftCornerBevel
        ? "Remove stepped voxels from this corner on a 16 by 16 by 16 grid"
        : "Chamfer all three edges meeting at this corner")
      : "Choose Vertex and select exactly one corner first";
  }
  syncHoleRepairUi();
  syncSurfaceAxisUi();
  syncUvUnwrapUi();
  if (els.surfaceEditorSelection) {
    if (surfaceComponentMode === "none") {
      els.surfaceEditorSelection.textContent = "Choose a surface selection mode";
      return;
    }
    const componentLabel = surfaceComponentMode === "vertex"
      ? (selectedCount === 1 ? "vertex" : "vertices")
      : `${surfaceComponentMode}${selectedCount === 1 ? "" : "s"}`;
    const article = surfaceComponentMode === "edge" ? "an" : "a";
    els.surfaceEditorSelection.textContent = selectedCount
      ? `${selectedCount} selected ${componentLabel}`
      : `Select ${article} ${surfaceComponentMode} to begin`;
  }
}

function setSurfaceEditorOpen(open = true) {
  if (!els.surfaceEditorWindow) return;
  setSectionCollapsed(els.surfaceEditorWindow, els.surfaceEditorCloseBtn, !open);
  syncSurfaceEditorUi();
  updateSurfaceGizmoAttachment();
  updateModelingEdgesOverlay();
  if (open) requestAnimationFrame(() => els.surfaceEditorWindow.scrollIntoView({ behavior: "smooth", block: "start" }));
}

function setSurfaceInteractionMode(mode = "mouse") {
  const normalized = mode === "value" ? "value" : mode === "mouse" ? "mouse" : "off";
  els.surfaceEditorWindow.dataset.interactionMode = normalized;
  if (normalized !== "mouse" && dragPushMode) setDragPushMode(false, { silent: true });
  if (normalized === "mouse" && surfaceComponentSelectionCount() && els.autoSurfaceDragInput?.checked) setDragPushMode(true, { silent: true });
  syncSurfaceEditorUi();
  updateSurfaceGizmoAttachment();
  log(normalized === "off"
    ? "Surface Edit input released."
    : `Surface Edit input set to ${normalized === "mouse" ? "Mouse Drag" : "Exact Value"}.`);
}

function toggleSurfaceMouseMode() {
  if (surfaceInteractionMode() === "mouse") {
    if (els.surfaceEditorWindow) els.surfaceEditorWindow.dataset.interactionMode = "off";
    if (dragPushMode) setDragPushMode(false, { silent: true });
    syncSurfaceEditorUi();
    els.surfaceMouseModeBtn?.blur();
    els.hudText.textContent = "Mouse Drag released. Triangle and Whole Face selection remain available.";
    log("Surface Mouse Drag released.");
    return false;
  }
  if (els.surfaceEditorWindow) els.surfaceEditorWindow.dataset.interactionMode = "mouse";
  if (surfaceComponentSelectionCount()) setDragPushMode(true, { silent: true });
  else syncSurfaceEditorUi();
  els.surfaceMouseModeBtn?.blur();
  log("Surface Mouse Drag enabled.");
  return true;
}

function toggleSurfaceValueMode() {
  if (surfaceInteractionMode() === "value") {
    setSurfaceInteractionMode("off");
    els.surfaceValueModeBtn?.blur();
    return false;
  }
  setSurfaceInteractionMode("value");
  els.surfaceValueModeBtn?.blur();
  return true;
}

function setSurfaceSelectionMode(mode = "face") {
  if (knifeCutMode) setKnifeCutMode(false);
  const normalized = ["vertex", "edge", "triangle", "face"].includes(mode) ? mode : "face";
  const releasingActiveMode = surfaceSelectionSource === "surface" && surfaceComponentMode === normalized;
  if (releasingActiveMode) {
    clearSelectedTriangles();
    surfaceComponentMode = "none";
    surfaceSelectionSource = "none";
    coplanarFacePickMode = false;
    setFacePickMode(false);
    updateState();
    syncSurfaceEditorUi();
    log("Surface selection mode released.");
    return false;
  }
  const wholeFace = normalized === "face";
  clearSelectedTriangles();
  surfaceComponentMode = normalized;
  surfaceSelectionSource = "surface";
  if (normalized === "vertex" || normalized === "edge") {
    if (surfaceInteractionMode() === "value") setSurfaceInteractionMode("off");
    els.paintTriInput.checked = false;
    els.areaTriInput.checked = false;
  }
  updateState();
  setCoplanarFacePickMode(wholeFace, { activatePicker: true });
  if (!wholeFace) setFacePickMode(true);
  setSurfaceEditorOpen(true);
  syncSurfaceEditorUi();
  log(`Surface selection set to ${normalized === "face" ? "Whole Face" : normalized[0].toUpperCase() + normalized.slice(1)}.`);
  return true;
}

function releaseSurfaceInteractionForClassicSelection() {
  if (els.surfaceEditorWindow) els.surfaceEditorWindow.dataset.interactionMode = "off";
  if (dragPushMode) setDragPushMode(false, { silent: true });
  updateSurfaceGizmoAttachment();
}

function toggleClassicTriangleSelection() {
  if (knifeCutMode) setKnifeCutMode(false);
  const releasing = surfaceSelectionSource === "classic"
    && facePickMode
    && surfaceComponentMode === "triangle"
    && !coplanarFacePickMode;
  releaseSurfaceInteractionForClassicSelection();
  if (releasing) {
    surfaceComponentMode = "none";
    surfaceSelectionSource = "none";
    coplanarFacePickMode = false;
    setFacePickMode(false);
    return false;
  }
  clearSelectedSurfaceComponents();
  surfaceComponentMode = "triangle";
  surfaceSelectionSource = "classic";
  coplanarFacePickMode = false;
  els.paintTriInput.checked = false;
  els.areaTriInput.checked = false;
  setFacePickMode(true);
  log("Classic Select Tri enabled. Surface movement and axis locks are released.");
  return true;
}

function toggleClassicFaceSelection() {
  if (knifeCutMode) setKnifeCutMode(false);
  const releasing = surfaceSelectionSource === "classic"
    && facePickMode
    && surfaceComponentMode === "face"
    && coplanarFacePickMode;
  releaseSurfaceInteractionForClassicSelection();
  if (releasing) {
    surfaceComponentMode = "none";
    surfaceSelectionSource = "none";
    coplanarFacePickMode = false;
    setFacePickMode(false);
    return false;
  }
  clearSelectedSurfaceComponents();
  surfaceComponentMode = "face";
  surfaceSelectionSource = "classic";
  setCoplanarFacePickMode(true, { activatePicker: true });
  log("Classic Select Face enabled. Surface movement and axis locks are released.");
  return true;
}

function selectedSurfaceWorldCenter() {
  const points = surfaceComponentMode === "vertex"
    ? selectedSurfaceVertices.map(vertex => vertex.localPoint.clone().applyMatrix4(vertex.mesh.matrixWorld))
    : surfaceComponentMode === "edge"
      ? selectedSurfaceEdges.map(edge => edge.localA.clone().add(edge.localB).multiplyScalar(.5).applyMatrix4(edge.mesh.matrixWorld))
      : selectedFaces.map(face => worldFacePoint(face));
  if (!points.length) return null;
  return points.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / points.length);
}

function surfaceAxisWorldDirection(axisMode = surfaceAxisMode()) {
  if (axisMode === "x") return new THREE.Vector3(1, 0, 0);
  if (axisMode === "y") return new THREE.Vector3(0, 1, 0);
  return new THREE.Vector3(0, 0, 1);
}

function configureSurfaceTransformAxis() {
  const axisMode = surfaceAxisMode();
  for (const control of surfaceTransforms) {
    const allowed = { x: true, y: true, z: true };
    if (control === surfaceTransform && activeWorkView === "front") allowed.z = false;
    if (control === surfaceTransform && activeWorkView === "side") allowed.x = false;
    if (control === surfaceTransform && activeWorkView === "top") allowed.y = false;
    control.showX = allowed.x && (axisMode === "free" || axisMode === "x");
    control.showY = allowed.y && (axisMode === "free" || axisMode === "y");
    control.showZ = allowed.z && (axisMode === "free" || axisMode === "z");
    control.setSpace("world");
  }
  syncSurfaceAxisUi();
}

function surfaceGizmoShouldShow() {
  return dragPushMode
    && surfaceInteractionMode() === "mouse"
    && surfaceComponentSelectionCount() > 0
    && !els.surfaceEditorWindow?.classList.contains("collapsed");
}

function hideSurfacePlaneHandles(control = surfaceTransform) {
  const planeNames = new Set(["XY", "XZ", "YZ"]);
  const gizmo = control?._gizmo;
  for (const group of [gizmo?.gizmo?.translate, gizmo?.picker?.translate, gizmo?.helper?.translate]) {
    for (const handle of group?.children || []) {
      if (!planeNames.has(handle.name)) continue;
      handle.layers.set(3);
    }
  }
  if (["XY", "XZ", "YZ"].includes(control.axis)) control.axis = null;
}

function updateSurfaceGizmoAttachment() {
  if (!surfaceTransform) return;
  if (!surfaceGizmoShouldShow()) {
    for (const control of surfaceTransforms) {
      control.enabled = true;
      control.detach();
      control.visible = false;
    }
    surfaceGizmoPivot.visible = false;
    surfaceGizmoDragging = false;
    activeSurfaceTransform = surfaceTransform;
    return;
  }
  const center = selectedSurfaceWorldCenter();
  if (!center) return;
  surfaceGizmoSyncing = true;
  surfaceGizmoPivot.position.copy(center);
  surfaceGizmoPivot.quaternion.identity();
  surfaceGizmoPivot.scale.set(1, 1, 1);
  surfaceGizmoPivot.updateMatrixWorld(true);
  surfaceGizmoLastPosition.copy(surfaceGizmoPivot.position);
  surfaceGizmoSyncing = false;
  configureSurfaceTransformAxis();
  for (const control of surfaceTransforms) {
    control.setMode("translate");
    control.setTranslationSnap(dragPushStepSize());
    control.enabled = true;
    control.attach(surfaceGizmoPivot);
    control.visible = true;
    hideSurfacePlaneHandles(control);
  }
}

function beginSurfaceGizmoDrag(event) {
  if (!surfaceGizmoShouldShow()) return;
  activeSurfaceTransform = event?.target || surfaceTransform;
  surfaceGizmoDragging = true;
  surfaceGizmoMovedDistance = 0;
  surfaceGizmoLastPosition.copy(surfaceGizmoPivot.position);
  recordHistory("move selected surface with gizmo");
  els.hudText.textContent = "Surface arrows active: drag X, Y, or Z to move the selected surface";
}

function applySurfaceGizmoDelta(event) {
  if (!surfaceGizmoDragging || surfaceGizmoSyncing || !surfaceComponentSelectionCount()) return;
  const control = event?.target || activeSurfaceTransform || surfaceTransform;
  const delta = surfaceGizmoPivot.position.clone().sub(surfaceGizmoLastPosition);
  let axisMode = surfaceAxisMode();
  if (axisMode === "free") {
    const activeAxis = String(control.axis || "").toLowerCase();
    if (["x", "y", "z"].includes(activeAxis)) axisMode = activeAxis;
    else {
      const components = [Math.abs(delta.x), Math.abs(delta.y), Math.abs(delta.z)];
      axisMode = ["x", "y", "z"][components.indexOf(Math.max(...components))];
    }
  }
  const axisDirection = surfaceAxisWorldDirection(axisMode);
  const distance = delta.dot(axisDirection);
  if (Math.abs(distance) < .0000001) return;
  const softFalloff = els.surfaceMouseFalloffSelect?.value === "soft";
  const radius = Math.max(.01, Number(els.softRadiusInput?.value) || .25);
  const movement = axisDirection.clone().multiplyScalar(distance);
  if (surfaceComponentMode === "vertex" || surfaceComponentMode === "edge") {
    moveSelectedSurfaceComponentsByWorldDelta(movement);
  } else {
    const facesByMesh = new Map();
    for (const face of selectedFaces) {
      if (!facesByMesh.has(face.mesh)) facesByMesh.set(face.mesh, []);
      facesByMesh.get(face.mesh).push(face);
    }
    for (const [mesh, faces] of facesByMesh) {
      if (softFalloff) softMoveFacesByDistance(mesh, faces, distance, radius, axisMode);
      else moveSelectedVerticesAlongAxis(mesh, faces, distance, axisMode);
    }
  }
  surfaceGizmoMovedDistance += Math.abs(distance);
  surfaceGizmoLastPosition.copy(surfaceGizmoPivot.position);
  updateFaceMarker();
  updateSurfaceComponentMarker();
  updateTriangleHelpers();
  syncSelectionOutlineTransforms();
  updateState();
  const shapeLabel = surfaceComponentMode === "vertex" || surfaceComponentMode === "edge"
    ? `${surfaceComponentMode} component`
    : softFalloff ? `Soft radius ${round(radius)}` : "Hard face";
  els.hudText.textContent = `Surface arrow: moved ${axisMode.toUpperCase()} ${round(distance)} | ${shapeLabel}`;
}

function finishSurfaceGizmoDrag() {
  if (!surfaceGizmoDragging) return;
  surfaceGizmoDragging = false;
  updateAll();
  updateSurfaceGizmoAttachment();
  els.hudText.textContent = `Surface ready: ${surfaceAxisMode() === "free" ? "drag an X/Y/Z arrow" : `drag the locked ${surfaceAxisMode().toUpperCase()} arrow`} | ${els.surfaceMouseFalloffSelect?.value === "hard" ? "Hard face" : `Soft radius ${Number(els.softRadiusInput?.value || .25)}`}`;
  log(`Moved selected surface with viewport arrows.`, { distance: round(surfaceGizmoMovedDistance) });
  activeSurfaceTransform = surfaceTransform;
}

function armContextualSurfaceDrag() {
  syncSurfaceEditorUi();
  if (!surfaceComponentSelectionCount() || surfaceInteractionMode() !== "mouse" || !els.autoSurfaceDragInput?.checked) return;
  setSurfaceEditorOpen(true);
  setDragPushMode(true, { silent: true });
  updateSurfaceGizmoAttachment();
  els.hudText.textContent = `Surface ready: ${surfaceAxisMode() === "free" ? "drag an X/Y/Z arrow" : `drag the locked ${surfaceAxisMode().toUpperCase()} arrow or the selected face left/right`} | ${els.surfaceMouseFalloffSelect?.value === "hard" ? "Hard face" : `Soft radius ${Number(els.softRadiusInput?.value || .25)}`}`;
}

function applyRotationSnap() {
  const degrees = Number(els.rotationSnapSelect.value) || 0;
  const radians = degrees ? THREE.MathUtils.degToRad(degrees) : null;
  if (typeof transform.setRotationSnap === "function") transform.setRotationSnap(radians);
  else transform.rotationSnap = radians;
  log(`Rotation snap ${degrees ? `${degrees} degrees` : "disabled"}.`);
}

function linkedObjects(mesh) {
  const linkId = mesh?.userData?.linkId;
  if (!linkId) return [];
  return objects.filter(object => object.userData?.linkId === linkId);
}

function usedLinkColors({ ignoreLinkId = null } = {}) {
  const colors = new Set();
  for (const mesh of objects) {
    if (!mesh.userData?.linkId) continue;
    if (ignoreLinkId && mesh.userData.linkId === ignoreLinkId) continue;
    if (mesh.userData.linkColor) colors.add(mesh.userData.linkColor.toLowerCase());
  }
  return colors;
}

function uniqueLinkColor({ ignoreLinkId = null } = {}) {
  const used = usedLinkColors({ ignoreLinkId });
  for (let i = 0; i < 360; i += 23) {
    const hue = (i * 37) % 360;
    const color = `#${new THREE.Color().setHSL(hue / 360, .72, .62).getHexString()}`;
    if (!used.has(color.toLowerCase())) return color;
  }
  let fallbackIndex = 0;
  while (fallbackIndex < 720) {
    const hue = (fallbackIndex * 17) % 360;
    const lightness = .48 + ((fallbackIndex % 5) * .08);
    const color = `#${new THREE.Color().setHSL(hue / 360, .78, Math.min(.74, lightness)).getHexString()}`;
    if (!used.has(color.toLowerCase())) return color;
    fallbackIndex++;
  }
  return `#${new THREE.Color().setHSL(Math.random(), .8, .6).getHexString()}`;
}

function ensureLinkGroupColors() {
  const groups = new Map();
  for (const mesh of objects) {
    const linkId = mesh.userData?.linkId;
    if (!linkId) continue;
    if (!groups.has(linkId)) groups.set(linkId, []);
    groups.get(linkId).push(mesh);
  }
  for (const [linkId, meshes] of groups) {
    if (meshes.length < 2) {
      meshes.forEach(mesh => {
        mesh.userData.linkId = null;
        mesh.userData.linkColor = null;
      });
      continue;
    }
    const sharedColor = meshes.find(mesh => mesh.userData.linkColor)?.userData.linkColor || uniqueLinkColor({ ignoreLinkId: linkId });
    meshes.forEach(mesh => {
      mesh.userData.linkColor = sharedColor;
    });
  }
}

function createSceneGroupId() {
  return `group-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createModelGroupId() {
  return `model-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createSceneGroupRecord({ id = null, name = "Group", parentId = null } = {}) {
  const groupId = id || createSceneGroupId();
  const record = {
    id: groupId,
    name: String(name || "Group").trim() || "Group",
    parentId: parentId || null
  };
  sceneGroupRegistry.set(groupId, record);
  return record;
}

function groupRecord(id) {
  return id ? sceneGroupRegistry.get(id) || null : null;
}

function serializeGroupRecord(record) {
  return {
    id: record.id,
    name: record.name,
    parentId: record.parentId || null
  };
}

function serializeGroupRecords() {
  return [...sceneGroupRegistry.values()].map(serializeGroupRecord);
}

function childGroupRecords(parentId = null) {
  return [...sceneGroupRegistry.values()]
    .filter(record => (record.parentId || null) === (parentId || null))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
}

function meshesDirectInGroup(groupId) {
  return objects
    .filter(mesh => (mesh.userData.groupId || null) === (groupId || null))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
}

function descendantGroupIds(groupId) {
  const ids = [];
  const queue = [groupId];
  while (queue.length) {
    const current = queue.shift();
    for (const child of childGroupRecords(current)) {
      ids.push(child.id);
      queue.push(child.id);
    }
  }
  return ids;
}

function descendantMeshesForGroup(groupId) {
  const ids = new Set([groupId, ...descendantGroupIds(groupId)]);
  return objects.filter(mesh => ids.has(mesh.userData.groupId || null));
}

function groupPath(record) {
  const names = [];
  let current = record;
  const seen = new Set();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    names.unshift(current.name);
    current = groupRecord(current.parentId);
  }
  return names.join(" / ");
}

function hasGroupContent(groupId) {
  return meshesDirectInGroup(groupId).length > 0 || childGroupRecords(groupId).length > 0;
}

function cleanupEmptySceneGroups() {
  let changed = true;
  while (changed) {
    changed = false;
    for (const [groupId] of [...sceneGroupRegistry.entries()]) {
      if (hasGroupContent(groupId)) continue;
      sceneGroupRegistry.delete(groupId);
      if (selectedGroupRecordId === groupId) selectedGroupRecordId = null;
      changed = true;
    }
  }
}

function commonGroupParentId(groupIds = []) {
  const normalized = [...new Set(groupIds.map(id => id || null))];
  return normalized.length === 1 ? normalized[0] : null;
}

function usedSceneGroupNames({ ignoreGroupId = null } = {}) {
  const names = new Set();
  for (const record of sceneGroupRegistry.values()) {
    if (!record?.id || !record?.name) continue;
    if (ignoreGroupId && record.id === ignoreGroupId) continue;
    names.add(record.name.toLowerCase());
  }
  return names;
}

function uniqueSceneGroupName(base = "Group", { ignoreGroupId = null } = {}) {
  const root = String(base || "Group").trim() || "Group";
  const used = usedSceneGroupNames({ ignoreGroupId });
  if (!used.has(root.toLowerCase())) return root;
  let index = 2;
  while (used.has(`${root} ${index}`.toLowerCase())) index++;
  return `${root} ${index}`;
}

function persistentGroupObjects(mesh) {
  const groupId = mesh?.userData?.groupId;
  if (!groupId) return [];
  return objects.filter(object => object.userData?.groupId === groupId);
}

function ensureSceneGroups() {
  for (const mesh of objects) {
    const groupId = mesh.userData?.groupId || null;
    if (!groupId) {
      mesh.userData.groupName = null;
      continue;
    }
    let record = groupRecord(groupId);
    if (!record) {
      record = createSceneGroupRecord({
        id: groupId,
        name: mesh.userData.groupName || uniqueSceneGroupName(normalizeGroupName(mesh.name))
      });
    } else if (!record.name) {
      record.name = mesh.userData.groupName || uniqueSceneGroupName(normalizeGroupName(mesh.name));
    }
  }

  for (const record of sceneGroupRegistry.values()) {
    if (!record.parentId || !sceneGroupRegistry.has(record.parentId) || record.parentId === record.id) {
      record.parentId = null;
      continue;
    }
    const seen = new Set([record.id]);
    let current = record.parentId;
    while (current) {
      if (seen.has(current)) {
        record.parentId = null;
        break;
      }
      seen.add(current);
      current = groupRecord(current)?.parentId || null;
    }
  }

  cleanupEmptySceneGroups();

  for (const mesh of objects) {
    const record = groupRecord(mesh.userData.groupId);
    if (!record) {
      mesh.userData.groupId = null;
      mesh.userData.groupName = null;
      continue;
    }
    mesh.userData.groupName = record.name;
  }
}

function ensureModelGroups() {
  for (const mesh of objects) {
    delete mesh.userData.modelId;
    delete mesh.userData.modelName;
  }
}

function linkSelectionIds(mesh) {
  const linked = linkedObjects(mesh);
  return linked.length > 1 ? linked.map(object => object.userData.id) : [];
}

function additiveSelectionRequested(event) {
  return !!(event?.shiftKey || event?.ctrlKey || event?.metaKey);
}

function selectObject(mesh, { keepGroup = false, append = false } = {}) {
  if (append && !mesh) return;
  if (selectedHoleLoopInfo?.targetId) {
    const nextTargetId = mesh?.userData?.id || null;
    if (!nextTargetId || selectedHoleLoopInfo.targetId !== nextTargetId) {
      clearSelectedHoleLoop();
    }
  }
  if (mesh) selectedGroupRecordId = null;
  let nextSelected = mesh || null;
  if (!keepGroup) {
    if (append && mesh) {
      const seedIds = activeGroupIds.length
        ? activeGroupIds
        : (selected
          ? (linkSelectionIds(selected).length ? linkSelectionIds(selected) : [selected.userData.id])
          : []);
      const nextIds = new Set(seedIds);
      const linkedIds = linkSelectionIds(mesh);
      const idsToToggle = linkedIds.length ? linkedIds : [mesh.userData.id];
      const allPresent = idsToToggle.every(id => nextIds.has(id));
      idsToToggle.forEach(id => {
        if (allPresent) nextIds.delete(id);
        else nextIds.add(id);
      });
      activeGroupIds = [...nextIds];
      if (allPresent) {
        nextSelected = objects.find(object => nextIds.has(object.userData.id)) || null;
      }
    }
    else {
      activeGroupIds = mesh ? linkSelectionIds(mesh) : [];
    }
  }
  const previousSelected = selected;
  selected = nextSelected;
  // Clicking a different scene object does not necessarily move focus away
  // from a numeric inspector field (notably when selecting on the canvas).
  // End the old edit session so its stale values cannot be applied to the new
  // selection and allow updateAll() to populate the new object's values.
  if (previousSelected !== selected && document.activeElement?.matches(".props input")) {
    document.activeElement.blur();
  }
  updateTransformAttachment();
  updateAll();
}

function checkedObjects() {
  return objects.filter(mesh => checkedIds.has(mesh.userData.id));
}

function activeGroupObjects() {
  return objects.filter(mesh => activeGroupIds.includes(mesh.userData.id));
}

function uniqueMeshList(meshes) {
  const seen = new Set();
  const result = [];
  for (const mesh of meshes || []) {
    if (!mesh?.userData?.id || seen.has(mesh.userData.id)) continue;
    seen.add(mesh.userData.id);
    result.push(mesh);
  }
  return result;
}

function selectedFaceMeshes() {
  return uniqueMeshList(selectedFaces.map(face => face.mesh).filter(Boolean));
}

function meshActionCandidates() {
  return {
    checked: checkedObjects(),
    active: activeGroupObjects(),
    faceMeshes: selectedFaceMeshes(),
    selectedOnly: selected ? [selected] : []
  };
}

function resolveSelectionTargets(mode = "single") {
  const candidates = meshActionCandidates();
  const selectedGroup = selectedGroupRecordId && groupRecord(selectedGroupRecordId)
    ? descendantMeshesForGroup(selectedGroupRecordId)
    : [];
  if (mode === "faces") return candidates.faceMeshes;
  if (mode === "group") return uniqueMeshList(selectedGroup);
  if (mode === "multiple") {
    if (candidates.checked.length >= 2) return uniqueMeshList(candidates.checked);
    if (selectedGroup.length) return uniqueMeshList(selectedGroup);
    if (candidates.active.length >= 2) return uniqueMeshList(candidates.active);
    return uniqueMeshList([
      ...candidates.selectedOnly,
      ...candidates.checked,
      ...candidates.active
    ]);
  }
  if (mode === "meshes") {
    if (candidates.checked.length) return uniqueMeshList(candidates.checked);
    if (selectedGroup.length) return uniqueMeshList(selectedGroup);
    if (candidates.active.length) return uniqueMeshList(candidates.active);
    return uniqueMeshList(candidates.selectedOnly);
  }
  if (candidates.faceMeshes.length === 1) return candidates.faceMeshes;
  if (candidates.selectedOnly.length === 1) return candidates.selectedOnly;
  if (candidates.checked.length === 1) return candidates.checked;
  if (candidates.active.length === 1) return candidates.active;
  return [];
}

function cutterActionSelection() {
  const checked = checkedObjects();
  if (selected && checked.includes(selected) && checked.length >= 2) {
    return {
      cutter: selected,
      targets: checked.filter(mesh => mesh !== selected)
    };
  }
  if (selected && !checked.includes(selected) && checked.length === 1 && checked[0] !== selected) {
    return {
      cutter: checked[0],
      targets: [selected]
    };
  }
  return {
    cutter: null,
    targets: []
  };
}

function singleMeshTarget() {
  return resolveSelectionTargets("single")[0] || null;
}

function pairMeshTargets() {
  const candidates = meshActionCandidates();
  if (candidates.checked.length === 2) return uniqueMeshList(candidates.checked);
  if (candidates.active.length === 2) return uniqueMeshList(candidates.active);
  const combined = uniqueMeshList([
    ...candidates.selectedOnly,
    ...candidates.faceMeshes,
    ...candidates.checked,
    ...candidates.active
  ]);
  return combined.length === 2 ? combined : [];
}

function transformTargetObjects() {
  const explicitGroup = activeGroupObjects();
  if (explicitGroup.length > 1) return explicitGroup;
  const checked = checkedObjects();
  if (checked.length > 1) return checked;
  return [];
}

function transformTargetKey(groupObjects) {
  return groupObjects.map(mesh => mesh.userData.id).sort().join("|");
}

function groupBoundsCenter(groupObjects) {
  const box = new THREE.Box3();
  for (const mesh of groupObjects) box.expandByObject(mesh);
  return box.getCenter(new THREE.Vector3());
}

function sharedStoredPivot(groupObjects) {
  const first = groupObjects[0]?.userData?.pivot;
  if (!Array.isArray(first) || first.length !== 3) return null;
  for (const mesh of groupObjects.slice(1)) {
    const next = mesh.userData?.pivot;
    if (!Array.isArray(next) || next.length !== 3) return null;
    for (let i = 0; i < 3; i++) {
      if (Math.abs((Number(next[i]) || 0) - (Number(first[i]) || 0)) > 0.001) return null;
    }
  }
  return new THREE.Vector3(first[0], first[1], first[2]);
}

function setStoredPivotForObjects(groupObjects, pivotVector) {
  const pivot = pivotVector.toArray().map(round);
  for (const mesh of groupObjects) mesh.userData.pivot = [...pivot];
}

function syncGroupPivotToObjects(groupObjects, { forceCenter = false } = {}) {
  if (!groupObjects.length) {
    currentTransformTargetKey = "";
    return;
  }
  const nextKey = transformTargetKey(groupObjects);
  const selectionChanged = nextKey !== currentTransformTargetKey;
  currentTransformTargetKey = nextKey;
  if (!selectionChanged && !forceCenter) return;
  const pivot = !forceCenter ? (sharedStoredPivot(groupObjects) || groupBoundsCenter(groupObjects)) : groupBoundsCenter(groupObjects);
  groupPivot.position.copy(pivot);
  groupPivot.rotation.set(0, 0, 0);
  groupPivot.scale.set(1, 1, 1);
  groupPivot.updateMatrixWorld(true);
  lastGroupMatrix.copy(groupPivot.matrixWorld);
  setStoredPivotForObjects(groupObjects, groupPivot.position);
}

function activeScaleAxisMap(currentScale = null, previousScale = null) {
  const axisName = String(transform.axis || "").toUpperCase();
  const axisMap = { x: false, y: false, z: false };
  if (axisName.includes("X")) axisMap.x = true;
  if (axisName.includes("Y")) axisMap.y = true;
  if (axisName.includes("Z")) axisMap.z = true;
  if (!axisMap.x && !axisMap.y && !axisMap.z && currentScale && previousScale) {
    axisMap.x = Math.abs(currentScale.x - previousScale.x) > 1e-6;
    axisMap.y = Math.abs(currentScale.y - previousScale.y) > 1e-6;
    axisMap.z = Math.abs(currentScale.z - previousScale.z) > 1e-6;
  }
  return axisMap;
}

function worldAxisDirections(object3d) {
  const quaternion = new THREE.Quaternion();
  object3d.getWorldQuaternion(quaternion);
  return {
    x: new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion).normalize(),
    y: new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion).normalize(),
    z: new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion).normalize()
  };
}

function oneSidedScaleOffset(sizeVector, currentScale, previousScale, directions, signMap = { x: 1, y: 1, z: 1 }) {
  const axisMap = activeScaleAxisMap(currentScale, previousScale);
  const offset = new THREE.Vector3();
  if (axisMap.x) offset.add(directions.x.clone().multiplyScalar(sizeVector.x * (currentScale.x - previousScale.x) * .5 * (signMap.x || 1)));
  if (axisMap.y) offset.add(directions.y.clone().multiplyScalar(sizeVector.y * (currentScale.y - previousScale.y) * .5 * (signMap.y || 1)));
  if (axisMap.z) offset.add(directions.z.clone().multiplyScalar(sizeVector.z * (currentScale.z - previousScale.z) * .5 * (signMap.z || 1)));
  return offset;
}

function detectScaleHandleSigns(targetObject, directions) {
  const result = { x: 1, y: 1, z: 1 };
  if (!targetObject || !transform.axis) return result;
  raycaster.setFromCamera(lastCanvasPointer, camera);
  const hits = raycaster.intersectObject(transform, true);
  const hit = hits.find(entry => entry.object?.visible !== false) || hits[0];
  if (!hit?.point) return result;
  const origin = new THREE.Vector3();
  targetObject.getWorldPosition(origin);
  const relative = hit.point.clone().sub(origin);
  if (String(transform.axis || "").toUpperCase().includes("X")) result.x = relative.dot(directions.x) >= 0 ? 1 : -1;
  if (String(transform.axis || "").toUpperCase().includes("Y")) result.y = relative.dot(directions.y) >= 0 ? 1 : -1;
  if (String(transform.axis || "").toUpperCase().includes("Z")) result.z = relative.dot(directions.z) >= 0 ? 1 : -1;
  return result;
}

function beginScaleDragSession() {
  scaleDragState = null;
  if (pivotEditMode || activeTransformMode !== "scale") return;
  if (transform.object === groupPivot) {
    const groupObjects = pivotManagedObjects();
    if (!groupObjects.length) return;
    const box = new THREE.Box3();
    for (const mesh of groupObjects) box.expandByObject(mesh);
    const directions = worldAxisDirections(groupPivot);
    scaleDragState = {
      type: "group",
      key: transformTargetKey(groupObjects),
      prevScale: groupPivot.scale.clone(),
      boundsSize: box.getSize(new THREE.Vector3()),
      signMap: detectScaleHandleSigns(groupPivot, directions)
    };
    return;
  }
  if (!selected || transform.object !== selected) return;
  if (!selected.geometry.boundingBox) selected.geometry.computeBoundingBox();
  const directions = worldAxisDirections(selected);
  scaleDragState = {
    type: "single",
    id: selected.userData.id,
    prevScale: selected.scale.clone(),
    localSize: selected.geometry.boundingBox.getSize(new THREE.Vector3()),
    signMap: detectScaleHandleSigns(selected, directions)
  };
}

function finishScaleDragSession() {
  scaleDragState = null;
}

function applySingleSidedScaleOffset() {
  if (!scaleDragState || scaleDragState.type !== "single" || !selected || selected.userData.id !== scaleDragState.id) return;
  const currentScale = selected.scale.clone();
  if (!isShiftHeld) {
    scaleDragState.prevScale.copy(currentScale);
    return;
  }
  const offset = oneSidedScaleOffset(
    scaleDragState.localSize,
    currentScale,
    scaleDragState.prevScale,
    worldAxisDirections(selected),
    scaleDragState.signMap
  );
  if (offset.lengthSq() > 0) selected.position.add(offset);
  scaleDragState.prevScale.copy(currentScale);
}

function setPivotEditMode(enabled, { silent = false } = {}) {
  if (enabled) {
    const pivotTargets = pivotManagedObjects();
    if (!pivotTargets.length) {
      if (!silent) log("Select a part, or check two or more parts, before moving a pivot.");
      return;
    }
    pivotReturnMode = activeTransformMode || "rotate";
    pivotEditMode = true;
    els.pivotBtn.classList.add("active");
    syncGroupPivotToObjects(pivotTargets);
    transform.detach();
    transform.setMode("translate");
    transform.setSpace("world");
    transform.attach(groupPivot);
    els.hudText.textContent = `${pivotTargets.length > 1 ? "Shared" : "Single-part"} pivot edit: move the gizmo to place the hinge/pivot, then click Edit Pivot again`;
    syncInspector();
    updateState();
    if (!silent) log(`Pivot edit mode on. Move the gizmo to place the ${pivotTargets.length > 1 ? "shared" : "part"} hinge/pivot.`);
    return;
  }
  if (!pivotEditMode) {
    els.pivotBtn.classList.remove("active");
    return;
  }
  pivotEditMode = false;
  els.pivotBtn.classList.remove("active");
  if (!activeTransformMode && pivotReturnMode) activeTransformMode = pivotReturnMode;
  document.querySelectorAll("[data-mode]").forEach(btn => btn.classList.toggle("active", activeTransformMode === btn.dataset.mode));
  updateTransformAttachment();
  els.hudText.textContent = activeTransformMode
    ? `${activeTransformMode[0].toUpperCase()}${activeTransformMode.slice(1)} gizmo active | Click ${activeTransformMode} again to turn it off`
    : "Orbit: drag | Select: click | Multi-select: Shift/Ctrl+click | Transform tools: toggle Move/Rotate/Scale";
  syncInspector();
  updateState();
  if (!silent) log("Pivot edit mode off.");
}

function centerSharedPivot() {
  const pivotTargets = pivotManagedObjects();
  if (!pivotTargets.length) {
    log("Select a part, or check two or more parts, before centering a pivot.");
    return;
  }
  syncGroupPivotToObjects(pivotTargets, { forceCenter: true });
  updateTransformAttachment();
  syncInspector();
  updateState();
  log(`${pivotTargets.length > 1 ? "Shared" : "Single-part"} pivot reset to the ${pivotTargets.length > 1 ? "checked-parts" : "selected part"} center.`);
}

function textureTargetObjects() {
  return resolveSelectionTargets("meshes");
}

function pivotManagedObjects() {
  const groupObjects = transformTargetObjects();
  if (groupObjects.length) return groupObjects;
  return selected ? [selected] : [];
}

function syncTextureButtonLabel() {
  const targets = textureTargetObjects();
  const hasTexture = targets.length > 0 && targets.every(mesh => !!mesh.userData.textureUrl);
  const hasAnyTexture = targets.some(mesh => !!mesh.userData.textureUrl);
  els.textureBtn.textContent = hasTexture ? "Change Texture" : "Add Texture";
  els.textureBtn.title = hasTexture
    ? "Open the texture library or import a replacement texture for the selected part or checked parts"
    : "Open the texture library or add a texture image to the selected part or checked parts";
  els.saveTextureImageBtn.disabled = !hasAnyTexture;
  els.saveTextureImageBtn.title = hasAnyTexture
    ? "Save each unique texture used by the selected part or checked parts"
    : "Select one or more textured parts before saving an image";
  refreshTextureLibraryUi();
  syncTextureEditorButton();
}

function textureImageFileExtension(dataUrl = "", textureName = "") {
  const mime = String(dataUrl).match(/^data:image\/([^;,]+)/i)?.[1]?.toLowerCase() || "";
  const mimeExtensions = {
    jpeg: "jpg",
    jpg: "jpg",
    png: "png",
    webp: "webp",
    gif: "gif",
    bmp: "bmp",
    "svg+xml": "svg"
  };
  if (mimeExtensions[mime]) return mimeExtensions[mime];
  const namedExtension = String(textureName).match(/\.(png|jpe?g|webp|gif|bmp|svg)$/i)?.[1]?.toLowerCase();
  return namedExtension === "jpeg" ? "jpg" : (namedExtension || "png");
}

function saveSelectedTextureImages() {
  const texturedTargets = textureTargetObjects().filter(mesh => !!mesh.userData.textureUrl);
  if (!texturedTargets.length) {
    log("Select or check one or more textured parts before saving an image.");
    return [];
  }
  const uniqueTextures = new Map();
  for (const mesh of texturedTargets) {
    if (uniqueTextures.has(mesh.userData.textureUrl)) continue;
    uniqueTextures.set(mesh.userData.textureUrl, {
      dataUrl: mesh.userData.textureUrl,
      textureName: mesh.userData.textureName || `${mesh.name} Texture`,
      meshName: mesh.name
    });
  }
  const savedNames = [];
  for (const entry of uniqueTextures.values()) {
    const extension = textureImageFileExtension(entry.dataUrl, entry.textureName);
    const baseName = safeFileName(
      String(entry.textureName || entry.meshName || "texture").replace(/\.(png|jpe?g|webp|gif|bmp|svg)$/i, ""),
      "texture"
    );
    const fileName = `${baseName}.${extension}`;
    downloadDataUrl(fileName, entry.dataUrl);
    savedNames.push(fileName);
  }
  log(`Saved ${savedNames.length} texture image${savedNames.length === 1 ? "" : "s"}.`, {
    files: savedNames
  });
  return savedNames;
}

function applySelectedLibraryTexture() {
  const targets = textureTargetObjects();
  if (!targets.length) {
    log("Select or check one or more parts before applying a stored texture.");
    return;
  }
  const selectedName = els.textureLibrarySelect?.value;
  const entry = selectedName ? textureLibrary.get(selectedName) : null;
  if (!entry) {
    log("Choose a stored texture from the Texture Library first.");
    return;
  }
  recordHistory("apply library texture");
  for (const mesh of targets) applyTextureToMesh(mesh, entry.dataUrl, entry.name, true, 0);
  syncInspector();
  updateAll();
  log(`Applied stored texture ${entry.name} to ${targets.length} part${targets.length === 1 ? "" : "s"}.`);
}

function editTargetObjects() {
  const groupObjects = activeGroupObjects();
  if (groupObjects.length > 1) return groupObjects;
  const checked = checkedObjects();
  if (checked.length > 1) return checked;
  return selected ? [selected] : [];
}

function flipSelectedParts(axis) {
  const targets = editTargetObjects();
  if (!targets.length) {
    log("Select a part, checked parts, or a group before flipping.");
    return [];
  }
  recordHistory(`flip ${axis}`);
  if (targets.length > 1) {
    const sharedCenter = groupBoundsCenter(targets);
    for (const mesh of targets) mirrorMeshAcrossWorldPlane(mesh, axis, sharedCenter);
    currentTransformTargetKey = "";
    syncGroupPivotToObjects(targets, { forceCenter: true });
  } else {
    mirrorMeshGeometry(targets[0], axis);
  }
  updateAll();
  log(targets.length > 1
    ? `Flipped ${targets.length} parts around their shared ${axis.toUpperCase()} center.`
    : `Flipped 1 part around its local ${axis.toUpperCase()} center.`);
  return targets;
}

function setChecked(mesh, checked) {
  if (checked) checkedIds.add(mesh.userData.id);
  else checkedIds.delete(mesh.userData.id);
  updateTransformAttachment();
  syncInspector();
  syncLiveMirrorUi();
  updateState();
  renderTree();
}

function setHidden(mesh, hidden) {
  if (!mesh) return;
  mesh.userData.hidden = !!hidden;
  mesh.visible = !hidden;
  if (hidden) clearTriangleSelectionForMeshes([mesh]);
  updateTransformAttachment();
  syncInspector();
  syncLiveMirrorUi();
  updateState();
  renderTree();
}

function hideTargetObjects(mesh) {
  if (!mesh) return [];
  if (checkedIds.has(mesh.userData.id)) {
    const checkedLinked = checkedObjects().filter(object => {
      if (mesh.userData.linkId) return object.userData.linkId === mesh.userData.linkId;
      return object.userData.id === mesh.userData.id;
    });
    if (checkedLinked.length) return checkedLinked;
    return [mesh];
  }
  const linked = linkedObjects(mesh);
  if (linked.length > 1) return linked;
  return [mesh];
}

function clearTriangleSelectionForMeshes(meshes) {
  const ids = new Set((meshes || []).filter(Boolean).map(mesh => mesh.userData.id));
  if (!ids.size || !selectedFaces.length) return false;
  const kept = selectedFaces.filter(face => !ids.has(face.mesh?.userData?.id));
  if (kept.length === selectedFaces.length) return false;
  selectedFaces.length = 0;
  selectedFaces.push(...kept);
  selectedFace = selectedFaces.at(-1) || null;
  updateFaceMarker();
  updateState();
  return true;
}

function setHiddenTargets(meshes, hidden) {
  const targets = [...new Set((meshes || []).filter(Boolean))];
  if (!targets.length) return;
  for (const mesh of targets) {
    mesh.userData.hidden = !!hidden;
    mesh.visible = !hidden;
  }
  if (hidden) clearTriangleSelectionForMeshes(targets);
  updateTransformAttachment();
  syncInspector();
  updateState();
  renderTree();
}

function createLinkId() {
  return `link-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function linkCandidateObjects(mesh) {
  const explicitGroup = activeGroupObjects();
  if (explicitGroup.length > 1) return explicitGroup;
  const checked = checkedObjects();
  if (checked.length > 1) return checked;
  const linked = linkedObjects(mesh);
  if (linked.length > 1) return linked;
  return mesh ? [mesh] : [];
}

function setLinked(mesh, linked) {
  if (!mesh) return;
  if (linked) {
    const targets = linkCandidateObjects(mesh);
    if (targets.length < 2) {
      log("Select or check at least two parts before linking them.");
      renderTree();
      return;
    }
    const linkId = createLinkId();
    const linkColor = uniqueLinkColor();
    for (const object of targets) {
      object.userData.linkId = linkId;
      object.userData.linkColor = linkColor;
    }
    if (selected && targets.some(object => object.userData.id === selected.userData.id)) {
      activeGroupIds = targets.map(object => object.userData.id);
    }
    log(`Linked ${targets.length} part${targets.length === 1 ? "" : "s"} together.`);
  }
  else {
    const previousLinkId = mesh.userData.linkId;
    if (!previousLinkId) {
      renderTree();
      return;
    }
    mesh.userData.linkId = null;
    mesh.userData.linkColor = null;
    const remaining = objects.filter(object => object.userData.linkId === previousLinkId);
    if (remaining.length < 2) {
      for (const object of remaining) {
        object.userData.linkId = null;
        object.userData.linkColor = null;
      }
    }
    if (selected) activeGroupIds = linkSelectionIds(selected);
    log(`Unlinked ${mesh.name}.`);
  }
  ensureLinkGroupColors();
  updateTransformAttachment();
  syncInspector();
  updateState();
  renderTree();
}

function setCheckedMeshes(meshes, checked, { replace = false } = {}) {
  if (replace) checkedIds.clear();
  for (const mesh of meshes) {
    if (checked) checkedIds.add(mesh.userData.id);
    else checkedIds.delete(mesh.userData.id);
  }
  currentTransformTargetKey = "";
  if (!checkedIds.size && pivotEditMode) setPivotEditMode(false, { silent: true });
  updateTransformAttachment();
  syncInspector();
  updateState();
  renderTree();
}

function normalizeGroupName(name = "") {
  const base = String(name || "")
    .replace(/\s+copy$/i, "")
    .replace(/[_\-\s]*\d+$/g, "")
    .replace(/[_\-\s]+$/g, "")
    .trim();
  return base || String(name || "Mesh").trim() || "Mesh";
}

function sceneGroups() {
  const groups = new Map();
  for (const mesh of objects) {
    if (mesh.userData.groupId) continue;
    const key = normalizeGroupName(mesh.name);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(mesh);
  }
  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: "base" }));
}

function selectGroupRecord(groupId) {
  const record = groupRecord(groupId);
  if (!record) return;
  selectedGroupRecordId = groupId;
  selected = null;
  activeGroupIds = descendantMeshesForGroup(groupId).map(mesh => mesh.userData.id);
  checkedIds.clear();
  currentTransformTargetKey = "";
  updateTransformAttachment();
  updateAll();
}

function groupFacts(record) {
  const directMeshes = meshesDirectInGroup(record.id);
  const allMeshes = descendantMeshesForGroup(record.id);
  const children = childGroupRecords(record.id);
  const textureNames = [...new Set(allMeshes.map(mesh => mesh.userData.textureName).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
  const linkedCount = allMeshes.filter(mesh => mesh.userData.linkId).length;
  return {
    directMeshes,
    allMeshes,
    children,
    textureNames,
    linkedCount
  };
}

function setListItems(listEl, items, emptyLabel) {
  listEl.innerHTML = "";
  if (!items.length) {
    const li = document.createElement("li");
    li.className = "api-note";
    li.textContent = emptyLabel;
    listEl.append(li);
    return;
  }
  for (const item of items) {
    const li = document.createElement("li");
    if (item instanceof Node) li.append(item);
    else li.innerHTML = item;
    listEl.append(li);
  }
}

function refreshGroupEditor() {
  const record = groupRecord(selectedGroupRecordId);
  if (!record || !els.groupEditorModal.classList.contains("open")) return;
  const facts = groupFacts(record);
  els.groupEditorTitle.textContent = `Group Details - ${record.name}`;
  els.groupEditorInfo.textContent = `Rename this group and inspect its child groups, mesh parts, textures, and hierarchy contents.`;
  els.groupEditorNameInput.value = record.name;
  els.groupEditorFacts.innerHTML = `
    <div><strong>Path</strong>${groupPath(record) || record.name}</div>
    <div><strong>Group ID</strong><code>${record.id}</code></div>
    <div><strong>Parent</strong>${groupRecord(record.parentId)?.name || "Root"}</div>
    <div><strong>Child Groups</strong>${facts.children.length}</div>
    <div><strong>Direct Meshes</strong>${facts.directMeshes.length}</div>
    <div><strong>Total Meshes</strong>${facts.allMeshes.length}</div>
    <div><strong>Linked Meshes</strong>${facts.linkedCount}</div>
  `;
  setListItems(
    els.groupEditorChildGroups,
    facts.children.map(child => `${child.name} <code>${child.id}</code>`),
    "No child groups."
  );
  setListItems(
    els.groupEditorTextures,
    facts.textureNames.map(name => `${name}`),
    "No textures in this group."
  );
  setListItems(
    els.groupEditorMeshes,
    facts.allMeshes.map(mesh => `${mesh.name} <code>${mesh.userData.textureName || (mesh.userData.textureUrl ? "texture" : (mesh.userData.geometry ? "mesh" : mesh.userData.shape))}</code>`),
    "No meshes in this group."
  );
}

function openGroupEditor(groupId) {
  const record = groupRecord(groupId);
  if (!record) return;
  selectedGroupRecordId = groupId;
  els.groupEditorModal.classList.add("open");
  els.groupEditorModal.setAttribute("aria-hidden", "false");
  refreshGroupEditor();
  els.groupEditorNameInput.focus();
  els.groupEditorNameInput.select();
}

function closeGroupEditor() {
  els.groupEditorModal.classList.remove("open");
  els.groupEditorModal.setAttribute("aria-hidden", "true");
}

function saveGroupEditor() {
  const record = groupRecord(selectedGroupRecordId);
  if (!record) {
    closeGroupEditor();
    return;
  }
  const nextName = String(els.groupEditorNameInput.value || "").trim();
  if (!nextName) {
    log("Enter a group name before saving.");
    return;
  }
  recordHistory("rename group");
  record.name = uniqueSceneGroupName(nextName, { ignoreGroupId: record.id });
  ensureSceneGroups();
  ensureModelGroups();
  refreshGroupEditor();
  updateAll();
  log(`Renamed group to ${record.name}.`);
  closeGroupEditor();
}

function selectionTargetsForGrouping() {
  const transformGroup = transformTargetObjects();
  return transformGroup.length > 1 ? transformGroup : checkedObjects();
}

function selectedHierarchyGroupIds(meshes) {
  const selectedIds = new Set(meshes.map(mesh => mesh.userData.id));
  const candidateIds = new Set();
  for (const mesh of meshes) {
    let current = mesh.userData.groupId || null;
    const seen = new Set();
    while (current && !seen.has(current)) {
      seen.add(current);
      candidateIds.add(current);
      current = groupRecord(current)?.parentId || null;
    }
  }
  const complete = [...candidateIds].filter(groupId => {
    const descendants = descendantMeshesForGroup(groupId);
    return descendants.length > 0 && descendants.every(mesh => selectedIds.has(mesh.userData.id));
  });
  return complete.filter(groupId => {
    let parentId = groupRecord(groupId)?.parentId || null;
    while (parentId) {
      if (complete.includes(parentId)) return false;
      parentId = groupRecord(parentId)?.parentId || null;
    }
    return true;
  });
}

function descendantGroupRecordsDeep(groupId) {
  const ordered = [];
  const children = childGroupRecords(groupId);
  for (const child of children) {
    ordered.push(...descendantGroupRecordsDeep(child.id));
    ordered.push(child);
  }
  return ordered;
}

function dissolveGroupRecord(groupId) {
  const record = groupRecord(groupId);
  if (!record) return false;
  const parentId = record.parentId || null;
  const parentRecord = groupRecord(parentId);
  const directMeshes = meshesDirectInGroup(record.id);
  const childRecords = childGroupRecords(record.id);
  for (const child of childRecords) child.parentId = parentId;
  for (const mesh of directMeshes) {
    mesh.userData.groupId = parentId;
    mesh.userData.groupName = parentRecord?.name || null;
  }
  sceneGroupRegistry.delete(record.id);
  cleanupEmptySceneGroups();
  ensureSceneGroups();
  ensureModelGroups();
  selectedGroupRecordId = parentId && groupRecord(parentId) ? parentId : null;
  activeGroupIds = selectedGroupRecordId ? descendantMeshesForGroup(selectedGroupRecordId).map(mesh => mesh.userData.id) : [];
  currentTransformTargetKey = "";
  setPivotEditMode(false, { silent: true });
  updateTransformAttachment();
  syncInspector();
  renderTree();
  updateState();
  log(`Ungrouped ${record.name}.`, {
    parent: parentRecord?.name || "Root",
    childGroups: childRecords.map(child => child.name),
    meshesMoved: directMeshes.map(mesh => mesh.name)
  });
  return true;
}

function splitGroupRecord(groupId) {
  const record = groupRecord(groupId);
  if (!record) return false;
  const descendantRecords = descendantGroupRecordsDeep(groupId);
  const allMeshes = descendantMeshesForGroup(groupId);
  for (const mesh of allMeshes) {
    mesh.userData.groupId = null;
    mesh.userData.groupName = null;
  }
  for (const child of descendantRecords) {
    sceneGroupRegistry.delete(child.id);
  }
  sceneGroupRegistry.delete(record.id);
  cleanupEmptySceneGroups();
  ensureSceneGroups();
  ensureModelGroups();
  selectedGroupRecordId = null;
  activeGroupIds = [];
  currentTransformTargetKey = "";
  setPivotEditMode(false, { silent: true });
  updateTransformAttachment();
  syncInspector();
  renderTree();
  updateState();
  log(`Split ${record.name} into standalone mesh parts.`, {
    removedGroups: [record.name, ...descendantRecords.map(child => child.name)],
    meshesReleased: allMeshes.map(mesh => mesh.name)
  });
  return true;
}

function clearLineSketchGuide() {
  while (lineSketchGroup.children.length) {
    const child = lineSketchGroup.children.pop();
    disposeObject3D(child);
  }
}

function resolveLineSketchPoint(entry) {
  if (!entry) return null;
  if (entry.meshId && entry.localPoint) {
    const mesh = findObject(entry.meshId);
    if (mesh) return entry.localPoint.clone().applyMatrix4(mesh.matrixWorld);
  }
  return entry.point?.clone() || null;
}

function resolvedLineSketchPoints() {
  return lineSketchPoints
    .map(resolveLineSketchPoint)
    .filter(Boolean);
}

function setLineSketchCursor(point = null, normal = null) {
  if (!lineSketchMode || !point) {
    lineSketchCursor.visible = false;
    lineSketchHover = null;
    return;
  }
  lineSketchHover = {
    point: point.clone(),
    normal: normal?.clone() || null
  };
  const radius = Math.max(.025, Math.min(.12, camera.position.distanceTo(point) * .012));
  lineSketchCursor.position.copy(point);
  lineSketchCursor.scale.setScalar(radius);
  lineSketchCursor.visible = true;
}

function updateLineSketchGuide() {
  clearLineSketchGuide();
  const points = resolvedLineSketchPoints();
  if (!points.length) {
    lineSketchGroup.visible = false;
    return;
  }
  lineSketchGroup.visible = true;
  const pointRadius = Math.max(.025, Math.min(.14, camera.position.distanceTo(orbit.target) * .008));
  const pointGeometry = new THREE.SphereGeometry(pointRadius, 10, 8);
  points.forEach((point, index) => {
    const marker = new THREE.Mesh(
      pointGeometry,
      new THREE.MeshBasicMaterial({
        color: index === 0 ? "#40c7a5" : "#ffd36a",
        transparent: true,
        opacity: .95,
        depthWrite: false
      })
    );
    marker.position.copy(point);
    lineSketchGroup.add(marker);
  });
  pointGeometry.dispose();

  const linePoints = lineSketchClosed && points.length >= 3
    ? [...points, points[0]]
    : [...points];
  if (linePoints.length >= 2) {
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(linePoints);
    lineSketchGroup.add(new THREE.Line(
      lineGeometry,
      new THREE.LineBasicMaterial({
        color: "#ffd36a",
        transparent: true,
        opacity: .95,
        depthWrite: false
      })
    ));
  }

  if (lineSketchClosed && points.length >= 3) {
    const spec = makeLineSketchFaceSpec({ name: "line sketch preview", preview: true });
    if (spec) {
      const preview = createMesh({
        ...spec,
        color: "#e1b14b",
        roughness: .9
      });
      preview.material = new THREE.MeshBasicMaterial({
        color: "#e1b14b",
        transparent: true,
        opacity: .18,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      preview.name = "line sketch preview";
      lineSketchGroup.add(preview);
    }
  }
}

function clearLineSketch({ silent = false, keepMode = false } = {}) {
  lineSketchPoints.length = 0;
  lineSketchClosed = false;
  lineSketchPlane = null;
  lineSketchPlaneNormal = null;
  lineSketchHover = null;
  clearLineSketchGuide();
  lineSketchGroup.visible = false;
  lineSketchCursor.visible = false;
  if (!keepMode) lineSketchMode = false;
  updateFacePickHud();
  if (!silent) log("Cleared the line sketch.");
}

function setLineSketchMode(enabled) {
  lineSketchMode = !!enabled;
  if (lineSketchMode) {
    facePickMode = false;
    coplanarFacePickMode = false;
    openingPickMode = false;
    els.paintTriInput.checked = false;
    els.areaTriInput.checked = false;
  }
  if (!lineSketchMode) setLineSketchCursor(null);
  if (!openingPickMode) hoveredHoleLoopInfo = null;
  updateOpeningPickGuide();
  updateFacePickHud();
}

function pointerRayFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  return raycaster.ray.clone();
}

function lineSketchPickFromEvent(event) {
  const hit = hitFromPointerEvent(event);
  if (hit?.point) {
    const normal = hit.face?.normal
      ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize()
      : new THREE.Vector3(0, 1, 0);
    return {
      point: hit.point.clone(),
      normal,
      mesh: hit.object,
      localPoint: hit.point.clone().applyMatrix4(new THREE.Matrix4().copy(hit.object.matrixWorld).invert())
    };
  }
  const ray = pointerRayFromEvent(event);
  if (lineSketchPlane) {
    const point = new THREE.Vector3();
    return lineSketchPlane.intersectLine(
      new THREE.Line3(ray.origin.clone(), ray.origin.clone().add(ray.direction.clone().multiplyScalar(500000))),
      point
    ) ? { point, normal: lineSketchPlaneNormal?.clone() || new THREE.Vector3(0, 1, 0), mesh: null, localPoint: null } : null;
  }
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const point = new THREE.Vector3();
  return plane.intersectLine(
    new THREE.Line3(ray.origin.clone(), ray.origin.clone().add(ray.direction.clone().multiplyScalar(500000))),
    point
  ) ? { point, normal: new THREE.Vector3(0, 1, 0), mesh: null, localPoint: null } : null;
}

function closeLineSketch() {
  if (lineSketchPoints.length < 3) {
    log("Place at least three line points before closing the loop.");
    return false;
  }
  lineSketchClosed = true;
  updateLineSketchGuide();
  log(`Closed line sketch with ${lineSketchPoints.length} point${lineSketchPoints.length === 1 ? "" : "s"}.`);
  return true;
}

function addLineSketchPointFromEvent(event) {
  const hit = lineSketchPickFromEvent(event);
  if (!hit?.point) {
    log("Could not place a sketch point here. Click a mesh surface or the ground grid.");
    return null;
  }
  if (!lineSketchPlane) {
    lineSketchPlaneNormal = hit.normal?.clone().normalize() || new THREE.Vector3(0, 1, 0);
    lineSketchPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(lineSketchPlaneNormal, hit.point);
  }
  const point = hit.point.clone();
  const resolvedPoints = resolvedLineSketchPoints();
  if (resolvedPoints.length >= 3 && point.distanceTo(resolvedPoints[0]) <= Math.max(.08, camera.position.distanceTo(orbit.target) * .01)) {
    closeLineSketch();
    return resolvedPoints[0];
  }
  if (lineSketchClosed) {
    log("The current sketch is already closed. Use Make Face, Cut Hole, or Clear Line.");
    return null;
  }
  lineSketchPoints.push({
    point: point.clone(),
    meshId: hit.mesh?.userData?.id || null,
    localPoint: hit.localPoint?.clone() || null
  });
  updateLineSketchGuide();
  log(`Placed line point ${lineSketchPoints.length}.`, {
    x: round(point.x),
    y: round(point.y),
    z: round(point.z)
  });
  return point;
}

function lineSketchContourData() {
  const points = resolvedLineSketchPoints();
  if (!lineSketchClosed || points.length < 3) return null;
  const { center, xAxis, yAxis, zAxis } = basisFromPoints(points);
  const contour = points.map(point => {
    const local = point.clone().sub(center);
    return new THREE.Vector2(local.dot(xAxis), local.dot(yAxis));
  });
  const isClockwise = THREE.ShapeUtils.isClockWise(contour);
  return {
    center,
    xAxis,
    yAxis,
    zAxis,
    contour: isClockwise ? contour : [...contour].reverse(),
    loop: isClockwise ? [...points] : [...points].reverse()
  };
}

function makeLineSketchFaceSpec({ name = "line sketch face", preview = false } = {}) {
  const data = lineSketchContourData();
  if (!data) return null;
  const triangles = THREE.ShapeUtils.triangulateShape(data.contour, []);
  if (!triangles.length) return null;
  const worldPositions = [];
  for (const face of triangles) {
    const a = data.loop[face[0]];
    const b = data.loop[face[1]];
    const c = data.loop[face[2]];
    addTriangleBothSides(worldPositions, vecArray(a), vecArray(b), vecArray(c));
  }
  const points = [];
  for (let i = 0; i < worldPositions.length; i += 3) {
    points.push(new THREE.Vector3(worldPositions[i], worldPositions[i + 1], worldPositions[i + 2]));
  }
  const box = new THREE.Box3().setFromPoints(points);
  const meshCenter = box.getCenter(new THREE.Vector3());
  const offsetCenter = preview ? meshCenter.clone().addScaledVector(data.zAxis, .003) : meshCenter;
  const localPositions = points.flatMap(point => vecArray(point.clone().sub(offsetCenter)));
  const geometry = geometryFromPositions(localPositions);
  const geometryData = geometryToData(geometry);
  geometry.dispose();
  return {
    shape: "custom",
    geometry: geometryData,
    name,
    position: offsetCenter.toArray().map(round),
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    color: "#e1b14b",
    roughness: .86
  };
}

function createFaceFromLineSketch() {
  const spec = makeLineSketchFaceSpec();
  if (!spec) {
    log("Close a valid line sketch first, then press Make Face.");
    return null;
  }
  recordHistory("make line sketch face");
  const mesh = addObject(spec, { record: false });
  selectObject(mesh);
  clearSelectedTriangles();
  clearLineSketch({ silent: true, keepMode: false });
  updateAll();
  log(`Created ${mesh.name} from the current line sketch.`);
  return mesh;
}

function makeLineSketchTubeSpec({ name = "line sketch tube" } = {}) {
  const points = resolvedLineSketchPoints();
  if (points.length < 2) return null;
  const closed = lineSketchClosed && points.length >= 3;
  const sourceColor = selected?.userData?.color || "#d8c68a";
  const sourceRoughness = Number.isFinite(Number(selected?.userData?.roughness))
    ? Number(selected.userData.roughness)
    : .68;
  const radiusBase = Math.max(.03, Math.min(.4, Math.abs(Number(els.bevelSizeInput?.value) || .16)));
  const radius = Math.max(.02, Math.min(.18, radiusBase * .35));
  const pathLength = points.reduce((sum, point, index) => {
    if (!index) return sum;
    return sum + point.distanceTo(points[index - 1]);
  }, closed ? points[0].distanceTo(points[points.length - 1]) : 0);
  const tubularSegments = Math.max(16, Math.min(320, Math.round(pathLength * 20)));
  const radialSegments = Math.max(8, Math.min(20, Math.round(radius * 80)));
  const curve = points.length === 2
    ? new THREE.LineCurve3(points[0].clone(), points[1].clone())
    : new THREE.CatmullRomCurve3(points.map(point => point.clone()), closed, "centripetal", .25);
  const geometry = new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, closed);
  geometry.computeBoundingBox();
  const meshCenter = geometry.boundingBox.getCenter(new THREE.Vector3());
  const localGeometry = geometry.clone();
  localGeometry.translate(-meshCenter.x, -meshCenter.y, -meshCenter.z);
  const geometryData = geometryToData(localGeometry);
  geometry.dispose();
  localGeometry.dispose();
  return {
    shape: "custom",
    geometry: geometryData,
    name,
    position: meshCenter.toArray().map(round),
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    color: sourceColor,
    roughness: sourceRoughness
  };
}

function fillLineSketch() {
  const wasClosed = lineSketchClosed;
  const spec = makeLineSketchTubeSpec();
  if (!spec) {
    log("Place at least two line sketch points first, then press Fill Line.");
    return null;
  }
  recordHistory("fill line sketch");
  const mesh = addObject(spec, { record: false });
  mesh.name = mesh.name || "line sketch tube";
  selectObject(mesh);
  clearSelectedTriangles();
  clearLineSketch({ silent: true, keepMode: false });
  updateAll();
  log(`Created ${mesh.name} from the current line sketch as a pipe-like mesh.`, {
    closed: wasClosed,
    note: "Use this for crooked frames, trim, ropes, or tube borders."
  });
  return mesh;
}

function pointInPolygon2D(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersects = ((yi > point.y) !== (yj > point.y))
      && (point.x < (xj - xi) * (point.y - yi) / ((yj - yi) || 1e-8) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

function cutHoleFromLineSketch() {
  const data = lineSketchContourData();
  if (!data) {
    const faceResult = carveSelectedFaceByCutter({ splitCutter: false, actionLabel: "cut hole from cutter face" });
    if (faceResult) {
      log(`Cut a real opening in ${faceResult.target.name} using ${faceResult.cutter.name}.`, {
        removedFaceTriangles: faceResult.removedTriangles,
        note: "The selected face was rebuilt around the cutter outline."
      });
      return faceResult;
    }
    const meshResult = cutWholeMeshByCutter();
    if (meshResult) {
      log(`Cut ${meshResult.cutter.name} through ${meshResult.targets.length} target mesh${meshResult.targets.length === 1 ? "" : "es"}.`, {
        removedTriangles: meshResult.removedTriangles,
        created: meshResult.created.map(mesh => mesh.name),
        note: "This whole-mesh mode removes the intersected chunk and extracts it as a new mesh."
      });
      return meshResult;
    }
    log("Close a line sketch first, or select a face plus one cutter mesh, then press Cut Hole.");
    return null;
  }
  const targetMesh = singleMeshTarget();
  if (!targetMesh) {
    log("Select one mesh first, then press Cut Hole.");
    return null;
  }
  const source = targetMesh.geometry.index ? targetMesh.geometry.toNonIndexed() : targetMesh.geometry.clone();
  const position = source.getAttribute("position");
  const uv = source.getAttribute("uv");
  const keptPositions = [];
  const keptUvs = [];
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(data.zAxis, data.center);
  const tolerance = Math.max(.02, Math.min(.18, Math.max(...data.contour.map(point => point.length())) * .025));
  let removed = 0;

  targetMesh.updateMatrixWorld(true);
  for (let i = 0; i < position.count; i += 3) {
    const localTri = [0, 1, 2].map(offset => new THREE.Vector3(
      position.getX(i + offset),
      position.getY(i + offset),
      position.getZ(i + offset)
    ));
    const worldTri = localTri.map(point => point.clone().applyMatrix4(targetMesh.matrixWorld));
    const centroid = triangleCenter(worldTri);
    const planeDistance = Math.max(...worldTri.map(point => Math.abs(plane.distanceToPoint(point))));
    const localToSketch = centroid.clone().sub(data.center);
    const sketchPoint = new THREE.Vector2(localToSketch.dot(data.xAxis), localToSketch.dot(data.yAxis));
    const inside = planeDistance <= tolerance && pointInPolygon2D(sketchPoint, data.contour);
    if (inside) {
      removed++;
      continue;
    }
    for (let offset = 0; offset < 3; offset++) {
      keptPositions.push(position.getX(i + offset), position.getY(i + offset), position.getZ(i + offset));
      if (uv) keptUvs.push(uv.getX(i + offset), uv.getY(i + offset));
    }
  }
  source.dispose();
  if (!removed) {
    log("The sketch did not cover any mesh triangles on the selected surface. Draw it tighter on the target face and try again.");
    return null;
  }
  recordHistory("cut hole from line sketch");
  const geometry = geometryFromPositions(keptPositions);
  if (keptUvs.length) geometry.setAttribute("uv", new THREE.Float32BufferAttribute(keptUvs, 2));
  replaceEditableMeshGeometry(targetMesh, geometry);
  clearSelectedTriangles();
  clearMarkers(targetMesh.userData.id);
  clearLineSketch({ silent: true, keepMode: false });
  updateAll();
  log(`Cut ${removed} triangle${removed === 1 ? "" : "s"} from ${targetMesh.name} using the line sketch.`, {
    note: "This first pass removes triangles fully inside the sketch loop."
  });
  return removed;
}

function updateFacePickHud() {
  els.facePickBtn.classList.toggle("active", facePickMode);
  els.faceRegionBtn.classList.toggle("active", coplanarFacePickMode);
  els.openingPickBtn?.classList.toggle("active", openingPickMode);
  els.areaTriBtn.classList.toggle("active", facePickMode && els.areaTriInput.checked);
  els.lineToolBtn?.classList.toggle("active", lineSketchMode);
  if (lineSketchMode) {
    els.hudText.textContent = lineSketchClosed
      ? "Line tool: closed loop ready | Make Face creates a patch | Fill Line creates a tube border | Cut Hole removes covered triangles from the selected mesh"
      : "Line tool: click to place sketch points on a locked plane | Click near the first point or press Close Line to finish";
    return;
  }
  lineSketchCursor.visible = false;
  if (openingPickMode) {
    els.hudText.textContent = "Opening mode: hover a hole edge and click to lock the opening Fill Hole should cap | Shift-click picks another opening without clearing triangle work";
    return;
  }
  els.hudText.textContent = facePickMode
    ? (surfaceComponentMode === "vertex"
      ? "Vertex mode: click the nearest corner | Shift/Ctrl adds vertices | use the X/Y/Z arrows to move"
      : surfaceComponentMode === "edge"
        ? "Edge mode: click near an edge | Shift/Ctrl adds edges | use the X/Y/Z arrows to move"
        : coplanarFacePickMode
      ? "Face mode: click a flat region to select connected coplanar triangles | Shift/Ctrl adds more | Double-click still selects full connected islands"
      : els.areaTriInput.checked
        ? "Area mode: drag a rectangle to select triangles | Double-click selects connected"
        : els.paintTriInput.checked
          ? "Paint mode: drag to select triangles | Hold Space to orbit camera"
          : "Triangle cursor: click a mesh triangle, double-click connected, then use Marker, Extend, Pull, or Bevel Face")
    : "Orbit: drag | Select: click | Multi-select: Shift/Ctrl+click | Transform: gizmo";
  if (!facePickMode && !selectedFace) faceMarker.visible = false;
  syncSurfaceEditorUi();
}

function setFacePickMode(enabled) {
  facePickMode = enabled;
  if (facePickMode) {
    lineSketchMode = false;
    openingPickMode = false;
  }
  updateFacePickHud();
}

function setCoplanarFacePickMode(enabled, { activatePicker = true } = {}) {
  coplanarFacePickMode = !!enabled;
  if (coplanarFacePickMode) {
    lineSketchMode = false;
    openingPickMode = false;
    els.paintTriInput.checked = false;
    els.areaTriInput.checked = false;
    if (activatePicker) facePickMode = true;
  }
  updateFacePickHud();
}

function setOpeningPickMode(enabled) {
  openingPickMode = !!enabled;
  if (openingPickMode) {
    lineSketchMode = false;
    coplanarFacePickMode = false;
    facePickMode = false;
    els.paintTriInput.checked = false;
    els.areaTriInput.checked = false;
  } else {
    clearSelectedHoleLoop();
  }
  updateOpeningPickGuide();
  updateFacePickHud();
}

function dominantAxis(vector) {
  const values = [Math.abs(vector.x), Math.abs(vector.y), Math.abs(vector.z)];
  return values.indexOf(Math.max(...values));
}

function faceBasisFromNormal(normal) {
  const axis = dominantAxis(normal);
  if (axis === 0) return { u: new THREE.Vector3(0, 1, 0), v: new THREE.Vector3(0, 0, 1), axis };
  if (axis === 1) return { u: new THREE.Vector3(1, 0, 0), v: new THREE.Vector3(0, 0, 1), axis };
  return { u: new THREE.Vector3(1, 0, 0), v: new THREE.Vector3(0, 1, 0), axis };
}

function triangleLocalPoints(hit) {
  const position = hit.object.geometry.getAttribute("position");
  return [hit.face.a, hit.face.b, hit.face.c].map(index => (
    new THREE.Vector3().fromBufferAttribute(position, index)
  ));
}

function triangleLocalUvs(hit) {
  const uv = hit.object.geometry.getAttribute("uv");
  if (!uv) return null;
  return [hit.face.a, hit.face.b, hit.face.c].map(index => (
    new THREE.Vector2().fromBufferAttribute(uv, index)
  ));
}

function worldTrianglePoints(face) {
  return face.localTrianglePoints.map(point => point.clone().applyMatrix4(face.mesh.matrixWorld));
}

function worldFaceNormal(face) {
  return face.localNormal.clone().transformDirection(face.mesh.matrixWorld).normalize();
}

function worldFacePoint(face) {
  return triangleCenter(worldTrianglePoints(face));
}

function triangleCenter(points) {
  return points.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / points.length);
}

function triangleSize(points, u, v, mesh) {
  const localPoints = points.map(point => mesh.worldToLocal(point.clone()));
  const us = localPoints.map(point => point.dot(u));
  const vs = localPoints.map(point => point.dot(v));
  return {
    width: Math.max(.05, Math.max(...us) - Math.min(...us)),
    height: Math.max(.05, Math.max(...vs) - Math.min(...vs))
  };
}

function triangleKey(mesh, faceIndex, points) {
  const coords = points.flatMap(point => point.toArray().map(value => round(value, 4))).join(",");
  return `${mesh.userData.id}:${coords}`;
}

function vertexKey(point) {
  return point.toArray().map(value => round(value, 4)).join(",");
}

function triangleSignature(points) {
  return points
    .map(vertexKey)
    .sort()
    .join("|");
}

function meshIntegrityReport(source) {
  const position = source?.getAttribute?.("position");
  const empty = {
    triangleCount: 0,
    vertexCount: 0,
    boundaryEdges: 0,
    nonManifoldEdges: 0,
    nonManifoldVertices: 0,
    degenerateTriangles: 0,
    duplicateTriangles: 0,
    windingConflicts: 0,
    closed: false,
    manifold: false,
    issues: []
  };
  if (!position || position.count < 3) return empty;

  const vertices = new Map();
  const edges = new Map();
  const triangleSignatures = new Map();
  const incidentTriangles = new Map();
  const validTriangles = [];
  const issues = [];
  const edgeSignature = (a, b) => [a, b].sort().join("|");
  const registerIncident = (key, triangleIndex) => {
    if (!incidentTriangles.has(key)) incidentTriangles.set(key, new Set());
    incidentTriangles.get(key).add(triangleIndex);
  };

  for (let offset = 0; offset + 2 < position.count; offset += 3) {
    const triangleIndex = offset / 3;
    const points = [0, 1, 2].map(index => new THREE.Vector3(
      position.getX(offset + index),
      position.getY(offset + index),
      position.getZ(offset + index)
    ));
    const keys = points.map(vertexKey);
    keys.forEach((key, index) => {
      if (!vertices.has(key)) vertices.set(key, points[index].clone());
    });
    const areaVector = new THREE.Vector3().crossVectors(
      points[1].clone().sub(points[0]),
      points[2].clone().sub(points[0])
    );
    const degenerate = new Set(keys).size < 3 || areaVector.lengthSq() <= 1e-12;
    if (degenerate) {
      issues.push({
        type: "degenerate-triangle",
        severity: "error",
        triangleIndex,
        points,
        label: `Degenerate triangle ${triangleIndex + 1}`
      });
      continue;
    }

    const signature = [...keys].sort().join("|");
    const firstTriangle = triangleSignatures.get(signature);
    if (Number.isInteger(firstTriangle)) {
      issues.push({
        type: "duplicate-triangle",
        severity: "error",
        triangleIndex,
        points,
        label: `Triangle ${triangleIndex + 1} duplicates triangle ${firstTriangle + 1}`
      });
    } else {
      triangleSignatures.set(signature, triangleIndex);
    }
    validTriangles[triangleIndex] = { keys, points, signature };
    keys.forEach(key => registerIncident(key, triangleIndex));
    for (const [fromIndex, toIndex] of [[0, 1], [1, 2], [2, 0]]) {
      const from = keys[fromIndex];
      const to = keys[toIndex];
      const edgeKey = edgeSignature(from, to);
      const entry = edges.get(edgeKey) || {
        signature: edgeKey,
        a: [from, to].sort()[0],
        b: [from, to].sort()[1],
        points: [vertices.get([from, to].sort()[0]).clone(), vertices.get([from, to].sort()[1]).clone()],
        uses: []
      };
      entry.uses.push({ from, to, triangleIndex, triangleSignature: signature });
      edges.set(edgeKey, entry);
    }
  }

  for (const entry of edges.values()) {
    if (entry.uses.length === 1) {
      issues.push({ type: "boundary-edge", severity: "warning", points: entry.points, label: "Open boundary edge" });
    } else if (entry.uses.length > 2) {
      issues.push({
        type: "non-manifold-edge",
        severity: "error",
        points: entry.points,
        label: `Non-manifold edge shared by ${entry.uses.length} triangles`
      });
    } else if (
      entry.uses.length === 2
      && entry.uses[0].from === entry.uses[1].from
      && entry.uses[0].triangleSignature !== entry.uses[1].triangleSignature
    ) {
      issues.push({ type: "winding-conflict", severity: "warning", points: entry.points, label: "Inconsistent triangle winding" });
    }
  }

  for (const [key, triangleSet] of incidentTriangles.entries()) {
    const triangleIndices = [...triangleSet];
    if (triangleIndices.length < 2) continue;
    const adjacency = new Map(triangleIndices.map(index => [index, new Set()]));
    for (const entry of edges.values()) {
      if (entry.a !== key && entry.b !== key) continue;
      const edgeTriangles = entry.uses.map(use => use.triangleIndex).filter(index => triangleSet.has(index));
      for (let a = 0; a < edgeTriangles.length; a++) {
        for (let b = a + 1; b < edgeTriangles.length; b++) {
          adjacency.get(edgeTriangles[a])?.add(edgeTriangles[b]);
          adjacency.get(edgeTriangles[b])?.add(edgeTriangles[a]);
        }
      }
    }
    let components = 0;
    const remaining = new Set(triangleIndices);
    while (remaining.size) {
      components++;
      const stack = [remaining.values().next().value];
      while (stack.length) {
        const current = stack.pop();
        if (!remaining.delete(current)) continue;
        for (const neighbor of adjacency.get(current) || []) if (remaining.has(neighbor)) stack.push(neighbor);
      }
    }
    if (components > 1) {
      issues.push({
        type: "non-manifold-vertex",
        severity: "error",
        points: [vertices.get(key).clone()],
        label: `Non-manifold vertex with ${components} disconnected surface fans`
      });
    }
  }

  const count = type => issues.filter(issue => issue.type === type).length;
  const report = {
    triangleCount: Math.floor(position.count / 3),
    vertexCount: vertices.size,
    boundaryEdges: count("boundary-edge"),
    nonManifoldEdges: count("non-manifold-edge"),
    nonManifoldVertices: count("non-manifold-vertex"),
    degenerateTriangles: count("degenerate-triangle"),
    duplicateTriangles: count("duplicate-triangle"),
    windingConflicts: count("winding-conflict"),
    issues
  };
  report.closed = report.boundaryEdges === 0;
  report.manifold = report.nonManifoldEdges === 0
    && report.nonManifoldVertices === 0
    && report.degenerateTriangles === 0
    && report.duplicateTriangles === 0;
  const priority = { "non-manifold-edge": 0, "non-manifold-vertex": 1, "degenerate-triangle": 2, "duplicate-triangle": 3, "winding-conflict": 4, "boundary-edge": 5 };
  report.issues.sort((a, b) => (priority[a.type] ?? 99) - (priority[b.type] ?? 99));
  return report;
}

function faceFromLocalTriangle(mesh, localTrianglePoints, faceIndex = null, localUvs = null) {
  const edgeA = localTrianglePoints[1].clone().sub(localTrianglePoints[0]);
  const edgeB = localTrianglePoints[2].clone().sub(localTrianglePoints[0]);
  const localNormal = new THREE.Vector3().crossVectors(edgeA, edgeB).normalize();
  const normalWorld = localNormal.clone().transformDirection(mesh.matrixWorld).normalize();
  const { u, v, axis } = faceBasisFromNormal(localNormal);
  const trianglePoints = localTrianglePoints.map(point => point.clone().applyMatrix4(mesh.matrixWorld));
  const { width, height } = triangleSize(trianglePoints, u, v, mesh);
  return {
    mesh,
    point: triangleCenter(trianglePoints),
    localPoint: triangleCenter(localTrianglePoints),
    hitPoint: triangleCenter(trianglePoints),
    normalWorld,
    localNormal,
    u,
    v,
    axis,
    width,
    height,
    trianglePoints,
    localTrianglePoints,
    localUvs,
    faceIndex,
    markerKey: triangleKey(mesh, faceIndex, localTrianglePoints)
  };
}

function meshTriangleFaces(mesh) {
  const source = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
  const position = source.getAttribute("position");
  const uv = source.getAttribute("uv");
  const faces = [];
  for (let i = 0; i < position.count; i += 3) {
    const localTrianglePoints = [0, 1, 2].map(offset => new THREE.Vector3(
      position.getX(i + offset),
      position.getY(i + offset),
      position.getZ(i + offset)
    ));
    const localUvs = uv ? [0, 1, 2].map(offset => new THREE.Vector2(
      uv.getX(i + offset),
      uv.getY(i + offset)
    )) : null;
    faces.push(faceFromLocalTriangle(mesh, localTrianglePoints, i / 3, localUvs));
  }
  if (source !== mesh.geometry) source.dispose();
  return faces;
}

function surfaceVertexKey(mesh, localPoint) {
  return `${mesh.userData.id}:${vertexKey(localPoint)}`;
}

function surfaceEdgeKey(mesh, localA, localB) {
  return `${mesh.userData.id}:${[vertexKey(localA), vertexKey(localB)].sort().join("|")}`;
}

function updateModelingEdgesOverlay() {
  while (modelingEdgesOverlay.children.length) {
    const child = modelingEdgesOverlay.children.pop();
    disposeObject3D(child);
  }
  const mesh = selected?.isMesh ? selected : (selectedSurfaceEdges[0]?.mesh || selectedSurfaceVertices[0]?.mesh || null);
  const shouldShow = !!(
    mesh?.geometry
    && mesh.visible
    && els.showModelingEdgesInput?.checked
    && !els.surfaceEditorWindow?.classList.contains("collapsed")
  );
  if (!shouldShow) {
    modelingEdgesOverlay.visible = false;
    return;
  }

  mesh.updateWorldMatrix(true, false);
  const source = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
  const position = source.getAttribute("position");
  const dissolvedEdges = new Set(mesh.userData.dissolvedSurfaceEdges || []);
  const uniqueEdges = new Map();
  for (let i = 0; i + 2 < position.count; i += 3) {
    const points = [0, 1, 2].map(offset => new THREE.Vector3(
      position.getX(i + offset),
      position.getY(i + offset),
      position.getZ(i + offset)
    ));
    for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) {
      const signature = localEdgeSignature(points[a], points[b]);
      if (!dissolvedEdges.has(signature) && !uniqueEdges.has(signature)) {
        uniqueEdges.set(signature, [points[a], points[b]]);
      }
    }
  }
  if (source !== mesh.geometry) source.dispose();

  const positions = [];
  for (const [localA, localB] of uniqueEdges.values()) {
    positions.push(
      ...localA.clone().applyMatrix4(mesh.matrixWorld).toArray(),
      ...localB.clone().applyMatrix4(mesh.matrixWorld).toArray()
    );
  }
  if (!positions.length) {
    modelingEdgesOverlay.visible = false;
    return;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const lines = new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({ color: "#62c7df", transparent: true, opacity: .48, depthTest: false, depthWrite: false })
  );
  lines.renderOrder = 1003;
  modelingEdgesOverlay.add(lines);
  modelingEdgesOverlay.visible = true;
}

function updateSurfaceComponentMarker() {
  while (surfaceComponentMarker.children.length) {
    const child = surfaceComponentMarker.children.pop();
    disposeObject3D(child);
  }
  if (surfaceComponentMode === "vertex") {
    for (const vertex of selectedSurfaceVertices) {
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(.045, 12, 8),
        new THREE.MeshBasicMaterial({ color: "#ffd36a", depthTest: false })
      );
      marker.position.copy(vertex.localPoint).applyMatrix4(vertex.mesh.matrixWorld);
      marker.renderOrder = 1005;
      surfaceComponentMarker.add(marker);
    }
  } else if (surfaceComponentMode === "edge") {
    const positions = [];
    const hasProtectedBevelEdge = selectedSurfaceEdges.some(edge =>
      (edge.mesh?.userData.edgeBevelProtectedEdges || []).includes(localEdgeSignature(edge.localA, edge.localB))
    );
    for (const edge of selectedSurfaceEdges) {
      positions.push(
        ...edge.localA.clone().applyMatrix4(edge.mesh.matrixWorld).toArray(),
        ...edge.localB.clone().applyMatrix4(edge.mesh.matrixWorld).toArray()
      );
    }
    if (positions.length) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      const marker = new THREE.LineSegments(
        geometry,
        new THREE.LineBasicMaterial({ color: hasProtectedBevelEdge ? "#ff5a5f" : "#ffd36a", depthTest: false })
      );
      marker.renderOrder = 1005;
      surfaceComponentMarker.add(marker);
    }
  }
  surfaceComponentMarker.visible = surfaceComponentMarker.children.length > 0;
  updateModelingEdgesOverlay();
}

function clearSelectedSurfaceComponents() {
  selectedSurfaceVertices.length = 0;
  selectedSurfaceEdges.length = 0;
  updateSurfaceComponentMarker();
}

function pickSurfaceVertex(hit, { append = false } = {}) {
  if (!hit?.object || !hit.face) return null;
  hit.object.updateWorldMatrix(true, false);
  const localPoints = triangleLocalPoints(hit);
  const localPoint = localPoints.reduce((best, point) => {
    const distance = point.clone().applyMatrix4(hit.object.matrixWorld).distanceToSquared(hit.point);
    return !best || distance < best.distance ? { point, distance } : best;
  }, null)?.point;
  if (!localPoint) return null;
  if (!append) selectedSurfaceVertices.length = 0;
  selectedSurfaceEdges.length = 0;
  selectedFaces.length = 0;
  selectedFace = null;
  updateFaceMarker();
  const key = surfaceVertexKey(hit.object, localPoint);
  const existingIndex = selectedSurfaceVertices.findIndex(vertex => vertex.key === key);
  if (existingIndex >= 0) selectedSurfaceVertices.splice(existingIndex, 1);
  else selectedSurfaceVertices.push({ mesh: hit.object, localPoint: localPoint.clone(), key });
  if (selected !== hit.object) selectObject(hit.object);
  updateSurfaceComponentMarker();
  updateState();
  armContextualSurfaceDrag();
  log(`${append ? "Updated" : "Selected"} vertex on ${hit.object.name}.`, { selected: selectedSurfaceVertices.length });
  return localPoint;
}

function pointToSegmentDistanceSquared(point, start, end) {
  return new THREE.Line3(start, end).closestPointToPoint(point, true, new THREE.Vector3()).distanceToSquared(point);
}

function pickSurfaceEdge(hit, { append = false } = {}) {
  if (!hit?.object || !hit.face) return null;
  hit.object.updateWorldMatrix(true, false);
  const localPoints = triangleLocalPoints(hit);
  const dissolvedEdges = new Set(hit.object.userData.dissolvedSurfaceEdges || []);
  const edges = [[0, 1], [1, 2], [2, 0]].map(([a, b]) => {
    const worldA = localPoints[a].clone().applyMatrix4(hit.object.matrixWorld);
    const worldB = localPoints[b].clone().applyMatrix4(hit.object.matrixWorld);
    return { localA: localPoints[a], localB: localPoints[b], distance: pointToSegmentDistanceSquared(hit.point, worldA, worldB) };
  }).filter(edge => !dissolvedEdges.has(localEdgeSignature(edge.localA, edge.localB)));
  if (!edges.length) {
    log(`The nearest triangle on ${hit.object.name} only contains dissolved modeling edges.`);
    return null;
  }
  edges.sort((a, b) => a.distance - b.distance);
  const picked = edges[0];
  if (!append) selectedSurfaceEdges.length = 0;
  selectedSurfaceVertices.length = 0;
  selectedFaces.length = 0;
  selectedFace = null;
  updateFaceMarker();
  const key = surfaceEdgeKey(hit.object, picked.localA, picked.localB);
  const protectedBevelEdge = (hit.object.userData.edgeBevelProtectedEdges || [])
    .includes(localEdgeSignature(picked.localA, picked.localB));
  const existingIndex = selectedSurfaceEdges.findIndex(edge => edge.key === key);
  if (existingIndex >= 0) selectedSurfaceEdges.splice(existingIndex, 1);
  else selectedSurfaceEdges.push({ mesh: hit.object, localA: picked.localA.clone(), localB: picked.localB.clone(), key, protectedBevelEdge });
  if (selected !== hit.object) selectObject(hit.object);
  updateSurfaceComponentMarker();
  updateState();
  armContextualSurfaceDrag();
  log(protectedBevelEdge
    ? `Selected a protected bevel edge on ${hit.object.name}. It is shown red; choose a yellow outer edge instead.`
    : `${append ? "Updated" : "Selected"} edge on ${hit.object.name}.`, { selected: selectedSurfaceEdges.length });
  return picked;
}

function pickSurfaceComponentFromHit(hit, options = {}) {
  if (surfaceComponentMode === "none") return false;
  if (surfaceComponentMode === "vertex") return pickSurfaceVertex(hit, options);
  if (surfaceComponentMode === "edge") return pickSurfaceEdge(hit, options);
  if (surfaceComponentMode === "face") return selectCoplanarFaceFromHit(hit, options);
  return pickFace(hit, options);
}

function setTriangleSelection(faces, { append = false } = {}) {
  clearSelectedSurfaceComponents();
  if (!append) selectedFaces.length = 0;
  for (const face of faces) {
    if (!selectedFaces.some(existing => existing.markerKey === face.markerKey)) selectedFaces.push(face);
  }
  selectedFace = selectedFaces.at(-1) || null;
  if (selectedFace) selectObject(selectedFace.mesh);
  updateFaceMarker();
  updateState();
  armContextualSurfaceDrag();
  return selectedFaces.length;
}

function makeTriangleGeometry(points, normalWorld, offset = .0015) {
  const positions = points.flatMap(point => point.clone().addScaledVector(normalWorld, offset).toArray());
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function clearSelectedTriangles() {
  selectedFaces.length = 0;
  selectedFace = null;
  updateFaceMarker();
  clearSelectedSurfaceComponents();
  if (dragPushMode) setDragPushMode(false, { silent: true });
  syncSurfaceEditorUi();
  updateSurfaceGizmoAttachment();
}

function clearTriangleSelection() {
  clearSelectedTriangles();
  const clearedHole = clearSelectedHoleLoop();
  log(clearedHole ? "Cleared selected triangles and locked opening." : "Cleared selected triangles.");
}

function deleteMarkersByTriangleSignatures(signaturesByMesh) {
  let removed = 0;
  for (let i = markerHelpers.length - 1; i >= 0; i--) {
    const marker = markerHelpers[i];
    const signatures = signaturesByMesh.get(marker.userData.targetId);
    if (!signatures) continue;
    const localTriangle = marker.userData.localTriangle.map(point => new THREE.Vector3(...point));
    if (signatures.has(triangleSignature(localTriangle))) {
      removeMarkerAt(i);
      removed++;
    }
  }
  return removed;
}

function transformUvPointAroundCenter(point, center, options = null) {
  options ||= {};
  let u = point.x - center.x;
  let v = point.y - center.y;
  const rotation = ((Number(options.rotation) || 0) % 360 + 360) % 360;
  if (rotation === 90) [u, v] = [-v, u];
  else if (rotation === 180) [u, v] = [-u, -v];
  else if (rotation === 270) [u, v] = [v, -u];
  if (options.flipU) u = -u;
  if (options.flipV) v = -v;
  return new THREE.Vector2(center.x + u, center.y + v);
}

function transformSelectedSurfaceUvs(options = {}) {
  if (!selectedFaces.length || !(surfaceComponentMode === "triangle" || surfaceComponentMode === "face")) {
    log("Choose Triangle or Whole Face and select a textured surface before editing its UVs.");
    return { editedMeshes: 0, editedTriangles: 0 };
  }

  const signaturesByMesh = new Map();
  for (const face of selectedFaces) {
    if (!signaturesByMesh.has(face.mesh)) signaturesByMesh.set(face.mesh, new Set());
    signaturesByMesh.get(face.mesh).add(triangleSignature(face.localTrianglePoints));
  }
  const editable = [...signaturesByMesh.entries()].filter(([mesh]) => mesh.geometry?.getAttribute("uv"));
  if (!editable.length) {
    log("The selected surface has no UV coordinates to rotate or flip.");
    return { editedMeshes: 0, editedTriangles: 0 };
  }

  recordHistory("transform selected surface UVs");
  let editedTriangles = 0;
  for (const [mesh, signatures] of editable) {
    const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    const position = geometry.getAttribute("position");
    const uv = geometry.getAttribute("uv");
    const selectedCorners = [];
    const selectedTriangleStarts = [];
    for (let index = 0; index + 2 < position.count; index += 3) {
      const points = [0, 1, 2].map(offset => new THREE.Vector3(
        position.getX(index + offset),
        position.getY(index + offset),
        position.getZ(index + offset)
      ));
      if (!signatures.has(triangleSignature(points))) continue;
      selectedTriangleStarts.push(index);
      for (let offset = 0; offset < 3; offset++) {
        selectedCorners.push(new THREE.Vector2(uv.getX(index + offset), uv.getY(index + offset)));
      }
    }
    if (!selectedCorners.length) {
      geometry.dispose();
      continue;
    }
    const center = new THREE.Box2().setFromPoints(selectedCorners).getCenter(new THREE.Vector2());
    for (const index of selectedTriangleStarts) {
      for (let offset = 0; offset < 3; offset++) {
        const transformed = transformUvPointAroundCenter(
          new THREE.Vector2(uv.getX(index + offset), uv.getY(index + offset)),
          center,
          options
        );
        uv.setXY(index + offset, transformed.x, transformed.y);
      }
      editedTriangles++;
    }
    uv.needsUpdate = true;
    replaceEditableMeshGeometry(mesh, geometry);
  }

  const refreshedFaces = [];
  for (const [mesh, signatures] of signaturesByMesh) {
    refreshedFaces.push(...meshTriangleFaces(mesh).filter(face => signatures.has(triangleSignature(face.localTrianglePoints))));
  }
  selectedFaces.splice(0, selectedFaces.length, ...refreshedFaces);
  selectedFace = selectedFaces.at(-1) || null;
  updateFaceMarker();
  updateAll();
  const action = options.flipU
    ? "Flipped selected UVs horizontally"
    : options.flipV
      ? "Flipped selected UVs vertically"
      : `Rotated selected UVs ${Math.abs(Number(options.rotation) || 0)} degrees ${Number(options.rotation) >= 0 ? "left" : "right"}`;
  log(`${action} on ${editedTriangles} triangle${editedTriangles === 1 ? "" : "s"}. Geometry and materials were unchanged.`, {
    editedMeshes: editable.length,
    editedTriangles,
    uvOnly: true
  });
  return { editedMeshes: editable.length, editedTriangles };
}

function deleteSelectedTriangles({ record = true, update = true, announce = true } = {}) {
  if (!selectedFaces.length) {
    log("Select a Triangle or Whole Face first, then press Delete Selected Face.");
    setFacePickMode(true);
    return { deleted: 0, editedMeshes: 0 };
  }
  if (record) recordHistory("delete selected triangles");
  const signaturesByMesh = new Map();
  for (const face of selectedFaces) {
    const id = face.mesh.userData.id;
    if (!signaturesByMesh.has(id)) signaturesByMesh.set(id, new Set());
    signaturesByMesh.get(id).add(triangleSignature(face.localTrianglePoints));
  }

  let deleted = 0;
  let editedMeshes = 0;
  for (const mesh of [...objects]) {
    const signatures = signaturesByMesh.get(mesh.userData.id);
    if (!signatures) continue;
    const source = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    const position = source.getAttribute("position");
    const uv = source.getAttribute("uv");
    const keptPositions = [];
    const keptUvs = [];
    let meshDeleted = 0;
    for (let i = 0; i < position.count; i += 3) {
      const tri = [0, 1, 2].map(offset => new THREE.Vector3(
        position.getX(i + offset),
        position.getY(i + offset),
        position.getZ(i + offset)
      ));
      if (signatures.has(triangleSignature(tri))) {
        meshDeleted++;
        continue;
      }
      for (let offset = 0; offset < 3; offset++) {
        keptPositions.push(position.getX(i + offset), position.getY(i + offset), position.getZ(i + offset));
        if (uv) keptUvs.push(uv.getX(i + offset), uv.getY(i + offset));
      }
    }
    source.dispose();
    if (!meshDeleted) continue;
    deleted += meshDeleted;
    editedMeshes++;
    if (!keptPositions.length) {
      removeObject(mesh, { record: false });
      continue;
    }
    const geometry = geometryFromPositions(keptPositions);
    if (keptUvs.length) geometry.setAttribute("uv", new THREE.Float32BufferAttribute(keptUvs, 2));
    mesh.geometry.dispose();
    mesh.geometry = geometry;
    mesh.userData.shape = "custom";
    mesh.userData.geometry = geometryToData(geometry);
    mesh.userData.bevel = null;
    mesh.userData.depth = null;
    mesh.userData.direction = null;
  }
  const removedMarkers = deleteMarkersByTriangleSignatures(signaturesByMesh);
  clearSelectedTriangles();
  if (update) updateAll();
  if (announce) log(`Deleted ${deleted} selected triangle${deleted === 1 ? "" : "s"} from ${editedMeshes} mesh${editedMeshes === 1 ? "" : "es"}.`, { removedMarkers });
  return { deleted, editedMeshes, removedMarkers };
}

function mirrorMeshAcrossWorldPlane(mesh, axis, center) {
  const index = axisIndex(axis);
  mesh.updateWorldMatrix(true, false);
  const previousWorldMatrix = mesh.matrixWorld.clone();
  const mirroredWorldPosition = mesh.getWorldPosition(new THREE.Vector3());
  setComponent(
    mirroredWorldPosition,
    index,
    component(center, index) * 2 - component(mirroredWorldPosition, index)
  );
  mesh.position.copy(mesh.parent ? mesh.parent.worldToLocal(mirroredWorldPosition.clone()) : mirroredWorldPosition);
  mesh.updateWorldMatrix(true, false);
  const mirroredWorldInverse = mesh.matrixWorld.clone().invert();
  const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  const position = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  const point = new THREE.Vector3();

  for (let i = 0; i < position.count; i++) {
    point.fromBufferAttribute(position, i).applyMatrix4(previousWorldMatrix);
    setComponent(point, index, component(center, index) * 2 - component(point, index));
    point.applyMatrix4(mirroredWorldInverse);
    position.setXYZ(i, point.x, point.y, point.z);
  }
  position.needsUpdate = true;

  for (let i = 0; i < position.count; i += 3) {
    swapAttributeVertices(position, i + 1, i + 2);
    swapAttributeVertices(uv, i + 1, i + 2);
  }

  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  mesh.geometry.dispose();
  mesh.geometry = geometry;
  mesh.userData.shape = "custom";
  mesh.userData.geometry = geometryToData(geometry);
  mesh.userData.bevel = null;
  mesh.userData.depth = null;
  mesh.userData.direction = null;
}

function makeSelectionMarker(face, index) {
  const trianglePoints = worldTrianglePoints(face);
  const normalWorld = worldFaceNormal(face);
  const marker = new THREE.Mesh(
    makeTriangleGeometry(trianglePoints, normalWorld, .0015),
    new THREE.MeshBasicMaterial({
      color: index === selectedFaces.length - 1 ? "#ffd36a" : "#e1b14b",
      transparent: true,
      opacity: .36,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    })
  );
  const linePoints = [...trianglePoints.map(point => point.clone().addScaledVector(normalWorld, .0025)), trianglePoints[0].clone().addScaledVector(normalWorld, .0025)];
  marker.add(new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(linePoints),
    new THREE.LineBasicMaterial({ color: "#15110a", transparent: true, opacity: .95, depthWrite: false })
  ));
  return marker;
}

function makeSelectionMarkerBatch(faces) {
  const fillPositions = [];
  const linePositions = [];
  faces.forEach(face => {
    const trianglePoints = worldTrianglePoints(face);
    const normalWorld = worldFaceNormal(face);
    const offsetPoints = trianglePoints.map(point => point.clone().addScaledVector(normalWorld, .0015));
    fillPositions.push(...offsetPoints.flatMap(point => point.toArray()));
    const linePoints = [
      offsetPoints[0], offsetPoints[1],
      offsetPoints[1], offsetPoints[2],
      offsetPoints[2], offsetPoints[0]
    ];
    linePositions.push(...linePoints.flatMap(point => point.clone().addScaledVector(normalWorld, .001).toArray()));
  });

  const group = new THREE.Group();
  const fillGeometry = new THREE.BufferGeometry();
  fillGeometry.setAttribute("position", new THREE.Float32BufferAttribute(fillPositions, 3));
  fillGeometry.computeBoundingSphere();
  group.add(new THREE.Mesh(
    fillGeometry,
    new THREE.MeshBasicMaterial({
      color: "#e1b14b",
      transparent: true,
      opacity: .34,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    })
  ));

  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute("position", new THREE.Float32BufferAttribute(linePositions, 3));
  lineGeometry.computeBoundingSphere();
  group.add(new THREE.LineSegments(
    lineGeometry,
    new THREE.LineBasicMaterial({ color: "#15110a", transparent: true, opacity: .95, depthWrite: false })
  ));
  return group;
}

function pickFace(hit, { append = false, toggleExisting = true, silent = false } = {}) {
  if (!hit?.object || !hit.face) return;
  const mesh = hit.object;
  const localTrianglePoints = triangleLocalPoints(hit);
  const pickedFace = faceFromLocalTriangle(mesh, localTrianglePoints, hit.faceIndex, triangleLocalUvs(hit));
  clearSelectedSurfaceComponents();
  pickedFace.hitPoint = hit.point.clone();
  if (!append) selectedFaces.length = 0;
  const existingIndex = selectedFaces.findIndex(face => face.markerKey === pickedFace.markerKey);
  if (existingIndex >= 0) {
    if (toggleExisting) selectedFaces.splice(existingIndex, 1);
  }
  else selectedFaces.push(pickedFace);
  selectedFace = selectedFaces.at(-1) || null;
  if (selected !== mesh) selectObject(mesh);
  updateFaceMarker();
  updateState();
  armContextualSurfaceDrag();
  if (!silent) log(`${append ? "Updated" : "Selected"} triangle selection on ${mesh.name}. Hold Shift or Ctrl to add/remove more.`, {
    selected: selectedFaces.length,
    triangle: hit.faceIndex,
    width: round(pickedFace.width),
    height: round(pickedFace.height)
  });
  return pickedFace;
}

function updateFaceMarker() {
  while (faceMarker.children.length) {
    const child = faceMarker.children.pop();
    disposeObject3D(child);
  }
  if (!selectedFaces.length) {
    faceMarker.visible = false;
    return;
  }
  faceMarker.add(makeSelectionMarkerBatch(selectedFaces));
  faceMarker.visible = true;
}

function clearOpeningPickGuide() {
  while (openingPickGuideGroup.children.length) {
    const child = openingPickGuideGroup.children.pop();
    disposeObject3D(child);
  }
  openingPickGuideGroup.visible = false;
}

function clearSelectedHoleLoop({ announce = false } = {}) {
  const hadSelection = !!selectedHoleLoopInfo;
  selectedHoleLoopInfo = null;
  hoveredHoleLoopInfo = null;
  updateOpeningPickGuide();
  if (announce && hadSelection) log("Cleared locked opening selection.");
  return hadSelection;
}

function visibleHoleLoopsForMesh(mesh) {
  if (!mesh || !mesh.visible || mesh.userData?.hidden) return [];
  return openingLoopDetailsForMesh(mesh).filter(loop => loop.points?.length >= 3);
}

function holeLoopKey(loop) {
  if (!loop) return "";
  if (loop.loopKey) return loop.loopKey;
  const edgeKeys = loop.edgeKeys?.length ? [...loop.edgeKeys].sort() : [];
  if (edgeKeys.length) return edgeKeys.join("||");
  return (loop.points || loop).map(vertexKey).sort().join("||");
}

function edgeDistanceToPointSquared(point, a, b) {
  const segment = b.clone().sub(a);
  const lengthSq = segment.lengthSq();
  if (lengthSq <= 1e-8) return point.distanceToSquared(a);
  const t = THREE.MathUtils.clamp(point.clone().sub(a).dot(segment) / lengthSq, 0, 1);
  const closest = a.clone().addScaledVector(segment, t);
  return point.distanceToSquared(closest);
}

function closestHoleLoopToHit(mesh, hit, loops = null) {
  const candidates = loops || visibleHoleLoopsForMesh(mesh);
  if (!mesh || !hit?.point || !candidates.length) return null;
  let best = null;
  candidates.forEach(loop => {
    const points = loop.points || loop;
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      const distanceSq = edgeDistanceToPointSquared(hit.point, a, b);
      if (!best || distanceSq < best.distanceSq) {
        best = { loop, distanceSq, edgeIndex: i };
      }
    }
  });
  return best;
}

function openingPickCandidateForPoint(point, preferredMesh = null, fallbackMesh = null) {
  if (!point) return null;
  const meshes = [];
  if (preferredMesh) meshes.push(preferredMesh);
  if (fallbackMesh && fallbackMesh !== preferredMesh) meshes.push(fallbackMesh);
  objects.forEach(mesh => {
    if (mesh !== preferredMesh && mesh !== fallbackMesh && mesh.visible && !mesh.userData?.hidden) meshes.push(mesh);
  });

  let best = null;
  for (const mesh of meshes) {
    const loops = visibleHoleLoopsForMesh(mesh);
    if (!loops.length) continue;
    const probeHit = { point, object: mesh };
    const closest = closestHoleLoopToHit(mesh, probeHit, loops);
    if (!closest?.loop) continue;
    const penalty = mesh === preferredMesh ? 0 : mesh === fallbackMesh ? 1e-4 : 1e-3;
    const score = closest.distanceSq + penalty;
    if (!best || score < best.score) {
      best = {
        mesh,
        loop: closest.loop,
        edgeIndex: closest.edgeIndex,
        distanceSq: closest.distanceSq,
        score
      };
    }
  }
  return best;
}

function openingPickCandidateFromEvent(event) {
  const preferredMesh = singleMeshTarget();
  const hits = hitsFromPointerEvent(event);
  let best = null;
  hits.forEach(hit => {
    const candidate = openingPickCandidateForPoint(hit.point, preferredMesh, hit.object || null);
    if (!candidate) return;
    if (!best || candidate.score < best.score) best = candidate;
  });
  if (best) return best;
  if (preferredMesh && hits[0]?.point) return openingPickCandidateForPoint(hits[0].point, preferredMesh, null);
  return null;
}

function updateOpeningPickGuide() {
  clearOpeningPickGuide();
  const info = hoveredHoleLoopInfo || selectedHoleLoopInfo;
  if (!info?.loop?.points?.length) return;
  const linePoints = info.loop.points.map(point => point.clone());
  linePoints.push(info.loop.points[0].clone());
  openingPickGuideGroup.add(new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(linePoints),
    new THREE.LineBasicMaterial({
      color: hoveredHoleLoopInfo ? "#4db1ff" : "#2d7cff",
      transparent: true,
      opacity: 1,
      depthWrite: false
    })
  ));
  if (Number.isInteger(info.edgeIndex)) {
    const a = info.loop.points[info.edgeIndex];
    const b = info.loop.points[(info.edgeIndex + 1) % info.loop.points.length];
    openingPickGuideGroup.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([a.clone(), b.clone()]),
      new THREE.LineBasicMaterial({
        color: "#ffffff",
        transparent: true,
        opacity: 1,
        depthWrite: false
      })
    ));
  }
  openingPickGuideGroup.visible = true;
}

function disposeObject3D(object) {
  object.traverse(child => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) child.material.dispose();
  });
}

function removeMarkerAt(index) {
  const marker = markerHelpers[index];
  if (!marker) return null;
  markerGroup.remove(marker);
  markerHelpers.splice(index, 1);
  disposeObject3D(marker);
  return marker;
}

function clearMarkers(targetId = null) {
  for (let i = markerHelpers.length - 1; i >= 0; i--) {
    if (!targetId || markerHelpers[i].userData.targetId === targetId) removeMarkerAt(i);
  }
}

function addMarkerFromSelectedTriangle() {
  if (!selectedFaces.length) {
    log("Select one or more mesh triangles first, then press Marker.");
    setFacePickMode(true);
    return null;
  }
  let added = 0;
  let removed = 0;
  for (const face of [...selectedFaces]) {
    const result = toggleMarkerForFace(face);
    if (result === "added") added++;
    if (result === "removed") removed++;
  }
  log(`Marker update complete.`, { added, removed, selectedTriangles: selectedFaces.length });
  return { added, removed };
}

function removeMarkersForSelection() {
  if (!markerHelpers.length) {
    log("No triangle markers to remove.");
    return 0;
  }
  if (!selectedFaces.length) {
    const count = markerHelpers.length;
    clearMarkers();
    updateAll();
    log(`Removed all ${count} triangle marker${count === 1 ? "" : "s"}.`);
    return count;
  }
  const selectedKeys = new Set(selectedFaces.map(face => face.markerKey));
  let removed = 0;
  for (let i = markerHelpers.length - 1; i >= 0; i--) {
    if (selectedKeys.has(markerHelpers[i].userData.markerKey)) {
      removeMarkerAt(i);
      removed++;
    }
  }
  updateAll();
  log(`Removed ${removed} marker${removed === 1 ? "" : "s"} from selected triangles.`);
  return removed;
}

function makeTrianglePatchSpec(faces, { name = "copied triangle patch", offset = new THREE.Vector3() } = {}) {
  const worldPositions = [];
  const patchUvs = [];
  for (const face of faces) {
    const points = worldTrianglePoints(face).map(vecArray);
    const uvs = face.localUvs?.length === 3 ? face.localUvs : null;
    const order = [0, 1, 2, 0, 2, 1];
    for (const index of order) {
      worldPositions.push(...points[index]);
      if (uvs) patchUvs.push(uvs[index].x, uvs[index].y);
    }
  }
  const points = [];
  for (let i = 0; i < worldPositions.length; i += 3) points.push(new THREE.Vector3(worldPositions[i], worldPositions[i + 1], worldPositions[i + 2]));
  const center = new THREE.Box3().setFromPoints(points).getCenter(new THREE.Vector3()).add(offset);
  const localPositions = points.flatMap(point => vecArray(point.sub(center)));
  const geometry = geometryFromPositions(localPositions);
  if (patchUvs.length === localPositions.length / 3 * 2) geometry.setAttribute("uv", new THREE.Float32BufferAttribute(patchUvs, 2));
  const firstMesh = faces[0].mesh;
  const spec = {
    shape: "custom",
    geometry: geometryToData(geometry),
    name,
    position: center.toArray().map(round),
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    color: `#${firstMesh.material.color.getHexString()}`,
    roughness: firstMesh.material.roughness,
    textureUrl: firstMesh.userData.textureUrl || null,
    textureName: firstMesh.userData.textureName || null,
    textureFlipY: firstMesh.userData.textureFlipY ?? true,
    textureRotation: normalizeTextureRotation(firstMesh.userData.textureRotation || 0)
  };
  geometry.dispose();
  return spec;
}

function copySelectedTriangles() {
  if (!selectedFaces.length) {
    log("Select one or more mesh triangles first, then press Copy Tri.");
    setFacePickMode(true);
    return null;
  }
  copiedTrianglePatch = {
    spec: makeTrianglePatchSpec(selectedFaces, { name: "copied triangle patch" }),
    count: selectedFaces.length,
    pasteCount: 0
  };
  log(`Copied ${selectedFaces.length} selected triangle${selectedFaces.length === 1 ? "" : "s"} as a patch.`);
  return copiedTrianglePatch;
}

function extractSelectedTriangles() {
  if (!selectedFaces.length) {
    log("Select one or more mesh triangles first, then press Extract Tri.");
    setFacePickMode(true);
    return null;
  }
  const count = selectedFaces.length;
  const sourceNames = [...new Set(selectedFaces.map(face => face.mesh.name))];
  recordHistory("extract selected triangles");
  const extracted = addObject(makeTrianglePatchSpec(selectedFaces, { name: `${sourceNames[0]} extracted mesh` }), { record: false });
  const result = deleteSelectedTriangles({ record: false, update: false, announce: false });
  selectObject(extracted);
  updateAll();
  log(`Extracted ${count} selected triangle${count === 1 ? "" : "s"} into ${extracted.name}.`, {
    sourceMeshes: sourceNames.length,
    removedFromSource: result.deleted
  });
  return extracted;
}

function pasteCopiedTriangles() {
  if (!copiedTrianglePatch) {
    log("Copy selected triangles first, then press Paste Tri.");
    return null;
  }
  copiedTrianglePatch.pasteCount++;
  const spec = JSON.parse(JSON.stringify(copiedTrianglePatch.spec));
  spec.name = `${spec.name} ${copiedTrianglePatch.pasteCount}`;
  const offset = copiedTrianglePatch.pasteCount * .25;
  spec.position = [
    round((spec.position?.[0] || 0) + offset),
    round((spec.position?.[1] || 0) + offset * .35),
    round((spec.position?.[2] || 0) + offset)
  ];
  const mesh = addObject(spec);
  log(`Pasted copied triangle patch as ${mesh.name}.`, { triangles: copiedTrianglePatch.count });
  return mesh;
}

function boundaryLoopsFromWorldTriangles(triangles) {
  const vertexPoints = new Map();
  const edgeMap = new Map();

  const addEdge = (a, b) => {
    const key = [a, b].sort().join("|");
    const entry = edgeMap.get(key) || { count: 0, a, b };
    entry.count += 1;
    edgeMap.set(key, entry);
  };

  for (const triangle of triangles) {
    const keys = triangle.map(point => {
      const key = vertexKey(point);
      if (!vertexPoints.has(key)) vertexPoints.set(key, point.clone());
      return key;
    });
    addEdge(keys[0], keys[1]);
    addEdge(keys[1], keys[2]);
    addEdge(keys[2], keys[0]);
  }

  const boundaryEdges = [...edgeMap.values()].filter(edge => edge.count === 1);
  const adjacency = new Map();
  for (const edge of boundaryEdges) {
    if (!adjacency.has(edge.a)) adjacency.set(edge.a, new Set());
    if (!adjacency.has(edge.b)) adjacency.set(edge.b, new Set());
    adjacency.get(edge.a).add(edge.b);
    adjacency.get(edge.b).add(edge.a);
  }

  const unused = new Set(boundaryEdges.map(edge => [edge.a, edge.b].sort().join("|")));
  const loops = [];
  const edgeKey = (a, b) => [a, b].sort().join("|");

  while (unused.size) {
    const first = unused.values().next().value;
    const [start, nextStart] = first.split("|");
    const loop = [start];
    let previous = start;
    let current = nextStart;
    let guard = 0;

    while (guard++ < 10000) {
      loop.push(current);
      unused.delete(edgeKey(previous, current));
      if (current === start) break;
      const neighbors = [...(adjacency.get(current) || [])].filter(key => key !== previous);
      const next = neighbors.find(key => unused.has(edgeKey(current, key))) || neighbors[0];
      if (!next) break;
      previous = current;
      current = next;
    }

    const unique = loop.at(-1) === loop[0] ? loop.slice(0, -1) : loop;
    if (unique.length >= 3) {
      loops.push(unique.map(key => vertexPoints.get(key).clone()));
    }
  }

  return loops;
}

function boundaryLoopsForMesh(mesh) {
  return boundaryLoopDetailsForMesh(mesh).map(loop => loop.points);
}

function meshEdgeTopology(mesh) {
  const source = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
  const position = source.getAttribute("position");
  const triangles = [];
  const triangleNormals = [];
  const vertexPoints = new Map();
  const edgeData = new Map();
  const edgeKey = (a, b) => [a, b].sort().join("|");
  mesh.updateMatrixWorld(true);
  for (let i = 0; i < position.count; i += 3) {
    const triangle = [0, 1, 2].map(offset => new THREE.Vector3(
      position.getX(i + offset),
      position.getY(i + offset),
      position.getZ(i + offset)
    ).applyMatrix4(mesh.matrixWorld));
    const triangleIndex = triangles.length;
    triangles.push(triangle);
    triangleNormals.push(
      new THREE.Vector3().crossVectors(
        triangle[1].clone().sub(triangle[0]),
        triangle[2].clone().sub(triangle[0])
      ).normalize()
    );
    const keys = triangle.map(point => {
      const key = vertexKey(point);
      if (!vertexPoints.has(key)) vertexPoints.set(key, point.clone());
      return key;
    });
    [[0, 1], [1, 2], [2, 0]].forEach(([aIndex, bIndex]) => {
      const a = keys[aIndex];
      const b = keys[bIndex];
      const key = edgeKey(a, b);
      const entry = edgeData.get(key) || {
        a,
        b,
        count: 0,
        triangleIndices: new Set()
      };
      entry.count += 1;
      entry.triangleIndices.add(triangleIndex);
      edgeData.set(key, entry);
    });
  }
  if (source !== mesh.geometry) source.dispose();
  return { triangles, triangleNormals, vertexPoints, edgeData, edgeKey };
}

function loopDetailsFromEdgeEntries(candidateEdges, vertexPoints, edgeData, edgeKey) {
  if (!candidateEdges.length) return [];
  const adjacency = new Map();
  candidateEdges.forEach(([, entry]) => {
    if (!adjacency.has(entry.a)) adjacency.set(entry.a, new Set());
    if (!adjacency.has(entry.b)) adjacency.set(entry.b, new Set());
    adjacency.get(entry.a).add(entry.b);
    adjacency.get(entry.b).add(entry.a);
  });

  const simpleCycleEdges = candidateEdges.filter(([, entry]) =>
    (adjacency.get(entry.a)?.size || 0) === 2
    && (adjacency.get(entry.b)?.size || 0) === 2
  );
  if (!simpleCycleEdges.length) return [];

  const unused = new Set(simpleCycleEdges.map(([key]) => key));
  const loops = [];
  while (unused.size) {
    const firstKey = unused.values().next().value;
    const first = edgeData.get(firstKey);
    if (!first) {
      unused.delete(firstKey);
      continue;
    }
    const loopKeys = [first.a];
    const loopEdgeKeys = [];
    const loopTriangleIndices = new Set();
    let previous = first.a;
    let current = first.b;
    let guard = 0;

    while (guard++ < 10000) {
      loopKeys.push(current);
      const currentEdgeKey = edgeKey(previous, current);
      if (unused.has(currentEdgeKey)) {
        unused.delete(currentEdgeKey);
        loopEdgeKeys.push(currentEdgeKey);
        edgeData.get(currentEdgeKey)?.triangleIndices?.forEach(index => loopTriangleIndices.add(index));
      }
      if (current === first.a) break;
      const neighbors = [...(adjacency.get(current) || [])].filter(key => key !== previous);
      const next = neighbors.find(key => unused.has(edgeKey(current, key))) || neighbors[0];
      if (!next) break;
      previous = current;
      current = next;
    }

    const uniqueKeys = loopKeys.at(-1) === loopKeys[0] ? loopKeys.slice(0, -1) : loopKeys;
    if (uniqueKeys.length >= 3) {
      loops.push({
        points: uniqueKeys.map(key => vertexPoints.get(key).clone()),
        vertexKeys: uniqueKeys,
        edgeKeys: loopEdgeKeys,
        triangleIndices: [...loopTriangleIndices],
        loopKey: loopEdgeKeys.slice().sort().join("||")
      });
    }
  }
  return loops;
}

function boundaryLoopDetailsForMesh(mesh) {
  const { vertexPoints, edgeData, edgeKey } = meshEdgeTopology(mesh);
  const boundaryEdges = [...edgeData.entries()].filter(([, entry]) => entry.count === 1);
  return loopDetailsFromEdgeEntries(boundaryEdges, vertexPoints, edgeData, edgeKey);
}

function bridgeBoundaryTopology(source) {
  const position = source.getAttribute("position");
  const uv = source.getAttribute("uv");
  const color = source.getAttribute("color");
  const vertices = new Map();
  const edgeData = new Map();
  const registerVertex = index => {
    const point = new THREE.Vector3(position.getX(index), position.getY(index), position.getZ(index));
    const key = vertexKey(point);
    if (!vertices.has(key)) {
      vertices.set(key, {
        point,
        uv: uv ? new THREE.Vector2(uv.getX(index), uv.getY(index)) : null,
        color: color ? new THREE.Color(color.getX(index), color.getY(index), color.getZ(index)) : null
      });
    }
    return { key, point, uv: uv ? new THREE.Vector2(uv.getX(index), uv.getY(index)) : null };
  };
  const registerEdge = (from, to) => {
    const signature = [from.key, to.key].sort().join("|");
    const entry = edgeData.get(signature) || {
      signature,
      a: [from.key, to.key].sort()[0],
      b: [from.key, to.key].sort()[1],
      count: 0,
      direction: null
    };
    entry.count++;
    if (entry.count === 1) {
      entry.direction = { from: from.key, to: to.key, fromUv: from.uv?.clone() || null, toUv: to.uv?.clone() || null };
    }
    edgeData.set(signature, entry);
  };

  for (let index = 0; index + 2 < position.count; index += 3) {
    const triangle = [registerVertex(index), registerVertex(index + 1), registerVertex(index + 2)];
    registerEdge(triangle[0], triangle[1]);
    registerEdge(triangle[1], triangle[2]);
    registerEdge(triangle[2], triangle[0]);
  }

  const boundaryEntries = [...edgeData.values()].filter(entry => entry.count === 1);
  const adjacency = new Map();
  const boundaryUvs = new Map();
  for (const entry of boundaryEntries) {
    if (!adjacency.has(entry.a)) adjacency.set(entry.a, new Set());
    if (!adjacency.has(entry.b)) adjacency.set(entry.b, new Set());
    adjacency.get(entry.a).add(entry.b);
    adjacency.get(entry.b).add(entry.a);
    if (entry.direction?.fromUv && !boundaryUvs.has(entry.direction.from)) boundaryUvs.set(entry.direction.from, entry.direction.fromUv.clone());
    if (entry.direction?.toUv && !boundaryUvs.has(entry.direction.to)) boundaryUvs.set(entry.direction.to, entry.direction.toUv.clone());
  }

  const usableEntries = boundaryEntries.filter(entry =>
    adjacency.get(entry.a)?.size === 2 && adjacency.get(entry.b)?.size === 2
  );
  const unused = new Set(usableEntries.map(entry => entry.signature));
  const loops = [];
  while (unused.size) {
    const firstSignature = unused.values().next().value;
    const first = edgeData.get(firstSignature);
    if (!first) {
      unused.delete(firstSignature);
      continue;
    }
    const keys = [first.a];
    const edgeSignatures = [];
    let previous = first.a;
    let current = first.b;
    let closed = false;
    let guard = 0;
    while (guard++ < 10000) {
      keys.push(current);
      const signature = [previous, current].sort().join("|");
      unused.delete(signature);
      edgeSignatures.push(signature);
      if (current === keys[0]) {
        closed = true;
        break;
      }
      const next = [...(adjacency.get(current) || [])]
        .filter(key => key !== previous)
        .find(key => unused.has([current, key].sort().join("|")));
      if (!next) break;
      previous = current;
      current = next;
    }
    if (!closed) continue;
    let orderedKeys = keys.slice(0, -1);
    const directionMatches = orderedKeys.reduce((count, key, index) => {
      const nextKey = orderedKeys[(index + 1) % orderedKeys.length];
      const entry = edgeData.get([key, nextKey].sort().join("|"));
      return count + (entry?.direction?.from === key && entry.direction.to === nextKey ? 1 : 0);
    }, 0);
    if (directionMatches < orderedKeys.length / 2) orderedKeys = orderedKeys.slice().reverse();
    loops.push({
      keys: orderedKeys,
      points: orderedKeys.map(key => vertices.get(key).point.clone()),
      uvs: orderedKeys.map(key => boundaryUvs.get(key)?.clone() || vertices.get(key).uv?.clone() || null),
      colors: orderedKeys.map(key => vertices.get(key).color?.clone() || null),
      edgeSignatures: new Set(edgeSignatures)
    });
  }
  return { loops, edgeData, boundaryEdgeCount: boundaryEntries.length };
}

function alignBridgeBoundaryLoops(loopA, loopB) {
  const reversedB = {
    ...loopB,
    keys: loopB.keys.slice().reverse(),
    points: loopB.points.slice().reverse(),
    uvs: loopB.uvs.slice().reverse(),
    colors: loopB.colors.slice().reverse()
  };
  let bestOffset = 0;
  let bestDistance = Infinity;
  for (let offset = 0; offset < loopA.points.length; offset++) {
    let distance = 0;
    for (let index = 0; index < loopA.points.length; index++) {
      distance += loopA.points[index].distanceToSquared(reversedB.points[(index + offset) % reversedB.points.length]);
    }
    if (distance < bestDistance) {
      bestDistance = distance;
      bestOffset = offset;
    }
  }
  const rotate = values => values.map((_, index) => values[(index + bestOffset) % values.length]);
  return {
    loopA,
    loopB: {
      ...reversedB,
      keys: rotate(reversedB.keys),
      points: rotate(reversedB.points),
      uvs: rotate(reversedB.uvs),
      colors: rotate(reversedB.colors)
    },
    offset: bestOffset,
    distance: bestDistance
  };
}

function bridgeSelectedEdgeLoops() {
  if (selectedSurfaceEdges.length < 2) {
    log("Bridge Edge Loops needs one selected boundary edge on each of two open loops. Hold Shift or Ctrl for the second edge.");
    return null;
  }
  const meshes = [...new Set(selectedSurfaceEdges.map(edge => edge.mesh).filter(Boolean))];
  if (meshes.length !== 1) {
    log("Bridge Edge Loops works inside one mesh. Select both boundary edges on the same mesh.");
    return null;
  }
  const mesh = meshes[0];
  if (!mesh?.geometry) {
    log("The selected boundary edges do not belong to an editable mesh.");
    return null;
  }

  const source = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  const topology = bridgeBoundaryTopology(source);
  const matchedLoops = [];
  for (const selectedEdge of selectedSurfaceEdges) {
    const signature = localEdgeSignature(selectedEdge.localA, selectedEdge.localB);
    const loop = topology.loops.find(candidate => candidate.edgeSignatures.has(signature));
    if (loop && !matchedLoops.includes(loop)) matchedLoops.push(loop);
  }
  if (matchedLoops.length !== 2) {
    source.dispose();
    log(matchedLoops.length < 2
      ? "Select one outer edge from each of two complete open boundary loops. Internal yellow lines cannot be bridged."
      : "The current selection touches more than two open loops. Leave one boundary edge selected on each loop.", {
        selectedEdges: selectedSurfaceEdges.length,
        matchedOpenLoops: matchedLoops.length
      });
    return null;
  }
  if (matchedLoops[0].points.length !== matchedLoops[1].points.length) {
    const counts = matchedLoops.map(loop => loop.points.length);
    source.dispose();
    log(`Bridge Edge Loops currently needs equal vertex counts. These loops have ${counts[0]} and ${counts[1]} vertices.`, { loopVertices: counts });
    return null;
  }

  const aligned = alignBridgeBoundaryLoops(matchedLoops[0], matchedLoops[1]);
  const position = source.getAttribute("position");
  const uv = source.getAttribute("uv");
  const color = source.getAttribute("color");
  const positions = [];
  const uvs = [];
  const colors = [];
  for (let index = 0; index < position.count; index++) {
    positions.push(position.getX(index), position.getY(index), position.getZ(index));
    if (uv) uvs.push(uv.getX(index), uv.getY(index));
    if (color) colors.push(color.getX(index), color.getY(index), color.getZ(index));
  }

  const bridgeTriangles = [];
  const appendBridgeTriangle = (pointEntries, fallbackUvs) => {
    const trianglePoints = pointEntries.map(entry => entry.point);
    const area = new THREE.Vector3().crossVectors(
      trianglePoints[1].clone().sub(trianglePoints[0]),
      trianglePoints[2].clone().sub(trianglePoints[0])
    ).lengthSq();
    if (area <= 1e-12) return false;
    positions.push(...trianglePoints.flatMap(point => point.toArray()));
    if (uv) {
      pointEntries.forEach((entry, index) => {
        const nextUv = entry.uv || fallbackUvs[index];
        uvs.push(nextUv.x, nextUv.y);
      });
    }
    if (color) {
      pointEntries.forEach(entry => {
        const nextColor = entry.color || new THREE.Color(1, 1, 1);
        colors.push(nextColor.r, nextColor.g, nextColor.b);
      });
    }
    bridgeTriangles.push(trianglePoints.map(vertexKey));
    return true;
  };

  const loopA = aligned.loopA;
  const loopB = aligned.loopB;
  const bridgeCount = loopA.points.length;
  let createdTriangles = 0;
  for (let index = 0; index < bridgeCount; index++) {
    const next = (index + 1) % bridgeCount;
    const a = { point: loopA.points[index], uv: loopA.uvs[index], color: loopA.colors[index] };
    const aNext = { point: loopA.points[next], uv: loopA.uvs[next], color: loopA.colors[next] };
    const b = { point: loopB.points[index], uv: loopB.uvs[index], color: loopB.colors[index] };
    const bNext = { point: loopB.points[next], uv: loopB.uvs[next], color: loopB.colors[next] };
    const u0 = index / bridgeCount;
    const u1 = next === 0 ? 1 : next / bridgeCount;
    createdTriangles += appendBridgeTriangle([a, b, aNext], [
      new THREE.Vector2(u0, 0), new THREE.Vector2(u0, 1), new THREE.Vector2(u1, 0)
    ]) ? 1 : 0;
    createdTriangles += appendBridgeTriangle([aNext, b, bNext], [
      new THREE.Vector2(u1, 0), new THREE.Vector2(u0, 1), new THREE.Vector2(u1, 1)
    ]) ? 1 : 0;
  }
  if (createdTriangles !== bridgeCount * 2) {
    source.dispose();
    log("Bridge Edge Loops found overlapping or zero-length loop segments, so the mesh was left unchanged.");
    return null;
  }

  const sourceTriangles = [];
  for (let index = 0; index + 2 < position.count; index += 3) {
    sourceTriangles.push([0, 1, 2].map(offset => vertexKey(new THREE.Vector3(
      position.getX(index + offset), position.getY(index + offset), position.getZ(index + offset)
    ))));
  }
  const resultEdgeCounts = topologyEdgeCounts([...sourceTriangles, ...bridgeTriangles]);
  const nonManifoldEdges = [...resultEdgeCounts.values()].filter(count => count > 2).length;
  if (nonManifoldEdges) {
    source.dispose();
    log("Bridge Edge Loops would create non-manifold topology, so the mesh was left unchanged.", { nonManifoldEdges });
    return null;
  }

  const geometry = geometryFromPositions(positions);
  if (uv) geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  if (color) geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeBoundingBox();
  source.dispose();
  recordHistory("bridge edge loops");
  replaceEditableMeshGeometry(mesh, geometry);
  selectedFaces.length = 0;
  selectedFace = null;
  selectedSurfaceVertices.length = 0;
  selectedSurfaceEdges.length = 0;
  for (let index = 0; index < bridgeCount; index++) {
    selectedSurfaceEdges.push({
      mesh,
      localA: loopA.points[index].clone(),
      localB: loopB.points[index].clone(),
      key: surfaceEdgeKey(mesh, loopA.points[index], loopB.points[index]),
      protectedBevelEdge: false
    });
  }
  updateFaceMarker();
  updateSurfaceComponentMarker();
  updateAll();
  syncSurfaceEditorUi();
  updateSurfaceGizmoAttachment();
  const remainingBoundaryEdges = [...resultEdgeCounts.values()].filter(count => count === 1).length;
  log(`Bridged two ${bridgeCount}-vertex edge loops with ${bridgeCount} quads inside ${mesh.name}. New bridge edges remain selected.`, {
    createdTriangles,
    beforeBoundaryEdges: topology.boundaryEdgeCount,
    remainingBoundaryEdges,
    uvExtended: !!uv,
    undoReady: true
  });
  return mesh;
}

function holeRepairLoopKey(loop) {
  return [...(loop?.edgeSignatures || [])].sort().join("||");
}

function holeRepairWorldLoop(mesh, loop) {
  mesh.updateMatrixWorld(true);
  return {
    points: loop.points.map(point => point.clone().applyMatrix4(mesh.matrixWorld)),
    loopKey: holeRepairLoopKey(loop)
  };
}

function syncHoleRepairUi() {
  if (!els?.holeRepairStatus) return;
  const count = holeRepairState.loops.length;
  const active = count > 0 && holeRepairState.index >= 0;
  const current = active ? holeRepairState.loops[holeRepairState.index] : null;
  if (active) {
    els.holeRepairStatus.textContent = `Hole ${holeRepairState.index + 1} of ${count} — ${current.points.length} boundary vertices.`;
  } else if (holeRepairState.meshId) {
    els.holeRepairStatus.textContent = "Closed mesh — 0 holes found.";
  } else {
    els.holeRepairStatus.textContent = "Select one editable mesh, then scan for true open boundary loops.";
  }
  if (els.previousHoleBtn) els.previousHoleBtn.disabled = count < 2;
  if (els.nextHoleBtn) els.nextHoleBtn.disabled = count < 2;
  if (els.frameHoleBtn) els.frameHoleBtn.disabled = !active;
  if (els.repairSelectedHoleBtn) els.repairSelectedHoleBtn.disabled = !active;
  if (els.repairAllHolesBtn) els.repairAllHolesBtn.disabled = !active;
}

function selectRepairHole(mesh, index, { announce = false } = {}) {
  if (!mesh || !holeRepairState.loops.length) return null;
  const count = holeRepairState.loops.length;
  holeRepairState.index = ((index % count) + count) % count;
  const loop = holeRepairState.loops[holeRepairState.index];
  setSelectedHoleLoop(mesh, holeRepairWorldLoop(mesh, loop), null, { announce: false });
  syncHoleRepairUi();
  if (announce) {
    log(`Highlighted hole ${holeRepairState.index + 1} of ${count} on ${mesh.name}.`, {
      boundaryVertices: loop.points.length
    });
  }
  return loop;
}

function findSelectedMeshHoles({ announce = true, preferredKey = "" } = {}) {
  const mesh = resolveSelectionTargets("single")[0] || null;
  if (!mesh?.geometry) {
    holeRepairState = { meshId: null, loops: [], index: -1 };
    clearSelectedHoleLoop();
    syncHoleRepairUi();
    if (announce) log("Find Holes needs one selected editable mesh.");
    return [];
  }
  const source = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  const topology = bridgeBoundaryTopology(source);
  source.dispose();
  const previousKey = preferredKey || (holeRepairState.meshId === mesh.userData.id
    ? holeRepairLoopKey(holeRepairState.loops[holeRepairState.index])
    : "");
  holeRepairState = { meshId: mesh.userData.id, loops: topology.loops, index: -1 };
  if (!topology.loops.length) {
    clearSelectedHoleLoop();
    syncHoleRepairUi();
    if (announce) log(`${mesh.name} is closed. No true boundary holes were found.`, { holes: 0, boundaryEdges: 0 });
    return [];
  }
  const retainedIndex = topology.loops.findIndex(loop => holeRepairLoopKey(loop) === previousKey);
  selectRepairHole(mesh, retainedIndex >= 0 ? retainedIndex : 0);
  if (announce) {
    log(`Found ${topology.loops.length} true open boundary loop${topology.loops.length === 1 ? "" : "s"} on ${mesh.name}.`, {
      holes: topology.loops.length,
      boundaryVertices: topology.loops.map(loop => loop.points.length),
      boundaryEdges: topology.boundaryEdgeCount
    });
  }
  return topology.loops;
}

function cycleSelectedHole(direction) {
  const mesh = objects.find(candidate => candidate.userData?.id === holeRepairState.meshId);
  if (!mesh || !holeRepairState.loops.length) return findSelectedMeshHoles();
  return selectRepairHole(mesh, holeRepairState.index + direction, { announce: true });
}

function frameSelectedHole() {
  const loop = holeRepairState.loops[holeRepairState.index];
  const mesh = objects.find(candidate => candidate.userData?.id === holeRepairState.meshId);
  if (!mesh || !loop) {
    log("Find and highlight a hole before framing it.");
    return null;
  }
  mesh.updateMatrixWorld(true);
  const points = loop.points.map(point => point.clone().applyMatrix4(mesh.matrixWorld));
  const box = new THREE.Box3().setFromPoints(points);
  const center = box.getCenter(new THREE.Vector3());
  const sizeVector = box.getSize(new THREE.Vector3());
  const size = Math.max(sizeVector.x, sizeVector.y, sizeVector.z, .2);
  const direction = camera.position.clone().sub(orbit.target);
  if (direction.lengthSq() < 1e-8) direction.set(.78, .52, .92);
  direction.normalize();
  orbit.target.copy(center);
  camera.position.copy(center).addScaledVector(direction, Math.max(.35, size * 2.4));
  camera.near = Math.max(.005, size / 2000);
  camera.far = Math.max(1000000, size * 100);
  camera.updateProjectionMatrix();
  orbit.update();
  log(`Framed hole ${holeRepairState.index + 1} on ${mesh.name}.`);
  return loop;
}

function clearMeshIntegrityGuide() {
  while (meshIntegrityGuideGroup.children.length) {
    const child = meshIntegrityGuideGroup.children.pop();
    disposeObject3D(child);
  }
  meshIntegrityGuideGroup.visible = false;
}

function meshIntegritySummary(report) {
  if (!report) return "Select one editable mesh, then inspect its topology.";
  if (!report.issues.length) {
    return `Closed manifold mesh — ${report.triangleCount} triangles, ${report.vertexCount} welded vertices, 0 issues.`;
  }
  const parts = [];
  if (report.nonManifoldEdges) parts.push(`${report.nonManifoldEdges} non-manifold edge${report.nonManifoldEdges === 1 ? "" : "s"}`);
  if (report.nonManifoldVertices) parts.push(`${report.nonManifoldVertices} non-manifold vert${report.nonManifoldVertices === 1 ? "ex" : "ices"}`);
  if (report.boundaryEdges) parts.push(`${report.boundaryEdges} open edge${report.boundaryEdges === 1 ? "" : "s"}`);
  if (report.degenerateTriangles) parts.push(`${report.degenerateTriangles} degenerate triangle${report.degenerateTriangles === 1 ? "" : "s"}`);
  if (report.duplicateTriangles) parts.push(`${report.duplicateTriangles} duplicate triangle${report.duplicateTriangles === 1 ? "" : "s"}`);
  if (report.windingConflicts) parts.push(`${report.windingConflicts} winding conflict${report.windingConflicts === 1 ? "" : "s"}`);
  return parts.join(", ");
}

function syncMeshIntegrityUi() {
  const count = meshIntegrityState.issues.length;
  const active = count > 0 && meshIntegrityState.index >= 0;
  const issue = active ? meshIntegrityState.issues[meshIntegrityState.index] : null;
  if (els.meshIntegrityStatus) {
    els.meshIntegrityStatus.textContent = issue
      ? `Issue ${meshIntegrityState.index + 1} of ${count} — ${issue.label}.`
      : meshIntegritySummary(meshIntegrityState.report);
  }
  if (els.previousMeshIssueBtn) els.previousMeshIssueBtn.disabled = count < 2;
  if (els.nextMeshIssueBtn) els.nextMeshIssueBtn.disabled = count < 2;
  if (els.frameMeshIssueBtn) els.frameMeshIssueBtn.disabled = !active;
  if (els.clearMeshIssuesBtn) els.clearMeshIssuesBtn.disabled = !meshIntegrityState.report;
}

function showMeshIntegrityIssue(mesh, issue) {
  clearMeshIntegrityGuide();
  if (!mesh || !issue?.points?.length) return;
  mesh.updateMatrixWorld(true);
  const points = issue.points.map(point => point.clone().applyMatrix4(mesh.matrixWorld));
  const box = new THREE.Box3().setFromPoints(points);
  const size = Math.max(box.getSize(new THREE.Vector3()).length(), new THREE.Box3().setFromObject(mesh).getSize(new THREE.Vector3()).length() * .012, .02);
  const color = issue.severity === "error" ? "#ff3b30" : "#ffbd3f";
  const linePoints = points.length >= 3 ? [...points, points[0].clone()] : points;
  if (linePoints.length >= 2) {
    meshIntegrityGuideGroup.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(linePoints),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1, depthWrite: false })
    ));
  }
  for (const point of points) {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(Math.max(.012, size * .035), 12, 8),
      new THREE.MeshBasicMaterial({ color, depthWrite: false, transparent: true, opacity: .96 })
    );
    marker.position.copy(point);
    meshIntegrityGuideGroup.add(marker);
  }
  meshIntegrityGuideGroup.visible = true;
}

function selectMeshIntegrityIssue(mesh, index, { announce = false } = {}) {
  const count = meshIntegrityState.issues.length;
  if (!mesh || !count) return null;
  meshIntegrityState.index = ((index % count) + count) % count;
  const issue = meshIntegrityState.issues[meshIntegrityState.index];
  showMeshIntegrityIssue(mesh, issue);
  syncMeshIntegrityUi();
  if (announce) log(`Highlighted topology issue ${meshIntegrityState.index + 1} of ${count} on ${mesh.name}: ${issue.label}.`);
  return issue;
}

function clearMeshIntegrityReport({ announce = false } = {}) {
  const hadReport = !!meshIntegrityState.report;
  meshIntegrityState = { meshId: null, issues: [], index: -1, report: null };
  clearMeshIntegrityGuide();
  syncMeshIntegrityUi();
  if (announce && hadReport) log("Cleared the Non-manifold Check report.");
  return hadReport;
}

function checkSelectedMeshIntegrity({ announce = true } = {}) {
  const mesh = resolveSelectionTargets("single")[0] || null;
  if (!mesh?.geometry) {
    clearMeshIntegrityReport();
    if (announce) log("Non-manifold Check needs one selected editable mesh.");
    return null;
  }
  const source = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  const report = meshIntegrityReport(source);
  source.dispose();
  meshIntegrityState = { meshId: mesh.userData.id, issues: report.issues, index: -1, report };
  if (report.issues.length) selectMeshIntegrityIssue(mesh, 0);
  else {
    clearMeshIntegrityGuide();
    syncMeshIntegrityUi();
  }
  if (announce) {
    log(
      report.issues.length
        ? `Non-manifold Check found ${report.issues.length} topology issue${report.issues.length === 1 ? "" : "s"} on ${mesh.name}.`
        : `${mesh.name} is a closed manifold mesh with no topology issues.`,
      {
        triangles: report.triangleCount,
        weldedVertices: report.vertexCount,
        boundaryEdges: report.boundaryEdges,
        nonManifoldEdges: report.nonManifoldEdges,
        nonManifoldVertices: report.nonManifoldVertices,
        degenerateTriangles: report.degenerateTriangles,
        duplicateTriangles: report.duplicateTriangles,
        windingConflicts: report.windingConflicts,
        geometryChanged: false
      }
    );
  }
  return report;
}

function cycleMeshIntegrityIssue(direction) {
  const mesh = objects.find(candidate => candidate.userData?.id === meshIntegrityState.meshId);
  if (!mesh || !meshIntegrityState.issues.length) return checkSelectedMeshIntegrity();
  return selectMeshIntegrityIssue(mesh, meshIntegrityState.index + direction, { announce: true });
}

function frameMeshIntegrityIssue() {
  const mesh = objects.find(candidate => candidate.userData?.id === meshIntegrityState.meshId);
  const issue = meshIntegrityState.issues[meshIntegrityState.index];
  if (!mesh || !issue?.points?.length) {
    log("Run Non-manifold Check and highlight an issue before framing it.");
    return null;
  }
  mesh.updateMatrixWorld(true);
  const points = issue.points.map(point => point.clone().applyMatrix4(mesh.matrixWorld));
  const box = new THREE.Box3().setFromPoints(points);
  const center = box.getCenter(new THREE.Vector3());
  const meshSize = new THREE.Box3().setFromObject(mesh).getSize(new THREE.Vector3()).length();
  const issueSize = box.getSize(new THREE.Vector3()).length();
  const size = Math.max(issueSize, meshSize * .08, .2);
  const direction = camera.position.clone().sub(orbit.target);
  if (direction.lengthSq() < 1e-8) direction.set(.78, .52, .92);
  direction.normalize();
  orbit.target.copy(center);
  camera.position.copy(center).addScaledVector(direction, size * 2.8);
  camera.near = Math.max(.005, size / 2000);
  camera.far = Math.max(1000000, size * 100);
  camera.updateProjectionMatrix();
  orbit.update();
  log(`Framed topology issue ${meshIntegrityState.index + 1} on ${mesh.name}.`);
  return issue;
}

function removeDoublesPreciseKey(point) {
  return `${point.x},${point.y},${point.z}`;
}

function removeDoublesTolerance() {
  const value = Math.min(1, Math.max(.000001, Number(els.removeDoublesToleranceInput?.value) || .001));
  if (els.removeDoublesToleranceInput) els.removeDoublesToleranceInput.value = String(value);
  return value;
}

function removeDoublesPlan(source, tolerance = .001) {
  const position = source?.getAttribute?.("position");
  const empty = {
    tolerance,
    candidatePairs: 0,
    mergedVertices: 0,
    clusters: 0,
    beforeTriangles: 0,
    afterTriangles: 0,
    removedDegenerate: 0,
    removedDuplicate: 0,
    beforeClosed: false,
    afterClosed: false,
    nonManifoldEdgeCount: 0,
    changed: false,
    safe: false,
    reason: "The mesh has no editable triangle geometry.",
    triangles: []
  };
  if (!position || position.count < 3) return empty;

  tolerance = Math.min(1, Math.max(.000001, Number(tolerance) || .001));
  const uniquePositions = [];
  const positionIndexByKey = new Map();
  for (let index = 0; index < position.count; index++) {
    const point = new THREE.Vector3(position.getX(index), position.getY(index), position.getZ(index));
    const key = removeDoublesPreciseKey(point);
    if (positionIndexByKey.has(key)) continue;
    positionIndexByKey.set(key, uniquePositions.length);
    uniquePositions.push({ key, point });
  }

  const parents = uniquePositions.map((_, index) => index);
  const find = index => {
    let root = index;
    while (parents[root] !== root) root = parents[root];
    while (parents[index] !== index) {
      const next = parents[index];
      parents[index] = root;
      index = next;
    }
    return root;
  };
  const union = (a, b) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parents[rootB] = rootA;
  };
  const grid = new Map();
  const cellKey = (x, y, z) => `${x},${y},${z}`;
  let candidatePairs = 0;
  const toleranceSquared = tolerance * tolerance;
  uniquePositions.forEach((entry, index) => {
    const cell = [
      Math.floor(entry.point.x / tolerance),
      Math.floor(entry.point.y / tolerance),
      Math.floor(entry.point.z / tolerance)
    ];
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          for (const otherIndex of grid.get(cellKey(cell[0] + x, cell[1] + y, cell[2] + z)) || []) {
            if (entry.point.distanceToSquared(uniquePositions[otherIndex].point) > toleranceSquared) continue;
            candidatePairs++;
            union(index, otherIndex);
          }
        }
      }
    }
    const ownCellKey = cellKey(...cell);
    if (!grid.has(ownCellKey)) grid.set(ownCellKey, []);
    grid.get(ownCellKey).push(index);
  });

  const clusterMembers = new Map();
  uniquePositions.forEach((_, index) => {
    const root = find(index);
    if (!clusterMembers.has(root)) clusterMembers.set(root, []);
    clusterMembers.get(root).push(index);
  });
  const mappedPointByKey = new Map();
  let clusters = 0;
  let mergedVertices = 0;
  for (const members of clusterMembers.values()) {
    const center = members.reduce(
      (sum, index) => sum.add(uniquePositions[index].point),
      new THREE.Vector3()
    ).multiplyScalar(1 / members.length);
    if (members.length > 1) {
      clusters++;
      mergedVertices += members.length - 1;
    }
    for (const index of members) mappedPointByKey.set(uniquePositions[index].key, center);
  }

  const beforeTopology = [];
  const triangles = [];
  const triangleSignatures = new Set();
  let removedDegenerate = 0;
  let removedDuplicate = 0;
  for (let offset = 0; offset + 2 < position.count; offset += 3) {
    const originalPoints = [0, 1, 2].map(corner => new THREE.Vector3(
      position.getX(offset + corner),
      position.getY(offset + corner),
      position.getZ(offset + corner)
    ));
    beforeTopology.push(originalPoints.map(removeDoublesPreciseKey));
    const points = originalPoints.map(point => mappedPointByKey.get(removeDoublesPreciseKey(point)).clone());
    const topologyKeys = points.map(removeDoublesPreciseKey);
    const areaSquared = new THREE.Vector3().crossVectors(
      points[1].clone().sub(points[0]),
      points[2].clone().sub(points[0])
    ).lengthSq();
    if (new Set(topologyKeys).size < 3 || areaSquared <= 1e-12) {
      removedDegenerate++;
      continue;
    }
    const signature = JSON.stringify([...topologyKeys].sort());
    if (triangleSignatures.has(signature)) {
      removedDuplicate++;
      continue;
    }
    triangleSignatures.add(signature);
    triangles.push({
      points,
      topologyKeys,
      sourceIndices: [offset, offset + 1, offset + 2],
      materialIndex: materialIndexForTriangle(source, offset / 3)
    });
  }

  const nextTopology = triangles.map(triangle => triangle.topologyKeys);
  const beforeClosed = topologyIsClosedTriangleMesh(beforeTopology);
  const afterEdgeCounts = topologyEdgeCounts(nextTopology);
  const afterClosed = topologyIsClosedTriangleMesh(nextTopology);
  const nonManifoldEdgeCount = [...afterEdgeCounts.values()].filter(count => count > 2).length;
  const changed = mergedVertices > 0 || removedDegenerate > 0 || removedDuplicate > 0;
  let reason = "No separate nearby vertices were found. Exact shared corner positions were correctly ignored.";
  let safe = changed && triangles.length > 0;
  if (!triangles.length) {
    reason = "The merge would remove every triangle.";
    safe = false;
  } else if (nonManifoldEdgeCount) {
    reason = "The merge would create a non-manifold edge.";
    safe = false;
  } else if (beforeClosed && !afterClosed) {
    reason = "The merge would open a closed mesh.";
    safe = false;
  } else if (changed) {
    reason = `Safe to merge ${mergedVertices} nearby vert${mergedVertices === 1 ? "ex" : "ices"} in ${clusters} cluster${clusters === 1 ? "" : "s"}.`;
  }
  return {
    tolerance,
    candidatePairs,
    mergedVertices,
    clusters,
    beforeTriangles: beforeTopology.length,
    afterTriangles: triangles.length,
    removedDegenerate,
    removedDuplicate,
    beforeClosed,
    afterClosed,
    nonManifoldEdgeCount,
    changed,
    safe,
    reason,
    triangles
  };
}

function syncRemoveDoublesUi(message = null) {
  if (els.removeDoublesStatus) {
    els.removeDoublesStatus.textContent = message || removeDoublesState.plan?.reason
      || "Select one editable mesh, then analyze nearby overlapping vertices.";
  }
  if (els.removeDoublesBtn) els.removeDoublesBtn.disabled = !removeDoublesState.plan?.safe;
}

function invalidateRemoveDoublesAnalysis() {
  removeDoublesState = { meshId: null, tolerance: null, plan: null };
  syncRemoveDoublesUi("Tolerance changed. Analyze again before removing doubles.");
}

function analyzeSelectedMeshDoubles({ announce = true } = {}) {
  const mesh = resolveSelectionTargets("single")[0] || null;
  if (!mesh?.geometry) {
    removeDoublesState = { meshId: null, tolerance: null, plan: null };
    syncRemoveDoublesUi("Select one editable mesh, then analyze nearby overlapping vertices.");
    if (announce) log("Remove Doubles needs one selected editable mesh.");
    return null;
  }
  const tolerance = removeDoublesTolerance();
  const source = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  const plan = removeDoublesPlan(source, tolerance);
  source.dispose();
  removeDoublesState = { meshId: mesh.userData.id, tolerance, plan };
  syncRemoveDoublesUi();
  if (announce) log(`Remove Doubles analysis on ${mesh.name}: ${plan.reason}`, {
    tolerance,
    candidatePairs: plan.candidatePairs,
    mergedVertices: plan.mergedVertices,
    clusters: plan.clusters,
    beforeTriangles: plan.beforeTriangles,
    afterTriangles: plan.afterTriangles,
    removedDegenerate: plan.removedDegenerate,
    removedDuplicate: plan.removedDuplicate,
    closedMeshPreserved: plan.beforeClosed ? plan.afterClosed : "source mesh was open",
    geometryChanged: false
  });
  return plan;
}

function removeAnalyzedDoubles() {
  const mesh = resolveSelectionTargets("single")[0] || null;
  const tolerance = removeDoublesTolerance();
  if (!mesh?.geometry || mesh.userData.id !== removeDoublesState.meshId || tolerance !== removeDoublesState.tolerance) {
    analyzeSelectedMeshDoubles();
    return [];
  }
  const plan = removeDoublesState.plan;
  if (!plan?.safe) {
    log(`Remove Doubles made no changes: ${plan?.reason || "analyze the selected mesh first."}`);
    return [];
  }
  const source = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  const geometry = geometryFromWeldedTriangles(source, plan.triangles);
  source.dispose();
  recordHistory("remove doubles");
  replaceEditableMeshGeometry(mesh, geometry);
  mesh.userData.edgeBevelProtectedEdges = [];
  mesh.userData.dissolvedSurfaceEdges = [];
  selectedSurfaceVertices.length = 0;
  selectedSurfaceEdges.length = 0;
  selectedFaces.length = 0;
  selectedFace = null;
  updateFaceMarker();
  updateSurfaceComponentMarker();
  clearMeshIntegrityReport();
  removeDoublesState = { meshId: null, tolerance: null, plan: null };
  updateAll();
  syncSurfaceEditorUi();
  updateSurfaceGizmoAttachment();
  syncRemoveDoublesUi(`Removed ${plan.mergedVertices} double${plan.mergedVertices === 1 ? "" : "s"}. Undo is ready.`);
  log(`Removed ${plan.mergedVertices} double vert${plan.mergedVertices === 1 ? "ex" : "ices"} from ${mesh.name}.`, {
    tolerance: plan.tolerance,
    clusters: plan.clusters,
    beforeTriangles: plan.beforeTriangles,
    afterTriangles: plan.afterTriangles,
    removedDegenerate: plan.removedDegenerate,
    removedDuplicate: plan.removedDuplicate,
    closedMeshPreserved: plan.beforeClosed ? plan.afterClosed : "source mesh was open",
    uvAndMaterialAttributesPreservedPerTriangleCorner: true,
    undoReady: true
  });
  return [mesh];
}

function meshStatisticsReport(source, matrixWorld = new THREE.Matrix4()) {
  const position = source?.getAttribute?.("position");
  if (!position || position.count < 3) return null;
  const working = source.index ? source.toNonIndexed() : source.clone();
  const workingPosition = working.getAttribute("position");
  const topologyTriangles = [];
  const localBounds = new THREE.Box3();
  const worldBounds = new THREE.Box3();
  let localSurfaceArea = 0;
  let worldSurfaceArea = 0;
  let localSignedVolume = 0;
  let worldSignedVolume = 0;
  for (let offset = 0; offset + 2 < workingPosition.count; offset += 3) {
    const localPoints = [0, 1, 2].map(corner => new THREE.Vector3(
      workingPosition.getX(offset + corner),
      workingPosition.getY(offset + corner),
      workingPosition.getZ(offset + corner)
    ));
    const worldPoints = localPoints.map(point => point.clone().applyMatrix4(matrixWorld));
    localPoints.forEach(point => localBounds.expandByPoint(point));
    worldPoints.forEach(point => worldBounds.expandByPoint(point));
    topologyTriangles.push(localPoints.map(vertexKey));
    localSurfaceArea += new THREE.Vector3().crossVectors(
      localPoints[1].clone().sub(localPoints[0]),
      localPoints[2].clone().sub(localPoints[0])
    ).length() * .5;
    worldSurfaceArea += new THREE.Vector3().crossVectors(
      worldPoints[1].clone().sub(worldPoints[0]),
      worldPoints[2].clone().sub(worldPoints[0])
    ).length() * .5;
    localSignedVolume += localPoints[0].dot(new THREE.Vector3().crossVectors(localPoints[1], localPoints[2])) / 6;
    worldSignedVolume += worldPoints[0].dot(new THREE.Vector3().crossVectors(worldPoints[1], worldPoints[2])) / 6;
  }
  const integrity = meshIntegrityReport(working);
  const edgeCounts = topologyEdgeCounts(topologyTriangles);
  const volumeReliable = integrity.closed && integrity.manifold && integrity.windingConflicts === 0;
  const attributeBytes = Object.values(source.attributes || {}).reduce(
    (sum, attribute) => sum + (attribute?.array?.byteLength || 0),
    0
  );
  const morphBytes = Object.values(source.morphAttributes || {}).flat().reduce(
    (sum, attribute) => sum + (attribute?.array?.byteLength || 0),
    0
  );
  const indexBytes = source.index?.array?.byteLength || 0;
  const localSize = localBounds.getSize(new THREE.Vector3());
  const worldSize = worldBounds.getSize(new THREE.Vector3());
  const report = {
    triangles: Math.floor(workingPosition.count / 3),
    triangleCorners: workingPosition.count,
    gpuPositionVertices: position.count,
    weldedVertices: integrity.vertexCount,
    uniqueEdges: edgeCounts.size,
    boundaryEdges: integrity.boundaryEdges,
    nonManifoldEdges: integrity.nonManifoldEdges,
    nonManifoldVertices: integrity.nonManifoldVertices,
    degenerateTriangles: integrity.degenerateTriangles,
    duplicateTriangles: integrity.duplicateTriangles,
    windingConflicts: integrity.windingConflicts,
    closed: integrity.closed,
    manifold: integrity.manifold,
    localSize,
    worldSize,
    localSurfaceArea,
    worldSurfaceArea,
    localVolume: volumeReliable ? Math.abs(localSignedVolume) : null,
    worldVolume: volumeReliable ? Math.abs(worldSignedVolume) : null,
    volumeReliable,
    indexed: !!source.index,
    attributes: Object.keys(source.attributes || {}),
    uvChannels: Object.keys(source.attributes || {}).filter(name => /^uv\d*$/i.test(name)),
    approximateGeometryBytes: attributeBytes + morphBytes + indexBytes
  };
  working.dispose();
  return report;
}

function meshStatisticsForMesh(mesh) {
  mesh.updateMatrixWorld(true);
  const report = meshStatisticsReport(mesh.geometry, mesh.matrixWorld);
  if (!report) return null;
  const materials = Array.isArray(mesh.material) ? mesh.material.filter(Boolean) : [mesh.material].filter(Boolean);
  const textures = new Set();
  for (const material of materials) {
    for (const value of Object.values(material || {})) if (value?.isTexture) textures.add(value.uuid || value.id || value);
  }
  return {
    ...report,
    name: mesh.name || "Unnamed mesh",
    materialSlots: materials.length,
    textureCount: textures.size,
    drawCalls: Math.max(1, mesh.geometry.groups?.length || 0),
    skinned: !!mesh.isSkinnedMesh || (report.attributes.includes("skinIndex") && report.attributes.includes("skinWeight"))
  };
}

function meshStatisticNumber(value, digits = 3) {
  if (!Number.isFinite(value)) return "n/a";
  return Number(value.toFixed(digits)).toLocaleString("en-US", { maximumFractionDigits: digits });
}

function meshStatisticBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "n/a";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${meshStatisticNumber(bytes / 1024, 2)} KiB`;
  return `${meshStatisticNumber(bytes / 1024 ** 2, 2)} MiB`;
}

function meshStatisticDimensions(vector) {
  return `${meshStatisticNumber(vector.x)} × ${meshStatisticNumber(vector.y)} × ${meshStatisticNumber(vector.z)}`;
}

function meshStatisticsText(stats) {
  const topologyHealth = stats.closed && stats.manifold && stats.windingConflicts === 0 ? "Closed manifold" : "Needs inspection";
  return [
    `MESH: ${stats.name}`,
    "",
    "GEOMETRY",
    `Triangles: ${meshStatisticNumber(stats.triangles, 0)}`,
    `Triangle corners: ${meshStatisticNumber(stats.triangleCorners, 0)}`,
    `GPU position vertices: ${meshStatisticNumber(stats.gpuPositionVertices, 0)}${stats.indexed ? " (indexed)" : " (non-indexed)"}`,
    `Welded positions: ${meshStatisticNumber(stats.weldedVertices, 0)}`,
    `Unique edges: ${meshStatisticNumber(stats.uniqueEdges, 0)}`,
    `Approx. geometry memory: ${meshStatisticBytes(stats.approximateGeometryBytes)}`,
    "",
    "SIZE",
    `Local dimensions (studs): ${meshStatisticDimensions(stats.localSize)}`,
    `World dimensions (studs): ${meshStatisticDimensions(stats.worldSize)}`,
    `World dimensions (meters): ${meshStatisticDimensions(stats.worldSize.clone().multiplyScalar(.28))}`,
    `World surface area: ${meshStatisticNumber(stats.worldSurfaceArea)} stud²`,
    `Closed world volume: ${stats.volumeReliable ? `${meshStatisticNumber(stats.worldVolume)} stud³` : "n/a (mesh is open or topology is inconsistent)"}`,
    "",
    "TOPOLOGY",
    `Health: ${topologyHealth}`,
    `Boundary edges: ${meshStatisticNumber(stats.boundaryEdges, 0)}`,
    `Non-manifold edges: ${meshStatisticNumber(stats.nonManifoldEdges, 0)}`,
    `Non-manifold vertices: ${meshStatisticNumber(stats.nonManifoldVertices, 0)}`,
    `Degenerate triangles: ${meshStatisticNumber(stats.degenerateTriangles, 0)}`,
    `Duplicate triangles: ${meshStatisticNumber(stats.duplicateTriangles, 0)}`,
    `Winding conflicts: ${meshStatisticNumber(stats.windingConflicts, 0)}`,
    "",
    "RENDER DATA",
    `Material slots: ${meshStatisticNumber(stats.materialSlots, 0)}`,
    `Textures: ${meshStatisticNumber(stats.textureCount, 0)}`,
    `Estimated draw calls: ${meshStatisticNumber(stats.drawCalls, 0)}`,
    `UV channels: ${stats.uvChannels.length ? stats.uvChannels.join(", ") : "none"}`,
    `Attributes: ${stats.attributes.join(", ") || "none"}`,
    `Skin data: ${stats.skinned ? "yes" : "no"}`
  ].join("\n");
}

function syncMeshStatisticsUi() {
  if (els.meshStatisticsReport) els.meshStatisticsReport.textContent = meshStatisticsState.text || "No report yet.";
  if (els.copyMeshStatisticsBtn) els.copyMeshStatisticsBtn.disabled = !meshStatisticsState.text;
}

function calculateSelectedMeshStatistics({ announce = true } = {}) {
  const mesh = resolveSelectionTargets("single")[0] || null;
  if (!mesh?.geometry) {
    meshStatisticsState = { meshId: null, stats: null, text: "" };
    if (els.meshStatisticsStatus) els.meshStatisticsStatus.textContent = "Select one editable mesh, then calculate a read-only geometry report.";
    syncMeshStatisticsUi();
    if (announce) log("Mesh Statistics needs one selected editable mesh.");
    return null;
  }
  const stats = meshStatisticsForMesh(mesh);
  if (!stats) {
    if (announce) log("The selected mesh has no triangle geometry to measure.");
    return null;
  }
  const text = meshStatisticsText(stats);
  meshStatisticsState = { meshId: mesh.userData.id, stats, text };
  if (els.meshStatisticsStatus) {
    els.meshStatisticsStatus.textContent = `${stats.triangles.toLocaleString("en-US")} triangles — ${stats.closed && stats.manifold && stats.windingConflicts === 0 ? "closed manifold" : "topology needs inspection"}.`;
  }
  syncMeshStatisticsUi();
  if (announce) log(`Calculated read-only Mesh Statistics for ${mesh.name}.`, {
    triangles: stats.triangles,
    weldedVertices: stats.weldedVertices,
    boundaryEdges: stats.boundaryEdges,
    nonManifoldEdges: stats.nonManifoldEdges,
    worldDimensionsStuds: stats.worldSize.toArray(),
    worldDimensionsMeters: stats.worldSize.clone().multiplyScalar(.28).toArray(),
    approximateGeometryBytes: stats.approximateGeometryBytes,
    geometryChanged: false,
    undoConsumed: false
  });
  return stats;
}

async function copyMeshStatisticsReport() {
  if (!meshStatisticsState.text) {
    log("Calculate Mesh Statistics before copying the report.");
    return false;
  }
  try {
    await navigator.clipboard.writeText(meshStatisticsState.text);
    log("Copied the Mesh Statistics report to the clipboard for human or AI review.");
    return true;
  } catch (error) {
    log("The browser blocked clipboard access. The report remains selectable in the panel.", { error: error?.message || String(error) });
    return false;
  }
}

function decimateNormalizedSettings(options = {}) {
  return {
    reduction: Math.min(90, Math.max(1, Number(options.reduction) || 35)),
    featureAngle: Math.min(179, Math.max(1, Number(options.featureAngle) || 35)),
    preserveBoundaries: options.preserveBoundaries !== false,
    preserveUvSeams: options.preserveUvSeams !== false,
    preserveMaterials: options.preserveMaterials !== false
  };
}

function decimateSettingsFromUi() {
  const settings = decimateNormalizedSettings({
    reduction: els.decimateReductionInput?.value,
    featureAngle: els.decimateFeatureAngleInput?.value,
    preserveBoundaries: els.decimatePreserveBoundariesInput?.checked,
    preserveUvSeams: els.decimatePreserveUvSeamsInput?.checked,
    preserveMaterials: els.decimatePreserveMaterialsInput?.checked
  });
  if (els.decimateReductionInput) els.decimateReductionInput.value = String(settings.reduction);
  if (els.decimateFeatureAngleInput) els.decimateFeatureAngleInput.value = String(settings.featureAngle);
  return settings;
}

function decimateSettingsKey(settings) {
  return JSON.stringify(decimateNormalizedSettings(settings));
}

function decimateAttributeKey(attribute, index) {
  if (!attribute) return "";
  const values = [];
  for (let component = 0; component < attribute.itemSize; component++) {
    values.push(Number(attribute.array[index * attribute.itemSize + component]).toFixed(6));
  }
  return values.join(",");
}

function protectedDecimatePlan(source, options = {}) {
  const settings = decimateNormalizedSettings(options);
  const sourcePosition = source?.getAttribute?.("position");
  const empty = {
    settings,
    beforeTriangles: 0,
    targetTriangles: 0,
    afterTriangles: 0,
    removedTriangles: 0,
    achievedReduction: 0,
    protectedVertices: 0,
    protectedEdges: 0,
    candidateEdges: 0,
    collapsedEdges: 0,
    beforeClosed: false,
    afterClosed: false,
    boundaryEdgesBefore: 0,
    boundaryEdgesAfter: 0,
    nonManifoldEdges: 0,
    safe: false,
    reason: "The mesh has no editable triangle geometry.",
    triangles: []
  };
  if (!sourcePosition || sourcePosition.count < 6) return empty;

  const working = source.index ? source.toNonIndexed() : source;
  const position = working.getAttribute("position");
  const uv = working.getAttribute("uv");
  const vertexIds = [];
  const pointById = [];
  const idByPosition = new Map();
  for (let index = 0; index < position.count; index++) {
    const point = new THREE.Vector3(position.getX(index), position.getY(index), position.getZ(index));
    const key = removeDoublesPreciseKey(point);
    if (!idByPosition.has(key)) {
      idByPosition.set(key, pointById.length);
      pointById.push(point);
    }
    vertexIds[index] = idByPosition.get(key);
  }

  const triangles = [];
  const edgeMap = new Map();
  const triangleIdsByVertex = new Map();
  const edgeSignature = (a, b) => a < b ? `${a}|${b}` : `${b}|${a}`;
  for (let offset = 0; offset + 2 < position.count; offset += 3) {
    const ids = [vertexIds[offset], vertexIds[offset + 1], vertexIds[offset + 2]];
    const points = ids.map(id => pointById[id].clone());
    const normal = new THREE.Vector3().crossVectors(
      points[1].clone().sub(points[0]),
      points[2].clone().sub(points[0])
    );
    if (new Set(ids).size < 3 || normal.lengthSq() <= 1e-12) continue;
    normal.normalize();
    const triangleIndex = triangles.length;
    const record = {
      ids,
      points,
      normal,
      sourceIndices: [offset, offset + 1, offset + 2],
      materialIndex: materialIndexForTriangle(working, offset / 3)
    };
    triangles.push(record);
    ids.forEach(id => {
      if (!triangleIdsByVertex.has(id)) triangleIdsByVertex.set(id, new Set());
      triangleIdsByVertex.get(id).add(triangleIndex);
    });
    for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) {
      const signature = edgeSignature(ids[a], ids[b]);
      if (!edgeMap.has(signature)) edgeMap.set(signature, { ids: [ids[a], ids[b]], entries: [] });
      edgeMap.get(signature).entries.push({
        triangleIndex,
        materialIndex: record.materialIndex,
        uvById: new Map([
          [ids[a], decimateAttributeKey(uv, offset + a)],
          [ids[b], decimateAttributeKey(uv, offset + b)]
        ])
      });
    }
  }
  if (source.index) working.dispose();
  if (triangles.length < 4) return { ...empty, beforeTriangles: triangles.length, reason: "At least four valid triangles are needed for protected decimation." };

  const beforeTopology = triangles.map(triangle => triangle.ids.map(String));
  const beforeEdgeCounts = topologyEdgeCounts(beforeTopology);
  const beforeClosed = topologyIsClosedTriangleMesh(beforeTopology);
  const boundaryEdgesBefore = [...beforeEdgeCounts.values()].filter(count => count === 1).length;
  const protectedIds = new Set();
  const protectedEdgeKeys = new Set();
  const creaseDot = Math.cos(THREE.MathUtils.degToRad(settings.featureAngle));
  for (const [signature, edge] of edgeMap) {
    const isBoundary = edge.entries.length === 1;
    const isNonManifold = edge.entries.length > 2;
    const isSharp = edge.entries.length === 2
      && triangles[edge.entries[0].triangleIndex].normal.dot(triangles[edge.entries[1].triangleIndex].normal) < creaseDot;
    const isMaterialBorder = settings.preserveMaterials
      && new Set(edge.entries.map(entry => entry.materialIndex)).size > 1;
    let isUvSeam = false;
    if (settings.preserveUvSeams && uv && edge.entries.length > 1) {
      for (const id of edge.ids) {
        if (new Set(edge.entries.map(entry => entry.uvById.get(id) || "")).size > 1) isUvSeam = true;
      }
    }
    if (isNonManifold || isSharp || isMaterialBorder || isUvSeam || (settings.preserveBoundaries && isBoundary)) {
      protectedEdgeKeys.add(signature);
      edge.ids.forEach(id => protectedIds.add(id));
    }
  }

  const neighborsById = new Map(pointById.map((_, id) => [id, new Set()]));
  for (const edge of edgeMap.values()) {
    neighborsById.get(edge.ids[0]).add(edge.ids[1]);
    neighborsById.get(edge.ids[1]).add(edge.ids[0]);
  }
  const candidateIsLocallySafe = edge => {
    const [firstId, secondId] = edge.ids;
    const sharedNeighbors = [...neighborsById.get(firstId)]
      .filter(id => neighborsById.get(secondId).has(id));
    if (sharedNeighbors.length !== 2) return false;
    const center = pointById[firstId].clone().add(pointById[secondId]).multiplyScalar(.5);
    const affectedTriangles = new Set([
      ...triangleIdsByVertex.get(firstId),
      ...triangleIdsByVertex.get(secondId)
    ]);
    for (const triangleIndex of affectedTriangles) {
      const triangle = triangles[triangleIndex];
      const containsFirst = triangle.ids.includes(firstId);
      const containsSecond = triangle.ids.includes(secondId);
      if (containsFirst && containsSecond) continue;
      const points = triangle.ids.map(id => (
        id === firstId || id === secondId ? center.clone() : pointById[id].clone()
      ));
      const normal = new THREE.Vector3().crossVectors(
        points[1].clone().sub(points[0]),
        points[2].clone().sub(points[0])
      );
      if (normal.lengthSq() <= 1e-12 || normal.normalize().dot(triangle.normal) <= .05) return false;
    }
    return true;
  };
  const candidates = [...edgeMap.entries()]
    .filter(([signature, edge]) => (
      edge.entries.length === 2
      && !protectedEdgeKeys.has(signature)
      && !protectedIds.has(edge.ids[0])
      && !protectedIds.has(edge.ids[1])
      && candidateIsLocallySafe(edge)
    ))
    .map(([, edge]) => ({
      ids: edge.ids,
      lengthSquared: pointById[edge.ids[0]].distanceToSquared(pointById[edge.ids[1]])
    }))
    .filter(candidate => candidate.lengthSquared > 1e-12)
    .sort((a, b) => a.lengthSquared - b.lengthSquared);
  const targetTriangles = Math.max(4, Math.floor(triangles.length * (1 - settings.reduction / 100)));
  const desiredRemoved = Math.max(0, triangles.length - targetTriangles);
  const desiredCollapses = Math.ceil(desiredRemoved / 2);
  const selectedCandidates = [];
  const reservedIds = new Set();
  for (const candidate of candidates) {
    if (selectedCandidates.length >= desiredCollapses) break;
    if (reservedIds.has(candidate.ids[0]) || reservedIds.has(candidate.ids[1])) continue;
    selectedCandidates.push(candidate);
    reservedIds.add(candidate.ids[0]);
    reservedIds.add(candidate.ids[1]);
  }

  const evaluate = collapseCount => {
    const replacementId = new Map();
    const replacementPoint = new Map();
    for (let index = 0; index < collapseCount; index++) {
      const candidate = selectedCandidates[index];
      const id = `c${index}`;
      const center = pointById[candidate.ids[0]].clone().add(pointById[candidate.ids[1]]).multiplyScalar(.5);
      candidate.ids.forEach(sourceId => replacementId.set(sourceId, id));
      replacementPoint.set(id, center);
    }
    const result = [];
    const signatures = new Set();
    let flipped = false;
    for (const triangle of triangles) {
      const ids = triangle.ids.map(id => replacementId.get(id) ?? `v${id}`);
      if (new Set(ids).size < 3) continue;
      const points = triangle.ids.map(id => {
        const replacement = replacementId.get(id);
        return replacement ? replacementPoint.get(replacement).clone() : pointById[id].clone();
      });
      const cross = new THREE.Vector3().crossVectors(
        points[1].clone().sub(points[0]),
        points[2].clone().sub(points[0])
      );
      if (cross.lengthSq() <= 1e-12 || cross.normalize().dot(triangle.normal) <= .05) {
        flipped = true;
        break;
      }
      const signature = [...ids].sort().join("|");
      if (signatures.has(signature)) continue;
      signatures.add(signature);
      result.push({
        points,
        topologyKeys: ids,
        sourceIndices: triangle.sourceIndices,
        materialIndex: triangle.materialIndex
      });
    }
    const topology = result.map(triangle => triangle.topologyKeys);
    const edgeCounts = topologyEdgeCounts(topology);
    const nonManifoldEdges = [...edgeCounts.values()].filter(count => count > 2).length;
    const boundaryEdges = [...edgeCounts.values()].filter(count => count === 1).length;
    const afterClosed = topologyIsClosedTriangleMesh(topology);
    const safe = !flipped
      && result.length >= 4
      && result.length < triangles.length
      && nonManifoldEdges === 0
      && (!beforeClosed || afterClosed)
      && (!settings.preserveBoundaries || boundaryEdges <= boundaryEdgesBefore);
    return { result, nonManifoldEdges, boundaryEdges, afterClosed, safe };
  };

  let attemptedCollapses = selectedCandidates.length;
  let evaluated = attemptedCollapses ? evaluate(attemptedCollapses) : null;
  while (attemptedCollapses > 0 && !evaluated?.safe) {
    attemptedCollapses = Math.floor(attemptedCollapses / 2);
    evaluated = attemptedCollapses ? evaluate(attemptedCollapses) : null;
  }
  const output = evaluated?.safe ? evaluated.result : [];
  const removedTriangles = output.length ? triangles.length - output.length : 0;
  const achievedReduction = output.length ? removedTriangles / triangles.length * 100 : 0;
  let reason = "No safe collapsible edges remain with the current detail protections.";
  if (!candidates.length) reason = "Every usable edge is protected by the current boundary, feature, UV, or material rules.";
  else if (output.length) reason = `Safe preview: remove ${removedTriangles} triangles (${achievedReduction.toFixed(1)}%) with ${attemptedCollapses} protected edge collapses.`;
  return {
    settings,
    beforeTriangles: triangles.length,
    targetTriangles,
    afterTriangles: output.length || triangles.length,
    removedTriangles,
    achievedReduction,
    protectedVertices: protectedIds.size,
    protectedEdges: protectedEdgeKeys.size,
    candidateEdges: candidates.length,
    collapsedEdges: output.length ? attemptedCollapses : 0,
    beforeClosed,
    afterClosed: output.length ? evaluated.afterClosed : beforeClosed,
    boundaryEdgesBefore,
    boundaryEdgesAfter: output.length ? evaluated.boundaryEdges : boundaryEdgesBefore,
    nonManifoldEdges: output.length ? evaluated.nonManifoldEdges : 0,
    safe: output.length > 0,
    reason,
    triangles: output
  };
}

function syncDecimateUi(message = null) {
  if (els.decimateStatus) {
    els.decimateStatus.textContent = message || decimateState.plan?.reason
      || "Select one editable mesh, then analyze a protected triangle reduction.";
  }
  if (els.applyDecimateBtn) els.applyDecimateBtn.disabled = !decimateState.plan?.safe;
}

function invalidateDecimateAnalysis() {
  decimateState = { meshId: null, settingsKey: "", plan: null };
  syncDecimateUi("Settings changed. Analyze again before applying decimation.");
}

function analyzeSelectedMeshDecimation({ announce = true } = {}) {
  const mesh = resolveSelectionTargets("single")[0] || null;
  if (!mesh?.geometry) {
    decimateState = { meshId: null, settingsKey: "", plan: null };
    syncDecimateUi();
    if (announce) log("Protected Decimate needs one selected editable mesh.");
    return null;
  }
  const settings = decimateSettingsFromUi();
  const source = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  const plan = protectedDecimatePlan(source, settings);
  source.dispose();
  decimateState = { meshId: mesh.userData.id, settingsKey: decimateSettingsKey(settings), plan };
  syncDecimateUi();
  if (announce) log(`Protected Decimate analysis on ${mesh.name}: ${plan.reason}`, {
    requestedReductionPercent: settings.reduction,
    achievedReductionPercent: Number(plan.achievedReduction.toFixed(2)),
    beforeTriangles: plan.beforeTriangles,
    afterTriangles: plan.afterTriangles,
    protectedVertices: plan.protectedVertices,
    protectedEdges: plan.protectedEdges,
    candidateEdges: plan.candidateEdges,
    geometryChanged: false
  });
  return plan;
}

function applyAnalyzedDecimation() {
  const mesh = resolveSelectionTargets("single")[0] || null;
  const settings = decimateSettingsFromUi();
  if (!mesh?.geometry || mesh.userData.id !== decimateState.meshId || decimateSettingsKey(settings) !== decimateState.settingsKey) {
    analyzeSelectedMeshDecimation();
    return [];
  }
  const plan = decimateState.plan;
  if (!plan?.safe) {
    log(`Protected Decimate made no changes: ${plan?.reason || "analyze the selected mesh first."}`);
    return [];
  }
  const source = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  const geometry = geometryFromWeldedTriangles(source, plan.triangles);
  source.dispose();
  recordHistory("protected decimate");
  replaceEditableMeshGeometry(mesh, geometry);
  mesh.userData.edgeBevelProtectedEdges = [];
  mesh.userData.dissolvedSurfaceEdges = [];
  selectedSurfaceVertices.length = 0;
  selectedSurfaceEdges.length = 0;
  selectedFaces.length = 0;
  selectedFace = null;
  updateFaceMarker();
  updateSurfaceComponentMarker();
  clearMeshIntegrityReport();
  decimateState = { meshId: null, settingsKey: "", plan: null };
  updateAll();
  syncSurfaceEditorUi();
  updateSurfaceGizmoAttachment();
  syncDecimateUi(`Removed ${plan.removedTriangles} triangles safely. Undo is ready.`);
  log(`Protected Decimate reduced ${mesh.name} from ${plan.beforeTriangles} to ${plan.afterTriangles} triangles.`, {
    requestedReductionPercent: plan.settings.reduction,
    achievedReductionPercent: Number(plan.achievedReduction.toFixed(2)),
    collapsedEdges: plan.collapsedEdges,
    protectedVertices: plan.protectedVertices,
    protectedEdges: plan.protectedEdges,
    closedMeshPreserved: plan.beforeClosed ? plan.afterClosed : "source mesh was open",
    uvAndMaterialAttributesPreservedPerTriangleCorner: true,
    undoReady: true
  });
  return [mesh];
}

function lodNormalizedSettings(options = {}) {
  const reductions = [options.lod1, options.lod2, options.lod3]
    .map((value, index) => Math.min(index === 2 ? 98 : 95, Math.max(1, Number(value) || [10, 25, 65][index])))
    .sort((a, b) => a - b);
  for (let index = 1; index < reductions.length; index++) {
    reductions[index] = Math.min(index === 2 ? 98 : 95, Math.max(reductions[index], reductions[index - 1] + 1));
  }
  return {
    reductions,
    featureAngle: Math.min(179, Math.max(1, Number(options.featureAngle) || 35)),
    preserveBoundaries: options.preserveBoundaries !== false,
    preserveUvSeams: options.preserveUvSeams !== false,
    preserveMaterials: options.preserveMaterials !== false,
    hideGenerated: options.hideGenerated !== false
  };
}

function lodSettingsFromUi() {
  const settings = lodNormalizedSettings({
    lod1: els.lod1ReductionInput?.value,
    lod2: els.lod2ReductionInput?.value,
    lod3: els.lod3ReductionInput?.value,
    featureAngle: els.lodFeatureAngleInput?.value,
    preserveBoundaries: els.lodPreserveBoundariesInput?.checked,
    preserveUvSeams: els.lodPreserveUvSeamsInput?.checked,
    preserveMaterials: els.lodPreserveMaterialsInput?.checked,
    hideGenerated: els.lodHideGeneratedInput?.checked
  });
  [els.lod1ReductionInput, els.lod2ReductionInput, els.lod3ReductionInput].forEach((input, index) => {
    if (input) input.value = String(settings.reductions[index]);
  });
  if (els.lodFeatureAngleInput) els.lodFeatureAngleInput.value = String(settings.featureAngle);
  return settings;
}

function lodSettingsKey(settings) {
  return JSON.stringify(lodNormalizedSettings({
    lod1: settings?.reductions?.[0],
    lod2: settings?.reductions?.[1],
    lod3: settings?.reductions?.[2],
    featureAngle: settings?.featureAngle,
    preserveBoundaries: settings?.preserveBoundaries,
    preserveUvSeams: settings?.preserveUvSeams,
    preserveMaterials: settings?.preserveMaterials,
    hideGenerated: settings?.hideGenerated
  }));
}

function disposeLodPlan(plan) {
  if (plan?.kind === "group") {
    for (const part of plan.parts || []) {
      for (const level of part.plan?.levels || []) level.geometry?.dispose?.();
    }
    return;
  }
  for (const level of plan?.levels || []) level.geometry?.dispose?.();
}

function buildProtectedLodPlan(source, options = {}) {
  const settings = lodNormalizedSettings(options);
  const sourcePosition = source?.getAttribute?.("position");
  const originalTriangles = Math.floor((source?.index?.count || sourcePosition?.count || 0) / 3);
  const levels = [];
  if (originalTriangles < 8) {
    return { settings, originalTriangles, levels, safe: false, reason: "At least eight triangles are needed to create a useful LOD set." };
  }

  for (let levelIndex = 0; levelIndex < settings.reductions.length; levelIndex++) {
    const requestedReduction = settings.reductions[levelIndex];
    const targetTriangles = Math.max(4, Math.floor(originalTriangles * (1 - requestedReduction / 100)));
    let working = source.index ? source.toNonIndexed() : source.clone();
    let workingTriangles = Math.floor(working.getAttribute("position").count / 3);
    let attempts = 0;
    while (workingTriangles > targetTriangles && attempts < 12) {
      const relativeReduction = Math.min(90, Math.max(1, (workingTriangles - targetTriangles) / workingTriangles * 100));
      const step = protectedDecimatePlan(working, {
        reduction: relativeReduction,
        featureAngle: settings.featureAngle,
        preserveBoundaries: settings.preserveBoundaries,
        preserveUvSeams: settings.preserveUvSeams,
        preserveMaterials: settings.preserveMaterials
      });
      if (!step.safe || step.afterTriangles >= workingTriangles) break;
      const next = geometryFromWeldedTriangles(working, step.triangles);
      working.dispose();
      working = next;
      workingTriangles = step.afterTriangles;
      attempts++;
    }
    const previousTriangles = levels.at(-1)?.triangleCount || originalTriangles;
    if (workingTriangles >= previousTriangles) {
      working.dispose();
      break;
    }
    levels.push({
      level: levelIndex + 1,
      requestedReduction,
      achievedReduction: (originalTriangles - workingTriangles) / originalTriangles * 100,
      targetTriangles,
      triangleCount: workingTriangles,
      geometry: working.clone()
    });
    working.dispose();
  }
  const safe = levels.length === settings.reductions.length;
  const counts = [originalTriangles, ...levels.map(level => level.triangleCount)];
  const previewSummary = counts
    .map((count, index) => `LOD${index} ${index === 0 ? "Original" : "Preview"}: ${count} triangles`)
    .join("; ");
  return {
    settings,
    originalTriangles,
    levels,
    safe,
    reason: safe
      ? `Safe LOD preview: ${counts.length} models total — ${previewSummary}.`
      : `Only ${levels.length} of 3 LOD preview models could be created safely with the current detail protections.`
  };
}

function syncLodGeneratorUi(message = null) {
  if (els.lodGeneratorStatus) {
    els.lodGeneratorStatus.textContent = message || lodGeneratorState.plan?.reason
      || "Select one editable mesh, then analyze a protected LOD set.";
  }
  if (els.generateLodGeneratorBtn) els.generateLodGeneratorBtn.disabled = !lodGeneratorState.plan?.safe;
}

function invalidateLodGeneratorAnalysis() {
  disposeLodPlan(lodGeneratorState.plan);
  lodGeneratorState = { targetKey: "", settingsKey: "", plan: null };
  syncLodGeneratorUi("Settings changed. Analyze the LOD set again before generating it.");
}

function lodSelectionTarget() {
  const groupMeshes = resolveSelectionTargets("group");
  if (selectedGroupRecordId && groupMeshes.length) {
    const record = groupRecord(selectedGroupRecordId);
    return {
      key: `group:${record.id}:${groupMeshes.map(mesh => mesh.userData.id).join(",")}`,
      kind: "group",
      groupId: record.id,
      name: record.name,
      meshes: groupMeshes
    };
  }
  const mesh = resolveSelectionTargets("single")[0] || null;
  return mesh ? {
    key: `mesh:${mesh.userData.id}`,
    kind: "mesh",
    groupId: null,
    name: mesh.name,
    meshes: [mesh]
  } : null;
}

function lodPartLevel(part, levelIndex) {
  return part.plan.levels[levelIndex] || part.plan.levels.at(-1) || null;
}

function buildGroupLodPlan(target, settings) {
  const parts = target.meshes.map(mesh => ({
    meshId: mesh.userData.id,
    name: mesh.name,
    originalTriangles: Math.floor((mesh.geometry?.index?.count || mesh.geometry?.getAttribute("position")?.count || 0) / 3),
    plan: buildProtectedLodPlan(mesh.geometry, settings)
  }));
  const originalTriangles = parts.reduce((sum, part) => sum + part.originalTriangles, 0);
  const levelTriangleCounts = settings.reductions.map((_, levelIndex) => parts.reduce((sum, part) => (
    sum + (lodPartLevel(part, levelIndex)?.triangleCount || part.originalTriangles)
  ), 0));
  const counts = [originalTriangles, ...levelTriangleCounts];
  const safe = originalTriangles >= 8
    && levelTriangleCounts.every((count, index) => count < counts[index]);
  const reducedParts = parts.filter(part => part.plan.levels.length).length;
  return {
    kind: "group",
    targetKey: target.key,
    groupId: target.groupId,
    name: target.name,
    settings,
    parts,
    originalTriangles,
    levelTriangleCounts,
    safe,
    reason: safe
      ? `Safe group LOD preview: ${parts.length} separate parts — ${counts.map((count, index) => `LOD${index} ${count} triangles`).join("; ")}.`
      : `Could not create three progressively lighter complete group levels. ${reducedParts} of ${parts.length} parts could be reduced safely.`
  };
}

function analyzeSelectedMeshLodSet({ announce = true } = {}) {
  const target = lodSelectionTarget();
  disposeLodPlan(lodGeneratorState.plan);
  if (!target) {
    lodGeneratorState = { targetKey: "", settingsKey: "", plan: null };
    syncLodGeneratorUi();
    if (announce) log("LOD Generator needs one selected editable mesh or one selected model group.");
    return null;
  }
  const settings = lodSettingsFromUi();
  const plan = target.kind === "group"
    ? buildGroupLodPlan(target, settings)
    : { ...buildProtectedLodPlan(target.meshes[0].geometry, settings), kind: "mesh", targetKey: target.key };
  lodGeneratorState = { targetKey: target.key, settingsKey: lodSettingsKey(settings), plan };
  syncLodGeneratorUi();
  if (announce) log(`LOD Generator analysis on ${target.name}: ${plan.reason}`, {
    geometryChanged: false,
    originalTriangles: plan.originalTriangles,
    parts: target.meshes.length,
    levels: plan.kind === "group"
      ? plan.levelTriangleCounts.map((triangles, index) => ({ level: index + 1, triangles }))
      : plan.levels.map(level => ({
        level: level.level,
        requestedReductionPercent: level.requestedReduction,
        achievedReductionPercent: Number(level.achievedReduction.toFixed(2)),
        triangles: level.triangleCount
      }))
  });
  return plan;
}

function cloneLodGroupHierarchy(sourceGroupId, level, parentId) {
  const sourceRoot = groupRecord(sourceGroupId);
  const groupMap = new Map();
  const cloneBranch = (sourceRecord, cloneParentId, root = false) => {
    const clone = createSceneGroupRecord({
      name: uniqueSceneGroupName(root ? `${sourceRoot.name.replace(/\s+LOD0$/i, "")} LOD${level}` : sourceRecord.name),
      parentId: cloneParentId
    });
    groupMap.set(sourceRecord.id, clone.id);
    for (const child of childGroupRecords(sourceRecord.id)) cloneBranch(child, clone.id);
    return clone;
  };
  return { root: cloneBranch(sourceRoot, parentId, true), groupMap };
}

function generateAnalyzedGroupLodSet(target, plan, settings) {
  const sourceGroup = groupRecord(target.groupId);
  if (!sourceGroup) return [];
  const setId = `lod-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const originalName = sourceGroup.name.replace(/\s+LOD0$/i, "");
  const lodSetGroup = createSceneGroupRecord({
    name: uniqueSceneGroupName(`${originalName} LOD Set`),
    parentId: sourceGroup.parentId || null
  });
  sourceGroup.parentId = lodSetGroup.id;
  sourceGroup.name = uniqueSceneGroupName(`${originalName} LOD0`, { ignoreGroupId: sourceGroup.id });
  const levelGroups = [1, 2, 3].map(level => cloneLodGroupHierarchy(sourceGroup.id, level, lodSetGroup.id));
  const generated = [];
  const coverage = [.6, .3, .12];
  for (const [partIndex, mesh] of target.meshes.entries()) {
    const part = plan.parts[partIndex];
    mesh.userData.lod = {
      setId,
      level: 0,
      sourceId: mesh.userData.id,
      sourceGroupId: sourceGroup.id,
      reduction: 0,
      triangleCount: part.originalTriangles,
      screenCoverage: 1
    };
    for (let levelIndex = 0; levelIndex < 3; levelIndex++) {
      const level = levelIndex + 1;
      const reducedLevel = lodPartLevel(part, levelIndex);
      const geometry = reducedLevel?.geometry || mesh.geometry;
      const cloneGroupId = levelGroups[levelIndex].groupMap.get(mesh.userData.groupId)
        || levelGroups[levelIndex].root.id;
      const cloneGroup = groupRecord(cloneGroupId);
      const spec = serializeObject(mesh);
      delete spec.id;
      spec.shape = "custom";
      spec.geometry = geometryToData(geometry);
      spec.name = `${mesh.name.replace(/\s+LOD\d+$/i, "")} LOD${level}`;
      spec.hidden = settings.hideGenerated;
      spec.groupId = cloneGroupId;
      spec.groupName = cloneGroup?.name || null;
      spec.linkId = null;
      spec.linkColor = null;
      spec.liveMirror = null;
      spec.lod = {
        setId,
        level,
        sourceId: mesh.userData.id,
        sourceGroupId: sourceGroup.id,
        reduction: reducedLevel ? Number(reducedLevel.achievedReduction.toFixed(4)) : 0,
        triangleCount: reducedLevel?.triangleCount || part.originalTriangles,
        screenCoverage: coverage[levelIndex]
      };
      generated.push(addObject(spec, { record: false, select: false, update: false }));
    }
  }
  ensureSceneGroups();
  ensureModelGroups();
  selected = null;
  selectedGroupRecordId = sourceGroup.id;
  activeGroupIds = descendantMeshesForGroup(sourceGroup.id).map(mesh => mesh.userData.id);
  checkedIds.clear();
  currentTransformTargetKey = "";
  updateTransformAttachment();
  updateAll();
  return [...target.meshes, ...generated];
}

function generateAnalyzedLodSet() {
  const target = lodSelectionTarget();
  const settings = lodSettingsFromUi();
  if (!target || target.key !== lodGeneratorState.targetKey || lodSettingsKey(settings) !== lodGeneratorState.settingsKey) {
    analyzeSelectedMeshLodSet();
    return [];
  }
  const plan = lodGeneratorState.plan;
  if (!plan?.safe) {
    log(`LOD Generator made no changes: ${plan?.reason || "analyze the selected mesh first."}`);
    return [];
  }

  recordHistory("generate LOD set");
  if (target.kind === "group") {
    const result = generateAnalyzedGroupLodSet(target, plan, settings);
    const counts = [plan.originalTriangles, ...plan.levelTriangleCounts];
    disposeLodPlan(plan);
    lodGeneratorState = { targetKey: "", settingsKey: "", plan: null };
    syncLodGeneratorUi(`Generated ${target.name} as four complete LOD groups with ${target.meshes.length} separate parts per level.`);
    log(`Generated complete grouped LOD set for ${target.name}.`, {
      sourceParts: target.meshes.length,
      triangleCounts: counts,
      generatedLevelsHidden: settings.hideGenerated,
      separatePartsPreserved: true,
      undoReady: true
    });
    return result;
  }

  const sourceMesh = target.meshes[0];
  const existingLod = sourceMesh.userData.lod?.level === 0 ? sourceMesh.userData.lod : null;
  const setId = existingLod?.setId || `lod-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const oldGroupId = sourceMesh.userData.groupId || null;
  let lodGroup = existingLod ? groupRecord(oldGroupId) : null;
  if (!lodGroup) {
    const baseName = sourceMesh.name.replace(/\s+LOD\d+$/i, "");
    lodGroup = createSceneGroupRecord({
      name: uniqueSceneGroupName(`${baseName} LOD Set`),
      parentId: oldGroupId
    });
  }
  const generatedBefore = objects.filter(object => object !== sourceMesh && object.userData.lod?.setId === setId);
  generatedBefore.forEach(object => removeObject(object, { record: false, update: false }));

  const baseName = sourceMesh.name.replace(/\s+LOD\d+$/i, "");
  sourceMesh.name = `${baseName} LOD0`;
  sourceMesh.userData.groupId = lodGroup.id;
  sourceMesh.userData.groupName = lodGroup.name;
  sourceMesh.userData.lod = {
    setId,
    level: 0,
    sourceId: sourceMesh.userData.id,
    reduction: 0,
    triangleCount: plan.originalTriangles,
    screenCoverage: 1
  };

  const coverage = [.6, .3, .12];
  const generated = plan.levels.map((level, index) => {
    const spec = serializeObject(sourceMesh);
    delete spec.id;
    spec.shape = "custom";
    spec.geometry = geometryToData(level.geometry);
    spec.name = `${baseName} LOD${level.level}`;
    spec.hidden = settings.hideGenerated;
    spec.groupId = lodGroup.id;
    spec.groupName = lodGroup.name;
    spec.linkId = null;
    spec.linkColor = null;
    spec.liveMirror = null;
    spec.lod = {
      setId,
      level: level.level,
      sourceId: sourceMesh.userData.id,
      reduction: Number(level.achievedReduction.toFixed(4)),
      triangleCount: level.triangleCount,
      screenCoverage: coverage[index]
    };
    return addObject(spec, { record: false, select: false, update: false });
  });

  checkedIds.clear();
  activeGroupIds = [];
  selectedGroupRecordId = null;
  selectObject(sourceMesh);
  ensureSceneGroups();
  ensureModelGroups();
  clearSelectedSurfaceComponents();
  clearMeshIntegrityReport();
  updateAll();
  const counts = [plan.originalTriangles, ...plan.levels.map(level => level.triangleCount)];
  const generatedSummary = counts
    .map((count, index) => `LOD${index} ${index === 0 ? "Original" : "Preview"}: ${count} triangles`)
    .join("; ");
  disposeLodPlan(plan);
  lodGeneratorState = { targetKey: "", settingsKey: "", plan: null };
  syncLodGeneratorUi(`Generated ${lodGroup.name}: ${counts.length} models total — ${generatedSummary}. Undo is ready.`);
  log(`Generated protected LOD set ${lodGroup.name}.`, {
    sourcePreservedAs: sourceMesh.name,
    triangleCounts: counts,
    modelCount: counts.length,
    generatedLevelsHidden: settings.hideGenerated,
    separateSceneObjects: true,
    uvAndMaterialAttributesPreservedPerTriangleCorner: true,
    undoReady: true
  });
  return [sourceMesh, ...generated];
}

function uvUnwrapNormalizedSettings(options = {}) {
  return {
    seamAngle: Math.min(179, Math.max(1, Number(options.seamAngle) || 45)),
    padding: Math.min(20, Math.max(0, Number(options.padding) || 0)),
    atlasSize: [512, 1024, 2048].includes(Number(options.atlasSize)) ? Number(options.atlasSize) : 1024
  };
}

function uvUnwrapSettingsFromUi() {
  return uvUnwrapNormalizedSettings({
    seamAngle: els.uvUnwrapSeamAngleInput?.value,
    padding: els.uvUnwrapPaddingInput?.value,
    atlasSize: els.uvAtlasSizeSelect?.value
  });
}

function uvUnwrapSettingsKey(settings) {
  return JSON.stringify(uvUnwrapNormalizedSettings(settings));
}

function disposeUvUnwrapPlan(plan) {
  plan?.sourceGeometry?.dispose?.();
}

function smartUvProjection(point, dominantAxis) {
  if (dominantAxis === "x") return new THREE.Vector2(point.z, point.y);
  if (dominantAxis === "y") return new THREE.Vector2(point.x, point.z);
  return new THREE.Vector2(point.x, point.y);
}

function buildSmartUvLayoutPlan(geometry, options = {}) {
  const settings = uvUnwrapNormalizedSettings(options);
  const sourceGeometry = geometry?.index ? geometry.toNonIndexed() : geometry?.clone?.();
  const position = sourceGeometry?.getAttribute?.("position");
  if (!position || position.count < 3 || position.count % 3) {
    sourceGeometry?.dispose?.();
    return { safe: false, settings, sourceGeometry: null, islands: [], uvs: null, reason: "The selected mesh has no complete triangle geometry." };
  }
  const triangleCount = position.count / 3;
  const triangles = [];
  const edgeTriangles = new Map();
  for (let triangleIndex = 0; triangleIndex < triangleCount; triangleIndex++) {
    const points = [0, 1, 2].map(corner => new THREE.Vector3(
      position.getX(triangleIndex * 3 + corner),
      position.getY(triangleIndex * 3 + corner),
      position.getZ(triangleIndex * 3 + corner)
    ));
    const keys = points.map(vertexKey);
    const normal = new THREE.Vector3().crossVectors(
      points[1].clone().sub(points[0]),
      points[2].clone().sub(points[0])
    ).normalize();
    triangles.push({ points, keys, normal, materialIndex: materialIndexForTriangle(sourceGeometry, triangleIndex) });
    for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) {
      const edgeKey = [keys[a], keys[b]].sort().join("|");
      if (!edgeTriangles.has(edgeKey)) edgeTriangles.set(edgeKey, []);
      edgeTriangles.get(edgeKey).push(triangleIndex);
    }
  }
  const adjacency = triangles.map(() => new Set());
  const minimumNormalDot = Math.cos(THREE.MathUtils.degToRad(settings.seamAngle));
  for (const linked of edgeTriangles.values()) {
    if (linked.length !== 2) continue;
    const [a, b] = linked;
    if (triangles[a].materialIndex !== triangles[b].materialIndex) continue;
    if (triangles[a].normal.dot(triangles[b].normal) + 1e-8 < minimumNormalDot) continue;
    adjacency[a].add(b);
    adjacency[b].add(a);
  }
  const islands = [];
  const visited = new Set();
  for (let start = 0; start < triangleCount; start++) {
    if (visited.has(start)) continue;
    const triangleIndices = [];
    const queue = [start];
    visited.add(start);
    while (queue.length) {
      const current = queue.shift();
      triangleIndices.push(current);
      for (const neighbor of adjacency[current]) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
    const averageNormal = triangleIndices.reduce((sum, index) => sum.add(triangles[index].normal), new THREE.Vector3()).normalize();
    const absolute = new THREE.Vector3(Math.abs(averageNormal.x), Math.abs(averageNormal.y), Math.abs(averageNormal.z));
    const dominantAxis = absolute.x >= absolute.y && absolute.x >= absolute.z ? "x" : (absolute.y >= absolute.z ? "y" : "z");
    const projected = [];
    triangleIndices.forEach(index => triangles[index].points.forEach(point => projected.push(smartUvProjection(point, dominantAxis))));
    const bounds = new THREE.Box2().setFromPoints(projected);
    const size = bounds.getSize(new THREE.Vector2());
    islands.push({ triangleIndices, dominantAxis, bounds, size, packedBounds: null });
  }
  const columns = Math.ceil(Math.sqrt(islands.length));
  const rows = Math.ceil(islands.length / columns);
  const cellWidth = 1 / columns;
  const cellHeight = 1 / rows;
  const paddingFraction = Math.min(.45, settings.padding / 100);
  const uvs = new Float32Array(position.count * 2);
  islands.forEach((island, islandIndex) => {
    const column = islandIndex % columns;
    const row = Math.floor(islandIndex / columns);
    const innerWidth = cellWidth * (1 - paddingFraction * 2);
    const innerHeight = cellHeight * (1 - paddingFraction * 2);
    const sourceWidth = Math.max(island.size.x, 1e-8);
    const sourceHeight = Math.max(island.size.y, 1e-8);
    const scale = Math.min(innerWidth / sourceWidth, innerHeight / sourceHeight);
    const packedWidth = sourceWidth * scale;
    const packedHeight = sourceHeight * scale;
    const originU = column * cellWidth + (cellWidth - packedWidth) / 2;
    const originV = 1 - (row + 1) * cellHeight + (cellHeight - packedHeight) / 2;
    island.packedBounds = { minU: originU, minV: originV, maxU: originU + packedWidth, maxV: originV + packedHeight };
    island.triangleIndices.forEach(triangleIndex => {
      triangles[triangleIndex].points.forEach((point, corner) => {
        const projected = smartUvProjection(point, island.dominantAxis);
        const vertexIndex = triangleIndex * 3 + corner;
        uvs[vertexIndex * 2] = originU + (projected.x - island.bounds.min.x) * scale;
        uvs[vertexIndex * 2 + 1] = originV + (projected.y - island.bounds.min.y) * scale;
      });
    });
  });
  const safe = islands.length > 0 && uvs.every(value => Number.isFinite(value) && value >= -1e-6 && value <= 1 + 1e-6);
  return {
    safe,
    settings,
    sourceGeometry,
    triangles,
    islands,
    uvs,
    triangleCount,
    reason: safe
      ? `Smart UV preview: ${triangleCount} triangles packed into ${islands.length} non-overlapping island${islands.length === 1 ? "" : "s"} at ${settings.atlasSize} x ${settings.atlasSize}.`
      : "A safe finite UV layout could not be created for this mesh."
  };
}

function syncUvUnwrapUi(message = null) {
  const safe = !!uvUnwrapState.plan?.safe;
  const exportMode = els.uvPngExportSelect?.value || "texture";
  const wantsTexture = exportMode === "texture" || exportMode === "all";
  const wantsGuide = exportMode === "guide" || exportMode === "all";
  const wantsAtlas = exportMode === "atlas" || exportMode === "all";
  const exportCount = exportMode === "all" ? 3 : 1;
  const guideReady = safe;
  const textureSource = currentUvSourceTexture();
  const activeMesh = textureSource?.mesh || resolveSelectionTargets("single")[0] || null;
  const atlasReady = !!lastBakedTextureAtlas.dataUrl && lastBakedTextureAtlas.meshId === activeMesh?.userData.id;
  const textureReady = !!textureSource?.dataUrl;
  const exportReady = (!wantsTexture || textureReady) && (!wantsGuide || guideReady) && (!wantsAtlas || atlasReady);
  if (els.uvUnwrapStatus) els.uvUnwrapStatus.textContent = message || uvUnwrapState.plan?.reason || "Select one editable mesh, then analyze a smart UV layout.";
  if (els.applyUvUnwrapBtn) els.applyUvUnwrapBtn.disabled = !safe;
  if (els.bakeTextureAtlasBtn) els.bakeTextureAtlasBtn.disabled = !safe;
  if (els.exportUvPngBtn) {
    els.exportUvPngBtn.disabled = !exportReady;
    els.exportUvPngBtn.textContent = `Export ${exportCount} Selected PNG${exportCount === 1 ? "" : "s"}`;
  }
  if (els.uvPngExportCount) {
    const missing = [];
    if (wantsTexture && !textureReady) missing.push("select one textured mesh");
    if (wantsGuide && !guideReady) missing.push("analyze a UV layout");
    if (wantsAtlas && !atlasReady) missing.push("bake an atlas");
    const selection = exportMode === "guide"
      ? "UV guide"
      : (exportMode === "atlas" ? "baked UV atlas" : (exportMode === "all" ? "original texture, UV guide, and baked UV atlas" : "original texture from Mesh Details"));
    els.uvPngExportCount.textContent = exportReady
      ? `${exportCount} PNG${exportCount === 1 ? "" : "s"} will be saved: ${selection}.`
      : `${exportCount} PNG${exportCount === 1 ? "" : "s"} selected: ${missing.join(" and ")} to make ${exportCount === 1 ? "it" : "them"} ready.`;
  }
}

function invalidateUvUnwrapAnalysis() {
  disposeUvUnwrapPlan(uvUnwrapState.plan);
  uvUnwrapState = { meshId: null, settingsKey: "", plan: null };
  syncUvUnwrapUi("Settings changed. Analyze the UV layout again before applying it.");
}

function analyzeSelectedMeshUvLayout({ announce = true } = {}) {
  const mesh = resolveSelectionTargets("single")[0] || null;
  disposeUvUnwrapPlan(uvUnwrapState.plan);
  if (!mesh?.geometry) {
    uvUnwrapState = { meshId: null, settingsKey: "", plan: null };
    syncUvUnwrapUi();
    if (announce) log("UV Unwrap needs one selected editable mesh.");
    return null;
  }
  const settings = uvUnwrapSettingsFromUi();
  const plan = buildSmartUvLayoutPlan(mesh.geometry, settings);
  uvUnwrapState = { meshId: mesh.userData.id, settingsKey: uvUnwrapSettingsKey(settings), plan };
  syncUvUnwrapUi();
  if (announce) log(`UV layout analysis on ${mesh.name}: ${plan.reason}`, { geometryChanged: false, triangles: plan.triangleCount || 0, islands: plan.islands.length });
  return plan;
}

function currentUvUnwrapTarget() {
  const mesh = resolveSelectionTargets("single")[0] || null;
  const settings = uvUnwrapSettingsFromUi();
  if (!mesh?.geometry || mesh.userData.id !== uvUnwrapState.meshId || uvUnwrapSettingsKey(settings) !== uvUnwrapState.settingsKey) return null;
  return { mesh, settings, plan: uvUnwrapState.plan };
}

function geometryWithUvPlan(plan) {
  const geometry = plan.sourceGeometry.clone();
  geometry.setAttribute("uv", new THREE.BufferAttribute(plan.uvs.slice(), 2));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function finishUvUnwrapChange(mesh, geometry, message, details = {}) {
  replaceEditableMeshGeometry(mesh, geometry);
  clearSelectedSurfaceComponents();
  clearMeshIntegrityReport();
  disposeUvUnwrapPlan(uvUnwrapState.plan);
  uvUnwrapState = { meshId: null, settingsKey: "", plan: null };
  updateAll();
  syncUvUnwrapUi(message);
  log(message, { mesh: mesh.name, undoReady: true, ...details });
}

function applyAnalyzedUvUnwrap() {
  const target = currentUvUnwrapTarget();
  if (!target?.plan?.safe) {
    analyzeSelectedMeshUvLayout();
    return false;
  }
  recordHistory("apply UV unwrap");
  const geometry = geometryWithUvPlan(target.plan);
  const islands = target.plan.islands.length;
  finishUvUnwrapChange(target.mesh, geometry, `Applied smart UV unwrap to ${target.mesh.name}: ${islands} packed island${islands === 1 ? "" : "s"}. Undo is ready.`, { islands, texturePixelsChanged: false });
  return true;
}

function affineTriangleTransform(source, destination) {
  const [s0, s1, s2] = source;
  const [d0, d1, d2] = destination;
  const determinant = s0.x * (s1.y - s2.y) + s1.x * (s2.y - s0.y) + s2.x * (s0.y - s1.y);
  if (Math.abs(determinant) < 1e-8) return null;
  const coefficient = values => ({
    first: (values[0] * (s1.y - s2.y) + values[1] * (s2.y - s0.y) + values[2] * (s0.y - s1.y)) / determinant,
    second: (values[0] * (s2.x - s1.x) + values[1] * (s0.x - s2.x) + values[2] * (s1.x - s0.x)) / determinant,
    offset: (values[0] * (s1.x * s2.y - s2.x * s1.y) + values[1] * (s2.x * s0.y - s0.x * s2.y) + values[2] * (s0.x * s1.y - s1.x * s0.y)) / determinant
  });
  const x = coefficient(destination.map(point => point.x));
  const y = coefficient(destination.map(point => point.y));
  return [x.first, y.first, x.second, y.second, x.offset, y.offset];
}

function drawAtlasImageTriangle(context, image, sourceUvs, destinationUvs, atlasSize, surface) {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const source = sourceUvs.map(uv => {
    const [u, v] = transformedMergeUv(uv, surface);
    return new THREE.Vector2(u * width, (1 - v) * height);
  });
  const destination = destinationUvs.map(uv => new THREE.Vector2(uv[0] * atlasSize, (1 - uv[1]) * atlasSize));
  const transform = affineTriangleTransform(source, destination);
  if (!transform) return false;
  context.save();
  const center = destination.reduce((sum, point) => sum.add(point), new THREE.Vector2()).multiplyScalar(1 / 3);
  const bleedPixels = Math.max(1.5, atlasSize / 1024);
  const expandedDestination = destination.map(point => {
    const direction = point.clone().sub(center);
    return direction.lengthSq() > 1e-8 ? point.clone().add(direction.setLength(bleedPixels)) : point.clone();
  });
  context.beginPath();
  context.moveTo(expandedDestination[0].x, expandedDestination[0].y);
  context.lineTo(expandedDestination[1].x, expandedDestination[1].y);
  context.lineTo(expandedDestination[2].x, expandedDestination[2].y);
  context.closePath();
  context.clip();
  context.transform(...transform);
  context.drawImage(image, 0, 0);
  context.restore();
  return true;
}

function drawAtlasImageIsland(context, image, mappings, surface) {
  if (!mappings.length) return false;
  const prepared = mappings.map(({ sourceUvs, destinationUvs }) => {
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    const source = sourceUvs.map(uv => {
      const [u, v] = transformedMergeUv(uv, surface);
      return new THREE.Vector2(u * width, (1 - v) * height);
    });
    const destination = destinationUvs.map(uv => new THREE.Vector2(uv[0], uv[1]));
    return { destination, transform: affineTriangleTransform(source, destination) };
  });
  const reference = prepared[0]?.transform;
  if (!reference || prepared.some(item => !item.transform || item.transform.some((value, index) => Math.abs(value - reference[index]) > 1e-3))) return false;
  context.save();
  context.beginPath();
  for (const { destination } of prepared) {
    context.moveTo(destination[0].x, destination[0].y);
    context.lineTo(destination[1].x, destination[1].y);
    context.lineTo(destination[2].x, destination[2].y);
    context.closePath();
  }
  context.clip();
  context.transform(...reference);
  context.drawImage(image, 0, 0);
  context.restore();
  return true;
}

async function bakeAnalyzedTextureAtlas() {
  const target = currentUvUnwrapTarget();
  if (!target?.plan?.safe) {
    analyzeSelectedMeshUvLayout();
    return false;
  }
  const { mesh, plan, settings } = target;
  if (Array.isArray(mesh.material)) {
    syncUvUnwrapUi("Texture Atlas currently needs a mesh with one material. Merge material slots first, or use Apply UV Unwrap only.");
    log("Texture Atlas was not baked because the selected mesh uses multiple material slots.");
    return false;
  }
  const canvas = document.createElement("canvas");
  canvas.width = settings.atlasSize;
  canvas.height = settings.atlasSize;
  const context = canvas.getContext("2d");
  if (!context) return false;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  const oldUv = plan.sourceGeometry.getAttribute("uv");
  let image = null;
  if (mesh.userData.textureUrl && oldUv) {
    try {
      image = await loadMergeTextureImage(mesh.userData.textureUrl);
    } catch (error) {
      syncUvUnwrapUi(`Texture Atlas could not load the current texture: ${error.message}`);
      log(`Texture Atlas failed on ${mesh.name}: ${error.message}`);
      return false;
    }
  }
  const surface = {
    textureFlipY: mesh.userData.textureFlipY ?? true,
    textureRotation: normalizeTextureRotation(mesh.userData.textureRotation || 0)
  };
  const color = `#${mesh.material.color.getHexString()}`;
  for (const island of plan.islands) {
    const mappings = island.triangleIndices.map(triangleIndex => {
      const destinationUvs = [0, 1, 2].map(corner => {
        const offset = (triangleIndex * 3 + corner) * 2;
        return [plan.uvs[offset] * settings.atlasSize, (1 - plan.uvs[offset + 1]) * settings.atlasSize];
      });
      const sourceUvs = oldUv
        ? [0, 1, 2].map(corner => [oldUv.getX(triangleIndex * 3 + corner), oldUv.getY(triangleIndex * 3 + corner)])
        : null;
      return { triangleIndex, destinationUvs, sourceUvs };
    });
    const islandDrawn = image && oldUv && drawAtlasImageIsland(context, image, mappings, surface);
    if (islandDrawn) continue;
    for (const { sourceUvs, destinationUvs } of mappings) {
      const normalizedDestinationUvs = destinationUvs.map(([x, y]) => [x / settings.atlasSize, 1 - y / settings.atlasSize]);
      const destination = destinationUvs.map(([x, y]) => new THREE.Vector2(x, y));
      if (image && oldUv) {
        drawAtlasImageTriangle(context, image, sourceUvs, normalizedDestinationUvs, settings.atlasSize, surface);
        continue;
      }
      context.beginPath();
      context.moveTo(destination[0].x, destination[0].y);
      context.lineTo(destination[1].x, destination[1].y);
      context.lineTo(destination[2].x, destination[2].y);
      context.closePath();
      context.fillStyle = color;
      context.fill();
    }
  }
  const sourceTextureUrl = mesh.userData.textureUrl || null;
  const sourceTextureName = mesh.userData.textureName || `${mesh.name} Texture`;
  recordHistory("bake texture atlas");
  const dataUrl = canvas.toDataURL("image/png");
  const textureName = registerTextureAsset(`${mesh.name} Texture Atlas.png`, dataUrl) || `${mesh.name} Texture Atlas.png`;
  lastBakedTextureAtlas = {
    meshId: mesh.userData.id,
    dataUrl,
    fileName: `${safeFileName(String(textureName).replace(/\.png$/i, ""), "texture-atlas")}.png`,
    atlasSize: settings.atlasSize,
    sourceTextureUrl,
    sourceTextureName
  };
  const geometry = geometryWithUvPlan(plan);
  applyTextureToMesh(mesh, dataUrl, textureName, true, 0);
  mesh.material.color.set("#ffffff");
  finishUvUnwrapChange(mesh, geometry, `Baked and applied ${settings.atlasSize} x ${settings.atlasSize} texture atlas to ${mesh.name}. Undo is ready.`, { islands: plan.islands.length, atlasSize: settings.atlasSize, sourceTextureBaked: !!image });
  refreshTextureLibraryUi();
  return true;
}

function createUvLayoutCanvas(plan) {
  const size = plan.settings.atlasSize;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, size, size);
  const drawTrianglePath = triangleIndex => {
    const points = [0, 1, 2].map(corner => {
      const offset = (triangleIndex * 3 + corner) * 2;
      return [plan.uvs[offset] * size, (1 - plan.uvs[offset + 1]) * size];
    });
    context.beginPath();
    context.moveTo(points[0][0], points[0][1]);
    context.lineTo(points[1][0], points[1][1]);
    context.lineTo(points[2][0], points[2][1]);
    context.closePath();
  };
  plan.islands.forEach((island, islandIndex) => {
    const hue = Math.round((islandIndex * 137.508) % 360);
    for (const triangleIndex of island.triangleIndices) {
      drawTrianglePath(triangleIndex);
      context.fillStyle = `hsla(${hue}, 90%, 58%, 0.16)`;
      context.fill();
      context.strokeStyle = "rgba(0, 0, 0, 0.92)";
      context.lineWidth = Math.max(4, size / 256);
      context.stroke();
      drawTrianglePath(triangleIndex);
      context.strokeStyle = `hsl(${hue}, 100%, 68%)`;
      context.lineWidth = Math.max(2, size / 512);
      context.stroke();
    }
  });
  return canvas;
}

function exportAnalyzedUvLayout({ announce = true } = {}) {
  const target = currentUvUnwrapTarget();
  if (!target?.plan?.safe) {
    analyzeSelectedMeshUvLayout();
    return false;
  }
  const canvas = createUvLayoutCanvas(target.plan);
  const fileName = `${safeFileName(target.mesh.name || "mesh")}-uv-layout-${target.settings.atlasSize}.png`;
  downloadDataUrl(fileName, canvas.toDataURL("image/png"));
  if (announce) {
    syncUvUnwrapUi(`Saved 1 PNG: ${fileName} with ${target.plan.islands.length} UV islands.`);
    log(`Exported UV layout guide for ${target.mesh.name}.`, { fileName, filesSaved: 1, islands: target.plan.islands.length, atlasSize: target.settings.atlasSize, geometryChanged: false });
  }
  return fileName;
}

function exportLastBakedTextureAtlas({ announce = true } = {}) {
  const mesh = resolveSelectionTargets("single")[0] || null;
  if (!lastBakedTextureAtlas.dataUrl || lastBakedTextureAtlas.meshId !== mesh?.userData.id) {
    syncUvUnwrapUi("Bake a texture atlas before exporting the atlas image.");
    log("Texture Atlas export needs one completed Bake Texture Atlas operation first.");
    return false;
  }
  downloadDataUrl(lastBakedTextureAtlas.fileName || "texture-atlas.png", lastBakedTextureAtlas.dataUrl);
  if (announce) {
    syncUvUnwrapUi(`Saved 1 PNG: ${lastBakedTextureAtlas.fileName} containing the actual baked texture atlas.`);
    log("Exported baked texture atlas image.", {
      fileName: lastBakedTextureAtlas.fileName,
      filesSaved: 1,
      atlasSize: lastBakedTextureAtlas.atlasSize,
      sourceMeshId: lastBakedTextureAtlas.meshId
    });
  }
  return lastBakedTextureAtlas.fileName;
}

function currentUvSourceTexture() {
  const mesh = resolveSelectionTargets("single")[0] || null;
  if (!mesh) return null;
  const bakedSourceIsCurrent = lastBakedTextureAtlas.meshId === mesh.userData.id
    && lastBakedTextureAtlas.dataUrl === mesh.userData.textureUrl
    && lastBakedTextureAtlas.sourceTextureUrl;
  const dataUrl = bakedSourceIsCurrent ? lastBakedTextureAtlas.sourceTextureUrl : mesh.userData.textureUrl;
  if (!dataUrl) return null;
  return {
    mesh,
    dataUrl,
    textureName: bakedSourceIsCurrent
      ? (lastBakedTextureAtlas.sourceTextureName || `${mesh.name} Texture`)
      : (mesh.userData.textureName || `${mesh.name} Texture`)
  };
}

async function exportCurrentMeshTexture({ announce = true } = {}) {
  const source = currentUvSourceTexture();
  if (!source?.dataUrl) {
    syncUvUnwrapUi("Select one textured mesh before exporting its original texture.");
    log("Original Texture export needs one selected textured mesh.");
    return false;
  }
  let pngDataUrl = source.dataUrl;
  try {
    if (!/^data:image\/png[;,]/i.test(pngDataUrl)) {
      const image = await loadMergeTextureImage(source.dataUrl);
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth || image.width;
      canvas.height = image.naturalHeight || image.height;
      const context = canvas.getContext("2d");
      if (!context) return false;
      context.drawImage(image, 0, 0);
      pngDataUrl = canvas.toDataURL("image/png");
    }
  } catch (error) {
    syncUvUnwrapUi(`Original Texture could not be converted to PNG: ${error.message}`);
    log(`Original Texture export failed on ${source.mesh.name}: ${error.message}`);
    return false;
  }
  const baseName = safeFileName(String(source.textureName || source.mesh.name || "texture").replace(/\.(png|jpe?g|webp|gif|bmp|svg)$/i, ""), "texture");
  const fileName = `${baseName}.png`;
  downloadDataUrl(fileName, pngDataUrl);
  if (announce) {
    syncUvUnwrapUi(`Saved 1 PNG: ${fileName}, matching the unchanged image in Mesh Details.`);
    log("Exported original Mesh Details texture without UV baking.", { fileName, filesSaved: 1, sourceMeshId: source.mesh.userData.id, uvBaked: false });
  }
  return fileName;
}

async function exportSelectedUvPngs() {
  const exportMode = els.uvPngExportSelect?.value || "texture";
  const fileNames = [];
  if (exportMode === "texture" || exportMode === "all") {
    const textureFile = await exportCurrentMeshTexture({ announce: false });
    if (!textureFile) return false;
    fileNames.push(textureFile);
  }
  if (exportMode === "guide" || exportMode === "all") {
    const guideFile = exportAnalyzedUvLayout({ announce: false });
    if (!guideFile) return false;
    fileNames.push(guideFile);
  }
  if (exportMode === "atlas" || exportMode === "all") {
    const atlasFile = exportLastBakedTextureAtlas({ announce: false });
    if (!atlasFile) return false;
    fileNames.push(atlasFile);
  }
  const count = fileNames.length;
  syncUvUnwrapUi(`Saved ${count} PNG${count === 1 ? "" : "s"}: ${fileNames.join(", ")}.`);
  log(`Exported ${count} selected texture/UV PNG${count === 1 ? "" : "s"}.`, {
    filesSaved: count,
    files: fileNames,
    exportMode
  });
  return fileNames;
}

function segmentsIntersect2d(a, b, c, d) {
  const cross = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const abC = cross(a, b, c);
  const abD = cross(a, b, d);
  const cdA = cross(c, d, a);
  const cdB = cross(c, d, b);
  return abC * abD < -1e-10 && cdA * cdB < -1e-10;
}

function holeRepairUvOptions() {
  return {
    projection: els?.holeRepairUvProjectionSelect?.value || "auto"
  };
}

function holeRepairPlanarUvs(points, normal, options = null) {
  options ||= {};
  const dominant = ["x", "y", "z"].sort((a, b) => Math.abs(normal[b]) - Math.abs(normal[a]))[0];
  const projection = ["x", "y", "z"].includes(options.projection) ? options.projection : dominant;
  const projected = points.map(point => {
    if (projection === "x") return new THREE.Vector2(point.z, point.y);
    if (projection === "y") return new THREE.Vector2(point.x, point.z);
    return new THREE.Vector2(point.x, point.y);
  });
  const box = new THREE.Box2().setFromPoints(projected);
  const size = box.getSize(new THREE.Vector2());
  const rotation = ((Number(options.rotation) || 0) % 360 + 360) % 360;
  return projected.map(point => {
    let u = size.x > 1e-8 ? (point.x - box.min.x) / size.x : .5;
    let v = size.y > 1e-8 ? (point.y - box.min.y) / size.y : .5;
    if (rotation === 90) [u, v] = [1 - v, u];
    else if (rotation === 180) [u, v] = [1 - u, 1 - v];
    else if (rotation === 270) [u, v] = [v, 1 - u];
    if (options.flipU) u = 1 - u;
    if (options.flipV) v = 1 - v;
    return new THREE.Vector2(u, v);
  });
}

function holeRepairAdjacentSurfaceUvs(source, loop, basis) {
  const position = source.getAttribute("position");
  const uv = source.getAttribute("uv");
  if (!position || !uv || !loop?.edgeSignatures?.size) return null;
  const { center, xAxis, yAxis, zAxis } = basis;
  const holeBox = new THREE.Box3().setFromPoints(loop.points);
  const holeSize = Math.max(holeBox.getSize(new THREE.Vector3()).length(), 1e-6);
  let best = null;

  for (let index = 0; index + 2 < position.count; index += 3) {
    const points = [0, 1, 2].map(offset => new THREE.Vector3(
      position.getX(index + offset), position.getY(index + offset), position.getZ(index + offset)
    ));
    const keys = points.map(vertexKey);
    const touchesBoundary = [[0, 1], [1, 2], [2, 0]].some(([a, b]) =>
      loop.edgeSignatures.has([keys[a], keys[b]].sort().join("|"))
    );
    if (!touchesBoundary) continue;

    const triangleNormal = new THREE.Vector3().crossVectors(
      points[1].clone().sub(points[0]),
      points[2].clone().sub(points[0])
    );
    const area = triangleNormal.length();
    if (area <= 1e-10) continue;
    triangleNormal.multiplyScalar(1 / area);
    const alignment = Math.abs(triangleNormal.dot(zAxis));
    if (alignment < .995) continue;
    const planeDistance = points.reduce((maximum, point) =>
      Math.max(maximum, Math.abs(point.clone().sub(center).dot(zAxis))), 0);
    if (planeDistance > Math.max(1e-4, holeSize * .002)) continue;

    const projected = points.map(point => {
      const local = point.clone().sub(center);
      return new THREE.Vector2(local.dot(xAxis), local.dot(yAxis));
    });
    const geometryA = projected[1].clone().sub(projected[0]);
    const geometryB = projected[2].clone().sub(projected[0]);
    const determinant = geometryA.x * geometryB.y - geometryA.y * geometryB.x;
    if (Math.abs(determinant) <= 1e-12) continue;
    const triangleUvs = [0, 1, 2].map(offset => new THREE.Vector2(uv.getX(index + offset), uv.getY(index + offset)));
    const uvA = triangleUvs[1].clone().sub(triangleUvs[0]);
    const uvB = triangleUvs[2].clone().sub(triangleUvs[0]);
    if (Math.abs(uvA.x * uvB.y - uvA.y * uvB.x) <= 1e-12) continue;

    const mapped = loop.points.map(point => {
      const local = point.clone().sub(center);
      const projectedPoint = new THREE.Vector2(local.dot(xAxis), local.dot(yAxis));
      const delta = projectedPoint.sub(projected[0]);
      const weightA = (delta.x * geometryB.y - delta.y * geometryB.x) / determinant;
      const weightB = (geometryA.x * delta.y - geometryA.y * delta.x) / determinant;
      return triangleUvs[0].clone().addScaledVector(uvA, weightA).addScaledVector(uvB, weightB);
    });
    const score = alignment * 1000 + area;
    if (!best || score > best.score) best = { uvs: mapped, score };
  }
  return best?.uvs || null;
}

function safeHoleCapPlan(source, loop, uvOptions = null) {
  uvOptions ||= {};
  if (!loop?.points || loop.points.length < 3 || new Set(loop.keys).size !== loop.keys.length) {
    return { safe: false, reason: "degenerate boundary" };
  }
  const basis = basisFromPoints(loop.points);
  const { center, xAxis, yAxis, zAxis } = basis;
  const contour = loop.points.map(point => {
    const local = point.clone().sub(center);
    return new THREE.Vector2(local.dot(xAxis), local.dot(yAxis));
  });
  const box = new THREE.Box3().setFromPoints(loop.points);
  const diagonal = Math.max(box.getSize(new THREE.Vector3()).length(), 1e-6);
  const maxPlaneDistance = loop.points.reduce((max, point) =>
    Math.max(max, Math.abs(point.clone().sub(center).dot(zAxis))), 0);
  if (maxPlaneDistance > Math.max(1e-4, diagonal * .02)) {
    return { safe: false, reason: "boundary is too twisted to cap safely" };
  }
  for (let a = 0; a < contour.length; a++) {
    const aNext = (a + 1) % contour.length;
    for (let b = a + 1; b < contour.length; b++) {
      const bNext = (b + 1) % contour.length;
      if (a === b || aNext === b || bNext === a) continue;
      if (segmentsIntersect2d(contour[a], contour[aNext], contour[b], contour[bNext])) {
        return { safe: false, reason: "boundary crosses itself" };
      }
    }
  }
  const rawTriangles = THREE.ShapeUtils.triangulateShape(contour, []);
  if (rawTriangles.length !== contour.length - 2) return { safe: false, reason: "boundary could not be triangulated" };
  let triangles = rawTriangles.map(indices => [...indices]);
  const directedBoundary = new Map();
  loop.keys.forEach((key, index) => directedBoundary.set(`${key}>${loop.keys[(index + 1) % loop.keys.length]}`, 1));
  let same = 0;
  let opposite = 0;
  for (const triangle of triangles) {
    for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) {
      const from = loop.keys[triangle[a]];
      const to = loop.keys[triangle[b]];
      if (directedBoundary.has(`${from}>${to}`)) same++;
      if (directedBoundary.has(`${to}>${from}`)) opposite++;
    }
  }
  if (same > opposite) triangles = triangles.map(([a, b, c]) => [a, c, b]);
  const adjacentUvs = (!uvOptions.projection || uvOptions.projection === "auto")
    ? holeRepairAdjacentSurfaceUvs(source, loop, basis)
    : null;
  const planarUvs = adjacentUvs || holeRepairPlanarUvs(loop.points, zAxis, uvOptions);
  const triangleMaterials = new Map();
  const position = source.getAttribute("position");
  const boundaryKeys = new Set(loop.keys);
  const sourceIndexByKey = new Map();
  for (let index = 0; index < position.count; index++) {
    const key = vertexKey(new THREE.Vector3(position.getX(index), position.getY(index), position.getZ(index)));
    if (!sourceIndexByKey.has(key)) sourceIndexByKey.set(key, index);
  }
  for (let triangleIndex = 0; triangleIndex < position.count / 3; triangleIndex++) {
    const keys = [0, 1, 2].map(offset => vertexKey(new THREE.Vector3(
      position.getX(triangleIndex * 3 + offset), position.getY(triangleIndex * 3 + offset), position.getZ(triangleIndex * 3 + offset)
    )));
    if (keys.filter(key => boundaryKeys.has(key)).length < 2) continue;
    const material = materialIndexForTriangle(source, triangleIndex);
    triangleMaterials.set(material, (triangleMaterials.get(material) || 0) + 1);
  }
  const materialIndex = [...triangleMaterials.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
  return {
    safe: true,
    triangles,
    planarUvs,
    sourceIndexByKey,
    materialIndex,
    uvSource: adjacentUvs ? "adjacent-face" : "planar-projection"
  };
}

function geometryWithHoleCaps(source, caps) {
  const geometry = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(source.attributes)) {
    if (name === "normal" || name === "tangent") continue;
    const values = Array.from(attribute.array);
    for (const cap of caps) {
      for (const triangle of cap.plan.triangles) {
        for (const loopIndex of triangle) {
          if (name === "position") {
            values.push(...cap.loop.points[loopIndex].toArray());
          } else if (name === "uv") {
            values.push(...cap.plan.planarUvs[loopIndex].toArray());
          } else {
            const sourceIndex = cap.plan.sourceIndexByKey.get(cap.loop.keys[loopIndex]);
            const offset = sourceIndex * attribute.itemSize;
            for (let component = 0; component < attribute.itemSize; component++) values.push(attribute.array[offset + component]);
          }
        }
      }
    }
    const TypedArray = attribute.array.constructor;
    geometry.setAttribute(name, new THREE.BufferAttribute(new TypedArray(values), attribute.itemSize, attribute.normalized));
  }
  if (!source.getAttribute("uv")) {
    const uvs = Array.from({ length: source.getAttribute("position").count * 2 }, () => 0);
    for (const cap of caps) for (const triangle of cap.plan.triangles) for (const loopIndex of triangle) {
      uvs.push(...cap.plan.planarUvs[loopIndex].toArray());
    }
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  }
  if (source.groups.length) source.groups.forEach(group => geometry.addGroup(group.start, group.count, group.materialIndex));
  else geometry.addGroup(0, source.getAttribute("position").count, 0);
  let start = source.getAttribute("position").count;
  for (const cap of caps) {
    const count = cap.plan.triangles.length * 3;
    geometry.addGroup(start, count, cap.plan.materialIndex);
    start += count;
  }
  geometry.name = source.name;
  geometry.userData = { ...(source.userData || {}) };
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function repairFoundHoles({ all = false } = {}) {
  const mesh = objects.find(candidate => candidate.userData?.id === holeRepairState.meshId)
    || resolveSelectionTargets("single")[0]
    || null;
  if (!mesh?.geometry) {
    log("Find Holes before repairing a boundary.");
    return null;
  }
  const source = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  const topology = bridgeBoundaryTopology(source);
  const selectedKey = holeRepairLoopKey(holeRepairState.loops[holeRepairState.index]);
  const candidates = all ? topology.loops : topology.loops.filter(loop => holeRepairLoopKey(loop) === selectedKey);
  if (!candidates.length) {
    source.dispose();
    log("The highlighted hole changed or no longer exists. Run Find Holes again.");
    findSelectedMeshHoles({ announce: false });
    return null;
  }
  const safeCaps = [];
  const refused = [];
  const uvOptions = holeRepairUvOptions();
  for (const loop of candidates) {
    const plan = safeHoleCapPlan(source, loop, uvOptions);
    if (plan.safe) safeCaps.push({ loop, plan });
    else refused.push({ vertices: loop.points.length, reason: plan.reason });
  }
  if (!safeCaps.length) {
    source.dispose();
    log("No selected holes were safe to repair, so the mesh was left unchanged.", { refused });
    return null;
  }
  const geometry = geometryWithHoleCaps(source, safeCaps);
  const repairedTopology = bridgeBoundaryTopology(geometry);
  const sourceTriangles = [];
  const resultPosition = geometry.getAttribute("position");
  for (let index = 0; index < resultPosition.count; index += 3) {
    sourceTriangles.push([0, 1, 2].map(offset => vertexKey(new THREE.Vector3(
      resultPosition.getX(index + offset), resultPosition.getY(index + offset), resultPosition.getZ(index + offset)
    ))));
  }
  const counts = topologyEdgeCounts(sourceTriangles);
  const nonManifoldEdges = [...counts.values()].filter(count => count > 2).length;
  const uvValid = geometry.getAttribute("uv")?.count === resultPosition.count;
  const expectedRemaining = topology.loops.length - safeCaps.length;
  if (nonManifoldEdges || !uvValid || repairedTopology.loops.length !== expectedRemaining) {
    source.dispose();
    geometry.dispose();
    log("Repair validation failed, so the mesh was left unchanged.", {
      nonManifoldEdges,
      uvValid,
      expectedRemainingHoles: expectedRemaining,
      detectedRemainingHoles: repairedTopology.loops.length
    });
    return null;
  }
  const beforeTriangles = source.getAttribute("position").count / 3;
  const createdTriangles = safeCaps.reduce((sum, cap) => sum + cap.plan.triangles.length, 0);
  source.dispose();
  recordHistory(all ? "repair all safe holes" : "repair selected hole");
  replaceEditableMeshGeometry(mesh, geometry);
  selectedFaces.length = 0;
  selectedFace = null;
  clearSelectedSurfaceComponents();
  updateFaceMarker();
  updateAll();
  findSelectedMeshHoles({ announce: false });
  syncSurfaceEditorUi();
  log(`Repaired ${safeCaps.length} hole${safeCaps.length === 1 ? "" : "s"} inside ${mesh.name}.`, {
    beforeTriangles,
    afterTriangles: beforeTriangles + createdTriangles,
    createdTriangles,
    remainingHoles: expectedRemaining,
    planarUvsCreated: true,
    inheritedAdjacentUvCaps: safeCaps.filter(cap => cap.plan.uvSource === "adjacent-face").length,
    uvProjection: uvOptions.projection,
    uvRotation: uvOptions.rotation,
    flipU: uvOptions.flipU,
    flipV: uvOptions.flipV,
    materialsPreserved: true,
    refused,
    undoReady: true
  });
  return mesh;
}

function normalEditTargetMesh() {
  return resolveSelectionTargets("single")[0] || null;
}

function swapTriangleCorners(geometry, triangleIndex) {
  const second = triangleIndex * 3 + 1;
  const third = second + 1;
  for (const [name, attribute] of Object.entries(geometry.attributes || {})) {
    if (name === "normal" || name === "tangent") continue;
    swapAttributeVertices(attribute, second, third);
  }
}

function finishNormalEdit(mesh, geometry, label, details) {
  geometry.deleteAttribute("normal");
  geometry.deleteAttribute("tangent");
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  recordHistory(label);
  replaceEditableMeshGeometry(mesh, geometry);
  selectedFaces.length = 0;
  selectedFace = null;
  clearSelectedSurfaceComponents();
  updateFaceMarker();
  updateAll();
  syncSurfaceEditorUi();
  updateSurfaceGizmoAttachment();
  log(details.message, details.data);
  return mesh;
}

function flipSelectedFaceNormals() {
  const mesh = resolveSelectionTargets("faces")[0] || null;
  const faces = mesh ? selectedFaces.filter(face => face.mesh === mesh) : [];
  const triangleIndices = [...new Set(faces
    .map(face => face.faceIndex)
    .filter(index => Number.isInteger(index) && index >= 0))];
  if (!mesh || !triangleIndices.length) {
    log("Flip Selected Faces needs a Triangle or Whole Face selection on one editable mesh.");
    return null;
  }
  const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  const triangleCount = Math.floor((geometry.getAttribute("position")?.count || 0) / 3);
  const usableIndices = triangleIndices.filter(index => index < triangleCount);
  if (!usableIndices.length) {
    geometry.dispose();
    log("The selected faces no longer match the current mesh topology, so nothing was changed.");
    return null;
  }
  usableIndices.forEach(index => swapTriangleCorners(geometry, index));
  return finishNormalEdit(mesh, geometry, "flip selected face normals", {
    message: `Flipped ${usableIndices.length} selected face normal${usableIndices.length === 1 ? "" : "s"} on ${mesh.name}.`,
    data: { flippedTriangles: usableIndices.length, uvPreserved: !!geometry.getAttribute("uv"), undoReady: true }
  });
}

function recalculateSelectedMeshNormals() {
  const mesh = resolveSelectionTargets("single")[0] || null;
  if (!mesh) {
    log("Recalculate Outside needs one editable mesh selected.");
    return null;
  }
  const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  const position = geometry.getAttribute("position");
  const triangleCount = Math.floor((position?.count || 0) / 3);
  if (!position || !triangleCount) {
    geometry.dispose();
    log("The selected mesh has no triangles to recalculate.");
    return null;
  }

  const triangles = [];
  const edgeMap = new Map();
  for (let triangleIndex = 0; triangleIndex < triangleCount; triangleIndex++) {
    const points = [0, 1, 2].map(offset => new THREE.Vector3(
      position.getX(triangleIndex * 3 + offset),
      position.getY(triangleIndex * 3 + offset),
      position.getZ(triangleIndex * 3 + offset)
    ));
    const keys = points.map(vertexKey);
    triangles.push({ points, keys });
    for (const [fromIndex, toIndex] of [[0, 1], [1, 2], [2, 0]]) {
      const from = keys[fromIndex];
      const to = keys[toIndex];
      const signature = [from, to].sort().join("|");
      if (!edgeMap.has(signature)) edgeMap.set(signature, []);
      edgeMap.get(signature).push({ triangleIndex, from, to });
    }
  }
  const nonManifoldEdges = [...edgeMap.values()].filter(entries => entries.length > 2).length;
  if (nonManifoldEdges) {
    geometry.dispose();
    log("Recalculate Outside found non-manifold edges, so the mesh was left unchanged.", { nonManifoldEdges });
    return null;
  }

  const neighbors = Array.from({ length: triangleCount }, () => []);
  for (const entries of edgeMap.values()) {
    if (entries.length !== 2) continue;
    const [first, second] = entries;
    const sameDirection = first.from === second.from && first.to === second.to;
    neighbors[first.triangleIndex].push({ triangleIndex: second.triangleIndex, xorFlip: sameDirection });
    neighbors[second.triangleIndex].push({ triangleIndex: first.triangleIndex, xorFlip: sameDirection });
  }

  const flips = Array(triangleCount).fill(null);
  const components = [];
  let orientationConflicts = 0;
  for (let seed = 0; seed < triangleCount; seed++) {
    if (flips[seed] !== null) continue;
    flips[seed] = false;
    const component = [];
    const queue = [seed];
    while (queue.length) {
      const current = queue.shift();
      component.push(current);
      for (const neighbor of neighbors[current]) {
        const expected = Boolean(flips[current]) !== Boolean(neighbor.xorFlip);
        if (flips[neighbor.triangleIndex] === null) {
          flips[neighbor.triangleIndex] = expected;
          queue.push(neighbor.triangleIndex);
        } else if (flips[neighbor.triangleIndex] !== expected) {
          orientationConflicts++;
        }
      }
    }
    components.push(component);
  }
  if (orientationConflicts) {
    geometry.dispose();
    log("Recalculate Outside found a non-orientable surface, so the mesh was left unchanged.", { orientationConflicts });
    return null;
  }

  let closedComponents = 0;
  for (const component of components) {
    const componentSet = new Set(component);
    const componentEdges = [...edgeMap.values()].filter(entries => entries.some(entry => componentSet.has(entry.triangleIndex)));
    const closed = componentEdges.every(entries => entries.length === 2);
    if (!closed) continue;
    closedComponents++;
    let signedVolume = 0;
    for (const triangleIndex of component) {
      const points = triangles[triangleIndex].points;
      const a = points[0];
      const b = flips[triangleIndex] ? points[2] : points[1];
      const c = flips[triangleIndex] ? points[1] : points[2];
      signedVolume += a.dot(new THREE.Vector3().crossVectors(b, c)) / 6;
    }
    if (signedVolume < -1e-10) {
      component.forEach(triangleIndex => { flips[triangleIndex] = !flips[triangleIndex]; });
    }
  }

  let flippedTriangles = 0;
  flips.forEach((flip, triangleIndex) => {
    if (!flip) return;
    swapTriangleCorners(geometry, triangleIndex);
    flippedTriangles++;
  });
  return finishNormalEdit(mesh, geometry, "recalculate outside normals", {
    message: `Recalculated ${triangleCount} triangle normals on ${mesh.name}.`,
    data: {
      flippedTriangles,
      connectedComponents: components.length,
      closedComponents,
      openComponents: components.length - closedComponents,
      uvPreserved: !!geometry.getAttribute("uv"),
      undoReady: true
    }
  });
}

function openingLoopDetailsForMesh(mesh) {
  const { triangleNormals, vertexPoints, edgeData, edgeKey } = meshEdgeTopology(mesh);
  const creaseDotThreshold = Math.cos(THREE.MathUtils.degToRad(35));
  const openingEdges = [...edgeData.entries()].filter(([, entry]) => {
    if (entry.count === 1) return true;
    if (entry.count !== 2) return false;
    const indices = [...entry.triangleIndices];
    if (indices.length !== 2) return false;
    const normalA = triangleNormals[indices[0]];
    const normalB = triangleNormals[indices[1]];
    if (!normalA || !normalB) return false;
    return normalA.dot(normalB) <= creaseDotThreshold;
  });
  return loopDetailsFromEdgeEntries(openingEdges, vertexPoints, edgeData, edgeKey);
}

function selectionAnchorForMesh(mesh) {
  const selectedKeys = new Set(selectedFaces.map(face => face.markerKey));
  const selectedMarkers = markerHelpers.filter(marker =>
    marker.userData.targetId === mesh.userData.id
    && (!selectedKeys.size || selectedKeys.has(marker.userData.markerKey))
  );
  const activeMarkers = selectedMarkers.length
    ? selectedMarkers
    : markerHelpers.filter(marker => marker.userData.targetId === mesh.userData.id);
  if (activeMarkers.length) {
    const points = activeMarkers
      .map(marker => markerWorldData(marker)?.point?.clone())
      .filter(Boolean);
    if (points.length) return triangleCenter(points);
  }
  const meshFaces = selectedFaces.filter(face => face.mesh === mesh);
  if (meshFaces.length) return triangleCenter(meshFaces.map(face => worldFacePoint(face)));
  return null;
}

function basisFromPoints(points) {
  const center = triangleCenter(points.map(point => point.clone()));
  const normal = new THREE.Vector3();
  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    normal.x += (current.y - next.y) * (current.z + next.z);
    normal.y += (current.z - next.z) * (current.x + next.x);
    normal.z += (current.x - next.x) * (current.y + next.y);
  }
  if (normal.lengthSq() < 1e-8) normal.set(0, 1, 0);
  normal.normalize();
  let xAxis = points[0].clone().sub(center);
  if (xAxis.lengthSq() < 1e-8) xAxis = new THREE.Vector3(1, 0, 0);
  xAxis.addScaledVector(normal, -xAxis.dot(normal)).normalize();
  if (xAxis.lengthSq() < 1e-8) xAxis = new THREE.Vector3(1, 0, 0).cross(normal).normalize();
  const yAxis = normal.clone().cross(xAxis).normalize();
  return { center, xAxis, yAxis, zAxis: normal };
}

function chooseHoleLoop(mesh, loops) {
  if (!loops.length) return null;
  const loopPoints = loop => loop?.points || loop;
  if (selectedHoleLoopInfo?.targetId === mesh.userData.id) {
    const explicit = loops.find(loop => holeLoopKey(loop) === selectedHoleLoopInfo.loopKey);
    if (explicit) return explicit;
  }
  const selectedMeshFaces = selectedFaces.filter(face => face.mesh === mesh);
  if (selectedMeshFaces.length) {
    const selectedIndices = new Set(selectedMeshFaces.map(face => face.faceIndex).filter(index => Number.isInteger(index)));
    const bestBySelection = loops.reduce((best, loop) => {
      const hitCount = (loop.triangleIndices || []).reduce((count, index) => count + (selectedIndices.has(index) ? 1 : 0), 0);
      if (!best || hitCount > best.hitCount) return { loop, hitCount };
      return best;
    }, null);
    if (bestBySelection?.hitCount > 0) return bestBySelection.loop;
  }
  const anchor = selectionAnchorForMesh(mesh);
  if (!anchor) return loops.length === 1 ? loops[0] : loops.reduce((best, loop) => {
    const bestArea = Math.abs(THREE.ShapeUtils.area(loopPoints(best).map(point => new THREE.Vector2(point.x, point.z))));
    const loopArea = Math.abs(THREE.ShapeUtils.area(loopPoints(loop).map(point => new THREE.Vector2(point.x, point.z))));
    return loopArea > bestArea ? loop : best;
  });
  return loops.reduce((best, loop) => {
    const loopCenter = triangleCenter(loopPoints(loop));
    const bestDistance = triangleCenter(loopPoints(best)).distanceToSquared(anchor);
    const nextDistance = loopCenter.distanceToSquared(anchor);
    return nextDistance < bestDistance ? loop : best;
  });
}

function setSelectedHoleLoop(mesh, loop, edgeIndex = null, { announce = true } = {}) {
  if (!mesh || !loop?.points?.length) {
    selectedHoleLoopInfo = null;
    hoveredHoleLoopInfo = null;
    updateOpeningPickGuide();
    return null;
  }
  selectedHoleLoopInfo = {
    targetId: mesh.userData.id,
    loopKey: holeLoopKey(loop),
    loop,
    edgeIndex
  };
  hoveredHoleLoopInfo = null;
  updateOpeningPickGuide();
  if (announce) {
    log(`Locked opening on ${mesh.name}. Fill Hole will use this blue opening.`, {
      boundaryPoints: loop.points.length,
      edgeIndex
    });
  }
  return selectedHoleLoopInfo;
}

function updateHoveredHoleLoopFromHit(hitOrCandidate) {
  if (!openingPickMode || !hitOrCandidate) {
    hoveredHoleLoopInfo = null;
    updateOpeningPickGuide();
    return null;
  }
  const candidate = hitOrCandidate.loop
    ? hitOrCandidate
    : openingPickCandidateForPoint(hitOrCandidate.point, singleMeshTarget(), hitOrCandidate.object || null);
  if (!candidate?.loop || !candidate?.mesh) {
    hoveredHoleLoopInfo = null;
    updateOpeningPickGuide();
    return null;
  }
  hoveredHoleLoopInfo = {
    targetId: candidate.mesh.userData.id,
    loopKey: holeLoopKey(candidate.loop),
    loop: candidate.loop,
    edgeIndex: candidate.edgeIndex
  };
  updateOpeningPickGuide();
  return hoveredHoleLoopInfo;
}

function makeHoleFillSpec(mesh, loop) {
  const holeLoop = loop?.points || loop;
  const { center, xAxis, yAxis, zAxis } = basisFromPoints(holeLoop);
  const contour = holeLoop.map(point => {
    const local = point.clone().sub(center);
    return new THREE.Vector2(local.dot(xAxis), local.dot(yAxis));
  });
  const orderedLoop = contour.length >= 3 && !THREE.ShapeUtils.isClockWise(contour)
    ? { contour: [...contour].reverse(), loop: [...holeLoop].reverse() }
    : { contour, loop: holeLoop };
  const triangles = THREE.ShapeUtils.triangulateShape(orderedLoop.contour, []);
  const worldPositions = [];
  for (const face of triangles) {
    const a = orderedLoop.loop[face[0]];
    const b = orderedLoop.loop[face[1]];
    const c = orderedLoop.loop[face[2]];
    const ab = b.clone().sub(a);
    const ac = c.clone().sub(a);
    const aligned = new THREE.Vector3().crossVectors(ab, ac).dot(zAxis) >= 0;
    addTriangleBothSides(
      worldPositions,
      vecArray(a),
      vecArray(aligned ? b : c),
      vecArray(aligned ? c : b)
    );
  }
  const points = [];
  for (let i = 0; i < worldPositions.length; i += 3) {
    points.push(new THREE.Vector3(worldPositions[i], worldPositions[i + 1], worldPositions[i + 2]));
  }
  const box = new THREE.Box3().setFromPoints(points);
  const meshCenter = box.getCenter(new THREE.Vector3());
  const localPositions = points.flatMap(point => vecArray(point.clone().sub(meshCenter)));
  const geometry = geometryFromPositions(localPositions);
  const geometryData = geometryToData(geometry);
  geometry.dispose();
  return {
    shape: "custom",
    geometry: geometryData,
    name: `${mesh.name} hole fill`,
    position: meshCenter.toArray().map(round),
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    color: `#${mesh.material.color.getHexString()}`,
    roughness: mesh.material.roughness
  };
}

function fillSelectedHole() {
  const mesh = singleMeshTarget();
  if (!mesh) {
    log("Select the mesh with the opening first, then press Fill Hole.");
    return null;
  }
  const loops = openingLoopDetailsForMesh(mesh);
  if (!loops.length) {
    log(`No fillable opening loop found on ${mesh.name}.`);
    return null;
  }
  const loop = chooseHoleLoop(mesh, loops);
  if (!loop?.points?.length || loop.points.length < 3) {
    log(`Could not resolve a valid fillable opening loop on ${mesh.name}. Select the opening rim again, then try Fill Hole.`);
    return null;
  }
  recordHistory("fill hole");
  const patch = addObject(makeHoleFillSpec(mesh, loop), { record: false });
  selectObject(patch);
  clearSelectedTriangles();
  updateAll();
  log(`Filled the highlighted opening on ${mesh.name} with ${loop.points.length} boundary points.`, {
    newPart: patch.name,
    hint: "Select triangles near a different opening first if you want Fill Hole to switch sides."
  });
  return patch;
}

function chooseLoopNearPoint(loops, anchor) {
  if (!loops?.length) return null;
  if (!anchor) return loops[0];
  return loops.reduce((best, loop) => {
    const bestDistance = triangleCenter(best).distanceToSquared(anchor);
    const nextDistance = triangleCenter(loop).distanceToSquared(anchor);
    return nextDistance < bestDistance ? loop : best;
  });
}

function loopPerimeter(loop) {
  let length = 0;
  for (let i = 0; i < loop.length; i++) length += loop[i].distanceTo(loop[(i + 1) % loop.length]);
  return length;
}

function resampleLoop(loop, targetCount) {
  if (!loop?.length) return [];
  if (loop.length === 1) return Array.from({ length: targetCount }, () => loop[0].clone());
  const cumulative = [0];
  for (let i = 0; i < loop.length; i++) {
    cumulative.push(cumulative[i] + loop[i].distanceTo(loop[(i + 1) % loop.length]));
  }
  const total = cumulative[cumulative.length - 1];
  if (total <= 1e-6) return Array.from({ length: targetCount }, (_, i) => loop[i % loop.length].clone());
  const result = [];
  for (let sampleIndex = 0; sampleIndex < targetCount; sampleIndex++) {
    const target = (sampleIndex / targetCount) * total;
    let segment = 0;
    while (segment < loop.length - 1 && cumulative[segment + 1] < target) segment++;
    const start = loop[segment];
    const end = loop[(segment + 1) % loop.length];
    const segmentStart = cumulative[segment];
    const segmentLength = Math.max(1e-6, cumulative[segment + 1] - segmentStart);
    const t = (target - segmentStart) / segmentLength;
    result.push(start.clone().lerp(end, t));
  }
  return result;
}

function alignBridgeLoops(loopA, loopB) {
  const count = Math.max(8, Math.min(96, Math.max(loopA.length, loopB.length) * 2));
  const sampledA = resampleLoop(loopA, count);
  const sampledB = resampleLoop(loopB, count);
  let best = null;
  const candidates = [sampledB, [...sampledB].reverse()];
  for (const candidate of candidates) {
    for (let offset = 0; offset < count; offset++) {
      let score = 0;
      for (let i = 0; i < count; i++) {
        score += sampledA[i].distanceToSquared(candidate[(i + offset) % count]);
      }
      if (!best || score < best.score) best = { score, offset, candidate };
    }
  }
  const alignedB = sampledA.map((_, index) => best.candidate[(index + best.offset) % count].clone());
  return { loopA: sampledA, loopB: alignedB };
}

function nearestBridgeLoopPair(meshA, meshB) {
  const loopsA = boundaryLoopsForMesh(meshA);
  const loopsB = boundaryLoopsForMesh(meshB);
  if (!loopsA.length || !loopsB.length) return null;
  let best = null;
  for (const loopA of loopsA) {
    for (const loopB of loopsB) {
      const distance = triangleCenter(loopA).distanceToSquared(triangleCenter(loopB));
      if (!best || distance < best.distance) best = { distance, loopA, loopB };
    }
  }
  return best;
}

function makeBridgeSpec(meshA, meshB, loopA, loopB) {
  const { loopA: alignedA, loopB: alignedB } = alignBridgeLoops(loopA, loopB);
  const worldPositions = [];
  for (let i = 0; i < alignedA.length; i++) {
    const next = (i + 1) % alignedA.length;
    addQuadBothSides(
      worldPositions,
      vecArray(alignedA[i]),
      vecArray(alignedA[next]),
      vecArray(alignedB[next]),
      vecArray(alignedB[i])
    );
  }
  const points = [];
  for (let i = 0; i < worldPositions.length; i += 3) {
    points.push(new THREE.Vector3(worldPositions[i], worldPositions[i + 1], worldPositions[i + 2]));
  }
  const box = new THREE.Box3().setFromPoints(points);
  const meshCenter = box.getCenter(new THREE.Vector3());
  const localPositions = points.flatMap(point => vecArray(point.clone().sub(meshCenter)));
  const geometry = geometryFromPositions(localPositions);
  const geometryData = geometryToData(geometry);
  geometry.dispose();
  const mixedColor = meshA.material.color.clone().lerp(meshB.material.color.clone(), .5);
  return {
    shape: "custom",
    geometry: geometryData,
    name: `${meshA.name} to ${meshB.name} bridge`,
    position: meshCenter.toArray().map(round),
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    color: `#${mixedColor.getHexString()}`,
    roughness: round((meshA.material.roughness + meshB.material.roughness) * .5)
  };
}

function bridgeCheckedMeshes() {
  const meshes = pairMeshTargets();
  if (meshes.length !== 2) {
    log("Pick exactly two meshes with open edges, then press Bridge. Checked parts are easiest, but active multi-select also works.");
    return null;
  }
  const [meshA, meshB] = meshes;
  const pair = nearestBridgeLoopPair(meshA, meshB);
  if (!pair) {
    log(`Bridge needs two meshes with open boundary loops. ${meshA.name} or ${meshB.name} is currently closed.`);
    return null;
  }
  recordHistory("bridge meshes");
  const bridge = addObject(makeBridgeSpec(meshA, meshB, pair.loopA, pair.loopB), { record: false });
  selectObject(bridge);
  updateAll();
  log(`Bridged ${meshA.name} to ${meshB.name}.`, {
    newPart: bridge.name,
    hint: "Merge Mesh can combine the bridge later if you want one final piece."
  });
  return bridge;
}

function profileAxisName(meshes) {
  const requested = els.loftAxisSelect?.value || "auto";
  if (["x", "y", "z"].includes(requested)) return requested;
  const centers = meshes.map(mesh => new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3()));
  const ranges = ["x", "y", "z"].map(axis => {
    const values = centers.map(point => point[axis]);
    return Math.max(...values) - Math.min(...values);
  });
  return ["x", "y", "z"][ranges.indexOf(Math.max(...ranges))];
}

function profileBasis(axis) {
  if (axis === "x") return { axis: new THREE.Vector3(1, 0, 0), u: new THREE.Vector3(0, 1, 0), v: new THREE.Vector3(0, 0, 1) };
  if (axis === "z") return { axis: new THREE.Vector3(0, 0, 1), u: new THREE.Vector3(1, 0, 0), v: new THREE.Vector3(0, 1, 0) };
  return { axis: new THREE.Vector3(0, 1, 0), u: new THREE.Vector3(1, 0, 0), v: new THREE.Vector3(0, 0, -1) };
}

function convexHull2d(points) {
  const unique = [...new Map(points.map(point => [`${round(point.x, 5)},${round(point.y, 5)}`, point])).values()];
  if (unique.length < 3) return unique;
  unique.sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower = [];
  for (const point of unique) {
    while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), point) <= 0) lower.pop();
    lower.push(point);
  }
  const upper = [];
  for (let index = unique.length - 1; index >= 0; index--) {
    const point = unique[index];
    while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), point) <= 0) upper.pop();
    upper.push(point);
  }
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

function resampleClosedProfile(points, count) {
  const lengths = [];
  let perimeter = 0;
  for (let index = 0; index < points.length; index++) {
    const length = points[index].distanceTo(points[(index + 1) % points.length]);
    lengths.push(length);
    perimeter += length;
  }
  if (perimeter <= .000001) return [];
  const sampled = [];
  for (let sample = 0; sample < count; sample++) {
    let target = perimeter * sample / count;
    let edge = 0;
    while (edge < lengths.length - 1 && target > lengths[edge]) target -= lengths[edge++];
    const start = points[edge];
    const end = points[(edge + 1) % points.length];
    sampled.push(start.clone().lerp(end, lengths[edge] ? target / lengths[edge] : 0));
  }
  return sampled;
}

function alignProfileLoop(previous, loop) {
  let best = loop;
  let bestScore = Infinity;
  for (const candidate of [loop, [...loop].reverse()]) {
    for (let shift = 0; shift < candidate.length; shift++) {
      const shifted = candidate.map((_, index) => candidate[(index + shift) % candidate.length]);
      const score = shifted.reduce((sum, point, index) => sum + point.distanceToSquared(previous[index]), 0);
      if (score < bestScore) {
        bestScore = score;
        best = shifted;
      }
    }
  }
  return best;
}

function worldProfileLoop(mesh, basis, sampleCount) {
  mesh.updateWorldMatrix(true, false);
  const source = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
  const position = source.getAttribute("position");
  const world = new THREE.Vector3();
  const points2d = [];
  let axisTotal = 0;
  for (let index = 0; index < position.count; index++) {
    world.fromBufferAttribute(position, index).applyMatrix4(mesh.matrixWorld);
    axisTotal += world.dot(basis.axis);
    points2d.push(new THREE.Vector2(world.dot(basis.u), world.dot(basis.v)));
  }
  if (source !== mesh.geometry) source.dispose();
  const hull = convexHull2d(points2d);
  if (hull.length < 3) return null;
  const axisPosition = axisTotal / Math.max(1, position.count);
  const loop2d = resampleClosedProfile(hull, sampleCount);
  return {
    axisPosition,
    points: loop2d.map(point => basis.axis.clone().multiplyScalar(axisPosition)
      .addScaledVector(basis.u, point.x)
      .addScaledVector(basis.v, point.y))
  };
}

function loftCheckedProfiles() {
  const meshes = checkedObjects();
  if (meshes.length < 2) {
    log("Check two or more profile meshes, place them along an axis, then press Loft Checked.");
    return null;
  }
  const axisName = profileAxisName(meshes);
  const basis = profileBasis(axisName);
  const sampleCount = Math.max(3, Math.min(64, Math.round(Number(els.loftPointsInput?.value) || 16)));
  const profiles = meshes.map(mesh => ({ mesh, profile: worldProfileLoop(mesh, basis, sampleCount) }))
    .filter(entry => entry.profile)
    .sort((a, b) => a.profile.axisPosition - b.profile.axisPosition);
  if (profiles.length < 2) {
    log("Loft could not find usable closed silhouettes on the checked meshes.");
    return null;
  }
  for (let index = 1; index < profiles.length; index++) {
    profiles[index].profile.points = alignProfileLoop(profiles[index - 1].profile.points, profiles[index].profile.points);
  }
  const positions = [];
  const first = profiles[0].profile.points;
  const last = profiles.at(-1).profile.points;
  const firstCenter = first.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / first.length);
  const lastCenter = last.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / last.length);
  for (let index = 0; index < sampleCount; index++) {
    const next = (index + 1) % sampleCount;
    positions.push(...firstCenter.toArray(), ...first[next].toArray(), ...first[index].toArray());
    positions.push(...lastCenter.toArray(), ...last[index].toArray(), ...last[next].toArray());
  }
  for (let profileIndex = 0; profileIndex < profiles.length - 1; profileIndex++) {
    const a = profiles[profileIndex].profile.points;
    const b = profiles[profileIndex + 1].profile.points;
    for (let index = 0; index < sampleCount; index++) {
      const next = (index + 1) % sampleCount;
      positions.push(...a[index].toArray(), ...a[next].toArray(), ...b[next].toArray());
      positions.push(...a[index].toArray(), ...b[next].toArray(), ...b[index].toArray());
    }
  }
  const points = [];
  for (let index = 0; index < positions.length; index += 3) points.push(new THREE.Vector3(positions[index], positions[index + 1], positions[index + 2]));
  const center = new THREE.Box3().setFromPoints(points).getCenter(new THREE.Vector3());
  const geometry = geometryFromPositions(points.flatMap(point => point.clone().sub(center).toArray()));
  const color = profiles[0].mesh.material.color.clone().lerp(profiles.at(-1).mesh.material.color, .5);
  recordHistory("loft checked profiles");
  const loft = addObject({
    shape: "custom",
    geometry: geometryToData(geometry),
    name: `Loft ${profiles[0].mesh.name} to ${profiles.at(-1).mesh.name}`,
    position: center.toArray(),
    color: `#${color.getHexString()}`,
    roughness: round(profiles.reduce((sum, entry) => sum + entry.mesh.material.roughness, 0) / profiles.length)
  }, { record: false });
  geometry.dispose();
  selectObject(loft);
  updateAll();
  log(`Created a ${sampleCount}-point ${axisName.toUpperCase()} loft through ${profiles.length} checked profiles.`, { part: loft.name });
  return loft;
}

function mirrorCopySelection() {
  const targets = checkedObjects().length ? checkedObjects() : (selected ? [selected] : []);
  if (!targets.length) {
    log("Select or check one or more parts before Mirror Copy.");
    return [];
  }
  const axis = ["x", "y", "z"].includes(els.symmetryAxisSelect?.value) ? els.symmetryAxisSelect.value : "x";
  const plane = Number(els.symmetryPlaneInput?.value) || 0;
  const center = new THREE.Vector3();
  center[axis] = plane;
  recordHistory(`mirror copy ${axis}`);
  const copies = targets.map(source => {
    const data = serializeObject(source);
    delete data.id;
    data.name = `${source.name} ${axis.toUpperCase()} mirror`;
    data.linkId = null;
    data.linkColor = null;
    const copy = addObject(data, { record: false, select: false, update: false });
    mirrorMeshAcrossWorldPlane(copy, axis, center);
    return copy;
  });
  checkedIds.clear();
  copies.forEach(copy => checkedIds.add(copy.userData.id));
  selected = copies.at(-1) || null;
  currentTransformTargetKey = "";
  updateAll();
  log(`Created ${copies.length} mirrored editable cop${copies.length === 1 ? "y" : "ies"} across ${axis.toUpperCase()}=${round(plane)}.`);
  return copies;
}

function liveMirrorTargets() {
  const checked = checkedObjects();
  return checked.length ? checked : (selected ? [selected] : []);
}

function disposeLiveMirrorPreview(preview) {
  if (!preview) return;
  liveMirrorPreviewGroup.remove(preview);
  if (Array.isArray(preview.material)) preview.material.forEach(material => material.dispose());
  else preview.material?.dispose();
}

function mirroredWorldMatrix(axis, plane, sourceWorldMatrix) {
  const reflection = new THREE.Matrix4().identity();
  const index = axisIndex(axis);
  reflection.elements[index * 5] = -1;
  reflection.elements[12 + index] = plane * 2;
  return reflection.multiply(sourceWorldMatrix);
}

function liveMirrorMaterial(sourceMaterial) {
  const clone = sourceMaterial.clone();
  clone.side = THREE.DoubleSide;
  clone.needsUpdate = true;
  return clone;
}

function syncLiveMirrorMaterial(targetMaterial, sourceMaterial) {
  targetMaterial.copy(sourceMaterial);
  targetMaterial.side = THREE.DoubleSide;
  targetMaterial.needsUpdate = true;
}

function syncLiveMirrorPreview() {
  const activeSourceIds = new Set();
  for (const source of objects) {
    const config = source.userData.liveMirror;
    if (!config?.enabled) continue;
    const axis = ["x", "y", "z"].includes(config.axis) ? config.axis : "x";
    const plane = Number(config.plane) || 0;
    activeSourceIds.add(source.userData.id);
    let preview = liveMirrorPreviewBySourceId.get(source.userData.id);
    if (!preview) {
      const previewMaterial = Array.isArray(source.material)
        ? source.material.map(liveMirrorMaterial)
        : liveMirrorMaterial(source.material);
      preview = new THREE.Mesh(source.geometry, previewMaterial);
      preview.name = `${source.name} live mirror preview`;
      preview.matrixAutoUpdate = false;
      preview.raycast = () => null;
      preview.userData = { editorHelper: true, liveMirrorSourceId: source.userData.id };
      preview.castShadow = false;
      preview.receiveShadow = source.receiveShadow;
      liveMirrorPreviewGroup.add(preview);
      liveMirrorPreviewBySourceId.set(source.userData.id, preview);
    }
    if (preview.geometry !== source.geometry) preview.geometry = source.geometry;
    const sourceMaterials = Array.isArray(source.material) ? source.material : [source.material];
    const previewMaterials = Array.isArray(preview.material) ? preview.material : [preview.material];
    const materialStructureMatches = Array.isArray(source.material) === Array.isArray(preview.material)
      && sourceMaterials.length === previewMaterials.length;
    if (!materialStructureMatches) {
      const oldMaterials = Array.isArray(preview.material) ? preview.material : [preview.material];
      oldMaterials.forEach(material => material?.dispose());
      preview.material = Array.isArray(source.material)
        ? source.material.map(liveMirrorMaterial)
        : liveMirrorMaterial(source.material);
    } else {
      sourceMaterials.forEach((material, index) => syncLiveMirrorMaterial(previewMaterials[index], material));
    }
    source.updateWorldMatrix(true, false);
    preview.matrix.copy(mirroredWorldMatrix(axis, plane, source.matrixWorld));
    preview.matrixWorldNeedsUpdate = true;
    preview.visible = source.visible && !source.userData.hidden;
  }
  for (const [sourceId, preview] of [...liveMirrorPreviewBySourceId]) {
    if (activeSourceIds.has(sourceId) && objects.some(object => object.userData.id === sourceId)) continue;
    disposeLiveMirrorPreview(preview);
    liveMirrorPreviewBySourceId.delete(sourceId);
  }
}

function syncLiveMirrorUi() {
  if (!els.liveMirrorBtn || !els.applyLiveMirrorBtn) return;
  const targets = liveMirrorTargets();
  const enabledTargets = targets.filter(mesh => mesh.userData.liveMirror?.enabled);
  const allEnabled = targets.length > 0 && enabledTargets.length === targets.length;
  els.liveMirrorBtn.disabled = targets.length === 0;
  els.liveMirrorBtn.classList.toggle("active", allEnabled);
  els.liveMirrorBtn.setAttribute("aria-pressed", String(allEnabled));
  els.liveMirrorBtn.textContent = allEnabled ? "Live Mirror On" : "Live Mirror";
  els.applyLiveMirrorBtn.disabled = enabledTargets.length === 0;
  const primaryConfig = enabledTargets.at(-1)?.userData.liveMirror;
  if (primaryConfig && document.activeElement !== els.symmetryAxisSelect && document.activeElement !== els.symmetryPlaneInput) {
    els.symmetryAxisSelect.value = primaryConfig.axis;
    els.symmetryPlaneInput.value = String(primaryConfig.plane);
  }
}

function toggleLiveMirror() {
  const targets = liveMirrorTargets();
  if (!targets.length) {
    log("Select or check one or more parts before enabling Live Mirror.");
    return false;
  }
  const shouldEnable = !targets.every(mesh => mesh.userData.liveMirror?.enabled);
  const axis = ["x", "y", "z"].includes(els.symmetryAxisSelect?.value) ? els.symmetryAxisSelect.value : "x";
  const plane = Number(els.symmetryPlaneInput?.value) || 0;
  recordHistory(shouldEnable ? "enable live mirror" : "disable live mirror");
  for (const mesh of targets) mesh.userData.liveMirror = shouldEnable ? { enabled: true, axis, plane } : null;
  updateAll();
  log(`${shouldEnable ? "Enabled" : "Disabled"} Live Mirror for ${targets.length} part${targets.length === 1 ? "" : "s"}${shouldEnable ? ` across ${axis.toUpperCase()}=${round(plane)}` : ""}.`);
  return shouldEnable;
}

function updateLiveMirrorSettings() {
  const targets = liveMirrorTargets().filter(mesh => mesh.userData.liveMirror?.enabled);
  if (!targets.length) return;
  const axis = ["x", "y", "z"].includes(els.symmetryAxisSelect?.value) ? els.symmetryAxisSelect.value : "x";
  const plane = Number(els.symmetryPlaneInput?.value) || 0;
  if (targets.every(mesh => mesh.userData.liveMirror.axis === axis && mesh.userData.liveMirror.plane === plane)) return;
  recordHistory("change live mirror plane");
  for (const mesh of targets) mesh.userData.liveMirror = { enabled: true, axis, plane };
  updateAll();
  log(`Updated Live Mirror to ${axis.toUpperCase()}=${round(plane)} for ${targets.length} part${targets.length === 1 ? "" : "s"}.`);
}

function applyLiveMirrorSelection() {
  const targets = liveMirrorTargets().filter(mesh => mesh.userData.liveMirror?.enabled);
  if (!targets.length) {
    log("Enable Live Mirror on a selected or checked part before applying it.");
    return [];
  }
  recordHistory("apply live mirror");
  const copies = targets.map(source => {
    const { axis, plane } = source.userData.liveMirror;
    const data = serializeObject(source);
    delete data.id;
    data.name = `${source.name} ${axis.toUpperCase()} mirror`;
    data.linkId = null;
    data.linkColor = null;
    data.liveMirror = null;
    const copy = addObject(data, { record: false, select: false, update: false });
    const center = new THREE.Vector3();
    center[axis] = Number(plane) || 0;
    mirrorMeshAcrossWorldPlane(copy, axis, center);
    source.userData.liveMirror = null;
    return copy;
  });
  checkedIds.clear();
  copies.forEach(copy => checkedIds.add(copy.userData.id));
  selected = copies.at(-1) || null;
  currentTransformTargetKey = "";
  updateAll();
  log(`Applied Live Mirror and created ${copies.length} independent editable mirrored part${copies.length === 1 ? "" : "s"}. Undo restores the live preview.`);
  return copies;
}

function replaceEditableMeshGeometry(mesh, geometry) {
  if (!mesh || !geometry) return;
  mesh.geometry.dispose();
  mesh.geometry = geometry;
  mesh.userData.shape = "custom";
  mesh.userData.geometry = geometryToData(geometry);
  mesh.userData.bevel = null;
  mesh.userData.depth = null;
  mesh.userData.direction = null;
  mesh.userData.cuts = null;
}

function selectedFacePlaneData() {
  if (!selectedFace?.mesh) return null;
  const regionFaces = selectedFaces.filter(face => face.mesh === selectedFace.mesh);
  const faces = regionFaces.length ? regionFaces : [selectedFace];
  const points = [];
  for (const face of faces) {
    for (const point of face.localTrianglePoints) {
      points.push(point.clone().applyMatrix4(face.mesh.matrixWorld));
    }
  }
  if (!points.length) return null;
  const center = points.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / points.length);
  const { xAxis, yAxis, zAxis } = faceFrame(selectedFace);
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(zAxis.clone(), center.clone());
  const planeToWorld = new THREE.Matrix4().makeBasis(xAxis.clone(), yAxis.clone(), zAxis.clone());
  planeToWorld.setPosition(center.clone());
  const worldToPlane = planeToWorld.clone().invert();
  return {
    mesh: selectedFace.mesh,
    center,
    xAxis,
    yAxis,
    zAxis,
    plane,
    planeToWorld,
    worldToPlane
  };
}

function selectedFaceBoundaryLoops(planeData) {
  if (!planeData?.mesh) return [];
  const regionFaces = selectedFaces.filter(face => face.mesh === planeData.mesh);
  const faces = regionFaces.length ? regionFaces : (selectedFace?.mesh === planeData.mesh ? [selectedFace] : []);
  if (!faces.length) return [];
  planeData.mesh.updateMatrixWorld(true);
  const triangles = faces.map(face =>
    face.localTrianglePoints.map(point => point.clone().applyMatrix4(planeData.mesh.matrixWorld))
  );
  return boundaryLoopsFromWorldTriangles(triangles);
}

function triangleSignatureSetForSelection(mesh) {
  const regionFaces = selectedFaces.filter(face => face.mesh === mesh);
  const faces = regionFaces.length ? regionFaces : (selectedFace?.mesh === mesh ? [selectedFace] : []);
  return new Set(faces.map(face => triangleSignature(face.localTrianglePoints)));
}

function removeSelectedFaceRegionFromMesh(mesh) {
  const signatures = triangleSignatureSetForSelection(mesh);
  if (!signatures.size) return null;
  const source = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  const position = source.getAttribute("position");
  const uv = source.getAttribute("uv");
  const keptPositions = [];
  const keptUvs = [];
  let removed = 0;

  for (let i = 0; i < position.count; i += 3) {
    const localTriangle = [0, 1, 2].map(offset => new THREE.Vector3(
      position.getX(i + offset),
      position.getY(i + offset),
      position.getZ(i + offset)
    ));
    if (signatures.has(triangleSignature(localTriangle))) {
      removed++;
      continue;
    }
    for (let offset = 0; offset < 3; offset++) {
      keptPositions.push(position.getX(i + offset), position.getY(i + offset), position.getZ(i + offset));
      if (uv) keptUvs.push(uv.getX(i + offset), uv.getY(i + offset));
    }
  }

  source.dispose();
  return { removed, keptPositions, keptUvs, hadUv: Boolean(uv) };
}

function projectedLoopArea(loop, worldToPlane) {
  const points2 = loop.map(point => {
    const projected = point.clone().applyMatrix4(worldToPlane);
    return new THREE.Vector2(projected.x, projected.y);
  });
  return Math.abs(THREE.ShapeUtils.area(points2));
}

function planePointToWorld(point2, planeData) {
  return new THREE.Vector3(point2.x, point2.y, 0).applyMatrix4(planeData.planeToWorld);
}

function loopCentroid2D(points) {
  return points.reduce((sum, point) => sum.add(point), new THREE.Vector2()).multiplyScalar(1 / Math.max(1, points.length));
}

function normalizeFacePatchLoops(outerLoopWorld, holeLoopsPlane, planeData) {
  const outer2D = outerLoopWorld.map(point => {
    const projected = point.clone().applyMatrix4(planeData.worldToPlane);
    return new THREE.Vector2(projected.x, projected.y);
  });
  if (outer2D.length < 3) return null;
  const outerClockWise = THREE.ShapeUtils.isClockWise(outer2D);
  const orderedOuter2D = outerClockWise ? outer2D : [...outer2D].reverse();
  const orderedOuterWorld = outerClockWise
    ? outerLoopWorld.map(point => point.clone())
    : [...outerLoopWorld].reverse().map(point => point.clone());

  const holes2D = [];
  for (const loop of holeLoopsPlane) {
    const points2 = loop.map(point => new THREE.Vector2(point.x, point.y));
    if (points2.length < 3) continue;
    const center2 = loopCentroid2D(points2);
    if (!pointInPolygon2D(center2, orderedOuter2D)) continue;
    holes2D.push(THREE.ShapeUtils.isClockWise(points2) ? [...points2].reverse() : points2);
  }

  return {
    outer2D: orderedOuter2D,
    outerWorld: orderedOuterWorld,
    holes2D
  };
}

function makeFaceHolePatchData(planeData, outerLoopWorld, holeLoopsPlane, { includeUv = false } = {}) {
  const normalized = normalizeFacePatchLoops(outerLoopWorld, holeLoopsPlane, planeData);
  if (!normalized) return null;
  const { outer2D, outerWorld, holes2D } = normalized;
  const triangles = THREE.ShapeUtils.triangulateShape(outer2D, holes2D);
  if (!triangles.length) return null;

  const flat2D = [...outer2D, ...holes2D.flat()];
  const flatWorld = [
    ...outerWorld,
    ...holes2D.flat().map(point => planePointToWorld(point, planeData))
  ];
  const all2D = [...outer2D, ...holes2D.flat()];
  const minX = Math.min(...all2D.map(point => point.x));
  const maxX = Math.max(...all2D.map(point => point.x));
  const minY = Math.min(...all2D.map(point => point.y));
  const maxY = Math.max(...all2D.map(point => point.y));
  const spanX = Math.max(1e-6, maxX - minX);
  const spanY = Math.max(1e-6, maxY - minY);
  const positions = [];
  const uvs = [];
  const uvFor = point => new THREE.Vector2((point.x - minX) / spanX, (point.y - minY) / spanY);

  for (const face of triangles) {
    const worldA = flatWorld[face[0]].clone();
    const worldB = flatWorld[face[1]].clone();
    const worldC = flatWorld[face[2]].clone();
    const uvA = uvFor(flat2D[face[0]]);
    const uvB = uvFor(flat2D[face[1]]);
    const uvC = uvFor(flat2D[face[2]]);
    const aligned = new THREE.Vector3()
      .crossVectors(worldB.clone().sub(worldA), worldC.clone().sub(worldA))
      .dot(planeData.zAxis) >= 0;
    const worldTriangle = aligned ? [worldA, worldB, worldC] : [worldA, worldC, worldB];
    const uvTriangle = aligned ? [uvA, uvB, uvC] : [uvA, uvC, uvB];
    positions.push(...worldTriangle.flatMap(point => vecArray(point)));
    if (includeUv) {
      for (const uvPoint of uvTriangle) uvs.push(round(uvPoint.x), round(uvPoint.y));
    }
  }

  return { positions, uvs };
}

function applyPatchToEditableMesh(mesh, buffers, patchData) {
  const inverseWorld = mesh.matrixWorld.clone().invert();
  const positions = [...buffers.keptPositions];
  const uvs = buffers.hadUv ? [...buffers.keptUvs] : [];

  for (let i = 0; i < patchData.positions.length; i += 3) {
    const local = new THREE.Vector3(
      patchData.positions[i],
      patchData.positions[i + 1],
      patchData.positions[i + 2]
    ).applyMatrix4(inverseWorld);
    positions.push(local.x, local.y, local.z);
  }

  if (buffers.hadUv) {
    if (patchData.uvs?.length === (patchData.positions.length / 3) * 2) uvs.push(...patchData.uvs);
    else {
      for (let i = 0; i < patchData.positions.length / 3; i++) uvs.push(.5, .5);
    }
  }

  const geometry = geometryFromPositions(positions);
  if (buffers.hadUv && uvs.length) geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  replaceEditableMeshGeometry(mesh, geometry);
}

function checkedCutterMesh(targetMesh) {
  const checked = checkedObjects().filter(mesh => mesh !== targetMesh);
  if (checked.length === 1) return checked[0];
  const active = activeGroupObjects().filter(mesh => mesh !== targetMesh);
  if (active.length === 1) return active[0];
  const faceMeshes = selectedFaceMeshes().filter(mesh => mesh !== targetMesh);
  if (faceMeshes.length === 1) return faceMeshes[0];
  if (!checked.length && selected && selected !== targetMesh) return selected;
  return null;
}

function geometryInWorldSpace(mesh) {
  mesh.updateMatrixWorld(true);
  const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  geometry.applyMatrix4(mesh.matrixWorld);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function geometryLoopArea2D(loop) {
  if (!loop?.length) return 0;
  let area = 0;
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i];
    const b = loop[(i + 1) % loop.length];
    area += a.x * b.y - b.x * a.y;
  }
  return area * .5;
}

function geometryHasTriangles(geometry) {
  return !!geometry?.getAttribute("position")?.count && geometry.getAttribute("position").count >= 3;
}

function pointInsideWorldGeometry(point, worldGeometry) {
  if (!worldGeometry?.getAttribute?.("position")) return false;
  worldGeometry.computeBoundingBox?.();
  if (worldGeometry.boundingBox && !worldGeometry.boundingBox.containsPoint(point)) return false;
  const source = worldGeometry.index ? worldGeometry.toNonIndexed() : worldGeometry;
  const position = source.getAttribute("position");
  const direction = new THREE.Vector3(.913, .271, .305).normalize();
  const origin = point.clone().addScaledVector(direction, -1e-4);
  const ray = new THREE.Ray(origin, direction);
  const hit = new THREE.Vector3();
  const distances = new Set();

  for (let i = 0; i < position.count; i += 3) {
    const a = new THREE.Vector3(position.getX(i), position.getY(i), position.getZ(i));
    const b = new THREE.Vector3(position.getX(i + 1), position.getY(i + 1), position.getZ(i + 1));
    const c = new THREE.Vector3(position.getX(i + 2), position.getY(i + 2), position.getZ(i + 2));
    const result = ray.intersectTriangle(a, b, c, false, hit);
    if (!result) continue;
    const distance = hit.distanceTo(origin);
    if (distance <= 1e-5) continue;
    distances.add(Math.round(distance * 10000));
  }

  if (source !== worldGeometry) source.dispose();
  return distances.size % 2 === 1;
}

function pushTriangleToBuffers(buffers, triPoints, triUvs, { doubleSided = false } = {}) {
  buffers.positions.push(...triPoints[0], ...triPoints[1], ...triPoints[2]);
  if (buffers.hasUv) {
    for (const uv of triUvs || [new THREE.Vector2(.5, .5), new THREE.Vector2(.5, .5), new THREE.Vector2(.5, .5)]) {
      buffers.uvs.push(uv.x, uv.y);
    }
  }
  if (!doubleSided) return;
  buffers.positions.push(...triPoints[0], ...triPoints[2], ...triPoints[1]);
  if (buffers.hasUv) {
    const duv = triUvs || [new THREE.Vector2(.5, .5), new THREE.Vector2(.5, .5), new THREE.Vector2(.5, .5)];
    buffers.uvs.push(duv[0].x, duv[0].y, duv[2].x, duv[2].y, duv[1].x, duv[1].y);
  }
}

function midVec3(a, b) {
  return a.clone().add(b).multiplyScalar(.5);
}

function midVec2(a, b) {
  if (!a || !b) return null;
  return a.clone().add(b).multiplyScalar(.5);
}

function triangleInsideSampleScore(worldTri, volumeWorldGeometry) {
  const a = worldTri[0];
  const b = worldTri[1];
  const c = worldTri[2];
  const samples = [
    a,
    b,
    c,
    midVec3(a, b),
    midVec3(b, c),
    midVec3(c, a),
    triangleCenter(worldTri)
  ];
  let insideCount = 0;
  for (const point of samples) {
    if (pointInsideWorldGeometry(point, volumeWorldGeometry)) insideCount++;
  }
  return { insideCount, sampleCount: samples.length };
}

function subdivideTriangleForVolume(localTri, worldTri, triUvs, volumeWorldGeometry, kept, removed, {
  insideBothSides = false,
  depth = 2
} = {}) {
  const { insideCount, sampleCount } = triangleInsideSampleScore(worldTri, volumeWorldGeometry);
  if (insideCount === 0) {
    pushTriangleToBuffers(kept, localTri.map(point => point.toArray()), triUvs, { doubleSided: false });
    return;
  }
  if (insideCount === sampleCount) {
    pushTriangleToBuffers(removed, localTri.map(point => point.toArray()), triUvs, { doubleSided: insideBothSides });
    return;
  }
  if (depth <= 0) {
    pushTriangleToBuffers(
      insideCount >= Math.ceil(sampleCount / 2) ? removed : kept,
      localTri.map(point => point.toArray()),
      triUvs,
      { doubleSided: insideCount >= Math.ceil(sampleCount / 2) && insideBothSides }
    );
    return;
  }

  const [la, lb, lc] = localTri;
  const [wa, wb, wc] = worldTri;
  const [ua, ub, uc] = triUvs || [null, null, null];
  const lab = midVec3(la, lb);
  const lbc = midVec3(lb, lc);
  const lca = midVec3(lc, la);
  const wab = midVec3(wa, wb);
  const wbc = midVec3(wb, wc);
  const wca = midVec3(wc, wa);
  const uab = midVec2(ua, ub);
  const ubc = midVec2(ub, uc);
  const uca = midVec2(uc, ua);
  const parts = [
    [[la, lab, lca], [wa, wab, wca], triUvs ? [ua, uab, uca] : null],
    [[lab, lb, lbc], [wab, wb, wbc], triUvs ? [uab, ub, ubc] : null],
    [[lca, lbc, lc], [wca, wbc, wc], triUvs ? [uca, ubc, uc] : null],
    [[lab, lbc, lca], [wab, wbc, wca], triUvs ? [uab, ubc, uca] : null]
  ];
  for (const [nextLocal, nextWorld, nextUvs] of parts) {
    subdivideTriangleForVolume(nextLocal, nextWorld, nextUvs, volumeWorldGeometry, kept, removed, {
      insideBothSides,
      depth: depth - 1
    });
  }
}

function splitEditableMeshByWorldVolume(mesh, volumeWorldGeometry, { insideBothSides = false } = {}) {
  const source = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  const position = source.getAttribute("position");
  const uv = source.getAttribute("uv");
  const kept = { positions: [], uvs: [], hasUv: Boolean(uv) };
  const removed = { positions: [], uvs: [], hasUv: Boolean(uv) };
  mesh.updateMatrixWorld(true);
  volumeWorldGeometry.computeBoundingBox?.();
  const volumeBounds = volumeWorldGeometry.boundingBox?.clone();

  for (let i = 0; i < position.count; i += 3) {
    const localTri = [0, 1, 2].map(offset => new THREE.Vector3(
      position.getX(i + offset),
      position.getY(i + offset),
      position.getZ(i + offset)
    ));
    const worldTri = localTri.map(point => point.clone().applyMatrix4(mesh.matrixWorld));
    const triUvs = uv
      ? [0, 1, 2].map(offset => new THREE.Vector2(uv.getX(i + offset), uv.getY(i + offset)))
      : null;
    if (volumeBounds && !triangleWorldBounds(worldTri).intersectsBox(volumeBounds)) {
      pushTriangleToBuffers(kept, localTri.map(point => point.toArray()), triUvs, { doubleSided: false });
      continue;
    }
    subdivideTriangleForVolume(localTri, worldTri, triUvs, volumeWorldGeometry, kept, removed, {
      insideBothSides,
      depth: 2
    });
  }

  source.dispose();
  return { kept, removed };
}

function geometryFromBuffers(buffers) {
  if (!buffers?.positions?.length) return null;
  const geometry = geometryFromPositions(buffers.positions);
  if (buffers.hasUv && buffers.uvs.length) geometry.setAttribute("uv", new THREE.Float32BufferAttribute(buffers.uvs, 2));
  return geometry;
}

function triangleWorldBounds(worldTri) {
  return new THREE.Box3().setFromPoints(worldTri);
}

function addSubsetMeshFromGeometry(baseMesh, geometry, suffix) {
  if (!geometryHasTriangles(geometry)) {
    geometry?.dispose?.();
    return null;
  }
  const spec = serializeObject(baseMesh);
  const created = addObject({
    ...spec,
    name: `${baseMesh.name} ${suffix}`,
    shape: "custom",
    geometry: geometryToData(geometry),
    bevel: null,
    depth: null,
    direction: null,
    cuts: null
  }, { record: false });
  geometry.dispose();
  return created;
}

function cutMeshByProjectedLoops(mesh, planeData, loops) {
  if (!mesh || !loops?.length) return 0;
  const source = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  const position = source.getAttribute("position");
  const uv = source.getAttribute("uv");
  const keptPositions = [];
  const keptUvs = [];
  const polygons = loops
    .map(loop => loop.map(point => new THREE.Vector2(point.x, point.y)))
    .filter(loop => loop.length >= 3 && Math.abs(geometryLoopArea2D(loop)) > 1e-6);
  if (!polygons.length) {
    source.dispose();
    return 0;
  }
  const flatPoints = polygons.flat();
  const spanX = Math.max(...flatPoints.map(point => point.x)) - Math.min(...flatPoints.map(point => point.x));
  const spanY = Math.max(...flatPoints.map(point => point.y)) - Math.min(...flatPoints.map(point => point.y));
  const tolerance = Math.max(.015, Math.min(.15, Math.max(spanX, spanY) * .08));
  let removed = 0;

  mesh.updateMatrixWorld(true);
  for (let i = 0; i < position.count; i += 3) {
    const worldTri = [0, 1, 2].map(offset => new THREE.Vector3(
      position.getX(i + offset),
      position.getY(i + offset),
      position.getZ(i + offset)
    ).applyMatrix4(mesh.matrixWorld));
    const centroid = triangleCenter(worldTri);
    const planeDistance = Math.max(...worldTri.map(point => Math.abs(planeData.plane.distanceToPoint(point))));
    const planePoint = centroid.clone().applyMatrix4(planeData.worldToPlane);
    const inside = planeDistance <= tolerance
      && polygons.some(loop => pointInPolygon2D(new THREE.Vector2(planePoint.x, planePoint.y), loop));
    if (inside) {
      removed++;
      continue;
    }
    for (let offset = 0; offset < 3; offset++) {
      keptPositions.push(position.getX(i + offset), position.getY(i + offset), position.getZ(i + offset));
      if (uv) keptUvs.push(uv.getX(i + offset), uv.getY(i + offset));
    }
  }

  source.dispose();
  if (!removed) return 0;
  const geometry = geometryFromPositions(keptPositions);
  if (keptUvs.length) geometry.setAttribute("uv", new THREE.Float32BufferAttribute(keptUvs, 2));
  replaceEditableMeshGeometry(mesh, geometry);
  clearMarkers(mesh.userData.id);
  return removed;
}

function carveSelectedFaceByCutter({ splitCutter = false, actionLabel = "cut face from cutter" } = {}) {
  const planeData = selectedFacePlaneData();
  if (!planeData?.mesh) return null;
  const target = planeData.mesh;
  const cutter = checkedCutterMesh(target);
  if (!cutter || cutter === target) return null;

  const cutterWorld = geometryInWorldSpace(cutter);
  const cutterPlane = cutterWorld.clone();
  cutterPlane.applyMatrix4(planeData.worldToPlane);
  cutterPlane.computeBoundingBox();
  const cutterCenter = cutterPlane.boundingBox?.getCenter(new THREE.Vector3()) || new THREE.Vector3();
  const keepInsideSide = cutterCenter.z >= 0 ? "negative" : "positive";
  const keepOutsideSide = keepInsideSide === "negative" ? "positive" : "negative";
  const insideResult = clipGeometryCoordinate(cutterPlane, {
    axis: "z",
    plane: 0,
    keepSide: keepInsideSide,
    cap: false,
    returnLoops: true
  });
  const outsideGeometry = clipGeometryCoordinate(cutterPlane, {
    axis: "z",
    plane: 0,
    keepSide: keepOutsideSide,
    cap: false
  });
  cutterWorld.dispose();
  cutterPlane.dispose();

  const holeLoops = (insideResult.loops || []).filter(loop => loop.length >= 3);
  if (!holeLoops.length) {
    insideResult.geometry.dispose();
    outsideGeometry.dispose();
    return null;
  }

  const faceLoops = selectedFaceBoundaryLoops(planeData);
  const outerLoop = faceLoops.reduce((best, loop) => {
    if (!best) return loop;
    return projectedLoopArea(loop, planeData.worldToPlane) > projectedLoopArea(best, planeData.worldToPlane)
      ? loop
      : best;
  }, null);
  const replacement = removeSelectedFaceRegionFromMesh(target);
  const patchData = outerLoop
    ? makeFaceHolePatchData(planeData, outerLoop, holeLoops, { includeUv: Boolean(target.geometry.getAttribute("uv")) })
    : null;
  if (!replacement?.removed || !patchData?.positions?.length) {
    insideResult.geometry.dispose();
    outsideGeometry.dispose();
    return null;
  }

  recordHistory(actionLabel);
  applyPatchToEditableMesh(target, replacement, patchData);
  clearMarkers(target.userData.id);

  const created = [];
  if (splitCutter) {
    const cutterSpec = serializeObject(cutter);
    const cutterMatrixWorld = cutter.matrixWorld.clone();
    removeObject(cutter, { record: false });
    const createReplacement = (planeGeometry, suffix) => {
      if (!geometryHasTriangles(planeGeometry)) {
        planeGeometry.dispose();
        return null;
      }
      planeGeometry.applyMatrix4(planeData.planeToWorld);
      const localGeometry = planeGeometry.clone();
      localGeometry.applyMatrix4(new THREE.Matrix4().copy(cutterMatrixWorld).invert());
      const createdMesh = addObject({
        ...cutterSpec,
        name: `${cutter.name} ${suffix}`,
        shape: "custom",
        geometry: geometryToData(localGeometry),
        bevel: null,
        depth: null,
        direction: null,
        cuts: null
      }, { record: false });
      planeGeometry.dispose();
      localGeometry.dispose();
      return createdMesh;
    };
    created.push(
      createReplacement(insideResult.geometry, "cavity"),
      createReplacement(outsideGeometry, "remainder")
    );
  } else {
    insideResult.geometry.dispose();
    outsideGeometry.dispose();
  }

  clearSelectedTriangles();
  selectObject(created.find(Boolean) || target);
  updateAll();
  return {
    target,
    cutter,
    removedTriangles: replacement.removed,
    created: created.filter(Boolean)
  };
}

function cutWholeMeshByCutter() {
  const selection = cutterActionSelection();
  const cutter = selection.cutter;
  const targets = selection.targets;
  if (!cutter || !targets.length) return null;
  const cutterWorld = geometryInWorldSpace(cutter);
  const created = [];
  let totalRemoved = 0;

  recordHistory("cut whole mesh by cutter");
  for (const target of targets) {
    const split = splitEditableMeshByWorldVolume(target, cutterWorld, { insideBothSides: false });
    const keptGeometry = geometryFromBuffers(split.kept);
    const removedGeometry = geometryFromBuffers(split.removed);
    if (!geometryHasTriangles(removedGeometry)) {
      keptGeometry?.dispose?.();
      removedGeometry?.dispose?.();
      continue;
    }
    totalRemoved += Math.round(split.removed.positions.length / 9);
    replaceEditableMeshGeometry(target, keptGeometry);
    clearMarkers(target.userData.id);
    const extracted = addSubsetMeshFromGeometry(target, removedGeometry, "cutout");
    if (extracted) created.push(extracted);
  }
  cutterWorld.dispose();

  if (!created.length && !totalRemoved) return null;
  clearSelectedTriangles();
  selectObject(created[0] || targets[0]);
  updateAll();
  return {
    targets,
    cutter,
    created,
    removedTriangles: totalRemoved
  };
}

function digWholeMeshByCutter() {
  const selection = cutterActionSelection();
  const cutter = selection.cutter;
  const targets = selection.targets;
  if (!cutter || !targets.length) return null;
  const cutterWorld = geometryInWorldSpace(cutter);
  const cavities = [];
  let totalRemoved = 0;

  recordHistory("dig whole mesh by cutter");
  for (const target of targets) {
    const targetWorld = geometryInWorldSpace(target);
    const targetSplit = splitEditableMeshByWorldVolume(target, cutterWorld, { insideBothSides: false });
    const cutterSplit = splitEditableMeshByWorldVolume(cutter, targetWorld, { insideBothSides: true });
    targetWorld.dispose();

    const keptGeometry = geometryFromBuffers(targetSplit.kept);
    const cavityGeometry = geometryFromBuffers(cutterSplit.removed);
    if (!targetSplit.removed.positions.length || !geometryHasTriangles(cavityGeometry)) {
      keptGeometry?.dispose?.();
      cavityGeometry?.dispose?.();
      continue;
    }

    totalRemoved += Math.round(targetSplit.removed.positions.length / 9);
    replaceEditableMeshGeometry(target, keptGeometry);
    clearMarkers(target.userData.id);
    const cavity = addSubsetMeshFromGeometry(target, cavityGeometry, "cavity");
    if (cavity) cavities.push(cavity);
  }
  cutterWorld.dispose();
  if (!cavities.length && !totalRemoved) return null;
  removeObject(cutter, { record: false });
  clearSelectedTriangles();
  selectObject(cavities[0] || targets[0]);
  updateAll();
  return {
    targets,
    cutter,
    created: cavities,
    removedTriangles: totalRemoved
  };
}

function digIntoSelectedFace() {
  const faceResult = selectedFacePlaneData()?.mesh
    ? carveSelectedFaceByCutter({ splitCutter: true, actionLabel: "dig into face" })
    : null;
  if (faceResult) {
    log(`Dug ${faceResult.cutter.name} into ${faceResult.target.name}.`, {
      removedFaceTriangles: faceResult.removedTriangles,
      created: faceResult.created.map(mesh => mesh.name),
      hint: "The face now keeps a real opening instead of deleting the whole surface."
    });
    return {
      target: faceResult.target.name,
      cutter: faceResult.cutter.name,
      removedTriangles: faceResult.removedTriangles,
      created: faceResult.created.map(mesh => mesh.name)
    };
  }
  const meshResult = digWholeMeshByCutter();
  if (meshResult) {
    log(`Dug ${meshResult.cutter.name} into ${meshResult.targets.length} target mesh${meshResult.targets.length === 1 ? "" : "es"}.`, {
      removedTriangles: meshResult.removedTriangles,
      created: meshResult.created.map(mesh => mesh.name),
      hint: "Whole-mesh mode cut the shell and built a double-sided cavity from the cutter volume."
    });
    return {
      target: meshResult.targets.map(mesh => mesh.name),
      cutter: meshResult.cutter.name,
      removedTriangles: meshResult.removedTriangles,
      created: meshResult.created.map(mesh => mesh.name)
    };
  }
  log("Pick a face region plus a cutter mesh, or select one target mesh and one cutter mesh, then press Dig Into.");
  setCoplanarFacePickMode(true);
  return null;
}

function projectWorldPointToCanvas(point) {
  const rect = canvas.getBoundingClientRect();
  const projected = point.clone().project(camera);
  return {
    x: (projected.x * .5 + .5) * rect.width,
    y: (-projected.y * .5 + .5) * rect.height,
    z: projected.z
  };
}

function normalizedRect(a, b) {
  return {
    left: Math.min(a.x, b.x),
    right: Math.max(a.x, b.x),
    top: Math.min(a.y, b.y),
    bottom: Math.max(a.y, b.y)
  };
}

function triangleCenterInScreenRect(face, rect) {
  const point = projectWorldPointToCanvas(worldFacePoint(face));
  return point.z >= -1 && point.z <= 1 && point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
}

function selectTrianglesInScreenRect(rect, { append = false } = {}) {
  const picked = [];
  for (const mesh of objects.filter(object => object.visible && !object.userData?.hidden)) {
    for (const face of meshTriangleFaces(mesh)) {
      if (triangleCenterInScreenRect(face, rect)) picked.push(face);
    }
  }
  setTriangleSelection(picked, { append });
  log(`Area-selected ${picked.length} triangle${picked.length === 1 ? "" : "s"}.`, { selected: selectedFaces.length });
  return picked;
}

function connectedTriangleFaces(mesh, seedSignature) {
  const faces = meshTriangleFaces(mesh);
  const vertexToFaces = new Map();
  let seedIndex = -1;
  faces.forEach((face, faceIndex) => {
    if (triangleSignature(face.localTrianglePoints) === seedSignature) seedIndex = faceIndex;
    for (const point of face.localTrianglePoints) {
      const key = vertexKey(point);
      if (!vertexToFaces.has(key)) vertexToFaces.set(key, []);
      vertexToFaces.get(key).push(faceIndex);
    }
  });
  if (seedIndex < 0) return [];
  const visited = new Set([seedIndex]);
  const queue = [seedIndex];
  while (queue.length) {
    const faceIndex = queue.shift();
    for (const point of faces[faceIndex].localTrianglePoints) {
      for (const neighbor of vertexToFaces.get(vertexKey(point)) || []) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
  return [...visited].map(index => faces[index]);
}

function selectConnectedTrianglesFromHit(hit, { append = false } = {}) {
  if (!hit?.object || !hit.face) return [];
  const seed = triangleLocalPoints(hit);
  const faces = connectedTriangleFaces(hit.object, triangleSignature(seed));
  setTriangleSelection(faces, { append });
  log(`Selected connected triangle island on ${hit.object.name}.`, { added: faces.length, selected: selectedFaces.length });
  return faces;
}

function selectCoplanarFaceFromHit(hit, { append = false } = {}) {
  if (!hit?.object || !hit.face) return [];
  const pickedFace = faceFromLocalTriangle(hit.object, triangleLocalPoints(hit), hit.faceIndex, triangleLocalUvs(hit));
  pickedFace.hitPoint = hit.point.clone();
  const faces = coplanarConnectedFaces(pickedFace);
  setTriangleSelection(faces, { append });
  log(`Selected coplanar face region on ${hit.object.name}.`, { added: faces.length, selected: selectedFaces.length });
  return faces;
}

function markerWorldData(marker) {
  const mesh = objects.find(object => object.userData.id === marker.userData.targetId);
  if (!mesh) return null;
  const localTriangle = marker.userData.localTriangle.map(point => new THREE.Vector3(...point));
  const localNormal = new THREE.Vector3(...marker.userData.localNormal);
  const trianglePoints = localTriangle.map(point => point.applyMatrix4(mesh.matrixWorld));
  const normalWorld = localNormal.transformDirection(mesh.matrixWorld).normalize();
  return { mesh, trianglePoints, normalWorld, point: triangleCenter(trianglePoints) };
}

function redrawMarker(marker) {
  const data = markerWorldData(marker);
  if (!data) return;
  marker.children.forEach(disposeObject3D);
  marker.clear();
  const fill = new THREE.Mesh(
    makeTriangleGeometry(data.trianglePoints, data.normalWorld, .003),
    new THREE.MeshBasicMaterial({
      color: "#e1b14b",
      transparent: true,
      opacity: .28,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    })
  );
  const linePoints = [...data.trianglePoints.map(point => point.clone().addScaledVector(data.normalWorld, .004)), data.trianglePoints[0].clone().addScaledVector(data.normalWorld, .004)];
  const outline = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(linePoints),
    new THREE.LineBasicMaterial({ color: "#ffd36a", transparent: true, opacity: .9, depthWrite: false })
  );
  marker.add(fill, outline);
  marker.userData.point = data.point.toArray().map(round);
  marker.userData.normal = data.normalWorld.toArray().map(round);
  marker.userData.triangle = data.trianglePoints.map(point => point.toArray().map(round));
}

function updateTriangleHelpers() {
  objects.forEach(object => object.updateMatrixWorld(true));
  updateFaceMarker();
  markerHelpers.forEach(redrawMarker);
}

function toggleMarkerForFace(face) {
  const { mesh, markerKey, faceIndex } = face;
  const existingIndex = markerHelpers.findIndex(marker => marker.userData.markerKey === markerKey);
  if (existingIndex >= 0) {
    const removed = removeMarkerAt(existingIndex);
    log(`Removed marker from ${removed.userData.targetName}.`, { triangle: removed.userData.faceIndex });
    return "removed";
  }

  const marker = new THREE.Group();
  marker.name = `marker ${markerHelpers.length + 1}`;
  marker.userData = {
    marker: true,
    markerKey,
    targetId: mesh.userData.id,
    targetName: mesh.name,
    faceIndex,
    localPoint: face.localPoint.toArray().map(round),
    localNormal: face.localNormal.toArray().map(round),
    localTriangle: face.localTrianglePoints.map(point => point.toArray().map(round)),
    point: [],
    normal: [],
    triangle: []
  };
  redrawMarker(marker);
  markerGroup.add(marker);
  markerHelpers.push(marker);
  log(`Placed marker on ${mesh.name}. Click Marker again on the same triangle to remove it.`, { triangle: faceIndex });
  return "added";
}

function worldEulerFromNormal(normalWorld) {
  return new THREE.Euler().setFromQuaternion(
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normalWorld),
    "XYZ"
  );
}

function worldEulerFromAxes(xAxis, yAxis, zAxis) {
  const basis = new THREE.Matrix4().makeBasis(
    xAxis.clone().normalize(),
    yAxis.clone().normalize(),
    zAxis.clone().normalize()
  );
  const quaternion = new THREE.Quaternion().setFromRotationMatrix(basis);
  return new THREE.Euler().setFromQuaternion(quaternion, "XYZ");
}

function faceLocalToWorldVector(face, localVector, widthScale = 1, heightScale = 1) {
  const vector = face.u.clone().multiplyScalar(localVector.x * widthScale)
    .add(face.v.clone().multiplyScalar(localVector.y * heightScale));
  return vector.transformDirection(face.mesh.matrixWorld);
}

function currentFaceSize(face) {
  const points = worldTrianglePoints(face);
  const u = face.u.clone().transformDirection(face.mesh.matrixWorld).normalize();
  const v = face.v.clone().transformDirection(face.mesh.matrixWorld).normalize();
  const us = points.map(point => point.dot(u));
  const vs = points.map(point => point.dot(v));
  return {
    width: Math.max(.08, Math.max(...us) - Math.min(...us)),
    height: Math.max(.08, Math.max(...vs) - Math.min(...vs))
  };
}

function faceFrame(face) {
  const zAxis = worldFaceNormal(face);
  let xAxis = face.u.clone().transformDirection(face.mesh.matrixWorld).normalize();
  xAxis.addScaledVector(zAxis, -xAxis.dot(zAxis)).normalize();
  if (xAxis.lengthSq() < .001) xAxis = new THREE.Vector3(1, 0, 0).addScaledVector(zAxis, -zAxis.x).normalize();
  const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize();
  return { xAxis, yAxis, zAxis };
}

function vecArray(vector) {
  return [vector.x, vector.y, vector.z];
}

function faceEditDepth({ min = .03, max = 3 } = {}) {
  return Math.max(min, Math.min(max, +els.bevelDepthInput.value || .18));
}

function dragPushStepSize({ min = .001, max = 1 } = {}) {
  return Math.max(min, Math.min(max, +els.dragPushStepInput.value || .01));
}

function coplanarConnectedFaces(seedFace) {
  if (!seedFace?.mesh) return [seedFace];
  const faces = meshTriangleFaces(seedFace.mesh);
  const vertexToFaces = new Map();
  const seedSignature = triangleSignature(seedFace.localTrianglePoints);
  const seedNormal = seedFace.localNormal.clone().normalize();
  const seedPlane = seedFace.localTrianglePoints[0].dot(seedNormal);
  const normalTolerance = .999;
  const planeTolerance = .0015;
  let seedIndex = -1;

  faces.forEach((face, faceIndex) => {
    if (triangleSignature(face.localTrianglePoints) === seedSignature) seedIndex = faceIndex;
    for (const point of face.localTrianglePoints) {
      const key = vertexKey(point);
      if (!vertexToFaces.has(key)) vertexToFaces.set(key, []);
      vertexToFaces.get(key).push(faceIndex);
    }
  });
  if (seedIndex < 0) return [seedFace];

  const visited = new Set([seedIndex]);
  const queue = [seedIndex];
  while (queue.length) {
    const faceIndex = queue.shift();
    const current = faces[faceIndex];
    for (const point of current.localTrianglePoints) {
      for (const neighborIndex of vertexToFaces.get(vertexKey(point)) || []) {
        if (visited.has(neighborIndex)) continue;
        const neighbor = faces[neighborIndex];
        const aligned = Math.abs(neighbor.localNormal.clone().normalize().dot(seedNormal)) >= normalTolerance;
        if (!aligned) continue;
        const coplanar = neighbor.localTrianglePoints.every(vertex => Math.abs(vertex.dot(seedNormal) - seedPlane) <= planeTolerance);
        if (!coplanar) continue;
        visited.add(neighborIndex);
        queue.push(neighborIndex);
      }
    }
  }
  return [...visited].map(index => faces[index]);
}

function faceRegionBounds(face) {
  const regionFaces = coplanarConnectedFaces(face);
  const uniqueVertices = new Map();
  for (const regionFace of regionFaces) {
    for (const point of regionFace.localTrianglePoints) {
      const key = vertexKey(point);
      if (!uniqueVertices.has(key)) uniqueVertices.set(key, point.clone());
    }
  }
  const points = [...uniqueVertices.values()];
  if (!points.length) points.push(...face.localTrianglePoints.map(point => point.clone()));
  const u = face.u.clone().normalize();
  const v = face.v.clone().normalize();
  const n = face.localNormal.clone().normalize();
  const us = points.map(point => point.dot(u));
  const vs = points.map(point => point.dot(v));
  const ns = points.map(point => point.dot(n));
  const minU = Math.min(...us);
  const maxU = Math.max(...us);
  const minV = Math.min(...vs);
  const maxV = Math.max(...vs);
  const centerU = (minU + maxU) / 2;
  const centerV = (minV + maxV) / 2;
  const centerN = ns.reduce((sum, value) => sum + value, 0) / Math.max(1, ns.length);
  const localCenter = u.clone().multiplyScalar(centerU)
    .add(v.clone().multiplyScalar(centerV))
    .add(n.clone().multiplyScalar(centerN));
  const worldCenter = localCenter.clone().applyMatrix4(face.mesh.matrixWorld);
  const { xAxis, yAxis, zAxis } = faceFrame(face);
  return {
    width: Math.max(.08, maxU - minU),
    height: Math.max(.08, maxV - minV),
    localCenter,
    worldCenter,
    xAxis,
    yAxis,
    zAxis,
    faceCount: regionFaces.length,
    boundary: coplanarRegionBoundary(regionFaces, localCenter, u, v)
  };
}

function coplanarRegionBoundary(regionFaces, localCenter, u, v) {
  const edgeRecords = new Map();
  for (const regionFace of regionFaces) {
    const points = regionFace.localTrianglePoints;
    for (let index = 0; index < 3; index++) {
      const a = points[index];
      const b = points[(index + 1) % 3];
      const aKey = vertexKey(a);
      const bKey = vertexKey(b);
      const key = aKey < bKey ? `${aKey}|${bKey}` : `${bKey}|${aKey}`;
      const record = edgeRecords.get(key);
      if (record) record.count++;
      else edgeRecords.set(key, { count: 1, a: a.clone(), b: b.clone(), aKey, bKey });
    }
  }

  const boundaryEdges = [...edgeRecords.values()].filter(record => record.count === 1);
  if (boundaryEdges.length < 3) return [];
  const adjacency = new Map();
  const addAdjacent = (key, edgeIndex) => {
    if (!adjacency.has(key)) adjacency.set(key, []);
    adjacency.get(key).push(edgeIndex);
  };
  boundaryEdges.forEach((edge, edgeIndex) => {
    addAdjacent(edge.aKey, edgeIndex);
    addAdjacent(edge.bKey, edgeIndex);
  });

  const loops = [];
  const unused = new Set(boundaryEdges.map((_, index) => index));
  while (unused.size) {
    const firstIndex = unused.values().next().value;
    const first = boundaryEdges[firstIndex];
    unused.delete(firstIndex);
    const loop = [first.a.clone(), first.b.clone()];
    const startKey = first.aKey;
    let currentKey = first.bKey;
    let guard = 0;
    while (currentKey !== startKey && guard++ <= boundaryEdges.length) {
      const nextIndex = (adjacency.get(currentKey) || []).find(index => unused.has(index));
      if (nextIndex == null) break;
      unused.delete(nextIndex);
      const next = boundaryEdges[nextIndex];
      if (next.aKey === currentKey) {
        loop.push(next.b.clone());
        currentKey = next.bKey;
      } else {
        loop.push(next.a.clone());
        currentKey = next.aKey;
      }
    }
    if (currentKey === startKey && loop.length >= 4) {
      loop.pop();
      const projected = loop.map(point => {
        const offset = point.clone().sub(localCenter);
        return new THREE.Vector2(offset.dot(u), offset.dot(v));
      });
      loops.push(projected);
    }
  }
  if (!loops.length) return [];
  const polygonArea = polygon => polygon.reduce((sum, point, index) => {
    const next = polygon[(index + 1) % polygon.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0) / 2;
  const outer = loops.sort((a, b) => Math.abs(polygonArea(b)) - Math.abs(polygonArea(a)))[0];
  if (polygonArea(outer) < 0) outer.reverse();
  return outer;
}

function insetConvexPolygon(points, distance) {
  const cross2 = (a, b) => a.x * b.y - a.y * b.x;
  const result = [];
  for (let index = 0; index < points.length; index++) {
    const previous = points[(index - 1 + points.length) % points.length];
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const previousDirection = current.clone().sub(previous).normalize();
    const nextDirection = next.clone().sub(current).normalize();
    const previousNormal = new THREE.Vector2(-previousDirection.y, previousDirection.x);
    const nextNormal = new THREE.Vector2(-nextDirection.y, nextDirection.x);
    const previousLine = current.clone().addScaledVector(previousNormal, distance);
    const nextLine = current.clone().addScaledVector(nextNormal, distance);
    const denominator = cross2(previousDirection, nextDirection);
    if (Math.abs(denominator) < .000001) {
      result.push(current.clone().add(previousNormal.add(nextNormal).normalize().multiplyScalar(distance)));
      continue;
    }
    const offset = nextLine.clone().sub(previousLine);
    const amount = cross2(offset, nextDirection) / denominator;
    result.push(previousLine.addScaledVector(previousDirection, amount));
  }
  return result;
}

function makeInsetBeveledPolygonGeometry({ boundary, bevel, innerZ }) {
  const inner = insetConvexPolygon(boundary, bevel);
  const positions = [];
  for (let index = 0; index < boundary.length; index++) {
    const nextIndex = (index + 1) % boundary.length;
    const outerA = [boundary[index].x, boundary[index].y, 0];
    const outerB = [boundary[nextIndex].x, boundary[nextIndex].y, 0];
    const innerA = [inner[index].x, inner[index].y, innerZ];
    const innerB = [inner[nextIndex].x, inner[nextIndex].y, innerZ];
    positions.push(...outerA, ...outerB, ...innerB, ...outerA, ...innerB, ...innerA);
  }
  for (const triangle of THREE.ShapeUtils.triangulateShape(inner, [])) {
    positions.push(...triangle.flatMap(index => [inner[index].x, inner[index].y, innerZ]));
  }
  return { positions };
}

function connectedFaceDistance(face, fallback) {
  if (!els.connectFaceInput.checked) return fallback;
  const origin = worldFacePoint(face).addScaledVector(worldFaceNormal(face), .02);
  const normal = worldFaceNormal(face);
  const connector = new THREE.Raycaster(origin, normal, .02, fallback + .04);
  const hits = connector.intersectObjects(objects.filter(object => object !== face.mesh && object.visible && !object.userData?.hidden), false);
  const hit = hits.find(item => item.distance > .025);
  return hit ? Math.max(.03, Math.min(fallback, hit.distance - .015)) : fallback;
}

function faceLengthResolver(fallback) {
  return face => connectedFaceDistance(face, fallback);
}

function signedFaceLengthResolver(fallback, direction = 1) {
  const resolve = faceLengthResolver(Math.abs(fallback));
  return face => resolve(face) * Math.sign(direction || 1);
}

function worldScaleAlongLocalNormal(mesh, localNormal) {
  mesh.updateMatrixWorld(true);
  const origin = new THREE.Vector3().applyMatrix4(mesh.matrixWorld);
  const end = localNormal.clone().normalize().applyMatrix4(mesh.matrixWorld);
  return Math.max(.0001, end.distanceTo(origin));
}

function localDisplacementFromWorldVector(mesh, worldVector) {
  mesh.updateMatrixWorld(true);
  const worldPosition = new THREE.Vector3();
  const worldQuaternion = new THREE.Quaternion();
  const worldScale = new THREE.Vector3();
  mesh.matrixWorld.decompose(worldPosition, worldQuaternion, worldScale);
  const local = worldVector.clone().applyQuaternion(worldQuaternion.clone().invert());
  if (Math.abs(worldScale.x) > .000001) local.x /= worldScale.x;
  if (Math.abs(worldScale.y) > .000001) local.y /= worldScale.y;
  if (Math.abs(worldScale.z) > .000001) local.z /= worldScale.z;
  return local;
}

function dragPushWorldAxis(face, axisMode = "normal") {
  if (axisMode === "x") return new THREE.Vector3(1, 0, 0);
  if (axisMode === "y") return new THREE.Vector3(0, 1, 0);
  if (axisMode === "z") return new THREE.Vector3(0, 0, 1);
  return worldFaceNormal(face).normalize();
}

function matchingDisplacement(point, targets, epsilon) {
  const displacement = new THREE.Vector3();
  let matches = 0;
  for (const target of targets) {
    if (point.distanceToSquared(target.point) <= epsilon * epsilon) {
      displacement.add(target.displacement);
      matches++;
    }
  }
  return matches ? displacement.multiplyScalar(1 / matches) : null;
}

function moveSelectedSideVertices(mesh, faces, length) {
  const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  const position = geometry.getAttribute("position");
  const targets = [];
  const epsilon = .0002;

  for (const face of faces) {
    const faceLength = typeof length === "function" ? length(face) : length;
    const normal = face.localNormal.clone().normalize();
    const localLength = faceLength / worldScaleAlongLocalNormal(mesh, normal);
    const displacement = normal.multiplyScalar(localLength);
    for (const point of face.localTrianglePoints) {
      targets.push({ point: point.clone(), displacement: displacement.clone() });
    }
  }

  for (const face of faces) {
    face.localTrianglePoints = face.localTrianglePoints.map(point => {
      const faceDisplacement = matchingDisplacement(point, targets, epsilon) || new THREE.Vector3();
      return point.clone().add(faceDisplacement);
    });
    face.localPoint = triangleCenter(face.localTrianglePoints);
    face.point = face.localPoint.clone().applyMatrix4(mesh.matrixWorld);
    face.hitPoint = face.point.clone();
    face.trianglePoints = face.localTrianglePoints.map(point => point.clone().applyMatrix4(mesh.matrixWorld));
  }

  let movedVertices = 0;
  for (let i = 0; i < position.count; i++) {
    const vertex = new THREE.Vector3(position.getX(i), position.getY(i), position.getZ(i));
    const displacement = matchingDisplacement(vertex, targets, epsilon);
    if (!displacement) continue;
    vertex.add(displacement);
    position.setXYZ(i, vertex.x, vertex.y, vertex.z);
    movedVertices++;
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  mesh.geometry.dispose();
  mesh.geometry = geometry;
  mesh.userData.shape = "custom";
  mesh.userData.geometry = geometryToData(geometry);
  mesh.userData.bevel = null;
  mesh.userData.depth = null;
  mesh.userData.direction = null;
  return movedVertices;
}

function moveSelectedVerticesByWorldDelta(mesh, faces, worldDelta) {
  const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  const position = geometry.getAttribute("position");
  const targets = [];
  const epsilon = .0002;

  for (const face of faces) {
    const requestedDelta = typeof worldDelta === "function" ? worldDelta(face) : worldDelta;
    const displacement = localDisplacementFromWorldVector(mesh, requestedDelta.clone());
    for (const point of face.localTrianglePoints) {
      targets.push({ point: point.clone(), displacement: displacement.clone() });
    }
  }

  for (const face of faces) {
    face.localTrianglePoints = face.localTrianglePoints.map(point => {
      const faceDisplacement = matchingDisplacement(point, targets, epsilon) || new THREE.Vector3();
      return point.clone().add(faceDisplacement);
    });
    face.localPoint = triangleCenter(face.localTrianglePoints);
    face.point = face.localPoint.clone().applyMatrix4(mesh.matrixWorld);
    face.hitPoint = face.point.clone();
    face.trianglePoints = face.localTrianglePoints.map(point => point.clone().applyMatrix4(mesh.matrixWorld));
  }

  let movedVertices = 0;
  for (let i = 0; i < position.count; i++) {
    const vertex = new THREE.Vector3(position.getX(i), position.getY(i), position.getZ(i));
    const displacement = matchingDisplacement(vertex, targets, epsilon);
    if (!displacement) continue;
    vertex.add(displacement);
    position.setXYZ(i, vertex.x, vertex.y, vertex.z);
    movedVertices++;
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  mesh.geometry.dispose();
  mesh.geometry = geometry;
  mesh.userData.shape = "custom";
  mesh.userData.geometry = geometryToData(geometry);
  mesh.userData.bevel = null;
  mesh.userData.depth = null;
  mesh.userData.direction = null;
  return movedVertices;
}

function moveSelectedSurfaceComponentsByWorldDelta(worldDelta) {
  const components = surfaceComponentMode === "vertex" ? selectedSurfaceVertices : selectedSurfaceEdges;
  const byMesh = new Map();
  for (const componentEntry of components) {
    if (!byMesh.has(componentEntry.mesh)) byMesh.set(componentEntry.mesh, []);
    byMesh.get(componentEntry.mesh).push(componentEntry);
  }
  let movedVertices = 0;
  for (const [mesh, meshComponents] of byMesh) {
    const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    const position = geometry.getAttribute("position");
    const targetPoints = surfaceComponentMode === "vertex"
      ? meshComponents.map(vertex => vertex.localPoint)
      : meshComponents.flatMap(edge => [edge.localA, edge.localB]);
    const targetKeys = new Set(targetPoints.map(vertexKey));
    const localDelta = localDisplacementFromWorldVector(mesh, worldDelta.clone());
    const localPoint = new THREE.Vector3();
    for (let index = 0; index < position.count; index++) {
      localPoint.fromBufferAttribute(position, index);
      if (!targetKeys.has(vertexKey(localPoint))) continue;
      localPoint.add(localDelta);
      position.setXYZ(index, localPoint.x, localPoint.y, localPoint.z);
      movedVertices++;
    }
    position.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    replaceEditableMeshGeometry(mesh, geometry);
    for (const componentEntry of meshComponents) {
      if (surfaceComponentMode === "vertex") {
        componentEntry.localPoint.add(localDelta);
        componentEntry.key = surfaceVertexKey(mesh, componentEntry.localPoint);
      } else {
        componentEntry.localA.add(localDelta);
        componentEntry.localB.add(localDelta);
        componentEntry.key = surfaceEdgeKey(mesh, componentEntry.localA, componentEntry.localB);
      }
    }
  }
  updateSurfaceComponentMarker();
  return movedVertices;
}

function moveSelectedVerticesAlongAxis(mesh, faces, distance, axisMode = "normal") {
  return moveSelectedVerticesByWorldDelta(mesh, faces, face => {
    const faceDistance = typeof distance === "function" ? distance(face) : distance;
    return dragPushWorldAxis(face, axisMode).normalize().multiplyScalar(faceDistance);
  });
}

function softMoveFacesByWorldDelta(mesh, faces, worldDelta, radius) {
  mesh.updateWorldMatrix(true, false);
  const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  const position = geometry.getAttribute("position");
  const seeds = faces.flatMap(face => face.localTrianglePoints.map(point => point.clone().applyMatrix4(mesh.matrixWorld)));
  const localDisplacement = localDisplacementFromWorldVector(mesh, worldDelta.clone());
  const localPoint = new THREE.Vector3();
  const worldPoint = new THREE.Vector3();
  let movedVertices = 0;

  for (let index = 0; index < position.count; index++) {
    localPoint.fromBufferAttribute(position, index);
    worldPoint.copy(localPoint).applyMatrix4(mesh.matrixWorld);
    let nearest = Infinity;
    for (const seed of seeds) nearest = Math.min(nearest, worldPoint.distanceTo(seed));
    if (nearest > radius) continue;
    const normalized = Math.max(0, 1 - nearest / radius);
    const weight = normalized * normalized * (3 - 2 * normalized);
    localPoint.addScaledVector(localDisplacement, weight);
    position.setXYZ(index, localPoint.x, localPoint.y, localPoint.z);
    movedVertices++;
  }

  for (const face of faces) {
    face.localTrianglePoints = face.localTrianglePoints.map(point => point.clone().add(localDisplacement));
    face.localPoint = triangleCenter(face.localTrianglePoints);
    face.point = face.localPoint.clone().applyMatrix4(mesh.matrixWorld);
    face.hitPoint = face.point.clone();
    face.trianglePoints = face.localTrianglePoints.map(point => point.clone().applyMatrix4(mesh.matrixWorld));
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  replaceEditableMeshGeometry(mesh, geometry);
  return movedVertices;
}

function softMoveFacesByDistance(mesh, faces, distance, radius, axisMode = "normal") {
  const worldDirection = axisMode === "normal"
    ? faces.reduce((sum, face) => sum.add(worldFaceNormal(face)), new THREE.Vector3()).normalize()
    : dragPushWorldAxis(faces[0], axisMode).normalize();
  return softMoveFacesByWorldDelta(mesh, faces, worldDirection.multiplyScalar(distance), radius);
}

function softMoveSelectedFaces(directionSign = 1) {
  if (!selectedFaces.length) {
    log("Select one or more triangles before using Soft Pull or Soft Push.");
    setFacePickMode(true);
    return [];
  }
  const distance = faceEditDepth() * (directionSign < 0 ? -1 : 1);
  const radius = Math.max(.01, Number(els.softRadiusInput?.value) || .25);
  const axisMode = surfaceAxisMode() === "free" ? "normal" : surfaceAxisMode();
  const facesByMesh = new Map();
  for (const face of selectedFaces) {
    if (!facesByMesh.has(face.mesh)) facesByMesh.set(face.mesh, []);
    facesByMesh.get(face.mesh).push(face);
  }
  recordHistory(directionSign < 0 ? "soft push faces" : "soft pull faces");
  let movedVertices = 0;
  for (const [mesh, faces] of facesByMesh) {
    movedVertices += softMoveFacesByDistance(mesh, faces, distance, radius, axisMode);
  }
  clearSelectedTriangles();
  updateAll();
  log(`${directionSign < 0 ? "Soft Push" : "Soft Pull"} moved ${movedVertices} vertices with radius ${round(radius)}.`, { editedMeshes: facesByMesh.size });
  return [...facesByMesh.keys()];
}

function insetFaceAmount({ min = .001, max = 10 } = {}) {
  return Math.max(min, Math.min(max, Number(els.insetAmountInput?.value) || .10));
}

function selectedFaceRegionIsConnected(faces) {
  if (faces.length <= 1) return true;
  const edgeToFaces = new Map();
  faces.forEach((face, faceIndex) => {
    const keys = face.localTrianglePoints.map(vertexKey);
    [[0, 1], [1, 2], [2, 0]].forEach(([a, b]) => {
      const edgeKey = [keys[a], keys[b]].sort().join("|");
      if (!edgeToFaces.has(edgeKey)) edgeToFaces.set(edgeKey, []);
      edgeToFaces.get(edgeKey).push(faceIndex);
    });
  });
  const adjacency = faces.map(() => new Set());
  for (const linkedFaces of edgeToFaces.values()) {
    for (const faceIndex of linkedFaces) {
      for (const neighborIndex of linkedFaces) {
        if (faceIndex !== neighborIndex) adjacency[faceIndex].add(neighborIndex);
      }
    }
  }
  const visited = new Set([0]);
  const queue = [0];
  while (queue.length) {
    const faceIndex = queue.shift();
    for (const neighborIndex of adjacency[faceIndex]) {
      if (visited.has(neighborIndex)) continue;
      visited.add(neighborIndex);
      queue.push(neighborIndex);
    }
  }
  return visited.size === faces.length;
}

function selectedFaceRegionIsPlanar(faces) {
  if (!faces.length) return false;
  const normal = faces[0].localNormal.clone().normalize();
  const planeOffset = faces[0].localTrianglePoints[0].dot(normal);
  return faces.every(face =>
    face.localNormal.clone().normalize().dot(normal) >= .999
    && face.localTrianglePoints.every(point => Math.abs(point.dot(normal) - planeOffset) <= .0015)
  );
}

function convexPolygon2D(points) {
  if (points.length < 3) return false;
  let winding = 0;
  for (let index = 0; index < points.length; index++) {
    const previous = points[(index - 1 + points.length) % points.length];
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const cross = current.clone().sub(previous).cross(next.clone().sub(current));
    if (Math.abs(cross) <= 1e-7) continue;
    const sign = Math.sign(cross);
    if (!winding) winding = sign;
    else if (winding !== sign) return false;
  }
  return Boolean(winding);
}

function affineUvSampler(faces, localCenter, u, v) {
  const samplesByVertex = new Map();
  for (const face of faces) {
    if (!face.localUvs?.length) continue;
    face.localTrianglePoints.forEach((point, index) => {
      const key = vertexKey(point);
      if (samplesByVertex.has(key)) return;
      const offset = point.clone().sub(localCenter);
      samplesByVertex.set(key, {
        point: new THREE.Vector2(offset.dot(u), offset.dot(v)),
        uv: face.localUvs[index].clone()
      });
    });
  }
  const samples = [...samplesByVertex.values()];
  let anchors = null;
  for (let a = 0; a < samples.length - 2 && !anchors; a++) {
    for (let b = a + 1; b < samples.length - 1 && !anchors; b++) {
      for (let c = b + 1; c < samples.length; c++) {
        const area = Math.abs(samples[b].point.clone().sub(samples[a].point).cross(samples[c].point.clone().sub(samples[a].point)));
        if (area > 1e-7) anchors = [samples[a], samples[b], samples[c]];
      }
    }
  }
  if (!anchors) return null;
  const [a, b, c] = anchors;
  const denominator = (b.point.y - c.point.y) * (a.point.x - c.point.x)
    + (c.point.x - b.point.x) * (a.point.y - c.point.y);
  if (Math.abs(denominator) <= 1e-8) return null;
  return point => {
    const weightA = ((b.point.y - c.point.y) * (point.x - c.point.x)
      + (c.point.x - b.point.x) * (point.y - c.point.y)) / denominator;
    const weightB = ((c.point.y - a.point.y) * (point.x - c.point.x)
      + (a.point.x - c.point.x) * (point.y - c.point.y)) / denominator;
    const weightC = 1 - weightA - weightB;
    return a.uv.clone().multiplyScalar(weightA)
      .addScaledVector(b.uv, weightB)
      .addScaledVector(c.uv, weightC);
  };
}

function buildInsetFacePatch(mesh, faces, requestedInset, buffers) {
  const localNormal = faces[0].localNormal.clone().normalize();
  const u = faces[0].u.clone().normalize();
  const v = faces[0].v.clone().normalize();
  const uniqueVertices = new Map();
  for (const face of faces) {
    for (const point of face.localTrianglePoints) uniqueVertices.set(vertexKey(point), point.clone());
  }
  const localCenter = [...uniqueVertices.values()]
    .reduce((sum, point) => sum.add(point), new THREE.Vector3())
    .multiplyScalar(1 / Math.max(1, uniqueVertices.size));
  let outer = coplanarRegionBoundary(faces, localCenter, u, v);
  if (outer.length < 3) return null;
  if (geometryLoopArea2D(outer) < 0) outer = [...outer].reverse();
  if (!convexPolygon2D(outer)) return { error: "Inset Face currently needs a convex surface." };

  const xs = outer.map(point => point.x);
  const ys = outer.map(point => point.y);
  const maxInset = Math.max(.001, Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * .45);
  let usedInset = Math.min(requestedInset, maxInset);
  let inner = [];
  for (let attempt = 0; attempt < 8; attempt++) {
    inner = insetConvexPolygon(outer, usedInset);
    const valid = inner.length === outer.length
      && inner.every(point => Number.isFinite(point.x) && Number.isFinite(point.y) && pointInPolygon2D(point, outer))
      && Math.abs(geometryLoopArea2D(inner)) > 1e-7;
    if (valid) break;
    usedInset *= .5;
    inner = [];
  }
  if (!inner.length) return { error: "The inset is too large for this surface." };

  const uvFor = buffers.hadUv ? affineUvSampler(faces, localCenter, u, v) : null;
  const localPoint = point => localCenter.clone().addScaledVector(u, point.x).addScaledVector(v, point.y);
  const patchPositions = [];
  const patchUvs = [];
  const centerTriangles = [];
  const addPatchTriangle = (points2, center = false) => {
    let points3 = points2.map(localPoint);
    let uvs = uvFor ? points2.map(uvFor) : null;
    const normal = new THREE.Vector3().crossVectors(
      points3[1].clone().sub(points3[0]),
      points3[2].clone().sub(points3[0])
    );
    if (normal.dot(localNormal) < 0) {
      points3 = [points3[0], points3[2], points3[1]];
      if (uvs) uvs = [uvs[0], uvs[2], uvs[1]];
    }
    const faceIndex = (buffers.keptPositions.length + patchPositions.length) / 9;
    patchPositions.push(...points3.flatMap(point => vecArray(point)));
    if (buffers.hadUv) {
      for (const uv of uvs || [new THREE.Vector2(.5, .5), new THREE.Vector2(.5, .5), new THREE.Vector2(.5, .5)]) {
        patchUvs.push(uv.x, uv.y);
      }
    }
    if (center) centerTriangles.push({ points: points3.map(point => point.clone()), uvs: uvs?.map(uv => uv.clone()) || null, faceIndex });
  };

  for (let index = 0; index < outer.length; index++) {
    const next = (index + 1) % outer.length;
    addPatchTriangle([outer[index], outer[next], inner[next]]);
    addPatchTriangle([outer[index], inner[next], inner[index]]);
  }
  for (const triangle of THREE.ShapeUtils.triangulateShape(inner, [])) {
    addPatchTriangle(triangle.map(index => inner[index]), true);
  }
  return { patchPositions, patchUvs, centerTriangles, usedInset };
}

function insetSelectedFace() {
  if (!selectedFaces.length) {
    log("Select one Triangle or Whole Face before using Inset Face.");
    return [];
  }
  const meshes = [...new Set(selectedFaces.map(face => face.mesh).filter(Boolean))];
  if (meshes.length !== 1) {
    log("Inset Face works on one mesh surface at a time.");
    return [];
  }
  const mesh = meshes[0];
  const faces = selectedFaces.filter(face => face.mesh === mesh);
  if (!selectedFaceRegionIsConnected(faces)) {
    log("Inset Face needs one connected surface selection.");
    return [];
  }
  if (!selectedFaceRegionIsPlanar(faces)) {
    log("Inset Face needs a flat surface. Inset angled regions separately.");
    return [];
  }
  const buffers = removeSelectedFaceRegionFromMesh(mesh);
  if (!buffers?.removed) {
    log("The selected surface could not be found in the editable mesh.");
    return [];
  }
  const requestedInset = insetFaceAmount();
  const patch = buildInsetFacePatch(mesh, faces, requestedInset, buffers);
  if (!patch || patch.error) {
    log(patch?.error || "Could not build an inset for this surface.");
    return [];
  }

  recordHistory("inset selected face");
  const selectedSignatures = new Map([[mesh.userData.id, new Set(faces.map(face => triangleSignature(face.localTrianglePoints)))] ]);
  deleteMarkersByTriangleSignatures(selectedSignatures);
  const positions = [...buffers.keptPositions, ...patch.patchPositions];
  const uvs = buffers.hadUv ? [...buffers.keptUvs, ...patch.patchUvs] : [];
  const geometry = geometryFromPositions(positions);
  if (buffers.hadUv) geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  replaceEditableMeshGeometry(mesh, geometry);
  mesh.updateMatrixWorld(true);

  selectedFaces.length = 0;
  selectedFaces.push(...patch.centerTriangles.map(triangle =>
    faceFromLocalTriangle(mesh, triangle.points, triangle.faceIndex, triangle.uvs)
  ));
  selectedFace = selectedFaces.at(-1) || null;
  clearSelectedSurfaceComponents();
  if (selected !== mesh) selectObject(mesh);
  updateFaceMarker();
  syncSurfaceEditorUi();
  updateAll();
  log(`Inset ${faces.length === 1 ? "triangle" : "surface"} by ${round(patch.usedInset)}. The new center surface stays selected for Push or Pull.`, {
    removedTriangles: buffers.removed,
    selectedCenterTriangles: selectedFaces.length
  });
  return selectedFaces;
}

function extrudeRegionWorldDirection(faces) {
  const axisMode = surfaceAxisMode();
  if (["x", "y", "z"].includes(axisMode)) return surfaceAxisWorldDirection(axisMode);
  const direction = faces.reduce((sum, face) => sum.add(worldFaceNormal(face)), new THREE.Vector3());
  return direction.lengthSq() > 1e-10 ? direction.normalize() : null;
}

function buildExtrudedRegionGeometry(mesh, faces, distance, buffers) {
  const localNormal = faces[0].localNormal.clone().normalize();
  const u = faces[0].u.clone().normalize();
  const v = faces[0].v.clone().normalize();
  const uniqueVertices = new Map();
  for (const face of faces) {
    for (const point of face.localTrianglePoints) uniqueVertices.set(vertexKey(point), point.clone());
  }
  const localCenter = [...uniqueVertices.values()]
    .reduce((sum, point) => sum.add(point), new THREE.Vector3())
    .multiplyScalar(1 / Math.max(1, uniqueVertices.size));
  const boundary2 = coplanarRegionBoundary(faces, localCenter, u, v);
  if (boundary2.length < 3) return { error: "Extrude Region could not trace one closed outer boundary." };

  const worldDirection = extrudeRegionWorldDirection(faces);
  if (!worldDirection) return { error: "Extrude Region could not determine a movement direction." };
  const localDelta = localDisplacementFromWorldVector(mesh, worldDirection.multiplyScalar(distance));
  if (localDelta.lengthSq() <= 1e-10) return { error: "Extrude Region distance is too small." };

  const positions = [...buffers.keptPositions];
  const uvs = buffers.hadUv ? [...buffers.keptUvs] : [];
  const topTriangles = [];
  const pushTriangle = (trianglePoints, triangleUvs, targetNormal, { selectedTop = false } = {}) => {
    const points = trianglePoints.map(point => point.clone());
    const mappedUvs = triangleUvs?.map(uv => uv.clone()) || null;
    const triangleNormal = new THREE.Vector3().crossVectors(
      points[1].clone().sub(points[0]),
      points[2].clone().sub(points[0])
    );
    if (triangleNormal.dot(targetNormal) < 0) {
      [points[1], points[2]] = [points[2], points[1]];
      if (mappedUvs) [mappedUvs[1], mappedUvs[2]] = [mappedUvs[2], mappedUvs[1]];
    }
    const faceIndex = positions.length / 9;
    positions.push(...points.flatMap(point => vecArray(point)));
    if (buffers.hadUv) {
      for (const texturePoint of mappedUvs || [new THREE.Vector2(.5, .5), new THREE.Vector2(.5, .5), new THREE.Vector2(.5, .5)]) {
        uvs.push(texturePoint.x, texturePoint.y);
      }
    }
    if (selectedTop) {
      topTriangles.push({
        points: points.map(point => point.clone()),
        uvs: mappedUvs?.map(uv => uv.clone()) || null,
        faceIndex
      });
    }
  };

  for (const face of faces) {
    pushTriangle(
      face.localTrianglePoints.map(point => point.clone().add(localDelta)),
      face.localUvs,
      localNormal,
      { selectedTop: true }
    );
  }

  const boundary = boundary2.map(point => localCenter.clone().addScaledVector(u, point.x).addScaledVector(v, point.y));
  for (let index = 0; index < boundary.length; index++) {
    const next = (index + 1) % boundary.length;
    const baseA = boundary[index];
    const baseB = boundary[next];
    const topA = baseA.clone().add(localDelta);
    const topB = baseB.clone().add(localDelta);
    const sideCenter = baseA.clone().add(baseB).add(topA).add(topB).multiplyScalar(.25);
    const targetNormal = sideCenter.clone().sub(localCenter);
    targetNormal.addScaledVector(localNormal, -targetNormal.dot(localNormal));
    if (distance < 0) targetNormal.negate();
    if (targetNormal.lengthSq() <= 1e-10) {
      targetNormal.crossVectors(baseB.clone().sub(baseA), localDelta).normalize();
    } else {
      targetNormal.normalize();
    }
    pushTriangle(
      [baseA, baseB, topB],
      [new THREE.Vector2(0, 0), new THREE.Vector2(1, 0), new THREE.Vector2(1, 1)],
      targetNormal
    );
    pushTriangle(
      [baseA, topB, topA],
      [new THREE.Vector2(0, 0), new THREE.Vector2(1, 1), new THREE.Vector2(0, 1)],
      targetNormal
    );
  }

  const geometry = geometryFromPositions(positions);
  if (buffers.hadUv) geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  return { geometry, topTriangles, boundaryVertices: boundary.length, localDelta };
}

function extrudeSelectedRegion({
  distance = null,
  historyLabel = "extrude selected region",
  toolLabel = "Extrude Region",
  actionLabel = "Extruded"
} = {}) {
  if (!selectedFaces.length) {
    log(`Select one Triangle or Whole Face before using ${toolLabel}.`);
    setFacePickMode(true);
    return [];
  }
  const meshes = [...new Set(selectedFaces.map(face => face.mesh).filter(Boolean))];
  if (meshes.length !== 1) {
    log(`${toolLabel} works on one mesh surface at a time.`);
    return [];
  }
  const mesh = meshes[0];
  const faces = selectedFaces.filter(face => face.mesh === mesh);
  if (!selectedFaceRegionIsConnected(faces)) {
    log(`${toolLabel} needs one connected surface selection.`);
    return [];
  }
  if (!selectedFaceRegionIsPlanar(faces)) {
    log(`${toolLabel} currently needs one flat region. Edit angled surfaces separately.`);
    return [];
  }
  const requestedDistance = Number(distance);
  const signedDistance = Number.isFinite(requestedDistance) && Math.abs(requestedDistance) >= .001
    ? Math.max(-100, Math.min(100, requestedDistance))
    : faceEditDepth({ min: .001, max: 100 });
  const buffers = removeSelectedFaceRegionFromMesh(mesh);
  if (!buffers?.removed) {
    log("The selected region could not be found in the editable mesh.");
    return [];
  }
  const patch = buildExtrudedRegionGeometry(mesh, faces, signedDistance, buffers);
  if (!patch?.geometry || patch.error) {
    patch?.geometry?.dispose();
    log(patch?.error || "Extrude Region could not build the new geometry.");
    return [];
  }

  recordHistory(historyLabel);
  const selectedSignatures = new Map([[mesh.userData.id, new Set(faces.map(face => triangleSignature(face.localTrianglePoints)))]]);
  deleteMarkersByTriangleSignatures(selectedSignatures);
  const beforeTriangles = mesh.geometry.index
    ? mesh.geometry.index.count / 3
    : mesh.geometry.getAttribute("position").count / 3;
  replaceEditableMeshGeometry(mesh, patch.geometry);
  mesh.updateMatrixWorld(true);
  selectedFaces.length = 0;
  selectedFaces.push(...patch.topTriangles.map(triangle =>
    faceFromLocalTriangle(mesh, triangle.points, triangle.faceIndex, triangle.uvs)
  ));
  selectedFace = selectedFaces.at(-1) || null;
  clearSelectedSurfaceComponents();
  if (selected !== mesh) selectObject(mesh);
  updateFaceMarker();
  syncSurfaceEditorUi();
  updateAll();
  log(`${actionLabel} ${faces.length === 1 ? "one triangle" : `${faces.length} triangles as one region`} by ${round(Math.abs(signedDistance))} inside ${mesh.name}. The new cap stays selected.`, {
    beforeTriangles,
    afterTriangles: patch.geometry.getAttribute("position").count / 3,
    removedBaseTriangles: buffers.removed,
    boundaryVertices: patch.boundaryVertices,
    selectedCapTriangles: selectedFaces.length,
    axis: surfaceAxisMode() === "free" ? "surface normal" : surfaceAxisMode().toUpperCase()
  });
  return [mesh];
}

function surfaceSubdivisionLevels() {
  const levels = Math.max(1, Math.min(2, Math.round(Number(els.subdivideLevelsInput?.value) || 1)));
  if (els.subdivideLevelsInput) els.subdivideLevelsInput.value = String(levels);
  return levels;
}

function subdivideSelectedSurface() {
  if (!selectedFaces.length) {
    log("Select a Triangle or Whole Face before using Subdivide Surface.");
    return [];
  }

  const levels = surfaceSubdivisionLevels();
  const facesByMesh = new Map();
  for (const face of selectedFaces) {
    if (!face?.mesh?.geometry) continue;
    if (!facesByMesh.has(face.mesh)) facesByMesh.set(face.mesh, []);
    facesByMesh.get(face.mesh).push(face);
  }
  if (!facesByMesh.size) {
    log("The selected surface does not belong to an editable mesh.");
    return [];
  }

  const originalSignaturesByMesh = new Map();
  for (const [mesh, faces] of facesByMesh) {
    originalSignaturesByMesh.set(mesh.userData.id, new Set(faces.map(face => triangleSignature(face.localTrianglePoints))));
  }

  recordHistory("subdivide selected surface");
  deleteMarkersByTriangleSignatures(originalSignaturesByMesh);
  const nextSelection = [];
  let beforeTriangles = 0;
  let afterTriangles = 0;
  let subdividedTriangles = 0;

  for (const [mesh, faces] of facesByMesh) {
    const selectedSignatures = originalSignaturesByMesh.get(mesh.userData.id);
    const source = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    const position = source.getAttribute("position");
    const uv = source.getAttribute("uv");
    const protectedEdges = new Set(mesh.userData.edgeBevelProtectedEdges || []);
    beforeTriangles += position.count / 3;
    let triangles = [];
    for (let index = 0; index < position.count; index += 3) {
      const vertices = [0, 1, 2].map(offset => ({
        point: new THREE.Vector3(
          position.getX(index + offset),
          position.getY(index + offset),
          position.getZ(index + offset)
        ),
        uv: uv ? new THREE.Vector2(uv.getX(index + offset), uv.getY(index + offset)) : null
      }));
      const selectedTriangle = selectedSignatures.has(triangleSignature(vertices.map(vertex => vertex.point)));
      if (selectedTriangle) subdividedTriangles++;
      triangles.push({ vertices, selected: selectedTriangle });
    }

    const midpoint = (a, b) => ({
      point: a.point.clone().lerp(b.point, .5),
      uv: uv ? (a.uv || new THREE.Vector2(.5, .5)).clone().lerp(b.uv || new THREE.Vector2(.5, .5), .5) : null
    });
    const addTriangle = (target, selectedTriangle, a, b, c) => {
      target.push({ vertices: [a, b, c], selected: selectedTriangle });
    };

    for (let level = 0; level < levels; level++) {
      const edgesToSplit = new Set();
      for (const triangle of triangles) {
        if (!triangle.selected) continue;
        const [a, b, c] = triangle.vertices;
        edgesToSplit.add(localEdgeSignature(a.point, b.point));
        edgesToSplit.add(localEdgeSignature(b.point, c.point));
        edgesToSplit.add(localEdgeSignature(c.point, a.point));
      }

      const nextTriangles = [];
      for (const triangle of triangles) {
        const [a, b, c] = triangle.vertices;
        const abSignature = localEdgeSignature(a.point, b.point);
        const bcSignature = localEdgeSignature(b.point, c.point);
        const caSignature = localEdgeSignature(c.point, a.point);
        const splitAb = edgesToSplit.has(abSignature);
        const splitBc = edgesToSplit.has(bcSignature);
        const splitCa = edgesToSplit.has(caSignature);
        const splitCount = Number(splitAb) + Number(splitBc) + Number(splitCa);
        if (!splitCount) {
          nextTriangles.push(triangle);
          continue;
        }

        const ab = splitAb ? midpoint(a, b) : null;
        const bc = splitBc ? midpoint(b, c) : null;
        const ca = splitCa ? midpoint(c, a) : null;
        if (splitAb && protectedEdges.has(abSignature)) {
          protectedEdges.add(localEdgeSignature(a.point, ab.point));
          protectedEdges.add(localEdgeSignature(ab.point, b.point));
        }
        if (splitBc && protectedEdges.has(bcSignature)) {
          protectedEdges.add(localEdgeSignature(b.point, bc.point));
          protectedEdges.add(localEdgeSignature(bc.point, c.point));
        }
        if (splitCa && protectedEdges.has(caSignature)) {
          protectedEdges.add(localEdgeSignature(c.point, ca.point));
          protectedEdges.add(localEdgeSignature(ca.point, a.point));
        }

        const keepSelected = triangle.selected;
        if (splitCount === 3) {
          addTriangle(nextTriangles, keepSelected, a, ab, ca);
          addTriangle(nextTriangles, keepSelected, ab, b, bc);
          addTriangle(nextTriangles, keepSelected, ca, bc, c);
          addTriangle(nextTriangles, keepSelected, ab, bc, ca);
        } else if (splitAb && splitBc) {
          addTriangle(nextTriangles, keepSelected, ab, b, bc);
          addTriangle(nextTriangles, keepSelected, a, ab, bc);
          addTriangle(nextTriangles, keepSelected, a, bc, c);
        } else if (splitBc && splitCa) {
          addTriangle(nextTriangles, keepSelected, bc, c, ca);
          addTriangle(nextTriangles, keepSelected, b, bc, ca);
          addTriangle(nextTriangles, keepSelected, b, ca, a);
        } else if (splitCa && splitAb) {
          addTriangle(nextTriangles, keepSelected, ca, a, ab);
          addTriangle(nextTriangles, keepSelected, c, ca, ab);
          addTriangle(nextTriangles, keepSelected, c, ab, b);
        } else if (splitAb) {
          addTriangle(nextTriangles, keepSelected, a, ab, c);
          addTriangle(nextTriangles, keepSelected, ab, b, c);
        } else if (splitBc) {
          addTriangle(nextTriangles, keepSelected, b, bc, a);
          addTriangle(nextTriangles, keepSelected, bc, c, a);
        } else {
          addTriangle(nextTriangles, keepSelected, c, ca, b);
          addTriangle(nextTriangles, keepSelected, ca, a, b);
        }
      }
      triangles = nextTriangles;
    }

    source.dispose();
    const positions = [];
    const uvs = [];
    const generated = [];
    for (const triangle of triangles) {
      const faceIndex = positions.length / 9;
      for (const vertex of triangle.vertices) {
        positions.push(vertex.point.x, vertex.point.y, vertex.point.z);
        if (uv) uvs.push(vertex.uv?.x ?? .5, vertex.uv?.y ?? .5);
      }
      if (triangle.selected) {
        generated.push({
          points: triangle.vertices.map(vertex => vertex.point.clone()),
          uvs: uv ? triangle.vertices.map(vertex => vertex.uv?.clone() || new THREE.Vector2(.5, .5)) : null,
          faceIndex
        });
      }
    }
    const geometry = geometryFromPositions(positions);
    if (uv) geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    replaceEditableMeshGeometry(mesh, geometry);
    mesh.userData.edgeBevelProtectedEdges = [...protectedEdges];
    mesh.updateMatrixWorld(true);
    afterTriangles += positions.length / 9;
    nextSelection.push(...generated.map(triangle =>
      faceFromLocalTriangle(mesh, triangle.points, triangle.faceIndex, triangle.uvs)
    ));
  }

  selectedFaces.length = 0;
  selectedFaces.push(...nextSelection);
  selectedFace = selectedFaces.at(-1) || null;
  clearSelectedSurfaceComponents();
  if (selectedFace && selected !== selectedFace.mesh) selectObject(selectedFace.mesh);
  updateFaceMarker();
  syncSurfaceEditorUi();
  updateAll();
  log(`Subdivided ${subdividedTriangles} selected triangle${subdividedTriangles === 1 ? "" : "s"} at level ${levels}. The new detail stays selected.`, {
    beforeTriangles,
    afterTriangles,
    selectedTriangles: selectedFaces.length
  });
  return selectedFaces;
}

function loopCutSettings() {
  const axis = ["x", "y", "z"].includes(els.loopCutAxisSelect?.value) ? els.loopCutAxisSelect.value : "y";
  const position = Math.max(1, Math.min(99, Number(els.loopCutPositionInput?.value) || 50));
  const count = Math.max(1, Math.min(8, Math.round(Number(els.loopCutCountInput?.value) || 1)));
  if (els.loopCutAxisSelect) els.loopCutAxisSelect.value = axis;
  if (els.loopCutPositionInput) els.loopCutPositionInput.value = String(position);
  if (els.loopCutCountInput) els.loopCutCountInput.value = String(count);
  return { axis, position, count };
}

function loopCutVertex(point, uv = null) {
  return { point: point.clone(), uv: uv?.clone() || null };
}

function interpolateLoopCutVertex(a, b, amount) {
  return {
    point: a.point.clone().lerp(b.point, amount),
    uv: a.uv && b.uv ? a.uv.clone().lerp(b.uv, amount) : null
  };
}

function clipLoopCutPolygon(vertices, axis, planePosition, keepPositive, epsilon) {
  const clipped = [];
  for (let index = 0; index < vertices.length; index++) {
    const current = vertices[index];
    const next = vertices[(index + 1) % vertices.length];
    const currentDistance = current.point[axis] - planePosition;
    const nextDistance = next.point[axis] - planePosition;
    const currentInside = keepPositive ? currentDistance >= -epsilon : currentDistance <= epsilon;
    const nextInside = keepPositive ? nextDistance >= -epsilon : nextDistance <= epsilon;
    if (currentInside) clipped.push(loopCutVertex(current.point, current.uv));
    if (currentInside === nextInside) continue;
    const denominator = currentDistance - nextDistance;
    if (Math.abs(denominator) <= epsilon) continue;
    clipped.push(interpolateLoopCutVertex(current, next, currentDistance / denominator));
  }
  return clipped.filter((vertex, index) => {
    const previous = clipped[(index - 1 + clipped.length) % clipped.length];
    return !previous || vertex.point.distanceToSquared(previous.point) > epsilon * epsilon;
  });
}

function appendLoopCutPolygon(target, polygon, hadUv, epsilon) {
  if (polygon.length < 3) return 0;
  let created = 0;
  for (let index = 1; index < polygon.length - 1; index++) {
    const vertices = [polygon[0], polygon[index], polygon[index + 1]];
    const areaNormal = new THREE.Vector3().crossVectors(
      vertices[1].point.clone().sub(vertices[0].point),
      vertices[2].point.clone().sub(vertices[0].point)
    );
    if (areaNormal.lengthSq() <= epsilon * epsilon) continue;
    for (const vertex of vertices) {
      target.positions.push(vertex.point.x, vertex.point.y, vertex.point.z);
      if (hadUv) target.uvs.push(vertex.uv?.x ?? .5, vertex.uv?.y ?? .5);
    }
    created++;
  }
  return created;
}

function uniqueLoopCutPoints(points, epsilon) {
  const unique = [];
  for (const point of points) {
    if (unique.some(existing => existing.distanceToSquared(point) <= epsilon * epsilon)) continue;
    unique.push(point.clone());
  }
  return unique;
}

function splitGeometryAtLoopPlane(source, axis, planePosition, protectedEdges) {
  const position = source.getAttribute("position");
  const uv = source.getAttribute("uv");
  const epsilon = 1e-6;
  const output = { positions: [], uvs: [] };
  const segments = [];
  let splitTriangles = 0;

  for (let index = 0; index < position.count; index += 3) {
    const vertices = [0, 1, 2].map(offset => new THREE.Vector3(
      position.getX(index + offset),
      position.getY(index + offset),
      position.getZ(index + offset)
    )).map((point, offset) => loopCutVertex(point, uv ? new THREE.Vector2(
      uv.getX(index + offset),
      uv.getY(index + offset)
    ) : null));
    const distances = vertices.map(vertex => vertex.point[axis] - planePosition);
    const crossesPlane = Math.min(...distances) < -epsilon && Math.max(...distances) > epsilon;
    if (!crossesPlane) {
      appendLoopCutPolygon(output, vertices, Boolean(uv), epsilon);
      continue;
    }

    const intersections = [];
    for (let edgeIndex = 0; edgeIndex < 3; edgeIndex++) {
      const a = vertices[edgeIndex];
      const b = vertices[(edgeIndex + 1) % 3];
      const aDistance = a.point[axis] - planePosition;
      const bDistance = b.point[axis] - planePosition;
      if (Math.abs(aDistance) <= epsilon) intersections.push(a.point);
      if (aDistance * bDistance >= -epsilon * epsilon) continue;
      const amount = aDistance / (aDistance - bDistance);
      const intersection = interpolateLoopCutVertex(a, b, amount);
      intersections.push(intersection.point);
      const originalSignature = localEdgeSignature(a.point, b.point);
      if (protectedEdges.has(originalSignature)) {
        protectedEdges.add(localEdgeSignature(a.point, intersection.point));
        protectedEdges.add(localEdgeSignature(intersection.point, b.point));
      }
    }

    const negative = clipLoopCutPolygon(vertices, axis, planePosition, false, epsilon);
    const positive = clipLoopCutPolygon(vertices, axis, planePosition, true, epsilon);
    const created = appendLoopCutPolygon(output, negative, Boolean(uv), epsilon)
      + appendLoopCutPolygon(output, positive, Boolean(uv), epsilon);
    const segmentPoints = uniqueLoopCutPoints(intersections, epsilon);
    if (created >= 2 && segmentPoints.length === 2) {
      segments.push({ localA: segmentPoints[0], localB: segmentPoints[1] });
      splitTriangles++;
    }
  }

  const geometry = geometryFromPositions(output.positions);
  if (uv && output.uvs.length) geometry.setAttribute("uv", new THREE.Float32BufferAttribute(output.uvs, 2));
  return { geometry, segments, splitTriangles };
}

function clipCutPolygon(vertices, plane, keepPositive, epsilon) {
  const clipped = [];
  for (let index = 0; index < vertices.length; index++) {
    const current = vertices[index];
    const next = vertices[(index + 1) % vertices.length];
    const currentDistance = plane.distanceToPoint(current.point);
    const nextDistance = plane.distanceToPoint(next.point);
    const currentInside = keepPositive ? currentDistance >= -epsilon : currentDistance <= epsilon;
    const nextInside = keepPositive ? nextDistance >= -epsilon : nextDistance <= epsilon;
    if (currentInside) clipped.push(loopCutVertex(current.point, current.uv));
    if (currentInside === nextInside) continue;
    const denominator = currentDistance - nextDistance;
    if (Math.abs(denominator) <= epsilon) continue;
    clipped.push(interpolateLoopCutVertex(current, next, currentDistance / denominator));
  }
  return clipped.filter((vertex, index) => {
    const previous = clipped[(index - 1 + clipped.length) % clipped.length];
    return !previous || vertex.point.distanceToSquared(previous.point) > epsilon * epsilon;
  });
}

function cutSegmentWithinStroke(points, stroke, epsilon) {
  if (!stroke || points.length !== 2) return true;
  const parameters = points.map(point => point.clone().sub(stroke.origin).dot(stroke.direction));
  const tolerance = Math.max(epsilon * 10, stroke.tolerance || 0);
  if (Math.max(...parameters) < -tolerance || Math.min(...parameters) > stroke.length + tolerance) return false;
  if (!stroke.depthDirection) return true;
  const midpoint = points[0].clone().add(points[1]).multiplyScalar(.5);
  const along = THREE.MathUtils.clamp(
    midpoint.clone().sub(stroke.origin).dot(stroke.direction),
    0,
    stroke.length
  );
  const nearestStrokePoint = stroke.origin.clone().addScaledVector(stroke.direction, along);
  const depth = Math.abs(midpoint.clone().sub(nearestStrokePoint).dot(stroke.depthDirection));
  return depth <= tolerance;
}

function cutLoopPointKey(point, epsilon = 1e-5) {
  return [point.x, point.y, point.z].map(value => Math.round(value / epsilon)).join(":");
}

function stitchCutSegments(segments, epsilon = 1e-5) {
  const points = new Map();
  const adjacency = new Map();
  const unusedEdges = new Set();
  const addNeighbor = (from, to) => {
    if (!adjacency.has(from)) adjacency.set(from, new Set());
    adjacency.get(from).add(to);
  };
  for (const segment of segments) {
    const aKey = cutLoopPointKey(segment.localA, epsilon);
    const bKey = cutLoopPointKey(segment.localB, epsilon);
    if (aKey === bKey) continue;
    points.set(aKey, segment.localA.clone());
    points.set(bKey, segment.localB.clone());
    addNeighbor(aKey, bKey);
    addNeighbor(bKey, aKey);
    unusedEdges.add([aKey, bKey].sort().join("|"));
  }
  const loops = [];
  while (unusedEdges.size) {
    const firstEdge = [...unusedEdges][0];
    const [start, next] = firstEdge.split("|");
    const keys = [start];
    let previous = start;
    let current = next;
    unusedEdges.delete(firstEdge);
    let guard = 0;
    while (current !== start && guard++ < points.size + 4) {
      keys.push(current);
      const candidates = [...(adjacency.get(current) || [])]
        .filter(candidate => unusedEdges.has([current, candidate].sort().join("|")));
      const candidate = candidates.find(value => value !== previous) || candidates[0];
      if (!candidate) break;
      unusedEdges.delete([current, candidate].sort().join("|"));
      previous = current;
      current = candidate;
    }
    if (current === start && keys.length >= 3) loops.push(keys.map(key => points.get(key).clone()));
  }
  return loops;
}

function appendPlaneCutCaps(output, segments, plane, keepMode, hadUv, epsilon) {
  const desiredNormal = plane.normal.clone().multiplyScalar(keepMode === "positive" ? -1 : 1).normalize();
  const helperAxis = Math.abs(desiredNormal.y) < .9
    ? new THREE.Vector3(0, 1, 0)
    : new THREE.Vector3(1, 0, 0);
  const uAxis = helperAxis.clone().cross(desiredNormal).normalize();
  const vAxis = desiredNormal.clone().cross(uAxis).normalize();
  let capTriangles = 0;
  for (const sourceLoop of stitchCutSegments(segments, Math.max(epsilon * 10, 1e-5))) {
    let loop = sourceLoop;
    let projected = loop.map(point => new THREE.Vector2(point.dot(uAxis), point.dot(vAxis)));
    const signedArea = projected.reduce((sum, point, index) => {
      const next = projected[(index + 1) % projected.length];
      return sum + point.x * next.y - next.x * point.y;
    }, 0);
    if (signedArea < 0) {
      loop = [...loop].reverse();
      projected = [...projected].reverse();
    }
    const triangles = THREE.ShapeUtils.triangulateShape(projected, []);
    if (!triangles.length) continue;
    const min = projected.reduce((value, point) => value.min(point), new THREE.Vector2(Infinity, Infinity));
    const max = projected.reduce((value, point) => value.max(point), new THREE.Vector2(-Infinity, -Infinity));
    const span = max.clone().sub(min);
    for (const triangleIndices of triangles) {
      const vertices = triangleIndices.map(index => loop[index].clone());
      const normal = new THREE.Vector3().crossVectors(
        vertices[1].clone().sub(vertices[0]),
        vertices[2].clone().sub(vertices[0])
      );
      if (normal.dot(desiredNormal) < 0) [vertices[1], vertices[2]] = [vertices[2], vertices[1]];
      for (const point of vertices) {
        output.positions.push(point.x, point.y, point.z);
        if (hadUv) {
          const x = point.dot(uAxis);
          const y = point.dot(vAxis);
          output.uvs.push(
            span.x > epsilon ? (x - min.x) / span.x : .5,
            span.y > epsilon ? (y - min.y) / span.y : .5
          );
        }
      }
      capTriangles++;
    }
  }
  return capTriangles;
}

function splitGeometryAtCutPlane(source, plane, protectedEdges, { keepMode = "both", cap = false, stroke = null } = {}) {
  const position = source.getAttribute("position");
  const uv = source.getAttribute("uv");
  const epsilon = 1e-6;
  const output = { positions: [], uvs: [] };
  const segments = [];
  let splitTriangles = 0;

  for (let index = 0; index < position.count; index += 3) {
    const vertices = [0, 1, 2].map(offset => loopCutVertex(
      new THREE.Vector3(position.getX(index + offset), position.getY(index + offset), position.getZ(index + offset)),
      uv ? new THREE.Vector2(uv.getX(index + offset), uv.getY(index + offset)) : null
    ));
    const distances = vertices.map(vertex => plane.distanceToPoint(vertex.point));
    const crossesPlane = Math.min(...distances) < -epsilon && Math.max(...distances) > epsilon;
    if (!crossesPlane) {
      const keepTriangle = keepMode === "both"
        || (keepMode === "positive" && Math.min(...distances) >= -epsilon)
        || (keepMode === "negative" && Math.max(...distances) <= epsilon);
      if (keepTriangle) appendLoopCutPolygon(output, vertices, Boolean(uv), epsilon);
      continue;
    }

    const intersections = [];
    for (let edgeIndex = 0; edgeIndex < 3; edgeIndex++) {
      const a = vertices[edgeIndex];
      const b = vertices[(edgeIndex + 1) % 3];
      const aDistance = plane.distanceToPoint(a.point);
      const bDistance = plane.distanceToPoint(b.point);
      if (Math.abs(aDistance) <= epsilon) intersections.push(a.point);
      if (aDistance * bDistance >= -epsilon * epsilon) continue;
      const intersection = interpolateLoopCutVertex(a, b, aDistance / (aDistance - bDistance));
      intersections.push(intersection.point);
      const originalSignature = localEdgeSignature(a.point, b.point);
      if (protectedEdges.has(originalSignature)) {
        protectedEdges.add(localEdgeSignature(a.point, intersection.point));
        protectedEdges.add(localEdgeSignature(intersection.point, b.point));
      }
    }
    const segmentPoints = uniqueLoopCutPoints(intersections, epsilon);
    if (segmentPoints.length !== 2 || !cutSegmentWithinStroke(segmentPoints, stroke, epsilon)) {
      appendLoopCutPolygon(output, vertices, Boolean(uv), epsilon);
      continue;
    }

    const negative = clipCutPolygon(vertices, plane, false, epsilon);
    const positive = clipCutPolygon(vertices, plane, true, epsilon);
    let created = 0;
    if (keepMode === "both" || keepMode === "negative") created += appendLoopCutPolygon(output, negative, Boolean(uv), epsilon);
    if (keepMode === "both" || keepMode === "positive") created += appendLoopCutPolygon(output, positive, Boolean(uv), epsilon);
    if (created) {
      segments.push({ localA: segmentPoints[0], localB: segmentPoints[1] });
      splitTriangles++;
    }
  }

  const capTriangles = keepMode !== "both" && cap && segments.length
    ? appendPlaneCutCaps(output, segments, plane, keepMode, Boolean(uv), epsilon)
    : 0;
  const geometry = geometryFromPositions(output.positions);
  if (uv && output.uvs.length) geometry.setAttribute("uv", new THREE.Float32BufferAttribute(output.uvs, 2));
  return { geometry, segments, splitTriangles, capTriangles };
}

function selectNewCutEdges(mesh, segments, { slideAxis = null } = {}) {
  surfaceComponentMode = "edge";
  surfaceSelectionSource = "surface";
  coplanarFacePickMode = false;
  setFacePickMode(!knifeCutMode);
  const seen = new Set();
  for (const segment of segments) {
    const key = surfaceEdgeKey(mesh, segment.localA, segment.localB);
    if (seen.has(key)) continue;
    seen.add(key);
    selectedSurfaceEdges.push({
      mesh,
      localA: segment.localA.clone(),
      localB: segment.localB.clone(),
      key,
      slideAxis,
      protectedBevelEdge: false
    });
  }
}

function commitCutResult(mesh, source, result, protectedEdges, { historyLabel, message, slideAxis = null, details = {} }) {
  if (!result.splitTriangles || !result.segments.length) {
    result.geometry.dispose();
    source.dispose();
    log(`${message} did not cross usable mesh triangles.`);
    return null;
  }
  const beforeTriangles = source.getAttribute("position").count / 3;
  source.dispose();
  recordHistory(historyLabel);
  clearMarkers(mesh.userData.id);
  clearSelectedTriangles();
  clearSelectedSurfaceComponents();
  if (selected !== mesh) selectObject(mesh);
  replaceEditableMeshGeometry(mesh, result.geometry);
  mesh.userData.edgeBevelProtectedEdges = [...protectedEdges];
  mesh.userData.dissolvedSurfaceEdges = [];
  mesh.updateMatrixWorld(true);
  selectNewCutEdges(mesh, result.segments, { slideAxis });
  updateSurfaceComponentMarker();
  updateAll();
  syncSurfaceEditorUi();
  updateSurfaceGizmoAttachment();
  log(`${message} on ${mesh.name}. New cut edges stay selected.`, {
    beforeTriangles,
    afterTriangles: result.geometry.getAttribute("position").count / 3,
    splitTriangles: result.splitTriangles,
    capTriangles: result.capTriangles,
    selectedCutEdges: selectedSurfaceEdges.length,
    textureCoordinatesPreserved: true,
    ...details
  });
  return mesh;
}

function planeCutSettings() {
  const axis = ["x", "y", "z"].includes(els.planeCutAxisSelect?.value) ? els.planeCutAxisSelect.value : "y";
  const position = Math.max(1, Math.min(99, Number(els.planeCutPositionInput?.value) || 50));
  const keepMode = ["both", "positive", "negative"].includes(els.planeCutResultSelect?.value)
    ? els.planeCutResultSelect.value
    : "both";
  const cap = keepMode !== "both" && !!els.planeCutCapInput?.checked;
  if (els.planeCutAxisSelect) els.planeCutAxisSelect.value = axis;
  if (els.planeCutPositionInput) els.planeCutPositionInput.value = String(position);
  if (els.planeCutResultSelect) els.planeCutResultSelect.value = keepMode;
  return { axis, position, keepMode, cap };
}

function applyPlaneCut() {
  const mesh = loopCutTargetMesh();
  if (!mesh?.geometry || !objects.includes(mesh)) {
    log("Select one mesh before using Plane Cut.");
    return null;
  }
  const settings = planeCutSettings();
  const source = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  source.computeBoundingBox();
  const minimum = source.boundingBox.min[settings.axis];
  const maximum = source.boundingBox.max[settings.axis];
  const span = maximum - minimum;
  if (!Number.isFinite(span) || span <= 1e-5) {
    source.dispose();
    log(`The selected mesh has no usable ${settings.axis.toUpperCase()} thickness for Plane Cut.`);
    return null;
  }
  const planePosition = minimum + span * settings.position / 100;
  const normal = new THREE.Vector3(
    settings.axis === "x" ? 1 : 0,
    settings.axis === "y" ? 1 : 0,
    settings.axis === "z" ? 1 : 0
  );
  const plane = new THREE.Plane(normal, -planePosition);
  const protectedEdges = new Set(mesh.userData.edgeBevelProtectedEdges || []);
  const result = splitGeometryAtCutPlane(source, plane, protectedEdges, {
    keepMode: settings.keepMode,
    cap: settings.cap
  });
  return commitCutResult(mesh, source, result, protectedEdges, {
    historyLabel: "apply plane cut",
    message: "Applied Plane Cut",
    slideAxis: settings.axis,
    details: {
      axis: settings.axis.toUpperCase(),
      positionPercent: settings.position,
      result: settings.keepMode,
      capped: settings.cap
    }
  });
}

function clearKnifeCutGuide({ keepMode = true } = {}) {
  while (knifeCutGuideGroup.children.length) {
    const child = knifeCutGuideGroup.children.pop();
    disposeObject3D(child);
  }
  knifeCutGuideGroup.visible = false;
  knifeCutPoints.length = 0;
  knifeCutMesh = null;
  knifeCutHover = null;
  if (!keepMode) knifeCutMode = false;
  els.knifeCutModeBtn?.classList.toggle("active", knifeCutMode);
  if (els.knifeCutCancelBtn) els.knifeCutCancelBtn.disabled = knifeCutPoints.length === 0;
}

function updateKnifeCutGuide(hoverPoint = knifeCutHover) {
  while (knifeCutGuideGroup.children.length) {
    const child = knifeCutGuideGroup.children.pop();
    disposeObject3D(child);
  }
  const displayPoints = [...knifeCutPoints];
  if (displayPoints.length === 1 && hoverPoint) displayPoints.push(hoverPoint.clone());
  for (const point of knifeCutPoints) {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(Math.max(.025, camera.position.distanceTo(point) * .006), 14, 10),
      new THREE.MeshBasicMaterial({ color: "#ffd36a", depthTest: false })
    );
    marker.position.copy(point);
    marker.renderOrder = 1010;
    knifeCutGuideGroup.add(marker);
  }
  if (displayPoints.length === 2) {
    const geometry = new THREE.BufferGeometry().setFromPoints(displayPoints);
    const line = new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({ color: "#ff5a5f", depthTest: false })
    );
    line.renderOrder = 1009;
    knifeCutGuideGroup.add(line);
  }
  knifeCutGuideGroup.visible = knifeCutMode && knifeCutGuideGroup.children.length > 0;
  if (els.knifeCutCancelBtn) els.knifeCutCancelBtn.disabled = knifeCutPoints.length === 0;
}

function setKnifeCutMode(enabled) {
  finishDragPushSession();
  clearKnifeCutGuide({ keepMode: false });
  knifeCutMode = !!enabled;
  if (knifeCutMode) {
    if (lineSketchMode) clearLineSketch({ silent: true, keepMode: false });
    if (dragPushMode) setDragPushMode(false, { silent: true });
    if (activeTransformMode) setTransformMode(activeTransformMode);
    if (els.surfaceEditorWindow) els.surfaceEditorWindow.dataset.interactionMode = "off";
    surfaceComponentMode = "none";
    surfaceSelectionSource = "none";
    coplanarFacePickMode = false;
    setFacePickMode(false);
    clearSelectedTriangles();
    els.hudText.textContent = "Knife ready: click a start point and an end point on the same mesh | Esc cancels the current stroke";
    log("Knife mode enabled. Click two points on the same mesh; click Knife again to release it.");
  } else {
    if (selectedSurfaceEdges.length || selectedSurfaceVertices.length || selectedFaces.length) setFacePickMode(true);
    els.hudText.textContent = "Knife released. Orbit: drag | Select: click | Multi-select: Shift/Ctrl+click";
    log("Knife mode disabled.");
  }
  els.knifeCutModeBtn?.classList.toggle("active", knifeCutMode);
  syncSurfaceEditorUi();
  updateSurfaceGizmoAttachment();
  return knifeCutMode;
}

function cancelKnifeCutStroke({ silent = false } = {}) {
  clearKnifeCutGuide({ keepMode: true });
  if (knifeCutMode) els.hudText.textContent = "Knife ready: click a new start point on a visible mesh";
  if (!silent) log("Cleared the current Knife stroke. Knife mode remains enabled.");
}

function applyKnifeCutStroke(mesh, worldStart, worldEnd) {
  mesh.updateMatrixWorld(true);
  const inverse = mesh.matrixWorld.clone().invert();
  const localStart = worldStart.clone().applyMatrix4(inverse);
  const localEnd = worldEnd.clone().applyMatrix4(inverse);
  const worldViewDirection = camera.getWorldDirection(new THREE.Vector3()).normalize();
  let localThird = worldStart.clone().add(worldViewDirection).applyMatrix4(inverse);
  const localLine = localEnd.clone().sub(localStart);
  if (localLine.lengthSq() <= 1e-8) {
    log("Knife stroke is too short. Click two points farther apart.");
    return null;
  }
  let plane = new THREE.Plane().setFromCoplanarPoints(localStart, localEnd, localThird);
  if (plane.normal.lengthSq() <= 1e-8) {
    localThird = worldStart.clone().add(camera.up.clone().transformDirection(camera.matrixWorld)).applyMatrix4(inverse);
    plane = new THREE.Plane().setFromCoplanarPoints(localStart, localEnd, localThird);
  }
  if (plane.normal.lengthSq() <= 1e-8) {
    log("Knife could not derive a cutting plane from this view. Rotate the camera slightly and try again.");
    return null;
  }
  plane.normalize();
  const source = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  source.computeBoundingSphere();
  const through = !!els.knifeCutThroughInput?.checked;
  const strokeDirection = localLine.clone().normalize();
  const localDepthDirection = localThird.clone().sub(localStart)
    .addScaledVector(strokeDirection, -localThird.clone().sub(localStart).dot(strokeDirection));
  const stroke = through ? null : {
    origin: localStart,
    direction: strokeDirection,
    depthDirection: localDepthDirection.lengthSq() > 1e-8 ? localDepthDirection.normalize() : null,
    length: localLine.length(),
    tolerance: Math.max(.005, (source.boundingSphere?.radius || 1) * .02)
  };
  const protectedEdges = new Set(mesh.userData.edgeBevelProtectedEdges || []);
  const result = splitGeometryAtCutPlane(source, plane, protectedEdges, { keepMode: "both", stroke });
  return commitCutResult(mesh, source, result, protectedEdges, {
    historyLabel: "apply knife cut",
    message: "Applied Knife cut",
    details: { throughMesh: through, strokeLength: round(localLine.length()) }
  });
}

function addKnifeCutPointFromHit(hit) {
  if (!knifeCutMode) return false;
  if (!hit?.object || !hit.face) {
    log("Knife needs a point on a visible mesh.");
    return true;
  }
  if (!knifeCutPoints.length) {
    knifeCutMesh = hit.object;
    knifeCutPoints.push(hit.point.clone());
    knifeCutHover = null;
    if (selected !== hit.object) selectObject(hit.object);
    updateKnifeCutGuide();
    els.hudText.textContent = `Knife start placed on ${hit.object.name}. Click the end point on the same mesh.`;
    log(`Placed Knife start point on ${hit.object.name}.`);
    return true;
  }
  if (hit.object !== knifeCutMesh) {
    log("Knife start and end must be on the same mesh. Press Cancel Stroke to restart.");
    return true;
  }
  const start = knifeCutPoints[0].clone();
  const end = hit.point.clone();
  if (start.distanceToSquared(end) <= 1e-8) {
    log("Knife end point is too close to the start point.");
    return true;
  }
  knifeCutPoints.push(end);
  updateKnifeCutGuide();
  const result = applyKnifeCutStroke(knifeCutMesh, start, end);
  cancelKnifeCutStroke({ silent: true });
  els.hudText.textContent = result
    ? "Knife cut complete. Click two new points, or click Knife again to release the tool."
    : "Knife did not cross usable triangles. Click a new start point and try another stroke.";
  return true;
}

function loopCutTargetMesh() {
  return selectedFace?.mesh
    || selectedSurfaceEdges.at(-1)?.mesh
    || selectedSurfaceVertices.at(-1)?.mesh
    || selected;
}

function applyLoopCut() {
  const mesh = loopCutTargetMesh();
  if (!mesh?.geometry || !objects.includes(mesh)) {
    log("Select one mesh before using Loop Cut / Ring Cut.");
    return null;
  }
  const { axis, position, count } = loopCutSettings();
  let working = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  working.computeBoundingBox();
  const minimum = working.boundingBox.min[axis];
  const maximum = working.boundingBox.max[axis];
  const span = maximum - minimum;
  if (!Number.isFinite(span) || span <= 1e-5) {
    working.dispose();
    log(`The selected mesh has no usable ${axis.toUpperCase()} thickness for a loop cut.`);
    return null;
  }

  const planes = count === 1
    ? [minimum + span * position / 100]
    : Array.from({ length: count }, (_, index) => minimum + span * (index + 1) / (count + 1));
  const protectedEdges = new Set(mesh.userData.edgeBevelProtectedEdges || []);
  const ringSegments = [];
  let appliedCuts = 0;
  let splitTriangles = 0;
  const beforeTriangles = working.getAttribute("position").count / 3;

  for (const planePosition of planes) {
    const result = splitGeometryAtLoopPlane(working, axis, planePosition, protectedEdges);
    if (!result.splitTriangles) {
      result.geometry.dispose();
      continue;
    }
    working.dispose();
    working = result.geometry;
    ringSegments.push(...result.segments);
    splitTriangles += result.splitTriangles;
    appliedCuts++;
  }
  if (!appliedCuts || !ringSegments.length) {
    working.dispose();
    log("Loop Cut did not cross any closed mesh surfaces at the requested position.");
    return null;
  }

  recordHistory("apply loop cut");
  clearMarkers(mesh.userData.id);
  clearSelectedTriangles();
  clearSelectedSurfaceComponents();
  if (selected !== mesh) selectObject(mesh);
  replaceEditableMeshGeometry(mesh, working);
  mesh.userData.edgeBevelProtectedEdges = [...protectedEdges];
  mesh.updateMatrixWorld(true);

  surfaceComponentMode = "edge";
  surfaceSelectionSource = "surface";
  coplanarFacePickMode = false;
  setFacePickMode(false);
  const seenEdges = new Set();
  for (const segment of ringSegments) {
    const key = surfaceEdgeKey(mesh, segment.localA, segment.localB);
    if (seenEdges.has(key)) continue;
    seenEdges.add(key);
    selectedSurfaceEdges.push({
      mesh,
      localA: segment.localA.clone(),
      localB: segment.localB.clone(),
      key,
      slideAxis: axis,
      protectedBevelEdge: protectedEdges.has(localEdgeSignature(segment.localA, segment.localB))
    });
  }
  updateSurfaceComponentMarker();
  updateAll();
  syncSurfaceEditorUi();
  armContextualSurfaceDrag();
  log(`Applied ${appliedCuts} ${axis.toUpperCase()} loop cut${appliedCuts === 1 ? "" : "s"} to ${mesh.name}. New ring edges stay selected.`, {
    beforeTriangles,
    afterTriangles: working.getAttribute("position").count / 3,
    splitTriangles,
    selectedRingEdges: selectedSurfaceEdges.length
  });
  return mesh;
}

function edgeSlideSettings() {
  const requestedAxis = ["auto", "x", "y", "z"].includes(els.edgeSlideAxisSelect?.value)
    ? els.edgeSlideAxisSelect.value
    : "auto";
  const rawAmount = Number(els.edgeSlideAmountInput?.value);
  const amount = Math.max(-95, Math.min(95, Number.isFinite(rawAmount) ? rawAmount : 10));
  if (els.edgeSlideAxisSelect) els.edgeSlideAxisSelect.value = requestedAxis;
  if (els.edgeSlideAmountInput) els.edgeSlideAmountInput.value = String(amount);
  return { requestedAxis, amount };
}

function edgeSlideTopology(geometry) {
  const position = geometry.getAttribute("position");
  const adjacency = new Map();
  const points = new Map();
  const edgePairs = new Map();
  const connect = (a, b) => {
    const aKey = vertexKey(a);
    const bKey = vertexKey(b);
    if (aKey === bKey) return;
    points.set(aKey, a.clone());
    points.set(bKey, b.clone());
    if (!adjacency.has(aKey)) adjacency.set(aKey, new Map());
    if (!adjacency.has(bKey)) adjacency.set(bKey, new Map());
    adjacency.get(aKey).set(bKey, b.clone());
    adjacency.get(bKey).set(aKey, a.clone());
    const signature = localEdgeSignature(a, b);
    if (!edgePairs.has(signature)) edgePairs.set(signature, [a.clone(), b.clone()]);
  };
  for (let index = 0; index < position.count; index += 3) {
    const triangle = [0, 1, 2].map(offset => new THREE.Vector3(
      position.getX(index + offset),
      position.getY(index + offset),
      position.getZ(index + offset)
    ));
    connect(triangle[0], triangle[1]);
    connect(triangle[1], triangle[2]);
    connect(triangle[2], triangle[0]);
  }
  return { adjacency, points, edgePairs };
}

function edgeSlideCandidates(vertexPoint, topology, selectedEdgeSignatures) {
  const originKey = vertexKey(vertexPoint);
  return [...(topology.adjacency.get(originKey)?.values() || [])].filter(neighbor =>
    !selectedEdgeSignatures.has(localEdgeSignature(vertexPoint, neighbor))
  );
}

function inferredEdgeSlideDirection(meshEdges, topology, selectedEdgeSignatures, requestedAxis) {
  const rememberedAxes = new Set(meshEdges.map(edge => edge.slideAxis).filter(axis => ["x", "y", "z"].includes(axis)));
  const axis = requestedAxis !== "auto"
    ? requestedAxis
    : rememberedAxes.size === 1
      ? [...rememberedAxes][0]
      : null;
  if (axis) {
    return {
      direction: new THREE.Vector3(axis === "x" ? 1 : 0, axis === "y" ? 1 : 0, axis === "z" ? 1 : 0),
      label: `local ${axis.toUpperCase()}`,
      axis
    };
  }

  const selectedPoints = new Map();
  for (const edge of meshEdges) {
    selectedPoints.set(vertexKey(edge.localA), edge.localA);
    selectedPoints.set(vertexKey(edge.localB), edge.localB);
  }
  const deltas = [];
  for (const point of selectedPoints.values()) {
    for (const neighbor of edgeSlideCandidates(point, topology, selectedEdgeSignatures)) {
      const delta = neighbor.clone().sub(point);
      if (delta.lengthSq() > 1e-10) deltas.push(delta.normalize());
    }
  }
  if (!deltas.length) return null;

  let xx = 0; let xy = 0; let xz = 0;
  let yy = 0; let yz = 0; let zz = 0;
  for (const delta of deltas) {
    xx += delta.x * delta.x;
    xy += delta.x * delta.y;
    xz += delta.x * delta.z;
    yy += delta.y * delta.y;
    yz += delta.y * delta.z;
    zz += delta.z * delta.z;
  }
  const diagonal = [xx, yy, zz];
  const initialAxis = diagonal.indexOf(Math.max(...diagonal));
  const direction = new THREE.Vector3(initialAxis === 0 ? 1 : 0, initialAxis === 1 ? 1 : 0, initialAxis === 2 ? 1 : 0);
  for (let iteration = 0; iteration < 10; iteration++) {
    direction.set(
      xx * direction.x + xy * direction.y + xz * direction.z,
      xy * direction.x + yy * direction.y + yz * direction.z,
      xz * direction.x + yz * direction.y + zz * direction.z
    );
    if (direction.lengthSq() <= 1e-10) break;
    direction.normalize();
  }
  if (direction.lengthSq() <= 1e-10) return null;
  const dominant = dominantAxis(direction);
  if (direction.getComponent(dominant) < 0) direction.negate();
  return { direction, label: "automatic topology rail", axis: null };
}

function prepareEdgeSlidePlan(mesh, meshEdges, requestedAxis, amount) {
  const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  const topology = edgeSlideTopology(geometry);
  const selectedEdgeSignatures = new Set(meshEdges.map(edge => localEdgeSignature(edge.localA, edge.localB)));
  const directionData = inferredEdgeSlideDirection(meshEdges, topology, selectedEdgeSignatures, requestedAxis);
  if (!directionData) {
    geometry.dispose();
    return null;
  }
  const selectedPoints = new Map();
  for (const edge of meshEdges) {
    selectedPoints.set(vertexKey(edge.localA), edge.localA.clone());
    selectedPoints.set(vertexKey(edge.localB), edge.localB.clone());
  }
  const targets = new Map();
  const directionSign = amount < 0 ? -1 : 1;
  const factor = Math.abs(amount) / 100;
  for (const [pointKey, point] of selectedPoints) {
    let best = null;
    for (const neighbor of edgeSlideCandidates(point, topology, selectedEdgeSignatures)) {
      const delta = neighbor.clone().sub(point);
      const distance = delta.length();
      if (distance <= 1e-6) continue;
      const alignment = delta.clone().multiplyScalar(1 / distance).dot(directionData.direction) * directionSign;
      if (alignment <= .15 || (best && alignment <= best.alignment)) continue;
      best = { neighbor, alignment };
    }
    if (best) targets.set(pointKey, point.clone().lerp(best.neighbor, factor));
  }
  if (!targets.size) {
    geometry.dispose();
    return null;
  }
  return { mesh, meshEdges, geometry, topology, targets, directionData };
}

function applyEdgeSlidePlan(plan) {
  const { mesh, meshEdges, geometry, topology, targets } = plan;
  const position = geometry.getAttribute("position");
  const point = new THREE.Vector3();
  let movedOccurrences = 0;
  for (let index = 0; index < position.count; index++) {
    point.fromBufferAttribute(position, index);
    const target = targets.get(vertexKey(point));
    if (!target) continue;
    position.setXYZ(index, target.x, target.y, target.z);
    movedOccurrences++;
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const protectedEdges = new Set();
  for (const signature of mesh.userData.edgeBevelProtectedEdges || []) {
    const endpoints = topology.edgePairs.get(signature);
    if (!endpoints) {
      protectedEdges.add(signature);
      continue;
    }
    const movedA = targets.get(vertexKey(endpoints[0])) || endpoints[0];
    const movedB = targets.get(vertexKey(endpoints[1])) || endpoints[1];
    protectedEdges.add(localEdgeSignature(movedA, movedB));
  }

  replaceEditableMeshGeometry(mesh, geometry);
  mesh.userData.edgeBevelProtectedEdges = [...protectedEdges];
  mesh.updateMatrixWorld(true);
  for (const edge of meshEdges) {
    edge.localA.copy(targets.get(vertexKey(edge.localA)) || edge.localA);
    edge.localB.copy(targets.get(vertexKey(edge.localB)) || edge.localB);
    edge.key = surfaceEdgeKey(mesh, edge.localA, edge.localB);
    edge.protectedBevelEdge = protectedEdges.has(localEdgeSignature(edge.localA, edge.localB));
  }
  return movedOccurrences;
}

function slideSelectedEdges() {
  if (!selectedSurfaceEdges.length) {
    log("Choose Edge and select one edge or a Loop Cut ring before using Edge Slide.");
    return [];
  }
  const { requestedAxis, amount } = edgeSlideSettings();
  if (Math.abs(amount) < .000001) {
    log("Edge Slide Amount is 0%. Enter a positive or negative value.");
    return [];
  }
  const byMesh = new Map();
  for (const edge of selectedSurfaceEdges) {
    if (!byMesh.has(edge.mesh)) byMesh.set(edge.mesh, []);
    byMesh.get(edge.mesh).push(edge);
  }
  const plans = [];
  for (const [mesh, meshEdges] of byMesh) {
    const plan = prepareEdgeSlidePlan(mesh, meshEdges, requestedAxis, amount);
    if (plan) plans.push(plan);
  }
  if (!plans.length) {
    log("Edge Slide could not find supporting topology in that direction. Try the opposite Amount sign or choose X, Y, or Z.");
    return [];
  }

  recordHistory("slide selected edges");
  let movedOccurrences = 0;
  for (const plan of plans) movedOccurrences += applyEdgeSlidePlan(plan);
  updateSurfaceComponentMarker();
  updateAll();
  syncSurfaceEditorUi();
  updateSurfaceGizmoAttachment();
  const directionLabels = [...new Set(plans.map(plan => plan.directionData.label))];
  log(`Slid ${selectedSurfaceEdges.length} selected edge${selectedSurfaceEdges.length === 1 ? "" : "s"} by ${round(amount)}%.`, {
    meshes: plans.length,
    movedVertices: plans.reduce((sum, plan) => sum + plan.targets.size, 0),
    movedOccurrences,
    direction: directionLabels.join(", ")
  });
  return plans.map(plan => plan.mesh);
}

function surfaceScaleSettings() {
  const requestedAxis = ["uniform", "x", "y", "z"].includes(els.surfaceScaleAxisSelect?.value)
    ? els.surfaceScaleAxisSelect.value
    : "uniform";
  const rawAmount = Number(els.surfaceScaleAmountInput?.value);
  const amount = Math.max(1, Math.min(1000, Number.isFinite(rawAmount) ? rawAmount : 80));
  if (els.surfaceScaleAxisSelect) els.surfaceScaleAxisSelect.value = requestedAxis;
  if (els.surfaceScaleAmountInput) els.surfaceScaleAmountInput.value = String(amount);
  return { requestedAxis, amount, factor: amount / 100 };
}

function selectedSurfacePointMaps() {
  const byMesh = new Map();
  const addPoint = (mesh, point) => {
    if (!mesh?.geometry || !point) return;
    if (!byMesh.has(mesh)) byMesh.set(mesh, new Map());
    byMesh.get(mesh).set(vertexKey(point), point.clone());
  };
  if (surfaceComponentMode === "vertex") {
    for (const vertex of selectedSurfaceVertices) addPoint(vertex.mesh, vertex.localPoint);
  } else if (surfaceComponentMode === "edge") {
    for (const edge of selectedSurfaceEdges) {
      addPoint(edge.mesh, edge.localA);
      addPoint(edge.mesh, edge.localB);
    }
  } else {
    for (const face of selectedFaces) {
      for (const point of face.localTrianglePoints) addPoint(face.mesh, point);
    }
  }
  return byMesh;
}

function scaleSurfacePoint(worldPoint, worldCenter, factor, requestedAxis) {
  const scaled = worldPoint.clone();
  if (requestedAxis === "uniform") return scaled.sub(worldCenter).multiplyScalar(factor).add(worldCenter);
  scaled[requestedAxis] = worldCenter[requestedAxis] + (scaled[requestedAxis] - worldCenter[requestedAxis]) * factor;
  return scaled;
}

function pointFromVertexKey(key) {
  const values = String(key).split(",").map(Number);
  return values.length === 3 && values.every(Number.isFinite) ? new THREE.Vector3(...values) : null;
}

function remapProtectedEdgesForTargets(mesh, targets) {
  const protectedEdges = Array.isArray(mesh.userData.edgeBevelProtectedEdges) ? mesh.userData.edgeBevelProtectedEdges : [];
  mesh.userData.edgeBevelProtectedEdges = protectedEdges.map(signature => {
    const [keyA, keyB] = String(signature).split("|");
    const pointA = targets.get(keyA)?.clone() || pointFromVertexKey(keyA);
    const pointB = targets.get(keyB)?.clone() || pointFromVertexKey(keyB);
    return pointA && pointB ? localEdgeSignature(pointA, pointB) : signature;
  });
}

function refreshScaledSurfaceSelection(mesh, targets) {
  const mappedPoint = point => targets.get(vertexKey(point))?.clone() || point.clone();
  for (const vertex of selectedSurfaceVertices.filter(entry => entry.mesh === mesh)) {
    vertex.localPoint.copy(mappedPoint(vertex.localPoint));
    vertex.key = surfaceVertexKey(mesh, vertex.localPoint);
  }
  for (const edge of selectedSurfaceEdges.filter(entry => entry.mesh === mesh)) {
    edge.localA.copy(mappedPoint(edge.localA));
    edge.localB.copy(mappedPoint(edge.localB));
    edge.key = surfaceEdgeKey(mesh, edge.localA, edge.localB);
    edge.protectedBevelEdge = (mesh.userData.edgeBevelProtectedEdges || []).includes(localEdgeSignature(edge.localA, edge.localB));
  }
  for (const face of selectedFaces.filter(entry => entry.mesh === mesh)) {
    const refreshed = faceFromLocalTriangle(
      mesh,
      face.localTrianglePoints.map(mappedPoint),
      face.faceIndex,
      face.localUvs?.map(uv => uv.clone()) || null
    );
    Object.assign(face, refreshed);
  }
  selectedFace = selectedFaces.at(-1) || null;
}

function scaleSelectedSurface() {
  const byMesh = selectedSurfacePointMaps();
  if (!byMesh.size) {
    log("Select vertices, edges, triangles, or a Whole Face before using Scale Selected Surface.");
    return [];
  }
  const { requestedAxis, amount, factor } = surfaceScaleSettings();
  if (Math.abs(factor - 1) < .000001) {
    log("Scale Selected Surface is set to 100%, so the surface was left unchanged.");
    return [];
  }
  for (const points of byMesh.values()) {
    if (points.size < 2) {
      log("Scale Selected Surface needs at least two selected points.");
      return [];
    }
  }

  recordHistory("scale selected surface");
  let movedOccurrences = 0;
  for (const [mesh, points] of byMesh) {
    mesh.updateWorldMatrix(true, false);
    const worldPoints = [...points.values()].map(point => point.clone().applyMatrix4(mesh.matrixWorld));
    const worldCenter = worldPoints.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / worldPoints.length);
    const inverseWorld = mesh.matrixWorld.clone().invert();
    const targets = new Map();
    for (const [key, localPoint] of points) {
      const scaledWorld = scaleSurfacePoint(localPoint.clone().applyMatrix4(mesh.matrixWorld), worldCenter, factor, requestedAxis);
      targets.set(key, scaledWorld.applyMatrix4(inverseWorld));
    }

    const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    const position = geometry.getAttribute("position");
    const localPoint = new THREE.Vector3();
    for (let index = 0; index < position.count; index++) {
      localPoint.fromBufferAttribute(position, index);
      const target = targets.get(vertexKey(localPoint));
      if (!target) continue;
      position.setXYZ(index, target.x, target.y, target.z);
      movedOccurrences++;
    }
    position.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    replaceEditableMeshGeometry(mesh, geometry);
    remapProtectedEdgesForTargets(mesh, targets);
    refreshScaledSurfaceSelection(mesh, targets);
  }

  updateFaceMarker();
  updateSurfaceComponentMarker();
  updateAll();
  syncSurfaceEditorUi();
  updateSurfaceGizmoAttachment();
  log(`Scaled the selected surface to ${round(amount)}% around its own center${requestedAxis === "uniform" ? "" : ` on world ${requestedAxis.toUpperCase()}`}.`, {
    meshes: byMesh.size,
    selectedPoints: [...byMesh.values()].reduce((sum, points) => sum + points.size, 0),
    movedOccurrences,
    textureCoordinatesPreserved: true
  });
  return [...byMesh.keys()];
}

function relaxVertexSettings() {
  const mode = els.relaxModeSelect?.value === "smooth" ? "smooth" : "relax";
  const rawStrength = Number(els.relaxStrengthInput?.value);
  const rawIterations = Number(els.relaxIterationsInput?.value);
  const strength = Math.max(1, Math.min(100, Number.isFinite(rawStrength) ? rawStrength : 50));
  const iterations = Math.max(1, Math.min(20, Math.round(Number.isFinite(rawIterations) ? rawIterations : 1)));
  const preserveBoundary = !!els.relaxPreserveBoundaryInput?.checked;
  if (els.relaxModeSelect) els.relaxModeSelect.value = mode;
  if (els.relaxStrengthInput) els.relaxStrengthInput.value = String(strength);
  if (els.relaxIterationsInput) els.relaxIterationsInput.value = String(iterations);
  return { mode, strength, factor: strength / 100, iterations, preserveBoundary };
}

function relaxMeshTopology(geometry) {
  const source = geometry.index ? geometry.toNonIndexed() : geometry;
  const position = source.getAttribute("position");
  const points = new Map();
  const adjacency = new Map();
  const edgeCounts = new Map();
  const triangles = [];
  const point = new THREE.Vector3();
  const addNeighbor = (from, to) => {
    if (!adjacency.has(from)) adjacency.set(from, new Set());
    adjacency.get(from).add(to);
  };
  for (let index = 0; index < position.count; index += 3) {
    const keys = [];
    for (let offset = 0; offset < 3; offset++) {
      point.fromBufferAttribute(position, index + offset);
      const key = vertexKey(point);
      keys.push(key);
      if (!points.has(key)) points.set(key, point.clone());
      if (!adjacency.has(key)) adjacency.set(key, new Set());
    }
    triangles.push(keys);
    for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) {
      addNeighbor(keys[a], keys[b]);
      addNeighbor(keys[b], keys[a]);
      const edgeKey = [keys[a], keys[b]].sort().join("|");
      edgeCounts.set(edgeKey, (edgeCounts.get(edgeKey) || 0) + 1);
    }
  }
  const boundaryKeys = new Set();
  for (const [edgeKey, count] of edgeCounts) {
    if (count !== 1) continue;
    const [keyA, keyB] = edgeKey.split("|");
    boundaryKeys.add(keyA);
    boundaryKeys.add(keyB);
  }
  if (source !== geometry) source.dispose();
  return { points, adjacency, triangles, boundaryKeys };
}

function prepareRelaxVertexPlan(mesh, selectedKeys, settings) {
  const topology = relaxMeshTopology(mesh.geometry);
  const currentPoints = new Map([...topology.points].map(([key, point]) => [key, point.clone()]));
  const editableKeys = [...selectedKeys].filter(key => currentPoints.has(key)
    && (!settings.preserveBoundary || !topology.boundaryKeys.has(key))
    && (topology.adjacency.get(key)?.size || 0) >= 2);
  if (!editableKeys.length) return null;

  for (let iteration = 0; iteration < settings.iterations; iteration++) {
    const nextTargets = new Map();
    const beforeCenter = new THREE.Vector3();
    const afterCenter = new THREE.Vector3();
    for (const key of editableKeys) {
      const current = currentPoints.get(key);
      const neighbors = [...topology.adjacency.get(key)].map(neighborKey => currentPoints.get(neighborKey)).filter(Boolean);
      if (!neighbors.length) continue;
      const average = neighbors.reduce((sum, neighbor) => sum.add(neighbor), new THREE.Vector3()).multiplyScalar(1 / neighbors.length);
      const delta = average.sub(current);
      const next = current.clone().addScaledVector(delta, settings.factor);
      nextTargets.set(key, next);
      beforeCenter.add(current);
      afterCenter.add(next);
    }
    if (!nextTargets.size) continue;
    if (settings.mode === "relax" && nextTargets.size > 1) {
      const centerCorrection = beforeCenter.multiplyScalar(1 / nextTargets.size)
        .sub(afterCenter.multiplyScalar(1 / nextTargets.size));
      for (const next of nextTargets.values()) next.add(centerCorrection);
    }
    for (const [key, next] of nextTargets) currentPoints.set(key, next);
  }

  const targets = new Map();
  for (const key of editableKeys) {
    const original = topology.points.get(key);
    const target = currentPoints.get(key);
    if (original && target && original.distanceToSquared(target) > 1e-12) targets.set(key, target.clone());
  }
  return targets.size ? { mesh, targets, topology, editableKeys } : null;
}

function applyRelaxVertexPlan(plan) {
  const { mesh, targets } = plan;
  const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  const position = geometry.getAttribute("position");
  const point = new THREE.Vector3();
  let movedOccurrences = 0;
  for (let index = 0; index < position.count; index++) {
    point.fromBufferAttribute(position, index);
    const target = targets.get(vertexKey(point));
    if (!target) continue;
    position.setXYZ(index, target.x, target.y, target.z);
    movedOccurrences++;
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  replaceEditableMeshGeometry(mesh, geometry);
  remapProtectedEdgesForTargets(mesh, targets);
  for (const vertex of selectedSurfaceVertices.filter(entry => entry.mesh === mesh)) {
    const target = targets.get(vertexKey(vertex.localPoint));
    if (target) vertex.localPoint.copy(target);
    vertex.key = surfaceVertexKey(mesh, vertex.localPoint);
  }
  return movedOccurrences;
}

function settleSurfacePointerInteraction() {
  finishDragPushSession();
  const draggingControl = surfaceTransforms.find(control => control.dragging);
  if (draggingControl) draggingControl.pointerUp({ button: 0 });
  else if (surfaceGizmoDragging) finishSurfaceGizmoDrag();
  for (const control of surfaceTransforms) control.enabled = true;
  if (!spaceCameraMode) orbit.enabled = true;
}

function relaxSelectedVertices() {
  settleSurfacePointerInteraction();
  if (surfaceComponentMode !== "vertex" || !selectedSurfaceVertices.length) {
    log("Choose Vertex and select one or more connected vertices before using Smooth / Relax Vertices.");
    return [];
  }
  const settings = relaxVertexSettings();
  const byMesh = new Map();
  for (const vertex of selectedSurfaceVertices) {
    if (!byMesh.has(vertex.mesh)) byMesh.set(vertex.mesh, new Set());
    byMesh.get(vertex.mesh).add(vertexKey(vertex.localPoint));
  }
  const plans = [];
  for (const [mesh, selectedKeys] of byMesh) {
    const plan = prepareRelaxVertexPlan(mesh, selectedKeys, settings);
    if (plan) plans.push(plan);
  }
  if (!plans.length) {
    log(settings.preserveBoundary
      ? "The selected vertices are already relaxed or belong only to protected open boundaries."
      : "The selected vertices are already relaxed or do not have enough connected neighbors.");
    return [];
  }

  recordHistory(`${settings.mode} selected vertices`);
  let movedOccurrences = 0;
  for (const plan of plans) movedOccurrences += applyRelaxVertexPlan(plan);
  updateSurfaceComponentMarker();
  updateAll();
  syncSurfaceEditorUi();
  updateSurfaceGizmoAttachment();
  log(`${settings.mode === "relax" ? "Relaxed" : "Smoothed"} ${plans.reduce((sum, plan) => sum + plan.targets.size, 0)} selected vert${plans.reduce((sum, plan) => sum + plan.targets.size, 0) === 1 ? "ex" : "ices"}.`, {
    meshes: plans.length,
    strength: settings.strength,
    iterations: settings.iterations,
    preserveOpenBoundaries: settings.preserveBoundary,
    movedOccurrences,
    textureCoordinatesPreserved: true
  });
  return plans.map(plan => plan.mesh);
}

function weldVertexTargetMode() {
  const mode = String(els.weldVertexTargetSelect?.value || "center").toLowerCase();
  const normalized = ["center", "first", "last"].includes(mode) ? mode : "center";
  if (els.weldVertexTargetSelect) els.weldVertexTargetSelect.value = normalized;
  return normalized;
}

function topologyEdgeCounts(triangles) {
  const counts = new Map();
  for (const keys of triangles) {
    for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) {
      const signature = JSON.stringify([keys[a], keys[b]].sort());
      counts.set(signature, (counts.get(signature) || 0) + 1);
    }
  }
  return counts;
}

function topologyIsClosedTriangleMesh(triangles) {
  const counts = topologyEdgeCounts(triangles);
  return counts.size > 0 && [...counts.values()].every(count => count === 2);
}

function weldTriangleNormal(points) {
  return new THREE.Vector3().crossVectors(
    points[1].clone().sub(points[0]),
    points[2].clone().sub(points[0])
  ).normalize();
}

function assignWeldFlatRegions(triangles) {
  const edgeToTriangles = new Map();
  triangles.forEach((triangle, triangleIndex) => {
    for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) {
      const signature = JSON.stringify([triangle.originalTopologyKeys[a], triangle.originalTopologyKeys[b]].sort());
      if (!edgeToTriangles.has(signature)) edgeToTriangles.set(signature, []);
      edgeToTriangles.get(signature).push(triangleIndex);
    }
  });
  const adjacency = triangles.map(() => new Set());
  for (const linkedTriangles of edgeToTriangles.values()) {
    if (linkedTriangles.length !== 2) continue;
    const [aIndex, bIndex] = linkedTriangles;
    const a = triangles[aIndex];
    const b = triangles[bIndex];
    if (a.materialIndex !== b.materialIndex || a.sourceNormal.dot(b.sourceNormal) < .99999) continue;
    adjacency[aIndex].add(bIndex);
    adjacency[bIndex].add(aIndex);
  }
  const visited = new Set();
  let regionId = 0;
  for (let start = 0; start < triangles.length; start++) {
    if (visited.has(start)) continue;
    const members = [];
    const queue = [start];
    visited.add(start);
    while (queue.length) {
      const current = queue.shift();
      members.push(current);
      for (const neighbor of adjacency[current]) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
    for (const triangleIndex of members) {
      triangles[triangleIndex].flatRegionId = regionId;
      triangles[triangleIndex].flatRegionSize = members.length;
      triangles[triangleIndex].flatRegionNormal = triangles[start].sourceNormal.clone();
    }
    regionId++;
  }
}

function alignedWeldTriangle(topologyKeys, corners, template) {
  const keys = [...topologyKeys];
  const points = keys.map(key => corners.get(key).point.clone());
  const sourceIndices = keys.map(key => corners.get(key).sourceIndex);
  const normal = weldTriangleNormal(points);
  if (normal.dot(template.flatRegionNormal) < 0) {
    [keys[1], keys[2]] = [keys[2], keys[1]];
    [points[1], points[2]] = [points[2], points[1]];
    [sourceIndices[1], sourceIndices[2]] = [sourceIndices[2], sourceIndices[1]];
  }
  return {
    points,
    topologyKeys: keys,
    sourceIndices,
    materialIndex: template.materialIndex,
    flatRegionId: template.flatRegionId,
    flatRegionSize: template.flatRegionSize,
    flatRegionNormal: template.flatRegionNormal.clone()
  };
}

function retriangulateWeldedFlatQuads(triangles, weldedTopologyKey) {
  const regionEntries = new Map();
  triangles.forEach((triangle, triangleIndex) => {
    if (triangle.flatRegionSize !== 2) return;
    if (!regionEntries.has(triangle.flatRegionId)) regionEntries.set(triangle.flatRegionId, []);
    regionEntries.get(triangle.flatRegionId).push({ triangle, triangleIndex });
  });
  let retriangulated = 0;
  for (const entries of regionEntries.values()) {
    if (entries.length !== 2) continue;
    const [first, second] = entries;
    const firstKeys = new Set(first.triangle.topologyKeys);
    const secondKeys = new Set(second.triangle.topologyKeys);
    const sharedKeys = [...firstKeys].filter(key => secondKeys.has(key));
    const oppositeKeys = [
      ...[...firstKeys].filter(key => !secondKeys.has(key)),
      ...[...secondKeys].filter(key => !firstKeys.has(key))
    ];
    if (sharedKeys.length !== 2 || oppositeKeys.length !== 2 || new Set([...sharedKeys, ...oppositeKeys]).size !== 4) continue;
    const corners = new Map();
    for (const entry of entries) {
      entry.triangle.topologyKeys.forEach((key, corner) => {
        if (!corners.has(key)) {
          corners.set(key, {
            point: entry.triangle.points[corner].clone(),
            sourceIndex: entry.triangle.sourceIndices[corner]
          });
        }
      });
    }
    const currentDiagonal = corners.get(sharedKeys[0]).point.distanceToSquared(corners.get(sharedKeys[1]).point);
    const alternateDiagonal = corners.get(oppositeKeys[0]).point.distanceToSquared(corners.get(oppositeKeys[1]).point);
    const currentUsesWeld = sharedKeys.includes(weldedTopologyKey);
    const alternateUsesWeld = oppositeKeys.includes(weldedTopologyKey);
    const shouldFlip = alternateDiagonal < currentDiagonal - 1e-12
      || (Math.abs(alternateDiagonal - currentDiagonal) <= 1e-12 && alternateUsesWeld && !currentUsesWeld);
    if (!shouldFlip) continue;
    triangles[first.triangleIndex] = alignedWeldTriangle(
      [oppositeKeys[0], sharedKeys[0], oppositeKeys[1]],
      corners,
      first.triangle
    );
    triangles[second.triangleIndex] = alignedWeldTriangle(
      [oppositeKeys[0], oppositeKeys[1], sharedKeys[1]],
      corners,
      second.triangle
    );
    retriangulated++;
  }
  return retriangulated;
}

function materialIndexForTriangle(geometry, triangleIndex) {
  const vertexOffset = triangleIndex * 3;
  const group = geometry.groups.find(candidate =>
    vertexOffset >= candidate.start && vertexOffset < candidate.start + candidate.count
  );
  return group?.materialIndex ?? 0;
}

function geometryFromWeldedTriangles(source, triangles) {
  const geometry = new THREE.BufferGeometry();
  const sourceAttributes = Object.entries(source.attributes);
  for (const [name, attribute] of sourceAttributes) {
    if (name === "normal" || name === "tangent") continue;
    const values = [];
    for (const triangle of triangles) {
      for (let corner = 0; corner < 3; corner++) {
        if (name === "position") {
          values.push(...triangle.points[corner].toArray());
          continue;
        }
        const sourceIndex = triangle.sourceIndices[corner];
        const offset = sourceIndex * attribute.itemSize;
        for (let component = 0; component < attribute.itemSize; component++) {
          values.push(attribute.array[offset + component]);
        }
      }
    }
    const TypedArray = attribute.array.constructor;
    geometry.setAttribute(name, new THREE.BufferAttribute(new TypedArray(values), attribute.itemSize, attribute.normalized));
  }
  if (source.groups.length && triangles.length) {
    let runStart = 0;
    let runMaterial = triangles[0].materialIndex;
    for (let index = 1; index <= triangles.length; index++) {
      const materialIndex = triangles[index]?.materialIndex;
      if (index < triangles.length && materialIndex === runMaterial) continue;
      geometry.addGroup(runStart * 3, (index - runStart) * 3, runMaterial);
      runStart = index;
      runMaterial = materialIndex;
    }
  }
  geometry.name = source.name;
  geometry.userData = { ...(source.userData || {}) };
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function dissolveTriangleRecords(source) {
  const position = source.getAttribute("position");
  if (!position) return [];
  const triangles = [];
  for (let index = 0; index < position.count; index += 3) {
    const points = [0, 1, 2].map(offset => new THREE.Vector3(
      position.getX(index + offset),
      position.getY(index + offset),
      position.getZ(index + offset)
    ));
    triangles.push({
      points,
      topologyKeys: points.map(vertexKey),
      sourceIndices: [index, index + 1, index + 2],
      materialIndex: materialIndexForTriangle(source, index / 3),
      normal: weldTriangleNormal(points)
    });
  }
  return triangles;
}

function triangleAttributesMatchAtKeys(source, triangles, keys) {
  for (const key of keys) {
    const samples = [];
    for (const triangle of triangles) {
      triangle.topologyKeys.forEach((triangleKey, corner) => {
        if (triangleKey === key) samples.push(triangle.sourceIndices[corner]);
      });
    }
    for (const [name, attribute] of Object.entries(source.attributes)) {
      if (name === "position" || name === "normal" || name === "tangent" || samples.length < 2) continue;
      for (let sample = 1; sample < samples.length; sample++) {
        for (let component = 0; component < attribute.itemSize; component++) {
          const first = attribute.array[samples[0] * attribute.itemSize + component];
          const current = attribute.array[samples[sample] * attribute.itemSize + component];
          if (Math.abs(first - current) > 1e-5) return false;
        }
      }
    }
  }
  return true;
}

function metadataEdgesWithoutVertex(signatures, topology, removedVertexKey) {
  const retained = [];
  for (const signature of signatures || []) {
    const endpoints = topology.edgePairs.get(signature);
    if (!endpoints || endpoints.some(point => vertexKey(point) === removedVertexKey)) continue;
    retained.push(signature);
  }
  return retained;
}

function orderedDissolveBoundary(boundaryEdges) {
  const adjacency = new Map();
  for (const [a, b] of boundaryEdges) {
    if (!adjacency.has(a)) adjacency.set(a, []);
    if (!adjacency.has(b)) adjacency.set(b, []);
    adjacency.get(a).push(b);
    adjacency.get(b).push(a);
  }
  if (!adjacency.size || [...adjacency.values()].some(neighbors => neighbors.length !== 2)) return null;
  const start = boundaryEdges[0][0];
  const ordered = [start];
  let previous = null;
  let current = start;
  for (let guard = 0; guard <= boundaryEdges.length; guard++) {
    const candidates = adjacency.get(current);
    const next = candidates.find(candidate => candidate !== previous) ?? candidates[0];
    if (next === start) return ordered.length === boundaryEdges.length ? ordered : null;
    if (ordered.includes(next)) return null;
    ordered.push(next);
    previous = current;
    current = next;
  }
  return null;
}

function reportDissolveResult(message, data = null) {
  if (els.hudText) els.hudText.textContent = message;
  log(message, data);
}

function dissolveSelectedEdge() {
  if (selectedSurfaceEdges.length !== 1) {
    reportDissolveResult("Dissolve blocked: select exactly one flat internal edge.");
    return [];
  }
  const selectedEdge = selectedSurfaceEdges[0];
  const mesh = selectedEdge.mesh;
  const source = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  const triangles = dissolveTriangleRecords(source);
  const edgeKeys = [vertexKey(selectedEdge.localA), vertexKey(selectedEdge.localB)];
  const incident = triangles.filter(triangle => edgeKeys.every(key => triangle.topologyKeys.includes(key)));
  if (incident.length !== 2) {
    source.dispose();
    reportDissolveResult("Dissolve blocked: the selected edge must be internal and shared by exactly two triangles.", { adjacentTriangles: incident.length });
    return [];
  }
  if (incident[0].normal.dot(incident[1].normal) < .99999) {
    source.dispose();
    reportDissolveResult("Dissolve blocked: visible creases are protected. Select a flat edge inside one surface.");
    return [];
  }
  if (incident[0].materialIndex !== incident[1].materialIndex || !triangleAttributesMatchAtKeys(source, incident, edgeKeys)) {
    source.dispose();
    reportDissolveResult("Dissolve blocked: the selected edge is a protected material or UV seam.");
    return [];
  }
  source.dispose();
  const signature = localEdgeSignature(selectedEdge.localA, selectedEdge.localB);
  const dissolvedEdges = new Set(mesh.userData.dissolvedSurfaceEdges || []);
  if (dissolvedEdges.has(signature)) {
    reportDissolveResult("Dissolve blocked: that modeling edge is already dissolved.");
    return [];
  }
  recordHistory("dissolve selected edge");
  dissolvedEdges.add(signature);
  mesh.userData.dissolvedSurfaceEdges = [...dissolvedEdges];
  selectedSurfaceEdges.length = 0;
  updateSurfaceComponentMarker();
  updateAll();
  syncSurfaceEditorUi();
  updateSurfaceGizmoAttachment();
  reportDissolveResult("DISSOLVE COMPLETE: 1 modeling edge removed. Shape and texture stay unchanged; Undo is ready.", {
    rendererTrianglesChanged: false,
    uvPreserved: true,
    dissolvedModelingEdges: dissolvedEdges.size
  });
  return [mesh];
}

function dissolveSelectedVertex() {
  if (selectedSurfaceVertices.length !== 1) {
    reportDissolveResult("Dissolve blocked: select exactly one internal vertex.");
    return [];
  }
  const selectedVertex = selectedSurfaceVertices[0];
  const mesh = selectedVertex.mesh;
  const removedVertexKey = vertexKey(selectedVertex.localPoint);
  const source = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  const triangles = dissolveTriangleRecords(source);
  const incidentIndexes = triangles
    .map((triangle, index) => triangle.topologyKeys.includes(removedVertexKey) ? index : -1)
    .filter(index => index >= 0);
  if (incidentIndexes.length < 3) {
    source.dispose();
    reportDissolveResult("Dissolve blocked: the vertex must be internal and surrounded by at least three triangles.", { adjacentTriangles: incidentIndexes.length });
    return [];
  }
  const incident = incidentIndexes.map(index => triangles[index]);
  if (new Set(incident.map(triangle => triangle.materialIndex)).size !== 1) {
    source.dispose();
    reportDissolveResult("Dissolve blocked: the vertex is on a protected material boundary.");
    return [];
  }
  const edgeCounts = new Map();
  for (const triangle of incident) {
    for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) {
      const keys = [triangle.topologyKeys[a], triangle.topologyKeys[b]].sort();
      const signature = JSON.stringify(keys);
      const entry = edgeCounts.get(signature) || { keys, count: 0 };
      entry.count++;
      edgeCounts.set(signature, entry);
    }
  }
  const boundaryEdges = [...edgeCounts.values()].filter(entry => entry.count === 1).map(entry => entry.keys);
  if (boundaryEdges.some(keys => keys.includes(removedVertexKey))) {
    source.dispose();
    reportDissolveResult("Dissolve blocked: removing this vertex would open a boundary edge.");
    return [];
  }
  const boundaryKeys = orderedDissolveBoundary(boundaryEdges);
  if (!boundaryKeys || boundaryKeys.length < 3) {
    source.dispose();
    reportDissolveResult("Dissolve blocked: no closed manifold boundary was found around the vertex.");
    return [];
  }
  const corners = new Map();
  for (const triangle of incident) {
    triangle.topologyKeys.forEach((key, corner) => {
      if (key === removedVertexKey || corners.has(key)) return;
      corners.set(key, { point: triangle.points[corner].clone(), sourceIndex: triangle.sourceIndices[corner] });
    });
  }
  const normal = incident.reduce((sum, triangle) => sum.add(triangle.normal), new THREE.Vector3()).normalize();
  const boundaryPoints = boundaryKeys.map(key => corners.get(key).point);
  const uAxis = boundaryPoints[1].clone().sub(boundaryPoints[0]).normalize();
  const vAxis = normal.clone().cross(uAxis).normalize();
  if (vAxis.lengthSq() < 1e-10) {
    source.dispose();
    reportDissolveResult("Dissolve blocked: the surrounding surface cannot be projected safely.");
    return [];
  }
  const center = boundaryPoints.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / boundaryPoints.length);
  const contour = boundaryPoints.map(point => new THREE.Vector2(
    point.clone().sub(center).dot(uAxis),
    point.clone().sub(center).dot(vAxis)
  ));
  const fillIndices = THREE.ShapeUtils.triangulateShape(contour, []);
  if (!fillIndices.length) {
    source.dispose();
    reportDissolveResult("Dissolve blocked: the surrounding boundary cannot be re-triangulated safely.");
    return [];
  }
  const template = {
    materialIndex: incident[0].materialIndex,
    flatRegionId: -1,
    flatRegionSize: fillIndices.length,
    flatRegionNormal: normal
  };
  const fillTriangles = fillIndices.map(indices => alignedWeldTriangle(indices.map(index => boundaryKeys[index]), corners, template));
  const incidentSet = new Set(incidentIndexes);
  const nextTriangles = triangles.filter((triangle, index) => !incidentSet.has(index));
  nextTriangles.push(...fillTriangles);
  const beforeTopology = triangles.map(triangle => triangle.topologyKeys);
  const afterTopology = nextTriangles.map(triangle => triangle.topologyKeys);
  const beforeClosed = topologyIsClosedTriangleMesh(beforeTopology);
  const afterCounts = topologyEdgeCounts(afterTopology);
  const afterClosed = topologyIsClosedTriangleMesh(afterTopology);
  const nonManifoldEdgeCount = [...afterCounts.values()].filter(count => count > 2).length;
  if (nonManifoldEdgeCount || (beforeClosed && !afterClosed)) {
    source.dispose();
    reportDissolveResult("Dissolve blocked: the result would be open or non-manifold.", {
      beforeClosed,
      afterClosed,
      nonManifoldEdgeCount
    });
    return [];
  }
  const sourceTopology = edgeSlideTopology(source);
  const protectedEdges = metadataEdgesWithoutVertex(mesh.userData.edgeBevelProtectedEdges, sourceTopology, removedVertexKey);
  const dissolvedEdges = metadataEdgesWithoutVertex(mesh.userData.dissolvedSurfaceEdges, sourceTopology, removedVertexKey);
  const geometry = geometryFromWeldedTriangles(source, nextTriangles);
  source.dispose();
  recordHistory("dissolve selected vertex");
  replaceEditableMeshGeometry(mesh, geometry);
  mesh.userData.edgeBevelProtectedEdges = protectedEdges;
  mesh.userData.dissolvedSurfaceEdges = dissolvedEdges;
  selectedSurfaceVertices.length = 0;
  selectedSurfaceEdges.length = 0;
  selectedFaces.length = 0;
  selectedFace = null;
  updateFaceMarker();
  updateSurfaceComponentMarker();
  updateAll();
  syncSurfaceEditorUi();
  updateSurfaceGizmoAttachment();
  reportDissolveResult("DISSOLVE COMPLETE: 1 vertex removed and its surface re-triangulated. Undo is ready.", {
    removedTriangles: incident.length,
    createdTriangles: fillTriangles.length,
    beforeTriangles: triangles.length,
    afterTriangles: nextTriangles.length,
    closedMeshPreserved: beforeClosed ? afterClosed : "source mesh was open",
    uvPreservedPerBoundaryCorner: !!geometry.getAttribute("uv")
  });
  return [mesh];
}

function dissolveSelectedSurfaceComponent() {
  if (surfaceComponentMode === "edge") return dissolveSelectedEdge();
  if (surfaceComponentMode === "vertex") return dissolveSelectedVertex();
  reportDissolveResult("Dissolve blocked: choose Edge or Vertex and select one component.");
  return [];
}

function weldSelectedVertices() {
  if (surfaceComponentMode !== "vertex" || selectedSurfaceVertices.length < 2) {
    log("Choose Vertex and select at least two vertices with Shift or Ctrl before using Weld Vertices.");
    return [];
  }
  const meshes = [...new Set(selectedSurfaceVertices.map(vertex => vertex.mesh).filter(Boolean))];
  if (meshes.length !== 1) {
    log("Weld Vertices works on vertices from one mesh at a time.");
    return [];
  }
  const mesh = meshes[0];
  const vertices = selectedSurfaceVertices.filter(vertex => vertex.mesh === mesh);
  const uniqueVertices = [...new Map(vertices.map(vertex => [vertex.key, vertex])).values()];
  if (uniqueVertices.length < 2) {
    log("Select two different vertices before using Weld Vertices.");
    return [];
  }

  const targetMode = weldVertexTargetMode();
  const target = targetMode === "first"
    ? uniqueVertices[0].localPoint.clone()
    : targetMode === "last"
      ? uniqueVertices.at(-1).localPoint.clone()
      : uniqueVertices.reduce((sum, vertex) => sum.add(vertex.localPoint), new THREE.Vector3())
        .multiplyScalar(1 / uniqueVertices.length);
  const selectedPointKeys = new Set(uniqueVertices.map(vertex => vertexKey(vertex.localPoint)));
  const source = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  const position = source.getAttribute("position");
  if (!position || position.count < 3) {
    source.dispose();
    log("The selected mesh has no editable triangle geometry.");
    return [];
  }

  const beforeTopologyTriangles = [];
  const nextTriangles = [];
  const topologyTriangleSignatures = new Set();
  const weldedTopologyKey = "__boltworks_welded_vertex__";
  let removedDegenerate = 0;
  let removedDuplicate = 0;
  const sourceTriangles = [];
  for (let index = 0; index < position.count; index += 3) {
    const originalPoints = [0, 1, 2].map(offset => new THREE.Vector3(
      position.getX(index + offset),
      position.getY(index + offset),
      position.getZ(index + offset)
    ));
    const originalTopologyKeys = originalPoints.map(point => vertexKey(point));
    sourceTriangles.push({
      originalPoints,
      originalTopologyKeys,
      sourceIndices: [index, index + 1, index + 2],
      sourceNormal: weldTriangleNormal(originalPoints),
      materialIndex: materialIndexForTriangle(source, index / 3)
    });
  }
  assignWeldFlatRegions(sourceTriangles);
  for (const sourceTriangle of sourceTriangles) {
    const { originalPoints, originalTopologyKeys } = sourceTriangle;
    beforeTopologyTriangles.push(originalTopologyKeys);
    const topologyKeys = originalTopologyKeys.map(key => selectedPointKeys.has(key) ? weldedTopologyKey : key);
    const points = originalPoints.map(point => selectedPointKeys.has(vertexKey(point)) ? target.clone() : point.clone());
    if (new Set(topologyKeys).size < 3) {
      removedDegenerate++;
      continue;
    }
    const area = new THREE.Vector3().crossVectors(
      points[1].clone().sub(points[0]),
      points[2].clone().sub(points[0])
    ).lengthSq();
    if (area <= 1e-12) {
      removedDegenerate++;
      continue;
    }
    const topologySignature = JSON.stringify([...topologyKeys].sort());
    if (topologyTriangleSignatures.has(topologySignature)) {
      removedDuplicate++;
      continue;
    }
    topologyTriangleSignatures.add(topologySignature);
    nextTriangles.push({
      points,
      topologyKeys,
      sourceIndices: sourceTriangle.sourceIndices,
      materialIndex: sourceTriangle.materialIndex,
      flatRegionId: sourceTriangle.flatRegionId,
      flatRegionSize: sourceTriangle.flatRegionSize,
      flatRegionNormal: sourceTriangle.flatRegionNormal
    });
  }

  if (!nextTriangles.length) {
    source.dispose();
    log("Weld Vertices would remove every triangle, so the mesh was left unchanged.");
    return [];
  }
  const retriangulatedQuads = retriangulateWeldedFlatQuads(nextTriangles, weldedTopologyKey);
  const nextTopologyTriangles = nextTriangles.map(triangle => triangle.topologyKeys);
  const beforeClosed = topologyIsClosedTriangleMesh(beforeTopologyTriangles);
  const afterEdgeCounts = topologyEdgeCounts(nextTopologyTriangles);
  const afterClosed = topologyIsClosedTriangleMesh(nextTopologyTriangles);
  const nonManifoldEdgeCount = [...afterEdgeCounts.values()].filter(count => count > 2).length;
  const createsNonManifoldEdge = nonManifoldEdgeCount > 0;
  if (createsNonManifoldEdge || (beforeClosed && !afterClosed)) {
    source.dispose();
    log("Weld Vertices would open the closed mesh or create a non-manifold edge, so the mesh was left unchanged.", {
      placement: targetMode,
      beforeClosed,
      afterClosed,
      nonManifoldEdgeCount
    });
    return [];
  }

  const sourceTopology = edgeSlideTopology(source);
  const protectedEdges = new Set();
  for (const signature of mesh.userData.edgeBevelProtectedEdges || []) {
    const endpoints = sourceTopology.edgePairs.get(signature);
    if (!endpoints) continue;
    const a = selectedPointKeys.has(vertexKey(endpoints[0])) ? target : endpoints[0];
    const b = selectedPointKeys.has(vertexKey(endpoints[1])) ? target : endpoints[1];
    if (a.distanceToSquared(b) > 1e-12) protectedEdges.add(localEdgeSignature(a, b));
  }

  const geometry = geometryFromWeldedTriangles(source, nextTriangles);
  source.dispose();
  recordHistory("weld selected vertices");
  replaceEditableMeshGeometry(mesh, geometry);
  mesh.userData.edgeBevelProtectedEdges = [...protectedEdges];
  mesh.updateMatrixWorld(true);
  selectedSurfaceVertices.length = 0;
  selectedSurfaceEdges.length = 0;
  selectedFaces.length = 0;
  selectedFace = null;
  selectedSurfaceVertices.push({
    mesh,
    localPoint: target.clone(),
    key: surfaceVertexKey(mesh, target)
  });
  updateFaceMarker();
  updateSurfaceComponentMarker();
  updateAll();
  syncSurfaceEditorUi();
  updateSurfaceGizmoAttachment();
  const placementLabel = targetMode === "first" ? "the first selected position" : targetMode === "last" ? "the last selected position" : "the center";
  log(`Welded ${uniqueVertices.length} vertices at ${placementLabel}. The new vertex remains selected.`, {
    beforeTriangles: beforeTopologyTriangles.length,
    afterTriangles: nextTriangles.length,
    removedDegenerate,
    removedDuplicate,
    retriangulatedQuads,
    closedMeshPreserved: beforeClosed ? afterClosed : "source mesh was open",
    uvPreservedPerTriangleCorner: !!geometry.getAttribute("uv")
  });
  return [mesh];
}

function extendSelectedFaces() {
  if (!selectedFaces.length) {
    log("Select one or more mesh triangles first, then press Extend.");
    setFacePickMode(true);
    return [];
  }
  const depth = faceEditDepth();
  const length = faceLengthResolver(depth);
  const facesByMesh = new Map();
  for (const face of selectedFaces) {
    if (!facesByMesh.has(face.mesh)) facesByMesh.set(face.mesh, []);
    facesByMesh.get(face.mesh).push(face);
  }

  recordHistory("extend selected side");
  let movedVertices = 0;
  for (const [mesh, faces] of facesByMesh) {
    movedVertices += moveSelectedSideVertices(mesh, faces, length);
  }
  selectedFace = selectedFaces.at(-1) || null;
  updateAll();
  log(`Extended ${selectedFaces.length} selected triangle side${selectedFaces.length === 1 ? "" : "s"} by ${round(depth)}${els.connectFaceInput.checked ? " or nearest connected face" : ""}.`, {
    editedMeshes: facesByMesh.size,
    movedVertices
  });
  return [...facesByMesh.keys()];
}

function pullSelectedFaces() {
  const depth = faceEditDepth({ min: .05 });
  return extrudeSelectedRegion({
    distance: depth,
    historyLabel: "pull selected region",
    toolLabel: "Pull",
    actionLabel: "Pulled"
  });
}

function pushSelectedFaces() {
  const depth = faceEditDepth({ min: .05 });
  return extrudeSelectedRegion({
    distance: -depth,
    historyLabel: "push selected region",
    toolLabel: "Push",
    actionLabel: "Pushed"
  });
}

function dragPushAxisLabel() {
  return surfaceAxisMode().toUpperCase();
}

function dragPushTargetMeshes() {
  return [...new Set(selectedFaces.map(face => face.mesh).filter(Boolean))];
}

function canStartDragPushFromHit(hit) {
  if (!dragPushMode || surfaceAxisMode() === "free" || !selectedFaces.length || !hit?.object || !hit.face) return false;
  const hitSignature = triangleSignature(triangleLocalPoints(hit));
  return selectedFaces.some(face => face.mesh === hit.object && triangleSignature(face.localTrianglePoints) === hitSignature);
}

function beginDragPushSession(event) {
  if (!dragPushMode || surfaceAxisMode() === "free" || !selectedFaces.length) return false;
  const step = dragPushStepSize();
  const axis = surfaceAxisMode();
  dragPushSession = {
    pointerId: event.pointerId,
    startClientX: event.clientX,
    startClientY: event.clientY,
    axis,
    step,
    appliedDistance: 0
  };
  orbit.enabled = false;
  canvas.setPointerCapture?.(event.pointerId);
  recordHistory("drag/push selected area");
  const shape = els.surfaceMouseFalloffSelect?.value === "soft"
    ? `Soft radius ${Math.max(.01, Number(els.softRadiusInput?.value) || .25)}`
    : "Hard face";
  els.hudText.textContent = `Surface drag active: drag left or right | ${shape} | Axis ${dragPushAxisLabel()} | Step ${step}`;
  return true;
}

function updateDragPushSession(event) {
  if (!dragPushSession || dragPushSession.pointerId !== event.pointerId) return false;
  const pixelDelta = event.clientX - dragPushSession.startClientX;
  const stepCount = Math.trunc(pixelDelta / 12);
  const targetDistance = stepCount * dragPushSession.step;
  const deltaToApply = targetDistance - dragPushSession.appliedDistance;
  if (Math.abs(deltaToApply) < .0000001) return true;
  const facesByMesh = new Map();
  for (const face of selectedFaces) {
    if (!facesByMesh.has(face.mesh)) facesByMesh.set(face.mesh, []);
    facesByMesh.get(face.mesh).push(face);
  }
  const softFalloff = els.surfaceMouseFalloffSelect?.value === "soft";
  const radius = Math.max(.01, Number(els.softRadiusInput?.value) || .25);
  for (const [mesh, faces] of facesByMesh) {
    if (softFalloff) softMoveFacesByDistance(mesh, faces, deltaToApply, radius, dragPushSession.axis);
    else moveSelectedVerticesAlongAxis(mesh, faces, deltaToApply, dragPushSession.axis);
  }
  dragPushSession.appliedDistance = targetDistance;
  updateAll();
  els.hudText.textContent = `Surface drag active: ${softFalloff ? `Soft radius ${round(radius)}` : "Hard face"} | ${dragPushAxisLabel()} ${round(targetDistance)} | Step ${dragPushSession.step}`;
  return true;
}

function finishDragPushSession(pointerId = null) {
  if (!dragPushSession) return false;
  if (pointerId != null && dragPushSession.pointerId !== pointerId) return false;
  dragPushSession = null;
  if (!spaceCameraMode) orbit.enabled = true;
  if (dragPushMode) {
    const shape = els.surfaceMouseFalloffSelect?.value === "soft"
      ? `soft falloff radius ${round(Math.max(.01, Number(els.softRadiusInput?.value) || .25))}`
      : "hard face";
    els.hudText.textContent = `Surface drag ready: ${shape} along ${dragPushAxisLabel()} in snapped ${dragPushStepSize()} steps`;
  }
  syncSurfaceEditorUi();
  return true;
}

function addFaceRimPart(face, name, localOffset, localScale, normalOffset, color, roughness) {
  const point = worldFacePoint(face);
  const normalWorld = worldFaceNormal(face);
  const { width, height } = currentFaceSize(face);
  const center = point.clone()
    .add(faceLocalToWorldVector(face, new THREE.Vector2(localOffset[0], localOffset[1]), width, height))
    .addScaledVector(normalWorld, normalOffset);
  const rotation = worldEulerFromNormal(normalWorld);
  return addObject({
    shape: "box",
    name,
    position: center.toArray(),
    rotation: [rotation.x, rotation.y, rotation.z].map(value => THREE.MathUtils.radToDeg(value)),
    scale: [Math.max(.03, width * localScale[0]), Math.max(.03, height * localScale[1]), Math.max(.025, localScale[2])],
    color,
    roughness
  }, { record: false });
}

function createBevelFacePatch(face, type, size, depth) {
  const { mesh } = face;
  const region = faceRegionBounds(face);
  const maxInset = Math.max(.04, Math.min(region.width, region.height) * .45);
  const bevel = Math.min(Math.max(.03, size), maxInset);
  const signedDepth = type === "outer" ? Math.abs(depth) : -Math.abs(depth);
  const rotation = worldEulerFromAxes(region.xAxis, region.yAxis, region.zAxis);
  const geometry = region.boundary.length >= 3
    ? makeInsetBeveledPolygonGeometry({ boundary: region.boundary, bevel, innerZ: signedDepth })
    : makeInsetBeveledPanelGeometry({
      width: region.width,
      height: region.height,
      bevel,
      innerZ: signedDepth,
      direction: "front"
    });
  return addObject({
    shape: "custom",
    geometry,
    name: `${mesh.name} ${type} bevel`,
    position: region.worldCenter.clone().addScaledVector(region.zAxis, .002).toArray().map(round),
    rotation: [rotation.x, rotation.y, rotation.z].map(value => round(THREE.MathUtils.radToDeg(value))),
    scale: [1, 1, 1],
    color: `#${mesh.material.color.getHexString()}`,
    roughness: mesh.material.roughness,
    bevel,
    depth: Math.abs(depth),
    direction: type
  }, { record: false });
}

function edgeBevelWidth({ min = .001, max = 10 } = {}) {
  return Math.max(min, Math.min(max, Number(els.edgeBevelWidthInput?.value) || .08));
}

function localEdgeSignature(localA, localB) {
  return [vertexKey(localA), vertexKey(localB)].sort().join("|");
}

function appendAlignedTriangle(positions, uvs, points, triangleUvs, targetNormal, hadUv) {
  const orderedPoints = points.map(point => point.clone());
  const orderedUvs = triangleUvs?.map(uv => uv.clone()) || null;
  const normal = new THREE.Vector3().crossVectors(
    orderedPoints[1].clone().sub(orderedPoints[0]),
    orderedPoints[2].clone().sub(orderedPoints[0])
  );
  if (normal.dot(targetNormal) < 0) {
    [orderedPoints[1], orderedPoints[2]] = [orderedPoints[2], orderedPoints[1]];
    if (orderedUvs) [orderedUvs[1], orderedUvs[2]] = [orderedUvs[2], orderedUvs[1]];
  }
  positions.push(...orderedPoints.flatMap(point => point.toArray()));
  if (!hadUv) return;
  for (const uv of orderedUvs || [new THREE.Vector2(.5, .5), new THREE.Vector2(.5, .5), new THREE.Vector2(.5, .5)]) {
    uvs.push(uv.x, uv.y);
  }
}

function clipLocalPolygon(points, signedDistance) {
  const clipped = [];
  for (let index = 0; index < points.length; index++) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const currentDistance = signedDistance(current);
    const nextDistance = signedDistance(next);
    const currentInside = currentDistance >= -.000001;
    const nextInside = nextDistance >= -.000001;
    if (currentInside) clipped.push(current.clone());
    if (currentInside === nextInside) continue;
    const denominator = currentDistance - nextDistance;
    if (Math.abs(denominator) <= .0000001) continue;
    clipped.push(current.clone().lerp(next, currentDistance / denominator));
  }
  return clipped.filter((point, index) => !index || point.distanceToSquared(clipped[index - 1]) > 1e-12);
}

function convexHullEntries2D(entries) {
  const sorted = [...entries].sort((a, b) => a.point2.x - b.point2.x || a.point2.y - b.point2.y);
  if (sorted.length <= 3) return sorted;
  const cross = (origin, a, b) => a.point2.clone().sub(origin.point2).cross(b.point2.clone().sub(origin.point2));
  const lower = [];
  for (const entry of sorted) {
    while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), entry) <= .0000001) lower.pop();
    lower.push(entry);
  }
  const upper = [];
  for (const entry of [...sorted].reverse()) {
    while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), entry) <= .0000001) upper.pop();
    upper.push(entry);
  }
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

function clipGeometryByLocalPlane(geometry, planeNormal, planePoint, { capUAxis = null } = {}) {
  const source = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  const position = source.getAttribute("position");
  const uv = source.getAttribute("uv");
  const buffers = { positions: [], uvs: [], hasUv: Boolean(uv) };
  const capPoints = new Map();
  const epsilon = .00001;
  const distance = vertex => planeNormal.dot(vertex.point.clone().sub(planePoint));
  const inside = vertex => distance(vertex) <= epsilon;
  const registerCapPoint = vertex => {
    if (Math.abs(distance(vertex)) > .0001) return;
    const key = vertexKey(vertex.point);
    if (!capPoints.has(key)) capPoints.set(key, vertex.point.clone());
  };
  const intersection = (a, b) => {
    const da = distance(a);
    const db = distance(b);
    const vertex = lerpClipVertex(a, b, da / (da - db));
    vertex.point.addScaledVector(planeNormal, -distance(vertex));
    registerCapPoint(vertex);
    return vertex;
  };

  for (let index = 0; index < position.count; index += 3) {
    const polygon = [
      geometryClipVertex(position, uv, index),
      geometryClipVertex(position, uv, index + 1),
      geometryClipVertex(position, uv, index + 2)
    ];
    const clipped = [];
    for (let edgeIndex = 0; edgeIndex < polygon.length; edgeIndex++) {
      const current = polygon[edgeIndex];
      const next = polygon[(edgeIndex + 1) % polygon.length];
      const currentInside = inside(current);
      const nextInside = inside(next);
      if (currentInside && nextInside) clipped.push(next);
      else if (currentInside && !nextInside) clipped.push(intersection(current, next));
      else if (!currentInside && nextInside) clipped.push(intersection(current, next), next);
    }
    clipped.forEach(registerCapPoint);
    for (let triangleIndex = 1; triangleIndex < clipped.length - 1; triangleIndex++) {
      pushClipTriangle(buffers, clipped[0], clipped[triangleIndex], clipped[triangleIndex + 1]);
    }
  }

  const capCenter = [...capPoints.values()]
    .reduce((sum, point) => sum.add(point), new THREE.Vector3())
    .multiplyScalar(1 / Math.max(1, capPoints.size));
  const fallbackBasis = faceBasisFromNormal(planeNormal);
  const u = capUAxis?.clone() || fallbackBasis.u.clone();
  u.addScaledVector(planeNormal, -u.dot(planeNormal));
  if (u.lengthSq() <= 1e-10) u.copy(fallbackBasis.u);
  u.normalize();
  const v = new THREE.Vector3().crossVectors(planeNormal, u).normalize();
  const hull = convexHullEntries2D([...capPoints.values()].map(point => {
    const offset = point.clone().sub(capCenter);
    return { point, point2: new THREE.Vector2(offset.dot(u), offset.dot(v)) };
  }));
  if (hull.length >= 3) {
    const minU = Math.min(...hull.map(entry => entry.point2.x));
    const maxU = Math.max(...hull.map(entry => entry.point2.x));
    const minV = Math.min(...hull.map(entry => entry.point2.y));
    const maxV = Math.max(...hull.map(entry => entry.point2.y));
    const spanU = Math.max(1e-7, maxU - minU);
    const spanV = Math.max(1e-7, maxV - minV);
    const textureSpan = Math.max(spanU, spanV);
    const centerU = (minU + maxU) * .5;
    const centerV = (minV + maxV) * .5;
    const capUvForEntry = entry => new THREE.Vector2(
      .5 + (entry.point2.x - centerU) / textureSpan,
      .5 + (entry.point2.y - centerV) / textureSpan
    );
    for (let index = 1; index < hull.length - 1; index++) {
      const entries = [hull[0], hull[index], hull[index + 1]];
      const points = entries.map(entry => entry.point);
      const capUvs = entries.map(capUvForEntry);
      const normal = new THREE.Vector3().crossVectors(
        points[1].clone().sub(points[0]),
        points[2].clone().sub(points[0])
      );
      const aligned = normal.dot(planeNormal) >= 0;
      const ordered = aligned ? points : [points[0], points[2], points[1]];
      const orderedUvs = aligned ? capUvs : [capUvs[0], capUvs[2], capUvs[1]];
      pushClipTriangle(buffers,
        { point: ordered[0], uv: orderedUvs[0] },
        { point: ordered[1], uv: orderedUvs[1] },
        { point: ordered[2], uv: orderedUvs[2] }
      );
    }
  }

  source.dispose();
  const result = new THREE.BufferGeometry();
  result.setAttribute("position", new THREE.Float32BufferAttribute(buffers.positions, 3));
  if (buffers.hasUv) result.setAttribute("uv", new THREE.Float32BufferAttribute(buffers.uvs, 2));
  result.computeVertexNormals();
  result.computeBoundingBox();
  result.computeBoundingSphere();
  return { geometry: result, capLoop: hull.map(entry => entry.point.clone()) };
}

function planarSurfaceRegionData(seedFace) {
  const faces = coplanarConnectedFaces(seedFace);
  const uniqueVertices = new Map();
  for (const face of faces) {
    for (const point of face.localTrianglePoints) uniqueVertices.set(vertexKey(point), point.clone());
  }
  const localCenter = [...uniqueVertices.values()]
    .reduce((sum, point) => sum.add(point), new THREE.Vector3())
    .multiplyScalar(1 / Math.max(1, uniqueVertices.size));
  const u = seedFace.u.clone().normalize();
  const v = seedFace.v.clone().normalize();
  const normal = seedFace.localNormal.clone().normalize();
  const boundary2 = coplanarRegionBoundary(faces, localCenter, u, v);
  const boundary = boundary2.map(point => localCenter.clone().addScaledVector(u, point.x).addScaledVector(v, point.y));
  return {
    faces,
    normal,
    u,
    v,
    localCenter,
    boundary,
    uvFor: faces.some(face => face.localUvs?.length) ? affineUvSampler(faces, localCenter, u, v) : null
  };
}

function edgeBevelRegionData(mesh, triangle, endpoints, edgeDirection) {
  const seedFace = faceFromLocalTriangle(mesh, triangle.points, null, triangle.uvs);
  const region = planarSurfaceRegionData(seedFace);
  const edgeCenter = endpoints[0].clone().add(endpoints[1]).multiplyScalar(.5);
  const inward = new THREE.Vector3().crossVectors(region.normal, edgeDirection).normalize();
  if (inward.dot(region.localCenter.clone().sub(edgeCenter)) < 0) inward.negate();
  const depths = region.boundary.map(point => point.clone().sub(endpoints[0]).dot(inward));
  const maxDepth = Math.max(...depths);
  return {
    ...region,
    inward,
    maxDepth
  };
}

function edgeBevelEndRegion(mesh, endpoint, excludedSignatures) {
  const endpointKey = vertexKey(endpoint);
  const candidates = meshTriangleFaces(mesh).filter(face =>
    face.localTrianglePoints.some(point => vertexKey(point) === endpointKey)
    && !excludedSignatures.has(triangleSignature(face.localTrianglePoints))
  );
  const regions = [];
  const seen = new Set();
  for (const candidate of candidates) {
    const region = planarSurfaceRegionData(candidate);
    const signatures = region.faces.map(face => triangleSignature(face.localTrianglePoints));
    if (signatures.some(signature => excludedSignatures.has(signature))) continue;
    const key = [...signatures].sort().join("::");
    if (seen.has(key)) continue;
    seen.add(key);
    regions.push(region);
  }
  return regions;
}

function prepareEdgeBevelEndCut(region, endpoint, cutA, cutB) {
  const cutDirection = cutB.clone().sub(cutA);
  if (cutDirection.lengthSq() <= 1e-10) return false;
  cutDirection.normalize();
  const inward = new THREE.Vector3().crossVectors(region.normal, cutDirection).normalize();
  const cutCenter = cutA.clone().add(cutB).multiplyScalar(.5);
  if (inward.dot(region.localCenter.clone().sub(cutCenter)) < 0) inward.negate();
  const signedDistance = point => point.clone().sub(cutA).dot(inward);
  if (signedDistance(endpoint) >= -.000001 || signedDistance(region.localCenter) <= .000001) return false;
  region.clippedBoundary = clipLocalPolygon(region.boundary, signedDistance);
  return region.clippedBoundary.length >= 3;
}

function appendTriangulatedSurfaceRegion(region, positions, uvs, hadUv) {
  let projected = region.clippedBoundary.map(point => {
    const offset = point.clone().sub(region.localCenter);
    return new THREE.Vector2(offset.dot(region.u), offset.dot(region.v));
  });
  if (THREE.ShapeUtils.area(projected) < 0) {
    region.clippedBoundary.reverse();
    projected = projected.reverse();
  }
  let created = 0;
  for (const indices of THREE.ShapeUtils.triangulateShape(projected, [])) {
    const points = indices.map(index => region.clippedBoundary[index]);
    const triangleUvs = region.uvFor ? indices.map(index => region.uvFor(projected[index])) : null;
    appendAlignedTriangle(positions, uvs, points, triangleUvs, region.normal, hadUv);
    created++;
  }
  return created;
}

function bevelSelectedEdge() {
  if (selectedSurfaceEdges.length !== 1) {
    log("Choose Edge and select exactly one sharp edge before using Edge Bevel.");
    return null;
  }
  const selectedEdge = selectedSurfaceEdges[0];
  const mesh = selectedEdge.mesh;
  if (!mesh?.geometry) {
    log("The selected edge does not belong to an editable mesh.");
    return null;
  }
  const selectedEdgeSignature = localEdgeSignature(selectedEdge.localA, selectedEdge.localB);
  if ((mesh.userData.edgeBevelProtectedEdges || []).includes(selectedEdgeSignature)) {
    log("That edge belongs to an existing bevel. Choose the next outer model edge instead so the first bevel is not folded inward.");
    return null;
  }

  const edgeKeys = new Set([vertexKey(selectedEdge.localA), vertexKey(selectedEdge.localB)]);
  const source = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  const position = source.getAttribute("position");
  const uv = source.getAttribute("uv");
  const triangles = [];
  for (let index = 0; index < position.count; index += 3) {
    const points = [0, 1, 2].map(offset => new THREE.Vector3(
      position.getX(index + offset),
      position.getY(index + offset),
      position.getZ(index + offset)
    ));
    const triangleUvs = uv ? [0, 1, 2].map(offset => new THREE.Vector2(
      uv.getX(index + offset),
      uv.getY(index + offset)
    )) : null;
    const keys = points.map(vertexKey);
    const normal = new THREE.Vector3().crossVectors(
      points[1].clone().sub(points[0]),
      points[2].clone().sub(points[0])
    ).normalize();
    triangles.push({ points, uvs: triangleUvs, keys, normal, signature: triangleSignature(points) });
  }

  const adjacent = triangles.filter(triangle => [...edgeKeys].every(key => triangle.keys.includes(key)));
  if (adjacent.length !== 2) {
    source.dispose();
    log(adjacent.length < 2
      ? "Edge Bevel needs a closed sharp edge with a surface on both sides."
      : "Edge Bevel cannot edit this non-manifold edge because more than two surfaces meet there.");
    return null;
  }
  if (adjacent[0].normal.dot(adjacent[1].normal) >= .999) {
    source.dispose();
    log("That line is a flat triangulation diagonal, not a visible sharp edge. Choose an outer crease instead.");
    return null;
  }

  const endpoints = [selectedEdge.localA.clone(), selectedEdge.localB.clone()];
  const edgeDirection = endpoints[1].clone().sub(endpoints[0]);
  const edgeLength = edgeDirection.length();
  if (edgeLength <= .00001) {
    source.dispose();
    log("The selected edge is too short to bevel.");
    return null;
  }
  edgeDirection.normalize();

  const sideData = adjacent.map(triangle => edgeBevelRegionData(mesh, triangle, endpoints, edgeDirection));
  if (sideData.some(side => side.boundary.length < 3 || !Number.isFinite(side.maxDepth) || side.maxDepth <= .002)) {
    source.dispose();
    log("Edge Bevel could not trace both complete planar sides of this edge.");
    return null;
  }
  const maximumSafeWidth = Math.min(...sideData.map(side => side.maxDepth)) * .45;
  const usedWidth = Math.min(edgeBevelWidth(), maximumSafeWidth);
  if (!Number.isFinite(usedWidth) || usedWidth < .001) {
    source.dispose();
    log("There is not enough surface beside this edge to create a bevel.");
    return null;
  }

  const cutPointA = endpoints[0].clone().addScaledVector(sideData[0].inward, usedWidth);
  const cutPointB = endpoints[0].clone().addScaledVector(sideData[1].inward, usedWidth);
  const planeNormal = new THREE.Vector3().crossVectors(
    edgeDirection,
    cutPointB.clone().sub(cutPointA)
  ).normalize();
  if (planeNormal.dot(endpoints[0].clone().sub(cutPointA)) < 0) planeNormal.negate();
  const beforeTriangles = position.count / 3;
  const clipped = clipGeometryByLocalPlane(source, planeNormal, cutPointA, { capUAxis: edgeDirection });
  if (clipped.capLoop.length < 3 || !clipped.geometry.getAttribute("position")?.count) {
    clipped.geometry.dispose();
    source.dispose();
    log("Edge Bevel could not create a closed planar cut for this edge.");
    return null;
  }

  const protectedEdges = new Set(mesh.userData.edgeBevelProtectedEdges || []);
  for (let index = 0; index < clipped.capLoop.length; index++) {
    protectedEdges.add(localEdgeSignature(clipped.capLoop[index], clipped.capLoop[(index + 1) % clipped.capLoop.length]));
  }

  recordHistory("bevel selected edge");
  clearMarkers(mesh.userData.id);
  source.dispose();
  replaceEditableMeshGeometry(mesh, clipped.geometry);
  mesh.userData.edgeBevelProtectedEdges = [...protectedEdges];
  mesh.updateMatrixWorld(true);
  clearSelectedSurfaceComponents();
  if (selected !== mesh) selectObject(mesh);
  syncSurfaceEditorUi();
  updateAll();
  log(`Beveled one sharp edge on ${mesh.name} by ${round(usedWidth)}.`, {
    beforeTriangles,
    afterTriangles: clipped.geometry.getAttribute("position").count / 3,
    capVertices: clipped.capLoop.length
  });
  return mesh;
}

function minecraftCornerBevelGeometry(geometry, cornerPoint, requestedPixels = 2) {
  const source = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  const sourcePosition = source.getAttribute("position");
  if (!sourcePosition || sourcePosition.count / 3 !== 12) {
    source.dispose();
    return null;
  }
  source.computeBoundingBox();
  const box = source.boundingBox.clone();
  const size = box.getSize(new THREE.Vector3());
  if (Math.min(size.x, size.y, size.z) <= .00001) {
    source.dispose();
    return null;
  }
  const center = box.getCenter(new THREE.Vector3());
  const sign = new THREE.Vector3(
    cornerPoint.x >= center.x ? 1 : -1,
    cornerPoint.y >= center.y ? 1 : -1,
    cornerPoint.z >= center.z ? 1 : -1
  );
  const pixels = THREE.MathUtils.clamp(Math.round(Number(requestedPixels) || 2), 1, 8);
  const divisions = 16;
  const step = size.clone().multiplyScalar(1 / divisions);
  const occupied = (x, y, z) => {
    if (x < 0 || y < 0 || z < 0 || x >= divisions || y >= divisions || z >= divisions) return false;
    const dx = sign.x > 0 ? divisions - 1 - x : x;
    const dy = sign.y > 0 ? divisions - 1 - y : y;
    const dz = sign.z > 0 ? divisions - 1 - z : z;
    return dx + dy + dz >= pixels;
  };
  const positions = [];
  const uvs = [];
  const faceDefinitions = [
    { delta: [1, 0, 0], axis: "x", corners: [[1,0,0],[1,1,0],[1,1,1],[1,0,1]] },
    { delta: [-1, 0, 0], axis: "x", corners: [[0,0,1],[0,1,1],[0,1,0],[0,0,0]] },
    { delta: [0, 1, 0], axis: "y", corners: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]] },
    { delta: [0, -1, 0], axis: "y", corners: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]] },
    { delta: [0, 0, 1], axis: "z", corners: [[0,0,1],[1,0,1],[1,1,1],[0,1,1]] },
    { delta: [0, 0, -1], axis: "z", corners: [[1,0,0],[0,0,0],[0,1,0],[1,1,0]] }
  ];
  const uvFor = (point, axis) => {
    if (axis === "x") return [(point.z - box.min.z) / size.z, (point.y - box.min.y) / size.y];
    if (axis === "y") return [(point.x - box.min.x) / size.x, (point.z - box.min.z) / size.z];
    return [(point.x - box.min.x) / size.x, (point.y - box.min.y) / size.y];
  };
  const addQuad = (points, axis) => {
    for (const index of [0, 1, 2, 0, 2, 3]) {
      positions.push(...points[index].toArray());
      uvs.push(...uvFor(points[index], axis));
    }
  };
  for (let x = 0; x < divisions; x++) {
    for (let y = 0; y < divisions; y++) {
      for (let z = 0; z < divisions; z++) {
        if (!occupied(x, y, z)) continue;
        for (const face of faceDefinitions) {
          if (occupied(x + face.delta[0], y + face.delta[1], z + face.delta[2])) continue;
          const points = face.corners.map(corner => new THREE.Vector3(
            box.min.x + (x + corner[0]) * step.x,
            box.min.y + (y + corner[1]) * step.y,
            box.min.z + (z + corner[2]) * step.z
          ));
          addQuad(points, face.axis);
        }
      }
    }
  }
  source.dispose();
  const result = new THREE.BufferGeometry();
  result.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  result.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  result.computeVertexNormals();
  result.computeBoundingBox();
  result.computeBoundingSphere();
  return { geometry: result, pixels };
}

function bevelSelectedCorner() {
  if (selectedSurfaceVertices.length !== 1) {
    log("Choose Vertex and select exactly one corner before using Corner Bevel.");
    return null;
  }
  const selectedVertex = selectedSurfaceVertices[0];
  const mesh = selectedVertex.mesh;
  if (!mesh?.geometry) {
    log("The selected corner does not belong to an editable mesh.");
    return null;
  }
  const cornerPoint = selectedVertex.localPoint.clone();
  const mode = els.cornerBevelModeSelect?.value === "minecraft" ? "minecraft" : "standard";
  const beforeTriangles = mesh.geometry.index
    ? mesh.geometry.index.count / 3
    : mesh.geometry.getAttribute("position").count / 3;
  let resultGeometry = null;
  let description = "";

  if (mode === "minecraft") {
    const voxelResult = minecraftCornerBevelGeometry(mesh.geometry, cornerPoint, els.cornerBevelPixelsInput?.value);
    if (!voxelResult) {
      log("Minecraft Corner Bevel currently needs a simple closed cube. Use Standard for custom or OBJ geometry.");
      return null;
    }
    resultGeometry = voxelResult.geometry;
    description = `${voxelResult.pixels} pixel step${voxelResult.pixels === 1 ? "" : "s"} on a 16x16x16 cube`;
  } else {
    const source = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    const position = source.getAttribute("position");
    const cornerKey = vertexKey(cornerPoint);
    const neighbours = new Map();
    for (let index = 0; index < position.count; index += 3) {
      const points = [0, 1, 2].map(offset => new THREE.Vector3(
        position.getX(index + offset), position.getY(index + offset), position.getZ(index + offset)
      ));
      if (!points.some(point => vertexKey(point) === cornerKey)) continue;
      for (const point of points) {
        if (vertexKey(point) !== cornerKey) neighbours.set(vertexKey(point), point);
      }
    }
    const edgeLengths = [...neighbours.values()]
      .map(point => point.distanceTo(cornerPoint))
      .filter(length => length > .00001);
    if (edgeLengths.length < 3) {
      source.dispose();
      log("Corner Bevel needs a closed corner with at least three connected edges.");
      return null;
    }
    source.computeBoundingBox();
    const center = source.boundingBox.getCenter(new THREE.Vector3());
    const outward = cornerPoint.clone().sub(center).normalize();
    if (outward.lengthSq() <= .00001) {
      source.dispose();
      log("Corner Bevel could not determine which side of this corner is outside.");
      return null;
    }
    const requestedWidth = Math.max(.001, Number(els.cornerBevelWidthInput?.value) || .12);
    const usedWidth = Math.min(requestedWidth, Math.min(...edgeLengths) * .65);
    const component = Math.max(Math.abs(outward.x), Math.abs(outward.y), Math.abs(outward.z), .0001);
    const planePoint = cornerPoint.clone().addScaledVector(outward, -usedWidth / component);
    const clipped = clipGeometryByLocalPlane(source, outward, planePoint);
    source.dispose();
    if (clipped.capLoop.length < 3 || !clipped.geometry.getAttribute("position")?.count) {
      clipped.geometry.dispose();
      log("Corner Bevel could not create a closed cut at this corner.");
      return null;
    }
    resultGeometry = clipped.geometry;
    description = `width ${round(usedWidth)}`;
  }

  recordHistory(`bevel selected corner (${mode})`);
  clearMarkers(mesh.userData.id);
  replaceEditableMeshGeometry(mesh, resultGeometry);
  mesh.updateMatrixWorld(true);
  clearSelectedSurfaceComponents();
  if (selected !== mesh) selectObject(mesh);
  syncSurfaceEditorUi();
  updateAll();
  log(`Beveled one corner on ${mesh.name} using ${mode} mode (${description}).`, {
    beforeTriangles,
    afterTriangles: resultGeometry.getAttribute("position").count / 3,
    mode
  });
  return mesh;
}

function bevelSelectedFace() {
  if (!selectedFace?.mesh) {
    log("Pick a face first, then press Bevel Face.");
    return;
  }
  const size = Math.max(.03, Math.min(1, +els.bevelSizeInput.value || .16));
  const depth = Math.max(.03, Math.min(1, +els.bevelDepthInput.value || .18));
  const type = els.bevelTypeSelect.value;
  const { mesh } = selectedFace;
  recordHistory("bevel face");
  const results = [];
  if (type === "outer" || type === "both") results.push(createBevelFacePatch(selectedFace, "outer", size, depth));
  if (type === "inner" || type === "both") results.push(createBevelFacePatch(selectedFace, "inner", size, depth));
  clearSelectedTriangles();
  setFacePickMode(false);
  updateAll();
  log(`Added ${type} bevel to ${mesh.name}.`, results.length === 1 ? serializeObject(results[0]) : { created: results.length });
}

function cutSelectedMesh() {
  if (!selected) {
    log("Select one mesh before cutting.");
    return;
  }
  const side = els.cutSideSelect.value === "bottom" ? "bottom" : "top";
  const amount = (els.cutAmountInput.value || "").trim();
  if (!amount) {
    log("Enter a cut amount first, for example 50% or 0.25.");
    return;
  }
  recordHistory("cut mesh");
  const source = selected.geometry.index ? selected.geometry.toNonIndexed() : selected.geometry.clone();
  const clipped = clipGeometrySide(source, side, amount);
  source.dispose();
  selected.geometry.dispose();
  selected.geometry = clipped;
  selected.userData.shape = "custom";
  selected.userData.geometry = geometryToData(clipped);
  selected.userData.bevel = null;
  selected.userData.depth = null;
  selected.userData.direction = null;
  selected.userData.cuts = null;
  clearSelectedTriangles();
  clearMarkers(selected.userData.id);
  updateTransformAttachment();
  updateAll();
  log(`Cut ${side} of ${selected.name} by ${amount}.`, serializeObject(selected));
}

function groupCheckedParts() {
  const groupObjects = selectionTargetsForGrouping();
  if (groupObjects.length < 2) {
    log("Select or check two or more parts before grouping.");
    return;
  }
  recordHistory("group parts");
  const selectedGroupIds = selectedHierarchyGroupIds(groupObjects);
  const groupedMeshIds = new Set(
    selectedGroupIds.flatMap(groupId => descendantMeshesForGroup(groupId).map(mesh => mesh.userData.id))
  );
  const looseMeshes = groupObjects.filter(mesh => !groupedMeshIds.has(mesh.userData.id));
  if (selectedGroupIds.length === 1 && !looseMeshes.length) {
    log(`Selection is already the group ${groupRecord(selectedGroupIds[0])?.name || "Group"}. Select another group or extra meshes to build a parent hierarchy.`);
    return;
  }
  const parentId = commonGroupParentId([
    ...selectedGroupIds.map(groupId => groupRecord(groupId)?.parentId || null),
    ...looseMeshes.map(mesh => groupRecord(mesh.userData.groupId)?.parentId || null)
  ]);
  const baseName = groupObjects.every(mesh => normalizeGroupName(mesh.name) === normalizeGroupName(groupObjects[0].name))
    ? normalizeGroupName(groupObjects[0].name)
    : (selectedGroupIds.length === 1 && !looseMeshes.length
      ? groupRecord(selectedGroupIds[0])?.name || "Group"
      : "Group");
  const record = createSceneGroupRecord({
    name: uniqueSceneGroupName(baseName),
    parentId
  });
  for (const childGroupId of selectedGroupIds) {
    const childRecord = groupRecord(childGroupId);
    if (childRecord) childRecord.parentId = record.id;
  }
  for (const mesh of looseMeshes) {
    mesh.userData.groupId = record.id;
    mesh.userData.groupName = record.name;
  }
  ensureSceneGroups();
  ensureModelGroups();
  selectGroupRecord(record.id);
  syncGroupPivotToObjects(descendantMeshesForGroup(record.id), { forceCenter: false });
  updateTransformAttachment();
  log(`Grouped ${groupObjects.length} parts into ${record.name}.`, {
    groupId: record.id,
    parent: groupRecord(parentId)?.name || "Root",
    childGroups: selectedGroupIds.map(groupId => groupRecord(groupId)?.name || groupId),
    directMeshes: looseMeshes.map(mesh => mesh.name)
  });
}

function mergeSelectionTargets() {
  return resolveSelectionTargets("multiple");
}

function sharedMergeTextureState(meshes) {
  if (!meshes.length) return null;
  const textured = meshes.filter(mesh => !!mesh.userData.textureUrl);
  if (!textured.length || textured.length !== meshes.length) return null;
  const first = textured[0];
  const firstUrl = first.userData.textureUrl || null;
  const firstName = first.userData.textureName || null;
  const firstFlipY = first.userData.textureFlipY ?? true;
  const firstRotation = normalizeTextureRotation(first.userData.textureRotation || 0);
  const firstRobloxId = normalizeRobloxAssetId(first.userData.textureRobloxAssetId || "");
  const firstColor = `#${primaryMeshMaterial(first)?.color?.getHexString?.() || "ffffff"}`.toLowerCase();
  const firstOpacity = Math.max(.05, Math.min(1, Number(first.userData.opacity ?? primaryMeshMaterial(first)?.opacity ?? 1) || 1));
  const allTexturedMatch = textured.every(mesh =>
    (mesh.userData.textureUrl || null) === firstUrl
    && (mesh.userData.textureName || null) === firstName
    && (mesh.userData.textureFlipY ?? true) === firstFlipY
    && normalizeTextureRotation(mesh.userData.textureRotation || 0) === firstRotation
    && normalizeRobloxAssetId(mesh.userData.textureRobloxAssetId || "") === firstRobloxId
    && `#${primaryMeshMaterial(mesh)?.color?.getHexString?.() || "ffffff"}`.toLowerCase() === firstColor
    && Math.max(.05, Math.min(1, Number(mesh.userData.opacity ?? primaryMeshMaterial(mesh)?.opacity ?? 1) || 1)) === firstOpacity
  );
  return allTexturedMatch ? {
    textureUrl: firstUrl,
    textureName: firstName,
    textureFlipY: firstFlipY,
    textureRotation: firstRotation,
    textureRobloxAssetId: firstRobloxId,
    color: firstColor,
    opacity: firstOpacity
  } : null;
}

function mergeSourceMaterialColor(mesh) {
  return `#${primaryMeshMaterial(mesh)?.color?.getHexString?.() || "ffffff"}`.toLowerCase();
}

function mergeSurfaceDescriptor(mesh) {
  const textureUrl = mesh.userData.textureUrl || null;
  const color = mergeSourceMaterialColor(mesh);
  const opacity = Math.max(.05, Math.min(1, Number(mesh.userData.opacity ?? primaryMeshMaterial(mesh)?.opacity ?? 1) || 1));
  const textureFlipY = mesh.userData.textureFlipY ?? true;
  const textureRotation = normalizeTextureRotation(mesh.userData.textureRotation || 0);
  return {
    key: textureUrl
      ? JSON.stringify(["texture", textureUrl, color, opacity, textureFlipY, textureRotation])
      : JSON.stringify(["color", color, opacity]),
    textureUrl,
    color,
    opacity,
    textureFlipY,
    textureRotation,
    image: null,
    index: -1
  };
}

function loadMergeTextureImage(textureUrl, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    let finished = false;
    const done = (error = null) => {
      if (finished) return;
      finished = true;
      if (error) reject(error);
      else resolve(image);
    };
    image.onload = () => done();
    image.onerror = () => done(new Error("A source texture could not be loaded for the merged material atlas."));
    image.src = textureUrl;
    setTimeout(() => done(new Error("Timed out while loading a source texture for the merged material atlas.")), timeoutMs);
  });
}

function transformedMergeUv([sourceU, sourceV], surface) {
  let u = Number(sourceU) || 0;
  let v = Number(sourceV) || 0;
  const angle = THREE.MathUtils.degToRad(surface.textureRotation || 0);
  if (angle) {
    const x = u - .5;
    const y = v - .5;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    u = cosine * x + sine * y + .5;
    v = -sine * x + cosine * y + .5;
  }
  if (!surface.textureFlipY) v = 1 - v;
  return [Math.min(1, Math.max(0, u)), Math.min(1, Math.max(0, v))];
}

async function createMergedMaterialAtlas(meshes, name = "Merged Mesh") {
  const surfaces = [];
  const surfaceByKey = new Map();
  const surfaceByMeshId = new Map();
  for (const mesh of meshes) {
    const descriptor = mergeSurfaceDescriptor(mesh);
    let surface = surfaceByKey.get(descriptor.key);
    if (!surface) {
      descriptor.index = surfaces.length;
      surface = descriptor;
      surfaceByKey.set(descriptor.key, surface);
      surfaces.push(surface);
    }
    surfaceByMeshId.set(mesh.userData.id, surface);
  }
  if (!surfaces.length) return null;

  let failedTextureCount = 0;
  await Promise.all(surfaces.map(async surface => {
    if (!surface.textureUrl) return;
    try {
      surface.image = await loadMergeTextureImage(surface.textureUrl);
    } catch {
      failedTextureCount++;
      surface.image = null;
    }
  }));

  const columns = Math.ceil(Math.sqrt(surfaces.length));
  const rows = Math.ceil(surfaces.length / columns);
  const largestSource = Math.max(32, ...surfaces.map(surface => Math.max(
    Number(surface.image?.naturalWidth || surface.image?.width || 0),
    Number(surface.image?.naturalHeight || surface.image?.height || 0)
  )));
  const atlasDimensionLimit = surfaces.length > 16 ? 1536 : 2048;
  const maxCellSize = Math.floor(atlasDimensionLimit / Math.max(columns, rows));
  const cellSize = Math.max(32, Math.min(512, largestSource, maxCellSize));
  const downscaledTextureCount = surfaces.filter(surface => surface.image && Math.max(
    Number(surface.image.naturalWidth || surface.image.width || 0),
    Number(surface.image.naturalHeight || surface.image.height || 0)
  ) > cellSize).length;
  const padding = Math.max(2, Math.min(8, Math.floor(cellSize * .02)));
  const canvas = document.createElement("canvas");
  canvas.width = columns * cellSize;
  canvas.height = rows * cellSize;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  surfaces.forEach(surface => {
    const column = surface.index % columns;
    const row = Math.floor(surface.index / columns);
    const x = column * cellSize;
    const y = row * cellSize;
    context.save();
    context.beginPath();
    context.rect(x, y, cellSize, cellSize);
    context.clip();
    context.clearRect(x, y, cellSize, cellSize);
    context.globalCompositeOperation = "source-over";
    if (!surface.image) {
      context.globalAlpha = surface.opacity;
      context.fillStyle = surface.color;
      context.fillRect(x, y, cellSize, cellSize);
      context.restore();
      return;
    }
    context.drawImage(surface.image, x, y, cellSize, cellSize);
    if (surface.color !== "#ffffff") {
      context.globalCompositeOperation = "multiply";
      context.fillStyle = surface.color;
      context.fillRect(x, y, cellSize, cellSize);
      context.globalCompositeOperation = "destination-in";
      context.globalAlpha = surface.opacity;
      context.drawImage(surface.image, x, y, cellSize, cellSize);
    } else if (surface.opacity < .999) {
      context.globalCompositeOperation = "destination-in";
      context.globalAlpha = surface.opacity;
      context.drawImage(surface.image, x, y, cellSize, cellSize);
    }
    context.restore();
  });

  const mapUv = (mesh, sourceUv = [.5, .5]) => {
    const surface = surfaceByMeshId.get(mesh?.userData?.id) || surfaces[0];
    const column = surface.index % columns;
    const row = Math.floor(surface.index / columns);
    if (!surface.textureUrl) {
      return [
        round((column * cellSize + cellSize / 2) / canvas.width, 6),
        round(1 - (row * cellSize + cellSize / 2) / canvas.height, 6)
      ];
    }
    const [u, v] = transformedMergeUv(sourceUv, surface);
    const innerSize = cellSize - padding * 2;
    const pixelX = column * cellSize + padding + u * innerSize;
    const pixelY = row * cellSize + padding + (1 - v) * innerSize;
    return [round(pixelX / canvas.width, 6), round(1 - pixelY / canvas.height, 6)];
  };

  const textureUrl = canvas.toDataURL("image/png");
  const encodedPayload = textureUrl.slice(textureUrl.indexOf(",") + 1);
  const approximateByteSize = Math.ceil(encodedPayload.length * .75);
  return {
    textureUrl,
    textureName: `${name} Material Atlas`,
    textureFlipY: true,
    textureRotation: 0,
    textureRobloxAssetId: "",
    mapUv,
    surfaceCount: surfaces.length,
    textureCount: surfaces.filter(surface => !!surface.textureUrl).length,
    failedTextureCount,
    downscaledTextureCount,
    hasTransparency: surfaces.some(surface => surface.opacity < .999),
    approximateByteSize,
    dimensionLimit: atlasDimensionLimit,
    width: canvas.width,
    height: canvas.height
  };
}

function mergedMeshProjectionAxes(box) {
  const size = box.getSize(new THREE.Vector3());
  const spans = [
    { key: "x", size: Math.max(size.x, .001) },
    { key: "y", size: Math.max(size.y, .001) },
    { key: "z", size: Math.max(size.z, .001) }
  ].sort((a, b) => b.size - a.size);
  return [spans[0].key, spans[1].key];
}

function vectorComponentByAxis(vector, axis) {
  return axis === "x" ? vector.x : axis === "y" ? vector.y : vector.z;
}

function fallbackMergedUv(point, box, axes) {
  const min = box.min;
  const max = box.max;
  const spanU = Math.max(vectorComponentByAxis(max, axes[0]) - vectorComponentByAxis(min, axes[0]), .001);
  const spanV = Math.max(vectorComponentByAxis(max, axes[1]) - vectorComponentByAxis(min, axes[1]), .001);
  const u = (vectorComponentByAxis(point, axes[0]) - vectorComponentByAxis(min, axes[0])) / spanU;
  const v = (vectorComponentByAxis(point, axes[1]) - vectorComponentByAxis(min, axes[1])) / spanV;
  return [
    round(Math.min(1, Math.max(0, u)), 4),
    round(Math.min(1, Math.max(0, v)), 4)
  ];
}

async function mergedMeshSpec(meshes, { name = "Merged Mesh", groupId = null, groupName = null } = {}) {
  if (!meshes.length) return null;
  let positions = [];
  let normals = [];
  const textureState = sharedMergeTextureState(meshes);
  const materialAtlas = textureState ? null : await createMergedMaterialAtlas(meshes, name);
  let vertexUvs = [];
  let hasAnyNormals = false;
  let hasAnyUvs = !!(textureState || materialAtlas);

  for (const mesh of meshes) {
    mesh.updateMatrixWorld(true);
    const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    const position = geometry.getAttribute("position");
    const normal = geometry.getAttribute("normal");
    const uv = geometry.getAttribute("uv");
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);

    for (let index = 0; index < position.count; index++) {
      const point = new THREE.Vector3(
        position.getX(index),
        position.getY(index),
        position.getZ(index)
      ).applyMatrix4(mesh.matrixWorld);
      positions.push(point.x, point.y, point.z);

      if (normal) {
        const worldNormal = new THREE.Vector3(
          normal.getX(index),
          normal.getY(index),
          normal.getZ(index)
        ).applyMatrix3(normalMatrix).normalize();
        normals.push(worldNormal.x, worldNormal.y, worldNormal.z);
        hasAnyNormals = true;
      } else {
        normals.push(0, 0, 0);
      }

      if (hasAnyUvs) {
        if (materialAtlas) {
          vertexUvs.push({
            mesh,
            uv: uv ? [round(uv.getX(index), 6), round(uv.getY(index), 6)] : null
          });
        } else if (textureState) {
          if (uv) {
            vertexUvs.push([round(uv.getX(index), 4), round(uv.getY(index), 4)]);
          } else {
            vertexUvs.push(null);
          }
        } else {
          hasAnyUvs = false;
        }
      }
    }
    geometry.dispose();
  }

  if (positions.length < 9) return null;

  const worldPoints = [];
  for (let index = 0; index < positions.length; index += 3) {
    worldPoints.push(new THREE.Vector3(positions[index], positions[index + 1], positions[index + 2]));
  }
  const box = new THREE.Box3().setFromPoints(worldPoints);
  const center = box.getCenter(new THREE.Vector3());
  const localPositions = [];
  const uvs = [];
  const projectionAxes = hasAnyUvs ? mergedMeshProjectionAxes(box) : null;
  for (const point of worldPoints) {
    const local = point.clone().sub(center);
    localPositions.push(round(local.x), round(local.y), round(local.z));
  }
  if (hasAnyUvs) {
    for (let index = 0; index < worldPoints.length; index++) {
      const explicitUv = vertexUvs[index];
      if (materialAtlas) {
        const sourceUv = explicitUv?.uv || fallbackMergedUv(worldPoints[index], box, projectionAxes);
        const mapped = materialAtlas.mapUv(explicitUv?.mesh, sourceUv);
        uvs.push(mapped[0], mapped[1]);
      } else if (explicitUv) {
        uvs.push(explicitUv[0], explicitUv[1]);
      } else {
        const generated = fallbackMergedUv(worldPoints[index], box, projectionAxes);
        uvs.push(generated[0], generated[1]);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(localPositions, 3));
  if (hasAnyNormals && normals.length === localPositions.length) {
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals.map(round), 3));
  }
  if (hasAnyUvs && uvs.length * 3 === (localPositions.length * 2)) {
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs.map(round), 2));
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const geometryData = geometryToData(geometry);
  geometry.dispose();

  const sameRule = meshes.every(mesh => normalizeMaterialRule(mesh.userData.materialRule || "auto") === normalizeMaterialRule(meshes[0].userData.materialRule || "auto"))
    ? normalizeMaterialRule(meshes[0].userData.materialRule || "auto")
    : "auto";

  return {
    shape: "custom",
    geometry: geometryData,
    name,
    position: center.toArray().map(round),
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    color: materialAtlas ? "#ffffff" : (textureState?.color || mergeSourceMaterialColor(meshes[0])),
    opacity: materialAtlas ? 1 : (textureState?.opacity ?? Math.max(.05, Math.min(1, Number(meshes[0].userData.opacity ?? primaryMeshMaterial(meshes[0])?.opacity ?? 1) || 1))),
    roughness: round(meshes.reduce((sum, mesh) => sum + Number(primaryMeshMaterial(mesh)?.roughness || 0), 0) / meshes.length),
    textureUrl: textureState?.textureUrl || materialAtlas?.textureUrl || null,
    textureName: textureState?.textureName || materialAtlas?.textureName || null,
    textureFlipY: textureState?.textureFlipY ?? materialAtlas?.textureFlipY ?? true,
    textureRotation: textureState?.textureRotation ?? materialAtlas?.textureRotation ?? 0,
    textureRobloxAssetId: textureState?.textureRobloxAssetId || materialAtlas?.textureRobloxAssetId || "",
    textureHasTransparency: !!materialAtlas?.hasTransparency,
    generatedMaterialAtlas: !!materialAtlas,
    mergedMaterialCount: materialAtlas?.surfaceCount || 0,
    mergedTextureCount: materialAtlas?.textureCount || 0,
    failedMergedTextureCount: materialAtlas?.failedTextureCount || 0,
    downscaledMergedTextureCount: materialAtlas?.downscaledTextureCount || 0,
    materialAtlasByteSize: materialAtlas?.approximateByteSize || 0,
    materialAtlasDimensionLimit: materialAtlas?.dimensionLimit || 0,
    materialAtlasSize: materialAtlas ? [materialAtlas.width, materialAtlas.height] : null,
    materialRule: sameRule,
    groupId,
    groupName,
    hidden: false,
    linkId: null,
    linkColor: null
  };
}

async function mergeCheckedMeshes() {
  const targetMeshes = [...new Set(mergeSelectionTargets().filter(Boolean))];
  if (targetMeshes.length < 2) {
    log("Check or select two or more meshes or group contents before merging.");
    return null;
  }

  const selectedGroupIds = selectedHierarchyGroupIds(targetMeshes);
  const groupedMeshIds = new Set(
    selectedGroupIds.flatMap(groupId => descendantMeshesForGroup(groupId).map(mesh => mesh.userData.id))
  );
  const looseMeshes = targetMeshes.filter(mesh => !groupedMeshIds.has(mesh.userData.id));
  const parentId = commonGroupParentId([
    ...selectedGroupIds.map(groupId => groupRecord(groupId)?.parentId || null),
    ...looseMeshes.map(mesh => mesh.userData.groupId || null)
  ]);
  const parentRecord = groupRecord(parentId);
  const mergedName = selectedGroupIds.length === 1 && !looseMeshes.length
    ? `${groupRecord(selectedGroupIds[0])?.name || "Group"} merged`
    : (targetMeshes.every(mesh => normalizeGroupName(mesh.name) === normalizeGroupName(targetMeshes[0].name))
      ? `${normalizeGroupName(targetMeshes[0].name)} merged`
      : "Merged Mesh");
  let spec = null;
  const mergeButtonLabel = els.mergeMeshBtn?.textContent || "Merge Mesh";
  if (els.mergeMeshBtn) {
    els.mergeMeshBtn.disabled = true;
    els.mergeMeshBtn.textContent = `Merging ${targetMeshes.length}...`;
    els.mergeMeshBtn.setAttribute("aria-busy", "true");
  }
  log(`Merging ${targetMeshes.length} meshes. Large textured groups can take a moment...`, {
    sourceMeshes: targetMeshes.map(mesh => mesh.name)
  });
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  try {
    spec = await mergedMeshSpec(targetMeshes, {
      name: mergedName,
      groupId: parentId,
      groupName: parentRecord?.name || null
    });
  } catch (error) {
    log("Could not merge the selected meshes.", error?.message || error);
    return null;
  } finally {
    if (els.mergeMeshBtn) {
      els.mergeMeshBtn.disabled = false;
      els.mergeMeshBtn.textContent = mergeButtonLabel;
      els.mergeMeshBtn.removeAttribute("aria-busy");
    }
  }

  if (!spec) {
    log("Could not merge those meshes into a valid mesh.");
    return null;
  }

  const keptTexture = !!spec.textureUrl;
  const generatedMaterialAtlas = !!spec.generatedMaterialAtlas;
  const mergedMaterialCount = Number(spec.mergedMaterialCount) || 0;
  const mergedTextureCount = Number(spec.mergedTextureCount) || 0;
  const failedMergedTextureCount = Number(spec.failedMergedTextureCount) || 0;
  const downscaledMergedTextureCount = Number(spec.downscaledMergedTextureCount) || 0;
  const materialAtlasByteSize = Number(spec.materialAtlasByteSize) || 0;
  const materialAtlasDimensionLimit = Number(spec.materialAtlasDimensionLimit) || 0;
  const materialAtlasSize = Array.isArray(spec.materialAtlasSize) ? [...spec.materialAtlasSize] : null;
  delete spec.generatedMaterialAtlas;
  delete spec.mergedMaterialCount;
  delete spec.mergedTextureCount;
  delete spec.failedMergedTextureCount;
  delete spec.downscaledMergedTextureCount;
  delete spec.materialAtlasByteSize;
  delete spec.materialAtlasDimensionLimit;
  delete spec.materialAtlasSize;
  recordHistory("merge mesh");
  if (generatedMaterialAtlas && spec.textureUrl && spec.textureName) {
    spec.textureName = registerTextureAsset(spec.textureName, spec.textureUrl, { replace: false }) || spec.textureName;
  }
  selectedGroupRecordId = null;
  activeGroupIds = [];
  checkedIds.clear();
  currentTransformTargetKey = "";
  clearSelectedTriangles();
  clearLineSketch({ silent: true, keepMode: false });

  for (const mesh of [...targetMeshes]) removeObject(mesh, { record: false });

  cleanupEmptySceneGroups();
  ensureSceneGroups();
  ensureModelGroups();

  const merged = addObject(spec, { record: false, select: true, update: false });
  ensureSceneGroups();
  ensureModelGroups();
  checkedIds = new Set([merged.userData.id]);
  activeGroupIds = [];
  currentTransformTargetKey = "";
  updateTransformAttachment();
  updateAll();
  log(`Merged ${targetMeshes.length} meshes into ${merged.name}.`, {
    keptTexture,
    generatedMaterialAtlas,
    mergedMaterialCount,
    mergedTextureCount,
    failedMergedTextureCount,
    downscaledMergedTextureCount,
    materialAtlasApproximateMegabytes: round(materialAtlasByteSize / (1024 * 1024), 2),
    materialAtlasDimensionLimit,
    materialAtlasSize,
    sourceMeshes: targetMeshes.map(mesh => mesh.name),
    parent: parentRecord?.name || "Root"
  });
  return merged;
}

function ungroupParts() {
  if (selectedGroupRecordId && groupRecord(selectedGroupRecordId)) {
    recordHistory("split group");
    splitGroupRecord(selectedGroupRecordId);
    return;
  }
  const groupObjects = selectionTargetsForGrouping();
  if (groupObjects.length) {
    const hierarchyGroupIds = selectedHierarchyGroupIds(groupObjects).filter(groupId => !!groupRecord(groupId));
    if (hierarchyGroupIds.length) {
      recordHistory(hierarchyGroupIds.length === 1 ? "split group" : "split groups");
      for (const groupId of hierarchyGroupIds) splitGroupRecord(groupId);
      return;
    }
  }
  const candidateIds = [];
  if (groupObjects.length) {
    const directGroupIds = [...new Set(groupObjects.map(mesh => mesh.userData.groupId).filter(Boolean))];
    if (directGroupIds.length === 1) candidateIds.push(directGroupIds[0]);
  }
  const groupId = candidateIds.find(id => !!groupRecord(id));
  if (groupId) {
    recordHistory("ungroup parts");
    dissolveGroupRecord(groupId);
    return;
  }
  activeGroupIds = [];
  selectedGroupRecordId = null;
  setPivotEditMode(false, { silent: true });
  currentTransformTargetKey = "";
  updateTransformAttachment();
  syncInspector();
  renderTree();
  updateState();
  log("Temporary group selection cleared.");
}

function applyGroupPivotDelta() {
  const groupObjects = pivotManagedObjects();
  if (!groupObjects.length) return;
  groupPivot.updateMatrixWorld(true);
  const delta = groupPivot.matrixWorld.clone().multiply(lastGroupMatrix.clone().invert());
  for (const mesh of groupObjects) mesh.applyMatrix4(delta);
  if (scaleDragState?.type === "group" && scaleDragState.key === transformTargetKey(groupObjects)) {
    const currentScale = groupPivot.scale.clone();
    if (isShiftHeld) {
      const offset = oneSidedScaleOffset(
        scaleDragState.boundsSize,
        currentScale,
        scaleDragState.prevScale,
        worldAxisDirections(groupPivot),
        scaleDragState.signMap
      );
      if (offset.lengthSq() > 0) {
        for (const mesh of groupObjects) mesh.position.add(offset);
        groupPivot.position.add(offset);
        groupPivot.updateMatrixWorld(true);
      }
    }
    scaleDragState.prevScale.copy(currentScale);
  }
  lastGroupMatrix.copy(groupPivot.matrixWorld);
  setStoredPivotForObjects(groupObjects, groupPivot.position);
}

function removeObject(mesh, { record = true, update = true } = {}) {
  if (!mesh) return;
  if (record) recordHistory("delete");
  const previousLinkId = mesh.userData.linkId || null;
  const previousSceneGroupId = mesh.userData.groupId || null;
  const index = objects.indexOf(mesh);
  if (index >= 0) objects.splice(index, 1);
  checkedIds.delete(mesh.userData.id);
  activeGroupIds = activeGroupIds.filter(id => id !== mesh.userData.id);
  currentTransformTargetKey = "";
  clearMarkers(mesh.userData.id);
  if (selectedFace?.mesh === mesh) {
    clearSelectedTriangles();
  }
  scene.remove(mesh);
  mesh.geometry.dispose();
  mesh.material.dispose();
  if (selected === mesh) selectObject(null);
  if (previousLinkId) ensureLinkGroupColors();
  if (previousSceneGroupId) ensureSceneGroups();
  if (update) updateAll();
}

function duplicateSelected() {
  const transformTargets = transformTargetObjects();
  const targets = transformTargets.length > 1
    ? transformTargets
    : (selected ? [selected] : checkedObjects().slice(0, 1));
  if (!targets.length) {
    log("Select one or more objects before duplicating.");
    return [];
  }
  recordHistory(targets.length === 1 ? "duplicate object" : "duplicate objects");
  const copies = targets.map(source => {
    const data = serializeObject(source);
    delete data.id;
    data.name = `${source.name} copy`;
    data.linkId = null;
    data.linkColor = null;
    return addObject(data, { record: false, select: false, update: false });
  });
  checkedIds.clear();
  activeGroupIds = copies.map(copy => copy.userData.id);
  selectedGroupRecordId = null;
  selected = copies.at(-1) || null;
  currentTransformTargetKey = "";
  updateAll();
  log(`Duplicated ${copies.length} object${copies.length === 1 ? "" : "s"} in place.`);
  return copies;
}

function clearObjects({ record = true } = {}) {
  if (record && objects.length) recordHistory("clear");
  clearKnifeCutGuide({ keepMode: false });
  [...objects].forEach(mesh => removeObject(mesh, { record: false }));
  sceneGroupRegistry.clear();
  checkedIds.clear();
  activeGroupIds = [];
  selectedGroupRecordId = null;
  currentTransformTargetKey = "";
  pivotEditMode = false;
  els.pivotBtn.classList.remove("active");
  setDragPushMode(false, { silent: true });
  clearSelectedTriangles();
  setOpeningPickMode(false);
  clearSelectedHoleLoop();
  clearMarkers();
  clearLineSketch({ silent: true, keepMode: false });
  selectObject(null);
  refreshTextureLibraryUi();
  updateAll();
}
