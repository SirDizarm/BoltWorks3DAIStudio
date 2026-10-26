// Plugin API 6: one player-selected Minecraft grid; no project or scene capability.
const BWS_MINECRAFT_GRID_BYTES=32*1024*1024;
function bwsValidateMinecraftGrid(value){
 const text=JSON.stringify(value);
 if(typeof text!=='string'||new TextEncoder().encode(text).length>BWS_MINECRAFT_GRID_BYTES)throw Error('Block grid exceeds the 32 MB limit.');
 const grid=JSON.parse(text);
 if(!grid||grid.format!=='blockmate-bws-grid-v1'||grid.format_version!==1)throw Error('Use a blockmate-bws-grid-v1 .blockgrid.json file.');
 if(grid.units!==undefined&&grid.units!=='minecraft_blocks')throw Error('The grid must use Minecraft block units.');
 if(!Array.isArray(grid.blocks)||grid.blocks.length>100064)throw Error('Use at most 100,000 blocks plus 64 jigsaw block records.');
 const occupied=new Set(),resource=/^[a-z0-9_.-]+:[a-z0-9_./-]+$/;let normalCount=0,jigsawCount=0;
 const point=(item,label)=>{if(!item||typeof item!=='object'||Array.isArray(item))throw Error('Invalid '+label+'.');for(const axis of ['x','y','z'])if(!Number.isSafeInteger(item[axis])||Math.abs(item[axis])>30000000)throw Error(label+' coordinates must be bounded integers.');};
 for(const block of grid.blocks){
  point(block,'Block');const key=block.x+','+block.y+','+block.z;if(occupied.has(key))throw Error('Duplicate block position: '+key);occupied.add(key);
  if(typeof block.block_id!=='string'||block.block_id.length>160||!resource.test(block.block_id))throw Error('Blocks need namespaced Minecraft IDs.');
  if(block.block_id==='minecraft:jigsaw')jigsawCount++;else normalCount++;
  if(normalCount>100000||jigsawCount>64)throw Error('Use at most 100,000 ordinary blocks plus 64 jigsaw block records.');
  if(block.yaw!==undefined&&(!Number.isFinite(block.yaw)||Math.abs(block.yaw)>360))throw Error('Block yaw must be a finite angle between -360 and 360.');
  if(block.properties!==undefined){if(!block.properties||typeof block.properties!=='object'||Array.isArray(block.properties)||Object.keys(block.properties).length>64)throw Error('Invalid block properties.');for(const [key,item]of Object.entries(block.properties))if(key.length>128||typeof item!=='string'||item.length>256)throw Error('Invalid block property value.');}
 }
 if(grid.jigsaws!==undefined){if(!Array.isArray(grid.jigsaws)||grid.jigsaws.length>64)throw Error('Use at most 64 jigsaw connectors.');for(const item of grid.jigsaws)point(item,'Jigsaw');}
 return grid;
}
function bwsAttachPluginMinecraftBridge(pkg,dialog,header,frame){
 if(pkg.manifest.apiVersion!==6||pkg.manifest.contributes?.minecraftWorkspace!==true)return;
 const controller=new AbortController(),open=document.createElement('button'),save=document.createElement('button'),status=document.createElement('span'),input=document.createElement('input');
 let ready=false,requestId=null,imported=null,output=null,filename='minecraft-build',readSerial=0;
 open.type=save.type='button';open.textContent='Open block grid…';open.disabled=true;save.textContent='Save edited block grid';save.disabled=true;
 input.type='file';input.accept='.blockgrid.json';input.hidden=true;status.setAttribute('role','status');status.style.cssText='font-size:12px;max-width:350px;overflow-wrap:anywhere';
 header.style.cssText='display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-height:42px';dialog.style.display='flex';dialog.style.flexDirection='column';frame.style.flex='1';frame.style.minHeight='0';header.append(open,save,status,input);
 const allowed=()=>dialog.isConnected&&pluginManifestById(pkg.manifest.id)?.enabled;
 open.onclick=()=>{if(!ready||!allowed())return;input.value='';input.click();};
 input.addEventListener('change',async()=>{
  if(!ready||!allowed())return;const file=input.files?.[0];if(!file)return;
  const serial=++readSerial;requestId=null;imported=null;output=null;save.disabled=true;
  try{
   if(!/\.blockgrid\.json$/i.test(file.name)||file.size>BWS_MINECRAFT_GRID_BYTES)throw Error('Choose a .blockgrid.json file no larger than 32 MB.');
   status.textContent='Reading selected block grid…';const text=await file.text();
   if(new TextEncoder().encode(text).length>BWS_MINECRAFT_GRID_BYTES)throw Error('Block grid exceeds the 32 MB limit.');
   const grid=bwsValidateMinecraftGrid(JSON.parse(text));if(serial!==readSerial||!allowed())return;
   imported=grid;filename=file.name.replace(/\.blockgrid\.json$/i,'').replace(/[^a-z0-9_. -]/gi,'_').slice(0,120)||'minecraft-build';requestId=crypto.randomUUID();
   frame.contentWindow.postMessage({type:'bws-minecraft-import',requestId,grid},'*');status.textContent='Selected grid shared with the isolated Minecraft workspace.';
  }catch(error){if(serial===readSerial&&allowed())status.textContent=error.message;}
 },{signal:controller.signal});
 save.onclick=()=>{if(!ready||!allowed()||!requestId||!output||output.requestId!==requestId)return;downloadBlob(filename+'.edited.blockgrid.json',output.blob);status.textContent='Edited block-grid download requested. Your BWS project is unchanged.';};
 window.addEventListener('message',event=>{
  if(event.source!==frame.contentWindow||!allowed())return;const data=event.data;
  if(data?.type==='bws-plugin-ready'||data?.type==='plugin-ready'){ready=true;open.disabled=false;return;}
  if(data?.type!=='bws-minecraft-grid'||!requestId||data.requestId!==requestId||!imported)return;
  try{
   const candidate=bwsValidateMinecraftGrid(data.grid);
   // Keep unknown top-level metadata (including preview_assets) when an editor omits it.
   // JSON serialization keeps it inert; nothing is merged into project or global state.
   const grid=bwsValidateMinecraftGrid({...imported,...candidate});
   output={requestId,blob:new Blob([JSON.stringify(grid)],{type:'application/json'})};save.disabled=false;status.textContent=grid.blocks.length.toLocaleString()+' grid blocks ready. Choose Save edited block grid to download.';
  }catch(error){output=null;save.disabled=true;status.textContent='Rejected edited grid: '+error.message;}
 },{signal:controller.signal});
 const previousCleanup=dialog.bwsCleanup;
 dialog.bwsCleanup=()=>{previousCleanup?.();controller.abort();readSerial++;ready=false;requestId=null;imported=null;output=null;};
}
