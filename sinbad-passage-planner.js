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
  function parseAdmiraltyCatalog(text){
    if(typeof text!=='string'||text.length>1048576)throw new Error('ADMIRALTY katalog dışa aktarımı boş veya 1 MB sınırını aşıyor.');
    const found=new Map();
    for(const line of text.toUpperCase().split(/\r?\n/)){const paper=/\b(?:SNC|PAPER|PAPER CHART)\b/.test(line),codes=line.match(/\b(?:NP\d{2,3}(?:\(\d\))?|[A-Z]{2,4}\d{3,8})(?!\w)/g)||[];if(paper)codes.push(...(line.match(/\b\d{3,6}\b/g)||[]));for(const identifier of codes){if(found.has(identifier))continue;const kind=identifier.startsWith('NP')?'publication':paper?'paper-chart':/\b(?:ENC|AVCS|VECTOR)\b/.test(line)?'enc-chart':'chart';found.set(identifier,Object.freeze({identifier,kind,source:'ADMIRALTY Digital Catalogue dışa aktarımı',status:'Kaptan doğrulaması gerekli'}));if(found.size>=500)break}}
    return Object.freeze([...found.values()]);
  }
  function intelligence(plan,catalogEntries=[]){
    const lats=plan.points.map(point=>point.lat),lons=plan.points.map(point=>point.lon),minLat=Math.min(...lats),maxLat=Math.max(...lats),minLon=Math.min(...lons),maxLon=Math.max(...lons);
    const mediterranean=maxLat>=25&&minLat<=48&&maxLon>=-6&&minLon<=42,westMed=mediterranean&&minLon<15,eastMed=mediterranean&&maxLon>=15;
    const publications=[
      {id:'NP100',title:"ADMIRALTY Mariner's Handbook",reason:'Genel seyir değerlendirmesi'},
      {id:'NP136',title:'Ocean Passages for the World',reason:'Okyanus/uzun rota değerlendirmesi'},
      {id:'NP5011 / NP5012',title:'Harita ve ENC sembol rehberleri',reason:'Harita gösterim ve sembol kontrolü'}
    ];
    if(mediterranean)publications.push({id:'NP45–NP49',title:'Mediterranean Pilot serisi',reason:'Kesin cilt rota koridoruna göre ADC içinde seçilmeli'},{id:'NP286(3)',title:'Pilot Services, VTS and Port Operations',reason:'Akdeniz, Karadeniz, Hazar ve Süveyş raporlama/pilotaj bilgileri'});
    if(westMed)publications.push({id:'NP78',title:'List of Lights Volume E',reason:'Batı Akdeniz ışık ve sis işaretleri'});
    if(eastMed)publications.push({id:'NP86',title:'List of Lights Volume N',reason:'Doğu Akdeniz ve Karadeniz ışık ve sis işaretleri'});
    const reports=[
      {point:plan.points[0].name,type:'Departure / Port report',detail:'Liman, pilot, VTS kanalı ve rapor formatı resmî kaynaktan doğrulanmalı'},
      ...plan.points.slice(1,-1).map((point,index)=>({point:point.name,type:'Route reporting candidate',detail:`Leg ${index+1}–${index+2}: VTS, TSS ve zorunlu reporting-area kesişimi doğrulanmalı`})),
      {point:plan.points.at(-1).name,type:'Arrival / Port report',detail:'ETA, pilot, liman ve varış raporu doğrulanmalı'}
    ];
    const longest=[...plan.legs].sort((a,b)=>b.distanceNm-a.distanceNm)[0],critical=[
      {point:plan.points[0].name,type:'Departure',detail:'Draft, UKC, pilot ve kalkış kontrolleri'},
      {point:`Leg ${longest.number}`,type:'Longest leg',detail:`${longest.distanceNm.toFixed(2)} NM · ${longest.courseTrue.toFixed(0).padStart(3,'0')}°T; mevki kontrol aralığını kaptan belirlemeli`},
      {point:plan.points.at(-1).name,type:'Arrival',detail:'Abort point, pilot ve yanaşma planı'}
    ];
    publications.push(...catalogEntries.filter(item=>item.kind==='publication').map(item=>({id:item.identifier,title:'ADC dışa aktarımından alınan yayın',reason:item.status})));
    const importedCharts=catalogEntries.filter(item=>item.kind!=='publication'),charts=importedCharts.length?importedCharts:[{identifier:'ADC ROUTE SEARCH REQUIRED',source:'ADMIRALTY Digital Catalogue',status:'Harita/ENC numaraları henüz içe aktarılmadı'}];
    return Object.freeze({bounds:Object.freeze({minLat,maxLat,minLon,maxLon}),regions:Object.freeze(mediterranean?['Mediterranean']:['Route region requires ADC lookup']),charts:Object.freeze(charts),publications:Object.freeze(publications.map(item=>Object.freeze(item))),reports:Object.freeze(reports.map(item=>Object.freeze(item))),critical:Object.freeze(critical.map(item=>Object.freeze(item)))});
  }
  return Object.freeze({calculate,checklist,leg,parseAdmiraltyCatalog,intelligence});
});
