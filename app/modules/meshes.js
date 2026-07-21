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
    els.meshDetailsTexturePreview.innerHTML = `<img src="${mesh.userData.textureUrl}" alt="${safeName} preview" /><div class="api-note">${safeName}</div>`;
  } else {
    els.meshDetailsTexturePreview.innerHTML = `<div class="api-note">No texture assigned to this mesh yet.</div>`;
  }
}

function openMeshDetails(meshId) {
  const mesh = findObject(meshId);
  if (!mesh) return;
  meshDetailsState.meshId = mesh.userData.id;
  refreshMeshDetails();
  els.meshDetailsModal.classList.add("open");
  els.meshDetailsModal.setAttribute("aria-hidden", "false");
  els.meshDetailsNameInput.focus();
  els.meshDetailsNameInput.select();
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
    transparent: false,
    opacity: 1,
    wireframe: false,
    depthWrite: true
  });
  if (textureUrl) {
    const texture = new THREE.TextureLoader().load(textureUrl);
    applyTextureTransform(texture, { textureFlipY, textureRotation });
    material.map = texture;
    material.needsUpdate = true;
  }
  return material;
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
    const texture = new THREE.TextureLoader().load(textureUrl, loadedTexture => {
      maybeApplyTextureDisplayColor(mesh, loadedTexture.image);
      renderTree();
      syncInspectorSoft();
      updateState();
    });
    applyTextureTransform(texture, { textureFlipY, textureRotation });
    mesh.material.map = texture;
  } else {
    delete mesh.userData.textureDisplayColor;
  }
  mesh.material.needsUpdate = true;
  mesh.userData.textureUrl = textureUrl || null;
  mesh.userData.textureName = textureUrl ? textureName : null;
  const libraryEntry = textureUrl ? textureLibraryEntryForTexture(textureUrl, textureName) : null;
  mesh.userData.textureRobloxAssetId = textureUrl
    ? normalizeRobloxAssetId(libraryEntry?.robloxAssetId || mesh.userData.textureRobloxAssetId || "")
    : "";
  mesh.userData.textureFlipY = textureUrl ? textureFlipY : true;
  mesh.userData.textureRotation = textureUrl ? normalizeTextureRotation(textureRotation) : 0;
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
  return selectedTriangles.length ? selectedTriangles : uvTrianglesForMesh(mesh);
}

function textureEditorCursor(tool = "brush") {
  const svg = tool === "hammer"
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path fill="#f4f7fb" stroke="#11181d" stroke-width="1.8" d="M8 7h9l3 3-3 3H13l6 10-3 2-7-11z"/><rect x="5.5" y="5.5" width="11" height="5" rx="1.5" fill="#ffb84d" stroke="#11181d" stroke-width="1.5"/></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="12" cy="12" r="5.5" fill="none" stroke="#f4f7fb" stroke-width="2"/><path d="M16.5 16.5L24 24" stroke="#11181d" stroke-width="4" stroke-linecap="round"/><path d="M16.5 16.5L24 24" stroke="#7dd3fc" stroke-width="2.2" stroke-linecap="round"/></svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") 6 6, ${tool === "hammer" ? "cell" : "crosshair"}`;
}

