function serializeObject(mesh) {
  return {
    id: mesh.userData.id,
    name: mesh.name,
    shape: mesh.userData.shape,
    geometry: mesh.userData.geometry,
    bevel: mesh.userData.bevel,
    depth: mesh.userData.depth,
    direction: mesh.userData.direction,
    cuts: mesh.userData.cuts || null,
    pivot: mesh.userData.pivot || null,
    linkId: mesh.userData.linkId || null,
    position: mesh.position.toArray().map(round),
    rotation: [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z].map(v => round(THREE.MathUtils.radToDeg(v))),
    scale: mesh.scale.toArray().map(round),
    color: `#${mesh.material.color.getHexString()}`,
    roughness: round(mesh.material.roughness),
    hidden: !!mesh.userData.hidden,
    groupId: mesh.userData.groupId || null,
    groupName: mesh.userData.groupName || null,
    linkColor: mesh.userData.linkColor || null,
    textureUrl: mesh.userData.textureUrl || null,
    textureName: mesh.userData.textureName || null,
    textureRobloxAssetId: normalizeRobloxAssetId(mesh.userData.textureRobloxAssetId || ""),
    materialRule: normalizeMaterialRule(mesh.userData.materialRule || "auto"),
    textureFlipY: mesh.userData.textureFlipY ?? true,
    textureRotation: normalizeTextureRotation(mesh.userData.textureRotation || 0)
  };
}

function serializeHierarchyNode(record) {
  return {
    id: record.id,
    name: record.name,
    meshes: meshesDirectInGroup(record.id).map(mesh => ({
      id: mesh.userData.id,
      name: mesh.name,
      type: mesh.userData.textureUrl ? "texture" : (mesh.userData.geometry ? "mesh" : mesh.userData.shape)
    })),
    children: childGroupRecords(record.id).map(serializeHierarchyNode)
  };
}

function state() {
  return {
    version: 2,
    coordinateSystem: {
      handedness: "right-handed",
      units: "meters",
      upAxis: "+Y",
      groundPlane: "XZ",
      axes: {
        x: "+X / -X horizontal axis",
        y: "+Y up, -Y down",
        z: "+Z / -Z depth axis"
      },
      rotationUnits: "degrees",
      eulerOrder: "XYZ",
      positiveRotation: "right-hand rule",
      objectPositions: "world space",
      geometryAndPivots: "object-local space"
    },
    shapeConventions: {
      defaultOrigin: "Built-in geometry is centered on its local origin before object transforms.",
      pyramidFrustum: "Square base points toward -Y and the smaller square top points toward +Y.",
      facetedBalls: "Centered icospheres; 20, 80 and 320 describe triangle counts.",
      curvedPanel: "Centered around its local origin; its canonical depth axis is Y before exported XYZ rotation is applied."
    },
    groups: serializeGroupRecords(),
    hierarchy: childGroupRecords(null).map(serializeHierarchyNode),
    objects: objects.map(serializeObject)
  };
}

function projectCapabilities() {
  return {
    shapes: Object.keys(shapeFactories),
    transforms: ["translate", "rotate", "scale", "flipX", "flipY", "flipZ", "sharedPivot"],
    faceTools: ["triangleSelect", "coplanarFaceSelect", "paintSelect", "areaSelect", "marker", "lineSketch", "makeFaceFromSketch", "fillLineFromSketch", "cutHoleFromSketch", "deleteTriangles", "extractTriangles", "fillHole", "copyTriangles", "pasteTriangles", "extend", "pull", "push", "dragPush", "bevelFace", "cutTopBottom"],
    textureTools: ["addTexture", "changeTexture", "clearTexture", "flipTexture", "rotateTexture", "saveTextureImage", "textureLibrary"],
    exports: ["project", "json", "obj", "robloxPack", "dae"],
    sceneGrouping: ["checkedSelection", "nameGroups", "groupOnly", "selectAll", "deselectAll", "nestedGroups", "groupDetails", "mergeMeshes"],
    lighting: ["mainLamp", "mirrorLamp", "lightGuides", "lampAim", "lampStrength", "coneAngle"],
    notes: [
      "Project files store editable scene state plus editor/view settings.",
      "Scene JSON stores the editable scene objects only.",
      "OBJ exports in Roblox stud units. DAE exports in meters using 1 stud = 0.28 meters.",
      "Persistent groups can be nested to form parent-child asset hierarchies for later AI or export workflows.",
      "Roblox Pack exports one ZIP containing one OBJ per mesh plus a manifest and Lua rebuild plugin using group-path names like Car.Seat.part1."
    ]
  };
}

function projectState() {
  const projectName = currentProjectBaseName();
  const textureLibraryEntries = serializeTextureLibrary();
  const scene = state();
  const textureNameByUrl = new Map(
    textureLibraryEntries
      .filter(entry => entry?.name && entry?.dataUrl)
      .map(entry => [entry.dataUrl, entry.name])
  );
  for (const object of scene.objects || []) {
    const libraryName = textureNameByUrl.get(object.textureUrl);
    if (!libraryName) continue;
    object.textureName = libraryName;
    object.textureUrl = null;
  }
  return {
    kind: "modeler-project",
    version: 1,
    name: projectName,
    savedAt: new Date().toISOString(),
    capabilities: projectCapabilities(),
    textureLibrary: textureLibraryEntries,
    scene,
    editor: {
      projectName,
      selectedId: selected?.userData?.id || null,
      selectedGroupId: selectedGroupRecordId || null,
      checkedIds: [...checkedIds],
      activeGroupIds: [...activeGroupIds],
      activeTransformMode,
      facePickMode,
      view: {
        cameraPosition: camera.position.toArray().map(round),
        orbitTarget: orbit.target.toArray().map(round),
        cameraUp: camera.up.toArray().map(round),
        viewSpace: Number(els.viewSpaceInput.value) || 1.5,
        shotZoom: Number(els.shotSpaceInput.value) || 0.85,
        environment: els.environmentSelect?.value || "plain",
        background: els.backgroundSelect?.value || "plain",
        showGrid: !!els.showGridInput.checked,
        useCurrentZoomInShots: !!els.useCurrentZoomInShotsInput.checked,
        hideGridInShots: !!els.hideGridInShotsInput.checked
      },
      panels: {
        addMeshCollapsed: els.addMeshSection.classList.contains("collapsed"),
        inspectorCollapsed: els.inspectorSection.classList.contains("collapsed"),
        utilitiesCollapsed: els.utilitiesSection.classList.contains("collapsed"),
        statusCollapsed: els.statusSection.classList.contains("collapsed")
      },
      toolbars: toolbarVisibilityState(),
      tools: {
        rotationSnap: Number(els.rotationSnapSelect.value) || 0,
        bevelType: els.bevelTypeSelect.value,
        bevelSize: Number(els.bevelSizeInput.value) || 0.16,
        bevelDepth: Number(els.bevelDepthInput.value) || 0.18,
        dragPushAxis: els.dragPushAxisSelect.value || "normal",
        dragPushStep: Number(els.dragPushStepInput.value) || 0.01,
        connectFace: !!els.connectFaceInput.checked,
        coplanarFaceSelection: !!coplanarFacePickMode,
        paintSelection: !!els.paintTriInput.checked,
        areaSelection: !!els.areaTriInput.checked,
        cutSide: els.cutSideSelect.value,
        cutAmount: els.cutAmountInput.value || "50%"
      },
      lighting: {
        showGuides: !!els.showLightGuidesInput.checked,
        enablePrimary: !!els.enablePrimaryLightInput.checked,
        enableMirror: !!els.enableMirrorLightInput.checked,
        lampPosition: [
          Number(els.lightPosXInput.value) || -6,
          Number(els.lightPosYInput.value) || 5,
          Number(els.lightPosZInput.value) || 6
        ],
        lampTarget: [
          Number(els.lightTargetXInput.value) || 0,
          Number(els.lightTargetYInput.value) || 1.5,
          Number(els.lightTargetZInput.value) || 0
        ],
        intensity: Number(els.lightIntensityInput.value) || 10,
        angle: Number(els.lightAngleInput.value) || 24
      },
      rigging: serializeBoneRig()
    }
  };
}

function hydrateProjectTextureReferences(scene, entries = []) {
  const textureByName = new Map(
    (entries || [])
      .filter(entry => entry?.name && entry?.dataUrl)
      .map(entry => [entry.name, entry.dataUrl])
  );
  for (const object of scene?.objects || []) {
    if (object.textureUrl || !object.textureName) continue;
    object.textureUrl = textureByName.get(object.textureName) || null;
  }
}

function cloneSceneState() {
  const scene = state();
  const textureEntries = [...textureLibrary.values()].map(entry => ({
    name: entry.name,
    dataUrl: entry.dataUrl,
    robloxAssetId: normalizeRobloxAssetId(entry.robloxAssetId || "")
  }));
  const textureNameByUrl = new Map(
    textureEntries
      .filter(entry => entry?.name && entry?.dataUrl)
      .map(entry => [entry.dataUrl, entry.name])
  );

  // History must keep embedded image data once per texture, not once per mesh.
  // A textured imported project can otherwise turn a small inspector edit into
  // a several-hundred-megabyte synchronous JSON clone and stop before applying it.
  for (const object of scene.objects || []) {
    const libraryName = textureNameByUrl.get(object.textureUrl);
    if (!libraryName) continue;
    object.textureName = libraryName;
    object.textureUrl = null;
  }

  return {
    scene: JSON.parse(JSON.stringify(scene)),
    // Data URLs are immutable strings. Keep their shared references instead of
    // recreating every multi-megabyte payload for every history entry.
    textureLibrary: textureEntries.map(entry => ({ ...entry })),
    editor: {
      selectedId: selected?.userData?.id || null,
      selectedGroupId: selectedGroupRecordId || null,
      checkedIds: [...checkedIds],
      activeGroupIds: [...activeGroupIds]
    }
  };
}

let isProjectLoading = false;

function recordHistory() {
  if (isRestoring || isProjectLoading) return;
  history.push(cloneSceneState());
  if (history.length > maxHistory) history.shift();
  updateUndoButton();
}

function updateUndoButton() {
  els.undoBtn.disabled = history.length === 0;
}

function setCurrentSceneAsHistoryBaseline() {
  history.length = 0;
  updateUndoButton();
}

function undo() {
  const previous = history.pop();
  if (!previous) return;
  isRestoring = true;
  const previousScene = previous.scene?.objects ? previous.scene : previous;
  if (previous.scene?.objects) {
    restoreTextureLibrary(previous.textureLibrary || [], { replace: true });
    hydrateProjectTextureReferences(previousScene, previous.textureLibrary || []);
  }
  loadState(previousScene, { record: false });
  if (previous.editor) {
    checkedIds.clear();
    for (const id of previous.editor.checkedIds || []) {
      if (findObject(id)) checkedIds.add(id);
    }
    activeGroupIds = (previous.editor.activeGroupIds || []).filter(id => findObject(id));
    selectedGroupRecordId = previous.editor.selectedGroupId && sceneGroupRegistry.has(previous.editor.selectedGroupId)
      ? previous.editor.selectedGroupId
      : null;
    selectObject(previous.editor.selectedId ? findObject(previous.editor.selectedId) : null, { keepGroup: true });
  }
  isRestoring = false;
  updateUndoButton();
  log("Undo.");
}

function loadState(data, { record = true } = {}) {
  if (record) recordHistory("import");
  // Undo snapshots and compact project scenes store one texture payload in the
  // library and lightweight textureName references on their mesh objects.
  hydrateProjectTextureReferences(data, [...textureLibrary.values()]);
  clearObjects({ record: false });
  clearLineSketch({ silent: true, keepMode: false });
  checkedIds.clear();
  activeGroupIds = [];
  selectedGroupRecordId = null;
  currentTransformTargetKey = "";
  pivotEditMode = false;
  els.pivotBtn.classList.remove("active");
  setDragPushMode(false, { silent: true });
  sceneGroupRegistry.clear();
  for (const spec of data.groups || []) {
    createSceneGroupRecord({
      id: spec.id || null,
      name: spec.name || "Group",
      parentId: spec.parentId || null
    });
  }
  for (const spec of data.objects || []) addObject(spec, { record: false, update: false });
  ensureLinkGroupColors();
  ensureSceneGroups();
  ensureModelGroups();
  selectObject(objects.at(-1) || null);
  updateAll();
}

function applyProjectEditorState(editor = {}) {
  const loadedProjectName = editor.projectName || currentProjectBaseName();
  if (els.projectNameInput) els.projectNameInput.value = safeFileName(loadedProjectName, "modeler-project");
  checkedIds = new Set((editor.checkedIds || []).filter(id => !!findObject(id)));
  activeGroupIds = (editor.activeGroupIds || []).filter(id => !!findObject(id));
  selectedGroupRecordId = editor.selectedGroupId && groupRecord(editor.selectedGroupId) ? editor.selectedGroupId : null;
  currentTransformTargetKey = "";

  const panels = editor.panels || {};
  setSectionCollapsed(els.addMeshSection, els.addMeshToggle, !!panels.addMeshCollapsed);
  setSectionCollapsed(els.inspectorSection, els.inspectorToggle, !!panels.inspectorCollapsed);
  setSectionCollapsed(els.utilitiesSection, els.utilitiesToggle, !!panels.utilitiesCollapsed);
  setSectionCollapsed(els.statusSection, els.statusToggle, !!panels.statusCollapsed);
  applyToolbarVisibility(setToolbarToggleState(editor.toolbars || defaultToolbarVisibility));

  const tools = editor.tools || {};
  els.rotationSnapSelect.value = String(tools.rotationSnap ?? 0);
  applyRotationSnap();
  els.bevelTypeSelect.value = tools.bevelType || "inner";
  els.bevelSizeInput.value = String(tools.bevelSize ?? 0.16);
  els.bevelDepthInput.value = String(tools.bevelDepth ?? 0.18);
  els.dragPushAxisSelect.value = ["normal", "x", "y", "z"].includes(tools.dragPushAxis) ? tools.dragPushAxis : "normal";
  els.dragPushStepInput.value = String(tools.dragPushStep ?? 0.01);
  els.connectFaceInput.checked = !!tools.connectFace;
  coplanarFacePickMode = !!tools.coplanarFaceSelection;
  els.paintTriInput.checked = !!tools.paintSelection && !coplanarFacePickMode;
  els.areaTriInput.checked = !!tools.areaSelection && !coplanarFacePickMode;
  if (els.paintTriInput.checked) els.areaTriInput.checked = false;
  els.cutSideSelect.value = tools.cutSide === "bottom" ? "bottom" : "top";
  els.cutAmountInput.value = tools.cutAmount || "50%";

  const view = editor.view || {};
  els.viewSpaceInput.value = String(view.viewSpace ?? 1.5);
  els.shotSpaceInput.value = String(view.shotZoom ?? 0.85);
  if (els.environmentSelect) els.environmentSelect.value = ["road", "studio", "plain"].includes(view.environment) ? view.environment : "plain";
  if (els.backgroundSelect) {
    els.backgroundSelect.value = ["sky", "sunset", "studio", "plain"].includes(view.background) ? view.background : "plain";
  }
  els.showGridInput.checked = view.showGrid ?? true;
  els.useCurrentZoomInShotsInput.checked = view.useCurrentZoomInShots ?? true;
  els.hideGridInShotsInput.checked = view.hideGridInShots ?? true;
  syncGridVisibility();

  const lighting = editor.lighting || {};
  els.showLightGuidesInput.checked = lighting.showGuides ?? false;
  els.enablePrimaryLightInput.checked = lighting.enablePrimary ?? false;
  els.enableMirrorLightInput.checked = lighting.enableMirror ?? false;
  els.lightPosXInput.value = String(lighting.lampPosition?.[0] ?? -6);
  els.lightPosYInput.value = String(lighting.lampPosition?.[1] ?? 5);
  els.lightPosZInput.value = String(lighting.lampPosition?.[2] ?? 6);
  els.lightTargetXInput.value = String(lighting.lampTarget?.[0] ?? 0);
  els.lightTargetYInput.value = String(lighting.lampTarget?.[1] ?? 1.5);
  els.lightTargetZInput.value = String(lighting.lampTarget?.[2] ?? 0);
  els.lightIntensityInput.value = String(lighting.intensity ?? 10);
  els.lightAngleInput.value = String(lighting.angle ?? 24);
  syncSpotLightRig();
  restoreBoneRig(editor.rigging || {});

  const selectedMesh = editor.selectedId ? findObject(editor.selectedId) : null;
  selectObject(selectedMesh, { keepGroup: true });

  const requestedMode = ["translate", "rotate", "scale"].includes(editor.activeTransformMode) ? editor.activeTransformMode : null;
  activeTransformMode = null;
  document.querySelectorAll("[data-mode]").forEach(btn => btn.classList.remove("active"));
  if (requestedMode) setTransformMode(requestedMode);
  else updateTransformAttachment();

  const cameraPosition = view.cameraPosition;
  const orbitTarget = view.orbitTarget;
  const cameraUp = view.cameraUp;
  if (Array.isArray(cameraPosition) && cameraPosition.length === 3) camera.position.fromArray(cameraPosition);
  if (Array.isArray(orbitTarget) && orbitTarget.length === 3) orbit.target.fromArray(orbitTarget);
  if (Array.isArray(cameraUp) && cameraUp.length === 3) camera.up.fromArray(cameraUp);
  camera.updateProjectionMatrix();
  orbit.update();

  setFacePickMode(!!editor.facePickMode);
  syncTextureButtonLabel();
  updateAll();
}

function loadProjectData(data, fileName = "Project") {
  if (data?.kind === "modeler-project" && data?.scene?.objects) {
    isProjectLoading = true;
    try {
      if (els.projectNameInput) {
        els.projectNameInput.value = safeFileName(data.name || data.editor?.projectName || baseNameFromFileName(fileName, "modeler-project"), "modeler-project");
      }
      hydrateProjectTextureReferences(data.scene, data.textureLibrary || []);
      restoreTextureLibrary(data.textureLibrary || [], { replace: true });
      loadState(data.scene, { record: false });
      reconcileTextureRobloxIds();
      applyProjectEditorState(data.editor || {});
    } finally {
      isProjectLoading = false;
    }
    setCurrentSceneAsHistoryBaseline();
    log(`Loaded project ${fileName}.`, {
      objects: data.scene.objects.length,
      checked: data.editor?.checkedIds?.length || 0,
      textures: (data.textureLibrary || []).length || 0
    });
    return;
  }
  if (data?.objects) {
    isProjectLoading = true;
    try {
      if (els.projectNameInput) els.projectNameInput.value = baseNameFromFileName(fileName, "modeler-scene");
      loadState(data, { record: false });
      reconcileTextureRobloxIds();
    } finally {
      isProjectLoading = false;
    }
    setCurrentSceneAsHistoryBaseline();
    log(`Loaded legacy scene ${fileName}.`);
    return;
  }
  throw new Error("Project must be a modeler project file or a saved scene JSON.");
}

