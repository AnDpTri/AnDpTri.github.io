const {chromium}=require('playwright');
const fs=require('node:fs');const path=require('node:path');
const label=process.argv[2]||'baseline',port=process.argv[3]||4181;
const out=path.join(__dirname,label,'frames');fs.mkdirSync(out,{recursive:true});
let browser;
(async()=>{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
 for(const [width,height] of [[1440,900],[390,844]]){
  const context=await browser.newContext({viewport:{width,height},serviceWorkers:'block'});const page=await context.newPage();const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
  await page.addInitScript(()=>{
   const NativeDate=Date,fixed=Date.UTC(2026,9,26,12);window.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[fixed]));}static now(){return fixed;}};
   let seed=123456;Math.random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};
   let now=1000,id=0;const frames=new Map();performance.now=()=>now;
   window.requestAnimationFrame=fn=>{frames.set(++id,fn);return id;};window.cancelAnimationFrame=id=>frames.delete(id);
   window.advance=ms=>{now=1000+ms;const batch=[...frames.values()];frames.clear();batch.forEach(fn=>fn(now));};
  });
  await page.goto(`http://localhost:${port}/`);await page.waitForFunction(()=>window.__openingDebug?.loaded===1,null,{polling:50});await page.evaluate(()=>document.fonts.ready);
  const step=async ms=>{await page.evaluate(ms=>advance(ms),ms);await page.waitForTimeout(250);};
  const capture=async name=>{await page.evaluate(()=>{for(const a of document.getAnimations()){a.pause();a.currentTime=0;}});await page.screenshot({path:path.join(out,`${width}-${name}.png`)});};
  await capture('boot');await page.locator('#jack-in').click();await page.mouse.move(0,0);await step(7300);await capture('panic');await step(8600);await step(9400);await step(10400);await step(12000);await capture('no-signal');await step(15300);await step(15320);await step(16320);await capture('mid-tear');await step(17900);await capture('profile');
  console.log(label,width,await page.evaluate(()=>({phase:__openingDebug.phase,fallback:__openingDebug.fallback,overflow:document.documentElement.scrollWidth>innerWidth})));await context.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();});
