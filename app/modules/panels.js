function sortSurfaceEditorToolsAlphabetically() {
  const body = document.querySelector("#surfaceEditorBody");
  if (!body) return;
  const sections = Array.from(body.children).filter(child => child.matches("details.surface-bevel-details"));
  const notes = Array.from(body.children).filter(child => child.matches("p.api-note"));
  const insertionPoint = notes[notes.length - 1] || null;
  sections
    .sort((left, right) => {
      const leftLabel = left.querySelector(":scope > summary")?.textContent?.trim() || "";
      const rightLabel = right.querySelector(":scope > summary")?.textContent?.trim() || "";
      return leftLabel.localeCompare(rightLabel, "en", { sensitivity: "base" });
    })
    .forEach(section => body.insertBefore(section, insertionPoint));
}

sortSurfaceEditorToolsAlphabetically();

function gameplayPreviewVisible() {
  return !!(els.gameplayPreview && !els.gameplayPreview.hidden && gameplayRenderer);
}

function resetGameplayPreviewCamera() {
  if (!gameplayRenderer) return;
  gameplayCamera.position.copy(camera.position);
  const direction = orbit.target.clone().sub(camera.position).normalize();
  gameplayYaw = Math.atan2(-direction.x, -direction.z);
  gameplayPitch = Math.asin(THREE.MathUtils.clamp(direction.y, -1, 1));
  gameplayCamera.rotation.set(gameplayPitch, gameplayYaw, 0, "YXZ");
  gameplayCamera.near = camera.near;
  gameplayCamera.far = camera.far;
  gameplayCamera.updateProjectionMatrix();
}

function updateGameplayHint() {
  if (!els.gameplayHintText) return;
  const speedLabel = `${gameplaySpeedMultiplier.toFixed(2).replace(/\.?0+$/, "") || "1"}x`;
  els.gameplayHintText.textContent =
    `Click view · WASD move · E/Q or Space/Shift up-down · Scroll: speed ${speedLabel} · mouse look · Esc releases mouse`;
}

function openGameplayPreview() {
  if (!els.gameplayPreview || !gameplayRenderer) return false;
  els.gameplayPreview.hidden = false;
  gameplayKeys.clear();
  gameplaySpeedMultiplier = 1;
  resetGameplayPreviewCamera();
  gameplayLastFrame = performance.now();
  resizeGameplayPreview();
  updateGameplayHint();
  log("Opened Gameplay Preview. Click the player screen for mouse look; use WASD to move, E/Q or Space/Shift for up/down, and scroll to adjust speed.");
  return true;
}

function closeGameplayPreview() {
  if (!els.gameplayPreview) return false;
  if (document.pointerLockElement === gameplayCanvas) document.exitPointerLock?.();
  els.gameplayPreview.hidden = true;
  gameplayKeys.clear();
  log("Closed Gameplay Preview and returned to the editor camera.");
  return true;
}

function resizeGameplayPreview() {
  if (!gameplayPreviewVisible()) return;
  const rect = gameplayCanvas.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return;
  gameplayRenderer.setSize(rect.width, rect.height, false);
  gameplayCamera.aspect = rect.width / rect.height;
  gameplayCamera.updateProjectionMatrix();
}

function updateGameplayPreview(deltaSeconds) {
  if (!gameplayPreviewVisible()) return;
  gameplayCamera.rotation.set(gameplayPitch, gameplayYaw, 0, "YXZ");
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(gameplayCamera.quaternion);
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(gameplayCamera.quaternion);
  forward.y = 0;
  right.y = 0;
  if (forward.lengthSq()) forward.normalize();
  if (right.lengthSq()) right.normalize();
  const movement = new THREE.Vector3();
  if (gameplayKeys.has("KeyW")) movement.add(forward);
  if (gameplayKeys.has("KeyS")) movement.sub(forward);
  if (gameplayKeys.has("KeyD")) movement.add(right);
  if (gameplayKeys.has("KeyA")) movement.sub(right);
  if (gameplayKeys.has("Space") || gameplayKeys.has("KeyE")) movement.y += 1;
  if (gameplayKeys.has("ShiftLeft") || gameplayKeys.has("ShiftRight") || gameplayKeys.has("KeyQ")) movement.y -= 1;
  if (movement.lengthSq()) {
    const worldSize = sceneBounds().getSize(new THREE.Vector3()).length();
    const speed = Math.max(.75, worldSize * .22) * gameplaySpeedMultiplier;
    gameplayCamera.position.addScaledVector(movement.normalize(), speed * deltaSeconds);
  }
}

function renderGameplayPreview() {
  if (!gameplayPreviewVisible()) return;
  const helpers = [
    transform,
    surfaceTransform,
    surfaceFrontTransform,
    surfaceSideTransform,
    faceMarker,
    selectionOutlineGroup,
    openingPickGuideGroup,
    markerGroup,
    cameraDirectorGroup,
    lineSketchCursor
  ].filter(Boolean);
  const visibility = helpers.map(helper => helper.visible);
  helpers.forEach(helper => { helper.visible = false; });
  gameplayRenderer.render(scene, gameplayCamera);
  helpers.forEach((helper, index) => { helper.visible = visibility[index]; });
}

function resize() {
  const rect = canvas.parentElement.getBoundingClientRect();
  renderer.setSize(rect.width, rect.height, false);
  camera.aspect = rect.width / Math.max(1, rect.height);
  camera.updateProjectionMatrix();
  resizeReferenceRenderer(frontBoneRenderer, frontBoneCamera, frontBoneCanvas, "front");
  resizeReferenceRenderer(sideBoneRenderer, sideBoneCamera, sideBoneCanvas, "side");
  resizeGameplayPreview();
}

const flat2dOriginalMaterials = new Map();

function flat2dMaterial(source) {
  if (!source) return source;
  const material = new THREE.MeshBasicMaterial({
    color: source.color?.clone?.() || new THREE.Color(0xffffff),
    map: source.map || null,
    alphaMap: source.alphaMap || null,
    transparent: !!source.transparent,
    opacity: source.opacity ?? 1,
    alphaTest: source.alphaTest ?? 0,
    side: source.side,
    depthTest: source.depthTest,
    depthWrite: source.depthWrite,
    vertexColors: !!source.vertexColors,
    wireframe: !!source.wireframe,
    toneMapped: false
  });
  material.name = `${source.name || "Material"} · Flat 2D`;
  material.userData = { ...(source.userData || {}), flat2dPreview: true };
  return material;
}

function syncFlat2dLook() {
  const enabled = !!els.flat2dLookInput?.checked;
  for (const object of objects) {
    if (!object?.isMesh) continue;
    if (enabled && !flat2dOriginalMaterials.has(object)) {
      flat2dOriginalMaterials.set(object, {
        material: object.material,
        castShadow: object.castShadow,
        receiveShadow: object.receiveShadow
      });
      object.material = Array.isArray(object.material)
        ? object.material.map(flat2dMaterial)
        : flat2dMaterial(object.material);
    } else if (enabled && flat2dOriginalMaterials.has(object)) {
      const saved = flat2dOriginalMaterials.get(object);
      const original = saved.material;
      const originals = Array.isArray(original) ? original : [original];
      const flats = Array.isArray(object.material) ? object.material : [object.material];
      if (!flats.every(material => material?.userData?.flat2dPreview)) {
        saved.material = object.material;
        object.material = Array.isArray(object.material)
          ? object.material.map(flat2dMaterial)
          : flat2dMaterial(object.material);
      } else {
        flats.forEach((material, index) => {
          const source = originals[index] || originals[0];
          if (!source) return;
          // Inspector and texture-editor changes are applied to the live flat
          // material. Mirror those shared properties back to the saved 3D
          // material so toggling this preview never loses an edit.
          source.map = material.map || null;
          source.alphaMap = material.alphaMap || null;
          if (source.color && material.color) source.color.copy(material.color);
          source.transparent = !!material.transparent;
          source.opacity = material.opacity ?? 1;
          source.alphaTest = material.alphaTest ?? 0;
          source.needsUpdate = true;
        });
      }
    } else if (!enabled && flat2dOriginalMaterials.has(object)) {
      const flatMaterial = object.material;
      const original = flat2dOriginalMaterials.get(object);
      object.material = original.material;
      object.castShadow = original.castShadow;
      object.receiveShadow = original.receiveShadow;
      flat2dOriginalMaterials.delete(object);
      (Array.isArray(flatMaterial) ? flatMaterial : [flatMaterial]).forEach(material => material?.dispose?.());
    }
    if (enabled) {
      object.castShadow = false;
      object.receiveShadow = false;
    }
  }
  renderer.shadowMap.enabled = !enabled;
}