async function tryLoadPendingProjectFromHost() {
  try {
    const response = await fetch("/__modeler/open-project", { cache: "no-store" });
    if (response.status === 204 || response.status === 404) return false;
    if (!response.ok) return false;
    const payload = await response.json();
    if (!payload) return false;
    const rawText = typeof payload.text === "string" ? payload.text : "";
    const data = payload.data && typeof payload.data === "object"
      ? payload.data
      : (rawText ? JSON.parse(rawText) : null);
    if (!data) return false;
    loadProjectData(data, payload.fileName || "modeler-project.modelerproj");
    return true;
  } catch (error) {
    return false;
  }
}

async function detectLocalHost() {
  if (!els.stopServerBtn) return false;
  els.stopServerBtn.hidden = true;
  els.stopServerBtn.setAttribute("aria-hidden", "true");
  if (!/^https?:$/.test(window.location.protocol)) return false;
  try {
    const response = await fetch("/__ping", { cache: "no-store" });
    const available = response.ok && (await response.text()).trim() === "ok";
    els.stopServerBtn.hidden = !available;
    els.stopServerBtn.setAttribute("aria-hidden", String(!available));
    return available;
  } catch {
    return false;
  }
}

function showShutdownScreen() {
  document.body.innerHTML = `
    <div style="height:100vh;display:grid;place-items:center;background:#101214;color:#eef2f3;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:24px;">
      <div style="max-width:520px;text-align:center;">
        <div style="width:56px;height:56px;border-radius:14px;margin:0 auto 18px;background:linear-gradient(135deg,#40c7a5,#e1b14b);display:grid;place-items:center;color:#07110e;font-weight:800;font-size:26px;">3D</div>
        <h1 style="margin:0 0 10px;font-size:28px;">3D Model Studio is stopped</h1>
        <p style="margin:0;color:#aeb8bc;font-size:16px;line-height:1.5;">The local server has been shut down. You can close this browser window now, or launch the studio again from the shortcut when you want it back.</p>
      </div>
    </div>
  `;
}

async function shutdownServerAndCloseApp() {
  if (els.stopServerBtn) els.stopServerBtn.disabled = true;
  log("Stopping local app server...");
  try {
    await fetch("/__shutdown", { method: "POST", cache: "no-store", keepalive: true });
  } catch (error) {
    log(`Stop request sent. The app window may need to be closed manually: ${error.message}`);
  }
  showShutdownScreen();
  setTimeout(() => {
    try {
      window.open("", "_self");
      window.close();
    } catch (error) {
      // Ignore: many browsers disallow closing tabs that were not script-opened.
    }
  }, 80);
  setTimeout(() => {
    try {
      if (!window.closed) window.location.replace("about:blank");
    } catch (error) {
      // Ignore navigation failures after shutdown.
    }
  }, 240);
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

function normalizeHexColor(value, fallback = null) {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  const compact = raw.startsWith("#") ? raw.slice(1) : raw;
  if (/^[0-9a-fA-F]{3}$/.test(compact)) {
    return `#${compact.split("").map(ch => ch + ch).join("").toUpperCase()}`;
  }
  if (/^[0-9a-fA-F]{6}$/.test(compact)) {
    return `#${compact.toUpperCase()}`;
  }
  return fallback;
}

function renderTree() {
  els.tree.innerHTML = "";
  if (!objects.length) {
    const empty = document.createElement("div");
    empty.className = "api-note";
    empty.textContent = "No meshes yet.";
    els.tree.append(empty);
    return;
  }
  const transformTargets = transformTargetObjects();

  const buildMeshRow = (mesh) => {
    const row = document.createElement("div");
    const rowType = mesh.userData.textureUrl ? "texture" : (mesh.userData.geometry ? "mesh" : mesh.userData.shape);
    const swatchColor = mesh.userData.textureUrl ? (mesh.userData.textureDisplayColor || mesh.userData.color) : mesh.userData.color;
    const linkColor = mesh.userData.linkColor || "#6fb8ff";
    const materialLabel = materialRulePill(mesh.userData.materialRule || "auto");
    row.className = `object-row child${mesh === selected || activeGroupIds.includes(mesh.userData.id) || (transformTargets.length > 1 && checkedIds.has(mesh.userData.id)) ? " selected" : ""}${mesh.userData.hidden ? " hidden-row" : ""}`;
    row.innerHTML = `<input class="part-check" type="checkbox" aria-label="Select ${mesh.name}"><label class="row-toggle link-toggle" title="Link ${mesh.name} with the current multi-selection"><input class="link-check" type="checkbox" aria-label="Link ${mesh.name}"><span>Link</span></label><label class="hide-toggle" title="Hide or show ${mesh.name}"><input class="hide-check" type="checkbox" aria-label="Hide ${mesh.name}"><span>Hide</span></label><span class="swatch" style="background:${swatchColor}"></span><span class="mesh-name"></span><small title="${materialLabel}">${rowType}</small><button class="mesh-details-btn" type="button" title="Open mesh details for ${mesh.name}">...</button>`;
    row.children[0].checked = checkedIds.has(mesh.userData.id);
    row.children[1].querySelector("input").checked = !!mesh.userData.linkId;
    row.children[1].classList.toggle("linked", !!mesh.userData.linkId);
    row.children[1].style.setProperty("--link-color", linkColor);
    row.children[1].querySelector("input").style.accentColor = linkColor;
    row.children[2].querySelector("input").checked = !!mesh.userData.hidden;
    row.children[4].textContent = mesh.name;
    row.children[4].title = mesh.name;
    row.children[0].addEventListener("click", event => event.stopPropagation());
    row.children[0].addEventListener("change", event => setChecked(mesh, event.target.checked));
    row.children[1].addEventListener("click", event => event.stopPropagation());
    row.children[1].querySelector("input").addEventListener("change", event => {
      event.stopPropagation();
      recordHistory(event.target.checked ? "link parts" : "unlink part");
      setLinked(mesh, event.target.checked);
    });
    row.children[2].addEventListener("click", event => event.stopPropagation());
    row.children[2].querySelector("input").addEventListener("change", event => {
      event.stopPropagation();
      const targets = hideTargetObjects(mesh);
      const actionLabel = `${event.target.checked ? "hide" : "show"} ${targets.length === 1 ? "part" : "parts"}`;
      recordHistory(actionLabel);
      setHiddenTargets(targets, event.target.checked);
      log(`${event.target.checked ? "Hid" : "Showed"} ${targets.length} part${targets.length === 1 ? "" : "s"}.`, {
        targets: targets.map(target => target.name),
        mode: checkedIds.has(mesh.userData.id) ? "checked-subset" : (linkedObjects(mesh).length > 1 ? "linked-group" : "single")
      });
    });
    row.children[6].addEventListener("click", event => {
      event.stopPropagation();
      openMeshDetails(mesh.userData.id);
    });
    row.addEventListener("click", event => selectObject(mesh, { append: event.shiftKey }));
    return row;
  };

  const buildPersistentGroup = (record, depth = 0) => {
    const meshes = descendantMeshesForGroup(record.id);
    const directMeshes = meshesDirectInGroup(record.id);
    const children = childGroupRecords(record.id);
    const groupWrap = document.createElement("div");
    groupWrap.className = "tree-group";
    if (depth) groupWrap.style.marginLeft = `${depth * 14}px`;

    const header = document.createElement("div");
    header.className = "tree-group-header";
    header.innerHTML = `<input class="part-check group-check" type="checkbox" aria-label="Toggle ${record.name} group"><span class="tree-group-name"></span><span></span><small class="tree-group-count"></small><button class="group-only-btn" type="button">Only</button>`;
    const groupCheck = header.children[0];
    const groupNameEl = header.children[1];
    const groupCountEl = header.children[3];
    const groupOnlyBtn = header.children[4];
    const checkedCount = meshes.filter(mesh => checkedIds.has(mesh.userData.id)).length;
    groupCheck.checked = checkedCount === meshes.length;
    groupCheck.indeterminate = checkedCount > 0 && checkedCount < meshes.length;
    groupNameEl.textContent = record.name;
    header.classList.toggle("selected", selectedGroupRecordId === record.id);
    groupCountEl.textContent = `${meshes.length} item${meshes.length === 1 ? "" : "s"}`;
    groupCheck.addEventListener("click", event => event.stopPropagation());
    groupCheck.addEventListener("change", event => setCheckedMeshes(meshes, event.target.checked));
    groupNameEl.title = record.name;
    groupNameEl.addEventListener("dblclick", event => {
      event.stopPropagation();
      openGroupEditor(record.id);
    });
    groupOnlyBtn.addEventListener("click", event => {
      event.stopPropagation();
      selectGroupRecord(record.id);
      log(`Selected only group ${record.name}.`, { count: meshes.length });
    });
    header.addEventListener("click", () => selectGroupRecord(record.id));
    groupWrap.append(header);

    for (const child of children) groupWrap.append(buildPersistentGroup(child, depth + 1));
    for (const mesh of directMeshes) groupWrap.append(buildMeshRow(mesh));
    return groupWrap;
  }

  for (const record of childGroupRecords(null)) els.tree.append(buildPersistentGroup(record, 0));

  for (const [groupName, meshes] of sceneGroups()) {
    const groupWrap = document.createElement("div");
    groupWrap.className = "tree-group";
    const header = document.createElement("div");
    header.className = "tree-group-header";
    header.innerHTML = `<input class="part-check group-check" type="checkbox" aria-label="Toggle ${groupName} group"><span class="tree-group-name"></span><span></span><small class="tree-group-count"></small><button class="group-only-btn" type="button">Only</button>`;
    const groupCheck = header.children[0];
    const groupNameEl = header.children[1];
    const groupCountEl = header.children[3];
    const groupOnlyBtn = header.children[4];
    const checkedCount = meshes.filter(mesh => checkedIds.has(mesh.userData.id)).length;
    groupCheck.checked = checkedCount === meshes.length;
    groupCheck.indeterminate = checkedCount > 0 && checkedCount < meshes.length;
    groupNameEl.textContent = groupName;
    groupCountEl.textContent = `${meshes.length} item${meshes.length === 1 ? "" : "s"}`;
    groupCheck.addEventListener("click", event => event.stopPropagation());
    groupCheck.addEventListener("change", event => setCheckedMeshes(meshes, event.target.checked));
    groupOnlyBtn.addEventListener("click", event => {
      event.stopPropagation();
      setCheckedMeshes(meshes, true, { replace: true });
      log(`Checked only ${groupName} group.`, { count: meshes.length });
    });
    header.addEventListener("click", () => setCheckedMeshes(meshes, true, { replace: true }));
    groupWrap.append(header);
    for (const mesh of meshes) groupWrap.append(buildMeshRow(mesh));
    els.tree.append(groupWrap);
  }
}

function syncInspector() {
  const groupObjects = transformTargetObjects();
  const pivotTargets = pivotManagedObjects();
  const groupMode = pivotTargets.length > 0 && transform.object === groupPivot;
  const disabled = !selected && !groupMode;
  for (const input of document.querySelectorAll(".props input, .props button, .props select")) input.disabled = disabled;
  if (groupMode) {
    syncTextureButtonLabel();
    const label = pivotTargets.length > 1 ? `${pivotEditMode ? "Pivot" : "Group"} (${pivotTargets.length} parts)` : `${pivotEditMode ? "Pivot" : "Part"} (${pivotTargets[0].name})`;
    els.nameInput.value = label;
    els.posX.value = round(groupPivot.position.x);
    els.posY.value = round(groupPivot.position.y);
    els.posZ.value = round(groupPivot.position.z);
    els.rotX.value = round(THREE.MathUtils.radToDeg(groupPivot.rotation.x));
    els.rotY.value = round(THREE.MathUtils.radToDeg(groupPivot.rotation.y));
    els.rotZ.value = round(THREE.MathUtils.radToDeg(groupPivot.rotation.z));
    els.scaleX.value = round(groupPivot.scale.x);
    els.scaleY.value = round(groupPivot.scale.y);
    els.scaleZ.value = round(groupPivot.scale.z);
    els.colorInput.value = "#40c7a5";
    els.colorHexInput.value = "#40C7A5";
    els.roughInput.value = .6;
    els.roughValue.value = "0.60";
    els.textureName.textContent = pivotEditMode
      ? (pivotTargets.length > 1 ? "Shared pivot edit mode" : "Single-part pivot edit mode")
      : (pivotTargets.length > 1 ? "Shared checked-parts transform" : "Single-part custom pivot transform");
    els.cutSideSelect.disabled = true;
    els.cutAmountInput.disabled = true;
    els.cutMeshBtn.disabled = true;
    return;
  }
  if (!selected) {
    syncTextureButtonLabel();
    els.nameInput.value = "";
    els.colorHexInput.value = "";
    els.textureName.textContent = "No texture";
    els.cutSideSelect.disabled = true;
    els.cutAmountInput.disabled = true;
    els.cutMeshBtn.disabled = true;
    return;
  }
  syncTextureButtonLabel();
  els.cutSideSelect.disabled = false;
  els.cutAmountInput.disabled = false;
  els.cutMeshBtn.disabled = false;
  els.nameInput.value = selected.name;
  els.posX.value = round(selected.position.x);
  els.posY.value = round(selected.position.y);
  els.posZ.value = round(selected.position.z);
  els.rotX.value = round(THREE.MathUtils.radToDeg(selected.rotation.x));
  els.rotY.value = round(THREE.MathUtils.radToDeg(selected.rotation.y));
  els.rotZ.value = round(THREE.MathUtils.radToDeg(selected.rotation.z));
  els.scaleX.value = round(selected.scale.x);
  els.scaleY.value = round(selected.scale.y);
  els.scaleZ.value = round(selected.scale.z);
  els.colorInput.value = `#${selected.material.color.getHexString()}`;
  els.colorHexInput.value = `#${selected.material.color.getHexString()}`.toUpperCase();
  els.roughInput.value = selected.material.roughness;
  els.roughValue.value = Number(selected.material.roughness).toFixed(2);
  if (selected.userData.cuts?.bottom !== undefined) {
    els.cutSideSelect.value = "bottom";
    els.cutAmountInput.value = selected.userData.cuts.bottom;
  } else if (selected.userData.cuts?.top !== undefined) {
    els.cutSideSelect.value = "top";
    els.cutAmountInput.value = selected.userData.cuts.top;
  }
  const textureLabel = selected.userData.textureName || (selected.material.map ? "Texture" : "No texture");
  els.textureName.textContent = selected.material.map ? `${textureLabel} (${selected.userData.textureFlipY ?? true ? "flip V" : "normal V"}, rot ${normalizeTextureRotation(selected.userData.textureRotation || 0)} deg)` : textureLabel;
}

function inspectorNumber(input, fallback, { min = null } = {}) {
  if (String(input?.value ?? "").trim() === "") return fallback;
  const value = Number(input?.value);
  if (!Number.isFinite(value)) return fallback;
  return min === null ? value : Math.max(min, value);
}

function applyInspector({ record = true } = {}) {
  const groupObjects = transformTargetObjects();
  const pivotTargets = pivotManagedObjects();
  if (pivotTargets.length > 0 && transform.object === groupPivot) {
    if (record) recordHistory(pivotTargets.length > 1 ? "group inspector" : "pivot inspector");
    const nextPosition = new THREE.Vector3(
      inspectorNumber(els.posX, groupPivot.position.x),
      inspectorNumber(els.posY, groupPivot.position.y),
      inspectorNumber(els.posZ, groupPivot.position.z)
    );
    if (pivotEditMode) {
      groupPivot.position.copy(nextPosition);
      groupPivot.updateMatrixWorld(true);
      lastGroupMatrix.copy(groupPivot.matrixWorld);
      setStoredPivotForObjects(pivotTargets, groupPivot.position);
      updateAll();
      return;
    }
    groupPivot.position.copy(nextPosition);
    groupPivot.rotation.set(
      THREE.MathUtils.degToRad(inspectorNumber(els.rotX, THREE.MathUtils.radToDeg(groupPivot.rotation.x))),
      THREE.MathUtils.degToRad(inspectorNumber(els.rotY, THREE.MathUtils.radToDeg(groupPivot.rotation.y))),
      THREE.MathUtils.degToRad(inspectorNumber(els.rotZ, THREE.MathUtils.radToDeg(groupPivot.rotation.z)))
    );
    groupPivot.scale.set(
      inspectorNumber(els.scaleX, groupPivot.scale.x, { min: .05 }),
      inspectorNumber(els.scaleY, groupPivot.scale.y, { min: .05 }),
      inspectorNumber(els.scaleZ, groupPivot.scale.z, { min: .05 })
    );
    groupPivot.updateMatrixWorld(true);
    const delta = groupPivot.matrixWorld.clone().multiply(lastGroupMatrix.clone().invert());
    for (const mesh of pivotTargets) mesh.applyMatrix4(delta);
    lastGroupMatrix.copy(groupPivot.matrixWorld);
    setStoredPivotForObjects(pivotTargets, groupPivot.position);
    updateAll();
    return;
  }
  if (!selected) return;
  if (record) recordHistory("inspector");
  const normalizedColor = normalizeHexColor(els.colorHexInput?.value || els.colorInput.value, normalizeHexColor(els.colorInput.value, "#40C7A5"));
  if (!normalizedColor) return;
  els.colorInput.value = normalizedColor;
  els.colorHexInput.value = normalizedColor;
  selected.name = els.nameInput.value.trim() || selected.name;
  selected.position.set(
    inspectorNumber(els.posX, selected.position.x),
    inspectorNumber(els.posY, selected.position.y),
    inspectorNumber(els.posZ, selected.position.z)
  );
  selected.rotation.set(
    THREE.MathUtils.degToRad(inspectorNumber(els.rotX, THREE.MathUtils.radToDeg(selected.rotation.x))),
    THREE.MathUtils.degToRad(inspectorNumber(els.rotY, THREE.MathUtils.radToDeg(selected.rotation.y))),
    THREE.MathUtils.degToRad(inspectorNumber(els.rotZ, THREE.MathUtils.radToDeg(selected.rotation.z)))
  );
  selected.scale.set(
    inspectorNumber(els.scaleX, selected.scale.x, { min: .05 }),
    inspectorNumber(els.scaleY, selected.scale.y, { min: .05 }),
    inspectorNumber(els.scaleZ, selected.scale.z, { min: .05 })
  );
  selected.material.color.set(normalizedColor);
  selected.material.roughness = +els.roughInput.value;
  selected.material.transparent = false;
  selected.material.opacity = 1;
  selected.material.wireframe = false;
  selected.material.depthWrite = true;
  selected.material.needsUpdate = true;
  selected.userData.color = normalizedColor;
  selected.userData.roughness = +els.roughInput.value;
  els.roughValue.value = Number(selected.material.roughness).toFixed(2);
  updateAll();
}

function importJsonData(data, fileName = "JSON") {
  if (data?.scene?.objects) {
    loadProjectData(data, fileName);
    return;
  }
  if (data?.objects) {
    loadProjectData(data, fileName);
    return;
  }
  throw new Error("JSON must contain objects or a saved project scene with objects.");
}

function findObject(id) {
  return objects.find(mesh => mesh.userData.id === id || mesh.name === id);
}

function deleteSelection() {
  const groupObjects = transformTargetObjects();
  if (!selected && groupObjects.length > 1) {
    recordHistory("delete group");
    for (const mesh of groupObjects) removeObject(mesh, { record: false });
    activeGroupIds = [];
    checkedIds.clear();
    currentTransformTargetKey = "";
    transform.detach();
    updateAll();
    return;
  }
  removeObject(selected);
}

function updateState() {
  const totalObjects = objects.length;
  const transformTargets = transformTargetObjects();
  const selectedName = selected?.name || (transformTargets.length > 1 ? `${pivotEditMode ? "Pivot" : "Group"} (${transformTargets.length})` : "None");
  const markerCount = markerHelpers.length;
  const triangleCount = selectedFaces.length;
  els.stateOutput.textContent = `Scene: ${totalObjects} object${totalObjects === 1 ? "" : "s"} | Selected mesh: ${selectedName} | Selected triangles: ${triangleCount} | Marks: ${markerCount}`;
}

function updateAll() {
  syncSpotLightRig();
  updateTriangleHelpers();
  updateSelectionOutline();
  updateOpeningPickGuide();
  renderTree();
  syncInspectorSoft();
  updateState();
}

function syncInspectorSoft() {
  if (document.activeElement?.matches(".props input")) return;
  if (selected || transformTargetObjects().length > 1) syncInspector();
}

function log(message, data) {
  const time = new Date().toLocaleTimeString();
  els.log.textContent = `[${time}] ${message}${data ? "\n" + JSON.stringify(data, null, 2) : ""}\n\n${els.log.textContent}`.slice(0, 5000);
}

function download(name, text, type) {
  const blob = new Blob([text], { type });
  downloadBlob(name, blob);
}

function downloadBlob(name, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

const utf8Encoder = new TextEncoder();
let crc32Table = null;

function ensureCrc32Table() {
  if (crc32Table) return crc32Table;
  crc32Table = new Uint32Array(256);
  for (let index = 0; index < 256; index++) {
    let value = index;
    for (let bit = 0; bit < 8; bit++) {
      value = (value & 1) ? (0xEDB88320 ^ (value >>> 1)) : (value >>> 1);
    }
    crc32Table[index] = value >>> 0;
  }
  return crc32Table;
}

function crc32(bytes) {
  const table = ensureCrc32Table();
  let value = 0xFFFFFFFF;
  for (let index = 0; index < bytes.length; index++) {
    value = table[(value ^ bytes[index]) & 0xFF] ^ (value >>> 8);
  }
  return (value ^ 0xFFFFFFFF) >>> 0;
}

function zipPath(path = "") {
  return String(path || "").replace(/\\/g, "/").replace(/^\/+/, "");
}

function zipTimestampParts(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const month = Math.min(12, Math.max(1, date.getMonth() + 1));
  const day = Math.min(31, Math.max(1, date.getDate()));
  const hours = Math.min(23, Math.max(0, date.getHours()));
  const minutes = Math.min(59, Math.max(0, date.getMinutes()));
  const seconds = Math.min(59, Math.max(0, date.getSeconds()));
  return {
    time: ((hours & 0x1F) << 11) | ((minutes & 0x3F) << 5) | ((Math.floor(seconds / 2)) & 0x1F),
    date: (((year - 1980) & 0x7F) << 9) | ((month & 0x0F) << 5) | (day & 0x1F)
  };
}

function zipBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return utf8Encoder.encode(String(value ?? ""));
}

function dataUrlToBytes(dataUrl = "") {
  const match = String(dataUrl || "").match(/^data:([^;,]+)?(;base64)?,(.*)$/);
  if (!match) return null;
  const isBase64 = !!match[2];
  const payload = match[3] || "";
  const binary = isBase64 ? atob(payload) : decodeURIComponent(payload);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function imageExtensionFromDataUrl(dataUrl = "", fallbackName = "texture.png") {
  const mime = String(dataUrl || "").match(/^data:([^;,]+)/)?.[1]?.toLowerCase() || "";
  if (mime.includes("jpeg") || mime.includes("jpg")) return ".jpg";
  if (mime.includes("webp")) return ".webp";
  if (mime.includes("bmp")) return ".bmp";
  if (mime.includes("gif")) return ".gif";
  const ext = String(fallbackName || "").match(/\.(png|jpe?g|webp|bmp|gif)$/i)?.[0];
  return ext ? ext.toLowerCase().replace(".jpeg", ".jpg") : ".png";
}

function writeLocalZipHeader(view, { time, date, crc, size, nameLength }) {
  view.setUint16(4, 20, true);
  view.setUint16(6, 0x0800, true);
  view.setUint16(8, 0, true);
  view.setUint16(10, time, true);
  view.setUint16(12, date, true);
  view.setUint32(14, crc, true);
  view.setUint32(18, size, true);
  view.setUint32(22, size, true);
  view.setUint16(26, nameLength, true);
  view.setUint16(28, 0, true);
}

function writeCentralZipHeader(view, { time, date, crc, size, nameLength, localOffset }) {
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, 0x0800, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, time, true);
  view.setUint16(14, date, true);
  view.setUint32(16, crc, true);
  view.setUint32(20, size, true);
  view.setUint32(24, size, true);
  view.setUint16(28, nameLength, true);
  view.setUint16(30, 0, true);
  view.setUint16(32, 0, true);
  view.setUint16(34, 0, true);
  view.setUint16(36, 0, true);
  view.setUint32(38, 0, true);
  view.setUint32(42, localOffset, true);
}

function makeZip(entries = []) {
  const normalizedEntries = entries.map(entry => {
    const name = zipPath(entry.name);
    const nameBytes = utf8Encoder.encode(name);
    const dataBytes = zipBytes(entry.data);
    const { time, date } = zipTimestampParts(entry.modifiedAt || new Date());
    return {
      name,
      nameBytes,
      dataBytes,
      crc: crc32(dataBytes),
      time,
      date
    };
  });

  const chunks = [];
  const centralChunks = [];
  let offset = 0;

  for (const entry of normalizedEntries) {
    const localHeader = new Uint8Array(30);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034B50, true);
    writeLocalZipHeader(localView, {
      time: entry.time,
      date: entry.date,
      crc: entry.crc,
      size: entry.dataBytes.length,
      nameLength: entry.nameBytes.length
    });
    chunks.push(localHeader, entry.nameBytes, entry.dataBytes);

    const centralHeader = new Uint8Array(46);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014B50, true);
    writeCentralZipHeader(centralView, {
      time: entry.time,
      date: entry.date,
      crc: entry.crc,
      size: entry.dataBytes.length,
      nameLength: entry.nameBytes.length,
      localOffset: offset
    });
    centralChunks.push(centralHeader, entry.nameBytes);

    offset += localHeader.length + entry.nameBytes.length + entry.dataBytes.length;
  }

  const centralSize = centralChunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const endHeader = new Uint8Array(22);
  const endView = new DataView(endHeader.buffer);
  endView.setUint32(0, 0x06054B50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, normalizedEntries.length, true);
  endView.setUint16(10, normalizedEntries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  endView.setUint16(20, 0, true);

  return new Blob([...chunks, ...centralChunks, endHeader], { type: "application/zip" });
}

