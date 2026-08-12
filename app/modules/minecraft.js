const MINECRAFT_UNIT = 1 / 16;
let minecraftProject = { sourceName: "", format: "", textureWidth: 64, textureHeight: 64, textureName: "", textureDataUrl: null };
let minecraftAnimationClips = [];
let minecraftAnimationBoneIds = new Map();
let activeMinecraftAnimation = 0;
let minecraftAnimationSequence = [];
let minecraftAnimationSequencePreviewToken = 0;

function javaIdentifier(value, fallback = "CustomMob") {
  const cleaned = String(value || fallback).replace(/[^A-Za-z0-9_$]/g, " ").trim().split(/\s+/).filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1)).join("");
  return /^[A-Za-z_$]/.test(cleaned) ? cleaned : `Model${cleaned || fallback}`;
}

function javaMember(value, fallback = "part") {
  const id = String(value || fallback).replace(/[^A-Za-z0-9_$]/g, "_").replace(/^_+|_+$/g, "") || fallback;
  return /^[A-Za-z_$]/.test(id) ? id : `part_${id}`;
}

function minecraftVec(value, fallback = [0, 0, 0]) {
  const source = typeof value === "string"
    ? value.trim().split(/[\s,]+/).filter(Boolean)
    : Array.isArray(value)
      ? value
      : value && typeof value === "object"
        ? [value.x, value.y, value.z]
        : fallback;
  return [0, 1, 2].map(index => Number(source?.[index] ?? fallback[index]) || 0);
}

function minecraftChildren(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  return value == null ? [] : [value];
}

function minecraftEscapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function setWorkspace(name, { quiet = false } = {}) {
  const workspace = name === "minecraft" ? "minecraft" : "general";
  document.body.dataset.workspace = workspace;
  if (els.workspaceSelect) els.workspaceSelect.value = workspace;
  localStorage.setItem("boltworks.workspace", workspace);
  if (!quiet) log(workspace === "minecraft"
    ? "Minecraft workspace enabled. Only cuboid modeling, texture, hierarchy, rigging, animation, and Minecraft export tools are shown."
    : "General 3D workspace enabled.");
}

function renderPluginManager() {
  const plugins = allPluginManifests();
  if (els.pluginCountLabel) els.pluginCountLabel.textContent = String(plugins.length);
  if (!els.pluginList) return;
  els.pluginList.innerHTML = plugins.map(plugin => `<div class="plugin-row"><div><strong>${plugin.name}</strong><span>${plugin.id} · v${plugin.version}</span></div><span class="plugin-ready">${plugin.enabled === false ? "Off" : plugin.builtIn ? "Built in" : "Installed"}</span></div>`).join("");
}

function downloadPluginTemplate() {
  download("boltworks-plugin-template.bwsplugin", JSON.stringify(pluginTemplate(), null, 2), "application/json");
  log("Created an editable BoltWorks plugin manifest template.");
}

async function importPluginManifest(file) {
  const manifest = validPluginManifest(JSON.parse(await file.text()));
  const index = installedPluginManifests.findIndex(plugin => plugin.id === manifest.id);
  if (index >= 0) installedPluginManifests[index] = manifest;
  else installedPluginManifests.push(manifest);
  saveInstalledPlugins();
  renderPluginManager();
  log(`Installed plugin manifest ${manifest.name} v${manifest.version}.`, { id: manifest.id, contributes: manifest.contributes });
}

