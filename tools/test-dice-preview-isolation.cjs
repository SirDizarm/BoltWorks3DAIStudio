const {chromium}=require(process.env.BWS_PLAYWRIGHT || 'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try {
  const page=await browser.newPage();
  page.on('dialog',d=>d.accept());
  await page.goto('http://127.0.0.1:4181/');
  await page.waitForFunction(()=>!!window.ModelerStudio);
  const controls=['#diceHitTableBtn','#diceRollAgainBtn','#gameplayPreview .dice-hand-controls','#gameplayPreview .dice-tray-controls','#gameplayPreview .dice-scoreboard'];
  async function noDice(){for(const selector of controls)assert.equal(await page.locator(selector).isVisible(),false,selector);assert.equal(await page.evaluate(()=>ModelerStudio.diceDemoState().physics),null);}
  await page.locator('#gameplayPreviewOpenBtn').click();
  await noDice();
  await page.locator('#gameplayMinimizeBtn').click();
  await noDice();
  await page.locator('#gameplayMinimizeBtn').click();
  await page.locator('#gameplayPreviewCloseBtn').click();
  await page.locator('#toolbarPicker>summary').click();
  await page.locator('#toggleDiceDemo').check();
  await page.locator('#toolbarPicker>summary').click();
  await page.locator('#diceDemoMenu>summary').click();
  await page.locator('#dicePhysicsBtn').click();
  const atRest=await page.evaluate(()=>ModelerStudio.diceDemoState().physics);
  assert.equal(atRest.state,'ready');
  await page.waitForTimeout(1500);
  assert.deepEqual(await page.evaluate(()=>ModelerStudio.diceDemoState().physics),atRest);
  await page.locator('.dice-players details>summary').first().click();
  await page.getByLabel('Player 1 name',{exact:true}).fill('Daniel');
  assert.equal(await page.evaluate(()=>ModelerStudio.diceDemoState().physics.state),'ready');
  await page.locator('#diceRollAgainBtn').click();
  assert.equal(await page.evaluate(()=>ModelerStudio.diceDemoState().physics.state),'rolling');
  for(const selector of controls.slice(0,4))assert.equal(await page.locator(selector).isVisible(),true,selector);
  await page.locator('#newWorkspaceBtn').click();
  await page.waitForFunction(()=>document.querySelector('#autoSaveStatus').textContent==='Fresh workspace');
  assert.equal(await page.locator('#gameplayPreview').isVisible(),false);
  await page.locator('#gameplayPreviewOpenBtn').click();
  await noDice();
  console.log('PASS: normal preview hides dice UI expanded/minimized; demo still works; New Workspace disposes active dice preview.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
