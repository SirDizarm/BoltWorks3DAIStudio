// Architecture recipe nodes. Attachments modify their connected source, not scene meshes.
const BWS_BUILDING_NODES={
 ...BWS_BUILDING_DETAIL_NODES,
 houseBatch:{title:"House Batch",category:"Architecture",attachment:true,fields:{batchCount:["House count",60,1,100,1],batchColumns:["Town columns",10,1,20,1],batchSpacing:["Plot spacing",24,8,70,1],batchVariation:["Size variation",.25,0,.5,.05],batchStoreys:["Vary storeys",true],batchPalette:["Vary palette",true]}},
 houseLayout:{title:"House Layout",category:"Architecture",fields:{buildingWidth:["Width",6,2,32,.25],buildingDepth:["Depth",5,2,32,.25],buildingStoreys:["Storeys",2,1,3,1],buildingStoreyHeight:["Storey height",3,2,5,.1],buildingWallDepth:["Wall thickness",.24,.1,.6,.02],buildingBays:["Frame bays",3,1,12,1],buildingBeam:["Beam width",.16,.06,.3,.01],buildingPlaster:["Plaster","#b1a58b"],buildingTimber:["Timber","#65462e"]}},
 floor:{title:"Floor",category:"Architecture",attachment:true,fields:{floorStyle:["Surface","boards",["boards","stone"]],floorDivisions:["Divisions",8,2,16,1],floorThickness:["Thickness",.15,.05,.3,.01],floorColor:["Surface color","#846747"]}},
 window:{title:"Window",category:"Architecture",attachment:true,fields:{windowSide:["Wall","all",["front","back","left","right","all"]],windowLevel:["Storey",2,1,3,1],windowCount:["Count per wall",1,0,12,1],windowPerSide:["Use separate side counts",false],windowFrontCount:["Front windows",1,0,12,1],windowBackCount:["Back windows",1,0,12,1],windowLeftCount:["Left windows",1,0,12,1],windowRightCount:["Right windows",1,0,12,1],windowWidth:["Width",1.1,.3,3,.1],windowHeight:["Height",1.3,.3,3,.1],windowSill:["Sill height",.85,.1,2,.05],windowStyle:["Style","cross",["cross","plain","shutters"]],windowColor:["Frame color","#685039"]}},
 door:{title:"Door",category:"Architecture",attachment:true,fields:{doorSide:["Wall","front",["front","back","left","right"]],doorLevel:["Storey",1,1,3,1],doorWidth:["Width",1.2,.4,3,.1],doorHeight:["Height",2.1,1,3,.1],doorPosition:["Horizontal position",0,-.8,.8,.05],doorStyle:["Style","planks",["planks","open"]],doorColor:["Wood","#785234"]}},
 opening:{title:"Opening",category:"Architecture",attachment:true,fields:{openingSide:["Wall","front",["front","back","left","right"]],openingLevel:["Storey",1,1,3,1],openingWidth:["Width",1.2,.3,4,.1],openingHeight:["Height",2,.3,3,.1],openingSill:["Bottom height",0,0,2,.05],openingPosition:["Horizontal position",0,-.8,.8,.05]}},
 roof:{title:"Roof",category:"Architecture",attachment:true,fields:{roofRidgeTiles:["Rounded ridge caps",true],roofRidgeLength:["Ridge tile length",.65,.3,1.5,.05],roofRise:["Rise",2,.3,5,.1],roofOverhang:["Overhang",.35,.05,1,.05],roofRows:["Tile courses",10,2,16,1],roofColumns:["Tiles along ridge",14,2,20,1],roofVariation:["Seed color variation",.16,0,.35,.01],roofStyle:["Tile style","clay",["clay","slate","shingles","curved","scalloped"]],roofColor:["Tile color","#86513b"]}},
 diagonalBracing:{title:"Diagonal Bracing",category:"Architecture",attachment:true,fields:{braceStyle:["Pattern","alternating",["slash","alternating","cross"]],braceWidth:["Width",.13,.04,.25,.01]}}
};
function buildingAttachments(graph,sourceId,active){const out=[],seen=new Set([sourceId]),queue=[sourceId];while(queue.length){const id=queue.shift();for(const c of graph.connections.filter(c=>c.fromNodeId===id)){if(seen.has(c.toNodeId)||!active.has(c.toNodeId))continue;seen.add(c.toNodeId);const type=geometryNodeTypeForId(graph,c.toNodeId);if(BWS_BUILDING_NODES[type]?.attachment){out.push({type,nodeId:c.toNodeId,params:assetNodeSanitize(graph.nodeParams?.[c.toNodeId]||graph.params)});queue.push(c.toNodeId);}else if(type==="join"||type==="transform")queue.push(c.toNodeId);}}return out;}
function buildArchitecture(type,p,ctx){
 const {graph,nodeId,group,outputName,emit,attachments=[]}=ctx;
 const isHouse=type==="houseLayout",W=isHouse?p.buildingWidth:p.houseWidth,D=isHouse?p.buildingDepth:.24,H=isHouse?p.buildingStoreyHeight:p.houseHeight,levels=isHouse?p.buildingStoreys:1;
 const thick=isHouse?p.buildingWallDepth:p.houseDepth,beam=Math.min(isHouse?p.buildingBeam:p.houseBeam,W*.1,H*.1),bays=isHouse?p.buildingBays:p.houseBays;
 const plaster=isHouse?p.buildingPlaster:p.housePanel,timber=isHouse?p.buildingTimber:p.houseTimber;
 const stairNode=isHouse?attachments.find(a=>a.type==='staircase'):null;
 const planInset=isHouse&&attachments.find(a=>a.type==='medievalStyle')?.params.medievalStoneGround?Math.min(attachments.find(a=>a.type==='medievalStyle').params.medievalStoneInset,(Math.min(W,D)-2)/2):0;
 const stairPlan=architectureStairPlan(W-2*planInset,D-2*planInset,H,thick,stairNode?.params);
 const attic=!!(stairPlan&&stairNode.params.stairsAttic&&attachments.some(a=>a.type==='roof'));
 const medieval=attachments.find(a=>a.type==='medievalStyle');
 const effectiveRoofRise=rise=>{if(medieval?.params.medievalSteepRoof)rise=Math.max(rise,(W/2+(attachments.find(a=>a.type==='roof')?.params.roofOverhang||0))*Math.tan(THREE.MathUtils.degToRad(medieval.params.medievalRoofPitch)));return attic?Math.max(rise,2.25/Math.max(.25,1-(Math.max(Math.abs(stairPlan.x0),Math.abs(stairPlan.x1))+.10)/(W/2))):rise;};
 const offset=new THREE.Vector3(p.assetOffsetX,p.assetOffsetY,p.assetOffsetZ);let serial=0;
 function geom(g,name,color,position=new THREE.Vector3(),rotation=0,source=nodeId){g.rotateY(rotation);g.translate(position.x+offset.x,position.y+offset.y,position.z+offset.z);emit(geometryNodeCustomSpec(g,{name:outputName+' '+nodeId+' '+name+' '+(++serial),position:[0,0,0],color,group,graph,targetId:source}));}
 function box(name,x,y,z,w,h,d,color,origin=new THREE.Vector3(),angle=0,source=nodeId){if(Math.min(w,h,d)<.00001)return;const g=new THREE.BoxGeometry(w,h,d);g.translate(x,y,z);geom(g,name,color,origin,angle,source);}
 function polygon(points,depth,name,color,origin,angle){if(points.length<3)return;let area=0;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];area+=a[0]*b[1]-b[0]*a[1];}if(Math.abs(area)<1e-8)return;const shape=new THREE.Shape();shape.moveTo(...points[0]);points.slice(1).forEach(v=>shape.lineTo(...v));shape.closePath();const g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,steps:1});g.translate(0,0,-depth/2);geom(g,name,color,origin,angle);}
 function clip(poly,a,b,inside=true){const out=[],cross=v=>(b[0]-a[0])*(v[1]-a[1])-(b[1]-a[1])*(v[0]-a[0]);for(let i=0;i<poly.length;i++){const v=poly[i],w=poly[(i+1)%poly.length],dv=cross(v),dw=cross(w),iv=inside?dv>=-1e-9:dv<=1e-9,iw=inside?dw>=-1e-9:dw<=1e-9;if(iv)out.push(v);if(iv!==iw){const t=dv/(dv-dw);out.push([v[0]+t*(w[0]-v[0]),v[1]+t*(w[1]-v[1])]);}}return out;}
 function partition(poly,cutter){let remaining=poly;const outside=[];for(let i=0;i<cutter.length&&remaining.length;i++){const a=cutter[i],b=cutter[(i+1)%cutter.length],piece=clip(remaining,a,b,false);if(piece.length>=3)outside.push(piece);remaining=clip(remaining,a,b,true);}return {outside,inside:remaining};}
 const stoneInset=isHouse&&medieval?.params.medievalStoneGround?Math.min(medieval.params.medievalStoneInset,(Math.min(W,D)-2)/2):0;
 const sides=isHouse?[['front',W,new THREE.Vector3(0,0,D/2),0],['back',W,new THREE.Vector3(0,0,-D/2),Math.PI],['left',D,new THREE.Vector3(-W/2,0,0),-Math.PI/2],['right',D,new THREE.Vector3(W/2,0,0),Math.PI/2]]:[['front',W,new THREE.Vector3(),0]];
 for(let level=1;level<=levels;level++)for(const[side,outerWidth,base,angle]of sides){const stoneGround=level===1&&!!medieval?.params.medievalStoneGround,inset=level===1?stoneInset:0,width=outerWidth-2*inset,origin=base.clone().add(new THREE.Vector3(-Math.sin(angle)*inset,(level-1)*H,-Math.cos(angle)*inset)),holes=[];
  function hole(cx,sill,w,h,kind,settings,source){const maxW=width-4*beam;w=Math.min(w,maxW);sill=Math.max(0,Math.min(sill,H-3*beam));h=Math.min(h,H-sill-2*beam);cx=Math.max(-width/2+beam+w/2,Math.min(width/2-beam-w/2,cx));const r={x0:cx-w/2,x1:cx+w/2,y0:sill,y1:sill+h,kind,settings,source};if(holes.some(q=>r.x0-beam<q.x1+beam&&r.x1+beam>q.x0-beam&&r.y0-beam<q.y1+beam&&r.y1+beam>q.y0-beam))return;if(kind==='window'&&level===1&&stairPlan){
 const world=new THREE.Vector3(cx,0,0).applyAxisAngle(new THREE.Vector3(0,1,0),angle).add(origin),pad=.9;
 const adjacent=(side==='left'||side==='right')?world.x>=stairPlan.x0-pad&&world.x<=stairPlan.x1+pad&&world.z+w/2>stairPlan.z0-.15&&world.z-w/2<stairPlan.z1+.15:world.z>=stairPlan.z0-pad&&world.z<=stairPlan.z1+pad&&world.x+w/2>stairPlan.x0-.15&&world.x-w/2<stairPlan.x1+.15;
 if(adjacent)return;
 }holes.push(r);}
  const balcony=attachments.find(a=>a.type==='balcony' && a.params.balconyLevel===level && a.params.balconySide===side);
  let balconyFit=null;
  if(balcony&&isHouse){const v=balcony.params,bw=Math.min(v.balconyWidth,width-2*beam),dw=Math.min(v.balconyDoorWidth,bw-.2),cx=Math.max(-width/2+beam+bw/2,Math.min(width/2-beam-bw/2,v.balconyPosition*width/2));hole(cx,0,dw,v.balconyDoorHeight,'door',{doorStyle:'planks',doorColor:v.balconyColor},balcony.nodeId);balconyFit={cx,width:bw};}
  const openingNodes=attachments.filter(a=>['window','door','opening'].includes(a.type)).sort((a,b)=>(a.type==='window'?1:0)-(b.type==='window'?1:0));
  for(const a of openingNodes){const v=a.params,k=a.type;if(v[k+'Level']!==level||!(v[k+'Side']==='all'||v[k+'Side']===side))continue;if(k==='window'){const requested=v.windowPerSide?v['window'+side[0].toUpperCase()+side.slice(1)+'Count']:v.windowCount,count=Math.min(requested,Math.max(0,Math.floor((width-2*beam)/(.3+2*beam))));if(!count)continue;const span=(width-2*beam)/count;for(let i=0;i<count;i++)hole(-width/2+beam+span*(i+.5),v.windowSill,Math.min(v.windowWidth,span-2*beam),v.windowHeight,k,v,a.nodeId);}else hole(v[k+'Position']*(width/2-beam),k==='door'?0:v.openingSill,v[k+'Width'],v[k+'Height'],k,v,a.nodeId);}
  if(!isHouse&&!openingNodes.length&&p.houseOpening!=='none')hole(0,p.houseOpening==='window'?p.houseSill:0,p.houseOpeningWidth,p.houseOpeningHeight,'opening',{},nodeId);
  const frames=[[-width/2,0,width/2,beam],[-width/2,H-beam,width/2,H]];
  for(let i=0;i<=bays;i++){const x=-width/2+beam/2+(width-beam)*i/bays;frames.push([x-beam/2,0,x+beam/2,H]);}
  for(const r of holes){frames.push([r.x0-beam,Math.max(0,r.y0-beam),r.x0,r.y1+beam],[r.x1,Math.max(0,r.y0-beam),r.x1+beam,r.y1+beam],[r.x0,r.y1,r.x1,r.y1+beam]);if(r.y0>0)frames.push([r.x0,r.y0-beam,r.x1,r.y0]);}
  const braces=[],bracing=attachments.find(a=>a.type==='diagonalBracing');
  if(bracing&&!stoneGround){const bw=bracing.params.braceWidth;for(let i=0;i<bays;i++){const x0=-width/2+beam+(width-beam)*i/bays,x1=-width/2+(width-beam)*(i+1)/bays,y0=beam,y1=H-beam;for(const flip of(bracing.params.braceStyle==='cross'?[false,true]:[bracing.params.braceStyle==='alternating'&&i%2===1])){const a=[x0,flip?y1:y0],b=[x1,flip?y0:y1],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy),nx=-dy/len*bw/2,ny=dx/len*bw/2;let q=[[a[0]+nx,a[1]+ny],[a[0]-nx,a[1]-ny],[b[0]-nx,b[1]-ny],[b[0]+nx,b[1]+ny]];braces.push(q);}}}
  const unique=v=>[...new Set(v.map(x=>Math.max(0,Math.min(1,x))))];
  const xs=[...new Set([-width/2,width/2,...frames.flatMap(r=>[r[0],r[2]]),...holes.flatMap(r=>[r.x0,r.x1])])].sort((a,b)=>a-b),ys=[...new Set([0,H,...frames.flatMap(r=>[r[1],r[3]]),...holes.flatMap(r=>[r.y0,r.y1])])].sort((a,b)=>a-b);
  for(let yi=0;yi<ys.length-1;yi++)for(let xi=0;xi<xs.length-1;xi++){const x0=xs[xi],x1=xs[xi+1],y0=ys[yi],y1=ys[yi+1],cx=(x0+x1)/2,cy=(y0+y1)/2;if(x1-x0<1e-6||y1-y0<1e-6||holes.some(r=>cx>r.x0&&cx<r.x1&&cy>r.y0&&cy<r.y1))continue;const framed=frames.some(r=>cx>r[0]&&cx<r[2]&&cy>r[1]&&cy<r[3]);if(framed){box(side+' frame',cx,cy,0,x1-x0,y1-y0,stoneGround?thick:thick+.05,stoneGround?medieval.params.medievalStoneColor:timber,origin,angle);continue;}let pieces=[[[x0,y0],[x1,y0],[x1,y1],[x0,y1]]];for(const brace of braces){const next=[];for(const piece of pieces){const cut=partition(piece,brace);polygon(cut.inside,thick+.05,side+' diagonal',timber,origin,angle);next.push(...cut.outside);}pieces=next;}for(const piece of pieces)polygon(piece,thick,side+' plaster',stoneGround?medieval.params.medievalStoneColor:plaster,origin,angle);}
  architectureWallDetails(attachments,{width,H,level,origin,angle,thick,holes,box,geom,graph,side,isHouse});
  if(balconyFit){const v=balcony.params,cx=balconyFit.cx,bw=balconyFit.width,depth=v.balconyDepth,rh=v.balconyRailHeight,z=thick/2,color=v.balconyColor;
    box('balcony deck',cx,-.075,z+depth/2,bw,.15,depth,color,origin,angle,balcony.nodeId);
    for(let i=0;i<=6;i++)box('balcony front baluster',cx-bw/2+i*bw/6,rh/2,z+depth-.04,.055,rh,.055,color,origin,angle,balcony.nodeId);
    box('balcony front rail',cx,rh,z+depth-.04,bw+.06,.07,.08,color,origin,angle,balcony.nodeId);
    for(const sign of[-1,1]){box('balcony side rail',cx+sign*(bw/2-.025),rh,z+depth/2,.07,.07,depth,color,origin,angle,balcony.nodeId);for(let i=1;i<4;i++)box('balcony side baluster',cx+sign*(bw/2-.025),rh/2,z+i*depth/4,.055,rh,.055,color,origin,angle,balcony.nodeId);
      const start=new THREE.Vector3(cx+sign*bw*.34,-.7,z+.02),end=new THREE.Vector3(cx+sign*bw*.34,-.15,z+depth*.75),delta=end.clone().sub(start),g=new THREE.BoxGeometry(.11,delta.length(),.11);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));g.translate(...start.add(end).multiplyScalar(.5).toArray());geom(g,'balcony support',color,origin,angle,balcony.nodeId);
    }
  }
  for(const r of holes){const cx=(r.x0+r.x1)/2,cy=(r.y0+r.y1)/2,w=r.x1-r.x0,h=r.y1-r.y0,v=r.settings;if(r.kind==='door'&&v.doorStyle!=='open'){for(let j=0;j<6;j++)box('door plank',r.x0+(j+.5)*w/6,cy+.0275,0,w/6-.006,h-.055,.07,v.doorColor,origin,angle,r.source);box('door handle',r.x1-.12,cy,thick/2+.03,.045,.12,.04,'#393b37',origin,angle,r.source);}if(r.kind==='window'){box('window glass',cx,cy,0,w,h,.025,'#40585c',origin,angle,r.source);if(medieval?.params.medievalLeadedGlass)architectureWindowLeading(w,h,cx,cy,origin,angle,r.source,geom);if(v.windowStyle!=='plain'){box('window mullion',cx,cy,.035,.045,h,.045,v.windowColor,origin,angle,r.source);box('window transom',cx,cy,.035,w,.045,.045,v.windowColor,origin,angle,r.source);}if(v.windowStyle==='shutters')for(const sign of[-1,1])box('open shutter',cx+sign*(w/2+w/4+.06),cy,thick/2+.06,w*.43,h,.05,v.windowColor,origin,angle,r.source);}}
 }
 if(isHouse)architectureInteriorAndCorners(attachments,{W,D,H,levels,thick,stairPlan,box,graph,stoneInset,geom});
 const floor=attachments.find(a=>a.type==='floor') || (stairNode?{params:assetNodeSanitize({}),nodeId:stairNode.nodeId}:null);
 if(isHouse&&floor){const f=floor.params;
  for(let l=0;l<levels+(attic?1:0);l++){
   const inset=l===0?stoneInset:0,iw=W-thick-2*inset,id=D-thick-2*inset;
   const n=f.floorDivisions,rows=f.floorStyle==='stone'?Math.max(1,Math.round(n*id/iw)):1;
   for(let x=0;x<n;x++)for(let z=0;z<rows;z++){
    const x0=-iw/2+x*iw/n,x1=x0+iw/n,z0=-id/2+z*id/rows,z1=z0+id/rows;
    let pieces=[[x0,z0,x1,z1]];
    if(l>0&&stairPlan){const cut={x0:stairPlan.x0-.08,x1:stairPlan.x1+.08,z0:stairPlan.z0-.025,z1:stairPlan.z1+.025};
     const a=Math.max(x0,cut.x0),b=Math.min(x1,cut.x1),c=Math.max(z0,cut.z0),d=Math.min(z1,cut.z1);
     if(a<b&&c<d)pieces=[[x0,z0,a,z1],[b,z0,x1,z1],[a,z0,b,c],[a,d,b,z1]];
    }
    const chimneyNode=attachments.find(a=>a.type==='chimney');
    if(chimneyNode){const size=Math.min(chimneyNode.params.chimneyWidth,W*.22,D*.22),cx=-W*.27,cz=-D*.25,cut=[cx-size/2-.02,cz-size/2-.02,cx+size/2+.02,cz+size/2+.02],next=[];
      for(const q of pieces){const a=Math.max(q[0],cut[0]),b=Math.min(q[2],cut[2]),c=Math.max(q[1],cut[1]),d=Math.min(q[3],cut[3]);if(a>=b||c>=d)next.push(q);else next.push([q[0],q[1],a,q[3]],[b,q[1],q[2],q[3]],[a,q[1],b,c],[a,d,b,q[3]]);}pieces=next;
    }
    for(const q of pieces)if(q[2]-q[0]>.006&&q[3]-q[1]>.006)box('floor '+(l+1),(q[0]+q[2])/2,l*H+.018-f.floorThickness/2,(q[1]+q[3])/2,q[2]-q[0]-.005,f.floorThickness,q[3]-q[1]-.005,f.floorColor,new THREE.Vector3(),0,floor.nodeId);
   }
  }
 }
 if(stairNode&&stairPlan)architectureBuildStairs(stairPlan,stairNode.params,levels,H,attic,box,geom,stairNode.nodeId);
 const roof=attachments.find(a=>a.type==='roof');
 if(isHouse&&roof){const r=roof.params,half=W/2+r.roofOverhang,length=D+2*r.roofOverhang,rise=effectiveRoofRise(r.roofRise),pitch=Math.atan2(rise,half),slant=Math.hypot(half,rise),base=levels*H,cos=Math.cos(pitch),sin=Math.sin(pitch);
  const stack=attachments.find(a=>a.type==='chimney'),size=stack?Math.min(stack.params.chimneyWidth,W*.22,D*.22):0,cx=-W*.27,cz=-D*.25;
  function panel(sign,u0,u1,z0,z1,depth,shift,label,color,source){if(['curved','scalloped','shingles'].includes(r.roofStyle)&&label!=='roof backing'){const lap=Math.min(.12,slant/r.roofRows*.16);u1=Math.min(slant,u1+lap);}let pieces=[[u0,z0,u1,z1]];
    if(stack){const clearance=label==='roof backing'?-.025:.015;const a=Math.max(u0,Math.min(sign*(cx-size/2-clearance),sign*(cx+size/2+clearance))/cos),b=Math.min(u1,Math.max(sign*(cx-size/2-clearance),sign*(cx+size/2+clearance))/cos),c=Math.max(z0,cz-size/2-clearance),d=Math.min(z1,cz+size/2+clearance);if(a<b&&c<d)pieces=[[u0,z0,a,z1],[b,z0,u1,z1],[a,z0,b,c],[a,d,b,z1]];}
    const mid=(u0+u1)/2,zc=(z0+z1)/2;
const original=r.roofStyle==='curved'&&label!=='roof backing'?architectureCurvedRoofTile(u1-u0,z1-z0,sign):r.roofStyle==='scalloped'&&label!=='roof backing'?architectureScallopedTile(u1-u0,z1-z0,sign):new THREE.BoxGeometry(u1-u0,depth,z1-z0);
for(const q of pieces){if(q[2]-q[0]<.0001||q[3]-q[1]<.0001)continue;const a=sign*(q[0]-mid),b=sign*(q[2]-mid),g=pieces.length===1&&q[0]===u0&&q[1]===z0&&q[2]===u1&&q[3]===z1?original.clone():architectureClipTile(original,Math.min(a,b),Math.max(a,b),q[1]-zc,q[3]-zc);g.rotateZ(-sign*pitch);g.translate(sign*mid*cos,base+rise-mid*sin+shift,zc);geom(g,label,color,new THREE.Vector3(),0,source);}original.dispose();
  }
  for(const sign of[-1,1]){panel(sign,0,slant,-length/2,length/2,.24,-.055-.0825/cos,'roof backing',timber,nodeId);
    for(let row=0;row<r.roofRows;row++)for(let col=0;col<r.roofColumns;col++){const rng=geometryNodePrng((graph.seed+row*19349663+col*73856093+(sign+1)*83492791)>>>0),color='#'+new THREE.Color(r.roofColor).multiplyScalar(1+(rng()-.5)*r.roofVariation).getHexString();panel(sign,row*slant/r.roofRows+.002,(row+1)*slant/r.roofRows-.002,-length/2+col*length/r.roofColumns+.003,-length/2+(col+1)*length/r.roofColumns-.003,r.roofStyle==='clay'?.065:.035,.015,'roof '+r.roofStyle+' tile',color,roof.nodeId);}
  }
  // Gable peaks and eave fillers meet the actual underside of the pitched backing.
  const under=.055+.2025/cos,peak=base+rise-under,eave=base+rise*(1-W/(2*half))-under;
  for(const sign of[-1,1]){{
    const outline=[[-W/2,base],[W/2,base],[W/2,eave],[0,peak],[-W/2,eave]],origin=new THREE.Vector3(0,0,sign*D/2);
    if(medieval?.params.medievalGableTimber){
     const strips=[],b=Math.min(beam,.18),n=medieval.params.medievalGableBays;
     function band(a,c){const dx=c[0]-a[0],dy=c[1]-a[1],len=Math.hypot(dx,dy),nx=-dy/len*b/2,ny=dx/len*b/2;strips.push([[a[0]+nx,a[1]+ny],[a[0]-nx,a[1]-ny],[c[0]-nx,c[1]-ny],[c[0]+nx,c[1]+ny]]);}
     for(let i=0;i<=n;i++){const x=-W/2+i*W/n;band([x,base],[x,peak+.1]);}
     for(const f of[0,.36,.7])band([-W/2,base+(peak-base)*f],[W/2,base+(peak-base)*f]);
     band([-W/2,eave],[0,peak]);band([0,peak],[W/2,eave]);
     band([-W*.40,base],[0,base+(peak-base)*.70]);band([W*.40,base],[0,base+(peak-base)*.70]);
     let remaining=[outline];
     for(const strip of strips){const next=[];for(const piece of remaining){const cut=partition(piece,strip);polygon(cut.inside,thick+.055,'gable timber',timber,origin,0);next.push(...cut.outside);}remaining=next;}
     for(const piece of remaining)polygon(piece,thick,'gable infill',plaster,origin,0);
    }else polygon(outline,thick,'fitted gable',plaster,origin,0);
   }if(eave>base)box('eave wall closure',sign*W/2,(base+eave)/2,0,thick,eave-base,D,plaster);}
  if(stack){const c=stack.params,roofAtStack=base+rise*(1-Math.abs(cx)/half),top=roofAtStack+c.chimneyHeight,wall=Math.min(.12,size*.2),courses=Math.max(3,Math.ceil(top/.25));
    for(let row=0;row<courses;row++){const y=(row+.5)*top/courses,ch=top/courses;for(const sign of[-1,1]){box('continuous chimney side',cx+sign*(size-wall)/2,y,cz,wall,ch,size,c.chimneyColor,new THREE.Vector3(),0,stack.nodeId);box('continuous chimney face',cx,y,cz+sign*(size-wall)/2,size-2*wall,ch,wall,c.chimneyColor,new THREE.Vector3(),0,stack.nodeId);}}
    for(const sign of[-1,1]){box('chimney cap',cx+sign*(size-wall)/2,top+.04,cz,wall+.05,.10,size+.08,c.chimneyColor,new THREE.Vector3(),0,stack.nodeId);box('chimney cap',cx,top+.04,cz+sign*(size-wall)/2,size-2*wall,.10,wall+.05,c.chimneyColor,new THREE.Vector3(),0,stack.nodeId);}
    for(let l=0;l<levels+(attic?1:0);l++){const o=size+.24,i=size-.02,y=l*H+.035;for(const sign of[-1,1]){box('chimney hearth side',cx+sign*(i+o)/4,y,cz,(o-i)/2,.045,o,c.chimneyColor,new THREE.Vector3(),0,stack.nodeId);box('chimney hearth return',cx,y,cz+sign*(i+o)/4,i,.045,(o-i)/2,c.chimneyColor,new THREE.Vector3(),0,stack.nodeId);}}
box('stove hearth',cx,.015,cz+size/2+.46,size*1.1+.28,.06,.96,c.chimneyColor,new THREE.Vector3(),0,stack.nodeId);
const inner=size-.015,outer=size+.18;
function flashing(x0,x1,z0,z1){const sh=new THREE.Shape();sh.moveTo(x0,-z0);sh.lineTo(x1,-z0);sh.lineTo(x1,-z1);sh.lineTo(x0,-z1);sh.closePath();const g=new THREE.ExtrudeGeometry(sh,{depth:.29,bevelEnabled:false});g.rotateX(-Math.PI/2);g.translate(0,-.265,0);const p=g.getAttribute('position'),lift=r.roofStyle==='curved'?.09+(length/r.roofColumns)*.43: .21;for(let i=0;i<p.count;i++)p.setY(i,p.getY(i)+base+rise-Math.abs(p.getX(i))*Math.tan(pitch)+lift);g.computeVertexNormals();geom(g,'chimney flashing','#55544d',new THREE.Vector3(),0,stack.nodeId);}
for(const sign of[-1,1]){const a=cx+sign*inner/2,b=cx+sign*outer/2;flashing(Math.min(a,b),Math.max(a,b),cz-outer/2,cz+outer/2);const c=cz+sign*inner/2,d=cz+sign*outer/2;flashing(cx-inner/2,cx+inner/2,Math.min(c,d),Math.max(c,d));}
    const stoveZ=cz+size/2+.38,iron='#363a38';box('stove body',cx,.40,stoveZ,size*1.1,.6,.55,iron,new THREE.Vector3(),0,stack.nodeId);box('stove door',cx,.42,stoveZ+.29,size*.78,.34,.035,'#222825',new THREE.Vector3(),0,stack.nodeId);box('stove handle',cx+size*.25,.42,stoveZ+.325,.04,.15,.045,'#8b8573',new THREE.Vector3(),0,stack.nodeId);
    for(const x of[-1,1])for(const z of[-1,1])box('stove foot',cx+x*size*.37,.075,stoveZ+z*.20,.07,.15,.07,iron,new THREE.Vector3(),0,stack.nodeId);
    const pipeRadius=Math.min(.07,size*.12),vertical=new THREE.CylinderGeometry(pipeRadius,pipeRadius,.42,10);vertical.translate(cx,.9,stoveZ);geom(vertical,'stove flue upright',iron,new THREE.Vector3(),0,stack.nodeId);
    const pipeLength=stoveZ-cz,connector=new THREE.CylinderGeometry(pipeRadius,pipeRadius,pipeLength,10);connector.rotateX(Math.PI/2);connector.translate(cx,1.11,(stoveZ+cz)/2);geom(connector,'stove to chimney connection',iron,new THREE.Vector3(),0,stack.nodeId);
  }
  if(r.roofRidgeTiles){
   const count=Math.max(1,Math.ceil(length/r.roofRidgeLength)),step=length/count,overlap=Math.min(.10,step*.18);
   const radius=Math.max(.24,Math.min(.65,length/r.roofColumns*.5)),thickness=.025;
   for(let i=0;i<count;i++){
    const z0=-length/2+i*step,z1=Math.min(length/2,z0+step+(i<count-1?overlap:0)),span=z1-z0;
    // The wider socket of each cap fits over the narrower end of its neighbour.
    const g=assetNodeSector([[-span/2,radius, radius-thickness],[span/2,radius+.045,radius+.045-thickness]],0,Math.PI,16);
    g.rotateX(-Math.PI/2);g.translate(0,base+rise+.04,(z0+z1)/2);
    const rng=geometryNodePrng((graph.seed+i*7919+104729)>>>0),color='#'+new THREE.Color(r.roofColor).multiplyScalar(1+(rng()-.5)*r.roofVariation).getHexString();
    geom(g,'rounded ridge tile '+(i+1),color,new THREE.Vector3(),0,roof.nodeId);
   }
  }else box('ridge cap',0,base+rise+.055,0,.13,.1,length,r.roofColor,new THREE.Vector3(),0,roof.nodeId);
 }
 return serial;
}

