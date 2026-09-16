'use strict';
// Resource sampling (read-only). CPU load and free RAM come from CIM (the classic performance-counter
// API is broken on this host: c0000bb8), GPU 3D-engine utilization from the GPU Engine counters, and
// the loaded model set from `ollama ps`. Failures are recorded, never invented.
const {execFileSync}=require('node:child_process');
function powershell(script,timeout=20000){try{return execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{encoding:'utf8',windowsHide:true,timeout}).trim();}catch(error){return null;}}
function sample(){
  const raw=powershell("$cpu=(Get-CimInstance Win32_Processor|Select-Object -First 1).LoadPercentage;$os=Get-CimInstance Win32_OperatingSystem;$gpu=$null;try{$s=(Get-Counter '\\GPU Engine(*engtype_3D)\\Utilization Percentage' -ErrorAction Stop).CounterSamples;$gpu=[math]::Round((($s|Measure-Object -Property CookedValue -Sum).Sum),1)}catch{$gpu=$null};[pscustomobject]@{cpuLoadPercent=$cpu;ramFreeMb=[math]::Round($os.FreePhysicalMemory/1024);ramTotalMb=[math]::Round($os.TotalVisibleMemorySize/1024);gpu3dPercent=$gpu}|ConvertTo-Json -Compress");
  let data={cpuLoadPercent:null,ramFreeMb:null,ramTotalMb:null,gpu3dPercent:null,error:'SAMPLE_FAILED'};
  try{if(raw)data={...JSON.parse(raw),error:null};}catch{}
  return {at:new Date().toISOString(),...data};
}
async function ollamaLoaded(){
  try{const r=await fetch('http://127.0.0.1:11434/api/ps',{signal:AbortSignal.timeout(5000)});const j=await r.json();return (j.models||[]).map(m=>({name:m.name,sizeVram:m.size_vram??null,size:m.size??null,expiresAt:m.expires_at||null}));}
  catch{return null;}
}
module.exports=Object.freeze({sample,ollamaLoaded});
