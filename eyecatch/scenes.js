// Canvas scene adapters; no dependency on the title or transition timeline.
export function drawPreset(c,preset,t=0){const w=1920,h=1080;
 if(preset==='poster'){c.fillStyle='#e6e1d5';c.fillRect(0,0,w,h);c.fillStyle='#e64820';c.fillRect(1260,0,660,h);c.fillStyle='#202421';c.font='bold 225px Arial';c.fillText('MAKE',110,310);c.fillText('SOMETHING',110,550);c.fillText('MOVE.',110,790);c.font='30px Arial';c.fillText('Independent design & creative development',120,960);return;}
 if(preset==='orbital'){c.fillStyle='#10131c';c.fillRect(0,0,w,h);c.strokeStyle='#8cabb3';c.lineWidth=2;for(let i=0;i<18;i++){c.beginPath();c.ellipse(960,540,160+i*36,160+i*18,i*.12+t*.03,0,Math.PI*2);c.stroke();}c.fillStyle='#df754c';c.beginPath();c.arc(960+Math.cos(t*.3)*620,540+Math.sin(t*.3)*300,100,0,Math.PI*2);c.fill();return;}
 c.fillStyle='#07161b';c.fillRect(0,0,w,h);const sky=c.createRadialGradient(1040,360,10,1040,360,850);sky.addColorStop(0,'#176172');sky.addColorStop(1,'#02070c');c.fillStyle=sky;c.fillRect(0,0,w,h);
 for(let side=0;side<2;side++)for(let i=0;i<9;i++){c.save();c.translate(side?w:0,h);c.scale(side?-1:1,1);c.transform(1,-.12-i*.015,.25+i*.025,1,0,0);const x=i*105-190,y=-350-i*87,bw=125; c.fillStyle=i%2?'#050b11':'#09151a';c.fillRect(x,y,bw,-y+200);for(let yy=y+25;yy<60;yy+=27)for(let xx=x+12;xx<x+bw-9;xx+=23){c.fillStyle=(Math.floor(xx*yy)%7<3)?'#b3c991':'#164348';c.globalAlpha=.4+((xx+yy)%19)/50;c.fillRect(xx,yy,7,12);}c.restore();}
 c.save();c.translate(820,1080);c.transform(1,-.1,.08,1,0,0);c.fillStyle='#02070b';c.fillRect(0,-760,300,900);for(let y=-730;y<0;y+=29)for(let x=25;x<280;x+=27){c.fillStyle=(x*y%11<4)?'#a7b264':'#12232c';c.fillRect(x,y,9,5);}c.restore();
}

export class BackgroundScene {
 constructor(source='architecture'){this.canvas=document.createElement('canvas');this.canvas.width=1920;this.canvas.height=1080;this.ctx=this.canvas.getContext('2d');this.setSource(source);}
 setSource(source){if(this.source?.tagName==='VIDEO'&&this.source!==source)this.source.pause();this.source=source;this.dirty=true;return this;}
 get media(){return typeof this.source==='string'?null:this.source;}
 render(time=0){const source=this.source,c=this.ctx;const dynamic=typeof source==='function'||source?.tagName==='VIDEO'||source?.tagName==='CANVAS'||source==='orbital';if(!this.dirty&&!dynamic)return this.canvas;c.clearRect(0,0,1920,1080);if(typeof source==='string'){drawPreset(c,source,time);}else if(typeof source==='function'){source(c,time,{width:1920,height:1080});}else if(source){const w=source.videoWidth||source.naturalWidth||source.width,h=source.videoHeight||source.naturalHeight||source.height;c.fillStyle='#111';c.fillRect(0,0,1920,1080);if(w&&h){const scale=Math.max(1920/w,1080/h);c.drawImage(source,(1920-w*scale)/2,(1080-h*scale)/2,w*scale,h*scale);}}this.dirty=false;return this.canvas;}
 destroy(){if(this.source?.tagName==='VIDEO')this.source.pause();}
}
