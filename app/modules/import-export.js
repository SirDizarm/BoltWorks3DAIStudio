// v50.0.47: keep imported skins and materials lossless across project recovery.
function serializeImportedRoots() {
  const roots = new Set();
  for (const mesh of objects) {
    let root = mesh;
    while (root && root !== scene && !root.userData?.bwsImportAnchor) root = root.parent;
    if (root?.userData?.bwsImportAnchor) roots.add(root);
  }
  return [...roots].map(root => {
    const runtime = activeSkinRuntime?.importedRoot === root ? activeSkinRuntime : null;
    const nativeRest = runtime?.nativeRest
      ? [...runtime.nativeRest].map(([id, rest]) => [id, Object.fromEntries(
        Object.entries(rest).map(([key, value]) => [key, value.toArray()])
      )])
      : root.userData.bwsNativeRestSnapshot || [];
    // Object3D JSON retains skin indices/weights, inverse binds, mesh groups,
    // morph targets, every material slot and embedded texture images.
    // Three's toJSON retains userData by reference. Imported animation tracks
    // contain function properties, which IndexedDB cannot structured-clone.
    // Editable animation clips are saved separately in editor.rigging.
    const savedRoot = cloneProjectSaveData(root.toJSON());
    return { root: savedRoot, nativeRest };
  });
}

// Clone plain save data without allocating a second, scene-sized JSON string.
function cloneProjectSaveData(value, key = "") {
  if (key === "bwsImportedAnimations") return undefined;
  if (value === null || typeof value !== "object") return typeof value === "function" ? undefined : value;
  if (Array.isArray(value) || ArrayBuffer.isView(value)) return Array.from(value, item => cloneProjectSaveData(item));
  const result = {};
  for (const [name, item] of Object.entries(value)) {
    // The authoritative BufferGeometry is already in the imported hierarchy.
    if (key === "userData" && name === "geometry") continue;
    const cloned = cloneProjectSaveData(item, name);
    if (cloned !== undefined) result[name] = cloned;
  }
  return result;
}

function compactImportedProjectData(sceneData, library) {
  const names = new Map(library.filter(entry => entry?.dataUrl).map(entry => [entry.dataUrl, entry.name]));
  const usedNames = new Set(library.map(entry => entry.name));
  const intern = url => {
    if (names.has(url)) return names.get(url);
    let name = `Imported texture ${usedNames.size + 1}`;
    while (usedNames.has(name)) name += "_";
    usedNames.add(name);
    names.set(url, name);
    library.push({ name, dataUrl: url, robloxAssetId: "" });
    return name;
  };
  const compactTextures = spec => {
    for (const [urlKey, nameKey] of materialTextureReferenceFields()) {
      if (typeof spec[urlKey] !== "string" || !spec[urlKey].startsWith("data:")) continue;
      spec[nameKey] = intern(spec[urlKey]);
      spec[urlKey] = null;
    }
  };
  const importedIds = new Set();
  for (const entry of sceneData.importedRoots || []) {
    for (const image of entry.root.images || []) {
      if (typeof image.url !== "string" || !image.url.startsWith("data:")) continue;
      image.bwsTextureLibraryName = intern(image.url);
      delete image.url;
    }
    const visit = node => {
      if (node.userData) {
        compactTextures(node.userData);
        if (node.geometry && node.userData.id) importedIds.add(node.userData.id);
      }
      (node.children || []).forEach(visit);
    };
    visit(entry.root.object);
  }
  for (const spec of sceneData.objects || []) {
    compactTextures(spec);
    if (importedIds.has(spec.id)) spec.geometry = null;
  }
}

// Blob parts avoid JavaScript's single-string length limit without changing
// the editable JSON format or rounding/downsampling the model's contents.
function createProjectJsonBlob(value) {
  const parts = [];
  let chunk = "";
  const emit = text => {
    if (chunk.length + text.length > 65536) {
      if (chunk) parts.push(new Blob([chunk]));
      chunk = "";
      if (text.length > 65536) { parts.push(new Blob([text])); return; }
    }
    chunk += text;
  };
  const ancestors = new Set();
  const write = item => {
    if (item === null || typeof item !== "object") { emit(JSON.stringify(item) ?? "null"); return; }
    if (ancestors.has(item)) throw new Error("Project contains a circular reference.");
    ancestors.add(item);
    const array = Array.isArray(item);
    emit(array ? "[" : "{");
    let first = true;
    for (const key of Object.keys(item)) {
      const child = item[key];
      if (!array && (child === undefined || typeof child === "function" || typeof child === "symbol")) continue;
      if (!first) emit(",");
      first = false;
      if (!array) { emit(JSON.stringify(key)); emit(":"); }
      write(child);
    }
    emit(array ? "]" : "}");
    ancestors.delete(item);
  };
  write(value);
  if (chunk) parts.push(new Blob([chunk]));
  return new Blob(parts, { type: "application/json" });
}

function restoreImportedSkinRuntime() {
  const avatarId = rigBones.find(bone => bone.avatarObjectId)?.avatarObjectId;
  const avatar = objects.find(mesh => mesh.userData.id === avatarId && mesh.isSkinnedMesh);
  if (!avatar) return false;
  let root = avatar;
  while (root && root !== scene && !root.userData?.bwsImportAnchor) root = root.parent;
  const saved = root?.userData?.bwsNativeRestSnapshot;
  if (!saved?.length) return false;
  const threeBones = new Map();
  const importedSkins = [];
  root.traverse(node => {
    if (node.isBone && node.userData.rigBoneId) threeBones.set(node.userData.rigBoneId, node);
    if (node.isSkinnedMesh && objects.includes(node)) importedSkins.push(node);
  });
  const nativeRest = new Map(saved.map(([id, fields]) => [id, Object.fromEntries(
    Object.entries(fields).map(([key, values]) => [key,
      (key === "quaternion" ? new THREE.Quaternion()
        : key === "parentWorldInverse" ? new THREE.Matrix4() : new THREE.Vector3()).fromArray(values)
    ])
  )]));
  activeSkinRuntime = {
    avatar, bones: rigBones.filter(bone => threeBones.has(bone.id)),
    threeBones, skeleton: avatar.skeleton, importedRoot: root, nativeRest, importedSkins
  };
  return true;
}

