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
    const startsNewSentence=/[.!?]/u.test(preceding)&&/\S/u.test(text[charIndex]||'');
    const isSentence=name==='sentence'||(/[.!?]/u.test(preceding)&&!startsNewSentence),isPause=/[,;:]/u.test(preceding);
    const semanticIndex=Math.max(0,Math.min(text.length-1,(isSentence||isPause)&&!startsNewSentence?charIndex-1:charIndex));
    const sentenceStart=Math.max(text.lastIndexOf('.',semanticIndex-1),text.lastIndexOf('!',semanticIndex-1),text.lastIndexOf('?',semanticIndex-1))+1;
    const following=[text.indexOf('.',semanticIndex),text.indexOf('!',semanticIndex),text.indexOf('?',semanticIndex)].filter(index=>index>=0);
    const sentenceEnd=following.length?Math.min(...following)+1:text.length;
    const sentence=text.slice(sentenceStart,sentenceEnd).trim()||text.trim();
    const semantic=responseCueForText(sentence,safeMode).cue||{gesture:'hold',gaze:'audience',emotion:'concerned',responseKind:'blocked'};
    let cue;
    if(safeMode==='caution'&&(isSentence||isPause))cue={gesture:isSentence?'nod':'hold',gaze:'audience',emotion:isSentence?'attentive':'concerned',cadence:isSentence?'sentence-end':'pause'};
    else if(isSentence&&preceding==='?')cue={gesture:'open-hand',gaze:'audience',emotion:'curious',cadence:'question'};
    else if(isSentence)cue={gesture:'nod',gaze:'audience',emotion:semantic.emotion,cadence:'sentence-end'};
    else if(isPause)cue={gesture:'hold',gaze:'thought',emotion:semantic.responseKind==='caution'?'concerned':safeMode==='instructional'?'confident':'attentive',cadence:'pause'};
    else if(charIndex===0||startsNewSentence)cue={gesture:semantic.gesture,gaze:semantic.gaze,emotion:semantic.emotion,cadence:'opening',responseKind:semantic.responseKind};
    else{
      const sequence=safeMode==='caution'?'speaking-caution':safeMode==='instructional'?'speaking-instructional':'speaking';
      cue={...cueAt(sequence,wordIndex).cue,emotion:semantic.emotion,cadence:'word',responseKind:semantic.responseKind};
    }
    return Object.freeze({accepted:true,cue:Object.freeze(cue)});
  }
  const LISTENING_ACTIVITY_CUES=Object.freeze({
    ready:Object.freeze({gesture:'listen-lean',gaze:'audience',emotion:'attentive',energy:.24}),
    sound:Object.freeze({gesture:'listen-orient',gaze:'audience',emotion:'attentive',energy:.34}),
    speech:Object.freeze({gesture:'listen-follow',gaze:'audience',emotion:'attentive',energy:.46}),
    pause:Object.freeze({gesture:'hold',gaze:'thought',emotion:'attentive',energy:.28}),
    processed:Object.freeze({gesture:'nod',gaze:'audience',emotion:'warm',energy:.36})
  });
  function listeningCueForActivity(activity,revision=0){
    if(!Object.hasOwn(LISTENING_ACTIVITY_CUES,activity)&&activity!=='interim')return Object.freeze({accepted:false,reason:'UNKNOWN_LISTENING_ACTIVITY'});
    if(!Number.isSafeInteger(revision)||revision<0)return Object.freeze({accepted:false,reason:'INVALID_LISTENING_REVISION'});
    const cue=activity==='interim'
      ?Object.freeze({gesture:revision%3===2?'hold':'listen-follow',gaze:'audience',emotion:'attentive',energy:revision%3===2?.38:.52})
      :LISTENING_ACTIVITY_CUES[activity];
    return Object.freeze({accepted:true,cue});
  }
  const THINKING_STAGE_CUES=Object.freeze({
    analyzing:Object.freeze({gesture:'hold',gaze:'thought',emotion:'curious',energy:.32}),
    calculating:Object.freeze({gesture:'explain',gaze:'board',emotion:'confident',energy:.46}),
    retrieving:Object.freeze({gesture:'open-hand',gaze:'thought',emotion:'attentive',energy:.38}),
    composing:Object.freeze({gesture:'nod',gaze:'audience',emotion:'warm',energy:.3})
  });
  function thinkingCueForStage(stage){
    if(!Object.hasOwn(THINKING_STAGE_CUES,stage))return Object.freeze({accepted:false,reason:'UNKNOWN_THINKING_STAGE'});
    return Object.freeze({accepted:true,cue:THINKING_STAGE_CUES[stage]});
  }
  function responseCueForText(text,mode='warm'){
    if(typeof text!=='string'||!text.trim())return Object.freeze({accepted:false,reason:'INVALID_RESPONSE_TEXT'});
    const safeMode=['warm','instructional','caution'].includes(mode)?mode:'warm';
    const normalized=text.toLocaleLowerCase('tr-TR');
    const caution=safeMode==='caution'||/(uyarı|dikkat|tehlike|acil|mayday|warning|caution|danger|emergency|kritik|critical)/iu.test(normalized);
    const question=/\?/u.test(text);
    const completed=/(başarıyla (?:tamamlandı|oluşturuldu|kaydedildi)|(?:işlem|plan|rota) tamamlandı|completed successfully|successfully (?:created|saved)|is now ready)/iu.test(normalized);
    let cue;
    if(caution)cue={gesture:'hold',gaze:'audience',emotion:'concerned',energy:.34,responseKind:'caution'};
    else if(question)cue={gesture:'open-hand',gaze:'audience',emotion:'curious',energy:.42,responseKind:'question'};
    else if(completed)cue={gesture:'nod',gaze:'audience',emotion:'confident',energy:.4,responseKind:'completion'};
    else if(safeMode==='instructional'||text.length>=120)cue={gesture:'explain',gaze:'audience',emotion:'confident',energy:.44,responseKind:'explanation'};
    else cue={gesture:'open-hand',gaze:'audience',emotion:'warm',energy:.36,responseKind:'conversation'};
    return Object.freeze({accepted:true,cue:Object.freeze(cue)});
  }
  function textPresentationCues(text,mode='warm'){
    if(typeof text!=='string'||!text.trim())return Object.freeze({accepted:false,reason:'INVALID_RESPONSE_TEXT'});
    const safeMode=['warm','instructional','caution'].includes(mode)?mode:'warm';
    const sentences=(text.match(/[^.!?]+[.!?]?/gu)||[]).map(sentence=>sentence.trim()).filter(Boolean).slice(0,3);
    const cues=sentences.map((sentence,index)=>Object.freeze({at:index*550,...responseCueForText(sentence,safeMode).cue}));
    return Object.freeze({accepted:true,cues:Object.freeze(cues)});
  }
  const IMPROVISATION_POOLS=Object.freeze({
    caution:Object.freeze([
      Object.freeze({variantId:'caution-hold',gesture:'hold',gaze:'audience',emotion:'concerned',energy:.32}),
      Object.freeze({variantId:'caution-open',gesture:'open-hand',gaze:'audience',emotion:'concerned',energy:.36}),
      Object.freeze({variantId:'caution-thought',gesture:'hold',gaze:'thought',emotion:'attentive',energy:.28}),
      Object.freeze({variantId:'caution-nod',gesture:'nod',gaze:'audience',emotion:'attentive',energy:.3})
    ]),
    question:Object.freeze([
      Object.freeze({variantId:'question-open',gesture:'open-hand',gaze:'audience',emotion:'curious',energy:.42}),
      Object.freeze({variantId:'question-thought',gesture:'hold',gaze:'thought',emotion:'curious',energy:.3}),
      Object.freeze({variantId:'question-explain',gesture:'explain',gaze:'audience',emotion:'curious',energy:.38}),
      Object.freeze({variantId:'question-nod',gesture:'nod',gaze:'audience',emotion:'attentive',energy:.32})
    ]),
    completion:Object.freeze([
      Object.freeze({variantId:'completion-nod',gesture:'nod',gaze:'audience',emotion:'confident',energy:.4}),
      Object.freeze({variantId:'completion-open',gesture:'open-hand',gaze:'audience',emotion:'confident',energy:.38}),
      Object.freeze({variantId:'completion-explain',gesture:'explain',gaze:'audience',emotion:'warm',energy:.34}),
      Object.freeze({variantId:'completion-rest',gesture:'rest',gaze:'audience',emotion:'confident',energy:.28})
    ]),
    explanation:Object.freeze([
      Object.freeze({variantId:'explanation-explain',gesture:'explain',gaze:'audience',emotion:'confident',energy:.44}),
      Object.freeze({variantId:'explanation-open',gesture:'open-hand',gaze:'audience',emotion:'warm',energy:.4}),
      Object.freeze({variantId:'explanation-thought',gesture:'hold',gaze:'thought',emotion:'attentive',energy:.32}),
      Object.freeze({variantId:'explanation-nod',gesture:'nod',gaze:'audience',emotion:'confident',energy:.36})
    ]),
    conversation:Object.freeze([
      Object.freeze({variantId:'conversation-open',gesture:'open-hand',gaze:'audience',emotion:'warm',energy:.36}),
      Object.freeze({variantId:'conversation-nod',gesture:'nod',gaze:'audience',emotion:'warm',energy:.3}),
      Object.freeze({variantId:'conversation-explain',gesture:'explain',gaze:'audience',emotion:'warm',energy:.34}),
      Object.freeze({variantId:'conversation-rest',gesture:'rest',gaze:'audience',emotion:'attentive',energy:.26})
    ])
  });
  const MOTION_PROFILES=Object.freeze(['measured','lively','thoughtful','crisp','gentle','deliberate']);
  function defaultEntropy(){
    const cryptoApi=typeof globalThis!=='undefined'?globalThis.crypto:null;
    if(cryptoApi?.getRandomValues){const value=new Uint32Array(1);cryptoApi.getRandomValues(value);return value[0]/4294967296;}
    return Math.random();
  }
  function createImprovisationDirector(options={}){
    const entropy=typeof options.entropy==='function'?options.entropy:defaultEntropy;
    const histories=new Map();
    const choose=(responseKind,context='answer')=>{
      if(!Object.hasOwn(IMPROVISATION_POOLS,responseKind))return Object.freeze({accepted:false,reason:'UNKNOWN_RESPONSE_KIND'});
      const key=`${context}:${responseKind}`,pool=IMPROVISATION_POOLS[responseKind];
      const history=histories.get(key)||{last:null,remaining:[...pool],lastProfile:null,profileRemaining:[...MOTION_PROFILES]};
      if(!history.remaining.length)history.remaining=pool.length>1?pool.filter(cue=>cue.variantId!==history.last):[...pool];
      if(!history.profileRemaining.length)history.profileRemaining=MOTION_PROFILES.filter(profile=>profile!==history.lastProfile);
      const sample=Number(entropy()),profileSample=Number(entropy());
      if(!Number.isFinite(sample)||sample<0||sample>=1||!Number.isFinite(profileSample)||profileSample<0||profileSample>=1)return Object.freeze({accepted:false,reason:'INVALID_ENTROPY'});
      const index=Math.min(history.remaining.length-1,Math.floor(sample*history.remaining.length));
      const profileIndex=Math.min(history.profileRemaining.length-1,Math.floor(profileSample*history.profileRemaining.length));
      const [baseCue]=history.remaining.splice(index,1),[motionProfile]=history.profileRemaining.splice(profileIndex,1);
      const cue=Object.freeze({...baseCue,motionProfile});
      history.last=cue.variantId;history.lastProfile=motionProfile;histories.set(key,history);
      return Object.freeze({accepted:true,cue});
    };
    const reset=()=>histories.clear();
    return Object.freeze({choose,reset});
  }
  function createSpeechGestureDirector(options={}){
    const entropy=typeof options.entropy==='function'?options.entropy:defaultEntropy;
    const improvisation=createImprovisationDirector({entropy});
    let remainingWords=0;
    const select=cue=>{
      if(!cue||typeof cue!=='object'||typeof cue.cadence!=='string')return Object.freeze({accepted:false,reason:'INVALID_SPEECH_CUE'});
      const emphasized=['opening','pause','sentence-end','question'].includes(cue.cadence);
      if(!emphasized&&cue.cadence==='word'&&remainingWords>0){remainingWords--;return Object.freeze({accepted:true,change:false,cue:Object.freeze({...cue,gesture:null})});}
      if(!emphasized&&cue.cadence!=='word')return Object.freeze({accepted:true,change:false,cue:Object.freeze({...cue,gesture:null})});
      if(emphasized)remainingWords=2;
      else{
        const sample=Number(entropy());
        if(!Number.isFinite(sample)||sample<0||sample>=1)return Object.freeze({accepted:false,reason:'INVALID_ENTROPY'});
        remainingWords=2+Math.floor(sample*3);
      }
      const improvised=improvisation.choose(cue.responseKind,'speech');
      if(!improvised.accepted)return Object.freeze({accepted:false,reason:improvised.reason});
      return Object.freeze({accepted:true,change:true,cue:Object.freeze({...cue,...improvised.cue,responseKind:cue.responseKind,cadence:cue.cadence})});
    };
    const reset=()=>{remainingWords=0;improvisation.reset();};
    return Object.freeze({select,reset});
  }
  function gestureRequestForText(text){
    if(typeof text!=='string'||!text.trim())return Object.freeze({accepted:false,reason:'INVALID_REQUEST_TEXT'});
    const normalized=text.toLocaleLowerCase('tr-TR');
    if(/(sağ\s+(?:elini|kolunu|avucunu).*(?:göster|kaldır|aç)|(?:show|raise|open).*(?:your\s+)?right\s+(?:hand|arm|palm))/iu.test(normalized))return Object.freeze({accepted:true,action:'show-right-hand',supported:true,cue:Object.freeze({gesture:'show-palm',gaze:'audience',emotion:'warm',energy:.4})});
    if(/(sol\s+(?:elini|kolunu|avucunu).*(?:göster|kaldır|aç)|(?:show|raise|open).*(?:your\s+)?left\s+(?:hand|arm|palm))/iu.test(normalized))return Object.freeze({accepted:true,action:'raise-left-hand',supported:true,cue:Object.freeze({gesture:'raise-left',gaze:'audience',emotion:'attentive',energy:.38})});
    if(/(başını\s+sola\s+(?:çevir|döndür)|(?:turn|look).*(?:your\s+)?head.*left)/iu.test(normalized))return Object.freeze({accepted:true,action:'look-left',supported:true,cue:Object.freeze({gesture:'look-left',gaze:'audience',emotion:'attentive',energy:.24})});
    if(/(başını\s+sağa\s+(?:çevir|döndür)|(?:turn|look).*(?:your\s+)?head.*right)/iu.test(normalized))return Object.freeze({accepted:true,action:'look-right',supported:true,cue:Object.freeze({gesture:'look-right',gaze:'audience',emotion:'attentive',energy:.24})});
    if(/(başını\s+(?:eğ|salla)|(?:nod|bow)(?:\s+your)?\s+head)/iu.test(normalized))return Object.freeze({accepted:true,action:'nod',supported:true,cue:Object.freeze({gesture:'nod',gaze:'audience',emotion:'warm',energy:.28})});
    if(/(gülümse|tebessüm\s+et|smile)/iu.test(normalized))return Object.freeze({accepted:true,action:'smile',supported:true,cue:Object.freeze({gesture:'rest',gaze:'audience',emotion:'warm',energy:.24})});
    if(/(avuc(?:unu|unda|unun)|avuç|palm|open (?:your )?hand|show (?:me )?(?:your )?hand)/iu.test(normalized)){
      return Object.freeze({accepted:true,action:'show-palm',supported:true,cue:Object.freeze({gesture:'show-palm',gaze:'audience',emotion:'warm',energy:.4})});
    }
    if(/(tahta(?:yı|ya|da)?|yazı tahtası|board|blackboard)/iu.test(normalized)){
      return Object.freeze({accepted:true,action:'point-board',supported:true,cue:Object.freeze({gesture:'point-board',gaze:'board',emotion:'confident',energy:.42})});
    }
    if(/(beni dinliyor musun|dinlediğini göster|are you listening|show .*listening)/iu.test(normalized)){
      return Object.freeze({accepted:true,action:'show-listening',supported:true,cue:Object.freeze({gesture:'listen-lean',gaze:'audience',emotion:'attentive',energy:.38})});
    }
    return Object.freeze({accepted:false,reason:'NO_GESTURE_REQUEST'});
  }
  function gazeTransitionForCue(cue,{reducedMotion=false}={}){
    if(!cue||typeof cue!=='object')return Object.freeze({accepted:false,reason:'INVALID_GAZE_CUE'});
    const target=['audience','thought','board','path','palm','left-palm'].includes(cue.gaze)?cue.gaze:'audience';
    let cues;
    if(reducedMotion)cues=[Object.freeze({at:0,gaze:target})];
    else if(cue.gesture==='show-palm')cues=[Object.freeze({at:0,gaze:'palm'}),Object.freeze({at:520,gaze:'audience'})];
    else if(cue.gesture==='raise-left')cues=[Object.freeze({at:0,gaze:'left-palm'}),Object.freeze({at:520,gaze:'audience'})];
    else if(cue.gesture==='point-board')cues=[Object.freeze({at:0,gaze:'board'}),Object.freeze({at:900,gaze:'audience'}),Object.freeze({at:1600,gaze:'board'})];
    else cues=[Object.freeze({at:0,gaze:target})];
    return Object.freeze({accepted:true,cues:Object.freeze(cues),duration:cues.at(-1).at});
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
  return Object.freeze({PERFORMANCES,CUE_SEQUENCES,LISTENING_ACTIVITY_CUES,THINKING_STAGE_CUES,IMPROVISATION_POOLS,MOTION_PROFILES,cueAt,speechModeForDecision,speechCueForBoundary,listeningCueForActivity,thinkingCueForStage,responseCueForText,textPresentationCues,gestureRequestForText,gazeTransitionForCue,createImprovisationDirector,createSpeechGestureDirector,createPerformanceDirector});
});
