// Accepted turns are immutable. Rerolls replace only the current candidate.
export function createTurnTracker(size=2){
  let active=0,round=1,pending=null,limit=0,finished=false;const history=[];
  return {
    get active(){return active;},get round(){return round;},get size(){return size;},get pending(){return pending;},history,
    get limit(){return limit;},get finished(){return finished;},
    get finalTurn(){return limit>0&&round===limit&&active===size-1;},
    setLimit(value){if(history.length||!Number.isInteger(value)||value<0||value>100)return false;limit=value;return true;},
    winners(){const totals=Array.from({length:size},()=>0);let scored=false;for(const entry of history){if(typeof entry.total==='number'){totals[entry.player]+=entry.total;scored=true;}}const high=Math.max(...totals);return {points:high,players:scored?totals.flatMap((n,i)=>n===high?[i]:[]):[]};},
    update(snapshot,label){
      if(finished)return;
      pending=snapshot.state==='settled'&&snapshot.dice.length>0&&snapshot.dice.every(d=>d.result!==null&&d.result!==undefined)
        ? {total:snapshot.total,label,dice:snapshot.dice.map(d=>({type:d.type,result:d.result}))}:null;
    },
    advance(){if(finished||!pending)return false;history.push({round,player:active,...pending});pending=null;if(limit>0&&round===limit&&active===size-1){finished=true;return true;}active++;if(active===size){active=0;round++;}return true;},
    setSize(value){if(history.length)return false;size=value;active=0;pending=null;return true;},
    reset(){history.length=0;active=0;round=1;pending=null;finished=false;}
  };
}
