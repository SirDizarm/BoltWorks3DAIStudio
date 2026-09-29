const BUNDLED_PLUGINS = Object.freeze([]);
const pluginRegistry = {};
let installedPluginPackages = [];
let pluginEnabledPreferences = {};

function bwsValidAiTools(value, pluginId) {
  if (!Array.isArray(value) || !value.length || value.length > 64) throw new Error(`${pluginId} must declare 1-64 AI tools.`);
  const names = new Set();
  return value.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`${pluginId} AI tool ${index + 1} is invalid.`);
    const name = String(item.name || "");
    if (!/^[a-z][a-z0-9_.-]{2,63}$/i.test(name) || names.has(name)) throw new Error(`${pluginId} has an invalid or duplicate AI tool name: ${name}`);
    names.add(name);
    const description = String(item.description || "").trim();
    if (!description || description.length > 1000) throw new Error(`${name} needs a description no longer than 1000 characters.`);
    const access = item.access === "read" ? "read" : item.access === "edit" ? "edit" : null;
    if (!access) throw new Error(`${name} access must be read or edit.`);
    const handler = item.handler && typeof item.handler === "object" && !Array.isArray(item.handler) ? item.handler : {};
    const kind = ["connection", "bridge", "sculpt"].includes(handler.kind) ? handler.kind : null;
    if (!kind) throw new Error(`${name} has an unsupported handler.`);
    const method = kind === "bridge" ? String(handler.method || "") : "";
    if (kind === "bridge" && !/^[a-z][a-z0-9_.-]{1,79}$/i.test(method)) throw new Error(`${name} has an invalid bridge method.`);
    const inputSchema = access === "read"
      ? { type: "object", properties: {}, required: [], additionalProperties: false }
      : { type: "object", properties: { params: { type: "object" } }, required: ["params"], additionalProperties: false };
    return {
      name, description, access, handler: { kind, ...(method ? { method } : {}) }, inputSchema,
      annotations: { readOnlyHint: access === "read", destructiveHint: item.destructive === true, openWorldHint: false }
    };
  });
}

function validPluginManifest(value) {
  if (!value || value.kind !== "boltworks-plugin" || Number(value.manifestVersion) !== 1) throw new Error("This is not a BoltWorks plugin manifest v1.");
  if (!/^[a-z0-9][a-z0-9._-]{2,63}$/i.test(String(value.id || ""))) throw new Error("Plugin id must contain 3-64 letters, numbers, dots, dashes, or underscores.");
  if (!String(value.name || "").trim()) throw new Error("Plugin name is required.");
  return {
    kind: "boltworks-plugin", manifestVersion: 1, id: String(value.id), name: String(value.name).trim(),
    version: String(value.version || "1.0.0"), description: String(value.description || ""), enabled: value.enabled !== false,
    contributes: value.contributes && typeof value.contributes === "object" ? value.contributes : {},
    runtime: value.runtime === "sandbox-html" ? "sandbox-html" : "assets",
    entry: typeof value.entry === "string" ? value.entry : "",
    apiVersion: Number(value.apiVersion || 1),
    dependencies: Array.isArray(value.dependencies) ? value.dependencies.map(String) : []
  };
}

