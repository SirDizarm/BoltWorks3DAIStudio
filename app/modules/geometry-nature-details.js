import { ConvexGeometry as BwsNaturalRockHull } from "three/addons/geometries/ConvexGeometry.js";
const BWS_DETAILED_NATURE_NODES=Object.freeze({
 detailedTree:{label:"Detailed Tree",source:true,fields:{treeSpecies:["Species","oak",["oak","birch","pine","spruce","tallPine","deadTree"]],treeHeight:["Height",5,1,18,.1],treeCrownWidth:["Crown width",3.6,.5,12,.1],treeFullness:["Foliage fullness",1,.4,1.8,.1],treeBarkColor:["Bark","#66503b"],treeLeafColor:["Leaves","#496b35"]}},
 detailedRock:{label:"Natural Stone",source:true,fields:{stoneStyle:["Stone type","boulder",["boulder","fieldstone","slate","crag"]],stoneSize:["Size",1.2,.2,8,.1],stoneWeathering:["Irregularity",.65,0,1,.05],stoneColor:["Stone","#747a70"]}}
});
function bwsBuildDetailedNature(type,p,{graph,nodeId,group,outputName,emit}){
 const random=geometryNodePrng(graph.seed+graph.nodeOrder.indexOf(nodeId)*7919),batches=new Map();
 function add(g,c){g.deleteAttribute("uv");const key=new THREE.Color(c).getHexString();if(!batches.has(key))batches.set(key,[]);batches.get(key).push(g);}
 function limb(a,b,r0,r1,c){const d=b.clone().sub(a),g=new THREE.CylinderGeometry(r1,r0,d.length(),8,1);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()));g.translate(...a.clone().add(b).multiplyScalar(.5).toArray());add(g,c);}
 function blob(pos,size,c){const g=new THREE.IcosahedronGeometry(1,1),v=g.attributes.position;for(let i=0;i<v.count;i++){const x=v.getX(i),y=v.getY(i),z=v.getZ(i),f=1+.12*Math.sin(x*7+y*4)*Math.cos(z*6-y*3);v.setXYZ(i,x*f*size.x,y*f*size.y,z*f*size.z);}g.computeVertexNormals();g.translate(...pos.toArray());add(g,c);}
 if(type==="detailedTree"){
  const h=p.treeHeight,w=p.treeCrownWidth,kind=p.treeSpecies,bark=new THREE.Color(kind==="birch"?"#c5c5ae":p.treeBarkColor),leaf=new THREE.Color(p.treeLeafColor);
  const shades=[-.075,-.035,0,.025,.055].map(v=>leaf.clone().offsetHSL(0,-.025,v)),bend=(random()-.5)*h*.08;
  const at=t=>new THREE.Vector3(bend*t*t,h*t,Math.sin(t*3)*h*.014),radius=h*(kind==="birch"?.019:.035);

  for(let i=0;i<9;i++){
   const t=i/9;
   limb(at(t),at((i+1)/9),radius*(1-t*.92),radius*(1-(i+1)/9*.92),bark);
  }
  if(kind==="birch"){
   // Small scars lie on individual trunk faces, never around the circumference.
   for(let i=0;i<36;i++){
    const t=.035+random()*.84,segment=Math.floor(t*9),u=t*9-segment;
    const a=at(segment/9),b=at((segment+1)/9),axis=b.clone().sub(a).normalize();
    const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),axis);
    const angle=(Math.floor(random()*8)+.5)*Math.PI/4;
    const normal=new THREE.Vector3(Math.sin(angle),0,Math.cos(angle)).applyQuaternion(q);
    const tangent=new THREE.Vector3(Math.cos(angle),0,-Math.sin(angle)).applyQuaternion(q);
    const r=radius*(1-t*.92),width=r*(.22+random()*.36),height=h*(.0025+random()*.005);
    const center=a.clone().lerp(b,u).addScaledVector(normal,r*Math.cos(Math.PI/8)+.0015);
    const outline=[[-.5,-.35],[-.28,-.52],[.5,-.24],[.36,.4],[-.16,.52],[-.48,.15]];
    const positions=[];
    for(let j=0;j<outline.length;j++){
     for(const xy of [[0,0],outline[j],outline[(j+1)%outline.length]]){
      const point=center.clone().addScaledVector(tangent,xy[0]*width).addScaledVector(axis,xy[1]*height);
      positions.push(...point.toArray());
     }
    }
    const mark=new THREE.BufferGeometry();mark.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
    // Face toward the outward trunk normal regardless of the chosen face.
    const pa=new THREE.Vector3().fromArray(positions,0),pb=new THREE.Vector3().fromArray(positions,3),pc=new THREE.Vector3().fromArray(positions,6);
    if(pb.sub(pa).cross(pc.sub(pa)).dot(normal)<0){for(let j=0;j<positions.length;j+=9)for(let k=0;k<3;k++){const v=positions[j+3+k];positions[j+3+k]=positions[j+6+k];positions[j+6+k]=v;}mark.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));}
    mark.computeVertexNormals();add(mark,i%4===0?"#555347":"#302e29");
   }
  }
  if(kind!=="birch")for(let i=0;i<5;i++){const a=i*Math.PI*2/5;limb(new THREE.Vector3(Math.cos(a)*radius*2.7,.018,Math.sin(a)*radius*2.7),at(.1),radius*.3,radius*.66,bark);}
  if(["pine","spruce","tallPine"].includes(kind)){
   const tall=kind==="tallPine",spruce=kind==="spruce",tiers=spruce?10:tall?5:7;
   const bottom=tall?.65:spruce?.18:.22;
   for(let tier=0;tier<tiers;tier++){
    const t=bottom+tier*(.94-bottom)/tiers,r=w*.5*(1-tier/(tiers+.3))*(tall?.74:1),center=at(t);
    const phase=tier*2.399+random()*.2,segments=10;
    const points=[];
    // Jagged, broad skirts and asymmetric peaks create a readable low-poly silhouette.
    const peak=center.clone().add(new THREE.Vector3(h*.013*(random()-.5),h*(spruce?.18:.22),0));
    const ring=[];
    for(let j=0;j<segments;j++){const a=j*Math.PI*2/segments+phase,rr=r*(.86+random()*.18);ring.push(center.clone().add(new THREE.Vector3(Math.cos(a)*rr,-h*(.008+random()*.025),Math.sin(a)*rr)));}
    for(let j=0;j<segments;j++){
     const a=ring[j],b=ring[(j+1)%segments];
     points.push(...peak.toArray(),...b.toArray(),...a.toArray());
     points.push(...center.clone().add(new THREE.Vector3(0,-h*.045,0)).toArray(),...a.toArray(),...b.toArray());
    }
    const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(points,3));g.computeVertexNormals();add(g,shades[tier%5]);
   }
   if(tall||spruce)for(let i=0;i<(tall?15:7);i++){
    const t=.23+random()*(tall?.39:.4),a=i*2.399,len=w*(.12+random()*.13),start=at(t);
    const end=start.clone().add(new THREE.Vector3(Math.cos(a)*len,-h*.045,Math.sin(a)*len));
    limb(start,end,radius*.18,radius*.016,bark);
    const fork=start.clone().lerp(end,.7);limb(fork,end.clone().add(new THREE.Vector3(-Math.sin(a)*len*.2,h*.045,Math.cos(a)*len*.2)),radius*.07,radius*.008,bark);
   }
  }else{
   const dead=kind==="deadTree",birch=kind==="birch",count=dead?8:birch?9:10;
   for(let i=0;i<count;i++){
    const fraction=i/count,angle=i*2.39996+(random()-.5)*.4,t=(birch?.49:.42)+fraction*.39;
    const spread=w*(birch?.33:.45)*(1-fraction*.48)*(.85+random()*.18);
    const start=at(t),elbow=start.clone().add(new THREE.Vector3(Math.cos(angle)*spread*.45,h*.085,Math.sin(angle)*spread*.45));
    const end=elbow.clone().add(new THREE.Vector3(Math.cos(angle)*spread*.55,h*(.06+random()*.07),Math.sin(angle)*spread*.55));
    limb(start,elbow,radius*.46,radius*.23,bark);limb(elbow,end,radius*.23,radius*.055,bark);
    for(let j=0;j<3;j++){
     const a=angle+(j-1)*.8,tip=end.clone().add(new THREE.Vector3(Math.cos(a)*w*.1,h*.035,Math.sin(a)*w*.1));
     limb(elbow,tip,radius*.12,radius*.008,bark);
     if(dead){const twig=tip.clone().add(new THREE.Vector3(Math.cos(a+.6)*w*.06,h*.04,Math.sin(a+.6)*w*.06));limb(end.clone().lerp(tip,.6),twig,radius*.045,radius*.003,bark);continue;}
     const n=Math.max(1,Math.round(2*p.treeFullness));
     for(let k=0;k<n;k++){
      const a2=random()*Math.PI*2,s=w*(birch?.155:.18)*(.85+random()*.3);
      const pos=tip.clone().add(new THREE.Vector3(Math.cos(a2)*w*.08,(random()-.5)*h*.055,Math.sin(a2)*w*.08));
      blob(pos,new THREE.Vector3(s,s*(birch?1.22:.83),s*.91),shades[(i+j+k)%5]);
     }
    }
   }
   if(!dead)for(let i=0;i<5;i++){const a=i*2.399,r=w*.13,s=w*.19;blob(at(.94).add(new THREE.Vector3(Math.cos(a)*r,(random()-.5)*h*.04,Math.sin(a)*r)),new THREE.Vector3(s,s*(birch?1.2:.85),s),shades[i]);}
  }

 }else{
  const s=p.stoneSize,style=p.stoneStyle,rough=p.stoneWeathering;
  const sx=s*(.85+random()*.45),sy=s*(style==="crag"?.7+random()*.3:style==="slate"?.16+random()*.1:style==="fieldstone"?.3+random()*.16:.45+random()*.24),sz=s*(.65+random()*.4);
  const points=[],lobes=Array.from({length:5},()=>({direction:new THREE.Vector3(random()-.5,random()-.5,random()-.5).normalize(),strength:(random()-.45)*.35})),phase=random()*6.28;
  const number=style==="slate"?36:style==="crag"?42:58,lean=(random()-.5)*.28;
  for(let i=0;i<number;i++){
   const y=1-2*(i+.5)/number,angle=i*2.399963+phase+(random()-.5)*.3,r=Math.sqrt(1-y*y),direction=new THREE.Vector3(Math.cos(angle)*r,y,Math.sin(angle)*r);
   let shape=1;for(const lobe of lobes)shape+=rough*lobe.strength*Math.pow(Math.max(0,direction.dot(lobe.direction)),2);
   shape+=rough*(random()-.5)*.13;
   const x=direction.x*shape,z=direction.z*shape,yy=Math.max(-.48,direction.y*shape);
   points.push(new THREE.Vector3((x+yy*lean)*sx,yy*sy,(z+x*.07*rough)*sz));
  }
  // A hull over irregular support points gives closed weathered faces, not
  // latitude bands, stretched pyramids or separately stacked rock layers.
  const g=new BwsNaturalRockHull(points);g.rotateY(random()*Math.PI*2);g.computeBoundingBox();g.translate(0,-g.boundingBox.min.y,0);const v=g.attributes.position;
  const c=new THREE.Color(p.stoneColor),buckets=Array.from({length:5},()=>[]);
  for(let i=0;i<v.count;i+=3){const band=Math.min(4,Math.floor(random()*5));for(let k=0;k<3;k++)buckets[band].push(v.getX(i+k),v.getY(i+k),v.getZ(i+k));}
  buckets.forEach((positions,i)=>{if(!positions.length)return;const part=new THREE.BufferGeometry();part.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));part.computeVertexNormals();add(part,c.clone().offsetHSL(0,0,(i-2)*.012));});g.dispose();
 }
 let count=0;for(const [color,geometries]of batches){const merged=mergeGeometries(geometries,false);for(const g of geometries)g.dispose();if(!merged)continue;emit(geometryNodeCustomSpec(merged,{name:outputName+" "+(type==="detailedTree"?p.treeSpecies:p.stoneStyle)+" "+(++count),position:[p.assetOffsetX,p.assetOffsetY,p.assetOffsetZ],color:"#"+color,roughness:.93,group,graph,targetId:nodeId}));}return count;
}
function bwsEnsureDetailedNaturePresets(role,seed){
 const recipes=role==="tree"?[["Oak","oak",3.6,"#627534"],["Birch","birch",2.8,"#789048"],["Pine","pine",3.3,"#687330"],["Spruce","spruce",3.2,"#46633b"],["Tall Pine","tallPine",2.8,"#687330"],["Dead Tree","deadTree",3.2,"#496b35"]]:[["Boulder","boulder"],["Fieldstone","fieldstone"],["Slate","slate"],["Crag","crag"]];let first=null;
 for(const [label,style,width,color]of recipes){const name="Scene "+label+" nodes";let graph=geometryNodeProjectState.graphs.find(g=>g.name===name);
  if(!graph&&geometryNodeProjectState.graphs.length<24){graph=defaultGeometryNodeGraph(name);graph.seed=seed+(role==="tree"?101:307);graph.centerOutput=true;const type=role==="tree"?"detailedTree":"detailedRock";graph.nodeOrder=["seed",type,"output"];graph.smoothNodes=[];graph.generatedIds=[];
   graph.connections=graph.nodeOrder.slice(1).map((id,i)=>({id:geometryNodeId("link"),fromNodeId:graph.nodeOrder[i],toNodeId:id,toInputIndex:0}));
   graph.nodePositions=Object.fromEntries(graph.nodeOrder.map((id,i)=>[id,{x:50+i*260,y:50}]));
   Object.assign(graph.params,{outputName:name},role==="tree"?{treeSpecies:style,treeCrownWidth:width,treeLeafColor:color}:{stoneStyle:style});graph.nodeParams={};geometryNodeProjectState.graphs.push(graph);
  }if(!first&&graph)first=graph;
 }
 if(!first)throw new Error("The graph library is full. Free a graph slot to add detailed nature presets.");
 saveGeometryNodeDraft();renderGeometryNodeEditor();return first.id;
}
