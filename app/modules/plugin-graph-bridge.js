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
 let previewWindow=null,previewRenderer=null,previewScene=null,previewCamera=null,previewRoot=null,previewFrame=0,previewTimer=null;
 let previewTarget=new THREE.Vector3(),previewRadius=10,previewYaw=-.6,previewPitch=.45,previewAxisGuide=null;
 const previewResources=()=>{
  if(!previewRoot)return;
  previewRoot.traverse(mesh=>{if(mesh.isMesh){mesh.geometry.dispose();mesh.material.map?.dispose();mesh.material.dispose();}});
  previewScene.remove(previewRoot);previewRoot=null;
 };
 function restorePreview(){
  const win=previewWindow;previewWindow=null;
  if(win&&!win.closed)win.cancelAnimationFrame(previewFrame);
  clearInterval(previewTimer);previewTimer=null;previewAxisGuide?.dispose();previewAxisGuide=null;previewResources();previewRenderer?.dispose();previewRenderer=null;
  previewScene=previewCamera=null;if(win&&!win.closed)win.close();
  detach.textContent='Detach preview';
  if(frame.isConnected)frame.contentWindow.postMessage({type:'bws-graph-preview-detached',detached:false},'*');
 }
 function refreshPreview(){
  if(!previewWindow||previewWindow.closed||!result)return;
  const parts=bwsValidateGraphParts(result.parts);previewResources();
  const root=new THREE.Group();previewRoot=root;previewScene.add(root);
  for(const part of parts){
   const material=new THREE.MeshStandardMaterial({color:part.color,roughness:part.roughness,side:part.doubleSided?THREE.DoubleSide:THREE.FrontSide,vertexColors:!!part.geometry.colors});
   const mesh=new THREE.Mesh(geometryFromData(part.geometry),material);
   mesh.position.fromArray(part.position);mesh.rotation.set(...part.rotation.map(THREE.MathUtils.degToRad));mesh.scale.fromArray(part.scale);root.add(mesh);
   if(part.textureUrl)new THREE.TextureLoader().load(part.textureUrl,texture=>{
    if(previewRoot!==root){texture.dispose();return;}texture.colorSpace=THREE.SRGBColorSpace;material.map=texture;material.needsUpdate=true;
   });
  }
  const bounds=new THREE.Box3().setFromObject(root);bounds.getCenter(previewTarget);
  previewRadius=Math.max(1,bounds.getSize(new THREE.Vector3()).length()*1.3);
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
   label.textContent='Live preview | Left-drag: orbit | Right-drag: pan | Scroll: zoom';back.textContent='Return preview';back.onclick=restorePreview;bar.append(label,back);doc.body.append(bar);
   const canvas=doc.createElement('canvas');canvas.style.cssText='display:block;touch-action:none';doc.body.append(canvas);
   previewRenderer=new THREE.WebGLRenderer({canvas,antialias:true});previewRenderer.setPixelRatio(Math.min(win.devicePixelRatio||1,2));
   previewScene=new THREE.Scene();previewScene.background=new THREE.Color('#17262a');previewScene.add(new THREE.HemisphereLight(0xffffff,0x354532,2));
   const sunlight=new THREE.DirectionalLight(0xffffff,3);sunlight.position.set(7,12,-9);previewScene.add(sunlight);
   previewCamera=new THREE.PerspectiveCamera(45,1,.01,100000);doc.body.style.position='relative';previewAxisGuide=bwsCreatePreviewAxisGuide(doc.body,previewCamera,(axis,sign)=>{if(axis===0){previewYaw=sign*Math.PI/2;previewPitch=0;}else if(axis===1){previewYaw=0;previewPitch=sign*(Math.PI/2-.0001);}else{previewYaw=sign>0?Math.PI:0;previewPitch=0;}},52);
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
    const width=Math.max(1,win.innerWidth),height=Math.max(1,win.innerHeight-44);
    if(width!==lastWidth||height!==lastHeight){lastWidth=width;lastHeight=height;previewRenderer.setSize(width,height);previewCamera.aspect=width/height;previewCamera.updateProjectionMatrix();}
    previewCamera.position.set(previewTarget.x+Math.sin(previewYaw)*Math.cos(previewPitch)*previewRadius,previewTarget.y+Math.sin(previewPitch)*previewRadius,previewTarget.z-Math.cos(previewYaw)*Math.cos(previewPitch)*previewRadius);
    previewCamera.lookAt(previewTarget);previewRenderer.render(previewScene,previewCamera);previewAxisGuide.update();previewFrame=win.requestAnimationFrame(draw);
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
 dialog.bwsGenerateGraph=graph=>new Promise((resolve,reject)=>{if(pending){reject(Error('A graph is already generating.'));return;}pending={requestId:crypto.randomUUID(),graph,resolve,reject,timer:setTimeout(()=>finish(Error('Graph generation timed out.')),120000)};if(ready)frame.contentWindow.postMessage({type:'bws-graph-preview-request',requestId:pending.requestId,graph},'*');});
 window.addEventListener('message',event=>{
  if(event.source!==frame.contentWindow||!enabled())return;const data=event.data;
  try{
   if(data?.type==='bws-plugin-ready'){ready=true;share.disabled=detach.disabled=download.disabled=loadNodes.disabled=false;if(pending)frame.contentWindow.postMessage({type:'bws-graph-preview-request',requestId:pending.requestId,graph:pending.graph},'*');}
   if(data?.type==='bws-graph-state'){state=bwsGraphState(data.state);save.disabled=false;}
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
