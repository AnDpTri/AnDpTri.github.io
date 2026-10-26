const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
let browser;
(async()=>{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-unsafe-swiftshader']});
 const results=[];
 for(const test of ['skip-before-fonts','resize-during-bounce','webgl-fallback','no-javascript']){
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',javaScriptEnabled:test!=='no-javascript'}),page=await context.newPage(),cdp=await context.newCDPSession(page),errors=[];let renderer=null;
  await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  if(test==='skip-before-fonts')await page.route('**/font-*.woff2',async route=>{await new Promise(resolve=>setTimeout(resolve,700));await route.continue();});
  if(test==='webgl-fallback')await page.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl'?null:get.call(this,type,...args);};});
  await page.addInitScript(()=>{
   let now=1000,id=0;const frames=new Map();performance.now=()=>now;
   requestAnimationFrame=fn=>{frames.set(++id,fn);return id;};cancelAnimationFrame=id=>frames.delete(id);
   window.advance=ms=>{now=1000+ms;const batch=[...frames.values()];frames.clear();batch.forEach(fn=>fn(now));};
  });
  await page.goto('http://localhost:4181/',{waitUntil:'domcontentloaded'});
  const step=async ms=>{await page.evaluate(ms=>advance(ms),ms);await page.waitForTimeout(150);};
  if(test==='no-javascript'){
   await page.waitForLoadState('load');await page.evaluate(()=>document.fonts.ready);
   assert(await page.locator('#name').isVisible());assert.equal(await page.locator('#opening').isVisible(),false);
   assert(await page.evaluate(()=>document.fonts.check("italic 900 34px 'Be Vietnam Pro'",'Đặng Hoàng An')&&document.fonts.check("13px 'IBM Plex Mono'",'Đặng Hoàng An')));
  }else{
   await page.waitForSelector('#jack-in');
   if(test==='skip-before-fonts'){
    assert((await page.evaluate(()=>__openingDebug.loaded))<1);await page.keyboard.press('Escape');
    await page.waitForFunction(()=>__openingDebug.loaded===1,null,{polling:25});
    for(const ms of [0,500,1000,1500,2000,3000,4000])await step(ms);
   }else{
    if(test==='webgl-fallback')await page.waitForFunction(()=>__openingDebug.fallback==='WebGL unavailable',null,{polling:25});
    else {await page.waitForFunction(()=>__openingDebug.loaded===1,null,{polling:25});renderer=await page.evaluate(()=>{const gl=document.querySelector('#intro-canvas').getContext('webgl'),ext=gl.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);});}
    await page.locator('#jack-in').click();await page.mouse.move(0,0);
    for(const ms of [7300,8600,9400,10400,12000])await step(ms);
    if(test==='resize-during-bounce'){
     for(const [width,height,time] of [[900,700,12500],[390,844,13000]]){
      await page.setViewportSize({width,height});await page.waitForTimeout(200);await step(time);
      const bounds=await page.locator('#signal-card p').boundingBox();assert(bounds.x>=-.01&&bounds.y>=-.01&&bounds.x+bounds.width<=width+.01&&bounds.y+bounds.height<=height+.01);
     }
    }
    for(const ms of [15300,15320,16320,17900])await step(ms);
   }
   assert(await page.locator('#opening').evaluate(el=>el.hidden));assert.equal(await page.locator('#page').evaluate(el=>el.inert),false);
   if(test!=='webgl-fallback')assert.equal(await page.evaluate(()=>__openingDebug.fallback),null);
  }
  assert.deepEqual(errors,[]);results.push({test,pass:true,...(renderer?{renderer}:{})});console.log('PASS',test,renderer??'');await context.close();
 }
 fs.writeFileSync(path.join(__dirname,'edge-cases.json'),JSON.stringify(results,null,2));
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();});
