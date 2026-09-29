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

// Keep modeling drags inside the editor instead of opening the browser menu or
// sweeping accidental text highlights across controls and labels.
document.addEventListener("contextmenu", event => event.preventDefault());

let viewportContextMenuEvent = null;

function closeViewportContextMenu() {
  if (!els.viewportContextMenu) return;
  els.viewportContextMenu.hidden = true;
  viewportContextMenuEvent = null;
}

function openViewportContextMenu(event) {
  if (!els.viewportContextMenu || !event.altKey || event.button !== 2) return;
  event.preventDefault();
  event.stopPropagation();
  viewportContextMenuEvent = event;
  const menu = els.viewportContextMenu;
  menu.hidden = false;
  const menuRect = menu.getBoundingClientRect();
  const maxLeft = Math.max(6, window.innerWidth - menuRect.width - 6);
  const maxTop = Math.max(6, window.innerHeight - menuRect.height - 6);
  menu.style.left = `${Math.max(6, Math.min(event.clientX, maxLeft))}px`;
  menu.style.top = `${Math.max(6, Math.min(event.clientY, maxTop))}px`;
  menu.querySelector("button")?.focus();
}

canvas.addEventListener("contextmenu", openViewportContextMenu);
document.addEventListener("pointerdown", event => {
  if (!els.viewportContextMenu?.hidden && !els.viewportContextMenu.contains(event.target)) closeViewportContextMenu();
}, true);
document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeViewportContextMenu();
});
els.viewportContextMenu?.addEventListener("click", event => {
  const button = event.target.closest("button");
  if (!button) return;
  const action = button.dataset.contextAction;
  const shape = button.dataset.contextAdd;
  const menuEvent = viewportContextMenuEvent;
  closeViewportContextMenu();
  if (shape && menuEvent) {
    addObjectAtPointer(shape, menuEvent);
    return;
  }
  if (action === "select-tri") els.facePickBtn?.click();
  else if (action === "select-face") els.faceRegionBtn?.click();
  else if (action === "select-connected") els.selectConnectedBtn?.click();
  else if (action === "area-select") {
    if (!facePickMode) els.facePickBtn?.click();
    els.areaTriBtn?.click();
  }
  else if (action === "select-inside") els.selectInsideBoundaryBtn?.click();
  else if (action === "move-face-center") moveSelectedSurfaceToCenter(els.viewportContextCenterAxis?.value);
  else if (action === "move-face-xyz-center") moveSelectedSurfaceToCenter(els.viewportContextCenterAxis?.value);
  else if (["move-selected-area", "rotate-selected-area", "scale-selected-area"].includes(action)) {
    if (!surfaceComponentSelectionCount()) {
      log("Select a triangle, face, edge, or vertex first.");
      return;
    }
    const mode = action === "move-selected-area" ? "translate" : action === "rotate-selected-area" ? "rotate" : "scale";
    setSurfaceGizmoMode(mode);
    const label = mode === "translate" ? "Move" : mode === "rotate" ? "Rotate" : "Scale";
    log(`${label} Selected Area enabled. Drag the ${mode === "translate" ? "axis arrows" : mode === "rotate" ? "rotation rings" : "scale handles"} around the selected area center.`);
  }
});

async function copyProjectNameFromField() {
  const field = els.projectNameInput;
  if (!field) return false;
  const value = field.value;
  field.focus();
  field.select();
  let copied = false;
  try {
    await navigator.clipboard.writeText(value);
    copied = true;
  } catch {
    try { copied = !!document.execCommand?.("copy"); } catch {}
  }
  if (copied) {
    const originalTitle = field.title;
    field.title = "Project name copied";
    field.classList.add("copy-confirmed");
    setTimeout(() => {
      field.title = originalTitle;
      field.classList.remove("copy-confirmed");
    }, 900);
    log(`Copied project name: ${value}`);
  }
  return copied;
}

els.projectNameInput?.addEventListener("dblclick", event => {
  event.preventDefault();
  copyProjectNameFromField();
});

const noticeRailCollapseBtn = document.querySelector("#noticeRailCollapseBtn");
const supportBwsBtn = document.querySelector("#supportBwsBtn");
const supportBwsModal = document.querySelector("#supportBwsModal");
const supportBwsCloseBtn = document.querySelector("#supportBwsCloseBtn");
let lowerInfoCollapsed = localStorage.getItem("boltworks.bottomInfoCollapsed") === "true";

function setSupportBwsOpen(open) {
  if (!supportBwsModal) return;
  document.body.classList.toggle("support-bws-open", open);
  supportBwsModal.classList.toggle("open", open);
  supportBwsModal.setAttribute("aria-hidden", String(!open));
  if (open) supportBwsCloseBtn?.focus();
  else supportBwsBtn?.focus();
}

supportBwsBtn?.addEventListener("click", () => setSupportBwsOpen(true));
supportBwsCloseBtn?.addEventListener("click", () => setSupportBwsOpen(false));
supportBwsModal?.addEventListener("click", event => {
  if (event.target === supportBwsModal) setSupportBwsOpen(false);
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && supportBwsModal?.classList.contains("open")) setSupportBwsOpen(false);
});

function syncFooterNoticeRail() {
  document.body.classList.toggle("footer-info-collapsed", lowerInfoCollapsed);
  if (!noticeRailCollapseBtn) return;
  noticeRailCollapseBtn.textContent = lowerInfoCollapsed ? "Expand Lower Panel" : "Minimize Lower Panel";
  noticeRailCollapseBtn.setAttribute("aria-expanded", String(!lowerInfoCollapsed));
  noticeRailCollapseBtn.classList.toggle("active", lowerInfoCollapsed);
}

noticeRailCollapseBtn?.addEventListener("click", () => {
  lowerInfoCollapsed = !lowerInfoCollapsed;
  localStorage.setItem("boltworks.bottomInfoCollapsed", String(lowerInfoCollapsed));
  syncFooterNoticeRail();
  requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
});

syncFooterNoticeRail();

function gameplayPreviewVisible() {
  return !!(els.gameplayPreview && !els.gameplayPreview.hidden && gameplayRenderer);
}

function syncGameplayPlaybackUi() {
  if (els.gameplayPreviewPlayBtn) {
    els.gameplayPreviewPlayBtn.disabled = !gameplayPlaybackPaused;
    els.gameplayPreviewPlayBtn.classList.toggle("active", !gameplayPlaybackPaused);
  }
  if (els.gameplayPreviewPauseBtn) {
    els.gameplayPreviewPauseBtn.disabled = gameplayPlaybackPaused;
    els.gameplayPreviewPauseBtn.classList.toggle("active", gameplayPlaybackPaused);
  }
}

function playGameplayPreview() {
  if (!gameplayPreviewVisible()) return false;
  if (dicePhysicsPreview) { gameplayPlaybackPaused=false;gameplayLastFrame=performance.now();syncGameplayPlaybackUi();return true; }
  gameplayPlaybackPaused = false;
  gameplayLastFrame = performance.now();
  setGameplayCharacterAnimation(gameplayLocomotionKind || "idle");
  advanceGameplayCharacterAnimation(0, { forcePose: true });
  syncGameplayPlaybackUi();
  updateGameplayArenaStatus("Playing — click the player screen to take control");
  return true;
}

function pauseGameplayPreview() {
  if (!gameplayPreviewVisible()) return false;
  if (dicePhysicsPreview) { gameplayPlaybackPaused=true;syncGameplayPlaybackUi();return true; }
  gameplayPlaybackPaused = true;
  gameplayKeys.clear();
  gameplayMouseButtons.clear();
  stopGameplayUpperBodyAction();
  animationState.playing = false;
  syncGameplayPlaybackUi();
  updateGameplayArenaStatus("Paused — press Play to continue");
  return true;
}

function resetGameplayPreviewCamera() {
  if (dicePhysicsPreview) { dicePhysicsPreview.reset();updateDiceScore(dicePhysicsPreview.snapshot());return; }
  if (!gameplayRenderer) return;
  const bounds = sceneBounds();
  const size = bounds.getSize(new THREE.Vector3());
  bounds.getCenter(gameplayReferenceTargetBase);
  const rootBone = rigBones.find(bone => !bone.parentId);
  const headBone = rigBones.find(bone => /(^|\s)(head|skull)($|\s)/i.test(`${bone.id || ""} ${bone.name || ""}`));
  const rootAnchor = rootBone?.bindPosition || rootBone?.position;
  const headAnchor = headBone?.bindPosition || headBone?.position;
  if (rootAnchor && headAnchor) {
    gameplayCameraTargetBase.set(rootAnchor.x, headAnchor.y, rootAnchor.z);
  } else {
    gameplayCameraTargetBase.copy(gameplayReferenceTargetBase);
    gameplayCameraTargetBase.y += size.y * .08;
  }
  gameplayFollowDistance = Math.max(2, size.length() * 1.15);
  gameplayCameraLocked = true;
  gameplayCameraOrbitOffset = 0;
  gameplayYaw = gameplayCharacterYaw + Math.PI;
  gameplayPitch = 0;
  gameplayCamera.near = camera.near;
  gameplayCamera.far = camera.far;
  gameplayCamera.updateProjectionMatrix();
  syncGameplayFollowCamera();
}

function syncGameplayFollowCamera() {
  if (!gameplayRenderer) return;
  if (gameplayCameraLocked) gameplayYaw = gameplayCharacterYaw + Math.PI + gameplayCameraOrbitOffset;
  const target = gameplayCameraTargetBase.clone().add(gameplayCharacterOffset);
  target.y += gameplayJumpHeight;
  const horizontal = Math.cos(gameplayPitch) * gameplayFollowDistance;
  gameplayCamera.position.set(
    target.x + Math.sin(gameplayYaw) * horizontal,
    target.y + Math.sin(gameplayPitch) * gameplayFollowDistance,
    target.z + Math.cos(gameplayYaw) * horizontal
  );
  gameplayCamera.lookAt(target);
}

function updateGameplayHint() {
  if (!els.gameplayHintText) return;
  const speedLabel = `${gameplaySpeedMultiplier.toFixed(2).replace(/\.?0+$/, "") || "1"}x`;
  els.gameplayHintText.textContent =
    `Press Play, then click to control · Mouse steer · Middle mouse orbit · C centers camera · WASD move · Shift run · Space jump · Left click slash · Right click shield block · B/F reserved for spells · Crawl disabled · Preview Tools: optional systems/look direction · Scroll: speed ${speedLabel} · Esc releases control`;
}

function updateGameplayArenaStatus(message = "") {
  if (!els.gameplayStatusText) return;
  els.gameplayStatusText.textContent = message || `Open arena · Blocks ${gameplayArenaScore.blocked} · Hits ${gameplayArenaScore.hits}`;
}

function gameplayArenaMaterial(color, roughness = .8, metalness = .05) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function buildGameplayArena() {
  gameplayArenaGroup.clear();
  gameplayArenaColliders.length = 0;
  gameplayArenaTargets.length = 0;
  gameplayArenaProjectiles.length = 0;
  gameplayArenaScore = { targets: 0, blocked: 0, hits: 0 };
  gameplayArenaProjectileClock = 0;
  const bounds = sceneBounds();
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  gameplayArenaScale = Math.max(.5, size.y / 6 || 1);
  gameplayArenaGroundY = bounds.min.y;

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(gameplayArenaScale * 44, gameplayArenaScale * 44),
    gameplayArenaMaterial(0x26372f, .96, 0)
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(center.x, gameplayArenaGroundY - .025, center.z);
  ground.receiveShadow = true;
  gameplayArenaGroup.add(ground);
  const arenaGrid = new THREE.GridHelper(gameplayArenaScale * 44, 44, 0x54b7a2, 0x344d45);
  arenaGrid.position.copy(ground.position).add(new THREE.Vector3(0, .035, 0));
  gameplayArenaGroup.add(arenaGrid);

  gameplayArenaGroup.visible = true;
  updateGameplayArenaStatus("Open arena ready — no collision props");
}

function gameplayCharacterWorldPosition() {
  return gameplayCameraTargetBase.clone().add(gameplayCharacterOffset).add(new THREE.Vector3(0, gameplayJumpHeight, 0));
}

function startGameplayJump() {
  if (gameplayJumpStartedAt) return false;
  gameplayJumpStartedAt = performance.now();
  return true;
}

function updateGameplayJump(now = performance.now()) {
  if (!gameplayJumpStartedAt) { gameplayJumpHeight = 0; return false; }
  const phase = (now - gameplayJumpStartedAt) / 900;
  if (phase >= 1) {
    gameplayJumpStartedAt = 0;
    gameplayJumpHeight = 0;
    return false;
  }
  gameplayJumpHeight = Math.sin(Math.PI * Math.max(0, phase)) * gameplayArenaScale * 1.6;
  return true;
}

function gameplayMovementBlocked(nextOffset) {
  const point = gameplayCameraTargetBase.clone().add(nextOffset);
  const radius = gameplayArenaScale * .32;
  return gameplayArenaColliders.some(({ box, height }) => {
    if (gameplayJumpHeight > height * .8) return false;
    return point.x > box.min.x - radius && point.x < box.max.x + radius
      && point.z > box.min.z - radius && point.z < box.max.z + radius;
  });
}

function hitGameplayTargets() {
  if (!gameplayPreviewVisible()) return 0;
  const character = gameplayCharacterWorldPosition();
  const forward = new THREE.Vector3(Math.sin(gameplayCharacterYaw), 0, Math.cos(gameplayCharacterYaw));
  let hits = 0;
  for (const target of gameplayArenaTargets) {
    const direction = target.position.clone().sub(character);
    direction.y = 0;
    if (direction.length() > gameplayArenaScale * 2.7 || direction.normalize().dot(forward) < .15) continue;
    target.userData.hitUntil = performance.now() + 700;
    target.rotation.z = -.45;
    hits++;
  }
  if (hits) {
    gameplayArenaScore.targets += hits;
    updateGameplayArenaStatus();
  }
  return hits;
}

function spawnGameplayProjectile() {
  const character = gameplayCharacterWorldPosition();
  const distance = gameplayArenaScale * 10;
  // Fire every projectile from the arena's front edge into the lane occupied
  // when it spawned. The lane does not home after launch, so strafing sideways
  // is a reliable dodge instead of attacks arriving from random directions.
  const projectileLaneTarget = character.clone();
  const projectile = new THREE.Mesh(
    new THREE.SphereGeometry(gameplayArenaScale * .13, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xffbe45, emissive: 0x8a3600, emissiveIntensity: .8 })
  );
  projectile.position.set(
    projectileLaneTarget.x,
    gameplayArenaGroundY + gameplayArenaScale * 1.35,
    projectileLaneTarget.z + distance
  );
  projectile.userData.velocity = projectileLaneTarget.clone().sub(projectile.position).normalize().multiplyScalar(gameplayArenaScale * 4.2);
  projectile.userData.travelled = 0;
  projectile.userData.maxTravel = distance * 1.35;
  gameplayArenaGroup.add(projectile);
  gameplayArenaProjectiles.push(projectile);
}

function updateGameplayArena(deltaSeconds) {
  if (!gameplayArenaGroup.visible) return;
  const projectilesEnabled = !!els.gameplayProjectilesInput?.checked;
  if (projectilesEnabled) {
    gameplayArenaProjectileClock += deltaSeconds;
    if (gameplayArenaProjectileClock > 2.4) {
      gameplayArenaProjectileClock = 0;
      spawnGameplayProjectile();
    }
  } else {
    gameplayArenaProjectileClock = 0;
    for (const projectile of gameplayArenaProjectiles) gameplayArenaGroup.remove(projectile);
    gameplayArenaProjectiles.length = 0;
  }
  const character = gameplayCharacterWorldPosition();
  const shieldHeld = gameplayUpperBodyAction?.kind === "shieldBlock";
  for (let index = gameplayArenaProjectiles.length - 1; index >= 0; index--) {
    const projectile = gameplayArenaProjectiles[index];
    const travel = projectile.userData.velocity.length() * deltaSeconds;
    projectile.position.addScaledVector(projectile.userData.velocity, deltaSeconds);
    projectile.userData.travelled += travel;
    if (projectile.userData.travelled > projectile.userData.maxTravel) {
      gameplayArenaGroup.remove(projectile);
      gameplayArenaProjectiles.splice(index, 1);
      updateGameplayArenaStatus("Projectile dodged!");
      continue;
    }
    if (projectile.position.distanceTo(character) > gameplayArenaScale * .9) continue;
    gameplayArenaGroup.remove(projectile);
    gameplayArenaProjectiles.splice(index, 1);
    if (shieldHeld) gameplayArenaScore.blocked++;
    else gameplayArenaScore.hits++;
    updateGameplayArenaStatus(shieldHeld ? "Projectile blocked!" : "Projectile hit");
  }
  const now = performance.now();
  for (const target of gameplayArenaTargets) {
    if (target.userData.hitUntil > now) continue;
    target.rotation.z *= .82;
  }
}

function gameplayAnimationClipId(kind) {
  const patterns = {
    idle: [/^idle\b/i],
    walk: [/^walk\b/i],
    run: [/^run\b/i],
    crawl: [/^crawl\b/i, /^sneak\b/i, /crouch/i],
    jump: [/^jump\b/i]
  };
  return Object.entries(animationState.clips || {}).find(([, clip]) =>
    (patterns[kind] || []).some(pattern => pattern.test(clip?.name || "")))?.[0] || null;
}

function gameplayStrideSyncEnabled() {
  return els.gameplayStrideSyncInput?.checked !== false;
}

function gameplayStrideScale() {
  return THREE.MathUtils.clamp(Number(els.gameplayStrideScaleInput?.value) || 1, .5, 1.5);
}

function gameplayLegBone(side, part) {
  const sidePattern = side === "left" ? /(^|\s)(left|l)(\s|$)/ : /(^|\s)(right|r)(\s|$)/;
  const partPattern = part === "thigh" ? /thigh|upper leg/ : part === "shin" ? /shin|calf|lower leg/ : /foot|ankle/;
  return rigBones.find(bone => {
    const label = `${bone.name || ""} ${bone.id || ""}`.toLowerCase().replace(/[_-]+/g, " ");
    return sidePattern.test(label) && partPattern.test(label);
  }) || null;
}

function gameplayLegLength(side) {
  const thigh = gameplayLegBone(side, "thigh");
  const shin = gameplayLegBone(side, "shin");
  const foot = gameplayLegBone(side, "foot");
  if (!thigh || !shin || !foot) return 0;
  const point = bone => bone.bindPosition || bone.position;
  return point(thigh).distanceTo(point(shin)) + point(shin).distanceTo(point(foot));
}

function gameplayClipStrideSpeed(kind) {
  const clipId = gameplayAnimationClipId(kind);
  const clip = clipId ? animationState.clips?.[clipId] : null;
  if (!clip) return 0;
  const fps = Math.max(1, Number(clip.fps) || animationState.fps || 24);
  const cycleSeconds = Math.max(1, Number(clip.end) || animationState.end || 1) / fps;
  const samples = ["left", "right"].map(side => {
    const thigh = gameplayLegBone(side, "thigh");
    const keys = thigh ? clip.keys?.[thigh.id] || [] : [];
    const values = keys.map(key => Number(key.rotation?.[0])).filter(Number.isFinite);
    const swing = values.length > 1 ? Math.max(...values) - Math.min(...values) : 0;
    return { length: gameplayLegLength(side), swing };
  }).filter(sample => sample.length > 0);
  if (!samples.length) return 0;
  const legLength = samples.reduce((sum, sample) => sum + sample.length, 0) / samples.length;
  const authoredSwing = samples.reduce((largest, sample) => Math.max(largest, sample.swing), 0);
  // One complete gait cycle contains two steps. The thigh's authored forward/back
  // arc and the actual rig leg length provide a stable model-scale stride estimate.
  const strideDistance = 2 * legLength * Math.sin(THREE.MathUtils.clamp(authoredSwing || .65, .2, 2.2) / 2);
  return strideDistance / cycleSeconds * gameplayStrideScale();
}

function setGameplayCharacterAnimation(kind) {
  const clipId = gameplayAnimationClipId(kind);
  if (!clipId) return false;
  const clip = animationState.clips?.[clipId];
  const clipLoaded = animationState.activeClipId === clipId
    && animationState.keys === clip?.keys
    && animationHasKeys();
  const changed = gameplayLocomotionKind !== kind || !clipLoaded;
  gameplayLocomotionKind = kind;
  if (tPoseFittingMode || !clipLoaded) setActiveAnimationClip(clipId);
  if (changed) {
    gameplayLocomotionClock = 0;
    syncAnimationClipUi();
    if (typeof syncAnimatorClipSelect === "function") syncAnimatorClipSelect();
  }
  animationState.playing = true;
  return true;
}

