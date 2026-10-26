// Optional cleaned source frames. A missing individual frame falls back to reconstruction.
export class SourceNeonFrames {
 constructor(root='./assets/source-neon/',{maxWidth=1920}={}) {
  this.root=root;this.maxWidth=maxWidth;this.enabled=true;this.loaded=false;this.frames=[];this.disposed=false;this.controller=new AbortController();
  this.canvas=Object.assign(document.createElement('canvas'),{width:1920,height:1080});this.ctx=this.canvas.getContext('2d');
  this.ready=this.load().catch(error=>{this.error=error;this.loaded=false;});
 }
 async load() {
  const response=await fetch(this.root+'manifest.json',{signal:this.controller.signal});if(!response.ok)throw Error('Source manifest unavailable');
  const m=await response.json();this.manifest={...m,fps:m.fps||24};
  const numbers=m.ranges?m.ranges.flatMap(([a,b])=>Array.from({length:b-a+1},(_,i)=>a+i)):Array.from({length:m.count},(_,i)=>m.first+i);
  let index=0;
  await Promise.all(Array.from({length:4},async()=>{
   while(index<numbers.length&&!this.disposed){const n=numbers[index++];try {
    const res=await fetch(this.root+m.pattern.replace('{n}',String(n).padStart(m.pad||4,'0')),{signal:this.controller.signal});
    if(!res.ok)throw Error('Source frame unavailable');
    const width=Math.min(m.width||1920,this.maxWidth);
    const bitmap=await createImageBitmap(await res.blob(),{resizeWidth:width,resizeHeight:Math.round(width*(m.height||1080)/(m.width||1920))});
    if(this.disposed)bitmap.close();else this.frames[n]=bitmap;
   }catch(error){if(!this.disposed)throw error;}}
  }));this.loaded=!this.disposed&&numbers.every(n=>this.frames[n]);
 }
 get active(){return this.enabled&&this.loaded;}
 frameAt(time) {
  if(!this.active)return null;
  const frame=this.frames[Math.floor(time*this.manifest.fps+1e-6)+1];if(!frame)return null;
  this.ctx.drawImage(frame,0,0,1920,1080);return this.canvas;
 }
 destroy(){this.disposed=true;this.controller.abort();for(const f of this.frames)f?.close?.();this.frames=[];this.loaded=false;this.canvas.width=this.canvas.height=1;}
}
