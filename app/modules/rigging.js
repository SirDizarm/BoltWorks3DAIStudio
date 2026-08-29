const boneRigGroup = new THREE.Group();
boneRigGroup.name = "Bone Placement Guides";
boneRigGroup.userData.editorHelper = true;
scene.add(boneRigGroup);

const boneGridAxisGroup = new THREE.Group();
boneGridAxisGroup.name = "Grid Axis Directions";
boneGridAxisGroup.userData.editorHelper = true;
scene.add(boneGridAxisGroup);

function buildGridAxisDirections() {
  const extent = 8;
  const lift = .006;
  const xGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-extent, lift, 0),
    new THREE.Vector3(extent, lift, 0)
  ]);
  const zGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, lift, -extent),
    new THREE.Vector3(0, lift, extent)
  ]);
  const xLine = new THREE.Line(xGeometry, new THREE.LineBasicMaterial({
    color: 0xe55555,
    depthTest: true,
    depthWrite: false,
    transparent: true,
    opacity: .55
  }));
  const zLine = new THREE.Line(zGeometry, new THREE.LineBasicMaterial({
    color: 0x5f8fe8,
    depthTest: true,
    depthWrite: false,
    transparent: true,
    opacity: .55
  }));
  boneGridAxisGroup.add(xLine, zLine);
}

buildGridAxisDirections();

let rigBones = [];
let selectedBoneId = null;
let boneToolMode = null;
let boneMoveAxis = null;
let boneDrag = null;
// Bone-local gizmo mode: "rotate" or "translate". Independent of the
// mesh toolbar so rotating a bone doesn't require enabling the mesh Move tool.
let boneGizmoToolMode = "translate";
// Whether the bone gizmo is shown at all; the Move/Rotate buttons toggle this
// off when you click the already-active mode (like the Free/X/Y/Z lock).
let boneGizmoEnabled = false;
// The guides are only an editor overlay. Keep them small by default so their
// centres can be judged against the model rather than hiding it.
let boneGuideScale = .4;
let mirrorBoneEdits = false;
const T_POSE_CLIP_ID = "__t_pose_fitting__";
let tPoseFittingMode = false;
let skeletonDisplayMode = false;
let skeletonPreviousOpacity = null;
let rigSelectionTarget = "bone";
let modelingSelectionTarget = ["all", "skin", "armor", "bone"].includes(localStorage.getItem("boltworks.modelingSelectionTarget"))
  ? localStorage.getItem("boltworks.modelingSelectionTarget")
  : "all";
let boneTransformLooseStart = null;
let rigModelOpacity = 1;
const rigModelMaterialState = new Map();
let boneRotationStepDegrees = 15;
// Whether the rig is glued to the model (bound parts follow the bones live).
let bonesGlued = false;
const animationState = { fps: 24, end: 48, frame: 0, playing: false, lastTime: 0, keys: {}, clips: { idle: { name: "Idle", fps: 24, end: 48, keys: {} } }, activeClipId: "idle", bindingRest: null };
let bwsAnimationSequence = [];
let activeSkinRuntime = null;
const boneRaycaster = new THREE.Raycaster();
boneRaycaster.layers.enable(1);
boneRaycaster.layers.enable(2);
const bonePointer = new THREE.Vector2();
const boneDragPlane = new THREE.Plane();
const boneDragHit = new THREE.Vector3();
const mainBoneRaycaster = new THREE.Raycaster();

const boneTransformProxy = new THREE.Object3D();
boneTransformProxy.name = "Bone Transform Proxy";
boneTransformProxy.userData.editorHelper = true;
scene.add(boneTransformProxy);

// Dashed guide rings around the selected bone (one per axis) so the rotation
// direction is clearly visible in the main view. They follow the proxy.
const boneRingGuideGroup = new THREE.Group();
boneRingGuideGroup.name = "Bone Rotation Guide Rings";
boneRingGuideGroup.userData.editorHelper = true;
boneRingGuideGroup.visible = false;
scene.add(boneRingGuideGroup);

function buildBoneRingGuides() {
  while (boneRingGuideGroup.children.length) {
    const c = boneRingGuideGroup.children.pop();
    c.geometry?.dispose?.();
    c.material?.dispose?.();
  }
  const mk = (axis, color) => {
    const pts = [];
    const segs = 64, r = .5;
    for (let i = 0; i <= segs; i += 1) {
      const a = i / segs * Math.PI * 2;
      if (axis === "x") pts.push(new THREE.Vector3(0, Math.sin(a) * r, Math.cos(a) * r));
      else if (axis === "y") pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
      else pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0));
    }
    const ring = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineDashedMaterial({ color, depthTest: false, dashSize: .05, gapSize: .03, transparent: true, opacity: .9 })
    );
    ring.computeLineDistances();
    ring.renderOrder = 10003;
    ring.userData.boneRingGuide = axis;
    return ring;
  };
  boneRingGuideGroup.add(mk("x", 0xe55555), mk("y", 0x69d17d), mk("z", 0x5f8fe8));
}
buildBoneRingGuides();

// Kept only so older export code can preserve helper visibility without
// breaking. The former joystick geometry and pointer handling were removed;
// TransformControls now owns all bone rotation interaction.
const boneJoystickGroup = new THREE.Group();
boneJoystickGroup.name = "Bone Rotation Joystick";
boneJoystickGroup.userData.editorHelper = true;
boneJoystickGroup.visible = false;
scene.add(boneJoystickGroup);

function syncBoneJoystick() {
  // Retained as a hidden export helper for older project files. Rotation is
  // now handled exclusively by TransformControls' standard RGB rings.
  boneJoystickGroup.visible = false;
}

function recordBoneHistory(label) {
  if (typeof recordHistory === "function" && !(typeof isRestoring !== "undefined" && isRestoring)) recordHistory(label);
}


const boneTransform = new TransformControls(camera, renderer.domElement);
boneTransform.visible = false;
boneTransform.setSize(.9);
boneTransform.addEventListener("dragging-changed", event => {
  orbit.enabled = !event.value;
  if (event.value && selectedBone()) {
    recordBoneHistory("bone transform");
    if (tPoseFittingMode || (!bonesGlued && !activeSkinRuntime)) {
      const bone = selectedBone();
      const mirror = boneById(mirroredBoneId(bone.id));
      boneTransformLooseStart = {
        boneId: bone.id,
        mode: boneTransform.mode,
        position: bone.position.clone(),
        rotation: bone.rotation.clone(),
        mirrorId: mirror?.id || null,
        mirrorPosition: mirror?.position.clone() || null,
        mirrorRotation: mirror?.rotation.clone() || null
      };
    }
    if (boneTransform.mode === "rotate") prepareLooseBoneHierarchy();
  } else if (!event.value && boneTransformLooseStart) {
    const start = boneTransformLooseStart;
    boneTransformLooseStart = null;
    if (tPoseFittingMode) {
      commitTPoseBoneFitting();
    } else if (start.mode === "rotate") {
      commitLooseBoneRotation(start.boneId, start.rotation);
      if (start.mirrorId && start.mirrorRotation) commitLooseBoneRotation(start.mirrorId, start.mirrorRotation);
    } else {
      commitLooseBonePosition(start.boneId, start.position);
      if (start.mirrorId && start.mirrorPosition) commitLooseBonePosition(start.mirrorId, start.mirrorPosition);
    }
  }
});
boneTransform.addEventListener("objectChange", () => {
  const bone = selectedBone();
  if (!bone || !boneTransform.dragging) return;
  if (boneTransform.mode === "translate") {
    bone.position.copy(boneTransformProxy.position);
    applyCurrentRigPose();
    mirrorBoneEdit(bone, { position: true, rotation: false, tail: true });
  } else {
    bone.rotation.x = boneTransformProxy.rotation.x;
    bone.rotation.y = boneTransformProxy.rotation.y;
    bone.rotation.z = boneTransformProxy.rotation.z;
    applyCurrentRigPose({ resolveLooseHierarchy: true });
    mirrorBoneEdit(bone, { position: false, rotation: true, tail: false });
  }
  if (mirrorBoneEdits) applyCurrentRigPose({ resolveLooseHierarchy: boneTransform.mode === "rotate" });
  rebuildBoneVisuals();
  syncBonePanel();
});
scene.add(boneTransform);

function boneGizmoMode() {
  return boneGizmoToolMode === "translate" ? "translate" : "rotate";
}

function setBoneGizmoEnabled(enabled, mode = boneGizmoToolMode) {
  boneGizmoToolMode = mode === "translate" ? "translate" : "rotate";
  boneGizmoEnabled = !!enabled;
  boneToolMode = boneGizmoEnabled && boneGizmoToolMode === "translate" && boneMoveAxis ? "move" : null;
  els.boneModeMoveBtn?.classList.toggle("active", boneGizmoEnabled && boneGizmoToolMode === "translate");
  els.boneModeRotateBtn?.classList.toggle("active", boneGizmoEnabled && boneGizmoToolMode === "rotate");
  els.boneModeScaleBtn?.classList.remove("active");
}

function setBoneGizmoToolMode(mode) {
  const next = mode === "translate" ? "translate" : "rotate";
  // Clicking the active mode again turns the gizmo off (toggling).
  if (boneGizmoToolMode === next && boneGizmoEnabled) {
    boneGizmoEnabled = false;
  } else {
    boneGizmoToolMode = next;
    boneGizmoEnabled = true;
  }
  setBoneGizmoEnabled(boneGizmoEnabled, boneGizmoToolMode);
  syncBoneTransformGizmo();
}

function applyBoneAxisLock() {
  const free = !boneMoveAxis || boneMoveAxis === "free";
  boneTransform.showX = free || boneMoveAxis === "x";
  boneTransform.showY = free || boneMoveAxis === "y";
  boneTransform.showZ = free || boneMoveAxis === "z";
}

function normalizedBoneRotationStep(value = els.boneRotationStepInput?.value) {
  return THREE.MathUtils.clamp(Math.round(Number(value) || 15), 1, 90);
}

function syncBoneRotationSnap() {
  boneRotationStepDegrees = normalizedBoneRotationStep();
  if (els.boneRotationStepInput && document.activeElement !== els.boneRotationStepInput) {
    els.boneRotationStepInput.value = String(boneRotationStepDegrees);
  }
  const stepped = boneGizmoEnabled && boneGizmoToolMode === "rotate" && (isCtrlHeld || isShiftHeld);
  const radians = stepped ? THREE.MathUtils.degToRad(boneRotationStepDegrees) : null;
  if (typeof boneTransform.setRotationSnap === "function") boneTransform.setRotationSnap(radians);
  else boneTransform.rotationSnap = radians;
  if (els.boneRotationStepStatus) {
    els.boneRotationStepStatus.textContent = stepped
      ? `Stepping ${boneRotationStepDegrees} degrees`
      : "Hold Ctrl or Shift for steps";
  }
}

function syncBoneTransformGizmo() {
  const bone = selectedBone();
  if (!bone || !boneRigGroup.visible || !boneGizmoEnabled) {
    if (!boneTransform.dragging) {
      boneTransform.detach();
      boneTransform.visible = false;
    }
    return;
  }
  const mode = boneGizmoMode();
  boneTransform.setMode(mode);
  boneTransform.setSpace(mode === "rotate" ? "local" : "world");
  applyBoneAxisLock();
  syncBoneRotationSnap();
  if (!boneTransform.dragging) {
    boneTransformProxy.position.copy(bone.displayPosition || bone.position);
    boneTransformProxy.rotation.set(bone.rotation.x, bone.rotation.y, bone.rotation.z);
    boneTransform.attach(boneTransformProxy);
    boneTransform.visible = true;
  }
  // TransformControls supplies the familiar red X, green Y, and blue Z rings.
  boneRingGuideGroup.visible = false;
  syncBoneJoystick();
}