function safeFileName(name, fallback = "mesh") {
  return String(name || fallback)
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || fallback;
}

function luaString(value = "") {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r/g, "\\r").replace(/\n/g, "\\n")}"`;
}

function toLuaLiteral(value, indent = 0) {
  const pad = "  ".repeat(indent);
  const nextPad = "  ".repeat(indent + 1);
  if (value === null || value === undefined) return "nil";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "0";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return luaString(value);
  if (Array.isArray(value)) {
    if (!value.length) return "{}";
    return `{\n${value.map(item => `${nextPad}${toLuaLiteral(item, indent + 1)},`).join("\n")}\n${pad}}`;
  }
  const entries = Object.entries(value);
  if (!entries.length) return "{}";
  return `{\n${entries.map(([key, item]) => `${nextPad}${/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) ? key : `[${luaString(key)}]`} = ${toLuaLiteral(item, indent + 1)},`).join("\n")}\n${pad}}`;
}

function baseNameFromFileName(fileName = "", fallback = "modeler-project") {
  const raw = String(fileName || "").trim();
  if (!raw) return fallback;
  const withoutExtension = raw.replace(/\.(modelerproj(?:\.json)?|json|obj|dae)$/i, "");
  return safeFileName(withoutExtension, fallback);
}

function currentProjectBaseName() {
  const value = els.projectNameInput?.value || "";
  const safe = safeFileName(value, "modeler-project");
  if (els.projectNameInput && els.projectNameInput.value !== safe) els.projectNameInput.value = safe;
  return safe;
}

function swapTriangleVertices(attribute, itemSize) {
  if (!attribute) return;
  const array = attribute.array;
  const stride = itemSize;
  const vertexStride = stride * 3;
  for (let offset = 0; offset + vertexStride - 1 < array.length; offset += vertexStride) {
    for (let componentIndex = 0; componentIndex < stride; componentIndex++) {
      const first = offset + componentIndex;
      const third = offset + stride * 2 + componentIndex;
      const temp = array[first];
      array[first] = array[third];
      array[third] = temp;
    }
  }
  attribute.needsUpdate = true;
}

function currentRobloxAxisMode() {
  return "none";
}

const ROBLOX_PACK_GEOMETRY_MIRROR_AXES = ["z", "x"];

function applyRobloxAxisConversion(geometry, mode = currentRobloxAxisMode()) {
  const scale = {
    none: [1, 1, 1],
    xFlip: [-1, 1, 1],
    zFlip: [1, 1, -1],
    xzFlip: [-1, 1, -1]
  }[mode] || [1, 1, -1];
  geometry.scale(scale[0], scale[1], scale[2]);
  if (scale[0] * scale[1] * scale[2] < 0) {
    swapTriangleVertices(geometry.getAttribute("position"), 3);
    swapTriangleVertices(geometry.getAttribute("uv"), 2);
  }
}

function prepareRobloxMeshGeometry(geometry) {
  if (geometry.getAttribute("normal")) geometry.deleteAttribute("normal");
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}

function mirrorGeometryInPlace(geometry, axis = "x") {
  const index = axisIndex(axis);
  geometry.computeBoundingBox();
  const center = geometry.boundingBox.getCenter(new THREE.Vector3());
  const position = geometry.getAttribute("position");
  for (let i = 0; i < position.count; i++) {
    const value = position.getComponent(i, index);
    position.setComponent(i, index, component(center, index) * 2 - value);
  }
  position.needsUpdate = true;
  swapTriangleVertices(position, 3);
  swapTriangleVertices(geometry.getAttribute("uv"), 2);
  if (geometry.getAttribute("normal")) geometry.deleteAttribute("normal");
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}

function exportReadyMeshPart(mesh, { forRoblox = false, mirrorAxis = null, robloxAxisMode = currentRobloxAxisMode() } = {}) {
  const source = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  mesh.updateMatrixWorld(true);
  const worldMatrix = mesh.matrixWorld.clone();
  source.applyMatrix4(worldMatrix);
  if (Array.isArray(mirrorAxis)) {
    mirrorAxis.forEach(axis => mirrorGeometryInPlace(source, axis));
  } else if (mirrorAxis) {
    mirrorGeometryInPlace(source, mirrorAxis);
  }
  if (forRoblox && robloxAxisMode !== "none") applyRobloxAxisConversion(source, robloxAxisMode);
  source.computeBoundingBox();
  const center = source.boundingBox.getCenter(new THREE.Vector3());
  const bounds = source.boundingBox.clone();
  source.translate(-center.x, -center.y, -center.z);
  if (forRoblox) prepareRobloxMeshGeometry(source);
  const exportMesh = new THREE.Mesh(source, mesh.material.clone());
  exportMesh.name = mesh.name;
  exportMesh.updateMatrixWorld(true);
  return {
    exportMesh,
    center,
    bounds,
    basis: {
      right: [1, 0, 0],
      up: [0, 1, 0],
      forward: [0, 0, 1]
    }
  };
}

function meshGroupChain(mesh, allowedGroupIds = null) {
  const chain = [];
  let currentId = mesh.userData.groupId || null;
  const seen = new Set();
  while (currentId && !seen.has(currentId)) {
    seen.add(currentId);
    const record = groupRecord(currentId);
    if (!record) break;
    if (!allowedGroupIds || allowedGroupIds.has(record.id)) chain.unshift(record);
    currentId = record.parentId || null;
  }
  return chain;
}

function safeHierarchySegment(name, fallback = "part") {
  return String(name || fallback)
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1f.]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || fallback;
}

function hierarchySegmentsForMesh(mesh, allowedGroupIds = null) {
  const groupSegments = meshGroupChain(mesh, allowedGroupIds).map(record => safeHierarchySegment(record.name, "Group"));
  return [...groupSegments, safeHierarchySegment(mesh.name, mesh.userData.id || "part")];
}

function robloxPackExportPrefix() {
  return `rbx_${Date.now().toString(36)}`;
}

function robloxExportId(index, packPrefix = "rbx_pack") {
  return `${packPrefix}_mesh_${String(index + 1).padStart(5, "0")}`;
}

function flattenManifestMeshes(manifest) {
  const meshes = [];
  function visitGroup(node) {
    for (const mesh of node.meshes || []) meshes.push(mesh);
    for (const child of node.children || []) visitGroup(child);
  }
  for (const mesh of manifest.rootMeshes || []) meshes.push(mesh);
  for (const node of manifest.rootGroups || []) visitGroup(node);
  return meshes;
}

function computeRobloxPackFrame(fileEntries) {
  const box = new THREE.Box3();
  for (const entry of fileEntries) {
    if (entry.bounds) box.union(entry.bounds);
  }
  if (box.isEmpty()) {
    return {
      origin: new THREE.Vector3(),
      size: new THREE.Vector3()
    };
  }
  return {
    origin: box.getCenter(new THREE.Vector3()),
    size: box.getSize(new THREE.Vector3())
  };
}

function robloxManifestForTargets(targets, fileEntries, packPrefix) {
  const relevantGroupIds = new Set();
  for (const mesh of targets) {
    for (const record of meshGroupChain(mesh)) relevantGroupIds.add(record.id);
  }
  const packFrame = computeRobloxPackFrame(fileEntries);

  const rootGroups = [];
  const rootMeshes = [];
  const nodeMap = new Map();

  function ensureNode(record) {
    if (!record) return null;
    if (nodeMap.has(record.id)) return nodeMap.get(record.id);
    const node = {
      id: record.id,
      name: record.name,
      meshes: [],
      children: []
    };
    nodeMap.set(record.id, node);
    return node;
  }

  for (const mesh of targets) {
    const entry = fileEntries.find(item => item.mesh.userData.id === mesh.userData.id);
    if (!entry) continue;
    const chain = meshGroupChain(mesh, relevantGroupIds);
    const meshNode = {
      id: mesh.userData.id,
      exportId: entry.exportId,
      name: mesh.name,
      importName: entry.importName,
      baseImportName: entry.baseImportName || entry.importName,
      file: entry.fileName,
      position: entry.center.clone().sub(packFrame.origin).toArray().map(round),
      absolutePosition: entry.center.toArray().map(round),
      rotation: [0, 0, 0],
      originalRotation: [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z].map(value => round(THREE.MathUtils.radToDeg(value))),
      scale: [1, 1, 1],
      originalScale: mesh.scale.toArray().map(round),
      pivot: Array.isArray(mesh.userData.pivot) ? mesh.userData.pivot.map(round) : null,
      hidden: !!mesh.userData.hidden,
      textureName: mesh.userData.textureName || null,
      hierarchyPath: entry.pathSegments
    };

    if (!chain.length) {
      rootMeshes.push(meshNode);
      continue;
    }

    let parentNode = null;
    chain.forEach((record, index) => {
      const node = ensureNode(record);
      if (index === 0 && !rootGroups.includes(node)) rootGroups.push(node);
      if (parentNode && !parentNode.children.includes(node)) parentNode.children.push(node);
      parentNode = node;
    });
    parentNode.meshes.push(meshNode);
  }

  return {
    kind: "roblox-model-pack",
    version: 2,
    name: currentProjectBaseName(),
    packId: packPrefix,
    generatedAt: new Date().toISOString(),
    axisMode: currentRobloxAxisMode(),
    geometryMirrorAxes: ROBLOX_PACK_GEOMETRY_MIRROR_AXES,
    packOrigin: packFrame.origin.toArray().map(round),
    packSize: packFrame.size.toArray().map(round),
    notes: [
      "Import every OBJ file as its own MeshPart in Roblox Studio.",
      "Put the imported MeshParts under a folder or model in workspace, then run the companion rebuild script or plugin.",
      "Each OBJ stores centered vertices. The manifest stores the model bounding-box origin plus each mesh offset from that origin, so rebuild is ID-based placement instead of name or orientation guessing.",
      `Roblox Pack OBJ geometry is pre-mirrored around each part center on ${ROBLOX_PACK_GEOMETRY_MIRROR_AXES.map(axis => axis.toUpperCase()).join(", ")} to compensate for Roblox OBJ handedness.`
    ],
    rootGroups,
    rootMeshes
  };
}

function robloxBaseGroupKey(name = "Part") {
  const text = String(name || "Part").trim();
  const stripped = text.replace(/[\s._-]*\d+$/g, "").trim();
  return stripped || text || "Part";
}

function collectRobloxTextureAssignments(manifest) {
  const byGroup = {};
  const byPath = {};

  function visitMesh(entry) {
    if (!entry) return;
    const groupKey = robloxBaseGroupKey(entry.name);
    if (!byGroup[groupKey]) byGroup[groupKey] = entry.textureName || "";
    const pathKey = Array.isArray(entry.hierarchyPath) && entry.hierarchyPath.length
      ? entry.hierarchyPath.join(".")
      : (entry.name || "part");
    if (!byPath[pathKey]) byPath[pathKey] = entry.textureName || "";
  }

  function visitGroup(node) {
    if (!node) return;
    for (const meshEntry of node.meshes || []) visitMesh(meshEntry);
    for (const child of node.children || []) visitGroup(child);
  }

  for (const meshEntry of manifest.rootMeshes || []) visitMesh(meshEntry);
  for (const node of manifest.rootGroups || []) visitGroup(node);

  const sortedGroup = Object.fromEntries(Object.entries(byGroup).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })));
  const sortedPath = Object.fromEntries(Object.entries(byPath).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })));
  return { byGroup: sortedGroup, byPath: sortedPath };
}

