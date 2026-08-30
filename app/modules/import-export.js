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
    opacity: round(mesh.material.opacity ?? 1),
    hidden: !!mesh.userData.hidden,
    groupId: mesh.userData.groupId || null,
    groupName: mesh.userData.groupName || null,
    rigBoneId: mesh.userData.rigBoneId || null,
    rigRole: mesh.userData.rigRole === "armor" ? "armor" : (mesh.userData.rigRole === "skin" ? "skin" : null),
    rigArmorMountId: mesh.userData.rigArmorMountId || null,
    rigAttachment: mesh.userData.rigAttachment === "rigidArmor" ? "rigidArmor" : null,
    linkColor: mesh.userData.linkColor || null,
    textureUrl: mesh.userData.textureUrl || null,
    textureName: mesh.userData.textureName || null,
    textureRobloxAssetId: normalizeRobloxAssetId(mesh.userData.textureRobloxAssetId || ""),
    materialRule: normalizeMaterialRule(mesh.userData.materialRule || "auto"),
    textureFlipY: mesh.userData.textureFlipY ?? true,
    textureRotation: normalizeTextureRotation(mesh.userData.textureRotation || 0),
    tileTextureRepeatU: Number(mesh.userData.tileTextureRepeatU) || 1,
    tileTextureRepeatV: Number(mesh.userData.tileTextureRepeatV) || 1,
    tileTextureEdgeTrim: Number(mesh.userData.tileTextureEdgeTrim) || 0,
    textureHasTransparency: !!mesh.userData.textureHasTransparency,
    roughnessTextureUrl: mesh.userData.roughnessTextureUrl || null,
    roughnessTextureName: mesh.userData.roughnessTextureName || null,
    metalnessTextureUrl: mesh.userData.metalnessTextureUrl || null,
    metalnessTextureName: mesh.userData.metalnessTextureName || null,
    emissiveTextureUrl: mesh.userData.emissiveTextureUrl || null,
    emissiveTextureName: mesh.userData.emissiveTextureName || null,
    playerAvatar: !!mesh.userData.playerAvatar,
    playerHeadOffset: Array.isArray(mesh.userData.playerHeadOffset) ? [...mesh.userData.playerHeadOffset] : null,
    gameAsset: mesh.userData.gameAsset ? JSON.parse(JSON.stringify(mesh.userData.gameAsset)) : null,
    liveMirror: mesh.userData.liveMirror?.enabled ? {
      enabled: true,
      axis: ["x", "y", "z"].includes(mesh.userData.liveMirror.axis) ? mesh.userData.liveMirror.axis : "x",
      plane: Number(mesh.userData.liveMirror.plane) || 0
    } : null,
    lod: mesh.userData.lod ? { ...mesh.userData.lod } : null,
    minecraft: mesh.userData.minecraft ? JSON.parse(JSON.stringify(mesh.userData.minecraft)) : null,
    edgeBevelProtectedEdges: Array.isArray(mesh.userData.edgeBevelProtectedEdges) ? [...mesh.userData.edgeBevelProtectedEdges] : [],
    dissolvedSurfaceEdges: Array.isArray(mesh.userData.dissolvedSurfaceEdges) ? [...mesh.userData.dissolvedSurfaceEdges] : []
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
    faceTools: ["triangleSelect", "coplanarFaceSelect", "vertexSelect", "edgeSelect", "paintSelect", "areaSelect", "marker", "lineSketch", "makeFaceFromSketch", "fillLineFromSketch", "cutHoleFromSketch", "deleteTriangles", "extractTriangles", "fillHole", "findRepairHoles", "copyTriangles", "pasteTriangles", "extend", "pull", "pullToTarget", "push", "dragPush", "bevelFace", "weldVertices", "dissolveEdge", "dissolveVertex", "liveMirror", "scaleSelectedSurface", "relaxVertices", "smoothVertices", "knifeCut", "planeCut", "bridgeEdgeLoops", "cutTopBottom", "protectedDecimate", "lodGenerator"],
    textureTools: ["addTexture", "changeTexture", "clearTexture", "flipTexture", "rotateTexture", "saveTextureImage", "textureLibrary", "baseColorPaint", "roughnessPaint", "metalnessPaint", "emissivePaint"],
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
    for (const [urlKey, nameKey] of materialTextureReferenceFields()) {
      const libraryName = textureNameByUrl.get(object[urlKey]);
      if (!libraryName) continue;
      object[nameKey] = libraryName;
      object[urlKey] = null;
    }
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
      workspace: document.body.dataset.workspace === "minecraft" ? "minecraft" : "general",
      selectedId: selected?.userData?.id || null,
      selectedGroupId: selectedGroupRecordId || null,
      checkedIds: [...checkedIds],
      activeGroupIds: [...activeGroupIds],
      activeTransformMode,
      facePickMode,
      referenceImage: {
        name: referenceImageState.name,
        dataUrl: referenceImageState.dataUrl,
        mode: referenceImageState.mode,
        opacity: round(referenceImageState.opacity),
        scale: round(referenceImageState.scale),
        offsetX: round(referenceImageState.offsetX),
        offsetY: round(referenceImageState.offsetY)
      },
      cameraViews: {
        selectedId: selectedCustomCameraId,
        showMarkers: !!els.showCustomCamerasInput?.checked,
        views: customCameraViews.map(view => ({
          id: view.id,
          name: view.name,
          type: view.type || "director",
          anchorBoneId: view.anchorBoneId || null,
          position: view.position.map(round),
          target: view.target.map(round),
          up: view.up.map(round),
          fov: round(view.fov),
          positionOffset: validCameraVector(view.positionOffset, [0, 0, 0]).map(round),
          localDirection: validCameraVector(view.localDirection, [0, 0, -1]).map(round),
          localUp: validCameraVector(view.localUp, [0, 1, 0]).map(round)
        }))
      },
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
        aiViewerCollapsed: els.aiViewerSection?.classList.contains("collapsed") ?? true,
        referenceImageCollapsed: els.referenceImageSection.classList.contains("collapsed"),
        cameraViewsCollapsed: els.cameraViewsSection.classList.contains("collapsed"),
        statusCollapsed: els.statusSection.classList.contains("collapsed"),
        modelToolsOpen: !els.modelToolsWindow?.classList.contains("collapsed"),
        outputToolsOpen: !els.outputToolsWindow?.classList.contains("collapsed")
      },
      toolbars: toolbarVisibilityState(),
      tools: {
        rotationSnap: Number(els.rotationSnapSelect.value) || 0,
        bevelType: els.bevelTypeSelect.value,
        bevelSize: Number(els.bevelSizeInput.value) || 0.16,
        bevelDepth: Number(els.bevelDepthInput.value) || 0.18,
        edgeBevelWidth: Number(els.edgeBevelWidthInput?.value) || 0.08,
        subdivideLevels: Math.max(1, Math.min(2, Math.round(Number(els.subdivideLevelsInput?.value) || 1))),
        loopCutAxis: ["x", "y", "z"].includes(els.loopCutAxisSelect?.value) ? els.loopCutAxisSelect.value : "y",
        loopCutPosition: Math.max(1, Math.min(99, Number(els.loopCutPositionInput?.value) || 50)),
        loopCutCount: Math.max(1, Math.min(8, Math.round(Number(els.loopCutCountInput?.value) || 1))),
        knifeCutThrough: !!els.knifeCutThroughInput?.checked,
        planeCutAxis: ["x", "y", "z"].includes(els.planeCutAxisSelect?.value) ? els.planeCutAxisSelect.value : "y",
        planeCutPosition: Math.max(1, Math.min(99, Number(els.planeCutPositionInput?.value) || 50)),
        planeCutResult: ["both", "positive", "negative"].includes(els.planeCutResultSelect?.value) ? els.planeCutResultSelect.value : "both",
        planeCutCap: !!els.planeCutCapInput?.checked,
        edgeSlideAxis: ["auto", "x", "y", "z"].includes(els.edgeSlideAxisSelect?.value) ? els.edgeSlideAxisSelect.value : "auto",
        edgeSlideAmount: Math.max(-95, Math.min(95, Number.isFinite(Number(els.edgeSlideAmountInput?.value)) ? Number(els.edgeSlideAmountInput.value) : 10)),
        surfaceScaleAxis: ["uniform", "x", "y", "z"].includes(els.surfaceScaleAxisSelect?.value) ? els.surfaceScaleAxisSelect.value : "uniform",
        surfaceScaleAmount: Math.max(1, Math.min(1000, Number(els.surfaceScaleAmountInput?.value) || 80)),
        relaxMode: els.relaxModeSelect?.value === "smooth" ? "smooth" : "relax",
        relaxStrength: Math.max(1, Math.min(100, Number(els.relaxStrengthInput?.value) || 50)),
        relaxIterations: Math.max(1, Math.min(20, Math.round(Number(els.relaxIterationsInput?.value) || 1))),
        relaxPreserveBoundary: !!els.relaxPreserveBoundaryInput?.checked,
        weldVertexTarget: ["center", "first", "last"].includes(els.weldVertexTargetSelect?.value) ? els.weldVertexTargetSelect.value : "center",
        dragPushAxis: els.dragPushAxisSelect.value || "free",
        dragPushStep: Number(els.dragPushStepInput.value) || 0.01,
        insetAmount: Number(els.insetAmountInput?.value) || 0.10,
        softRadius: Number(els.softRadiusInput?.value) || 0.25,
        surfaceInteractionMode: surfaceInteractionMode(),
        surfaceComponentMode,
        surfaceSelectionSource,
        surfaceMouseFalloff: els.surfaceMouseFalloffSelect?.value === "hard" ? "hard" : "soft",
        autoSurfaceDrag: !!els.autoSurfaceDragInput?.checked,
        showModelingEdges: !!els.showModelingEdgesInput?.checked,
        surfaceEditorOpen: !els.surfaceEditorWindow?.classList.contains("collapsed"),
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
      rigging: serializeBoneRig(),
      minecraft: serializeMinecraftWorkspace()
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
    for (const [urlKey, nameKey] of materialTextureReferenceFields()) {
      if (object[urlKey] || !object[nameKey]) continue;
      object[urlKey] = textureByName.get(object[nameKey]) || null;
    }
  }
}

function materialTextureReferenceFields() {
  return [
    ["textureUrl", "textureName"],
    ["roughnessTextureUrl", "roughnessTextureName"],
    ["metalnessTextureUrl", "metalnessTextureName"],
    ["emissiveTextureUrl", "emissiveTextureName"]
  ];
}

function syncReferenceImageUi() {
  const hasImage = typeof referenceImageState.dataUrl === "string" && referenceImageState.dataUrl.startsWith("data:image/");
  const mode = ["panel", "overlay", "both"].includes(referenceImageState.mode) ? referenceImageState.mode : "panel";
  const opacity = Math.max(.05, Math.min(1, Number(referenceImageState.opacity) || .45));
  const scale = Math.max(.25, Math.min(4, Number(referenceImageState.scale) || 1));
  const offsetX = Math.max(-200, Math.min(200, Number(referenceImageState.offsetX) || 0));
  const offsetY = Math.max(-200, Math.min(200, Number(referenceImageState.offsetY) || 0));
  referenceImageState.mode = mode;
  referenceImageState.opacity = opacity;
  referenceImageState.scale = scale;
  referenceImageState.offsetX = offsetX;
  referenceImageState.offsetY = offsetY;
  els.referenceImageMode.value = mode;
  els.referenceImageOpacity.value = String(opacity);
  els.referenceImageOpacityValue.value = `${Math.round(opacity * 100)}%`;
  els.referenceImageScale.value = String(scale);
  els.referenceImageOffsetX.value = String(offsetX);
  els.referenceImageOffsetY.value = String(offsetY);
  els.referenceImageName.textContent = hasImage ? referenceImageState.name || "Reference image" : "No image selected";
  els.clearReferenceImageBtn.disabled = !hasImage;
  els.previewIsoBtn.textContent = hasImage ? "Reference" : "Iso";
  els.previewIsoBtn.title = hasImage
    ? "Show the loaded reference image; multi-view exports use it instead of Iso"
    : "Preview the Iso save-view framing";
  els.previewIsoBtn.classList.toggle("reference-active", hasImage);
  els.referenceImageEmpty.hidden = hasImage;
  els.referenceImagePreview.hidden = hasImage && mode === "overlay";
  els.referenceImagePreviewImg.hidden = !hasImage;
  els.referenceImageOverlay.hidden = !hasImage || mode === "panel";
  if (hasImage) {
    if (els.referenceImagePreviewImg.src !== referenceImageState.dataUrl) els.referenceImagePreviewImg.src = referenceImageState.dataUrl;
    if (els.referenceImageOverlayImg.src !== referenceImageState.dataUrl) els.referenceImageOverlayImg.src = referenceImageState.dataUrl;
  } else {
    els.referenceImagePreviewImg.removeAttribute("src");
    els.referenceImageOverlayImg.removeAttribute("src");
  }
  els.referenceImageOverlayImg.style.opacity = String(opacity);
  els.referenceImageOverlayImg.style.transform = `translate(${offsetX}%, ${offsetY}%) scale(${scale})`;
}

function restoreReferenceImageState(saved = null) {
  referenceImageState = {
    name: typeof saved?.name === "string" ? saved.name : "",
    dataUrl: typeof saved?.dataUrl === "string" && saved.dataUrl.startsWith("data:image/") ? saved.dataUrl : null,
    mode: ["panel", "overlay", "both"].includes(saved?.mode) ? saved.mode : "panel",
    opacity: Math.max(.05, Math.min(1, Number(saved?.opacity) || .45)),
    scale: Math.max(.25, Math.min(4, Number(saved?.scale) || 1)),
    offsetX: Math.max(-200, Math.min(200, Number(saved?.offsetX) || 0)),
    offsetY: Math.max(-200, Math.min(200, Number(saved?.offsetY) || 0))
  };
  syncReferenceImageUi();
}

async function loadReferenceImageFile(file) {
  if (!file) return;
  const dataUrl = await readFileAsDataUrl(file);
  referenceImageState.name = file.name;
  referenceImageState.dataUrl = dataUrl;
  syncReferenceImageUi();
  log(`Loaded reference image ${file.name}. Choose Side Screen, Viewport Overlay, or Both.`);
}

