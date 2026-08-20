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

  function createExpert(options={}){
    const engine=options.engine;
    if(!engine||typeof engine.answer!=='function')throw new TypeError('navigation engine with answer() is required');
    const language=options.language||'tr-TR';
    return Object.freeze({
      mode:'DECISION_SUPPORT_ONLY',
      handle(question,context={}){
        if(!isNavigationContext(context))return null;
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

  return Object.freeze({SOURCE,WARNING,isNavigationContext,createExpert});
});
