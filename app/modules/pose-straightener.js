const poseStraightenerUi = {
  start: document.querySelector("#poseStraightenerStartBtn"),
  finish: document.querySelector("#poseStraightenerFinishBtn"),
  cancel: document.querySelector("#poseStraightenerClearBtn"),
  status: document.querySelector("#poseStraightenerStatus"),
  previous: document.querySelector("#poseStraightenerPrevBtn"),
  next: document.querySelector("#poseStraightenerNextBtn"),
  rotateX: document.querySelector("#poseStraightenerRotateX"),
  rotateY: document.querySelector("#poseStraightenerRotateY"),
  rotateZ: document.querySelector("#poseStraightenerRotateZ"),
  rotate: document.querySelector("#poseStraightenerRotateBtn"),
  straighten: document.querySelector("#poseStraightenerStraightenBtn"),
  softness: document.querySelector("#poseStraightenerSoftness"),
  softnessOutput: document.querySelector("#poseStraightenerSoftnessOutput"),
  apply: document.querySelector("#poseStraightenerApplyBtn"),
  reset: document.querySelector("#poseStraightenerResetBtn")
};

const poseStraightenerState = {
  active: false,
  placing: false,
  target: null,
  sourcePositions: null,
  restPoints: [],
  posedPoints: [],
  selectedJoint: 0,
  helperGroup: null,
  jointMarkers: [],
  boneLines: null,
  dragStartPoints: null,
  dragStartQuaternion: null,
  dragMeshWorldQuaternion: null,
  syncingGizmo: false
};

const poseStraightenerPivot = new THREE.Object3D();
poseStraightenerPivot.name = "pose straightener rotation pivot";
poseStraightenerPivot.userData.editorHelper = true;
scene.add(poseStraightenerPivot);

const poseStraightenerTransform = new TransformControls(camera, renderer.domElement);
poseStraightenerTransform.name = "pose straightener rotation joystick";
poseStraightenerTransform.setMode("rotate");
poseStraightenerTransform.setSpace("world");
poseStraightenerTransform.setSize(.78);
poseStraightenerTransform.visible = false;
scene.add(poseStraightenerTransform);

poseStraightenerTransform.addEventListener("dragging-changed", event => {
  orbit.enabled = !event.value;
});

poseStraightenerTransform.addEventListener("mouseDown", () => {
  const state = poseStraightenerState;
  if (!state.active || state.placing || state.restPoints.length < 2) return;
  state.dragStartPoints = state.posedPoints.map(point => point.clone());
  state.dragStartQuaternion = poseStraightenerPivot.quaternion.clone();
  state.target.updateWorldMatrix(true, false);
  state.dragMeshWorldQuaternion = state.target.getWorldQuaternion(new THREE.Quaternion());
});

poseStraightenerTransform.addEventListener("objectChange", () => {
  const state = poseStraightenerState;
  if (state.syncingGizmo || !state.dragStartPoints || !state.dragStartQuaternion || !state.dragMeshWorldQuaternion) return;
  const deltaWorld = poseStraightenerPivot.quaternion.clone().multiply(state.dragStartQuaternion.clone().invert());
  const meshWorld = state.dragMeshWorldQuaternion;
  const deltaLocal = meshWorld.clone().invert().multiply(deltaWorld).multiply(meshWorld);
  state.posedPoints = state.dragStartPoints.map(point => point.clone());
  const pivot = state.posedPoints[state.selectedJoint].clone();
  for (let index = state.selectedJoint + 1; index < state.posedPoints.length; index += 1) {
    state.posedPoints[index].sub(pivot).applyQuaternion(deltaLocal).add(pivot);
  }
  poseStraightenerDeform();
});

poseStraightenerTransform.addEventListener("mouseUp", () => {
  const state = poseStraightenerState;
  state.dragStartPoints = null;
  state.dragStartQuaternion = null;
  state.dragMeshWorldQuaternion = null;
  if (!poseStraightenerTransform.dragging) poseStraightenerSyncGizmo();
  poseStraightenerSetStatus(`Joint ${state.selectedJoint + 1} rotated with the joystick. Apply to keep it or Cancel to restore the mesh.`);
});

function poseStraightenerSetStatus(message) {
  if (poseStraightenerUi.status) poseStraightenerUi.status.textContent = message;
}

function poseStraightenerReady() {
  const state = poseStraightenerState;
  return state.active && !state.placing && state.restPoints.length >= 2;
}

