'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const {restoreArchive}=require('./argos-restore-archive');
const repo='sinbad-marine/atlas-marine-os';
function validateTarget(env){const run=env.ARGOS_SOURCE_RUN,commit=env.ARGOS_SOURCE_COMMIT,digest=env.ARGOS_EXPECTED_ARCHIVE_SHA256;if(!/^[1-9][0-9]{0,15}$/.test(run||'')||!/^[a-f0-9]{40}$/.test(commit||'')||!/^[a-f0-9]{64}$/.test(digest||''))throw Error('RECOVERY_TARGET_INVALID');return {run,commit,digest};}
function selectArtifact(run,listing,target){
 if(String(run.id)!==target.run||run.head_sha!==target.commit||run.path!=='.github/workflows/argos-assurance.yml'||run.repository?.full_name!==repo||run.head_branch!=='main'||!Number.isSafeInteger(run.run_attempt)||run.run_attempt<1)throw Error('RECOVERY_SOURCE_RUN_MISMATCH');
 if(!Array.isArray(listing.artifacts)||listing.total_count!==listing.artifacts.length||listing.total_count>100)throw Error('RECOVERY_ARTIFACT_LIST_INCOMPLETE');
 const name=`argos-encrypted-${target.commit}-${target.run}-${run.run_attempt}`,matches=listing.artifacts.filter(a=>a.name===name&&!a.expired);
 if(matches.length!==1||!Number.isSafeInteger(matches[0].id))throw Error('RECOVERY_ARTIFACT_MISSING');return matches[0];
}
function main(){
 const mode=process.argv[2],target=validateTarget(process.env),root=path.resolve(process.env.ARGOS_RECOVERY_ROOT||'');
 if(!process.env.ARGOS_RECOVERY_ROOT)throw Error('RECOVERY_ROOT_REQUIRED');
 if(mode==='download'){
  const api=endpoint=>JSON.parse(cp.execFileSync('gh',['api',`repos/${repo}/${endpoint}`],{encoding:'utf8',timeout:20000,maxBuffer:2*1024*1024,windowsHide:true}));
  const run=api(`actions/runs/${target.run}`),artifact=selectArtifact(run,api(`actions/runs/${target.run}/artifacts?per_page=100`),target);
  fs.mkdirSync(root,{recursive:false,mode:0o700});const download=path.join(root,'download');
  cp.execFileSync('gh',['run','download',target.run,'--repo',repo,'--name',artifact.name,'--dir',download],{timeout:30000,stdio:'pipe',windowsHide:true});
  const names=fs.readdirSync(download);if(names.length!==1||!names[0].endsWith('.json')||!fs.lstatSync(path.join(download,names[0])).isFile()||fs.lstatSync(path.join(download,names[0])).isSymbolicLink())throw Error('RECOVERY_DOWNLOAD_INVALID');
  const bytes=fs.readFileSync(path.join(download,names[0]));if(bytes.length>100663296||crypto.createHash('sha256').update(bytes).digest('hex')!==target.digest)throw Error('RECOVERY_CHECKPOINT_MISMATCH');
  fs.mkdirSync(path.join(root,'report'));fs.writeFileSync(path.join(root,'report','source.json'),JSON.stringify({repository:repo,sourceRun:run.id,sourceCommit:target.commit,attempt:run.run_attempt,artifactId:artifact.id,ciphertextSha256:target.digest,downloadedFile:names[0]},null,2)+'\n',{flag:'wx'});
  console.log('ARGOS_RECOVERY_DOWNLOAD_CHECKPOINT_VERIFIED');
 }else if(mode==='restore'){
  const source=JSON.parse(fs.readFileSync(path.join(root,'report','source.json'),'utf8'));
  if(source.sourceCommit!==target.commit||String(source.sourceRun)!==target.run||source.ciphertextSha256!==target.digest||path.basename(source.downloadedFile)!==source.downloadedFile)throw Error('RECOVERY_CHECKPOINT_INVALID');
  const bytes=fs.readFileSync(path.join(root,'download',source.downloadedFile));if(crypto.createHash('sha256').update(bytes).digest('hex')!==target.digest)throw Error('RECOVERY_CHECKPOINT_MISMATCH');
  const result=restoreArchive(JSON.parse(bytes),process.env.ARGOS_ARCHIVE_KEY,path.join(root,'restored-journals'));
  const receipt={status:'ARGOS_INDEPENDENT_RECOVERY_PASSED',checkedAt:new Date().toISOString(),sourceRun:source.sourceRun,sourceCommit:source.sourceCommit,artifactId:source.artifactId,ciphertextSha256:target.digest,archiveId:result.archiveId,shelves:result.shelves,environment:'Fresh GitHub-hosted runner; existing repository secret; no Windows DPAPI access',scope:'ARGOS journal recovery; no key export or live database restore'};
  fs.writeFileSync(path.join(root,'report','recovery.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(receipt));
 }else throw Error('RECOVERY_COMMAND_INVALID');
}
if(require.main===module){try{main();}catch(e){console.error(/^[A-Z][A-Z0-9_]+$/.test(e.message)?e.message:'ARGOS_RECOVERY_DRILL_FAILED');process.exitCode=1;}}
module.exports={validateTarget,selectArtifact};
