// Inspect post-opening references and heap, separately from the timing runs.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
let browser;
(async()=>{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-unsafe-swiftshader']});
 const results=[];
 for(const [label,port] of [['baseline',4182],['after',4181]]){
  const context=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block'}),page=await context.newPage(),cdp=await context.newCDPSession(page);
  await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
  await page.addInitScript(()=>{
   let now=1000,id=0;const callbacks=new Map();performance.now=()=>now;
   requestAnimationFrame=fn=>{callbacks.set(++id,fn);return id;};cancelAnimationFrame=id=>callbacks.delete(id);
   window.advance=ms=>{now=1000+ms;const batch=[...callbacks.values()];callbacks.clear();batch.forEach(fn=>fn(now));};
  });
  await page.route('**/app.js?*',route=>{
   const source=label==='baseline'?execFileSync('git',['show','4ee1528:app.js'],{cwd:path.resolve(__dirname,'../..')}).toString():fs.readFileSync(path.resolve(__dirname,'../../app.js'),'utf8');
   return route.fulfill({contentType:'text/javascript',body:source+'\nwindow.retainedOpening=()=>Object.fromEntries(["picture","lastPicture","collapseCanvas","signal","capture","capturePanic","skipSource"].map(key=>[key,!!connection[key]]));'});
  });
  await page.goto(`http://localhost:${port}/`);await page.waitForFunction(()=>__openingDebug.loaded===1,null,{polling:25});
  await page.locator('#jack-in').click();await page.mouse.move(0,0);
  for(const ms of [7300,8600,9400,10400,12000,15300,15320,16320,17900]){await page.evaluate(ms=>advance(ms),ms);await page.waitForTimeout(150);}
  if(!await page.locator('#opening').evaluate(el=>el.hidden))throw Error('Sequence not complete');
  await cdp.send('HeapProfiler.collectGarbage');
  results.push({label,retained:await page.evaluate(()=>retainedOpening()),heap:await cdp.send('Runtime.getHeapUsage')});await context.close();
 }
 fs.writeFileSync(path.join(__dirname,'retention.json'),JSON.stringify(results,null,2));console.log(results);
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();});
