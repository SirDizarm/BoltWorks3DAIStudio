
let bwsUsdUiActive = false;
const bwsUsdPointers = new Map();
window.addEventListener("pointerdown", event => bwsUsdPointers.set(event.pointerId,event.target), true);
window.addEventListener("pointerup", event => bwsUsdPointers.delete(event.pointerId), true);
window.addEventListener("pointercancel", event => bwsUsdPointers.delete(event.pointerId), true);
function beginUsdUi() {
  bwsUsdUiActive = true;
  if(document.pointerLockElement) document.exitPointerLock?.();
  for(const [id,element] of bwsUsdPointers) {
    for(const candidate of [element,renderer?.domElement,gameplayCanvas])try{if(candidate?.hasPointerCapture?.(id))candidate.releasePointerCapture(id);}catch{}
  }
  bwsUsdPointers.clear();
  gameplayKeys.clear(); gameplayMouseButtons.clear(); gameplayCameraLocked=false;
}
function endUsdUi() {
  bwsUsdUiActive=false;
  gameplayKeys.clear(); gameplayMouseButtons.clear();
  // Gameplay resumes on its existing deliberate canvas click, never on focus return.
}
document.addEventListener("pointerlockchange",()=>{if(bwsUsdUiActive&&document.pointerLockElement)document.exitPointerLock?.();});
function usdMessage(text) { log("USD: "+text); }

async function exportStudioUsd(format) {
  const button=document.querySelector("#exportUsdBtn");
  if(button)button.disabled=true;
  try {
    const targets=objects.filter(object=>!object.userData?.editorHelper);
    const result=await createUsdPackage(targets);
    const name=gameCharacterSafeName(currentProjectBaseName(),"boltworks-model");
    if(format==="usdz")downloadBlob(name+".usdz",new Blob([result.archive],{type:"model/vnd.usdz+zip"}));
    else {
      result.files["README.txt"]=usdZip.strToU8("Open model.usda in Omniverse or another USD application. Keep geometries/ and textures/ beside it. This is a static scene snapshot; skeletons and animation are not included.");
      downloadBlob(name+"-usd.zip",new Blob([usdZip.zipSync(result.files,{level:6})],{type:"application/zip"}));
    }
    usdMessage("Exported "+result.meshCount+" mesh parts with "+result.textureCount+" packaged textures.");
    result.warnings.forEach(usdMessage);
    return true;
  } catch(error){usdMessage("Export stopped: "+(error?.message||error));throw error;}
  finally {if(button)button.disabled=false;}
}

function openUsdExportDialog() {
  if(bwsUsdUiActive)return;
  beginUsdUi();
  const previousFocus=document.activeElement;
  const dialog=document.createElement("dialog");
  dialog.id="bwsUsdExportDialog";
  dialog.style.cssText="max-width:540px;width:calc(100% - 48px);max-height:80vh;overflow:auto;padding:24px;background:#172426;color:#eee5d3;border:1px solid #738b77;border-radius:8px;cursor:auto";
  const title=document.createElement("h2"),description=document.createElement("p"),status=document.createElement("p"),buttons=document.createElement("div");
  title.textContent="Export USD / Omniverse";
  description.textContent="Export a static snapshot with packaged textures. USDZ is one file; the USDA bundle contains editable scene files and textures. Animation and skeletons are not included. Unsupported textures or materials stop export with an explanation.";
  status.setAttribute("role","status");
  buttons.style.cssText="display:flex;flex-wrap:wrap;gap:10px";
  let busy=false;
  for(const [format,label]of [["usdz","Export USDZ"],["usda","Export USDA bundle"]]){
    const button=document.createElement("button");button.type="button";button.textContent=label;
    button.onclick=async()=>{
      if(busy)return;busy=true;status.textContent="Checking textures and creating package...";
      for(const control of buttons.querySelectorAll("button"))control.disabled=true;
      try{await exportStudioUsd(format);dialog.close();}
      catch(error){status.textContent=error?.message||String(error);}
      finally{busy=false;for(const control of buttons.querySelectorAll("button"))control.disabled=false;}
    };buttons.append(button);
  }
  const cancel=document.createElement("button");cancel.type="button";cancel.textContent="Back";cancel.onclick=()=>dialog.close();buttons.append(cancel);
  dialog.addEventListener("cancel",event=>{if(busy)event.preventDefault();});
  for(const type of ["keydown","keyup","mousedown","mouseup","wheel"])dialog.addEventListener(type,event=>event.stopPropagation());
  dialog.addEventListener("close",()=>{dialog.remove();endUsdUi();previousFocus?.focus?.();});
  const closeOnNavigation=()=>{if(dialog.open&&!busy)dialog.close();};
  window.addEventListener("popstate",closeOnNavigation);
  dialog.addEventListener("close",()=>window.removeEventListener("popstate",closeOnNavigation),{once:true});
  dialog.append(title,description,status,buttons);document.body.append(dialog);dialog.showModal();cancel.focus();
}

