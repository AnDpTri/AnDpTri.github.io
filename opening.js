import {MonochromeSignal} from './signal.js';
import {fontAssets} from './assets/fonts/load.js';

// Shared by the live visuals and the offline audio preview (seconds after connect).
export const CONNECTION_BEATS=Object.freeze([
 {at:0,phase:'calm'}, {at:1.6,phase:'unease'}, {at:3.0,phase:'alarm'},
 {at:4.6,phase:'panic'}, {at:6.4,phase:'collapse'}, {at:7.5,phase:'blackout'},
 {at:7.9,phase:'no-signal'}, {at:11.0,phase:'reacquire'},
 {at:12.5,phase:'settle'}, {at:13.0,phase:'complete'}
]);
export const CONNECTION_TIME=Object.freeze(Object.fromEntries(CONNECTION_BEATS.map(({at,phase})=>[phase,at])));
export const CONNECTION_TEAR=Object.freeze({duration:CONNECTION_TIME.settle-CONNECTION_TIME.reacquire,total:CONNECTION_TIME.complete-CONNECTION_TIME.reacquire,burst:.16});
const $=s=>document.querySelector(s);
const clockFormat=new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
const imageFrom=async src=>{const image=new Image();image.src=src;await image.decode();return image;};
function snapshotStyles(){
 // CSSOM is already parsed and available, even when HTTP caching is disabled.
 return [...document.styleSheets].filter(sheet=>sheet.href&&['style.css','opening.css'].includes(new URL(sheet.href).pathname.split('/').pop()))
  .flatMap(sheet=>[...sheet.cssRules].map(rule=>rule.cssText)).join('\n');
}