function blockbenchTextureData(project, element = null) {
  const textures = project.textures || [];
  const references = Object.values(element?.faces || {}).map(face => face?.texture).filter(reference => reference !== null && reference !== undefined && reference !== false);
  const reference = references[0];
  let texture = null;
  const numericReference = typeof reference === "string" ? reference.replace(/^#/, "") : reference;
  if (Number.isInteger(Number(numericReference)) && String(numericReference).trim() !== "") texture = textures[Number(numericReference)];
  if (!texture && typeof reference === "string") {
    const clean = reference.replace(/^#/, "");
    texture = textures.find(item => item?.uuid === clean || item?.id === clean || item?.name === clean);
  }
  if (!texture || typeof texture.source !== "string" || !texture.source.startsWith("data:image/")) {
    texture = textures.find(item => typeof item?.source === "string" && item.source.startsWith("data:image/"));
  }
  return texture?.source?.startsWith("data:image/") ? { name: texture.name || "blockbench-texture.png", dataUrl: texture.source } : null;
}

function blockbenchAutoFaceUvs(element) {
  const offset = Array.isArray(element.uv_offset) ? element.uv_offset : [0, 0];
  const from = minecraftVec(element.from), to = minecraftVec(element.to);
  const width = Math.abs(to[0] - from[0]), height = Math.abs(to[1] - from[1]), depth = Math.abs(to[2] - from[2]);
  const u = Number(offset[0]) || 0, v = Number(offset[1]) || 0;
  const faces = {
    west: [u, v + depth, u + depth, v + depth + height],
    north: [u + depth, v + depth, u + depth + width, v + depth + height],
    east: [u + depth + width, v + depth, u + depth + width + depth, v + depth + height],
    south: [u + depth + width + depth, v + depth, u + depth + width + depth + width, v + depth + height],
    up: [u + depth, v, u + depth + width, v + depth],
    down: [u + depth + width, v, u + depth + width + width, v + depth]
  };
  if (element.mirror_uv) Object.values(faces).forEach(rect => [rect[0], rect[2]] = [rect[2], rect[0]]);
  return faces;
}

function rotateBlockbenchUvPoint(s, t, rotation = 0) {
  let turns = ((Math.round((Number(rotation) || 0) / 90) % 4) + 4) % 4;
  while (turns-- > 0) [s, t] = [1 - t, s];
  return [s, t];
}

function blockbenchCubeGeometryData(element, textureWidth, textureHeight, boxUv = false) {
  const base = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
  const position = base.getAttribute("position"), uv = base.getAttribute("uv");
  const positions = [], uvs = [];
  const autoFaces = blockbenchAutoFaceUvs(element);
  const faces = element.faces || {};
  const orderedFaces = ["east", "west", "up", "down", "south", "north"];
  const width = Math.max(1, Number(textureWidth) || 16), height = Math.max(1, Number(textureHeight) || 16);
  orderedFaces.forEach((faceName, faceIndex) => {
    const face = faces[faceName];
    if (face && (face.texture === null || face.texture === false)) return;
    const rect = Array.isArray(face?.uv) && face.uv.length >= 4 ? face.uv.map(Number) : (boxUv ? autoFaces[faceName] : null);
    if (!rect) return;
    for (let vertex = faceIndex * 6; vertex < faceIndex * 6 + 6; vertex++) {
      positions.push(position.getX(vertex), position.getY(vertex), position.getZ(vertex));
      const [s, t] = rotateBlockbenchUvPoint(uv.getX(vertex), 1 - uv.getY(vertex), face?.rotation || 0);
      uvs.push((rect[0] + (rect[2] - rect[0]) * s) / width, (rect[1] + (rect[3] - rect[1]) * t) / height);
    }
  });
  base.dispose();
  return { positions, uvs };
}

function collectBlockbenchHierarchy(outliner, parentBoneId, groupMap, cubeParents, parentGroupId = null) {
  for (const node of minecraftChildren(outliner)) {
    if (typeof node === "string") { cubeParents.set(node, { boneId: parentBoneId, groupId: parentGroupId }); continue; }
    if (!node || typeof node !== "object") continue;
    if (!Array.isArray(node.children)) {
      if (node.uuid) cubeParents.set(node.uuid, { boneId: parentBoneId, groupId: parentGroupId });
      continue;
    }
    const boneId = `bb-bone-${node.uuid || freshBoneId()}`;
    const groupId = `bb-group-${node.uuid || createSceneGroupId()}`;
    const parent = boneById(parentBoneId);
    const position = new THREE.Vector3().fromArray(minecraftVec(node.origin).map(value => value * MINECRAFT_UNIT));
    const rotation = minecraftVec(node.rotation).map(THREE.MathUtils.degToRad);
    const bone = {
      id: boneId, name: node.name || "bone", parentId: parentBoneId || null, role: null, avatarObjectId: null,
      position, rotation: new THREE.Vector3().fromArray(rotation), tail: position.clone().add(new THREE.Vector3(0, .25, 0)),
      blockbenchUuid: node.uuid || null,
      blockbenchSourcePosition: position.clone(),
      blockbenchLocalRotation: new THREE.Vector3().fromArray(rotation)
    };
    bone.tailOffset = bone.tail.clone().sub(bone.position);
    bone.bindPosition = bone.position.clone(); bone.bindRotation = bone.rotation.clone();
    bone.restLocalPosition = parent ? bone.position.clone().sub(parent.position) : bone.position.clone();
    rigBones.push(bone);
    createSceneGroupRecord({ id: groupId, name: node.name || "bone", parentId: parentGroupId });
    groupMap.set(node.uuid, { bone, groupId });
    collectBlockbenchHierarchy(minecraftChildren(node.children), boneId, groupMap, cubeParents, groupId);
  }
}

function resolveBlockbenchBoneRestTransforms() {
  const resolved = new Set();
  const resolve = bone => {
    if (!bone || resolved.has(bone.id)) return;
    const parent = boneById(bone.parentId);
    if (parent) resolve(parent);
    const source = bone.blockbenchSourcePosition || bone.position;
    const localRotation = bone.blockbenchLocalRotation || bone.rotation;
    const localQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(localRotation.x, localRotation.y, localRotation.z, "ZYX"));
    if (parent) {
      const parentSource = parent.blockbenchSourcePosition || parent.position;
      const parentWorldQuaternion = parent.blockbenchWorldQuaternion || new THREE.Quaternion();
      bone.position.copy(source).sub(parentSource).applyQuaternion(parentWorldQuaternion).add(parent.position);
      bone.blockbenchWorldQuaternion = parentWorldQuaternion.clone().multiply(localQuaternion);
    } else {
      bone.position.copy(source);
      bone.blockbenchWorldQuaternion = localQuaternion.clone();
    }
    bone.bindPosition = bone.position.clone();
    bone.rotation.copy(localRotation);
    bone.bindRotation = localRotation.clone();
    resolved.add(bone.id);
  };
  rigBones.forEach(resolve);
  rigBones.forEach(bone => {
    const child = rigBones.find(candidate => candidate.parentId === bone.id);
    bone.tail.copy(child?.position || bone.position.clone().add(new THREE.Vector3(0, .25, 0)));
    bone.tailOffset = bone.tail.clone().sub(bone.position);
    const parent = boneById(bone.parentId);
    bone.restLocalPosition = parent
      ? bone.position.clone().sub(parent.position).applyQuaternion((parent.blockbenchWorldQuaternion || new THREE.Quaternion()).clone().invert())
      : bone.position.clone();
  });
}

function importBlockbenchAnimation(animation, boneIds = minecraftAnimationBoneIds) {
  animationState.keys = {};
  if (!animation) return 0;
  if (animation.bwsState?.keys && typeof animation.bwsState.keys === "object") {
    animationState.fps = Math.max(1, Math.min(120, Number(animation.bwsState.fps) || 20));
    animationState.end = Math.max(1, Math.min(9999, Number(animation.bwsState.end) || 1));
    animationState.frame = Math.max(0, Math.min(animationState.end, Number(animation.bwsState.frame) || 0));
    animationState.keys = JSON.parse(JSON.stringify(animation.bwsState.keys));
    return Object.values(animationState.keys).reduce((sum, keys) => sum + (Array.isArray(keys) ? keys.length : 0), 0);
  }
  animationState.fps = 20;
  const length = Math.max(Number(animation.length) || 0, 0.05);
  animationState.end = Math.max(1, Math.round(length * animationState.fps));
  for (const [uuid, animator] of Object.entries(animation.animators || {})) {
    const bone = boneById(boneIds.get(uuid));
    if (!bone) continue;
    const byFrame = new Map();
    for (const keyframe of animator.keyframes || []) {
      if (!keyframe || !["rotation", "position"].includes(keyframe.channel)) continue;
      const frame = Math.max(0, Math.round((Number(keyframe.time) || 0) * animationState.fps));
      const pose = byFrame.get(frame) || { frame, position: bone.bindPosition.toArray(), rotation: bone.bindRotation.toArray() };
      const point = keyframe.data_points?.[0] || {};
      const values = [point.x, point.y, point.z].map(value => Number(value) || 0);
      if (keyframe.channel === "rotation") pose.rotation = values.map((value, index) => bone.bindRotation.getComponent(index) + THREE.MathUtils.degToRad(value));
      else pose.position = values.map((value, index) => bone.bindPosition.getComponent(index) + value * MINECRAFT_UNIT);
      byFrame.set(frame, pose);
    }
    animationState.keys[bone.id] = [...byFrame.values()].sort((a, b) => a.frame - b.frame);
  }
  return Object.values(animationState.keys).reduce((sum, keys) => sum + keys.length, 0);
}

function refreshMinecraftAnimationSelect() {
  if (!els.minecraftAnimationSelect) return;
  els.minecraftAnimationSelect.disabled = !minecraftAnimationClips.length;
  els.minecraftAnimationSelect.innerHTML = minecraftAnimationClips.length
    ? minecraftAnimationClips.map((clip, index) => `<option value="${index}">${minecraftEscapeHtml(clip.name || `Animation ${index + 1}`)}</option>`).join("")
    : '<option value="">No animation clips loaded</option>';
  if (minecraftAnimationClips.length) els.minecraftAnimationSelect.value = String(activeMinecraftAnimation);
  if (typeof syncAnimatorClipSelect === "function") syncAnimatorClipSelect();
  renderMinecraftAnimationSequence();
}

function animationSequenceClipIndices() {
  return minecraftAnimationSequence.filter(index => Number.isInteger(index) && index >= 0 && index < minecraftAnimationClips.length);
}

function useConnectedAnimationSequence() {
  return !!els.animationUseSequenceInput?.checked && animationSequenceClipIndices().length > 0;
}

function renderMinecraftAnimationSequence() {
  if (els.animationSequenceClipSelect) {
    els.animationSequenceClipSelect.disabled = !minecraftAnimationClips.length;
    els.animationSequenceClipSelect.innerHTML = minecraftAnimationClips.length
      ? minecraftAnimationClips.map((clip, index) => `<option value="${index}">${minecraftEscapeHtml(clip.name || `Animation ${index + 1}`)}</option>`).join("")
      : '<option value="">No clips</option>';
  }
  if (!els.animationSequenceList) return;
  const sequence = animationSequenceClipIndices();
  els.animationSequenceList.innerHTML = sequence.length ? sequence.map((clipIndex, index) => {
    const label = minecraftEscapeHtml(minecraftAnimationClips[clipIndex]?.name || `Animation ${clipIndex + 1}`);
    return `${index ? '<span class="animation-sequence-arrow">→</span>' : ''}<span class="animation-sequence-item"><span>${label}</span><button type="button" data-sequence-move="-1" data-sequence-index="${index}" title="Move earlier">◀</button><button type="button" data-sequence-move="1" data-sequence-index="${index}" title="Move later">▶</button><button type="button" data-sequence-remove="${index}" title="Remove clip">×</button></span>`;
  }).join("") : '<span class="api-note">Add clips in any order, for example Idle → Walk → Run → Jump → Idle.</span>';
}

function cancelMinecraftAnimationSequencePreview() {
  minecraftAnimationSequencePreviewToken += 1;
  if (els.animationSequencePreviewBtn) els.animationSequencePreviewBtn.textContent = "Preview";
}

async function previewMinecraftAnimationSequence() {
  const sequence = animationSequenceClipIndices();
  if (!sequence.length) { log("Add at least one clip to the connected animation first."); return; }
  persistActiveMinecraftAnimationState();
  const token = ++minecraftAnimationSequencePreviewToken;
  if (els.animationSequencePreviewBtn) els.animationSequencePreviewBtn.textContent = "Stop preview";
  for (const clipIndex of sequence) {
    if (token !== minecraftAnimationSequencePreviewToken) break;
    activateMinecraftAnimation(clipIndex, { quiet: true });
    const frameDuration = 1000 / Math.max(1, animationState.fps);
    for (let frame = 0; frame <= animationState.end; frame += 1) {
      if (token !== minecraftAnimationSequencePreviewToken) break;
      animationSetFrame(frame);
      await new Promise(resolve => setTimeout(resolve, frameDuration));
    }
  }
  if (token === minecraftAnimationSequencePreviewToken) cancelMinecraftAnimationSequencePreview();
}

function persistActiveMinecraftAnimationState() {
  const clip = minecraftAnimationClips[activeMinecraftAnimation];
  if (!clip || !animationState.keys) return;
  clip.bwsState = {
    fps: animationState.fps,
    end: animationState.end,
    frame: animationState.frame,
    keys: JSON.parse(JSON.stringify(animationState.keys))
  };
}

function serializeMinecraftWorkspace() {
  persistActiveMinecraftAnimationState();
  return {
    project: JSON.parse(JSON.stringify(minecraftProject)),
    clips: JSON.parse(JSON.stringify(minecraftAnimationClips)),
    activeAnimation: activeMinecraftAnimation,
    animationSequence: animationSequenceClipIndices()
  };
}

function restoreMinecraftWorkspace(data = null) {
  if (!data || typeof data !== "object") {
    minecraftAnimationClips = [];
    minecraftAnimationBoneIds = new Map();
    activeMinecraftAnimation = 0;
    minecraftAnimationSequence = [];
    refreshMinecraftAnimationSelect();
    return;
  }
  minecraftProject = data.project && typeof data.project === "object"
    ? JSON.parse(JSON.stringify(data.project))
    : minecraftProject;
  minecraftAnimationClips = Array.isArray(data.clips) ? JSON.parse(JSON.stringify(data.clips)) : [];
  minecraftAnimationBoneIds = new Map(rigBones.filter(bone => bone.blockbenchUuid).map(bone => [bone.blockbenchUuid, bone.id]));
  activeMinecraftAnimation = Math.max(0, Math.min(minecraftAnimationClips.length - 1, Number(data.activeAnimation) || 0));
  minecraftAnimationSequence = Array.isArray(data.animationSequence)
    ? data.animationSequence.map(Number).filter(index => Number.isInteger(index) && index >= 0 && index < minecraftAnimationClips.length)
    : [];
  refreshMinecraftAnimationSelect();
  if (minecraftAnimationClips.length) activateMinecraftAnimation(activeMinecraftAnimation, { quiet: true, preserveCurrent: false });
}

function activateMinecraftAnimation(index, { quiet = false, preserveCurrent = true } = {}) {
  if (!minecraftAnimationClips.length) return 0;
  if (preserveCurrent) persistActiveMinecraftAnimationState();
  restoreAnimationBindPose();
  animationState.playing = false;
  activeMinecraftAnimation = Math.max(0, Math.min(minecraftAnimationClips.length - 1, Number(index) || 0));
  const clip = minecraftAnimationClips[activeMinecraftAnimation];
  const keys = importBlockbenchAnimation(clip);
  if (!animationState.bindingRest && !activeSkinRuntime) prepareAnimationBindingRest();
  animationSetFrame(0, { render: false });
  updateAnimationPanel();
  refreshMinecraftAnimationSelect();
  if (!quiet) log(`Loaded Minecraft animation clip ${clip.name || activeMinecraftAnimation + 1}: ${keys} keys.`);
  return keys;
}

function blockbenchBindTransform(point, element, boneId) {
  const transformed = new THREE.Vector3().fromArray(point);
  const quaternion = new THREE.Quaternion();
  const elementRotation = minecraftVec(element.rotation).map(THREE.MathUtils.degToRad);
  const elementOrigin = new THREE.Vector3().fromArray(minecraftVec(element.origin, point));
  const elementQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(...elementRotation, "XYZ"));
  transformed.sub(elementOrigin).applyQuaternion(elementQuaternion).add(elementOrigin);
  quaternion.premultiply(elementQuaternion);
  let bone = boneById(boneId);
  const seen = new Set();
  while (bone && !seen.has(bone.id)) {
    seen.add(bone.id);
    const origin = (bone.blockbenchSourcePosition || bone.bindPosition).clone().multiplyScalar(1 / MINECRAFT_UNIT);
    const localRotation = bone.blockbenchLocalRotation || bone.bindRotation;
    const boneQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(localRotation.x, localRotation.y, localRotation.z, "ZYX"));
    transformed.sub(origin).applyQuaternion(boneQuaternion).add(origin);
    quaternion.premultiply(boneQuaternion);
    bone = boneById(bone.parentId);
  }
  return { position: transformed.multiplyScalar(MINECRAFT_UNIT).toArray(), rotation: new THREE.Euler().setFromQuaternion(quaternion, "XYZ").toArray().slice(0, 3).map(THREE.MathUtils.radToDeg) };
}

