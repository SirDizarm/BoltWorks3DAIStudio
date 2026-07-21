function resize() {
  const rect = canvas.parentElement.getBoundingClientRect();
  renderer.setSize(rect.width, rect.height, false);
  camera.aspect = rect.width / Math.max(1, rect.height);
  camera.updateProjectionMatrix();
  resizeReferenceRenderer(frontBoneRenderer, frontBoneCamera, frontBoneCanvas, "front");
  resizeReferenceRenderer(sideBoneRenderer, sideBoneCamera, sideBoneCanvas, "side");
}

function animate() {
  requestAnimationFrame(animate);
  resize();
  boneGridAxisGroup.visible = !!els.showGridInput?.checked;
  orbit.update();
  syncSelectionOutlineTransforms();
  if (lineSketchMode && lineSketchPoints.length) updateLineSketchGuide();
  if (lineSketchMode && lineSketchHover?.point) {
    const radius = Math.max(.025, Math.min(.12, camera.position.distanceTo(lineSketchHover.point) * .012));
    lineSketchCursor.scale.setScalar(radius);
  }
  renderer.render(scene, camera);
  const mainBackground = scene.background;
  const mainFog = scene.fog;
  scene.background = studioBackground;
  scene.fog = null;
  frontBoneRenderer.render(scene, frontBoneCamera);
  sideBoneRenderer.render(scene, sideBoneCamera);
  scene.background = mainBackground;
  scene.fog = mainFog;
}

function hitFromPointerEvent(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObjects(objects.filter(object => object.visible && !object.userData?.hidden), false)[0] || null;
}

function hitsFromPointerEvent(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObjects(objects.filter(object => object.visible && !object.userData?.hidden), false);
}

function canvasPointFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

function scenePickDragged(pointerState, event, threshold = 6) {
  if (!pointerState) return false;
  const dx = event.clientX - pointerState.startClientX;
  const dy = event.clientY - pointerState.startClientY;
  return Math.hypot(dx, dy) > threshold;
}

function updateSelectionBox(start, end) {
  const rect = normalizedRect(start, end);
  els.selectionBox.style.display = "block";
  els.selectionBox.style.left = `${rect.left}px`;
  els.selectionBox.style.top = `${rect.top}px`;
  els.selectionBox.style.width = `${Math.max(1, rect.right - rect.left)}px`;
  els.selectionBox.style.height = `${Math.max(1, rect.bottom - rect.top)}px`;
}

function hideSelectionBox() {
  els.selectionBox.style.display = "none";
}

function finishAreaSelection(event) {
  if (!isAreaSelectingTriangles) return;
  const end = canvasPointFromEvent(event);
  const rect = normalizedRect(areaSelectionStart, end);
  isAreaSelectingTriangles = false;
  areaSelectionStart = null;
  orbit.enabled = true;
  hideSelectionBox();
  try { canvas.releasePointerCapture?.(event.pointerId); } catch {}
  selectTrianglesInScreenRect(rect, { append: event.shiftKey });
}

function paintTriangleFromPointer(event) {
  const hit = hitFromPointerEvent(event);
  if (!hit) return null;
  const picked = pickFace(hit, { append: true, toggleExisting: false, silent: true });
  if (picked?.markerKey !== lastPaintedTriangleKey) {
    lastPaintedTriangleKey = picked?.markerKey || null;
    const now = performance.now();
    if (now - lastPaintLogAt > 500) {
      lastPaintLogAt = now;
      log(`Paint-selected triangles on ${hit.object.name}.`, { selected: selectedFaces.length });
    }
  }
  return picked;
}

function finishTrianglePainting(pointerId = null) {
  if (!isPaintingTriangles) return;
  isPaintingTriangles = false;
  lastPaintedTriangleKey = null;
  orbit.enabled = true;
  if (pointerId !== null) {
    try { canvas.releasePointerCapture?.(pointerId); } catch {}
  }
  log(`Finished paint selection.`, { selected: selectedFaces.length });
}

document.querySelectorAll("[data-add]").forEach(btn => {
  btn.addEventListener("click", () => addObject({ shape: btn.dataset.add }));
});

document.querySelectorAll("[data-mode]").forEach(btn => {
  btn.addEventListener("click", () => {
    setTransformMode(btn.dataset.mode);
  });
});
document.querySelectorAll("[data-flip-axis]").forEach(btn => {
  btn.addEventListener("click", () => flipSelectedParts(btn.dataset.flipAxis));
});
[
  els.toggleToolbarTransform,
  els.toggleToolbarMirror,
  els.toggleToolbarSelectionTools,
  els.toggleToolbarLineTools,
  els.toggleToolbarMarkerTools,
  els.toggleToolbarTriEditor,
  els.toggleToolbarMiscTools,
  els.toggleToolbarFaceEdit,
  els.toggleToolbarScene,
  els.toggleToolbarProjectFiles,
  els.toggleToolbarViews,
  els.toggleToolbarImportExport
].filter(Boolean).forEach(input => input.addEventListener("change", () => {
  applyToolbarVisibility();
  updateTransformAttachment();
}));
els.rotationSnapSelect.addEventListener("change", applyRotationSnap);