function syncTextureEditorCursor() {
  if (!els.textureEditorCanvas) return;
  const tool = textureEditorState.tool || els.textureEditorTool?.value || "brush";
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
  return textureEditorState.sourceCanvas;
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
  const rect = canvas.getBoundingClientRect();
  const localX = (event.clientX - rect.left) * (canvas.width / Math.max(1, rect.width));
  const localY = (event.clientY - rect.top) * (canvas.height / Math.max(1, rect.height));
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
  const source = currentTextureEditorCanvas();
  const canvas = els.textureEditorCanvas;
  if (!mesh || !source || !canvas) return;
  const stage = canvas.parentElement.getBoundingClientRect();
  canvas.width = Math.max(320, Math.floor(stage.width));
  canvas.height = Math.max(240, Math.floor(stage.height));
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  const drawRect = fitTextureRect(source.width, source.height, canvas.width, canvas.height);
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

  if (textureEditorState.hoverPoint) {
    const hoverX = drawRect.left + (textureEditorState.hoverPoint.x / source.width) * drawRect.width;
    const hoverY = drawRect.top + (textureEditorState.hoverPoint.y / source.height) * drawRect.height;
    if ((textureEditorState.tool || "brush") === "hammer") {
      const radius = Math.max(4, Math.min(512, Number(els.textureEditorHammerRadius.value) || 48));
      const previewRadius = (radius / source.width) * drawRect.width;
      context.save();
      context.strokeStyle = "rgba(255, 184, 77, 0.95)";
      context.lineWidth = 2;
      context.setLineDash([6, 5]);
      context.beginPath();
      context.arc(hoverX, hoverY, previewRadius, 0, Math.PI * 2);
      context.stroke();
      context.restore();
    } else {
      const size = Math.max(1, Number(els.textureEditorBrushSize.value) || 12);
      const previewRadius = Math.max(2, (size / source.width) * drawRect.width * 0.5);
      context.save();
      context.strokeStyle = "rgba(125, 211, 252, 0.95)";
      context.lineWidth = 1.6;
      context.beginPath();
      context.arc(hoverX, hoverY, previewRadius, 0, Math.PI * 2);
      context.stroke();
      context.restore();
    }
  }

  els.textureEditorInfo.textContent = selectedTriangles.length
    ? `${onlySelected ? "Isolating" : "Showing"} ${selectedTriangles.length} selected triangle${selectedTriangles.length === 1 ? "" : "s"} on ${mesh.name}.`
    : `No triangles selected on ${mesh.name} yet, so tools affect the visible UV area.`;
}

function textureEditorStrokeTo(point) {
  const source = currentTextureEditorCanvas();
  if (!source || !point) return;
  const context = source.getContext("2d");
  context.strokeStyle = els.textureEditorColor.value || "#ff7f50";
  context.lineWidth = Math.max(1, Number(els.textureEditorBrushSize.value) || 12);
  context.lineCap = "round";
  context.lineJoin = "round";
  const from = textureEditorState.lastPoint || point;
  context.beginPath();
  context.moveTo(from.x, from.y);
  context.lineTo(point.x, point.y);
  context.stroke();
  textureEditorState.lastPoint = point;
  renderTextureEditor();
}