async function importBlockbenchProject(file) {
  const project = JSON.parse((await file.text()).replace(/^\uFEFF/, ""));
  if (!Array.isArray(project.elements) || !Array.isArray(project.outliner)) throw new Error("This .bbmodel has no Blockbench elements/outliner data.");
  recordHistory("import Blockbench model");
  clearObjects({ record: false });
  sceneGroupRegistry.clear();
  rigBones = [];
  selectedBoneId = null;
  const groupMap = new Map();
  const cubeParents = new Map();
  collectBlockbenchHierarchy(project.outliner, null, groupMap, cubeParents);
  resolveBlockbenchBoneRestTransforms();
  const registeredTextures = new Map();
  for (const sourceTexture of project.textures || []) {
    if (typeof sourceTexture?.source !== "string" || !sourceTexture.source.startsWith("data:image/")) continue;
    registeredTextures.set(sourceTexture.source, registerTextureAsset(sourceTexture.name || "blockbench-texture.png", sourceTexture.source));
  }
  let cubes = 0, skipped = 0;
  for (const element of project.elements) {
    if (element.type && element.type !== "cube") { skipped++; continue; }
    if (!Array.isArray(element.from) || !Array.isArray(element.to)) { skipped++; continue; }
    const from = minecraftVec(element.from), to = minecraftVec(element.to);
    const inflate = Number(element.inflate) || 0;
    const flatAxes = to.map((value, index) => Math.abs(value - from[index]) < 1e-7);
    const sizePixels = to.map((value, index) => flatAxes[index]
      ? .02
      : Math.max(.001, value - from[index] + inflate * 2));
    const centerPixels = to.map((value, index) => (value + from[index]) / 2);
    const parentInfo = cubeParents.get(element.uuid) || {};
    const bindTransform = blockbenchBindTransform(centerPixels, element, parentInfo.boneId);
    const texture = blockbenchTextureData(project, element);
    const textureName = texture ? registeredTextures.get(texture.dataUrl) || registerTextureAsset(texture.name, texture.dataUrl) : null;
    const textureWidth = Number(project.resolution?.width) || 16, textureHeight = Number(project.resolution?.height) || 16;
    const geometry = blockbenchCubeGeometryData(element, textureWidth, textureHeight, !!(project.meta?.box_uv ?? project.box_uv));
    const mesh = addObject({
      id: `bb-cube-${element.uuid || cubes}`, shape: "box", geometry, name: element.name || `cube_${cubes + 1}`,
      position: bindTransform.position, scale: sizePixels.map(value => value * MINECRAFT_UNIT),
      rotation: bindTransform.rotation, pivot: minecraftVec(element.origin, centerPixels).map(value => value * MINECRAFT_UNIT),
      color: "#ffffff", roughness: 1,
      groupId: parentInfo.groupId || null, groupName: groupRecord(parentInfo.groupId)?.name || null,
      textureUrl: texture?.dataUrl || null, textureName, textureFlipY: false, textureHasTransparency: !!texture,
      minecraft: { blockbenchUuid: element.uuid || null, boneId: parentInfo.boneId || null, from, to, origin: minecraftVec(element.origin, centerPixels), rotation: minecraftVec(element.rotation), inflate, flatAxes, uvOffset: Array.isArray(element.uv_offset) ? element.uv_offset : null, faces: element.faces || null }
    }, { record: false, update: false });
    if (mesh.material?.map) {
      mesh.material.map.magFilter = THREE.NearestFilter;
      mesh.material.map.minFilter = THREE.NearestFilter;
      mesh.material.map.generateMipmaps = false;
      mesh.material.map.needsUpdate = true;
      mesh.material.transparent = false;
      mesh.material.alphaTest = .1;
      mesh.material.depthWrite = true;
      mesh.material.needsUpdate = true;
    }
    mesh.userData.minecraftBoneId = parentInfo.boneId || null;
    cubes++;
  }
  for (const bone of rigBones) {
    const child = rigBones.find(candidate => candidate.parentId === bone.id);
    if (child) bone.tail.copy(child.position);
    bone.tailOffset = bone.tail.clone().sub(bone.position);
  }
  minecraftAnimationClips = (project.animations || []).filter(animation => animation && (Number(animation.length) > 0 || Object.keys(animation.animators || {}).length));
  minecraftAnimationBoneIds = new Map([...groupMap.entries()].map(([uuid, entry]) => [uuid, entry.bone.id]));
  const selectedClip = minecraftAnimationClips.findIndex(animation => animation.selected);
  activeMinecraftAnimation = selectedClip >= 0 ? selectedClip : 0;
  const keys = importBlockbenchAnimation(minecraftAnimationClips[activeMinecraftAnimation]);
  const sourceTexture = blockbenchTextureData(project);
  minecraftProject = {
    sourceName: file.name,
    format: project.meta?.model_format || project.meta?.format || "free",
    textureWidth: Number(project.resolution?.width) || 64,
    textureHeight: Number(project.resolution?.height) || 64,
    textureName: sourceTexture?.name || "",
    textureDataUrl: sourceTexture?.dataUrl || null
  };
  selectedBoneId = rigBones[0]?.id || null;
  animationState.bindingRest = null;
  restoreBoneRig(serializeBoneRig());
  refreshMinecraftAnimationSelect();
  selectObject(objects[0] || null);
  updateAll(); frameSelected(); setWorkspace("minecraft", { quiet: true });
  if (els.minecraftImportStatus) els.minecraftImportStatus.textContent = `${cubes} cubes · ${rigBones.length} bones · ${keys} keys`;
  log(`Imported ${file.name}: ${cubes} Minecraft cuboids, ${rigBones.length} bones, and ${keys} animation keys.${skipped ? ` Skipped ${skipped} non-cuboid element(s).` : ""}`);
}

