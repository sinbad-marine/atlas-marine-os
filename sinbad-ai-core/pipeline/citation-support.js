'use strict';
// Project 2 Phase 4.6 - citation support screen (pure, deterministic).
// Owner delegation of 2026-09-19.
//
// The accepted components check a citation by IDENTITY: the marker exists, its passage is in scope
// and fresh. They never read the passage, so a claim that cites a real passage which does not say
// what the claim says is VERIFIED. The first real model run did exactly that: asked about a name
// planted in the question, it answered "The DPA is Captain John Smith [S1]" over a passage that
// names nobody. This screen reads the passage. For every cited claim it asks two things of the
// passages the claim cites:
//   1. SPECIFICS - every number and every proper name in the claim occurs in them;
//   2. COVERAGE  - enough of the claim's content words occur in them.
// It is lexical, not semantic: it proves that the words are there, not that the passage means the
// same. It can therefore only ever REMOVE trust, never add any: an unsupported citation is handed
// to the gate as a citation to an evidence id that does not exist, which the accepted gate blocks.
const VERSION='sinbad-citation-support/0-v1';
const MIN_COVERAGE=0.5;
const MARKER=/\[S[1-9]\d{0,2}\]/gu;
const STOP=new Set(['the','and','for','are','with','that','this','from','was','were','has','have','had','not','but','its','can','will','shall','should','must','may','which','who','how','what','when','where','does','did','into','than','then','them','they','their','there','also','any','all','per','via','such','each','been','being','other','these','those','bir','ve','ile','için','icin','bu','da','de','olan','olarak','veya','ya','ki','en','gibi','daha','her']);
const NUMBER_WORDS=Object.freeze({one:'1',two:'2',three:'3',four:'4',five:'5',six:'6',seven:'7',eight:'8',nine:'9',ten:'10',eleven:'11',twelve:'12',thirteen:'13',fourteen:'14',fifteen:'15',sixteen:'16',seventeen:'17',eighteen:'18',nineteen:'19',twenty:'20',thirty:'30',forty:'40',fifty:'50',sixty:'60',seventy:'70',eighty:'80',ninety:'90',hundred:'100',thousand:'1000'});
const words=text=>(String(text||'').normalize('NFKC').match(/[\p{L}\p{N}][\p{L}\p{N}.'-]*[\p{L}\p{N}]|[\p{L}\p{N}]/gu)||[]);
const canon=token=>{const t=token.toLowerCase().replace(/[.'-]+$/u,'');return NUMBER_WORDS[t]||t;};

// profile(claimText) -> {content:[tokens], specifics:[tokens]} of one claim, markers removed.
function profile(claimText){
  const text=String(claimText||'').replace(MARKER,' ');const tokens=words(text);const content=[];const specifics=[];
  for(const [i,raw] of tokens.entries()){
    const c=canon(raw);if(c.length<2&&!/\d/u.test(c))continue;
    const numeric=/\d/u.test(c);
    // A capitalised word that does not open the claim is treated as a name; so is an all-caps token of 2+ letters.
    const name=!numeric&&((i>0&&/^\p{Lu}[\p{L}'-]+$/u.test(raw))||/^\p{Lu}{2,}$/u.test(raw));
    if(numeric||name)specifics.push(c);
    if(!STOP.has(c))content.push(c);
  }
  return {content:[...new Set(content)],specifics:[...new Set(specifics)]};
}
// assess(claimText, passageTexts[]) -> {supported, coverage, missingSpecifics, reason}
function assess(claimText,passageTexts){
  const p=profile(claimText);const bag=new Set(words((passageTexts||[]).join('\n')).map(canon));
  if(!p.content.length)return {supported:true,coverage:1,missingSpecifics:[],reason:'NOTHING_TO_CHECK'};
  const missingSpecifics=p.specifics.filter(t=>!bag.has(t));
  const covered=p.content.filter(t=>bag.has(t)).length;const coverage=Number((covered/p.content.length).toFixed(3));
  if(missingSpecifics.length)return {supported:false,coverage,missingSpecifics,reason:'SPECIFICS_NOT_IN_CITED_PASSAGES'};
  if(coverage<MIN_COVERAGE)return {supported:false,coverage,missingSpecifics,reason:'CONTENT_NOT_IN_CITED_PASSAGES'};
  return {supported:true,coverage,missingSpecifics,reason:'WORDS_PRESENT_IN_CITED_PASSAGES'};
}
// screen(draft, passages) with passages = [{evidenceId, text}] -> {draft, findings}. The returned draft is a copy in
// which every evidence id of an unsupported claim is replaced by `citation-not-supported-<n>`, an id that is in no evidence
// set. Claim text, hashes and order are untouched; claims without citations are not judged here.
function screen(draft,passages){
  const textById=new Map((passages||[]).map(p=>[p.evidenceId,String(p.text||'')]));
  const copy=JSON.parse(JSON.stringify(draft));const findings=[];
  for(const claim of copy.claims){
    const cited=claim.evidenceIds.filter(id=>textById.has(id));if(!cited.length)continue;
    const verdict=assess(claim.text,cited.map(id=>textById.get(id)));
    findings.push({claimId:claim.claimId,supported:verdict.supported,coverage:verdict.coverage,missingSpecifics:verdict.missingSpecifics,reason:verdict.reason,evidenceIds:[...cited]});
    if(!verdict.supported)claim.evidenceIds=claim.evidenceIds.map((id,i)=>textById.has(id)?`citation-not-supported-${claim.claimId}-${i+1}`:id);
  }
  return {draft:copy,findings};
}
module.exports=Object.freeze({VERSION,MIN_COVERAGE,profile,assess,screen});
