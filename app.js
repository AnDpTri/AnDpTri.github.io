import {AudioScore} from './audio.js';
import {Opening} from './opening.js?v=1793018626';
const $ = selector => document.querySelector(selector);
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const opening = $('#opening'), page = $('#page');
const mainReady = Promise.all([document.fonts.ready, new Promise(resolve => document.readyState === 'complete' ? resolve() : addEventListener('load', resolve, {once:true}))]);
const score=new AudioScore();
try{score.enabled=localStorage.getItem('thepeak.sound')!=='off';}catch{/* private storage */}
const soundButton=$('#sound-toggle');
function updateSound(){const on=score.enabled && score.context?.state==='running';soundButton.textContent=`[ SND: ${on?'ON':'OFF'} ]`;soundButton.setAttribute('aria-pressed',String(on));}
function cue(name,detail={}){dispatchEvent(new CustomEvent('portfolio:cue',{detail:{name,...detail}}));score.cue(name,detail);}
async function setSound(value){score.setEnabled(value);try{localStorage.setItem('thepeak.sound',value?'on':'off');}catch{/* private storage */}if(value)await score.unlock();updateSound();}
soundButton.addEventListener('click',()=>{void setSound(!(score.enabled && score.context?.state==='running'));});
let hiddenAt=document.hidden?performance.now():null,hiddenTotal=0;
const activeClock=()=>performance.now()-hiddenTotal-(hiddenAt===null?0:performance.now()-hiddenAt);
document.addEventListener('visibilitychange',()=>{if(document.hidden)hiddenAt=performance.now();else if(hiddenAt!==null){hiddenTotal+=performance.now()-hiddenAt;hiddenAt=null;}void score.visibility(document.hidden).then(updateSound);});
// Read-only diagnostics for verification; no console spam in production.
window.__audioDebug={get state(){return score.context?.state??'locked';},get enabled(){return score.enabled;},get voices(){return score.voices.size;},timeline:score.timeline};
updateSound();
let finished=true, runId=0;
const connection=new Opening({score,cue,updateSound,mainReady,activeClock,reduced});
window.__openingDebug={get phase(){return connection.phase;},get elapsed(){return connection.elapsed;},get loaded(){return connection.loaded;},get fallback(){return connection.fallback;},get webgl(){return !!connection.signal;}};
async function runOpening(){
  if(!finished)return;
  finished=false;runId++;
  try{await connection.run();}catch(error){connection.fallback=error.message;}finally{
    opening.hidden=true;page.inert=false;document.body.classList.remove('intro-active');document.querySelector('#opening-controls').style.visibility='';
    finished=true;if(connection.phase!=='complete'){score.phase('complete');cue('complete');}updateSound();
    if(runId>1||connection.skipRequested){$('#name').tabIndex=-1;$('#name').focus({preventScroll:true});}
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
  typedHistory.push(input);historyIndex=typedHistory.length;
  const [command,...args]=input.toLowerCase().split(/\s+/);
  if(['intro','logout','lock'].includes(command)){
    commandHistory.replaceChildren();prompt.value='';cue('power-down');setTimeout(()=>void runOpening(),340);return;
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
      window.open(link.href,'_blank','noopener,noreferrer');break;
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
$('.command-chips').addEventListener('click',event=>{const chip=event.target.closest('[data-command]');if(chip){execute(chip.dataset.command);if(finished)prompt.focus({preventScroll:true});}});
prompt.addEventListener('keydown',event=>{
  if(!['ArrowUp','ArrowDown'].includes(event.key))return;
  event.preventDefault();historyIndex=Math.max(0,Math.min(typedHistory.length,historyIndex+(event.key==='ArrowUp'?-1:1)));
  prompt.value=typedHistory[historyIndex] || '';
});

function scramble(el){
  if(reduced.matches || el.dataset.busy)return;
  cue('hover');el.dataset.busy='true';const text=el.textContent;el.setAttribute('aria-label',text);let tick=0;
  const timer=setInterval(()=>{tick+=3;el.textContent=[...text].map((c,i)=>i<tick || c===' '?c:'01▒░'[Math.floor(Math.random()*4)]).join('');if(tick>=text.length){clearInterval(timer);el.textContent=text;delete el.dataset.busy;}},22);
}
document.querySelectorAll('.project-row').forEach(row=>{for(const event of ['pointerenter','focus'])row.addEventListener(event,()=>scramble(row.querySelector('[data-scramble]')));});
// A brief monochrome signal tear, no continuous movement of reading text.
setInterval(()=>{if(finished && !reduced.matches && !document.hidden){cue('terminal-tear');$('.terminal').classList.add('signal-glitch');setTimeout(()=>$('.terminal').classList.remove('signal-glitch'),220);}},23000);
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
updateClock();updateNetwork();setInterval(updateClock,1000);addEventListener('online',updateNetwork);addEventListener('offline',updateNetwork);
void runOpening();
