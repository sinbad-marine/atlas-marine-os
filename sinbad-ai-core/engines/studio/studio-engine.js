(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.SinbadStudioEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const VERSION='0.1.0';
  const MODE='PLAN_ONLY';
  const MAX_INSTRUCTION_LENGTH=12000;
  const DOMAINS=Object.freeze({
    web:/(web|website|site|sayfa|html|css|frontend|landing|portal|dashboard)/iu,
    software:/(software|yazılım|yazilim|program|uygulama|app\b|api\b|backend|kod|code|cli\b|desktop|mobile)/iu,
    animation:/(animasyon|animation|motion|storyboard|svg|canvas|webgl|three\.js|blender|video|vfx)/iu
  });
  const HARD_STOPS=Object.freeze([
    Object.freeze({code:'LIVE_PUBLISH_REQUIRES_APPROVAL',pattern:/(canlıya|yayınla|publish|deploy|production)/iu}),
    Object.freeze({code:'CORE_WRITE_REQUIRES_APPROVAL',pattern:/(core'a yaz|core’a yaz|çekirdeğe yaz|production'a yaz|production’a yaz)/iu}),
    Object.freeze({code:'DESTRUCTIVE_ACTION_REQUIRES_APPROVAL',pattern:/(sil|delete|overwrite|üzerine yaz|format|drop\s+(?:table|database))/iu}),
    Object.freeze({code:'EXTERNAL_DATA_REQUIRES_APPROVAL',pattern:/(grok|gemini|claude|cloud|harici api|external api|internete gönder|internete gonder)/iu}),
    Object.freeze({code:'SECRET_OR_IDENTITY_DATA_BLOCKED',pattern:/(api key|şifre|sifre|password|token|özel anahtar|private key|kimlik verisi|kişisel veri)/iu}),
    Object.freeze({code:'PURCHASE_REQUIRES_APPROVAL',pattern:/(satın al|satin al|ödeme|odeme|abonelik|purchase|subscribe|license accept)/iu})
  ]);
  const DOMAIN_STAGES=Object.freeze({
    web:Object.freeze(['information-architecture','accessible-interface','responsive-implementation','browser-verification']),
    software:Object.freeze(['requirements-contract','module-boundaries','implementation-plan','automated-verification']),
    animation:Object.freeze(['creative-brief','storyboard','asset-and-motion-plan','render-verification'])
  });

  const freeze=value=>{
    if(value&&typeof value==='object'&&!Object.isFrozen(value)){
      Object.values(value).forEach(freeze);Object.freeze(value);
    }
    return value;
  };
  const normalize=value=>String(value||'').normalize('NFKC')
    .replace(/[\u200B-\u200D\u2060\uFEFF]/gu,'').replace(/[\u0000-\u001F\u007F]/gu,' ')
    .replace(/\s+/gu,' ').trim().slice(0,MAX_INSTRUCTION_LENGTH);
  const slug=value=>normalize(value).toLocaleLowerCase('tr-TR').normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu,'').replace(/ı/gu,'i').replace(/[^a-z0-9]+/gu,'-')
    .replace(/^-+|-+$/gu,'').slice(0,48)||'studio-project';
  const detectedDomains=instruction=>Object.keys(DOMAINS).filter(domain=>DOMAINS[domain].test(instruction));
  const gates=instruction=>HARD_STOPS.filter(gate=>gate.pattern.test(instruction)).map(gate=>gate.code);
  const stages=domains=>[...new Set(['clarify-objective',...domains.flatMap(domain=>DOMAIN_STAGES[domain]),'human-review'])];

  function plan(input={}){
    const instruction=normalize(input.instruction);
    if(!instruction)return freeze({version:VERSION,mode:MODE,status:'CLARIFICATION_REQUIRED',instruction:'',domains:[],questions:['Ne hazırlamamı istiyorsunuz? Web sayfası, yazılım veya animasyon hedefini açıklayın.'],gates:[],execution:{allowed:false,performed:false},network:{allowed:false,performed:false},writes:{allowed:false,performed:false}});
    const domains=detectedDomains(instruction);
    if(!domains.length)return freeze({version:VERSION,mode:MODE,status:'CLARIFICATION_REQUIRED',instruction,domains:[],questions:['Bu çalışma web, yazılım veya animasyon alanlarından hangisine ait?','Başarı ölçütünü ve hedef kullanıcıyı belirtin.'],gates:gates(instruction),execution:{allowed:false,performed:false},network:{allowed:false,performed:false},writes:{allowed:false,performed:false}});
    const requiredGates=gates(instruction);
    const projectSlug=slug(input.projectName||instruction);
    return freeze({
      version:VERSION,mode:MODE,status:requiredGates.length?'APPROVAL_REQUIRED':'STUDIO_PLAN_READY',
      instruction,project:Object.freeze({name:normalize(input.projectName)||'Sinbad Studio Project',slug:projectSlug,proposedWorkspace:`studio-workspaces/${projectSlug}`}),
      domains:Object.freeze(domains),stages:Object.freeze(stages(domains)),gates:Object.freeze(requiredGates),
      questions:Object.freeze([
        ...(input.audience?[]:['Hedef kullanıcı kim?']),
        ...(input.acceptanceCriteria?[]:['Başarılı sonucu hangi ölçütlerle kabul edeceğiz?'])
      ]),
      constraints:Object.freeze(['SANDBOX_ONLY','NO_CORE_WRITE','NO_PRODUCTION_WRITE','NO_NETWORK','NO_SECRETS','NO_PUBLISH','HUMAN_REVIEW_REQUIRED']),
      execution:Object.freeze({allowed:false,performed:false}),network:Object.freeze({allowed:false,performed:false}),writes:Object.freeze({allowed:false,performed:false}),
      reviewers:Object.freeze({grok:'OPTIONAL_ONLINE_REVIEW_ONLY',gemini:'OPTIONAL_ONLINE_REVIEW_ONLY'})
    });
  }

  return freeze({VERSION,MODE,MAX_INSTRUCTION_LENGTH,plan});
});
