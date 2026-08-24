(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.SinbadExpertContract=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const ID=/^[a-z][a-z0-9-]{2,63}$/;
  const FIELDS=new Set(['id','name','version','intents','capabilities','priority','minConfidence','requiresVerifiedSources','supportsMultiExpert','canHandle','execute']);
  function normalize(input={}){
    if(!input||typeof input!=='object'||Array.isArray(input)||Object.getPrototypeOf(input)!==Object.prototype||Object.getOwnPropertySymbols(input).length)throw new TypeError('expert must be a plain object');
    const descriptors=Object.getOwnPropertyDescriptors(input);
    if(Object.values(descriptors).some(descriptor=>!Object.hasOwn(descriptor,'value')))throw new TypeError('expert accessors are forbidden');
    if(Object.keys(descriptors).some(key=>!FIELDS.has(key)))throw new TypeError('expert fields are not allowlisted');
    const source={};for(const [key,descriptor] of Object.entries(descriptors))source[key]=descriptor.value;
    for(const field of ['execute','canHandle']){
      const descriptor=descriptors[field];
      if(descriptor)throw new TypeError(`expert ${field} callbacks are forbidden in Core`);
    }
    if(Object.values(descriptors).some(descriptor=>typeof descriptor.value==='function'))throw new TypeError('expert functions are forbidden in Core');
    const id=String(source.id||'').trim();
    if(!ID.test(id))throw new TypeError('expert id must be a lowercase kebab-case identifier');
    if(!Array.isArray(source.intents)||source.intents.some(value=>typeof value!=='string'))throw new TypeError('expert intents must be strings');
    if(source.capabilities!==undefined&&(!Array.isArray(source.capabilities)||source.capabilities.some(value=>typeof value!=='string')))throw new TypeError('expert capabilities must be strings');
    const intents=[...new Set(source.intents.filter(Boolean))];
    if(!intents.length)throw new TypeError('expert must declare at least one intent');
    const capabilities=Object.freeze([...new Set((source.capabilities||[]).filter(Boolean))]);
    return Object.freeze({
      id,name:String(source.name||id),version:String(source.version||'1.0.0'),
      intents:Object.freeze(intents),capabilities,
      priority:Number.isFinite(source.priority)?Number(source.priority):50,
      minConfidence:Number.isFinite(source.minConfidence)?Math.max(0,Math.min(1,Number(source.minConfidence))):0.6,
      requiresVerifiedSources:Boolean(source.requiresVerifiedSources),
      supportsMultiExpert:source.supportsMultiExpert!==false
    });
  }
  function interfaceView(expert){
    const value=normalize(expert);
    return Object.freeze({id:value.id,name:value.name,version:value.version,intents:value.intents,capabilities:value.capabilities});
  }
  return {normalize,interfaceView};
});

