'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module'),{webcrypto}=require('node:crypto'),{spawnSync}=require('node:child_process');
const code=stripTypeScriptTypes(fs.readFileSync('supabase/functions/argos-bridge-authorize/index.ts','utf8').replace(/^import .*\r?\n/,''));
const id='11111111-1111-4111-8111-111111111111';
const jwt=[Buffer.from('{}').toString('base64url'),Buffer.from(JSON.stringify({session_id:'session-fixture'})).toString('base64url'),'signature'].join('.');
const command=()=>({action:'ROUTE_WRITE',bodyBytes:2,bodySha256:'aa'.repeat(32),commandId:'browser-fixture-command-0001',instanceId:id,method:'POST',path:'/routes',requestedAt:new Date().toISOString(),workspaceId:id});
async function exercise({change=()=>{},aal='aal2',auth=true,consumed=true,credential='cc'.repeat(32)}={}){
 let handler;const calls=[];
 vm.runInNewContext(code,{Response,TextEncoder,crypto:webcrypto,atob,Deno:{serve:fn=>handler=fn,env:{get:name=>name}},createClient:()=>({auth:{getUser:async()=>({data:{user:auth?{id}:null},error:null}),mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:aal}})}},rpc:async(name,args)=>{calls.push({name,args});return {data:consumed};}})});
 const body={command:command(),challenge:'dd'.repeat(32),stepUp:{authorizationId:id,nonce:'bb'.repeat(32)}};change(body);
 const response=await handler(new Request('https://isolated.invalid',{method:'POST',headers:{Authorization:`Bearer ${jwt}`,'X-Sinbad-Bridge-Credential':credential},body:JSON.stringify(body)}));
 return {status:response.status,body:await response.json(),calls};
}
test('Bridge service rejects identity, MFA, malformed binding and refused atomic consumption',async()=>{
 for(const options of [{auth:false},{aal:'aal1'},{credential:''},{change:b=>b.command.path='/ai/chat'},{change:b=>b.command.action='LIBRARY_WRITE'},{change:b=>b.command.bodyBytes=-1},{change:b=>b.command.requestedAt='2001-01-01T00:00:00.000Z'},{change:b=>b.stepUp.nonce='forged'}]){
  const r=await exercise(options);assert.ok(r.status>=400);assert.equal(r.calls.length,0);
 }
 const refused=await exercise({consumed:false});assert.equal(refused.status,403);assert.equal(refused.calls.length,1);
});
test('Bridge service reconstructs exact content and binds instance, user, session and hashed credential',async()=>{
 const r=await exercise();assert.equal(r.status,200);assert.equal(r.calls.length,1);
 const args=r.calls[0].args;assert.equal(r.calls[0].name,'consume_argos_bridge_step_up');
 assert.equal(args.p_instance_id,id);assert.equal(args.p_principal_user_id,id);assert.equal(args.p_auth_session_id,'session-fixture');assert.equal(args.p_action,'core.bridge.route_write');
 assert.match(args.p_credential_hash,/^[0-9a-f]{64}$/);assert.notEqual(args.p_credential_hash,'cc'.repeat(32));assert.equal(r.body.commandHash,args.p_command_hash);
 assert.equal(r.body.challenge,'dd'.repeat(32));assert.equal(JSON.stringify(r.body).includes('nonce'),false);
});
test('actual PowerShell boundary denies absent proof, service rejection and substituted response before effects',{skip:process.platform!=='win32'},()=>{
 const ps=`
$ErrorActionPreference='Stop'
. './bridge/argos-owner-boundary.ps1'
function Get-ArgosOwnerConfiguration { return @{instanceId='${id}';workspaceId='${id}'} }
$headers=@{'authorization'='Bearer ${jwt}';'x-sinbad-owner-authorization'='${id}';'x-sinbad-owner-nonce'='${'bb'.repeat(32)}';'x-sinbad-argos-action'='ROUTE_WRITE';'x-sinbad-argos-command-id'='browser-fixture-0001';'x-sinbad-argos-requested-at'='2026-09-03T00:00:00.000Z'}
$bytes=[Text.Encoding]::UTF8.GetBytes('{"route":"fixture"}')
if ((Test-ArgosOwnerBoundary @{} '/routes' $bytes).admitted) { throw 'MISSING_PROOF_ACCEPTED' }
function Invoke-ArgosOwnerService { throw 'Synthetic denial' }
if ((Test-ArgosOwnerBoundary $headers '/routes' $bytes).admitted) { throw 'FAILED_SERVICE_ACCEPTED' }
function Invoke-ArgosOwnerService($config,$auth,$json) {
 $r=$json | ConvertFrom-Json
 if ($r.command.bodyBytes -ne $bytes.Length -or $r.command.bodySha256 -cne (Get-ArgosSha256 $bytes)) { throw 'BODY_NOT_BOUND' }
 return @{ok=$true;challenge=$r.challenge;authorizationId=$r.stepUp.authorizationId;instanceId=$config.instanceId;bodySha256=$r.command.bodySha256;commandHash=('a'*64)}
}
if (-not (Test-ArgosOwnerBoundary $headers '/routes' $bytes).admitted) { throw 'VALID_SERVICE_REJECTED' }
function Invoke-ArgosOwnerService { return @{ok=$true;challenge=('b'*64)} }
if ((Test-ArgosOwnerBoundary $headers '/routes' $bytes).admitted) { throw 'FORGED_RESPONSE_ACCEPTED' }
if (-not (Test-ArgosOwnerBoundary @{} '/ai/chat' $bytes).admitted) { throw 'ORDINARY_INFERENCE_BROKEN' }
'OWNER_BOUNDARY_VERIFIED'
`;
 const r=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-EncodedCommand',Buffer.from(ps,'utf16le').toString('base64')],{encoding:'utf8',windowsHide:true,timeout:20000});
 assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/OWNER_BOUNDARY_VERIFIED/);
});
