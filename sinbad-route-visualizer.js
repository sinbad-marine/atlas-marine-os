(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.SinbadRouteVisualizer=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function isPlotRequest(text){
    return /(harita|chart|map).*(çiz|ciz|göster|goster|plot|draw|show)|(çiz|ciz|göster|goster|plot|draw|show).*(harita|chart|map)/iu.test(String(text||''));
  }
  function isOpenCpnRequest(text){
    return /\bopen\s*cpn\b/iu.test(String(text||''));
  }
  function xml(value){
    return String(value??'').replace(/[<>&"']/g,char=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[char]));
  }
  function toGpx(route,options={}){
    if(!route||route.status!=='READY')throw new TypeError('a ready route is required');
    const name=String(options.name||'Sinbad DR route'),created=String(options.createdAt||new Date().toISOString());
    const points=[
      {name:'SINBAD-START',lat:Number(route.start.lat),lon:Number(route.start.lon)},
      {name:'SINBAD-DR-END',lat:Number(route.end.lat),lon:Number(route.end.lon)}
    ];
    if(points.some(point=>!Number.isFinite(point.lat)||!Number.isFinite(point.lon)))throw new TypeError('route coordinates must be finite');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Sinbad Marine" xmlns="http://www.topografix.com/GPX/1/1">\n  <metadata><name>${xml(name)}</name><time>${xml(created)}</time><desc>Planning and training route. Verify on current official charts.</desc></metadata>\n  <rte><name>${xml(name)}</name>\n    ${points.map(point=>`<rtept lat="${point.lat.toFixed(6)}" lon="${point.lon.toFixed(6)}"><name>${point.name}</name></rtept>`).join('\n    ')}\n  </rte>\n</gpx>\n`;
  }
  function routeFromConversation(messages,engine){
    if(!engine||typeof engine.parseDrQuestion!=='function')throw new TypeError('navigation engine is required');
    const text=(messages||[]).filter(item=>item&&item.role==='user').slice(-12).map(item=>String(item.text||'')).join('\n');
    const parsed=engine.parseDrQuestion(text);
    if(!parsed)return Object.freeze({status:'NEEDS_INPUT',missing:Object.freeze(['lat','lon','course','speed','hours'])});
    const required=['lat','lon','course','speed','hours'];
    const missing=required.filter(key=>parsed[key]==null);
    if(missing.length)return Object.freeze({status:'NEEDS_INPUT',missing:Object.freeze(missing)});
    const distanceNm=engine.distanceRun(parsed.speed,parsed.hours);
    const end=engine.rhumbDestination(parsed.lat,parsed.lon,parsed.course,distanceNm);
    const points=[];
    for(let index=0;index<=32;index++){
      const point=engine.rhumbDestination(parsed.lat,parsed.lon,parsed.course,distanceNm*index/32);
      points.push(Object.freeze([point.lon,point.lat]));
    }
    return Object.freeze({
      status:'READY',method:'RHUMB_LINE',
      start:Object.freeze({lat:parsed.lat,lon:parsed.lon}),
      end:Object.freeze({lat:end.lat,lon:end.lon}),
      course:Number(parsed.course),speedKnots:Number(parsed.speed),hours:Number(parsed.hours),distanceNm,
      points:Object.freeze(points)
    });
  }
  return Object.freeze({isPlotRequest,isOpenCpnRequest,toGpx,routeFromConversation});
});