function clearReferenceImage() {
  referenceImageState.name = "";
  referenceImageState.dataUrl = null;
  syncReferenceImageUi();
  log("Cleared the project reference image.");
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
    for (const [urlKey, nameKey] of materialTextureReferenceFields()) {
      const libraryName = textureNameByUrl.get(object[urlKey]);
      if (!libraryName) continue;
      object[nameKey] = libraryName;
      object[urlKey] = null;
    }
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
      activeGroupIds: [...activeGroupIds],
      rigging: typeof serializeBoneRig === "function" ? serializeBoneRig() : null
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
  // Undo must restore the rig too (bones are part of the editor snapshot).
  if (previous.editor?.rigging && typeof restoreBoneRig === "function") restoreBoneRig(previous.editor.rigging);
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
  setWorkspace(editor.workspace || "general", { quiet: true });

  const panels = editor.panels || {};
  setSectionCollapsed(els.addMeshSection, els.addMeshToggle, !!panels.addMeshCollapsed);
  setSectionCollapsed(els.inspectorSection, els.inspectorToggle, !!panels.inspectorCollapsed);
  setSectionCollapsed(els.utilitiesSection, els.utilitiesToggle, !!panels.utilitiesCollapsed);
  setSectionCollapsed(els.aiViewerSection, els.aiViewerToggle, panels.aiViewerCollapsed !== false);
  setSectionCollapsed(els.referenceImageSection, els.referenceImageToggle, !!panels.referenceImageCollapsed);
  setSectionCollapsed(els.cameraViewsSection, els.cameraViewsToggle, !!panels.cameraViewsCollapsed);
  setSectionCollapsed(els.statusSection, els.statusToggle, !!panels.statusCollapsed);
  setModelToolsOpen(!!panels.modelToolsOpen);
  setOutputToolsOpen(!!panels.outputToolsOpen);
  applyToolbarVisibility(setToolbarToggleState(editor.toolbars || defaultToolbarVisibility));

  const tools = editor.tools || {};
  els.rotationSnapSelect.value = String(tools.rotationSnap ?? 0);
  applyRotationSnap();
  els.bevelTypeSelect.value = tools.bevelType || "inner";
  els.bevelSizeInput.value = String(tools.bevelSize ?? 0.16);
  els.bevelDepthInput.value = String(tools.bevelDepth ?? 0.18);
  if (els.edgeBevelWidthInput) els.edgeBevelWidthInput.value = String(tools.edgeBevelWidth ?? 0.08);
  if (els.subdivideLevelsInput) els.subdivideLevelsInput.value = String(Math.max(1, Math.min(2, Math.round(Number(tools.subdivideLevels) || 1))));
  if (els.loopCutAxisSelect) els.loopCutAxisSelect.value = ["x", "y", "z"].includes(tools.loopCutAxis) ? tools.loopCutAxis : "y";
  if (els.loopCutPositionInput) els.loopCutPositionInput.value = String(Math.max(1, Math.min(99, Number(tools.loopCutPosition) || 50)));
  if (els.loopCutCountInput) els.loopCutCountInput.value = String(Math.max(1, Math.min(8, Math.round(Number(tools.loopCutCount) || 1))));
  if (els.knifeCutThroughInput) els.knifeCutThroughInput.checked = !!tools.knifeCutThrough;
  if (els.planeCutAxisSelect) els.planeCutAxisSelect.value = ["x", "y", "z"].includes(tools.planeCutAxis) ? tools.planeCutAxis : "y";
  if (els.planeCutPositionInput) els.planeCutPositionInput.value = String(Math.max(1, Math.min(99, Number(tools.planeCutPosition) || 50)));
  if (els.planeCutResultSelect) {
    els.planeCutResultSelect.value = ["both", "positive", "negative"].includes(tools.planeCutResult) ? tools.planeCutResult : "both";
  }
  if (els.planeCutCapInput) {
    els.planeCutCapInput.checked = tools.planeCutCap ?? true;
    els.planeCutCapInput.disabled = els.planeCutResultSelect?.value === "both";
  }
  if (els.edgeSlideAxisSelect) els.edgeSlideAxisSelect.value = ["auto", "x", "y", "z"].includes(tools.edgeSlideAxis) ? tools.edgeSlideAxis : "auto";
  if (els.edgeSlideAmountInput) {
    const edgeSlideAmount = Number(tools.edgeSlideAmount);
    els.edgeSlideAmountInput.value = String(Math.max(-95, Math.min(95, Number.isFinite(edgeSlideAmount) ? edgeSlideAmount : 10)));
  }
  if (els.surfaceScaleAxisSelect) {
    els.surfaceScaleAxisSelect.value = ["uniform", "x", "y", "z"].includes(tools.surfaceScaleAxis) ? tools.surfaceScaleAxis : "uniform";
  }
  if (els.surfaceScaleAmountInput) {
    els.surfaceScaleAmountInput.value = String(Math.max(1, Math.min(1000, Number(tools.surfaceScaleAmount) || 80)));
  }
  if (els.relaxModeSelect) els.relaxModeSelect.value = tools.relaxMode === "smooth" ? "smooth" : "relax";
  if (els.relaxStrengthInput) els.relaxStrengthInput.value = String(Math.max(1, Math.min(100, Number(tools.relaxStrength) || 50)));
  if (els.relaxIterationsInput) els.relaxIterationsInput.value = String(Math.max(1, Math.min(20, Math.round(Number(tools.relaxIterations) || 1))));
  if (els.relaxPreserveBoundaryInput) els.relaxPreserveBoundaryInput.checked = tools.relaxPreserveBoundary ?? true;
  if (els.weldVertexTargetSelect) {
    els.weldVertexTargetSelect.value = ["center", "first", "last"].includes(tools.weldVertexTarget) ? tools.weldVertexTarget : "center";
  }
  els.dragPushAxisSelect.value = ["x", "y", "z"].includes(tools.dragPushAxis) ? tools.dragPushAxis : "free";
  els.dragPushStepInput.value = String(tools.dragPushStep ?? 0.01);
  if (els.insetAmountInput) els.insetAmountInput.value = String(tools.insetAmount ?? 0.10);
  if (els.softRadiusInput) els.softRadiusInput.value = String(tools.softRadius ?? 0.25);
  if (els.surfaceMouseFalloffSelect) els.surfaceMouseFalloffSelect.value = tools.surfaceMouseFalloff === "hard" ? "hard" : "soft";
  if (els.autoSurfaceDragInput) els.autoSurfaceDragInput.checked = tools.autoSurfaceDrag ?? true;
  if (els.showModelingEdgesInput) els.showModelingEdgesInput.checked = tools.showModelingEdges ?? true;
  surfaceComponentMode = ["none", "vertex", "edge", "triangle", "face"].includes(tools.surfaceComponentMode)
    ? tools.surfaceComponentMode
    : (tools.coplanarFaceSelection ? "face" : "triangle");
  surfaceSelectionSource = ["none", "surface", "classic"].includes(tools.surfaceSelectionSource)
    ? tools.surfaceSelectionSource
    : (surfaceComponentMode === "none" ? "none" : "surface");
  if (els.surfaceEditorWindow) {
    els.surfaceEditorWindow.dataset.interactionMode = ["off", "mouse", "value"].includes(tools.surfaceInteractionMode)
      ? tools.surfaceInteractionMode
      : "mouse";
    setSectionCollapsed(els.surfaceEditorWindow, els.surfaceEditorCloseBtn, !(tools.surfaceEditorOpen ?? false));
  }
  syncSurfaceEditorUi();
  els.connectFaceInput.checked = !!tools.connectFace;
  coplanarFacePickMode = surfaceComponentMode === "face" && !!tools.coplanarFaceSelection;
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
  restoreReferenceImageState(editor.referenceImage || null);

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
  restoreMinecraftWorkspace(editor.minecraft || null);
  restoreCustomCameraViews(editor.cameraViews || {});

  // A freshly opened model starts in a neutral inspection state. Saved model
  // data still retains its rig and transforms, but transient editor choices
  // (selected part, visible guides and active Rotate/Move/Scale gizmo) do not
  // cover the model as soon as it opens.
  checkedIds.clear();
  activeGroupIds = [];
  selectedGroupRecordId = null;
  selectObject(null);
  selectedBoneId = null;
  if (els.showBonesInput) els.showBonesInput.checked = false;
  setBoneGizmoEnabled(false, "translate");
  rebuildBoneVisuals();
  syncBonePanel();

  activeTransformMode = null;
  document.querySelectorAll("[data-mode]").forEach(btn => btn.classList.remove("active"));
  updateTransformAttachment();

  const cameraPosition = view.cameraPosition;
  const orbitTarget = view.orbitTarget;
  const cameraUp = view.cameraUp;
  if (Array.isArray(cameraPosition) && cameraPosition.length === 3) camera.position.fromArray(cameraPosition);
  if (Array.isArray(orbitTarget) && orbitTarget.length === 3) orbit.target.fromArray(orbitTarget);
  if (Array.isArray(cameraUp) && cameraUp.length === 3) camera.up.fromArray(cameraUp);
  camera.updateProjectionMatrix();
  orbit.update();

  setFacePickMode(surfaceComponentMode !== "none" && !!editor.facePickMode);
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

const MAX_REMOTE_PROJECT_BYTES = 128 * 1024 * 1024;
const REMOTE_PROJECT_TIMEOUT_MS = 60000;

function validateRemoteProjectUrl(rawValue) {
  const value = String(rawValue || "").trim();
  if (!value) throw new Error("Enter a project URL.");

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Project URL is not valid.");
  }

  if (url.username || url.password) {
    throw new Error("Project URLs cannot contain embedded credentials.");
  }

  const localHttpHosts = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
  const allowed = url.protocol === "https:"
    || (url.protocol === "http:" && localHttpHosts.has(url.hostname.toLowerCase()));
  if (!allowed) {
    throw new Error("Project URL must use HTTPS. HTTP is allowed only for localhost.");
  }
  return url;
}

function remoteProjectFileName(url) {
  const segment = url.pathname.split("/").filter(Boolean).pop() || "remote-project.modelerproj";
  try {
    return decodeURIComponent(segment) || "remote-project.modelerproj";
  } catch {
    return segment;
  }
}

function validateRemoteProjectData(data) {
  const sceneData = data?.kind === "modeler-project" ? data.scene : data;
  if (!data || typeof data !== "object" || !Array.isArray(sceneData?.objects)) {
    throw new Error("Downloaded JSON is not a valid BoltWorks project or saved scene.");
  }
  if (sceneData.objects.length > 250000) throw new Error("Project contains too many scene objects.");

  const validVector = value => Array.isArray(value)
    && value.length === 3
    && value.every(number => Number.isFinite(Number(number)));
  sceneData.objects.forEach((object, index) => {
    if (!object || typeof object !== "object") throw new Error(`Scene object ${index + 1} is invalid.`);
    for (const key of ["position", "rotation", "scale"]) {
      if (object[key] !== undefined && !validVector(object[key])) {
        throw new Error(`Scene object ${index + 1} has an invalid ${key}.`);
      }
    }
    const geometry = object.geometry;
    if (geometry !== undefined && geometry !== null) {
      if (!geometry || typeof geometry !== "object" || !Array.isArray(geometry.positions)
        || geometry.positions.length < 9 || geometry.positions.length % 3 !== 0
        || !geometry.positions.every(number => Number.isFinite(Number(number)))) {
        throw new Error(`Scene object ${index + 1} has invalid geometry.`);
      }
    }
  });
  return data;
}

async function loadProjectFromUrl(rawUrl) {
  const requestedUrl = validateRemoteProjectUrl(rawUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REMOTE_PROJECT_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(requestedUrl.href, {
      cache: "no-store",
      credentials: "omit",
      redirect: "follow",
      referrerPolicy: "no-referrer",
      signal: controller.signal
    });
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("Project download timed out after 60 seconds.");
    throw new Error("Project download failed or was blocked by the remote server's CORS policy.");
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) throw new Error(`Project download failed with HTTP ${response.status}.`);
  if (response.url) validateRemoteProjectUrl(response.url);

  const declaredBytes = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredBytes) && declaredBytes > MAX_REMOTE_PROJECT_BYTES) {
    throw new Error("Project is larger than the 128 MB URL load limit.");
  }

  const projectBlob = await response.blob();
  if (projectBlob.size > MAX_REMOTE_PROJECT_BYTES) {
    throw new Error("Project is larger than the 128 MB URL load limit.");
  }

  let data;
  try {
    data = JSON.parse((await projectBlob.text()).replace(/^\uFEFF/, ""));
  } catch {
    throw new Error("Downloaded file is not valid JSON.");
  }
  validateRemoteProjectData(data);

  const finalUrl = response.url ? new URL(response.url) : requestedUrl;
  const fileName = remoteProjectFileName(finalUrl);
  const previousProject = projectState();
  const previousFileName = `${currentProjectBaseName()}.modelerproj`;
  try {
    loadProjectData(data, fileName);
  } catch (error) {
    try {
      loadProjectData(previousProject, previousFileName);
    } catch {}
    throw new Error(`Project could not be opened safely: ${error.message}`);
  }
  log(`Loaded project URL from ${finalUrl.hostname}.`, {
    fileName,
    bytes: projectBlob.size,
    source: `${finalUrl.origin}${finalUrl.pathname}`
  });
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

const collapsedSceneGroupIds = new Set();

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
    row.dataset.meshId = mesh.userData.id;
    row.innerHTML = `<input class="part-check" type="checkbox" aria-label="Select ${mesh.name}"><label class="row-toggle link-toggle" title="Link ${mesh.name} with the current multi-selection"><input class="link-check" type="checkbox" aria-label="Link ${mesh.name}"><span>Link</span></label><label class="hide-toggle" title="Hide or show ${mesh.name}"><input class="hide-check" type="checkbox" aria-label="Hide ${mesh.name}"><span>Hide</span></label><label class="row-toggle armor-toggle" title="Include ${mesh.name} in the rigid armor system"><input class="armor-check" type="checkbox" aria-label="Mark ${mesh.name} as armor"><span>Armor</span></label><span class="swatch" style="background:${swatchColor}"></span><span class="mesh-name"></span><small title="${materialLabel}">${rowType}</small><button class="mesh-details-btn" type="button" title="Open mesh details for ${mesh.name}">...</button>`;
    const partCheck = row.querySelector(".part-check");
    const linkToggle = row.querySelector(".link-toggle");
    const linkCheck = row.querySelector(".link-check");
    const hideToggle = row.querySelector(".hide-toggle");
    const hideCheck = row.querySelector(".hide-check");
    const armorToggle = row.querySelector(".armor-toggle");
    const armorCheck = row.querySelector(".armor-check");
    const meshName = row.querySelector(".mesh-name");
    const detailsBtn = row.querySelector(".mesh-details-btn");
    partCheck.checked = checkedIds.has(mesh.userData.id);
    linkCheck.checked = !!mesh.userData.linkId;
    linkToggle.classList.toggle("linked", !!mesh.userData.linkId);
    linkToggle.style.setProperty("--link-color", linkColor);
    linkCheck.style.accentColor = linkColor;
    hideCheck.checked = !!mesh.userData.hidden;
    armorCheck.checked = mesh.userData.rigRole === "armor";
    armorToggle.classList.toggle("armor-enabled", armorCheck.checked);
    meshName.textContent = mesh.name;
    meshName.title = mesh.name;
    partCheck.addEventListener("click", event => event.stopPropagation());
    partCheck.addEventListener("change", event => setChecked(mesh, event.target.checked));
    linkToggle.addEventListener("click", event => event.stopPropagation());
    linkCheck.addEventListener("change", event => {
      event.stopPropagation();
      recordHistory(event.target.checked ? "link parts" : "unlink part");
      setLinked(mesh, event.target.checked);
    });
    hideToggle.addEventListener("click", event => event.stopPropagation());
    hideCheck.addEventListener("change", event => {
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
    armorToggle.addEventListener("click", event => event.stopPropagation());
    armorCheck.addEventListener("change", event => {
      event.stopPropagation();
      recordHistory(event.target.checked ? "mark armor part" : "remove armor part");
      setObjectRigRole(mesh, event.target.checked ? "armor" : "skin");
      applyRigModelOpacity();
      updateAll();
      log(`${mesh.name} is now ${event.target.checked ? "rigid armor" : "skin and bone"}.`);
    });
    detailsBtn.addEventListener("click", event => {
      event.stopPropagation();
      openMeshDetails(mesh.userData.id);
    });
    row.addEventListener("click", event => selectObject(mesh, { append: additiveSelectionRequested(event) }));
    return row;
  };

  const buildPersistentGroup = (record, depth = 0) => {
    const meshes = descendantMeshesForGroup(record.id);
    const directMeshes = meshesDirectInGroup(record.id);
    const children = childGroupRecords(record.id);
    const groupWrap = document.createElement("div");
    groupWrap.className = "tree-group";
    if (depth) groupWrap.classList.add("tree-group-nested");

    const header = document.createElement("div");
    header.className = "tree-group-header";
    header.innerHTML = `<button class="tree-group-disclosure" type="button" aria-label="Collapse ${record.name}" aria-expanded="true">−</button><span class="tree-group-name"></span><small class="tree-group-count"></small><button class="group-hide-btn" type="button">Hide</button><button class="group-only-btn" type="button">Only</button><button class="group-info-btn" type="button" title="Open texture and group information for ${record.name}" aria-label="Open texture and group information for ${record.name}">...</button>`;
    const disclosure = header.querySelector(".tree-group-disclosure");
    const groupNameEl = header.querySelector(".tree-group-name");
    const groupCountEl = header.querySelector(".tree-group-count");
    const groupHideBtn = header.querySelector(".group-hide-btn");
    const groupOnlyBtn = header.querySelector(".group-only-btn");
    const groupInfoBtn = header.querySelector(".group-info-btn");
    const collapsed = collapsedSceneGroupIds.has(record.id);
    disclosure.textContent = collapsed ? "+" : "−";
    disclosure.setAttribute("aria-expanded", String(!collapsed));
    disclosure.setAttribute("aria-label", `${collapsed ? "Expand" : "Collapse"} ${record.name}`);
    groupWrap.classList.toggle("collapsed", collapsed);
    groupNameEl.textContent = record.name;
    header.classList.toggle("selected", selectedGroupRecordId === record.id);
    groupCountEl.textContent = `${meshes.length} item${meshes.length === 1 ? "" : "s"}`;
    const allHidden = meshes.length > 0 && meshes.every(mesh => !!mesh.userData.hidden);
    groupHideBtn.textContent = allHidden ? "Show" : "Hide";
    groupHideBtn.title = allHidden ? `Show every model in ${record.name}` : `Hide every model in ${record.name}`;
    groupHideBtn.classList.toggle("show-hidden", allHidden);
    disclosure.addEventListener("click", event => {
      event.stopPropagation();
      if (collapsed) collapsedSceneGroupIds.delete(record.id);
      else collapsedSceneGroupIds.add(record.id);
      renderTree();
    });
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
    groupInfoBtn.addEventListener("click", event => {
      event.stopPropagation();
      selectGroupRecord(record.id);
      openGroupEditor(record.id);
    });
    groupHideBtn.addEventListener("click", event => {
      event.stopPropagation();
      const hide = !allHidden;
      recordHistory(hide ? "hide group" : "show group");
      setHiddenTargets(meshes, hide);
      log(`${hide ? "Hid" : "Showed"} group ${record.name}.`, { count: meshes.length });
    });
    header.addEventListener("click", () => selectGroupRecord(record.id));
    groupWrap.append(header);

    if (!collapsed) {
      for (const child of children) groupWrap.append(buildPersistentGroup(child, depth + 1));
      for (const mesh of directMeshes) groupWrap.append(buildMeshRow(mesh));
    }
    return groupWrap;
  }

  for (const record of childGroupRecords(null)) els.tree.append(buildPersistentGroup(record, 0));

  for (const [groupName, meshes] of sceneGroups()) {
    const groupWrap = document.createElement("div");
    groupWrap.className = "tree-group";
    const header = document.createElement("div");
    header.className = "tree-group-header";
    header.innerHTML = `<button class="tree-group-disclosure" type="button" aria-label="Collapse ${groupName}" aria-expanded="true">−</button><span class="tree-group-name"></span><small class="tree-group-count"></small><button class="group-hide-btn" type="button">Hide</button><button class="group-only-btn" type="button">Only</button><button class="group-info-btn" type="button" title="Open texture and mesh information for ${groupName}" aria-label="Open texture and mesh information for ${groupName}">...</button>`;
    const disclosure = header.querySelector(".tree-group-disclosure");
    const groupNameEl = header.querySelector(".tree-group-name");
    const groupCountEl = header.querySelector(".tree-group-count");
    const groupHideBtn = header.querySelector(".group-hide-btn");
    const groupOnlyBtn = header.querySelector(".group-only-btn");
    const groupInfoBtn = header.querySelector(".group-info-btn");
    const collapseId = `legacy:${groupName}`;
    const collapsed = collapsedSceneGroupIds.has(collapseId);
    disclosure.textContent = collapsed ? "+" : "−";
    disclosure.setAttribute("aria-expanded", String(!collapsed));
    disclosure.setAttribute("aria-label", `${collapsed ? "Expand" : "Collapse"} ${groupName}`);
    groupWrap.classList.toggle("collapsed", collapsed);
    groupNameEl.textContent = groupName;
    groupCountEl.textContent = `${meshes.length} item${meshes.length === 1 ? "" : "s"}`;
    const allHidden = meshes.length > 0 && meshes.every(mesh => !!mesh.userData.hidden);
    groupHideBtn.textContent = allHidden ? "Show" : "Hide";
    groupHideBtn.title = allHidden ? `Show every model in ${groupName}` : `Hide every model in ${groupName}`;
    groupHideBtn.classList.toggle("show-hidden", allHidden);
    disclosure.addEventListener("click", event => {
      event.stopPropagation();
      if (collapsed) collapsedSceneGroupIds.delete(collapseId);
      else collapsedSceneGroupIds.add(collapseId);
      renderTree();
    });
    groupOnlyBtn.addEventListener("click", event => {
      event.stopPropagation();
      setCheckedMeshes(meshes, true, { replace: true });
      log(`Checked only ${groupName} group.`, { count: meshes.length });
    });
    groupInfoBtn.addEventListener("click", event => {
      event.stopPropagation();
      const mesh = meshes[0];
      if (!mesh) return;
      selectObject(mesh);
      openMeshDetails(mesh.userData.id);
    });
    groupHideBtn.addEventListener("click", event => {
      event.stopPropagation();
      const hide = !allHidden;
      recordHistory(hide ? "hide group" : "show group");
      setHiddenTargets(meshes, hide);
      log(`${hide ? "Hid" : "Showed"} group ${groupName}.`, { count: meshes.length });
    });
    header.addEventListener("click", () => setCheckedMeshes(meshes, true, { replace: true }));
    groupWrap.append(header);
    if (!collapsed) for (const mesh of meshes) groupWrap.append(buildMeshRow(mesh));
    els.tree.append(groupWrap);
  }
}

