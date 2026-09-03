'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {validateTarget,selectArtifact}=require('../tools/argos-independent-recovery');
const env={ARGOS_SOURCE_RUN:'123',ARGOS_SOURCE_COMMIT:'a'.repeat(40),ARGOS_EXPECTED_ARCHIVE_SHA256:'b'.repeat(64)};
const run={id:123,head_sha:env.ARGOS_SOURCE_COMMIT,path:'.github/workflows/argos-assurance.yml',repository:{full_name:'sinbad-marine/atlas-marine-os'},head_branch:'main',run_attempt:1};
const artifact={id:456,name:`argos-encrypted-${env.ARGOS_SOURCE_COMMIT}-123-1`,expired:false};
test('recovery download binds the source run, repository, attempt and unexpired unique artifact',()=>{
 const target=validateTarget(env);assert.equal(selectArtifact(run,{total_count:1,artifacts:[artifact]},target),artifact);
 for(const wrong of [{...run,head_sha:'c'.repeat(40)},{...run,id:124},{...run,head_branch:'other'},{...run,repository:{full_name:'other/repo'}}])assert.throws(()=>selectArtifact(wrong,{total_count:1,artifacts:[artifact]},target),/MISMATCH/);
 for(const list of [{total_count:1,artifacts:[{...artifact,expired:true}]},{total_count:2,artifacts:[artifact,artifact]},{total_count:2,artifacts:[artifact]}])assert.throws(()=>selectArtifact(run,list,target),/MISSING|INCOMPLETE/);
});
test('recovery inputs require exact IDs and checkpoint hashes before any command runs',()=>{
 for(const key of Object.keys(env))for(const bad of ['', '../main','123; echo bad'])assert.throws(()=>validateTarget({...env,[key]:bad}),/INVALID/);
});