function poseStraightenerSyncGizmo() {
  const state = poseStraightenerState;
  if (!poseStraightenerReady() || !state.target || !state.posedPoints[state.selectedJoint]) {
    poseStraightenerTransform.detach();
    poseStraightenerTransform.visible = false;
    return;
  }
  state.syncingGizmo = true;
  const worldPoint = state.target.localToWorld(state.posedPoints[state.selectedJoint].clone());
  poseStraightenerPivot.position.copy(worldPoint);
  poseStraightenerPivot.quaternion.identity();
  poseStraightenerPivot.updateMatrixWorld(true);
  poseStraightenerTransform.attach(poseStraightenerPivot);
  poseStraightenerTransform.visible = true;
  state.syncingGizmo = false;
}

function poseStraightenerTargetIsUsable(mesh) {
  return !!(mesh?.isMesh && mesh.geometry?.getAttribute?.("position") && !mesh.userData?.editorHelper);
}

function poseStraightenerDisposeHelpers() {
  const group = poseStraightenerState.helperGroup;
  if (!group) return;
  group.parent?.remove(group);
  group.traverse(child => {
    child.geometry?.dispose?.();
    child.material?.dispose?.();
  });
  poseStraightenerState.helperGroup = null;
  poseStraightenerState.jointMarkers = [];
  poseStraightenerState.boneLines = null;
  poseStraightenerTransform.detach();
  poseStraightenerTransform.visible = false;
}

function poseStraightenerMarkerRadius() {
  const mesh = poseStraightenerState.target;
  if (!mesh) return .025;
  mesh.geometry.computeBoundingBox();
  return THREE.MathUtils.clamp((mesh.geometry.boundingBox?.getSize(new THREE.Vector3()).length() || 1) * .018, .012, .12);
}

function poseStraightenerEnsureHelpers() {
  const state = poseStraightenerState;
  if (state.helperGroup || !state.target) return;
  const group = new THREE.Group();
  group.name = "pose straightener helpers";
  group.userData.editorHelper = true;
  state.target.add(group);
  state.helperGroup = group;
  const lines = new THREE.LineSegments(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: 0xffcb52, depthTest: false, transparent: true, opacity: .94 })
  );
  lines.renderOrder = 1250;
  lines.raycast = () => null;
  group.add(lines);
  state.boneLines = lines;
}

function poseStraightenerRefreshHelpers() {
  const state = poseStraightenerState;
  poseStraightenerEnsureHelpers();
  if (!state.helperGroup) return;
  while (state.jointMarkers.length < state.posedPoints.length) {
    const index = state.jointMarkers.length;
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(poseStraightenerMarkerRadius(), 14, 10),
      new THREE.MeshBasicMaterial({ color: 0xffcb52, depthTest: false, transparent: true, opacity: .96 })
    );
    marker.name = `pose straightener joint ${index + 1}`;
    marker.userData.editorHelper = true;
    marker.userData.poseStraightenerJointIndex = index;
    marker.renderOrder = 1251;
    state.helperGroup.add(marker);
    state.jointMarkers.push(marker);
  }
  while (state.jointMarkers.length > state.posedPoints.length) {
    const marker = state.jointMarkers.pop();
    state.helperGroup.remove(marker);
    marker.geometry.dispose();
    marker.material.dispose();
  }
  state.jointMarkers.forEach((marker, index) => {
    marker.position.copy(state.posedPoints[index]);
    marker.material.color.setHex(index === state.selectedJoint ? 0x5fffe0 : 0xffcb52);
    marker.scale.setScalar(index === state.selectedJoint ? 1.32 : 1);
  });
  const points = [];
  for (let index = 0; index < state.posedPoints.length - 1; index += 1) points.push(state.posedPoints[index], state.posedPoints[index + 1]);
  state.boneLines.geometry.dispose();
  state.boneLines.geometry = new THREE.BufferGeometry().setFromPoints(points);
  poseStraightenerSyncGizmo();
}