function goToSelectedMesh() {
  if (!selected?.userData?.id) {
    log("Select a mesh in the viewport or scene list first.");
    return false;
  }
  renderTree();
  requestAnimationFrame(() => {
    const row = [...els.tree.querySelectorAll(".object-row")]
      .find(candidate => candidate.dataset.meshId === selected.userData.id);
    if (!row) {
      log(`Could not find ${selected.name} in the scene list.`);
      return;
    }
    row.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    row.classList.remove("locate-pulse");
    requestAnimationFrame(() => row.classList.add("locate-pulse"));
    setTimeout(() => row.classList.remove("locate-pulse"), 1400);
    log(`Located ${selected.name} in the scene list.`);
  });
  return true;
}

function syncInspector() {
  const groupObjects = transformTargetObjects();
  const pivotTargets = pivotManagedObjects();
  const groupMode = pivotTargets.length > 0 && transform.object === groupPivot;
  const disabled = !selected && !groupMode;
  if (els.goToSelectedMeshBtn) els.goToSelectedMeshBtn.disabled = !selected;
  const alwaysAvailableTextureControls = new Set([
    els.textureBtn,
    els.addLibraryTextureBtn,
    els.textureFile,
    els.textureLibrarySelect,
    els.textureLibraryUrlInput,
    els.loadTextureLibraryUrlBtn
  ].filter(Boolean));
  for (const input of document.querySelectorAll(".props input, .props button, .props select")) {
    if (alwaysAvailableTextureControls.has(input)) continue;
    input.disabled = disabled;
  }
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
    els.colorInput.value = "#ffffff";
    els.colorHexInput.value = "#FFFFFF";
    if (els.addColorToSceneBtn) { els.addColorToSceneBtn.disabled = true; els.addColorToSceneBtn.textContent = "Apply Mesh Color"; }
    if (els.modelToolsApplyMeshColorBtn) els.modelToolsApplyMeshColorBtn.disabled = transformTargetObjects().length < 1;
    if (els.modelToolsPaintFacesBtn) els.modelToolsPaintFacesBtn.disabled = selectedFaces.length < 1;
    els.roughInput.value = .6;
    els.roughValue.value = "0.60";
    els.opacityInput.value = 1;
    els.opacityValue.value = "1.00";
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
    els.colorInput.value = "#ffffff";
    els.colorHexInput.value = "#FFFFFF";
    if (els.addColorToSceneBtn) { els.addColorToSceneBtn.disabled = true; els.addColorToSceneBtn.textContent = "Apply Mesh Color"; }
    if (els.modelToolsApplyMeshColorBtn) els.modelToolsApplyMeshColorBtn.disabled = checkedObjects().length < 1;
    if (els.modelToolsPaintFacesBtn) els.modelToolsPaintFacesBtn.disabled = selectedFaces.length < 1;
    els.opacityInput.value = 1;
    els.opacityValue.value = "1.00";
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
  if (els.modelToolsMeshColorInput) els.modelToolsMeshColorInput.value = els.colorInput.value;
  if (els.modelToolsMeshColorHexInput) els.modelToolsMeshColorHexInput.value = els.colorHexInput.value;
  if (els.modelToolsApplyMeshColorBtn) els.modelToolsApplyMeshColorBtn.disabled = false;
  if (els.modelToolsPaintFacesBtn) els.modelToolsPaintFacesBtn.disabled = selectedFaces.length < 1;
  if (els.addColorToSceneBtn) { els.addColorToSceneBtn.disabled = false; els.addColorToSceneBtn.textContent = selected.userData.colorApplied ? "Mesh Color Applied" : "Apply Mesh Color"; }
  els.roughInput.value = selected.material.roughness;
  els.roughValue.value = Number(selected.material.roughness).toFixed(2);
  const baseMaterialState = typeof rigModelBaseMaterialState === "function" ? rigModelBaseMaterialState(selected.material) : null;
  const inspectorOpacity = typeof animatorWorkspaceActive !== "undefined" && animatorWorkspaceActive
    ? rigModelOpacity
    : (baseMaterialState?.opacity ?? selected.material.opacity ?? 1);
  els.opacityInput.value = inspectorOpacity;
  els.opacityValue.value = Number(inspectorOpacity).toFixed(2);
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
  const normalizedColor = normalizeHexColor(els.colorHexInput?.value || els.colorInput.value, normalizeHexColor(els.colorInput.value, "#ffffff"));
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
  if (selected.userData.colorApplied) selected.material.color.set(normalizedColor);
  const reapplyRigOpacity = typeof restoreRigModelMaterials === "function" && restoreRigModelMaterials();
  selected.material.roughness = +els.roughInput.value;
  const opacity = Math.max(.05, Math.min(1, Number(els.opacityInput.value) || 1));
  const editsRigPreviewOpacity = typeof animatorWorkspaceActive !== "undefined" && animatorWorkspaceActive && rigBones.length > 0;
  if (!editsRigPreviewOpacity) {
    selected.material.transparent = opacity < .999 || !!selected.userData.textureHasTransparency;
    selected.material.opacity = opacity;
    selected.material.depthWrite = opacity >= .9;
    selected.userData.opacity = opacity;
  }
  selected.material.wireframe = false;
  selected.material.needsUpdate = true;
  selected.userData.color = normalizedColor;
  selected.userData.roughness = +els.roughInput.value;
  syncMeshRenderCulling(selected);
  els.roughValue.value = Number(selected.material.roughness).toFixed(2);
  els.opacityValue.value = opacity.toFixed(2);
  if (editsRigPreviewOpacity) setRigModelOpacity(opacity);
  else if (reapplyRigOpacity) applyRigModelOpacity();
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
  if (groupObjects.length > 1) {
    const targets = [...groupObjects];
    recordHistory("delete selection");
    selected = null;
    for (const mesh of targets) removeObject(mesh, { record: false, update: false });
    activeGroupIds = [];
    checkedIds.clear();
    selectedGroupRecordId = null;
    currentTransformTargetKey = "";
    transform.detach();
    updateAll();
    log(`Deleted ${targets.length} selected objects.`);
    return;
  }
  removeObject(selected);
}

function updateState() {
  const totalObjects = objects.length;
  const transformTargets = transformTargetObjects();
  const selectedName = selected?.name || (transformTargets.length > 1 ? `${pivotEditMode ? "Pivot" : "Group"} (${transformTargets.length})` : "None");
  const markerCount = markerHelpers.length;
  const selectedModelTriangles = selected?.geometry
    ? Math.floor((selected.geometry.index?.count || selected.geometry.getAttribute("position")?.count || 0) / 3)
    : 0;
  const selectedFaceCount = selectedFaces.length;
  const componentCount = selectedSurfaceVertices.length + selectedSurfaceEdges.length;
  els.stateOutput.textContent = `Scene: ${totalObjects} object${totalObjects === 1 ? "" : "s"} | Selected mesh: ${selectedName} | Model triangles: ${selected ? selectedModelTriangles : "—"} | Selected faces: ${selectedFaceCount} | Selected components: ${componentCount} | Marks: ${markerCount}`;
  const exportSelectedObjBtn = document.querySelector("#exportSelectedObjBtn");
  if (exportSelectedObjBtn) exportSelectedObjBtn.disabled = !selected?.geometry;
  if (typeof scheduleProjectAutoSave === "function") scheduleProjectAutoSave();
}

function updateAll() {
  syncSpotLightRig();
  syncLiveMirrorPreview();
  syncLiveMirrorUi();
  updateTriangleHelpers();
  updateSelectionOutline();
  updateOpeningPickGuide();
  updateModelingEdgesOverlay();
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

function gameCharacterSafeName(value, fallback = "item") {
  const cleaned = String(value || fallback).trim().replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
  return cleaned || fallback;
}

function gameCharacterArmorBinding(object) {
  const mountBoneId = object.userData?.rigArmorMountId
    ? rigBones.find(bone => bone.armorMountId === object.userData.rigArmorMountId)?.id
    : null;
  const boneId = mountBoneId || object.userData?.rigBoneId || null;
  const bone = boneById(boneId);
  if (!bone) return null;
  const key = `rigid:${bone.id}:${object.userData?.id || object.uuid}`;
  const rest = animationState.bindingRest instanceof Map ? animationState.bindingRest.get(key) : null;
  return { bone, rest };
}

function gameCharacterCompactGlbSkins(source) {
  const input = new Uint8Array(source);
  const inputView = new DataView(input.buffer, input.byteOffset, input.byteLength);
  if (inputView.getUint32(0, true) !== 0x46546C67 || inputView.getUint32(4, true) !== 2) return source;
  const chunks = [];
  let offset = 12;
  while (offset + 8 <= input.byteLength) {
    const length = inputView.getUint32(offset, true);
    const type = inputView.getUint32(offset + 4, true);
    chunks.push({ type, data: input.slice(offset + 8, offset + 8 + length) });
    offset += 8 + length;
  }
  const jsonChunk = chunks.find(chunk => chunk.type === 0x4E4F534A);
  if (!jsonChunk) return source;
  const gltf = JSON.parse(new TextDecoder().decode(jsonChunk.data).replace(/[\u0000\u0020]+$/g, ""));
  if (!Array.isArray(gltf.skins) || gltf.skins.length <= 1) return source;
  for (const node of gltf.nodes || []) if (Number.isInteger(node.skin)) node.skin = 0;
  gltf.skins = [gltf.skins[0]];
  const jsonBytes = new TextEncoder().encode(JSON.stringify(gltf));
  const paddedJson = new Uint8Array((jsonBytes.length + 3) & ~3);
  paddedJson.fill(0x20);
  paddedJson.set(jsonBytes);
  jsonChunk.data = paddedJson;
  const totalLength = 12 + chunks.reduce((sum, chunk) => sum + 8 + chunk.data.length, 0);
  const output = new Uint8Array(totalLength);
  const outputView = new DataView(output.buffer);
  outputView.setUint32(0, 0x46546C67, true);
  outputView.setUint32(4, 2, true);
  outputView.setUint32(8, totalLength, true);
  offset = 12;
  for (const chunk of chunks) {
    outputView.setUint32(offset, chunk.data.length, true);
    outputView.setUint32(offset + 4, chunk.type, true);
    output.set(chunk.data, offset + 8);
    offset += 8 + chunk.data.length;
  }
  return output.buffer;
}

function gameCharacterAnimationClips(exportBoneNames) {
  syncActiveAnimationClip();
  const clips = [];
  for (const [clipId, sourceClip] of Object.entries(animationState.clips || {})) {
    setActiveAnimationClip(clipId);
    const fps = Math.max(1, Number(animationState.fps) || 24);
    const end = Math.max(1, Number(animationState.end) || 1);
    const times = Array.from({ length: end + 1 }, (_, frame) => frame / fps);
    const samples = new Map([...exportBoneNames.keys()].map(id => [id, { position: [], quaternion: [] }]));
    for (let frame = 0; frame <= end; frame += 1) {
      animationSetFrame(frame, { render: false, lightweightPanel: true });
      for (const [boneId] of exportBoneNames) {
        const liveBone = activeSkinRuntime?.threeBones?.get(boneId);
        const sample = samples.get(boneId);
        if (!liveBone || !sample) continue;
        sample.position.push(liveBone.position.x, liveBone.position.y, liveBone.position.z);
        sample.quaternion.push(liveBone.quaternion.x, liveBone.quaternion.y, liveBone.quaternion.z, liveBone.quaternion.w);
      }
    }
    const tracks = [];
    for (const [boneId, exportName] of exportBoneNames) {
      const sample = samples.get(boneId);
      if (!sample?.position.length) continue;
      tracks.push(new THREE.VectorKeyframeTrack(`${exportName}.position`, times, sample.position));
      tracks.push(new THREE.QuaternionKeyframeTrack(`${exportName}.quaternion`, times, sample.quaternion));
    }
    clips.push(new THREE.AnimationClip(gameCharacterSafeName(sourceClip?.name || clipId, clipId), end / fps, tracks));
  }
  return clips;
}

function gameCharacterManifest(baseName, glbName, rig, boundObjects, lods = []) {
  const sockets = rig.bones.filter(bone => bone.role === "itemSocket" || bone.armorMount || bone.armorMountId).map(bone => ({
    id: bone.armorMountId || `socket-${bone.id}`,
    boneId: bone.id,
    name: bone.name,
    purpose: "equipment"
  }));
  const attachments = boundObjects.map((object, index) => ({
    id: object.userData?.id || object.uuid,
    name: object.name || "Bound Part",
    boneId: gameCharacterArmorBinding(object)?.bone?.id || null,
    mountId: object.userData?.rigArmorMountId || null,
    role: object.userData?.rigRole === "armor" ? "equipment" : "rigidPart",
    attachment: "rigid",
    meshIndex: index + 1,
    materialIndex: index + 1,
    detachable: true
  }));
  const armor = attachments.filter(item => item.role === "equipment");
  const clips = Object.entries(rig.animation?.clips || {}).map(([id, clip]) => ({
    id,
    name: gameCharacterSafeName(clip?.name || id, id),
    fps: Math.max(1, Number(clip?.fps) || 24),
    frameCount: Math.max(1, Number(clip?.end) || 1) + 1,
    durationSeconds: Math.max(1, Number(clip?.end) || 1) / Math.max(1, Number(clip?.fps) || 24)
  }));
  return {
    kind: "boltworks-game-character",
    formatVersion: 1,
    generator: "BoltWorks 3D AI Studio",
    generatedAt: new Date().toISOString(),
    name: baseName,
    model: { file: glbName, format: "glTF-binary-2.0", animationSource: "embedded", lods },
    coordinateSystem: { handedness: "right-handed", units: "meters", upAxis: "+Y", groundPlane: "XZ" },
    skeleton: {
      rootBoneIds: rig.bones.filter(bone => !bone.parentId).map(bone => bone.id),
      bones: rig.bones.map(bone => ({
        id: bone.id,
        name: bone.name,
        parentId: bone.parentId,
        role: bone.role,
        bindPosition: bone.bindPosition || bone.position,
        bindRotation: bone.bindRotation || bone.rotation,
        tail: bone.bindTail || bone.tail,
        detachable: bone.role !== "camera"
      }))
    },
    animations: clips,
    sockets,
    attachments,
    armor,
    gameplay: {
      supportsDetachedLimbs: true,
      detachRule: "Detach a bone subtree; attached armor and sockets stay with that subtree.",
      skinPolicy: "Skinned body and rigid armor share the embedded glTF skeleton."
    }
  };
}

function gameCharacterSimplifiedGeometry(source, keepRatio, skinBones = null) {
  let geometry = source.clone();
  const triangles = Math.floor((geometry.index?.count || geometry.getAttribute("position")?.count || 0) / 3);
  if (keepRatio < .999 && triangles >= 160) {
    try {
      geometry = mergeVertices(geometry, 1e-5);
      const vertexCount = geometry.getAttribute("position")?.count || 0;
      const removeCount = Math.max(0, Math.floor(vertexCount * (1 - keepRatio)));
      if (removeCount > 0 && vertexCount - removeCount >= 12) {
        const reduced = new SimplifyModifier().modify(geometry, removeCount);
        geometry.dispose();
        geometry = reduced;
      }
    } catch (error) {
      geometry.dispose();
      geometry = source.clone();
      console.warn("Realtime character LOD simplification was skipped:", error);
    }
  }
  if (skinBones?.length) addSkinAttributes(geometry, skinBones);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

async function gameCharacterBuildGlb({ baseName, avatar, boundObjects, clips, keepRatio, level }) {
  avatar.updateMatrixWorld(true);
  const exportAvatar = cloneSkeleton(avatar);
  exportAvatar.name = `${baseName}_Skin_LOD${level}`;
  exportAvatar.userData = { ...exportAvatar.userData, bwsRole: "skin", bwsLodLevel: level };
  exportAvatar.geometry = gameCharacterSimplifiedGeometry(avatar.geometry, keepRatio, activeSkinRuntime.bones);
  const exportBonesById = new Map();
  exportAvatar.traverse(node => {
    const id = node.userData?.rigBoneId;
    if (!node.isBone || !id) return;
    node.name = `BWS_${gameCharacterSafeName(id, "bone")}`;
    exportBonesById.set(id, node);
  });
  const avatarWorldInverse = avatar.matrixWorld.clone().invert();
  for (const object of boundObjects) {
    const binding = gameCharacterArmorBinding(object);
    const targetBone = exportBonesById.get(binding.bone.id);
    const boneIndex = exportAvatar.skeleton.bones.indexOf(targetBone);
    if (!targetBone || boneIndex < 0) continue;
    const restWorld = new THREE.Matrix4();
    if (binding.rest?.objectPosition) {
      restWorld.compose(
        binding.rest.objectPosition,
        binding.rest.objectQuaternion || new THREE.Quaternion().setFromEuler(binding.rest.objectRotation),
        object.scale
      );
    } else {
      object.updateMatrixWorld(true);
      restWorld.copy(object.matrixWorld);
    }
    const geometry = gameCharacterSimplifiedGeometry(object.geometry, keepRatio)
      .applyMatrix4(avatarWorldInverse.clone().multiply(restWorld));
    const count = geometry.getAttribute("position").count;
    const indices = new Uint16Array(count * 4);
    const weights = new Float32Array(count * 4);
    for (let vertex = 0; vertex < count; vertex += 1) {
      indices[vertex * 4] = boneIndex;
      weights[vertex * 4] = 1;
    }
    geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(indices, 4));
    geometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute(weights, 4));
    const sourceMaterial = Array.isArray(object.material) ? object.material[0] : object.material;
    const armorMesh = new THREE.SkinnedMesh(geometry, sourceMaterial.clone());
    armorMesh.name = gameCharacterSafeName(object.name, "Bound_Part");
    armorMesh.userData = {
      bwsRole: object.userData?.rigRole === "armor" ? "equipment" : "rigidPart",
      bwsObjectId: object.userData?.id || object.uuid,
      bwsBoneId: binding.bone.id,
      bwsMountId: object.userData?.rigArmorMountId || null,
      bwsLodLevel: level
    };
    exportAvatar.add(armorMesh);
    armorMesh.bind(exportAvatar.skeleton, exportAvatar.bindMatrix);
  }
  exportAvatar.userData.bwsMeshSlots = [
    { role: "skin", index: 0, id: avatar.userData?.id || avatar.uuid },
    ...boundObjects.map((object, index) => ({
      role: object.userData?.rigRole === "armor" ? "equipment" : "rigidPart",
      index: index + 1,
      id: object.userData?.id || object.uuid,
      boneId: gameCharacterArmorBinding(object)?.bone?.id || null
    }))
  ];
  const root = new THREE.Group();
  root.name = `${baseName}_LOD${level}`;
  root.add(exportAvatar);
  const rawBinary = await new GLTFExporter().parseAsync(root, {
    binary: true,
    animations: clips,
    onlyVisible: false,
    trs: true,
    includeCustomExtensions: true
  });
  return gameCharacterCompactGlbSkins(rawBinary);
}

