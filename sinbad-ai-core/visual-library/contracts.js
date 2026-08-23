'use strict';

const VISUAL_SCHEMA='sinbad-visual-evidence/1';
const LICENCE_STATUSES=Object.freeze(['APPROVED','REVIEW_REQUIRED','REJECTED']);
const MEDIA_TYPES=Object.freeze(['image/jpeg','image/png','image/webp','image/svg+xml']);
const REQUIRED=Object.freeze([
  'schemaVersion','visualId','topics','aliases','caption','altText','mediaType',
  'sourcePageUrl','assetUrl','authority','creator','creditLine','licenceName',
  'licenceUrl','licenceStatus','retrievedAt','sha256','linkedSourceIds'
]);

class VisualContractError extends Error{
  constructor(message){super(message);this.name='VisualContractError';this.code='VISUAL_CONTRACT_INVALID';}
}
function fail(message){throw new VisualContractError(message);}
function plain(value){return Boolean(value&&typeof value==='object'&&!Array.isArray(value));}
function exact(value){if(!plain(value))fail('visual evidence must be an object');const allowed=new Set(REQUIRED);for(const key of REQUIRED)if(!(key in value))fail(`missing field: ${key}`);for(const key of Object.keys(value))if(!allowed.has(key))fail(`unknown field: ${key}`);}
function text(value,field,{nullable=false}={}){if(nullable&&value===null)return null;if(typeof value!=='string'||!value.trim())fail(`${field} must be a non-empty string`);if(value!==value.normalize('NFC')||value.includes('\r')||/[\u0000-\u001F\u007F]/u.test(value))fail(`${field} must be canonical NFC text`);return value;}
function list(value,field){if(!Array.isArray(value)||!value.length)fail(`${field} must be a non-empty array`);const out=[...new Set(value.map(item=>text(item,field).toLocaleLowerCase('en-US')))];return Object.freeze(out.sort());}
function httpsUrl(value,field){const parsed=new URL(text(value,field));if(parsed.protocol!=='https:')fail(`${field} must use HTTPS`);return parsed.href;}
function sha256(value){if(!/^[a-f0-9]{64}$/u.test(String(value)))fail('sha256 must be lowercase hexadecimal');return value;}
function visualEvidence(value){
  exact(value);
  if(value.schemaVersion!==VISUAL_SCHEMA)fail('unsupported visual schema');
  if(!/^vis:[a-f0-9]{64}$/u.test(String(value.visualId)))fail('visualId is invalid');
  if(!MEDIA_TYPES.includes(value.mediaType))fail('unsupported mediaType');
  if(!LICENCE_STATUSES.includes(value.licenceStatus))fail('unsupported licenceStatus');
  return Object.freeze({
    schemaVersion:VISUAL_SCHEMA,visualId:value.visualId,topics:list(value.topics,'topics'),aliases:list(value.aliases,'aliases'),
    caption:text(value.caption,'caption'),altText:text(value.altText,'altText'),mediaType:value.mediaType,
    sourcePageUrl:httpsUrl(value.sourcePageUrl,'sourcePageUrl'),assetUrl:httpsUrl(value.assetUrl,'assetUrl'),
    authority:text(value.authority,'authority'),creator:text(value.creator,'creator',{nullable:true}),creditLine:text(value.creditLine,'creditLine'),
    licenceName:text(value.licenceName,'licenceName'),licenceUrl:httpsUrl(value.licenceUrl,'licenceUrl'),licenceStatus:value.licenceStatus,
    retrievedAt:text(value.retrievedAt,'retrievedAt'),sha256:sha256(value.sha256),linkedSourceIds:list(value.linkedSourceIds,'linkedSourceIds')
  });
}
function displayEligible(value){const checked=visualEvidence(value);return checked.licenceStatus==='APPROVED';}

module.exports=Object.freeze({VISUAL_SCHEMA,LICENCE_STATUSES,MEDIA_TYPES,REQUIRED,VisualContractError,visualEvidence,displayEligible});
