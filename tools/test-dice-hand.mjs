import assert from 'node:assert/strict';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import {polyDefinition,polyResult,validateHand} from '../app/demos/dice-polyhedra.js';
import {createDicePhysics} from '../app/demos/dice-physics.js';
for(const type of [4,8,10,12,20]){const d=polyDefinition(type);assert.equal(d.faces.length,type);for(const o of d.outcomes){const q=new THREE.Quaternion().setFromUnitVectors(o.direction,new THREE.Vector3(0,1,0));assert.equal(polyResult(d,q),o.value);}for(const f of d.faces){assert.ok(f.normal.dot(f.center)>0);assert.ok(f.indices.length>2);}d.geometry.dispose();}
assert.throws(()=>validateHand([]));assert.throws(()=>validateHand(Array(9).fill(6)));assert.throws(()=>validateHand([7]));
let seed=193;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const originalImpulse=CANNON.Body.prototype.applyImpulse;let impulses=0;
CANNON.Body.prototype.applyImpulse=function(...args){impulses++;return originalImpulse.apply(this,args);};
const demo=createDicePhysics({types:[4,6,8,10,12,20,6,20],random});let settled=0,retry=0;
for(let n=0;n<12;n++){demo.reset();demo.roll();for(let f=0;f<3100&&demo.snapshot().state==='rolling';f++)demo.step(1/120);const s=demo.snapshot();assert.notEqual(s.state,'rolling');assert.equal(s.dice.length,8);for(const d of s.dice){assert.ok(d.result===null||(d.result>=1&&d.result<=d.type));d.result===null?retry++:settled++;assert.ok(d.nudges<=2);}if(s.total!==null)assert.equal(s.total,s.dice.reduce((a,d)=>a+d.result,0));}
assert.ok(settled>75,JSON.stringify({settled,retry}));demo.configure([20]);assert.equal(demo.snapshot().dice.length,1);demo.dispose();console.log({passed:true,mixedDice:96,settled,retry});
assert.ok(retry>0,'Cocked resting dice were not exercised');assert.equal(impulses,0,'Face evaluation applied a physical kick');CANNON.Body.prototype.applyImpulse=originalImpulse;
