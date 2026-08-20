export const CORE_GATE_VERSION='1.0.0';
export const normalizeCoreQuestion=value=>String(value||'').trim().slice(0,6000);

const EMERGENCY=/(mayday|pan[ -]?pan|sos|acil|yangın|yangin|su alıyor|su aliyor|çatışma|catisma|karaya otur|adam denize|man overboard|distress)/iu;
const NAVIGATION=/(rota|seyir|navigasyon|navigation|course|kerteriz|bearing|mevki|position|cpa|tcpa|akıntı|akinti|current|gelgit|tide|rüzgâr|ruzgar|wind|mesafe|distance|eta|pusula|compass)/iu;
const PASSAGE=/(passage|sefer plan|seyir plan|berth.to.berth|checklist|yakıt plan|yakit plan|port of refuge)/iu;
const LIVE_DATA=/(şimdi|simdi|güncel|guncel|bugün|bugun|yarın|yarin|hava|weather|navtex|msi|notice to mariners|liman açık|liman acik|traffic|ais)/iu;
const OPERATIONAL=/(hesapla|calculate|tutulacak rota|course to steer|uygula|execute|başlat|baslat|değiştir|degistir|manevra|approach|yanaş|yanas)/iu;

export function serverCoreDecision(value){
  const question=normalizeCoreQuestion(value);
  const emergency=EMERGENCY.test(question);
  const navigation=!emergency&&NAVIGATION.test(question);
  const passage=!emergency&&!navigation&&PASSAGE.test(question);
  const operational=OPERATIONAL.test(question);
  const needsLiveData=LIVE_DATA.test(question);
  const risk=emergency?'critical':operational&&navigation?'high':needsLiveData?'medium':'low';
  return {emergency,operational,needsLiveData,risk,requiresHumanApproval:emergency||risk==='high',requiresIndependentVerification:emergency||navigation||passage||needsLiveData};
}

export function validateCoreEnvelope(envelope,value){
  const question=normalizeCoreQuestion(value);
  if(!envelope||envelope.version!=='sinbad-ai-core/1'||envelope.gateVersion!==CORE_GATE_VERSION||envelope.analysis?.query!==question)return false;
  const expected=serverCoreDecision(question);
  return Object.entries(expected).every(([key,result])=>envelope.analysis?.[key]===result);
}