async function exportGameCharacterPackage() {
  if (!activeSkinRuntime?.avatar?.isSkinnedMesh || !activeSkinRuntime?.skeleton) {
    log("Export Game Character needs a glued Skin & Bone model with an active skeleton.");
    return;
  }
  syncActiveAnimationClip();
  const originalClipId = animationState.activeClipId;
  const originalFrame = animationState.frame;
  const originalPlaying = animationState.playing;
  const baseName = gameCharacterSafeName(currentProjectBaseName(), "boltworks-character");
  const glbName = `${baseName}.glb`;
  let exportStage = "prepare animation bindings";
  try {
    animationState.playing = false;
    if (!(animationState.bindingRest instanceof Map)) prepareAnimationBindingRest();
    const avatar = activeSkinRuntime.avatar;
    const exportBoneNames = new Map(activeSkinRuntime.bones.map(bone => [
      bone.id,
      `BWS_${gameCharacterSafeName(bone.id, "bone")}`
    ]));
    const boundObjects = objects.filter(object => object !== avatar
      && object.geometry?.getAttribute?.("position")
      && !object.userData?.editorHelper
      && gameCharacterArmorBinding(object));
    exportStage = "sample animation clips";
    const clips = gameCharacterAnimationClips(exportBoneNames);
    const useLods = els.gameCharacterLodInput?.checked !== false;
    const mediumRatio = Math.max(.2, Math.min(.9, Number(els.gameOptimizeRatioInput?.value || 65) / 100));
    const levels = useLods
      ? [
          { level: 0, keepRatio: 1, file: glbName, minDistance: 0 },
          { level: 1, keepRatio: mediumRatio, file: `${baseName}-lod1.glb`, minDistance: 12 },
          { level: 2, keepRatio: Math.max(.2, mediumRatio * .5), file: `${baseName}-lod2.glb`, minDistance: 28 }
        ]
      : [{ level: 0, keepRatio: 1, file: glbName, minDistance: 0 }];
    const binaries = [];
    for (const level of levels) {
      exportStage = `build LOD ${level.level}`;
      const binary = await gameCharacterBuildGlb({ baseName, avatar, boundObjects, clips, ...level });
      binaries.push({ ...level, binary });
    }
    exportStage = "build character manifest";
    const rig = serializeBoneRig();
    const manifestLods = levels.map(level => ({
      level: level.level,
      file: level.file,
      minDistance: level.minDistance,
      keepDetailPercent: Math.round(level.keepRatio * 100)
    }));
    const manifest = gameCharacterManifest(baseName, glbName, rig, boundObjects, manifestLods);
    const readme = [
      "BoltWorks Game Character Package v1",
      "",
      `${glbName} contains the full-detail live skinned body, detachable rigid parts, equipment previews, skeleton, embedded materials, and realtime skeletal animations.`,
      useLods ? "LOD1 and LOD2 contain progressively lighter body, rigid-part, and equipment geometry for distance-based rendering." : "No distance LOD files were requested.",
      `${baseName}.bws-character.json contains stable bone IDs, hand/item sockets, detachable-part ownership, and gameplay metadata.`,
      "Raylib can load the GLB with LoadModel and drive its bones every game frame with LoadModelAnimations and UpdateModelAnimation."
    ].join("\n");
    exportStage = "assemble character archive";
    const zip = makeZip([
      ...binaries.map(level => ({ name: level.file, data: new Uint8Array(level.binary) })),
      { name: `${baseName}.bws-character.json`, data: JSON.stringify(manifest, null, 2) },
      { name: "README.txt", data: readme }
    ]);
    downloadBlob(`${baseName}.bws-character.zip`, zip);
    log(`Exported ${baseName}.bws-character.zip with ${levels.length} realtime LOD level${levels.length === 1 ? "" : "s"}, ${rig.bones.length} bones, ${clips.length} clips, and ${boundObjects.length} detachable bound parts.`);
  } catch (error) {
    console.error(error);
    log(`Game Character export failed during ${exportStage}: ${error?.message || error}`);
  } finally {
    if (animationState.clips?.[originalClipId]) setActiveAnimationClip(originalClipId);
    animationSetFrame(originalFrame, { render: true });
    animationState.playing = originalPlaying;
  }
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

function objMaterialColor(material) {
  const color = new THREE.Color(material?.color || "#ffffff").convertLinearToSRGB();
  return [round(color.r), round(color.g), round(color.b)];
}

function exportObjMaterialBundle(targets, exportName) {
  const exportTargets = [...targets].filter(mesh => mesh?.isMesh && mesh.geometry);
  if (!exportTargets.length) {
    log("No mesh parts to export.");
    return null;
  }
  const baseName = safeFileName(exportName, "model").replace(/\.obj$/i, "");
  const objName = `${baseName}.obj`;
  const mtlName = `${baseName}.mtl`;
  const group = new THREE.Group();
  const materialLines = [];
  const textureEntries = [];
  const textureNames = new Set();

  exportTargets.forEach((mesh, index) => {
    const clone = mesh.clone();
    const sourceMaterial = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const material = sourceMaterial?.clone?.() || new THREE.MeshStandardMaterial({ color: "#ffffff" });
    const materialName = `material_${index + 1}_${idSafe(mesh.name || "part")}`;
    material.name = materialName;
    clone.material = material;
    clone.visible = true;
    const textureUrl = mesh.userData.textureUrl || null;
    let texturePath = null;
    if (/^data:/i.test(textureUrl || "")) {
      const extension = imageExtensionFromDataUrl(textureUrl, mesh.userData.textureName || "texture.png");
      const preferredName = fileSafe(mesh.userData.textureName || `${mesh.name || "texture"}${extension}`);
      const fileName = uniqueTextureFileName(preferredName, { has: name => textureNames.has(name), add: name => textureNames.add(name) });
      const bytes = dataUrlToBytes(textureUrl);
      if (bytes) {
        textureNames.add(fileName);
        texturePath = `textures/${fileName}`;
        textureEntries.push({ name: texturePath, data: bytes });
      }
    }
    const color = objMaterialColor(material);
    materialLines.push(`newmtl ${materialName}\nKd ${color.join(" ")}\nd ${round(material.opacity ?? 1)}\nTr ${round(1 - (material.opacity ?? 1))}${texturePath ? `\nmap_Kd ${texturePath}` : ""}\n`);
    group.add(clone);
  });
  group.updateMatrixWorld(true);
  const objText = `mtllib ${mtlName}\n${new OBJExporter().parse(group)}`;
  const archiveName = `${baseName}-obj-materials.zip`;
  downloadBlob(archiveName, makeZip([
    { name: objName, data: objText },
    { name: mtlName, data: materialLines.join("\n") },
    ...textureEntries
  ]));
  log(`Exported ${exportTargets.length} OBJ part${exportTargets.length === 1 ? "" : "s"} with ${materialLines.length} MTL material${materialLines.length === 1 ? "" : "s"} and ${textureEntries.length} texture image${textureEntries.length === 1 ? "" : "s"} in ${archiveName}. Extract the ZIP and keep the OBJ, MTL, and textures folder together.`, archiveName);
  return archiveName;
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

function insertSpecsIntoScene(specs, fileName, sourceLabel, { preserveScale = false } = {}) {
  if (!specs.length) {
    log(`No meshes found in ${fileName}.`);
    return;
  }
  const normalized = normalizeImportedSpecs(specs, { fitToWorkspace: !preserveScale });
  const inserted = normalized.map(spec => addObject(spec, { record: false }));
  selectObject(inserted.at(-1) || null);
  frameSelected();
  log(`Inserted ${sourceLabel} ${fileName} as ${inserted.length} editable mesh part${inserted.length === 1 ? "" : "s"}; existing workspace parts were kept${preserveScale ? " at Roblox stud scale" : ""}.`);
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

async function insertObjFiles(fileList) {
  const files = [...fileList];
  const objFile = files.find(file => /\.obj$/i.test(file.name));
  if (!objFile) throw new Error("Select an .obj file to insert into the current workspace.");
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
  recordHistory("insert obj");
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
  const parsed = loader.parse(await objFile.text());
  insertSpecsIntoScene(specsFromObject3D(parsed, objFile.name), objFile.name, mtlFile ? "OBJ + MTL" : "OBJ", { preserveScale: true });
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
  activeCustomCameraId = null;
  playerLookDrag = null;
  orbit.enabled = true;
  syncPlayerAvatarVisibility(null);
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

function customCameraViewById(id = selectedCustomCameraId) {
  return customCameraViews.find(view => view.id === id) || null;
}

function nextCustomCameraId() {
  customCameraIdCounter += 1;
  return `camera-director-${customCameraIdCounter}`;
}

function validCameraVector(value, fallback) {
  return Array.isArray(value) && value.length === 3 && value.every(Number.isFinite)
    ? value.map(Number)
    : [...fallback];
}

function boneCameraQuaternion(bone) {
  if (!bone) return new THREE.Quaternion();
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(
    THREE.MathUtils.degToRad(Number(bone.rotation.x) || 0),
    THREE.MathUtils.degToRad(Number(bone.rotation.y) || 0),
    THREE.MathUtils.degToRad(Number(bone.rotation.z) || 0),
    "XYZ"
  ));
}

function resolvedCustomCameraPose(view) {
  const fallbackPosition = new THREE.Vector3().fromArray(view?.position || [6, 5, 7]);
  const fallbackTarget = new THREE.Vector3().fromArray(view?.target || [0, 1, 0]);
  const fallbackUp = new THREE.Vector3().fromArray(view?.up || [0, 1, 0]);
  if (!view || view.type !== "player" || !view.anchorBoneId) {
    return { position: fallbackPosition, target: fallbackTarget, up: fallbackUp };
  }
  const bone = boneById(view.anchorBoneId);
  if (!bone) return { position: fallbackPosition, target: fallbackTarget, up: fallbackUp };
  syncPlayerAvatarBone(bone);
  const rotation = boneCameraQuaternion(bone);
  const offset = new THREE.Vector3().fromArray(validCameraVector(view.positionOffset, [0, 0, 0])).applyQuaternion(rotation);
  const position = bone.position.clone().add(offset);
  const direction = new THREE.Vector3().fromArray(validCameraVector(view.localDirection, [0, 0, -1])).applyQuaternion(rotation).normalize();
  const up = new THREE.Vector3().fromArray(validCameraVector(view.localUp, [0, 1, 0])).applyQuaternion(rotation).normalize();
  const target = position.clone().add(direction);
  view.position = position.toArray();
  view.target = target.toArray();
  view.up = up.toArray();
  return { position, target, up };
}

function disposeCameraDirectorMarkers() {
  cameraDirectorGroup.traverse(object => {
    object.geometry?.dispose?.();
    if (Array.isArray(object.material)) object.material.forEach(material => material?.dispose?.());
    else object.material?.dispose?.();
  });
  cameraDirectorGroup.clear();
}

function makeCameraDirectorMarker(view, selectedMarker = false) {
  const color = selectedMarker ? 0xe1b14b : 0x40c7a5;
  const material = new THREE.MeshBasicMaterial({ color, depthWrite: false });
  const marker = new THREE.Group();
  marker.name = `Camera Director: ${view.name}`;
  marker.userData.cameraViewId = view.id;
  const pose = resolvedCustomCameraPose(view);
  marker.position.copy(pose.position);

  const body = new THREE.Mesh(new THREE.BoxGeometry(.46, .28, .32), material.clone());
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(.1, .14, .22, 12), material.clone());
  lens.rotation.x = Math.PI / 2;
  lens.position.z = .25;
  const head = new THREE.Mesh(new THREE.SphereGeometry(.11, 12, 8), material.clone());
  head.position.set(0, .27, 0);
  const tripod = new THREE.Mesh(new THREE.CylinderGeometry(.035, .08, .48, 8), material.clone());
  tripod.position.y = -.35;
  marker.add(body, lens, head, tripod);

  const aim = pose.target.clone();
  if (aim.distanceToSquared(marker.position) < 1e-8) aim.z += 1;
  marker.lookAt(aim);
  marker.traverse(object => {
    object.renderOrder = 50;
    object.userData.cameraViewId = view.id;
  });
  return marker;
}

function renderCustomCameraMarkers() {
  disposeCameraDirectorMarkers();
  if (activeCustomCameraId) {
    cameraDirectorGroup.visible = false;
    boneRigGroup.visible = !!els.showBonesInput?.checked;
    return;
  }
  for (const view of customCameraViews) {
    if (view.id === activeCustomCameraId) continue;
    cameraDirectorGroup.add(makeCameraDirectorMarker(view, view.id === selectedCustomCameraId));
  }
  // Looking through any saved camera must be unobstructed. Other directors can
  // occupy the same position (for example a free view and a player joint), so
  // hiding only the active marker is not sufficient.
  cameraDirectorGroup.visible = !!els.showCustomCamerasInput?.checked && !activeCustomCameraId;
  boneRigGroup.visible = !!els.showBonesInput?.checked;
}

function syncCameraDirectorVisibility() {
  const cameraNearDirector = customCameraViews.some(view => {
    const pose = resolvedCustomCameraPose(view);
    return pose.position.distanceTo(camera.position) <= 2;
  });
  cameraDirectorGroup.visible = !!els.showCustomCamerasInput?.checked && !activeCustomCameraId && !cameraNearDirector;
  // OrbitControls can leave the saved-camera state as soon as a user begins
  // navigating. Keep every director near the eye hidden regardless, including
  // two different saved cameras placed at the exact same coordinates.
  for (const marker of cameraDirectorGroup.children) {
    marker.visible = marker.position.distanceTo(camera.position) > 2;
  }
}

function customCameraInputs() {
  return [
    els.customCameraNameInput,
    els.customCameraPosX,
    els.customCameraPosY,
    els.customCameraPosZ,
    els.customCameraTargetX,
    els.customCameraTargetY,
    els.customCameraTargetZ
  ];
}

function syncCustomCameraInputs() {
  const view = customCameraViewById();
  for (const input of customCameraInputs()) input.disabled = !view;
  els.viewCustomCameraBtn.disabled = !view;
  els.detachCustomCameraBtn.disabled = !view || activeCustomCameraId !== view.id;
  els.updateCustomCameraBtn.disabled = !view;
  els.deleteCustomCameraBtn.disabled = !view;
  if (!view) {
    els.customCameraTypeLabel.textContent = "Type: no camera selected";
    els.customCameraNameInput.value = "";
    for (const input of customCameraInputs().slice(1)) input.value = "";
    return;
  }
  const pose = resolvedCustomCameraPose(view);
  const anchor = view.type === "player" ? boneById(view.anchorBoneId) : null;
  for (const input of [els.customCameraPosX, els.customCameraPosY, els.customCameraPosZ]) {
    input.disabled = !view || view.type === "player";
    input.title = view.type === "player" ? "Locked to the player head; move the avatar to change position" : "";
  }
  els.customCameraTypeLabel.textContent = view.type === "player"
    ? `Type: player eye on joint ${anchor?.name || "(missing joint)"}${activeCustomCameraId === view.id ? " — attached; drag to look" : " — detached"}`
    : "Type: free camera director";
  els.customCameraNameInput.value = view.name;
  [els.customCameraPosX, els.customCameraPosY, els.customCameraPosZ].forEach((input, index) => { input.value = round(pose.position.toArray()[index]); });
  [els.customCameraTargetX, els.customCameraTargetY, els.customCameraTargetZ].forEach((input, index) => { input.value = round(pose.target.toArray()[index]); });
}

function renderCustomCameraViews() {
  if (!customCameraViewById()) selectedCustomCameraId = customCameraViews[0]?.id || null;
  els.customCameraList.innerHTML = "";
  for (const view of customCameraViews) {
    const option = document.createElement("option");
    option.value = view.id;
    option.textContent = view.name;
    option.selected = view.id === selectedCustomCameraId;
    els.customCameraList.append(option);
  }
  syncCustomCameraInputs();
  renderCustomCameraMarkers();
}

function selectCustomCameraView(id) {
  selectedCustomCameraId = customCameraViews.some(view => view.id === id) ? id : null;
  renderCustomCameraViews();
}

function addCustomCameraView() {
  recordHistory("add camera director");
  const view = {
    id: nextCustomCameraId(),
    name: `Camera ${customCameraViews.length + 1}`,
    type: "director",
    position: camera.position.toArray(),
    target: orbit.target.toArray(),
    up: camera.up.toArray(),
    fov: camera.fov
  };
  customCameraViews.push(view);
  selectedCustomCameraId = view.id;
  activeCustomCameraId = view.id;
  renderCustomCameraViews();
  log(`Added ${view.name} at the current viewport.`);
  return view;
}

function lowPolyPlayerAvatarGeometryData() {
  const parts = [];
  const palette = {
    armor: "#697077",
    armorLight: "#a9afb4",
    armorDark: "#3b4146",
    edge: "#c1c5c8",
    joint: "#121619",
    visor: "#05080a",
    accent: "#ff3b35"
  };
  const chamferedBox = (width, height, depth, chamfer = .035, bevel = .008) => {
    const x = width / 2;
    const y = height / 2;
    const cut = Math.min(chamfer, x * .45, y * .45);
    const shape = new THREE.Shape();
    shape.moveTo(-x + cut, -y);
    shape.lineTo(x - cut, -y);
    shape.lineTo(x, -y + cut);
    shape.lineTo(x, y - cut);
    shape.lineTo(x - cut, y);
    shape.lineTo(-x + cut, y);
    shape.lineTo(-x, y - cut);
    shape.lineTo(-x, -y + cut);
    shape.closePath();
    const bevelSize = Math.min(bevel, depth * .18, cut * .45);
    const coreDepth = Math.max(.002, depth - bevelSize * 2);
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: coreDepth,
      steps: 1,
      curveSegments: 1,
      bevelEnabled: bevelSize > 0,
      bevelSegments: 1,
      bevelSize,
      bevelThickness: bevelSize
    });
    geometry.translate(0, 0, -coreDepth / 2);
    return geometry;
  };
  const addPart = (geometry, position, rotation = [0, 0, 0], scale = [1, 1, 1], color = palette.armor) => {
    if (geometry.index) {
      const source = geometry;
      geometry = source.toNonIndexed();
      source.dispose();
    }
    const vertexColor = new THREE.Color(color);
    const count = geometry.getAttribute("position").count;
    const colors = new Float32Array(count * 3);
    for (let index = 0; index < count; index++) {
      colors[index * 3] = vertexColor.r;
      colors[index * 3 + 1] = vertexColor.g;
      colors[index * 3 + 2] = vertexColor.b;
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(...position),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
      new THREE.Vector3(...scale)
    );
    geometry.applyMatrix4(matrix);
    parts.push(geometry);
  };

  // Layered boots, shin armor, knees, and thigh shells.
  for (const side of [-1, 1]) {
    const x = side * .17;
    addPart(chamferedBox(.27, .13, .40, .045, .014), [x, .075, -.07], [0, 0, 0], [1, 1, 1], palette.armorLight);
    addPart(chamferedBox(.23, .075, .27, .03, .008), [x, .15, -.105], [-.13, 0, 0], [1, 1, 1], palette.edge);
    addPart(chamferedBox(.21, .11, .16, .025, .008), [x, .16, .095], [0, 0, 0], [1, 1, 1], palette.joint);
    addPart(new THREE.CylinderGeometry(.105, .115, .09, 8), [x, .205, .015], [0, 0, 0], [1, 1, .82], palette.joint);
    addPart(new THREE.CylinderGeometry(.115, .135, .32, 6), [x, .385, .02], [0, 0, 0], [1, 1, .80], palette.armor);
    addPart(chamferedBox(.18, .255, .045, .025, .007), [x, .405, -.115], [0, 0, 0], [1, 1, 1], palette.armorLight);
    addPart(chamferedBox(.13, .18, .026, .018, .004), [x, .40, -.143], [0, 0, 0], [1, 1, 1], palette.edge);
    addPart(new THREE.SphereGeometry(.125, 7, 5), [x, .59, 0], [0, 0, 0], [1, .82, .88], palette.joint);
    addPart(new THREE.TorusGeometry(.078, .018, 5, 10), [x, .59, -.105], [0, 0, 0], [1, 1, 1], palette.accent);
    addPart(new THREE.CylinderGeometry(.145, .12, .31, 6), [x, .785, 0], [0, 0, side * .035], [1, 1, .82], palette.armorDark);
    addPart(chamferedBox(.22, .27, .055, .03, .008), [x, .80, -.125], [0, 0, side * .035], [1, 1, 1], palette.armorLight);
    addPart(chamferedBox(.155, .20, .025, .022, .004), [x, .805, -.165], [0, 0, side * .035], [1, 1, 1], palette.armor);
    addPart(new THREE.SphereGeometry(.105, 7, 5), [x, .965, 0], [0, 0, 0], [1, .82, .9], palette.joint);
  }

  // Mechanical pelvis and ribbed waist.
  addPart(new THREE.CylinderGeometry(.285, .245, .20, 6), [0, 1.02, 0], [0, 0, 0], [1, 1, .74], palette.armorDark);
  addPart(chamferedBox(.46, .16, .27, .055, .012), [0, 1.045, -.01], [0, 0, 0], [1, 1, 1], palette.armorLight);
  addPart(chamferedBox(.22, .11, .035, .025, .006), [0, 1.055, -.158], [0, 0, 0], [1, 1, 1], palette.armor);
  addPart(new THREE.CylinderGeometry(.205, .195, .24, 8), [0, 1.18, 0], [0, 0, 0], [1, 1, .76], palette.joint);
  for (const y of [1.105, 1.17, 1.235]) {
    addPart(new THREE.TorusGeometry(.188, .018, 4, 10), [0, y, 0], [Math.PI / 2, 0, 0], [1, .75, 1], palette.armorDark);
  }

  // Broad faceted torso with layered breastplate, collar, and rear identity plate.
  addPart(new THREE.CylinderGeometry(.36, .245, .40, 6), [0, 1.39, 0], [0, 0, 0], [1, 1, .70], palette.armorDark);
  addPart(chamferedBox(.55, .34, .085, .07, .014), [0, 1.40, -.205], [0, 0, 0], [1, 1, 1], palette.armor);
  addPart(chamferedBox(.39, .25, .045, .055, .010), [0, 1.405, -.272], [0, 0, 0], [1, 1, 1], palette.armorLight);
  addPart(chamferedBox(.24, .19, .026, .035, .006), [0, 1.405, -.310], [0, 0, 0], [1, 1, 1], palette.visor);
  addPart(chamferedBox(.48, .09, .12, .035, .010), [0, 1.57, -.04], [0, 0, 0], [1, 1, 1], palette.armorLight);
  addPart(chamferedBox(.44, .29, .065, .06, .012), [0, 1.40, .215], [0, 0, 0], [1, 1, 1], palette.armor);
  addPart(chamferedBox(.25, .18, .025, .03, .005), [0, 1.41, .260], [0, 0, 0], [1, 1, 1], palette.visor);

  // Lightning chest emblem and a compact BW-like mark on the back.
  addPart(chamferedBox(.052, .13, .018, .012, .003), [-.024, 1.455, -.330], [0, 0, -.42], [1, 1, 1], palette.accent);
  addPart(chamferedBox(.052, .12, .018, .012, .003), [.018, 1.38, -.330], [0, 0, -.42], [1, 1, 1], palette.accent);
  addPart(chamferedBox(.045, .095, .015, .010, .002), [-.055, 1.425, .278], [0, 0, -.18], [1, 1, 1], palette.accent);
  addPart(chamferedBox(.045, .095, .015, .010, .002), [0, 1.425, .278], [0, 0, .18], [1, 1, 1], palette.accent);
  addPart(chamferedBox(.045, .095, .015, .010, .002), [.055, 1.425, .278], [0, 0, -.18], [1, 1, 1], palette.accent);

  // Multi-layer shoulder caps, upper/lower arm plates, elbow rings, and articulated hands.
  for (const side of [-1, 1]) {
    const shoulderX = side * .43;
    addPart(new THREE.SphereGeometry(.12, 7, 5), [shoulderX, 1.46, 0], [0, 0, 0], [1, .95, 1], palette.joint);
    addPart(chamferedBox(.22, .19, .23, .045, .012), [side * .455, 1.465, 0], [0, 0, side * .18], [1, 1, 1], palette.armorLight);
    addPart(chamferedBox(.19, .13, .055, .03, .008), [side * .465, 1.49, -.135], [0, 0, side * .18], [1, 1, 1], palette.edge);
    addPart(new THREE.CylinderGeometry(.105, .09, .27, 6), [side * .49, 1.275, 0], [0, 0, side * .10], [1, 1, .82], palette.armorDark);
    addPart(chamferedBox(.16, .23, .05, .025, .008), [side * .505, 1.285, -.105], [0, 0, side * .10], [1, 1, 1], palette.armor);
    addPart(new THREE.SphereGeometry(.094, 7, 5), [side * .515, 1.105, 0], [0, 0, 0], [1, .84, .92], palette.joint);
    addPart(new THREE.TorusGeometry(.060, .014, 5, 10), [side * .515, 1.105, -.082], [0, 0, 0], [1, 1, 1], palette.accent);
    addPart(new THREE.CylinderGeometry(.082, .105, .27, 6), [side * .52, .925, 0], [0, 0, side * .035], [1, 1, .78], palette.armorDark);
    addPart(chamferedBox(.145, .23, .052, .025, .008), [side * .525, .93, -.10], [0, 0, side * .035], [1, 1, 1], palette.armorLight);
    addPart(new THREE.CylinderGeometry(.068, .072, .075, 8), [side * .53, .755, 0], [0, 0, 0], [1, 1, .86], palette.joint);
    addPart(chamferedBox(.145, .13, .17, .025, .008), [side * .535, .675, -.015], [0, 0, 0], [1, 1, 1], palette.armorDark);
    for (const finger of [-1.5, -.5, .5, 1.5]) {
      addPart(chamferedBox(.027, .14, .032, .006, .002), [side * .54, .565, finger * .035], [0, 0, side * .045], [1, 1, 1], palette.armorLight);
    }
    addPart(chamferedBox(.035, .105, .04, .007, .002), [side * .61, .64, -.01], [0, 0, side * .38], [1, 1, 1], palette.armorLight);
  }

  // Octagonal helmet with an inset face, metallic rim, red eyes, crown, and ear modules.
  addPart(new THREE.CylinderGeometry(.09, .105, .105, 8), [0, 1.59, 0], [0, 0, 0], [1, 1, 1], palette.joint);
  addPart(chamferedBox(.37, .28, .33, .065, .015), [0, 1.66, 0], [0, 0, 0], [1, 1, 1], palette.armorDark);
  addPart(chamferedBox(.32, .235, .055, .052, .010), [0, 1.655, -.180], [0, 0, 0], [1, 1, 1], palette.edge);
  addPart(chamferedBox(.275, .19, .030, .043, .006), [0, 1.652, -.221], [0, 0, 0], [1, 1, 1], palette.visor);
  addPart(chamferedBox(.24, .045, .055, .018, .006), [0, 1.79, -.015], [0, 0, 0], [1, 1, 1], palette.armorLight);
  addPart(chamferedBox(.032, .095, .014, .010, .003), [-.068, 1.66, -.242], [0, 0, 0], [1, 1, 1], palette.accent);
  addPart(chamferedBox(.032, .095, .014, .010, .003), [.068, 1.66, -.242], [0, 0, 0], [1, 1, 1], palette.accent);
  for (const side of [-1, 1]) {
    addPart(new THREE.CylinderGeometry(.085, .085, .070, 8), [side * .20, 1.66, 0], [0, 0, Math.PI / 2], [1, 1, 1], palette.armorLight);
    addPart(new THREE.CylinderGeometry(.052, .052, .078, 8), [side * .204, 1.66, 0], [0, 0, Math.PI / 2], [1, 1, 1], palette.joint);
    addPart(new THREE.TorusGeometry(.040, .010, 5, 10), [side * .246, 1.66, 0], [0, Math.PI / 2, 0], [1, 1, 1], palette.armorDark);
  }

  const geometry = mergeGeometries(parts, false);
  parts.forEach(part => part.dispose());
  if (!geometry) throw new Error("Could not build the player avatar geometry.");
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const data = geometryToData(geometry);
  geometry.dispose();
  return data;
}

