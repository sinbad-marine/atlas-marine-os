(function(root,factory){
  const load=path=>typeof module==='object'&&module.exports?require(path):null;
  const api=factory({
    contracts:load('./contracts.js')||root.SinbadRetrievalContracts,
    evaluator:load('./evidence-evaluator.js')||root.SinbadEvidenceEvaluator
  });
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.SinbadRetrievalEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(deps){
  function immutableList(items){return Object.freeze(items.map(item=>Object.freeze({...item})));}
  function create(options={}){
    const adapters=Object.freeze([...(Array.isArray(options.adapters)?options.adapters:[])]);
    const clock=typeof options.clock==='function'?options.clock:()=>Date.now();
    function run(input={},context={}){
      const request=deps.contracts.query(input);
      const audit=context.audit&&typeof context.audit.append==='function'?context.audit:null;
      const started=clock();const items=[];const rejected=[];const adapterMetrics=[];
      for(const adapter of adapters){
        const adapterStarted=clock();
        try{
          const result=adapter.search(request);
          const found=Array.isArray(result?.items)?result.items:[];
          items.push(...found);
          adapterMetrics.push(Object.freeze({adapterId:adapter.id,durationMs:Math.max(0,clock()-adapterStarted),itemCount:found.length,status:'OK'}));
        }catch(error){
          rejected.push(Object.freeze({adapterId:adapter.id,reason:'ADAPTER_ERROR',errorName:String(error?.name||'Error')}));
          adapterMetrics.push(Object.freeze({adapterId:adapter.id,durationMs:Math.max(0,clock()-adapterStarted),itemCount:0,status:'ERROR'}));
        }
      }
      const evaluation=deps.evaluator.evaluate({
        items,requireAuthoritative:request.requireAuthoritative,safetyCritical:request.safetyCritical,
        minimumRelevance:Number.isFinite(input.minimumRelevance)?input.minimumRelevance:undefined
      });
      const metrics=Object.freeze({durationMs:Math.max(0,clock()-started),adapterCount:adapters.length,adapterMetrics:Object.freeze(adapterMetrics)});
      const retrievalDetails=Object.freeze({
        queryId:request.id||null,adapters:Object.freeze(adapterMetrics.map(x=>x.adapterId)),
        candidates:items.length,rejected:immutableList(rejected),durationMs:metrics.durationMs
      });
      const evidenceDetails=Object.freeze({
        selected:Object.freeze(evaluation.selected.map(x=>x.id)),
        rejected:Object.freeze(evaluation.rejected.map(x=>Object.freeze({id:x.item.id,reason:x.reason}))),
        authoritative:Object.freeze(evaluation.authoritative.map(x=>x.id)),
        conflicts:Object.freeze(evaluation.conflicts.map(x=>x.claim))
      });
      if(audit){
        audit.append('retrieval','retrieval-engine',rejected.length?'partial':'passed','RETRIEVAL_COMPLETED',retrievalDetails);
        audit.append('evidence-evaluation','evidence-evaluator',evaluation.status==='EVIDENCE_SUFFICIENT'?'passed':'stopped',evaluation.status,evidenceDetails);
      }
      return Object.freeze({
        version:'sinbad-retrieval-engine/2A',status:evaluation.status,query:request,
        items:Object.freeze(items.map(deps.contracts.evidence)),evaluation,
        rejected:Object.freeze(rejected),metrics,
        security:Object.freeze({documentContentPolicy:'DATA_ONLY',systemAuthorityAcceptedFromDocuments:false})
      });
    }
    return Object.freeze({run});
  }
  return {create};
});

