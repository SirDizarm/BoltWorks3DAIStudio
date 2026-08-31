const BUILTIN_PLUGINS = Object.freeze([
  Object.freeze({ kind: "boltworks-plugin", manifestVersion: 1, id: "image-relief-mesh-lab", name: "Image to Mesh", version: "1.0.0", builtIn: true, enabled: true }),
  Object.freeze({ kind: "boltworks-plugin", manifestVersion: 1, id: "minecraft-modeling", name: "Minecraft Modeling", version: "1.0.0", builtIn: true, enabled: true,
    contributes: Object.freeze({ workspaces: ["minecraft"], importers: ["bbmodel"], exporters: ["neoforge-1.21.1"] }) }),
  Object.freeze({ kind: "boltworks-plugin", manifestVersion: 1, id: "scene-rendering", name: "Scene Rendering", version: "1.0.0", builtIn: true, enabled: false }),
  Object.freeze({ kind: "boltworks-plugin", manifestVersion: 1, id: "boltworks-game-engine", name: "BoltWorks Game Engine", version: "1.0.0", builtIn: true, enabled: true,
    contributes: Object.freeze({ exporters: ["glb", "bws-character"], runtimes: ["raylib-layered-character"] }) })
]);
const pluginRegistry = {
  imageReliefMeshLab: BUILTIN_PLUGINS[0],
  minecraftModeling: BUILTIN_PLUGINS[1],
  sceneRenderingTools: BUILTIN_PLUGINS[2],
  boltworksGameEngine: BUILTIN_PLUGINS[3]
};
let installedPluginManifests = [];

function validPluginManifest(value) {
  if (!value || value.kind !== "boltworks-plugin" || Number(value.manifestVersion) !== 1) throw new Error("This is not a BoltWorks plugin manifest v1.");
  if (!/^[a-z0-9][a-z0-9._-]{2,63}$/i.test(String(value.id || ""))) throw new Error("Plugin id must contain 3-64 letters, numbers, dots, dashes, or underscores.");
  if (!String(value.name || "").trim()) throw new Error("Plugin name is required.");
  return {
    kind: "boltworks-plugin", manifestVersion: 1, id: String(value.id), name: String(value.name).trim(),
    version: String(value.version || "1.0.0"), description: String(value.description || ""), enabled: value.enabled !== false,
    contributes: value.contributes && typeof value.contributes === "object" ? value.contributes : {}
  };
}

function loadInstalledPlugins() {
  try {
    const stored = JSON.parse(localStorage.getItem("boltworks.plugins.v1") || "[]");
    installedPluginManifests = Array.isArray(stored) ? stored.map(validPluginManifest) : [];
  } catch { installedPluginManifests = []; }
}

function saveInstalledPlugins() {
  localStorage.setItem("boltworks.plugins.v1", JSON.stringify(installedPluginManifests));
}

function allPluginManifests() { return [...BUILTIN_PLUGINS, ...installedPluginManifests]; }

function pluginTemplate() {
  return { kind: "boltworks-plugin", manifestVersion: 1, id: "my-plugin", name: "My BoltWorks Plugin", version: "1.0.0", description: "Describe what this plugin contributes.", contributes: { workspaces: [], importers: [], exporters: [] } };
}

function applyPluginAvailability(elements) {
  const pluginElements = [
    [elements.imageReliefMeshPlugin, pluginRegistry.imageReliefMeshLab],
    [elements.sceneRenderingTools, pluginRegistry.sceneRenderingTools],
    [elements.gameEnginePluginSection, pluginRegistry.boltworksGameEngine]
  ];
  for (const [element, plugin] of pluginElements) {
    if (!element) continue;
    element.hidden = !plugin.enabled;
    element.dataset.pluginEnabled = String(plugin.enabled);
  }
}

loadInstalledPlugins();
