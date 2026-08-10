(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.SinbadMemoryPolicy=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const SENSITIVE=/(?:password|parola|şifre|sifre|api[ _-]?key|access[ _-]?token|secret|passport|pasaport|kimlik no|medical record|sağlık kaydı|saglik kaydi|credit card|kredi kart[ıi])/iu;
  const TEMPORARY=/(?:şu an|su an|şimdi|simdi|bugün|bugun|current position|mevcut mevki|anlık mevki|anlik mevki|\beta\b|hava durumu|weather|gelgit|\btide\b|\bais\b|\bcpa\b|\btcpa\b|course to steer|tutulacak rota|fuel remaining|kalan yak[ıi]t)/iu;
  const SAFETY_CRITICAL=/(?:mayday|pan[ -]?pan|acil durum|emergency|distress|yang[ıi]n|su al[ıi]yor|adam denize|man overboard|çatışma riski|catisma riski)/iu;
  const PREFERENCE_KEYS=Object.freeze(['language','units','tone','theme','voice','accessibility','dateFormat','timeFormat']);

  function inspect(value,metadata={}){
    const text=String(value??'').trim();
    const category=String(metadata.category||'general');
    const sensitive=Boolean(metadata.sensitive)||SENSITIVE.test(text);
    const temporary=Boolean(metadata.temporary)||TEMPORARY.test(text);
    const safetyCritical=Boolean(metadata.safetyCritical)||SAFETY_CRITICAL.test(text)||category==='operational';
    return Object.freeze({text,category,sensitive,temporary,safetyCritical});
  }
  function persistentDecision(value,metadata={}){
    const flags=inspect(value,metadata);
    if(!metadata.explicitConsent)return Object.freeze({allowed:false,reason:'EXPLICIT_CONSENT_REQUIRED',flags});
    if(!flags.text)return Object.freeze({allowed:false,reason:'EMPTY_MEMORY',flags});
    if(flags.sensitive)return Object.freeze({allowed:false,reason:'SENSITIVE_DATA',flags});
    if(flags.temporary)return Object.freeze({allowed:false,reason:'TEMPORARY_DATA',flags});
    if(flags.safetyCritical)return Object.freeze({allowed:false,reason:'SAFETY_CRITICAL_DATA',flags});
    return Object.freeze({allowed:true,reason:'ALLOWED',flags});
  }
  function preferenceDecision(key,value){
    if(!PREFERENCE_KEYS.includes(String(key)))return Object.freeze({allowed:false,reason:'UNSUPPORTED_PREFERENCE'});
    if(value==null||String(value).trim()==='')return Object.freeze({allowed:false,reason:'EMPTY_PREFERENCE'});
    if(SENSITIVE.test(String(value)))return Object.freeze({allowed:false,reason:'SENSITIVE_DATA'});
    return Object.freeze({allowed:true,reason:'ALLOWED'});
  }
  function provenance(input={}){
    const sourceType=['official','sensor','user','memory','system'].includes(input.sourceType)?input.sourceType:'memory';
    const canBeAuthoritative=sourceType==='official'||sourceType==='sensor';
    return Object.freeze({
      sourceType,
      sourceId:input.sourceId==null?null:String(input.sourceId),
      authority:canBeAuthoritative&&input.authority==='authoritative'?'authoritative':'advisory',
      verifiedAt:input.verifiedAt==null?null:String(input.verifiedAt)
    });
  }
  return {PREFERENCE_KEYS,inspect,persistentDecision,preferenceDecision,provenance};
});

