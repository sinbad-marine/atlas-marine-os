'use strict';

const fs=require('node:fs/promises');
const path=require('node:path');

const SITEMAP_URL='https://www.denizmagaza.com/store-products-sitemap.xml';
const OUTPUT=path.resolve(__dirname,'..','store-data.js');

const VERIFIED_PRICES=Object.freeze({
  'krom-pergel':420,
  'üçgen-gönye-30cm':420,
  'büyüteç':378,
  'paralel-cetvel':521,
  'ba-harita':2822,
  'korna-24v-borulu':3998,
  'denizde-çatışmayı-önleme-tüzüğü':1176,
  'ruzgar-gülü':4704,
  'kaptan-koltuğu':23990,
  'yalpametre':4939
});

const CATEGORY_RULES=Object.freeze([
  ['Denizde Güvenlik',/(can yele|can sim|solas|life|mob|kurtarma|filika|şamandıra|isaret ayn|işaret ayn|yüzer halat|pyro|roket|meşale)/iu],
  ['Yangın Ekipmanları',/(yangın|fire|alev|exproof|exproff|hortum rekor|nozul|balta)/iu],
  ['Köprü Üstü Malzemeleri',/(harita|pergel|cetvel|gönye|dürbün|pusula|iskandil|vardiye|jurnal|poster|imo|colreg|çatışmayı|yalpa)/iu],
  ['Seyir Fenerleri',/(seyir fener|sn100|sn50|sn20|glop|ampul|lamba|projektör|fener|armatür)/iu],
  ['İş Güvenlik Malzemeleri',/(iş |isps|baret|eldiven|çizme|gözlük|maske|tulum|koruma|güvenlik|emniyet|ilk yardım|medikal)/iu],
  ['Güverte Malzemeleri',/(halat|zincir|çapa|mapa|karabina|kanca|makara|güverte|merdiven|su toplayıcı|yelken|raspa)/iu],
  ['Marin Elektrik',/(akü|elektrik|12v|24v|silecek|pompa|kablo|fiş|priz|sigorta|led)/iu],
  ['Hırdavat ve Bakım',/(bant|boya|zımpara|kimyasal|yapıştırıcı|silikon|civata|somun|pul|alet|yağ|oil spill)/iu],
  ['Yat Malzemeleri',/(yat|kaptan koltu|dümen|krom|lumboz|korna|bayrak|marin)/iu]
]);

function decodeXml(value){return value.replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&quot;','"').replaceAll('&#39;',"'");}
function titleFromSlug(slug){
  const lower=decodeURIComponent(slug).replaceAll('-',' ').replace(/\s+/gu,' ').trim();
  return lower.replace(/(^|\s)(\p{L})/gu,(_,space,letter)=>space+letter.toLocaleUpperCase('tr-TR'));
}
function categoryFor(name){return CATEGORY_RULES.find(([,pattern])=>pattern.test(name))?.[0]||'Diğer Denizcilik Ürünleri';}
function parseProducts(xml){
  return [...xml.matchAll(/<url>([\s\S]*?)<\/url>/gu)].map(match=>{
    const block=match[1];
    const url=decodeXml(block.match(/<loc>(.*?)<\/loc>/u)?.[1]||'');
    const image=decodeXml(block.match(/<image:loc>(.*?)<\/image:loc>/u)?.[1]||'');
    const slug=url.split('/').filter(Boolean).at(-1)||'';
    const name=titleFromSlug(slug);
    return {id:slug,name,category:categoryFor(name),image,price:VERIFIED_PRICES[slug]??null,badge:VERIFIED_PRICES[slug]?'Fiyatlı Ürün':'Teklif Al',description:'SDM Marine yetkili satış kataloğu ürünü. Teknik özellikler, stok ve teslim süresi sipariş sırasında teyit edilir.',supplierUrl:url};
  }).filter(product=>product.id&&product.image);
}

async function main(){
  const response=await fetch(SITEMAP_URL,{headers:{'user-agent':'SinbadMarineCatalog/1.0'}});
  if(!response.ok)throw new Error(`SITEMAP_HTTP_${response.status}`);
  const products=parseProducts(await response.text()).sort((a,b)=>a.category.localeCompare(b.category,'tr')||a.name.localeCompare(b.name,'tr'));
  if(products.length<100)throw new Error(`CATALOG_TOO_SMALL_${products.length}`);
  const header=`// STORE_DATA — Sinbad Marine Store\n// Generated from SDM's authorized retail catalog sitemap.\n// Prices that are null require current supplier confirmation before payment.\n`;
  await fs.writeFile(OUTPUT,`${header}const STORE_DATA = ${JSON.stringify(products,null,2)};\n`,'utf8');
  process.stdout.write(`Imported ${products.length} SDM catalog products.\n`);
}

main().catch(error=>{process.stderr.write(`${error.message}\n`);process.exitCode=1;});
