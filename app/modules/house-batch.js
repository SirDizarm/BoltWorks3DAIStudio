// Stable, independently replaceable house outputs. No per-part scene refreshes.
let houseBatchBusy=false,houseBatchStop=false;
function houseBatchSettings(graph){
 const active=geometryNodeActiveNodeIds(graph),ids=[...active];
 const source=ids.find(id=>geometryNodeTypeForId(graph,id)==='houseLayout');
 const batch=ids.find(id=>geometryNodeTypeForId(graph,id)==='houseBatch');
 if(!source||!batch)return null;
 const sources=ids.filter(id=>GEOMETRY_NODE_SOURCE_TYPES.includes(geometryNodeTypeForId(graph,id)));
 if(sources.length!==1)throw Error('House Batch requires one House Layout source. Use separate graphs for other generators.');
 return {source,active,params:assetNodeSanitize(graph.nodeParams?.[source]||graph.params),settings:assetNodeSanitize(graph.nodeParams?.[batch]||graph.params)};
}
function houseBatchOutputId(graph,index){return graph.id+'-house-'+String(index+1).padStart(3,'0');}
function houseBatchRecords(graph){return Array.isArray(graph?.params?.houseBatchOutputs)?graph.params.houseBatchOutputs:[];}
function houseBatchUiRefresh(){
 const root=document.getElementById('houseBatchTools');if(!root)return;
 const graph=activeGeometryNodeGraph();let config;
 try{config=graph&&houseBatchSettings(graph);}catch{config=null;}
 root.hidden=!config;if(!config)return;
 const select=root.querySelector('select'),old=new Set([...select.selectedOptions].map(o=>o.value));
 select.replaceChildren();
 const records=houseBatchRecords(graph);
 for(let i=0;i<config.settings.batchCount;i++){
  const id=houseBatchOutputId(graph,i),record=records.find(r=>r.id===id),option=document.createElement('option');
  option.value=String(i);option.textContent='House '+String(i+1).padStart(3,'0')+(record?' - '+record.width.toFixed(1)+' x '+record.depth.toFixed(1)+' / '+record.storeys+' floors':' - not built');option.selected=old.has(String(i));select.append(option);
 }
 root.querySelectorAll('button[data-batch-build]').forEach(b=>b.disabled=houseBatchBusy);
 root.querySelector('[data-batch-stop]').disabled=!houseBatchBusy;
}
// Merge by material inside each house, not across outputs; keep UVs and normals.
function houseBatchCombine(specs){
 const buckets=new Map();
 for(const spec of specs){const {geometry,name,position,rotation,scale,groupId,groupName,...appearance}=spec;
  const key=JSON.stringify(appearance);let bucket=buckets.get(key);
  if(!bucket){bucket={spec,positions:[],normals:[],uvs:[]};buckets.set(key,bucket);}
  const g=geometryFromData(geometry),flat=g.index?g.toNonIndexed():g;
  const p=flat.getAttribute('position');if(!flat.getAttribute('normal'))flat.computeVertexNormals();
  const n=flat.getAttribute('normal'),uv=flat.getAttribute('uv');
  for(let i=0;i<p.count;i++){bucket.positions.push(p.getX(i),p.getY(i),p.getZ(i));bucket.normals.push(n.getX(i),n.getY(i),n.getZ(i));bucket.uvs.push(uv?uv.getX(i):0,uv?uv.getY(i):0);}
  if(flat!==g)flat.dispose();g.dispose();
 }
 return [...buckets.values()].map((b,i)=>({...b.spec,name:'Material section '+(i+1),geometry:{positions:b.positions,normals:b.normals,uvs:b.uvs}}));
}
async function buildHouseBatch(graph,indices=null){
 if(houseBatchBusy){setGeometryNodeStatus('A house batch is already running.');return;}
 let config;try{config=houseBatchSettings(graph);}catch(error){setGeometryNodeStatus(error.message);return;}
 if(!config)return;
 const {source,active,params,settings}=config;
 const selected=indices===null?Array.from({length:settings.batchCount},(_,i)=>i):[...new Set(indices)].filter(i=>Number.isInteger(i)&&i>=0&&i<settings.batchCount);
 if(!selected.length){setGeometryNodeStatus('Select houses in House Outputs first.');return;}
 houseBatchBusy=true;houseBatchStop=false;houseBatchUiRefresh();
 const originalName=graph.name;let completed=0;
 try{
  recordHistory('rebuild house outputs');
  const records=houseBatchRecords(graph).map(r=>structuredClone(r));
  const attachmentTemplate=buildingAttachments(graph,source,active).filter(a=>a.type!=='houseBatch');
  const palettes=[['#bdaf92','#584132','#89513b','#928878'],['#d0c6ad','#493c32','#635e55','#88847a'],['#b3a18b','#69503c','#995e42','#9c8d76'],['#c6bca5','#504a40','#706758','#7c8176'],['#c2ab8d','#63432e','#815440','#a08f79']];
  const spacing=Math.max(settings.batchSpacing,Math.max(params.buildingWidth,params.buildingDepth)*(1+settings.batchVariation)+6);
  for(const index of selected){
   if(houseBatchStop)break;
   setGeometryNodeStatus('Building house '+(index+1)+' ('+(completed+1)+'/'+selected.length+')...');
   await new Promise(resolve=>setTimeout(resolve,0));
   const id=houseBatchOutputId(graph,index),seed=(graph.seed+Math.imul(index+1,7919))>>>0,rng=geometryNodePrng(seed);
   const p={...params,assetOffsetX:0,assetOffsetY:0,assetOffsetZ:0};
   p.buildingWidth=Math.max(4,Math.min(32,params.buildingWidth*(1+(rng()*2-1)*settings.batchVariation)));
   p.buildingDepth=Math.max(4,Math.min(32,params.buildingDepth*(1+(rng()*2-1)*settings.batchVariation)));
   if(settings.batchStoreys)p.buildingStoreys=1+Math.floor(rng()*params.buildingStoreys);
   const palette=palettes[Math.floor(rng()*palettes.length)];
   if(settings.batchPalette){p.buildingPlaster=palette[0];p.buildingTimber=palette[1];}
   const attachments=attachmentTemplate.map(a=>({...a,params:{...a.params}}));
   for(const a of attachments){
    if(a.type==='roof'){a.params.roofRise*=.85+rng()*.3;a.params.roofVariation=0;if(settings.batchPalette)a.params.roofColor=palette[2];}
    if(a.type==='foundation'){a.params.foundationVariation=0;if(settings.batchPalette)a.params.foundationColor=palette[3];}
    if(a.type==='diagonalBracing')a.params.braceStyle=['slash','alternating','cross'][Math.floor(rng()*3)];
   }
   const groupId='house-output-'+id,name=originalName+' / House '+String(index+1).padStart(3,'0');
   const group={id:groupId,name},specs=[];
   buildArchitecture('houseLayout',p,{graph:{...graph,seed},nodeId:source,group,outputName:name,attachments,emit:spec=>specs.push(spec)});
   const merged=houseBatchCombine(specs),x=(index%settings.batchColumns)*spacing,z=Math.floor(index/settings.batchColumns)*spacing;
   const cells=Array.from({length:p.buildingStoreys},(_,floor)=>({id:id+'-floor-'+(floor+1),kind:'reserved-floor-cell',floor:floor+1,bounds:{min:[-p.buildingWidth/2+p.buildingWallDepth/2,floor*p.buildingStoreyHeight,-p.buildingDepth/2+p.buildingWallDepth/2],max:[p.buildingWidth/2-p.buildingWallDepth/2,(floor+1)*p.buildingStoreyHeight,p.buildingDepth/2-p.buildingWallDepth/2]},occupied:false}));
   const signature=JSON.stringify({width:p.buildingWidth,depth:p.buildingDepth,height:p.buildingStoreyHeight,storeys:p.buildingStoreys,thick:p.buildingWallDepth,layout:attachments.filter(a=>['interiorPartition','staircase','chimney'].includes(a.type)).map(a=>({type:a.type,params:a.params}))});
   const old=records.find(r=>r.id===id),changed=!!old&&old.layoutSignature!==signature;
   const record={id,index,name,seed,width:p.buildingWidth,depth:p.buildingDepth,storeys:p.buildingStoreys,position:[x,0,z],cells,layoutSignature:signature,layoutRevision:(old?.layoutRevision||0)+(changed||!old?1:0),needsFurnishingReview:changed||!!old?.needsFurnishingReview};
   // Finish geometry preparation before replacing the old house. Other game assets are untouched.
   const previous=objects.filter(o=>o.userData?.gameAsset?.kind==='generated-house'&&o.userData.gameAsset.houseId===id);
   const added=[];
   try{
    if(!groupRecord(groupId))createSceneGroupRecord(group);
    for(const spec of merged){spec.name=name+' / '+spec.name;spec.position=[x,0,z];spec.gameAsset={kind:'generated-house',houseId:id,graphId:graph.id,cells,layoutRevision:record.layoutRevision,needsFurnishingReview:record.needsFurnishingReview};added.push(addObject(spec,{record:false,select:false,update:false}));}
   }catch(error){for(const o of added)removeObject(o,{record:false,update:false});throw error;}
   for(const o of previous)removeObject(o,{record:false,update:false});
   const at=records.findIndex(r=>r.id===id);if(at<0)records.push(record);else records[at]=record;
   graph.params.houseBatchOutputs=records;
   graph.generatedIds=objects.filter(o=>o.userData?.gameAsset?.kind==='generated-house'&&o.userData.gameAsset.graphId===graph.id).map(o=>o.userData.id);
   graph.buildVersion=(graph.buildVersion||0)+1;completed++;
   updateAll();
  }
  saveGeometryNodeDraft();
  setGeometryNodeStatus((houseBatchStop?'Stopped. ':'')+'Built '+completed+' house(s). Other outputs were kept.');
 }catch(error){console.error(error);setGeometryNodeStatus('Batch stopped: '+error.message+'. Completed houses are retained; Undo restores the previous scene.');}
 finally{houseBatchBusy=false;houseBatchUiRefresh();updateAll();}
}
function initializeHouseBatchTools(){
 const host=document.getElementById('geometryNodesBody');if(!host)return;
 const root=document.createElement('div');root.id='houseBatchTools';root.hidden=true;
 root.innerHTML='<h3>House Outputs</h3><p>Ctrl/Shift-click to select several houses. Each house keeps its own ID. Cells are reserved floor bounds, not furnished rooms.</p><select aria-label="House outputs" multiple size="7" style="width:100%"></select><div class="grid"><button type="button" data-batch-build="selected">Rebuild Selected</button><button type="button" data-batch-build="all">Rebuild All</button><button type="button" data-batch-stop>Stop after house</button></div><p>Batch parts are combined by material per house to keep the town manageable. Save Project preserves the generated houses and cell metadata; Save .bwnc preserves the recipe.</p>';
 host.prepend(root);
 root.addEventListener('click',event=>{const b=event.target.closest('button');if(!b)return;if(b.hasAttribute('data-batch-stop')){houseBatchStop=true;return;}const graph=activeGeometryNodeGraph();if(!graph)return;buildHouseBatch(graph,b.dataset.batchBuild==='all'?null:[...root.querySelector('select').selectedOptions].map(o=>Number(o.value)));});
 document.getElementById('geometryNodeGraphSelect')?.addEventListener('change',houseBatchUiRefresh);
 const canvas=document.getElementById('geometryNodeCanvas');if(canvas)new MutationObserver(houseBatchUiRefresh).observe(canvas,{childList:true});
 houseBatchUiRefresh();
}
initializeHouseBatchTools();
