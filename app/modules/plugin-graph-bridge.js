// API 4 graph data / geometry only; no plugin-supplied scripts run in the host.
function bwsGraphTexture(value){if(!value)return null;if(typeof value!=='string'||value.length>16000000||!/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(value))throw Error('Unsupported or oversized graph texture.');return value;}
function bwsValidateGraphParts(parts){
 if(!Array.isArray(parts)||parts.length<1||parts.length>5000)throw Error('Graph output must contain 1-5,000 parts.');let numbers=0,textureBytes=0;const seen=new Set();
 const vector=(v,n,fallback)=>{if(v==null)return fallback;if(!Array.isArray(v)||v.length!==n||v.some(x=>!Number.isFinite(x)||Math.abs(x)>1000000))throw Error('Invalid graph transform or attribute.');return v.slice();};
 return parts.map(part=>{const positions=part?.geometry?.positions;if(!Array.isArray(positions)||!positions.length||positions.length%9)throw Error('Invalid graph triangle data.');numbers+=positions.length;if(numbers>9000000)throw Error('Graph exceeds the nine-million position component limit.');const geometry={positions:vector(positions,positions.length)};
  for(const key of ['normals','colors','uvs']){const values=part.geometry[key];if(values?.length)geometry[key]=vector(values,key==='uvs'?positions.length/3*2:positions.length);}
  const textureUrl=bwsGraphTexture(part.textureUrl);if(textureUrl&&!seen.has(textureUrl)){seen.add(textureUrl);textureBytes+=textureUrl.length;if(textureBytes>64000000)throw Error('Graph textures exceed 64 MB.');}
  if(!/^#[a-f0-9]{6}$/i.test(part.color||''))throw Error('Invalid graph material color.');
  const gameAsset=part.gameAsset&&typeof part.gameAsset==='object'?JSON.parse(JSON.stringify(part.gameAsset)):null;if(gameAsset&&JSON.stringify(gameAsset).length>64000)throw Error('Graph asset metadata is too large.');
  return {shape:'custom',name:String(part.name||'Node part').slice(0,160),geometry,position:vector(part.position,3,[0,0,0]),rotation:vector(part.rotation,3,[0,0,0]).map(THREE.MathUtils.radToDeg),scale:vector(part.scale,3,[1,1,1]),color:part.color,roughness:Math.max(0,Math.min(1,Number(part.roughness)||0)),doubleSided:part.doubleSided===true,textureUrl,textureName:typeof part.textureName==='string'?part.textureName.slice(0,160):null,gameAsset};
 });
}
const BWS_GRAPH_FILE_MAX_BYTES=128000000;
function bwsGraphFileText(text){if(typeof text!=='string'||text.length>BWS_GRAPH_FILE_MAX_BYTES||new Blob([text]).size>BWS_GRAPH_FILE_MAX_BYTES)throw Error('Geometry Nodes file exceeds 128 MB.');return text;}
function bwsGraphState(value){const text=JSON.stringify(value);if(!text||text.length>8000000)throw Error('Graph recipes exceed 8 MB.');return sanitizeGeometryNodeProjectState(JSON.parse(text),{allowEmpty:true});}
function bwsKeepGraphOutputIds(state){for(const graph of state.graphs){const original=geometryNodeProjectState.graphs.find(g=>g.id===graph.id);graph.generatedIds=original?.generatedIds?.slice()||[];}return state;}
async function bwsApplyGraphOutput(result,replace){
 const parts=bwsValidateGraphParts(result.parts),graph=sanitizeGeometryNodeGraph(result.graph),existing=geometryNodeProjectState.graphs.find(g=>g.id===graph.id);
 if(!existing&&geometryNodeProjectState.graphs.length>=24)throw Error('Graph library is full. Save/delete a recipe before adding another.');
 const previous=replace?(existing?.generatedIds||[]).map(findObject).filter(Boolean):[];
 if(replace){if(!previous.length)throw Error('This graph has no existing output to replace. Use Add generated copy.');if(!await bwsPluginDialog('Replace graph output','Replace '+previous.length+' parts belonging to '+existing.name+'? Other objects are kept. You can undo this change.','Replace generated parts'))return false;
  if(geometryNodeProjectState.graphs.find(g=>g.id===graph.id)!==existing||previous.some(m=>findObject(m.userData.id)!==m))throw Error('The graph or model changed. Build a fresh preview before replacing it.');
 }
 recordHistory(replace?'replace plugin graph output':'add plugin graph copy');const group=createSceneGroupRecord({name:graph.name+' output'}),added=[];
 try{for(const spec of parts){const mesh=addObject({...spec,groupId:group.id,groupName:group.name},{record:false,select:false,update:false});mesh.userData.geometryNodeGraphId=graph.id;added.push(mesh);}}
 catch(error){for(const mesh of added)removeObject(mesh,{record:false,update:false});sceneGroupRegistry.delete(group.id);updateAll();throw error;}
 for(const mesh of previous)removeObject(mesh,{record:false,update:false});
 graph.generatedIds=added.map(mesh=>mesh.userData.id);const at=geometryNodeProjectState.graphs.findIndex(g=>g.id===graph.id);if(at<0)geometryNodeProjectState.graphs.push(graph);else geometryNodeProjectState.graphs[at]=graph;geometryNodeProjectState.activeGraphId=graph.id;saveGeometryNodeDraft();updateAll();selectGroupRecord(group.id);frameSelected();return true;
}
function bwsAttachPluginGraphBridge(pkg,dialog,header,frame){
 const controller=new AbortController();let ready=false,state=null,result=null,file=null,pending=null;
 let previewClearPending=false;
 let previewWindow=null,previewRenderer=null,previewScene=null,previewCamera=null,previewRoot=null,previewFrame=0,previewTimer=null;
 let previewTarget=new THREE.Vector3(),previewRadius=10,previewYaw=-.6,previewPitch=.45,previewAxisGuide=null,previewPoseUi=null,previewGraphId=null;
 const previewResources=()=>{
  if(!previewRoot)return;
  previewRoot.traverse(mesh=>{if(mesh.isMesh){mesh.geometry.dispose();mesh.material.map?.dispose();mesh.material.dispose();}});
  previewScene.remove(previewRoot);previewRoot=null;
 };
 function restorePreview(){
  const win=previewWindow;previewWindow=null;
  if(win&&!win.closed)win.cancelAnimationFrame(previewFrame);
  clearInterval(previewTimer);previewTimer=null;previewAxisGuide?.dispose();previewAxisGuide=null;previewPoseUi?.dispose();previewPoseUi=null;previewGraphId=null;previewResources();previewRenderer?.dispose();previewRenderer=null;
  previewScene=previewCamera=null;if(win&&!win.closed)win.close();
  detach.textContent='Detach preview';
  if(frame.isConnected)frame.contentWindow.postMessage({type:'bws-graph-preview-detached',detached:false},'*');
 }
 function refreshPreview(){
  if(!previewWindow||previewWindow.closed||!result)return;
  const parts=bwsValidateGraphParts(result.parts),retainCamera=!!previewRoot&&previewGraphId===result.graph.id;previewResources();previewGraphId=result.graph.id;
  const root=new THREE.Group();previewRoot=root;previewScene.add(root);
  for(const part of parts){
   const material=new THREE.MeshStandardMaterial({color:part.color,roughness:part.roughness,side:part.doubleSided?THREE.DoubleSide:THREE.FrontSide,vertexColors:!!part.geometry.colors});
   const mesh=new THREE.Mesh(geometryFromData(part.geometry),material);
   mesh.position.fromArray(part.position);mesh.rotation.set(...part.rotation.map(THREE.MathUtils.degToRad));mesh.scale.fromArray(part.scale);mesh.userData.gameAsset=part.gameAsset;root.add(mesh);
   if(part.textureUrl)new THREE.TextureLoader().load(part.textureUrl,texture=>{
    if(previewRoot!==root){texture.dispose();return;}texture.colorSpace=THREE.SRGBColorSpace;material.map=texture;material.needsUpdate=true;
   });
  }
  if(!retainCamera){const bounds=new THREE.Box3().setFromObject(root);bounds.getCenter(previewTarget);previewRadius=Math.max(1,bounds.getSize(new THREE.Vector3()).length()*1.3);}
  previewPoseUi?.refresh();
  previewWindow.document.title='BWS Preview - '+result.graph.name;
 }
 const button=label=>{const b=document.createElement('button');b.textContent=label;b.disabled=true;header.append(b);return b;};
 const share=button('Send graphs'),save=button('Save graphs to BWS'),add=button('Add generated copy'),replace=button('Replace graph output'),download=button('Download graph'),status=document.createElement('span');status.setAttribute('role','status');header.append(status);header.style.height='auto';header.style.flexWrap='wrap';dialog.style.display='flex';dialog.style.flexDirection='column';frame.style.flex='1';frame.style.minHeight='0';
 // Recipe file saving remains in the plugin; do not expose the confusing host-save action.
 save.remove();share.remove();replace.remove();
 add.textContent='Import to workspace';add.title='Add this model without removing anything already in your workspace';
 download.textContent='Save Geometry Nodes';
 const gameExport=button('Export to Cinder Cairn');download.after(gameExport);
 gameExport.title='Download a compressed runtime-only .bwcasset. Keep Save Geometry Nodes for editable recipes.';
 let gameExportRequest=null,gameExportTimer=null;
 const finishGameExport=()=>{clearTimeout(gameExportTimer);gameExportTimer=null;gameExportRequest=null;gameExport.disabled=!ready;};
 gameExport.onclick=()=>{
  if(!ready||!enabled()||gameExportRequest)return;
  gameExportRequest=crypto.randomUUID();gameExport.disabled=true;
  frame.contentWindow.postMessage({type:'bws-cinder-asset-export-request',requestId:gameExportRequest},'*');status.textContent='Preparing a runtime-only Cinder Cairn asset...';
  gameExportTimer=setTimeout(()=>{finishGameExport();status.textContent='Cinder Cairn export timed out. Check the plugin status and retry.';},160000);
 };
 const loadNodes=button('Load Geometry Nodes'),nodeFile=document.createElement('input');
 nodeFile.type='file';nodeFile.accept='.bwnc';nodeFile.hidden=true;header.append(nodeFile);
 let nodeSaveRequested=false,nodeSaveName=null,nodeSaveDialog=null;
 loadNodes.onclick=()=>{if(ready&&enabled())nodeFile.click();};
 nodeFile.onchange=async()=>{
  const picked=nodeFile.files?.[0];nodeFile.value='';if(!picked||!enabled())return;
  try{
   if(!/\.bwnc$/i.test(picked.name)||picked.size>BWS_GRAPH_FILE_MAX_BYTES)throw Error('Choose a Geometry Nodes .bwnc file no larger than 128 MB.');
   const text=bwsGraphFileText(await picked.text());if(!enabled())return;
   frame.contentWindow.postMessage({type:'bws-geometry-nodes-load',text,name:picked.name},'*');
   status.textContent='Geometry Nodes file sent to the editor. Your workspace objects are unchanged.';
  }catch(error){status.textContent=error.message;}
 };
 const detach=button('Detach preview');
 const clearPreview=button('Clear Preview');
 clearPreview.title='Clear plugin previews and stop motion. Keeps recipes and workspace models.';
 function clearPreviewOutput(){
  result=null;add.disabled=replace.disabled=true;
  finish(Error('Graph preview generation cancelled by Clear Preview.'));
  previewResources();previewGraphId=null;
  previewPoseUi?.refresh();previewPoseUi?.update();
  if(previewWindow&&!previewWindow.closed)previewWindow.document.title='BWS Preview - cleared';
  status.textContent='Preview cleared. Recipes and workspace models are unchanged.';
 }
 function requestClearPreview(){
  if(!enabled()||!ready)return;
  // Ignore already queued build/pose packets until the iframe acknowledges clearing.
  previewClearPending=true;clearPreviewOutput();
  frame.contentWindow.postMessage({type:'bws-graph-clear-preview'},'*');
 }
 clearPreview.onclick=requestClearPreview;
 detach.onclick=()=>{
  if(!enabled()||!ready)return;
  if(previewWindow&&!previewWindow.closed){restorePreview();return;}
  const win=window.open('','_blank','popup=yes,width=1000,height=750');
  if(!win){status.textContent='Allow popups for BWS, then choose Detach preview again.';return;}
  previewWindow=win;
  try{
   const doc=win.document;doc.title='BWS Preview';doc.body.replaceChildren();
   doc.body.style.cssText='margin:0;overflow:hidden;background:#17262a;color:#dceae5;font:14px Verdana,sans-serif';
   const bar=doc.createElement('div'),label=doc.createElement('span'),back=doc.createElement('button');
   bar.style.cssText='height:44px;box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;padding:8px 12px;gap:12px';
   label.textContent='Live preview / Pose controls v2 | Left-drag: orbit | Right-drag: pan | Scroll: zoom';back.textContent='Return preview';back.onclick=restorePreview;
   const clear=doc.createElement('button');clear.type='button';clear.textContent='Clear Preview';clear.title=clearPreview.title;clear.onclick=requestClearPreview;
   bar.append(label,clear,back);doc.body.append(bar);
   const canvas=doc.createElement('canvas');canvas.style.cssText='display:block;touch-action:none';doc.body.append(canvas);
   previewRenderer=new THREE.WebGLRenderer({canvas,antialias:true});previewRenderer.setPixelRatio(Math.min(win.devicePixelRatio||1,2));
   previewScene=new THREE.Scene();previewScene.background=new THREE.Color('#17262a');previewScene.add(new THREE.HemisphereLight(0xffffff,0x354532,2));
   const sunlight=new THREE.DirectionalLight(0xffffff,3);sunlight.position.set(7,12,-9);previewScene.add(sunlight);
   previewCamera=new THREE.PerspectiveCamera(45,1,.01,100000);doc.body.style.position='relative';previewAxisGuide=bwsCreatePreviewAxisGuide(doc.body,previewCamera,(axis,sign)=>{if(axis===0){previewYaw=sign*Math.PI/2;previewPitch=0;}else if(axis===1){previewYaw=0;previewPitch=sign*(Math.PI/2-.0001);}else{previewYaw=sign>0?Math.PI:0;previewPitch=0;}},52);
   previewPoseUi=bwsCreateDetachedPoseControls(doc,canvas,previewCamera,()=>previewRoot,command=>{if(enabled())frame.contentWindow.postMessage({type:'bws-graph-pose-command',...command},'*');});
   let drag=null,lastWidth=0,lastHeight=0;
   canvas.addEventListener('contextmenu',event=>event.preventDefault());
   canvas.addEventListener('pointerdown',event=>{if(event.button!==0&&event.button!==2)return;event.preventDefault();drag={x:event.clientX,y:event.clientY,pan:event.button===2};canvas.setPointerCapture(event.pointerId);});
   canvas.addEventListener('pointermove',event=>{
    if(!drag)return;event.preventDefault();const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
    if(drag.pan){
     const units=2*previewRadius*Math.tan(THREE.MathUtils.degToRad(previewCamera.fov/2))/Math.max(1,win.innerHeight-44);
     const right=new THREE.Vector3(1,0,0).applyQuaternion(previewCamera.quaternion),up=new THREE.Vector3(0,1,0).applyQuaternion(previewCamera.quaternion);
     previewTarget.addScaledVector(right,-dx*units).addScaledVector(up,dy*units);
    }else{
     previewYaw+=dx*.008;previewPitch=Math.max(-1.45,Math.min(1.45,previewPitch+dy*.008));
    }
    drag.x=event.clientX;drag.y=event.clientY;
   });
   canvas.addEventListener('lostpointercapture',()=>{drag=null;});
   win.addEventListener('blur',()=>{drag=null;});
   doc.addEventListener('contextmenu',event=>event.preventDefault());
   canvas.addEventListener('pointerup',()=>{drag=null;});canvas.addEventListener('pointercancel',()=>{drag=null;});
   canvas.addEventListener('wheel',event=>{event.preventDefault();previewRadius=Math.max(.05,Math.min(100000,previewRadius*Math.exp(event.deltaY*.001)));},{passive:false});
   refreshPreview();
   function draw(){
    if(previewWindow!==win||win.closed)return;
    const width=Math.max(1,win.innerWidth),height=Math.max(1,win.innerHeight-44-(previewPoseUi?.height()||0));
    if(width!==lastWidth||height!==lastHeight){lastWidth=width;lastHeight=height;previewRenderer.setSize(width,height);previewCamera.aspect=width/height;previewCamera.updateProjectionMatrix();}
    previewCamera.position.set(previewTarget.x+Math.sin(previewYaw)*Math.cos(previewPitch)*previewRadius,previewTarget.y+Math.sin(previewPitch)*previewRadius,previewTarget.z-Math.cos(previewYaw)*Math.cos(previewPitch)*previewRadius);
    previewCamera.lookAt(previewTarget);previewRenderer.render(previewScene,previewCamera);previewAxisGuide.update();previewPoseUi?.update();previewFrame=win.requestAnimationFrame(draw);
   }
   draw();previewTimer=setInterval(()=>{if(win.closed)restorePreview();},500);
   detach.textContent='Return preview';frame.contentWindow.postMessage({type:'bws-graph-preview-detached',detached:true},'*');
   status.textContent='Preview detached. Move its window to your other monitor; Build preview updates it.';
  }catch(error){restorePreview();status.textContent='Could not detach preview: '+error.message;}
 };
 const enabled=()=>dialog.isConnected&&pluginManifestById(pkg.manifest.id)?.enabled;
 share.onclick=()=>{if(!ready||!enabled())return;try{const textures=[...textureLibrary.values()].map(t=>({name:t.name,dataUrl:bwsGraphTexture(t.dataUrl)}));const payload={type:'bws-graph-snapshot',state:bwsGraphState(geometryNodeProjectState),textures};if(JSON.stringify(payload).length>64000000)throw Error('Graph and texture sharing exceeds 64 MB.');frame.contentWindow.postMessage(payload,'*');state=result=null;save.disabled=add.disabled=replace.disabled=true;status.textContent='Graph library shared; editor objects unchanged.';}catch(error){status.textContent=error.message;}};
 save.onclick=()=>{if(!state||!enabled())return;try{const next=bwsKeepGraphOutputIds(bwsGraphState(state));recordHistory('save plugin graph recipes');geometryNodeProjectState=next;saveGeometryNodeDraft();save.disabled=true;status.textContent='Graph recipes saved. Existing meshes kept.';}catch(error){status.textContent=error.message;}};
 async function apply(replaceOutput){if(!result||!enabled())return;const packet=result;add.disabled=replace.disabled=true;try{if(await bwsApplyGraphOutput(packet,replaceOutput)){if(result===packet)result=null;status.textContent='Generated geometry saved to BWS.';}}catch(error){status.textContent=error.message;}finally{add.disabled=!result;replace.disabled=!result;}}
 add.onclick=()=>apply(false);replace.onclick=()=>apply(true);
 download.onclick=()=>{
  if(!ready||!enabled()||nodeSaveDialog)return;
  const prompt=document.createElement('dialog');nodeSaveDialog=prompt;
  prompt.style.cssText='width:min(420px,calc(100vw - 48px));box-sizing:border-box;padding:22px;background:#172426;color:#eee5d3;border:1px solid #63766b;border-radius:8px;font:inherit';
  const heading=document.createElement('h2'),label=document.createElement('label'),input=document.createElement('input'),note=document.createElement('p'),actions=document.createElement('div'),cancel=document.createElement('button'),accept=document.createElement('button');
  heading.textContent='Save Geometry Nodes';label.textContent='File name';input.type='text';input.maxLength=120;input.setAttribute('aria-label','File name');
  input.value=String(result?.graph?.name||file?.name||'Geometry Nodes').replace(/\.bwnc$/i,'');input.style.cssText='display:block;width:100%;box-sizing:border-box;margin-top:8px;padding:10px;font:inherit';label.append(input);
  note.textContent='Saves an editable Geometry Nodes recipe (.bwnc). Your browser controls the download location.';note.style.cssText='font-size:13px;line-height:1.5';
  actions.style.cssText='display:flex;justify-content:flex-end;gap:8px;margin-top:18px';cancel.textContent='Cancel';accept.textContent='Save';cancel.type=accept.type='button';
  const close=()=>{prompt.close();prompt.remove();if(nodeSaveDialog===prompt)nodeSaveDialog=null;};
  cancel.onclick=close;prompt.addEventListener('cancel',event=>{event.preventDefault();close();});
  accept.onclick=()=>{
   if(!input.value.trim()){input.setCustomValidity('Enter a file name.');input.reportValidity();return;}
   if(!enabled()){close();return;}
   nodeSaveName=safeFileName(input.value.trim().replace(/\.bwnc$/i,''),'Geometry Nodes')+'.bwnc';nodeSaveRequested=true;close();
   frame.contentWindow.postMessage({type:'bws-geometry-nodes-save'},'*');status.textContent='Preparing '+nodeSaveName+'...';
  };
  input.addEventListener('input',()=>input.setCustomValidity(''));input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();accept.click();}});
  actions.append(cancel,accept);prompt.append(heading,label,note,actions);dialog.append(prompt);prompt.showModal();input.focus();input.select();
 };
 function finish(error,value){if(!pending)return;const job=pending;pending=null;clearTimeout(job.timer);error?job.reject(error):job.resolve(value);}
 dialog.bwsGenerateGraph=graph=>new Promise((resolve,reject)=>{if(previewClearPending){reject(Error('Preview is clearing. Try generating again.'));return;}if(pending){reject(Error('A graph is already generating.'));return;}pending={requestId:crypto.randomUUID(),graph,resolve,reject,timer:setTimeout(()=>finish(Error('Graph generation timed out.')),120000)};if(ready)frame.contentWindow.postMessage({type:'bws-graph-preview-request',requestId:pending.requestId,graph},'*');});
 window.addEventListener('message',event=>{
  if(event.source!==frame.contentWindow||!enabled())return;const data=event.data;
  try{
   if(data?.type==='bws-plugin-ready'){ready=true;share.disabled=detach.disabled=clearPreview.disabled=download.disabled=loadNodes.disabled=gameExport.disabled=false;if(pending)frame.contentWindow.postMessage({type:'bws-graph-preview-request',requestId:pending.requestId,graph:pending.graph},'*');}
   if(gameExportRequest&&data?.requestId===gameExportRequest&&['bws-cinder-asset-export-result','bws-cinder-asset-export-error'].includes(data.type)){
    finishGameExport();
    if(data.type==='bws-cinder-asset-export-error')throw Error(String(data.message||'Game export failed.').slice(0,1000));
    if(!(data.blob instanceof Blob)||data.blob.type!=='application/gzip'||!data.blob.size||data.blob.size>BWS_GRAPH_FILE_MAX_BYTES)throw Error('Invalid or oversized Cinder Cairn export.');
    const name=safeFileName(String(data.name||'cinder-asset').replace(/\.bwcasset$/i,''),'cinder-asset')+'.bwcasset';
    downloadBlob(name,data.blob);status.textContent='Game asset download requested: '+name+'. Editable Geometry Nodes files are unchanged.';return;
   }
   if(data?.type==='bws-graph-preview-cleared'){previewClearPending=false;clearPreviewOutput();return;}
   if(previewClearPending&&['bws-graph-result','bws-graph-pose-preview','bws-graph-preview-result','bws-graph-preview-error'].includes(data?.type))return;
   if(data?.type==='bws-graph-state'){state=bwsGraphState(data.state);save.disabled=false;}
   if(data?.type==='bws-graph-pose-preview'&&previewWindow&&!previewWindow.closed&&result){bwsValidateGraphParts(data.parts);result={...result,parts:data.parts};refreshPreview();}
   if(data?.type==='bws-graph-result'){result=null;add.disabled=replace.disabled=true;bwsValidateGraphParts(data.parts);result={graph:sanitizeGeometryNodeGraph(data.graph),parts:data.parts};refreshPreview();add.disabled=false;replace.disabled=false;status.textContent=data.parts.length+' parts ready for '+result.graph.name+'.';}
   if(data?.type==='bws-graph-file'){bwsGraphFileText(data.text);JSON.parse(data.text);file={name:safeFileName(String(data.name||'nodes').replace(/\.bwnc$/i,''),'nodes')+'.bwnc',text:data.text};download.disabled=false;if(nodeSaveRequested){nodeSaveRequested=false;downloadBlob(nodeSaveName||file.name,new Blob([file.text],{type:'application/json'}));status.textContent='Download requested: '+(nodeSaveName||file.name);nodeSaveName=null;}else status.textContent='Geometry Nodes file ready. Choose Save Geometry Nodes.';}
   if(data?.requestId===pending?.requestId&&pending&&['bws-graph-preview-result','bws-graph-preview-error'].includes(data.type)){if(data.type==='bws-graph-preview-error')throw Error(String(data.message).slice(0,500));finish(null,bwsValidateGraphParts(data.parts));}
  }catch(error){status.textContent=error.message;if(data?.requestId===pending?.requestId&&pending)finish(error);}
 },{signal:controller.signal});const cleanup=dialog.bwsCleanup;dialog.bwsCleanup=()=>{finishGameExport();nodeSaveDialog?.remove();nodeSaveDialog=null;restorePreview();cleanup?.();controller.abort();state=result=file=null;finish(Error('Graph workspace closed.'));};
}
async function bwsRequestGraphPreview(graph){
 await bwsPluginStorageReady;const plugin=pluginManifestById('geometry-nodes');if(!plugin?.enabled||plugin.apiVersion!==4||plugin.contributes?.graphWorkspace!==true)throw Error('Install and enable Geometry Nodes to generate scene trees or rocks from graph recipes.');
 const opened=!bwsPluginWindows.has('geometry-nodes');if(opened)bwsOpenPluginWorkspace('geometry-nodes');const dialog=bwsPluginWindows.get('geometry-nodes');
 try{const parts=await dialog.bwsGenerateGraph(sanitizeGeometryNodeGraph(graph));return parts.map(spec=>{const mesh=new THREE.Mesh(geometryFromData(spec.geometry),new THREE.MeshStandardMaterial({color:spec.color,roughness:spec.roughness,side:spec.doubleSided?THREE.DoubleSide:THREE.FrontSide,vertexColors:!!spec.geometry.colors}));mesh.name=spec.name;mesh.position.fromArray(spec.position);mesh.rotation.set(...spec.rotation.map(THREE.MathUtils.degToRad));mesh.scale.fromArray(spec.scale);mesh.userData={_sceneTextureUrl:spec.textureUrl};mesh.updateMatrixWorld(true);return mesh;});}
 finally{if(opened&&bwsPluginWindows.get('geometry-nodes')===dialog)bwsClosePluginWorkspace('geometry-nodes');}
}



