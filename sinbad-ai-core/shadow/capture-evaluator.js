'use strict';
// Capture evaluator (Phase 4.3a, step A2): the pure part. One captured response of the cloud answer function ->
// mapped (A1) -> adapted (Draft Adapter v0) -> gated (Offline Chain v0) -> a public outcome; many outcomes plus the
// scoring aggregates -> one privacy-safe aggregate report. No I/O, no network, no model, no clock, no change to any
// accepted component: this module only composes them. Scoring (v1.0.1 / v1.0.2 / v1.0.3) and file handling live in
// tools/evaluate-shadow-capture.js; their results come in as plain data.
//
// Privacy boundary, in the shape of the code: evaluateCapture returns {outcome, transient}. `outcome` is public (counts,
// enumerations, hashes of nothing private). `transient` carries the answer text and the source titles that the tool
// needs for text scoring and must never write anywhere. buildReport accepts outcomes and numbers only.
const crypto=require('node:crypto');
const mapper=require('./response-mapper');
const adapter=require('../adapter/draft-adapter-v0');
const chain=require('../chain/chain-v0');
const {own,id,time,language,freezeDeep}=require('../authority/exact');

const VERSION='sinbad-shadow-capture-evaluator/0-v1';
const RECORD_VERSION='sinbad-shadow-capture-record/0-v1';
const REPORT_VERSION='sinbad-shadow-capture-report/0-v1';
const RECORD_FIELDS=Object.freeze(['version','captureId','itemId','capturedAt','workspaceId','language','httpStatus','latencyMs','response','error']);
// the same gate policy the grounded pipeline uses (a test keeps the two equal)
const CHAIN_POLICY=Object.freeze({maxEvidenceAgeMs:24*60*60*1000,volatileMaxEvidenceAgeMs:5*60*1000,maxIterations:3,labelledDelivery:'PROCEED'});
const ITEM_ID=/^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+){1,3}$/u;
const WORKSPACE_ID=/^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/u;
const WARN_LABELS=Object.freeze(['NOT_VERIFIED','SOURCE_MISSING','CONFLICT']);
const STATUSES=Object.freeze(['GATED','REFUSED','ADAPTER_BLOCKED','ERROR']);
const LIMITS=Object.freeze([
  ...mapper.LIMITS,
  'REPLAY_NOT_PRODUCTION: captures are answers to a fixed gold prompt set sent by the Owner; they are not the distribution of real user questions',
  'RESTRICTED_MODE_NOT_MEASURED: non-privileged responses carry no markers and no sources and are counted as refused, never gated',
  'GATE_IS_OFFLINE: the chain ran on the captured answer; nothing was delivered, labelled or blocked for any user'
]);

