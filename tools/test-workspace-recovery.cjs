const {chromium}=require(process.env.BWS_PLAYWRIGHT || 'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try {
  const page=await browser.newPage();
  page.on('dialog',d=>d.accept());
  await page.goto('http://127.0.0.1:4181/');
  await page.waitForFunction(()=>!!window.ModelerStudio);
  await page.locator('#toolbarPicker>summary').click();
  await page.locator('#toggleDiceDemo').check();
  await page.locator('#toolbarPicker>summary').click();
  await page.locator('#diceDemoMenu>summary').click();
  await page.locator('#diceCreateBtn').click();
  await page.getByRole('button',{name:'Cube',exact:true}).click();
  await page.waitForFunction(()=>localStorage.getItem('boltworks.recovery.latest-project'));
  const saved=await page.evaluate(()=>localStorage.getItem('boltworks.recovery.latest-project'));
  await page.locator('#newWorkspaceBtn').click();
  await page.waitForFunction(()=>document.querySelector('#autoSaveStatus').textContent==='Fresh workspace');
  assert.equal(await page.evaluate(()=>localStorage.getItem('boltworks.recovery.latest-project')),saved);
  for(let i=0;i<2;i++) {
   await page.reload();
   await page.waitForFunction(()=>!!window.ModelerStudio);
   await page.waitForTimeout(1800);
   assert.equal(await page.locator('#projectNameInput').inputValue(),'modeler-project');
   assert.equal(await page.evaluate(()=>localStorage.getItem('boltworks.recovery.manual-only')),'1');
  }
  await page.getByRole('button',{name:'Recover last save',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#projectNameInput').value==='BWS-die-demo');
  await page.reload();
  await page.waitForFunction(()=>document.querySelector('#projectNameInput').value==='BWS-die-demo');
  await page.locator('#newWorkspaceBtn').click();
  await page.waitForFunction(()=>document.querySelector('#autoSaveStatus').textContent==='Fresh workspace');
  await page.locator('#deleteLastSaveBtn').click();
  await page.waitForFunction(()=>document.querySelector('#autoSaveStatus').textContent==='Last recovery save deleted');
  assert.equal(await page.evaluate(()=>localStorage.getItem('boltworks.recovery.latest-project')),null);
  await page.reload();
  await page.waitForFunction(()=>!!window.ModelerStudio);
  await page.locator('#reloadLastSaveBtn').click();
  assert.equal(await page.locator('#projectNameInput').inputValue(),'modeler-project');
  console.log('PASS: fresh workspace survives repeated refresh; backup retained, manually recoverable; normal recovery works after recovery; explicit deletion removes backup.');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
