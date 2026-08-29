let animatorWorkspaceActive = false;
let animatorTimelineCollapsed = localStorage.getItem("boltworks.animatorTimelineCollapsed") === "true";
let animatorBoneHome = null;
let animatorTimelineHome = null;

function syncAnimatorTimelineCollapseUi() {
  document.querySelector(".app")?.classList.toggle("timeline-collapsed", animatorTimelineCollapsed);
  if (!els.animatorTimelineCollapseBtn) return;
  els.animatorTimelineCollapseBtn.textContent = animatorTimelineCollapsed ? "Expand Timeline" : "Minimize Timeline";
  els.animatorTimelineCollapseBtn.setAttribute("aria-expanded", String(!animatorTimelineCollapsed));
  els.animatorTimelineCollapseBtn.classList.toggle("active", animatorTimelineCollapsed);
  syncAnimatorMiniTransportUi();
}

function syncAnimatorMiniTransportUi() {
  const play = document.querySelector("#animatorMiniPlayBtn");
  if (play) play.textContent = animationState?.playing ? "❚❚ Pause" : "▶ Play";
}

function setAnimatorTimelineCollapsed(collapsed) {
  animatorTimelineCollapsed = !!collapsed;
  localStorage.setItem("boltworks.animatorTimelineCollapsed", String(animatorTimelineCollapsed));
  syncAnimatorTimelineCollapseUi();
  requestAnimationFrame(() => {
    window.dispatchEvent(new Event("resize"));
    if (typeof resize === "function") resize();
  });
}

function moveAnimatorPanels(active) {
  const app = document.querySelector(".app");
  if (!app || !els.bonePlacementSection || !els.animationSection) return;
  animatorBoneHome ||= { parent: els.bonePlacementSection.parentNode, next: els.bonePlacementSection.nextSibling };
  animatorTimelineHome ||= { parent: els.animationSection.parentNode, next: els.animationSection.nextSibling };
  if (active) {
    app.append(els.bonePlacementSection, els.animationSection);
    return;
  }
  if (animatorTimelineHome.parent) animatorTimelineHome.parent.insertBefore(els.animationSection, animatorTimelineHome.next);
  if (animatorBoneHome.parent) animatorBoneHome.parent.insertBefore(els.bonePlacementSection, animatorBoneHome.next);
}

function syncAnimatorClipSelect() {
  if (!els.animatorClipSelect || !els.minecraftAnimationSelect) return;
  if (typeof hasBwsAnimationClips === "function" && hasBwsAnimationClips()) {
    els.animatorClipSelect.innerHTML = `<option value="${T_POSE_CLIP_ID}">T-Pose / Rig Fitting</option>`
      + Object.entries(animationState.clips).map(([id, clip]) => `<option value="${id}">${clip.name || id}</option>`).join("");
    els.animatorClipSelect.disabled = false;
    els.animatorClipSelect.value = tPoseFittingMode ? T_POSE_CLIP_ID : animationState.activeClipId;
    els.animatorClipSelect.dataset.source = "bws";
    return;
  }
  els.animatorClipSelect.innerHTML = els.minecraftAnimationSelect.innerHTML;
  els.animatorClipSelect.disabled = els.minecraftAnimationSelect.disabled;
  els.animatorClipSelect.value = els.minecraftAnimationSelect.value;
}

function setAnimatorWorkspace(active) {
  animatorWorkspaceActive = !!active;
  moveAnimatorPanels(animatorWorkspaceActive);
  document.querySelector(".app")?.classList.toggle("animator-mode", animatorWorkspaceActive);
  document.body.classList.toggle("animator-workspace-active", animatorWorkspaceActive);
  els.animatorWorkspaceOpenBtn?.classList.toggle("active", animatorWorkspaceActive);
  if (els.animatorWorkspaceOpenBtn) {
    els.animatorWorkspaceOpenBtn.textContent = animatorWorkspaceActive ? "Back to Modeling" : "Animator Workspace";
    els.animatorWorkspaceOpenBtn.title = animatorWorkspaceActive ? "Return to the modeling workspace" : "Open the full-screen animation editor";
    els.animatorWorkspaceOpenBtn.setAttribute("aria-pressed", String(animatorWorkspaceActive));
  }
  if (animatorWorkspaceActive) {
    els.animationSection?.classList.remove("collapsed");
    els.animationToggle?.setAttribute("aria-expanded", "true");
    if (els.showBonesInput) els.showBonesInput.checked = true;
    syncAnimatorClipSelect();
    rebuildBoneVisuals();
    updateAnimationPanel();
    if (typeof syncRigSelectionTargetUi === "function") syncRigSelectionTargetUi();
  }
  syncAnimatorTimelineCollapseUi();
  if (selected && typeof syncInspector === "function") syncInspector();
  requestAnimationFrame(() => {
    window.dispatchEvent(new Event("resize"));
    if (typeof resize === "function") resize();
  });
}

function initializeAnimatorWorkspace() {
  els.animatorWorkspaceOpenBtn?.addEventListener("click", () => setAnimatorWorkspace(!animatorWorkspaceActive));
  els.animatorTimelineCollapseBtn?.addEventListener("click", () => setAnimatorTimelineCollapsed(!animatorTimelineCollapsed));
  const miniTransport = {
    animatorMiniPrevBtn: "animationPrevBtn",
    animatorMiniPlayBtn: "animationPlayBtn",
    animatorMiniStopBtn: "animationStopBtn",
    animatorMiniNextBtn: "animationNextBtn",
    animatorMiniResetBtn: "animationResetBtn"
  };
  Object.entries(miniTransport).forEach(([miniId, fullId]) => {
    document.querySelector(`#${miniId}`)?.addEventListener("click", () => {
      document.querySelector(`#${fullId}`)?.click();
      requestAnimationFrame(syncAnimatorMiniTransportUi);
    });
  });
  els.animatorClipSelect?.addEventListener("change", event => {
    if (event.target.dataset.source === "bws") setActiveAnimationClip(event.target.value);
    else activateMinecraftAnimation(event.target.value);
    syncAnimatorClipSelect();
  });
  window.addEventListener("keydown", event => {
    if (event.key === "Escape" && animatorWorkspaceActive && !event.target.closest("input, select, textarea")) setAnimatorWorkspace(false);
  });
  syncAnimatorClipSelect();
  syncAnimatorTimelineCollapseUi();
}

initializeAnimatorWorkspace();
