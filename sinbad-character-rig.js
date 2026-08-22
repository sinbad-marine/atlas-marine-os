(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.SinbadCharacterRig=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const RIG_VERSION='sinbad-2d-rig/1';
  const CONTROL_LIMITS=Object.freeze({blink:[0,1],mouthOpen:[0,1],smile:[-1,1],headYaw:[-1,1],headPitch:[-1,1],bodyLean:[-1,1],leftArm:[-1,1],rightArm:[-1,1],energy:[0,1]});
  const STATE_POSES=Object.freeze({
    idle:{smile:.18,energy:.18},listening:{headPitch:.12,bodyLean:.16,smile:.08,energy:.3},
    thinking:{headYaw:.12,headPitch:-.08,energy:.2},'preparing-voice':{headPitch:.05,energy:.3},
    speaking:{mouthOpen:.42,smile:.16,leftArm:.42,rightArm:.5,energy:.7},
    success:{headPitch:.2,smile:.55,energy:.65},warning:{smile:-.18,leftArm:.28,energy:.38},
    error:{headPitch:-.12,smile:-.35,energy:.18},'voice-disabled':{energy:.08},
    'board-teaching':{headYaw:.24,leftArm:.12,rightArm:.82,energy:.55}
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
  function cssVariables(controls){
    const result=normalizeControls(controls);if(!result.accepted)return result;const c=result.controls;
    return Object.freeze({accepted:true,variables:Object.freeze({'--sinbad-rig-blink':String(c.blink),'--sinbad-rig-mouth':String(c.mouthOpen),'--sinbad-rig-smile':String(c.smile),'--sinbad-rig-head-x':`${(c.headYaw*2.2).toFixed(2)}deg`,'--sinbad-rig-head-y':`${(c.headPitch*2.2).toFixed(2)}deg`,'--sinbad-rig-lean':`${(c.bodyLean*1.8).toFixed(2)}deg`,'--sinbad-rig-energy':String(c.energy)})});
  }
  return Object.freeze({RIG_VERSION,CONTROL_LIMITS,STATE_POSES,neutralControls,normalizeControls,poseForState,cssVariables});
});
