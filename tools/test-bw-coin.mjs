import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createDicePhysics} from '../app/demos/dice-physics.js';
import {polyDefinition,polyResult,validateHand} from '../app/demos/dice-polyhedra.js';
validateHand([4,6,'dice','coin']);const def=polyDefinition('coin');
assert.equal(polyResult(def,new THREE.Quaternion()),1);assert.equal(polyResult(def,new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI)),2);assert.equal(polyResult(def,new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2)),null);def.geometry.dispose();
let seed=491;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const demo=createDicePhysics({types:['coin'],random});const counts={heads:0,tails:0,retry:0};
for(let n=0;n<30;n++){demo.reset();demo.roll();for(let f=0;f<3100&&demo.snapshot().state==='rolling';f++)demo.step(1/120);const s=demo.snapshot();assert.notEqual(s.state,'rolling');assert.equal(s.total,null);assert.equal(s.nudges,0);counts[s.result===1?'heads':s.result===2?'tails':'retry']++;}
// Coins can lean against the tray props. Those outcomes must remain retries.
assert.ok(counts.heads>0&&counts.tails>0);assert.ok(counts.heads+counts.tails>counts.retry);demo.dispose();console.log({passed:true,flips:30,...counts});
