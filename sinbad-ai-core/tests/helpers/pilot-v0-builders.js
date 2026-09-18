'use strict';
// Deterministic builders for the Pilot v0 tests. The records Pilot v0 reads are produced here, in
// the test, by the merged Gatekeeper v0 and Co-Pilot v0; Pilot v0 itself never runs them.
const p=require('../../pilot/pilot-v0.js');
const g=require('../../gatekeeper/gatekeeper-v0.js');
const c=require('../../copilot/copilot-v0.js');
const {s,h,NOW,context,item,ITEMS,set,claim}=require('./sentinel-v0-builders.js');
const DRAFT_HASH=h('7');
const citation=(citationId,evidenceId)=>({citationId,evidenceId});
const action=(actionId,changes)=>({actionId,actionClass:'READ',protected:false,authorityRef:null,...changes});
const draft=changes=>({draftId:'draft-1',draftHash:DRAFT_HASH,claims:[],citations:[],proposedActions:[],...changes});
const plain=x=>JSON.parse(JSON.stringify(x));
// records({context,evidenceSet,draft,withReview}) -> {gateDecision, review}: the pair a pipeline would hand to the Pilot.
function records(changes){
  const o={context:context(),evidenceSet:set([ITEMS.repo]),draft:draft(),withReview:true,...changes};
  const review=o.withReview?c.review({version:c.INPUT_VERSION,reviewId:'review-1',verdictId:'verdict-1',issuedAt:NOW-2,context:o.context,evidenceSet:o.evidenceSet,draft:o.draft,policy:{maxEvidenceAgeMs:10_000},priorReviewDigest:null}):null;
  const gateDecision=g.decide({version:g.INPUT_VERSION,decisionId:'decision-1',observedAt:NOW-1,context:o.context,evidenceSet:o.evidenceSet,draft:o.draft,verdict:review&&review.verdict?plain(review.verdict):null,policy:{maxEvidenceAgeMs:10_000,volatileMaxEvidenceAgeMs:1_000},priorDecisionDigest:null});
  return {gateDecision:plain(gateDecision),review:review?plain(review):null};
}
const input=changes=>({version:p.INPUT_VERSION,pilotDecisionId:'pilot-1',decidedAt:NOW,context:context(),draftRef:{draftId:'draft-1',draftHash:DRAFT_HASH},gateDecision:null,review:null,iterationIndex:0,policy:{maxIterations:3,labelledDelivery:'PROCEED'},priorPilotDecisionDigest:null,...changes});
// run(recordChanges, inputChanges): build the records for a draft and ask the Pilot about them.
const run=(recordChanges,inputChanges)=>{const o=recordChanges||{};return p.decide(input({...(o.context?{context:o.context}:{}),...records(o),...inputChanges}));};
const asks=decision=>decision.findings.map(f=>`${f.ref}>${f.asks}`);
module.exports={p,g,c,s,h,NOW,DRAFT_HASH,context,item,ITEMS,set,claim,citation,action,draft,plain,records,input,run,asks};