function setFlat2dLook(enabled, { quiet = false } = {}) {
  if (els.flat2dLookInput) els.flat2dLookInput.checked = !!enabled;
  if (els.modelTileFlat2dLookInput) els.modelTileFlat2dLookInput.checked = !!enabled;
  syncFlat2dLook();
  if (!quiet) log(enabled
    ? "Flat 2D Look enabled. Textures now render without lighting or shadows, including animation exports."
    : "Flat 2D Look disabled. Normal 3D lighting and shadows restored.");
}

function animate() {
  requestAnimationFrame(animate);
  const frameTime = performance.now();
  const gameplayDelta = Math.min(.05, Math.max(0, (frameTime - gameplayLastFrame) / 1000));
  gameplayLastFrame = frameTime;
  updateAnimation(gameplayDelta);
  resize();
  syncFlat2dLook();
  syncLiveMirrorPreview();
  boneGridAxisGroup.visible = !!els.showGridInput?.checked;
  syncActiveJointCamera();
  orbit.update();
  syncCameraDirectorVisibility();
  syncSelectionOutlineTransforms();
  if (lineSketchMode && lineSketchPoints.length) updateLineSketchGuide();
  if (lineSketchMode && lineSketchHover?.point) {
    const radius = Math.max(.025, Math.min(.12, camera.position.distanceTo(lineSketchHover.point) * .012));
    lineSketchCursor.scale.setScalar(radius);
  }
  surfaceFrontTransform.visible = false;
  surfaceSideTransform.visible = false;
  renderer.render(scene, camera);
  const mainBackground = scene.background;
  const mainFog = scene.fog;
  scene.background = studioBackground;
  scene.fog = null;
  const surfaceTransformWasVisible = surfaceTransform.visible;
  surfaceTransform.visible = false;
  surfaceFrontTransform.visible = surfaceTransformWasVisible;
  frontBoneRenderer.render(scene, frontBoneCamera);
  surfaceFrontTransform.visible = false;
  surfaceSideTransform.visible = surfaceTransformWasVisible;
  sideBoneRenderer.render(scene, sideBoneCamera);
  surfaceFrontTransform.visible = surfaceTransformWasVisible;
  surfaceSideTransform.visible = surfaceTransformWasVisible;
  surfaceTransform.visible = surfaceTransformWasVisible;
  scene.background = mainBackground;
  scene.fog = mainFog;
  updateGameplayPreview(gameplayDelta);
  renderGameplayPreview();
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
  btn.addEventListener("click", () => addObject({ shape: btn.dataset.add }, { select: true }));
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
  els.toggleToolbarScene,
  els.toggleToolbarProjectFiles
].filter(Boolean).forEach(input => input.addEventListener("change", () => {
  applyToolbarVisibility();
  updateTransformAttachment();
}));
els.rotationSnapSelect.addEventListener("change", applyRotationSnap);

document.querySelector("#duplicateBtn").addEventListener("click", duplicateSelected);
els.goToSelectedMeshBtn?.addEventListener("click", goToSelectedMesh);
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
initializeMinecraftTools();
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
els.boneModeMoveBtn?.addEventListener("click", () => setBoneGizmoToolMode("translate"));
els.boneModeRotateBtn?.addEventListener("click", () => setBoneGizmoToolMode("rotate"));
els.glueBoneBtn?.addEventListener("click", () => toggleGlueBones());
// boneList is now a row-based list; selection happens per-row in syncBonePanel.
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
function finishReferenceSurfaceDrag(event) {
  if (!surfaceGizmoDragging) return;
  const draggingControl = [surfaceFrontTransform, surfaceSideTransform].find(control => control.dragging);
  if (draggingControl) draggingControl.pointerUp(event);
}
window.addEventListener("pointerup", finishReferenceSurfaceDrag);
window.addEventListener("pointercancel", finishReferenceSurfaceDrag);
restoreBoneRig({ bones: [], showGuides: true });
els.animationPlayBtn?.addEventListener("click", () => {
  if (!animationHasKeys()) { animationState.playing = false; updateAnimationPanel(); log("Add at least one keyed pose before playing the animation."); return; }
  animationState.playing = !animationState.playing; animationState.lastTime = 0; updateAnimationPanel();
});
els.animationStopBtn?.addEventListener("click", () => { if (typeof cancelMinecraftAnimationSequencePreview === "function") cancelMinecraftAnimationSequencePreview(); animationState.playing = false; animationSetFrame(0); });
els.animationPrevBtn?.addEventListener("click", () => animationSetFrame(animationState.frame - 1));
els.animationNextBtn?.addEventListener("click", () => animationSetFrame(animationState.frame + 1));
els.animationResetBtn?.addEventListener("click", () => { animationState.playing = false; animationSetFrame(0); });
els.animationClipSelect?.addEventListener("change", event => setActiveAnimationClip(event.target.value));
els.animationClipAddBtn?.addEventListener("click", addAnimationClip);
els.animationClipDeleteBtn?.addEventListener("click", deleteActiveAnimationClip);
els.animationScrubber?.addEventListener("input", event => animationSetFrame(event.target.value));
els.animationKeyBtn?.addEventListener("click", keyAnimationPose);
els.animationDeleteFrameBtn?.addEventListener("click", deleteAnimationFrameKeys);
els.animationClearBtn?.addEventListener("click", () => { restoreAnimationBindPose(); animationState.keys = {}; syncActiveAnimationClip(); animationState.frame = 0; animationState.playing = false; updateAnimationPanel(); });
els.animationExportBtn?.addEventListener("click", exportAnimationJson);
els.animationSheetExportBtn?.addEventListener("click", async () => saveAnimationMotionSheets({
  view: els.animationSheetViewSelect?.value || "left",
  frameCount: Number(els.animationSheetFramesInput?.value) || 8,
  range: els.animationExportRangeSelect?.value || "end"
}));
els.animationWebmExportBtn?.addEventListener("click", async () => {
  try { await exportAnimationWebm({ view: els.animationSheetViewSelect?.value || "left", range: els.animationExportRangeSelect?.value || "end", durationSeconds: Number(els.animationVideoDurationInput?.value) || 6, qualityScale: Number(els.animationVideoQualitySelect?.value) || 1.5, useSequence: !!els.animationUseSequenceInput?.checked, endOnLastClip: els.animationVideoLengthModeSelect?.value === "clips" }); }
  catch (error) { log(error?.message || "WebM export failed."); }
});
els.animationMp4ExportBtn?.addEventListener("click", async () => {
  try { await exportAnimationMp4({ view: els.animationSheetViewSelect?.value || "left", range: els.animationExportRangeSelect?.value || "end", durationSeconds: Number(els.animationVideoDurationInput?.value) || 6, qualityScale: Number(els.animationVideoQualitySelect?.value) || 1.5, useSequence: !!els.animationUseSequenceInput?.checked, endOnLastClip: els.animationVideoLengthModeSelect?.value === "clips" }); }
  catch (error) { log(error?.message || "MP4 export failed."); }
});
els.referenceViewportsToggleBtn?.addEventListener("click", () => setReferenceViewportsCollapsed(!referenceViewportsCollapsed));
els.animationFpsInput?.addEventListener("change", event => { animationState.fps = Math.max(1, Math.min(120, Number(event.target.value) || 24)); syncActiveAnimationClip(); updateAnimationPanel(); });
els.animationEndInput?.addEventListener("change", event => { animationState.end = Math.max(1, Math.min(9999, Number(event.target.value) || 48)); animationState.frame = Math.min(animationState.frame, animationState.end); syncActiveAnimationClip(); updateAnimationPanel(); });
els.animationVideoLengthModeSelect?.addEventListener("change", () => { if (els.animationVideoDurationInput) els.animationVideoDurationInput.disabled = els.animationVideoLengthModeSelect.value === "clips"; });
updateAnimationPanel();
document.querySelector("#groupBtn").addEventListener("click", groupCheckedParts);
document.querySelector("#ungroupBtn").addEventListener("click", ungroupParts);
document.querySelector("#mergeMeshBtn").addEventListener("click", async () => mergeCheckedMeshes());
els.pivotBtn.addEventListener("click", () => setPivotEditMode(!pivotEditMode));
els.centerPivotBtn.addEventListener("click", centerSharedPivot);
document.querySelector("#facePickBtn").addEventListener("click", toggleClassicTriangleSelection);
els.faceRegionBtn.addEventListener("click", toggleClassicFaceSelection);
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
els.deleteSelectedSurfaceBtn?.addEventListener("click", deleteSelectedTriangles);
document.querySelector("#extractTriBtn").addEventListener("click", extractSelectedTriangles);
document.querySelector("#fillHoleBtn").addEventListener("click", fillSelectedHole);
document.querySelector("#bridgeMeshesBtn").addEventListener("click", bridgeCheckedMeshes);
els.loftCheckedBtn?.addEventListener("click", loftCheckedProfiles);
els.mirrorCopyBtn?.addEventListener("click", mirrorCopySelection);
els.liveMirrorBtn?.addEventListener("click", toggleLiveMirror);
els.applyLiveMirrorBtn?.addEventListener("click", applyLiveMirrorSelection);
els.symmetryAxisSelect?.addEventListener("change", updateLiveMirrorSettings);
els.symmetryPlaneInput?.addEventListener("change", updateLiveMirrorSettings);

