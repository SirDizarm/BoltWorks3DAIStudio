const {chromium}=require(process.env.BWS_PLAYWRIGHT || 'playwright');
const {build}=require('esbuild');
(async()=>{
 const bundle=await build({stdin:{contents:`import * as T from 'three';import {polyDefinition,polyVisual} from './app/demos/dice-polyhedra.js';
 const r=new T.WebGLRenderer({antialias:true});r.setSize(1400,480);document.body.append(r.domElement);const s=new T.Scene();s.background=new T.Color('#10242f');s.add(new T.HemisphereLight(0xffffff,0x657585,3));const l=new T.DirectionalLight(0xffffff,3);l.position.set(-4,8,6);s.add(l);const c=new T.PerspectiveCamera(28,1400/480,.1,100);c.position.set(0,6,17);c.lookAt(0,0,0);[4,6,8,10,12,20].forEach((type,i)=>{const m=polyVisual(polyDefinition(type),0x3266a0);m.position.x=(i-2.5)*2.25;m.rotation.y=.25;s.add(m);});r.render(s,c);`,resolveDir:process.cwd(),loader:'js'},bundle:true,write:false,format:'iife'});
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{const page=await browser.newPage({viewport:{width:1400,height:480}});await page.setContent('<body style="margin:0">');await page.addScriptTag({content:bundle.outputFiles[0].text});await page.screenshot({path:'demos/dice-labels-qa.png'});}finally{await browser.close();}
})();
