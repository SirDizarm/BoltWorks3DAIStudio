// Registry drives defaults, controls and validation for procedural game assets.
const BWS_ASSET_NODES = Object.freeze({
 ...BWS_BUILDING_NODES,
 ...BWS_SCENE_ENVIRONMENT_NODES,
 ...BWS_DETAILED_NATURE_NODES,
 ...BWS_VILLAGE_PROP_NODES,
 ...BWS_DAMAGE_EFFECT_NODES,
 barrel:{title:"Barrel",fields:{barrelHeight:["Height",2,.3,8,.1],barrelRadius:["Radius",.7,.15,3,.05],barrelBulge:["Belly",.16,0,.8,.02],barrelThickness:["Wood thickness",.07,.02,.25,.01],barrelStaves:["Staves",16,8,32,1],barrelHoops:["Iron hoops",2,1,4,1],barrelMode:["Ends","closed",["closed","open","broken"]],barrelWood:["Wood","#936937"],barrelIron:["Iron","#414944"]}},
 brickWall:{title:"Brick Wall",fields:{brickCopies:["Wall copies",1,1,12,1],brickRepeat:["Seamless horizontal repeat",false],brickLength:["Length",6,.5,20,.25],brickHeight:["Height",3,.3,10,.1],brickDepth:["Depth",.4,.1,2,.05],brickColumns:["Columns",8,1,24,1],brickRows:["Courses",8,1,20,1],brickGap:["Joint fraction",.06,0,.2,.01],brickVariation:["Color variation",.12,0,.35,.01],brickColor:["Brick","#846c58"],brickMortar:["Mortar","#494943"]}},
 houseWall:{title:"House Wall",fields:{houseWidth:["Width",6,1,20,.25],houseHeight:["Height",3,1,10,.1],houseDepth:["Thickness",.24,.1,1,.02],houseBays:["Frame bays",3,1,12,1],houseBeam:["Beam width",.16,.05,.4,.01],houseOpening:["Opening","door",["none","door","window"]],houseOpeningWidth:["Opening width",1.2,.3,5,.1],houseOpeningHeight:["Opening height",2,.3,4,.1],houseSill:["Window sill",.9,.1,3,.1],housePanel:["Plaster","#b1a58b"],houseTimber:["Timber","#65462e"]}},
 groundTiles:{title:"Ground Tiles",fields:{tileColumns:["Columns",4,1,16,1],tileRows:["Rows",4,1,16,1],tileSize:["Grid size",1,.2,4,.1],tileThickness:["Thickness",.15,.03,1,.01],tileGap:["Joint fraction",.025,0,.15,.005],tileVariation:["Color variation",.1,0,.3,.01],tileColor:["Stone","#737b72"],tileBase:["Joint base",true]}}
});
function assetNodeDefaults(){const p={assetOffsetX:0,assetOffsetY:0,assetOffsetZ:0};for(const n of Object.values(BWS_ASSET_NODES))for(const[k,f]of Object.entries(n.fields))p[k]=f[1];return p;}
function assetNodeSanitize(source){const p={};for(const n of Object.values(BWS_ASSET_NODES))for(const[k,f]of Object.entries(n.fields)){const v=source[k];p[k]=typeof f[1]==="number"?geometryNodeNumber(v,f[1],f[2],f[3]):typeof f[1]==="boolean"?(typeof v==="boolean"?v:f[1]):Array.isArray(f[2])?(f[2].includes(v)?v:f[1]):(/^#[0-9a-f]{6}$/i.test(v||"")?v:f[1]);if(typeof f[1]==="number"&&f[4]===1)p[k]=Math.round(p[k]);}for(const a of["X","Y","Z"])p["assetOffset"+a]=geometryNodeNumber(source["assetOffset"+a],0,-100,100);return p;}
function assetNodeFields(type,source,instanceId){const p=assetNodeSanitize(source);let html="";for(const[k,f]of Object.entries(BWS_ASSET_NODES[type].fields))html+=Array.isArray(f[2])?geometryNodeSelectField(f[0],k,p[k],f[2].map(x=>[x,x]),instanceId):geometryNodeField(f[0],k,p[k],{instanceId,type:typeof f[1]==="boolean"?"checkbox":typeof f[1]==="number"?"number":"color",min:f[2],max:f[3],step:f[4]});for(const a of(BWS_ASSET_NODES[type].attachment?[]:["X","Y","Z"]))html+=geometryNodeField("Offset "+a,"assetOffset"+a,p["assetOffset"+a],{instanceId,min:-100,max:100,step:.1});if(type==="brickWall")html+='<button type="button" data-geometry-wall-copy="'+geometryNodeEscape(instanceId)+'">Add copy right</button>';if(type==="brickWall")html+='<p class="geometry-node-card-note">Repeat mode: place copies exactly Length units apart on X. Edge halves share texture, UVs and color. Horizontal only.</p>';if(BWS_ASSET_NODES[type].attachment)return html+'<p class="geometry-node-card-note">Connect after House Layout or House Wall, then onward to Group Output. Uses source dimensions. Roof and Floor require House Layout.</p>';return html+'<p class="geometry-node-card-note">Y up, base at zero. Connect to Group Output. Bake keeps parts editable. Duplicate cards have independent values.</p>';}
// Closed annular sectors: outer/inner skins, radial sides, and top/bottom caps.
function assetNodeSector(profile,a0,a1,steps){const vertices=[],uv=[];
 function quad(a,b,c,d,out){const ab=new THREE.Vector3().subVectors(b,a),ac=new THREE.Vector3().subVectors(c,a),reverse=ab.cross(ac).dot(out)<0;for(const i of(reverse?[0,2,1,0,3,2]:[0,1,2,0,2,3])){vertices.push(...[a,b,c,d][i].toArray());uv.push(...[[0,0],[1,0],[1,1],[0,1]][i]);}}
 const point=(r,y,a)=>new THREE.Vector3(r*Math.cos(a),y,r*Math.sin(a));
 for(let s=0;s<steps;s++){const a=a0+(a1-a0)*s/steps,b=a0+(a1-a0)*(s+1)/steps,m=(a+b)/2;for(let j=0;j<profile.length-1;j++){const l=profile[j],h=profile[j+1];for(const inner of[false,true]){const k=inner?2:1;quad(point(l[k],l[0],a),point(l[k],l[0],b),point(h[k],h[0],b),point(h[k],h[0],a),new THREE.Vector3(Math.cos(m)*(inner?-1:1),0,Math.sin(m)*(inner?-1:1)));}}for(const top of[false,true]){const p=profile[top?profile.length-1:0];quad(point(p[2],p[0],a),point(p[1],p[0],a),point(p[1],p[0],b),point(p[2],p[0],b),new THREE.Vector3(0,top?1:-1,0));}}
 for(const end of[false,true]){const a=end?a1:a0;for(let j=0;j<profile.length-1;j++){const l=profile[j],h=profile[j+1];quad(point(l[2],l[0],a),point(l[1],l[0],a),point(h[1],h[0],a),point(h[2],h[0],a),new THREE.Vector3(-Math.sin(a)*(end?1:-1),0,Math.cos(a)*(end?1:-1)));}}
 const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));g.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();return g;
}
function assetNodeBuild(type,source,{graph,nodeId,group,outputName,emit,attachments=[]}){
 const p=assetNodeSanitize(source);
 if(BWS_DAMAGE_EFFECT_NODES[type])return bwsBuildDamageNode(type,p,{graph,nodeId,group,outputName,emit});
 if(BWS_ASSET_NODES[type]?.attachment)return 0;
 if(BWS_VILLAGE_PROP_NODES[type])return bwsBuildVillageProp(type,p,{graph,nodeId,group,outputName,emit});
 if(BWS_DETAILED_NATURE_NODES[type])return bwsBuildDetailedNature(type,p,{graph,nodeId,group,outputName,emit});
 if(BWS_SCENE_ENVIRONMENT_NODES[type])return bwsBuildEnvironmentNode(type,p,{graph,nodeId,group,outputName,emit});
 if(type==="houseLayout" || (type==="houseWall" && attachments.length))return buildArchitecture(type,p,{graph,nodeId,group,outputName,emit,attachments});
 const random=geometryNodePrng(graph.seed+graph.nodeOrder.indexOf(nodeId)*7919);let count=0;
 function add(g,name,x,y,z,color,textureKey=undefined,textureParams=undefined){const spec=geometryNodeCustomSpec(g,{textureKey,textureParams,name:`${outputName} ${nodeId} ${name}`,position:[x+p.assetOffsetX,y+p.assetOffsetY,z+p.assetOffsetZ],color,group,graph,targetId:nodeId});
  emit(spec);count++;
  if(type==="brickWall")for(let copy=1;copy<p.brickCopies;copy++){
    emit({...spec,geometry:structuredClone(spec.geometry),name:spec.name+" copy "+(copy+1),position:[spec.position[0]+copy*p.brickLength,spec.position[1],spec.position[2]]});count++;
  }
 }
 function box(name,x,y,z,w,h,d,color){if(w<=.0001||h<=.0001||d<=.0001)return;add(new THREE.BoxGeometry(w,h,d),name,x,y,z,color);}
 function tint(color,amount){const c=new THREE.Color(color);c.multiplyScalar(1+(random()-.5)*amount);return '#'+c.getHexString();}
 if(type==="barrel"){
  const h=p.barrelHeight,r=p.barrelRadius,t=Math.min(p.barrelThickness,r*.35),n=p.barrelStaves,radius=y=>r+p.barrelBulge*Math.sin(Math.PI*y/h);
  for(let i=0;i<n;i++){const top=p.barrelMode==="broken"&&i%3!==0?h*(.67+random()*.25):h,profile=[];for(let j=0;j<=6;j++){const y=top*j/6,outer=radius(y);profile.push([y,outer,outer-t]);}add(assetNodeSector(profile,i*2*Math.PI/n+.002,(i+1)*2*Math.PI/n-.002,1),`wood stave ${i+1}`,0,0,0,tint(p.barrelWood,.16));}
  for(let i=0;i<p.barrelHoops;i++){const y=h*(.13+.74*(i+.5)/p.barrelHoops),band=Math.min(h*.07,.16),lo=y-band/2,hi=y+band/2;add(assetNodeSector([[lo,radius(lo)+.035,radius(lo)+.007],[hi,radius(hi)+.035,radius(hi)+.007]],0,Math.PI*2,n),`iron hoop ${i+1}`,0,0,0,p.barrelIron);}
  const capRadius=r-t+.008,capDepth=Math.min(t,h*.08);
  function lid(y,label){const poly=Array.from({length:n},(_,i)=>[capRadius*Math.cos(i*2*Math.PI/n),capRadius*Math.sin(i*2*Math.PI/n)]);
   function clip(points,bound,lower){const out=[];for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],ia=lower?a[0]>=bound:a[0]<=bound,ib=lower?b[0]>=bound:b[0]<=bound;if(ia)out.push(a);if(ia!==ib){const f=(bound-a[0])/(b[0]-a[0]);out.push([bound,a[1]+f*(b[1]-a[1])]);}}return out;}
   for(let i=0;i<5;i++){const left=-capRadius+2*capRadius*i/5,right=-capRadius+2*capRadius*(i+1)/5,pts=clip(clip(poly,left,true),right,false);if(pts.length<3)continue;const shape=new THREE.Shape();shape.moveTo(...pts[0]);pts.slice(1).forEach(v=>shape.lineTo(...v));shape.closePath();const g=new THREE.ExtrudeGeometry(shape,{depth:capDepth,bevelEnabled:false,steps:1});g.rotateX(-Math.PI/2);add(g,`${label} plank ${i+1}`,0,y,0,tint(p.barrelWood,.14));}}
  lid(0,"bottom");if(p.barrelMode==="closed")lid(h-capDepth,"lid");
 }
 if(type==="brickWall"){
  const w=p.brickLength,h=p.brickHeight,d=p.brickDepth,cw=w/p.brickColumns,rh=h/p.brickRows,gap=p.brickGap;
  if(p.brickRepeat) add(new THREE.BoxGeometry(w,h,d*.72),"mortar core",0,h/2,0,p.brickMortar,undefined,null);
  else box("mortar core",0,h/2,0,w,h,d*.72,p.brickMortar);
  for(let row=0;row<p.brickRows;row++)for(let col=-1;col<p.brickColumns;col++){
   const fullLeft=-w/2+(col+(row%2)*.5)*cw,fullRight=fullLeft+cw;
   if(!p.brickRepeat){
    const left=Math.max(-w/2,fullLeft),right=Math.min(w/2,fullRight);
    if(right<=left)continue;
    box(`course ${row+1} brick ${col+2}`,(left+right)/2,(row+.5)*rh,0,(right-left)*(1-gap),rh*(1-gap),d,tint(p.brickColor,p.brickVariation));
    continue;
   }
   // Inset the full brick BEFORE clipping at the repeat boundary. End half-bricks
   // meet without a false mortar joint when another wall is placed at X + length.
   const left=Math.max(-w/2,fullLeft+cw*gap/2),right=Math.min(w/2,fullRight-cw*gap/2);
   if(right-left<=.0001)continue;
   const canonical=((col%p.brickColumns)+p.brickColumns)%p.brickColumns;
   const key=`repeat course ${row} brick ${canonical}`;
   const colorRandom=geometryNodePrng((graph.seed + row*73856093 + canonical*19349663)>>>0);
   const color=new THREE.Color(p.brickColor).multiplyScalar(1+(colorRandom()-.5)*p.brickVariation);
   const center=(left+right)/2,fullCenter=(fullLeft+fullRight)/2;
   const geometry=new THREE.BoxGeometry(right-left,rh*(1-gap),d);
   const pos=geometry.getAttribute("position"),normal=geometry.getAttribute("normal"),uv=geometry.getAttribute("uv");
   for(let v=0;v<pos.count;v++){
    // Preserve the UV region of the original full brick instead of stretching
    // each cut half to fill the entire source image.
    const nx=normal.getX(v),ny=normal.getY(v),nz=normal.getZ(v);
    if(Math.abs(nx)<.5){
     const u=(pos.getX(v)+center-fullCenter)/(cw*(1-gap))+.5;
     uv.setX(v,nz<-.5?1-u:u);
    }
   }
   uv.needsUpdate=true;
   add(geometry,`course ${row+1} brick ${col+2}`,center,(row+.5)*rh,0,'#'+color.getHexString(),key);
  }
 }
 if(type==="houseWall"){
  const w=p.houseWidth,h=p.houseHeight,d=p.houseDepth,b=Math.min(p.houseBeam,w*.12,h*.12);
  const ow=Math.min(p.houseOpeningWidth,w-4*b),sill=p.houseOpening==="window"?Math.min(p.houseSill,h-3*b):0;
  const oh=Math.min(p.houseOpeningHeight,h-sill-2*b),has=p.houseOpening!=="none",left=-ow/2,right=ow/2,top=sill+oh;
  // Partition the frame/infill union. No overlapping solids or coincident exterior
  // faces at rail/stud crossings; openings are removed from every material.
  const frames=[];
  function frame(x0,y0,x1,y1){frames.push({x0:Math.max(-w/2,x0),y0:Math.max(0,y0),x1:Math.min(w/2,x1),y1:Math.min(h,y1)});}
  frame(-w/2,0,w/2,b);frame(-w/2,h-b,w/2,h);
  for(let i=0;i<=p.houseBays;i++){const x=-w/2+b/2+(w-b)*i/p.houseBays;frame(x-b/2,0,x+b/2,h);}
  if(has){frame(left-b,0,left,top);frame(right,0,right+b,top);frame(left-b,top,right+b,top+b);if(sill>0)frame(left-b,sill-b,right+b,sill);}
  const unique=values=>[...new Set(values.map(v=>Math.round(v*1e8)/1e8))].sort((a,b)=>a-b);
  const xs=unique([-w/2,w/2,...frames.flatMap(r=>[r.x0,r.x1]),...(has?[left,right]:[])]);
  const ys=unique([0,h,...frames.flatMap(r=>[r.y0,r.y1]),...(has?[sill,top]:[])]);
  const rectangles=[];let previous=new Map();
  for(let row=0;row<ys.length-1;row++){
    const y0=ys[row],y1=ys[row+1],cy=(y0+y1)/2,runs=[];
    for(let col=0;col<xs.length-1;col++){
      const x0=xs[col],x1=xs[col+1],cx=(x0+x1)/2;
      if(x1-x0<1e-7||y1-y0<1e-7)continue;
      if(has&&cx>left&&cx<right&&cy>sill&&cy<top)continue;
      const timber=frames.some(r=>cx>r.x0&&cx<r.x1&&cy>r.y0&&cy<r.y1);
      const last=runs[runs.length-1];
      if(last&&last.timber===timber&&Math.abs(last.x1-x0)<1e-7)last.x1=x1;
      else runs.push({x0,x1,y0,y1,timber});
    }
    const current=new Map();
    for(const run of runs){const key=[run.x0,run.x1,run.timber].join(':');const old=previous.get(key);
      if(old&&Math.abs(old.y1-y0)<1e-7){old.y1=y1;current.set(key,old);}
      else{rectangles.push(run);current.set(key,run);}
    }
    previous=current;
  }
  rectangles.forEach((r,i)=>box((r.timber?"timber section ":"plaster panel ")+(i+1),(r.x0+r.x1)/2,(r.y0+r.y1)/2,0,r.x1-r.x0,r.y1-r.y0,r.timber?d+.05:d,r.timber?p.houseTimber:p.housePanel));
 }
 if(type==="groundTiles"){const s=p.tileSize,h=p.tileThickness,w=p.tileColumns*s,d=p.tileRows*s;if(p.tileBase)box("joint foundation",0,h*.2,0,w,h*.4,d,"#454a45");for(let row=0;row<p.tileRows;row++)for(let col=0;col<p.tileColumns;col++)box(`slab ${row+1}.${col+1}`,(col+.5)*s-w/2,h/2,(row+.5)*s-d/2,s*(1-p.tileGap),h,s*(1-p.tileGap),tint(p.tileColor,p.tileVariation));}
 return count;
}
