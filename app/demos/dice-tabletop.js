import * as THREE from 'three';
import {addOrnateTable} from './dice-ornate-table.js';
function texture(draw){if(typeof document==='undefined')return null;const c=document.createElement('canvas');c.width=c.height=256;draw(c.getContext('2d'));const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;}
export function woodMaterial(end=false){const map=texture(c=>{c.fillStyle='#d6a858';c.fillRect(0,0,256,256);c.strokeStyle='#704320';c.lineWidth=3;if(end){for(let r=15;r<190;r+=16){c.beginPath();c.ellipse(110,130,r,r*.77,.25,0,Math.PI*2);c.stroke();}}else{for(let y=10;y<256;y+=18){c.beginPath();for(let x=0;x<=256;x+=4){const py=y+5*Math.sin(x*.04+y);x?c.lineTo(x,py):c.moveTo(x,py);}c.stroke();}}c.strokeStyle='#573621';c.lineWidth=8;c.strokeRect(0,0,256,256);});return new THREE.MeshStandardMaterial({color:map?'#ffffff':'#c39a58',map,roughness:.8});}
export function addTabletop(scene){
  return addOrnateTable(scene);
}
export function addTrayLogo(scene){
  if(typeof document==='undefined'||typeof __BWS_DICE_LOGO__==='undefined')return;
  const map=new THREE.TextureLoader().load(__BWS_DICE_LOGO__);map.colorSpace=THREE.SRGBColorSpace;
  const logo=new THREE.Mesh(new THREE.PlaneGeometry(4.1,5),new THREE.MeshStandardMaterial({map,transparent:true,depthWrite:false,roughness:1,opacity:.65}));
  logo.name='BoltWorks tray logo';logo.rotation.x=-Math.PI/2;logo.position.set(0,.005,0);logo.receiveShadow=true;scene.add(logo);
}
