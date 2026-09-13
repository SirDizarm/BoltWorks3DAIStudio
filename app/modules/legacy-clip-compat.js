// Data compatibility for existing saved models and clips, NOT the Minecraft toolset.
// Keep historical keys unchanged so legacy projects can round-trip without data loss.
const MINECRAFT_UNIT = 1 / 16;
let minecraftProject = { sourceName: "", format: "", textureWidth: 64, textureHeight: 64, textureName: "", textureDataUrl: null };
let minecraftAnimationClips = [];
let minecraftAnimationBoneIds = new Map();
let activeMinecraftAnimation = 0;
let minecraftAnimationSequence = [];
let minecraftAnimationSequencePreviewToken = 0;

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
    ? minecraftAnimationClips.map((clip, index) => `<option value="${index}">${bwsEscapeHtml(clip.name || `Animation ${index + 1}`)}</option>`).join("")
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
      ? minecraftAnimationClips.map((clip, index) => `<option value="${index}">${bwsEscapeHtml(clip.name || `Animation ${index + 1}`)}</option>`).join("")
      : '<option value="">No clips</option>';
  }
  if (!els.animationSequenceList) return;
  const sequence = animationSequenceClipIndices();
  els.animationSequenceList.innerHTML = sequence.length ? sequence.map((clipIndex, index) => {
    const label = bwsEscapeHtml(minecraftAnimationClips[clipIndex]?.name || `Animation ${clipIndex + 1}`);
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
