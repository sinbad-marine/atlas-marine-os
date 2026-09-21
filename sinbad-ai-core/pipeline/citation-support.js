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
//
// 0-v2 (Project 2 D6 remediation, "PROMOTE GO — CT-03 only", 2026-09-21): promotes the structural-
// label exemption that was developed and validated DEV-only (sinbad-ai-core/dev/citation-support-
// structural-label-dev.js, now retired) after two same-day Owner revisions narrowed it. CT-03 defect:
// "No, the organisation is not compliant with Evidence A [S2]." - a correct, well-cited draft - was
// blocked because "Evidence", capitalised only by the question's own "Evidence A/B" labelling
// convention, was read as a fabricated proper name.
//
// STRUCTURAL LABEL: a Title-Case word immediately followed by a bare single uppercase LETTER
// ("Evidence A", "Scenario B", "Exhibit C") is a syntactic candidate for a reference device the
// QUESTION itself may supply. It is exempted from the specifics check ONLY when that EXACT COMPLETE
// PAIR - the word AND its letter, not the word alone - also appears in this shape in the
// QUESTION/PROMPT text:
//   Q "Evidence A", claim "Evidence A"  -> exempt.
//   Q "Evidence A", claim "Evidence B"  -> NOT exempt (different pair).
//   Q "Company A",  claim "Company B"   -> NOT exempt.
//   Q "Scenario A", claim "Scenario B"  -> NOT exempt.
//   no question, or a question that never used the pair -> NOT exempt (the original, fully strict rule).
// A DIGIT suffix ("Exhibit 2") is never exempted, even if the question uses it: a number is exactly
// the kind of specific this screen exists to verify. Anchoring to the exact pair (not the head word
// alone) closes the vulnerability a head-word-only anchor would have: a claim could not swap letters,
// or borrow an unrelated word the question happened to use with a different letter, to inherit an
// exemption it never earned - a real, fabricatable named entity in the same shape ("Company A",
// "Captain A", "Vessel B") is still fully checked unless the question itself used that exact pair.
const VERSION='sinbad-citation-support/0-v2';
const MIN_COVERAGE=0.5;
const MARKER=/\[S[1-9]\d{0,2}\]/gu;
const STOP=new Set(['the','and','for','are','with','that','this','from','was','were','has','have','had','not','but','its','can','will','shall','should','must','may','which','who','how','what','when','where','does','did','into','than','then','them','they','their','there','also','any','all','per','via','such','each','been','being','other','these','those','bir','ve','ile','için','icin','bu','da','de','olan','olarak','veya','ya','ki','en','gibi','daha','her']);
const NUMBER_WORDS=Object.freeze({one:'1',two:'2',three:'3',four:'4',five:'5',six:'6',seven:'7',eight:'8',nine:'9',ten:'10',eleven:'11',twelve:'12',thirteen:'13',fourteen:'14',fifteen:'15',sixteen:'16',seventeen:'17',eighteen:'18',nineteen:'19',twenty:'20',thirty:'30',forty:'40',fifty:'50',sixty:'60',seventy:'70',eighty:'80',ninety:'90',hundred:'100',thousand:'1000'});
const words=text=>(String(text||'').normalize('NFKC').match(/[\p{L}\p{N}][\p{L}\p{N}.'-]*[\p{L}\p{N}]|[\p{L}\p{N}]/gu)||[]);
const canon=token=>{const t=token.toLowerCase().replace(/[.'-]+$/u,'');return NUMBER_WORDS[t]||t;};
const STRUCTURAL_LABEL=/\p{Lu}\p{Ll}+ \p{Lu}(?![\p{L}\p{N}])/gu;
// structuralLabelPairs(text) -> Set of canonical "word letter" pairs, e.g. {"evidence a","evidence b"}.
const structuralLabelPairs=text=>{const out=new Set();for(const m of String(text||'').matchAll(STRUCTURAL_LABEL)){const parts=m[0].trim().split(/\s+/u);out.add(canon(parts[0])+' '+parts[1].toLowerCase());}return out;};

// profile(claimText, questionPairs) -> {content:[tokens], specifics:[tokens]} of one claim, markers removed.
// `questionPairs` is the Set structuralLabelPairs() finds in the ORIGINAL QUESTION, not in this claim; a
// call with no question (or an empty Set) exempts nothing, which is the original, fully strict behaviour.
function profile(claimText,questionPairs){
  const text=String(claimText||'').replace(MARKER,' ');const tokens=words(text);const content=[];const specifics=[];
  const pairs=questionPairs instanceof Set?questionPairs:new Set();
  for(let i=0;i<tokens.length;i++){
    const raw=tokens[i];const c=canon(raw);if(c.length<2&&!/\d/u.test(c))continue;
    const numeric=/\d/u.test(c);
    const isTitleCase=!numeric&&i>0&&/^\p{Lu}[\p{L}'-]+$/u.test(raw);
    // If this word is itself the head of a "word + bare uppercase letter" pair IN THIS CLAIM, it is exempted
    // only when that exact pair - not just the head word - also occurred in the question.
    let exemptPair=false;
    if(isTitleCase){
      const next=tokens[i+1];
      if(next&&next.length===1&&/^\p{Lu}$/u.test(next)&&pairs.has(c+' '+next.toLowerCase()))exemptPair=true;
    }
    // A capitalised word that does not open the claim is treated as a name (unless it is an exempted pair);
    // so is an all-caps token of 2+ letters - exemption never applies to that branch.
    const name=!numeric&&!exemptPair&&(isTitleCase||/^\p{Lu}{2,}$/u.test(raw));
    if(numeric||name)specifics.push(c);
    if(!STOP.has(c))content.push(c);
  }
  return {content:[...new Set(content)],specifics:[...new Set(specifics)]};
}
// assess(claimText, passageTexts[], questionText) -> {supported, coverage, missingSpecifics, reason}.
// `questionText` is optional; without it (or with a question that used no matching structural-label pair)
// the check is exactly the original, fully strict rule.
function assess(claimText,passageTexts,questionText){
  const p=profile(claimText,structuralLabelPairs(questionText));const bag=new Set(words((passageTexts||[]).join('\n')).map(canon));
  if(!p.content.length)return {supported:true,coverage:1,missingSpecifics:[],reason:'NOTHING_TO_CHECK'};
  const missingSpecifics=p.specifics.filter(t=>!bag.has(t));
  const covered=p.content.filter(t=>bag.has(t)).length;const coverage=Number((covered/p.content.length).toFixed(3));
  if(missingSpecifics.length)return {supported:false,coverage,missingSpecifics,reason:'SPECIFICS_NOT_IN_CITED_PASSAGES'};
  if(coverage<MIN_COVERAGE)return {supported:false,coverage,missingSpecifics,reason:'CONTENT_NOT_IN_CITED_PASSAGES'};
  return {supported:true,coverage,missingSpecifics,reason:'WORDS_PRESENT_IN_CITED_PASSAGES'};
}
// screen(draft, passages, questionText) with passages = [{evidenceId, text}] -> {draft, findings}. The
// returned draft is a copy in which every evidence id of an unsupported claim is replaced by
// `citation-not-supported-<n>`, an id that is in no evidence set. Claim text, hashes and order are
// untouched; claims without citations are not judged here. `questionText` is the caller's original
// question, forwarded to assess() unchanged for every claim - the same question, so the same exempt
// label set, for every claim of one draft.
function screen(draft,passages,questionText){
  const textById=new Map((passages||[]).map(p=>[p.evidenceId,String(p.text||'')]));
  const copy=JSON.parse(JSON.stringify(draft));const findings=[];
  for(const claim of copy.claims){
    const cited=claim.evidenceIds.filter(id=>textById.has(id));if(!cited.length)continue;
    const verdict=assess(claim.text,cited.map(id=>textById.get(id)),questionText);
    findings.push({claimId:claim.claimId,supported:verdict.supported,coverage:verdict.coverage,missingSpecifics:verdict.missingSpecifics,reason:verdict.reason,evidenceIds:[...cited]});
    if(!verdict.supported)claim.evidenceIds=claim.evidenceIds.map((id,i)=>textById.has(id)?`citation-not-supported-${claim.claimId}-${i+1}`:id);
  }
  return {draft:copy,findings};
}
module.exports=Object.freeze({VERSION,MIN_COVERAGE,structuralLabelPairs,profile,assess,screen});
