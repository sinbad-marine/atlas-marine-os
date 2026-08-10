(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.SinbadSafetyEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const LIVE_DATA=/(?:şimdi|simdi|güncel|guncel|bugün|bugun|yarın|yarin|hava|weather|navtex|\bmsi\b|notice to mariners|liman a[çc][ıi]k|\btraffic\b|\bais\b)/iu;
  const OPERATIONAL=/(?:hesapla|calculate|tutulacak rota|course to steer|uygula|execute|ba[şs]lat|de[ğg]i[şs]tir|manevra|approach|yana[şs]|demirle|anchor now)/iu;
  const DECISION_DOMAINS=new Set(['emergency','navigation','passage']);

  function gate(code,severity,message,blocking=false){return Object.freeze({code,severity,message,blocking});}
  function assess(analysis={}){
    const query=String(analysis.query||'');
    const emergency=analysis.intent==='emergency';
    const operational=OPERATIONAL.test(query);
    const needsLiveData=LIVE_DATA.test(query);
    const decisionDomain=DECISION_DOMAINS.has(analysis.intent);
    const risk=emergency?'critical':operational&&decisionDomain?'high':needsLiveData?'medium':'low';
    const gates=[];
    if(emergency)gates.push(gate('EMERGENCY_HUMAN_COMMAND','critical','Activate human command and approved emergency procedures immediately.',true));
    if(needsLiveData)gates.push(gate('LIVE_DATA_REQUIRED','high','Obtain current authoritative operational data; model memory is not live data.',false));
    if(decisionDomain)gates.push(gate('INDEPENDENT_VERIFICATION','high','Verify with approved sources, onboard instruments and an independent method.',false));
    if(emergency||risk==='high')gates.push(gate('HUMAN_APPROVAL_REQUIRED','high','The master or responsible operator retains the final decision.',false));
    return Object.freeze({
      risk,emergency,operational,needsLiveData,
      requiresHumanApproval:emergency||risk==='high',
      requiresIndependentVerification:decisionDomain||needsLiveData,
      blockedFromAutonomousAction:emergency,
      gates:Object.freeze(gates)
    });
  }
  function warningMessages(assessment={}){
    return Object.freeze((assessment.gates||[]).map(item=>item.message));
  }
  return {assess,warningMessages};
});

