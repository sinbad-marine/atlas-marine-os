/* Read identity, task, boundary, connection and evidence time from an Engine Room record.
   Classification is not a health measurement. Aborted probes and UNKNOWN stay unverified or unreachable.
   A different measurement time and snapshot time is not, by itself, a conflict.
   This file does not call a model, Bridge, or a provider. */
(function(root){
  'use strict';
  const OBSERVED=['RUNNING','IDLE','OFFLINE','DEGRADED','FAULT'];
  function evidenceClock(evidenceTime,options){
    const opts=options||{};
    const evidenceMs=Date.parse(evidenceTime||'');
    const nowMs=Number.isFinite(opts.nowMs)?opts.nowMs:Date.parse(opts.now||'');
    return {evidenceMs,nowMs};
  }
  function measurementClock(engine,snapshot,options){
    const direct=typeof engine?.evidenceTime==='string'?engine.evidenceTime.trim():'';
    const separated=Boolean(snapshot&&(snapshot.compiledAt||snapshot.receivedAt));
    let evidenceTime=null;
    let freshnessLimit=null;
    if(direct)evidenceTime=direct;
    else if(separated)freshnessLimit='SOURCE_MEASUREMENT_TIME_ABSENT';
    else if(typeof snapshot?.observedAt==='string'&&snapshot.observedAt.trim())evidenceTime=snapshot.observedAt;
    const clock=evidenceClock(evidenceTime,options);
    if(evidenceTime&&!Number.isFinite(clock.evidenceMs))freshnessLimit='SOURCE_MEASUREMENT_TIME_INVALID';
    else if(Number.isFinite(clock.evidenceMs)&&Number.isFinite(clock.nowMs)&&clock.evidenceMs>clock.nowMs)freshnessLimit='SOURCE_MEASUREMENT_TIME_FUTURE';
    return {evidenceTime,freshnessLimit,...clock};
  }
  function readEngineRoomComponent(engine,snapshot,options){
    const opts=options||{};
    const measured=measurementClock(engine,snapshot,opts);
    const evidenceTime=measured.evidenceTime;
    const freshnessLimit=measured.freshnessLimit||null;
    const identity=engine?.id&&engine?.title?{id:String(engine.id),title:String(engine.title)}:null;
    const task=typeof engine?.task==='string'&&engine.task.trim()?engine.task.trim():null;
    const boundary=Array.isArray(engine?.notConnected)?engine.notConnected.slice():null;
    const connection=Array.isArray(engine?.sources)?engine.sources.map(item=>String(item)):[];
    const state=String(engine?.state||'');
    const {evidenceMs,nowMs}=measured;
    const maxAgeMs=Number.isFinite(opts.maxAgeMs)?opts.maxAgeMs:15*60*1000;
    const simulated=engine?.simulated===true||snapshot?.simulated===true||engine?.session==='simulated';
    const ownAbort=engine?.probeAborted===true||connection.some(item=>item==='aborted-probe');
    const snapshotAbort=snapshot?.probeAborted===true&&engine?.taskSource!=='source-record';
    const aborted=ownAbort||snapshotAbort;
    const conflictFact=(engine?.facts||[]).some(fact=>fact&&String(fact.label||'').toLowerCase()==='conflict'&&String(fact.value||'').trim()&&!/^(false|none|no)$/i.test(String(fact.value).trim()));
    const observedFact=(engine?.facts||[]).find(fact=>fact&&String(fact.label||'').toLowerCase()==='observed state');
    const observedValue=observedFact?String(observedFact.value||''):'';
    const stateConflict=OBSERVED.includes(state)&&OBSERVED.includes(observedValue)&&observedValue!==state;
    const conflicting=engine?.conflicting===true||snapshot?.conflicting===true||conflictFact||stateConflict;
    const freshnessKnown=Number.isFinite(evidenceMs)&&Number.isFinite(nowMs);
    const future=freshnessKnown&&evidenceMs>nowMs;
    const old=freshnessKnown&&!future&&nowMs-evidenceMs>maxAgeMs;
    const unreachable=aborted||state==='UNAVAILABLE'||connection.length===0;
    let recordClass='unverified';
    let freshness='invalid';
    if(!freshnessKnown)freshness='invalid';
    else if(future)freshness='future';
    else if(old)freshness='old';
    else freshness='within-window';
    if(simulated)recordClass='simulated';
    else if(conflicting)recordClass='conflicting';
    else if(unreachable)recordClass='unreachable';
    else if(!freshnessKnown||future)recordClass='unverified';
    else if(old)recordClass='old';
    else if(state==='UNKNOWN'||!identity||!boundary)recordClass='unverified';
    else if(OBSERVED.includes(state))recordClass='current';
    return {
      identity,
      task,
      taskSource:task?(engine.taskSource||'record'):null,
      boundary,
      connection,
      evidenceTime:evidenceTime||null,
      freshnessLimit,
      state,
      recordClass,
      freshness,
      health:'NOT_A_HEALTH_MEASUREMENT',
      liveHealth:false
    };
  }
  function annotateEngineRoomSnapshot(snapshot,options){
    if(!snapshot||!Array.isArray(snapshot.engines))return snapshot;
    snapshot.components=snapshot.engines.map(engine=>readEngineRoomComponent(engine,snapshot,options));
    snapshot.health='NOT_A_HEALTH_MEASUREMENT';
    return snapshot;
  }
  function composeEngineRoomSnapshot(snapshot,extraEngines,options){
    if(!snapshot||!Array.isArray(snapshot.engines))return snapshot;
    for(const engine of extraEngines||[]){
      if(engine&&engine.id&&!snapshot.engines.some(item=>item&&item.id===engine.id))snapshot.engines.push(engine);
    }
    return annotateEngineRoomSnapshot(snapshot,options);
  }
  root.SinbadEngineRoomRecord={read:readEngineRoomComponent,annotate:annotateEngineRoomSnapshot,compose:composeEngineRoomSnapshot};
})(typeof globalThis!=='undefined'?globalThis:this);
