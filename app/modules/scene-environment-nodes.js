// Shared environment-node geometry used by both Geometry Nodes and Scene Studio.
const BWS_SCENE_ENVIRONMENT_NODES={
 sceneTerrain:{title:"Terrain",category:"Scene",fields:{terrainWidth:["Width",40,2,1000,1],terrainDepth:["Depth",40,2,1000,1],terrainResolution:["Segments",80,8,180,1],terrainColor:["Ground","#64734b"],pondRadius:["Pond radius (0 = none)",0,0,100,.25],pondX:["Pond X",0,-500,500,.5],pondZ:["Pond Z",0,-500,500,.5],pondDepth:["Pond depth",1,.2,5,.1]}},
 sceneWater:{title:"Water",category:"Scene",fields:{waterRadius:["Radius",4,.2,100,.25],waterLevel:["Surface level",-.15,-10,10,.05],waterColor:["Water","#367c82"]}},
 scenePath:{title:"Path",category:"Scene",fields:{pathLength:["Length",10,.1,1000,.25],pathWidth:["Width",2,.1,20,.1],pathColor:["Surface","#b4a184"]}}
};
function bwsTerrainNoise(x,z,seed){
 const ix=Math.floor(x),iz=Math.floor(z),sx=x-ix,sz=z-iz,u=sx*sx*(3-2*sx),v=sz*sz*(3-2*sz);
 const hash=(a,b)=>{const n=Math.sin(a*127.1+b*311.7+seed*.017)*43758.5453;return n-Math.floor(n);};
 return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(ix,iz),hash(ix+1,iz),u),THREE.MathUtils.lerp(hash(ix,iz+1),hash(ix+1,iz+1),u),v);
}
function bwsTerrainRise(x,z,chaos,seed){return chaos*((bwsTerrainNoise(x*.085,z*.085,seed)-.5)*3.2+(bwsTerrainNoise(x*.27,z*.27,seed+71)-.5)*.6);}
function bwsPondEdge(angle){return 1+.1*Math.sin(angle*3+.7)+.055*Math.cos(angle*5-1.1)+.025*Math.sin(angle*9);}
function bwsEnvironmentGeometry(type,source){
 const p=assetNodeSanitize(source);
 if(type==="scenePath")return {geometry:new THREE.BoxGeometry(p.pathWidth,.025,p.pathLength),color:p.pathColor,y:.005};
 if(type==="sceneWater"){const g=new THREE.CircleGeometry(p.waterRadius,96);g.rotateX(-Math.PI/2);const positions=g.getAttribute("position");for(let i=1;i<positions.count;i++){const x=positions.getX(i),z=positions.getZ(i),edge=bwsPondEdge(Math.atan2(z,x));positions.setXZ?positions.setXZ(i,x*edge,z*edge):(positions.setX(i,x*edge),positions.setZ(i,z*edge));}g.computeBoundingSphere();return {geometry:g,color:p.waterColor,y:p.waterLevel,water:true};}
 if(type==="sceneTerrain"){
  const g=new THREE.PlaneGeometry(p.terrainWidth,p.terrainDepth,p.terrainResolution,p.terrainResolution);g.rotateX(-Math.PI/2);
  const positions=g.getAttribute("position");
  for(let i=0;i<positions.count;i++){const x=positions.getX(i),z=positions.getZ(i),dx=x-p.pondX,dz=z-p.pondZ,r=p.pondRadius>0?Math.hypot(dx,dz)/(p.pondRadius*bwsPondEdge(Math.atan2(dz,dx))):2;positions.setY(i,-.02-(r<1?p.pondDepth*(1-r*r):0));}
  g.computeVertexNormals();return {geometry:g,color:p.terrainColor,y:0};
 }
 throw Error("Unsupported environment node");
}
function bwsBuildEnvironmentNode(type,p,{graph,nodeId,group,outputName,emit}){
 const part=bwsEnvironmentGeometry(type,p);emit(geometryNodeCustomSpec(part.geometry,{name:outputName+" "+type,position:[p.assetOffsetX,part.y+p.assetOffsetY,p.assetOffsetZ],color:part.color,roughness:part.water?.18:.95,group,graph,targetId:nodeId}));return 1;
}
