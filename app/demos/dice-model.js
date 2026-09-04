import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
export function roundedDieGeometry(segments=3) { return new RoundedBoxGeometry(1,1,1,segments,.1); }

// Shared Y-up face convention. Opposite faces sum to seven.
export const faces = [
  {value:1, normal:[0,1,0]}, {value:6, normal:[0,-1,0]},
  {value:2, normal:[1,0,0]}, {value:5, normal:[-1,0,0]},
  {value:3, normal:[0,0,1]}, {value:4, normal:[0,0,-1]}
];
const patterns = {
  1:[[0,0]], 2:[[-1,-1],[1,1]], 3:[[-1,-1],[0,0],[1,1]],
  4:[[-1,-1],[-1,1],[1,-1],[1,1]],
  5:[[-1,-1],[-1,1],[0,0],[1,-1],[1,1]],
  6:[[-1,-1],[-1,0],[-1,1],[1,-1],[1,0],[1,1]]
};
export function randomFace(random = Math.random) { return 1 + Math.floor(random()*6); }
export function faceUp(quaternion, threshold = .98) {
  const ranked = faces.map(f => ({value:f.value, up:new THREE.Vector3(...f.normal).applyQuaternion(quaternion).y})).sort((a,b)=>b.up-a.up);
  return ranked[0].up >= threshold ? ranked[0].value : null;
}
export function landingRotation(value) {
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(...faces.find(f=>f.value===value).normal), new THREE.Vector3(0,1,0));
  const e = new THREE.Euler().setFromQuaternion(q, 'XYZ');
  return [e.x,e.y,e.z].map(THREE.MathUtils.radToDeg);
}
export function diceSpecs() {
  const common = {groupId:'dice-demo', groupName:'Dice', rigBoneId:'dice-root', rigRole:'armor', rigAttachment:'rigidArmor'};
  const rounded=roundedDieGeometry();
  const geometry={positions:Array.from(rounded.attributes.position.array),normals:Array.from(rounded.attributes.normal.array),uvs:Array.from(rounded.attributes.uv.array)};
  rounded.dispose();
  const specs = [{...common,id:'dice-body',name:'Rounded dice body',shape:'box',geometry,position:[0,.5,0],rotation:[0,0,0],scale:[1,1,1],color:'#f5e8cf',roughness:.3}];
  for (const face of faces) {
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(...face.normal));
    const e = new THREE.Euler().setFromQuaternion(q);
    for (const [i,xy] of patterns[face.value].entries()) {
      const p = new THREE.Vector3(xy[0]*.25,xy[1]*.25,.499).applyQuaternion(q).add(new THREE.Vector3(0,.5,0));
      specs.push({...common,id:`dice-pip-${face.value}-${i}`,name:`Face ${face.value} pip ${i+1}`,shape:'sphere',position:p.toArray(),scale:[.16,.16,.018],rotation:[e.x,e.y,e.z].map(THREE.MathUtils.radToDeg),color:'#152f3a',roughness:.55});
    }
  }
  return specs;
}
export function createDieVisual() {
  const root = new THREE.Group();
  for(const spec of diceSpecs()) {
    const geometry = spec.shape==='box' ? roundedDieGeometry() : new THREE.SphereGeometry(.55,16,10);
    const mesh = new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:spec.color,roughness:spec.roughness}));
    mesh.position.fromArray(spec.position).sub(new THREE.Vector3(0,.5,0));
    mesh.rotation.set(...(spec.rotation?.map(THREE.MathUtils.degToRad) || [0,0,0]));
    mesh.scale.fromArray(spec.scale); mesh.castShadow=true; mesh.receiveShadow=true;root.add(mesh);
  }
  return root;
}
export function createDiceProject() {
  const clips = {};
  for(let value=1;value<=6;value++) {
    const end = landingRotation(value);
    const keys = [];
    // Authored arc, not physics. Unwrapped Euler channels retain full spins.
    for(let frame=0;frame<=72;frame++) {
      const t=Math.min(frame/48,1);
      const bounce=frame>48&&frame<60 ? .18*Math.sin((frame-48)/12*Math.PI):0;
      keys.push({frame,position:[-2+2*t,.5+2.8*4*t*(1-t)+bounce,0],rotation:end.map((r,i)=>THREE.MathUtils.degToRad(r+(i===0?720:i===2?360:0))*t)});
    }
    clips[`dice-land-${value}`]={name:`Dice toss — ${value} up`,fps:24,end:72,keys:{'dice-root':keys}};
  }
  return {kind:'modeler-project',version:1,name:'BWS-die-demo',scene:{groups:[{id:'dice-demo',name:'Dice',parentId:null}],objects:diceSpecs()},editor:{projectName:'BWS-die-demo',workspace:'general',view:{cameraPosition:[4,3,5],orbitTarget:[0,1,0],showGrid:true},rigging:{tPoseFittingMode:false,showGuides:false,bones:[{id:'dice-root',name:'Dice root',position:[0,.5,0],rotation:[0,0,0],tail:[0,1,0],bindPosition:[0,.5,0],bindRotation:[0,0,0]}],animation:{activeClipId:'dice-land-1',frame:0,clips}}}};
}
