(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.SinbadNavigationAssistant=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const SOURCE='Sinbad Navigation Engine v0.2.0';
  const WARNING='Eğitim ve karar desteğidir; gerçek seyirde onaylı yayınlar, güncel cihaz verileri ve bağımsız yöntemle doğrulayın.';

  function isNavigationContext(context){
    const analysis=context&&context.analysis;
    return Boolean(analysis&&(analysis.intent==='navigation'||(analysis.secondaryIntents||[]).includes('navigation')));
  }

  function isCalculationRequest(question){
    const text=String(question||'').normalize('NFKC').toLocaleLowerCase('tr-TR');
    const explicit=/(hesapla|hesabı yap|hesap yap|calculate|compute|cpa|tcpa|course to steer|tutulacak rota|dead reckoning|\bdr\b|varış mevki|varis mevki|arrival position|sonundaki pozisyon)/iu.test(text);
    const asksQuantity=/(kaç|kac|ne kadar|nedir|what is|find)/iu.test(text);
    const hasNumericNavigation=/\d/.test(text)&&/(knot|\bkn\b|saat|hour|dakika|minute|derece|degree|rota|course|hız|hiz|speed|mesafe|distance|enlem|boylam|latitude|longitude|mevki|position)/iu.test(text);
    return explicit||(asksQuantity&&hasNumericNavigation);
  }

  function createExpert(options={}){
    const engine=options.engine;
    if(!engine||typeof engine.answer!=='function')throw new TypeError('navigation engine with answer() is required');
    const language=options.language||'tr-TR';
    return Object.freeze({
      mode:'DECISION_SUPPORT_ONLY',
      handle(question,context={}){
        if(!isNavigationContext(context)||!isCalculationRequest(question))return null;
        const calculation=engine.answer(question,language);
        if(calculation==null||String(calculation).trim()==='')return null;
        return Object.freeze({
          answer:`SEYİR MOTORU — EĞİTİM HESABI\n\n${calculation}\n\nKaynak: ${SOURCE}`,
          sources:Object.freeze([SOURCE]),
          warnings:Object.freeze([WARNING])
        });
      }
    });
  }

  return Object.freeze({SOURCE,WARNING,isNavigationContext,isCalculationRequest,createExpert});
});