function validPluginPackage(value) {
  if (value?.kind === "boltworks-plugin") {
    return { kind: "boltworks-plugin-package", packageVersion: 1, manifest: validPluginManifest(value), files: {} };
  }
  if (!value || value.kind !== "boltworks-plugin-package" || Number(value.packageVersion) !== 1) throw new Error("This is not a BoltWorks .bwsplugin package v1.");
  const manifest = validPluginManifest(value.manifest);
  const files = Object.create(null);
  let totalSize=0;
  for (const [path, file] of Object.entries(value.files || {})) {
    const cleanPath = String(path).replace(/\\/g, "/").replace(/^\/+/, "");
    if (!cleanPath || cleanPath.includes("..") || cleanPath.length > 180 || /[:?#]/.test(cleanPath) || ["__proto__","constructor","prototype"].includes(cleanPath)) throw new Error(`Unsafe plugin file path: ${path}`);
    const data = typeof file === "string" ? file : String(file?.data || "");
    if (data.length > 4_000_000) throw new Error(`Plugin file is too large: ${cleanPath}`);
    totalSize+=data.length;if(totalSize>4_000_000||Object.keys(files).length>=128)throw Error("Plugin package exceeds 4 MB or 128 files.");
    if(Object.prototype.hasOwnProperty.call(files,cleanPath))throw Error("Duplicate plugin file path.");
    files[cleanPath] = { mediaType: String(file?.mediaType || "text/plain"), data };
  }
  const aiToolsFile = String(manifest.contributes?.aiToolsFile || "");
  if (aiToolsFile) {
    if (manifest.apiVersion !== 5) throw new Error("AI tool plugins require BWS plugin API version 5.");
    const source = files[aiToolsFile]?.data;
    if (!source) throw new Error("The AI tool contract is missing from this package.");
    let definitions;
    try { definitions = JSON.parse(source); }
    catch { throw new Error("The AI tool contract is not valid JSON."); }
    manifest.contributes = { ...manifest.contributes, aiTools: bwsValidAiTools(definitions, manifest.id) };
  }
  if(manifest.runtime==="sandbox-html"&&(!manifest.entry||!Object.prototype.hasOwnProperty.call(files,manifest.entry)))throw Error("Plugin entry HTML is missing from its package.");
  const installation=value.installation&&typeof value.installation==="object"?{source:String(value.installation.source||"local file"),sha256:String(value.installation.sha256||""),installedAt:String(value.installation.installedAt||"")}:null;
  return { kind: "boltworks-plugin-package", packageVersion: 1, manifest, files, installation };
}

function loadInstalledPlugins() {
  try {
    const stored = JSON.parse(localStorage.getItem("boltworks.pluginPackages.v1") || localStorage.getItem("boltworks.plugins.v1") || "[]");
    installedPluginPackages=[];
    if(Array.isArray(stored))for(const item of stored){try{installedPluginPackages.push(validPluginPackage(item));}catch(error){console.warn("A stored plugin was skipped, not deleted:",error.message);}}
  } catch { installedPluginPackages = []; }
  try { pluginEnabledPreferences = JSON.parse(localStorage.getItem("boltworks.pluginEnabled.v1") || "{}"); }
  catch { pluginEnabledPreferences = {}; }
}

let bwsPluginDbPromise=null;
let bwsPluginWriteQueue=Promise.resolve();
function bwsPluginDatabase(){
 if(!bwsPluginDbPromise)bwsPluginDbPromise=new Promise((resolve,reject)=>{
  const request=indexedDB.open('boltworks-plugin-packages',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('state');
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error||Error('Plugin database could not open.'));
  request.onblocked=()=>reject(Error('Close older BWS tabs and try again.'));
 });
 return bwsPluginDbPromise;
}
async function bwsPluginDatabaseState(value){
 const db=await bwsPluginDatabase();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('state',value?'readwrite':'readonly'),store=tx.objectStore('state');
  const request=value?store.put(value,'installed'):store.get('installed');
  tx.oncomplete=()=>resolve(request.result);
  tx.onabort=()=>reject(tx.error||Error('Plugin storage transaction failed.'));
  tx.onerror=()=>{};
 });
}
async function bwsLoadPluginDatabase(){
 const stored=await bwsPluginDatabaseState();
 if(stored){
  if(!Array.isArray(stored.packages)||!stored.preferences||typeof stored.preferences!=='object')throw Error('Plugin database is invalid; it has not been overwritten.');
  installedPluginPackages=stored.packages.map(validPluginPackage);
  pluginEnabledPreferences=stored.preferences;
 }else{
  await bwsPluginDatabaseState({packages:installedPluginPackages,preferences:pluginEnabledPreferences});
 }
 // Keep old localStorage records untouched as a migration backup.
 renderPluginManager();applyPluginAvailability(els);
}
function bwsCommitPluginState(update){
 const operation=bwsPluginWriteQueue.then(async()=>{
  await bwsPluginStorageReady;
  const next=update();
  await bwsPluginDatabaseState(next);
  installedPluginPackages=next.packages;pluginEnabledPreferences=next.preferences;
 });
 bwsPluginWriteQueue=operation.catch(()=>{});
 return operation;
}

