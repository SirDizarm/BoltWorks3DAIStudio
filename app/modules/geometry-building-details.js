const BWS_BUILDING_DETAIL_NODES={
 medievalStyle:{title:"Medieval Style",category:"Architecture",attachment:true,fields:{medievalStoneInset:["Stone floor inset",.3,.15,.6,.05],medievalStoneGround:["Stone ground floor",true],medievalGableTimber:["Timbered gables",true],medievalLeadedGlass:["Diamond window leading",true],medievalSteepRoof:["Steep roof",true],medievalRoofPitch:["Minimum roof pitch",48,30,65,1],medievalGableBays:["Gable divisions",4,2,8,1],medievalStoneColor:["Ground floor stone","#908676"],medievalStoneCourses:["Stone courses",10,4,16,1]}},
 interiorPartition:{title:"Interior Partition",category:"Architecture",attachment:true,fields:{partitionLevel:["Storey",1,1,3,1],partitionAxis:["Runs along","width",["width","depth"]],partitionPosition:["Across floor (-1 to 1)",.5,-.9,.9,.05],partitionThickness:["Thickness",.12,.08,.3,.01],partitionDoor:["Doorway",true],partitionDoorPosition:["Door position",0,-.8,.8,.05],partitionDoorWidth:["Door width",1,.6,2,.1],partitionDoorHeight:["Door height",2.1,1.5,3,.1],partitionColor:["Wall color","#b1a58b"]}},
 balcony:{title:"Balcony",category:"Architecture",attachment:true,fields:{balconySide:["Wall","front",["front","back","left","right"]],balconyLevel:["Storey",2,2,3,1],balconyWidth:["Width",2.4,1.2,5,.1],balconyDepth:["Projection",1.2,.6,2.5,.1],balconyPosition:["Horizontal position",0,-.7,.7,.05],balconyDoorWidth:["Door width",1,.6,2,.1],balconyDoorHeight:["Door height",2.1,1.5,3,.1],balconyRailHeight:["Railing height",.95,.7,1.3,.05],balconyColor:["Wood","#70533e"]}},
 staircase:{title:"Staircase",category:"Architecture",attachment:true,fields:{stairsPositionX:["Across house (-1 to 1)",.85,-1,1,.05],stairsPositionZ:["Along house (-1 to 1)",.75,-1,1,.05],stairsWidth:["Flight width",.85,.55,1.4,.05],stairsTread:["Desired tread",.25,.16,.35,.01],stairsRiser:["Desired riser",.18,.12,.25,.01],stairsAttic:["Access attic",true],stairsRails:["Handrails",true],stairsColor:["Wood","#74563e"]}},
 foundation:{title:"Foundation",category:"Architecture",attachment:true,fields:{foundationCorners:["Wrap stone corners",true],foundationHeight:["Stone base height",.65,.2,1.3,.05],foundationCourses:["Stone courses",3,1,6,1],foundationColor:["Stone","#928878"],foundationVariation:["Variation",.15,0,.3,.01]}},
 facadeDetails:{title:"Facade Details",category:"Architecture",attachment:true,fields:{facadeBelts:["Storey belts",true],facadeSills:["Window sills",true],facadeCanopy:["Door canopy",true],facadeColor:["Trim color","#624c39"]}},
 chimney:{title:"Chimney",category:"Architecture",attachment:true,fields:{chimneyWidth:["Width",.65,.35,1.2,.05],chimneyHeight:["Above roof",1.5,.6,3,.1],chimneyColor:["Masonry","#937b63"]}}
};
function architectureStairPlan(W,D,H,thick,settings){if(!settings)return null;const availableX=W-thick-.5,availableZ=D-thick-.6,width=Math.min(settings.stairsWidth,(availableX-.12)/2),landing=Math.min(width,availableZ*.3),steps=Math.max(3,Math.ceil(H/(2*settings.stairsRiser))),run=Math.min(steps*settings.stairsTread,availableZ-landing),tread=run/steps;if(width<.5||tread<.14)return null;const span=2*width+.12,cx=(settings.stairsPositionX||0)*Math.max(0,(availableX-span)/2),cz=(settings.stairsPositionZ||0)*Math.max(0,(availableZ-run-landing)/2);return {width,landing,steps,run,tread,span,centerX:cx,x0:cx-span/2,x1:cx+span/2,z0:cz-(run+landing)/2,z1:cz+(run+landing)/2};}
function architectureWallDetails(attachments,{width,H,level,origin,angle,thick,holes,box,geom,graph,side,isHouse=false}){
 const medieval=attachments.find(a=>a.type==='medievalStyle');
 const foundation=medieval?.params.medievalStoneGround?{nodeId:medieval.nodeId,params:{foundationCorners:true,foundationHeight:H,foundationCourses:medieval.params.medievalStoneCourses,foundationColor:medieval.params.medievalStoneColor,foundationVariation:.10}}:attachments.find(a=>a.type==='foundation');if(foundation&&level===1){const p=foundation.params,height=medieval?.params.medievalStoneGround?H:Math.min(p.foundationHeight,H*.45),rows=p.foundationCourses,trim=isHouse&&p.foundationCorners?.36:0,cols=Math.max(2,Math.ceil(width/.55)),cw=width/cols,baseDepth=medieval?.params.medievalStoneGround?(attachments.find(a=>a.type==='floor')?.params.floorThickness||.15):0,rh=(height+baseDepth)/rows;for(let row=0;row<rows;row++)for(let col=-1;col<cols;col++){const bonded=!!(medieval?.params.medievalStoneGround&&isHouse&&p.foundationCorners),rowTrim=bonded?architectureCornerBond(row,side):trim,span=width-2*rowTrim,count=Math.max(1,Math.round(span/.55)),fitted=span/count;const x0=bonded?-width/2+rowTrim+col*fitted:Math.max(-width/2+trim,-width/2+(col+(row%2)*.5)*cw),x1=bonded?x0+fitted:Math.min(width/2-trim,-width/2+(col+1+(row%2)*.5)*cw),y0=row*rh-baseDepth,y1=y0+rh;if(bonded&&(col<0||col>=count))continue;if(x1<=x0)continue;let pieces=[[x0,y0,x1,y1]];for(const hole of holes){const next=[];for(const r of pieces){const l=Math.max(r[0],hole.x0),rt=Math.min(r[2],hole.x1),lo=Math.max(r[1],hole.y0),hi=Math.min(r[3],hole.y1);if(l>=rt||lo>=hi){next.push(r);continue;}next.push([r[0],r[1],l,r[3]],[rt,r[1],r[2],r[3]],[l,r[1],rt,lo],[l,hi,rt,r[3]]);}pieces=next.filter(r=>r[2]-r[0]>.02&&r[3]-r[1]>.02);}
 const rand=geometryNodePrng((graph.seed+row*331+col*7919+side.length*43)>>>0),color='#'+new THREE.Color(p.foundationColor).multiplyScalar(1+(rand()-.5)*p.foundationVariation).getHexString();for(const r of pieces){
  if(medieval?.params.medievalStoneGround){const w=r[2]-r[0]-.012,h=r[3]-r[1]-.012,d=.075+rand()*.025,g=architectureRubbleRock(w,h,d,rand);g.translate((r[0]+r[2])/2,(r[1]+r[3])/2,thick/2+.065);geom(g,'rough wall rock',color,origin,angle,foundation.nodeId);}
  else box('foundation stone',(r[0]+r[2])/2,(r[1]+r[3])/2,thick/2+.04,r[2]-r[0]-.008,r[3]-r[1]-.008,.065,color,origin,angle,foundation.nodeId);
 }}}
 if(medieval?.params.medievalStoneGround&&level===1){
  const floorDepth=attachments.find(a=>a.type==='floor')?.params.floorThickness||.15;
  box('stone floor-edge backing',0,-floorDepth/2,0,width,floorDepth,thick+.035,medieval.params.medievalStoneColor,origin,angle,medieval.nodeId);
  const frameWidth=.15,frameDepth=.10,front=thick/2+.15;
  for(const r of holes){const w=r.x1-r.x0,h=r.y1-r.y0,cx=(r.x0+r.x1)/2,cy=(r.y0+r.y1)/2,color=r.settings.windowColor||r.settings.doorColor||'#604a36';
   box('stone opening left surround',r.x0-frameWidth/2,cy,front,frameWidth,h,frameDepth,color,origin,angle,r.source);
   box('stone opening right surround',r.x1+frameWidth/2,cy,front,frameWidth,h,frameDepth,color,origin,angle,r.source);
   box('stone opening lintel',cx,r.y1+frameWidth/2,front,w+2*frameWidth,frameWidth,frameDepth,color,origin,angle,r.source);
   const dep=thick+.24,lip=.045;
box('wood left reveal',r.x0+lip/2,cy,.04,lip,h,dep,color,origin,angle,r.source);
box('wood right reveal',r.x1-lip/2,cy,.04,lip,h,dep,color,origin,angle,r.source);
box('wood head reveal',cx,r.y1-lip/2,.04,w-2*lip,lip,dep,color,origin,angle,r.source);
if(r.y0>0)box('wood sill reveal',cx,r.y0+lip/2,.04,w-2*lip,lip,dep,color,origin,angle,r.source);
else box('wood door threshold',cx,-.025,.075,w+2*frameWidth+.06,.12,dep+.13,color,origin,angle,r.source);
if(r.y0>0)box('stone window bottom surround',cx,r.y0-frameWidth/2,front,w+2*frameWidth,frameWidth,frameDepth,color,origin,angle,r.source);
  }
 }
 const details=attachments.find(a=>a.type==='facadeDetails');if(!details)return;const p=details.params;
 if(p.facadeBelts){box('storey cornice',0,H-.08,thick/2+.075,width+.12,.16,.13,p.facadeColor,origin,angle,details.nodeId);for(let i=0;i<Math.max(2,Math.floor(width));i++)box('eaves bracket',-width/2+.4+i*(width-.8)/Math.max(1,Math.floor(width)-1),H-.1875,thick/2+(medieval?.params.medievalStoneGround&&level===1?.14:.07),.1,.415,(medieval?.params.medievalStoneGround&&level===1?.24:.12),p.facadeColor,origin,angle,details.nodeId);}
 for(const r of holes){const w=r.x1-r.x0,cx=(r.x0+r.x1)/2;if(r.kind==='window'&&p.facadeSills){box('window sill',cx,r.y0-.08,thick/2+.10,w+.24,.12,.27,p.facadeColor,origin,angle,details.nodeId);for(const sign of[-1,1])box('sill bracket',cx+sign*w*.34,r.y0-.23,thick/2+.06,.09,.25,.14,p.facadeColor,origin,angle,details.nodeId);}if(r.kind==='door'&&p.facadeCanopy){const g=new THREE.BoxGeometry(w+.5,.075,.72);g.rotateX(.3);g.translate(cx,r.y1+.22,thick/2+.3);geom(g,'door canopy',p.facadeColor,origin,angle,details.nodeId);for(const sign of[-1,1])box('canopy bracket',cx+sign*(w/2+.08),r.y1+.02,thick/2+.13,.08,.3,.28,p.facadeColor,origin,angle,details.nodeId);}}
}
function architectureBuildStairs(plan,settings,levels,H,attic,emitBox,emitGeom,source){
 function box(name,x,y,z,...rest){return emitBox(name,x+(plan.centerX||0),y+.018,z,...rest);}
 function geom(g,...rest){g.translate(plan.centerX||0,.018,0);return emitGeom(g,...rest);}
if(!plan)return;const flights=levels-1+(attic?1:0),{width,steps,tread,span,z0,run,landing}=plan,color=settings.stairsColor;
 function rail(a,b){const delta=b.clone().sub(a),g=new THREE.BoxGeometry(.055,delta.length(),.055);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.clone().normalize()));g.translate(...a.clone().add(b).multiplyScalar(.5).toArray());geom(g,'stair handrail',color,new THREE.Vector3(),0,source);}
 function guard(ax,az,bx,bz,y){rail(new THREE.Vector3(ax,y+.98,az),new THREE.Vector3(bx,y+.98,bz));const n=Math.max(1,Math.ceil(Math.hypot(bx-ax,bz-az)/.16));for(let i=0;i<=n;i++)box('stairwell guard',ax+(bx-ax)*i/n,y+.48,az+(bz-az)*i/n,.045,.96,.045,color,new THREE.Vector3(),0,source);}
