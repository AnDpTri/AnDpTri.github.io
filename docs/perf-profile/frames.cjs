// Deterministic same-state comparison, separate from real-time performance measurement.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path');
const label=process.argv[2]||'after',port=process.argv[3]||4191;
const out=path.join(__dirname,label,'frames');fs.mkdirSync(out,{recursive:true});
let browser;
(async()=>{
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
 for(const [width,height] of [[1440,900],[390,844]]){
  const context=await browser.newContext({viewport:{width,height},serviceWorkers:'block'}),page=await context.newPage(),cdp=await context.newCDPSession(page);
  await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
  await page.addInitScript(()=>{
   Object.defineProperty(navigator,'hardwareConcurrency',{get:()=>8});Object.defineProperty(navigator,'deviceMemory',{get:()=>8});
   localStorage.setItem('thepeak.sound','off');
   const NativeDate=Date,fixed=Date.UTC(2026,9,26,12);window.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[fixed]));}static now(){return fixed;}};
   let seed=123456;Math.random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};
   let now=1000,id=0;const frames=new Map();performance.now=()=>now;
   requestAnimationFrame=fn=>{frames.set(++id,fn);return id;};cancelAnimationFrame=id=>frames.delete(id);
   window.advance=ms=>{now=1000+ms;const batch=[...frames.values()];frames.clear();batch.forEach(fn=>fn(now));};
  });
  await page.goto(`http://localhost:${port}/`);await page.waitForFunction(()=>__openingDebug.loaded===1,null,{polling:50});await page.evaluate(()=>document.fonts.ready);
  const step=async ms=>{await page.evaluate(ms=>advance(ms),ms);await page.waitForTimeout(250);};
  const capture=async name=>{await page.evaluate(()=>{for(const a of document.getAnimations()){a.pause();a.currentTime=0;}document.querySelector('.cursor').style.cssText='animation:none;opacity:1';});await page.screenshot({path:path.join(out,`${width}-${name}.png`)});};
  await capture('boot');await page.locator('#jack-in').click();await page.mouse.move(0,0);
  for(const ms of [7300,8600,9400,10400,12000,15300,15320,16320,17900])await step(ms);
  await capture('profile');await page.locator('#prompt').scrollIntoViewIfNeeded();await page.mouse.move(0,0);await page.evaluate(()=>document.activeElement.blur());await capture('shell');
  await page.locator('#all-projects').click();await page.mouse.move(0,0);await page.locator('#projects').scrollIntoViewIfNeeded();await page.evaluate(()=>document.activeElement.blur());await capture('archive');
  console.log(label,width,await page.evaluate(()=>({phase:__openingDebug.phase,fallback:__openingDebug.fallback,overflow:document.documentElement.scrollWidth>innerWidth})));await context.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>browser?.close());
