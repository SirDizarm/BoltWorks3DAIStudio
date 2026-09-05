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
let lowerInfoCollapsed = localStorage.getItem("boltworks.bottomInfoCollapsed") === "true";

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
initializeMinecraftTools();
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

els.saveProjectBtn.addEventListener("click", () => {
  const projectName = currentProjectBaseName();
  download(`${projectName}.modelerproj`, JSON.stringify(projectState(), null, 2), "application/json");
  log("Saved full project file.", {
    project: projectName,
    objects: objects.length,
    checked: checkedIds.size
  });
});
els.newWorkspaceBtn?.addEventListener("click", async () => {
  const hasWork = objects.length > 0;
  if (hasWork && !window.confirm("Start an empty workspace? The last automatic save will be kept for Recover last save. New work will replace it when auto-saved. Download Save Project first if you need a permanent copy.")) return;
  els.newWorkspaceBtn.disabled = true;
  bwsStartingNewWorkspace = true;
  try {
    if (bwsAutoSaveTimer) clearTimeout(bwsAutoSaveTimer);
    bwsAutoSaveTimer = null;
    await bwsAutoSavePromise.catch(() => false);
    localStorage.setItem(BWS_RECOVERY_MANUAL_KEY, "1");
    if (gameplayPreviewVisible()) closeGameplayPreview();
    clearObjects({ record: false });
    resetRigForNewWorkspace();
    if (typeof resetGeometryNodeProjectState === "function") resetGeometryNodeProjectState();
    if (els.projectNameInput) els.projectNameInput.value = "modeler-project";
    setBwsAutoSaveStatus("Fresh workspace", "saved");
    log("New empty workspace started. Recover last save can restore the previous automatic save; Delete last save removes it. New work replaces it when auto-saved.");
  } catch (error) {
    console.warn("Could not start a fresh workspace", error);
    setBwsAutoSaveStatus("Could not start fresh workspace", "problem");
    log("Could not start a new workspace because the recovery preference could not be saved.");
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
document.querySelector("#exportGameCharacterBtn")?.addEventListener("click", exportGameCharacterPackage);
document.querySelector("#exportGameArmsBtn")?.addEventListener("click", exportGameCharacterArmsGlb);
document.querySelector("#gameItemImageBtn")?.addEventListener("click", () => els.gameItemImageFile?.click());
els.gameItemImageFile?.addEventListener("change", async event => {
  const file = event.target.files?.[0];
  try { await loadGameItemImageFile(file); }
  catch (error) {
    console.error(error);
    if (els.gameItemBuildStatus) els.gameItemBuildStatus.textContent = `Could not load image: ${error.message}`;
  }
  event.target.value = "";
});
document.querySelector("#gameItemBuildBtn")?.addEventListener("click", buildSolidGameItemFromImage);
document.querySelector("#gameEngineAutoMapBtn")?.addEventListener("click", () => syncGameEnginePluginUi({ forceAutoMap: true }));
document.querySelector("#gameEngineValidateBtn")?.addEventListener("click", () => validateGameEngineCharacter({ announce: true }));
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

els.workViewFrontBtn?.addEventListener("click", () => setOrthographicWorkView("front"));
els.workViewSideBtn?.addEventListener("click", () => setOrthographicWorkView("side"));
els.workViewTopBtn?.addEventListener("click", () => setOrthographicWorkView("top"));
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
els.gameplayStrideSyncInput?.addEventListener("change", syncGameplayStrideControls);
els.gameplayStrideScaleInput?.addEventListener("input", syncGameplayStrideControls);
syncGameplayStrideControls();
gameplayCanvas?.addEventListener("click", () => {
  if (!gameplayPreviewVisible()) return;
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
