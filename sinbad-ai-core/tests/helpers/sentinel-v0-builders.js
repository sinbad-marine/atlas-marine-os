'use strict';
// Deterministic builders for the Sentinel v0 tests. Every value is fixed; no clocks, no randomness.
const s=require('../../sentinel/sentinel-v0.js');
const t=require('../../authority/task-context.js');
const e=require('../../authority/evidence-set.js');
const h=c=>String(c).repeat(64);
const NOW=1_000_000;
const context=changes=>({version:t.VERSION,taskId:'task-1',workflowRef:'workflow:alpha',surfaceRef:'surface:x',principalRef:'principal:p',authorityRefs:[],evidenceScopeRef:'scope:alpha',stateSnapshotRef:null,language:'en',requestedAt:NOW-10_000,expiresAt:NOW+50_000,...changes});
const item=changes=>({evidenceId:'ev-repo',sourceClass:'REPOSITORY',locatorRef:'git:main:docs/state.json',contentHash:h('b'),observedAt:NOW-500,scopeRef:'scope:alpha',...changes});
const ITEMS=Object.freeze({
  repo:item(),
  memory:item({evidenceId:'ev-memory',sourceClass:'MODEL_MEMORY',locatorRef:'memory:1',contentHash:h('c')}),
  foreign:item({evidenceId:'ev-foreign',sourceClass:'LIVE_SYSTEM',locatorRef:'http://127.0.0.1/status',contentHash:h('d'),scopeRef:'scope:beta'}),
  stale:item({evidenceId:'ev-stale',sourceClass:'DATABASE',locatorRef:'db:table:row-1',contentHash:h('e'),observedAt:NOW-100_000}),
  drift:item({evidenceId:'ev-drift',locatorRef:'git:main:docs/state.json',contentHash:h('f'),observedAt:NOW-400}),
  directive:item({evidenceId:'ev-directive',sourceClass:'OWNER_DIRECTIVE',locatorRef:'directive:2026-09-17:go',contentHash:h('a')}),
  live:item({evidenceId:'ev-live',sourceClass:'LIVE_SYSTEM',locatorRef:'http://127.0.0.1/health',contentHash:h('9')})
});
const set=(items,changes)=>({version:e.VERSION,setId:'set-1',taskRef:'task-1',items,retrievedAt:NOW-100,...changes});
function claim(claimId,changes){
  const base={claimId,contentHash:h('0'),text:null,evidenceIds:[],originRef:'model:draft',originScopeRef:'scope:alpha',assertionMode:'ASSERTED',...changes};
  if(typeof base.text==='string'&&!Object.hasOwn(changes||{},'contentHash'))base.contentHash=s.sha256(base.text);
  return base;
}
const input=changes=>({version:s.INPUT_VERSION,observationId:'obs-1',tap:'POST_DRAFT',observedAt:NOW,context:context(),evidenceSet:set([ITEMS.repo]),claims:[],policy:{maxEvidenceAgeMs:10_000},priorReportDigest:null,...changes});
const claimOf=(report,claimId)=>report.claims.find(c=>c.claimId===claimId);
const rule=(report,ruleId)=>report.ruleResults.find(r=>r.ruleId===ruleId);
const flagsOf=(report,claimId)=>report.flags.filter(f=>f.pointerRef.startsWith(`claim:${claimId}:`));
module.exports={s,t,e,h,NOW,context,item,ITEMS,set,claim,input,claimOf,rule,flagsOf};
