// Optional verification tool; production remains a build-free static site.
// Set NODE_PATH to a directory containing playwright before running.
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const label=process.argv[2]||'baseline';
const out=path.join(__dirname,label);fs.mkdirSync(out,{recursive:true});
const profiles={local:{latency:0,downloadThroughput:-1,uploadThroughput:-1},fast4g:{latency:150,downloadThroughput:200000,uploadThroughput:93750},slow4g:{latency:150,downloadThroughput:50000,uploadThroughput:50000}};
async function instrument(page,cdp){
 await page.addInitScript(()=>{
  window.perf={long:[],frames:{},cues:[],cpu:{},cls:0};
  new PerformanceObserver(l=>perf.long.push(...l.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true});
  new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)perf.cls+=e.value;}).observe({type:'layout-shift',buffered:true});
  document.fonts.ready.then(()=>perf.fontsReady=performance.now());
  addEventListener('load',()=>perf.load=performance.now());
  addEventListener('portfolio:cue',e=>perf.cues.push({at:performance.now(),...e.detail}));
  const check=()=>{if(!perf.interactive&&window.__openingDebug&&document.querySelector('#opening')?.hidden===false&&document.querySelector('#jack-in')?.hidden===false)perf.interactive=performance.now();};
  new MutationObserver(check).observe(document,{subtree:true,attributes:true,childList:true});
  let last=0;function frame(now){const phase=window.__openingDebug?.phase;if(last&&phase)(perf.frames[phase]??=[]).push(now-last);last=now;requestAnimationFrame(frame);}requestAnimationFrame(frame);
 });
 await cdp.send('Fetch.enable',{patterns:[{urlPattern:'*opening.js*',requestStage:'Response'},{urlPattern:'*audio.js',requestStage:'Response'}]});
 cdp.on('Fetch.requestPaused',async event=>{
  const response=await cdp.send('Fetch.getResponseBody',{requestId:event.requestId});let source=response.base64Encoded?Buffer.from(response.body,'base64').toString():response.body;
  if(event.request.url.includes('/opening.js')){
   source=source.replace("this.signal=new MonochromeSignal", "const gpuStart=performance.now();this.signal=new MonochromeSignal").replace('this.signal.setPicture(this.picture);','this.signal.setPicture(this.picture);window.perf.gpuInit=performance.now()-gpuStart;');
   source+='\nfor(const name of ["prepare","renderText","renderSignal"]){const original=Opening.prototype[name];Opening.prototype[name]=function(...args){const start=performance.now();const result=original.apply(this,args);const record=()=>{const item=window.perf.cpu[name]??={calls:0,ms:0};item.calls++;item.ms+=performance.now()-start;if(name==="prepare")window.perf.profileReady=performance.now();};if(result?.then)return result.finally(record);record();return result;};}\n';
  }else source+='\nfor(const name of ["build","schedule"]){const original=AudioScore.prototype[name];AudioScore.prototype[name]=function(...args){const start=performance.now();const result=original.apply(this,args);const item=window.perf.cpu[name]??={calls:0,ms:0};item.calls++;item.ms+=performance.now()-start;return result;};}\n';
  await cdp.send('Fetch.fulfillRequest',{requestId:event.requestId,responseCode:event.responseStatusCode,responseHeaders:event.responseHeaders.filter(h=>!['content-length','content-encoding'].includes(h.name.toLowerCase())),body:Buffer.from(source).toString('base64')});
 });
}
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
 for(const [profile,network] of Object.entries(profiles).filter(([name])=>!process.env.PERF_PROFILE||process.env.PERF_PROFILE===name))for(let run=1;run<=3;run++){
  const context=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block'});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});await cdp.send('Network.emulateNetworkConditions',{offline:false,...network,connectionType:'cellular4g'});await cdp.send('Emulation.setCPUThrottlingRate',{rate:profile==='local'?1:4});await cdp.send('Performance.enable');
  const requests=[];cdp.on('Network.responseReceived',e=>{if(e.response.url.startsWith('http:'))requests.push({url:e.response.url,bytes:0,status:e.response.status,fromDiskCache:e.response.fromDiskCache,id:e.requestId});});cdp.on('Network.loadingFinished',e=>{const r=requests.find(r=>r.id===e.requestId);if(r)r.bytes=e.encodedDataLength;});
  await instrument(page,cdp);await page.goto(`http://localhost:${process.env.PERF_PORT||4181}/`,{waitUntil:'domcontentloaded'});await page.waitForSelector('#jack-in',{state:'visible'});await page.locator('#jack-in').click();await page.waitForFunction(()=>window.__openingDebug?.phase==='complete',{},{timeout:90000});await page.waitForTimeout(1000);
  const result=await page.evaluate(()=>({...perf,paint:performance.getEntriesByType('paint').map(e=>({name:e.name,ms:e.startTime})),resources:performance.getEntriesByType('resource').filter(e=>!e.name.startsWith('data:')).map(e=>({url:e.name,bytes:e.transferSize,start:e.startTime,end:e.responseEnd})),fallback:window.__openingDebug.fallback,audioState:window.__audioDebug.state}));
  result.metrics=(await cdp.send('Performance.getMetrics')).metrics;result.requests=requests;result.errors=errors;result.profile=profile;result.run=run;
  fs.writeFileSync(path.join(out,`${profile}-${run}.json`),JSON.stringify(result,null,2));console.log(JSON.stringify({label,profile,run,requests:requests.length,bytes:requests.reduce((s,r)=>s+r.bytes,0),paint:result.paint,interactive:result.interactive,ready:result.profileReady,long:result.long.length,gpu:result.gpuInit,cpu:result.cpu,errors,fallback:result.fallback}));await context.close();
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
