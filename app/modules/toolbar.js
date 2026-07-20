const defaultToolbarVisibility = {
  transform: true,
  mirror: true,
  selectionTools: true,
  lineTools: true,
  markerTools: true,
  triEditor: true,
  miscTools: true,
  faceEdit: true,
  scene: true,
  projectFiles: true,
  views: true,
  importExport: true
};

function toolbarVisibilityState() {
  return {
    transform: els.toggleToolbarTransform?.checked ?? true,
    mirror: els.toggleToolbarMirror?.checked ?? true,
    selectionTools: els.toggleToolbarSelectionTools?.checked ?? true,
    lineTools: els.toggleToolbarLineTools?.checked ?? true,
    markerTools: els.toggleToolbarMarkerTools?.checked ?? true,
    triEditor: els.toggleToolbarTriEditor?.checked ?? true,
    miscTools: els.toggleToolbarMiscTools?.checked ?? true,
    faceEdit: els.toggleToolbarFaceEdit?.checked ?? true,
    scene: els.toggleToolbarScene?.checked ?? true,
    projectFiles: els.toggleToolbarProjectFiles?.checked ?? true,
    views: els.toggleToolbarViews?.checked ?? true,
    importExport: els.toggleToolbarImportExport?.checked ?? true
  };
}

function setToolbarToggleState(toolbarState = {}) {
  const state = { ...defaultToolbarVisibility, ...(toolbarState || {}) };
  if (toolbarState && toolbarState.project !== undefined) {
    if (toolbarState.projectFiles === undefined) state.projectFiles = !!toolbarState.project;
    if (toolbarState.views === undefined) state.views = !!toolbarState.project;
    if (toolbarState.importExport === undefined) state.importExport = !!toolbarState.project;
  }
  if (toolbarState && toolbarState.triangle !== undefined) {
    if (toolbarState.selectionTools === undefined) state.selectionTools = !!toolbarState.triangle;
    if (toolbarState.lineTools === undefined) state.lineTools = !!toolbarState.triangle;
    if (toolbarState.markerTools === undefined) state.markerTools = !!toolbarState.triangle;
    if (toolbarState.triEditor === undefined) state.triEditor = !!toolbarState.triangle;
    if (toolbarState.miscTools === undefined) state.miscTools = !!toolbarState.triangle;
  }
  if (els.toggleToolbarTransform) els.toggleToolbarTransform.checked = !!state.transform;
  if (els.toggleToolbarMirror) els.toggleToolbarMirror.checked = !!state.mirror;
  if (els.toggleToolbarSelectionTools) els.toggleToolbarSelectionTools.checked = !!state.selectionTools;
  if (els.toggleToolbarLineTools) els.toggleToolbarLineTools.checked = !!state.lineTools;
  if (els.toggleToolbarMarkerTools) els.toggleToolbarMarkerTools.checked = !!state.markerTools;
  if (els.toggleToolbarTriEditor) els.toggleToolbarTriEditor.checked = !!state.triEditor;
  if (els.toggleToolbarMiscTools) els.toggleToolbarMiscTools.checked = !!state.miscTools;
  if (els.toggleToolbarFaceEdit) els.toggleToolbarFaceEdit.checked = !!state.faceEdit;
  if (els.toggleToolbarScene) els.toggleToolbarScene.checked = !!state.scene;
  if (els.toggleToolbarProjectFiles) els.toggleToolbarProjectFiles.checked = !!state.projectFiles;
  if (els.toggleToolbarViews) els.toggleToolbarViews.checked = !!state.views;
  if (els.toggleToolbarImportExport) els.toggleToolbarImportExport.checked = !!state.importExport;
  return state;
}

function applyToolbarVisibility(toolbarState = toolbarVisibilityState()) {
  const state = { ...defaultToolbarVisibility, ...(toolbarState || {}) };
  if (toolbarState && toolbarState.project !== undefined) {
    if (toolbarState.projectFiles === undefined) state.projectFiles = !!toolbarState.project;
    if (toolbarState.views === undefined) state.views = !!toolbarState.project;
    if (toolbarState.importExport === undefined) state.importExport = !!toolbarState.project;
  }
  if (toolbarState && toolbarState.triangle !== undefined) {
    if (toolbarState.selectionTools === undefined) state.selectionTools = !!toolbarState.triangle;
    if (toolbarState.lineTools === undefined) state.lineTools = !!toolbarState.triangle;
    if (toolbarState.markerTools === undefined) state.markerTools = !!toolbarState.triangle;
    if (toolbarState.triEditor === undefined) state.triEditor = !!toolbarState.triangle;
    if (toolbarState.miscTools === undefined) state.miscTools = !!toolbarState.triangle;
  }
  els.toolbarTransformGroup?.classList.toggle("toolbar-hidden", !state.transform);
  els.toolbarMirrorGroup?.classList.toggle("toolbar-hidden", !state.mirror);
  els.toolbarSelectionToolsGroup?.classList.toggle("toolbar-hidden", !state.selectionTools);
  els.toolbarLineToolsGroup?.classList.toggle("toolbar-hidden", !state.lineTools);
  els.toolbarMarkerToolsGroup?.classList.toggle("toolbar-hidden", !state.markerTools);
  els.toolbarTriEditorGroup?.classList.toggle("toolbar-hidden", !state.triEditor);
  els.toolbarMiscToolsGroup?.classList.toggle("toolbar-hidden", !state.miscTools);
  els.toolbarFaceEditGroup?.classList.toggle("toolbar-hidden", !state.faceEdit);
  els.toolbarSceneGroup?.classList.toggle("toolbar-hidden", !state.scene);
  els.toolbarProjectFilesGroup?.classList.toggle("toolbar-hidden", !state.projectFiles);
  els.toolbarViewsGroup?.classList.toggle("toolbar-hidden", !state.views);
  els.toolbarImportExportGroup?.classList.toggle("toolbar-hidden", !state.importExport);
  return state;
}
