import {drawPreset} from './scenes.js';
import {sampleNeonMotion,files as neonFiles} from './assets/neon-motion.js';
import {takeoverGLSL} from './takeover.js';
// Time-based reconstruction, with a measured brightness correction for source frames 81–110.
export const START=12.832, END=19.699633, DURATION=END-START;
// Logo overload (source frames 65-72): logo placement, blur direction/length, opacity and glare per source frame,
// fitted to the recording; linearly interpolated between frame times. [source s, x, y, width, blurAngle, blurLen, alpha, glare]
export const OVERLOAD=[[15.4983,-0.12,0.2,1.3,0,0,0,0,0],[15.54,-0.103,0.525,1.409,1.566,0.296,0.563,0,0],[15.5817,0.038,0.517,1.224,1.213,0.226,1.28,0,0],[15.6234,0.107,-0.446,2.245,-0.217,0.787,1.4,0,0],[15.665,0.15,-0.13,1.628,-1.57,0.105,0.723,0.035,0.0],[15.7067,-0.202,-0.185,2.204,-1.57,0.514,0.996,0,0.248],[15.7484,0.046,-0.089,1.46,-0.415,0.565,1.4,0.03,0.241],[15.77,0.046,-0.089,1.46,-0.415,0.565,0,0,0],[15.81,0.046,-0.089,1.46,-0.415,0.565,0,0,0]];
export function sampleOverload(t){const k=OVERLOAD;if(t<=k[0][0])return k[0].slice(1);for(let i=1;i<k.length;i++)if(t<=k[i][0]){const a=k[i-1],b=k[i],u=(t-a[0])/(b[0]-a[0]);return a.slice(1).map((v,j)=>v+(b[j+1]-v)*u);}return k.at(-1).slice(1);}
// Measured RGB offsets in 8 horizontal bands, frames 81–110 at 24fps.
// Recording overlays excluded; source minus pre-correction reconstruction, in 8-bit RGB levels.
// Held per source frame (no temporal interpolation): preserves TV brightness fluctuations.
export const BOUNCE_BRIGHTNESS=[[[2.6412,-0.8199,2.3541],[0.7914,-1.4675,1.2926],[3.5716,0.406,0.7288],[6.6466,4.7303,-4.2597],[2.9065,2.1506,-3.7614],[4.1762,7.6749,0.7618],[0.6757,8.6435,0.5706],[1.6735,8.056,1.3739]],[[2.483,-0.8319,2.2789],[0.8994,-1.442,1.4637],[5.4857,1.7069,2.1907],[6.8001,4.5008,-4.0151],[2.941,2.3201,-3.0657],[1.2379,7.1089,-1.8784],[-3.5993,8.6132,-5.6922],[-1.904,8.792,-4.204]],[[1.3948,-0.6766,1.981],[-0.6513,-1.4097,0.7023],[3.743,0.7809,1.614],[2.4469,1.4737,-5.2377],[1.881,2.0786,-1.9657],[4.2506,7.348,2.4094],[4.2439,8.989,5.8805],[8.5065,7.8804,10.6213]],[[1.3949,-0.6617,1.9948],[-0.5961,-1.4174,0.7973],[5.1452,1.579,2.2241],[7.4673,3.6335,-3.8269],[7.8934,2.9718,2.1133],[6.6547,7.5522,5.3706],[2.3449,9.0358,2.8153],[2.9978,9.43,2.618]],[[1.5688,-0.7313,2.0003],[-0.4667,-1.4409,0.8637],[6.1358,2.0824,2.7887],[5.9588,2.9942,-3.9161],[3.5179,2.6379,-0.9855],[2.0161,6.1135,-0.3751],[-1.8831,7.8589,-3.3879],[1.4742,9.3761,0.2189]],[[1.1715,-0.6903,1.7212],[-0.7287,-1.4336,0.6719],[4.0915,0.7085,1.9437],[1.181,-0.224,-5.643],[5.1372,2.7989,0.2679],[6.2066,6.817,5.1355],[6.367,8.8862,8.2256],[9.2289,9.2875,11.133]],[[1.1396,-0.7421,1.5363],[-0.8417,-1.3963,0.6219],[7.1692,2.6586,3.0708],[6.8429,2.1832,-3.4051],[9.7965,3.8428,3.8261],[5.8746,6.4644,4.8883],[1.7863,7.786,1.8337],[4.0854,9.2686,3.5582]],[[1.8387,-0.8536,1.7848],[-0.5235,-1.3901,0.6952],[7.1896,2.56,2.9426],[2.3502,0.1542,-4.7107],[3.9805,2.4646,0.1023],[1.9922,4.7621,0.1244],[-0.3895,6.6591,-0.8608],[3.7091,8.8404,3.1953]],[[1.1041,-0.8485,1.2485],[-1.2725,-1.1159,0.3565],[4.6447,1.239,1.3636],[0.8946,-1.6057,-5.4455],[7.6703,3.4231,2.5742],[7.1176,6.1699,7.0193],[5.9537,7.9223,7.7501],[7.8769,9.2734,9.0552]],[[0.9275,-0.8578,1.1626],[-1.1285,-1.1169,0.4672],[8.1252,3.3415,1.9633],[5.333,0.2004,-3.6721],[9.7492,4.0595,4.2263],[4.082,4.8896,3.5724],[1.0378,6.2934,1.3368],[3.6352,8.1392,3.15]],[[1.9249,-0.9593,1.4804],[-0.7535,-1.098,0.6771],[6.7998,1.9726,1.233],[-0.165,-2.6437,-5.1341],[4.6568,2.1001,1.5492],[2.1981,3.3188,0.9375],[0.5144,5.7216,0.6512],[3.9111,7.7121,3.6919]],[[0.5651,-1.2004,0.8581],[-1.0738,-1.1857,0.6385],[5.7187,0.9568,0.3099],[4.2132,-1.3503,-3.4045],[8.6396,3.5241,4.7991],[7.0254,5.3447,7.2202],[4.5707,6.5118,6.0031],[5.6294,7.6979,6.0019]],[[0.6147,-1.1198,0.9088],[-0.5819,-1.0015,0.9684],[9.2305,3.3165,1.063],[6.6881,-0.222,-2.111],[7.1477,2.6085,3.8061],[2.9952,2.9716,2.1269],[0.4808,4.7401,0.9059],[3.3433,6.867,3.0901]],[[0.3281,-1.2637,0.6363],[-1.4585,-1.1474,0.3156],[4.2048,-0.1634,-1.2282],[-1.5675,-2.9805,-5.2516],[4.2515,1.1593,2.1806],[4.6978,3.5187,4.2314],[5.8987,6.2588,7.6455],[9.8803,8.0138,10.763]],[[0.0886,-1.3374,0.4602],[-1.6145,-1.1706,0.2526],[5.6616,0.6244,-1.2675],[3.8046,-2.1622,-3.1012],[7.2142,2.1627,4.5621],[5.4951,3.658,5.3279],[2.5422,4.5972,3.308],[3.879,6.1826,3.9489]],[[1.4771,-0.9841,0.7465],[0.9999,-0.5435,0.8844],[9.9057,3.2398,-0.4287],[3.4012,-2.2488,-2.9797],[3.4559,0.5068,1.9581],[0.8677,1.29,1.0697],[-0.3856,3.3131,0.5896],[1.874,5.4098,2.132]],[[0.2711,-0.9399,0.0562],[-1.5408,-0.7782,-0.2909],[4.6473,-0.1178,-2.2963],[-1.642,-3.4289,-4.3387],[3.5754,0.4719,2.6222],[4.1845,2.693,4.3688],[4.8244,4.9778,6.1532],[6.147,6.3101,7.037]],[[0.0654,-1.005,-0.1416],[-0.8741,-0.5628,-0.0801],[8.1923,2.0006,-1.7481],[4.7235,-2.3103,-2.0386],[5.3293,1.0443,3.7249],[2.8527,1.8477,3.1377],[0.2472,2.7295,1.471],[1.5302,4.3421,1.7494]],[[2.417,-0.8473,1.2555],[2.4571,0.0803,1.1757],[9.0692,2.3269,-2.0651],[3.3026,-2.5953,-1.9025],[2.2605,0.0432,1.4773],[0.733,0.8013,0.7589],[-0.342,1.8713,0.6929],[1.2111,3.5018,1.5514]],[[0.2635,-0.7194,0.1102],[-0.927,-0.4264,-0.2569],[2.6339,-0.9058,-3.7412],[1.625,-2.7025,-2.0719],[3.9698,-0.0559,3.2135],[4.7819,2.02,4.4802],[4.3146,3.4425,4.9703],[4.1051,3.9768,5.0737]],[[-0.1032,-0.879,-0.2002],[0.5871,0.1042,0.0228],[8.1029,1.4574,-2.6456],[7.2743,-1.785,0.5118],[5.0897,0.1684,4.2169],[2.5333,0.7349,2.8584],[0.6055,1.0892,1.8746],[2.37,2.0879,2.5513]],[[2.9838,-1.1154,1.2184],[3.5786,0.4464,0.8424],[6.1295,0.5282,-3.4262],[1.1975,-2.6223,-1.8497],[1.3374,-0.4302,1.7689],[0.7073,-0.065,1.5075],[0.1645,0.3354,1.4233],[1.6144,1.4514,2.7468]],[[0.1584,-0.706,0.0738],[-0.5129,-0.2964,-0.847],[1.0855,-2.3773,-4.8812],[2.5151,-2.3595,-1.184],[4.3931,-0.3364,3.6233],[4.0906,0.2491,3.9523],[2.6502,0.541,3.3316],[3.0209,1.2821,4.1317]],[[0.8628,-0.7322,0.4175],[3.4048,1.2339,0.5577],[5.8004,-0.6529,-4.1583],[5.8162,-1.6998,-0.0816],[3.2324,-0.3269,2.9067],[1.8607,-0.3797,2.6969],[1.2783,-0.0589,2.4138],[2.6305,0.5382,3.3517]],[[0.2022,-0.6513,0.1228],[-0.243,-0.3149,-1.3199],[-1.353,-3.3485,-6.0854],[1.0286,-1.5665,-1.0521],[2.1958,-0.2266,2.0935],[2.9229,-0.5892,3.4241],[3.7793,-0.0218,4.1893],[5.816,1.3169,5.7364]],[[-0.2241,-0.8366,-0.4563],[-0.4279,-0.3892,-2.086],[-0.6849,-3.7008,-6.1434],[5.3835,-0.9445,0.9862],[5.2968,-0.0664,3.8431],[4.0898,-0.477,3.7333],[2.5565,-0.563,3.1915],[2.5359,-0.3302,3.0479]],[[0.3946,-0.8926,-0.0371],[3.9688,1.5836,-1.1061],[4.1441,-1.9955,-5.2887],[6.2545,-0.2592,1.8952],[3.912,0.0068,3.3953],[1.6569,-0.292,2.169],[1.1701,-0.6346,2.1648],[2.8526,-0.4006,3.4124]],[[-0.2261,-0.7746,-0.3451],[-0.9131,-1.0635,-2.7417],[-0.1036,-3.1065,-5.5043],[1.9868,-0.4915,1.0267],[3.2253,-0.1753,3.2671],[3.2371,-0.4549,3.0738],[3.323,-0.6459,3.8211],[4.1382,-0.5532,4.3415]],[[-0.2867,-0.7442,-0.2361],[-0.364,-0.8947,-3.2352],[2.5032,-2.5978,-4.5107],[4.6324,-0.4079,2.3273],[5.1082,-0.305,4.3495],[2.8227,-0.429,3.0961],[1.4692,-0.3947,2.3161],[2.12,-0.2509,2.9294]],[[1.1025,-0.8034,0.0941],[4.902,1.9292,-2.4051],[5.6544,-1.5754,-3.6525],[3.4383,-0.3262,1.5471],[2.1105,-0.333,2.4428],[0.1956,-0.4057,1.604],[0.392,-0.3882,1.6409],[1.2572,-0.2946,2.3909]]];
function bounceBrightness(t,enabled){
 const k=Math.floor(t*24+1e-6)+1;
 if(!enabled||k<81||k>116)return new Float32Array(24);
 const row=BOUNCE_BRIGHTNESS[Math.min(k,110)-81],fade=k<=110?1:Math.max(0,(116-k)/6);
 return new Float32Array(row.flat().map(v=>v*fade/255));
}
const vertex=`attribute vec2 position;varying vec2 uv;void main(){uv=vec2((position.x+1.)*.5,(1.-position.y)*.5);gl_Position=vec4(position,0.,1.);}`;
const fragment=`precision highp float;
uniform vec3 bounceLift[8];
varying vec2 uv;uniform sampler2D backgroundTex,edgeTex,poseA,poseB,logoTex,signalTex;
uniform mat3 topA,topB,bottomA,bottomB;uniform float time,signal,morph,embeddedIntro;uniform vec2 resolution;uniform vec4 ovA,ovB,ovC;
float hash(vec2 p){vec3 q=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
float ramp(float a,float b,float x){return clamp((x-a)/(b-a),0.,1.);}
float box(float a,float b,float x){return step(a,x)*(1.-step(b,x));}
float pulse(float x,float c,float width){return max(0.,1.-abs(x-c)/width);}
vec3 background(vec2 p){return texture2D(backgroundTex,clamp(p,0.,1.)).rgb;}
vec4 logo(vec2 p,vec2 origin,vec2 size){vec2 q=(p-origin)/size;if(q.x<0.||q.x>1.||q.y<0.||q.y>1.)return vec4(0.);return texture2D(logoTex,q);}
vec3 edge(vec2 p,float t){vec2 q=p;q.y+=.014*sin((t-14.25)*8.);vec3 c=texture2D(edgeTex,clamp(q,0.,1.)).rgb;if(t>14.2){c*=1.+.42*smoothstep(.68,.95,q.y)*ramp(14.2,14.3,t);vec3 lc=vec3(0.157,0.063,0.082);lc=mix(lc,vec3(0.110,0.047,0.106),ramp(14.2067,14.2900,t));lc=mix(lc,vec3(0.114,0.051,0.114),ramp(14.2900,14.3734,t));lc=mix(lc,vec3(0.122,0.129,0.204),ramp(14.3734,14.4150,t));lc=mix(lc,vec3(0.263,0.094,0.118),ramp(14.4150,14.4567,t));lc=mix(lc,vec3(0.239,0.051,0.082),ramp(14.4567,14.4984,t));lc=mix(lc,vec3(0.259,0.047,0.078),ramp(14.4984,14.5400,t));lc=mix(lc,vec3(0.345,0.039,0.067),ramp(14.5400,14.5817,t));lc=mix(lc,vec3(0.341,0.035,0.067),ramp(14.5817,14.6234,t));lc=mix(lc,vec3(0.420,0.016,0.039),ramp(14.6234,14.6650,t));lc=mix(lc,vec3(0.467,0.012,0.031),ramp(14.6650,14.7067,t));lc=mix(lc,vec3(0.529,0.008,0.024),ramp(14.7067,14.7484,t));float ink=1.-smoothstep(.16,.43,dot(c,vec3(.3,.59,.11)));c=mix(c,lc,ink*.95);}return c;}
${takeoverGLSL}
vec3 neon(vec2 p,float t){vec3 pt=vec3(p,1.);float row=smoothstep(.4444,.47685,p.y);vec2 qa=mix((topA*pt).xy,(bottomA*pt).xy,row);vec2 qb=mix((topB*pt).xy,(bottomB*pt).xy,row);vec3 a=texture2D(poseA,clamp(qa,0.,1.)).rgb;vec3 b=texture2D(poseB,clamp(qb,0.,1.)).rgb;return mix(a,b,smoothstep(.35,.65,morph));}
// Lilac/white torn blocks that trail the collapsing yellow field (frames 73-77, positions measured per frame).
vec4 lilac(vec2 p,float t){float k=floor((t-12.8317)*24.+.001)+1.;vec4 r=vec4(0.);vec3 L=vec3(.74,.64,.80),D=vec3(.42,.18,.48);
 if(k<=73.){r=mix(r,vec4(.9,.84,.9,1.),tkRect(p,vec2(.91,.42),vec2(1.,.55)));r=mix(r,vec4(mix(L,D,smoothstep(.55,.74,p.y)),1.),tkRect(p,vec2(.89,.55),vec2(1.,.74)));}
 else if(k<=74.){r=mix(r,vec4(.86,.80,.88,1.),tkRect(p,vec2(.88,.45),vec2(.99,.52)));r=mix(r,vec4(mix(L,D,smoothstep(.55,.72,p.y)),1.),tkRect(p,vec2(.88,.55),vec2(.99,.72)));}
 else if(k<=75.){r=mix(r,vec4(.80,.74,.84,1.),tkRect(p,vec2(.92,.43),vec2(.99,.50)));r=mix(r,vec4(L*.8,1.),tkRect(p,vec2(.96,.68),vec2(1.,.77)));}
 else if(k<=77.){r=mix(r,vec4(.78,.72,.82,1.),tkRect(p,vec2(.87+(p.y-.17)*.5,.17),vec2(.99,.25)));r=mix(r,vec4(L*.8,1.),tkRect(p,vec2(.95,.62),vec2(1.,.77)));}
 return r;}
vec3 lastGlow(vec2 p,float t){float fade=t<16.12?1.:exp(-(t-16.12)/.55)*(1.-ramp(16.9,17.5,t));return vec3(.35,.01,.47)*pow(clamp(p.y/.94,0.,1.2),2.2)*clamp(1.-.63*p.x,0.,1.)*fade;}
// INFERRED (no source evidence after source frame 165 / t=19.6996): after the last measured segment the logo keeps its
// velocity and reflects off the four screen walls (speed kept, velocity component mirrored). Wall limits are the opaque
// bbox of logo.svg in the 960x240 texture (x 31..947, y 13..232): right edge in [916,1920], bottom edge in [219,1080].
// The folded (triangle-wave) coordinate is the identity while the logo stays inside, so t<=19.6996 is unchanged.
float bounceFold(float x,float lo,float hi){float s=(x-lo)/(hi-lo),m=mod(s,2.);m=m>1.?2.-m:m;return lo+m*(hi-lo);}
vec3 lastScene(vec2 p,float t){vec3 c=vec3(.065,.004,.017);c+=lastGlow(p,t);float right,bottom;float tt=max(t,16.04);if(t<17.4566){right=353.9237*tt-4259.3125;bottom=-188.5892*tt+3662.1831;}else if(t<18.2899){right=-295.6532*t+7078.6144;bottom=-182.5634*t+3557.4194;}else{right=-349.6200*t+8064.4464;bottom=166.5751*t-2828.4163;if(t>19.6996){right=bounceFold(right,916.,1920.);bottom=bounceFold(bottom,219.,1080.);}}vec2 size=vec2(960.,240.)/vec2(1920.,1080.);vec2 pos=(vec2(right,bottom)-vec2(947.,232.))/vec2(1920.,1080.);
if(t<16.04){vec2 o=vec2(-87.,115.);o=mix(o,vec2(-75.,75.),ramp(15.832,15.873,t));o=mix(o,vec2(-63.,36.),ramp(15.873,15.915,t));o=mix(o,vec2(-32.,16.),ramp(15.915,15.957,t));o=mix(o,vec2(-15.,8.),ramp(15.957,15.998,t));o=mix(o,vec2(0.,0.),ramp(15.998,16.04,t));pos+=o/vec2(1920.,1080.);}
vec4 l=logo(p,pos,size);c=mix(c,l.rgb,l.a);
return c;}
// EDGE->neon: the neon wireframe is overlaid in rectangular windows (right column from frame 43, left strip growing
// into a full-neon block at frames 45-46); window edges measured from the source. Fill darkens in at 47.
vec3 revealMix(vec2 p,float t,vec3 e,vec3 n){
 float k=floor((t-12.8317)*24.+.001)+1.;
 if(t>=14.73)return n*mix(.5,1.,ramp(14.76,14.79,t));
 vec3 nw=neon((p-vec2(.5))*1.7+vec2(.5),t);
 float wire=smoothstep(.30,.5,min(nw.r,nw.b));float face=smoothstep(.45,.7,nw.r)*(1.-smoothstep(.35,.55,nw.g));
 float right=tkRect(p,vec2(.68,0.),vec2(1.,1.));
 float left=k<=43.?tkRect(p,vec2(0.,.42),vec2(.09,.8)):k<=44.?tkRect(p,vec2(0.,.45),vec2(.10,.75)):0.;
 float block=k<=44.?0.:k<=45.?max(tkRect(p,vec2(0.,0.),vec2(.09,1.)),tkRect(p,vec2(.09,.55),vec2(.29,1.))):tkRect(p,vec2(0.,0.),vec2(.12,1.));
 float w=max(max(right,left),block);vec3 c=e;
 c=mix(c,e*vec3(.5,.62,.55),w*.5);
 c=mix(c,nw,face*w*.45);c=mix(c,nw*1.1,wire*w*.95);
 c=mix(c,mix(c,n*.9,.55),block);
 return c;}
vec3 scene(vec2 p,float t){
vec3 bg=background(p);if(embeddedIntro<.5&&t<14.25)return edge(p,t);if(t<13.32)return bg;
if(t<14.25)return takeover(p,t,bg,edge(p,t));
vec3 e=edge(p,t);if(t<14.57)return e;
vec3 n=neon(p,t);if(t<14.79)return revealMix(p,t,e,n);
if(t<15.81){n=n*(1.+ovC.x)+ovC.x*.12;if(ovB.w>0.){vec2 dir=vec2(cos(ovB.x),sin(ovB.x))*ovB.y;vec4 acc=vec4(0.);for(int i=0;i<12;i++){float s=float(i)/11.-.5;vec4 l=logo(p+dir*s,ovA.xy,ovA.zw);acc+=vec4(l.rgb*l.a,l.a);}acc/=12.;vec3 col=acc.rgb/max(acc.a,.001);col=mix(vec3(.1,1.,.02),vec3(1.,.95,.02),smoothstep(.35,.7,col.g));col=mix(col,vec3(1.,.86,.8),ovC.y);n+=col*acc.a*ovB.w;}return n;}
vec3 c=lastScene(p,t);if(t<16.08){float frontier=1.-ramp(15.85,15.962,t);float rowN=floor(p.y*1080./3.);float comb=(hash(vec2(rowN,floor(t*24.)))-.5)*.11*step(.02,frontier)*(1.-step(.97,frontier));float wave=sin(p.y*7.+3.)*.03*step(.02,frontier);float mask=step(p.x,frontier+comb+wave*(1.-frontier));vec3 gold=vec3(.38,.30,.02);float stripes=1.+(hash(vec2(floor(p.x*1920.),7.))-.5)*.42*(1.-ramp(15.92,15.99,t));c-=lastGlow(p,t)*mask*.95;c=mix(c,c+gold,mask*.9)*mix(1.,stripes,step(t,15.99));if(t<16.04){vec4 b=lilac(p,t);c=mix(c,b.rgb,b.a*(1.-mask*step(p.x,frontier-.04)));}}return c;
}
void main(){float t=START_REPLACE+time;float f=floor(t*24.);vec2 p=uv;vec3 measured=texture2D(signalTex,vec2((uv.y*1079.+.5)/1080.,(clamp((t-12.8317)/6.867933,0.,1.)*165.+.5)/166.)).rgb;
float introGate=1.-(1.-embeddedIntro)*(1.-step(14.34,t));
float activity=(ramp(12.9,13.2,t)*(1.-ramp(14.21,14.33,t))*.8+(box(14.59,14.72,t)*.05+box(14.72,14.79,t)*.35)+box(15.77,15.81,t)*.1)*signal*introGate;
float row=floor(p.y*1080.);float line=hash(vec2(row,f));float coarse=hash(vec2(floor(p.y*19.),floor(t*11.)))-.5;
float shear=(coarse*.075+sin(p.y*18.+t*17.)*.013+(line-.5)*.018)*activity;
float narrow=step(.96,hash(vec2(floor(p.y*83.),f)))*activity;shear+=narrow*(hash(vec2(f,3.))-.5)*.3;
p.x+=shear*step(13.332,t);p.x-=(measured.r*255.-128.)*4./1920.*signal*introGate;
// Broad analogue roll, including the black sync interval and ragged white return.
float roll=0.;if(t>14.13&&t<14.30)roll=(14.30-t)*3.;if(t>15.748&&t<15.86)roll=.39*ramp(15.748,15.79,t)+.51*ramp(15.795,15.832,t);
p.y=fract(p.y+roll*signal*introGate);
float gR=0.;if(t>14.72&&t<14.79)gR=min(.6,.37*(14.79-t)/.0375);
float gB=2.;if(t>15.748&&t<15.86)gB=t<15.795?mix(1.,.87,ramp(15.748,15.795,t)):mix(.87,.055,ramp(15.795,15.832,t))-.105*ramp(15.832,15.86,t);
vec3 c;if(gR>0.){if(uv.y>=gR)c=scene(vec2(p.x,uv.y-gR),t);else if(uv.y>gR-.235){float dens=uv.y<gR-.17?.5:.1;c=vec3(.01)+vec3(.8)*step(1.-dens,hash(vec2(floor(p.x*170.),row+f)))*step(.15,uv.y);c=mix(c,vec3(.78),tkRect(vec2(uv.x,uv.y),vec2(.555,gR-.14),vec2(.62,gR-.01))*.9);}else c=scene(vec2(p.x,uv.y+1.235-gR),t-.04);}else if(gB<1.5){c=uv.y>gB?scene(vec2(p.x,uv.y),max(t,15.82)):scene(p,t);if(uv.y>gB-.055&&uv.y<=gB)c=vec3(.012,0.,.012);float rag=step(.62,hash(vec2(floor(p.x*170.),row+f)))*pulse(uv.y,gB-.085,.035);c=mix(c,vec3(.85),rag*.85*step(uv.y,gB-.05));}else c=scene(p,t);
if(signal>.5&&introGate>.5){
 float chroma=.0015*activity*(gB<1.5?0.:1.);if(gB>1.5&&gR<=0.){vec3 r=scene(p+vec2(chroma,0.),t);vec3 b=scene(p-vec2(chroma,0.),t);c=vec3(r.r,c.g,b.b);}
 float edgeLoss=0.;if(t<14.23)edgeLoss=(.006+max(0.,sin(p.y*8.+t*3.))*.026)*ramp(12.94,13.18,t);else if(t>15.81&&t<16.12)edgeLoss=.07*(1.-ramp(15.85,16.12,t));
 float torn=step(uv.x+line*.018,edgeLoss)*(1.-step(14.23,t))+step(1.-edgeLoss+line*.025,uv.x)*box(15.81,16.12,t);
 float edgeShade=t>15.81?mix(.07,.80,box(.32,.74,p.y)): .7+line*.25;
 c=mix(c,vec3(edgeShade),torn*.9);
 float band=measured.b;float staticActive=1.;
 float cluster=hash(vec2(floor(row/3.),f));
 float snow=step(.74,hash(vec2(floor((p.x+cluster*.004)*115.),floor(row/3.)+f*39.)));
 c=mix(c,vec3(.88,.89,.84),clamp(band*staticActive*3.,0.,1.)*snow);
 if(roll>.05&&(t<15.74||t>15.87)&&uv.y<roll*.72){c*=.06;float s=step(.65,hash(vec2(floor(p.x*170.),row+f)));c=mix(c,vec3(.8),s*pulse(uv.y,roll*.25,.055));}
 float phosphor=(hash(vec2(floor(gl_FragCoord.x),5.))-.5)*.085;float grain=(hash(vec2(floor(p.x*1920.),row)+f)-.5)*.035;
 c*=1.+phosphor;c+=grain;
 c*=1.-.018*step(.6,fract(gl_FragCoord.y*.5));
 c+=vec3(.015,.002,.008)*(sin(p.y*21.+t)+1.)*.5;
 }
 // Blend adjacent measured bands spatially; never interpolate between source frames.
 float by=clamp(uv.y*8.-.5,0.,7.);vec3 lift=vec3(0.);
 for(int i=0;i<8;i++)lift+=bounceLift[i]*max(0.,1.-abs(by-float(i)));
 c+=lift;
 gl_FragColor=vec4(clamp(c,0.,1.),1.);
}`.replace('START_REPLACE',String(START));

