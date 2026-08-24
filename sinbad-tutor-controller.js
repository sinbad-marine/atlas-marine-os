'use strict';
(function(root){
  const PROFILE_KEY='atlas_sinbad_professor_learner_v1';
  const SESSION_KEY='atlas_sinbad_tutor_session_v1';
  const TEACHING_TIMEOUT_MS=45000;
  const $=id=>document.getElementById(id);
  let state=null,pendingTeaching=null;
  function clearPendingTeaching(){if(pendingTeaching?.timeoutId)clearTimeout(pendingTeaching.timeoutId);pendingTeaching=null}
  function teachingTimedOut(sessionId){
    if(!pendingTeaching||pendingTeaching.sessionId!==sessionId||state?.session?.sessionId!==sessionId)return;
    clearPendingTeaching();syncSessionControls();const advance=$('advanceTutorSession'),heading=`${topicLabel(state.session.topicId)}\nHedef: ${objectiveLabel()}`;advance.textContent='Anlatımı yeniden dene';advance.dataset.action='retry';advance.disabled=false;advance.hidden=false;status(`${heading}\nSinbad'ın açıklaması zamanında tamamlanamadı. Oturum ilerletilmedi ve başarı kaydı oluşturulmadı.`);
  }
  function academyCatalog(){return Object.entries(root.SinbadAcademy?.modules||{}).map(([id,item])=>{const checks=root.SinbadAcademy?.quiz(id)||[];return {id,label:item.title||id,prerequisites:[],objectives:checks.map((check,index)=>({id:`${id}-check-${index+1}`,label:check.q}))}}).filter(item=>item.objectives.length)}
  function loadProfile(){try{return root.SinbadProfessor.normalizeProfile(JSON.parse(localStorage.getItem(PROFILE_KEY)||'null'))}catch{return root.SinbadProfessor.createProfile()}}
  function save(){if(!state)return;localStorage.setItem(PROFILE_KEY,JSON.stringify(state.profile));localStorage.setItem(SESSION_KEY,JSON.stringify({session:state.session,profile:state.profile}))}
  function status(message){$('tutorSessionStatus').textContent=message}
  function topicLabel(id){return academyCatalog().find(item=>item.id===id)?.label||id}
  function objectiveLabel(){return state?.session?.objectives?.[state.session.objectiveIndex]?.label||''}
  function syncSessionControls(){const active=state?.session?.status==='ACTIVE';$('startTutorSession').disabled=Boolean(active);$('abandonTutorSession').hidden=!active}
  function renderProgress(){const host=$('tutorProgress');if(!state?.session){host.hidden=true;return}const view=root.SinbadTutorOrchestrator.progress(state.session),bar=$('tutorProgressBar'),list=$('tutorObjectiveProgress');host.hidden=false;bar.max=Math.max(1,view.total);bar.value=view.completed;bar.setAttribute('aria-valuetext',`${view.completed} / ${view.total} hedef doğrulandı`);$('tutorProgressLabel').textContent=`${view.completed} / ${view.total} hedef doğrulandı`;$('tutorAttemptLabel').textContent=state.session.status==='COMPLETE'?'Oturum tamamlandı':state.session.status==='STOPPED'?`Oturum durdu · Deneme: ${view.attempts}/${view.maxAttempts}`:`Mevcut hedef: ${view.current} · Deneme: ${view.attempts}/${view.maxAttempts}`;list.replaceChildren();for(const item of view.objectives){const node=document.createElement('li');node.className=item.status.toLowerCase();node.textContent=`${item.status==='VERIFIED'?'✓ ':item.status==='CURRENT'?'→ ':''}${item.label}`;list.append(node)}}
  function submitTutorPrompt(prompt){
    const input=$('academyQuestion'),form=$('academyChatForm'),messages=$('academyMessages');if(!input||!form||!messages)return false;
    clearPendingTeaching();const sessionId=state.session.sessionId;pendingTeaching={sessionId,assistantCount:messages.querySelectorAll('.academy-message.sinbad').length,timeoutId:setTimeout(()=>teachingTimedOut(sessionId),TEACHING_TIMEOUT_MS)};input.value=prompt;form.requestSubmit();return true;
  }
  function teachingReplyStopped(reply){
    const cloudStatus=String($('academyCloudStatus')?.textContent||'').trim();
    const replyText=String(reply||'').trim();
    return !replyText||cloudStatus==='Answer stopped safely'||/^Bu soruyu şu anda tamamlayamadım:/i.test(replyText);
  }
  function observeTeachingReply(){
    if(!pendingTeaching||pendingTeaching.sessionId!==state?.session?.sessionId)return;const replies=[...$('academyMessages').querySelectorAll('.academy-message.sinbad p')];if(replies.length<=pendingTeaching.assistantCount)return;
    const reply=String(replies.at(-1)?.textContent||''),advance=$('advanceTutorSession'),heading=`${topicLabel(state.session.topicId)}\nHedef: ${objectiveLabel()}`;clearPendingTeaching();syncSessionControls();
    if(teachingReplyStopped(reply)){status(`${heading}\nSinbad açıklamayı tamamlayamadı. Başarı kaydı oluşturulmadı.`);advance.textContent='Anlatımı yeniden dene';advance.dataset.action='retry';advance.disabled=false;advance.hidden=false;return}
    status(`${heading}\nAçıklama tamamlandı. Hazır olduğunuzda bilgi kontrolüne geçin.`);advance.dataset.action='advance';advance.disabled=false;advance.hidden=false;
  }
  function renderCheck(){
    const host=$('tutorKnowledgeCheck'),items=root.SinbadAcademy?.quiz(state.session.topicId)||[],item=items[state.session.objectiveIndex];host.replaceChildren();
    if(!item){host.hidden=true;state=root.SinbadTutorOrchestrator.advance(state.session,loadProfile(),{type:'ASSESSMENT_UNAVAILABLE'});save();syncSessionControls();renderProgress();status('Bu hedef için doğrulanmış kısa soru bulunamadı. Oturum güvenli biçimde durduruldu; başarı kaydı oluşturulmadı.');return}
    const question=document.createElement('strong');question.textContent=item.q;host.append(question);
    item.choices.forEach((choice,index)=>{const button=document.createElement('button');button.type='button';button.textContent=choice;button.addEventListener('click',()=>{[...host.querySelectorAll('button')].forEach(node=>node.disabled=true);state=root.SinbadTutorOrchestrator.advance(state.session,loadProfile(),{type:'ASSESSMENT',kind:'knowledge-check',score:index===item.answer?1:0,confidence:1});save();status(index===item.answer?`Doğru. ${item.explanation}`:`Yeniden çalışacağız. ${item.explanation}`);setTimeout(render,250)});host.append(button)});host.hidden=false;
  }
  function render(){
    if(!state)return;const action=state.action,advance=$('advanceTutorSession'),check=$('tutorKnowledgeCheck');advance.hidden=true;advance.disabled=false;advance.dataset.action='advance';check.hidden=true;syncSessionControls();renderProgress();const heading=`${topicLabel(state.session.topicId)}\nHedef: ${objectiveLabel()}`;
    if(action.type==='EXPLAIN'){status(`${heading}\nSinbad açıklamayı hazırlıyor…`);advance.textContent='Sinbad anlatıyor…';advance.disabled=true;advance.hidden=false;$('startTutorSession').disabled=true;if(!submitTutorPrompt(`${topicLabel(state.session.topicId)} konusunda şu öğrenme hedefini kaynaklara dayanarak, açık ve öğretici biçimde anlat: ${objectiveLabel()}`)){clearPendingTeaching();syncSessionControls();advance.textContent='Anlatımı yeniden dene';advance.dataset.action='retry';advance.disabled=false;status(`${heading}\nSohbet bağlantısı hazır değil. Oturum ilerletilmedi.`)}}
    else if(action.type==='ASK_KNOWLEDGE_CHECK'){status(`${heading}\nKısa bilgi kontrolünü tamamlayın.`);renderCheck()}
    else if(action.type==='REMEDIATE'){status(`${heading}\nBu hedef henüz doğrulanmadı. Sinbad farklı bir açıklama hazırlıyor…`);advance.textContent='Sinbad yeniden anlatıyor…';advance.disabled=true;advance.hidden=false;$('startTutorSession').disabled=true;if(!submitTutorPrompt(`${topicLabel(state.session.topicId)} konusundaki şu hedefi önceki açıklamadan farklı bir örnekle yeniden öğret: ${objectiveLabel()}`)){clearPendingTeaching();syncSessionControls();advance.textContent='Anlatımı yeniden dene';advance.dataset.action='retry';advance.disabled=false}}
    else if(action.type==='COMPLETE'){status(`${topicLabel(state.session.topicId)} oturumu tamamlandı. Tüm hedefler açık bilgi kontrolleriyle doğrulandı.`);localStorage.removeItem(SESSION_KEY)}
    else status(`Oturum durduruldu: ${action.reason}. Başarı varsayılmadı.`);
  }
  function start(){if(state?.session?.status==='ACTIVE'){status('Etkin oturum korunuyor. Yeni bir oturum için önce mevcut oturumu açıkça bırakın.');syncSessionControls();return}const catalog=academyCatalog();if(!catalog.length){status('Academy konu kataloğu yüklenemedi; oturum başlatılmadı.');return}state=root.SinbadTutorOrchestrator.create({catalog,profile:loadProfile(),topicId:$('tutorTopic').value,sessionId:`tutor-${Date.now()}`});save();render()}
  function advance(){if(!state||state.session.status!=='ACTIVE')return;if($('advanceTutorSession').dataset.action==='retry'){render();return}const type=state.session.stage==='EXPLAIN'?'EXPLANATION_COMPLETE':'REMEDIATION_COMPLETE';state=root.SinbadTutorOrchestrator.advance(state.session,loadProfile(),{type});save();render()}
  function abandon(){if(!state?.session||!confirm('Bu rehberli oturumu bırakmak istiyor musunuz? Oturum ilerlemesi kaldırılır; daha önce doğrulanmış öğrenme kanıtları korunur.'))return;clearPendingTeaching();localStorage.removeItem(SESSION_KEY);state=null;$('advanceTutorSession').hidden=true;$('tutorKnowledgeCheck').hidden=true;$('tutorTopic').value='';syncSessionControls();renderProgress();status('Rehberli oturum bırakıldı. Doğrulanmış öğrenme profiliniz korunuyor.')}
  function init(){
    if(!root.SinbadTutorOrchestrator||!root.SinbadProfessor||!root.SinbadAcademy){status('Eğitmen bileşenleri yüklenemedi.');return}
    const select=$('tutorTopic');for(const item of academyCatalog()){const option=document.createElement('option');option.value=item.id;option.textContent=item.label;select.append(option)}
    $('startTutorSession').addEventListener('click',start);$('advanceTutorSession').addEventListener('click',advance);$('abandonTutorSession').addEventListener('click',abandon);new MutationObserver(observeTeachingReply).observe($('academyMessages'),{childList:true,subtree:true});
    try{
      const snapshot=JSON.parse(localStorage.getItem(SESSION_KEY)||'null');
      if(snapshot){state=root.SinbadTutorOrchestrator.restore({catalog:academyCatalog(),snapshot});select.value=state.session.topicId;status('Kaydedilmiş rehberli oturum güvenli biçimde geri yüklendi.');render()}
    }catch{
      localStorage.removeItem(SESSION_KEY);state=null;status('Kaydedilmiş rehberli oturum doğrulanamadı ve kullanılmadı. Yeni bir oturum başlatabilirsiniz.');syncSessionControls();
    }
  }
  window.addEventListener('load',init);
})(window);
