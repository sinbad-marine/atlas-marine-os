'use strict';
// Phase 2 is a hash-frozen compatibility surface. When this new classroom is
// opened inside its legacy iframe, hand that frame to the preserved native
// Professor runtime without changing either frozen Phase 2 file.
if(window.frameElement?.id==='phaseOneClassroom')window.location.replace('./academy-professor-native.html');
const byId=id=>document.getElementById(id);
const ACADEMY_SECTIONS=Object.freeze({
  'goss-gasm':Object.freeze({title:'GOSS / GASM Classroom',label:'GOSS / GASM',modules:Object.freeze(['gasm-seyir-sinav'])}),
  stcw:Object.freeze({title:'STCW Classroom',label:'STCW',modules:Object.freeze(['stcw-foundation','colregs-navigation-rules','electronic-navigation','marine-weather'])}),
  goc:Object.freeze({title:'GOC Classroom',label:'GOC',modules:Object.freeze(['goc-foundation'])}),
  'general-maritime-education':Object.freeze({title:'General Maritime Education',label:'GENERAL MARITIME EDUCATION',modules:Object.freeze(['general-maritime-education','chart-reading','tides-water-levels','currents-set-drift'])})
});
const GEOMETRY_KEY='atlas_sinbad_academy_native_window';
const LANGUAGE_KEY='atlas_sinbad_academy_language';
const SINBAD_BRIDGE_URL='http://127.0.0.1:31983';
function argosBridgeHeaders(action,target){const random=globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`;return {'X-Sinbad-Argos-Version':'sinbad-argos-command/1-v1','X-Sinbad-Argos-Action':action,'X-Sinbad-Argos-Target':target,'X-Sinbad-Argos-Command-Id':`academy-${random}`,'X-Sinbad-Argos-Requested-At':new Date().toISOString()};}
const SINBAD_OWNER_REVIEW_URL='http://127.0.0.1:4177/';
const academyExamIntegration=window.SinbadExamIntelligence?.create(window.SINBAD_EXAM_INTELLIGENCE_CONFIG,{baseUrl:window.location.href,openWindow:(...args)=>window.open(...args)})||null;
const academyOwnerReviewIntegration=window.SinbadOwnerReview?.create({appUrl:SINBAD_OWNER_REVIEW_URL},{baseUrl:window.location.href,openWindow:(...args)=>window.open(...args)})||null;
const academyModuleOptions=[...byId('academyModule').options].map(option=>Object.freeze({value:option.value,label:option.textContent}));
const gasmCatalog=window.SINBAD_GASM_CATALOG||Object.freeze({qualifications:[],questions:[]});
let gasmSelection=Object.freeze({qualificationCode:null,subjectCode:null,topicCode:null,index:0,selectedOption:null});
const academyCharacterEngine=window.SinbadCharacterEngine?.createCharacterEngine({initialState:'idle'})||null;
const academyCharacterRig=window.SinbadCharacterRig||null;
// Fail closed: the generated full-body layers remain offline until their
// shoulder, neck and stage coordinates pass wide-screen visual acceptance.
const ACADEMY_FULL_BODY_RIG_CALIBRATED=false;
const academyPerformanceDirector=window.SinbadPerformanceDirector?.createPerformanceDirector()||null;
const academySpeechGestureDirector=window.SinbadPerformanceDirector?.createSpeechGestureDirector()||null;
const ACADEMY_CHARACTER_ASSETS=Object.freeze({
  walking:Object.freeze(['./assets/captain-sinbad/captain-sinbad-walk-a-v1.png','./assets/captain-sinbad/captain-sinbad-walk-b-v1.png']),
  writing:Object.freeze({ready:'./assets/captain-sinbad/captain-sinbad-board-teaching.png',contact:'./assets/captain-sinbad/captain-sinbad-writing-contact-v1.png',lift:'./assets/captain-sinbad/captain-sinbad-writing-lift-v1.png'}),
  'board-teaching':'./assets/captain-sinbad/captain-sinbad-board-teaching.png',
  idle:'./assets/captain-sinbad/captain-sinbad-idle-master.png',
  idleBlink:'./assets/captain-sinbad/captain-sinbad-idle-blink-v1.png',
  listening:'./assets/captain-sinbad/captain-sinbad-listening.png',
  thinking:'./assets/captain-sinbad/captain-sinbad-thinking.png',
  speaking:'./assets/captain-sinbad/captain-sinbad-speaking.png',
  speakingFrames:Object.freeze({closed:'./assets/captain-sinbad/captain-sinbad-speaking.png',open:'./assets/captain-sinbad/captain-sinbad-speaking-mbp-v1.png',round:'./assets/captain-sinbad/captain-sinbad-speaking-o-v1.png'}),
  laughing:'./assets/captain-sinbad/captain-sinbad-laughing-v1.png'
});
let academyBoardGeneration=0;
let academyMotionGeneration=0;
let academyLastPerformedGestureAction=null;
let academyLessonStartedAt=null;
let academyLessonClockTimer=null;
let academyRecognition=null;
let academyHandsFreeEnabled=false;
let academyVoiceBusy=false;
let academyHandsFreeRestartTimer=null;
let academyLipSyncTimer=null;
let academyIdleBlinkTimer=null;
const academyLanguage=()=>['tr-TR','en-US','de-DE'].includes(byId('academyLanguage')?.value)?byId('academyLanguage').value:'tr-TR';

function setAcademyClassroomPhase(phase){
  const stage=byId('academyTeachingStage');if(!stage)return;
  stage.dataset.phase=phase==='lesson'?'lesson':'welcome';
  if(stage.dataset.phase==='lesson')byId('academyTeachingText')?.replaceChildren();
}

function presentAcademyAnswerOnBoard(question,answer){
  const stage=byId('academyTeachingStage'),title=byId('academyTeachingTitle'),board=byId('academyTeachingText'),output=byId('academyOutput');
  if(!stage||stage.dataset.phase!=='lesson'||!title||!board)return;
  academyBoardGeneration++;title.textContent='Soru ve yanıt';
  board.replaceChildren();board.textContent=`SORU\n${String(question||'').trim()}\n\nSİNBAD\n${String(answer||'').trim()}`;
  board.removeAttribute('aria-hidden');if(output){output.hidden=true;output.replaceChildren();}
}

function renderAcademyLessonClock(){
  const clock=byId('academyLessonElapsed');if(!clock)return;
  const elapsed=academyLessonStartedAt===null?0:Math.max(0,Math.floor((Date.now()-academyLessonStartedAt)/1000));
  const minutes=Math.floor(elapsed/60),seconds=elapsed%60;
  clock.textContent=`${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
  clock.dateTime=`PT${elapsed}S`;
}
function startAcademyLessonClock(){
  academyLessonStartedAt=Date.now();renderAcademyLessonClock();
  if(academyLessonClockTimer!==null)clearInterval(academyLessonClockTimer);
  academyLessonClockTimer=setInterval(renderAcademyLessonClock,1000);
}
function resetAcademyLessonClock(){
  academyLessonStartedAt=null;if(academyLessonClockTimer!==null)clearInterval(academyLessonClockTimer);academyLessonClockTimer=null;renderAcademyLessonClock();
}
const ACADEMY_SHAPE_DRAWING_RHYTHMS=Object.freeze([
  Object.freeze({id:'steady',frames:Object.freeze([[0,'contact','write-contact','contact'],[260,'lift','write-lift','lift'],[440,'contact','write-contact','contact'],[720,'ready','explain','check-in','audience'],[880,'contact','write-contact','contact'],[1250,'ready','explain','complete','audience']])}),
  Object.freeze({id:'measured',frames:Object.freeze([[0,'contact','write-contact','contact'],[340,'ready','explain','check-in','audience'],[510,'contact','write-contact','contact'],[760,'lift','write-lift','lift'],[930,'contact','write-contact','contact'],[1250,'ready','explain','complete','audience']])}),
  Object.freeze({id:'lively',frames:Object.freeze([[0,'contact','write-contact','contact'],[210,'lift','write-lift','lift'],[380,'contact','write-contact','contact'],[610,'ready','explain','check-in','audience'],[820,'contact','write-contact','contact'],[1250,'ready','explain','complete','audience']])})
]);
let academyLastShapeDrawingRhythm=-1;

academyCharacterEngine?.subscribe(snapshot=>{
  const avatar=byId('academyTeachingStage')?.querySelector('.academy-sinbad');if(!avatar)return;
  avatar.dataset.state=snapshot.state;avatar.dataset.gesture=snapshot.gesture;avatar.dataset.gaze=snapshot.gaze;
  avatar.dataset.emotion=snapshot.emotion||'neutral';avatar.style.setProperty('--academy-motion-energy',String(Math.max(0,Math.min(1,Number(snapshot.energy)||0))));
});

function renderAcademyCharacterCue(cue,text){
  stopAcademyIdleBlink();
  const event=cue.state==='walking'?'WALK':cue.state==='listening'?'LISTEN_STARTED':cue.state==='thinking'?'THINK_STARTED':cue.state==='laughing'?'LAUGH':cue.state==='speaking'?'AUDIO_STARTED':cue.state==='idle'?'READY':'TEACH_AT_BOARD';
  academyCharacterEngine?.dispatch(event,{boardText:text,...cue});
  const image=byId('academySinbadImage'),avatar=byId('academyTeachingStage')?.querySelector('.academy-sinbad');if(!image||!avatar)return;
  const rigActive=ACADEMY_FULL_BODY_RIG_CALIBRATED&&['idle','speaking'].includes(cue.state)&&Boolean(academyCharacterRig);avatar.dataset.rigActive=String(rigActive);
  if(rigActive){
    const pose=academyCharacterRig.poseForPerformance?.(cue.state,cue.gesture||'rest',{energy:Math.max(0,Math.min(1,Number(cue.energy)||.24))})||academyCharacterRig.poseForState?.(cue.state);
    const balanced=pose?.accepted?academyCharacterRig.balanceControlsForPerformance?.(cue.state,cue.gesture||'rest',pose.controls):null;
    const css=academyCharacterRig.cssVariables?.(balanced?.accepted?balanced.controls:pose?.controls);
    if(css?.accepted)Object.entries(css.variables).forEach(([name,value])=>avatar.style.setProperty(name,value));
  }
  const stateAsset=cue.state==='walking'?ACADEMY_CHARACTER_ASSETS.walking[cue.walkFrame===1?1:0]:ACADEMY_CHARACTER_ASSETS[cue.state];
  image.src=stateAsset||ACADEMY_CHARACTER_ASSETS['board-teaching'];
  avatar.dataset.motionRevision=String((Number(avatar.dataset.motionRevision)||0)+1);
  if(cue.state==='idle')scheduleAcademyIdleBlink();
}

function academyIdleBlinkDelay(){
  const entropy=new Uint32Array(1);window.crypto?.getRandomValues?.(entropy);
  return 3600+(entropy[0]||Math.floor(Math.random()*3601))%3601;
}
function scheduleAcademyIdleBlink(){
  stopAcademyIdleBlink();
  const stage=byId('academyTeachingStage'),avatar=stage?.querySelector('.academy-sinbad');
  if(document.hidden||stage?.dataset.phase!=='welcome'||avatar?.dataset.state!=='idle'||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true)return;
  academyIdleBlinkTimer=setTimeout(()=>{
    const image=byId('academySinbadImage');
    if(!image||document.hidden||stage.dataset.phase!=='welcome'||avatar.dataset.state!=='idle')return;
    if(avatar.dataset.rigActive!=='true')image.src=ACADEMY_CHARACTER_ASSETS.idleBlink;avatar.dataset.microMotion='blink';
    academyIdleBlinkTimer=setTimeout(()=>{if(avatar.dataset.state==='idle'){if(avatar.dataset.rigActive!=='true')image.src=ACADEMY_CHARACTER_ASSETS.idle;delete avatar.dataset.microMotion;scheduleAcademyIdleBlink();}},125);
  },academyIdleBlinkDelay());
}
function stopAcademyIdleBlink(){
  if(academyIdleBlinkTimer!==null)clearTimeout(academyIdleBlinkTimer);academyIdleBlinkTimer=null;
  const avatar=byId('academyTeachingStage')?.querySelector('.academy-sinbad');if(avatar)delete avatar.dataset.microMotion;
}

function academyMouthFrameForText(text,index=0){
  const token=String(text||'').slice(Math.max(0,index),Math.max(0,index)+3).toLocaleLowerCase('tr-TR');
  if(/[oöuü]/u.test(token))return 'round';
  if(/[aeıi]/u.test(token))return 'open';
  return 'closed';
}
function renderAcademyMouthFrame(frame){
  const image=byId('academySinbadImage'),avatar=byId('academyTeachingStage')?.querySelector('.academy-sinbad');
  if(!image||!avatar||avatar.dataset.state!=='speaking')return;
  const safeFrame=Object.hasOwn(ACADEMY_CHARACTER_ASSETS.speakingFrames,frame)?frame:'closed';
  if(avatar.dataset.rigActive!=='true')image.src=ACADEMY_CHARACTER_ASSETS.speakingFrames[safeFrame];avatar.dataset.mouthFrame=safeFrame;
}
function startAcademyLipSync(text){
  stopAcademyLipSync();
  if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true)return;
  const frames=['closed','open','round','open'];let index=0;
  renderAcademyMouthFrame('open');academyLipSyncTimer=setInterval(()=>{renderAcademyMouthFrame(frames[index%frames.length]);index++;},145);
}
function stopAcademyLipSync(){
  if(academyLipSyncTimer!==null)clearInterval(academyLipSyncTimer);academyLipSyncTimer=null;
  const avatar=byId('academyTeachingStage')?.querySelector('.academy-sinbad');if(avatar)delete avatar.dataset.mouthFrame;
}

