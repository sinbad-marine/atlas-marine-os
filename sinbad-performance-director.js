(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.SinbadPerformanceDirector=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const PERFORMANCES=Object.freeze({
    'lesson-opening':Object.freeze([
      Object.freeze({at:0,state:'walking',gesture:'walk',gaze:'path',walkFrame:0}),
      Object.freeze({at:280,state:'walking',gesture:'walk',gaze:'path',walkFrame:1}),
      Object.freeze({at:560,state:'walking',gesture:'walk',gaze:'path',walkFrame:0}),
      Object.freeze({at:840,state:'walking',gesture:'walk',gaze:'path',walkFrame:1}),
      Object.freeze({at:1120,state:'walking',gesture:'walk',gaze:'path',walkFrame:0}),
      Object.freeze({at:1400,state:'walking',gesture:'walk',gaze:'board',walkFrame:1}),
      Object.freeze({at:1680,state:'board-teaching',gesture:'point-board',gaze:'board'}),
      Object.freeze({at:3180,state:'board-teaching',gesture:'explain',gaze:'audience'})
    ]),
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
    ]),
    'speaking-instructional':Object.freeze([
      Object.freeze({gesture:'explain',gaze:'audience',emotion:'confident'}),
      Object.freeze({gesture:'open-hand',gaze:'audience',emotion:'confident'}),
      Object.freeze({gesture:'explain',gaze:'audience',emotion:'warm'}),
      Object.freeze({gesture:'nod',gaze:'audience',emotion:'confident'})
    ]),
    'speaking-caution':Object.freeze([
      Object.freeze({gesture:'hold',gaze:'audience',emotion:'concerned'}),
      Object.freeze({gesture:'open-hand',gaze:'audience',emotion:'concerned'}),
      Object.freeze({gesture:'hold',gaze:'audience',emotion:'concerned'}),
      Object.freeze({gesture:'nod',gaze:'audience',emotion:'attentive'})
    ]),
    listening:Object.freeze([
      Object.freeze({gesture:'listen-lean',gaze:'audience',emotion:'attentive',energy:.28}),
      Object.freeze({gesture:'listen-lean',gaze:'audience',emotion:'attentive',energy:.46}),
      Object.freeze({gesture:'hold',gaze:'audience',emotion:'attentive',energy:.62}),
      Object.freeze({gesture:'nod',gaze:'audience',emotion:'warm',energy:.34})
    ])
  });
  function cueAt(name,index){
    if(!Object.hasOwn(CUE_SEQUENCES,name))return Object.freeze({accepted:false,reason:'UNKNOWN_CUE_SEQUENCE'});
    if(!Number.isSafeInteger(index)||index<0)return Object.freeze({accepted:false,reason:'INVALID_CUE_INDEX'});
    return Object.freeze({accepted:true,cue:CUE_SEQUENCES[name][index%CUE_SEQUENCES[name].length]});
  }
  function speechModeForDecision(decision={}){
    if(!decision||typeof decision!=='object'||Array.isArray(decision))return 'warm';
    if(decision.emergency===true||decision.requiresHumanApproval===true||['high','critical'].includes(decision.risk))return 'caution';
    if(['navigation','passage','publication','document','crew','weather'].includes(decision.intent))return 'instructional';
    return 'warm';
  }
  function speechCueForBoundary(input={}){
    if(!input||typeof input!=='object'||Array.isArray(input))return Object.freeze({accepted:false,reason:'INVALID_BOUNDARY'});
    const {text,name,charIndex,wordIndex,mode='warm'}=input;
    if(typeof text!=='string'||!Number.isSafeInteger(charIndex)||charIndex<0||charIndex>text.length||!Number.isSafeInteger(wordIndex)||wordIndex<0)return Object.freeze({accepted:false,reason:'INVALID_BOUNDARY'});
    const safeMode=['warm','instructional','caution'].includes(mode)?mode:'warm';
    const preceding=text.slice(0,charIndex).trimEnd().at(-1)||'';
    const isSentence=name==='sentence'||/[.!?]/u.test(preceding),isPause=/[,;:]/u.test(preceding);
    let cue;
    if(safeMode==='caution'&&(isSentence||isPause))cue={gesture:isSentence?'nod':'hold',gaze:'audience',emotion:isSentence?'attentive':'concerned',cadence:isSentence?'sentence-end':'pause'};
    else if(isSentence&&preceding==='?')cue={gesture:'open-hand',gaze:'audience',emotion:'curious',cadence:'question'};
    else if(isSentence)cue={gesture:'nod',gaze:'audience',emotion:safeMode==='instructional'?'confident':'warm',cadence:'sentence-end'};
    else if(isPause)cue={gesture:'hold',gaze:'thought',emotion:safeMode==='instructional'?'confident':'attentive',cadence:'pause'};
    else if(charIndex===0)cue={gesture:'open-hand',gaze:'audience',emotion:safeMode==='instructional'?'confident':'warm',cadence:'opening'};
    else{
      const sequence=safeMode==='caution'?'speaking-caution':safeMode==='instructional'?'speaking-instructional':'speaking';
      cue={...cueAt(sequence,wordIndex).cue,cadence:'word'};
    }
    return Object.freeze({accepted:true,cue:Object.freeze(cue)});
  }
  const LISTENING_ACTIVITY_CUES=Object.freeze({
    ready:Object.freeze({gesture:'listen-lean',gaze:'audience',emotion:'attentive',energy:.24}),
    sound:Object.freeze({gesture:'open-hand',gaze:'audience',emotion:'attentive',energy:.34}),
    speech:Object.freeze({gesture:'listen-lean',gaze:'audience',emotion:'attentive',energy:.46}),
    pause:Object.freeze({gesture:'hold',gaze:'thought',emotion:'attentive',energy:.28}),
    processed:Object.freeze({gesture:'nod',gaze:'audience',emotion:'warm',energy:.36})
  });
  function listeningCueForActivity(activity,revision=0){
    if(!Object.hasOwn(LISTENING_ACTIVITY_CUES,activity)&&activity!=='interim')return Object.freeze({accepted:false,reason:'UNKNOWN_LISTENING_ACTIVITY'});
    if(!Number.isSafeInteger(revision)||revision<0)return Object.freeze({accepted:false,reason:'INVALID_LISTENING_REVISION'});
    const cue=activity==='interim'
      ?Object.freeze({gesture:revision%3===2?'hold':'listen-lean',gaze:'audience',emotion:'attentive',energy:revision%3===2?.38:.52})
      :LISTENING_ACTIVITY_CUES[activity];
    return Object.freeze({accepted:true,cue});
  }
  function createPerformanceDirector(options={}){
    const schedule=options.setTimeout||setTimeout,cancelSchedule=options.clearTimeout||clearTimeout;
    let generation=0,timers=[];
    const cancel=()=>{generation++;timers.forEach(cancelSchedule);timers=[];};
    const play=(name,emit,{reducedMotion=false}={})=>{
      cancel();
      if(!Object.hasOwn(PERFORMANCES,name))return Object.freeze({accepted:false,reason:'UNKNOWN_PERFORMANCE'});
      if(typeof emit!=='function')return Object.freeze({accepted:false,reason:'INVALID_EMITTER'});
      const performance=PERFORMANCES[name];
      const cues=reducedMotion?(name==='lesson-opening'?[Object.freeze({...performance.find(cue=>cue.state!=='walking'),at:0})]:performance.slice(0,1)):performance,run=generation;
      cues.forEach(cue=>{const deliver=()=>{if(run===generation)emit(cue);};if(cue.at===0)deliver();else timers.push(schedule(deliver,cue.at));});
      return Object.freeze({accepted:true,cueCount:cues.length,duration:cues.at(-1).at});
    };
    return Object.freeze({play,cancel});
  }
  return Object.freeze({PERFORMANCES,CUE_SEQUENCES,LISTENING_ACTIVITY_CUES,cueAt,speechModeForDecision,speechCueForBoundary,listeningCueForActivity,createPerformanceDirector});
});
