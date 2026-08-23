(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SinbadVisuals=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const BASE='./visual-library/assets/bowditch/';
  const BRIDGE='http://127.0.0.1:31983';
  const SOURCES=[
    {url:`${BASE}volume-1-manifest.json`,base:BASE},
    {url:`${BASE}volume-2-manifest.json`,base:BASE},
    {url:`${BASE}fallback-manifest.json`,base:BASE},
    {url:'./visual-library/assets/curated-safety/manifest.json',base:'./visual-library/assets/curated-safety/'},
    {url:'./visual-library/assets/nga-chart-no-1/manifest.json',base:'./visual-library/assets/nga-chart-no-1/'}
  ];
  const ALIASES=Object.freeze({şamandıra:'buoy',samandira:'buoy',akıntı:'current',akinti:'current',gelgit:'tide',fener:'light',ışık:'light',isik:'light',pusula:'compass',harita:'chart',sembol:'symbol',kardinal:'cardinal',batık:'wreck',batik:'wreck',kerteriz:'bearing',işaret:'mark',isaret:'mark',kısaltma:'abbreviation',kisaltma:'abbreviation',yıldız:'star',yildiz:'star',göksel:'celestial',goksel:'celestial',radar:'radar',simidi:'lifebuoy',simit:'lifebuoy',salı:'liferaft',sali:'liferaft',filika:'lifeboat',yeleği:'lifejacket',yelegi:'lifejacket'});
  let cache=null;
  function normalize(value){return String(value||'').toLocaleLowerCase('tr-TR').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9çğıöşü ]/gi,' ');}
  function tokens(value){return [...new Set(normalize(value).split(/\s+/).filter(word=>word.length>2).flatMap(word=>[word,ALIASES[word]].filter(Boolean)))];}
  async function load(fetcher=fetch){if(cache)return cache;const documents=await Promise.all(SOURCES.map(async source=>{const response=await fetcher(source.url);if(!response.ok)throw new Error(`Visual manifest returned ${response.status}`);return Object.freeze({...await response.json(),assetBase:source.base});}));cache=documents;return documents;}
  function rank(query,answer,documents){
    const queryText=normalize(`${query} ${answer}`),wanted=tokens(queryText);if(!wanted.length)return [];
    const ranked=[];
    for(const document of documents||[])for(const visual of document.visuals||[]){
      if(Number(visual.width)<80||Number(visual.height)<80)continue;
      let best=null;
      if(visual.qualityStatus==='rejected'||(visual.negativeTraits||[]).some(trait=>['qr-code','logo-only','text-only','cover-page'].includes(trait)))continue;
      for(const occurrence of visual.occurrences||[]){
        const topicText=normalize(`${(occurrence.headings||[]).join(' ')} ${(occurrence.topics||[]).join(' ')}`);
        const contextText=normalize(occurrence.context||'');
        const strong=wanted.filter(token=>topicText.includes(token)).length;
        const weak=wanted.filter(token=>contextText.includes(token)).length;
        const normalizedTopics=(occurrence.topics||[]).map(normalize);
        const phrase=normalizedTopics.filter(topic=>topic.includes(' ')&&queryText.includes(topic)).length;
        const exact=normalizedTopics.filter(topic=>!topic.includes(' ')&&wanted.includes(topic)).length;
        const score=phrase*12+exact*8+strong*4+weak;
        if(!best||score>best.score)best={occurrence,score,strong,phrase,exact};
      }
      if(best&&best.score>=3)ranked.push({visual,best,volume:document.volume,collection:document.collection,assetBase:document.assetBase});
    }
    ranked.sort((a,b)=>b.best.score-a.best.score||b.best.strong-a.best.strong||Number(b.visual.width)*Number(b.visual.height)-Number(a.visual.width)*Number(a.visual.height));
    if(!ranked.length)return ranked;
    const best=ranked[0].best,minimum=best.phrase?Math.max(12,best.score*.75):Math.max(8,best.score*.8);
    return ranked.filter(item=>item.best.score>=minimum&&(!best.phrase||item.best.phrase));
  }
  function project(item){const occurrence=item.best.occurrence,heading=occurrence.headings?.[0],title=item.collection||'American Practical Navigator',location=occurrence.sourceLabel||(item.volume?`Cilt ${item.volume}, PDF sayfa ${occurrence.pdfPage}`:`PDF sayfa ${occurrence.pdfPage}`);return Object.freeze({src:`${item.assetBase||BASE}${item.visual.file}`,alt:heading||`${title}, ${location}`,caption:`${heading||title} — ${location}`,sourceUrl:item.visual.sourceUrl,sha256:item.visual.sha256});}
  function bridgeProject(item){const title=String(item.title||'SINBAD Visual Library').split(/[\\/]/).pop().replace(/__[0-9a-f]{10}[.]pdf$/iu,'').replace(/[.]pdf$/iu,''),location=`PDF sayfa ${item.page_number}`;return Object.freeze({src:item.assetUrl,alt:item.heading||`${title}, ${location}`,caption:`${item.heading||title} — ${location}`,sourceUrl:item.sourcePaths?.[0],sha256:item.asset_hash});}
  async function bridgeSearch(query,answer,{fetcher=fetch,max=1}={}){const response=await fetcher(`${BRIDGE}/visuals/search`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query,answer,limit:Math.max(max,3)})});if(!response.ok)throw new Error(`Visual bridge returned ${response.status}`);const payload=await response.json();return (payload.visuals||[]).filter(item=>item.visual_type==='object').slice(0,max).map(bridgeProject);}
  async function select(query,answer,{fetcher,max=1,documents}={}){if(documents){try{return rank(query,answer,documents).slice(0,max).map(project);}catch(error){console.warn('Sinbad visual atlas unavailable',error);return [];}}try{const local=await bridgeSearch(query,answer,{fetcher,max});if(local.length)return local;}catch(error){console.warn('Sinbad complete visual atlas unavailable',error);}try{return rank(query,answer,await load(fetcher)).slice(0,max).map(project);}catch(error){console.warn('Sinbad visual atlas unavailable',error);return [];}}
  function clearCache(){cache=null;}
  return Object.freeze({normalize,tokens,rank,bridgeSearch,select,clearCache});
});