function playerViewDirection() {
  const direction = orbit.target.clone().sub(camera.position);
  if (direction.lengthSq() < 1e-8) direction.set(0, 0, -1);
  return direction.normalize();
}

function placePlayerAvatarAtCamera(avatar, direction = playerViewDirection()) {
  const flatDirection = new THREE.Vector3(direction.x, 0, direction.z);
  if (flatDirection.lengthSq() < 1e-8) flatDirection.set(0, 0, -1);
  flatDirection.normalize();
  avatar.rotation.set(0, Math.atan2(-flatDirection.x, -flatDirection.z), 0);
  const headOffset = new THREE.Vector3().fromArray(avatar.userData.playerHeadOffset || [0, 1.70, 0]);
  const worldOffset = headOffset.multiply(avatar.scale).applyQuaternion(avatar.quaternion);
  avatar.position.copy(camera.position).sub(worldOffset);
  avatar.updateMatrixWorld(true);
}

function syncPlayerAvatarBone(bone) {
  if (!bone?.avatarObjectId) return false;
  const avatar = findObject(bone.avatarObjectId);
  if (!avatar?.userData?.playerAvatar) return false;
  avatar.updateMatrixWorld(true);
  const headOffset = new THREE.Vector3().fromArray(avatar.userData.playerHeadOffset || [0, 1.70, 0]);
  bone.position.copy(avatar.localToWorld(headOffset));
  bone.rotation.set(
    THREE.MathUtils.radToDeg(avatar.rotation.x),
    THREE.MathUtils.radToDeg(avatar.rotation.y),
    THREE.MathUtils.radToDeg(avatar.rotation.z)
  );
  return true;
}

function syncPlayerAvatarBones({ object = null, rebuild = false } = {}) {
  let changed = false;
  for (const bone of rigBones) {
    if (!bone.avatarObjectId) continue;
    if (object && object.userData?.id !== bone.avatarObjectId) continue;
    changed = syncPlayerAvatarBone(bone) || changed;
  }
  if (changed && rebuild) {
    rebuildBoneVisuals();
    syncBonePanel();
  }
  return changed;
}

function syncPlayerAvatarVisibility(activeView = null) {
  const activeBone = activeView?.type === "player" ? boneById(activeView.anchorBoneId) : null;
  const hiddenAvatarId = activeBone?.avatarObjectId || null;
  for (const avatar of objects.filter(object => object.userData.playerAvatar)) {
    avatar.visible = !avatar.userData.hidden && avatar.userData.id !== hiddenAvatarId;
  }
}

function activePlayerCameraView() {
  const view = customCameraViewById(activeCustomCameraId);
  return view?.type === "player" ? view : null;
}

function beginPlayerCameraLook(event) {
  const view = activePlayerCameraView();
  if (!view || event.button !== 0) return false;
  playerLookDrag = {
    pointerId: event.pointerId,
    clientX: event.clientX,
    clientY: event.clientY
  };
  orbit.enabled = false;
  canvas.setPointerCapture?.(event.pointerId);
  return true;
}

