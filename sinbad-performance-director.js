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
  function speechTransitionForKinds(previousKind,nextCue){
    if(typeof previousKind!=='string'||!nextCue||typeof nextCue!=='object'||typeof nextCue.responseKind!=='string')return Object.freeze({accepted:false,reason:'INVALID_SPEECH_TRANSITION'});
    if(previousKind===nextCue.responseKind)return Object.freeze({accepted:true,changed:false,targetCue:nextCue});
    if(nextCue.responseKind==='caution')return Object.freeze({accepted:true,changed:true,immediate:true,durationMs:0,targetCue:nextCue});
    const bridgeCue=Object.freeze({gesture:'hold',gaze:previousKind==='caution'?'audience':'thought',emotion:'attentive',energy:.24,responseKind:nextCue.responseKind,cadence:'transition'});
    return Object.freeze({accepted:true,changed:true,immediate:false,durationMs:180,bridgeCue,targetCue:nextCue});
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
  function listeningPauseForPace(text,durationMs){
    if(typeof text!=='string'||!text.trim())return Object.freeze({accepted:false,reason:'INVALID_SPEECH_SAMPLE'});
    if(!Number.isFinite(durationMs)||durationMs<=0)return Object.freeze({accepted:false,reason:'INVALID_SPEECH_DURATION'});
    const words=text.trim().split(/\s+/u).slice(0,80).length;
    if(words<=2)return Object.freeze({accepted:true,pace:'short-fragment',words,wpm:null,pauseMs:850});
    const wpm=Math.round(words/(Math.max(250,durationMs)/60000));
    const pace=wpm<90?'slow':wpm<150?'measured':wpm<220?'conversational':'fast';
    const pauseMs={slow:1100,measured:850,conversational:700,fast:550}[pace];
    return Object.freeze({accepted:true,pace,words,wpm,pauseMs});
  }
  function listeningCueForPace(pace){
    const cues={
      'short-fragment':Object.freeze({gesture:'listen-follow',gaze:'audience',emotion:'attentive',energy:.42}),
      slow:Object.freeze({gesture:'hold',gaze:'thought',emotion:'attentive',energy:.26}),
      measured:Object.freeze({gesture:'listen-lean',gaze:'audience',emotion:'attentive',energy:.32}),
      conversational:Object.freeze({gesture:'listen-follow',gaze:'audience',emotion:'attentive',energy:.38}),
      fast:Object.freeze({gesture:'listen-orient',gaze:'audience',emotion:'attentive',energy:.4})
    };
    if(!Object.hasOwn(cues,pace))return Object.freeze({accepted:false,reason:'UNKNOWN_SPEECH_PACE'});
    return Object.freeze({accepted:true,cue:cues[pace]});
  }
  function listeningCueForText(text,revision=0){
    if(typeof text!=='string'||!text.trim())return Object.freeze({accepted:false,reason:'INVALID_LISTENING_TEXT'});
    if(!Number.isSafeInteger(revision)||revision<0)return Object.freeze({accepted:false,reason:'INVALID_LISTENING_REVISION'});
    const normalized=text.toLocaleLowerCase('tr-TR');
    let cue,meaning;
    if(/\b(dikkat|tehlike|acil|yangın|yardım|dur|mayday|danger|emergency|fire|help|stop)\b/iu.test(normalized)){
      meaning='caution';cue={gesture:'hold',gaze:'audience',emotion:'concerned',energy:.34};
    }else if(/[?？]\s*$/u.test(normalized)||/\b(mi|mı|mu|mü|neden|niçin|nasıl|hangi|kim|ne zaman|why|how|which|who|when)\b/iu.test(normalized)){
      meaning='question';cue={gesture:'listen-follow',gaze:'audience',emotion:'curious',energy:.44};
    }else if(/\b(teşekkür|sağ ol|harika|güzel|sevindim|thanks|thank you|great|wonderful)\b/iu.test(normalized)){
      meaning='positive';cue={gesture:'nod',gaze:'audience',emotion:'warm',energy:.36};
    }else{
      const progress=listeningCueForActivity('interim',revision);
      return Object.freeze({accepted:true,meaning:'neutral',cue:progress.cue});
    }
    return Object.freeze({accepted:true,meaning,cue:Object.freeze(cue)});
  }
  const LISTENING_MEANING_POOLS=Object.freeze({
    caution:Object.freeze([
      Object.freeze({reactionId:'caution-hold',gesture:'hold',gaze:'audience',emotion:'concerned',energy:.34}),
      Object.freeze({reactionId:'caution-orient',gesture:'listen-orient',gaze:'audience',emotion:'concerned',energy:.32})
    ]),
    question:Object.freeze([
      Object.freeze({reactionId:'question-follow',gesture:'listen-follow',gaze:'audience',emotion:'curious',energy:.44}),
      Object.freeze({reactionId:'question-orient',gesture:'listen-orient',gaze:'audience',emotion:'curious',energy:.38}),
      Object.freeze({reactionId:'question-hold',gesture:'hold',gaze:'thought',emotion:'curious',energy:.32})
    ]),
    positive:Object.freeze([
      Object.freeze({reactionId:'positive-nod',gesture:'nod',gaze:'audience',emotion:'warm',energy:.36}),
      Object.freeze({reactionId:'positive-follow',gesture:'listen-follow',gaze:'audience',emotion:'warm',energy:.34})
    ])
  });
  function createListeningReactionDirector(options={}){
    const entropy=typeof options.entropy==='function'?options.entropy:defaultEntropy;
    const remaining=new Map(),last=new Map();
    const select=(text,revision=0)=>{
      const semantic=listeningCueForText(text,revision);
      if(!semantic.accepted||semantic.meaning==='neutral')return semantic;
      const pool=LISTENING_MEANING_POOLS[semantic.meaning];
      let choices=remaining.get(semantic.meaning)||[];
      if(!choices.length)choices=pool.length>1?pool.filter(item=>item.reactionId!==last.get(semantic.meaning)):[...pool];
      const sample=Number(entropy());
      if(!Number.isFinite(sample)||sample<0||sample>=1)return Object.freeze({accepted:false,reason:'INVALID_ENTROPY'});
      const index=Math.min(choices.length-1,Math.floor(sample*choices.length));
      const [reaction]=choices.splice(index,1);remaining.set(semantic.meaning,choices);last.set(semantic.meaning,reaction.reactionId);
      const {reactionId,...cue}=reaction;
      return Object.freeze({accepted:true,meaning:semantic.meaning,reactionId,cue:Object.freeze(cue)});
    };
    const reset=()=>{remaining.clear();last.clear();};
    return Object.freeze({select,reset});
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
    correction:Object.freeze([
      Object.freeze({variantId:'correction-shake',gesture:'shake-head-left',gaze:'audience',emotion:'attentive',energy:.32}),
      Object.freeze({variantId:'correction-open',gesture:'open-hand',gaze:'audience',emotion:'attentive',energy:.34}),
      Object.freeze({variantId:'correction-thought',gesture:'hold',gaze:'thought',emotion:'attentive',energy:.26}),
      Object.freeze({variantId:'correction-explain',gesture:'explain',gaze:'board',emotion:'warm',energy:.36})
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
  const IDLE_MICRO_CUES=Object.freeze([
    Object.freeze({idleMotion:'breathe',gesture:'idle-breathe',gaze:'audience',emotion:'warm',energy:.12,holdMs:1100}),
    Object.freeze({idleMotion:'look-left',gesture:'idle-look-left',gaze:'thought',emotion:'attentive',energy:.1,holdMs:950}),
    Object.freeze({idleMotion:'look-right',gesture:'idle-look-right',gaze:'thought',emotion:'attentive',energy:.1,holdMs:950})
  ]);
  function defaultEntropy(){
    const cryptoApi=typeof globalThis!=='undefined'?globalThis.crypto:null;
    if(cryptoApi?.getRandomValues){const value=new Uint32Array(1);cryptoApi.getRandomValues(value);return value[0]/4294967296;}
    return Math.random();
  }
  function createIdleBehaviorDirector(options={}){
    const entropy=typeof options.entropy==='function'?options.entropy:defaultEntropy;
    let remaining=[...IDLE_MICRO_CUES],last=null;
    const select=()=>{
      const cueSample=Number(entropy()),delaySample=Number(entropy());
      if(!Number.isFinite(cueSample)||cueSample<0||cueSample>=1||!Number.isFinite(delaySample)||delaySample<0||delaySample>=1)return Object.freeze({accepted:false,reason:'INVALID_ENTROPY'});
      if(!remaining.length)remaining=IDLE_MICRO_CUES.filter(cue=>cue.idleMotion!==last);
      const index=Math.min(remaining.length-1,Math.floor(cueSample*remaining.length));
      const [cue]=remaining.splice(index,1);last=cue.idleMotion;
      return Object.freeze({accepted:true,delayMs:6500+Math.floor(delaySample*4501),cue});
    };
    const reset=()=>{remaining=[...IDLE_MICRO_CUES];last=null;};
    return Object.freeze({select,reset});
  }
  function createImprovisationDirector(options={}){
    const entropy=typeof options.entropy==='function'?options.entropy:defaultEntropy;
    const histories=new Map();
    let lastGesture=null;
    const choose=(responseKind,context='answer')=>{
      if(!Object.hasOwn(IMPROVISATION_POOLS,responseKind))return Object.freeze({accepted:false,reason:'UNKNOWN_RESPONSE_KIND'});
      const key=`${context}:${responseKind}`,pool=IMPROVISATION_POOLS[responseKind];
      const history=histories.get(key)||{last:null,remaining:[...pool],lastProfile:null,profileRemaining:[...MOTION_PROFILES]};
      if(!history.remaining.length)history.remaining=pool.length>1?pool.filter(cue=>cue.variantId!==history.last):[...pool];
      if(!history.profileRemaining.length)history.profileRemaining=MOTION_PROFILES.filter(profile=>profile!==history.lastProfile);
      const sample=Number(entropy()),profileSample=Number(entropy());
      if(!Number.isFinite(sample)||sample<0||sample>=1||!Number.isFinite(profileSample)||profileSample<0||profileSample>=1)return Object.freeze({accepted:false,reason:'INVALID_ENTROPY'});
      const gestureChoices=history.remaining.filter(cue=>cue.gesture!==lastGesture);
      const eligible=gestureChoices.length?gestureChoices:history.remaining;
      const selectedIndex=Math.min(eligible.length-1,Math.floor(sample*eligible.length));
      const selected=eligible[selectedIndex];
      const index=history.remaining.indexOf(selected);
      const profileIndex=Math.min(history.profileRemaining.length-1,Math.floor(profileSample*history.profileRemaining.length));
      const [baseCue]=history.remaining.splice(index,1),[motionProfile]=history.profileRemaining.splice(profileIndex,1);
      const cue=Object.freeze({...baseCue,motionProfile});
      history.last=cue.variantId;history.lastProfile=motionProfile;lastGesture=cue.gesture;histories.set(key,history);
      return Object.freeze({accepted:true,cue});
    };
    const reset=()=>{histories.clear();lastGesture=null;};
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
  function gestureRequestForText(text,context={}){
    if(typeof text!=='string'||!text.trim())return Object.freeze({accepted:false,reason:'INVALID_REQUEST_TEXT'});
    const source=text.trim(),normalized=source.toLocaleLowerCase('tr-TR');
    const contextualActions={
      'show-palm':Object.freeze({gesture:'show-palm',gaze:'audience',emotion:'warm',energy:.4}),
      'show-right-hand':Object.freeze({gesture:'show-palm',gaze:'audience',emotion:'warm',energy:.4}),
      'raise-left-hand':Object.freeze({gesture:'raise-left',gaze:'audience',emotion:'attentive',energy:.38}),
      'show-both-hands':Object.freeze({gesture:'show-both-hands',gaze:'audience',emotion:'warm',energy:.44}),
      wave:Object.freeze({gesture:'wave-right',gaze:'audience',emotion:'warm',energy:.46}),
      'look-left':Object.freeze({gesture:'look-left',gaze:'audience',emotion:'attentive',energy:.24}),
      'look-right':Object.freeze({gesture:'look-right',gaze:'audience',emotion:'attentive',energy:.24}),
      'shake-head':Object.freeze({gesture:'shake-head-left',gaze:'audience',emotion:'attentive',energy:.32}),
      nod:Object.freeze({gesture:'nod',gaze:'audience',emotion:'warm',energy:.28}),
      smile:Object.freeze({gesture:'rest',gaze:'audience',emotion:'warm',energy:.24}),
      laugh:Object.freeze({gesture:'laugh',gaze:'audience',emotion:'joyful',energy:.64}),
      walk:Object.freeze({gesture:'walk',gaze:'path',emotion:'warm',energy:.62}),
      'point-board':Object.freeze({gesture:'point-board',gaze:'board',emotion:'confident',energy:.42}),
      'show-listening':Object.freeze({gesture:'listen-lean',gaze:'audience',emotion:'attentive',energy:.38})
    };
    const lastAction=typeof context?.lastAction==='string'?context.lastAction:null;
    const rightThenLeft=/(?:önce\s+)?sağ\s+(?:elini|avucunu).*(?:göster|kaldır|aç).*sonra\s+sol\s+(?:elini|avucunu).*(?:göster|kaldır|aç)|(?:first\s+)?(?:show|raise|open).*(?:right\s+(?:hand|palm)).*(?:then|next).*(?:show|raise|open).*(?:left\s+(?:hand|palm))/iu.test(normalized);
    const leftThenRight=/(?:önce\s+)?sol\s+(?:elini|avucunu).*(?:göster|kaldır|aç).*sonra\s+sağ\s+(?:elini|avucunu).*(?:göster|kaldır|aç)|(?:first\s+)?(?:show|raise|open).*(?:left\s+(?:hand|palm)).*(?:then|next).*(?:show|raise|open).*(?:right\s+(?:hand|palm))/iu.test(normalized);
    if(rightThenLeft||leftThenRight){
      const actions=rightThenLeft?['show-right-hand','raise-left-hand']:['raise-left-hand','show-right-hand'];
      return Object.freeze({accepted:true,action:'two-hand-sequence',actions:Object.freeze(actions),supported:true,compound:true,semantic:'compound-two-hand',responsePolicy:'replace',cue:contextualActions[actions[0]]});
    }
    if(/((?:iki|her\s+iki)\s+(?:elini|avucunu|kolunu).*(?:aynı\s+anda\s+)?(?:göster|kaldır|aç)|(?:show|raise|open).*(?:both|two).*(?:hands|palms|arms))/iu.test(normalized))return Object.freeze({accepted:true,action:'show-both-hands',supported:true,responsePolicy:'replace',cue:contextualActions['show-both-hands']});
    if(/(aynı\s+hareketi.*(?:tekrar|yine|yap)|(?:do|show)\s+(?:it|that)\s+again|repeat\s+(?:that|the\s+movement))/iu.test(normalized)){
      if(lastAction&&Object.hasOwn(contextualActions,lastAction))return Object.freeze({accepted:true,action:lastAction,supported:true,contextual:true,cue:contextualActions[lastAction]});
      return Object.freeze({accepted:true,action:'repeat-last-action',supported:false,contextual:true,reason:'NO_VERIFIED_GESTURE_REFERENCE'});
    }
    if(/((?:öbür|diğer)\s+(?:elini|avucunu).*(?:göster|kaldır|aç)|(?:show|raise|open).*(?:the\s+)?other\s+(?:hand|palm))/iu.test(normalized)){
      const action=lastAction==='show-right-hand'?'raise-left-hand':lastAction==='raise-left-hand'?'show-right-hand':null;
      if(action)return Object.freeze({accepted:true,action,supported:true,contextual:true,cue:contextualActions[action]});
      return Object.freeze({accepted:true,action:'show-other-hand',supported:false,contextual:true,reason:'NO_VERIFIED_GESTURE_REFERENCE'});
    }
    if(/((?:avucunda|avucunun\s+içinde|elinde).*(?:ne\s+var|bir\s+şey\s+mi\s+var)|(?:what|anything|something).*(?:in|on).*(?:your\s+)?(?:hand|palm))/iu.test(normalized))return Object.freeze({accepted:true,action:'show-palm',supported:true,semantic:'palm-object-query',responsePolicy:'replace',cue:Object.freeze({gesture:'show-palm',gaze:'palm',emotion:'attentive',energy:.4})});
    if(/(sağ\s+(?:elini|kolunu|avucunu).*(?:göster|kaldır|aç)|(?:show|raise|open).*(?:your\s+)?right\s+(?:hand|arm|palm))/iu.test(normalized))return Object.freeze({accepted:true,action:'show-right-hand',supported:true,cue:Object.freeze({gesture:'show-palm',gaze:'audience',emotion:'warm',energy:.4})});
    if(/(sol\s+(?:elini|kolunu|avucunu).*(?:göster|kaldır|aç)|(?:show|raise|open).*(?:your\s+)?left\s+(?:hand|arm|palm))/iu.test(normalized))return Object.freeze({accepted:true,action:'raise-left-hand',supported:true,cue:Object.freeze({gesture:'raise-left',gaze:'audience',emotion:'attentive',energy:.38})});
    if(/((?:bana\s+)?(?:elini|el)\s+(?:salla|sallar\s+mısın)|(?:merhaba|selam)\s+(?:deyip\s+)?el\s+salla|wave\s+(?:your\s+hand|at\s+me|hello))/iu.test(normalized))return Object.freeze({accepted:true,action:'wave',supported:true,responsePolicy:'replace',cue:Object.freeze({gesture:'wave-right',gaze:'audience',emotion:'warm',energy:.46})});
    if(/(başını\s+sola\s+(?:çevir|döndür)|(?:turn|look).*(?:your\s+)?head.*left)/iu.test(normalized))return Object.freeze({accepted:true,action:'look-left',supported:true,cue:Object.freeze({gesture:'look-left',gaze:'audience',emotion:'attentive',energy:.24})});
    if(/(başını\s+sağa\s+(?:çevir|döndür)|(?:turn|look).*(?:your\s+)?head.*right)/iu.test(normalized))return Object.freeze({accepted:true,action:'look-right',supported:true,cue:Object.freeze({gesture:'look-right',gaze:'audience',emotion:'attentive',energy:.24})});
    if(/(başını\s+(?:iki\s+yana|sağa\s+sola)\s+salla|hayır\s+(?:anlamında\s+)?başını\s+salla|shake\s+(?:your\s+)?head|head\s+shake)/iu.test(normalized))return Object.freeze({accepted:true,action:'shake-head',supported:true,responsePolicy:'replace',cue:Object.freeze({gesture:'shake-head-left',gaze:'audience',emotion:'attentive',energy:.32})});
    if(/(başını\s+(?:eğ|salla)|(?:nod|bow)(?:\s+your)?\s+head)/iu.test(normalized))return Object.freeze({accepted:true,action:'nod',supported:true,cue:Object.freeze({gesture:'nod',gaze:'audience',emotion:'warm',energy:.28})});
    if(/(gülümse|tebessüm\s+et|smile)/iu.test(normalized))return Object.freeze({accepted:true,action:'smile',supported:true,cue:Object.freeze({gesture:'rest',gaze:'audience',emotion:'warm',energy:.24})});
    if(/(kahkaha\s+at|biraz\s+gül|gülsene|(?:^|\s)gül(?:er\s+misin|\s+lütfen)?(?:[.!?]|$)|laugh|chuckle)/iu.test(normalized))return Object.freeze({accepted:true,action:'laugh',supported:true,responsePolicy:'replace',cue:Object.freeze({gesture:'laugh',gaze:'audience',emotion:'joyful',energy:.64})});
    if(/(avuc(?:unu|unda|unun)|avuç|palm|open (?:your )?hand|show (?:me )?(?:your )?hand)/iu.test(normalized)){
      return Object.freeze({accepted:true,action:'show-palm',supported:true,cue:Object.freeze({gesture:'show-palm',gaze:'audience',emotion:'warm',energy:.4})});
    }
    const turkishBoardText=source.match(/tahta(?:ya|da)\s+(.{1,200}?)\s+yaz(?:ar\s+mısın)?[.!? ]*$/iu)?.[1]?.trim();
    const englishBoardText=source.match(/write\s+(.{1,200}?)\s+(?:on|onto)\s+(?:the\s+)?(?:board|blackboard)[.!? ]*$/iu)?.[1]?.trim();
    const boardText=turkishBoardText||englishBoardText;
    if(boardText)return Object.freeze({accepted:true,action:'write-board',supported:true,directAcademyBoard:true,responsePolicy:'replace',boardText,cue:Object.freeze({gesture:'point-board',gaze:'board',emotion:'confident',energy:.42})});
    if(/(?:tahta(?:ya|da)\s+(?:bir\s+)?daire\s+çiz|draw\s+(?:a\s+)?circle\s+(?:on|onto)\s+(?:the\s+)?(?:board|blackboard))/iu.test(normalized))return Object.freeze({accepted:true,action:'draw-board-shape',supported:true,directAcademyBoard:true,responsePolicy:'replace',boardShape:'circle',cue:Object.freeze({gesture:'point-board',gaze:'board',emotion:'confident',energy:.44})});
    if(/(?:tahta(?:ya|da)\s+(?:bir\s+)?üçgen\s+çiz|draw\s+(?:a\s+)?triangle\s+(?:on|onto)\s+(?:the\s+)?(?:board|blackboard))/iu.test(normalized))return Object.freeze({accepted:true,action:'draw-board-shape',supported:true,directAcademyBoard:true,responsePolicy:'replace',boardShape:'triangle',cue:Object.freeze({gesture:'point-board',gaze:'board',emotion:'confident',energy:.44})});
    if(/(?:tahta(?:ya|da)\s+(?:bir\s+)?(?:dikdörtgen|kare)\s+çiz|draw\s+(?:a\s+)?(?:rectangle|square)\s+(?:on|onto)\s+(?:the\s+)?(?:board|blackboard))/iu.test(normalized))return Object.freeze({accepted:true,action:'draw-board-shape',supported:true,directAcademyBoard:true,responsePolicy:'replace',boardShape:'rectangle',cue:Object.freeze({gesture:'point-board',gaze:'board',emotion:'confident',energy:.44})});
    if(/(?:tahta(?:ya|da)\s+(?:bir\s+)?ok\s+çiz|draw\s+(?:an?\s+)?arrow\s+(?:on|onto)\s+(?:the\s+)?(?:board|blackboard))/iu.test(normalized))return Object.freeze({accepted:true,action:'draw-board-shape',supported:true,directAcademyBoard:true,responsePolicy:'replace',boardShape:'arrow',cue:Object.freeze({gesture:'point-board',gaze:'board',emotion:'confident',energy:.44})});
    if(/(?:tahta(?:ya|da)\s+(?:(?:bir\s+)?koordinat\s+)?eksen(?:leri)?\s+çiz|draw\s+(?:the\s+)?(?:coordinate\s+)?axes\s+(?:on|onto)\s+(?:the\s+)?(?:board|blackboard))/iu.test(normalized))return Object.freeze({accepted:true,action:'draw-board-shape',supported:true,directAcademyBoard:true,responsePolicy:'replace',boardShape:'axes',cue:Object.freeze({gesture:'point-board',gaze:'board',emotion:'confident',energy:.44})});
    if(/(tahta(?:ya|da|yı)?.*(?:yaz|çiz)|(?:write|draw).*(?:board|blackboard))/iu.test(normalized)){
      return Object.freeze({accepted:true,action:'write-board',supported:false,reason:'GESTURE_NOT_IMPLEMENTED'});
    }
    if(/(tahta(?:yı|ya|da)?|yazı tahtası|board|blackboard)/iu.test(normalized)){
      return Object.freeze({accepted:true,action:'point-board',supported:true,cue:Object.freeze({gesture:'point-board',gaze:'board',emotion:'confident',energy:.42})});
    }
    if(/(beni dinliyor musun|dinlediğini göster|are you listening|show .*listening)/iu.test(normalized)){
      return Object.freeze({accepted:true,action:'show-listening',supported:true,cue:Object.freeze({gesture:'listen-lean',gaze:'audience',emotion:'attentive',energy:.38})});
    }
    if(/(?:^|\s)(?:yürü|biraz\s+yürü|walk|take\s+a\s+walk)(?:[.!?]|$)/iu.test(normalized))return Object.freeze({accepted:true,action:'walk',supported:true,responsePolicy:'replace',directCharacterReaction:true,cue:Object.freeze({gesture:'walk',gaze:'path',emotion:'warm',energy:.62})});
    if(/(koş|zıpla|dans et|run|jump|dance)/iu.test(normalized)){
      return Object.freeze({accepted:true,action:'unsupported-body-action',supported:false,reason:'GESTURE_NOT_IMPLEMENTED'});
    }
    return Object.freeze({accepted:false,reason:'NO_GESTURE_REQUEST'});
  }
  function gestureAcknowledgementForRequest(request,language='tr-TR'){
    if(!request||typeof request!=='object'||request.accepted!==true)return Object.freeze({accepted:false,reason:'INVALID_GESTURE_REQUEST'});
    const turkish=String(language).toLocaleLowerCase('en-US').startsWith('tr');
    if(request.supported!==true){
      return Object.freeze({accepted:true,supported:false,action:request.action||'unknown',text:turkish?'Bu hareketi henüz güvenilir biçimde yapamıyorum.':'I cannot perform that movement reliably yet.'});
    }
    if(request.semantic==='palm-object-query')return Object.freeze({accepted:true,supported:true,action:'show-palm',text:turkish?'Avucumu açıp gösteriyorum; mevcut karakter görünümünde avucumda bir nesne gösterilmiyor.':'I am opening my palm; the current character view shows no object in it.'});
    if(request.semantic==='compound-two-hand'&&Array.isArray(request.actions)&&request.actions.length===2){
      const rightFirst=request.actions[0]==='show-right-hand';
      return Object.freeze({accepted:true,supported:true,action:'two-hand-sequence',text:turkish?(rightFirst?'Önce sağ avucumu, ardından sol elimi gösteriyorum.':'Önce sol elimi, ardından sağ avucumu gösteriyorum.'):(rightFirst?'First I am showing my right palm, then my left hand.':'First I am showing my left hand, then my right palm.')});
    }
    if(request.directAcademyBoard&&request.action==='write-board')return Object.freeze({accepted:true,supported:true,action:'write-board',text:turkish?`Academy tahtasına “${request.boardText}” yazıyorum.`:`I am writing “${request.boardText}” on the Academy board.`});
    if(request.directAcademyBoard&&request.action==='draw-board-shape'){
      const names=turkish?{circle:'daire',triangle:'üçgen',rectangle:'dikdörtgen',arrow:'ok',axes:'koordinat eksenleri'}:{circle:'circle',triangle:'triangle',rectangle:'rectangle',arrow:'arrow',axes:'coordinate axes'},name=names[request.boardShape];
      if(name)return Object.freeze({accepted:true,supported:true,action:'draw-board-shape',text:turkish?`Academy tahtasına bir ${name} çiziyorum.`:`I am drawing a ${name} on the Academy board.`});
    }
    const copy=turkish?{
      'show-palm':'Avucumu açıp gösteriyorum.',
      'show-right-hand':'Sağ avucumu açıp gösteriyorum.',
      'raise-left-hand':'Sol elimi kaldırıp gösteriyorum.',
      'show-both-hands':'İki elimi aynı anda açıp gösteriyorum.',
      wave:'Sana gülümseyerek el sallıyorum.',
      'look-left':'Başımı sola çeviriyorum.',
      'look-right':'Başımı sağa çeviriyorum.',
      'shake-head':'Başımı iki yana sallayarak hayır işareti yapıyorum.',
      nod:'Başımı eğerek yanıt veriyorum.',
      smile:'Gülümsüyorum.',
      laugh:'Kısa bir kahkahayla sana eşlik ediyorum.',
      walk:'Kısa ve kontrollü bir yürüyüş yapıyorum.',
      'point-board':'Tahtayı işaret ediyorum.',
      'show-listening':'Seni dikkatle dinliyorum.'
    }:{
      'show-palm':'I am opening my palm and showing it to you.',
      'show-right-hand':'I am opening and showing my right palm.',
      'raise-left-hand':'I am raising and showing my left hand.',
      'show-both-hands':'I am opening and showing both hands at once.',
      wave:'I am smiling and waving to you.',
      'look-left':'I am turning my head to the left.',
      'look-right':'I am turning my head to the right.',
      'shake-head':'I am shaking my head from side to side to signal no.',
      nod:'I am nodding as I respond.',
      smile:'I am smiling.',
      laugh:'I am joining you with a brief laugh.',
      walk:'I am taking a short, controlled walk.',
      'point-board':'I am pointing to the board.',
      'show-listening':'I am listening carefully.'
    };
    if(!Object.hasOwn(copy,request.action))return Object.freeze({accepted:false,reason:'UNMAPPED_GESTURE_ACTION'});
    return Object.freeze({accepted:true,supported:true,action:request.action,text:copy[request.action]});
  }
  function groundResponseWithGesture(responseText,request,language='tr-TR'){
    if(typeof responseText!=='string'||!responseText.trim())return Object.freeze({accepted:false,reason:'INVALID_RESPONSE_TEXT'});
    const acknowledgement=gestureAcknowledgementForRequest(request,language);
    if(!acknowledgement.accepted)return Object.freeze({accepted:true,grounded:false,text:responseText});
    const text=request.responsePolicy==='replace'?acknowledgement.text:`${acknowledgement.text} ${responseText}`.trim();
    return Object.freeze({accepted:true,grounded:true,supported:acknowledgement.supported,action:acknowledgement.action,text});
  }
  function gestureRecallAnswerForText(text,lastAction,language='tr-TR'){
    if(typeof text!=='string'||!text.trim())return Object.freeze({accepted:false,reason:'INVALID_RECALL_TEXT'});
    const normalized=text.toLocaleLowerCase('tr-TR');
    const asksWhichHand=/(hangi\s+(?:elini|avucunu).*(?:kaldırdın|gösterdin|açtın)|which\s+(?:hand|palm).*(?:raise|show|open))/iu.test(normalized);
    const asksLastAction=/(az önce\s+ne\s+yaptın|son\s+hareketin\s+neydi|what\s+did\s+you\s+(?:just\s+)?do|what\s+was\s+your\s+last\s+movement)/iu.test(normalized);
    if(!asksWhichHand&&!asksLastAction)return Object.freeze({accepted:false,reason:'NO_GESTURE_RECALL_REQUEST'});
    const acknowledgement=gestureAcknowledgementForRequest({accepted:true,supported:true,action:lastAction},language);
    const turkish=String(language).toLocaleLowerCase('en-US').startsWith('tr');
    if(!lastAction||!acknowledgement.accepted)return Object.freeze({accepted:true,known:false,text:turkish?'Bu oturumda doğrulanmış bir hareket kaydım henüz yok.':'I do not have a verified movement recorded in this session yet.'});
    const prefixes=turkish?{
      'show-palm':'Avucumu açıp gösterdim.',
      'show-right-hand':'Sağ avucumu açıp gösterdim.',
      'raise-left-hand':'Sol elimi kaldırıp gösterdim.',
      'show-both-hands':'İki elimi aynı anda gösterdim.',
      wave:'Sana el salladım.',
      'look-left':'Başımı sola çevirdim.',
      'look-right':'Başımı sağa çevirdim.',
      'shake-head':'Başımı iki yana salladım.',
      nod:'Başımı eğdim.',
      smile:'Gülümsedim.',
      laugh:'Kısa bir kahkaha attım.',
      walk:'Kısa bir yürüyüş yaptım.',
      'point-board':'Tahtayı işaret ettim.',
      'show-listening':'Seni dinlediğimi gösterdim.'
    }:{
      'show-palm':'I opened and showed my palm.',
      'show-right-hand':'I opened and showed my right palm.',
      'raise-left-hand':'I raised and showed my left hand.',
      'show-both-hands':'I showed both hands at once.',
      wave:'I waved to you.',
      'look-left':'I turned my head to the left.',
      'look-right':'I turned my head to the right.',
      'shake-head':'I shook my head from side to side.',
      nod:'I nodded.',
      smile:'I smiled.',
      laugh:'I gave a brief laugh.',
      walk:'I took a short walk.',
      'point-board':'I pointed to the board.',
      'show-listening':'I showed that I was listening.'
    };
    return Object.freeze({accepted:true,known:true,action:lastAction,text:prefixes[lastAction]});
  }
  function academyBoardRecallAnswerForText(text,lastBoardAction,language='tr-TR'){
    if(typeof text!=='string'||!text.trim())return Object.freeze({accepted:false,reason:'INVALID_BOARD_RECALL_TEXT'});
    const normalized=text.toLocaleLowerCase('tr-TR'),asks=/(az önce|en son).*(?:tahta(?:ya|da)|çizdin|yazdın).*(?:ne|neyi)|tahta(?:ya|da)\s+(?:en son\s+)?ne\s+(?:çizdin|yazdın)|what did you (?:just |last )?(?:draw|write) on (?:the )?board/iu.test(normalized);
    if(!asks)return Object.freeze({accepted:false,reason:'NO_BOARD_RECALL_REQUEST'});
    const turkish=String(language).toLocaleLowerCase('en-US').startsWith('tr');
    if(!lastBoardAction||!['shape','text'].includes(lastBoardAction.kind)||typeof lastBoardAction.value!=='string'||!lastBoardAction.value)return Object.freeze({accepted:true,known:false,text:turkish?'Bu oturumda Academy tahtasına başarıyla uygulanmış bir işlem kaydım yok.':'I do not have a successfully applied Academy board action recorded in this session.'});
    if(lastBoardAction.kind==='text')return Object.freeze({accepted:true,known:true,kind:'text',value:lastBoardAction.value,text:turkish?`En son Academy tahtasına “${lastBoardAction.value}” yazdım.`:`I last wrote “${lastBoardAction.value}” on the Academy board.`});
    const names=turkish?{circle:'daire',triangle:'üçgen',rectangle:'dikdörtgen',arrow:'ok',axes:'koordinat eksenleri'}:{circle:'circle',triangle:'triangle',rectangle:'rectangle',arrow:'arrow',axes:'coordinate axes'},name=names[lastBoardAction.value];
    if(!name)return Object.freeze({accepted:true,known:false,text:turkish?'Son tahta şekli doğrulanmış izin listesinde bulunmuyor.':'The last board shape is not in the verified allowlist.'});
    return Object.freeze({accepted:true,known:true,kind:'shape',value:lastBoardAction.value,text:turkish?`En son Academy tahtasına bir ${name} çizdim.`:`I last drew a ${name} on the Academy board.`});
  }
  function academyBoardRepeatRequestForText(text,lastBoardAction,language='tr-TR'){
    if(typeof text!=='string'||!text.trim())return Object.freeze({accepted:false,reason:'INVALID_BOARD_REPEAT_TEXT'});
    const normalized=text.trim().toLocaleLowerCase('tr-TR');
    if(!/(?:onu|bunu|tahtadakini|son çizdiğini|son yazdığını).*(?:tekrar|yeniden).*(?:çiz|yaz|göster)|(?:tekrar|yeniden).*(?:onu|bunu|tahtadakini|son çizdiğini|son yazdığını).*(?:çiz|yaz|göster)|(?:draw|write|show) (?:that|it|the last one) again/iu.test(normalized))return Object.freeze({accepted:false,reason:'NO_BOARD_REPEAT_REQUEST'});
    const turkish=String(language).toLocaleLowerCase('en-US').startsWith('tr');
    if(!lastBoardAction||!['shape','text'].includes(lastBoardAction.kind)||typeof lastBoardAction.value!=='string'||!lastBoardAction.value)return Object.freeze({accepted:true,known:false,text:turkish?'Tekrarlayabileceğim doğrulanmış bir Academy tahta işlemim yok.':'I do not have a verified Academy board action that I can repeat.'});
    if(lastBoardAction.kind==='shape'&&!['circle','triangle','rectangle','arrow','axes'].includes(lastBoardAction.value))return Object.freeze({accepted:true,known:false,text:turkish?'Son tahta şekli güvenli çizim listemde bulunmuyor.':'The last board shape is not in my safe drawing allowlist.'});
    const action=Object.freeze({kind:lastBoardAction.kind,value:lastBoardAction.value.slice(0,200),...(lastBoardAction.kind==='shape'&&['small','standard','large'].includes(lastBoardAction.size)?{size:lastBoardAction.size}:{})});
    return Object.freeze({accepted:true,known:true,action,text:turkish?'Doğrulanmış son tahta işlemini yeniden uyguluyorum.':'I am applying the last verified board action again.'});
  }
  function academyBoardClearRequestForText(text,language='tr-TR'){
    if(typeof text!=='string'||!text.trim())return Object.freeze({accepted:false,reason:'INVALID_BOARD_CLEAR_TEXT'});
    const normalized=text.trim().toLocaleLowerCase('tr-TR');
    if(!/(?:tahta(?:yı|daki(?:ni)?)|çizdiğini|yazdığını).*(?:temizle|sil)|(?:temizle|sil).*(?:tahta(?:yı|dakini)|çizdiğini|yazdığını)|(?:clear|erase) (?:the )?board/iu.test(normalized))return Object.freeze({accepted:false,reason:'NO_BOARD_CLEAR_REQUEST'});
    const turkish=String(language).toLocaleLowerCase('en-US').startsWith('tr');
    return Object.freeze({accepted:true,action:'clear-board',text:turkish?'Academy tahtasını temizliyorum.':'I am clearing the Academy board.'});
  }
  function academyBoardResizeRequestForText(text,lastBoardAction,language='tr-TR'){
    if(typeof text!=='string'||!text.trim())return Object.freeze({accepted:false,reason:'INVALID_BOARD_RESIZE_TEXT'});
    const normalized=text.trim().toLocaleLowerCase('tr-TR'),large=/(?:daha büyük|büyüt|larger|bigger)/iu.test(normalized),small=/(?:daha küçük|küçült|smaller)/iu.test(normalized);
    if((!large&&!small)||!/(?:bunu|onu|şekli|çizdiğini|draw|shape|it)/iu.test(normalized))return Object.freeze({accepted:false,reason:'NO_BOARD_RESIZE_REQUEST'});
    const turkish=String(language).toLocaleLowerCase('en-US').startsWith('tr');
    if(!lastBoardAction||lastBoardAction.kind!=='shape'||!['circle','triangle','rectangle','arrow','axes'].includes(lastBoardAction.value))return Object.freeze({accepted:true,known:false,text:turkish?'Boyutlandırabileceğim doğrulanmış bir tahta şekli yok.':'I do not have a verified board shape that I can resize.'});
    const size=large?'large':'small',action=Object.freeze({kind:'shape',value:lastBoardAction.value,size});
    return Object.freeze({accepted:true,known:true,action,text:turkish?`Doğrulanmış son şekli daha ${large?'büyük':'küçük'} çiziyorum.`:`I am drawing the last verified shape ${large?'larger':'smaller'}.`});
  }
  function academyBoardSizeRecallAnswerForText(text,lastBoardAction,language='tr-TR'){
    if(typeof text!=='string'||!text.trim())return Object.freeze({accepted:false,reason:'INVALID_BOARD_SIZE_RECALL_TEXT'});
    const normalized=text.trim().toLocaleLowerCase('tr-TR');
    if(!/(?:hangi|ne) boyut(?:ta|unda).*(?:çizdin|şekil)|(?:çizdiğin|tahtadaki) şekil ne kadar (?:büyük|küçük)|what size did you draw|how (?:large|small) is (?:the|that) shape/iu.test(normalized))return Object.freeze({accepted:false,reason:'NO_BOARD_SIZE_RECALL_REQUEST'});
    const turkish=String(language).toLocaleLowerCase('en-US').startsWith('tr');
    if(!lastBoardAction||lastBoardAction.kind!=='shape'||!['small','standard','large'].includes(lastBoardAction.size))return Object.freeze({accepted:true,known:false,text:turkish?'Boyutu doğrulanmış bir Academy tahta şekli kaydım yok.':'I do not have an Academy board shape with a verified size recorded.'});
    const labels=turkish?{small:'küçük',standard:'normal',large:'büyük'}:{small:'small',standard:'standard',large:'large'},label=labels[lastBoardAction.size];
    return Object.freeze({accepted:true,known:true,size:lastBoardAction.size,text:turkish?`Son şekli ${label} boyutta çizdim.`:`I drew the last shape at ${label} size.`});
  }
  function academyBoardShapeExplanationForText(text,lastBoardAction,language='tr-TR'){
    if(typeof text!=='string'||!text.trim())return Object.freeze({accepted:false,reason:'INVALID_BOARD_EXPLANATION_TEXT'});
    const normalized=text.trim().toLocaleLowerCase('tr-TR');
    if(!/(?:bu|tahtadaki|son) şekli (?:açıkla|anlat)|(?:explain|describe) (?:this|the|that|last) shape/iu.test(normalized))return Object.freeze({accepted:false,reason:'NO_BOARD_EXPLANATION_REQUEST'});
    const turkish=String(language).toLocaleLowerCase('en-US').startsWith('tr');
    if(!lastBoardAction||lastBoardAction.kind!=='shape'||!['circle','triangle','rectangle','arrow','axes'].includes(lastBoardAction.value))return Object.freeze({accepted:true,known:false,text:turkish?'Açıklayabileceğim doğrulanmış bir Academy tahta şekli yok.':'I do not have a verified Academy board shape that I can explain.'});
    const explanations=turkish?{
      circle:'Bu bir dairedir: merkezi çevreleyen kesintisiz bir eğrisi vardır ve köşesi yoktur.',triangle:'Bu bir üçgendir: üç kenarı ve üç köşesi vardır.',rectangle:'Bu bir dikdörtgendir: karşılıklı kenarları eşit ve paralel olan dört dik açılı bir şekildir.',arrow:'Bu bir oktur: gövdesi bir doğrultuyu, uç kısmı ise yönü gösterir.',axes:'Bunlar koordinat eksenleridir: yatay ve düşey doğrultular bir referans sistemi oluşturur.'
    }:{
      circle:'This is a circle: it has one continuous curve around its centre and no corners.',triangle:'This is a triangle: it has three sides and three corners.',rectangle:'This is a rectangle: it has four right angles with opposite sides equal and parallel.',arrow:'This is an arrow: its shaft establishes a line and its head indicates direction.',axes:'These are coordinate axes: the horizontal and vertical directions form a reference system.'
    };
    return Object.freeze({accepted:true,known:true,shape:lastBoardAction.value,text:explanations[lastBoardAction.value]});
  }
  function academyBoardShapeCheckForText(text,lastBoardAction,language='tr-TR',variant=0){
    if(typeof text!=='string'||!text.trim())return Object.freeze({accepted:false,reason:'INVALID_BOARD_CHECK_TEXT'});
    if(!/(?:bu|tahtadaki|son) şekil(?:le| hakkında).*(?:bana )?soru sor|ask me (?:a )?question about (?:this|the|that|last) shape/iu.test(text.trim()))return Object.freeze({accepted:false,reason:'NO_BOARD_CHECK_REQUEST'});
    if(!Number.isInteger(variant)||variant<0||variant>2)return Object.freeze({accepted:false,reason:'INVALID_BOARD_CHECK_VARIANT'});
    const turkish=String(language).toLocaleLowerCase('en-US').startsWith('tr'),shape=lastBoardAction?.kind==='shape'?lastBoardAction.value:null;
    const checks=turkish?{
      circle:[['Dairenin kaç köşesi vardır?','Tahtadaki dairenin köşe sayısı nedir?','Bu dairenin köşelerini sayarsan kaç tane bulursun?'],'zero'],triangle:[['Üçgenin kaç kenarı vardır?','Tahtadaki üçgenin kenar sayısı nedir?','Bu üçgeni oluşturan kaç kenar görüyorsun?'],'three'],rectangle:[['Dikdörtgenin kaç dik açısı vardır?','Tahtadaki dikdörtgende kaç dik açı görüyorsun?','Bu dikdörtgenin dik açılarını sayarsan sonuç kaç olur?'],'four'],arrow:[['Okun uç kısmı neyi gösterir?','Ok başı hangi bilgiyi gösterir?','Bir okun uç kısmından neyi anlarız?'],'direction'],axes:[['Koordinat eksenleri kaç temel doğrultu gösterir?','Yatay ve düşey eksenler birlikte kaç temel doğrultu oluşturur?','Tahtadaki eksenlerde kaç ana doğrultu vardır?'],'two']
    }:{
      circle:[['How many corners does a circle have?','What is the number of corners in the circle on the board?','If you count this circle’s corners, how many do you find?'],'zero'],triangle:[['How many sides does a triangle have?','What is the side count of the triangle on the board?','How many sides form this triangle?'],'three'],rectangle:[['How many right angles does a rectangle have?','How many right angles do you see in the rectangle on the board?','If you count this rectangle’s right angles, what is the total?'],'four'],arrow:[['What does the head of an arrow indicate?','What information does an arrowhead show?','What do we learn from the pointed end of an arrow?'],'direction'],axes:[['How many primary directions do coordinate axes show?','Together, how many primary directions do horizontal and vertical axes form?','How many main directions are shown by the axes on the board?'],'two']
    },check=checks[shape];
    if(!check)return Object.freeze({accepted:true,known:false,text:turkish?'Soru sorabileceğim doğrulanmış bir Academy tahta şekli yok.':'I do not have a verified Academy board shape to ask about.'});
    return Object.freeze({accepted:true,known:true,variant,check:Object.freeze({shape,expected:check[1]}),text:check[0][variant]});
  }
  function createAcademyBoardQuestionDirector(options={}){
    const entropy=typeof options.entropy==='function'?options.entropy:defaultEntropy,remainingByKey=new Map();
    const ask=(text,lastBoardAction,language='tr-TR')=>{
      const probe=academyBoardShapeCheckForText(text,lastBoardAction,language,0);if(!probe.accepted||!probe.known)return probe;
      const key=`${String(language).toLocaleLowerCase('en-US')}:${probe.check.shape}`,remaining=remainingByKey.get(key)||[0,1,2],sample=Number(entropy());
      if(!Number.isFinite(sample)||sample<0||sample>=1)return Object.freeze({accepted:false,reason:'INVALID_ENTROPY'});
      const index=Math.min(remaining.length-1,Math.floor(sample*remaining.length)),variant=remaining.splice(index,1)[0];
      if(!remaining.length)remaining.push(...[0,1,2].filter(candidate=>candidate!==variant));remainingByKey.set(key,remaining);
      return academyBoardShapeCheckForText(text,lastBoardAction,language,variant);
    };
    return Object.freeze({ask,reset:()=>remainingByKey.clear()});
  }
  function academyBoardShapeCheckAnswerForText(text,check,language='tr-TR'){
    if(typeof text!=='string'||!text.trim()||!check||!['circle','triangle','rectangle','arrow','axes'].includes(check.shape)||!['zero','two','three','four','direction'].includes(check.expected))return Object.freeze({accepted:false,reason:'INVALID_BOARD_CHECK_ANSWER'});
    const normalized=text.trim().toLocaleLowerCase('tr-TR'),turkish=String(language).toLocaleLowerCase('en-US').startsWith('tr');
    if(/^(?:geç|atla|iptal|bilmiyorum|skip|cancel|i don't know)[.! ]*$/iu.test(normalized))return Object.freeze({accepted:true,cancelled:true,text:turkish?'Soruyu geçiyorum; tahta bağlamını koruyorum.':'I am skipping the question and keeping the board context.'});
    const patterns={zero:/\b(?:0|sıfır|zero|none|hiç)\b/iu,two:/\b(?:2|iki|two)\b/iu,three:/\b(?:3|üç|three)\b/iu,four:/\b(?:4|dört|four)\b/iu,direction:/\b(?:yön|yönü|doğrultu|direction|heading)\b/iu},correct=patterns[check.expected].test(normalized),retryAvailable=!correct&&(!Number.isInteger(check.attempts)||check.attempts<1);
    const correction=turkish?{zero:'Dairenin köşesi yoktur.',two:'Koordinat eksenleri iki temel doğrultu gösterir.',three:'Üçgenin üç kenarı vardır.',four:'Dikdörtgenin dört dik açısı vardır.',direction:'Okun uç kısmı yönü gösterir.'}:{zero:'A circle has no corners.',two:'Coordinate axes show two primary directions.',three:'A triangle has three sides.',four:'A rectangle has four right angles.',direction:'The head of an arrow indicates direction.'};
    const recovered=correct&&Number.isInteger(check.attempts)&&check.attempts>0;
    return Object.freeze({accepted:true,correct,...(recovered?{recovered:true}:{}),...(!correct?{retry:retryAvailable,completed:!retryAvailable}:{}),text:correct?(recovered?(turkish?'Doğru. İkinci denemende cevabını düzelttin; tahtadaki şekille uyuşuyor.':'Correct. You revised your answer on the second attempt; it matches the shape on the board.'):(turkish?'Doğru. Cevabın tahtadaki şekille uyuşuyor.':'Correct. Your answer matches the shape on the board.')):(retryAvailable?(turkish?`Bu cevap doğrulanmış şekil özelliğiyle uyuşmuyor. ${correction[check.expected]} Bir kez daha deneyebilirsin.`:`That answer does not match the verified shape property. ${correction[check.expected]} You can try once more.`):(turkish?`Bu deneme de doğrulanmış şekil özelliğiyle uyuşmuyor. Doğru bilgi: ${correction[check.expected]} Soruyu burada kapatıyorum.`:`This attempt also does not match the verified shape property. The correct fact is: ${correction[check.expected]} I am closing this question.`))});
  }
  function academyBoardShapeCheckRepeatForText(text,check,language='tr-TR'){
    if(typeof text!=='string'||!text.trim())return Object.freeze({accepted:false,reason:'INVALID_BOARD_CHECK_REPEAT_TEXT'});
    if(!/^(?:soruyu\s+(?:tekrar\s+(?:et|sor|eder\s+misin)|yeniden\s+sor)|soruyu\s+tekrarlar\s+mısın|repeat\s+(?:the|that)\s+question|ask\s+(?:the|that)\s+question\s+again)[?!. ]*$/iu.test(text.trim()))return Object.freeze({accepted:false,reason:'NO_BOARD_CHECK_REPEAT_REQUEST'});
    const question=typeof check?.question==='string'?check.question.trim():'';
    if(!question||question.length>240)return Object.freeze({accepted:true,known:false,text:String(language).toLocaleLowerCase('en-US').startsWith('tr')?'Tekrar edebileceğim doğrulanmış ve açık bir soru yok.':'I do not have a verified open question that I can repeat.'});
    const turkish=String(language).toLocaleLowerCase('en-US').startsWith('tr');
    return Object.freeze({accepted:true,known:true,repeated:true,text:turkish?`Soruyu tekrar ediyorum: ${question}`:`I will repeat the question: ${question}`});
  }
  function academyBoardShapeCheckHintForText(text,check,language='tr-TR'){
    if(typeof text!=='string'||!text.trim())return Object.freeze({accepted:false,reason:'INVALID_BOARD_CHECK_HINT_TEXT'});
    const normalized=text.trim().toLocaleLowerCase('tr-TR');
    if(!/^(?:(?:bir\s+)?ipucu(?:\s+(?:ver|verir\s+misin|alabilir\s+miyim))?|(?:give\s+me|can\s+i\s+have)\s+(?:a\s+)?hint|hint(?:\s+please)?)[?!. ]*$/u.test(normalized))return Object.freeze({accepted:false,reason:'NO_BOARD_CHECK_HINT_REQUEST'});
    const shape=['circle','triangle','rectangle','arrow','axes'].includes(check?.shape)?check.shape:null,turkish=String(language).toLocaleLowerCase('en-US').startsWith('tr');
    if(!shape)return Object.freeze({accepted:true,known:false,text:turkish?'İpucu verebileceğim doğrulanmış ve açık bir şekil sorusu yok.':'I do not have a verified open shape question for which I can give a hint.'});
    const used=Number.isInteger(check?.hintsUsed)&&check.hintsUsed>=0?check.hintsUsed:0;
    if(used>=2)return Object.freeze({accepted:true,known:true,hint:false,exhausted:true,shape,text:turkish?'İki doğrulanmış ipucu verdim. Şimdi cevaplayabilir veya soruyu geçebilirsin.':'I have given two verified hints. You can answer now or skip the question.'});
    const hints=turkish?{circle:['İpucu: Şeklin çevresini takip et ve keskin birleşim noktalarını say.','İkinci ipucu: Yuvarlak çizgide yön değiştiren keskin bir nokta görüp görmediğine bak.'],triangle:['İpucu: Şekli oluşturan düz kenarları birer kez takip et.','İkinci ipucu: Başlangıç noktasına dönene kadar karşılaştığın düz parçaları izle.'],rectangle:['İpucu: Köşelerde oluşan açı türüne odaklan ve bu köşeleri say.','İkinci ipucu: Her dönüşün kare bir köşe oluşturup oluşturmadığına bak.'],arrow:['İpucu: Okun sivri uç kısmına ve işaret ettiği tarafa bak.','İkinci ipucu: Ok gövdesinin hangi tarafa doğru uzandığını düşün.'],axes:['İpucu: Yatay ve düşey çizgileri ayrı doğrultular olarak düşün.','İkinci ipucu: Biri yatay, biri düşey olan çizgileri ayrı ayrı takip et.']}:{circle:['Hint: Trace the boundary and count any sharp meeting points.','Second hint: Look for any sharp point where the round line changes direction.'],triangle:['Hint: Follow each straight side that forms the shape once.','Second hint: Track the straight segments until you return to the starting point.'],rectangle:['Hint: Focus on the type of angle at each corner and count those corners.','Second hint: Check whether each turn forms a square corner.'],arrow:['Hint: Look at the pointed end of the arrow and the way it is facing.','Second hint: Think about which way the arrow shaft extends.'],axes:['Hint: Treat the horizontal and vertical lines as separate directions.','Second hint: Follow the horizontal line and the vertical line separately.']};
    return Object.freeze({accepted:true,known:true,hint:true,hintIndex:used,shape,text:hints[shape][used]});
  }
  function recordVerifiedGesture(history,action,{limit=4}={}){
    if(!Array.isArray(history)||!Number.isInteger(limit)||limit<1||limit>8)return Object.freeze({accepted:false,reason:'INVALID_GESTURE_HISTORY'});
    const verified=gestureAcknowledgementForRequest({accepted:true,supported:true,action},'en-US');
    if(!verified.accepted)return Object.freeze({accepted:false,reason:'UNVERIFIED_GESTURE_ACTION'});
    const retained=history.filter(item=>typeof item==='string'&&gestureAcknowledgementForRequest({accepted:true,supported:true,action:item},'en-US').accepted);
    return Object.freeze({accepted:true,history:Object.freeze([...retained,action].slice(-limit))});
  }
  function gestureHistoryAnswerForText(text,history,language='tr-TR'){
    if(typeof text!=='string'||!text.trim())return Object.freeze({accepted:false,reason:'INVALID_HISTORY_TEXT'});
    const normalized=text.toLocaleLowerCase('tr-TR');
    if(!/(son\s+iki\s+hareketin\s+neydi|önce\s+ne\s+yaptın.*sonra\s+ne\s+yaptın|what\s+were\s+your\s+last\s+two\s+movements|what\s+did\s+you\s+do\s+first.*(?:then|next))/iu.test(normalized))return Object.freeze({accepted:false,reason:'NO_GESTURE_HISTORY_REQUEST'});
    const turkish=String(language).toLocaleLowerCase('en-US').startsWith('tr');
    const actions=Array.isArray(history)?history.slice(-2):[];
    const labels=turkish?{
      'show-palm':'avucumu açıp gösterdim','show-right-hand':'sağ avucumu gösterdim','raise-left-hand':'sol elimi kaldırdım','show-both-hands':'iki elimi aynı anda gösterdim',wave:'sana el salladım','look-left':'başımı sola çevirdim','look-right':'başımı sağa çevirdim','shake-head':'başımı iki yana salladım',nod:'başımı eğdim',smile:'gülümsedim',laugh:'kısa bir kahkaha attım',walk:'kısa bir yürüyüş yaptım','point-board':'tahtayı işaret ettim','show-listening':'seni dinlediğimi gösterdim'
    }:{
      'show-palm':'opened and showed my palm','show-right-hand':'showed my right palm','raise-left-hand':'raised my left hand','show-both-hands':'showed both hands at once',wave:'waved to you','look-left':'turned my head left','look-right':'turned my head right','shake-head':'shook my head from side to side',nod:'nodded',smile:'smiled',laugh:'gave a brief laugh',walk:'took a short walk','point-board':'pointed to the board','show-listening':'showed that I was listening'
    };
    const known=actions.filter(action=>Object.hasOwn(labels,action));
    if(known.length<2)return Object.freeze({accepted:true,known:false,text:turkish?'Sıralı yanıt için henüz iki doğrulanmış hareket kaydım yok.':'I do not yet have two verified movements recorded for a sequence answer.'});
    const answer=turkish?`Önce ${labels[known[0]]}; ardından ${labels[known[1]]}.`:`First I ${labels[known[0]]}; then I ${labels[known[1]]}.`;
    return Object.freeze({accepted:true,known:true,actions:Object.freeze(known),text:answer});
  }
  function gestureStopRequestForText(text,language='tr-TR'){
    if(typeof text!=='string'||!text.trim())return Object.freeze({accepted:false,reason:'INVALID_STOP_TEXT'});
    const normalized=text.trim().toLocaleLowerCase('tr-TR');
    if(!/^(?:sinbad[,\s]+)?(?:dur|hareketi\s+durdur|hareket\s+etme|elini\s+indir|nötr\s+poza\s+dön|stop\s+moving|stop\s+the\s+movement|lower\s+your\s+hand|return\s+to\s+neutral)[.! ]*$/iu.test(normalized))return Object.freeze({accepted:false,reason:'NO_GESTURE_STOP_REQUEST'});
    const turkish=String(language).toLocaleLowerCase('en-US').startsWith('tr');
    return Object.freeze({accepted:true,action:'stop-motion',text:turkish?'Hareketi durdurdum ve nötr poza döndüm.':'I stopped the movement and returned to a neutral pose.'});
  }
  function gestureSequenceForRequest(action,{actions}={}){
    const sequences={
      'show-palm':[
        {at:0,gesture:'open-hand',gaze:'audience',emotion:'warm',energy:.3},
        {at:260,gesture:'show-palm',gaze:'palm',emotion:'attentive',energy:.4},
        {at:820,gesture:'show-palm',gaze:'audience',emotion:'warm',energy:.34}
      ],
      'show-right-hand':[
        {at:0,gesture:'open-hand',gaze:'audience',emotion:'warm',energy:.3},
        {at:240,gesture:'show-palm',gaze:'palm',emotion:'attentive',energy:.4},
        {at:780,gesture:'show-palm',gaze:'audience',emotion:'warm',energy:.34}
      ],
      'raise-left-hand':[
        {at:0,gesture:'rest',gaze:'audience',emotion:'attentive',energy:.26},
        {at:240,gesture:'raise-left',gaze:'left-palm',emotion:'attentive',energy:.38},
        {at:760,gesture:'raise-left',gaze:'audience',emotion:'warm',energy:.32}
      ],
      'show-both-hands':[
        {at:0,gesture:'rest',gaze:'audience',emotion:'attentive',energy:.24},
        {at:260,gesture:'open-hand',gaze:'audience',emotion:'warm',energy:.32},
        {at:620,gesture:'show-both-hands',gaze:'audience',emotion:'warm',energy:.44},
        {at:1320,gesture:'rest',gaze:'audience',emotion:'warm',energy:.24}
      ],
      wave:[
        {at:0,gesture:'open-hand',gaze:'audience',emotion:'warm',energy:.32},
        {at:220,gesture:'wave-right',gaze:'audience',emotion:'warm',energy:.46},
        {at:520,gesture:'wave-right-away',gaze:'audience',emotion:'warm',energy:.42},
        {at:920,gesture:'wave-right',gaze:'audience',emotion:'warm',energy:.46},
        {at:1220,gesture:'wave-right-away',gaze:'audience',emotion:'warm',energy:.42},
        {at:1600,gesture:'open-hand',gaze:'audience',emotion:'warm',energy:.3}
      ],
      laugh:[
        {at:0,gesture:'rest',gaze:'audience',emotion:'warm',energy:.28},
        {at:180,gesture:'laugh',gaze:'audience',emotion:'joyful',energy:.64},
        {at:620,gesture:'nod',gaze:'audience',emotion:'joyful',energy:.46},
        {at:980,gesture:'laugh',gaze:'audience',emotion:'joyful',energy:.58},
        {at:1380,gesture:'rest',gaze:'audience',emotion:'warm',energy:.26}
      ],
      'shake-head':[
        {at:0,gesture:'rest',gaze:'audience',emotion:'attentive',energy:.24},
        {at:220,gesture:'shake-head-left',gaze:'audience',emotion:'attentive',energy:.32},
        {at:620,gesture:'shake-head-right',gaze:'audience',emotion:'attentive',energy:.32},
        {at:1100,gesture:'shake-head-left',gaze:'audience',emotion:'attentive',energy:.3},
        {at:1600,gesture:'rest',gaze:'audience',emotion:'warm',energy:.24}
      ],
      nod:[
        {at:0,gesture:'rest',gaze:'audience',emotion:'attentive',energy:.24},
        {at:200,gesture:'nod',gaze:'audience',emotion:'warm',energy:.32},
        {at:560,gesture:'nod-up',gaze:'audience',emotion:'warm',energy:.28},
        {at:900,gesture:'nod',gaze:'audience',emotion:'warm',energy:.3},
        {at:1260,gesture:'rest',gaze:'audience',emotion:'warm',energy:.24}
      ],
      'point-board':[
        {at:0,gesture:'explain',gaze:'audience',emotion:'confident',energy:.34},
        {at:300,gesture:'point-board',gaze:'board',emotion:'confident',energy:.42},
        {at:1000,gesture:'point-board',gaze:'audience',emotion:'warm',energy:.34}
      ]
    };
    if(action==='two-hand-sequence'){
      if(!Array.isArray(actions)||actions.length!==2||new Set(actions).size!==2||!actions.every(item=>['show-right-hand','raise-left-hand'].includes(item)))return Object.freeze({accepted:false,reason:'INVALID_COMPOUND_GESTURE'});
      const cues=[];let offset=0;
      actions.forEach((item,index)=>{
        const source=sequences[item];
        source.forEach((cue,cueIndex)=>cues.push(Object.freeze({...cue,at:cue.at+offset,...(cueIndex===1?{actionStart:item}:{})})));
        if(index===0)offset=source.at(-1).at+360;
      });
      return Object.freeze({accepted:true,cues:Object.freeze(cues),duration:cues.at(-1).at,actions:Object.freeze([...actions])});
    }
    if(!Object.hasOwn(sequences,action))return Object.freeze({accepted:false,reason:'NO_GESTURE_SEQUENCE'});
    const cues=sequences[action].map(cue=>Object.freeze(cue));
    return Object.freeze({accepted:true,cues:Object.freeze(cues),duration:cues.at(-1).at});
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
  return Object.freeze({PERFORMANCES,CUE_SEQUENCES,LISTENING_ACTIVITY_CUES,LISTENING_MEANING_POOLS,THINKING_STAGE_CUES,IMPROVISATION_POOLS,MOTION_PROFILES,IDLE_MICRO_CUES,cueAt,speechModeForDecision,speechCueForBoundary,speechTransitionForKinds,listeningCueForActivity,listeningPauseForPace,listeningCueForPace,listeningCueForText,thinkingCueForStage,responseCueForText,textPresentationCues,gestureRequestForText,gestureAcknowledgementForRequest,groundResponseWithGesture,gestureRecallAnswerForText,academyBoardRecallAnswerForText,academyBoardRepeatRequestForText,academyBoardClearRequestForText,academyBoardResizeRequestForText,academyBoardSizeRecallAnswerForText,academyBoardShapeExplanationForText,academyBoardShapeCheckForText,academyBoardShapeCheckAnswerForText,academyBoardShapeCheckRepeatForText,academyBoardShapeCheckHintForText,createAcademyBoardQuestionDirector,recordVerifiedGesture,gestureHistoryAnswerForText,gestureStopRequestForText,gestureSequenceForRequest,gazeTransitionForCue,createListeningReactionDirector,createIdleBehaviorDirector,createImprovisationDirector,createSpeechGestureDirector,createPerformanceDirector});
});
