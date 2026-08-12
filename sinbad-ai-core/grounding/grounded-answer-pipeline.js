(function(root,factory){
  const load=path=>typeof module==='object'&&module.exports?require(path):null;
  const api=factory({
    contracts:load('./contracts.js')||root.SinbadGroundingContracts,
    citations:load('./citation-builder.js')||root.SinbadCitationBuilder,
    confidence:load('./confidence-evaluator.js')||root.SinbadGroundingConfidenceEvaluator,
    verifier:load('../verification/claim-support-verifier.js')||root.SinbadClaimSupportVerifier,
    planner:load('../verification/claim-planner.js')||root.SinbadClaimPlanner,
    coverage:load('../verification/query-coverage-gate.js')||root.SinbadQueryCoverageGate,
    composer:load('./verified-answer-composer.js')||root.SinbadVerifiedAnswerComposer
  });
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.SinbadGroundedAnswerPipeline=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(deps){
  function create(options={}){
    const clock=typeof options.clock==='function'?options.clock:()=>Date.now();
    function run(input={},context={}){
      const totalStarted=clock();const retrieval=input.retrievalResult||{};const audit=context.audit&&typeof context.audit.append==='function'?context.audit:null;
      const evaluation=retrieval.evaluation||{};
      const selected=Array.isArray(evaluation.selected)?evaluation.selected:[];
      const rejected=[...(Array.isArray(evaluation.rejected)?evaluation.rejected:[]),...(Array.isArray(retrieval.rejected)?retrieval.rejected:[])];
      let status='GROUNDED';const warnings=[];const uncertainty=[];
      const adapterFailure=rejected.some(entry=>entry?.reason==='ADAPTER_ERROR');
      if(retrieval.status==='EVIDENCE_CONFLICT')status='EVIDENCE_CONFLICT';
      else if(adapterFailure&&retrieval.status!=='EVIDENCE_SUFFICIENT')status='RETRIEVAL_FAILURE';
      else if(retrieval.status!=='EVIDENCE_SUFFICIENT')status='SOURCE_INSUFFICIENT';

      const synthesisStarted=clock();
      const rawClaims=status==='GROUNDED'&&Array.isArray(input.claims)?input.claims:[];let verifications=[];
      if(status==='GROUNDED'&&!rawClaims.length){const expectedQueryHash=deps.planner&&input.planningQuery!=null?deps.planner.queryHash(input.planningQuery):null;const authenticPlan=deps.planner&&typeof deps.planner.isAuthenticPlan==='function'&&deps.planner.isAuthenticPlan(input.claimPlan)&&input.claimPlan.transactionId===String(input.transactionId||'')&&input.claimPlan.queryHash===expectedQueryHash;status=authenticPlan&&['NO_ELIGIBLE_CLAIMS','PLANNER_UNAVAILABLE'].includes(input.claimPlan.status)?'SOURCE_INSUFFICIENT':'INVALID_CLAIMS';}
      if(status==='GROUNDED'&&input.claimPlan&&!deps.coverage.isBoundSufficient(input.claimCoverage,{transactionId:input.transactionId,query:input.planningQuery}))status=deps.coverage.isBoundResult(input.claimCoverage,{transactionId:input.transactionId,query:input.planningQuery})?'SOURCE_INSUFFICIENT':'INVALID_CLAIMS';
      if(status==='GROUNDED'){try{verifications=deps.verifier.verifyAll(rawClaims,{selected,rejected,audit,transactionId:input.transactionId||null,historical:Boolean(input.historical)});}catch(error){if(error?.code==='PROVENANCE_INCOMPLETE')status='PROVENANCE_INCOMPLETE';else throw error;}}
      const synthesisDurationMs=Math.max(0,clock()-synthesisStarted);
      const citationResult=deps.citations.build({selected,rejected,claims:rawClaims,verifications,clock});
      if(status==='GROUNDED'){
        const states=new Set(verifications.map(x=>x.status));
        if(states.has('CLAIM_CONTRADICTED'))status='CLAIM_CONTRADICTED';
        else if(states.has('CLAIM_SCOPE_MISMATCH'))status='CLAIM_SCOPE_MISMATCH';
        else if(states.has('CLAIM_INVALID')||states.has('CLAIM_UNVERIFIABLE'))status='INVALID_CLAIMS';
        else if(states.has('CLAIM_AUTHORITY_INSUFFICIENT')||states.has('CLAIM_UNSUPPORTED'))status='SOURCE_INSUFFICIENT';
        else if(citationResult.errors.length)status='INVALID_CLAIMS';
      }
      const composerAvailable=deps.composer&&typeof deps.composer.compose==='function';
      const composition=status==='GROUNDED'&&composerAvailable?deps.composer.compose({claims:citationResult.claims,citations:citationResult.citations},{audit}):null;
      if(status==='GROUNDED'&&(!composition||composition.status!=='ANSWER_COMPOSED'))status='INVALID_CLAIMS';
      const outputClaims=status==='GROUNDED'?citationResult.claims:Object.freeze(citationResult.claims.map(claim=>deps.contracts.claim({...claim,citationIds:[]})));
      const outputCitations=status==='GROUNDED'?citationResult.citations:Object.freeze([]);
      const outputEvidenceUsed=status==='GROUNDED'?citationResult.evidenceUsed:Object.freeze([]);
      if(status!=='GROUNDED'){
        uncertainty.push(status);
        warnings.push(status==='EVIDENCE_CONFLICT'?'Conflicting evidence remains unresolved.':'Requested conclusion is not supported by sufficient evidence.');
      }
      const confidence=deps.confidence.evaluate({status,claims:outputClaims,citations:outputCitations});
      const answer=status==='GROUNDED'?composition.answer:null;
      const provenance=Object.freeze({
        retrievalVersion:retrieval.version||null,retrievalStatus:retrieval.status||null,
        selectedEvidence:Object.freeze(selected.map(item=>item.id)),
        rejectedEvidence:Object.freeze(rejected.map(entry=>Object.freeze({id:entry?.item?.id||entry?.id||null,reason:entry?.reason||'UNKNOWN'}))),
        claimEvidence:Object.freeze(outputClaims.map(claim=>Object.freeze({claimId:claim.claimId,evidenceIds:claim.evidenceIds,citationIds:claim.citationIds,verificationStatus:claim.verificationStatus}))),
        safeStopReason:status==='GROUNDED'?null:status
      });
      const metrics={synthesisDurationMs,citationDurationMs:citationResult.durationMs,totalDurationMs:Math.max(0,clock()-totalStarted)};
      if(audit){
        audit.append('grounded-synthesis','grounded-answer-pipeline',status==='GROUNDED'?'passed':'stopped',status,{claimCount:outputClaims.length});
        audit.append('citation-provenance','citation-builder',status==='GROUNDED'&&!citationResult.errors.length?'passed':'stopped',status==='GROUNDED'&&!citationResult.errors.length?'CITATIONS_RESOLVED':'CITATION_VALIDATION_FAILED',{citationCount:outputCitations.length,evidenceUsed:outputEvidenceUsed,errors:citationResult.errors});
        audit.append('grounded-confidence','confidence-evaluator',confidence.state==='NON_CONCLUSIVE'?'stopped':'passed',confidence.state,{reasons:confidence.reasons});
      }
      return deps.contracts.groundedAnswer({status,answer,claims:outputClaims,citations:outputCitations,composition,
        evidenceUsed:outputEvidenceUsed,evidenceRejected:provenance.rejectedEvidence,confidence,uncertainty,warnings,provenance,metrics});
    }
    return Object.freeze({run});
  }
  return {create};
});