function serializeObject(mesh) {
  const material = primaryMeshMaterial(mesh);
  const importedGltfMesh = mesh.userData.shape === "glb";
  let serializedPosition = mesh.position.toArray();
  let serializedRotation = [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z].map(value => THREE.MathUtils.radToDeg(value));
  let serializedScale = mesh.scale.toArray();
  if (importedGltfMesh) {
    mesh.updateWorldMatrix(true, false);
    const worldPosition = new THREE.Vector3();
    const worldQuaternion = new THREE.Quaternion();
    const worldScale = new THREE.Vector3();
    mesh.matrixWorld.decompose(worldPosition, worldQuaternion, worldScale);
    const worldRotation = new THREE.Euler().setFromQuaternion(worldQuaternion, "XYZ");
    serializedPosition = worldPosition.toArray();
    serializedRotation = [worldRotation.x, worldRotation.y, worldRotation.z].map(value => THREE.MathUtils.radToDeg(value));
    serializedScale = worldScale.toArray();
  }
  const previewBaseMaterial = typeof rigModelBaseMaterialState === "function"
    ? rigModelBaseMaterialState(mesh.material)
    : null;
  return {
    id: mesh.userData.id,
    name: mesh.name,
    shape: mesh.userData.shape,
    geometry: mesh.userData.geometry || (importedGltfMesh && mesh.geometry ? geometryToData(mesh.geometry) : null),
    bevel: mesh.userData.bevel,
    depth: mesh.userData.depth,
    direction: mesh.userData.direction,
    cuts: mesh.userData.cuts || null,
    pivot: mesh.userData.pivot || null,
    linkId: mesh.userData.linkId || null,
    position: serializedPosition.map(round),
    rotation: serializedRotation.map(round),
    scale: serializedScale.map(round),
    color: mesh.userData.color || `#${material?.color?.getHexString?.() || "ffffff"}`,
    roughness: round(material?.roughness ?? mesh.userData.roughness ?? .6),
    tintColor: normalizeHexColor(mesh.userData.tintColor, "#ffffff"),
    tintStrength: round(Math.max(0, Math.min(1, Number(mesh.userData.tintStrength) || 0))),
    // Animator rig opacity is a viewport aid, not an editable material value.
    // Saving while the rig is faded must preserve the mesh's true opacity.
    opacity: round(previewBaseMaterial?.opacity ?? mesh.userData.opacity ?? material?.opacity ?? 1),
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
    doubleSided: !!mesh.userData.doubleSided,
    roughnessTextureUrl: mesh.userData.roughnessTextureUrl || null,
    roughnessTextureName: mesh.userData.roughnessTextureName || null,
    metalnessTextureUrl: mesh.userData.metalnessTextureUrl || null,
    metalnessTextureName: mesh.userData.metalnessTextureName || null,
    normalTextureUrl: mesh.userData.normalTextureUrl || null,
    normalTextureName: mesh.userData.normalTextureName || null,
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
    generatedShell: !!mesh.userData.generatedShell,
    shellResolution: mesh.userData.generatedShell ? Number(mesh.userData.shellResolution) || 42 : null,
    edgeBevelProtectedEdges: Array.isArray(mesh.userData.edgeBevelProtectedEdges) ? [...mesh.userData.edgeBevelProtectedEdges] : [],
    dissolvedSurfaceEdges: Array.isArray(mesh.userData.dissolvedSurfaceEdges) ? [...mesh.userData.dissolvedSurfaceEdges] : [],
    manualTopologyEdges: Array.isArray(mesh.userData.manualTopologyEdges)
      ? mesh.userData.manualTopologyEdges.map(edge => ({ a: [...edge.a], b: [...edge.b] }))
      : []
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
    importedRoots: serializeImportedRoots(), objects: objects.map(serializeObject)
  };
}