function collectRobloxTextureCatalog() {
  syncCurrentTextureRobloxId({ writeInput: true });
  const entries = [...textureLibrary.values()]
    .filter(entry => entry?.name)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
  const catalog = {};
  for (const entry of entries) catalog[entry.name] = normalizeRobloxAssetId(entry.robloxAssetId || "");
  return catalog;
}

function collectRobloxTextureFiles(packRoot) {
  syncCurrentTextureRobloxId({ writeInput: true });
  const zipEntries = [];
  const manifestFiles = {};
  const usedNames = new Set();
  for (const entry of [...textureLibrary.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }))) {
    if (!entry?.name || !/^data:/i.test(entry.dataUrl || "")) continue;
    const bytes = dataUrlToBytes(entry.dataUrl);
    if (!bytes) continue;
    const ext = imageExtensionFromDataUrl(entry.dataUrl, entry.name);
    const base = safeFileName(String(entry.name).replace(/\.(png|jpe?g|webp|bmp|gif)$/i, ""), "texture");
    let fileName = `${base}${ext}`;
    let index = 2;
    while (usedNames.has(fileName.toLowerCase())) {
      fileName = `${base}_${index}${ext}`;
      index++;
    }
    usedNames.add(fileName.toLowerCase());
    const zipPathName = `${packRoot}/textures/${fileName}`;
    zipEntries.push({
      name: zipPathName,
      data: bytes
    });
    manifestFiles[entry.name] = {
      file: `textures/${fileName}`,
      robloxAssetId: normalizeRobloxAssetId(entry.robloxAssetId || "")
    };
  }
  return { zipEntries, manifestFiles };
}

function robloxCommandBarSetupLua(manifest) {
  const manifestLua = toLuaLiteral(manifest, 0);
  const textureAssignments = collectRobloxTextureAssignments(manifest);
  const textureCatalog = collectRobloxTextureCatalog();
  const textureCatalogLua = toLuaLiteral(textureCatalog, 0);
  const textureByGroupLua = toLuaLiteral(textureAssignments.byGroup, 0);
  const textureByPathLua = toLuaLiteral(textureAssignments.byPath, 0);
  return `local textureCatalog = ${textureCatalogLua}
local textureByGroup = ${textureByGroupLua}
local textureByPath = ${textureByPathLua}
local useImportedRotation = false -- OBJ geometry is already exported in final orientation; only apply manifest position.
local manifest = ${manifestLua}

local function info(...)
  print("[3D Model Studio]", ...)
end

local function warnf(...)
  warn("[3D Model Studio]", ...)
end

local function trimText(value)
  return tostring(value or ""):gsub("^%s+", ""):gsub("%s+$", "")
end

local function normalizeName(value)
  local text = tostring(value or "")
  text = text:gsub("%.obj$", "")
  text = text:gsub("%.%.%.$", "")
  text = text:gsub("%.%.%.", "_")
  text = text:gsub("[^%w]+", "_")
  text = text:gsub("_+", "_")
  text = text:gsub("^_+", "")
  text = text:gsub("_+$", "")
  return string.lower(text)
end

local function textureGroupKey(name)
  local text = trimText(name)
  local stripped = text:gsub("[%s%._%-]*%d+$", "")
  stripped = trimText(stripped)
  return stripped ~= "" and stripped or text
end

local function texturePathKey(entry)
  if entry.hierarchyPath and #entry.hierarchyPath > 0 then
return table.concat(entry.hierarchyPath, ".")
  end
  return entry.name
end

local function normalizeTextureAssetId(value)
  local text = trimText(value)
  if text == "" then
return nil
  end
  if text:match("^rbxassetid://") or text:match("^rbxasset://") then
return text
  end
  if text:match("^%d+$") then
return "rbxassetid://" .. text
  end
  return text
end

local function resolveTextureReference(value)
  local text = trimText(value)
  if text == "" then
return nil
  end
  local catalogValue = textureCatalog[text]
  if catalogValue ~= nil then
local resolvedCatalog = normalizeTextureAssetId(catalogValue)
if resolvedCatalog then
  return resolvedCatalog
end
  end
  return normalizeTextureAssetId(text)
end

local function applyTextureFields(part, entry)
  local textureId = resolveTextureReference(textureByPath[texturePathKey(entry)] or textureByGroup[textureGroupKey(entry.name)])
  if not textureId then
return
  end
  pcall(function()
part.TextureID = textureId
  end)
  pcall(function()
part.TextureContent = textureId
  end)
  part:SetAttribute("ModelerTextureId", textureId)
end

local function robloxVector(values)
  return Vector3.new(
values and values[1] or 0,
values and values[2] or 0,
values and values[3] or 0
  )
end

local function targetCFrame(entry)
  return CFrame.new(robloxVector(manifest.packOrigin) + robloxVector(entry.position))
end

local function isBuiltPack(instance)
  local current = instance
  while current do
if current:GetAttribute("ModelerBuiltPack") == manifest.packId or current:GetAttribute("ModelerBuiltPackName") == manifest.name then
  return true
end
current = current.Parent
  end
  return false
end

local function allEntries()
  local entries = {}
  local function addEntry(entry)
if entry then
  table.insert(entries, entry)
end
  end
  local function visitGroup(node)
if not node then
  return
end
for _, meshEntry in ipairs(node.meshes or {}) do
  addEntry(meshEntry)
end
for _, child in ipairs(node.children or {}) do
  visitGroup(child)
end
  end
  for _, node in ipairs(manifest.rootGroups or {}) do
visitGroup(node)
  end
  for _, meshEntry in ipairs(manifest.rootMeshes or {}) do
addEntry(meshEntry)
  end
  return entries
end

local entries = allEntries()

local function entryTokens(entry)
  local tokens = {}
  local function add(value)
if value and tostring(value) ~= "" then
  table.insert(tokens, normalizeName(value))
end
  end
  add(entry.exportId)
  add(entry.importName)
  add(entry.file)
  add((entry.file or ""):gsub("%.obj$", ""))
  return tokens
end

local function nameMatchesEntry(name, entry)
  local normalized = normalizeName(name)
  for _, token in ipairs(entryTokens(entry)) do
if normalized == token or string.sub(normalized, 1, #token + 1) == token .. "_" or string.find(normalized, token, 1, true) then
  return true
end
  end
  return false
end

local function singleBasePartInside(instance)
  if not instance then
return nil
  end
  if instance:IsA("BasePart") then
return instance
  end
  if not (instance:IsA("Model") or instance:IsA("Folder")) then
return nil
  end
  local found = nil
  local count = 0
  for _, descendant in ipairs(instance:GetDescendants()) do
if descendant:IsA("BasePart") then
  found = found or descendant
  count += 1
end
  end
  if count == 1 then
return found
  end
  return nil
end

local function findSourcePart(entry)
  local directCandidates = {}
  for _, child in ipairs(workspace:GetChildren()) do
table.insert(directCandidates, child)
  end
  for _, descendant in ipairs(workspace:GetDescendants()) do
table.insert(directCandidates, descendant)
  end

  for _, instance in ipairs(directCandidates) do
if not isBuiltPack(instance) and nameMatchesEntry(instance.Name, entry) then
  local part = singleBasePartInside(instance)
  if part then
    return part
  end
end
  end

  for _, instance in ipairs(directCandidates) do
if not isBuiltPack(instance) and instance:IsA("BasePart") and instance.Name == "default" and instance.Parent and nameMatchesEntry(instance.Parent.Name, entry) then
  return instance
end
  end

  return nil
end

local function importedRotation(part)
  if not part then
return CFrame.new()
  end
  return part.CFrame - part.CFrame.Position
end

local function diagnose()
  local found = 0
  local missing = {}
  for _, entry in ipairs(entries) do
local source = findSourcePart(entry)
if source then
  found += 1
  info("FOUND", entry.importName or entry.exportId or entry.name, "=>", source:GetFullName(), "target", tostring(targetCFrame(entry).Position))
else
  table.insert(missing, entry.importName or entry.exportId or entry.file or entry.name)
  warnf("MISSING", entry.importName or entry.exportId or entry.file or entry.name)
end
  end
  info("Diagnose found", found, "of", #entries, "imported OBJ parts.")
  return found, missing
end

local function removeOldBuiltPack()
  for _, child in ipairs(workspace:GetChildren()) do
if child:GetAttribute("ModelerBuiltPack") == manifest.packId or child:GetAttribute("ModelerBuiltPackName") == manifest.name then
  child:Destroy()
end
  end
end

local function attachMesh(entry, parent)
  local source = findSourcePart(entry)
  assert(source, "Missing imported OBJ for " .. tostring(entry.importName or entry.exportId or entry.file or entry.name))
  local part = source:Clone()
  part.Name = entry.name
  if useImportedRotation then
part.CFrame = targetCFrame(entry) * importedRotation(source)
  else
part.CFrame = targetCFrame(entry)
  end
  part:SetAttribute("ModelerSourceFile", entry.file or "")
  part:SetAttribute("ModelerExportId", entry.exportId or "")
  part:SetAttribute("ModelerHierarchyPath", texturePathKey(entry))
  applyTextureFields(part, entry)
  part.Parent = parent
  return part
end

local function buildGroup(node, parent)
  local model = Instance.new("Model")
  model.Name = node.name
  model.Parent = parent
  for _, meshEntry in ipairs(node.meshes or {}) do
attachMesh(meshEntry, model)
  end
  for _, child in ipairs(node.children or {}) do
buildGroup(child, model)
  end
  return model
end

local function rebuild()
  local found, missing = diagnose()
  if #missing > 0 then
error("Cannot rebuild. Missing " .. tostring(#missing) .. " of " .. tostring(#entries) .. " imported OBJ parts. Import every OBJ from the pack, then run this script again.")
  end
  removeOldBuiltPack()
  local root = Instance.new("Model")
  root.Name = manifest.name .. "_assembled"
  root:SetAttribute("ModelerBuiltPack", manifest.packId or manifest.name)
  root:SetAttribute("ModelerBuiltPackName", manifest.name)
  root.Parent = workspace
  for _, node in ipairs(manifest.rootGroups or {}) do
buildGroup(node, root)
  end
  for _, meshEntry in ipairs(manifest.rootMeshes or {}) do
attachMesh(meshEntry, root)
  end
  info("Built", root:GetFullName(), "from", found, "imported OBJ parts.")
  return root
end

_G.ModelerRebuildPack = rebuild
_G.ModelerDiagnoseImports = diagnose

local ok, result = pcall(rebuild)
if not ok then
  warnf("FAILED:", result)
  error(result)
end
`;
}

