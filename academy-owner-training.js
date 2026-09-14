'use strict';
// Owner-private Academy training panel (pilot scope). Loaded by academy.html after the
// classroom window script. Adds nothing to the public catalog: everything shown here
// comes from academy_ism_questions rows the signed-in user is allowed to read under RLS
// (training_scope OWNER_ONLY for the active Owner) and from academy_ism_attempts rows the
// user wrote. The correct answer and reasoning are never rendered before an attempt is
// recorded by the server-side academy_ism_submit_attempt function.
(function(){
  const byId=id=>document.getElementById(id);
  const root=byId('academyOwnerTraining');if(!root)return;
  const DEFAULT_URL='https://kcvyftrvteqmabvxfebu.supabase.co',DEFAULT_KEY='sb_publishable_ZBHFlbhQAnhUAOyVg20Szw_nW0QDj_l';
  const MODULE='ism-code-foundations',TRAINING_ACTION='identity.academy.training_promote';
  const config={url:localStorage.getItem('atlas_supabase_url')||DEFAULT_URL,key:localStorage.getItem('atlas_supabase_publishable_key')||DEFAULT_KEY};
  const client=window.supabase?.createClient(config.url,config.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
  const ownerSecurity=client&&window.SinbadOwnerUi?window.SinbadOwnerUi.create(client):null;
  let session=null,questions=[],selectedRow=null,selectedKey=null;

  function workspace(){return localStorage.getItem('atlas_selected_workspace')||localStorage.getItem('atlas-v81-workspace')||''}
  function el(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node}
  function status(text,error=false){const node=byId('academyOwnerTrainingStatus');if(!node)return;node.textContent=text;node.dataset.state=error?'error':'ok'}

  const LAST_PROMOTE_KEY='atlas_academy_training_last_promote';
  function applyLayout(){
    // The panel becomes the chalkboard's content while it is active: it is measured against the classroom's own
    // .academy-live-board (whose size changes with the lesson phase) and laid over the board area below its title.
    // The board's placeholder chalk line ("içerik henüz hazır değil") is hidden while the panel is active so nothing
    // is drawn twice in the same area. Nothing in the classroom's own scripts or stylesheet is modified.
    Object.assign(root.style,{position:'absolute',zIndex:'6',overflow:'auto',margin:'0',padding:'12px 16px',boxSizing:'border-box',border:'1px solid #6c897d',borderRadius:'10px',background:'rgba(7,28,28,.97)',color:'#eef7dc',lineHeight:'1.5',fontSize:'15px'});
    placePanel();
  }
  function placePanel(){
    const stage=byId('academyTeachingStage'),board=stage?.querySelector('.academy-live-board'),chalk=byId('academyTeachingText');
    if(!stage||!board)return;
    if(root.hidden){if(chalk)chalk.hidden=false;return}
    const sr=stage.getBoundingClientRect(),br=board.getBoundingClientRect();
    const tr=byId('academyTeachingTitle')?.getBoundingClientRect();
    const top=Math.max(0,(tr&&tr.height?tr.bottom-sr.top:br.top-sr.top+40)+10),left=Math.max(0,br.left-sr.left+14),width=Math.max(240,br.width-28);
    // fill the chalkboard below its title; on the small welcome-phase board extend onto the desk area but never past the stage
    const boardBased=br.bottom-sr.top-top-14,height=Math.max(160,Math.min(sr.height-top-14,Math.max(boardBased,300)));
    Object.assign(root.style,{top:`${Math.round(top)}px`,left:`${Math.round(left)}px`,width:`${Math.round(width)}px`,height:`${Math.round(height)}px`});
    if(chalk)chalk.hidden=true;
  }
  window.addEventListener('resize',placePanel);
  new MutationObserver(placePanel).observe(byId('academyTeachingStage')||root,{attributes:true,attributeFilter:['data-phase','class','style']});
  function build(){
    root.replaceChildren();applyLayout();
    root.append(el('strong',null,'Owner özel eğitim · ISM Code foundations'));
    const status=el('p','academy-training-status','Oturum denetleniyor…');status.id='academyOwnerTrainingStatus';root.append(status);
    const actions=el('div','academy-actions');
    const load=el('button','btn primary','Eğitim sorularımı yükle');load.type='button';load.id='academyTrainingLoad';load.addEventListener('click',loadQuestions);actions.append(load);
    root.append(actions);
    const question=el('section','academy-training-question');question.id='academyTrainingQuestion';question.hidden=true;root.append(question);
    const result=el('section','academy-training-result');result.id='academyTrainingResult';result.hidden=true;root.append(result);
    const attempts=el('section','academy-training-attempts');attempts.id='academyTrainingAttempts';attempts.hidden=true;root.append(attempts);
    const promote=el('details','academy-training-promote');promote.id='academyTrainingPromote';promote.open=true;
    promote.append(el('summary',null,'Owner · Human Review paketinden özel eğitime aktar (AAL2)'));
    let last={};try{last=JSON.parse(localStorage.getItem(LAST_PROMOTE_KEY)||'{}')}catch{last={}}
    const pkgLabel=el('label',null,'Kaynak paket ID');const pkg=el('input');pkg.id='academyTrainingPromotePackage';pkg.placeholder='b513867b-…';pkg.autocomplete='off';pkg.value=String(last.packageId||'');pkgLabel.append(pkg);promote.append(pkgLabel);
    const qLabel=el('label',null,'Soru ID');const q=el('input');q.id='academyTrainingPromoteQuestion';q.placeholder='ISM-M1-EL2-Q001';q.autocomplete='off';q.value=String(last.questionId||'');qLabel.append(q);promote.append(qLabel);
    const go=el('button','btn primary','Aktar');go.type='button';go.id='academyTrainingPromoteButton';go.addEventListener('click',promoteQuestion);promote.append(go);
    root.append(promote);
  }

  function visible(){return byId('academyModule')?.value===MODULE}
  const TRAINING_TITLE='Owner özel eğitim modu';
  function labelBoard(){
    // The classroom shows "Ders hazırlanıyor" for a module without a verified lesson; while this panel is active the board title
    // states the real mode instead. The classroom's own lesson clock is untouched.
    if(root.hidden)return;const title=byId('academyTeachingTitle');if(title&&title.textContent!==TRAINING_TITLE)title.textContent=TRAINING_TITLE;
  }
  new MutationObserver(labelBoard).observe(byId('academyTeachingTitle')||root,{childList:true,characterData:true,subtree:true});
  function sync(){root.hidden=!visible();placePanel();if(!root.hidden){labelBoard();if(!session)refreshSession()}}

  async function refreshSession(){
    if(!client){status('Supabase istemcisi yüklenemedi.',true);return}
    const {data}=await client.auth.getSession();session=data?.session||null;
    if(!session){status('Owner özel eğitimi için Sinbad Marine ana sayfasında oturum açın; bu bölüm herkese açık değildir.',true);return}
    if(!workspace()){status('Çalışma alanı seçilmemiş. Ana sayfadan çalışma alanınızı seçin.',true);return}
    status(`Oturum: ${session.user.email||session.user.id} · çalışma alanı ${workspace().slice(0,8)}…`);
  }

  async function loadQuestions(){
    await refreshSession();if(!session||!workspace())return;
    status('Sorular yükleniyor…');
    const {data,error}=await client.from('academy_ism_questions')
      .select('id,question_id,module_code,learning_objective,difficulty,question_kind,prompt,choices,source_version,source_section,verification_stage,training_scope,review_package_id,source_content_sha256,training_promoted_at')
      .eq('workspace_id',workspace()).eq('module_code',MODULE).eq('training_scope','OWNER_ONLY').order('question_id');
    if(error){status(`Sorular okunamadı: ${error.message}`,true);return}
    questions=data||[];
    if(!questions.length){status('Bu çalışma alanında size açık özel eğitim sorusu yok. Owner olarak aşağıdan bir Human Review paketinden aktarabilirsiniz.');byId('academyTrainingQuestion').hidden=true;return}
    // reload-safe position: resume at the first question without an attempt; if all answered, show the first
    const answered=await answeredRowIds();
    const start=Math.max(0,questions.findIndex(q=>!answered.has(q.id)));
    status(`${questions.length} özel eğitim sorusu yüklendi (yalnız siz görebilirsiniz) · cevaplanan ${[...answered].filter(id=>questions.some(q=>q.id===id)).length}/${questions.length}.`);
    await showQuestion(start);
  }

  async function answeredRowIds(){
    const {data}=await client.from('academy_ism_attempts').select('question_id').eq('workspace_id',workspace());
    return new Set((data||[]).map(a=>a.question_id));
  }

  let index=0;
  async function showQuestion(i){
    index=Math.min(Math.max(0,i),questions.length-1);
    renderQuestion(questions[index]);await loadAttempts(questions[index]);
  }

  function renderQuestion(row){
    selectedRow=row;selectedKey=null;
    const box=byId('academyTrainingQuestion');box.replaceChildren();box.hidden=false;
    box.append(el('div','academy-training-progress',`Soru ${index+1} / ${questions.length}`));
    const meta=el('small','academy-source',`${row.question_id} · ${row.source_version} · ${row.source_section||''} · durum ${row.verification_stage} · kapsam ${row.training_scope}`);box.append(meta);
    box.append(el('p','academy-training-objective',row.learning_objective||''));
    box.append(el('strong',null,row.prompt));
    const choices=el('div','academy-choices');
    (Array.isArray(row.choices)?row.choices:[]).forEach(choice=>{
      const label=el('label','academy-training-choice');const input=document.createElement('input');input.type='radio';input.name='academyTrainingChoice';input.value=String(choice.key);
      input.addEventListener('change',()=>{selectedKey=input.value});label.append(input,el('span',null,`${choice.key}. ${choice.text}`));choices.append(label);
    });
    box.append(choices);
    const actions=el('div','academy-actions');
    const submit=el('button','btn primary','Cevabı gönder');submit.type='button';submit.id='academyTrainingSubmit';submit.addEventListener('click',submitAttempt);actions.append(submit);
    if(index>0){const prev=el('button','btn','← Önceki soru');prev.type='button';prev.id='academyTrainingPrev';prev.addEventListener('click',()=>showQuestion(index-1));actions.append(prev)}
    if(index<questions.length-1){const next=el('button','btn','Sonraki soru →');next.type='button';next.id='academyTrainingNext';next.addEventListener('click',()=>showQuestion(index+1));actions.append(next)}
    box.append(actions);
    byId('academyTrainingResult').hidden=true;byId('academyTrainingResult').replaceChildren();
  }

  async function submitAttempt(){
    if(!selectedRow){return}
    if(!selectedKey){status('Önce bir seçenek işaretleyin.',true);return}
    status('Cevap kaydediliyor…');
    const {data,error}=await client.rpc('academy_ism_submit_attempt',{p_workspace_id:workspace(),p_question_row_id:selectedRow.id,p_response:{key:selectedKey}});
    if(error){status(`Cevap kaydedilemedi: ${error.message}`,true);return}
    const box=byId('academyTrainingResult');box.replaceChildren();box.hidden=false;
    box.append(el('strong',null,data.isCorrect?'Doğru.':'Yanlış.'));
    box.append(el('p',null,`Seçtiğiniz: ${data.selectedKey} · Doğru cevap: ${data.correctKey} · Puan: ${data.score} / geçme eşiği ${data.passThreshold}`));
    if(data.expectedReasoning)box.append(el('p','academy-training-reasoning',data.expectedReasoning));
    box.append(el('small','academy-source',`Deneme kaydı ${data.attemptId} · ${data.attemptedAt}`));
    if(index<questions.length-1){const next=el('button','btn primary','Sonraki soruya geç →');next.type='button';next.id='academyTrainingAdvance';next.addEventListener('click',()=>showQuestion(index+1));box.append(next)}
    else box.append(el('p','academy-training-done','Bu modüldeki tüm özel eğitim soruları cevaplandı.'));
    status('Deneme kaydedildi ve sunucudan doğrulandı.');
    await loadAttempts(selectedRow);
  }

  async function loadAttempts(row){
    const {data,error}=await client.from('academy_ism_attempts').select('id,response,is_correct,score,attempted_at').eq('workspace_id',workspace()).eq('question_id',row.id).order('attempted_at',{ascending:false}).limit(20);
    const box=byId('academyTrainingAttempts');box.replaceChildren();
    if(error){box.hidden=false;box.append(el('p',null,`Denemeler okunamadı: ${error.message}`));return}
    box.hidden=false;box.append(el('strong',null,`Denemelerim (${(data||[]).length})`));
    (data||[]).forEach(a=>box.append(el('p','academy-training-attempt',`${a.attempted_at} · seçim ${a.response?.key} · ${a.is_correct?'doğru':'yanlış'} · puan ${a.score}`)));
  }

  async function promoteQuestion(){
    try{
      await refreshSession();if(!session||!workspace())return;
      if(!ownerSecurity)throw new Error('Owner güvenlik modülü yüklenemedi.');
      const packageId=byId('academyTrainingPromotePackage').value.trim(),questionId=byId('academyTrainingPromoteQuestion').value.trim();
      if(!packageId||!questionId)throw new Error('Paket ID ve soru ID gerekli.');
      try{localStorage.setItem(LAST_PROMOTE_KEY,JSON.stringify({packageId,questionId}))}catch{}
      const requestId=crypto.randomUUID(),command={workspaceId:workspace(),packageId,questionId};
      const descriptor={action:TRAINING_ACTION,resourceType:'academy_question',resourceId:questionId,workspaceId:workspace(),command};
      status('Owner doğrulaması bekleniyor…');
      const stepUp=await ownerSecurity.authorize(descriptor,'Soruyu Owner özel eğitimine aktar');
      const {data,error}=await client.functions.invoke('academy-training',{body:{action:'promote_owner_training',workspaceId:workspace(),packageId,questionId,requestId,stepUp}});
      if(error)throw new Error(error.message);if(data?.error)throw new Error(data.error);
      status(data.result?.duplicate?'Bu soru zaten özel eğitimde.':`Aktarıldı: ${data.result?.questionId} (${data.result?.trainingScope}, ${data.result?.verificationStage}).`);
      await loadQuestions();
    }catch(error){status(error.message||String(error),true)}
  }

  build();
  byId('academyModule')?.addEventListener('change',sync);
  document.querySelectorAll('[data-academy-section]').forEach(button=>button.addEventListener('click',()=>setTimeout(sync,0)));
  sync();
  window.SinbadOwnerTraining=Object.freeze({module:MODULE,action:TRAINING_ACTION});
})();
