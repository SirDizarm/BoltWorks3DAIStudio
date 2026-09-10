import {readFile,writeFile,mkdir} from 'node:fs/promises';
import * as T from 'three';
const root=process.cwd(),index=await readFile('index.html','utf8'),names=[...new Set([...index.matchAll(/data-add="([^"]+)"/g)].map(m=>m[1]))];
function tube(r=.65,inner=.4,height=1){const shape=new T.Shape();shape.absarc(0,0,r,0,Math.PI*2,false);const hole=new T.Path();hole.absarc(0,0,inner,0,Math.PI*2,true);shape.holes.push(hole);const g=new T.ExtrudeGeometry(shape,{depth:height,bevelEnabled:false,curveSegments:24});g.rotateX(-Math.PI/2);return g;}
function panel(){const sh=new T.Shape();sh.absarc(0,0,.8,0,Math.PI*.8,false);sh.absarc(0,0,.65,Math.PI*.8,0,true);sh.closePath();const g=new T.ExtrudeGeometry(sh,{depth:1.1,bevelEnabled:false,curveSegments:24});g.rotateX(-Math.PI/2);return g;}
function shapePolygon(points,depth){const sh=new T.Shape();sh.moveTo(...points[0]);points.slice(1).forEach(p=>sh.lineTo(...p));sh.closePath();return new T.ExtrudeGeometry(sh,{depth,bevelEnabled:false});}
const factories={
box:()=>new T.BoxGeometry(1,1,1),sphere:()=>new T.SphereGeometry(.65,24,16),cylinder:()=>new T.CylinderGeometry(.55,.55,1.2,24),cone:()=>new T.ConeGeometry(.65,1.4,24),torus:()=>new T.TorusGeometry(.5,.2,12,32),panel:()=>new T.BoxGeometry(1.3,1,.1),
wedge:()=>shapePolygon([[-.6,-.5],[.6,-.5],[-.6,.5]],1),
hollowBox:()=>{const sh=new T.Shape();sh.moveTo(-.6,-.6);sh.lineTo(.6,-.6);sh.lineTo(.6,.6);sh.lineTo(-.6,.6);sh.closePath();const h=new T.Path();h.moveTo(-.4,-.4);h.lineTo(-.4,.4);h.lineTo(.4,.4);h.lineTo(.4,-.4);h.closePath();sh.holes.push(h);return new T.ExtrudeGeometry(sh,{depth:.8,bevelEnabled:false});},
tube:()=>tube(),curvedPanel:()=>panel(),ring:()=>tube(.7,.4,.12),arch:()=>{const sh=new T.Shape();sh.absarc(0,0,.7,0,Math.PI,false);sh.absarc(0,0,.4,Math.PI,0,true);sh.closePath();return new T.ExtrudeGeometry(sh,{depth:.35,bevelEnabled:false,curveSegments:24});},
hemisphere:()=>new T.SphereGeometry(.7,24,12,0,Math.PI*2,0,Math.PI/2),dome:()=>{const g=new T.SphereGeometry(.7,24,12,0,Math.PI*2,0,Math.PI/2);g.scale(1,.55,1);return g;},
capsule:()=>new T.CapsuleGeometry(.35,.65,8,16),pyramid:()=>new T.ConeGeometry(.8,1.2,4),prism:()=>new T.CylinderGeometry(.7,.7,1.1,3),tetrahedron:()=>new T.TetrahedronGeometry(.8),pyramidFrustum:()=>new T.CylinderGeometry(.35,.75,1,4),
facetedBallLow:()=>new T.IcosahedronGeometry(.75,0),facetedBallMedium:()=>new T.IcosahedronGeometry(.75,1),facetedBallHigh:()=>new T.IcosahedronGeometry(.75,2),
heart:()=>{const sh=new T.Shape();sh.moveTo(0,-.6);sh.bezierCurveTo(-1,.05,-.65,.9,0,.4);sh.bezierCurveTo(.65,.9,1,.05,0,-.6);return new T.ExtrudeGeometry(sh,{depth:.25,bevelEnabled:true,bevelSegments:2,bevelSize:.06,bevelThickness:.04,curveSegments:18});},
stair:()=>shapePolygon([[-.6,-.5],[.6,-.5],[.6,.5],[.3,.5],[.3,.25],[0,.25],[0,0],[-.3,0],[-.3,-.25],[-.6,-.25]],.7)
};
await mkdir('app/assets/mesh-previews',{recursive:true});
const camera=new T.OrthographicCamera(-1,1,.72,-.72,.1,20);camera.position.set(2.6,1.9,3.2);camera.lookAt(0,0,0);camera.updateMatrixWorld();const light=new T.Vector3(-3,5,4).normalize();
for(const name of names){
 if(!factories[name])throw Error('No static thumbnail geometry for '+name);
 let g=factories[name]();g.computeBoundingBox();const size=g.boundingBox.getSize(new T.Vector3());g.center();g.scale(...[1,1,1].map(()=>1.35/Math.max(size.x,size.y,size.z)));if(g.index){const flat=g.toNonIndexed();g.dispose();g=flat;}
 const p=g.getAttribute('position'),triangles=[];
 for(let i=0;i<p.count;i+=3){const v=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(p,i+j));const normal=v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0])).normalize(),center=v[0].clone().add(v[1]).add(v[2]).multiplyScalar(1/3);
 if(normal.dot(camera.position.clone().sub(center))<=0)continue;
 const shade=.55+.4*Math.max(0,normal.dot(light)),color=new T.Color('#6ebdac').multiplyScalar(shade).getHexString(),screen=v.map(v=>v.clone().project(camera));
 triangles.push({depth:center.clone().applyMatrix4(camera.matrixWorldInverse).z,svg:'<polygon points="'+screen.map(v=>((v.x+1)*112).toFixed(2)+','+((1-v.y)*80).toFixed(2)).join(' ')+'" fill="#'+color+'" stroke="#'+color+'" stroke-width=".4"/>'});}
 triangles.sort((a,b)=>a.depth-b.depth);
 await writeFile('app/assets/mesh-previews/'+name+'.svg','<svg xmlns="http://www.w3.org/2000/svg" width="224" height="160" viewBox="0 0 224 160">'+triangles.map(t=>t.svg).join('')+'</svg>');g.dispose();
}
const file='app/modules/panels.js';let source=await readFile(file,'utf8');
const anchor='function initializeMeshButtonPreviews() {';
if(!source.includes(anchor))throw Error('Preview function missing');
source=source.replace(anchor,anchor+'\n  // Bundled static images: no WebGL context or idle-time rendering at startup.\n  for(const button of document.querySelectorAll("button[data-add]")){\n    const shape=button.dataset.add,name=button.textContent.trim();button.classList.add("mesh-preview-button");button.setAttribute("aria-label",name);button.title=name+" - add this shape to the scene";\n    const image=document.createElement("img");image.className="mesh-preview-image";image.alt="";image.setAttribute("aria-hidden","true");image.width=112;image.height=80;image.loading="eager";image.src="app/assets/mesh-previews/"+encodeURIComponent(shape)+".svg";\n    const label=document.createElement("span");label.className="mesh-preview-label";label.textContent=name;button.replaceChildren(image,label);\n  }\n  return;\n');
await writeFile(file,source);
for(const file of ['index.html','package.json','tools/studio-bundler.mjs']){const s=await readFile(file,'utf8');await writeFile(file,s.replaceAll('49.64.64','49.64.65'));}
await writeFile('BoltWorksStudioAi/STATIC_MESH_PREVIEWS.md','# Static mesh images - v49.64.65\n\nMesh buttons use bundled SVG illustrations under app/assets/mesh-previews. No thumbnail WebGL renderer, startup geometry generation or idle queue is used. Images are generated offline from primitive geometry and load as ordinary cacheable local assets. app/assets is included in the existing web deployment copy step. These are illustrative icons rather than exact previews of edited mesh parameters.\n\nSource panels.js and assets synchronized with studio-v49.64.65.js. No browser validation performed.\n');
console.log('Created '+names.length+' static mesh images.');