function minecraftObjectsByBone() {
  const map = new Map();
  for (const mesh of objects) {
    const id = mesh.userData.minecraft?.boneId || mesh.userData.minecraftBoneId;
    if (!id) continue;
    if (!map.has(id)) map.set(id, []);
    map.get(id).push(mesh);
  }
  return map;
}

function javaFloat(value) {
  const rounded = Math.abs(Number(value) || 0) < 1e-7 ? 0 : Math.round((Number(value) || 0) * 10000) / 10000;
  return `${rounded}F`;
}

function generateNeoForgeModelSource(options) {
  const { packageName, modelName, modId } = options;
  const byBone = minecraftObjectsByBone();
  const children = new Map();
  rigBones.forEach(bone => { const key = bone.parentId || "root"; if (!children.has(key)) children.set(key, []); children.get(key).push(bone); });
  const names = new Map(rigBones.map(bone => [bone.id, javaMember(bone.name)]));
  const declarations = rigBones.map(bone => `    private final ModelPart ${names.get(bone.id)};`).join("\n");
  const assignments = rigBones.map(bone => {
    const path = []; let current = bone;
    while (current) { path.unshift(names.get(current.id)); current = boneById(current.parentId); }
    return `        this.${names.get(bone.id)} = this.root${path.map(name => `.getChild("${name}")`).join("")};`;
  }).join("\n");
  const emitBone = (bone, parentVar) => {
    const name = names.get(bone.id);
    const sourcePosition = bone.blockbenchSourcePosition || bone.position;
    const parentSourcePosition = bone.parentId ? (boneById(bone.parentId)?.blockbenchSourcePosition || boneById(bone.parentId)?.position) : null;
    const local = parentSourcePosition ? sourcePosition.clone().sub(parentSourcePosition) : sourcePosition.clone();
    const localRotation = bone.blockbenchLocalRotation || bone.bindRotation;
    const cubes = (byBone.get(bone.id) || []).map(mesh => {
      const data = mesh.userData.minecraft || {}; const from = data.from || mesh.position.clone().sub(mesh.scale.clone().multiplyScalar(.5)).toArray().map(v => v / MINECRAFT_UNIT);
      const to = data.to || mesh.position.clone().add(mesh.scale.clone().multiplyScalar(.5)).toArray().map(v => v / MINECRAFT_UNIT);
      const origin = data.origin || bone.position.toArray().map(v => v / MINECRAFT_UNIT);
      const x = from[0] - origin[0], y = origin[1] - to[1], z = from[2] - origin[2];
      return `.texOffs(${Number(data.uvOffset?.[0]) || 0}, ${Number(data.uvOffset?.[1]) || 0}).addBox(${javaFloat(x)}, ${javaFloat(y)}, ${javaFloat(z)}, ${javaFloat(to[0]-from[0])}, ${javaFloat(to[1]-from[1])}, ${javaFloat(to[2]-from[2])}, new CubeDeformation(${javaFloat(data.inflate || 0)}))`;
    }).join("");
    const builder = cubes ? `CubeListBuilder.create()${cubes}` : "CubeListBuilder.create()";
    const line = `        PartDefinition ${name} = ${parentVar}.addOrReplaceChild("${name}", ${builder}, PartPose.offsetAndRotation(${javaFloat(local.x / MINECRAFT_UNIT)}, ${javaFloat(-local.y / MINECRAFT_UNIT)}, ${javaFloat(local.z / MINECRAFT_UNIT)}, ${javaFloat(localRotation.x)}, ${javaFloat(localRotation.y)}, ${javaFloat(localRotation.z)}));`;
    return [line, ...(children.get(bone.id) || []).flatMap(child => emitBone(child, name))];
  };
  const definitions = (children.get("root") || []).flatMap(bone => emitBone(bone, "root")).join("\n");
  return `package ${packageName};\n\nimport com.mojang.blaze3d.vertex.PoseStack;\nimport com.mojang.blaze3d.vertex.VertexConsumer;\nimport net.minecraft.client.model.EntityModel;\nimport net.minecraft.client.model.geom.ModelLayerLocation;\nimport net.minecraft.client.model.geom.ModelPart;\nimport net.minecraft.client.model.geom.PartPose;\nimport net.minecraft.client.model.geom.builders.*;\nimport net.minecraft.resources.ResourceLocation;\nimport net.minecraft.world.entity.Entity;\n\npublic class ${modelName}<T extends Entity> extends EntityModel<T> {\n    public static final ModelLayerLocation LAYER_LOCATION = new ModelLayerLocation(ResourceLocation.fromNamespaceAndPath("${modId}", "${modelName.toLowerCase()}"), "main");\n    private final ModelPart root;\n${declarations}\n\n    public ${modelName}(ModelPart root) {\n        this.root = root;\n${assignments}\n    }\n\n    public static LayerDefinition createBodyLayer() {\n        MeshDefinition mesh = new MeshDefinition();\n        PartDefinition root = mesh.getRoot();\n${definitions}\n        return LayerDefinition.create(mesh, ${minecraftProject.textureWidth}, ${minecraftProject.textureHeight});\n    }\n\n    @Override public void setupAnim(T entity, float limbSwing, float limbSwingAmount, float ageInTicks, float netHeadYaw, float headPitch) {\n        this.root.getAllParts().forEach(ModelPart::resetPose);\n        // Call animate(...) or animateWalk(...) here with the generated definitions for your entity state.\n    }\n\n    @Override public void renderToBuffer(PoseStack poseStack, VertexConsumer consumer, int packedLight, int packedOverlay, int color) {\n        this.root.render(poseStack, consumer, packedLight, packedOverlay, color);\n    }\n}\n`;
}

