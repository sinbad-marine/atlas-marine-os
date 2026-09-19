'use strict';
// Project 2 Phase 4.9 - query expansion for retrieval (pure; calls no model, performs no I/O). Owner directive of 2026-09-19.
//
// Phase 4.8 measured that the lexical retriever misses the passage that answers when the user's wording differs from the
// source's wording. A small local model may restate the question in source wording. It is NOT an authority: what it writes
// is used for one thing only, to fetch more candidate passages. It never replaces the original question, it never reaches
// the answer, and nothing it says is treated as a fact - an expansion that states a number, a date or a regulation / section
// reference which the question did not contain is thrown away whole. When the model fails, is absent or is rejected, the
// result is exactly the original lexical retrieval.
// EXPERIMENTAL: not wired into the grounded pipeline. It enters only if the blind TEST-2 probes show a gain that generalises.
const retriever=require('./lexical-retriever');

const VERSION='sinbad-query-expansion/0-v1';
const MAX_QUERIES=2,MIN_WORDS=3,MAX_WORDS=24,MAX_CHARS=220;
const SYSTEM=[
  '/no_think',
  'You write search queries for a library of maritime regulations and training material (IMO conventions and codes, ILO MLC, flag and class documents, exam question banks in English and Turkish).',
  'Given a user question, write exactly two short search queries. A query is NOT a question: it is a fragment of the sentence in the official text that would contain the answer, in the words such a text uses (for example: shall, means, at least, not exceeding, is entitled to, shall be carried out).',
  'Example - question: "Does having a pilot on board take away the captain\'s responsibility?" - query: "presence of a pilot does not relieve the master of his duties and obligations".',
  'Q1: in the language of the question. Q2: the same fragment in the other language (English if the question is Turkish, Turkish if the question is English).',
  'Rules: do not answer the question. No question marks. Do not write any number, date, limit or period. Do not write any regulation, rule, chapter, section, article or annex number. Each query has 4 to 16 words.',
  'Output exactly two lines and nothing else:',
  'Q1: ...',
  'Q2: ...'
].join('\n');
const messages=question=>[{role:'system',content:SYSTEM},{role:'user',content:String(question||'').trim().slice(0,1000)}];

const NUMBER_WORDS=/(?<![\p{L}\p{N}])(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|once|twice|monthly|weekly|annual|annually|yearly|daily|iki|üç|dört|beş|altı|yedi|sekiz|dokuz|onbir|oniki|yirmi|otuz|kırk|elli|altmış|yetmiş|seksen|doksan|yüz|bin|aylık|haftalık|yıllık|günlük)(?![\p{L}\p{N}])/giu;
const REFERENCE=/(?<![\p{L}\p{N}])(?:regulation|rule|section|chapter|annex|article|paragraph|part|standard|guideline|appendix|kural|bölüm|madde|ek|kısım|fıkra)\s+(?:[ivxlcdm]{1,6}(?![\p{L}])|[a-z]?\d[\w./-]*|[a-z](?![\p{L}\p{N}]))/giu;
const lower=text=>String(text||'').toLowerCase().normalize('NFKC');
const words=text=>lower(text).match(/[\p{L}\p{N}]+/gu)||[];