function robloxSetupLua(manifest) {
  return robloxCommandBarSetupLua(manifest);
  const manifestLua = toLuaLiteral(manifest, 0);
  const textureAssignments = collectRobloxTextureAssignments(manifest);
  const textureCatalog = collectRobloxTextureCatalog();
  const textureCatalogLua = toLuaLiteral(textureCatalog, 0);
  const textureByGroupLua = toLuaLiteral(textureAssignments.byGroup, 0);
  const textureByPathLua = toLuaLiteral(textureAssignments.byPath, 0);
  return `-- 3D Model Studio Roblox placement helper
-- Edit the config blocks below first, then run the script.
-- textureCatalog: replace each texture name with the correct Roblox asset id once
-- textureByGroup: same texture name for every part with the same base name
-- textureByPath: exact texture name override for one specific hierarchy path
-- createPlacementMarkers: builds visible helper markers for every part target
-- After running once, command-bar helpers are available:
-- _G.ModelerRebuildPack(), _G.ModelerDiagnoseImports(), _G.ModelerShowTargetMarkers(), _G.ModelerClearTargetMarkers()

local textureCatalog = ${textureCatalogLua}
local textureByGroup = ${textureByGroupLua}
local textureByPath = ${textureByPathLua}
local createPlacementMarkers = false
local useImportedRotation = false -- OBJ geometry is already exported in final orientation; only apply manifest position.
local markerFolderName = "ModelerPlacementMarkers"
local markerSize = 0.35
local markerTransparency = 0.2
local markerLabelMode = "short" -- "short", "path", or "none"
local markerLabelScale = 0.75
local markerLabelStagger = 0.18

local manifest = ${manifestLua}
local okSelection, Selection = pcall(function()
  return game:GetService("Selection")
end)

assert(okSelection and Selection, "3D Model Studio: this helper must be run from the Roblox Studio Command Bar or a Studio plugin.")

local function info(...)
  print("[3D Model Studio]", ...)
end

local function warnf(...)
  warn("[3D Model Studio]", ...)
end

local function isBuiltPackSelection(instance)
  local current = instance
  while current do
if current:IsA("Model") and (current:GetAttribute("ModelerBuiltPack") == manifest.name or current.Name == manifest.name) then
  return true
end
current = current.Parent
  end
  return false
end

local function collectManifestExportIds()
  local ids = {}
  local function addMesh(entry)
if entry and entry.exportId then
  table.insert(ids, tostring(entry.exportId):gsub("%.obj$", ""))
end
  end
  local function visitGroup(node)
if not node then
  return
end
for _, meshEntry in ipairs(node.meshes or {}) do
  addMesh(meshEntry)
end
for _, child in ipairs(node.children or {}) do
  visitGroup(child)
end
  end
  for _, node in ipairs(manifest.rootGroups or {}) do
visitGroup(node)
  end
  for _, meshEntry in ipairs(manifest.rootMeshes or {}) do
addMesh(meshEntry)
  end
  return ids
end

local manifestExportIds = collectManifestExportIds()

local function instanceNameMatchesExportId(instance, exportId)
  local name = string.lower(tostring(instance and instance.Name or "")):gsub("%.obj$", "")
  local token = string.lower(tostring(exportId or "")):gsub("%.obj$", "")
  if token == "" then
return false
  end
  return name == token or string.sub(name, 1, #token + 1) == token .. "_" or string.find(name, token, 1, true) ~= nil
end

local function countExportIdMatches(root)
  if not root then
return 0
  end
  local seen = {}
  local count = 0
  local function check(instance)
for _, exportId in ipairs(manifestExportIds) do
  if not seen[exportId] and instanceNameMatchesExportId(instance, exportId) then
    seen[exportId] = true
    count += 1
    break
  end
end
  end
  check(root)
  for _, descendant in ipairs(root:GetDescendants()) do
check(descendant)
  end
  return count
end

local function bestImportRootFromWorkspace()
  local bestRoot = nil
  local bestCount = 0
  local workspaceCount = countExportIdMatches(workspace)
  if workspaceCount > 0 then
bestRoot = workspace
bestCount = workspaceCount
  end
  for _, child in ipairs(workspace:GetChildren()) do
if not isBuiltPackSelection(child) then
  local count = countExportIdMatches(child)
  if count > bestCount then
    bestRoot = child
    bestCount = count
  end
end
  end
  return bestRoot, bestCount
end

local function resolveImportedRoot()
  local expectedCount = #manifestExportIds
  local selected = Selection:Get()[1]
  if selected then
if isBuiltPackSelection(selected) then
  warnf("Selected object is the rebuilt model, not the imported source. Searching Workspace for imported OBJ IDs.")
else
  local selectedCount = countExportIdMatches(selected)
  if expectedCount <= 1 or selectedCount >= expectedCount then
    info("Using selected imported root:", selected:GetFullName(), "matched", selectedCount, "of", expectedCount, "OBJ IDs")
    return selected
  end
  local bestRoot, bestCount = bestImportRootFromWorkspace()
  if bestRoot and bestCount > selectedCount then
    warnf("Selected object only contains", selectedCount, "of", expectedCount, "OBJ IDs. Using", bestRoot:GetFullName(), "with", bestCount, "matches instead.")
    return bestRoot
  end
  if selectedCount > 0 then
    warnf("Selected object only contains", selectedCount, "of", expectedCount, "OBJ IDs, but no better root was found. Trying selected object anyway.")
    return selected
  end
  warnf("Selected object has no matching exported OBJ IDs. Searching Workspace.")
end
  end
  local fallback = workspace:FindFirstChild("ImportedParts")
  if fallback then
local fallbackCount = countExportIdMatches(fallback)
if fallbackCount > 0 then
  info("Using fallback imported root:", fallback:GetFullName(), "matched", fallbackCount, "of", expectedCount, "OBJ IDs")
  return fallback
end
warnf("workspace.ImportedParts exists but contains no matching exported OBJ IDs. Searching Workspace.")
  end
  local bestRoot, bestCount = bestImportRootFromWorkspace()
  assert(bestRoot and bestCount > 0, "Could not find imported OBJ models. Import the OBJ files first, then select their folder/model or leave them in Workspace and run again.")
  info("Using discovered imported root:", bestRoot:GetFullName(), "matched", bestCount, "of", expectedCount, "OBJ IDs")
  return bestRoot
end

local function meshPartFromCandidate(candidate)
	if not candidate then
		return nil
  end
  if candidate:IsA("MeshPart") or candidate:IsA("Part") or candidate:IsA("BasePart") then
return candidate
  end
  if candidate:IsA("Model") or candidate:IsA("Folder") then
local descendants = candidate:GetDescendants()
local firstBasePart = nil
local basePartCount = 0
for _, descendant in ipairs(descendants) do
  if descendant:IsA("BasePart") then
    firstBasePart = firstBasePart or descendant
    basePartCount += 1
  end
end
if basePartCount == 1 then
  return firstBasePart
end
	end
	return nil
end

local function normalizeToken(value)
	local text = tostring(value or "")
	text = text:gsub("%.obj$", "")
	text = text:gsub("%.%.%.$", "")
	text = text:gsub("%.%.%.", "_")
	text = text:gsub("[^%w]+", "_")
	text = text:gsub("_+", "_")
	text = text:gsub("^_+", "")
	text = text:gsub("_+$", "")
	return string.lower(text)
end

local function candidateNamesForEntry(entry)
	local names = {
entry.exportId,
		entry.importName,
		entry.importName .. ".obj",
		entry.file
	}
	return names
end

local function hasEntryExportIdPrefix(instanceName, entry)
  local exportId = tostring(entry.exportId or entry.importName or ""):gsub("%.obj$", "")
  if exportId == "" then
return false
  end
  local instanceNorm = normalizeToken(instanceName)
  local exportNorm = normalizeToken(exportId)
  return instanceNorm == exportNorm or string.sub(instanceNorm, 1, #exportNorm + 1) == exportNorm .. "_"
end

local function matchesEntryName(instance, entry)
	if not instance then
		return false
	end
	local instanceName = instance.Name
  if hasEntryExportIdPrefix(instanceName, entry) then
return true
  end
	local instanceNorm = normalizeToken(instanceName)
	for _, candidateName in ipairs(candidateNamesForEntry(entry)) do
		if instanceName == candidateName or instanceNorm == normalizeToken(candidateName) then
			return true
		end
	end
	return false
end

local function trimText(value)
  return tostring(value or ""):gsub("^%s+", ""):gsub("%s+$", "")
end

local function textureGroupKey(name)
  local text = trimText(name)
  local stripped = text:gsub("[%s%._%-]*%d+$", "")
  stripped = trimText(stripped)
  return stripped ~= "" and stripped or text
end

local function texturePathKey(entry)
  if entry.hierarchyPath and #entry.hierarchyPath > 0 then
return table.concat(entry.hierarchyPath, ".")
  end
  return entry.name
end

local function manifestMeshPathMap()
  local lookup = {}
  local function visitMesh(entry)
if entry then
  lookup[texturePathKey(entry)] = entry
end
  end
  local function visitGroup(node)
if not node then
  return
end
for _, meshEntry in ipairs(node.meshes or {}) do
  visitMesh(meshEntry)
end
for _, child in ipairs(node.children or {}) do
  visitGroup(child)
end
  end
  for _, meshEntry in ipairs(manifest.rootMeshes or {}) do
visitMesh(meshEntry)
  end
  for _, node in ipairs(manifest.rootGroups or {}) do
visitGroup(node)
  end
  return lookup
end

local meshEntryByPath = manifestMeshPathMap()

local function normalizeTextureAssetId(value)
  local text = trimText(value)
  if text == "" then
return nil
  end
  if text:match("^rbxassetid://") or text:match("^rbxasset://") then
return text
  end
  if text:match("^%d+$") then
return "rbxassetid://" .. text
  end
  return text
end

local function resolveTextureReference(value)
  local text = trimText(value)
  if text == "" then
return nil
  end
  local catalogValue = textureCatalog[text]
  if catalogValue ~= nil then
local resolvedCatalog = normalizeTextureAssetId(catalogValue)
if resolvedCatalog then
  return resolvedCatalog
end
  end
  return normalizeTextureAssetId(text)
end

local function applyTextureFields(part, entry)
  local textureId = resolveTextureReference(textureByPath[texturePathKey(entry)] or textureByGroup[textureGroupKey(entry.name)])
  if not textureId then
return
  end
  pcall(function()
part.TextureID = textureId
  end)
  pcall(function()
part.TextureContent = textureId
  end)
  part:SetAttribute("ModelerTextureId", textureId)
end

local function resolvePositionSourceEntry(entry)
  return entry
end

local function robloxVectorFromStudio(values)
  return Vector3.new(
values and values[1] or 0,
values and values[2] or 0,
values and values[3] or 0
  )
end

local function manifestPackOrigin()
  return robloxVectorFromStudio(manifest.packOrigin)
end

local function resolveEntryCFrame(entry)
  local sourceEntry = resolvePositionSourceEntry(entry)
  local position = manifestPackOrigin() + robloxVectorFromStudio(sourceEntry.position)
  return CFrame.new(position)
end

local function makeMarkerPart(name, size, color, cf, parent)
  local part = Instance.new("Part")
  part.Name = name
  part.Size = size
  part.Color = color
  part.Anchored = true
  part.CanCollide = false
  part.CanTouch = false
  part.CanQuery = false
  part.Material = Enum.Material.Neon
  part.Transparency = markerTransparency
  part.CFrame = cf
  part.Parent = parent
  return part
end

local function markerDisplayName(entry)
  if markerLabelMode == "path" and entry.hierarchyPath and #entry.hierarchyPath > 0 then
return table.concat(entry.hierarchyPath, " > ")
  end
  local parts = entry.hierarchyPath or {}
  local tail = {}
  for index = math.max(1, #parts - 1), #parts do
if parts[index] then
  table.insert(tail, parts[index])
end
  end
  if #tail > 0 then
return table.concat(tail, " / ")
  end
  return entry.name
end

local function attachMarkerLabel(parent, text, orderIndex)
  if markerLabelMode == "none" then
return
  end
  local billboard = Instance.new("BillboardGui")
  billboard.Name = "Label"
  billboard.Size = UDim2.fromOffset(200, 30)
  billboard.StudsOffset = Vector3.new(0, markerSize * (1.7 + ((orderIndex or 0) % 4) * markerLabelStagger), 0)
  billboard.AlwaysOnTop = true
  billboard.MaxDistance = 250
  billboard.Parent = parent
  local label = Instance.new("TextLabel")
  label.Size = UDim2.fromScale(1, 1)
  label.BackgroundColor3 = Color3.fromRGB(10, 12, 18)
  label.BackgroundTransparency = 0.22
  label.BorderSizePixel = 0
  label.Text = text
  label.TextScaled = false
  label.TextSize = math.floor(16 * markerLabelScale)
  label.Font = Enum.Font.Code
  label.TextColor3 = Color3.fromRGB(255, 255, 255)
  label.TextStrokeTransparency = 0.2
  label.TextWrapped = false
  label.Parent = billboard
  local corner = Instance.new("UICorner")
  corner.CornerRadius = UDim.new(0, 5)
  corner.Parent = label
end

local function createPlacementMarker(entry, parent, orderIndex)
  local cf = resolveEntryCFrame(entry)
  local marker = Instance.new("Model")
  marker.Name = entry.name .. "_marker"
  marker.Parent = parent
  local core = makeMarkerPart("Core", Vector3.new(markerSize * 0.34, markerSize * 0.34, markerSize * 0.34), Color3.fromRGB(255, 221, 87), cf, marker)
  makeMarkerPart("AxisX", Vector3.new(markerSize, markerSize * 0.12, markerSize * 0.12), Color3.fromRGB(255, 96, 96), cf * CFrame.new(markerSize * 0.5, 0, 0), marker)
  makeMarkerPart("AxisY", Vector3.new(markerSize * 0.12, markerSize, markerSize * 0.12), Color3.fromRGB(110, 255, 110), cf * CFrame.new(0, markerSize * 0.5, 0), marker)
  makeMarkerPart("AxisZ", Vector3.new(markerSize * 0.12, markerSize * 0.12, markerSize), Color3.fromRGB(110, 180, 255), cf * CFrame.new(0, 0, markerSize * 0.5), marker)
  core:SetAttribute("ModelerMarkerPath", (entry.hierarchyPath and table.concat(entry.hierarchyPath, ".")) or entry.name)
  attachMarkerLabel(core, markerDisplayName(entry), orderIndex)
  return marker
end

local function clearPlacementMarkers()
  local existing = workspace:FindFirstChild(markerFolderName)
  if existing then
existing:Destroy()
  end
end

local function addAllPlacementMarkers(markerFolder)
  local markerIndex = 0
  local function addMarkersForGroup(node)
for _, meshEntry in ipairs(node.meshes or {}) do
  markerIndex += 1
  createPlacementMarker(meshEntry, markerFolder, markerIndex)
end
for _, child in ipairs(node.children or {}) do
  addMarkersForGroup(child)
end
  end
  for _, node in ipairs(manifest.rootGroups or {}) do
addMarkersForGroup(node)
  end
  for _, meshEntry in ipairs(manifest.rootMeshes or {}) do
markerIndex += 1
createPlacementMarker(meshEntry, markerFolder, markerIndex)
  end
  return markerIndex
end

local function showTargetMarkers()
  clearPlacementMarkers()
  local markerFolder = Instance.new("Folder")
  markerFolder.Name = markerFolderName
  markerFolder.Parent = workspace
  local markerCount = addAllPlacementMarkers(markerFolder)
  info("Created", markerCount, "target marker(s) at exact manifest positions for pack", manifest.name, manifest.packId or "")
  return markerFolder
end

local function findImportedPart(importedRoot, entry)
	local candidates = candidateNamesForEntry(entry)
	for _, candidateName in ipairs(candidates) do
		local found = importedRoot:FindFirstChild(candidateName, true)
		local meshPart = meshPartFromCandidate(found)
		if meshPart then
			info("Matched import by exact name:", candidateName, "->", meshPart:GetFullName())
			return meshPart
		end
	end
	local fallbackBySource = nil
	for _, descendant in ipairs(importedRoot:GetDescendants()) do
		if descendant:IsA("BasePart") and descendant:GetAttribute("ModelerSourceFile") == entry.file then
			fallbackBySource = descendant
			break
		end
		if descendant:IsA("BasePart") and descendant.Name == "default" and matchesEntryName(descendant.Parent, entry) then
			info("Matched import by wrapper/default:", descendant.Parent:GetFullName(), "->", descendant:GetFullName())
			return descendant
		end
		if matchesEntryName(descendant, entry) then
			local meshPart = meshPartFromCandidate(descendant)
			if meshPart then
				info("Matched import by normalized name:", descendant:GetFullName(), "->", meshPart:GetFullName())
				return meshPart
			end
		end
	end
	if fallbackBySource then
		info("Matched import by ModelerSourceFile attribute:", fallbackBySource:GetFullName())
		return fallbackBySource
	end
	error("Missing imported MeshPart or wrapper for: " .. entry.importName .. " (file " .. entry.file .. ")")
end

local function importedRotationCFrame(sourcePart)
  if not sourcePart then
return CFrame.new()
  end
  return sourcePart.CFrame - sourcePart.CFrame.Position
end

local function setPartTransform(part, entry, sourcePart)
  if useImportedRotation then
part.CFrame = resolveEntryCFrame(entry) * importedRotationCFrame(sourcePart)
  else
part.CFrame = resolveEntryCFrame(entry)
  end
  part:SetAttribute("ModelerSourceFile", entry.file)
  if entry.textureName then
part:SetAttribute("ModelerTexture", entry.textureName)
  end
end

local function attachMesh(importedRoot, entry, parent)
	local sourcePart = findImportedPart(importedRoot, entry)
	local part = sourcePart:Clone()
	part.Name = entry.name
	setPartTransform(part, entry, sourcePart)
  applyTextureFields(part, entry)
	part.Parent = parent
	part:SetAttribute("ModelerImportName", entry.importName)
	part:SetAttribute("ModelerBaseImportName", entry.baseImportName or entry.importName)
	part:SetAttribute("ModelerHierarchyPath", texturePathKey(entry))
	return part
end

local function buildGroup(importedRoot, node, parent)
  local container = Instance.new("Model")
  container.Name = node.name
  container.Parent = parent
  for _, meshEntry in ipairs(node.meshes or {}) do
attachMesh(importedRoot, meshEntry, container)
  end
  for _, child in ipairs(node.children or {}) do
buildGroup(importedRoot, child, container)
  end
  return container
end

local function buildPack(importedRoot)
  for _, child in ipairs(workspace:GetChildren()) do
if child:IsA("Model") and child ~= importedRoot and (child:GetAttribute("ModelerBuiltPack") == manifest.name or child.Name == manifest.name) then
  child:Destroy()
end
  end
  local root = Instance.new("Model")
  root.Name = manifest.name
  root:SetAttribute("ModelerBuiltPack", manifest.name)
  root.Parent = workspace
  local markerFolder = nil
  if createPlacementMarkers then
clearPlacementMarkers()
markerFolder = Instance.new("Folder")
markerFolder.Name = markerFolderName
markerFolder.Parent = workspace
  end
  for _, node in ipairs(manifest.rootGroups or {}) do
buildGroup(importedRoot, node, root)
  end
  for _, meshEntry in ipairs(manifest.rootMeshes or {}) do
attachMesh(importedRoot, meshEntry, root)
  end
  if markerFolder then
addAllPlacementMarkers(markerFolder)
  end
  return root
end

local function diagnoseImports()
  local importedRoot = resolveImportedRoot()
  local checked = 0
  local missing = 0

  local function visitMesh(entry)
checked += 1
local ok, partOrMessage = pcall(function()
  return findImportedPart(importedRoot, entry)
end)
if ok and partOrMessage then
  local part = partOrMessage
  info("Import", checked, texturePathKey(entry), "source", part:GetFullName(), "sourcePos", tostring(part.Position), "sourceRot", tostring(part.Orientation), "targetPos", tostring(resolveEntryCFrame(entry).Position), "localOffset", tostring(robloxVectorFromStudio(entry.position)))
else
  missing += 1
  warnf("Missing import for", texturePathKey(entry), entry.file, partOrMessage)
end
  end

  local function visitGroup(node)
for _, meshEntry in ipairs(node.meshes or {}) do
  visitMesh(meshEntry)
end
for _, child in ipairs(node.children or {}) do
  visitGroup(child)
end
  end

  for _, node in ipairs(manifest.rootGroups or {}) do
visitGroup(node)
  end
  for _, meshEntry in ipairs(manifest.rootMeshes or {}) do
visitMesh(meshEntry)
  end
  info("Diagnose complete. Checked", checked, "mesh entries. Missing", missing)
end

local function rebuildFromSelection()
  local importedRoot = resolveImportedRoot()
  info("Rebuilding pack:", manifest.name)
  local built = buildPack(importedRoot)
  info("Built Roblox model hierarchy:", built:GetFullName())
  return built
end

_G.ModelerRebuildPack = rebuildFromSelection
_G.ModelerDiagnoseImports = diagnoseImports
_G.ModelerShowTargetMarkers = showTargetMarkers
_G.ModelerClearTargetMarkers = clearPlacementMarkers

local built = rebuildFromSelection()
info("Command helpers installed: _G.ModelerRebuildPack(), _G.ModelerDiagnoseImports(), _G.ModelerShowTargetMarkers(), _G.ModelerClearTargetMarkers()")
`;
}

