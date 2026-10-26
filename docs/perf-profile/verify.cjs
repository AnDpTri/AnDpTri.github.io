const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const result={checks:[],replays:[],errors:[]};let browser;
const check=(name,value)=>{result.checks.push({name,pass:!!value});assert.ok(value,name);};
async function session(port,options={}){
 const context=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block',...options}),page=await context.newPage(),cdp=await context.newCDPSession(page);
 page.on('pageerror',e=>result.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')result.errors.push(m.text());});
 await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
 await page.addInitScript(()=>{
  localStorage.setItem('thepeak.sound','off');window.audioContexts=0;
  const Audio=window.AudioContext;if(Audio)window.AudioContext=new Proxy(Audio,{construct(target,args){audioContexts++;return Reflect.construct(target,args);}});
  const nativeInterval=setInterval,nativeClear=clearInterval;window.activeIntervals=new Map();
  setInterval=(fn,delay,...args)=>{const id=nativeInterval(fn,delay,...args);activeIntervals.set(id,delay);return id;};clearInterval=id=>{activeIntervals.delete(id);nativeClear(id);};
  let now=1000,id=0;const frames=new Map();performance.now=()=>now;
  requestAnimationFrame=fn=>{frames.set(++id,fn);return id;};cancelAnimationFrame=id=>frames.delete(id);
  window.step=ms=>{now+=ms;const batch=[...frames.values()];frames.clear();batch.forEach(fn=>fn(now));};
  window.lifecycle=[];for(const type of ['pageshow','pagehide','visibilitychange'])addEventListener(type,e=>lifecycle.push({type,persisted:e.persisted,hidden:document.hidden}));
 });
 await page.goto(`http://localhost:${port}/`);await page.waitForFunction(()=>__openingDebug.loaded===1,null,{polling:50});
 return {context,page,cdp};
}
async function step(page,ms){await page.evaluate(ms=>window.step(ms),ms);await page.waitForTimeout(150);}
async function finish(page){
 await page.locator('#jack-in').click();await step(page,15300);await step(page,30);await step(page,2600);
 await page.waitForFunction(()=>document.querySelector('#opening').hidden,null,{polling:50});
}
async function submit(page,text){await page.locator('#prompt').fill(text);await page.locator('#prompt').press('Enter');await step(page,20);}
(async()=>{
 browser=await chromium.launch({channel:'chrome',headless:true,ignoreDefaultArgs:['--disable-back-forward-cache'],args:['--enable-unsafe-swiftshader']});
 for(const [label,port] of [['baseline',4192],['after',4191]]){
  const {context,page,cdp}=await session(port);await finish(page);
  await submit(page,'sound on');await step(page,30);await page.waitForTimeout(300);await submit(page,'sound off');
  const samples=[];
  for(let replay=0;replay<=5;replay++){
   if(replay){await page.locator('[data-command="logout"]').click();await page.waitForTimeout(400);await page.waitForFunction(()=>__openingDebug.loaded===1,null,{polling:50});await finish(page);}
   await page.waitForTimeout(500);await cdp.send('HeapProfiler.collectGarbage');
   samples.push({replay,heap:await cdp.send('Runtime.getHeapUsage'),dom:await cdp.send('Memory.getDOMCounters'),audioContexts:await page.evaluate(()=>audioContexts),voices:await page.evaluate(()=>__audioDebug.voices)});
  }
  result.replays.push({label,samples});check(`${label}: one AudioContext across 5 replays`,samples.every(s=>s.audioContexts===1));
  if(label==='after'){
   check('replay: DOM nodes stable after GC',new Set(samples.slice(1).map(s=>s.dom.nodes)).size===1);
   check('replay: listeners stable after GC',new Set(samples.slice(1).map(s=>s.dom.jsEventListeners)).size===1);
   check('handover heading focus without scroll',await page.evaluate(()=>document.activeElement.id==='name'&&scrollY===0));
   for(const command of ['help','whoami','projects --all','contact','sudo','hack','thepeak','not-a-command','clear']){
    await submit(page,command);check(`command: ${command}`,await page.evaluate(c=>c==='clear'?document.querySelector('#command-history').childElementCount===0:document.querySelector('#command-history').textContent.includes(c),command));
   }
   await page.locator('#prompt').fill('draft');await page.locator('#prompt').press('Escape');check('Escape clears prompt',await page.locator('#prompt').inputValue()==='');
   await page.locator('#prompt').press('ArrowUp');check('history up',await page.locator('#prompt').inputValue()==='clear');await page.locator('#prompt').press('ArrowDown');check('history down',await page.locator('#prompt').inputValue()==='');
   check('output log is polite live region',await page.locator('#command-history').getAttribute('aria-live')==='polite');
   check('prompt accessible name',await page.getByRole('textbox',{name:'Terminal command'}).count()===1);
   for(const name of ['help','projects','contact','logout ↗'])check(`chip accessible name: ${name}`,await page.getByRole('button',{name,exact:true}).count()===1);
   await page.locator('#sound-toggle').focus();await page.keyboard.press('Tab');if(await page.evaluate(()=>document.activeElement===document.body))await page.keyboard.press('Tab');check('skip link in keyboard order',await page.evaluate(()=>document.activeElement.classList.contains('skip-link')));
   check('skip link visible on keyboard focus',await page.locator('.skip-link').evaluate(el=>el.getBoundingClientRect().top>=0));
   await page.keyboard.press('Enter');check('skip reaches main',await page.evaluate(()=>document.activeElement.id==='main'));
   await page.setViewportSize({width:844,height:390});await page.setViewportSize({width:390,height:844});check('resize after opening: no overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   // Exercise the visualViewport-only keyboard path without claiming a physical OS keyboard.
   await page.locator('#prompt').focus();await page.evaluate(()=>{Object.defineProperty(visualViewport,'height',{configurable:true,get:()=>430});visualViewport.dispatchEvent(new Event('resize'));});
   check('keyboard viewport simulation: prompt above HUD',await page.locator('#prompt-form').evaluate(el=>el.getBoundingClientRect().bottom<=430-document.querySelector('#hud').offsetHeight-10));
   await page.evaluate(()=>{Object.defineProperty(visualViewport,'scale',{configurable:true,get:()=>1.5});visualViewport.dispatchEvent(new Event('resize'));});
   check('pinch zoom is not treated as a keyboard',await page.evaluate(()=>document.body.style.getPropertyValue('--keyboard-space')==='0px'));
   await page.evaluate(()=>{delete visualViewport.scale;});
   await page.evaluate(()=>{delete visualViewport.height;visualViewport.dispatchEvent(new Event('resize'));});
   check('keyboard space resets',await page.evaluate(()=>document.body.style.getPropertyValue('--keyboard-space')==='0px'));
   result.targets=await page.evaluate(()=>[...document.querySelectorAll('.masthead>a,.contacts a,#all-projects,#prompt,.run-command,#sound-toggle,.command-chips button')].map(el=>{const r=el.getBoundingClientRect(),pseudo=getComputedStyle(el,'::after');return {name:el.id||el.textContent,visual:{width:r.width,height:r.height},hit:{width:Math.max(r.width,parseFloat(pseudo.width)||0),height:Math.max(r.height,parseFloat(pseudo.height)||0)}};}));
   check('mobile tap targets >=44 CSS px',result.targets.every(t=>t.hit.width>=44&&t.hit.height>=44));
   await page.locator('[data-command="help"]').scrollIntoViewIfNeeded();const chip=await page.locator('[data-command="help"]').boundingBox();await page.mouse.click(chip.x+chip.width/2,chip.y+1);check('chip transparent hit padding works',await page.locator('#command-history').textContent().then(t=>t.includes('All commands run locally.')));
   await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
   check('hidden tab pauses ambient',await page.locator('body').evaluate(el=>el.classList.contains('ambient-paused')));
   check('hidden tab has zero repeating JS timers',await page.evaluate(()=>activeIntervals.size===0));
   await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
   check('visible tab resumes ambient',await page.locator('body').evaluate(el=>!el.classList.contains('ambient-paused')));
   await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>document.body.classList.contains('low-power'),null,{polling:25,timeout:2000});check('reduced motion updates live',await page.locator('body').evaluate(el=>el.classList.contains('low-power')));
   await page.emulateMedia({reducedMotion:'no-preference'});
  }
  await context.close();
 }
 // Real popups: keep them open long enough to assert the activation survives a paint.
 {
  const {context,page}=await session(4191);await finish(page);const opened=[];
  await context.route('**/*',route=>route.fulfill({contentType:'text/html',body:'<title>Navigation verified locally</title>'}));
  for(let i=1;i<=9;i++){const popupPromise=page.waitForEvent('popup');await submit(page,`open ${i}`);const popup=await popupPromise;await popup.waitForLoadState();opened.push(popup.url());await popup.close();}
  result.opened=opened;check('all 9 commands open real tabs',opened.length===9&&opened[4].endsWith('/eyecatch/'));await context.close();
 }
 for(const properties of [{hardwareConcurrency:4,deviceMemory:8},{hardwareConcurrency:8,deviceMemory:4}]){
  const context=await browser.newContext({viewport:{width:390,height:844}});await context.addInitScript(props=>{for(const [key,value] of Object.entries(props))Object.defineProperty(navigator,key,{get:()=>value});},properties);
  const page=await context.newPage();await page.goto('http://localhost:4191/');check(`low power ${JSON.stringify(properties)}`,await page.locator('body').evaluate(el=>el.classList.contains('low-power')));await context.close();
 }
 {
  const {context,page,cdp}=await session(4191,{viewport:{width:390,height:844},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'});await finish(page);
  await page.locator('#prompt').tap();check('iOS viewport policy applies on focus',await page.locator('meta[name="viewport"]').getAttribute('content').then(c=>c.includes('maximum-scale=1')));
  await page.locator('#prompt').fill('help');await page.locator('.run-command').tap();check('mobile touch submit works',await page.locator('#command-history').textContent().then(t=>t.includes('All commands run locally.')));
  await page.locator('#all-projects').tap();check('mobile touch --all expands archive',await page.locator('#archive').isVisible());
  await page.locator('[data-command="help"]').scrollIntoViewIfNeeded();const box=await page.locator('[data-command="help"]').boundingBox();
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2}]});
  check('mobile touch feedback',await page.locator('[data-command="help"]>span').evaluate(el=>getComputedStyle(el).backgroundColor==='rgb(238, 238, 234)'));
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.locator('#sound-toggle').tap();
  check('iOS viewport policy restores on blur',await page.locator('meta[name="viewport"]').getAttribute('content').then(c=>!c.includes('maximum-scale=1')));
  check('touch mobile has no horizontal scroll',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await context.close();
 }
 check('no console errors',result.errors.length===0);
})().catch(e=>{result.failure=e.stack;console.error(e);process.exitCode=1;}).finally(async()=>{fs.writeFileSync(path.join(__dirname,'verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({checks:result.checks.length,failure:result.failure,errors:result.errors}));await browser?.close();});