// parse(raw) -> queries as written, or null when the output does not have the required shape.
function parse(raw){
  if(typeof raw!=='string')return null;
  const text=raw.replace(/<think>[\s\S]*?<\/think>/giu,'').trim();if(!text||/<\/?think>/iu.test(text))return null;
  const lines=text.split(/\r?\n/u).map(l=>l.trim()).filter(Boolean);if(!lines.length||lines.length>MAX_QUERIES)return null;
  const out=[];for(const [i,line] of lines.entries()){const m=/^Q([12]):\s*(.+)$/u.exec(line);if(!m||Number(m[1])!==i+1)return null;out.push(m[2].replace(/^["'`]+|["'`]+$/gu,'').trim());}
  return out;
}
// check(question, raw) -> {valid, queries, reason}. Any finding invalidates the WHOLE expansion.
function check(question,raw){
  const fail=reason=>({version:VERSION,valid:false,queries:[],reason});
  if(typeof question!=='string'||!question.trim())return fail('QUESTION_REQUIRED');
  const queries=parse(raw);if(!queries)return fail('FORMAT_INVALID');
  const q=lower(question);const questionDigits=new Set(q.match(/\d+/gu)||[]);const questionWords=new Set(words(question));
  // A reference is known when its identifier ("19", "vi", "a") belongs to a reference in the question: "kural 19" for "rule 19".
  const identifier=ref=>ref.trim().split(/\s+/u).pop();const questionRefs=new Set((q.match(REFERENCE)||[]).map(identifier));
  for(const query of queries){
    const n=words(query).length;if(n<MIN_WORDS||n>MAX_WORDS||query.length>MAX_CHARS)return fail('LENGTH_INVALID');
    if(query.includes('?'))return fail('QUERY_IS_A_QUESTION');
    const text=lower(query);
    for(const d of text.match(/\d+/gu)||[])if(!questionDigits.has(d))return fail('NUMBER_NOT_IN_QUESTION');
    for(const w of text.match(NUMBER_WORDS)||[])if(!questionWords.has(w))return fail('NUMBER_WORD_NOT_IN_QUESTION');
    for(const r of text.match(REFERENCE)||[])if(!questionRefs.has(identifier(r)))return fail('REFERENCE_NOT_IN_QUESTION');
  }
  if(new Set(queries.map(lower)).size!==queries.length)return fail('DUPLICATE_QUERY');
  return {version:VERSION,valid:true,queries,reason:null};
}

// The passages the retriever would show for one ranking: best first, at most `cap` per document.
function capped(index,ranked,limit,cap,taken=new Set(),perDocument=new Map()){
  const out=[];
  for(const [id] of ranked){if(out.length>=limit)break;if(taken.has(id))continue;const doc=index.chunks[id].docIndex;const used=perDocument.get(doc)||0;if(used>=cap)continue;perDocument.set(doc,used+1);taken.add(id);out.push(id);}
  return out;
}
// fuse({index, question, queries, passages, keep, use}) -> {ids, sources:['original'|'expansion'], fromExpansion}
// SLOTS fusion, chosen because it can be explained in one sentence: the first `keep` passages are exactly the original
// lexical result, untouched and in its order; the remaining places are filled from the expansion queries, taken in turns,
// skipping what is already shown; places the expansion cannot fill go back to the original ranking. With no valid query the
// result IS the original result. `use` limits how many of the expansion queries take part (1 = Q1 only).
function fuse(input){
  const {index,question}=input;const passages=Math.max(1,Math.min(retriever.MAX_PASSAGES,Number.isInteger(input.passages)?input.passages:6));
  const keep=Math.max(0,Math.min(passages,Number.isInteger(input.keep)?input.keep:passages));const cap=retriever.MAX_PER_DOCUMENT;
  const queries=(Array.isArray(input.queries)?input.queries:[]).filter(s=>typeof s==='string'&&s.trim()).slice(0,Number.isInteger(input.use)?input.use:MAX_QUERIES);
  const original=retriever.rank(index,question);const taken=new Set();const perDocument=new Map();
  if(!queries.length){const ids=capped(index,original,passages,cap,taken,perDocument);return {ids,sources:ids.map(()=>'original'),fromExpansion:0};}
  const ids=capped(index,original,keep,cap,taken,perDocument);const sources=ids.map(()=>'original');
  const lists=queries.map(text=>retriever.rank(index,text));const cursor=lists.map(()=>0);let progressed=true;
  while(ids.length<passages&&progressed){progressed=false;
    for(const [li,list] of lists.entries()){if(ids.length>=passages)break;
      while(cursor[li]<list.length){const id=list[cursor[li]][0];cursor[li]+=1;if(taken.has(id))continue;const doc=index.chunks[id].docIndex;const used=perDocument.get(doc)||0;if(used>=cap)continue;perDocument.set(doc,used+1);taken.add(id);ids.push(id);sources.push('expansion');progressed=true;break;}}}
  if(ids.length<passages)for(const id of capped(index,original,passages-ids.length,cap,taken,perDocument)){ids.push(id);sources.push('original');}
  return {ids,sources,fromExpansion:sources.filter(s=>s==='expansion').length};
}
module.exports=Object.freeze({VERSION,MAX_QUERIES,SYSTEM,messages,parse,check,fuse});
