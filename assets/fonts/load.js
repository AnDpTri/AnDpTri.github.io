// One cold download per face supplies both the document and its SVG photographs.
// Nothing is persisted: a navigation always downloads these bytes again.
const dataURL=blob=>new Promise((resolve,reject)=>{
 const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);
});
export const fontAssets=Promise.all([
 ['IBM Plex Mono','font-3.woff2',{weight:'400'}],
 ['Be Vietnam Pro','font-0.woff2',{weight:'900',style:'italic'}]
].map(async([family,file,descriptors])=>{
 const response=await fetch(new URL(file,import.meta.url));
 if(!response.ok)throw Error(`Font resource: ${response.status}`);
 const blob=await response.blob();
 const [bytes,url]=await Promise.all([blob.arrayBuffer(),dataURL(blob)]);
 const face=new FontFace(family,bytes,{...descriptors,display:'swap'});
 await face.load();document.fonts.add(face);
 return `@font-face{font-family:'${family}';font-weight:${descriptors.weight};font-style:${descriptors.style??'normal'};src:url('${url}')}`;
})).then(faces=>faces.join(''));
// The opening handles failures with its existing static fallback.
void fontAssets.catch(()=>{});