function projectCapabilities() {
  return {
    shapes: Object.keys(shapeFactories),
    transforms: ["translate", "rotate", "scale", "flipX", "flipY", "flipZ", "sharedPivot"],
    faceTools: ["triangleSelect", "coplanarFaceSelect", "vertexSelect", "edgeSelect", "paintSelect", "areaSelect", "marker", "lineSketch", "makeFaceFromSketch", "fillLineFromSketch", "cutHoleFromSketch", "keyholeCutter", "deleteTriangles", "extractTriangles", "fillHole", "findRepairHoles", "copyTriangles", "pasteTriangles", "extend", "pull", "pullToTarget", "push", "dragPush", "bevelFace", "weldVertices", "dissolveEdge", "dissolveVertex", "liveMirror", "scaleSelectedSurface", "relaxVertices", "smoothVertices", "knifeCut", "planeCut", "bridgeEdgeLoops", "cutTopBottom", "protectedDecimate", "lodGenerator"],
    textureTools: ["addTexture", "changeTexture", "clearTexture", "flipTexture", "rotateTexture", "saveTextureImage", "textureLibrary", "baseColorPaint", "roughnessPaint", "metalnessPaint", "normalPaint", "emissivePaint", "materialPreviewSphere"],
    exports: ["project", "json", "obj", "robloxPack", "dae"],
    sceneGrouping: ["checkedSelection", "nameGroups", "groupOnly", "selectAll", "deselectAll", "nestedGroups", "groupDetails", "mergeMeshes", "combineShell"],
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
  compactImportedProjectData(scene, textureLibraryEntries);
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
    pluginData: typeof serializeOptionalPluginProjectData === "function" ? serializeOptionalPluginProjectData() : {},
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
          exportWidth: Math.max(64, Math.min(2048, Math.round(Number(view.exportWidth) || 512))),
          exportHeight: Math.max(64, Math.min(2048, Math.round(Number(view.exportHeight) || 512))),
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
        flipFromCenter: !!els.flipFromCenterInput?.checked,
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
        shadowFill: Number(els.shadowFillInput?.value) || 0,
        fourSideFill: els.fourSideLightsInput?.checked ?? true,
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
    ["normalTextureUrl", "normalTextureName"],
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
    scene: cloneProjectSaveData(scene),
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
  if (typeof restoreOptionalPluginProjectData === "function") restoreOptionalPluginProjectData(previous.pluginData || {});
  isRestoring = false;
  updateUndoButton();
  log("Undo.");
}

function loadState(data, { record = true } = {}) {
  // Parse before clearing the current project, so malformed bundles do not erase it.
  const restoredImports = (data.importedRoots || []).map(entry => {
    const rootData = { ...entry.root, images: (entry.root.images || []).map(image => {
      if (!image.bwsTextureLibraryName) return image;
      const url = textureLibrary.get(image.bwsTextureLibraryName)?.dataUrl;
      if (!url) throw new Error(`Missing saved texture: ${image.bwsTextureLibraryName}`);
      return { ...image, url };
    }) };
    const root = new THREE.ObjectLoader().parse(rootData);
    root.userData.bwsImportAnchor = true;
    root.userData.bwsNativeRestSnapshot = entry.nativeRest || [];
    return root;
  });
  const restoredMeshIds = new Set();
  if (record) recordHistory("import");
  // Undo snapshots and compact project scenes store one texture payload in the
  // library and lightweight textureName references on their mesh objects.
  hydrateProjectTextureReferences(data, [...textureLibrary.values()]);
  clearObjects({ record: false });
  activeSkinRuntime = null;
  for (const root of restoredImports) {
    scene.add(root);
    root.updateMatrixWorld(true);
    root.traverse(node => {
      if (!node.isMesh) return;
      // Keep the editing metadata usable while excluding it from future saves.
      node.userData = { ...node.userData };
      hydrateProjectTextureReferences({ objects: [node.userData] }, [...textureLibrary.values()]);
      node.userData.geometry = geometryToData(node.geometry);
      objects.push(node);
      restoredMeshIds.add(node.userData.id);
      const numericId = Number(String(node.userData.id || "").replace(/^obj-/, ""));
      if (Number.isFinite(numericId)) idCounter = Math.max(idCounter, numericId + 1);
    });
  }
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
  let skippedBrokenGltf = 0;
  for (const spec of data.objects || []) {
    if (restoredMeshIds.has(spec.id)) continue;
    if (spec.shape === "glb" && !spec.geometry?.positions?.length) {
      skippedBrokenGltf += 1;
      continue;
    }
    addObject(spec, { record: false, update: false });
  }
  // Older saved projects can contain duplicated mesh IDs. Checkbox state and
  // selection then leak between unrelated rows because both rows share a key.
  ensureUniqueObjectIds();
  ensureLinkGroupColors();
  ensureSceneGroups();
  ensureModelGroups();
  selectObject(objects.at(-1) || null);
  updateAll();
  if (skippedBrokenGltf) log(`Skipped ${skippedBrokenGltf} incomplete legacy glTF recovery object${skippedBrokenGltf === 1 ? "" : "s"}. Re-import the original glTF once; future recovery saves will preserve it correctly.`);
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
  if (els.flipFromCenterInput) els.flipFromCenterInput.checked = !!tools.flipFromCenter;
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
  if (els.shadowFillInput) els.shadowFillInput.value = String(lighting.shadowFill ?? 2.4);
  if (els.fourSideLightsInput) els.fourSideLightsInput.checked = lighting.fourSideFill ?? true;
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
  syncShadowFill();
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
      if (typeof restoreOptionalPluginProjectData === "function") restoreOptionalPluginProjectData(data.pluginData || {});
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
      if (typeof restoreOptionalPluginProjectData === "function") restoreOptionalPluginProjectData({});
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
    row.innerHTML = `<input class="part-check" type="checkbox" aria-label="Select ${mesh.name}"><label class="row-toggle link-toggle" title="Link ${mesh.name} with the current multi-selection"><input class="link-check" type="checkbox" aria-label="Link ${mesh.name}"><span>Link</span></label><label class="hide-toggle" title="Hide or show ${mesh.name}"><input class="hide-check" type="checkbox" aria-label="Hide ${mesh.name}"><span>Hide</span></label><label class="row-toggle armor-toggle" title="Include ${mesh.name} in the rigid armor system"><input class="armor-check" type="checkbox" aria-label="Mark ${mesh.name} as armor"><span>Armor</span></label><span class="swatch" style="background:${swatchColor}"></span><span class="mesh-name"></span><small title="${materialLabel}">${rowType}</small>`;
    const partCheck = row.querySelector(".part-check");
    const linkToggle = row.querySelector(".link-toggle");
    const linkCheck = row.querySelector(".link-check");
    const hideToggle = row.querySelector(".hide-toggle");
    const hideCheck = row.querySelector(".hide-check");
    const armorToggle = row.querySelector(".armor-toggle");
    const armorCheck = row.querySelector(".armor-check");
    const meshName = row.querySelector(".mesh-name");
    partCheck.checked = checkedIds.has(mesh.userData.id);
    linkCheck.checked = !!mesh.userData.linkId;
    linkToggle.classList.toggle("linked", !!mesh.userData.linkId);
    linkToggle.style.setProperty("--link-color", linkColor);
    linkCheck.style.accentColor = linkColor;
    hideCheck.checked = !!mesh.userData.hidden;
    armorCheck.checked = mesh.userData.rigRole === "armor";
    armorToggle.classList.toggle("armor-enabled", armorCheck.checked);
    meshName.textContent = mesh.name;
    meshName.title = `Open mesh details for ${mesh.name} — double-click`;
    partCheck.addEventListener("click", event => event.stopPropagation());
    // Scene-list checkboxes are an explicit multi-part basket. Checking a
    // second row must keep earlier rows checked so Group and Merge receive the
    // complete set without requiring a keyboard modifier.
    partCheck.addEventListener("change", event => setChecked(mesh, event.target.checked, { append: true }));
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
    meshName.addEventListener("dblclick", event => {
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
    els.loadTextureLibraryUrlBtn,
    els.shadowFillInput,
    els.fourSideLightsInput
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
    els.tintStrengthInput.value = 0;
    els.tintStrengthValue.value = "0%";
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
    els.tintStrengthInput.value = 0;
    els.tintStrengthValue.value = "0%";
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
  const material = primaryMeshMaterial(selected);
  const inspectorColor = normalizeHexColor(selected.userData.tintColor || selected.userData.color || `#${material?.color?.getHexString?.() || "ffffff"}`, "#ffffff");
  els.colorInput.value = inspectorColor;
  els.colorHexInput.value = inspectorColor.toUpperCase();
  if (els.modelToolsMeshColorInput) els.modelToolsMeshColorInput.value = els.colorInput.value;
  if (els.modelToolsMeshColorHexInput) els.modelToolsMeshColorHexInput.value = els.colorHexInput.value;
  if (els.modelToolsApplyMeshColorBtn) els.modelToolsApplyMeshColorBtn.disabled = false;
  if (els.modelToolsPaintFacesBtn) els.modelToolsPaintFacesBtn.disabled = selectedFaces.length < 1;
  if (els.addColorToSceneBtn) { els.addColorToSceneBtn.disabled = false; els.addColorToSceneBtn.textContent = selected.userData.colorApplied ? "Mesh Color Applied" : "Apply Mesh Color"; }
  els.roughInput.value = material?.roughness ?? .6;
  els.roughValue.value = Number(material?.roughness ?? .6).toFixed(2);
  const baseMaterialState = typeof rigModelBaseMaterialState === "function" ? rigModelBaseMaterialState(selected.material) : null;
  const inspectorOpacity = typeof animatorWorkspaceActive !== "undefined" && animatorWorkspaceActive
    ? rigModelOpacity
    : (baseMaterialState?.opacity ?? material?.opacity ?? 1);
  els.opacityInput.value = inspectorOpacity;
  els.opacityValue.value = Number(inspectorOpacity).toFixed(2);
  els.tintStrengthInput.value = Math.max(0, Math.min(1, Number(selected.userData.tintStrength) || 0));
  els.tintStrengthValue.value = `${Math.round(Number(els.tintStrengthInput.value) * 100)}%`;
  if (selected.userData.cuts?.bottom !== undefined) {
    els.cutSideSelect.value = "bottom";
    els.cutAmountInput.value = selected.userData.cuts.bottom;
  } else if (selected.userData.cuts?.top !== undefined) {
    els.cutSideSelect.value = "top";
    els.cutAmountInput.value = selected.userData.cuts.top;
  }
  const textureLabel = selected.userData.textureName || (material?.map ? "Texture" : "No texture");
  els.textureName.textContent = material?.map ? `${textureLabel} (${selected.userData.textureFlipY ?? true ? "flip V" : "normal V"}, rot ${normalizeTextureRotation(selected.userData.textureRotation || 0)} deg)` : textureLabel;
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
  const materials = Array.isArray(selected.material) ? selected.material : [selected.material];
  if (selected.userData.colorApplied) materials.forEach(material => material?.color?.set(normalizedColor));
  const reapplyRigOpacity = typeof restoreRigModelMaterials === "function" && restoreRigModelMaterials();
  materials.forEach(material => { if (material) material.roughness = +els.roughInput.value; });
  const opacity = Math.max(.05, Math.min(1, Number(els.opacityInput.value) || 1));
  const editsRigPreviewOpacity = typeof animatorWorkspaceActive !== "undefined" && animatorWorkspaceActive && rigBones.length > 0;
  if (!editsRigPreviewOpacity) {
    materials.forEach(material => {
      if (!material) return;
      material.transparent = opacity < .999 || !!selected.userData.textureHasTransparency;
      material.opacity = opacity;
      material.depthWrite = opacity >= .9;
    });
    selected.userData.opacity = opacity;
  }
  materials.forEach(material => {
    if (!material) return;
    material.wireframe = false;
    material.needsUpdate = true;
  });
  selected.userData.color = normalizedColor;
  selected.userData.roughness = +els.roughInput.value;
  applyMeshTint(selected, normalizedColor, els.tintStrengthInput.value);
  syncMeshRenderCulling(selected);
  els.roughValue.value = Number(+els.roughInput.value).toFixed(2);
  els.opacityValue.value = opacity.toFixed(2);
  els.tintStrengthValue.value = `${Math.round((Number(els.tintStrengthInput.value) || 0) * 100)}%`;
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

function recoverUnregisteredImportedMeshes() {
  const known = new Set(objects);
  const usedIds = new Set(objects.map(object => object.userData?.id).filter(Boolean));
  const recovered = [];
  scene.traverse(node => {
    if (!node?.isMesh || known.has(node) || node.userData?.editorHelper) return;
    let ancestor = node.parent;
    let imported = node.userData?.shape === "glb";
    while (ancestor && ancestor !== scene) {
      if (ancestor.userData?.bwsImportAnchor) imported = true;
      ancestor = ancestor.parent;
    }
    if (!imported) return;
    node.userData ||= {};
    if (!node.userData.id || usedIds.has(node.userData.id)) node.userData.id = `obj-${idCounter++}`;
    usedIds.add(node.userData.id);
    node.userData.shape ||= "glb";
    objects.push(node);
    known.add(node);
    recovered.push(node);
  });
  return recovered;
}

function updateAll() {
  recoverUnregisteredImportedMeshes();
  syncShadowFill();
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

function gameCharacterTemporaryRigidRuntime() {
  const bones = rigBones.filter(bone => bone.role !== "camera");
  if (!bones.length) return null;
  const boneIds = new Set(bones.map(bone => bone.id));
  const threeBones = new Map(bones.map(bone => {
    const node = new THREE.Bone();
    node.name = bone.name;
    node.userData.rigBoneId = bone.id;
    return [bone.id, node];
  }));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, .0001, 0, 0, 0, .0001, 0], 3));
  geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 4));
  geometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
  const avatar = new THREE.SkinnedMesh(geometry, new THREE.MeshBasicMaterial({ visible: false }));
  avatar.name = "BWS_Rigid_Character_Root";
  avatar.userData.id = "bws-rigid-character-root";
  for (const bone of bones) {
    const node = threeBones.get(bone.id);
    const parent = boneIds.has(bone.parentId) ? boneById(bone.parentId) : null;
    if (parent) {
      node.position.copy(bone.bindPosition || bone.position).sub(parent.bindPosition || parent.position);
      threeBones.get(parent.id).add(node);
    } else {
      node.position.copy(bone.bindPosition || bone.position);
      avatar.add(node);
    }
  }
  avatar.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones.map(bone => threeBones.get(bone.id)));
  avatar.bind(skeleton);
  return { avatar, bones, threeBones, skeleton, temporary: true };
}

