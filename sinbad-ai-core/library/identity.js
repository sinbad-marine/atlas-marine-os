'use strict';
const crypto=require('node:crypto');
function canonical(value){if(value===null||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;}
function sha256(value){return crypto.createHash('sha256').update(value).digest('hex');}
function id(prefix,value){return `${prefix}:${sha256(canonical(value))}`;}
function source(input){return id('src',{issuerId:input.issuerId,publicationKey:input.publicationKey});}
function document(input){return id('doc',{sourceId:input.sourceId,logicalDocumentKey:input.logicalDocumentKey});}
function edition(input){return id('ed',{documentId:input.documentId,editionLabel:input.editionLabel,effectiveDate:input.effectiveDate,canonicalHash:input.canonicalHash});}
function chunk(input){return id('chk',{editionId:input.editionId,chunkerVersion:input.chunkerVersion,ordinal:input.ordinal,startOffset:input.startOffset,endOffset:input.endOffset,contentHash:input.contentHash});}
function index(input){return id('idx',input);}
module.exports=Object.freeze({canonical,sha256,id,source,document,edition,chunk,index});
