(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.SinbadGroundedOrchestrationContract=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const authenticResults=new WeakSet();
  const STATUSES=Object.freeze([
    'GROUNDED_PLAN_READY','PLAN_ONLY_READY','INVALID_INPUT','LOW_CONFIDENCE','SAFETY_BLOCKED',
    'ROUTING_BLOCKED','SOURCE_INSUFFICIENT','EVIDENCE_CONFLICT','RETRIEVAL_FAILURE',
    'INVALID_CLAIMS','PROVENANCE_INCOMPLETE','CLAIM_CONTRADICTED','CLAIM_SCOPE_MISMATCH','PIPELINE_ERROR'
  ]);
  function immutableArray(value,mapper=x=>x){return Object.freeze((Array.isArray(value)?value:[]).map(mapper));}
  function result(input={}){
    const output=Object.freeze({
      version:'sinbad-grounded-orchestrator/2M',transactionId:String(input.transactionId||''),
      status:STATUSES.includes(input.status)?input.status:'PIPELINE_ERROR',
      intent:input.intent||null,safety:input.safety||null,context:input.context||null,
      routing:input.routing||null,
      execution:Object.freeze({mode:'PLAN_ONLY',allowed:false,expertExecutionPerformed:false}),
      retrieval:Object.freeze({required:Boolean(input.retrieval?.required),status:input.retrieval?.status||null,metrics:input.retrieval?.metrics||null}),
      evidence:Object.freeze({status:input.evidence?.status||null,selected:immutableArray(input.evidence?.selected,String),rejected:immutableArray(input.evidence?.rejected,x=>Object.freeze({...x}))}),
      groundedAnswer:input.groundedAnswer||null,
      answerSeal:input.answerSeal&&typeof input.answerSeal==='object'?Object.freeze({schemaVersion:String(input.answerSeal.schemaVersion||''),sealerVersion:String(input.answerSeal.sealerVersion||''),status:String(input.answerSeal.status||''),reasonCode:input.answerSeal.reasonCode==null?null:String(input.answerSeal.reasonCode),transactionId:String(input.answerSeal.transactionId||''),queryHash:String(input.answerSeal.queryHash||''),answerHash:String(input.answerSeal.answerHash||''),mapVerifierVersion:String(input.answerSeal.mapVerifierVersion||''),evidenceIds:immutableArray(input.answerSeal.evidenceIds,String),sealHash:input.answerSeal.sealHash==null?null:String(input.answerSeal.sealHash)}):null,
      answerRelease:input.answerRelease&&typeof input.answerRelease==='object'?Object.freeze({schemaVersion:String(input.answerRelease.schemaVersion||''),gateVersion:String(input.answerRelease.gateVersion||''),status:String(input.answerRelease.status||''),reasonCode:input.answerRelease.reasonCode==null?null:String(input.answerRelease.reasonCode),transactionId:String(input.answerRelease.transactionId||''),queryHash:String(input.answerRelease.queryHash||''),answerHash:String(input.answerRelease.answerHash||''),sealHash:String(input.answerRelease.sealHash||''),evidenceIds:immutableArray(input.answerRelease.evidenceIds,String),citationIds:immutableArray(input.answerRelease.citationIds,String),releaseHash:input.answerRelease.releaseHash==null?null:String(input.answerRelease.releaseHash)}):null,
      publicResponse:input.publicResponse&&typeof input.publicResponse==='object'?Object.freeze({schemaVersion:String(input.publicResponse.schemaVersion||''),projectorVersion:String(input.publicResponse.projectorVersion||''),renderingPolicy:String(input.publicResponse.renderingPolicy||''),contentType:String(input.publicResponse.contentType||''),status:String(input.publicResponse.status||''),reasonCode:input.publicResponse.reasonCode==null?null:String(input.publicResponse.reasonCode),transactionId:String(input.publicResponse.transactionId||''),answer:String(input.publicResponse.answer||''),answerHash:String(input.publicResponse.answerHash||''),releaseHash:String(input.publicResponse.releaseHash||''),citations:immutableArray(input.publicResponse.citations,citation=>Object.freeze({id:String(citation?.id||''),title:citation?.title==null?null:String(citation.title),location:Object.freeze({section:citation?.location?.section==null?null:String(citation.location.section),page:citation?.location?.page==null?null:String(citation.location.page),chunk:citation?.location?.chunk==null?null:String(citation.location.chunk),uri:citation?.location?.uri==null?null:String(citation.location.uri)}),publishedAt:citation?.publishedAt==null?null:String(citation.publishedAt),version:citation?.version==null?null:String(citation.version),authority:citation?.authority==null?null:String(citation.authority),verified:citation?.verified===true,metadataComplete:citation?.metadataComplete===true})),responseHash:input.publicResponse.responseHash==null?null:String(input.publicResponse.responseHash)}):null,
      claimPlan:input.claimPlan||null,
      claimCoverage:input.claimCoverage||null,
      citations:immutableArray(input.citations,x=>x),provenance:input.provenance||null,
      confidence:input.confidence||null,warnings:immutableArray(input.warnings,String),
      audit:immutableArray(input.audit,x=>Object.freeze({...x})),
      metrics:Object.freeze({...((input.metrics&&typeof input.metrics==='object')?input.metrics:{})}),
      security:Object.freeze({planOnly:true,expertExecutionPerformed:false,navigationExecutionPerformed:false,navigationMathematicsActivated:false,freeFormClaimGeneration:false,liveOrWebRetrieval:false,publicProjectionRequired:true})
    });
    authenticResults.add(output);return output;
  }
  function isAuthenticResult(value){return Boolean(value&&typeof value==='object'&&authenticResults.has(value));}
  return {STATUSES,result,isAuthenticResult};
});