function gameCharacterCaptureEditorState() {
  return {
    skinRuntime: activeSkinRuntime,
    bindingRest: animationState.bindingRest,
    animation: {
      activeClipId: animationState.activeClipId,
      fps: animationState.fps,
      end: animationState.end,
      frame: animationState.frame,
      keys: animationState.keys,
      playing: animationState.playing,
      lastTime: animationState.lastTime
    },
    keySelection: [...animationKeySelection],
    keySelectionAnchor: animationKeySelectionAnchor ? { ...animationKeySelectionAnchor } : null,
    poseChannels: new Map([...rigPoseChannels].map(([id, pose]) => [id, {
      position: pose.position.clone(),
      rotation: pose.rotation.clone()
    }])),
    bones: new Map(rigBones.map(bone => [bone.id, {
      position: bone.position.clone(),
      rotation: bone.rotation.clone(),
      tail: bone.tail?.clone?.() || null,
      displayPosition: bone.displayPosition?.clone?.() || null,
      displayTail: bone.displayTail?.clone?.() || null,
      poseWorldQuaternion: bone.poseWorldQuaternion?.clone?.() || null
    }])),
    skinBones: new Map([...(activeSkinRuntime?.threeBones || [])].map(([id, bone]) => [id, {
      position: bone.position.clone(),
      quaternion: bone.quaternion.clone(),
      scale: bone.scale.clone()
    }])),
    objects: objects.map(object => ({
      object,
      position: object.position.clone(),
      quaternion: object.quaternion.clone(),
      scale: object.scale.clone()
    }))
  };
}

function gameCharacterRestoreEditorState(state, { render = true } = {}) {
  if (!state) return;
  activeSkinRuntime = state.skinRuntime;
  animationState.bindingRest = state.bindingRest;
  Object.assign(animationState, state.animation);
  rigPoseChannels.clear();
  for (const [id, pose] of state.poseChannels) rigPoseChannels.set(id, {
    position: pose.position.clone(),
    rotation: pose.rotation.clone()
  });
  for (const bone of rigBones) {
    const saved = state.bones.get(bone.id);
    if (!saved) continue;
    bone.position.copy(saved.position);
    bone.rotation.copy(saved.rotation);
    if (saved.tail && bone.tail) bone.tail.copy(saved.tail);
    bone.displayPosition = saved.displayPosition?.clone?.() || null;
    bone.displayTail = saved.displayTail?.clone?.() || null;
    bone.poseWorldQuaternion = saved.poseWorldQuaternion?.clone?.() || null;
  }
  for (const { object, position, quaternion, scale } of state.objects) {
    object.position.copy(position);
    object.quaternion.copy(quaternion);
    object.scale.copy(scale);
    object.updateMatrixWorld(true);
  }
  if (activeSkinRuntime?.threeBones) {
    for (const [id, saved] of state.skinBones) {
      const bone = activeSkinRuntime.threeBones.get(id);
      if (!bone) continue;
      bone.position.copy(saved.position);
      bone.quaternion.copy(saved.quaternion);
      bone.scale.copy(saved.scale);
    }
    activeSkinRuntime.avatar.updateMatrixWorld(true);
    activeSkinRuntime.skeleton?.update?.();
  }
  animationKeySelection.clear();
  for (const id of state.keySelection) animationKeySelection.add(id);
  animationKeySelectionAnchor = state.keySelectionAnchor ? { ...state.keySelectionAnchor } : null;
  if (render) {
    rebuildBoneVisuals();
    syncBonePanel();
    updateAnimationPanel();
  }
}

// Legacy commands now open the optional installed workspace.
function exportGameCharacterPackage(){return bwsOpenPluginWorkspace('boltworks-game-engine');}
function exportGameCharacterArmsGlb(){return bwsOpenPluginWorkspace('boltworks-game-engine');}

async function exportFullModelGltf({ binary = true } = {}) {
  const exportRoot = new THREE.Group();
  exportRoot.name = gameCharacterSafeName(currentProjectBaseName(), "boltworks-model");
  const roots = [...new Set(objects.filter(object => !object.userData?.editorHelper).map(object => {
    let root = object;
    while (root.parent && root.parent !== scene) root = root.parent;
    return root;
  }))];
  if (!roots.length) {
    log(`Full Model ${binary ? "GLB" : "glTF"} needs at least one model in the workspace.`);
    return;
  }
  try {
    const animations = [];
    for (const object of roots) {
      object.updateWorldMatrix(true, true);
      let hasSkin = false;
      object.traverse(node => { if (node.isSkinnedMesh) hasSkin = true; });
      // Object3D.clone JSON-stringifies userData before GLTFExporter runs.
      // Editor geometry/texture caches and imported clips are not glTF extras:
      // their authoritative data is exported through the normal glTF channels.
      const originalUserData = new Map();
      let clone;
      try {
        object.traverse(node => {
          originalUserData.set(node, node.userData);
          node.userData = node.userData?.gltfExtensions
            ? { gltfExtensions: node.userData.gltfExtensions } : {};
        });
        clone = hasSkin ? cloneSkeleton(object) : object.clone(true);
      } finally {
        for (const [node, userData] of originalUserData) node.userData = userData;
      }
      object.matrixWorld.decompose(clone.position, clone.quaternion, clone.scale);
      clone.visible = object.visible;
      exportRoot.add(clone);
      if (Array.isArray(object.userData?.bwsImportedAnimations)) animations.push(...object.userData.bwsImportedAnimations);
    }
    const exported = await new GLTFExporter().parseAsync(exportRoot, {
      binary,
      animations,
      onlyVisible: false,
      trs: true,
      includeCustomExtensions: true
    });
    const extension = binary ? "glb" : "gltf";
    const fileName = `${gameCharacterSafeName(currentProjectBaseName(), "boltworks-model")}.${extension}`;
    const payload = binary ? exported : createProjectJsonBlob(exported);
    downloadBlob(fileName, new Blob([payload], { type: binary ? "model/gltf-binary" : "model/gltf+json" }));
    log(`Exported ${fileName} as a standard full-model ${binary ? "GLB" : "self-contained glTF"}. No game-engine layer masks or character manifest were added.`);
  } catch (error) {
    console.error(error);
    log(`Full Model ${binary ? "GLB" : "glTF"} export failed: ${error?.message || error}`);
  }
}