function applyGlassBreakEffect(point) {
  const mesh = textureEditorMesh();
  const source = currentTextureEditorCanvas();
  if (!mesh || !source || !point) return;
  const maskTriangles = textureEditorMaskTriangles(mesh);
  const context = source.getContext("2d", { willReadFrequently: true });
  const radius = Math.max(4, Math.min(512, Number(els.textureEditorHammerRadius.value) || 48));
  const hitCount = 1 + Math.floor(Math.random() * 2);
  context.save();
  textureEditorTrianglesPath(context, maskTriangles, source.width, source.height);
  context.clip();
  for (let hit = 0; hit < hitCount; hit++) {
    const centerX = point.x + (Math.random() - .5) * radius * 0.18;
    const centerY = point.y + (Math.random() - .5) * radius * 0.18;
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
  context.restore();
  renderTextureEditor();
}

async function openTextureEditor() {
  const mesh = selectedTextureEditorMesh();
  if (!mesh) {
    log("Select one textured mesh with UVs before opening the texture editor.");
    return;
  }
  try {
    const image = mesh.material.map?.image || await loadImage(mesh.userData.textureUrl);
    textureEditorState.meshId = mesh.userData.id;
    textureEditorState.textureName = mesh.userData.textureName || "Texture";
    textureEditorState.sourceCanvas = readImageToCanvas(image);
    textureEditorState.originalDataUrl = textureEditorState.sourceCanvas.toDataURL("image/png");
    textureEditorState.isPainting = false;
    textureEditorState.lastPoint = null;
    textureEditorState.hoverPoint = null;
    textureEditorState.tool = els.textureEditorTool?.value || "brush";
    textureEditorState.open = true;
    els.textureEditorMeshName.textContent = `${mesh.name} - ${textureEditorState.textureName}`;
    els.textureEditorModal.classList.add("open");
    els.textureEditorModal.setAttribute("aria-hidden", "false");
    syncTextureEditorCursor();
    renderTextureEditor();
  } catch (error) {
    log(`Texture editor failed to open: ${error.message}`);
  }
}

function closeTextureEditor() {
  textureEditorState.open = false;
  textureEditorState.meshId = null;
  textureEditorState.sourceCanvas = null;
  textureEditorState.originalDataUrl = null;
  textureEditorState.drawingRect = null;
  textureEditorState.isPainting = false;
  textureEditorState.lastPoint = null;
  textureEditorState.hoverPoint = null;
  els.textureEditorModal.classList.remove("open");
  els.textureEditorModal.setAttribute("aria-hidden", "true");
}

function resetTextureEditorCanvas() {
  if (!textureEditorState.originalDataUrl) return;
  loadImage(textureEditorState.originalDataUrl).then(image => {
    textureEditorState.sourceCanvas = readImageToCanvas(image);
    renderTextureEditor();
  }).catch(error => log(`Texture editor reset failed: ${error.message}`));
}

function applyTextureEditorChanges() {
  const mesh = textureEditorMesh();
  const source = currentTextureEditorCanvas();
  if (!mesh || !source) return;
  recordHistory("edit texture");
  const dataUrl = source.toDataURL("image/png");
  const textureName = mesh.userData.textureName || textureEditorState.textureName || "Texture";
  registerTextureAsset(textureName, dataUrl, { replace: true });
  applyTextureToMesh(
    mesh,
    dataUrl,
    textureName,
    mesh.userData.textureFlipY ?? true,
    mesh.userData.textureRotation || 0
  );
  refreshTextureLibraryUi();
  syncInspector();
  updateAll();
  closeTextureEditor();
  log(`Applied edited texture to ${mesh.name}.`);
}

function geometryFromData(data) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(data.positions, 3));
  if (data.normals?.length === data.positions.length) geometry.setAttribute("normal", new THREE.Float32BufferAttribute(data.normals, 3));
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
  const uv = source.getAttribute("uv");
  const positions = [];
  const normals = [];
  const uvs = [];
  for (let i = 0; i < position.count; i++) {
    positions.push(round(position.getX(i)), round(position.getY(i)), round(position.getZ(i)));
    normals.push(round(normal.getX(i)), round(normal.getY(i)), round(normal.getZ(i)));
    if (uv) uvs.push(round(uv.getX(i)), round(uv.getY(i)));
  }
  source.dispose();
  return { positions, normals, uvs };
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
  let { shape = "box", geometry, name, position = [0, .5, 0], rotation = [0, 0, 0], scale = [1, 1, 1], color = "#40c7a5", roughness = .6, textureUrl = null, textureName = null, textureRobloxAssetId = "", textureFlipY = true, textureRotation = 0, materialRule = "auto", bevel = null, depth = null, direction = null, pivot = null, hidden = false, linkId = null, linkColor = null, groupId = null, groupName = null } = spec;
  shape = normalizeShapeName(shape);
  const baseGeometry = geometry ? geometryFromData(geometry) : (shapeFactories[shape]?.() ?? shapeFactories.box());
  const meshGeometry = applyGeometryCuts(baseGeometry, spec);
  const cuts = cutSpecFromObject(spec);
  const mesh = new THREE.Mesh(meshGeometry, makeMaterial(color, roughness));
  mesh.name = name || `${shape} ${idCounter}`;
  mesh.userData = {
    id: `obj-${idCounter++}`,
    shape,
    geometry: geometry || null,
    color,
    roughness,
    textureUrl,
    textureName,
    textureRobloxAssetId: normalizeRobloxAssetId(textureRobloxAssetId || ""),
    textureFlipY,
    textureRotation: normalizeTextureRotation(textureRotation),
    materialRule: normalizeMaterialRule(materialRule),
    pivot: Array.isArray(pivot) ? pivot.map(Number) : null,
    hidden: !!hidden,
    linkId: typeof linkId === "string" && linkId.trim() ? linkId.trim() : null,
    linkColor: typeof linkColor === "string" && linkColor.trim() ? linkColor.trim() : null,
    groupId: typeof groupId === "string" && groupId.trim() ? groupId.trim() : null,
    groupName: typeof groupName === "string" && groupName.trim() ? groupName.trim() : null,
    bevel,
    depth,
    direction,
    cuts
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
  mesh.receiveShadow = true;
  if (textureUrl) {
    applyTextureToMesh(mesh, textureUrl, textureName || "Texture", textureFlipY, textureRotation);
  }
  return mesh;
}

