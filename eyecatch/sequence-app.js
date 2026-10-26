import {EdgerunnersPlayer} from './edgerunners-player.js';
import {START,DURATION as SOURCE_DURATION} from './effect.js';
import {sequenceConfig} from './sequence-config.js';

const $=s=>document.querySelector(s),canvas=$('#effect');
let playing=false,time=0,speed=1,last=performance.now(),timestamps=[],effect;
const objectURLs={before:null,after:null};
const phases=[['Xé vào',0],['Tràn màu',.488],['EDGE / RUNNERS',1.418],['Chữ neon',1.958],['Chồng logo',2.708],['TV mất tín hiệu',2.978]];
$('main').inert=true;
try{effect=new EdgerunnersPlayer(canvas,sequenceConfig);}catch(err){showError(err);throw err;}
window.effect=effect;window.sequence=effect;

function showError(err){$('main').inert=false;const loading=$('#loading');if(loading)loading.textContent='Không khởi tạo được hiệu ứng';$('#error').hidden=false;$('#error').textContent=err?.message||String(err);console.error(err);}
fetch('./assets/source-neon/manifest.json').then(r=>r.json()).then(m=>{
 const numbers=m.ranges.flatMap(([a,b])=>Array.from({length:b-a+1},(_,i)=>a+i));
 timestamps=numbers.map(n=>({name:m.pattern.replace('{n}',String(n).padStart(m.pad||4,'0')),time:START+(n-1)/m.fps}));
}).catch(()=>{$('#compare').disabled=true;$('#background option[value=source]')?.remove();});

function syncTimeline(){
 $('#scrub').max=effect.duration;time=Math.min(time,effect.duration);$('#exit-enabled').checked=effect.layout.exit.enabled;
 $('#exit-preview').disabled=!effect.layout.exit.enabled;
}
function updateReference(){
 if(!$('#compare').checked)return;
 const {exit}=effect.layout;
 const extension=exit.enabled&&time>=exit.start;
 $('#reference').hidden=extension;$('#reference-note').hidden=!extension;
 if(extension||!timestamps.length)return;
 const at=START+time;
 let low=0,high=timestamps.length-1;
 while(low<=high){
  const mid=(low+high)>>1;
  if(timestamps[mid].time<at)low=mid+1;
  else high=mid-1;
 }
 const c1=timestamps[high],c2=timestamps[low];
 const nearest=c1&&c2?(Math.abs(c1.time-at)<=Math.abs(c2.time-at)?c1:c2):(c1||c2);
 if(nearest&&$('#reference').dataset.name!==nearest.name){$('#reference').src='./assets/source-neon/'+nearest.name;$('#reference').dataset.name=nearest.name;}
}
function draw(){
 const state=effect.render(time);$('#time').textContent=time.toFixed(3).padStart(6,'0');$('#scrub').value=time;
 let index=0;phases.forEach((p,i)=>{if(time>=p[1])index=i;});
 const {exit}=effect.layout;
 const inExit=exit.enabled&&time>=exit.start&&(state.kind==='transition'&&state.slot==='exit');
 const inTail=exit.enabled&&time>=exit.end;
 const extension=exit.enabled&&time>=exit.start;
 $('#phase').textContent=inExit?'Xé sang cảnh sau · đoạn nối thử':inTail?'Cảnh sau · đoạn nối thử':phases[index][0]+' · nguồn '+(START+time).toFixed(3)+' s';
 document.querySelectorAll('.phases [data-time]').forEach((b,i)=>b.classList.toggle('active',!extension&&i===index));$('#exit-preview').classList.toggle('active',inExit);
 updateReference();
}
function setPlaying(value){
 playing=value;$('#play').textContent=value?'Dừng':'Phát';last=performance.now();
 for(const media of effect.mediaElements()){if(value)media.play().catch(()=>{});else media.pause();}
}
function seek(t){time=Math.max(0,Math.min(effect.duration,t));draw();}
window.seek=seek;
window.renderAt=async t=>{await effect.ready;setPlaying(false);seek(t);return {time,width:canvas.width,height:canvas.height,state:effect.state.kind,slot:effect.state.slot||null};};
window.configureTransition=(slot,patch)=>{
 try{
  effect.setTransition(slot,patch);
  syncTimeline();
  draw();
  $('#error').hidden=true;
 }catch(err){
  showError(err);
  throw err;
 }
};
window.setTransition=window.configureTransition;

