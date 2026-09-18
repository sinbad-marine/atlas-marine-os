'use strict';
// Project 2 Phase 4.1 - Draft Adapter v0 (inert, deterministic free-text -> structured draft).
// Owner GO 2026-09-18 ("1. GO ARDINDAN 2. GO" after the Phase 4 readiness report): taken as a GO
// for the first step of the recommended order only, "PROJECT 2 / PHASE 4.1 - DRAFT ADAPTER v0 ONLY".
//
// Live answers are free text; the accepted components read claim units, an identified evidence
// set, citations and a draft hash. Draft Adapter v0 is the missing translation, on paper: one
// answer text plus the passages the answer was given (each with its [S#] marker and its evidence
// identity) -> one sealed AdaptedDraft whose `chainPass` is exactly one {evidenceSet, draft} pass of
// the Offline Chain. It segments by fixed rules, binds each claim to the markers written inside it,
// and reports what it did not turn into a claim and why.
// It interprets nothing: it does not judge, rephrase, merge, reorder or drop what the answer says,
// never treats a sentence as mere reported speech, and maps a marker it does not know to an
// evidence id that does not exist, so that a fabricated citation stays visible to the gate. It calls
// no model, performs no I/O, reads no clock, keeps no state, is not wired anywhere, never throws.
const {own,id,ref,time,freezeDeep}=require('../authority/exact');
const taskContext=require('../authority/task-context');
const evidenceSet=require('../authority/evidence-set');
const sentinel=require('../sentinel/sentinel-v0');
const gatekeeper=require('../gatekeeper/gatekeeper-v0');
const {sha256,canonical}=sentinel;

const VERSION='sinbad-draft-adapter/0-v1';
const INPUT_VERSION='sinbad-draft-adapter-input/0-v1';
const OUTPUT_VERSION='sinbad-adapted-draft/0-v1';
const SEGMENTER_VERSION='sinbad-draft-segmenter/0-v1';
const INPUT_FIELDS=Object.freeze(['version','adaptationId','at','context','answer','passages','retrievedAt','proposedActions']);
const ANSWER_FIELDS=Object.freeze(['text','originRef']);
const PASSAGE_FIELDS=Object.freeze(['marker','evidenceId','sourceClass','locatorRef','contentHash','observedAt','scopeRef']);
const MARKER_NAME=/^S[1-9]\d{0,2}$/u;
const MARKER=/\[(S[1-9]\d{0,2})\]/gu;
const MAX_ANSWER_CHARS=200_000,MAX_ADAPTATION_ID=96,MAX_PASSAGES=256,MAX_MARKERS_PER_CLAIM=64;
const SKIP_REASONS=Object.freeze(['CODE_BLOCK','HEADING','LEAD_IN','QUESTION','NO_WORDS']);
// Abbreviations after which a full stop does not end a sentence. Kept short on purpose: a wrong
// split only produces one more unsupported claim, a wrong merge lends one sentence's citation to another.
const ABBREVIATIONS=Object.freeze(['e.g','i.e','vs','no','reg','art','fig','ch','para','mr','mrs','dr','approx','örn','bkz','md','sy']);
const WORD=/[\p{L}\p{N}]{2,}/u;
const BULLET=/^\s*(?:[-*•–]|\d{1,3}[.)])\s+/u;

