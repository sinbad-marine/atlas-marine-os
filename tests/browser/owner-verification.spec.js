'use strict';
const {test,expect}=require('@playwright/test');

async function prepare(page,{enrolled=true,aal='aal1'}={}){
  await page.route('https://*.supabase.co/**',route=>route.fulfill({status:503,body:'{}'}));
  await page.route('http://127.0.0.1:31983/**',route=>route.fulfill({status:503,body:'{}'}));
  await page.goto('/index.html?workspace=admin-settings');
  await page.evaluate(({enrolled,aal})=>{
    document.body.classList.remove('auth-pending','signed-out');document.body.classList.add('authenticated');
    window.ownerCalls=[];window.ownerAal=aal;
    cloudSession={user:{id:'owner-test'}};currentWorkspaceRole='owner';selectedWorkspaceId='workspace-original';
    cloudClient={auth:{mfa:{
      listFactors:async()=>({data:{totp:enrolled?[{id:'factor-existing',status:'verified'}]:[]}}),
      getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:window.ownerAal,nextLevel:'aal2'}}),
      enroll:async()=>{window.ownerCalls.push({kind:'enroll'});return {data:{id:'factor-new',totp:{secret:'SYNTHETIC-SETUP-KEY',qr_code:'',uri:''}}};},
      unenroll:async({factorId})=>{window.ownerCalls.push({kind:'unenroll',factorId});return {data:{}};},
      challengeAndVerify:async({factorId,code})=>{window.ownerCalls.push({kind:'challenge',factorId,code});window.ownerAal='aal2';return {data:{}};}
    }},functions:{invoke:async(name,{body})=>{
      window.ownerCalls.push({kind:name,body});
      if(name==='founder-owner-step-up')return {data:{authorizationId:'11111111-1111-4111-8111-111111111111',nonce:'ab'.repeat(32),expiresAt:new Date(Date.now()+300000).toISOString()}};
      return {data:{ok:true}};
    }}};
  },{enrolled,aal});
}

test('member change verifies MFA then sends the exact original workspace command and proof',async({page})=>{
  await prepare(page);
  await page.evaluate(()=>{window.ownerResult=invokeMemberAdmin('set_role',{userId:'member-test',role:'captain'}).then(()=> 'ok',error=>error.message);});
  const dialog=page.getByRole('dialog',{name:'Owner verification'});await expect(dialog).toBeVisible();
  await page.evaluate(()=>{selectedWorkspaceId='workspace-changed-during-dialog';});
  await dialog.getByLabel('Authenticator code').fill('123456');await dialog.getByRole('button',{name:'Verify',exact:true}).click();
  await expect(dialog).toHaveCount(0);
  const result=await page.evaluate(async()=>({result:await window.ownerResult,calls:window.ownerCalls}));
  expect(result.result).toBe('ok');
  expect(result.calls.map(call=>call.kind)).toEqual(['challenge','founder-owner-step-up','manage-members']);
  expect(result.calls[1].body.command).toEqual({workspaceId:'workspace-original',userId:'member-test',role:'captain'});
  expect(result.calls[2].body.workspaceId).toBe('workspace-original');
  expect(result.calls[2].body.stepUp.nonce).toBe('ab'.repeat(32));
});

test('cancelled verification does not request an approval or mutate membership',async({page})=>{
  await prepare(page);
  await page.evaluate(()=>{window.ownerResult=invokeMemberAdmin('set_active',{userId:'member-test',isActive:false}).then(()=> 'unexpected',error=>error.message);});
  await page.getByRole('dialog',{name:'Owner verification'}).getByRole('button',{name:'Cancel',exact:true}).click();
  expect(await page.evaluate(()=>window.ownerResult)).toBe('OWNER_VERIFICATION_CANCELLED');
  expect(await page.evaluate(()=>window.ownerCalls)).toEqual([]);
});

test('Authenticator setup shows its key only until verification and does not issue an operation grant',async({page})=>{
  await prepare(page,{enrolled:false});
  await page.getByRole('button',{name:'Authenticator / Owner verification'}).click();
  const dialog=page.getByRole('dialog',{name:'Owner verification'});
  await dialog.getByRole('button',{name:'Set up Authenticator'}).click();
  await expect(dialog.getByText('SYNTHETIC-SETUP-KEY')).toBeVisible();
  await dialog.getByLabel('Authenticator code').fill('123456');await dialog.getByRole('button',{name:'Verify',exact:true}).click();
  await expect(dialog).toHaveCount(0);await expect(page.getByText('SYNTHETIC-SETUP-KEY')).toHaveCount(0);
  expect(await page.evaluate(()=>window.ownerCalls.map(call=>call.kind))).toEqual(['enroll','challenge']);
  expect(await page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}))).not.toContain('SYNTHETIC-SETUP-KEY');
});

test('already verified session uses a fresh exact grant; invitations retain ordinary Owner flow',async({page})=>{
  await prepare(page,{aal:'aal2'});
  await page.evaluate(()=>invokeMemberAdmin('set_active',{userId:'member-test',isActive:true}));
  await expect(page.getByRole('dialog',{name:'Owner verification'})).toHaveCount(0);
  expect(await page.evaluate(()=>window.ownerCalls.map(call=>call.kind))).toEqual(['founder-owner-step-up','manage-members']);
  await page.evaluate(()=>{window.ownerCalls=[];return invokeMemberAdmin('invite',{email:'synthetic@example.invalid',role:'viewer'});});
  expect(await page.evaluate(()=>window.ownerCalls.map(call=>call.kind))).toEqual(['manage-members']);
});

test('Bridge binds exact UTF-8 bytes and obtains the refreshed token after MFA',async({page})=>{
  await prepare(page,{aal:'aal2'});
  const workspace='22222222-2222-4222-8222-222222222222',instance='33333333-3333-4333-8333-333333333333';
  let sent;
  await page.route('http://127.0.0.1:31983/**',async route=>{
    if(route.request().url().endsWith('/argos/status'))return route.fulfill({json:{ownerBoundary:{enforced:true,configured:true,workspaceId:workspace,instanceId:instance}}});
    sent={headers:route.request().headers(),body:route.request().postData()};return route.fulfill({json:{ok:true}});
  });
  await page.evaluate(workspace=>{
    selectedWorkspaceId=workspace;
    cloudClient.auth.getSession=async()=>({data:{session:{access_token:'synthetic.refreshed.token'}}});
  },workspace);
  const body='{"name":"Türkçe rota ⚓"}';
  await page.evaluate(body=>ownerBridgeFetch('/routes','ROUTE_WRITE',body),body);
  expect(sent.body).toBe(body);expect(sent.headers.authorization).toBe('Bearer synthetic.refreshed.token');
  const calls=await page.evaluate(()=>window.ownerCalls),grant=calls.find(c=>c.kind==='founder-owner-step-up').body;
  expect(grant.command.bodyBytes).toBe(Buffer.byteLength(body));
  expect(grant.command.bodySha256).toBe(require('node:crypto').createHash('sha256').update(body).digest('hex'));
  expect(grant.resourceId).toBe(instance);expect(grant.workspaceId).toBe(workspace);
  expect(sent.headers['x-sinbad-owner-nonce']).toBe('ab'.repeat(32));
});
