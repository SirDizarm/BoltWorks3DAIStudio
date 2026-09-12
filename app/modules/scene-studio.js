import { RoomEnvironment as BwsSceneRoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { mergeGeometries as bwsSceneMergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// Scene Studio owns its renderer, generated scene and asset copies. The model workspace stays untouched.
let bwsSceneStudio=null;
function openBwsSceneStudio(){
 if(bwsSceneStudio){bwsSceneStudio.host.hidden=false;bwsSceneStudio.host.querySelector("[data-scene-workspace]").value="scene";bwsSceneStudio.refreshSources();bwsSceneStudio.resize();return;}
 const host=document.createElement("section");host.id="bwsSceneStudio";host.setAttribute("aria-label","Scene Studio");
 host.innerHTML='<style>body:has(#bwsSceneStudio:not([hidden])) .experimental-notice{display:none!important}#bwsSceneStudio{position:fixed;inset:0;z-index:5000;background:#162024;color:#e7e9df;display:grid;grid-template-rows:58px 1fr 32px;font:13px Georgia,serif}#bwsSceneStudio[hidden]{display:none}#bwsSceneStudio header{display:flex;align-items:center;gap:12px;padding:10px 18px;background:#223035}#bwsSceneStudio h2{margin:0 auto 0 0;font:22px Georgia,serif}#bwsSceneStudio button{padding:7px 12px;border:1px solid #61736b;border-radius:4px;background:#293f3c;color:#f4f0df;cursor:pointer}#bwsSceneStudio main{display:grid;grid-template-columns:285px 1fr;min-height:0}#bwsSceneStudio aside{overflow:auto;padding:12px;background:linear-gradient(145deg,#263431,#142125)}#bwsSceneStudio fieldset{border:1px solid #53685c;margin:0 0 15px;padding:12px;border-radius:6px}#bwsSceneStudio legend{color:#e5c78b;font-size:16px}#bwsSceneStudio label{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:9px 0}#bwsSceneStudio input,#bwsSceneStudio select{max-width:105px;width:105px;background:#101c20;color:#eef2e6;border:1px solid #53685c;padding:5px}#bwsSceneStudio .scene-view{position:relative;min-width:0;min-height:0;background:radial-gradient(#61786d,#172629)}#bwsSceneStudio canvas{display:block;width:100%;height:100%}#bwsSceneStudio footer{padding:7px 15px;background:#223035}#bwsSceneStudio .scene-hint{font:12px sans-serif;line-height:1.5;color:#b7c9c0}#bwsSceneStudio .scene-tools{position:absolute;right:12px;top:12px;display:flex;gap:6px}@media(max-width:700px){#bwsSceneStudio main{grid-template-columns:210px 1fr}#bwsSceneStudio header{gap:5px;padding:6px}#bwsSceneStudio h2{font-size:17px}#bwsSceneStudio button{padding:6px}#bwsSceneStudio label{flex-wrap:wrap}}</style><header><h2>Scene Studio <small> / Town workshop</small></h2><label>Workspace <select data-scene-workspace aria-label="Workspace"><option value="general">General 3D</option><option value="minecraft">Minecraft</option><option value="scene" selected>Scene Studio</option></select></label><button data-action="save">Save scene</button><button data-action="load">Load scene</button><button data-action="png">Render PNG</button><button data-action="close">Back to Model</button></header><main><aside><p class="scene-hint">A separate rendering scene. Capture one house from your model, then build a seeded town. These recipe cards run top to bottom; they do not change your geometry-node graph.</p><button data-action="capture">Add current model as variant</button><button data-action="variants">Generate variants from house nodes</button><p class="scene-hint" data-library>House library: empty</p><button data-action="clearVariants">Clear house library</button><label>Layout <select data-layout><option value="village">Winding village roads</option><option value="grid">Street grid</option></select></label><fieldset><legend>Node asset sources</legend><label>Tree graph <select data-nature="tree"></select></label><button data-action="treeNodes">Use tree node output</button><label>Rock graph <select data-nature="rock"></select></label><button data-action="rockNodes">Use rock node output</button><button data-action="refreshNodes">Refresh graph list</button><p class="scene-hint" data-nature-status>Trees and rocks are generated from editable BWS node graphs. Leave the selectors empty to create starter graphs automatically.</p></fieldset><div data-fields></div><button data-action="generate">Generate town</button><p class="scene-hint" data-generation-status role="status" aria-live="polite">Ready. Missing tree or rock sources will be skipped.</p><p class="scene-hint">Orbit: drag. Pan: right drag. Zoom: wheel. Save scene includes the captured house; it can contain your textures.</p></aside><div class="scene-view"><canvas></canvas><div class="scene-tools"><button data-action="fit">Frame town</button><button data-action="light">Apply lighting</button></div></div></main><footer>Capture a house to begin.</footer><input hidden type="file" accept=".bwscene,application/json" data-scene-file>';
 document.body.appendChild(host);
 host.querySelector("[data-scene-workspace]").addEventListener("change",event=>setWorkspace(event.target.value));
 const defaults={seed:42,count:24,columns:6,spacing:1.35,sizeVariation:.14,rotation:12,trees:100,rocks:60,roadWidth:2.5,ambientLight:.55,sun:2,sunAngle:35,exposure:.8,fog:.002,sky:"#b9c9c2",ground:"#64734b",resolution:1920,pond:1,pondSize:1,chaos:.5,sceneGrime:0,ambientSmoke:0,lockCamera:1,treeBurnPercent:0,groundBurn:0,natureFirePercent:15,damagePercent:0,damageSeverity:.65,burnAmount:.8,fireEnabled:1,smokeEnabled:1,effectSize:2,effectLifetime:2,effectIntensity:1,effectWind:.3,effectColor:"#ff761b",fireLightStrength:2.4,fireLighting:1,smokeColor:"#55514d",playbackSpeed:1,layout:"village"};
 const settings={...defaults},fields=host.querySelector("[data-fields]");
 const groups=[["01 / Seed",[["Seed","seed",0,999999,1]]],["02 / House plots",[["Houses","count",1,64,1],["Columns","columns",1,12,1],["Plot spacing","spacing",1.1,3,.05],["Size variation","sizeVariation",0,.3,.01],["Rotation jitter","rotation",0,40,1]]],["03 / Paths",[["Road width","roadWidth",.5,6,.25]]],["04 / Nature scatter",[["Trees","trees",0,500,1],["Rocks","rocks",0,500,1]]],["05 / Water node",[["Pond enabled (0/1)","pond",0,1,1],["Pond size","pondSize",.5,1.4,.1]]],["06 / Render",[["Ambient light","ambientLight",0,3,.05],["Sun strength","sun",0,8,.1],["Sun angle","sunAngle",10,80,1],["Exposure","exposure",.05,2.5,.05],["Fog","fog",0,.02,.001],["Sky","sky","color"],["Ground","ground","color"],["Image width","resolution",640,3840,1]]]];
 groups.push(["07 / Damage & effects",[["Damaged houses (%)","damagePercent",0,100,1],["Damage severity","damageSeverity",.1,1,.05],["Scorch amount","burnAmount",0,1,.05],["Fire enabled (0/1)","fireEnabled",0,1,1],["Smoke enabled (0/1)","smokeEnabled",0,1,1],["Effect size","effectSize",.2,8,.1],["Particle lifetime","effectLifetime",.5,10,.1],["Intensity","effectIntensity",0,2,.1],["Fire light strength","fireLightStrength",0,5,.1],["Wind","effectWind",-2,2,.1],["Fire color","effectColor","color"],["Smoke color","smokeColor","color"],["Playback speed","playbackSpeed",.1,2,.1]]]);
 groups.push(["08 / Burned landscape",[["Burned trees (%)","treeBurnPercent",0,100,1],["Scorched ground (%)","groundBurn",0,100,1],["Trees still burning (%)","natureFirePercent",0,100,1]]]);
 groups.push(["09 / Soot & atmosphere",[["Scene grime","sceneGrime",0,1,.05],["Drifting smoke","ambientSmoke",0,1,.05]]]);
 groups.push(["10 / Terrain & irregularity",[["Chaos","chaos",0,1,.05]]]);
 for(const [title,rows]of groups){const f=document.createElement("fieldset"),l=document.createElement("legend");l.textContent=title;f.appendChild(l);for(const [label,key,min,max,step]of rows){const lab=document.createElement("label");lab.textContent=label;const input=document.createElement("input");input.dataset.setting=key;input.type=key==="chaos"?"range":min==="color"?"color":"number";if(min!=="color"){input.min=min;input.max=max;input.step=step;}input.value=settings[key];lab.appendChild(input);f.appendChild(lab);}if(title==="06 / Render"){const dusk=document.createElement("button");dusk.type="button";dusk.dataset.action="dusk";dusk.textContent="Dusk lighting";f.appendChild(dusk);}fields.appendChild(f);}
 const view=host.querySelector(".scene-view"),gl=new THREE.WebGLRenderer({canvas:host.querySelector("canvas"),antialias:true,preserveDrawingBuffer:true});
 gl.setPixelRatio(Math.min(devicePixelRatio,1.5));gl.shadowMap.enabled=true;gl.shadowMap.type=THREE.PCFSoftShadowMap;gl.toneMapping=THREE.ACESFilmicToneMapping;gl.outputColorSpace=THREE.SRGBColorSpace;
 const world=new THREE.Scene(),cam=new THREE.PerspectiveCamera(45,1,.1,5000),controls=new OrbitControls(cam,gl.domElement);cam.position.set(35,30,35);controls.enableDamping=true;
 const hemi=new THREE.HemisphereLight("#dce9ee","#5a4834",1.6),sun=new THREE.DirectionalLight("#ffdfad",settings.sun);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-.00015;sun.shadow.normalBias=.035;world.add(hemi,sun,sun.target);
 let asset=null,variants=[],nature={tree:null,rock:null},town=null,extent=50,busy=false,disposed=false;
 const pmrem=new THREE.PMREMGenerator(gl),room=new BwsSceneRoomEnvironment(),environment=pmrem.fromScene(room,.04);world.environment=environment.texture;room.dispose();pmrem.dispose();
 let effectTime=0,effectPlaying=true,lastFrame=performance.now(),effectObjects=[];
 const fireDepth=new THREE.WebGLRenderTarget(1,1,{minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,depthBuffer:true});
 fireDepth.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
 const fireBufferSize=new THREE.Vector2(),firePoint=new THREE.Vector3();
 // Independent moving flame-tongue lights, with a bounded shadow budget.
 const fireLights=Array.from({length:8},()=>{const light=new THREE.PointLight(0xff9c45,0,10,2);light.castShadow=true;light.shadow.mapSize.set(256,256);light.shadow.bias=-.0003;light.shadow.normalBias=.035;light.shadow.camera.near=.08;world.add(light);return light;});
 function renderScene(){
  world.updateMatrixWorld(true);
  cam.updateMatrixWorld(true);
  const fireFrustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse));
  const fires=effectObjects.filter(o=>o.userData.bwsFireLight&&o.visible&&o.userData.bwsFireLight.intensity>0&&fireFrustum.intersectsObject(o));
  const tongues=[];
  for(const fire of fires){
   const u=fire.material.uniforms,time=u.fxTime.value*u.speed.value,seed=u.seed.value;
   const scale=fire.getWorldScale(new THREE.Vector3()).x;
   for(let tongue=0;tongue<4;tongue++){
    const fract=x=>x-Math.floor(x);
    const rate=.27+.085*fract(Math.sin(seed+tongue*17.13)*43758.5453);
    const clock=time*rate+tongue*.25+fract(seed*.3),age=fract(clock);
    const phase=seed+tongue*2.39996+Math.floor(clock)*1.618;
    const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
    const variation=fract(Math.sin(phase*7.73)*43758.5453);
    const life=smooth(0,.07,age)*(1-smooth(.78,1,age));
    const height=1.35+.45*variation+.38*Math.sin(age*Math.PI),t=.42,y=age*(2+.18*variation)+height*t,h=y*.25;
    // Follow the upward-moving packet and extinguish its light before respawning.
    const point=new THREE.Vector3(
     (.22+.20*variation)*Math.cos(phase)*(1-.25*t)+Math.sin(t*6.2-time*2.7+phase)*t*(.15+.18*t)+Math.sin(age*8+phase)*age*.12+u.wind.value*h*h*.23,
     y,
     (.22+.20*variation)*Math.sin(phase)*(1-.25*t)+Math.cos(t*5.1-time*2.3+phase)*t*(.15+.18*t)+Math.cos(age*6.7+phase*1.4)*age*.12);
    fire.localToWorld(point);
    const flicker=.84+.10*Math.sin(time*7.1+phase)+.06*Math.sin(time*13.7+phase*2);
    tongues.push({point,scale,intensity:fire.userData.bwsFireLight.intensity*life,flicker,distance:point.distanceToSquared(cam.position)});
   }
  }
  // Eight nearby tongue lights keep shadow-map cost bounded in large towns.
  tongues.sort((a,b)=>a.distance-b.distance);
  for(let i=0;i<fireLights.length;i++){
   const light=fireLights[i],tongue=tongues[i];light.visible=!!tongue;if(!tongue)continue;
   light.position.copy(tongue.point);
   light.intensity=65*tongue.scale*tongue.scale*tongue.intensity*tongue.flicker*.3*settings.fireLightStrength*settings.fireLighting;
   light.distance=Math.max(2,tongue.scale*12);
   light.shadow.camera.far=light.distance;light.shadow.camera.updateProjectionMatrix();
  }
  const volumes=effectObjects.filter(o=>o.material?.uniforms?.useSceneDepth);
  if(!volumes.length){gl.render(world,cam);return;}
  gl.getDrawingBufferSize(fireBufferSize);
  if(fireDepth.width!==fireBufferSize.x||fireDepth.height!==fireBufferSize.y)fireDepth.setSize(fireBufferSize.x,fireBufferSize.y);
  const hidden=[];world.traverse(o=>{if(o.visible&&(o.isPoints||(o.isMesh&&(Array.isArray(o.material)?o.material.some(m=>m.transparent):o.material?.transparent)))){hidden.push(o);o.visible=false;}});
  const previousTarget=gl.getRenderTarget();
  try{gl.setRenderTarget(fireDepth);gl.clear();gl.render(world,cam);}
  finally{for(const o of hidden)o.visible=true;gl.setRenderTarget(previousTarget);}
  for(const volume of volumes){const u=volume.material.uniforms;u.sceneDepth.value=fireDepth.depthTexture;u.depthViewport.value.copy(fireBufferSize);u.useSceneDepth.value=1;}
  gl.render(world,cam);
 }

 const effectTools=document.createElement("div");effectTools.style.cssText="position:absolute;bottom:12px;left:12px;right:12px;display:flex;flex-wrap:wrap;gap:6px";effectTools.innerHTML='<button data-action="aftermath">Burned-town aftermath</button><button data-action="effectPlay">Pause effects</button><button data-action="fireLightToggle">Fire lighting: ON</button><button data-action="effectRestart">Restart effects</button><button data-action="effectTest">Test fire at view target</button><button data-action="effectClear">Clear test effect</button><button data-action="restoreScene">Clear Fire / Restore House</button><button data-action="effectRecipes">Add effect recipes to nodes</button>';view.appendChild(effectTools);
 const cameraViews=[];
 const cameraPanel=document.createElement("details");cameraPanel.open=true;cameraPanel.style.cssText="position:absolute;right:12px;top:55px;width:230px;max-width:calc(100% - 24px);max-height:55%;overflow:auto;box-sizing:border-box;padding:10px;background:rgba(20,33,37,.94);border:1px solid #61736b;border-radius:5px";
 cameraPanel.innerHTML='<summary style="cursor:pointer;color:#e5c78b">Saved cameras</summary><label><input type="checkbox" data-camera-lock checked style="width:auto"> Keep view when regenerating</label><label>Camera name <input data-camera-name maxlength="60" placeholder="Courtyard"></label><button type="button" data-camera-add>Add current view</button><div data-camera-list></div><p class="scene-hint">Orbit or pan to place a camera, then add it here. Saved cameras and this panel are not drawn into PNG exports.</p>';
 view.appendChild(cameraPanel);
 const cameraLock=cameraPanel.querySelector("[data-camera-lock]");cameraLock.addEventListener("change",()=>{settings.lockCamera=cameraLock.checked?1:0;});
 function renderCameraViews(){
  cameraLock.checked=!!settings.lockCamera;const list=cameraPanel.querySelector("[data-camera-list]");list.replaceChildren();
  cameraViews.forEach((entry,index)=>{const row=document.createElement("div");row.style.cssText="display:flex;gap:4px;margin-top:7px";
   const jump=document.createElement("button");jump.type="button";jump.textContent=entry.name;jump.title="Jump to this camera";jump.style.cssText="flex:1;min-width:0;overflow-wrap:anywhere";
   jump.addEventListener("click",()=>{cam.position.fromArray(entry.position);controls.target.fromArray(entry.target);cam.fov=entry.fov;cam.updateProjectionMatrix();controls.update();status("Camera: "+entry.name);});
   const update=document.createElement("button");update.type="button";update.textContent="Set";update.title="Replace this camera with the current view";update.addEventListener("click",()=>{entry.position=cam.position.toArray();entry.target=controls.target.toArray();entry.fov=cam.fov;const name=cameraPanel.querySelector("[data-camera-name]").value.trim();if(name)entry.name=name;renderCameraViews();});
   const remove=document.createElement("button");remove.type="button";remove.textContent="X";remove.setAttribute("aria-label","Delete "+entry.name);remove.addEventListener("click",()=>{cameraViews.splice(index,1);renderCameraViews();});row.append(jump,update,remove);list.appendChild(row);
  });
 }
 cameraPanel.querySelector("[data-camera-add]").addEventListener("click",()=>{if(cameraViews.length>=16){status("Camera limit: 16 saved views. Replace or remove one first.");return;}const input=cameraPanel.querySelector("[data-camera-name]");cameraViews.push({name:input.value.trim()||"Camera "+(cameraViews.length+1),position:cam.position.toArray(),target:controls.target.toArray(),fov:cam.fov});input.value="";renderCameraViews();});
 function loadCameraViews(saved){cameraViews.length=0;const vector=v=>Array.isArray(v)&&v.length===3&&v.every(n=>Number.isFinite(n)&&Math.abs(n)<=1000000);if(Array.isArray(saved))for(const v of saved.slice(0,16)){if(!v||!vector(v.position)||!vector(v.target))continue;cameraViews.push({name:typeof v.name==="string"?v.name.slice(0,60):"Camera "+(cameraViews.length+1),position:v.position.slice(),target:v.target.slice(),fov:Number.isFinite(v.fov)?Math.max(10,Math.min(100,v.fov)):45});}renderCameraViews();}
 const status=t=>{host.querySelector("footer").textContent=t;host.querySelector("[data-generation-status]").textContent=t;};
 function readSettings(){settings.layout=host.querySelector("[data-layout]").value;for(const input of fields.querySelectorAll("input")){settings[input.dataset.setting]=input.type==="color"?input.value:Math.max(Number(input.min),Math.min(Number(input.max),Number(input.value)||0));input.value=settings[input.dataset.setting];}for(const key of["seed","count","columns","trees","rocks","resolution"])settings[key]=Math.round(settings[key]);}
 function applyFields(){const fireToggle=host.querySelector('[data-action="fireLightToggle"]');if(fireToggle)fireToggle.textContent=settings.fireLighting?"Fire lighting: ON":"Fire lighting: OFF";host.querySelector("[data-layout]").value=settings.layout;for(const input of fields.querySelectorAll("input"))input.value=settings[input.dataset.setting];}
 function resize(){if(host.hidden)return;const w=Math.max(1,view.clientWidth),h=Math.max(1,view.clientHeight);gl.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix();}
 function disposeGroup(group){if(!group)return;const gs=new Set(),ms=new Set();group.traverse(o=>{if(o.geometry)gs.add(o.geometry);for(const m of(Array.isArray(o.material)?o.material:[o.material]))if(m)ms.add(m);});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());}
 function lighting(){readSettings();world.background=new THREE.Color(settings.sky);world.fog=new THREE.FogExp2(settings.sky,settings.fog);gl.toneMappingExposure=settings.exposure;sun.intensity=settings.sun;hemi.intensity=settings.ambientLight;const a=THREE.MathUtils.degToRad(settings.sunAngle);sun.position.set(extent*.65,extent*Math.tan(a)+15,extent*.45);const c=sun.shadow.camera;c.left=c.bottom=-extent;c.right=c.top=extent;c.near=.1;c.far=extent*8+200;c.updateProjectionMatrix();}
 function fit(){cam.position.set(extent*.9,extent*.75,extent*.95);controls.target.set(0,0,0);cam.far=extent*15+100;cam.updateProjectionMatrix();controls.update();}
 async function capture(role="house",sourceGraph=null,previewMeshes=null){
  const visible=previewMeshes|| (sourceGraph?(sourceGraph.generatedIds||[]).map(id=>findObject(id)).filter(Boolean):objects.filter(o=>o.visible&&!o.userData.hidden)),seen=new Set(),batches=new Map();let vertices=0;
  if(!visible.length)throw Error("There are no visible model meshes to capture.");
  scene.updateMatrixWorld(true);
  for(const rootObject of visible)rootObject.updateWorldMatrix(true,true);
  for(const rootObject of visible)rootObject.traverse(o=>{
   if(!o.isMesh||seen.has(o)||!o.visible)return;seen.add(o);if(o.isSkinnedMesh||o.isInstancedMesh)throw Error("Capture a static house mesh, not a rig or instanced model.");
   const pos=o.geometry?.getAttribute("position");if(!pos)return;vertices+=o.geometry.index?.count||pos.count;if(vertices>2500000)throw Error("House is too detailed for this preview. Reduce its geometry before capture.");
   let g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrixWorld);if(!g.getAttribute("normal"))g.computeVertexNormals();if(!g.getAttribute("uv"))g.setAttribute("uv",new THREE.Float32BufferAttribute(new Float32Array(g.getAttribute("position").count*2),2));
   for(const key of Object.keys(g.attributes))if(!["position","normal","uv"].includes(key))g.deleteAttribute(key);
   const materials=Array.isArray(o.material)?o.material:[o.material],parts=Array.isArray(o.material)?g.groups:[{start:0,count:g.getAttribute("position").count,materialIndex:0}];
   for(const part of parts){const m=materials[part.materialIndex];if(!m)continue;const key=JSON.stringify([m.color?.getHex(),m.map?.uuid,m.normalMap?.uuid,m.roughnessMap?.uuid,m.metalnessMap?.uuid,m.roughness,m.metalness,m.opacity,m.transparent,m.side,m.alphaTest,m.emissive?.getHex()]);
    let entry=batches.get(key);if(!entry){const material=new THREE.MeshStandardMaterial({color:m.color||"#ffffff",map:m.map||null,normalMap:m.normalMap||null,roughnessMap:m.roughnessMap||null,metalnessMap:m.metalnessMap||null,roughness:m.roughness??.8,metalness:m.metalness??0,opacity:m.opacity??1,transparent:!!m.transparent,side:m.side??THREE.FrontSide,alphaTest:m.alphaTest||0,emissive:m.emissive||"#000000"});entry={material,geometries:[]};batches.set(key,entry);}
    const piece=new THREE.BufferGeometry();for(const name of["position","normal","uv"]){const a=g.getAttribute(name);piece.setAttribute(name,new THREE.BufferAttribute(a.array.slice(part.start*a.itemSize,(part.start+part.count)*a.itemSize),a.itemSize));}entry.geometries.push(piece);
   }g.dispose();
  });
  const next=new THREE.Group();for(const entry of batches.values()){const g=bwsSceneMergeGeometries(entry.geometries,false);entry.geometries.forEach(g=>g.dispose());if(!g)throw Error("Could not combine the house geometry.");next.add(new THREE.Mesh(g,entry.material));}
  if(!next.children.length)throw Error("No usable meshes found.");
  const bounds=new THREE.Box3().setFromObject(next),center=bounds.getCenter(new THREE.Vector3());for(const mesh of next.children)mesh.geometry.translate(-center.x,-bounds.min.y,-center.z);
  if(role!=="house"){if(role==="rock")next.userData.rockRecipeVersion=91;next.userData.nodeSource={id:sourceGraph.id,name:sourceGraph.name,seed:sourceGraph.seed,buildVersion:sourceGraph.buildVersion,graph:JSON.parse(JSON.stringify(sourceGraph))};disposeGroup(nature[role]);nature[role]=next;natureStatus();status("Loaded "+role+" geometry from node graph: "+sourceGraph.name);return;}
  if(variants.length>=8){disposeGroup(next);throw Error("House library limit: 8 variants. Clear it before adding more.");}variants.push(next);asset=next;libraryStatus();status("House captured: "+vertices.toLocaleString()+" vertices, "+next.children.length+" material batches. Generate town when ready.");
 }
 function refreshSources(){
  // A fresh browser already has a generic graph, so an empty-list check
  // cannot be used to decide whether the built-in species should be added.
  const expected={tree:["Oak","Birch","Pine","Spruce","Tall Pine","Dead Tree"],rock:["Boulder","Fieldstone","Slate","Crag"]};
  for(const role of ["tree","rock"]){
    const missing=expected[role].some(label=>!geometryNodeProjectState.graphs.some(g=>g.name==="Scene "+label+" nodes"));
    if(missing&&geometryNodeProjectState.graphs.length<24)bwsEnsureDetailedNaturePresets(role,settings.seed);
  }for(const role of ["tree","rock"]){const select=host.querySelector('[data-nature="'+role+'"]'),old=select.value;select.replaceChildren();const hint=document.createElement("option");hint.value="";hint.textContent="Automatic "+role+" node graph";select.appendChild(hint);
 const mixed=document.createElement("option");mixed.value="__mix__";mixed.textContent="Random mix - all listed types";select.appendChild(mixed);for(const graph of geometryNodeProjectState.graphs){const types=graph.nodeOrder.map(id=>geometryNodeTypeForId(graph,id)),eligible=role==="rock"?(types.includes("rocks")||types.includes("detailedRock")):types.some(t=>["trunk","stem","canopy","branchArray","detailedTree"].includes(t))&&!types.includes("houseLayout");if(!eligible)continue;const option=document.createElement("option");option.value=graph.id;option.textContent=graph.name+((graph.generatedIds||[]).some(id=>findObject(id))?"":" (generate from recipe)");select.appendChild(option);}if([...select.options].some(o=>o.value===old))select.value=old;}}
 function natureStatus(){host.querySelector("[data-nature-status]").textContent=["tree","rock"].map(role=>role+": "+(nature[role]?.userData.nodeSource?.name||"not loaded")).join(" / ");}
 async function loadNature(role){const id=host.querySelector('[data-nature="'+role+'"]').value;await generateNodeNature(role,id);}
 async function ensureNodeNature(){for(const role of ["tree","rock"]){const count=role==="tree"?settings.trees:settings.rocks;if(count<=0)continue;const id=host.querySelector('[data-nature="'+role+'"]').value;if(!nature[role]||(role==="rock"&&nature[role].userData.rockRecipeVersion!==91)||(id&&nature[role].userData.nodeSource?.id!==id))await generateNodeNature(role,id);}}
 async function generateMixedNature(role){
 const select=host.querySelector('[data-nature="'+role+'"]');
 let ids=Array.from(select.options).map(o=>o.value).filter(id=>id&&id!=="__mix__");
 if(!ids.length){bwsEnsureDetailedNaturePresets(role,settings.seed);refreshSources();ids=Array.from(select.options).map(o=>o.value).filter(id=>id&&id!=="__mix__");}
 if(!ids.length)throw new Error("No "+role+" node recipes are available to mix.");
 const previous=nature[role],collected=[];nature[role]=null;
 try{
  for(const id of ids){status("Building random "+role+" mix: "+(collected.length+1)+" / "+ids.length);await generateNodeNature(role,id);
   if(!nature[role])throw new Error("A "+role+" recipe did not produce geometry.");
   collected.push(nature[role]);nature[role]=null;}
  const mixed=new THREE.Group();mixed.name="Random "+role+" mix";
  mixed.userData.rockRecipeVersion=91;mixed.userData.natureMix=collected.map(g=>g.userData.nodeSource);
  mixed.userData.nodeSource={id:"__mix__",name:"Random mix ("+collected.length+" "+role+" types)"};
  collected.forEach((g,index)=>{for(const mesh of [...g.children]){mesh.userData.natureVariant=index;mixed.add(mesh);}});
  nature[role]=mixed;disposeGroup(previous);refreshSources();select.value="__mix__";natureStatus();status("Loaded "+collected.length+" "+role+" recipes for random mixing.");
 }catch(error){for(const g of collected)disposeGroup(g);if(nature[role])disposeGroup(nature[role]);nature[role]=previous;select.value="__mix__";throw error;}
}
async function generateNodeNature(role,id){
 if(id==="__mix__")return generateMixedNature(role);
    if(!id || geometryNodeProjectState.graphs.find(g=>g.id===id)?.sceneStarterRole) id=bwsEnsureDetailedNaturePresets(role,settings.seed);
  let graph=geometryNodeProjectState.graphs.find(g=>g.id===id),fresh=false;
  if(!graph){graph=geometryNodeProjectState.graphs.find(g=>g.sceneStarterRole===role);if(!graph){if(geometryNodeProjectState.graphs.length>=24)throw Error("Graph library is full. Select an existing "+role+" graph.");graph=defaultGeometryNodeGraph(role==="tree"?"Scene broadleaf tree":"Scene fieldstone");graph.sceneStarterRole=role;graph.seed=settings.seed+(role==="tree"?101:307);graph.params.outputName=graph.name;graph.nodeOrder=role==="tree"?["seed","trunk","branches","canopy","output"]:["seed","rocks","output"];graph.connections=graph.nodeOrder.slice(0,-1).map((fromNodeId,i)=>({id:geometryNodeId("link"),fromNodeId,toNodeId:graph.nodeOrder[i+1],toInputIndex:0}));graph.nodeOrder.forEach((n,i)=>graph.nodePositions[n]=[50+i*240,50]);graph.smoothNodes=[];graph.generatedIds=[];graph.centerOutput=true;if(role==="tree")Object.assign(graph.params,{height:5,trunkWidth:.4,branchCount:6,branchLength:1.8,canopySize:1.25,canopyDensity:2,canopyEnabled:true});else Object.assign(graph.params,{rockArrangement:"single",rockCount:1,rockSize:1,rockProfile:"jagged",rockVariation:.55,natureOutputMode:"stone"});fresh=true;}}
  status("Generating "+role+" from nodes: "+graph.name);await new Promise(r=>setTimeout(r,0));
  const copy=JSON.parse(JSON.stringify(graph)),meshes=buildGeometryNodeTree({graphOverride:copy,previewOnly:true});
  if(!meshes?.length)throw Error("The "+role+" graph produced no mesh output. Check its connections.");
  try{for(const mesh of meshes){if(mesh.userData._sceneTextureUrl){mesh.material.map=await new THREE.TextureLoader().loadAsync(mesh.userData._sceneTextureUrl);mesh.material.map.colorSpace=THREE.SRGBColorSpace;}}await capture(role,copy,meshes);}finally{for(const mesh of meshes){mesh.geometry.dispose();mesh.material.dispose();}}
  if(fresh){geometryNodeProjectState.graphs.push(graph);saveGeometryNodeDraft();renderGeometryNodeEditor();}refreshSources();host.querySelector('[data-nature="'+role+'"]').value=graph.id;natureStatus();
 }

 function libraryStatus(){host.querySelector("[data-library]").textContent="House library: "+variants.length+" / 8 variants. "+variants.map((v,i)=>v.name||("Captured "+(i+1))).join("; ");}
 async function generateVariants(){
  const graph=activeGeometryNodeGraph(),active=graph&&geometryNodeActiveNodeIds(graph),sourceId=graph?.nodeOrder.find(id=>geometryNodeTypeForId(graph,id)==="houseLayout");if(!sourceId)throw Error("Select a House Layout graph in the modeling workspace first.");
  readSettings();const count=Math.min(6,8-variants.length);if(count<1)throw Error("Clear the house library to generate more variants.");
  const base=assetNodeSanitize(graph.nodeParams?.[sourceId]||graph.params),pending=[];
  try{for(let i=0;i<count;i++){const copy=JSON.parse(JSON.stringify(graph));copy.seed=(settings.seed+i*7919)>>>0;const random=rng(copy.seed),p={...base,buildingWidth:Math.max(4,Math.min(24,base.buildingWidth*(.72+random()*.6))),buildingDepth:Math.max(4,Math.min(24,base.buildingDepth*(.72+random()*.6))),buildingStoreys:1+i%3};
   const attachments=buildingAttachments(copy,sourceId,active).filter(a=>a.type!=="houseBatch"),stoneColors=["#948b7b","#7c817c","#a18e76"],plasters=["#b1a58b","#c1ad87","#a9a493"],roofs=["#86513b","#745e4b","#665e54"];p.buildingPlaster=plasters[i%3];
   for(const a of attachments){a.params={...a.params};if(a.type==="medievalStyle"){a.params.medievalStoneInset=.2+(i%3)*.1;a.params.medievalStoneColor=stoneColors[i%3];a.params.medievalStoneCourses=8+i%4;}if(a.type==="roof"){a.params.roofColor=roofs[i%3];a.params.roofRows=Math.min(a.params.roofRows,12);a.params.roofColumns=Math.min(a.params.roofColumns,16);}}
   const specs=[];buildArchitecture("houseLayout",p,{graph:copy,nodeId:sourceId,group:{id:"scene-variant-"+i,name:"Scene variant"},outputName:"Scene variant "+(i+1),emit:spec=>specs.push(spec),attachments});
   const group=new THREE.Group();pending.push(group);group.name=p.buildingStoreys+" storeys / "+p.buildingWidth.toFixed(1)+" x "+p.buildingDepth.toFixed(1);const batches=new Map();
   for(const spec of specs){if(!spec.geometry)continue;const g=geometryFromData(spec.geometry);if(!g)continue;const transform=new THREE.Object3D();transform.position.fromArray(spec.position||[0,0,0]);transform.rotation.set(...(spec.rotation||[0,0,0]).map(THREE.MathUtils.degToRad));transform.scale.fromArray(spec.scale||[1,1,1]);transform.updateMatrix();g.applyMatrix4(transform.matrix);const flat=g.index?g.toNonIndexed():g;if(flat!==g)g.dispose();if(!flat.getAttribute("normal"))flat.computeVertexNormals();if(!flat.getAttribute("uv"))flat.setAttribute("uv",new THREE.Float32BufferAttribute(new Float32Array(flat.getAttribute("position").count*2),2));for(const key of Object.keys(flat.attributes))if(!["position","normal","uv"].includes(key))flat.deleteAttribute(key);const key=JSON.stringify([spec.color,spec.textureUrl,spec.roughness]);let entry=batches.get(key);if(!entry){entry={spec,geometries:[]};batches.set(key,entry);}entry.geometries.push(flat);}
   for(const {spec,geometries}of batches.values()){const merged=bwsSceneMergeGeometries(geometries,false);geometries.forEach(g=>g.dispose());if(!merged)throw Error("Could not merge variant geometry.");const material=new THREE.MeshStandardMaterial({color:spec.color||"#ffffff",roughness:spec.roughness??.85});if(spec.textureUrl){material.map=await new THREE.TextureLoader().loadAsync(spec.textureUrl);material.map.colorSpace=THREE.SRGBColorSpace;}group.add(new THREE.Mesh(merged,material));}
   if(!group.children.length)throw Error("House nodes produced no geometry.");const box=new THREE.Box3().setFromObject(group),center=box.getCenter(new THREE.Vector3());for(const m of group.children)m.geometry.translate(-center.x,-box.min.y,-center.z);status("Generated house variant "+(i+1)+" / "+count);await new Promise(r=>setTimeout(r,0));
  }}catch(error){pending.forEach(disposeGroup);throw error;}variants.push(...pending);asset=variants[0];libraryStatus();status("Generated "+count+" different house recipes. Generate town to place them. Existing model unchanged.");
 }
 function rng(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
 async function generate(){ await generateVillageBase(); bwsPopulateVillageProps(world,settings); bwsWeatherTown(town,settings); collectEffects(); }
 async function generateVillageBase(){
  if(!variants.length)throw Error("Capture a house or generate variants first.");readSettings();await ensureNodeNature();const skipped=[];if(settings.trees>0&&!nature.tree)skipped.push("trees");if(settings.rocks>0&&!nature.rock)skipped.push("rocks");const random=rng(settings.seed),next=new THREE.Group(),sizes=variants.map(v=>new THREE.Box3().setFromObject(v).getSize(new THREE.Vector3())),size=new THREE.Vector3(Math.max(...sizes.map(s=>s.x)),Math.max(...sizes.map(s=>s.y)),Math.max(...sizes.map(s=>s.z))),radius=Math.hypot(size.x,size.z)*.5*(1+settings.sizeVariation),pitch=Math.max(4,radius*2*settings.spacing+settings.roadWidth),cols=Math.min(settings.columns,settings.count),rows=Math.ceil(settings.count/cols),sx=cols*pitch,sz=rows*pitch,plots=[],dummy=new THREE.Object3D();
  extent=Math.max(sx,sz)*.7+pitch;
  const village=settings.layout==="village",roadZ=(x,r)=>(r-rows/2)*pitch+(village?Math.sin(x/Math.max(sx,1)*Math.PI*2+r*.6)*pitch*.12:0);
  for(let i=0;i<settings.count;i++){const col=i%cols,row=Math.floor(i/cols),scale=1+(random()-.5)*2*settings.sizeVariation,x=(col-(cols-1)/2)*pitch,z=(roadZ(x,row)+roadZ(x,row+1))/2,variant=i<variants.length?i:Math.floor(random()*variants.length),road=row+(row%2?0:1),slope=(roadZ(x+.1,road)-roadZ(x-.1,road))/.2,angle=(row%2?Math.PI:0)-Math.atan(slope)+THREE.MathUtils.degToRad((random()-.5)*2*settings.rotation);plots.push({x,z,angle,scale,variant,road});}
  const layoutRandom=rng(settings.seed+3991);for(const p of plots){p.x+=(layoutRandom()-.5)*pitch*.12*settings.chaos;p.z+=(layoutRandom()-.5)*pitch*.12*settings.chaos;}
  const damageRandom=rng(settings.seed+65537);for(const p of plots)p.damaged=damageRandom()*100<settings.damagePercent;
  for(const p of plots.filter(p=>p.damaged)){const dimensions=sizes[p.variant],seed=Math.floor(damageRandom()*1000000),ruin=bwsDamageOriginalHouse(variants[p.variant],settings,seed);ruin.position.set(p.x,0,p.z);ruin.rotation.y=p.angle;ruin.scale.setScalar(p.scale);next.add(ruin);addEffects(ruin,seed);}
  for(let vi=0;vi<variants.length;vi++){const chosen=plots.filter(p=>p.variant===vi&&!p.damaged);if(!chosen.length)continue;for(const part of variants[vi].children){const mesh=new THREE.InstancedMesh(part.geometry.clone(),part.material.clone(),chosen.length);mesh.castShadow=mesh.receiveShadow=true;chosen.forEach((p,i)=>{dummy.position.set(p.x,0,p.z);dummy.rotation.set(0,p.angle,0);dummy.scale.set(p.scale,p.scale,p.scale);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();next.add(mesh);}}
  function mesh(g,color,x,y,z){const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color,roughness:.95}));m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;next.add(m);return m;}
  const pond={x:sx/2+pitch*.5,z:sz/2+pitch*.5,r:settings.pond>=.5?pitch*.28*settings.pondSize:0};
  next.userData.environmentNodes=[];
  function environmentNode(type,params,x=0,z=0){const p=assetNodeSanitize(params),part=bwsEnvironmentGeometry(type,p),m=mesh(part.geometry,part.color,x,part.y,z);m.userData.nodeSource={type,params:p};next.userData.environmentNodes.push({type,params:p,x,z});return m;}
  const ground=environmentNode("sceneTerrain",{terrainWidth:sx+pitch*2,terrainDepth:sz+pitch*2,terrainColor:settings.ground,terrainResolution:160,pondRadius:pond.r,pondX:pond.x,pondZ:pond.z,pondDepth:1});ground.castShadow=false;
  if(pond.r){const water=environmentNode("sceneWater",{waterRadius:pond.r*.90,waterLevel:-.20,waterColor:"#344b46"},pond.x,pond.z);water.material.dispose();water.material=new THREE.MeshPhysicalMaterial({color:"#344b46",roughness:.48,metalness:0,transparent:true,opacity:.96,clearcoat:.35,clearcoatRoughness:.3,normalMap:bwsSceneSurfaceNormal("water"),normalScale:new THREE.Vector2(.09,.09)});water.castShadow=false;water.material.normalMap.repeat.set(pond.r,pond.r);}
  ground.material.normalMap=bwsSceneSurfaceNormal("ground");ground.material.normalScale=new THREE.Vector2(.22,.22);ground.material.normalMap.repeat.set(sx/3,sz/3);
  const roads=[],footpaths=[];
  function roadSegment(ax,az,bx,bz,width,foot=false){const length=Math.hypot(bx-ax,bz-az);if(length<.001)return;const m=environmentNode("scenePath",{pathLength:length+.025,pathWidth:width,pathColor:"#b4a184"},(ax+bx)/2,(az+bz)/2);m.position.y=foot?.03:.005;m.rotation.y=Math.atan2(bx-ax,bz-az);(foot?footpaths:roads).push({ax,az,bx,bz,width});}
  for(let r=0;r<=rows;r++){const segments=village?Math.max(16,cols*6):1;for(let j=0;j<segments;j++){const ax=-sx/2-pitch/2+j*(sx+pitch)/segments,bx=ax+(sx+pitch)/segments;roadSegment(ax,roadZ(ax,r),bx,roadZ(bx,r),settings.roadWidth);}}
  for(let col=0;col<=cols;col++){if(village&&col!==0&&col!==cols&&col!==Math.floor(cols/2))continue;const x=(col-cols/2)*pitch;roadSegment(x,roadZ(x,0)-pitch/2,x,roadZ(x,rows)+pitch/2,settings.roadWidth);}
  for(const p of plots){const front=sizes[p.variant].z*p.scale*.48,ax=p.x+Math.sin(p.angle)*front,az=p.z+Math.cos(p.angle)*front;roadSegment(ax,az,ax,roadZ(ax,p.road),Math.min(1.3,settings.roadWidth),true);}
  function segmentDistance(x,z,r){const dx=r.bx-r.ax,dz=r.bz-r.az,t=Math.max(0,Math.min(1,((x-r.ax)*dx+(z-r.az)*dz)/(dx*dx+dz*dz)));return Math.hypot(x-r.ax-t*dx,z-r.az-t*dz)-r.width/2;}
  function roadDistance(x,z){return Math.min(...roads.concat(footpaths).map(r=>segmentDistance(x,z,r)));}
  function terrainHeight(x,z){
   const houseDistance=Math.min(...plots.map(p=>Math.hypot(x-p.x,z-p.z)-radius-1));
   const pad=THREE.MathUtils.smoothstep(houseDistance,0,3),road=THREE.MathUtils.smoothstep(roadDistance(x,z),.4,2.5);
   const bank=pond.r?THREE.MathUtils.smoothstep(Math.hypot(x-pond.x,z-pond.z)-pond.r*1.2,0,3):1;
   return bwsTerrainRise(x,z,settings.chaos,settings.seed)*pad*road*bank;
  }
  const terrainPosition=ground.geometry.getAttribute("position"),naturalColors=new Float32Array(terrainPosition.count*3);
  for(let i=0;i<terrainPosition.count;i++){const x=terrainPosition.getX(i),z=terrainPosition.getZ(i);terrainPosition.setY(i,terrainPosition.getY(i)+terrainHeight(x,z));const shade=.84+bwsTerrainNoise(x*.16,z*.16,settings.seed)*.16;naturalColors[i*3]=shade;naturalColors[i*3+1]=shade;naturalColors[i*3+2]=shade*.96;}
  terrainPosition.needsUpdate=true;ground.geometry.setAttribute("color",new THREE.Float32BufferAttribute(naturalColors,3));ground.geometry.computeVertexNormals();ground.geometry.computeBoundingSphere();ground.material.vertexColors=true;ground.material.normalMap?.dispose();ground.material.normalMap=null;ground.material.needsUpdate=true;
  next.userData.terrainRecipe={chaos:settings.chaos,seed:settings.seed,levelHousePads:true,levelRoads:true};
  const natureOccupied=[];
  function scatter(count,clearance){const points=[];for(let t=0;t<count*70&&points.length<count;t++){const x=(random()-.5)*(sx+pitch*1.8),z=(random()-.5)*(sz+pitch*1.8);if((pond.r&&Math.hypot(x-pond.x,z-pond.z)<pond.r*1.18+clearance)||roadDistance(x,z)<clearance||plots.some(p=>Math.hypot(x-p.x,z-p.z)<radius+clearance)||natureOccupied.some(p=>Math.hypot(x-p.x,z-p.z)<clearance+p.clearance+.15))continue;natureOccupied.push({x,z,clearance});points.push({x,z,scale:.75+random()*.6,angle:random()*Math.PI*2});}return points;}
  function natureSize(role){return nature[role]?new THREE.Box3().setFromObject(nature[role]).getSize(new THREE.Vector3()):new THREE.Vector3();}
  const ts=natureSize("tree"),rs=natureSize("rock"),treePoints=scatter(nature.tree?settings.trees:0,Math.max(.6,Math.hypot(ts.x,ts.z)*.7)),rockPoints=scatter(nature.rock?settings.rocks:0,Math.max(.3,Math.hypot(rs.x,rs.z)*.7));
  const burnRandom=geometryNodePrng(settings.seed+77123);for(const p of treePoints){p.burned=burnRandom()*100<settings.treeBurnPercent;p.y=terrainHeight(p.x,p.z);}
  function nodeInstancesForSource(role,points,source){const asset=source;if(!asset||!points.length)return;for(const part of asset.children){const m=new THREE.InstancedMesh(part.geometry.clone(),part.material.clone(),points.length);points.forEach((p,i)=>{dummy.position.set(p.x,terrainHeight(p.x,p.z)-.035,p.z);dummy.rotation.set(0,p.angle,0);const leaf=role==="tree"&&bwsSceneFoliageMaterial(part.material);dummy.scale.setScalar(p.scale*(p.burned&&leaf?0:1));dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix);if(role==="tree")m.setColorAt(i,new THREE.Color(p.burned?"#282420":"#ffffff"));});m.instanceMatrix.needsUpdate=true;m.computeBoundingSphere();m.castShadow=m.receiveShadow=true;m.userData.nodeSource=asset.userData.nodeSource;next.add(m);}}