function robloxPluginLua(manifest) {
  const manifestLua = toLuaLiteral(manifest, 0);
  const textureAssignments = collectRobloxTextureAssignments(manifest);
  const textureCatalog = collectRobloxTextureCatalog();
  const textureCatalogLua = toLuaLiteral(textureCatalog, 0);
  const textureByGroupLua = toLuaLiteral(textureAssignments.byGroup, 0);
  const textureByPathLua = toLuaLiteral(textureAssignments.byPath, 0);
  return `-- 3D Model Studio Roblox rebuild plugin
local pluginObj = plugin
local Selection = game:GetService("Selection")

local textureCatalog = ${textureCatalogLua}
local textureByGroup = ${textureByGroupLua}
local textureByPath = ${textureByPathLua}
local createPlacementMarkers = false
local useImportedRotation = false -- OBJ geometry is already exported in final orientation; only apply manifest position.
local markerFolderName = "ModelerPlacementMarkers"
local markerSize = 0.35
local markerTransparency = 0.2
local markerLabelMode = "short" -- "short", "path", or "none"
local markerLabelScale = 0.75
local markerLabelStagger = 0.18

local manifest = ${manifestLua}

local function info(...)
  print("[3D Model Studio]", ...)
end

local function isBuiltPackSelection(instance)
  local current = instance
  while current do
if current:IsA("Model") and (current:GetAttribute("ModelerBuiltPack") == manifest.name or current.Name == manifest.name) then
  return true
end
current = current.Parent
  end
  return false
end

local function collectManifestExportIds()
  local ids = {}
  local function addMesh(entry)
if entry and entry.exportId then
  table.insert(ids, tostring(entry.exportId):gsub("%.obj$", ""))
end
  end
  local function visitGroup(node)
if not node then
  return
end
for _, meshEntry in ipairs(node.meshes or {}) do
  addMesh(meshEntry)
end
for _, child in ipairs(node.children or {}) do
  visitGroup(child)
end
  end
  for _, node in ipairs(manifest.rootGroups or {}) do
visitGroup(node)
  end
  for _, meshEntry in ipairs(manifest.rootMeshes or {}) do
addMesh(meshEntry)
  end
  return ids
end

local manifestExportIds = collectManifestExportIds()

local function instanceNameMatchesExportId(instance, exportId)
  local name = string.lower(tostring(instance and instance.Name or "")):gsub("%.obj$", "")
  local token = string.lower(tostring(exportId or "")):gsub("%.obj$", "")
  if token == "" then
return false
  end
  return name == token or string.sub(name, 1, #token + 1) == token .. "_" or string.find(name, token, 1, true) ~= nil
end

local function countExportIdMatches(root)
  if not root then
return 0
  end
  local seen = {}
  local count = 0
  local function check(instance)
for _, exportId in ipairs(manifestExportIds) do
  if not seen[exportId] and instanceNameMatchesExportId(instance, exportId) then
    seen[exportId] = true
    count += 1
    break
  end
end
  end
  check(root)
  for _, descendant in ipairs(root:GetDescendants()) do
check(descendant)
  end
  return count
end

local function bestImportRootFromWorkspace()
  local bestRoot = nil
  local bestCount = 0
  local workspaceCount = countExportIdMatches(workspace)
  if workspaceCount > 0 then
bestRoot = workspace
bestCount = workspaceCount
  end
  for _, child in ipairs(workspace:GetChildren()) do
if not isBuiltPackSelection(child) then
  local count = countExportIdMatches(child)
  if count > bestCount then
    bestRoot = child
    bestCount = count
  end
end
  end
  return bestRoot, bestCount
end

local function findImportedRoot()
  local expectedCount = #manifestExportIds
  local selected = Selection:Get()[1]
  if selected then
if isBuiltPackSelection(selected) then
  warn("[3D Model Studio]", "Selected object is the rebuilt model, not the imported source. Searching Workspace for imported OBJ IDs.")
else
  local selectedCount = countExportIdMatches(selected)
  if expectedCount <= 1 or selectedCount >= expectedCount then
    info("Using selected imported root:", selected:GetFullName(), "matched", selectedCount, "of", expectedCount, "OBJ IDs")
    return selected
  end
  local bestRoot, bestCount = bestImportRootFromWorkspace()
  if bestRoot and bestCount > selectedCount then
    warn("[3D Model Studio]", "Selected object only contains", selectedCount, "of", expectedCount, "OBJ IDs. Using", bestRoot:GetFullName(), "with", bestCount, "matches instead.")
    return bestRoot
  end
  if selectedCount > 0 then
    warn("[3D Model Studio]", "Selected object only contains", selectedCount, "of", expectedCount, "OBJ IDs, but no better root was found. Trying selected object anyway.")
    return selected
  end
  warn("[3D Model Studio]", "Selected object has no matching exported OBJ IDs. Searching Workspace.")
end
  end
  local fallback = workspace:FindFirstChild("ImportedParts")
  if fallback then
local fallbackCount = countExportIdMatches(fallback)
if fallbackCount > 0 then
  info("Using fallback imported root:", fallback:GetFullName(), "matched", fallbackCount, "of", expectedCount, "OBJ IDs")
  return fallback
end
warn("[3D Model Studio]", "workspace.ImportedParts exists but contains no matching exported OBJ IDs. Searching Workspace.")
  end
  local bestRoot, bestCount = bestImportRootFromWorkspace()
  if bestRoot and bestCount > 0 then
info("Using discovered imported root:", bestRoot:GetFullName(), "matched", bestCount, "of", expectedCount, "OBJ IDs")
return bestRoot
  end
  return nil
end

local function meshPartFromCandidate(candidate)
	if not candidate then
		return nil
  end
  if candidate:IsA("MeshPart") or candidate:IsA("Part") or candidate:IsA("BasePart") then
return candidate
  end
  if candidate:IsA("Model") or candidate:IsA("Folder") then
local descendants = candidate:GetDescendants()
local firstBasePart = nil
local basePartCount = 0
for _, descendant in ipairs(descendants) do
  if descendant:IsA("BasePart") then
    firstBasePart = firstBasePart or descendant
    basePartCount += 1
  end
end
if basePartCount == 1 then
  return firstBasePart
end
	end
	return nil
end

local function normalizeToken(value)
	local text = tostring(value or "")
	text = text:gsub("%.obj$", "")
	text = text:gsub("%.%.%.$", "")
	text = text:gsub("%.%.%.", "_")
	text = text:gsub("[^%w]+", "_")
	text = text:gsub("_+", "_")
	text = text:gsub("^_+", "")
	text = text:gsub("_+$", "")
	return string.lower(text)
end

local function candidateNamesForEntry(entry)
	local names = {
entry.exportId,
		entry.importName,
		entry.importName .. ".obj",
		entry.file
	}
	return names
end

local function hasEntryExportIdPrefix(instanceName, entry)
  local exportId = tostring(entry.exportId or entry.importName or ""):gsub("%.obj$", "")
  if exportId == "" then
return false
  end
  local instanceNorm = normalizeToken(instanceName)
  local exportNorm = normalizeToken(exportId)
  return instanceNorm == exportNorm or string.sub(instanceNorm, 1, #exportNorm + 1) == exportNorm .. "_"
end

local function matchesEntryName(instance, entry)
	if not instance then
		return false
	end
	local instanceName = instance.Name
  if hasEntryExportIdPrefix(instanceName, entry) then
return true
  end
	local instanceNorm = normalizeToken(instanceName)
	for _, candidateName in ipairs(candidateNamesForEntry(entry)) do
		if instanceName == candidateName or instanceNorm == normalizeToken(candidateName) then
			return true
		end
	end
	return false
end

local function trimText(value)
  return tostring(value or ""):gsub("^%s+", ""):gsub("%s+$", "")
end

local function textureGroupKey(name)
  local text = trimText(name)
  local stripped = text:gsub("[%s%._%-]*%d+$", "")
  stripped = trimText(stripped)
  return stripped ~= "" and stripped or text
end

local function texturePathKey(entry)
  if entry.hierarchyPath and #entry.hierarchyPath > 0 then
return table.concat(entry.hierarchyPath, ".")
  end
  return entry.name
end

local function manifestMeshPathMap()
  local lookup = {}
  local function visitMesh(entry)
if entry then
  lookup[texturePathKey(entry)] = entry
end
  end
  local function visitGroup(node)
if not node then
  return
end
for _, meshEntry in ipairs(node.meshes or {}) do
  visitMesh(meshEntry)
end
for _, child in ipairs(node.children or {}) do
  visitGroup(child)
end
  end
  for _, meshEntry in ipairs(manifest.rootMeshes or {}) do
visitMesh(meshEntry)
  end
  for _, node in ipairs(manifest.rootGroups or {}) do
visitGroup(node)
  end
  return lookup
end

local meshEntryByPath = manifestMeshPathMap()

local function normalizeTextureAssetId(value)
  local text = trimText(value)
  if text == "" then
return nil
  end
  if text:match("^rbxassetid://") or text:match("^rbxasset://") then
return text
  end
  if text:match("^%d+$") then
return "rbxassetid://" .. text
  end
  return text
end

local function resolveTextureReference(value)
  local text = trimText(value)
  if text == "" then
return nil
  end
  local catalogValue = textureCatalog[text]
  if catalogValue ~= nil then
local resolvedCatalog = normalizeTextureAssetId(catalogValue)
if resolvedCatalog then
  return resolvedCatalog
end
  end
  return normalizeTextureAssetId(text)
end

local function applyTextureFields(part, entry)
  local textureId = resolveTextureReference(textureByPath[texturePathKey(entry)] or textureByGroup[textureGroupKey(entry.name)])
  if not textureId then
return
  end
  pcall(function()
part.TextureID = textureId
  end)
  pcall(function()
part.TextureContent = textureId
  end)
  part:SetAttribute("ModelerTextureId", textureId)
end

local function resolvePositionSourceEntry(entry)
  return entry
end

local function robloxVectorFromStudio(values)
  return Vector3.new(
values and values[1] or 0,
values and values[2] or 0,
values and values[3] or 0
  )
end

local function manifestPackOrigin()
  return robloxVectorFromStudio(manifest.packOrigin)
end

local function resolveEntryCFrame(entry)
  local sourceEntry = resolvePositionSourceEntry(entry)
  local position = manifestPackOrigin() + robloxVectorFromStudio(sourceEntry.position)
  return CFrame.new(position)
end

local function makeMarkerPart(name, size, color, cf, parent)
  local part = Instance.new("Part")
  part.Name = name
  part.Size = size
  part.Color = color
  part.Anchored = true
  part.CanCollide = false
  part.CanTouch = false
  part.CanQuery = false
  part.Material = Enum.Material.Neon
  part.Transparency = markerTransparency
  part.CFrame = cf
  part.Parent = parent
  return part
end

local function markerDisplayName(entry)
  if markerLabelMode == "path" and entry.hierarchyPath and #entry.hierarchyPath > 0 then
return table.concat(entry.hierarchyPath, " > ")
  end
  local parts = entry.hierarchyPath or {}
  local tail = {}
  for index = math.max(1, #parts - 1), #parts do
if parts[index] then
  table.insert(tail, parts[index])
end
  end
  if #tail > 0 then
return table.concat(tail, " / ")
  end
  return entry.name
end

local function attachMarkerLabel(parent, text, orderIndex)
  if markerLabelMode == "none" then
return
  end
  local billboard = Instance.new("BillboardGui")
  billboard.Name = "Label"
  billboard.Size = UDim2.fromOffset(200, 30)
  billboard.StudsOffset = Vector3.new(0, markerSize * (1.7 + ((orderIndex or 0) % 4) * markerLabelStagger), 0)
  billboard.AlwaysOnTop = true
  billboard.MaxDistance = 250
  billboard.Parent = parent
  local label = Instance.new("TextLabel")
  label.Size = UDim2.fromScale(1, 1)
  label.BackgroundColor3 = Color3.fromRGB(10, 12, 18)
  label.BackgroundTransparency = 0.22
  label.BorderSizePixel = 0
  label.Text = text
  label.TextScaled = false
  label.TextSize = math.floor(16 * markerLabelScale)
  label.Font = Enum.Font.Code
  label.TextColor3 = Color3.fromRGB(255, 255, 255)
  label.TextStrokeTransparency = 0.2
  label.TextWrapped = false
  label.Parent = billboard
  local corner = Instance.new("UICorner")
  corner.CornerRadius = UDim.new(0, 5)
  corner.Parent = label
end

local function createPlacementMarker(entry, parent, orderIndex)
  local cf = resolveEntryCFrame(entry)
  local marker = Instance.new("Model")
  marker.Name = entry.name .. "_marker"
  marker.Parent = parent
  local core = makeMarkerPart("Core", Vector3.new(markerSize * 0.34, markerSize * 0.34, markerSize * 0.34), Color3.fromRGB(255, 221, 87), cf, marker)
  makeMarkerPart("AxisX", Vector3.new(markerSize, markerSize * 0.12, markerSize * 0.12), Color3.fromRGB(255, 96, 96), cf * CFrame.new(markerSize * 0.5, 0, 0), marker)
  makeMarkerPart("AxisY", Vector3.new(markerSize * 0.12, markerSize, markerSize * 0.12), Color3.fromRGB(110, 255, 110), cf * CFrame.new(0, markerSize * 0.5, 0), marker)
  makeMarkerPart("AxisZ", Vector3.new(markerSize * 0.12, markerSize * 0.12, markerSize), Color3.fromRGB(110, 180, 255), cf * CFrame.new(0, 0, markerSize * 0.5), marker)
  core:SetAttribute("ModelerMarkerPath", (entry.hierarchyPath and table.concat(entry.hierarchyPath, ".")) or entry.name)
  attachMarkerLabel(core, markerDisplayName(entry), orderIndex)
  return marker
end

local function findImportedPart(importedRoot, entry)
	for _, candidateName in ipairs(candidateNamesForEntry(entry)) do
		local found = importedRoot and importedRoot:FindFirstChild(candidateName, true)
		local meshPart = meshPartFromCandidate(found)
		if meshPart then
			info("Matched import by exact name:", candidateName, "->", meshPart:GetFullName())
			return meshPart
		end
	end
	for _, descendant in ipairs(importedRoot:GetDescendants()) do
		if descendant:IsA("BasePart") and descendant.Name == "default" and matchesEntryName(descendant.Parent, entry) then
			info("Matched import by wrapper/default:", descendant.Parent:GetFullName(), "->", descendant:GetFullName())
			return descendant
		end
		if matchesEntryName(descendant, entry) then
			local meshPart = meshPartFromCandidate(descendant)
			if meshPart then
				info("Matched import by normalized name:", descendant:GetFullName(), "->", meshPart:GetFullName())
				return meshPart
			end
		end
	end
	error("Missing imported MeshPart or wrapper for: " .. entry.importName .. " (file " .. entry.file .. ")")
end

local function importedRotationCFrame(sourcePart)
  if not sourcePart then
return CFrame.new()
  end
  return sourcePart.CFrame - sourcePart.CFrame.Position
end

local function setPartTransform(part, entry, sourcePart)
  if useImportedRotation then
part.CFrame = resolveEntryCFrame(entry) * importedRotationCFrame(sourcePart)
  else
part.CFrame = resolveEntryCFrame(entry)
  end
  part:SetAttribute("ModelerSourceFile", entry.file)
  if entry.textureName then
part:SetAttribute("ModelerTexture", entry.textureName)
  end
end

local function attachMesh(importedRoot, entry, parent)
	local sourcePart = findImportedPart(importedRoot, entry)
	local part = sourcePart:Clone()
	part.Name = entry.name
	setPartTransform(part, entry, sourcePart)
  applyTextureFields(part, entry)
	part.Parent = parent
  part:SetAttribute("ModelerImportName", entry.importName)
  part:SetAttribute("ModelerBaseImportName", entry.baseImportName or entry.importName)
  part:SetAttribute("ModelerHierarchyPath", texturePathKey(entry))
  return part
end

local function buildGroup(importedRoot, node, parent)
  local container = Instance.new("Model")
  container.Name = node.name
  container.Parent = parent
  for _, meshEntry in ipairs(node.meshes or {}) do
attachMesh(importedRoot, meshEntry, container)
  end
  for _, child in ipairs(node.children or {}) do
buildGroup(importedRoot, child, container)
  end
  return container
end

local function rebuild()
  local importedRoot = findImportedRoot()
  assert(importedRoot, "Select the imported pack folder/model first, or create workspace.ImportedParts.")
  info("Rebuilding pack:", manifest.name)
  for _, child in ipairs(workspace:GetChildren()) do
if child:IsA("Model") and child ~= importedRoot and (child:GetAttribute("ModelerBuiltPack") == manifest.name or child.Name == manifest.name) then
  child:Destroy()
end
  end
  local root = Instance.new("Model")
  root.Name = manifest.name
  root:SetAttribute("ModelerBuiltPack", manifest.name)
  root.Parent = workspace
  local markerFolder = nil
  if createPlacementMarkers then
local existing = workspace:FindFirstChild(markerFolderName)
if existing then existing:Destroy() end
markerFolder = Instance.new("Folder")
markerFolder.Name = markerFolderName
markerFolder.Parent = workspace
  end
  for _, node in ipairs(manifest.rootGroups or {}) do
buildGroup(importedRoot, node, root)
  end
  for _, meshEntry in ipairs(manifest.rootMeshes or {}) do
attachMesh(importedRoot, meshEntry, root)
  end
  if markerFolder then
local markerIndex = 0
local function addMarkersForGroup(node)
  for _, meshEntry in ipairs(node.meshes or {}) do
    markerIndex += 1
    createPlacementMarker(meshEntry, markerFolder, markerIndex)
  end
  for _, child in ipairs(node.children or {}) do
    addMarkersForGroup(child)
  end
end
for _, node in ipairs(manifest.rootGroups or {}) do
  addMarkersForGroup(node)
end
for _, meshEntry in ipairs(manifest.rootMeshes or {}) do
  markerIndex += 1
  createPlacementMarker(meshEntry, markerFolder, markerIndex)
end
  end
  Selection:Set({ root })
  info("Built Roblox model hierarchy:", root:GetFullName())
end

if pluginObj then
  local toolbar = pluginObj:CreateToolbar("3D Model Studio")
  local rebuildButton = toolbar:CreateButton("RebuildPack", "Rebuild imported MeshParts into " .. manifest.name, "")
  local menuButton = toolbar:CreateButton("ModelerTools", "Open rebuild tools for " .. manifest.name, "")

  local widgetInfo = DockWidgetPluginGuiInfo.new(
Enum.InitialDockState.Right,
true,
false,
420,
560,
300,
360
  )
  local widget = pluginObj:CreateDockWidgetPluginGui("ModelerTools_" .. manifest.name, widgetInfo)
  widget.Title = "3D Model Studio Tools"

  local rootFrame = Instance.new("Frame")
  rootFrame.Size = UDim2.fromScale(1, 1)
  rootFrame.BackgroundColor3 = Color3.fromRGB(22, 24, 30)
  rootFrame.BorderSizePixel = 0
  rootFrame.Parent = widget

  local topBar = Instance.new("Frame")
  topBar.Size = UDim2.new(1, -12, 0, 72)
  topBar.Position = UDim2.fromOffset(6, 6)
  topBar.BackgroundTransparency = 1
  topBar.Parent = rootFrame

  local title = Instance.new("TextLabel")
  title.Size = UDim2.new(1, 0, 0, 20)
  title.BackgroundTransparency = 1
  title.TextXAlignment = Enum.TextXAlignment.Left
  title.Font = Enum.Font.SourceSansBold
  title.TextSize = 18
  title.TextColor3 = Color3.fromRGB(255, 255, 255)
  title.Text = manifest.name .. " rebuild tools"
  title.Parent = topBar

  local subtitle = Instance.new("TextLabel")
  subtitle.Size = UDim2.new(1, 0, 0, 18)
  subtitle.Position = UDim2.fromOffset(0, 22)
  subtitle.BackgroundTransparency = 1
  subtitle.TextXAlignment = Enum.TextXAlignment.Left
  subtitle.Font = Enum.Font.SourceSans
  subtitle.TextSize = 14
  subtitle.TextColor3 = Color3.fromRGB(186, 192, 204)
  subtitle.Text = "Rebuild the pack, diagnose import matching, or toggle placement markers."
  subtitle.Parent = topBar

  local rebuildNow = Instance.new("TextButton")
  rebuildNow.Size = UDim2.fromOffset(116, 30)
  rebuildNow.Position = UDim2.fromOffset(0, 42)
  rebuildNow.BackgroundColor3 = Color3.fromRGB(52, 168, 120)
  rebuildNow.TextColor3 = Color3.fromRGB(255, 255, 255)
  rebuildNow.Text = "Rebuild"
  rebuildNow.Font = Enum.Font.SourceSansSemibold
  rebuildNow.TextSize = 16
  rebuildNow.AutoButtonColor = true
  rebuildNow.Parent = topBar

  local markerToggle = Instance.new("TextButton")
  markerToggle.Size = UDim2.fromOffset(132, 30)
  markerToggle.Position = UDim2.fromOffset(126, 42)
  markerToggle.BackgroundColor3 = Color3.fromRGB(48, 56, 72)
  markerToggle.TextColor3 = Color3.fromRGB(255, 255, 255)
  markerToggle.Text = createPlacementMarkers and "Markers: On" or "Markers: Off"
  markerToggle.Font = Enum.Font.SourceSansSemibold
  markerToggle.TextSize = 16
  markerToggle.AutoButtonColor = true
  markerToggle.Parent = topBar

  local function makeActionButton(label, color)
local button = Instance.new("TextButton")
button.Size = UDim2.fromOffset(120, 30)
button.BackgroundColor3 = color or Color3.fromRGB(48, 56, 72)
button.TextColor3 = Color3.fromRGB(255, 255, 255)
button.Text = label
button.Font = Enum.Font.SourceSansSemibold
button.TextSize = 16
button.AutoButtonColor = true
local corner = Instance.new("UICorner")
corner.CornerRadius = UDim.new(0, 5)
corner.Parent = button
return button
  end

  local diagnoseButton = makeActionButton("Diagnose", Color3.fromRGB(82, 126, 204))
  diagnoseButton.Position = UDim2.fromOffset(268, 42)
  diagnoseButton.Parent = topBar

  local scroll = Instance.new("ScrollingFrame")
  scroll.Size = UDim2.new(1, -12, 1, -84)
  scroll.Position = UDim2.fromOffset(6, 78)
  scroll.BackgroundColor3 = Color3.fromRGB(14, 16, 22)
  scroll.BorderSizePixel = 0
  scroll.ScrollBarThickness = 8
  scroll.CanvasSize = UDim2.fromOffset(0, 0)
  scroll.AutomaticCanvasSize = Enum.AutomaticSize.Y
  scroll.Parent = rootFrame

  local list = Instance.new("UIListLayout")
  list.Padding = UDim.new(0, 6)
  list.Parent = scroll

  local listPad = Instance.new("UIPadding")
  listPad.PaddingTop = UDim.new(0, 6)
  listPad.PaddingBottom = UDim.new(0, 6)
  listPad.PaddingLeft = UDim.new(0, 6)
  listPad.PaddingRight = UDim.new(0, 6)
  listPad.Parent = scroll

  local infoCard = Instance.new("Frame")
  infoCard.Size = UDim2.new(1, -4, 0, 132)
  infoCard.BackgroundColor3 = Color3.fromRGB(28, 31, 40)
  infoCard.BorderSizePixel = 0
  infoCard.Parent = scroll
  local infoCorner = Instance.new("UICorner")
  infoCorner.CornerRadius = UDim.new(0, 6)
  infoCorner.Parent = infoCard

  local infoTitle = Instance.new("TextLabel")
  infoTitle.Size = UDim2.new(1, -16, 0, 22)
  infoTitle.Position = UDim2.fromOffset(8, 8)
  infoTitle.BackgroundTransparency = 1
  infoTitle.TextXAlignment = Enum.TextXAlignment.Left
  infoTitle.Font = Enum.Font.SourceSansBold
  infoTitle.TextSize = 17
  infoTitle.TextColor3 = Color3.fromRGB(255, 255, 255)
  infoTitle.Text = "Rebuild imported pack"
  infoTitle.Parent = infoCard

  local infoText = Instance.new("TextLabel")
  infoText.Size = UDim2.new(1, -16, 0, 84)
  infoText.Position = UDim2.fromOffset(8, 34)
  infoText.BackgroundTransparency = 1
  infoText.TextWrapped = true
  infoText.TextXAlignment = Enum.TextXAlignment.Left
  infoText.TextYAlignment = Enum.TextYAlignment.Top
  infoText.Font = Enum.Font.SourceSans
  infoText.TextSize = 15
  infoText.TextColor3 = Color3.fromRGB(186, 192, 204)
  infoText.Text = "1. Import every OBJ from the exported ZIP.\n2. Select the imported folder/model in Explorer.\n3. Click Rebuild.\n\nPlacement is ID-based: each mesh_XXXXX OBJ is placed at manifest.packOrigin plus its saved local offset."
  infoText.Parent = infoCard

  local function diagnoseImports()
local importedRoot = findImportedRoot()
if not importedRoot then
  warn("[3D Model Studio]", "Select the imported OBJ folder/model in Explorer, or create workspace.ImportedParts.")
  return
end

local checked = 0
local missing = 0
local function visitMesh(entry)
  checked += 1
  local ok, partOrMessage = pcall(function()
    return findImportedPart(importedRoot, entry)
  end)
  if ok and partOrMessage then
    local part = partOrMessage
    info("Import", checked, texturePathKey(entry), "source", part:GetFullName(), "sourcePos", tostring(part.Position), "sourceRot", tostring(part.Orientation), "targetPos", tostring(resolveEntryCFrame(entry).Position), "localOffset", tostring(robloxVectorFromStudio(entry.position)))
  else
    missing += 1
    warn("[3D Model Studio]", "Missing import for", texturePathKey(entry), entry.file, partOrMessage)
  end
end

local function visitGroup(node)
  for _, meshEntry in ipairs(node.meshes or {}) do
    visitMesh(meshEntry)
  end
  for _, child in ipairs(node.children or {}) do
    visitGroup(child)
  end
end

for _, node in ipairs(manifest.rootGroups or {}) do
  visitGroup(node)
end
for _, meshEntry in ipairs(manifest.rootMeshes or {}) do
  visitMesh(meshEntry)
end
info("Diagnose complete. Checked", checked, "mesh entries. Missing", missing)
  end

  rebuildButton.Click:Connect(function()
rebuild()
  end)
  rebuildNow.MouseButton1Click:Connect(function()
rebuild()
  end)
  diagnoseButton.MouseButton1Click:Connect(function()
diagnoseImports()
  end)
  markerToggle.MouseButton1Click:Connect(function()
createPlacementMarkers = not createPlacementMarkers
markerToggle.Text = createPlacementMarkers and "Markers: On" or "Markers: Off"
  end)
  menuButton.Click:Connect(function()
widget.Enabled = not widget.Enabled
  end)
else
  rebuild()
end
`;
}

