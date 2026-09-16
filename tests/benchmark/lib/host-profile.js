'use strict';
// Records the frozen runtime exactly as found: repo, bridge, models, library index, Kiwix, hardware.
// Everything here is read-only; nothing is refreshed, rebuilt or restarted.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const os=require('node:os');
const {execFileSync}=require('node:child_process');
const client=require('./bridge-client');

const ROOT=path.resolve(__dirname,'..','..','..');
function git(args){try{return execFileSync('git',args,{cwd:ROOT,encoding:'utf8',windowsHide:true}).trim();}catch{return null;}}
function powershell(script){try{return execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{encoding:'utf8',windowsHide:true,timeout:30000}).trim();}catch{return null;}}
function sha256File(file){try{return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}catch{return null;}}

async function collect(options={}){
  const baseUrl=options.baseUrl||client.DEFAULT_URL;
  const [status,argos,library]=await Promise.all([client.getJson('/status',{baseUrl}),client.getJson('/argos/status',{baseUrl}),client.getJson('/library/status',{baseUrl})]);
  let ollama=null;try{const r=await fetch('http://127.0.0.1:11434/api/tags',{signal:AbortSignal.timeout(5000)});ollama=await r.json();}catch{ollama=null;}
  let ollamaVersion=null;try{const r=await fetch('http://127.0.0.1:11434/api/version',{signal:AbortSignal.timeout(5000)});ollamaVersion=(await r.json()).version||null;}catch{ollamaVersion=null;}
  const stateFile=path.join(ROOT,'docs','academy','PROJECT_STATE.json');
  let projectState=null;try{const s=JSON.parse(fs.readFileSync(stateFile,'utf8'));projectState={last_verified_timestamp:s.last_verified_timestamp,current_phase:s.current_phase,sha256:sha256File(stateFile)};}catch{projectState=null;}
  const hardware=powershell("$cs=Get-CimInstance Win32_ComputerSystem;$os=Get-CimInstance Win32_OperatingSystem;$cpu=Get-CimInstance Win32_Processor|Select-Object -First 1;$gpu=@(Get-CimInstance Win32_VideoController|ForEach-Object{$_.Name});[pscustomobject]@{cpu=$cpu.Name;cores=$cpu.NumberOfCores;threads=$cpu.NumberOfLogicalProcessors;ramTotalGb=[math]::Round($cs.TotalPhysicalMemory/1GB,1);ramFreeGb=[math]::Round($os.FreePhysicalMemory/1MB,1);gpu=$gpu;osVersion=$os.Version}|ConvertTo-Json -Compress");
  let hardwareJson=null;try{hardwareJson=JSON.parse(hardware);}catch{hardwareJson={raw:hardware};}
  const libraryFolder=status.data?.libraryFolder||null;
  let indexFile=null;
  if(libraryFolder){const file=path.join(libraryFolder,'.sinbad-index.json');try{const stat=fs.statSync(file);indexFile={path:file,bytes:stat.size,modifiedUtc:stat.mtime.toISOString()};}catch{indexFile=null;}}
  return Object.freeze({
    capturedAt:new Date().toISOString(),
    repo:{head:git(['rev-parse','HEAD']),shortHead:git(['rev-parse','--short','HEAD']),branch:git(['rev-parse','--abbrev-ref','HEAD']),dirty:(git(['status','--porcelain'])||'')!=='',commitDate:git(['log','-1','--format=%cI']),commitCount:Number(git(['rev-list','--count','HEAD'])||0),projectState},
    bridge:{reachable:status.ok,version:status.data?.version||null,name:status.data?.name||null,routes:status.data?.routes??null,ai:status.data?.ai||null,worldKnowledge:status.data?.worldKnowledge||null,argos:argos.data?{state:argos.data.state,mode:argos.data.mode,commandGate:argos.data.commandGate,ownerBoundary:argos.data.ownerBoundary?{configured:argos.data.ownerBoundary.configured,enforced:argos.data.ownerBoundary.enforced,authorization:argos.data.ownerBoundary.authorization}:null}:null},
    library:{status:library.data||null,indexFile},
    ollama:{version:ollamaVersion,models:(ollama?.models||[]).map(m=>({name:m.name,digest:m.digest,size:m.size,quantization:m.details?.quantization_level||null,parameters:m.details?.parameter_size||null,contextLength:m.details?.context_length||null,modifiedAt:m.modified_at}))},
    host:{platform:process.platform,release:os.release(),node:process.version,hardware:hardwareJson}
  });
}
// Library document titles are read from the on-disk index (read-only) for citation verification.
function libraryTitles(indexPath,maxBytes=512*1024*1024){
  try{const stat=fs.statSync(indexPath);if(stat.size>maxBytes)return {titles:[],reason:'INDEX_TOO_LARGE'};const data=JSON.parse(fs.readFileSync(indexPath,'utf8'));return {titles:(data.documents||[]).map(d=>String(d.title||'')).filter(Boolean),reason:null,builtAt:data.builtAt||null};}
  catch(error){return {titles:[],reason:String(error?.message||error)};}
}
module.exports=Object.freeze({ROOT,collect,libraryTitles,sha256File});