function canvas(){const c=document.createElement('canvas');c.width=1920;c.height=1080;return c;}
async function load(url){const im=new Image();im.src=url;await im.decode();if(url.endsWith('.svg')){const c=document.createElement('canvas');c.width=url.endsWith('logo.svg')?960:1920;c.height=url.endsWith('logo.svg')?240:1080;c.getContext('2d').drawImage(im,0,0,c.width,c.height);return c;}return im;}
export class TransitionEffect{
 constructor(target,{assetRoot='./assets/',embeddedIntro=true,sourceFramesOnly=false}={}){this.canvas=target;this.assetRoot=assetRoot;this.signal=true;this.embeddedIntro=embeddedIntro;this.sourceFramesOnly=sourceFramesOnly;this.background=canvas();this.ctx=this.background.getContext('2d');this.mode='architecture';this.gl=target.getContext('webgl',{alpha:false,antialias:false,preserveDrawingBuffer:true});if(!this.gl)throw Error('Trình duyệt này chưa bật WebGL.');this.textures=[];this.ready=this.init();}
 async init(){const gl=this.gl;function compile(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
 const p=gl.createProgram();gl.attachShader(p,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(p,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));gl.useProgram(p);this.program=p;
 const b=gl.createBuffer();this.buffer=b;gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);const a=gl.getAttribLocation(p,'position');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);
 gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL,gl.NONE);const names=['backgroundTex','edgeTex','poseA','poseB','logoTex','signalTex'];for(let i=0;i<names.length;i++){const tx=gl.createTexture();this.textures.push(tx);gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,tx);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.uniform1i(gl.getUniformLocation(p,names[i]),i);}
 this.upload(5,await load(this.assetRoot+'signal-map.png'));
 const [edge,logo]=await Promise.all(['edge-scene.svg','logo.svg'].map(n=>load(this.assetRoot+n)));
 this.poses=this.sourceFramesOnly?neonFiles.map(()=>this.background):await Promise.all(neonFiles.map(n=>load(this.assetRoot+n)));
 this.edge=canvas();const c=this.edge.getContext('2d');
 c.drawImage(edge,0,0,1920,1080);this.upload(1,this.edge);this.upload(4,logo);this.drawBackground(0);this.upload(0,this.background);this.resize();this.render(0);return this;}
 upload(i,source){const gl=this.gl;gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,this.textures[i]);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);}
 resize(){const w=Math.min(1920,Math.round(this.canvas.clientWidth*devicePixelRatio)||1920);this.canvas.width=w;this.canvas.height=Math.round(w*9/16);this.gl.viewport(0,0,this.canvas.width,this.canvas.height);}
 setBackground(source){if(this.media?.tagName==='VIDEO')this.media.pause();this.media=source;this.mode=typeof source==='string'?source:'media';this.dirty=true;}
 drawBackground(t){const c=this.ctx,w=1920,h=1080;c.clearRect(0,0,w,h);if(this.mode==='media'&&this.media){const im=this.media,iw=im.videoWidth||im.naturalWidth||im.width,ih=im.videoHeight||im.naturalHeight||im.height;if(iw&&ih){const s=Math.max(w/iw,h/ih);c.drawImage(im,(w-iw*s)/2,(h-ih*s)/2,iw*s,ih*s);}return;}
 drawPreset(c,this.mode,t);}
 render(t){const gl=this.gl;if(this.mode==='orbital'||this.media?.tagName==='VIDEO'||this.media?.tagName==='CANVAS'||this.dirty){this.drawBackground(t);this.upload(0,this.background);this.dirty=false;}const motion=sampleNeonMotion(t+START),idx=motion.index;if(this.pair!==idx){this.pair=idx;this.upload(2,this.poses[idx]);this.upload(3,this.poses[idx+1]);}gl.useProgram(this.program);gl.uniform3fv(gl.getUniformLocation(this.program,'bounceLift[0]'),bounceBrightness(t,this.signal));gl.uniform1f(gl.getUniformLocation(this.program,'morph'),motion.progress);for(const [name,value] of [['topA',motion.top.outgoing],['topB',motion.top.incoming],['bottomA',motion.bottom.outgoing],['bottomB',motion.bottom.incoming]])gl.uniformMatrix3fv(gl.getUniformLocation(this.program,name),false,value);gl.uniform1f(gl.getUniformLocation(this.program,'time'),Math.max(0,t));/* fix3: no upper clamp - the shader keeps running past DURATION during the exit tear (only the logo bounce extrapolates, see lastScene) */gl.uniform1f(gl.getUniformLocation(this.program,'signal'),this.signal?1:0);gl.uniform1f(gl.getUniformLocation(this.program,'embeddedIntro'),this.embeddedIntro?1:0);gl.uniform2f(gl.getUniformLocation(this.program,'resolution'),this.canvas.width,this.canvas.height);{const o=this.overloadOverride||sampleOverload(t+START),asp=1920/1080/4;gl.uniform4f(gl.getUniformLocation(this.program,'ovA'),o[0],o[1],o[2],o[2]*asp);gl.uniform4f(gl.getUniformLocation(this.program,'ovB'),o[3],o[4],0,o[5]);gl.uniform4f(gl.getUniformLocation(this.program,"ovC"),o[6],o[7]||0,0,0);}gl.drawArrays(gl.TRIANGLES,0,6);}
 destroy(){for(const t of this.textures)this.gl.deleteTexture(t);for(const shader of this.gl.getAttachedShaders(this.program)||[])this.gl.deleteShader(shader);this.gl.deleteBuffer(this.buffer);this.gl.deleteProgram(this.program);this.poses=[];this.background.width=this.background.height=1;if(this.edge)this.edge.width=this.edge.height=1;}
}
