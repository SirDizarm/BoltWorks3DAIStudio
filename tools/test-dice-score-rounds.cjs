const {chromium}=require(process.env.BWS_PLAYWRIGHT || 'playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});try{
 for(const offline of [false,true]){
  const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(offline?'http://127.0.0.1:4181/demos/BWS-dice-randomizer.html':'http://127.0.0.1:4181/');
  if(!offline){await page.waitForFunction(()=>!!window.ModelerStudio);await page.locator('#toolbarPicker>summary').click();await page.locator('#toggleDiceDemo').check();await page.locator('#toolbarPicker>summary').click();await page.locator('#diceDemoMenu>summary').click();await page.locator('#dicePhysicsBtn').click();}
  const players=page.locator('.dice-players');await players.locator('details>summary').first().click();
  await page.getByLabel('Player 1 name',{exact:true}).fill('Daniel');await page.getByLabel('Player 2 name',{exact:true}).fill('Robin');
  const roll=page.locator(offline?'#roll':'#diceRollAgainBtn'),next=page.getByRole('button',{name:'Next player & roll',exact:true});
  await page.getByRole('button',{name:'Clean box',exact:true}).click();
  async function valid(){for(let i=0;i<5;i++){await roll.click();try{await page.waitForFunction(()=>!document.querySelector('.player-next').disabled,null,{timeout:27000});return;}catch{}}throw Error('No readable roll');}
  await valid();assert.match(await page.locator('.dice-score-turn').textContent(),/^Daniel got \d+!/);
  await next.click();assert.equal(await next.isDisabled(),true);assert.equal(await page.locator('.dice-score-turn').textContent(),'Robin’s turn');
  await valid();await next.click();assert.match(await players.locator('summary').first().textContent(),/Round 2/);
  await players.locator('details>summary').nth(1).click();
  const rows=players.locator('table tr');assert.equal(await rows.count(),4);assert.ok((await rows.nth(1).textContent()).match(/\d/));
  assert.equal(await page.getByLabel('Number of players',{exact:true}).isDisabled(),true);
  await page.screenshot({path:`demos/dice-rounds-${offline?'export':'preview'}-qa.png`});
  assert.deepEqual(errors,[]);await page.close();console.log(`PASS ${offline?'HTML':'BWS'}: named results, next auto-roll, full round, history and roster lock.`);
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