document.querySelector("#duplicateBtn").addEventListener("click", duplicateSelected);
document.querySelector("#deleteBtn").addEventListener("click", deleteSelection);
document.querySelector("#undoBtn").addEventListener("click", undo);
els.selectAllBtn.addEventListener("click", () => {
  setCheckedMeshes(objects, true, { replace: true });
  log(`Checked all ${objects.length} mesh part${objects.length === 1 ? "" : "s"}.`);
});

function clearCurrentSelection() {
  setCheckedMeshes(objects, false, { replace: true });
  activeGroupIds = [];
  selectedGroupRecordId = null;
  selected = null;
  currentTransformTargetKey = "";
  setOpeningPickMode(false);
  clearSelectedHoleLoop();
  clearSelectedTriangles();
  updateTransformAttachment();
  updateAll();
  log("Cleared the current selection.");
}

els.deselectAllBtn.addEventListener("click", clearCurrentSelection);
els.hideAllBtn?.addEventListener("click", () => {
  if (!objects.length) {
    log("No meshes to hide.");
    return;
  }
  recordHistory("hide all");
  setHiddenTargets(objects, true);
  log(`Hid all ${objects.length} mesh part${objects.length === 1 ? "" : "s"}.`);
});
els.unhideAllBtn?.addEventListener("click", () => {
  if (!objects.length) {
    log("No meshes to show.");
    return;
  }
  recordHistory("show all");
  setHiddenTargets(objects, false);
  log(`Showed all ${objects.length} mesh part${objects.length === 1 ? "" : "s"}.`);
});
applyPluginAvailability(els);
els.addRootBoneBtn?.addEventListener("click", () => addRigBone(false));
els.addChildBoneBtn?.addEventListener("click", () => addRigBone(true));
els.deleteBoneBtn?.addEventListener("click", deleteSelectedBone);
els.importBoneStructureBtn?.addEventListener("click", () => els.boneStructureFile?.click());
els.boneStructureFile?.addEventListener("change", async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    importBoneStructure(JSON.parse(await file.text()), file.name);
  } catch (error) {
    log(`Bone import failed: ${error.message}`);
  } finally {
    event.target.value = "";
  }
});
els.boneAxisFreeBtn?.addEventListener("click", () => setBoneMoveAxis("free"));
els.boneAxisXBtn?.addEventListener("click", () => setBoneMoveAxis("x"));
els.boneAxisYBtn?.addEventListener("click", () => setBoneMoveAxis("y"));
els.boneAxisZBtn?.addEventListener("click", () => setBoneMoveAxis("z"));
els.boneList?.addEventListener("change", () => {
  selectedBoneId = els.boneList.value || null;
  rebuildBoneVisuals();
  syncBonePanel();
});
[els.boneNameInput, els.boneParentSelect, els.bonePosX, els.bonePosY, els.bonePosZ, els.boneRotX, els.boneRotY, els.boneRotZ].forEach(control => {
  control?.addEventListener("change", applyBonePanelValues);
});
els.showBonesInput?.addEventListener("change", rebuildBoneVisuals);
frontBoneCanvas.addEventListener("pointerdown", event => beginBoneDrag(event, "front", frontBoneCanvas, frontBoneCamera));
sideBoneCanvas.addEventListener("pointerdown", event => beginBoneDrag(event, "side", sideBoneCanvas, sideBoneCamera));
frontBoneCanvas.addEventListener("pointermove", moveBoneDrag);
sideBoneCanvas.addEventListener("pointermove", moveBoneDrag);
frontBoneCanvas.addEventListener("pointerup", endBoneDrag);
sideBoneCanvas.addEventListener("pointerup", endBoneDrag);
frontBoneCanvas.addEventListener("pointercancel", endBoneDrag);
sideBoneCanvas.addEventListener("pointercancel", endBoneDrag);
restoreBoneRig({ bones: [], showGuides: true });
document.querySelector("#groupBtn").addEventListener("click", groupCheckedParts);
document.querySelector("#ungroupBtn").addEventListener("click", ungroupParts);
document.querySelector("#mergeMeshBtn").addEventListener("click", mergeCheckedMeshes);
els.pivotBtn.addEventListener("click", () => setPivotEditMode(!pivotEditMode));
els.centerPivotBtn.addEventListener("click", centerSharedPivot);
document.querySelector("#facePickBtn").addEventListener("click", () => setFacePickMode(!facePickMode));
els.faceRegionBtn.addEventListener("click", () => setCoplanarFacePickMode(!coplanarFacePickMode));
els.openingPickBtn?.addEventListener("click", () => setOpeningPickMode(!openingPickMode));
els.lineToolBtn.addEventListener("click", () => setLineSketchMode(!lineSketchMode));
els.closeLineBtn.addEventListener("click", closeLineSketch);
els.makeFaceBtn.addEventListener("click", createFaceFromLineSketch);
els.fillLineBtn.addEventListener("click", fillLineSketch);
els.cutHoleSketchBtn.addEventListener("click", cutHoleFromLineSketch);
els.clearLineBtn.addEventListener("click", () => clearLineSketch({ keepMode: false }));
document.querySelector("#markerBtn").addEventListener("click", addMarkerFromSelectedTriangle);
document.querySelector("#clearTriBtn").addEventListener("click", clearTriangleSelection);
document.querySelector("#deleteTriBtn").addEventListener("click", deleteSelectedTriangles);
document.querySelector("#extractTriBtn").addEventListener("click", extractSelectedTriangles);
document.querySelector("#fillHoleBtn").addEventListener("click", fillSelectedHole);
document.querySelector("#bridgeMeshesBtn").addEventListener("click", bridgeCheckedMeshes);
document.querySelector("#digIntoBtn").addEventListener("click", digIntoSelectedFace);
document.querySelector("#removeMarksBtn").addEventListener("click", removeMarkersForSelection);
document.querySelector("#copyTriBtn").addEventListener("click", copySelectedTriangles);
document.querySelector("#pasteTriBtn").addEventListener("click", pasteCopiedTriangles);
els.paintTriInput.addEventListener("change", () => {
  if (els.paintTriInput.checked) {
    els.areaTriInput.checked = false;
    coplanarFacePickMode = false;
  }
  if (facePickMode) setFacePickMode(true);
  else updateFacePickHud();
});
els.areaTriBtn.addEventListener("click", () => {
  els.areaTriInput.checked = !els.areaTriInput.checked;
  if (els.areaTriInput.checked) {
    els.paintTriInput.checked = false;
    coplanarFacePickMode = false;
  }
  if (facePickMode) setFacePickMode(true);
  else updateFacePickHud();
});
document.querySelector("#extendFaceBtn").addEventListener("click", extendSelectedFaces);
document.querySelector("#pullFaceBtn").addEventListener("click", pullSelectedFaces);
document.querySelector("#pushFaceBtn").addEventListener("click", pushSelectedFaces);
els.dragPushBtn.addEventListener("click", () => setDragPushMode(!dragPushMode));
[els.dragPushAxisSelect, els.dragPushStepInput].forEach(input => input?.addEventListener("input", () => {
  if (!dragPushMode) return;
  els.hudText.textContent = `Drag/Push mode: drag left or right to move selected triangles along ${dragPushAxisLabel()} in snapped ${dragPushStepSize()} steps`;
}));
document.querySelector("#bevelFaceBtn").addEventListener("click", bevelSelectedFace);
els.cutMeshBtn.addEventListener("click", cutSelectedMesh);
document.querySelector("#clearBtn").addEventListener("click", clearObjects);
document.querySelector("#frameBtn").addEventListener("click", frameSelected);
els.resetZoomBtn.addEventListener("click", () => {
  frameSelected();
  log("Viewer zoom reset by framing the current model.");
});
els.reliefImageBtn?.addEventListener("click", () => els.reliefImageFile?.click());
els.reliefImageFile?.addEventListener("change", async event => {
  try {
    await loadReliefImageFile(event.target.files?.[0]);
  } catch (error) {
    log(`Could not load relief image: ${error.message}`);
    alert(error.message);
  } finally {
    event.target.value = "";
  }
});
els.createReliefMeshBtn?.addEventListener("click", createReliefMeshFromLoadedImage);
els.previewFrontBtn.addEventListener("click", () => previewShotView("front"));
els.previewBackBtn.addEventListener("click", () => previewShotView("back"));
els.previewLeftBtn.addEventListener("click", () => previewShotView("left"));
els.previewRightBtn.addEventListener("click", () => previewShotView("right"));
els.previewTopBtn.addEventListener("click", () => previewShotView("top"));
els.previewIsoBtn.addEventListener("click", () => previewShotView("iso"));
els.saveFrontPngBtn.addEventListener("click", async () => saveSingleViewPng("front"));
els.saveBackPngBtn.addEventListener("click", async () => saveSingleViewPng("back"));
els.saveLeftPngBtn.addEventListener("click", async () => saveSingleViewPng("left"));
els.saveRightPngBtn.addEventListener("click", async () => saveSingleViewPng("right"));
els.saveTopPngBtn.addEventListener("click", async () => saveSingleViewPng("top"));
els.saveIsoPngBtn.addEventListener("click", async () => saveSingleViewPng("iso"));
els.saveQaSheetBtn?.addEventListener("click", async () => saveQaSheet());
els.viewSpaceInput.addEventListener("change", frameSelected);
els.shotSpaceInput.addEventListener("change", () => log(`Save Views zoom set to ${els.shotSpaceInput.value}. Lower values zoom in closer when current zoom syncing is off.`));
els.environmentSelect?.addEventListener("change", () => {
  syncGridVisibility();
  const label = els.environmentSelect.selectedOptions?.[0]?.textContent || els.environmentSelect.value;
  log(`Viewport ground set to ${label}. Saved PNG views use the same ground.`);
});
els.backgroundSelect?.addEventListener("change", () => {
  syncGridVisibility();
  const label = els.backgroundSelect.selectedOptions?.[0]?.textContent || els.backgroundSelect.value;
  log(`Viewport background set to ${label}. Saved PNG views use the same background.`);
});
els.showGridInput.addEventListener("change", () => {
  syncGridVisibility();
  log(`${els.showGridInput.checked ? "Showing" : "Hiding"} the grid overlay.`);
});
[
  els.showLightGuidesInput,
  els.enablePrimaryLightInput,
  els.enableMirrorLightInput
].forEach(input => input.addEventListener("change", () => {
  syncSpotLightRig();
  const lampCount = (els.enablePrimaryLightInput.checked ? 1 : 0) + (els.enableMirrorLightInput.checked ? 1 : 0);
  log(`Light rig updated. ${lampCount} lamp${lampCount === 1 ? "" : "s"} active${els.showLightGuidesInput.checked ? " with guides visible" : ""}.`);
}));
[
  els.lightPosXInput,
  els.lightPosYInput,
  els.lightPosZInput,
  els.lightTargetXInput,
  els.lightTargetYInput,
  els.lightTargetZInput,
  els.lightIntensityInput,
  els.lightAngleInput
].forEach(input => input.addEventListener("input", () => {
  syncSpotLightRig();
}));
els.useCurrentZoomInShotsInput.addEventListener("change", () => log(`${els.useCurrentZoomInShotsInput.checked ? "Using current viewport zoom" : "Using Shot Zoom input"} for Save Views.`));
els.hideGridInShotsInput.addEventListener("change", () => log(`${els.hideGridInShotsInput.checked ? "Hiding" : "Showing"} grid in Save Views screenshots.`));
document.querySelector("#resetBtn").addEventListener("click", () => { clearObjects(); log("Scene reset."); });
document.querySelector("#captureViewsBtn").addEventListener("click", async () => {
  const prefix = currentProjectBaseName();
  const shots = await captureViews({ download: true, prefix });
  log(`Saved ${shots.length} reference screenshots for AI review.`, shots.map(shot => shot.fileName));
});

