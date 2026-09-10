const {chromium}=require(process.env.BWS_PLAYWRIGHT || 'playwright');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});try{for(const offline of [false,true]){
 const page=await browser.newPage({viewport:{width:1920,height:1080}});page.on('dialog',d=>d.accept());const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4181/'+(offline?'demos/BWS-dice-randomizer.html':''));
 if(!offline){await page.waitForFunction(()=>!!window.ModelerStudio);await page.locator('#toolbarPicker>summary').click();await page.locator('#toggleDiceDemo').check();await page.locator('#toolbarPicker>summary').click();await page.locator('#diceDemoMenu>summary').click();await page.locator('#dicePhysicsBtn').click();}
 const panel=page.locator('.dice-players');await panel.locator('details>summary').first().click();await page.getByLabel('Player 1 name',{exact:true}).fill('Daniel');await page.getByLabel('Player 2 name',{exact:true}).fill('Robin');await page.getByLabel('Number of rounds',{exact:true}).selectOption('1');await panel.locator('details>summary').nth(1).click();
 async function candidate(n){await panel.evaluate((el,n)=>el.updateResult({state:'settled',total:n,dice:[{type:6,result:n}]},{total:`Total: ${n}`,rows:[`D6: ${n}`]}),n);}
 for(const tie of [false,true]){
  await candidate(6);await page.getByRole('button',{name:'Next player & roll',exact:true}).click();assert.equal(await page.getByLabel('Number of rounds',{exact:true}).isDisabled(),true);
  await candidate(tie?6:3);await page.getByRole('button',{name:'Finish game',exact:true}).click();
  const celebration=page.locator('.dice-celebration');assert.ok(await celebration.isVisible());assert.match(await celebration.textContent(),tie?/Tie! Daniel & Robin/:/Daniel wins!/);assert.equal(await celebration.locator('i').count(),130);
  assert.ok(await page.getByRole('button',{name:'Game complete',exact:true}).isDisabled());
  if(!tie)await page.screenshot({path:`demos/dice-winner-${offline?'export':'preview'}-qa.png`});
  await page.getByRole('button',{name:'New game',exact:true}).click();assert.equal(await celebration.isVisible(),false);assert.equal(await celebration.locator('i').count(),0);assert.equal(await page.getByLabel('Number of rounds',{exact:true}).isDisabled(),false);
 }
 assert.deepEqual(errors,[]);await page.close();console.log(`PASS ${offline?'HTML':'BWS'}: round limit, winner, tie, 130 confetti pieces, locked finish, new-game cleanup.`);
}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
