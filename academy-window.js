'use strict';
const byId=id=>document.getElementById(id);
const GEOMETRY_KEY='atlas_sinbad_academy_native_window';
const VOICE_KEY='atlas_sinbad_academy_voice_enabled';
const HISTORY_KEY='atlas_sinbad_academy_messages';
const AVATARS={idle:'./assets/captain-sinbad/captain-sinbad-idle-master.png',teaching:'./assets/captain-sinbad/captain-sinbad-board-teaching.png',speaking:'./assets/captain-sinbad/captain-sinbad-speaking.png',listening:'./assets/captain-sinbad/captain-sinbad-listening.png',thinking:'./assets/captain-sinbad/captain-sinbad-thinking.png'};
const DEFAULT_CLOUD={url:'https://kcvyftrvteqmabvxfebu.supabase.co',key:'sb_publishable_ZBHFlbhQAnhUAOyVg20Szw_nW0QDj_l'};
const academyCharacterEngine=window.SinbadCharacterEngine?.createCharacterEngine({initialState:'idle'})||null;
const academyPerformanceDirector=window.SinbadPerformanceDirector?.createPerformanceDirector()||null;
const ACADEMY_CHARACTER_ASSETS=Object.freeze({
  walking:Object.freeze(['./assets/captain-sinbad/captain-sinbad-walk-a-v1.png','./assets/captain-sinbad/captain-sinbad-walk-b-v1.png']),
  writing:Object.freeze({ready:'./assets/captain-sinbad/captain-sinbad-board-teaching.png',contact:'./assets/captain-sinbad/captain-sinbad-writing-contact-v1.png',lift:'./assets/captain-sinbad/captain-sinbad-writing-lift-v1.png'}),
  'board-teaching':'./assets/captain-sinbad/captain-sinbad-board-teaching.png'
});
let academyBoardGeneration=0;
const ACADEMY_SHAPE_DRAWING_RHYTHMS=Object.freeze([
  Object.freeze({id:'steady',frames:Object.freeze([[0,'contact','write-contact','contact'],[260,'lift','write-lift','lift'],[440,'contact','write-contact','contact'],[720,'ready','explain','check-in','audience'],[880,'contact','write-contact','contact'],[1250,'ready','explain','complete','audience']])}),
  Object.freeze({id:'measured',frames:Object.freeze([[0,'contact','write-contact','contact'],[340,'ready','explain','check-in','audience'],[510,'contact','write-contact','contact'],[760,'lift','write-lift','lift'],[930,'contact','write-contact','contact'],[1250,'ready','explain','complete','audience']])}),
  Object.freeze({id:'lively',frames:Object.freeze([[0,'contact','write-contact','contact'],[210,'lift','write-lift','lift'],[380,'contact','write-contact','contact'],[610,'ready','explain','check-in','audience'],[820,'contact','write-contact','contact'],[1250,'ready','explain','complete','audience']])})
]);
let academyLastShapeDrawingRhythm=-1;
let voiceEnabled=localStorage.getItem(VOICE_KEY)!=='false',lastNarration='',narrationRun=0,cloudClient=null,cloudSession=null;
let messages=loadMessages(),recognition=null,objectUrls=[];

function renderCharacterSnapshot(snapshot){
  const stage=byId('academyInstructorStage'),image=byId('academySinbadAvatar');if(!stage||!image)return;
  stage.dataset.state=snapshot.state;stage.dataset.gesture=snapshot.gesture;stage.dataset.gaze=snapshot.gaze;stage.dataset.emotion=snapshot.emotion;
  const boardAvatar=byId('academyTeachingStage')?.querySelector('.academy-sinbad');
  if(boardAvatar){boardAvatar.dataset.state=snapshot.state;boardAvatar.dataset.gesture=snapshot.gesture;boardAvatar.dataset.gaze=snapshot.gaze;boardAvatar.dataset.emotion=snapshot.emotion;}
  const pose=window.SinbadCharacterRig?.poseForState(snapshot.state),rig=pose?.accepted&&window.SinbadCharacterRig?.cssVariables(pose.controls);
  if(rig?.accepted)Object.entries(rig.variables).forEach(([name,value])=>stage.style.setProperty(name,value));
  image.src=AVATARS[snapshot.state]||AVATARS[snapshot.state==='board-teaching'?'teaching':'idle']||AVATARS.idle;
}
academyCharacterEngine?.subscribe(renderCharacterSnapshot);

