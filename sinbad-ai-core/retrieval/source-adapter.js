(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.SinbadRetrievalSourceAdapter=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const ID=/^[a-z][a-z0-9-]{2,63}$/;
  function create(input={}){
    const id=String(input.id||'').trim();
    if(!ID.test(id))throw new TypeError('source adapter id must be lowercase kebab-case');
    if(typeof input.search!=='function')throw new TypeError('source adapter search function is required');
    return Object.freeze({id,kind:String(input.kind||'offline-library'),search:input.search});
  }
  return {create};
});