const modelToolGroupIds = [
  "toolbarShapeBuilderGroup",
  "toolbarSelectionToolsGroup",
  "toolbarLineToolsGroup",
  "toolbarMarkerToolsGroup",
  "toolbarTriEditorGroup",
  "toolbarMiscToolsGroup"
];
const rightDock = els.inspectorSection?.parentElement;
if (rightDock && els.utilitiesSection) {
  for (const section of [els.modelToolsWindow, els.surfaceEditorWindow, els.outputToolsWindow]) {
    if (section) rightDock.insertBefore(section, els.utilitiesSection);
  }
}
for (const groupId of modelToolGroupIds) {
  const group = document.querySelector(`#${groupId}`);
  if (group && els.modelToolsBody) els.modelToolsBody.append(group);
}

for (const groupId of ["toolbarViewsGroup", "toolbarImportExportGroup"]) {
  const group = document.querySelector(`#${groupId}`);
  if (group && els.outputToolsBody) els.outputToolsBody.append(group);
}

function setModelToolsOpen(open = true) {
  if (!els.modelToolsWindow) return;
  setSectionCollapsed(els.modelToolsWindow, els.modelToolsCloseBtn, !open);
  els.modelToolsOpenBtn?.classList.remove("active");
  if (open) requestAnimationFrame(() => els.modelToolsWindow.scrollIntoView({ behavior: "smooth", block: "start" }));
}

function setOutputToolsOpen(open = true) {
  if (!els.outputToolsWindow) return;
  setSectionCollapsed(els.outputToolsWindow, els.outputToolsCloseBtn, !open);
  els.outputToolsOpenBtn?.classList.remove("active");
  if (open) requestAnimationFrame(() => els.outputToolsWindow.scrollIntoView({ behavior: "smooth", block: "start" }));
}

function setCameraControlsOpen(open = true) {
  if (!els.cameraViewsSection) return;
  if (open) {
    if (document.body.classList.contains("animator-workspace-active") && typeof setAnimatorWorkspace === "function") setAnimatorWorkspace(false);
    setSectionCollapsed(els.utilitiesSection, els.utilitiesToggle, false);
    setSectionCollapsed(els.cameraViewsSection, els.cameraViewsToggle, false);
  }
  els.cameraControlsOpenBtn?.classList.remove("active");
  if (open) requestAnimationFrame(() => els.cameraViewsSection.scrollIntoView({ behavior: "smooth", block: "start" }));
}