function movePlayerCameraLook(event) {
  if (!playerLookDrag || event.pointerId !== playerLookDrag.pointerId) return false;
  const view = activePlayerCameraView();
  const bone = view ? boneById(view.anchorBoneId) : null;
  if (!view || !bone) return false;
  const dx = event.clientX - playerLookDrag.clientX;
  const dy = event.clientY - playerLookDrag.clientY;
  playerLookDrag.clientX = event.clientX;
  playerLookDrag.clientY = event.clientY;
  if (!dx && !dy) return true;
  const pose = resolvedCustomCameraPose(view);
  const direction = pose.target.clone().sub(pose.position).normalize();
  direction.applyQuaternion(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -dx * .005));
  const right = direction.clone().cross(new THREE.Vector3(0, 1, 0)).normalize();
  if (right.lengthSq() > 1e-8) {
    const pitched = direction.clone().applyQuaternion(new THREE.Quaternion().setFromAxisAngle(right, -dy * .005)).normalize();
    if (Math.abs(pitched.y) < .985) direction.copy(pitched);
  }
  const inverseRotation = boneCameraQuaternion(bone).invert();
  view.localDirection = direction.clone().applyQuaternion(inverseRotation).normalize().toArray();
  view.localUp = new THREE.Vector3(0, 1, 0).applyQuaternion(inverseRotation).toArray();
  view.position = pose.position.toArray();
  view.target = pose.position.clone().add(direction).toArray();
  camera.position.copy(pose.position);
  orbit.target.copy(pose.position).add(direction);
  camera.up.set(0, 1, 0);
  camera.lookAt(orbit.target);
  syncCustomCameraInputs();
  return true;
}

function endPlayerCameraLook(event) {
  if (!playerLookDrag || event.pointerId !== playerLookDrag.pointerId) return false;
  canvas.releasePointerCapture?.(event.pointerId);
  playerLookDrag = null;
  return true;
}

function detachCustomCameraView({ showPlayer = true } = {}) {
  const view = customCameraViewById(activeCustomCameraId);
  if (!view) return;
  const pose = resolvedCustomCameraPose(view);
  const bone = view.type === "player" ? boneById(view.anchorBoneId) : null;
  const avatar = bone?.avatarObjectId ? findObject(bone.avatarObjectId) : null;
  activeCustomCameraId = null;
  playerLookDrag = null;
  orbit.enabled = true;
  syncPlayerAvatarVisibility(null);
  if (showPlayer && avatar?.userData?.playerAvatar) {
    avatar.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(avatar);
    const center = box.getCenter(new THREE.Vector3());
    const size = Math.max(.5, box.getSize(new THREE.Vector3()).length());
    const forward = pose.target.clone().sub(pose.position);
    forward.y = 0;
    if (forward.lengthSq() < 1e-8) forward.set(0, 0, -1);
    forward.normalize();
    orbit.target.copy(center).add(new THREE.Vector3(0, size * .08, 0));
    camera.position.copy(center).addScaledVector(forward, -size * 1.55).add(new THREE.Vector3(0, size * .35, 0));
    camera.up.set(0, 1, 0);
    camera.near = Math.max(.01, size / 2000);
    camera.lookAt(orbit.target);
    camera.updateProjectionMatrix();
    orbit.update();
  }
  renderCustomCameraViews();
  log(showPlayer && avatar ? `Detached from ${view.name}; third-person view is framing ${avatar.name}.` : `Detached from ${view.name}.`);
}

function addPlayerCameraOnSelectedJoint() {
  recordHistory("create player camera at current view");
  const playerIndex = rigBones.filter(bone => bone.role === "camera").length + 1;
  const direction = playerViewDirection();
  const avatar = addObject({
    shape: "custom",
    geometry: lowPolyPlayerAvatarGeometryData(),
    name: `BoltWorks Player Avatar ${playerIndex}`,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    color: "#ffffff",
    roughness: .58,
    materialRule: "metal",
    playerAvatar: true,
    playerHeadOffset: [0, 1.66, 0]
  }, { record: false, select: false, update: false });
  placePlayerAvatarAtCamera(avatar, direction);
  const bone = {
    id: freshBoneId(),
    name: `Player Head ${playerIndex}`,
    parentId: null,
    role: "camera",
    avatarObjectId: avatar.userData.id,
    position: camera.position.clone(),
    rotation: new THREE.Vector3()
  };
  rigBones.push(bone);
  selectedBoneId = bone.id;
  syncPlayerAvatarBone(bone);
  const inverseRotation = boneCameraQuaternion(bone).invert();
  const view = {
    id: nextCustomCameraId(),
    name: `Player View ${playerIndex}`,
    type: "player",
    anchorBoneId: bone.id,
    position: bone.position.toArray(),
    target: bone.position.clone().add(direction).toArray(),
    up: camera.up.toArray(),
    fov: camera.fov,
    positionOffset: [0, 0, 0],
    localDirection: direction.clone().applyQuaternion(inverseRotation).toArray(),
    localUp: camera.up.clone().normalize().applyQuaternion(inverseRotation).toArray()
  };
  customCameraViews.push(view);
  selectedCustomCameraId = view.id;
  activeCustomCameraId = view.id;
  rebuildBoneVisuals();
  syncBonePanel();
  updateAll();
  activateCustomCameraView(view.id);
  log(`Created ${view.name} and ${avatar.name} at the current camera. Move or rotate the avatar to move the viewpoint.`);
  return view;
}

function updateCustomCameraFromCurrentView() {
  const view = customCameraViewById();
  if (!view) return;
  recordHistory("update camera director");
  view.position = camera.position.toArray();
  view.target = orbit.target.toArray();
  view.up = camera.up.toArray();
  if (view.type === "player") {
    const bone = boneById(view.anchorBoneId);
    if (bone) {
      const direction = playerViewDirection();
      const avatar = bone.avatarObjectId ? findObject(bone.avatarObjectId) : null;
      if (avatar?.userData?.playerAvatar) {
        placePlayerAvatarAtCamera(avatar, direction);
        syncPlayerAvatarBone(bone);
      } else {
        bone.position.copy(camera.position);
        bone.rotation.set(0, 0, 0);
      }
      bone.role = "camera";
      view.positionOffset = [0, 0, 0];
      const inverseRotation = boneCameraQuaternion(bone).invert();
      view.localDirection = direction.clone().applyQuaternion(inverseRotation).toArray();
      view.localUp = camera.up.clone().normalize().applyQuaternion(inverseRotation).toArray();
      rebuildBoneVisuals();
      syncBonePanel();
    }
  }
  view.fov = camera.fov;
  activeCustomCameraId = view.id;
  renderCustomCameraViews();
  log(view.type === "player"
    ? `Moved ${view.name} and its head joint exactly to the current viewport.`
    : `Moved ${view.name} to the current viewport.`);
}

function updateCustomCameraFromInputs({ record = true, render = true, refreshMarkers = true } = {}) {
  const view = customCameraViewById();
  if (!view) return;
  if (record) recordHistory("edit camera director");
  view.name = els.customCameraNameInput.value.trim() || view.name;
  const positionInputs = [els.customCameraPosX, els.customCameraPosY, els.customCameraPosZ];
  const targetInputs = [els.customCameraTargetX, els.customCameraTargetY, els.customCameraTargetZ];
  view.target = targetInputs.map((input, index) => Number.isFinite(Number(input.value)) ? Number(input.value) : view.target[index]);
  if (view.type === "player") {
    const bone = boneById(view.anchorBoneId);
    if (bone) {
      const inverseRotation = boneCameraQuaternion(bone).invert();
      view.position = bone.position.toArray();
      view.positionOffset = [0, 0, 0];
      const direction = new THREE.Vector3().fromArray(view.target).sub(bone.position);
      if (direction.lengthSq() > 1e-8) view.localDirection = direction.normalize().applyQuaternion(inverseRotation).toArray();
    }
  }
  else {
    view.position = positionInputs.map((input, index) => Number.isFinite(Number(input.value)) ? Number(input.value) : view.position[index]);
  }
  if (render) renderCustomCameraViews();
  else {
    const option = els.customCameraList.querySelector(`option[value="${view.id}"]`);
    if (option) option.textContent = view.name;
    if (refreshMarkers) renderCustomCameraMarkers();
  }
}

function deleteCustomCameraView() {
  const view = customCameraViewById();
  if (!view) return;
  recordHistory("delete camera director");
  customCameraViews = customCameraViews.filter(candidate => candidate.id !== view.id);
  if (activeCustomCameraId === view.id) {
    activeCustomCameraId = null;
    orbit.enabled = true;
    syncPlayerAvatarVisibility(null);
  }
  selectedCustomCameraId = customCameraViews[0]?.id || null;
  renderCustomCameraViews();
  log(`Deleted ${view.name}.`);
}

function activateCustomCameraView(id = selectedCustomCameraId) {
  const view = customCameraViewById(id);
  if (!view) return;
  selectedCustomCameraId = view.id;
  activeCustomCameraId = view.id;
  playerLookDrag = null;
  if (view.type === "player") view.positionOffset = [0, 0, 0];
  orbit.enabled = view.type !== "player";
  // Directors are editor helpers, never part of the photographed view. Turning
  // the overlay off here also covers overlapping cameras at the same joint.
  els.showCustomCamerasInput.checked = false;
  cameraDirectorGroup.visible = false;
  const pose = resolvedCustomCameraPose(view);
  camera.position.copy(pose.position);
  orbit.target.copy(pose.target);
  camera.up.copy(pose.up);
  camera.fov = Math.max(10, Math.min(120, Number(view.fov) || 55));
  const distance = Math.max(.05, camera.position.distanceTo(orbit.target));
  camera.near = Math.max(.01, distance / 2000);
  camera.far = Math.max(1000000, distance * 100);
  camera.lookAt(orbit.target);
  camera.updateProjectionMatrix();
  orbit.update();
  renderCustomCameraViews();
  log(`Viewing the scene through ${view.name}.`);
}

function syncActiveJointCamera() {
  const view = customCameraViewById(activeCustomCameraId);
  boneRigGroup.visible = !!els.showBonesInput?.checked;
  syncPlayerAvatarVisibility(view);
  if (!view || view.type !== "player" || !boneById(view.anchorBoneId)) {
    return;
  }
  orbit.enabled = false;
  syncPlayerAvatarBone(boneById(view.anchorBoneId));
  const pose = resolvedCustomCameraPose(view);
  camera.position.copy(pose.position);
  orbit.target.copy(pose.target);
  camera.up.copy(pose.up);
  camera.lookAt(pose.target);
}

function restoreCustomCameraViews(cameraState = {}) {
  customCameraIdCounter = 0;
  activeCustomCameraId = null;
  playerLookDrag = null;
  orbit.enabled = true;
  syncPlayerAvatarVisibility(null);
  customCameraViews = (cameraState.views || []).map((view, index) => {
    const id = typeof view?.id === "string" && view.id ? view.id : `camera-director-${index + 1}`;
    const match = id.match(/(\d+)$/);
    if (match) customCameraIdCounter = Math.max(customCameraIdCounter, Number(match[1]));
    return {
      id,
      name: String(view?.name || `Camera ${index + 1}`),
      type: view?.type === "player" ? "player" : "director",
      anchorBoneId: typeof view?.anchorBoneId === "string" ? view.anchorBoneId : null,
      position: validCameraVector(view?.position, [6, 5, 7]),
      target: validCameraVector(view?.target, [0, 1, 0]),
      up: validCameraVector(view?.up, [0, 1, 0]),
      fov: Math.max(10, Math.min(120, Number(view?.fov) || 55)),
      positionOffset: validCameraVector(view?.positionOffset, [0, 0, 0]),
      localDirection: validCameraVector(view?.localDirection, [0, 0, -1]),
      localUp: validCameraVector(view?.localUp, [0, 1, 0])
    };
  });
  selectedCustomCameraId = customCameraViews.some(view => view.id === cameraState.selectedId)
    ? cameraState.selectedId
    : (customCameraViews[0]?.id || null);
  els.showCustomCamerasInput.checked = cameraState.showMarkers ?? true;
  renderCustomCameraViews();
}

const screenshotViewDirections = {
  front: new THREE.Vector3(0, 0, 1),
  back: new THREE.Vector3(0, 0, -1),
  // Side labels describe the direction the character faces in the exported
  // image: Left faces screen-left and Right faces screen-right.
  left: new THREE.Vector3(1, 0, 0),
  right: new THREE.Vector3(-1, 0, 0),
  side: new THREE.Vector3(1, 0, 0),
  top: new THREE.Vector3(0, 1, 0),
  iso: new THREE.Vector3(.78, .52, .92),
  "front-left": new THREE.Vector3(.78, .35, .92),
  "front-right": new THREE.Vector3(-.78, .35, .92),
  "back-left": new THREE.Vector3(.78, .35, -.92),
  "back-right": new THREE.Vector3(-.78, .35, -.92)
};

function sceneBounds() {
  const box = new THREE.Box3();
  for (const object of objects) box.expandByObject(object);
  if (!objects.length || box.isEmpty()) {
    box.setFromCenterAndSize(new THREE.Vector3(0, 1, 0), new THREE.Vector3(4, 3, 4));
  }
  return box;
}

function setCameraToView(viewName, { useCurrentZoom = false, currentDistance = null, bounds = null, directionOverride = null, centerOverride = null } = {}) {
  const box = bounds?.isBox3 ? bounds : sceneBounds();
  const center = centerOverride?.isVector3 ? centerOverride.clone() : box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z, 2);
  const defaultSpace = shotSpaceMultiplier();
  updateViewScale(radius);
  const direction = (directionOverride?.isVector3 ? directionOverride : (screenshotViewDirections[viewName] || screenshotViewDirections.iso)).clone().normalize();
  const baseDistance = radius / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * .82;
  const currentSpace = useCurrentZoom && currentDistance ? Math.max(.2, currentDistance / Math.max(.001, baseDistance)) : defaultSpace;
  const distance = baseDistance * currentSpace;
  camera.position.copy(center).add(direction.multiplyScalar(distance));
  camera.near = Math.max(.01, distance / 2000);
  camera.far = Math.max(1000000, distance * 60);
  camera.up.set(0, 1, 0);
  if (viewName === "top") camera.up.set(0, 0, -1);
  orbit.target.copy(center);
  camera.lookAt(center);
  camera.updateProjectionMatrix();
  const dampingWasEnabled = orbit.enableDamping;
  orbit.enableDamping = false;
  orbit.update();
  orbit.enableDamping = dampingWasEnabled;
}

const workViewAxisLabels = {
  front: "Front view: X ↔ horizontal · Y ↕ vertical (Z hidden)",
  side: "Side view: Z ↔ horizontal · Y ↕ vertical (X hidden)",
  top: "Top view: X ↔ horizontal · Z ↕ vertical (Y hidden)"
};

let referenceViewportsCollapsed = false;

function setReferenceViewportsCollapsed(collapsed) {
  referenceViewportsCollapsed = !!collapsed;
  els.viewportRoot?.classList.toggle("reference-views-collapsed", referenceViewportsCollapsed);
  if (els.referenceViewportsToggleBtn) {
    els.referenceViewportsToggleBtn.textContent = referenceViewportsCollapsed ? "◀" : "▶";
    els.referenceViewportsToggleBtn.title = referenceViewportsCollapsed
      ? "Show the Front and Side reference views"
      : "Hide the Front and Side reference views";
    els.referenceViewportsToggleBtn.setAttribute("aria-pressed", String(referenceViewportsCollapsed));
  }
  requestAnimationFrame(() => {
    window.dispatchEvent(new Event("resize"));
    if (typeof resize === "function") resize();
  });
}

function syncOrthographicWorkViewUi() {
  const map = {
    front: els.workViewFrontBtn,
    side: els.workViewSideBtn,
    top: els.workViewTopBtn
  };
  for (const [name, button] of Object.entries(map)) button?.classList.toggle("active", activeWorkView === name);
  if (els.workViewRestoreBtn) els.workViewRestoreBtn.hidden = !activeWorkView;
  if (els.workViewAxisLabel) {
    els.workViewAxisLabel.hidden = !activeWorkView;
    els.workViewAxisLabel.textContent = activeWorkView ? workViewAxisLabels[activeWorkView] || "" : "";
  }
  els.viewportRoot?.classList.toggle("work-view-active", !!activeWorkView);
}

function setOrthographicWorkView(viewName) {
  if (!["front", "side", "top"].includes(viewName)) return false;
  if (!savedWorkViewCamera) {
    savedWorkViewCamera = {
      position: camera.position.clone(),
      up: camera.up.clone(),
      target: orbit.target.clone(),
      near: camera.near,
      far: camera.far,
      enableRotate: orbit.enableRotate
    };
  }
  activeWorkView = viewName;
  setCameraToView(viewName);
  orbit.enableRotate = false;
  syncOrthographicWorkViewUi();
  configureSurfaceTransformAxis();
  updateSurfaceGizmoAttachment();
  log(`${viewName[0].toUpperCase()}${viewName.slice(1)} is now the main constrained work view.`);
  return true;
}

function restoreOrthographicWorkView() {
  if (!savedWorkViewCamera) return false;
  camera.position.copy(savedWorkViewCamera.position);
  camera.up.copy(savedWorkViewCamera.up);
  orbit.target.copy(savedWorkViewCamera.target);
  camera.near = savedWorkViewCamera.near;
  camera.far = savedWorkViewCamera.far;
  orbit.enableRotate = savedWorkViewCamera.enableRotate;
  camera.lookAt(orbit.target);
  camera.updateProjectionMatrix();
  orbit.update();
  activeWorkView = null;
  savedWorkViewCamera = null;
  syncOrthographicWorkViewUi();
  configureSurfaceTransformAxis();
  updateSurfaceGizmoAttachment();
  log("Restored the free perspective work view.");
  return true;
}