function bwsCreateDetachedPoseControls(doc,canvas,camera,getRoot,send){
 const win=doc.defaultView,events=new win.AbortController(),on=(target,type,fn,options={})=>target.addEventListener(type,fn,{...options,signal:events.signal});
 const bar=doc.createElement('div');bar.style.cssText='position:absolute;bottom:0;left:0;right:0;display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:8px;background:#122326;border-top:1px solid #476358;z-index:30';
 const caption=doc.createElement('strong');caption.style.color='#e1c36c';bar.append(caption);
 const show=doc.createElement('input');show.type='checkbox';show.checked=true;const showLabel=doc.createElement('label');showLabel.append(show,doc.createTextNode(' Pose joints'));bar.append(showLabel);
 const select=doc.createElement('select');select.setAttribute('aria-label','Preview joint');bar.append(select);
 const input=(label,type)=>{const el=doc.createElement('input');el.type=type;el.setAttribute('aria-label',label);el.style.width=type==='range'?'140px':'85px';el.step=type==='range'?'.1':'any';const wrap=doc.createElement('label');wrap.append(doc.createTextNode(label+' '),el);bar.append(wrap);return el;};
 const angle=input('Angle','number'),slider=input('Bend','range');
 let joints=[],selected='',markers=[],signature='',liveFrame=null,queued=null,localEdit=null,drag=null,sliderEditing=false,sliderWindow=null,disposed=false,down=null;
 const current=()=>joints.find(j=>j.key===selected),valueOf=j=>localEdit?.key===j.key?localEdit.value:j.pose.value;
 const layer=doc.createElement('div');layer.style.cssText='position:absolute;inset:44px 0 0;overflow:hidden;pointer-events:none';
 const gauge=doc.createElementNS('http://www.w3.org/2000/svg','svg');gauge.setAttribute('viewBox','-75 -75 150 180');gauge.setAttribute('role','slider');gauge.setAttribute('aria-label','Selected joint angle dial');gauge.setAttribute('tabindex','0');gauge.style.cssText='position:absolute;width:150px;height:180px;pointer-events:auto;touch-action:none;z-index:26';gauge.innerHTML="<path data-ring fill=\"#102321\" fill-opacity=\".75\" stroke=\"#9aae9d\"/><line data-zero x1=\"0\" y1=\"0\" stroke=\"#aabbac\" stroke-dasharray=\"3 3\"/><line data-needle x1=\"0\" y1=\"0\" stroke=\"#efcb6d\" stroke-width=\"3\"/><circle r=\"4\" fill=\"#efcb6d\"/><rect x=\"-74\" y=\"69\" width=\"148\" height=\"35\" rx=\"4\" fill=\"#102321\"/><text data-value x=\"0\" y=\"83\" fill=\"#efcb6d\" font-size=\"12\" text-anchor=\"middle\"/><text data-hint x=\"0\" y=\"99\" fill=\"#dce8df\" font-size=\"10\" text-anchor=\"middle\"/>";layer.append(gauge);

 // This frame lives in the joint's actual world plane. Never infer its
 // handedness from a fixed screen atan2 or from a camera-side sign alone.
 function dialFrame(j){
  if(!j||!Array.isArray(j.axis)||!Array.isArray(j.referenceDirection))return null;
  const normal=new THREE.Vector3(...j.axis),u=new THREE.Vector3(...j.referenceDirection);
  if(![...normal.toArray(),...u.toArray()].every(Number.isFinite)||normal.lengthSq()<1e-12)return null;
  normal.normalize();u.addScaledVector(normal,-u.dot(normal));if(u.lengthSq()<1e-12)return null;u.normalize();
  const sign=j.pose.rotationSign===-1?-1:1,v=new THREE.Vector3().crossVectors(normal,u).multiplyScalar(sign);
  camera.updateMatrixWorld();
  const origin=j.position.clone(),clip=origin.clone().project(camera),rect=canvas.getBoundingClientRect();
  if(!rect.width||!rect.height||clip.z< -1||clip.z>1)return null;
  const depth=-origin.clone().applyMatrix4(camera.matrixWorldInverse).z;if(depth<=0)return null;
  const units=camera.isOrthographicCamera?(camera.top-camera.bottom)/(camera.zoom*rect.height):2*depth*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))/(camera.zoom*rect.height);
  const radius=50*units,center=new THREE.Vector2((clip.x+1)*rect.width/2,(1-clip.y)*rect.height/2);
  const view=camera.isOrthographicCamera?camera.getWorldDirection(new THREE.Vector3()):origin.clone().sub(camera.getWorldPosition(new THREE.Vector3())).normalize();
  const project=direction=>{const p=origin.clone().addScaledVector(direction,radius).project(camera);return new THREE.Vector2((p.x+1)*rect.width/2-center.x,(1-p.y)*rect.height/2-center.y);};
  return {origin,normal,u,v,sign,radius,rect,center,project,edgeOn:Math.abs(view.dot(normal))<.15};
 }
 function dialPointer(event,frame){
  if(!frame)return null;
  camera.updateMatrixWorld();const rect=canvas.getBoundingClientRect(),ray=new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2),camera);
  if(Math.abs(ray.ray.direction.dot(frame.normal))<.15)return null;
  const hit=ray.ray.intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(frame.normal,frame.origin),new THREE.Vector3());
  if(!hit)return null;hit.sub(frame.origin);if(hit.length()<frame.radius*.08)return null;
  return THREE.MathUtils.radToDeg(Math.atan2(hit.dot(frame.v),hit.dot(frame.u)));
 }
 function drawProjectedDial(svg,j,value){
  const f=dialFrame(j);if(!f){svg.style.display='none';return null;}svg.style.display='block';
  const base=svg.parentElement.getBoundingClientRect();
  svg.style.left=(f.rect.left-base.left+f.center.x-75)+'px';svg.style.top=(f.rect.top-base.top+f.center.y-75)+'px';
  const points=[];for(let i=0;i<=64;i++){const a=i*Math.PI/32,p=f.project(f.u.clone().multiplyScalar(Math.cos(a)).addScaledVector(f.v,Math.sin(a)));points.push((i?'L':'M')+p.x.toFixed(2)+' '+p.y.toFixed(2));}
  svg.querySelector('[data-ring]').setAttribute('d',points.join(' ')+' Z');
  const ray=f.u.clone().applyAxisAngle(f.normal,THREE.MathUtils.degToRad(f.sign*(value-j.pose.value))),tip=f.project(ray.multiplyScalar(.88));
  const needle=svg.querySelector('[data-needle]');needle.setAttribute('x2',String(tip.x));needle.setAttribute('y2',String(tip.y));
  const zero=f.project(f.u.clone().applyAxisAngle(f.normal,THREE.MathUtils.degToRad(-f.sign*j.pose.value)).multiplyScalar(.9));
  const baseline=svg.querySelector('[data-zero]');baseline.setAttribute('x2',String(zero.x));baseline.setAttribute('y2',String(zero.y));
  svg.querySelector('[data-value]').textContent=value+' degrees';
  svg.querySelector('[data-hint]').textContent=f.edgeOn?'Edge-on: use side view':'Joint rotation plane';
  svg.setAttribute('aria-valuenow',String(value));svg.setAttribute('aria-valuetext',value+' degrees, free rotation');svg.setAttribute('aria-disabled',String(f.edgeOn));
  svg.style.cursor=f.edgeOn?'not-allowed':'crosshair';return f;
 }

 const cancelEdits=()=>{
  if(liveFrame!==null)win.cancelAnimationFrame(liveFrame);liveFrame=null;queued=null;localEdit=null;sliderEditing=false;
  const old=drag;drag=null;if(old&&gauge.hasPointerCapture(old.pointer))gauge.releasePointerCapture(old.pointer);
 };
 const command=(action,extra={})=>{const j=current();cancelEdits();if(j)send({nodeId:j.nodeId,jointId:j.id,action,...extra});};
 const apply=value=>{
  const j=current(),next=Number(value);if(!j||String(value).trim()===''||!Number.isFinite(next))return;
  cancelEdits();localEdit={key:j.key,value:next};send({nodeId:j.nodeId,jointId:j.id,action:'angle',value:next});sync();drawGauge();
 };
 const live=value=>{
  const j=current(),n=Number(value);if(!j||!Number.isFinite(n))return;const next=Math.round(n*10)/10;
  localEdit={key:j.key,value:next};queued={nodeId:j.nodeId,jointId:j.id,action:'live-angle',value:next};sync();drawGauge();
  if(liveFrame===null)liveFrame=win.requestAnimationFrame(()=>{liveFrame=null;const packet=queued;queued=null;if(packet)send(packet);});
 };
 const button=(title,action)=>{const b=doc.createElement('button');b.textContent=title;b.type='button';on(b,'click',action);bar.append(b);};
 button('Play motion',()=>command('play'));button('Stop / restore',()=>command('stop'));button('Apply angle',()=>apply(angle.value));button('-5 degrees',()=>apply(Number(angle.value)-5));button('+5 degrees',()=>apply(Number(angle.value)+5));button('Reset joint',()=>apply(0));button('Keep pose',()=>command('keep'));
 const note=doc.createElement('span');note.style.fontSize='11px';bar.append(note);doc.body.append(bar,layer);
 for(const el of bar.querySelectorAll('button,input,select'))el.style.cssText+=';background:#213338;color:#e2e8df;border:1px solid #52665e;border-radius:4px;padding:4px;font:12px Verdana,sans-serif;';
 const labels={slew:'Rotate vehicle body',boom:'Raise main arm',stick:'Bend outer arm',bucket:'Curl excavator bucket','tractor-loader':'Raise loader arms','tractor-loader-bucket':'Tilt loader bucket'};
 function sync(){
  const j=current();if(!j)return;const value=valueOf(j);select.value=j.key;caption.textContent=(labels[j.id]||j.pose.label)+' / '+value+' degrees';
  if(!sliderWindow||sliderWindow.key!==j.key||!sliderEditing)sliderWindow={key:j.key,lo:value-180,hi:value+180};
  slider.min=sliderWindow.lo;slider.max=sliderWindow.hi;slider.value=value;if(doc.activeElement!==angle)angle.value=value;
 }
 function drawGauge(){
  const j=current();if(!j||!show.checked){gauge.style.display='none';return;}
  const f=drawProjectedDial(gauge,j,valueOf(j));note.textContent=!f?'Rebuild preview for joint-plane metadata.':f.edgeOn?'Dial edge-on: orbit to a side view. Numeric angle and Bend still work.':'Free rotation. Bend spans one turn and recenters after release. No collision checking.';
 }
 on(gauge,'pointerdown',e=>{
  e.preventDefault();e.stopPropagation();const j=current();if(!j||e.button!==0)return;const frame=dialFrame(j),a=frame&&!frame.edgeOn?dialPointer(e,frame):null;
  if(a===null){note.textContent='Dial edge-on or missing joint-plane metadata. Use a side view or rebuild.';return;}
  const value=valueOf(j);command('stop');drag={pointer:e.pointerId,frame,last:a,value};gauge.setPointerCapture(e.pointerId);
 });
 on(gauge,'pointermove',e=>{if(!drag)return;e.preventDefault();e.stopPropagation();const a=dialPointer(e,drag.frame);if(a===null)return;const delta=((a-drag.last+540)%360)-180;drag.last=a;drag.value+=delta;live(drag.value);});
 const finishDial=e=>{e.preventDefault();e.stopPropagation();if(!drag)return;const value=drag.value,pointer=drag.pointer;drag=null;if(gauge.hasPointerCapture(pointer))gauge.releasePointerCapture(pointer);apply(Math.round(value*10)/10);};
 on(gauge,'pointerup',finishDial);on(gauge,'pointercancel',()=>command('stop'));on(gauge,'lostpointercapture',()=>{if(drag)command('stop');});
 on(gauge,'wheel',e=>{e.preventDefault();e.stopPropagation();},{passive:false});
 on(gauge,'keydown',e=>{if(['ArrowLeft','ArrowDown','ArrowRight','ArrowUp'].includes(e.key)){e.preventDefault();e.stopPropagation();const j=current();if(j)apply(valueOf(j)+(['ArrowLeft','ArrowDown'].includes(e.key)?-1:1));}});
 for(const type of ['pointerdown','pointermove','pointerup','wheel'])on(bar,type,e=>e.stopPropagation());
 const choose=key=>{command('stop');selected=key;sliderWindow=null;sync();};
 on(select,'change',()=>choose(select.value));
 on(angle,'keydown',e=>{if(e.key==='Enter')apply(angle.value);});
 on(slider,'pointerdown',()=>{command('stop');sliderEditing=true;});on(slider,'keydown',()=>{sliderEditing=true;});
 on(slider,'input',()=>live(slider.value));on(slider,'change',()=>{const value=slider.value;sliderEditing=false;apply(value);});
 on(slider,'blur',()=>{sliderEditing=false;sync();});
 on(doc,'keydown',e=>{if(e.key==='Escape')command('stop');});on(show,'change',()=>{if(!show.checked)command('stop');});
 on(canvas,'pointerdown',e=>{down=[e.clientX,e.clientY];});
 on(canvas,'pointerup',e=>{
  if(!show.checked||e.button!==0||!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>4)return;
  const b=canvas.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-b.left)/b.width*2-1,1-(e.clientY-b.top)/b.height*2),camera);
  const m=ray.intersectObjects(getRoot()?.children||[],false)[0]?.object.userData.gameAsset?.machinery,j=m?.joints?.filter(j=>j.pose).at(-1),match=joints.find(v=>v.nodeId===m?.nodeId&&v.id===j?.id);if(match)choose(match.key);
 });
 return {
  height:()=>bar.hidden?0:bar.getBoundingClientRect().height,
  refresh(){
   if(disposed)return;const next=[],seen=new Set();
   for(const mesh of getRoot()?.children||[]){const m=mesh.userData.gameAsset?.machinery;if(!m)continue;for(const j of m.joints||[]){
    if(!j.pose)continue;const key=m.nodeId+':'+j.id;if(seen.has(key))continue;seen.add(key);next.push({...j,nodeId:m.nodeId,key,position:new THREE.Vector3(...j.pivot).add(new THREE.Vector3(...(m.offset||[0,0,0])))});
   }}
   joints=next;bar.hidden=!getRoot();
   if(!joints.some(j=>j.key===selected)){cancelEdits();selected=joints[0]?.key||'';sliderWindow=null;}
   if(localEdit&&!drag&&liveFrame===null&&joints.some(j=>j.key===localEdit.key&&j.pose.value===localEdit.value))localEdit=null;
   for(const el of bar.querySelectorAll('button,input,select'))el.disabled=!joints.length;
   if(!joints.length)caption.textContent='No editable joints received. Build a machinery preview.';
   const sig=joints.map(j=>j.key).join('|');if(sig!==signature){signature=sig;select.replaceChildren();for(const m of markers)m.remove();markers=[];
    for(const j of joints){const option=doc.createElement('option');option.value=j.key;option.textContent=(labels[j.id]||j.pose.label)+' ('+j.nodeId+')';select.append(option);
     const marker=doc.createElement('button');marker.textContent='+';marker.title=option.textContent;marker.style.cssText='position:absolute;width:24px;height:24px;border:2px solid #dfc56c;border-radius:50%;background:#173b32;color:white;pointer-events:auto;transform:translate(-50%,-50%)';
     on(marker,'click',()=>choose(j.key));layer.append(marker);markers.push(marker);
    }
   }sync();
  },
  update(){
   if(disposed)return;layer.hidden=!show.checked||!joints.length;const b=canvas.getBoundingClientRect(),base=layer.getBoundingClientRect();
   joints.forEach((j,i)=>{const p=j.position.clone().project(camera),m=markers[i];m.hidden=p.z< -1||p.z>1;m.style.left=(b.left-base.left+(p.x+1)*b.width/2)+'px';m.style.top=(b.top-base.top+(1-p.y)*b.height/2)+'px';m.style.background=j.key===selected?'#947322':'#173b32';});drawGauge();
  },
  dispose(){command('stop');cancelEdits();disposed=true;events.abort();bar.remove();layer.remove();}
 };
}