function generateNeoForgeAnimationsSource(options) {
  const modelName = options.modelName;
  const clips = minecraftAnimationClips.length ? minecraftAnimationClips : [{ name: "custom", length: animationState.end / animationState.fps, loop: "loop", bwsKeys: animationState.keys }];
  const definitions = clips.map((clip, clipIndex) => {
    const channels = [];
    if (clip.bwsKeys) {
      for (const bone of rigBones) {
        const keys = clip.bwsKeys[bone.id] || [];
        if (!keys.length) continue;
        const frames = keys.map(key => {
          const relative = key.rotation.map((value, index) => THREE.MathUtils.radToDeg(value - bone.bindRotation.getComponent(index)));
          return `new Keyframe(${javaFloat(key.frame / animationState.fps)}, KeyframeAnimations.degreeVec(${relative.map(javaFloat).join(", ")}), AnimationChannel.Interpolations.LINEAR)`;
        }).join(",\n                ");
        channels.push(`        .addAnimation("${javaMember(bone.name)}", new AnimationChannel(AnimationChannel.Targets.ROTATION,\n                ${frames}))`);
      }
    } else {
      for (const [uuid, animator] of Object.entries(clip.animators || {})) {
        const bone = boneById(minecraftAnimationBoneIds.get(uuid));
        if (!bone) continue;
        for (const channelName of ["rotation", "position"]) {
          const sourceFrames = (animator.keyframes || []).filter(key => key.channel === channelName).sort((a, b) => Number(a.time) - Number(b.time));
          if (!sourceFrames.length) continue;
          const target = channelName === "rotation" ? "ROTATION" : "POSITION";
          const vector = channelName === "rotation" ? "degreeVec" : "posVec";
          const frames = sourceFrames.map(key => {
            const point = key.data_points?.[0] || {};
            const values = [Number(point.x) || 0, Number(point.y) || 0, Number(point.z) || 0];
            if (channelName === "position") values[1] *= -1;
            const interpolation = String(key.interpolation || "linear").toLowerCase() === "catmullrom" ? "CATMULLROM" : "LINEAR";
            return `new Keyframe(${javaFloat(key.time)}, KeyframeAnimations.${vector}(${values.map(javaFloat).join(", ")}), AnimationChannel.Interpolations.${interpolation})`;
          }).join(",\n                ");
          channels.push(`        .addAnimation("${javaMember(bone.name)}", new AnimationChannel(AnimationChannel.Targets.${target},\n                ${frames}))`);
        }
      }
    }
    const constant = javaMember(clip.name || `animation_${clipIndex + 1}`).toUpperCase();
    const looping = clip.loop === "loop" ? ".looping()" : "";
    return `    public static final AnimationDefinition ${constant} = AnimationDefinition.Builder.withLength(${javaFloat(Math.max(.05, Number(clip.length) || 0))})${looping}\n${channels.join("\n")}\n        .build();`;
  });
  return `package ${options.packageName};\n\nimport net.minecraft.client.animation.*;\n\npublic final class ${modelName}Animations {\n    private ${modelName}Animations() {}\n${definitions.join("\n\n")}\n}\n`;
}