els.modelToolsOpenBtn?.addEventListener("click", () => setModelToolsOpen(true));
els.modelToolsCloseBtn?.addEventListener("click", () => requestAnimationFrame(() => {
  els.modelToolsOpenBtn?.classList.remove("active");
}));
els.outputToolsOpenBtn?.addEventListener("click", () => setOutputToolsOpen(true));
els.outputToolsCloseBtn?.addEventListener("click", () => requestAnimationFrame(() => {
  els.outputToolsOpenBtn?.classList.remove("active");
}));
els.cameraControlsOpenBtn?.addEventListener("click", () => setCameraControlsOpen(true));
els.modelToolsOpenBtn?.classList.remove("active");
els.outputToolsOpenBtn?.classList.remove("active");
els.cameraControlsOpenBtn?.classList.remove("active");
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
els.insetFaceBtn?.addEventListener("click", insetSelectedFace);
els.extrudeRegionBtn?.addEventListener("click", extrudeSelectedRegion);
document.querySelector("#pullFaceBtn").addEventListener("click", pullSelectedFaces);
els.pullToTargetBtn?.addEventListener("click", togglePullToTargetSession);
document.querySelector("#pushFaceBtn").addEventListener("click", pushSelectedFaces);
els.softPullBtn?.addEventListener("click", () => softMoveSelectedFaces(1));
els.softPushBtn?.addEventListener("click", () => softMoveSelectedFaces(-1));
els.dragPushBtn.addEventListener("click", () => setDragPushMode(!dragPushMode));
els.surfaceEditorOpenBtn?.addEventListener("click", () => setSurfaceEditorOpen(true));
els.surfaceEditorCloseBtn?.addEventListener("click", () => requestAnimationFrame(() => {
  syncSurfaceEditorUi();
  updateSurfaceGizmoAttachment();
  updateModelingEdgesOverlay();
}));
els.surfaceSelectTriangleBtn?.addEventListener("click", () => setSurfaceSelectionMode("triangle"));
els.surfaceSelectFaceBtn?.addEventListener("click", () => setSurfaceSelectionMode("face"));
els.surfaceSelectVertexBtn?.addEventListener("click", () => setSurfaceSelectionMode("vertex"));
els.surfaceSelectEdgeBtn?.addEventListener("click", () => setSurfaceSelectionMode("edge"));
els.surfaceMouseModeBtn?.addEventListener("click", toggleSurfaceMouseMode);
els.surfaceValueModeBtn?.addEventListener("click", toggleSurfaceValueMode);
els.autoSurfaceDragInput?.addEventListener("change", () => {
  if (els.autoSurfaceDragInput.checked) armContextualSurfaceDrag();
  else if (dragPushMode) setDragPushMode(false, { silent: true });
  syncSurfaceEditorUi();
});
els.showModelingEdgesInput?.addEventListener("change", () => {
  updateModelingEdgesOverlay();
  log(`Modeling edge overlay ${els.showModelingEdgesInput.checked ? "enabled" : "disabled"}.`);
});
[els.dragPushAxisSelect, els.dragPushStepInput, els.softRadiusInput, els.surfaceMouseFalloffSelect].forEach(input => input?.addEventListener("input", () => {
  updateSurfaceGizmoAttachment();
  if (!dragPushMode) return;
  const shape = els.surfaceMouseFalloffSelect?.value === "soft"
    ? `soft falloff radius ${round(Math.max(.01, Number(els.softRadiusInput?.value) || .25))}`
    : "hard face";
  els.hudText.textContent = `Surface drag ready: ${shape} along ${dragPushAxisLabel()} in snapped ${dragPushStepSize()} steps`;
}));
syncSurfaceEditorUi();
document.querySelector("#bevelFaceBtn").addEventListener("click", bevelSelectedFace);
els.edgeBevelBtn?.addEventListener("click", bevelSelectedEdge);
els.cornerBevelBtn?.addEventListener("click", bevelSelectedCorner);
els.cornerBevelModeSelect?.addEventListener("change", syncSurfaceEditorUi);
els.cornerBevelWidthInput?.addEventListener("input", () => {
  if (els.cornerBevelWidthRange) els.cornerBevelWidthRange.value = els.cornerBevelWidthInput.value;
});
els.cornerBevelWidthRange?.addEventListener("input", () => {
  if (els.cornerBevelWidthInput) els.cornerBevelWidthInput.value = els.cornerBevelWidthRange.value;
});
els.subdivideSelectedBtn?.addEventListener("click", subdivideSelectedSurface);
els.loopCutBtn?.addEventListener("click", applyLoopCut);
els.knifeCutModeBtn?.addEventListener("click", () => setKnifeCutMode(!knifeCutMode));
els.knifeCutCancelBtn?.addEventListener("click", () => cancelKnifeCutStroke());
els.planeCutBtn?.addEventListener("click", applyPlaneCut);
els.bridgeEdgeLoopsBtn?.addEventListener("click", bridgeSelectedEdgeLoops);
els.recalculateNormalsBtn?.addEventListener("click", recalculateSelectedMeshNormals);
els.flipNormalsBtn?.addEventListener("click", flipSelectedFaceNormals);
els.findHolesBtn?.addEventListener("click", () => findSelectedMeshHoles());
els.previousHoleBtn?.addEventListener("click", () => cycleSelectedHole(-1));
els.nextHoleBtn?.addEventListener("click", () => cycleSelectedHole(1));
els.frameHoleBtn?.addEventListener("click", frameSelectedHole);
els.repairSelectedHoleBtn?.addEventListener("click", () => repairFoundHoles({ all: false }));
els.repairAllHolesBtn?.addEventListener("click", () => repairFoundHoles({ all: true }));
els.checkNonManifoldBtn?.addEventListener("click", () => checkSelectedMeshIntegrity());
els.previousMeshIssueBtn?.addEventListener("click", () => cycleMeshIntegrityIssue(-1));
els.nextMeshIssueBtn?.addEventListener("click", () => cycleMeshIntegrityIssue(1));
els.frameMeshIssueBtn?.addEventListener("click", frameMeshIntegrityIssue);
els.clearMeshIssuesBtn?.addEventListener("click", () => clearMeshIntegrityReport({ announce: true }));
els.analyzeDoublesBtn?.addEventListener("click", () => analyzeSelectedMeshDoubles());
els.removeDoublesBtn?.addEventListener("click", removeAnalyzedDoubles);
els.removeDoublesToleranceInput?.addEventListener("input", () => invalidateRemoveDoublesAnalysis());
els.calculateMeshStatisticsBtn?.addEventListener("click", () => calculateSelectedMeshStatistics());
els.copyMeshStatisticsBtn?.addEventListener("click", copyMeshStatisticsReport);
els.analyzeDecimateBtn?.addEventListener("click", () => analyzeSelectedMeshDecimation());
els.applyDecimateBtn?.addEventListener("click", applyAnalyzedDecimation);
for (const input of [
  els.decimateReductionInput,
  els.decimateFeatureAngleInput,
  els.decimatePreserveBoundariesInput,
  els.decimatePreserveUvSeamsInput,
  els.decimatePreserveMaterialsInput
]) input?.addEventListener("input", invalidateDecimateAnalysis);
els.analyzeLodGeneratorBtn?.addEventListener("click", () => analyzeSelectedMeshLodSet());
els.generateLodGeneratorBtn?.addEventListener("click", generateAnalyzedLodSet);
for (const input of [
  els.lod1ReductionInput,
  els.lod2ReductionInput,
  els.lod3ReductionInput,
  els.lodFeatureAngleInput,
  els.lodPreserveBoundariesInput,
  els.lodPreserveUvSeamsInput,
  els.lodPreserveMaterialsInput,
  els.lodHideGeneratedInput
]) input?.addEventListener("input", invalidateLodGeneratorAnalysis);
els.analyzeUvUnwrapBtn?.addEventListener("click", () => analyzeSelectedMeshUvLayout());
els.applyUvUnwrapBtn?.addEventListener("click", applyAnalyzedUvUnwrap);
els.bakeTextureAtlasBtn?.addEventListener("click", bakeAnalyzedTextureAtlas);
els.exportUvPngBtn?.addEventListener("click", exportSelectedUvPngs);
els.uvPngExportSelect?.addEventListener("change", () => syncUvUnwrapUi());
els.modelTileRotateBtn?.addEventListener("click", rotateModelTileFacing);
els.modelTileExportBtn?.addEventListener("click", exportModelTileKit);
els.gameAssetSaveBtn?.addEventListener("click", saveGameAssetMetadata);
els.gameAssetExportBtn?.addEventListener("click", exportCharacterPackage);
els.gameAssetHumanoidRigBtn?.addEventListener("click", createHumanoidTestRig);
els.addColorToSceneBtn?.addEventListener("click", () => {
  if (!selected) return;
  selected.userData.colorApplied = true;
  applyInspector({ record: true });
  els.addColorToSceneBtn.textContent = "Color Added to Scene";
});
els.modelTileCenterBtn?.addEventListener("click", centerModelTileToEditor);
els.modelTileCameraLockBtn?.addEventListener("click", toggleModelTileCameraLock);
els.modelTileNeighbourPreviewInput?.addEventListener("change", event => setModelTileNeighbourPreview(event.target.checked));
els.modelTileNeighbourOpacityInput?.addEventListener("input", () => {
  if (els.modelTileNeighbourPreviewInput?.checked) setModelTileNeighbourPreview(true, { silent: true });
  else syncModelTileNeighbourOpacityUi();
});
els.modelTileTextureRepeatBtn?.addEventListener("click", applyModelTileContinuousTexture);
els.modelTileTextureResetBtn?.addEventListener("click", resetModelTileContinuousTexture);
for (const input of [els.modelTileCameraAzimuthInput, els.modelTileCameraElevationInput, els.modelTileCameraDistanceInput, els.modelTileCameraTargetYInput]) {
  input?.addEventListener("input", () => {
    if (!modelTileCameraLocked) return;
    const profile = applyModelTileCameraLock();
    if (els.modelTileStatus) els.modelTileStatus.textContent = `Camera updated: azimuth ${profile.azimuth}°, elevation ${profile.elevation}°, distance ${profile.distance}.`;
  });
}
for (const input of [
  els.uvUnwrapSeamAngleInput,
  els.uvUnwrapPaddingInput,
  els.uvAtlasSizeSelect
]) input?.addEventListener("input", invalidateUvUnwrapAnalysis);
els.rotateSelectedUvLeftBtn?.addEventListener("click", () => transformSelectedSurfaceUvs({ rotation: 90 }));
els.rotateSelectedUvRightBtn?.addEventListener("click", () => transformSelectedSurfaceUvs({ rotation: -90 }));
els.flipSelectedUvUBtn?.addEventListener("click", () => transformSelectedSurfaceUvs({ flipU: true }));
els.flipSelectedUvVBtn?.addEventListener("click", () => transformSelectedSurfaceUvs({ flipV: true }));
els.planeCutResultSelect?.addEventListener("change", () => {
  if (els.planeCutCapInput) els.planeCutCapInput.disabled = els.planeCutResultSelect.value === "both";
});
els.edgeSlideBtn?.addEventListener("click", slideSelectedEdges);
els.surfaceScaleBtn?.addEventListener("click", scaleSelectedSurface);
els.relaxVerticesBtn?.addEventListener("click", relaxSelectedVertices);
els.weldVerticesBtn?.addEventListener("click", weldSelectedVertices);
els.dissolveSelectedBtn?.addEventListener("click", dissolveSelectedSurfaceComponent);
els.cutMeshBtn.addEventListener("click", cutSelectedMesh);
document.querySelector("#clearBtn").addEventListener("click", clearObjects);
document.querySelector("#frameBtn").addEventListener("click", frameSelected);
els.resetZoomBtn.addEventListener("click", () => {
  frameSelected();
  log("Viewer zoom reset by framing the current model.");
});
els.modelTileSnapBtn?.addEventListener("click", snapSelectionToGridSurface);
els.flat2dLookInput?.addEventListener("change", event => setFlat2dLook(event.target.checked));
els.modelTileFlat2dLookInput?.addEventListener("change", event => setFlat2dLook(event.target.checked));
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
els.previewIsoBtn.addEventListener("click", previewIsoOrReference);
els.addCustomCameraBtn.addEventListener("click", addCustomCameraView);
els.addPlayerCameraBtn.addEventListener("click", addPlayerCameraOnSelectedJoint);
els.viewCustomCameraBtn.addEventListener("click", () => activateCustomCameraView());
els.detachCustomCameraBtn.addEventListener("click", () => detachCustomCameraView({ showPlayer: true }));
els.updateCustomCameraBtn.addEventListener("click", updateCustomCameraFromCurrentView);
els.deleteCustomCameraBtn.addEventListener("click", deleteCustomCameraView);
els.customCameraList.addEventListener("change", () => selectCustomCameraView(els.customCameraList.value));
els.customCameraList.addEventListener("dblclick", () => activateCustomCameraView(els.customCameraList.value));
const activeCustomCameraEdits = new WeakSet();
customCameraInputs().forEach(input => {
  input.addEventListener("input", () => {
    if (!activeCustomCameraEdits.has(input)) {
      recordHistory("edit camera director");
      activeCustomCameraEdits.add(input);
    }
    updateCustomCameraFromInputs({
      record: false,
      render: false,
      refreshMarkers: input !== els.customCameraNameInput
    });
  });
  input.addEventListener("blur", () => {
    activeCustomCameraEdits.delete(input);
    renderCustomCameraViews();
  });
});
els.showCustomCamerasInput.addEventListener("change", () => {
  renderCustomCameraMarkers();
  log(`${els.showCustomCamerasInput.checked ? "Showing" : "Hiding"} camera directors in the viewport.`);
});
els.exportGameCopyBtn.addEventListener("click", saveGameOptimizedCopy);
els.savePixelRenderBtn.addEventListener("click", savePixelRenderPng);
canvas.addEventListener("pointerdown", event => {
  if (beginPlayerCameraLook(event)) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }
  if (activeCustomCameraId) detachCustomCameraView({ showPlayer: false });
}, true);
canvas.addEventListener("pointermove", event => {
  if (!movePlayerCameraLook(event)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
}, true);
canvas.addEventListener("pointerup", event => {
  if (!endPlayerCameraLook(event)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
}, true);
canvas.addEventListener("pointercancel", event => {
  if (!endPlayerCameraLook(event)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
}, true);
canvas.addEventListener("wheel", event => {
  if (!activePlayerCameraView()) return;
  event.preventDefault();
  event.stopImmediatePropagation();
}, { capture: true, passive: false });
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
els.loadReferenceImageBtn.addEventListener("click", () => els.referenceImageFile.click());
els.referenceImageFile.addEventListener("change", async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    await loadReferenceImageFile(file);
  } catch (error) {
    log(`Reference image import failed: ${error.message}`);
  }
  event.target.value = "";
});
els.clearReferenceImageBtn.addEventListener("click", clearReferenceImage);
els.referenceImageMode.addEventListener("change", () => {
  referenceImageState.mode = els.referenceImageMode.value;
  syncReferenceImageUi();
  log(`Reference image display set to ${els.referenceImageMode.selectedOptions?.[0]?.textContent || referenceImageState.mode}.`);
});
els.referenceImageOpacity.addEventListener("input", () => {
  referenceImageState.opacity = Number(els.referenceImageOpacity.value) || .45;
  syncReferenceImageUi();
});
[els.referenceImageScale, els.referenceImageOffsetX, els.referenceImageOffsetY].forEach(input => {
  input.addEventListener("input", () => {
    referenceImageState.scale = Number(els.referenceImageScale.value) || 1;
    referenceImageState.offsetX = Number(els.referenceImageOffsetX.value) || 0;
    referenceImageState.offsetY = Number(els.referenceImageOffsetY.value) || 0;
    syncReferenceImageUi();
  });
});
syncReferenceImageUi();
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
els.insertObjBtn?.addEventListener("click", () => {
  els.insertObjFile.value = "";
  els.insertObjFile.click();
});
els.loadProjectUrlBtn?.addEventListener("click", async () => {
  const rawUrl = window.prompt(
    "Paste an HTTPS URL to a BoltWorks .modelerproj or saved scene JSON file. Localhost HTTP is also allowed:"
  );
  if (rawUrl === null) return;

  const previousLabel = els.loadProjectUrlBtn.textContent;
  els.loadProjectUrlBtn.disabled = true;
  els.loadProjectUrlBtn.textContent = "Loading URL...";
  try {
    await loadProjectFromUrl(rawUrl);
  } catch (error) {
    log(`Project URL load failed: ${error.message}`);
  } finally {
    els.loadProjectUrlBtn.disabled = false;
    els.loadProjectUrlBtn.textContent = previousLabel;
  }
});
els.stopServerBtn?.addEventListener("click", shutdownServerAndCloseApp);
document.querySelector("#exportJsonBtn").addEventListener("click", () => download(`${currentProjectBaseName()}-scene.json`, JSON.stringify(state(), null, 2), "application/json"));
document.querySelector("#exportObjBtn").addEventListener("click", () => {
  exportObjMaterialBundle(objects, currentProjectBaseName());
});
document.querySelector("#exportSelectedObjBtn")?.addEventListener("click", () => {
  if (!selected?.geometry) {
    log("Export Selected OBJ needs one selected model or LOD level.");
    return;
  }
  const fileName = `${currentProjectBaseName()}-${safeFileName(selected.name, "selected-model")}.obj`;
  const archiveName = exportObjMaterialBundle([selected], fileName.replace(/\.obj$/i, ""));
  log(`Exported selected model ${selected.name} as an OBJ + MTL material bundle.`, {
    archiveName,
    lodLevel: Number.isInteger(selected.userData?.lod?.level) ? selected.userData.lod.level : null,
    triangles: Math.floor((selected.geometry.index?.count || selected.geometry.getAttribute("position")?.count || 0) / 3)
  });
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
  setTextureLibraryPanelOpen(true);
  const currentName = currentTextureLibraryName();
  if (currentName && textureLibrary.has(currentName)) els.textureLibrarySelect.value = currentName;
  // This is deliberately a direct file action. Repeated clicks must always
  // allow another image instead of merely opening/closing the library panel.
  els.textureFile.value = "";
  els.textureFile.click();
});
els.textureEditorBtn.addEventListener("click", openTextureEditor);
els.applyLibraryTextureBtn.addEventListener("click", applySelectedLibraryTexture);
els.addLibraryTextureBtn?.addEventListener("click", () => {
  els.textureFile.value = "";
  els.textureFile.click();
});
els.loadTextureLibraryUrlBtn?.addEventListener("click", applyTextureLibraryUrl);
els.textureLibraryUrlInput?.addEventListener("keydown", event => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  applyTextureLibraryUrl();
});
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
els.saveTextureImageBtn.addEventListener("click", saveSelectedTextureImages);
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
  if (!file) return;
  try {
    if (targets.length) recordHistory("add texture");
    const dataUrl = await readFileAsDataUrl(file);
    const libraryName = registerTextureAsset(file.name, dataUrl);
    refreshTextureLibraryUi();
    setTextureLibraryPanelOpen(true);
    if (libraryName && textureLibrary.has(libraryName)) els.textureLibrarySelect.value = libraryName;
    if (targets.length) {
      for (const mesh of targets) {
        applyTextureToMesh(
          mesh,
          dataUrl,
          libraryName || file.name,
          mesh.userData.textureFlipY ?? true,
          mesh.userData.textureRotation || 0
        );
      }
      syncInspector();
      updateAll();
      log(`Added texture ${libraryName || file.name} to ${targets.length} part${targets.length === 1 ? "" : "s"} and stored it in the project library.`);
    } else {
      log(`Added texture ${libraryName || file.name} to the project library. It is ready to use when a model part is selected.`);
    }
  } catch (error) {
    log(`Texture import failed: ${error.message}`);
  }
  event.target.value = "";
});
els.textureEditorCloseBtn.addEventListener("click", closeTextureEditor);
els.textureEditorApplyBtn.addEventListener("click", applyTextureEditorChanges);
els.textureEditorResetBtn.addEventListener("click", resetTextureEditorCanvas);
els.textureEditorApplyUvScaleBtn?.addEventListener("click", applyTextureEditorUvScale);
els.textureEditorUndoBtn.addEventListener("click", undoTextureEditorPaint);
[els.textureEditorShowUv, els.textureEditorSelectedOnly].forEach(input => input.addEventListener("change", renderTextureEditor));
[els.textureEditorPixelPen].forEach(input => input?.addEventListener("change", () => {
  if (els.textureEditorBrushSize) els.textureEditorBrushSize.disabled = textureEditorState.tool === "pen" && input.checked;
  renderTextureEditorBrushPreview();
  renderTextureEditor();
}));
els.textureEditorPartSelect?.addEventListener("change", event => {
  switchTextureEditorPart(event.target.value).catch(error => log(`Could not switch texture part: ${error.message}`));
});
els.textureEditorLoadUrlBtn?.addEventListener("click", () => loadTextureEditorTextureUrl());
els.textureEditorTextureUrl?.addEventListener("keydown", event => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  loadTextureEditorTextureUrl();
});
els.textureEditorChooseFileBtn?.addEventListener("click", () => els.textureEditorTextureFile?.click());
els.textureEditorTextureFile?.addEventListener("change", event => {
  loadTextureEditorTextureFile(event.target.files?.[0]);
  event.target.value = "";
});
[els.textureEditorColor, els.textureEditorChannelValue, els.textureEditorBrushSize, els.textureEditorHardness, els.textureEditorOpacity, els.textureEditorHammerRadius].forEach(input => input.addEventListener("input", () => {
  syncTextureEditorChannelValueUi();
  renderTextureEditorBrushPreview();
  renderTextureEditor();
}));
els.textureEditorTool.addEventListener("change", event => {
  setTextureEditorTool(event.target.value || "none");
});
for (const button of els.textureEditorToolButtons || []) {
  button.addEventListener("click", () => {
    const requestedTool = button.dataset.textureTool || "none";
    setTextureEditorTool(textureEditorState.tool === requestedTool ? "none" : requestedTool);
  });
}
for (const button of els.textureEditorChannelButtons || []) {
  button.addEventListener("click", () => switchTextureEditorChannel(button.dataset.textureChannel || "baseColor"));
}
for (const button of els.textureEditorShapeButtons || []) {
  button.addEventListener("click", () => {
    textureEditorState.shape = button.dataset.textureShape || "rectangle";
    for (const candidate of els.textureEditorShapeButtons || []) {
      candidate.classList.toggle("active", candidate === button);
    }
    renderTextureEditor();
  });
}
els.textureEditorShapeFilled?.addEventListener("change", renderTextureEditor);
for (const button of els.textureEditorSymmetryButtons || []) {
  button.addEventListener("click", () => setTextureEditorSymmetry(button.dataset.textureSymmetry || "none"));
}
els.textureEditorClearSelectionBtn?.addEventListener("click", clearTextureEditorSelection);
els.textureEditorZoomOutBtn?.addEventListener("click", () => setTextureEditorZoom((textureEditorState.zoom || 1) / 1.25));
els.textureEditorZoomInBtn?.addEventListener("click", () => setTextureEditorZoom((textureEditorState.zoom || 1) * 1.25));
els.textureEditorZoomResetBtn?.addEventListener("click", () => {
  textureEditorState.panX = 0;
  textureEditorState.panY = 0;
  setTextureEditorZoom(1);
});
els.textureEditorAddLayerBtn?.addEventListener("click", addTextureEditorLayer);
els.textureEditorDuplicateLayerBtn?.addEventListener("click", duplicateTextureEditorLayer);
els.textureEditorLayerUpBtn?.addEventListener("click", () => moveTextureEditorLayer(1));
els.textureEditorLayerDownBtn?.addEventListener("click", () => moveTextureEditorLayer(-1));
els.textureEditorMergeDownBtn?.addEventListener("click", mergeTextureEditorLayerDown);
els.textureEditorDeleteLayerBtn?.addEventListener("click", deleteTextureEditorLayer);
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
els.meshDetailsShowUvInput?.addEventListener("change", refreshMeshDetails);
els.meshDetailsModal.addEventListener("click", event => {
  if (event.target === els.meshDetailsModal) closeMeshDetails();
});
els.textureEditorCanvas.addEventListener("pointerdown", event => {
  if (!textureEditorState.open) return;
  if (els.textureEditorEditUv?.checked && event.button === 0) {
    snapshotTextureEditor();
    textureEditorState.uvLayoutDrag = { start: textureEditorCanvasPointFromEvent(event), scale: !!els.textureEditorScaleUv?.checked };
    els.textureEditorCanvas.setPointerCapture?.(event.pointerId);
    event.preventDefault();
    return;
  }
  textureEditorState.tool = els.textureEditorTool?.value || textureEditorState.tool || "none";
  if (textureEditorState.tool === "none" && event.button !== 1) return;
  if (textureEditorState.tool === "pan" || event.button === 1) {
    event.preventDefault();
    hideTextureEditorPointerPreview();
    textureEditorState.isPanning = true;
    textureEditorState.panStart = textureEditorCanvasPointFromEvent(event);
    els.textureEditorCanvas.setPointerCapture?.(event.pointerId);
    syncTextureEditorCursor();
    return;
  }
  const point = textureEditorPointFromEvent(event);
  if (!point) return;
  if (textureEditorState.tool === "selectRect" || textureEditorState.tool === "selectEllipse" || textureEditorState.tool === "selectLasso") {
    textureEditorState.selectionDraft = {
      type: textureEditorState.tool === "selectEllipse" ? "ellipse" : textureEditorState.tool === "selectLasso" ? "lasso" : "rectangle",
      points: [point, point]
    };
    textureEditorState.isSelecting = true;
    els.textureEditorCanvas.setPointerCapture?.(event.pointerId);
    renderTextureEditor();
    return;
  }
  if (textureEditorState.tool === "shape") {
    snapshotTextureEditor();
    textureEditorState.strokeSnapshotTaken = true;
    textureEditorState.shapeStart = point;
    textureEditorState.shapeEnd = point;
    textureEditorState.isDrawingShape = true;
    els.textureEditorCanvas.setPointerCapture?.(event.pointerId);
    renderTextureEditor();
    return;
  }
  if (textureEditorState.tool === "hammer") {
    applyGlassBreakEffect(point);
    return;
  }
  if (textureEditorState.tool === "eyedropper") {
    sampleTextureEditorColor(point);
    return;
  }
  if (textureEditorState.tool === "fill") {
    fillTextureEditorIsland(point);
    return;
  }
  snapshotTextureEditor();
  textureEditorState.strokeSnapshotTaken = true;
  textureEditorState.isPainting = true;
  textureEditorState.lastPoint = point;
  els.textureEditorCanvas.setPointerCapture?.(event.pointerId);
  textureEditorStrokeTo(point);
});
els.textureEditorCanvas.addEventListener("pointermove", event => {
  if (textureEditorState.uvLayoutDrag) {
    const current = textureEditorCanvasPointFromEvent(event);
    const start = textureEditorState.uvLayoutDrag.start;
    const canvas = els.textureEditorCanvas;
    transformTextureEditorUvs((current.x - start.x) / canvas.width, (current.y - start.y) / canvas.height, textureEditorState.uvLayoutDrag.scale);
    textureEditorState.uvLayoutDrag.start = current;
    return;
  }
  if (textureEditorState.isPanning) {
    hideTextureEditorPointerPreview();
    const current = textureEditorCanvasPointFromEvent(event);
    const previous = textureEditorState.panStart || current;
    textureEditorState.panX += current.x - previous.x;
    textureEditorState.panY += current.y - previous.y;
    textureEditorState.panStart = current;
    renderTextureEditor();
    return;
  }
  const point = textureEditorPointFromEvent(event);
  textureEditorState.hoverPoint = point;
  syncTextureEditorPointerPreview(event);
  if (textureEditorState.isSelecting && point) {
    const draft = textureEditorState.selectionDraft;
    if (draft?.type === "lasso") {
      const previous = draft.points[draft.points.length - 1];
      if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) >= 2) draft.points.push(point);
    } else if (draft) {
      draft.points[1] = point;
    }
    renderTextureEditor();
    return;
  }
  if (textureEditorState.isDrawingShape && point) {
    textureEditorState.shapeEnd = point;
    renderTextureEditor();
    return;
  }
  if (!textureEditorState.isPainting) return;
  if (!point) return;
  textureEditorStrokeTo(point);
  return;
});
const finishTextureEditorStroke = pointerId => {
  if (textureEditorState.isSelecting) {
    const draft = textureEditorState.selectionDraft;
    const first = draft?.points?.[0];
    const last = draft?.points?.[draft.points.length - 1];
    const largeEnough = draft?.type === "lasso"
      ? draft.points.length >= 3
      : first && last && (Math.abs(last.x - first.x) >= 1 || Math.abs(last.y - first.y) >= 1);
    textureEditorState.selection = largeEnough ? draft : null;
    textureEditorState.selectionDraft = null;
    textureEditorState.isSelecting = false;
    syncTextureEditorSelectionUi();
    renderTextureEditor();
  }
  if (textureEditorState.isDrawingShape) {
    drawTextureEditorShape(textureEditorState.shapeStart, textureEditorState.shapeEnd);
    textureEditorState.shapeStart = null;
    textureEditorState.shapeEnd = null;
    textureEditorState.isDrawingShape = false;
    updateTextureEditorUndoButton();
  }
  textureEditorState.isPainting = false;
  textureEditorState.isPanning = false;
  textureEditorState.panStart = null;
  textureEditorState.lastPoint = null;
  textureEditorState.strokeSnapshotTaken = false;
  if (pointerId !== undefined) {
    try {
      els.textureEditorCanvas.releasePointerCapture?.(pointerId);
    } catch {}
  }
  syncTextureEditorCursor();
};
els.textureEditorCanvas.addEventListener("pointerup", event => {
  if (textureEditorState.uvLayoutDrag) {
    textureEditorState.uvLayoutDrag = null;
    els.textureEditorCanvas.releasePointerCapture?.(event.pointerId);
    updateAll();
    return;
  }
  finishTextureEditorStroke(event.pointerId);
});
els.textureEditorCanvas.addEventListener("pointerleave", event => {
  textureEditorState.hoverPoint = null;
  hideTextureEditorPointerPreview();
  finishTextureEditorStroke(event.pointerId);
});
els.textureEditorCanvas.addEventListener("wheel", event => {
  if (!textureEditorState.open) return;
  event.preventDefault();
  const anchor = textureEditorCanvasPointFromEvent(event);
  setTextureEditorZoom((textureEditorState.zoom || 1) * (event.deltaY < 0 ? 1.12 : 1 / 1.12), anchor, event);
}, { passive: false });
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
  const files = [...(event.target.files || [])];
  if (!files.some(file => /\.obj$/i.test(file.name))) return;
  try {
    await importObjFiles(files);
  } catch (error) {
    log(`OBJ import failed: ${error.message}`);
  }
  event.target.value = "";
});
els.insertObjFile?.addEventListener("change", async event => {
  const files = [...(event.target.files || [])];
  if (!files.some(file => /\.obj$/i.test(file.name))) return;
  try {
    await insertObjFiles(files);
  } catch (error) {
    log(`OBJ insert failed: ${error.message}`);
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

const activeInspectorEdits = new WeakSet();
document.querySelectorAll(".props input").forEach(input => {
  if (input === els.cutAmountInput || input === els.textureFile) return;
  input.addEventListener("input", () => {
    if (input === els.colorInput) els.colorHexInput.value = input.value;
    if (input === els.colorHexInput) {
      const normalized = normalizeHexColor(input.value, null);
      if (normalized) els.colorInput.value = normalized;
    }
    if (!activeInspectorEdits.has(input)) {
      recordHistory("inspector");
      activeInspectorEdits.add(input);
    }
    applyInspector({ record: false });
  });
  input.addEventListener("blur", () => activeInspectorEdits.delete(input));
});

function pointerInsideMainCanvas(event) {
  const rect = canvas.getBoundingClientRect();
  return event.clientX >= rect.left && event.clientX <= rect.right
    && event.clientY >= rect.top && event.clientY <= rect.bottom;
}

function prioritizeUnselectedSurfaceTriangle(event) {
  if (!pointerInsideMainCanvas(event)) return;
  if (!surfaceTransform.visible || surfaceTransform.dragging || !facePickMode) {
    surfaceTransform.enabled = true;
    return;
  }
  surfaceTransform.enabled = true;
  if (typeof surfaceTransform.pointerHover === "function" && typeof surfaceTransform._getPointer === "function") {
    surfaceTransform.pointerHover(surfaceTransform._getPointer(event));
    const hoveredAxis = String(surfaceTransform.axis || "").toUpperCase();
    const hoveredVisibleArrow = (hoveredAxis === "X" && surfaceTransform.showX)
      || (hoveredAxis === "Y" && surfaceTransform.showY)
      || (hoveredAxis === "Z" && surfaceTransform.showZ);
    if (hoveredVisibleArrow) return;
  }
  const hit = hitFromPointerEvent(event);
  const overMeshTriangle = !!hit?.face;
  surfaceTransform.enabled = !overMeshTriangle;
  if (overMeshTriangle) surfaceTransform.axis = null;
  if (event.type === "pointerdown" && overMeshTriangle && !canStartDragPushFromHit(hit)) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (pullToTargetSession && pullSelectedRegionToHit(hit)) return;
    pickSurfaceComponentFromHit(hit, { append: additiveSelectionRequested(event) });
  }
}

window.addEventListener("pointermove", prioritizeUnselectedSurfaceTriangle, true);
window.addEventListener("pointerdown", prioritizeUnselectedSurfaceTriangle, true);
canvas.addEventListener("pointerleave", () => {
  if (!surfaceTransform.dragging) surfaceTransform.enabled = true;
}, true);

canvas.addEventListener("pointerdown", event => {
  const rect = renderer.domElement.getBoundingClientRect();
  lastCanvasPointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  lastCanvasPointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  if (event.button !== 0 || transform.dragging || surfaceTransform.dragging || boneTransform.dragging) return;
  if ((transform.visible && transform.axis) || (surfaceTransform.visible && surfaceTransform.axis) || (boneTransform.visible && boneTransform.axis)) {
    pendingScenePick = null;
    return;
  }
  if (spaceCameraMode) return;
  pendingScenePick = null;
  // Grabbing the bone joystick handle starts a precise aim-drag for rotation.
  if (typeof pickBoneJoystick === "function" && pickBoneJoystick(event)) {
    beginBoneAimDrag(event);
    return;
  }
  if (knifeCutMode) {
    addKnifeCutPointFromHit(hitFromPointerEvent(event));
    return;
  }
  if (lineSketchMode) {
    addLineSketchPointFromEvent(event);
    return;
  }
  const hit = hitFromPointerEvent(event);
  if (pullToTargetSession && hit?.face && pullSelectedRegionToHit(hit)) return;
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
  if (facePickMode && surfaceComponentMode === "triangle" && els.areaTriInput.checked) {
    isAreaSelectingTriangles = true;
    areaSelectionStart = canvasPointFromEvent(event);
    orbit.enabled = false;
    canvas.setPointerCapture?.(event.pointerId);
    updateSelectionBox(areaSelectionStart, areaSelectionStart);
    return;
  }
  if (facePickMode && surfaceComponentMode === "triangle" && els.paintTriInput.checked && hit) {
    isPaintingTriangles = true;
    lastPaintedTriangleKey = null;
    orbit.enabled = false;
    canvas.setPointerCapture?.(event.pointerId);
    paintTriangleFromPointer(event);
    return;
  }
  if (facePickMode && hit) {
    pickSurfaceComponentFromHit(hit, { append: additiveSelectionRequested(event) });
    return;
  }
  if (!facePickMode) {
    const pickedBoneId = pickBoneFromMainPointer(event);
    if (pickedBoneId) {
      selectBoneFromViewport(pickedBoneId);
      return;
    }
  }
  pendingScenePick = {
    pointerId: event.pointerId,
    startClientX: event.clientX,
    startClientY: event.clientY,
    hitObject: hit?.object || null,
    append: additiveSelectionRequested(event),
    dragged: false
  };
});

canvas.addEventListener("pointermove", event => {
  if (typeof moveBoneAimDrag === "function" && boneAimDrag) { moveBoneAimDrag(event); return; }
  const rect = renderer.domElement.getBoundingClientRect();
  lastCanvasPointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  lastCanvasPointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  if (knifeCutMode && knifeCutPoints.length === 1 && !spaceCameraMode) {
    const knifeHit = hitFromPointerEvent(event);
    knifeCutHover = knifeHit?.object === knifeCutMesh ? knifeHit.point.clone() : null;
    updateKnifeCutGuide(knifeCutHover);
  }
  if (lineSketchMode && !spaceCameraMode) {
    const hit = lineSketchPickFromEvent(event);
    setLineSketchCursor(hit?.point || null, hit?.normal || null);
  }
  if (openingPickMode && !spaceCameraMode && !transform.dragging && !surfaceTransform.dragging) {
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
  if (!isPaintingTriangles || !facePickMode || !els.paintTriInput.checked || transform.dragging || surfaceTransform.dragging || spaceCameraMode) return;
  paintTriangleFromPointer(event);
});

window.addEventListener("pointerup", event => {
  if (typeof endBoneAimDrag === "function") endBoneAimDrag(event);
  finishDragPushSession(event.pointerId);
  finishAreaSelection(event);
  finishTrianglePainting(event.pointerId);
  if (pendingScenePick?.pointerId === event.pointerId) {
    const pick = pendingScenePick;
    pendingScenePick = null;
    if (!pick.dragged && pick.hitObject && !transform.dragging && !surfaceTransform.dragging && !boneTransform.dragging && !spaceCameraMode) {
      if (selectedBoneId) {
        selectedBoneId = null;
        rebuildBoneVisuals();
        syncBonePanel();
      }
      selectObject(pick.hitObject, { append: pick.append });
    }
  }
});

canvas.addEventListener("dblclick", event => {
  if (knifeCutMode) {
    event.preventDefault();
    pendingScenePick = null;
    return;
  }
  if (lineSketchMode) {
    event.preventDefault();
    closeLineSketch();
    return;
  }
  if (transform.dragging || surfaceTransform.dragging || spaceCameraMode) return;
  if (!facePickMode) {
    event.preventDefault();
    pendingScenePick = null;
    clearCurrentSelection();
    return;
  }
  const hit = hitFromPointerEvent(event);
  if (!hit) return;
  event.preventDefault();
  if (selectedFaces.length || selectedSurfaceVertices.length || selectedSurfaceEdges.length) {
    clearSelectedTriangles();
    updateAll();
    log("Released the current surface selection with a double-click.");
    return;
  }
  if (surfaceComponentMode === "vertex" || surfaceComponentMode === "edge") {
    pickSurfaceComponentFromHit(hit, { append: additiveSelectionRequested(event) });
  } else {
    selectConnectedTrianglesFromHit(hit, { append: additiveSelectionRequested(event) });
  }
});

window.addEventListener("keydown", event => {
  const editingText = event.target?.matches?.("input, textarea, select, [contenteditable='true']");
  if (gameplayPreviewVisible()) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeGameplayPreview();
      return;
    }
    if (!editingText && ["KeyW", "KeyA", "KeyS", "KeyD", "KeyQ", "KeyE", "Space", "ShiftLeft", "ShiftRight"].includes(event.code)) {
      event.preventDefault();
      gameplayKeys.add(event.code);
      return;
    }
  }
  if (event.key === "Shift") isShiftHeld = true;
  if (event.key === "Control" || event.key === "Meta") isCtrlHeld = true;
  updateScaleModifierMarkers();
  if (pullToTargetSession && event.key === "Escape") {
    event.preventDefault();
    setPullToTargetSession(false);
    log("Pull to Target cancelled.");
    return;
  }
  if (knifeCutMode && event.key === "Escape") {
    event.preventDefault();
    if (knifeCutPoints.length) cancelKnifeCutStroke();
    else setKnifeCutMode(false);
    return;
  }
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
    if (selectedSurfaceVertices.length || selectedSurfaceEdges.length) {
      clearSelectedTriangles();
      updateAll();
      log("Vertex/edge selection cleared. Delete geometry will be added with the topology tools.");
    } else if (selectedFaces.length) deleteSelectedTriangles();
    else deleteSelection();
  }
  if (event.key.toLowerCase() === "w") setTransformMode("translate");
  if (event.key.toLowerCase() === "e") setTransformMode("rotate");
  if (event.key.toLowerCase() === "r") setTransformMode("scale");
});

