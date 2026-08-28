(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.SinbadAcademy=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const STOP=new Set(['bir','ve','ile','icin','için','the','and','for','from','that','this','what','when','your','about','olan','olarak','daha']);
  const normalize=value=>String(value||'').toLocaleLowerCase('tr-TR').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9çğıöşü\s-]/gi,' ');
  const terms=value=>[...new Set(normalize(value).split(/\s+/).filter(x=>x.length>2&&!STOP.has(x)))];
  const sentenceSplit=text=>String(text||'').replace(/\s+/g,' ').split(/(?<=[.!?])\s+/).filter(x=>x.length>45&&x.length<520);

  function search(query,data,limit=6){
    const wanted=terms(query); if(!wanted.length)return [];
    return (data?.chunks||[]).map(chunk=>{
      const hay=normalize(`${chunk.title} ${chunk.category} ${chunk.content}`);
      const title=normalize(`${chunk.title} ${chunk.category}`);
      const score=wanted.reduce((n,t)=>n+(title.includes(t)?5:0)+(hay.includes(t)?1:0),0)+(hay.includes(normalize(query))?8:0);
      return {chunk,score};
    }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.chunk.chunk_index-b.chunk.chunk_index).slice(0,limit);
  }

  function answer(query,data,options={}){
    const hits=search(query,data,options.limit||6);
    if(!hits.length)return null;
    const selected=[];
    for(const hit of hits){
      const wanted=terms(query);
      const sentences=sentenceSplit(hit.chunk.content).map(sentence=>({sentence,score:wanted.reduce((n,t)=>n+(normalize(sentence).includes(t)?1:0),0)})).sort((a,b)=>b.score-a.score);
      const best=(sentences.find(x=>x.score>0)||sentences[0]);
      if(best&&!selected.some(x=>x.sentence===best.sentence))selected.push({sentence:best.sentence,hit});
      if(selected.length>=4)break;
    }
    const refs=[];const body=selected.map((item,index)=>{
      const id=`S${index+1}`; refs.push({id,title:item.hit.chunk.title,authority:item.hit.chunk.authority,url:item.hit.chunk.url,category:item.hit.chunk.category});
      return `• ${item.sentence} [${id}]`;
    });
    return {text:`Çevrimdışı resmî eğitim kütüphanesinde bulduklarım:\n\n${body.join('\n\n')}\n\nKaynaklar:\n${refs.map(x=>`[${x.id}] ${x.title} — ${x.authority}`).join('\n')}\n\n⚠ Eğitim amaçlıdır. Güncel seyir kararı için resmî harita/yayın, MSI–NAVTEX, hava, liman/pilot talimatları ve kaptan onayı gerekir.`,sources:refs,mode:'offline-official-training'};
  }

  const MODULES={
    'general-maritime-education':{title:'General Maritime Education',objectives:['Emniyetli denizciliğin temel eğitim alanlarını ve aralarındaki ilişkiyi tanımak','Seyir, gemicilik, haberleşme, emniyet ve çevre koruma konularında resmî kaynak kullanımını açıklamak','Eğitim bilgisini güncel operasyonel bilgi ve kaptan sorumluluğundan ayırmak'],practice:'Bir sefer öncesi eğitim kontrol listesi hazırlayın; her başlık için kullanılacak güncel resmî kaynağı ayrıca belirtin.'},
    'chart-reading':{title:'Harita Okuma ve Hidrografi',objectives:['Harita ölçeği ve kullanım amacını ayırt etmek','Semboller, datumlar ve derinlikleri doğru yorumlamak','Haritanın güncellik ve kullanım sınırlarını açıklamak'],practice:'Bir eğitim haritasında ölçek, pusula gülü, derinlik datumunu ve üç seyir tehlikesini belirleyin.'},
    'tides-water-levels':{title:'Gelgit ve Su Seviyesi',objectives:['Flood, ebb ve slack kavramlarını ayırt etmek','Gelgit yüksekliği ile emniyetli su derinliği ilişkisini kurmak','Yerel resmî tahmin verisinin gerekliliğini açıklamak'],practice:'Bir liman geçişi için tahminî gelgit penceresi oluşturun; sonucu operasyonel tahmin değil eğitim örneği olarak etiketleyin.'},
    'currents-set-drift':{title:'Akıntı, Set ve Drift',objectives:['Set ve drift etkisini açıklamak','Yer rotası ile su içindeki rota farkını ayırt etmek','Akıntı verisinin zaman ve konuma bağlı olduğunu göstermek'],practice:'Bir eğitim senaryosunda akıntının COG/SOG üzerindeki etkisini vektör çizimiyle gösterin.'},
    'colregs-navigation-rules':{title:'COLREG ve Seyir Kuralları',objectives:['Lookout, safe speed ve risk of collision ilkelerini bağlam içinde değerlendirmek','Işık, şekil ve ses işaretlerini kurallarla eşleştirmek','Kuralları ezber yerine tam durum değerlendirmesiyle uygulamak'],practice:'İki gemili bir karşılaşma senaryosunda önce risk değerlendirmesini, sonra ilgili kuralları ve emniyetli hareketi sıralayın.'},
    'electronic-navigation':{title:'Elektronik Seyir ve ENC',objectives:['ENC, ECS ve ECDIS farklarını açıklamak','Güncelleme ve gösterim ayarlarının risklerini tanımak','Elektronik seyri bağımsız mevki kontrolüyle desteklemek'],practice:'Bir ENC eğitim ekranı için emniyet konturu, ölçek aşımı ve güncelleme kontrol listesi hazırlayın.'},
    'marine-weather':{title:'Deniz Havası',objectives:['Resmî tahmin, gözlem ve uyarı ürünlerini ayırt etmek','Rüzgâr, dalga ve görüşün seyir planına etkisini değerlendirmek','Tahmin belirsizliğini karar eşiklerine dönüştürmek'],practice:'Bir eğitim geçişi için go/no-go eşikleri yazın; canlı hava verisi olmadan kalkış tavsiyesi vermeyin.'}
  };

  function lesson(category,data){
    const module=MODULES[category]; if(!module)return null;
    const hits=search(`${module.title} ${module.objectives.join(' ')}`,data,5);
    return {category,...module,sources:[...new Map(hits.map(x=>[x.chunk.source_id,{id:x.chunk.source_id,title:x.chunk.title,authority:x.chunk.authority,url:x.chunk.url}])).values()]};
  }

  const QUIZ=[
    {category:'chart-reading',q:'Bir seyir haritasındaki derinlikleri yorumlamadan önce hangisi kontrol edilmelidir?',choices:['Haritanın renk tonu','Harita datumları, birimler, ölçek ve güncellik','Teknenin boya rengi'],answer:1,explanation:'Derinlik ve mevki ancak doğru datum, birim, ölçek ve güncellik bağlamında anlamlıdır.',source:'noaa-nautical-charts-tutorial'},
    {category:'tides-water-levels',q:'Slack water neyi ifade eder?',choices:['Akıntının yön değişimi çevresindeki en zayıf dönem','Daima yüksek su zamanını','Rüzgârın tamamen kesilmesini'],answer:0,explanation:'Slack water, ebb ve flood arasındaki akıntı hızının en zayıf olduğu geçiş dönemidir; yüksek/düşük suyla tam çakışacağı varsayılmaz.',source:'noaa-tides-tutorial'},
    {category:'currents-set-drift',q:'Set ve drift hangi etkiyi tanımlar?',choices:['Akıntının yön ve hız etkisini','Pervane çapını','Radar kazancını'],answer:0,explanation:'Set akıntının yönünü, drift ise hızını ifade eder ve yer rotasını etkiler.',source:'noaa-currents-tutorial'},
    {category:'colregs-navigation-rules',q:'Çatışma riski değerlendirmesinde en doğru yaklaşım hangisidir?',choices:['Tek bir radar kerterizi yeterlidir','Mevcut tüm uygun araçlarla sistematik gözlem yapmak','Yalnız AIS hedef adını kullanmak'],answer:1,explanation:'Kurallar gözcülük ve risk değerlendirmesinde mevcut tüm uygun araçların kullanılmasını gerektirir; AIS tek başına yeterli değildir.',source:'uscg-navigation-rules-handbook'},
    {category:'electronic-navigation',q:'ENC güncel görünüyorsa hangi sonuç çıkar?',choices:['Bağımsız mevki kontrolü gereksizdir','Tüm tehlikeler otomatik olarak önlenir','Güncellik önemlidir fakat doğru ayar, uygun ölçek ve bağımsız izleme yine gerekir'],answer:2,explanation:'Elektronik harita insan, sensör, ayar ve veri hatalarını ortadan kaldırmaz.',source:'noaa-nav-cast'},
    {category:'marine-weather',q:'Çevrimdışı eğitim içeriği kalkış kararı için yeterli midir?',choices:['Evet, her zaman','Hayır; canlı resmî tahmin, uyarı ve gözlemler gerekir','Yalnız yaz aylarında'],answer:1,explanation:'Eğitim bilgisi karar yöntemini öğretir; güncel operasyonel hava verisinin yerini tutmaz.',source:'nws-marine-training-framework'}
  ];

  function quiz(category){return QUIZ.filter(x=>!category||x.category===category);}
  return {terms,search,answer,lesson,quiz,modules:MODULES};
});