async function exportFullModelGlb() {
  return exportFullModelGltf({ binary: true });
}

function gameCharacterImportedClipKeys(clip, importedBones, boneNodes) {
  const fps = clip.userData?.usdMotion ? Math.max(1,Math.min(120,Number(clip.userData.fps)||24)) : 24;
  const end = Math.max(1, Math.round(Math.max(clip.duration || 0, 1 / fps) * fps));
  const trackMap = new Map();
  for (const track of clip.tracks || []) {
    const split = track.name.lastIndexOf(".");
    if (split < 0) continue;
    const nodeName = track.name.slice(0, split).replace(/^.*\//, "");
    const channel = track.name.slice(split + 1);
    trackMap.set(`${nodeName}:${channel}`, track.createInterpolant());
  }
  const keys = {};
  for (const bone of importedBones) {
    const node = boneNodes.get(bone.id);
    const positionTrack = trackMap.get(`${node.uuid}:position`) || trackMap.get(`${node.name}:position`);
    const quaternionTrack = trackMap.get(`${node.uuid}:quaternion`) || trackMap.get(`${node.name}:quaternion`);
    const scaleTrack = trackMap.get(`${node.uuid}:scale`) || trackMap.get(`${node.name}:scale`);
    if (!positionTrack && !quaternionTrack && !scaleTrack) continue;
    keys[bone.id] = [];
    for (let frame = 0; frame <= end; frame += 1) {
      const time = Math.min(clip.duration || 0, frame / fps);
      const localPosition = positionTrack ? positionTrack.evaluate(time) : node.position.toArray();
      const localQuaternion = quaternionTrack ? quaternionTrack.evaluate(time) : node.quaternion.toArray();
      const positionDelta = new THREE.Vector3().fromArray(localPosition).sub(node.position);
      if(activeSkinRuntime?.nativeRest && node.parent){
        positionDelta.applyMatrix4(node.parent.matrixWorld).sub(new THREE.Vector3().setFromMatrixPosition(node.parent.matrixWorld));
      }
      const rotation = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().fromArray(localQuaternion), "XYZ");
      keys[bone.id].push({
        frame,
        position: bone.bindPosition.clone().add(positionDelta).toArray(),
        rotation: rotation.toArray().slice(0, 3),
        ...(activeSkinRuntime?.nativeRest ? { scale: Array.from(scaleTrack ? scaleTrack.evaluate(time) : node.scale.toArray()) } : {})
      });
    }
  }
  return { fps, end, keys };
}

function centerImportedModelRoot(root) {
  root.updateWorldMatrix(true, true);
  const before = new THREE.Box3().setFromObject(root, true);
  if (before.isEmpty()) throw new Error("The imported model does not contain visible geometry.");
  const center = before.getCenter(new THREE.Vector3());
  root.position.add(new THREE.Vector3(-center.x, -before.min.y, -center.z));
  root.updateWorldMatrix(true, true);
  return new THREE.Box3().setFromObject(root, true);
}

function importedTextureDataUrl(texture) {
  const image = texture?.image;
  if (!image) return null;
  const directSource = String(image.currentSrc || image.src || "");
  if (directSource.startsWith("data:")) return directSource;
  const width = Number(image.naturalWidth || image.videoWidth || image.width) || 0;
  const height = Number(image.naturalHeight || image.videoHeight || image.height) || 0;
  if (!width || !height) return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d", { alpha: true }).drawImage(image, 0, 0, width, height);
    return canvas.toDataURL("image/png");
  } catch (error) {
    console.warn("Could not embed imported glTF texture for recovery", error);
    return null;
  }
}

function preserveImportedGltfMesh(mesh, fileName, index) {
  const material = primaryMeshMaterial(mesh);
  mesh.userData.geometry = geometryToData(mesh.geometry);
  mesh.userData.color = `#${material?.color?.getHexString?.() || "ffffff"}`;
  mesh.userData.roughness = Number(material?.roughness ?? .6);
  mesh.userData.opacity = Number(material?.opacity ?? 1);
  mesh.userData.doubleSided = material?.side === THREE.DoubleSide;
  const textureUrl = importedTextureDataUrl(material?.map);
  if (textureUrl) {
    const textureName = `${fileName.replace(/\.(?:glb|gltf|fbx)$/i, "") || "Imported glTF"} texture ${index + 1}.png`;
    mesh.userData.textureName = registerTextureAsset(textureName, textureUrl) || textureName;
    mesh.userData.textureUrl = textureUrl;
    mesh.userData.textureFlipY = material.map.flipY;
    mesh.userData.textureRotation = THREE.MathUtils.radToDeg(material.map.rotation || 0);
  }
}

