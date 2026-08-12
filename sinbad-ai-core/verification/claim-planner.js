'use strict';
const claims=require('./claim-contracts.js');
const provenance=require('../library/provenance.js');

const SCHEMA_VERSION='sinbad-claim-plan/2F-v1';
const PLANNER_VERSION='sinbad-evidence-bound-claim-planner/2F-v1';
const MAX_CLAIMS=8;
const authenticPlans=new WeakSet();
const EXPECTED_PROVENANCE_ERRORS=new Set(['PROVENANCE_INCOMPLETE','INDEX_UNAVAILABLE']);

function words(value){return [...new Set(String(value||'').toLowerCase().match(/[\p{L}\p{N}]{2,}/gu)||[])];}
function lines(text){const output=[];let start=0;while(start<=text.length){const newline=text.indexOf('\n',start),end=newline===-1?text.length:newline;if(end>start)output.push({start,end,text:text.slice(start,end)});if(newline===-1)break;start=newline+1;}return output;}
function audit(target,event,outcome,details={}){if(target&&typeof target.append==='function')target.append('claim-planning','evidence-bound-claim-planner',outcome,event,Object.freeze({plannerVersion:PLANNER_VERSION,schemaVersion:SCHEMA_VERSION,...details}));}
function queryHash(value){return claims.sha256(Buffer.from(String(value||'').normalize('NFC'),'utf8'));}
function result(value){const output=Object.freeze(value);authenticPlans.add(output);return output;}
function isAuthenticPlan(value){return Boolean(value&&authenticPlans.has(value));}
function unavailable(input={}){return result({schemaVersion:SCHEMA_VERSION,plannerVersion:PLANNER_VERSION,transactionId:String(input.transactionId||''),queryHash:String(input.queryHash||''),status:'PLANNER_UNAVAILABLE',reasonCode:String(input.reasonCode||'PLANNER_UNAVAILABLE'),claims:Object.freeze([]),rejected:Object.freeze([]),metrics:Object.freeze({selectedEvidenceCount:Number(input.selectedEvidenceCount)||0,candidateCount:0,deduplicatedOccurrenceCount:0,claimCount:0})});}
function plan(input={},context={}){
  const selected=Array.isArray(input.selected)?input.selected:[];
  const queryWords=words(input.query);
  const transactionId=String(input.transactionId||''),plannedQueryHash=queryHash(input.query);
  const limit=Number.isInteger(input.limit)&&input.limit>0?Math.min(input.limit,MAX_CLAIMS):3;
  audit(context.audit,'CLAIM_PLANNING_STARTED','started',{transactionId:input.transactionId||null,selectedCount:selected.length,queryTokenCount:queryWords.length,limit});
  const candidates=[];const rejected=[];
  for(const evidence of [...selected].sort((a,b)=>String(a?.id||'').localeCompare(String(b?.id||'')))){
      if(!evidence||typeof evidence.id!=='string'||typeof evidence.content!=='string'||!evidence.provenance||typeof evidence.provenance!=='object'||Array.isArray(evidence.provenance)){rejected.push(Object.freeze({evidenceId:evidence?.id||null,reason:'MALFORMED_EVIDENCE'}));continue;}
    for(const line of lines(evidence.content)){
      if(!line.text.trim()||line.text.length>claims.MAX_CLAIM_STATEMENT_LENGTH)continue;
      const haystack=words(line.text),hits=queryWords.filter(word=>haystack.includes(word)).length,requiredHits=queryWords.length<=1?1:2;if(hits<requiredHits)continue;
      let occurrence;try{occurrence=provenance.resolveCanonicalOccurrence(evidence.provenance,{chunkContent:evidence.content,localStartOffset:line.start,localEndOffset:line.end});}catch(error){if(!EXPECTED_PROVENANCE_ERRORS.has(error?.code))throw error;rejected.push(Object.freeze({evidenceId:evidence.id,startOffset:line.start,endOffset:line.end,reason:error.code}));continue;}
      const support=Object.freeze({mode:'EXACT_SPAN',evidenceId:evidence.id,startOffset:line.start,endOffset:line.end,spanHash:claims.sha256(Buffer.from(line.text,'utf8')),offsetEncoding:'UTF16_CODE_UNIT'});
      const base={schemaVersion:claims.CLAIM_SCHEMA,claimType:'FACT',statement:line.text,support,requiresAuthoritative:true};
      candidates.push({claim:claims.claim({...base,claimId:claims.deriveClaimId(base)}),occurrenceId:occurrence.occurrenceId,hits,evidenceId:evidence.id,startOffset:line.start});
    }
  }
  candidates.sort((a,b)=>b.hits-a.hits||a.occurrenceId.localeCompare(b.occurrenceId)||a.evidenceId.localeCompare(b.evidenceId)||a.startOffset-b.startOffset);
  const seen=new Set(),planned=[];for(const candidate of candidates){if(seen.has(candidate.occurrenceId))continue;seen.add(candidate.occurrenceId);planned.push(candidate);if(planned.length===limit)break;}
  for(const item of planned)audit(context.audit,'CLAIM_CANDIDATE_BOUND','passed',{transactionId:input.transactionId||null,claimId:item.claim.claimId,evidenceId:item.evidenceId,occurrenceId:item.occurrenceId,startOffset:item.claim.support.startOffset,endOffset:item.claim.support.endOffset});
  const output=result({schemaVersion:SCHEMA_VERSION,plannerVersion:PLANNER_VERSION,transactionId,queryHash:plannedQueryHash,status:planned.length?'CLAIMS_PLANNED':'NO_ELIGIBLE_CLAIMS',reasonCode:planned.length?null:'NO_MATCHING_CANONICAL_OCCURRENCE',claims:Object.freeze(planned.map(item=>item.claim)),rejected:Object.freeze(rejected),metrics:Object.freeze({selectedEvidenceCount:selected.length,candidateCount:candidates.length,deduplicatedOccurrenceCount:seen.size,claimCount:planned.length})});
  audit(context.audit,planned.length?'CLAIM_PLANNING_COMPLETED':'CLAIM_PLANNING_STOPPED',planned.length?'passed':'stopped',{transactionId:input.transactionId||null,status:output.status,candidateCount:candidates.length,claimCount:planned.length,rejectedCount:rejected.length});return output;
}
module.exports=Object.freeze({SCHEMA_VERSION,PLANNER_VERSION,MAX_CLAIMS,queryHash,plan,unavailable,isAuthenticPlan});
