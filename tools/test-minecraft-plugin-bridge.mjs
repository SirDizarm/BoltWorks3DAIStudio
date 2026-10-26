import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../app/modules/plugin-minecraft-bridge.js',import.meta.url),'utf8');
let handler,enabled=true,id=0;const sent=[],downloads=[],elements=[];
function element(tag){const el={tag,style:{},children:[],listeners:{},disabled:false,files:[],isConnected:true,
 append(...items){this.children.push(...items);},setAttribute(){},click(){this.clicks=(this.clicks||0)+1;},
 addEventListener(type,fn){this.listeners[type]=fn;}};elements.push(el);return el;}
const context={console,TextEncoder,Blob,AbortController,crypto:{randomUUID:()=>`request-${++id}`},
 document:{createElement:element},window:{addEventListener(type,fn){assert.equal(type,'message');handler=fn;}},
 pluginManifestById:()=>({enabled}),downloadBlob:(name,blob)=>downloads.push({name,blob})};
vm.createContext(context);vm.runInContext(source,context);
const grid={format:'blockmate-bws-grid-v1',format_version:1,units:'minecraft_blocks',blocks:[{x:0,y:0,z:0,block_id:'minecraft:stone',properties:{}}],jigsaws:[],future_metadata:{keep:true},preview_assets:{materials:{'minecraft:stone':{faces:{up:'data:image/png;base64,AA=='}}}}};
assert.equal(context.bwsValidateMinecraftGrid(grid).future_metadata.keep,true);
for(const bad of [{...grid,format:'arbitrary-json'}, {...grid,blocks:[{...grid.blocks[0],x:NaN}]}, {...grid,blocks:[{...grid.blocks[0],block_id:'../../bad'}]}, {...grid,blocks:[...grid.blocks,...grid.blocks]}, {...grid,jigsaws:Array(65).fill({x:0,y:0,z:0})}])assert.throws(()=>context.bwsValidateMinecraftGrid(bad));
const cyclic={};cyclic.self=cyclic;assert.throws(()=>context.bwsValidateMinecraftGrid(cyclic));
const inert=JSON.parse(JSON.stringify(grid).replace('"future_metadata":','"__proto__":{"polluted":true},"future_metadata":'));
assert.equal(context.bwsValidateMinecraftGrid(inert).__proto__.polluted,true);assert.equal({}.polluted,undefined);

const dialog=element('dialog'),header=element('header'),peer={postMessage(packet){sent.push(packet);}},frame={style:{},contentWindow:peer};
context.bwsAttachPluginMinecraftBridge({manifest:{id:'minecraft-workspace',apiVersion:6,contributes:{minecraftWorkspace:true}}},dialog,header,frame);
const [open,save,status,input]=header.children;
assert.equal(open.disabled,true);assert.equal(save.disabled,true);
handler({source:{},data:{type:'bws-plugin-ready'}});assert.equal(open.disabled,true);
handler({source:peer,data:{type:'bws-plugin-ready'}});assert.equal(open.disabled,false);
open.onclick();assert.equal(input.clicks,1);assert.equal(sent.length,0);
input.files=[{name:'sample.blockgrid.json',size:100,text:async()=>JSON.stringify(grid)}];await input.listeners.change();
assert.equal(sent.length,1);assert.equal(sent[0].type,'bws-minecraft-import');assert.equal(sent[0].requestId,'request-1');
assert.equal(sent[0].grid.preview_assets.materials['minecraft:stone'].faces.up,'data:image/png;base64,AA==');
assert.equal(save.disabled,true);assert.equal(downloads.length,0);
const changed={format:grid.format,format_version:1,blocks:[{x:1,y:0,z:0,block_id:'minecraft:dirt'}]};
handler({source:{},data:{type:'bws-minecraft-grid',requestId:'request-1',grid:changed}});assert.equal(save.disabled,true);
handler({source:peer,data:{type:'bws-minecraft-grid',requestId:'stale',grid:changed}});assert.equal(save.disabled,true);
handler({source:peer,data:{type:'bws-minecraft-grid',requestId:'request-1',grid:changed}});assert.equal(save.disabled,false);assert.equal(downloads.length,0);
save.onclick();assert.equal(downloads.length,1);assert.equal(downloads[0].name,'sample.edited.blockgrid.json');
const output=JSON.parse(await downloads[0].blob.text());assert.equal(output.blocks[0].block_id,'minecraft:dirt');assert.equal(output.future_metadata.keep,true);assert.deepEqual(output.preview_assets,grid.preview_assets);
enabled=false;save.onclick();assert.equal(downloads.length,1);enabled=true;
input.files=[{name:'second.blockgrid.json',size:100,text:async()=>JSON.stringify(grid)}];await input.listeners.change();assert.equal(save.disabled,true);
handler({source:peer,data:{type:'bws-minecraft-grid',requestId:'request-1',grid:changed}});assert.equal(save.disabled,true);
handler({source:peer,data:{type:'bws-minecraft-grid',requestId:'request-2',grid:{...changed,format:'wrong'}}});assert.equal(save.disabled,true);assert.match(status.textContent,/Rejected/);
dialog.isConnected=false;handler({source:peer,data:{type:'bws-minecraft-grid',requestId:'request-2',grid:changed}});assert.equal(save.disabled,true);
dialog.bwsCleanup();save.onclick();assert.equal(downloads.length,1);

const manifestSource=readFileSync(new URL('../app/modules/plugins.js',import.meta.url),'utf8');
vm.runInContext(manifestSource.slice(manifestSource.indexOf('function validPluginManifest('),manifestSource.indexOf('function validPluginPackage(')),context);
const manifest={kind:'boltworks-plugin',manifestVersion:1,id:'minecraft-workspace',name:'Minecraft workspace',runtime:'sandbox-html',apiVersion:6,contributes:{minecraftWorkspace:true}};
assert.equal(context.validPluginManifest(manifest).apiVersion,6);
assert.throws(()=>context.validPluginManifest({...manifest,contributes:{minecraftWorkspace:true,modelSnapshot:true}}));
assert.throws(()=>context.validPluginManifest({...manifest,contributes:{minecraftWorkspace:true,network:true}}));
assert.throws(()=>context.validPluginManifest({...manifest,runtime:'assets'}));
assert.equal(context.validPluginManifest({...manifest,apiVersion:2,contributes:{modelSnapshot:true}}).apiVersion,2);
const installer=readFileSync(new URL('../app/modules/plugin-installer.js',import.meta.url),'utf8');
assert.match(installer,/apiVersion>=2&&p\.manifest\.apiVersion!==6/);assert.match(installer,/sandbox","allow-scripts"/);
assert(!source.includes('bwsPluginModelSnapshot('));assert(!source.includes('fetch('));
console.log('PASS: API 6 file selection, request/source/enabled guards, explicit saves, metadata preservation and no scene capability.');
