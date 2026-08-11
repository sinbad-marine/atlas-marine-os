'use strict';

const crypto=require('node:crypto');

const STATES=Object.freeze({
  LIBRARY_ROOT_INVALID:'LIBRARY_ROOT_INVALID',ROOT_ESCAPE_BLOCKED:'ROOT_ESCAPE_BLOCKED',REPARSE_POINT_REJECTED:'REPARSE_POINT_REJECTED',
  UNSUPPORTED_FORMAT:'UNSUPPORTED_FORMAT',FILE_TOO_LARGE:'FILE_TOO_LARGE',CORPUS_LIMIT_EXCEEDED:'CORPUS_LIMIT_EXCEEDED',MALFORMED_TEXT:'MALFORMED_TEXT',
  MANIFEST_INVALID:'MANIFEST_INVALID',TRUST_POLICY_INVALID:'TRUST_POLICY_INVALID',UNKNOWN_ISSUER:'UNKNOWN_ISSUER',AUTHORITY_NOT_GRANTED:'AUTHORITY_NOT_GRANTED',
  LICENSE_REJECTED:'LICENSE_REJECTED',HASH_MISMATCH:'HASH_MISMATCH',DUPLICATE_ID_CONFLICT:'DUPLICATE_ID_CONFLICT',EDITION_REVOKED:'EDITION_REVOKED',
  EDITION_STALE:'EDITION_STALE',INDEX_SCHEMA_MISMATCH:'INDEX_SCHEMA_MISMATCH',INDEX_INTEGRITY_FAILURE:'INDEX_INTEGRITY_FAILURE',INDEX_PARTIAL:'INDEX_PARTIAL',
  INDEX_ACTIVATION_FAILED:'INDEX_ACTIVATION_FAILED',INDEX_UNAVAILABLE:'INDEX_UNAVAILABLE',INVALID_FILTER:'INVALID_FILTER',PROVENANCE_INCOMPLETE:'PROVENANCE_INCOMPLETE'
});
const VERSIONS=Object.freeze({manifest:'sinbad-library-manifest/1',policy:'sinbad-trust-policy/1',index:'sinbad-library-index/1',chunker:'sinbad-chunker/1'});
const LIMITS=Object.freeze({maxFileBytes:2*1024*1024,maxCorpusBytes:32*1024*1024,maxFiles:1000,maxDepth:8,maxChunkChars:2000,targetChunkChars:1500,overlapChars:150});
const FILTERS=Object.freeze({sourceId:'string',documentId:'string',editionId:'string',issuerId:'string',language:'string',category:'string',jurisdiction:'string',effectiveAt:'string',currentEditionOnly:'boolean',historical:'boolean'});

class Phase2DError extends Error{constructor(code,message,details={}){super(message||code);this.name='Phase2DError';this.code=code;this.details=Object.freeze({...details});}}
function fail(code,message,details){throw new Phase2DError(code,message,details);}
function plain(value){return value&&typeof value==='object'&&!Array.isArray(value);}
function exactKeys(value,required,optional=[],code=STATES.MANIFEST_INVALID){
  if(!plain(value))fail(code,'object required');
  for(const key of required)if(!(key in value))fail(code,`missing field: ${key}`);
  const allowed=new Set([...required,...optional]);for(const key of Object.keys(value))if(!allowed.has(key))fail(code,`unknown field: ${key}`);
}
function nonempty(value,field,code){if(typeof value!=='string'||!value.trim())fail(code,`${field} must be a non-empty string`);return value;}
function validateManifest(value){
  exactKeys(value,['schemaVersion','documents'],['manifestId'],STATES.MANIFEST_INVALID);
  if(value.schemaVersion!==VERSIONS.manifest)fail(STATES.MANIFEST_INVALID,'unsupported manifest schema');
  if(!Array.isArray(value.documents))fail(STATES.MANIFEST_INVALID,'documents must be an array');
  const documents=value.documents.map((doc,i)=>{
    exactKeys(doc,['path','issuerId','publicationKey','logicalDocumentKey','editionLabel','effectiveDate','expiresAt','language','category','jurisdiction','expectedRawHash','expectedCanonicalHash'],[],STATES.MANIFEST_INVALID);
    for(const key of Object.keys(doc))nonempty(doc[key],`documents[${i}].${key}`,STATES.MANIFEST_INVALID);
    return Object.freeze({...doc});
  });
  return Object.freeze({schemaVersion:value.schemaVersion,manifestId:value.manifestId||`manifest:${crypto.createHash('sha256').update(JSON.stringify(documents)).digest('hex')}`,documents:Object.freeze(documents)});
}
function validatePolicy(value){
  exactKeys(value,['schemaVersion','policyId','issuers'],[],STATES.TRUST_POLICY_INVALID);
  if(value.schemaVersion!==VERSIONS.policy)fail(STATES.TRUST_POLICY_INVALID,'unsupported policy schema');
  nonempty(value.policyId,'policyId',STATES.TRUST_POLICY_INVALID);
  if(!Array.isArray(value.issuers))fail(STATES.TRUST_POLICY_INVALID,'issuers must be an array');
  const issuers=value.issuers.map((issuer,i)=>{
    exactKeys(issuer,['issuerId','sources'],[],STATES.TRUST_POLICY_INVALID);nonempty(issuer.issuerId,`issuers[${i}].issuerId`,STATES.TRUST_POLICY_INVALID);
    if(!Array.isArray(issuer.sources))fail(STATES.TRUST_POLICY_INVALID,'sources must be an array');
    const sources=issuer.sources.map(source=>{exactKeys(source,['sourceId','documentId','editionId','canonicalHash','authority','license','status'],['expiresAt','licenseExpiresAt'],STATES.TRUST_POLICY_INVALID);return Object.freeze({...source});});
    return Object.freeze({issuerId:issuer.issuerId,sources:Object.freeze(sources)});
  });
  return Object.freeze({schemaVersion:value.schemaVersion,policyId:value.policyId,issuers:Object.freeze(issuers)});
}
function validateFilters(filters={}){if(!plain(filters))fail(STATES.INVALID_FILTER,'filters must be an object');const out={};for(const [key,value] of Object.entries(filters)){if(!FILTERS[key]||typeof value!==FILTERS[key])fail(STATES.INVALID_FILTER,`invalid filter: ${key}`,{filter:key});if(typeof value==='string'&&!value.trim())fail(STATES.INVALID_FILTER,`empty filter: ${key}`,{filter:key});out[key]=value;}return Object.freeze(out);}
module.exports=Object.freeze({STATES,VERSIONS,LIMITS,FILTERS,Phase2DError,fail,validateManifest,validatePolicy,validateFilters});
