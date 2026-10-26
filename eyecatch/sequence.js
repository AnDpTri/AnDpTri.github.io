import {SignalTransition,DEFAULT_TEAR_STYLE} from './signal-transition.js';

const finiteDuration=(value,name)=>{if(!Number.isFinite(value)||value<0)throw new RangeError(`${name} phải là số giây không âm.`);return value;};
const validateStyle=(style,name)=>{
 finiteDuration(style.duration,`${name}.duration`);
 if(style.strength!==undefined&&(!Number.isFinite(style.strength)||style.strength<0))throw new RangeError(`${name}.strength phải là số không âm.`);
 if(style.seed!==undefined&&!Number.isFinite(style.seed))throw new RangeError(`${name}.seed phải là số hữu hạn.`);
 if(style.direction!==undefined&&(!Number.isFinite(style.direction)||style.direction===0))throw new RangeError(`${name}.direction phải là số khác 0.`);
 if(style.tint!==undefined&&(!Number.isFinite(style.tint)||style.tint<0))throw new RangeError(`${name}.tint phải là số không âm.`);
};

export function createTimeline(definitions){
 if(!Array.isArray(definitions)||!definitions.length)throw new TypeError('Timeline cần ít nhất một đoạn.');
 let duration=0;
 const clips=definitions.map((definition,index)=>{finiteDuration(definition.duration,`clips[${index}].duration`);if(!definition.duration)throw new RangeError('Mỗi đoạn phải dài hơn 0.');if(!['scene','transition'].includes(definition.kind))throw new TypeError('Đoạn phải là scene hoặc transition.');const clip={...definition,start:duration,end:duration+definition.duration};duration=clip.end;return clip;});
 return {clips,totalDuration:duration,resolve(seconds){const time=Math.max(0,Math.min(duration,seconds)),clip=clips.find(c=>time<c.end)||clips.at(-1),elapsed=time-clip.start;
  if(clip.kind==='scene')return {kind:'scene',id:clip.id,time,localTime:(clip.localStart||0)+elapsed};
  return {kind:'transition',slot:clip.slot,time,progress:Math.max(0,Math.min(1,elapsed/clip.duration)),from:clip.from,to:clip.to,fromTime:(clip.fromStart||0)+(clip.freezeFrom?0:elapsed),toTime:(clip.toStart||0)+(clip.freezeTo?0:elapsed),style:{...DEFAULT_TEAR_STYLE,...clip.style}};
 }};
}
export function createSequenceLayout({mainDuration,entry={},exit={},tailHold=.35}){
 finiteDuration(mainDuration,'mainDuration');if(mainDuration===0)throw new RangeError('mainDuration phải lớn hơn 0.');
 if(entry&&typeof entry!=='object')throw new TypeError('entry phải là một đối tượng.');
 if(exit&&typeof exit!=='object')throw new TypeError('exit phải là một đối tượng.');
 const a={...DEFAULT_TEAR_STYLE,enabled:true,from:'before',to:'main',...entry};
 const b={...DEFAULT_TEAR_STYLE,enabled:true,from:'main',to:'after',seed:1,...exit};
 validateStyle(a,'entry');validateStyle(b,'exit');finiteDuration(tailHold,'tailHold');
 if(a.enabled&&(a.duration===0||a.duration>mainDuration))throw new RangeError('Chuyển đầu phải có thời lượng lớn hơn 0 và không vượt cảnh chính.');
 if(b.enabled&&b.duration===0)throw new RangeError('Chuyển cuối phải có thời lượng lớn hơn 0.');
 const clips=[],introEnd=a.enabled?a.duration:0;
 if(a.enabled)clips.push({kind:'transition',slot:'entry',from:a.from,to:a.to,duration:a.duration,style:a});
 if(mainDuration>introEnd)clips.push({kind:'scene',id:'main',duration:mainDuration-introEnd,localStart:introEnd});
 // fix3: the main scene keeps running under the exit tear (its local time continues past mainDuration) so the logo keeps moving;
 // pass exit:{freezeMain:true} for the old behaviour (a still frame of the last main frame).
 if(b.enabled){clips.push({kind:'transition',slot:'exit',from:b.from,to:b.to,duration:b.duration,fromStart:mainDuration,freezeFrom:b.freezeMain===true,style:b});if(tailHold)clips.push({kind:'scene',id:b.to,duration:tailHold,localStart:b.duration});}
 const timeline=createTimeline(clips);
 return {...timeline,mainDuration,entry:{...a,start:0,end:introEnd},exit:{...b,start:mainDuration,end:mainDuration+(b.enabled?b.duration:0)},tailHold};
}