function addObject(spec = {}, { record = true, select = false } = {}) {
  if (record) recordHistory("add");
  const mesh = createMesh(spec);
  scene.add(mesh);
  objects.push(mesh);
  if (select) selectObject(mesh);
  updateAll();
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

function createReliefGeometryFromViewSheet({ imageData, cols, rows, scale, depth, back, threshold, smoothPasses, darkForeground }) {
  const viewRects = detectReliefViewRects(imageData, threshold, darkForeground);
  const [frontRect, sideRect, backRect] = viewRects;
  const gridX = Math.max(12, Math.min(72, Math.round(cols)));
  const gridY = Math.max(16, Math.min(128, Math.round(rows)));
  const gridZ = Math.max(10, Math.min(44, Math.round(gridX * .55)));
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
    (x / gridX - .5) * meshW,
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
  const clampDetail = amount => Math.max(-detailStrength * 2.4, Math.min(detailStrength * 1.35, amount));
  const detailFromPixel = pixel => {
    const raw = darkForeground
      ? (threshold - pixel.luma) / Math.max(1, threshold)
      : (pixel.luma - threshold) / Math.max(1, 255 - threshold);
    return Math.max(-1, Math.min(1, raw * 2 - .65));
  };
  const viewSampleInfo = (view, x, y, z) => {
    if (view === "front") return { rect: frontRect, nx: x / gridX, ny: y / gridY };
    if (view === "back") return { rect: backRect, nx: 1 - x / gridX, ny: y / gridY };
    return { rect: sideRect, nx: z / gridZ, ny: y / gridY };
  };
  const detailAmountFor = (view, x, y, z) => {
    const info = viewSampleInfo(view, x, y, z);
    const pixel = sampleRect(info.rect, info.nx, info.ny);
    const radiusX = view === "side" ? 1 / Math.max(12, gridZ) : 1 / Math.max(16, gridX);
    const radiusY = 1 / Math.max(20, gridY);
    let total = 0;
    let count = 0;
    for (const offset of [[-radiusX, 0], [radiusX, 0], [0, -radiusY], [0, radiusY], [-radiusX, -radiusY], [radiusX, -radiusY], [-radiusX, radiusY], [radiusX, radiusY]]) {
      const neighbor = sampleRect(info.rect, info.nx + offset[0], info.ny + offset[1]);
      if (neighbor.a > 24) {
        total += neighbor.luma;
        count++;
      }
    }
    const localAverage = count ? total / count : pixel.luma;
    const localContrast = (pixel.luma - localAverage) / 255;
    const signedContrast = darkForeground ? -localContrast : localContrast;
    const absoluteVolume = detailFromPixel(pixel) * detailStrength * .25;
    const darkGrooveBoost = signedContrast < 0 ? signedContrast * detailContrastStrength * 2.15 : signedContrast * detailContrastStrength * .65;
    return clampDetail(absoluteVolume + darkGrooveBoost);
  };
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
  return {
    positions,
    uvs,
    meta: { mode: "viewSheetOvalHullDetailPolished", cols: gridX, rows: gridY, depthSlices: gridZ, sourceW: imageData.width, sourceH: imageData.height, threshold, darkForeground, smoothPasses, polishLevel, depth, back, voxelCount, mergedFaceCount, detailStrength, detailContrastStrength, viewRects }
  };
}

function createReliefGeometryFromImage() {
  const imageData = reliefImageState.imageData;
  const image = reliefImageState.image;
  if (!imageData || !image) throw new Error("Load an image first.");
  const sourceW = imageData.width;
  const sourceH = imageData.height;
  const cols = Math.max(8, Math.round(reliefNumber(els.reliefGridXInput, 56, 8, 160)));
  const rows = Math.max(8, Math.round(reliefNumber(els.reliefGridYInput, 96, 8, 220)));
  const scale = reliefNumber(els.reliefScaleInput, 6, .5, 20);
  const depth = reliefNumber(els.reliefDepthInput, .9, 0, 5);
  const back = reliefNumber(els.reliefBackInput, .22, 0, 3);
  const threshold = reliefNumber(els.reliefThresholdInput, 70, 0, 255);
  const smoothPasses = Math.round(reliefNumber(els.reliefSmoothInput, 2, 0, 8));
  const darkForeground = !!els.reliefDarkForegroundInput?.checked;
  const sourceMode = els.reliefSourceModeInput?.value || "single";
  if (sourceMode === "sheet") {
    return createReliefGeometryFromViewSheet({ imageData, cols, rows, scale, depth, back, threshold, smoothPasses, darkForeground });
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

async function loadReliefImageFile(file) {
  if (!file) return;
  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(dataUrl);
  const canvas = readImageToCanvas(image);
  reliefImageState.dataUrl = dataUrl;
  reliefImageState.name = file.name || "reference image";
  reliefImageState.image = image;
  reliefImageState.canvas = canvas;
  reliefImageState.imageData = canvas.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, canvas.width, canvas.height);
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
      color: "#d8d8d8",
      roughness: .48,
      position: [0, 0, 0]
    }, { record: false });
    mesh.userData.reliefSource = { ...meta, sourceName: reliefImageState.name };
    frameSelected();
    log(`Created relief mesh from ${reliefImageState.name}: ${positions.length / 9} triangles, grid ${meta.cols} x ${meta.rows}.`);
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
    : "Orbit: drag | Select: click | Transform tools: toggle Move/Rotate/Scale";
}

