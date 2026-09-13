// Optional plugin installation. No downloaded code executes in the editor window.
const bwsPluginWindows=new Map();
let bwsPluginReviewBusy=false;
function bwsPluginDialog(title,message,acceptLabel="Continue",cancelLabel="Cancel"){
 return new Promise(resolve=>{
  const dialog=document.createElement("dialog");dialog.style.cssText="max-width:640px;max-height:calc(100dvh - 36px);overflow-y:auto;width:calc(100% - 36px);box-sizing:border-box;background:#172426;color:#eee5d3;border:1px solid #7f927a;border-radius:10px;padding:24px;font:inherit;";
  const heading=document.createElement("h2"),body=document.createElement("p"),actions=document.createElement("div"),accept=document.createElement("button"),cancel=document.createElement("button");heading.textContent=title;body.textContent=message;body.style.cssText="white-space:pre-wrap;line-height:1.55;overflow-wrap:anywhere";actions.style.cssText="display:flex;justify-content:flex-end;gap:10px";accept.textContent=acceptLabel;cancel.textContent=cancelLabel;
  const finish=value=>{dialog.close();dialog.remove();resolve(value);};accept.onclick=()=>finish(true);cancel.onclick=()=>finish(false);dialog.addEventListener("cancel",event=>{event.preventDefault();finish(false);});actions.append(cancel,accept);dialog.append(heading,body,actions);document.body.append(dialog);dialog.showModal();cancel.focus();
 });
}
function bwsPluginNotice(message){return bwsPluginDialog("Plugin information",message,"OK","Close");}
function bwsPluginActivationError(id){
 const p=installedPluginPackages.find(p=>p.manifest.id===id);if(!p)return "";
 if(![1,2,3,4].includes(p.manifest.apiVersion))return "This plugin requires an unsupported BWS plugin API version.";
 const missing=p.manifest.dependencies.filter(id=>!pluginManifestById(id)?.enabled);
 return missing.length?"Enable these plugin dependencies first: "+missing.join(", "):"";
}
function bwsClosePluginWorkspace(id){const panel=bwsPluginWindows.get(id);if(panel){panel.bwsCleanup?.();panel.remove();bwsPluginWindows.delete(id);}}
function bwsOpenPluginWorkspace(id){
 const p=installedPluginPackages.find(p=>p.manifest.id===id);if(!p||!pluginManifestById(id)?.enabled)throw Error("Enable this installed plugin first.");
 const error=bwsPluginActivationError(id);if(error)throw Error(error);
 if(p.manifest.runtime!=="sandbox-html")throw Error("This is a data package, not an executable workspace.");
 bwsClosePluginWorkspace(id);
 const dialog=document.createElement("dialog");dialog.style.cssText="width:90vw;height:85vh;padding:12px;background:#142125;color:#eee;max-width:none;max-height:none;border:1px solid #63766b;";
 const header=document.createElement("div"),name=document.createElement("strong"),close=document.createElement("button"),frame=document.createElement("iframe");header.style.cssText="display:flex;align-items:center;justify-content:space-between;height:42px";name.textContent=p.manifest.name+" / isolated plugin";close.textContent="Close";close.onclick=()=>bwsClosePluginWorkspace(id);header.append(name,close);
 if(p.manifest.contributes?.fullscreen===true){frame.allow="fullscreen";frame.allowFullscreen=true;}
 frame.title=p.manifest.name;frame.style.cssText="width:100%;height:calc(100% - 48px);border:0;background:#fff";frame.setAttribute("sandbox","allow-scripts");frame.referrerPolicy="no-referrer";
 // No same-origin permission, forms, direct downloads, popups or native access.
 // API 2 exposes only an explicit, read-only model snapshot and a reviewed ZIP download.
 if(p.manifest.apiVersion>=2) bwsAttachPluginExportBridge(p,dialog,header,frame);
 if(p.manifest.apiVersion===3&&p.manifest.contributes?.generatedMesh===true)bwsAttachPluginGeneratorBridge(p,dialog,header,frame);
 if(p.manifest.apiVersion===4)bwsAttachPluginCharacterBridge(p,dialog,header,frame);
 if(p.manifest.apiVersion===4&&p.manifest.contributes?.graphWorkspace===true)bwsAttachPluginGraphBridge(p,dialog,header,frame);
 const csp="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
 frame.srcdoc='<!doctype html><meta http-equiv="Content-Security-Policy" content="'+csp+'"><meta name="referrer" content="no-referrer">'+p.files[p.manifest.entry].data;
 dialog.append(header,frame);document.body.append(dialog);bwsPluginWindows.set(id,dialog);dialog.addEventListener("cancel",()=>bwsClosePluginWorkspace(id));dialog.showModal();
}
async function bwsPluginFetch(url){
 const parsed=new URL(url);if(parsed.protocol!=="https:")throw Error("Use an HTTPS package URL, or install a downloaded local file.");
 if(parsed.username||parsed.password)throw Error("Credentials in plugin URLs are not allowed.");
 const hostname=parsed.hostname.toLowerCase();if(hostname==="localhost"||hostname.endsWith(".local")||hostname.endsWith(".localhost")||hostname.includes(":")||/^\d+\.\d+\.\d+\.\d+$/.test(hostname))throw Error("Use a public HTTPS hostname, or install from a local file.");
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
 try{
  const response=await fetch(parsed.href,{signal:controller.signal,credentials:"omit",referrerPolicy:"no-referrer",redirect:"error"});
  if(!response.ok)throw Error("Plugin download failed (HTTP "+response.status+").");
  if(Number(response.headers.get("content-length"))>4_000_000)throw Error("Plugin download exceeds 4 MB.");
  const reader=response.body.getReader(),decoder=new TextDecoder();let text="",size=0;
  while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>4_000_000){await reader.cancel();throw Error("Plugin download exceeds 4 MB.");}text+=decoder.decode(part.value,{stream:true});}return text+decoder.decode();
 }finally{clearTimeout(timer);}
}
async function bwsPluginFromUrl(input){
 const url=new URL(input.trim());
 if(url.hostname.toLowerCase()==="github.com"){
  const parts=url.pathname.split("/").filter(Boolean);
  if(parts.length===2){
   const owner=encodeURIComponent(parts[0]),repo=encodeURIComponent(parts[1].replace(/\.git$/,""));
   const metadata=JSON.parse(await bwsPluginFetch("https://api.github.com/repos/"+owner+"/"+repo+"/contents/plugin.bwsplugin"));
   if(metadata.type!=="file")throw Error("The repository must contain a root plugin.bwsplugin file.");
   if(Number(metadata.size)>4_000_000)throw Error("Plugin package exceeds 4 MB.");
   let text;
   if(metadata.encoding==="base64"&&typeof metadata.content==="string"&&metadata.content.trim()){
    text=new TextDecoder().decode(Uint8Array.from(atob(metadata.content.replace(/\s/g,"")),c=>c.charCodeAt(0)));
   }else{
    // GitHub omits inline contents for files larger than 1 MB.
    // Only accept its raw-file host for the same repository and package path.
    const raw=new URL(String(metadata.download_url||""));
    const segments=raw.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    if(raw.protocol!=="https:"||raw.hostname!=="raw.githubusercontent.com"||raw.username||raw.password||segments[0]?.toLowerCase()!==parts[0].toLowerCase()||segments[1]?.toLowerCase()!==parts[1].replace(/\.git$/,"").toLowerCase()||segments.at(-1)!=="plugin.bwsplugin")throw Error("GitHub did not provide a valid package download for this repository.");
    text=await bwsPluginFetch(raw.href);
   }
   return {text,source:url.href+" (GitHub file "+metadata.sha+")"};
  }
  if(parts.length>=5&&parts[2]==="blob"){
   const raw="https://raw.githubusercontent.com/"+[parts[0],parts[1],...parts.slice(3)].join("/");return {text:await bwsPluginFetch(raw),source:raw};
  }
  throw Error("Use a GitHub repository root containing plugin.bwsplugin, a GitHub file link, or a direct HTTPS package URL.");
 }
 return {text:await bwsPluginFetch(url.href),source:url.href};
}
function bwsPluginContributionSummary(manifest){
 const contributes=manifest.contributes||{};
 const lines=[];
 if(manifest.runtime==="sandbox-html"){
  if(contributes.toolbar==="scenes"){
   lines.push("What this adds: a separate scene workspace you can open and interact with.");
   lines.push("Where to find it: enable the plugin, then turn on Scenes under Toolbars. Look for the "+manifest.name+" button in that toolbar.");
  }else{
   lines.push("What this adds: a separate interactive plugin workspace.");
   lines.push("Where to find it: enable the plugin in Plugins, then choose Open on its entry.");
  }
  if(manifest.apiVersion===3&&contributes.generatedMesh===true){lines.push("Can generate a mesh from an image you choose. Choose Add mesh to BWS to insert its validated result without replacing existing objects. An explicitly requested AI generation command can also insert the result. The plugin cannot directly edit or read your scene.");}else lines.push(manifest.apiVersion===2&&contributes.modelSnapshot===true?"Your current model stays unchanged. Choosing Send current model shares a copy of all meshes (including hidden parts), their groups and the texture library with this plugin. It cannot edit your project.":"Your current model stays unchanged. Access is limited to the explicitly listed capabilities below. Without a sharing or insertion capability, it cannot access or change your project.");
  if(manifest.apiVersion===2&&contributes.exportDownload===true)lines.push("Can return a ZIP for you to download. BWS only saves it when you choose Download ZIP.");
  if(manifest.apiVersion===4&&contributes.characterSnapshot===true)lines.push("Choosing Send character copy shares the rigged character and bound parts (including hidden parts), skeleton, animation clips and their textures. The plugin cannot directly edit the project.");
  if(manifest.apiVersion===4&&contributes.characterExport===true)lines.push("Can prepare a character ZIP or arm GLB. Files are saved only when you choose Download export.");
  if(manifest.apiVersion===4&&contributes.generatedGameItem===true)lines.push("Can generate a sword or shield from your image. Choosing Add item to BWS inserts validated geometry and textures into a new group, with equipment metadata and a matching grip socket if present. Existing objects are kept; the insertion can be undone.");
  if(manifest.apiVersion===4&&contributes.graphWorkspace===true)lines.push("Can receive a copy of your saved graph library and textures when you choose Send graphs. Save graphs to BWS saves recipe edits. Add generated copy inserts validated mesh parts; replacing a graph output requires a separate confirmation and can be undone. Can prepare graph files for explicit download. Scene Studio can request recipe-only tree and rock previews through this plugin.");
  if(contributes.fullscreen===true)lines.push("Includes fullscreen viewing when you choose it inside the plugin.");
 }else{
  lines.push("What this adds: a data package, not an interactive workspace. Its description explains the intended contents.");
 }
 lines.push("You can disable or remove it later in Plugins.");
 return lines.join("\n\n");
}
async function bwsReviewPluginInstall(text,source){
 if(bwsPluginReviewBusy)throw Error("Finish the current plugin review first.");bwsPluginReviewBusy=true;
 try{
  await bwsPluginStorageReady;
  if(new TextEncoder().encode(text).length>4_000_000)throw Error("Plugin package exceeds 4 MB.");
  const p=validPluginPackage(JSON.parse(text)),m=p.manifest;
  if(BUNDLED_PLUGINS.some(b=>b.id===m.id))throw Error("This ID belongs to an included compatibility module. Replacing built-in code is not supported in this first loader release.");
  if(![1,2,3,4].includes(m.apiVersion))throw Error("Unsupported plugin API version: "+m.apiVersion);
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text)),hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("");
  const existing=installedPluginPackages.find(p=>p.manifest.id===m.id);
  const approved=await bwsPluginDialog(existing?"Review plugin replacement":"Review plugin installation",m.name+" / "+m.version+"\n"+m.description+"\n\n"+bwsPluginContributionSummary(m)+"\n\nTechnical details\nSource: "+source+"\nRuntime: "+(m.runtime==="sandbox-html"?"Isolated HTML workspace. No direct editor, network or filesystem access. Any model sharing or ZIP download listed above requires your action.":"Data package; no executable workspace.")+"\nDependencies: "+(m.dependencies.join(", ")||"None")+"\nSHA-256: "+hash+"\n\n"+(existing?"Replaces installed version "+existing.manifest.version+". ":"")+"The plugin is off by default after installation. Turn it on in Plugins when you want to use it. Updates are only installed when you choose.",existing?"Update plugin":"Install plugin");
  if(!approved)return false;
  p.installation={source,sha256:hash,installedAt:new Date().toISOString()};
  try{await bwsCommitPluginState(()=>({packages:[...installedPluginPackages.filter(old=>old.manifest.id!==m.id),p],preferences:{...pluginEnabledPreferences,[m.id]:false}}));}
  catch(error){throw Error('Could not save this package. Previous installations are unchanged. '+error.message);}
  bwsClosePluginWorkspace(m.id);renderPluginManager();applyPluginAvailability(els);log("Installed "+m.name+" disabled. Enable it in Plugins when ready.");return true;
 }finally{bwsPluginReviewBusy=false;}
}
function bwsEnsurePluginInstallUi(){
 const host=document.getElementById("pluginManagerBody");if(!host)return;bwsEnsurePluginCatalogueUi(host);if(host.querySelector("[data-plugin-url-install]"))return;
 const row=document.createElement("div"),input=document.createElement("input"),button=document.createElement("button"),status=document.createElement("p");row.dataset.pluginUrlInstall="true";row.style.cssText="display:flex;gap:6px;flex-wrap:wrap;margin:10px 0";input.type="url";input.placeholder="GitHub repository or HTTPS .bwsplugin URL";input.setAttribute("aria-label","Plugin repository or package URL");input.style.cssText="flex:1;min-width:180px";button.type="button";button.textContent="Review URL install";status.setAttribute("role","status");status.style.cssText="font-size:12px;overflow-wrap:anywhere";
 button.onclick=async()=>{button.disabled=true;status.textContent="Downloading package for review...";try{const download=await bwsPluginFromUrl(input.value);const installed=await bwsReviewPluginInstall(download.text,download.source);status.textContent=installed?"Plugin installed. It is off by default; choose Enable in Plugins to turn it on.":"Installation cancelled.";}catch(error){status.textContent=error.message+" If the host blocks cross-origin downloads, download the package yourself and use Install from file.";}finally{button.disabled=false;}};
 row.append(input,button);host.insertBefore(status,document.getElementById("pluginList"));host.insertBefore(row,status);
}
