'use strict';
const crypto=require('node:crypto');

const CLAIM_SCHEMA='sinbad-claim/2E-v1';
const FACT_SCHEMA='sinbad-structured-fact/2E-v1';
const RESULT_SCHEMA='sinbad-claim-verification/2E-v1';
const VERIFIER_VERSION='sinbad-claim-support-verifier/2E-v1';
const MAX_CLAIM_STATEMENT_LENGTH=1024;
const CLAIM_TYPES=Object.freeze(['FACT','INFERENCE','SPECULATION']);
const STATUSES=Object.freeze(['CLAIM_SUPPORTED','CLAIM_UNSUPPORTED','CLAIM_CONTRADICTED','CLAIM_SCOPE_MISMATCH','CLAIM_AUTHORITY_INSUFFICIENT','CLAIM_UNVERIFIABLE','CLAIM_INVALID']);
const VALUE_TYPES=Object.freeze(['STRING','BOOLEAN','INTEGER','DECIMAL','DATE','ISO_TIMESTAMP','ENUM']);
const POLARITIES=Object.freeze(['POSITIVE','NEGATIVE']);
const MODALITIES=Object.freeze(['ASSERTED','MAY','MUST','PERMITTED','PROHIBITED']);
const UNITS=Object.freeze(['NONE','KNOT','KILOMETRE_PER_HOUR','GROSS_TONNAGE','NAUTICAL_MILE','METRE','DEGREE','SECOND','MINUTE','HOUR']);
const PREDICATES=Object.freeze(['SPEED_LIMIT','PERMISSION_STATE','OBLIGATION_STATE','EDITION_EFFECTIVE_DATE','APPLIES_TO_VESSEL_CLASS']);
const OPERATORS=Object.freeze(['EQ','LT','LTE','GT','GTE']);
const SELF_APPROVAL=new Set(['supported','verified','authoritative','trusted','citationEligible','verificationStatus','verifierResult']);