function nodeInstances(role,points){
 const source=nature[role],recipes=source?.userData?.natureMix;
 if(!recipes?.length)return nodeInstancesForSource(role,points,source);
 const choose=geometryNodePrng(settings.seed+(role==="tree"?9109:13217)),batches=recipes.map(()=>[]);
 for(const point of points)batches[Math.floor(choose()*recipes.length)].push(point);
 for(let i=0;i<recipes.length;i++){if(!batches[i].length)continue;
 const variant={children:source.children.filter(mesh=>mesh.userData.natureVariant===i),userData:{nodeSource:recipes[i]}};
 nodeInstancesForSource(role,batches[i],variant);}
}
  nodeInstances("tree",treePoints);nodeInstances("rock",rockPoints);
  bwsBurnLandscape(next,ground,treePoints,settings);
  await new Promise(r=>setTimeout(r,0));const preserveView=!!town&&!!settings.lockCamera;if(town){world.remove(town);disposeGroup(town);}town=next;world.add(town);effectTime=0;collectEffects();lighting();if(!preserveView)fit();else{cam.far=extent*15+100;cam.updateProjectionMatrix();}status(settings.count+" houses / "+treePoints.length+" trees / "+rockPoints.length+" rocks. Seed "+settings.seed+". House library: "+variants.length+" distinct variants."+(skipped.length?" Skipped "+skipped.join(" and ")+": select their built node outputs above, then generate again.":""));
 }
 function collectEffects(){effectObjects=[];town?.traverse(o=>{if(o.userData.bwsAnimatedEffect)effectObjects.push(o);});}
 function addEffects(parent,seed){const emitterRoot=new THREE.Group();if(parent.userData.bwsFireOrigin)emitterRoot.position.fromArray(parent.userData.bwsFireOrigin);parent.add(emitterRoot);parent=emitterRoot;if(settings.fireEnabled)parent.add(bwsSceneEmitter("sceneFire",{...settings,houseFire:true},seed));if(settings.smokeEnabled){const smoke=bwsSceneEmitter("sceneSmoke",{smokeSize:settings.effectSize*1.4,smokeLifetime:settings.effectLifetime*3,smokeIntensity:Math.min(1,settings.effectIntensity*.7),smokeWind:settings.effectWind,smokeColor:settings.smokeColor},seed+31);smoke.position.y+=settings.effectSize*.95;parent.add(smoke);}}
 async function restoreScene(){
 if(!variants.length)throw Error("No original house is available to restore. Load a saved scene or capture the house first.");
 readSettings();
 const previous={...settings},position=cam.position.clone(),target=controls.target.clone();
 Object.assign(settings,{damagePercent:0,burnAmount:0,treeBurnPercent:0,groundBurn:0,natureFirePercent:0,sceneGrime:0,ambientSmoke:0,fireEnabled:0,smokeEnabled:0});
 applyFields();
 try{await generate();status("Original houses restored. Fire, smoke and scorch cleared; layout and camera retained.");}
 catch(error){Object.assign(settings,previous);applyFields();throw error;}
 finally{cam.position.copy(position);controls.target.copy(target);controls.update();}
 }
 function clearTestEffect(){const test=town?.getObjectByName("BWS test effect");if(test){test.removeFromParent();disposeGroup(test);}collectEffects();}
 function effectTest(){if(!town)throw Error("Generate a scene first.");readSettings();clearTestEffect();const root=new THREE.Group();root.name="BWS test effect";root.position.copy(controls.target);root.position.y=Math.max(.1,root.position.y);town.add(root);addEffects(root,settings.seed);collectEffects();effectTime=0;status("Test emitter placed at the view target. Pan to aim; trigger again to move it.");}
 function effectRecipes(){readSettings();if(geometryNodeProjectState.graphs.length>20)throw Error("Need four free graph slots for damage/effect recipes.");for(const type of Object.keys(BWS_DAMAGE_EFFECT_NODES)){const graph=bwsDamageRecipe(type,settings,settings.seed);geometryNodeProjectState.graphs.push(graph);}saveGeometryNodeDraft();renderGeometryNodeEditor();status("Added Ruined House, Rubble, Fire and Smoke graphs. Editor previews are static; effects animate here.");}
 function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
 async function png(){if(!town)throw Error("Generate a scene first.");readSettings();const old=gl.getSize(new THREE.Vector2()),ratio=gl.getPixelRatio(),aspect=cam.aspect,w=settings.resolution,h=Math.round(w/aspect);if(w*h>16000000)throw Error("Choose a smaller image width or a wider scene window.");try{gl.setPixelRatio(1);gl.setSize(w,h,false);renderScene();const blob=await new Promise(r=>gl.domElement.toBlob(r,"image/png"));if(!blob)throw Error("Image export failed.");download(blob,"BWS-town-"+settings.seed+".png");status("PNG exported: "+w+" x "+h);}finally{gl.setPixelRatio(ratio);gl.setSize(old.x,old.y,false);}}
 async function save(){if(!variants.length)throw Error("Add house variants first.");readSettings();download(new Blob([JSON.stringify({format:"bws-scene",version:3,settings,cameraViews,cameraFov:cam.fov,assets:variants.map(v=>v.toJSON()),nature:{tree:nature.tree?.toJSON()||null,rock:nature.rock?.toJSON()||null},environmentNodes:town?.userData.environmentNodes||[],camera:cam.position.toArray(),target:controls.target.toArray()})],{type:"application/json"}),"BWS-town-"+settings.seed+".bwscene");status("Scene recipe and house saved.");}
 const actions={fireLightToggle:()=>{settings.fireLighting=settings.fireLighting?0:1;host.querySelector('[data-action="fireLightToggle"]').textContent=settings.fireLighting?"Fire lighting: ON":"Fire lighting: OFF";status(settings.fireLighting?"Fire lighting on. Nearby surfaces receive warm light and shadows.":"Fire lighting off for comparison. Flame and camera are unchanged.");},restoreScene,dusk:()=>{readSettings();Object.assign(settings,{ambientLight:.12,sun:.5,sunAngle:15,exposure:.55,sky:"#333b46"});applyFields();lighting();status("Dusk lighting applied. Adjust Ambient light, Sun strength and Exposure under Render.");},aftermath:async()=>{readSettings();Object.assign(settings,{damagePercent:100,damageSeverity:.75,burnAmount:1,treeBurnPercent:95,groundBurn:90,sceneGrime:1,ambientSmoke:.8,natureFirePercent:12,fireEnabled:1,smokeEnabled:1,effectSize:1.1,effectIntensity:.7,sky:"#a79b8e",fog:.003,sun:2,exposure:.85});applyFields();await generate();},effectRecipes,effectTest,effectClear:clearTestEffect,effectRestart:()=>{effectTime=0;for(const o of effectObjects)o.material.uniforms.fxTime.value=0;},effectPlay:()=>{effectPlaying=!effectPlaying;host.querySelector('[data-action="effectPlay"]').textContent=effectPlaying?"Pause effects":"Play effects";},capture,treeNodes:()=>loadNature("tree"),rockNodes:()=>loadNature("rock"),refreshNodes:refreshSources,variants:generateVariants,clearVariants:()=>{variants.forEach(disposeGroup);variants=[];asset=null;libraryStatus();status("House library cleared; existing town remains until regenerated.");},generate,png,save,fit,light:lighting,close:()=>{setWorkspace("general");},load:()=>host.querySelector("[data-scene-file]").click()};
 host.addEventListener("click",async e=>{const a=e.target.closest("[data-action]")?.dataset.action;if(!a||busy)return;busy=true;try{await actions[a]();}catch(err){status(err.message||String(err));}finally{busy=false;}});
 host.querySelector("[data-scene-file]").addEventListener("change",async e=>{const file=e.target.files[0];if(!file||busy)return;busy=true;try{if(file.size>60000000)throw Error("Scene file is too large (60 MB limit).");const data=JSON.parse(await file.text());if(data.format!=="bws-scene"||![1,2,3].includes(data.version))throw Error("Unsupported Scene Studio file.");
const assets=data.version===1?[data.asset]:data.assets;if(!Array.isArray(assets)||!assets.length||assets.length>8)throw Error("Scene must contain 1-8 house variants.");
const loadedVariants=[];try{for(const saved of assets){const text=JSON.stringify(saved);if(/"(?:url|src)"\s*:\s*"(?!data:)/i.test(text))throw Error("Only embedded textures are accepted.");const loaded=await new THREE.ObjectLoader().parseAsync(saved);loadedVariants.push(loaded);if(loaded.type!=="Group"||!loaded.children.length||loaded.children.some(c=>c.type!=="Mesh"||Array.isArray(c.material)))throw Error("Variants must contain static single-material meshes.");}}catch(error){loadedVariants.forEach(disposeGroup);throw error;}
const loadedNature={tree:null,rock:null};try{for(const role of ["tree","rock"]){const json=data.nature?.[role];if(!json)continue;const text=JSON.stringify(json);if(/"(?:url|src)"\s*:\s*"(?!data:)/i.test(text))throw Error("Only embedded nature textures are accepted.");const loaded=await new THREE.ObjectLoader().parseAsync(json);loadedNature[role]=loaded;if(loaded.type!=="Group"||!loaded.userData.nodeSource||loaded.children.some(c=>c.type!=="Mesh"||Array.isArray(c.material)))throw Error("Invalid node nature asset.");}}catch(error){loadedVariants.forEach(disposeGroup);Object.values(loadedNature).forEach(disposeGroup);throw error;}variants.forEach(disposeGroup);variants=loadedVariants;asset=variants[0];Object.values(nature).forEach(disposeGroup);nature=loadedNature;libraryStatus();natureStatus();Object.assign(settings,defaults);for(const key of Object.keys(defaults))if(typeof data.settings?.[key]===typeof defaults[key])settings[key]=data.settings[key];if(data.version<3){settings.trees=0;settings.rocks=0;}applyFields();loadCameraViews(data.cameraViews);await generate();if(Number.isFinite(data.cameraFov)){cam.fov=Math.max(10,Math.min(100,data.cameraFov));cam.updateProjectionMatrix();}if(Array.isArray(data.camera)&&data.camera.length===3&&data.camera.every(Number.isFinite))cam.position.fromArray(data.camera);if(Array.isArray(data.target)&&data.target.length===3&&data.target.every(Number.isFinite))controls.target.fromArray(data.target);controls.update();}catch(err){status(err.message||String(err));}finally{busy=false;e.target.value="";}});
 fields.addEventListener("change",event=>{if(!busy&&["ambientLight","sun","sunAngle","exposure","fog","sky","fireLightStrength"].includes(event.target.dataset.setting))lighting();});
 new ResizeObserver(resize).observe(view);
 function frame(){if(disposed)return;requestAnimationFrame(frame);const now=performance.now(),dt=Math.min(.1,(now-lastFrame)/1000);lastFrame=now;if(host.hidden||busy)return;if(effectPlaying)effectTime+=dt*settings.playbackSpeed;for(const o of effectObjects)o.material.uniforms.fxTime.value=effectTime;controls.update();renderScene();}resize();lighting();frame();
 refreshSources();bwsSceneStudio={host,resize,refreshSources};
}

function bwsSceneSurfaceNormal(kind){const size=64,data=new Uint8Array(size*size*4);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=(y*size+x)*4,a=x/size*Math.PI*2,b=y/size*Math.PI*2;data[i]=128+Math.round((kind==="water"?Math.cos(a*4+b*2)*18:Math.sin(a*13+b*7)*12));data[i+1]=128+Math.round((kind==="water"?Math.sin(b*5-a*2)*18:Math.cos(b*11-a*5)*12));data[i+2]=250;data[i+3]=255;}const texture=new THREE.DataTexture(data,size,size);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;return texture;}