function exportObjParts() {
  const targets = objects.slice();
  if (!targets.length) {
    log("No mesh parts to export.");
    return [];
  }
  const exporter = new OBJExporter();
  const usedNames = new Map();
  const exports = [];
  const fileEntries = [];
  const zipEntries = [];
  const baseProjectName = currentProjectBaseName();
  const robloxAxisMode = currentRobloxAxisMode();
  const packPrefix = robloxPackExportPrefix();
  const packRoot = `${baseProjectName}-roblox-pack`;
  for (const mesh of targets) {
    const pathSegments = hierarchySegmentsForMesh(mesh);
    const base = pathSegments.join(".");
    const count = (usedNames.get(base) || 0) + 1;
    usedNames.set(base, count);
    const exportId = robloxExportId(exports.length, packPrefix);
    const importName = exportId;
    const fileName = `${importName}.obj`;
    const { exportMesh, center, bounds, basis } = exportReadyMeshPart(mesh, { forRoblox: true, mirrorAxis: ROBLOX_PACK_GEOMETRY_MIRROR_AXES, robloxAxisMode });
    const text = exporter.parse(exportMesh);
    zipEntries.push({
      name: `${packRoot}/${fileName}`,
      data: text
    });
    exportMesh.geometry.dispose();
    exportMesh.material.dispose?.();
    exports.push(fileName);
    fileEntries.push({
      mesh,
      exportId,
      fileName,
      importName,
      baseImportName: importName,
      center,
      bounds,
      basis,
      pathSegments
    });
  }
  const manifest = robloxManifestForTargets(targets, fileEntries, packPrefix);
  const texturePackage = collectRobloxTextureFiles(packRoot);
  manifest.textureFiles = texturePackage.manifestFiles;
  zipEntries.push(...texturePackage.zipEntries);
  const manifestName = `${baseProjectName}-roblox-manifest.json`;
  const scriptName = `${baseProjectName}-roblox-setup.lua`;
  const pluginName = `${baseProjectName}-roblox-plugin.lua`;
  zipEntries.push(
    {
      name: `${packRoot}/${manifestName}`,
      data: JSON.stringify(manifest, null, 2)
    },
    {
      name: `${packRoot}/${scriptName}`,
      data: robloxSetupLua(manifest)
    },
    {
      name: `${packRoot}/${pluginName}`,
      data: robloxPluginLua(manifest)
    }
  );
  const zipBlob = makeZip(zipEntries);
  const zipName = `${packRoot}.zip`;
  downloadBlob(zipName, zipBlob);
  log(`Exported ${exports.length} Roblox-ready OBJ part${exports.length === 1 ? "" : "s"} into ${zipName}. The ZIP includes centered per-part OBJ files, the hierarchy manifest, and both Roblox rebuild scripts.`, {
    archive: zipName,
    rootFolder: packRoot,
    packId: packPrefix,
    axisMode: robloxAxisMode,
    geometryMirrorAxes: ROBLOX_PACK_GEOMETRY_MIRROR_AXES,
    textureFiles: texturePackage.zipEntries.length,
    objFiles: exports,
    manifest: manifestName,
    script: scriptName,
    plugin: pluginName
  });
  return exports;
}

function downloadDataUrl(name, dataUrl) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = name;
  a.click();
}

function xmlSafe(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;"
  })[char]);
}

function htmlAttr(value) {
  return xmlSafe(value);
}

function idSafe(value) {
  return String(value).replace(/[^A-Za-z0-9_-]/g, "_");
}

function fileSafe(value, fallback = "texture.png") {
  const clean = String(value || fallback).split(/[\\/]/).pop().replace(/[^A-Za-z0-9_.-]/g, "_");
  return clean.includes(".") ? clean : `${clean}.png`;
}

function exportColladaPackage() {
  const now = new Date().toISOString();
  const materialsByKey = new Map();
  const textureAssets = new Map();
  const geometries = [];
  const nodes = [];

  objects.forEach((mesh, index) => {
    mesh.updateMatrixWorld(true);
    const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    geometry.applyMatrix4(mesh.matrixWorld);
    geometry.computeVertexNormals();

    const position = geometry.getAttribute("position");
    const normal = geometry.getAttribute("normal");
    const uv = geometry.getAttribute("uv");
    const positions = [];
    const normals = [];
    const texcoords = [];
    const indices = [];
    const hasTexture = Boolean(mesh.userData.textureUrl && uv);

    for (let i = 0; i < position.count; i++) {
      positions.push(
        round(position.getX(i) * METERS_PER_ROBLOX_STUD),
        round(position.getY(i) * METERS_PER_ROBLOX_STUD),
        round(position.getZ(i) * METERS_PER_ROBLOX_STUD)
      );
      normals.push(round(normal.getX(i)), round(normal.getY(i)), round(normal.getZ(i)));
      if (hasTexture) {
        texcoords.push(...transformTextureUv(uv.getX(i), uv.getY(i), {
          textureFlipY: mesh.userData.textureFlipY ?? true,
          textureRotation: mesh.userData.textureRotation || 0
        }));
        indices.push(i, i, i);
      } else {
        indices.push(i, i);
      }
    }

    const geomId = `geom_${index}_${idSafe(mesh.name)}`;
    const matKey = hasTexture
      ? `mat_tex_${index}_${idSafe(mesh.userData.textureName || mesh.name)}`
      : `mat_${idSafe(mesh.userData.color || mesh.material.color.getHexString())}`;
    if (!materialsByKey.has(matKey)) {
      const color = new THREE.Color(mesh.userData.color || mesh.material.color);
      const textureFile = hasTexture ? uniqueTextureFileName(mesh.userData.textureName || `${mesh.name}.png`, textureAssets) : null;
      if (hasTexture && /^data:/i.test(mesh.userData.textureUrl)) {
        textureAssets.set(textureFile, mesh.userData.textureUrl);
      }
      materialsByKey.set(matKey, {
        id: matKey,
        color: [round(color.r), round(color.g), round(color.b), 1],
        textureUrl: hasTexture ? mesh.userData.textureUrl : null,
        textureName: hasTexture ? (mesh.userData.textureName || `${mesh.name}.png`) : null,
        textureFile
      });
    }

    const textureSource = hasTexture ? `
      <source id="${geomId}_texcoords">
        <float_array id="${geomId}_texcoords_array" count="${texcoords.length}">${texcoords.join(" ")}</float_array>
        <technique_common><accessor source="#${geomId}_texcoords_array" count="${position.count}" stride="2"><param name="S" type="float"/><param name="T" type="float"/></accessor></technique_common>
      </source>` : "";
    const texcoordInput = hasTexture ? `
        <input semantic="TEXCOORD" source="#${geomId}_texcoords" offset="2" set="0"/>` : "";

    geometries.push(`
  <geometry id="${geomId}" name="${xmlSafe(mesh.name)}">
    <mesh>
      <source id="${geomId}_positions">
        <float_array id="${geomId}_positions_array" count="${positions.length}">${positions.join(" ")}</float_array>
        <technique_common><accessor source="#${geomId}_positions_array" count="${position.count}" stride="3"><param name="X" type="float"/><param name="Y" type="float"/><param name="Z" type="float"/></accessor></technique_common>
      </source>
      <source id="${geomId}_normals">
        <float_array id="${geomId}_normals_array" count="${normals.length}">${normals.join(" ")}</float_array>
        <technique_common><accessor source="#${geomId}_normals_array" count="${normal.count}" stride="3"><param name="X" type="float"/><param name="Y" type="float"/><param name="Z" type="float"/></accessor></technique_common>
      </source>${textureSource}
      <vertices id="${geomId}_vertices"><input semantic="POSITION" source="#${geomId}_positions"/></vertices>
      <triangles material="${matKey}" count="${position.count / 3}">
        <input semantic="VERTEX" source="#${geomId}_vertices" offset="0"/>
        <input semantic="NORMAL" source="#${geomId}_normals" offset="1"/>${texcoordInput}
        <p>${indices.join(" ")}</p>
      </triangles>
    </mesh>
  </geometry>`);

    const textureBinding = hasTexture ? `<bind_vertex_input semantic="CHANNEL0" input_semantic="TEXCOORD" input_set="0"/>` : "";
    nodes.push(`<node id="node_${geomId}" name="${xmlSafe(mesh.name)}"><instance_geometry url="#${geomId}"><bind_material><technique_common><instance_material symbol="${matKey}" target="#${matKey}">${textureBinding}</instance_material></technique_common></bind_material></instance_geometry></node>`);
    geometry.dispose();
  });

  const images = [...materialsByKey.values()].filter(material => material.textureUrl).map(material => `
  <image id="${material.id}_image" name="${xmlSafe(material.textureName)}">
    <init_from>${xmlSafe(material.textureFile || material.textureUrl)}</init_from>
  </image>`).join("");

  const effects = [...materialsByKey.values()].map(material => material.textureUrl ? `
  <effect id="${material.id}_effect">
    <profile_COMMON>
      <newparam sid="${material.id}_surface">
        <surface type="2D"><init_from>${material.id}_image</init_from></surface>
      </newparam>
      <newparam sid="${material.id}_sampler">
        <sampler2D><source>${material.id}_surface</source></sampler2D>
      </newparam>
      <technique sid="common">
        <phong>
          <diffuse><texture texture="${material.id}_sampler" texcoord="CHANNEL0"/></diffuse>
          <specular><color>0.12 0.12 0.12 1</color></specular>
          <shininess><float>24</float></shininess>
        </phong>
      </technique>
    </profile_COMMON>
  </effect>` : `
  <effect id="${material.id}_effect">
    <profile_COMMON>
      <technique sid="common">
        <phong>
          <diffuse><color>${material.color.join(" ")}</color></diffuse>
          <specular><color>0.12 0.12 0.12 1</color></specular>
          <shininess><float>24</float></shininess>
        </phong>
      </technique>
    </profile_COMMON>
  </effect>`).join("");

  const mats = [...materialsByKey.values()].map(material => `<material id="${material.id}" name="${material.id}"><instance_effect url="#${material.id}_effect"/></material>`).join("\n      ");

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<COLLADA xmlns="http://www.collada.org/2005/11/COLLADASchema" version="1.4.1">
  <asset>
<contributor><authoring_tool>3D Model Studio</authoring_tool></contributor>
<created>${now}</created>
<modified>${now}</modified>
<unit name="meter" meter="1"/>
<up_axis>Y_UP</up_axis>
  </asset>
  <library_images>${images}
  </library_images>
  <library_effects>${effects}
  </library_effects>
  <library_materials>
  ${mats}
  </library_materials>
  <library_geometries>${geometries.join("")}
  </library_geometries>
  <library_visual_scenes>
<visual_scene id="Scene" name="Scene">
  ${nodes.join("\n      ")}
</visual_scene>
  </library_visual_scenes>
  <scene><instance_visual_scene url="#Scene"/></scene>
</COLLADA>`;
  return { xml, textureAssets };
}

function uniqueTextureFileName(name, assets) {
  const safe = fileSafe(name);
  if (!assets.has(safe)) return safe;
  const dot = safe.lastIndexOf(".");
  const base = dot >= 0 ? safe.slice(0, dot) : safe;
  const ext = dot >= 0 ? safe.slice(dot) : ".png";
  let index = 2;
  while (assets.has(`${base}_${index}${ext}`)) index++;
  return `${base}_${index}${ext}`;
}

function transformTextureUv(u, v, { textureFlipY = true, textureRotation = 0 } = {}) {
  let x = u;
  let y = textureFlipY ? 1 - v : v;
  const rotation = normalizeTextureRotation(-textureRotation);
  if (rotation === 90) {
    [x, y] = [1 - y, x];
  } else if (rotation === 180) {
    x = 1 - x;
    y = 1 - y;
  } else if (rotation === 270) {
    [x, y] = [y, 1 - x];
  } else if (rotation !== 0) {
    const radians = THREE.MathUtils.degToRad(rotation);
    const cx = x - .5;
    const cy = y - .5;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    x = cx * cos - cy * sin + .5;
    y = cx * sin + cy * cos + .5;
  }
  return [round(x), round(y)];
}

function exportCollada() {
  return exportColladaPackage().xml;
}

function textureInfoFromMaterial(material) {
  const source = Array.isArray(material) ? material.find(item => item?.map)?.map : material?.map;
  const hasTextureMap = !!source;
  const imageSource = source?.image?.currentSrc || source?.image?.src || source?.source?.data?.currentSrc || source?.source?.data?.src || null;
  if (!imageSource) return hasTextureMap ? { hasTextureMap: true } : {};
  return {
    hasTextureMap: true,
    textureUrl: imageSource,
    textureName: source.name || source.userData?.fileName || "",
    textureFlipY: source.flipY ?? true,
    textureRotation: normalizeTextureRotation(THREE.MathUtils.radToDeg(source.rotation || 0))
  };
}

function meshSpecFromImportedMesh(mesh, fallbackName, color = "#8a959b") {
  const source = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  source.applyMatrix4(mesh.matrixWorld);
  const box = new THREE.Box3().setFromBufferAttribute(source.getAttribute("position"));
  const center = box.getCenter(new THREE.Vector3());
  source.translate(-center.x, -center.y, -center.z);
  const geometry = geometryToData(source);
  source.dispose();
  const textureInfo = textureInfoFromMaterial(mesh.material);
  return {
    shape: "custom",
    geometry,
    name: mesh.name || fallbackName,
    position: center.toArray().map(round),
    scale: [1, 1, 1],
    color: textureInfo.hasTextureMap ? "#ffffff" : color,
    roughness: .72,
    ...textureInfo
  };
}

function normalizeImportedSpecs(specs, { fitToWorkspace = true } = {}) {
  const temp = new THREE.Group();
  for (const spec of specs) temp.add(createMesh({ ...spec }));
  const box = new THREE.Box3().setFromObject(temp);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxAxis = Math.max(size.x, size.y, size.z, 1);
  const factor = fitToWorkspace ? (maxAxis > 7 ? 7 / maxAxis : maxAxis < 1 ? 1 / maxAxis : 1) : 1;
  temp.traverse(child => {
    if (child.isMesh) {
      child.geometry.dispose();
      child.material.dispose();
    }
  });
  return specs.map(spec => ({
    ...spec,
    position: [
      round((spec.position[0] - center.x) * factor),
      round((spec.position[1] - center.y) * factor + size.y * factor / 2),
      round((spec.position[2] - center.z) * factor)
    ],
    scale: spec.scale.map(value => round(value * factor))
  }));
}

function specsFromObject3D(parsed, fileName, { unitScale = 1 } = {}) {
  parsed.updateMatrixWorld(true);
  const specs = [];
  let meshCount = 0;
  parsed.traverse(child => {
    if (!child.isMesh || !child.geometry?.getAttribute("position")) return;
    const color = child.material?.color ? `#${child.material.color.getHexString()}` : "#8a959b";
    const spec = meshSpecFromImportedMesh(child, `${fileName} part ${++meshCount}`, color);
    spec.geometry.positions = spec.geometry.positions.map(value => round(value * unitScale));
    spec.position = spec.position.map(value => round(value * unitScale));
    specs.push(spec);
  });
  return specs;
}

function importSpecsAsScene(specs, fileName, sourceLabel, { preserveScale = false } = {}) {
  if (!specs.length) {
    log(`No meshes found in ${fileName}.`);
    return;
  }
  clearObjects({ record: false });
  const normalized = normalizeImportedSpecs(specs, { fitToWorkspace: !preserveScale });
  for (const spec of normalized) addObject(spec, { record: false });
  selectObject(objects.at(-1) || null);
  frameSelected();
  log(`Imported ${sourceLabel} ${fileName} as ${normalized.length} editable mesh part${normalized.length === 1 ? "" : "s"}${preserveScale ? " at Roblox stud scale" : ""}.`);
}

