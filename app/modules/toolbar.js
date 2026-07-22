const defaultToolbarVisibility = {
  transform: true,
  mirror: true,
  scene: true,
  projectFiles: true
};

function toolbarVisibilityState() {
  return {
    transform: els.toggleToolbarTransform?.checked ?? true,
    mirror: els.toggleToolbarMirror?.checked ?? true,
    scene: els.toggleToolbarScene?.checked ?? true,
    projectFiles: els.toggleToolbarProjectFiles?.checked ?? true
  };
}

function setToolbarToggleState(toolbarState = {}) {
  const state = { ...defaultToolbarVisibility, ...(toolbarState || {}) };
  if (toolbarState && toolbarState.project !== undefined) {
    if (toolbarState.projectFiles === undefined) state.projectFiles = !!toolbarState.project;
  }
  if (els.toggleToolbarTransform) els.toggleToolbarTransform.checked = !!state.transform;
  if (els.toggleToolbarMirror) els.toggleToolbarMirror.checked = !!state.mirror;
  if (els.toggleToolbarScene) els.toggleToolbarScene.checked = !!state.scene;
  if (els.toggleToolbarProjectFiles) els.toggleToolbarProjectFiles.checked = !!state.projectFiles;
  return state;
}

function applyToolbarVisibility(toolbarState = toolbarVisibilityState()) {
  const state = { ...defaultToolbarVisibility, ...(toolbarState || {}) };
  if (toolbarState && toolbarState.project !== undefined) {
    if (toolbarState.projectFiles === undefined) state.projectFiles = !!toolbarState.project;
  }
  els.toolbarTransformGroup?.classList.toggle("toolbar-hidden", !state.transform);
  els.toolbarMirrorGroup?.classList.toggle("toolbar-hidden", !state.mirror);
  els.toolbarSceneGroup?.classList.toggle("toolbar-hidden", !state.scene);
  els.toolbarProjectFilesGroup?.classList.toggle("toolbar-hidden", !state.projectFiles);
  return state;
}
