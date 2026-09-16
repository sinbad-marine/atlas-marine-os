'use strict';
const {percentile}=require('./scoring');

function summarize(results){
  const byCategory={};
  for(const r of results){
    const c=byCategory[r.category]||(byCategory[r.category]={tests:0,PASS:0,PARTIAL:0,FAIL:0,NOT_SUPPORTED:0,ERROR:0,latencyMs:[],tiers:{}});
    c.tests++;c[r.outcome]=(c[r.outcome]||0)+1;
    if(Number.isFinite(r.latencyMs))c.latencyMs.push(r.latencyMs);
    const tier=r.response?.modelTier||'n/a';c.tiers[tier]=(c.tiers[tier]||0)+1;
  }
  const out={};
  for(const [category,c] of Object.entries(byCategory)){
    out[category]={tests:c.tests,PASS:c.PASS,PARTIAL:c.PARTIAL,FAIL:c.FAIL,NOT_SUPPORTED:c.NOT_SUPPORTED,ERROR:c.ERROR,passRate:c.tests?Number((c.PASS/c.tests).toFixed(3)):null,latency:{count:c.latencyMs.length,p50Ms:percentile(c.latencyMs,50),p95Ms:percentile(c.latencyMs,95),maxMs:c.latencyMs.length?Math.max(...c.latencyMs):null},tiers:c.tiers};
  }
  return out;
}
function latencyByTier(results){
  const tiers={};
  for(const r of results){const tier=r.response?.modelTier;if(!tier||!Number.isFinite(r.latencyMs))continue;(tiers[tier]||(tiers[tier]=[])).push(r.latencyMs);}
  return Object.fromEntries(Object.entries(tiers).map(([tier,values])=>[tier,{count:values.length,p50Ms:percentile(values,50),p95Ms:percentile(values,95),maxMs:Math.max(...values)}]));
}
function resourceProfile(results){
  const cpu=[],ram=[],gpu=[];
  for(const r of results){for(const s of [r.resourcesBefore,r.resourcesAfter]){if(!s)continue;if(Number.isFinite(s.cpuLoadPercent))cpu.push(s.cpuLoadPercent);if(Number.isFinite(s.ramFreeMb))ram.push(s.ramFreeMb);if(Number.isFinite(s.gpu3dPercent))gpu.push(s.gpu3dPercent);}}
  const stats=values=>values.length?{samples:values.length,min:Math.min(...values),p50:percentile(values,50),max:Math.max(...values)}:{samples:0};
  return {cpuLoadPercent:stats(cpu),ramFreeMb:stats(ram),gpu3dPercent:stats(gpu)};
}
function fmt(value){return value===null||value===undefined?'n/a':typeof value==='number'?(Number.isInteger(value)?String(value):value.toFixed(1)):String(value);}
function markdown(run){
  const lines=[];
  lines.push(`# ${run.runId} — Sinbad benchmark run (${run.benchmarkVersion})`,'',`Captured ${run.startedAt} → ${run.finishedAt}. Repo ${run.profile.repo.shortHead} (${run.profile.repo.dirty?'DIRTY':'clean'}), bridge ${fmt(run.profile.bridge.version)}, model ${fmt(run.profile.bridge.ai?.model)}, library index built ${fmt(run.profile.library.status?.builtAt)}, Kiwix ${fmt(run.profile.bridge.worldKnowledge?.state)}.`,'');
  lines.push('## Summary','','| Category | Tests | PASS | PARTIAL | FAIL | NOT_SUPPORTED | ERROR | p50 ms | p95 ms | Capability |','|---|---|---|---|---|---|---|---|---|---|');
  for(const [category,s] of Object.entries(run.summary)){lines.push(`| ${category} | ${s.tests} | ${s.PASS} | ${s.PARTIAL} | ${s.FAIL} | ${s.NOT_SUPPORTED} | ${s.ERROR} | ${fmt(s.latency.p50Ms)} | ${fmt(s.latency.p95Ms)} | ${run.capabilities?.[category]||''} |`);}
  lines.push('','## Latency by model tier','','| Tier | Calls | p50 ms | p95 ms | max ms |','|---|---|---|---|---|');
  for(const [tier,s] of Object.entries(run.latencyByTier))lines.push(`| ${tier} | ${s.count} | ${fmt(s.p50Ms)} | ${fmt(s.p95Ms)} | ${fmt(s.maxMs)} |`);
  lines.push('','## Resources (samples around each call)','',`CPU load % ${JSON.stringify(run.resources.cpuLoadPercent)}; free RAM MB ${JSON.stringify(run.resources.ramFreeMb)}; GPU 3D % ${JSON.stringify(run.resources.gpu3dPercent)}.`,'');
  lines.push('## Per-test results','','| ID | Category | Outcome | Observed | Tier | ms | Note |','|---|---|---|---|---|---|---|');
  for(const r of run.results)lines.push(`| ${r.id} | ${r.category} | ${r.outcome} | ${r.observed||''} | ${r.response?.modelTier||''} | ${fmt(r.latencyMs)} | ${String(r.note||'').replace(/\|/gu,'/').slice(0,140)} |`);
  lines.push('','## Failure examples','');
  for(const r of run.results.filter(x=>x.outcome==='FAIL').slice(0,40)){lines.push(`### ${r.id} (${r.category})`,'',`Prompt: ${String(r.prompt||'').replace(/\s+/gu,' ').slice(0,300)}`,'',`Answer: ${String(r.answer||'').replace(/\s+/gu,' ').slice(0,600)}`,'',`Verdict detail: ${JSON.stringify(r.detail||{}).slice(0,400)}`,'');}
  return lines.join('\n')+'\n';
}
module.exports=Object.freeze({summarize,latencyByTier,resourceProfile,markdown});