function pluginIsEnabled(plugin) {
  return Object.prototype.hasOwnProperty.call(pluginEnabledPreferences, plugin.id)
    ? pluginEnabledPreferences[plugin.id] !== false
    : plugin.enabled !== false;
}

function allPluginManifests() {
  return [...BUNDLED_PLUGINS, ...installedPluginPackages.filter(p=>!BUNDLED_PLUGINS.some(b=>b.id===p.manifest.id)).map(pluginPackage => pluginPackage.manifest)]
    .map(plugin => ({ ...plugin, enabled: pluginIsEnabled(plugin) }));
}

function pluginManifestById(id) { return allPluginManifests().find(plugin => plugin.id === id) || null; }

async function setPluginEnabled(id,enabled){
 try{
  await bwsPluginStorageReady;
  const plugin=pluginManifestById(id);if(!plugin)return false;
  if(enabled){const problem=bwsPluginActivationError(id);if(problem){bwsPluginNotice(problem);return false;}}
  await bwsCommitPluginState(()=>({packages:installedPluginPackages,preferences:{...pluginEnabledPreferences,[id]:Boolean(enabled)}}));
  if(!enabled)bwsClosePluginWorkspace(id);
  return true;
 }catch(error){bwsPluginNotice('Could not save the plugin setting: '+error.message);return false;}
}
async function removeInstalledPlugin(id){
 try{
  await bwsPluginStorageReady;
  if(!installedPluginPackages.some(p=>p.manifest.id===id))return false;
  await bwsCommitPluginState(()=>{const preferences={...pluginEnabledPreferences};delete preferences[id];return {packages:installedPluginPackages.filter(p=>p.manifest.id!==id),preferences};});
  bwsClosePluginWorkspace(id);return true;
 }catch(error){bwsPluginNotice('Could not remove this plugin: '+error.message);return false;}
}

function pluginTemplate() {
  return {
    kind: "boltworks-plugin-package", packageVersion: 1,
    manifest: { kind: "boltworks-plugin", manifestVersion: 1, id: "my-plugin", name: "My BoltWorks Plugin", version: "1.0.0", description: "Describe what this optional extension contributes.", contributes: { panels: [], workspaces: [], importers: [], exporters: [] } },
    files: { "README.txt": { mediaType: "text/plain", data: "This package is stored as one .bwsplugin file. Add declarative assets here; executable scripts are not run automatically." } }
  };
}

function applyPluginAvailability(elements) {
  if(typeof bwsRefreshScenesToolbar === "function")bwsRefreshScenesToolbar();
  for (const element of document.querySelectorAll("[data-plugin-id]")) {
    const enabled = pluginManifestById(element.dataset.pluginId)?.enabled === true;
    element.hidden = !enabled;
    element.dataset.pluginEnabled = String(enabled);
  }
  const geometryNodesEnabled = pluginManifestById("geometry-nodes")?.enabled === true;
  if (typeof setGeometryNodesPluginEnabled === "function") setGeometryNodesPluginEnabled(geometryNodesEnabled);
  if (typeof bwsSculptInstallToolbarMenu === "function") bwsSculptInstallToolbarMenu(null);
  window.BwsAiPluginBridge?.refresh?.();
}

function bwsEnabledAiPluginDefinition() {
  for (const pluginPackage of installedPluginPackages) {
    const manifest = pluginManifestById(pluginPackage.manifest.id);
    const tools = manifest?.contributes?.aiTools;
    if (manifest?.enabled === true && Array.isArray(tools) && tools.length) {
      return { id: manifest.id, name: manifest.name, version: manifest.version, tools };
    }
  }
  return null;
}

loadInstalledPlugins();
const bwsPluginStorageReady=bwsLoadPluginDatabase();
bwsPluginStorageReady.catch(error=>console.error("Plugin storage unavailable; existing records retained:",error));
