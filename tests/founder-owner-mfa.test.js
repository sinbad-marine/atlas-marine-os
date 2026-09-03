'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');
const migration=read('supabase/migrations/20260829_founder_owner_step_up.sql');
const edge=read('supabase/functions/founder-owner-step-up/index.ts');
const manageMembers=read('supabase/functions/manage-members/index.ts');
const helper=require('../founder-owner-mfa.js');

test('founder registry is UUID-only, singleton and contains no production identity or credential',()=>{
  assert.match(migration,/user_id uuid primary key references auth\.users\(id\)/);
  assert.match(migration,/founder_principals_one_active[\s\S]*where status = 'active'/);
  assert.match(migration,/security_admin[\s\S]*identity_admin[\s\S]*core_release_approver/);
  assert.doesNotMatch(migration,/@[a-z0-9.-]+\.[a-z]{2,}/i);
  assert.doesNotMatch(migration,/(password|totp_secret|service_role_key)\s+(text|varchar)/i);
});

test('step-up grants are exact, short lived, session bound, single use and audit appended',()=>{
  for(const field of ['action text not null','resource_type text not null','resource_id text not null','command_hash text not null','nonce_hash text not null unique','auth_session_id text not null','consumed_at timestamptz'])assert.match(migration,new RegExp(field.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(migration,/expires_at <= issued_at \+ interval '10 minutes'/);
  assert.match(migration,/a\.consumed_at is null/);
  assert.match(migration,/a\.expires_at > clock_timestamp\(\)/);
  assert.match(migration,/update public\.founder_step_up_authorizations[\s\S]*returning a\.id into consumed_id/);
  assert.match(migration,/founder_security_audit_immutable[\s\S]*before update or delete/);
  assert.match(migration,/revoke all on function public\.consume_founder_step_up[\s\S]*authenticated/);
});

test('Edge Function checks real Supabase aal2 and hashes command and nonce server-side',()=>{
  assert.match(edge,/auth\.mfa\.getAuthenticatorAssuranceLevel\(jwt\)/);
  assert.match(edge,/currentLevel!=='aal2'/);
  assert.match(edge,/crypto\.subtle\.digest\('SHA-256'/);
  assert.match(edge,/crypto\.getRandomValues\(new Uint8Array\(32\)\)/);
  assert.match(read('supabase/migrations/20260903_founder_owner_atomic_issuance.sql'),/v_issued_at \+ interval '5 minutes'/);
  assert.match(edge,/session_id\|\|claims\.jti/);
  assert.match(edge,/\^\(security\|identity\|core\|release\|delete\)/);
  assert.doesNotMatch(edge,/mode==='consume'/);
  assert.doesNotMatch(edge,/SUPABASE_SERVICE_ROLE_KEY\s*=\s*['"][^'"]+/);
});

test('browser helper uses official MFA enrollment and challenge APIs without persisting secrets',async()=>{
  const calls=[],client={auth:{mfa:{
    listFactors:async()=>({data:{totp:[]}}),getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:'aal1',nextLevel:'aal2'}}),
    enroll:async input=>(calls.push(['enroll',input]),{data:{id:'factor',totp:{qr_code:'qr',secret:'one-time',uri:'uri'}}}),
    challengeAndVerify:async input=>(calls.push(['verify',input]),{data:{access_token:'upgraded'}}),unenroll:async()=>({data:{}})
  }},functions:{invoke:async(name,options)=>(calls.push([name,options.body]),{data:{ok:true}})}};
  const mfa=helper.create(client),enrolled=await mfa.enrollTotp();
  assert.equal(enrolled.factorId,'factor');await mfa.challengeTotp('factor','123456');
  assert.deepEqual(calls[0][0],'enroll');assert.deepEqual(calls[1][0],'verify');
  await assert.rejects(()=>mfa.challengeTotp('factor','12345'),/VALID_TOTP_CODE_REQUIRED/);
});

test('identity role and activation mutations consume an exact founder proof while invitations remain ordinary Owner RBAC',()=>{
  assert.match(manageMembers,/action:'identity\.member\.set_role'/);
  assert.match(manageMembers,/action:'identity\.member\.set_active'/);
  assert.match(manageMembers,/auth\.mfa\.getAuthenticatorAssuranceLevel\(jwt\)/);
  assert.match(manageMembers,/rpc\('consume_founder_step_up'/);
  const inviteBranch=manageMembers.slice(manageMembers.indexOf("if(action==='invite')"),manageMembers.indexOf("}else if(action==='set_role')"));
  assert.doesNotMatch(inviteBranch,/requireFounderStepUp/);
});