class ClaimValidationError extends Error{constructor(message){super(message);this.name='ClaimValidationError';this.code='CLAIM_INVALID';}}
function fail(message){throw new ClaimValidationError(message);}
function canonical(value){if(value===null||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;}
function sha256(value){return crypto.createHash('sha256').update(value).digest('hex');}
function plain(value){return Boolean(value&&typeof value==='object'&&!Array.isArray(value));}
function exact(value,required,optional=[]){if(!plain(value))fail('object required');for(const key of required)if(!(key in value))fail(`missing field: ${key}`);const allowed=new Set([...required,...optional]);for(const key of Object.keys(value)){if(SELF_APPROVAL.has(key))fail(`self-approval field forbidden: ${key}`);if(!allowed.has(key))fail(`unknown field: ${key}`);}}
function nfcString(value,field,{nullable=false,max=256}={}){if(nullable&&value===null)return null;if(typeof value!=='string'||!value.length)fail(`${field} must be a non-empty string`);if(value!==value.normalize('NFC'))fail(`${field} must already be NFC`);if(value.includes('\r')||/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(value))fail(`${field} contains forbidden control characters`);if(value.length>max)fail(`${field} exceeds length limit`);return value;}
function enumValue(value,allowed,field,{nullable=false}={}){if(nullable&&value===null)return null;if(!allowed.includes(value))fail(`unknown ${field}: ${value}`);return value;}
function canonicalScalar(value,type,field='value'){
  switch(type){
    case 'STRING':return nfcString(value,field,{max:1024});
    case 'BOOLEAN':if(typeof value!=='boolean')fail(`${field} must be boolean`);return value;
    case 'INTEGER':if(typeof value!=='string'||!/(?:0|-?[1-9]\d*)/u.test(value))fail(`${field} must be a canonical integer string`);return value;
    case 'DECIMAL':if(typeof value!=='string'||!/(?:0|-?[1-9]\d*)(?:\.\d*[1-9])?/u.test(value)||value.includes('e')||value.includes('E'))fail(`${field} must be a canonical decimal string`);return value;
    case 'DATE':if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/u.test(value)||!Number.isFinite(Date.parse(`${value}T00:00:00Z`)))fail(`${field} must be YYYY-MM-DD`);return value;
    case 'ISO_TIMESTAMP':if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(value)||!Number.isFinite(Date.parse(value)))fail(`${field} must be a UTC ISO timestamp`);return value;
    case 'ENUM':return nfcString(value,field,{max:128});
    default:fail(`unknown valueType: ${type}`);
  }
}
function qualifier(value){exact(value,['key','operator','value','valueType','unit']);const valueType=enumValue(value.valueType,VALUE_TYPES,'valueType');return Object.freeze({key:nfcString(value.key,'qualifier.key',{max:64}),operator:enumValue(value.operator,OPERATORS,'operator'),value:canonicalScalar(value.value,valueType,'qualifier.value'),valueType,unit:enumValue(value.unit,UNITS,'unit')});}
function factPayload(value){
  exact(value,['schemaVersion','subject','predicate','value','valueType','unit','polarity','modality','effectiveAt','jurisdiction','qualifiers']);
  if(value.schemaVersion!==FACT_SCHEMA)fail('unsupported structured fact schema');
  const valueType=enumValue(value.valueType,VALUE_TYPES,'valueType');const modality=enumValue(value.modality,MODALITIES,'modality');const polarity=enumValue(value.polarity,POLARITIES,'polarity');
  if(modality==='PERMITTED'&&polarity==='NEGATIVE')fail('ambiguous PERMITTED + NEGATIVE representation');
  const qualifiers=(Array.isArray(value.qualifiers)?value.qualifiers:fail('qualifiers must be an array')).map(qualifier).sort((a,b)=>canonical(a)<canonical(b)?-1:canonical(a)>canonical(b)?1:0);
  return Object.freeze({schemaVersion:FACT_SCHEMA,subject:nfcString(value.subject,'subject',{max:128}),predicate:enumValue(value.predicate,PREDICATES,'predicate'),value:canonicalScalar(value.value,valueType),valueType,unit:enumValue(value.unit,UNITS,'unit'),polarity,modality,effectiveAt:value.effectiveAt===null?null:canonicalScalar(value.effectiveAt,/T/u.test(String(value.effectiveAt))?'ISO_TIMESTAMP':'DATE','effectiveAt'),jurisdiction:nfcString(value.jurisdiction,'jurisdiction',{nullable:true,max:64}),qualifiers:Object.freeze(qualifiers)});
}
function factHash(fact){const {factId:ignoredId,factHash:ignoredHash,...payload}=fact||{};return sha256(Buffer.from(canonical(factPayload(payload)),'utf8'));}
function structuredStatement(fact){return canonical(factPayload(fact));}
function factId({evidenceId,factOrdinal,factHash:hash}){if(typeof evidenceId!=='string'||!evidenceId)fail('evidenceId required');if(!Number.isInteger(factOrdinal)||factOrdinal<0)fail('factOrdinal invalid');if(!/^[a-f0-9]{64}$/u.test(String(hash)))fail('factHash invalid');return `fact:${sha256(Buffer.from(canonical({schemaVersion:FACT_SCHEMA,evidenceId,factOrdinal,factHash:hash}),'utf8'))}`;}
function structuredFact(value,{evidenceId,factOrdinal}){exact(value,['schemaVersion','factId','factHash','subject','predicate','value','valueType','unit','polarity','modality','effectiveAt','jurisdiction','qualifiers']);const {factId:providedId,factHash:providedHash,...payload}=value;const fact=factPayload(payload);const hash=factHash(fact);if(providedHash!==hash)fail('factHash mismatch');const id=factId({evidenceId,factOrdinal,factHash:hash});if(providedId!==id)fail('factId mismatch');return Object.freeze({...fact,factId:id,factHash:hash});}
function support(value){if(!plain(value))fail('support must be an object');if(value.mode==='EXACT_SPAN'){exact(value,['mode','evidenceId','startOffset','endOffset','spanHash','offsetEncoding']);return Object.freeze({mode:'EXACT_SPAN',evidenceId:nfcString(value.evidenceId,'evidenceId',{max:256}),startOffset:value.startOffset,endOffset:value.endOffset,spanHash:String(value.spanHash),offsetEncoding:String(value.offsetEncoding)});}if(value.mode==='STRUCTURED_FACT'){exact(value,['mode','evidenceId','factOrdinal','factHash','fact']);return Object.freeze({mode:'STRUCTURED_FACT',evidenceId:nfcString(value.evidenceId,'evidenceId',{max:256}),factOrdinal:value.factOrdinal,factHash:String(value.factHash),fact:factPayload(value.fact)});}exact(value,['mode','evidenceId']);return Object.freeze({mode:nfcString(value.mode,'support.mode',{max:64}),evidenceId:nfcString(value.evidenceId,'evidenceId',{max:256})});}
function identityPayload(value){return Object.freeze({schemaVersion:value.schemaVersion,claimType:value.claimType,statement:value.statement,support:value.support,requiresAuthoritative:value.requiresAuthoritative});}
function deriveClaimId(value){const payload=identityPayload({...value,support:support(value.support)});return `clm:${sha256(Buffer.from(canonical(payload),'utf8'))}`;}
function claim(value){exact(value,['schemaVersion','claimId','claimType','statement','support','requiresAuthoritative']);if(value.schemaVersion!==CLAIM_SCHEMA)fail('unsupported claim schema');const claimType=enumValue(value.claimType,CLAIM_TYPES,'claimType');const statement=nfcString(value.statement,'statement',{max:MAX_CLAIM_STATEMENT_LENGTH});if(typeof value.requiresAuthoritative!=='boolean')fail('requiresAuthoritative must be boolean');const checkedSupport=support(value.support);if(claimType==='FACT'&&checkedSupport.mode==='STRUCTURED_FACT'&&statement!==structuredStatement(checkedSupport.fact))fail('structured fact statement must equal its canonical fact representation');const normalized=Object.freeze({schemaVersion:CLAIM_SCHEMA,claimId:String(value.claimId),claimType,statement,support:checkedSupport,requiresAuthoritative:value.requiresAuthoritative});const expected=deriveClaimId(normalized);if(normalized.claimId!==expected)fail('claimId mismatch');return normalized;}
function verificationResult(value){return Object.freeze({schemaVersion:RESULT_SCHEMA,verifierVersion:VERIFIER_VERSION,claimId:String(value.claimId||''),claimType:String(value.claimType||''),status:STATUSES.includes(value.status)?value.status:'CLAIM_INVALID',reasonCode:String(value.reasonCode||''),supportMode:value.supportMode==null?null:String(value.supportMode),evidenceId:value.evidenceId==null?null:String(value.evidenceId),factId:value.factId==null?null:String(value.factId),spanIdentity:value.spanIdentity==null?null:String(value.spanIdentity),citationEligible:value.status==='CLAIM_SUPPORTED'&&Boolean(value.citationEligible),authoritySatisfied:Boolean(value.authoritySatisfied),provenance:Object.freeze({...((value.provenance&&typeof value.provenance==='object')?value.provenance:{})})});}
module.exports=Object.freeze({CLAIM_SCHEMA,FACT_SCHEMA,RESULT_SCHEMA,VERIFIER_VERSION,MAX_CLAIM_STATEMENT_LENGTH,CLAIM_TYPES,STATUSES,VALUE_TYPES,POLARITIES,MODALITIES,UNITS,PREDICATES,OPERATORS,ClaimValidationError,canonical,sha256,factPayload,factHash,structuredStatement,factId,structuredFact,deriveClaimId,claim,verificationResult});