// segments(text) -> {claims:[{start,end}], skipped:[{start,end,reason}]} with offsets into `text` (UTF-16 code units).
function segment(text){
  const claims=[],skipped=[];let inCode=false,lineStart=0;
  while(lineStart<=text.length){
    let lineEnd=text.indexOf('\n',lineStart);if(lineEnd===-1)lineEnd=text.length;
    const line=text.slice(lineStart,lineEnd);
    if(/^\s*```/u.test(line)){inCode=!inCode;skipped.push({start:lineStart,end:lineEnd,reason:'CODE_BLOCK'});}
    else if(inCode){if(line.trim())skipped.push({start:lineStart,end:lineEnd,reason:'CODE_BLOCK'});}
    else if(/^\s*#{1,6}\s/u.test(line)){skipped.push({start:lineStart,end:lineEnd,reason:'HEADING'});}
    else if(line.trim())sentences(text,lineStart+(line.match(BULLET)||[''])[0].length,lineEnd,claims,skipped);
    lineStart=lineEnd+1;
  }
  return {claims,skipped};
}
function sentences(text,from,to,claims,skipped){
  let start=from;
  const push=end=>{
    let a=start,b=end;while(a<b&&/\s/u.test(text[a]))a+=1;while(b>a&&/\s/u.test(text[b-1]))b-=1;
    if(b>a){
      const piece=text.slice(a,b),bare=piece.replace(MARKER,'');
      if(!WORD.test(bare)){
        // Markers written after the full stop belong to the sentence they follow.
        const last=claims[claims.length-1];
        if(/\[S[1-9]\d{0,2}\]/u.test(piece)&&last&&last.end<=a&&!/\S/u.test(text.slice(last.end,a))&&last.line===from)last.end=b;else skipped.push({start:a,end:b,reason:'NO_WORDS'});
      }else if(/[?？]\s*(?:\[S[1-9]\d{0,2}\]\s*)*$/u.test(piece))skipped.push({start:a,end:b,reason:'QUESTION'});
      else if(/[:：]\s*$/u.test(bare)&&b===trimmedEnd(text,to))skipped.push({start:a,end:b,reason:'LEAD_IN'});
      else claims.push({start:a,end:b,line:from});
    }
    start=end;
  };
  for(let i=from;i<to;i+=1){
    const ch=text[i];
    if(ch!=='.'&&ch!=='!'&&ch!=='?'&&ch!=='…'&&ch!=='？'&&ch!=='！')continue;
    let j=i+1;while(j<to&&/[.!?…"'”’)\]]/u.test(text[j]))j+=1;
    // Markers written right after the end of a sentence cite that sentence, never the next one.
    const trailing=/^(?:\s*\[S[1-9]\d{0,2}\])+/u.exec(text.slice(j,to));if(trailing)j+=trailing[0].length;
    if(j<to&&!/\s/u.test(text[j]))continue;
    if(ch==='.'){const before=text.slice(start,i).match(/([\p{L}.]+)$/u);const token=before?before[1].toLowerCase():'';if(token&&(ABBREVIATIONS.includes(token)||/^\p{L}$/u.test(token)||/(?:^|\.)\p{L}$/u.test(token)&&token.includes('.')))continue;}
    push(j);i=j-1;
  }
  push(to);
}
function trimmedEnd(text,to){let b=to;while(b>0&&/\s/u.test(text[b-1]))b-=1;return b;}

function passage(input){
  const v=own(PASSAGE_FIELDS,input);
  if(!v||typeof v.marker!=='string'||!MARKER_NAME.test(v.marker))return null;
  const item=evidenceSet.item({evidenceId:v.evidenceId,sourceClass:v.sourceClass,locatorRef:v.locatorRef,contentHash:v.contentHash,observedAt:v.observedAt,scopeRef:v.scopeRef});
  return item?{marker:v.marker,item}:null;
}
function seal(record){return freezeDeep({...record,adaptationDigest:sha256(canonical(record))});}

// adapt(input) -> AdaptedDraft {status: ADAPTED | BLOCKED}. Never throws; untrustworthy input is BLOCKED with the reason.
function adapt(input){
  const meta={adaptationId:'invalid',taskRef:null,at:0,inputDigest:null,answerHash:null};
  const done=(status,reasonCode,body)=>seal({version:OUTPUT_VERSION,adaptationId:meta.adaptationId,taskRef:meta.taskRef,status,failClosed:status==='BLOCKED',reasonCode,
    chainPass:null,segments:[],skipped:[],stats:null,warnings:[],...body,
    provenance:{adapterVersion:VERSION,segmenterVersion:SEGMENTER_VERSION,inputDigest:meta.inputDigest,answerHash:meta.answerHash},at:meta.at,authority:'NONE',interprets:false,rewrites:false,callsModel:false,executes:false,approves:false,grantsAuthority:false});
  try{
    const v=own(INPUT_FIELDS,input);
    if(!v||v.version!==INPUT_VERSION||!id(v.adaptationId)||v.adaptationId.length>MAX_ADAPTATION_ID||!time(v.at)||!time(v.retrievedAt)||!Array.isArray(v.passages)||v.passages.length>MAX_PASSAGES||!Array.isArray(v.proposedActions))return done('BLOCKED','INPUT_INVALID');
    Object.assign(meta,{adaptationId:v.adaptationId,at:v.at});
    const ctx=taskContext.snapshot(v.context);if(!ctx)return done('BLOCKED','CONTEXT_INVALID');meta.taskRef=ctx.taskId;
    const answer=own(ANSWER_FIELDS,v.answer);
    if(!answer||typeof answer.text!=='string'||answer.text.length<1||answer.text.length>MAX_ANSWER_CHARS||!ref(answer.originRef))return done('BLOCKED','ANSWER_INVALID');
    const text=answer.text;meta.answerHash=sha256(text);
    const passages=v.passages.map(passage);
    if(passages.some(p=>!p)||new Set(passages.map(p=>p.marker)).size!==passages.length||new Set(passages.map(p=>p.item.evidenceId)).size!==passages.length)return done('BLOCKED','PASSAGES_INVALID');
    let actions;try{actions=JSON.parse(JSON.stringify(v.proposedActions));}catch{return done('BLOCKED','ACTIONS_NOT_PLAIN_DATA');}
    meta.inputDigest=sha256(canonical({version:INPUT_VERSION,adaptationId:v.adaptationId,at:v.at,context:ctx,answerHash:meta.answerHash,originRef:answer.originRef,passages:passages.map(p=>({marker:p.marker,...p.item})),retrievedAt:v.retrievedAt,proposedActions:actions}));
    if(v.retrievedAt>v.at)return done('BLOCKED','RETRIEVAL_FROM_THE_FUTURE');

    const byMarker=new Map(passages.map(p=>[p.marker,p.item.evidenceId]));
    // A marker the answer uses but no passage carries stays a citation - to an evidence id that does not exist.
    const evidenceIdOf=marker=>byMarker.get(marker)||`unknown-marker-${marker}`;
    const cut=segment(text);
    if(cut.claims.length>sentinel.MAX_CLAIMS)return done('BLOCKED','TOO_MANY_CLAIMS');
    const usedMarkers=[];const segments=[];const claims=[];
    for(const [index,c] of cut.claims.entries()){
      const piece=text.slice(c.start,c.end);
      if(piece.length>8192)return done('BLOCKED','SEGMENT_TOO_LONG');
      const markers=[...new Set([...piece.matchAll(MARKER)].map(m=>m[1]))];
      if(markers.length>MAX_MARKERS_PER_CLAIM)return done('BLOCKED','TOO_MANY_MARKERS');
      for(const m of markers)if(!usedMarkers.includes(m))usedMarkers.push(m);
      const claimId=`c${index+1}`;
      claims.push({claimId,contentHash:sha256(piece),text:piece,evidenceIds:markers.map(evidenceIdOf),originRef:answer.originRef,originScopeRef:ctx.evidenceScopeRef,assertionMode:'ASSERTED'});
      segments.push({claimId,start:c.start,end:c.end,markers,unknownMarkers:markers.filter(m=>!byMarker.has(m))});
    }
    // Markers inside skipped text still count as citations of the draft: nothing the answer cites is dropped.
    for(const s of cut.skipped)for(const m of text.slice(s.start,s.end).matchAll(MARKER))if(!usedMarkers.includes(m[1]))usedMarkers.push(m[1]);
    const citations=usedMarkers.map(m=>({citationId:`cit-${m}`,evidenceId:evidenceIdOf(m)}));
    const set={version:evidenceSet.VERSION,setId:`${v.adaptationId}.set`,taskRef:ctx.taskId,items:passages.map(p=>({...p.item})),retrievedAt:v.retrievedAt};
    const draft={draftId:`${v.adaptationId}.draft`,draftHash:meta.answerHash,claims,citations,proposedActions:actions};
    // Self-check with the consumers' own parsers: the adapter never hands over something they would refuse for its shape.
    if(!evidenceSet.snapshot(set))return done('BLOCKED','ADAPTED_EVIDENCE_SET_INVALID');
    if(!gatekeeper.draft(draft))return done('BLOCKED','ADAPTED_DRAFT_INVALID');

    const skipped=cut.skipped.map(s=>({start:s.start,end:s.end,reason:s.reason,chars:s.end-s.start}));
    const claimChars=segments.reduce((n,s)=>n+(s.end-s.start),0),skippedChars=skipped.reduce((n,s)=>n+s.chars,0);
    const unknown=usedMarkers.filter(m=>!byMarker.has(m));
    const warnings=[];
    if(!claims.length)warnings.push('NO_CLAIMS_FOUND');
    if(unknown.length)warnings.push('UNKNOWN_MARKERS_PRESERVED');
    if(passages.length&&!usedMarkers.length)warnings.push('PASSAGES_SUPPLIED_BUT_NO_MARKER_USED');
    if(cut.skipped.some(s=>s.reason==='QUESTION'&&sentinel.SPECIFIC_VALUE.test(text.slice(s.start,s.end))))warnings.push('SKIPPED_QUESTION_CONTAINS_SPECIFIC_VALUES');
    if(cut.skipped.some(s=>s.reason==='CODE_BLOCK'))warnings.push('CODE_BLOCK_NOT_SEGMENTED');
    return done('ADAPTED','ADAPTED',{chainPass:{evidenceSet:set,draft},segments,skipped,warnings,
      stats:{answerChars:text.length,claimChars,skippedChars,claims:claims.length,claimsWithMarkers:segments.filter(s=>s.markers.length).length,claimsWithoutMarkers:segments.filter(s=>!s.markers.length).length,markersUsed:usedMarkers.length,unknownMarkers:unknown.length,passagesSupplied:passages.length,passagesUnused:passages.filter(p=>!usedMarkers.includes(p.marker)).length}});
  }catch{return done('BLOCKED','INTERNAL_INVARIANT_VIOLATED');}
}
function verifyAdaptation(record){
  if(!record||typeof record!=='object'||Array.isArray(record)||typeof record.adaptationDigest!=='string')return false;
  try{const {adaptationDigest,...rest}=record;return sha256(canonical(rest))===adaptationDigest&&rest.authority==='NONE'&&rest.interprets===false&&(rest.status==='ADAPTED')===(rest.chainPass!==null);}catch{return false;}
}
module.exports=Object.freeze({VERSION,INPUT_VERSION,OUTPUT_VERSION,SEGMENTER_VERSION,INPUT_FIELDS,ANSWER_FIELDS,PASSAGE_FIELDS,SKIP_REASONS,ABBREVIATIONS,MAX_ANSWER_CHARS,segment,adapt,verifyAdaptation});
