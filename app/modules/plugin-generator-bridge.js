// API 3: bounded geometry only, never plugin code in the editor or general RPC.
function bwsValidateGeneratedMesh(data){
 const positions=data?.geometry?.positions,uvs=data?.geometry?.uvs;
 if(!Array.isArray(positions)||positions.length<9||positions.length%9||positions.length>9000000||positions.some(n=>!Number.isFinite(n)||Math.abs(n)>1000000))throw Error('Plugin returned invalid or oversized triangle geometry.');
 if(!Array.isArray(uvs)||uvs.length!==positions.length/3*2||uvs.some(n=>!Number.isFinite(n)||Math.abs(n)>1000000))throw Error('Plugin returned invalid texture coordinates.');
 const meta={};for(const key of ['recoveredV30','hybridV46','hybridV47'])if(data.meta?.[key]===true)meta[key]=true;
 for(const key of ['mode','buildMode','sourceMode','sourceName'])if(typeof data.meta?.[key]==='string')meta[key]=data.meta[key].slice(0,256);
 for(const key of ['cols','rows','sourceW','sourceH','threshold','smoothPasses','depth','back'])if(Number.isFinite(data.meta?.[key]))meta[key]=data.meta[key];
 return {positions,uvs,meta,name:String(data.name||'Image mesh').slice(0,120)};
}
function bwsAttachPluginGeneratorBridge(pkg,dialog,header,frame){
 const controller=new AbortController(),add=document.createElement('button'),status=document.createElement('span');let result=null,ready=false,pending=null;
 add.textContent='Add mesh to BWS';add.disabled=true;status.setAttribute('role','status');header.append(add,status);header.style.height='auto';header.style.flexWrap='wrap';
 add.onclick=()=>{if(!result||!pluginManifestById(pkg.manifest.id)?.enabled)return;try{const meshData=bwsValidateGeneratedMesh({geometry:result,meta:result.meta,name:result.name});recordHistory('plugin generated mesh');const mesh=addObject({shape:'imageRelief',name:meshData.name,geometry:{positions:meshData.positions,uvs:meshData.uvs},color:'#e2e8e4',roughness:.72},{record:false});mesh.userData.reliefSource=meshData.meta;status.textContent='Mesh added; existing objects kept.';add.disabled=true;result=null;}catch(error){status.textContent=error.message;}};
 function finish(error,value){if(!pending)return;const job=pending;pending=null;clearTimeout(job.timer);error?job.reject(error):job.resolve(value);}
 dialog.bwsGenerate=options=>new Promise((resolve,reject)=>{if(pending){reject(Error('This plugin is already generating a mesh.'));return;}const requestId=crypto.randomUUID();pending={requestId,options,resolve,reject,timer:setTimeout(()=>finish(Error('Plugin generation timed out.')),120000)};if(ready)frame.contentWindow.postMessage({type:'bws-plugin-generate',requestId,options},'*');});
 window.addEventListener('message',event=>{if(event.source!==frame.contentWindow||!dialog.isConnected||!pluginManifestById(pkg.manifest.id)?.enabled)return;const data=event.data;if(data?.type==='bws-plugin-ready'){ready=true;if(pending)frame.contentWindow.postMessage({type:'bws-plugin-generate',requestId:pending.requestId,options:pending.options},'*');return;}if(!['bws-plugin-mesh','bws-plugin-mesh-error'].includes(data?.type))return;if(data.requestId!=null&&data.requestId!==pending?.requestId)return;
 try{if(data.type==='bws-plugin-mesh-error')throw Error(String(data.message||'Generation failed').slice(0,500));const value=bwsValidateGeneratedMesh(data);if(pending&&data.requestId===pending.requestId){finish(null,value);status.textContent='Generated mesh returned to the requested AI command.';}else{result=value;add.disabled=false;status.textContent='Preview ready; choose Add mesh to BWS.';}}catch(error){status.textContent=error.message;if(pending&&data.requestId===pending.requestId)finish(error);}
 },{signal:controller.signal});const cleanup=dialog.bwsCleanup;dialog.bwsCleanup=()=>{cleanup?.();controller.abort();result=null;finish(Error('Plugin workspace closed.'));};
}
async function bwsRunPluginGenerator(id,options){await bwsPluginStorageReady;const plugin=pluginManifestById(id);if(!plugin?.enabled||plugin.apiVersion!==3||plugin.contributes?.generatedMesh!==true)throw Error('Install and enable Image to Mesh in Plugins before requesting image reconstruction.');bwsOpenPluginWorkspace(id);const dialog=bwsPluginWindows.get(id);return dialog.bwsGenerate(options);}
