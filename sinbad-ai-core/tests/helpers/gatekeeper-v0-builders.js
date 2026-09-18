'use strict';
// Deterministic builders for the Gatekeeper v0 tests; reuses the Sentinel v0 fixtures.
const g=require('../../gatekeeper/gatekeeper-v0.js');
const v=require('../../authority/copilot-verdict.js');
const sentinelBuilders=require('./sentinel-v0-builders.js');
const {s,h,NOW,context,item,ITEMS,set,claim}=sentinelBuilders;
const DRAFT_HASH=h('7');
const citation=(citationId,evidenceId)=>({citationId,evidenceId});
const action=(actionId,changes)=>({actionId,actionClass:'READ',protected:false,authorityRef:null,...changes});
const draft=changes=>({draftId:'draft-1',draftHash:DRAFT_HASH,claims:[],citations:[],proposedActions:[],...changes});
const verdict=changes=>({version:v.VERSION,verdictId:'verdict-1',taskRef:'task-1',draftHash:DRAFT_HASH,warnings:[],recommendation:'ALLOW',issuedAt:NOW-1,authority:'NONE',...changes});
const warn=changes=>({warningClass:'FALSE_CERTAINTY',severity:'WARN',checkerKind:'MODEL',evidenceIds:[],pointerRef:null,...changes});
const input=changes=>({version:g.INPUT_VERSION,decisionId:'decision-1',observedAt:NOW,context:context(),evidenceSet:set([ITEMS.repo]),draft:draft(),verdict:null,policy:{maxEvidenceAgeMs:10_000,volatileMaxEvidenceAgeMs:1_000},priorDecisionDigest:null,...changes});
const rule=(decision,ruleId)=>decision.ruleResults.find(r=>r.ruleId===ruleId);
const failed=decision=>decision.ruleResults.filter(r=>r.outcome==='FAIL').map(r=>r.ruleId);
const actionOf=(decision,actionId)=>decision.actions.find(a=>a.actionId===actionId);
const labelOf=(decision,claimId)=>decision.claimLabels.find(c=>c.claimId===claimId);
module.exports={g,v,s,h,NOW,DRAFT_HASH,context,item,ITEMS,set,claim,citation,action,draft,verdict,warn,input,rule,failed,actionOf,labelOf};
