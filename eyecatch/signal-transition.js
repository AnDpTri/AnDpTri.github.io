import {takeoverGLSL} from './takeover.js';

// A transition consumes two rendered scenes. It knows nothing about their content.
export const DEFAULT_TEAR_STYLE=Object.freeze({duration:1.5,strength:1,seed:0,direction:1,tint:0});
const vertex=`attribute vec2 position;varying vec2 uv;void main(){uv=vec2((position.x+1.)*.5,(1.-position.y)*.5);gl_Position=vec4(position,0.,1.);}`;
// Palette slots of the colour-plate takeover; with tintAmount 0 every slot keeps its source value.
const PALETTE_SWAPS=[
 ['const vec3 red=vec3(.73,.002,.008);','vec3 red=mix(vec3(.73,.002,.008),tkDark,tintAmount);'],
 ['const vec3 yellow=vec3(1.,.91,.025);','vec3 yellow=mix(vec3(1.,.91,.025),tkLight,tintAmount);'],
 ['const vec3 green=vec3(.01,.98,.015);','vec3 green=mix(vec3(.01,.98,.015),tkAccent,tintAmount);'],
 ['mix(vec3(.005,.20,.46),vec3(.015,.95,.47),','mix(mix(vec3(.005,.20,.46),tkDeep,tintAmount),mix(vec3(.015,.95,.47),tkAccent,tintAmount),'],
 ['mix(vec3(.12,.015,.45),vec3(.96,.005,.43),magInk)','mix(mix(vec3(.12,.015,.45),tkDeep,tintAmount),mix(vec3(.96,.005,.43),tkHot,tintAmount),magInk)'],
 ['mix(yellow,vec3(1.,.51,.025),p.y*.52)','mix(yellow,mix(vec3(1.,.51,.025),tkLight*.75,tintAmount),p.y*.52)'],
 ['vec3(.30,.004,.027)','mix(vec3(.30,.004,.027),tkDark*.4,tintAmount)'],
 ['vec3(.55,.002,.009)','mix(vec3(.55,.002,.009),tkDark*.75,tintAmount)'],
];
const takeover=PALETTE_SWAPS.reduce((src,[from,to])=>{if(src.split(from).length!==2)throw Error('Mẫu màu không khớp takeover.js: '+from);return src.replace(from,to);},takeoverGLSL.replaceAll('edgeTex','toTex'));
function hsl(h,s,l){h=((h%1)+1)%1;const a=s*Math.min(l,1-l),f=n=>{const k=(n+h*12)%12;return l-a*Math.max(-1,Math.min(k-3,9-k,1));};return [f(0),f(8),f(4)];}
// Colours the tear borrows from the incoming scene's average colour.
export function tearPalette([r,g,b]){
 const max=Math.max(r,g,b),min=Math.min(r,g,b),l=(max+min)/2,d=max-min,grey=d<.05;
 let h=0;if(!grey){h=max===r?((g-b)/d+(g<b?6:0)):max===g?(b-r)/d+2:(r-g)/d+4;h/=6;}
 const s=grey?0:Math.max(.55,d/(1-Math.abs(2*l-1)||1));
 return {tkDark:hsl(h,s,.2),tkLight:hsl(h,s,.55),tkAccent:hsl(h+.5,s,.5),tkDeep:hsl(h+.58,s,.22),tkHot:hsl(h+.42,s,.5)};
}
const fragment=`precision highp float;
#define PLATE_STREAK .14
#define PLATE_GRAIN .105
#define PLATE_COL .026
#define PLATE_CX 24.
#define PLATE_CY 13.
#define PLATE_POKE .12
#define PLATE_POKE_PX 18.
varying vec2 uv;
uniform sampler2D fromTex,toTex,signalTex,plateTex;
uniform float texturedPlates;uniform float hasPlates;uniform vec3 plateDim;
uniform float progress,strength,seed,direction,signal,hasMeasured,tintAmount;
uniform vec3 tint,tkDark,tkLight,tkAccent,tkDeep,tkHot;
float hash(vec2 p){vec3 q=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
float ramp(float a,float b,float x){return clamp((x-a)/(b-a),0.,1.);}
float box(float a,float b,float x){return step(a,x)*(1.-step(b,x));}
float pulse(float x,float c,float w){return max(0.,1.-abs(x-c)/w);}
vec3 outgoing(vec2 p){return texture2D(fromTex,clamp(p,0.,1.)).rgb;}
vec3 incoming(vec2 p){return texture2D(toTex,clamp(p,0.,1.)).rgb;}
${takeover}
// Colour plates: fitted vector geometry (assets/takeover-plates.json). Per source frame, per fine row (uploadPlates
// interpolates the 90 fitted bands vertically) and colour class (red, yellow, green, violet) up to 5 runs with
// 16-bit edges (plateTex) plus shade and yellow->orange hue (plateTex2). Edges are interpolated between
// neighbouring source frames when a run exists in both; held after the last fitted frame. On top of that every
// pixel row gets its own scanline-tear jitter (new draw each source frame), 1.4 px soft edges and, inside, streaky
// shading + grain + phosphor columns. plateEval fills the globals once per pixel; measuredPlates only colours them.
uniform sampler2D plateTex2;
vec2 plateXY(float b,float cls,float s,float fr){return vec2((b*20.+cls*5.+s+.5)/plateDim.z,(fr+.5)/plateDim.y);}
vec2 plateEdge(vec4 T){return vec2(T.r*65280.+T.g*255.,T.b*65280.+T.a*255.)/65535.;}
// Signed scanline-tear offset in px (positive = outward): most rows keep the band edge within ~1.5 px, PLATE_POKE of the rows
// poke out (70%) or bite in (30%) by an exponential(PLATE_POKE_PX) streak.
float plateJit(float row,float fr,float id){
 float h1=hash(vec2(row*1.37+id*17.1,fr*3.7+id)),h2=hash(vec2(row+id*5.3+91.7,fr*1.9+id*2.9+13.1)),h3=hash(vec2(row*.73+id*3.1+57.3,fr*5.3+id*.7+29.9));
 float poke=step(h3,PLATE_POKE);
 return mix((h1-.5)*3.,(h2<.7?1.:-1.)*-PLATE_POKE_PX*log(max(1.-h1,1e-4)),poke);
}
vec4 gCov=vec4(0.),gSh=vec4(.8),gHue=vec4(0.);
void plateEval(vec2 q,float t){
 float ft=clamp((t-12.8317)*24.+.001,0.,plateDim.y-1.);float fa=floor(ft),fb=min(fa+1.,plateDim.y-1.),f=fract(ft);
 float b=min(floor(q.y*plateDim.x),plateDim.x-1.);
 float row=floor(q.y*1080.),px=q.x*1920.;
 float left=1921.,right=-1.,nearest=1e6,nearestClass=0.;
 for(int c=0;c<4;c++){float cov=0.,selK=0.,selM=0.;
  for(int k=0;k<5;k++){
   vec2 xy=plateXY(b,float(c),float(k),fa),xz=plateXY(b,float(c),float(k),fb);
   vec2 A=plateEdge(texture2D(plateTex,xy)),B=plateEdge(texture2D(plateTex,xz));
   bool ha=A.y>A.x,hb=B.y>B.x;vec2 e=vec2(0.);float m=0.;
   if(ha&&hb&&abs(A.x-B.x)<.12&&abs(A.y-B.y)<.12){e=mix(A,B,f);m=1.;}
   else if(ha&&f<.5){e=A;m=2.;}
   else if(hb&&f>=.5){e=B;m=3.;}
   if(m>0.){
    e*=1920.;
    left=min(left,e.x);right=max(right,e.y);
    float distance=max(e.x-px,px-e.y);if(distance<nearest){nearest=distance;nearestClass=float(c);}
    float w=e.y-e.x,id=float(c*5+k);
    float j0=plateJit(row,fa,id),j1=plateJit(row,fa,id+20.);
    j0=max(j0,-.4*w);j1=max(j1,-.4*w);
    float v=clamp((px-(e.x-j0))/1.4+.5,0.,1.)*clamp(((e.y+j1)-px)/1.4+.5,0.,1.);
    if(v>cov){cov=v;selK=float(k);selM=m;}
   }
  }
  float sh=.8,hue=0.;
  if(cov>0.){
   vec4 SA=texture2D(plateTex2,plateXY(b,float(c),selK,fa)),SB=texture2D(plateTex2,plateXY(b,float(c),selK,fb));
   vec4 S=selM<1.5?mix(SA,SB,f):(selM<2.5?SA:SB);sh=S.r;hue=S.g;
  }
  gCov[c]=cov;gSh[c]=sh;gHue[c]=hue;
 }
 // Fill classification gaps inside each scanline's plate envelope, never expose the outgoing page there.
 if(texturedPlates>.5&&px>left&&px<right){
  float covered=max(max(gCov.x,gCov.y),max(gCov.z,gCov.w));
  for(int c=0;c<4;c++)if(abs(float(c)-nearestClass)<.1)gCov[c]=max(gCov[c],1.-covered);
 }

}
float plateVN(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y)-.5;}
// Relative brightness texture of the plate surface: horizontal streaks, fine grain, 3.5 px phosphor columns.
float plateSurface(vec2 q,float t){
 vec2 p=q*vec2(1920.,1080.);float fr=floor((t-12.8317)*24.+.001);
 vec2 o=vec2(hash(vec2(fr,7.1)),hash(vec2(fr,3.3)))*500.;
 return PLATE_STREAK*plateVN((p+o)/vec2(PLATE_CX,PLATE_CY))+PLATE_GRAIN*(hash(floor(p)+fr*37.+.5)-.5)+PLATE_COL*sin(6.2831853*p.x/3.5);
}
// Incoming scene: 22px horizontal smear plus sparse 80-240px streaks; no vertical blur.
vec3 plateImage(vec2 q,float t){
 float fr=floor((t-12.8317)*24.);float row=floor(q.y*1080.);
 float tail=(hash(vec2(row,fr))-.5)*480.;
 vec3 c=vec3(0.);float weight=0.;
 for(int i=-4;i<=4;i++){float x=float(i);float w=exp(-x*x/8.);c+=incoming(q+vec2(x*5.5/1920.,0.))*w;weight+=w;}
 return mix(c/weight,incoming(q+vec2(tail/1920.,0.)),.22);
}
vec3 tonePlate(vec3 low,vec3 high,vec3 tintLow,vec3 tintHigh,float l){
 // The source colour fields retain faint title ink; next-scene tint keeps its full tonal range.
 float tone=smoothstep(.025,.88,l);tone=mix(.55+.45*tone,tone,tintAmount);
 return mix(mix(low,tintLow,tintAmount),mix(high,tintHigh,tintAmount),tone);
}
float plateLuma=0.;
vec3 measuredPlates(vec2 q,float t,vec3 bg,vec3 edge){
 vec3 red=mix(vec3(.73,.002,.008),tkDark,tintAmount);
 vec3 green=mix(mix(vec3(.01,.98,.015),vec3(.0,.95,.62),gHue.z),tkAccent,tintAmount);
 vec3 yellow=mix(mix(vec3(1.,.91,.025),tkLight,tintAmount),mix(vec3(1.,.51,.025),tkLight*.75,tintAmount),gHue.y);
 float u=gHue.w;vec3 vio=mix(vec3(0.,.5,.95),vec3(.2,.04,.72),smoothstep(0.,.35,u));vio=mix(vio,vec3(.55,.01,.7),smoothstep(.35,.6,u));vio=mix(vio,vec3(.96,.005,.43),smoothstep(.6,1.,u));
 vec3 violet=mix(vio,mix(tkDeep,tkHot,u),tintAmount);
 float sf=1.+plateSurface(q,t);
 if(texturedPlates>.5){
  float l=plateLuma;
  red=tonePlate(vec3(.24,.003,.012),vec3(.80,.055,.018),tkDark*.24,tkLight*1.45,l);
  yellow=tonePlate(vec3(.20,.085,.006),vec3(.933,.949,.086),tkDark*.42,tkLight*1.7,l);
  green=tonePlate(mix(vec3(.006,.22,.012),vec3(.0,.24,.16),gHue.z),mix(vec3(.015,.98,.025),vec3(.0,.95,.62),gHue.z),tkAccent*.13,tkAccent*1.6,l);
  violet=tonePlate(vio*.24,vio*1.05,tkDeep*.3,tkHot*1.6,l);
 }

 vec3 c=bg;
 c=mix(c,green*(.7+.4*gSh.z)*sf,gCov.z);c=mix(c,violet*(.7+.4*gSh.w)*sf,gCov.w);
 c=mix(c,red*(.7+.4*gSh.x)*sf,gCov.x);c=mix(c,yellow*(.7+.4*gSh.y)*sf,gCov.y);
 float settle=tkRange(14.055,14.16,t);c=mix(c,edge,tkEdge(q.x-(settle*1.4-.05),.012)*settle);
 return mix(clamp(c,0.,1.),edge,tkRange(14.145,14.205,t));
}
vec3 scene(vec2 p,float t){
 if(hasPlates>.5){if(t<14.25)return measuredPlates(uv,t,outgoing(p),incoming(p));return incoming(p);}
 if(t<13.32)return outgoing(p);if(t<14.25)return takeover(p,t,outgoing(p),incoming(p));return incoming(p);}
void main(){
 // Exact endpoints also make adjacent scene segments join without a flash.
 if(progress<=0.){gl_FragColor=vec4(outgoing(uv),1.);return;}
 if(progress>=1.){gl_FragColor=vec4(incoming(uv),1.);return;}
 float t=12.832+progress*1.5;
 float f=floor(t*24.)+seed*13.;
 vec2 p=uv;
 vec3 measured=texture2D(signalTex,vec2((uv.y*1079.+.5)/1080.,(clamp((t-12.8317)/6.867933,0.,1.)*165.+.5)/166.)).rgb;
 float envelope=ramp(12.9,13.2,t)*(1.-ramp(14.21,14.33,t));
 float activity=envelope*.8*strength*signal;
 float row=floor(p.y*1080.);
 float line=hash(vec2(row,f));
 float coarse=hash(vec2(floor(p.y*19.),floor(t*11.)+seed))-.5;
 float shear=(coarse*.075+sin(p.y*18.+t*17.)*.013+(line-.5)*.018)*activity;
 shear+=step(.96,hash(vec2(floor(p.y*83.),f)))*activity*(hash(vec2(f,3.))-.5)*.3;
 p.x+=direction*shear*mix(1.,step(13.332,t),hasMeasured);
 p.x-=direction*(measured.r*255.-128.)*4./1920.*signal*strength*hasMeasured;
 // Vertical-hold roll (frames 33-35): picture slides down by gD with a black sync gap above it (offsets measured).
 float gD=(t>14.13&&t<14.29)?mix(mix(mix(.48,.17,ramp(14.165,14.2067,t)),.07,ramp(14.2067,14.248,t)),0.,ramp(14.248,14.29,t)):0.;gD*=signal*strength;
 p.y-=gD;
 if(hasPlates>.5&&t<14.25)plateEval(uv,t);
 if(texturedPlates>.5)plateLuma=dot(plateImage(p,t),vec3(.2126,.7152,.0722));
 vec3 c=scene(p,t);
 if(signal>.5){
  float chroma=.0015*activity;
  c=vec3(scene(p+vec2(chroma,0.),t).r,c.g,scene(p-vec2(chroma,0.),t).b);
  float edgeLoss=(.006+max(0.,sin(p.y*8.+t*3.))*.026)*ramp(12.94,13.18,t)*strength;
  float edgeX=direction<0.?1.-uv.x:uv.x;
  float torn=step(edgeX+line*.018,edgeLoss)*(1.-step(14.23,t));
  c=mix(c,mix(vec3(.7+line*.25),clamp(tint*(.8+line*.5),0.,1.),tintAmount),torn*.9);
  float fallbackBand=pulse(p.y,fract(progress*1.7),.05)*envelope;
  float band=mix(fallbackBand,measured.b,hasMeasured);
  float cluster=hash(vec2(floor(row/3.),f));
  float snow=step(.74,hash(vec2(floor((p.x+cluster*.004)*115.),floor(row/3.)+f*39.)));
  c=mix(c,mix(vec3(.88,.89,.84),clamp(tint*1.15+.12,0.,1.),tintAmount),clamp(band*3.*strength,0.,1.)*snow);
  if(gD>.01&&uv.y<gD){c=mix(vec3(.012),tint*.08,tintAmount);c=mix(c,mix(vec3(.62),clamp(tint*1.2+.1,0.,1.),tintAmount),step(.93,hash(vec2(floor(p.x*170.),row+f)))*(1.-uv.y/gD*.6));}
  c*=1.+(hash(vec2(floor(gl_FragCoord.x),5.))-.5)*.085;
  c+=(hash(vec2(floor(p.x*1920.),row)+f)-.5)*.035;
  c*=1.-.018*step(.6,fract(gl_FragCoord.y*.5));
 }
 // Ease only the last signal residue; geometry/mask changes retain sharp timing.
 c=mix(c,incoming(uv),smoothstep(.975,1.,progress));
 gl_FragColor=vec4(clamp(c,0.,1.),1.);
}`;

