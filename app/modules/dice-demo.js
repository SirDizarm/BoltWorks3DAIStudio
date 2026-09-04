import {createDiceProject, randomFace} from './demos/dice-model.js';
import {createDicePhysics} from './demos/dice-physics.js';
import {createHandControls,resultText,createTrayControls} from './demos/dice-hand-ui.js';
import {createScoreboard} from './demos/dice-scoreboard.js';

let dicePhysicsPreview = null;
let diceRandomTimeline = false;
let diceHand=[6];
const diceScoreboard=createScoreboard(document.getElementById('gameplayPreview'),document.querySelector('.gameplay-preview-bar'),()=>rollDicePhysics());
function updateDiceScore(snapshot){if(els.gameplayStatusText)els.gameplayStatusText.textContent=resultText(snapshot);diceScoreboard.update(snapshot);}
function isDiceDemo() { return !!boneById('dice-root') && !!findObject('dice-body'); }
function dicePickTimeline() {
  if (!isDiceDemo()) return;
  const value=randomFace();
  setActiveAnimationClip(`dice-land-${value}`);
  animationSetFrame(0);animationState.lastTime=0;
  log(`Authored dice toss: ${value} will land up. Gameplay Preview uses physical collisions instead.`);
}
function openDicePhysics() {
  document.getElementById('toolbarPicker').open=false;
  diceMenu.open=false;
  if (gameplayPreviewVisible()) closeGameplayPreview();
  animationState.playing=false;
  dicePhysicsPreview=createDicePhysics({types:diceHand,onResult:updateDiceScore});
  els.gameplayPreview.hidden=false;
  els.gameplayPreview.classList.add('dice-preview');
  diceTrayControls.reset();
  gameplayPlaybackPaused=false;gameplayLastFrame=performance.now();
  gameplayKeys.clear();gameplayMouseButtons.clear();
  document.getElementById('diceRollAgainBtn').hidden=false;
  els.gameplayHintText.textContent='Enter: reroll · Space: hit the table';
  resizeGameplayPreview();syncGameplayPlaybackUi();updateDiceScore(dicePhysicsPreview.snapshot());
}
function rollDicePhysics(){
  if(!dicePhysicsPreview)return;
  dicePhysicsPreview.roll();gameplayPlaybackPaused=false;gameplayLastFrame=performance.now();syncGameplayPlaybackUi();
  updateDiceScore(dicePhysicsPreview.snapshot());
}
function downloadDiceFile(data,name,type) {
  const url=URL.createObjectURL(new Blob([data],{type}));
  const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const diceMenu=document.createElement('details');
diceMenu.style.cssText='position:relative;display:inline-block;z-index:12';
diceMenu.innerHTML=`<summary style="cursor:pointer;padding:8px">🎲 Dice demo</summary><div style="position:absolute;right:0;min-width:250px;background:#18252d;border:1px solid #50616c;padding:12px;display:grid;gap:8px"><button id="diceCreateBtn">Load editable dice demo…</button><button id="diceTimelineBtn">Random timeline toss</button><label><input id="diceRandomInput" type="checkbox"> Randomize each timeline loop</label><button id="dicePhysicsBtn">Dice in Gameplay Preview</button><button id="diceProjectBtn">Download demo project</button><button id="diceExportBtn">Export dice randomizer HTML</button><small>Timeline = authored motion. Gameplay = physics. The physics tray is separate from your model.</small><output id="diceDemoMessage" aria-live="polite"></output></div>`;
diceMenu.id='diceDemoMenu';diceMenu.style.display='none';diceMenu.hidden=true;
diceMenu.querySelector('summary').textContent='🎲 Dice demo';
document.getElementById('gameplayPreviewOpenBtn')?.after(diceMenu);
const examplesSection=document.createElement('section');examplesSection.id='toolbarExamples';examplesSection.setAttribute('aria-label','Examples');
const examplesTitle=document.createElement('h3');examplesTitle.textContent='Examples';examplesTitle.style.cssText='margin:10px 0 6px;padding-top:10px;border-top:1px solid #50616c;font-size:12px;color:#d9bd83;';
const diceToggleLabel=document.createElement('label'),diceToggle=document.createElement('input');diceToggle.type='checkbox';diceToggle.id='toggleDiceDemo';diceToggle.checked=false;diceToggle.setAttribute('aria-controls','diceDemoMenu');diceToggleLabel.append(diceToggle,'Dice demo');
diceToggle.onchange=()=>{diceMenu.hidden=!diceToggle.checked;diceMenu.style.display=diceToggle.checked?'inline-block':'none';if(!diceToggle.checked)diceMenu.open=false;};
examplesSection.append(examplesTitle,diceToggleLabel);document.querySelector('#toolbarPicker .toolbar-picker-menu').append(examplesSection);
document.getElementById('diceCreateBtn').textContent='Load editable dice demo…';
document.getElementById('dicePhysicsBtn').textContent='Dice in Gameplay Preview';
document.getElementById('diceCreateBtn').onclick=()=>{
  if(!confirm('Load the separate dice project? This replaces the current workspace. Save your current project first. Cancel keeps it untouched.'))return;
  if(gameplayPreviewVisible())closeGameplayPreview();
  loadProjectData(createDiceProject(),'BWS-die-demo.modelerproj');diceRandomTimeline=false;
  document.getElementById('diceRandomInput').checked=false;
  document.getElementById('diceDemoMessage').textContent='Dice loaded. Open Animator Workspace to edit its six toss clips.';
};
document.getElementById('diceTimelineBtn').onclick=()=>{
  if(!isDiceDemo()){document.getElementById('diceDemoMessage').textContent='Load the editable dice demo first, or download it for a separate workspace.';return;}
  if(gameplayPreviewVisible())closeGameplayPreview();
  dicePickTimeline();animationState.playing=true;updateAnimationPanel();
};
document.getElementById('diceRandomInput').onchange=e=>{diceRandomTimeline=e.target.checked;};
document.getElementById('dicePhysicsBtn').onclick=openDicePhysics;
document.getElementById('diceProjectBtn').onclick=()=>downloadDiceFile(JSON.stringify(createDiceProject()),'BWS-die-demo.modelerproj','application/json');
document.getElementById('diceExportBtn').onclick=async()=>{
  const message=document.getElementById('diceDemoMessage');
  try {
    const response=await fetch('./demos/BWS-dice-randomizer.html');if(!response.ok)throw new Error('Export file missing');
    const html=(await response.text()).replace('<script id="dice-initial" type="application/json">[6]</script>',`<script id="dice-initial" type="application/json">${JSON.stringify(diceHand)}</script>`);
    downloadDiceFile(html,'BWS-dice-randomizer.html','text/html');message.textContent='Exported offline HTML with your selected handful.';
  }catch(error){message.textContent='Export unavailable: run the demo build, or open demos/BWS-dice-randomizer.html directly.';}
};
const diceRollButton=document.createElement('button');diceRollButton.id='diceRollAgainBtn';diceRollButton.textContent='🎲 Roll again';diceRollButton.hidden=true;diceRollButton.onclick=rollDicePhysics;
document.getElementById('gameplayPreviewPlayBtn')?.before(diceRollButton);
const hitTableButton=document.createElement('button');hitTableButton.id='diceHitTableBtn';hitTableButton.textContent='Hit the table';hitTableButton.onclick=()=>{if(dicePhysicsPreview){dicePhysicsPreview.shake();gameplayPlaybackPaused=false;gameplayLastFrame=performance.now();syncGameplayPlaybackUi();}};
document.getElementById('gameplayPreviewPlayBtn')?.before(hitTableButton);
const handControls=createHandControls(diceHand,hand=>{diceHand=hand;if(dicePhysicsPreview){dicePhysicsPreview.configure(hand);rollDicePhysics();}else openDicePhysics();});
const diceTrayControls=createTrayControls(()=>dicePhysicsPreview,()=>{gameplayPlaybackPaused=false;gameplayLastFrame=performance.now();syncGameplayPlaybackUi();});
document.getElementById('gameplayPreview')?.append(diceTrayControls);
for(const [id,label] of [['gameplayPreviewPlayBtn','Play'],['gameplayPreviewPauseBtn','Pause']]){const button=document.getElementById(id);button?.setAttribute('aria-label',label);button?.setAttribute('title',label);}
hitTableButton.title='Hit the table (Space)';diceRollButton.title='Reroll (Enter)';
document.getElementById('gameplayPreviewPlayBtn')?.before(handControls);
const minimizePlayer=document.createElement('button');minimizePlayer.id='gameplayMinimizeBtn';minimizePlayer.textContent='Minimize controls';minimizePlayer.setAttribute('aria-expanded','true');
minimizePlayer.onclick=()=>{const compact=document.getElementById('gameplayPreview').classList.toggle('controls-minimized');minimizePlayer.textContent=compact?'Show controls':'Minimize controls';minimizePlayer.setAttribute('aria-expanded',String(!compact));};
document.getElementById('gameplayPreviewCloseBtn')?.after(minimizePlayer);
minimizePlayer.after(els.gameplayHintText);
