// Direct timing of all four chip buttons, including logout, with real touch on mobile.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
let browser;const runs=[];
(async()=>{
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
 for(const [label,port] of [['baseline',4192],['after',4191]])for(const mobile of [false,true]){
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile,serviceWorkers:'block'}),page=await context.newPage(),cdp=await context.newCDPSession(page),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:200000,uploadThroughput:93750,connectionType:'cellular4g'});
  await page.addInitScript(()=>{
   localStorage.setItem('thepeak.sound','off');window.chipEvents=[];window.chipLong=[];
   new PerformanceObserver(l=>chipEvents.push(...l.getEntries().map(e=>({name:e.name,start:e.startTime,duration:e.duration,id:e.interactionId})))).observe({type:'event',buffered:true,durationThreshold:16});
   new PerformanceObserver(l=>chipLong.push(...l.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true});
  });
  await page.goto(`http://localhost:${port}/`);await page.locator('#skip-opening').click();await page.waitForFunction(()=>document.querySelector('#opening').hidden);const actions=[];
  for(const name of ['help','projects','contact','logout']){
   await page.locator(`[data-command="${name}"]`).scrollIntoViewIfNeeded();await page.waitForTimeout(100);const start=await page.evaluate(()=>performance.now());
   if(mobile)await page.locator(`[data-command="${name}"]`).tap();else await page.locator(`[data-command="${name}"]`).click();
   await page.waitForTimeout(200);const data=await page.evaluate(start=>({events:chipEvents.filter(e=>e.start>=start&&e.id),long:chipLong.filter(e=>e.start>=start)}),start);
   const maximum=Math.max(0,...data.events.map(e=>e.duration));actions.push({name,...data,maxEventMs:maximum});if(label==='after')assert(maximum<100,`${mobile?'mobile':'desktop'} chip ${name}: ${maximum}ms`);
  }
  assert.deepEqual(errors,[]);runs.push({label,mobile,actions,errors});await context.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{fs.writeFileSync(path.join(__dirname,'chips.json'),JSON.stringify(runs,null,2));console.log(runs.map(r=>({label:r.label,mobile:r.mobile,actions:r.actions.map(a=>[a.name,a.maxEventMs])})));await browser?.close();});
