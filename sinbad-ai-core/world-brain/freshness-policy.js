'use strict';

const VERSION='sinbad-knowledge-freshness/1';
const MAX_AGE_DAYS=Object.freeze({stable:3650,mixed:365,fast:30,live:1});
const STATES=Object.freeze({CURRENT:'CURRENT',STALE:'STALE',UNDATED:'UNDATED',LIVE_REQUIRED:'LIVE_REQUIRED'});

function parseDate(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value))return null;
  const date=new Date(value);return Number.isFinite(date.getTime())?date:null;
}

function evaluate(input={}){
  const freshness=Object.prototype.hasOwnProperty.call(MAX_AGE_DAYS,input.freshness)?input.freshness:'mixed';
  const now=parseDate(input.now)||new Date();
  const snapshot=parseDate(input.snapshotDate);
  if(!snapshot)return Object.freeze({version:VERSION,status:STATES.UNDATED,freshness,usable:false,reason:'SNAPSHOT_DATE_REQUIRED'});
  const ageDays=Math.max(0,Math.floor((now-snapshot)/86400000));
  if(freshness==='live'&&ageDays>MAX_AGE_DAYS.live)return Object.freeze({version:VERSION,status:STATES.LIVE_REQUIRED,freshness,ageDays,usable:false,reason:'CURRENT_SOURCE_REQUIRED'});
  const stale=ageDays>MAX_AGE_DAYS[freshness];
  return Object.freeze({version:VERSION,status:stale?STATES.STALE:STATES.CURRENT,freshness,ageDays,usable:!stale,reason:stale?'SNAPSHOT_EXPIRED':'SNAPSHOT_ACCEPTED'});
}

function disclosure(result){
  if(!result||result.status===STATES.UNDATED)return 'Bu çevrimdışı bilginin tarihi doğrulanamadı.';
  if(result.status===STATES.LIVE_REQUIRED)return `Bu konu güncel kaynak gerektiriyor; çevrimdışı kopya ${result.ageDays} günlük.`;
  if(result.status===STATES.STALE)return `Bu çevrimdışı bilgi ${result.ageDays} günlük ve güncellenmelidir.`;
  return `Çevrimdışı kaynak yaşı: ${result.ageDays} gün.`;
}

module.exports=Object.freeze({VERSION,MAX_AGE_DAYS,STATES,evaluate,disclosure});