els.saveProjectBtn.addEventListener("click", () => {
  const projectName = currentProjectBaseName();
  download(`${projectName}.modelerproj`, JSON.stringify(projectState(), null, 2), "application/json");
  log("Saved full project file.", {
    project: projectName,
    objects: objects.length,
    checked: checkedIds.size
  });
});
els.loadProjectBtn.addEventListener("click", () => els.importProjectFile.click());
els.stopServerBtn?.addEventListener("click", shutdownServerAndCloseApp);
document.querySelector("#exportJsonBtn").addEventListener("click", () => download(`${currentProjectBaseName()}-scene.json`, JSON.stringify(state(), null, 2), "application/json"));
document.querySelector("#exportObjBtn").addEventListener("click", () => {
  const group = new THREE.Group();
  objects.forEach(mesh => group.add(mesh.clone()));
  download(`${currentProjectBaseName()}.obj`, new OBJExporter().parse(group), "text/plain");
});
document.querySelector("#exportObjPartsBtn").addEventListener("click", exportObjParts);
els.exportBolt2dBtn?.addEventListener("click", exportBolt2dPackage);
document.querySelector("#exportDaeBtn").addEventListener("click", () => {
  const pkg = exportColladaPackage();
  for (const [name, dataUrl] of pkg.textureAssets) downloadDataUrl(name, dataUrl);
  download(`${currentProjectBaseName()}.dae`, pkg.xml, "model/vnd.collada+xml");
  if (pkg.textureAssets.size) {
    log(`Exported DAE with ${pkg.textureAssets.size} texture file${pkg.textureAssets.size === 1 ? "" : "s"}. Keep the texture image(s) in the same folder as the DAE for SketchUp.`);
  }
});
document.querySelector("#importBtn").addEventListener("click", () => els.importFile.click());
els.importObjBtn.addEventListener("click", () => els.importObjFile.click());
els.importObjFolderBtn.addEventListener("click", () => els.importObjFolderFile.click());
document.querySelector("#importDaeBtn").addEventListener("click", () => els.importDaeFile.click());
els.textureBtn.addEventListener("click", () => {
  const targets = textureTargetObjects();
  if (!targets.length) {
    log("Select or check one or more parts before adding a texture.");
    return;
  }
  if (textureLibrary.size) {
    const opening = els.textureLibraryPanel.hidden;
    setTextureLibraryPanelOpen(opening);
    if (opening) {
      const currentName = currentTextureLibraryName();
      if (currentName && textureLibrary.has(currentName)) els.textureLibrarySelect.value = currentName;
      log("Texture Library opened. Pick a stored texture or import a new one.");
    }
    return;
  }
  els.textureFile.click();
});
els.textureEditorBtn.addEventListener("click", openTextureEditor);
els.applyLibraryTextureBtn.addEventListener("click", applySelectedLibraryTexture);
els.importLibraryTextureBtn.addEventListener("click", () => els.textureFile.click());
els.textureLibrarySelect?.addEventListener("change", syncTextureRobloxIdInput);
els.textureRobloxIdInput?.addEventListener("input", () => {
  syncCurrentTextureRobloxId({ writeInput: false });
});
els.textureRobloxIdInput?.addEventListener("change", () => {
  const entry = syncCurrentTextureRobloxId({ refresh: true, writeInput: true });
  if (!entry) return;
  log(`Updated Roblox texture id for ${entry.name}.`, {
    texture: entry.name,
    robloxAssetId: entry.robloxAssetId || ""
  });
});
els.clearTextureBtn.addEventListener("click", () => {
  const targets = textureTargetObjects();
  if (!targets.length) return;
  recordHistory("clear texture");
  for (const mesh of targets) applyTextureToMesh(mesh, null);
  syncInspector();
  updateAll();
  log(`Cleared texture from ${targets.length} part${targets.length === 1 ? "" : "s"}.`);
});
els.flipTextureBtn.addEventListener("click", () => {
  const targets = textureTargetObjects().filter(mesh => mesh.userData.textureUrl);
  if (!targets.length) {
    log("Select or check one or more textured parts before flipping texture orientation.");
    return;
  }
  recordHistory("flip texture");
  for (const mesh of targets) {
    const nextFlipY = !(mesh.userData.textureFlipY ?? true);
    applyTextureToMesh(mesh, mesh.userData.textureUrl, mesh.userData.textureName || "Texture", nextFlipY, mesh.userData.textureRotation || 0);
  }
  syncInspector();
  updateAll();
  log(`Flipped texture orientation on ${targets.length} part${targets.length === 1 ? "" : "s"}.`);
});
els.rotateTextureBtn.addEventListener("click", () => {
  const targets = textureTargetObjects().filter(mesh => mesh.userData.textureUrl);
  if (!targets.length) {
    log("Select or check one or more textured parts before rotating texture orientation.");
    return;
  }
  recordHistory("rotate texture");
  for (const mesh of targets) {
    const nextRotation = normalizeTextureRotation((mesh.userData.textureRotation || 0) + 90);
    applyTextureToMesh(mesh, mesh.userData.textureUrl, mesh.userData.textureName || "Texture", mesh.userData.textureFlipY ?? true, nextRotation);
  }
  syncInspector();
  updateAll();
  log(`Rotated texture on ${targets.length} part${targets.length === 1 ? "" : "s"}.`);
});
els.textureFile.addEventListener("change", async event => {
  const file = event.target.files?.[0];
  const targets = textureTargetObjects();
  if (!file || !targets.length) return;
  try {
    recordHistory("add texture");
    const dataUrl = await readFileAsDataUrl(file);
    const libraryName = registerTextureAsset(file.name, dataUrl);
    refreshTextureLibraryUi();
    setTextureLibraryPanelOpen(true);
    if (libraryName && textureLibrary.has(libraryName)) els.textureLibrarySelect.value = libraryName;
    for (const mesh of targets) applyTextureToMesh(mesh, dataUrl, libraryName || file.name, true, 0);
    syncInspector();
    updateAll();
    log(`Added texture ${libraryName || file.name} to ${targets.length} part${targets.length === 1 ? "" : "s"} and stored it in the project library.`);
  } catch (error) {
    log(`Texture import failed: ${error.message}`);
  }
  event.target.value = "";
});
els.textureEditorCloseBtn.addEventListener("click", closeTextureEditor);
els.textureEditorApplyBtn.addEventListener("click", applyTextureEditorChanges);
els.textureEditorResetBtn.addEventListener("click", resetTextureEditorCanvas);
[els.textureEditorShowUv, els.textureEditorSelectedOnly].forEach(input => input.addEventListener("change", renderTextureEditor));
[els.textureEditorColor, els.textureEditorBrushSize, els.textureEditorHammerRadius].forEach(input => input.addEventListener("input", renderTextureEditor));
els.textureEditorTool.addEventListener("change", event => {
  textureEditorState.tool = event.target.value || "brush";
  syncTextureEditorCursor();
  renderTextureEditor();
});
els.textureEditorModal.addEventListener("click", event => {
  if (event.target === els.textureEditorModal) closeTextureEditor();
});
els.groupEditorCloseBtn.addEventListener("click", closeGroupEditor);
els.groupEditorCancelBtn.addEventListener("click", closeGroupEditor);
els.groupEditorSaveBtn.addEventListener("click", saveGroupEditor);
els.groupEditorModal.addEventListener("click", event => {
  if (event.target === els.groupEditorModal) closeGroupEditor();
});
els.meshDetailsCloseBtn.addEventListener("click", closeMeshDetails);
els.meshDetailsCancelBtn.addEventListener("click", closeMeshDetails);
els.meshDetailsSaveBtn.addEventListener("click", saveMeshDetails);
els.meshMaterialRuleSelect?.addEventListener("change", event => {
  renderMeshMaterialRuleInfo(event.target.value);
});
els.meshDetailsModal.addEventListener("click", event => {
  if (event.target === els.meshDetailsModal) closeMeshDetails();
});
els.textureEditorCanvas.addEventListener("pointerdown", event => {
  if (!textureEditorState.open) return;
  const point = textureEditorPointFromEvent(event);
  if (!point) return;
  textureEditorState.tool = els.textureEditorTool?.value || "brush";
  if (textureEditorState.tool === "hammer") {
    applyGlassBreakEffect(point);
    return;
  }
  textureEditorState.isPainting = true;
  textureEditorState.lastPoint = point;
  els.textureEditorCanvas.setPointerCapture?.(event.pointerId);
  textureEditorStrokeTo(point);
});
els.textureEditorCanvas.addEventListener("pointermove", event => {
  const point = textureEditorPointFromEvent(event);
  textureEditorState.hoverPoint = point;
  if (!textureEditorState.isPainting) return;
  if (!point) return;
  textureEditorStrokeTo(point);
  return;
});
els.textureEditorCanvas.addEventListener("pointermove", () => {
  if (!textureEditorState.isPainting) renderTextureEditor();
});
const finishTextureEditorStroke = pointerId => {
  textureEditorState.isPainting = false;
  textureEditorState.lastPoint = null;
  if (pointerId !== undefined) {
    try {
      els.textureEditorCanvas.releasePointerCapture?.(pointerId);
    } catch {}
  }
};
els.textureEditorCanvas.addEventListener("pointerup", event => finishTextureEditorStroke(event.pointerId));
els.textureEditorCanvas.addEventListener("pointerleave", event => {
  textureEditorState.hoverPoint = null;
  finishTextureEditorStroke(event.pointerId);
  renderTextureEditor();
});
els.importProjectFile.addEventListener("change", async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    loadProjectData(JSON.parse(await file.text()), file.name);
  } catch (error) {
    log(`Project load failed: ${error.message}`);
  }
  event.target.value = "";
});
els.importFile.addEventListener("change", async event => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    importJsonData(JSON.parse(await file.text()), file.name);
  } catch (error) {
    log(`JSON import failed: ${error.message}`);
  }
  event.target.value = "";
});
els.importObjFile.addEventListener("change", async event => {
  const files = [...(event.target.files || [])].filter(file => /\.obj$/i.test(file.name));
  if (!files.length) return;
  try {
    await importObjFiles(files);
  } catch (error) {
    log(`OBJ import failed: ${error.message}`);
  }
  event.target.value = "";
});
els.importObjFolderFile.addEventListener("change", async event => {
  const files = event.target.files;
  if (!files?.length) return;
  try {
    await importObjFiles(files);
  } catch (error) {
    log(`OBJ import failed: ${error.message}`);
  }
  event.target.value = "";
});
els.importDaeFile.addEventListener("change", async event => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    importDaeText(await file.text(), file.name);
  } catch (error) {
    log(`DAE import failed: ${error.message}`);
  }
  event.target.value = "";
});

