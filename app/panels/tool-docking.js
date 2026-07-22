// Dock advanced tool groups before the main 3D bundle starts. Keeping this in
// a small independently cached file prevents an older cached studio bundle
// from leaving duplicate controls in the top toolbar after deployments.
function dockBoltWorksToolGroups() {
  const modelToolsBody = document.querySelector("#modelToolsBody");
  const outputToolsBody = document.querySelector("#outputToolsBody");
  const inspectorSection = document.querySelector("#inspectorSection");
  const utilitiesSection = document.querySelector("#utilitiesSection");
  const rightDock = inspectorSection?.parentElement;

  if (rightDock && utilitiesSection) {
    for (const sectionId of ["modelToolsWindow", "surfaceEditorWindow", "outputToolsWindow"]) {
      const section = document.querySelector(`#${sectionId}`);
      if (section) rightDock.insertBefore(section, utilitiesSection);
    }
  }

  for (const groupId of [
    "toolbarShapeBuilderGroup",
    "toolbarSelectionToolsGroup",
    "toolbarLineToolsGroup",
    "toolbarMarkerToolsGroup",
    "toolbarTriEditorGroup",
    "toolbarMiscToolsGroup"
  ]) {
    const group = document.querySelector(`#${groupId}`);
    if (group && modelToolsBody) modelToolsBody.append(group);
  }

  for (const groupId of ["toolbarViewsGroup", "toolbarImportExportGroup"]) {
    const group = document.querySelector(`#${groupId}`);
    if (group && outputToolsBody) outputToolsBody.append(group);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", dockBoltWorksToolGroups, { once: true });
} else {
  dockBoltWorksToolGroups();
}
