let animatorWorkspaceActive = false;
let animatorBoneHome = null;
let animatorTimelineHome = null;

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
  }
  requestAnimationFrame(() => {
    window.dispatchEvent(new Event("resize"));
    if (typeof resize === "function") resize();
  });
}

function initializeAnimatorWorkspace() {
  els.animatorWorkspaceOpenBtn?.addEventListener("click", () => setAnimatorWorkspace(!animatorWorkspaceActive));
  els.animatorClipSelect?.addEventListener("change", event => {
    activateMinecraftAnimation(event.target.value);
    syncAnimatorClipSelect();
  });
  window.addEventListener("keydown", event => {
    if (event.key === "Escape" && animatorWorkspaceActive && !event.target.closest("input, select, textarea")) setAnimatorWorkspace(false);
  });
  syncAnimatorClipSelect();
}

initializeAnimatorWorkspace();
