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
 const loadNodes=button('Load Geometry Nodes'),nodeFile=document.createElement('input');
 nodeFile.type='file';nodeFile.accept='.bwnc';nodeFile.hidden=true;header.append(nodeFile);
 let nodeSaveRequested=false,nodeSaveName=null,nodeSaveDialog=null;
 loadNodes.onclick=()=>{if(ready&&enabled())nodeFile.click();};
 nodeFile.onchange=async()=>{
  const picked=nodeFile.files?.[0];nodeFile.value='';if(!picked||!enabled())return;
  try{
   if(!/\.bwnc$/i.test(picked.name)||picked.size>8000000)throw Error('Choose a Geometry Nodes .bwnc file smaller than 8 MB.');
   const text=await picked.text();if(!enabled())return;
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
   if(data?.type==='bws-plugin-ready'){ready=true;share.disabled=detach.disabled=clearPreview.disabled=download.disabled=loadNodes.disabled=false;if(pending)frame.contentWindow.postMessage({type:'bws-graph-preview-request',requestId:pending.requestId,graph:pending.graph},'*');}
   if(data?.type==='bws-graph-preview-cleared'){previewClearPending=false;clearPreviewOutput();return;}
   if(previewClearPending&&['bws-graph-result','bws-graph-pose-preview','bws-graph-preview-result','bws-graph-preview-error'].includes(data?.type))return;
   if(data?.type==='bws-graph-state'){state=bwsGraphState(data.state);save.disabled=false;}
   if(data?.type==='bws-graph-pose-preview'&&previewWindow&&!previewWindow.closed&&result){bwsValidateGraphParts(data.parts);result={...result,parts:data.parts};refreshPreview();}
   if(data?.type==='bws-graph-result'){result=null;add.disabled=replace.disabled=true;bwsValidateGraphParts(data.parts);result={graph:sanitizeGeometryNodeGraph(data.graph),parts:data.parts};refreshPreview();add.disabled=false;replace.disabled=false;status.textContent=data.parts.length+' parts ready for '+result.graph.name+'.';}
   if(data?.type==='bws-graph-file'){if(typeof data.text!=='string'||data.text.length>8000000)throw Error('Geometry Nodes file exceeds 8 MB.');JSON.parse(data.text);file={name:safeFileName(String(data.name||'nodes').replace(/\.bwnc$/i,''),'nodes')+'.bwnc',text:data.text};download.disabled=false;if(nodeSaveRequested){nodeSaveRequested=false;downloadBlob(nodeSaveName||file.name,new Blob([file.text],{type:'application/json'}));status.textContent='Download requested: '+(nodeSaveName||file.name);nodeSaveName=null;}else status.textContent='Geometry Nodes file ready. Choose Save Geometry Nodes.';}
   if(data?.requestId===pending?.requestId&&pending&&['bws-graph-preview-result','bws-graph-preview-error'].includes(data.type)){if(data.type==='bws-graph-preview-error')throw Error(String(data.message).slice(0,500));finish(null,bwsValidateGraphParts(data.parts));}
  }catch(error){status.textContent=error.message;if(data?.requestId===pending?.requestId&&pending)finish(error);}
 },{signal:controller.signal});const cleanup=dialog.bwsCleanup;dialog.bwsCleanup=()=>{nodeSaveDialog?.remove();nodeSaveDialog=null;restorePreview();cleanup?.();controller.abort();state=result=file=null;finish(Error('Graph workspace closed.'));};
}
async function bwsRequestGraphPreview(graph){
 await bwsPluginStorageReady;const plugin=pluginManifestById('geometry-nodes');if(!plugin?.enabled||plugin.apiVersion!==4||plugin.contributes?.graphWorkspace!==true)throw Error('Install and enable Geometry Nodes to generate scene trees or rocks from graph recipes.');
 const opened=!bwsPluginWindows.has('geometry-nodes');if(opened)bwsOpenPluginWorkspace('geometry-nodes');const dialog=bwsPluginWindows.get('geometry-nodes');
 try{const parts=await dialog.bwsGenerateGraph(sanitizeGeometryNodeGraph(graph));return parts.map(spec=>{const mesh=new THREE.Mesh(geometryFromData(spec.geometry),new THREE.MeshStandardMaterial({color:spec.color,roughness:spec.roughness,side:spec.doubleSided?THREE.DoubleSide:THREE.FrontSide,vertexColors:!!spec.geometry.colors}));mesh.name=spec.name;mesh.position.fromArray(spec.position);mesh.rotation.set(...spec.rotation.map(THREE.MathUtils.degToRad));mesh.scale.fromArray(spec.scale);mesh.userData={_sceneTextureUrl:spec.textureUrl};mesh.updateMatrixWorld(true);return mesh;});}
 finally{if(opened&&bwsPluginWindows.get('geometry-nodes')===dialog)bwsClosePluginWorkspace('geometry-nodes');}
}



