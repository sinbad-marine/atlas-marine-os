'use strict';
const byId=id=>document.getElementById(id);
const ACADEMY_SECTIONS=Object.freeze({
  'goss-gasm':Object.freeze({title:'GOSS / GASM Classroom',label:'GOSS / GASM',modules:Object.freeze(['gasm-seyir-sinav'])}),
  stcw:Object.freeze({title:'STCW Classroom',label:'STCW',modules:Object.freeze(['stcw-foundation','colregs-navigation-rules','electronic-navigation','marine-weather'])}),
  goc:Object.freeze({title:'GOC Classroom',label:'GOC',modules:Object.freeze(['goc-foundation'])}),
  'general-maritime-education':Object.freeze({title:'General Maritime Education',label:'GENERAL MARITIME EDUCATION',modules:Object.freeze(['general-maritime-education','chart-reading','tides-water-levels','currents-set-drift'])})
});
const GEOMETRY_KEY='atlas_sinbad_academy_native_window';
const SINBAD_BRIDGE_URL='http://127.0.0.1:31983';
const academyModuleOptions=[...byId('academyModule').options].map(option=>Object.freeze({value:option.value,label:option.textContent}));
const academyCharacterEngine=window.SinbadCharacterEngine?.createCharacterEngine({initialState:'idle'})||null;
const academyPerformanceDirector=window.SinbadPerformanceDirector?.createPerformanceDirector()||null;
const academySpeechGestureDirector=window.SinbadPerformanceDirector?.createSpeechGestureDirector()||null;
const ACADEMY_CHARACTER_ASSETS=Object.freeze({
  walking:Object.freeze(['./assets/captain-sinbad/captain-sinbad-walk-a-v1.png','./assets/captain-sinbad/captain-sinbad-walk-b-v1.png']),
  writing:Object.freeze({ready:'./assets/captain-sinbad/captain-sinbad-board-teaching.png',contact:'./assets/captain-sinbad/captain-sinbad-writing-contact-v1.png',lift:'./assets/captain-sinbad/captain-sinbad-writing-lift-v1.png'}),
  'board-teaching':'./assets/captain-sinbad/captain-sinbad-board-teaching.png',
  idle:'./assets/captain-sinbad/captain-sinbad-idle-master.png',
  listening:'./assets/captain-sinbad/captain-sinbad-listening.png',
  thinking:'./assets/captain-sinbad/captain-sinbad-thinking.png',
  speaking:'./assets/captain-sinbad/captain-sinbad-speaking.png',
  laughing:'./assets/captain-sinbad/captain-sinbad-laughing-v1.png'
});
let academyBoardGeneration=0;
let academyMotionGeneration=0;
let academyLastPerformedGestureAction=null;
let academyLessonStartedAt=null;
let academyLessonClockTimer=null;

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
});

function renderAcademyCharacterCue(cue,text){
  const event=cue.state==='walking'?'WALK':cue.state==='listening'?'LISTEN_STARTED':cue.state==='thinking'?'THINK_STARTED':cue.state==='laughing'?'LAUGH':cue.state==='speaking'?'AUDIO_STARTED':cue.state==='idle'?'READY':'TEACH_AT_BOARD';
  academyCharacterEngine?.dispatch(event,{boardText:text,...cue});
  const image=byId('academySinbadImage'),avatar=byId('academyTeachingStage')?.querySelector('.academy-sinbad');if(!image||!avatar)return;
  const stateAsset=cue.state==='walking'?ACADEMY_CHARACTER_ASSETS.walking[cue.walkFrame===1?1:0]:ACADEMY_CHARACTER_ASSETS[cue.state];
  image.src=stateAsset||ACADEMY_CHARACTER_ASSETS['board-teaching'];
  avatar.dataset.motionRevision=String((Number(avatar.dataset.motionRevision)||0)+1);
}

function settleAcademyCharacter(generation,delay=1400){
  setTimeout(()=>{if(generation!==academyMotionGeneration)return;renderAcademyCharacterCue({state:'idle',gesture:'rest',gaze:'audience'},'');},delay);
}