function advanceGameplayCharacterAnimation(deltaSeconds, { forcePose = false } = {}) {
  if (gameplayPlaybackPaused) return false;
  const clipId = gameplayAnimationClipId(gameplayLocomotionKind);
  const clip = clipId ? animationState.clips?.[clipId] : null;
  if (!clip || animationState.activeClipId !== clipId || !animationHasKeys()) return false;
  const rate = gameplayStrideSyncEnabled() && ["walk", "run"].includes(gameplayLocomotionKind)
    ? gameplaySpeedMultiplier
    : 1;
  gameplayLocomotionClock += Math.max(0, Number(deltaSeconds) || 0) * rate;
  const fps = Math.max(1, Number(clip.fps) || animationState.fps || 24);
  const frameCount = Math.max(1, (Number(clip.end) || animationState.end || 1) + 1);
  const frame = Math.floor(gameplayLocomotionClock * fps) % frameCount;
  animationState.playing = true;
  animationState.lastTime = 0;
  if (forcePose || frame !== animationState.frame) {
    animationSetFrame(frame, { render: false, lightweightPanel: true });
  }
  return true;
}

function gameplayCombatClipId(kind) {
  const patterns = {
    slash: [/sword\s+slash/i, /slash/i],
    thrust: [/sword\s+(thrust|poke)/i, /thrust|poke/i],
    shieldBlock: [/shield\s+block/i],
    swordBlock: [/sword\s+block/i]
  };
  return Object.entries(animationState.clips || {}).find(([, clip]) =>
    (patterns[kind] || []).some(pattern => pattern.test(clip?.name || "")))?.[0] || null;
}

function startGameplayUpperBodyAction(kind, { held = false } = {}) {
  const clipId = gameplayCombatClipId(kind);
  if (!clipId) return false;
  // A fresh combat click restarts the strike even if the previous swing has
  // not quite finished. This keeps repeated attacks responsive while the
  // locomotion clock continues independently underneath them.
  if (gameplayUpperBodyAction?.kind === kind) {
    gameplayUpperBodyAction.startedAt = performance.now();
    gameplayUpperBodyAction.held = held;
    gameplayUpperBodyAction.holdLastFrame = true;
    if (kind === "slash" || kind === "thrust") hitGameplayTargets();
    return true;
  }
  gameplayUpperBodyAction = { kind, clipId, startedAt: performance.now(), held, holdLastFrame: true };
  if (kind === "slash" || kind === "thrust") hitGameplayTargets();
  animationSetFrame(animationState.frame, { render: false, lightweightPanel: true });
  return true;
}

function stopGameplayUpperBodyAction(kind = null) {
  if (!gameplayUpperBodyAction || (kind && gameplayUpperBodyAction.kind !== kind)) return false;
  gameplayUpperBodyAction = null;
  animationSetFrame(animationState.frame, { render: false, lightweightPanel: true });
  return true;
}

function releaseGameplayUpperBodyAction(kind = null) {
  if (!gameplayUpperBodyAction || (kind && gameplayUpperBodyAction.kind !== kind)) return false;
  gameplayUpperBodyAction.held = false;
  return true;
}

function gameplayUpperBodyBone(bone) {
  const label = `${bone?.id || ""} ${bone?.name || ""}`.toLowerCase().replace(/[_-]+/g, " ");
  // Combat is an additive arm/weapon layer. Do not animate Root, pelvis,
  // spine, chest, or any leg bone: imported rigs sometimes parent a pelvis
  // below the torso, so changing the torso could otherwise disturb the feet.
  return /(shoulder|clavicle|arm|forearm|elbow|hand|wrist|finger|thumb|neck|head|skull|sword|shield)/.test(label);
}

function sampleGameplayClipPose(clip, bone, frame) {
  const frames = (clip?.keys?.[bone.id] || []).slice().sort((a, b) => a.frame - b.frame);
  if (!frames.length) return null;
  let before = frames[0];
  let after = frames[frames.length - 1];
  for (const key of frames) {
    if (key.frame <= frame) before = key;
    if (key.frame >= frame) { after = key; break; }
  }
  const span = Math.max(1, after.frame - before.frame);
  const alpha = before === after ? 0 : (frame - before.frame) / span;
  const numberAt = (values, index, fallback) => {
    const value = Number(values?.[index]);
    return Number.isFinite(value) ? value : fallback;
  };
  const interpolate = (left, right, fallback) => fallback.map((value, index) => {
    const from = numberAt(left, index, value);
    return from + (numberAt(right, index, value) - from) * alpha;
  });
  const position = interpolate(before.position, after.position, bone.bindPosition.toArray());
  const rotation = interpolate(before.rotation, after.rotation, bone.bindRotation.toArray());
  return {
    position: new THREE.Vector3().fromArray(position),
    rotation: new THREE.Euler(rotation[0], rotation[1], rotation[2], bone.blockbenchLocalRotation ? "ZYX" : "XYZ")
  };
}

function applyGameplayUpperBodyAction(poses) {
  const action = gameplayUpperBodyAction;
  if (!action) return;
  const clip = animationState.clips?.[action.clipId];
  if (!clip) { gameplayUpperBodyAction = null; return; }
  const durationMs = Math.max(1, Number(clip.end) || 1) / Math.max(1, Number(clip.fps) || 24) * 1000;
  const elapsedMs = performance.now() - action.startedAt;
  const reachedLastFrame = elapsedMs >= durationMs;
  if (!action.held && reachedLastFrame) {
    gameplayUpperBodyAction = null;
    return;
  }
  const finalFrame = Math.max(1, Number(clip.end) || 1);
  // A held attack is a two-part action: play the authored slash once, then
  // move into the poke and hold its point until the mouse button is released.
  if (action.kind === "slash" && reachedLastFrame && (action.held || gameplayMouseButtons.has(0))) {
    if (startGameplayUpperBodyAction("thrust", { held: true })) return;
  }
  const phase = Math.min(1, elapsedMs / durationMs);
  const frame = reachedLastFrame && action.holdLastFrame ? finalFrame : phase * finalFrame;
  for (const bone of rigBones) {
    if (!gameplayUpperBodyBone(bone)) continue;
    // Combat fully owns the upper body while locomotion continues below the
    // waist. Falling through to walk/idle for an unkeyed arm or torso joint
    // makes old and newly edited poses visibly pull against each other.
    const actionPose = sampleGameplayClipPose(clip, bone, frame) || {
      position: bone.bindPosition.clone(),
      rotation: bone.bindRotation.clone()
    };
    poses.set(bone.id, actionPose);
    bone.position.copy(actionPose.position);
    bone.rotation.copy(actionPose.rotation);
  }
}

function applyGameplayCharacterPreviewPose(poses) {
  if (!gameplayPreviewVisible() || !(poses instanceof Map)) return;
  applyGameplayUpperBodyAction(poses);
  const characterYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), gameplayCharacterYaw);
  for (const bone of rigBones.filter(candidate => !candidate.parentId)) {
    const pose = poses.get(bone.id);
    if (!pose) continue;
    const locomotionClipId = gameplayAnimationClipId(gameplayLocomotionKind);
    const locomotionClip = locomotionClipId ? animationState.clips?.[locomotionClipId] : null;
    const rootAnchor = sampleGameplayClipPose(locomotionClip, bone, 0)?.position || bone.bindPosition;
    // Gameplay movement owns the horizontal path. Imported walk/run clips can
    // contain small X/Z root offsets that otherwise make W visibly wander or
    // zig-zag even though the gameplay direction itself is perfectly straight.
    pose.position.x = rootAnchor.x + gameplayCharacterOffset.x;
    pose.position.z = rootAnchor.z + gameplayCharacterOffset.z;
    pose.position.y += gameplayCharacterOffset.y + gameplayJumpHeight;
    // Steering is a world-space heading, while the clip's forward sprint lean
    // is local to the character. Adding Euler Y directly after an X pitch can
    // turn part of that pitch into a visible left/right roll. Compose the two
    // rotations so forward lean follows the heading without banking.
    // Older/imported projects can carry a root rotation as a Vector3. Convert
    // it to an Euler before composing preview yaw; Vector3 has no
    // setFromQuaternion method and previously stopped the entire play loop.
    const rotationOrder = ["XYZ", "YXZ", "ZXY", "ZYX", "YZX", "XZY"].includes(pose.rotation?.order)
      ? pose.rotation.order
      : (bone.blockbenchLocalRotation ? "ZYX" : "XYZ");
    const authoredEuler = pose.rotation?.isEuler
      ? pose.rotation
      : new THREE.Euler(
        Number(pose.rotation?.x) || 0,
        Number(pose.rotation?.y) || 0,
        Number(pose.rotation?.z) || 0,
        rotationOrder
      );
    const authoredRotation = new THREE.Quaternion().setFromEuler(authoredEuler);
    pose.rotation = new THREE.Euler().setFromQuaternion(characterYaw.clone().multiply(authoredRotation), rotationOrder);
    bone.position.copy(pose.position);
    bone.rotation.copy(pose.rotation);
  }
}

function openGameplayPreview() {
  if (isDiceDemo()) { openDicePhysics();return true; }
  if (!els.gameplayPreview || !gameplayRenderer) return false;
  // The animator's live key collection is the newest source of truth. Commit
  // it before Gameplay Preview changes the active clip, otherwise a recovered
  // or imported project can reload an older clip object over recent edits.
  syncActiveAnimationClip();
  animationState.lastTime = 0;
  rigPoseChannels.clear();
  els.gameplayPreview.hidden = false;
  gameplayKeys.clear();
  gameplayMouseButtons.clear();
  gameplayCharacterOffset.set(0, 0, 0);
  gameplayCharacterYaw = 0;
  gameplayCameraOrbitOffset = 0;
  gameplayUpperBodyAction = null;
  gameplayLocomotionKind = "idle";
  gameplayLocomotionClock = 0;
  gameplayPlaybackPaused = true;
  gameplayJumpStartedAt = 0;
  gameplayJumpHeight = 0;
  gameplaySpeedMultiplier = 1;
  buildGameplayArena();
  resetGameplayPreviewCamera();
  gameplayLastFrame = performance.now();
  resizeGameplayPreview();
  updateGameplayHint();
  updateGameplayArenaStatus("Click the player screen to take control");
  setGameplayCharacterAnimation("idle");
  animationState.playing = false;
  syncGameplayPlaybackUi();
  updateGameplayArenaStatus("Paused — press Play to start");
  log("Opened Gameplay Preview with the latest editor clips. Locomotion controls the legs while combat fully owns the upper body.");
  return true;
}

function closeGameplayPreview() {
  if(dicePhysicsPreview){dicePhysicsPreview.dispose();dicePhysicsPreview=null;els.gameplayPreview.hidden=true;els.gameplayPreview.classList.remove('dice-preview');document.getElementById('diceRollAgainBtn').hidden=true;gameplayPlaybackPaused=true;syncGameplayPlaybackUi();updateGameplayHint();return true;}
  if (!els.gameplayPreview) return false;
  if (document.pointerLockElement === gameplayCanvas) document.exitPointerLock?.();
  els.gameplayPreview.hidden = true;
  gameplayKeys.clear();
  gameplayMouseButtons.clear();
  gameplayCharacterOffset.set(0, 0, 0);
  gameplayCharacterYaw = 0;
  gameplayCameraOrbitOffset = 0;
  gameplayUpperBodyAction = null;
  gameplayLocomotionKind = "idle";
  gameplayPlaybackPaused = true;
  gameplayCameraLocked = false;
  gameplayJumpStartedAt = 0;
  gameplayJumpHeight = 0;
  gameplayArenaGroup.visible = false;
  for (const projectile of gameplayArenaProjectiles) gameplayArenaGroup.remove(projectile);
  gameplayArenaProjectiles.length = 0;
  animationState.playing = false;
  animationSetFrame(animationState.frame, { render: false, lightweightPanel: true });
  log("Closed Gameplay Preview, stopped its animation, and returned to the editor camera.");
  return true;
}

function releaseGameplayControl() {
  if (!gameplayPreviewVisible()) return false;
  if (document.pointerLockElement === gameplayCanvas) document.exitPointerLock?.();
  gameplayCameraLocked = false;
  gameplayKeys.clear();
  gameplayMouseButtons.clear();
  stopGameplayUpperBodyAction();
  setGameplayCharacterAnimation("idle");
  updateGameplayArenaStatus("Control released — click the player screen to reconnect");
  return true;
}

function resizeGameplayPreview() {
  if (!gameplayPreviewVisible()) return;
  const rect = gameplayCanvas.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return;
  gameplayRenderer.setSize(rect.width, rect.height, false);
  gameplayCamera.aspect = rect.width / rect.height;
  gameplayCamera.updateProjectionMatrix();
  if(dicePhysicsPreview)dicePhysicsPreview.resize(rect.width/rect.height);
}

function updateGameplayPreview(deltaSeconds) {
  if (!gameplayPreviewVisible()) return;
  if (gameplayPlaybackPaused) return;
  if (dicePhysicsPreview) { dicePhysicsPreview.step(deltaSeconds);return; }
  updateGameplayArena(deltaSeconds);
  const jumping = updateGameplayJump();
  if (!gameplayCameraLocked) {
    setGameplayCharacterAnimation("idle");
    advanceGameplayCharacterAnimation(deltaSeconds);
    return;
  }
  syncGameplayFollowCamera();
  // Movement uses the character's stable forward axis. A/D are strafes and do
  // not rotate the rig; this also prevents the rear follow camera and character
  // yaw from feeding back into each other and spinning the model.
  const forward = new THREE.Vector3(Math.sin(gameplayCharacterYaw), 0, Math.cos(gameplayCharacterYaw));
  // The follow camera looks toward the character from behind, so its visible
  // right side is the negative of the model-space X vector at zero yaw.
  const right = new THREE.Vector3(-Math.cos(gameplayCharacterYaw), 0, Math.sin(gameplayCharacterYaw));
  const movement = new THREE.Vector3();
  if (gameplayKeys.has("KeyW")) movement.add(forward);
  if (gameplayKeys.has("KeyS")) movement.sub(forward);
  if (gameplayKeys.has("KeyD")) movement.add(right);
  if (gameplayKeys.has("KeyA")) movement.sub(right);
  const running = gameplayKeys.has("ShiftLeft") || gameplayKeys.has("ShiftRight");
  const offensiveActionActive = ["slash", "thrust"].includes(gameplayUpperBodyAction?.kind);
  if (gameplayMouseButtons.has(2) && !offensiveActionActive) {
    if (gameplayUpperBodyAction?.kind !== "shieldBlock") startGameplayUpperBodyAction("shieldBlock", { held: true });
  }
  if (jumping) setGameplayCharacterAnimation("jump");
  else if (movement.lengthSq()) setGameplayCharacterAnimation(running ? "run" : "walk");
  else setGameplayCharacterAnimation("idle");
  const moving = movement.lengthSq() > 0;
  if (moving) {
    const worldSize = sceneBounds().getSize(new THREE.Vector3()).length();
    const direction = movement.normalize();
    const gaitSpeed = running ? 1.35 : .72;
    const matchedSpeed = gameplayStrideSyncEnabled() ? gameplayClipStrideSpeed(running ? "run" : "walk") : 0;
    const legacySpeed = Math.max(.35, worldSize * .055) * gaitSpeed;
    const speed = Math.max(.01, matchedSpeed || legacySpeed) * gameplaySpeedMultiplier;
    const step = direction.multiplyScalar(speed * deltaSeconds);
    const nextOffset = gameplayCharacterOffset.clone().add(step);
    if (!gameplayMovementBlocked(nextOffset)) gameplayCharacterOffset.copy(nextOffset);
    syncGameplayFollowCamera();
  }
  advanceGameplayCharacterAnimation(deltaSeconds, { forcePose: moving || jumping });
}

function applyGameplayCrawlEquipmentStow() {
  if (gameplayLocomotionKind !== "crawl") return [];
  const chest = rigBones.find(bone => /chest|ribcage|spine upper/i.test(`${bone.name || ""} ${bone.id || ""}`));
  if (!chest) return [];
  boneRigGroup.updateMatrixWorld(true);
  const chestPosition = chest.position.clone();
  const rootRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, gameplayCharacterYaw, 0));
  const stowed = [];
  for (const object of objects) {
    const label = object.name || "";
    if (!/shield|sword/i.test(label)) continue;
    stowed.push({ object, position: object.position.clone(), quaternion: object.quaternion.clone() });
    const isShield = /shield/i.test(label);
    const offset = new THREE.Vector3(isShield ? -.24 : .26, isShield ? .03 : -.1, isShield ? -.46 : -.52)
      .multiplyScalar(gameplayArenaScale).applyQuaternion(rootRotation);
    const worldPosition = chestPosition.clone().add(gameplayCharacterOffset).add(offset);
    const worldQuaternion = rootRotation.clone().multiply(
      new THREE.Quaternion().setFromEuler(new THREE.Euler(isShield ? Math.PI / 2 : 0, 0, isShield ? 0 : -.65))
    );
    object.position.copy(object.parent?.worldToLocal(worldPosition.clone()) || worldPosition);
    const parentQuaternion = object.parent?.getWorldQuaternion(new THREE.Quaternion()) || new THREE.Quaternion();
    object.quaternion.copy(parentQuaternion.invert().multiply(worldQuaternion));
    object.updateMatrixWorld(true);
  }
  return stowed;
}