function captureView(viewName = "iso", { download = false, prefix = currentProjectBaseName(), transparent = false, useCurrentZoom = null, bounds = null, qualityScale = 1, directionOverride = null, centerOverride = null, orthographic = false, includeBones = false, restoreRigOpacity = false } = {}) {
  const oldPosition = camera.position.clone();
  const oldUp = camera.up.clone();
  const oldTarget = orbit.target.clone();
  const oldDistance = oldPosition.distanceTo(oldTarget);
  const oldNear = camera.near;
  const oldFar = camera.far;
  const oldTransformVisible = transform.visible;
  const oldFaceMarkerVisible = faceMarker.visible;
  const oldSurfaceComponentMarkerVisible = surfaceComponentMarker.visible;
  const oldConnectVerticesGuideVisible = connectVerticesGuideGroup.visible;
  const oldModelingEdgesOverlayVisible = modelingEdgesOverlay.visible;
  const oldKnifeCutGuideVisible = knifeCutGuideGroup.visible;
  const oldSelectionOutlineVisible = selectionOutlineGroup.visible;
  const oldOpeningPickGuideVisible = openingPickGuideGroup.visible;
  const oldMeshIntegrityGuideVisible = meshIntegrityGuideGroup.visible;
  const oldMarkerGroupVisible = markerGroup.visible;
  const oldCameraDirectorGroupVisible = cameraDirectorGroup.visible;
  const oldGridVisible = grid.visible;
  const oldGridLabelsVisible = gridLabelGroup.visible;
  const oldBoneRigVisible = boneRigGroup.visible;
  const oldBoneGridAxisVisible = boneGridAxisGroup.visible;
  const oldBoneTransformVisible = boneTransform.visible;
  const oldBoneJoystickVisible = boneJoystickGroup.visible;
  const oldBoneRingGuideVisible = boneRingGuideGroup.visible;
  const oldBoneChildVisibility = boneRigGroup.children.map(child => [child, child.visible]);
  const oldSceneBackground = scene.background;
  const oldSceneFog = scene.fog;
  const oldClearAlpha = renderer.getClearAlpha();
  const oldPhotoEnvironmentVisible = photoEnvironment.visible;
  const oldFloorVisible = floor.visible;
  const oldStudioFloorVisible = studioFloor.visible;
  const oldPixelRatio = renderer.getPixelRatio();
  const oldProjectionMatrix = camera.projectionMatrix.clone();
  const exportMaterialStates = [];
  if (restoreRigOpacity && rigModelMaterialState instanceof Map) {
    for (const [material, original] of rigModelMaterialState) {
      exportMaterialStates.push([material, material.opacity, material.transparent, material.depthWrite]);
      material.opacity = original.opacity;
      material.transparent = original.transparent;
      material.depthWrite = original.depthWrite;
      material.needsUpdate = true;
    }
  }
  const exportBoneMaterialStates = [];
  if (includeBones) {
    boneRigGroup.traverse(child => {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) {
        if (!material) continue;
        exportBoneMaterialStates.push([material, material.depthTest, material.depthWrite]);
        material.depthTest = false;
        material.depthWrite = false;
        material.needsUpdate = true;
      }
    });
  }

  transform.visible = false;
  boneTransform.visible = false;
  boneJoystickGroup.visible = false;
  boneRingGuideGroup.visible = false;
  boneRigGroup.children.filter(child => child.userData?.boneGizmo).forEach(child => { child.visible = false; });
  faceMarker.visible = false;
  surfaceComponentMarker.visible = false;
  connectVerticesGuideGroup.visible = false;
  modelingEdgesOverlay.visible = false;
  knifeCutGuideGroup.visible = false;
  selectionOutlineGroup.visible = false;
  openingPickGuideGroup.visible = false;
  meshIntegrityGuideGroup.visible = false;
  markerGroup.visible = false;
  cameraDirectorGroup.visible = false;
  if (transparent) {
    scene.background = null;
    scene.fog = null;
    renderer.setClearAlpha(0);
    photoEnvironment.visible = false;
    floor.visible = false;
    studioFloor.visible = false;
    grid.visible = false;
    gridLabelGroup.visible = false;
    boneRigGroup.visible = includeBones && rigBones.length > 0;
    boneGridAxisGroup.visible = false;
  }
  if (els.hideGridInShotsInput?.checked) {
    grid.visible = false;
    gridLabelGroup.visible = false;
    boneRigGroup.visible = includeBones && rigBones.length > 0;
    boneGridAxisGroup.visible = false;
  }
  renderer.setPixelRatio(Math.min(4, oldPixelRatio * Math.max(1, Number(qualityScale) || 1)));
  resize();
  setCameraToView(viewName, {
    useCurrentZoom: useCurrentZoom ?? (els.useCurrentZoomInShotsInput?.checked ?? true),
    currentDistance: oldDistance,
    bounds,
    directionOverride,
    centerOverride
  });
  if (orthographic) {
    const fitBox = bounds?.isBox3 ? bounds : sceneBounds();
    const fitSize = fitBox.getSize(new THREE.Vector3());
    // Diagonal isometric views project width/depth into screen height. Fit the
    // full 3D diagonal, not only the largest single dimension, so no tile part
    // is clipped at the top or bottom of a sheet cell.
    const fitHeight = Math.max(fitSize.length() * 1.35, 2);
    const aspect = canvas.width / Math.max(1, canvas.height);
    camera.projectionMatrix.makeOrthographic(-fitHeight * aspect / 2, fitHeight * aspect / 2, fitHeight / 2, -fitHeight / 2, camera.near, camera.far);
  }
  if (transparent) {
    scene.background = null;
    scene.fog = null;
    renderer.setClearAlpha(0);
    photoEnvironment.visible = false;
    floor.visible = false;
    studioFloor.visible = false;
    grid.visible = false;
    gridLabelGroup.visible = false;
  }
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
  boneTransform.visible = oldBoneTransformVisible;
  boneJoystickGroup.visible = oldBoneJoystickVisible;
  boneRingGuideGroup.visible = oldBoneRingGuideVisible;
  oldBoneChildVisibility.forEach(([child, visible]) => { child.visible = visible; });
  faceMarker.visible = oldFaceMarkerVisible;
  surfaceComponentMarker.visible = oldSurfaceComponentMarkerVisible;
  connectVerticesGuideGroup.visible = oldConnectVerticesGuideVisible;
  modelingEdgesOverlay.visible = oldModelingEdgesOverlayVisible;
  knifeCutGuideGroup.visible = oldKnifeCutGuideVisible;
  selectionOutlineGroup.visible = oldSelectionOutlineVisible;
  openingPickGuideGroup.visible = oldOpeningPickGuideVisible;
  meshIntegrityGuideGroup.visible = oldMeshIntegrityGuideVisible;
  markerGroup.visible = oldMarkerGroupVisible;
  cameraDirectorGroup.visible = oldCameraDirectorGroupVisible;
  scene.background = oldSceneBackground;
  scene.fog = oldSceneFog;
  renderer.setClearAlpha(oldClearAlpha);
  photoEnvironment.visible = oldPhotoEnvironmentVisible;
  floor.visible = oldFloorVisible;
  studioFloor.visible = oldStudioFloorVisible;
  renderer.setPixelRatio(oldPixelRatio);
  exportMaterialStates.forEach(([material, opacity, transparent, depthWrite]) => {
    material.opacity = opacity;
    material.transparent = transparent;
    material.depthWrite = depthWrite;
    material.needsUpdate = true;
  });
  exportBoneMaterialStates.forEach(([material, depthTest, depthWrite]) => {
    material.depthTest = depthTest;
    material.depthWrite = depthWrite;
    material.needsUpdate = true;
  });
  resize();
  grid.visible = oldGridVisible;
  gridLabelGroup.visible = oldGridLabelsVisible;
  boneRigGroup.visible = oldBoneRigVisible;
  boneGridAxisGroup.visible = oldBoneGridAxisVisible;
  camera.position.copy(oldPosition);
  camera.up.copy(oldUp);
  camera.near = oldNear;
  camera.far = oldFar;
  camera.projectionMatrix.copy(oldProjectionMatrix);
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
  activeCustomCameraId = null;
  playerLookDrag = null;
  orbit.enabled = true;
  syncPlayerAvatarVisibility(null);
  renderCustomCameraMarkers();
  // View buttons are absolute presets. Repeated clicks must resolve to the
  // same centered camera instead of inheriting distance from the last view.
  setCameraToView(viewName, { useCurrentZoom: false });
  log(`Previewing ${viewName} shot framing.`);
}

function previewIsoOrReference() {
  const hasReference = typeof referenceImageState.dataUrl === "string" && referenceImageState.dataUrl.startsWith("data:image/");
  if (!hasReference) {
    previewShotView("iso");
    return;
  }
  referenceImageState.mode = "panel";
  syncReferenceImageUi();
  setSectionCollapsed(els.referenceImageSection, els.referenceImageToggle, false);
  els.referenceImageSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
  previewShotView("front");
  log("Showing the reference image in place of the Iso comparison view.");
}

async function captureReferenceImage({ download = false, prefix = currentProjectBaseName() } = {}) {
  const dataUrl = referenceImageState.dataUrl;
  const image = await loadShotImage(dataUrl);
  const shot = {
    view: "reference",
    fileName: `${prefix}-reference.png`,
    width: image.naturalWidth || image.width,
    height: image.naturalHeight || image.height,
    dataUrl
  };
  if (download) downloadDataUrl(shot.fileName, dataUrl);
  return shot;
}

async function captureViews({ views = ["front", "back", "left", "right", "top", "iso"], download = false, prefix = currentProjectBaseName() } = {}) {
  await waitForSceneTextures();
  const hasReference = typeof referenceImageState.dataUrl === "string" && referenceImageState.dataUrl.startsWith("data:image/");
  const shots = [];
  for (const view of views) {
    if (view === "iso" && hasReference) shots.push(await captureReferenceImage({ download, prefix }));
    else shots.push(captureView(view, { download, prefix }));
  }
  return shots;
}

async function saveSingleViewPng(viewName = "iso") {
  const prefix = currentProjectBaseName();
  await waitForSceneTextures();
  const shot = captureView(viewName, { download: true, prefix });
  log(`Saved ${viewName} PNG view.`, shot.fileName);
  return shot;
}

function meshTriangleCount(mesh) {
  const geometry = mesh?.geometry;
  if (!geometry) return 0;
  return Math.floor((geometry.index?.count || geometry.getAttribute("position")?.count || 0) / 3);
}

function sceneGameMetrics(meshes = objects) {
  return {
    meshes: meshes.length,
    triangles: meshes.reduce((sum, mesh) => sum + meshTriangleCount(mesh), 0),
    vertices: meshes.reduce((sum, mesh) => sum + (mesh.geometry?.getAttribute("position")?.count || 0), 0)
  };
}

function simplifiedGameMesh(mesh, keepRatio) {
  const clone = mesh.clone(false);
  let geometry = mesh.geometry.clone();
  const triangles = meshTriangleCount(mesh);
  if (triangles >= 160 && keepRatio < .999) {
    try {
      geometry = mergeVertices(geometry, 1e-4);
      const vertexCount = geometry.getAttribute("position")?.count || 0;
      const removeCount = Math.max(0, Math.floor(vertexCount * (1 - keepRatio)));
      if (removeCount > 0 && vertexCount - removeCount >= 12) {
        const simplified = new SimplifyModifier().modify(geometry, removeCount);
        geometry.dispose();
        geometry = simplified;
      }
    } catch (error) {
      geometry.dispose();
      geometry = mesh.geometry.clone();
      console.warn(`Game simplification skipped for ${mesh.name}:`, error);
    }
  }
  clone.geometry = geometry;
  clone.material = mesh.material;
  clone.userData = { ...mesh.userData };
  clone.position.copy(mesh.position);
  clone.rotation.copy(mesh.rotation);
  clone.scale.copy(mesh.scale);
  clone.updateMatrixWorld(true);
  return clone;
}

async function saveGameOptimizedCopy() {
  const sourceMeshes = objects.filter(mesh => !mesh.userData.hidden);
  if (!sourceMeshes.length) {
    log("There are no visible model meshes to optimize.");
    return null;
  }
  const keepRatio = Math.max(.2, Math.min(1, Number(els.gameOptimizeRatioInput.value || 65) / 100));
  const before = sceneGameMetrics(sourceMeshes);
  els.exportGameCopyBtn.disabled = true;
  els.gameOptimizeStats.textContent = "Building a separate optimized copy…";
  const workingMeshes = sourceMeshes.map(mesh => simplifiedGameMesh(mesh, keepRatio));
  try {
    const spec = await mergedMeshSpec(workingMeshes, {
      name: `${currentProjectBaseName()} Game Mesh`,
      groupId: "game-optimized",
      groupName: "Game Optimized"
    });
    if (!spec) throw new Error("No valid merged geometry was produced.");
    const afterTriangles = Math.floor((spec.geometry?.positions?.length || 0) / 9);
    const optimized = projectState();
    optimized.name = `${currentProjectBaseName()}-game-optimized`;
    optimized.savedAt = new Date().toISOString();
    optimized.optimization = {
      sourceMeshes: before.meshes,
      sourceTriangles: before.triangles,
      optimizedMeshes: 1,
      optimizedTriangles: afterTriangles,
      keepDetailPercent: round(keepRatio * 100),
      drawCallReductionPercent: round((1 - 1 / Math.max(1, before.meshes)) * 100)
    };
    spec.id = `game-optimized-${Date.now().toString(36)}`;
    spec.groupId = "game-optimized";
    spec.groupName = "Game Optimized";
    if (spec.textureUrl && spec.textureName) {
      optimized.textureLibrary = (optimized.textureLibrary || []).filter(entry => entry.name !== spec.textureName);
      optimized.textureLibrary.push({ name: spec.textureName, dataUrl: spec.textureUrl, robloxAssetId: "" });
      spec.textureUrl = null;
    }
    delete spec.generatedMaterialAtlas;
    delete spec.mergedMaterialCount;
    delete spec.mergedTextureCount;
    delete spec.materialAtlasSize;
    optimized.scene.objects = [spec];
    optimized.scene.groups = [{ id: "game-optimized", name: "Game Optimized", parentId: null }];
    optimized.editor.selectedId = spec.id;
    optimized.editor.selectedGroupId = "game-optimized";
    optimized.editor.checkedIds = [];
    optimized.editor.activeGroupIds = [];
    const fileName = `${optimized.name}.modelerproj`;
    download(fileName, JSON.stringify(optimized, null, 2), "application/json");
    const triangleReduction = before.triangles
      ? round((1 - afterTriangles / before.triangles) * 100)
      : 0;
    els.gameOptimizeStats.textContent = `${before.meshes} → 1 mesh | ${before.triangles.toLocaleString()} → ${afterTriangles.toLocaleString()} triangles (${triangleReduction}% reduction)`;
    log("Saved a separate game-optimized project; the editable scene was not changed.", {
      fileName,
      before,
      after: { meshes: 1, triangles: afterTriangles },
      triangleReductionPercent: triangleReduction
    });
    return optimized;
  } catch (error) {
    els.gameOptimizeStats.textContent = `Optimization failed: ${error.message}`;
    log("Game optimization failed.", error.message);
    return null;
  } finally {
    workingMeshes.forEach(mesh => mesh.geometry?.dispose?.());
    els.exportGameCopyBtn.disabled = false;
  }
}

function quantizePixelCanvas(context, width, height) {
  const image = context.getImageData(0, 0, width, height);
  for (let index = 0; index < image.data.length; index += 4) {
    if (image.data[index + 3] === 0) continue;
    image.data[index] = Math.round(image.data[index] / 16) * 16;
    image.data[index + 1] = Math.round(image.data[index + 1] / 16) * 16;
    image.data[index + 2] = Math.round(image.data[index + 2] / 16) * 16;
  }
  context.putImageData(image, 0, 0);
}

async function savePixelRenderPng() {
  await waitForSceneTextures();
  resize();
  const transparent = !!els.pixelTransparentInput.checked;
  const oldSceneBackground = scene.background;
  const oldClearAlpha = renderer.getClearAlpha();
  const oldVisibility = [transform, faceMarker, connectVerticesGuideGroup, selectionOutlineGroup, openingPickGuideGroup, markerGroup, cameraDirectorGroup, grid, gridLabelGroup, boneRigGroup]
    .map(object => [object, object.visible]);
  oldVisibility.forEach(([object]) => { object.visible = false; });
  if (transparent) {
    scene.background = null;
    renderer.setClearAlpha(0);
  }
  renderer.render(scene, camera);
  const width = Math.max(32, Math.min(1024, Math.round(Number(els.pixelRenderWidthInput.value) || 192)));
  const height = Math.max(1, Math.round(width * canvas.height / Math.max(1, canvas.width)));
  const pixelCanvas = document.createElement("canvas");
  pixelCanvas.width = width;
  pixelCanvas.height = height;
  const context = pixelCanvas.getContext("2d", { willReadFrequently: true });
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(canvas, 0, 0, width, height);
  quantizePixelCanvas(context, width, height);
  const dataUrl = pixelCanvas.toDataURL("image/png");
  const fileName = `${currentProjectBaseName()}-pixel-${width}x${height}.png`;
  downloadDataUrl(fileName, dataUrl);
  scene.background = oldSceneBackground;
  renderer.setClearAlpha(oldClearAlpha);
  oldVisibility.forEach(([object, visible]) => { object.visible = visible; });
  renderer.render(scene, camera);
  log(`Saved crisp pixel render from the current camera at ${width} × ${height}.`, fileName);
  return { fileName, width, height, dataUrl };
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
  log("Saved one six-panel AI QA sheet after all textures finished loading.", {
    fileName,
    views: shots.map(shot => shot.view),
    objects: objects.length
  });
  return { fileName, width: sheet.width, height: sheet.height, dataUrl, shots };
}

