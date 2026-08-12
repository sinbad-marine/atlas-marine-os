(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.SinbadExpertContract=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const ID=/^[a-z][a-z0-9-]{2,63}$/;
  function normalize(input={}){
    const id=String(input.id||'').trim();
    if(!ID.test(id))throw new TypeError('expert id must be a lowercase kebab-case identifier');
    const intents=[...new Set((Array.isArray(input.intents)?input.intents:[]).map(String).filter(Boolean))];
    if(!intents.length)throw new TypeError('expert must declare at least one intent');
    const capabilities=Object.freeze([...new Set((input.capabilities||[]).map(String).filter(Boolean))]);
    return Object.freeze({
      id,name:String(input.name||id),version:String(input.version||'1.0.0'),
      intents:Object.freeze(intents),capabilities,
      priority:Number.isFinite(input.priority)?Number(input.priority):50,
      minConfidence:Number.isFinite(input.minConfidence)?Math.max(0,Math.min(1,Number(input.minConfidence))):0.6,
      requiresVerifiedSources:Boolean(input.requiresVerifiedSources),
      supportsMultiExpert:input.supportsMultiExpert!==false,
      canHandle:typeof input.canHandle==='function'?input.canHandle:null,
      execute:typeof input.execute==='function'?input.execute:null
    });
  }
  function interfaceView(expert){
    const value=normalize(expert);
    return Object.freeze({id:value.id,name:value.name,version:value.version,intents:value.intents,capabilities:value.capabilities});
  }
  return {normalize,interfaceView};
});

