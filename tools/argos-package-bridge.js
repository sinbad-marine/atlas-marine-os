'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const files=['bridge/sinbad-bridge.ps1','bridge/argos-owner-boundary.ps1','bridge/qwen-tier-router.ps1','bridge/xtts-worker.py','bridge/opencpn-rest-client.js','bridge/start-sinbad-bridge.cmd','bridge/start-sinbad-bridge-silent.vbs','sinbad-ai-core/visual-library/scripts/query-complete-library-atlas.py','sinbad-ai-core/engines/studio/studio-pro-04-acceptance-manifest.js'];
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function build(parent){
 const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
 const sourceState=execFileSync('git',['status','--porcelain','--untracked-files=normal'],{cwd:root,encoding:'utf8'}).trim()?'DIRTY_REVIEW_ONLY':'CLEAN_COMMIT';
 const entries=files.map(name=>{const target=path.join(root,name);if(!fs.lstatSync(target).isFile())throw Error('BRIDGE_SOURCE_INVALID');const bytes=fs.readFileSync(target);return {path:name,bytes,sha256:hash(bytes)};});
 const id=hash(JSON.stringify(entries.map(({path,sha256})=>({path,sha256}))));
 const destination=path.resolve(parent,id);fs.mkdirSync(destination,{recursive:false});
 for(const entry of entries){const target=path.join(destination,entry.path);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,entry.bytes,{flag:'wx'});if(hash(fs.readFileSync(target))!==entry.sha256)throw Error('BRIDGE_COPY_MISMATCH');}
 const manifest={schemaVersion:'sinbad-argos-bridge-package/1',sourceCommit,sourceState,packageId:id,files:entries.map(({path,bytes,sha256})=>({path,bytes:bytes.length,sha256})),externalState:'Existing user routes, library, voice samples, models, Python, Ollama, Kiwix and OpenCPN remain at their existing locations. This artifact contains every relative code dependency, not user data or installed runtimes.',ownerConfiguration:'Windows user DPAPI at LOCALAPPDATA/Sinbad/argos/bridge-owner.json',authorization:'No secret or service-role key is included in this package.'};
 fs.writeFileSync(path.join(destination,'BRIDGE-MANIFEST.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});return {destination,packageId:id};
}
if(require.main===module){try{const parent=path.resolve(process.argv[2]||path.join(root,'.release/argos-bridge'));fs.mkdirSync(parent,{recursive:true});console.log(JSON.stringify(build(parent)));}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={files,build};
