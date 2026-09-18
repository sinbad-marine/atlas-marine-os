'use strict';
// Shared exact-snapshot helpers for the inert Project 2 authority contracts.
// Inputs are admitted only as plain objects whose own data properties are exactly the schema
// fields; accessors, inherited fields, symbols, extras and coercive values are rejected.
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const HASH=/^[a-f0-9]{64}$/u;
const REF=/^[A-Za-z0-9][A-Za-z0-9._:/@+-]{0,511}$/u;
const LANGUAGE=/^[a-z]{2}(?:-[A-Z]{2})?$/u;

function own(fields,input){
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.getPrototypeOf(input)!==Object.prototype)return null;
  try{
    const names=Object.getOwnPropertyNames(input);
    if(Object.getOwnPropertySymbols(input).length||names.length!==fields.length||!fields.every(field=>names.includes(field)))return null;
    const out=Object.create(null);
    for(const field of fields){const descriptor=Object.getOwnPropertyDescriptor(input,field);if(!descriptor||!Object.hasOwn(descriptor,'value'))return null;out[field]=descriptor.value;}
    return out;
  }catch{return null;}
}
const id=value=>typeof value==='string'&&ID.test(value);
const hash=value=>typeof value==='string'&&HASH.test(value);
const ref=value=>typeof value==='string'&&REF.test(value);
const nullableHash=value=>value===null||hash(value);
const time=value=>Number.isSafeInteger(value)&&value>=0;
const bool=value=>value===true||value===false;
const language=value=>typeof value==='string'&&LANGUAGE.test(value);
const oneOf=(values,value)=>typeof value==='string'&&values.includes(value);
function idList(value,max=64){return Array.isArray(value)&&value.length<=max&&value.every(id)&&new Set(value).size===value.length;}
function freezeDeep(value){if(Array.isArray(value)){for(const item of value)freezeDeep(item);return Object.freeze(value);}if(value&&typeof value==='object'){for(const key of Object.keys(value))freezeDeep(value[key]);return Object.freeze(value);}return value;}
function plain(record){const out={};for(const key of Object.keys(record))out[key]=record[key];return out;}
module.exports=Object.freeze({ID,HASH,REF,own,id,hash,ref,nullableHash,time,bool,language,oneOf,idList,freezeDeep,plain});
