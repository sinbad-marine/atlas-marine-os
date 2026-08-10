(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.SinbadAiCoreContracts=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const INTENTS=Object.freeze(['emergency','navigation','passage','publication','training','crew','vessel','document','general']);
  const RISKS=Object.freeze(['low','medium','high','critical']);
  const ROLES=Object.freeze(['user','assistant']);

  function request(input={}){
    return Object.freeze({
      id:String(input.id||''),
      question:String(input.question||'').trim(),
      language:String(input.language||'en'),
      history:Array.isArray(input.history)?input.history:[],
      context:input.context&&typeof input.context==='object'?input.context:{},
      createdAt:String(input.createdAt||new Date().toISOString())
    });
  }

  function decision(input={}){
    return Object.freeze({
      intent:INTENTS.includes(input.intent)?input.intent:'general',
      secondaryIntents:Array.isArray(input.secondaryIntents)?input.secondaryIntents.filter(x=>INTENTS.includes(x)):[],
      risk:RISKS.includes(input.risk)?input.risk:'low',
      confidence:Number.isFinite(input.confidence)?Math.max(0,Math.min(1,input.confidence)):0,
      needsLiveData:Boolean(input.needsLiveData),
      requiresHumanApproval:Boolean(input.requiresHumanApproval),
      requiresIndependentVerification:Boolean(input.requiresIndependentVerification)
    });
  }

  function result(input={}){
    return Object.freeze({
      handled:Boolean(input.handled),
      expert:input.expert==null?null:String(input.expert),
      answer:input.answer==null?null:String(input.answer),
      warnings:Array.isArray(input.warnings)?input.warnings.map(String):[],
      sources:Array.isArray(input.sources)?input.sources:[],
      decision:decision(input.decision||{})
    });
  }

  return {INTENTS,RISKS,ROLES,request,decision,result};
});