function renderGameplayPreview() {
  if (!gameplayPreviewVisible()) return;
  if (dicePhysicsPreview) { gameplayRenderer.render(dicePhysicsPreview.scene,dicePhysicsPreview.camera);return; }
  const helpers = [
    grid,
    gridLabelGroup,
    transform,
    surfaceTransform,
    surfaceFrontTransform,
    surfaceSideTransform,
    faceMarker,
    selectionOutlineGroup,
    connectVerticesGuideGroup,
    openingPickGuideGroup,
    markerGroup,
    cameraDirectorGroup,
    lineSketchCursor,
    triangleBuildGroup,
    triangleBuildCursor,
    boneRigGroup,
    boneGridAxisGroup,
    boneRingGuideGroup,
    boneJoystickGroup,
    boneTransform
  ].filter(Boolean);
  const visibility = helpers.map(helper => helper.visible);
  helpers.forEach(helper => { helper.visible = false; });
  const stowedEquipment = applyGameplayCrawlEquipmentStow();
  gameplayRenderer.render(scene, gameplayCamera);
  for (const { object, position, quaternion } of stowedEquipment) {
    object.position.copy(position);
    object.quaternion.copy(quaternion);
    object.updateMatrixWorld(true);
  }
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
  // Gameplay owns its animation clock and must advance before any editor-only
  // rendering or panel work. A slow or interrupted editor pass must never turn
  // a held movement key into a one-frame step.
  if (gameplayPreviewVisible()) updateGameplayPreview(gameplayDelta);
  else updateAnimation(gameplayDelta);
  bwsUpdateCharacterEyeVisibility();
  resize();
  syncFlat2dLook();
  syncLiveMirrorPreview();
  boneGridAxisGroup.visible = !!els.showGridInput?.checked;
  syncActiveJointCamera();
  orbit.update();
  syncBoneDegreeHud();
  syncCameraDirectorVisibility();
  syncSelectionOutlineTransforms();
  updateReferenceViewFollowing();
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

// Render primitive thumbnails in a separate scene; never add preview meshes to the project.
function initializeMeshButtonPreviews() {
  // Bundled static images: no WebGL context or idle-time rendering at startup.
  for(const button of document.querySelectorAll("button[data-add]")){
    const shape=button.dataset.add,name=button.textContent.trim();button.classList.add("mesh-preview-button");button.setAttribute("aria-label",name);button.title=name+" - add this shape to the scene";
    const image=document.createElement("img");image.className="mesh-preview-image";image.alt="";image.setAttribute("aria-hidden","true");image.width=112;image.height=80;image.loading="eager";image.src="app/assets/mesh-previews/"+encodeURIComponent(shape)+".png";
    const label=document.createElement("span");label.className="mesh-preview-label";label.textContent=name;button.replaceChildren(image,label);
  }
  return;

  const buttons = [...document.querySelectorAll("button[data-add]")];
  const queue = [];
  const descriptions = {
    curvedPanel: "A thick curved wall segment",
    hollowBox: "An open box with thick walls",
    tube: "A hollow cylinder with an open center",
    ring: "A flat circular ring with a hole",
    torus: "A rounded doughnut-shaped ring",
    hemisphere: "Half of a sphere with a flat base",
    dome: "A shallow rounded dome",
    wedge: "A sloping triangular block",
    pyramidFrustum: "A pyramid with its pointed top cut off",
    prism: "A triangular prism",
    facetedBallLow: "A low-poly ball with 20 triangular faces",
    facetedBallMedium: "A faceted ball with 80 triangular faces",
    facetedBallHigh: "A faceted ball with 320 triangular faces",
    stair: "A solid stepped staircase"
  };
  for (const button of buttons) {
    const shape = button.dataset.add, name = button.textContent.trim();
    button.classList.add("mesh-preview-button");
    button.setAttribute("aria-label", name);
    button.title = name + (descriptions[shape] ? ": " + descriptions[shape] : " - add this shape to the scene");
    const label = document.createElement("span");
    label.className = "mesh-preview-label";
    label.textContent = name;
    const image = document.createElement("img");
    image.className = "mesh-preview-image";
    image.alt = "";
    image.setAttribute("aria-hidden", "true");
    image.width = 112; image.height = 80;
    image.hidden = true;
    button.replaceChildren(image, label);
    queue.push({shape, image});
  }
  if (!queue.length) return;
  let previewRenderer, previewScene, previewCamera, material, edgeMaterial;
  function release() {
    material?.dispose(); edgeMaterial?.dispose();
    previewRenderer?.dispose(); previewRenderer?.forceContextLoss();
  }
  function schedule(callback) {
    if (typeof requestIdleCallback === "function") requestIdleCallback(callback, {timeout: 1000});
    else setTimeout(callback, 16);
  }
  function next() {
    const item = queue.shift();
    if (!item) { release(); return; }
    let geometry, edges, model;
    try {
      geometry = shapeFactories[item.shape]?.();
      if (geometry) {
        geometry.computeBoundingBox();
        const size = geometry.boundingBox.getSize(new THREE.Vector3());
        geometry.center();
        const scale = 1.3 / Math.max(size.x, size.y, size.z, .001);
        geometry.scale(scale, scale, scale);
        model = new THREE.Mesh(geometry, material);
        edges = new THREE.EdgesGeometry(geometry, item.shape.startsWith("facetedBall") ? 1 : 25);
        model.add(new THREE.LineSegments(edges, edgeMaterial));
        previewScene.add(model);
        previewRenderer.render(previewScene, previewCamera);
        item.image.src = previewRenderer.domElement.toDataURL("image/png");
        item.image.hidden = false;
      }
    } catch (error) {
      console.warn("Mesh thumbnail unavailable: " + item.shape, error);
    } finally {
      if (model) previewScene.remove(model);
      geometry?.dispose(); edges?.dispose();
    }
    schedule(next);
  }
  schedule(() => {
    try {
      previewRenderer = new THREE.WebGLRenderer({alpha: true, antialias: true, preserveDrawingBuffer: true});
      previewRenderer.setPixelRatio(1);
      previewRenderer.setSize(224, 160, false);
      previewRenderer.setClearColor(0x000000, 0);
      previewScene = new THREE.Scene();
      previewCamera = new THREE.OrthographicCamera(-1.3, 1.3, .93, -.93, .1, 20);
      previewCamera.position.set(2.6, 1.9, 3.2);
      previewCamera.lookAt(0, 0, 0);
      previewScene.add(new THREE.HemisphereLight(0xe2fff6, 0x34404a, 2));
      const key = new THREE.DirectionalLight(0xffffff, 3);
      key.position.set(-3, 5, 4); previewScene.add(key);
      material = new THREE.MeshStandardMaterial({color: 0x6ebdac, roughness: .7, metalness: .05, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1});
      edgeMaterial = new THREE.LineBasicMaterial({color: 0x173c39, transparent: true, opacity: .65});
      next();
    } catch (error) {
      release();
      console.warn("Mesh previews unavailable; text buttons remain usable.", error);
    }
  });
}
initializeMeshButtonPreviews();

document.querySelectorAll("[data-add]").forEach(btn => {
  btn.addEventListener("click", () => addObject({ shape: btn.dataset.add }, { select: true }));
});

document.querySelectorAll("[data-mode]").forEach(btn => {
  btn.addEventListener("click", () => {
    setTransformMode(btn.dataset.mode);
  });
});
document.querySelectorAll("[data-flip-axis]").forEach(btn => {
  btn.addEventListener("click", () => flipSelectedParts(btn.dataset.flipAxis, {
    fromCenter: !!els.flipFromCenterInput?.checked
  }));
});
els.flipFromCenterInput?.addEventListener("change", updateState);
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
initializeWorkspaceTools();
els.addRootBoneBtn?.addEventListener("click", () => addRigBone(false));
els.addChildBoneBtn?.addEventListener("click", () => addRigBone(true));
els.deleteBoneBtn?.addEventListener("click", deleteSelectedBone);
els.exportBoneRigBtn?.addEventListener("click", exportReusableBoneRig);
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
els.boneModeMoveBtn?.addEventListener("click", () => setRigTargetTransformMode("translate"));
els.boneModeRotateBtn?.addEventListener("click", () => setRigTargetTransformMode("rotate"));
els.boneModeScaleBtn?.addEventListener("click", () => setRigTargetTransformMode("scale"));
els.boneRotationStepInput?.addEventListener("input", syncBoneRotationSnap);
els.boneRotationStepInput?.addEventListener("change", event => {
  event.target.value = String(normalizedBoneRotationStep(event.target.value));
  syncBoneRotationSnap();
});
els.glueBoneBtn?.addEventListener("click", () => toggleGlueBones());
els.addGripHandsBtn?.addEventListener("click", addGripHandRig);
els.armorMountBtn?.addEventListener("click", toggleSelectedArmorMount);
els.markSkinBtn?.addEventListener("click", () => markCheckedRigRole("skin"));
els.markArmorBtn?.addEventListener("click", () => markCheckedRigRole("armor"));
els.attachArmorBtn?.addEventListener("click", attachCheckedArmorToSelectedBone);
els.selectTargetBoneBtn?.addEventListener("click", () => setRigSelectionTarget("bone"));
els.selectTargetSkinBtn?.addEventListener("click", () => setRigSelectionTarget("skin"));
els.selectTargetArmorBtn?.addEventListener("click", () => setRigSelectionTarget("armor"));
els.modelSelectTargetAllBtn?.addEventListener("click", () => setModelingSelectionTarget("all"));
els.modelSelectTargetSkinBtn?.addEventListener("click", () => setModelingSelectionTarget("skin"));
els.modelSelectTargetArmorBtn?.addEventListener("click", () => setModelingSelectionTarget("armor"));
els.modelSelectTargetBoneBtn?.addEventListener("click", () => setModelingSelectionTarget("bone"));
els.selectionHighlightToggleBtn?.addEventListener("click", () => setSelectionHighlightVisible(!selectionHighlightVisible));
setSelectionHighlightVisible(selectionHighlightVisible, { silent: true });
// boneList is now a row-based list; selection happens per-row in syncBonePanel.
[els.boneNameInput, els.boneParentSelect, els.bonePosX, els.bonePosY, els.bonePosZ, els.boneRotX, els.boneRotY, els.boneRotZ].forEach(control => {
  control?.addEventListener("change", applyBonePanelValues);
});
els.showBonesInput?.addEventListener("change", rebuildBoneVisuals);
els.boneGuideScaleInput?.addEventListener("input", event => setBoneGuideScale(event.target.value));
els.mirrorBoneEditsInput?.addEventListener("change", event => {
  mirrorBoneEdits = event.target.checked;
  if (typeof updateSurfaceTransformGuides === "function") updateSurfaceTransformGuides();
});
els.rigModelOpacityInput?.addEventListener("input", event => setRigModelOpacity(event.target.value, { fromRangeInput: true }));
frontBoneCanvas.addEventListener("pointerdown", event => {
  if (!beginReferenceViewPan(event, "front", frontBoneCanvas, frontBoneCamera)) beginBoneDrag(event, "front", frontBoneCanvas, frontBoneCamera);
});
sideBoneCanvas.addEventListener("pointerdown", event => {
  if (!beginReferenceViewPan(event, "side", sideBoneCanvas, sideBoneCamera)) beginBoneDrag(event, "side", sideBoneCanvas, sideBoneCamera);
});
frontBoneCanvas.addEventListener("pointermove", event => { if (!moveReferenceViewPan(event)) moveBoneDrag(event); });
sideBoneCanvas.addEventListener("pointermove", event => { if (!moveReferenceViewPan(event)) moveBoneDrag(event); });
frontBoneCanvas.addEventListener("pointerup", event => { if (!endReferenceViewPan(event)) endBoneDrag(event); });
sideBoneCanvas.addEventListener("pointerup", event => { if (!endReferenceViewPan(event)) endBoneDrag(event); });
frontBoneCanvas.addEventListener("pointercancel", event => { if (!endReferenceViewPan(event)) endBoneDrag(event); });
sideBoneCanvas.addEventListener("pointercancel", event => { if (!endReferenceViewPan(event)) endBoneDrag(event); });
els.frontReferencePanBtn?.addEventListener("click", () => toggleReferenceViewPan("front"));
els.sideReferencePanBtn?.addEventListener("click", () => toggleReferenceViewPan("side"));
els.frontReferenceFollowBtn?.addEventListener("click", () => toggleReferenceViewFollow("front"));
els.sideReferenceFollowBtn?.addEventListener("click", () => toggleReferenceViewFollow("side"));
els.frontReferenceFitBtn?.addEventListener("click", () => fitBoneCamera(frontBoneCamera, frontBoneCanvas, "front"));
els.sideReferenceFitBtn?.addEventListener("click", () => fitBoneCamera(sideBoneCamera, sideBoneCanvas, "side"));
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
els.animationSelectPlayheadKeysBtn?.addEventListener("click", event => selectAllAnimationKeysAtCurrentFrame({ add: event.ctrlKey || event.metaKey }));
els.animationKeyBtn?.addEventListener("click", keyAnimationPose);
els.animationDeleteSelectedKeyBtn?.addEventListener("click", deleteSelectedAnimationKeys);
els.animationDeleteFrameBtn?.addEventListener("click", deleteAnimationFrameKeys);
els.animationClearBtn?.addEventListener("click", () => {
  if (animationHasKeys()) recordBoneHistory("clear entire animation clip");
  restoreAnimationBindPose();
  animationState.keys = {};
  syncActiveAnimationClip();
  animationState.frame = 0;
  animationState.playing = false;
  animationKeySelection.clear();
  animationKeySelectionAnchor = null;
  updateAnimationPanel();
  log("Cleared every key in the current animation clip. Undo is ready.");
});
els.animationExportBtn?.addEventListener("click", exportAnimationJson);
els.animationNodeSaveFrameBtn?.addEventListener("click", keySelectedBonePoseAtCurrentFrame);
els.animationKeyCopyBtn?.addEventListener("click", copySelectedAnimationKeys);
els.animationKeyPasteBtn?.addEventListener("click", () => pasteCopiedAnimationKeys({ mirrored: false }));
els.animationKeyPasteMirroredBtn?.addEventListener("click", () => pasteCopiedAnimationKeys({ mirrored: true }));
function bindAnimationNodeExactInput(input, kind) {
  input?.addEventListener("change", () => applyAnimationNodeExactValues(kind));
  input?.addEventListener("keydown", event => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    applyAnimationNodeExactValues(kind);
  });
}
for (const input of [els.animationNodePosX, els.animationNodePosY, els.animationNodePosZ]) bindAnimationNodeExactInput(input, "position");
for (const input of [els.animationNodeRotX, els.animationNodeRotY, els.animationNodeRotZ]) bindAnimationNodeExactInput(input, "rotation");
els.animationNodeBoneSelect?.addEventListener("change", event => selectAnimationNodeBone(event.target.value));
els.animationNodeShowMovementBtn?.addEventListener("click", showAnimationNodeMovementTool);
els.animationNodeShowRotationBtn?.addEventListener("click", showAnimationNodeRotationTool);
els.animationSheetExportBtn?.addEventListener("click", async () => saveAnimationMotionSheets({
  view: els.animationSheetViewSelect?.value || "left",
  frameCount: Number(els.animationSheetFramesInput?.value) || 8,
  range: els.animationExportRangeSelect?.value || "end",
  includeBones: !!els.animationExportBonesInput?.checked
}));
els.animationDetailCameraSelect?.addEventListener("change", event => selectAnimationDetailCamera(event.target.value));
els.animationDetailCameraAddBtn?.addEventListener("click", addAnimationDetailCameraView);
els.animationDetailCameraViewBtn?.addEventListener("click", () => activateCustomCameraView(els.animationDetailCameraSelect?.value));
els.animationDetailCameraUpdateBtn?.addEventListener("click", () => {
  selectAnimationDetailCamera(els.animationDetailCameraSelect?.value);
  updateCustomCameraFromCurrentView();
});
els.animationDetailWidthInput?.addEventListener("change", updateAnimationDetailCameraSize);
els.animationDetailHeightInput?.addEventListener("change", updateAnimationDetailCameraSize);
els.animationDetailSheetExportBtn?.addEventListener("click", async () => {
  updateAnimationDetailCameraSize();
  await saveAnimationDetailMotionSheet({
    cameraId: els.animationDetailCameraSelect?.value,
    frameCount: Number(els.animationSheetFramesInput?.value) || 8,
    range: els.animationExportRangeSelect?.value || "end",
    includeBones: !!els.animationExportBonesInput?.checked
  });
});
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
els.combineShellBtn?.addEventListener("click", async () => combineCheckedMeshesIntoShell());
els.pivotBtn.addEventListener("click", () => setPivotEditMode(!pivotEditMode));
els.centerPivotBtn.addEventListener("click", centerSharedPivot);
document.querySelector("#facePickBtn").addEventListener("click", toggleClassicTriangleSelection);
els.faceRegionBtn.addEventListener("click", toggleClassicFaceSelection);
els.selectConnectedBtn?.addEventListener("click", () => setConnectedTrianglePickMode(!connectedTrianglePickMode));
els.selectWheelBtn?.addEventListener("click", () => setWheelTrianglePickMode(!wheelTrianglePickMode));
els.wheelRadiusSmallerBtn?.addEventListener("click", () => resizeWheelSelectionVolume("radius", .9));
els.wheelRadiusLargerBtn?.addEventListener("click", () => resizeWheelSelectionVolume("radius", 1.1));
els.wheelWidthNarrowerBtn?.addEventListener("click", () => resizeWheelSelectionVolume("width", .9));
els.wheelWidthWiderBtn?.addEventListener("click", () => resizeWheelSelectionVolume("width", 1.1));
els.applyWheelVolumeBtn?.addEventListener("click", applyWheelSelectionVolume);
els.cancelWheelVolumeBtn?.addEventListener("click", () => cancelWheelSelectionVolume());
els.selectInsideBoundaryBtn?.addEventListener("click", () => selectTrianglesInsideBoundary({ extract: false }));
els.extractInsideBoundaryBtn?.addEventListener("click", () => selectTrianglesInsideBoundary({ extract: true }));
els.openingPickBtn?.addEventListener("click", () => setOpeningPickMode(!openingPickMode));
els.lineToolBtn.addEventListener("click", () => setLineSketchMode(!lineSketchMode));
els.vertexLineToolBtn?.addEventListener("click", () => setVertexLineMode(!vertexLineMode));
els.triangleBuildBtn?.addEventListener("click", () => setTriangleBuildMode(!triangleBuildMode));
els.clearTriangleBuildBtn?.addEventListener("click", () => clearTriangleBuild({ keepMode: triangleBuildMode }));
els.closeLineBtn.addEventListener("click", closeLineSketch);
els.makeFaceBtn.addEventListener("click", createFaceFromLineSketch);
els.fillLineBtn.addEventListener("click", fillLineSketch);
els.cutHoleSketchBtn.addEventListener("click", cutHoleFromLineSketch);
els.keyholeCutterBtn?.addEventListener("click", toggleKeyholeCutterSession);
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
els.pasteMirroredTriBtn?.addEventListener("click", pasteCopiedTrianglesMirrored);
els.paintTriInput.addEventListener("change", () => {
  if (els.paintTriInput.checked) connectedTrianglePickMode = false;
  if (els.paintTriInput.checked) {
    releaseSurfaceInteractionForClassicSelection();
    if (surfaceComponentMode !== "triangle" || !facePickMode || coplanarFacePickMode) {
      clearSelectedSurfaceComponents();
      surfaceComponentMode = "triangle";
      surfaceSelectionSource = "classic";
      coplanarFacePickMode = false;
      setFacePickMode(true);
    }
    els.areaTriInput.checked = false;
    coplanarFacePickMode = false;
  }
  if (facePickMode) setFacePickMode(true);
  else updateFacePickHud();
});
els.paintTriBtn?.addEventListener("click", () => {
  els.paintTriInput.checked = !els.paintTriInput.checked;
  els.paintTriInput.dispatchEvent(new Event("change", { bubbles: true }));
});
els.areaTriBtn.addEventListener("click", () => {
  els.areaTriInput.checked = !els.areaTriInput.checked;
  if (els.areaTriInput.checked) {
    connectedTrianglePickMode = false;
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
els.alignModelFaceBtn?.addEventListener("click", toggleAlignModelFaceSession);
document.querySelector("#pushFaceBtn").addEventListener("click", pushSelectedFaces);
els.softPullBtn?.addEventListener("click", () => softMoveSelectedFaces(1));
els.softPushBtn?.addEventListener("click", () => softMoveSelectedFaces(-1));
els.dragPushBtn.addEventListener("click", () => setSurfaceGizmoMode("translate", { toggle: true }));
els.surfaceEditorOpenBtn?.addEventListener("click", () => setSurfaceEditorOpen(true));
els.surfaceEditorCloseBtn?.addEventListener("click", () => requestAnimationFrame(() => {
  syncSurfaceEditorUi();
  updateSurfaceGizmoAttachment();
  updateModelingEdgesOverlay();
}));
els.surfaceSelectTriangleBtn?.addEventListener("click", () => setSurfaceSelectionMode("triangle"));
els.surfaceSelectFaceBtn?.addEventListener("click", () => setSurfaceSelectionMode("face"));
els.surfaceSelectVertexBtn?.addEventListener("click", () => setSurfaceSelectionMode("vertex"));
els.connectVerticesBtn?.addEventListener("click", handleConnectVerticesButton);
els.surfaceSelectEdgeBtn?.addEventListener("click", () => setSurfaceSelectionMode("edge"));
els.surfaceMouseModeBtn?.addEventListener("click", toggleSurfaceMouseMode);
els.surfaceValueModeBtn?.addEventListener("click", toggleSurfaceValueMode);
els.surfaceTransformModelBtn?.addEventListener("click", () => setSurfaceTransformTarget("model"));
els.surfaceTransformSelectionBtn?.addEventListener("click", () => setSurfaceTransformTarget("selection"));
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
  if (input === els.dragPushAxisSelect) syncSurfaceAxisUi();
  updateSurfaceGizmoAttachment();
  if (!dragPushMode) return;
  const shape = els.surfaceMouseFalloffSelect?.value === "soft"
    ? `soft falloff radius ${round(Math.max(.01, Number(els.softRadiusInput?.value) || .25))}`
    : "hard face";
  els.hudText.textContent = `Surface drag ready: ${shape} along ${dragPushAxisLabel()} in snapped ${dragPushStepSize()} steps`;
}));
els.dragPushAxisSelect?.addEventListener("change", () => {
  syncSurfaceAxisUi();
  updateSurfaceGizmoAttachment();
});
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
els.planeCutAxisSelect?.addEventListener("change", refreshPlaneCutPreview);
els.planeCutPositionInput?.addEventListener("input", refreshPlaneCutPreview);
els.planeCutResultSelect?.addEventListener("change", refreshPlaneCutPreview);
els.planeCutCapInput?.addEventListener("change", refreshPlaneCutPreview);
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
els.repairLodMeshBtn?.addEventListener("click", repairSelectedMeshForLod);
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
  els.addColorToSceneBtn.textContent = "Mesh Color Applied";
});
function applySolidColorToMeshes(meshes, color) {
  const targets = uniqueMeshList(meshes);
  if (!targets.length) return 0;
  recordHistory(targets.length > 1 ? "color meshes" : "color mesh");
  for (const mesh of targets) {
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      material?.color?.set(color);
      if (material) material.needsUpdate = true;
    }
    mesh.userData.color = color;
    mesh.userData.colorApplied = true;
  }
  updateAll();
  return targets.length;
}
els.modelToolsMeshColorInput?.addEventListener("input", () => {
  if (els.modelToolsMeshColorHexInput) els.modelToolsMeshColorHexInput.value = els.modelToolsMeshColorInput.value.toUpperCase();
});
els.modelToolsMeshColorHexInput?.addEventListener("input", () => {
  const normalized = normalizeHexColor(els.modelToolsMeshColorHexInput.value, null);
  if (normalized && els.modelToolsMeshColorInput) els.modelToolsMeshColorInput.value = normalized;
});
els.modelToolsApplyMeshColorBtn?.addEventListener("click", () => {
  const color = normalizeHexColor(els.modelToolsMeshColorHexInput?.value || els.modelToolsMeshColorInput?.value, null);
  const targets = resolveSelectionTargets("meshes");
  if (!color || !targets.length) {
    if (els.modelToolsMeshColorStatus) els.modelToolsMeshColorStatus.textContent = "Select a mesh, or check several parts in the model list.";
    return;
  }
  const count = applySolidColorToMeshes(targets, color);
  if (els.colorInput) els.colorInput.value = color;
  if (els.colorHexInput) els.colorHexInput.value = color.toUpperCase();
  if (els.modelToolsMeshColorStatus) els.modelToolsMeshColorStatus.textContent = `Applied ${color.toUpperCase()} to ${count} mesh${count === 1 ? "" : "es"}.`;
});
function paintSelectedFacesSolidColor(color) {
  if (!selectedFaces.length) return 0;
  const facesByMesh = new Map();
  for (const face of selectedFaces) {
    if (!facesByMesh.has(face.mesh)) facesByMesh.set(face.mesh, []);
    facesByMesh.get(face.mesh).push(face);
  }
  recordHistory("paint selected faces");
  const paintColor = new THREE.Color(color);
  let painted = 0;
  for (const [mesh, faces] of facesByMesh) {
    const original = mesh.geometry;
    const geometry = original.index ? original.toNonIndexed() : original.clone();
    const position = geometry.getAttribute("position");
    if (!position) continue;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const previousColors = geometry.getAttribute("color");
    const values = new Float32Array(position.count * 3);
    for (let vertex = 0; vertex < position.count; vertex++) {
      const triangleIndex = Math.floor(vertex / 3);
      const material = materials[materialIndexForTriangle(geometry, triangleIndex)] || materials[0];
      const base = material?.color || new THREE.Color("#ffffff");
      values[vertex * 3] = (previousColors?.getX(vertex) ?? 1) * base.r;
      values[vertex * 3 + 1] = (previousColors?.getY(vertex) ?? 1) * base.g;
      values[vertex * 3 + 2] = (previousColors?.getZ(vertex) ?? 1) * base.b;
    }
    const signatures = new Set(faces.map(face => triangleSignature(face.localTrianglePoints)));
    for (let offset = 0; offset < position.count; offset += 3) {
      const points = [0, 1, 2].map(index => new THREE.Vector3(
        position.getX(offset + index),
        position.getY(offset + index),
        position.getZ(offset + index)
      ));
      if (!signatures.has(triangleSignature(points))) continue;
      for (let vertex = offset; vertex < offset + 3; vertex++) {
        values[vertex * 3] = paintColor.r;
        values[vertex * 3 + 1] = paintColor.g;
        values[vertex * 3 + 2] = paintColor.b;
      }
      painted++;
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(values, 3));
    for (const material of materials) {
      if (!material) continue;
      material.color?.set("#ffffff");
      material.vertexColors = true;
      material.needsUpdate = true;
    }
    replaceEditableMeshGeometry(mesh, geometry);
    mesh.userData.color = "#ffffff";
    mesh.userData.colorApplied = true;
  }
  updateFaceMarker();
  updateAll();
  return painted;
}
els.modelToolsPaintFacesBtn?.addEventListener("click", () => {
  const color = normalizeHexColor(els.modelToolsMeshColorHexInput?.value || els.modelToolsMeshColorInput?.value, null);
  const count = color ? paintSelectedFacesSolidColor(color) : 0;
  if (els.modelToolsMeshColorStatus) els.modelToolsMeshColorStatus.textContent = count
    ? `Painted ${count} selected triangle${count === 1 ? "" : "s"} ${color.toUpperCase()}.`
    : "Choose Triangle or Whole Face in Surface Edit, select the area, then paint it here.";
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
  if (els.planeCutCapInput) els.planeCutCapInput.disabled = !!keyholeCutterSession || els.planeCutResultSelect.value === "both";
});
els.edgeSlideBtn?.addEventListener("click", slideSelectedEdges);
els.surfaceScaleBtn?.addEventListener("click", scaleSelectedSurface);
els.surfaceScaleGizmoBtn?.addEventListener("click", () => setSurfaceGizmoMode("scale", { toggle: true }));
els.surfaceRotateGizmoBtn?.addEventListener("click", () => setSurfaceGizmoMode("rotate", { toggle: true }));
els.surfaceScaleAllAxesBtn?.addEventListener("click", () => setSurfaceScaleAllAxes(!surfaceScaleAllAxes));
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
els.saveCurrentPngBtn?.addEventListener("click", async () => saveCurrentViewPng());
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

