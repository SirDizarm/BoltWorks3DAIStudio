const BUNDLED_PLUGINS = Object.freeze([]);
const pluginRegistry = {};
let installedPluginPackages = [];
let pluginEnabledPreferences = {};

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
}

loadInstalledPlugins();
const bwsPluginStorageReady=bwsLoadPluginDatabase();
bwsPluginStorageReady.catch(error=>console.error("Plugin storage unavailable; existing records retained:",error));
