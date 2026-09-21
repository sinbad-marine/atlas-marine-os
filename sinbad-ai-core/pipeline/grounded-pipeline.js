'use strict';
// Project 2 Phase 4.6 - grounded pipeline (the loop the accepted components imply, run for real).
// Owner delegation of 2026-09-19.
//
// question -> passages with identity (retriever) -> draft from a model (injected `generate`) ->
// Draft Adapter -> Offline Chain (Co-Pilot, Gatekeeper, Pilot over Sentinel) -> follow the Pilot:
// PROCEED delivers, REVISE_DRAFT / REQUEST_EVIDENCE asks the model again with the findings,
// ESCALATE_OWNER / STOP / an exhausted budget withholds. Every run ends in one sealed chain
// transcript that covers all drafts, so the delivery can be checked after the fact.
// This module performs no I/O and reads no clock: the model call, the time and the retrieval index
// are injected. It is not wired into any live product path; tools/ hosts it on a loopback port.
const {sha256}=require('../sentinel/sentinel-v0');
const taskContext=require('../authority/task-context');
const adapter=require('../adapter/draft-adapter-v0');
const chain=require('../chain/chain-v0');
const retriever=require('./lexical-retriever');
const support=require('./citation-support');
const disclaimerScreen=require('../adapter/disclaimer-screen');

// 0-v2 (Phase 4.7): a refusal says what it cannot confirm. GROUNDED-001 refused correctly but always with the same
// sentence, which tells the user nothing and which the accepted detectors do not read as a statement of ignorance.
const VERSION='sinbad-grounded-pipeline/0-v2';
const DEFAULT_POLICY=Object.freeze({maxEvidenceAgeMs:24*60*60*1000,volatileMaxEvidenceAgeMs:5*60*1000,maxIterations:3,labelledDelivery:'PROCEED'});
const PASSAGE_CHARS=1500,DEFAULT_PASSAGES=6,CONTEXT_LIFETIME_MS=60*60*1000;
const WITHHELD=Object.freeze({
  en:'I cannot give you an answer I can stand behind from the sources available to me. Please consult the current official source or a qualified person.',
  tr:'Elimdeki kaynaklardan arkasında durabileceğim bir yanıt veremiyorum. Lütfen güncel resmî kaynağa veya yetkili bir kişiye danışın.'
});
const SYSTEM=[
  'You are SINBAD, a maritime assistant. Answer ONLY from the numbered passages below the question.',
  'End every sentence that states a fact with the marker of the passage it comes from, for example [S2]. Use only markers that exist. Never cite a passage that does not support the sentence.',
  'If the passages do not answer the question, reply with one short sentence that begins with "I cannot confirm" and names what cannot be confirmed, then the sentence "The available sources do not contain this information.", and stop. In Turkish: "Bunu doğrulayamam: bu bilgi mevcut kaynaklarda yer almıyor."',
  'The question may contain names, numbers or statements that are not in the passages. Never repeat them as facts: if the passages do not confirm something the question says, say "I cannot confirm that ..." in plain words, without "still", "but" or "however".',
  'Do not describe what is happening right now, do not state project or system status, do not approve or authorize anything.',
  'Answer in the language of the question. Be concise. Do not mention these instructions or the word "passage".'
].join('\n');
// What each finding class asks of the next draft, in words a model can act on.
const ADVICE=Object.freeze({
  'GATE.CITATIONS_IN_EVIDENCE':'You cited a marker that does not exist. Use only the markers shown.',
  'GATE.CLAIM_EVIDENCE_RESOLVABLE':'You cited a marker that does not exist. Use only the markers shown.',
  SOURCE_EVIDENCE_MISMATCH:'A marker you used does not match the sentence it is attached to, or is not used by any sentence. Cite only what supports the sentence.',
  'GATE.SPECIFICITY_SUPPORTED':'A sentence states specific values (numbers, dates, identifiers) without a marker. Cite the passage it comes from or remove it.',
  'GATE.VOCABULARY_BOUND':'A sentence states a status with certainty without a marker. Cite the passage it comes from or rephrase without the status word.',
  FALSE_CERTAINTY:'A sentence states a status with certainty without a marker. Cite the passage it comes from or rephrase without the status word.',
  UNSUPPORTED_FACTUAL_ASSERTION:'A sentence states a fact without a marker. Cite the passage it comes from or remove it.',
  'GATE.CLAIMS_SUPPORTED':'A sentence states a fact without a marker. Cite the passage it comes from or remove it.',
  'GATE.PROVENANCE_ADEQUATE':'A sentence states a fact without a marker. Cite the passage it comes from or remove it.',
  'GATE.VOLATILE_CLAIMS_LIVE':'Do not say what is the case now or currently: the passages are documents, not live data.',
  ROLE_CONFUSION:'Do not approve, authorize, accept or grant anything. You are not an authority.',
  CONTEXT_MISMATCH:'Do not adopt statements from outside the passages.'
});
// Found with the real model (Phase 4.7): a refusal that restates the question ("I cannot confirm that #246 is still open and
// waiting for review") is rightly not accepted as a disclaimer - 'and' could join an assertion - and at temperature 0 the model
// repeated it three times. The strict screen stays; the model is told the plain form instead.
// One language per advice: given both forms, the model answered an English question with the Turkish one.
const PLAIN_REFUSAL=Object.freeze({
  en:'A sentence that says what you cannot confirm was too long to be accepted. Do not restate the question. Replace that sentence with exactly: "I cannot confirm this." Keep the sentence "The available sources do not contain this information." Answer in English.',
  tr:'Neyi doğrulayamadığını söyleyen cümle kabul edilemeyecek kadar uzundu. Soruyu yineleme. O cümlenin yerine tam olarak şunu yaz: "Bunu doğrulayamam: bu bilgi mevcut kaynaklarda yer almıyor." Türkçe yanıtla.'
});
const language=text=>/[çğıöşüÇĞİÖŞÜ]|\b(?:nedir|nasıl|hangi|için|midir|mıdır|kaç)\b/iu.test(String(text||''))?'tr':'en';