function setDragPushMode(enabled, { silent = false } = {}) {
  finishDragPushSession();
  dragPushMode = !!enabled;
  els.dragPushBtn?.classList.toggle("active", dragPushMode);
  if (dragPushMode) {
    if (activeTransformMode) setTransformMode(activeTransformMode);
    setFacePickMode(true);
    els.hudText.textContent = `Drag/Push mode: drag left or right to move selected triangles along ${String(els.dragPushAxisSelect?.value || "normal").toUpperCase()} in snapped ${Number(els.dragPushStepInput?.value || .01)} steps`;
  } else {
    els.hudText.textContent = facePickMode
      ? "Triangle cursor: click a mesh triangle, double-click connected, then use Marker, Extend, Pull, Push, or Bevel Face"
      : "Orbit: drag | Select: click | Transform tools: toggle Move/Rotate/Scale";
  }
  if (!silent) log(dragPushMode ? "Drag/Push mode enabled." : "Drag/Push mode disabled.");
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

function selectObject(mesh, { keepGroup = false, append = false } = {}) {
  if (append && !mesh) return;
  if (selectedHoleLoopInfo?.targetId) {
    const nextTargetId = mesh?.userData?.id || null;
    if (!nextTargetId || selectedHoleLoopInfo.targetId !== nextTargetId) {
      clearSelectedHoleLoop();
    }
  }
  if (mesh) selectedGroupRecordId = null;
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
    }
    else {
      activeGroupIds = mesh ? linkSelectionIds(mesh) : [];
    }
  }
  selected = mesh || null;
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
  const candidates = meshActionCandidates();
  return candidates.selectedOnly[0]
    || candidates.faceMeshes[0]
    || candidates.checked[0]
    || candidates.active[0]
    || null;
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
    : "Orbit: drag | Select: click | Transform tools: toggle Move/Rotate/Scale";
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
  const checked = checkedObjects();
  if (checked.length) return checked;
  return selected ? [selected] : [];
}

function pivotManagedObjects() {
  const groupObjects = transformTargetObjects();
  if (groupObjects.length) return groupObjects;
  return selected ? [selected] : [];
}

function syncTextureButtonLabel() {
  const targets = textureTargetObjects();
  const hasTexture = targets.length > 0 && targets.every(mesh => !!mesh.userData.textureUrl);
  els.textureBtn.textContent = hasTexture ? "Change Texture" : "Add Texture";
  els.textureBtn.title = hasTexture
    ? "Open the texture library or import a replacement texture for the selected part or checked parts"
    : "Open the texture library or add a texture image to the selected part or checked parts";
  refreshTextureLibraryUi();
  syncTextureEditorButton();
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
  for (const mesh of targets) mirrorMeshGeometry(mesh, axis);
  updateAll();
  log(`Flipped ${targets.length} part${targets.length === 1 ? "" : "s"} around local ${axis.toUpperCase()} center.`);
  return targets;
}

