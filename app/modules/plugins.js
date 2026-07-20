const pluginRegistry = Object.freeze({
  imageReliefMeshLab: Object.freeze({ id: "image-relief-mesh-lab", enabled: false }),
  sceneRenderingTools: Object.freeze({ id: "scene-rendering", enabled: false })
});

function applyPluginAvailability(elements) {
  const pluginElements = [
    [elements.imageReliefMeshPlugin, pluginRegistry.imageReliefMeshLab],
    [elements.sceneRenderingTools, pluginRegistry.sceneRenderingTools]
  ];
  for (const [element, plugin] of pluginElements) {
    if (!element) continue;
    element.hidden = !plugin.enabled;
    element.dataset.pluginEnabled = String(plugin.enabled);
  }
}
