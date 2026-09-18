// API 4: character copies and bounded item geometry. No downloaded code runs in BWS.
function bwsPluginCharacterSnapshot(){
 syncActiveAnimationClip();
 const state=gameCharacterCaptureEditorState();let temporary=null,copy=null;
 try{
  animationState.playing=false;
  if(!activeSkinRuntime?.avatar?.isSkinnedMesh||!activeSkinRuntime?.skeleton){temporary=gameCharacterTemporaryRigidRuntime();activeSkinRuntime=temporary;}
  if(!activeSkinRuntime?.skeleton)throw Error('Fit or glue a character skeleton before sharing a character copy.');
  if(rigBones.length>512)throw Error('Character sharing supports at most 512 bones.');
  if(!(animationState.bindingRest instanceof Map))prepareAnimationBindingRest();
  const source=activeSkinRuntime.avatar;
  const bound=objects.filter(object=>object!==source&&object.geometry?.getAttribute('position')&&!object.userData?.editorHelper&&gameCharacterArmorBinding(object));
  let bytes=0;for(const mesh of [source,...bound]){for(const a of Object.values(mesh.geometry.attributes))bytes+=a.array.byteLength;bytes+=mesh.geometry.index?.array.byteLength||0;}
  if(bytes>64*1024*1024)throw Error('Character geometry exceeds the 64 MB sharing limit.');
  restoreAnimationBindPose({render:false});source.updateWorldMatrix(true,true);
  copy=new THREE.Group();const avatar=cloneSkeleton(source);source.matrixWorld.decompose(avatar.position,avatar.quaternion,avatar.scale);copy.add(avatar);
  for(const object of bound){object.updateWorldMatrix(true,false);const mesh=object.clone();object.matrixWorld.decompose(mesh.position,mesh.quaternion,mesh.scale);mesh.userData={id:object.userData.id,rigRole:object.userData.rigRole,snapshotBoneId:gameCharacterArmorBinding(object).bone.id};copy.add(mesh);}
  copy.traverse(node=>{if(node.geometry)node.geometry=new THREE.BufferGeometry().copy(node.geometry);});copy.updateMatrixWorld(true);
  const boneData=b=>({id:b.id,name:b.name,parentId:b.parentId||null,role:b.role||null,position:(b.bindPosition||b.position).toArray(),rotation:(b.bindRotation||b.rotation||new THREE.Euler()).toArray(),bindPosition:(b.bindPosition||b.position).toArray(),bindRotation:(b.bindRotation||b.rotation||new THREE.Euler()).toArray(),bindTail:(b.bindTail||b.tail||b.bindPosition||b.position).toArray()});
  const snapshot={name:currentProjectBaseName(),scene:copy.toJSON(),rigBones:rigBones.filter(b=>b.role!=='camera').map(boneData),skinBones:activeSkinRuntime.bones.map(boneData),clips:animationState.clips||{}};
  const json=JSON.stringify(snapshot);if(new TextEncoder().encode(json).length>64*1024*1024)throw Error('Character, animation and textures exceed the 64 MB sharing limit.');return JSON.parse(json);
 }finally{gameCharacterRestoreEditorState(state);copy?.traverse(node=>node.geometry?.dispose());temporary?.avatar.geometry.dispose();temporary?.avatar.material.dispose();}
}
function bwsValidateGameItem(item){
 if(!item||!['sword','shield'].includes(item.type))throw Error('Invalid item type.');
 if(typeof item.textureUrl!=='string'||item.textureUrl.length>16000000||!/^data:image\/png;base64,[a-z0-9+/=]+$/i.test(item.textureUrl))throw Error('Invalid item texture.');
 const parts={};let total=0;
 for(const name of ['front','back','edge','rim']){const part=item.parts?.[name];if(name==='rim'&&(!part||part.positions?.length===0))continue;const data=bwsValidateGeneratedMesh({geometry:part});total+=data.positions.length;if(total>9000000)throw Error('Item geometry exceeds the sharing limit.');parts[name]={positions:data.positions,uvs:data.uvs};}
 return {type:item.type,name:String(item.name||'item').slice(0,120),textureUrl:item.textureUrl,parts};
}
function bwsInsertGameItem(item){
 const sourceBase=item.name.replace(/\.[^.]+$/,'').replace(/[^a-zA-Z0-9_-]+/g,'_')||item.type,displayName=(item.type==='shield'?'Shield ':'Sword ')+sourceBase;
 recordHistory('add plugin item');const group=createSceneGroupRecord({name:displayName+' (Solid Item)'}),socketName=item.type==='shield'?'grip_socket_l':'grip_socket_r';
 const socket=rigBones.find(b=>String(b.id+' '+b.name).toLowerCase().replace(/[^a-z0-9]+/g,' ').includes(socketName.replaceAll('_',' ')));
 const common={shape:'custom',groupId:group.id,groupName:group.name,rigBoneId:socket?.id||null,rigRole:'armor',rigAttachment:socket?'rigidArmor':null,gameAsset:{id:sourceBase.toLowerCase(),type:'equipment',slot:item.type==='shield'?'off-hand':'main-hand',attachBoneId:socketName,inventory:{width:1,height:item.type==='shield'?2:3},hideParts:[]}};
 for(const [key,geometry]of Object.entries(item.parts)){const textured=key==='front'||(key==='back'&&item.type==='sword');addObject({...common,name:displayName+' '+key,geometry,color:key==='back'&&item.type==='shield'?'#5b321d':key==='edge'||key==='rim'?'#777b7d':'#ffffff',roughness:key==='back'&&item.type==='shield'?.9:.4,textureUrl:textured?item.textureUrl:null,textureName:textured?item.name:null,textureHasTransparency:false,doubleSided:true},{record:false,update:false});}
 updateAll();selectGroupRecord(group.id);frameSelected();
}
// Use a private sandbox of installed GN; never borrow the user's graph workspace.
function bwsGameGenerateRecipe(value,signal){
 const text=JSON.stringify(value);
 if(!text||new TextEncoder().encode(text).length>8000000)throw Error('Node recipe exceeds 8 MB.');
 const graph=JSON.parse(text),order=graph?.nodeOrder,smooth=graph?.smoothNodes||[];
 if(!Array.isArray(order)||!order.length||order.length>80||order.some(id=>typeof id!=='string'||!id.length||id.length>160)||new Set(order).size!==order.length)throw Error('Invalid recipe node IDs.');
 if(!Array.isArray(smooth)||smooth.length>80||smooth.some(n=>!n||typeof n.id!=='string'||!n.id.length||n.id.length>160))throw Error('Invalid smoothing node declarations.');
 const ids=new Set([...order,...smooth.map(n=>n.id)]),parents=new Map([...ids].map(id=>[id,[]]));
 if(!Array.isArray(graph.connections)||graph.connections.length>640)throw Error('Invalid recipe connections.');
 for(const link of graph.connections){
  if(!link||!ids.has(link.fromNodeId)||!ids.has(link.toNodeId)||!Number.isInteger(link.toInputIndex)||link.toInputIndex<0||link.toInputIndex>63)throw Error('Recipe connection references a missing node or invalid input.');
  parents.get(link.toNodeId).push(link.fromNodeId);
 }
 const visiting=new Set(),visited=new Set(),visit=id=>{if(visiting.has(id))throw Error('Circular recipe connection.');if(visited.has(id))return;visiting.add(id);for(const input of parents.get(id))visit(input);visiting.delete(id);visited.add(id);};
 for(const id of ids)visit(id);
 const inspect=(item,depth=0)=>{if(depth>64)throw Error('Recipe nesting exceeds the import limit.');if(item&&typeof item==='object')for(const [key,child] of Object.entries(item)){if(['__proto__','constructor','prototype'].includes(key))throw Error('Unsupported recipe object key.');inspect(child,depth+1);}};inspect(graph);
 graph.generatedIds=[];graph.buildVersion=0;
 const gn=installedPluginPackages.find(p=>p.manifest.id==='geometry-nodes');
 if(!gn||!pluginManifestById('geometry-nodes')?.enabled)throw Error('Install and enable a compatible Geometry Nodes plugin before loading .bwnc recipes.');
 const activation=bwsPluginActivationError('geometry-nodes');if(activation)throw Error(activation);
 if(gn.manifest.runtime!=='sandbox-html'||gn.manifest.apiVersion!==4||gn.manifest.contributes?.graphWorkspace!==true||!gn.files[gn.manifest.entry]?.data)throw Error('Installed Geometry Nodes does not expose the supported graph generation API.');
 return new Promise((resolve,reject)=>{
  const worker=document.createElement('iframe'),requestId=crypto.randomUUID();let stage='ready',settled=false;
  worker.hidden=true;worker.title='Private Geometry Nodes recipe generator';worker.setAttribute('sandbox','allow-scripts');worker.referrerPolicy='no-referrer';
  const finish=(error,parts)=>{if(settled)return;settled=true;clearTimeout(timer);window.removeEventListener('message',receive);signal?.removeEventListener('abort',abort);worker.remove();error?reject(error):resolve(parts);};
  const abort=()=>finish(Error('Recipe generation cancelled because the game workspace closed.'));
  const receive=event=>{
   if(event.source!==worker.contentWindow||settled)return;const data=event.data;
   try{
    if(!pluginManifestById('geometry-nodes')?.enabled||installedPluginPackages.find(p=>p.manifest.id==='geometry-nodes')!==gn)throw Error('Geometry Nodes was disabled or replaced during import. Load the recipe again.');
    if(data?.type==='bws-plugin-ready'&&stage==='ready'){stage='capabilities';worker.contentWindow.postMessage({type:'bws-graph-capabilities-request',requestId},'*');return;}
    if(data?.requestId!==requestId)return;
    if(data.type==='bws-graph-capabilities'&&stage==='capabilities'){
     if(data.strictRecipeImport!==1||!Array.isArray(data.nodeTypes))throw Error('Update the installed Geometry Nodes package: strict recipe import is unavailable.');
     const types=new Set(data.nodeTypes),unsupported=order.filter(id=>!types.has(id.split('::')[0]));
     if(unsupported.length)throw Error('Unsupported node types in installed Geometry Nodes: '+unsupported.join(', ')+'. Update the installed package.');
     if(smooth.length&&!types.has('smoothGeometry'))throw Error('Installed Geometry Nodes does not support smoothing nodes.');
     stage='generate';worker.contentWindow.postMessage({type:'bws-graph-preview-request',requestId,graph,strict:true},'*');return;
    }
    if(data.type==='bws-graph-preview-error')throw Error(String(data.message||'Geometry Nodes generation failed.').slice(0,1000));
    if(data.type==='bws-graph-preview-result'&&stage==='generate'){
     // Host validation converts to degrees; restore raw GN radians for THREE.
     const parts=bwsValidateGraphParts(data.parts).map(part=>({...part,rotation:part.rotation.map(THREE.MathUtils.degToRad)}));
     finish(null,parts);
    }
   }catch(error){finish(error);}
  };
  const timer=setTimeout(()=>finish(Error(stage==='capabilities'?'Installed Geometry Nodes lacks strict recipe import. Update its package.':'Geometry Nodes recipe generation timed out.')),115000);
  window.addEventListener('message',receive);signal?.addEventListener('abort',abort,{once:true});
  if(signal?.aborted){abort();return;}
  const csp="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
  worker.srcdoc='<!doctype html><meta http-equiv="Content-Security-Policy" content="'+csp+'"><meta name="referrer" content="no-referrer">'+gn.files[gn.manifest.entry].data;
  document.body.append(worker);
 });
}
function bwsAttachPluginCharacterBridge(pkg,dialog,header,frame){
 const c=pkg.manifest.contributes||{},controller=new AbortController();let ready=false,snapshotId=null,output=null,item=null;
 let graphJob=null,graphImportIds=new Set();
 let recipeLoadId=null,recipeLoadTimer=null;
 const loadRecipe=document.createElement('button'),recipeFile=document.createElement('input');
 loadRecipe.type='button';loadRecipe.textContent='Load .bwnc assembly';loadRecipe.disabled=true;
 recipeFile.type='file';recipeFile.accept='.bwnc';recipeFile.hidden=true;
 if(pkg.manifest.id==='boltworks-game-engine')header.append(loadRecipe,recipeFile);
 loadRecipe.onclick=()=>{if(ready&&dialog.isConnected&&!recipeLoadId&&pluginManifestById(pkg.manifest.id)?.enabled)recipeFile.click();};
 recipeFile.onchange=async()=>{
  const file=recipeFile.files?.[0];recipeFile.value='';if(!file||recipeLoadId||!ready||!dialog.isConnected||!pluginManifestById(pkg.manifest.id)?.enabled)return;
  const target=frame.contentWindow;loadRecipe.disabled=true;
  try{
   if(!/\.bwnc$/i.test(file.name)||file.size>8000000)throw Error('Choose a .bwnc recipe no larger than 8 MB.');
   const text=await file.text();
   if(new TextEncoder().encode(text).length>8000000)throw Error('Recipe text exceeds 8 MB.');
   if(!dialog.isConnected||target!==frame.contentWindow||!pluginManifestById(pkg.manifest.id)?.enabled)return;
   recipeLoadId=crypto.randomUUID();status.textContent='Loading '+file.name+' in Game Engine...';
   target.postMessage({type:'bws-game-recipe-file',requestId:recipeLoadId,name:file.name,text},'*');
   recipeLoadTimer=setTimeout(()=>{recipeLoadId=null;loadRecipe.disabled=false;status.textContent='Recipe import did not complete. Check the game-plugin status before retrying.';},160000);
  }catch(error){status.textContent=error.message;}
  finally{if(!recipeLoadId)loadRecipe.disabled=!ready;}
 };
 const share=document.createElement('button'),save=document.createElement('button'),add=document.createElement('button'),status=document.createElement('span');
 share.textContent='Send character copy';save.textContent='Download export';add.textContent='Add item to BWS';share.disabled=save.disabled=add.disabled=true;status.setAttribute('role','status');status.style.cssText='font-size:12px;max-width:280px';header.style.height='auto';header.style.flexWrap='wrap';
 if(c.characterSnapshot===true)header.append(share);if(c.characterExport===true)header.append(save);if(c.generatedGameItem===true)header.append(add);header.append(status);
 share.onclick=()=>{if(!ready||!pluginManifestById(pkg.manifest.id)?.enabled)return;output=null;save.disabled=true;snapshotId=null;try{const snapshot=bwsPluginCharacterSnapshot();snapshotId=crypto.randomUUID();frame.contentWindow.postMessage({type:'bws-character-snapshot',snapshotId,snapshot},'*');status.textContent='Character copy shared; editor pose restored.';}catch(error){status.textContent=error.message;}};
 save.onclick=()=>{if(output&&pluginManifestById(pkg.manifest.id)?.enabled){downloadBlob(output.name,output.blob);status.textContent='Download requested.';}};
 add.onclick=()=>{if(!item||!pluginManifestById(pkg.manifest.id)?.enabled)return;try{bwsInsertGameItem(bwsValidateGameItem(item));item=null;add.disabled=true;status.textContent='Item added; existing objects kept.';}catch(error){status.textContent=error.message+' Use Undo if insertion was interrupted.';}};
 window.addEventListener('message',event=>{
  if(event.source!==frame.contentWindow||!dialog.isConnected||!pluginManifestById(pkg.manifest.id)?.enabled)return;const data=event.data;
  if(data?.type==='bws-plugin-ready'){ready=true;share.disabled=false;loadRecipe.disabled=false;return;}
  try{
   if(data?.type==='bws-game-recipe-file-result'&&pkg.manifest.id==='boltworks-game-engine'){
    if(!recipeLoadId||data.requestId!==recipeLoadId)return;
    clearTimeout(recipeLoadTimer);recipeLoadId=null;loadRecipe.disabled=false;
    status.textContent=String(data.message||(data.ok?'Recipe loaded in Game Engine.':'Recipe import failed.')).slice(0,1000);return;
   }
   if(data?.type==='bws-game-graph-request'&&pkg.manifest.id==='boltworks-game-engine'){
    if(typeof data.requestId!=='string'||!data.requestId.length||data.requestId.length>160)throw Error('Invalid recipe request ID.');
    const requestId=data.requestId;
    if(graphJob){frame.contentWindow.postMessage({type:'bws-game-graph-error',requestId,message:'A recipe is already generating. Wait for it to finish.'},'*');return;}
    const job=new AbortController();graphJob=job;status.textContent='Generating recipe with installed Geometry Nodes...';
    Promise.resolve().then(()=>bwsGameGenerateRecipe(data.graph,job.signal)).then(parts=>{
     if(!dialog.isConnected||!pluginManifestById(pkg.manifest.id)?.enabled)return;
     graphImportIds.add(requestId);if(graphImportIds.size>24)graphImportIds.delete(graphImportIds.values().next().value);
     frame.contentWindow.postMessage({type:'bws-game-graph-result',requestId,importId:requestId,parts},'*');status.textContent='Recipe generated. Prepare a static GLB export in the game plugin.';
    }).catch(error=>{
     if(!dialog.isConnected)return;status.textContent=error.message;frame.contentWindow.postMessage({type:'bws-game-graph-error',requestId,message:error.message},'*');
    }).finally(()=>{if(graphJob===job)graphJob=null;});return;
   }
   if(data?.type==='bws-game-graph-export'&&pkg.manifest.id==='boltworks-game-engine'&&c.characterExport===true){
    if(!graphImportIds.has(data.importId))throw Error('Load a recipe successfully before exporting its assembly.');
    if(!(data.blob instanceof Blob)||data.blob.type!=='model/gltf-binary'||!data.blob.size||data.blob.size>128*1024*1024)throw Error('Rejected invalid or oversized recipe GLB (128 MB maximum).');
    output={name:safeFileName(String(data.name||'gn-assembly').replace(/\.glb$/i,''),'gn-assembly')+'.glb',blob:data.blob};save.disabled=false;status.textContent='Static recipe GLB ready; choose Download export.';return;
   }
   if(data?.type==='bws-game-item'&&c.generatedGameItem===true){item=null;add.disabled=true;item=bwsValidateGameItem(data.item);add.disabled=false;status.textContent='Item preview ready; choose Add item to BWS.';}
   if(data?.type==='bws-character-export'&&c.characterExport===true&&snapshotId&&data.snapshotId===snapshotId){
    output=null;save.disabled=true;const extension=data.blob?.type==='application/zip'?'.zip':data.blob?.type==='model/gltf-binary'?'.glb':null;
    if(!(data.blob instanceof Blob)||!extension||data.blob.size>128*1024*1024)throw Error('Rejected invalid or oversized export (128 MB maximum).');
    output={name:safeFileName(String(data.name||'character').replace(/\.(zip|glb)$/i,''),'character')+extension,blob:data.blob};save.disabled=false;status.textContent='Export ready; choose Download export.';
   }
  }catch(error){status.textContent=error.message;}
 },{signal:controller.signal});
 const cleanup=dialog.bwsCleanup;dialog.bwsCleanup=()=>{clearTimeout(recipeLoadTimer);recipeLoadId=null;recipeFile.onchange=null;loadRecipe.onclick=null;graphJob?.abort();graphJob=null;graphImportIds.clear();cleanup?.();controller.abort();output=null;item=null;snapshotId=null;};
}
