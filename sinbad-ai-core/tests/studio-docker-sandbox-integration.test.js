const test=require('node:test');
const assert=require('node:assert/strict');
const fsp=require('node:fs').promises;
const os=require('node:os');
const path=require('node:path');
const compiler=require('../engines/studio/virtual-artifact-compiler.js');
const staticVerifier=require('../engines/studio/static-artifact-verifier.js');
const sandboxWriter=require('../engines/studio/sandbox-writer.js');
const persistedVerifier=require('../engines/studio/persisted-workspace-verifier.js');
const runnerModule=require('../engines/studio/docker-sandbox-test-runner.js');
const launcherModule=require('../engines/studio/node-docker-cli-launcher.js');

test('real Docker executes only verified Studio tests inside the fixed sandbox', {skip:process.env.SINBAD_DOCKER_INTEGRATION!=='1'}, async t=>{
  const base=await fsp.mkdtemp(path.join(os.tmpdir(),'sinbad-docker-integration-'));t.after(()=>fsp.rm(base,{recursive:true,force:true}));
  const now=Date.now(),bundle=compiler.compile({instruction:'Program hazırla',projectName:'Docker Integration',audience:'owner',acceptanceCriteria:'node tests'}),staticReport=staticVerifier.verify(bundle),writer=sandboxWriter.create({approvedBase:base,clock:()=>now});
  await writer.persist(bundle,writer.authorize(bundle,{approvedBy:'owner-001',purpose:'integration-write',nonce:'integration-write',expiresAt:now+60000}));
  const report=await persistedVerifier.create({approvedBase:base}).verify(staticReport),launcher=launcherModule.create(),runner=runnerModule.create({approvedBase:base,clock:()=>now,launch:launcher.launch}),authorization=runner.authorize(report,{approvedBy:'owner-001',purpose:'integration-test',nonce:`integration-${now}`,expiresAt:now+60000}),result=await runner.run(report,authorization);
  assert.equal(result.status,'SANDBOX_TESTS_PASSED');assert.equal(result.exitCode,0);assert.equal(result.timedOut,false);assert.match(result.output,/pass 1/u);assert.deepEqual(result.writes,{host:false,core:false,production:false});
});