// Barrel covers and concave drainage channels. Local X follows the roof slope.
function architectureCurvedRoofTile(length,width,slopeSign=1){
 const positions=[],uvs=[],segments=12,thickness=Math.min(.035,width*.045),radius=width*.29;
 function quad(a,b,c,d,reverse=false){for(const i of(reverse?[0,2,1,0,3,2]:[0,1,2,0,2,3])){const p=[a,b,c,d][i];positions.push(...p);uvs.push((p[0]/length+.5),p[2]/width+.5);}}
 function shell(center,concave,from,to){
  function point(end,angle,inner){const t=end, taper=.90+.10*t,rad=radius*taper,theta=from+(to-from)*angle;
   const z=center+rad*Math.cos(theta);
   // The down-slope lip is lifted above the next course instead of sharing its surface.
   const lift=t*Math.min(.11,length*.12),y=concave?.04+rad*(1-Math.sin(theta)):width*.12+rad*Math.sin(theta);
   return [slopeSign*(t-.5)*length,y+lift-(inner?thickness:0),z];
  }
  for(let i=0;i<segments;i++){
   const a=i/segments,b=(i+1)/segments;
   quad(point(0,a,false),point(1,a,false),point(1,b,false),point(0,b,false),slopeSign<0);
   quad(point(0,a,true),point(0,b,true),point(1,b,true),point(1,a,true),slopeSign<0);
   quad(point(0,a,false),point(0,b,false),point(0,b,true),point(0,a,true),slopeSign<0);
   quad(point(1,a,false),point(1,a,true),point(1,b,true),point(1,b,false),slopeSign<0);
  }
  for(const a of[0,1])quad(point(0,a,false),point(0,a,true),point(1,a,true),point(1,a,false),(a===1)!==(slopeSign<0));
 }
 shell(0,false,0,Math.PI);
 // Half channels on either edge meet the matching half in the neighbouring column.
 shell(-width/2,true,0,Math.PI/2);
 shell(width/2,true,Math.PI/2,Math.PI);
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.computeVertexNormals();return g;
}