document.querySelectorAll(".props input").forEach(input => {
  if (input === els.cutAmountInput || input === els.textureFile) return;
  input.addEventListener("input", applyInspector);
});

canvas.addEventListener("pointerdown", event => {
  const rect = renderer.domElement.getBoundingClientRect();
  lastCanvasPointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  lastCanvasPointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  if (event.button !== 0 || transform.dragging) return;
  if (transform.visible && transform.axis) {
    pendingScenePick = null;
    return;
  }
  if (spaceCameraMode) return;
  pendingScenePick = null;
  if (lineSketchMode) {
    addLineSketchPointFromEvent(event);
    return;
  }
  const hit = hitFromPointerEvent(event);
  if (dragPushMode && canStartDragPushFromHit(hit)) {
    beginDragPushSession(event);
    return;
  }
  if (openingPickMode) {
    const candidate = openingPickCandidateFromEvent(event);
    if (candidate?.mesh) {
      updateHoveredHoleLoopFromHit(candidate);
      if (hoveredHoleLoopInfo?.loop) {
        selectObject(candidate.mesh);
        const candidateKey = holeLoopKey(hoveredHoleLoopInfo.loop);
        const sameLockedLoop = selectedHoleLoopInfo?.targetId === candidate.mesh.userData.id
          && selectedHoleLoopInfo.loopKey === candidateKey;
        if (sameLockedLoop) clearSelectedHoleLoop({ announce: true });
        else setSelectedHoleLoop(candidate.mesh, hoveredHoleLoopInfo.loop, hoveredHoleLoopInfo.edgeIndex);
      } else {
        log("Could not lock that opening. Hover the rim of the visible hole and click again.");
      }
    } else {
      clearSelectedHoleLoop({ announce: true });
    }
    return;
  }
  if (facePickMode && els.areaTriInput.checked) {
    isAreaSelectingTriangles = true;
    areaSelectionStart = canvasPointFromEvent(event);
    orbit.enabled = false;
    canvas.setPointerCapture?.(event.pointerId);
    updateSelectionBox(areaSelectionStart, areaSelectionStart);
    return;
  }
  if (facePickMode && els.paintTriInput.checked && hit) {
    isPaintingTriangles = true;
    lastPaintedTriangleKey = null;
    orbit.enabled = false;
    canvas.setPointerCapture?.(event.pointerId);
    paintTriangleFromPointer(event);
    return;
  }
  if (facePickMode && hit) {
    if (coplanarFacePickMode) selectCoplanarFaceFromHit(hit, { append: event.shiftKey });
    else pickFace(hit, { append: event.shiftKey });
    return;
  }
  pendingScenePick = {
    pointerId: event.pointerId,
    startClientX: event.clientX,
    startClientY: event.clientY,
    hitObject: hit?.object || null,
    append: !!event.shiftKey,
    dragged: false
  };
});