function renderAcademyCharacterCue(cue,text){
  const event=cue.state==='walking'?'WALK':'TEACH_AT_BOARD';
  const result=academyCharacterEngine?.dispatch(event,{boardText:text,...cue});
  if(!result?.accepted)return false;
  const image=byId('academySinbadImage');if(!image)return;
  image.src=cue.state==='walking'?ACADEMY_CHARACTER_ASSETS.walking[cue.walkFrame===1?1:0]:ACADEMY_CHARACTER_ASSETS['board-teaching'];
  return true;
}

function preloadAcademyCharacterAssets(){
  [...ACADEMY_CHARACTER_ASSETS.walking,...Object.values(ACADEMY_CHARACTER_ASSETS.writing),ACADEMY_CHARACTER_ASSETS['board-teaching']].forEach(src=>{const image=new Image();image.src=src;});
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
  const renderFrame=(frameKey,gesture,phase,gaze='board')=>{if(generation!==academyBoardGeneration)return;const result=academyCharacterEngine?.dispatch('TEACH_AT_BOARD',{boardText:shape,gesture,gaze});if(!result?.accepted){stage.dataset.boardDrawingPhase='blocked';return;}stage.dataset.boardDrawingPhase=phase;image.src=ACADEMY_CHARACTER_ASSETS.writing[frameKey];};
  if(reducedMotion){renderFrame('ready','explain','complete','audience');return;}
  rhythm.frames.forEach(([delay,frameKey,gesture,phase,gaze])=>setTimeout(()=>renderFrame(frameKey,gesture,phase,gaze),delay));
}
function drawAllowedShapeAtBoard(shape,size='standard'){
  const definitions=Object.freeze({
    circle:Object.freeze({element:'circle',attributes:Object.freeze({cx:'120',cy:'90',r:'62'}),length:'390',label:'Sinbad drew a circle'}),
    triangle:Object.freeze({element:'path',attributes:Object.freeze({d:'M120 24 L202 154 L38 154 Z'}),length:'470',label:'Sinbad drew a triangle'}),
    rectangle:Object.freeze({element:'path',attributes:Object.freeze({d:'M38 34 H202 V146 H38 Z'}),length:'555',label:'Sinbad drew a rectangle'}),
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
function stopBoardTeaching(){academyBoardGeneration++;academyPerformanceDirector?.cancel();const stage=byId('academyTeachingStage');if(stage)stage.hidden=true;const board=byId('academyTeachingText');board?.querySelector('.academy-chalk-cursor')?.remove();academyCharacterEngine?.dispatch('READY');}

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
  teachLessonAtBoard(lesson);
  output.textContent=`${lesson.title}\n\nLearning objectives\n${lesson.objectives.map(x=>'• '+x).join('\n')}\n\nPractice\n${lesson.practice}\n\nOfficial offline sources\n${lesson.sources.map((x,i)=>`[S${i+1}] ${x.title} — ${x.authority}`).join('\n')||'No matching offline source.'}\n\n⚠ Training only. Operational decisions require current official information and captain approval.`;
}
function renderQuiz(){
  stopBoardTeaching();
  const category=byId('academyModule').value,items=window.SinbadAcademy?.quiz(category)||[],output=byId('academyOutput');if(!items.length)return;
  const item=items[Math.floor(Math.random()*items.length)];output.replaceChildren();const title=document.createElement('strong');title.textContent=item.q;output.append(title);
  const choices=document.createElement('div');choices.className='academy-choices';item.choices.forEach((choice,index)=>{const button=document.createElement('button');button.type='button';button.className='btn';button.textContent=choice;button.addEventListener('click',()=>{[...choices.children].forEach(node=>node.disabled=true);button.classList.add(index===item.answer?'primary':'danger');const result=document.createElement('p');result.textContent=`${index===item.answer?'✓ Correct':'✗ Review'} — ${item.explanation} [${item.source}]`;output.append(result);});choices.append(button);});output.append(choices);const source=document.createElement('small');source.className='academy-source';source.textContent=`Official source: ${item.source}`;output.append(source);
}
preloadAcademyCharacterAssets();
window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==window.opener)return;
  const message=event.data;if(!message||message.version!==1)return;
  let appliedAction=null;
  if(message.type==='SINBAD_ACADEMY_WRITE_BOARD'&&typeof message.text==='string'&&message.text.trim()&&message.text.length<=200&&writeCustomTextAtBoard(message.text))appliedAction=Object.freeze({kind:'text',value:message.text.trim()});
  if(message.type==='SINBAD_ACADEMY_DRAW_SHAPE'&&['circle','triangle','rectangle','arrow','axes'].includes(message.shape)&&['small','standard','large'].includes(message.size||'standard')&&drawAllowedShapeAtBoard(message.shape,message.size||'standard'))appliedAction=Object.freeze({kind:'shape',value:message.shape,size:message.size||'standard'});
  if(message.type==='SINBAD_ACADEMY_CLEAR_BOARD'){clearAcademyBoard(()=>window.opener.postMessage({version:1,type:'SINBAD_ACADEMY_BOARD_APPLIED',requestId:message.requestId,action:{kind:'clear',value:'board'}},location.origin));return;}
  if(appliedAction)window.opener.postMessage({version:1,type:'SINBAD_ACADEMY_BOARD_APPLIED',requestId:message.requestId,action:appliedAction},location.origin);
});
window.opener?.postMessage({version:1,type:'SINBAD_ACADEMY_READY'},location.origin);
function loadMessages(){try{return JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]').slice(-30)}catch{return[]}}
function saveMessages(){localStorage.setItem(HISTORY_KEY,JSON.stringify(messages.slice(-30)))}
function saveWindowGeometry(){try{localStorage.setItem(GEOMETRY_KEY,JSON.stringify({left:window.screenX,top:window.screenY,width:window.outerWidth,height:window.outerHeight}))}catch{}}
function restoreWindowGeometry(){try{const saved=JSON.parse(localStorage.getItem(GEOMETRY_KEY)||'null');if(!saved)return;const width=Math.max(640,Math.min(Number(saved.width)||1200,screen.availWidth)),height=Math.max(520,Math.min(Number(saved.height)||800,screen.availHeight));window.resizeTo(width,height);window.moveTo(Math.max(screen.availLeft||0,Number(saved.left)||0),Math.max(screen.availTop||0,Number(saved.top)||0))}catch{}}
function setInstructorState(state,status){const safeState=AVATARS[state]?state:'idle';academyPerformanceDirector?.cancel();if(academyCharacterEngine)academyCharacterEngine.setState(safeState);else renderCharacterSnapshot({state:safeState,gesture:'rest',gaze:'audience',emotion:'warm'});if(status)byId('academyInstructorStatus').textContent=status}
function syncVoiceControls(){byId('academyVoiceToggle').textContent=voiceEnabled?'🔊 Voice: On':'🔇 Voice: Off';byId('academyVoiceToggle').setAttribute('aria-pressed',String(voiceEnabled));byId('academyReplayVoice').disabled=!lastNarration}
function stopNarration(status='Voice stopped'){narrationRun+=1;if('speechSynthesis'in window)window.speechSynthesis.cancel();byId('academyStopVoice').disabled=true;setInstructorState('idle',status)}
function selectVoice(){const voices=window.speechSynthesis?.getVoices?.()||[];return voices.find(v=>/^tr([-_]|$)/i.test(v.lang))||voices.find(v=>/^en([-_]|$)/i.test(v.lang))||voices[0]||null}
function narrationChunks(text){return String(text).replace(/\s+/g,' ').match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map(x=>x.trim()).filter(Boolean)||[]}
function speak(text,{afterState='teaching',afterStatus='Lesson ready'}={}){lastNarration=String(text||'').trim();syncVoiceControls();if(!lastNarration||!voiceEnabled)return;if(!('speechSynthesis'in window)||!('SpeechSynthesisUtterance'in window)){setInstructorState('teaching','Voice is unavailable in this browser');return}const run=++narrationRun,chunks=narrationChunks(lastNarration),voice=selectVoice();window.speechSynthesis.cancel();byId('academyStopVoice').disabled=false;setInstructorState('speaking','Captain Sinbad is speaking');const play=index=>{if(run!==narrationRun)return;if(index>=chunks.length){byId('academyStopVoice').disabled=true;setInstructorState(afterState,afterStatus);return}const utterance=new SpeechSynthesisUtterance(chunks[index]);utterance.lang=voice?.lang||'tr-TR';utterance.voice=voice;utterance.rate=.94;utterance.pitch=1;utterance.volume=1;utterance.onend=()=>play(index+1);utterance.onerror=event=>{if(event.error!=='canceled'){byId('academyStopVoice').disabled=true;setInstructorState('teaching','Voice playback could not continue')}};window.speechSynthesis.speak(utterance)};play(0)}
function lessonNarration(lesson){return `${lesson.title}. Öğrenme hedeflerimiz: ${lesson.objectives.join('. ')}. Uygulama: ${lesson.practice}. Bu ders eğitim amaçlıdır. Operasyonel kararlar güncel resmî bilgiler ve kaptan onayı gerektirir.`}
function renderLesson(){stopNarration('Preparing lesson');const category=byId('academyModule').value,lesson=window.SinbadAcademy?.lesson(category,window.SINBAD_TRAINING_DATA),output=byId('academyOutput');if(!lesson)return;const progress=JSON.parse(localStorage.getItem('sinbad_academy_progress')||'{}');progress[category]={openedAt:new Date().toISOString(),status:'studying'};localStorage.setItem('sinbad_academy_progress',JSON.stringify(progress));teachLessonAtBoard(lesson);output.textContent=`${lesson.title}\n\nLearning objectives\n${lesson.objectives.map(x=>'• '+x).join('\n')}\n\nPractice\n${lesson.practice}\n\nOfficial offline sources\n${lesson.sources.map((x,i)=>`[S${i+1}] ${x.title} — ${x.authority}`).join('\n')||'No matching offline source.'}\n\n⚠ Training only. Operational decisions require current official information and captain approval.`;setInstructorState('teaching',voiceEnabled?'Lesson opened — narration starting':'Lesson opened');speak(lessonNarration(lesson))}
function renderQuiz(){stopBoardTeaching();stopNarration('Preparing question');const category=byId('academyModule').value,items=window.SinbadAcademy?.quiz(category)||[],output=byId('academyOutput');if(!items.length)return;const item=items[Math.floor(Math.random()*items.length)];output.replaceChildren();const title=document.createElement('strong');title.textContent=item.q;output.append(title);const choices=document.createElement('div');choices.className='academy-choices';item.choices.forEach((choice,index)=>{const button=document.createElement('button');button.type='button';button.className='btn';button.textContent=choice;button.addEventListener('click',()=>{stopNarration('Checking answer');setInstructorState('thinking','Checking your answer');[...choices.children].forEach(node=>node.disabled=true);button.classList.add(index===item.answer?'primary':'danger');const result=document.createElement('p');result.textContent=`${index===item.answer?'✓ Correct':'✗ Review'} — ${item.explanation} [${item.source}]`;output.append(result);speak(`${index===item.answer?'Doğru cevap.':'Bu cevabı yeniden inceleyelim.'} ${item.explanation}`,{afterState:'teaching',afterStatus:'Explanation complete'})});choices.append(button)});output.append(choices);const source=document.createElement('small');source.className='academy-source';source.textContent=`Official source: ${item.source}`;output.append(source);speak(`${item.q}. Seçenekler: ${item.choices.join('. ')}`,{afterState:'listening',afterStatus:'Captain Sinbad is listening'})}
function addMessage(role,text,visuals=[]){messages.push({role,text:String(text),visuals:Array.isArray(visuals)?visuals.slice(0,3):[],at:new Date().toISOString()});saveMessages();renderMessages()}
function renderMessages(){const box=byId('academyMessages');box.replaceChildren();const items=messages.length?messages:[{role:'sinbad',text:'Welcome aboard. Ask any maritime question by writing or speaking. I will teach from the approved Atlas library and show verified maritime images when available.',visuals:[]}];items.forEach(message=>{const article=document.createElement('article');article.className=`academy-message ${message.role==='user'?'user':'sinbad'}`;const speaker=document.createElement('strong');speaker.textContent=message.role==='user'?'Captain':'Captain Sinbad';const body=document.createElement('p');body.textContent=message.text;article.append(speaker,body);if(message.role==='sinbad'&&message.visuals?.length){const visualGrid=renderVisuals(message.visuals);if(visualGrid.childElementCount)article.append(visualGrid)}box.append(article)});box.scrollTop=box.scrollHeight}
function renderVisuals(visuals){const grid=document.createElement('div');grid.className='academy-visuals';const safeAsset=/^(?:\.\/visual-library\/assets\/(?:bowditch\/(?:assets\/[a-f0-9]{64}\.[a-z0-9]+|fallback-pages\/volume-[12]-page-[0-9]+\.png)|nga-chart-no-1\/page-[0-9]{3}\.png|curated-safety\/(?:lifebuoy-scarborough|inflatable-life-raft-us-navy|sart-radar-transponder|fully-enclosed-lifeboat|life-jacket-inspection-uscg|epirb-ferry-vi|inflated-life-raft-us-navy-historic|marine-evacuation-life-raft-pod|mob-distress-marker-lights|rescue-boat-retrieval|immersion-suit-uscg|eebd-training-us-navy|helicopter-rescue-hoist|lifeboats-ready-to-launch|shipboard-firefighting-drill)\.jpg)|http:\/\/127\.0\.0\.1:31983\/visuals\/assets\/[a-f0-9]{64}\.webp)$/u;visuals.filter(visual=>safeAsset.test(visual?.src||'')).forEach(visual=>{const figure=document.createElement('figure');figure.className='academy-atlas-visual';const image=document.createElement('img');image.src=visual.src;image.alt=visual.alt||'Verified maritime visual';image.loading='lazy';const caption=document.createElement('figcaption');caption.textContent=visual.caption||'Verified maritime visual';figure.append(image,caption);grid.append(figure)});return grid}
function getCloudConfig(){return {url:localStorage.getItem('atlas_supabase_url')||DEFAULT_CLOUD.url,key:localStorage.getItem('atlas_supabase_publishable_key')||DEFAULT_CLOUD.key}}
async function initCloud(){if(!window.supabase){byId('academyCloudStatus').textContent='Atlas client unavailable';return}const {url,key}=getCloudConfig();cloudClient=window.supabase.createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});const {data}=await cloudClient.auth.getSession();cloudSession=data.session;byId('academyCloudStatus').textContent=cloudSession?.user?'Atlas knowledge connected':'Sign in to Atlas Marine in the main window';cloudClient.auth.onAuthStateChange((_event,session)=>{cloudSession=session;byId('academyCloudStatus').textContent=session?.user?'Atlas knowledge connected':'Sign in to Atlas Marine in the main window'})}
function coreAnswerIsTrusted(data,envelope){const decision=data?.coreDecision,expected=envelope?.analysis,answer=String(data?.answer||'').trim(),spokenSummary=String(data?.spokenSummary||'').trim(),answerSafe=Boolean(answer)&&window.SinbadCoreDecision?.answerIsSafe?.(answer)===true,spokenSummarySafe=!spokenSummary||window.SinbadCoreDecision?.answerIsSafe?.(spokenSummary)===true;return Boolean(data&&answerSafe&&spokenSummarySafe&&data.coreGateVersion===window.SinbadCore?.CORE_GATE_VERSION&&data.coreGateVersion===envelope?.gateVersion&&data.permission==='DECISION_SUPPORT_ONLY'&&data.executionPerformed===false&&decision&&expected&&['low','medium','high','critical'].includes(decision.risk)&&decision.risk===expected.risk&&['emergency','operational','needsLiveData','requiresHumanApproval','requiresIndependentVerification'].every(field=>typeof decision[field]==='boolean'&&decision[field]===expected[field]))}
async function askSinbad(question){const workspaceId=localStorage.getItem('atlas_selected_workspace')||localStorage.getItem('atlas-v81-workspace')||'';if(!cloudClient||!cloudSession?.user||!workspaceId)throw new Error('Atlas Cloud oturumu veya çalışma alanı bağlı değil. Ana Sinbad penceresinde oturum açın.');const history=messages.slice(0,-1).slice(-12).map(message=>({role:message.role==='sinbad'?'assistant':'user',content:message.text}));const coreEnvelope=window.SinbadCore?.aiEnvelope?.(question,history);const {data,error}=await cloudClient.functions.invoke('sinbad-answer',{body:{workspaceId,question,language:'tr-TR',includeSourceVisuals:false,suppressSourceVisuals:true,coreEnvelope}});if(error)throw error;if(!coreAnswerIsTrusted(data,coreEnvelope))throw new Error('Sinbad güvenlik/kanıt kapısı bu cevabı durdurdu.');const answer=String(data.answer).trim(),visuals=await window.SinbadVisuals?.select?.(question,answer,{max:3})||[];return {answer,visuals}}
async function submitQuestion(question){const clean=String(question||'').trim();if(!clean)return;stopNarration('Thinking');addMessage('user',clean);byId('academyQuestion').value='';byId('academySend').disabled=true;setInstructorState('thinking','Searching approved Atlas sources');byId('academyCloudStatus').textContent='Searching Atlas knowledge and visual library…';try{const result=await askSinbad(clean);addMessage('sinbad',result.answer,result.visuals);byId('academyCloudStatus').textContent=result.visuals.length?`${result.visuals.length} verified maritime image(s) attached`:'Answer ready · no matching maritime image found';speak(result.answer,{afterState:'listening',afterStatus:'Captain Sinbad is ready for your next question'})}catch(error){addMessage('sinbad',`Bu soruyu şu anda tamamlayamadım: ${error.message||error}`);byId('academyCloudStatus').textContent='Answer stopped safely';setInstructorState('idle','I need a connected source before answering')}finally{byId('academySend').disabled=false;byId('academyQuestion').focus()}}
function setupRecognition(){const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;if(!Recognition){byId('academyMic').disabled=true;byId('academyMic').title='Speech recognition is unavailable in this browser';return}recognition=new Recognition();recognition.lang='tr-TR';recognition.interimResults=true;recognition.continuous=false;recognition.onstart=()=>{byId('academyMic').setAttribute('aria-pressed','true');setInstructorState('listening','Captain Sinbad is listening')};recognition.onresult=event=>{byId('academyQuestion').value=[...event.results].map(result=>result[0].transcript).join('')};recognition.onend=()=>{byId('academyMic').setAttribute('aria-pressed','false');setInstructorState('idle','Voice question captured')};recognition.onerror=event=>{byId('academyMic').setAttribute('aria-pressed','false');setInstructorState('idle',`Microphone: ${event.error}`)}}
restoreWindowGeometry();renderMessages();syncVoiceControls();initCloud();setupRecognition();
byId('academyChatForm').addEventListener('submit',event=>{event.preventDefault();submitQuestion(byId('academyQuestion').value)});
byId('academyQuestion').addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();byId('academyChatForm').requestSubmit()}});
byId('academyMic').addEventListener('click',()=>{if(!recognition)return;if(byId('academyMic').getAttribute('aria-pressed')==='true')recognition.stop();else recognition.start()});
byId('startAcademyLesson').addEventListener('click',renderLesson);byId('startAcademyQuiz').addEventListener('click',renderQuiz);
byId('academyVoiceToggle').addEventListener('click',()=>{voiceEnabled=!voiceEnabled;localStorage.setItem(VOICE_KEY,String(voiceEnabled));if(!voiceEnabled)stopNarration('Voice is off');syncVoiceControls()});byId('academyReplayVoice').addEventListener('click',()=>speak(lastNarration));byId('academyStopVoice').addEventListener('click',()=>stopNarration());
byId('closeAcademyWindow').addEventListener('click',()=>{stopNarration();saveWindowGeometry();window.close()});window.addEventListener('beforeunload',()=>{stopNarration();recognition?.abort();objectUrls.forEach(URL.revokeObjectURL);saveWindowGeometry()});
