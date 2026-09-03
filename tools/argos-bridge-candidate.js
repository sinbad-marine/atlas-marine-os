'use strict';
// Review snapshot only: never starts Bridge, copies secrets, or installs startup entries.
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const crypto=require('node:crypto');
const FILES=Object.freeze([
  'bridge/sinbad-bridge.ps1','bridge/argos-owner-boundary.ps1','bridge/qwen-tier-router.ps1','bridge/xtts-worker.py',
  'bridge/opencpn-rest-client.js','bridge/start-sinbad-bridge-silent.vbs',
  'sinbad-ai-core/visual-library/scripts/query-complete-library-atlas.py',
  'sinbad-ai-core/engines/studio/studio-pro-04-acceptance-manifest.js',
  'tests/fixtures/argos-http-isolation.ps1','tests/argos-bridge-http.test.js'
]);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function snapshot({root=path.resolve(__dirname,'..'),parent=os.tmpdir()}={}){
  root=path.resolve(root);parent=path.resolve(parent);
  for(const dir of [root,parent]){const stat=fs.lstatSync(dir);if(!stat.isDirectory()||stat.isSymbolicLink())throw Error('CANDIDATE_ROOT_INVALID');}
  const inputs=FILES.map(file=>{
    let target=root;
    for(const part of file.split('/')){target=path.join(target,part);if(fs.lstatSync(target).isSymbolicLink())throw Error('CANDIDATE_LINK_REJECTED');}
    const stat=fs.lstatSync(target);if(!stat.isFile()||stat.size>5*1024*1024)throw Error('CANDIDATE_FILE_INVALID');
    const bytes=fs.readFileSync(target);return {file,bytes,sha256:sha(bytes)};
  });
  const destination=fs.mkdtempSync(path.join(parent,'argos-bridge-review-'));
  for(const item of inputs){const target=path.join(destination,item.file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,item.bytes,{flag:'wx'});if(sha(fs.readFileSync(target))!==item.sha256)throw Error('CANDIDATE_COPY_MISMATCH');}
  const manifest={version:'sinbad-argos-bridge-review/v1',status:'SOURCE_SNAPSHOT_NOT_DEPLOYABLE',createdAt:new Date().toISOString(),
    executionAuthorized:false,activationAuthorized:false,sourceRoot:root,
    files:inputs.map(({file,bytes,sha256})=>({path:file,bytes:bytes.length,sha256})),
    exclusions:['User data and libraries','Credentials and keys','Model weights and Python environment','OpenCPN installation and configuration','Startup shortcut'],
    limits:['File hashes describe this snapshot, not loaded runtime identity.','Only the HTTP parser/gate/status slice is tested; downstream executors are not loaded.','External runtime dependencies are not bundled or certified.','Public ARGOS headers are not Owner authentication.']};
  fs.writeFileSync(path.join(destination,'REVIEW-MANIFEST.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
  return {destination,status:manifest.status,fileCount:inputs.length};
}
if(require.main===module){try{console.log(JSON.stringify(snapshot()));}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports=Object.freeze({FILES,snapshot});