canvas.addEventListener("pointermove", event => {
  const rect = renderer.domElement.getBoundingClientRect();
  lastCanvasPointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  lastCanvasPointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  if (lineSketchMode && !spaceCameraMode) {
    const hit = lineSketchPickFromEvent(event);
    setLineSketchCursor(hit?.point || null, hit?.normal || null);
  }
  if (openingPickMode && !spaceCameraMode && !transform.dragging) {
    updateHoveredHoleLoopFromHit(openingPickCandidateFromEvent(event));
  }
  if (pendingScenePick?.pointerId === event.pointerId && scenePickDragged(pendingScenePick, event)) {
    pendingScenePick.dragged = true;
  }
  if (updateDragPushSession(event)) return;
  if (isAreaSelectingTriangles && facePickMode && els.areaTriInput.checked && !spaceCameraMode) {
    updateSelectionBox(areaSelectionStart, canvasPointFromEvent(event));
    return;
  }
  if (!isPaintingTriangles || !facePickMode || !els.paintTriInput.checked || transform.dragging || spaceCameraMode) return;
  paintTriangleFromPointer(event);
});

window.addEventListener("pointerup", event => {
  finishDragPushSession(event.pointerId);
  finishAreaSelection(event);
  finishTrianglePainting(event.pointerId);
  if (pendingScenePick?.pointerId === event.pointerId) {
    const pick = pendingScenePick;
    pendingScenePick = null;
    if (!pick.dragged && pick.hitObject && !transform.dragging && !spaceCameraMode) {
      selectObject(pick.hitObject, { append: pick.append });
    }
  }
});