function settleAcademyCharacter(generation,delay=1400){
  setTimeout(()=>{if(generation!==academyMotionGeneration)return;renderAcademyCharacterCue({state:'idle',gesture:'rest',gaze:'audience'},'');},delay);
}

function playAcademyGestureRequest(request,onComplete=null){
  if(!request?.accepted)return false;
  const acknowledgement=window.SinbadPerformanceDirector?.gestureAcknowledgementForRequest?.(request,academyLanguage());
  if(request.supported!==true){appendAcademyMessage('sinbad',acknowledgement?.text||'Bu hareketi henüz güvenilir biçimde yapamıyorum.');onComplete?.();return true;}
  const generation=++academyMotionGeneration;academyLastPerformedGestureAction=request.action;
  if(request.action==='write-board'&&request.boardText)writeCustomTextAtBoard(request.boardText);
  else if(request.action==='draw-board-shape'&&request.boardShape)drawAllowedShapeAtBoard(request.boardShape,'standard');
  else if(request.action==='walk'){
    [0,1,0,1,0,1].forEach((frame,index)=>setTimeout(()=>{if(generation===academyMotionGeneration)renderAcademyCharacterCue({state:'walking',gesture:'walk',gaze:'path',walkFrame:frame},'');},index*260));
    settleAcademyCharacter(generation,1800);
  }else{
    const state=request.action==='laugh'?'laughing':'speaking';
    renderAcademyCharacterCue({state,...request.cue},'');
    settleAcademyCharacter(generation,request.action==='wave'?1900:1500);
  }
  const text=acknowledgement?.text||'Hareketi yapıyorum.';appendAcademyMessage('sinbad',text);speakAcademyAnswer(text,{preserveMotion:true,onComplete});return true;
}

