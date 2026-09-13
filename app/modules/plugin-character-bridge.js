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
function bwsAttachPluginCharacterBridge(pkg,dialog,header,frame){
 const c=pkg.manifest.contributes||{},controller=new AbortController();let ready=false,snapshotId=null,output=null,item=null;
 const share=document.createElement('button'),save=document.createElement('button'),add=document.createElement('button'),status=document.createElement('span');
 share.textContent='Send character copy';save.textContent='Download export';add.textContent='Add item to BWS';share.disabled=save.disabled=add.disabled=true;status.setAttribute('role','status');status.style.cssText='font-size:12px;max-width:280px';header.style.height='auto';header.style.flexWrap='wrap';
 if(c.characterSnapshot===true)header.append(share);if(c.characterExport===true)header.append(save);if(c.generatedGameItem===true)header.append(add);header.append(status);
 share.onclick=()=>{if(!ready||!pluginManifestById(pkg.manifest.id)?.enabled)return;output=null;save.disabled=true;snapshotId=null;try{const snapshot=bwsPluginCharacterSnapshot();snapshotId=crypto.randomUUID();frame.contentWindow.postMessage({type:'bws-character-snapshot',snapshotId,snapshot},'*');status.textContent='Character copy shared; editor pose restored.';}catch(error){status.textContent=error.message;}};
 save.onclick=()=>{if(output&&pluginManifestById(pkg.manifest.id)?.enabled){downloadBlob(output.name,output.blob);status.textContent='Download requested.';}};
 add.onclick=()=>{if(!item||!pluginManifestById(pkg.manifest.id)?.enabled)return;try{bwsInsertGameItem(bwsValidateGameItem(item));item=null;add.disabled=true;status.textContent='Item added; existing objects kept.';}catch(error){status.textContent=error.message+' Use Undo if insertion was interrupted.';}};
 window.addEventListener('message',event=>{
  if(event.source!==frame.contentWindow||!dialog.isConnected||!pluginManifestById(pkg.manifest.id)?.enabled)return;const data=event.data;
  if(data?.type==='bws-plugin-ready'){ready=true;share.disabled=false;return;}
  try{
   if(data?.type==='bws-game-item'&&c.generatedGameItem===true){item=null;add.disabled=true;item=bwsValidateGameItem(data.item);add.disabled=false;status.textContent='Item preview ready; choose Add item to BWS.';}
   if(data?.type==='bws-character-export'&&c.characterExport===true&&snapshotId&&data.snapshotId===snapshotId){
    output=null;save.disabled=true;const extension=data.blob?.type==='application/zip'?'.zip':data.blob?.type==='model/gltf-binary'?'.glb':null;
    if(!(data.blob instanceof Blob)||!extension||data.blob.size>128*1024*1024)throw Error('Rejected invalid or oversized export (128 MB maximum).');
    output={name:safeFileName(String(data.name||'character').replace(/\.(zip|glb)$/i,''),'character')+extension,blob:data.blob};save.disabled=false;status.textContent='Export ready; choose Download export.';
   }
  }catch(error){status.textContent=error.message;}
 },{signal:controller.signal});
 const cleanup=dialog.bwsCleanup;dialog.bwsCleanup=()=>{cleanup?.();controller.abort();output=null;item=null;snapshotId=null;};
}