function setChecked(mesh, checked) {
  if (checked) checkedIds.add(mesh.userData.id);
  else checkedIds.delete(mesh.userData.id);
  updateTransformAttachment();
  syncInspector();
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
    ? (coplanarFacePickMode
      ? "Face mode: click a flat region to select connected coplanar triangles | Shift adds more | Double-click still selects full connected islands"
      : els.areaTriInput.checked
        ? "Area mode: drag a rectangle to select triangles | Double-click selects connected"
        : els.paintTriInput.checked
          ? "Paint mode: drag to select triangles | Hold Space to orbit camera"
          : "Triangle cursor: click a mesh triangle, double-click connected, then use Marker, Extend, Pull, or Bevel Face")
    : "Orbit: drag | Select: click | Transform: gizmo";
  if (!facePickMode && !selectedFace) faceMarker.visible = false;
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

function setTriangleSelection(faces, { append = false } = {}) {
  if (!append) selectedFaces.length = 0;
  for (const face of faces) {
    if (!selectedFaces.some(existing => existing.markerKey === face.markerKey)) selectedFaces.push(face);
  }
  selectedFace = selectedFaces.at(-1) || null;
  if (selectedFace) selectObject(selectedFace.mesh);
  updateFaceMarker();
  updateState();
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

function deleteSelectedTriangles({ record = true, update = true, announce = true } = {}) {
  if (!selectedFaces.length) {
    log("Select one or more mesh triangles first, then press Delete Tri.");
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
  if (!silent) log(`${append ? "Updated" : "Selected"} triangle selection on ${mesh.name}. Hold Shift to add/remove more.`, { selected: selectedFaces.length, triangle: hit.faceIndex, width: round(width), height: round(height) });
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

function makePulledSelectionSpec(faces, length) {
  const worldPositions = [];
  for (const face of faces) {
    const faceLength = typeof length === "function" ? length(face) : length;
    const normal = worldFaceNormal(face);
    const [a, b, c] = worldTrianglePoints(face);
    const a2 = a.clone().addScaledVector(normal, faceLength);
    const b2 = b.clone().addScaledVector(normal, faceLength);
    const c2 = c.clone().addScaledVector(normal, faceLength);
    const av = vecArray(a);
    const bv = vecArray(b);
    const cv = vecArray(c);
    const a2v = vecArray(a2);
    const b2v = vecArray(b2);
    const c2v = vecArray(c2);
    addTriangleBothSides(worldPositions, av, bv, cv);
    addTriangleBothSides(worldPositions, a2v, c2v, b2v);
    addQuadBothSides(worldPositions, av, bv, b2v, a2v);
    addQuadBothSides(worldPositions, bv, cv, c2v, b2v);
    addQuadBothSides(worldPositions, cv, av, a2v, c2v);
  }

  const points = [];
  for (let i = 0; i < worldPositions.length; i += 3) points.push(new THREE.Vector3(worldPositions[i], worldPositions[i + 1], worldPositions[i + 2]));
  const box = new THREE.Box3().setFromPoints(points);
  const center = box.getCenter(new THREE.Vector3());
  const { xAxis, yAxis, zAxis } = faceFrame(faces[0]);
  const basis = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis).setPosition(center);
  const inverseBasis = basis.clone().invert();
  const localPositions = points.flatMap(point => vecArray(point.applyMatrix4(inverseBasis)));
  const geometry = geometryFromPositions(localPositions);
  const quaternion = new THREE.Quaternion().setFromRotationMatrix(basis);
  const euler = new THREE.Euler().setFromQuaternion(quaternion, "XYZ");
  const firstMesh = faces[0].mesh;
  const color = `#${firstMesh.material.color.getHexString()}`;
  const geometryData = geometryToData(geometry);
  geometry.dispose();
  return {
    shape: "custom",
    geometry: geometryData,
    name: `${firstMesh.name} pulled triangle extrusion`,
    position: center.toArray().map(round),
    rotation: [euler.x, euler.y, euler.z].map(value => round(THREE.MathUtils.radToDeg(value))),
    scale: [1, 1, 1],
    color,
    roughness: firstMesh.material.roughness
  };
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

function moveSelectedVerticesAlongAxis(mesh, faces, distance, axisMode = "normal") {
  const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  const position = geometry.getAttribute("position");
  const targets = [];
  const epsilon = .0002;

  for (const face of faces) {
    const faceDistance = typeof distance === "function" ? distance(face) : distance;
    const worldAxis = dragPushWorldAxis(face, axisMode).normalize();
    const displacement = localDisplacementFromWorldVector(mesh, worldAxis.multiplyScalar(faceDistance));
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
  if (!selectedFaces.length) {
    log("Select one or more mesh triangles first, then press Pull.");
    setFacePickMode(true);
    return [];
  }
  const depth = faceEditDepth({ min: .05 });
  const length = signedFaceLengthResolver(depth, 1);
  const selectedCount = selectedFaces.length;
  recordHistory("pull selected area");
  const created = [addObject(makePulledSelectionSpec(selectedFaces, length), { record: false })];
  clearSelectedTriangles();
  updateAll();
  log(`Pulled ${selectedCount} selected triangle area${selectedCount === 1 ? "" : "s"} into one editable extrusion${els.connectFaceInput.checked ? " using connected-face stops" : ""}.`);
  return created;
}

function pushSelectedFaces() {
  if (!selectedFaces.length) {
    log("Select one or more mesh triangles first, then press Push.");
    setFacePickMode(true);
    return [];
  }
  const depth = faceEditDepth({ min: .05 });
  const length = signedFaceLengthResolver(depth, -1);
  const selectedCount = selectedFaces.length;
  recordHistory("push selected area");
  const created = [addObject(makePulledSelectionSpec(selectedFaces, length), { record: false })];
  clearSelectedTriangles();
  updateAll();
  log(`Pushed ${selectedCount} selected triangle area${selectedCount === 1 ? "" : "s"} inward as one editable cavity patch${els.connectFaceInput.checked ? " using connected-face stops" : ""}.`);
  return created;
}

function dragPushAxisLabel() {
  const axis = String(els.dragPushAxisSelect?.value || "normal");
  return axis === "normal" ? "Normal" : axis.toUpperCase();
}

function dragPushTargetMeshes() {
  return [...new Set(selectedFaces.map(face => face.mesh).filter(Boolean))];
}

function canStartDragPushFromHit(hit) {
  if (!dragPushMode || !selectedFaces.length || !hit?.object) return false;
  return selectedFaces.some(face => face.mesh === hit.object);
}

function beginDragPushSession(event) {
  if (!dragPushMode || !selectedFaces.length) return false;
  const step = dragPushStepSize();
  const axis = String(els.dragPushAxisSelect?.value || "normal");
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
  els.hudText.textContent = `Drag/Push active: drag left or right | Axis ${dragPushAxisLabel()} | Step ${step}`;
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
  for (const [mesh, faces] of facesByMesh) moveSelectedVerticesAlongAxis(mesh, faces, deltaToApply, dragPushSession.axis);
  dragPushSession.appliedDistance = targetDistance;
  updateAll();
  els.hudText.textContent = `Drag/Push active: ${dragPushAxisLabel()} ${round(targetDistance)} | Step ${dragPushSession.step}`;
  return true;
}

function finishDragPushSession(pointerId = null) {
  if (!dragPushSession) return false;
  if (pointerId != null && dragPushSession.pointerId !== pointerId) return false;
  dragPushSession = null;
  if (!spaceCameraMode) orbit.enabled = true;
  if (dragPushMode) {
    els.hudText.textContent = `Drag/Push mode: drag left or right to move selected triangles along ${dragPushAxisLabel()} in snapped ${dragPushStepSize()} steps`;
  }
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
  if (selectedGroupRecordId && groupRecord(selectedGroupRecordId) && !checkedIds.size) {
    return descendantMeshesForGroup(selectedGroupRecordId);
  }
  return selectionTargetsForGrouping();
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
  const allTexturedMatch = textured.every(mesh =>
    (mesh.userData.textureUrl || null) === firstUrl
    && (mesh.userData.textureName || null) === firstName
    && (mesh.userData.textureFlipY ?? true) === firstFlipY
    && normalizeTextureRotation(mesh.userData.textureRotation || 0) === firstRotation
    && normalizeRobloxAssetId(mesh.userData.textureRobloxAssetId || "") === firstRobloxId
  );
  return allTexturedMatch ? {
    textureUrl: firstUrl,
    textureName: firstName,
    textureFlipY: firstFlipY,
    textureRotation: firstRotation,
    textureRobloxAssetId: firstRobloxId
  } : null;
}

function mergeSourceDisplayColor(mesh) {
  const stored = String(mesh?.userData?.textureDisplayColor || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(stored)) return stored.toLowerCase();
  return `#${mesh.material.color.getHexString()}`.toLowerCase();
}

function createMergedColorAtlas(meshes, name = "Merged Mesh") {
  const colors = [];
  const colorIndex = new Map();
  const meshUvs = new Map();
  for (const mesh of meshes) {
    const color = mergeSourceDisplayColor(mesh);
    if (!colorIndex.has(color)) {
      colorIndex.set(color, colors.length);
      colors.push(color);
    }
  }
  if (!colors.length) return null;

  const cellSize = colors.length <= 256 ? 16 : 4;
  const canvas = document.createElement("canvas");
  canvas.width = colors.length * cellSize;
  canvas.height = cellSize;
  const context = canvas.getContext("2d");
  if (!context) return null;
  colors.forEach((color, index) => {
    context.fillStyle = color;
    context.fillRect(index * cellSize, 0, cellSize, cellSize);
  });
  for (const mesh of meshes) {
    const index = colorIndex.get(mergeSourceDisplayColor(mesh)) || 0;
    meshUvs.set(mesh.userData.id, [round((index + .5) / colors.length, 6), .5]);
  }
  return {
    textureUrl: canvas.toDataURL("image/png"),
    textureName: `${name} Color Atlas`,
    textureFlipY: true,
    textureRotation: 0,
    textureRobloxAssetId: "",
    meshUvs,
    colorCount: colors.length
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
  return [round(clamp(u, 0, 1), 4), round(clamp(v, 0, 1), 4)];
}

function mergedMeshSpec(meshes, { name = "Merged Mesh", groupId = null, groupName = null } = {}) {
  if (!meshes.length) return null;
  const positions = [];
  const normals = [];
  const textureState = sharedMergeTextureState(meshes);
  const colorAtlas = textureState ? null : createMergedColorAtlas(meshes, name);
  const vertexUvs = [];
  let hasAnyNormals = false;
  let hasAnyUvs = !!(textureState || colorAtlas);

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
        if (colorAtlas) {
          vertexUvs.push(colorAtlas.meshUvs.get(mesh.userData.id) || [.5, .5]);
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
      if (explicitUv) {
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
    color: colorAtlas ? "#ffffff" : `#${meshes[0].material.color.getHexString()}`,
    roughness: round(meshes.reduce((sum, mesh) => sum + Number(mesh.material.roughness || 0), 0) / meshes.length),
    textureUrl: textureState?.textureUrl || colorAtlas?.textureUrl || null,
    textureName: textureState?.textureName || colorAtlas?.textureName || null,
    textureFlipY: textureState?.textureFlipY ?? colorAtlas?.textureFlipY ?? true,
    textureRotation: textureState?.textureRotation ?? colorAtlas?.textureRotation ?? 0,
    textureRobloxAssetId: textureState?.textureRobloxAssetId || colorAtlas?.textureRobloxAssetId || "",
    generatedColorAtlas: !!colorAtlas,
    mergedColorCount: colorAtlas?.colorCount || 0,
    materialRule: sameRule,
    groupId,
    groupName,
    hidden: false,
    linkId: null,
    linkColor: null
  };
}

function mergeCheckedMeshes() {
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
  const spec = mergedMeshSpec(targetMeshes, {
    name: mergedName,
    groupId: parentId,
    groupName: parentRecord?.name || null
  });

  if (!spec) {
    log("Could not merge those meshes into a valid mesh.");
    return null;
  }

  const keptTexture = !!spec.textureUrl;
  const generatedColorAtlas = !!spec.generatedColorAtlas;
  const mergedColorCount = Number(spec.mergedColorCount) || 0;
  delete spec.generatedColorAtlas;
  delete spec.mergedColorCount;
  recordHistory("merge mesh");
  if (generatedColorAtlas && spec.textureUrl && spec.textureName) {
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

  const merged = addObject(spec, { record: false });
  ensureSceneGroups();
  ensureModelGroups();
  checkedIds = new Set([merged.userData.id]);
  activeGroupIds = [];
  currentTransformTargetKey = "";
  updateTransformAttachment();
  updateAll();
  log(`Merged ${targetMeshes.length} meshes into ${merged.name}.`, {
    keptTexture,
    generatedColorAtlas,
    mergedColorCount,
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

function removeObject(mesh, { record = true } = {}) {
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
  updateAll();
}

function duplicateSelected() {
  if (!selected) return;
  const data = serializeObject(selected);
  data.name = `${selected.name} copy`;
  data.position[0] += .35;
  data.position[2] += .35;
  addObject(data);
}

function clearObjects({ record = true } = {}) {
  if (record && objects.length) recordHistory("clear");
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
