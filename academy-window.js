'use strict';
const byId=id=>document.getElementById(id);
const GEOMETRY_KEY='atlas_sinbad_academy_native_window';
const academyCharacterEngine=window.SinbadCharacterEngine?.createCharacterEngine({initialState:'idle'})||null;
const academyPerformanceDirector=window.SinbadPerformanceDirector?.createPerformanceDirector()||null;
let academyBoardGeneration=0;

academyCharacterEngine?.subscribe(snapshot=>{
  const avatar=byId('academyTeachingStage')?.querySelector('.academy-sinbad');if(!avatar)return;
  avatar.dataset.state=snapshot.state;avatar.dataset.gesture=snapshot.gesture;avatar.dataset.gaze=snapshot.gaze;
});

function teachLessonAtBoard(lesson){
  const stage=byId('academyTeachingStage'),title=byId('academyTeachingTitle'),board=byId('academyTeachingText');
  if(!stage||!title||!board)return;
  const text=lesson.objectives.map((objective,index)=>`${index+1}. ${objective}`).join('\n\n').slice(0,500);
  const generation=++academyBoardGeneration;stage.hidden=false;title.textContent=lesson.title;board.textContent='';
  const reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true;
  academyPerformanceDirector?.play('board-teaching',cue=>academyCharacterEngine?.dispatch('TEACH_AT_BOARD',{boardText:text,...cue}),{reducedMotion});
  if(!academyPerformanceDirector)academyCharacterEngine?.dispatch('TEACH_AT_BOARD',{boardText:text});
  if(reducedMotion){board.textContent=text;return;}
  let index=0;const writeNext=()=>{if(generation!==academyBoardGeneration)return;board.textContent=text.slice(0,++index);if(index<text.length)setTimeout(writeNext,/\s/.test(text[index]||'')?28:14);};writeNext();
}
function stopBoardTeaching(){academyBoardGeneration++;academyPerformanceDirector?.cancel();const stage=byId('academyTeachingStage');if(stage)stage.hidden=true;academyCharacterEngine?.dispatch('READY');}

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
byId('startAcademyLesson').addEventListener('click',renderLesson);
byId('startAcademyQuiz').addEventListener('click',renderQuiz);
byId('closeAcademyWindow').addEventListener('click',()=>{saveWindowGeometry();window.close();});
window.addEventListener('beforeunload',saveWindowGeometry);
