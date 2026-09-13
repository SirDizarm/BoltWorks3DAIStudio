// Scenes have their own toolbar; installed scene workspaces contribute buttons here.
function bwsRefreshScenesToolbar(){
 const host=document.getElementById('scenePluginButtons');if(!host)return;host.replaceChildren();
 for(const plugin of allPluginManifests()){
  if(!plugin.enabled||plugin.bundled||plugin.contributes?.toolbar!=='scenes'||plugin.runtime!=='sandbox-html')continue;
  const button=document.createElement('button');button.type='button';button.textContent=plugin.name;
  button.onclick=()=>{try{bwsOpenPluginWorkspace(plugin.id);}catch(error){bwsPluginNotice(error.message);}};host.append(button);
 }
}
{
 const menu=document.querySelector('#toolbarPicker .toolbar-picker-menu');
 const toggle=document.createElement('input');toggle.id='toggleToolbarScenes';toggle.type='checkbox';
 const label=document.createElement('label');label.append(toggle,document.createTextNode(' Scenes'));const projectLabel=document.getElementById('toggleToolbarProjectFiles')?.closest('label');if(projectLabel)projectLabel.after(label);else menu?.prepend(label);
 const toolbar=document.createElement('div');toolbar.className='toolbar-group';toolbar.id='toolbarScenesGroup';toolbar.setAttribute('aria-label','Scenes tools');
 const title=document.createElement('span');title.textContent='Scenes';
 const studio=document.createElement('button');studio.type='button';studio.textContent='Scene Studio';studio.onclick=()=>setWorkspace('scene');
 const collection=document.createElement('a');collection.textContent='Scene collection';collection.href='./scenes.html';collection.target='_blank';collection.rel='noopener noreferrer';collection.className='support-bws-button';
 const plugins=document.createElement('button');plugins.type='button';plugins.textContent='Add scene plugin';
 const contributions=document.createElement('span');contributions.id='scenePluginButtons';contributions.style.cssText='display:inline-flex;gap:6px;flex-wrap:wrap';
 toolbar.append(title,studio,collection,plugins,contributions);
 document.getElementById('toolbarProjectFilesGroup')?.after(toolbar);
 let shown=true;try{shown=localStorage.getItem('boltworks.toolbar.scenes.v1')!=='false';}catch{}
 toggle.checked=shown;toolbar.classList.toggle('toolbar-hidden',!shown);
 toggle.onchange=()=>{toolbar.classList.toggle('toolbar-hidden',!toggle.checked);try{localStorage.setItem('boltworks.toolbar.scenes.v1',String(toggle.checked));}catch{}};
 plugins.onclick=()=>{
  const dialog=document.createElement('dialog');dialog.style.cssText='max-width:560px;width:calc(100% - 32px);padding:24px;background:#172426;color:#eee5d3;border:1px solid #7f927a;border-radius:10px';
  const heading=document.createElement('h2');heading.textContent='Optional scene plugins';
  const description=document.createElement('p');description.textContent='Scene plugins are not enabled by default. Review and install a package, then enable it here. Your editor and workspace remain separate.';
  const install=document.createElement('button');install.textContent='Review Fireplace plugin';
  const enable=document.createElement('button');enable.textContent='Enable Fireplace';
  const file=document.createElement('input');file.type='file';file.accept='.bwsplugin,application/json';file.setAttribute('aria-label','Install a scene plugin file');
  const status=document.createElement('p');status.setAttribute('role','status');
  const close=document.createElement('button');close.textContent='Close';close.onclick=()=>{dialog.close();dialog.remove();};
  const refresh=()=>{const p=pluginManifestById('bws-fireplace');enable.disabled=!p||p.enabled;enable.textContent=p?.enabled?'Fireplace enabled':'Enable Fireplace';};
  async function review(text,source){try{if(await bwsReviewPluginInstall(text,source))status.textContent='Installed disabled. Choose Enable Fireplace when ready.';}catch(error){status.textContent=error.message;}finally{install.disabled=false;refresh();}}
  install.onclick=async()=>{install.disabled=true;try{const r=await fetch('./plugins/fireplace/plugin.bwsplugin');if(!r.ok)throw Error('The local fireplace package is unavailable.');await review(await r.text(),'BWS optional Fireplace package');}catch(error){status.textContent=error.message;install.disabled=false;}};
  file.onchange=async()=>{const f=file.files[0];if(!f)return;if(f.size>4_000_000){status.textContent='Package exceeds 4 MB.';return;}await review(await f.text(),'Local file: '+f.name);};
  enable.onclick=async()=>{if(await setPluginEnabled('bws-fireplace',true)){applyPluginAvailability(els);renderPluginManager();refresh();status.textContent='Enabled. Open Fireplace from the Scenes toolbar.';}};
  dialog.addEventListener('cancel',()=>dialog.remove());dialog.append(heading,description,install,enable,file,status,close);document.body.append(dialog);refresh();dialog.showModal();
 };
 bwsRefreshScenesToolbar();
}
