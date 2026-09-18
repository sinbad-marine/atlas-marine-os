'use strict';
// Deterministic builders for the Draft Adapter v0 tests. The sample answers are written for the
// tests in the shape the cloud answer function produces (prose with inline [S#] markers); they are
// not recorded production answers.
const d=require('../../adapter/draft-adapter-v0.js');
const k=require('../../chain/chain-v0.js');
const {s,h,NOW,context}=require('./sentinel-v0-builders.js');
const passage=(n,changes)=>({marker:`S${n}`,evidenceId:`ev-doc-${n}`,sourceClass:'DOCUMENT',locatorRef:`library:doc-${n}:chunk-0`,contentHash:h(String(n)),observedAt:NOW-500,scopeRef:'scope:alpha',...changes});
const input=(text,changes)=>({version:d.INPUT_VERSION,adaptationId:'adapt-1',at:NOW,context:context(),answer:{text,originRef:'model:draft'},passages:[passage(1),passage(2)],retrievedAt:NOW-100,proposedActions:[],...changes});
const POLICY=Object.freeze({maxEvidenceAgeMs:10_000,volatileMaxEvidenceAgeMs:1_000,maxIterations:3,labelledDelivery:'PROCEED'});
// rehearseOne(adapted) -> ChainTranscript of the single pass the adapter produced.
const rehearseOne=(adapted,changes)=>k.rehearse({version:k.INPUT_VERSION,chainId:'chain-adapted',at:NOW,context:context(),passes:[JSON.parse(JSON.stringify(adapted.chainPass))],policy:{...POLICY},priorTranscriptDigest:null,...changes});
const pieces=(adapted,text)=>adapted.segments.map(x=>text.slice(x.start,x.end));
module.exports={d,k,s,h,NOW,context,passage,input,POLICY,rehearseOne,pieces};
