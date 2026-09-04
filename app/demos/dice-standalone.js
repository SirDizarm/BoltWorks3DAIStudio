import * as THREE from 'three';
import {createDicePhysics} from './dice-physics.js';
import {createHandControls,resultText,createTrayControls} from './dice-hand-ui.js';
import {createScoreboard} from './dice-scoreboard.js';
const output=document.querySelector('output');
const stage=document.createElement('div');stage.className='dice-score-stage';const canvas=document.querySelector('canvas');canvas.before(stage);stage.append(canvas);const scoreboard=createScoreboard(stage,null,()=>document.querySelector('#roll').click());output.hidden=true;
function updateScore(snapshot){output.textContent=resultText(snapshot);scoreboard.update(snapshot);}
const initialHand=JSON.parse(document.querySelector('#dice-initial')?.textContent||'[6]');
const renderer=new THREE.WebGLRenderer({canvas:document.querySelector('canvas'),antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;
const demo=createDicePhysics({types:initialHand,onResult:updateScore});updateScore(demo.snapshot());
let paused=false,last=performance.now();
document.querySelector('footer').prepend(createTrayControls(()=>demo,()=>{paused=false;document.querySelector('#pause').textContent='Pause';}));
const hit=document.createElement('button');hit.id='hitTable';hit.textContent='Hit the table';hit.onclick=()=>{demo.shake();paused=false;document.querySelector('#pause').textContent='Pause';};document.querySelector('#roll').after(hit);
document.querySelector('footer').prepend(createHandControls(initialHand,hand=>{demo.configure(hand);demo.roll();paused=false;document.querySelector('#pause').textContent='Pause';updateScore(demo.snapshot());}));
document.querySelector('#roll').onclick=()=>{demo.roll();paused=false;document.querySelector('#pause').textContent='Pause';updateScore(demo.snapshot());};
document.querySelector('#pause').onclick=e=>{paused=!paused;e.target.textContent=paused?'Resume':'Pause';};
document.querySelector('#reset').onclick=()=>{demo.reset();updateScore(demo.snapshot());};
const footer=document.querySelector('footer'),mainControls=document.createElement('div');
mainControls.className='dice-export-main-controls';mainControls.style.cssText='display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:6px;margin:0 auto 8px;';
mainControls.append(footer.querySelector('.dice-hand-controls'),document.querySelector('#roll'),hit,document.querySelector('#pause'),document.querySelector('#reset'));
const trayControls=footer.querySelector('.dice-tray-controls');trayControls.style.cssText='display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:6px;margin:0 auto 14px;';
footer.prepend(mainControls);mainControls.after(trayControls);
window.addEventListener('keydown',event=>{if(event.target?.closest?.('input, textarea, select, [contenteditable]')||event.ctrlKey||event.altKey||event.metaKey)return;if(['Space','Enter','NumpadEnter'].includes(event.code)){event.preventDefault();if(!event.repeat)(event.code==='Space'?hit:document.querySelector('#roll')).click();}});
function resize(){const c=renderer.domElement;renderer.setSize(c.clientWidth,c.clientHeight,false);demo.resize(c.clientWidth/c.clientHeight);}
window.addEventListener('resize',resize);resize();
function frame(now){requestAnimationFrame(frame);if(!paused)demo.step((now-last)/1000);last=now;renderer.render(demo.scene,demo.camera);}
requestAnimationFrame(frame);
window.addEventListener('pagehide',()=>{demo.dispose();renderer.dispose();});
