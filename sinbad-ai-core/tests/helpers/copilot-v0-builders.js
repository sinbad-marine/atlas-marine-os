'use strict';
// Deterministic builders for the Co-Pilot v0 tests; reuses the Sentinel v0 fixtures.
const c=require('../../copilot/copilot-v0.js');
const v=require('../../authority/copilot-verdict.js');
const sentinelBuilders=require('./sentinel-v0-builders.js');
const {s,h,NOW,context,item,ITEMS,set,claim}=sentinelBuilders;
const DRAFT_HASH=h('7');
const citation=(citationId,evidenceId)=>({citationId,evidenceId});
const action=(actionId,changes)=>({actionId,actionClass:'READ',protected:false,authorityRef:null,...changes});
const draft=changes=>({draftId:'draft-1',draftHash:DRAFT_HASH,claims:[],citations:[],proposedActions:[],...changes});
const input=changes=>({version:c.INPUT_VERSION,reviewId:'review-1',verdictId:'verdict-1',issuedAt:NOW,context:context(),evidenceSet:set([ITEMS.repo]),draft:draft(),policy:{maxEvidenceAgeMs:10_000},priorReviewDigest:null,...changes});
const checker=(review,checkerId)=>review.checkers.find(x=>x.checkerId===checkerId);
const warned=review=>review.checkers.filter(x=>x.outcome==='WARNED').map(x=>x.checkerId);
const warningsOf=(review,warningClass)=>review.verdict.warnings.filter(w=>w.warningClass===warningClass);
const pointers=review=>review.verdict.warnings.map(w=>w.pointerRef);
module.exports={c,v,s,h,NOW,DRAFT_HASH,context,item,ITEMS,set,claim,citation,action,draft,input,checker,warned,warningsOf,pointers};
