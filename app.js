import {AudioScore} from './audio.js';
import {Opening} from './opening.js?v=1793018626';
import {fontAssets} from './assets/fonts/load.js';
const $ = selector => document.querySelector(selector);
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const lowPower = (navigator.hardwareConcurrency ?? Infinity)<=4 || (navigator.deviceMemory ?? Infinity)<=4;
const afterPaint = task => requestAnimationFrame(()=>setTimeout(task,0));
const opening = $('#opening'), page = $('#page');
const mainReady = Promise.all([fontAssets.catch(()=>{}), document.fonts.ready, new Promise(resolve => document.readyState === 'complete' ? resolve() : addEventListener('load', resolve, {once:true}))]).then(()=>new Promise(resolve=>{
  // The first colour-emoji fallback/raster was a 100–600ms command-time stall.
  // Warm the existing easter-egg glyph once, before the profile snapshot is ready.
  const warm=()=>{try{const canvas=document.createElement('canvas');canvas.width=canvas.height=32;const ctx=canvas.getContext('2d');ctx.font=getComputedStyle($('#prompt')).font;ctx.fillText('🏔️',0,24);ctx.getImageData(0,0,1,1);}catch{/* Optional warmup must never block the profile. */}resolve();};
  if('requestIdleCallback' in window)requestIdleCallback(warm,{timeout:500});else setTimeout(warm,0);
}));
const score=new AudioScore();
try{score.enabled=localStorage.getItem('thepeak.sound')!=='off';}catch{/* private storage */}
const soundButton=$('#sound-toggle');
function updateSound(){const on=score.enabled && score.context?.state==='running';soundButton.textContent=`[ SND: ${on?'ON':'OFF'} ]`;soundButton.setAttribute('aria-pressed',String(on));}
function cue(name,detail={}){dispatchEvent(new CustomEvent('portfolio:cue',{detail:{name,...detail}}));score.cue(name,detail);}
async function setSound(value){score.setEnabled(value);try{localStorage.setItem('thepeak.sound',value?'on':'off');}catch{/* private storage */}if(value){if(!score.context)await new Promise(resolve=>afterPaint(resolve));if(score.enabled)await score.unlock();}updateSound();}
soundButton.addEventListener('click',()=>{void setSound(!(score.enabled && score.context?.state==='running'));});
let hiddenAt=document.hidden?performance.now():null,hiddenTotal=0;
const activeClock=()=>performance.now()-hiddenTotal-(hiddenAt===null?0:performance.now()-hiddenAt);
document.addEventListener('visibilitychange',()=>{if(document.hidden)hiddenAt=performance.now();else if(hiddenAt!==null){hiddenTotal+=performance.now()-hiddenAt;hiddenAt=null;}void score.visibility(document.hidden).then(updateSound);});
// Read-only diagnostics for verification; no console spam in production.
window.__audioDebug={get state(){return score.context?.state??'locked';},get enabled(){return score.enabled;},get voices(){return score.voices.size;},timeline:score.timeline};
updateSound();
let finished=true, runId=0, replayPending=false;
const connection=new Opening({score,cue,updateSound,mainReady,activeClock,reduced});
window.__openingDebug={get phase(){return connection.phase;},get elapsed(){return connection.elapsed;},get loaded(){return connection.loaded;},get fallback(){return connection.fallback;},get webgl(){return !!connection.signal;}};
const SEEN_KEY='thepeak.seen';
const hasSeen=()=>{try{return localStorage.getItem(SEEN_KEY)==='1';}catch{return false;}};
async function runOpening({returning=false}={}){
  if(!finished)return;
  finished=false;runId++;
  syncAmbient();
  try{await connection.run({returning});}catch(error){connection.fallback=error.message;}finally{
    try{localStorage.setItem(SEEN_KEY,'1');}catch{/* private storage: behave as a first visit every time */}
    opening.hidden=true;page.inert=false;document.body.classList.remove('intro-active');document.querySelector('#opening-controls').style.visibility='';
    finished=true;if(connection.phase!=='complete'){score.phase('complete');cue('complete');}updateSound();
    replayPending=false;syncAmbient();
    $('#name').tabIndex=-1;$('#name').focus({preventScroll:true});
    if(location.hash){try{document.querySelector(location.hash)?.scrollIntoView();}catch{}}
  }
}

