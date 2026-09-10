const {chromium}=require(process.env.BWS_PLAYWRIGHT || 'playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});try{
 for(const offline of [false,true]){
  const page=await browser.newPage({viewport:{width:1920,height:1080}});
  await page.goto('http://127.0.0.1:4181/'+(offline?'demos/BWS-dice-randomizer.html':''));
  if(!offline){await page.waitForFunction(()=>!!window.ModelerStudio);await page.locator('#toolbarPicker>summary').click();await page.locator('#toggleDiceDemo').check();await page.locator('#toolbarPicker>summary').click();await page.locator('#diceDemoMenu>summary').click();await page.locator('#dicePhysicsBtn').click();await page.locator('#gameplayPreviewPauseBtn').click();}
  else await page.locator('#pause').click();
  const players=page.locator('.dice-players');await players.locator('details>summary').first().click();
  await page.getByLabel('Player 1 name',{exact:true}).fill('Daniel');await page.getByLabel('Player 2 name',{exact:true}).fill('Robin');
  await players.locator('details>summary').first().click();await players.locator('details>summary').nth(1).click();
  const newGame=players.getByRole('button',{name:'New game',exact:true}),next=players.getByRole('button',{name:'Next player & roll',exact:true});
  assert.ok((await newGame.boundingBox()).y<(await players.locator('details>summary').first().boundingBox()).y);
  assert.ok((await newGame.boundingBox()).y<(await players.locator('details>summary').nth(1).boundingBox()).y);
  assert.ok((await next.boundingBox()).y>(await players.locator('.score-scroll').boundingBox()).y);
  assert.equal(await players.getByText('New score game',{exact:true}).count(),0);
  for(const size of [2,4,12]){
   await players.evaluate((el,size)=>{const c=el.querySelector('select');c.value=String(size);c.dispatchEvent(new Event('change'));el.updateResult({state:'settled',total:25,dice:[{type:6,result:25},{type:'coin',result:1},{type:'coin',result:2},{type:'coin',result:2}]},{total:'Total: 25',rows:['Coin: 1 BoltWorks / 2 Spark']});},size);
   assert.equal(await players.locator('.score-coin').count(),2);assert.equal(await players.locator('[aria-label="1 BoltWorks"]').count(),1);assert.equal(await players.locator('[aria-label="2 Spark"]').count(),1);
   for(const width of [1920,1440]){await page.setViewportSize({width,height:1080});await page.waitForTimeout(80);assert.ok(await players.locator('.score-scroll').evaluate(el=>el.scrollWidth<=el.clientWidth+1),`${offline} ${size} ${width} horizontal overflow`);}
   if(size===2){await page.setViewportSize({width:1920,height:1080});await page.screenshot({path:`demos/dice-compact-coins-${offline?'export':'preview'}-qa.png`});}
  }
  await page.close();console.log(`PASS ${offline?'HTML':'BWS'} compact counts/icons; 2,4,12 players; no horizontal overflow at two widths.`);
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
