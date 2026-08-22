'use strict';
const $=id=>document.getElementById(id),PROFILE_KEY='atlas_sinbad_professor_learner_v1';
const TOPICS=[
  {id:'chart-reading',label:'Chart reading & hydrography'},
  {id:'tides-water-levels',label:'Tides & water levels',prerequisites:['chart-reading']},
  {id:'currents-set-drift',label:'Currents, set & drift',prerequisites:['chart-reading']},
  {id:'colregs-navigation-rules',label:'COLREG & navigation rules'},
  {id:'electronic-navigation',label:'Electronic navigation',prerequisites:['chart-reading']},
  {id:'marine-weather',label:'Marine weather'}
];
let profile=loadProfile(),recommended=null;
function loadProfile(){try{return SinbadProfessor.normalizeProfile(JSON.parse(localStorage.getItem(PROFILE_KEY)||'null'))}catch{return SinbadProfessor.createProfile()}}
function saveProfile(){localStorage.setItem(PROFILE_KEY,JSON.stringify(profile))}
function labelFor(id){return TOPICS.find(topic=>topic.id===id)?.label||id||'Not assessed'}
function render(){const summary=SinbadProfessor.summary(profile,TOPICS.map(x=>x.id));$('learnerName').value=profile.displayName;$('learnerLevel').textContent=summary.level;$('learnerEvidence').textContent=String(summary.evidenceCount);$('learnerPriority').textContent=labelFor(summary.priority?.topic);$('learnerStrongest').textContent=labelFor(summary.strongest?.topic);const list=$('masteryList');list.replaceChildren();SinbadProfessor.diagnose(profile,TOPICS.map(x=>x.id)).forEach(item=>{const row=document.createElement('div');row.className='mastery-row';const label=document.createElement('span');label.textContent=labelFor(item.topic);const value=document.createElement('b');value.textContent=`${Math.round(item.mastery*100)}% · ${item.level}`;const bar=document.createElement('div');bar.className='mastery-bar';const fill=document.createElement('i');fill.style.width=`${Math.round(item.mastery*100)}%`;bar.append(fill);row.append(label,value,bar);list.append(row)});recommended=SinbadProfessor.nextLesson(profile,TOPICS);$('nextLesson').textContent=recommended?labelFor(recommended.id):'No lesson available';$('openRecommended').disabled=!recommended}
function record(topic,score,kind){profile=SinbadProfessor.recordEvidence(profile,{topic,score,confidence:1,kind});saveProfile();render()}
function connectClassroom(){const frame=$('phaseOneClassroom');frame.addEventListener('load',()=>{try{const doc=frame.contentDocument;doc.getElementById('startAcademyLesson')?.addEventListener('click',()=>record(doc.getElementById('academyModule').value,.35,'lesson-opened'));doc.getElementById('academyOutput')?.addEventListener('click',event=>{const choice=event.target.closest?.('.academy-choices .btn');if(choice)record(doc.getElementById('academyModule').value,choice.classList.contains('primary')?1:0,'guided-quiz')})}catch{}})}
$('saveLearnerName').addEventListener('click',()=>{profile=SinbadProfessor.normalizeProfile({...profile,displayName:$('learnerName').value});saveProfile();render()});
$('openRecommended').addEventListener('click',()=>{if(!recommended)return;const doc=$('phaseOneClassroom').contentDocument,module=doc?.getElementById('academyModule');if(module){module.value=recommended.id;doc.getElementById('startAcademyLesson')?.click();$('phaseOneClassroom').focus()}});
connectClassroom();render();
