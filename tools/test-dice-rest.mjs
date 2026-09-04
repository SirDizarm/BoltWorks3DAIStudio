import assert from 'node:assert/strict';
import * as CANNON from 'cannon-es';
import {createDicePhysics} from '../app/demos/dice-physics.js';
const original=CANNON.World.prototype.addBody;let die;
CANNON.World.prototype.addBody=function(body){if(body.mass===1)die=body;return original.call(this,body);};
const events=[];const demo=createDicePhysics({types:[6],onResult:s=>events.push(s.state)});
CANNON.World.prototype.addBody=original;
demo.setCleanBox(true);demo.roll();
// Place a flat die beside the wall, then simulate noisy wake flags.
die.position.set(5.34,.5,0);die.quaternion.set(0,0,0,1);die.velocity.setZero();die.angularVelocity.setZero();
for(let f=0;f<600&&demo.snapshot().state==='rolling';f++)demo.step(1/120);
assert.equal(demo.snapshot().state,'settled');const count=events.length;
for(let f=0;f<360;f++){die.wakeUp();demo.step(1/120);}
assert.equal(demo.snapshot().state,'settled');assert.equal(events.length,count,'Wake noise changed the displayed result');
// Genuine movement must invalidate the old result, unlike wake noise.
die.position.x-=.2;die.wakeUp();demo.step(1/120);assert.equal(demo.snapshot().state,'rolling');
for(let f=0;f<3100&&demo.snapshot().state==='rolling';f++)demo.step(1/120);
assert.notEqual(demo.snapshot().state,'rolling');
const vy=die.velocity.y;demo.shake();assert.ok(die.velocity.y-vy>2,'Manual hit was not strengthened');
for(let f=0;f<4000;f++)demo.step(1/120);
const endCount=events.length;for(let f=0;f<360;f++){die.wakeUp();demo.step(1/120);}
assert.notEqual(demo.snapshot().state,'rolling');assert.equal(events.length,endCount);
demo.dispose();console.log('PASS: rim rest, wake-noise suppression, genuine motion, stronger hit, bounded result reporting');
