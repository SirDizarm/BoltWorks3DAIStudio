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
      position: bone.position.toArray().map(round),
      rotation: bone.rotation.toArray().map(round)
    }))
  };
}

function restoreBoneRig(data = {}) {
  rigBones = (data.bones || []).map((bone, index) => ({
    id: bone.id || freshBoneId(),
    name: bone.name || `Bone ${index + 1}`,
    parentId: bone.parentId || null,
    role: bone.role === "camera" ? "camera" : null,
    position: new THREE.Vector3().fromArray(Array.isArray(bone.position) ? bone.position : [0, index, 0]),
    rotation: new THREE.Vector3().fromArray(Array.isArray(bone.rotation) ? bone.rotation : [0, 0, 0])
  }));
  selectedBoneId = boneById(data.selectedBoneId)?.id || rigBones[0]?.id || null;
  if (els.showBonesInput) els.showBonesInput.checked = data.showGuides ?? true;
  rebuildBoneVisuals();
  syncBonePanel();
}

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
  for (const bone of rigBones) {
    const selectedGuide = bone.id === selectedBoneId;
    const joint = new THREE.Mesh(
      new THREE.SphereGeometry(selectedGuide ? .12 : .085, 14, 10),
      new THREE.MeshBasicMaterial({ color: selectedGuide ? 0xffc547 : 0x40c7a5, depthTest: false })
    );
    joint.position.copy(bone.position);
    joint.renderOrder = 10000;
    joint.userData.boneId = bone.id;
    joint.userData.boneJoint = true;
    joint.layers.disable(0);
    joint.layers.enable(1);
    joint.layers.enable(2);
    boneRigGroup.add(joint);
    const parent = boneById(bone.parentId);
    if (parent) {
      const geometry = new THREE.BufferGeometry().setFromPoints([parent.position, bone.position]);
      const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0xe1b14b, depthTest: false }));
      line.renderOrder = 9999;
      line.userData.boneId = bone.id;
      line.layers.disable(0);
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
  object.layers.set(layer);
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
  frontRing.layers.set(1);
  sideRing.layers.set(2);
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
  rebuildBoneVisuals();
  syncBonePanel();
  event.preventDefault();
}

function endBoneDrag(event) {
  if (!boneDrag || event.pointerId !== boneDrag.pointerId) return;
  boneDrag.canvas.releasePointerCapture?.(event.pointerId);
  boneDrag = null;
}