$('#play').onclick=()=>{if(time>=effect.duration)time=0;setPlaying(!playing);};
$('#restart').onclick=()=>{seek(0);setPlaying(true);};
$('#scrub').oninput=e=>{setPlaying(false);seek(+e.target.value);};$('#speed').onchange=e=>speed=+e.target.value;
document.querySelectorAll('[data-time]').forEach(b=>b.onclick=()=>{setPlaying(false);seek(+b.dataset.time);});
$('#exit-preview').onclick=()=>{seek(Math.max(0,effect.layout.exit.start-.45));setPlaying(true);};
$('#neon-source').onchange=e=>{effect.useSourceNeon=e.target.checked;draw();};
$('#signal').onchange=e=>{effect.signal=e.target.checked;draw();};
$('#compare').onchange=e=>{$('.reference').hidden=!e.target.checked;$('#screens').classList.toggle('compare',e.target.checked);effect.resize();draw();};
$('#exit-enabled').onchange=e=>{
 try{
  effect.setTransition('exit',{enabled:e.target.checked});
  syncTimeline();
  draw();
  $('#error').hidden=true;
 }catch(err){
  showError(err);
 }
};

$('#background').onchange=async e=>{
 try{if(e.target.value==='source'){const im=new Image();im.src='./assets/source-neon/neon-0020.webp';await im.decode();effect.setBackground(im);}else if(e.target.value!=='custom')effect.setBackground(e.target.value);draw();$('#error').hidden=true;}catch(err){showError(err);}
};
$('#next-scene').onchange=e=>{
 try{
  if(e.target.value==='custom')return;effect.setNextScene(e.target.value);
  // Different scene endpoints are useful as a one-shot transition preview.
  if(e.target.value!=='same')$('#loop').checked=false;
  draw();
  $('#error').hidden=true;
 }catch(err){showError(err);}
};
async function loadMedia(file,slot){
 const oldURL=objectURLs[slot],url=URL.createObjectURL(file);let media;
 try{
  if(file.type.startsWith('video/')){media=document.createElement('video');media.muted=true;media.loop=true;media.playsInline=true;await new Promise((resolve,reject)=>{media.onloadeddata=resolve;media.onerror=()=>reject(Error('Không đọc được video.'));media.src=url;media.load();});}
  else{media=new Image();media.src=url;await media.decode();}
  objectURLs[slot]=url;if(oldURL)URL.revokeObjectURL(oldURL);return media;
 }catch(err){URL.revokeObjectURL(url);throw err;}
}
$('#upload').onchange=async e=>{
 const file=e.target.files[0];if(!file)return;
 try{effect.setBackground(await loadMedia(file,'before'));$('#background').value='custom';seek(0);setPlaying(true);$('#error').hidden=true;}catch(err){showError(err);}
};
$('#upload-next').onchange=async e=>{
 const file=e.target.files[0];if(!file)return;
 try{effect.setNextScene(await loadMedia(file,'after'));$('#next-scene').value='custom';$('#loop').checked=false;effect.setTransition('exit',{enabled:true});syncTimeline();seek(Math.max(0,effect.layout.exit.start-.45));setPlaying(true);$('#error').hidden=true;}catch(err){showError(err);}
};
$('#save').onclick=()=>{draw();const a=document.createElement('a');a.download='transition-'+time.toFixed(3)+'.png';a.href=canvas.toDataURL();a.click();};
$('#fullscreen').onclick=async()=>{if(document.fullscreenElement)await document.exitFullscreen();else await $('#screens').requestFullscreen();effect.resize();draw();};
window.addEventListener('resize',()=>{if(window.ready){effect.resize();draw();}});
window.addEventListener('keydown',e=>{if(/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)||!window.ready)return;if(e.code==='Space'){e.preventDefault();setPlaying(!playing);}if(e.code==='ArrowRight'||e.code==='ArrowLeft'){e.preventDefault();setPlaying(false);seek(time+(e.code==='ArrowRight'?1:-1)/24);}});
window.addEventListener('beforeunload',()=>{effect.destroy();for(const url of Object.values(objectURLs))if(url)URL.revokeObjectURL(url);});

try{
 await effect.ready;if(!effect.hasSourceNeon){$('#neon-source').checked=false;$('#neon-source').disabled=true;$('#neon-source').parentElement.title='Không có bộ khung gốc; đang dùng bản dựng WebGL';}$('#loading').remove();$('main').inert=false;syncTimeline();draw();window.ready=true;
 if(new URLSearchParams(location.search).get('preview')==='exit'){$('#exit-preview').click();}
 requestAnimationFrame(function tick(now){const dt=Math.min((now-last)/1000,.1);last=now;if(playing){time+=dt*speed;if(time>effect.duration){if($('#loop').checked)time%=effect.duration;else{time=effect.duration;setPlaying(false);}}draw();}requestAnimationFrame(tick);});
}catch(err){showError(err);}