function chooseUsdMissingTexture(path) {
  beginUsdUi();
  const previousFocus=document.activeElement;
  return new Promise(resolve=>{
    const dialog=document.createElement("dialog");
    dialog.id="bwsUsdTextureDialog";
    dialog.style.cssText="max-width:540px;width:calc(100% - 48px);max-height:80vh;overflow:auto;padding:24px;background:#172426;color:#eee5d3;border:1px solid #738b77;border-radius:8px;cursor:auto";
    const title=document.createElement("h2"),description=document.createElement("p"),filename=document.createElement("p"),input=document.createElement("input"),status=document.createElement("p"),use=document.createElement("button"),cancel=document.createElement("button");
    title.textContent="Locate missing USD texture";
    description.textContent="Choose an image from any folder, then press Use this image. Only the texture below will be replaced.";
    filename.textContent=path;filename.style.overflowWrap="anywhere";
    input.type="file";input.accept=".png,.jpg,.jpeg,.webp,.bmp,.gif,.avif";
    input.setAttribute("aria-label","Replacement texture image");
    input.style.cssText="display:block;width:100%;margin:16px 0;cursor:pointer";
    status.setAttribute("role","status");status.textContent="No replacement image selected.";
    use.type="button";use.textContent="Use this image";use.disabled=true;
    cancel.type="button";cancel.textContent="Cancel import";cancel.style.marginLeft="12px";
    let selected=null,finished=false;
    const finish=value=>{
      if(finished)return;finished=true;
      window.removeEventListener("popstate",back);window.removeEventListener("focus",onFocus);
      if(dialog.open)dialog.close();dialog.remove();previousFocus?.focus?.();
      resolve(value);
    };
    const updateSelection=()=>{
      if(finished)return;
      selected=input.files?.[0]||null;
      use.disabled=!selected;
      status.textContent=selected?"Selected: "+selected.name+". Press Use this image to continue.":"No replacement image selected.";
    };
    const onFocus=()=>setTimeout(updateSelection,200);
    const back=()=>finish(null);
    for(const event of ["input","change","cancel"])input.addEventListener(event,e=>{e.stopPropagation();updateSelection();});
    window.addEventListener("focus",onFocus);
    use.onclick=()=>{updateSelection();if(selected){usdMessage("Applying replacement: "+selected.name+" for "+path);finish(selected);}};
    cancel.onclick=()=>finish(null);
    dialog.addEventListener("cancel",event=>{event.preventDefault();finish(null);});
    dialog.addEventListener("close",()=>finish(null));
    window.addEventListener("popstate",back);
    for(const type of ["keydown","keyup","mousedown","mouseup","pointerdown","pointerup","wheel"])dialog.addEventListener(type,event=>event.stopPropagation());
    dialog.append(title,description,filename,input,status,use,cancel);document.body.append(dialog);dialog.showModal();input.focus();
  });
}

async function loadUsdWithTexturePrompts(files) {
  const replacements=new Map();
  while(true){
    try{return await loadUsdFiles(files,replacements);}
    catch(error){
      if(error?.code!=="USD_MISSING_TEXTURE")throw error;
      if(replacements.has(error.texturePath))throw new Error("The selected image could not be linked to "+error.texturePath+". Please provide the USD file so this reference can be investigated.");
      const image=await chooseUsdMissingTexture(error.texturePath);
      if(!image)throw new Error("Import cancelled. The scene was not changed.");
      replacements.set(error.texturePath,image);
    }
  }
}

