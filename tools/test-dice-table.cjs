const {chromium}=require(process.env.BWS_PLAYWRIGHT || 'playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});try{
const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:4181/');await page.waitForFunction(()=>!!window.ModelerStudio);const original=await page.evaluate(()=>JSON.stringify(ModelerStudio.state()));
await page.getByText('🎲 Die demo',{exact:true}).click();await page.locator('#dicePhysicsBtn').click();await page.locator('#gameplayPreviewPauseBtn').click();
// Enlarge only the test preview surface to inspect the actual BWS renderer.
await page.addStyleTag({content:'.gameplay-preview{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;z-index:9999!important}'});await page.setViewportSize({width:1601,height:1000});await page.waitForTimeout(500);
await page.locator('#gameplayMinimizeBtn').click();await page.screenshot({path:'demos/dice-ornate-table-preview.png'});
await page.getByRole('button',{name:'Top view',exact:true}).click();await page.screenshot({path:'demos/dice-ornate-table-top.png'});
const before=await page.evaluate(()=>ModelerStudio.diceDemoState().physics);await page.getByRole('button',{name:'Hide decorations',exact:true}).click();assert.deepEqual(await page.evaluate(()=>ModelerStudio.diceDemoState().physics),before);
await page.screenshot({path:'demos/dice-ornate-table-clean.png'});await page.getByRole('button',{name:'Show decorations',exact:true}).click();
assert.equal(await page.evaluate(()=>JSON.stringify(ModelerStudio.state())),original);assert.deepEqual(errors,[]);console.log('PASS: ornate table renders in BWS, both views, decoration toggle preserves physics and editor.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