canvas.addEventListener("dblclick", event => {
  if (lineSketchMode) {
    event.preventDefault();
    closeLineSketch();
    return;
  }
  if (transform.dragging || spaceCameraMode) return;
  if (!facePickMode) {
    event.preventDefault();
    pendingScenePick = null;
    clearCurrentSelection();
    return;
  }
  const hit = hitFromPointerEvent(event);
  if (!hit) return;
  event.preventDefault();
  selectConnectedTrianglesFromHit(hit, { append: event.shiftKey });
});

window.addEventListener("keydown", event => {
  if (event.key === "Shift") isShiftHeld = true;
  if (textureEditorState.open && event.key === "Escape") {
    event.preventDefault();
    closeTextureEditor();
    return;
  }
  if (event.code === "Space" && !event.target.matches("input, textarea")) {
    event.preventDefault();
    if (!spaceCameraMode) {
      finishDragPushSession();
      spaceCameraMode = true;
      pendingScenePick = null;
      if (isAreaSelectingTriangles) {
        isAreaSelectingTriangles = false;
        areaSelectionStart = null;
        hideSelectionBox();
      }
      finishTrianglePainting();
      orbit.enabled = true;
      els.hudText.textContent = "Camera orbit override: release Space to return to triangle selection";
    }
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
    if (event.target.matches("textarea")) return;
    event.preventDefault();
    undo();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c") {
    if (event.target.matches("input, textarea")) return;
    event.preventDefault();
    copySelectedTriangles();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v") {
    if (event.target.matches("input, textarea")) return;
    event.preventDefault();
    pasteCopiedTriangles();
    return;
  }
  if (event.target.matches("input, textarea")) return;
  if (event.key === "Delete" || event.key === "Backspace") {
    if (selectedFaces.length) deleteSelectedTriangles();
    else deleteSelection();
  }
  if (event.key.toLowerCase() === "w") setTransformMode("translate");
  if (event.key.toLowerCase() === "e") setTransformMode("rotate");
  if (event.key.toLowerCase() === "r") setTransformMode("scale");
});

