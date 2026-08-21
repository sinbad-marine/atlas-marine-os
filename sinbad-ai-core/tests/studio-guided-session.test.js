const test=require('node:test');
const assert=require('node:assert/strict');
const fsp=require('node:fs').promises;
const os=require('node:os');
const path=require('node:path');
const guidedSession=require('../engines/studio/guided-studio-session.js');

const request={instruction:'Çevrimdışı web sayfası, Node programı ve SVG animasyon hazırla',projectName:'Guided Demo',audience:'owner',acceptanceCriteria:'local scriptless preview'};
async function fixture(t){const base=await fsp.mkdtemp(path.join(os.tmpdir(),'sinbad-guided-'));t.after(()=>fsp.rm(base,{recursive:true,force:true}));return {base,session:guidedSession.create({approvedBase:base,clock:()=>1000})};}
const sourceApproval={approvedBy:'owner-001',purpose:'source-draft-001',nonce:'source-nonce-001',expiresAt:2000};
const previewApproval={approvedBy:'owner-001',purpose:'local-preview-001',nonce:'preview-nonce-001',expiresAt:2000};

test('guides one complete offline draft to a scriptless local preview',async t=>{
  const {base,session}=await fixture(t),draft=session.start(request);
  assert.equal(draft.status,'STUDIO_DRAFT_READY');assert.equal(draft.nextAction,'APPROVE_SANDBOX_WRITE');
  const workspace=await session.createWorkspace(sourceApproval);
  assert.equal(workspace.status,'STUDIO_WORKSPACE_READY');assert.equal(workspace.nextAction,'APPROVE_SCRIPTLESS_PREVIEW_WRITE');
  const preview=await session.createPreview(previewApproval);
  assert.equal(preview.status,'STUDIO_LOCAL_PREVIEW_READY');assert.equal(preview.nextAction,'USER_MAY_OPEN_LOCAL_INDEX');
  assert.deepEqual({opened:preview.opened,published:preview.published},{opened:false,published:false});
  assert.equal(await fsp.stat(path.join(base,...preview.preview.split('/'),'web','index.html')).then(x=>x.isFile()),true);
  assert.equal(session.status().state,'LOCAL_PREVIEW_READY');
});

test('explains missing input and static policy failures without writing',async t=>{
  const first=await fixture(t),missing=first.session.start({instruction:'Bir şey hazırla'});
  assert.equal(missing.status,'STUDIO_INPUT_REQUIRED');assert.ok(missing.questions.length>0);
  const second=await fixture(t),blocked=second.session.start({...request,instruction:'Web sayfasında https://evil.example kullan'});
  assert.equal(blocked.status,'STUDIO_SESSION_BLOCKED');assert.equal(blocked.nextAction,'REVISE_REQUEST');
  await assert.rejects(fsp.stat(path.join(second.base,'studio-workspaces')),error=>error.code==='ENOENT');
});

test('rejects out-of-order repeated and invalid approval transitions',async t=>{
  const {session}=await fixture(t);
  assert.equal((await session.createPreview(previewApproval)).reason,'PREVIEW_WRITE_OUT_OF_ORDER');
  assert.equal(session.start(request).status,'STUDIO_DRAFT_READY');
  assert.equal(session.start(request).reason,'SESSION_ALREADY_STARTED');
  const invalid=await session.createWorkspace({...sourceApproval,approvedBy:''});
  assert.equal(invalid.nextAction,'REVIEW_WRITE_APPROVAL');assert.equal(session.status().state,'DRAFT_VERIFIED');
  assert.equal((await session.createWorkspace(sourceApproval)).status,'STUDIO_WORKSPACE_READY');
  assert.equal((await session.createWorkspace(sourceApproval)).reason,'WORKSPACE_WRITE_OUT_OF_ORDER');
});

test('guided session never exposes execution network publish or Core-write adapters',()=>{
  const session=guidedSession.create({approvedBase:process.cwd()});
  for(const field of ['run','execute','fetch','open','render','publish','deploy','writeCore'])assert.equal(field in session,false);
  assert.deepEqual(session.status().capabilities,{plan:true,generateDraft:true,writeSandbox:true,verifyIntegrity:true,createScriptlessPreview:true,execute:false,network:false,publish:false,coreWrite:false});
});