function preloadAcademyCharacterAssets(){
  [...ACADEMY_CHARACTER_ASSETS.walking,...Object.values(ACADEMY_CHARACTER_ASSETS.writing),...Object.values(ACADEMY_CHARACTER_ASSETS.speakingFrames),...Object.values(ACADEMY_CHARACTER_ASSETS).filter(value=>typeof value==='string')].forEach(src=>{const image=new Image();image.src=src;});
}

function renderAcademyBoardProgress(board,text,index,finished=false){
  board.replaceChildren(document.createTextNode(text.slice(0,index)));
  if(!finished){const cursor=document.createElement('span');cursor.className='academy-chalk-cursor';cursor.setAttribute('aria-hidden','true');board.append(cursor);}
}

function directAcademyWritingGesture(index,text,lastCueBucket){
  const cueBucket=Math.floor(index/42);if(cueBucket===lastCueBucket)return lastCueBucket;
  const audienceTurn=cueBucket%3===2;
  academyCharacterEngine?.dispatch('TEACH_AT_BOARD',{boardText:text,gesture:audienceTurn?'explain':'point-board',gaze:audienceTurn?'audience':'board'});
  return cueBucket;
}

function academyWritingFrameKey(index,text){
  const character=text[index-1]||'';
  if(/[.!?;:]/u.test(character))return 'ready';
  if(/\s/u.test(character))return 'lift';
  return Math.floor(index/3)%2===0?'contact':'lift';
}
function renderAcademyWritingFrame(index,text,lastFrameKey){
  const frameKey=academyWritingFrameKey(index,text);if(frameKey===lastFrameKey)return lastFrameKey;
  const image=byId('academySinbadImage');if(image)image.src=ACADEMY_CHARACTER_ASSETS.writing[frameKey];
  return frameKey;
}

function teachLessonAtBoard(lesson){
  const stage=byId('academyTeachingStage'),title=byId('academyTeachingTitle'),board=byId('academyTeachingText');
  if(!stage||!title||!board)return;
  const text=lesson.objectives.map((objective,index)=>`${index+1}. ${objective}`).join('\n\n').slice(0,500);
  const generation=++academyBoardGeneration;stage.hidden=false;setAcademyClassroomPhase('lesson');title.textContent=lesson.title;board.textContent='';board.removeAttribute('aria-hidden');
  const reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true;
  if(reducedMotion){board.textContent=text;return;}
  let index=0;const writeNext=()=>{if(generation!==academyBoardGeneration)return;index++;renderAcademyBoardProgress(board,text,index,index>=text.length);if(index<text.length)setTimeout(writeNext,/\s/.test(text[index]||'')?35:/[.!?;:]/u.test(text[index]||'')?90:20);};setTimeout(writeNext,240);
}
function writeCustomTextAtBoard(rawText){
  const stage=byId('academyTeachingStage'),title=byId('academyTeachingTitle'),board=byId('academyTeachingText');
  const text=typeof rawText==='string'?rawText.trim().slice(0,200):'';
  if(!stage||!title||!board||!text)return false;
  const generation=++academyBoardGeneration;stage.hidden=false;title.textContent="Captain Sinbad's board";board.textContent='';
  const reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true;
  renderAcademyCharacterCue({state:'board-teaching',gesture:'point-board',gaze:'board'},text);
  if(reducedMotion){board.textContent=text;return true;}
  let index=0,lastCueBucket=-1,lastFrameKey='ready';const writeNext=()=>{if(generation!==academyBoardGeneration)return;index++;lastCueBucket=directAcademyWritingGesture(index,text,lastCueBucket);lastFrameKey=renderAcademyWritingFrame(index,text,lastFrameKey);renderAcademyBoardProgress(board,text,index,index>=text.length);if(index<text.length)setTimeout(writeNext,/\s/.test(text[index]||'')?55:/[.!?;:]/u.test(text[index]||'')?130:30);else renderAcademyCharacterCue({state:'board-teaching',gesture:'explain',gaze:'audience'},text);};setTimeout(writeNext,320);return true;
}
function selectAcademyShapeDrawingRhythm(){
  const count=ACADEMY_SHAPE_DRAWING_RHYTHMS.length,entropy=globalThis.crypto?.getRandomValues?globalThis.crypto.getRandomValues(new Uint32Array(1))[0]:Math.floor(Math.random()*0x100000000);let index=count===1?0:entropy%(academyLastShapeDrawingRhythm<0?count:count-1);if(academyLastShapeDrawingRhythm>=0&&index>=academyLastShapeDrawingRhythm)index++;academyLastShapeDrawingRhythm=index;return ACADEMY_SHAPE_DRAWING_RHYTHMS[index];
}
function animateAllowedShapeDrawing(generation,shape,reducedMotion=false){
  const stage=byId('academyTeachingStage'),image=byId('academySinbadImage');if(!stage||!image)return;
  const rhythm=selectAcademyShapeDrawingRhythm();stage.dataset.boardDrawingRhythm=rhythm.id;
  const renderFrame=(frameKey,gesture,phase,gaze='board')=>{if(generation!==academyBoardGeneration)return;stage.dataset.boardDrawingPhase=phase;image.src=ACADEMY_CHARACTER_ASSETS.writing[frameKey];academyCharacterEngine?.dispatch('TEACH_AT_BOARD',{boardText:shape,gesture,gaze});};
  if(reducedMotion){renderFrame('ready','explain','complete','audience');return;}
  rhythm.frames.forEach(([delay,frameKey,gesture,phase,gaze])=>setTimeout(()=>renderFrame(frameKey,gesture,phase,gaze),delay));
}
function drawAllowedShapeAtBoard(shape,size='standard'){
  const definitions=Object.freeze({
    circle:Object.freeze({element:'circle',attributes:Object.freeze({cx:'120',cy:'90',r:'62'}),length:'390',label:'Sinbad drew a circle'}),
    triangle:Object.freeze({element:'path',attributes:Object.freeze({d:'M120 24 L202 154 L38 154 Z'}),length:'470',label:'Sinbad drew a triangle'}),
    rectangle:Object.freeze({element:'path',attributes:Object.freeze({d:'M38 34 H202 V146 H38 Z'}),length:'555',label:'Sinbad drew a rectangle'}),
    hexagon:Object.freeze({element:'path',attributes:Object.freeze({d:'M72 28 H168 L216 90 L168 152 H72 L24 90 Z'}),length:'505',label:'Sinbad drew a hexagon'}),
    arrow:Object.freeze({element:'path',attributes:Object.freeze({d:'M32 90 H194 M164 60 L194 90 L164 120'}),length:'250',label:'Sinbad drew an arrow'}),
    axes:Object.freeze({element:'path',attributes:Object.freeze({d:'M26 90 H214 M188 74 L214 90 L188 106 M120 158 V22 M104 48 L120 22 L136 48'}),length:'475',label:'Sinbad drew coordinate axes'})
  }),definition=definitions[shape],safeSize=['small','standard','large'].includes(size)?size:null;
  if(!definition||!safeSize)return false;
  const stage=byId('academyTeachingStage'),title=byId('academyTeachingTitle'),board=byId('academyTeachingText');if(!stage||!title||!board)return false;
  const generation=++academyBoardGeneration;stage.hidden=false;title.textContent="Captain Sinbad's board";board.replaceChildren();
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 240 180');svg.setAttribute('role','img');svg.setAttribute('aria-label',definition.label);svg.dataset.boardShape=shape;svg.dataset.boardSize=safeSize;svg.style.cssText=`display:block;width:min(100%,${safeSize==='large'?430:safeSize==='small'?260:360}px);height:auto;margin:0 auto;overflow:visible`;
  const line=document.createElementNS(svg.namespaceURI,definition.element);for(const [name,value] of Object.entries(definition.attributes))line.setAttribute(name,value);line.setAttribute('fill','none');line.setAttribute('stroke','#f2f4df');line.setAttribute('stroke-width','6');line.setAttribute('stroke-linecap','round');line.setAttribute('stroke-linejoin','round');line.style.strokeDasharray=definition.length;line.style.strokeDashoffset=definition.length;svg.append(line);board.append(svg);
  const reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true;animateAllowedShapeDrawing(generation,shape,reducedMotion);
  if(reducedMotion){line.style.strokeDashoffset='0';return true;}
  line.style.transition='stroke-dashoffset 1100ms ease-in-out';requestAnimationFrame(()=>requestAnimationFrame(()=>{if(generation===academyBoardGeneration)line.style.strokeDashoffset='0';}));
  return true;
}
function clearAcademyBoard(onApplied){
  const stage=byId('academyTeachingStage'),board=byId('academyTeachingText'),image=byId('academySinbadImage');if(!stage||!board||!image)return false;
  const generation=++academyBoardGeneration;academyPerformanceDirector?.cancel();stage.hidden=false;stage.dataset.boardDrawingPhase='erasing';academyCharacterEngine?.dispatch('TEACH_AT_BOARD',{boardText:'',gesture:'write-contact',gaze:'board'});image.src=ACADEMY_CHARACTER_ASSETS.writing.contact;
  const finish=()=>{if(generation!==academyBoardGeneration)return;board.replaceChildren();stage.dataset.boardDrawingPhase='clear';image.src=ACADEMY_CHARACTER_ASSETS.writing.ready;academyCharacterEngine?.dispatch('TEACH_AT_BOARD',{boardText:'',gesture:'explain',gaze:'audience'});onApplied?.();};
  if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true){finish();return true;}
  setTimeout(()=>{if(generation===academyBoardGeneration)image.src=ACADEMY_CHARACTER_ASSETS.writing.lift;},180);
  setTimeout(()=>{if(generation===academyBoardGeneration)image.src=ACADEMY_CHARACTER_ASSETS.writing.contact;},360);
  setTimeout(finish,620);return true;
}
function stopBoardTeaching(){academyBoardGeneration++;academyPerformanceDirector?.cancel();const stage=byId('academyTeachingStage');if(stage)stage.hidden=false;const board=byId('academyTeachingText');board?.querySelector('.academy-chalk-cursor')?.remove();academyCharacterEngine?.dispatch('READY');}