export class SignalTransition{
 constructor(canvas,{signalMap=null,plates=null}={}){
  this.canvas=canvas;this.gl=canvas.getContext('webgl',{alpha:false,antialias:false,preserveDrawingBuffer:true});
  if(!this.gl)throw Error('Trình duyệt này chưa bật WebGL.');
  this.signal=true;this.textures=[];this.probe=Object.assign(document.createElement('canvas'),{width:8,height:8}).getContext('2d',{willReadFrequently:true});this.ready=this.init(signalMap,plates);
 }
 async init(signalMap,plates){
  const gl=this.gl,compile=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
  const vs=compile(gl.VERTEX_SHADER,vertex),fs=compile(gl.FRAGMENT_SHADER,fragment),p=gl.createProgram();
  gl.attachShader(p,vs);gl.attachShader(p,fs);gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));gl.deleteShader(vs);gl.deleteShader(fs);this.program=p;gl.useProgram(p);
  this.uniforms=Object.fromEntries(['fromTex','toTex','signalTex','progress','strength','seed','direction','signal','hasMeasured','plateTex','plateTex2','plateDim','hasPlates','texturedPlates','tint','tintAmount','tkDark','tkLight','tkAccent','tkDeep','tkHot'].map(n=>[n,gl.getUniformLocation(p,n)]));
  this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);const pos=gl.getAttribLocation(p,'position');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL,gl.NONE);
  for(let i=0;i<5;i++){const tx=gl.createTexture();this.textures.push(tx);gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,tx);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([128,0,0,255]));}
  gl.uniform1i(this.uniforms.fromTex,0);gl.uniform1i(this.uniforms.toTex,1);gl.uniform1i(this.uniforms.signalTex,2);gl.uniform1i(this.uniforms.plateTex,3);gl.uniform1i(this.uniforms.plateTex2,4);this.hasMeasured=false;this.hasPlates=false;
  if(signalMap){let image=signalMap;if(typeof image==='string'){image=new Image();image.src=signalMap;await image.decode();}this.upload(2,image);this.hasMeasured=true;}
  if(plates){try{const meta=typeof plates==='string'?await (await fetch(plates)).json():plates;this.uploadPlates(meta);this.hasPlates=true;}catch(err){console.warn('Không nạp được hình học mảng màu, dùng bản viết tay.',err);}}
  this.resize();return this;
 }
 // Expand the fitted band/run geometry into fine-row tables (ROWS rows x 20 slots per source frame):
 // plateTex = 16-bit run edges (x0 hi,x0 lo,x1 hi,x1 lo), plateTex2 = shade, hue (empty slot: x1<=x0).
 // Between band centres every run is interpolated with the run of the neighbouring band it overlaps most (unmatched runs hold),
 // which removes the band staircase; the per-row raggedness is added in the shader.
 uploadPlates({bands,frames,maxRun=5,frameData,xScale=255,shadeScale=15}){
  if(maxRun!==5||frameData.length!==frames)throw Error('Dữ liệu mảng màu không hợp lệ.');
  const ROWS=360,width=ROWS*20,edges=new Uint8Array(width*frames*4),attrs=new Uint8Array(width*frames*4);
  const pick=(runs,run)=>{let best=null,bo=0;for(const r of runs){const o=Math.min(r[1],run[1])-Math.max(r[0],run[0]);if(o>bo){bo=o;best=r;}}return best;};
  frameData.forEach((rows,f)=>{for(let r=0;r<ROWS;r++){
   const u=(r+.5)/ROWS*bands-.5,b0=Math.max(0,Math.min(bands-1,Math.floor(u))),b1=Math.min(bands-1,b0+1);
   const near=u-b0<.5?b0:b1,far=near===b0?b1:b0,t=Math.min(.5,Math.abs(u-near));
   for(let c=0;c<4;c++){rows[near][c].forEach((run,k)=>{
    const m=pick(rows[far][c],run),L=(a,z)=>m?a+(z-a)*t:a;
    const x0=L(run[0],m&&m[0]),x1=L(run[1],m&&m[1]),sh=L(run[2],m&&m[2]),hu=L(run[3],m&&m[3]);
    const o=((f*width)+r*20+c*5+k)*4,X0=Math.round(x0/xScale*65535),X1=Math.round(x1/xScale*65535);
    edges[o]=X0>>8;edges[o+1]=X0&255;edges[o+2]=X1>>8;edges[o+3]=X1&255;
    attrs[o]=Math.round(sh/shadeScale*255);attrs[o+1]=Math.round(hu/15*255);
   });}
  }});
  const gl=this.gl,put=(unit,index,data)=>{gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,this.textures[index]);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
   gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,width,frames,0,gl.RGBA,gl.UNSIGNED_BYTE,data);};
  put(3,3,edges);put(4,4,attrs);this.plateDim=[ROWS,frames,width];
 }
 upload(index,source){const gl=this.gl;gl.activeTexture(gl.TEXTURE0+index);gl.bindTexture(gl.TEXTURE_2D,this.textures[index]);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);}
 resize(width=Math.round(this.canvas.clientWidth*(globalThis.devicePixelRatio||1))||this.canvas.width,height=Math.round(width*9/16)){this.canvas.width=Math.max(1,Math.min(1920,width));this.canvas.height=Math.max(1,Math.round(height*this.canvas.width/width));this.gl.viewport(0,0,this.canvas.width,this.canvas.height);}
 // Average colour of the incoming scene; the tear takes its palette from it.
 averageColor(source){const c=this.probe;c.drawImage(source,0,0,8,8);const d=c.getImageData(0,0,8,8).data;let r=0,g=0,b=0;for(let i=0;i<d.length;i+=4){r+=d[i];g+=d[i+1];b+=d[i+2];}const n=d.length/4*255;return [r/n,g/n,b/n];}
 render({from,to,progress,strength=1,seed=0,direction=1,tint=0,texturedPlates=false}){
  if(!from||!to)throw TypeError('Chuyển cảnh cần cả cảnh trước và cảnh sau.');
  if(!Number.isFinite(progress))throw TypeError('Tiến độ chuyển cảnh phải là số hữu hạn.');
  const gl=this.gl,u=this.uniforms;gl.useProgram(this.program);gl.uniform1f(u.texturedPlates,texturedPlates?1:0);this.upload(0,from);
  if(to!==from){this.upload(1,to);gl.uniform1i(u.toTex,1);}else gl.uniform1i(u.toTex,0);
  gl.uniform1f(u.progress,Math.max(0,Math.min(1,progress)));gl.uniform1f(u.strength,Math.max(0,Math.min(2,strength)));gl.uniform1f(u.seed,seed);gl.uniform1f(u.direction,direction<0?-1:1);gl.uniform1f(u.signal,this.signal?1:0);gl.uniform1f(u.hasMeasured,this.hasMeasured?1:0);gl.uniform1f(u.hasPlates,this.hasPlates?1:0);if(this.hasPlates)gl.uniform3fv(u.plateDim,this.plateDim);
  const amount=Math.max(0,Math.min(1,tint))*(to!==from&&progress>0&&progress<1?1:0);gl.uniform1f(u.tintAmount,amount);const average=amount?this.averageColor(to):[0,0,0],palette=amount?tearPalette(average):{tkDark:average,tkLight:average,tkAccent:average,tkDeep:average,tkHot:average};
  gl.uniform3fv(u.tint,average);for(const name in palette)gl.uniform3fv(u[name],palette[name]);gl.drawArrays(gl.TRIANGLES,0,6);
 }
 destroy(){for(const shader of this.gl.getAttachedShaders(this.program)||[])this.gl.deleteShader(shader);for(const t of this.textures)this.gl.deleteTexture(t);this.gl.deleteBuffer(this.buffer);this.gl.deleteProgram(this.program);}
}
