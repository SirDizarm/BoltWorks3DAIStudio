// One model, three focused workspaces. Controls are moved, never cloned.
let animatorWorkspaceActive=false;
let bwsStudioWorkspace='modeling';
let animatorTimelineCollapsed=localStorage.getItem('boltworks.animatorTimelineCollapsed')==='true';
let animatorTimelineHome=null;
const bwsPoseControlHomes=[];
let bwsAnimationPosePanel=null;
let bwsBoneGuidesVisible=true;

function syncAnimatorMiniTransportUi(){const play=document.querySelector('#animatorMiniPlayBtn');if(play)play.textContent=animationState?.playing?'Pause':'Play';}
function syncAnimatorTimelineCollapseUi(){
 document.querySelector('.app')?.classList.toggle('timeline-collapsed',animatorTimelineCollapsed);
 if(els.animatorTimelineCollapseBtn){els.animatorTimelineCollapseBtn.textContent=animatorTimelineCollapsed?'Expand Timeline':'Minimize Timeline';els.animatorTimelineCollapseBtn.setAttribute('aria-expanded',String(!animatorTimelineCollapsed));els.animatorTimelineCollapseBtn.classList.toggle('active',animatorTimelineCollapsed);}
 syncAnimatorMiniTransportUi();
}
function setAnimatorTimelineCollapsed(collapsed){animatorTimelineCollapsed=!!collapsed;try{localStorage.setItem('boltworks.animatorTimelineCollapsed',String(animatorTimelineCollapsed));}catch{}syncAnimatorTimelineCollapseUi();requestAnimationFrame(()=>{window.dispatchEvent(new Event('resize'));if(typeof resize==='function')resize();});}
function bwsMovePoseControls(animation){
 if(!bwsAnimationPosePanel)return;
 for(const home of bwsPoseControlHomes){if(animation)bwsAnimationPosePanel.append(home.element);else home.marker.parentNode?.insertBefore(home.element,home.marker.nextSibling);}
 bwsAnimationPosePanel.hidden=!animation;
}
function moveAnimatorPanels(active){
 const app=document.querySelector('.app');if(!app||!els.animationSection)return;
 animatorTimelineHome||={marker:document.createComment('animation panel home')};
 if(!animatorTimelineHome.marker.parentNode)els.animationSection.before(animatorTimelineHome.marker);
 if(active)app.append(els.animationSection);else animatorTimelineHome.marker.parentNode.insertBefore(els.animationSection,animatorTimelineHome.marker.nextSibling);
 bwsMovePoseControls(active);
}
function syncAnimatorClipSelect(){
 if(!els.animatorClipSelect)return;
 if(typeof hasBwsAnimationClips==='function'&&hasBwsAnimationClips()){
  els.animatorClipSelect.replaceChildren(...Object.entries(animationState.clips).map(([id,clip])=>new Option(clip.name||id,id)));
  els.animatorClipSelect.disabled=false;els.animatorClipSelect.value=animationState.activeClipId;els.animatorClipSelect.dataset.source='bws';
 }else if(els.minecraftAnimationSelect){
  els.animatorClipSelect.replaceChildren(...[...els.minecraftAnimationSelect.options].filter(o=>o.value!==T_POSE_CLIP_ID).map(o=>new Option(o.textContent,o.value)));
  els.animatorClipSelect.disabled=els.minecraftAnimationSelect.disabled;els.animatorClipSelect.value=els.minecraftAnimationSelect.value;els.animatorClipSelect.dataset.source='legacy';
 }
 if(els.animationClipSelect)for(const option of els.animationClipSelect.options)if(option.value===T_POSE_CLIP_ID)option.hidden=bwsStudioWorkspace==='animation';
}
function setBwsStudioWorkspace(name,{initial=false}={}){
 const next=['modeling','rigging','animation'].includes(name)?name:'modeling';
 if(!initial&&next===bwsStudioWorkspace)return;
 animationState.playing=false;
 // Complete explicit bind-pose editing before entering another workspace.
 if(!initial&&tPoseFittingMode&&next!=='rigging'){
  if(next==='animation'&&animationState.clips?.[animationState.activeClipId])setActiveAnimationClip(animationState.activeClipId);
  else setTPoseFittingMode(false);
 }
 if(bwsStudioWorkspace!=='modeling'&&els.showBonesInput)bwsBoneGuidesVisible=els.showBonesInput.checked;
 bwsStudioWorkspace=next;animatorWorkspaceActive=next==='animation';
 document.body.dataset.studioWorkspace=next;
 const app=document.querySelector('.app');app?.classList.toggle('animator-mode',animatorWorkspaceActive);app?.classList.toggle('rigging-mode',next==='rigging');
 document.body.classList.toggle('animator-workspace-active',animatorWorkspaceActive);
 moveAnimatorPanels(animatorWorkspaceActive);
 if(els.bonePlacementSection)els.bonePlacementSection.hidden=next!=='rigging';
 for(const button of document.querySelectorAll('[data-bws-studio-workspace]')){const active=button.dataset.bwsStudioWorkspace===next;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));}
 if(els.showBonesInput)els.showBonesInput.checked=next!=='modeling'&&bwsBoneGuidesVisible;
 if(next==='modeling')selectedBoneId=null;
 if(next==='rigging'){
  els.bonePlacementSection?.classList.remove('collapsed');document.querySelector('#bonePlacementToggle')?.setAttribute('aria-expanded','true');
  if(!initial)setTPoseFittingMode(true);
 }
 if(animatorWorkspaceActive){
  els.animationSection?.classList.remove('collapsed');els.animationToggle?.setAttribute('aria-expanded','true');
  if(!initial)setRigSelectionTarget('bone');syncAnimatorClipSelect();
 }
 rebuildBoneVisuals();syncBonePanel();updateAnimationPanel();syncAnimatorTimelineCollapseUi();
 if(typeof updateTransformAttachment==='function')updateTransformAttachment();
 if(selected&&typeof syncInspector==='function')syncInspector();
 requestAnimationFrame(()=>{window.dispatchEvent(new Event('resize'));if(typeof resize==='function')resize();});
}
// Keep callers such as GLB import and Scene Studio compatible.
function setAnimatorWorkspace(active){setBwsStudioWorkspace(active?'animation':'modeling');}
function initializeAnimatorWorkspace(){
 const app=document.querySelector('.app'),launch=els.animatorWorkspaceOpenBtn;
 if(launch){
  const nav=document.createElement('div');nav.className='bws-workspace-nav';nav.setAttribute('role','group');nav.setAttribute('aria-label','Studio workspace');launch.before(nav);
  for(const [id,label]of [['modeling','Modeling'],['rigging','Rigging'],['animation','Animation']]){const button=id==='animation'?launch:document.createElement('button');button.type='button';button.textContent=label;button.title='Open '+label.toLowerCase()+' workspace';button.dataset.bwsStudioWorkspace=id;button.onclick=()=>setBwsStudioWorkspace(id);nav.append(button);}
 }
 if(els.workspaceSelect){const label=els.workspaceSelect.closest('label');if(label)label.hidden=true;else els.workspaceSelect.hidden=true;}
 bwsAnimationPosePanel=document.createElement('section');bwsAnimationPosePanel.id='bwsAnimationPosePanel';bwsAnimationPosePanel.className='section';bwsAnimationPosePanel.hidden=true;
 const heading=document.createElement('h2'),hint=document.createElement('p');heading.textContent='Pose controls';hint.className='api-note';hint.textContent='Select a bone, adjust its pose and add keys in the timeline. Build or change the skeleton in Rigging.';bwsAnimationPosePanel.append(heading,hint);app?.append(bwsAnimationPosePanel);
 const root=els.bonePlacementSection;
 if(root){
  const controls=[root.querySelector('#showBonesInput')?.closest('label'),
   root.querySelector('#boneGuideScaleInput')?.closest('label'),
   root.querySelector('.rig-selection-target'),...root.querySelectorAll('.bone-axis-row'),root.querySelector('#boneList'),root.querySelector('#bonePosX')?.closest('.field-grid'),root.querySelector('#boneRotX')?.closest('.field-grid')];
  for(const element of controls.filter(Boolean)){const marker=document.createComment('rigging control home');element.before(marker);bwsPoseControlHomes.push({element,marker});}
  const fitting=document.createElement('p');fitting.className='api-note';fitting.textContent='Rigging edits the bind pose. Switch to Animation to pose and key your character.';
  const button=document.createElement('button');button.type='button';button.textContent='Edit bind pose';button.onclick=()=>setTPoseFittingMode(true);
  root.querySelector('#bonePlacementBody')?.prepend(fitting,button);
 }
 // Generic model file actions are not rig-building tools: keep them available in each workspace.
 const io=root?.querySelector('.bone-import-export-actions');
 if(io){const files=document.createElement('div');files.className='bws-model-file-actions';files.setAttribute('role','group');files.setAttribute('aria-label','Model import and export');for(const id of ['importGlbBtn','importGlbFile','exportGlbBtn','importGltfBtn','importGltfFile','exportGltfBtn','importFbxBtn','importFbxFile','exportFbxBtn']){const element=document.getElementById(id);if(element)files.append(element);}document.querySelector('#toolbarProjectFilesGroup')?.append(files);}
 els.animatorTimelineCollapseBtn?.addEventListener('click',()=>setAnimatorTimelineCollapsed(!animatorTimelineCollapsed));
 for(const [mini,full]of Object.entries({animatorMiniPrevBtn:'animationPrevBtn',animatorMiniPlayBtn:'animationPlayBtn',animatorMiniStopBtn:'animationStopBtn',animatorMiniNextBtn:'animationNextBtn',animatorMiniResetBtn:'animationResetBtn'}))document.getElementById(mini)?.addEventListener('click',()=>{document.getElementById(full)?.click();requestAnimationFrame(syncAnimatorMiniTransportUi);});
 els.animatorClipSelect?.addEventListener('change',event=>{if(event.target.dataset.source==='bws')setActiveAnimationClip(event.target.value);else activateMinecraftAnimation(event.target.value);syncAnimatorClipSelect();});
 window.addEventListener('keydown',event=>{if(event.defaultPrevented||document.querySelector('dialog[open]')||event.target.closest('input,select,textarea,[contenteditable]'))return;if(event.key==='Escape'&&bwsStudioWorkspace!=='modeling')setBwsStudioWorkspace('modeling');});
 setBwsStudioWorkspace('modeling',{initial:true});
}
initializeAnimatorWorkspace();