function poseStraightenerUpdateUi() {
  const state = poseStraightenerState;
  const ready = poseStraightenerReady();
  if (poseStraightenerUi.start) {
    poseStraightenerUi.start.textContent = state.placing ? `Restart Placement (${state.restPoints.length})` : "Start Joint Chain";
    poseStraightenerUi.start.classList.toggle("active", state.placing);
  }
  if (poseStraightenerUi.finish) poseStraightenerUi.finish.disabled = !state.placing || state.restPoints.length < 2;
  if (poseStraightenerUi.cancel) poseStraightenerUi.cancel.disabled = !state.active;
  if (poseStraightenerUi.previous) poseStraightenerUi.previous.disabled = !ready;
  if (poseStraightenerUi.next) poseStraightenerUi.next.disabled = !ready;
  if (poseStraightenerUi.rotate) poseStraightenerUi.rotate.disabled = !ready || state.selectedJoint >= state.restPoints.length - 1;
  if (poseStraightenerUi.straighten) poseStraightenerUi.straighten.disabled = !ready;
  if (poseStraightenerUi.softness) poseStraightenerUi.softness.disabled = !ready;
  if (poseStraightenerUi.apply) poseStraightenerUi.apply.disabled = !ready;
  if (poseStraightenerUi.reset) poseStraightenerUi.reset.disabled = !ready;
  poseStraightenerRefreshHelpers();
}

function poseStraightenerWritePositions(array) {
  const mesh = poseStraightenerState.target;
  const position = mesh?.geometry?.getAttribute?.("position");
  if (!position || !array || position.array.length !== array.length) return false;
  position.array.set(array);
  position.needsUpdate = true;
  mesh.geometry.computeVertexNormals();
  mesh.geometry.computeBoundingBox();
  mesh.geometry.computeBoundingSphere();
  if (mesh.geometry.attributes.normal) mesh.geometry.attributes.normal.needsUpdate = true;
  updateSelectionOutline();
  updateTriangleHelpers();
  return true;
}

function poseStraightenerClosestPoint(point, start, end) {
  const segment = end.clone().sub(start);
  const lengthSq = segment.lengthSq();
  const t = lengthSq > 1e-10 ? THREE.MathUtils.clamp(point.clone().sub(start).dot(segment) / lengthSq, 0, 1) : 0;
  return start.clone().addScaledVector(segment, t);
}

function poseStraightenerTransformPoint(point, index) {
  const state = poseStraightenerState;
  const restStart = state.restPoints[index];
  const restEnd = state.restPoints[index + 1];
  const posedStart = state.posedPoints[index];
  const posedEnd = state.posedPoints[index + 1];
  const restVector = restEnd.clone().sub(restStart);
  const posedVector = posedEnd.clone().sub(posedStart);
  const restLength = restVector.length();
  const posedLength = posedVector.length();
  if (restLength < 1e-6 || posedLength < 1e-6) return point.clone();
  const restDirection = restVector.clone().multiplyScalar(1 / restLength);
  const rotation = new THREE.Quaternion().setFromUnitVectors(restDirection, posedVector.clone().multiplyScalar(1 / posedLength));
  const offset = point.clone().sub(restStart);
  const along = offset.dot(restDirection);
  const parallel = restDirection.clone().multiplyScalar(along * (posedLength / restLength));
  const perpendicular = offset.sub(restDirection.clone().multiplyScalar(along));
  return posedStart.clone().add(parallel.add(perpendicular).applyQuaternion(rotation));
}

function poseStraightenerDeform() {
  const state = poseStraightenerState;
  const position = state.target?.geometry?.getAttribute?.("position");
  if (!position || !state.sourcePositions || state.restPoints.length < 2) return;
  const result = new position.array.constructor(state.sourcePositions.length);
  const softness = Number(poseStraightenerUi.softness?.value || 35) / 100;
  const exponent = THREE.MathUtils.lerp(12, 2.2, softness);
  const point = new THREE.Vector3();
  for (let offset = 0; offset < state.sourcePositions.length; offset += 3) {
    point.fromArray(state.sourcePositions, offset);
    const candidates = [];
    for (let index = 0; index < state.restPoints.length - 1; index += 1) {
      const closest = poseStraightenerClosestPoint(point, state.restPoints[index], state.restPoints[index + 1]);
      candidates.push({ distance: point.distanceTo(closest), transformed: poseStraightenerTransformPoint(point, index) });
    }
    candidates.sort((a, b) => a.distance - b.distance);
    const used = softness <= .01 ? candidates.slice(0, 1) : candidates.slice(0, 2);
    const blended = new THREE.Vector3();
    let totalWeight = 0;
    for (const candidate of used) {
      const weight = 1 / Math.pow(Math.max(candidate.distance, 1e-5), exponent);
      blended.addScaledVector(candidate.transformed, weight);
      totalWeight += weight;
    }
    blended.multiplyScalar(1 / Math.max(totalWeight, 1e-8));
    result[offset] = blended.x;
    result[offset + 1] = blended.y;
    result[offset + 2] = blended.z;
  }
  poseStraightenerWritePositions(result);
  poseStraightenerRefreshHelpers();
}