const sha256=text=>crypto.createHash('sha256').update(Buffer.from(String(text),'utf8')).digest('hex');
function canonical(value){
  if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;
  if(value&&typeof value==='object')return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
const isPlainObject=v=>{try{return v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;}catch{return false;}};
const tally=values=>{const out={};for(const v of [...values].sort())out[v]=(out[v]||0)+1;return out;};

// ---------- capture record ----------
function validateRecord(input){
  const v=own(RECORD_FIELDS,input);
  const errors=[];
  if(!v)return {ok:false,errors:['RECORD_KEYS_NOT_EXACT'],record:null};
  if(v.version!==RECORD_VERSION)errors.push('VERSION_INVALID');
  if(!id(v.captureId)||v.captureId.length>90)errors.push('CAPTURE_ID_INVALID');
  if(typeof v.itemId!=='string'||v.itemId.length>40||!ITEM_ID.test(v.itemId))errors.push('ITEM_ID_INVALID');
  if(!time(v.capturedAt))errors.push('CAPTURED_AT_INVALID');
  if(typeof v.workspaceId!=='string'||!WORKSPACE_ID.test(v.workspaceId))errors.push('WORKSPACE_ID_INVALID');
  if(!language(v.language))errors.push('LANGUAGE_INVALID');
  if(!Number.isSafeInteger(v.httpStatus)||v.httpStatus<0||v.httpStatus>599)errors.push('HTTP_STATUS_INVALID');
  if(!(v.latencyMs===null||(Number.isSafeInteger(v.latencyMs)&&v.latencyMs>=0)))errors.push('LATENCY_INVALID');
  if(!(v.response===null||isPlainObject(v.response)))errors.push('RESPONSE_INVALID');
  if(!(v.error===null||(typeof v.error==='string'&&v.error.length<=300)))errors.push('ERROR_INVALID');
  return errors.length?{ok:false,errors,record:null}:{ok:true,errors:[],record:v};
}
// the TaskContext of a replay: derived from the record only; no authority, workspace-scoped evidence
function taskContextFor(record){
  return {version:'sinbad-task-context/1-v1',taskId:`shadow-${record.captureId}`,workflowRef:'workflow:shadow-replay',surfaceRef:'surface:sinbad-answer',principalRef:'principal:owner',authorityRefs:[],
    evidenceScopeRef:`workspace:${record.workspaceId}`,stateSnapshotRef:null,language:record.language,requestedAt:record.capturedAt,expiresAt:record.capturedAt+60*60*1000};
}

// ---------- one capture ----------
// -> {outcome (public), transient {answerText, sourceTitles} (never to be written)}
function evaluateCapture(record,deps={}){
  const gate=deps.chain||chain;   // injectable only so a test can prove the unverified-transcript path
  const base={captureId:record.captureId,itemId:record.itemId,httpStatus:record.httpStatus,mode:null};
  const fail=(status,reason,extra)=>({outcome:freezeDeep({...base,status,reason,sources:null,adapted:null,gate:null,...extra}),transient:null});
  try{
    const response=record.response;
    if(record.httpStatus!==200||response===null)return fail('ERROR',record.httpStatus!==200?`HTTP_${record.httpStatus}`:'NO_RESPONSE');
    const modeValue=Object.getOwnPropertyDescriptor(response,'mode');
    base.mode=modeValue&&typeof modeValue.value==='string'&&modeValue.value.length<=40?modeValue.value:null;
    const context=taskContextFor(record);
    const mapped=mapper.map({version:mapper.INPUT_VERSION,captureId:record.captureId,capturedAt:record.capturedAt,workspaceId:record.workspaceId,context,response});
    if(mapped.status!=='MAPPED')return fail('REFUSED',mapped.reasonCode);
    const adapted=adapter.adapt(JSON.parse(JSON.stringify(mapped.adapterInput)));
    if(adapted.status!=='ADAPTED')return fail('ADAPTER_BLOCKED',adapted.reasonCode,{sources:mapped.stats.sources});
    const transcript=gate.rehearse({version:chain.INPUT_VERSION,chainId:`shadow-${record.captureId}`,at:record.capturedAt,context,passes:[JSON.parse(JSON.stringify(adapted.chainPass))],policy:{...CHAIN_POLICY},priorTranscriptDigest:null});
    if(gate.verifyTranscript(transcript)!==true)return fail('ERROR','TRANSCRIPT_UNVERIFIED',{sources:mapped.stats.sources});
    const step=transcript.steps[transcript.steps.length-1];
    const labels=transcript.outcome==='PROCEED'?[...step.pilot.carryLabels]:[];
    const delivery=transcript.outcome==='PROCEED'?(labels.some(l=>WARN_LABELS.includes(l))?'DELIVERED_LABELLED':'DELIVERED_CLEAN'):'WITHHELD';
    const stats=adapted.stats;
    const titles=(Array.isArray(Object.getOwnPropertyDescriptor(response,'sources')&&Object.getOwnPropertyDescriptor(response,'sources').value)?response.sources:[]).map(s=>s&&typeof s.title==='string'?s.title:'');
    return {
      outcome:freezeDeep({...base,status:'GATED',reason:null,sources:mapped.stats.sources,
        adapted:{claims:stats.claims,claimsWithMarkers:stats.claimsWithMarkers,markersUsed:stats.markersUsed,unknownMarkers:stats.unknownMarkers,passagesUnused:stats.passagesUnused,warnings:[...adapted.warnings]},
        gate:{record:{chainOutcome:transcript.outcome,gateOutcome:step.gate.outcome,carryLabels:labels,transcriptDigest:transcript.transcriptDigest},delivery,labels,
          gateReason:step.gate.reasonCode,pilotRule:step.pilot.ruleId,findingRefs:step.pilot.findings.map(f=>f.ref)}}),
      transient:{answerText:response.answer,sourceTitles:titles}
    };
  }catch{return fail('ERROR','PIPELINE_EXCEPTION');}
}

// ---------- the aggregate report ----------
const NUMERIC_TALLY_KEYS=['tests','PASS','PARTIAL','FAIL','ERROR','NOT_SUPPORTED','CORRECT_DELIVERED','CORRECT_OVER_LABELLED','FALSE_BLOCK','PARTIAL_DELIVERED','PARTIAL_FLAGGED','PARTIAL_WITHHELD','HARM_DELIVERED','HARM_FLAGGED','HARM_CAUGHT','NOT_SCORED','GATE_RECORD_INVALID',
  'SAFE_INCOMPLETE_DELIVERED','SAFE_INCOMPLETE_FLAGGED','SAFE_INCOMPLETE_WITHHELD','unsafeDeliveredCount','harmDeliveredRate','harmFlaggedRate','harmCaughtRate','falseBlockRate','overLabelRate','unsafeDeliveredRate'];
const pick=(source,keys)=>{const out={};if(source&&typeof source==='object')for(const k of keys)if(Object.hasOwn(source,k)&&(typeof source[k]==='number'||source[k]===null))out[k]=source[k];return out;};
const rank=values=>Object.entries(tally(values)).map(([ref,count])=>({ref,count})).sort((a,b)=>b.count-a.count||(a.ref<b.ref?-1:1));

// buildReport({outcomes, scoring, plan, intake}) -> sealed report. Only counts, enumerations and public gold item ids.
//   outcomes: the public `outcome` of every evaluated capture; plan: [{id,category,gating,role,baselineTextOutcome}]
//   scoring: the aggregates of the existing runner (v1.0.2 and v1.0.3 blocks) or null when nothing was gated
//   intake: {filesSeen, invalid:{count,reasons}, duplicateItems, unknownItems}
function buildReport({outcomes,scoring,plan,intake}){
  const gated=outcomes.filter(o=>o.status==='GATED');
  const captured=new Set(outcomes.map(o=>o.itemId));
  const claims=gated.reduce((n,o)=>n+o.adapted.claims,0),withMarker=gated.reduce((n,o)=>n+o.adapted.claimsWithMarkers,0);
  const gateRows=gated.map(o=>o.gate);
  const itemById=new Map(plan.map(p=>[p.id,p]));
  let scored=null;
  if(scoring){
    const cmp=new Map(scoring.baselineComparison.map(r=>[r.id,r])),v3=new Map(scoring.v103.perItem.map(r=>[r.id,r]));
    scored={
      textScorer:scoring.scorer,
      gated:{overall:pick(scoring.overall.gated,NUMERIC_TALLY_KEYS),gatingItems:pick(scoring.gatingItems.gated,NUMERIC_TALLY_KEYS),maritimeSlice:pick(scoring.maritimeSlice.gated,NUMERIC_TALLY_KEYS)},
      ungated:{overall:pick(scoring.overall.ungated,NUMERIC_TALLY_KEYS),gatingItems:pick(scoring.gatingItems.ungated,NUMERIC_TALLY_KEYS),maritimeSlice:pick(scoring.maritimeSlice.ungated,NUMERIC_TALLY_KEYS)},
      contentSafetyV103:{overall:pick(scoring.v103.overall,NUMERIC_TALLY_KEYS),gatingItems:pick(scoring.v103.gatingItems,NUMERIC_TALLY_KEYS),unjudgeable:scoring.v103.unjudgeable.map(u=>({id:u.id,category:u.category,rule:u.rule}))},
      byCategory:Object.fromEntries(Object.keys(scoring.byCategory).sort().map(c=>[c,pick(scoring.byCategory[c],NUMERIC_TALLY_KEYS)])),
      perItem:[...cmp.keys()].sort().map(idv=>{const p=itemById.get(idv)||{},c=cmp.get(idv),s=v3.get(idv)||{};
        return {id:idv,category:c.category,gating:Boolean(p.gating),role:c.role,baselineTextOutcome:c.baseline,textOutcome:c.now,delivery:c.delivery,cellV102:c.cell,cellV103:s.cell||null,contentSafety:s.contentSafety||null,unsafeDelivered:s.unsafeDelivered===true};})
    };
  }
  const report={
    version:REPORT_VERSION,evaluator:VERSION,mapper:mapper.VERSION,adapter:adapter.VERSION,chain:chain.VERSION,chainPolicy:{...CHAIN_POLICY},
    statement:'Aggregate only: counts, enumerations and public gold item ids. No answer text, source title, document id, workspace id or capture id is in this report. Not an Owner acceptance and not a threshold decision.',
    limits:[...LIMITS],
    intake:{filesSeen:intake.filesSeen,invalid:{count:intake.invalid.count,reasons:{...intake.invalid.reasons}},duplicateItems:intake.duplicateItems,unknownItems:intake.unknownItems},
    captures:{total:outcomes.length,byStatus:Object.fromEntries(STATUSES.map(s=>[s,outcomes.filter(o=>o.status===s).length])),
      refusedByReason:tally(outcomes.filter(o=>o.status==='REFUSED').map(o=>o.reason)),adapterBlockedByReason:tally(outcomes.filter(o=>o.status==='ADAPTER_BLOCKED').map(o=>o.reason)),errorByReason:tally(outcomes.filter(o=>o.status==='ERROR').map(o=>o.reason)),
      modes:tally(outcomes.map(o=>o.mode===null?'NONE':o.mode)),notCaptured:plan.map(p=>p.id).filter(x=>!captured.has(x)).sort()},
    markers:{gatedCaptures:gated.length,claims,claimsWithMarkers:withMarker,claimShareWithMarker:claims?Number((withMarker/claims).toFixed(3)):null,
      capturesWithAnyMarker:gated.filter(o=>o.adapted.markersUsed>0).length,capturesWithUnknownMarker:gated.filter(o=>o.adapted.unknownMarkers>0).length,passagesUnused:gated.reduce((n,o)=>n+o.adapted.passagesUnused,0)},
    gate:{chainOutcome:tally(gateRows.map(g=>g.record.chainOutcome)),gateOutcome:tally(gateRows.map(g=>g.record.gateOutcome)),delivery:tally(gateRows.map(g=>g.delivery)),
      blockingCauses:rank(gated.filter(o=>o.gate.record.chainOutcome!=='PROCEED'||o.gate.delivery==='DELIVERED_LABELLED').flatMap(o=>[...o.gate.findingRefs,`GATE:${o.gate.gateReason}`])),
      gateRecordInvalid:scored?scored.perItem.filter(p=>p.cellV102==='GATE_RECORD_INVALID').map(p=>p.id):[]},
    scoring:scored
  };
  return freezeDeep({...report,reportDigest:sha256(canonical(report))});
}

module.exports=Object.freeze({VERSION,RECORD_VERSION,REPORT_VERSION,RECORD_FIELDS,CHAIN_POLICY,STATUSES,LIMITS,validateRecord,taskContextFor,evaluateCapture,buildReport});