function normalizedMinecraftTint() {
  const value = String(els.minecraftOutputColorInput?.value || "#ffffff");
  return /^#[0-9a-f]{6}$/i.test(value) ? value : "#ffffff";
}

function tintMinecraftTexture(dataUrl, color) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth || image.width;
      canvas.height = image.naturalHeight || image.height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) { reject(new Error("Texture canvas is unavailable.")); return; }
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      const tint = new THREE.Color(color);
      for (let index = 0; index < pixels.data.length; index += 4) {
        pixels.data[index] = Math.round(pixels.data[index] * tint.r);
        pixels.data[index + 1] = Math.round(pixels.data[index + 1] * tint.g);
        pixels.data[index + 2] = Math.round(pixels.data[index + 2] * tint.b);
      }
      context.putImageData(pixels, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = () => reject(new Error("The imported Blockbench texture could not be decoded."));
    image.src = dataUrl;
  });
}

async function minecraftOutputTextureDataUrl() {
  if (!minecraftProject.textureDataUrl) return null;
  return els.minecraftAddColorInput?.checked
    ? tintMinecraftTexture(minecraftProject.textureDataUrl, normalizedMinecraftTint())
    : minecraftProject.textureDataUrl;
}

async function saveMinecraftOutputTexture() {
  const dataUrl = await minecraftOutputTextureDataUrl();
  if (!dataUrl) { log("Import a Blockbench model with an embedded texture first."); return; }
  const variant = els.minecraftAddColorInput?.checked ? `-${normalizedMinecraftTint().slice(1).toLowerCase()}` : "";
  const sourceBase = safeFileName((minecraftProject.textureName || "minecraft-texture").replace(/\.[^.]+$/, ""));
  downloadBlob(`${sourceBase}${variant}.png`, new Blob([dataUrlToBytes(dataUrl)], { type: "image/png" }));
  log(`Saved ${els.minecraftAddColorInput?.checked ? "colored variant" : "original"} Minecraft texture output.`);
}

