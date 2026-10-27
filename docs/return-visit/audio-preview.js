// Browser-only QA renderer. Uses the production score, shared beats and actual
// recorded cues when supplied. No duplicated synthesis or independent timeline.
import {AudioScore,MIX} from '../../audio.js';
import {CONNECTION_BEATS,CONNECTION_TIME,CONNECTION_TEAR} from '../../opening.js';

export async function renderAudioPreview(cues=null){
 const phases=new Set(CONNECTION_BEATS.map(beat=>beat.phase));
 const events=cues?cues.filter(cue=>Number.isFinite(cue.localTime)).map(cue=>({at:cue.localTime,name:cue.name})):
  CONNECTION_BEATS.map(({at,phase})=>({at,name:phase}));
 if(!cues){
  events.push({at:CONNECTION_TIME.reacquire+CONNECTION_TEAR.duration*CONNECTION_TEAR.burst,name:'tear-burst'});
  // Match the live frame slots and its 160ms audio rate limit.
  let lastSlot=-1,lastHit=-Infinity;
  for(let t=CONNECTION_TIME.alarm;t<CONNECTION_TIME.collapse;t+=1/60){
   const slot=Math.floor(t*(t<CONNECTION_TIME.panic?3:7));
   if(slot!==lastSlot){lastSlot=slot;if(t-lastHit>=.16){events.push({at:t,name:'error-burst'});lastHit=t;}}
  }
 }
 events.sort((a,b)=>a.at-b.at);
 const end=(events.findLast(event=>event.name==='complete')?.at??CONNECTION_TIME.complete)+2;
 const context=new OfflineAudioContext(1,Math.ceil(48000*end),48000);
 let seed=1234;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const score=new AudioScore(context,random);
 let next=0,lastHit=-Infinity;
 for(const event of [...events,{at:end,name:'end'}]){
  while(next<event.at){score.intensity=Math.min(1,Math.max(0,(next-CONNECTION_TIME.alarm)/(CONNECTION_TIME.collapse-CONNECTION_TIME.alarm)));score.note(next);next+=60/MIX.bpm/4;}
  if(event.name==='end')break;
  if(phases.has(event.name)){score.phase(event.name,event.at);next=event.at+.012;}
  if(event.name==='error-burst'){if(event.at-lastHit<.16)continue;lastHit=event.at;}
  score.effect(event.name,event.at);
 }
 const buffer=await context.startRendering();
 return {buffer,events};
}
