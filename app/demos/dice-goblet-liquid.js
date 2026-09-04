import * as THREE from 'three';

// Decorative slosh + ballistic droplets, not a fluid solver or dice collider.
export function createGobletLiquid(cup){
  const group=new THREE.Group();group.name='Goblet water and spills';cup.add(group);
  const water=new THREE.MeshStandardMaterial({color:'#68bfd6',roughness:.16,metalness:.18,transparent:true,opacity:.82,side:THREE.DoubleSide});
  const surface=new THREE.Mesh(new THREE.CircleGeometry(1,48),water);surface.rotation.x=-Math.PI/2;surface.name='Sloshing water';group.add(surface);
  const dropGeometry=new THREE.SphereGeometry(.035,6,4),puddleGeometry=new THREE.CircleGeometry(1,16);
  const drops=Array.from({length:48},()=>{const mesh=new THREE.Mesh(dropGeometry,water);mesh.visible=false;group.add(mesh);return {mesh,velocity:new THREE.Vector3()};});
  const puddles=Array.from({length:12},()=>{const mesh=new THREE.Mesh(puddleGeometry,water);mesh.rotation.x=-Math.PI/2;mesh.visible=false;group.add(mesh);return mesh;});
  let amount=1,energy=0,time=0,spillClock=0,puddleIndex=0,spilled=0;
  function reset(){amount=1;energy=0;time=0;spillClock=0;spilled=0;puddleIndex=0;for(const d of drops)d.mesh.visible=false;for(const p of puddles)p.visible=false;updateSurface();}
  function updateSurface(){const level=1.01+.44*amount,radius=.33+.10*amount;surface.position.y=level;surface.scale.set(radius,radius,1);surface.rotation.set(-Math.PI/2+Math.sin(time*9)*energy*.44,Math.cos(time*7)*energy*.28,0);surface.visible=amount>.02;}
  function hit(){energy=Math.min(2.2,energy+.85);}
  function step(dt){
    dt=Math.min(.1,Math.max(0,dt));time+=dt;energy*=Math.exp(-dt*.65);spillClock-=dt;
    if(amount>.04&&energy>1.05+(1-amount)*1.4&&spillClock<=0){
      const drop=drops.find(d=>!d.mesh.visible);
      if(drop){const angle=Math.sin(time*11)*.6;drop.mesh.visible=true;drop.mesh.position.set(Math.cos(angle)*.49,1.64,Math.sin(angle)*.49);drop.velocity.set(.8+energy*.3,energy*.65,Math.sin(time*17)*.6);amount=Math.max(0,amount-.009);spilled++;}
      spillClock=.035;
    }
    for(const d of drops){if(!d.mesh.visible)continue;d.velocity.y-=9.81*dt;d.mesh.position.addScaledVector(d.velocity,dt);if(d.mesh.position.y<=.012){d.mesh.visible=false;const p=puddles[puddleIndex++%puddles.length];p.visible=true;p.position.set(Math.min(1.65,d.mesh.position.x),.012,d.mesh.position.z);p.scale.set(.09+Math.min(.18,spilled*.002),.07+Math.min(.12,spilled*.001),1);}}
    updateSurface();
  }
  reset();return {hit,step,reset,snapshot:()=>({amount,energy,spilled,activeDrops:drops.filter(d=>d.mesh.visible).length,puddles:puddles.filter(p=>p.visible).length})};
}
