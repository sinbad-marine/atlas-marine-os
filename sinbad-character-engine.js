(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.SinbadCharacterEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const STATES=Object.freeze(['idle','listening','thinking','preparing-voice','speaking','laughing','walking','success','warning','error','voice-disabled','board-teaching']);
  const EMOTIONS=Object.freeze(['neutral','attentive','curious','warm','joyful','confident','concerned']);
  const GESTURES=Object.freeze(['rest','open-hand','explain','laugh','walk','point-board','nod','listen-lean','hold']);
  const DEFAULT_PERFORMANCE=Object.freeze({
    idle:{emotion:'warm',gesture:'rest',gaze:'audience'},
    listening:{emotion:'attentive',gesture:'listen-lean',gaze:'audience'},
    thinking:{emotion:'curious',gesture:'hold',gaze:'thought'},
    'preparing-voice':{emotion:'confident',gesture:'rest',gaze:'audience'},
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
    THINK_STARTED:'thinking',VOICE_PREPARING:'preparing-voice',AUDIO_STARTED:'speaking',
    LAUGH:'laughing',WALK:'walking',TURN_SUCCEEDED:'success',WARNING:'warning',ERROR:'error',TEACH_AT_BOARD:'board-teaching'
  });

  function immutableSnapshot(state,sequence,detail={}){
    const defaults=DEFAULT_PERFORMANCE[state]||DEFAULT_PERFORMANCE.idle;
    const emotion=EMOTIONS.includes(detail.emotion)?detail.emotion:defaults.emotion;
    const gesture=GESTURES.includes(detail.gesture)?detail.gesture:defaults.gesture;
    return Object.freeze({
      state,emotion,gesture,gaze:detail.gaze||defaults.gaze,
      boardText:state==='board-teaching'?String(detail.boardText||'').slice(0,500):'',
      canInterrupt:state==='speaking'||state==='preparing-voice'||state==='walking'||state==='board-teaching',
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
      snapshot=immutableSnapshot(state,++sequence,detail);publish();
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

  return Object.freeze({STATES,EMOTIONS,GESTURES,EVENT_TO_STATE,createCharacterEngine});
});
