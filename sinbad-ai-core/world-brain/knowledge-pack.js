'use strict';

const crypto=require('node:crypto');
const taxonomy=require('./knowledge-taxonomy.js');
const freshness=require('./freshness-policy.js');

const VERSION='sinbad-knowledge-pack/1';
const LICENSES=Object.freeze(['CC0-1.0','CC-BY-4.0','CC-BY-SA-4.0','PDM-1.0','OWNER-PROVIDED','LICENSED']);
const REQUIRED=Object.freeze(['schemaVersion','packId','title','domain','language','license','source','publisher','edition','snapshotDate','contentHash']);

class KnowledgePackError extends Error{
  constructor(code,message){super(message||code);this.name='KnowledgePackError';this.code=code;}
}
function fail(code,message){throw new KnowledgePackError(code,message);}
function text(value,field,max=512){if(typeof value!=='string'||!value.trim())fail('PACK_INVALID',`${field} is required`);if(value.length>max)fail('PACK_INVALID',`${field} is too long`);return value.trim();}
function validate(input={}){
  if(!input||typeof input!=='object'||Array.isArray(input))fail('PACK_INVALID','pack object required');
  for(const key of REQUIRED)if(!(key in input))fail('PACK_INVALID',`missing field: ${key}`);
  for(const key of Object.keys(input))if(!REQUIRED.includes(key)&&key!=='description'&&key!=='tags')fail('PACK_INVALID',`unknown field: ${key}`);
  if(input.schemaVersion!==VERSION)fail('PACK_INVALID','unsupported schema version');
  const domain=taxonomy.getDomain(input.domain);if(!domain)fail('PACK_INVALID','unknown knowledge domain');
  if(!LICENSES.includes(input.license))fail('LICENSE_REJECTED','license is not allowlisted');
  if(!/^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(input.language))fail('PACK_INVALID','invalid language tag');
  if(!/^[a-f0-9]{64}$/.test(input.contentHash))fail('PACK_INVALID','contentHash must be SHA-256');
  const tags=Array.isArray(input.tags)?input.tags.map(tag=>text(tag,'tag',64)):[];
  const pack=Object.freeze({
    schemaVersion:VERSION,packId:text(input.packId,'packId',128),title:text(input.title,'title'),domain:domain.id,
    language:input.language,license:input.license,source:text(input.source,'source',2048),publisher:text(input.publisher,'publisher'),
    edition:text(input.edition,'edition',128),snapshotDate:text(input.snapshotDate,'snapshotDate',64),contentHash:input.contentHash,
    description:input.description==null?'':text(input.description,'description',2000),tags:Object.freeze(tags)
  });
  const state=freshness.evaluate({freshness:domain.freshness,snapshotDate:pack.snapshotDate});
  return Object.freeze({pack,freshness:state,installable:state.status!==freshness.STATES.UNDATED});
}
function contentHash(bytes){return crypto.createHash('sha256').update(bytes).digest('hex');}

module.exports=Object.freeze({VERSION,LICENSES,REQUIRED,KnowledgePackError,validate,contentHash});
