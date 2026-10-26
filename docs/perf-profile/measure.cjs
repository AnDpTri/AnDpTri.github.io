// Run with the pinned Node runtime and NODE_PATH from README.md. No production dependencies.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const label=process.argv[2]||'after',port=process.argv[3]||4191;
const mobile=process.env.PROFILE_MOBILE==='1';
const out=path.join(__dirname,label,mobile?'mobile':'.');fs.mkdirSync(out,{recursive:true});
const networks={fast4g:{latency:150,downloadThroughput:200000,uploadThroughput:93750},slow4g:{latency:150,downloadThroughput:50000,uploadThroughput:50000}};
let browser;
const metric=async cdp=>Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
(async()=>{
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
 for(const [network,conditions] of Object.entries(networks).filter(([name])=>!process.env.PROFILE_NETWORK||name===process.env.PROFILE_NETWORK))for(let run=Number(process.env.PROFILE_RUN||1);run<=Number(process.env.PROFILE_RUN||(mobile?1:3));run++){
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile,serviceWorkers:'block'}),page=await context.newPage(),cdp=await context.newCDPSession(page),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
  await cdp.send('Network.emulateNetworkConditions',{offline:false,...conditions,connectionType:'cellular4g'});
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});await cdp.send('Performance.enable');
  await page.addInitScript(()=>{
   localStorage.setItem('thepeak.sound','off');
   window.profilePerf={events:[],long:[],shifts:[],marks:[]};
   new PerformanceObserver(l=>profilePerf.events.push(...l.getEntries().map(e=>({name:e.name,start:e.startTime,duration:e.duration,processing:e.processingEnd-e.processingStart,id:e.interactionId})))).observe({type:'event',buffered:true,durationThreshold:16});
   new PerformanceObserver(l=>profilePerf.long.push(...l.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true});
   new PerformanceObserver(l=>profilePerf.shifts.push(...l.getEntries().map(e=>({at:e.startTime,value:e.value,input:e.hadRecentInput,sources:e.sources.map(s=>({node:s.node?.id||s.node?.className,html:(s.node?.outerHTML||s.node?.parentElement?.outerHTML)?.slice(0,250),before:s.previousRect.toJSON(),after:s.currentRect.toJSON()}))})))).observe({type:'layout-shift',buffered:true});
   addEventListener('portfolio:cue',e=>{if(e.detail.name==='complete')profilePerf.handover=performance.now();});
   document.fonts.ready.then(()=>profilePerf.fonts=performance.now());
   // Include events shorter than Event Timing's 16 ms floor, as an explicitly labelled proxy.
   for(const type of ['keydown','click','pointerover'])addEventListener(type,()=>{const start=performance.now();requestAnimationFrame(()=>setTimeout(()=>profilePerf.marks.push({type,start,toNextPaint:performance.now()-start}),0));},{capture:true});
  });
  await page.goto(`http://localhost:${port}/`);await page.locator('#jack-in').click();
  await page.waitForFunction(()=>__openingDebug.phase==='complete',null,{timeout:90000});await page.waitForTimeout(500);
  const completed=await page.evaluate(()=>({at:performance.now(),focus:document.activeElement.id,scrollY,fonts:document.fonts.status,fallback:__openingDebug.fallback}));
  const startIdle=await metric(cdp);await page.waitForTimeout(8000);const endIdle=await metric(cdp);
  const actions=[];
  async function action(name,fn){const start=await page.evaluate(()=>performance.now());await fn();await page.waitForTimeout(180);const end=await page.evaluate(()=>performance.now());actions.push({name,start,end});}
  await page.locator('#prompt').scrollIntoViewIfNeeded();await page.locator('#prompt').focus();
  await action('typing',()=>page.keyboard.type('help',{delay:45}));await page.locator('#prompt').fill('');
  // Popups are aborted before any repository or lab can load.
  await context.route('**/*',route=>new URL(route.request().url()).port!==String(port)?route.abort():route.continue());
  page.on('popup',p=>p.close());
  for(const command of ['help','projects','projects --all',...Array.from({length:9},(_,i)=>`open ${i+1}`),'contact','sudo','hack','thepeak','unknown','clear','mute','mute']){
   await page.locator('#prompt').fill(command);await action(command,()=>page.locator('#prompt').press('Enter'));
  }
  for(const name of ['help','projects','contact'])await action(`chip ${name}`,()=>page.locator(`[data-command="${name}"]`).click());
  await action('--all',()=>page.locator('#all-projects').click());
  for(let i=0;i<5;i++){await page.mouse.move(0,0);await action(`hover ${i+1}`,()=>page.locator('.project-row').nth(i).hover());}
  await page.locator('#prompt').fill('logout');await action('logout',()=>page.locator('#prompt').press('Enter'));
  const data=await page.evaluate(()=>profilePerf);
  const result={label,network,run,browser:browser.version(),completed,idle:{seconds:8,taskMs:(endIdle.TaskDuration-startIdle.TaskDuration)*1000,scriptMs:(endIdle.ScriptDuration-startIdle.ScriptDuration)*1000,layoutMs:(endIdle.LayoutDuration-startIdle.LayoutDuration)*1000},actions:actions.map(a=>({...a,events:data.events.filter(e=>e.start>=a.start&&e.start<=a.end),paintProxies:data.marks.filter(e=>e.start>=a.start&&e.start<=a.end),long:data.long.filter(e=>e.start>=a.start&&e.start<=a.end)})),...data,errors};
  fs.writeFileSync(path.join(out,`${network}-${run}.json`),JSON.stringify(result,null,2));
  console.log(JSON.stringify({label,network,run,idle:result.idle,cls:data.shifts.filter(s=>!s.input).reduce((n,s)=>n+s.value,0),handoverShifts:data.shifts.filter(s=>Math.abs(s.at-data.handover)<500),maxEvent:Math.max(0,...result.actions.flatMap(a=>a.events.map(e=>e.duration))),errors}));
  await context.close();if(errors.length||completed.fallback)throw Error('Invalid run');
 }
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>browser?.close());
