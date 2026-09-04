import * as THREE from 'three';
import {ConvexGeometry} from 'three/addons/geometries/ConvexGeometry.js';
import {roundedDieGeometry,faces as standardFaces} from './dice-model.js';
export const diceTypes=['dice',4,6,8,10,12,20,'coin'];
export const typeLabel=type=>type==='dice'?'Dice (dots)':type==='coin'?'BW coin':`D${type}`;
export function validateHand(types){if(!Array.isArray(types)||types.length<1||types.length>8||types.some(t=>!diceTypes.includes(t)))throw new Error('Choose 1–8 dice of types D4, D6, D8, D10, D12 or D20.');return [...types];}
export function polygonData(geometry){
  const g=geometry.index?geometry.toNonIndexed():geometry,p=g.attributes.position;
  const vertices=[],lookup=new Map(),ids=[],planes=new Map();
  for(let i=0;i<p.count;i++){const point=new THREE.Vector3().fromBufferAttribute(p,i),key=point.toArray().map(v=>v.toFixed(6)).join(',');if(!lookup.has(key)){lookup.set(key,vertices.length);vertices.push(point);}ids.push(lookup.get(key));}
  for(let i=0;i<ids.length;i+=3){const tri=ids.slice(i,i+3);if(new Set(tri).size!==3)continue;const [a,b,c]=tri.map(id=>vertices[id]),normal=b.clone().sub(a).cross(c.clone().sub(a)).normalize();const key=[...normal.toArray(),normal.dot(a)].map(v=>(Math.abs(v)<.00005?0:v).toFixed(4)).join(',');if(!planes.has(key))planes.set(key,{normal,ids:new Set()});tri.forEach(id=>planes.get(key).ids.add(id));}
  const faces=[...planes.values()].map(plane=>{const ids=[...plane.ids],center=ids.reduce((c,id)=>c.add(vertices[id]),new THREE.Vector3()).divideScalar(ids.length),u=vertices[ids[0]].clone().sub(center).normalize(),v=plane.normal.clone().cross(u);ids.sort((a,b)=>{const pa=vertices[a].clone().sub(center),pb=vertices[b].clone().sub(center);return Math.atan2(pa.dot(v),pa.dot(u))-Math.atan2(pb.dot(v),pb.dot(u));});return {indices:ids,normal:plane.normal,center};});
  if(g!==geometry)g.dispose();return {vertices,faces};
}
export function polyDefinition(type){
  let geometry;
  if(type===4)geometry=new THREE.TetrahedronGeometry(.78);
  else if(type===6)geometry=new THREE.BoxGeometry(1,1,1);
  else if(type==='coin')geometry=new THREE.CylinderGeometry(.55,.55,.09,32);
  else if(type===8)geometry=new THREE.OctahedronGeometry(.76);
  else if(type===12)geometry=new THREE.DodecahedronGeometry(.72);
  else if(type===20)geometry=new THREE.IcosahedronGeometry(.75);
  else if(type===10){
    const H=.85,h=H*(1-Math.cos(Math.PI/5))/(1+Math.cos(Math.PI/5));
    const points=[new THREE.Vector3(0,H,0),new THREE.Vector3(0,-H,0)];
    for(let i=0;i<10;i++)points.push(new THREE.Vector3(.7*Math.cos(i*Math.PI/5),i%2?-h:h,.7*Math.sin(i*Math.PI/5)));
    geometry=new ConvexGeometry(points);
  }else throw new Error('Unsupported polyhedral dice');
  const data=polygonData(geometry);
  if(type!=='coin'&&data.faces.length!==type)throw new Error(`D${type} has ${data.faces.length} faces`);
  data.faces.forEach((f,i)=>f.value=type===6?standardFaces.find(s=>new THREE.Vector3(...s.normal).dot(f.normal)>.99).value:i+1);
  const outcomes=type==='coin'?[{value:1,direction:new THREE.Vector3(0,1,0)},{value:2,direction:new THREE.Vector3(0,-1,0)}]:type===4?data.vertices.map((v,i)=>({value:i+1,direction:v.clone().normalize()})):data.faces.map(f=>({value:f.value,direction:f.normal.clone()}));
  if(type===6){geometry.dispose();geometry=roundedDieGeometry();}
  let collision=null;
  if(type!==6&&type!=='coin'){
    // Inset each face corner before rebuilding the convex surface. This
    // preserves the numbered planes but adds narrow edge/corner bevels.
    const points=data.faces.flatMap(f=>f.indices.map(id=>data.vertices[id].clone().lerp(f.center,.09)));
    geometry.dispose();geometry=new ConvexGeometry(points);collision=polygonData(geometry);
  }
  return {...data,geometry,outcomes,type,collision};
}
export function polyResult(def,q){const sorted=def.outcomes.map(o=>({value:o.value,up:o.direction.clone().applyQuaternion(q).y})).sort((a,b)=>b.up-a.up);return sorted[0].up>=.975?sorted[0].value:null;}
function numberMaterial(value){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d');ctx.clearRect(0,0,256,256);ctx.fillStyle='#fff4ce';ctx.font='bold 210px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(value),128,131,244);if(value===6||value===9)ctx.fillRect(88,231,80,9);
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;return new THREE.MeshBasicMaterial({map,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
}
export function polyVisual(def,color){
  if(def.type==='coin')return coinVisual(def);
  const root=new THREE.Group(),body=new THREE.Mesh(def.geometry,new THREE.MeshStandardMaterial({color,roughness:.35,metalness:.12,flatShading:true}));body.castShadow=body.receiveShadow=true;root.add(body);
  if(typeof document!=='undefined')for(const face of def.faces){
    const labels=def.type===4?face.indices.map(id=>({value:id+1,position:face.center.clone().lerp(def.vertices[id],.42),size:.29,up:def.vertices[id].clone().sub(face.center).normalize()})):[{value:face.value,position:face.center,size:def.type===20?.43:def.type===10?.47:def.type===6?.65:.57}];
    for(const label of labels){const m=new THREE.Mesh(new THREE.PlaneGeometry(label.size,label.size),numberMaterial(label.value));m.name=`Number ${label.value}`;m.position.copy(label.position).addScaledVector(face.normal,.008);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),face.normal);if(label.up){const right=label.up.clone().cross(face.normal).normalize();m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,label.up,face.normal));}root.add(m);}
  }
  return root;
}
function coinVisual(def){
  const root=new THREE.Group(),body=new THREE.Mesh(def.geometry,new THREE.MeshStandardMaterial({color:'#d9a83d',metalness:.72,roughness:.33}));body.castShadow=body.receiveShadow=true;root.add(body);
  if(typeof document!=='undefined'&&typeof __BWS_COIN_ART__!=='undefined'){
    // UV windows select the orthographic faces of the unchanged reference sheet.
    for(const [side,y,cx] of [['HEADS',1,337],['TAILS',-1,1191]]){
      const map=new THREE.TextureLoader().load(__BWS_COIN_ART__);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;
      map.repeat.set(496/1536,496/1024);map.offset.set((cx-248)/1536,(1024-289-248)/1024);
      const face=new THREE.Mesh(new THREE.CircleGeometry(.538,64),new THREE.MeshStandardMaterial({map,metalness:.15,roughness:.55}));face.name=side;face.rotation.x=y===1?-Math.PI/2:Math.PI/2;face.position.y=y*.046;root.add(face);
      const rim=new THREE.Mesh(new THREE.TorusGeometry(.538,.009,8,64),body.material);rim.name='Raised gold rim';rim.rotation.x=Math.PI/2;rim.position.y=y*.036;root.add(rim);
    }
    for(let i=0;i<48;i++){const a=i*Math.PI/24,ridge=new THREE.Mesh(new THREE.BoxGeometry(.007,.071,.005),body.material);ridge.name='Reeded coin edge';ridge.position.set(Math.sin(a)*.55,0,Math.cos(a)*.55);ridge.rotation.y=a;root.add(ridge);}
    return root;
  }
  if(typeof document!=='undefined')for(const [side,y] of [['HEADS',1],['TAILS',-1]]){const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const ctx=canvas.getContext('2d');ctx.fillStyle=side==='HEADS'?'#efc86c':'#cda34c';ctx.fillRect(0,0,512,512);ctx.strokeStyle='#795016';ctx.lineWidth=9;for(const r of [230,214]){ctx.beginPath();ctx.arc(256,256,r,0,Math.PI*2);ctx.stroke();}ctx.fillStyle='#604019';ctx.textAlign='center';ctx.font='bold 156px Georgia';ctx.fillText('BW',256,282);ctx.font='bold 52px Arial';ctx.fillText(side,256,363);const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;const face=new THREE.Mesh(new THREE.CircleGeometry(.535,48),new THREE.MeshStandardMaterial({map,metalness:.45,roughness:.45}));face.name=side;face.rotation.x=y===1?-Math.PI/2:Math.PI/2;face.position.y=y*.046;root.add(face);}
  return root;
}
