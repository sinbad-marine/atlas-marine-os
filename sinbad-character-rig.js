(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.SinbadCharacterRig=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const RIG_VERSION='sinbad-2d-rig/4';
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
    'show-palm':{headYaw:-.08,leftArm:.08,rightArm:.9},
    'raise-left':{headYaw:.08,leftArm:.82,rightArm:.06},
    'show-both-hands':{headPitch:.04,bodyLean:0,leftArm:.78,rightArm:.82},
    'wave-right':{headYaw:-.08,headPitch:.06,bodyLean:-.03,leftArm:.04,rightArm:.94},
    'wave-right-away':{headYaw:.04,headPitch:.03,bodyLean:.03,leftArm:.04,rightArm:.68},
    'look-left':{headYaw:-.52,leftArm:.04,rightArm:.04},
    'look-right':{headYaw:.52,leftArm:.04,rightArm:.04},
    'shake-head-left':{headYaw:-.36,headPitch:-.03,leftArm:.06,rightArm:.06},
    'shake-head-right':{headYaw:.36,headPitch:-.03,leftArm:.06,rightArm:.06},
    explain:{leftArm:.38,rightArm:.52},
    laugh:{headPitch:-.12,leftArm:.56,rightArm:.64},
    walk:{leftArm:-.32,rightArm:.32},
    'point-board':{headYaw:.24,leftArm:.1,rightArm:.86},
    'write-contact':{headYaw:.28,headPitch:.08,bodyLean:.14,leftArm:.08,rightArm:.78},
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
  function interpolateControls(previous,next,progress){
    const from=normalizeControls(previous),to=normalizeControls(next),amount=Number(progress);
    if(!from.accepted||!to.accepted||!Number.isFinite(amount)||amount<0||amount>1)return Object.freeze({accepted:false,reason:'INVALID_INTERPOLATION'});
    const controls=Object.fromEntries(Object.keys(CONTROL_LIMITS).map(name=>[name,from.controls[name]+(to.controls[name]-from.controls[name])*amount]));
    return normalizeControls(controls);
  }
  return Object.freeze({RIG_VERSION,CONTROL_LIMITS,STATE_POSES,GESTURE_POSES,neutralControls,normalizeControls,poseForState,poseForPerformance,cssVariables,transitionForControls,interpolateControls});
});
