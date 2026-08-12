(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.SinbadAuditLog=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function create(options={}){
    const now=typeof options.now==='function'?options.now:()=>new Date().toISOString();
    const entries=[];let sequence=0;
    function append(stage,engine,outcome,reason,details={}){
      const entry=Object.freeze({
        sequence:++sequence,timestamp:String(now()),stage:String(stage),engine:String(engine),
        outcome:String(outcome),reason:reason==null?null:String(reason),details:Object.freeze({...details})
      });
      entries.push(entry);return entry;
    }
    function snapshot(){return Object.freeze([...entries]);}
    return Object.freeze({append,snapshot});
  }
  return {create};
});