window.addEventListener("keyup", event => {
  if (event.key === "Shift") isShiftHeld = false;
  if (event.code !== "Space") return;
  spaceCameraMode = false;
  if (facePickMode) {
    setFacePickMode(true);
  }
});
window.addEventListener("blur", () => {
  isShiftHeld = false;
  finishDragPushSession();
  finishScaleDragSession();
});
window.addEventListener("resize", () => {
  if (textureEditorState.open) renderTextureEditor();
});

window.ModelerStudio = {
  state,
  viewportState: () => ({
    environment: els.environmentSelect?.value || "plain",
    background: els.backgroundSelect?.value || "plain",
    photoEnvironmentVisible: photoEnvironment.visible,
    gridVisible: grid.visible,
    gridLabelsVisible: gridLabelGroup.visible,
    showGridChecked: !!els.showGridInput?.checked,
    rendererSize: [renderer.domElement.width, renderer.domElement.height]
  }),
  captureView,
  captureViews,
  saveQaSheet,
  exportObjParts,
  frameSelected,
  addMarkerFromSelectedTriangle,
  removeMarkersForSelection,
  clearTriangleSelection,
  deleteSelectedTriangles,
  extractSelectedTriangles,
  selectTrianglesInScreenRect,
  selectConnectedTrianglesFromHit,
  copySelectedTriangles,
  pasteCopiedTriangles,
  fillSelectedHole,
  flipSelectedParts,
  extendSelectedFaces,
  pullSelectedFaces,
  pushSelectedFaces,
  selectedTriangles: () => selectedFaces.map(face => ({
    targetId: face.mesh.userData.id,
    targetName: face.mesh.name,
    faceIndex: face.faceIndex,
    point: worldFacePoint(face).toArray().map(round),
    normal: worldFaceNormal(face).toArray().map(round),
    triangle: worldTrianglePoints(face).map(point => point.toArray().map(round))
  })),
  markers: () => markerHelpers.map(marker => {
    redrawMarker(marker);
    return { name: marker.name, ...marker.userData };
  }),
  proceduralTemplates: () => listProceduralTemplates(),
  proceduralTemplateCatalog: () => JSON.parse(JSON.stringify(proceduralCatalog)),
  buildProceduralAssembly,
  addProceduralAssembly,
  importJsonData,
  importObjFiles,
  importDaeText
};

applyToolbarVisibility(setToolbarToggleState(defaultToolbarVisibility));
syncGridVisibility();
buildGridLabels();
updateGridLabels();
syncSpotLightRig();
updateUndoButton();
selectObject(null);
frameSelected();
detectLocalHost().then(async localHost => {
  const loaded = localHost ? await tryLoadPendingProjectFromHost() : false;
  log(loaded
    ? "Ready. Loaded project from the installed app host."
    : localHost
      ? "Ready. Blank scene loaded from the local app host."
      : "Ready. Blank scene loaded.");
});
animate();
