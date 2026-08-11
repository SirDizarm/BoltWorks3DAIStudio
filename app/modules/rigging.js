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
const animationState = { fps: 24, end: 48, frame: 0, playing: false, lastTime: 0, keys: {}, bindingRest: null };
let activeSkinRuntime = null;
const boneRaycaster = new THREE.Raycaster();
boneRaycaster.layers.enable(1);
boneRaycaster.layers.enable(2);
const bonePointer = new THREE.Vector2();
const boneDragPlane = new THREE.Plane();
const boneDragHit = new THREE.Vector3();

function boneById(id) {
  return rigBones.find(bone => bone.id === id) || null;
}

function selectedBone() {
  return boneById(selectedBoneId);
}

function freshBoneId() {
  return `bone-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function serializeBoneRig() {
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
      blockbenchUuid: bone.blockbenchUuid || null,
      blockbenchSourcePosition: bone.blockbenchSourcePosition?.toArray().map(round) || null,
      blockbenchLocalRotation: bone.blockbenchLocalRotation?.toArray().map(round) || null
    })),
    animation: { fps: animationState.fps, end: animationState.end, frame: animationState.frame, keys: animationState.keys }
  };
}

function restoreBoneRig(data = {}) {
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
    blockbenchLocalRotation: Array.isArray(bone.blockbenchLocalRotation) ? new THREE.Vector3().fromArray(bone.blockbenchLocalRotation) : null
  }));
  for (const bone of rigBones) {
    const child = rigBones.find(candidate => candidate.parentId === bone.id);
    if (!Array.isArray(data.bones?.find(candidate => candidate.id === bone.id)?.tail) && child) bone.tail.copy(child.position);
    if (bone.tail.distanceTo(bone.position) < .001) bone.tail.copy(bone.position).add(new THREE.Vector3(0, .12, 0));
    bone.tailOffset = bone.tail.clone().sub(bone.position);
    bone.bindPosition = bone.position.clone();
    bone.bindRotation = bone.blockbenchLocalRotation?.clone() || bone.rotation.clone();
    if (bone.blockbenchLocalRotation) bone.rotation.copy(bone.bindRotation);
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
  animationState.fps = Math.max(1, Math.min(120, Number(data.animation?.fps) || 24));
  animationState.end = Math.max(1, Math.min(9999, Number(data.animation?.end) || 48));
  animationState.frame = Math.max(0, Math.min(animationState.end, Number(data.animation?.frame) || 0));
  animationState.keys = data.animation?.keys && typeof data.animation.keys === "object" ? data.animation.keys : {};
  animationState.bindingRest = null;
  if (els.showBonesInput) els.showBonesInput.checked = data.showGuides ?? true;
  setupSkinnedRig();
  if (!activeSkinRuntime) prepareAnimationBindingRest();
  animationSetFrame(animationState.frame, { render: false });
  rebuildBoneVisuals();
  syncBonePanel();
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
    for (const bone of rigBones.filter(candidate => !candidate.parentId)) {
      bone.position.y += jumpLift;
      const pose = poses.get(bone.id);
      if (pose) pose.position.y += jumpLift;
    }
  }
  if (activeSkinRuntime) applySkinnedPose(poses);
  else {
    resolveAnimatedBoneHierarchy();
    rigBones.forEach(bone => bone.tail.copy(bone.position).add(bone.tailOffset.clone().applyEuler(new THREE.Euler(bone.rotation.x, bone.rotation.y, bone.rotation.z, "XYZ"))));
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
}

function applySkinnedPose(poses) {
  const { avatar, bones, threeBones, skeleton } = activeSkinRuntime;
  for (const bone of bones) {
    const threeBone = threeBones.get(bone.id);
    const pose = poses.get(bone.id) || { position: bone.bindPosition, rotation: bone.bindRotation };
    const parent = boneById(bone.parentId);
    const parentPose = parent ? poses.get(parent.id) : null;
    if (parent && threeBones.has(parent.id)) threeBone.position.copy(pose.position).sub(parentPose?.position || parent.bindPosition);
    else threeBone.position.copy(pose.position);
    threeBone.rotation.set(pose.rotation.x, pose.rotation.y, pose.rotation.z, "XYZ");
  }
  avatar.updateMatrixWorld(true);
  skeleton.update();
  for (const bone of bones) {
    const threeBone = threeBones.get(bone.id);
    bone.displayPosition = threeBone.getWorldPosition(new THREE.Vector3());
    bone.displayTail = threeBone.localToWorld(bone.bindTail.clone().sub(bone.bindPosition));
  }
}

function applyCurrentRigPose() {
  if (!activeSkinRuntime) return;
  applySkinnedPose(new Map(rigBones.map(bone => [bone.id, {
    position: bone.position.clone(),
    rotation: bone.rotation.clone()
  }])));
}
function resolveAnimatedBoneHierarchy() {
  const visiting = new Set();
  const resolved = new Set();
  const resolve = bone => {
    if (resolved.has(bone.id)) return;
    if (visiting.has(bone.id)) { bone.parentId = null; return; }
    visiting.add(bone.id);
    const parent = boneById(bone.parentId);
    if (parent) {
      resolve(parent);
      if (bone.blockbenchLocalRotation && parent.blockbenchLocalRotation) {
        const parentWorld = new THREE.Quaternion().setFromEuler(new THREE.Euler(parent.rotation.x, parent.rotation.y, parent.rotation.z, "XYZ"));
        bone.position.copy(parent.position).add(bone.restLocalPosition.clone().applyQuaternion(parentWorld));
        const local = new THREE.Quaternion().setFromEuler(new THREE.Euler(bone.rotation.x, bone.rotation.y, bone.rotation.z, "ZYX"));
        const world = parentWorld.multiply(local);
        const worldEuler = new THREE.Euler().setFromQuaternion(world, "XYZ");
        bone.rotation.set(worldEuler.x, worldEuler.y, worldEuler.z);
      } else {
        bone.position.copy(parent.position).add(bone.restLocalPosition.clone().applyEuler(new THREE.Euler(parent.rotation.x, parent.rotation.y, parent.rotation.z, "XYZ")));
        bone.rotation.add(parent.rotation);
      }
    }
    visiting.delete(bone.id);
    resolved.add(bone.id);
  };
  rigBones.forEach(resolve);
}
function collectAnimationBindings() {
  const bindings = rigBones.filter(bone => bone.avatarObjectId && typeof findObject === "function").map(bone => ({ bone, object: findObject(bone.avatarObjectId) })).filter(item => item.object);
  for (const object of objects) {
    const boneId = object.userData?.minecraft?.boneId || object.userData?.minecraftBoneId;
    const bone = boneById(boneId);
    if (bone) bindings.push({ bone, object });
  }
  return bindings;
}

function captureAnimationBindingRest() {
  const bindings = collectAnimationBindings();
  animationState.bindingRest = new Map();
  if (!bindings.length) return;
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
      boneQuaternion: new THREE.Quaternion().setFromEuler(new THREE.Euler(bone.rotation.x, bone.rotation.y, bone.rotation.z, "XYZ")),
      objectPosition: object.position.clone(), objectRotation: object.rotation.clone(), objectQuaternion: object.quaternion.clone()
    });
  }
}

function prepareAnimationBindingRest() {
  for (const bone of rigBones) {
    bone.position.copy(bone.bindPosition);
    bone.rotation.copy(bone.bindRotation);
  }
  resolveAnimatedBoneHierarchy();
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
    const currentBoneQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(bone.rotation.x, bone.rotation.y, bone.rotation.z, "XYZ"));
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
  const sourceBones = importedBoneArray(data);
  if (!sourceBones?.length) throw new Error("Bone structure JSON does not contain a non-empty bones array.");
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
  selectedBoneId = rigBones[0].id;
  rebuildBoneVisuals();
  syncBonePanel();
  log(`Imported ${rigBones.length} bones from ${fileName}.`, {
    coordinateSpace,
    roots: rigBones.filter(bone => !bone.parentId).length
  });
}

function addRigBone(asChild) {
  const parent = asChild ? selectedBone() : null;
  const position = parent
    ? parent.position.clone().add(new THREE.Vector3(0, 1, 0))
    : new THREE.Vector3(0, rigBones.length ? rigBones.length * .25 : 1, 0);
  const bone = {
    id: freshBoneId(),
    name: parent ? `${parent.name} Child` : `Bone ${rigBones.length + 1}`,
    parentId: parent?.id || null,
    position,
    rotation: new THREE.Vector3()
  };
  rigBones.push(bone);
  selectedBoneId = bone.id;
  rebuildBoneVisuals();
  syncBonePanel();
  log(`Added ${bone.name}.`);
}

function deleteSelectedBone() {
  const bone = selectedBone();
  if (!bone) return;
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
    const guidePosition = bone.displayPosition || bone.position;
    const guideTail = bone.displayTail || bone.tail || bone.position.clone().add(new THREE.Vector3(0, .12, 0));
    const selectedGuide = bone.id === selectedBoneId;
    const joint = new THREE.Mesh(
      new THREE.SphereGeometry(selectedGuide ? .055 : .035, 14, 10),
      new THREE.MeshBasicMaterial({ color: selectedGuide ? 0xffc547 : 0x40c7a5, depthTest: false })
    );
    joint.position.copy(guidePosition);
    joint.renderOrder = 10000;
    joint.userData.boneId = bone.id;
    joint.userData.boneJoint = true;
    joint.layers.enable(0);
    joint.layers.enable(1);
    joint.layers.enable(2);
    boneRigGroup.add(joint);
    const geometry = new THREE.BufferGeometry().setFromPoints([guidePosition, guideTail]);
    {
      const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0xe1b14b, depthTest: false }));
      line.renderOrder = 9999;
      line.userData.boneId = bone.id;
      line.layers.enable(0);
      line.layers.enable(1);
      line.layers.enable(2);
      boneRigGroup.add(line);
    }
  }
  const bone = selectedBone();
  if (bone && visible) addSelectedBoneGizmos(bone);
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
  if (boneToolMode !== "rotate") return;
  const segments = 64;
  const radius = size * .72;
  const frontPoints = [];
  const sidePoints = [];
  for (let index = 0; index <= segments; index += 1) {
    const angle = index / segments * Math.PI * 2;
    frontPoints.push(new THREE.Vector3(
      bone.position.x + Math.cos(angle) * radius,
      bone.position.y + Math.sin(angle) * radius,
      bone.position.z
    ));
    sidePoints.push(new THREE.Vector3(
      bone.position.x,
      bone.position.y + Math.sin(angle) * radius,
      bone.position.z + Math.cos(angle) * radius
    ));
  }
  const frontRing = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(frontPoints),
    new THREE.LineBasicMaterial({ color: 0x5f8fe8, depthTest: false })
  );
  const sideRing = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(sidePoints),
    new THREE.LineBasicMaterial({ color: 0xe55555, depthTest: false })
  );
  frontRing.layers.enable(0);
  frontRing.layers.enable(1);
  sideRing.layers.enable(0);
  sideRing.layers.enable(2);
  frontRing.renderOrder = 10001;
  sideRing.renderOrder = 10001;
  frontRing.userData.boneGizmo = true;
  sideRing.userData.boneGizmo = true;
  boneRigGroup.add(frontRing, sideRing);
}

function setBoneMoveAxis(axis) {
  boneMoveAxis = boneMoveAxis === axis ? null : axis;
  boneToolMode = boneMoveAxis ? "move" : null;
  els.boneAxisFreeBtn?.classList.toggle("active", boneMoveAxis === "free");
  els.boneAxisXBtn?.classList.toggle("active", boneMoveAxis === "x");
  els.boneAxisYBtn?.classList.toggle("active", boneMoveAxis === "y");
  els.boneAxisZBtn?.classList.toggle("active", boneMoveAxis === "z");
  rebuildBoneVisuals();
}

function syncBonePanel() {
  if (!els.boneList) return;
  els.boneList.innerHTML = "";
  for (const bone of rigBones) {
    const option = document.createElement("option");
    option.value = bone.id;
    option.textContent = bone.parentId ? `  ${bone.name}` : bone.name;
    option.selected = bone.id === selectedBoneId;
    els.boneList.append(option);
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
  const box = boneRigBounds();
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const aspect = rect.width / Math.max(1, rect.height);
  const vertical = Math.max(4, size.y * 1.35);
  const horizontal = Math.max(4, (view === "front" ? size.x : size.z) * 1.35);
  const halfHeight = Math.max(vertical * .5, horizontal / Math.max(.1, aspect) * .5);
  const halfWidth = halfHeight * aspect;
  referenceCamera.left = -halfWidth;
  referenceCamera.right = halfWidth;
  referenceCamera.top = halfHeight;
  referenceCamera.bottom = -halfHeight;
  if (view === "front") {
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
  const bone = selectedBone();
  if (!bone) return;
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