async function importFullModelGltf(file, decodedModel = null, formatName = "glTF/GLB") {
  if (!file) return;
  try {
    const isJsonGltf = /\.gltf$/i.test(file.name) || file.type === "model/gltf+json";
    const source = decodedModel ? null : isJsonGltf ? await file.text() : await file.arrayBuffer();
    const gltf = decodedModel || await new GLTFLoader().parseAsync(source, "");
    const loadedRoot = gltf.scene || gltf.scenes?.[0];
    if (!loadedRoot) throw new Error("The glTF file does not contain a scene.");
    recordHistory("import " + formatName + " model");
    const root = new THREE.Group();
    root.name = file.name.replace(/\.(?:glb|gltf|fbx)$/i, "") || "Imported glTF Model";
    root.userData.bwsImportedAnimations = gltf.animations || [];
    root.userData.bwsImportAnchor = true;
    root.add(loadedRoot);
    scene.add(root);
    const importedBounds = centerImportedModelRoot(root);
    const importedMeshes = [];
    root.traverse(node => {
      if (!node.isMesh) return;
      node.userData ||= {};
      node.userData.id = `obj-${idCounter++}`;
      node.userData.shape ||= "glb";
      node.userData.color ||= `#${(Array.isArray(node.material) ? node.material[0] : node.material)?.color?.getHexString?.() || "ffffff"}`;
      node.userData.tintColor ||= "#ffffff";
      node.userData.tintStrength = Math.max(0, Math.min(1, Number(node.userData.tintStrength) || 0));
      preserveImportedGltfMesh(node, file.name, importedMeshes.length);
      applyMeshTint(node, node.userData.tintColor, node.userData.tintStrength);
      node.castShadow = true;
      node.receiveShadow = true;
      objects.push(node);
      importedMeshes.push(node);
    });
    const boneNodes = [];
    root.traverse(node => { if (node.isBone && !boneNodes.includes(node)) boneNodes.push(node); });
    if (boneNodes.length) {
      const usedIds = new Set();
      const idByNode = new Map(boneNodes.map((node, index) => {
        const base = gameCharacterSafeName(node.name || `bone-${index + 1}`).toLowerCase();
        let id = base;
        let suffix = 2;
        while (usedIds.has(id)) id = `${base}-${suffix++}`;
        usedIds.add(id);
        return [node, id];
      }));
      rigBones = boneNodes.map(node => {
        const position = node.getWorldPosition(new THREE.Vector3());
        const localRotation = new THREE.Euler().setFromQuaternion(node.quaternion, "XYZ");
        const child = node.children.find(candidate => candidate.isBone);
        const tail = child?.getWorldPosition?.(new THREE.Vector3()) || position.clone().add(new THREE.Vector3(0, .12, 0));
        const bone = {
          id: idByNode.get(node), name: node.name || idByNode.get(node), parentId: idByNode.get(node.parent) || null,
          role: null, avatarObjectId: null, position: position.clone(), rotation: new THREE.Vector3(localRotation.x, localRotation.y, localRotation.z), tail: tail.clone(),
          bindPosition: position.clone(), bindRotation: new THREE.Vector3(localRotation.x, localRotation.y, localRotation.z), bindTail: tail.clone(), tailOffset: tail.clone().sub(position)
        };
        node.userData.rigBoneId = bone.id;
        return bone;
      });
      const nodeById = new Map(boneNodes.map(node => [idByNode.get(node), node]));
      const primaryAvatar = importedMeshes.find(node => node.isSkinnedMesh);
      if (primaryAvatar?.skeleton) {
        primaryAvatar.userData.rigRole = "skin";
        rigBones.forEach(bone => { bone.avatarObjectId = primaryAvatar.userData.id; });
        const nativeRest = new Map();
        root.updateMatrixWorld(true);
        for (const bone of rigBones) {
          const node = nodeById.get(bone.id);
          nativeRest.set(bone.id, {
            position: node.position.clone(), quaternion: node.quaternion.clone(), scale: node.scale.clone(),
            editorPosition: bone.position.clone(), editorRotation: bone.rotation.clone(),
            parentWorldInverse: node.parent ? node.parent.matrixWorld.clone().invert() : new THREE.Matrix4(),
            tailLocal: node.worldToLocal(bone.tail.clone())
          });
        }
        activeSkinRuntime = { avatar: primaryAvatar, bones: rigBones, threeBones: nodeById,
          skeleton: primaryAvatar.skeleton, importedRoot: root, nativeRest,
          importedSkins: importedMeshes.filter(node => node.isSkinnedMesh) };
        rigPoseChannels.clear();
        animationState.bindingRest = null;
        if (!(gltf.animations || []).length) {
          animationState.clips = { idle: { name: "Rest pose", fps: 24, end: 48, keys: {} } };
          Object.assign(animationState, { activeClipId: "idle", keys: animationState.clips.idle.keys, fps: 24, end: 48, frame: 0, playing: false });
        }
        bonesGlued = true;
      }
      const importedClips = {};
      for (const [index, clip] of (gltf.animations || []).entries()) {
        const base = gameCharacterSafeName(clip.name || `clip-${index + 1}`).toLowerCase();
        let id = base;
        let suffix = 2;
        while (importedClips[id]) id = `${base}-${suffix++}`;
        importedClips[id] = { name: clip.name || `Clip ${index + 1}`, ...gameCharacterImportedClipKeys(clip, rigBones, nodeById) };
      }
      if (Object.keys(importedClips).length) {
        animationState.clips = importedClips;
        animationState.activeClipId = Object.keys(importedClips)[0];
        const first = importedClips[animationState.activeClipId];
        Object.assign(animationState, { fps: first.fps, end: first.end, frame: 0, keys: first.keys, playing: false, bindingRest: null });
      }
      selectedBoneId = rigBones[0]?.id || null;
      rebuildBoneVisuals();
      syncBonePanel();
      updateGlueButton();
      updateAnimationPanel();
      syncAnimationClipUi();
    }
    selectObject(importedMeshes[0] || null);
    updateAll();
    setCameraToView("iso", { bounds: importedBounds, useCurrentZoom: false });
    log(`Imported ${file.name}, centered it over the workspace grid, and framed the complete model.`, {
      meshes: importedMeshes.length,
      bones: boneNodes.length,
      animationClips: (gltf.animations || []).length
    });
  } catch (error) {
    console.error(error);
    log(`${formatName} import failed: ${error?.message || error}`);
  }
}

async function importFullModelGlb(file) {
  return importFullModelGltf(file);
}