if(settings.stairsRails)for(let l=1;l<=flights;l++){const a=-span/2-.115,b=span/2+.115,c=z0-.06,d=z0+run+landing+.06;guard(a,c,a,d,l*H);guard(b,c,b,d,l*H);guard(a,d,b,d,l*H);if(l===flights)guard(a,c,-.06,c,l*H);}
for(let floor=0;floor<flights;floor++){const base=floor*H,rise=H/(2*steps);for(let i=0;i<steps;i++){const y1=base+(i+1)*rise,y2=base+H/2+(i+1)*rise;box('stair ascending left',-width/2-.06,y1-.05,z0+(i+.5)*tread,width,.10,tread+.006,color,new THREE.Vector3(),0,source);box('stair left riser',-width/2-.06,y1-rise/2,z0+i*tread+.025,width,rise,.05,color,new THREE.Vector3(),0,source);box('stair returning right',width/2+.06,y2-.05,z0+run-(i+.5)*tread,width,.10,tread+.006,color,new THREE.Vector3(),0,source);box('stair right riser',width/2+.06,y2-rise/2,z0+run-i*tread-.025,width,rise,.05,color,new THREE.Vector3(),0,source);}
 box('half landing',0,base+H/2-.06,z0+run+landing/2,span,.12,landing,color,new THREE.Vector3(),0,source);
 if(settings.stairsRails){
 rail(new THREE.Vector3(-.06,base+.85,z0),new THREE.Vector3(-.06,base+H/2+.85,z0+run));
 rail(new THREE.Vector3(.06,base+H+.85,z0),new THREE.Vector3(.06,base+H/2+.85,z0+run));
 for(const x of[-.06,.06])for(let i=0;i<=steps;i+=Math.max(1,Math.floor(steps/4))){const y=base+(x<0?i*rise:H-i*rise);box('inner stair baluster',x,y+.425,z0+i*tread,.045,.85,.045,color,new THREE.Vector3(),0,source);}
 rail(new THREE.Vector3(-span/2,base+H/2+.85,z0+run+landing),new THREE.Vector3(span/2,base+H/2+.85,z0+run+landing));
 for(const x of[-span/2,span/2])rail(new THREE.Vector3(x,base+H/2+.85,z0+run),new THREE.Vector3(x,base+H/2+.85,z0+run+landing));
 rail(new THREE.Vector3(-span/2,base+.85,z0),new THREE.Vector3(-span/2,base+H/2+.85,z0+run));rail(new THREE.Vector3(span/2,base+H+.85,z0),new THREE.Vector3(span/2,base+H/2+.85,z0+run));for(const x of[-span/2,span/2])for(let i=0;i<=steps;i+=Math.max(1,Math.floor(steps/3))){const y=base+(x<0?i*rise:H-i*rise),z=z0+i*tread;box('stair baluster',x,y+.425,z,.055,.85,.055,color,new THREE.Vector3(),0,source);}}
 }
}

