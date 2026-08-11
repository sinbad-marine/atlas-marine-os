(function(root,factory){
  const load=path=>typeof module==='object'&&module.exports?require(path):null;
  const api=factory({
    contracts:load('./contracts.js')||root.SinbadGroundingContracts,
    citations:load('./citation-builder.js')||root.SinbadCitationBuilder,
    confidence:load('./confidence-evaluator.js')||root.SinbadGroundingConfidenceEvaluator
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
      const rawClaims=status==='GROUNDED'&&Array.isArray(input.claims)?input.claims:[];
      const synthesisDurationMs=Math.max(0,clock()-synthesisStarted);
      const citationResult=deps.citations.build({selected,rejected,claims:rawClaims,clock});
      if(status==='GROUNDED'&&citationResult.errors.length)status=citationResult.errors.some(x=>x.reason==='PROVENANCE_INCOMPLETE')?'PROVENANCE_INCOMPLETE':citationResult.errors.some(x=>x.reason==='AUTHORITATIVE_SUPPORT_MISSING')?'SOURCE_INSUFFICIENT':'INVALID_CLAIMS';
      if(status!=='GROUNDED'){
        uncertainty.push(status);
        warnings.push(status==='EVIDENCE_CONFLICT'?'Conflicting evidence remains unresolved.':'Requested conclusion is not supported by sufficient evidence.');
      }
      const confidence=deps.confidence.evaluate({status,claims:citationResult.claims,citations:citationResult.citations});
      const answer=status==='GROUNDED'?rawClaims.map(claim=>String(claim.text||'')).filter(Boolean).join(' '):null;
      const provenance=Object.freeze({
        retrievalVersion:retrieval.version||null,retrievalStatus:retrieval.status||null,
        selectedEvidence:Object.freeze(selected.map(item=>item.id)),
        rejectedEvidence:Object.freeze(rejected.map(entry=>Object.freeze({id:entry?.item?.id||entry?.id||null,reason:entry?.reason||'UNKNOWN'}))),
        claimEvidence:Object.freeze(citationResult.claims.map(claim=>Object.freeze({claimId:claim.id,evidenceIds:claim.evidenceIds,citationIds:claim.citationIds}))),
        safeStopReason:status==='GROUNDED'?null:status
      });
      const metrics={synthesisDurationMs,citationDurationMs:citationResult.durationMs,totalDurationMs:Math.max(0,clock()-totalStarted)};
      if(audit){
        audit.append('grounded-synthesis','grounded-answer-pipeline',status==='GROUNDED'?'passed':'stopped',status,{claimCount:citationResult.claims.length});
        audit.append('citation-provenance','citation-builder',citationResult.errors.length?'stopped':'passed',citationResult.errors.length?'CITATION_VALIDATION_FAILED':'CITATIONS_RESOLVED',{citationCount:citationResult.citations.length,evidenceUsed:citationResult.evidenceUsed,errors:citationResult.errors});
        audit.append('grounded-confidence','confidence-evaluator',confidence.state==='NON_CONCLUSIVE'?'stopped':'passed',confidence.state,{reasons:confidence.reasons});
      }
      return deps.contracts.groundedAnswer({status,answer,claims:citationResult.claims,citations:citationResult.citations,
        evidenceUsed:citationResult.evidenceUsed,evidenceRejected:provenance.rejectedEvidence,confidence,uncertainty,warnings,provenance,metrics});
    }
    return Object.freeze({run});
  }
  return {create};
});
