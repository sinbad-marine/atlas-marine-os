'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
require('../engine-room-component-record.js');
const {present,copy}=globalThis.SinbadEngineRoomRecord;
const nowMs=Date.parse('2026-10-13T06:00:00Z');
const base={id:'controlled',title:'Controlled fixture',state:'UNKNOWN',sources:['fixture/status'],facts:[],notConnected:['execution'],task:'Read-only fixture'};
const snapshot={compiledAt:'2026-10-13T06:00:00Z',observedAt:'2026-10-13T06:00:00Z'};
const show=(changes={},lang='tr-TR')=>present({...base,...changes},snapshot,lang,{nowMs});
test('missing measurement never inherits the local compilation time or a health verdict',()=>{
 for(const state of ['UNKNOWN','RUNNING','OFFLINE','FAULT','DEGRADED']){
  const view=show({state});assert.equal(view.kind,'unknown');assert.equal(view.tone,'neutral');assert.equal(view.time,'Ölçüm zamanı bildirilmedi');assert.equal(view.record.liveHealth,false);
 }
 assert.equal(show({state:'UNAVAILABLE'}).label,'Veri alınamadı');assert.equal(show({state:'UNAVAILABLE'}).tone,'neutral');
});
test('source evidence distinguishes historical records from current reported faults',()=>{
 const recent={evidenceTime:'2026-10-13T05:59:00Z',state:'FAULT'};
 assert.equal(show(recent).kind,'fault');assert.equal(show(recent).tone,'fault');assert.equal(show(recent).record.liveHealth,false);
 assert.equal(show({...recent,evidenceTime:'2026-10-10T10:22:00Z'}).kind,'old');
 assert.equal(show({...recent,evidenceTime:'2026-10-14T10:22:00Z'}).kind,'unknown');
 assert.equal(show({...recent,evidenceTime:'bad time'}).time,'Kaynak zamanı doğrulanamadı');
 assert.equal(show({...recent,simulated:true}).kind,'simulated');
 assert.equal(show({...recent,conflicting:true}).kind,'conflicting');
 const groq=show({taskSource:'source-record',evidenceTime:'2026-10-10T10:22:00Z'});
 assert.equal(groq.kind,'old');assert.match(groq.time,/Kaynak kaydının okunma zamanı/);assert.doesNotMatch(groq.time,/ölçüm zamanı/);
});
test('all supported languages cover access, evidence and refresh without raw status labels',()=>{
 const englishKeys=Object.keys(copy('en-US')).sort();
 for(const locale of ['en-US','tr-TR','ru-RU','de-DE','ar-SA','es-ES','fr-FR']){
  assert.deepEqual(Object.keys(copy(locale)).sort(),englishKeys);
  for(const value of Object.values(copy(locale)))assert.ok(value.length>0);
  for(const state of ['UNKNOWN','UNAVAILABLE','FAULT'])assert.doesNotMatch(show({state},locale).label,/UNKNOWN|UNAVAILABLE|FAULT/);
 }
});