function startPoseStraightener() {
  if (poseStraightenerState.active) cancelPoseStraightener({ announce: false });
  if (!poseStraightenerTargetIsUsable(selected)) {
    poseStraightenerSetStatus("Select one editable mesh first, then press Start Joint Chain.");
    log("Pose Straightener needs one editable mesh selected.");
    return;
  }
  const position = selected.geometry.getAttribute("position");
  Object.assign(poseStraightenerState, {
    active: true,
    placing: true,
    target: selected,
    sourcePositions: position.array.slice(),
    restPoints: [],
    posedPoints: [],
    selectedJoint: 0
  });
  transform.detach();
  transform.visible = false;
  poseStraightenerSetStatus("Click joint 1 on the selected mesh. Keep adding as many as needed, then press Finish Chain.");
  poseStraightenerUpdateUi();
  log(`Pose Straightener armed for ${selected.name}. Place any number of joints, then finish the chain.`);
}

function poseStraightenerSelectJointFromEvent(event) {
  const state = poseStraightenerState;
  if (!poseStraightenerReady() || poseStraightenerTransform.dragging) return false;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(state.jointMarkers, false)[0];
  if (!hit) return false;
  state.selectedJoint = Number(hit.object.userData.poseStraightenerJointIndex) || 0;
  const terminalNote = state.selectedJoint === state.restPoints.length - 1 ? " This is the end joint, so it has no following section to rotate." : " Drag the rotation joystick to bend every following section.";
  poseStraightenerSetStatus(`Joint ${state.selectedJoint + 1} selected directly.${terminalNote}`);
  poseStraightenerUpdateUi();
  return true;
}

function poseStraightenerAddPointFromEvent(event) {
  const state = poseStraightenerState;
  if (!state.active || !state.placing || !state.target) return false;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObject(state.target, false)[0];
  if (!hit) {
    poseStraightenerSetStatus(`Joint ${state.restPoints.length + 1}: click directly on the selected mesh.`);
    return true;
  }
  const localPoint = state.target.worldToLocal(hit.point.clone());
  state.restPoints.push(localPoint.clone());
  state.posedPoints.push(localPoint.clone());
  state.selectedJoint = state.restPoints.length - 1;
  poseStraightenerSetStatus(`Joint ${state.restPoints.length} placed. Click to add another, or press Finish Chain.`);
  poseStraightenerUpdateUi();
  return true;
}

function finishPoseStraightenerChain() {
  const state = poseStraightenerState;
  if (!state.active || !state.placing || state.restPoints.length < 2) return;
  state.placing = false;
  state.selectedJoint = state.restPoints.length > 2 ? 1 : 0;
  poseStraightenerSetStatus(`Chain ready with ${state.restPoints.length} joints. Click any joint sphere and rotate it with the joystick.`);
  poseStraightenerUpdateUi();
  log(`Pose Straightener chain ready with ${state.restPoints.length} joints. Manual node rotation is active.`);
}

function poseStraightenerSelectJoint(delta) {
  const state = poseStraightenerState;
  if (!poseStraightenerReady()) return;
  state.selectedJoint = (state.selectedJoint + delta + state.restPoints.length) % state.restPoints.length;
  poseStraightenerSetStatus(`Joint ${state.selectedJoint + 1} selected. Rotation moves every following section.`);
  poseStraightenerUpdateUi();
}

function rotatePoseStraightenerJoint() {
  const state = poseStraightenerState;
  if (!poseStraightenerReady() || state.selectedJoint >= state.restPoints.length - 1) return;
  const degrees = [poseStraightenerUi.rotateX, poseStraightenerUi.rotateY, poseStraightenerUi.rotateZ].map(input => Number(input?.value || 0));
  if (!degrees.every(Number.isFinite) || degrees.every(value => Math.abs(value) < 1e-6)) {
    poseStraightenerSetStatus("Enter a non-zero X, Y, or Z rotation for the selected joint.");
    return;
  }
  const radians = degrees.map(value => THREE.MathUtils.degToRad(value));
  const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(radians[0], radians[1], radians[2], "XYZ"));
  const pivot = state.posedPoints[state.selectedJoint].clone();
  for (let index = state.selectedJoint + 1; index < state.posedPoints.length; index += 1) state.posedPoints[index].sub(pivot).applyQuaternion(rotation).add(pivot);
  poseStraightenerDeform();
  poseStraightenerSetStatus(`Rotated joint ${state.selectedJoint + 1}. Apply to keep it or Cancel to restore the mesh.`);
}