const commandHistory=$('#command-history'),prompt=$('#prompt');
const projectLinks=[...document.querySelectorAll('.project-row, .archive-row')];
const typedHistory=[];let historyIndex=0;
function showArchive(show){$('#archive').hidden=!show;$('#all-projects').setAttribute('aria-expanded',String(show));$('#all-projects').innerHTML=show?'--featured <span>(5)</span>':'--all <span>(+4)</span>';}
$('#all-projects').addEventListener('click',()=>showArchive($('#archive').hidden));
function navigateTo(id){$(id).scrollIntoView({behavior:reduced.matches?'instant':'smooth',block:'start'});}
function execute(raw){
  const input=raw.trim();if(!input)return;
  typedHistory.push(input);if(typedHistory.length>100)typedHistory.shift();historyIndex=typedHistory.length;
  const [command,...args]=input.toLowerCase().split(/\s+/);
  if(['intro','logout','lock'].includes(command)){
    if(!finished||replayPending)return;
    replayPending=true;commandHistory.replaceChildren();prompt.value='';cue('power-down');setTimeout(()=>void runOpening(),340);return;
  }
  if(command==='clear'){commandHistory.replaceChildren();return;}
  const entry=document.createElement('div');entry.className='history-entry';
  const echo=document.createElement('p');echo.className='echo';echo.textContent=`guest@thepeak:~$ ${input}`;entry.append(echo);
  const output=document.createElement('p');entry.append(output);
  switch(command){
    case 'help':output.textContent='whoami · projects [--all] · open <1–9> · contact\nclear · intro · logout / lock · thepeak\nsound on/off / mute\n↑ / ↓ command history. All commands run locally.';break;
    case 'sound':
      if(!['on','off'].includes(args[0]) || args.length!==1){output.textContent='usage: sound on/off';break;}
      void setSound(args[0]==='on');output.textContent=`sound ${args[0]}`;break;
    case 'mute':void setSound(!(score.enabled && score.context?.state==='running'));output.textContent='sound toggled';break;
    case 'whoami':output.textContent='Đặng Hoàng An / aka AnDpTri\nIntern · Student / Vietnam\nAlgorithm · Artificial Intelligence · Computer Vision';break;
    case 'projects':
      if(args.includes('--all'))showArchive(true);
      output.textContent=projectLinks.slice(0,args.includes('--all')?9:5).map((link,i)=>`${i+1}. ${link.querySelector('strong')?.textContent || link.firstElementChild.textContent.slice(5)}`).join('\n');
      break;
    case 'open':{
      const n=Number(args[0]);
      if(args.length!==1 || !Number.isInteger(n) || n<1 || n>projectLinks.length){output.textContent='usage: open <1–9>';break;}
      const link=projectLinks[n-1];
      const a=document.createElement('a');a.href=link.href;a.textContent=`Open ${link.querySelector('strong')?.textContent || link.firstElementChild.textContent.slice(5)}`;
      output.append(a);
      // This navigation is the direct result of the visitor's submitted command.
      // Paint the local response before Chrome starts the new browsing context.
      // Transient user activation survives this single frame (verified with real popups).
      afterPaint(()=>window.open(link.href,'_blank','noopener,noreferrer'));break;
    }
    case 'contact':{
      const email=document.createElement('a');email.href='mailto:andanghoang0@gmail.com';email.textContent='andanghoang0@gmail.com';
      const github=document.createElement('a');github.href='https://github.com/AnDpTri';github.textContent='github.com/AnDpTri';
      output.append(email,document.createTextNode('\n'),github);break;
    }
    case 'thepeak':output.textContent='This Peak is so awesome! 🏔️';break; // taste-skill-ignore: exact owner-requested mountain easter egg.
    case 'sudo':output.textContent='guest is not in the sudoers file. Nice try.';break;
    case 'hack':cue('terminal-tear');output.textContent='You’re already in. Try reading the file.';$('.terminal').classList.add('signal-glitch');setTimeout(()=>$('.terminal').classList.remove('signal-glitch'),220);break;
    default:cue('unknown-command');output.className='command-error';output.textContent=`${input.split(/\s+/)[0]}: command not found. Type help.`;
  }
  commandHistory.append(entry);
  while(commandHistory.children.length>30)commandHistory.firstElementChild.remove();
  commandHistory.scrollTop=commandHistory.scrollHeight;
}
$('#prompt-form').addEventListener('submit',event=>{event.preventDefault();execute(prompt.value);prompt.value='';});
const chips=$('.command-chips');
let pressedChip=null,pressRelease=null;
function releaseChip(immediate=false){clearTimeout(pressRelease);if(!pressedChip){pressRelease=null;return;}const release=()=>{pressedChip.classList.remove('is-pressed');pressedChip=null;pressRelease=null;};if(immediate)release();else pressRelease=setTimeout(release,120);}
chips.addEventListener('pointerdown',event=>{if(event.pointerType==='mouse')return;releaseChip(true);pressedChip=event.target.closest('[data-command]');pressedChip?.classList.add('is-pressed');});
chips.addEventListener('pointerup',()=>releaseChip());
chips.addEventListener('pointercancel',()=>releaseChip(true));
chips.addEventListener('click',event=>{const chip=event.target.closest('[data-command]');if(chip){execute(chip.dataset.command);if(finished)prompt.focus({preventScroll:true});}});
prompt.addEventListener('keydown',event=>{
  if(event.isComposing)return;
  if(event.key==='Escape'){prompt.value='';historyIndex=typedHistory.length;return;}
  if(!['ArrowUp','ArrowDown'].includes(event.key))return;
  event.preventDefault();historyIndex=Math.max(0,Math.min(typedHistory.length,historyIndex+(event.key==='ArrowUp'?-1:1)));
  prompt.value=typedHistory[historyIndex] || '';
});

