'use strict';
const byId=id=>document.getElementById(id);
const GEOMETRY_KEY='atlas_sinbad_academy_native_window';
const academyCharacterEngine=window.SinbadCharacterEngine?.createCharacterEngine({initialState:'idle'})||null;
const academyPerformanceDirector=window.SinbadPerformanceDirector?.createPerformanceDirector()||null;
const ACADEMY_CHARACTER_ASSETS=Object.freeze({
  walking:Object.freeze(['./assets/captain-sinbad/captain-sinbad-walk-a-v1.png','./assets/captain-sinbad/captain-sinbad-walk-b-v1.png']),
  writing:Object.freeze({ready:'./assets/captain-sinbad/captain-sinbad-board-teaching.png',contact:'./assets/captain-sinbad/captain-sinbad-writing-contact-v1.png',lift:'./assets/captain-sinbad/captain-sinbad-writing-lift-v1.png'}),
  'board-teaching':'./assets/captain-sinbad/captain-sinbad-board-teaching.png'
});
let academyBoardGeneration=0;

academyCharacterEngine?.subscribe(snapshot=>{
  const avatar=byId('academyTeachingStage')?.querySelector('.academy-sinbad');if(!avatar)return;
  avatar.dataset.state=snapshot.state;avatar.dataset.gesture=snapshot.gesture;avatar.dataset.gaze=snapshot.gaze;
});

function renderAcademyCharacterCue(cue,text){
  const event=cue.state==='walking'?'WALK':'TEACH_AT_BOARD';
  academyCharacterEngine?.dispatch(event,{boardText:text,...cue});
  const image=byId('academySinbadImage');if(!image)return;
  image.src=cue.state==='walking'?ACADEMY_CHARACTER_ASSETS.walking[cue.walkFrame===1?1:0]:ACADEMY_CHARACTER_ASSETS['board-teaching'];
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
restoreWindowGeometry();
preloadAcademyCharacterAssets();
byId('startAcademyLesson').addEventListener('click',renderLesson);
byId('startAcademyQuiz').addEventListener('click',renderQuiz);
byId('closeAcademyWindow').addEventListener('click',()=>{saveWindowGeometry();window.close();});
window.addEventListener('beforeunload',saveWindowGeometry);