function architectureScallopedTile(length,width,sign){
 const radius=Math.min(width*.48,length*.26),end=length/2-radius,shape=new THREE.Shape();
 shape.moveTo(-length/2,-width/2);shape.lineTo(end,-width/2);
 // Rounded lower edge, keeping the tile within its assigned roof cell.
 shape.quadraticCurveTo(length/2,-width/2,length/2,0);shape.quadraticCurveTo(length/2,width/2,end,width/2);
 shape.lineTo(-length/2,width/2);shape.closePath();
 const g=new THREE.ExtrudeGeometry(shape,{depth:.035,bevelEnabled:false,curveSegments:5});
 const p=g.getAttribute('position');for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getY(i),y=p.getZ(i)+.02+(x/length+.5)*.07;p.setXYZ(i,sign*x,y,z);}
 if(sign>0){const index=g.index;if(index){for(let i=0;i<index.count;i+=3){const b=index.getX(i+1);index.setX(i+1,index.getX(i+2));index.setX(i+2,b);}}else{for(let i=0;i<p.count;i+=3){for(const attribute of Object.values(g.attributes)){for(let j=0;j<attribute.itemSize;j++){const a=(i+1)*attribute.itemSize+j,b=(i+2)*attribute.itemSize+j,v=attribute.array[a];attribute.array[a]=attribute.array[b];attribute.array[b]=v;}}}}}
 g.computeVertexNormals();return g;
}
function architectureWindowLeading(w,h,cx,cy,origin,angle,source,geom){
 const gap=.28;
 for(const slope of[-1,1])for(let k=-Math.ceil((w+h)/gap);k<=Math.ceil((w+h)/gap);k++){
  const offset=k*gap,points=[];
  for(const x of[-w/2,w/2]){const y=slope*x+offset;if(y>=-h/2&&y<=h/2)points.push(new THREE.Vector3(cx+x,cy+y,.053));}
  for(const y of[-h/2,h/2]){const x=(y-offset)/slope;if(x>-w/2&&x<w/2)points.push(new THREE.Vector3(cx+x,cy+y,.053));}
  if(points.length!==2)continue;const delta=points[1].clone().sub(points[0]);if(delta.length()<.001)continue;
  const g=new THREE.BoxGeometry(.014,delta.length(),.014);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.clone().normalize()));g.translate(...points[0].add(points[1]).multiplyScalar(.5).toArray());geom(g,'diamond window leading','#393a34',origin,angle,source);
 }
}