async function exportNeoForgeJava() {
  if (!rigBones.length || !minecraftObjectsByBone().size) { log("Import a Blockbench cuboid model with bones before exporting Minecraft Java."); return; }
  const modId = String(els.minecraftModIdInput.value || "examplemod").toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  const packageName = String(els.minecraftPackageInput.value || "com.example.examplemod.client").replace(/[^A-Za-z0-9_.$]/g, "");
  const modelName = javaIdentifier(els.minecraftModelNameInput.value || "CustomMob");
  const entityClass = String(els.minecraftEntityClassInput.value || "com.example.examplemod.entity.CustomMobEntity").replace(/[^A-Za-z0-9_.$]/g, "");
  const entitySimple = entityClass.split(".").pop();
  const texturePath = String(els.minecraftTextureInput.value || `textures/entity/${modelName.toLowerCase()}.png`).replace(/^\/+/, "");
  const options = { modId, packageName, modelName, entityClass, entitySimple, texturePath };
  const renderer = `package ${packageName};\n\nimport net.minecraft.client.renderer.entity.EntityRendererProvider;\nimport net.minecraft.client.renderer.entity.MobRenderer;\nimport net.minecraft.resources.ResourceLocation;\nimport ${entityClass};\n\npublic class ${modelName}Renderer extends MobRenderer<${entitySimple}, ${modelName}<${entitySimple}>> {\n    private static final ResourceLocation TEXTURE = ResourceLocation.fromNamespaceAndPath("${modId}", "${texturePath}");\n    public ${modelName}Renderer(EntityRendererProvider.Context context) { super(context, new ${modelName}<>(context.bakeLayer(${modelName}.LAYER_LOCATION)), 0.5F); }\n    @Override public ResourceLocation getTextureLocation(${entitySimple} entity) { return TEXTURE; }\n}\n`;
  const registration = `package ${packageName};\n\nimport net.neoforged.api.distmarker.Dist;\nimport net.neoforged.bus.api.SubscribeEvent;\nimport net.neoforged.fml.common.EventBusSubscriber;\nimport net.neoforged.neoforge.client.event.EntityRenderersEvent;\n// Replace YOUR_ENTITY with your DeferredHolder/RegistryObject.\n\n@EventBusSubscriber(modid = "${modId}", bus = EventBusSubscriber.Bus.MOD, value = Dist.CLIENT)\npublic final class ${modelName}ClientRegistration {\n    @SubscribeEvent public static void registerLayers(EntityRenderersEvent.RegisterLayerDefinitions event) { event.registerLayerDefinition(${modelName}.LAYER_LOCATION, ${modelName}::createBodyLayer); }\n    @SubscribeEvent public static void registerRenderers(EntityRenderersEvent.RegisterRenderers event) {\n        // event.registerEntityRenderer(ModEntities.YOUR_ENTITY.get(), ${modelName}Renderer::new);\n    }\n}\n`;
  const root = `src/main/java/${packageName.replace(/\./g, "/")}`;
  const readme = `Generated by BoltWorks 3D AI Studio v49.44.3 for NeoForge 1.21.1.\n\n1. Copy the Java files into the matching source package.\n2. Replace ModEntities.YOUR_ENTITY in ${modelName}ClientRegistration.java and uncomment the line.\n3. The selected original or colored texture is included at src/main/resources/assets/${modId}/${texturePath}.\n4. Connect the named constants in ${modelName}Animations (such as IDLE, WALK, RUN, SPRINT, JUMP, and CHEW) to your entity AnimationState fields in setupAnim.\n\nSource model: ${minecraftProject.sourceName || "BWS scene"}\n`;
  const entries = [
    { name: `${root}/${modelName}.java`, data: generateNeoForgeModelSource(options) },
    { name: `${root}/${modelName}Animations.java`, data: generateNeoForgeAnimationsSource(options) },
    { name: `${root}/${modelName}Renderer.java`, data: renderer },
    { name: `${root}/${modelName}ClientRegistration.java`, data: registration },
    { name: "README.txt", data: readme }
  ];
  const outputTexture = await minecraftOutputTextureDataUrl();
  const outputTextureBytes = outputTexture ? dataUrlToBytes(outputTexture) : null;
  if (outputTextureBytes) entries.push({ name: `src/main/resources/assets/${modId}/${texturePath}`, data: outputTextureBytes });
  const zip = makeZip(entries);
  downloadBlob(`${safeFileName(modelName)}-neoforge-1.21.1.zip`, zip);
  log(`Exported ${modelName} NeoForge 1.21.1 Java pack with model, renderer, registration, and animation definitions.`);
}

