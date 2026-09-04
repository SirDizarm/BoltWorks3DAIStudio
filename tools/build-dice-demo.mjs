import {build} from 'esbuild';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createDiceProject} from '../app/demos/dice-model.js';
const root=fileURLToPath(new URL('../',import.meta.url));
export async function buildDiceDemo(){
  const logo='data:image/png;base64,'+(await readFile(`${root}app/assets/branding/boltworks-logo.png`)).toString('base64');
  const coin='data:image/png;base64,'+(await readFile(`${root}app/assets/branding/bw-coin-reference.png`)).toString('base64');
  const result=await build({entryPoints:[`${root}app/demos/dice-standalone.js`],define:{__BWS_DICE_LOGO__:JSON.stringify(logo),__BWS_COIN_ART__:JSON.stringify(coin)},bundle:true,format:'iife',minify:true,legalComments:'inline',write:false});
  const licenses=await Promise.all(['three/LICENSE','cannon-es/LICENSE'].map(p=>readFile(`${root}node_modules/${p}`,'utf8')));
  const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BWS • Roll the die</title><style>*{box-sizing:border-box}body{margin:0;background:#10242f;color:#f6ead5;font:16px system-ui}header{padding:22px 5vw;display:flex;justify-content:space-between;align-items:center;gap:20px}h1{margin:0;font-size:28px}small{color:#a8c5c3}canvas{display:block;width:100%;height:65vh}footer{text-align:center;padding:16px}button{padding:13px 24px;margin:5px;border:1px solid #94d4bd;border-radius:8px;background:#245d52;color:white;font:inherit;cursor:pointer}button:focus-visible{outline:3px solid #ffcb73}output{font-size:20px;color:#ffcb73;max-width:55%;text-align:right}details{text-align:left;max-width:850px;margin:24px auto;color:#b7c9cd}pre{white-space:pre-wrap;font-size:11px}</style><header><div><h1>Roll the die.</h1><small>Made for BoltWorks 3D AI Studio • Offline physics demo</small></div><output aria-live="polite">Ready</output></header><canvas aria-label="Physical dice and collision tray"></canvas><footer><button id="roll">🎲 Roll</button><button id="pause">Pause</button><button id="reset">Reset</button><p>Pick D4, D6, D8, D10, D12 or D20 — up to eight dice. Knock them down! Reset rebuilds the tray.</p><small>Demo, not a certified fair gambling randomizer. No uploads, accounts or internet required.</small><details><summary>How it works & licenses</summary><p>Rounded rigid dice roll against the tray and movable props. Dice can rest against props or each other. Ambiguous landings ask for a manual reroll without moving the dice. Fallen props stay down until Reset. This is separate from BWS's authored animation timeline.</p><pre>${licenses.join('\n\n').replaceAll('&','&amp;').replaceAll('<','&lt;')}</pre></details></footer><script id="dice-initial" type="application/json">[6]</script><script>${result.outputFiles[0].text.replaceAll('</script','<\\/script')}</script></html>`;
  const creditedHtml=html.replace('Made for BoltWorks 3D AI Studio • Offline physics demo','<span id="creator-credit" style="display:block;margin-top:8px;color:#efc779;font-size:15px">Created by <strong>Daniel Rydin</strong> · Made in <strong>BoltWorks 3D AI Studio</strong></span><span style="display:block;margin-top:4px">Offline physics demo</span>')
    .replace('<title>BWS • Roll the die</title>','<title>BWS • Roll the dice</title>')
    .replace('<h1>Roll the die.</h1>','<h1>Roll the dice</h1>')
    .replace('header{padding:22px 5vw;display:flex;justify-content:space-between;align-items:center;gap:20px}','header{padding:22px 5vw;display:flex;justify-content:center;align-items:center;gap:20px;text-align:center}header>div{width:100%}');
  await mkdir(`${root}demos`,{recursive:true});
  await writeFile(`${root}demos/BWS-dice-randomizer.html`,creditedHtml);
  await writeFile(`${root}demos/BWS-die-demo.modelerproj`,JSON.stringify(createDiceProject()));
  console.log(`Built offline dice demo (${creditedHtml.length} characters) and editable project.`);
}
if(process.argv[1]===fileURLToPath(import.meta.url))await buildDiceDemo();