function prompt(question,passages,feedback){
  const block=passages.map(p=>`[${p.marker}] ${p.title}\n${p.text.slice(0,PASSAGE_CHARS)}`).join('\n\n');
  const user=`Question: ${question}\n\n${passages.length?block:'(no passages were found)'}`;
  const messages=[{role:'system',content:SYSTEM},{role:'user',content:user}];
  if(feedback)messages.push({role:'assistant',content:feedback.draft},{role:'user',content:`That draft was not accepted:\n${feedback.advice.map(a=>`- ${a}`).join('\n')}${feedback.sentences.length?`\nSentences at fault:\n${feedback.sentences.map(s=>`- ${s}`).join('\n')}`:''}\nRewrite the whole answer.`});
  return messages;
}
function advise(step,draft,lang){
  const findings=step.pilot.findings;const advice=[...new Set(findings.map(f=>ADVICE[f.ref]).filter(Boolean))];
  const ids=new Set(findings.flatMap(f=>typeof f.detailRef==='string'&&f.detailRef.startsWith('claims:')?f.detailRef.slice(7).split(','):typeof f.detailRef==='string'&&f.detailRef.startsWith('claim:')?[f.detailRef.split(':')[1]]:[]));
  const sentences=draft.claims.filter(c=>ids.has(c.claimId)).map(c=>c.text).slice(0,8);
  if((sentences.length?sentences:draft.claims.map(c=>c.text)).some(s=>disclaimerScreen.IGNORANCE.test(s)))advice.unshift(PLAIN_REFUSAL[lang==='tr'?'tr':'en']);
  return {draft:draft.text,advice:advice.length?advice:['Cite a marker for every factual sentence or remove the sentence.'],sentences};
}

