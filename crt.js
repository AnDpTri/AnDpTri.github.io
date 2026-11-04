// Convex CRT glass: a displacement map (barrel bulge) fed to an SVG filter on #warp, plus a light bezel.
const NS='http://www.w3.org/2000/svg';
const K=0.045,MAP_MAX=512;

const overlay=document.createElement('div');
overlay.id='crt';overlay.setAttribute('aria-hidden','true');
overlay.innerHTML='<div class="crt-bezel"></div>';
document.body.append(overlay);

const svg=document.createElementNS(NS,'svg');
svg.setAttribute('width','0');svg.setAttribute('height','0');svg.style.cssText='position:absolute;pointer-events:none';
svg.innerHTML='<filter id="crt-warp" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" x="0" y="0" width="100" height="100" color-interpolation-filters="sRGB"><feImage id="crt-map" preserveAspectRatio="none" result="map"/><feDisplacementMap id="crt-bulge" in="SourceGraphic" in2="map" scale="0" xChannelSelector="R" yChannelSelector="G"/></filter>';
document.body.append(svg);
const filter=svg.querySelector('filter'),map=svg.querySelector('#crt-map'),bulge=svg.querySelector('#crt-bulge');
const setBox=(node,w,h)=>{node.setAttribute('x','0');node.setAttribute('y','0');node.setAttribute('width',w);node.setAttribute('height',h);};

function build(){
  const W=innerWidth,H=innerHeight;
  if(!W||!H)return; // pane not laid out yet; the resize listener rebuilds
  setBox(filter,W,H);setBox(map,W,H);
  // Output pixel (u,v) samples the source at (u,v)*(1-2K+K·r²): centre magnified, rim bent away but never
  // sampled outside the page, so the glass stays full-bleed (corners are the identity).
  const mw=Math.min(MAP_MAX,W),mh=Math.max(2,Math.round(mw*H/W));
  const scale=2*K*1.1*Math.max(W,H)/2;
  const c=document.createElement('canvas');c.width=mw;c.height=mh;
  const cx=c.getContext('2d'),data=cx.createImageData(mw,mh);
  for(let y=0;y<mh;y++)for(let x=0;x<mw;x++){
    const u=(x+.5)/mw*2-1,v=(y+.5)/mh*2-1,r2=u*u+v*v,i=(y*mw+x)*4;
    data.data[i]=Math.round(127.5+u*K*(r2-2)*(W/2)/scale*255);
    data.data[i+1]=Math.round(127.5+v*K*(r2-2)*(H/2)/scale*255);
    data.data[i+2]=128;data.data[i+3]=255;
  }
  cx.putImageData(data,0,0);
  map.setAttribute('href',c.toDataURL());bulge.setAttribute('scale',scale);
}
let timer=0;
addEventListener('resize',()=>{clearTimeout(timer);timer=setTimeout(build,150);});
build();
