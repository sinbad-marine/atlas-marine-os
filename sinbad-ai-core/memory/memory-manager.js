(function(root,factory){
  const policy=typeof module==='object'&&module.exports?require('./policy.js'):root.SinbadMemoryPolicy;
  const api=factory(policy);
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.SinbadMemoryManager=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(policy){
  function create(options={}){
    const now=typeof options.now==='function'?options.now:()=>Date.now();
    const session=[];
    const persistent=[];
    const operational=new Map();
    const preferences=new Map();
    let sequence=0;
    const id=prefix=>`${prefix}-${++sequence}`;
    const record=(kind,value,metadata={})=>Object.freeze({
      id:id(kind),kind,value:String(value),createdAt:new Date(now()).toISOString(),
      provenance:policy.provenance(metadata.provenance||{sourceType:kind==='operational'?'sensor':'memory'})
    });

    function rememberSession(value,metadata={}){
      const item=record('session',value,metadata);session.push(item);return Object.freeze({accepted:true,item});
    }
    function rememberPersistent(value,metadata={}){
      const decision=policy.persistentDecision(value,metadata);
      if(!decision.allowed)return Object.freeze({accepted:false,reason:decision.reason});
      const item=record('persistent',value,metadata);persistent.push(item);return Object.freeze({accepted:true,item});
    }
    function setOperational(key,value,metadata={}){
      const ttlMs=Math.max(1,Number(metadata.ttlMs)||300000);
      const item=record('operational',value,{...metadata,provenance:metadata.provenance||{sourceType:'sensor'}});
      const entry=Object.freeze({...item,key:String(key),expiresAt:new Date(now()+ttlMs).toISOString()});
      operational.set(String(key),entry);return Object.freeze({accepted:true,item:entry});
    }
    function setPreference(key,value){
      const decision=policy.preferenceDecision(key,value);
      if(!decision.allowed)return Object.freeze({accepted:false,reason:decision.reason});
      const item=Object.freeze({key:String(key),value:String(value),updatedAt:new Date(now()).toISOString()});
      preferences.set(item.key,item);return Object.freeze({accepted:true,item});
    }
    function activeOperational(){
      const time=now();
      for(const [key,item] of operational)if(Date.parse(item.expiresAt)<=time)operational.delete(key);
      return [...operational.values()];
    }
    function snapshot(){
      return Object.freeze({
        session:Object.freeze([...session]),persistent:Object.freeze([...persistent]),
        operational:Object.freeze(activeOperational()),preferences:Object.freeze([...preferences.values()])
      });
    }
    function clearSession(){session.length=0;operational.clear();}
    return Object.freeze({rememberSession,rememberPersistent,setOperational,setPreference,snapshot,clearSession});
  }
  return {create};
});

