const BWS_VILLAGE_PROP_BASE=Object.freeze({
 villageProp:{label:"Village Props",source:true,fields:{propKind:["Prop","crate",["crate","barrel","fence","logPile"]],propSize:["Size",1,.2,4,.1],propFenceLength:["Fence length",3,.3,50,.1],propWood:["Wood","#796044"],propMetal:["Iron","#444943"]}}
});
const BWS_VILLAGE_PROP_NODES=Object.freeze({...BWS_VILLAGE_PROP_BASE,...Object.fromEntries([
 ["propFence","Wooden Fence","fence"],["propGate","Wooden Gate","gate"],
 ["propBarrel","Wooden Barrel","barrel"],["propCrate","Braced Crate","crate"],
 ["propLogPile","Stacked Logs","logPile"],["propLog","Fallen Log","log"],
 ["propStump","Tree Stump","stump"],["propBench","Wooden Bench","bench"],
 ["propCart","Handcart","cart"],["propSack","Grain Sack","sack"],
 ["propTrough","Water Trough","trough"],["propWell","Stone Well","well"]
].map(([id,label,kind])=>[id,{label,kind,source:true,fields:Object.fromEntries(Object.entries(BWS_VILLAGE_PROP_BASE.villageProp.fields).filter(([key])=>key!=="propKind"&&(key!=="propFenceLength"||kind==="fence")))}]))});
function bwsBuildVillageProp(type,p,{graph,nodeId,group,outputName,emit}){
 if(type!=="villageProp")p={...p,propKind:BWS_VILLAGE_PROP_NODES[type].kind};
 const size=p.propSize,wood=p.propWood,iron=p.propMetal,batches=new Map();
 function add(g,color){g.deleteAttribute("uv");if(g.index){const flat=g.toNonIndexed();g.dispose();g=flat;}if(!batches.has(color))batches.set(color,[]);batches.get(color).push(g);}
 function box(w,h,d,x,y,z,color=wood,angle=0){const g=new THREE.BoxGeometry(w,h,d);g.rotateZ(angle);g.translate(x,y,z);add(g,color);}
 function beam(a,b,width,color=wood){const v=new THREE.Vector3(...b).sub(new THREE.Vector3(...a)),g=new THREE.BoxGeometry(width,v.length(),width);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize()));g.translate((a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2);add(g,color);}
 if(p.propKind==="fence"){
  const length=p.propFenceLength,segments=Math.max(1,Math.ceil(length/2.1));
  for(let i=0;i<=segments;i++){const x=-length/2+length*i/segments;box(.15,1.15,.15,x,.575,0);box(.19,.07,.19,x,1.16,0);}
  for(let i=0;i<segments;i++){const a=-length/2+length*i/segments,b=-length/2+length*(i+1)/segments;for(const y of [.36,.78])box(b-a,.11,.09,(a+b)/2,y,0);if(i%2===0)beam([a,.31,.025],[b,.85,.025],.065);}
 }else if(p.propKind==="crate"){
  for(let i=0;i<5;i++){const a=-.4+i*.2;for(const z of [-.47,.47])box(.185,.95,.065,a,.51,z);for(const x of [-.47,.47])box(.065,.95,.185,x,.51,a);box(.185,.055,.9,a,1.015,0);}
  for(const z of [-.52,.52]){for(const y of [.13,.9])box(1.03,.13,.075,0,y,z);beam([-.41,.2,z],[.41,.83,z],.095);}
  for(const x of [-.52,.52])for(const y of [.13,.9])box(.075,.13,1.03,x,y,0);
 }else if(p.propKind==="barrel"){
  const profile=[new THREE.Vector2(.36,0),new THREE.Vector2(.4,.12),new THREE.Vector2(.46,.48),new THREE.Vector2(.43,.85),new THREE.Vector2(.36,1.05)];
  for(let i=0;i<14;i++){const g=new THREE.LatheGeometry(profile,1,i*Math.PI*2/14+.009,Math.PI*2/14-.018);add(g,i%3===0?"#8a704e":wood);}
  for(const y of [.13,.83]){const g=new THREE.CylinderGeometry(y<.5?.408:.443,y<.5?.413:.447,.075,14,1,true);g.translate(0,y,0);add(g,iron);}
  const lid=new THREE.CylinderGeometry(.36,.36,.05,14);lid.translate(0,1.05,0);add(lid,wood);
  const bottom=new THREE.CylinderGeometry(.36,.36,.04,14);bottom.translate(0,.02,0);add(bottom,wood);
  for(const x of [-.18,0,.18])box(.012,.004,Math.sqrt(.36*.36-x*x)*2,x,1.077,0,"#594a37");
 }else if(p.propKind==="gate"){
  for(const x of [-1.1,1.1])box(.19,1.45,.19,x,.725,0);
  for(const y of [.3,1.05])box(1.96,.13,.12,0,y,0);
  for(let i=0;i<6;i++)box(.12,1.05,.1,-.85+i*.34,.7,0);
  beam([-.92,.3,.08],[.92,1.08,.08],.11);box(.2,.06,.08,.75,.88,.13,iron);
 }else if(p.propKind==="bench"){
  for(const z of [-.22,0,.22])box(1.8,.1,.2,0,.58,z);
  for(const x of [-.65,.65]){for(const z of [-.2,.2])box(.12,.55,.12,x,.275,z);box(.12,1.05,.12,x,.55,-.27);}
  for(const y of [.82,1.08])box(1.8,.18,.08,0,y,-.3);
 }else if(p.propKind==="trough"){
  box(1.9,.1,.7,0,.2,0);for(const z of [-.38,.38])box(2,.45,.1,0,.43,z);
  for(const x of [-.95,.95])box(.1,.45,.8,x,.43,0);
  for(const x of [-.65,.65])box(.18,.25,.65,x,.125,0);
  box(1.8,.015,.64,0,.45,0,"#527c79");
 }else if(p.propKind==="sack"){
  const g=new THREE.IcosahedronGeometry(1,2);g.scale(.37,.52,.3);g.translate(0,.52,0);add(g,"#b3a078");
  const neck=new THREE.CylinderGeometry(.1,.16,.16,9);neck.translate(0,1.02,0);add(neck,"#a58f63");
  const tie=new THREE.TorusGeometry(.105,.025,4,10);tie.rotateX(Math.PI/2);tie.translate(0,1.055,0);add(tie,"#675336");
 }else if(p.propKind==="log"||p.propKind==="stump"){
  const stump=p.propKind==="stump",length=stump?.65:2.3,r=stump?.42:.24;
  const g=new THREE.CylinderGeometry(r*.9,r,length,10);if(!stump)g.rotateX(Math.PI/2);g.translate(0,stump?length/2:r,0);add(g,wood);
  const end=new THREE.CircleGeometry(r*.88,10);if(stump){end.rotateX(-Math.PI/2);end.translate(0,length+.002,0);}else end.translate(0,r,length/2+.002);add(end,"#bda274");
  if(!stump){const cap=new THREE.CircleGeometry(r*.98,10);cap.rotateY(Math.PI);cap.translate(0,r,-length/2-.002);add(cap,"#bda274");}
  if(stump)for(let i=0;i<5;i++){const a=i*Math.PI*2/5;beam([Math.cos(a)*.65,.05,Math.sin(a)*.65],[0,.32,0],.18);}
 }else if(p.propKind==="cart"){
  for(let i=0;i<6;i++)box(.17,.09,1.45,-.45+i*.18,.65,0);
  for(const x of [-.58,.58]){for(const y of [.87,1.1])box(.075,.18,1.5,x,y,0);for(const z of [-.65,.65])box(.09,.65,.09,x,.95,z);}
  for(const y of [.87,1.1])box(1.2,.18,.08,0,y,-.72);
  for(const x of [-.42,.42])beam([x,.61,.5],[x,.8,2],.085);
  beam([-.85,.48,0],[.85,.48,0],.12,iron);
  for(const x of [-.78,.78]){const rim=new THREE.TorusGeometry(.43,.06,5,12);rim.rotateY(Math.PI/2);rim.translate(x,.48,0);add(rim,wood);
   for(let i=0;i<6;i++){const a=i*Math.PI/3;beam([x,.48,0],[x,.48+Math.sin(a)*.4,Math.cos(a)*.4],.045);}
  }
 }else if(p.propKind==="well"){
  for(let row=0;row<3;row++)for(let i=0;i<12;i++){const a=(i+(row%2)*.5)*Math.PI/6,g=new THREE.BoxGeometry(.4,.27,.25);g.rotateY(-a);g.translate(Math.cos(a)*.82,.15+row*.28,Math.sin(a)*.82);add(g,i%3?"#8b897e":"#9d998b");}
  for(const x of [-1,1])box(.14,2.3,.14,x,1.15,0);box(2.2,.14,.18,0,2.3,0);
  beam([-1,1.65,0],[1,1.65,0],.09,iron);beam([0,1.65,0],[0,.5,0],.022,"#a99165");
  const water=new THREE.CircleGeometry(.66,24);water.rotateX(-Math.PI/2);water.translate(0,.15,0);add(water,"#405f62");
 }else{
  for(let row=0;row<3;row++)for(let i=0;i<3-row;i++){
   const x=(i-(2-row)/2)*.36,y=.18+row*.3,length=1.8+(i%2)*.15;
   const g=new THREE.CylinderGeometry(.17,.2,length,9);g.rotateX(Math.PI/2);g.translate(x,y,0);add(g,wood);
   for(const z of [-length/2-.002,length/2+.002]){const end=new THREE.CircleGeometry(.155,9);if(z<0)end.rotateY(Math.PI);end.translate(x,y,z);add(end,"#b39868");}
  }
 }
 let count=0;
 for(const [color,parts]of batches){const g=mergeGeometries(parts,false);parts.forEach(p=>p.dispose());g.scale(size,size,size);emit(geometryNodeCustomSpec(g,{name:outputName+" "+(++count),position:[p.assetOffsetX,p.assetOffsetY,p.assetOffsetZ],color,roughness:.9,graph,targetId:nodeId,group}));}return count;
}
function bwsVillageControls(){
 const host=document.getElementById("bwsSceneStudio");if(!host||host.querySelector("[data-village-controls]"))return;
 const button=Array.from(host.querySelectorAll("button")).find(b=>b.textContent.trim()==="Generate town");if(!button)return;
 const field=document.createElement("fieldset");field.dataset.villageControls="true";field.style.cssText="margin:14px 0;padding:12px;border:1px solid #52685d;border-radius:5px";
 field.innerHTML='<legend>Plot fences &amp; props</legend><label style="display:block;margin:8px 0"><input type="checkbox" data-village-fences checked> Fence each house plot</label><label style="display:flex;justify-content:space-between;gap:8px;margin:8px 0">Props per plot <input type="number" data-village-count min="0" max="8" value="3" style="width:65px"></label><p style="font-size:12px">Node-generated barrels, crates and stacked logs. Entrance gaps remain open.</p>';
 button.before(field);
}
new MutationObserver(bwsVillageControls).observe(document.documentElement,{childList:true,subtree:true});
function bwsPopulateVillageProps(world,settings){
 bwsVillageControls();
 const host=document.getElementById("bwsSceneStudio"),fences=host?.querySelector("[data-village-fences]")?.checked??true;
 const count=Math.max(0,Math.min(8,Math.round(Number(host?.querySelector("[data-village-count]")?.value)||0)));
 settings.villageFences=fences;settings.villageProps=count;
 const obsolete=[];world.traverse(o=>{if(o.userData?.villageDecoration)obsolete.push(o);});
 for(const o of obsolete){o.removeFromParent();o.traverse(m=>{m.geometry?.dispose();if(m.material)m.material.dispose();});}
 if(!fences&&!count)return;
 const plots=new Map(),matrix=new THREE.Matrix4(),pos=new THREE.Vector3(),quat=new THREE.Quaternion(),scale=new THREE.Vector3();
 world.updateMatrixWorld(true);
 world.traverse(mesh=>{
  if(!mesh.isInstancedMesh||mesh.userData.nodeSource)return;
  mesh.geometry.computeBoundingBox();const local=mesh.geometry.boundingBox;
  for(let i=0;i<mesh.count;i++){
   mesh.getMatrixAt(i,matrix);matrix.premultiply(mesh.matrixWorld);matrix.decompose(pos,quat,scale);
   const key=pos.x.toFixed(3)+":"+pos.z.toFixed(3);
   if(!plots.has(key))plots.set(key,new THREE.Box3());
   plots.get(key).union(local.clone().applyMatrix4(matrix));
  }
 });
 const root=new THREE.Group();root.name="Node-generated plot fences and props";root.userData.villageDecoration=true;
 const random=geometryNodePrng(settings.seed+42617);
 let serial=0;
 function prop(kind,x,z,angle,size,length){
  const graph=defaultGeometryNodeGraph("Village "+kind);graph.id="village-prop-"+(++serial);graph.seed=Math.floor(random()*1000000);graph.nodeOrder=["seed","villageProp","output"];graph.connections=[{id:"a",fromNodeId:"seed",toNodeId:"villageProp",toInputIndex:0},{id:"b",fromNodeId:"villageProp",toNodeId:"output",toInputIndex:0}];
  Object.assign(graph.params,{propKind:kind,propSize:size,propFenceLength:length||3,propWood:"#796044",propMetal:"#444943",assetOffsetX:0,assetOffsetY:0,assetOffsetZ:0});
  const group=new THREE.Group();group.name=graph.name;group.position.set(x,0,z);group.rotation.y=angle;group.userData.nodeSource={id:graph.id,name:graph.name,graph};
  bwsBuildVillageProp("villageProp",assetNodeSanitize(graph.params),{graph,nodeId:"villageProp",group:{id:graph.id,name:graph.name},outputName:graph.name,emit:spec=>{const mesh=geometryNodePreviewMesh(spec,new Map());mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);}});
  root.add(group);
 }
 for(const bounds of plots.values()){
  const dimensions=bounds.getSize(new THREE.Vector3());if(dimensions.y<2||dimensions.x<1.5||dimensions.z<1.5)continue;
  const x0=bounds.min.x-.7,x1=bounds.max.x+.7,z0=bounds.min.z-.7,z1=bounds.max.z+.7,cx=(x0+x1)/2,cz=(z0+z1)/2;
  if(fences){
   prop("fence",x0,cz,Math.PI/2,1,z1-z0);prop("fence",x1,cz,Math.PI/2,1,z1-z0);
   const gap=Math.min(2.4,(x1-x0)*.45),length=(x1-x0-gap)/2;
   if(length>.3)for(const z of [z0,z1]){prop("fence",x0+length/2,z,0,1,length);prop("fence",x1-length/2,z,0,1,length);}
  }
  // Place small props in the side yards, between each wall and its fence.
  // Long log piles run parallel to the wall; front/back entrance gaps stay clear.
  const slots=Math.max(1,Math.floor((dimensions.z-.6)/1.05)+1);
  for(let i=0;i<Math.min(count,slots*2);i++){
   const side=i%2===0?-1:1,slot=Math.floor(i/2);
   const x=side<0?bounds.min.x-.35:bounds.max.x+.35;
   const z=slots===1?cz:bounds.min.z+.3+slot*(dimensions.z-.6)/(slots-1);
   const kind=["barrel","crate","logPile"][Math.floor(random()*3)];
   prop(kind,x,z,random()<.5?0:Math.PI,.34+random()*.06);
  }
 }
 const owner=Array.from(world.children).find(o=>{let found=false;o.traverse(m=>{if(m.isInstancedMesh&&!m.userData.nodeSource)found=true;});return found;});
 (owner||world).add(root);
}
