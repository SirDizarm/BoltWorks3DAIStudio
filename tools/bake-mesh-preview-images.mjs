import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
const require=createRequire(import.meta.url),{chromium}=require(process.env.BWS_PLAYWRIGHT||'playwright');
const source=await readFile('app/modules/meshes.js','utf8'),end=source.indexOf('} = meshFactory;');
if(end<0)throw Error('Mesh factory boundary missing');
const entry='import * as THREE from "three";\nimport {createMeshFactory} from "./meshes/factory.js";\n'+source.slice(0,end+'} = meshFactory;'.length)+[
'window.bakeMeshImages=()=>{',
'const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.setSize(224,160,false);renderer.setClearColor(0,0);',
'const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1.3,1.3,.93,-.93,.1,20);camera.position.set(2.6,1.9,3.2);camera.lookAt(0,0,0);',
'scene.add(new THREE.HemisphereLight(0xe2fff6,0x34404a,2));const key=new THREE.DirectionalLight(0xffffff,3);key.position.set(-3,5,4);scene.add(key);',
'const material=new THREE.MeshStandardMaterial({color:0x6ebdac,roughness:.7,metalness:.05,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});',
'const edgeMaterial=new THREE.LineBasicMaterial({color:0x173c39,transparent:true,opacity:.65}),images={};',
'for(const name of Object.keys(shapeFactories)){const g=shapeFactories[name]();g.computeBoundingBox();const size=g.boundingBox.getSize(new THREE.Vector3());g.center();const scale=1.3/Math.max(size.x,size.y,size.z,.001);g.scale(scale,scale,scale);',
'const mesh=new THREE.Mesh(g,material),edges=new THREE.EdgesGeometry(g,name.startsWith("facetedBall")?1:25);mesh.add(new THREE.LineSegments(edges,edgeMaterial));scene.add(mesh);renderer.render(scene,camera);images[name]=renderer.domElement.toDataURL("image/png");scene.remove(mesh);g.dispose();edges.dispose();}',
'material.dispose();edgeMaterial.dispose();renderer.dispose();renderer.forceContextLoss();return images;};'
].join('\n');
const result=await build({stdin:{contents:entry,resolveDir:process.cwd()+"/app",loader:'js'},bundle:true,write:false,format:'iife',target:'es2020'});
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
 const page=await browser.newPage();await page.setContent('<html><body></body></html>');await page.addScriptTag({content:result.outputFiles[0].text});
 const images=await page.evaluate(()=>window.bakeMeshImages());await mkdir('app/assets/mesh-previews',{recursive:true});
 for(const [name,url]of Object.entries(images))await writeFile('app/assets/mesh-previews/'+name+'.png',Buffer.from(url.split(',')[1],'base64'));
 console.log('Baked '+Object.keys(images).length+' original-style PNG thumbnails.');
}finally{await browser.close();}