// Render the existing DOM, with its existing stylesheet and fonts, into the tear.
// No imitation profile, changed content or delayed entrance is involved.
async function photographProfile(css,fonts,opening=false){
 const width=innerWidth,height=innerHeight;
 const root=document.createElement('div');root.setAttribute('xmlns','http://www.w3.org/1999/xhtml');
 root.className=opening?'snapshot intro-active':'snapshot';
 root.style.cssText=`width:${width}px;height:${height}px;overflow:hidden;background:#0a0a0a;color:#eeeeea;font:16px/1.65 'IBM Plex Mono',monospace;--bg:#0a0a0a;--panel:#101010;--ink:#eeeeea;--muted:#a5a5a1;--line:#363636`;
 const style=document.createElement('style');style.textContent=css.replace(/body::?(before|after)/g,'.snapshot::$1')+fonts+' #page{width:100%}';root.append(style);
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
  let done=0;const total=6;
  const track=async task=>{const result=await task;done++;this.loaded=done/total;return result;};
  const css=track(Promise.resolve(snapshotStyles()));
  const font=track(fontAssets);
  const map=track(Promise.race([imageFrom('eyecatch/assets/signal-map.png'),this.skipReady.then(()=>{
   const canvas=document.createElement('canvas');canvas.width=canvas.height=1;
   const ctx=canvas.getContext('2d');ctx.fillStyle='rgb(128,0,0)';ctx.fillRect(0,0,1,1);return canvas;
  })]));
  const ready=track(this.mainReady);
  const [styles,fonts,measured]=await Promise.all([css,font,map,ready]);
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
    if(this.returning&&event&&event.type!=='skip'){
     if(event.type==='keydown'&&!['Enter',' ','Escape'].includes(event.key))return;
     event.preventDefault();event.stopImmediatePropagation();this.skipNow?.();return;
    }
    // The sound toggle has its own gesture, never starts the timeline accidentally.
    if(event?.target?.closest?.('#sound-toggle,#skip-opening'))return;
    this.disconnect();$('#jack-in').hidden=true;this.finishConnect=null;
    if(event&&this.score.enabled)void this.score.unlock().then(this.updateSound);
    this.cue(event?'jack-in':'silent-timeout');resolve();
   };
   // Capture return clicks so SND/skip also perform the same single skip gesture.
   const pointerEvent=this.returning?'click':'pointerdown';
   const timer=this.returning?null:setTimeout(()=>finish(),6000);
   this.disconnect=()=>{clearTimeout(timer);removeEventListener(pointerEvent,finish,true);removeEventListener('keydown',finish,true);};
   addEventListener(pointerEvent,finish,true);addEventListener('keydown',finish,true);
   this.finishConnect=()=>finish({type:'skip'});
  });
 }
 renderText(t){
  const v=this.visitor,{title,status,log,boot}=this.dom;
  const second=Math.floor(Date.now()/1000);
  if(v.second!==second){v.second=second;v.time=clockFormat.format(new Date());}
  const put=(text,detail,lines)=>{if(title.dataset.copy!==text){title.textContent=text;title.dataset.copy=text;}if(status.textContent!==detail)status.textContent=detail;if(log.textContent!==lines)log.textContent=lines;};
  if(this.phase==='calm'){
   put('Link established.', 'Opening An’s personal file.',`archive.mount / personal_file.enc\nread-only session requested\n${t>1.1?'guest channel ready':'waiting for handshake_'}`);
   if(!title.querySelector('.boot-cursor')){const cursor=document.createElement('span');cursor.className='boot-cursor';cursor.textContent='_';cursor.setAttribute('aria-hidden','true');title.append(cursor);}
  }
  if(this.phase==='unease'){
   const p=(t-CONNECTION_TIME.unease)/(CONNECTION_TIME.alarm-CONNECTION_TIME.unease);
   put(p<.5?'Link established_':'Link established.','I already opened this connection.',`session.accept / guest\nsession.accept / guest\n${p>.53?'EALREADY: handshake has no matching request':''}`);
  }
  const context=`peer.agent = ${v.browser}\npeer.kernel = ${v.os}\npeer.zone = ${v.zone}\npeer.clock = ${v.time}\nframebuffer = ${v.viewport}`;
  if(this.phase==='alarm'){
   const lines=['[EACCES] archive.guard: guest → owner denied','[EILSEQ] personal_file.enc: checksum mismatch','[EPERM] session/guest: exec mapping rejected','[EFAULT] display.sync: invalid read @ 0x0000ff30','[EIO] vblank: missed interrupt; retry pending','[EACCES] archive.guard: guest → owner denied'];
   const p=(t-CONNECTION_TIME.alarm)/(CONNECTION_TIME.panic-CONNECTION_TIME.alarm),count=Math.min(6,1+Math.floor(p*6));
   put('Who are you?',`Your ${v.os} session was not in the guest table.`,context+'\n'+lines.slice(0,count).join('\n'));
   if(!this.reduced.matches)log.style.transform=`translateX(${Math.sin(t*83)*Math.max(0,p-.33)*3.6}px)`;
  }
  if(this.phase==='panic'){
   const p=(t-CONNECTION_TIME.panic)/(CONNECTION_TIME.collapse-CONNECTION_TIME.panic);
   put('STOP!','Terminate this session.',context+`\n[EFAULT] display.sync: H_SYNC / unlock\n[ETIMEDOUT] archive.guard: no response\n${this.input??'stdin: HALT INPUT'}\n${p>.48?'display.sync: KEEP CHANNEL OPEN':''}`);
   if(!this.reduced.matches){const j=Math.sin(t*73)*Math.min(7,2+p*6);boot.style.transform=`translate(${j}px,${Math.sin(t*31)*2}px)`;log.style.transform=`translateX(${Math.sin(t*109)*5}px)`;log.style.textShadow=Math.floor(t*12)%4===0?'5px 0 currentColor, 13px 0 #ff777750':'none';}
  }
 }
 renderSignal(t){
  const {card,text}=this.dom;
  if(!this.signalBounds){
   const bounds=text.getBoundingClientRect();
   this.signalBounds={width:Math.max(0,card.clientWidth-bounds.width),height:Math.max(0,card.clientHeight-bounds.height)};
  }
  const {width,height}=this.signalBounds;
  // Same rigid wall reflection as eyecatch/effect.js, at 330 CSS px/s.
  // Keep its final measured slope (349.6200 : 166.5751), with no easing or squash.
  const speed=330/Math.hypot(349.6200,166.5751);
  const fold=(position,limit)=>{
   if(!limit)return 0;
   const m=((position%(2*limit))+2*limit)%(2*limit);
   return m>limit?2*limit-m:m;
  };
  const elapsed=Math.max(0,t-CONNECTION_TIME['no-signal']);
  // Randomize the starting position and direction once per connection, not per frame.
  const start=this.signalStart;
  const x=this.reduced.matches?width/2:fold(width*start.x+elapsed*349.6200*speed*start.dx,width);
  const y=this.reduced.matches?height/2:fold(height*start.y+elapsed*166.5751*speed*start.dy,height);
  text.style.transform=`translate(${x}px,${y}px)`;
 }
 renderCollapse(t){
  const p=(t-CONNECTION_TIME.collapse)/(CONNECTION_TIME.blackout-CONNECTION_TIME.collapse),boot=$('#boot');
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
 async run({returning=false}={}){
  this.returning=returning;
  const opening=$('#opening'),boot=$('#boot'),card=$('#signal-card');
  this.dom={boot,card,text:card.querySelector('p'),title:$('#boot-title'),status:$('#boot-status'),log:$('#system-log')};
  this.signalBounds=null;
  // A font becoming available or a viewport change invalidates the bounce extent.
  void fontAssets.then(()=>{this.signalBounds=null;},()=>{});
  // A lost WebGL context cannot be reused by getContext() on the same canvas.
  // Give each replay a fresh surface after releasing the preceding GPU resources.
  const previous=$('#intro-canvas'),canvas=previous.cloneNode(false);previous.replaceWith(canvas);
  this.phase=null;this.elapsed=0;this.loaded=0;this.input=null;this.signal=null;this.lastPicture=null;this.visitor=visitor();this.prepared=false;this.reacquiredAt=null;this.panicCaptured=false;this.burst=false;this.fallback=null;
  this.signalStart={x:Math.random(),y:Math.random(),dx:Math.random()<.5?-1:1,dy:Math.random()<.5?-1:1};
  this.signalCapturing=false;this.signalCaptured=false;this.signalFrozenAt=null;this.lastSignalAt=null;
  this.capture=null;this.capturePanic=null;this.skipRequested=false;this.skipStarted=false;this.skipCaptured=false;this.skipSource=null;
  this.skipReady=new Promise(resolve=>{this.resolveSkip=resolve;});
  const skipButton=$('#skip-opening');skipButton.hidden=false;skipButton.disabled=false;$('#opening-controls').style.visibility='';
  const skip=()=>{
   if(this.skipRequested||this.phase==='complete')return;
   this.skipRequested=true;skipButton.disabled=true;this.resolveSkip();
   // Serialize the current DOM and visible canvas surfaces at the click itself.
   if(this.capturePanic)this.skipSource=this.capturePanic().catch(()=>null);
   if(this.score.enabled)void this.score.unlock().then(this.updateSound);
   this.finishConnect?.();
  };
  this.skipNow=skip;skipButton.addEventListener('click',skip);
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
   const resize=()=>{this.signalBounds=null;this.visitor.viewport=`${innerWidth} × ${innerHeight}`;if(this.capture&&this.prepared){this.prepared=false;this.capture().then(picture=>{this.picture=picture;this.signal?.setPicture(picture);}).catch(error=>{this.fallback=error.message;this.signal?.destroy();this.signal=null;}).finally(()=>{this.prepared=true;});}};addEventListener('resize',resize);
   try{
    await new Promise((resolve,reject)=>{
     const draw=()=>{
      try{
       const t=this.elapsed=(this.activeClock()-started)/1000;
       // Skips keep their original direct-tear speed; the full narrative uses the new beats.
       const tearDuration=this.skipRequested?2:CONNECTION_TEAR.duration,transitionDuration=this.skipRequested?2.5:CONNECTION_TEAR.total;
       if(this.reacquiredAt!==null)$('#opening-controls').style.visibility='hidden';
       if(this.skipRequested){
        if(!this.prepared){this.frame=requestAnimationFrame(draw);return;}
        if(!this.skipStarted){
         this.skipStarted=true;this.reacquiredAt=null;this.burst=false;
         if(this.signal&&!this.reduced.matches){
          void (this.skipSource??this.capturePanic()).then(picture=>{if(!picture)throw Error('Opening capture unavailable');this.signal?.setSource(picture);}).catch(error=>{this.fallback=error.message;this.signal?.destroy();this.signal=null;}).finally(()=>{this.skipCaptured=true;});
         }else this.skipCaptured=true;
        }
        if(!this.skipCaptured){this.frame=requestAnimationFrame(draw);return;}
        this.reacquiredAt??=this.signal&&!this.reduced.matches?t:t-transitionDuration;
       }
       // Real loading gates reacquisition, but never abbreviates the narrative.
       let beat=CONNECTION_BEATS[0];for(const candidate of CONNECTION_BEATS){if(t<candidate.at)break;beat=candidate;}
       if(!this.skipRequested&&t>=CONNECTION_TIME.reacquire&&this.prepared&&this.reacquiredAt===null){
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
       const next=!this.skipRequested&&t<CONNECTION_TIME.reacquire?beat.phase:since===null?'no-signal':since<tearDuration?'reacquire':since<transitionDuration?'settle':'complete';
       this.setPhase(next);
       if(['calm','unease','alarm','panic'].includes(this.phase))this.renderText(t);
       if(['alarm','panic'].includes(this.phase)){
        this.score.intensity=Math.min(1,(t-CONNECTION_TIME.alarm)/(CONNECTION_TIME.collapse-CONNECTION_TIME.alarm));const slot=Math.floor(t*(this.phase==='panic'?7:3));
        if(slot!==lastError){lastError=slot;this.cue('error-burst',{localTime:t});}
       }
       if(!this.skipRequested&&t>CONNECTION_TIME.collapse-.15&&!this.panicCaptured&&this.capturePanic){this.panicCaptured=true;void this.capturePanic().then(picture=>{this.lastPicture=picture;}).catch(()=>{});}
       if(this.phase==='collapse'){
        if(!collapsed){collapsed=true;this.lastPicture??=this.picture??document.createElement('canvas');this.collapseCanvas.width=innerWidth;this.collapseCanvas.height=innerHeight;}
        this.renderCollapse(t);
       }
       if(['blackout','no-signal','reacquire','settle','complete'].includes(this.phase)){boot.hidden=true;this.collapseCanvas.hidden=true;}
       card.hidden=!(this.phase==='no-signal'||(['reacquire','settle'].includes(this.phase)&&(!this.signal||this.reduced.matches)));
       if(!card.hidden){this.lastSignalAt=this.signalFrozenAt??t;this.renderSignal(this.lastSignalAt);}
       if(this.phase==='reacquire'||this.phase==='settle'){
        const p=Math.min(1,(t-this.reacquiredAt)/tearDuration);
        if(p>=CONNECTION_TEAR.burst&&!this.burst){this.burst=true;this.cue('tear-burst',{localTime:t,targetTime:this.reacquiredAt+tearDuration*CONNECTION_TEAR.burst});}
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
   this.disconnect?.();this.disconnect=null;this.finishConnect=null;this.skipNow=null;
   cancelAnimationFrame(this.frame);removeEventListener('pointermove',pointer);removeEventListener('pointerdown',pointer);removeEventListener('keydown',key);
   skipButton.removeEventListener('click',skip);skipButton.hidden=true;skipButton.disabled=false;
   this.collapseCanvas?.remove();this.signal?.destroy();canvas.style.visibility='hidden';this.prepared=false;this.reacquiredAt=null;
   // Release the two full-viewport captures, their embedded data, and GPU wrapper.
   this.signal=null;this.picture=null;this.lastPicture=null;this.collapseCanvas=null;
   this.capture=null;this.capturePanic=null;this.skipSource=null;
  }
  void preparation;
 }
}

// Esc skips the opening from the keyboard too.
addEventListener('keydown',e=>{if(e.key==='Escape'){const b=document.querySelector('#skip-opening');if(b&&!b.hidden&&!b.disabled)b.click();}});