// Room partitions are fitted to the interior and leave circulation/service openings.
function architectureInteriorAndCorners(attachments,{W,D,H,levels,thick,stairPlan,box,graph,stoneInset=0,geom}){
 const origin=new THREE.Vector3(),medieval=attachments.find(a=>a.type==='medievalStyle'),foundation=medieval?.params.medievalStoneGround?{nodeId:medieval.nodeId,params:{foundationCorners:true,foundationHeight:H,foundationCourses:medieval.params.medievalStoneCourses,foundationColor:medieval.params.medievalStoneColor,foundationVariation:.10}}:attachments.find(a=>a.type==='foundation');
 if(foundation?.params.foundationCorners){const p=foundation.params,height=medieval?.params.medievalStoneGround?H:Math.min(p.foundationHeight,H*.45),baseDepth=medieval?.params.medievalStoneGround?(attachments.find(a=>a.type==='floor')?.params.floorThickness||.15):0,rh=(height+baseDepth)/p.foundationCourses;
  for(const sx of[-1,1])for(const sz of[-1,1])for(let row=0;row<p.foundationCourses;row++){
   const bonded=!!medieval?.params.medievalStoneGround,xReach=bonded?architectureCornerBond(row,'front'):.36,zReach=bonded?architectureCornerBond(row,'left'):.36;const x0=W/2-stoneInset-xReach,x1=W/2-stoneInset+thick/2+.08,z0=D/2-stoneInset-zReach,z1=D/2-stoneInset+thick/2+.08,turn=D/2-stoneInset-.04;
   const rng=geometryNodePrng((graph.seed+row*331+(sx+2)*7919+(sz+2)*43)>>>0),color='#'+new THREE.Color(p.foundationColor).multiplyScalar(1+(rng()-.5)*p.foundationVariation).getHexString();
   if(medieval?.params.medievalStoneGround){
    const xt=W/2-stoneInset-.04,ex=x1+.012+rng()*.035,ez=z1+.012+rng()*.035,ch=.025+rng()*.04,points=[[xt,z0+.012],[ex-ch,z0+.012],[ex,z0+ch],[ex,ez-ch],[ex-ch,ez],[x0+ch,ez],[x0+.012,ez-ch],[x0+.012,turn],[xt,turn]],shape=new THREE.Shape();
    points.forEach((p,i)=>{const x=sx*p[0],z=-sz*p[1];if(i)shape.lineTo(x,z);else shape.moveTo(x,z);});shape.closePath();
    // One continuous L-shaped stone removes the exposed split between two corner blocks.
    const g=new THREE.ExtrudeGeometry(shape,{depth:rh-.048,bevelEnabled:true,bevelSize:.01+rng()*.008,bevelThickness:.01,bevelSegments:1,steps:1});g.rotateX(-Math.PI/2);g.translate(0,row*rh-baseDepth+.024,0);geom(g,'joined masonry corner',color,origin,0,foundation.nodeId);
   }else{
    box('stone corner front',sx*(x0+x1)/2,(row+.5)*rh,sz*(turn+z1)/2,x1-x0,rh-.008,z1-turn,color,origin,0,foundation.nodeId);
    box('stone corner return',sx*(W/2-stoneInset-.04+x1)/2,(row+.5)*rh,sz*(z0+turn)/2,x1-(W/2-stoneInset-.04),rh-.008,turn-z0,color,origin,0,foundation.nodeId);
   }
  }
 }
 const emitted=[];
 for(const node of attachments.filter(a=>a.type==='interiorPartition')){
  const p=node.params;if(p.partitionLevel>levels)continue;
  const inset=p.partitionLevel===1?stoneInset:0,alongX=p.partitionAxis==='width',length=(alongX?W:D)-thick-2*inset,cross=(alongX?D:W)-thick-2*inset,t=p.partitionThickness,base=(p.partitionLevel-1)*H;
  const pos=p.partitionPosition*(cross-t)/2,doorWidth=Math.min(p.partitionDoorWidth,length-.2),doorHeight=Math.min(p.partitionDoorHeight,H-.15),doorCenter=p.partitionDoorPosition*(length-doorWidth)/2;
  let pieces=[[-length/2,0,length/2,H]];
  function cut(a,b,c,d){const next=[];for(const r of pieces){const x0=Math.max(r[0],a),x1=Math.min(r[2],c),y0=Math.max(r[1],b),y1=Math.min(r[3],d);if(x0>=x1||y0>=y1)next.push(r);else next.push([r[0],r[1],x0,r[3]],[x1,r[1],r[2],r[3]],[x0,r[1],x1,y0],[x0,y1,x1,r[3]]);}pieces=next.filter(r=>r[2]-r[0]>.001&&r[3]-r[1]>.001);}
  if(p.partitionDoor)cut(doorCenter-doorWidth/2,0,doorCenter+doorWidth/2,doorHeight);
  const obstacles=[];
  if(stairPlan)obstacles.push([stairPlan.x0-.45,stairPlan.z0-.65,stairPlan.x1+.45,stairPlan.z1+.45]);
  const chimney=attachments.find(a=>a.type==='chimney');
  if(chimney){const size=Math.min(chimney.params.chimneyWidth,W*.22,D*.22),cx=-W*.27,cz=-D*.25;obstacles.push([cx-size/2-.2,cz-size/2-.2,cx+size/2+.2,cz+size/2+(p.partitionLevel===1?1:.2)]);}
  for(const q of obstacles){const a=alongX?q[1]:q[0],b=alongX?q[3]:q[2];if(pos+t/2>a&&pos-t/2<b)cut(alongX?q[0]:q[1],0,alongX?q[2]:q[3],H);}
  // Subtract previously emitted walls, so crossing partitions do not share faces.
  for(const q of emitted){if(q.level!==p.partitionLevel)continue;const a=alongX?q.z0:q.x0,b=alongX?q.z1:q.x1;if(pos+t/2>a&&pos-t/2<b)cut(alongX?q.x0:q.z0,q.y0,alongX?q.x1:q.z1,q.y1);}
  for(const r of pieces){const mid=(r[0]+r[2])/2,y=(r[1]+r[3])/2,x=alongX?mid:pos,z=alongX?pos:mid,w=alongX?r[2]-r[0]:t,d=alongX?t:r[2]-r[0];box('room partition storey '+p.partitionLevel,x,base+y,z,w,r[3]-r[1],d,p.partitionColor,origin,0,node.nodeId);emitted.push({level:p.partitionLevel,x0:x-w/2,x1:x+w/2,z0:z-d/2,z1:z+d/2,y0:r[1],y1:r[3]});}
 }
}

