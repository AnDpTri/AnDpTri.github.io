// Real-time network measurements plus controlled-clock visual/skip regressions.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {session,jack,skipControlled,beatAt,setBrowser}=require('./verify.cjs');
const out=path.join(__dirname,'timing');fs.mkdirSync(out,{recursive:true});
const results=[];let browser;
async function test(name,fn){if(process.env.RETURN_ONLY&&!name.includes(process.env.RETURN_ONLY))return;const detail=await fn();results.push({name,pass:true,...detail});console.log('PASS',name,detail?.totalMs??'');}
async function view(s){return s.page.evaluate(()=>({phase:__openingDebug.phase,elapsed:__openingDebug.elapsed,title:document.querySelector('#boot-title').textContent,log:document.querySelector('#system-log').textContent,boot:!document.querySelector('#boot').hidden,card:!document.querySelector('#signal-card').hidden,controls:getComputedStyle(document.querySelector('#opening-controls')).visibility,interactive:!document.querySelector('#page').inert,loaded:__openingDebug.loaded,fallback:__openingDebug.fallback}));}
function wav(samples){const data=Buffer.alloc(44+samples.length*2);data.write('RIFF');data.writeUInt32LE(data.length-8,4);data.write('WAVEfmt ',8);data.writeUInt32LE(16,16);data.writeUInt16LE(1,20);data.writeUInt16LE(1,22);data.writeUInt32LE(48000,24);data.writeUInt32LE(96000,28);data.writeUInt16LE(2,32);data.writeUInt16LE(16,34);data.write('data',36);data.writeUInt32LE(samples.length*2,40);samples.forEach((n,i)=>data.writeInt16LE(Math.round(Math.max(-1,Math.min(1,n))*32767),44+i*2));return data;}
(async()=>{
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});setBrowser(browser);
 for(const [label,width,network,cpu] of [['fast-desktop',1440,null,1],['fast-mobile',390,null,1],['slow4g',390,{latency:400,downloadThroughput:500*1024/8,uploadThroughput:256*1024/8},4]])await test('real timeline '+label,async()=>{
  const s=await session({width,network});await s.cdp.send('Emulation.setCPUThrottlingRate',{rate:cpu});
  await s.page.evaluate(()=>{
   window.visualEvents=[];window.interactiveAt=null;
   addEventListener('pointerdown',event=>{window.clickedAt=event.timeStamp;},{capture:true,once:true});
   addEventListener('portfolio:cue',event=>{requestAnimationFrame(()=>visualEvents.push({...event.detail,at:performance.now(),title:document.querySelector('#boot-title').textContent,controls:getComputedStyle(document.querySelector('#opening-controls')).visibility}));});
   new MutationObserver(()=>{if(document.querySelector('#opening').hidden&&interactiveAt===null)interactiveAt=performance.now();}).observe(document.querySelector('#opening'),{attributes:true,attributeFilter:['hidden']});
  });
  await jack(s);await s.done();
  const timing=await s.page.evaluate(()=>({totalMs:interactiveAt-clickedAt,events:visualEvents,flag:localStorage.getItem('thepeak.seen'),audio:__audioDebug.state,cues:visitCues}));
  assert.equal(timing.flag,'1');assert.equal(timing.audio,'running');assert(timing.totalMs>=12500);if(!network)assert(timing.totalMs<=13500);
  const order=timing.cues.filter(c=>Object.hasOwn(beatAt,c.name)).map(c=>c.name);assert.deepEqual(order,Object.keys(beatAt));
  assert.equal((await view(s)).fallback,null);
  await s.page.locator('#prompt').fill('help');await s.page.locator('#prompt').press('Enter');assert.match(await s.page.locator('#command-history').innerText(),/whoami/);
  if(label==='fast-desktop'){
   const audio=await s.page.evaluate(async()=>{const {renderAudioPreview}=await import('/docs/return-visit/audio-preview.js');const {buffer,events}=await renderAudioPreview(visitCues);const samples=buffer.getChannelData(0);let peak=0,square=0;for(const n of samples){peak=Math.max(peak,Math.abs(n));square+=n*n;}return {samples:[...samples],events,duration:buffer.duration,peak,rms:Math.sqrt(square/samples.length)};});
   fs.writeFileSync(path.join(out,'audio-preview.wav'),wav(audio.samples));delete audio.samples;timing.preview=audio;
  }
  await s.close();return {network,cpu,...timing};
 });
 for(const width of [1440,768,390])await test('new beat frames '+width,async()=>{
  const s=await session({width,controlled:true});await s.ready();await jack(s);const frames=[];
  for(const [phase,at] of Object.entries(beatAt)){
   await s.step(at*1000+1);if(phase==='reacquire')await s.step(at*1000+21);
   if(phase==='settle'||phase==='complete')await s.step(at*1000+41);
   const state=await view(s);assert.equal(state.phase,phase);if(phase==='panic')assert.equal(state.title,'STOP!');
   if(['settle','complete'].includes(phase))assert.equal(state.controls,phase==='complete'?'visible':'hidden');
   await s.page.screenshot({path:path.join(out,`${width}-${phase}.jpg`),quality:82});frames.push({target:at,...state});
  }
  await s.done();assert.equal(await s.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await s.close();return {frames};
 });
 await test('consecutive STOP and collapse frames',async()=>{
  const s=await session({controlled:true});await s.ready();await jack(s);const frames=[];
  const times=[4.583,4.600,4.617,6.333,6.350,6.367,6.383,6.400,6.417,6.433,6.450,6.95,7.15,7.35,7.5];
  for(const t of times){await s.step(t*1000);const state=await view(s);await s.page.screenshot({path:path.join(out,`stop-${t.toFixed(3)}.jpg`),quality:85});frames.push({at:t,...state});}
  assert.equal(frames[1].title,'STOP!');assert.equal(frames[7].phase,'collapse');await s.close();return {frames};
 });
 for(const width of [1440,390])for(const [phase,at] of [['prompt',0],...Object.entries(beatAt).filter(([p])=>p!=='complete')])for(const gesture of ['button','Escape'])await test(`skip ${width} ${phase} ${gesture}`,async()=>{
  const s=await session({width,controlled:true});await s.ready();
  let time=0;
  if(phase!=='prompt'){
   await jack(s);
   for(const [p,t] of Object.entries(beatAt)){if(t>at)break;await s.step(t*1000+1);if(p==='reacquire')await s.step(t*1000+21);}
   time=at*1000+50;await s.step(time);assert.equal((await view(s)).phase,phase);
  }
  if(gesture==='button'&&!['reacquire','settle'].includes(phase))await s.page.locator('#skip-opening').click();else await s.page.keyboard.press('Escape');
  for(const ms of [10,100,500,1500,2600,3500])await s.step(time+ms);
  await s.done();const state=await view(s);assert.equal(state.fallback,null);assert.equal(state.interactive,true);assert.equal(await s.page.evaluate(()=>localStorage.getItem('thepeak.seen')),'1');await s.close();return {controlsAlreadyTorn:['reacquire','settle'].includes(phase)};
 });
 for(const skip of [false,true])await test('real readiness gate '+(skip?'skip':'natural'),async()=>{
  const s=await session({holdReady:true,controlled:true});
  if(skip)await s.page.keyboard.press('Escape');else await jack(s);
  for(const ms of [5000,8000,11000,14000,16000])await s.step(ms);
  assert.equal((await view(s)).interactive,false);assert.equal(await s.page.evaluate(()=>localStorage.getItem('thepeak.seen')),null);
  if(!skip)assert.equal((await view(s)).phase,'no-signal');
  s.releaseReady();await s.ready();for(const ms of [16100,16200,16600,18000,19000])await s.step(ms);await s.done();assert.equal((await view(s)).fallback,null);await s.close();return {interactiveWhileBlocked:false,waitUntil:16};
 });
 await test('opening failure does not remember a visit',async()=>{const s=await session({fail:true});await s.done();assert.equal(await s.page.evaluate(()=>localStorage.getItem('thepeak.seen')),null);await s.close();});
 for(const reduced of [true,false])await test('fallback full timeline '+(reduced?'reduced motion':'WebGL unavailable'),async()=>{
  const s=await session({reduced,controlled:true});
  if(!reduced){await s.context.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl'?null:get.call(this,type,...args);};});await s.load();}
  await s.ready();await jack(s);for(const at of Object.values(beatAt))await s.step(at*1000+50);await s.done();assert.equal((await view(s)).interactive,true);await s.close();
 });
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{fs.writeFileSync(path.join(out,process.env.RETURN_ONLY?'partial-results.json':'results.json'),JSON.stringify({browser:browser?.version(),passed:results.length,results},null,2));await browser?.close();});