function confirmUsdAssetLicense(files) {
  beginUsdUi();
  const previousFocus=document.activeElement;
  return new Promise(resolve=>{
    const dialog=document.createElement("dialog");
    dialog.id="bwsUsdLicenseDialog";
    dialog.setAttribute("aria-labelledby","bwsUsdLicenseTitle");
    dialog.style.cssText="max-width:600px;width:calc(100% - 48px);max-height:80vh;overflow:auto;padding:24px;background:#172426;color:#eee5d3;border:1px solid #738b77;border-radius:8px;cursor:auto";
    const title=document.createElement("h2");title.id="bwsUsdLicenseTitle";title.textContent="Asset permissions before import";
    const names=document.createElement("p");names.textContent=Array.from(files,file=>file.name).join(", ");names.style.overflowWrap="anywhere";
    const notice=document.createElement("p");notice.textContent="USD is an open file format, not proof of ownership or a license. If you use assets owned by or supplied through NVIDIA Omniverse, you must comply with the license supplied with the asset pack and all applicable NVIDIA and third-party license agreements. Free to download does not mean unrestricted use.";
    const rules=document.createElement("p");rules.textContent="Import only assets you created, own, or are licensed or otherwise authorized to use. Do not copy, share, sell, publish or redistribute someone else's work without the necessary rights. Converting a file does not change its license. Keep copyright, attribution and license notices with the assets.";
    const links=document.createElement("p");
    for(const [label,url]of [["NVIDIA Omniverse licensing","https://docs.omniverse.nvidia.com/dev-overview/latest/common/NVIDIA_Omniverse_License_Agreement.html"],["NVIDIA asset pack information","https://docs.omniverse.nvidia.com/usd/latest/usd_content_samples/downloadable_packs.html"]]){
      const link=document.createElement("a");link.textContent=label;link.href=url;link.target="_blank";link.rel="noopener noreferrer";link.style.cssText="color:#77dfbd;display:block;margin:8px 0";links.append(link);
    }
    const label=document.createElement("label"),check=document.createElement("input"),words=document.createElement("span");
    check.type="checkbox";words.textContent=" I confirm I have the necessary rights to use these assets. I will comply with applicable laws and all relevant asset licenses, including NVIDIA terms where applicable, and accept responsibility for my use and sharing of the assets.";label.style.cssText="display:block;margin:18px 0;cursor:pointer";label.append(check,words);
    const buttons=document.createElement("div");buttons.style.cssText="display:flex;gap:12px;flex-wrap:wrap";
    const proceed=document.createElement("button"),cancel=document.createElement("button");proceed.type=cancel.type="button";
    proceed.textContent="Continue import";proceed.disabled=true;cancel.textContent="Cancel";
    check.addEventListener("change",()=>{proceed.disabled=!check.checked;});
    const disclaimer=document.createElement("p");disclaimer.textContent="BoltWorks 3D AI Studio is a tool for designing, viewing, modifying and converting files. It does not grant ownership or permission to use third-party assets, verify your asset rights, or authorize unlawful use. You are responsible for obtaining the necessary permissions and complying with applicable laws and licenses. To the extent permitted by applicable law, the developer disclaims liability for your unauthorized or unlawful use, copying or distribution of third-party assets. Nothing in this notice excludes liability that cannot lawfully be excluded. This confirmation does not replace an asset license or imply NVIDIA endorsement.";disclaimer.style.fontSize="12px";
    let finished=false;
    const finish=accepted=>{if(finished)return;finished=true;window.removeEventListener("popstate",back);if(dialog.open)dialog.close();dialog.remove();previousFocus?.focus?.();resolve(accepted);};
    const back=()=>finish(false);
    proceed.onclick=()=>{if(check.checked)finish(true);};cancel.onclick=()=>finish(false);
    dialog.addEventListener("cancel",event=>{event.preventDefault();finish(false);});dialog.addEventListener("close",()=>finish(false));
    window.addEventListener("popstate",back);
    for(const type of ["keydown","keyup","mousedown","mouseup","pointerdown","pointerup","wheel"])dialog.addEventListener(type,event=>event.stopPropagation());
    buttons.append(proceed,cancel);dialog.append(title,names,notice,rules,links,label,buttons,disclaimer);document.body.append(dialog);dialog.showModal();cancel.focus();
    // The surrounding import retains the mouse/input guard until import completes or is cancelled.
  });
}

function initializeUsdControls() {
  const fileInput=document.querySelector("#importUsdFile");
  let picking=false;
  const finishPicker=()=>{picking=false;endUsdUi();};
  document.querySelector("#exportUsdBtn")?.addEventListener("click",openUsdExportDialog);
  document.querySelector("#importUsdBtn")?.addEventListener("click",()=>{
    if(bwsUsdUiActive)return;
    beginUsdUi();picking=true;fileInput.value="";fileInput.click();
  });
  fileInput?.addEventListener("cancel",finishPicker);
  window.addEventListener("focus",()=>{if(picking)setTimeout(()=>{if(picking&&!fileInput.files?.length)finishPicker();},400);});
  fileInput?.addEventListener("change",async event=>{
    picking=false;
    const button=document.querySelector("#importUsdBtn");button.disabled=true;
    try{
      if(!event.target.files?.length)return;
      if(!await confirmUsdAssetLicense(event.target.files)){usdMessage("Import cancelled before reading the asset data.");return;}
      await withModelImportProgress(async()=>{
      const {root,file}=await loadUsdWithTexturePrompts(Array.from(event.target.files));
      await importFullModelGltf(file,{scene:root,animations:root.animations||[]},"USD");
      (root.userData.usdWarnings||[]).forEach(usdMessage);
      usdMessage("Imported USD geometry, rig and "+(root.animations?.length||0)+" animation clips. MDL materials are approximated; full USD composition is not guaranteed.");
      },"Importing USD model and motions...")();
    }catch(error){usdMessage("Import stopped: "+(error?.message||error));}
    finally{event.target.value="";button.disabled=false;endUsdUi();}
  });
}
