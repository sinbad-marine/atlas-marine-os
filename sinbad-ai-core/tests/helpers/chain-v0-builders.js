'use strict';
// Deterministic builders for the Offline Chain v0 tests; reuses the Sentinel v0 fixtures.
const k=require('../../chain/chain-v0.js');
const {s,h,NOW,context,item,ITEMS,set,claim}=require('./sentinel-v0-builders.js');
const citation=(citationId,evidenceId)=>({citationId,evidenceId});
const action=(actionId,changes)=>({actionId,actionClass:'READ',protected:false,authorityRef:null,...changes});
// Each draft gets its own hash so that passes are distinguishable.
const draft=(n,changes)=>({draftId:`draft-${n}`,draftHash:h(String(n)),claims:[],citations:[],proposedActions:[],...changes});
const pass=(d,evidenceSet)=>({evidenceSet:evidenceSet===undefined?set([ITEMS.repo]):evidenceSet,draft:d});
const POLICY=Object.freeze({maxEvidenceAgeMs:10_000,volatileMaxEvidenceAgeMs:1_000,maxIterations:3,labelledDelivery:'PROCEED'});
const input=changes=>({version:k.INPUT_VERSION,chainId:'chain-1',at:NOW,context:context(),passes:[pass(draft(1))],policy:{...POLICY},priorTranscriptDigest:null,...changes});
const TEXT='The state file records the phase.';
const supported=(n,changes)=>draft(n,{claims:[claim('c1',{text:TEXT,evidenceIds:['ev-repo']})],citations:[citation('cit-1','ev-repo')],...changes});
const invention=n=>draft(n,{claims:[claim('c1',{text:'PR #254 was merged as c506f21 and is VERIFIED.'})]});
const trail=t=>t.steps.map(x=>`${x.gate.outcome}>${x.pilot.decision}`);
module.exports={k,s,h,NOW,context,item,ITEMS,set,claim,citation,action,draft,pass,POLICY,input,TEXT,supported,invention,trail};