function pickBoneFromMainPointer(event) {
  if (!activeViewportSelectionTargetsBones()) return null;
  if (!boneRigGroup.visible || !rigBones.length) return null;
  const rect = renderer.domElement.getBoundingClientRect();
  bonePointer.x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
  bonePointer.y = -((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
  mainBoneRaycaster.setFromCamera(bonePointer, camera);
  const hit = mainBoneRaycaster.intersectObjects(boneRigGroup.children.filter(child => child.userData.boneJoint), false)[0];
  return hit?.object?.userData?.boneId || null;
}

function selectBoneFromViewport(boneId) {
  const bone = boneById(boneId);
  if (!bone) return;
  selectedBoneId = boneId;
  if (typeof selectObject === "function") selectObject(null);
  rebuildBoneVisuals();
  syncBonePanel();
  log(`Selected bone: ${bone.name}. Drag the gizmo to ${boneGizmoMode() === "translate" ? "move" : "rotate"} it (Move/Rotate toolbar buttons switch mode).`);
}

function syncRigSelectionTargetUi() {
  const labels = {
    bone: "Viewport picks bones only",
    skin: "Viewport picks skin only",
    armor: "Viewport picks armor only"
  };
  els.selectTargetBoneBtn?.classList.toggle("active", rigSelectionTarget === "bone");
  els.selectTargetSkinBtn?.classList.toggle("active", rigSelectionTarget === "skin");
  els.selectTargetArmorBtn?.classList.toggle("active", rigSelectionTarget === "armor");
  if (els.selectTargetStatus) els.selectTargetStatus.textContent = labels[rigSelectionTarget];
  if (els.rigTransformToolLabel) els.rigTransformToolLabel.textContent = rigSelectionTarget === "bone" ? "Bone tool:" : `${rigSelectionTarget === "armor" ? "Armor" : "Skin"} tool:`;
  if (rigSelectionTarget !== "bone" && typeof activeTransformMode !== "undefined") {
    els.boneModeMoveBtn?.classList.toggle("active", activeTransformMode === "translate");
    els.boneModeRotateBtn?.classList.toggle("active", activeTransformMode === "rotate");
    els.boneModeScaleBtn?.classList.toggle("active", activeTransformMode === "scale");
  }
  if (els.boneModeScaleBtn) els.boneModeScaleBtn.disabled = rigSelectionTarget === "bone";
}

function syncModelSelectionTargetUi() {
  els.modelSelectTargetAllBtn?.classList.toggle("active", modelingSelectionTarget === "all");
  els.modelSelectTargetSkinBtn?.classList.toggle("active", modelingSelectionTarget === "skin");
  els.modelSelectTargetArmorBtn?.classList.toggle("active", modelingSelectionTarget === "armor");
  els.modelSelectTargetBoneBtn?.classList.toggle("active", modelingSelectionTarget === "bone");
}

function selectedObjectRigRole(object) {
  return object?.userData?.rigRole || "skin";
}

function setModelingSelectionTarget(target) {
  const next = ["all", "skin", "armor", "bone"].includes(target) ? target : "all";
  modelingSelectionTarget = next;
  localStorage.setItem("boltworks.modelingSelectionTarget", next);
  if (next === "bone") {
    if (typeof selectObject === "function") selectObject(null);
  } else {
    if (selectedBoneId) {
      selectedBoneId = null;
      rebuildBoneVisuals();
      syncBonePanel();
    }
    if (next !== "all" && typeof selected !== "undefined" && selected && selectedObjectRigRole(selected) !== next) {
      selectObject(null);
    }
  }
  syncModelSelectionTargetUi();
  log(`Modeling viewport selection now targets ${next}.`);
}

function setRigTargetTransformMode(mode) {
  const next = ["translate", "rotate", "scale"].includes(mode) ? mode : "translate";
  if (rigSelectionTarget === "bone") {
    if (next === "scale") {
      log("Select Skin or Armor to use the Scale tool. Bone anatomy size uses the Width, Height, and Depth controls.");
      return;
    }
    setBoneGizmoToolMode(next);
    return;
  }
  if (typeof setTransformMode !== "function") return;
  if (activeTransformMode !== next) setTransformMode(next);
  else if (typeof updateTransformAttachment === "function") updateTransformAttachment();
  syncRigSelectionTargetUi();
}

function ensureRigObjectMoveTool() {
  if (rigSelectionTarget === "bone" || typeof setTransformMode !== "function") return;
  if (activeTransformMode !== "translate") setTransformMode("translate");
  else if (typeof updateTransformAttachment === "function") updateTransformAttachment();
  syncRigSelectionTargetUi();
}

function setRigSelectionTarget(target) {
  const next = ["bone", "skin", "armor"].includes(target) ? target : "bone";
  rigSelectionTarget = next;
  if (next === "bone") {
    if (typeof selectObject === "function") selectObject(null);
  } else {
    selectedBoneId = null;
    rebuildBoneVisuals();
    syncBonePanel();
    if (typeof selected !== "undefined" && selected && selectedObjectRigRole(selected) !== next) {
      selectObject(null);
    }
    ensureRigObjectMoveTool();
  }
  syncRigSelectionTargetUi();
  log(`Viewport selection now targets ${next}.`);
}

function rigSelectionTargetsBones() {
  return rigSelectionTarget === "bone";
}

function activeViewportSelectionTarget() {
  return document.body.classList.contains("animator-workspace-active") ? rigSelectionTarget : modelingSelectionTarget;
}

function activeViewportSelectionTargetsBones() {
  return activeViewportSelectionTarget() === "bone";
}

function rigTargetedObjectHit(event, target = rigSelectionTarget) {
  if (!["skin", "armor"].includes(target) || typeof hitsFromPointerEvent !== "function") return null;
  const hit = hitsFromPointerEvent(event).find(candidate => {
    const role = candidate.object?.userData?.rigRole || "skin";
    return role === target;
  });
  return hit || null;
}

function viewportTargetedObjectHit(event) {
  const target = activeViewportSelectionTarget();
  if (target === "all") return hitFromPointerEvent(event);
  if (target === "bone") return null;
  return rigTargetedObjectHit(event, target);
}

function boneById(id) {
  return rigBones.find(bone => bone.id === id) || null;
}

function mirroredBoneId(id) {
  if (typeof id !== "string") return null;
  if (id.includes("left_")) return id.replace("left_", "right_");
  if (id.includes("right_")) return id.replace("right_", "left_");
  if (id.endsWith("_l")) return `${id.slice(0, -2)}_r`;
  if (id.endsWith("_r")) return `${id.slice(0, -2)}_l`;
  return null;
}

function mirrorBoneEdit(source, { position = true, rotation = true, tail = true } = {}) {
  if (!mirrorBoneEdits) return null;
  const target = boneById(mirroredBoneId(source.id));
  if (!target) return null;
  if (position) target.position.set(-source.position.x, source.position.y, source.position.z);
  if (tail) target.tail.set(-source.tail.x, source.tail.y, source.tail.z);
  if (rotation) {
    // The model is mirrored over the X=0 centre plane. Keep the bend around
    // the limb axis and invert the two axes whose handedness changes. This is
    // stable during a live joystick drag (unlike matrix-to-Euler conversion).
    target.rotation.set(source.rotation.x, -source.rotation.y, -source.rotation.z);
  }
  return target;
}

function syncTPoseFittingUi() {
  if (els.tPoseFittingStatus) els.tPoseFittingStatus.textContent = tPoseFittingMode
    ? "T-Pose / Rig Fitting selected"
    : "Select T-Pose from the Animation Clip menu to fit the rig";
  if (els.addGripHandsBtn) els.addGripHandsBtn.disabled = !tPoseFittingMode;
  document.body.classList.toggle("t-pose-fitting-active", tPoseFittingMode);
  for (const control of [els.animationPlayBtn, els.animationStopBtn, els.animationPrevBtn, els.animationNextBtn, els.animationResetBtn, els.animationScrubber, els.animationKeyBtn, els.animationDeleteFrameBtn, els.animationClearBtn, els.animationClipDeleteBtn, els.animationFpsInput, els.animationEndInput]) {
    if (control) control.disabled = tPoseFittingMode;
  }
}

function setTPoseFittingMode(enabled) {
  const next = !!enabled;
  if (next === tPoseFittingMode) return;
  animationState.playing = false;
  tPoseFittingMode = next;
  if (tPoseFittingMode) {
    syncActiveAnimationClip();
    restoreAnimationBindPose({ render: false });
    applyCurrentRigPose();
    log("T-Pose / Rig Fitting selected. Animation playback is suspended and the fitted bind pose is now authoritative.");
  } else {
    captureAnimationBindingRest();
    log("T-Pose / Rig Fitting finished. Saved the fitted bone, armor, hand, and item-socket offsets.");
  }
  rebuildBoneVisuals();
  syncBonePanel();
  updateAnimationPanel();
  syncTPoseFittingUi();
  syncAnimationClipUi();
  if (typeof syncAnimatorClipSelect === "function") syncAnimatorClipSelect();
  if (rigSelectionTarget !== "bone" && typeof updateTransformAttachment === "function") {
    requestAnimationFrame(updateTransformAttachment);
  }
}

function commitTPoseBoneFitting() {
  if (!tPoseFittingMode) return;
  const previousBindPose = snapshotRigBindPose();
  for (const bone of rigBones) {
    bone.bindPosition = bone.position.clone();
    bone.bindRotation = bone.rotation.clone();
    bone.bindTail = (bone.tail || bone.position.clone().add(new THREE.Vector3(0, .12, 0))).clone();
    bone.tailOffset = bone.bindTail.clone().sub(bone.bindPosition);
  }
  rigBones.forEach(bone => initializeBoneRestState(bone));
  rebaseAnimationKeysToBindPose(previousBindPose);
  if (activeSkinRuntime) setupSkinnedRig();
  captureAnimationBindingRest();
  applyCurrentRigPose();
}

function addGripHandRig() {
  if (!tPoseFittingMode) {
    log("Enter T-Pose Fitting before adding grip hands.");
    return;
  }
  const sides = ["L", "R"];
  recordBoneHistory("add grip hands");
  const fingerNames = ["Thumb", "Index", "Middle", "Ring", "Pinky"];
  let added = 0, realigned = 0;
  for (const side of sides) {
    const hand = rigBones.find(bone => bone.name === `Hand ${side}`);
    if (!hand) continue;
    const outward = (hand.bindTail || hand.tail).clone().sub(hand.bindPosition || hand.position);
    if (outward.lengthSq() < .0001) outward.set(side === "L" ? -.14 : .14, 0, 0);
    const handStart = (hand.bindPosition || hand.position).clone();
    const handEnd = handStart.clone().add(outward);
    const forward = new THREE.Vector3(0, 0, Math.max(.018, outward.length() * .14));
    fingerNames.forEach((fingerName, index) => {
      const spread = (index - 2) * Math.max(.012, outward.length() * .075);
      // T-pose palms stand in the X/Y plane. Spreading along Z made the generated
      // fingers lie flat like a hand resting on a table when viewed from Front.
      const spreadVector = new THREE.Vector3(0, spread, 0);
      const rootRatio = fingerName === "Thumb" ? .28 : .48;
      const tipRatio = fingerName === "Thumb" ? .72 : 1;
      const position = handStart.clone().addScaledVector(outward, rootRatio).add(spreadVector);
      const tail = handStart.clone().addScaledVector(outward, tipRatio).add(spreadVector);
      if (fingerName === "Thumb") tail.add(forward).add(new THREE.Vector3(0, -Math.max(.012, outward.length() * .1), 0));
      let bone = rigBones.find(candidate => candidate.name === `${fingerName} ${side}`);
      if (bone) {
        bone.parentId = hand.id;
        bone.role = "finger";
        bone.avatarObjectId = hand.avatarObjectId || null;
        bone.position.copy(position);
        bone.rotation.set(0, 0, 0);
        bone.tail.copy(tail);
        initializeBoneRestState(bone, { capture: true });
        realigned += 1;
      } else {
        bone = {
          id: `finger_${fingerName.toLowerCase()}_${side.toLowerCase()}`,
          name: `${fingerName} ${side}`,
          parentId: hand.id,
          role: "finger",
          avatarObjectId: hand.avatarObjectId || null,
          position,
          rotation: new THREE.Vector3(),
          tail
        };
        rigBones.push(bone);
        initializeBoneRestState(bone, { capture: true });
        added += 1;
      }
    });
    const position = handStart.clone().addScaledVector(outward, .58);
    let socket = rigBones.find(bone => bone.name === `Grip Socket ${side}`);
    if (!socket) {
      socket = {
        id: `grip_socket_${side.toLowerCase()}`,
        name: `Grip Socket ${side}`,
        parentId: hand.id,
        role: "itemSocket",
        avatarObjectId: null,
        position,
        rotation: new THREE.Vector3(0, side === "L" ? Math.PI / 2 : -Math.PI / 2, 0),
        tail: position.clone().add(new THREE.Vector3(0, .08, 0))
      };
      rigBones.push(socket);
      added += 1;
    } else {
      socket.parentId = hand.id;
      socket.role = "itemSocket";
      socket.avatarObjectId = null;
      socket.position.copy(position);
      socket.rotation.set(0, side === "L" ? Math.PI / 2 : -Math.PI / 2, 0);
      socket.tail.copy(position).add(new THREE.Vector3(0, .08, 0));
      realigned += 1;
    }
    initializeBoneRestState(socket, { capture: true });
  }
  const avatar = activeSkinRuntime?.avatar || objects.find(object => object.userData?.rigRole === "skin" && object.geometry?.getAttribute?.("position"));
  if (avatar?.geometry) {
    const skinBones = rigBones.filter(bone => bone.avatarObjectId && bone.role !== "itemSocket");
    addSkinAttributes(avatar.geometry, skinBones);
  }
  commitTPoseBoneFitting();
  rebuildBoneVisuals();
  syncBonePanel();
  updateAnimationPanel();
  log(`Grip hands fitted: added ${added} and realigned ${realigned} finger/socket bone${added + realigned === 1 ? "" : "s"}. Pose them in T-Pose Fitting; held items can use the Grip Socket bones.`);
}

function prepareLooseBoneHierarchy() {
  if (bonesGlued || activeSkinRuntime) return;
  // Keep every manually placed joint exactly where it is as the new loose rest
  // pose before a rotation swings its descendant chain.
  rigBones.forEach(bone => {
    bone.bindPosition = bone.position.clone();
    bone.bindRotation = bone.rotation.clone();
    bone.bindTail = bone.tail.clone();
    initializeBoneRestState(bone);
  });
}

function commitLooseBonePosition(boneId, startPosition) {
  if (bonesGlued || activeSkinRuntime || !startPosition) return;
  const bone = boneById(boneId);
  if (!bone) return;
  const delta = bone.position.clone().sub(startPosition);
  if (delta.lengthSq() < 1e-10) return;
  // A loose bone placement is a rest-pose edit, not an animation frame. Move
  // its bind point and every saved clip by the same amount so restore/Undo
  // cannot immediately overwrite the newly positioned joint with old keys.
  bone.bindPosition = (bone.bindPosition || startPosition).clone().add(delta);
  bone.bindTail = (bone.bindTail || bone.tail).clone().add(delta);
  bone.tail.copy((bone.tail || bone.bindTail).clone().add(delta));
  bone.tailOffset = bone.bindTail.clone().sub(bone.bindPosition);
  syncActiveAnimationClip();
  for (const clip of Object.values(animationState.clips || {})) {
    for (const key of clip?.keys?.[bone.id] || []) {
      if (!Array.isArray(key.position)) continue;
      key.position = [key.position[0] + delta.x, key.position[1] + delta.y, key.position[2] + delta.z];
    }
  }
}

function commitLooseBoneRotation(boneId, startRotation) {
  if (bonesGlued || activeSkinRuntime || !startRotation) return;
  const bone = boneById(boneId);
  if (!bone) return;
  const before = new THREE.Quaternion().setFromEuler(new THREE.Euler(startRotation.x, startRotation.y, startRotation.z, "XYZ"));
  const after = new THREE.Quaternion().setFromEuler(new THREE.Euler(bone.rotation.x, bone.rotation.y, bone.rotation.z, "XYZ"));
  const delta = after.clone().multiply(before.invert());
  if (Math.abs(delta.x) + Math.abs(delta.y) + Math.abs(delta.z) < 1e-8 && Math.abs(delta.w - 1) < 1e-8) return;
  bone.bindRotation = bone.rotation.clone();
  if (bone.tail) {
    bone.bindTail = bone.tail.clone();
    bone.tailOffset = bone.bindTail.clone().sub(bone.bindPosition || bone.position);
  }
  syncActiveAnimationClip();
  for (const clip of Object.values(animationState.clips || {})) {
    for (const key of clip?.keys?.[bone.id] || []) {
      if (!Array.isArray(key.rotation)) continue;
      const keyQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(key.rotation[0], key.rotation[1], key.rotation[2], "XYZ"));
      const updated = new THREE.Euler().setFromQuaternion(delta.clone().multiply(keyQuaternion), "XYZ");
      key.rotation = [updated.x, updated.y, updated.z];
    }
  }
}

function selectedBone() {
  return boneById(selectedBoneId);
}

function initializeBoneRestState(bone, { capture = false } = {}) {
  if (!bone) return bone;
  if (!bone.tail) bone.tail = bone.position.clone().add(new THREE.Vector3(0, .12, 0));
  if (capture || !bone.bindPosition) bone.bindPosition = bone.position.clone();
  if (capture || !bone.bindRotation) bone.bindRotation = bone.rotation.clone();
  if (capture || !bone.bindTail) bone.bindTail = bone.tail.clone();
  bone.tailOffset = bone.bindTail.clone().sub(bone.bindPosition);
  if (bone.tailOffset.lengthSq() < 1e-6) {
    bone.tailOffset.set(0, .12, 0);
    bone.bindTail.copy(bone.bindPosition).add(bone.tailOffset);
    bone.tail.copy(bone.bindTail);
  }
  const parent = boneById(bone.parentId);
  bone.restLocalPosition = parent
    ? bone.bindPosition.clone().sub(parent.bindPosition || parent.position)
    : bone.bindPosition.clone();
  return bone;
}

function snapshotRigBindPose() {
  return new Map(rigBones.map(bone => [bone.id, {
    position: (bone.bindPosition || bone.position).clone(),
    rotation: (bone.bindRotation || bone.rotation).clone()
  }]));
}

function rebaseAnimationKeysToBindPose(previousBindPose) {
  if (!(previousBindPose instanceof Map) || !previousBindPose.size) return;
  // The active key object normally aliases its clip, but imported/legacy files
  // may keep a separate copy. Visit each distinct key collection once.
  const keyCollections = new Set([animationState.keys]);
  Object.values(animationState.clips || {}).forEach(clip => {
    if (clip?.keys && typeof clip.keys === "object") keyCollections.add(clip.keys);
  });
  for (const keysByBone of keyCollections) {
    if (!keysByBone || typeof keysByBone !== "object") continue;
    for (const bone of rigBones) {
      const oldBind = previousBindPose.get(bone.id);
      const frames = keysByBone[bone.id];
      if (!oldBind || !Array.isArray(frames)) continue;
      const newBindPosition = bone.bindPosition || bone.position;
      const newBindRotation = bone.bindRotation || bone.rotation;
      const order = bone.blockbenchLocalRotation ? "ZYX" : "XYZ";
      const oldBindQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(
        oldBind.rotation.x, oldBind.rotation.y, oldBind.rotation.z, order
      ));
      const newBindQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(
        newBindRotation.x, newBindRotation.y, newBindRotation.z, order
      ));
      for (const frame of frames) {
        if (Array.isArray(frame.position) && frame.position.length >= 3) {
          const offset = new THREE.Vector3().fromArray(frame.position).sub(oldBind.position);
          frame.position = newBindPosition.clone().add(offset).toArray();
        }
        if (Array.isArray(frame.rotation) && frame.rotation.length >= 3) {
          const keyedQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(
            Number(frame.rotation[0]) || 0,
            Number(frame.rotation[1]) || 0,
            Number(frame.rotation[2]) || 0,
            order
          ));
          const animationDelta = keyedQuaternion.multiply(oldBindQuaternion.clone().invert());
          const rebasedQuaternion = animationDelta.multiply(newBindQuaternion);
          const rebasedEuler = new THREE.Euler().setFromQuaternion(rebasedQuaternion, order);
          frame.rotation = [rebasedEuler.x, rebasedEuler.y, rebasedEuler.z];
        }
      }
    }
  }
  syncActiveAnimationClip();
}

function captureRigBindPose() {
  // Freeze exactly what the user placed. This must happen before hierarchy
  // resolution; otherwise a newly-created child can snap back to its original
  // default location as soon as Glue is pressed.
  const previousBindPose = snapshotRigBindPose();
  rigBones.forEach(bone => {
    if (!bone.tail) bone.tail = bone.position.clone().add(new THREE.Vector3(0, .12, 0));
    bone.bindPosition = bone.position.clone();
    bone.bindRotation = bone.rotation.clone();
    bone.bindTail = bone.tail.clone();
  });
  rigBones.forEach(bone => initializeBoneRestState(bone));
  rebaseAnimationKeysToBindPose(previousBindPose);
  animationState.bindingRest = null;
}