function playAcademyGestureRequest(request){
  if(!request?.accepted)return false;
  const acknowledgement=window.SinbadPerformanceDirector?.gestureAcknowledgementForRequest?.(request,'tr-TR');
  if(request.supported!==true){appendAcademyMessage('sinbad',acknowledgement?.text||'Bu hareketi henüz güvenilir biçimde yapamıyorum.');return true;}
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
  const text=acknowledgement?.text||'Hareketi yapıyorum.';appendAcademyMessage('sinbad',text);speakAcademyAnswer(text,{preserveMotion:true});return true;
}

function preloadAcademyCharacterAssets(){
  [...ACADEMY_CHARACTER_ASSETS.walking,...Object.values(ACADEMY_CHARACTER_ASSETS.writing),...Object.values(ACADEMY_CHARACTER_ASSETS).filter(value=>typeof value==='string')].forEach(src=>{const image=new Image();image.src=src;});
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
  const generation=++academyBoardGeneration;stage.hidden=false;title.textContent=lesson.title;board.textContent='';
  const reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true;
  academyPerformanceDirector?.play('lesson-opening',cue=>renderAcademyCharacterCue(cue,text),{reducedMotion});
  if(!academyPerformanceDirector)renderAcademyCharacterCue({state:'board-teaching',gesture:'point-board',gaze:'board'},text);
  if(reducedMotion){board.textContent=text;return;}
  let index=0,lastCueBucket=-1,lastFrameKey='ready';const writeNext=()=>{if(generation!==academyBoardGeneration)return;index++;lastCueBucket=directAcademyWritingGesture(index,text,lastCueBucket);lastFrameKey=renderAcademyWritingFrame(index,text,lastFrameKey);renderAcademyBoardProgress(board,text,index,index>=text.length);if(index<text.length)setTimeout(writeNext,/\s/.test(text[index]||'')?55:/[.!?;:]/u.test(text[index]||'')?130:30);else renderAcademyCharacterCue({state:'board-teaching',gesture:'explain',gaze:'audience'},text);};setTimeout(()=>{if(generation===academyBoardGeneration)writeNext();},1680);
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
function renderLesson(){
  const category=byId('academyModule').value,lesson=window.SinbadAcademy?.lesson(category,window.SINBAD_TRAINING_DATA),output=byId('academyOutput');
  if(!lesson)return;
  const progress=JSON.parse(localStorage.getItem('sinbad_academy_progress')||'{}');progress[category]={openedAt:new Date().toISOString(),status:'studying'};localStorage.setItem('sinbad_academy_progress',JSON.stringify(progress));
  startAcademyLessonClock();teachLessonAtBoard(lesson);
  output.hidden=true;
  output.textContent=`${lesson.title}\n\nLearning objectives\n${lesson.objectives.map(x=>'• '+x).join('\n')}\n\nPractice\n${lesson.practice}\n\nOfficial offline sources\n${lesson.sources.map((x,i)=>`[S${i+1}] ${x.title} — ${x.authority}`).join('\n')||'No matching offline source.'}\n\n⚠ Training only. Operational decisions require current official information and captain approval.`;
}
function renderQuiz(){
  stopBoardTeaching();
  const category=byId('academyModule').value,items=window.SinbadAcademy?.quiz(category)||[],output=byId('academyOutput');if(!items.length)return;
  output.hidden=false;
  const item=items[Math.floor(Math.random()*items.length)];output.replaceChildren();const title=document.createElement('strong');title.textContent=item.q;output.append(title);
  if(item.kind==='source-page'){
    const image=document.createElement('img');image.className='academy-question-page';image.src=item.image;image.alt=`${item.q}, kaynak sayfa ${item.page}`;output.append(image);
    const notice=document.createElement('p');notice.className='academy-answer-pending';
    if(item.answerStatus==='official-key-verified'){
      const key=Object.entries(item.answers).map(([question,answer])=>`${question}: ${answer}`).join(' · ');
      notice.textContent=`Doğrulanmış resmî cevap anahtarı · ${key}`;
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
  academyModuleOptions.filter(option=>section.modules.includes(option.value)).forEach(option=>{const node=document.createElement('option');node.value=option.value;node.textContent=option.label;select.append(node);});
  stopBoardTeaching();resetAcademyLessonClock();const output=byId('academyOutput');output.replaceChildren();output.hidden=true;byId('academyTeachingTitle').textContent="Professor Sinbad's board";byId('academyTeachingText').textContent='Derse hoş geldiniz.';
}
function appendAcademyMessage(role,text){
  const conversation=byId('academyConversation'),message=document.createElement('p');message.className=`academy-message ${role}`;message.textContent=text;conversation.append(message);
  while(conversation.children.length>20)conversation.firstElementChild.remove();conversation.scrollTop=conversation.scrollHeight;
}
function speakAcademyAnswer(text,{preserveMotion=false}={}){
  if(!('speechSynthesis' in window)||typeof SpeechSynthesisUtterance==='undefined')return;
  speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(text.slice(0,1800));utterance.lang='tr-TR';
  if(!preserveMotion){
    const generation=++academyMotionGeneration;utterance.onstart=()=>{academySpeechGestureDirector?.beginTurn?.();const semantic=window.SinbadPerformanceDirector?.responseCueForText?.(text,'conversational')?.cue||{gesture:'explain',gaze:'audience',emotion:'warm'};const selected=academySpeechGestureDirector?.select?.({...semantic,cadence:'opening',responseKind:semantic.responseKind||'conversation'});renderAcademyCharacterCue({state:'speaking',...(selected?.cue||semantic)},text);};utterance.onend=()=>settleAcademyCharacter(generation,180);utterance.onerror=()=>settleAcademyCharacter(generation,180);
  }
  speechSynthesis.speak(utterance);
}
function academyDialogueHistory(){
  return [...byId('academyConversation').querySelectorAll('.academy-message')].slice(-10).map(message=>Object.freeze({role:message.classList.contains('student')?'user':'assistant',content:String(message.textContent||'').slice(0,1800)}));
}
async function academyLocalAiAnswer(question,academyEvidence=''){
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),120000);
  try{
    byId('academyVoiceStatus').textContent='Sinbad düşünüyor…';
    const groundedPrompt=academyEvidence?`Öğrencinin sorusu: ${String(question).slice(0,1200)}\n\nDoğrulanmış çevrimdışı Academy bağlamı (yalnız bu bağlama dayan, eksikse açıkça söyle):\n${String(academyEvidence).slice(0,3500)}`:String(question).slice(0,1200);
    const response=await fetch(`${SINBAD_BRIDGE_URL}/ai/chat`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:groundedPrompt,language:'tr-TR',history:academyDialogueHistory(),useLibrary:false,context:{surface:'sinbad-academy',module:byId('academyModule').value,grounded:Boolean(academyEvidence)}}),signal:controller.signal});
    if(!response.ok)return null;const data=await response.json();const answer=typeof data?.answer==='string'?data.answer.trim().slice(0,6000):'';
    if(!answer)return null;byId('academyVoiceStatus').textContent=`Local AI · ${String(data.model||'Sinbad').slice(0,32)}`;return answer;
  }catch(error){console.warn('Academy local AI unavailable',error);byId('academyVoiceStatus').textContent='Yerel AI çevrimdışı';return null;}finally{clearTimeout(timeout);}
}
function answerAcademySocialTurn(question){
  const normalized=String(question||'').toLocaleLowerCase('tr-TR').normalize('NFC').replace(/[^a-zçğıöşü\s]/gu,' ').replace(/\s+/g,' ').trim();
  const greetings=new Set(['selam','merhaba','günaydın','iyi günler','iyi akşamlar','selam sinbad','merhaba sinbad','günaydın sinbad']);
  if(greetings.has(normalized))return 'Merhaba! Sinbad Academy sınıfına hoş geldiniz. Bugün hangi denizcilik konusunu birlikte çalışalım?';
  if(['nasılsın','nasılsın sinbad','nasılsınız'].includes(normalized))return 'İyiyim, teşekkür ederim. Sınıfta sizinle çalışmaya hazırım. Siz nasılsınız?';
  return null;
}
function shouldUseAcademySources(question){
  const normalized=String(question||'').toLocaleLowerCase('tr-TR').normalize('NFC');
  return /\b(deniz|denizcilik|seyir|harita|hidrograf|gelgit|akıntı|set|drift|stcw|goc|gmdss|gasm|goss|navtex|pusula|rota|mevki|liman|gemi|tekne|vardiya|radar|ais|ecdis)\b/u.test(normalized);
}
async function answerAcademyQuestion(){
  const input=byId('academyQuestionInput'),question=input.value.trim().slice(0,1200);if(!question)return;
  appendAcademyMessage('student',question);input.value='';
  const gestureRequest=window.SinbadPerformanceDirector?.gestureRequestForText?.(question,{lastAction:academyLastPerformedGestureAction});
  if(gestureRequest?.accepted){playAcademyGestureRequest(gestureRequest);return;}
  renderAcademyCharacterCue({state:'thinking',gesture:'hold',gaze:'thought'},question);
  const socialAnswer=answerAcademySocialTurn(question),result=socialAnswer||!shouldUseAcademySources(question)?null:window.SinbadAcademy?.answer(question,window.SINBAD_TRAINING_DATA);
  const localAnswer=socialAnswer?null:await academyLocalAiAnswer(question,result?.text||'');
  const answer=socialAnswer||localAnswer||result?.text||'Bu soru için doğrulanmış çevrimdışı Academy içeriğinde yeterli kaynak bulamadım ve yerel Sinbad AI şu anda erişilebilir değil. Tahmin üretmeyeceğim; lütfen soruyu daraltın veya yerel Bridge’i başlatın.';
  appendAcademyMessage('sinbad',answer);speakAcademyAnswer(answer);
}
let academyRecognition=null;
function startAcademyListening(){
  const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;if(!Recognition){byId('academyVoiceStatus').textContent='Voice input unsupported';return;}
  academyRecognition?.abort();academyRecognition=new Recognition();academyRecognition.lang='tr-TR';academyRecognition.interimResults=false;academyRecognition.maxAlternatives=1;
  academyRecognition.onstart=()=>{byId('academyVoiceStatus').textContent='Listening…';byId('startAcademyListening').disabled=true;byId('stopAcademyListening').disabled=false;renderAcademyCharacterCue({state:'listening',gesture:'listen-lean',gaze:'audience'},'');};
  academyRecognition.onresult=event=>{byId('academyQuestionInput').value=event.results[0][0].transcript;answerAcademyQuestion();};
  academyRecognition.onerror=()=>{byId('academyVoiceStatus').textContent='Voice input unavailable';};
  academyRecognition.onend=()=>{byId('startAcademyListening').disabled=false;byId('stopAcademyListening').disabled=true;if(byId('academyVoiceStatus').textContent==='Listening…')byId('academyVoiceStatus').textContent='Text ready';};academyRecognition.start();
}
document.title='Sinbad Academy — Professor Sinbad Classroom';
selectAcademySection('general-maritime-education');
restoreWindowGeometry();
preloadAcademyCharacterAssets();
document.querySelectorAll('[data-academy-section]').forEach(button=>button.addEventListener('click',()=>selectAcademySection(button.dataset.academySection)));
byId('startAcademyLesson').addEventListener('click',renderLesson);
byId('startAcademyQuiz').addEventListener('click',renderQuiz);
byId('askAcademyQuestion').addEventListener('click',answerAcademyQuestion);
byId('academyQuestionInput').addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();answerAcademyQuestion();}});
byId('startAcademyListening').addEventListener('click',startAcademyListening);
byId('stopAcademyListening').addEventListener('click',()=>academyRecognition?.stop());
byId('closeAcademyWindow').addEventListener('click',()=>{saveWindowGeometry();window.close();});
window.addEventListener('beforeunload',()=>{resetAcademyLessonClock();saveWindowGeometry();});
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
