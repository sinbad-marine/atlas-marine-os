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
  function speechEmphasisForBoundary(text,charIndex){
    if(typeof text!=='string'||!Number.isSafeInteger(charIndex)||charIndex<0||charIndex>text.length)return Object.freeze({accepted:false,reason:'INVALID_EMPHASIS_BOUNDARY'});
    const token=(text.slice(charIndex).match(/^[\s\p{P}]*([\p{L}\p{N}]+)/u)||[])[1]||'';
    if(!token)return Object.freeze({accepted:false,reason:'NO_EMPHASIS'});
    const tr=token.toLocaleLowerCase('tr-TR'),en=token.toLocaleLowerCase('en-US');
    if(['ama','ancak','fakat','oysa','but','however','although'].includes(en)||['ama','ancak','fakat','oysa'].includes(tr))return Object.freeze({accepted:true,reason:'contrast',token,cue:Object.freeze({gesture:'hold',gaze:'audience',emotion:'attentive',energy:.3})});
    if(['önce','sonra','ardından','nihayet','birinci','ikinci','üçüncü'].includes(tr)||['first','next','then','finally','second','third'].includes(en))return Object.freeze({accepted:true,reason:'sequence',token,cue:Object.freeze({gesture:'explain',gaze:'audience',emotion:'confident',energy:.36})});
    return Object.freeze({accepted:false,reason:'NO_EMPHASIS'});
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
    const emphasis=safeMode==='caution'?null:speechEmphasisForBoundary(text,charIndex);
    let cue;
    if(safeMode==='caution'&&(isSentence||isPause))cue={gesture:'hold',gaze:'audience',emotion:'concerned',energy:isSentence?.28:.3,cadence:isSentence?'sentence-end':'pause'};
    else if(isSentence&&preceding==='?')cue={gesture:'open-hand',gaze:'audience',emotion:'curious',cadence:'question'};
    else if(isSentence)cue=semantic.responseKind==='uncertainty'?{gesture:'hold',gaze:'thought',emotion:'curious',energy:.26,cadence:'sentence-end'}:['correction','negative'].includes(semantic.responseKind)?{gesture:'hold',gaze:'audience',emotion:'attentive',energy:.28,cadence:'sentence-end'}:{gesture:'nod',gaze:'audience',emotion:semantic.emotion,cadence:'sentence-end'};
    else if(isPause)cue={gesture:'hold',gaze:'thought',emotion:semantic.responseKind==='caution'?'concerned':safeMode==='instructional'?'confident':'attentive',cadence:'pause'};
    else if(emphasis?.accepted)cue={...emphasis.cue,cadence:'emphasis',emphasisReason:emphasis.reason,responseKind:semantic.responseKind};
    else if(charIndex===0||startsNewSentence)cue={gesture:semantic.gesture,gaze:semantic.gaze,emotion:semantic.emotion,cadence:'opening',responseKind:semantic.responseKind};
    else{
      const sequence=safeMode==='caution'?'speaking-caution':safeMode==='instructional'?'speaking-instructional':'speaking';
      cue={...cueAt(sequence,wordIndex).cue,emotion:semantic.emotion,cadence:'word',responseKind:semantic.responseKind};
    }
    if(typeof cue.responseKind!=='string')cue.responseKind=semantic.responseKind;
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
    const normalized=text.toLocaleLowerCase('tr-TR'),english=text.toLocaleLowerCase('en-US');
    let cue,meaning;
    if(/\b(dikkat|tehlike|acil|yangın|yardım|dur|mayday|danger|emergency|fire|help|stop)\b/iu.test(normalized)){
      meaning='caution';cue={gesture:'hold',gaze:'audience',emotion:'concerned',energy:.34};
    }else if(/\b(?:anlamadım|emin değilim|kararsızım|kafam karıştı|tekrar eder misin)\b/iu.test(normalized)||/\b(?:i (?:do not|don['’]t) understand|not sure|confused|say that again)\b/iu.test(english)){
      meaning='uncertainty';cue={gesture:'hold',gaze:'thought',emotion:'curious',energy:.28};
    }else if(/[?？]\s*$/u.test(normalized)||/\b(mi|mı|mu|mü|neden|niçin|nasıl|hangi|kim|ne zaman|why|how|which|who|when)\b/iu.test(normalized)){
      meaning='question';cue={gesture:'listen-follow',gaze:'audience',emotion:'curious',energy:.44};
    }else if(/\b(teşekkür|sağ ol|harika|güzel|sevindim|thanks|thank you|great|wonderful)\b/iu.test(normalized)){
      meaning='positive';cue={gesture:'nod',gaze:'audience',emotion:'warm',energy:.36};
    }else if(/\b(merhaba|selam|günaydın|iyi akşamlar|hello|hi|good morning|good evening)\b/iu.test(normalized)){
      meaning='greeting';cue={gesture:'listen-orient',gaze:'audience',emotion:'warm',energy:.34};
    }else if(/^(?:hayır|istemiyorum|olmaz|katılmıyorum)[.! ]*$/iu.test(normalized.trim())||/^(?:no|nope|i disagree|do not)[.! ]*$/iu.test(english.trim())){
      meaning='negative';cue={gesture:'hold',gaze:'audience',emotion:'attentive',energy:.28};
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
    ]),
    greeting:Object.freeze([
      Object.freeze({reactionId:'greeting-orient',gesture:'listen-orient',gaze:'audience',emotion:'warm',energy:.34}),
      Object.freeze({reactionId:'greeting-nod',gesture:'nod',gaze:'audience',emotion:'warm',energy:.32})
    ]),
    uncertainty:Object.freeze([
      Object.freeze({reactionId:'uncertainty-thought',gesture:'hold',gaze:'thought',emotion:'curious',energy:.26}),
      Object.freeze({reactionId:'uncertainty-follow',gesture:'listen-follow',gaze:'audience',emotion:'attentive',energy:.32}),
      Object.freeze({reactionId:'uncertainty-orient',gesture:'listen-orient',gaze:'audience',emotion:'curious',energy:.3}),
      Object.freeze({reactionId:'uncertainty-shrug',gesture:'shrug',gaze:'audience',emotion:'curious',energy:.34})
    ]),
    negative:Object.freeze([
      Object.freeze({reactionId:'negative-hold',gesture:'hold',gaze:'audience',emotion:'attentive',energy:.28}),
      Object.freeze({reactionId:'negative-orient',gesture:'listen-orient',gaze:'audience',emotion:'attentive',energy:.3})
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
    const normalized=text.toLocaleLowerCase('tr-TR'),english=text.toLocaleLowerCase('en-US');
    const caution=safeMode==='caution'||/(uyarı|dikkat|tehlike|acil|mayday|warning|caution|danger|emergency|kritik|critical)/iu.test(normalized);
    const uncertainty=/(?:emin değilim|bilmiyorum|doğrulayamıyorum|doğrulayamadım|yeterli (?:kanıt|veri|bilgi) (?:yok|bulunmuyor)|i am not sure|i don't know|cannot verify|could not verify|insufficient (?:evidence|data|information))/iu.test(normalized);
    const correction=/(?:bu (?:cevap|bilgi|sonuç) (?:doğru değil|yanlış)|(?:cevap|bilgi|sonuç) (?:hatalı|yanlış)|düzeltmem gerekiyor|düzeltiyorum|does not match|is (?:incorrect|not correct|wrong)|i need to correct)/iu.test(normalized);
    const negative=/(?:^|[.!?]\s*)(?:hayır|olmaz|bunu (?:yapamam|yapmayacağım)|bu isteği (?:yerine getiremem|uygulayamam)|no|i cannot do that|i won't do that|this request cannot be completed)(?:[,.!?;:]|\s|$)/iu.test(normalized);
    const question=/\?/u.test(text);
    const completed=/(başarıyla (?:tamamlandı|oluşturuldu|kaydedildi)|(?:işlem|plan|rota) tamamlandı|completed successfully|successfully (?:created|saved)|is now ready)/iu.test(normalized);
    let cue;
    if(caution)cue={gesture:'hold',gaze:'audience',emotion:'concerned',energy:.34,responseKind:'caution'};
    else if(uncertainty)cue={gesture:'shrug',gaze:'thought',emotion:'curious',energy:.32,responseKind:'uncertainty'};
    else if(correction)cue={gesture:'shake-head-left',gaze:'audience',emotion:'attentive',energy:.32,responseKind:'correction'};
    else if(negative)cue={gesture:'shake-head-left',gaze:'audience',emotion:'attentive',energy:.3,responseKind:'negative'};
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
    uncertainty:Object.freeze([
      Object.freeze({variantId:'uncertainty-shrug',gesture:'shrug',gaze:'audience',emotion:'curious',energy:.34}),
      Object.freeze({variantId:'uncertainty-thought',gesture:'hold',gaze:'thought',emotion:'curious',energy:.28}),
      Object.freeze({variantId:'uncertainty-orient',gesture:'listen-orient',gaze:'audience',emotion:'attentive',energy:.3}),
      Object.freeze({variantId:'uncertainty-nod',gesture:'nod',gaze:'audience',emotion:'attentive',energy:.28})
    ]),
    question:Object.freeze([
      Object.freeze({variantId:'question-open',gesture:'open-hand',gaze:'audience',emotion:'curious',energy:.42}),
      Object.freeze({variantId:'question-open-left',gesture:'open-hand-left',gaze:'audience',emotion:'curious',energy:.42}),
      Object.freeze({variantId:'question-thought',gesture:'hold',gaze:'thought',emotion:'curious',energy:.3}),
      Object.freeze({variantId:'question-explain',gesture:'explain',gaze:'audience',emotion:'curious',energy:.38}),
      Object.freeze({variantId:'question-explain-left',gesture:'explain-left',gaze:'audience',emotion:'curious',energy:.38}),
      Object.freeze({variantId:'question-nod',gesture:'nod',gaze:'audience',emotion:'attentive',energy:.32})
    ]),
    correction:Object.freeze([
      Object.freeze({variantId:'correction-shake',gesture:'shake-head-left',gaze:'audience',emotion:'attentive',energy:.32}),
      Object.freeze({variantId:'correction-shake-right',gesture:'shake-head-right',gaze:'audience',emotion:'attentive',energy:.32}),
      Object.freeze({variantId:'correction-open',gesture:'open-hand',gaze:'audience',emotion:'attentive',energy:.34}),
      Object.freeze({variantId:'correction-thought',gesture:'hold',gaze:'thought',emotion:'attentive',energy:.26}),
      Object.freeze({variantId:'correction-explain',gesture:'explain',gaze:'board',emotion:'warm',energy:.36})
    ]),
    negative:Object.freeze([
      Object.freeze({variantId:'negative-shake',gesture:'shake-head-left',gaze:'audience',emotion:'attentive',energy:.3}),
      Object.freeze({variantId:'negative-shake-right',gesture:'shake-head-right',gaze:'audience',emotion:'attentive',energy:.3}),
      Object.freeze({variantId:'negative-hold',gesture:'hold',gaze:'audience',emotion:'attentive',energy:.26}),
      Object.freeze({variantId:'negative-thought',gesture:'hold',gaze:'thought',emotion:'attentive',energy:.24})
    ]),
    completion:Object.freeze([
      Object.freeze({variantId:'completion-nod',gesture:'nod',gaze:'audience',emotion:'confident',energy:.4}),
      Object.freeze({variantId:'completion-open',gesture:'open-hand',gaze:'audience',emotion:'confident',energy:.38}),
      Object.freeze({variantId:'completion-open-left',gesture:'open-hand-left',gaze:'audience',emotion:'confident',energy:.38}),
      Object.freeze({variantId:'completion-explain',gesture:'explain',gaze:'audience',emotion:'warm',energy:.34}),
      Object.freeze({variantId:'completion-explain-left',gesture:'explain-left',gaze:'audience',emotion:'warm',energy:.34}),
      Object.freeze({variantId:'completion-rest',gesture:'rest',gaze:'audience',emotion:'confident',energy:.28})
    ]),
    explanation:Object.freeze([
      Object.freeze({variantId:'explanation-explain',gesture:'explain',gaze:'audience',emotion:'confident',energy:.44}),
      Object.freeze({variantId:'explanation-explain-left',gesture:'explain-left',gaze:'audience',emotion:'confident',energy:.44}),
      Object.freeze({variantId:'explanation-open',gesture:'open-hand',gaze:'audience',emotion:'warm',energy:.4}),
      Object.freeze({variantId:'explanation-open-left',gesture:'open-hand-left',gaze:'audience',emotion:'warm',energy:.4}),
      Object.freeze({variantId:'explanation-thought',gesture:'hold',gaze:'thought',emotion:'attentive',energy:.32}),
      Object.freeze({variantId:'explanation-nod',gesture:'nod',gaze:'audience',emotion:'confident',energy:.36})
    ]),
    conversation:Object.freeze([
      Object.freeze({variantId:'conversation-open',gesture:'open-hand',gaze:'audience',emotion:'warm',energy:.36}),
      Object.freeze({variantId:'conversation-open-left',gesture:'open-hand-left',gaze:'audience',emotion:'warm',energy:.36}),
      Object.freeze({variantId:'conversation-nod',gesture:'nod',gaze:'audience',emotion:'warm',energy:.3}),
      Object.freeze({variantId:'conversation-explain',gesture:'explain',gaze:'audience',emotion:'warm',energy:.34}),
      Object.freeze({variantId:'conversation-explain-left',gesture:'explain-left',gaze:'audience',emotion:'warm',energy:.34}),
      Object.freeze({variantId:'conversation-rest',gesture:'rest',gaze:'audience',emotion:'attentive',energy:.26})
    ])
  });
  const MOTION_PROFILES=Object.freeze(['measured','lively','thoughtful','crisp','gentle','deliberate']);
  const GESTURE_FAMILIES=Object.freeze({
    'open-hand':'expansive','open-hand-left':'expansive',explain:'expansive','explain-left':'expansive',
    nod:'affirming','shake-head-left':'corrective','shake-head-right':'corrective',
    hold:'reflective',shrug:'reflective',rest:'neutral'
  });
  function gestureFamily(gesture){return GESTURE_FAMILIES[gesture]||'other';}
  const GESTURE_SIDES=Object.freeze({'open-hand':'right',explain:'right','show-palm':'right','open-hand-left':'left','explain-left':'left','show-left-palm':'left'});
  function gestureSide(gesture){return GESTURE_SIDES[gesture]||'center';}
  function preferredGestureFamilyForSpeechCue(cue={}){
    if(!cue||typeof cue!=='object'||Array.isArray(cue))return Object.freeze({family:null,reason:'NONE'});
    if(cue.responseKind==='caution')return Object.freeze({family:'reflective',reason:'SAFETY_CAUTION'});
    if(cue.responseKind==='uncertainty')return Object.freeze({family:'reflective',reason:'EPISTEMIC_UNCERTAINTY'});
    if(cue.responseKind==='correction')return Object.freeze({family:'corrective',reason:'FACTUAL_CORRECTION'});
    if(cue.responseKind==='negative')return Object.freeze({family:'corrective',reason:'EXPLICIT_REFUSAL'});
    if(cue.responseKind==='completion'||cue.cadence==='sentence-end')return Object.freeze({family:'affirming',reason:'RESOLUTION'});
    if(cue.responseKind==='question'||cue.cadence==='question')return Object.freeze({family:'expansive',reason:'INVITE_RESPONSE'});
    if(cue.emphasisReason==='contrast'||cue.gaze==='thought')return Object.freeze({family:'reflective',reason:'CONTRAST_OR_REFLECTION'});
    if(cue.emphasisReason==='sequence')return Object.freeze({family:'expansive',reason:'SEQUENCE_EXPLANATION'});
    return Object.freeze({family:null,reason:'NONE'});
  }
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
    let lastGesture=null,recentFamilies=[],lastActiveSide=null;
    const choose=(responseKind,context='answer',preferences={})=>{
      if(!Object.hasOwn(IMPROVISATION_POOLS,responseKind))return Object.freeze({accepted:false,reason:'UNKNOWN_RESPONSE_KIND'});
      if(!preferences||typeof preferences!=='object'||Array.isArray(preferences))return Object.freeze({accepted:false,reason:'INVALID_IMPROVISATION_PREFERENCES'});
      const key=`${context}:${responseKind}`,pool=IMPROVISATION_POOLS[responseKind];
      const history=histories.get(key)||{last:null,remaining:[...pool],lastProfile:null,profileRemaining:[...MOTION_PROFILES]};
      if(!history.remaining.length)history.remaining=pool.length>1?pool.filter(cue=>cue.variantId!==history.last):[...pool];
      if(!history.profileRemaining.length)history.profileRemaining=MOTION_PROFILES.filter(profile=>profile!==history.lastProfile);
      const sample=Number(entropy()),profileSample=Number(entropy());
      if(!Number.isFinite(sample)||sample<0||sample>=1||!Number.isFinite(profileSample)||profileSample<0||profileSample>=1)return Object.freeze({accepted:false,reason:'INVALID_ENTROPY'});
      const preferredFamily=typeof preferences.preferredFamily==='string'?preferences.preferredFamily:null;
      if(preferredFamily&&![...new Set(Object.values(GESTURE_FAMILIES))].includes(preferredFamily))return Object.freeze({accepted:false,reason:'UNKNOWN_GESTURE_FAMILY'});
      const preferredChoices=preferredFamily?history.remaining.filter(cue=>gestureFamily(cue.gesture)===preferredFamily):[];
      const semanticChoices=preferredChoices.length?preferredChoices:history.remaining;
      const familyChoices=semanticChoices.filter(cue=>!recentFamilies.includes(gestureFamily(cue.gesture)));
      const familyEligible=familyChoices.length?familyChoices:semanticChoices;
      const oppositeSideChoices=lastActiveSide?familyEligible.filter(cue=>{const side=gestureSide(cue.gesture);return side==='center'||side!==lastActiveSide;}):familyEligible;
      const sideEligible=oppositeSideChoices.length?oppositeSideChoices:familyEligible;
      const gestureChoices=sideEligible.filter(cue=>cue.gesture!==lastGesture);
      const eligible=gestureChoices.length?gestureChoices:sideEligible;
      const selectedIndex=Math.min(eligible.length-1,Math.floor(sample*eligible.length));
      const selected=eligible[selectedIndex];
      const index=history.remaining.indexOf(selected);
      const profileIndex=Math.min(history.profileRemaining.length-1,Math.floor(profileSample*history.profileRemaining.length));
      const [baseCue]=history.remaining.splice(index,1),[motionProfile]=history.profileRemaining.splice(profileIndex,1);
      const family=gestureFamily(baseCue.gesture),side=gestureSide(baseCue.gesture),cue=Object.freeze({...baseCue,gestureFamily:family,gestureSide:side,semanticPreference:preferredChoices.length?(preferences.preferenceReason||'SEMANTIC_MATCH'):'NONE',motionProfile});
      history.last=cue.variantId;history.lastProfile=motionProfile;lastGesture=cue.gesture;recentFamilies=[...recentFamilies,family].slice(-2);if(side==='left'||side==='right')lastActiveSide=side;histories.set(key,history);
      return Object.freeze({accepted:true,cue});
    };
    const reset=()=>{histories.clear();lastGesture=null;recentFamilies=[];lastActiveSide=null;};
    return Object.freeze({choose,reset});
  }
  function createSpeechGestureDirector(options={}){
    const entropy=typeof options.entropy==='function'?options.entropy:defaultEntropy;
    const improvisation=createImprovisationDirector({entropy});
    let remainingWords=0,expansiveGestures=0,activeGesture=false;
    const select=cue=>{
      if(!cue||typeof cue!=='object'||typeof cue.cadence!=='string')return Object.freeze({accepted:false,reason:'INVALID_SPEECH_CUE'});
      const emphasized=['opening','pause','sentence-end','question','emphasis'].includes(cue.cadence);
      if(!emphasized&&cue.cadence==='word'&&remainingWords>0){
        remainingWords--;
        if(remainingWords===0&&activeGesture){activeGesture=false;const caution=cue.responseKind==='caution',uncertainty=cue.responseKind==='uncertainty',correction=cue.responseKind==='correction',negative=cue.responseKind==='negative',guarded=caution||uncertainty||correction||negative;return Object.freeze({accepted:true,change:true,cue:Object.freeze({...cue,variantId:'speech-settle',gesture:guarded?'hold':'rest',gaze:uncertainty?'thought':'audience',emotion:caution?'concerned':uncertainty?'curious':'attentive',energy:Math.min(Number(cue.energy)||.24,.26),motionProfile:'gentle',performancePhase:'settle'})});}
        return Object.freeze({accepted:true,change:false,cue:Object.freeze({...cue,gesture:null,performancePhase:'hold'})});
      }
      if(!emphasized&&cue.cadence!=='word')return Object.freeze({accepted:true,change:false,cue:Object.freeze({...cue,gesture:null})});
      if(emphasized)remainingWords=2;
      else{
        const sample=Number(entropy());
        if(!Number.isFinite(sample)||sample<0||sample>=1)return Object.freeze({accepted:false,reason:'INVALID_ENTROPY'});
        remainingWords=2+Math.floor(sample*3);
      }
      if(expansiveGestures>=2)return Object.freeze({accepted:true,change:true,cue:Object.freeze({...cue,variantId:'speech-motion-budget-settle',gesture:'hold',gaze:cue.responseKind==='uncertainty'?'thought':'audience',emotion:cue.responseKind==='caution'?'concerned':cue.responseKind==='uncertainty'?'curious':'attentive',energy:Math.min(Number(cue.energy)||.28,.3),motionProfile:'gentle',motionBudget:'settled',responseKind:cue.responseKind,cadence:cue.cadence,performancePhase:'settle'})});
      const preference=preferredGestureFamilyForSpeechCue(cue);
      const improvised=improvisation.choose(cue.responseKind,'speech',{preferredFamily:preference.family,preferenceReason:preference.reason});
      if(!improvised.accepted)return Object.freeze({accepted:false,reason:improvised.reason});
      if(improvised.cue.gestureFamily==='expansive'){
        if(expansiveGestures>=2)return Object.freeze({accepted:true,change:true,cue:Object.freeze({...cue,variantId:`${improvised.cue.variantId}-settle`,gesture:'hold',gaze:cue.responseKind==='uncertainty'?'thought':'audience',emotion:cue.responseKind==='caution'?'concerned':cue.responseKind==='uncertainty'?'curious':'attentive',energy:Math.min(Number(cue.energy)||.28,.3),motionProfile:'gentle',motionBudget:'settled',responseKind:cue.responseKind,cadence:cue.cadence})});
        expansiveGestures++;
      }
      activeGesture=true;
      return Object.freeze({accepted:true,change:true,cue:Object.freeze({...cue,...improvised.cue,responseKind:cue.responseKind,cadence:cue.cadence,performancePhase:'accent'})});
    };
    const beginTurn=()=>{remainingWords=0;expansiveGestures=0;activeGesture=false;};
    const reset=()=>{beginTurn();improvisation.reset();};
    return Object.freeze({select,beginTurn,reset});
  }
  function gestureRequestForText(text,context={}){
    if(typeof text!=='string'||!text.trim())return Object.freeze({accepted:false,reason:'INVALID_REQUEST_TEXT'});
    const source=text.trim(),normalized=source.toLocaleLowerCase('tr-TR');
    const contextualActions={
      'show-palm':Object.freeze({gesture:'show-palm',gaze:'audience',emotion:'warm',energy:.4}),
      'show-right-hand':Object.freeze({gesture:'show-palm',gaze:'audience',emotion:'warm',energy:.4}),
      'raise-left-hand':Object.freeze({gesture:'show-left-palm',gaze:'audience',emotion:'attentive',energy:.38}),
      'show-both-hands':Object.freeze({gesture:'show-both-hands',gaze:'audience',emotion:'warm',energy:.44}),
      wave:Object.freeze({gesture:'wave-right',gaze:'audience',emotion:'warm',energy:.46}),
      'look-left':Object.freeze({gesture:'look-left',gaze:'audience',emotion:'attentive',energy:.24}),
      'look-right':Object.freeze({gesture:'look-right',gaze:'audience',emotion:'attentive',energy:.24}),
      'look-center':Object.freeze({gesture:'rest',gaze:'audience',emotion:'attentive',energy:.18}),
      'look-board':Object.freeze({gesture:'rest',gaze:'board',emotion:'attentive',energy:.2}),
      'shake-head':Object.freeze({gesture:'shake-head-left',gaze:'audience',emotion:'attentive',energy:.32}),
      shrug:Object.freeze({gesture:'shrug',gaze:'audience',emotion:'curious',energy:.38}),
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
    const asksPalmObject=/((?:avucunda|avucunun\s+içinde|elinde).*(?:ne\s+var|bir\s+şey\s+(?:mi\s+var|var\s+mı))|(?:what|anything|something).*(?:in|on).*(?:your\s+)?(?:hand|palm))/iu.test(normalized);
    const asksBothPalmObject=asksPalmObject&&/(?:(?:iki|her\s+iki)\s+(?:el|avuç|avuc)|both\s+(?:hands|palms))/iu.test(normalized);
    if(asksBothPalmObject)return Object.freeze({accepted:true,action:'show-both-hands',supported:true,semantic:'palm-object-query',palmSide:'both',responsePolicy:'replace',cue:Object.freeze({gesture:'show-both-hands',gaze:'audience',emotion:'attentive',energy:.44})});
    const asksOtherPalmObject=asksPalmObject&&/(?:öbür|diğer|other)\s+(?:el|avuç|avuc|hand|palm)/iu.test(normalized);
    if(asksOtherPalmObject){
      const previousRight=['show-palm','show-right-hand'].includes(lastAction),previousLeft=lastAction==='raise-left-hand';
      if(!previousRight&&!previousLeft)return Object.freeze({accepted:true,action:'show-other-hand',supported:false,contextual:true,reason:'NO_VERIFIED_GESTURE_REFERENCE'});
      const left=previousRight,action=left?'raise-left-hand':'show-right-hand';
      return Object.freeze({accepted:true,action,supported:true,contextual:true,semantic:'palm-object-query',palmSide:left?'left':'right',responsePolicy:'replace',cue:Object.freeze(left?{gesture:'show-left-palm',gaze:'left-palm',emotion:'attentive',energy:.4}:{gesture:'show-palm',gaze:'palm',emotion:'attentive',energy:.4})});
    }
    if(asksPalmObject&&/(?:sol\s+(?:el|avuç|avuc)|left\s+(?:hand|palm))/iu.test(normalized))return Object.freeze({accepted:true,action:'raise-left-hand',supported:true,semantic:'palm-object-query',palmSide:'left',responsePolicy:'replace',cue:Object.freeze({gesture:'show-left-palm',gaze:'left-palm',emotion:'attentive',energy:.4})});
    if(asksPalmObject)return Object.freeze({accepted:true,action:'show-palm',supported:true,semantic:'palm-object-query',palmSide:/(?:sağ\s+(?:el|avuç|avuc)|right\s+(?:hand|palm))/iu.test(normalized)?'right':'unspecified',responsePolicy:'replace',cue:Object.freeze({gesture:'show-palm',gaze:'palm',emotion:'attentive',energy:.4})});
    if(/(sağ\s+(?:elini|kolunu|avucunu).*(?:göster|kaldır|aç)|(?:show|raise|open).*(?:your\s+)?right\s+(?:hand|arm|palm))/iu.test(normalized))return Object.freeze({accepted:true,action:'show-right-hand',supported:true,cue:Object.freeze({gesture:'show-palm',gaze:'audience',emotion:'warm',energy:.4})});
    if(/(sol\s+(?:elini|kolunu|avucunu).*(?:göster|kaldır|aç)|(?:show|raise|open).*(?:your\s+)?left\s+(?:hand|arm|palm))/iu.test(normalized))return Object.freeze({accepted:true,action:'raise-left-hand',supported:true,cue:Object.freeze({gesture:'show-left-palm',gaze:'audience',emotion:'attentive',energy:.38})});
    if(/((?:bana\s+)?(?:elini|el)\s+(?:salla|sallar\s+mısın)|(?:merhaba|selam)\s+(?:deyip\s+)?el\s+salla|wave\s+(?:your\s+hand|at\s+me|hello))/iu.test(normalized))return Object.freeze({accepted:true,action:'wave',supported:true,responsePolicy:'replace',cue:Object.freeze({gesture:'wave-right',gaze:'audience',emotion:'warm',energy:.46})});
    if(/(başını\s+sola\s+(?:çevir|döndür)|(?:turn|look).*(?:your\s+)?head.*left)/iu.test(normalized))return Object.freeze({accepted:true,action:'look-left',supported:true,cue:Object.freeze({gesture:'look-left',gaze:'audience',emotion:'attentive',energy:.24})});
    if(/(başını\s+sağa\s+(?:çevir|döndür)|(?:turn|look).*(?:your\s+)?head.*right)/iu.test(normalized))return Object.freeze({accepted:true,action:'look-right',supported:true,cue:Object.freeze({gesture:'look-right',gaze:'audience',emotion:'attentive',energy:.24})});
    if(/(başını\s+(?:ortaya|merkeze|düz)\s+(?:çevir|döndür)|(?:tekrar|yeniden)\s+bana\s+bak|(?:turn|bring)\s+(?:your\s+)?head\s+(?:back\s+)?(?:to\s+)?(?:the\s+)?cent(?:er|re)|look\s+(?:back\s+)?at\s+me)/iu.test(normalized))return Object.freeze({accepted:true,action:'look-center',supported:true,responsePolicy:'replace',cue:contextualActions['look-center']});
    if(/(?:tahta(?:ya|ya doğru)\s+bak|bakışını\s+tahtaya\s+çevir|look\s+(?:at|toward)\s+(?:the\s+)?(?:board|blackboard))/iu.test(normalized))return Object.freeze({accepted:true,action:'look-board',supported:true,responsePolicy:'replace',cue:contextualActions['look-board']});
    if(/(başını\s+(?:iki\s+yana|sağa\s+sola)\s+salla|hayır\s+(?:anlamında\s+)?başını\s+salla|shake\s+(?:your\s+)?head|head\s+shake)/iu.test(normalized))return Object.freeze({accepted:true,action:'shake-head',supported:true,responsePolicy:'replace',cue:Object.freeze({gesture:'shake-head-left',gaze:'audience',emotion:'attentive',energy:.32})});
    if(/(?:omuzlarını|omuzunu)\s+silk|(?:silk|kaldır)\s+omuzlarını|shrug(?:\s+your\s+shoulders)?/iu.test(normalized))return Object.freeze({accepted:true,action:'shrug',supported:true,responsePolicy:'replace',cue:contextualActions.shrug});
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
    if(/(?:tahta(?:ya|da)\s+(?:bir\s+)?altıgen\s+çiz|draw\s+(?:a\s+)?hexagon\s+(?:on|onto)\s+(?:the\s+)?(?:board|blackboard))/iu.test(normalized))return Object.freeze({accepted:true,action:'draw-board-shape',supported:true,directAcademyBoard:true,responsePolicy:'replace',boardShape:'hexagon',cue:Object.freeze({gesture:'point-board',gaze:'board',emotion:'confident',energy:.44})});
    if(/(?:tahta(?:ya|da)\s+(?:bir\s+)?ok\s+çiz|draw\s+(?:an?\s+)?arrow\s+(?:on|onto)\s+(?:the\s+)?(?:board|blackboard))/iu.test(normalized))return Object.freeze({accepted:true,action:'draw-board-shape',supported:true,directAcademyBoard:true,responsePolicy:'replace',boardShape:'arrow',cue:Object.freeze({gesture:'point-board',gaze:'board',emotion:'confident',energy:.44})});
    if(/(?:tahta(?:ya|da)\s+(?:(?:bir\s+)?koordinat\s+)?eksen(?:leri)?\s+çiz|draw\s+(?:the\s+)?(?:coordinate\s+)?axes\s+(?:on|onto)\s+(?:the\s+)?(?:board|blackboard))/iu.test(normalized))return Object.freeze({accepted:true,action:'draw-board-shape',supported:true,directAcademyBoard:true,responsePolicy:'replace',boardShape:'axes',cue:Object.freeze({gesture:'point-board',gaze:'board',emotion:'confident',energy:.44})});
    if(/(tahta(?:ya|da|yı)?.*(?:yaz|çiz)|(?:write|draw).*(?:board|blackboard))/iu.test(normalized)){
      return Object.freeze({accepted:true,action:'write-board',supported:false,reason:'GESTURE_NOT_IMPLEMENTED'});
    }
    if(/(tahta(?:yı|ya|da)?|yazı tahtası|board|blackboard)/iu.test(normalized)){
      return Object.freeze({accepted:true,action:'point-board',supported:true,cue:Object.freeze({gesture:'point-board',gaze:'board',emotion:'confident',energy:.42})});
    }
    if(/(dinlediğini göster|show .*listening)/iu.test(normalized)){
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
    if(request.semantic==='palm-object-query'){
      const left=request.palmSide==='left',right=request.palmSide==='right',both=request.palmSide==='both',action=left?'raise-left-hand':right?'show-right-hand':both?'show-both-hands':'show-palm';
      return Object.freeze({accepted:true,supported:true,action,text:turkish?(left?'Sol avucumu açıp gösteriyorum; mevcut karakter görünümünde sol avucumda bir nesne gösterilmiyor.':right?'Sağ avucumu açıp gösteriyorum; mevcut karakter görünümünde sağ avucumda bir nesne gösterilmiyor.':both?'İki avucumu birlikte gösteriyorum; mevcut karakter görünümünde avuçlarımda bir nesne gösterilmiyor.':'Avucumu açıp gösteriyorum; mevcut karakter görünümünde avucumda bir nesne gösterilmiyor.'):(left?'I am opening my left palm; the current character view shows no object in it.':right?'I am opening my right palm; the current character view shows no object in it.':both?'I am showing both palms; the current character view shows no object in either palm.':'I am opening my palm; the current character view shows no object in it.')});
    }
    if(request.semantic==='compound-two-hand'&&Array.isArray(request.actions)&&request.actions.length===2){
      const rightFirst=request.actions[0]==='show-right-hand';
      return Object.freeze({accepted:true,supported:true,action:'two-hand-sequence',text:turkish?(rightFirst?'Önce sağ avucumu, ardından sol elimi gösteriyorum.':'Önce sol elimi, ardından sağ avucumu gösteriyorum.'):(rightFirst?'First I am showing my right palm, then my left hand.':'First I am showing my left hand, then my right palm.')});
    }
    if(request.directAcademyBoard&&request.action==='write-board')return Object.freeze({accepted:true,supported:true,action:'write-board',text:turkish?`Academy tahtasına “${request.boardText}” yazıyorum.`:`I am writing “${request.boardText}” on the Academy board.`});
    if(request.directAcademyBoard&&request.action==='draw-board-shape'){
      const names=turkish?{circle:'daire',triangle:'üçgen',rectangle:'dikdörtgen',hexagon:'altıgen',arrow:'ok',axes:'koordinat eksenleri'}:{circle:'circle',triangle:'triangle',rectangle:'rectangle',hexagon:'hexagon',arrow:'arrow',axes:'coordinate axes'},name=names[request.boardShape];
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
      'look-center':'Başımı yeniden ortaya çevirip sana bakıyorum.',
      'look-board':'Bakışımı tahtaya çeviriyorum.',
      'shake-head':'Başımı iki yana sallayarak hayır işareti yapıyorum.',
      shrug:'Omuzlarımı silkerek karşılık veriyorum.',
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
      'look-center':'I am turning my head back to center and looking at you.',
      'look-board':'I am turning my gaze toward the board.',
      'shake-head':'I am shaking my head from side to side to signal no.',
      shrug:'I am shrugging my shoulders in response.',
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
  const GESTURE_CAPABILITIES=Object.freeze({
    sequence:Object.freeze(['show-palm','show-right-hand','raise-left-hand','show-both-hands','wave','shake-head','shrug','nod','laugh','point-board','two-hand-sequence','verified-history-sequence']),
    pose:Object.freeze(['look-left','look-right','look-center','look-board','smile','show-listening']),
    'direct-character':Object.freeze(['walk']),
    academy:Object.freeze(['write-board','draw-board-shape'])
  });
  function gestureCapabilityForRequest(request){
    if(!request||typeof request!=='object'||request.accepted!==true||request.supported!==true)return Object.freeze({accepted:false,reason:'UNSUPPORTED_GESTURE_REQUEST'});
    const action=request.action;
    const mode=Object.entries(GESTURE_CAPABILITIES).find(([,actions])=>actions.includes(action))?.[0];
    if(!mode)return Object.freeze({accepted:false,reason:'UNREGISTERED_GESTURE_CAPABILITY'});
    if(mode==='academy'&&request.directAcademyBoard!==true)return Object.freeze({accepted:false,reason:'ACADEMY_GATE_REQUIRED'});
    if(mode==='direct-character'&&request.directCharacterReaction!==true)return Object.freeze({accepted:false,reason:'CHARACTER_CONTROLLER_REQUIRED'});
    if(mode==='sequence'){
      const sequence=gestureSequenceForRequest(action,{actions:request.actions});
      if(!sequence.accepted)return Object.freeze({accepted:false,reason:sequence.reason||'GESTURE_SEQUENCE_UNAVAILABLE'});
    }
    if(mode==='pose'&&(!request.cue||typeof request.cue.gesture!=='string'))return Object.freeze({accepted:false,reason:'GESTURE_POSE_UNAVAILABLE'});
    return Object.freeze({accepted:true,action,mode});
  }
  function groundResponseWithGesture(responseText,request,language='tr-TR'){
    if(typeof responseText!=='string'||!responseText.trim())return Object.freeze({accepted:false,reason:'INVALID_RESPONSE_TEXT'});
    const acknowledgement=gestureAcknowledgementForRequest(request,language);
    if(!acknowledgement.accepted)return Object.freeze({accepted:true,grounded:false,text:responseText});
    const text=request.responsePolicy==='replace'?acknowledgement.text:`${acknowledgement.text} ${responseText}`.trim();
    return Object.freeze({accepted:true,grounded:true,supported:acknowledgement.supported,action:acknowledgement.action,text});
  }
  function gestureRecallAnswerForText(text,lastAction,language='tr-TR',lastContext=null){
    if(typeof text!=='string'||!text.trim())return Object.freeze({accepted:false,reason:'INVALID_RECALL_TEXT'});
    const normalized=text.toLocaleLowerCase('tr-TR');
    const asksWhichHand=/(hangi\s+(?:elini|avucunu).*(?:kaldırdın|gösterdin|açtın)|which\s+(?:hand|palm).*(?:raise|show|open))/iu.test(normalized);
    const asksLastAction=/(az önce\s+ne\s+yaptın|son\s+hareketin\s+neydi|what\s+did\s+you\s+(?:just\s+)?do|what\s+was\s+your\s+last\s+movement)/iu.test(normalized);
    const asksWhyPalm=/(?:neden|niçin)\s+(?:elini|avucunu)\s+(?:açtın|gösterdin)|(?:elini|avucunu)\s+neden\s+(?:açtın|gösterdin)|why did you (?:open|show) your (?:hand|palm)/iu.test(normalized);
    const asksWhyBoard=/(?:neden|niçin)\s+tahtayı\s+işaret ettin|tahtayı\s+neden\s+işaret ettin|why did you point (?:at|to) the board/iu.test(normalized);
    const asksWhyLookBoard=/(?:neden|niçin)\s+tahta(?:ya|ya doğru)\s+baktın|tahta(?:ya|ya doğru)\s+neden\s+baktın|why did you look (?:at|toward) (?:the )?(?:board|blackboard)/iu.test(normalized);
    const asksWhyWave=/(?:neden|niçin)\s+(?:bana\s+)?el\s+salladın|(?:bana\s+)?el\s+neden\s+salladın|why did you wave(?: at me)?/iu.test(normalized);
    const asksWhyLaugh=/(?:neden|niçin)\s+(?:güldün|kahkaha\s+attın)|(?:neden|niçin)\s+gülüyorsun|why did you (?:laugh|chuckle)/iu.test(normalized);
    const asksWhyLookLeft=/(?:neden|niçin)\s+başını\s+sola\s+(?:çevirdin|döndürdün)|başını\s+sola\s+neden\s+(?:çevirdin|döndürdün)|why did you (?:turn|look).*(?:your\s+)?head.*left/iu.test(normalized);
    const asksWhyLookRight=/(?:neden|niçin)\s+başını\s+sağa\s+(?:çevirdin|döndürdün)|başını\s+sağa\s+neden\s+(?:çevirdin|döndürdün)|why did you (?:turn|look).*(?:your\s+)?head.*right/iu.test(normalized);
    const asksWhyLookCenter=/(?:neden|niçin)\s+(?:başını\s+(?:ortaya|merkeze|düz)\s+(?:çevirdin|döndürdün)|(?:tekrar|yeniden)\s+bana\s+baktın)|why did you (?:turn|bring) (?:your )?head back to (?:the )?cent(?:er|re)|why did you look (?:back )?at me/iu.test(normalized);
    const asksWhyBoardConfirmationNo=lastContext==='board-confirmation-no'&&/(?:neden|niçin)\s+başını\s+(?:iki yana|sağa sola)\s+salladın|why did you shake your head/iu.test(normalized);
    const asksWhyBoardConfirmationYes=lastContext==='board-confirmation-yes'&&/(?:neden|niçin)\s+başını\s+(?:eğdin|salladın)|why did you nod/iu.test(normalized);
    if(!asksWhichHand&&!asksLastAction&&!asksWhyPalm&&!asksWhyBoard&&!asksWhyLookBoard&&!asksWhyWave&&!asksWhyLaugh&&!asksWhyLookLeft&&!asksWhyLookRight&&!asksWhyLookCenter&&!asksWhyBoardConfirmationNo&&!asksWhyBoardConfirmationYes)return Object.freeze({accepted:false,reason:'NO_GESTURE_RECALL_REQUEST'});
    const acknowledgement=gestureAcknowledgementForRequest({accepted:true,supported:true,action:lastAction},language);
    const turkish=String(language).toLocaleLowerCase('en-US').startsWith('tr');
    if(!lastAction||!acknowledgement.accepted)return Object.freeze({accepted:true,known:false,text:turkish?'Bu oturumda doğrulanmış bir hareket kaydım henüz yok.':'I do not have a verified movement recorded in this session yet.'});
    if(asksWhyBoardConfirmationNo){
      if(lastAction!=='shake-head')return Object.freeze({accepted:true,known:false,kind:'gesture-reason',text:turkish?'Doğrulanmış son hareketim başımı iki yana sallamak değil; neden uydurmayacağım.':'My last verified movement was not a head shake, so I will not invent a reason.'});
      return Object.freeze({accepted:true,known:true,kind:'gesture-reason',action:'shake-head',cue:Object.freeze({gesture:'shake-head-left',gaze:'board',emotion:'attentive',energy:.34}),text:turkish?'Sorudaki şekil tahtadaki doğrulanmış şekille uyuşmadığı için hayır cevabımı beden diliyle göstermek üzere başımı iki yana sallamıştım; şimdi yeniden gösteriyorum.':'I shook my head to show my no answer because the requested shape did not match the verified board shape; I am showing it again now.'});
    }
    if(asksWhyBoardConfirmationYes){
      if(lastAction!=='nod')return Object.freeze({accepted:true,known:false,kind:'gesture-reason',text:turkish?'Doğrulanmış son hareketim onaylayarak başımı eğmek değil; neden uydurmayacağım.':'My last verified movement was not a nod, so I will not invent a reason.'});
      return Object.freeze({accepted:true,known:true,kind:'gesture-reason',action:'nod',cue:Object.freeze({gesture:'nod',gaze:'board',emotion:'confident',energy:.34}),text:turkish?'Sorudaki şekil tahtadaki doğrulanmış şekille eşleştiği için evet cevabımı beden diliyle onaylamak üzere başımı eğmiştim; şimdi yeniden gösteriyorum.':'I nodded to confirm my yes answer because the requested shape matched the verified board shape; I am showing it again now.'});
    }
    if(asksWhyPalm){
      if(!['show-palm','show-right-hand','raise-left-hand','show-both-hands'].includes(lastAction))return Object.freeze({accepted:true,known:false,kind:'gesture-reason',text:turkish?'Son doğrulanmış hareketim bir el veya avuç gösterme hareketi değil; neden uydurmayacağım.':'My last verified movement was not a hand or palm display, so I will not invent a reason.'});
      const gesture=lastAction==='raise-left-hand'?'show-left-palm':lastAction==='show-both-hands'?'show-both-hands':'show-palm',gaze=lastAction==='raise-left-hand'?'left-palm':lastAction==='show-both-hands'?'audience':'palm';
      return Object.freeze({accepted:true,known:true,kind:'gesture-reason',action:lastAction,cue:Object.freeze({gesture,gaze,emotion:'attentive',energy:lastAction==='show-both-hands'?.44:.38}),text:turkish?'Elimi görünür biçimde göstermek ve soruna beden diliyle karşılık vermek için avucumu açmıştım; şimdi yeniden gösteriyorum.':'I opened my palm to show my hand clearly and respond to your question with body language; I am showing it again now.'});
    }
    if(asksWhyBoard){
      if(lastAction!=='point-board')return Object.freeze({accepted:true,known:false,kind:'gesture-reason',text:turkish?'Son doğrulanmış hareketim tahtayı işaret etmek değil; neden uydurmayacağım.':'My last verified movement was not pointing at the board, so I will not invent a reason.'});
      return Object.freeze({accepted:true,known:true,kind:'gesture-reason',action:lastAction,cue:Object.freeze({gesture:'point-board',gaze:'board',emotion:'confident',energy:.42}),text:turkish?'Anlattığım doğrulanmış tahta içeriğine dikkatini yöneltmek için tahtayı işaret etmiştim; şimdi yeniden gösteriyorum.':'I pointed at the board to direct your attention to the verified board content I was explaining; I am pointing to it again now.'});
    }
    if(asksWhyLookBoard){
      if(lastAction!=='look-board')return Object.freeze({accepted:true,known:false,kind:'gesture-reason',text:turkish?'Son doğrulanmış hareketim tahtaya bakmak değil; neden uydurmayacağım.':'My last verified movement was not looking at the board, so I will not invent a reason.'});
      return Object.freeze({accepted:true,known:true,kind:'gesture-reason',action:'look-board',cue:Object.freeze({gesture:'rest',gaze:'board',emotion:'attentive',energy:.2}),text:turkish?'Dikkatimi tahtadaki içeriğe yöneltmek için bakışımı tahtaya çevirmiştim; şimdi yeniden tahtaya bakıyorum.':'I turned my gaze to the board to focus on its content; I am looking at the board again now.'});
    }
    if(asksWhyWave){
      if(lastAction!=='wave')return Object.freeze({accepted:true,known:false,kind:'gesture-reason',text:turkish?'Son doğrulanmış hareketim el sallamak değil; neden uydurmayacağım.':'My last verified movement was not a wave, so I will not invent a reason.'});
      return Object.freeze({accepted:true,known:true,kind:'gesture-reason',action:'wave',cue:Object.freeze({gesture:'wave-right',gaze:'audience',emotion:'warm',energy:.46}),text:turkish?'Selamına veya el sallama isteğine görünür biçimde karşılık vermek için el sallamıştım; şimdi yeniden sallıyorum.':'I waved to respond visibly to your greeting or wave request; I am waving again now.'});
    }
    if(asksWhyLaugh){
      if(lastAction!=='laugh')return Object.freeze({accepted:true,known:false,kind:'gesture-reason',text:turkish?'Son doğrulanmış hareketim gülmek değil; neden uydurmayacağım.':'My last verified movement was not a laugh, so I will not invent a reason.'});
      return Object.freeze({accepted:true,known:true,kind:'gesture-reason',action:'laugh',cue:Object.freeze({gesture:'laugh',gaze:'audience',emotion:'joyful',energy:.58}),text:turkish?'Gülme isteğine kısa ve görünür bir tepki vermek için gülmüştüm; şimdi yeniden kısa bir kahkaha atıyorum.':'I laughed to respond briefly and visibly to your request; I am giving another short laugh now.'});
    }
    if(asksWhyLookLeft||asksWhyLookRight){
      const expected=asksWhyLookLeft?'look-left':'look-right',direction=asksWhyLookLeft?'sola':'sağa';
      if(lastAction!==expected)return Object.freeze({accepted:true,known:false,kind:'gesture-reason',text:turkish?`Son doğrulanmış hareketim başımı ${direction} çevirmek değil; neden uydurmayacağım.`:`My last verified movement was not turning my head ${asksWhyLookLeft?'left':'right'}, so I will not invent a reason.`});
      return Object.freeze({accepted:true,known:true,kind:'gesture-reason',action:expected,cue:Object.freeze({gesture:expected,gaze:'audience',emotion:'attentive',energy:.24}),text:turkish?`Yön isteğine görünür biçimde karşılık vermek için başımı ${direction} çevirmiştim; şimdi yeniden çeviriyorum.`:`I turned my head ${asksWhyLookLeft?'left':'right'} to respond visibly to your direction request; I am turning it that way again now.`});
    }
    if(asksWhyLookCenter){
      if(lastAction!=='look-center')return Object.freeze({accepted:true,known:false,kind:'gesture-reason',text:turkish?'Son doğrulanmış hareketim başımı ortaya çevirip sana bakmak değil; neden uydurmayacağım.':'My last verified movement was not returning my head to center and looking at you, so I will not invent a reason.'});
      return Object.freeze({accepted:true,known:true,kind:'gesture-reason',action:'look-center',cue:Object.freeze({gesture:'rest',gaze:'audience',emotion:'attentive',energy:.18}),text:turkish?'Dikkatimi yeniden sana yöneltmek ve konuşmayı yüz yüze sürdürmek için başımı ortaya çevirmiştim; şimdi yeniden sana bakıyorum.':'I returned my head to center to direct my attention back to you and continue face to face; I am looking at you again now.'});
    }
    const prefixes=turkish?{
      'show-palm':'Avucumu açıp gösterdim.',
      'show-right-hand':'Sağ avucumu açıp gösterdim.',
      'raise-left-hand':'Sol elimi kaldırıp gösterdim.',
      'show-both-hands':'İki elimi aynı anda gösterdim.',
      wave:'Sana el salladım.',
      'look-left':'Başımı sola çevirdim.',
      'look-right':'Başımı sağa çevirdim.',
      'look-center':'Başımı ortaya çevirip sana baktım.',
      'look-board':'Bakışımı tahtaya çevirdim.',
      'shake-head':'Başımı iki yana salladım.',
      shrug:'Omuzlarımı silktim.',
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
      'look-center':'I turned my head back to center and looked at you.',
      'look-board':'I turned my gaze toward the board.',
      'shake-head':'I shook my head from side to side.',
      shrug:'I shrugged my shoulders.',
      nod:'I nodded.',
      smile:'I smiled.',
      laugh:'I gave a brief laugh.',
      walk:'I took a short walk.',
      'point-board':'I pointed to the board.',
      'show-listening':'I showed that I was listening.'
    };
    return Object.freeze({accepted:true,known:true,action:lastAction,text:prefixes[lastAction]});
  }
  function characterStateAnswerForText(text,snapshot,language='tr-TR'){
    if(typeof text!=='string'||!text.trim())return Object.freeze({accepted:false,reason:'INVALID_CHARACTER_STATE_TEXT'});
    const normalized=text.trim().toLocaleLowerCase('tr-TR'),turkish=String(language).toLocaleLowerCase('en-US').startsWith('tr');
    const asksGaze=/(?:nereye|neye|hangi tarafa)\s+bak(?:ıyor|ıyorsun)|where are you looking|what are you looking at/iu.test(normalized);
    const asksAudienceGaze=/(?:şu an\s+)?(?:bana|yüzüme)\s+(?:(?:mı\s+)?bakıyorsun|bakıyor\s+musun)|are you looking at me(?: right now)?/iu.test(normalized);
    const asksActivity=/(?:şu an|şimdi)\s+(?:ne yapıyorsun|hangi hareketi yapıyorsun)|what are you doing (?:now|right now)/iu.test(normalized);
    const asksListeningStatus=/(?:beni|şu an beni)\s+(?:duyuyor|dinliyor)\s+musun|mikrofon(?:un)?\s+(?:açık|dinliyor)\s+m[ıi]|are you (?:hearing|listening to) me|is (?:your|the) microphone (?:on|listening|active)/iu.test(normalized);
    const asksSide=/(?:hangi|ne)\s+(?:elini|kolunu|tarafını)\s+kullanıyorsun|sağ mı sol mu|which (?:hand|arm|side) are you using|right or left/iu.test(normalized);
    const asksHeadDirection=/(?:başın|başını)\s+(?:şu an\s+)?hangi\s+tarafa\s+(?:dönük|çevirdin|bakıyor)|which way is your head (?:turned|facing)/iu.test(normalized);
    const asksHeadTilt=/(?:başın|başını)\s+(?:şu an\s+)?(?:yukarı|aşağı|hangi yöne|ne tarafa)\s+(?:mı\s+)?(?:eğik|eğdin|kaldırdın)|(?:is|ıs) your head tilted (?:up|down)|did you tilt your head (?:up|down)/iu.test(normalized);
    const asksFacialExpression=/(?:şu an\s+)?gülümsüyor\s+musun|yüz ifaden (?:nasıl|ne)|are you smiling|what is your facial expression/iu.test(normalized);
    const asksBodyPosture=/(?:şu an\s+)?(?:öne|geriye|arkaya)\s+(?:mi\s+)?(?:eğildin|eğiksin|yaslandın)|duruşun (?:nasıl|ne)|are you leaning (?:forward|back)|what is your posture/iu.test(normalized);
    const asksMotionEnergy=/(?:hareket|animasyon)\s+(?:enerjin|yoğunluğun)\s+(?:nasıl|ne durumda)|ne kadar hareketlisin|how (?:active|energetic) is your (?:movement|animation)|what is your movement energy/iu.test(normalized);
    const asksReducedMotion=/(?:hareket|animasyon)\s+azaltma(?:\s+tercihi)?\s+(?:açık|etkin|aktif)\s+m[ıi]|azaltılmış\s+hareket\s+(?:açık|etkin|aktif)\s+m[ıi]|[iı]s reduced motion (?:enabled|active|on)/iu.test(normalized);
    const asksPoseSummary=/(?:şu an\s+)?(?:pozun|beden durumun)\s+(?:nasıl|ne durumda)|şu an nasıl görünüyorsun|describe your (?:current )?pose|what does your pose look like/iu.test(normalized);
    const asksWhyHeadShake=/(?:neden|niçin)\s+başını\s+(?:iki yana|sağa sola)\s+salladın|başını\s+(?:iki yana|sağa sola)\s+neden\s+salladın|why did you shake your head/iu.test(normalized);
    const asksWhyShrug=/(?:neden|niçin)\s+omuzlarını\s+silktin|omuzlarını\s+neden\s+silktin|why did you shrug/iu.test(normalized);
    if(!asksGaze&&!asksAudienceGaze&&!asksActivity&&!asksListeningStatus&&!asksSide&&!asksHeadDirection&&!asksHeadTilt&&!asksFacialExpression&&!asksBodyPosture&&!asksMotionEnergy&&!asksReducedMotion&&!asksPoseSummary&&!asksWhyHeadShake&&!asksWhyShrug)return Object.freeze({accepted:false,reason:'NO_CHARACTER_STATE_REQUEST'});
    if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot))return Object.freeze({accepted:true,known:false,text:turkish?'Şu anki beden durumumu doğrulayamadığım için tahmin yürütmeyeceğim.':'I cannot verify my current body state, so I will not guess.'});
    if(asksWhyHeadShake){
      const record=snapshot.lastSpeechGesture;
      if(!record||!Number.isFinite(record.ageMs)||record.ageMs<0||record.ageMs>120000||!['shake-head-left','shake-head-right'].includes(record.gesture)||!['negative','correction'].includes(record.responseKind))return Object.freeze({accepted:true,known:false,kind:'gesture-reason',text:turkish?'Yakın zamandaki doğrulanmış konuşma hareketimde başımı iki yana salladığıma dair geçerli bir kayıt yok; neden uydurmayacağım.':'I do not have a current verified record that I shook my head in my recent spoken response, so I will not invent a reason.'});
      const text=record.responseKind==='negative'?(turkish?'Olumsuz yanıt verdiğimi beden diliyle açıkça göstermek için başımı iki yana salladım.':'I shook my head to make the negative response clear in my body language.'):(turkish?'Bilgiyi düzelttiğimi onay hareketiyle karıştırmamak için başımı iki yana salladım.':'I shook my head so the correction would not be mistaken for agreement.');
      return Object.freeze({accepted:true,known:true,kind:'gesture-reason',value:record.responseKind,text});
    }
    if(asksWhyShrug){
      const record=snapshot.lastSpeechGesture;
      if(!record||!Number.isFinite(record.ageMs)||record.ageMs<0||record.ageMs>120000||record.gesture!=='shrug'||record.responseKind!=='uncertainty')return Object.freeze({accepted:true,known:false,kind:'gesture-reason',text:turkish?'Yakın zamandaki doğrulanmış konuşma hareketimde belirsizlik nedeniyle omuz silktiğime dair geçerli bir kayıt yok; neden uydurmayacağım.':'I do not have a current verified record that I shrugged because of uncertainty in my recent spoken response, so I will not invent a reason.'});
      return Object.freeze({accepted:true,known:true,kind:'gesture-reason',value:'uncertainty',text:turkish?'Sonucun kesin olmadığını ve kanıtın yetersiz kaldığını beden diliyle göstermek için omuzlarımı silktim.':'I shrugged to show in my body language that the result was uncertain and the evidence was insufficient.'});
    }
    if(asksReducedMotion){
      if(typeof snapshot.reducedMotion!=='boolean')return Object.freeze({accepted:true,known:false,kind:'reduced-motion',text:turkish?'Tarayıcının hareket azaltma tercihini doğrulayamadığım için tahmin yürütmeyeceğim.':'I cannot verify the browser reduced-motion preference, so I will not guess.'});
      return Object.freeze({accepted:true,known:true,kind:'reduced-motion',value:snapshot.reducedMotion,text:snapshot.reducedMotion?(turkish?'Evet, hareket azaltma tercihi şu an açık; uzun animasyon dizilerini oynatmıyorum.':'Yes, reduced motion is enabled; I am not playing long animation sequences.'):(turkish?'Hayır, hareket azaltma tercihi şu an açık değil.':'No, reduced motion is not currently enabled.')});
    }
    if(asksListeningStatus){
      if(typeof snapshot.listeningActive!=='boolean')return Object.freeze({accepted:true,known:false,kind:'listening-status',text:turkish?'Mikrofon dinleme durumunu doğrulayamadığım için duyduğumu söylemeyeceğim.':'I cannot verify the microphone listening state, so I will not claim that I can hear you.'});
      return Object.freeze({accepted:true,known:true,kind:'listening-status',value:snapshot.listeningActive,text:snapshot.listeningActive?(turkish?'Evet; mikrofon dinleme oturumu şu an etkin ve seni dinliyorum.':'Yes; the microphone listening session is active and I am listening to you.'):(turkish?'Hayır; mikrofon dinleme oturumu şu an açık değil. Yazdığın mesajı okuyorum.':'No; the microphone listening session is not active. I am reading your typed message.')});
    }
    if(asksPoseSummary){
      const valid={headDirection:['left','right','center'],headTilt:['up','down','level'],bodyPosture:['forward','back','upright'],facialExpression:['smiling','neutral','concerned'],motionEnergy:['low','medium','high']};
      if(Object.entries(valid).some(([key,values])=>!values.includes(snapshot[key])))return Object.freeze({accepted:true,known:false,text:turkish?'Tam poz özetimi görünür rig kontrollerinden doğrulayamadığım için eksik parçaları uydurmayacağım.':'I cannot verify my complete pose summary from the visible rig controls, so I will not invent the missing parts.'});
      const tr={headDirection:{left:'başım sola dönük',right:'başım sağa dönük',center:'başım merkezde'},headTilt:{up:'yukarı eğik',down:'aşağı eğik',level:'düz'},bodyPosture:{forward:'gövdem öne eğik',back:'gövdem geriye yaslanmış',upright:'gövdem dik'},facialExpression:{smiling:'yüzüm gülümsüyor',neutral:'yüzüm sakin ve nötr',concerned:'yüzüm kaygılı ve dikkatli'},motionEnergy:{low:'hareket enerjim düşük',medium:'hareket enerjim orta',high:'hareket enerjim yüksek'}};
      const en={headDirection:{left:'my head is turned left',right:'my head is turned right',center:'my head is centered'},headTilt:{up:'tilted upward',down:'tilted downward',level:'level'},bodyPosture:{forward:'my body leans forward',back:'my body leans back',upright:'my body is upright'},facialExpression:{smiling:'I am smiling',neutral:'my expression is calm and neutral',concerned:'my expression is concerned and attentive'},motionEnergy:{low:'my movement energy is low',medium:'my movement energy is moderate',high:'my movement energy is high'}},copy=turkish?tr:en;
      const text=turkish?`${copy.bodyPosture[snapshot.bodyPosture]}; ${copy.headDirection[snapshot.headDirection]} ve ${copy.headTilt[snapshot.headTilt]}; ${copy.facialExpression[snapshot.facialExpression]}; ${copy.motionEnergy[snapshot.motionEnergy]}.`:`${copy.bodyPosture[snapshot.bodyPosture]}; ${copy.headDirection[snapshot.headDirection]} and ${copy.headTilt[snapshot.headTilt]}; ${copy.facialExpression[snapshot.facialExpression]}; ${copy.motionEnergy[snapshot.motionEnergy]}.`;
      return Object.freeze({accepted:true,known:true,kind:'pose-summary',value:Object.freeze({headDirection:snapshot.headDirection,headTilt:snapshot.headTilt,bodyPosture:snapshot.bodyPosture,facialExpression:snapshot.facialExpression,motionEnergy:snapshot.motionEnergy}),text});
    }
    if(asksHeadDirection){
      const copy={left:turkish?'Başım şu an sola dönük.':'My head is turned left right now.',right:turkish?'Başım şu an sağa dönük.':'My head is turned right right now.',center:turkish?'Başım şu an merkezde, sana dönük.':'My head is centered and facing you right now.'};
      if(!Object.hasOwn(copy,snapshot.headDirection))return Object.freeze({accepted:true,known:false,text:turkish?'Baş yönümü görünür rig pozundan doğrulayamadığım için tahmin yürütmeyeceğim.':'I cannot verify my head direction from the visible rig pose, so I will not guess.'});
      return Object.freeze({accepted:true,known:true,kind:'head-direction',value:snapshot.headDirection,text:copy[snapshot.headDirection]});
    }
    if(asksHeadTilt){
      const copy={up:turkish?'Başım şu an yukarı doğru eğik.':'My head is tilted upward right now.',down:turkish?'Başım şu an aşağı doğru eğik.':'My head is tilted downward right now.',level:turkish?'Başım şu an düz ve dengeli.':'My head is level right now.'};
      if(!Object.hasOwn(copy,snapshot.headTilt))return Object.freeze({accepted:true,known:false,text:turkish?'Baş eğimimi görünür rig pozundan doğrulayamadığım için tahmin yürütmeyeceğim.':'I cannot verify my head tilt from the visible rig pose, so I will not guess.'});
      return Object.freeze({accepted:true,known:true,kind:'head-tilt',value:snapshot.headTilt,text:copy[snapshot.headTilt]});
    }
    if(asksFacialExpression){
      const copy={smiling:turkish?'Evet, şu an gülümsüyorum.':'Yes, I am smiling right now.',neutral:turkish?'Şu an yüz ifadem sakin ve nötr.':'My expression is calm and neutral right now.',concerned:turkish?'Şu an yüz ifadem kaygılı ve dikkatli.':'My expression is concerned and attentive right now.'};
      if(!Object.hasOwn(copy,snapshot.facialExpression))return Object.freeze({accepted:true,known:false,text:turkish?'Yüz ifademi görünür rig kontrolünden doğrulayamadığım için tahmin yürütmeyeceğim.':'I cannot verify my facial expression from the visible rig control, so I will not guess.'});
      return Object.freeze({accepted:true,known:true,kind:'facial-expression',value:snapshot.facialExpression,text:copy[snapshot.facialExpression]});
    }
    if(asksBodyPosture){
      const copy={forward:turkish?'Şu an gövdem öne doğru eğik.':'My body is leaning forward right now.',back:turkish?'Şu an gövdem geriye doğru yaslanmış.':'My body is leaning back right now.',upright:turkish?'Şu an gövdem dik ve dengeli.':'My body is upright and balanced right now.'};
      if(!Object.hasOwn(copy,snapshot.bodyPosture))return Object.freeze({accepted:true,known:false,text:turkish?'Duruşumu görünür rig kontrolünden doğrulayamadığım için tahmin yürütmeyeceğim.':'I cannot verify my posture from the visible rig control, so I will not guess.'});
      return Object.freeze({accepted:true,known:true,kind:'body-posture',value:snapshot.bodyPosture,text:copy[snapshot.bodyPosture]});
    }
    if(asksMotionEnergy){
      const copy={low:turkish?'Şu an animasyon hareket enerjim düşük ve sakin.':'My animation movement energy is low and calm right now.',medium:turkish?'Şu an animasyon hareket enerjim orta düzeyde.':'My animation movement energy is moderate right now.',high:turkish?'Şu an animasyon hareket enerjim yüksek.':'My animation movement energy is high right now.'};
      if(!Object.hasOwn(copy,snapshot.motionEnergy))return Object.freeze({accepted:true,known:false,text:turkish?'Hareket enerjimi görünür rig kontrolünden doğrulayamadığım için tahmin yürütmeyeceğim.':'I cannot verify my movement energy from the visible rig control, so I will not guess.'});
      return Object.freeze({accepted:true,known:true,kind:'motion-energy',value:snapshot.motionEnergy,text:copy[snapshot.motionEnergy]});
    }
    if(asksSide){
      if(snapshot.gestureHands==='both')return Object.freeze({accepted:true,known:true,kind:'gesture-hands',value:'both',text:turkish?'Şu an iki elimi birlikte kullanıyorum.':'I am using both hands right now.'});
      if(snapshot.gestureHands==='none')return Object.freeze({accepted:true,known:true,kind:'gesture-hands',value:'none',text:turkish?'Şu an belirgin bir el hareketi kullanmıyorum; ellerim dinlenme pozunda.':'I am not using a distinct hand gesture right now; my hands are resting.'});
      const sideCopy={left:turkish?'Şu an sol kolumu kullanıyorum.':'I am using my left arm right now.',right:turkish?'Şu an sağ kolumu kullanıyorum.':'I am using my right arm right now.',center:turkish?'Şu an sağ veya sol tarafa ağırlık vermeyen merkezî bir pozdayım.':'I am in a centered pose without favoring either side.'};
      if(!Object.hasOwn(sideCopy,snapshot.gestureSide))return Object.freeze({accepted:true,known:false,text:turkish?'Hangi kolumu kullandığımı görünür pozdan doğrulayamadığım için tahmin yürütmeyeceğim.':'I cannot verify which arm I am using from the visible pose, so I will not guess.'});
      return Object.freeze({accepted:true,known:true,kind:'gesture-side',value:snapshot.gestureSide,text:sideCopy[snapshot.gestureSide]});
    }
    if(asksAudienceGaze){
      const targetCopy={audience:turkish?'Evet, şu an sana bakıyorum.':'Yes, I am looking at you right now.',thought:turkish?'Hayır; düşünürken bakışım kısa süre uzağa yönelmiş durumda.':'No; my gaze is briefly directed away while I think.',board:turkish?'Hayır; şu an tahtaya bakıyorum.':'No; I am looking at the board right now.',path:turkish?'Hayır; şu an yürüme yönüme bakıyorum.':'No; I am looking along my walking path right now.',palm:turkish?'Hayır; şu an sağ avucuma bakıyorum.':'No; I am looking at my right palm right now.','left-palm':turkish?'Hayır; şu an sol elime bakıyorum.':'No; I am looking at my left hand right now.'};
      if(!Object.hasOwn(targetCopy,snapshot.gaze))return Object.freeze({accepted:true,known:false,text:turkish?'Sana bakıp bakmadığımı doğrulanmış bakış hedefimden belirleyemediğim için tahmin yürütmeyeceğim.':'I cannot determine whether I am looking at you from my verified gaze target, so I will not guess.'});
      return Object.freeze({accepted:true,known:true,kind:'audience-gaze',value:snapshot.gaze==='audience',target:snapshot.gaze,text:targetCopy[snapshot.gaze]});
    }
    if(asksGaze){
      const gazeCopy={audience:turkish?'Sana bakıyorum.':'I am looking at you.',thought:turkish?'Düşünürken bakışımı kısa süre uzağa çevirdim.':'I briefly turned my gaze away while thinking.',board:turkish?'Tahtaya bakıyorum.':'I am looking at the board.',path:turkish?'Yürüme yönüme bakıyorum.':'I am looking along my walking path.',palm:turkish?'Sağ avucuma bakıyorum.':'I am looking at my right palm.','left-palm':turkish?'Sol elime bakıyorum.':'I am looking at my left hand.'};
      if(!Object.hasOwn(gazeCopy,snapshot.gaze))return Object.freeze({accepted:true,known:false,text:turkish?'Bakış yönümü doğrulayamadığım için tahmin yürütmeyeceğim.':'I cannot verify my gaze direction, so I will not guess.'});
      return Object.freeze({accepted:true,known:true,kind:'gaze',value:snapshot.gaze,text:gazeCopy[snapshot.gaze]});
    }
    const stateCopy={idle:turkish?'Şu an dinlenme pozundayım.':'I am in my resting pose.',listening:turkish?'Şu an seni dinliyorum.':'I am listening to you.',thinking:turkish?'Şu an yanıtı düşünüyorum.':'I am thinking about the answer.','preparing-voice':turkish?'Şu an konuşmaya hazırlanıyorum.':'I am preparing to speak.',presenting:turkish?'Şu an konuyu sunuyorum.':'I am presenting the topic.',speaking:turkish?'Şu an konuşuyorum.':'I am speaking.',laughing:turkish?'Şu an gülüyorum.':'I am laughing.',walking:turkish?'Şu an kısa bir yürüyüş yapıyorum.':'I am taking a short walk.',success:turkish?'Şu an tamamlanan sonucu onaylıyorum.':'I am acknowledging the completed result.',warning:turkish?'Şu an dikkat gerektiren bir durumu gösteriyorum.':'I am indicating a situation that needs attention.',error:turkish?'Şu an güvenli biçimde durmuş durumdayım.':'I am safely stopped.','voice-disabled':turkish?'Şu an sessiz dinlenme pozundayım.':'I am resting silently.','board-teaching':turkish?'Şu an tahtada anlatıyorum.':'I am teaching at the board.'};
    if(!Object.hasOwn(stateCopy,snapshot.state))return Object.freeze({accepted:true,known:false,text:turkish?'Şu anki hareketimi doğrulayamadığım için tahmin yürütmeyeceğim.':'I cannot verify my current action, so I will not guess.'});
    return Object.freeze({accepted:true,known:true,kind:'state',value:snapshot.state,text:stateCopy[snapshot.state]});
  }
  function academyRequestedShapeForText(text){
    if(typeof text!=='string'||!text.trim())return null;
    const normalized=text.trim().toLocaleLowerCase('tr-TR');
    if(/(?:altıgen(?:i|in)?|hexagon)/iu.test(normalized))return 'hexagon';
    if(/(?:üçgen(?:i|in)?|triangle)/iu.test(normalized))return 'triangle';
    if(/(?:dikdörtgen(?:i|in)?|rectangle)/iu.test(normalized))return 'rectangle';
    if(/(?:daire(?:yi|nin)?|circle)/iu.test(normalized))return 'circle';
    if(/(?:koordinat\s+eksen(?:leri|lerini|lerinin)?|coordinate\s+axes)/iu.test(normalized))return 'axes';
    if(/(?:^|\s)(?:ok|oku|okun)(?:\s|[.,!?]|$)|(?:the\s+)?arrow/iu.test(normalized))return 'arrow';
    return null;
  }
  function academyBoardRecallAnswerForText(text,lastBoardAction,language='tr-TR'){
    if(typeof text!=='string'||!text.trim())return Object.freeze({accepted:false,reason:'INVALID_BOARD_RECALL_TEXT'});
    const normalized=text.toLocaleLowerCase('tr-TR'),english=text.toLocaleLowerCase('en-US');
    const requestedShape=academyRequestedShapeForText(normalized);
    const asksShow=/(?:tahta(?:daki|nın üzerindeki)(?:ni)?|tahtadaki\s+(?:şekli|yazıyı|daireyi|üçgeni|dikdörtgeni|altıgeni|oku|koordinat\s+eksenlerini))\s+(?:bana\s+)?(?:göster|işaret\s+et)|(?:show|point to) (?:what|the\s+(?:circle|triangle|rectangle|hexagon|arrow|coordinate\s+axes)) (?:is\s+)?on (?:the )?(?:board|blackboard)/iu.test(normalized);
    const asksIdentity=/(?:tahtadaki|bu|son)\s+şeklin\s+(?:adı|ismi)\s+ne|(?:bu|tahtadaki)\s+(?:hangi|ne)\s+şekil|what (?:shape|is the shape) (?:is )?(?:this|that|on the board)|what is (?:this|that|the board) shape called/iu.test(normalized);
    const asksConfirmation=/(?:bu|tahtadaki)(?:\s+şekil)?\s+(?:bir\s+)?(?:daire|üçgen|dikdörtgen|altıgen|ok|koordinat\s+eksenleri)\s+m[ıiuü]/iu.test(normalized)||/is\s+(?:this|that)\s+an?\s+(?:circle|triangle|rectangle|hexagon|arrow)|is\s+the\s+board\s+shape\s+(?:an?\s+)?(?:circle|triangle|rectangle|hexagon|arrow|set\s+of\s+coordinate\s+axes)/iu.test(english);
    const asks=asksShow||asksIdentity||asksConfirmation||/(az önce|en son).*(?:tahta(?:ya|da)|çizdin|yazdın).*(?:ne|neyi)|tahta(?:ya|da)\s+(?:en son\s+)?ne\s+(?:çizdin|yazdın)|tahta(?:da|nın üzerinde)\s+(?:şu an\s+)?ne\s+var|what did you (?:just |last )?(?:draw|write) on (?:the )?board|what is (?:currently )?on (?:the )?(?:board|blackboard)/iu.test(normalized);
    if(!asks)return Object.freeze({accepted:false,reason:'NO_BOARD_RECALL_REQUEST'});
    const turkish=String(language).toLocaleLowerCase('en-US').startsWith('tr');
    const names=turkish?{circle:'daire',triangle:'üçgen',rectangle:'dikdörtgen',hexagon:'altıgen',arrow:'ok',axes:'koordinat eksenleri'}:{circle:'circle',triangle:'triangle',rectangle:'rectangle',hexagon:'hexagon',arrow:'arrow',axes:'coordinate axes'};
    if(!lastBoardAction||!['shape','text'].includes(lastBoardAction.kind)||typeof lastBoardAction.value!=='string'||!lastBoardAction.value)return Object.freeze({accepted:true,known:false,text:turkish?'Bu oturumda Academy tahtasına başarıyla uygulanmış bir işlem kaydım yok.':'I do not have a successfully applied Academy board action recorded in this session.'});
    if(asksIdentity&&lastBoardAction.kind!=='shape')return Object.freeze({accepted:true,known:false,kind:'shape-identity',text:turkish?'Tahtadaki doğrulanmış son içerik bir şekil değil; ona şekil adı vermeyeceğim.':'The last verified board content is not a shape, so I will not assign it a shape name.'});
    if(asksConfirmation){
      if(lastBoardAction.kind!=='shape'||requestedShape===null||!Object.hasOwn(names,lastBoardAction.value))return Object.freeze({accepted:true,known:false,kind:'shape-confirmation',text:turkish?'Karşılaştırabileceğim doğrulanmış bir tahta şekli yok; evet veya hayır diye tahmin etmeyeceğim.':'I do not have a verified board shape to compare, so I will not guess yes or no.'});
      const matches=requestedShape===lastBoardAction.value,actualName=names[lastBoardAction.value],requestedName=names[requestedShape];
      return Object.freeze({accepted:true,known:true,kind:'shape-confirmation',value:matches,requested:requestedShape,actual:lastBoardAction.value,text:matches?(turkish?`Evet, bu doğrulanmış şekil bir ${actualName}.`:`Yes, the verified shape is a ${actualName}.`):(turkish?`Hayır; bu doğrulanmış şekil ${requestedName} değil, ${actualName}.`:`No; the verified shape is not a ${requestedName}, it is a ${actualName}.`)});
    }
    if(requestedShape&&(lastBoardAction.kind!=='shape'||lastBoardAction.value!==requestedShape)){
      const actual=lastBoardAction.kind==='shape'&&Object.hasOwn(names,lastBoardAction.value)?lastBoardAction.value:null,actualName=actual?names[actual]:null,requestedName=names[requestedShape];
      const text=actualName?(turkish?`İstediğin şekil doğrulanmış tahta içeriğiyle uyuşmuyor; doğrulanmış son şekil ${actualName}. ${requestedName[0].toLocaleUpperCase('tr-TR')+requestedName.slice(1)} varmış gibi göstermeyeceğim.`:`The requested shape does not match the verified board content; the last verified shape is a ${actualName}. I will not pretend a ${requestedName} is on the board.`):(turkish?'İstediğin şekil doğrulanmış tahta içeriğiyle uyuşmuyor; tahtada varmış gibi göstermeyeceğim.':'The requested shape does not match the last verified board content, so I will not pretend it is on the board.');
      return Object.freeze({accepted:true,known:false,kind:'shape-mismatch',requested:requestedShape,actual,text});
    }
    if(lastBoardAction.kind==='text')return Object.freeze({accepted:true,known:true,kind:'text',value:lastBoardAction.value,text:asksShow?(turkish?`Tahtadaki doğrulanmış “${lastBoardAction.value}” yazısını gösteriyorum.`:`I am showing the verified “${lastBoardAction.value}” text on the board.`):(turkish?`En son Academy tahtasına “${lastBoardAction.value}” yazdım.`:`I last wrote “${lastBoardAction.value}” on the Academy board.`)});
    const name=names[lastBoardAction.value];
    if(!name)return Object.freeze({accepted:true,known:false,text:turkish?'Son tahta şekli doğrulanmış izin listesinde bulunmuyor.':'The last board shape is not in the verified allowlist.'});
    if(asksIdentity){
      const trIdentity={circle:'Bu doğrulanmış şekil bir dairedir.',triangle:'Bu doğrulanmış şekil bir üçgendir.',rectangle:'Bu doğrulanmış şekil bir dikdörtgendir.',hexagon:'Bu doğrulanmış şekil bir altıgendir.',arrow:'Bu doğrulanmış şekil bir oktur.',axes:'Bunlar doğrulanmış koordinat eksenleridir.'};
      return Object.freeze({accepted:true,known:true,kind:'shape-identity',value:lastBoardAction.value,text:turkish?trIdentity[lastBoardAction.value]:`The verified board shape is ${lastBoardAction.value==='axes'?'a set of coordinate axes':`a ${name}`}.`});
    }
    return Object.freeze({accepted:true,known:true,kind:'shape',value:lastBoardAction.value,text:asksShow?(turkish?`Tahtadaki doğrulanmış ${name} şeklini gösteriyorum.`:`I am showing the verified ${name} on the board.`):(turkish?`En son Academy tahtasına bir ${name} çizdim.`:`I last drew a ${name} on the Academy board.`)});
  }
  function academyBoardRepeatRequestForText(text,lastBoardAction,language='tr-TR'){
    if(typeof text!=='string'||!text.trim())return Object.freeze({accepted:false,reason:'INVALID_BOARD_REPEAT_TEXT'});
    const normalized=text.trim().toLocaleLowerCase('tr-TR');
    if(!/(?:onu|bunu|tahtadakini|son çizdiğini|son yazdığını).*(?:tekrar|yeniden).*(?:çiz|yaz|göster)|(?:tekrar|yeniden).*(?:onu|bunu|tahtadakini|son çizdiğini|son yazdığını).*(?:çiz|yaz|göster)|(?:draw|write|show) (?:that|it|the last one) again/iu.test(normalized))return Object.freeze({accepted:false,reason:'NO_BOARD_REPEAT_REQUEST'});
    const turkish=String(language).toLocaleLowerCase('en-US').startsWith('tr');
    if(!lastBoardAction||!['shape','text'].includes(lastBoardAction.kind)||typeof lastBoardAction.value!=='string'||!lastBoardAction.value)return Object.freeze({accepted:true,known:false,text:turkish?'Tekrarlayabileceğim doğrulanmış bir Academy tahta işlemim yok.':'I do not have a verified Academy board action that I can repeat.'});
    if(lastBoardAction.kind==='shape'&&!['circle','triangle','rectangle','hexagon','arrow','axes'].includes(lastBoardAction.value))return Object.freeze({accepted:true,known:false,text:turkish?'Son tahta şekli güvenli çizim listemde bulunmuyor.':'The last board shape is not in my safe drawing allowlist.'});
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
    const requestedShape=academyRequestedShapeForText(normalized);
    if((!large&&!small)||!/(?:bunu|onu|şekli|çizdiğini|altıgeni|üçgeni|dikdörtgeni|daireyi|tahtadaki\s+oku|koordinat\s+eksenlerini|draw|shape|it|hexagon|triangle|rectangle|circle|the\s+arrow|coordinate\s+axes)/iu.test(normalized))return Object.freeze({accepted:false,reason:'NO_BOARD_RESIZE_REQUEST'});
    const turkish=String(language).toLocaleLowerCase('en-US').startsWith('tr');
    if(!lastBoardAction||lastBoardAction.kind!=='shape'||!['circle','triangle','rectangle','hexagon','arrow','axes'].includes(lastBoardAction.value))return Object.freeze({accepted:true,known:false,text:turkish?'Boyutlandırabileceğim doğrulanmış bir tahta şekli yok.':'I do not have a verified board shape that I can resize.'});
    if(requestedShape!==null&&requestedShape!==lastBoardAction.value){
      const names=turkish?{circle:'daire',triangle:'üçgen',rectangle:'dikdörtgen',hexagon:'altıgen',arrow:'ok',axes:'koordinat eksenleri'}:{circle:'circle',triangle:'triangle',rectangle:'rectangle',hexagon:'hexagon',arrow:'arrow',axes:'coordinate axes'};
      return Object.freeze({accepted:true,known:false,kind:'shape-mismatch',requested:requestedShape,actual:lastBoardAction.value,text:turkish?`Boyutlandırma isteğindeki şekil tahtadaki doğrulanmış şekille uyuşmuyor; doğrulanmış şekil ${names[lastBoardAction.value]}. Başka bir şekilmiş gibi yeniden çizmeyeceğim.`:`The resize request does not match the verified board shape; the verified shape is a ${names[lastBoardAction.value]}. I will not redraw it as a different shape.`});
    }
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
    const requestedShape=academyRequestedShapeForText(normalized);
    if(!/(?:bu|tahtadaki|son) şekli (?:açıkla|anlat)|tahtadaki\s+(?:daireyi|üçgeni|dikdörtgeni|altıgeni|oku|koordinat\s+eksenlerini)\s+(?:açıkla|anlat)|(?:explain|describe) (?:this|the|that|last) (?:shape|circle|triangle|rectangle|hexagon|arrow|coordinate\s+axes)/iu.test(normalized))return Object.freeze({accepted:false,reason:'NO_BOARD_EXPLANATION_REQUEST'});
    const turkish=String(language).toLocaleLowerCase('en-US').startsWith('tr');
    if(!lastBoardAction||lastBoardAction.kind!=='shape'||!['circle','triangle','rectangle','hexagon','arrow','axes'].includes(lastBoardAction.value))return Object.freeze({accepted:true,known:false,text:turkish?'Açıklayabileceğim doğrulanmış bir Academy tahta şekli yok.':'I do not have a verified Academy board shape that I can explain.'});
    if(requestedShape!==null&&requestedShape!==lastBoardAction.value){
      const names=turkish?{circle:'daire',triangle:'üçgen',rectangle:'dikdörtgen',hexagon:'altıgen',arrow:'ok',axes:'koordinat eksenleri'}:{circle:'circle',triangle:'triangle',rectangle:'rectangle',hexagon:'hexagon',arrow:'arrow',axes:'coordinate axes'};
      return Object.freeze({accepted:true,known:false,kind:'shape-mismatch',requested:requestedShape,actual:lastBoardAction.value,text:turkish?`İstediğin şekil tahtadaki doğrulanmış şekille uyuşmuyor; doğrulanmış şekil ${names[lastBoardAction.value]}. Başka bir şekli açıklamayacağım.`:`The requested shape does not match the verified board shape; the verified shape is a ${names[lastBoardAction.value]}. I will not explain a different shape.`});
    }
    const explanations=turkish?{
      circle:'Bu bir dairedir: merkezi çevreleyen kesintisiz bir eğrisi vardır ve köşesi yoktur.',triangle:'Bu bir üçgendir: üç kenarı ve üç köşesi vardır.',rectangle:'Bu bir dikdörtgendir: karşılıklı kenarları eşit ve paralel olan dört dik açılı bir şekildir.',hexagon:'Bu bir altıgendir: altı düz kenarı ve altı köşesi olan kapalı bir çokgendir.',arrow:'Bu bir oktur: gövdesi bir doğrultuyu, uç kısmı ise yönü gösterir.',axes:'Bunlar koordinat eksenleridir: yatay ve düşey doğrultular bir referans sistemi oluşturur.'
    }:{
      circle:'This is a circle: it has one continuous curve around its centre and no corners.',triangle:'This is a triangle: it has three sides and three corners.',rectangle:'This is a rectangle: it has four right angles with opposite sides equal and parallel.',hexagon:'This is a hexagon: it is a closed polygon with six straight sides and six corners.',arrow:'This is an arrow: its shaft establishes a line and its head indicates direction.',axes:'These are coordinate axes: the horizontal and vertical directions form a reference system.'
    };
    return Object.freeze({accepted:true,known:true,shape:lastBoardAction.value,text:explanations[lastBoardAction.value]});
  }
  function academyBoardShapePropertyAnswerForText(text,lastBoardAction,language='tr-TR'){
    if(typeof text!=='string'||!text.trim())return Object.freeze({accepted:false,reason:'INVALID_BOARD_PROPERTY_TEXT'});
    const normalized=text.trim().toLocaleLowerCase('tr-TR');
    const requestedShape=academyRequestedShapeForText(normalized);
    const asksSides=/(?:tahtadaki|bu|son)\s+(?:şeklin|çokgenin|üçgenin|dikdörtgenin|altıgenin|dairenin).*kaç\s+kenar|how many sides (?:does|do|are|has).*(?:this|that|the|board)|(?:this|that|the) (?:shape|polygon|circle|triangle|rectangle|hexagon).*how many sides/iu.test(normalized);
    const asksCorners=/(?:tahtadaki|bu|son)\s+(?:şeklin|dairenin|çokgenin|üçgenin|dikdörtgenin|altıgenin).*kaç\s+(?:köşe|köşesi)|how many corners (?:does|do|are|has).*(?:this|that|the|board)|(?:this|that|the) (?:shape|circle|polygon|triangle|rectangle|hexagon).*how many corners/iu.test(normalized);
    if(!asksSides&&!asksCorners)return Object.freeze({accepted:false,reason:'NO_BOARD_PROPERTY_REQUEST'});
    const turkish=String(language).toLocaleLowerCase('en-US').startsWith('tr');
    const shape=lastBoardAction?.kind==='shape'?lastBoardAction.value:null;
    if(requestedShape!==null&&requestedShape!==shape){
      const names=turkish?{circle:'daire',triangle:'üçgen',rectangle:'dikdörtgen',hexagon:'altıgen'}:{circle:'circle',triangle:'triangle',rectangle:'rectangle',hexagon:'hexagon'},actualName=names[shape];
      return Object.freeze({accepted:true,known:false,kind:'shape-mismatch',requested:requestedShape,actual:Object.hasOwn(names,shape)?shape:null,text:actualName?(turkish?`Sorudaki şekil tahtadaki doğrulanmış şekille uyuşmuyor; tahtadaki şekil ${actualName}. Başka bir şeklin özelliğini buna aitmiş gibi söylemeyeceğim.`:`The shape in the question does not match the verified board shape; the board shows a ${actualName}. I will not attribute another shape's property to it.`):(turkish?'Sorudaki şekil doğrulanmış tahta içeriğiyle uyuşmuyor; özellik tahmin etmeyeceğim.':'The shape in the question does not match the verified board content, so I will not guess a property.')});
    }
    const properties={circle:Object.freeze({sides:0,corners:0}),triangle:Object.freeze({sides:3,corners:3}),rectangle:Object.freeze({sides:4,corners:4}),hexagon:Object.freeze({sides:6,corners:6})},property=asksCorners?'corners':'sides',value=properties[shape]?.[property];
    if(!Number.isInteger(value))return Object.freeze({accepted:true,known:false,text:turkish?'Bu soruyu yanıtlayabileceğim doğrulanmış bir tahta şekli yok; şekil özelliğini tahmin etmeyeceğim.':'I do not have a verified board shape for this question, so I will not guess its property.'});
    const names=turkish?{circle:'dairenin',triangle:'üçgenin',rectangle:'dikdörtgenin',hexagon:'altıgenin'}:{circle:'circle',triangle:'triangle',rectangle:'rectangle',hexagon:'hexagon'},unit=turkish?(property==='corners'?'köşesi':'kenarı'):(property==='corners'?'corners':'sides');
    return Object.freeze({accepted:true,known:true,shape,property,value,text:turkish?`Tahtadaki doğrulanmış ${names[shape]} ${value} ${unit} vardır.`:`The verified ${names[shape]} on the board has ${value} ${unit}.`});
  }
  function academyBoardShapePropertyReasonForText(text,lastProperty,language='tr-TR'){
    if(typeof text!=='string'||!text.trim())return Object.freeze({accepted:false,reason:'INVALID_BOARD_PROPERTY_REASON_TEXT'});
    if(!/^(?:neden|niçin|neden\s+(?:öyle|bu\s+cevap)|why|why\s+is\s+that)[?!. ]*$/iu.test(text.trim()))return Object.freeze({accepted:false,reason:'NO_BOARD_PROPERTY_REASON_REQUEST'});
    const turkish=String(language).toLocaleLowerCase('en-US').startsWith('tr'),key=`${lastProperty?.shape||''}:${lastProperty?.property||''}:${lastProperty?.value}`;
    const reasons=turkish?{
      'circle:sides:0':'Çünkü dairenin sınırı düz kenarlardan değil, kesintisiz bir eğriden oluşur.','circle:corners:0':'Çünkü dairenin kesintisiz eğrisi üzerinde düz kenarların birleştiği bir köşe yoktur.','triangle:sides:3':'Çünkü üçgenin kapalı sınırı üç düz kenardan oluşur.','triangle:corners:3':'Çünkü üçgenin üç kenarı üç ayrı birleşim noktasında buluşur.','rectangle:sides:4':'Çünkü dikdörtgenin kapalı sınırını dört düz kenar oluşturur.','rectangle:corners:4':'Çünkü dikdörtgenin dört kenarı dört ayrı dik açılı köşede birleşir.','hexagon:sides:6':'Çünkü altıgenin kapalı sınırı altı düz kenarın uç uca birleşmesiyle oluşur.','hexagon:corners:6':'Çünkü altıgenin altı kenarı altı ayrı birleşim noktasında buluşur.'
    }:{
      'circle:sides:0':'Because a circle is bounded by one continuous curve rather than straight sides.','circle:corners:0':'Because no straight sides meet to form a corner on the circle’s continuous curve.','triangle:sides:3':'Because a triangle has a closed boundary made from three straight sides.','triangle:corners:3':'Because the triangle’s three sides meet at three distinct vertices.','rectangle:sides:4':'Because four straight sides form the rectangle’s closed boundary.','rectangle:corners:4':'Because the rectangle’s four sides meet at four distinct right-angled corners.','hexagon:sides:6':'Because a hexagon has a closed boundary formed by six straight sides joined end to end.','hexagon:corners:6':'Because the hexagon’s six sides meet at six distinct vertices.'
    },reason=reasons[key];
    if(!reason)return Object.freeze({accepted:true,known:false,text:turkish?'Gerekçelendirebileceğim doğrulanmış bir tahta özelliği kaydım yok; neden uydurmayacağım.':'I do not have a verified board-property record to explain, so I will not invent a reason.'});
    return Object.freeze({accepted:true,known:true,shape:lastProperty.shape,property:lastProperty.property,value:lastProperty.value,text:reason});
  }
  function academyBoardShapeCheckForText(text,lastBoardAction,language='tr-TR',variant=0){
    if(typeof text!=='string'||!text.trim())return Object.freeze({accepted:false,reason:'INVALID_BOARD_CHECK_TEXT'});
    if(!/(?:bu|tahtadaki|son) şekil(?:le| hakkında).*(?:bana )?soru sor|ask me (?:a )?question about (?:this|the|that|last) shape/iu.test(text.trim()))return Object.freeze({accepted:false,reason:'NO_BOARD_CHECK_REQUEST'});
    if(!Number.isInteger(variant)||variant<0||variant>2)return Object.freeze({accepted:false,reason:'INVALID_BOARD_CHECK_VARIANT'});
    const turkish=String(language).toLocaleLowerCase('en-US').startsWith('tr'),shape=lastBoardAction?.kind==='shape'?lastBoardAction.value:null;
    const checks=turkish?{
      circle:[['Dairenin kaç köşesi vardır?','Tahtadaki dairenin köşe sayısı nedir?','Bu dairenin köşelerini sayarsan kaç tane bulursun?'],'zero'],triangle:[['Üçgenin kaç kenarı vardır?','Tahtadaki üçgenin kenar sayısı nedir?','Bu üçgeni oluşturan kaç kenar görüyorsun?'],'three'],rectangle:[['Dikdörtgenin kaç dik açısı vardır?','Tahtadaki dikdörtgende kaç dik açı görüyorsun?','Bu dikdörtgenin dik açılarını sayarsan sonuç kaç olur?'],'four'],hexagon:[['Altıgenin kaç kenarı vardır?','Tahtadaki altıgenin kenar sayısı nedir?','Bu altıgeni oluşturan kaç düz kenar görüyorsun?'],'six'],arrow:[['Okun uç kısmı neyi gösterir?','Ok başı hangi bilgiyi gösterir?','Bir okun uç kısmından neyi anlarız?'],'direction'],axes:[['Koordinat eksenleri kaç temel doğrultu gösterir?','Yatay ve düşey eksenler birlikte kaç temel doğrultu oluşturur?','Tahtadaki eksenlerde kaç ana doğrultu vardır?'],'two']
    }:{
      circle:[['How many corners does a circle have?','What is the number of corners in the circle on the board?','If you count this circle’s corners, how many do you find?'],'zero'],triangle:[['How many sides does a triangle have?','What is the side count of the triangle on the board?','How many sides form this triangle?'],'three'],rectangle:[['How many right angles does a rectangle have?','How many right angles do you see in the rectangle on the board?','If you count this rectangle’s right angles, what is the total?'],'four'],hexagon:[['How many sides does a hexagon have?','What is the side count of the hexagon on the board?','How many straight sides form this hexagon?'],'six'],arrow:[['What does the head of an arrow indicate?','What information does an arrowhead show?','What do we learn from the pointed end of an arrow?'],'direction'],axes:[['How many primary directions do coordinate axes show?','Together, how many primary directions do horizontal and vertical axes form?','How many main directions are shown by the axes on the board?'],'two']
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
    if(typeof text!=='string'||!text.trim()||!check||!['circle','triangle','rectangle','hexagon','arrow','axes'].includes(check.shape)||!['zero','two','three','four','six','direction'].includes(check.expected))return Object.freeze({accepted:false,reason:'INVALID_BOARD_CHECK_ANSWER'});
    const normalized=text.trim().toLocaleLowerCase('tr-TR'),turkish=String(language).toLocaleLowerCase('en-US').startsWith('tr');
    if(/^(?:geç|atla|iptal|bilmiyorum|skip|cancel|i don't know)[.! ]*$/iu.test(normalized))return Object.freeze({accepted:true,cancelled:true,text:turkish?'Soruyu geçiyorum; tahta bağlamını koruyorum.':'I am skipping the question and keeping the board context.'});
    const bounded=values=>new RegExp(`(?:^|\\s)(?:${values})(?=$|\\s|[.!?,;:])`,'iu');
    const patterns={zero:bounded('0|sıfır|zero|none|hiç'),two:bounded('2|iki|two'),three:bounded('3|üç|three'),four:bounded('4|dört|four'),six:bounded('6|altı|six'),direction:bounded('yön|yönü|doğrultu|direction|heading')},correct=patterns[check.expected].test(normalized),retryAvailable=!correct&&(!Number.isInteger(check.attempts)||check.attempts<1);
    const correction=turkish?{zero:'Dairenin köşesi yoktur.',two:'Koordinat eksenleri iki temel doğrultu gösterir.',three:'Üçgenin üç kenarı vardır.',four:'Dikdörtgenin dört dik açısı vardır.',six:'Altıgenin altı kenarı vardır.',direction:'Okun uç kısmı yönü gösterir.'}:{zero:'A circle has no corners.',two:'Coordinate axes show two primary directions.',three:'A triangle has three sides.',four:'A rectangle has four right angles.',six:'A hexagon has six sides.',direction:'The head of an arrow indicates direction.'};
    const recovered=correct&&Number.isInteger(check.attempts)&&check.attempts>0;
    return Object.freeze({accepted:true,correct,...(recovered?{recovered:true}:{}),...(!correct?{retry:retryAvailable,completed:!retryAvailable}:{}),text:correct?(recovered?(turkish?'Doğru. İkinci denemende cevabını düzelttin; tahtadaki şekille uyuşuyor.':'Correct. You revised your answer on the second attempt; it matches the shape on the board.'):(turkish?'Doğru. Cevabın tahtadaki şekille uyuşuyor.':'Correct. Your answer matches the shape on the board.')):(retryAvailable?(turkish?'Bu cevap doğrulanmış şekil özelliğiyle uyuşmuyor. Doğru cevabı açıklamadan bir kez daha denemeni istiyorum.':'That answer does not match the verified shape property. Please try once more before I reveal the correct answer.'):(turkish?`Bu deneme de doğrulanmış şekil özelliğiyle uyuşmuyor. Doğru bilgi: ${correction[check.expected]} Soruyu burada kapatıyorum.`:`This attempt also does not match the verified shape property. The correct fact is: ${correction[check.expected]} I am closing this question.`))});
  }
  function academyBoardShapeCheckRevealForText(text,check,language='tr-TR'){
    if(typeof text!=='string'||!text.trim())return Object.freeze({accepted:false,reason:'INVALID_BOARD_CHECK_REVEAL_TEXT'});
    const normalized=text.trim().toLocaleLowerCase('tr-TR');
    if(!/^(?:(?:doğru\s+)?cevab[ıi](?:\s+(?:söyle|açıkla|ver|nedir))?|cevap\s+ne|(?:tell|show|give)\s+(?:me\s+)?the\s+(?:correct\s+)?answer|what(?:'s|\s+is)\s+the\s+(?:correct\s+)?answer)[?!. ]*$/iu.test(normalized))return Object.freeze({accepted:false,reason:'NO_BOARD_CHECK_REVEAL_REQUEST'});
    const expected=['zero','two','three','four','six','direction'].includes(check?.expected)?check.expected:null,turkish=String(language).toLocaleLowerCase('en-US').startsWith('tr');
    if(!expected)return Object.freeze({accepted:true,known:false,text:turkish?'Açıklayabileceğim doğrulanmış ve açık bir şekil sorusu yok.':'I do not have a verified open shape question whose answer I can explain.'});
    const facts=turkish?{zero:'Doğru cevap: Dairenin köşesi yoktur.',two:'Doğru cevap: Koordinat eksenleri iki temel doğrultu gösterir.',three:'Doğru cevap: Üçgenin üç kenarı vardır.',four:'Doğru cevap: Dikdörtgenin dört dik açısı vardır.',six:'Doğru cevap: Altıgenin altı kenarı vardır.',direction:'Doğru cevap: Okun uç kısmı yönü gösterir.'}:{zero:'Correct answer: A circle has no corners.',two:'Correct answer: Coordinate axes show two primary directions.',three:'Correct answer: A triangle has three sides.',four:'Correct answer: A rectangle has four right angles.',six:'Correct answer: A hexagon has six sides.',direction:'Correct answer: The head of an arrow indicates direction.'};
    return Object.freeze({accepted:true,known:true,revealed:true,completed:true,text:`${facts[expected]} ${turkish?'Soruyu burada kapatıyorum.':'I am closing the question here.'}`});
  }
  function academyBoardShapeCheckReasonForText(text,check,language='tr-TR'){
    if(typeof text!=='string'||!text.trim())return Object.freeze({accepted:false,reason:'INVALID_BOARD_CHECK_REASON_TEXT'});
    if(!/^(?:neden|niçin|neden\s+(?:öyle|bu\s+cevap)|why|why\s+is\s+that)[?!. ]*$/iu.test(text.trim()))return Object.freeze({accepted:false,reason:'NO_BOARD_CHECK_REASON_REQUEST'});
    const expected=['zero','two','three','four','six','direction'].includes(check?.expected)?check.expected:null,turkish=String(language).toLocaleLowerCase('en-US').startsWith('tr');
    if(!expected)return Object.freeze({accepted:true,known:false,text:turkish?'Gerekçelendirebileceğim doğrulanmış bir önceki şekil cevabı yok.':'I do not have a verified previous shape answer that I can explain.'});
    if(check.reasonAvailable!==true)return Object.freeze({accepted:true,known:false,pending:true,text:turkish?'Önce soruyu cevaplamanı veya doğru cevabı açıklamamı istemeni bekliyorum. Sonra nedenini birlikte inceleyebiliriz.':'First answer the question or ask me to reveal the correct answer. Then we can examine why together.'});
    const reasons=turkish?{zero:'Çünkü dairenin çevresi kesintisiz bir eğridir; düz kenarların birleştiği bir köşe oluşturmaz.',two:'Çünkü biri yatay, diğeri düşey olan iki eksen iki temel doğrultuyu gösterir.',three:'Çünkü üçgenin kapalı sınırı üç düz kenardan oluşur.',four:'Çünkü dikdörtgenin dört köşesinin her biri dik açıdır.',six:'Çünkü altıgenin kapalı sınırı altı düz kenarın uç uca birleşmesiyle oluşur.',direction:'Çünkü okun sivri uç kısmı, gövdesinin hangi tarafa yöneldiğini ayırt etmemizi sağlar.'}:{zero:'Because a circle has one continuous curved boundary and no corner formed by meeting straight sides.',two:'Because the horizontal and vertical axes show two primary directions.',three:'Because a triangle has a closed boundary made from three straight sides.',four:'Because each of a rectangle’s four corners is a right angle.',six:'Because a hexagon has a closed boundary formed by six straight sides joined end to end.',direction:'Because the pointed head distinguishes the direction in which the arrow shaft is oriented.'};
    return Object.freeze({accepted:true,known:true,reasoned:true,shape:check.shape||null,expected,text:reasons[expected]});
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
    const shape=['circle','triangle','rectangle','hexagon','arrow','axes'].includes(check?.shape)?check.shape:null,turkish=String(language).toLocaleLowerCase('en-US').startsWith('tr');
    if(!shape)return Object.freeze({accepted:true,known:false,text:turkish?'İpucu verebileceğim doğrulanmış ve açık bir şekil sorusu yok.':'I do not have a verified open shape question for which I can give a hint.'});
    const used=Number.isInteger(check?.hintsUsed)&&check.hintsUsed>=0?check.hintsUsed:0;
    if(used>=2)return Object.freeze({accepted:true,known:true,hint:false,exhausted:true,shape,text:turkish?'İki doğrulanmış ipucu verdim. Şimdi cevaplayabilir veya soruyu geçebilirsin.':'I have given two verified hints. You can answer now or skip the question.'});
    const hints=turkish?{circle:['İpucu: Şeklin çevresini takip et ve keskin birleşim noktalarını say.','İkinci ipucu: Yuvarlak çizgide yön değiştiren keskin bir nokta görüp görmediğine bak.'],triangle:['İpucu: Şekli oluşturan düz kenarları birer kez takip et.','İkinci ipucu: Başlangıç noktasına dönene kadar karşılaştığın düz parçaları izle.'],rectangle:['İpucu: Köşelerde oluşan açı türüne odaklan ve bu köşeleri say.','İkinci ipucu: Her dönüşün kare bir köşe oluşturup oluşturmadığına bak.'],hexagon:['İpucu: Kapalı şeklin çevresindeki düz parçaları birer kez say.','İkinci ipucu: Üst ve alt kenarlarla birlikte dört eğik kenarı da hesaba kat.'],arrow:['İpucu: Okun sivri uç kısmına ve işaret ettiği tarafa bak.','İkinci ipucu: Ok gövdesinin hangi tarafa doğru uzandığını düşün.'],axes:['İpucu: Yatay ve düşey çizgileri ayrı doğrultular olarak düşün.','İkinci ipucu: Biri yatay, biri düşey olan çizgileri ayrı ayrı takip et.']}:{circle:['Hint: Trace the boundary and count any sharp meeting points.','Second hint: Look for any sharp point where the round line changes direction.'],triangle:['Hint: Follow each straight side that forms the shape once.','Second hint: Track the straight segments until you return to the starting point.'],rectangle:['Hint: Focus on the type of angle at each corner and count those corners.','Second hint: Check whether each turn forms a square corner.'],hexagon:['Hint: Count each straight segment around the closed shape once.','Second hint: Include the top and bottom sides together with the four sloping sides.'],arrow:['Hint: Look at the pointed end of the arrow and the way it is facing.','Second hint: Think about which way the arrow shaft extends.'],axes:['Hint: Treat the horizontal and vertical lines as separate directions.','Second hint: Follow the horizontal line and the vertical line separately.']};
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
      'show-palm':'avucumu açıp gösterdim','show-right-hand':'sağ avucumu gösterdim','raise-left-hand':'sol elimi kaldırdım','show-both-hands':'iki elimi aynı anda gösterdim',wave:'sana el salladım','look-left':'başımı sola çevirdim','look-right':'başımı sağa çevirdim','shake-head':'başımı iki yana salladım',shrug:'omuzlarımı silktim',nod:'başımı eğdim',smile:'gülümsedim',laugh:'kısa bir kahkaha attım',walk:'kısa bir yürüyüş yaptım','point-board':'tahtayı işaret ettim','show-listening':'seni dinlediğimi gösterdim'
    }:{
      'show-palm':'opened and showed my palm','show-right-hand':'showed my right palm','raise-left-hand':'raised my left hand','show-both-hands':'showed both hands at once',wave:'waved to you','look-left':'turned my head left','look-right':'turned my head right','shake-head':'shook my head from side to side',shrug:'shrugged my shoulders',nod:'nodded',smile:'smiled',laugh:'gave a brief laugh',walk:'took a short walk','point-board':'pointed to the board','show-listening':'showed that I was listening'
    };
    const known=actions.filter(action=>Object.hasOwn(labels,action));
    if(known.length<2)return Object.freeze({accepted:true,known:false,text:turkish?'Sıralı yanıt için henüz iki doğrulanmış hareket kaydım yok.':'I do not yet have two verified movements recorded for a sequence answer.'});
    const answer=turkish?`Önce ${labels[known[0]]}; ardından ${labels[known[1]]}.`:`First I ${labels[known[0]]}; then I ${labels[known[1]]}.`;
    return Object.freeze({accepted:true,known:true,actions:Object.freeze(known),text:answer});
  }
  function gestureHistoryReplayForText(text,history,language='tr-TR'){
    if(typeof text!=='string'||!text.trim())return Object.freeze({accepted:false,reason:'INVALID_HISTORY_REPLAY_TEXT'});
    const normalized=text.toLocaleLowerCase('tr-TR');
    if(!/(?:son\s+iki\s+hareketini|önceki\s+iki\s+hareketini|aynı\s+ikisini)\s+(?:(?:tekrar|yeniden|bir\s+daha)\s+)?yap|repeat\s+(?:(?:your\s+)?last\s+two\s+movements|the\s+same\s+two)/iu.test(normalized))return Object.freeze({accepted:false,reason:'NO_GESTURE_HISTORY_REPLAY_REQUEST'});
    const turkish=String(language).toLocaleLowerCase('en-US').startsWith('tr');
    const actions=Array.isArray(history)?history.slice(-2):[];
    const replay=gestureSequenceForRequest('verified-history-sequence',{actions});
    if(!replay.accepted)return Object.freeze({accepted:true,known:false,reason:replay.reason,text:turkish?'Tekrar etmek için iki doğrulanmış ve animasyonu desteklenen hareket kaydım yok. Hareket uydurmayacağım.':'I do not have two verified, animation-supported movements to repeat. I will not invent any movement.'});
    return Object.freeze({accepted:true,known:true,action:'verified-history-sequence',actions:replay.actions,text:turkish?'Doğrulanmış son iki hareketimi aynı sırayla yeniden yapıyorum.':'I am repeating my last two verified movements in the same order.'});
  }
  function gestureStopRequestForText(text,language='tr-TR'){
    if(typeof text!=='string'||!text.trim())return Object.freeze({accepted:false,reason:'INVALID_STOP_TEXT'});
    const normalized=text.trim().toLocaleLowerCase('tr-TR');
    if(!/^(?:sinbad[,\s]+)?(?:dur|hareketi\s+durdur|hareket\s+etme|elini\s+indir|nötr\s+poza\s+dön|stop\s+moving|stop\s+the\s+movement|lower\s+your\s+hand|return\s+to\s+neutral)[.! ]*$/iu.test(normalized))return Object.freeze({accepted:false,reason:'NO_GESTURE_STOP_REQUEST'});
    const turkish=String(language).toLocaleLowerCase('en-US').startsWith('tr');
    return Object.freeze({accepted:true,action:'stop-motion',text:turkish?'Hareketi durdurdum ve nötr poza döndüm.':'I stopped the movement and returned to a neutral pose.'});
  }
  function reducedMotionCommandForText(text,language='tr-TR'){
    if(typeof text!=='string'||!text.trim())return Object.freeze({accepted:false,reason:'INVALID_REDUCED_MOTION_COMMAND'});
    const normalized=text.trim().toLocaleLowerCase('tr-TR'),turkish=String(language).toLocaleLowerCase('en-US').startsWith('tr');
    if(/^(?:sinbad[,\s]+)?(?:hareketleri|animasyonları)\s+(?:azalt|sadeleştir)[.! ]*$|^(?:enable|turn on) reduced motion[.! ]*$/iu.test(normalized))return Object.freeze({accepted:true,enabled:true,text:turkish?'Hareket azaltma tercihini açtım; uzun ve tekrarlı animasyonları oynatmayacağım.':'I enabled reduced motion; I will not play long or repetitive animations.'});
    if(/^(?:sinbad[,\s]+)?(?:normal|tam)\s+hareket(?:lere|e)\s+dön[.! ]*$|^(?:disable|turn off) reduced motion[.! ]*$/iu.test(normalized))return Object.freeze({accepted:true,enabled:false,text:turkish?'Uygulama içindeki hareket azaltma tercihini kapattım.':'I disabled the in-app reduced-motion preference.'});
    return Object.freeze({accepted:false,reason:'NO_REDUCED_MOTION_COMMAND'});
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
        {at:240,gesture:'show-left-palm',gaze:'left-palm',emotion:'attentive',energy:.38},
        {at:760,gesture:'show-left-palm',gaze:'audience',emotion:'warm',energy:.32}
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
      shrug:[
        {at:0,gesture:'rest',gaze:'audience',emotion:'curious',energy:.22},
        {at:220,gesture:'shrug',gaze:'audience',emotion:'curious',energy:.38},
        {at:760,gesture:'shrug',gaze:'thought',emotion:'curious',energy:.34},
        {at:1180,gesture:'rest',gaze:'audience',emotion:'warm',energy:.24}
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
    if(action==='verified-history-sequence'){
      if(!Array.isArray(actions)||actions.length!==2||!actions.every(item=>typeof item==='string'&&Object.hasOwn(sequences,item)))return Object.freeze({accepted:false,reason:'INVALID_VERIFIED_HISTORY_SEQUENCE'});
      const cues=[];let offset=0;
      actions.forEach(item=>{
        const source=sequences[item];
        source.forEach((cue,cueIndex)=>cues.push(Object.freeze({...cue,at:cue.at+offset,...(cueIndex===0?{actionStart:item}:{})})));
        offset+=source.at(-1).at+360;
      });
      return Object.freeze({accepted:true,cues:Object.freeze(cues),duration:cues.at(-1).at,actions:Object.freeze([...actions])});
    }
    if(!Object.hasOwn(sequences,action))return Object.freeze({accepted:false,reason:'NO_GESTURE_SEQUENCE'});
    const cues=sequences[action].map(cue=>Object.freeze(cue));
    return Object.freeze({accepted:true,cues:Object.freeze(cues),duration:cues.at(-1).at});
  }
  const GESTURE_SEQUENCE_STYLES=Object.freeze([
    Object.freeze({variantId:'direct',lead:null,leadMs:0,timeScale:1,motionProfile:'crisp'}),
    Object.freeze({variantId:'attentive',lead:Object.freeze({gesture:'listen-orient',gaze:'audience',emotion:'attentive',energy:.2}),leadMs:160,timeScale:.92,motionProfile:'gentle'}),
    Object.freeze({variantId:'considered',lead:Object.freeze({gesture:'hold',gaze:'thought',emotion:'attentive',energy:.2}),leadMs:220,timeScale:1.08,motionProfile:'deliberate'})
  ]);
  function createGestureSequenceDirector(options={}){
    const entropy=typeof options.entropy==='function'?options.entropy:defaultEntropy;
    const remaining=new Map(),last=new Map();
    const select=(action,sequenceOptions={})=>{
      const base=gestureSequenceForRequest(action,sequenceOptions);
      if(!base.accepted)return base;
      const key=['two-hand-sequence','verified-history-sequence'].includes(action)?`${action}:${(sequenceOptions.actions||[]).join('+')}`:action;
      let choices=remaining.get(key)||[];
      if(!choices.length)choices=GESTURE_SEQUENCE_STYLES.filter(style=>style.variantId!==last.get(key));
      const sample=Number(entropy());
      if(!Number.isFinite(sample)||sample<0||sample>=1)return Object.freeze({accepted:false,reason:'INVALID_ENTROPY'});
      const index=Math.min(choices.length-1,Math.floor(sample*choices.length));
      const [style]=choices.splice(index,1);remaining.set(key,choices);last.set(key,style.variantId);
      const shifted=base.cues.map(cue=>Object.freeze({...cue,at:Math.round(cue.at*style.timeScale)+style.leadMs,motionProfile:style.motionProfile}));
      const cues=style.lead
        ?[Object.freeze({at:0,...style.lead,motionProfile:style.motionProfile}),...shifted]
        :shifted;
      return Object.freeze({accepted:true,variantId:style.variantId,cues:Object.freeze(cues),duration:cues.at(-1).at,...(base.actions?{actions:base.actions}:{})});
    };
    const reset=()=>{remaining.clear();last.clear();};
    return Object.freeze({select,reset});
  }
  function gazeTransitionForCue(cue,{reducedMotion=false}={}){
    if(!cue||typeof cue!=='object')return Object.freeze({accepted:false,reason:'INVALID_GAZE_CUE'});
    const target=['audience','thought','board','path','palm','left-palm'].includes(cue.gaze)?cue.gaze:'audience';
    let cues;
    if(reducedMotion)cues=[Object.freeze({at:0,gaze:target})];
    else if(cue.gesture==='show-palm')cues=[Object.freeze({at:0,gaze:'palm'}),Object.freeze({at:520,gaze:'audience'})];
    else if(['show-left-palm','raise-left'].includes(cue.gesture))cues=[Object.freeze({at:0,gaze:'left-palm'}),Object.freeze({at:520,gaze:'audience'})];
    else if(cue.gesture==='show-both-hands')cues=[Object.freeze({at:0,gaze:'left-palm'}),Object.freeze({at:360,gaze:'palm'}),Object.freeze({at:720,gaze:'audience'})];
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
  return Object.freeze({PERFORMANCES,CUE_SEQUENCES,LISTENING_ACTIVITY_CUES,LISTENING_MEANING_POOLS,THINKING_STAGE_CUES,IMPROVISATION_POOLS,MOTION_PROFILES,IDLE_MICRO_CUES,GESTURE_SEQUENCE_STYLES,GESTURE_CAPABILITIES,cueAt,speechModeForDecision,speechEmphasisForBoundary,speechCueForBoundary,speechTransitionForKinds,listeningCueForActivity,listeningPauseForPace,listeningCueForPace,listeningCueForText,thinkingCueForStage,responseCueForText,textPresentationCues,gestureRequestForText,gestureAcknowledgementForRequest,gestureCapabilityForRequest,groundResponseWithGesture,gestureRecallAnswerForText,characterStateAnswerForText,academyBoardRecallAnswerForText,academyBoardRepeatRequestForText,academyBoardClearRequestForText,academyBoardResizeRequestForText,academyBoardSizeRecallAnswerForText,academyBoardShapeExplanationForText,academyBoardShapePropertyAnswerForText,academyBoardShapePropertyReasonForText,academyBoardShapeCheckForText,academyBoardShapeCheckAnswerForText,academyBoardShapeCheckRepeatForText,academyBoardShapeCheckHintForText,academyBoardShapeCheckRevealForText,academyBoardShapeCheckReasonForText,createAcademyBoardQuestionDirector,recordVerifiedGesture,gestureHistoryAnswerForText,gestureHistoryReplayForText,gestureStopRequestForText,reducedMotionCommandForText,gestureSequenceForRequest,createGestureSequenceDirector,gazeTransitionForCue,createListeningReactionDirector,createIdleBehaviorDirector,createImprovisationDirector,createSpeechGestureDirector,createPerformanceDirector});
});
