(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.SinbadExpertRouter=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function create(registry,options={}){
    if(!registry||typeof registry.candidates!=='function')throw new TypeError('expert registry is required');
    const defaultMinConfidence=Number.isFinite(options.minConfidence)?Number(options.minConfidence):0.6;
    function plan(input={}){
      const analysis=input.analysis||{};const safety=input.safety||{};
      const requested=[analysis.intent,...(analysis.secondaryIntents||[]),...(input.requiredIntents||[])]
        .filter(intent=>intent&&intent!=='general');
      const intents=[...new Set(requested)];
      const confidence=Number.isFinite(analysis.confidence)?analysis.confidence:0;
      const routes=[];const gaps=[];
      if(confidence<defaultMinConfidence){
        gaps.push(Object.freeze({intent:analysis.intent||'general',reason:'LOW_CONFIDENCE',confidence,required:defaultMinConfidence}));
      }else{
        for(const intent of intents){
          const candidates=registry.candidates(intent,{analysis,safety,context:input.context||{}})
            .filter(expert=>confidence>=expert.minConfidence);
          if(!candidates.length){
            const known=registry.candidates(intent,{analysis,safety,context:input.context||{}});
            gaps.push(Object.freeze({intent,reason:known.length?'EXPERT_CONFIDENCE_TOO_LOW':'EXPERT_NOT_AVAILABLE',confidence}));
            continue;
          }
          const selected=candidates[0];
          routes.push(Object.freeze({intent,expertId:selected.id,expertVersion:selected.version,capabilities:selected.capabilities,requiresVerifiedSources:selected.requiresVerifiedSources}));
        }
      }
      const uniqueRoutes=[];const seen=new Set();
      for(const route of routes)if(!seen.has(route.expertId)){seen.add(route.expertId);uniqueRoutes.push(route);}
      const multiExpert=uniqueRoutes.length>1;
      const blockedBySafety=Boolean(safety.blockedFromAutonomousAction);
      return Object.freeze({
        routable:uniqueRoutes.length>0&&!blockedBySafety,
        executionAllowed:uniqueRoutes.length>0&&!blockedBySafety&&gaps.length===0,
        multiExpert,blockedBySafety,
        routes:Object.freeze(uniqueRoutes),gaps:Object.freeze(gaps),
        notice:gaps.length?'Required expertise is unavailable or confidence is insufficient; no expert result may be invented.':null
      });
    }
    return Object.freeze({plan});
  }
  return {create};
});

