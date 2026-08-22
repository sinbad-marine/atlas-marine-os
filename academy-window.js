'use strict';
const byId=id=>document.getElementById(id);
const GEOMETRY_KEY='atlas_sinbad_academy_native_window';

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
  output.textContent=`${lesson.title}\n\nLearning objectives\n${lesson.objectives.map(x=>'• '+x).join('\n')}\n\nPractice\n${lesson.practice}\n\nOfficial offline sources\n${lesson.sources.map((x,i)=>`[S${i+1}] ${x.title} — ${x.authority}`).join('\n')||'No matching offline source.'}\n\n⚠ Training only. Operational decisions require current official information and captain approval.`;
}
function renderQuiz(){
  const category=byId('academyModule').value,items=window.SinbadAcademy?.quiz(category)||[],output=byId('academyOutput');if(!items.length)return;
  const item=items[Math.floor(Math.random()*items.length)];output.replaceChildren();const title=document.createElement('strong');title.textContent=item.q;output.append(title);
  const choices=document.createElement('div');choices.className='academy-choices';item.choices.forEach((choice,index)=>{const button=document.createElement('button');button.type='button';button.className='btn';button.textContent=choice;button.addEventListener('click',()=>{[...choices.children].forEach(node=>node.disabled=true);button.classList.add(index===item.answer?'primary':'danger');const result=document.createElement('p');result.textContent=`${index===item.answer?'✓ Correct':'✗ Review'} — ${item.explanation} [${item.source}]`;output.append(result);});choices.append(button);});output.append(choices);const source=document.createElement('small');source.className='academy-source';source.textContent=`Official source: ${item.source}`;output.append(source);
}
restoreWindowGeometry();
byId('startAcademyLesson').addEventListener('click',renderLesson);
byId('startAcademyQuiz').addEventListener('click',renderQuiz);
byId('closeAcademyWindow').addEventListener('click',()=>{saveWindowGeometry();window.close();});
window.addEventListener('beforeunload',saveWindowGeometry);
