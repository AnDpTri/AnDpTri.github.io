import {TransitionEffect,DURATION as MAIN_DURATION} from './effect.js';
import {BackgroundScene} from './scenes.js';
import {SceneSequence} from './sequence.js';
import {SourceNeonFrames} from './source-neon.js';

// This adapter owns the title scene. SceneSequence and SignalTransition remain
// reusable without importing this title, its lettering or its logo.
export class EdgerunnersPlayer{
 constructor(canvas,{assetRoot='./assets/',entry={},exit={},tailHold=.35,sourceMaxWidth=1920,sourceFramesOnly=false,sourceRoot=null}={}){
  this.canvas=canvas;this.mainDuration=MAIN_DURATION;this.before=new BackgroundScene('architecture');this.before.render(0);this.after=this.before;this.nextSource='same';
  this.neon=new SourceNeonFrames(sourceRoot||assetRoot+'source-neon/',{maxWidth:sourceMaxWidth});
  this.core=new TransitionEffect(document.createElement('canvas'),{assetRoot,embeddedIntro:false,sourceFramesOnly});this.core.setBackground(this.before.canvas);
  this.sequence=new SceneSequence(canvas,{mainDuration:MAIN_DURATION,entry,exit,tailHold,signalMap:assetRoot+'signal-map.png',plates:assetRoot+'takeover-plates.json',
   scenes:{before:this.before,main:{ready:Promise.all([this.core.ready,this.neon.ready]),render:t=>{const frame=this.neon.frameAt(t);if(frame)return frame;this.core.render(t);return this.core.canvas;}},after:this.after},
   transitionFrame:state=>state.slot==='entry'?this.neon.frameAt(.0003+state.progress*1.5):null,
   prepare:t=>this.before.render(t)});
  this.ready=this.sequence.ready.then(()=>{if(!this.disposed){this.resize();this.render(0);}return this;});
 }
 get duration(){return this.sequence.duration;}
 get layout(){return this.sequence.layout;}
 get state(){return this.sequence.state;}
 get gl(){return this.sequence.pass.gl;}
 get media(){return this.before.media;}
 get useSourceNeon(){return this.neon.enabled;}
 set useSourceNeon(value){this.neon.enabled=!!value;}
 get hasSourceNeon(){return this.neon.loaded;}
 get signal(){return this.core.signal;}
 set signal(value){this.core.signal=!!value;this.sequence.pass.signal=!!value;}
 mediaElements(){return [...new Set([this.before.media,this.after.media].filter(s=>s?.tagName==='VIDEO'))];}
 setBackground(source){this.before.setSource(source);return this;}
 setNextScene(source){if(this.after!==this.before&&this.after.media?.tagName==='VIDEO')this.after.media.pause();this.nextSource=source;this.after=source==='same'?this.before:source?.render?source:new BackgroundScene(source);this.sequence.setScene('after',this.after);return this;}
 setTransition(slot,patch){this.sequence.setTransition(slot,patch);return this;}
 resize(){this.sequence.resize();this.core.canvas.width=this.canvas.width;this.core.canvas.height=this.canvas.height;this.core.gl.viewport(0,0,this.canvas.width,this.canvas.height);}
 render(time){return this.sequence.render(time);}
 destroy(){if(this.disposed)return;this.disposed=true;for(const media of this.mediaElements())media.pause();this.neon.destroy();Promise.allSettled([this.core.ready,this.sequence.pass.ready]).then(()=>{this.sequence.destroy();this.core.destroy();this.core.poses=[];for(const canvas of [this.canvas,this.core.canvas,this.before.canvas])canvas.width=canvas.height=1;});}
}
