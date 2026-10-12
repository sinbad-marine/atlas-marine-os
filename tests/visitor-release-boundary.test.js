const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const home=fs.readFileSync('sinbad-home.js','utf8');
const source=home.slice(home.indexOf('  async function refresh(){'),home.indexOf('  window.SinbadHome='));
for(const [label,user,pending,expected] of [['visitor',null,false,0],['unfinished invitation',{id:'synthetic-invite'},true,0],['signed-in fixture',{id:'synthetic-member'},false,1]]){
 test(`Home Refresh ${label}: request boundary before fetch`,async()=>{
  const requests=[];const context={cloudSession:user?{user}:null,needsInviteSetup:()=>pending,document:{querySelectorAll:()=>[]},syncAccount(){},inFlight:null,generation:0,state:'never',renderObserved(){},favorites:{refresh(){}},refreshCloudSummary:async()=>({state:'unavailable'}),fetch:async url=>{requests.push(url);return {ok:true,json:async()=>({})};},AbortSignal,Date};
  vm.createContext(context);vm.runInContext(source,context);await context.refresh();
  assert.equal(requests.length,expected);if(expected)assert.equal(requests[0],'http://127.0.0.1:31983/argos/status');
 });
}

const academy=fs.readFileSync('academy-classroom-window.js','utf8');
const academyGuard=academy.slice(academy.indexOf('let academyAccessClient=null;'),academy.indexOf('async function refreshAcademyRuntimeStatus(){'));
for(const [label,user,expected] of [['visitor',null,false],['pending invitation',{id:'synthetic-invite',invited_at:'2026-01-01'},false],['signed-in fixture',{id:'synthetic-member'},true]])test(`Academy existing session boundary: ${label}`,async()=>{
 const context={window:{supabase:{createClient:()=>({auth:{getSession:async()=>({data:{session:user?{user}:null}})}})}},localStorage:{getItem:()=>null},sessionStorage:{getItem:()=>null}};
 vm.createContext(context);vm.runInContext(academyGuard,context);assert.equal(await context.academyHasSignedInAccount(),expected);
});
test('signed-out summary clears stale inventory without a cloud query',async()=>{
 const app=fs.readFileSync('app.js','utf8'),nodes=Object.fromEntries(['sumFiles','sumPubs','sumCharts','sumStorage'].map(id=>[id,{textContent:'stale-private-count'}]));let calls=0;
 const context={cloudClient:{from(){calls++;throw Error('private query');}},cloudSession:null,selectedWorkspaceId:'',roleCanAccessPrivateSources:()=>false,$:id=>nodes[id]};vm.createContext(context);vm.runInContext(app.slice(app.indexOf('async function refreshCloudSummary('),app.indexOf('function openCloudBucket')),context);assert.equal((await context.refreshCloudSummary()).state,'unavailable');assert.equal(calls,0);for(const node of Object.values(nodes))assert.equal(node.textContent,'—');
});
