// Optional browser tooling: NODE_PATH must contain playwright and pngjs.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const {PNG}=require('pngjs');
const base=process.env.RETURN_URL||'http://localhost:4191';
const out=path.join(__dirname,process.env.RETURN_STAGE||'after');
fs.mkdirSync(out,{recursive:true});
let browser;
const results=[];
const beatAt=Object.fromEntries([...fs.readFileSync(path.join(__dirname,'../../opening.js'),'utf8').matchAll(/\{at:([\d.]+),phase:'([^']+)'\}/g)].map(m=>[m[2],Number(m[1])]));
const panicMs=(beatAt.panic+.4)*1000,collapseMs=(beatAt.collapse+.3)*1000;
async function jack(s){const box=await s.page.locator('#jack-in').boundingBox();assert(box);await s.page.mouse.click(box.x+box.width/2,box.y+box.height/2);}
async function test(name,fn){if(process.env.RETURN_ONLY&&!name.includes(process.env.RETURN_ONLY))return;const detail=await fn();results.push({name,pass:true,...detail});console.log('PASS',name);}
async function session({width=1440,controlled=false,seen=false,storage=false,reduced=false,baseline=false,network=null,holdReady=false,fail=false}={}){
 const context=await browser.newContext({viewport:{width,height:width===390?844:900},isMobile:width===390,hasTouch:width===390,reducedMotion:reduced?'reduce':'no-preference',serviceWorkers:'block'});
 const page=await context.newPage(),errors=[];
 page.setDefaultTimeout(15000);
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
 if(network)await cdp.send('Network.emulateNetworkConditions',{offline:false,...network});
 let releaseReady;
 if(holdReady){
  const gate=new Promise(resolve=>{releaseReady=resolve;});
  await page.route('**/profile-ready-gate.png',async route=>{await gate;await route.fulfill({contentType:'image/png',body:fs.readFileSync(path.join(__dirname,'../../eyecatch/assets/signal-map.png'))});});
  await page.route(base+'/',route=>route.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8').replace('</body>','<img hidden src="/profile-ready-gate.png"></body>')}));
 }
 if(fail)await page.route('**/opening.js*',route=>route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(__dirname,'../../opening.js'),'utf8').replace('async run({returning=false}={}){','async run({returning=false}={}){throw Error("QA opening failure");')}));
 await page.addInitScript(({controlled,seen,storage})=>{
  if(storage){for(const name of ['getItem','setItem'])Storage.prototype[name]=()=>{throw new DOMException('Blocked','SecurityError');};}
  else if(seen)localStorage.setItem('thepeak.seen','1');
  if(controlled){
   const NativeDate=Date,fixed=Date.UTC(2026,9,27,12);window.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[fixed]));}static now(){return fixed;}};
   let seed=123456;Math.random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};
   let now=1000,id=0;const frames=new Map();performance.now=()=>now;
   requestAnimationFrame=fn=>{frames.set(++id,fn);return id;};cancelAnimationFrame=id=>frames.delete(id);
   window.advance=ms=>{now=1000+ms;const batch=[...frames.values()];frames.clear();batch.forEach(fn=>fn(now));};
  }
  window.visitCues=[];addEventListener('portfolio:cue',e=>visitCues.push({...e.detail,wall:performance.now(),title:document.querySelector('#boot-title').textContent}));
 },{controlled,seen,storage});
 if(baseline){
  const files=['index.html','style.css','opening.css','app.js','opening.js'];
  const bodies=Object.fromEntries(files.map(file=>[file,execFileSync('git',['show',`e190fef:${file}`],{encoding:'utf8'})]));
  await page.route('**/*',route=>{const file=new URL(route.request().url()).pathname.slice(1)||'index.html';return bodies[file]?route.fulfill({contentType:file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':'text/html',body:bodies[file]}):route.continue();});
 }
 const load=()=>page.goto(base+'/',{waitUntil:'domcontentloaded'});
 const ready=()=>page.waitForFunction(()=>__openingDebug.loaded===1,null,{polling:25});
 const step=async ms=>{await page.evaluate(ms=>advance(ms),ms);await page.waitForTimeout(100);};
 const done=()=>page.waitForFunction(()=>document.querySelector('#opening').hidden,null,{polling:25,timeout:45000});
 const close=async()=>{assert.deepEqual(errors,[]);await context.close();};
 await load();if(!fail)await page.waitForSelector('#jack-in');
 return {context,page,cdp,errors,load,ready,step,done,close,releaseReady};
}
async function skipControlled(s,at=0){
 await s.page.keyboard.press('Escape');
 for(const ms of [at+10,at+100,at+400,at+1000,at+2000,at+3000])await s.step(ms);
 await s.done();
}
async function snapshot(page,file){
 await page.evaluate(()=>{for(const a of document.getAnimations()){a.pause();a.currentTime=0;}document.querySelector('.cursor').style.cssText='animation:none;opacity:1';document.activeElement.blur();});
 await page.mouse.move(0,0);await page.screenshot({path:path.join(out,file),fullPage:true});
}
module.exports={session,jack,skipControlled,beatAt,setBrowser:value=>{browser=value;}};
if(require.main===module)(async()=>{
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
 await test('fresh visit runs fully; second load waits then tears directly',async()=>{
  const s=await session();await s.ready();assert.equal(await s.page.evaluate(()=>localStorage.getItem('thepeak.seen')),null);
  await jack(s);await s.done();
  const first=await s.page.evaluate(()=>({flag:localStorage.getItem('thepeak.seen'),phases:visitCues.filter(c=>c.targetTime!==undefined)}));assert.equal(first.flag,'1');assert(first.phases.some(c=>c.name==='panic'));assert(first.phases.some(c=>c.name==='no-signal'));
  await s.load();await s.ready();await s.page.waitForTimeout(6500);
  assert.equal(await s.page.evaluate(()=>__openingDebug.phase),'calm');assert(await s.page.locator('#jack-in').isVisible());
  await s.page.mouse.click(20,20);await s.done();
  const returned=await s.page.evaluate(()=>({phases:visitCues.map(c=>c.name),audio:__audioDebug.state}));assert(!returned.phases.includes('panic'));assert(returned.phases.includes('tear-burst'));assert.equal(returned.audio,'running');
  await s.close();return {first,returned,waitMs:6500};
 });
 for(const gesture of ['Enter','Space','Escape','sound','skip','tap'])await test('return gesture '+gesture,async()=>{
  const s=await session({seen:true,width:gesture==='tap'?390:1440});await s.ready();
  await s.page.keyboard.press('Tab');assert.equal(await s.page.evaluate(()=>__openingDebug.phase),'calm');
  if(gesture==='sound'||gesture==='skip')await s.page.locator(gesture==='sound'?'#sound-toggle':'#skip-opening').click();
  else if(gesture==='tap')await s.page.touchscreen.tap(25,25);else await s.page.keyboard.press(gesture);
  await s.done();assert.equal(await s.page.evaluate(()=>__audioDebug.state),'running');assert.equal(await s.page.evaluate(()=>visitCues.some(c=>c.name==='panic')),false);assert.equal(await s.page.evaluate(()=>__openingDebug.fallback),null);await s.close();
 });
 for(const width of [1440,390])await test('profile pixel preservation and replay '+width,async()=>{
  const pictures=[];let replayRect;
  for(const baseline of [true,false]){
   const s=await session({width,controlled:true,baseline});await s.ready();await skipControlled(s);
   if(!baseline){
    const rect=replayRect=await s.page.locator('#replay').boundingBox();assert(rect.width>=44&&rect.height>=44);assert.equal(await s.page.locator('#replay').getAttribute('aria-label'),'Replay the opening');
    await snapshot(s.page,`${width}-profile-replay.png`);
    await s.page.addStyleTag({content:'#replay{visibility:hidden}'});
   }
   const file=`${width}-profile-${baseline?'old':'hidden'}.png`;await snapshot(s.page,file);pictures.push(PNG.sync.read(fs.readFileSync(path.join(out,file))));
   if(!baseline){
    await s.page.addStyleTag({content:'#replay{visibility:visible}'});await s.page.locator('#replay').scrollIntoViewIfNeeded();
    const hits=await s.page.locator('#replay').evaluate(el=>{const r=el.getBoundingClientRect();return [r.top+1,r.bottom-1].map(y=>document.elementFromPoint(r.left+r.width/2,y)?.closest('#replay')===el);});assert.deepEqual(hits,[true,true]);
    await s.page.locator('#replay').focus();assert.equal(await s.page.locator('#replay').evaluate(el=>el.matches(':focus-visible')),true);
    if(width===390){const hit=await s.page.locator('#replay').boundingBox();await s.page.touchscreen.tap(hit.x+hit.width/2,hit.y+1);}else await s.page.keyboard.press('Enter');
    await s.page.waitForSelector('#jack-in');await s.ready();assert.equal(await s.page.evaluate(()=>__openingDebug.phase),'calm');
    await jack(s);const offset=await s.page.evaluate(()=>performance.now()-1000);await s.step(offset+collapseMs);assert.equal(await s.page.locator('#opening').isVisible(),true);assert.equal(await s.page.evaluate(()=>visitCues.filter(c=>c.name==='collapse').length),1);
    for(const at of [beatAt.blackout,beatAt['no-signal'],beatAt.reacquire+.001,beatAt.reacquire+.03,beatAt.settle+.05,beatAt.complete+.08])await s.step(offset+at*1000);
    await s.done();assert.equal(await s.page.evaluate(()=>__openingDebug.fallback),null);
   }
   await s.close();
  }
  assert.equal(pictures[0].width,pictures[1].width);assert.equal(pictures[0].height,pictures[1].height);
  let differentPixels=0;for(let i=0;i<pictures[0].data.length;i+=4)if([0,1,2].some(c=>pictures[0].data[i+c]!==pictures[1].data[i+c]))differentPixels++;
  assert.equal(differentPixels,0);
  const visible=PNG.sync.read(fs.readFileSync(path.join(out,`${width}-profile-replay.png`)));let buttonPixels=0;
  for(let i=0;i<visible.data.length;i+=4)if([0,1,2].some(c=>visible.data[i+c]!==pictures[0].data[i+c])){
   const x=(i/4)%visible.width,y=Math.floor(i/4/visible.width);assert(x>=replayRect.x&&x<=replayRect.x+replayRect.width&&y>=replayRect.y&&y<=replayRect.y+replayRect.height);buttonPixels++;
  }
  assert(buttonPixels>0);return {differentPixels,buttonPixels,replayRect};
 });
 await test('pointer replay on desktop',async()=>{
  const s=await session({seen:true,controlled:true});await s.ready();await skipControlled(s);
  await s.page.locator('#replay').click();await s.page.waitForSelector('#jack-in');await s.ready();
  await jack(s);const offset=await s.page.evaluate(()=>performance.now()-1000);await s.step(offset+panicMs);assert.equal(await s.page.evaluate(()=>__openingDebug.phase),'panic');await skipControlled(s,offset+panicMs);await s.close();
 });
 for(const command of ['logout','intro'])await test('full replay command '+command,async()=>{
  const s=await session({seen:true,controlled:true});await s.ready();await skipControlled(s);
  await s.page.locator('#prompt').fill(command);await s.page.locator('#prompt').press('Enter');await s.page.waitForSelector('#jack-in');await s.ready();await jack(s);const offset=await s.page.evaluate(()=>performance.now()-1000);await s.step(offset+panicMs);
  assert.equal(await s.page.evaluate(()=>__openingDebug.phase),'panic');await skipControlled(s,offset+panicMs);await s.close();
 });
 await test('storage denied stays a first visit after reload',async()=>{
  const s=await session({storage:true,controlled:true});await s.ready();await jack(s);await s.step(panicMs);assert.equal(await s.page.evaluate(()=>__openingDebug.phase),'panic');await skipControlled(s,panicMs);
  await s.load();await s.ready();await jack(s);await s.step(panicMs);assert.equal(await s.page.evaluate(()=>__openingDebug.phase),'panic');await s.close();
 });
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({browser:browser?.version(),passed:results.length,results},null,2));await browser?.close();});
