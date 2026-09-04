export function createCelebration(host){
  const layer=document.createElement('div');layer.className='dice-celebration';layer.style.cssText='position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:10;';layer.hidden=true;host.append(layer);
  const banner=document.createElement('div');banner.setAttribute('role','status');banner.style.cssText='position:absolute;left:50%;top:42%;transform:translate(-50%,-50%);max-width:70%;padding:20px 28px;border:1px solid #e2bb66;border-radius:16px;background:#10242feb;color:#ffda78;text-align:center;font:bold clamp(24px,4vw,54px)/1.2 Georgia,serif;overflow-wrap:anywhere;box-shadow:0 8px 40px #0007;';layer.append(banner);
  let bits=[];
  function clear(){for(const {node,animation} of bits){animation.cancel();node.remove();}bits=[];layer.hidden=true;banner.textContent='';}
  function show(result){
    clear();layer.hidden=false;
    banner.textContent=result.names.length===0?'Game complete — no numerical scores':result.names.length===1?`${result.names[0]} wins!`:`Tie! ${result.names.join(' & ')}`;
    const subtitle=document.createElement('div');subtitle.style.cssText='font:600 20px/1.4 system-ui;margin-top:10px;';subtitle.textContent=result.names.length?`${result.points} points · ${result.rounds} ${result.rounds===1?'round':'rounds'}`:'Coin results are recorded in score history.';banner.append(subtitle);
    if(!result.names.length||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const width=host.clientWidth,height=host.clientHeight,colors=['#ff5a72','#ffd35a','#53dcba','#60a8ff','#bf7cff','#ffffff'];
    for(let side=0;side<2;side++)for(let i=0;i<65;i++){
      const node=document.createElement('i');node.style.cssText=`position:absolute;left:${side?'100%':'0'};top:65%;width:9px;height:9px;background:${colors[i%colors.length]};`;layer.append(node);
      const dx=(side?-1:1)*width*(.15+Math.random()*.6),dy=height*(.22+Math.random()*.45),spin=180+Math.random()*720;
      const animation=node.animate([{transform:'translate(0,0) rotate(0deg)',opacity:1},{transform:`translate(${dx*.55}px,${-dy}px) rotate(${spin*.45}deg)`,opacity:1,offset:.4},{transform:`translate(${dx}px,${height*.55}px) rotate(${spin}deg)`,opacity:0}],{duration:2600+Math.random()*1000,delay:Math.random()*250,easing:'linear',fill:'forwards'});
      bits.push({node,animation});animation.onfinish=()=>{node.remove();bits=bits.filter(b=>b.node!==node);};
    }
  }
  return {show,clear};
}
