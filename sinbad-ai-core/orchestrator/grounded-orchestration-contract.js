(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.SinbadGroundedOrchestrationContract=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const STATUSES=Object.freeze([
    'GROUNDED_PLAN_READY','PLAN_ONLY_READY','INVALID_INPUT','LOW_CONFIDENCE','SAFETY_BLOCKED',
    'ROUTING_BLOCKED','SOURCE_INSUFFICIENT','EVIDENCE_CONFLICT','RETRIEVAL_FAILURE',
    'INVALID_CLAIMS','PIPELINE_ERROR'
  ]);
  function immutableArray(value,mapper=x=>x){return Object.freeze((Array.isArray(value)?value:[]).map(mapper));}
  function result(input={}){
    return Object.freeze({
      version:'sinbad-grounded-orchestrator/2C',transactionId:String(input.transactionId||''),
      status:STATUSES.includes(input.status)?input.status:'PIPELINE_ERROR',
      intent:input.intent||null,safety:input.safety||null,context:input.context||null,
      routing:input.routing||null,
      execution:Object.freeze({mode:'PLAN_ONLY',allowed:false,expertExecutionPerformed:false}),
      retrieval:Object.freeze({required:Boolean(input.retrieval?.required),status:input.retrieval?.status||null,metrics:input.retrieval?.metrics||null}),
      evidence:Object.freeze({status:input.evidence?.status||null,selected:immutableArray(input.evidence?.selected,String),rejected:immutableArray(input.evidence?.rejected,x=>Object.freeze({...x}))}),
      groundedAnswer:input.groundedAnswer||null,
      citations:immutableArray(input.citations,x=>x),provenance:input.provenance||null,
      confidence:input.confidence||null,warnings:immutableArray(input.warnings,String),
      audit:immutableArray(input.audit,x=>Object.freeze({...x})),
      metrics:Object.freeze({...((input.metrics&&typeof input.metrics==='object')?input.metrics:{})}),
      security:Object.freeze({planOnly:true,expertExecutionPerformed:false,navigationExecutionPerformed:false,navigationMathematicsActivated:false,freeFormClaimGeneration:false,liveOrWebRetrieval:false})
    });
  }
  return {STATUSES,result};
});