window.addEventListener("keyup", event => {
  gameplayKeys.delete(event.code);
  if (event.key === "Shift") isShiftHeld = false;
  if (event.key === "Control" || event.key === "Meta") isCtrlHeld = false;
  updateScaleModifierMarkers();
  if (event.code !== "Space") return;
  spaceCameraMode = false;
  if (facePickMode) {
    setFacePickMode(true);
  }
});
window.addEventListener("blur", () => {
  gameplayKeys.clear();
  isShiftHeld = false;
  isCtrlHeld = false;
  updateScaleModifierMarkers();
  finishDragPushSession();
  finishScaleDragSession();
});
window.addEventListener("resize", () => {
  if (textureEditorState.open) renderTextureEditor();
});

els.workViewFrontBtn?.addEventListener("click", () => setOrthographicWorkView("front"));
els.workViewSideBtn?.addEventListener("click", () => setOrthographicWorkView("side"));
els.workViewTopBtn?.addEventListener("click", () => setOrthographicWorkView("top"));
els.frontReferenceWorkBtn?.addEventListener("click", () => setOrthographicWorkView("front"));
els.sideReferenceWorkBtn?.addEventListener("click", () => setOrthographicWorkView("side"));
els.workViewRestoreBtn?.addEventListener("click", restoreOrthographicWorkView);
els.gameplayPreviewOpenBtn?.addEventListener("click", openGameplayPreview);
els.gameplayPreviewResetBtn?.addEventListener("click", resetGameplayPreviewCamera);
els.gameplayPreviewCloseBtn?.addEventListener("click", closeGameplayPreview);
gameplayCanvas?.addEventListener("click", () => gameplayCanvas.requestPointerLock?.());
gameplayCanvas?.addEventListener("wheel", event => {
  if (!gameplayPreviewVisible()) return;
  event.preventDefault();
  const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
  gameplaySpeedMultiplier = THREE.MathUtils.clamp(
    gameplaySpeedMultiplier * factor,
    GAMEPLAY_SPEED_MIN,
    GAMEPLAY_SPEED_MAX
  );
  updateGameplayHint();
}, { passive: false });
document.addEventListener("mousemove", event => {
  if (document.pointerLockElement !== gameplayCanvas || !gameplayPreviewVisible()) return;
  gameplayYaw -= event.movementX * .0022;
  gameplayPitch = THREE.MathUtils.clamp(gameplayPitch - event.movementY * .0022, -Math.PI / 2 + .02, Math.PI / 2 - .02);
});
document.addEventListener("pointerlockchange", () => {
  if (document.pointerLockElement !== gameplayCanvas) gameplayKeys.clear();
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
  customCameraViews: () => customCameraViews.map(view => ({ ...view, position: [...view.position], target: [...view.target], up: [...view.up] })),
  addCustomCameraView,
  activateCustomCameraView,
  saveQaSheet,
  saveAnimationMotionSheets,
  exportAnimationWebm,
  exportAnimationMp4,
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
  insetSelectedFace,
  extrudeSelectedRegion,
  pullSelectedFaces,
  pushSelectedFaces,
  bevelSelectedEdge,
  bevelSelectedCorner,
  subdivideSelectedSurface,
  applyLoopCut,
  setOrthographicWorkView,
  restoreOrthographicWorkView,
  openGameplayPreview,
  closeGameplayPreview,
  surfaceGizmoState: () => ({
    visible: surfaceTransform.visible,
    axis: surfaceTransform.axis,
    lockedAxis: surfaceAxisMode(),
    space: surfaceTransform.space,
    visibleHandles: { x: surfaceTransform.showX, y: surfaceTransform.showY, z: surfaceTransform.showZ },
    dragging: surfaceTransform.dragging,
    orbitEnabled: orbit.enabled,
    controlLayerMask: surfaceTransform.layers.mask,
    raycasterLayerMask: surfaceTransform.getRaycaster().layers.mask
  }),
  boneGizmoState: () => ({
    visible: boneTransform.visible,
    mode: boneTransform.mode,
    space: boneTransform.space,
    dragging: boneTransform.dragging,
    attached: !!boneTransform.object,
    selectedBoneId,
    bones: rigBones.map(bone => ({
      id: bone.id,
      name: bone.name,
      position: bone.position.toArray().map(round),
      rotation: [bone.rotation.x, bone.rotation.y, bone.rotation.z].map(round)
    }))
  }),
  selectBone: selectBoneFromViewport,
  rigPose: applyCurrentRigPose,
  boneGizmoPointer: (type, x, y) => {
    const pointer = { x, y, button: 0 };
    if (type === "hover") boneTransform.pointerHover(pointer);
    else if (type === "down") { boneTransform.pointerHover(pointer); boneTransform.pointerDown(pointer); }
    else if (type === "move") boneTransform.pointerMove(pointer);
    else boneTransform.pointerUp(pointer);
    return { axis: boneTransform.axis, dragging: boneTransform.dragging };
  },
  selectedTriangles: () => selectedFaces.map(face => ({
    targetId: face.mesh.userData.id,
    targetName: face.mesh.name,
    faceIndex: face.faceIndex,
    point: worldFacePoint(face).toArray().map(round),
    normal: worldFaceNormal(face).toArray().map(round),
    triangle: worldTrianglePoints(face).map(point => point.toArray().map(round))
  })),
  selectedSurfaceComponents: () => ({
    mode: surfaceComponentMode,
    vertices: selectedSurfaceVertices.map(vertex => ({
      targetId: vertex.mesh.userData.id,
      point: vertex.localPoint.clone().applyMatrix4(vertex.mesh.matrixWorld).toArray().map(round)
    })),
    edges: selectedSurfaceEdges.map(edge => ({
      targetId: edge.mesh.userData.id,
      start: edge.localA.clone().applyMatrix4(edge.mesh.matrixWorld).toArray().map(round),
      end: edge.localB.clone().applyMatrix4(edge.mesh.matrixWorld).toArray().map(round)
    }))
  }),
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
renderCustomCameraViews();
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