function bwsCreatePreviewAxisGuide(container,camera,onView,top=8){
 const doc=container.ownerDocument,root=doc.createElement('div');
 root.style.cssText='position:absolute;right:8px;top:'+top+'px;z-index:25;width:130px;background:#102024df;border:1px solid #476358;border-radius:6px;padding:5px;box-sizing:border-box;color:#e6eee9;font:11px Verdana,sans-serif';
 root.setAttribute('aria-label','Preview axis directions');
 const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 120 92');svg.style.cssText='display:block;width:120px;height:92px;pointer-events:none';root.append(svg);
 const colors=['#ff7777','#8adb81','#7abaff'],marks=[];
 for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){
  const line=doc.createElementNS(svg.namespaceURI,'line'),label=doc.createElementNS(svg.namespaceURI,'text');
  line.setAttribute('stroke',colors[axis]);line.setAttribute('stroke-width',sign>0?'2':'1');
  if(sign<0)line.setAttribute('stroke-dasharray','3 2');
  label.setAttribute('fill',colors[axis]);label.setAttribute('text-anchor','middle');label.setAttribute('font-size','10');label.textContent=(sign>0?'+':'-')+'XYZ'[axis];svg.append(line,label);marks.push({axis,sign,line,label});
 }
 const buttons=doc.createElement('div');buttons.style.cssText='display:grid;grid-template-columns:repeat(3,1fr);gap:3px';
 for(const sign of [1,-1])for(let axis=0;axis<3;axis++){
  const button=doc.createElement('button');button.type='button';button.textContent=(sign>0?'+':'-')+'XYZ'[axis];button.title='View from '+button.textContent;
  button.style.cssText='padding:4px 2px;min-width:0;background:#21353c;border:1px solid #476358;border-radius:3px;color:'+colors[axis]+';font:11px Verdana,sans-serif';
  button.addEventListener('click',()=>onView(axis,sign));buttons.append(button);
 }
 root.append(buttons);container.append(root);
 return {dispose(){root.remove();},update(){
  const inverse=camera.quaternion.clone().invert();
  for(const mark of marks){const v=new THREE.Vector3();v.setComponent(mark.axis,mark.sign);v.applyQuaternion(inverse);
   mark.line.setAttribute('x1','60');mark.line.setAttribute('y1','46');mark.line.setAttribute('x2',String(60+v.x*29));mark.line.setAttribute('y2',String(46-v.y*29));
   mark.label.setAttribute('x',String(60+v.x*40));mark.label.setAttribute('y',String(49-v.y*40));mark.label.setAttribute('opacity',v.z<-.1?'.55':'1');
  }
 }};
}
