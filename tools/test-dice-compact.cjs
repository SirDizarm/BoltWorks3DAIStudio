const {chromium}=require(process.env.BWS_PLAYWRIGHT || 'playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}});await page.goto('http://127.0.0.1:4181/');await page.waitForFunction(()=>!!window.ModelerStudio);
 await page.getByText('🎲 Die demo',{exact:true}).click();await page.locator('#dicePhysicsBtn').click();await page.locator('#gameplayPreviewPauseBtn').click();await page.locator('#gameplayMinimizeBtn').click();
 for(const width of [1600,1000,700]){await page.setViewportSize({width,height:1000});let expected;
 for(const status of ['Rolling…','1× D6: 4 — Total 4','Rolling — result comes from the upper face',Array(8).fill('1× D20: 20').join(' · ')+' — Total 160']){
 await page.locator('#gameplayStatusText').evaluate((el,text)=>el.textContent=text,status);
 const box=await page.locator('.gameplay-preview-bar').boundingBox();const dimensions=[box.x,box.y,box.width,box.height];if(expected)assert.deepEqual(dimensions,expected);else expected=dimensions;
 const heights=await page.locator('.gameplay-preview-bar button:visible').evaluateAll(els=>els.map(el=>el.getBoundingClientRect().height));assert.ok(heights.length>=5);assert.ok(heights.every(h=>h===32),JSON.stringify(heights));
 }}await page.setViewportSize({width:1600,height:1000});await page.screenshot({path:'demos/dice-compact-layout-qa.png'});console.log('PASS: fixed compact frame across four status messages and three viewport widths; all five buttons 32px.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
