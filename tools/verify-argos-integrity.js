'use strict';

const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const argos=require('../sinbad-ai-core/argos-governance-core.js');

const root=path.resolve(__dirname,'..');
const policyPath=path.join(root,'config','argos-integrity-policy.json');
function fail(code,detail){process.stderr.write(`${JSON.stringify({version:'sinbad-argos-verifier/1-v1',status:'ARGOS_INTEGRITY_BLOCKED',reasonCode:code,detail})}\n`);process.exitCode=1;}
function sha256(buffer){return crypto.createHash('sha256').update(buffer).digest('hex');}
function safeRelative(value){return typeof value==='string'&&value.length>0&&value===value.replaceAll('\\','/')&&!value.startsWith('/')&&!/^[A-Za-z]:/u.test(value)&&!value.split('/').includes('..');}

let policy;
try{policy=JSON.parse(fs.readFileSync(policyPath,'utf8'));}catch(error){fail('POLICY_UNAVAILABLE',error.code||error.name);return;}
if(!policy||policy.schemaVersion!=='sinbad-argos-integrity-policy/1-v1'||policy.scopeId!=='sinbad-marine'||!Array.isArray(policy.protectedFiles)||policy.protectedFiles.length===0){fail('POLICY_INVALID','schema');return;}
const seen=new Set();const entries=[];
for(const item of policy.protectedFiles){
  if(!item||Object.keys(item).sort().join(',')!=='kind,path,sha256'||!safeRelative(item.path)||!argos.ENTRY_KINDS.includes(item.kind)||!/^[a-f0-9]{64}$/u.test(String(item.sha256||''))||seen.has(item.path)){fail('POLICY_INVALID',item?.path||'entry');return;}
  seen.add(item.path);const target=path.resolve(root,item.path);if(!target.startsWith(`${root}${path.sep}`)){fail('PATH_ESCAPE',item.path);return;}
  let stat,bytes;try{stat=fs.lstatSync(target);if(!stat.isFile()||stat.isSymbolicLink())throw new Error('not regular');bytes=fs.readFileSync(target);}catch{fail('PROTECTED_FILE_UNAVAILABLE',item.path);return;}
  const actual=sha256(bytes);if(actual!==item.sha256){fail('PROTECTED_FILE_DRIFT',item.path);return;}
  entries.push({path:item.path,sha256:actual,bytes:stat.size,kind:item.kind,protected:true});
}
entries.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
const inventory=argos.createInventory({scopeId:policy.scopeId,observedAt:'2000-01-01T00:00:00.000Z',entries});
for(const workflow of ['.github/workflows/release-quality.yml','.github/workflows/pages-release.yml']){
  const text=fs.readFileSync(path.join(root,workflow),'utf8');
  if(!text.includes('name: ARGOS integrity gate')||!text.includes('run: npm run verify:argos')){fail('WORKFLOW_GATE_MISSING',workflow);return;}
}
process.stdout.write(`${JSON.stringify({version:'sinbad-argos-verifier/1-v1',status:'ARGOS_INTEGRITY_VERIFIED',reasonCode:null,protectedFileCount:entries.length,inventoryHash:inventory.inventoryHash})}\n`);