function importObjText(text, fileName) {
  recordHistory("import obj");
  const parsed = new OBJLoader().parse(text);
  importSpecsAsScene(specsFromObject3D(parsed, fileName), fileName, "OBJ", { preserveScale: true });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(reader.error || new Error(`Could not read ${file.name}.`)));
    reader.readAsDataURL(file);
  });
}

async function importObjFiles(fileList) {
  const files = [...fileList];
  const objFile = files.find(file => /\.obj$/i.test(file.name));
  if (!objFile) throw new Error("Select an .obj file, or use OBJ Folder for an OBJ + MTL + texture bundle.");

  const mtlFile = files.find(file => /\.mtl$/i.test(file.name));
  const assetUrls = new Map();
  for (const file of files) {
    if (!/\.(obj|mtl)$/i.test(file.name)) {
      const dataUrl = await readFileAsDataUrl(file);
      assetUrls.set(file.name, dataUrl);
      if (isImageFileName(file.name)) registerTextureAsset(file.name, dataUrl);
    }
  }
  refreshTextureLibraryUi();

  const objText = await objFile.text();
  const loader = new OBJLoader();
  if (mtlFile) {
    const manager = new THREE.LoadingManager();
    manager.setURLModifier(url => {
      const clean = decodeURIComponent(url).split(/[\\/]/).pop();
      return assetUrls.get(clean) || assetUrls.get(url) || url;
    });
    const materials = new MTLLoader(manager).parse(await mtlFile.text(), "");
    materials.preload();
    loader.setMaterials(materials);
  }

  recordHistory("import obj");
  const parsed = loader.parse(objText);
  importSpecsAsScene(specsFromObject3D(parsed, objFile.name), objFile.name, mtlFile ? "OBJ + MTL" : "OBJ", { preserveScale: true });
}

function importDaeText(text, fileName) {
  recordHistory("import dae");
  const parsed = new ColladaLoader().parse(text);
  importSpecsAsScene(specsFromObject3D(parsed.scene, fileName, { unitScale: ROBLOX_STUDS_PER_METER }), fileName, "DAE", { preserveScale: true });
}

function viewSpaceMultiplier() {
  return Math.max(1, Math.min(20, Number(els.viewSpaceInput?.value) || 1.5));
}

function shotSpaceMultiplier() {
  return Math.max(.5, Math.min(4, Number(els.shotSpaceInput?.value) || 0.85));
}

function syncGridVisibility() {
  if (suppressViewportEnvironment) {
    grid.visible = false;
    gridLabelGroup.visible = false;
    photoEnvironment.visible = false;
    floor.visible = false;
    studioFloor.visible = false;
    return;
  }
  const environment = els.environmentSelect?.value || "plain";
  const background = els.backgroundSelect?.value || "plain";
  photoEnvironment.visible = environment === "road";
  floor.visible = false;
  studioFloor.visible = environment === "studio";
  grid.visible = !!els.showGridInput?.checked;
  scene.background = background === "sky"
    ? skyTexture
    : background === "sunset"
      ? sunsetTexture
      : background === "plain"
        ? plainBackground
        : studioBackground;
  scene.fog = environment === "road" && background === "sky"
    ? roadFog
    : environment === "road" && background === "sunset"
      ? sunsetFog
      : null;
  updateGridLabels();
}

function updateViewScale(size = 18) {
  const gridSize = Math.max(18, size * viewSpaceMultiplier() * 2.5);
  const scale = gridSize / 18;
  grid.scale.setScalar(scale);
  syncGridVisibility();
  updateGridLabels();
  floor.scale.setScalar(Math.max(1, gridSize / 40));
  studioFloor.scale.setScalar(Math.max(1, gridSize / 80));
  orbit.maxDistance = Math.max(500000, gridSize * 100);
  camera.far = Math.max(1000000, gridSize * 250);
  camera.updateProjectionMatrix();
}

function selectedTrianglesBounds() {
  if (!selectedFaces.length) return null;
  const box = new THREE.Box3();
  for (const face of selectedFaces) {
    for (const point of worldTrianglePoints(face)) box.expandByPoint(point);
  }
  return box.isEmpty() ? null : box;
}

function frameSelected() {
  let box = selectedTrianglesBounds();
  if (!box) box = new THREE.Box3();
  const transformTargets = transformTargetObjects();
  if (box && !box.isEmpty()) {
    // already set from triangle selection
  }
  else if (transformTargets.length > 1) {
    for (const object of transformTargets) box.expandByObject(object);
  }
  else if (selected) box.setFromObject(selected);
  else if (activeGroupObjects().length > 1) {
    for (const object of activeGroupObjects()) box.expandByObject(object);
  }
  else {
    const modelGroup = new THREE.Group();
    for (const object of objects) modelGroup.add(object.clone());
    box.setFromObject(modelGroup);
  }
  const center = box.getCenter(new THREE.Vector3());
  const sizeVector = box.getSize(new THREE.Vector3());
  const size = selectedFaces.length
    ? Math.max(sizeVector.x, sizeVector.y, sizeVector.z, .2)
    : Math.max(sizeVector.x, sizeVector.y, sizeVector.z, 4);
  const space = viewSpaceMultiplier();
  updateViewScale(size);
  orbit.target.copy(center);
  if (selectedFaces.length) {
    const direction = camera.position.clone().sub(orbit.target);
    if (direction.lengthSq() < 1e-6) direction.set(.78, .52, .92);
    direction.normalize();
    const distance = Math.max(.18, size * 2.2 * space);
    camera.position.copy(center).add(direction.multiplyScalar(distance));
  } else {
    camera.position.copy(center).add(new THREE.Vector3(size * .78 * space, size * .52 * space, size * .92 * space));
  }
  camera.near = Math.max(.01, size / 2000);
  camera.far = Math.max(1000000, size * space * 100);
  camera.updateProjectionMatrix();
  orbit.update();
}

const screenshotViewDirections = {
  front: new THREE.Vector3(0, .05, 1),
  back: new THREE.Vector3(0, .05, -1),
  left: new THREE.Vector3(-1, .05, 0),
  right: new THREE.Vector3(1, .05, 0),
  top: new THREE.Vector3(0, 1, .001),
  iso: new THREE.Vector3(.78, .52, .92)
};

function sceneBounds() {
  const box = new THREE.Box3();
  for (const object of objects) box.expandByObject(object);
  if (!objects.length || box.isEmpty()) {
    box.setFromCenterAndSize(new THREE.Vector3(0, 1, 0), new THREE.Vector3(4, 3, 4));
  }
  return box;
}

function setCameraToView(viewName, { useCurrentZoom = false, currentDistance = null } = {}) {
  const box = sceneBounds();
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z, 2);
  const defaultSpace = shotSpaceMultiplier();
  updateViewScale(radius);
  const direction = (screenshotViewDirections[viewName] || screenshotViewDirections.iso).clone().normalize();
  const baseDistance = radius / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * .82;
  const currentSpace = useCurrentZoom && currentDistance ? Math.max(.2, currentDistance / Math.max(.001, baseDistance)) : defaultSpace;
  const distance = baseDistance * currentSpace;
  camera.position.copy(center).add(direction.multiplyScalar(distance));
  camera.near = Math.max(.01, distance / 2000);
  camera.far = Math.max(1000000, distance * 60);
  camera.up.set(0, viewName === "top" ? 0 : 1, viewName === "top" ? -1 : 0);
  orbit.target.copy(center);
  camera.lookAt(center);
  camera.updateProjectionMatrix();
  orbit.update();
}

function captureView(viewName = "iso", { download = false, prefix = currentProjectBaseName() } = {}) {
  const oldPosition = camera.position.clone();
  const oldUp = camera.up.clone();
  const oldTarget = orbit.target.clone();
  const oldDistance = oldPosition.distanceTo(oldTarget);
  const oldNear = camera.near;
  const oldFar = camera.far;
  const oldTransformVisible = transform.visible;
  const oldFaceMarkerVisible = faceMarker.visible;
  const oldSelectionOutlineVisible = selectionOutlineGroup.visible;
  const oldOpeningPickGuideVisible = openingPickGuideGroup.visible;
  const oldMarkerGroupVisible = markerGroup.visible;
  const oldGridVisible = grid.visible;
  const oldGridLabelsVisible = gridLabelGroup.visible;

  transform.visible = false;
  faceMarker.visible = false;
  selectionOutlineGroup.visible = false;
  openingPickGuideGroup.visible = false;
  markerGroup.visible = false;
  if (els.hideGridInShotsInput?.checked) {
    grid.visible = false;
    gridLabelGroup.visible = false;
  }
  resize();
  setCameraToView(viewName, {
    useCurrentZoom: els.useCurrentZoomInShotsInput?.checked ?? true,
    currentDistance: oldDistance
  });
  if (els.hideGridInShotsInput?.checked) {
    grid.visible = false;
    gridLabelGroup.visible = false;
  }
  renderer.render(scene, camera);

  const dataUrl = canvas.toDataURL("image/png");
  const shot = {
    view: viewName,
    fileName: `${prefix}-${viewName}.png`,
    width: canvas.width,
    height: canvas.height,
    dataUrl
  };
  if (download) downloadDataUrl(shot.fileName, dataUrl);

  transform.visible = oldTransformVisible;
  faceMarker.visible = oldFaceMarkerVisible;
  selectionOutlineGroup.visible = oldSelectionOutlineVisible;
  openingPickGuideGroup.visible = oldOpeningPickGuideVisible;
  markerGroup.visible = oldMarkerGroupVisible;
  grid.visible = oldGridVisible;
  gridLabelGroup.visible = oldGridLabelsVisible;
  camera.position.copy(oldPosition);
  camera.up.copy(oldUp);
  camera.near = oldNear;
  camera.far = oldFar;
  orbit.target.copy(oldTarget);
  camera.lookAt(oldTarget);
  camera.updateProjectionMatrix();
  orbit.update();
  renderer.render(scene, camera);
  return shot;
}

function waitForSceneTextures(timeoutMs = 10000) {
  const images = new Set();
  for (const object of objects) {
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (material?.map?.image) images.add(material.map.image);
    }
  }
  const pending = [...images].filter(image => !(image.complete && (image.naturalWidth || image.width)));
  if (!pending.length) return Promise.resolve({ total: images.size, waited: 0 });
  return Promise.all(pending.map(image => new Promise(resolve => {
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      resolve();
    };
    image.addEventListener?.("load", done, { once: true });
    image.addEventListener?.("error", done, { once: true });
    setTimeout(done, timeoutMs);
  }))).then(() => ({ total: images.size, waited: pending.length }));
}

function previewShotView(viewName = "iso") {
  const currentDistance = camera.position.distanceTo(orbit.target);
  setCameraToView(viewName, {
    useCurrentZoom: els.useCurrentZoomInShotsInput?.checked ?? true,
    currentDistance
  });
  log(`Previewing ${viewName} shot framing.`);
}

async function captureViews({ views = ["front", "back", "left", "right", "top", "iso"], download = false, prefix = currentProjectBaseName() } = {}) {
  await waitForSceneTextures();
  return views.map(view => captureView(view, { download, prefix }));
}

async function saveSingleViewPng(viewName = "iso") {
  const prefix = currentProjectBaseName();
  await waitForSceneTextures();
  const shot = captureView(viewName, { download: true, prefix });
  log(`Saved ${viewName} PNG view.`, shot.fileName);
  return shot;
}

function loadShotImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not compose QA view image."));
    image.src = dataUrl;
  });
}

async function saveQaSheet() {
  const prefix = currentProjectBaseName();
  const shots = await captureViews({ download: false, prefix });
  const images = await Promise.all(shots.map(shot => loadShotImage(shot.dataUrl)));
  const cellWidth = 640;
  const cellHeight = 420;
  const sheet = document.createElement("canvas");
  sheet.width = cellWidth * 3;
  sheet.height = cellHeight * 2;
  const context = sheet.getContext("2d");
  context.fillStyle = "#0d1113";
  context.fillRect(0, 0, sheet.width, sheet.height);
  images.forEach((image, index) => {
    const x = (index % 3) * cellWidth;
    const y = Math.floor(index / 3) * cellHeight;
    const scale = Math.min(cellWidth / image.width, cellHeight / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    context.drawImage(image, x + (cellWidth - width) / 2, y + (cellHeight - height) / 2, width, height);
    context.fillStyle = "rgba(5, 8, 9, .82)";
    context.fillRect(x + 12, y + 12, 132, 34);
    context.fillStyle = "#f1c65b";
    context.font = "700 18px system-ui, sans-serif";
    context.fillText(shots[index].view.toUpperCase(), x + 24, y + 35);
    context.strokeStyle = "#344047";
    context.strokeRect(x + .5, y + .5, cellWidth - 1, cellHeight - 1);
  });
  const fileName = `${prefix}-qa-sheet.png`;
  const dataUrl = sheet.toDataURL("image/png");
  downloadDataUrl(fileName, dataUrl);
  log("Saved one six-view AI QA sheet after all textures finished loading.", {
    fileName,
    views: shots.map(shot => shot.view),
    objects: objects.length
  });
  return { fileName, width: sheet.width, height: sheet.height, dataUrl, shots };
}
function visibleSpriteObjects() {
  return objects.filter(object => object.visible && !object.userData?.hidden);
}

function boundsToPlainObject(box) {
  return {
    min: { x: box.min.x, y: box.min.y, z: box.min.z },
    max: { x: box.max.x, y: box.max.y, z: box.max.z },
    size: {
      x: box.max.x - box.min.x,
      y: box.max.y - box.min.y,
      z: box.max.z - box.min.z
    }
  };
}

function objectBoundsPlainObject(object) {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return null;
  return boundsToPlainObject(box);
}

function renderTransparentDataUrl() {
  renderer.setClearAlpha(0);
  renderer.render(scene, camera);
  return canvas.toDataURL("image/png");
}

function captureBolt2dRightFacingLayers({ prefix = currentProjectBaseName() } = {}) {
  const oldPosition = camera.position.clone();
  const oldUp = camera.up.clone();
  const oldTarget = orbit.target.clone();
  const oldNear = camera.near;
  const oldFar = camera.far;
  const oldSceneBackground = scene.background;
  const oldSceneFog = scene.fog;
  const oldPhotoEnvironmentVisible = photoEnvironment.visible;
  const oldFloorVisible = floor.visible;
  const oldStudioFloorVisible = studioFloor.visible;
  const oldTransformVisible = transform.visible;
  const oldFaceMarkerVisible = faceMarker.visible;
  const oldSelectionOutlineVisible = selectionOutlineGroup.visible;
  const oldOpeningPickGuideVisible = openingPickGuideGroup.visible;
  const oldMarkerGroupVisible = markerGroup.visible;
  const oldGridVisible = grid.visible;
  const oldGridLabelsVisible = gridLabelGroup.visible;
  const oldObjectVisibility = objects.map(object => ({ object, visible: object.visible }));

  const spriteObjects = visibleSpriteObjects();
  suppressViewportEnvironment = true;
  transform.visible = false;
  faceMarker.visible = false;
  selectionOutlineGroup.visible = false;
  openingPickGuideGroup.visible = false;
  markerGroup.visible = false;
  grid.visible = false;
  gridLabelGroup.visible = false;
  photoEnvironment.visible = false;
  studioFloor.visible = false;
  scene.background = null;
  scene.fog = null;
  resize();
  setCameraToView("right", { useCurrentZoom: false });

  for (const { object } of oldObjectVisibility) object.visible = spriteObjects.includes(object);
  const compositeDataUrl = renderTransparentDataUrl();
  const width = canvas.width;
  const height = canvas.height;
  const layers = spriteObjects.map((object, index) => {
    for (const { object: candidate } of oldObjectVisibility) candidate.visible = candidate === object;
    return {
      id: object.userData?.modelId || object.uuid,
      name: object.name || `Layer ${index + 1}`,
      index,
      view: "right",
      bounds3d: objectBoundsPlainObject(object),
      fileName: `${prefix}-right-layer-${String(index + 1).padStart(2, "0")}-${safeFileName(object.name || "layer", "layer")}.png`,
      dataUrl: renderTransparentDataUrl()
    };
  });

  for (const { object } of oldObjectVisibility) object.visible = spriteObjects.includes(object);
  const referenceViews = {};
  for (const view of ["front", "back", "left", "right", "iso"]) {
    setCameraToView(view, { useCurrentZoom: false });
    referenceViews[view] = {
      fileName: `${prefix}-${view}.png`,
      dataUrl: renderTransparentDataUrl()
    };
  }

  for (const { object, visible } of oldObjectVisibility) object.visible = visible;
  suppressViewportEnvironment = false;
  scene.background = oldSceneBackground;
  scene.fog = oldSceneFog;
  photoEnvironment.visible = oldPhotoEnvironmentVisible;
  floor.visible = oldFloorVisible;
  studioFloor.visible = oldStudioFloorVisible;
  transform.visible = oldTransformVisible;
  faceMarker.visible = oldFaceMarkerVisible;
  selectionOutlineGroup.visible = oldSelectionOutlineVisible;
  openingPickGuideGroup.visible = oldOpeningPickGuideVisible;
  markerGroup.visible = oldMarkerGroupVisible;
  grid.visible = oldGridVisible;
  gridLabelGroup.visible = oldGridLabelsVisible;
  camera.position.copy(oldPosition);
  camera.up.copy(oldUp);
  camera.near = oldNear;
  camera.far = oldFar;
  orbit.target.copy(oldTarget);
  camera.lookAt(oldTarget);
  camera.updateProjectionMatrix();
  orbit.update();
  renderer.setClearAlpha(1);
  renderer.render(scene, camera);

  return {
    kind: "boltworks-3d-to-2d-sprite-package",
    version: 1,
    createdAt: new Date().toISOString(),
    source: {
      tool: "BoltWorks 3D / ai-modeler-studio",
      projectName: prefix,
      objectCount: objects.length,
      visibleLayerCount: layers.length
    },
    authoring: {
      facing: "right",
      intendedUse: "BoltWorks Asset Studio / Character Animator",
      note: "Right-facing layers are exported with a shared camera so they can be stacked in 2D without repositioning. The 2D game can mirror the final sprite when moving left."
    },
    canvas: { width, height },
    sceneBounds: boundsToPlainObject(sceneBounds()),
    composite: {
      view: "right",
      fileName: `${prefix}-right-composite.png`,
      dataUrl: compositeDataUrl
    },
    layers,
    referenceViews
  };
}

function exportBolt2dPackage() {
  const prefix = currentProjectBaseName();
  const pack = captureBolt2dRightFacingLayers({ prefix });
  download(`${prefix}.bolt2d.json`, JSON.stringify(pack, null, 2), "application/json");
  log(`Exported Bolt 2D sprite package with ${pack.layers.length} right-facing layer${pack.layers.length === 1 ? "" : "s"}.`, `${prefix}.bolt2d.json`);
}
