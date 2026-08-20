(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.SinbadCoreDecision=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const CORE_GATE_VERSION='1.1.0';
  const INTENTS=[
    ['emergency',/(mayday|pan[ -]?pan|sos|acil|yangın|yangin|su alıyor|su aliyor|çatışma|catisma|karaya otur|adam denize|man overboard|distress)/i],
    ['navigation',/(rota|seyir|navigasyon|navigation|course|kerteriz|bearing|mevki|position|cpa|tcpa|akıntı|akinti|current|gelgit|tide|rüzgâr|ruzgar|wind|mesafe|distance|eta|pusula|compass)/i],
    ['passage',/(passage|sefer plan|seyir plan|berth.to.berth|checklist|yakıt plan|yakit plan|port of refuge)/i],
    ['publication',/(yayın|yayin|publication|solas|marpol|colreg|notice to mariners|sailing directions|pilot book|almanac|almanak)/i],
    ['training',/(eğitim|egitim|öğret|ogret|quiz|sınav|sinav|ders|academy|training|explain|açıkla|acikla)/i],
    ['crew',/(mürettebat|murettebat|crew|sertifika|certificate|stcw|medical|passport|visa|kontrat|contract)/i],
    ['vessel',/(gemi|tekne|vessel|fleet|filo|draft|su çekimi|su cekimi|makine|engine)/i],
    ['document',/(belge|doküman|dokuman|document|dosya|file|chart|harita|library|kütüphane|kutuphane)/i]
  ];
  const LIVE_DATA=/(şimdi|simdi|güncel|guncel|bugün|bugun|yarın|yarin|today|tomorrow|latest|forecast|hava|weather|rüzgâr|rüzgar|navtex|msi|son notice|notice to mariners|liman açık|liman acik|port open|traffic|ais|current)/i;
  const OPERATIONAL=/(hesapla|calculate|tutulacak rota|course to steer|uygula|execute|başlat|baslat|değiştir|degistir|manevra|approach|yanaş|yanas)/i;

  const normalizeCoreQuestion=value=>String(value||'').normalize('NFKC').replace(/[\u200B-\u200D\u2060\uFEFF]/gu,'').trim().slice(0,6000);
  const normalizeCoreHistory=(value,limit=10)=>(Array.isArray(value)?value:[]).slice(-Math.max(1,Math.min(12,Number(limit)||10))).map(item=>({
    role:item?.role==='assistant'||item?.role==='sinbad'?'assistant':'user',content:String(item?.content??item?.text??'').normalize('NFKC').replace(/[\u200B-\u200D\u2060\uFEFF]/gu,'').trim().slice(0,2000)
  })).filter(item=>item.content);
  function analyzeCore(value){
    const query=normalizeCoreQuestion(value);
    const matches=INTENTS.filter(([,pattern])=>pattern.test(query)).map(([intent])=>intent);
    const intent=matches[0]||'general',emergency=intent==='emergency',operational=OPERATIONAL.test(query),needsLiveData=LIVE_DATA.test(query);
    const risk=emergency?'critical':operational?'high':needsLiveData?'medium':'low';
    return {query,intent,secondaryIntents:matches.slice(1),emergency,operational,needsLiveData,risk,requiresHumanApproval:emergency||risk==='high',requiresIndependentVerification:emergency||intent==='navigation'||intent==='passage'||needsLiveData};
  }
  function serverCoreDecision(value){
    const decision=analyzeCore(value);
    return {emergency:decision.emergency,operational:decision.operational,needsLiveData:decision.needsLiveData,risk:decision.risk,requiresHumanApproval:decision.requiresHumanApproval,requiresIndependentVerification:decision.requiresIndependentVerification};
  }
  function validateCoreEnvelope(envelope,value){
    const question=normalizeCoreQuestion(value);
    if(!envelope||envelope.version!=='sinbad-ai-core/1'||envelope.gateVersion!==CORE_GATE_VERSION||envelope.analysis?.query!==question)return false;
    const expected=serverCoreDecision(question);
    return Object.entries(expected).every(([key,result])=>envelope.analysis?.[key]===result);
  }
  return {CORE_GATE_VERSION,normalizeCoreQuestion,normalizeCoreHistory,analyzeCore,serverCoreDecision,validateCoreEnvelope};
});