const scrambles=new Map();
function stopScrambles(){for(const [el,{timer,text}] of scrambles){clearInterval(timer);el.textContent=text;delete el.dataset.busy;}scrambles.clear();}
function scramble(el){
  if(reduced.matches || el.dataset.busy)return;
  cue('hover');el.dataset.busy='true';const text=el.textContent;el.setAttribute('aria-label',text);let tick=0;
  const characters=[...text];
  const timer=setInterval(()=>{tick+=3;el.textContent=characters.map((c,i)=>i<tick || c===' '?c:'01▒░'[Math.floor(Math.random()*4)]).join('');if(tick>=characters.length){clearInterval(timer);el.textContent=text;delete el.dataset.busy;scrambles.delete(el);}},22);
  scrambles.set(el,{timer,text});
}
document.querySelectorAll('.project-row').forEach(row=>{for(const event of ['pointerenter','focus'])row.addEventListener(event,()=>scramble(row.querySelector('[data-scramble]')));});
// A brief monochrome signal tear, no continuous movement of reading text.
let clockTimer=null,glitchTimer=null,profileVisible=true,pageHidden=false;
let nextGlitchAt=performance.now()+23000;
const sessionStart=Date.now();
const clockFormat=new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit',timeZoneName:'short'});
function updateClock(){
  $('#hud-clock').textContent=clockFormat.format(new Date());
  const seconds=Math.floor((Date.now()-sessionStart)/1000);
  $('#hud-uptime').textContent='UP: '+[Math.floor(seconds/3600),Math.floor(seconds/60)%60,seconds%60].map(n=>String(n).padStart(2,'0')).join(':');
}
const updateNetwork=()=>{$('#hud-network').textContent=navigator.onLine?'NET: ONLINE':'NET: OFFLINE';};
$('#last-login').textContent=new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric'}).format(new Date());
$('#last-login').dateTime=new Date().toISOString();
function syncAmbient(){
  clearInterval(clockTimer);clearTimeout(glitchTimer);clockTimer=glitchTimer=null;
  const paused=document.hidden||pageHidden||!finished;
  document.body.classList.toggle('ambient-paused',paused);
  document.body.classList.toggle('low-power',lowPower||reduced.matches);
  if(paused){stopScrambles();releaseChip(true);return;}
  updateClock();clockTimer=setInterval(updateClock,1000);
  if(profileVisible&&!lowPower&&!reduced.matches){
    // Preserve the original 23-second cadence, including the first post-intro tear.
    while(nextGlitchAt<=performance.now())nextGlitchAt+=23000;
    const tear=()=>{cue('terminal-tear');$('.terminal').classList.add('signal-glitch');setTimeout(()=>$('.terminal').classList.remove('signal-glitch'),220);nextGlitchAt+=23000;glitchTimer=setTimeout(tear,Math.max(0,nextGlitchAt-performance.now()));};
    glitchTimer=setTimeout(tear,nextGlitchAt-performance.now());
  }
}
new IntersectionObserver(([entry])=>{profileVisible=entry.isIntersecting;syncAmbient();}).observe($('.terminal'));
new IntersectionObserver(([entry])=>document.body.classList.toggle('prompt-offscreen',!entry.isIntersecting)).observe($('#prompt-form'));
document.addEventListener('visibilitychange',syncAmbient);
addEventListener('pagehide',()=>{pageHidden=true;syncAmbient();void score.visibility(true);});
addEventListener('pageshow',()=>{pageHidden=false;syncAmbient();void score.visibility(document.hidden).then(updateSound);});
reduced.addEventListener('change',()=>{stopScrambles();syncAmbient();});
// A keyboard can shrink only the visual viewport, without resizing the layout viewport.
function keepPromptVisible(){
  const viewport=window.visualViewport;
  const keyboard=viewport&&document.activeElement===prompt&&viewport.scale<=1&&innerHeight-viewport.height>120;
  document.body.style.setProperty('--keyboard-space',keyboard?`${innerHeight-viewport.height}px`:'0px');
  if(!keyboard||document.activeElement!==prompt)return;
  const rect=$('#prompt-form').getBoundingClientRect(),top=viewport.offsetTop+12,bottom=viewport.offsetTop+viewport.height-$('#hud').offsetHeight-12;
  if(rect.bottom>bottom)scrollBy({top:rect.bottom-bottom,behavior:'instant'});
  else if(rect.top<top)scrollBy({top:rect.top-top,behavior:'instant'});
}
window.visualViewport?.addEventListener('resize',keepPromptVisible);
window.visualViewport?.addEventListener('scroll',keepPromptVisible);
prompt.addEventListener('focus',()=>requestAnimationFrame(keepPromptVisible));
// Safari's focus zoom would change the approved 13px mobile input. Temporarily
// cap its automatic viewport scale; iOS still permits the visitor's pinch zoom.
if(/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)){
  const viewport=$('meta[name="viewport"]'),original=viewport.content;
  prompt.addEventListener('focus',()=>{viewport.content=original+', maximum-scale=1';});
  prompt.addEventListener('blur',()=>{viewport.content=original;});
}
updateClock();updateNetwork();addEventListener('online',updateNetwork);addEventListener('offline',updateNetwork);
void runOpening({returning:hasSeen()});
$('#replay')?.addEventListener('click',()=>execute('logout'));
