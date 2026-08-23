'use strict';

const taxonomy=require('./knowledge-taxonomy.js');

const KEYWORDS=Object.freeze({
  maritime:['deniz','gemi','seyir','navigation','solas','şamandıra','liman','marine'],
  history:['tarih','history','imparatorluk','savaş','civilization','medeniyet','antik'],
  geography:['coğrafya','geography','ülke','şehir','kıta','iklim','culture'],
  science:['bilim','science','fizik','kimya','biyoloji','astronomi'],
  mathematics:['matematik','math','geometri','cebir','olasılık','istatistik'],
  technology:['teknoloji','technology','yazılım','computer','bilgisayar','internet','yapay zeka'],
  medicine:['sağlık','health','tıp','medicine','hastalık','ilaç','belirti'],
  art:['sanat','art','resim','heykel','mimari','ressam','müze'],
  literature:['edebiyat','literature','roman','şiir','yazar','mitoloji','dil'],
  music:['müzik','music','sinema','film','tiyatro','besteci'],
  philosophy:['felsefe','philosophy','etik','ahlak','din','religion'],
  politics:['politika','politics','seçim','hükümet','başkan','parlamento','diplomasi'],
  law:['hukuk','law','yasa','mahkeme','regulation','mevzuat'],
  economics:['ekonomi','economy','enflasyon','borsa','faiz','finans','business'],
  society:['toplum','society','eğitim','education','aile','sosyoloji'],
  environment:['çevre','environment','iklim değişikliği','climate','sürdürülebilir','ekoloji'],
  sports:['spor','sports','futbol','basketbol','maç','olimpiyat'],
  food:['yemek','food','tarım','agriculture','mutfak','tarif'],
  travel:['seyahat','travel','otel','vize','turizm','gezi'],
  media:['haber','news','magazin','celebrity','ünlü','medya','gündem'],
  practical:['nasıl yapılır','tamir','craft','zanaat','ev işi','pratik'],
  reference:['nedir','sözlük','dictionary','birim','unit','tanım','definition']
});

function normalize(value){return String(value||'').normalize('NFKC').toLocaleLowerCase('tr-TR');}
function route(question,{limit=3}={}){
  const query=normalize(question);if(!query.trim())throw new TypeError('question is required');
  const ranked=[];
  for(const [domainId,terms] of Object.entries(KEYWORDS)){
    const matches=terms.filter(term=>query.includes(normalize(term)));
    if(matches.length)ranked.push(Object.freeze({domain:taxonomy.getDomain(domainId),score:matches.length,matches:Object.freeze(matches)}));
  }
  ranked.sort((a,b)=>b.score-a.score||a.domain.id.localeCompare(b.domain.id));
  if(!ranked.length)ranked.push(Object.freeze({domain:taxonomy.getDomain('reference'),score:0,matches:Object.freeze([])}));
  return Object.freeze(ranked.slice(0,Math.max(1,Math.min(5,limit))));
}

module.exports=Object.freeze({KEYWORDS,route});
