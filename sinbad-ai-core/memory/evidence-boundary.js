(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.SinbadMemoryEvidenceBoundary=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function labelMemory(item){
    return Object.freeze({
      kind:'memory',content:String(item?.value??''),recordId:item?.id||null,
      authority:'advisory',mayReplaceOfficialSource:false,
      warning:'Memory is context only and is not a verified maritime source.'
    });
  }
  function labelVerifiedSource(source){
    if(!source||source.provenance?.authority!=='authoritative')throw new TypeError('verified source requires authoritative provenance');
    return Object.freeze({kind:'verified-source',content:String(source.content??''),sourceId:source.provenance.sourceId||null,authority:'authoritative',mayReplaceOfficialSource:true});
  }
  function partition(items=[]){
    const memory=[];const verified=[];const advisory=[];
    for(const item of items){
      if(item?.kind==='memory'||['session','persistent','operational'].includes(item?.kind))memory.push(labelMemory(item));
      else if(item?.provenance?.authority==='authoritative')verified.push(labelVerifiedSource(item));
      else advisory.push(Object.freeze({...item,authority:'advisory'}));
    }
    return Object.freeze({memory:Object.freeze(memory),verified:Object.freeze(verified),advisory:Object.freeze(advisory)});
  }
  return {labelMemory,labelVerifiedSource,partition};
});