// Scenes expose render(localSeconds, {globalTime}) -> CanvasImageSource.
// The same compositor is used for both transition slots.
export class SceneSequence{
 constructor(canvas,{scenes,clips=null,mainDuration,entry={},exit={},tailHold=.35,signalMap=null,plates=null,prepare=()=>{},transitionFrame=()=>null}){
  this.canvas=canvas;this.scenes=new Map(Object.entries(scenes));this.config=clips?null:{mainDuration,entry,exit,tailHold};this.prepare=prepare;this.transitionFrame=transitionFrame;this.layout=clips?createTimeline(clips):createSequenceLayout(this.config);this.pass=new SignalTransition(canvas,{signalMap,plates});
  this.ready=Promise.all([this.pass.ready,...[...this.scenes.values()].map(s=>s.ready)]).then(()=>this);
 }
 get duration(){return this.layout.totalDuration;}
 setScene(id,scene){
  if(!scene||typeof scene.render!=='function')throw TypeError('Cảnh phải cung cấp render(time).');
  const old=this.scenes.get(id);
  if(old&&old!==scene){
   const stillUsed=[...this.scenes.entries()].some(([k,s])=>k!==id&&(s===old||(old.media&&s.media===old.media)));
   if(!stillUsed){
    if(typeof old.destroy==='function')old.destroy();
    else if(old.media?.tagName==='VIDEO')old.media.pause();
   }
  }
  this.scenes.set(id,scene);
  return this;
 }
 setTransition(slot,patch){
  if(!this.config)throw new Error('Timeline tùy biến dùng setClips().');
  if(slot!=='entry'&&slot!=='exit')throw new RangeError('Điểm chuyển phải là entry hoặc exit.');
  if(!patch||typeof patch!=='object'||Array.isArray(patch))throw new TypeError('Cấu hình chuyển cảnh phải là một đối tượng.');
  const nextSlot={...this.config[slot],...patch};
  if(nextSlot.from&&!this.scenes.has(nextSlot.from))throw new Error(`Chưa đăng ký cảnh: ${nextSlot.from}`);
  if(nextSlot.to&&!this.scenes.has(nextSlot.to))throw new Error(`Chưa đăng ký cảnh: ${nextSlot.to}`);
  const next={...this.config,[slot]:nextSlot};
  const layout=createSequenceLayout(next);
  this.config=next;
  this.layout=layout;
  return this;
 }
 setClips(clips){const layout=createTimeline(clips);this.config=null;this.layout=layout;return this;}
 scene(id,localTime,globalTime){const scene=this.scenes.get(id);if(!scene)throw new Error(`Chưa đăng ký cảnh: ${id}`);const output=scene.render(localTime,{globalTime});if(!output)throw new TypeError(`Cảnh ${id} chưa trả về canvas hoặc ảnh.`);return output;}
 render(seconds){if(!Number.isFinite(seconds))throw new TypeError('Thời gian chuỗi phải là số hữu hạn.');const state=this.layout.resolve(seconds);this.prepare(state.time);
  const override=state.kind==='transition'?this.transitionFrame(state):null;
  if(override){this.pass.render({from:override,to:override,progress:1});}
  else if(state.kind==='transition'){const from=this.scene(state.from,state.fromTime,state.time),to=this.scene(state.to,state.toTime,state.time);this.pass.render({...state.style,from,to,progress:state.progress,texturedPlates:state.slot==='exit'||(state.slot==='entry'&&state.progress*1.5>=.5)});}
  else{const source=this.scene(state.id,state.localTime,state.time);this.pass.render({from:source,to:source,progress:1});}
  this.state=state;return state;
 }
 resize(){this.pass.resize();}
 destroy(){
  for(const scene of this.scenes.values()){
   if(typeof scene.destroy==='function')scene.destroy();
   else if(scene.media?.tagName==='VIDEO')scene.media.pause();
  }
  this.pass.destroy();
 }
}
