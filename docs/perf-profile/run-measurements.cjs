// Interleave before/after to reduce thermal/load drift; run alone, not beside other browsers.
const {spawnSync}=require('node:child_process'),path=require('node:path');
for(const mobile of ['0','1'])for(let run=1;run<=(mobile==='1'?1:3);run++)for(const network of ['fast4g','slow4g'])for(const label of (run%2?['baseline','after']:['after','baseline'])){
 const child=spawnSync(process.execPath,[path.join(__dirname,'measure.cjs'),label,label==='baseline'?'4192':'4191'],{stdio:'inherit',env:{...process.env,PROFILE_MOBILE:mobile,PROFILE_NETWORK:network,PROFILE_RUN:String(run)}});
 if(child.status!==0)process.exit(child.status||1);
}