canvas.addEventListener("pointerleave", () => {
  if (triangleBuildMode) setTriangleBuildHover(null);
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

const saveProjectModal = document.querySelector("#saveProjectModal");
const saveProjectCloseBtn = document.querySelector("#saveProjectCloseBtn");
const saveProjectCancelBtn = document.querySelector("#saveProjectCancelBtn");
const saveProjectConfirmBtn = document.querySelector("#saveProjectConfirmBtn");
const saveProjectNameInput = document.querySelector("#saveProjectNameInput");
const saveProjectWarning = document.querySelector("#saveProjectWarning");

function formatEstimatedFileSize(bytes) {
  if (bytes < 1024) return `${Math.max(0, Math.round(bytes))} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = units[0];
  for (let index = 1; index < units.length && value >= 1024; index++) {
    value /= 1024;
    unit = units[index];
  }
  return `${value >= 100 ? value.toFixed(0) : value >= 10 ? value.toFixed(1) : value.toFixed(2)} ${unit}`;
}

function estimateEditableProjectSave() {
  let vertices = 0;
  let triangles = 0;
  let numericValues = 0;
  const textureUrls = new Set();
  for (const mesh of objects) {
    const geometry = mesh.geometry;
    const position = geometry?.getAttribute?.("position");
    const vertexCount = position?.count || 0;
    vertices += vertexCount;
    triangles += Math.floor((geometry?.index?.count || vertexCount) / 3);
    const stored = mesh.userData?.geometry;
    if (stored) {
      for (const key of ["positions", "normals", "colors", "uvs", "indices"]) numericValues += Array.isArray(stored[key]) || ArrayBuffer.isView(stored[key]) ? stored[key].length : 0;
    } else if (mesh.userData?.shape === "glb") {
      numericValues += vertexCount * (6 + (geometry?.getAttribute?.("uv") ? 2 : 0) + (geometry?.getAttribute?.("color") ? 3 : 0));
    }
    for (const key of ["textureUrl", "roughnessTextureUrl", "metalnessTextureUrl", "normalTextureUrl", "emissiveTextureUrl"]) {
      const url = mesh.userData?.[key];
      if (typeof url === "string" && url.startsWith("data:")) textureUrls.add(url);
    }
  }
  const textureBytes = [...textureUrls].reduce((sum, value) => sum + value.length, 0);
  const estimatedBytes = 24000 + objects.length * 1400 + numericValues * 12 + textureBytes;
  return { objects: objects.length, vertices, triangles, estimatedBytes };
}

function setSaveProjectModalOpen(open) {
  if (!saveProjectModal) return;
  document.body.classList.toggle("save-project-open", open);
  saveProjectModal.classList.toggle("open", open);
  saveProjectModal.setAttribute("aria-hidden", String(!open));
  if (!open) return void els.saveProjectBtn?.focus();
  const estimate = estimateEditableProjectSave();
  saveProjectNameInput.value = `${currentProjectBaseName()}.modelerproj`;
  document.querySelector("#saveProjectObjectCount").textContent = estimate.objects.toLocaleString();
  document.querySelector("#saveProjectVertexCount").textContent = estimate.vertices.toLocaleString();
  document.querySelector("#saveProjectTriangleCount").textContent = estimate.triangles.toLocaleString();
  document.querySelector("#saveProjectEstimatedSize").textContent = `About ${formatEstimatedFileSize(estimate.estimatedBytes)}`;
  const heavy = estimate.triangles >= 1000000 || estimate.estimatedBytes >= 200 * 1024 * 1024;
  saveProjectWarning.hidden = !heavy;
  saveProjectWarning.textContent = heavy
    ? "Large project warning: preparing this editable file may require substantial memory and could overwhelm the browser. Consider reducing geometry or saving smaller sections first."
    : "";
  saveProjectModal.dataset.estimatedBytes = String(estimate.estimatedBytes);
  saveProjectNameInput.focus();
  saveProjectNameInput.select();
}

function safeProjectFileName(value) {
  const base = String(value || currentProjectBaseName()).trim().replace(/[<>:\"/\\|?*\u0000-\u001f]/g, "-") || "modeler-project";
  return base.toLowerCase().endsWith(".modelerproj") ? base : `${base}.modelerproj`;
}

async function saveEditableProjectFromDialog() {
  const fileName = safeProjectFileName(saveProjectNameInput.value);
  const estimatedBytes = Number(saveProjectModal.dataset.estimatedBytes) || 0;
  if (estimatedBytes >= 750 * 1024 * 1024 && !window.confirm("This project is estimated above 750 MB and may crash this browser while being prepared. Try saving anyway?")) return;
  let fileHandle = null;
  try {
    if (typeof window.showSaveFilePicker === "function") {
      fileHandle = await window.showSaveFilePicker({
        suggestedName: fileName,
        types: [{ description: "BoltWorks editable project", accept: { "application/json": [".modelerproj"] } }]
      });
    }
  } catch (error) {
    if (error?.name === "AbortError") return;
  }
  saveProjectConfirmBtn.disabled = true;
  saveProjectConfirmBtn.textContent = "Preparing project…";
  try {
    const text = createProjectJsonBlob(projectState());
    if (fileHandle) {
      const writable = await fileHandle.createWritable();
      await writable.write(text);
      await writable.close();
    } else download(fileName, text, "application/json");
    setSaveProjectModalOpen(false);
    log("Saved full project file.", { project: fileName, size: formatEstimatedFileSize(text.length), objects: objects.length, checked: checkedIds.size });
  } catch (error) {
    saveProjectWarning.hidden = false;
    saveProjectWarning.textContent = `The project could not be saved: ${error?.message || "the browser ran out of available resources"}`;
  } finally {
    saveProjectConfirmBtn.disabled = false;
    saveProjectConfirmBtn.textContent = "Choose Save Location";
  }
}

els.saveProjectBtn.addEventListener("click", () => setSaveProjectModalOpen(true));
saveProjectCloseBtn?.addEventListener("click", () => setSaveProjectModalOpen(false));
saveProjectCancelBtn?.addEventListener("click", () => setSaveProjectModalOpen(false));
saveProjectConfirmBtn?.addEventListener("click", saveEditableProjectFromDialog);
saveProjectModal?.addEventListener("click", event => {
  if (event.target === saveProjectModal) setSaveProjectModalOpen(false);
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && saveProjectModal?.classList.contains("open")) setSaveProjectModalOpen(false);
});
els.newWorkspaceBtn?.addEventListener("click", async () => {
  const hasWork = objects.length > 0;
  if (hasWork && !window.confirm("Start an empty workspace? The last automatic save will be kept for Recover last save. New work will replace it when auto-saved. Download Save Project first if you need a permanent copy.")) return;
  els.newWorkspaceBtn.disabled = true;
  bwsStartingNewWorkspace = true;
  try {
    if (bwsAutoSaveTimer) clearTimeout(bwsAutoSaveTimer);
    bwsAutoSaveTimer = null;
    localStorage.setItem(BWS_RECOVERY_MANUAL_KEY, "1");
    bwsWorkspaceGeneration += 1;
    setBwsAutoSaveStatus("Clearing workspace...");
    await new Promise(resolve => setTimeout(resolve, 0));
    if (gameplayPreviewVisible()) closeGameplayPreview();
    clearObjects({ record: false });
    setCurrentSceneAsHistoryBaseline();
    resetRigForNewWorkspace();
    if (typeof resetGeometryNodeProjectState === "function") resetGeometryNodeProjectState();
    if (els.projectNameInput) els.projectNameInput.value = "modeler-project";
    setBwsAutoSaveStatus("Fresh workspace", "saved");
    log("New empty workspace started. Recover last save can restore the previous automatic save; Delete last save removes it. New work replaces it when auto-saved.");
  } catch (error) {
    console.warn("Could not start a fresh workspace", error);
    setBwsAutoSaveStatus("Could not start fresh workspace", "problem");
    log(`Could not start a new workspace: ${error?.message || "cleanup failed"}.`);
  } finally {
    bwsStartingNewWorkspace = false;
    els.newWorkspaceBtn.disabled = false;
  }
});
document.querySelector("#reloadLastSaveBtn")?.addEventListener("click", async () => {
  if (objects.length && !window.confirm("Replace this workspace with the last automatic save? Download Save Project first to keep any current unsaved work.")) return;
  bwsStartingNewWorkspace = true;
  try {
    if (bwsAutoSaveTimer) clearTimeout(bwsAutoSaveTimer);
    bwsAutoSaveTimer = null;
    await bwsAutoSavePromise.catch(() => false);
    if (!(await restoreAutoSavedProjectIfBlank(true))) log("No automatic recovery save is available to reload.");
  } finally {
    bwsStartingNewWorkspace = false;
  }
});
document.querySelector("#deleteLastSaveBtn")?.addEventListener("click", async () => {
  if (!window.confirm("Delete the last automatic recovery save? Downloaded project files and the open model will not be deleted. Future edits can create a new automatic save.")) return;
  bwsStartingNewWorkspace = true;
  try {
    await clearBwsRecoveryRecord();
    setBwsAutoSaveStatus("Last recovery save deleted", "saved");
    log("Deleted the automatic recovery copy from both browser stores. This cannot be undone; downloaded project files are unchanged.");
  } catch (error) {
    setBwsAutoSaveStatus("Could not delete recovery save", "problem");
    console.warn("Could not delete recovery save", error);
  } finally {
    bwsStartingNewWorkspace = false;
  }
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
document.querySelector("#exportGlbBtn")?.addEventListener("click", () => exportFullModelGltf({ binary: true }));
document.querySelector("#exportGltfBtn")?.addEventListener("click", () => exportFullModelGltf({ binary: false }));
els.importGlbBtn?.addEventListener("click", () => els.importGlbFile?.click());
els.importGlbFile?.addEventListener("change", async event => {
  const file = event.target.files?.[0];
  await importFullModelGltf(file);
  event.target.value = "";
});
els.importGltfBtn?.addEventListener("click", () => els.importGltfFile?.click());
els.importGltfFile?.addEventListener("change", async event => {
  const file = event.target.files?.[0];
  await importFullModelGltf(file);
  event.target.value = "";
});
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
els.textureStencilBtn?.addEventListener("click", openTextureStencilEditor);
els.modelToolsStencilBtn?.addEventListener("click", openTextureStencilEditor);
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
els.textureEditorChooseStencilBtn?.addEventListener("click", () => els.textureEditorStencilFile?.click());
els.textureEditorStencilFile?.addEventListener("change", event => {
  loadTextureEditorStencilFile(event.target.files?.[0]);
  event.target.value = "";
});
[els.textureEditorStencilScale, els.textureEditorStencilRotation, els.textureEditorStencilOpacity, els.textureEditorStencilUseColors].forEach(input => input?.addEventListener("input", () => {
  syncTextureEditorStencilUi();
  renderTextureEditor();
}));
els.textureEditorStampStencilBtn?.addEventListener("click", stampTextureEditorStencil);
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
els.meshDetailsUniqueBtn?.addEventListener("click", () => makeMeshUnique());
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
  if (textureEditorState.tool === "stencil") {
    textureEditorState.stencilCenter = point;
    syncTextureEditorStencilUi();
    renderTextureEditor();
    return;
  }
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
  if (input === els.cutAmountInput || input === els.textureFile || input === els.shadowFillInput || input === els.fourSideLightsInput) return;
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

els.shadowFillInput?.addEventListener("input", () => {
  syncShadowFill();
  updateState();
});
els.fourSideLightsInput?.addEventListener("change", () => {
  syncShadowFill();
  updateState();
  log(`Four-side workspace lights ${els.fourSideLightsInput.checked ? "enabled" : "disabled"}.`);
});

function pointerInsideMainCanvas(event) {
  const rect = canvas.getBoundingClientRect();
  return event.clientX >= rect.left && event.clientX <= rect.right
    && event.clientY >= rect.top && event.clientY <= rect.bottom;
}

function prioritizeUnselectedSurfaceTriangle(event) {
  if (!pointerInsideMainCanvas(event)) return;
  if (event.type === "pointerdown" && alignModelFaceSession && facePickMode) {
    const alignHit = hitFromPointerEvent(event);
    if (alignHit?.face) {
      event.preventDefault();
      event.stopImmediatePropagation();
      alignModelFaceToHit(alignHit);
      return;
    }
  }
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
    if (connectVerticesMode) {
      pickConnectVertexTargetFromHit(hit);
      return;
    }
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
  if (event.button !== 0 || transform.dragging || surfaceTransform.dragging || boneTransform.dragging || poseStraightenerTransform.dragging) return;
  if ((transform.visible && transform.axis) || (surfaceTransform.visible && surfaceTransform.axis) || (boneTransform.visible && boneTransform.axis) || (poseStraightenerTransform.visible && poseStraightenerTransform.axis)) {
    pendingScenePick = null;
    return;
  }
  if (spaceCameraMode) return;
  pendingScenePick = null;
  if (typeof poseStraightenerSelectJointFromEvent === "function" && poseStraightenerSelectJointFromEvent(event)) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }
  if (typeof poseStraightenerAddPointFromEvent === "function" && poseStraightenerAddPointFromEvent(event)) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }
  if (knifeCutMode) {
    addKnifeCutPointFromHit(hitFromPointerEvent(event));
    return;
  }
  if (triangleBuildMode) {
    addTriangleBuildPointFromEvent(event);
    return;
  }
  if (vertexLineMode) {
    addVertexLinePointFromEvent(event);
    return;
  }
  if (lineSketchMode) {
    addLineSketchPointFromEvent(event);
    return;
  }
  const viewportSelectionTarget = activeViewportSelectionTarget();
  const hit = viewportTargetedObjectHit(event);
  if (alignModelFaceSession && hit?.face && alignModelFaceToHit(hit)) return;
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
  if (wheelTrianglePickMode && hit) {
    selectWheelTrianglesFromHit(hit, { append: additiveSelectionRequested(event) });
    return;
  }
  if (connectedTrianglePickMode && hit) {
    selectConnectedTrianglesFromHit(hit, { append: additiveSelectionRequested(event) });
    return;
  }
  if (connectVerticesMode && hit) {
    pickConnectVertexTargetFromHit(hit);
    return;
  }
  if (facePickMode && hit) {
    pickSurfaceComponentFromHit(hit, { append: additiveSelectionRequested(event) });
    return;
  }
  if (!facePickMode && viewportSelectionTarget === "bone") {
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
  if (triangleBuildMode && !spaceCameraMode) {
    const pick = triangleBuildPickFromEvent(event);
    setTriangleBuildHover(pick?.wrongMesh ? null : pick);
  }
  if (vertexLineMode && !spaceCameraMode) {
    const pick = vertexLinePickFromEvent(event);
    setVertexLineHover(pick?.wrongMesh ? null : pick);
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
  if (triangleBuildMode) {
    event.preventDefault();
    pendingScenePick = null;
    return;
  }
  if (vertexLineMode) {
    event.preventDefault();
    pendingScenePick = null;
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
  if (connectVerticesMode) {
    pickConnectVertexTargetFromHit(hit);
    return;
  }
  if (surfaceComponentMode === "vertex" || surfaceComponentMode === "edge") {
    pickSurfaceComponentFromHit(hit, { append: additiveSelectionRequested(event) });
  } else {
    selectConnectedTrianglesFromHit(hit, { append: additiveSelectionRequested(event) });
  }
});

// Session-local mesh clipboard: copying is a snapshot, not a reference to the original.
let bwsMeshClipboard = [];
let bwsClipboardKind = "triangles";
function copySelectedMeshes() {
  const targets = transformTargetObjects();
  const meshes = targets.length ? targets : selected ? [selected] : checkedObjects();
  if (!meshes.length) { log("Select a mesh to copy."); return; }
  try {
    const snapshot = meshes.map(mesh => {
      const spec = serializeObject(mesh);
      mesh.updateWorldMatrix(true, false);
      const position = new THREE.Vector3(), quaternion = new THREE.Quaternion(), scale = new THREE.Vector3();
      mesh.matrixWorld.decompose(position, quaternion, scale);
      const rotation = new THREE.Euler().setFromQuaternion(quaternion, "XYZ");
      spec.position = position.toArray();
      spec.rotation = [rotation.x, rotation.y, rotation.z].map(THREE.MathUtils.radToDeg);
      spec.scale = scale.toArray();
      delete spec.id;
      spec.name = mesh.name + " copy";
      spec.linkId = null; spec.linkColor = null;
      spec.groupId = null; spec.groupName = null;
      return spec;
    });
    bwsMeshClipboard = structuredClone(snapshot);
    bwsClipboardKind = "meshes";
    log("Copied " + snapshot.length + " mesh(es). Ctrl+V pastes in the original position.");
  } catch (error) { log("Could not copy meshes: " + error.message); }
}
function pasteCopiedMeshes() {
  if (!bwsMeshClipboard.length) { log("Copy a mesh first with Ctrl+C."); return; }
  const specs = structuredClone(bwsMeshClipboard);
  recordHistory("paste meshes");
  const copies = [];
  try {
    for (const spec of specs) copies.push(addObject(spec, {record: false, select: false, update: false}));
  } catch (error) { log("Paste interrupted: " + error.message + ". Undo removes any pasted parts."); }
  if (!copies.length) return;
  checkedIds.clear();
  activeGroupIds = copies.map(copy => copy.userData.id);
  selectedGroupRecordId = null;
  selected = copies.at(-1);
  currentTransformTargetKey = "";
  clearSelectedTriangles();
  updateAll();
  log("Pasted " + copies.length + " independent mesh(es) in place. Move to separate them; Ctrl+Z undoes the paste.");
}

window.addEventListener("keydown", event => {
  const editingText = event.target?.matches?.("input, textarea, select, [contenteditable='true']");
  if (gameplayPreviewVisible() && dicePhysicsPreview) {
    if(event.key==='Escape')closeGameplayPreview();
    else if(!event.target?.closest?.('input, textarea, select, [contenteditable]') && !event.ctrlKey && !event.metaKey && !event.altKey && ['Space','Enter','NumpadEnter'].includes(event.code)){event.preventDefault();if(!event.repeat){if(event.code==='Space')hitTableButton.click();else rollDicePhysics();}}
    return;
  }
  if (gameplayPreviewVisible()) {
    if (event.key === "Escape") {
      event.preventDefault();
      releaseGameplayControl();
      return;
    }
    if (!editingText && ["ControlLeft", "ControlRight"].includes(event.code)) {
      event.preventDefault();
      if (!event.repeat) updateGameplayArenaStatus("Crawl is disabled until its replacement animation is ready");
      return;
    }
    if (!editingText && event.code === "KeyC") {
      event.preventDefault();
      resetGameplayPreviewCamera();
      updateGameplayArenaStatus("Camera centered on the fitted head line");
      return;
    }
    if (!editingText && ["KeyW", "KeyA", "KeyS", "KeyD", "KeyF", "KeyB", "Space", "ShiftLeft", "ShiftRight"].includes(event.code)) {
      event.preventDefault();
      if (!gameplayCameraLocked) return;
      if (event.code === "Space" && !event.repeat) startGameplayJump();
      else if (["KeyF", "KeyB"].includes(event.code) && !event.repeat) updateGameplayArenaStatus(`${event.code === "KeyF" ? "F" : "B"} is reserved for a future spell animation`);
      gameplayKeys.add(event.code);
      return;
    }
  }
  if (event.key === "Shift") isShiftHeld = true;
  if (event.key === "Control" || event.key === "Meta") isCtrlHeld = true;
  syncBoneRotationSnap();
  updateScaleModifierMarkers();
  if (typeof updateSurfaceTransformGuides === "function") updateSurfaceTransformGuides();
  if (pullToTargetSession && event.key === "Escape") {
    event.preventDefault();
    setPullToTargetSession(false);
    log("Pull to Target cancelled.");
    return;
  }
  if (alignModelFaceSession && event.key === "Escape") {
    event.preventDefault();
    setAlignModelFaceSession(false);
    log("Align Model by Face cancelled.");
    return;
  }
  if (keyholeCutterSession && event.key === "Escape") {
    event.preventDefault();
    setKeyholeCutterSession(false);
    log("Keyhole Cutter cancelled. The saved cutter was cleared.");
    return;
  }
  if (connectVerticesMode && event.key === "Escape") {
    event.preventDefault();
    cancelConnectVertices("Connect Vertices cancelled. The source vertex remains selected.");
    return;
  }
  if (wheelTrianglePickMode && (wheelTrianglePickStart || wheelSelectionVolume) && event.key === "Escape") {
    event.preventDefault();
    cancelWheelSelectionVolume("Wheel selection cylinder cancelled. Click a wheel center to start again.");
    return;
  }
  if (knifeCutMode && event.key === "Escape") {
    event.preventDefault();
    if (knifeCutPoints.length) cancelKnifeCutStroke();
    else setKnifeCutMode(false);
    return;
  }
  if (triangleBuildMode && event.key === "Escape") {
    event.preventDefault();
    if (triangleBuildPoints.length) clearTriangleBuild({ keepMode: true });
    else setTriangleBuildMode(false);
    return;
  }
  if (vertexLineMode && event.key === "Escape") {
    event.preventDefault();
    if (vertexLinePoints.length) clearVertexLine({ keepMode: true });
    else setVertexLineMode(false);
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
  if ((event.ctrlKey || event.metaKey) && !event.altKey && ["c", "v"].includes(event.key.toLowerCase())) {
    if (event.defaultPrevented || event.target?.closest?.("input, textarea, select, [contenteditable], [role='textbox']") || textureEditorState.open || document.body.classList.contains("animator-workspace-active")) return;
    event.preventDefault();
    if (event.repeat) return;
    if (event.key.toLowerCase() === "c") {
      // Stale face selections must not override whole-mesh or group copying.
      if (facePickMode && selectedFaces.length && transformTargetObjects().length <= 1) {
        if (copySelectedTriangles()) bwsClipboardKind = "triangles";
      } else copySelectedMeshes();
    } else if (bwsClipboardKind === "meshes") pasteCopiedMeshes();
    else pasteCopiedTriangles();
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
  syncBoneRotationSnap();
  updateScaleModifierMarkers();
  if (typeof updateSurfaceTransformGuides === "function") updateSurfaceTransformGuides();
  if (event.code !== "Space") return;
  spaceCameraMode = false;
  if (facePickMode) {
    setFacePickMode(true);
  }
});
window.addEventListener("blur", () => {
  gameplayKeys.clear();
  gameplayMouseButtons.clear();
  stopGameplayUpperBodyAction();
  isShiftHeld = false;
  isCtrlHeld = false;
  syncBoneRotationSnap();
  updateScaleModifierMarkers();
  if (typeof updateSurfaceTransformGuides === "function") updateSurfaceTransformGuides();
  finishDragPushSession();
  finishScaleDragSession();
});
window.addEventListener("resize", () => {
  if (textureEditorState.open) renderTextureEditor();
});

els.workViewFrontBtn?.addEventListener("click", () => toggleOrthographicWorkView("front"));
els.workViewSideBtn?.addEventListener("click", () => toggleOrthographicWorkView("side"));
els.workViewTopBtn?.addEventListener("click", () => toggleOrthographicWorkView("top"));
els.frontReferenceWorkBtn?.addEventListener("click", () => setOrthographicWorkView("front"));
els.sideReferenceWorkBtn?.addEventListener("click", () => setOrthographicWorkView("side"));
els.workViewRestoreBtn?.addEventListener("click", restoreOrthographicWorkView);
els.gameplayPreviewOpenBtn?.addEventListener("click", openGameplayPreview);
els.gameplayPreviewPlayBtn?.addEventListener("click", playGameplayPreview);
els.gameplayPreviewPauseBtn?.addEventListener("click", pauseGameplayPreview);
els.gameplayPreviewResetBtn?.addEventListener("click", resetGameplayPreviewCamera);
els.gameplayPreviewCloseBtn?.addEventListener("click", closeGameplayPreview);
els.gameplayProjectilesInput?.addEventListener("change", () => {
  gameplayArenaProjectileClock = 0;
  if (!els.gameplayProjectilesInput.checked) {
    for (const projectile of gameplayArenaProjectiles) gameplayArenaGroup.remove(projectile);
    gameplayArenaProjectiles.length = 0;
  }
  updateGameplayArenaStatus(els.gameplayProjectilesInput.checked ? "Projectiles enabled" : "Projectiles disabled");
});
function syncGameplayStrideControls() {
  if (els.gameplayStrideScaleOutput) els.gameplayStrideScaleOutput.value = `${gameplayStrideScale().toFixed(2)}x`;
  if (els.gameplayStrideScaleInput) els.gameplayStrideScaleInput.disabled = !gameplayStrideSyncEnabled();
  updateGameplayArenaStatus(gameplayStrideSyncEnabled()
    ? `Ground speed matched to feet · Stride ${gameplayStrideScale().toFixed(2)}x`
    : "Manual preview movement speed");
}
function syncCombineShellToleranceOutput() {
  if (!els.combineShellToleranceInput || !els.combineShellToleranceOutput) return;
  els.combineShellToleranceOutput.value = Number(els.combineShellToleranceInput.value).toFixed(3);
}
syncCombineShellToleranceOutput();
els.combineShellToleranceInput?.addEventListener("input", syncCombineShellToleranceOutput);
els.gameplayStrideSyncInput?.addEventListener("change", syncGameplayStrideControls);
els.gameplayStrideScaleInput?.addEventListener("input", syncGameplayStrideControls);
syncGameplayStrideControls();
gameplayCanvas?.addEventListener("click", () => {
  if (bwsUsdUiActive || !gameplayPreviewVisible()) return;
  if(dicePhysicsPreview)return;
  if (gameplayPlaybackPaused) {
    updateGameplayArenaStatus("Paused — press Play before taking control");
    return;
  }
  // Once control is active this click belongs to combat. Clearing the key set
  // here used to release a held W whenever the player attacked.
  if (document.pointerLockElement === gameplayCanvas) return;
  gameplayKeys.clear();
  gameplayMouseButtons.clear();
  gameplayCameraLocked = true;
  syncGameplayFollowCamera();
  updateGameplayArenaStatus();
  gameplayCanvas.requestPointerLock?.();
});
gameplayCanvas?.addEventListener("mousedown", event => {
  if (!gameplayPreviewVisible() || document.pointerLockElement !== gameplayCanvas) return;
  event.preventDefault();
  gameplayMouseButtons.add(event.button);
  if (event.button === 0) startGameplayUpperBodyAction("slash", { held: true });
  if (event.button === 2) startGameplayUpperBodyAction("shieldBlock", { held: true });
});
window.addEventListener("mouseup", event => {
  gameplayMouseButtons.delete(event.button);
  if (event.button === 0 && ["slash", "thrust"].includes(gameplayUpperBodyAction?.kind)) releaseGameplayUpperBodyAction();
  if (event.button === 2) releaseGameplayUpperBodyAction("shieldBlock");
});
gameplayCanvas?.addEventListener("wheel", event => {
  if (!gameplayPreviewVisible()) return;
  if (dicePhysicsPreview) return;
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
  if (!gameplayPreviewVisible() || document.pointerLockElement !== gameplayCanvas || !gameplayCameraLocked) return;
  // Normal mouse movement steers in the same direction as the pointer. Holding
  // middle mouse instead orbits the camera independently around the centered
  // character, allowing front/side inspection without changing its facing.
  const horizontalDirection = els.gameplayInvertMouseXInput?.checked ? 1 : -1;
  const verticalDirection = els.gameplayInvertMouseYInput?.checked ? -1 : 1;
  if (gameplayMouseButtons.has(1)) gameplayCameraOrbitOffset += event.movementX * .0025 * horizontalDirection;
  else gameplayCharacterYaw += event.movementX * .0025 * horizontalDirection;
  gameplayPitch = THREE.MathUtils.clamp(
    gameplayPitch + event.movementY * .0018 * verticalDirection,
    THREE.MathUtils.degToRad(-45),
    THREE.MathUtils.degToRad(62)
  );
  syncGameplayFollowCamera();
  animationSetFrame(animationState.frame, { render: false, lightweightPanel: true });
});
document.addEventListener("pointerlockchange", () => {
  if (gameplayPreviewVisible() && document.pointerLockElement !== gameplayCanvas) {
    gameplayCameraLocked = false;
    gameplayKeys.clear();
    gameplayMouseButtons.clear();
    releaseGameplayUpperBodyAction();
    updateGameplayArenaStatus("Control released — click the player screen to reconnect");
  }
});

window.ModelerStudio = {
  state,
  diceDemoState: () => ({active:isDiceDemo(),frame:animationState.frame,clip:animationState.activeClipId,playing:animationState.playing,randomLoops:diceRandomTimeline,physics:dicePhysicsPreview?.snapshot() || null}),
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
  saveAnimationDetailMotionSheet,
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
  selectWheelTrianglesFromHit,
  resizeWheelSelectionVolume,
  applyWheelSelectionVolume,
  cancelWheelSelectionVolume,
  copySelectedTriangles,
  pasteCopiedTriangles,
  pasteCopiedTrianglesMirrored,
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
syncShadowFill();
syncSpotLightRig();
updateUndoButton();
renderCustomCameraViews();
selectObject(null);
frameSelected();
detectLocalHost().then(async localHost => {
  if(await window.BwsEditionBridge?.restore())return;
  const loaded = localHost ? await tryLoadPendingProjectFromHost() : false;
  const recovered = !loaded && typeof restoreAutoSavedProjectIfBlank === "function"
    ? await restoreAutoSavedProjectIfBlank()
    : false;
  log(loaded
    ? "Ready. Loaded project from the installed app host."
    : recovered
      ? "Ready. Restored the latest automatic recovery save."
    : localHost
      ? "Ready. Blank scene loaded from the local app host."
      : "Ready. Blank scene loaded.");
});
animate();

document.querySelector("#importFbxBtn")?.addEventListener("click", () => document.querySelector("#importFbxFile")?.click());
document.querySelector("#importFbxFile")?.addEventListener("change", async event => {
  const button = document.querySelector("#importFbxBtn");
  if (button?.disabled) return;
  if (button) button.disabled = true;
  try { await importFullModelFbx(event.target.files); }
  finally { event.target.value = ""; if (button) button.disabled = false; }
});
document.querySelector("#exportFbxBtn")?.addEventListener("click", exportFullModelFbx);

initializeUsdControls();

// Triangle Sculpt exposes a bounded, undoable triangle-edit API to the BWS UI
// and its separately paired MCP adapter.
let bwsSculptTargetId = null;
const bwsSculptViews = Object.freeze({
  front: ['x', 'y'], side: ['z', 'y'], top: ['x', 'z']
});
const bwsSculptClamp = (value, min, max) => Math.max(min, Math.min(max, value));
const bwsSculptTarget = id => objects.find(mesh => mesh?.userData?.id === id && mesh.geometry?.getAttribute('position')) || null;
function bwsSculptTriangles(mesh) {
  if (!mesh) throw new Error('Prepare a sculpt mesh first.');
  mesh.updateMatrixWorld(true);
  const geometry = mesh.geometry, position = geometry.getAttribute('position'), index = geometry.index;
  const count = Math.floor((index?.count ?? position.count) / 3), faces = [];
  for (let triangle = 0; triangle < count; triangle++) {
    const points = [0, 1, 2].map(corner => {
      const vertex = index ? index.getX(triangle * 3 + corner) : triangle * 3 + corner;
      return new THREE.Vector3(position.getX(vertex), position.getY(vertex), position.getZ(vertex));
    });
    faces.push(faceFromLocalTriangle(mesh, points, triangle));
  }
  return faces;
}
let bwsSculptToolPosition = null;
let bwsSculptToolRadius = 0.25;
let bwsSculptToolMode = 'triangle';
function bwsSculptSetTool(params = {}) {
  const raw = Array.isArray(params.center) ? params.center : [params.x, params.y, params.z];
  const center = raw.map(Number);
  const radius = Number(params.radius ?? bwsSculptToolRadius);
  const mode = params.mode ?? bwsSculptToolMode;
  if (center.length !== 3 || !center.every(Number.isFinite)) throw new Error('Tool center requires world-space X, Y, and Z coordinates.');
  if (!Number.isFinite(radius) || radius <= 0 || radius > 1000) throw new Error('Tool radius must be greater than 0 and at most 1000 model units.');
  if (!['triangle', 'vertex', 'edge', 'face'].includes(mode)) throw new Error('Tool mode must be triangle, vertex, edge, or face.');
  bwsSculptToolPosition = new THREE.Vector3(...center);
  bwsSculptToolRadius = radius;
  bwsSculptToolMode = mode;
  const panel = document.querySelector('#bws-sculpt-panel');
  if (panel) {
    ['X', 'Y', 'Z'].forEach((axis, index) => { const input = panel.querySelector(`[name="local${axis}"]`); if (input) input.value = String(round(center[index])); });
    const radiusInput = panel.querySelector('[name="localRadius"]'); if (radiusInput) radiusInput.value = String(radius);
    const modeInput = panel.querySelector('[name="localMode"]'); if (modeInput) modeInput.value = mode;
    bwsSculptUpdateToolOverlay(panel);
  }
  bwsSculptFocusPreviewOnTool();
  return { toolCenterWorld: center.map(value => round(value)), radius, mode };
}
function bwsSculptUpdateToolOverlay(panel) {
  const canvas = panel?.querySelector('#bws-sculpt-preview-canvas');
  const preview = bwsSculptPreview;
  const marker = canvas?.parentElement?.querySelector('.bws-sculpt-tool-marker');
  if (!canvas || !preview?.camera || !marker || !bwsSculptToolPosition) return;
  const rect = canvas.getBoundingClientRect(), host = marker.parentElement.getBoundingClientRect();
  const project = point => point.clone().project(preview.camera);
  const center = project(bwsSculptToolPosition);
  if (center.z < -1 || center.z > 1 || Math.abs(center.x) > 1.2 || Math.abs(center.y) > 1.2) { marker.hidden = true; return; }
  marker.hidden = false;
  const x = rect.left - host.left + (center.x + 1) * 0.5 * rect.width;
  const y = rect.top - host.top + (1 - center.y) * 0.5 * rect.height;
  const right = new THREE.Vector3().setFromMatrixColumn(preview.camera.matrixWorld, 0).normalize();
  const edge = project(bwsSculptToolPosition.clone().addScaledVector(right, bwsSculptToolRadius));
  const radiusPx = Math.max(5, Math.min(rect.width, Math.hypot((edge.x - center.x) * rect.width * 0.5, (edge.y - center.y) * rect.height * 0.5)));
  marker.style.left = `${x}px`; marker.style.top = `${y}px`;
  marker.querySelector('.bws-sculpt-tool-radius').style.width = `${radiusPx * 2}px`;
  marker.querySelector('.bws-sculpt-tool-radius').style.height = `${radiusPx * 2}px`;
}
function bwsSculptFocusPreviewOnTool() {
  const state = bwsSculptPreview, canvas = document.querySelector('#bws-sculpt-preview-canvas');
  if (!state || !canvas || !bwsSculptToolPosition) return;
  state.target.copy(bwsSculptToolPosition);
  state.radius = Math.max(0.01, bwsSculptToolRadius * 3);
  bwsSculptPreviewDraw();
}
function bwsSculptSetSelection(mesh, faces, mode = 'triangle') {
  if (!mesh || !faces.length) throw new Error('No triangles matched that sculpt selection.');
  selectObject(mesh);
  if (surfaceSelectionSource !== 'surface' || surfaceComponentMode !== mode) setSurfaceSelectionMode(mode);
  else clearSelectedTriangles();
  setFacePickMode(true);
  selectedFaces.length = 0;
  selectedFaces.push(...faces);
  selectedFace = selectedFaces.at(-1) || null;
  bwsSculptTargetId = mesh.userData.id;
  updateFaceMarker();
  syncSurfaceEditorUi();
  updateAll();
  bwsSculptRenderPreview();
  return bwsSculptState();
}
function bwsSculptProjection(faces, view) {
  const axes = bwsSculptViews[view];
  if (!axes) throw new Error('View must be front, side, or top.');
  const centroids = faces.map(face => face.point);
  const bounds = axes.map(axis => {
    let min = Infinity, max = -Infinity;
    for (const point of centroids) { min = Math.min(min, point[axis]); max = Math.max(max, point[axis]); }
    return { min, max };
  });
  return { axes, bounds, centroids };
}
function bwsSculptState() {
  const mesh = bwsSculptTarget(bwsSculptTargetId);
  if (!mesh) return { ready: false, message: 'Prepare checked parts to create a sculpt mesh.' };
  const faces = bwsSculptTriangles(mesh);
  const projection = Object.fromEntries(Object.keys(bwsSculptViews).map(view => {
    const { axes, bounds } = bwsSculptProjection(faces, view);
    return [view, { axes, bounds: bounds.map(range => ({ min: round(range.min), max: round(range.max) })) }];
  }));
  const selected = selectedFaces.filter(face => face.mesh === mesh);
  const selectedBounds = selected.length ? [0, 1, 2].map(axis => {
    let min = Infinity, max = -Infinity;
    for (const face of selected) for (const point of face.trianglePoints) { min = Math.min(min, point.getComponent(axis)); max = Math.max(max, point.getComponent(axis)); }
    return { min: round(min), max: round(max) };
  }) : null;
  const componentPoints = selectedSurfaceEdges.filter(edge => edge.mesh === mesh).flatMap(edge => [edge.localA, edge.localB].map(point => point.clone().applyMatrix4(mesh.matrixWorld)))
    .concat(selectedSurfaceVertices.filter(vertex => vertex.mesh === mesh).map(vertex => vertex.localPoint.clone().applyMatrix4(mesh.matrixWorld)));
  const selectionCenter = selected.length ? selected.reduce((sum, face) => sum.add(face.point), new THREE.Vector3()).multiplyScalar(1 / selected.length).toArray().map(value => round(value))
    : (componentPoints.length ? componentPoints.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / componentPoints.length).toArray().map(value => round(value)) : null);
  const anchor = surfaceGizmoPivot?.visible ? surfaceGizmoPivot.position.toArray().map(value => round(value)) : null;
  return { ready: true, targetId: mesh.userData.id, targetName: mesh.name, triangleCount: faces.length,
    selectedTriangles: selected.length, selectionCenter, selectedWorldBounds: selectedBounds, anchorWorldPosition: anchor,
    selectedEdges: selectedSurfaceEdges.filter(edge => edge.mesh === mesh).length,
    selectedVertices: selectedSurfaceVertices.filter(vertex => vertex.mesh === mesh).length,
    virtualTool: bwsSculptToolPosition ? { centerWorld: bwsSculptToolPosition.toArray().map(value => round(value)), radius: bwsSculptToolRadius, mode: bwsSculptToolMode } : null,
    selectionMode: surfaceComponentMode, projection };
}

function bwsSculptSelectLocal(params = {}) {
  const mesh = bwsSculptTarget(params.targetId || bwsSculptTargetId);
  const rawCenter = Array.isArray(params.center) ? params.center :
    (params.x !== undefined || params.y !== undefined || params.z !== undefined ? [params.x, params.y, params.z] : null);
  const center = rawCenter ? new THREE.Vector3(...rawCenter.map(Number)) : (bwsSculptToolPosition?.clone() || (surfaceGizmoPivot?.visible ? surfaceGizmoPivot.position.clone() : null));
  const radius = Number(params.radius ?? bwsSculptToolRadius);
  const mode = ['triangle', 'vertex', 'edge', 'face'].includes(params.mode ?? bwsSculptToolMode) ? (params.mode ?? bwsSculptToolMode) : 'triangle';
  const maxTriangles = Math.max(1, Math.min(10000, Math.round(Number(params.maxTriangles ?? 10000))));
  if (!center || !center.toArray().every(Number.isFinite)) throw new Error('Select a surface point to place the green gizmo, or provide a world-space center [x,y,z].');
  if (!Number.isFinite(radius) || radius <= 0 || radius > 1000) throw new Error('Local selection radius must be greater than 0 and at most 1000 model units.');
  const faces = bwsSculptTriangles(mesh);
  const candidates = faces.map(face => {
    const triangle = new THREE.Triangle(face.trianglePoints[0], face.trianglePoints[1], face.trianglePoints[2]);
    const nearest = triangle.closestPointToPoint(center, new THREE.Vector3());
    return { face, distance: nearest.distanceTo(center) };
  })
    .filter(item => item.distance <= radius).sort((a, b) => a.distance - b.distance).slice(0, maxTriangles).map(item => item.face);
  let state;
  if (mode === 'triangle' || mode === 'face') {
    state = bwsSculptSetSelection(mesh, candidates, mode);
  } else {
    if (surfaceSelectionSource !== 'surface' || surfaceComponentMode !== mode) setSurfaceSelectionMode(mode);
    else clearSelectedTriangles();
    selectObject(mesh);
    selectedFaces.length = 0; selectedFace = null;
    if (mode === 'edge') {
      const edges = new Map();
      for (const face of candidates) for (let index = 0; index < 3; index++) {
        const localA = face.localTrianglePoints[index];
        const localB = face.localTrianglePoints[(index + 1) % 3];
        const a = localA.clone().applyMatrix4(mesh.matrixWorld), b = localB.clone().applyMatrix4(mesh.matrixWorld);
        const ab = b.clone().sub(a), lengthSq = ab.lengthSq();
        const t = lengthSq > 1e-16 ? THREE.MathUtils.clamp(center.clone().sub(a).dot(ab) / lengthSq, 0, 1) : 0;
        if (a.clone().addScaledVector(ab, t).distanceTo(center) > radius) continue;
        const key = surfaceEdgeKey(mesh, localA, localB);
        if (!edges.has(key)) edges.set(key, { mesh, localA: localA.clone(), localB: localB.clone(), key, normalWorld: face.normalWorld.clone(),
          protectedBevelEdge: (mesh.userData.edgeBevelProtectedEdges || []).includes(localEdgeSignature(localA, localB)) });
      }
      selectedSurfaceEdges.push(...edges.values());
    } else {
      const vertices = new Map();
      for (const face of candidates) for (const localPoint of face.localTrianglePoints) {
        const key = surfaceVertexKey(mesh, localPoint);
        if (!vertices.has(key)) vertices.set(key, { mesh, localPoint: localPoint.clone(), key, normalWorld: face.normalWorld.clone() });
      }
      selectedSurfaceVertices.push(...vertices.values());
    }
    if (!surfaceComponentSelectionCount()) throw new Error(`No ${mode}s intersect the cursor radius. Increase the tool radius or move its center closer.`);
    bwsSculptTargetId = mesh.userData.id;
    updateSurfaceComponentMarker(); syncSurfaceEditorUi(); updateSurfaceGizmoAttachment(); updateAll();
    state = bwsSculptState();
  }
  bwsSculptToolPosition = center.clone(); bwsSculptToolRadius = radius; bwsSculptToolMode = mode;
  bwsSculptUpdateToolOverlay(document.querySelector('#bws-sculpt-panel'));
  state.anchorWorldPosition = center.toArray().map(value => round(value));
  state.radius = radius;
  return state;
}

function bwsSculptLookAtSelected(params = {}) {
  const activeTargets = typeof transformTargetObjects === 'function' ? transformTargetObjects() : [];
  const mesh = params.targetId ? bwsSculptTarget(params.targetId) : (selected || activeTargets[0] || checkedObjects()[0] || bwsSculptTarget(bwsSculptTargetId));
  if (!mesh) throw new Error('Select a model part in the viewport or check it in the parts list first.');
  mesh.updateWorldMatrix(true, false);
  const center = new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3());
  selectObject(mesh);
  bwsSculptTargetId = mesh.userData.id;
  bwsSculptSetTool({ center: center.toArray(), radius: Number(params.radius ?? bwsSculptToolRadius), mode: params.mode ?? bwsSculptToolMode });
  bwsSculptRenderPreview();
  bwsSculptFocusPreviewOnTool();
  bwsSculptStatus(`Preview focused on ${mesh.name}; virtual tool centered on the selected part.`);
  return bwsSculptState();
}

function bwsSculptSymmetrizePatch(params = {}) {
  const strategy = params.strategy || params.mode || 'uniform';
  if (strategy === 'uniform' || strategy === 'even') {
    const result = bwsSculptSubdivideLocal({ targetId: params.targetId, levels: params.levels });
    return { ...result, symmetryStrategy: 'uniform', splitPattern: 'conforming four-way triangle subdivision' };
  }
  if (strategy !== 'centerline' && strategy !== 'mirror') throw new Error('Choose symmetry strategy uniform or centerline.');
  const mesh = bwsSculptTarget(params.targetId || bwsSculptTargetId);
  if (!selectedFaces.some(face => face.mesh === mesh)) throw new Error('Select a local triangle patch before mirroring it.');
  const axis = ['x', 'y', 'z'].includes(params.axis) ? params.axis : (els.symmetryAxisSelect?.value || 'x');
  const plane = Number(params.plane ?? els.symmetryPlaneInput?.value ?? 0);
  if (!Number.isFinite(plane)) throw new Error('Mirror plane must be a finite world-space coordinate.');
  if (els.symmetryAxisSelect) els.symmetryAxisSelect.value = axis;
  if (els.symmetryPlaneInput) els.symmetryPlaneInput.value = String(plane);
  if (!copySelectedTriangles()) throw new Error('Could not copy the selected triangle patch for mirroring.');
  const mirrored = pasteCopiedTrianglesMirrored();
  if (!mirrored) throw new Error('The selected patch could not be mirrored.');
  bwsSculptTargetId = mirrored.userData.id;
  const mirroredFaces = bwsSculptTriangles(mirrored);
  bwsSculptSetSelection(mirrored, mirroredFaces, 'triangle');
  if (bwsSculptToolPosition) {
    const center = bwsSculptToolPosition.clone();
    center[axis] = 2 * plane - center[axis];
    bwsSculptSetTool({ center: center.toArray(), radius: bwsSculptToolRadius, mode: bwsSculptToolMode });
  }
  bwsSculptStatus(`Mirrored ${mirroredFaces.length} triangles across ${axis.toUpperCase()}=${round(plane)}.`);
  return { ...bwsSculptState(), symmetryStrategy: 'centerline', axis, plane: round(plane), mirroredPartId: mirrored.userData.id };
}

function bwsSculptSubdivideLocal(params = {}) {
  const mesh = bwsSculptTarget(params.targetId || bwsSculptTargetId);
  const faces = selectedFaces.filter(face => face.mesh === mesh);
  if (!faces.length) throw new Error('Select a local area before subdividing it.');
  const levels = Math.max(1, Math.min(2, Math.round(Number(params.levels ?? 1))));
  const currentCount = bwsSculptTriangles(mesh).length;
  const projectedCount = currentCount + faces.length * (4 ** levels - 1);
  if (projectedCount > 100000) throw new Error(`Local subdivision would create ${projectedCount.toLocaleString()} triangles; the safety limit is 100,000.`);
  if (els.subdivideLevelsInput) els.subdivideLevelsInput.value = String(levels);
  subdivideSelectedSurface();
  bwsSculptTargetId = mesh.userData.id;
  bwsSculptRenderPreview();
  return bwsSculptState();
}
function bwsSculptParts() {
  return objects.filter(mesh => mesh?.geometry?.getAttribute('position')).map(mesh => {
    const position = mesh.geometry.getAttribute('position');
    return {
      id: mesh.userData?.id ?? null,
      name: mesh.name || 'Unnamed part',
      checked: checkedIds.has(mesh.userData?.id),
      triangleCount: Math.floor((mesh.geometry.index?.count ?? position.count) / 3)
    };
  });
}
async function bwsSculptPrepare(params = {}) {
  const ids = Array.isArray(params.targetIds) ? [...new Set(params.targetIds)] : [];
  const names = Array.isArray(params.targetNames) ? [...new Set(params.targetNames.map(name => String(name).trim()).filter(Boolean))] : [];
  let targets;
  if (ids.length) {
    targets = ids.map(bwsSculptTarget);
    if (targets.some(mesh => !mesh)) throw new Error('A requested sculpt part id is not in this scene.');
  } else if (names.length) {
    const available = bwsSculptParts();
    targets = names.map(name => {
      const part = available.find(item => item.name.toLowerCase() === name.toLowerCase());
      return part ? bwsSculptTarget(part.id) : null;
    });
    if (targets.some(mesh => !mesh)) {
      const missing = names.filter(name => !available.some(item => item.name.toLowerCase() === name.toLowerCase()));
      throw new Error(`Requested sculpt part${missing.length === 1 ? '' : 's'} not found: ${missing.join(', ')}. Use bws_sculpt_parts to list available parts.`);
    }
  } else targets = checkedObjects();
  targets = [...new Set(targets.filter(Boolean))];
  if (!targets.length) throw new Error('Provide targetIds or targetNames, or check one or more model parts first.');
  let mesh;
  if (targets.length > 1) {
    const before = new Set(objects.map(item => item.userData.id));
    checkedIds = new Set(targets.map(item => item.userData.id));
    selectedGroupRecordId = null;
    activeGroupIds = [];
    await mergeCheckedMeshes();
    mesh = objects.find(item => !before.has(item.userData.id)) || null;
    if (!mesh) throw new Error('The checked parts could not be merged.');
  } else mesh = targets[0];
  const levels = Math.round(Number(params.subdivisionLevels ?? 1));
  if (!Number.isInteger(levels) || levels < 1 || levels > 2) throw new Error('Subdivision levels must be 1 or 2.');
  const position = mesh.geometry.getAttribute('position');
  const triangleCount = Math.floor((mesh.geometry.index?.count ?? position.count) / 3);
  if (!triangleCount || triangleCount * (4 ** levels) > 100000) throw new Error('This subdivision would exceed the 100,000-triangle safety limit. Use fewer parts or one level.');
  selectObject(mesh);
  setFacePickMode(true);
  setSurfaceSelectionMode('triangle');
  selectedFaces.length = 0;
  selectedFaces.push(...bwsSculptTriangles(mesh));
  selectedFace = selectedFaces.at(-1) || null;
  if (els.subdivideLevelsInput) els.subdivideLevelsInput.value = String(levels);
  const subdivided = subdivideSelectedSurface();
  if (!subdivided.length) throw new Error('The surface could not be subdivided.');
  if (els.showModelingEdgesInput) {
    els.showModelingEdgesInput.checked = true;
    els.showModelingEdgesInput.dispatchEvent(new Event('change', { bubbles: true }));
  }
  mesh.userData.bwsTriangleSculpt = true;
  bwsSculptTargetId = mesh.userData.id;
  updateAll();
  bwsSculptStatus(`Ready: ${mesh.name} · ${subdivided.length.toLocaleString()} editable triangles.`);
  return bwsSculptState();
}
function bwsSculptSelectGrid(params = {}) {
  const mesh = bwsSculptTarget(params.targetId || bwsSculptTargetId);
  const faces = bwsSculptTriangles(mesh), { axes, bounds, centroids } = bwsSculptProjection(faces, params.view || 'front');
  const columns = Math.round(Number(params.columns ?? 16)), rows = Math.round(Number(params.rows ?? 16));
  const x0 = Math.round(Number(params.x0)), x1 = Math.round(Number(params.x1));
  const y0 = Math.round(Number(params.y0)), y1 = Math.round(Number(params.y1));
  if (![columns, rows, x0, x1, y0, y1].every(Number.isInteger) || columns < 1 || rows < 1 || columns > 100 || rows > 100 || x0 < 0 || y0 < 0 || x1 > columns || y1 > rows || x1 <= x0 || y1 <= y0) throw new Error('Grid bounds must be valid integer cell ranges within the grid.');
  const selectedFacesByGrid = faces.filter((face, index) => {
    const x = (centroids[index][axes[0]] - bounds[0].min) / Math.max(1e-9, bounds[0].max - bounds[0].min);
    const y = (centroids[index][axes[1]] - bounds[1].min) / Math.max(1e-9, bounds[1].max - bounds[1].min);
    const cellX = Math.min(columns - 1, Math.floor(x * columns));
    const cellY = Math.min(rows - 1, Math.floor(y * rows));
    return cellX >= x0 && cellX < x1 && cellY >= y0 && cellY < y1;
  });
  return bwsSculptSetSelection(mesh, selectedFacesByGrid);
}
function bwsSculptSelectBrush(params = {}) {
  const mesh = bwsSculptTarget(params.targetId || bwsSculptTargetId);
  const faces = bwsSculptTriangles(mesh), { axes, bounds, centroids } = bwsSculptProjection(faces, params.view || 'front');
  const x = Number(params.x), y = Number(params.y), radius = Number(params.radius ?? 0.12), count = Math.round(Number(params.count));
  if (![x, y, radius, count].every(Number.isFinite) || x < 0 || x > 1 || y < 0 || y > 1 || radius <= 0 || radius > 1 || count < 1 || count > 10000) throw new Error('Brush center must be 0..1, radius >0..1, and triangle count 1..10000.');
  const candidates = faces.map((face, index) => {
    const nx = (centroids[index][axes[0]] - bounds[0].min) / Math.max(1e-9, bounds[0].max - bounds[0].min);
    const ny = (centroids[index][axes[1]] - bounds[1].min) / Math.max(1e-9, bounds[1].max - bounds[1].min);
    return { face, distance: (nx - x) ** 2 + (ny - y) ** 2 };
  }).filter(item => item.distance <= radius ** 2).sort((a, b) => a.distance - b.distance).slice(0, count).map(item => item.face);
  return bwsSculptSetSelection(mesh, candidates);
}
function bwsSculptPushPull(params = {}) {
  const mesh = bwsSculptTarget(params.targetId || bwsSculptTargetId);
  if (surfaceComponentMode === 'edge' || surfaceComponentMode === 'vertex') {
    const components = surfaceComponentMode === 'edge'
      ? selectedSurfaceEdges.filter(edge => edge.mesh === mesh)
      : selectedSurfaceVertices.filter(vertex => vertex.mesh === mesh);
    const distance = Number(params.distance), direction = params.direction || 'normal';
    if (!components.length) throw new Error(`Select one or more ${surfaceComponentMode}s before pushing or pulling.`);
    if (!Number.isFinite(distance) || Math.abs(distance) > 5 || !['normal', 'x', 'y', 'z'].includes(direction)) throw new Error('Distance must be within ±5 units; direction must be normal/x/y/z.');
    const worldDirection = new THREE.Vector3();
    if (direction === 'normal') {
      for (const component of components) if (component.normalWorld?.lengthSq?.() > 1e-12) worldDirection.add(component.normalWorld);
      if (worldDirection.lengthSq() < 1e-12) {
        const fallback = components.find(component => component.normalWorld?.lengthSq?.() > 1e-12)?.normalWorld;
        if (fallback) worldDirection.copy(fallback);
      }
    } else worldDirection[direction] = 1;
    if (worldDirection.lengthSq() < 1e-12) worldDirection.set(0, 1, 0);
    worldDirection.normalize().multiplyScalar(distance);
    recordHistory(`sculpt ${surfaceComponentMode} push/pull`);
    moveSelectedSurfaceComponentsByWorldDelta(worldDirection);
    updateAll(); syncSurfaceEditorUi(); updateSurfaceGizmoAttachment();
    bwsSculptRenderPreview(); bwsSculptFocusPreviewOnTool();
    return bwsSculptState();
  }
  const faces = selectedFaces.filter(face => face.mesh === mesh);
  if (!faces.length) throw new Error('Select a sculpt region before pushing or pulling.');
  const distance = Number(params.distance), rings = Math.round(Number(params.falloffRings ?? 2));
  const direction = params.direction || 'normal';
  const falloffStrength = Number(params.falloffStrength ?? 1), falloffCurve = params.falloffCurve || 'smooth';
  if (!Number.isFinite(distance) || Math.abs(distance) > 5 || !Number.isInteger(rings) || rings < 0 || rings > 12 || !Number.isFinite(falloffStrength) || falloffStrength < 0 || falloffStrength > 1 || !['smooth', 'linear', 'constant'].includes(falloffCurve) || !['normal', 'x', 'y', 'z'].includes(direction)) throw new Error('Distance must be within ±5 units; falloff rings 0..12, strength 0..1, curve smooth/linear/constant, direction normal/x/y/z.');
  const geometry = mesh.geometry, position = geometry.getAttribute('position');
  if (geometry.index) throw new Error('Prepare the surface first so its triangles are editable.');
  const triangleCount = Math.floor(position.count / 3), keys = [], vertexTriangles = new Map();
  const pointAt = index => new THREE.Vector3(position.getX(index), position.getY(index), position.getZ(index));
  const keyOf = point => point.toArray().map(value => Math.round(value * 1e5)).join(':');
  for (let tri = 0; tri < triangleCount; tri++) for (let corner = 0; corner < 3; corner++) {
    const key = keyOf(pointAt(tri * 3 + corner));
    keys[tri * 3 + corner] = key;
    if (!vertexTriangles.has(key)) vertexTriangles.set(key, []);
    vertexTriangles.get(key).push(tri);
  }
  const adjacent = Array.from({ length: triangleCount }, () => new Set());
  for (const linked of vertexTriangles.values()) for (const tri of linked) for (const other of linked) if (other !== tri) adjacent[tri].add(other);
  const weights = new Float32Array(triangleCount), queue = [];
  for (const face of faces) if (Number.isInteger(face.faceIndex) && face.faceIndex >= 0 && face.faceIndex < triangleCount && weights[face.faceIndex] === 0) {
    weights[face.faceIndex] = 1; queue.push(face.faceIndex);
  }
  const levels = new Int16Array(triangleCount).fill(-1);
  for (const seed of queue) levels[seed] = 0;
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head], nextLevel = levels[current] + 1;
    if (nextLevel > rings) continue;
    for (const next of adjacent[current]) if (levels[next] < 0) {
      levels[next] = nextLevel;
      const t = 1 - nextLevel / (rings + 1);
      weights[next] = (falloffCurve === 'constant' ? 1 : falloffCurve === 'linear' ? t : t * t * (3 - 2 * t)) * falloffStrength;
      queue.push(next);
    }
  }
  const vertexWeights = new Map();
  for (let tri = 0; tri < triangleCount; tri++) for (let corner = 0; corner < 3; corner++) {
    const key = keys[tri * 3 + corner];
    vertexWeights.set(key, Math.max(vertexWeights.get(key) || 0, weights[tri]));
  }
  const worldDirection = new THREE.Vector3();
  if (direction === 'normal') {
    for (const face of faces) {
      let normal = face.normalWorld?.clone?.();
      if (!normal || !normal.toArray().every(Number.isFinite) || normal.lengthSq() < 1e-12) {
        const points = face.trianglePoints;
        if (Array.isArray(points) && points.length >= 3) normal = points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0]));
      }
      if (normal?.lengthSq() > 1e-12) {
        normal.normalize();
        if (worldDirection.lengthSq() < 1e-12) worldDirection.copy(normal);
        else worldDirection.add(normal);
      }
    }
  }
  else worldDirection[direction] = 1;
  if (worldDirection.lengthSq() < 1e-12 && direction === 'normal') {
    const points = faces.find(face => Array.isArray(face.trianglePoints) && face.trianglePoints.length >= 3)?.trianglePoints;
    if (points) worldDirection.copy(points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])));
  }
  if (worldDirection.lengthSq() < 1e-12) throw new Error('The selected surface has no usable normal.');
  worldDirection.normalize();
  mesh.updateMatrixWorld(true);
  const localOrigin = mesh.worldToLocal(new THREE.Vector3(0, 0, 0));
  const localTip = mesh.worldToLocal(worldDirection.clone().multiplyScalar(distance));
  const localDelta = localTip.sub(localOrigin);
  const nextGeometry = geometry.clone(), nextPosition = nextGeometry.getAttribute('position');
  for (let vertex = 0; vertex < position.count; vertex++) {
    const delta = localDelta.clone().multiplyScalar(vertexWeights.get(keys[vertex]) || 0);
    nextPosition.setXYZ(vertex, position.getX(vertex) + delta.x, position.getY(vertex) + delta.y, position.getZ(vertex) + delta.z);
  }
  nextPosition.needsUpdate = true;
  nextGeometry.computeVertexNormals();
  nextGeometry.computeBoundingBox();
  nextGeometry.computeBoundingSphere();
  recordHistory('triangle sculpt push/pull');
  replaceEditableMeshGeometry(mesh, nextGeometry);
  selectedFaces.length = 0;
  selectedFaces.push(...bwsSculptTriangles(mesh).filter(face => faces.some(old => old.faceIndex === face.faceIndex)));
  selectedFace = selectedFaces.at(-1) || null;
  updateFaceMarker();
  syncSurfaceEditorUi();
  updateAll();
  bwsSculptStatus(`Moved ${faces.length.toLocaleString()} triangles by ${distance} along ${direction}.`);
  return bwsSculptState();
}
function bwsSculptRelax(params = {}) {
  const mesh = bwsSculptTarget(params.targetId || bwsSculptTargetId);
  const faces = selectedFaces.filter(face => face.mesh === mesh);
  if (!faces.length) throw new Error('Select a triangle patch before relaxing it.');
  const geometry = mesh.geometry, position = geometry.getAttribute('position');
  if (geometry.index) throw new Error('Prepare the surface first so its triangles are editable.');
  const strength = Number(params.strength ?? 0.5), iterations = Math.round(Number(params.iterations ?? 1));
  const preserveOpenBoundaries = params.preserveOpenBoundaries !== false;
  if (!Number.isFinite(strength) || strength < 0 || strength > 1 || !Number.isInteger(iterations) || iterations < 1 || iterations > 20) throw new Error('Relax strength must be 0..1 and iterations 1..20.');
  const keyOfIndex = index => [position.getX(index), position.getY(index), position.getZ(index)].map(value => Math.round(value * 1e5)).join(':');
  const points = new Map(), neighbors = new Map(), edgeCounts = new Map(), selectedKeys = new Set();
  const addPoint = index => {
    const key = keyOfIndex(index);
    if (!points.has(key)) points.set(key, new THREE.Vector3(position.getX(index), position.getY(index), position.getZ(index)));
    if (!neighbors.has(key)) neighbors.set(key, new Set());
    return key;
  };
  const edgeKey = (a, b) => a < b ? `${a}|${b}` : `${b}|${a}`;
  for (let triangle = 0; triangle < position.count / 3; triangle++) {
    const keys = [0, 1, 2].map(corner => addPoint(triangle * 3 + corner));
    for (let corner = 0; corner < 3; corner++) {
      const a = keys[corner], b = keys[(corner + 1) % 3];
      neighbors.get(a).add(b); neighbors.get(b).add(a);
      const key = edgeKey(a, b); edgeCounts.set(key, (edgeCounts.get(key) || 0) + 1);
    }
  }
  for (const face of faces) if (Number.isInteger(face.faceIndex) && face.faceIndex >= 0 && face.faceIndex < position.count / 3) {
    for (let corner = 0; corner < 3; corner++) selectedKeys.add(keyOfIndex(face.faceIndex * 3 + corner));
  }
  const boundaryKeys = new Set();
  if (preserveOpenBoundaries) for (const [key, count] of edgeCounts) if (count === 1) for (const pointKey of key.split('|')) boundaryKeys.add(pointKey);
  if (!selectedKeys.size) throw new Error('The selected patch has no editable vertices.');
  recordHistory('sculpt relax selected patch');
  for (let iteration = 0; iteration < iterations; iteration++) {
    const moves = new Map();
    let centerDelta = new THREE.Vector3(), movable = 0;
    for (const key of selectedKeys) {
      if (boundaryKeys.has(key)) continue;
      const adjacent = [...(neighbors.get(key) || [])];
      if (!adjacent.length) continue;
      const average = adjacent.reduce((sum, neighbor) => sum.add(points.get(neighbor)), new THREE.Vector3()).multiplyScalar(1 / adjacent.length);
      const delta = average.sub(points.get(key)).multiplyScalar(strength);
      moves.set(key, delta); centerDelta.add(delta); movable++;
    }
    if (!movable) break;
    centerDelta.multiplyScalar(1 / movable);
    for (const [key, delta] of moves) points.get(key).add(delta.sub(centerDelta));
  }
  for (let index = 0; index < position.count; index++) {
    const point = points.get(keyOfIndex(index));
    if (point) position.setXYZ(index, point.x, point.y, point.z);
  }
  position.needsUpdate = true; geometry.computeVertexNormals();
  updateAll(); syncSurfaceEditorUi(); bwsSculptRenderPreview(); bwsSculptFocusPreviewOnTool();
  return { ...bwsSculptState(), relaxedVertices: selectedKeys.size, strength, iterations, preserveOpenBoundaries };
}
function bwsSculptPreviewImage() {
  bwsSculptRenderPreview();
  const canvas = document.querySelector('#bws-sculpt-preview-canvas');
  if (!canvas || !canvas.width || !canvas.height) throw new Error('Open or initialize the Triangle Sculpt preview before capturing it.');
  const dataUrl = canvas.toDataURL('image/png');
  return { artifact: { name: 'bws-sculpt-preview.png', base64: dataUrl.slice(dataUrl.indexOf(',') + 1) } };
}
async function bwsModelQaSheet() {
  if (typeof window.BwsCaptureQaSheetImage !== 'function') throw new Error('The full-model QA capture is not initialized yet.');
  const capture = await window.BwsCaptureQaSheetImage();
  const dataUrl = capture?.dataUrl;
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/png;base64,')) throw new Error('The full-model QA capture returned no PNG image.');
  return { artifact: { name: capture.fileName || 'bws-model-qa-sheet.png', base64: dataUrl.slice(dataUrl.indexOf(',') + 1) } };
}
async function bwsSculptQaSheet() {
  bwsSculptRenderPreview();
  const capture = bwsSculptPreviewImage();
  capture.artifact.name = 'bws-triangle-sculpt-qa.png';
  const referenceSrc = document.querySelector('#referenceImagePreviewImg')?.src || '';
  if (!referenceSrc.startsWith('data:image/')) return capture;
  const loadImage = src => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('A QA image could not be loaded.'));
    image.src = src;
  });
  const [sculptImage, referenceImage] = await Promise.all([
    loadImage(`data:image/png;base64,${capture.artifact.base64}`),
    loadImage(referenceSrc)
  ]);
  const sheet = document.createElement('canvas');
  sheet.width = 1280; sheet.height = 480;
  const context = sheet.getContext('2d');
  context.fillStyle = '#0d1113'; context.fillRect(0, 0, sheet.width, sheet.height);
  for (const [index, image] of [sculptImage, referenceImage].entries()) {
    const x = index * 640;
    const scale = Math.min(640 / image.width, 480 / image.height);
    const width = image.width * scale, height = image.height * scale;
    context.drawImage(image, x + (640 - width) / 2, (480 - height) / 2, width, height);
    context.fillStyle = 'rgba(5, 8, 9, .82)'; context.fillRect(x + 12, 12, 180, 34);
    context.fillStyle = '#f1c65b'; context.font = '700 18px system-ui, sans-serif';
    context.fillText(index === 0 ? 'SCULPT PREVIEW' : 'REFERENCE', x + 24, 35);
    context.strokeStyle = '#344047'; context.strokeRect(x + .5, .5, 639, 479);
  }
  capture.artifact.base64 = sheet.toDataURL('image/png').split(',')[1];
  return capture;
}
function bwsSculptViewportImage() {
  const canvas = [...document.querySelectorAll('canvas')]
    .filter(item => !item.closest('#bws-sculpt-panel') && !item.closest('#bwc-adapter-panel'))
    .map(item => ({ item, rect: item.getBoundingClientRect(), style: getComputedStyle(item) }))
    .filter(({ item, rect, style }) => item.width > 0 && item.height > 0 && rect.width >= 180 && rect.height >= 140 && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0)
    .sort((a, b) => b.rect.width * b.rect.height - a.rect.width * a.rect.height)[0]?.item;
  if (!canvas) throw new Error('No visible BWS model viewport canvas is available to capture.');
  try {
    const dataUrl = canvas.toDataURL('image/png');
    return { artifact: { name: 'bws-viewport.png', base64: dataUrl.slice(dataUrl.indexOf(',') + 1) } };
  } catch (error) {
    throw new Error(`The model viewport could not be captured as an image: ${error.message}`);
  }
}
function bwsSculptStatus(text) {
  const output = document.querySelector('#bws-sculpt-status');
  if (output) output.textContent = text;
  bwsSculptRenderPreview();
  bwsSculptFocusPreviewOnTool();
}
function bwsSculptNumber(root, name) { return Number(root.querySelector(`[name="${name}"]`)?.value); }
function bwsSculptInstallPlacementPreview(panel) {
  const canvas = panel.querySelector('#bws-sculpt-preview-canvas');
  if (!canvas || canvas.dataset.localPlacement === 'true') return;
  canvas.dataset.localPlacement = 'true';
  canvas.title = 'The green center and radius show the AI-positioned virtual sculpt tool. Drag to orbit; scroll to zoom.';
  const host = canvas.parentElement;
  if (host) {
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    const marker = document.createElement('div'); marker.className = 'bws-sculpt-tool-marker';
    marker.style.cssText = 'position:absolute;z-index:5;pointer-events:none;width:0;height:0';
    marker.innerHTML = '<span class="bws-sculpt-tool-radius" style="position:absolute;left:0;top:0;transform:translate(-50%,-50%);border:2px solid #57ff39;border-radius:50%;background:#57ff3920"></span><span style="position:absolute;left:0;top:0;transform:translate(-50%,-50%);width:12px;height:12px;border:2px solid #fff;border-radius:50%;background:#42ff32"></span>';
    host.append(marker);
    let toolbar = host.querySelector('.bws-sculpt-preview-toolbar');
    if (!toolbar) {
      toolbar = document.createElement('div'); toolbar.className = 'bws-sculpt-preview-toolbar';
      toolbar.style.cssText = 'position:absolute;z-index:8;top:7px;left:7px;display:flex;gap:4px;padding:3px;border-radius:5px;background:#071114cc';
      for (const [action, label] of [['camera-front', 'Front'], ['camera-side', 'Side'], ['camera-top', 'Top'], ['camera-angle', 'Angled']]) {
        const button = document.createElement('button'); button.type = 'button'; button.dataset.action = action; button.textContent = label;
        button.style.cssText = 'margin:0;padding:4px 6px;font-size:10px'; toolbar.append(button);
      }
      host.append(toolbar);
    }
  }
  bwsSculptUpdateToolOverlay(panel);
  canvas.addEventListener('wheel', event => {
    const camera = bwsSculptPreview?.camera;
    if (!camera) return;
    event.preventDefault();
    camera.zoom = Math.max(0.5, Math.min(12, (camera.zoom || 1) * (event.deltaY < 0 ? 1.12 : 1 / 1.12)));
    camera.updateProjectionMatrix();
    bwsSculptRenderPreview();
  }, { passive: false });
  const selectAtCurrentPoint = () => {
    const xyz = ['X', 'Y', 'Z'].map(axis => bwsSculptNumber(panel, `local${axis}`));
    try {
      const state = bwsSculptSelectLocal({ center: xyz, radius: bwsSculptNumber(panel, 'localRadius'), mode: panel.querySelector('[name="localMode"]').value });
      bwsSculptStatus(`${state.selectedTriangles} triangles selected within radius ${state.radius} of the preview point.`);
    } catch (error) { bwsSculptStatus(error.message); }
  };
  panel.querySelector('[name="localRadius"]')?.addEventListener('change', selectAtCurrentPoint);
  panel.querySelector('[name="localMode"]')?.addEventListener('change', selectAtCurrentPoint);
  const hint = document.createElement('p');
  hint.textContent = 'AI positions the virtual tool with world-space XYZ and radius. This preview shows that location and size; scroll to zoom and drag to orbit. Selected triangles highlight here.';
  canvas.insertAdjacentElement('afterend', hint);
}
let bwsSculptPreview = null;
function bwsSculptRenderPreview() {
  const canvas = document.querySelector('#bws-sculpt-preview-canvas');
  const mesh = bwsSculptTarget(bwsSculptTargetId);
  if (!canvas || !mesh) return;
  const width = Math.max(1, canvas.clientWidth), height = Math.max(1, canvas.clientHeight);
  try {
    if (!bwsSculptPreview) {
      const scene = new THREE.Scene();
      scene.background = new THREE.Color('#0b171a');
      const camera = new THREE.PerspectiveCamera(38, width / height, 0.001, 100000);
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      scene.add(new THREE.HemisphereLight(0xe6f4ff, 0x39423d, 2.2));
      const key = new THREE.DirectionalLight(0xffffff, 2.5); key.position.set(4, 7, 6); scene.add(key);
      bwsSculptPreview = { scene, camera, renderer, target: new THREE.Vector3(), radius: 1, azimuth: 0.72, elevation: 0.38, zoom: 3.1, model: null, edges: null, selection: null, marker: null };
      let drag = null;
      canvas.addEventListener('pointerdown', event => { drag = { x: event.clientX, y: event.clientY }; canvas.setPointerCapture(event.pointerId); });
      canvas.addEventListener('pointermove', event => {
        if (!drag) return;
        bwsSculptPreview.azimuth -= (event.clientX - drag.x) * 0.008;
        bwsSculptPreview.elevation = Math.max(-1.45, Math.min(1.45, bwsSculptPreview.elevation + (event.clientY - drag.y) * 0.008));
        drag = { x: event.clientX, y: event.clientY }; bwsSculptPreviewDraw();
      });
      const endDrag = () => { drag = null; };
      canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);
      canvas.addEventListener('wheel', event => { event.preventDefault(); bwsSculptPreview.zoom = Math.max(1.2, Math.min(9, bwsSculptPreview.zoom + Math.sign(event.deltaY) * 0.18)); bwsSculptPreviewDraw(); }, { passive: false });
      window.addEventListener('resize', bwsSculptRenderPreview);
    }
    const state = bwsSculptPreview;
    state.renderer.setSize(width, height, false);
    if (state.model) state.scene.remove(state.model);
    if (state.edges) { state.scene.remove(state.edges); state.edges.geometry.dispose(); state.edges.material.dispose(); }
    state.model = null; state.edges = null;
    if (state.selection) { state.scene.remove(state.selection); state.selection.geometry.dispose(); state.selection.material.dispose(); state.selection = null; }
    if (state.marker) { state.scene.remove(state.marker); state.marker.geometry.dispose(); state.marker.material.dispose(); state.marker = null; }
    mesh.updateWorldMatrix(true, false);
    const box = new THREE.Box3().setFromObject(mesh);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    state.target.copy(sphere.center); state.radius = Math.max(sphere.radius, 0.01);
    state.model = mesh.clone(); state.model.matrixAutoUpdate = false; state.model.matrix.copy(mesh.matrixWorld); state.model.updateMatrixWorld(true); state.scene.add(state.model);
    const wireGeometry = new THREE.WireframeGeometry(mesh.geometry);
    state.edges = new THREE.LineSegments(wireGeometry, new THREE.LineBasicMaterial({ color: 0x608a80, transparent: true, opacity: 0.58 }));
    state.edges.matrixAutoUpdate = false; state.edges.matrix.copy(mesh.matrixWorld); state.edges.updateMatrixWorld(true); state.scene.add(state.edges);
    const picked = selectedFaces.filter(face => face.mesh === mesh);
    if (picked.length && surfaceComponentMode !== 'edge' && surfaceComponentMode !== 'vertex') {
      const positions = new Float32Array(picked.length * 9); let offset = 0; const center = new THREE.Vector3();
      for (const face of picked) for (const point of face.trianglePoints) { positions[offset++] = point.x; positions[offset++] = point.y; positions[offset++] = point.z; center.add(point); }
      center.multiplyScalar(1 / (picked.length * 3));
      const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); geometry.computeVertexNormals();
      state.selection = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0xff543f, side: THREE.DoubleSide, transparent: true, opacity: 0.88, depthTest: false })); state.scene.add(state.selection);
      state.marker = new THREE.Mesh(new THREE.SphereGeometry(state.radius * 0.035, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffd070, depthTest: false })); state.marker.position.copy(center); state.scene.add(state.marker);
    } else if (surfaceComponentMode === 'edge') {
      const selectedEdges = selectedSurfaceEdges.filter(edge => edge.mesh === mesh);
      if (selectedEdges.length) {
        const positions = selectedEdges.flatMap(edge => [
          ...edge.localA.clone().applyMatrix4(mesh.matrixWorld).toArray(),
          ...edge.localB.clone().applyMatrix4(mesh.matrixWorld).toArray()
        ]);
        const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        state.selection = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0xff543f, linewidth: 4, depthTest: false })); state.scene.add(state.selection);
      }
    } else if (surfaceComponentMode === 'vertex') {
      const selectedVertices = selectedSurfaceVertices.filter(vertex => vertex.mesh === mesh);
      if (selectedVertices.length) {
        const positions = selectedVertices.flatMap(vertex => vertex.localPoint.clone().applyMatrix4(mesh.matrixWorld).toArray());
        const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        state.selection = new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xff543f, size: 9, sizeAttenuation: false, depthTest: false })); state.scene.add(state.selection);
      }
    }
    bwsSculptPreviewDraw();
    const detail = document.querySelector('#bws-sculpt-preview-location');
    if (detail) {
      const current = bwsSculptState();
      const components = current.selectionMode === 'edge' ? `${current.selectedEdges} edges` : current.selectionMode === 'vertex' ? `${current.selectedVertices} vertices` : `${current.selectedTriangles} triangles`;
      detail.textContent = `${current.targetName} · ${components} selected${current.selectionCenter ? ` · center ${current.selectionCenter.map(v => Number(v).toFixed(2)).join(', ')}` : ''}`;
    }
  } catch (error) {
    const detail = document.querySelector('#bws-sculpt-preview-location');
    if (detail) detail.textContent = `Preview unavailable: ${error.message}`;
  }
}
function bwsSculptPreviewDraw() {
  const state = bwsSculptPreview;
  if (!state) return;
  const canvas = state.renderer.domElement, width = Math.max(1, canvas.clientWidth), height = Math.max(1, canvas.clientHeight);
  state.renderer.setSize(width, height, false);
  state.camera.aspect = width / height; state.camera.updateProjectionMatrix();
  const horizontal = Math.cos(state.elevation) * state.radius * state.zoom;
  state.camera.position.set(state.target.x + Math.sin(state.azimuth) * horizontal, state.target.y + Math.sin(state.elevation) * state.radius * state.zoom, state.target.z + Math.cos(state.azimuth) * horizontal);
  state.camera.lookAt(state.target); state.renderer.render(state.scene, state.camera);
  bwsSculptUpdateToolOverlay(document.querySelector('#bws-sculpt-panel'));
}
function bwsSculptBuildPanel() {
  if (document.querySelector('#bws-sculpt-launcher')) return;
  const root = document.createElement('div');
  root.innerHTML = `<style>
    #bws-sculpt-panel{position:fixed;z-index:2147482991;right:14px;top:62px;width:min(380px,calc(100vw - 36px));max-height:calc(100vh - 86px);overflow:auto;padding:14px;border:1px solid #72958b;border-radius:9px;background:#142125;color:#e6efec;font:13px/1.4 system-ui;box-shadow:0 10px 34px #0008}
    #bws-sculpt-preview-canvas{display:block;width:100%;height:180px;border:1px solid #35534d;border-radius:5px;touch-action:none;cursor:grab}#bws-sculpt-preview-canvas:active{cursor:grabbing}#bws-sculpt-preview-location{font-size:11px;color:#e7c47b;min-height:1.3em}
    #bws-sculpt-panel[hidden]{display:none}#bws-sculpt-panel h2{font-size:17px;margin:0 0 8px}#bws-sculpt-panel h3{font-size:14px;margin:14px 0 5px}
    #bws-sculpt-panel p{margin:7px 0;color:#c6d8d2}#bws-sculpt-panel label{display:inline-grid;gap:3px;margin:4px 5px 4px 0;font-size:11px}
    #bws-sculpt-panel input,#bws-sculpt-panel select{width:76px;box-sizing:border-box;padding:6px;background:#0b171a;color:#eef8f3;border:1px solid #72958b;border-radius:4px}
    #bws-sculpt-panel button{margin:5px 5px 0 0;padding:7px 9px;background:#24463d;color:#eef8f3;border:1px solid #72958b;border-radius:4px;cursor:pointer}
    #bws-sculpt-status{color:#e9c681;overflow-wrap:anywhere;min-height:1.4em}#bws-sculpt-panel .danger{background:#49342a}
    @media(max-width:700px){#bws-sculpt-panel{right:10px;top:auto;bottom:112px}}
  </style><button id="bws-sculpt-launcher" type="button">Triangle Sculpt</button>
  <section id="bws-sculpt-panel" hidden aria-label="Triangle Sculpt tool"><h2>Triangle Sculpt</h2>
  <p>Check the body parts to combine, then create a dense triangle surface. Selection and deformation are undoable.</p>
  <canvas id="bws-sculpt-preview-canvas" aria-label="Orbitable 3D preview of the sculpt target and selected triangles"></canvas><p id="bws-sculpt-preview-location">Prepare a mesh to preview the active sculpt area.</p>
  <label>Subdivision levels<select name="levels"><option value="1">1 · 4× detail</option><option value="2">2 · 16× detail</option></select></label>
  <button type="button" data-action="prepare">Merge checked + prepare</button>
  <h3>Projected grid area</h3><label>View<select name="view"><option value="front">Front (X/Y)</option><option value="side">Side (Z/Y)</option><option value="top">Top (X/Z)</option></select></label>
  <label>Columns<input name="columns" type="number" min="1" max="100" value="16"></label><label>Rows<input name="rows" type="number" min="1" max="100" value="16"></label>
  <label>X start<input name="x0" type="number" min="0" value="5"></label><label>X end<input name="x1" type="number" min="1" value="11"></label>
  <label>Y start<input name="y0" type="number" min="0" value="7"></label><label>Y end<input name="y1" type="number" min="1" value="12"></label>
  <button type="button" data-action="grid">Select grid region</button>
  <h3>Count-limited area brush</h3><label>Center X<input name="brushX" type="number" min="0" max="1" step="0.01" value="0.5"></label><label>Center Y<input name="brushY" type="number" min="0" max="1" step="0.01" value="0.5"></label>
  <label>Radius<input name="radius" type="number" min="0.01" max="1" step="0.01" value="0.12"></label><label>Triangle count<input name="count" type="number" min="1" max="10000" value="24"></label>
  <button type="button" data-action="brush">Brush-select triangles</button>
  <h3>Push / pull selected area</h3><label>Direction<select name="direction"><option value="normal">Surface normal</option><option value="x">X axis</option><option value="y">Y axis</option><option value="z">Z axis</option></select></label>
  <label>Distance<input name="distance" type="number" min="0.001" max="5" step="0.01" value="0.15"></label><label>Falloff rings<input name="falloff" type="number" min="0" max="12" value="2"></label>
  <button type="button" data-action="push">Push</button><button type="button" data-action="pull">Pull</button><button type="button" data-action="clear">Clear area</button>
  <p id="bws-sculpt-status" role="status" aria-live="polite">Check parts and prepare a sculpt mesh.</p><button type="button" data-action="close">Close</button></section>`;
  document.body.append(root);
  const launcher = root.querySelector('#bws-sculpt-launcher'), panel = root.querySelector('#bws-sculpt-panel');
  panel.tabIndex = -1;
  const localControls = document.createElement('section');
  localControls.innerHTML = `<h3>Local selection around green handle</h3><p>Selection is measured in model-space XYZ around the active gizmo, not across the whole object.</p>
    <div class="bws-sculpt-local-center"><label>Tool X<input name="localX" type="number" step="0.01"></label><label>Tool Y<input name="localY" type="number" step="0.01"></label><label>Tool Z<input name="localZ" type="number" step="0.01"></label></div>
    <div class="bws-sculpt-axis-controls"><button type="button" data-tool-move="-1,0,0">-X</button><button type="button" data-tool-move="1,0,0">+X</button><button type="button" data-tool-move="0,-1,0">-Y</button><button type="button" data-tool-move="0,1,0">+Y</button><button type="button" data-tool-move="0,0,-1">-Z</button><button type="button" data-tool-move="0,0,1">+Z</button><label>Move step<input name="toolStep" type="number" min="0.001" step="0.01" value="0.1"></label></div>
    <div class="bws-sculpt-radius-controls"><label>Tool radius<input name="localRadius" type="number" min="0.01" step="0.01" value="0.25"></label><button type="button" data-tool-radius="-1">Smaller</button><button type="button" data-tool-radius="1">Larger</button></div>
    <label>Selection type<select name="localMode"><option value="triangle">Triangles</option><option value="vertex">Vertices</option><option value="edge">Edges</option><option value="face">Whole face</option></select></label>
    <button type="button" data-action="local-select">Select around handle</button><button type="button" data-action="local-subdivide">Subdivide selected patch</button>
    `;
  const pushHeading = [...panel.querySelectorAll('h3')].find(node => node.textContent.includes('Push / pull selected area'));
  const lookButton = document.createElement('button');
  lookButton.type = 'button'; lookButton.dataset.action = 'look'; lookButton.textContent = 'Look at selected part';
  localControls.insertBefore(lookButton, localControls.firstChild);
  const symmetryControls = document.createElement('div');
  symmetryControls.innerHTML = `<h3>Symmetric triangle topology</h3><label>Strategy<select name="symmetryStrategy"><option value="uniform">Even triangle splits</option><option value="centerline">Mirror selected patch</option></select></label><label>Axis<select name="symmetryAxis"><option value="x">X</option><option value="y">Y</option><option value="z">Z</option></select></label><label>Centerline<input name="symmetryPlane" type="number" step="0.01" value="0"></label><button type="button" data-action="symmetrize">Apply topology strategy</button>`;
  localControls.append(symmetryControls);
  if (pushHeading) panel.insertBefore(localControls, pushHeading);
  const target = bwsSculptTarget(bwsSculptTargetId);
  const fallbackCenter = target ? new THREE.Box3().setFromObject(target).getCenter(new THREE.Vector3()) : null;
  const anchor = bwsSculptToolPosition || (surfaceGizmoPivot?.visible ? surfaceGizmoPivot.position : fallbackCenter);
  if (anchor) ['x', 'y', 'z'].forEach((axis, index) => { const input = panel.querySelector(`[name="local${axis.toUpperCase()}"]`); if (input) input.value = String(round(anchor.getComponent(index))); });
  if (anchor && !bwsSculptToolPosition) bwsSculptSetTool({ center: anchor.toArray(), radius: bwsSculptToolRadius, mode: bwsSculptToolMode });
  bwsSculptInstallPlacementPreview(panel);
  localControls.addEventListener('click', event => {
    const move = event.target.closest('[data-tool-move]');
    const radiusButton = event.target.closest('[data-tool-radius]');
    if (!move && !radiusButton) return;
    event.preventDefault();
    const current = ['X', 'Y', 'Z'].map(axis => bwsSculptNumber(panel, `local${axis}`));
    const center = current.every(Number.isFinite) ? current : bwsSculptToolPosition?.toArray();
    if (!center) { bwsSculptStatus('Enter the tool X, Y, and Z position first.'); return; }
    if (move) {
      const delta = move.dataset.toolMove.split(',').map(Number), step = bwsSculptNumber(panel, 'toolStep');
      bwsSculptSetTool({ center: center.map((value, index) => value + delta[index] * step) });
    } else {
      const radius = bwsSculptNumber(panel, 'localRadius') + Number(radiusButton.dataset.toolRadius) * bwsSculptNumber(panel, 'toolStep');
      bwsSculptSetTool({ center, radius: Math.max(0.01, radius) });
    }
  });
  for (const name of ['localX', 'localY', 'localZ', 'localRadius', 'localMode']) panel.querySelector(`[name="${name}"]`)?.addEventListener('change', () => {
    const center = ['X', 'Y', 'Z'].map(axis => bwsSculptNumber(panel, `local${axis}`));
    if (center.every(Number.isFinite)) {
      try { bwsSculptSetTool({ center, radius: bwsSculptNumber(panel, 'localRadius'), mode: panel.querySelector('[name="localMode"]').value }); }
      catch (error) { bwsSculptStatus(error.message); }
    }
  });
  const legacyGridHeading = [...panel.querySelectorAll('h3')].find(node => node.textContent.includes('Projected grid area'));
  if (legacyGridHeading) {
    let node = legacyGridHeading;
    while (node && node !== pushHeading && node !== localControls) { const next = node.nextElementSibling; node.hidden = true; node = next; }
  }
  const legacyBrushHeading = [...panel.querySelectorAll('h3')].find(node => node.textContent.includes('Count-limited area brush'));
  if (legacyBrushHeading) { let node = legacyBrushHeading; while (node && node !== pushHeading && node !== localControls) { const next = node.nextElementSibling; node.hidden = true; node = next; } }
  let restoreTarget = null;
  launcher.onclick = () => { restoreTarget = document.pointerLockElement; document.exitPointerLock?.(); panel.hidden = false; panel.focus(); requestAnimationFrame(() => { bwsSculptRenderPreview(); bwsSculptFocusPreviewOnTool(); bwsSculptUpdateToolOverlay(panel); }); };
  const close = () => { panel.hidden = true; launcher.focus(); if (restoreTarget?.isConnected) restoreTarget.requestPointerLock?.(); };
  root.querySelector('[data-action="close"]').onclick = close;
  panel.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); close(); } });
  panel.addEventListener('click', async event => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (!action || action === 'close') return;
    try {
      let result;
      if (action === 'look') result = bwsSculptLookAtSelected();
      else if (action === 'prepare') result = await bwsSculptPrepare({ subdivisionLevels: bwsSculptNumber(panel, 'levels') });
      else if (action === 'symmetrize') result = bwsSculptSymmetrizePatch({ strategy: panel.querySelector('[name="symmetryStrategy"]').value, axis: panel.querySelector('[name="symmetryAxis"]').value, plane: bwsSculptNumber(panel, 'symmetryPlane'), levels: bwsSculptNumber(panel, 'levels') });
      else if (action === 'local-select') result = bwsSculptSelectLocal({ center: ['X', 'Y', 'Z'].map(axis => bwsSculptNumber(panel, `local${axis}`)), radius: bwsSculptNumber(panel, 'localRadius'), mode: panel.querySelector('[name="localMode"]').value });
      else if (action === 'local-subdivide') result = bwsSculptSubdivideLocal({ levels: bwsSculptNumber(panel, 'levels') });
      else if (action.startsWith('camera-')) {
        if (!bwsSculptPreview) bwsSculptRenderPreview();
        const views = { 'camera-front': [0, 0], 'camera-side': [Math.PI / 2, 0], 'camera-top': [0, 1.45], 'camera-angle': [Math.PI / 4, 0.5] };
        [bwsSculptPreview.azimuth, bwsSculptPreview.elevation] = views[action];
        bwsSculptRenderPreview(); result = bwsSculptState();
      }
      else if (action === 'grid') result = bwsSculptSelectGrid({ view: panel.querySelector('[name="view"]').value, columns: bwsSculptNumber(panel, 'columns'), rows: bwsSculptNumber(panel, 'rows'), x0: bwsSculptNumber(panel, 'x0'), x1: bwsSculptNumber(panel, 'x1'), y0: bwsSculptNumber(panel, 'y0'), y1: bwsSculptNumber(panel, 'y1') });
      else if (action === 'brush') result = bwsSculptSelectBrush({ view: panel.querySelector('[name="view"]').value, x: bwsSculptNumber(panel, 'brushX'), y: bwsSculptNumber(panel, 'brushY'), radius: bwsSculptNumber(panel, 'radius'), count: bwsSculptNumber(panel, 'count') });
      else if (action === 'push' || action === 'pull') result = bwsSculptPushPull({ direction: panel.querySelector('[name="direction"]').value, distance: bwsSculptNumber(panel, 'distance') * (action === 'pull' ? -1 : 1), falloffRings: bwsSculptNumber(panel, 'falloff') });
      else if (action === 'clear') { clearSelectedTriangles(); result = bwsSculptState(); }
      const selectedLabel = result?.selectionMode === 'edge' ? `${result.selectedEdges || 0} edges` : result?.selectionMode === 'vertex' ? `${result.selectedVertices || 0} vertices` : `${result?.selectedTriangles || 0} triangles`;
      bwsSculptStatus(result ? `${result.targetName || 'Sculpt'} · ${result.triangleCount || 0} triangles · ${selectedLabel} selected.` : 'No result.');
    } catch (error) { bwsSculptStatus(error.message); }
  });
  bwsSculptInstallToolbarMenu(root.querySelector('#bws-sculpt-launcher'));
}
function bwsSculptInstallToolbarMenu(sculptLauncher) {
  const menu = document.querySelector('#toolbarPicker .toolbar-picker-menu');
  if (!menu) return;
  let section = menu.querySelector('#toolbarAiSculptTools');
  if (!section) { section = document.createElement('section'); section.id = 'toolbarAiSculptTools'; section.setAttribute('aria-label', 'AI and mesh sculpt tools'); const title = document.createElement('h3'); title.textContent = 'AI & Mesh tools'; title.style.cssText = 'margin:10px 0 6px;padding-top:10px;border-top:1px solid #50616c;font-size:12px;color:#d9bd83'; section.append(title); menu.append(section); }
  const moveLauncher = button => {
    if (!button || section.contains(button)) return;
    button.style.cssText = 'position:static;z-index:auto;right:auto;top:auto;bottom:auto;width:100%;min-height:34px;padding:7px 9px;margin:0;border:1px solid #72958b;border-radius:5px;background:#142125;color:#e6efec;font:600 12px system-ui;cursor:pointer';
    section.append(button);
  };
  moveLauncher(sculptLauncher);
  const connect = document.getElementById('bwc-adapter-launcher');
  if (connect) moveLauncher(connect);
  if (!window.bwsToolbarConnectObserver) {
    window.bwsToolbarConnectObserver = new MutationObserver(() => { const button = document.getElementById('bwc-adapter-launcher'); if (button) moveLauncher(button); });
    window.bwsToolbarConnectObserver.observe(document.body, { childList: true, subtree: true });
  }
  section.addEventListener('click', event => { if (event.target.closest('button')) menu.closest('details').open = false; });
}
function bwsSculptDockPanel() {
  const panel = document.querySelector('#bws-sculpt-panel');
  const dock = document.querySelector('#inspectorSection')?.parentElement;
  if (!panel || !dock || document.querySelector('#bwsAiSculptSection')) return;
  const section = document.createElement('details');
  section.className = 'section bws-ai-sculpt-details'; section.id = 'bwsAiSculptSection';
  section.style.cssText = 'margin:0;padding:12px;overflow:visible';
  const summary = document.createElement('summary'); summary.className = 'section-header bws-ai-sculpt-header';
  section.open = true;
  const heading = document.createElement('h2'); heading.textContent = 'AI';
  summary.append(heading);
  const body = document.createElement('div'); body.className = 'section-body'; body.id = 'bwsAiSculptBody';
  const note = document.createElement('p'); note.className = 'api-note'; note.textContent = 'AI sculpt controls. Tool calls require a live, paired BWS AI connection.'; body.append(note);
  panel.removeAttribute('hidden');
  panel.style.position = 'static';
  panel.style.inset = 'auto';
  panel.style.width = '100%';
  panel.style.maxHeight = 'none';
  panel.style.overflow = 'visible';
  panel.style.padding = '0';
  panel.style.border = '0';
  panel.style.borderRadius = '0';
  panel.style.background = 'transparent';
  panel.style.boxShadow = 'none';
  panel.style.cssText = 'position:static;inset:auto;z-index:auto;width:100%;max-height:none;overflow:visible;margin:0;padding:0;border:0;border-radius:0;background:transparent;box-shadow:none';
  body.append(panel); section.append(summary, body);
  const utilities = dock.querySelector('#utilitiesSection');
  dock.insertBefore(section, utilities || null);
  document.querySelector('#bws-sculpt-launcher')?.remove();
  const close = [...panel.querySelectorAll('button')].find(button => button.textContent.trim().toLowerCase() === 'close');
  close?.remove();
  const setOpen = open => {
    section.open = open;
    body.hidden = !open;
    body.style.display = open ? 'block' : 'none';
    if (open) requestAnimationFrame(() => bwsSculptRenderPreview());
  };
  setOpen(true);
  section.addEventListener('toggle', () => setOpen(section.open));
  section.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !body.hidden) { setOpen(false); summary.focus(); }
  });
}
window.BwsTriangleSculpt = Object.freeze({
  execute(operation, params = {}) {
    if (operation === 'bws_sculpt_parts') return bwsSculptParts();
    if (operation === 'bws_sculpt_preview_image') return bwsSculptPreviewImage();
    if (operation === 'bws_model_qa_sheet') return bwsModelQaSheet();
    if (operation === 'bws_sculpt_qa_sheet') return bwsSculptQaSheet();
    if (operation === 'bws_sculpt_viewport_image') return bwsSculptViewportImage();
    if (operation === 'bws_sculpt_prepare') return bwsSculptPrepare(params);
    if (operation === 'bws_sculpt_state') { bwsSculptRenderPreview(); return bwsSculptState(); }
    if (operation === 'bws_sculpt_look_at_selected') return bwsSculptLookAtSelected(params);
    if (operation === 'bws_sculpt_symmetrize_patch') return bwsSculptSymmetrizePatch(params);
    if (operation === 'bws_sculpt_set_tool') return bwsSculptSetTool(params);
    if (operation === 'bws_sculpt_select_local') return bwsSculptSelectLocal(params);
    if (operation === 'bws_sculpt_subdivide_local') return bwsSculptSubdivideLocal(params);
    if (operation === 'bws_sculpt_select_grid') return bwsSculptSelectGrid(params);
    if (operation === 'bws_sculpt_select_brush') return bwsSculptSelectBrush(params);
    if (operation === 'bws_sculpt_push_pull') return bwsSculptPushPull(params);
    if (operation === 'bws_sculpt_relax') return bwsSculptRelax(params);
    if (operation === 'bws_sculpt_clear_selection') { clearSelectedTriangles(); bwsSculptRenderPreview(); return bwsSculptState(); }
    throw new Error('Unknown Triangle Sculpt operation.');
  }
});
bwsSculptBuildPanel();
bwsSculptDockPanel();
function bwsAddReferenceControlsToggle() {
  if (document.getElementById('referenceControlsToggleBtn')) return;
  const controls = ['workViewFrontBtn', 'workViewSideBtn', 'workViewTopBtn', 'gameplayPreviewOpenBtn', 'frontReferenceWorkBtn', 'frontReferencePanBtn', 'frontReferenceFollowBtn', 'frontReferenceFitBtn', 'sideReferenceWorkBtn', 'sideReferencePanBtn', 'sideReferenceFollowBtn', 'sideReferenceFitBtn']
    .map(id => document.getElementById(id)).filter(Boolean);
  const toggle = document.createElement('button');
  toggle.id = 'referenceControlsToggleBtn';
  toggle.type = 'button';
  toggle.textContent = 'Hide view buttons';
  toggle.title = 'Show or hide the Front and Side view buttons';
  toggle.setAttribute('aria-expanded', 'true');
  toggle.style.cssText = 'position:fixed;left:8px;bottom:calc(var(--copyright-bar-height) + 8px);z-index:10001';
  toggle.onclick = () => {
    const visible = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!visible));
    toggle.textContent = visible ? 'Show view buttons' : 'Hide view buttons';
    controls.forEach(button => { button.hidden = visible; });
  };
  document.body.append(toggle);
}
bwsAddReferenceControlsToggle();
