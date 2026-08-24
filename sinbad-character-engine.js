(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.SinbadCharacterEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const STATES=Object.freeze(['idle','listening','thinking','preparing-voice','presenting','speaking','laughing','walking','success','warning','error','voice-disabled','board-teaching']);
  const EMOTIONS=Object.freeze(['neutral','attentive','curious','warm','joyful','confident','concerned']);
  const GESTURES=Object.freeze(['rest','idle-breathe','idle-look-left','idle-look-right','open-hand','show-palm','raise-left','show-both-hands','wave-right','wave-right-away','look-left','look-right','shake-head-left','shake-head-right','explain','laugh','walk','walk-left','walk-right','point-board','write-contact','nod','nod-up','listen-lean','listen-orient','listen-follow','hold']);
  const GAZES=Object.freeze(['audience','thought','path','board','palm']);
  const DEFAULT_PERFORMANCE=Object.freeze({
    idle:{emotion:'warm',gesture:'rest',gaze:'audience'},
    listening:{emotion:'attentive',gesture:'listen-lean',gaze:'audience'},
    thinking:{emotion:'curious',gesture:'hold',gaze:'thought'},
    'preparing-voice':{emotion:'confident',gesture:'rest',gaze:'audience'},
    presenting:{emotion:'warm',gesture:'open-hand',gaze:'audience'},
    speaking:{emotion:'warm',gesture:'explain',gaze:'audience'},
    laughing:{emotion:'joyful',gesture:'laugh',gaze:'audience'},
    walking:{emotion:'warm',gesture:'walk',gaze:'path'},
    success:{emotion:'confident',gesture:'nod',gaze:'audience'},
    warning:{emotion:'concerned',gesture:'open-hand',gaze:'audience'},
    error:{emotion:'concerned',gesture:'hold',gaze:'audience'},
    'voice-disabled':{emotion:'neutral',gesture:'rest',gaze:'audience'},
    'board-teaching':{emotion:'confident',gesture:'point-board',gaze:'board'}
  });
  const EVENT_TO_STATE=Object.freeze({
    READY:'idle',VOICE_DISABLED:'voice-disabled',LISTEN_STARTED:'listening',
    THINK_STARTED:'thinking',VOICE_PREPARING:'preparing-voice',TEXT_PRESENTED:'presenting',AUDIO_STARTED:'speaking',
    LAUGH:'laughing',WALK:'walking',TURN_SUCCEEDED:'success',WARNING:'warning',ERROR:'error',TEACH_AT_BOARD:'board-teaching'
  });

  function validateDetail(detail){
    if(detail===undefined)return Object.freeze({accepted:true,detail:Object.freeze({})});
    if(!detail||typeof detail!=='object'||Array.isArray(detail)||Object.getPrototypeOf(detail)!==Object.prototype)return Object.freeze({accepted:false,reason:'INVALID_DETAIL'});
    if(Object.getOwnPropertySymbols(detail).length)return Object.freeze({accepted:false,reason:'INVALID_DETAIL_SYMBOL'});
    const descriptors=Object.getOwnPropertyDescriptors(detail);
    if(Object.values(descriptors).some(descriptor=>typeof descriptor.get==='function'||typeof descriptor.set==='function'))return Object.freeze({accepted:false,reason:'INVALID_DETAIL_ACCESSOR'});
    if(Object.hasOwn(detail,'emotion')&&!EMOTIONS.includes(detail.emotion))return Object.freeze({accepted:false,reason:'UNKNOWN_EMOTION'});
    if(Object.hasOwn(detail,'gesture')&&!GESTURES.includes(detail.gesture))return Object.freeze({accepted:false,reason:'UNKNOWN_GESTURE'});
    if(Object.hasOwn(detail,'gaze')&&!GAZES.includes(detail.gaze))return Object.freeze({accepted:false,reason:'UNKNOWN_GAZE'});
    if(Object.hasOwn(detail,'boardText')&&typeof detail.boardText!=='string')return Object.freeze({accepted:false,reason:'INVALID_BOARD_TEXT'});
    return Object.freeze({accepted:true,detail:Object.freeze({...detail})});
  }

  function immutableSnapshot(state,sequence,detail={}){
    const defaults=DEFAULT_PERFORMANCE[state]||DEFAULT_PERFORMANCE.idle;
    const emotion=detail.emotion||defaults.emotion;
    const gesture=detail.gesture||defaults.gesture;
    return Object.freeze({
      state,emotion,gesture,gaze:detail.gaze||defaults.gaze,
      boardText:state==='board-teaching'?String(detail.boardText||'').slice(0,500):'',
      canInterrupt:state==='speaking'||state==='preparing-voice'||state==='presenting'||state==='walking'||state==='board-teaching',
      sequence
    });
  }

  function createCharacterEngine(options={}){
    let sequence=0;
    let snapshot=immutableSnapshot(STATES.includes(options.initialState)?options.initialState:'idle',sequence);
    const listeners=new Set();
    const publish=()=>listeners.forEach(listener=>listener(snapshot));
    const setState=(state,detail={})=>{
      if(!STATES.includes(state))return Object.freeze({accepted:false,reason:'UNKNOWN_STATE',snapshot});
      const validated=validateDetail(detail);
      if(!validated.accepted)return Object.freeze({accepted:false,reason:validated.reason,snapshot});
      snapshot=immutableSnapshot(state,++sequence,validated.detail);publish();
      return Object.freeze({accepted:true,snapshot});
    };
    const dispatch=(event,detail={})=>{
      if(event==='INTERRUPT'){
        if(!snapshot.canInterrupt)return Object.freeze({accepted:false,reason:'NOT_INTERRUPTIBLE',snapshot});
        return setState(detail.listen===false?'idle':'listening',detail);
      }
      const state=EVENT_TO_STATE[event];
      if(!state)return Object.freeze({accepted:false,reason:'UNKNOWN_EVENT',snapshot});
      return setState(state,detail);
    };
    return Object.freeze({
      dispatch,setState,getSnapshot:()=>snapshot,
      subscribe(listener){
        if(typeof listener!=='function')throw new TypeError('Character listener must be a function');
        listeners.add(listener);listener(snapshot);return()=>listeners.delete(listener);
      }
    });
  }

  return Object.freeze({STATES,EMOTIONS,GESTURES,GAZES,EVENT_TO_STATE,validateDetail,createCharacterEngine});
});
