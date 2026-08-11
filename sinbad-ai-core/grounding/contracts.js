(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.SinbadGroundingContracts=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const STATUSES=Object.freeze(['GROUNDED','SOURCE_INSUFFICIENT','EVIDENCE_CONFLICT','RETRIEVAL_FAILURE','INVALID_CLAIMS','PROVENANCE_INCOMPLETE']);
  const CONFIDENCE_STATES=Object.freeze(['HIGH','MODERATE','LOW','NON_CONCLUSIVE']);

  function immutableArray(value,mapper=x=>x){
    return Object.freeze((Array.isArray(value)?value:[]).map(mapper));
  }
  function nullable(value){return value==null||String(value).trim()===''?null:String(value);}
  function citation(input={}){
    return Object.freeze({
      id:String(input.id||''),claimId:String(input.claimId||''),evidenceId:String(input.evidenceId||''),
      sourceId:nullable(input.sourceId),sourceType:nullable(input.sourceType),sourceClass:nullable(input.sourceClass),
      title:nullable(input.title),location:Object.freeze({
        section:nullable(input.location?.section),page:nullable(input.location?.page),
        chunk:nullable(input.location?.chunk),uri:nullable(input.location?.uri)
      }),publishedAt:nullable(input.publishedAt),version:nullable(input.version),
      authority:nullable(input.authority),verified:Boolean(input.verified),metadataComplete:Boolean(input.metadataComplete),
      provenance:Object.freeze({...((input.provenance&&typeof input.provenance==='object')?input.provenance:{})})
    });
  }
  function claim(input={}){
    return Object.freeze({
      id:String(input.id||''),text:String(input.text||''),
      evidenceIds:immutableArray(input.evidenceIds,String),
      citationIds:immutableArray(input.citationIds,String),
      requiresAuthoritative:Boolean(input.requiresAuthoritative),supported:Boolean(input.supported)
    });
  }
  function confidence(input={}){
    return Object.freeze({
      state:CONFIDENCE_STATES.includes(input.state)?input.state:'NON_CONCLUSIVE',
      reasons:immutableArray(input.reasons,String)
    });
  }
  function groundedAnswer(input={}){
    return Object.freeze({
      version:'sinbad-grounded-answer/2B',
      status:STATUSES.includes(input.status)?input.status:'INVALID_CLAIMS',
      answer:input.answer==null?null:String(input.answer),
      claims:immutableArray(input.claims,claim),citations:immutableArray(input.citations,citation),
      evidenceUsed:immutableArray(input.evidenceUsed,String),
      evidenceRejected:immutableArray(input.evidenceRejected,x=>Object.freeze({...x})),
      confidence:confidence(input.confidence),uncertainty:immutableArray(input.uncertainty,String),
      warnings:immutableArray(input.warnings,String),provenance:Object.freeze({...((input.provenance&&typeof input.provenance==='object')?input.provenance:{})}),
      metrics:Object.freeze({...((input.metrics&&typeof input.metrics==='object')?input.metrics:{})}),
      security:Object.freeze({documentContentPolicy:'DATA_ONLY',documentInstructionsExecuted:false,expertExecutionPerformed:false})
    });
  }
  return {STATUSES,CONFIDENCE_STATES,citation,claim,confidence,groundedAnswer};
});