function initializeMinecraftTools() {
  setWorkspace(localStorage.getItem("boltworks.workspace") || "general", { quiet: true });
  renderPluginManager();
  els.workspaceSelect?.addEventListener("change", event => setWorkspace(event.target.value));
  const pickBlockbench = () => els.importBbmodelFile?.click();
  els.importBbmodelBtn?.addEventListener("click", pickBlockbench);
  els.minecraftImportBtn?.addEventListener("click", pickBlockbench);
  els.minecraftAnimationSelect?.addEventListener("change", event => {
    activateMinecraftAnimation(event.target.value);
    if (typeof syncAnimatorClipSelect === "function") syncAnimatorClipSelect();
  });
  els.animationSequenceAddBtn?.addEventListener("click", () => {
    const clipIndex = Number(els.animationSequenceClipSelect?.value);
    if (!Number.isInteger(clipIndex) || !minecraftAnimationClips[clipIndex]) return;
    minecraftAnimationSequence.push(clipIndex);
    renderMinecraftAnimationSequence();
  });
  els.animationSequenceClearBtn?.addEventListener("click", () => { cancelMinecraftAnimationSequencePreview(); minecraftAnimationSequence = []; renderMinecraftAnimationSequence(); });
  els.animationSequencePreviewBtn?.addEventListener("click", () => {
    if (els.animationSequencePreviewBtn.textContent.includes("Stop")) cancelMinecraftAnimationSequencePreview();
    else previewMinecraftAnimationSequence();
  });
  els.animationSequenceList?.addEventListener("click", event => {
    const remove = event.target.closest("[data-sequence-remove]");
    if (remove) { minecraftAnimationSequence.splice(Number(remove.dataset.sequenceRemove), 1); renderMinecraftAnimationSequence(); return; }
    const move = event.target.closest("[data-sequence-move]");
    if (!move) return;
    const from = Number(move.dataset.sequenceIndex), to = from + Number(move.dataset.sequenceMove);
    if (from < 0 || to < 0 || from >= minecraftAnimationSequence.length || to >= minecraftAnimationSequence.length) return;
    [minecraftAnimationSequence[from], minecraftAnimationSequence[to]] = [minecraftAnimationSequence[to], minecraftAnimationSequence[from]];
    renderMinecraftAnimationSequence();
  });
  els.importBbmodelFile?.addEventListener("change", async event => {
    const file = event.target.files?.[0]; if (!file) return;
    try { await importBlockbenchProject(file); } catch (error) { log(`Blockbench import failed: ${error.message}`); }
    event.target.value = "";
  });
  els.minecraftAddColorInput?.addEventListener("change", () => {
    if (els.minecraftOutputColorInput) els.minecraftOutputColorInput.disabled = !els.minecraftAddColorInput.checked;
    if (els.minecraftTextureOutputStatus) els.minecraftTextureOutputStatus.textContent = els.minecraftAddColorInput.checked
      ? "Color affects exported texture only; the viewport stays original."
      : "Original texture will be exported unchanged.";
  });
  if (els.minecraftOutputColorInput) els.minecraftOutputColorInput.disabled = !els.minecraftAddColorInput?.checked;
  els.minecraftSaveTextureBtn?.addEventListener("click", () => saveMinecraftOutputTexture().catch(error => log(`Texture output failed: ${error.message}`)));
  els.minecraftExportJavaBtn?.addEventListener("click", () => exportNeoForgeJava().catch(error => log(`Minecraft export failed: ${error.message}`)));
  els.pluginTemplateBtn?.addEventListener("click", downloadPluginTemplate);
  els.pluginImportBtn?.addEventListener("click", () => els.pluginImportFile?.click());
  els.pluginImportFile?.addEventListener("change", async event => {
    const file = event.target.files?.[0]; if (!file) return;
    try { await importPluginManifest(file); } catch (error) { log(`Plugin import failed: ${error.message}`); }
    event.target.value = "";
  });
}
