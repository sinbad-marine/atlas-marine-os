(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.SinbadCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const STOP=new Set(['bir','ve','ile','icin','için','the','and','for','from','route','rota','plan','plani','planı','hazirla','hazırla']);
  const clean=value=>String(value||'').toLocaleLowerCase('tr-TR').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9çğıöşü\s-]/gi,' ');
  function terms(value){return [...new Set(clean(value).split(/\s+/).filter(x=>x.length>2&&!STOP.has(x)))];}
  function searchPublications(query,publications,limit=5){
    const wanted=terms(query);
    return (publications||[]).map(source=>{
      const hay=clean([source.title,source.authority,source.edition,(source.region||[]).join(' '),source.type,source.notes].join(' '));
      const score=wanted.reduce((sum,term)=>sum+(hay.includes(term)?(source.title.toLocaleLowerCase('tr-TR').includes(term)?3:1):0),0);
      return {source,score};
    }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.source.title.localeCompare(b.source.title)).slice(0,limit);
  }
  function number(value,fallback=0){const n=Number(String(value??'').replace(',','.'));return Number.isFinite(n)?n:fallback;}
  function passagePlan(input,publications){
    const departure=String(input.departure||'Departure not entered').trim();
    const destination=String(input.destination||'Destination not entered').trim();
    const distance=number(input.distanceNm);const speed=Math.max(.1,number(input.speedKn,10));
    const duration=distance?distance/speed:0;const margin=Math.max(0,number(input.fuelMarginPct,20));
    const consumption=Math.max(0,number(input.fuelConsumptionLph));
    const fuel=duration&&consumption?duration*consumption*(1+margin/100):0;
    const sourceQuery=[departure,destination,input.region||'Mediterranean Aegean Black Sea'].join(' ');
    const sources=searchPublications(sourceQuery,publications,4).map(x=>x.source);
    const warnings=[];
    if(!distance)warnings.push('Distance is missing; measure the approved route on current official charts.');
    if(!input.draftM)warnings.push('Vessel draft is missing; under-keel clearance cannot be assessed.');
    if(!input.departureTime)warnings.push('Departure time is missing; ETA and tidal window remain provisional.');
    warnings.push('Weather, NAVTEX/MSI, Notices to Mariners, chart corrections, port/pilot requirements and local authority instructions require a live pre-departure check.');
    return {
      title:`${departure} → ${destination}`,
      status:'DRAFT — CAPTAIN APPROVAL REQUIRED',
      summary:{distanceNm:distance||null,speedKn:speed,durationHours:duration||null,estimatedFuelLitres:fuel||null,draftM:number(input.draftM)||null},
      phases:[
        {name:'Appraisal',items:['Confirm vessel condition, certificates, crew fitness and limitations','Select corrected official charts and publications','Review navigational hazards, reporting systems, pilotage and ports of refuge']},
        {name:'Planning',items:['Lay the berth-to-berth route with wheel-over and no-go areas','Calculate UKC, squat, air-draft and safety margins','Prepare weather, traffic, fuel, rest-hour and contingency thresholds']},
        {name:'Execution',items:['Complete bridge-team briefing and master/pilot exchange','Record position-monitoring methods and abort points','Revalidate forecast, warnings and destination availability before departure']},
        {name:'Monitoring',items:['Monitor cross-track error, traffic, weather and machinery state','Log deviations and reassess ETA/fuel after material changes','Escalate when any agreed safety limit is approached']}
      ],
      sources,warnings,
      generatedAt:new Date().toISOString()
    };
  }
  function formatPlan(plan){
    const s=plan.summary;
    const lines=[`PASSAGE PLAN — ${plan.title}`,plan.status,'',`Distance: ${s.distanceNm??'TBC'} NM`,`Planning speed: ${s.speedKn} kn`,`Estimated duration: ${s.durationHours?s.durationHours.toFixed(1)+' h':'TBC'}`,`Estimated fuel incl. margin: ${s.estimatedFuelLitres?Math.ceil(s.estimatedFuelLitres)+' L':'TBC'}`,`Draft: ${s.draftM??'TBC'} m`];
    plan.phases.forEach(p=>{lines.push('',p.name.toUpperCase());p.items.forEach(i=>lines.push(`• ${i}`));});
    lines.push('','SOURCES');plan.sources.forEach((x,i)=>lines.push(`[S${i+1}] ${x.title} — ${x.authority}, ${x.edition}`));
    lines.push('','SAFETY GATES');plan.warnings.forEach(w=>lines.push(`⚠ ${w}`));return lines.join('\n');
  }
  return {terms,searchPublications,passagePlan,formatPlan};
});
