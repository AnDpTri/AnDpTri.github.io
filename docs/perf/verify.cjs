// Browser regression checks. Optional tooling; no production dependencies.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..');
const port=process.env.PERF_PORT||4181;
const results=[];
let browser;
async function controlled(width=1440,reduced=false){
 const context=await browser.newContext({viewport:{width,height:width===390?844:900},reducedMotion:reduced?'reduce':'no-preference',serviceWorkers:'block'});
 const page=await context.newPage(),cdp=await context.newCDPSession(page),errors=[],requests=[];
 page.setDefaultTimeout(10000);
 await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>requests.push(r.url()));
 await page.addInitScript(()=>{
  let now=1000,id=0;const callbacks=new Map();window.frameRequests=0;
  performance.now=()=>now;
  requestAnimationFrame=callback=>{frameRequests++;callbacks.set(++id,callback);return id;};cancelAnimationFrame=id=>callbacks.delete(id);
  window.advance=ms=>{now=1000+ms;const batch=[...callbacks.values()];callbacks.clear();batch.forEach(fn=>fn(now));};
 });
 await page.goto(`http://localhost:${port}/`);
 const step=async ms=>{await page.evaluate(ms=>advance(ms),ms);await page.waitForTimeout(90);};
 const ready=()=>page.waitForFunction(()=>__openingDebug.loaded===1,null,{polling:25});
 const complete=()=>page.locator('#opening').evaluate(el=>el.hidden);
 return {context,page,cdp,errors,requests,step,ready,complete};
}
async function runSkip(width,phase,time,keyboard){
 const test=await controlled(width);const {page,step}=test;await test.ready();
 if(phase!=='prompt'){await page.locator('#jack-in').click();await page.mouse.move(0,0);}
 for(const ms of [3000,5000,7300,8600,9000,9400,10000,12000,15300,15320,16320,17350,17400].filter(ms=>ms<=time))await step(ms);
 if(phase!=='prompt')assert.equal(await page.evaluate(()=>__openingDebug.phase),phase);
 const controlsTornAway=['reacquire','settle'].includes(phase);
 if(controlsTornAway)assert.equal(await page.locator('#skip-opening').isVisible(),false);
 if(keyboard||controlsTornAway)await page.keyboard.press('Escape');else await page.locator('#skip-opening').click();
 for(let i=0;i<9&&!await test.complete();i++)await step(time+i*600);
 assert.equal(await test.complete(),true,`${width} ${phase} skip`);
 assert.equal(await page.locator('#page').evaluate(el=>el.inert),false);
 assert.equal(await page.locator('#skip-opening').isVisible(),false);
 assert.equal(await page.locator('#sound-toggle').isVisible(),true);
 assert.equal(await page.evaluate(()=>__openingDebug.fallback),null);
 assert(!test.requests.some(url=>url.includes('/eyecatch/')&&!url.endsWith('/signal-map.png')));
 assert.deepEqual(test.errors,[]);
 results.push({test:'skip',width,phase,keyboard,controlsTornAway,pass:true});console.log('PASS skip',width,phase,keyboard?'Esc':controlsTornAway?'controls torn away; Esc':'button');await test.context.close();
}
(async()=>{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
 if(!process.env.VERIFY_MEDIA_ONLY){
 for(const width of [1440,390])for(const [phase,time] of [['prompt',0],['calm',0],['unease',3000],['alarm',5000],['panic',7300],['collapse',9400],['blackout',10000],['no-signal',12000],['reacquire',16320],['settle',17400]])
  for(const keyboard of [false,true])await runSkip(width,phase,time,keyboard);
 for(const reduced of [false,true]){
  const test=await controlled(390,reduced);const {page,step}=test;await test.ready();await page.locator('#jack-in').click();await page.mouse.move(0,0);
  for(const ms of [7300,8600,9400,10400,12000,15300,15320,16320,17900])await step(ms);
  assert(await test.complete());assert.equal(await page.evaluate(()=>__openingDebug.fallback),null);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  const frames=await page.evaluate(()=>frameRequests);await page.waitForTimeout(500);assert.equal(await page.evaluate(()=>frameRequests),frames);
  assert.equal(await page.evaluate(()=>__openingDebug.webgl),false);
  // Restore the actual clock before checking sound scheduler work and visibility.
  await page.evaluate(async()=>{
   const {AudioScore}=await import('/audio.js');const original=AudioScore.prototype.schedule;window.schedulerCalls=0;
   AudioScore.prototype.schedule=function(...args){schedulerCalls++;return original.apply(this,args);};
  });
  await page.waitForTimeout(150);assert(await page.evaluate(()=>schedulerCalls)>0);
  await page.locator('#sound-toggle').click();const offCalls=await page.evaluate(()=>schedulerCalls);await page.waitForTimeout(160);assert.equal(await page.evaluate(()=>schedulerCalls),offCalls);
  await page.locator('#sound-toggle').click();await page.waitForTimeout(160);assert(await page.evaluate(()=>schedulerCalls)>offCalls);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  await page.waitForTimeout(150);const hiddenCalls=await page.evaluate(()=>schedulerCalls);assert.equal(await page.evaluate(()=>__audioDebug.state),'suspended');await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>schedulerCalls),hiddenCalls);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>__audioDebug.state),'running');assert(await page.evaluate(()=>schedulerCalls)>hiddenCalls);
  await page.locator('[data-command="help"]').click();assert.match(await page.locator('#command-history').innerText(),/whoami/);
  await page.locator('#all-projects').click();assert(await page.locator('#archive').isVisible());await page.locator('#all-projects').click();assert(!await page.locator('#archive').isVisible());
  await page.locator('[data-command="logout"]').click();await page.waitForFunction(()=>!document.querySelector('#opening').hidden,null,{polling:25});await test.ready();
  await page.keyboard.press('Escape');for(const ms of [18000,18500,19000,19500,20000,21000,22000]){await step(ms);if(await test.complete())break;}
  assert(await test.complete());assert.equal(await page.evaluate(()=>__openingDebug.fallback),null);assert.deepEqual(test.errors,[]);
  // A cold navigation downloads each font once, also across an in-document replay.
  for(const name of ['font-0.woff2','font-3.woff2'])assert.equal(test.requests.filter(url=>url.endsWith(name)).length,1);
  assert(!test.requests.some(url=>url.includes('/eyecatch/')&&!url.endsWith('/signal-map.png')));
  results.push({test:'natural completion, idle RAF, audio mute/visibility, commands, logout replay',width:390,reduced,pass:true});await test.context.close();
 }
 }
 // Font conversion: compare actual browser rasterization across the full Vietnamese set.
 const page=await browser.newPage();await page.goto(`http://localhost:${port}/`);
 for(const name of ['font-0.woff2','font-3.woff2']){
  const before=execFileSync('git',['show',`4ee1528:assets/fonts/${name}`],{cwd:root});const after=fs.readFileSync(path.join(root,'assets/fonts',name));
  const result=await page.evaluate(async({before,after,name})=>{
   const descriptors=name.includes('0')?{weight:'900',style:'italic'}:{weight:'400'};
   let text='Đặng Hoàng An ăâêôơưđ ĂÂÊÔƠƯĐ ';
   text+=String.fromCodePoint(...Array.from({length:90},(_,i)=>0x1ea0+i));
   text+=' '+text.normalize('NFD');
   const pixels=[];
   for(const [i,bytes] of [before,after].entries()){
    const face=new FontFace('check'+i,new Uint8Array(bytes),descriptors);await face.load();document.fonts.add(face);
    const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=900;const ctx=canvas.getContext('2d');ctx.font=`${descriptors.style??'normal'} ${descriptors.weight} 28px check${i}`;
    // Break by code points, preserving each base/combining group in the NFD sample.
    const lines=text.match(/.{1,40}(?:\p{M})*/gu);lines.forEach((line,row)=>ctx.fillText(line,10,40+row*40));pixels.push(ctx.getImageData(0,0,1200,900).data);
   }
   return {differentChannels:pixels[0].reduce((sum,value,i)=>sum+(value!==pixels[1][i]),0)};
  },{name,before:[...before],after:[...after]});assert.equal(result.differentChannels,0);results.push({test:'Vietnamese browser raster',name,...result,pass:true});
 }
 // Compare synthesis against a repeat of the baseline: native Web Audio has tiny
 // floating-point render differences even when rendering the same code twice.
 await page.route('**/baseline-audio.js',route=>route.fulfill({contentType:'text/javascript',body:execFileSync('git',['show','4ee1528:audio.js'],{cwd:root})}));
 const audio=await page.evaluate(async()=>{
  const classes=await Promise.all([import('/baseline-audio.js'),import('/audio.js')]);const buffers=[];
  const {CONNECTION_BEATS,CONNECTION_TIME,CONNECTION_TEAR}=await import('/opening.js');
  const duration=CONNECTION_TIME.complete+3.2;
  for(const {AudioScore} of [...classes,classes[0]]){
   let seed=1234;const random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};
   const context=new OfflineAudioContext(1,Math.ceil(48000*duration),48000),score=new AudioScore(context,random);
   // Give both synthesis versions the same offline timestamp-aware gain scheduler.
   // Live sound is unchanged; this comparison checks the original graph at new beats.
   score.phase=classes[1].AudioScore.prototype.phase;score.updateGain=classes[1].AudioScore.prototype.updateGain;
   const beats=[...CONNECTION_BEATS.map(({at,phase})=>[at,phase]),[duration,'end']];
   for(let i=0;i<beats.length-1;i++){
    const [at,phase]=beats[i];score.phase(phase,at);score.effect(phase,at);if(phase==='reacquire')score.effect('tear-burst',at+CONNECTION_TEAR.duration*CONNECTION_TEAR.burst);
    for(let t=at+.012;t<beats[i+1][0];t+=60/132/4){score.intensity=Math.min(1,(t-CONNECTION_TIME.alarm)/(CONNECTION_TIME.collapse-CONNECTION_TIME.alarm));score.note(t);}
   }
   buffers.push((await context.startRendering()).getChannelData(0));
  }
  const compare=(a,b)=>{let differentSamples=0,maxDifference=0,squared=0;for(let i=0;i<a.length;i++){const delta=Math.abs(a[i]-b[i]);if(delta)differentSamples++;maxDifference=Math.max(maxDifference,delta);squared+=delta*delta;}return {differentSamples,maxDifference,rmsDifference:Math.sqrt(squared/a.length)};};
  return {samples:buffers[0].length,beforeAfter:compare(buffers[0],buffers[1]),baselineRepeat:compare(buffers[0],buffers[2])};
 });console.log('audio comparison',audio);assert(audio.beforeAfter.maxDifference<=1e-5&&audio.beforeAfter.rmsDifference<=1e-7);results.push({test:'offline audio PCM',...audio,pass:true});await page.close();
 console.log(JSON.stringify({passed:results.length,results},null,2));fs.writeFileSync(path.join(__dirname,process.env.VERIFY_OUT||(process.env.VERIFY_MEDIA_ONLY?'media-verification.json':'verification.json')),JSON.stringify({passed:results.length,results},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();});
