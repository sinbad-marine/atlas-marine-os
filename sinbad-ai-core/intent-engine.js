(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.SinbadIntentEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const RULES=Object.freeze([
    rule('emergency',100,/(?:\bmayday\b|\bpan[ -]?pan\b|\bsos\b|acil durum|yang[ıi]n|su al[ıi]yor|adam denize|man overboard|karaya otur|distress)/giu),
    rule('navigation',80,/(?:\brota(?:y[ıiuü]|s[ıi]|n[ıi]|dan|ya)?(?=\s|$|[.,;:!?])|seyir|navigasyon|navigation|\bcourse\b|kerteriz|bearing|mevki|position|\bcpa\b|\btcpa\b|ak[ıi]nt[ıi]|current|gelgit|\btide\b|r[üu]zg[aâ]r|\bwind\b|pusula|compass|mercator|traverse)/giu),
    rule('passage',70,/(?:passage|sefer plan[ıi]|seyir plan[ıi]|berth[ -]?to[ -]?berth|yak[ıi]t plan[ıi]|port of refuge)/giu),
    rule('publication',60,/(?:yay[ıi]n|publication|\bsolas\b|\bmarpol\b|\bcolreg\b|notice to mariners|sailing directions|pilot book|almanak|almanac)/giu),
    rule('training',50,/(?:e[ğg]itim|[öo][ğg]ret|\bquiz\b|s[ıi]nav|\bders\b|training|a[çc][ıi]kla|explain)/giu),
    rule('crew',45,/(?:m[üu]rettebat|\bcrew\b|sertifika|certificate|\bstcw\b|medical|passport|\bvisa\b|kontrat|contract)/giu),
    rule('vessel',40,/(?:\bgemi\b|\btekne\b|\bvessel\b|\bfleet\b|\bfilo\b|draft|su [çc]ekimi|makine|engine)/giu),
    rule('document',35,/(?:\bbelge\b|dok[üu]man|document|\bdosya\b|\bfile\b|\bchart\b|harita|library|k[üu]t[üu]phane)/giu)
  ]);

  function rule(intent,priority,pattern){return Object.freeze({intent,priority,pattern});}
  function normalize(value){return String(value||'').trim().normalize('NFKC');}
  function detectLanguage(value){
    const text=normalize(value);
    if(/[çğıöşüİ]/i.test(text)||/\b(?:ve|için|nedir|hesapla|rota|gemi)\b/i.test(text))return 'tr';
    if(/[а-яё]/i.test(text))return 'ru';
    if(/[\u0600-\u06ff]/u.test(text))return 'ar';
    if(/\b(?:und|für|schiff|kurs)\b/i.test(text))return 'de';
    if(/\b(?:bonjour|navire|route maritime)\b/i.test(text))return 'fr';
    return 'en';
  }
  function countMatches(text,pattern){
    pattern.lastIndex=0;
    const matches=text.match(pattern);
    pattern.lastIndex=0;
    return matches?matches.length:0;
  }
  function analyze(query){
    const text=normalize(query);
    const ranked=RULES.map(item=>{
      const matches=countMatches(text,item.pattern);
      return {intent:item.intent,matches,score:matches?item.priority+Math.min(matches,5)*4:0};
    }).filter(item=>item.score>0).sort((a,b)=>b.score-a.score||b.matches-a.matches);
    const primary=ranked[0]||{intent:'general',matches:0,score:0};
    const confidence=primary.intent==='general'?0.35:Math.min(0.98,0.72+primary.matches*0.08-(ranked.length>1?0.06:0));
    return Object.freeze({
      query:text,
      language:detectLanguage(text),
      intent:primary.intent,
      secondaryIntents:Object.freeze(ranked.slice(1).map(item=>item.intent)),
      confidence,
      evidence:Object.freeze(ranked.map(item=>Object.freeze({...item})))
    });
  }
  return {RULES,normalize,detectLanguage,analyze};
});
