// Shared environment-node geometry used by both Geometry Nodes and Scene Studio.
const BWS_SCENE_ENVIRONMENT_NODES={
 sceneTerrain:{title:"Terrain",category:"Scene",fields:{terrainWidth:["Width",40,2,1000,1],terrainDepth:["Depth",40,2,1000,1],terrainResolution:["Segments",80,8,180,1],terrainColor:["Ground","#64734b"],pondRadius:["Pond radius (0 = none)",0,0,100,.25],pondX:["Pond X",0,-500,500,.5],pondZ:["Pond Z",0,-500,500,.5],pondDepth:["Pond depth",1,.2,5,.1]}},
 sceneWater:{title:"Water",category:"Scene",fields:{waterRadius:["Radius",4,.2,100,.25],waterLevel:["Surface level",-.15,-10,10,.05],waterColor:["Water","#367c82"]}},
 scenePath:{title:"Path",category:"Scene",fields:{pathLength:["Length",10,.1,1000,.25],pathWidth:["Width",2,.1,20,.1],pathColor:["Surface","#b4a184"]}}
};
function bwsEnvironmentGeometry(type,source){
 const p=assetNodeSanitize(source);
 if(type==="scenePath")return {geometry:new THREE.BoxGeometry(p.pathWidth,.025,p.pathLength),color:p.pathColor,y:.005};
 if(type==="sceneWater"){const g=new THREE.CircleGeometry(p.waterRadius,80);g.rotateX(-Math.PI/2);return {geometry:g,color:p.waterColor,y:p.waterLevel,water:true};}
 if(type==="sceneTerrain"){
  const g=new THREE.PlaneGeometry(p.terrainWidth,p.terrainDepth,p.terrainResolution,p.terrainResolution);g.rotateX(-Math.PI/2);
  const positions=g.getAttribute("position");
  for(let i=0;i<positions.count;i++){const x=positions.getX(i),z=positions.getZ(i),r=p.pondRadius>0?Math.hypot(x-p.pondX,z-p.pondZ)/p.pondRadius:2;positions.setY(i,-.02-(r<1?p.pondDepth*(1-r*r):0));}
  g.computeVertexNormals();return {geometry:g,color:p.terrainColor,y:0};
 }
 throw Error("Unsupported environment node");
}
function bwsBuildEnvironmentNode(type,p,{graph,nodeId,group,outputName,emit}){
 const part=bwsEnvironmentGeometry(type,p);emit(geometryNodeCustomSpec(part.geometry,{name:outputName+" "+type,position:[p.assetOffsetX,part.y+p.assetOffsetY,p.assetOffsetZ],color:part.color,roughness:part.water?.18:.95,group,graph,targetId:nodeId}));return 1;
}
