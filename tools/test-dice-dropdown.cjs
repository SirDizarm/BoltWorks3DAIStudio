const {chromium}=require(process.env.BWS_PLAYWRIGHT || 'playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});try{
const page=await browser.newPage({viewport:{width:1920,height:1000}});await page.goto('http://127.0.0.1:4181/');await page.waitForFunction(()=>!!window.ModelerStudio);
await page.getByText('🎲 Die demo',{exact:true}).click();await page.locator('#dicePhysicsBtn').click();await page.locator('#gameplayPreviewPauseBtn').click();
await page.locator('#gameplayStatusText').evaluate(el=>el.textContent='1× D20: 6 · 2× D4: 4 + 1 = 5 · 2× D6: 2 + 6 = 8 · 1× D8: 1 · 1× D10: 9 · 1× D12: 7 — Total 36');
await page.locator('.gameplay-preview .dice-hand-controls summary').click();
assert.ok(await page.locator('#gameplayHintText').isVisible(),'Expanded shortcut reminder hidden');
await page.locator('#gameplayMinimizeBtn').click();
assert.ok(await page.locator('#gameplayHintText').isVisible(),'Minimized shortcut reminder hidden');
assert.match(await page.locator('#gameplayHintText').innerText(),/Enter: reroll.*Space: hit the table/);
assert.ok(await page.locator('.gameplay-preview .dice-hand-controls summary').isVisible(),'Dice selector hidden in compact mode');
for(const width of [1920,1600,1200,900]){await page.setViewportSize({width,height:1000});await page.waitForTimeout(150);
const box=await page.locator('.gameplay-preview').boundingBox(),menu=await page.locator('.gameplay-preview .dice-hand-body').boundingBox();
assert.ok(menu.x>=box.x&&menu.x+menu.width<=box.x+box.width+1,JSON.stringify({box,menu}));assert.ok(menu.y+menu.height<=box.y+box.height+1);
assert.ok(await page.getByLabel('Number of dice',{exact:true}).isVisible());}
await page.setViewportSize({width:1920,height:1000});await page.waitForTimeout(150);await page.screenshot({path:'demos/dice-dropdown-layout-qa.png'});
console.log('PASS: dropdown contained within preview at four widths, including wrapped controls.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
