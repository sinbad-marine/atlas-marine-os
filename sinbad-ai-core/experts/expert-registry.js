(function(root,factory){
  const contract=typeof module==='object'&&module.exports?require('./expert-contract.js'):root.SinbadExpertContract;
  const api=factory(contract);
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.SinbadExpertRegistry=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(contract){
  function create(){
    const experts=new Map();
    function register(input){
      const expert=contract.normalize(input);
      if(experts.has(expert.id))throw new Error(`expert already registered: ${expert.id}`);
      experts.set(expert.id,expert);return expert;
    }
    function unregister(id){return experts.delete(String(id));}
    function get(id){return experts.get(String(id))||null;}
    function list(){return Object.freeze([...experts.values()].sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id)));}
    function candidates(intent,request={}){
      return Object.freeze(list().filter(expert=>expert.intents.includes(intent)&&(!expert.canHandle||expert.canHandle(request)!==false)));
    }
    return Object.freeze({register,unregister,get,list,candidates});
  }
  return {create};
});

