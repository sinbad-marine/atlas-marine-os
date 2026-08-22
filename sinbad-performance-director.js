(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.SinbadPerformanceDirector=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const PERFORMANCES=Object.freeze({
    'board-teaching':Object.freeze([
      Object.freeze({at:0,gesture:'point-board',gaze:'board'}),
      Object.freeze({at:1500,gesture:'explain',gaze:'audience'}),
      Object.freeze({at:3000,gesture:'point-board',gaze:'board'}),
      Object.freeze({at:4500,gesture:'nod',gaze:'audience'})
    ])
  });
  const CUE_SEQUENCES=Object.freeze({
    speaking:Object.freeze([
      Object.freeze({gesture:'explain',gaze:'audience'}),
      Object.freeze({gesture:'open-hand',gaze:'audience'}),
      Object.freeze({gesture:'explain',gaze:'audience'}),
      Object.freeze({gesture:'nod',gaze:'audience'})
    ])
  });
  function cueAt(name,index){
    if(!Object.hasOwn(CUE_SEQUENCES,name))return Object.freeze({accepted:false,reason:'UNKNOWN_CUE_SEQUENCE'});
    if(!Number.isSafeInteger(index)||index<0)return Object.freeze({accepted:false,reason:'INVALID_CUE_INDEX'});
    return Object.freeze({accepted:true,cue:CUE_SEQUENCES[name][index%CUE_SEQUENCES[name].length]});
  }
  function createPerformanceDirector(options={}){
    const schedule=options.setTimeout||setTimeout,cancelSchedule=options.clearTimeout||clearTimeout;
    let generation=0,timers=[];
    const cancel=()=>{generation++;timers.forEach(cancelSchedule);timers=[];};
    const play=(name,emit,{reducedMotion=false}={})=>{
      cancel();
      if(!Object.hasOwn(PERFORMANCES,name))return Object.freeze({accepted:false,reason:'UNKNOWN_PERFORMANCE'});
      if(typeof emit!=='function')return Object.freeze({accepted:false,reason:'INVALID_EMITTER'});
      const cues=reducedMotion?PERFORMANCES[name].slice(0,1):PERFORMANCES[name],run=generation;
      cues.forEach(cue=>{const deliver=()=>{if(run===generation)emit(cue);};if(cue.at===0)deliver();else timers.push(schedule(deliver,cue.at));});
      return Object.freeze({accepted:true,cueCount:cues.length,duration:cues.at(-1).at});
    };
    return Object.freeze({play,cancel});
  }
  return Object.freeze({PERFORMANCES,CUE_SEQUENCES,cueAt,createPerformanceDirector});
});