function bwsCreateDetachedPoseControls(doc,canvas,camera,getRoot,send){
 const bar=doc.createElement('div');bar.style.cssText='position:absolute;bottom:0;left:0;right:0;display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:8px;background:#122326;border-top:1px solid #476358;z-index:30';
 const caption=doc.createElement('strong');caption.style.color='#e1c36c';bar.append(caption);
 const show=doc.createElement('input');show.type='checkbox';show.checked=true;const showLabel=doc.createElement('label');showLabel.append(show,doc.createTextNode(' Pose joints'));bar.append(showLabel);
 const select=doc.createElement('select');select.setAttribute('aria-label','Preview joint');bar.append(select);
 const input=(label,type)=>{const el=doc.createElement('input');el.type=type;el.setAttribute('aria-label',label);el.style.width=type==='range'?'140px':'60px';el.step='1';const wrap=doc.createElement('label');wrap.append(doc.createTextNode(label+' '),el);bar.append(wrap);return el;};
 const angle=input('Angle','number'),slider=input('Bend','range'),min=input('Min','number'),max=input('Max','number');
 let joints=[],selected='',markers=[],signature='';const current=()=>joints.find(j=>j.key===selected);
 const command=(action,extra={})=>{const j=current();if(j)send({nodeId:j.nodeId,jointId:j.id,action,...extra});};
 const apply=value=>{const j=current();if(j&&Number.isFinite(Number(value)))command('angle',{value:Math.max(j.pose.minimum,Math.min(j.pose.maximum,Number(value)))});};
 const button=(title,action)=>{const b=doc.createElement('button');b.textContent=title;b.type='button';b.onclick=action;bar.append(b);};
 button('Play motion',()=>command('play'));button('Stop / restore',()=>command('stop'));button('Apply angle',()=>apply(angle.value));button('-5 degrees',()=>apply(Number(angle.value)-5));button('+5 degrees',()=>apply(Number(angle.value)+5));
 button('Apply limits',()=>{if(min.value!==''&&max.value!==''&&Number(min.value)<=Number(max.value))command('limits',{minimum:Number(min.value),maximum:Number(max.value)});});button('Reset joint',()=>apply(0));button('Keep pose',()=>command('keep'));
 const note=doc.createElement('span');note.textContent='Local joint angles. Limits are not collision detection.';note.style.fontSize='11px';bar.append(note);doc.body.append(bar);
 for(const el of bar.querySelectorAll('button,input,select'))el.style.cssText+=';background:#213338;color:#e2e8df;border:1px solid #52665e;border-radius:4px;padding:4px;font:12px Verdana,sans-serif;';
 const layer=doc.createElement('div');layer.style.cssText='position:absolute;inset:44px 0 0;overflow:hidden;pointer-events:none';doc.body.append(layer);
 const gauge=doc.createElementNS('http://www.w3.org/2000/svg','svg');gauge.setAttribute('viewBox','-70 -70 140 165');gauge.style.cssText='position:absolute;width:140px;height:165px;pointer-events:none;z-index:26';
 gauge.innerHTML='<circle r="50" fill="#102321" fill-opacity=".7" stroke="#9aae9d"/><line x1="0" y1="0" x2="50" y2="0" stroke="#aabbac" stroke-dasharray="3 3"/><line data-needle x1="0" y1="0" stroke="#efcb6d" stroke-width="3"/><g fill="#e4eada" font-size="11" text-anchor="middle"><text x="60" y="4">0</text><text x="0" y="-56">90</text><text x="-59" y="4">180</text><text x="0" y="64">-90</text><text data-value x="0" y="85"/></g>';layer.append(gauge);
 const labels={slew:'Rotate vehicle body',boom:'Raise main arm',stick:'Bend outer arm',bucket:'Curl excavator bucket','tractor-loader':'Raise loader arms','tractor-loader-bucket':'Tilt loader bucket'};
 function sync(){const j=current();if(!j)return;select.value=j.key;caption.textContent=(labels[j.id]||j.pose.label)+' / '+j.pose.value+' degrees';for(const [el,value] of [[angle,j.pose.value],[slider,j.pose.value],[min,j.pose.minimum],[max,j.pose.maximum]])if(doc.activeElement!==el)el.value=value;slider.min=angle.min=j.pose.minimum;slider.max=angle.max=j.pose.maximum;}
 select.onchange=()=>{command('stop');selected=select.value;sync();};angle.onkeydown=e=>{if(e.key==='Enter')apply(angle.value);};slider.oninput=()=>{angle.value=slider.value;};slider.onchange=()=>apply(slider.value);
 const escape=e=>{if(e.key==='Escape')command('stop');};doc.addEventListener('keydown',escape);
 let down;const pointerDown=e=>{down=[e.clientX,e.clientY];};canvas.addEventListener('pointerdown',pointerDown);
 const pick=e=>{if(!show.checked||e.button!==0||!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>4)return;const b=canvas.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-b.left)/b.width*2-1,1-(e.clientY-b.top)/b.height*2),camera);const m=ray.intersectObjects(getRoot()?.children||[],false)[0]?.object.userData.gameAsset?.machinery,j=m?.joints?.filter(j=>j.pose).at(-1);const match=joints.find(v=>v.nodeId===m?.nodeId&&v.id===j?.id);if(match){command('stop');selected=match.key;sync();}};canvas.addEventListener('pointerup',pick);
 return {
  height:()=>bar.hidden?0:bar.getBoundingClientRect().height,
  refresh(){
   const next=[],seen=new Set();for(const mesh of getRoot()?.children||[]){const m=mesh.userData.gameAsset?.machinery;if(!m)continue;for(const j of m.joints||[]){if(!j.pose)continue;const key=m.nodeId+':'+j.id;if(seen.has(key))continue;seen.add(key);next.push({...j,nodeId:m.nodeId,key,position:new THREE.Vector3(...j.pivot).add(new THREE.Vector3(...(m.offset||[0,0,0])))});}}
   joints=next;bar.hidden=!getRoot();
   for(const el of bar.querySelectorAll('button,input,select'))el.disabled=!joints.length;
   if(!joints.length)caption.textContent='No editable joints received. Update GN and build a machinery preview.';
   if(!joints.some(j=>j.key===selected))selected=joints[0]?.key||'';
   const sig=joints.map(j=>j.key).join('|');if(sig!==signature){signature=sig;select.replaceChildren();for(const m of markers)m.remove();markers=[];for(const j of joints){const option=doc.createElement('option');option.value=j.key;option.textContent=(labels[j.id]||j.pose.label)+' ('+j.nodeId+')';select.append(option);const marker=doc.createElement('button');marker.textContent='+';marker.title=option.textContent;marker.style.cssText='position:absolute;width:24px;height:24px;border:2px solid #dfc56c;border-radius:50%;background:#173b32;color:white;pointer-events:auto;transform:translate(-50%,-50%)';marker.onclick=()=>{command('stop');selected=j.key;sync();};layer.append(marker);markers.push(marker);}}
   sync();
  },
  update(){layer.hidden=!show.checked||!joints.length;const b=canvas.getBoundingClientRect();joints.forEach((j,i)=>{const p=j.position.clone().project(camera),m=markers[i];m.hidden=p.z< -1||p.z>1;m.style.left=((p.x+1)*b.width/2)+'px';m.style.top=((1-p.y)*b.height/2)+'px';m.style.background=j.key===selected?'#947322':'#173b32';});const j=current();if(j){const p=j.position.clone().project(camera),a=THREE.MathUtils.degToRad(j.pose.value);gauge.style.left=((p.x+1)*b.width/2-70)+'px';gauge.style.top=((1-p.y)*b.height/2-70)+'px';gauge.querySelector('[data-needle]').setAttribute('x2',String(44*Math.cos(a)));gauge.querySelector('[data-needle]').setAttribute('y2',String(-44*Math.sin(a)));gauge.querySelector('[data-value]').textContent=j.pose.value+' degrees';}},
  dispose(){doc.removeEventListener('keydown',escape);canvas.removeEventListener('pointerdown',pointerDown);canvas.removeEventListener('pointerup',pick);bar.remove();layer.remove();}
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
