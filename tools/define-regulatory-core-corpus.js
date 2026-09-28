'use strict';
// Project 2 Phase 4.10 part 2 - defines the bounded REGULATORY-CORE corpus. Owner directive of 2026-09-19.
//
// A corpus is a list of WHOLE documents of the Owner's library, chosen by rules that look at the document TITLE and SIZE
// only: who issued it (authority), what it is about (topic), that it is not teaching or exam material, and that it is not a
// very large manual. No rule looks at a benchmark question, a needle or an answer. Nothing is copied or edited: the manifest
// names each document by title and pins it by chunk count and by the SHA-256 over its chunk hashes, so the text always comes
// from the library and provenance survives. Reads the library read-only, calls no model and no network, writes one file.
// Run: node --max-old-space-size=3072 tools/define-regulatory-core-corpus.js
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const OUT=path.join(ROOT,'tests/benchmark/retrieval/corpus-regulatory-core-v1.json');
const DEFAULT_LIBRARY=path.join(os.homedir(),'OneDrive','Belgeler','Sinbad Bridge','Library','.sinbad-index.json');
const sha256=data=>crypto.createHash('sha256').update(data).digest('hex');
const NAME='regulatory-core-v1',MAX_DOCUMENT_CHUNKS=150;
// Who issued it. First match wins: a flag administration's notice about SOLAS is FLAG_STATE, not IMO.
const AUTHORITY=[
  ['CLASS',/classnk|dnv|lloyd|(?:^|[ _])abs[ _]|bureau veritas|(?:^|[ _])bv[ _]|rina|(?:^|[ _])irs[ _]|rmrs|iacs|(?:^|[ _])kr[ _]|(?:^|[ _])ccs[ _]/iu],
  ['FLAG_STATE',/liberia|rmi[ _]|marshall|cayman|bermuda|cebelitar|gibraltar|uk[ _]mca|(?:^|[ _])mca[ _]|(?:^|[ _])mgn|(?:^|[ _])msn|german flag|norve|nma[ _]|amsa|(?:^|[ _])hk[ _]|hong kong|traficom|belçika|malta|panama|bahamas|isle of man|singapore|mpa[ _]|transport canada|danish|dma[ _]|paris mou|tokyo mou|port state|france|italy|poland|finlandiya/iu],
  ['ILO',/(?:^|[ _-])(?:ilo|mlc)(?:[ _.-]|$)|maritime labour/iu],
  ['IMO',/(?:^|[ _-])(?:imo|msc|mepc|fal|solas|marpol|colreg|stcw|ism|isps|imdg|imsbc|load ?line|tonnage|bwm|ballast water|polar code|igc|ibc|lsa|fss)(?:[ _.()-]|$)/iu]
];
// What it is about: the instruments the Owner named (ISM, ISPS, MLC, SOLAS, STCW) and the other conventions a ship is audited against.
const TOPIC=/(?:^|[ _.()-])(?:ism|isps|mlc|solas|stcw|colreg|marpol|bwm)(?:[ _.()-]|$)|maritime labour|safety management|ship security|security (?:plan|officer|level|alert)|seafarer|hours of (?:work|rest)|manning|collision regulations|navigation rules|look-?out|ballast water|oil pollution|garbage|annex (?:i|ii|iv|v|vi)(?:[ _.()-]|$)|life-?saving|fire (?:safety|drill)|muster|port state control/iu;
// Teaching, exam and summary material is not authoritative text.
const EXCLUDE=/soru|sınav|sinav|cevap|goss|question|exam|quiz|hazırlık|hazirlik|çıkmış|cikmis|deneme|test bank|flashcard|kitap|ders not|özet|sunum|slayt/iu;
const RULES=Object.freeze({
  include:['the title names an issuing AUTHORITY (class society, flag administration / port state regime, ILO, IMO)','AND the title names a regulatory TOPIC (ISM, ISPS, MLC, SOLAS, STCW, COLREG, MARPOL, BWM or one of their subjects)'],
  exclude:['titles of exam, question-bank, course, summary or slide material','documents of more than 150 chunks (very large manuals and compendia), so that the embedding experiment stays within hours on the host','documents without an authority or without a regulatory topic in the title (general books, internal notes, unrelated operational material)','nothing is excluded or included because of a benchmark question, needle or answer'],
  wholeDocumentsOnly:true,textSource:'the library index; the manifest holds titles, counts and hashes, never text'
});
function define(documents){
  const counts={documents:0,chunks:0,excludedTeaching:0,excludedNoAuthority:0,excludedNoTopic:0,excludedTooLarge:0,duplicateTitle:0};const seen=new Set();const picked=[];
  for(const d of documents){
    const texts=(d.chunks||[]).filter(c=>typeof c==='string'&&c.trim());if(!texts.length||typeof d.title!=='string')continue;counts.documents+=1;counts.chunks+=texts.length;
    if(seen.has(d.title)){counts.duplicateTitle+=1;continue;}seen.add(d.title);
    if(EXCLUDE.test(d.title)){counts.excludedTeaching+=1;continue;}
    const authority=(AUTHORITY.find(([,re])=>re.test(d.title))||[null])[0];if(!authority){counts.excludedNoAuthority+=1;continue;}
    const topic=TOPIC.exec(d.title);if(!topic){counts.excludedNoTopic+=1;continue;}
    if(texts.length>MAX_DOCUMENT_CHUNKS){counts.excludedTooLarge+=1;continue;}
    picked.push({title:d.title,authority,topic:topic[0].replace(/^[ _.()-]+|[ _.()-]+$/gu,'').toLowerCase(),chunks:texts.length,documentSha256:sha256(texts.map(c=>sha256(c)).join('\n')),
      inclusionReason:`authority ${authority} and topic '${topic[0].replace(/^[ _.()-]+|[ _.()-]+$/gu,'').toLowerCase()}' in the title; ${texts.length} chunks <= ${MAX_DOCUMENT_CHUNKS}`});
  }
  return {picked,counts};
}
function main(){
  const file=process.env.SINBAD_LIBRARY_INDEX||DEFAULT_LIBRARY;const text=fs.readFileSync(file,'utf8');const raw=JSON.parse(text.replace(/^﻿/u,''));
  const {picked,counts}=define(raw.documents||[]);const by=key=>picked.reduce((m,p)=>{const k=p[key];m[k]=m[k]||{documents:0,chunks:0};m[k].documents+=1;m[k].chunks+=p.chunks;return m;},{});
  const corpus={version:'sinbad-retrieval-corpus/1',name:NAME,purpose:'Bounded experimental corpus for Phase 4.10 part 2: lexical, semantic and hybrid retrieval are compared on the same documents. Not a product corpus.',
    librarySha256:sha256(text),libraryBuiltAt:raw.builtAt||null,rules:RULES,maxDocumentChunks:MAX_DOCUMENT_CHUNKS,
    totals:{documents:picked.length,chunks:picked.reduce((s,p)=>s+p.chunks,0),byAuthority:by('authority')},library:counts,documents:picked};
  fs.writeFileSync(OUT,`${JSON.stringify(corpus,null,1)}\n`);
  process.stdout.write(`${NAME}: ${corpus.totals.documents} documents, ${corpus.totals.chunks} chunks of ${counts.chunks} (${(100*corpus.totals.chunks/counts.chunks).toFixed(1)} %)\n${JSON.stringify(corpus.totals.byAuthority)}\n${JSON.stringify(counts)}\n`);
}
if(require.main===module)main();
module.exports={NAME,MAX_DOCUMENT_CHUNKS,AUTHORITY,TOPIC,EXCLUDE,RULES,define};
