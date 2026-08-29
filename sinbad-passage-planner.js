(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.SinbadPassagePlanner=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const EARTH_NM=3440.065;
  const radians=value=>value*Math.PI/180;
  const degrees=value=>value*180/Math.PI;
  const number=(value,fallback=0)=>{const parsed=Number(String(value??'').replace(',','.'));return Number.isFinite(parsed)?parsed:fallback};
  function leg(from,to){
    const lat1=radians(from.lat),lat2=radians(to.lat),deltaLat=lat2-lat1,deltaLon=radians(to.lon-from.lon);
    const a=Math.sin(deltaLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(deltaLon/2)**2;
    const distanceNm=EARTH_NM*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
    const y=Math.sin(deltaLon)*Math.cos(lat2),x=Math.cos(lat1)*Math.sin(lat2)-Math.sin(lat1)*Math.cos(lat2)*Math.cos(deltaLon);
    return Object.freeze({distanceNm,courseTrue:(degrees(Math.atan2(y,x))+360)%360});
  }
  function calculate(input){
    const points=(input.points||[]).map((point,index)=>Object.freeze({name:String(point.name||`WP${index+1}`),lat:number(point.lat,NaN),lon:number(point.lon,NaN)}));
    if(points.length<2||points.length>500||points.some(point=>!Number.isFinite(point.lat)||!Number.isFinite(point.lon)||Math.abs(point.lat)>90||Math.abs(point.lon)>180))throw new Error('GPX rotası 2–500 geçerli waypoint içermelidir.');
    const speedKn=Math.max(.1,number(input.speedKn,10)),fuelRateLph=Math.max(0,number(input.fuelRateLph)),fuelMarginPct=Math.max(0,number(input.fuelMarginPct,20));
    const departureMs=Date.parse(input.departureTime||'');let elapsedHours=0;
    const legs=points.slice(1).map((to,index)=>{const from=points[index],geo=leg(from,to),hours=geo.distanceNm/speedKn;elapsedHours+=hours;return Object.freeze({number:index+1,from,to,...geo,hours,eta:Number.isFinite(departureMs)?new Date(departureMs+elapsedHours*3600000).toISOString():null})});
    const totalDistanceNm=legs.reduce((sum,item)=>sum+item.distanceNm,0),fuelBaseLitres=elapsedHours*fuelRateLph;
    return Object.freeze({name:String(input.name||`${points[0].name} → ${points.at(-1).name}`),points,legs,speedKn,totalDistanceNm,totalHours:elapsedHours,fuelRateLph,fuelMarginPct,fuelRequiredLitres:fuelBaseLitres*(1+fuelMarginPct/100),departureTime:Number.isFinite(departureMs)?new Date(departureMs).toISOString():null});
  }
  function checklist(plan){
    return [`PASSAGE PLAN TASLAĞI — ${plan.name}`,'DRAFT — KAPTAN ONAYI VE RESMÎ KAYNAK DOĞRULAMASI GEREKİR','',`Toplam mesafe: ${plan.totalDistanceNm.toFixed(1)} NM`,`Plan sürati: ${plan.speedKn.toFixed(1)} kn`,`Tahmini süre: ${plan.totalHours.toFixed(1)} saat`,`Tahmini yakıt (marj dahil): ${Math.ceil(plan.fuelRequiredLitres)} L`,'','APPRAISAL','• Güncel resmî haritalar, NtM, MSI/NAVTEX, hava ve gelgit/akıntı verilerini doğrula','• Draft, UKC, squat, air-draft, kısıtlı sular ve liman/pilot şartlarını doğrula','','PLANNING',...plan.legs.map(item=>`• Leg ${item.number}: ${item.from.name} → ${item.to.name} | ${item.courseTrue.toFixed(0).padStart(3,'0')}°T | ${item.distanceNm.toFixed(2)} NM | ${item.hours.toFixed(2)} h${item.eta?` | ETA ${item.eta}`:''}`),'','EXECUTION / MONITORING','• Köprüüstü brifingi, abort point, wheel-over, XTE ve no-go limitlerini ayrıca kaydet','• Mevki, trafik, makine, hava, ETA ve yakıt sapmalarını seyir boyunca izle','• Bu otomatik taslak tek başına seyir amacıyla kullanılamaz.'].join('\n');
  }
  return Object.freeze({calculate,checklist,leg});
});
