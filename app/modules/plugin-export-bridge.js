// Plugin API 2: explicit model-copy sharing, with no mutation or general RPC surface.
function bwsPluginModelSnapshot(){
 const limit=64*1024*1024;let bytes=0;
 syncCurrentTextureRobloxId({writeInput:true});
 const meshes=objects.map(mesh=>{
  for(const attribute of Object.values(mesh.geometry.attributes))bytes+=attribute.array.byteLength;
  bytes+=mesh.geometry.index?.array.byteLength||0;
  if(bytes>limit)throw Error('This model exceeds the 64 MB plugin sharing limit.');
  mesh.updateWorldMatrix(true,false);
  return {name:mesh.name,geometry:new THREE.BufferGeometry().copy(mesh.geometry).toJSON(),matrixWorld:mesh.matrixWorld.toArray(),rotation:mesh.rotation.toArray(),scale:mesh.scale.toArray(),color:(Array.isArray(mesh.material)?mesh.material[0]:mesh.material)?.color?.getHex()??0xffffff,userData:{id:mesh.userData.id,groupId:mesh.userData.groupId||null,pivot:mesh.userData.pivot||null,hidden:!!mesh.userData.hidden,textureName:mesh.userData.textureName||null}};
 });
 const textures=[...textureLibrary.values()].map(entry=>{
  const dataUrl=/^data:image\//i.test(entry.dataUrl||'')?entry.dataUrl:'';
  bytes+=dataUrl.length;if(bytes>limit)throw Error('This model and its textures exceed the 64 MB plugin sharing limit.');
  return {name:entry.name,dataUrl,robloxAssetId:normalizeRobloxAssetId(entry.robloxAssetId||'')};
 });
 return {name:currentProjectBaseName(),meshes,groups:[...sceneGroupRegistry.values()].map(serializeGroupRecord),textures};
}
function bwsAttachPluginExportBridge(pkg,dialog,header,frame){
 const capabilities=pkg.manifest.contributes||{};
 if(capabilities.modelSnapshot!==true&&capabilities.exportDownload!==true)return;
 const controller=new AbortController(),share=document.createElement('button'),save=document.createElement('button'),status=document.createElement('span');
 let snapshotId=null,output=null,ready=false;
 share.textContent='Send current model';share.disabled=true;save.textContent='Download ZIP';save.disabled=true;status.setAttribute('role','status');status.style.cssText='font-size:12px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
 header.style.cssText='display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-height:42px';
 dialog.style.display='flex';dialog.style.flexDirection='column';frame.style.flex='1';frame.style.minHeight='0';
 if(capabilities.modelSnapshot===true)header.append(share);
 if(capabilities.exportDownload===true)header.append(save);
 header.append(status);
 share.onclick=()=>{
  if(!ready||!pluginManifestById(pkg.manifest.id)?.enabled)return;
  output=null;save.disabled=true;snapshotId=null;
  try{const snapshot=bwsPluginModelSnapshot();snapshotId=crypto.randomUUID();frame.contentWindow.postMessage({type:'bws-model-snapshot',snapshotId,snapshot},'*');status.textContent='Model copy shared';}catch(error){status.textContent=error.message;status.title=error.message;}
 };
 save.onclick=()=>{if(!output||!pluginManifestById(pkg.manifest.id)?.enabled)return;downloadBlob(output.name,output.blob);status.textContent='ZIP download requested';};
 window.addEventListener('message',event=>{
  if(event.source!==frame.contentWindow||!dialog.isConnected||!pluginManifestById(pkg.manifest.id)?.enabled)return;
  const data=event.data;
  if(data?.type==='bws-plugin-ready'){ready=true;share.disabled=false;return;}
  if(data?.type!=='bws-plugin-export'||capabilities.exportDownload!==true||!snapshotId||data.snapshotId!==snapshotId)return;
  if(!(data.blob instanceof Blob)||data.blob.type!=='application/zip'||data.blob.size>128*1024*1024){status.textContent='Rejected invalid or oversized ZIP (128 MB maximum).';return;}
  output={name:safeFileName(String(data.name||'plugin-export').replace(/\.zip$/i,''),'plugin-export')+'.zip',blob:data.blob};save.disabled=false;status.textContent='ZIP ready to download';
 },{signal:controller.signal});
 dialog.bwsCleanup=()=>{controller.abort();output=null;snapshotId=null;};
}
