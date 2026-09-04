import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import {createDieVisual,faceUp,roundedDieGeometry} from './dice-model.js';
import {polyDefinition,polyVisual,polyResult,validateHand} from './dice-polyhedra.js';
import {addTabletop,woodMaterial,addTrayLogo} from './dice-tabletop.js';
import {feltMaterial} from './dice-ornate-table.js';

// Low-resolution rounded hull, welded to remove duplicate vertices.
export function roundedDieCollider() {
  const geometry=roundedDieGeometry(1), p=geometry.attributes.position;
  const vertices=[],faces=[],lookup=new Map(),ids=[],planes=new Map();
  for(let i=0;i<p.count;i++){
    const point=[p.getX(i),p.getY(i),p.getZ(i)],key=point.map(v=>v.toFixed(6)).join(',');
    if(!lookup.has(key)){lookup.set(key,vertices.length);vertices.push(new CANNON.Vec3(...point));}
    ids.push(lookup.get(key));
  }
  for(let i=0;i<ids.length;i+=3){
    const tri=ids.slice(i,i+3);if(new Set(tri).size!==3)continue;
    const [a,b,c]=tri.map(id=>new THREE.Vector3(...vertices[id].toArray()));
    const normal=b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    const key=[...normal.toArray(),normal.dot(a)].map(v=>v.toFixed(4)).join(',');
    if(!planes.has(key))planes.set(key,{normal,ids:new Set()});
    tri.forEach(id=>planes.get(key).ids.add(id));
  }
  // Cannon clips whole polygons. Coplanar triangle seams produce unstable
  // support contacts, so merge each plane into one outward-wound polygon.
  for(const plane of planes.values()){
    const ids=[...plane.ids],center=new THREE.Vector3();
    ids.forEach(id=>center.add(new THREE.Vector3(...vertices[id].toArray())));center.divideScalar(ids.length);
    const u=new THREE.Vector3(...vertices[ids[0]].toArray()).sub(center).normalize();
    const v=plane.normal.clone().cross(u);
    ids.sort((a,b)=>{const pa=new THREE.Vector3(...vertices[a].toArray()).sub(center),pb=new THREE.Vector3(...vertices[b].toArray()).sub(center);return Math.atan2(pa.dot(v),pa.dot(u))-Math.atan2(pb.dot(v),pb.dot(u));});
    faces.push(ids);
  }
  geometry.dispose();return new CANNON.ConvexPolyhedron({vertices,faces});
}
export function createDicePhysics({random=Math.random,onResult=()=>{},types=[6]}={}) {
  const scene=new THREE.Scene();scene.background=new THREE.Color('#10242f');
  const camera=new THREE.PerspectiveCamera(40,1,.1,100);camera.position.set(10,12,14);camera.lookAt(0,.5,0);
  scene.add(new THREE.HemisphereLight(0xe9f7ff,0x243e37,2.5));
  const light=new THREE.DirectionalLight(0xffecd0,3);light.position.set(-3,9,5);light.castShadow=true;
  light.shadow.mapSize.set(1024,1024);Object.assign(light.shadow.camera,{left:-7,right:7,top:7,bottom:-7});scene.add(light);
  const world=new CANNON.World({gravity:new CANNON.Vec3(0,-9.81,0),allowSleep:true});
  world.defaultContactMaterial.friction=.35;world.defaultContactMaterial.restitution=.22;world.solver.iterations=20;
  const props=[];const decorations=addTabletop(scene);
  function mesh(geometry,color){const m=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color,roughness:.5}));m.castShadow=true;m.receiveShadow=true;return m;}
  function box(size,position,color,mass=0,name='') {
    const body=new CANNON.Body({mass,shape:new CANNON.Box(new CANNON.Vec3(...size.map(v=>v/2))),position:new CANNON.Vec3(...position),allowSleep:true,sleepTimeLimit:.8});world.addBody(body);
    const visual=mesh(new THREE.BoxGeometry(...size),color);visual.position.fromArray(position);scene.add(visual);
    if(name==='wooden block'){visual.material.dispose();visual.material=[woodMaterial(true),woodMaterial(),woodMaterial(),woodMaterial(),woodMaterial(),woodMaterial()];}
    if(name==='tray felt'){visual.material.dispose();visual.material=feltMaterial();}
    if(mass)props.push({name,body,visual,start:position,hits:0});return body;
  }
  box([12,.4,10],[0,-.2,0],0x225d53,0,'tray felt');
  addTrayLogo(scene);
  for(const [s,p] of [[[.3,2,10],[-6,1,0]],[[.3,2,10],[6,1,0]],[[12,2,.3],[0,1,-5]],[[12,2,.3],[0,1,5]]])box(s,p,0x31424c);
  box([1.2,.6,1.2],[2,.3,-1.4],0xc39a58,.45,'wooden block');
  // Compound pawn: wide base, tapered stem, collar and spherical head.
  const pawn=new CANNON.Body({mass:.35,position:new CANNON.Vec3(1,.8,.15),allowSleep:true,sleepTimeLimit:.8});
  const pawnVisual=new THREE.Group();
  const sections=[{rt:.39,rb:.44,h:.18,y:-.71},{rt:.18,rb:.32,h:.68,y:-.28},{rt:.29,rb:.2,h:.12,y:.12}];
  for(const s of sections){pawn.addShape(new CANNON.Cylinder(s.rt,s.rb,s.h,12),new CANNON.Vec3(0,s.y,0));const m=mesh(new THREE.CylinderGeometry(s.rt,s.rb,s.h,32),0xe9d7b9);m.position.y=s.y;pawnVisual.add(m);}
  pawn.addShape(new CANNON.Sphere(.27),new CANNON.Vec3(0,.45,0));
  const head=mesh(new THREE.SphereGeometry(.27,24,16),0xe9d7b9);head.position.y=.45;pawnVisual.add(head);
  world.addBody(pawn);scene.add(pawnVisual);props.push({name:'chess pawn',body:pawn,visual:pawnVisual,start:[1,.8,.15],hits:0});
  for(let i=0;i<3;i++)box([.18,1.1,.5],[3+i*.55,.55,.35],[0x55b6ba,0xdd7960,0xe3ba67][i],.16,'domino '+(i+1));
  let dice=[],elapsed=0,state='ready',shakeRemaining=0,topView=false,cleanBox=false;
  const colors=[0x3266a0,0x9b374b,0x389475,0x985aa7,0xb67428,0x397e8b,0xad476e,0x5965a5];
  function disposeVisual(root){root.traverse(o=>{o.geometry?.dispose();for(const m of (Array.isArray(o.material)?o.material:[o.material]).filter(Boolean)){m.map?.dispose();m.dispose();}});}
  function resetBody(b,position){b.position.set(...position);b.quaternion.set(0,0,0,1);b.velocity.setZero();b.angularVelocity.setZero();b.force.setZero();b.torque.setZero();b.aabbNeedsUpdate=true;b.wakeUp();}
  function sync(){for(const d of dice){d.visual.position.copy(d.body.position);d.visual.quaternion.copy(d.body.quaternion);}for(const p of props){p.visual.position.copy(p.body.position);p.visual.quaternion.copy(p.body.quaternion);}}
  function snapshot(){const results=dice.map(d=>({type:d.type,result:d.result,nudges:d.nudges,position:d.body.position.toArray(),quaternion:[d.body.quaternion.x,d.body.quaternion.y,d.body.quaternion.z,d.body.quaternion.w]}));return {state,result:results.length===1?results[0].result:null,total:results.every(d=>d.result!==null)&&results.some(d=>d.type!=='coin')?results.filter(d=>d.type!=='coin').reduce((sum,d)=>sum+d.result,0):null,dice:results,elapsed,contacts:dice.reduce((n,d)=>n+d.contacts,0),nudges:dice.reduce((n,d)=>n+d.nudges,0),position:results[0].position,quaternion:results[0].quaternion,props:props.map(p=>({name:p.name,hits:p.hits,position:p.body.position.toArray(),upright:new THREE.Vector3(0,1,0).applyQuaternion(p.visual.quaternion).y}))};}
  function notify(){onResult(snapshot());}
  function clearRest(d){d.restPosition=d.body.position.clone();d.restQuaternion=d.body.quaternion.clone();d.restTime=0;d.reportPosition=null;d.reportQuaternion=null;}
  function moved(body,position,quaternion,distance,angle){const q=body.quaternion,dot=q.x*quaternion.x+q.y*quaternion.y+q.z*quaternion.z+q.w*quaternion.w;return body.position.distanceTo(position)>distance||2*Math.acos(Math.min(1,Math.abs(dot)))>angle;}
  function resetDice(){for(const [i,d] of dice.entries()){resetBody(d.body,[-3+(i%4)*1.7,1,Math.floor(i/4)*1.8-1]);d.body.sleep();d.result=null;d.nudges=0;d.contacts=0;}elapsed=0;state='ready';}
  function reset(){decorations.userData.liquid?.reset();shakeRemaining=0;resize(camera.aspect);resetDice();for(const p of props){resetBody(p.body,p.start);p.body.sleep();p.hits=0;}sync();}
  function configure(hand){
    validateHand(hand);for(const d of dice){world.removeBody(d.body);scene.remove(d.visual);disposeVisual(d.visual);}
    dice=hand.map((type,i)=>{const def=type==='dice'?null:polyDefinition(type),hull=def?.collision||def,shape=type==='coin'?new CANNON.Cylinder(.55,.55,.09,32):type===6||type==='dice'?roundedDieCollider():def?new CANNON.ConvexPolyhedron({vertices:hull.vertices.map(v=>new CANNON.Vec3(...v.toArray())),faces:hull.faces.map(f=>f.indices)}):roundedDieCollider();
      const body=new CANNON.Body({mass:type==='coin'?.2:1,shape,linearDamping:.12,angularDamping:.12,allowSleep:true,sleepSpeedLimit:.1,sleepTimeLimit:.8});
      const visual=def?polyVisual(def,colors[i]):createDieVisual();scene.add(visual);world.addBody(body);
      const d={type,def,body,visual,result:null,nudges:0,contacts:0};clearRest(d);body.addEventListener('collide',()=>d.contacts++);return d;});
    reset();return snapshot();
  }
  for(const p of props)p.body.addEventListener('collide',event=>{if(dice.some(d=>d.body===event.body))p.hits++;});
  function roll(){resetDice();for(const [i,d] of dice.entries()){const b=d.body;
    if(dice.length===1){b.position.set(-2+random(),3.5+random(),random()-.5);b.quaternion.setFromEuler(random()*6.28,random()*6.28,random()*6.28);b.velocity.set(2+random()*2,1+random()*2,(random()-.5)*3);}
    else{b.position.set(-3+(i%2)*1.7+random()*.2,3.5+Math.floor(i/4)*1.7,Math.floor(i/2)%2*2-1+random()*.2);b.quaternion.setFromEuler(random()*6.28,random()*6.28,random()*6.28);b.velocity.set(2+random()*2,1+random(),(random()-.5)*2);}
    b.angularVelocity.set((random()-.5)*18,(random()-.5)*18,(random()-.5)*18);b.wakeUp();clearRest(d);}state='rolling';sync();}
  function step(dt){
    decorations.userData.liquid?.step(dt);
    if(shakeRemaining>0){shakeRemaining=Math.max(0,shakeRemaining-Math.min(Math.max(dt,0),.1));resize(camera.aspect);}
    if(state==='ready')return;world.step(1/120,Math.min(Math.max(dt,0),.1),12);sync();
    const delta=Math.min(Math.max(dt,0),.1);elapsed+=delta;
    // Solver wake/sleep flags can chatter at the tray rim. Only actual
    // displacement invalidates a reported result, never a wake flag alone.
    if(state!=='rolling'&&elapsed<25&&dice.some(d=>d.reportPosition&&moved(d.body,d.reportPosition,d.reportQuaternion,.06,.12))){state='rolling';for(const d of dice){d.result=null;clearRest(d);}notify();}
    if(state!=='rolling')return;
    let allRest=true;
    for(const d of dice){
      if(moved(d.body,d.restPosition,d.restQuaternion,.012,.025)){d.restPosition.copy(d.body.position);d.restQuaternion.copy(d.body.quaternion);d.restTime=0;}else d.restTime+=delta;
      if(d.restTime<.9){d.result=null;allRest=false;continue;}
      d.result=d.def?polyResult(d.def,d.visual.quaternion):faceUp(d.visual.quaternion);
      // A sleeping die may be supported by a pawn or another die. Reading an
      // ambiguous face must not wake it or inject energy into the pile.
      // Leave it untouched and report a cocked result for a manual reroll.
    }
    if(allRest||elapsed>25){state=dice.every(d=>d.result!==null)?'settled':'cocked';for(const d of dice){d.reportPosition=d.body.position.clone();d.reportQuaternion=d.body.quaternion.clone();}notify();}
  }
  function dispose(){disposeVisual(scene);light.shadow.dispose();}
  configure(types);
  function resize(aspect){camera.aspect=aspect;const fit=Math.max(1,1.3/aspect),jolt=Math.sin(shakeRemaining*65)*shakeRemaining*.2;camera.up.set(0,topView?0:1,topView?-1:0);if(topView)camera.position.set(jolt,23*fit,jolt);else camera.position.set(10*fit+jolt,12*fit+jolt*.6,14*fit);camera.lookAt(0,.5,0);camera.updateProjectionMatrix();}
  function setTopView(value){topView=!!value;resize(camera.aspect);return topView;}
  function setCleanBox(value){value=!!value;if(value===cleanBox)return cleanBox;cleanBox=value;for(const p of props){p.visual.visible=!value;if(value)world.removeBody(p.body);else{resetBody(p.body,p.start);world.addBody(p.body);}}if(state!=='ready'){elapsed=0;state='rolling';for(const d of dice){d.result=null;d.body.wakeUp();clearRest(d);}}sync();notify();return cleanBox;}
  // User-triggered only. A brief whole-table jolt, not a forced reroll or
  // automatic attempt to turn unreadable faces into a chosen outcome.
  function shake(){if(shakeRemaining>0)return false;shakeRemaining=.45;elapsed=0;state='rolling';
    decorations.userData.liquid?.hit();
    for(const d of dice){d.result=null;clearRest(d);}
    for(const body of [...dice.map(d=>d.body),...(cleanBox?[]:props.map(p=>p.body))]){body.wakeUp();body.applyImpulse(new CANNON.Vec3((.7-body.position.x*.16)*body.mass,2.2*body.mass,(-.45-body.position.z*.16)*body.mass),new CANNON.Vec3((random()-.5)*.12,0,(random()-.5)*.12));}
    notify();return true;
  }
  function setDecorationsVisible(value){decorations.visible=!!value;return decorations.visible;}
  return {scene,camera,resize,roll,reset,configure,step,shake,setTopView,setCleanBox,setDecorationsVisible,dispose,snapshot};
}
