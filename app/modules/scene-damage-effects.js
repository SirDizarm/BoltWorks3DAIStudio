// Shared node recipes: static editable geometry in Model; animated emitters in Scene Studio.
function bwsWeatherTown(world,settings){
 const amount=Math.max(0,Math.min(1,settings.sceneGrime)),materials=new Set();let ground=null;
 world.traverse(mesh=>{
  if(mesh.userData?.nodeSource?.type==="sceneTerrain")ground=mesh;
  if(!mesh.isMesh||!mesh.material?.isMeshStandardMaterial||mesh.userData?.nodeSource?.type==="sceneWater"||materials.has(mesh.material))return;
  const material=mesh.material;materials.add(material);if(amount<=0)return;
  const terrain=mesh.userData?.nodeSource?.type==="sceneTerrain";
  // Remove the old periodic ground normals and vertex pattern entirely.
  if(terrain){material.normalMap?.dispose();material.normalMap=null;material.vertexColors=false;}
  const pondParams=terrain?mesh.userData.nodeSource.params:null;const previous=material.onBeforeCompile,previousKey=material.customProgramCacheKey();
  material.onBeforeCompile=shader=>{
   previous.call(material,shader);
   shader.uniforms.bwsPond={value:new THREE.Vector3(pondParams?.pondX||0,pondParams?.pondZ||0,pondParams?.pondRadius||0)};shader.uniforms.bwsGrime={value:amount};shader.uniforms.bwsWeatherSeed={value:(settings.seed%10000)*.037};shader.uniforms.bwsIsGround={value:terrain?1:0};
   shader.vertexShader='varying vec3 bwsWeatherPosition;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    vec4 weatherVertex=vec4(transformed,1.0);
    #ifdef USE_INSTANCING
     weatherVertex=instanceMatrix*weatherVertex;
    #endif
    bwsWeatherPosition=(modelMatrix*weatherVertex).xyz;
   `);
   shader.fragmentShader=`varying vec3 bwsWeatherPosition;uniform float bwsGrime,bwsWeatherSeed,bwsIsGround;uniform vec3 bwsPond;
    float bwsWH(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
    float bwsWN(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(bwsWH(i),bwsWH(i+vec3(1,0,0)),f.x),mix(bwsWH(i+vec3(0,1,0)),bwsWH(i+vec3(1,1,0)),f.x),f.y),mix(mix(bwsWH(i+vec3(0,0,1)),bwsWH(i+vec3(1,0,1)),f.x),mix(bwsWH(i+vec3(0,1,1)),bwsWH(i+vec3(1,1,1)),f.x),f.y),f.z);}
    float bwsWF(vec3 p){return bwsWN(p)*.57+bwsWN(p*2.13+17.3)*.28+bwsWN(p*4.37+8.1)*.15;}
   `+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    vec3 wp=bwsWeatherPosition+vec3(bwsWeatherSeed,0.0,bwsWeatherSeed*.71);
    float broad=bwsWF(wp*.23),fine=bwsWN(wp*15.0);
    vec3 sootWarp=vec3(bwsWF(wp*.43+3.1),bwsWF(wp*.43+19.7),bwsWF(wp*.43+41.3));float streak=bwsWF(wp*.85+sootWarp*2.7);
    float soot=smoothstep(.25,.72,broad*.65+streak*.35);
    float dirt=bwsGrime*(.38+.62*soot);
    float luminance=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
    vec3 faded=mix(diffuseColor.rgb,vec3(luminance)*vec3(.92,.86,.78),bwsGrime*.7);
    vec3 grimy=mix(faded,vec3(.024,.019,.016)*( .7+fine*.6),dirt*.94);
    vec3 soil=mix(vec3(.045,.038,.027),vec3(.105,.089,.065),smoothstep(.28,.72,broad));
    soil=mix(soil,vec3(.14,.128,.108),smoothstep(.57,.75,bwsWF(wp*.8+24.0))*.65);
    soil*=.82+fine*.32;
    diffuseColor.rgb=mix(grimy,mix(diffuseColor.rgb,soil,bwsGrime),bwsIsGround);
    if(bwsIsGround>.5&&bwsPond.z>0.0){
     vec2 delta=bwsWeatherPosition.xz-bwsPond.xy;float angle=atan(delta.y,delta.x);
     float edge=1.0+.1*sin(angle*3.0+.7)+.055*cos(angle*5.0-1.1)+.025*sin(angle*9.0);
     float shore=length(delta)/(bwsPond.z*edge);
     float bank=(1.0-smoothstep(.98,1.23,shore))*(.8+.2*bwsWN(wp*4.0));
     vec3 mud=mix(vec3(.029,.025,.016),vec3(.09,.075,.045),smoothstep(.87,1.15,shore));
     diffuseColor.rgb=mix(diffuseColor.rgb,mud,bank);
    }
   `);
  };material.customProgramCacheKey=()=>previousKey+"-bws-weather-85-"+terrain;material.needsUpdate=true;
 });
 if(!ground||settings.ambientSmoke<=0||!settings.smokeEnabled||(settings.damagePercent<=0&&settings.treeBurnPercent<=0&&settings.groundBurn<=0))return;
 const bounds=new THREE.Box3().setFromObject(ground),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3()),random=geometryNodePrng(settings.seed+53371);
 const count=Math.ceil(settings.ambientSmoke*10),root=new THREE.Group();root.name="Drifting aftermath smoke";
 for(let i=0;i<count;i++){const smoke=bwsSceneEmitter("sceneSmoke",{smokeSize:Math.min(12,Math.max(3,size.x*.045)),smokeLifetime:14,smokeIntensity:settings.ambientSmoke*.55,smokeWind:settings.effectWind+.35,smokeColor:settings.smokeColor},settings.seed+i*127);smoke.position.set(center.x+(random()-.5)*size.x*.85,.25,center.z+(random()-.5)*size.z*.85);root.add(smoke);}
 world.add(root);
}
const BWS_CHAR_NOISE=`
 float bwsCH(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
 float bwsCN(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(bwsCH(i),bwsCH(i+vec3(1,0,0)),f.x),mix(bwsCH(i+vec3(0,1,0)),bwsCH(i+vec3(1,1,0)),f.x),f.y),mix(mix(bwsCH(i+vec3(0,0,1)),bwsCH(i+vec3(1,0,1)),f.x),mix(bwsCH(i+vec3(0,1,1)),bwsCH(i+vec3(1,1,1)),f.x),f.y),f.z);}
`;
function bwsCharredSurface(material,impact,radius,burn,fireOrigin){
 const clock={value:0};material.uniforms={fxTime:clock};
 material.onBeforeCompile=shader=>{
  shader.uniforms.bwsCoalTime=clock;shader.uniforms.bwsBurn={value:burn};shader.uniforms.bwsImpact={value:impact};shader.uniforms.bwsRadius={value:radius};shader.uniforms.bwsFireOrigin={value:fireOrigin};
  shader.vertexShader='varying vec3 bwsSurface;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nbwsSurface=position;');
  shader.fragmentShader='varying vec3 bwsSurface;uniform float bwsCoalTime,bwsBurn;uniform vec3 bwsImpact,bwsRadius,bwsFireOrigin;\n'+BWS_CHAR_NOISE+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float damageMask=1.0-smoothstep(.65,1.7,length((bwsSurface-bwsImpact)/bwsRadius));
   float hearthMask=(1.0-smoothstep(.5,2.4,length(bwsSurface.xz-bwsFireOrigin.xz)))*(1.0-smoothstep(.1,.7,abs(bwsSurface.y-bwsFireOrigin.y)));
   float coalMask=clamp(max(damageMask,hearthMask)*bwsBurn,0.0,1.0);
   float grain=bwsCN(bwsSurface*19.0)*2.0-1.0;
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.022,.017,.013)+vec3(.018)*grain,coalMask*.96);
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
   float seam=abs(bwsCN(bwsSurface*16.0+vec3(bwsCN(bwsSurface*3.0)*3.0))-.5);
   float cracks=1.0-smoothstep(.012,.045,seam);
   float patches=smoothstep(.53,.76,bwsCN(bwsSurface*2.3+17.0));
   float pulse=.65+.35*sin(bwsCoalTime*2.2+bwsSurface.x*5.0+bwsSurface.z*3.0);
   totalEmissiveRadiance+=vec3(2.8,.24,.008)*cracks*patches*coalMask*coalMask*pulse;
  `);
 };material.customProgramCacheKey=()=>"bws-charred-embers-84";material.needsUpdate=true;
}
function bwsCoalBed(size,seed){
 const root=new THREE.Group(),random=geometryNodePrng(seed+331);root.name="Raised charcoal and ember bed";
 const parts=[];for(let i=0;i<46;i++){const angle=random()*Math.PI*2,r=Math.sqrt(random())*size,g=new THREE.IcosahedronGeometry(.07+random()*.17,1);g.scale(1.3,.45+random()*.6,1);g.rotateY(random()*6.28);g.translate(Math.cos(angle)*r,.09+random()*.07,Math.sin(angle)*r);parts.push(g);}
 const geometry=mergeGeometries(parts,false);parts.forEach(g=>g.dispose());const material=new THREE.MeshStandardMaterial({color:"#29221c",roughness:1});
 bwsCharredSurface(material,new THREE.Vector3(),new THREE.Vector3(size*2,2,size*2),1,new THREE.Vector3());
 const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=mesh.receiveShadow=true;mesh.userData.bwsAnimatedEffect=true;root.add(mesh);return root;
}
function bwsSceneFoliageMaterial(material){
 const c=material?.color;return !!c&&c.g>c.r*1.06&&c.g>c.b*1.15;
}
function bwsBurnLandscape(town,ground,points,settings){
 const amount=Math.max(0,Math.min(1,settings.groundBurn/100));
 if(amount>0){
  const g=ground.geometry,p=g.getAttribute("position"),colors=new Float32Array(p.count*3),phase=settings.seed*.017;
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),z=p.getZ(i),noise=(Math.sin(x*.37+phase)*Math.cos(z*.29-phase)+Math.sin(x*.91+z*.67)*.35+1.35)/2.7;
   const coverage=THREE.MathUtils.smoothstep(amount-noise,-.13,.13),ash=(Math.sin(x*3.7+z*2.1)+1)*.5;
   const charcoal=new THREE.Color().setRGB(.12+ash*.13,.105+ash*.12,.09+ash*.12);
   const color=new THREE.Color(1,1,1).lerp(charcoal,coverage);colors[i*3]=color.r;colors[i*3+1]=color.g;colors[i*3+2]=color.b;
  }
  g.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));ground.material.vertexColors=true;ground.material.needsUpdate=true;
 }
 const random=geometryNodePrng(settings.seed+88491);let emitted=0;
 for(const p of points){
  if(!p.burned||random()*100>=settings.natureFirePercent||emitted>=12)continue;
  const root=new THREE.Group();root.name="Burning node tree";root.position.set(p.x,(p.y||0)+.08,p.z);
  const seed=settings.seed+emitted*997;
  if(settings.fireEnabled)root.add(bwsSceneEmitter("sceneFire",{...settings,effectSize:Math.min(2.5,settings.effectSize)*p.scale},seed));
  if(settings.smokeEnabled)root.add(bwsSceneEmitter("sceneSmoke",{smokeSize:Math.min(4,settings.effectSize*1.6),smokeLifetime:settings.effectLifetime*3,smokeIntensity:.6,smokeWind:settings.effectWind,smokeColor:settings.smokeColor},seed+13));
  town.add(root);emitted++;
 }
 town.userData.burnedLandscape={treeBurnPercent:settings.treeBurnPercent,groundBurn:settings.groundBurn,natureFirePercent:settings.natureFirePercent,burnedTrees:points.filter(p=>p.burned).length,activeTreeEmitters:emitted};
}
// Recover connected pieces from material batches so damage removes whole tiles,
// beams and panels instead of substituting a different building or random faces.
const bwsHouseDamagePieces=new WeakMap();
function bwsOriginalHousePieces(geometry){
 if(bwsHouseDamagePieces.has(geometry))return bwsHouseDamagePieces.get(geometry);
 const flat=geometry.index?geometry.toNonIndexed():geometry,position=flat.getAttribute("position"),count=position.count;
 const parent=new Int32Array(count/3);for(let i=0;i<parent.length;i++)parent[i]=i;
 const find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
 const welded=new Map();
 for(let i=0;i<count;i++){const key=Math.round(position.getX(i)*10000)+":"+Math.round(position.getY(i)*10000)+":"+Math.round(position.getZ(i)*10000),triangle=Math.floor(i/3);if(welded.has(key)){const a=find(triangle),b=find(welded.get(key));if(a!==b)parent[a]=b;}else welded.set(key,triangle);}
 const groups=new Map(),v=new THREE.Vector3();
 for(let i=0;i<count;i+=3){const key=find(i/3);if(!groups.has(key))groups.set(key,{indices:[],bounds:new THREE.Box3()});const piece=groups.get(key);for(let j=0;j<3;j++){piece.indices.push(i+j);piece.bounds.expandByPoint(v.fromBufferAttribute(position,i+j));}}
 const pieces=Array.from(groups.values());for(const piece of pieces){piece.center=piece.bounds.getCenter(new THREE.Vector3());piece.size=piece.bounds.getSize(new THREE.Vector3());}
 const result={attributes:flat.attributes,pieces};bwsHouseDamagePieces.set(geometry,result);if(flat!==geometry)flat.dispose();return result;
}
// Clip all roof layers against the same burn volume, including large roof shells.
function bwsCarveBurnVolume(geometry,matrix,impact,radius,floor){
 const attributes=geometry.attributes,names=Object.keys(attributes),output=Object.fromEntries(names.map(n=>[n,[]]));
 const position=attributes.position,world=new THREE.Vector3();
 function vertex(i){const data={};for(const name of names){const a=attributes[name];data[name]=[];for(let k=0;k<a.itemSize;k++)data[name].push(a.array[i*a.itemSize+k]);}return data;}
 function mix(a,b,t){const result={};for(const name of names)result[name]=a[name].map((v,k)=>v+(b[name][k]-v)*t);return result;}
 function local(v){return world.fromArray(v.position).applyMatrix4(matrix).clone();}
 function signed(v){const p=local(v);return Math.max(Math.hypot((p.x-impact.x)/radius.x,(p.y-impact.y)/radius.y,(p.z-impact.z)/radius.z)-1,(floor-p.y)/radius.y);}
 function emit(a,b,c){for(const v of [a,b,c])for(const name of names)output[name].push(...v[name]);}
 function triangle(a,b,c,depth){
  const vertices=[a,b,c],points=vertices.map(local);
  const box=new THREE.Box3().setFromPoints(points);if(box.max.y<=floor){emit(a,b,c);return;}
  let nearest=0;for(const axis of ["x","y","z"]){const d=Math.max(box.min[axis]-impact[axis],0,impact[axis]-box.max[axis])/radius[axis];nearest+=d*d;}
  if(nearest>=1){emit(a,b,c);return;}
  const values=vertices.map(signed);if(values.every(v=>v<0))return;
  // Refinement detects a hole even when all three corners lie outside it.
  const edge=Math.max(points[0].distanceTo(points[1]),points[1].distanceTo(points[2]),points[2].distanceTo(points[0]));
  if(depth<5&&edge>Math.min(radius.x,radius.y,radius.z)*.15){const ab=mix(a,b,.5),bc=mix(b,c,.5),ca=mix(c,a,.5);triangle(a,ab,ca,depth+1);triangle(ab,b,bc,depth+1);triangle(ca,bc,c,depth+1);triangle(ab,bc,ca,depth+1);return;}
  const polygon=[];for(let i=0;i<3;i++){const j=(i+1)%3,inside=values[i]>=0,next=values[j]>=0;if(inside)polygon.push(vertices[i]);if(inside!==next)polygon.push(mix(vertices[i],vertices[j],values[i]/(values[i]-values[j])));}
  for(let i=1;i+1<polygon.length;i++)emit(polygon[0],polygon[i],polygon[i+1]);
 }
 for(let i=0;i<position.count;i+=3)triangle(vertex(i),vertex(i+1),vertex(i+2),0);
 const result=new THREE.BufferGeometry();for(const name of names){const a=attributes[name];result.setAttribute(name,new THREE.BufferAttribute(new a.array.constructor(output[name]),a.itemSize,a.normalized));}geometry.dispose();return result;
}
function bwsDamageOriginalHouse(source,settings,seed){
 const root=new THREE.Group();root.name=(source.name||"House")+" - fire damaged";
 const bounds=new THREE.Box3().setFromObject(source),size=bounds.getSize(new THREE.Vector3()),random=geometryNodePrng(seed>>>0);
 const severity=Math.max(.1,Math.min(1,settings.damageSeverity)),burn=Math.max(0,Math.min(1,settings.burnAmount));
 const impact=new THREE.Vector3((random()-.5)*size.x*.55,bounds.min.y+size.y*(.72+random()*.14),(random()-.5)*size.z*.55);
 const radius=new THREE.Vector3(size.x*(.18+severity*.48),size.y*(.16+severity*.58),size.z*(.18+severity*.48));
 const distance=v=>Math.hypot((v.x-impact.x)/radius.x,(v.y-impact.y)/radius.y,(v.z-impact.z)/radius.z);
 const point=new THREE.Vector3(),worldPoint=new THREE.Vector3(),debris=[];
 source.updateWorldMatrix(true,true);
 function geometryFor(attributes,indices){const g=new THREE.BufferGeometry();for(const [name,a]of Object.entries(attributes)){const values=new a.array.constructor(indices.length*a.itemSize);for(let i=0;i<indices.length;i++)for(let k=0;k<a.itemSize;k++)values[i*a.itemSize+k]=a.array[indices[i]*a.itemSize+k];g.setAttribute(name,new THREE.BufferAttribute(values,a.itemSize,a.normalized));}return g;}
 for(const part of source.children){
  if(!part.isMesh)continue;
  const cached=bwsOriginalHousePieces(part.geometry),kept=[];
  for(const piece of cached.pieces){
   const center=piece.center.clone().applyMatrix4(part.matrixWorld),low=piece.bounds.clone().applyMatrix4(part.matrixWorld).min.y;
   // Foundation stays intact; a contiguous upper burn volume removes pieces.
   // Large connected shells must lie mostly in that region before removal.
   const spread=Math.max(piece.size.x/size.x,piece.size.y/size.y,piece.size.z/size.z);
   const remove=low>bounds.min.y+size.y*.18&&distance(center)<(spread>.6?.52:1);
   if(remove){if(debris.length<32&&spread<.32&&piece.indices.length<9000)debris.push({part,piece,attributes:cached.attributes});}
   else for(const index of piece.indices)kept.push(index);
  }
  if(!kept.length)continue;
  const g=bwsCarveBurnVolume(geometryFor(cached.attributes,kept),part.matrixWorld,impact,radius,bounds.min.y+size.y*.2),pos=g.getAttribute("position"),original=g.getAttribute("color"),colors=new Float32Array(pos.count*3);
  for(let i=0;i<pos.count;i++){
   point.fromBufferAttribute(pos,i);worldPoint.copy(point).applyMatrix4(part.matrixWorld);
   const proximity=Math.max(0,1-distance(worldPoint)/1.9),noise=.82+.18*bwsTerrainNoise(worldPoint.x*1.7+worldPoint.y*.3,worldPoint.z*1.7,seed);
   const scorch=Math.min(.96,burn*proximity*1.8*noise),shade=1-scorch;
   colors[i*3]=(original?original.getX(i):1)*shade;
   colors[i*3+1]=(original?original.getY(i):1)*shade*(1-scorch*.12);
   colors[i*3+2]=(original?original.getZ(i):1)*shade*(1-scorch*.2);
  }
  g.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));g.computeBoundingSphere();
  const material=part.material.clone();material.vertexColors=true;material.needsUpdate=true;
  const mesh=new THREE.Mesh(g,material);mesh.position.copy(part.position);mesh.quaternion.copy(part.quaternion);mesh.scale.copy(part.scale);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);
 }
 // Fallen fragments retain the actual house geometry, UVs and material maps.
 for(const {part,piece,attributes}of debris){
  const g=geometryFor(attributes,piece.indices);g.translate(-piece.center.x,-piece.center.y,-piece.center.z);g.applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(random()*Math.PI,random()*Math.PI,random()*Math.PI)));
  g.computeBoundingBox();const material=part.material.clone();material.color.multiplyScalar(1-burn*.8);
  const mesh=new THREE.Mesh(g,material);mesh.position.set((random()-.5)*size.x*.8,-g.boundingBox.min.y+.04,(random()-.5)*size.z*.8);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);
 }
 // Find the actual surviving floor rather than placing the fire below it.
 root.updateMatrixWorld(true);const ray=new THREE.Raycaster(new THREE.Vector3(0,bounds.min.y+size.y*.65,0),new THREE.Vector3(0,-1,0));
 const hit=ray.intersectObjects(root.children,false).find(h=>h.face&&h.face.normal.y>.6);
 const origin=new THREE.Vector3(0,hit?hit.point.y+.025:bounds.min.y+.08,0);
 root.userData.bwsFireOrigin=origin.toArray();
 for(const mesh of root.children){bwsCharredSurface(mesh.material,impact,radius,burn,origin);mesh.userData.bwsAnimatedEffect=true;}
 if(burn>0){const coals=bwsCoalBed(Math.min(size.x,size.z)*.2,seed);coals.position.copy(origin);root.add(coals);
 const fuelBounds=new THREE.Box3().setFromObject(coals);
 root.userData.bwsFireOrigin=[origin.x,Math.max(origin.y,fuelBounds.max.y-.03),origin.z];}
 root.userData.houseDamage={sourceName:source.name,seed,severity,burn,method:"original-connected-pieces"};return root;
}
const BWS_DAMAGE_EFFECT_NODES=Object.freeze({
 ruinedHouse:{title:"Ruined House",category:"Damage & Effects",fields:{ruinWidth:["Width",7,2,30,.1],ruinDepth:["Depth",8,2,30,.1],ruinHeight:["Height",7,2,30,.1],ruinDamage:["Damage",.65,.1,1,.05],ruinBurn:["Scorch",.8,0,1,.05]}},
 ruinRubble:{title:"Rubble Scatter",category:"Damage & Effects",fields:{rubbleRadius:["Radius",3,.3,12,.1],rubbleCount:["Pieces",28,1,100,1],rubbleBurn:["Scorch",.6,0,1,.05]}},
 sceneFire:{title:"Fire Emitter",category:"Damage & Effects",fields:{effectSize:["Size",2,.2,8,.1],effectLifetime:["Lifetime",2,.5,10,.1],effectIntensity:["Intensity",1,0,2,.1],effectWind:["Wind",.3,-2,2,.1],effectColor:["Fire color","#ff761b"]}},
 sceneSmoke:{title:"Smoke Emitter",category:"Damage & Effects",fields:{smokeSize:["Size",3,.2,12,.1],smokeLifetime:["Lifetime",6,1,20,.1],smokeIntensity:["Density",.7,0,1,.05],smokeWind:["Wind",.3,-2,2,.1],smokeColor:["Smoke color","#55514d"]}}
});
function bwsBuildDamageNode(type,p,{graph,nodeId,group,outputName,emit}){
 const random=geometryNodePrng(graph.seed>>>0),parts=new Map();
 function add(g,color){if(g.index){const flat=g.toNonIndexed();g.dispose();g=flat;}g.deleteAttribute("uv");if(!parts.has(color))parts.set(color,[]);parts.get(color).push(g);}
 function box(w,h,d,x,y,z,color){const g=new THREE.BoxGeometry(w,h,d);g.translate(x,y,z);add(g,color);}
 function beam(a,b,width,color){const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),v=end.clone().sub(start);if(v.length()<.01)return;const g=new THREE.BoxGeometry(width,v.length(),width);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize()));g.translate(...start.add(end).multiplyScalar(.5).toArray());add(g,color);}
 function rubble(radius,count,burn){for(let i=0;i<count;i++){const a=random()*Math.PI*2,r=Math.sqrt(random())*radius,x=Math.cos(a)*r,z=Math.sin(a)*r;if(i%3===0){const g=new THREE.BoxGeometry(.13,.13,.7+random()*1.5);g.rotateY(random()*Math.PI);g.rotateZ((random()-.5)*.3);g.translate(x,.16,z);add(g,new THREE.Color("#70523a").lerp(new THREE.Color("#211e1b"),burn).getHex());}else{const g=new THREE.IcosahedronGeometry(.12+random()*.25,0);g.scale(1.3,.7,1);g.rotateY(random()*6.28);g.translate(x,.17,z);add(g,new THREE.Color("#8d887b").lerp(new THREE.Color("#45413c"),burn).getHex());}}}
 if(type==="ruinedHouse"){
  const w=p.ruinWidth,d=p.ruinDepth,h=p.ruinHeight,damage=p.ruinDamage,burn=p.ruinBurn,wall=h*.62;
  const wood=new THREE.Color("#74523a").lerp(new THREE.Color("#211c19"),burn).getHex(),stone=new THREE.Color("#989080").lerp(new THREE.Color("#4b4540"),burn*.8);
  box(w,.08,d,0,.04,0,new THREE.Color("#71665a").lerp(new THREE.Color("#38322e"),burn).getHex());
  for(let side=0;side<4;side++){
   const length=side<2?w:d,columns=Math.ceil(length/.65),rows=Math.ceil(wall/.38),step=length/columns;
   for(let c=0;c<columns;c++){const t=(c+.5)/columns,edge=Math.abs(t-.5)*2,top=Math.max(1,Math.floor(rows*(1-damage*(.3+.55*Math.sin(t*Math.PI)))+random()*2));
    for(let row=0;row<top;row++){if(side===0&&Math.abs(t-.5)<.13&&row*.38<Math.min(2,wall*.8))continue;const a=-length/2+(c+.5)*step;
     const color=stone.clone().multiplyScalar(.83+random()*.28).getHex();
     box(side<2?step-.025:.3,.35,side<2?.3:step-.025,side<2?a:(side===2?-w/2:w/2),.25+row*.38,side<2?(side===0?d/2:-d/2):a,color);
    }
    if(c%3===0&&edge>.35){const x=side<2?-length/2+(c+.5)*step:(side===2?-w/2:w/2),z=side<2?(side===0?d/2:-d/2):-length/2+(c+.5)*step;beam([x,.1,z],[x,wall*(.7+random()*.3),z],.15,wood);}
   }
  }
  const rafters=Math.max(3,Math.ceil(d/1.4));
  for(let i=0;i<rafters;i++){const z=-d/2+i*d/(rafters-1);for(const side of [-1,1]){const a=[side*w/2,wall,z],b=[0,h,z];if(random()>damage*.8)beam(a,b,.17,wood);else beam(a,[side*w*(.15+random()*.2),wall+(h-wall)*random()*.45,z],.17,wood);}}
  beam([0,h,-d/2],[0,h,d*(.5-damage*.7)],.2,wood);
  // Surviving roof patches stay against rafters; severe ruins expose the frame.
  for(const side of [-1,1]){const retained=Math.floor((1-damage)*rafters);for(let i=0;i<retained;i++){const z=-d/2+i*d/(rafters-1);for(let r=0;r<5;r++){const a=r/5,b=(r+1)/5;beam([side*w/2*(1-a),wall+(h-wall)*a,z],[side*w/2*(1-b),wall+(h-wall)*b,z],.32,new THREE.Color("#855b48").lerp(new THREE.Color("#332824"),burn).getHex());}}}
  rubble(Math.min(w,d)*.44,Math.round(15+damage*55),burn);
 }else if(type==="ruinRubble")rubble(p.rubbleRadius,p.rubbleCount,p.rubbleBurn);
 else{const smoke=type==="sceneSmoke",size=smoke?p.smokeSize:p.effectSize,color=smoke?p.smokeColor:p.effectColor;for(let i=0;i<7;i++){const g=smoke?new THREE.IcosahedronGeometry(size*(.18+i*.025),1):new THREE.ConeGeometry(size*(.17-i*.012),size*.7,7);g.translate((random()-.5)*size*.35,size*(.25+i*.22),(random()-.5)*size*.35);add(g,color);}}
 let n=0;for(const [color,list]of parts){const geometry=mergeGeometries(list,false);list.forEach(g=>g.dispose());emit(geometryNodeCustomSpec(geometry,{name:outputName+" "+(++n),position:[p.assetOffsetX,p.assetOffsetY,p.assetOffsetZ],color,roughness:.96,graph,targetId:nodeId,group}));}return n;
}
function bwsDamageRecipe(type,params,seed){const graph=defaultGeometryNodeGraph(BWS_DAMAGE_EFFECT_NODES[type].title);graph.seed=seed>>>0;graph.nodeOrder=["seed",type,"output"];graph.connections=[{id:"a",fromNodeId:"seed",toNodeId:type,toInputIndex:0},{id:"b",fromNodeId:type,toNodeId:"output",toInputIndex:0}];Object.assign(graph.params,params);graph.nodeParams={};graph.generatedIds=[];graph.nodePositions={seed:[30,40],[type]:[280,40],output:[560,40]};return graph;}
function bwsSceneRuin(params,seed){const graph=bwsDamageRecipe("ruinedHouse",params,seed),root=new THREE.Group();root.name="Node-generated ruin";root.userData.nodeSource={type:"ruinedHouse",graph};bwsBuildDamageNode("ruinedHouse",assetNodeSanitize(graph.params),{graph,nodeId:"ruinedHouse",group:{id:graph.id,name:graph.name},outputName:graph.name,emit:spec=>{const mesh=geometryNodePreviewMesh(spec,new Map());mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);}});return root;}
// Character effects use an ordinary rigid-bound carrier. The persisted
// gameAsset recipe recreates the shader on load; no shader JSON is required.
let bwsCharacterEffectCaptureDepth = 0;
function bwsCharacterEyesAwake() {
 if (tPoseFittingMode) return true;
 const id=String(animationState.activeClipId||"");
 const name=String(animationState.clips?.[id]?.name||"");
 return !/(^|[\s_/-])(dead|death|asleep|sleep|dormant)([\s_/-]|$)/i.test(id+" "+name);
}
function bwsUpdateCharacterEyeVisibility() {
 const awake=bwsCharacterEyesAwake();
 for(const object of objects){
  if(object.userData.gameAsset?.necromanticEye || object.userData.gameAsset?.bwsEffect?.type === "gasFire") {
   object.visible=!object.userData.hidden && awake;
  }
 }
}
function bwsAttachCharacterGasFire(carrier, recipe) {
 const finite=(value,fallback,min,max)=>Number.isFinite(Number(value))?Math.max(min,Math.min(max,Number(value))):fallback;
 const seed=finite(recipe.seed,41,0,2147483647);
 const fire=bwsSceneFlame({effectSize:1,effectLifetime:finite(recipe.lifetime,1.4,.2,10),effectIntensity:finite(recipe.intensity,.85,0,2),effectWind:finite(recipe.wind,.08,-2,2),effectColor:normalizeHexColor(recipe.color,"#ff761b"),assetOffsetX:0,assetOffsetY:0,assetOffsetZ:0},seed);
 // Eye-sized flames should not emit town-sized point sprites.
 for(const child of [...fire.children]){fire.remove(child);child.geometry?.dispose();child.material?.dispose();}
 const size=Array.isArray(recipe.scale)?recipe.scale:[.09,.075,.09];
 fire.scale.set(finite(size[0],.09,.005,10),finite(size[1],.075,.005,10),finite(size[2],.09,.005,10));
 fire.name="Bone-attached gas fire";
 fire.castShadow=false;fire.receiveShadow=false;
 const cameraCallback=fire.onBeforeRender;
 fire.onBeforeRender=(renderer,renderScene,renderCamera,...args)=>{
   // Animation captures evaluate animationState.frame before rendering, too.
   fire.material.uniforms.fxTime.value=bwsCharacterEffectCaptureDepth>0
     ? animationState.frame/Math.max(1,animationState.fps)
     : performance.now()*.001;
   cameraCallback(renderer,renderScene,renderCamera,...args);
 };
 carrier.material.colorWrite=false;carrier.material.depthWrite=false;
 carrier.castShadow=false;carrier.receiveShadow=false;
 carrier.add(fire);
}
function bwsSceneFlame(params,seed){
 const p=assetNodeSanitize(params),geometry=new THREE.BoxGeometry(2,4,2);geometry.translate(0,2,0);
 const material=new THREE.ShaderMaterial({transparent:true,depthTest:true,depthWrite:false,side:THREE.BackSide,uniforms:{
  fxTime:{value:0},eye:{value:new THREE.Vector3()},wind:{value:p.effectWind},speed:{value:2/p.effectLifetime},strength:{value:p.effectIntensity},tint:{value:new THREE.Color(p.effectColor)},seed:{value:(seed%10007)*.013},
  sceneDepth:{value:null},useSceneDepth:{value:0},depthViewport:{value:new THREE.Vector2(1,1)},inverseProjection:{value:new THREE.Matrix4()},viewToLocal:{value:new THREE.Matrix4()}
 },vertexShader:'varying vec3 localPosition;void main(){localPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:`
 precision highp float;
 varying vec3 localPosition;uniform vec3 eye,tint;uniform float fxTime,wind,speed,strength,seed;
 uniform mat4 modelViewMatrix,projectionMatrix,inverseProjection,viewToLocal;
 uniform sampler2D sceneDepth;uniform float useSceneDepth;uniform vec2 depthViewport;
 float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
 float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
 float turbulence(vec3 p){return noise(p)*.58+noise(p*2.03)*.28+noise(p*4.07)*.14;}
 float opaqueEnd(vec3 ray,float end){
  if(useSceneDepth<.5)return end;
  vec2 uv=gl_FragCoord.xy/depthViewport;
  float depth=texture2D(sceneDepth,uv).x;
  vec4 view=inverseProjection*vec4(uv*2.0-1.0,depth*2.0-1.0,1.0);
  vec3 local=(viewToLocal*vec4(view.xyz/view.w,1.0)).xyz;
  return min(end,dot(local-eye,ray));
 }
 void main(){
  vec3 ray=normalize(localPosition-eye);
  vec3 safeRay=mix(vec3(.00001),ray,step(vec3(.00001),abs(ray)));
  vec3 a=(vec3(-1.0,0.0,-1.0)-eye)/safeRay,b=(vec3(1.0,4.0,1.0)-eye)/safeRay;
  vec3 lo=min(a,b),hi=max(a,b);float start=max(0.0,max(lo.x,max(lo.y,lo.z))),end=opaqueEnd(ray,min(hi.x,min(hi.y,hi.z)));
  if(end<=start||strength<=0.0)discard;
  float stepSize=(end-start)/64.0,time=fxTime*speed,firstFlame=-1.0;vec4 total=vec4(0);
  for(int i=0;i<64;i++){
   float sampleT=start+(float(i)+.5)*stepSize;
   vec3 q=eye+ray*sampleT;float h=clamp(q.y*.25,0.0,1.0);
   q.x-=wind*h*h*.23;
   // Separate folded reaction sheets; avoid filling the entire tapered envelope.
   float n=turbulence(vec3(q.x*4.6,q.y*2.4-time*3.8,q.z*4.6)+seed);
   float density=0.0,heat=0.0,sootDensity=0.0;
   for(int tongue=0;tongue<4;tongue++){
    float id=float(tongue);
    float rate=.27+.085*fract(sin(seed+id*17.13)*43758.5453);
    float clock=time*rate+id*.25+fract(seed*.3);
    float age=fract(clock),phase=seed+id*2.39996+floor(clock)*1.618;
    float variation=fract(sin(phase*7.73)*43758.5453);
    float life=smoothstep(0.0,.07,age)*(1.0-smoothstep(.78,1.0,age));
    float height=1.35+.45*variation+.38*sin(age*3.14159265);
    float rise=age*(2.0+.18*variation);
    float t=(q.y-rise)/height;
    if(t>0.0&&t<1.0){
     vec2 root=(.22+.20*variation)*vec2(cos(phase),sin(phase));
     vec2 bend=vec2(sin(t*6.2-time*2.7+phase),cos(t*5.1-time*2.3+phase));
     vec2 wander=vec2(sin(age*8.0+phase),cos(age*6.7+phase*1.4))*age*.12;
     vec2 center=root*(1.0-.25*t)+bend*t*(.15+.18*t)+wander;
     float width=(.27+.06*sin(phase))*pow(1.0-t,.68)+.018;
     vec2 p=(q.xz-center)/width;
     float angle=atan(p.y,p.x);
     float radius=length(p)+(n-.5)*(.55+t*.55)+sin(angle*2.0+t*7.0-time*2.2+phase)*.13;
     float shell=smoothstep(.12,.48,radius)*(1.0-smoothstep(.78,1.12,radius));
     float core=(1.0-smoothstep(.05,.55,radius))*.16*(1.0-t);
     float d=(shell+core)*smoothstep(0.0,.045,t)*(1.0-smoothstep(.8,1.0,t))*life;
     density=max(density,d);
     heat=max(heat,d*(1.0-t*.65));
     // Sparse cooler soot curls travel with the upward flame packets.
     float soot=smoothstep(.55,.77,n)*smoothstep(.25,.65,t)*(1.0-smoothstep(.75,1.35,radius))*life;
     sootDensity=max(sootDensity,soot*.65);
    }
   }
   // Small ignition layer stays on the fuel; every larger flame packet rises and dies.
   float ignition=(1.0-smoothstep(.12,.46,q.y))*smoothstep(.22,.58,n)*(1.0-smoothstep(.28,.65,length(q.xz)));
   density=max(density,ignition*.65);
   heat=max(heat,ignition*.6);
   density*=smoothstep(0.0,.018,h);
   float hot=clamp(heat,0.0,1.0);
   vec3 color=mix(tint*vec3(2.6,.6,.12),vec3(3.7,.72,.012),smoothstep(.1,.72,hot));
   color=mix(color,vec3(4.7,2.0,.16),smoothstep(.86,1.0,hot)*(1.0-smoothstep(.025,.15,h)));
   float fireAlpha=1.0-exp(-density*stepSize*4.2*strength);
   float sootAlpha=1.0-exp(-sootDensity*stepSize*2.8*strength);
   float alpha=1.0-(1.0-fireAlpha)*(1.0-sootAlpha);
   color=(color*fireAlpha*(1.0-sootAlpha)+vec3(.018,.014,.011)*sootAlpha)/max(alpha,.00001);
   if(firstFlame<0.0&&alpha>.0001)firstFlame=sampleT;
   total.rgb+=(1.0-total.a)*color*alpha;total.a+=(1.0-total.a)*alpha;
   if(total.a>.995)break;
  }
  if(total.a<.005||firstFlame<0.0)discard;
  vec4 clip=projectionMatrix*modelViewMatrix*vec4(eye+ray*firstFlame,1.0);
  gl_FragDepth=.5*(clip.z/clip.w)+.5;
  gl_FragColor=vec4(total.rgb/max(total.a,.001),total.a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }
 `});
 const mesh=new THREE.Mesh(geometry,material);mesh.name="Procedural volume fire";mesh.scale.setScalar(p.effectSize*.65);mesh.position.set(p.assetOffsetX,p.assetOffsetY,p.assetOffsetZ);
 mesh.userData.bwsAnimatedEffect=true;mesh.userData.bwsFireLight={size:p.effectSize,intensity:p.effectIntensity,seed};mesh.userData.nodeSource={type:"sceneFire",graph:bwsDamageRecipe("sceneFire",params,seed)};
 mesh.onBeforeRender=(_renderer,_scene,camera)=>{
  camera.getWorldPosition(material.uniforms.eye.value);mesh.worldToLocal(material.uniforms.eye.value);
  material.uniforms.inverseProjection.value.copy(camera.projectionMatrixInverse);
  material.uniforms.viewToLocal.value.copy(mesh.matrixWorld).invert().multiply(camera.matrixWorld);
 };
 mesh.add(bwsFireSparks(seed,p.effectIntensity));return mesh;
}
function bwsFireSparks(seed,intensity){
 const random=geometryNodePrng(seed+721),positions=[],phases=[];for(let i=0;i<18;i++){positions.push((random()-.5)*1.2,random(),(random()-.5)*1.2);phases.push(random());}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute("phase",new THREE.Float32BufferAttribute(phases,1));
 const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{fxTime:{value:0},strength:{value:intensity}},vertexShader:'attribute float phase;uniform float fxTime;varying float age;void main(){age=fract(phase+fxTime*.22);vec3 p=position;p.y=.3+age*6.0;p.x+=sin(age*7.0+phase*25.0)*age*.6;p.z+=cos(age*6.0+phase*19.0)*age*.6;vec4 v=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*v;gl_PointSize=clamp(65.0/max(1.0,-v.z),1.0,3.5);}',fragmentShader:'uniform float strength;varying float age;void main(){float d=length(gl_PointCoord-.5)*2.0;if(d>1.0)discard;gl_FragColor=vec4(1.0,.25,.015,(1.0-d)*(1.0-age)*strength*.7);}'});
 const points=new THREE.Points(geometry,material);points.frustumCulled=false;points.name="Rising fire sparks";points.userData.bwsAnimatedEffect=true;return points;
}
function bwsSceneSmokeVolume(params,seed){
 const p=assetNodeSanitize(params);
 // Reuse the bounded volume and camera-local ray setup, not a billboard.
 const mesh=bwsSceneFlame({effectSize:p.smokeSize,effectLifetime:p.smokeLifetime,effectIntensity:p.smokeIntensity,effectWind:p.smokeWind,effectColor:p.smokeColor,assetOffsetX:p.assetOffsetX,assetOffsetY:p.assetOffsetY,assetOffsetZ:p.assetOffsetZ},seed);
 for(const child of [...mesh.children]){mesh.remove(child);child.geometry.dispose();child.material.dispose();}
 delete mesh.userData.bwsFireLight;mesh.name="Billowing volumetric smoke";mesh.userData.nodeSource={type:"sceneSmoke",graph:bwsDamageRecipe("sceneSmoke",params,seed)};
 const material=mesh.material;material.uniforms.speed.value=6/p.smokeLifetime;
 const start=material.fragmentShader.indexOf('void main()');
 material.fragmentShader=material.fragmentShader.slice(0,start)+`void main(){
  vec3 ray=normalize(localPosition-eye),safeRay=ray+vec3(.00001);
  vec3 a=(vec3(-1.0,0.0,-1.0)-eye)/safeRay,b=(vec3(1.0,4.0,1.0)-eye)/safeRay;
  vec3 lo=min(a,b),hi=max(a,b);float start=max(0.0,max(lo.x,max(lo.y,lo.z))),end=opaqueEnd(ray,min(hi.x,min(hi.y,hi.z)));if(end<=start)discard;
  float stepSize=(end-start)/32.0,time=fxTime*speed;vec4 total=vec4(0);float firstSmoke=-1.0;
  for(int i=0;i<32;i++){
   vec3 q=eye+ray*(start+(float(i)+.5)*stepSize);float h=q.y*.25;
   q.x-=wind*h*.22+sin(h*7.0-time*.65+seed)*h*.18;q.z-=cos(h*6.0-time*.5+seed)*h*.15;
   vec3 flow=vec3(q.x*3.5,q.y*2.0-time,q.z*3.5)+seed;
   float n=turbulence(flow),detail=noise(flow*2.0+5.0);
   float width=.24+h*.61+sin(q.y*5.0-time*2.0+n*3.0)*.09;
   float body=1.0-length(q.xz)/max(.1,width)+(n-.5)*1.5;
   float density=smoothstep(.02,.48,body)*smoothstep(.01,.1,h)*(1.0-smoothstep(.63,1.0,h));
   float alpha=1.0-exp(-density*stepSize*3.4*strength);if(firstSmoke<0.0&&alpha>.0001)firstSmoke=start+(float(i)+.5)*stepSize;
   float illumination=.48+.48*n+.18*detail;
   vec3 smokeColor=tint*illumination+vec3(.045,.037,.027)*(1.0-h);
   total.rgb+=(1.0-total.a)*smokeColor*alpha;total.a+=(1.0-total.a)*alpha;
  }
  if(total.a<.005||firstSmoke<0.0)discard;vec4 clip=projectionMatrix*modelViewMatrix*vec4(eye+ray*firstSmoke,1.0);gl_FragDepth=.5*(clip.z/clip.w)+.5;gl_FragColor=vec4(total.rgb/max(.001,total.a),total.a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }`;material.needsUpdate=true;return mesh;
}
function bwsSceneEmitter(type,params,seed){
 if(type==="sceneFire")return bwsSceneFlame(params,seed);
 if(type==="sceneSmoke")return bwsSceneSmokeVolume(params,seed);
 const smoke=type==="sceneSmoke",p=assetNodeSanitize(params),random=geometryNodePrng(seed>>>0),count=smoke?24:36;
 const geometry=new THREE.BufferGeometry(),origins=[],phases=[];for(let i=0;i<count;i++){origins.push((random()-.5)*.7,random(),(random()-.5)*.7);phases.push(random());}geometry.setAttribute("position",new THREE.Float32BufferAttribute(origins,3));geometry.setAttribute("phase",new THREE.Float32BufferAttribute(phases,1));
 const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:smoke?THREE.NormalBlending:THREE.AdditiveBlending,uniforms:{fxTime:{value:0},size:{value:smoke?p.smokeSize:p.effectSize},life:{value:smoke?p.smokeLifetime:p.effectLifetime},strength:{value:smoke?p.smokeIntensity:p.effectIntensity},wind:{value:smoke?p.smokeWind:p.effectWind},tint:{value:new THREE.Color(smoke?p.smokeColor:p.effectColor)},smoke:{value:smoke?1:0}},
 vertexShader:'attribute float phase; uniform float fxTime,size,life,wind,smoke; varying float age; void main(){age=fract(phase+fxTime/life);vec3 p=position; p.xz*=size*(0.6+age*smoke);p.y=age*size*(2.0+smoke*2.0);p.x+=wind*age*age*size+sin(age*8.0+phase*20.0)*size*.13;vec4 v=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*v;gl_PointSize=clamp(size*(0.4+smoke*age)*500.0/max(1.0,-v.z),1.0,180.0);}',
 fragmentShader:'uniform vec3 tint;uniform float strength,smoke;varying float age;void main(){vec2 q=gl_PointCoord*2.0-1.0;float radius=length(q);if(radius>1.0)discard;float a=pow(1.0-radius,1.7)*sin(age*3.14159)*strength;vec3 c=mix(mix(vec3(1.0,.85,.3),tint,age),tint,smoke);gl_FragColor=vec4(c,a*mix(.8,.3,smoke));}' });
 const points=new THREE.Points(geometry,material);points.frustumCulled=false;points.name=BWS_DAMAGE_EFFECT_NODES[type].title;points.userData.bwsAnimatedEffect=true;points.userData.nodeSource={type,graph:bwsDamageRecipe(type,params,seed)};points.position.set(p.assetOffsetX,p.assetOffsetY,p.assetOffsetZ);return points;
}
