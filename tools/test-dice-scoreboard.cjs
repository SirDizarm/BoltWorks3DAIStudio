const {chromium}=require(process.env.BWS_PLAYWRIGHT || 'playwright');
const assert=require('node:assert/strict');
(async()=>{
const {scoreData}=await import('../app/demos/dice-scoreboard.js');const data=scoreData({state:'settled',total:19,dice:[{type:6,result:4},{type:6,result:6},{type:4,result:3},{type:'dice',result:6},{type:'coin',result:1}]});assert.deepEqual(data.rows,['D6: 10','D4: 3','Dice: 6','Coin: 1 Heads / 0 Tails']);assert.equal(data.total,'Total: 19');
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4181/');await page.waitForFunction(()=>!!window.ModelerStudio);
 await page.getByText('🎲 Die demo',{exact:true}).click();await page.locator('#dicePhysicsBtn').click();
 const buttons=page.locator('.gameplay-preview-bar button:visible');const positions=()=>buttons.evaluateAll(els=>els.map(el=>{const b=el.getBoundingClientRect();return [el.id,b.x,b.y,b.width,b.height];}));
 const rolling=await positions();await page.waitForFunction(()=>['settled','cocked'].includes(ModelerStudio.diceDemoState().physics.state),null,{timeout:40000});assert.deepEqual(await positions(),rolling,'Buttons moved after result');
 assert.ok(await page.locator('.dice-score-total').isVisible());assert.match(await page.locator('.dice-score-list').innerText(),/D6: /);
 await page.screenshot({path:'demos/dice-scoreboard-preview.png'});await page.locator('#gameplayMinimizeBtn').click();assert.ok(await page.locator('.dice-score-total').isVisible());
 await page.screenshot({path:'demos/dice-scoreboard-compact.png'});await page.locator('#diceRollAgainBtn').click();assert.equal(await page.locator('.dice-score-total>span').innerText(),'Total: —');assert.equal(await page.locator('.dice-score-note').innerText(),'Rolling…');
 assert.deepEqual(errors,[]);console.log('PASS: grouped subtotals, separate gold total, buttons fixed through roll, minimized scores, stale totals cleared.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
