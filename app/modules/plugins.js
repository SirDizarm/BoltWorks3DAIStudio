const BUNDLED_PLUGINS = Object.freeze([
  Object.freeze({ kind: "boltworks-plugin", manifestVersion: 1, id: "image-relief-mesh-lab", name: "Image to Mesh", version: "1.0.0", bundled: true, enabled: true }),
  Object.freeze({ kind: "boltworks-plugin", manifestVersion: 1, id: "minecraft-modeling", name: "Minecraft Modeling", version: "1.0.0", bundled: true, enabled: true,
    contributes: Object.freeze({ workspaces: ["minecraft"], importers: ["bbmodel"], exporters: ["neoforge-1.21.1"] }) }),
  Object.freeze({ kind: "boltworks-plugin", manifestVersion: 1, id: "scene-rendering", name: "Scene Rendering", version: "1.0.0", bundled: true, enabled: false }),
  Object.freeze({ kind: "boltworks-plugin", manifestVersion: 1, id: "boltworks-game-engine", name: "BoltWorks Game Engine", version: "1.0.0", bundled: true, enabled: true,
    contributes: Object.freeze({ exporters: ["glb", "bws-character"], runtimes: ["raylib-layered-character"] }) }),
  Object.freeze({ kind: "boltworks-plugin", manifestVersion: 1, id: "geometry-nodes", name: "Geometry Nodes", version: "0.1.0", bundled: true, enabled: false,
    description: "A lightweight procedural node graph for building editable low-poly assets.",
    contributes: Object.freeze({ panels: ["geometry-nodes"], generators: ["procedural-tree", "procedural-rocks", "procedural-stone-wall"] }) })
]);
const pluginRegistry = {
  imageReliefMeshLab: BUNDLED_PLUGINS[0],
  minecraftModeling: BUNDLED_PLUGINS[1],
  sceneRenderingTools: BUNDLED_PLUGINS[2],
  boltworksGameEngine: BUNDLED_PLUGINS[3],
  geometryNodes: BUNDLED_PLUGINS[4]
};
let installedPluginPackages = [];
let pluginEnabledPreferences = {};

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

function validPluginPackage(value) {
  if (value?.kind === "boltworks-plugin") {
    return { kind: "boltworks-plugin-package", packageVersion: 1, manifest: validPluginManifest(value), files: {} };
  }
  if (!value || value.kind !== "boltworks-plugin-package" || Number(value.packageVersion) !== 1) throw new Error("This is not a BoltWorks .bwsplugin package v1.");
  const manifest = validPluginManifest(value.manifest);
  const files = {};
  for (const [path, file] of Object.entries(value.files || {})) {
    const cleanPath = String(path).replace(/\\/g, "/").replace(/^\/+/, "");
    if (!cleanPath || cleanPath.includes("..") || cleanPath.length > 180) throw new Error(`Unsafe plugin file path: ${path}`);
    const data = typeof file === "string" ? file : String(file?.data || "");
    if (data.length > 2_000_000) throw new Error(`Plugin file is too large: ${cleanPath}`);
    files[cleanPath] = { mediaType: String(file?.mediaType || "text/plain"), data };
  }
  return { kind: "boltworks-plugin-package", packageVersion: 1, manifest, files };
}

function loadInstalledPlugins() {
  try {
    const stored = JSON.parse(localStorage.getItem("boltworks.pluginPackages.v1") || localStorage.getItem("boltworks.plugins.v1") || "[]");
    installedPluginPackages = Array.isArray(stored) ? stored.map(validPluginPackage) : [];
  } catch { installedPluginPackages = []; }
  try { pluginEnabledPreferences = JSON.parse(localStorage.getItem("boltworks.pluginEnabled.v1") || "{}"); }
  catch { pluginEnabledPreferences = {}; }
}

function saveInstalledPlugins() {
  localStorage.setItem("boltworks.pluginPackages.v1", JSON.stringify(installedPluginPackages));
  localStorage.setItem("boltworks.pluginEnabled.v1", JSON.stringify(pluginEnabledPreferences));
}

function pluginIsEnabled(plugin) {
  return Object.prototype.hasOwnProperty.call(pluginEnabledPreferences, plugin.id)
    ? pluginEnabledPreferences[plugin.id] !== false
    : plugin.enabled !== false;
}

function allPluginManifests() {
  return [...BUNDLED_PLUGINS, ...installedPluginPackages.map(pluginPackage => pluginPackage.manifest)]
    .map(plugin => ({ ...plugin, enabled: pluginIsEnabled(plugin) }));
}

function pluginManifestById(id) { return allPluginManifests().find(plugin => plugin.id === id) || null; }

function setPluginEnabled(id, enabled) {
  const plugin = pluginManifestById(id);
  if (!plugin) return false;
  pluginEnabledPreferences[id] = Boolean(enabled);
  saveInstalledPlugins();
  return true;
}

function removeInstalledPlugin(id) {
  const index = installedPluginPackages.findIndex(pluginPackage => pluginPackage.manifest.id === id);
  if (index < 0) return false;
  installedPluginPackages.splice(index, 1);
  delete pluginEnabledPreferences[id];
  saveInstalledPlugins();
  return true;
}

function pluginTemplate() {
  return {
    kind: "boltworks-plugin-package", packageVersion: 1,
    manifest: { kind: "boltworks-plugin", manifestVersion: 1, id: "my-plugin", name: "My BoltWorks Plugin", version: "1.0.0", description: "Describe what this optional extension contributes.", contributes: { panels: [], workspaces: [], importers: [], exporters: [] } },
    files: { "README.txt": { mediaType: "text/plain", data: "This package is stored as one .bwsplugin file. Add declarative assets here; executable scripts are not run automatically." } }
  };
}

function applyPluginAvailability(elements) {
  for (const element of document.querySelectorAll("[data-plugin-id]")) {
    const enabled = pluginManifestById(element.dataset.pluginId)?.enabled === true;
    element.hidden = !enabled;
    element.dataset.pluginEnabled = String(enabled);
  }
  const minecraftEnabled = pluginManifestById("minecraft-modeling")?.enabled === true;
  const minecraftOption = elements.workspaceSelect?.querySelector('option[value="minecraft"]');
  if (minecraftOption) minecraftOption.hidden = !minecraftEnabled;
  if (!minecraftEnabled && document.body.dataset.workspace === "minecraft") setWorkspace("general", { quiet: true });
  const geometryNodesEnabled = pluginManifestById("geometry-nodes")?.enabled === true;
  if (typeof setGeometryNodesPluginEnabled === "function") setGeometryNodesPluginEnabled(geometryNodesEnabled);
}

loadInstalledPlugins();
