import {createPlayers} from './dice-players.js';
import {createCelebration} from './dice-celebration.js';
export function scoreData(snapshot){
  const groups=new Map();for(const die of snapshot.dice){if(!groups.has(die.type))groups.set(die.type,[]);groups.get(die.type).push(die.result);}
  const waiting=snapshot.state==='rolling'||snapshot.state==='ready';
  const rows=[...groups].map(([type,values])=>{
    const name=type==='dice'?'Dice':type==='coin'?'Coin':`D${type}`;
    if(waiting||values.includes(null))return `${name}: —`;
    if(type==='coin')return `Coin: ${values.filter(v=>v===1).length} BoltWorks / ${values.filter(v=>v===2).length} Spark`;
    return `${name}: ${values.reduce((sum,v)=>sum+v,0)}`;
  });
  const coinOnly=snapshot.dice.length>0&&snapshot.dice.every(d=>d.type==='coin');
  let total=waiting||snapshot.total===null?'Total: —':`Total: ${snapshot.total}`;
  if(coinOnly){
    const values=snapshot.dice.map(d=>d.result);
    if(waiting)total=snapshot.state==='rolling'?'Flipping…':'Coin flip';
    else if(values.includes(null))total='Flip again';
    else if(values.length===1)total=values[0]===1?'BoltWorks':'Spark';
    else total=[values.filter(v=>v===1).length+' BoltWorks',values.filter(v=>v===2).length+' Spark'].join(' · ');
  }
  return {rows,total,status:snapshot.state==='rolling'?(coinOnly?'':'Rolling…'):snapshot.state==='ready'?(coinOnly?'':'Ready'):snapshot.dice.some(d=>d.result===null)?'Hit the table or roll again':coinOnly?(snapshot.dice.length===1?(snapshot.dice[0].result===1?'Heads · BW emblem':'Tails · Lightning emblem'):'Coin flips'):''};
}
export function createScoreboard(host,bar=null,onRoll=()=>{}){
  if(!document.getElementById('dice-score-styles')){const style=document.createElement('style');style.id='dice-score-styles';style.textContent=`
    .gameplay-preview.dice-preview .gameplay-preview-bar .gameplay-status,
    .gameplay-preview.dice-preview.controls-minimized .gameplay-preview-bar .gameplay-status{display:none!important;}
    .dice-scoreboard{position:absolute;left:12px;right:12px;top:var(--dice-score-top,16px);height:0;z-index:4;pointer-events:none;color:#ecdfb3;font:600 17px/1.5 system-ui;}
    .dice-score-list{position:absolute;left:0;top:0;display:grid;gap:3px;max-width:28%;max-height:45vh;overflow:auto;pointer-events:auto;padding:8px 12px;border-radius:6px;background:#07171dba;text-shadow:0 1px 3px #000;}
    .dice-score-total{position:absolute;top:0;left:50%;transform:translateX(-50%);width:44%;text-align:center;color:#f3c769;font:bold clamp(22px,3.2vw,42px)/1.2 Georgia,serif;text-shadow:0 2px 3px #000,0 0 12px #51370c;}
    .dice-score-note{display:block;min-height:32px;margin-top:5px;color:#e2d8bc;font:500 13px/1.3 system-ui;}
    .dice-score-turn{display:block;margin-top:6px;color:#f6e1ad;font:600 20px/1.3 system-ui;overflow-wrap:anywhere;}
    .gameplay-preview:not(.dice-preview)>.dice-scoreboard{display:none;}
    .gameplay-preview:not(.dice-preview)>.dice-celebration{display:none;}
    .dice-score-stage{position:relative;}
  `;document.head.append(style);}
  const root=document.createElement('section');root.className='dice-scoreboard';root.setAttribute('aria-label','Dice results');root.setAttribute('aria-live','polite');
  const list=document.createElement('div');list.className='dice-score-list';const total=document.createElement('div');total.className='dice-score-total';const value=document.createElement('span');const note=document.createElement('small');note.className='dice-score-note';total.append(value,note);root.append(list,total);host.append(root);
  const turn=document.createElement('div');turn.className='dice-score-turn';turn.setAttribute('aria-live','polite');total.insertBefore(turn,note);
  const celebration=createCelebration(host);
  const players=createPlayers((name,result)=>{turn.textContent=result?`${name} got ${result}!`:`${name}’s turn`;},onRoll,result=>{if(result){turn.textContent='Game complete';note.textContent='Final scores';celebration.show(result);}else celebration.clear();});root.append(players);
  function position(){const top=bar?bar.offsetTop+bar.offsetHeight+12:16;if(bar)root.style.setProperty('--dice-score-top',`${top}px`);root.style.setProperty('--dice-players-height',`${Math.max(100,host.clientHeight-top-(bar?80:20))}px`);}
  const observer=new ResizeObserver(position);observer.observe(host);if(bar)observer.observe(bar);position();
  return {update(snapshot){if(players.isFinished())return;const data=scoreData(snapshot);players.updateResult(snapshot,data);list.replaceChildren(...data.rows.map(text=>{const row=document.createElement('div');row.textContent=text;return row;}));value.textContent=data.total;note.textContent=data.status;position();},root};
}
