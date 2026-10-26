// All sound is generated here. No samples, worklets, or network requests.
export const MIX = Object.freeze({bpm:132, master:.62, drop:.48, bed:.0604, sfx:.28, lookahead:.10, interval:25});
const midi = n => 440 * 2 ** ((n-69)/12);
const modes = {boot:.15, calm:.20, unease:.16, alarm:.24, panic:.32, collapse:0, blackout:0, 'no-signal':.12, reacquire:0, settle:0, complete:MIX.bed};

export class AudioScore {
  constructor(context=null, random=Math.random) {
    this.context=context;this.random=random;this.enabled=true;this.mode='boot';this.intensity=0;this.step=0;this.voices=new Set();this.limits=new Map();this.timeline=[];
    if(context)this.build();
  }
  build() {
    const c=this.context;
    this.master=c.createGain();this.master.gain.value=MIX.master;
    this.compressor=c.createDynamicsCompressor();
    Object.assign(this.compressor.threshold,{value:-12});this.compressor.knee.value=8;this.compressor.ratio.value=16;this.compressor.attack.value=.002;this.compressor.release.value=.12;
    this.music=c.createGain();this.fx=c.createGain();this.fx.gain.value=MIX.sfx;
    this.music.connect(this.compressor);this.fx.connect(this.compressor);this.compressor.connect(this.master);this.master.connect(c.destination);
    this.noise=c.createBuffer(1,c.sampleRate,c.sampleRate);
    const data=this.noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=this.random()*2-1;
    this.curve=Float32Array.from({length:1024},(_,i)=>Math.tanh((i/511.5-1)*2.8));
    this.next=c.currentTime+.02;this.updateGain();
  }
  async unlock() {
    try {
      if(!this.context){const Audio=globalThis.AudioContext || globalThis.webkitAudioContext;if(!Audio)return false;this.context=new Audio({latencyHint:'interactive'});this.build();}
      // Called directly inside a trusted gesture, before any await.
      await this.context.resume();
      this.next=this.context.currentTime+.015;
      if(this.enabled)this.startScheduler();
      this.updateGain();return this.context.state==='running';
    } catch {return false;} // Unsupported audio must never block the portfolio.
  }
  updateGain() {
    if(!this.context)return;
    const t=this.context.currentTime;
    for(const [node,value] of [[this.master,this.enabled?MIX.master:0],[this.music,modes[this.mode]??MIX.bed]]){
      node.gain.cancelScheduledValues(t);node.gain.setTargetAtTime(value,t,.018);
    }
  }
  startScheduler(){if(!this.timer)this.timer=setInterval(()=>this.schedule(),MIX.interval);}
  stopScheduler(){clearInterval(this.timer);this.timer=null;}
  setEnabled(value){this.enabled=value;if(!value)this.stopScheduler();this.updateGain();}
  cancelNotes(t) {
    for(const voice of this.voices){
      voice.gain.gain.cancelScheduledValues(t);voice.gain.gain.setTargetAtTime(0,t,.006);
      for(const source of voice.sources){try{source.stop(t+.025);}catch{/* already ended */}}
    }
  }
  phase(mode,t=this.context?.currentTime??0) {
    this.mode=mode;this.step=0;this.next=t+.012;
    if(this.context){this.cancelNotes(t);this.updateGain();}
  }
  // Every source has a finite lifetime; disconnected on end, including muted runs.
  voice(sources,output,t,duration,level,bus=this.music) {
    const c=this.context,gain=c.createGain();
    gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(Math.max(.0002,level),t+.004);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
    output.connect(gain);gain.connect(bus);
    const voice={sources,gain};this.voices.add(voice);let remaining=sources.length;
    for(const source of sources){source.onended=()=>{source.disconnect();if(!--remaining){output.disconnect();gain.disconnect();this.voices.delete(voice);}};source.start(t);source.stop(t+duration+.01);}
    return gain;
  }
  tone(t,f,duration,level,type='sine',bus=this.music,end=f) {
    const o=this.context.createOscillator();o.type=type;o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime(Math.max(10,end),t+duration);
    this.voice([o],o,t,duration,level,bus);
  }
  bass(t,n,duration,level,cutoff) {
    const c=this.context,filter=c.createBiquadFilter(),drive=c.createWaveShaper();
    filter.type='lowpass';filter.Q.value=2;filter.frequency.setValueAtTime(cutoff,t);filter.frequency.exponentialRampToValueAtTime(Math.max(90,cutoff*.22),t+duration);
    drive.curve=this.curve;drive.connect(filter);
    const sources=[-11,11].map(detune=>{const o=c.createOscillator();o.type='sawtooth';o.frequency.value=midi(n);o.detune.value=detune;o.connect(drive);return o;});
    const gain=this.voice(sources,filter,t,duration,level);const ended=sources[0].onended;sources[0].onended=()=>{ended();drive.disconnect();};
    return gain;
  }
  noiseHit(t,duration,level,freq=4500,type='highpass',end=freq,bus=this.music) {
    const c=this.context,s=c.createBufferSource(),f=c.createBiquadFilter();s.buffer=this.noise;s.loop=true;s.playbackRate.value=.8+this.random()*.4;
    f.type=type;f.Q.value=.8;f.frequency.setValueAtTime(freq,t);f.frequency.exponentialRampToValueAtTime(Math.max(30,end),t+duration);s.connect(f);this.voice([s],f,t,duration,level,bus);
  }
  kick(t,level=1){this.tone(t,150,.21,level,'sine',this.music,42);this.noiseHit(t,.016,.12,1800);}
  zap(t,level=1,duration=.08+this.random()*.16) {
    this.noiseHit(t,duration,.50*level,900+this.random()*3500,'bandpass',240,this.fx);
    for(let i=0;i<5;i++)this.noiseHit(t+this.random()*duration*.7,.006+this.random()*.014,.22*level,3800,'highpass',5500,this.fx);
    const c=this.context,carrier=c.createOscillator(),mod=c.createOscillator(),depth=c.createGain();
    carrier.type='sawtooth';carrier.frequency.setValueAtTime(400+this.random()*500,t);carrier.frequency.exponentialRampToValueAtTime(65,t+duration);
    mod.frequency.value=70+this.random()*160;depth.gain.value=360;mod.connect(depth);depth.connect(carrier.frequency);
    this.voice([carrier,mod],carrier,t,duration,.08*level,this.fx);const ended=mod.onended;mod.onended=()=>{ended();depth.disconnect();};
  }
  cue(name,detail={},t=this.context?.currentTime??0) {
    const visualAt=typeof performance==='undefined'?0:performance.now();
    const active=!!this.context && this.enabled && this.context.state==='running';
    const limited={'hover':.15,'key':.055,'error-burst':.16,'signal-noise':.10};
    const last=this.limits.get(name)??-Infinity;
    if(visualAt/1000-last<(limited[name]??0))return;
    this.limits.set(name,visualAt/1000);
    this.timeline.push({name,phase:this.mode,visualAt,audioAt:active?t:null,...detail});if(this.timeline.length>600)this.timeline.shift();
    if(!active)return;
    this.effect(name,t);
  }
  effect(name,t) {
    if(['calm','unease','alarm','panic','blackout','no-signal','settle','complete','jack-in','silent-timeout'].includes(name))return;
    if(name==='reacquire'){this.noiseHit(t,.28,.12,180,'bandpass',1800,this.fx);return;}
    if(name==='tear-burst'){this.noiseHit(t,.28,.65,900,'bandpass',6200,this.fx);this.tone(t,62,.38,.7,'sine',this.fx,31);return;}
    if(name==='key'){this.noiseHit(t,.012,.025,5200,'highpass',5200,this.fx);return;}
    if(name==='decrypt'){this.noiseHit(t,1.24,.22,180,'bandpass',6500,this.fx);return;}
    if(name==='power-down'){this.tone(t,180,.32,.35,'sawtooth',this.fx,16);this.noiseHit(t,.28,.20,2800,'lowpass',80,this.fx);return;}
    if(name==='collapse'){this.tone(t,360,.9,.30,'sawtooth',this.fx,22);this.noiseHit(t,.85,.32,6500,'lowpass',60,this.fx);return;}
    if(name==='drop'){this.kick(t,1.1);this.tone(t,52,.6,.6);}
    if(name==='granted'){this.tone(t,880,.24,.33,'triangle',this.fx);this.tone(t,1320,.28,.20,'sine',this.fx);}
    if(!['boot','breach','complete','bounce','holding','unlock','eyecatch'].includes(name))this.zap(t,name==='hover'?.12:name==='error-burst'?.35:1);
  }
  note(t) {
    const s=this.step++%32,mode=this.mode,bed=mode==='complete',sparse=bed||['bounce','holding','exit'].includes(mode);
    if(['collapse','blackout','reacquire','settle'].includes(mode))return;
    if(mode==='calm'){if(s%16===0){this.tone(t,55,1.8,.38);this.tone(t,110,1.8,.06);}return;}
    if(mode==='unease'){if(s<8&&s%2===0)this.tone(t,55,.09,.34);return;}
    if(mode==='no-signal'){if(s%8===0){this.noiseHit(t,1,.20,2400,'bandpass',2400);this.tone(t,60,1,.12);}return;}
    if(mode==='alarm'||mode==='panic'){
      if(s%2===0)this.tone(t,42+this.intensity*32,.18,.5,'sawtooth',this.music,38);
      if(mode==='panic'&&s%4===0)this.noiseHit(t,.09,.22,700,'bandpass',2200);
      return;
    }
    if(mode==='boot'){
      if(s%16===0){this.tone(t,41.2,2.1,.3);this.tone(t,7800,1.9,.009);}
      return;
    }
    if(['unlock','granted'].includes(mode))return;
    if(sparse && s%8!==0)return;
    const breach=mode==='breach',cutoff=bed?240:breach?300+this.intensity*2200:1900;
    const notes=[28,28,28,40,28,31,28,35];
    this.bass(t,notes[Math.floor(s/2)%8],sparse?.30:.10,bed?.46:.35,cutoff);
    if(s%4===0 || (!sparse && !breach && s%16===14))this.kick(t,bed?.52:.85);
    if(!sparse && (!breach || this.intensity>.3)){
      if(s%2===1)this.noiseHit(t,s%8===7?.11:.035,.14,6800);
      if(s%8===4)this.noiseHit(t,.12,.27,1200,'bandpass');
    }
  }
  schedule(horizon=MIX.lookahead) {
    if(!this.context || !this.enabled || this.context.state!=='running')return;
    const now=this.context.currentTime;
    if(this.next<now)this.next=now+.012;
    while(this.next<now+horizon){this.note(this.next);this.next+=60/MIX.bpm/4;}
  }
  async visibility(hidden) {
    if(!this.context)return;
    try{if(hidden){this.stopScheduler();this.cancelNotes(this.context.currentTime);await this.context.suspend();}else if(this.enabled){await this.context.resume();this.next=this.context.currentTime+.012;this.startScheduler();}}catch{/* browser interruption */}
  }
}
