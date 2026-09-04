import * as THREE from 'three';
import {createGobletLiquid} from './dice-goblet-liquid.js';

function canvasMap(draw,size=1024){
  if(typeof document==='undefined')return null;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
  const c=canvas.getContext('2d');draw(c,size);
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;return map;
}
function grain(c,n){
  c.fillStyle='#492719';c.fillRect(0,0,n,n);
  for(let p=0;p<8;p++){
    const y=p*n/8;c.fillStyle=['#633522','#75432b','#532b1c','#805037'][p%4];c.fillRect(0,y,n,n/8);
    c.save();c.beginPath();c.rect(0,y,n,n/8);c.clip();
    for(let i=0;i<85;i++){c.strokeStyle=i%3?'#dc98602b':'#1b100f60';c.lineWidth=i%7===0?2.5:1;c.beginPath();
      for(let x=0;x<=n;x+=8){const yy=y+i*n/640+Math.sin(x*.012+p*3+i*.05)*7+Math.sin(x*.037+i)*2;x?c.lineTo(x,yy):c.moveTo(x,yy);}c.stroke();}
    c.restore();c.fillStyle='#140e0b80';c.fillRect(0,y,n,2);
  }
}
function goldPath(c,points,fill=false){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();if(fill)c.fill();else c.stroke();}
function inlay(c,n){
  c.strokeStyle='#e7bf70';c.fillStyle='#e7bf70';c.lineWidth=3;
  for(const m of [22,30,78,86])c.strokeRect(m,m,n-2*m,n-2*m);
  const mid=n/2;
  for(const r of [350,365,383]){c.beginPath();c.arc(mid,mid,r,0,Math.PI*2);c.stroke();}
  for(let i=0;i<8;i++){const a=i*Math.PI/4,point=(r,b=a)=>[mid+Math.sin(b)*r,mid+Math.cos(b)*r];
    goldPath(c,[point(470),point(140,a+.11),point(210),point(140,a-.11)]);
    goldPath(c,[point(470),point(140,a+.11),point(210)],true);
  }
  for(const [x,y] of [[58,58],[n-58,58],[58,n-58],[n-58,n-58]])for(const r of [23,35])goldPath(c,[[x,y-r],[x+r,y],[x,y+r],[x-r,y]]);
}
export function ornateWoodMaterial(panel=false){
  const map=canvasMap((c,n)=>{grain(c,n);if(!panel)inlay(c,n);else{
    c.strokeStyle='#d9b76e';c.lineWidth=8;for(const y of [64,106,n-106,n-64]){c.beginPath();c.moveTo(0,y);c.lineTo(n,y);c.stroke();}
    c.lineWidth=5;for(const x of [65,n-65])for(const r of [40,62])goldPath(c,[[x,512-r*4],[x+r,512],[x,512+r*4],[x-r,512]]);
    goldPath(c,[[512,265],[546,512],[512,759],[478,512]]);
  }});
  return new THREE.MeshStandardMaterial({map,color:map?'#ffffff':'#633b24',roughness:.48,metalness:.07});
}
export function feltMaterial(){
  const map=canvasMap((c,n)=>{c.fillStyle='#20594b';c.fillRect(0,0,n,n);let seed=319;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};for(let i=0;i<45000;i++){const x=random()*n,y=random()*n;c.fillStyle=i%2?'#c4e0b509':'#071e190d';c.fillRect(x,y,1,2);}},512);
  return new THREE.MeshStandardMaterial({map,color:map?'#ffffff':'#20594b',roughness:1});
}
function add(parent,name,geometry,material,position=[0,0,0]){const m=new THREE.Mesh(geometry,material);m.name=name;m.position.set(...position);m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
export function addOrnateTable(scene){
  const root=new THREE.Group();root.name='Inlaid tournament table';scene.add(root);
  const dark=new THREE.MeshStandardMaterial({color:'#321d16',roughness:.48});
  add(root,'Solid walnut table',new THREE.BoxGeometry(19,.55,16),dark,[0,-.73,0]);
  const top=add(root,'Compass rose marquetry',new THREE.PlaneGeometry(18.9,15.9),ornateWoodMaterial(),[0,-.449,0]);top.rotation.x=-Math.PI/2;
  const gold=new THREE.MeshStandardMaterial({color:'#bb9557',metalness:.55,roughness:.38});
  for(const z of [-7.94,7.94])add(root,'Table edge brass',new THREE.BoxGeometry(18.95,.055,.055),gold,[0,-.47,z]);
  for(const x of [-9.44,9.44])add(root,'Table edge brass',new THREE.BoxGeometry(.055,.055,15.9),gold,[x,-.47,0]);
  // Thin exterior veneers only: the original tray colliders stay untouched.
  for(const [x,z,w,a] of [[0,5.155,12.1,0],[0,-5.155,12.1,Math.PI],[6.155,0,10.3,Math.PI/2],[-6.155,0,10.3,-Math.PI/2]]){
    const panel=add(root,'Gold-inlaid tray exterior',new THREE.PlaneGeometry(w,2.4),ornateWoodMaterial(true),[x,.8,z]);panel.rotation.y=a;
  }
  add(root,'Continuous tray base plinth',new THREE.BoxGeometry(12.36,.12,10.36),dark,[0,-.389,0]);
  for(const x of [-6.155,6.155])for(const z of [-5.155,5.155])add(root,'Sealed brass corner',new THREE.BoxGeometry(.085,2.42,.085),gold,[x,.8,z]);
  for(const z of [-5,5])add(root,'Tray rim brass',new THREE.BoxGeometry(12.2,.025,.045),gold,[0,2.015,z+.14*Math.sign(z)]);
  for(const x of [-6,6])add(root,'Tray rim brass',new THREE.BoxGeometry(.045,.025,10.3),gold,[x+.14*Math.sign(x),2.015,0]);
  const ornaments=new THREE.Group();ornaments.name='Table ornaments';root.add(ornaments);
  addNotebook(ornaments,gold);addGoblet(ornaments);addQuill(ornaments);
  return ornaments;
}
function addNotebook(parent,gold){
  const book=new THREE.Group();book.name='Open dice journal';book.position.set(-5.4,-.43,6.6);book.rotation.y=-.08;book.scale.setScalar(.85);parent.add(book);
  const leather=new THREE.MeshStandardMaterial({color:'#492b1e',roughness:.82});
  add(book,'Leather binding',new THREE.BoxGeometry(3.25,.14,2.55),leather,[0,.07,0]);
  const paper=new THREE.MeshStandardMaterial({color:'#d7c494',roughness:1});
  for(const x of [-.8,.8])add(book,'Page block',new THREE.BoxGeometry(1.5,.16,2.35),paper,[x,.21,0]);
  const map=canvasMap((c,n)=>{c.fillStyle='#ecddb6';c.fillRect(0,0,n,n);c.strokeStyle='#7a6040';c.fillStyle='#493526';c.lineWidth=3;c.font='bold 52px Georgia';c.textAlign='center';c.fillText('FIELD NOTES',n/2,120);c.font='24px Georgia';c.fillText('Dice & chance',n/2,165);
    for(let k=0;k<4;k++){const x=280+(k%2)*450,y=360+Math.floor(k/2)*340,r=110;c.beginPath();for(let i=0;i<6;i++){const a=i*Math.PI/3;const px=x+Math.sin(a)*r,py=y+Math.cos(a)*r;i?c.lineTo(px,py):c.moveTo(px,py);}c.closePath();c.stroke();for(let i=0;i<3;i++){c.beginPath();c.moveTo(x,y);c.lineTo(x+Math.sin(i*2*Math.PI/3)*r,y+Math.cos(i*2*Math.PI/3)*r);c.stroke();}c.font='42px Georgia';c.fillText(['4','6','12','20'][k],x,y+20);}
    c.strokeStyle='#a9936a';c.lineWidth=2;for(let y=210;y<950;y+=35){c.beginPath();c.moveTo(30,y);c.lineTo(90,y);c.stroke();}
  });
  const page=add(book,'Illustrated parchment',new THREE.PlaneGeometry(3.08,2.31),new THREE.MeshStandardMaterial({map,color:map?'#ffffff':'#ecddb6',roughness:1}),[0,.297,0]);page.rotation.x=-Math.PI/2;
  add(book,'Journal spine',new THREE.BoxGeometry(.055,.025,2.4),leather,[0,.31,0]);
  for(const z of [-.8,0,.8]){const ring=add(book,'Binding ring',new THREE.TorusGeometry(.105,.023,6,16),gold,[0,.3,z]);ring.rotation.y=Math.PI/2;}
}
function addGoblet(parent){
  const silver=new THREE.MeshStandardMaterial({color:'#b0b9b5',metalness:.65,roughness:.32});
  const profile=[[0,0],[.42,0],[.46,.05],[.44,.13],[.2,.18],[.09,.28],[.09,.6],[.18,.72],[.32,.83],[.43,1.12],[.51,1.55],[.5,1.62],[.46,1.62],[.45,1.52],[.36,1.12],[.26,.91],[0,.83]];
  const cup=new THREE.Group();cup.name='Silver goblet';cup.position.set(7.65,-.43,-3);parent.add(cup);
  add(cup,'Hollow goblet',new THREE.LatheGeometry(profile.map(p=>new THREE.Vector2(...p)),40),silver);
  for(const [r,y] of [[.49,1.61],[.43,.08],[.33,.87]]){const ring=add(cup,'Goblet engraved band',new THREE.TorusGeometry(r,.023,8,40),silver,[0,y,0]);ring.rotation.x=Math.PI/2;}
  parent.userData.liquid=createGobletLiquid(cup);
}
function addQuill(parent){
  const ink=new THREE.Group();ink.name='Inkwell and feather';ink.position.set(-7.9,-.43,5.8);parent.add(ink);
  const iron=new THREE.MeshStandardMaterial({color:'#252e2a',metalness:.4,roughness:.4});
  add(ink,'Inkwell',new THREE.LatheGeometry([[0,0],[.36,0],[.41,.1],[.34,.29],[.2,.36],[.16,.34],[.16,.27],[0,.27]].map(p=>new THREE.Vector2(...p)),24),iron);
  const feather=new THREE.Group();feather.position.y=.3;feather.rotation.z=-.24;ink.add(feather);
  const map=canvasMap((c,n)=>{c.clearRect(0,0,n,n);c.fillStyle='#ae9570';c.beginPath();c.moveTo(n*.49,n*.93);c.bezierCurveTo(n*.05,n*.55,n*.25,n*.1,n*.62,n*.03);c.bezierCurveTo(n*.86,n*.2,n*.81,n*.64,n*.49,n*.93);c.fill();c.clip();c.strokeStyle='#e0cbaa';c.lineWidth=3;for(let y=50;y<470;y+=9){c.beginPath();c.moveTo(256,y);c.lineTo(140,y+80);c.moveTo(256,y);c.lineTo(372,y-65);c.stroke();}},512);
  const material=new THREE.MeshStandardMaterial({map,color:map?'#ffffff':'#ae9570',transparent:true,alphaTest:.3,side:THREE.DoubleSide,roughness:.8});
  add(feather,'Feather vane',new THREE.PlaneGeometry(.68,2.1),material,[0,1.25,0]);
  add(feather,'Quill shaft',new THREE.CylinderGeometry(.011,.023,2.15,8),new THREE.MeshStandardMaterial({color:'#ddc79d'}),[0,1.02,.012]);
}