function safeFileName(name, fallback = "mesh") {
  return String(name || fallback)
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || fallback;
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

function exportReadyMeshPart(mesh, { mirrorAxis = null } = {}) {
  const source = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  mesh.updateMatrixWorld(true);
  const worldMatrix = mesh.matrixWorld.clone();
  source.applyMatrix4(worldMatrix);
  if (Array.isArray(mirrorAxis)) {
    mirrorAxis.forEach(axis => mirrorGeometryInPlace(source, axis));
  } else if (mirrorAxis) {
    mirrorGeometryInPlace(source, mirrorAxis);
  }

  source.computeBoundingBox();
  const center = source.boundingBox.getCenter(new THREE.Vector3());
  const bounds = source.boundingBox.clone();
  source.translate(-center.x, -center.y, -center.z);

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


function exportObjParts() {
  try { bwsOpenPluginWorkspace("roblox-exporter"); } catch (error) { log("Install and enable Roblox Exporter in Plugins first. " + error.message); }
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
  syncAnimationDetailCameraOptions();
  renderCustomCameraMarkers();
}

function syncAnimationDetailCameraOptions() {
  if (!els.animationDetailCameraSelect) return;
  const selected = customCameraViewById(els.animationDetailCameraSelect.value) || customCameraViewById();
  els.animationDetailCameraSelect.innerHTML = "";
  if (!customCameraViews.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No detail cameras";
    els.animationDetailCameraSelect.append(option);
  } else {
    customCameraViews.forEach(view => {
      const option = document.createElement("option");
      option.value = view.id;
      option.textContent = view.name;
      option.selected = view.id === (selected?.id || selectedCustomCameraId);
      els.animationDetailCameraSelect.append(option);
    });
  }
  const view = customCameraViewById(els.animationDetailCameraSelect.value) || customCameraViewById();
  if (els.animationDetailWidthInput) els.animationDetailWidthInput.value = view?.exportWidth || 512;
  if (els.animationDetailHeightInput) els.animationDetailHeightInput.value = view?.exportHeight || 512;
  [els.animationDetailCameraViewBtn, els.animationDetailCameraUpdateBtn, els.animationDetailSheetExportBtn].forEach(button => { if (button) button.disabled = !view; });
  if (els.animationDetailCameraStatus) els.animationDetailCameraStatus.textContent = view
    ? `${view.name} · ${view.exportWidth || 512} × ${view.exportHeight || 512}`
    : "Place the viewport over a detail, then add a camera.";
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
    fov: camera.fov,
    exportWidth: 512,
    exportHeight: 512
  };
  customCameraViews.push(view);
  selectedCustomCameraId = view.id;
  activeCustomCameraId = view.id;
  renderCustomCameraViews();
  log(`Added ${view.name} at the current viewport.`);
  return view;
}

function addAnimationDetailCameraView() {
  const view = addCustomCameraView();
  view.name = `AI Detail ${customCameraViews.filter(candidate => candidate.name.startsWith("AI Detail")).length + 1}`;
  view.exportWidth = Math.max(64, Math.min(2048, Math.round(Number(els.animationDetailWidthInput?.value) || 512)));
  view.exportHeight = Math.max(64, Math.min(2048, Math.round(Number(els.animationDetailHeightInput?.value) || 512)));
  renderCustomCameraViews();
  log(`Saved ${view.name} for focused animation checks.`);
  return view;
}

function selectAnimationDetailCamera(id) {
  selectCustomCameraView(id);
}

function updateAnimationDetailCameraSize() {
  const view = customCameraViewById(els.animationDetailCameraSelect?.value) || customCameraViewById();
  if (!view) return;
  view.exportWidth = Math.max(64, Math.min(2048, Math.round(Number(els.animationDetailWidthInput?.value) || 512)));
  view.exportHeight = Math.max(64, Math.min(2048, Math.round(Number(els.animationDetailHeightInput?.value) || 512)));
  syncAnimationDetailCameraOptions();
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
      exportWidth: Math.max(64, Math.min(2048, Math.round(Number(view?.exportWidth) || 512))),
      exportHeight: Math.max(64, Math.min(2048, Math.round(Number(view?.exportHeight) || 512))),
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
  bottom: new THREE.Vector3(0, -1, 0),
  opposite: new THREE.Vector3(-1, 0, 0),
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
  if (viewName === "bottom") camera.up.set(0, 0, 1);
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
  const reverse = { front: "back", side: "opposite", top: "bottom" };
  const titles = { front: "Front Work", back: "Back Work", side: "Side Work", opposite: "Opposite Side", top: "Top Work", bottom: "Bottom Work" };
  for (const [name, button] of Object.entries(map)) {
    if (!button) continue;
    button.classList.toggle("active", activeWorkView === name || activeWorkView === reverse[name]);
    button.textContent = titles[activeWorkView === name ? reverse[name] : name];
  }
  if (els.workViewRestoreBtn) els.workViewRestoreBtn.hidden = !activeWorkView;
  if (els.workViewAxisLabel) {
    els.workViewAxisLabel.hidden = !activeWorkView;
    const oppositeLabels = { back: "Back view: X / Y (Z hidden)", opposite: "Opposite side: Z / Y (X hidden)", bottom: "Bottom view: X / Z (Y hidden)" };
    els.workViewAxisLabel.textContent = activeWorkView ? workViewAxisLabels[activeWorkView] || oppositeLabels[activeWorkView] || "" : "";
  }
  els.viewportRoot?.classList.toggle("work-view-active", !!activeWorkView);
}

function toggleOrthographicWorkView(viewName) {
  const opposite = { front: "back", side: "opposite", top: "bottom" };
  return setOrthographicWorkView(activeWorkView === viewName ? opposite[viewName] : viewName);
}

function setOrthographicWorkView(viewName) {
  if (!["front", "back", "side", "opposite", "top", "bottom"].includes(viewName)) return false;
  if (!savedWorkViewCamera) {
    savedWorkViewCamera = {
      position: camera.position.clone(),
      up: camera.up.clone(),
      target: orbit.target.clone(),
      near: camera.near,
      far: camera.far,
      enableRotate: orbit.enableRotate,
      gridPosition: grid.position.clone(),
      gridQuaternion: grid.quaternion.clone(),
      gridScale: grid.scale.clone(),
      gridLabelsVisible: gridLabelGroup.visible
    };
  }
  activeWorkView = viewName;
  setCameraToView(viewName);
  const bounds = sceneBounds();
  const center = bounds.getCenter(new THREE.Vector3());
  const direction = screenshotViewDirections[viewName].clone().normalize();
  grid.position.copy(center).addScaledVector(direction, -bounds.getSize(new THREE.Vector3()).length() * .55);
  grid.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  gridLabelGroup.visible = false;
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
  grid.position.copy(savedWorkViewCamera.gridPosition);
  grid.quaternion.copy(savedWorkViewCamera.gridQuaternion);
  grid.scale.copy(savedWorkViewCamera.gridScale);
  gridLabelGroup.visible = savedWorkViewCamera.gridLabelsVisible;
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

function captureView(...args) {
  bwsCharacterEffectCaptureDepth++;
  try {
    bwsUpdateCharacterEyeVisibility();
    return captureViewInternal(...args);
  } finally {
    bwsCharacterEffectCaptureDepth--;
  }
}

function captureViewInternal(viewName = "iso", { download = false, prefix = currentProjectBaseName(), transparent = false, useCurrentZoom = null, bounds = null, qualityScale = 1, directionOverride = null, centerOverride = null, orthographic = false, includeBones = false, restoreRigOpacity = false, cameraPoseOverride = null, outputWidth = null, outputHeight = null } = {}) {
  const oldPosition = camera.position.clone();
  const oldUp = camera.up.clone();
  const oldTarget = orbit.target.clone();
  const oldDistance = oldPosition.distanceTo(oldTarget);
  const oldNear = camera.near;
  const oldFar = camera.far;
  const oldFov = camera.fov;
  const oldAspect = camera.aspect;
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
  const fixedWidth = Number(outputWidth) > 0 ? Math.max(64, Math.min(2048, Math.round(Number(outputWidth)))) : null;
  const fixedHeight = Number(outputHeight) > 0 ? Math.max(64, Math.min(2048, Math.round(Number(outputHeight)))) : null;
  if (fixedWidth && fixedHeight) {
    renderer.setPixelRatio(1);
    renderer.setSize(fixedWidth, fixedHeight, false);
    camera.aspect = fixedWidth / fixedHeight;
    camera.updateProjectionMatrix();
  }
  if (cameraPoseOverride) {
    camera.position.copy(cameraPoseOverride.position);
    camera.up.copy(cameraPoseOverride.up);
    orbit.target.copy(cameraPoseOverride.target);
    camera.fov = Math.max(10, Math.min(120, Number(cameraPoseOverride.fov) || oldFov));
    camera.lookAt(orbit.target);
    camera.updateProjectionMatrix();
  } else {
    setCameraToView(viewName, {
      useCurrentZoom: useCurrentZoom ?? (els.useCurrentZoomInShotsInput?.checked ?? true),
      currentDistance: oldDistance,
      bounds,
      directionOverride,
      centerOverride
    });
  }
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
  camera.fov = oldFov;
  camera.aspect = oldAspect;
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

async function saveCurrentViewPng() {
  const prefix = currentProjectBaseName();
  await waitForSceneTextures();
  const shot = captureView("current-view", {
    download: true,
    prefix,
    cameraPoseOverride: {
      position: camera.position.clone(),
      target: orbit.target.clone(),
      up: camera.up.clone(),
      fov: camera.fov
    }
  });
  log("Saved the current viewport camera as a PNG.", shot.fileName);
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

async function composeAnimationDetailSheet(view, shots, clipLabel, prefix) {
  const images = await Promise.all(shots.map(shot => loadShotImage(shot.dataUrl)));
  const cellWidth = Math.max(64, Math.min(2048, Math.round(Number(view.exportWidth) || images[0]?.width || 512)));
  const cellHeight = Math.max(64, Math.min(2048, Math.round(Number(view.exportHeight) || images[0]?.height || 512)));
  const columns = Math.min(images.length, Math.max(1, Math.floor(30000 / cellWidth)));
  const rows = Math.ceil(images.length / columns);
  const sheet = document.createElement("canvas");
  sheet.width = cellWidth * columns;
  sheet.height = cellHeight * rows;
  const context = sheet.getContext("2d");
  context.clearRect(0, 0, sheet.width, sheet.height);
  images.forEach((image, index) => context.drawImage(image, 0, 0, image.width, image.height, (index % columns) * cellWidth, Math.floor(index / columns) * cellHeight, cellWidth, cellHeight));
  const slug = value => String(value || "detail").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "detail";
  const fileName = `${prefix}-${slug(clipLabel)}-${slug(view.name)}-detail-sheet.png`;
  return { fileName, width: sheet.width, height: sheet.height, frameWidth: cellWidth, frameHeight: cellHeight, columns, rows, dataUrl: sheet.toDataURL("image/png"), view: view.id, shots };
}

async function saveAnimationDetailMotionSheet({ cameraId = null, frameCount = 8, range = "end", includeBones = false, download = true } = {}) {
  if (!animationHasKeys()) { log("Add at least one keyed pose before exporting a detail sheet."); return null; }
  const view = customCameraViewById(cameraId || els.animationDetailCameraSelect?.value) || customCameraViewById();
  if (!view) { log("Add an AI detail camera first."); return null; }
  const originalFrame = animationState.frame;
  const originalPlaying = animationState.playing;
  const frames = animationMotionSheetFrames(frameCount, animationExportEndFrame(range));
  const prefix = currentProjectBaseName();
  const clip = animationState.clips?.[animationState.activeClipId];
  const clipLabel = String(clip?.name || animationState.activeClipId || "animation").trim();
  animationState.playing = false;
  try {
    await waitForSceneTextures();
    const shots = [];
    for (const frame of frames) {
      animationSetFrame(frame, { render: false });
      if (includeBones) { rebuildBoneVisuals(); boneRigGroup.visible = true; }
      const pose = resolvedCustomCameraPose(view);
      shots.push({ ...captureView("detail", {
        download: false,
        prefix,
        transparent: true,
        includeBones,
        restoreRigOpacity: true,
        cameraPoseOverride: { ...pose, fov: view.fov },
        outputWidth: view.exportWidth || 512,
        outputHeight: view.exportHeight || 512
      }), frame });
    }
    const sheet = await composeAnimationDetailSheet(view, shots, clipLabel, prefix);
    if (download) downloadDataUrl(sheet.fileName, sheet.dataUrl);
    if (els.animationDetailCameraStatus) els.animationDetailCameraStatus.textContent = `Saved ${view.name} · ${sheet.frameWidth} × ${sheet.frameHeight} · ${frames.length} frames`;
    log(`Saved focused animation sheet from ${view.name}.`, { clip: clipLabel, frames, frameSize: `${sheet.frameWidth}x${sheet.frameHeight}`, fileName: sheet.fileName });
    return sheet;
  } finally {
    animationState.playing = originalPlaying;
    animationSetFrame(originalFrame);
  }
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

async function importFullModelFbx(files) {
  const selectedFiles = Array.from(files || []);
  const file = selectedFiles.find(entry => /\.fbx$/i.test(entry.name));
  if (!file) { log("Choose an FBX model, optionally together with its texture images."); return; }
  if (selectedFiles.filter(entry => /\.fbx$/i.test(entry.name)).length !== 1) {
    log("Import one FBX model at a time; texture images may be selected with it."); return;
  }
  const urls = new Map(), missing = new Set();
  const basename = path => {
    let name = String(path).replaceAll("\\", "/").split("/").pop();
    try { name = decodeURIComponent(name); } catch {}
    return name.toLowerCase();
  };
  try {
    for (const entry of selectedFiles) if (entry !== file) {
      const key = basename(entry.name);
      if (urls.has(key)) throw new Error("Two selected textures have the same filename: " + entry.name);
      urls.set(key, URL.createObjectURL(entry));
    }
    const manager = new THREE.LoadingManager();
    manager.setURLModifier(url => {
      if (/^(data:|blob:)/i.test(url)) return url;
      const resolved = urls.get(basename(url));
      if (resolved) return resolved;
      missing.add(basename(url));
      return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==";
    });
    manager.onError = url => missing.add(basename(url));
    const ready = new Promise(resolve => { manager.onLoad = resolve; });
    const buffer = await file.arrayBuffer();
    manager.itemStart("bws-fbx-import");
    let loadedRoot;
    try { loadedRoot = new FBXLoader(manager).parse(buffer, ""); }
    finally { manager.itemEnd("bws-fbx-import"); }
    await ready;
    await importFullModelGltf(file, { scene: loadedRoot, animations: loadedRoot.animations || [] }, "FBX");
    if (missing.size) log("FBX textures missing or unreadable: " + [...missing].join(", ") + ". Select the model and its texture images together to include them.");
  } catch (error) {
    console.error(error);
    log("FBX import failed: " + (error?.message || error));
  } finally {
    for (const url of urls.values()) URL.revokeObjectURL(url);
  }
}

async function exportFullModelFbx() {
  const button = document.querySelector("#exportFbxBtn");
  if (button?.disabled) return;
  if (button) button.disabled = true;
  try {
    await new Promise(resolve => requestAnimationFrame(resolve));
    const roots = [...new Set(objects.filter(object => !object.userData?.editorHelper).map(object => {
      let root = object;
      while (root.parent && root.parent !== scene) root = root.parent;
      return root;
    }))];
    const animations = roots.flatMap(root => root.userData?.bwsImportedAnimations || root.animations || []);
    const result = exportBinaryFbx(roots, { animations, textureDataUrl: importedTextureDataUrl });
    const name = gameCharacterSafeName(currentProjectBaseName(), "boltworks-model") + ".fbx";
    downloadBlob(name, new Blob([result.buffer], { type: "application/octet-stream" }));
    log("Exported " + name + " with " + result.meshCount + " meshes and " + result.clipCount + " preserved animation clips.");
    for (const warning of result.warnings) log("FBX: " + warning);
    if (Object.keys(animationState.clips || {}).length) log("FBX exports preserved imported clips. Save a project or rig file to retain edits made in the animation timeline.");
  } catch (error) {
    console.error(error);
    log("FBX export failed: " + (error?.message || error));
  } finally {
    if (button) button.disabled = false;
  }
}

// Shared, non-interactive progress display for large model imports.
let bwsImportDepth = 0;
function withModelImportProgress(operation, label) {
  return async function(...args) {
    const outer = bwsImportDepth++ === 0;
    const ownsInput = outer && !bwsUsdUiActive;
    let indicator;
    if(outer){
      if(ownsInput)beginUsdUi();
      indicator=document.createElement('div');indicator.id='bwsImportProgress';
      indicator.setAttribute('role','status');indicator.setAttribute('aria-live','polite');
      indicator.style.cssText='position:fixed;bottom:28px;left:50%;transform:translateX(-50%);z-index:2147483647;background:#172426;color:#eee5d3;border:1px solid #738b77;border-radius:8px;padding:18px 24px;max-width:80vw;pointer-events:none;box-shadow:0 6px 30px #0008';
      const heading=document.createElement('strong');heading.textContent=label;
      const detail=document.createElement('div');detail.textContent='Reading model, textures and animation. Large files can take a while.';
      const progress=document.createElement('progress');progress.style.cssText='display:block;width:100%;margin-top:10px';progress.setAttribute('aria-label','Import in progress');
      indicator.append(heading,detail,progress);document.body.append(indicator);
    }
    try{
      // Give the browser time to paint before synchronous binary decoding begins.
      if(outer)await new Promise(resolve=>setTimeout(resolve,80));
      return await operation.apply(this,args);
    }finally{
      bwsImportDepth--;
      if(outer){indicator?.remove();if(ownsInput)endUsdUi();}
    }
  };
}
importFullModelGltf=withModelImportProgress(importFullModelGltf,'Importing model...');
importFullModelFbx=withModelImportProgress(importFullModelFbx,'Importing FBX...');
importObjFiles=withModelImportProgress(importObjFiles,'Importing OBJ...');
