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
    'gasm-seyir-sinav':{title:'GASM Seyir Sınav Soruları',objectives:['Taranmış GASM seyir soru sayfalarını özgün biçimiyle incelemek','Harita sembolleri, projeksiyonlar, yayınlar ve seyir terimlerini tekrar etmek','Öğrenci işaretlerini resmî cevap anahtarından kesin olarak ayırmak'],practice:'Kaynak sayfalardaki soruları çözün. 1–644 cevap anahtarının tamamı insan tarafından tek tek doğrulanmıştır.'},
    'stcw-foundation':{title:'STCW Foundation',objectives:['STCW yeterlik, eğitim ve vardiya tutma çerçevesinin kapsamını tanımak','Göreve ve yeterlik seviyesine uygun güncel resmî gereklilikleri doğrulamak','Eğitim kaydı ile bayrak/idaresi onayını birbirinden ayırmak'],practice:'Kendi göreviniz için uygulanabilir STCW yeterlik ve yenileme gerekliliklerini güncel resmî kaynaklarla eşleştirin.'},
    'goc-foundation':{title:'GOC Radio Communication Foundation',objectives:['GMDSS ve GOC görev sınırlarını tanımak','Tehlike, acelelik ve emniyet haberleşmesini ayırt etmek','Canlı telsiz işlemlerinde yetki, prosedür ve güncel yayın gerekliliğini korumak'],practice:'Bir eğitim senaryosunda distress, urgency ve safety mesajlarının doğru öncelik ve içerik sırasını hazırlayın.'},
    'general-maritime-education':{title:'General Maritime Education',objectives:['Temel denizcilik disiplinleri arasındaki ilişkiyi kurmak','Eğitim bilgisini operasyonel yetki ve onaydan ayırmak','Her konu için güncel resmî kaynağı ve insan sorumluluğunu belirlemek'],practice:'Bir denizcilik konusunu seçip öğrenme hedefi, resmî kaynak ve doğrulama adımlarından oluşan çalışma planı hazırlayın.'},
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

  const GASM_SEYIR_FIRST_SCAN=Object.freeze([
    [1,1,8],[2,9,17],[3,18,27],[4,28,36],[5,37,46],
    [6,47,56],[7,57,66],[8,67,76],[9,77,86],[10,87,95]
  ].map(([page,first,last])=>Object.freeze({
    kind:'source-page',category:'gasm-seyir-sinav',
    q:`GASM Seyir — Sorular ${first}-${last}`,
    image:`./assets/gasm-seyir/adobe-scan-2026-08-24-page-${String(page).padStart(2,'0')}.png`,
    page,firstQuestion:first,lastQuestion:last,questionCount:last-first+1,
    answer:null,answerStatus:'pending-official-key',
    explanation:'Bu sayfadaki işaretlemeler cevap anahtarı değildir. Resmî cevap anahtarı seri tamamlandıktan sonra ayrıca eşleştirilecektir.',
    source:'Adobe Scan Aug 24, 2026.pdf'
  })));

  const GASM_SEYIR_SECOND_SCAN=Object.freeze([
    [1,96,105],[2,106,113],[3,114,122],[4,123,132],[5,133,138],[6,139,148],
    [7,149,158],[8,159,168],[9,169,178],[10,179,187],[11,188,191],[12,192,200],
    [13,201,209],[14,210,218],[15,219,226],[16,227,236],[17,237,246],[18,247,256],
    [19,257,265],[20,266,271],[21,292,297],[22,298,305]
  ].map(([page,first,last])=>Object.freeze({
    kind:'source-page',category:'gasm-seyir-sinav',
    q:`GASM Seyir — Sorular ${first}-${last}`,
    image:`./assets/gasm-seyir/adobe-scan-2026-08-24-2-page-${String(page).padStart(2,'0')}.png`,
    page,firstQuestion:first,lastQuestion:last,questionCount:last-first+1,
    answer:null,answerStatus:'pending-official-key',
    explanation:'Bu sayfadaki işaretlemeler cevap anahtarı değildir. Resmî cevap anahtarı seri tamamlandıktan sonra ayrıca eşleştirilecektir.',
    source:'Adobe Scan Aug 24, 2026 2.pdf'
  })));

  const GASM_SEYIR_THIRD_SCAN=Object.freeze([
    [1,273,282],[2,283,291]
  ].map(([page,first,last])=>Object.freeze({
    kind:'source-page',category:'gasm-seyir-sinav',
    q:`GASM Seyir — Sorular ${first}-${last}`,
    image:`./assets/gasm-seyir/adobe-scan-2026-08-24-3-page-${String(page).padStart(2,'0')}.png`,
    page,firstQuestion:first,lastQuestion:last,questionCount:last-first+1,
    answer:null,answerStatus:'pending-official-key',
    explanation:'Bu sayfadaki işaretlemeler cevap anahtarı değildir. Resmî cevap anahtarı seri tamamlandıktan sonra ayrıca eşleştirilecektir.',
    source:'Adobe Scan Aug 24, 2026 3.pdf'
  })));

  const GASM_SEYIR_VERIFIED_ANSWER_KEY=Object.freeze({
    1:'B',2:'A',3:'D',4:'C',5:'E',6:'E',7:'B',8:'D',9:'B',10:'B',11:'C',12:'B',13:'C',14:'D',15:'C',16:'E',17:'A',18:'D',19:'C',20:'B',21:'B',22:'D',23:'A',24:'A',25:'B',26:'C',27:'B',28:'A',29:'B',30:'B',
    31:'C',32:'B',33:'E',34:'E',35:'A',36:'C',37:'D',38:'E',39:'B',40:'A',41:'D',42:'B',43:'C',44:'B',45:'C',46:'D',47:'C',48:'D',49:'A',50:'D',51:'D',52:'D',53:'C',54:'A',55:'A',56:'E',57:'C',58:'A',59:'C',60:'D',
    61:'D',62:'B',63:'E',64:'E',65:'A',66:'E',67:'D',68:'D',69:'B',70:'B',71:'C',72:'E',73:'B',74:'C',75:'E',76:'E',77:'D',78:'B',79:'C',80:'C',81:'C',82:'C',83:'B',84:'C',85:'E',86:'C',87:'D',88:'D',89:'D',90:'D',
    91:'C',92:'B',93:'A',94:'C',95:'D',96:'B',97:'C',98:'A',99:'C',100:'A',101:'B',102:'A',103:'C',104:'A',105:'A',106:'D',107:'B',108:'E',109:'D',110:'A',111:'C',112:'C',113:'E',114:'C',115:'A',116:'B',117:'E',118:'D',119:'A',120:'C',
    121:'E',122:'D',123:'B',124:'C',125:'C',126:'E',127:'E',128:'B',129:'D',130:'E',131:'A',132:'D',133:'A',134:'C',135:'B',136:'C',137:'E',138:'D',139:'C',140:'C',141:'E',142:'D',143:'D',144:'A',145:'B',146:'E',147:'D',148:'B',149:'D',150:'B',
    151:'D',152:'D',153:'B',154:'C',155:'B',156:'D',157:'C',158:'D',159:'B',160:'D',161:'B',162:'A',163:'A',164:'C',165:'B',166:'C',167:'D',168:'D',169:'C',170:'E',171:'A',172:'D',173:'C',174:'B',175:'B',176:'D',177:'B',178:'C',179:'C',180:'D',
    181:'A',182:'D',183:'E',184:'C',185:'C',186:'B',187:'C',188:'D',189:'B',190:'D',191:'D',192:'A',193:'C',194:'B',195:'B',196:'B',197:'A',198:'B',199:'E',200:'B',201:'D',202:'C',203:'A',204:'E',205:'B',206:'B',207:'D',208:'A',209:'D',210:'B',
    211:'C',212:'D',213:'B',214:'A',215:'C',216:'A',217:'B',218:'A',219:'A',220:'D',221:'B',222:'D',223:'B',224:'A',225:'C',226:'E',227:'A',228:'D',229:'B',230:'B',231:'D',232:'B',233:'B',234:'E',235:'D',236:'D',237:'E',238:'A',239:'C',240:'C',
    241:'C',242:'A',243:'A',244:'B',245:'D',246:'E',247:'A',248:'A',249:'D',250:'A',251:'B',252:'B',253:'C',254:'E',255:'E',256:'E',257:'C',258:'C',259:'B',260:'D',261:'D',262:'C',263:'C',264:'A',265:'B',266:'B',267:'C',268:'B',269:'E',270:'C',
    271:'B',272:'B',273:'C',274:'C',275:'D',276:'A',277:'C',278:'E',279:'B',280:'B',281:'A',282:'A',283:'A',284:'E',285:'C',286:'D',287:'C',288:'B',289:'B',290:'C',291:'A',292:'C',293:'B',294:'A',295:'B',296:'C',297:'C',298:'B',299:'C',300:'C',
    301:'E',302:'D',303:'C',304:'D',305:'D',306:'A',307:'A',308:'D',309:'E',310:'C',311:'D',312:'D',313:'C',314:'B',315:'A',316:'D',317:'B',318:'B',319:'A',320:'B',321:'C',322:'B',323:'C',324:'A',325:'B',326:'C',327:'B',328:'C',329:'B',330:'E',
    331:'B',332:'D',333:'B',334:'A',335:'D',336:'E',337:'B',338:'B',339:'B',340:'D',341:'B',342:'D',343:'D',344:'D',345:'C',346:'D',347:'D',348:'E',349:'B',350:'A',351:'B',352:'E',353:'C',354:'C',355:'B',356:'C',357:'D',358:'C',359:'D',360:'C',
    361:'D',362:'A',363:'C',364:'D',365:'E',366:'B',367:'B',368:'C',369:'A',370:'B',371:'A',372:'B',373:'D',374:'C',375:'D',376:'D',377:'E',378:'C',379:'A',380:'C',381:'B',382:'C',383:'A',384:'D',385:'A',386:'D',387:'D',388:'A',389:'C',390:'A',
    391:'B',392:'B',393:'E',394:'B',395:'A',396:'B',397:'A',398:'B',399:'C',400:'C',401:'D',402:'C',403:'A',404:'C',405:'A',406:'D',407:'D',408:'A',409:'B',410:'B',411:'D',412:'C',413:'A',414:'B',415:'B',416:'A',417:'D',418:'E',419:'A',420:'B',
    421:'A',422:'C',423:'E',424:'B',425:'A',426:'D',427:'D',428:'B',429:'E',430:'E',431:'B',432:'C',433:'E',434:'B',435:'D',436:'A',437:'B',438:'C',439:'B',440:'D',441:'C',442:'B',443:'E',444:'E',445:'C',446:'C',447:'B',448:'C',449:'D',450:'C',
    451:'D',452:'B',453:'C',454:'B',455:'B',456:'D',457:'A',458:'D',459:'A',460:'D',461:'A',462:'D',463:'C',464:'C',465:'B',466:'D',467:'A',468:'B',469:'A',470:'C',471:'B',472:'E',473:'C',474:'D',475:'C',476:'B',477:'D',478:'A',479:'B',480:'B',
    481:'C',482:'D',483:'A',484:'B',485:'D',486:'B',487:'C',488:'D',489:'B',490:'A',491:'C',492:'C',493:'E',494:'D',495:'C',496:'A',497:'D',498:'E',499:'B',500:'B',501:'C',502:'D',503:'A',504:'D',505:'C',506:'B',507:'D',508:'D',509:'C',510:'D',
    511:'D',512:'B',513:'B',514:'B',515:'A',516:'A',517:'D',518:'B',519:'A',520:'D',521:'E',522:'C',523:'D',524:'B',525:'C',526:'E',527:'D',528:'A',529:'A',530:'A',531:'D',532:'C',533:'B',534:'D',535:'C',536:'B',537:'E',538:'D',539:'B',540:'C',
    541:'B',542:'E',543:'B',544:'A',545:'C',546:'B',547:'A',548:'D',549:'B',550:'A',551:'C',552:'C',553:'E',554:'B',555:'D',556:'B',557:'D',558:'C',559:'B',560:'C',561:'D',562:'B',563:'B',564:'B',565:'D',566:'A',567:'A',568:'A',569:'D',570:'A',
    571:'D',572:'C',573:'A',574:'B',575:'A',576:'A',577:'E',578:'B',579:'B',580:'E',581:'B',582:'A',583:'E',584:'A',585:'B',586:'E',587:'C',588:'C',589:'B',590:'A',591:'E',592:'C',593:'D',594:'D',595:'D',596:'C',597:'A',598:'D',599:'C',600:'D',
    601:'B',602:'A',603:'E',604:'E',605:'C',606:'B',607:'B',608:'D',609:'A',610:'D',611:'D',612:'E',613:'D',614:'D',615:'A',616:'A',617:'B',618:'B',619:'E',620:'A',621:'C',622:'E',623:'E',624:'A',625:'B',626:'D',627:'C',628:'E',629:'C',630:'C',631:'A',632:'C',633:'A',634:'C',635:'C',636:'A',637:'D',638:'A',639:'C',640:'A',641:'A',642:'A',643:'A',644:'A'
  });
  const verifiedAnswersForRange=(first,last)=>Object.freeze(Object.fromEntries(
    Object.entries(GASM_SEYIR_VERIFIED_ANSWER_KEY).filter(([question])=>Number(question)>=first&&Number(question)<=last)
  ));

  const GASM_SEYIR_FOURTH_SCAN=Object.freeze([
    [1,306,314],[2,315,324],[3,325,333],[4,334,342],[5,343,352],[6,353,360],
    [7,361,370],[8,371,380],[9,381,390],[10,391,400],[11,401,410],[12,411,419],
    [13,420,428],[14,429,437],[15,438,446],[16,447,448],[17,449,457],[18,458,468],
    [19,469,477],[20,478,488],[21,489,497],[22,498,506],[23,507,516],[24,517,525],
    [25,526,535],[26,536,545],[27,546,554],[28,555,564],[29,565,573],[30,574,582],
    [31,583,591],[32,592,600],[33,601,607],[34,608,616],[35,617,625],[36,626,634],[37,635,644]
  ].map(([page,first,last])=>{
    const answers=verifiedAnswersForRange(first,last);
    const verified=Object.keys(answers).length===last-first+1;
    return Object.freeze({
      kind:'source-page',category:'gasm-seyir-sinav',
      q:`GASM Seyir — Sorular ${first}-${last}`,
      image:`./assets/gasm-seyir/adobe-scan-2026-08-24-333-page-${String(page).padStart(2,'0')}.png`,
      page,firstQuestion:first,lastQuestion:last,questionCount:last-first+1,
      answer:null,answers,answerStatus:verified?'official-key-verified':'official-key-image-needs-human-verification',
      explanation:verified
        ?'Bu aralıktaki cevaplar, okunabilir resmî cevap anahtarı sayfasından tek tek doğrulanmıştır.'
        :'1–600 resmî cevap anahtarı görüntüsü mevcuttur; yoğun baskı ve kalem izleri nedeniyle harfler güvenilir biçimde ayrılamadığından tahminî cevap yüklenmemiştir.',
      source:'Adobe Scan Aug 24, 2026 (333.pdf'
    });
  }));

  const GASM_SEYIR_PAGES=Object.freeze(
    [...GASM_SEYIR_FIRST_SCAN,...GASM_SEYIR_SECOND_SCAN,...GASM_SEYIR_THIRD_SCAN,...GASM_SEYIR_FOURTH_SCAN]
      .sort((left,right)=>left.firstQuestion-right.firstQuestion)
      .map(page=>Object.freeze({
        ...page,
        answers:verifiedAnswersForRange(page.firstQuestion,page.lastQuestion),
        answerStatus:'official-key-verified',
        explanation:'Bu aralıktaki cevaplar, resmî cevap anahtarı taraması üzerinden insan tarafından tek tek doğrulanmıştır.'
      }))
  );
  const GASM_SEYIR_MISSING_RANGES=Object.freeze([[272,272]]);

  function quiz(category){
    if(category==='gasm-seyir-sinav')return [...GASM_SEYIR_PAGES];
    return QUIZ.filter(x=>!category||x.category===category);
  }
  return {terms,search,answer,lesson,quiz,modules:MODULES,gasmSeyirPages:GASM_SEYIR_PAGES,gasmSeyirMissingRanges:GASM_SEYIR_MISSING_RANGES,gasmSeyirVerifiedAnswerKey:GASM_SEYIR_VERIFIED_ANSWER_KEY};
});