function straightenPoseStraightenerChain() {
  const state = poseStraightenerState;
  if (!poseStraightenerReady()) return;
  let direction = state.posedPoints[state.posedPoints.length - 1].clone().sub(state.posedPoints[0]);
  if (direction.lengthSq() < 1e-10) direction = state.restPoints[1].clone().sub(state.restPoints[0]);
  if (direction.lengthSq() < 1e-10) direction.set(0, -1, 0);
  direction.normalize();
  const straight = [state.posedPoints[0].clone()];
  for (let index = 0; index < state.restPoints.length - 1; index += 1) straight.push(straight[index].clone().addScaledVector(direction, state.restPoints[index].distanceTo(state.restPoints[index + 1])));
  state.posedPoints = straight;
  poseStraightenerDeform();
  poseStraightenerSetStatus("Chain straightened. Use joint rotation for the foot angle, then Apply to Mesh.");
  log("Pose Straightener aligned the temporary chain and updated the mesh preview.");
}

function resetPoseStraightenerShape() {
  const state = poseStraightenerState;
  if (!state.active) return;
  state.posedPoints = state.restPoints.map(point => point.clone());
  poseStraightenerWritePositions(state.sourcePositions);
  poseStraightenerRefreshHelpers();
  poseStraightenerSetStatus("Shape reset to its original placement. The chain is still ready.");
}

function cancelPoseStraightener({ announce = true } = {}) {
  const state = poseStraightenerState;
  if (state.active && state.target && state.sourcePositions) poseStraightenerWritePositions(state.sourcePositions);
  poseStraightenerDisposeHelpers();
  Object.assign(state, { active: false, placing: false, target: null, sourcePositions: null, restPoints: [], posedPoints: [], selectedJoint: 0, dragStartPoints: null, dragStartQuaternion: null, dragMeshWorldQuaternion: null });
  poseStraightenerSetStatus("Select one mesh, then place joints from the top of the part to its end.");
  poseStraightenerUpdateUi();
  updateTransformAttachment();
  if (announce) log("Pose Straightener cancelled. The original mesh was restored.");
}

function applyPoseStraightener() {
  const state = poseStraightenerState;
  const position = state.target?.geometry?.getAttribute?.("position");
  if (!poseStraightenerReady() || !position) return;
  const finalPositions = position.array.slice();
  poseStraightenerWritePositions(state.sourcePositions);
  recordHistory("pose straighten mesh");
  poseStraightenerWritePositions(finalPositions);
  const targetName = state.target.name;
  state.target.userData.geometry = geometryToData(state.target.geometry);
  poseStraightenerDisposeHelpers();
  Object.assign(state, { active: false, placing: false, target: null, sourcePositions: null, restPoints: [], posedPoints: [], selectedJoint: 0, dragStartPoints: null, dragStartQuaternion: null, dragMeshWorldQuaternion: null });
  poseStraightenerSetStatus("Applied. Select another mesh or place a new chain to continue.");
  poseStraightenerUpdateUi();
  updateTransformAttachment();
  updateAll();
  log(`Pose Straightener baked the new shape into ${targetName}.`, { mesh: targetName, undoReady: true });
}

poseStraightenerUi.start?.addEventListener("click", startPoseStraightener);
poseStraightenerUi.finish?.addEventListener("click", finishPoseStraightenerChain);
poseStraightenerUi.cancel?.addEventListener("click", () => cancelPoseStraightener());
poseStraightenerUi.previous?.addEventListener("click", () => poseStraightenerSelectJoint(-1));
poseStraightenerUi.next?.addEventListener("click", () => poseStraightenerSelectJoint(1));
poseStraightenerUi.rotate?.addEventListener("click", rotatePoseStraightenerJoint);
poseStraightenerUi.straighten?.addEventListener("click", straightenPoseStraightenerChain);
poseStraightenerUi.reset?.addEventListener("click", resetPoseStraightenerShape);
poseStraightenerUi.apply?.addEventListener("click", applyPoseStraightener);
poseStraightenerUi.softness?.addEventListener("input", () => {
  poseStraightenerUi.softnessOutput.textContent = `${poseStraightenerUi.softness.value}%`;
  if (poseStraightenerReady()) poseStraightenerDeform();
});

// Joint spheres win over overlapping rotation rings. This capture listener lets
// tightly spaced chains remain directly selectable without hiding the joystick.
renderer.domElement.addEventListener("pointerdown", event => {
  if (event.button !== 0 || !poseStraightenerSelectJointFromEvent(event)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
}, true);

poseStraightenerUpdateUi();
