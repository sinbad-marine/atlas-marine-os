(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.SinbadRouteVisualizer=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function isPlotRequest(text){
    return /(harita|chart|map).*(çiz|ciz|göster|goster|plot|draw|show)|(çiz|ciz|göster|goster|plot|draw|show).*(harita|chart|map)/iu.test(String(text||''));
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
  return Object.freeze({isPlotRequest,routeFromConversation});
});
