(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.SinbadCharacterRig=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const RIG_VERSION='sinbad-2d-rig/13';
  const CONTROL_LIMITS=Object.freeze({blink:[0,1],mouthOpen:[0,1],smile:[-1,1],headYaw:[-1,1],headPitch:[-1,1],bodyLean:[-1,1],leftArm:[-1,1],rightArm:[-1,1],energy:[0,1]});
  const STATE_POSES=Object.freeze({
    idle:{smile:.18,energy:.18},listening:{headPitch:.12,bodyLean:.16,smile:.08,energy:.3},
    thinking:{headYaw:.12,headPitch:-.08,energy:.2},'preparing-voice':{headPitch:.05,energy:.3},presenting:{headPitch:.08,smile:.2,leftArm:.24,energy:.34},
    speaking:{mouthOpen:.42,smile:.16,leftArm:.42,rightArm:.5,energy:.7},
    laughing:{mouthOpen:.68,smile:.72,leftArm:.55,rightArm:.62,energy:.82},
    walking:{smile:.2,bodyLean:.08,leftArm:-.3,rightArm:.3,energy:.72},
    success:{headPitch:.2,smile:.55,energy:.65},warning:{smile:-.18,leftArm:.28,energy:.38},
    error:{headPitch:-.12,smile:-.35,energy:.18},'voice-disabled':{energy:.08},
    'board-teaching':{headYaw:.24,leftArm:.12,rightArm:.82,energy:.55}
  });
  const GESTURE_POSES=Object.freeze({
    rest:{leftArm:0,rightArm:0},
    'idle-breathe':{headPitch:.03,bodyLean:.04,leftArm:.02,rightArm:.02},
    'idle-look-left':{headYaw:-.18,bodyLean:-.04,leftArm:.02,rightArm:.02},
    'idle-look-right':{headYaw:.18,bodyLean:.04,leftArm:.02,rightArm:.02},
    'open-hand':{leftArm:.18,rightArm:.58},
    'open-hand-left':{headYaw:.04,leftArm:.58,rightArm:.18},
    'show-palm':{headYaw:-.08,leftArm:.08,rightArm:.9},
    'show-left-palm':{headYaw:.08,leftArm:.9,rightArm:.08},
    'raise-left':{headYaw:.08,leftArm:.82,rightArm:.06},
    'show-both-hands':{headPitch:.04,bodyLean:0,leftArm:.78,rightArm:.82},
    'wave-right':{headYaw:-.08,headPitch:.06,bodyLean:-.03,leftArm:.04,rightArm:.94},
    'wave-right-away':{headYaw:.04,headPitch:.03,bodyLean:.03,leftArm:.04,rightArm:.68},
    'look-left':{headYaw:-.52,leftArm:.04,rightArm:.04},
    'look-right':{headYaw:.52,leftArm:.04,rightArm:.04},
    'shake-head-left':{headYaw:-.36,headPitch:-.03,leftArm:.06,rightArm:.06},
    'shake-head-right':{headYaw:.36,headPitch:-.03,leftArm:.06,rightArm:.06},
    shrug:{headPitch:-.08,bodyLean:.04,leftArm:.48,rightArm:.5},
    explain:{leftArm:.38,rightArm:.52},
    'explain-left':{headYaw:.03,leftArm:.52,rightArm:.38},
    laugh:{headPitch:-.12,leftArm:.56,rightArm:.64},
    walk:{leftArm:-.32,rightArm:.32},
    'point-board':{headYaw:.24,leftArm:.1,rightArm:.86},
    nod:{headPitch:.24},
    'nod-up':{headPitch:-.12,bodyLean:-.02,leftArm:.05,rightArm:.05},
    'listen-lean':{headPitch:.14,bodyLean:.18},
    'listen-orient':{headYaw:-.12,headPitch:.1,bodyLean:.12,leftArm:.04,rightArm:.04},
    'listen-follow':{headPitch:.18,bodyLean:.16,leftArm:.08,rightArm:.06},
    hold:{leftArm:.16,rightArm:.14}
  });
  function neutralControls(){return {blink:0,mouthOpen:0,smile:0,headYaw:0,headPitch:0,bodyLean:0,leftArm:0,rightArm:0,energy:0};}
  function normalizeControls(input={}){
    if(!input||typeof input!=='object'||Array.isArray(input))return Object.freeze({accepted:false,reason:'INVALID_CONTROLS'});
    const controls=neutralControls();
    for(const [name,value] of Object.entries(input)){
      if(!Object.hasOwn(CONTROL_LIMITS,name))return Object.freeze({accepted:false,reason:'UNKNOWN_CONTROL',control:name});
      if(typeof value!=='number'||!Number.isFinite(value))return Object.freeze({accepted:false,reason:'INVALID_CONTROL_VALUE',control:name});
      const [min,max]=CONTROL_LIMITS[name];
      if(value<min||value>max)return Object.freeze({accepted:false,reason:'CONTROL_OUT_OF_RANGE',control:name});
      controls[name]=value;
    }
    return Object.freeze({accepted:true,version:RIG_VERSION,controls:Object.freeze(controls)});
  }
  function poseForState(state,overrides={}){
    if(!Object.hasOwn(STATE_POSES,state))return Object.freeze({accepted:false,reason:'UNKNOWN_STATE'});
    return normalizeControls({...STATE_POSES[state],...overrides});
  }
  function poseForPerformance(state,gesture,overrides={}){
    if(!Object.hasOwn(STATE_POSES,state))return Object.freeze({accepted:false,reason:'UNKNOWN_STATE'});
    if(!Object.hasOwn(GESTURE_POSES,gesture))return Object.freeze({accepted:false,reason:'UNKNOWN_GESTURE'});
    return normalizeControls({...STATE_POSES[state],...GESTURE_POSES[gesture],...overrides});
  }
  function sideForGesture(gesture){
    if(!Object.hasOwn(GESTURE_POSES,gesture))return Object.freeze({accepted:false,reason:'UNKNOWN_GESTURE'});
    const pose=GESTURE_POSES[gesture],left=Number(pose.leftArm||0),right=Number(pose.rightArm||0);
    const side=Math.abs(left-right)<.08?'center':left>right?'left':'right';
    return Object.freeze({accepted:true,side});
  }
  function handsForGesture(gesture){
    if(!Object.hasOwn(GESTURE_POSES,gesture))return Object.freeze({accepted:false,reason:'UNKNOWN_GESTURE'});
    if(gesture==='show-both-hands')return Object.freeze({accepted:true,hands:'both'});
    const side=sideForGesture(gesture).side;
    return Object.freeze({accepted:true,hands:side==='center'?'none':side});
  }
  function cssVariables(controls){
    const result=normalizeControls(controls);if(!result.accepted)return result;const c=result.controls;
    return Object.freeze({accepted:true,variables:Object.freeze({'--sinbad-rig-blink':String(c.blink),'--sinbad-rig-mouth':String(c.mouthOpen),'--sinbad-rig-smile':String(c.smile),'--sinbad-rig-head-x':`${(c.headYaw*2.2).toFixed(2)}deg`,'--sinbad-rig-head-y':`${(c.headPitch*2.2).toFixed(2)}deg`,'--sinbad-rig-lean':`${(c.bodyLean*1.8).toFixed(2)}deg`,'--sinbad-rig-left-arm':`${(c.leftArm*14).toFixed(2)}deg`,'--sinbad-rig-right-arm':`${(c.rightArm*14).toFixed(2)}deg`,'--sinbad-rig-energy':String(c.energy)})});
  }
  function transitionForControls(previous,next,{urgent=false,reducedMotion=false}={}){
    const from=normalizeControls(previous),to=normalizeControls(next);
    if(!from.accepted||!to.accepted)return Object.freeze({accepted:false,reason:'INVALID_TRANSITION_CONTROLS'});
    const channels=['headYaw','headPitch','bodyLean','leftArm','rightArm'];
    const maxDelta=Math.max(...channels.map(name=>Math.abs(to.controls[name]-from.controls[name])));
    const durationMs=reducedMotion?0:urgent?180:Math.round(Math.max(280,Math.min(1200,280+maxDelta*1000)));
    const scale=maxDelta<.18?'micro':maxDelta<.55?'measured':'broad';
    return Object.freeze({accepted:true,durationMs,maxDelta:Number(maxDelta.toFixed(3)),scale,urgent:Boolean(urgent)});
  }
  function expressionTransitionForControls(previous,next,{urgent=false,reducedMotion=false}={}){
    const from=normalizeControls(previous),to=normalizeControls(next);
    if(!from.accepted||!to.accepted)return Object.freeze({accepted:false,reason:'INVALID_EXPRESSION_CONTROLS'});
    const smileDelta=Math.abs(to.controls.smile-from.controls.smile),headDelta=Math.max(Math.abs(to.controls.headYaw-from.controls.headYaw),Math.abs(to.controls.headPitch-from.controls.headPitch));
    const intensity=Math.max(smileDelta,headDelta);
    const durationMs=reducedMotion?0:urgent?90:Math.round(Math.max(180,Math.min(420,180+intensity*240)));
    const easing=urgent?'linear':intensity>.55?'cubic-bezier(.2,.72,.24,1)':'ease-in-out';
    return Object.freeze({accepted:true,durationMs,intensity:Number(intensity.toFixed(3)),easing,urgent:Boolean(urgent)});
  }
  function coordinationForPerformance(state,cue={}, {urgent=false,reducedMotion=false}={}){
    if(!Object.hasOwn(STATE_POSES,state)||!cue||typeof cue!=='object'||Array.isArray(cue))return Object.freeze({accepted:false,reason:'INVALID_COORDINATION_INPUT'});
    const gesture=typeof cue.gesture==='string'?cue.gesture:'rest',gaze=typeof cue.gaze==='string'?cue.gaze:'audience';
    if(!Object.hasOwn(GESTURE_POSES,gesture)||!['audience','thought','board','path','palm','left-palm'].includes(gaze))return Object.freeze({accepted:false,reason:'INVALID_COORDINATION_CUE'});
    if(reducedMotion||urgent)return Object.freeze({accepted:true,profile:urgent?'urgent-lock':'reduced-lock',headDelayMs:0,armDelayMs:0,expressionDelayMs:0,headEasing:'linear',armEasing:'linear'});
    const focused=['board','palm','left-palm'].includes(gaze)||['show-palm','show-left-palm','raise-left','point-board'].includes(gesture);
    const expressive=['open-hand','open-hand-left','show-both-hands','wave-right','wave-right-away','explain','explain-left','laugh'].includes(gesture);
    if(focused)return Object.freeze({accepted:true,profile:'gaze-leads',headDelayMs:0,armDelayMs:80,expressionDelayMs:35,headEasing:'cubic-bezier(.22,.7,.25,1)',armEasing:'cubic-bezier(.18,.82,.28,1.04)'});
    if(expressive)return Object.freeze({accepted:true,profile:'expression-leads',headDelayMs:35,armDelayMs:65,expressionDelayMs:0,headEasing:'cubic-bezier(.25,.68,.3,1)',armEasing:'cubic-bezier(.16,.86,.24,1.03)'});
    return Object.freeze({accepted:true,profile:'unified',headDelayMs:0,armDelayMs:25,expressionDelayMs:15,headEasing:'ease-in-out',armEasing:'cubic-bezier(.24,.72,.3,1)'});
  }
  function microRhythmForPerformance(state,cue={}, {reducedMotion=false}={}){
    if(!Object.hasOwn(STATE_POSES,state)||!cue||typeof cue!=='object'||Array.isArray(cue))return Object.freeze({accepted:false,reason:'INVALID_MICRO_RHYTHM_INPUT'});
    const caution=cue.responseKind==='caution'||state==='warning'||state==='error';
    const profile=caution?'steady':state==='listening'?'attentive':state==='speaking'||state==='presenting'?'expressive':'calm';
    const settings={
      calm:{durationMs:4200,breathScale:.006,headOffset:.08,gazeOffset:.04},
      attentive:{durationMs:3600,breathScale:.004,headOffset:.12,gazeOffset:.06},
      expressive:{durationMs:2800,breathScale:.008,headOffset:.16,gazeOffset:.08},
      steady:{durationMs:0,breathScale:0,headOffset:0,gazeOffset:0}
    }[profile];
    const resolved=reducedMotion?{durationMs:0,breathScale:0,headOffset:0,gazeOffset:0}:settings;
    return Object.freeze({accepted:true,profile,reducedMotion:Boolean(reducedMotion),...resolved});
  }
  function blinkPolicyForPerformance(state,cue={}){
    if(!Object.hasOwn(STATE_POSES,state)||!cue||typeof cue!=='object'||Array.isArray(cue))return Object.freeze({accepted:false,reason:'INVALID_BLINK_POLICY_INPUT'});
    const focused=['board','palm','left-palm'].includes(cue.gaze)||['show-palm','show-left-palm','raise-left','point-board'].includes(cue.gesture);
    const emphasized=['opening','emphasis'].includes(cue.cadence);
    const busy=['speaking','preparing-voice','thinking','walking','laughing','board-teaching'].includes(state);
    const caution=cue.responseKind==='caution'||state==='warning'||state==='error';
    const allow=!(focused||emphasized||busy||caution);
    const reason=focused?'FOCUSED_GAZE':emphasized?'SPEECH_EMPHASIS':busy?'ACTIVE_PERFORMANCE':caution?'CAUTION_HOLD':'NATURAL_WINDOW';
    return Object.freeze({accepted:true,allow,reason,minDelayMs:allow?3800:0,maxDelayMs:allow?7000:0});
  }
  function balanceControlsForPerformance(state,gesture,controls){
    if(!Object.hasOwn(STATE_POSES,state)||!Object.hasOwn(GESTURE_POSES,gesture))return Object.freeze({accepted:false,reason:'INVALID_BALANCE_CONTEXT'});
    const normalized=normalizeControls(controls);if(!normalized.accepted)return Object.freeze({accepted:false,reason:'INVALID_BALANCE_CONTROLS'});
    const offsets={'show-palm':-.06,'show-left-palm':.06,'raise-left':.06,'open-hand':-.035,'open-hand-left':.035,explain:-.025,'explain-left':.025,'point-board':-.045,'show-both-hands':0};
    const requested=Object.hasOwn(offsets,gesture)?offsets[gesture]:0;
    const armLoad=Math.max(Math.abs(normalized.controls.leftArm),Math.abs(normalized.controls.rightArm));
    const bodyLean=Math.max(-.18,Math.min(.18,normalized.controls.bodyLean+requested));
    const headYaw=Math.max(-1,Math.min(1,normalized.controls.headYaw-requested*.35));
    const balanced=normalizeControls({...normalized.controls,bodyLean,headYaw});
    if(!balanced.accepted)return Object.freeze({accepted:false,reason:'BALANCE_NORMALIZATION_FAILED'});
    return Object.freeze({accepted:true,controls:balanced.controls,correction:Object.freeze({applied:requested!==0,bodyLean:Number(bodyLean.toFixed(3)),headYaw:Number(headYaw.toFixed(3)),armLoad:Number(armLoad.toFixed(3))})});
  }
  function interpolateControls(previous,next,progress){
    const from=normalizeControls(previous),to=normalizeControls(next),amount=Number(progress);
    if(!from.accepted||!to.accepted||!Number.isFinite(amount)||amount<0||amount>1)return Object.freeze({accepted:false,reason:'INVALID_INTERPOLATION'});
    const controls=Object.fromEntries(Object.keys(CONTROL_LIMITS).map(name=>[name,from.controls[name]+(to.controls[name]-from.controls[name])*amount]));
    return normalizeControls(controls);
  }
  return Object.freeze({RIG_VERSION,CONTROL_LIMITS,STATE_POSES,GESTURE_POSES,neutralControls,normalizeControls,poseForState,poseForPerformance,sideForGesture,handsForGesture,cssVariables,transitionForControls,expressionTransitionForControls,coordinationForPerformance,microRhythmForPerformance,blinkPolicyForPerformance,balanceControlsForPerformance,interpolateControls});
});
