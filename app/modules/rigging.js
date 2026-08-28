const boneRigGroup = new THREE.Group();
boneRigGroup.name = "Bone Placement Guides";
boneRigGroup.userData.editorHelper = true;
scene.add(boneRigGroup);

const boneGridAxisGroup = new THREE.Group();
boneGridAxisGroup.name = "Grid Axis Directions";
boneGridAxisGroup.userData.editorHelper = true;
scene.add(boneGridAxisGroup);

function makeGridAxisLabel(text, color) {
  const labelCanvas = document.createElement("canvas");
  labelCanvas.width = 96;
  labelCanvas.height = 96;
  const context = labelCanvas.getContext("2d");
  context.clearRect(0, 0, 96, 96);
  context.fillStyle = "rgba(8, 12, 14, .82)";
  context.beginPath();
  context.arc(48, 48, 34, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = color;
  context.lineWidth = 5;
  context.stroke();
  context.fillStyle = color;
  context.font = "700 46px sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, 48, 51);
  const texture = new THREE.CanvasTexture(labelCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.scale.set(.55, .55, .55);
  sprite.renderOrder = 9000;
  return sprite;
}

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
// Bone-local gizmo mode: "rotate" (default) or "translate". Independent of the
// mesh toolbar so rotating a bone doesn't require enabling the mesh Move tool.
let boneGizmoToolMode = "rotate";
// Whether the bone gizmo is shown at all; the Move/Rotate buttons toggle this
// off when you click the already-active mode (like the Free/X/Y/Z lock).
let boneGizmoEnabled = true;
// Joystick aim-drag state for precise bone rotation.
let boneAimDrag = null;
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

// Joystick handle: a lever sticking out of the parent ball ending in a ball you
// grab and drag to aim the bone precisely (1:1, no wild spinning).
const boneJoystickGroup = new THREE.Group();
boneJoystickGroup.name = "Bone Rotation Joystick";
boneJoystickGroup.userData.editorHelper = true;
boneJoystickGroup.visible = false;
scene.add(boneJoystickGroup);

const boneJoystickShaft = new THREE.Mesh(
  new THREE.CylinderGeometry(.03, .03, 1, 8),
  new THREE.MeshBasicMaterial({ color: 0xffd27a, depthTest: false, transparent: true, opacity: .9 })
);
boneJoystickShaft.renderOrder = 10004;
boneJoystickGroup.add(boneJoystickShaft);

const boneJoystickHandle = new THREE.Mesh(
  new THREE.SphereGeometry(.11, 16, 12),
  new THREE.MeshBasicMaterial({ color: 0xffd27a, depthTest: false })
);
boneJoystickHandle.renderOrder = 10005;
boneJoystickHandle.userData.boneJoystick = true;
boneJoystickGroup.add(boneJoystickHandle);

// Larger invisible grab sphere so the handle is easy to click.
const boneJoystickHit = new THREE.Mesh(
  new THREE.SphereGeometry(.2, 8, 6),
  new THREE.MeshBasicMaterial({ visible: false })
);
boneJoystickHit.userData.boneJoystick = true;
boneJoystickGroup.add(boneJoystickHit);

function boneJoystickLength() {
  return Math.max(.6, boneRigBounds().getSize(new THREE.Vector3()).length() * .06);
}

function boneAimDir(bone) {
  // Current aim = direction the bone points (toward its child / tail).
  const directChild = rigBones.find(candidate => candidate.parentId === bone.id);
  const tail = directChild ? (directChild.displayPosition || directChild.position) : (bone.displayTail || bone.tail);
  const base = bone.displayPosition || bone.position;
  const dir = tail ? tail.clone().sub(base) : new THREE.Vector3(0, 1, 0);
  return dir.lengthSq() > 1e-6 ? dir.normalize() : new THREE.Vector3(0, 1, 0);
}

function syncBoneJoystick() {
  const bone = selectedBone();
  const show = !!bone && boneRigGroup.visible && boneGizmoEnabled && boneGizmoToolMode === "rotate";
  boneJoystickGroup.visible = show;
  if (!show) return;
  const base = bone.displayPosition || bone.position;
  // Stick the handle OUT THE BACK of the parent ball (opposite the cone/bone
  // direction) so it sits in open space and is easy to grab, not buried in the
  // body being moved.
  const dir = boneAimDir(bone).negate();
  const len = boneJoystickLength();
  boneJoystickGroup.position.copy(base);
  // Shaft from base to handle.
  boneJoystickShaft.scale.y = len;
  boneJoystickShaft.position.copy(dir.clone().multiplyScalar(len / 2));
  boneJoystickShaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  boneJoystickHandle.position.copy(dir.clone().multiplyScalar(len));
  boneJoystickHit.position.copy(boneJoystickHandle.position);
}

function pickBoneJoystick(event) {
  if (!boneJoystickGroup.visible) return false;
  const rect = renderer.domElement.getBoundingClientRect();
  bonePointer.x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
  bonePointer.y = -((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
  mainBoneRaycaster.setFromCamera(bonePointer, camera);
  return mainBoneRaycaster.intersectObjects([boneJoystickHandle, boneJoystickHit, boneJoystickShaft], false).length > 0;
}

function recordBoneHistory(label) {
  if (typeof recordHistory === "function" && !(typeof isRestoring !== "undefined" && isRestoring)) recordHistory(label);
}

function beginBoneAimDrag(event) {
  const bone = selectedBone();
  if (!bone) return false;
  recordBoneHistory("bone rotate");
  const base = (bone.displayPosition || bone.position).clone();
  boneAimDrag = {
    pointerId: event.pointerId,
    boneId: bone.id,
    base,
    startQuat: new THREE.Quaternion().setFromEuler(new THREE.Euler(bone.rotation.x, bone.rotation.y, bone.rotation.z, "XYZ")),
    // The handle sits on the opposite side from the bone, so rotate relative to
    // the handle's own start direction (which the cursor grabs).
    startDir: boneAimDir(bone).negate()
  };
  orbit.enabled = false;
  renderer.domElement.setPointerCapture?.(event.pointerId);
  event.preventDefault();
  return true;
}

function moveBoneAimDrag(event) {
  if (!boneAimDrag || event.pointerId !== boneAimDrag.pointerId) return;
  const bone = boneById(boneAimDrag.boneId);
  if (!bone) return;
  const rect = renderer.domElement.getBoundingClientRect();
  bonePointer.x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
  bonePointer.y = -((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
  mainBoneRaycaster.setFromCamera(bonePointer, camera);
  // Orbit around the base at a fixed radius, on the sphere the handle lives on:
  // project the cursor ray onto the plane through the base facing the camera,
  // then normalize to a direction. The handle follows the cursor exactly, and
  // the bone swings by the same rotation as the handle.
  const camDir = new THREE.Vector3();
  camera.getWorldDirection(camDir);
  boneDragPlane.setFromNormalAndCoplanarPoint(camDir, boneAimDrag.base);
  if (!mainBoneRaycaster.ray.intersectPlane(boneDragPlane, boneDragHit)) return;
  const handleDir = boneDragHit.clone().sub(boneAimDrag.base);
  if (handleDir.lengthSq() < 1e-6) return;
  handleDir.normalize();
  const delta = new THREE.Quaternion().setFromUnitVectors(boneAimDrag.startDir, handleDir);
  const worldQuat = delta.clone().multiply(boneAimDrag.startQuat);
  const e = new THREE.Euler().setFromQuaternion(worldQuat, "XYZ");
  bone.rotation.set(e.x, e.y, e.z);
  applyCurrentRigPose();
  rebuildBoneVisuals();
  syncBonePanel();
  event.preventDefault();
}

function endBoneAimDrag(event) {
  if (!boneAimDrag || event.pointerId !== boneAimDrag.pointerId) return;
  renderer.domElement.releasePointerCapture?.(event.pointerId);
  boneAimDrag = null;
  orbit.enabled = true;
}

const boneTransform = new TransformControls(camera, renderer.domElement);
boneTransform.visible = false;
boneTransform.setSize(.9);
boneTransform.addEventListener("dragging-changed", event => {
  orbit.enabled = !event.value;
  if (event.value && selectedBone()) recordBoneHistory("bone transform");
});
boneTransform.addEventListener("objectChange", () => {
  const bone = selectedBone();
  if (!bone || !boneTransform.dragging) return;
  if (boneTransform.mode === "translate") {
    bone.position.copy(boneTransformProxy.position);
  } else {
    bone.rotation.x = boneTransformProxy.rotation.x;
    bone.rotation.y = boneTransformProxy.rotation.y;
    bone.rotation.z = boneTransformProxy.rotation.z;
  }
  applyCurrentRigPose();
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
  els.boneModeMoveBtn?.classList.toggle("active", boneGizmoEnabled && boneGizmoToolMode === "translate");
  els.boneModeRotateBtn?.classList.toggle("active", boneGizmoEnabled && boneGizmoToolMode === "rotate");
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
  if (!boneTransform.dragging) {
    boneTransformProxy.position.copy(bone.displayPosition || bone.position);
    boneTransformProxy.rotation.set(bone.rotation.x, bone.rotation.y, bone.rotation.z);
    boneTransform.attach(boneTransformProxy);
    boneTransform.visible = true;
  }
  // Dashed axis guide rings removed — the joystick is the rotation control.
  boneRingGuideGroup.visible = false;
  syncBoneJoystick();
}

function pickBoneFromMainPointer(event) {
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
  setBoneGizmoEnabled(true, "rotate");
  if (typeof selectObject === "function") selectObject(null);
  rebuildBoneVisuals();
  syncBonePanel();
  log(`Selected bone: ${bone.name}. Drag the gizmo to ${boneGizmoMode() === "translate" ? "move" : "rotate"} it (Move/Rotate toolbar buttons switch mode).`);
}

function boneById(id) {
  return rigBones.find(bone => bone.id === id) || null;
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

function captureRigBindPose() {
  // Freeze exactly what the user placed. This must happen before hierarchy
  // resolution; otherwise a newly-created child can snap back to its original
  // default location as soon as Glue is pressed.
  rigBones.forEach(bone => {
    if (!bone.tail) bone.tail = bone.position.clone().add(new THREE.Vector3(0, .12, 0));
    bone.bindPosition = bone.position.clone();
    bone.bindRotation = bone.rotation.clone();
    bone.bindTail = bone.tail.clone();
  });
  rigBones.forEach(bone => initializeBoneRestState(bone));
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
  if (!id || !animationState.clips?.[id] || id === animationState.activeClipId) return;
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
  els.animationClipSelect.innerHTML = Object.entries(animationState.clips)
    .map(([id, clip]) => `<option value="${animationTimelineEscape(id)}">${animationTimelineEscape(clip.name || id)}</option>`)
    .join("");
  els.animationClipSelect.value = animationState.activeClipId;
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
    left_thigh: [{ frame: 0, rotation: [0, 0, .28] }, { frame: 12, rotation: [0, 0, -.28] }, { frame: 24, rotation: [0, 0, .28] }],
    right_thigh: [{ frame: 0, rotation: [0, 0, -.28] }, { frame: 12, rotation: [0, 0, .28] }, { frame: 24, rotation: [0, 0, -.28] }],
    left_upper_arm: [{ frame: 0, rotation: [0, 0, -.18] }, { frame: 12, rotation: [0, 0, .18] }, { frame: 24, rotation: [0, 0, -.18] }],
    right_upper_arm: [{ frame: 0, rotation: [0, 0, .18] }, { frame: 12, rotation: [0, 0, -.18] }, { frame: 24, rotation: [0, 0, .18] }]
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
    role: bone.role === "camera" ? "camera" : null,
    avatarObjectId: typeof bone.avatarObjectId === "string" ? bone.avatarObjectId : null,
    position: new THREE.Vector3().fromArray(Array.isArray(bone.position) ? bone.position : [0, index, 0]),
    rotation: new THREE.Vector3().fromArray(Array.isArray(bone.rotation) ? bone.rotation : [0, 0, 0]),
    tail: new THREE.Vector3().fromArray(Array.isArray(bone.tail) ? bone.tail : [0, index * .1 + .12, 0]),
    blockbenchUuid: bone.blockbenchUuid || null,
    blockbenchSourcePosition: Array.isArray(bone.blockbenchSourcePosition) ? new THREE.Vector3().fromArray(bone.blockbenchSourcePosition) : null,
    blockbenchLocalRotation: Array.isArray(bone.blockbenchLocalRotation) ? new THREE.Vector3().fromArray(bone.blockbenchLocalRotation) : null,
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
  if (!activeSkinRuntime) {
    animationState.bindingRest = restoreSerializedAnimationBindingRest(data.animation?.bindingRest)
      || rebuildMinecraftAnimationBindingRest();
  }
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
  syncBonePanel();
  updateGlueButton();
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
  const phase = Math.max(0, Math.min(1, frame / Math.max(1, animationState.end)));
  const modelBounds = new THREE.Box3();
  for (const object of objects) modelBounds.expandByObject(object);
  const modelHeight = modelBounds.isEmpty() ? 1 : modelBounds.getSize(new THREE.Vector3()).y;
  return Math.sin(Math.PI * phase) * Math.max(.35, modelHeight * .35);
}
function animationSetFrame(frame, { render = true } = {}) {
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
  if (activeSkinRuntime) applySkinnedPose(poses);
  else {
    poseRigHierarchy();
    applyAnimationBindings();
  }
  if (render) { rebuildBoneVisuals(); syncBonePanel(); }
  updateAnimationPanel();
}

function pointSegmentDistanceSquared(point, start, end) {
  const segment = end.clone().sub(start);
  const lengthSquared = segment.lengthSq();
  if (lengthSquared < 1e-8) return point.distanceToSquared(start);
  const t = THREE.MathUtils.clamp(point.clone().sub(start).dot(segment) / lengthSquared, 0, 1);
  return point.distanceToSquared(start.clone().addScaledVector(segment, t));
}

function skinCandidatesForVertex(point, bones) {
  const side = point.x < 0 ? "L" : "R";
  const byName = name => bones.findIndex(bone => bone.name === name);
  const named = names => names.map(byName).filter(index => index >= 0);
  if (point.y < .16) return named([`Foot ${side}`, `Shin ${side}`]);
  if (point.y < .74) return named([`Shin ${side}`, `Thigh ${side}`, "Root"]);
  if (point.y < .92) return named([`Thigh ${side}`, "Root", "Spine"]);
  const armThreshold = point.y > 1.12 ? .24 : .34;
  if (Math.abs(point.x) > armThreshold) return named([`Upper Arm ${side}`, `Forearm ${side}`, "Chest"]);
  if (point.y > 1.48) return named(["Head", "Chest"]);
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
  activeSkinRuntime = null;
  if (!rigBones.length || typeof findObject !== "function") return;
  const avatarCounts = new Map();
  rigBones.forEach(bone => {
    if (bone.avatarObjectId) avatarCounts.set(bone.avatarObjectId, (avatarCounts.get(bone.avatarObjectId) || 0) + 1);
  });
  const avatarId = [...avatarCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  let avatar = avatarId ? findObject(avatarId) : null;
  if (!avatar?.geometry?.getAttribute("position") || avatarCounts.get(avatarId) < 2) return;
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
    const parentPose = parent ? poses.get(parent.id) : null;
    const parentQuat = parentPose
      ? new THREE.Quaternion().setFromEuler(new THREE.Euler(parentPose.rotation.x, parentPose.rotation.y, parentPose.rotation.z, "XYZ"))
      : new THREE.Quaternion();
    const worldQuat = parentQuat.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(pose.rotation.x, pose.rotation.y, pose.rotation.z, "XYZ")));
    if (parent && threeBones.has(parent.id)) threeBone.position.copy(pose.position).sub(parentPose?.position || parent.bindPosition).applyQuaternion(parentQuat.clone().invert());
    else threeBone.position.copy(pose.position);
    threeBone.quaternion.copy(worldQuat);
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

function applyCurrentRigPose() {
  // While the rig is loose, bone edits define the placement/rest pose. Do not
  // resolve children from stale bind data: that was the source of new bones
  // jumping away while the user was positioning a rig before gluing it.
  if (!bonesGlued && !activeSkinRuntime) {
    rigBones.forEach(bone => initializeBoneRestState(bone));
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
  const bindings = rigBones.filter(bone => bone.avatarObjectId && typeof findObject === "function").map(bone => ({ bone, object: findObject(bone.avatarObjectId) })).filter(item => item.object);
  for (const object of objects) {
    const boneId = object.userData?.rigBoneId || object.userData?.minecraft?.boneId || object.userData?.minecraftBoneId;
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
    // poseWorldQuaternion includes all ancestors' accumulated swing; bone.rotation
    // is only this bone's local value and would leave descendants unrotated.
    const currentBoneQuaternion = bone.poseWorldQuaternion
      ? bone.poseWorldQuaternion.clone()
      : new THREE.Quaternion().setFromEuler(new THREE.Euler(bone.rotation.x, bone.rotation.y, bone.rotation.z, "XYZ"));
    const restBoneQuaternion = rest.boneQuaternion || new THREE.Quaternion().setFromEuler(new THREE.Euler(rest.boneRotation.x, rest.boneRotation.y, rest.boneRotation.z, "XYZ"));
    const rotationDelta = currentBoneQuaternion.multiply(restBoneQuaternion.clone().invert());
    object.position.copy(rest.objectPosition).sub(rest.bonePosition).applyQuaternion(rotationDelta).add(bone.position);
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
    if (selectedBoneId) setBoneGizmoEnabled(true, "rotate");
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
function updateAnimation(delta) { if (!animationState.playing || !animationHasKeys()) { animationState.playing = false; return; } animationState.lastTime += delta; if (animationState.lastTime >= 1 / animationState.fps) { animationState.lastTime = 0; animationSetFrame(animationState.frame + 1); if (animationState.frame >= animationState.end) animationState.frame = 0; } }
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

function rebuildBoneVisuals() {
  while (boneRigGroup.children.length) {
    const child = boneRigGroup.children.pop();
    child.geometry?.dispose?.();
    child.material?.dispose?.();
  }
  const visible = els.showBonesInput?.checked ?? true;
  boneRigGroup.visible = visible;
  boneRigGroup.layers.enable(0);
  boneRigGroup.layers.enable(1);
  boneRigGroup.layers.enable(2);
  for (const bone of rigBones) {
    if (bone.hidden) continue;
    const guidePosition = bone.displayPosition || bone.position;
    const directChild = rigBones.find(candidate => candidate.parentId === bone.id);
    const childTail = directChild ? (directChild.displayPosition || directChild.position) : null;
    const guideTail = childTail || bone.displayTail || bone.tail || bone.position.clone().add(new THREE.Vector3(0, .12, 0));
    const selectedGuide = bone.id === selectedBoneId;
    const jointColor = selectedGuide ? 0xffc547 : 0xd8d8d8;
    const boneVector = guideTail.clone().sub(guidePosition);
    const boneLength = boneVector.length();
    const childBone = rigBones.find(candidate => boneById(candidate.parentId)?.id === bone.id);
    const jointRadius = selectedGuide ? .11 : .085;
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
      const coneRadius = Math.min(Math.max(boneLength * .18, .06), .22);
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(coneRadius, boneLength, 12, 1, false),
        new THREE.MeshStandardMaterial({ color: selectedGuide ? 0xffc547 : 0x9aa7ad, depthTest: true, roughness: .8, metalness: 0 })
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
  syncBoneJoystick();
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
  // Dotted rotation rings removed — the joystick handle is the rotate control.
}

function setBoneMoveAxis(axis) {
  boneMoveAxis = boneMoveAxis === axis ? null : axis;
  boneToolMode = boneMoveAxis ? "move" : null;
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
      if (selectedBoneId) setBoneGizmoEnabled(true, "rotate");
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
  els.selectedBoneLabel.textContent = `Selected: ${bone?.name || "None"}`;
  els.boneNameInput.value = bone?.name || "";
  els.boneParentSelect.value = bone?.parentId || "";
  els.bonePosX.value = bone ? String(round(bone.position.x)) : "";
  els.bonePosY.value = bone ? String(round(bone.position.y)) : "";
  els.bonePosZ.value = bone ? String(round(bone.position.z)) : "";
  els.boneRotX.value = bone ? String(round(THREE.MathUtils.radToDeg(bone.rotation.x))) : "";
  els.boneRotY.value = bone ? String(round(THREE.MathUtils.radToDeg(bone.rotation.y))) : "";
  els.boneRotZ.value = bone ? String(round(THREE.MathUtils.radToDeg(bone.rotation.z))) : "";
}

function applyBonePanelValues() {
  const bone = selectedBone();
  if (!bone) return;
  recordBoneHistory("bone edit");
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
  applyCurrentRigPose();
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
  objects.forEach(object => { if (object.userData) delete object.userData.rigBoneId; });
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
    const boneId = object.userData?.rigBoneId || object.userData?.minecraft?.boneId || object.userData?.minecraftBoneId;
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

function fitBoneCamera(referenceCamera, canvasElement, view) {
  const rect = canvasElement.parentElement.getBoundingClientRect();
  // Center on the root (first) bone — the model's center. Freeze the frame size
  // to the model's RESTING bounds so animation (tail/limb movement) does not
  // make the Front/Side view pan and zoom all over the place.
  const root = rigBones.find(bone => !boneById(bone.parentId)) || rigBones[0] || null;
  // Center horizontally on the root bone (so the body stays centered as it
  // moves), but vertically on the resting bounds so the whole model — head to
  // feet — stays fully visible in the frame.
  const rootPos = root ? (root.displayPosition || root.position) : new THREE.Vector3(0, 1, 0);
  if (!fitBoneCamera.restExtent) {
    const restBox = boneRigBounds();
    const size = restBox.getSize(new THREE.Vector3());
    fitBoneCamera.restExtent = Math.max(4, size.y * 1.4, size.x * 1.4, size.z * 1.4, size.length() * .55);
    fitBoneCamera.restCenterY = restBox.getCenter(new THREE.Vector3()).y;
  }
  const center = new THREE.Vector3(rootPos.x, fitBoneCamera.restCenterY ?? rootPos.y, rootPos.z);
  const extent = fitBoneCamera.restExtent;
  const aspect = rect.width / Math.max(1, rect.height);
  const halfHeight = Math.max(extent * .5, extent / Math.max(.1, aspect) * .5);
  const halfWidth = halfHeight * aspect;
  referenceCamera.left = -halfWidth;
  referenceCamera.right = halfWidth;
  referenceCamera.top = halfHeight;
  referenceCamera.bottom = -halfHeight;
  if (view === "front") {
    // Match Blockbench's canonical Front view: look from +Z toward the origin.
    referenceCamera.position.set(center.x, center.y, center.z + 100);
    referenceCamera.up.set(0, 1, 0);
  } else {
    referenceCamera.position.set(center.x + 100, center.y, center.z);
    referenceCamera.up.set(0, 1, 0);
  }
  referenceCamera.lookAt(center);
  referenceCamera.updateProjectionMatrix();
}

function resizeReferenceRenderer(referenceRenderer, referenceCamera, referenceCanvas, view) {
  const rect = referenceCanvas.parentElement.getBoundingClientRect();
  referenceRenderer.setSize(rect.width, rect.height, false);
  fitBoneCamera(referenceCamera, referenceCanvas, view);
}

function bonePointerRay(event, referenceCanvas, referenceCamera) {
  const rect = referenceCanvas.getBoundingClientRect();
  bonePointer.x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
  bonePointer.y = -((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
  boneRaycaster.setFromCamera(bonePointer, referenceCamera);
}

function beginBoneDrag(event, view, referenceCanvas, referenceCamera) {
  bonePointerRay(event, referenceCanvas, referenceCamera);
  const hit = boneRaycaster.intersectObjects(boneRigGroup.children.filter(child => child.userData.boneJoint), false)[0];
  if (!hit) return;
  selectedBoneId = hit.object.userData.boneId;
  setBoneGizmoEnabled(true, "rotate");
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
  rebuildBoneVisuals();
  syncBonePanel();
  event.preventDefault();
}

function endBoneDrag(event) {
  if (!boneDrag || event.pointerId !== boneDrag.pointerId) return;
  boneDrag.canvas.releasePointerCapture?.(event.pointerId);
  boneDrag = null;
}
