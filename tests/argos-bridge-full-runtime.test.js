'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),net=require('node:net');
const {spawn}=require('node:child_process'),{randomUUID}=require('node:crypto');
test('full Bridge boots with isolated data and rejects every protected write without Owner proof',{skip:process.platform!=='win32',timeout:60000},async t=>{
 const data=fs.mkdtempSync(path.join(os.tmpdir(),'argos-full-bridge-'));
 const probe=net.createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
 const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.resolve('bridge/sinbad-bridge.ps1'),'-Port',String(port),'-ExchangeRoot',data],{windowsHide:true,stdio:['ignore','pipe','pipe']});
 let output='',errors='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>errors+=b);
 t.after(async()=>{if(child.exitCode===null){child.kill();await new Promise(resolve=>child.once('exit',resolve));}fs.rmSync(data,{recursive:true,force:true});});
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{clearInterval(poll);reject(Error('Bridge boot timeout: '+errors));},25000);const poll=setInterval(()=>{if(output.includes('Sinbad Bridge is online:')){clearTimeout(timer);clearInterval(poll);resolve();}else if(child.exitCode!==null){clearTimeout(timer);clearInterval(poll);reject(Error('Bridge startup failed: '+errors));}},100);});
 const base=`http://127.0.0.1:${port}`;
 const status=await fetch(base+'/argos/status',{signal:AbortSignal.timeout(12000)});assert.equal(status.status,200);assert.equal((await status.json()).ownerBoundary.enforced,true);
 for(const [route,action] of [['/routes','ROUTE_WRITE'],['/routes/open','PHYSICAL_HANDOFF'],['/library/ingest','LIBRARY_WRITE'],['/library/reindex','LIBRARY_INDEX_WRITE'],['/opencpn/start','PHYSICAL_HANDOFF'],['/opencpn/input','PHYSICAL_HANDOFF']]){
  const r=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json','X-Sinbad-Argos-Version':'sinbad-argos-command/1-v1','X-Sinbad-Argos-Action':action,'X-Sinbad-Argos-Target':route,'X-Sinbad-Argos-Command-Id':'browser-'+randomUUID(),'X-Sinbad-Argos-Requested-At':new Date().toISOString()},body:'{}',signal:AbortSignal.timeout(5000)});
  assert.equal(r.status,403,route);assert.equal((await r.json()).error,'BRIDGE_OWNER_BLOCKED',route);
 }
 assert.deepEqual(fs.readdirSync(path.join(data,'Routes')),[]);assert.deepEqual(fs.readdirSync(path.join(data,'Library/Imported')),[]);
});