function freshBoneId() {
  return `bone-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function syncActiveAnimationClip() {
  const id = animationState.activeClipId || "idle";
  animationState.activeClipId = id;
  animationState.clips ||= {};
  animationState.clips[id] = {
    name: animationState.clips[id]?.name || id,
    fps: animationState.fps,
    end: animationState.end,
    keys: animationState.keys
  };
}

function setActiveAnimationClip(id) {
  if (id === T_POSE_CLIP_ID) {
    if (!tPoseFittingMode) setTPoseFittingMode(true);
    else {
      animationState.playing = false;
      restoreAnimationBindPose();
      syncAnimationClipUi();
      if (typeof syncAnimatorClipSelect === "function") syncAnimatorClipSelect();
    }
    return;
  }
  if (!id || !animationState.clips?.[id]) return;
  const leavingTPose = tPoseFittingMode;
  if (leavingTPose) setTPoseFittingMode(false);
  if (id === animationState.activeClipId && !leavingTPose) return;
  syncActiveAnimationClip();
  const clip = animationState.clips[id];
  animationState.activeClipId = id;
  animationState.fps = Math.max(1, Math.min(120, Number(clip.fps) || 24));
  animationState.end = Math.max(1, Math.min(9999, Number(clip.end) || 48));
  animationState.keys = clip.keys && typeof clip.keys === "object" ? clip.keys : {};
  animationState.frame = 0;
  animationState.playing = false;
  animationSetFrame(0);
}

function addAnimationClip() {
  syncActiveAnimationClip();
  let count = Object.keys(animationState.clips).length + 1;
  let id = `clip-${count}`;
  while (animationState.clips[id]) id = `clip-${++count}`;
  animationState.clips[id] = { name: `Clip ${count}`, fps: animationState.fps, end: animationState.end, keys: {} };
  setActiveAnimationClip(id);
  log(`Created animation clip ${animationState.clips[id].name}.`);
}

function deleteActiveAnimationClip() {
  syncActiveAnimationClip();
  const ids = Object.keys(animationState.clips);
  if (ids.length <= 1) { log("A rig must keep at least one animation clip."); return; }
  const removedId = animationState.activeClipId;
  const removedName = animationState.clips[removedId]?.name || removedId;
  const nextId = ids.find(id => id !== removedId);
  delete animationState.clips[removedId];
  bwsAnimationSequence = bwsAnimationSequence.filter(id => id !== removedId);
  animationState.activeClipId = "";
  setActiveAnimationClip(nextId);
  log(`Deleted animation clip ${removedName}.`);
}

function syncAnimationClipUi() {
  if (!els.animationClipSelect) return;
  syncActiveAnimationClip();
  els.animationClipSelect.innerHTML = `<option value="${T_POSE_CLIP_ID}">T-Pose / Rig Fitting</option>` + Object.entries(animationState.clips)
    .map(([id, clip]) => `<option value="${animationTimelineEscape(id)}">${animationTimelineEscape(clip.name || id)}</option>`)
    .join("");
  els.animationClipSelect.value = tPoseFittingMode ? T_POSE_CLIP_ID : animationState.activeClipId;
  renderBwsAnimationSequence();
}

function hasBwsAnimationClips() { return Object.keys(animationState.clips || {}).length > 1; }
function renderBwsAnimationSequence() {
  if (!hasBwsAnimationClips() || !els.animationSequenceClipSelect) return;
  const clips = animationState.clips;
  els.animationSequenceClipSelect.disabled = false;
  els.animationSequenceClipSelect.innerHTML = Object.entries(clips).map(([id, clip]) => `<option value="${animationTimelineEscape(id)}">${animationTimelineEscape(clip.name || id)}</option>`).join("");
  if (!els.animationSequenceList) return;
  bwsAnimationSequence = bwsAnimationSequence.filter(id => clips[id]);
  els.animationSequenceList.innerHTML = bwsAnimationSequence.length
    ? bwsAnimationSequence.map(id => `<span class="animation-sequence-item">${animationTimelineEscape(clips[id].name || id)}</span>`).join('<span class="animation-sequence-arrow">→</span>')
    : '<span class="api-note">Add clips in any order, for example Idle → Walk → Reach.</span>';
}
function addBwsAnimationSequenceClip(id) {
  if (!animationState.clips?.[id]) return;
  bwsAnimationSequence.push(id);
  renderBwsAnimationSequence();
}
async function previewBwsAnimationSequence() {
  if (!bwsAnimationSequence.length) { log("Add clips to the connected animation first."); return; }
  const original = animationState.activeClipId;
  for (const id of bwsAnimationSequence) {
    setActiveAnimationClip(id);
    for (let frame = 0; frame <= animationState.end; frame += 1) {
      animationSetFrame(frame);
      await new Promise(resolve => setTimeout(resolve, 1000 / animationState.fps));
    }
  }
  setActiveAnimationClip(original);
}

// Build the baseline game-character skeleton from the selected mesh rather
// than from a mesh's own pivot.  This keeps a saved mannequin usable as the
// neutral character template: all equipment identifies stable semantic bone
// IDs (right_hand, head, chest, etc.), while the actual proportions come from
// the visible model bounds.
function createHumanoidTestRig() {
  let avatar = selected?.geometry?.getAttribute("position")
    ? selected
    : objects.find(object => object?.geometry?.getAttribute("position") && !object.userData?.editorHelper);
  if (!avatar) {
    log("Select the character mesh before creating a humanoid test rig.");
    return;
  }
  if (avatar.isSkinnedMesh || rigBones.some(bone => bone.avatarObjectId === avatar.userData.id)) {
    const avatarId = avatar.userData.id;
    unglueBonesFromModel();
    avatar = findObject(avatarId);
    rigBones = [];
  }
  recordBoneHistory("create humanoid test rig");
  avatar.updateWorldMatrix(true, false);
  const bounds = new THREE.Box3().setFromObject(avatar);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const minY = bounds.min.y;
  const maxY = bounds.max.y;
  const height = Math.max(size.y, .01);
  const halfWidth = Math.max(size.x * .5, height * .09);
  const halfDepth = Math.max(size.z * .5, height * .06);
  const y = fraction => minY + height * fraction;
  const point = (x, fraction, z = center.z) => new THREE.Vector3(x, y(fraction), z);
  const bone = (id, name, parentId, position, tail) => ({
    id,
    name,
    parentId,
    avatarObjectId: avatar.userData.id,
    position,
    rotation: new THREE.Vector3(),
    tail
  });
  const left = center.x - halfWidth;
  const right = center.x + halfWidth;
  const front = center.z + halfDepth * .38;
  const bones = [
    bone("root", "Root", null, point(center.x, .01), point(center.x, .48)),
    bone("pelvis", "Pelvis", "root", point(center.x, .48), point(center.x, .56)),
    bone("spine", "Spine", "pelvis", point(center.x, .56), point(center.x, .67)),
    bone("chest", "Chest", "spine", point(center.x, .67), point(center.x, .76)),
    bone("back", "Back Mount", "chest", point(center.x, .69, center.z - halfDepth * .28), point(center.x, .69, center.z - halfDepth * .7)),
    bone("neck", "Neck", "chest", point(center.x, .76), point(center.x, .83)),
    bone("head", "Head", "neck", point(center.x, .83), point(center.x, .97)),
    bone("left_upper_arm", "Upper Arm L", "chest", point(center.x - halfWidth * .15, .76), point(center.x - halfWidth * .57, .77)),
    bone("left_forearm", "Forearm L", "left_upper_arm", point(center.x - halfWidth * .57, .77), point(center.x - halfWidth * .93, .78)),
    bone("left_hand", "Hand L", "left_forearm", point(center.x - halfWidth * .93, .78), point(left - halfWidth * .04, .78)),
    bone("right_upper_arm", "Upper Arm R", "chest", point(center.x + halfWidth * .15, .76), point(center.x + halfWidth * .57, .77)),
    bone("right_forearm", "Forearm R", "right_upper_arm", point(center.x + halfWidth * .57, .77), point(center.x + halfWidth * .93, .78)),
    bone("right_hand", "Hand R", "right_forearm", point(center.x + halfWidth * .93, .78), point(right + halfWidth * .04, .78)),
    bone("left_thigh", "Thigh L", "pelvis", point(center.x - halfWidth * .20, .48), point(center.x - halfWidth * .24, .27)),
    bone("left_shin", "Shin L", "left_thigh", point(center.x - halfWidth * .24, .27), point(center.x - halfWidth * .25, .055, front)),
    bone("left_foot", "Foot L", "left_shin", point(center.x - halfWidth * .25, .055, front), point(center.x - halfWidth * .25, .02, front + halfDepth * .45)),
    bone("right_thigh", "Thigh R", "pelvis", point(center.x + halfWidth * .20, .48), point(center.x + halfWidth * .24, .27)),
    bone("right_shin", "Shin R", "right_thigh", point(center.x + halfWidth * .24, .27), point(center.x + halfWidth * .25, .055, front)),
    bone("right_foot", "Foot R", "right_shin", point(center.x + halfWidth * .25, .055, front), point(center.x + halfWidth * .25, .02, front + halfDepth * .45))
  ];
  rigBones = bones;
  rigBones.forEach(item => initializeBoneRestState(item, { capture: true }));
  selectedBoneId = "root";
  animationState.keys = {
    left_thigh: [{ frame: 0, rotation: [.28, 0, 0] }, { frame: 12, rotation: [-.28, 0, 0] }, { frame: 24, rotation: [.28, 0, 0] }],
    right_thigh: [{ frame: 0, rotation: [-.28, 0, 0] }, { frame: 12, rotation: [.28, 0, 0] }, { frame: 24, rotation: [-.28, 0, 0] }],
    left_upper_arm: [{ frame: 0, rotation: [-.18, 0, 1.12] }, { frame: 12, rotation: [.18, 0, 1.34] }, { frame: 24, rotation: [-.18, 0, 1.12] }],
    right_upper_arm: [{ frame: 0, rotation: [.18, 0, -1.12] }, { frame: 12, rotation: [-.18, 0, -1.34] }, { frame: 24, rotation: [.18, 0, -1.12] }]
  };
  animationState.end = 24;
  animationState.frame = 0;
  setupSkinnedRig();
  bonesGlued = !!activeSkinRuntime;
  animationState.bindingRest = null;
  poseRigHierarchy();
  rebuildBoneVisuals();
  syncBonePanel();
  updateGlueButton();
  if (els.gameAssetStatus) els.gameAssetStatus.textContent = `Created and bound a ${rigBones.length}-bone humanoid test rig for ${avatar.name}. Equipment can attach to head, chest, hands, feet, or back bone IDs.`;
  log(`Created humanoid test rig for ${avatar.name} with ${rigBones.length} named bones and a 24-frame walk test.`);
}

function serializeBoneRig() {
  syncActiveAnimationClip();
  return {
    selectedBoneId,
    showGuides: els.showBonesInput?.checked ?? true,
    guideScale: round(boneGuideScale),
    mirrorBoneEdits,
    skeletonDisplayMode,
    selectionTarget: rigSelectionTarget,
    modelOpacity: round(rigModelOpacity),
    bones: rigBones.map(bone => ({
      id: bone.id,
      name: bone.name,
      parentId: bone.parentId || null,
      role: bone.role || null,
      avatarObjectId: bone.avatarObjectId || null,
      position: bone.position.toArray().map(round),
      rotation: bone.rotation.toArray().map(round),
      tail: bone.tail?.toArray().map(round) || bone.position.clone().add(new THREE.Vector3(0, .12, 0)).toArray().map(round),
      bindPosition: bone.bindPosition?.toArray().map(round) || null,
      bindRotation: bone.bindRotation?.toArray().map(round) || null,
      bindTail: bone.bindTail?.toArray().map(round) || null,
      tailOffset: bone.tailOffset?.toArray().map(round) || null,
      blockbenchUuid: bone.blockbenchUuid || null,
      blockbenchSourcePosition: bone.blockbenchSourcePosition?.toArray().map(round) || null,
      blockbenchLocalRotation: bone.blockbenchLocalRotation?.toArray().map(round) || null,
      armorMount: !!bone.armorMount,
      armorMountId: bone.armorMountId || null,
      anatomyScale: (bone.anatomyScale || new THREE.Vector3(1, 1, 1)).toArray().map(round),
      hidden: !!bone.hidden
    })),
    animation: {
      fps: animationState.fps,
      end: animationState.end,
      frame: animationState.frame,
      keys: animationState.keys,
      clips: animationState.clips,
      activeClipId: animationState.activeClipId,
      bindingRest: serializeAnimationBindingRest()
    }
  };
}

function restoreBoneRig(data = {}) {
  fitBoneCamera.restExtent = null;  // reframe Front/Side views for the new rig
  rigBones = (data.bones || []).map((bone, index) => ({
    id: bone.id || freshBoneId(),
    name: bone.name || `Bone ${index + 1}`,
    parentId: bone.parentId || null,
    role: typeof bone.role === "string" ? bone.role : null,
    avatarObjectId: typeof bone.avatarObjectId === "string" ? bone.avatarObjectId : null,
    position: new THREE.Vector3().fromArray(Array.isArray(bone.position) ? bone.position : [0, index, 0]),
    rotation: new THREE.Vector3().fromArray(Array.isArray(bone.rotation) ? bone.rotation : [0, 0, 0]),
    tail: new THREE.Vector3().fromArray(Array.isArray(bone.tail) ? bone.tail : [0, index * .1 + .12, 0]),
    blockbenchUuid: bone.blockbenchUuid || null,
    blockbenchSourcePosition: Array.isArray(bone.blockbenchSourcePosition) ? new THREE.Vector3().fromArray(bone.blockbenchSourcePosition) : null,
    blockbenchLocalRotation: Array.isArray(bone.blockbenchLocalRotation) ? new THREE.Vector3().fromArray(bone.blockbenchLocalRotation) : null,
    armorMount: !!bone.armorMount,
    armorMountId: typeof bone.armorMountId === "string" ? bone.armorMountId : null,
    anatomyScale: new THREE.Vector3().fromArray(Array.isArray(bone.anatomyScale) ? bone.anatomyScale : [1, 1, 1]),
    hidden: !!bone.hidden
  }));
  for (const bone of rigBones) {
    const sourceBone = data.bones?.find(candidate => candidate.id === bone.id) || {};
    const child = rigBones.find(candidate => candidate.parentId === bone.id);
    if (!Array.isArray(sourceBone.tail) && child) bone.tail.copy(child.position);
    if (bone.tail.distanceTo(bone.position) < .001) bone.tail.copy(bone.position).add(new THREE.Vector3(0, .12, 0));
    bone.bindPosition = Array.isArray(sourceBone.bindPosition)
      ? new THREE.Vector3().fromArray(sourceBone.bindPosition)
      : bone.position.clone();
    bone.bindRotation = Array.isArray(sourceBone.bindRotation)
      ? new THREE.Vector3().fromArray(sourceBone.bindRotation)
      : (bone.blockbenchLocalRotation?.clone() || bone.rotation.clone());
    bone.bindTail = Array.isArray(sourceBone.bindTail)
      ? new THREE.Vector3().fromArray(sourceBone.bindTail)
      : bone.tail.clone();
    bone.tailOffset = Array.isArray(sourceBone.tailOffset)
      ? new THREE.Vector3().fromArray(sourceBone.tailOffset)
      : bone.bindTail.clone().sub(bone.bindPosition);
  }
  const blockbenchWorldRotations = new Map();
  const resolveBlockbenchRest = bone => {
    if (!bone?.blockbenchLocalRotation || blockbenchWorldRotations.has(bone.id)) return;
    const parent = boneById(bone.parentId);
    if (parent?.blockbenchLocalRotation) resolveBlockbenchRest(parent);
    const local = new THREE.Quaternion().setFromEuler(new THREE.Euler(bone.bindRotation.x, bone.bindRotation.y, bone.bindRotation.z, "ZYX"));
    const parentWorld = parent?.blockbenchLocalRotation ? blockbenchWorldRotations.get(parent.id) : null;
    blockbenchWorldRotations.set(bone.id, parentWorld ? parentWorld.clone().multiply(local) : local);
  };
  rigBones.forEach(resolveBlockbenchRest);
  rigBones.forEach(bone => {
    const parent = boneById(bone.parentId);
    if (bone.blockbenchLocalRotation && parent?.blockbenchLocalRotation) {
      bone.restLocalPosition = bone.position.clone().sub(parent.position).applyQuaternion(blockbenchWorldRotations.get(parent.id).clone().invert());
    } else {
      bone.restLocalPosition = parent ? bone.position.clone().sub(parent.position) : bone.position.clone();
    }
  });
  selectedBoneId = boneById(data.selectedBoneId)?.id || rigBones[0]?.id || null;
  boneGuideScale = THREE.MathUtils.clamp(Number(data.guideScale) || .4, .2, 1);
  mirrorBoneEdits = !!data.mirrorBoneEdits;
  skeletonDisplayMode = !!data.skeletonDisplayMode;
  rigSelectionTarget = ["bone", "skin", "armor"].includes(data.selectionTarget) ? data.selectionTarget : "bone";
  rigModelOpacity = THREE.MathUtils.clamp(Number(data.modelOpacity) || 1, .1, 1);
  syncBoneGuideScaleUi();
  if (els.mirrorBoneEditsInput) els.mirrorBoneEditsInput.checked = mirrorBoneEdits;
  if (els.skeletonModeInput) els.skeletonModeInput.checked = skeletonDisplayMode;
  syncRigSelectionTargetUi();
  requestAnimationFrame(ensureRigObjectMoveTool);
  syncRigModelOpacityUi();
  const savedClips = data.animation?.clips && typeof data.animation.clips === "object" ? data.animation.clips : null;
  animationState.clips = savedClips && Object.keys(savedClips).length
    ? savedClips
    : { idle: { name: "Idle", fps: data.animation?.fps, end: data.animation?.end, keys: data.animation?.keys || {} } };
  animationState.activeClipId = animationState.clips[data.animation?.activeClipId]
    ? data.animation.activeClipId
    : Object.keys(animationState.clips)[0];
  const activeClip = animationState.clips[animationState.activeClipId] || {};
  animationState.fps = Math.max(1, Math.min(120, Number(activeClip.fps) || Number(data.animation?.fps) || 24));
  animationState.end = Math.max(1, Math.min(9999, Number(activeClip.end) || Number(data.animation?.end) || 48));
  animationState.frame = Math.max(0, Math.min(animationState.end, Number(data.animation?.frame) || 0));
  animationState.keys = activeClip.keys && typeof activeClip.keys === "object"
    ? activeClip.keys
    : (data.animation?.keys && typeof data.animation.keys === "object" ? data.animation.keys : {});
  animationState.bindingRest = null;
  if (els.showBonesInput) els.showBonesInput.checked = data.showGuides ?? true;
  setupSkinnedRig();
  // Restore glue state: the rig is glued if a saved binding/skin is present.
  bonesGlued = !!activeSkinRuntime || objects.some(o => o.userData?.rigBoneId || o.userData?.minecraft?.boneId || o.userData?.minecraftBoneId);
  // Rigid armor can coexist with a skinned body. Always restore its saved
  // bone-relative rest transforms; Minecraft reconstruction remains a fallback
  // only for projects that do not have a skinned avatar runtime.
  animationState.bindingRest = restoreSerializedAnimationBindingRest(data.animation?.bindingRest);
  if (!animationState.bindingRest && !activeSkinRuntime) animationState.bindingRest = rebuildMinecraftAnimationBindingRest();
  if (animationState.bindingRest) {
    // Undo/project snapshots already contain the exact live mesh and bone pose.
    // Keep that pose instead of evaluating the current keyframe again: the user
    // may be between two axis edits and not have keyed the partial pose yet.
    poseRigHierarchy();
  } else if (animationHasKeys()) {
    if (!activeSkinRuntime && !animationState.bindingRest) prepareAnimationBindingRest();
    animationSetFrame(animationState.frame, { render: false });
  } else {
    poseRigHierarchy();
    if (bonesGlued && !activeSkinRuntime && !animationState.bindingRest) captureAnimationBindingRest();
  }
  rebuildBoneVisuals();
  applyRigModelOpacity();
  syncBonePanel();
  updateGlueButton();
  syncTPoseFittingUi();
}

function animationPoseForBone(bone) {
  return { position: bone.position.toArray(), rotation: bone.rotation.toArray() };
}
function animationHasKeys() {
  return Object.values(animationState.keys || {}).some(keys => Array.isArray(keys) && keys.length > 0);
}
function restoreAnimationBindPose({ render = true } = {}) {
  for (const bone of rigBones) {
    if (bone.bindPosition) bone.position.copy(bone.bindPosition);
    if (bone.bindRotation) bone.rotation.copy(bone.bindRotation);
    bone.tail.copy(bone.position).add(bone.tailOffset.clone().applyEuler(new THREE.Euler(bone.rotation.x, bone.rotation.y, bone.rotation.z, "XYZ")));
  }
  if (activeSkinRuntime) applySkinnedPose(new Map(rigBones.map(bone => [bone.id, {
    position: bone.position.clone(), rotation: bone.rotation.clone()
  }])));
  if (animationState.bindingRest) {
    for (const rest of animationState.bindingRest.values()) {
      if (!rest?.object || !rest.objectPosition || !rest.objectRotation) continue;
      rest.object.position.copy(rest.objectPosition);
      rest.object.rotation.copy(rest.objectRotation);
      rest.object.updateMatrixWorld(true);
    }
  }
  if (render) { rebuildBoneVisuals(); syncBonePanel(); }
}
function animationJumpLift(frame = animationState.frame) {
  const clipLabel = els.minecraftAnimationSelect?.selectedOptions?.[0]?.textContent?.trim().toLowerCase() || "";
  if (!clipLabel.includes("jump")) return 0;
  const hasAuthoredLift = rigBones.filter(candidate => !candidate.parentId).some(bone => {
    const restY = bone.bindPosition?.y ?? bone.position?.y ?? 0;
    return (animationState.keys[bone.id] || []).some(pose =>
      Array.isArray(pose.position) && Math.abs((Number(pose.position[1]) || 0) - restY) > 1e-4
    );
  });
  // Root-height keys define the clip's exact jump arc. Adding the automatic
  // preview lift on top made authored characters hover far above the ground
  // and made the editor disagree with exported realtime animation.
  if (hasAuthoredLift) return 0;
  const phase = Math.max(0, Math.min(1, frame / Math.max(1, animationState.end)));
  const modelBounds = new THREE.Box3();
  for (const object of objects) modelBounds.expandByObject(object);
  const modelHeight = modelBounds.isEmpty() ? 1 : modelBounds.getSize(new THREE.Vector3()).y;
  return Math.sin(Math.PI * phase) * Math.max(.35, modelHeight * .35);
}
function animationSetFrame(frame, { render = true, lightweightPanel = false } = {}) {
  // T-Pose is a dedicated rig state, not an animation frame. Ignore timeline,
  // preview, and external scrub requests until a real clip is selected again.
  if (tPoseFittingMode) {
    animationState.playing = false;
    updateAnimationPanel();
    return;
  }
  animationState.frame = Math.max(0, Math.min(animationState.end, Math.round(Number(frame) || 0)));
  if (!animationHasKeys()) {
    animationState.playing = false;
    if (render) { rebuildBoneVisuals(); syncBonePanel(); }
    updateAnimationPanel();
    return;
  }
  const t = animationState.frame;
  const poses = new Map();
  // Frame evaluation must be absolute. Hierarchy resolution writes world-space
  // values into the live bones, so carrying those values into another scrub
  // makes parent rotations accumulate and causes reverse scrubbing to move
  // forward. Rebuild every requested frame from the unchanged bind pose.
  for (const bone of rigBones) {
    bone.position.copy(bone.bindPosition);
    bone.rotation.copy(bone.bindRotation);
    // The pose pass did not run for this frame; drop stale pose quaternions so
    // applyAnimationBindings falls back to the freshly resolved world rotation.
    bone.poseWorldQuaternion = null;
  }
  for (const bone of rigBones) {
    const frames = (animationState.keys[bone.id] || []).slice().sort((a, b) => a.frame - b.frame);
    if (!frames.length) {
      poses.set(bone.id, { position: bone.bindPosition.clone(), rotation: bone.bindRotation.clone() });
      continue;
    }
    let a = frames[0], b = frames[frames.length - 1];
    for (let i = 0; i < frames.length; i++) { if (frames[i].frame <= t) a = frames[i]; if (frames[i].frame >= t) { b = frames[i]; break; } }
    const span = Math.max(1, b.frame - a.frame), alpha = a === b ? 0 : (t - a.frame) / span;
    bone.position.fromArray(a.position.map((v, i) => v + (b.position[i] - v) * alpha));
    bone.rotation.fromArray(a.rotation.map((v, i) => v + (b.rotation[i] - v) * alpha));
    poses.set(bone.id, { position: bone.position.clone(), rotation: bone.rotation.clone() });
  }
  const jumpLift = animationJumpLift(t);
  if (jumpLift > 0) {
    // Move roots once; hierarchy resolution propagates the lift to descendants.
    for (const bone of rigBones.filter(candidate => !candidate.parentId)) {
      bone.position.y += jumpLift;
      const pose = poses.get(bone.id);
      if (pose) pose.position.y += jumpLift;
    }
  }
  if (activeSkinRuntime) {
    applySkinnedPose(poses);
    // The body and rigid equipment share one pose. Skinning updates the live
    // THREE.Bone hierarchy first; armor then reads those same world transforms
    // without inheriting any vertex deformation or stretch.
    applyAnimationBindings();
  } else {
    poseRigHierarchy();
    applyAnimationBindings();
  }
  if (render) { rebuildBoneVisuals(); syncBonePanel(); }
  if (lightweightPanel) updateAnimationPlaybackPanel();
  else updateAnimationPanel();
}

function pointSegmentDistanceSquared(point, start, end) {
  const segment = end.clone().sub(start);
  const lengthSquared = segment.lengthSq();
  if (lengthSquared < 1e-8) return point.distanceToSquared(start);
  const t = THREE.MathUtils.clamp(point.clone().sub(start).dot(segment) / lengthSquared, 0, 1);
  return point.distanceToSquared(start.clone().addScaledVector(segment, t));
}

function skinCandidatesForVertex(point, bones) {
  const byName = name => bones.findIndex(bone => bone.name === name);
  const named = names => names.map(byName).filter(index => index >= 0);
  const leftReference = bones.find(bone => bone.name === "Hand L")
    || bones.find(bone => bone.name === "Thigh L");
  const rightReference = bones.find(bone => bone.name === "Hand R")
    || bones.find(bone => bone.name === "Thigh R");
  const leftX = leftReference?.bindPosition?.x ?? leftReference?.position?.x;
  const rightX = rightReference?.bindPosition?.x ?? rightReference?.position?.x;
  // Imported tools disagree about whether the model's left side is +X or -X.
  // Pick the named chain whose placed joints are physically closest instead of
  // assigning weights from a hard-coded axis sign.
  const side = Number.isFinite(leftX) && Number.isFinite(rightX)
    ? (Math.abs(point.x - leftX) <= Math.abs(point.x - rightX) ? "L" : "R")
    : (point.x < 0 ? "L" : "R");
  const pelvis = bones.find(bone => bone.name === "Pelvis");
  const chest = bones.find(bone => bone.name === "Chest");
  const foot = bones.find(bone => bone.name === `Foot ${side}`);
  const hand = bones.find(bone => bone.name === `Hand ${side}`);
  const forearm = bones.find(bone => bone.name === `Forearm ${side}`);
  const pelvisY = pelvis?.bindPosition?.y ?? .9;
  const chestY = chest?.bindPosition?.y ?? 1.2;
  const footY = foot?.bindPosition?.y ?? .08;
  // The previous fixed thresholds stopped thigh influence around the middle of
  // this mannequin's upper legs. Use the placed rig instead: all vertices from
  // the sole through the hip are weighted to that side's complete leg chain.
  // Include the whole upper-leg/hip transition. The thigh joint sits beneath
  // the pelvis, but its skin must reach a little above it; otherwise the bone
  // turns under a stationary hip and the walk looks like only the shin moves.
  if (point.y <= pelvisY + .15) {
    if (point.y < footY + .12) return named([`Foot ${side}`, `Shin ${side}`, `Thigh ${side}`]);
    return named([`Thigh ${side}`, `Shin ${side}`, "Pelvis", "Root"]);
  }
  const armThreshold = point.y > chestY - .06 ? .24 : .34;
  if (Math.abs(point.x) > armThreshold) {
    // Palm, thumb, and fingers must follow the hand bone. Previously every
    // hand vertex belonged to Forearm, so wrist rotation moved only the guide.
    const handX = Math.abs(hand?.bindPosition?.x ?? hand?.position?.x ?? Infinity);
    const forearmX = Math.abs(forearm?.bindPosition?.x ?? forearm?.position?.x ?? handX);
    const wristStart = forearmX + Math.max(0, handX - forearmX) * .65;
    if (hand && Math.abs(point.x) >= wristStart) return named([
      `Thumb ${side}`, `Index ${side}`, `Middle ${side}`, `Ring ${side}`, `Pinky ${side}`,
      `Hand ${side}`, `Forearm ${side}`
    ]);
    return named([`Forearm ${side}`, `Upper Arm ${side}`, "Chest"]);
  }
  if (point.y > chestY + .26) return named(["Head", "Neck", "Chest"]);
  return named(["Chest", "Spine", "Root"]);
}

function addSkinAttributes(geometry, bones) {
  const position = geometry.getAttribute("position");
  const indices = new Uint16Array(position.count * 4);
  const weights = new Float32Array(position.count * 4);
  const point = new THREE.Vector3();
  for (let vertex = 0; vertex < position.count; vertex += 1) {
    point.fromBufferAttribute(position, vertex);
    let candidates = skinCandidatesForVertex(point, bones);
    if (!candidates.length) candidates = bones.map((_, index) => index);
    const influences = candidates.map(index => {
      const bone = bones[index];
      const distanceSquared = pointSegmentDistanceSquared(point, bone.bindPosition, bone.bindTail);
      return { index, weight: 1 / Math.max(.0001, distanceSquared) };
    }).sort((a, b) => b.weight - a.weight).slice(0, 4);
    const total = influences.reduce((sum, influence) => sum + influence.weight, 0) || 1;
    influences.forEach((influence, slot) => {
      indices[vertex * 4 + slot] = influence.index;
      weights[vertex * 4 + slot] = influence.weight / total;
    });
  }
  geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(indices, 4));
  geometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute(weights, 4));
}

function replaceObjectWithSkinnedMesh(mesh, bones) {
  const geometry = mesh.geometry.clone();
  addSkinAttributes(geometry, bones);
  const skinned = new THREE.SkinnedMesh(geometry, mesh.material);
  skinned.name = mesh.name;
  skinned.position.copy(mesh.position);
  skinned.quaternion.copy(mesh.quaternion);
  skinned.scale.copy(mesh.scale);
  skinned.visible = mesh.visible;
  skinned.castShadow = mesh.castShadow;
  skinned.receiveShadow = mesh.receiveShadow;
  skinned.renderOrder = mesh.renderOrder;
  skinned.userData = { ...mesh.userData, skeletalRig: true };
  const objectIndex = objects.indexOf(mesh);
  scene.remove(mesh);
  scene.add(skinned);
  if (objectIndex >= 0) objects[objectIndex] = skinned;
  if (selected === mesh) selected = skinned;
  return skinned;
}

function setupSkinnedRig() {
  if (activeSkinRuntime?.threeBones) {
    const oldBoneObjects = new Set(activeSkinRuntime.threeBones.values());
    for (const threeBone of oldBoneObjects) {
      if (threeBone.parent && !oldBoneObjects.has(threeBone.parent)) threeBone.parent.remove(threeBone);
    }
  }
  activeSkinRuntime = null;
  if (!rigBones.length || typeof findObject !== "function") return;
  const avatarCounts = new Map();
  rigBones.forEach(bone => {
    if (bone.avatarObjectId) avatarCounts.set(bone.avatarObjectId, (avatarCounts.get(bone.avatarObjectId) || 0) + 1);
  });
  let avatarId = [...avatarCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  let avatar = avatarId ? findObject(avatarId) : null;
  if (!avatar?.geometry?.getAttribute("position") || avatarCounts.get(avatarId) < 2) {
    // A mesh explicitly marked Skin & Bone is enough to restore the skinned
    // runtime after loading. Older projects did not always serialize each
    // bone's avatarObjectId, which left the body frozen while rigid armor moved.
    avatar = objects.find(object => object.userData?.rigRole === "skin" && object.geometry?.getAttribute?.("position")) || null;
    if (!avatar) return;
    avatarId = avatar.userData?.id || avatar.name;
    rigBones.filter(bone => bone.role !== "camera").forEach(bone => { bone.avatarObjectId = avatarId; });
  }
  const bones = rigBones.filter(bone => bone.avatarObjectId === avatarId);
  const boneIds = new Set(bones.map(bone => bone.id));
  bones.forEach(bone => {
    bone.bindPosition.copy(bone.position);
    bone.bindTail = bone.tail.clone();
  });
  if (!avatar.isSkinnedMesh) avatar = replaceObjectWithSkinnedMesh(avatar, bones);
  const threeBones = new Map(bones.map(bone => {
    const threeBone = new THREE.Bone();
    threeBone.name = bone.name;
    threeBone.userData.rigBoneId = bone.id;
    return [bone.id, threeBone];
  }));
  for (const bone of bones) {
    const threeBone = threeBones.get(bone.id);
    const parentBone = boneIds.has(bone.parentId) ? boneById(bone.parentId) : null;
    if (parentBone) {
      threeBone.position.copy(bone.bindPosition).sub(parentBone.bindPosition);
      threeBones.get(parentBone.id).add(threeBone);
    } else {
      threeBone.position.copy(bone.bindPosition);
      avatar.add(threeBone);
    }
  }
  avatar.updateMatrixWorld(true);
  const orderedThreeBones = bones.map(bone => threeBones.get(bone.id));
  const skeleton = new THREE.Skeleton(orderedThreeBones);
  avatar.bind(skeleton);
  avatar.normalizeSkinWeights();
  activeSkinRuntime = { avatar, bones, threeBones, skeleton };
  if (typeof updateGlueButton === "function") updateGlueButton();
}

function applySkinnedPose(poses) {
  const { avatar, bones, threeBones, skeleton } = activeSkinRuntime;
  for (const bone of bones) {
    const threeBone = threeBones.get(bone.id);
    const pose = poses.get(bone.id) || { position: bone.bindPosition, rotation: bone.bindRotation };
    const parent = boneById(bone.parentId);
    const bindPosition = bone.bindPosition || bone.position;
    const posePosition = pose.position?.clone?.()
      || new THREE.Vector3().fromArray(Array.isArray(pose.position) ? pose.position : bindPosition.toArray());
    const keyedOffset = posePosition.sub(bindPosition);
    // A child bone's local position is its fixed joint offset plus any explicit
    // animation translation. Do not counter-rotate that offset: doing so holds
    // the elbow/knee in world space when its shoulder/hip turns, which was why
    // arms twisted apart and the upper leg did not swing as a real limb.
    if (parent && threeBones.has(parent.id)) {
      threeBone.position.copy(bindPosition).sub(parent.bindPosition || parent.position).add(keyedOffset);
    } else {
      threeBone.position.copy(bindPosition).add(keyedOffset);
    }
    // The guide's bind rotation describes where its cone points, not a mesh
    // deformation. Skinning needs only the animation delta from that bind pose.
    const bindQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(
      bone.bindRotation?.x || 0, bone.bindRotation?.y || 0, bone.bindRotation?.z || 0, "XYZ"
    ));
    const poseQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(
      pose.rotation?.x || 0, pose.rotation?.y || 0, pose.rotation?.z || 0, "XYZ"
    ));
    threeBone.quaternion.copy(poseQuaternion.multiply(bindQuaternion.invert()));
  }
  avatar.updateMatrixWorld(true);
  skeleton.update();
  for (const bone of bones) {
    const threeBone = threeBones.get(bone.id);
    bone.displayPosition = threeBone.getWorldPosition(new THREE.Vector3());
    bone.displayTail = threeBone.localToWorld(bone.bindTail.clone().sub(bone.bindPosition));
  }
}

// Resolve the hierarchy so a bone's world transform = its own (user-edited)
// rotation applied about its position, with children keeping their imported
// world rotation and only swinging with the parent's CHANGE. This preserves the
// model's imported pose exactly until the user drags a specific bone.
function poseBoneWithChildren(bone, visited = new Set(), resolved = new Map()) {
  if (resolved.has(`${bone.id}:pos`)) return resolved.get(bone.id);
  if (visited.has(bone.id)) return new THREE.Quaternion();
  visited.add(bone.id);

  const bindPos = bone.bindPosition || bone.position.clone();
  const keyedPositionOffset = bone.position.clone().sub(bindPos);
  const bindRotE = bone.bindRotation || bone.rotation;
  const parent = boneById(bone.parentId);

  // Blockbench stores every group's rotation and animation channel in the
  // group's LOCAL coordinate system. Resolve those bones with ordinary FK.
  // Treating the local value as a world rotation makes children orbit their
  // parent and was the cause of the raptor's broken legs and tail.
  if (bone.blockbenchLocalRotation) {
    if (parent) poseBoneWithChildren(parent, visited, resolved);
    const parentWorldQuat = parent
      ? (resolved.get(`${parent.id}:worldQuat`) || new THREE.Quaternion()).clone()
      : new THREE.Quaternion();
    const parentRestWorldQuat = parent
      ? (resolved.get(`${parent.id}:restWorldQuat`) || new THREE.Quaternion()).clone()
      : new THREE.Quaternion();
    const localRestQuat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(bindRotE.x, bindRotE.y, bindRotE.z, "ZYX")
    );
    const localPoseQuat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(bone.rotation.x, bone.rotation.y, bone.rotation.z, "ZYX")
    );
    const restWorldQuat = parentRestWorldQuat.multiply(localRestQuat);
    const worldQuat = parentWorldQuat.multiply(localPoseQuat);
    const localPosition = (bone.restLocalPosition || bindPos.clone()).clone().add(keyedPositionOffset);
    const worldPos = parent
      ? (resolved.get(`${parent.id}:pos`) || parent.position).clone().add(localPosition.applyQuaternion(resolved.get(`${parent.id}:worldQuat`) || new THREE.Quaternion()))
      : localPosition;
    const worldDelta = worldQuat.clone().multiply(restWorldQuat.clone().invert());

    bone.position.copy(worldPos);
    bone.poseWorldQuaternion = worldQuat.clone();
    resolved.set(bone.id, worldDelta);
    resolved.set(`${bone.id}:pos`, worldPos.clone());
    resolved.set(`${bone.id}:bindPos`, bindPos.clone());
    resolved.set(`${bone.id}:worldQuat`, worldQuat.clone());
    resolved.set(`${bone.id}:restWorldQuat`, restWorldQuat.clone());
    return worldDelta;
  }

  // Parent's ACCUMULATED change (own delta premultiplied by all ancestors').
  const parentDelta = parent ? poseBoneWithChildren(parent, visited, resolved).clone() : new THREE.Quaternion();
  // Rest-pose WORLD rotation. Blockbench bones store LOCAL rest rotations (ZYX
  // order), so compose them onto the parent's rest world rotation; other bones
  // already keep world-space bind rotations. Live bone.rotation is world-space
  // (the hierarchy resolve and the gizmos both write world values), so the delta
  // must be measured against the world rest rotation — comparing against the
  // local bind rotation invents a phantom delta for every bone under a rotated
  // ancestor and swings unrelated parts (e.g. right leg/jaw when posing left hip).
  const bindLocalQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(bindRotE.x, bindRotE.y, bindRotE.z, bone.blockbenchLocalRotation ? "ZYX" : "XYZ"));
  const parentRestWorldQuat = (parent && resolved.get(`${parent.id}:restWorldQuat`)) || new THREE.Quaternion();
  const restWorldQuat = bone.blockbenchLocalRotation
    ? parentRestWorldQuat.clone().multiply(bindLocalQuat)
    : bindLocalQuat;
  // How much the user has rotated this bone away from its imported pose.
  const curQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(bone.rotation.x, bone.rotation.y, bone.rotation.z, "XYZ"));
  const deltaQuat = curQuat.clone().multiply(restWorldQuat.clone().invert());
  // Preserve root and child position channels. Starting every bone at bindPos
  // discarded animated translation before descendants were resolved.
  let worldPos = bindPos.clone().add(keyedPositionOffset);
  let worldQuat = curQuat.clone();
  if (parent) {
    const parentBindPos = resolved.get(`${parent.id}:bindPos`)?.clone() || parent.bindPosition?.clone() || parent.position.clone();
    const parentPos = resolved.get(`${parent.id}:pos`)?.clone() || parentBindPos.clone();
    const restOffset = bindPos.clone().sub(parentBindPos);                        // imported offset
    worldPos = parentPos.clone()
      .add(restOffset.applyQuaternion(parentDelta))
      .add(keyedPositionOffset.applyQuaternion(parentDelta));                    // swing and translate with ancestors
    bone.position.copy(worldPos);
    worldQuat = parentDelta.clone().multiply(curQuat);                            // keep own rotation, add ancestors' swing
  }
  if (!bone.tail) bone.tail = bone.position.clone().add(new THREE.Vector3(0, .12, 0));
  bone.tailOffset = bone.tailOffset || (bone.bindTail ? bone.bindTail.clone().sub(bindPos) : bone.tail.clone().sub(bindPos));
  bone.tail.copy(worldPos).add(bone.tailOffset.clone().applyQuaternion(worldQuat));
  // Accumulated delta = parentDelta * deltaQuat (order matters).
  const accumulatedDelta = parentDelta.clone().multiply(deltaQuat);
  bone.poseWorldQuaternion = worldQuat.clone();   // consumed by applyAnimationBindings
  resolved.set(bone.id, accumulatedDelta);
  resolved.set(`${bone.id}:pos`, worldPos);
  resolved.set(`${bone.id}:bindPos`, bindPos);
  resolved.set(`${bone.id}:worldQuat`, worldQuat);
  resolved.set(`${bone.id}:restWorldQuat`, restWorldQuat);
  return accumulatedDelta;
}

function poseRigHierarchy() {
  const visited = new Set();
  const resolved = new Map();
  rigBones.forEach(bone => poseBoneWithChildren(bone, visited, resolved));
  // Resolve tails after every joint has its final world position. A parent tail
  // lands on its first child; leaf tails follow the bone's world-space delta.
  rigBones.forEach(bone => {
    const child = rigBones.find(candidate => candidate.parentId === bone.id);
    if (child) {
      bone.tail.copy(child.position);
      return;
    }
    const bindPosition = bone.bindPosition || bone.position;
    const bindTail = bone.bindTail || bone.tail;
    const restOffset = bindTail.clone().sub(bindPosition);
    const worldDelta = resolved.get(bone.id) || new THREE.Quaternion();
    bone.tail.copy(bone.position).add(restOffset.applyQuaternion(worldDelta));
  });
}

function applyCurrentRigPose({ resolveLooseHierarchy = false } = {}) {
  // While the rig is loose, bone edits define the placement/rest pose. Do not
  // resolve children from stale bind data: that was the source of new bones
  // jumping away while the user was positioning a rig before gluing it.
  if (!bonesGlued && !activeSkinRuntime) {
    if (resolveLooseHierarchy) poseRigHierarchy();
    else rigBones.forEach(bone => initializeBoneRestState(bone));
    return;
  }
  poseRigHierarchy();
  if (activeSkinRuntime) {
    applySkinnedPose(new Map(rigBones.map(bone => [bone.id, {
      position: bone.position.clone(),
      rotation: bone.rotation.clone()
    }])));
  }
  // Move rigidly-bound model parts (e.g. Minecraft cuboids) with their bones
  // whenever a rig is glued, so dragging a bone reposes the actual model live.
  if (bonesGlued) applyAnimationBindings();
}
function collectAnimationBindings() {
  // A live SkinnedMesh already deforms on the GPU from its THREE.Bone palette.
  // Sending that same dense avatar through the legacy weighted CPU fallback on
  // every frame duplicates the deformation and recomputes all vertex normals,
  // which makes the local editor crawl. Keep this list for rigid armor and for
  // projects that do not have a skin runtime.
  const bindings = rigBones
    .filter(bone => bone.avatarObjectId && typeof findObject === "function")
    .map(bone => ({ bone, object: findObject(bone.avatarObjectId) }))
    .filter(item => item.object && item.object !== activeSkinRuntime?.avatar);
  for (const object of objects) {
    if (object === activeSkinRuntime?.avatar) continue;
    const mountBoneId = object.userData?.rigArmorMountId ? rigBones.find(bone => bone.armorMountId === object.userData.rigArmorMountId)?.id : null;
    const boneId = mountBoneId || object.userData?.rigBoneId || object.userData?.minecraft?.boneId || object.userData?.minecraftBoneId;
    const bone = boneById(boneId);
    if (bone) bindings.push({ bone, object });
  }
  return bindings;
}

function captureAnimationBindingRest() {
  const bindings = collectAnimationBindings();
  animationState.bindingRest = new Map();
  if (!bindings.length) return;
  // Re-resolve the pose so bone.position and bone.poseWorldQuaternion reflect the
  // CURRENT bone.rotation values; otherwise a stale poseWorldQuaternion (or one
  // left over from an animation scrub) is captured as the rest orientation.
  poseRigHierarchy();
  const grouped = new Map();
  for (const binding of bindings) {
    const id = binding.object.userData?.id;
    if (!grouped.has(id)) grouped.set(id, []);
    grouped.get(id).push(binding);
  }
  for (const [objectId, group] of grouped) {
    if (group.length > 1 && group[0].object.geometry?.attributes?.position) applyWeightedMeshBinding(objectId, group[0].object, group);
  }
  const rigidBindings = bindings.filter(({ object }) => (grouped.get(object.userData?.id) || []).length === 1);
  for (const { bone, object } of rigidBindings) {
    animationState.bindingRest.set(`rigid:${bone.id}:${object.userData?.id || object.uuid}`, {
      object, bonePosition: bone.position.clone(), boneRotation: bone.rotation.clone(),
      boneQuaternion: (bone.poseWorldQuaternion || new THREE.Quaternion().setFromEuler(new THREE.Euler(bone.rotation.x, bone.rotation.y, bone.rotation.z, "XYZ"))).clone(),
      objectPosition: object.position.clone(), objectRotation: object.rotation.clone(), objectQuaternion: object.quaternion.clone()
    });
  }
}

function serializeAnimationBindingRest() {
  if (!(animationState.bindingRest instanceof Map)) return [];
  const entries = [];
  for (const [key, rest] of animationState.bindingRest) {
    if (!String(key).startsWith("rigid:") || !rest?.object) continue;
    entries.push({
      key,
      objectId: rest.object.userData?.id || null,
      bonePosition: rest.bonePosition?.toArray() || null,
      boneRotation: rest.boneRotation?.toArray() || null,
      boneQuaternion: rest.boneQuaternion?.toArray() || null,
      objectPosition: rest.objectPosition?.toArray() || null,
      objectRotation: rest.objectRotation?.toArray() || null,
      objectQuaternion: rest.objectQuaternion?.toArray() || null
    });
  }
  return entries;
}

function restoreSerializedAnimationBindingRest(entries) {
  if (!Array.isArray(entries) || !entries.length || typeof findObject !== "function") return null;
  const restored = new Map();
  for (const entry of entries) {
    const object = entry?.objectId ? findObject(entry.objectId) : null;
    if (!object || typeof entry.key !== "string") continue;
    restored.set(entry.key, {
      object,
      bonePosition: new THREE.Vector3().fromArray(entry.bonePosition || [0, 0, 0]),
      boneRotation: new THREE.Vector3().fromArray(entry.boneRotation || [0, 0, 0]),
      boneQuaternion: new THREE.Quaternion().fromArray(entry.boneQuaternion || [0, 0, 0, 1]),
      objectPosition: new THREE.Vector3().fromArray(entry.objectPosition || object.position.toArray()),
      objectRotation: new THREE.Euler().fromArray(entry.objectRotation || object.rotation.toArray()),
      objectQuaternion: new THREE.Quaternion().fromArray(entry.objectQuaternion || object.quaternion.toArray())
    });
  }
  return restored.size ? restored : null;
}

function rebuildMinecraftAnimationBindingRest() {
  if (typeof blockbenchBindTransform !== "function") return null;
  const bindings = collectAnimationBindings().filter(({ object }) => object.userData?.minecraft);
  if (!bindings.length) return null;
  const livePose = new Map(rigBones.map(bone => [bone.id, {
    position: bone.position.clone(),
    rotation: bone.rotation.clone()
  }]));
  for (const bone of rigBones) {
    bone.position.copy(bone.bindPosition);
    bone.rotation.copy(bone.bindRotation);
    bone.poseWorldQuaternion = null;
  }
  poseRigHierarchy();
  const restored = new Map();
  for (const { bone, object } of bindings) {
    const data = object.userData.minecraft;
    if (!Array.isArray(data.from) || !Array.isArray(data.to)) continue;
    const centerPixels = data.to.map((value, index) => (Number(value) + Number(data.from[index])) / 2);
    const bindTransform = blockbenchBindTransform(centerPixels, {
      origin: data.origin,
      rotation: data.rotation
    }, data.boneId || object.userData.minecraftBoneId);
    const objectRotation = new THREE.Euler(
      THREE.MathUtils.degToRad(bindTransform.rotation[0] || 0),
      THREE.MathUtils.degToRad(bindTransform.rotation[1] || 0),
      THREE.MathUtils.degToRad(bindTransform.rotation[2] || 0),
      "XYZ"
    );
    restored.set(`rigid:${bone.id}:${object.userData?.id || object.uuid}`, {
      object,
      bonePosition: bone.position.clone(),
      boneRotation: bone.rotation.clone(),
      boneQuaternion: (bone.poseWorldQuaternion || new THREE.Quaternion().setFromEuler(new THREE.Euler(bone.rotation.x, bone.rotation.y, bone.rotation.z, "XYZ"))).clone(),
      objectPosition: new THREE.Vector3().fromArray(bindTransform.position),
      objectRotation,
      objectQuaternion: new THREE.Quaternion().setFromEuler(objectRotation)
    });
  }
  for (const bone of rigBones) {
    const live = livePose.get(bone.id);
    if (!live) continue;
    bone.position.copy(live.position);
    bone.rotation.copy(live.rotation);
  }
  poseRigHierarchy();
  return restored.size ? restored : null;
}

function prepareAnimationBindingRest() {
  for (const bone of rigBones) {
    bone.position.copy(bone.bindPosition);
    bone.rotation.copy(bone.bindRotation);
  }
  poseRigHierarchy();
  captureAnimationBindingRest();
}

function applyAnimationBindings() {
  const bindings = collectAnimationBindings();
  if (!bindings.length) return;
  if (!animationState.bindingRest) {
    const requestedFrame = animationState.frame;
    prepareAnimationBindingRest();
    animationSetFrame(requestedFrame, { render: false });
    return;
  }
  const grouped = new Map();
  for (const binding of bindings) {
    const id = binding.object.userData?.id;
    if (!grouped.has(id)) grouped.set(id, []);
    grouped.get(id).push(binding);
  }
  for (const [objectId, group] of grouped) {
    if (group.length > 1 && group[0].object.geometry?.attributes?.position) applyWeightedMeshBinding(objectId, group[0].object, group);
  }
  const rigidBindings = bindings.filter(({ object }) => (grouped.get(object.userData?.id) || []).length === 1);
  for (const { bone, object } of rigidBindings) {
    const rest = animationState.bindingRest.get(`rigid:${bone.id}:${object.userData?.id || object.uuid}`);
    if (!rest) continue;
    const skinnedBone = activeSkinRuntime?.threeBones?.get(bone.id) || null;
    const currentBonePosition = skinnedBone
      ? skinnedBone.getWorldPosition(new THREE.Vector3())
      : bone.position;
    // poseWorldQuaternion includes all ancestors' accumulated swing; bone.rotation
    // is only this bone's local value and would leave descendants unrotated.
    const currentBoneQuaternion = skinnedBone
      ? skinnedBone.getWorldQuaternion(new THREE.Quaternion())
      : (bone.poseWorldQuaternion
        ? bone.poseWorldQuaternion.clone()
        : new THREE.Quaternion().setFromEuler(new THREE.Euler(bone.rotation.x, bone.rotation.y, bone.rotation.z, "XYZ")));
    const restBoneQuaternion = rest.boneQuaternion || new THREE.Quaternion().setFromEuler(new THREE.Euler(rest.boneRotation.x, rest.boneRotation.y, rest.boneRotation.z, "XYZ"));
    const rotationDelta = currentBoneQuaternion.multiply(restBoneQuaternion.clone().invert());
    object.position.copy(rest.objectPosition).sub(rest.bonePosition).applyQuaternion(rotationDelta).add(currentBonePosition);
    object.quaternion.copy(rotationDelta).multiply(rest.objectQuaternion || new THREE.Quaternion().setFromEuler(rest.objectRotation));
    object.updateMatrixWorld(true);
  }
}
function applyWeightedMeshBinding(objectId, object, group) {
  if (!animationState.bindingRest) animationState.bindingRest = new Map();
  const key = `skin:${objectId}`;
  let rest = animationState.bindingRest.get(key);
  const positionAttribute = object.geometry.attributes.position;
  if (!rest) {
    const base = new Float32Array(positionAttribute.array);
    const bounds = new THREE.Box3().setFromBufferAttribute(positionAttribute);
    const height = Math.max(.001, bounds.max.y - bounds.min.y);
    const worldHeight = Math.max(...group.map(({ bone }) => bone.position.y), 1.8) - Math.min(...group.map(({ bone }) => bone.position.y));
    rest = { base, bounds, height, worldHeight, bones: group.map(({ bone }) => ({ bone, position: bone.position.clone(), rotation: bone.rotation.clone() })) };
    animationState.bindingRest.set(key, rest);
  }
  const output = positionAttribute.array;
  for (let index = 0; index < positionAttribute.count; index += 1) {
    const source = new THREE.Vector3(rest.base[index * 3], rest.base[index * 3 + 1], rest.base[index * 3 + 2]);
    const normalizedY = (source.y - rest.bounds.min.y) / rest.height;
    const worldY = Math.min(...rest.bones.map(item => item.position.y)) + normalizedY * rest.worldHeight;
    const side = source.x;
    const lowerBody = normalizedY < .58;
    const footZone = normalizedY < .16;
    const upperBody = normalizedY > .58;
    if (!lowerBody) {
      output[index * 3] = source.x; output[index * 3 + 1] = source.y; output[index * 3 + 2] = source.z;
      continue;
    }
    const candidateBones = rest.bones.filter(item => {
      const name = item.bone.name;
      if (footZone) return name.includes("Foot") || name.includes("Shin");
      if (lowerBody) return name.includes("Thigh") || name.includes("Shin") || name.includes("Root");
      if (upperBody && Math.abs(side) > .22) return name.includes("Arm") || name.includes("Chest");
      return name.includes("Chest") || name.includes("Spine") || name.includes("Head");
    });
    const influences = (candidateBones.length ? candidateBones : rest.bones).map(item => {
      const distanceY = Math.abs(item.position.y - worldY);
      const sameSide = (item.bone.name.includes("L") && side < 0) || (item.bone.name.includes("R") && side > 0);
      const oppositeSide = (item.bone.name.includes("L") && side > 0) || (item.bone.name.includes("R") && side < 0);
      const sideBias = sameSide ? .9 : oppositeSide ? -.9 : 0;
      return { item, weight: Math.exp(-distanceY * 10 + sideBias) };
    }).sort((a, b) => b.weight - a.weight).slice(0, 3);
    const total = influences.reduce((sum, influence) => sum + influence.weight, 0) || 1;
    const result = new THREE.Vector3();
    for (const influence of influences) {
      const { item } = influence;
      const delta = new THREE.Euler(item.bone.rotation.x - item.rotation.x, item.bone.rotation.y - item.rotation.y, item.bone.rotation.z - item.rotation.z, "XYZ");
      const pivot = new THREE.Vector3(
        rest.bounds.min.x + (item.position.x + .5) * (rest.bounds.max.x - rest.bounds.min.x),
        rest.bounds.min.y + ((item.position.y - Math.min(...rest.bones.map(candidate => candidate.position.y))) / rest.worldHeight) * rest.height,
      (rest.bounds.min.z + rest.bounds.max.z) * .5
      );
      const transformed = source.clone().sub(pivot).applyEuler(delta).add(pivot);
      result.addScaledVector(transformed, influence.weight / total);
    }
    output[index * 3] = result.x; output[index * 3 + 1] = result.y; output[index * 3 + 2] = result.z;
  }
  positionAttribute.needsUpdate = true;
  object.geometry.computeVertexNormals();
  object.geometry.attributes.normal.needsUpdate = true;
}
function keyAnimationPose() {
  for (const bone of rigBones) { const list = animationState.keys[bone.id] || (animationState.keys[bone.id] = []); const pose = animationPoseForBone(bone); const key = { frame: animationState.frame, ...pose }; const index = list.findIndex(item => item.frame === key.frame); if (index >= 0) list[index] = key; else list.push(key); }
  updateAnimationPanel();
}
function deleteAnimationFrameKeys() {
  let removed = 0;
  for (const bone of rigBones) {
    const keys = animationState.keys[bone.id] || [];
    const remaining = keys.filter(key => key.frame !== animationState.frame);
    removed += keys.length - remaining.length;
    animationState.keys[bone.id] = remaining;
  }
  updateAnimationPanel();
  log(removed ? `Deleted ${removed} key${removed === 1 ? "" : "s"} at frame ${animationState.frame}.` : `Frame ${animationState.frame} has no keys to delete.`);
}
function animationTimelineEscape(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}
function animationBoneDepth(bone) {
  let depth = 0;
  let current = bone;
  const visited = new Set([bone.id]);
  while (current?.parentId && depth < 8) {
    if (visited.has(current.parentId)) break;
    visited.add(current.parentId);
    current = boneById(current.parentId);
    depth += 1;
  }
  return depth;
}
function animationTimelineTickStep(end) {
  const rough = Math.max(1, end / 12);
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  return [1, 2, 5, 10].map(value => value * magnitude).find(value => value >= rough) || magnitude * 10;
}
function animationTimelineFrameFromPoint(clientX, rect) {
  const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
  return Math.round(ratio * animationState.end);
}
function bindAnimationTimelineEvents() {
  els.animationTrackList.querySelectorAll("[data-animation-frame]").forEach(button => button.addEventListener("click", event => {
    event.stopPropagation();
    animationSetFrame(button.dataset.animationFrame);
  }));
  els.animationTrackList.querySelectorAll("[data-animation-bone]").forEach(button => button.addEventListener("click", () => {
    selectedBoneId = button.dataset.animationBone || null;
    syncBonePanel();
    rebuildBoneVisuals();
    updateAnimationPanel();
  }));
  els.animationTrackList.querySelectorAll("[data-animation-lane]").forEach(lane => lane.addEventListener("pointerdown", event => {
    if (event.button !== 0 || event.target.closest("[data-animation-frame]")) return;
    event.preventDefault();
    const rect = lane.getBoundingClientRect();
    const seek = pointerEvent => animationSetFrame(animationTimelineFrameFromPoint(pointerEvent.clientX, rect));
    const finish = () => {
      document.removeEventListener("pointermove", seek);
      document.removeEventListener("pointerup", finish);
      document.removeEventListener("pointercancel", finish);
    };
    seek(event);
    document.addEventListener("pointermove", seek);
    document.addEventListener("pointerup", finish);
    document.addEventListener("pointercancel", finish);
  }));
}
function updateAnimationPanelLegacy() {
  if (!els.animationScrubber) return;
  els.animationFpsInput.value = animationState.fps;
  els.animationEndInput.value = animationState.end;
  els.animationScrubber.max = animationState.end; els.animationScrubber.value = animationState.frame;
  els.animationFrameLabel.textContent = `Frame ${animationState.frame} / ${animationState.end}`;
  els.animationTimeLabel.textContent = `${(animationState.frame / animationState.fps).toFixed(2)}s`;
  els.animationPlayBtn.textContent = animationState.playing ? "❚❚ Pause" : "▶ Play";
  els.animationTrackList.innerHTML = rigBones.length ? rigBones.map(bone => `<div class="animation-track"><span>${bone.name}</span><span>${(animationState.keys[bone.id] || []).map(key => `<button type="button" data-animation-frame="${key.frame}" title="Go to frame ${key.frame}">${key.frame}</button>`).join("") || "—"}</span></div>`).join("") : '<span class="api-note">Add bones, then use “Key Pose” to create animation keys.</span>';
  els.animationTrackList.querySelectorAll("[data-animation-frame]").forEach(button => button.addEventListener("click", () => animationSetFrame(button.dataset.animationFrame)));
}
function syncAnimationScrubberToTimeline() {
  if (!els.animationTrackList) return;
  const style = getComputedStyle(els.animationTrackList);
  const borderWidth = (Number.parseFloat(style.borderLeftWidth) || 0) + (Number.parseFloat(style.borderRightWidth) || 0);
  const scrollbarWidth = Math.max(0, els.animationTrackList.offsetWidth - els.animationTrackList.clientWidth - borderWidth);
  document.getElementById("animationBody")?.style.setProperty("--animation-timeline-scrollbar-width", `${scrollbarWidth}px`);
}
function updateAnimationPlaybackPanel() {
  if (!els.animationScrubber) return;
  els.animationScrubber.max = animationState.end;
  els.animationScrubber.value = animationState.frame;
  els.animationFrameLabel.textContent = `Frame ${animationState.frame} / ${animationState.end}`;
  els.animationTimeLabel.textContent = `${(animationState.frame / animationState.fps).toFixed(2)}s`;
  els.animationPlayBtn.textContent = animationState.playing ? "Pause" : "Play";
  const end = Math.max(1, animationState.end);
  const playhead = `${Math.max(0, Math.min(100, animationState.frame / end * 100))}%`;
  els.animationTrackList?.querySelectorAll(".animation-timeline-lane").forEach(lane => lane.style.setProperty("--playhead", playhead));
  els.animationTrackList?.querySelectorAll("[data-animation-frame]").forEach(marker => {
    marker.classList.toggle("current", Number(marker.dataset.animationFrame) === animationState.frame);
  });
}
function updateAnimationPanel() {
  if (!els.animationScrubber) return;
  syncAnimationClipUi();
  els.animationFpsInput.value = animationState.fps;
  els.animationEndInput.value = animationState.end;
  els.animationScrubber.max = animationState.end;
  els.animationScrubber.value = animationState.frame;
  els.animationFrameLabel.textContent = `Frame ${animationState.frame} / ${animationState.end}`;
  els.animationTimeLabel.textContent = `${(animationState.frame / animationState.fps).toFixed(2)}s`;
  els.animationPlayBtn.textContent = animationState.playing ? "Pause" : "Play";
  if (!rigBones.length) {
    els.animationTrackList.innerHTML = '<span class="api-note">Add bones, then use Key Pose to create animation keys.</span>';
    return;
  }
  const end = Math.max(1, animationState.end);
  const playhead = Math.max(0, Math.min(100, animationState.frame / end * 100));
  const tickStep = animationTimelineTickStep(end);
  const ticks = [];
  for (let frame = 0; frame <= end; frame += tickStep) ticks.push(frame);
  if (ticks[ticks.length - 1] !== end) ticks.push(end);
  const timelineGridSize = Math.max(.1, tickStep / end * 100);
  const ruler = `<div class="animation-timeline-row animation-timeline-ruler"><div class="animation-track-name animation-track-heading">BONE TRACKS</div><div class="animation-timeline-lane" data-animation-lane style="--playhead:${playhead}%;--timeline-grid-size:${timelineGridSize}%">${ticks.map(frame => `<span class="animation-ruler-tick" style="left:${frame / end * 100}%">${frame}</span>`).join("")}</div></div>`;
  const tracks = rigBones.map(bone => {
    const depth = animationBoneDepth(bone);
    const keys = animationState.keys[bone.id] || [];
    return `<div class="animation-timeline-row${bone.id === selectedBoneId ? " selected" : ""}"><div class="animation-track-name"><button type="button" data-animation-bone="${animationTimelineEscape(bone.id)}" style="--bone-depth:${depth}">${animationTimelineEscape(bone.name)}</button></div><div class="animation-timeline-lane" data-animation-lane="${animationTimelineEscape(bone.id)}" style="--playhead:${playhead}%;--timeline-grid-size:${timelineGridSize}%">${keys.map(key => `<button class="animation-key-marker${key.frame === animationState.frame ? " current" : ""}" type="button" data-animation-frame="${key.frame}" style="left:${Math.max(0, Math.min(100, key.frame / end * 100))}%" title="${animationTimelineEscape(bone.name)} at frame ${key.frame}"><span>${key.frame}</span></button>`).join("")}</div></div>`;
  }).join("");
  els.animationTrackList.innerHTML = `<div class="animation-timeline-grid">${ruler}${tracks}</div>`;
  syncAnimationScrubberToTimeline();
  requestAnimationFrame(syncAnimationScrubberToTimeline);
  bindAnimationTimelineEvents();
}
function updateAnimation(delta) {
  if (!animationState.playing || !animationHasKeys()) {
    animationState.playing = false;
    return;
  }
  const frameDuration = 1 / Math.max(1, animationState.fps);
  animationState.lastTime += Math.max(0, Number(delta) || 0);
  const elapsedFrames = Math.floor(animationState.lastTime / frameDuration);
  if (elapsedFrames < 1) return;
  // Skinning a dense model can make a render frame take longer than one
  // animation frame. Keep the clip on its real clock instead of discarding the
  // extra elapsed time and making the body plus armor appear in slow motion.
  animationState.lastTime -= elapsedFrames * frameDuration;
  const frameCount = Math.max(1, animationState.end + 1);
  animationSetFrame((animationState.frame + elapsedFrames) % frameCount, { lightweightPanel: true });
}
function exportAnimationJson() { const blob = new Blob([JSON.stringify({ kind: "boltworks-animation", version: 1, ...serializeBoneRig().animation }, null, 2)], { type: "application/json" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "boltworks-animation.json"; link.click(); URL.revokeObjectURL(link.href); }

function importedBoneArray(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.bones)) return data.bones;
  if (Array.isArray(data?.rigging?.bones)) return data.rigging.bones;
  if (Array.isArray(data?.editor?.rigging?.bones)) return data.editor.rigging.bones;
  return null;
}

function importBoneStructure(data, fileName = "bone structure") {
  fitBoneCamera.restExtent = null;  // reframe Front/Side views for the new rig
  const sourceBones = importedBoneArray(data);
  if (!sourceBones?.length) throw new Error("Bone structure JSON does not contain a non-empty bones array.");
  recordBoneHistory("import bone structure");
  const coordinateSpace = String(data?.coordinateSpace || data?.rigging?.coordinateSpace || "world").toLowerCase();
  const rotationUnit = String(data?.rotationUnit || data?.rigging?.rotationUnit || "radians").toLowerCase();
  const usedIds = new Set();
  const imported = sourceBones.map((source, index) => {
    let id = String(source.id || `bone-${index + 1}`).trim() || `bone-${index + 1}`;
    while (usedIds.has(id)) id = `${id}-${index + 1}`;
    usedIds.add(id);
    const rawPosition = Array.isArray(source.position) ? source.position : [source.x, source.y, source.z];
    const rawRotation = Array.isArray(source.rotationDegrees)
      ? source.rotationDegrees.map(value => THREE.MathUtils.degToRad(Number(value) || 0))
      : (Array.isArray(source.rotation) ? source.rotation : [0, 0, 0]).map(value => {
          const numeric = Number(value) || 0;
          return rotationUnit === "degrees" ? THREE.MathUtils.degToRad(numeric) : numeric;
        });
    return {
      id,
      name: String(source.name || id),
      parentId: source.parentId == null || source.parentId === "" ? null : String(source.parentId),
      position: new THREE.Vector3(
        Number(rawPosition?.[0]) || 0,
        Number(rawPosition?.[1]) || 0,
        Number(rawPosition?.[2]) || 0
      ),
      rotation: new THREE.Vector3().fromArray(rawRotation)
    };
  });
  const importedById = new Map(imported.map(bone => [bone.id, bone]));
  imported.forEach(bone => {
    if (bone.parentId && !importedById.has(bone.parentId)) bone.parentId = null;
  });
  if (coordinateSpace === "local") {
    const resolved = new Set();
    const resolving = new Set();
    const resolveWorldPosition = bone => {
      if (resolved.has(bone.id)) return bone.position;
      if (resolving.has(bone.id)) {
        bone.parentId = null;
        return bone.position;
      }
      resolving.add(bone.id);
      const parent = importedById.get(bone.parentId);
      if (parent) bone.position.add(resolveWorldPosition(parent));
      resolving.delete(bone.id);
      resolved.add(bone.id);
      return bone.position;
    };
    imported.forEach(resolveWorldPosition);
  }
  rigBones = imported;
  rigBones.forEach(bone => {
    const child = rigBones.find(candidate => candidate.parentId === bone.id);
    bone.tail = child?.position?.clone() || bone.position.clone().add(new THREE.Vector3(0, .12, 0));
  });
  rigBones.forEach(bone => initializeBoneRestState(bone, { capture: true }));
  selectedBoneId = rigBones[0].id;
  rebuildBoneVisuals();
  syncBonePanel();
  log(`Imported ${rigBones.length} bones from ${fileName}.`, {
    coordinateSpace,
    roots: rigBones.filter(bone => !bone.parentId).length
  });
}

function addRigBone(asChild) {
  recordBoneHistory("add bone");
  const parent = asChild ? selectedBone() : null;
  const position = parent
    ? (parent.tail?.clone() || parent.position.clone().add(new THREE.Vector3(0, .25, 0)))
    : new THREE.Vector3(0, rigBones.length ? rigBones.length * .25 : 1, 0);
  const parentDirection = parent?.tail
    ? parent.tail.clone().sub(parent.position).normalize()
    : new THREE.Vector3(0, 1, 0);
  const boneLength = Math.max(.12, parent?.tail?.distanceTo(parent.position) || .25);
  const bone = {
    id: freshBoneId(),
    name: parent ? `${parent.name} Child` : `Bone ${rigBones.length + 1}`,
    parentId: parent?.id || null,
    position,
    rotation: new THREE.Vector3(),
    tail: position.clone().add(parentDirection.multiplyScalar(boneLength))
  };
  rigBones.push(bone);
  initializeBoneRestState(bone, { capture: true });
  selectedBoneId = bone.id;
  rebuildBoneVisuals();
  syncBonePanel();
  log(`Added ${bone.name}.`);
}

function deleteSelectedBone() {
  const bone = selectedBone();
  if (!bone) return;
  recordBoneHistory("delete bone");
  rigBones.forEach(child => {
    if (child.parentId === bone.id) child.parentId = bone.parentId || null;
  });
  rigBones = rigBones.filter(item => item.id !== bone.id);
  selectedBoneId = rigBones[0]?.id || null;
  rebuildBoneVisuals();
  syncBonePanel();
}

function skeletonBoneColor(bone, selected = false) {
  if (selected) return 0xffc547;
  const label = `${bone?.id || ""} ${bone?.name || ""}`.toLowerCase();
  if (label.includes("left_") || /(?:^|\s)l(?:\s|$)/.test(label)) return 0xb8d7e8;
  if (label.includes("right_") || /(?:^|\s)r(?:\s|$)/.test(label)) return 0xe7c0b5;
  return 0xd8cfaa;
}

function normalizedBoneAnatomyScale(bone) {
  const source = bone?.anatomyScale;
  return new THREE.Vector3(
    THREE.MathUtils.clamp(Number(source?.x) || 1, .25, 3),
    THREE.MathUtils.clamp(Number(source?.y) || 1, .25, 3),
    THREE.MathUtils.clamp(Number(source?.z) || 1, .25, 3)
  );
}

function bakeSkeletonAnatomyScale(mesh, bone) {
  const scale = normalizedBoneAnatomyScale(bone);
  if (scale.distanceToSquared(new THREE.Vector3(1, 1, 1)) < 1e-8) return;
  const pivot = (bone?.displayPosition || bone?.position || new THREE.Vector3()).clone();
  mesh.updateMatrix();
  const aroundPivot = new THREE.Matrix4()
    .makeTranslation(pivot.x, pivot.y, pivot.z)
    .multiply(new THREE.Matrix4().makeScale(scale.x, scale.y, scale.z))
    .multiply(new THREE.Matrix4().makeTranslation(-pivot.x, -pivot.y, -pivot.z));
  mesh.geometry.applyMatrix4(aroundPivot.multiply(mesh.matrix));
  mesh.position.set(0, 0, 0);
  mesh.rotation.set(0, 0, 0);
  mesh.quaternion.identity();
  mesh.scale.set(1, 1, 1);
  mesh.updateMatrix();
}

function addSkeletonDisplayMesh(mesh, bone, { joint = false } = {}) {
  bakeSkeletonAnatomyScale(mesh, bone);
  mesh.material = new THREE.MeshStandardMaterial({
    color: skeletonBoneColor(bone, bone?.id === selectedBoneId),
    roughness: .78,
    metalness: 0,
    depthTest: true
  });
  mesh.renderOrder = 9998;
  mesh.userData.boneId = bone?.id || null;
  mesh.userData.boneJoint = joint;
  mesh.userData.skeletonAnatomy = true;
  mesh.layers.enable(0);
  mesh.layers.enable(1);
  mesh.layers.enable(2);
  boneRigGroup.add(mesh);
  return mesh;
}

function addSkeletonCavityMesh(mesh, bone) {
  bakeSkeletonAnatomyScale(mesh, bone);
  mesh.material = new THREE.MeshBasicMaterial({
    color: 0x211b13,
    depthTest: true,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2
  });
  mesh.renderOrder = 9999;
  mesh.userData.boneId = bone?.id || null;
  mesh.userData.boneJoint = true;
  mesh.userData.skeletonAnatomy = true;
  mesh.layers.enable(0);
  mesh.layers.enable(1);
  mesh.layers.enable(2);
  boneRigGroup.add(mesh);
  return mesh;
}

function addSkeletonLongBone(bone, start, end, radius, offset = null) {
  const from = start.clone().add(offset || new THREE.Vector3());
  const to = end.clone().add(offset || new THREE.Vector3());
  const direction = to.clone().sub(from);
  const length = direction.length();
  if (length < .005) return null;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(radius * .82, radius, length, 8, 1, false));
  shaft.position.copy(from).addScaledVector(direction, .5);
  shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return addSkeletonDisplayMesh(shaft, bone);
}

function addSkeletonJoint(bone, position, radius) {
  const joint = new THREE.Mesh(new THREE.SphereGeometry(radius, 10, 8));
  joint.position.copy(position);
  return addSkeletonDisplayMesh(joint, bone, { joint: true });
}

function addSimplifiedSkeletonVisuals() {
  const thickness = .55 + boneGuideScale * .55;
  const activeBones = rigBones.filter(bone => !bone.hidden && bone.role !== "camera");
  for (const bone of activeBones) {
    const start = (bone.displayPosition || bone.position).clone();
    const directChild = rigBones.find(candidate => candidate.parentId === bone.id && candidate.role !== "itemSocket");
    const end = (directChild?.displayPosition || directChild?.position || bone.displayTail || bone.tail || start.clone().add(new THREE.Vector3(0, .1, 0))).clone();
    const name = String(bone.name || "").toLowerCase();
    if (bone.role === "itemSocket") {
      const socket = new THREE.Mesh(new THREE.TorusGeometry(.045 * thickness, .008, 6, 16));
      socket.position.copy(start);
      socket.rotation.x = Math.PI / 2;
      addSkeletonDisplayMesh(socket, bone, { joint: true });
      continue;
    }
    const length = Math.max(.01, start.distanceTo(end));
    let radius = Math.min(.032, Math.max(.008, length * .052)) * thickness;
    if (/finger|thumb|index|middle|ring|pinky/.test(name)) radius = .0075 * thickness;
    else if (/thigh|upper arm/.test(name)) radius = Math.max(radius, .024 * thickness);
    else if (/forearm|shin/.test(name)) radius = Math.max(radius, .016 * thickness);
    else if (/spine|chest|neck/.test(name)) radius = Math.max(radius, .017 * thickness);
    const usesPairedBones = /forearm|shin/.test(name);
    const hasDedicatedTorsoAnatomy = /^(root|pelvis|spine|chest|head)$/.test(name.trim());
    if (!usesPairedBones && !hasDedicatedTorsoAnatomy) addSkeletonLongBone(bone, start, end, radius);
    // Forearms and lower legs use two simplified parallel bones, enough to read
    // anatomically at an isometric game-camera distance without medical detail.
    if (usesPairedBones) {
      const direction = end.clone().sub(start).normalize();
      const reference = Math.abs(direction.y) > .85 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
      const pairedOffset = direction.clone().cross(reference).normalize().multiplyScalar(radius * .46);
      addSkeletonLongBone(bone, start, end, radius * .62, pairedOffset);
      addSkeletonLongBone(bone, start, end, radius * .62, pairedOffset.clone().multiplyScalar(-1));
    }
    addSkeletonJoint(bone, start, Math.max(radius * .96, .009));
  }

  const head = rigBones.find(bone => /^head$/i.test(bone.name));
  if (head) {
    const start = head.displayPosition || head.position;
    const end = head.displayTail || head.tail || start.clone().add(new THREE.Vector3(0, .18, 0));
    const height = Math.max(.11, start.distanceTo(end) * .94);
    const skullCenter = start.clone().lerp(end, .61);
    const cranium = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12));
    cranium.position.copy(skullCenter).add(new THREE.Vector3(0, height * .07, -height * .025));
    cranium.scale.set(height * .4, height * .47, height * .36);
    addSkeletonDisplayMesh(cranium, head, { joint: true });

    // A separate tapered face and visible cavities keep the low-poly head
    // recognisable as a skull at the game's small isometric viewing distance.
    const face = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8));
    face.position.copy(skullCenter).add(new THREE.Vector3(0, -height * .08, height * .22));
    face.scale.set(height * .29, height * .25, height * .18);
    addSkeletonDisplayMesh(face, head, { joint: true });
    for (const side of [-1, 1]) {
      const socket = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 7));
      socket.position.copy(skullCenter).add(new THREE.Vector3(side * height * .145, height * .12, height * .345));
      socket.scale.set(height * .105, height * .09, height * .025);
      addSkeletonCavityMesh(socket, head);
    }
    const nose = new THREE.Mesh(new THREE.ConeGeometry(height * .055, height * .12, 3));
    nose.position.copy(skullCenter).add(new THREE.Vector3(0, -height * .015, height * .395));
    nose.rotation.x = Math.PI;
    addSkeletonCavityMesh(nose, head);

    const jawTopY = skullCenter.y - height * .17;
    const jawBottomY = skullCenter.y - height * .38;
    const jawZ = skullCenter.z + height * .205;
    addSkeletonLongBone(head,
      new THREE.Vector3(skullCenter.x - height * .275, jawTopY, jawZ),
      new THREE.Vector3(skullCenter.x - height * .19, jawBottomY, jawZ + height * .035),
      height * .035);
    addSkeletonLongBone(head,
      new THREE.Vector3(skullCenter.x + height * .275, jawTopY, jawZ),
      new THREE.Vector3(skullCenter.x + height * .19, jawBottomY, jawZ + height * .035),
      height * .035);
    addSkeletonLongBone(head,
      new THREE.Vector3(skullCenter.x - height * .19, jawBottomY, jawZ + height * .035),
      new THREE.Vector3(skullCenter.x + height * .19, jawBottomY, jawZ + height * .035),
      height * .032);
  }

  const chest = rigBones.find(bone => /^chest$/i.test(bone.name));
  const spine = rigBones.find(bone => /^spine$/i.test(bone.name));
  const pelvis = rigBones.find(bone => /^pelvis$/i.test(bone.name));
  const neck = rigBones.find(bone => /^neck$/i.test(bone.name));
  const leftShoulder = rigBones.find(bone => /upper arm l$/i.test(bone.name));
  const rightShoulder = rigBones.find(bone => /upper arm r$/i.test(bone.name));
  if (chest && spine) {
    const chestPosition = chest.displayPosition || chest.position;
    const spinePosition = spine.displayPosition || spine.position;
    const pelvisPosition = pelvis ? (pelvis.displayPosition || pelvis.position) : spinePosition;
    const leftShoulderPosition = leftShoulder && (leftShoulder.displayPosition || leftShoulder.position);
    const rightShoulderPosition = rightShoulder && (rightShoulder.displayPosition || rightShoulder.position);
    const shoulderCenter = leftShoulderPosition && rightShoulderPosition
      ? leftShoulderPosition.clone().lerp(rightShoulderPosition, .5)
      : chestPosition.clone();
    const torsoHeight = Math.max(.22, shoulderCenter.y - pelvisPosition.y);
    const ribTopY = shoulderCenter.y - torsoHeight * .15;
    const ribBottomY = shoulderCenter.y - torsoHeight * .53;
    const shoulderWidth = leftShoulderPosition && rightShoulderPosition
      ? leftShoulderPosition.distanceTo(rightShoulderPosition) * .36
      : Math.max(.14, chestPosition.distanceTo(spinePosition) * 1.3);
    const ribDepth = Math.max(.07, shoulderWidth * .52);
    const ribWidths = [.82, .94, 1, .98, .89, .74];
    for (let rib = 0; rib < ribWidths.length; rib += 1) {
      const ratio = rib / (ribWidths.length - 1);
      const center = new THREE.Vector3(chestPosition.x, THREE.MathUtils.lerp(ribTopY, ribBottomY, ratio), chestPosition.z);
      const width = shoulderWidth * ribWidths[rib];
      const drop = torsoHeight * (.018 + ratio * .025);
      for (const side of [-1, 1]) {
        const ribCurve = new THREE.CatmullRomCurve3([
          center.clone().add(new THREE.Vector3(side * .025, 0, -ribDepth * .38)),
          center.clone().add(new THREE.Vector3(side * width * .72, -drop * .08, -ribDepth * .32)),
          center.clone().add(new THREE.Vector3(side * width, -drop * .28, 0)),
          center.clone().add(new THREE.Vector3(side * width * .78, -drop * .5, ribDepth * .35)),
          center.clone().add(new THREE.Vector3(side * .055, -drop * .68, ribDepth * .48))
        ], false, "centripetal");
        const ribMesh = new THREE.Mesh(new THREE.TubeGeometry(ribCurve, 16, .0075 * thickness, 6, false));
        addSkeletonDisplayMesh(ribMesh, chest, { joint: true });
      }
    }
    const sternumTop = new THREE.Vector3(chestPosition.x, ribTopY - torsoHeight * .01, chestPosition.z + ribDepth * .49);
    const sternumBottom = new THREE.Vector3(chestPosition.x, ribBottomY - torsoHeight * .04, chestPosition.z + ribDepth * .49);
    addSkeletonLongBone(chest, sternumTop, sternumBottom, .011 * thickness);
  }
  if (pelvis) {
    const position = pelvis.displayPosition || pelvis.position;
    const hips = ["Thigh L", "Thigh R"].map(name => rigBones.find(bone => bone.name === name)).filter(Boolean);
    const hipPositions = hips.map(hip => hip.displayPosition || hip.position);
    const hipSpan = hipPositions.length === 2 ? hipPositions[0].distanceTo(hipPositions[1]) : .24;
    for (const hip of hips) {
      const hipPosition = hip.displayPosition || hip.position;
      addSkeletonLongBone(pelvis, position, hipPosition, .022 * thickness);
      const side = Math.sign(hipPosition.x - position.x) || 1;
      const hipPlate = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 9));
      hipPlate.position.copy(position).lerp(hipPosition, .68).add(new THREE.Vector3(side * hipSpan * .04, hipSpan * .16, 0));
      hipPlate.scale.set(hipSpan * .34 * thickness, hipSpan * .3 * thickness, hipSpan * .19 * thickness);
      hipPlate.rotation.z = side * .24;
      addSkeletonDisplayMesh(hipPlate, pelvis, { joint: true });

      const hipSocket = new THREE.Mesh(new THREE.TorusGeometry(hipSpan * .105 * thickness, hipSpan * .028 * thickness, 7, 14));
      hipSocket.position.copy(hipPosition).add(new THREE.Vector3(0, hipSpan * .025, hipSpan * .02));
      addSkeletonDisplayMesh(hipSocket, pelvis, { joint: true });
    }
    const sacrum = new THREE.Mesh(new THREE.ConeGeometry(hipSpan * .18 * thickness, hipSpan * .35 * thickness, 5));
    sacrum.position.copy(position).add(new THREE.Vector3(0, -hipSpan * .08, -hipSpan * .035));
    sacrum.rotation.z = Math.PI;
    addSkeletonDisplayMesh(sacrum, pelvis, { joint: true });
    if (hipPositions.length === 2) {
      const pubicCenter = position.clone().add(new THREE.Vector3(0, -hipSpan * .27, hipSpan * .08));
      for (const hipPosition of hipPositions) {
        addSkeletonLongBone(pelvis, hipPosition, pubicCenter, hipSpan * .055 * thickness);
      }
      addSkeletonJoint(pelvis, pubicCenter, hipSpan * .07 * thickness);
    }
  }
  if (pelvis && neck) {
    const from = pelvis.displayPosition || pelvis.position;
    const to = neck.displayPosition || neck.position;
    for (let vertebra = 1; vertebra < 9; vertebra += 1) {
      const position = from.clone().lerp(to, vertebra / 9);
      const owner = vertebra > 6 ? (chest || neck) : (spine || pelvis);
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(.018 * thickness, .021 * thickness, .012, 8));
      disc.position.copy(position);
      addSkeletonDisplayMesh(disc, owner, { joint: true });
    }
  }
}

function rebuildBoneVisuals() {
  while (boneRigGroup.children.length) {
    const child = boneRigGroup.children.pop();
    child.geometry?.dispose?.();
    child.material?.dispose?.();
  }
  const visible = els.showBonesInput?.checked ?? true;
  const guideScale = THREE.MathUtils.clamp(boneGuideScale, .2, 1);
  boneRigGroup.visible = visible;
  boneRigGroup.layers.enable(0);
  boneRigGroup.layers.enable(1);
  boneRigGroup.layers.enable(2);
  if (skeletonDisplayMode) {
    addSimplifiedSkeletonVisuals();
    const selectedSkeletonBone = selectedBone();
    if (selectedSkeletonBone && visible) addSelectedBoneGizmos(selectedSkeletonBone);
    syncBoneTransformGizmo();
    syncBoneJoystick();
    return;
  }
  for (const bone of rigBones) {
    if (bone.hidden) continue;
    const guidePosition = bone.displayPosition || bone.position;
    const directChild = rigBones.find(candidate => candidate.parentId === bone.id);
    const childTail = directChild ? (directChild.displayPosition || directChild.position) : null;
    const guideTail = childTail || bone.displayTail || bone.tail || bone.position.clone().add(new THREE.Vector3(0, .12, 0));
    const selectedGuide = bone.id === selectedBoneId;
    const lowerId = String(bone.id || "").toLowerCase();
    const lowerName = String(bone.name || "").toLowerCase();
    const leftSide = lowerId.includes("left_") || /(?:^|\s)l$/.test(lowerName);
    const rightSide = lowerId.includes("right_") || /(?:^|\s)r$/.test(lowerName);
    const jointColor = selectedGuide ? 0xffc547 : leftSide ? 0x55b7ff : rightSide ? 0xff6868 : 0xd8d8d8;
    const coneColor = selectedGuide ? 0xffc547 : leftSide ? 0x267dcc : rightSide ? 0xc93f3f : 0x9aa7ad;
    const boneVector = guideTail.clone().sub(guidePosition);
    const boneLength = boneVector.length();
    const childBone = rigBones.find(candidate => boneById(candidate.parentId)?.id === bone.id);
    const jointRadius = (selectedGuide ? .11 : .085) * guideScale;
    // Parent joint = sphere (yellow in your sketch). The cone above is the
    // child; its tip meets the next parent sphere, so the chain reads
    // sphere → cone → sphere with no gaps.
    const joint = new THREE.Mesh(
      new THREE.SphereGeometry(jointRadius, 16, 12),
      new THREE.MeshStandardMaterial({ color: jointColor, depthTest: true, roughness: .6, metalness: 0 })
    );
    joint.position.copy(guidePosition);
    joint.renderOrder = 10000;
    joint.userData.boneId = bone.id;
    joint.userData.boneJoint = true;
    joint.layers.enable(0);
    joint.layers.enable(1);
    joint.layers.enable(2);
    boneRigGroup.add(joint);
    const hitProxy = new THREE.Mesh(
      new THREE.SphereGeometry(.16, 8, 6),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hitProxy.position.copy(guidePosition);
    hitProxy.userData.boneId = bone.id;
    hitProxy.userData.boneJoint = true;
    hitProxy.layers.enable(0);
    hitProxy.layers.enable(1);
    hitProxy.layers.enable(2);
    boneRigGroup.add(hitProxy);
    if (boneLength > .01) {
      const direction = boneVector.clone().normalize();
      // Parent = ball. Child = the cone: flat base connected to the parent's
      // ball, point aimed at the child's end. The next ball (if a bone attaches
      // there) is placed at that point, so the chain reads ball → cone → ball.
      const coneRadius = Math.min(Math.max(boneLength * .18 * guideScale, .018), .22 * guideScale);
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(coneRadius, boneLength, 12, 1, false),
        new THREE.MeshStandardMaterial({ color: coneColor, depthTest: true, roughness: .8, metalness: 0 })
      );
      cone.position.copy(guidePosition).add(boneVector.clone().multiplyScalar(.5));
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
      cone.renderOrder = 9998;
      cone.userData.boneId = bone.id;
      cone.layers.enable(0);
      cone.layers.enable(1);
      cone.layers.enable(2);
      boneRigGroup.add(cone);
    }
  }
  const bone = selectedBone();
  if (bone && visible) addSelectedBoneGizmos(bone);
  syncBoneTransformGizmo();
  syncBoneJoystick();
}

function setBoneGuideScale(value) {
  boneGuideScale = THREE.MathUtils.clamp(Number(value) || .4, .2, 1);
  syncBoneGuideScaleUi();
  rebuildBoneVisuals();
}

function syncBoneGuideScaleUi() {
  if (els.boneGuideScaleInput) els.boneGuideScaleInput.value = String(boneGuideScale);
  if (els.boneGuideScaleValue) els.boneGuideScaleValue.textContent = `${Math.round(boneGuideScale * 100)}%`;
}

function setSkeletonMode(enabled) {
  const next = !!enabled;
  if (next === skeletonDisplayMode) return;
  skeletonDisplayMode = next;
  if (els.skeletonModeInput) els.skeletonModeInput.checked = skeletonDisplayMode;
  if (skeletonDisplayMode) {
    skeletonPreviousOpacity = rigModelOpacity;
    if (rigModelOpacity > .45) setRigModelOpacity(.35);
    if (els.showBonesInput) els.showBonesInput.checked = true;
    if (!tPoseFittingMode) setTPoseFittingMode(true);
    log("Skeleton Mode enabled. The simplified anatomy uses the same selectable rig and is shown inside the faded model.");
  } else {
    if (Number.isFinite(skeletonPreviousOpacity)) setRigModelOpacity(skeletonPreviousOpacity);
    skeletonPreviousOpacity = null;
    log("Skeleton Mode disabled. Restored the standard rig guides.");
  }
  rebuildBoneVisuals();
  syncBonePanel();
}

function restoreRigModelMaterials() {
  const restored = rigModelMaterialState.size > 0;
  for (const [material, state] of rigModelMaterialState) {
    material.opacity = state.opacity;
    material.transparent = state.transparent;
    material.depthWrite = state.depthWrite;
    material.needsUpdate = true;
  }
  rigModelMaterialState.clear();
  return restored;
}

function rigModelBaseMaterialState(material) {
  return rigModelMaterialState.get(material) || null;
}

function applyRigModelOpacity() {
  restoreRigModelMaterials();
  const roots = new Set(objects.filter(object => object && !object.userData?.editorHelper && object.userData?.rigRole !== "armor"));
  if (activeSkinRuntime?.avatar) roots.add(activeSkinRuntime.avatar);
  for (const root of roots) {
    root.traverse?.(part => {
      if (!part.isMesh) return;
      for (const material of (Array.isArray(part.material) ? part.material : [part.material])) {
        if (!material || rigModelMaterialState.has(material)) continue;
        const originalState = {
          opacity: material.opacity,
          transparent: material.transparent,
          depthWrite: material.depthWrite
        };
        rigModelMaterialState.set(material, originalState);
        material.opacity *= rigModelOpacity;
        material.transparent = material.transparent || rigModelOpacity < .999;
        // Preserve correct self-occlusion while the model is only slightly faded.
        // At true rig-debug opacity, disable depth writing so internal bones remain visible.
        material.depthWrite = rigModelOpacity >= .9 ? originalState.depthWrite : false;
        material.needsUpdate = true;
      }
    });
  }
}

function syncRigModelOpacityUi() {
  if (els.rigModelOpacityInput) els.rigModelOpacityInput.value = String(rigModelOpacity);
  if (els.rigModelOpacityValue) els.rigModelOpacityValue.textContent = `${Math.round(rigModelOpacity * 100)}%`;
  if (typeof animatorWorkspaceActive !== "undefined" && animatorWorkspaceActive && selected && els.opacityInput) {
    els.opacityInput.value = String(rigModelOpacity);
    if (els.opacityValue) els.opacityValue.value = rigModelOpacity.toFixed(2);
  }
}

function setRigModelOpacity(value) {
  rigModelOpacity = THREE.MathUtils.clamp(Number(value) || 1, .1, 1);
  syncRigModelOpacityUi();
  applyRigModelOpacity();
}

function setObjectLayer(object, layer) {
  object.traverse?.(child => child.layers.set(layer));
  object.traverse?.(child => child.layers.enable(0));
  object.layers.enable(0);
  object.layers.enable(layer);
  return object;
}

function addSelectedBoneGizmos(bone) {
  const size = Math.max(.55, boneRigBounds().getSize(new THREE.Vector3()).length() * .045);
  if (boneToolMode === "move") {
    const frontX = setObjectLayer(new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), bone.position, size, 0xe55555, size * .24, size * .14), 1);
    const frontY = setObjectLayer(new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), bone.position, size, 0x69d17d, size * .24, size * .14), 1);
    const sideZ = setObjectLayer(new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), bone.position, size, 0x5f8fe8, size * .24, size * .14), 2);
    const sideY = setObjectLayer(new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), bone.position, size, 0x69d17d, size * .24, size * .14), 2);
    [frontX, frontY, sideZ, sideY].forEach(gizmo => {
      gizmo.userData.boneGizmo = true;
      boneRigGroup.add(gizmo);
    });
    return;
  }
  // Rotation rings are supplied by TransformControls in the main viewport.
}

function setBoneMoveAxis(axis) {
  boneMoveAxis = boneMoveAxis === axis ? null : axis;
  boneToolMode = boneGizmoEnabled && boneGizmoToolMode === "translate" && boneMoveAxis ? "move" : null;
  els.boneAxisFreeBtn?.classList.toggle("active", boneMoveAxis === "free");
  els.boneAxisXBtn?.classList.toggle("active", boneMoveAxis === "x");
  els.boneAxisYBtn?.classList.toggle("active", boneMoveAxis === "y");
  els.boneAxisZBtn?.classList.toggle("active", boneMoveAxis === "z");
  applyBoneAxisLock();
  rebuildBoneVisuals();
}

function syncBonePanel() {
  if (!els.boneList) return;
  els.boneList.innerHTML = "";
  for (const bone of rigBones) {
    const row = document.createElement("div");
    row.className = "bone-row" + (bone.id === selectedBoneId ? " selected" : "") + (bone.hidden ? " bone-hidden" : "");
    row.dataset.boneId = bone.id;
    row.setAttribute("role", "option");
    const name = document.createElement("span");
    name.className = "bone-name";
    name.textContent = (bone.parentId ? "  " : "") + bone.name;
    row.append(name);
    if (bone.armorMount) {
      const mountBadge = document.createElement("span");
      mountBadge.className = "bone-mount-badge";
      mountBadge.textContent = "ARMOR";
      mountBadge.title = "Armor can attach rigidly to this bone";
      row.append(mountBadge);
    }
    const hideBtn = document.createElement("button");
    hideBtn.type = "button";
    hideBtn.className = "bone-hide-btn";
    hideBtn.title = bone.hidden ? "Show bone" : "Hide bone";
    hideBtn.textContent = bone.hidden ? "◡" : "👁";
    hideBtn.addEventListener("click", event => {
      event.stopPropagation();
      bone.hidden = !bone.hidden;
      recordBoneHistory(bone.hidden ? "hide bone" : "show bone");
      rebuildBoneVisuals();
      syncBonePanel();
    });
    row.append(hideBtn);
    row.addEventListener("click", () => {
      // Clicking the already-selected bone again unselects it.
      selectedBoneId = selectedBoneId === bone.id ? null : bone.id;
      rebuildBoneVisuals();
      syncBonePanel();
    });
    els.boneList.append(row);
  }
  const bone = selectedBone();
  els.boneParentSelect.innerHTML = '<option value="">None (root)</option>';
  for (const candidate of rigBones) {
    if (candidate.id === bone?.id) continue;
    const option = document.createElement("option");
    option.value = candidate.id;
    option.textContent = candidate.name;
    els.boneParentSelect.append(option);
  }
  const disabled = !bone;
  [els.boneNameInput, els.boneParentSelect, els.bonePosX, els.bonePosY, els.bonePosZ, els.boneRotX, els.boneRotY, els.boneRotZ, els.deleteBoneBtn].forEach(control => control.disabled = disabled);
  const anatomyDisabled = disabled || !skeletonDisplayMode;
  [els.boneAnatomyScaleX, els.boneAnatomyScaleY, els.boneAnatomyScaleZ, els.resetBoneAnatomyScaleBtn].forEach(control => {
    if (control) control.disabled = anatomyDisabled;
  });
  if (els.armorMountBtn) {
    els.armorMountBtn.disabled = disabled;
    els.armorMountBtn.textContent = bone?.armorMount ? "Remove Armor Bone" : "Use Bone for Armor";
    els.armorMountBtn.classList.toggle("active", !!bone?.armorMount);
  }
  if (els.attachArmorBtn) els.attachArmorBtn.disabled = !bone?.armorMount;
  els.selectedBoneLabel.textContent = `Selected: ${bone?.name || "None"}`;
  els.boneNameInput.value = bone?.name || "";
  els.boneParentSelect.value = bone?.parentId || "";
  els.bonePosX.value = bone ? String(round(bone.position.x)) : "";
  els.bonePosY.value = bone ? String(round(bone.position.y)) : "";
  els.bonePosZ.value = bone ? String(round(bone.position.z)) : "";
  els.boneRotX.value = bone ? String(round(THREE.MathUtils.radToDeg(bone.rotation.x))) : "";
  els.boneRotY.value = bone ? String(round(THREE.MathUtils.radToDeg(bone.rotation.y))) : "";
  els.boneRotZ.value = bone ? String(round(THREE.MathUtils.radToDeg(bone.rotation.z))) : "";
  const anatomyScale = normalizedBoneAnatomyScale(bone);
  if (els.boneAnatomyScaleX) els.boneAnatomyScaleX.value = bone ? String(round(anatomyScale.x)) : "1";
  if (els.boneAnatomyScaleY) els.boneAnatomyScaleY.value = bone ? String(round(anatomyScale.y)) : "1";
  if (els.boneAnatomyScaleZ) els.boneAnatomyScaleZ.value = bone ? String(round(anatomyScale.z)) : "1";
}

function applySelectedBoneAnatomyScale(reset = false) {
  const bone = selectedBone();
  if (!bone || !skeletonDisplayMode) return;
  recordBoneHistory(reset ? "reset skeleton part size" : "resize skeleton part");
  const next = reset
    ? new THREE.Vector3(1, 1, 1)
    : new THREE.Vector3(
      THREE.MathUtils.clamp(Number(els.boneAnatomyScaleX?.value) || 1, .25, 3),
      THREE.MathUtils.clamp(Number(els.boneAnatomyScaleY?.value) || 1, .25, 3),
      THREE.MathUtils.clamp(Number(els.boneAnatomyScaleZ?.value) || 1, .25, 3)
    );
  bone.anatomyScale = next;
  if (mirrorBoneEdits) {
    const mirror = boneById(mirroredBoneId(bone.id));
    if (mirror) mirror.anatomyScale = next.clone();
  }
  rebuildBoneVisuals();
  syncBonePanel();
}

function applyBonePanelValues() {
  const bone = selectedBone();
  if (!bone) return;
  recordBoneHistory("bone edit");
  const startPosition = bone.position.clone();
  const startRotation = bone.rotation.clone();
  const mirror = boneById(mirroredBoneId(bone.id));
  const mirrorStartPosition = mirror?.position.clone() || null;
  const mirrorStartRotation = mirror?.rotation.clone() || null;
  prepareLooseBoneHierarchy();
  bone.name = els.boneNameInput.value.trim() || bone.name;
  bone.parentId = els.boneParentSelect.value || null;
  bone.position.set(
    Number(els.bonePosX.value) || 0,
    Number(els.bonePosY.value) || 0,
    Number(els.bonePosZ.value) || 0
  );
  bone.rotation.set(
    THREE.MathUtils.degToRad(Number(els.boneRotX.value) || 0),
    THREE.MathUtils.degToRad(Number(els.boneRotY.value) || 0),
    THREE.MathUtils.degToRad(Number(els.boneRotZ.value) || 0)
  );
  applyCurrentRigPose({ resolveLooseHierarchy: true });
  mirrorBoneEdit(bone);
  if (mirrorBoneEdits) applyCurrentRigPose({ resolveLooseHierarchy: true });
  if (tPoseFittingMode) commitTPoseBoneFitting();
  commitLooseBonePosition(bone.id, startPosition);
  if (mirror?.id && mirrorStartPosition) commitLooseBonePosition(mirror.id, mirrorStartPosition);
  commitLooseBoneRotation(bone.id, startRotation);
  if (mirror?.id && mirrorStartRotation) commitLooseBoneRotation(mirror.id, mirrorStartRotation);
  rebuildBoneVisuals();
  syncBonePanel();
}

// ---- Glue / unglue bone rig to the model -------------------------------
// Gluing captures the current pose as the rest pose and makes every bound part
// (Minecraft cuboids via minecraftBoneId, or a selected skinned mesh) follow
// the bones live as you drag them. Ungluing freezes the model in place so you
// can reposition the rig freely.
function skinnedAvatar() {
  return activeSkinRuntime?.avatar || null;
}

function toggleGlueBones() {
  recordBoneHistory(bonesGlued ? "unglue bones" : "glue bones");
  if (bonesGlued) unglueBonesFromModel();
  else glueBonesToSelected();
}

function toggleSelectedArmorMount() {
  const bone = selectedBone();
  if (!bone) { log("Select a bone before enabling it for armor."); return; }
  recordBoneHistory("toggle armor mount");
  const oldMountId = bone.armorMountId || null;
  bone.armorMount = !bone.armorMount;
  if (bone.armorMount && !bone.armorMountId) bone.armorMountId = `armor-mount-${bone.id}`;
  let detached = 0;
  if (!bone.armorMount && oldMountId) {
    for (const object of objects) {
      if (object.userData?.rigArmorMountId !== oldMountId) continue;
      delete object.userData.rigArmorMountId;
      delete object.userData.rigAttachment;
      delete object.userData.rigBoneId;
      detached += 1;
    }
  }
  rebuildBoneVisuals();
  syncBonePanel();
  updateAll();
  log(`${bone.armorMount ? "Enabled" : "Disabled"} ${bone.name} for rigid armor${detached ? ` and detached ${detached} armor part${detached === 1 ? "" : "s"}` : ""}.`);
}

function setObjectRigRole(object, role) {
  if (!object || object.userData?.editorHelper) return false;
  const normalized = role === "armor" ? "armor" : "skin";
  object.userData.rigRole = normalized;
  if (normalized === "skin") {
    delete object.userData.rigArmorMountId;
    delete object.userData.rigAttachment;
    delete object.userData.rigBoneId;
  }
  return true;
}

function markCheckedRigRole(role) {
  const targets = (typeof checkedObjects === "function" ? checkedObjects() : []).filter(object => object && !object.userData?.editorHelper);
  if (!targets.length) { log(`Check one or more objects before marking them as ${role === "armor" ? "armor" : "skin and bone"}.`); return; }
  recordBoneHistory(`mark ${role}`);
  targets.forEach(object => setObjectRigRole(object, role));
  applyRigModelOpacity();
  updateAll();
  log(`Marked ${targets.length} object${targets.length === 1 ? "" : "s"} as ${role === "armor" ? "separate rigid armor" : "skin and bone"}.`);
}

function attachCheckedArmorToSelectedBone() {
  const bone = selectedBone();
  if (!bone) { log("Select an armor bone first."); return; }
  if (!bone.armorMount || !bone.armorMountId) { log(`Enable ${bone.name} for armor before attaching parts.`); return; }
  const checked = (typeof checkedObjects === "function" ? checkedObjects() : []).filter(object => object && !object.userData?.editorHelper);
  if (!checked.length) { log("Check one or more armor objects, then click Attach Checked Armor."); return; }
  const targets = checked.filter(object => object.userData?.rigRole === "armor");
  if (!targets.length) { log("None of the checked parts are marked Armor. Enable Armor on the parts first."); return; }
  recordBoneHistory("attach rigid armor");
  targets.forEach(object => {
    object.userData.rigBoneId = bone.id;
    object.userData.rigRole = "armor";
    object.userData.rigArmorMountId = bone.armorMountId;
    object.userData.rigAttachment = "rigidArmor";
  });
  captureAnimationBindingRest();
  bonesGlued = true;
  applyCurrentRigPose();
  rebuildBoneVisuals();
  syncBonePanel();
  updateGlueButton();
  const ignored = checked.length - targets.length;
  log(`Attached ${targets.length} armor part${targets.length === 1 ? "" : "s"} rigidly to ${bone.name}${ignored ? `; ignored ${ignored} checked skin part${ignored === 1 ? "" : "s"}` : ""}.`);
}

function armorBoneForObject(object) {
  if (!object?.userData) return null;
  const mountBone = object.userData.rigArmorMountId
    ? rigBones.find(bone => bone.armorMountId === object.userData.rigArmorMountId)
    : null;
  return mountBone || boneById(object.userData.rigBoneId);
}

function armorPairKey(object) {
  return `${object?.userData?.groupName || ""} ${object?.name || object?.userData?.id || ""}`
    .toLowerCase()
    .replace(/\bleft\b|\bright\b/g, "")
    .replace(/(?:^|[\s_.-])[lr](?=$|[\s_.-])/g, " ")
    .replace(/[\s_.-]+/g, " ")
    .trim();
}

const armorMirrorPairs = new Map();

function armorObjectId(object) {
  return object?.userData?.id || object?.uuid || null;
}

function rememberArmorMirrorPair(left, right) {
  const leftId = armorObjectId(left);
  const rightId = armorObjectId(right);
  if (!leftId || !rightId) return;
  armorMirrorPairs.set(leftId, rightId);
  armorMirrorPairs.set(rightId, leftId);
}

function armorSide(object) {
  const label = `${object?.userData?.groupName || ""} ${object?.name || ""}`.toLowerCase();
  if (/\bleft\b|(?:^|[\s_.-])l(?=$|[\s_.-])/.test(label)) return "left";
  if (/\bright\b|(?:^|[\s_.-])r(?=$|[\s_.-])/.test(label)) return "right";
  return null;
}

function mirroredArmorForObject(source) {
  const rememberedId = armorMirrorPairs.get(armorObjectId(source));
  const remembered = rememberedId
    ? objects.find(object => armorObjectId(object) === rememberedId && object.userData?.rigRole === "armor")
    : null;
  if (remembered) return remembered;
  const sourceBone = armorBoneForObject(source);
  const targetBone = sourceBone ? boneById(mirroredBoneId(sourceBone.id)) : null;
  const sourceSide = armorSide(source);
  if (!targetBone && !sourceSide) return null;
  const candidates = objects.filter(object => object !== source && object.userData?.rigRole === "armor");
  if (!candidates.length) return null;
  const sourceKey = armorPairKey(source);
  const oppositeSide = sourceSide === "left" ? "right" : (sourceSide === "right" ? "left" : null);
  const expectedPosition = new THREE.Vector3(-source.position.x, source.position.y, source.position.z);
  const exactNameMatches = sourceKey
    ? candidates.filter(candidate => armorPairKey(candidate) === sourceKey && (!oppositeSide || armorSide(candidate) === oppositeSide))
    : [];
  const oppositeBoneMatches = targetBone
    ? candidates.filter(candidate => armorBoneForObject(candidate)?.id === targetBone.id)
    : [];
  const eligible = exactNameMatches.length
    ? exactNameMatches
    : (oppositeBoneMatches.length ? oppositeBoneMatches : candidates.filter(candidate => !oppositeSide || armorSide(candidate) === oppositeSide));
  const target = eligible
    .map(candidate => {
      const candidateBone = armorBoneForObject(candidate);
      let score = candidate.position.distanceTo(expectedPosition) * 10;
      if (sourceKey && armorPairKey(candidate) === sourceKey) score -= 1000;
      if (targetBone && candidateBone?.id === targetBone.id) score -= 120;
      if (oppositeSide && armorSide(candidate) === oppositeSide) score -= 80;
      if (source.geometry?.type && candidate.geometry?.type === source.geometry.type) score -= 15;
      return { candidate, score };
    })
    .sort((left, right) => left.score - right.score)[0]?.candidate || null;
  if (target) rememberArmorMirrorPair(source, target);
  return target;
}

function armorFittingTargets(controlObject) {
  if (!controlObject) return [];
  const candidates = controlObject === groupPivot && typeof activeGroupObjects === "function"
    ? activeGroupObjects()
    : [controlObject];
  return candidates.filter(object => object?.userData?.rigRole === "armor");
}

function mirrorArmorFittingObject(source) {
  if (!mirrorBoneEdits) return null;
  const target = mirroredArmorForObject(source);
  if (!target) return null;
  target.position.set(-source.position.x, source.position.y, source.position.z);
  target.rotation.set(source.rotation.x, -source.rotation.y, -source.rotation.z, source.rotation.order || "XYZ");
  target.scale.copy(source.scale);
  target.updateMatrixWorld(true);
  return target;
}

function updateArmorFittingMirror(controlObject) {
  if (!mirrorBoneEdits) return 0;
  return armorFittingTargets(controlObject).map(mirrorArmorFittingObject).filter(Boolean).length;
}

function updateArmorBindingRest(targets) {
  if (!Array.isArray(targets) || !targets.length) return;
  if (!(animationState.bindingRest instanceof Map)) animationState.bindingRest = new Map();
  poseRigHierarchy();
  for (const object of targets) {
    const bone = armorBoneForObject(object);
    if (!bone) continue;
    const key = `rigid:${bone.id}:${object.userData?.id || object.uuid}`;
    const previous = animationState.bindingRest.get(key);
    const restBonePosition = previous?.bonePosition?.clone() || bone.bindPosition?.clone() || bone.position.clone();
    const restBoneRotation = previous?.boneRotation?.clone() || bone.bindRotation?.clone() || bone.rotation.clone();
    const restBoneQuaternion = previous?.boneQuaternion?.clone()
      || new THREE.Quaternion().setFromEuler(new THREE.Euler(restBoneRotation.x, restBoneRotation.y, restBoneRotation.z, "XYZ"));
    const skinnedBone = activeSkinRuntime?.threeBones?.get(bone.id) || null;
    const currentBonePosition = skinnedBone
      ? skinnedBone.getWorldPosition(new THREE.Vector3())
      : bone.position.clone();
    const currentBoneQuaternion = skinnedBone
      ? skinnedBone.getWorldQuaternion(new THREE.Quaternion())
      : (bone.poseWorldQuaternion?.clone()
        || new THREE.Quaternion().setFromEuler(new THREE.Euler(bone.rotation.x, bone.rotation.y, bone.rotation.z, "XYZ")));
    const inverseDelta = currentBoneQuaternion.clone().multiply(restBoneQuaternion.clone().invert()).invert();
    const objectPosition = object.position.clone().sub(currentBonePosition).applyQuaternion(inverseDelta).add(restBonePosition);
    const objectQuaternion = inverseDelta.clone().multiply(object.quaternion).normalize();
    const objectRotation = new THREE.Euler().setFromQuaternion(objectQuaternion, object.rotation.order || "XYZ");
    animationState.bindingRest.set(key, {
      object,
      bonePosition: restBonePosition,
      boneRotation: restBoneRotation,
      boneQuaternion: restBoneQuaternion,
      objectPosition,
      objectRotation,
      objectQuaternion
    });
  }
}

function finishArmorFittingTransform(controlObject) {
  const targets = armorFittingTargets(controlObject);
  if (!targets.length) return;
  const mirroredTargets = targets.map(mirrorArmorFittingObject).filter(Boolean);
  const mirroredCount = mirroredTargets.length;
  updateArmorBindingRest([...new Set([...targets, ...mirroredTargets])]);
  applyCurrentRigPose();
  updateAll();
  const mirrorResult = !mirrorBoneEdits
    ? ""
    : (mirroredCount ? ` and mirrored ${mirroredCount} matching opposite-side armor part${mirroredCount === 1 ? "" : "s"}` : "; no opposite armor counterpart was found");
  log(`Saved fitted armor offset${targets.length === 1 ? "" : "s"} relative to the assigned bone${mirrorResult}.`);
}

function glueBonesToSelected() {
  if (!rigBones.length) { log("Add or import bones first."); return; }
  captureRigBindPose();
  const groupTargets = selectedGroupRecordId && typeof descendantMeshesForGroup === "function"
    ? descendantMeshesForGroup(selectedGroupRecordId)
    : (typeof activeGroupObjects === "function" ? activeGroupObjects() : []);
  if (groupTargets.length > 1) {
    // Bind every immediate model group as one rigid part. The group's shared
    // centre decides which placed bone contains/owns it, so all cubes in a limb
    // follow together instead of each cube choosing a different bone.
    const targetsByGroup = new Map();
    for (const object of groupTargets) {
      const key = object.userData?.groupId || `object:${object.userData?.id || object.uuid}`;
      if (!targetsByGroup.has(key)) targetsByGroup.set(key, []);
      targetsByGroup.get(key).push(object);
    }
    for (const targets of targetsByGroup.values()) {
      const bounds = new THREE.Box3();
      targets.forEach(object => bounds.expandByObject(object));
      const centre = bounds.getCenter(new THREE.Vector3());
      let closestBone = rigBones[0];
      let closestDistance = Infinity;
      for (const bone of rigBones) {
        const tail = bone.bindTail || bone.tail || bone.bindPosition.clone().add(new THREE.Vector3(0, .12, 0));
        const distance = pointSegmentDistanceSquared(centre, bone.bindPosition, tail);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestBone = bone;
        }
      }
      targets.forEach(object => { object.userData.rigBoneId = closestBone.id; });
    }
    captureAnimationBindingRest();
    bonesGlued = true;
    rebuildBoneVisuals();
    syncBonePanel();
    updateGlueButton();
    log(`Glued ${groupTargets.length} model parts to ${rigBones.length} placed bones. Groups now follow their nearest bone.`);
    return;
  }
  // Minecraft-style models already bind parts via minecraftBoneId.
  const hasPartBindings = objects.some(o => o.userData?.rigBoneId || o.userData?.minecraft?.boneId || o.userData?.minecraftBoneId);
  if (hasPartBindings) {
    // Capture the rest pose from the CURRENT bone/object arrangement BEFORE any
    // hierarchy resolve, so gluing never shifts parts from their imported pose.
    captureAnimationBindingRest();
    bonesGlued = true;
    rebuildBoneVisuals();
    syncBonePanel();
    updateGlueButton();
    log(`Glued the rig to the model. Drag a bone and its parts follow.`);
    return;
  }
  // Generic single-mesh skinning path.
  const targetCandidate = selected || groupTargets[0] || null;
  const target = targetCandidate?.geometry?.getAttribute?.("position") ? targetCandidate : null;
  if (!target) { log("Select the model mesh first, then click Glue Bone to Model."); return; }
  const targetId = target.userData?.id || target.name;
  rigBones.forEach(bone => {
    bone.avatarObjectId = targetId;
  });
  setupSkinnedRig();
  if (activeSkinRuntime) {
    bonesGlued = true;
    applyCurrentRigPose();
    rebuildBoneVisuals();
    syncBonePanel();
    updateGlueButton();
    log(`Glued ${rigBones.length} bones to "${target.name || targetId}". The model now follows the rig.`);
  } else {
    log("Could not glue: no Minecraft bone parts found and the selected mesh needs at least 2 bones.");
  }
}

function unglueBonesFromModel() {
  bonesGlued = false;
  animationState.bindingRest = null;
  objects.forEach(object => {
    if (object.userData && object.userData.rigAttachment !== "rigidArmor") delete object.userData.rigBoneId;
  });
  if (activeSkinRuntime) {
    const avatar = activeSkinRuntime.avatar;
    const plain = new THREE.Mesh(avatar.geometry.clone(), avatar.material);
    plain.name = avatar.name;
    plain.position.copy(avatar.position);
    plain.quaternion.copy(avatar.quaternion);
    plain.scale.copy(avatar.scale);
    plain.visible = avatar.visible;
    plain.castShadow = avatar.castShadow;
    plain.receiveShadow = avatar.receiveShadow;
    plain.renderOrder = avatar.renderOrder;
    plain.userData = { ...avatar.userData };
    delete plain.userData.skeletalRig;
    plain.geometry.deleteAttribute("skinIndex");
    plain.geometry.deleteAttribute("skinWeight");
    const objectIndex = objects.indexOf(avatar);
    scene.remove(avatar);
    scene.add(plain);
    if (objectIndex >= 0) objects[objectIndex] = plain;
    if (selected === avatar) selected = plain;
    activeSkinRuntime = null;
  }
  rigBones.forEach(bone => {
    bone.avatarObjectId = null;
    bone.displayPosition = null;
    bone.displayTail = null;
  });
  rebuildBoneVisuals();
  syncBonePanel();
  updateGlueButton();
  log("Unglued the rig from the model. You can now move bones freely.");
}

function updateGlueButton() {
  if (els.glueBoneBtn) els.glueBoneBtn.textContent = bonesGlued ? "Unglue Bone from Model" : "Glue Bone to Model";
  els.glueBoneBtn?.classList.toggle("active", bonesGlued);
}

// Called whenever scene objects are removed: drop bones that no longer have any
// bound part left, so a deleted model doesn't leave a floating skeleton behind.
function pruneBonesForRemovedObjects() {
  if (!rigBones.length) return;
  const minecraftBoneIds = new Set();
  for (const object of objects) {
    const mountBoneId = object.userData?.rigArmorMountId ? rigBones.find(bone => bone.armorMountId === object.userData.rigArmorMountId)?.id : null;
    const boneId = mountBoneId || object.userData?.rigBoneId || object.userData?.minecraft?.boneId || object.userData?.minecraftBoneId;
    if (boneId) minecraftBoneIds.add(boneId);
  }
  const before = rigBones.length;
  if (minecraftBoneIds.size) {
    rigBones = rigBones.filter(bone => minecraftBoneIds.has(bone.id));
    rigBones.forEach(bone => { if (bone.parentId && !boneById(bone.parentId)) bone.parentId = null; });
  } else {
    rigBones = [];
  }
  if (rigBones.length !== before) {
    if (selectedBoneId && !boneById(selectedBoneId)) selectedBoneId = rigBones[0]?.id || null;
    if (!rigBones.length) { bonesGlued = false; activeSkinRuntime = null; }
    rebuildBoneVisuals();
    syncBonePanel();
    updateGlueButton();
  }
}

function boneRigBounds() {
  const box = new THREE.Box3();
  const modelBox = sceneBounds();
  if (modelBox && !modelBox.isEmpty()) box.union(modelBox);
  rigBones.forEach(bone => box.expandByPoint(bone.position));
  if (box.isEmpty()) box.setFromCenterAndSize(new THREE.Vector3(0, 1, 0), new THREE.Vector3(6, 6, 6));
  return box;
}

function applyReferenceCameraFrame(referenceCamera, canvasElement, view) {
  const state = referenceViewState[view];
  const rect = canvasElement.parentElement.getBoundingClientRect();
  const aspect = rect.width / Math.max(1, rect.height);
  const halfHeight = Math.max(.01, state.halfHeight);
  const halfWidth = halfHeight * aspect;
  referenceCamera.left = -halfWidth;
  referenceCamera.right = halfWidth;
  referenceCamera.top = halfHeight;
  referenceCamera.bottom = -halfHeight;
  if (view === "front") {
    referenceCamera.position.set(state.center.x, state.center.y, state.center.z + 100);
    referenceCamera.up.set(0, 1, 0);
  } else {
    referenceCamera.position.set(state.center.x + 100, state.center.y, state.center.z);
    referenceCamera.up.set(0, 1, 0);
  }
  referenceCamera.lookAt(state.center);
  referenceCamera.updateProjectionMatrix();
}

function fitBoneCamera(referenceCamera, canvasElement, view) {
  const state = referenceViewState[view];
  const rect = canvasElement.parentElement.getBoundingClientRect();
  const bounds = boneRigBounds();
  const size = bounds.getSize(new THREE.Vector3());
  state.center.copy(bounds.getCenter(new THREE.Vector3()));
  const aspect = rect.width / Math.max(1, rect.height);
  const verticalSize = Math.max(.25, size.y);
  const horizontalSize = Math.max(.25, view === "front" ? size.x : size.z);
  state.halfHeight = Math.max(verticalSize * .58, horizontalSize / Math.max(.1, aspect) * .58, 2);
  state.initialized = true;
  state.followTool = false;
  applyReferenceCameraFrame(referenceCamera, canvasElement, view);
  syncReferenceViewControls(view);
}

function resizeReferenceRenderer(referenceRenderer, referenceCamera, referenceCanvas, view) {
  const rect = referenceCanvas.parentElement.getBoundingClientRect();
  referenceRenderer.setSize(rect.width, rect.height, false);
  const state = referenceViewState[view];
  if (!state.initialized) fitBoneCamera(referenceCamera, referenceCanvas, view);
  else applyReferenceCameraFrame(referenceCamera, referenceCanvas, view);
}

function referenceViewElements(view) {
  return view === "front"
    ? { canvas: frontBoneCanvas, camera: frontBoneCamera, pan: els.frontReferencePanBtn, follow: els.frontReferenceFollowBtn }
    : { canvas: sideBoneCanvas, camera: sideBoneCamera, pan: els.sideReferencePanBtn, follow: els.sideReferenceFollowBtn };
}

function syncReferenceViewControls(view) {
  const state = referenceViewState[view];
  const controls = referenceViewElements(view);
  controls.pan?.classList.toggle("active", state.panEnabled);
  controls.follow?.classList.toggle("active", state.followTool);
  controls.canvas?.parentElement?.classList.toggle("reference-pan-active", state.panEnabled);
}

function referenceToolFocusPoint() {
  if (surfaceTransform.visible && surfaceTransform.object) return surfaceGizmoPivot.getWorldPosition(new THREE.Vector3());
  if (transform.visible && transform.object) return transform.object.getWorldPosition(new THREE.Vector3());
  if (boneTransform.visible && boneTransform.object) return boneTransform.object.getWorldPosition(new THREE.Vector3());
  const bone = selectedBone();
  if (bone) return (bone.displayPosition || bone.position).clone();
  if (selected?.isObject3D) return selected.getWorldPosition(new THREE.Vector3());
  return null;
}

function updateReferenceViewFollowing() {
  const target = referenceToolFocusPoint();
  if (!target) return;
  for (const view of ["front", "side"]) {
    const state = referenceViewState[view];
    if (!state.followTool) continue;
    state.center.copy(target);
    const controls = referenceViewElements(view);
    applyReferenceCameraFrame(controls.camera, controls.canvas, view);
  }
}

function toggleReferenceViewPan(view) {
  const state = referenceViewState[view];
  state.panEnabled = !state.panEnabled;
  if (state.panEnabled) state.followTool = false;
  syncReferenceViewControls(view);
}

function toggleReferenceViewFollow(view) {
  const state = referenceViewState[view];
  state.followTool = !state.followTool;
  if (state.followTool) state.panEnabled = false;
  syncReferenceViewControls(view);
  updateReferenceViewFollowing();
}

function beginReferenceViewPan(event, view, canvasElement, referenceCamera) {
  const state = referenceViewState[view];
  if (!state.panEnabled || event.button !== 0) return false;
  referenceViewPanDrag = {
    pointerId: event.pointerId,
    view,
    canvas: canvasElement,
    camera: referenceCamera,
    startX: event.clientX,
    startY: event.clientY,
    startCenter: state.center.clone()
  };
  canvasElement.setPointerCapture?.(event.pointerId);
  canvasElement.parentElement?.classList.add("reference-pan-dragging");
  event.preventDefault();
  return true;
}

function moveReferenceViewPan(event) {
  const drag = referenceViewPanDrag;
  if (!drag || event.pointerId !== drag.pointerId) return false;
  const state = referenceViewState[drag.view];
  const rect = drag.canvas.getBoundingClientRect();
  const unitsX = (drag.camera.right - drag.camera.left) / Math.max(1, rect.width);
  const unitsY = (drag.camera.top - drag.camera.bottom) / Math.max(1, rect.height);
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(drag.camera.quaternion);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(drag.camera.quaternion);
  state.center.copy(drag.startCenter)
    .addScaledVector(right, -(event.clientX - drag.startX) * unitsX)
    .addScaledVector(up, (event.clientY - drag.startY) * unitsY);
  applyReferenceCameraFrame(drag.camera, drag.canvas, drag.view);
  event.preventDefault();
  return true;
}

function endReferenceViewPan(event) {
  const drag = referenceViewPanDrag;
  if (!drag || event.pointerId !== drag.pointerId) return false;
  drag.canvas.releasePointerCapture?.(event.pointerId);
  drag.canvas.parentElement?.classList.remove("reference-pan-dragging");
  referenceViewPanDrag = null;
  event.preventDefault();
  return true;
}

function bonePointerRay(event, referenceCanvas, referenceCamera) {
  const rect = referenceCanvas.getBoundingClientRect();
  bonePointer.x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
  bonePointer.y = -((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
  boneRaycaster.setFromCamera(bonePointer, referenceCamera);
}

function beginBoneDrag(event, view, referenceCanvas, referenceCamera) {
  const target = activeViewportSelectionTarget();
  if (target !== "bone" && target !== "all") return;
  bonePointerRay(event, referenceCanvas, referenceCamera);
  const hit = boneRaycaster.intersectObjects(boneRigGroup.children.filter(child => child.userData.boneJoint), false)[0];
  if (!hit) return;
  selectedBoneId = hit.object.userData.boneId;
  const bone = selectedBone();
  if (!bone) return;
  recordBoneHistory("bone move");
  if (view === "front") boneDragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 0, 1), bone.position);
  else boneDragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(1, 0, 0), bone.position);
  boneRaycaster.ray.intersectPlane(boneDragPlane, boneDragHit);
  const startAngle = view === "front"
    ? Math.atan2(boneDragHit.y - bone.position.y, boneDragHit.x - bone.position.x)
    : Math.atan2(boneDragHit.y - bone.position.y, boneDragHit.z - bone.position.z);
  boneDrag = {
    view,
    canvas: referenceCanvas,
    camera: referenceCamera,
    pointerId: event.pointerId,
    startClientX: event.clientX,
    startClientY: event.clientY,
    startPosition: bone.position.clone(),
    startMirrorId: boneById(mirroredBoneId(bone.id))?.id || null,
    startMirrorPosition: boneById(mirroredBoneId(bone.id))?.position.clone() || null,
    lockedAxis: null,
    startAngle,
    startRotation: bone.rotation.clone()
  };
  referenceCanvas.setPointerCapture?.(event.pointerId);
  rebuildBoneVisuals();
  syncBonePanel();
  event.preventDefault();
}

function moveBoneDrag(event) {
  if (!boneDrag || event.pointerId !== boneDrag.pointerId) return;
  const bone = selectedBone();
  if (!bone) return;
  bonePointerRay(event, boneDrag.canvas, boneDrag.camera);
  if (!boneRaycaster.ray.intersectPlane(boneDragPlane, boneDragHit)) return;
  if (boneToolMode !== "move" || !boneMoveAxis) return;
  const start = boneDrag.startPosition;
  if (boneMoveAxis === "free") {
    if (boneDrag.view === "front") bone.position.set(boneDragHit.x, boneDragHit.y, start.z);
    else bone.position.set(start.x, boneDragHit.y, boneDragHit.z);
  } else if (boneMoveAxis === "x" && boneDrag.view === "front") {
    bone.position.set(boneDragHit.x, start.y, start.z);
  } else if (boneMoveAxis === "y") {
    bone.position.set(start.x, boneDragHit.y, start.z);
  } else if (boneMoveAxis === "z" && boneDrag.view === "side") {
    bone.position.set(start.x, start.y, boneDragHit.z);
  } else {
    return;
  }
  applyCurrentRigPose();
  mirrorBoneEdit(bone, { position: true, rotation: false, tail: true });
  if (mirrorBoneEdits) applyCurrentRigPose();
  rebuildBoneVisuals();
  syncBonePanel();
  event.preventDefault();
}

function endBoneDrag(event) {
  if (!boneDrag || event.pointerId !== boneDrag.pointerId) return;
  if (tPoseFittingMode) {
    commitTPoseBoneFitting();
  } else {
    commitLooseBonePosition(selectedBoneId, boneDrag.startPosition);
    if (boneDrag.startMirrorId && boneDrag.startMirrorPosition) commitLooseBonePosition(boneDrag.startMirrorId, boneDrag.startMirrorPosition);
  }
  boneDrag.canvas.releasePointerCapture?.(event.pointerId);
  boneDrag = null;
}

syncTPoseFittingUi();
syncRigSelectionTargetUi();
syncModelSelectionTargetUi();
