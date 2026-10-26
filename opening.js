import {MonochromeSignal} from './signal.js';

// Shared by the live visuals and the offline audio preview (seconds after connect).
export const CONNECTION_BEATS=Object.freeze([
 {at:0,phase:'calm'}, {at:2.3,phase:'unease'}, {at:4.2,phase:'alarm'},
 {at:6.6,phase:'panic'}, {at:8.7,phase:'collapse'}, {at:9.9,phase:'blackout'},
 {at:10.35,phase:'no-signal'}, {at:15.3,phase:'reacquire'},
 {at:17.3,phase:'settle'}, {at:17.8,phase:'complete'}
]);
const $=s=>document.querySelector(s);
const dataURL=blob=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(blob);});
const imageFrom=async src=>{const image=new Image();image.src=src;await image.decode();return image;};
async function resource(url){const r=await fetch(url);if(!r.ok)throw Error(`Connection resource: ${r.status}`);return r;}

// Render the existing DOM, with its existing stylesheet and fonts, into the tear.
// No imitation profile, changed content or delayed entrance is involved.
async function photographProfile(css,fonts,opening=false){
 const width=innerWidth,height=innerHeight;
 const root=document.createElement('div');root.setAttribute('xmlns','http://www.w3.org/1999/xhtml');
 root.className=opening?'snapshot intro-active':'snapshot';
 root.style.cssText=`width:${width}px;height:${height}px;overflow:hidden;background:#0a0a0a;color:#eeeeea;font:16px/1.65 'IBM Plex Mono',monospace;--bg:#0a0a0a;--panel:#101010;--ink:#eeeeea;--muted:#a5a5a1;--line:#363636`;
 const style=document.createElement('style');style.textContent=css.replaceAll('body:after','.snapshot:after').replaceAll('body:before','.snapshot:before')+fonts+' #page{width:100%}';root.append(style);
 if(opening){
  const live=$('#opening'),clone=live.cloneNode(true),surfaces=[...live.querySelectorAll('canvas')];
  clone.querySelectorAll('canvas').forEach((copy,i)=>{
   const surface=surfaces[i];
   if(surface.hidden||getComputedStyle(surface).visibility==='hidden'||!surface.width||!surface.height){copy.remove();return;}
   const image=document.createElement('img');
   for(const {name,value} of copy.attributes)image.setAttribute(name,value);
   image.src=surface.toDataURL();copy.replaceWith(image);
  });root.append(clone);
  // The skip/sound controls live outside #opening: photograph them too so the tear carries them away.
  root.append($('#hud').cloneNode(true));
 }
 else{root.append($('#page').cloneNode(true),$('#hud').cloneNode(true));root.querySelector('#skip-opening').hidden=true;}
 const xml=new XMLSerializer().serializeToString(root);
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject width="100%" height="100%">${xml}</foreignObject></svg>`;
 const image=await imageFrom('data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg));
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
 // Forces a security check here, so unsupported SVG capture takes the safe fallback.
 ctx.getImageData(0,0,1,1);return canvas;
}
function visitor(){
 const ua=navigator.userAgent;
 const browser=[/EdgA?\/[\d.]+/,/Firefox\/[\d.]+/,/CriOS\/[\d.]+/,/Chrome\/[\d.]+/,/Version\/[\d.]+/].map(pattern=>ua.match(pattern)?.[0]).find(Boolean)??'browser unidentified';
 const os=/Windows NT/.test(ua)?'Windows':/Android/.test(ua)?'Android':/iPhone|iPad/.test(ua)?'iOS':/Mac OS/.test(ua)?'macOS':/Linux/.test(ua)?'Linux':'OS unidentified';
 return {browser,os,zone:Intl.DateTimeFormat().resolvedOptions().timeZone,viewport:`${innerWidth} × ${innerHeight}`,time:new Date().toLocaleTimeString('en-GB',{hour12:false})};
}
export class Opening{
 constructor({score,cue,updateSound,mainReady,activeClock,reduced}){Object.assign(this,{score,cue,updateSound,mainReady,activeClock,reduced});}
 setPhase(phase){
  if(this.phase===phase)return;
  this.phase=phase;$('#opening').dataset.phase=phase;this.score.phase(phase);this.cue(phase,{localTime:this.elapsed,targetTime:CONNECTION_BEATS.find(b=>b.phase===phase)?.at});this.updateSound();
  const words={calm:'Connecting to An’s personal file.',alarm:'Connection anomaly.',panic:'Connection lost.', 'no-signal':'No signal. Reconnecting.',complete:'Personal file ready.'};
  if(words[phase])$('#opening-announcement').textContent=words[phase];
 }
 async prepare(){
  let done=0;const total=7;
  const track=async task=>{const result=await task;done++;this.loaded=done/total;return result;};
  const css=track(Promise.all(['style.css','opening.css'].map(url=>resource(url).then(r=>r.text()))).then(s=>s.join('\n')));
  const font=track(resource('assets/fonts/font-3.woff2').then(r=>r.blob()).then(dataURL));
  const display=track(resource('assets/fonts/font-0.woff2').then(r=>r.blob()).then(dataURL));
  const map=track(Promise.race([imageFrom('eyecatch/assets/signal-map.png'),this.skipReady.then(()=>{
   const canvas=document.createElement('canvas');canvas.width=canvas.height=1;
   const ctx=canvas.getContext('2d');ctx.fillStyle='rgb(128,0,0)';ctx.fillRect(0,0,1,1);return canvas;
  })]));
  const ready=track(Promise.race([this.mainReady,this.skipReady]));
  const [styles,mono,sans,measured]=await Promise.all([css,font,display,map,ready]);
  const fonts=`@font-face{font-family:'IBM Plex Mono';font-weight:400;src:url('${mono}')}@font-face{font-family:'Be Vietnam Pro';font-weight:900;font-style:italic;src:url('${sans}')}`; // taste-skill-ignore: embeds the unchanged profile's actual font bytes into its capture.
  this.capture=()=>photographProfile(styles,fonts);
  this.capturePanic=()=>photographProfile(styles,fonts,true);
  this.picture=await track(this.capture());
  if(!this.reduced.matches){
   try{this.signal=new MonochromeSignal($('#intro-canvas'),measured);this.signal.setPicture(this.picture);this.fallback=null;}
   catch(error){this.fallback=error.message;this.signal?.destroy();this.signal=null;}
  }
  await track(Promise.resolve());
 }
 async connect(){
  $('#jack-in').hidden=false;
  return new Promise(resolve=>{
   const finish=event=>{
    if(event?.type==='keydown'&&(event.repeat||event.isComposing||['Tab','Shift','Control','Alt','Meta'].includes(event.key)))return;
    // The sound toggle has its own gesture, never starts the timeline accidentally.
    if(event?.target?.closest?.('#sound-toggle,#skip-opening'))return;
    clearTimeout(timer);removeEventListener('pointerdown',finish);removeEventListener('keydown',finish);$('#jack-in').hidden=true;this.finishConnect=null;
    if(event&&this.score.enabled)void this.score.unlock().then(this.updateSound);
    this.cue(event?'jack-in':'silent-timeout');resolve();
   };
   const timer=setTimeout(()=>finish(),6000);addEventListener('pointerdown',finish);addEventListener('keydown',finish);
   this.finishConnect=()=>finish({type:'skip'});
  });
 }
 renderText(t){
  const v=this.visitor,title=$('#boot-title'),status=$('#boot-status'),log=$('#system-log');
  v.time=new Date().toLocaleTimeString('en-GB',{hour12:false});
  const put=(text,detail,lines)=>{if(title.dataset.copy!==text){title.textContent=text;title.dataset.copy=text;}status.textContent=detail;log.textContent=lines;};
  if(this.phase==='calm'){
   put('Link established.', 'Opening An’s personal file.',`archive.mount / personal_file.enc\nread-only session requested\n${t>1.1?'guest channel ready':'waiting for handshake_'}`);
   if(!title.querySelector('.boot-cursor')){const cursor=document.createElement('span');cursor.className='boot-cursor';cursor.textContent='_';cursor.setAttribute('aria-hidden','true');title.append(cursor);}
  }
  if(this.phase==='unease')put(t<3.25?'Link established_':'Link established.','I already opened this connection.',`session.accept / guest\nsession.accept / guest\n${t>3.3?'EALREADY: handshake has no matching request':''}`);
  const context=`peer.agent = ${v.browser}\npeer.kernel = ${v.os}\npeer.zone = ${v.zone}\npeer.clock = ${v.time}\nframebuffer = ${v.viewport}`;
  if(this.phase==='alarm'){
   const lines=['[EACCES] archive.guard: guest → owner denied','[EILSEQ] personal_file.enc: checksum mismatch','[EPERM] session/guest: exec mapping rejected','[EFAULT] display.sync: invalid read @ 0x0000ff30','[EIO] vblank: missed interrupt; retry pending','[EACCES] archive.guard: guest → owner denied'];
   const count=Math.min(6,1+Math.floor((t-4.2)*3));
   put('Who are you?',`Your ${v.os} session was not in the guest table.`,context+'\n'+lines.slice(0,count).join('\n'));
   if(!this.reduced.matches)log.style.transform=`translateX(${Math.sin(t*83)*Math.max(0,t-5)*1.5}px)`;
  }
  if(this.phase==='panic'){
   const p=t-6.6;
   put('STOP!','Terminate this session.',context+`\n[EFAULT] display.sync: H_SYNC / unlock\n[ETIMEDOUT] archive.guard: no response\n${this.input??'stdin: HALT INPUT'}\n${p>1?'display.sync: KEEP CHANNEL OPEN':''}`);
   if(!this.reduced.matches){const j=Math.sin(t*73)*Math.min(7,p*4);$('#boot').style.transform=`translate(${j}px,${Math.sin(t*31)*2}px)`;log.style.transform=`translateX(${Math.sin(t*109)*5}px)`;log.style.textShadow=Math.floor(t*12)%4===0?'5px 0 currentColor, 13px 0 #ff777750':'none';}
  }
 }
 renderSignal(t){
  const card=$('#signal-card'),text=card.querySelector('p');
  const bounds=text.getBoundingClientRect();
  const width=Math.max(0,card.clientWidth-bounds.width),height=Math.max(0,card.clientHeight-bounds.height);
  // Same rigid wall reflection as eyecatch/effect.js, at 330 CSS px/s.
  // Keep its final measured slope (349.6200 : 166.5751), with no easing or squash.
  const speed=330/Math.hypot(349.6200,166.5751);
  const fold=(position,limit)=>{
   if(!limit)return 0;
   const m=((position%(2*limit))+2*limit)%(2*limit);
   return m>limit?2*limit-m:m;
  };
  const elapsed=Math.max(0,t-10.35);
  // Randomize the starting position and direction once per connection, not per frame.
  const start=this.signalStart;
  const x=this.reduced.matches?width/2:fold(width*start.x+elapsed*349.6200*speed*start.dx,width);
  const y=this.reduced.matches?height/2:fold(height*start.y+elapsed*166.5751*speed*start.dy,height);
  text.style.transform=`translate(${x}px,${y}px)`;
 }
 renderCollapse(t){
  const p=(t-8.7)/1.2,boot=$('#boot');
  if(this.reduced.matches){boot.hidden=true;return;}
  if(p<.48){
   const roll=Math.floor(p*15)%3;boot.style.transform=`translate(${Math.sin(p*171)*24}px,${roll*28-18}vh) scaleX(${1+Math.sin(p*57)*.08})`;boot.style.opacity=String(.45+.55*Math.abs(Math.sin(p*29)));
  }else{
   boot.hidden=true;const canvas=this.collapseCanvas,ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
   canvas.hidden=false;ctx.clearRect(0,0,w,h);ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);
   // The last picture squeezes to a horizontal line, then a dot. No shards.
   const squeeze=Math.max(0,1-(p-.48)/.23),height=Math.max(2,h*squeeze*squeeze);
   const width=p<.76?w:p<.98?Math.max(3,w*Math.max(0,1-(p-.76)/.14)**2):0;
   if(width>0){ctx.drawImage(this.lastPicture,(w-width)/2,(h-height)/2,width,height);ctx.fillStyle='#eee';ctx.fillRect((w-width)/2,h/2,Math.max(2,width),p<.76?2:3);}
  }
 }
 async run(){
  const opening=$('#opening'),boot=$('#boot'),card=$('#signal-card');
  // A lost WebGL context cannot be reused by getContext() on the same canvas.
  // Give each replay a fresh surface after releasing the preceding GPU resources.
  const previous=$('#intro-canvas'),canvas=previous.cloneNode(false);previous.replaceWith(canvas);
  this.phase=null;this.elapsed=0;this.loaded=0;this.input=null;this.signal=null;this.lastPicture=null;this.visitor=visitor();this.prepared=false;this.reacquiredAt=null;this.panicCaptured=false;this.burst=false;this.fallback=null;
  this.signalStart={x:Math.random(),y:Math.random(),dx:Math.random()<.5?-1:1,dy:Math.random()<.5?-1:1};
  this.signalCapturing=false;this.signalCaptured=false;this.signalFrozenAt=null;this.lastSignalAt=null;
  this.capture=null;this.capturePanic=null;this.skipRequested=false;this.skipStarted=false;this.skipCaptured=false;this.skipSource=null;
  this.skipReady=new Promise(resolve=>{this.resolveSkip=resolve;});
  const skipButton=$('#skip-opening');skipButton.hidden=false;skipButton.disabled=false;skipButton.style.visibility='';
  const skip=()=>{
   if(this.skipRequested||this.phase==='complete')return;
   this.skipRequested=true;skipButton.disabled=true;this.resolveSkip();
   // Serialize the current DOM and visible canvas surfaces at the click itself.
   if(this.capturePanic)this.skipSource=this.capturePanic().catch(()=>null);
   if(this.score.enabled)void this.score.unlock().then(this.updateSound);
   this.finishConnect?.();
  };
  skipButton.addEventListener('click',skip);
  opening.hidden=false;$('#page').inert=true;document.body.classList.add('intro-active');scrollTo({top:0,behavior:'instant'});
  boot.hidden=false;boot.style.cssText='';$('#system-log').style.cssText='';card.hidden=true;canvas.style.visibility='hidden';
  this.setPhase('calm');this.renderText(0);
  const preparation=this.prepare().catch(async error=>{this.fallback=error.message;await this.mainReady;}).then(()=>{this.prepared=true;});
  const pointer=event=>{if(this.phase==='panic')this.input=`input.pointer: ${Math.round(event.clientX)},${Math.round(event.clientY)} / permission denied`;};
  const key=event=>{if(this.phase==='panic')this.input=`input.interrupt: ${event.key.length===1?'printable key':event.key} / trap rejected`;};
  addEventListener('pointermove',pointer);addEventListener('pointerdown',pointer);addEventListener('keydown',key);
  try{
   await this.connect();const started=this.activeClock();let lastError=-1,collapsed=false;
   this.collapseCanvas=document.createElement('canvas');this.collapseCanvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;z-index:4';this.collapseCanvas.hidden=true;opening.append(this.collapseCanvas);
   const resize=()=>{this.visitor.viewport=`${innerWidth} × ${innerHeight}`;if(this.capture&&this.prepared){this.prepared=false;this.capture().then(picture=>{this.picture=picture;this.signal?.setPicture(picture);}).catch(error=>{this.fallback=error.message;this.signal?.destroy();this.signal=null;}).finally(()=>{this.prepared=true;});}};addEventListener('resize',resize);
   try{
    await new Promise((resolve,reject)=>{
     const draw=()=>{
      try{
       const t=this.elapsed=(this.activeClock()-started)/1000;
       if(this.reacquiredAt!==null)skipButton.style.visibility='hidden';
       if(this.skipRequested){
        if(!this.prepared){this.frame=requestAnimationFrame(draw);return;}
        if(!this.skipStarted){
         this.skipStarted=true;this.reacquiredAt=null;this.burst=false;
         if(this.signal&&!this.reduced.matches){
          void (this.skipSource??this.capturePanic()).then(picture=>{if(!picture)throw Error('Opening capture unavailable');this.signal?.setSource(picture);}).catch(error=>{this.fallback=error.message;this.signal?.destroy();this.signal=null;}).finally(()=>{this.skipCaptured=true;});
         }else this.skipCaptured=true;
        }
        if(!this.skipCaptured){this.frame=requestAnimationFrame(draw);return;}
        this.reacquiredAt??=this.signal&&!this.reduced.matches?t:t-2.5;
       }
       // Real loading gates reacquisition, but never abbreviates the narrative.
       const beat=[...CONNECTION_BEATS].reverse().find(b=>t>=b.at);
       if(!this.skipRequested&&t>=15.3&&this.prepared&&this.reacquiredAt===null){
        if(this.signal&&!this.reduced.matches){
         // Freeze and photograph the actual last NO SIGNAL frame before tearing it.
         if(!this.signalCapturing){
          this.signalCapturing=true;this.signalFrozenAt=this.lastSignalAt??t;
          void this.capturePanic().then(picture=>{this.signal?.setSource(picture);}).catch(error=>{this.fallback=error.message;this.signal?.destroy();this.signal=null;}).finally(()=>{this.signalCaptured=true;});
         }
         if(this.signalCaptured)this.reacquiredAt=t;
        }else this.reacquiredAt=t;
       }
       const since=this.reacquiredAt===null?null:t-this.reacquiredAt;
       const next=!this.skipRequested&&t<15.3?beat.phase:since===null?'no-signal':since<2?'reacquire':since<2.5?'settle':'complete';
       this.setPhase(next);
       if(['calm','unease','alarm','panic'].includes(this.phase))this.renderText(t);
       if(['alarm','panic'].includes(this.phase)){
        this.score.intensity=Math.min(1,(t-4.2)/4.5);const slot=Math.floor(t*(this.phase==='panic'?7:3));
        if(slot!==lastError){lastError=slot;this.cue('error-burst');}
       }
       if(!this.skipRequested&&t>8.55&&!this.panicCaptured&&this.capturePanic){this.panicCaptured=true;void this.capturePanic().then(picture=>{this.lastPicture=picture;}).catch(()=>{});}
       if(this.phase==='collapse'){
        if(!collapsed){collapsed=true;this.lastPicture??=this.picture??document.createElement('canvas');this.collapseCanvas.width=innerWidth;this.collapseCanvas.height=innerHeight;}
        this.renderCollapse(t);
       }
       if(['blackout','no-signal','reacquire','settle','complete'].includes(this.phase)){boot.hidden=true;this.collapseCanvas.hidden=true;}
       card.hidden=!(this.phase==='no-signal'||(['reacquire','settle'].includes(this.phase)&&(!this.signal||this.reduced.matches)));
       if(!card.hidden){this.lastSignalAt=this.signalFrozenAt??t;this.renderSignal(this.lastSignalAt);}
       if(this.phase==='reacquire'||this.phase==='settle'){
        const p=Math.min(1,(t-this.reacquiredAt)/2);
        if(p>=.16&&!this.burst){this.burst=true;this.cue('tear-burst',{localTime:t,targetTime:this.reacquiredAt+.32});}
        if(this.signal&&!this.reduced.matches){canvas.style.visibility='visible';this.signal.render(p);}
        // Static fallback reveals the same finished DOM without fabricated loading.
       }
       if(this.phase==='complete'){resolve();return;}
       this.frame=requestAnimationFrame(draw);
      }catch(error){reject(error);}
     };this.frame=requestAnimationFrame(draw);
    });
   }finally{removeEventListener('resize',resize);}
  }finally{
   cancelAnimationFrame(this.frame);removeEventListener('pointermove',pointer);removeEventListener('pointerdown',pointer);removeEventListener('keydown',key);
   skipButton.removeEventListener('click',skip);skipButton.hidden=true;skipButton.disabled=false;
   this.collapseCanvas?.remove();this.signal?.destroy();canvas.style.visibility='hidden';this.prepared=false;this.reacquiredAt=null;
  }
  void preparation;
 }
}

// Esc skips the opening from the keyboard too.
addEventListener('keydown',e=>{if(e.key==='Escape'){const b=document.querySelector('#skip-opening');if(b&&!b.hidden&&!b.disabled)b.click();}});