function saveWindowGeometry(){
  try{localStorage.setItem(GEOMETRY_KEY,JSON.stringify({left:window.screenX,top:window.screenY,width:window.outerWidth,height:window.outerHeight}));}catch{}
}
function restoreWindowGeometry(){
  try{
    const saved=JSON.parse(localStorage.getItem(GEOMETRY_KEY)||'null');
    if(!saved)return;
    const width=Math.max(640,Math.min(Number(saved.width)||1200,screen.availWidth));
    const height=Math.max(520,Math.min(Number(saved.height)||800,screen.availHeight));
    window.resizeTo(width,height);
    window.moveTo(Math.max(screen.availLeft||0,Number(saved.left)||0),Math.max(screen.availTop||0,Number(saved.top)||0));
  }catch{}
}
const gasmBranchLabel=branch=>branch==='DECK'?'Güverte yeterlilikleri':branch==='ENGINE'?'Makine yeterlilikleri':'Elektro-teknik yeterlilikleri';
const gasmTopicLabel=code=>String(code||'GENEL').split('_').map(word=>word.charAt(0)+word.slice(1).toLocaleLowerCase('tr-TR')).join(' ');
function gasmQuestionsFor({qualificationCode,subjectCode,topicCode=null}){
  return gasmCatalog.questions.filter(item=>item.subjectCode===subjectCode&&item.qualificationCodes.includes(qualificationCode)&&(!topicCode||item.topicCode===topicCode));
}
function renderGasmQualificationMenu(){
  const root=byId('gasmQualificationList');if(!root)return;root.replaceChildren();
  for(const branch of ['DECK','ENGINE','ELECTRO_TECHNICAL']){
    const qualifications=gasmCatalog.qualifications.filter(item=>item.branch===branch);if(!qualifications.length)continue;
    const group=document.createElement('details');group.className='gasm-branch';group.open=branch==='DECK';
    const summary=document.createElement('summary');summary.textContent=gasmBranchLabel(branch);group.append(summary);
    qualifications.forEach(qualification=>{
      const detail=document.createElement('details');detail.className='gasm-qualification';detail.dataset.qualificationCode=qualification.code;
      const heading=document.createElement('summary');heading.innerHTML=`<span>${qualification.name}</span><small>${qualification.subjects.length} zorunlu ders</small>`;detail.append(heading);
      const subjects=document.createElement('div');subjects.className='gasm-subjects';
      qualification.subjects.forEach(subject=>{
        const count=gasmQuestionsFor({qualificationCode:qualification.code,subjectCode:subject.code}).length;
        const button=document.createElement('button');button.type='button';button.className='gasm-subject-button';button.dataset.qualificationCode=qualification.code;button.dataset.subjectCode=subject.code;
        button.innerHTML=`<span>${subject.code} · ${subject.name}</span><b>%${subject.passScore}</b><small>${count?`${count} arşiv sorusu`:'Arşiv sorusu henüz yok'}</small>`;
        button.addEventListener('click',()=>selectGasmSubject(qualification,subject,button));subjects.append(button);
      });detail.append(subjects);group.append(detail);
    });root.append(group);
  }
}
function selectGasmSubject(qualification,subject,button){
  document.querySelectorAll('.gasm-subject-button').forEach(node=>node.classList.toggle('active',node===button));
  gasmSelection=Object.freeze({qualificationCode:qualification.code,subjectCode:subject.code,topicCode:null,index:0,selectedOption:null});
  const questions=gasmQuestionsFor(gasmSelection),topics=[...new Set(questions.map(item=>item.topicCode))].sort();
  const detail=button.closest('.gasm-qualification'),old=detail.querySelector('.gasm-topic-list');old?.remove();
  if(topics.length){const list=document.createElement('div');list.className='gasm-topic-list';const all=document.createElement('button');all.type='button';all.className='gasm-topic-button';all.textContent=`Tüm konular (${questions.length})`;all.addEventListener('click',()=>openGasmTest(null));list.append(all);topics.forEach(topic=>{const topicQuestions=gasmQuestionsFor({...gasmSelection,topicCode:topic}),node=document.createElement('button');node.type='button';node.className='gasm-topic-button';node.textContent=`${gasmTopicLabel(topic)} (${topicQuestions.length})`;node.addEventListener('click',()=>openGasmTest(topic));list.append(node);});detail.append(list);}
  openGasmTest(null);
}
function openGasmTest(topicCode){
  gasmSelection=Object.freeze({...gasmSelection,topicCode,index:0,selectedOption:null});renderGasmTest();
}
function renderGasmTest(){
  stopBoardTeaching();setAcademyClassroomPhase('lesson');startAcademyLessonClock();
  const output=byId('academyOutput');output.hidden=false;output.replaceChildren();
  const qualification=gasmCatalog.qualifications.find(item=>item.code===gasmSelection.qualificationCode),subject=qualification?.subjects.find(item=>item.code===gasmSelection.subjectCode),questions=gasmQuestionsFor(gasmSelection);
  const header=document.createElement('div');header.className='gasm-test-header';header.innerHTML=`<div><strong>${qualification?.name||'GOSS / GASM'}</strong><br><small>${subject?`${subject.code} · ${subject.name} · Geçme notu %${subject.passScore}`:'Ders seçiniz'}</small></div><b>${questions.length?`${Math.min(gasmSelection.index+1,questions.length)} / ${questions.length}`:'0 soru'}</b>`;output.append(header);
  if(!questions.length){const empty=document.createElement('p');empty.className='gasm-empty';empty.textContent='Bu yeterlilik ve ders için sınıflandırılmış arşiv sorusu henüz bulunmuyor. Sistem soru uydurmayacak; doğrulanmış içerik eklendiğinde test burada otomatik açılacak.';output.append(empty);return;}
  const item=questions[gasmSelection.index%questions.length],card=document.createElement('article');card.className='gasm-question-card';
  const meta=document.createElement('div');meta.className='gasm-question-meta';meta.innerHTML=`<span>Konu: ${gasmTopicLabel(item.topicCode)}</span><span>·</span><span>Kaynak: ${item.sourceClass}</span><span>·</span><span>İçerik: ${item.reviewStatus==='APPROVED'?'onaylı':'insan kontrolü bekliyor'}</span>`;card.append(meta);
  const stem=document.createElement('h2');stem.textContent=item.stem;card.append(stem);
  const choices=document.createElement('div');choices.className='academy-choices';item.options.forEach(option=>{const button=document.createElement('button');button.type='button';button.className='gasm-option';button.innerHTML=`<b>${option.label}</b><span></span>`;button.lastElementChild.textContent=option.text;button.addEventListener('click',()=>{choices.querySelectorAll('button').forEach(node=>node.classList.remove('selected'));button.classList.add('selected');gasmSelection=Object.freeze({...gasmSelection,selectedOption:option.label});});choices.append(button);});card.append(choices);
  const note=document.createElement('p');note.className='gasm-status-note';note.textContent=item.answerStatus==='REPORTED'?'Cevabınız kaydedilir. Arşivde raporlanmış cevap vardır; insan doğrulaması tamamlanmadan kesin doğru/yanlış sonucu gösterilmez.':'Cevabınız kaydedilir. Doğru cevap insan tarafından doğrulanmadığı için sistem tahmin üretmez.';card.append(note);
  const actions=document.createElement('div');actions.className='gasm-test-actions';const previous=document.createElement('button'),next=document.createElement('button');previous.type=next.type='button';previous.className=next.className='btn';previous.textContent='← Önceki soru';next.textContent='Sonraki soru →';previous.disabled=gasmSelection.index===0;previous.addEventListener('click',()=>{gasmSelection=Object.freeze({...gasmSelection,index:Math.max(0,gasmSelection.index-1),selectedOption:null});renderGasmTest();});next.addEventListener('click',()=>{gasmSelection=Object.freeze({...gasmSelection,index:(gasmSelection.index+1)%questions.length,selectedOption:null});renderGasmTest();});actions.append(previous,next);card.append(actions);output.append(card);
}
function renderLesson(){
  const category=byId('academyModule').value,lesson=window.SinbadAcademy?.lesson(category,window.SINBAD_TRAINING_DATA),output=byId('academyOutput');
  if(!lesson){setAcademyClassroomPhase('lesson');startAcademyLessonClock();byId('academyTeachingTitle').textContent='Ders hazırlanıyor';byId('academyTeachingText').textContent='Bu eğitim modülünün doğrulanmış içeriği henüz hazır değil.';byId('academyTeachingText').removeAttribute('aria-hidden');return;}
  const progress=JSON.parse(localStorage.getItem('sinbad_academy_progress')||'{}');progress[category]={openedAt:new Date().toISOString(),status:'studying'};localStorage.setItem('sinbad_academy_progress',JSON.stringify(progress));
  startAcademyLessonClock();teachLessonAtBoard(lesson);
  output.hidden=true;
  output.textContent=`${lesson.title}\n\nLearning objectives\n${lesson.objectives.map(x=>'• '+x).join('\n')}\n\nPractice\n${lesson.practice}\n\nOfficial offline sources\n${lesson.sources.map((x,i)=>`[S${i+1}] ${x.title} — ${x.authority}`).join('\n')||'No matching offline source.'}\n\n⚠ Training only. Operational decisions require current official information and captain approval.`;
}
function renderQuiz(){
  stopBoardTeaching();
  const category=byId('academyModule').value,items=window.SinbadAcademy?.quiz(category)||[],output=byId('academyOutput');if(!items.length)return;
  setAcademyClassroomPhase('lesson');startAcademyLessonClock();output.hidden=false;
  const item=items[Math.floor(Math.random()*items.length)];output.replaceChildren();const title=document.createElement('strong');title.textContent=item.q;output.append(title);
  if(item.kind==='source-page'){
    const image=document.createElement('img');image.className='academy-question-page';image.src=item.image;image.alt=`${item.q}, kaynak sayfa ${item.page}`;output.append(image);
    const notice=document.createElement('p');notice.className='academy-answer-pending';
    if(item.answerStatus==='official-key-verified'){
      notice.textContent='Doğrulanmış cevap anahtarı yalnız yetkili Owner inceleme ekranında gösterilir.';
    }else if(item.answerStatus==='official-key-image-needs-human-verification'){
      notice.textContent=`Sorular ${item.firstQuestion}-${item.lastQuestion} · Resmî anahtar taraması mevcut; okunamayan harfler tahmin edilmedi ve insan doğrulaması bekliyor.`;
    }else notice.textContent=`Sorular ${item.firstQuestion}-${item.lastQuestion} · Cevap anahtarı bekleniyor. Taramadaki öğrenci işaretlemeleri doğru cevap kabul edilmez.`;
    output.append(notice);
    const source=document.createElement('small');source.className='academy-source';source.textContent=`Kaynak: ${item.source} · sayfa ${item.page}`;output.append(source);return;
  }
  const choices=document.createElement('div');choices.className='academy-choices';item.choices.forEach((choice,index)=>{const button=document.createElement('button');button.type='button';button.className='btn';button.textContent=choice;button.addEventListener('click',()=>{[...choices.children].forEach(node=>node.disabled=true);button.classList.add(index===item.answer?'primary':'danger');const result=document.createElement('p');result.textContent=`${index===item.answer?'✓ Correct':'✗ Review'} — ${item.explanation} [${item.source}]`;output.append(result);});choices.append(button);});output.append(choices);const source=document.createElement('small');source.className='academy-source';source.textContent=`Official source: ${item.source}`;output.append(source);
}
function selectAcademySection(sectionId){
  const section=ACADEMY_SECTIONS[sectionId]||ACADEMY_SECTIONS['general-maritime-education'];
  document.querySelectorAll('[data-academy-section]').forEach(button=>{const active=button.dataset.academySection===sectionId;button.classList.toggle('active',active);if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});
  byId('academyTrackTitle').textContent=section.title;byId('academyTrackLabel').textContent=section.label;
  const select=byId('academyModule');select.replaceChildren();
  byId('openExamIntelligence').hidden=sectionId!=='goss-gasm';byId('openOwnerQuestionReview').hidden=sectionId!=='goss-gasm';
  const gasmMenu=byId('gasmQualificationMenu'),gasmButton=byId('gasmMenuButton');if(gasmMenu)gasmMenu.hidden=sectionId!=='goss-gasm';if(gasmButton)gasmButton.setAttribute('aria-expanded',String(sectionId==='goss-gasm'));
  academyModuleOptions.filter(option=>section.modules.includes(option.value)).forEach(option=>{const node=document.createElement('option');node.value=option.value;node.textContent=option.label;select.append(node);});
  stopBoardTeaching();resetAcademyLessonClock();setAcademyClassroomPhase('welcome');const output=byId('academyOutput');output.replaceChildren();output.hidden=true;byId('academyTeachingTitle').textContent="Professor Sinbad's board";byId('academyTeachingText').replaceChildren();byId('academyTeachingText').setAttribute('aria-hidden','true');
}
function handleAcademySectionClick(button){
  const sectionId=button.dataset.academySection,menu=byId('gasmQualificationMenu');
  if(sectionId==='goss-gasm'&&button.classList.contains('active')&&menu){menu.hidden=!menu.hidden;button.setAttribute('aria-expanded',String(!menu.hidden));return;}
  selectAcademySection(sectionId);
}
function appendAcademyMessage(role,text){
  const conversation=byId('academyConversation'),message=document.createElement('p');message.className=`academy-message ${role}`;message.textContent=text;conversation.append(message);
  while(conversation.children.length>20)conversation.firstElementChild.remove();conversation.scrollTop=conversation.scrollHeight;
}
function speakAcademyAnswer(text,{preserveMotion=false,onComplete=null}={}){
  if(!('speechSynthesis' in window)||typeof SpeechSynthesisUtterance==='undefined'){onComplete?.();return;}
  speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(text.slice(0,1800));utterance.lang=academyLanguage();
  const voiceLanguage=academyLanguage().split('-')[0].toLocaleLowerCase('en-US');
  const matchingVoice=speechSynthesis.getVoices().find(voice=>String(voice.lang||'').toLocaleLowerCase('en-US').startsWith(voiceLanguage));
  if(matchingVoice)utterance.voice=matchingVoice;
  let completed=false;const finish=()=>{if(completed)return;completed=true;onComplete?.();};
  if(!preserveMotion){
    const generation=++academyMotionGeneration;utterance.onstart=()=>{academySpeechGestureDirector?.beginTurn?.();const semantic=window.SinbadPerformanceDirector?.responseCueForText?.(text,'conversational')?.cue||{gesture:'explain',gaze:'audience',emotion:'warm'};const selected=academySpeechGestureDirector?.select?.({...semantic,cadence:'opening',responseKind:semantic.responseKind||'conversation'});renderAcademyCharacterCue({state:'speaking',...(selected?.cue||semantic)},text);startAcademyLipSync(text);};utterance.onboundary=event=>{if(generation!==academyMotionGeneration)return;const charIndex=Number(event.charIndex)||0,wordIndex=Math.max(0,text.slice(0,charIndex).trim().split(/\s+/u).filter(Boolean).length),boundary=window.SinbadPerformanceDirector?.speechCueForBoundary?.({text,name:event.name||'word',charIndex,wordIndex,mode:'warm'}),selected=boundary?.accepted?academySpeechGestureDirector?.select?.(boundary.cue):null;if(selected?.change&&selected.cue?.gesture)renderAcademyCharacterCue({state:'speaking',...selected.cue},text);renderAcademyMouthFrame(academyMouthFrameForText(text,charIndex));};utterance.onend=()=>{stopAcademyLipSync();settleAcademyCharacter(generation,180);finish();};utterance.onerror=()=>{stopAcademyLipSync();settleAcademyCharacter(generation,180);finish();};
  }else{
    utterance.onend=finish;utterance.onerror=finish;
  }
  speechSynthesis.speak(utterance);
}
function academyDialogueHistory(){
  return [...byId('academyConversation').querySelectorAll('.academy-message')].slice(-10).map(message=>Object.freeze({role:message.classList.contains('student')?'user':'assistant',content:String(message.textContent||'').slice(0,1800)}));
}
function updateAcademyRuntimePill(id,text,state='online'){
  const pill=byId(id);if(!pill)return;pill.textContent=text;pill.classList.toggle('pending',state==='pending');pill.classList.toggle('offline',state==='offline');
}
function refreshAcademyExamStatus(){
  const status=academyExamIntegration?.publicStatus?.(),button=byId('openExamIntelligence');
  if(!status){updateAcademyRuntimePill('academyExamConnection','Sınav motoru yapılandırılmadı','offline');button.disabled=true;return;}
  updateAcademyRuntimePill('academyExamConnection',status.releaseAuthorized?'Sınav motoru · kontrollü yayın':'Sınav motoru · sentetik/yerel',status.releaseAuthorized?'online':'pending');button.disabled=false;
}
function openExamIntelligence(){
  try{academyExamIntegration.launch();}
  catch(error){console.warn('Exam Intelligence launch unavailable',error);updateAcademyRuntimePill('academyExamConnection','Sınav motoru açılamadı','offline');}
}
function openOwnerQuestionReview(){
  try{academyOwnerReviewIntegration?.launch();}
  catch(error){console.warn('Owner question review launch unavailable',error);}
}
async function refreshAcademyRuntimeStatus(){
  let lastError=null;
  for(let attempt=0;attempt<2;attempt++){
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),5000);
    try{
      const response=await fetch(`${SINBAD_BRIDGE_URL}/status`,{cache:'no-store',signal:controller.signal});if(!response.ok)throw new Error(`Bridge status ${response.status}`);
      const status=await response.json(),ai=status?.ai||{},library=status?.library||{};
      updateAcademyRuntimePill('academyAiConnection',ai.online?`Yerel AI bağlı · ${ai.model||'Sinbad'}`:'Yerel AI modeli çevrimdışı',ai.online?'online':'offline');
      const documents=Number(library.documents)||0,chunks=Number(library.chunks)||0;
      updateAcademyRuntimePill('academyLibraryConnection',documents>0?`Kütüphane bağlı · ${documents.toLocaleString('tr-TR')} belge · ${chunks.toLocaleString('tr-TR')} parça`:'Kütüphane boş',documents>0?'online':'offline');
      return status;
    }catch(error){lastError=error;if(attempt===0)await new Promise(resolve=>setTimeout(resolve,350));}
    finally{clearTimeout(timeout);}
  }
  console.warn('Academy runtime status unavailable',lastError);updateAcademyRuntimePill('academyAiConnection','Yerel AI bağlantısı yok','offline');updateAcademyRuntimePill('academyLibraryConnection','Kütüphane bağlantısı yok','offline');return null;
}
async function academyLocalAiAnswer(question,academyEvidence='',useOwnerLibrary=false){
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),120000);
  try{
    byId('academyVoiceStatus').textContent='Sinbad düşünüyor…';
    const groundedPrompt=academyEvidence?`Öğrencinin sorusu: ${String(question).slice(0,1200)}\n\nDoğrulanmış çevrimdışı Academy bağlamı (yalnız bu bağlama dayan, eksikse açıkça söyle):\n${String(academyEvidence).slice(0,3500)}`:String(question).slice(0,1200);
    const response=await fetch(`${SINBAD_BRIDGE_URL}/ai/chat`,{method:'POST',headers:{'Content-Type':'application/json',...argosBridgeHeaders('AI_INFERENCE','/ai/chat')},body:JSON.stringify({question:groundedPrompt,libraryQuery:String(question).slice(0,1200),language:academyLanguage(),history:useOwnerLibrary?[]:academyDialogueHistory(),useLibrary:useOwnerLibrary,context:{surface:'sinbad-academy',module:byId('academyModule').value,grounded:Boolean(academyEvidence),ownerLibrary:useOwnerLibrary}}),signal:controller.signal});
    if(!response.ok){byId('academyVoiceStatus').textContent='Yerel AI yanıt hatası';updateAcademyRuntimePill('academyAiConnection','Yerel AI açık · son istek başarısız','offline');refreshAcademyRuntimeStatus();return null;}const data=await response.json();const answer=typeof data?.answer==='string'?data.answer.trim().slice(0,6000):'';
    if(!answer)return null;const model=String(data.model||'Sinbad').slice(0,32);byId('academyVoiceStatus').textContent=`Local AI · ${model}`;updateAcademyRuntimePill('academyAiConnection',`Yerel AI bağlı · ${model}`);if(useOwnerLibrary)refreshAcademyRuntimeStatus();return answer;
  }catch(error){console.warn('Academy local AI unavailable',error);byId('academyVoiceStatus').textContent=error?.name==='AbortError'?'Yerel AI zaman aşımı':'Yerel AI bağlantı hatası';updateAcademyRuntimePill('academyAiConnection','Yerel AI açık · son istek tamamlanamadı','offline');refreshAcademyRuntimeStatus();return null;}finally{clearTimeout(timeout);}
}
function answerAcademySocialTurn(question){
  const normalized=String(question||'').toLocaleLowerCase('tr-TR').normalize('NFC').replace(/[^a-zçğıöşü\s]/gu,' ').replace(/\s+/g,' ').trim();
  const greetings=new Set(['selam','merhaba','günaydın','iyi günler','iyi akşamlar','selam sinbad','merhaba sinbad','günaydın sinbad']);
  if(greetings.has(normalized))return 'Merhaba! Sinbad Academy sınıfına hoş geldiniz. Bugün hangi denizcilik konusunu birlikte çalışalım?';
  if(['nasılsın','nasılsın sinbad','nasılsınız'].includes(normalized))return 'İyiyim, teşekkür ederim. Sınıfta sizinle çalışmaya hazırım. Siz nasılsınız?';
  return null;
}
function academyCharacterCapabilityAnswer(question){
  const normalized=String(question||'').toLocaleLowerCase('tr-TR').normalize('NFC').replace(/[^a-zçğıöşüäß\s]/gu,' ').replace(/\s+/g,' ').trim();
  if(!/(hangi|neler|what|which|welche).*(bedensel|hareket|gesture|movement|bewegung)|(?:ne|neler)\s+yapabiliyorsun/u.test(normalized))return null;
  const language=academyLanguage();
  if(language==='de-DE')return 'Ich kann mich nach links oder rechts drehen, den Kopf bewegen, winken, meine Hände zeigen, nicken, den Kopf schütteln, die Schultern zucken, lächeln, lachen, kurz gehen, zuhören sowie auf die Tafel zeigen, schreiben und freigegebene Formen zeichnen.';
  if(language==='en-US')return 'I can turn left or right, move my head, wave, show my hands, nod, shake my head, shrug, smile, laugh, take a short walk, listen, point at the board, write on it and draw approved shapes.';
  return 'Sola veya sağa dönebilir; başımı çevirebilir, el sallayabilir, ellerimi gösterebilir, başımı sallayabilir, omuz silkebilir, gülümseyebilir, gülebilir, kısa yürüyebilir ve dinleme hareketi yapabilirim. Ayrıca tahtayı işaretleyebilir, yazı yazabilir ve izin verilen şekilleri çizebilirim.';
}
function academyMaritimeFoundationAnswer(question){
  const normalized=String(question||'').toLocaleLowerCase('tr-TR').normalize('NFC').replace(/[^a-zçğıöşüäß\s]/gu,' ').replace(/\s+/g,' ').trim();
  if(!/(?:^|\s)marpol[a-zçğıöşü]*(?:\s|$)/u.test(normalized)||!/(nedir|anlat|tanıt|açıkla|hakkında|what is|explain|tell me about|was ist|erklär)/u.test(normalized))return null;
  const language=academyLanguage();
  if(language==='de-DE')return 'MARPOL ist das Internationale Übereinkommen zur Verhütung der Meeresverschmutzung durch Schiffe. Seine sechs Anlagen behandeln Öl, schädliche flüssige Stoffe als Massengut, Schadstoffe in verpackter Form, Schiffsabwasser, Schiffsmüll und Luftverunreinigung. Diese Zusammenfassung dient der Ausbildung; für einen Betriebsvorgang müssen die aktuelle amtliche Fassung, die anwendbare Anlage und die schiffsspezifischen Vorgaben geprüft werden.';
  if(language==='en-US')return 'MARPOL is the International Convention for the Prevention of Pollution from Ships. Its six annexes address oil, noxious liquid substances in bulk, harmful substances in packaged form, sewage, garbage and air pollution. This is a training summary; an operational decision requires the current official text, the applicable annex and vessel-specific requirements.';
  return 'MARPOL, Gemilerden Kaynaklanan Kirliliğin Önlenmesi Uluslararası Sözleşmesi’dir. Altı eki; petrolü, dökme hâlde taşınan zararlı sıvı maddeleri, ambalajlı zararlı maddeleri, pis suyu, çöpü ve hava kirliliğini düzenler. Bu kısa bir eğitim özetidir; operasyonel işlem için güncel resmî metin, ilgili ek ve gemiye özgü şartlar ayrıca doğrulanmalıdır.';
}
function shouldUseAcademySources(question){
  const normalized=String(question||'').toLocaleLowerCase('tr-TR').normalize('NFC');
  return /\b(deniz|denizcilik|seyir|harita|hidrograf|gelgit|akıntı|set|drift|stcw|goc|gmdss|gasm|goss|navtex|pusula|rota|mevki|liman|gemi|tekne|vardiya|radar|ais|ecdis)\b/u.test(normalized);
}
async function answerAcademyQuestion(){
  const input=byId('academyQuestionInput'),question=input.value.trim().slice(0,1200);if(!question)return;
  academyVoiceBusy=true;
  appendAcademyMessage('student',question);input.value='';
  const gestureRequest=window.SinbadPerformanceDirector?.gestureRequestForText?.(question,{lastAction:academyLastPerformedGestureAction});
  if(gestureRequest?.accepted){playAcademyGestureRequest(gestureRequest,completeAcademyVoiceTurn);return;}
  renderAcademyCharacterCue({state:'thinking',gesture:'hold',gaze:'thought'},question);
  const useOwnerLibrary=shouldUseAcademySources(question),capabilityAnswer=academyCharacterCapabilityAnswer(question),foundationAnswer=academyMaritimeFoundationAnswer(question),socialAnswer=answerAcademySocialTurn(question),result=capabilityAnswer||foundationAnswer||socialAnswer||!useOwnerLibrary?null:window.SinbadAcademy?.answer(question,window.SINBAD_TRAINING_DATA);
  const localAnswer=capabilityAnswer||foundationAnswer||socialAnswer?null:await academyLocalAiAnswer(question,result?.text||'',useOwnerLibrary);
  const answer=capabilityAnswer||foundationAnswer||socialAnswer||localAnswer||result?.text||'Bu soru için doğrulanmış çevrimdışı Academy içeriğinde yeterli kaynak bulamadım ve yerel Sinbad AI bu isteğe yanıt veremedi. Tahmin üretmeyeceğim; lütfen soruyu daraltıp yeniden deneyin.';
  appendAcademyMessage('sinbad',answer);presentAcademyAnswerOnBoard(question,answer);speakAcademyAnswer(answer,{onComplete:completeAcademyVoiceTurn});
}
function updateAcademyHandsFreeButton(){
  const button=byId('toggleAcademyHandsFree');button.setAttribute('aria-pressed',String(academyHandsFreeEnabled));button.textContent=academyHandsFreeEnabled?'🎧 Eller serbest: Açık':'🎧 Eller serbest: Kapalı';
}
function scheduleAcademyHandsFreeListening(delay=500){
  clearTimeout(academyHandsFreeRestartTimer);if(!academyHandsFreeEnabled||academyVoiceBusy)return;
  academyHandsFreeRestartTimer=setTimeout(()=>{if(academyHandsFreeEnabled&&!academyVoiceBusy)startAcademyListening();},delay);
}
function completeAcademyVoiceTurn(){academyVoiceBusy=false;scheduleAcademyHandsFreeListening(650);}
function startAcademyListening(){
  const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;if(!Recognition){byId('academyVoiceStatus').textContent='Voice input unsupported';return;}
  if(academyRecognition)return;academyRecognition=new Recognition();academyRecognition.lang=academyLanguage();academyRecognition.interimResults=false;academyRecognition.maxAlternatives=1;academyRecognition.continuous=academyHandsFreeEnabled;
  academyRecognition.onstart=()=>{byId('academyVoiceStatus').textContent=academyHandsFreeEnabled?'Eller serbest · Dinliyorum…':'Dinliyorum…';byId('startAcademyListening').disabled=true;byId('stopAcademyListening').disabled=false;renderAcademyCharacterCue({state:'listening',gesture:'listen-lean',gaze:'audience'},'');};
  academyRecognition.onresult=event=>{const result=[...event.results].reverse().find(item=>item.isFinal!==false)||event.results[event.results.length-1];const transcript=String(result?.[0]?.transcript||'').trim();if(!transcript)return;byId('academyQuestionInput').value=transcript;if(academyHandsFreeEnabled)academyRecognition?.stop();answerAcademyQuestion();};
  academyRecognition.onerror=event=>{if(event.error!=='aborted')byId('academyVoiceStatus').textContent='Ses girişi kullanılamıyor';};
  academyRecognition.onend=()=>{academyRecognition=null;byId('startAcademyListening').disabled=false;byId('stopAcademyListening').disabled=true;if(!academyVoiceBusy)byId('academyVoiceStatus').textContent=academyHandsFreeEnabled?'Eller serbest · Yeniden dinleniyor…':'Text ready';scheduleAcademyHandsFreeListening();};academyRecognition.start();
}
function setAcademyHandsFree(enabled){
  academyHandsFreeEnabled=Boolean(enabled);updateAcademyHandsFreeButton();clearTimeout(academyHandsFreeRestartTimer);
  if(!academyHandsFreeEnabled){academyRecognition?.abort();window.speechSynthesis?.cancel?.();stopAcademyLipSync();academyVoiceBusy=false;byId('academyVoiceStatus').textContent='Text ready';return;}
  byId('academyVoiceStatus').textContent='Eller serbest başlatılıyor…';startAcademyListening();
}
function returnToAcademyHome(){
  saveWindowGeometry();
  const marineHome=new URL('./index.html',window.location.href).href;
  if(window.opener&&!window.opener.closed){
    try{window.opener.location.assign(marineHome);window.opener.focus();window.close();return;}catch{}
  }
  window.location.assign(marineHome);
}
function goBackFromAcademy(){
  try{const referrer=document.referrer?new URL(document.referrer):null;if(referrer?.origin===location.origin&&history.length>1){history.back();return;}}catch{}returnToAcademyHome();
}
document.title='Sinbad Academy — Professor Sinbad Classroom';
renderGasmQualificationMenu();
selectAcademySection('general-maritime-education');
restoreWindowGeometry();
preloadAcademyCharacterAssets();
renderAcademyCharacterCue({state:'idle',gesture:'rest',gaze:'audience',emotion:'warm',energy:.12},'');
refreshAcademyRuntimeStatus();
refreshAcademyExamStatus();
const academyRuntimeStatusTimer=setInterval(refreshAcademyRuntimeStatus,15000);
window.addEventListener('focus',refreshAcademyRuntimeStatus);window.addEventListener('online',refreshAcademyRuntimeStatus);document.addEventListener('visibilitychange',()=>{if(document.hidden)stopAcademyIdleBlink();else{refreshAcademyRuntimeStatus();scheduleAcademyIdleBlink();}});
document.querySelectorAll('[data-academy-section]').forEach(button=>button.addEventListener('click',()=>handleAcademySectionClick(button)));
byId('startAcademyLesson').addEventListener('click',renderLesson);
byId('startAcademyQuiz').addEventListener('click',renderQuiz);
byId('openExamIntelligence').addEventListener('click',openExamIntelligence);
byId('openOwnerQuestionReview').addEventListener('click',openOwnerQuestionReview);
byId('askAcademyQuestion').addEventListener('click',answerAcademyQuestion);
byId('academyQuestionInput').addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();answerAcademyQuestion();}});
byId('startAcademyListening').addEventListener('click',startAcademyListening);
byId('stopAcademyListening').addEventListener('click',()=>{if(academyHandsFreeEnabled)setAcademyHandsFree(false);else academyRecognition?.stop();});
byId('toggleAcademyHandsFree').addEventListener('click',()=>setAcademyHandsFree(!academyHandsFreeEnabled));
byId('academyLanguage').value=['tr-TR','en-US','de-DE'].includes(localStorage.getItem(LANGUAGE_KEY))?localStorage.getItem(LANGUAGE_KEY):'tr-TR';
byId('academyLanguage').addEventListener('change',()=>{localStorage.setItem(LANGUAGE_KEY,academyLanguage());academyRecognition?.abort();academyRecognition=null;byId('academyVoiceStatus').textContent=academyLanguage()==='tr-TR'?'Türkçe hazır':academyLanguage()==='de-DE'?'Deutsch bereit':'English ready';});
byId('academyBackButton').addEventListener('click',goBackFromAcademy);
byId('academyHomeButton').addEventListener('click',returnToAcademyHome);
byId('closeAcademyWindow').addEventListener('click',()=>{saveWindowGeometry();window.close();});
window.addEventListener('beforeunload',()=>{clearInterval(academyRuntimeStatusTimer);clearTimeout(academyHandsFreeRestartTimer);stopAcademyLipSync();stopAcademyIdleBlink();academyRecognition?.abort();resetAcademyLessonClock();saveWindowGeometry();});
window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==window.opener)return;
  const message=event.data;if(!message||message.version!==1)return;
  let appliedAction=null;
  if(message.type==='SINBAD_ACADEMY_WRITE_BOARD'&&typeof message.text==='string'&&message.text.trim()&&message.text.length<=200&&writeCustomTextAtBoard(message.text))appliedAction=Object.freeze({kind:'text',value:message.text.trim()});
  if(message.type==='SINBAD_ACADEMY_DRAW_SHAPE'&&['circle','triangle','rectangle','hexagon','arrow','axes'].includes(message.shape)&&['small','standard','large'].includes(message.size||'standard')&&drawAllowedShapeAtBoard(message.shape,message.size||'standard'))appliedAction=Object.freeze({kind:'shape',value:message.shape,size:message.size||'standard'});
  if(message.type==='SINBAD_ACADEMY_CLEAR_BOARD'){clearAcademyBoard(()=>window.opener.postMessage({version:1,type:'SINBAD_ACADEMY_BOARD_APPLIED',requestId:message.requestId,action:{kind:'clear',value:'board'}},location.origin));return;}
  if(appliedAction)window.opener.postMessage({version:1,type:'SINBAD_ACADEMY_BOARD_APPLIED',requestId:message.requestId,action:appliedAction},location.origin);
});
window.opener?.postMessage({version:1,type:'SINBAD_ACADEMY_READY'},location.origin);