// Trim original tile geometry while preserving its profile and UV scale.
function architectureClipTile(source,x0,x1,z0,z1){
const g=source.index?source.toNonIndexed():source.clone(),p=g.getAttribute('position'),uv=g.getAttribute('uv'),n=g.getAttribute('normal'),out=[],tex=[],norm=[];
for(let i=0;i<p.count;i+=3){let poly=[0,1,2].map(j=>[p.getX(i+j),p.getY(i+j),p.getZ(i+j),uv?uv.getX(i+j):0,uv?uv.getY(i+j):0,n?n.getX(i+j):0,n?n.getY(i+j):1,n?n.getZ(i+j):0]);
for(const [axis,bound,sign] of [[0,x0,1],[0,x1,-1],[2,z0,1],[2,z1,-1]]){const next=[];for(let j=0;j<poly.length;j++){const a=poly[j],b=poly[(j+1)%poly.length],da=(a[axis]-bound)*sign,db=(b[axis]-bound)*sign;const insideA=da>=-1e-6,insideB=db>=-1e-6;if(insideA)next.push(a);if(insideA!==insideB){const t=Math.max(0,Math.min(1,da/(da-db)));next.push(a.map((v,k)=>v+(b[k]-v)*t));}}poly=next;}
for(let j=1;j<poly.length-1;j++)for(const v of [poly[0],poly[j],poly[j+1]]){out.push(...v.slice(0,3));tex.push(...v.slice(3,5));norm.push(...v.slice(5,8));}}
g.dispose();const r=new THREE.BufferGeometry();r.setAttribute('position',new THREE.Float32BufferAttribute(out,3));r.setAttribute('uv',new THREE.Float32BufferAttribute(tex,2));r.setAttribute('normal',new THREE.Float32BufferAttribute(norm,3));return r;}
