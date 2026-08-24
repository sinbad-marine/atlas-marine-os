(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./sinbad-professor.js'):root.SinbadProfessor);
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.SinbadTutorOrchestrator=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(professor){
  'use strict';
  const VERSION='sinbad-tutor-orchestrator/1';
  const MAX_ATTEMPTS=3;
  const ASSESSMENT_KINDS=new Set(['diagnostic','knowledge-check','practice','review-check','reflection-check']);
  const clean=value=>String(value||'').trim().toLocaleLowerCase('tr-TR').replace(/[^a-z0-9çğıöşü-]+/gi,'-').replace(/^-+|-+$/g,'').slice(0,80);
  const freeze=value=>{if(value&&typeof value==='object'){for(const item of Object.values(value))freeze(item);Object.freeze(value)}return value};
  function catalog(input=[]){
    if(!Array.isArray(input)||!input.length)throw new TypeError('A non-empty lesson catalog is required');
    const seen=new Set();
    return input.map((item,index)=>{
      const id=clean(item?.id);if(!id||seen.has(id))throw new TypeError('Lesson IDs must be unique');seen.add(id);
      const objectives=(Array.isArray(item.objectives)?item.objectives:[]).map((value,n)=>({id:clean(value?.id||`${id}-${n+1}`),label:String(value?.label||value||'').trim()})).filter(x=>x.id&&x.label);
      if(!objectives.length)throw new TypeError(`Lesson ${id} requires at least one objective`);
      return freeze({id,label:String(item.label||item.title||id),prerequisites:(item.prerequisites||[]).map(clean).filter(Boolean),objectives,index});
    });
  }
  function action(session){
    const objective=session.objectives[session.objectiveIndex]||null;
    const common={sessionId:session.sessionId,topicId:session.topicId,objective};
    if(session.status==='STOPPED')return freeze({...common,type:'STOP',reason:session.reason});
    if(session.status==='COMPLETE')return freeze({...common,type:'COMPLETE',reason:'LESSON_OBJECTIVES_ASSESSED'});
    if(session.stage==='EXPLAIN')return freeze({...common,type:'EXPLAIN',reason:'OBJECTIVE_READY'});
    if(session.stage==='CHECK')return freeze({...common,type:'ASK_KNOWLEDGE_CHECK',reason:'ASSESSMENT_REQUIRED'});
    return freeze({...common,type:'REMEDIATE',reason:'ASSESSMENT_BELOW_THRESHOLD'});
  }
  function progress(session={}){
    const objectives=Array.isArray(session.objectives)?session.objectives:[],total=objectives.length;
    const completed=session.status==='COMPLETE'?total:Math.max(0,Math.min(total,Number.isInteger(session.objectiveIndex)?session.objectiveIndex:0));
    const current=total?Math.min(completed+1,total):0;
    return freeze({total,completed,current,attempts:Math.max(0,Number(session.attempts)||0),maxAttempts:MAX_ATTEMPTS,percent:total?Math.round(completed/total*100):0,objectives:objectives.map((item,index)=>({id:item.id,label:item.label,status:index<completed?'VERIFIED':index===current-1&&session.status==='ACTIVE'?'CURRENT':'PENDING'}))});
  }
  function stop(base,reason,details={}){return freeze({...base,status:'STOPPED',stage:'STOPPED',reason,details:{...details}})}
  function create(input={}){
    const lessons=catalog(input.catalog),profile=professor.normalizeProfile(input.profile||professor.createProfile());
    const requested=clean(input.topicId),lesson=requested?lessons.find(x=>x.id===requested):professor.nextLesson(profile,lessons);
    if(!lesson)throw new TypeError('Requested lesson is not available');
    const base={version:VERSION,sessionId:String(input.sessionId||'').trim(),learnerId:profile.learnerId,topicId:lesson.id,objectives:lesson.objectives,objectiveIndex:0,stage:'EXPLAIN',status:'ACTIVE',attempts:0,turn:0,reason:null,evidence:[]};
    if(!base.sessionId)return freeze({session:stop(base,'SESSION_ID_REQUIRED'),profile,action:action(stop(base,'SESSION_ID_REQUIRED'))});
    const blocked=lesson.prerequisites.filter(id=>Number(profile.mastery[id]||0)<.55);
    const session=blocked.length?stop(base,'PREREQUISITE_NOT_MET',{blockedBy:blocked}):freeze(base);
    return freeze({session,profile,action:action(session)});
  }
  function restore(input={}){
    const lessons=catalog(input.catalog),snapshot=input.snapshot;
    if(!snapshot||typeof snapshot!=='object'||!snapshot.session||!snapshot.profile)throw new TypeError('A stored tutor snapshot is required');
    const profile=professor.normalizeProfile(snapshot.profile),stored=snapshot.session;
    const lesson=lessons.find(item=>item.id===stored.topicId);
    const objectiveIndex=Number(stored.objectiveIndex),attempts=Number(stored.attempts),turn=Number(stored.turn);
    if(stored.version!==VERSION||typeof stored.sessionId!=='string'||!stored.sessionId.trim()||stored.learnerId!==profile.learnerId||!lesson)throw new TypeError('Stored tutor session identity is invalid');
    if(stored.status!=='ACTIVE'||!['EXPLAIN','CHECK','REMEDIATE'].includes(stored.stage))throw new TypeError('Stored tutor session is not resumable');
    if(!Number.isInteger(objectiveIndex)||objectiveIndex<0||objectiveIndex>=lesson.objectives.length||!Number.isInteger(attempts)||attempts<0||attempts>=MAX_ATTEMPTS||!Number.isInteger(turn)||turn<0)throw new TypeError('Stored tutor progress is invalid');
    const storedObjectives=Array.isArray(stored.objectives)?stored.objectives:[];
    if(storedObjectives.length!==lesson.objectives.length||storedObjectives.some((item,index)=>item?.id!==lesson.objectives[index].id||item?.label!==lesson.objectives[index].label))throw new TypeError('Stored tutor objectives do not match the catalog');
    const evidence=(Array.isArray(stored.evidence)?stored.evidence:[]).map(item=>{
      if(!lesson.objectives.some(objective=>objective.id===item?.objectiveId)||!ASSESSMENT_KINDS.has(item?.kind)||!Number.isFinite(item?.score)||item.score<0||item.score>1||!Number.isFinite(item?.confidence)||item.confidence<0||item.confidence>1||typeof item?.at!=='string'||!item.at)throw new TypeError('Stored tutor evidence is invalid');
      return {objectiveId:item.objectiveId,score:item.score,confidence:item.confidence,kind:item.kind,at:item.at};
    });
    const session=freeze({version:VERSION,sessionId:stored.sessionId.trim(),learnerId:profile.learnerId,topicId:lesson.id,objectives:lesson.objectives,objectiveIndex,stage:stored.stage,status:'ACTIVE',attempts,turn,reason:null,evidence});
    return freeze({session,profile,action:action(session)});
  }
  function advance(sessionInput,profileInput,event={},now=new Date().toISOString()){
    const session=freeze({...sessionInput,objectives:[...(sessionInput.objectives||[])],evidence:[...(sessionInput.evidence||[])]}),profile=professor.normalizeProfile(profileInput);
    if(session.version!==VERSION||!session.sessionId)return freeze({session:stop(session,'INVALID_SESSION'),profile,action:action(stop(session,'INVALID_SESSION'))});
    if(session.status!=='ACTIVE')return freeze({session,profile,action:action(session)});
    const type=String(event.type||'');let next={...session,turn:session.turn+1};let nextProfile=profile;
    if(type==='EXPLANATION_COMPLETE'&&session.stage==='EXPLAIN')next.stage='CHECK';
    else if(type==='REMEDIATION_COMPLETE'&&session.stage==='REMEDIATE')next.stage='CHECK';
    else if(type==='ASSESSMENT'&&session.stage==='CHECK'){
      const kind=String(event.kind||'');
      if(!ASSESSMENT_KINDS.has(kind)||!Number.isFinite(event.score)||!Number.isFinite(event.confidence))next=stop(next,'INVALID_ASSESSMENT');
      else{
        const score=Math.max(0,Math.min(1,event.score)),confidence=Math.max(0,Math.min(1,event.confidence));
        nextProfile=professor.recordEvidence(profile,{topic:session.topicId,score,confidence,kind},now);
        next.evidence=[...session.evidence,{objectiveId:session.objectives[session.objectiveIndex].id,score,confidence,kind,at:now}];
        next.attempts=session.attempts+1;
        if(score>=.75&&confidence>=.5){
          next.attempts=0;
          if(session.objectiveIndex+1>=session.objectives.length){next.status='COMPLETE';next.stage='COMPLETE'}
          else{next.objectiveIndex=session.objectiveIndex+1;next.stage='EXPLAIN'}
        }else if(next.attempts>=MAX_ATTEMPTS)next=stop(next,'INSTRUCTOR_REVIEW_REQUIRED',{attempts:next.attempts});
        else next.stage='REMEDIATE';
      }
    }else next=stop(next,'INVALID_TRANSITION',{eventType:type,stage:session.stage});
    next=freeze(next);return freeze({session:next,profile:nextProfile,action:action(next)});
  }
  return Object.freeze({VERSION,MAX_ATTEMPTS,ASSESSMENT_KINDS:Object.freeze([...ASSESSMENT_KINDS]),create,restore,advance,action,progress});
});