const animationSheetViews = ["front", "back", "left", "right", "front-left", "front-right", "back-left", "back-right"];

function animationExportEndFrame(range = "end") {
  return range === "current"
    ? Math.max(0, Math.min(animationState.end, Math.round(Number(animationState.frame) || 0)))
    : Math.max(1, Math.round(Number(animationState.end) || 1));
}

function animationMotionSheetFrames(frameCount = 8, endFrame = animationState.end) {
  const end = Math.max(0, Math.round(Number(endFrame) || 0));
  if (end === 0) return [0];
  const count = Math.max(2, Math.min(64, end + 1, Math.round(Number(frameCount) || 8)));
  return [...new Set(Array.from({ length: count }, (_, index) => Math.round((end * index) / (count - 1))))];
}

function animationImageAlphaBounds(image) {
  const source = document.createElement("canvas");
  source.width = image.width;
  source.height = image.height;
  const context = source.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, source.width, source.height).data;
  let minX = source.width, minY = source.height, maxX = -1, maxY = -1;
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      if (pixels[(y * source.width + x) * 4 + 3] < 4) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return maxX >= minX ? { minX, minY, maxX, maxY } : null;
}

async function composeAnimationMotionSheet(viewName, shots, clipLabel, prefix) {
  const images = await Promise.all(shots.map(shot => loadShotImage(shot.dataUrl)));
  const alphaBounds = images.map(animationImageAlphaBounds).filter(Boolean);
  const union = alphaBounds.length ? alphaBounds.reduce((bounds, current) => ({
    minX: Math.min(bounds.minX, current.minX),
    minY: Math.min(bounds.minY, current.minY),
    maxX: Math.max(bounds.maxX, current.maxX),
    maxY: Math.max(bounds.maxY, current.maxY)
  }), { minX: images[0].width, minY: images[0].height, maxX: 0, maxY: 0 }) : {
    minX: 0,
    minY: 0,
    maxX: images[0].width - 1,
    maxY: images[0].height - 1
  };
  const contentWidth = Math.max(1, union.maxX - union.minX + 1);
  const contentHeight = Math.max(1, union.maxY - union.minY + 1);
  const padding = Math.max(4, Math.round(Math.max(contentWidth, contentHeight) * .04));
  const cropX = Math.max(0, union.minX - padding);
  const cropY = Math.max(0, union.minY - padding);
  const cellWidth = Math.min(images[0].width - cropX, contentWidth + padding * 2);
  const cellHeight = Math.min(images[0].height - cropY, contentHeight + padding * 2);
  const sheet = document.createElement("canvas");
  const columns = Math.min(images.length, Math.max(1, Math.floor(30000 / Math.max(1, cellWidth))));
  const rows = Math.ceil(images.length / columns);
  sheet.width = cellWidth * columns;
  sheet.height = cellHeight * rows;
  const context = sheet.getContext("2d");
  context.clearRect(0, 0, sheet.width, sheet.height);

  images.forEach((image, index) => {
    context.drawImage(image, cropX, cropY, cellWidth, cellHeight, (index % columns) * cellWidth, Math.floor(index / columns) * cellHeight, cellWidth, cellHeight);
  });

  const clipSlug = clipLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "animation";
  const fileName = `${prefix}-${clipSlug}-${viewName}-sprite-sheet.png`;
  return { fileName, width: sheet.width, height: sheet.height, frameWidth: cellWidth, frameHeight: cellHeight, columns, rows, dataUrl: sheet.toDataURL("image/png"), view: viewName, shots };
}

async function saveAnimationMotionSheets({ view = "left", frameCount = 8, range = "end", download = true, qualityScale = 1, includeBones = false } = {}) {
  if (!animationHasKeys()) {
    animationState.playing = false;
    updateAnimationPanel();
    log("Add at least one keyed pose before exporting animation sheets.");
    return [];
  }

  const requestedViews = view === "all" ? animationSheetViews : [animationSheetViews.includes(view) ? view : "left"];
  const originalFrame = animationState.frame;
  const originalPlaying = animationState.playing;
  const exportEnd = animationExportEndFrame(range);
  const frames = animationMotionSheetFrames(frameCount, exportEnd);
  const prefix = currentProjectBaseName();
  const activeClip = animationState.clips?.[animationState.activeClipId];
  const clipLabel = String(activeClip?.name || animationState.activeClipId || "animation").trim();
  const sheets = [];
  animationState.playing = false;

  try {
    await waitForSceneTextures();
    const animationBounds = new THREE.Box3();
    for (const frame of frames) {
      animationSetFrame(frame, { render: false });
      for (const object of objects) animationBounds.expandByObject(object);
      if (includeBones) {
        rebuildBoneVisuals();
        boneRigGroup.visible = true;
        animationBounds.expandByObject(boneRigGroup);
      }
    }
    for (const viewName of requestedViews) {
      const shots = [];
      for (const frame of frames) {
        animationSetFrame(frame, { render: false });
        if (includeBones) {
          rebuildBoneVisuals();
          boneRigGroup.visible = true;
        }
        renderer.render(scene, camera);
        shots.push({ ...captureView(viewName, { download: false, prefix, transparent: true, useCurrentZoom: false, bounds: animationBounds, qualityScale, includeBones, restoreRigOpacity: true }), frame });
      }
      const sheet = await composeAnimationMotionSheet(viewName, shots, clipLabel, prefix);
      sheets.push(sheet);
      if (download) downloadDataUrl(sheet.fileName, sheet.dataUrl);
    }
    log(`Saved ${sheets.length} tightly cropped animation sprite sheet${sheets.length === 1 ? "" : "s"}.`, {
      clip: clipLabel,
      views: requestedViews,
      frames,
      sheets: sheets.map(sheet => ({
        fileName: sheet.fileName,
        frameSize: `${sheet.frameWidth}x${sheet.frameHeight}`,
        sheetSize: `${sheet.width}x${sheet.height}`
      }))
    });
    return sheets;
  } finally {
    animationState.playing = originalPlaying;
    animationSetFrame(originalFrame);
  }
}

async function renderConnectedAnimationWebm({ view = "left", durationSeconds = 6, qualityScale = 1.5, endOnLastClip = false } = {}) {
  const sequence = animationSequenceClipIndices();
  if (!sequence.length) return [];
  persistActiveMinecraftAnimationState();
  const originalClip = activeMinecraftAnimation;
  const originalFrame = animationState.frame;
  const originalPlaying = animationState.playing;
  const requestedViews = view === "all" ? animationSheetViews : [animationSheetViews.includes(view) ? view : "left"];
  const plan = [];
  const animationBounds = new THREE.Box3();
  animationState.playing = false;
  try {
    for (const clipIndex of sequence) {
      activateMinecraftAnimation(clipIndex, { quiet: true, preserveCurrent: false });
      for (let frame = 0; frame <= animationState.end; frame += 1) {
        animationSetFrame(frame, { render: false });
        for (const object of objects) animationBounds.expandByObject(object);
        plan.push({ clipIndex, frame });
      }
    }
    const fps = Math.max(1, Math.min(120, Math.round(Number(animationState.fps) || 24)));
    const videoDurationSeconds = Math.max(1, Math.min(60, Number(durationSeconds) || 6));
    const outputFrameCount = endOnLastClip ? plan.length : Math.max(1, Math.round(videoDurationSeconds * fps));
    const outputs = [];
    for (const viewName of requestedViews) {
      let currentClip = -1;
      let recordingCanvas = null, context = null, stream = null, videoTrack = null, recorder = null, stopped = null;
      const chunks = [];
      const frameDuration = 1000 / fps;
      for (let index = 0; index < outputFrameCount; index += 1) {
        const step = plan[index % plan.length];
        if (step.clipIndex !== currentClip) {
          activateMinecraftAnimation(step.clipIndex, { quiet: true, preserveCurrent: false });
          currentClip = step.clipIndex;
        }
        animationSetFrame(step.frame, { render: false });
        const shot = captureView(viewName, { download: false, prefix: currentProjectBaseName(), transparent: true, useCurrentZoom: false, bounds: animationBounds, qualityScale });
        const image = await loadShotImage(shot.dataUrl);
        if (!recordingCanvas) {
          recordingCanvas = document.createElement("canvas");
          recordingCanvas.width = shot.width;
          recordingCanvas.height = shot.height;
          context = recordingCanvas.getContext("2d");
          context.imageSmoothingEnabled = true;
          context.imageSmoothingQuality = "high";
          const mimeType = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find(type => MediaRecorder.isTypeSupported(type)) || "";
          stream = recordingCanvas.captureStream(0);
          videoTrack = stream.getVideoTracks()[0];
          const bitrate = Math.round(16_000_000 * Math.max(1, qualityScale * qualityScale));
          recorder = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: bitrate } : { videoBitsPerSecond: bitrate });
          recorder.addEventListener("dataavailable", event => { if (event.data?.size) chunks.push(event.data); });
          stopped = new Promise(resolve => recorder.addEventListener("stop", resolve, { once: true }));
          recorder.start(100);
        }
        context.clearRect(0, 0, recordingCanvas.width, recordingCanvas.height);
        context.drawImage(image, 0, 0, recordingCanvas.width, recordingCanvas.height);
        videoTrack?.requestFrame?.();
        await new Promise(resolve => setTimeout(resolve, frameDuration));
      }
      recorder.requestData();
      await new Promise(resolve => setTimeout(resolve, 50));
      recorder.stop();
      await Promise.race([stopped, new Promise((_, reject) => setTimeout(() => reject(new Error("The connected animation recorder did not finish within 8 seconds.")), 8000))]);
      stream.getTracks().forEach(track => track.stop());
      const blob = new Blob(chunks, { type: recorder.mimeType || "video/webm" });
      outputs.push({ fileName: `${currentProjectBaseName()}-connected-${viewName}.webm`, blob, view: viewName, sourceFrames: plan.length, frames: outputFrameCount, fps, durationSeconds: videoDurationSeconds });
    }
    return outputs;
  } finally {
    activateMinecraftAnimation(originalClip, { quiet: true, preserveCurrent: false });
    animationSetFrame(originalFrame);
    animationState.playing = originalPlaying;
  }
}

async function renderAnimationWebm({ view = "left", range = "end", durationSeconds = 6, qualityScale = 1.5, useSequence = false, endOnLastClip = false } = {}) {
  if (typeof MediaRecorder === "undefined" || typeof document.createElement("canvas").captureStream !== "function") {
    log("WebM export is not supported by this browser.");
    return [];
  }
  if (useSequence && useConnectedAnimationSequence()) return renderConnectedAnimationWebm({ view, durationSeconds, qualityScale, endOnLastClip });
  const exportEnd = animationExportEndFrame(range);
  const fullFrameCount = Math.min(64, exportEnd + 1);
  const sheets = await saveAnimationMotionSheets({ view, frameCount: fullFrameCount, range, download: false, qualityScale });
  const outputs = [];
  for (const sheet of sheets) {
    const image = await loadShotImage(sheet.dataUrl);
    const recordingCanvas = document.createElement("canvas");
    recordingCanvas.width = sheet.frameWidth;
    recordingCanvas.height = sheet.frameHeight;
    const context = recordingCanvas.getContext("2d");
    const fps = Math.max(1, Math.min(120, Math.round(Number(animationState.fps) || 24)));
    const videoDurationSeconds = Math.max(1, Math.min(60, Number(durationSeconds) || 6));
    const outputFrameCount = endOnLastClip ? sheet.shots.length : Math.max(1, Math.round(videoDurationSeconds * fps));
    const mimeType = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find(type => MediaRecorder.isTypeSupported(type)) || "";
    const stream = recordingCanvas.captureStream(0);
    const videoTrack = stream.getVideoTracks()[0];
    const bitrate = Math.round(16_000_000 * Math.max(1, qualityScale * qualityScale));
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: bitrate } : { videoBitsPerSecond: bitrate });
    const chunks = [];
    recorder.addEventListener("dataavailable", event => { if (event.data?.size) chunks.push(event.data); });
    const stopped = new Promise(resolve => recorder.addEventListener("stop", resolve, { once: true }));
    recorder.start(100);
    const frameDuration = 1000 / fps;
    for (let index = 0; index < outputFrameCount; index++) {
      const sourceFrame = index % sheet.shots.length;
      context.clearRect(0, 0, recordingCanvas.width, recordingCanvas.height);
      const sourceX = (sourceFrame % (sheet.columns || sheet.shots.length)) * sheet.frameWidth;
      const sourceY = Math.floor(sourceFrame / (sheet.columns || sheet.shots.length)) * sheet.frameHeight;
      context.drawImage(image, sourceX, sourceY, sheet.frameWidth, sheet.frameHeight, 0, 0, sheet.frameWidth, sheet.frameHeight);
      videoTrack?.requestFrame?.();
      await new Promise(resolve => setTimeout(resolve, frameDuration));
    }
    recorder.requestData();
    await new Promise(resolve => setTimeout(resolve, 50));
    recorder.stop();
    await Promise.race([
      stopped,
      new Promise((_, reject) => setTimeout(() => reject(new Error("The browser video recorder did not finish within 8 seconds.")), 8000))
    ]);
    stream.getTracks().forEach(track => track.stop());
    const blob = new Blob(chunks, { type: recorder.mimeType || "video/webm" });
    const fileName = sheet.fileName.replace(/-sprite-sheet\.png$/i, ".webm");
    outputs.push({ fileName, blob, view: sheet.view, sourceFrames: sheet.shots.length, frames: outputFrameCount, fps, durationSeconds: videoDurationSeconds });
  }
  return outputs;
}

async function exportAnimationWebm({ view = "left", range = "end", durationSeconds = 6, qualityScale = 1.5, useSequence = false, endOnLastClip = false } = {}) {
  const rendered = await renderAnimationWebm({ view, range, durationSeconds, qualityScale, useSequence, endOnLastClip });
  rendered.forEach(output => downloadBlob(output.fileName, output.blob));
  const outputs = rendered.map(({ blob, ...output }) => ({ ...output, size: blob.size }));
  log(`Saved ${outputs.length} isolated-model WebM animation${outputs.length === 1 ? "" : "s"}.`, outputs);
  return outputs;
}

async function exportAnimationMp4({ view = "left", range = "end", durationSeconds = 6, qualityScale = 1.5, useSequence = false, endOnLastClip = false } = {}) {
  let status;
  try {
    const response = await fetch("/api/video/mp4/status", { cache: "no-store" });
    if (!response.ok) throw new Error("The local video service is unavailable.");
    status = await response.json();
  } catch {
    log("MP4 export is available only while running the local BoltWorks server.");
    return [];
  }
  if (!status?.available) {
    log("MP4 export needs FFmpeg installed on this computer. WebM and sprite-sheet export remain available.");
    return [];
  }

  log("Rendering the active animation for local MP4 conversion...");
  const rendered = await renderAnimationWebm({ view, range, durationSeconds, qualityScale, useSequence, endOnLastClip });
  const outputs = [];
  for (const source of rendered) {
    const response = await fetch("/api/video/mp4", {
      method: "POST",
      headers: {
        "content-type": source.blob.type || "video/webm",
        "x-boltworks-filename": source.fileName
      },
      body: source.blob
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(detail.error || `MP4 conversion failed (${response.status}).`);
    }
    const blob = await response.blob();
    const fileName = source.fileName.replace(/\.webm$/i, ".mp4");
    downloadBlob(fileName, blob);
    outputs.push({ fileName, size: blob.size, view: source.view, frames: source.frames, fps: source.fps });
  }
  log(`Saved ${outputs.length} local-server MP4 animation${outputs.length === 1 ? "" : "s"}.`, outputs);
  return outputs;
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
  const oldBoneTransformVisible = boneTransform.visible;
  const oldFaceMarkerVisible = faceMarker.visible;
  const oldConnectVerticesGuideVisible = connectVerticesGuideGroup.visible;
  const oldSelectionOutlineVisible = selectionOutlineGroup.visible;
  const oldOpeningPickGuideVisible = openingPickGuideGroup.visible;
  const oldMarkerGroupVisible = markerGroup.visible;
  const oldCameraDirectorGroupVisible = cameraDirectorGroup.visible;
  const oldGridVisible = grid.visible;
  const oldGridLabelsVisible = gridLabelGroup.visible;
  const oldObjectVisibility = objects.map(object => ({ object, visible: object.visible }));

  const spriteObjects = visibleSpriteObjects();
  suppressViewportEnvironment = true;
  transform.visible = false;
  boneTransform.visible = false;
  faceMarker.visible = false;
  connectVerticesGuideGroup.visible = false;
  selectionOutlineGroup.visible = false;
  openingPickGuideGroup.visible = false;
  markerGroup.visible = false;
  cameraDirectorGroup.visible = false;
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
  boneTransform.visible = oldBoneTransformVisible;
  faceMarker.visible = oldFaceMarkerVisible;
  connectVerticesGuideGroup.visible = oldConnectVerticesGuideVisible;
  selectionOutlineGroup.visible = oldSelectionOutlineVisible;
  openingPickGuideGroup.visible = oldOpeningPickGuideVisible;
  markerGroup.visible = oldMarkerGroupVisible;
  cameraDirectorGroup.visible = oldCameraDirectorGroupVisible;
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
