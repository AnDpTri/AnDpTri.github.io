// The measured map contains displacement / static coverage, never source imagery.
// One build → burst → settle envelope; the profile stays monochrome.
// The outgoing screen keeps its live colours until the tear replaces it.
const vertex=`attribute vec2 position;varying vec2 uv;
void main(){uv=vec2((position.x+1.)*.5,(1.-position.y)*.5);gl_Position=vec4(position,0.,1.);}`;
const fragment=`precision highp float;
varying vec2 uv;uniform sampler2D picture,signalMap,outgoing;uniform float progress;
float hash(vec2 p){vec3 q=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
void main(){
 if(progress>=1.){vec3 c=texture2D(picture,uv).rgb;gl_FragColor=vec4(vec3(dot(c,vec3(.2126,.7152,.0722))),1.);return;}
 float p=progress;
 // First 1.5 measured seconds: row displacement precedes the sync roll.
 vec3 m=texture2D(signalMap,vec2((uv.y*1079.+.5)/1080.,(p*1.5/6.867933*165.+.5)/166.)).rgb;
 float build=smoothstep(0.,.16,p),settle=1.-smoothstep(.52,.91,p);
 float force=build*settle;
 float frame=floor(p*48.),row=floor(uv.y*900.);
 float displacement=(m.r*255.-128.)*4./1920.;
 float band=floor(uv.y*32.);
 vec2 q=uv;
 q.x-=displacement*force;
 q.x+=(hash(vec2(band,frame))-.5)*.12*force*step(.70,hash(vec2(band,frame+2.)));
 q.y=fract(q.y+(1.-smoothstep(.65,.90,p))*.07*step(.53,p));
 vec3 image=texture2D(picture,clamp(q,0.,1.)).rgb;
 float luma=dot(image,vec3(.2126,.7152,.0722));
 float edge=p*1.6-.15+(hash(vec2(band,frame))-.5)*.22*force;
 float reveal=step(uv.x,edge);
 float snow=step(.63,hash(vec2(floor(uv.x*640.),row+frame*901.)));
 float burst=smoothstep(.08,.2,p)*(1.-smoothstep(.29,.58,p));
 float noise=max(m.b*force,burst*.65)*snow;
 vec3 source=texture2D(outgoing,clamp(q,0.,1.)).rgb;
 vec3 c=mix(source,vec3(luma),reveal);c=mix(c,vec3(.86),noise);
 c=mix(c,vec3(dot(texture2D(picture,uv).rgb,vec3(.2126,.7152,.0722))),smoothstep(.88,1.,p));
 gl_FragColor=vec4(c,1.);
}`;
export class MonochromeSignal{
 constructor(canvas,map){
  this.canvas=canvas;const gl=this.gl=canvas.getContext('webgl',{alpha:false,antialias:false,preserveDrawingBuffer:true});
  if(!gl)throw Error('WebGL unavailable');
  const compile=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
  const vs=compile(gl.VERTEX_SHADER,vertex),fs=compile(gl.FRAGMENT_SHADER,fragment),program=this.program=gl.createProgram();
  gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  const pos=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
  this.textures=[0,1,2].map(unit=>{const t=gl.createTexture();gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,t);for(const axis of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,axis,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]));return t;});
  gl.uniform1i(gl.getUniformLocation(program,'picture'),0);gl.uniform1i(gl.getUniformLocation(program,'signalMap'),1);
  gl.uniform1i(gl.getUniformLocation(program,'outgoing'),2);
  this.progress=gl.getUniformLocation(program,'progress');this.upload(1,map);
 }
 upload(unit,image){const gl=this.gl;gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,this.textures[unit]);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);}
 setPicture(image){this.canvas.width=image.width;this.canvas.height=image.height;this.gl.viewport(0,0,image.width,image.height);this.upload(0,image);}
 setSource(image){this.upload(2,image);}
 render(progress){const gl=this.gl;gl.useProgram(this.program);gl.uniform1f(this.progress,progress);gl.drawArrays(gl.TRIANGLES,0,6);}
 destroy(){const gl=this.gl;this.textures.forEach(t=>gl.deleteTexture(t));gl.deleteBuffer(this.buffer);gl.deleteProgram(this.program);gl.getExtension('WEBGL_lose_context')?.loseContext();}
}
