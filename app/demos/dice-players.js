import {createTurnTracker} from './dice-turns.js';
export function createPlayers(onTurn=()=>{},onRoll=()=>{},onFinish=()=>{}){
  if(!document.getElementById('dice-player-styles')){const style=document.createElement('style');style.id='dice-player-styles';style.textContent=`
  .dice-players{position:absolute;right:0;top:0;width:26%;max-width:230px;max-height:var(--dice-players-height,65vh);overflow:auto;pointer-events:auto;color:#eee0bd;font:13px/1.4 system-ui;}
  .dice-players details{margin:0;padding:9px;border:1px solid #b698625c;border-radius:10px;background:#10242fec;box-shadow:0 4px 14px #0004;}
  .dice-players summary{cursor:pointer;font-weight:700;}
  .dice-players .player-count{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:5px;margin:10px 0;}
  .dice-players select,.dice-players input{box-sizing:border-box;min-width:0;max-width:100%;border:1px solid #8c805f;border-radius:5px;background:#182f36;color:#fff0cd;padding:6px;font:inherit;}
  .dice-players ol{position:relative;list-style:none;margin:0;padding:0;max-height:30vh;overflow-y:auto;display:grid;gap:5px;}
  .dice-players li{display:flex;align-items:center;gap:5px;padding:5px;border:1px solid transparent;border-radius:6px;}
  .dice-players li input{width:100%;}
  .dice-players li[aria-current="true"]{border-color:#e8bd63;background:#72582960;box-shadow:inset 3px 0 #e8bd63;}
  .dice-players .player-current{margin:10px 0;color:#f4cf7a;overflow-wrap:anywhere;font-weight:700;}
  .dice-players button{margin:0;width:100%;padding:8px 4px!important;white-space:normal;font:600 13px system-ui;}
  .dice-players small{display:block;margin-top:7px;color:#aebfb9;font-size:10px;}
  .dice-players>.player-new-game{margin:6px 0;}
  .dice-players button:disabled{opacity:.45;cursor:default;}
  .dice-players .score-scroll{max-height:28vh;overflow:auto;margin-top:8px;}
  .dice-players table{border-collapse:collapse;table-layout:fixed;width:100%;font-size:12px;margin-bottom:8px;}
  .dice-players th,.dice-players td{padding:4px 2px;border-bottom:1px solid #8c805f66;text-align:left;white-space:normal;overflow-wrap:anywhere;vertical-align:top;}
  .dice-players th:first-child,.dice-players td:first-child{width:42px;white-space:nowrap;}
  .dice-players .score-entry{display:flex;flex-wrap:wrap;align-items:center;gap:3px 5px;}
  .dice-players .score-points{font-weight:700;}
  .dice-players .score-coins{display:flex;flex-wrap:wrap;gap:3px 5px;flex-basis:100%;}
  .dice-players .score-coin{display:inline-flex;align-items:center;gap:3px;white-space:nowrap;}
  .dice-players .coin-face{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;flex-shrink:0;border-radius:50%;border:1px solid #eac36a;background:#6a4818;color:#ffe1a0;font:bold 9px/1 system-ui;box-sizing:border-box;}
  .dice-players .coin-face.spark{font-size:13px;}
  .dice-players .pending-score{color:#f4cf7a;}
  `;document.head.append(style);}
  const root=document.createElement('aside');root.className='dice-players';root.setAttribute('aria-label','Player turns');
  const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Players';details.append(summary);root.append(details);
  const label=document.createElement('label');label.className='player-count';label.append('Players ');const count=document.createElement('select');count.setAttribute('aria-label','Number of players');for(let i=1;i<=12;i++)count.add(new Option(String(i),String(i)));count.value='2';label.append(count);details.append(label);
  const list=document.createElement('ol');list.setAttribute('aria-label','Turn order');details.append(list);
  const roundLabel=document.createElement('label');roundLabel.className='player-count';roundLabel.append('Rounds ');const rounds=document.createElement('select');rounds.setAttribute('aria-label','Number of rounds');rounds.add(new Option('Unlimited','0'));for(const n of [...Array.from({length:20},(_,i)=>i+1),25,50,100])rounds.add(new Option(String(n),String(n)));roundLabel.append(rounds);details.insertBefore(roundLabel,list);
  const current=document.createElement('p');current.className='player-current';current.setAttribute('aria-live','polite');details.append(current);
  const next=document.createElement('button');next.type='button';next.className='player-next';next.textContent='Next player & roll';
  const note=document.createElement('small');note.textContent='Accept a valid result to advance. Rerolls stay on this turn.';details.append(note);
  const scores=document.createElement('details'),scoreTitle=document.createElement('summary'),scroll=document.createElement('div');scoreTitle.textContent='Score history';scroll.className='score-scroll';scores.append(scoreTitle,scroll);root.append(scores);
  const clear=document.createElement('button');clear.type='button';clear.className='player-new-game';clear.textContent='New game';root.insertBefore(clear,details);scores.append(next);
  const storageNote=document.createElement('small');storageNote.textContent='This session only · * current result, not yet accepted · Coins do not add points';scores.append(storageNote);
  const names=Array.from({length:12},(_,i)=>`Player ${i+1}`),tracker=createTurnTracker();let active=0,size=2;
  const playerName=i=>names[i].trim()||`Player ${i+1}`;
  function showScores(){
    const entries=[...tracker.history];if(tracker.pending)entries.push({round:tracker.round,player:active,...tracker.pending,pending:true});
    function compact(entry){
      if(!entry)return '—';
      const result=document.createElement('span');result.className='score-entry';result.title=entry.label+(entry.pending?' (not yet accepted)':'');result.setAttribute('aria-label',result.title);
      if(typeof entry.total==='number'){const points=document.createElement('span');points.className='score-points';points.textContent=String(entry.total);result.append(points);}
      const coins=document.createElement('span');coins.className='score-coins';
      for(const [face,name,mark] of [[1,'BoltWorks','BW'],[2,'Spark','⚡']]){
        const n=entry.dice.filter(d=>d.type==='coin'&&d.result===face).length;if(!n)continue;
        const token=document.createElement('span');token.className='score-coin';token.title=`${n} ${name}`;token.setAttribute('aria-label',token.title);token.append(String(n));
        const icon=document.createElement('span');icon.className='coin-face'+(face===2?' spark':'');icon.textContent=mark;icon.setAttribute('aria-hidden','true');token.append(icon);coins.append(token);
      }
      if(entry.pending){const star=document.createElement('span');star.textContent='*';star.className='pending-score';result.append(star);}
      if(coins.childNodes.length)result.append(coins);
      return result;
    }
    // Stack pairs of player columns instead of widening the panel for large groups.
    const tables=[];
    for(let start=0;start<size;start+=2){
      const ids=Array.from({length:Math.min(2,size-start)},(_,i)=>start+i),table=document.createElement('table');table.setAttribute('aria-label','Round scores');
      function row(values,header=false){const tr=document.createElement('tr');for(const value of values){const cell=document.createElement(header?'th':'td');cell.append(value);tr.append(cell);}table.append(tr);}
      row(['Round',...ids.map(playerName)],true);
      for(let r=1;r<=tracker.round;r++)row([String(r),...ids.map(i=>compact(entries.find(e=>e.round===r&&e.player===i)))]);
      row(['Total',...ids.map(i=>{const values=entries.filter(e=>e.player===i&&typeof e.total==='number');return values.length?String(values.reduce((sum,e)=>sum+e.total,0)):'—';})],true);
      tables.push(table);
    }
    scroll.replaceChildren(...tables);scoreTitle.textContent=`Score history · Round ${tracker.round}`;
  }
  function showTurn(scroll=false){active=tracker.active;const name=playerName(active);const roundText=`Round ${tracker.round}${tracker.limit?' / '+tracker.limit:''}`;current.textContent=tracker.finished?'Game complete':`${roundText} · ${name}’s turn`;onTurn(name,tracker.pending?.label);summary.textContent=tracker.finished?'Players · Game complete':`Players · ${active+1}/${size} · ${roundText}`;next.textContent=tracker.finished?'Game complete':tracker.finalTurn?'Finish game':'Next player & roll';next.disabled=tracker.finished||!tracker.pending;next.title=tracker.finished?'Start a New game to play again':tracker.finalTurn?'Accept the final result and announce the winner':tracker.pending?'Save this result, advance and roll':'Finish a valid roll first';count.disabled=rounds.disabled=tracker.history.length>0;[...list.children].forEach((row,i)=>{row.querySelector('input').disabled=tracker.finished;if(i===active)row.setAttribute('aria-current','true');else row.removeAttribute('aria-current');});showScores();if(scroll){const row=list.children[active];if(row.offsetTop<list.scrollTop)list.scrollTop=row.offsetTop;else if(row.offsetTop+row.offsetHeight>list.scrollTop+list.clientHeight)list.scrollTop=row.offsetTop+row.offsetHeight-list.clientHeight;}}
  function render(){list.replaceChildren();for(let i=0;i<size;i++){const row=document.createElement('li'),number=document.createElement('span'),input=document.createElement('input');number.textContent=String(i+1);input.type='text';input.maxLength=40;input.value=names[i];input.setAttribute('aria-label',`Player ${i+1} name`);input.autocomplete='off';input.addEventListener('input',()=>{names[i]=input.value;showTurn();});row.append(number,input);list.append(row);}showTurn();}
  count.onchange=()=>{if(tracker.setSize(Number(count.value))){size=tracker.size;render();}};
  rounds.onchange=()=>{tracker.setLimit(Number(rounds.value));showTurn();};
  next.onclick=()=>{if(tracker.advance()){showTurn(true);if(tracker.finished){const result=tracker.winners();onFinish({names:result.players.map(playerName),points:result.points,rounds:tracker.round});}else onRoll();}};
  clear.onclick=()=>{if(!confirm('Clear this session’s score history and start round 1? Player names are kept.'))return;tracker.reset();onFinish(null);showTurn();onRoll();};
  root.isFinished=()=>tracker.finished;
  root.updateResult=(snapshot,data)=>{let label=data.total.replace(/^Total: /,'');if(snapshot.dice.some(d=>d.type==='coin')&&snapshot.dice.some(d=>d.type!=='coin'))label+=' · '+data.rows.find(r=>r.startsWith('Coin:'));tracker.update(snapshot,label);showTurn();};
  render();return root;
}