// Irregular bevelled stones stay within their assigned masonry cell.
function architectureRubbleRock(width,height,depth,rng){
 const w=Math.max(.005,width),h=Math.max(.005,height),d=Math.max(.005,depth),bevel=Math.min(.024,w*.12,h*.12,d*.2),x=w/2-bevel,y=h/2-bevel;
 const c=()=>.14+rng()*.2;
 const points=[[-x,-y+h*c()*.5],[-x+w*c()*.5,-y],[x-w*c()*.5,-y],[x,-y+h*c()*.5],[x,y-h*c()*.5],[x-w*c()*.5,y],[-x+w*c()*.5,y],[-x,y-h*c()*.5]];
 const shape=new THREE.Shape();shape.moveTo(...points[0]);for(const p of points.slice(1))shape.lineTo(...p);shape.closePath();
 const g=new THREE.ExtrudeGeometry(shape,{depth:Math.max(.001,d-2*bevel),bevelEnabled:true,bevelSize:bevel,bevelThickness:bevel,bevelSegments:1,steps:1});g.translate(0,0,-(d-2*bevel)/2);g.computeVertexNormals();return g;
}

// Alternating long/short quoin faces; the adjoining courses use the same boundaries.
function architectureCornerBond(row,side){const front=side==='front'||side==='back';return ((row%2===0)===front)?.55:.25;}
