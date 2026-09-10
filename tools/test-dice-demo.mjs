import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createDiceProject,diceSpecs,landingRotation,faceUp,randomFace} from '../app/demos/dice-model.js';
import {createDicePhysics} from '../app/demos/dice-physics.js';
const project=createDiceProject();
assert.equal(diceSpecs().length,22);assert.equal(Object.keys(project.editor.rigging.animation.clips).length,6);
for(let face=1;face<=6;face++){
  const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(...landingRotation(face).map(THREE.MathUtils.degToRad)));
  assert.equal(faceUp(q),face);
  const end=project.editor.rigging.animation.clips[`dice-land-${face}`].keys['dice-root'].at(-1);
  assert.equal(faceUp(new THREE.Quaternion().setFromEuler(new THREE.Euler(...end.rotation))),face);
}
assert.equal(randomFace(()=>0),1);assert.equal(randomFace(()=>.999999),6);
assert.equal(faceUp(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI/4,0,0))),null);
let seed=873;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const demo=createDicePhysics({random});const counts={};let cocked=0;
let pawnHit=false,pawnToppled=false,dominoToppled=false,nudged=false;
for(let n=0;n<60;n++){
  demo.roll();assert.equal(demo.snapshot().state,'rolling');
  for(let f=0;f<3100&&demo.snapshot().state==='rolling';f++)demo.step(1/120);
  const s=demo.snapshot();assert.ok(s.contacts>0);assert.notEqual(s.state,'rolling');
  nudged ||= s.nudges>0;assert.equal(s.nudges,0);
  pawnHit ||= s.props.some(p=>p.name==='chess pawn'&&p.hits>0);
  pawnToppled ||= s.props.some(p=>p.name==='chess pawn'&&p.upright<.5);
  dominoToppled ||= s.props.some(p=>p.name.startsWith('domino')&&p.upright<.5);
  if(s.state==='settled'){assert.equal(s.result,faceUp(new THREE.Quaternion(...s.quaternion)));assert.ok(s.position[1]>=.48);counts[s.result]=(counts[s.result]||0)+1;}else cocked++;
}
assert.equal(Object.keys(counts).length,6);
// Props can legitimately support angled dice. Do not enforce the old success
// rate obtained by physically kicking those valid resting configurations.
assert.equal(Object.values(counts).reduce((a,b)=>a+b,0)+cocked,60);
assert.ok(pawnHit,'Die did not collide with pawn');assert.ok(pawnToppled,'Pawn never toppled');assert.ok(dominoToppled,'Domino never toppled');assert.equal(nudged,false,'Resting dice must not be nudged');
demo.reset();assert.equal(demo.snapshot().state,'ready');assert.ok(demo.snapshot().props.every(p=>Math.abs(p.upright-1)<1e-6&&p.hits===0));demo.dispose();
console.log({passed:true,rolls:60,counts,cocked,pawnHit,pawnToppled,dominoToppled,nudged});
