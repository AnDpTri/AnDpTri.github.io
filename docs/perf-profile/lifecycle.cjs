// Real clock, real tab visibility, BFCache, resize and scrolling trace; no fake animation clock.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const result={checks:[],runs:[],errors:[]};let browser;
function check(name,value){result.checks.push({name,pass:!!value});assert.ok(value,name);}
const metrics=async cdp=>Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
(async()=>{
 browser=await chromium.launch({channel:'chrome',headless:true,ignoreDefaultArgs:['--disable-back-forward-cache'],args:['--enable-unsafe-swiftshader']});
 for(const [label,port] of [['baseline',4192],['after',4191]]){
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),page=await context.newPage(),cdp=await context.newCDPSession(page);
  page.on('pageerror',e=>result.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')result.errors.push(m.text());});
  await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});await cdp.send('Performance.enable');await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  await page.addInitScript(()=>{
   localStorage.setItem('thepeak.sound','off');window.life={shifts:[],events:[]};
   new PerformanceObserver(l=>life.shifts.push(...l.getEntries().map(e=>({at:e.startTime,value:e.value,input:e.hadRecentInput,sources:e.sources.map(s=>({html:s.node?.outerHTML||s.node?.parentElement?.outerHTML,before:s.previousRect.toJSON(),after:s.currentRect.toJSON()}))})))).observe({type:'layout-shift',buffered:true});
   for(const type of ['pageshow','pagehide','visibilitychange'])addEventListener(type,e=>life.events.push({type,persisted:e.persisted,hidden:document.hidden,at:performance.now()}));
   addEventListener('portfolio:cue',e=>{if(e.detail.name==='complete')life.handover=performance.now();});
  });
  await page.goto(`http://localhost:${port}/`);await page.locator('#jack-in').click();await page.waitForFunction(()=>__openingDebug.phase==='no-signal');
  await page.setViewportSize({width:844,height:390});await page.waitForTimeout(300);await page.setViewportSize({width:390,height:844});
  await page.waitForFunction(()=>__openingDebug.phase==='complete',null,{timeout:60000});await page.waitForTimeout(300);
  check(`${label}: resize during opening has no fallback`,await page.evaluate(()=>!__openingDebug.fallback));
  check(`${label}: resize during opening has no overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const handover=await page.evaluate(()=>({at:life.handover,shifts:life.shifts.filter(s=>Math.abs(s.at-life.handover)<500)}));
  const chunks=[];cdp.on('Tracing.dataCollected',e=>chunks.push(...e.value));await cdp.send('Tracing.start',{categories:'devtools.timeline',transferMode:'ReportEvents'});
  const before=await metrics(cdp);
  for(let i=0;i<18;i++){await page.mouse.wheel(0,i<9?240:-240);await page.waitForTimeout(80);}
  const after=await metrics(cdp);const traced=new Promise(resolve=>cdp.once('Tracing.tracingComplete',resolve));await cdp.send('Tracing.end');await traced;
  const scroll={taskMs:1000*(after.TaskDuration-before.TaskDuration),layoutMs:1000*(after.LayoutDuration-before.LayoutDuration),paintMs:chunks.filter(e=>e.name==='Paint'&&e.ph==='X').reduce((n,e)=>n+(e.dur||0)/1000,0),paints:chunks.filter(e=>e.name==='Paint'&&e.ph==='X').length};
  const tab=await context.newPage();await tab.goto('about:blank');await tab.bringToFront();await page.waitForTimeout(300);
  const hidden=await page.evaluate(()=>({hidden:document.hidden,paused:document.body.classList.contains('ambient-paused'),events:life.events}));
  await page.bringToFront();await tab.close();await page.waitForTimeout(300);
  // Chrome headless can keep both pages visible; record that rather than inventing a tab switch.
  if(hidden.hidden&&label==='after')check('real hidden tab pauses ambient',hidden.paused);
  const rejected=[];cdp.on('Page.backForwardCacheNotUsed',e=>rejected.push(e));await cdp.send('Page.enable');
  // This is a native BFCache lifecycle check, separate from cache-disabled load measurements.
  await cdp.send('Network.setCacheDisabled',{cacheDisabled:false});
  const marker=await page.evaluate(()=>{window.restoreMarker=Math.random();return restoreMarker;});
  await page.goto(`http://localhost:${port}/assets/favicon.svg`);await page.goBack({waitUntil:'load'});await page.waitForTimeout(300);
  const restored=await page.evaluate(()=>({marker:window.restoreMarker,events:window.life?.events,phase:window.__openingDebug?.phase,inert:document.querySelector('#page')?.inert}));
  result.runs.push({label,scroll,handover,hidden,restored,rejected});
  if(label==='after'){
   if(restored.marker===marker){check('BFCache restored same document',restored.events.some(e=>e.type==='pageshow'&&e.persisted));check('BFCache profile remains interactive',restored.phase==='complete'&&!restored.inert);}
   else{await page.locator('#skip-opening').click();await page.waitForFunction(()=>document.querySelector('#opening').hidden);check('BFCache-ineligible navigation reloads and skip recovers',await page.evaluate(()=>!document.querySelector('#page').inert));}
   // Exercise persisted handlers even on headless builds that reject native BFCache.
   await page.evaluate(()=>{dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});
   check('persisted lifecycle resumes ambient',await page.locator('body').evaluate(el=>!el.classList.contains('ambient-paused')));
  }
  await context.close();
 }
 check('no console errors',result.errors.length===0);
})().catch(e=>{result.failure=e.stack;console.error(e);process.exitCode=1;}).finally(async()=>{fs.writeFileSync(path.join(__dirname,'lifecycle.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));await browser?.close();});
