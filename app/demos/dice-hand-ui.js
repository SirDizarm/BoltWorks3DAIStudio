import {diceTypes,validateHand,typeLabel} from './dice-polyhedra.js';
export function createHandControls(initial,onChange){
  if(!document.getElementById('dice-hand-styles')){const style=document.createElement('style');style.id='dice-hand-styles';style.textContent=`
  .dice-hand-controls{position:relative;font:14px system-ui;color:#eef2f3;min-width:130px;margin:0;}
  .dice-hand-controls summary{cursor:pointer;padding:8px;background:#223c44;border:1px solid #56727c;border-radius:6px;}
  .dice-hand-body{position:absolute;right:0;top:100%;z-index:50;width:290px;max-height:60vh;overflow:auto;background:#162c33;border:1px solid #56727c;border-radius:6px;padding:12px;display:grid;gap:10px;box-shadow:0 8px 24px #0008;}
  .dice-hand-body label{display:flex;align-items:center;justify-content:space-between;gap:8px;}.dice-hand-body select{width:120px;padding:6px;color:white;background:#20363d;border:1px solid #557078;border-radius:5px;}
  .dice-slots{display:grid;gap:6px;}.dice-hand-body small{font-size:11px;line-height:1.4;}
  footer>.dice-hand-controls{display:inline-block;vertical-align:middle;}footer .dice-hand-body{top:auto;bottom:100%;}
  .gameplay-preview-bar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;}
  .gameplay-preview-bar>.dice-hand-controls{order:1;margin-left:auto;}
  .gameplay-preview .dice-hand-body{box-sizing:border-box;}
  .gameplay-preview-bar #gameplayHintText{flex-basis:100%;order:2;}.gameplay-preview-bar .gameplay-status{white-space:normal;margin-left:auto;max-width:55%;}
  .gameplay-preview.controls-minimized .gameplay-preview-bar{left:auto;right:10px;padding:6px;background:#0b171bbf;width:680px;box-sizing:border-box;}
  .gameplay-preview.controls-minimized .gameplay-preview-bar>*{display:none!important;}
  .gameplay-preview.dice-preview.controls-minimized .gameplay-preview-bar>.dice-hand-controls{display:block!important;margin-left:auto;order:1;}
  .gameplay-preview.dice-preview .gameplay-preview-bar #gameplayHintText{display:block!important;order:0;flex:1 1 140px;min-width:0;margin:0;color:#cfccb9;font-size:11px;line-height:1.5;white-space:normal;text-align:center;}
  .gameplay-preview.controls-minimized .gameplay-preview-bar .gameplay-status{display:block!important;width:100%;max-width:100%;flex:0 0 100%;min-width:0;margin:0;height:54px;line-height:18px;font-size:13px;overflow:auto;overflow-wrap:anywhere;box-sizing:border-box;}
  .gameplay-preview.dice-preview.controls-minimized .dice-tray-controls{display:flex!important;}
  .gameplay-preview.controls-minimized .gameplay-preview-bar{max-width:calc(100% - 20px);}
  .gameplay-preview.dice-preview.controls-minimized #diceRollAgainBtn:not([hidden]),.gameplay-preview.dice-preview.controls-minimized #diceHitTableBtn:not([hidden]),.gameplay-preview.controls-minimized #gameplayMinimizeBtn{display:block!important;min-height:28px;font-size:12px;}
  .gameplay-preview.controls-minimized .gameplay-preview-bar button{height:32px;min-height:32px;max-height:32px;padding:0 8px;margin:0;line-height:30px;font-size:12px;box-sizing:border-box;white-space:nowrap;}
  .gameplay-preview.controls-minimized .gameplay-preview-bar .dice-tray-controls{align-items:center;flex-wrap:wrap;}
  .gameplay-preview.dice-preview .gameplay-tools-menu{display:none!important;}
  .gameplay-preview>.dice-tray-controls{display:none!important;}
  .gameplay-preview.dice-preview>.dice-tray-controls{display:flex!important;position:absolute;right:14px;bottom:14px;z-index:8;max-width:calc(100% - 28px);flex-wrap:wrap;justify-content:flex-end;padding:8px;border:1px solid #bda06a55;border-radius:12px;background:#102329ed;box-shadow:0 5px 20px #0005;}
  .gameplay-preview.dice-preview .gameplay-preview-bar{border:1px solid #bda06a45;border-radius:12px;background:linear-gradient(130deg,#172c32ed,#0b181eee);box-shadow:0 4px 18px #0003;padding:10px;gap:8px;}
  .gameplay-preview.dice-preview button,.gameplay-preview.dice-preview .dice-hand-controls summary{border:1px solid #c5a66865;border-radius:8px;background:linear-gradient(#2b4146,#192d33);color:#f0e2c7;font:600 13px/1.2 system-ui;min-height:36px;padding:8px 12px;box-shadow:inset 0 1px #ffffff0c;transition:background .15s,border-color .15s;}
  .gameplay-preview.dice-preview button:hover:not(:disabled),.gameplay-preview.dice-preview summary:hover{border-color:#e4bd70;background:#344b4e;}
  .gameplay-preview.dice-preview button:focus-visible,.gameplay-preview.dice-preview summary:focus-visible{outline:2px solid #f0c66d;outline-offset:2px;}
  .gameplay-preview.dice-preview button:disabled{opacity:.4;}
  .gameplay-preview.dice-preview.controls-minimized .gameplay-preview-bar button{height:36px;min-height:36px;max-height:36px;line-height:34px;padding:0 10px;}
  .gameplay-preview.dice-preview #diceRollAgainBtn{border-color:#d5af65;background:linear-gradient(#816334,#594526);}
  .gameplay-preview.dice-preview #gameplayPreviewPlayBtn,.gameplay-preview.dice-preview #gameplayPreviewPauseBtn{font-size:0!important;width:38px;min-width:38px;padding:0;}
  .gameplay-preview.dice-preview #gameplayPreviewPlayBtn::before{content:'▶';font-size:17px;}
  .gameplay-preview.dice-preview #gameplayPreviewPauseBtn::before{content:'❚❚';font-size:17px;}
  .gameplay-preview:not(.dice-preview) #diceHitTableBtn,
  .gameplay-preview:not(.dice-preview) #diceRollAgainBtn,
  .gameplay-preview:not(.dice-preview) .dice-hand-controls,
  .gameplay-preview:not(.dice-preview) .dice-tray-controls{display:none!important;}
  `;document.head.append(style);}
  let hand=validateHand(initial);const root=document.createElement('details');root.className='dice-hand-controls';
  root.innerHTML='<summary>🎲 Dice count</summary><div class="dice-hand-body"><label>Number of dice <select aria-label="Number of dice"></select></label><div class="dice-slots"></div><button type="button">Apply new dices</button><small>Up to eight dice. D4 reads the upper vertex; others read the upper face. Applies to physics, not the D6 timeline.</small></div>';
  const count=root.querySelector('select');for(let n=1;n<=8;n++)count.add(new Option(String(n),String(n)));count.value=String(hand.length);
  // Keep the flyout inside the actual preview, not just the browser window.
  const panel=root.querySelector('.dice-hand-body');let observedPreview=null;
  function fitMenu(){if(!root.open)return;const preview=root.closest('.gameplay-preview');if(!preview)return;
    const bounds=preview.getBoundingClientRect(),anchor=root.getBoundingClientRect(),width=Math.min(314,Math.max(0,bounds.width-16));
    const left=Math.max(bounds.left+8,Math.min(anchor.right-width,bounds.right-width-8));
    panel.style.width=width+'px';panel.style.left=(left-anchor.left)+'px';panel.style.right='auto';panel.style.maxHeight=Math.max(0,bounds.bottom-anchor.bottom-8)+'px';
    if(observedPreview!==preview){observedPreview=preview;menuResize.observe(preview);}
  }
  const menuResize=new ResizeObserver(fitMenu);menuResize.observe(root);root.addEventListener('toggle',fitMenu);
  function slots(){const holder=root.querySelector('.dice-slots');holder.replaceChildren();hand.forEach((type,i)=>{const label=document.createElement('label');label.textContent=`Dice ${i+1} `;const select=document.createElement('select');select.setAttribute('aria-label',`Dice ${i+1} type`);diceTypes.forEach(t=>select.add(new Option(typeLabel(t),String(t))));select.value=String(type);select.onchange=()=>hand[i]=['dice','coin'].includes(select.value)?select.value:Number(select.value);label.append(select);holder.append(label);});}
  count.onchange=()=>{hand=Array.from({length:Number(count.value)},(_,i)=>hand[i]||6);slots();};
  root.querySelector('button').onclick=()=>{onChange(validateHand(hand));root.open=false;};slots();return root;
}
export function resultText(snapshot){
  if(snapshot.state==='rolling')return 'Rolling…';if(snapshot.state==='ready')return 'Ready';
  const groups=new Map();for(const d of snapshot.dice){if(!groups.has(d.type))groups.set(d.type,[]);groups.get(d.type).push(d.result);}
  const list=[...groups].map(([type,values])=>{const label=`${values.length}× ${typeLabel(type)}`;
    if(type==='coin')return `${label}: ${values.map(v=>v===null?'retry':v===1?'Heads':'Tails').join(', ')}`;
    return `${label}: ${values.map(v=>v===null?'retry':v).join(' + ')}${values.length>1&&!values.includes(null)?' = '+values.reduce((a,b)=>a+b,0):''}`;
  }).join(' · ');
  return list+(snapshot.dice.some(d=>d.result===null)?' — Total pending; hit table or reroll':snapshot.total!==null?` — Total ${snapshot.total}`:'');
}
export function createTrayControls(getDemo,onChange=()=>{}){
  const root=document.createElement('span');root.className='dice-tray-controls';root.style.cssText='display:flex;gap:6px;';
  let decorated=true;const decor=document.createElement('button');decor.textContent='Hide decorations';decor.setAttribute('aria-pressed','true');decor.onclick=()=>{const demo=getDemo();if(!demo)return;decorated=demo.setDecorationsVisible(!decorated);decor.textContent=decorated?'Hide decorations':'Show decorations';decor.setAttribute('aria-pressed',String(decorated));};
  let top=false,clean=false;const view=document.createElement('button'),clear=document.createElement('button');
  view.textContent='Top view';clear.textContent='Clean box';view.setAttribute('aria-pressed','false');clear.setAttribute('aria-pressed','false');
  view.onclick=()=>{const demo=getDemo();if(!demo)return;top=demo.setTopView(!top);view.textContent=top?'Angled view':'Top view';view.setAttribute('aria-pressed',String(top));};
  clear.onclick=()=>{const demo=getDemo();if(!demo)return;clean=demo.setCleanBox(!clean);clear.textContent=clean?'Restore props':'Clean box';clear.setAttribute('aria-pressed',String(clean));onChange();};
  root.append(view,clear,decor);root.reset=()=>{top=clean=false;decorated=true;decor.textContent='Hide decorations';decor.setAttribute('aria-pressed','true');view.textContent='Top view';clear.textContent='Clean box';view.setAttribute('aria-pressed','false');clear.setAttribute('aria-pressed','false');};return root;
}