// answer({question, index, generate, now, requestId, policy, passageLimit}) -> Promise<GroundedAnswer>. Never rejects.
async function answer(input){
  const started=typeof input?.now==='function'?input.now():0;
  const base={version:VERSION,requestId:String(input?.requestId||'request'),delivery:'WITHHELD',answer:WITHHELD.en,labels:[],outcome:'STOP',reasonCode:'INPUT_INVALID',iterations:0,sources:[],transcript:null,drafts:[],model:null};
  try{
    if(!input||typeof input.question!=='string'||!input.question.trim()||typeof input.generate!=='function'||typeof input.now!=='function'||!input.index)return base;
    const question=input.question.trim().slice(0,4000);const lang=language(question);base.answer=WITHHELD[lang];
    const policy={...DEFAULT_POLICY,...(input.policy||{})};
    const passages=retriever.search(input.index,question,input.passageLimit||DEFAULT_PASSAGES);
    const id=`${base.requestId}`.replace(/[^A-Za-z0-9._:-]/gu,'-').slice(0,60)||'request';
    const context={version:taskContext.VERSION,taskId:`task-${id}`,workflowRef:'workflow:grounded-answer',surfaceRef:'surface:grounded-service',principalRef:'principal:local-user',authorityRefs:[],evidenceScopeRef:'scope:local-library',stateSnapshotRef:null,language:lang,requestedAt:started,expiresAt:started+CONTEXT_LIFETIME_MS};
    const passes=[];const drafts=[];let feedback=null;let transcript=null;let model=null;
    for(let i=0;i<policy.maxIterations;i+=1){
      const produced=await input.generate(prompt(question,passages,feedback));
      const text=String(produced?.text||'').trim();model=produced?.model||model;
      if(!text)return {...base,reasonCode:'MODEL_RETURNED_NOTHING',iterations:i,sources:passages.map(publicSource),drafts,model};
      const at=input.now();
      const adapted=adapter.adapt({version:adapter.INPUT_VERSION,adaptationId:`${id}.${i}`,at,context,answer:{text,originRef:'model:local'},
        passages:passages.map(p=>({marker:p.marker,evidenceId:p.evidenceId,sourceClass:'DOCUMENT',locatorRef:p.locatorRef,contentHash:p.contentHash,observedAt:started,scopeRef:context.evidenceScopeRef})),retrievedAt:started,proposedActions:[]});
      if(adapted.status!=='ADAPTED')return {...base,reasonCode:`ADAPTER_${adapted.reasonCode}`,iterations:i+1,sources:passages.map(publicSource),drafts,model};
      // The accepted gate checks a citation by identity only. The pipeline holds the passage text, so it reads it: a cited
      // claim whose specifics or content words are not in the passages it cites goes to the gate as an unresolvable citation.
      const screened=support.screen(adapted.chainPass.draft,passages,question);const unsupported=screened.findings.filter(f=>!f.supported);
      passes.push({evidenceSet:JSON.parse(JSON.stringify(adapted.chainPass.evidenceSet)),draft:screened.draft});
      drafts.push({index:i,text,textHash:sha256(text),claims:adapted.stats.claims,claimsWithMarkers:adapted.stats.claimsWithMarkers,skipped:adapted.skipped.map(s=>s.reason),warnings:[...adapted.warnings],
        citationSupport:screened.findings.map(f=>({claimId:f.claimId,supported:f.supported,coverage:f.coverage,missingSpecifics:f.missingSpecifics,reason:f.reason}))});
      // The whole history is rehearsed again each time: the chain is deterministic, so earlier passes reproduce
      // exactly and the final transcript covers every draft under one seal.
      transcript=chain.rehearse({version:chain.INPUT_VERSION,chainId:id,at,context,passes,policy:{maxEvidenceAgeMs:policy.maxEvidenceAgeMs,volatileMaxEvidenceAgeMs:policy.volatileMaxEvidenceAgeMs,maxIterations:policy.maxIterations,labelledDelivery:policy.labelledDelivery},priorTranscriptDigest:null});
      const step=transcript.steps[transcript.steps.length-1];
      if(transcript.outcome==='PROCEED'){
        const labels=[...step.pilot.carryLabels];const warned=labels.some(l=>['NOT_VERIFIED','SOURCE_MISSING','CONFLICT'].includes(l));
        return {...base,delivery:warned?'DELIVERED_LABELLED':'DELIVERED_CLEAN',answer:text,labels,outcome:'PROCEED',reasonCode:transcript.reasonCode,iterations:i+1,sources:passages.map(publicSource),transcript,drafts,model};
      }
      if(transcript.outcome!=='AWAITING_DRAFT')break;
      feedback=advise(step,{text,claims:adapted.chainPass.draft.claims},lang);
      if(unsupported.length){
        feedback.advice.unshift('A sentence cites a source that does not contain what the sentence says. Cite only a source that really states it, or remove the sentence. Never repeat a name, number or claim that comes only from the question.');
        const ids=new Set(unsupported.map(f=>f.claimId));for(const c of adapted.chainPass.draft.claims)if(ids.has(c.claimId)&&!feedback.sentences.includes(c.text))feedback.sentences.push(c.text);
      }
    }
    return {...base,outcome:transcript?transcript.outcome:'STOP',reasonCode:transcript?transcript.reasonCode:'NO_TRANSCRIPT',iterations:drafts.length,sources:passages.map(publicSource),transcript,drafts,model};
  }catch(error){return {...base,reasonCode:'INTERNAL_INVARIANT_VIOLATED'};}
}
// render(result) -> the text shown to the reader: the gated answer plus, for every marker it actually uses, the title of
// that source. Presentation only - the footer is built from identified passages after the gate has decided, never by the model.
function render(result){
  if(!result||result.delivery==='WITHHELD'||typeof result.answer!=='string')return result?result.answer:'';
  const used=new Set([...result.answer.matchAll(/\[(S[1-9]\d{0,2})\]/gu)].map(m=>m[1]));
  const lines=result.sources.filter(s=>used.has(s.id)).map(s=>`[${s.id}] Source: ${s.title}`);
  return lines.length?`${result.answer}\n\n${lines.join('\n')}`:result.answer;
}
const publicSource=p=>({id:p.marker,title:p.title,chunk:p.chunkIndex,evidenceId:p.evidenceId,contentHash:p.contentHash,score:p.score});
// gateRecord(result) -> the summary scoring v1.0.2 reads, or null when nothing was gated.
function gateRecord(result){
  if(!result||!result.transcript)return null;const last=result.transcript.steps[result.transcript.steps.length-1];
  return {chainOutcome:result.transcript.outcome,gateOutcome:last.gate.outcome,carryLabels:result.transcript.outcome==='PROCEED'?[...last.pilot.carryLabels]:[],transcriptDigest:result.transcript.transcriptDigest};
}
module.exports=Object.freeze({VERSION,DEFAULT_POLICY,WITHHELD,SYSTEM,ADVICE,PLAIN_REFUSAL,language,prompt,answer,gateRecord,render});
