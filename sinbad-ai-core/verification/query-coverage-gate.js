'use strict';
const planner=require('./claim-planner.js');

const SCHEMA_VERSION='sinbad-query-claim-coverage/2G-v1';
const GATE_VERSION='sinbad-deterministic-query-coverage-gate/2G-v1';
const MIN_COVERAGE_RATIO=0.8;
const STOP_WORDS=new Set([
  'a','an','and','are','as','at','be','by','for','from','how','in','is','it','of','on','or','that','the','this','to','was','what','when','where','which','who','why','with',
  'acaba','ama','bir','bu','da','de','icin','ile','ise','mi','mı','mu','mü','nasıl','nedir','neden','ne','olan','olarak','ve','veya'
]);
const authenticResults=new WeakSet();

function fold(value){return String(value||'').normalize('NFC').toLocaleLowerCase('tr-TR').normalize('NFD').replace(/\p{M}/gu,'');}
function tokens(value){return [...new Set(fold(value).match(/[\p{L}\p{N}]{2,}/gu)||[])].filter(token=>!STOP_WORDS.has(token));}
function result(value){const output=Object.freeze(value);authenticResults.add(output);return output;}
function isAuthenticResult(value){return Boolean(value&&authenticResults.has(value));}
function isBoundResult(value,input={}){return isAuthenticResult(value)&&value.transactionId===String(input.transactionId||'')&&value.queryHash===planner.queryHash(input.query);}
function audit(target,event,outcome,details={}){if(target&&typeof target.append==='function')target.append('query-coverage','deterministic-query-coverage-gate',outcome,event,Object.freeze({gateVersion:GATE_VERSION,schemaVersion:SCHEMA_VERSION,...details}));}
function evaluate(input={},context={}){
  const transactionId=String(input.transactionId||''),queryHash=planner.queryHash(input.query);
  const plan=input.claimPlan;
  const validPlan=planner.isAuthenticPlan(plan)&&plan.transactionId===transactionId&&plan.queryHash===queryHash&&plan.status==='CLAIMS_PLANNED';
  const queryTokens=tokens(input.query);
  const claimTokens=new Set(validPlan?plan.claims.flatMap(claim=>tokens(claim.statement)):[]);
  const coveredTokens=queryTokens.filter(token=>claimTokens.has(token));
  const uncoveredTokens=queryTokens.filter(token=>!claimTokens.has(token));
  const ratio=queryTokens.length?coveredTokens.length/queryTokens.length:0;
  const sufficient=validPlan&&queryTokens.length>0&&ratio>=MIN_COVERAGE_RATIO;
  const status=sufficient?'COVERAGE_SUFFICIENT':'COVERAGE_INSUFFICIENT';
  const reasonCode=!validPlan?'INVALID_OR_UNBOUND_PLAN':!queryTokens.length?'EMPTY_QUERY_CONCEPTS':'QUERY_CONCEPTS_UNSUPPORTED';
  const output=result({schemaVersion:SCHEMA_VERSION,gateVersion:GATE_VERSION,transactionId,queryHash,status,reasonCode:sufficient?null:reasonCode,coveredTokens:Object.freeze(coveredTokens),uncoveredTokens:Object.freeze(uncoveredTokens),metrics:Object.freeze({queryTokenCount:queryTokens.length,coveredTokenCount:coveredTokens.length,coverageRatio:ratio,minimumCoverageRatio:MIN_COVERAGE_RATIO})});
  audit(context.audit,sufficient?'QUERY_COVERAGE_PASSED':'QUERY_COVERAGE_STOPPED',sufficient?'passed':'stopped',{transactionId,status,reasonCode:output.reasonCode,queryTokenCount:queryTokens.length,coveredTokenCount:coveredTokens.length,coverageRatio:ratio});
  return output;
}
function isBoundSufficient(value,input={}){return isBoundResult(value,input)&&value.status==='COVERAGE_SUFFICIENT';}
module.exports=Object.freeze({SCHEMA_VERSION,GATE_VERSION,MIN_COVERAGE_RATIO,tokens,evaluate,isAuthenticResult,isBoundResult,isBoundSufficient});
