/* Navigation-only adapters. Favorite restoration never starts lessons or tests. */
(function(){
  'use strict';
  const api=window.SinbadFavorites,catalog=window.SinbadFavoritesCatalog;
  if(!api)return;
  const path=location.pathname.split('/').pop();
  const pageId=location.pathname.endsWith('/store/index.html')?'workspace:store':`page:${path}`;
  const title=document.querySelector('.native-brand')||document.querySelector('h1')||document.querySelector('h2')||document.querySelector('.brand');if(title&&catalog[pageId])api.decorate(title,pageId);
  let adapterClient=null,project=null;
  // Reuse an existing page client when available; fallback only reads the existing SDK session.
  try{if(typeof cloudClient!=='undefined'&&cloudClient){adapterClient=cloudClient;project=typeof getCloudConfig==='function'?getCloudConfig().url:null;}else if(typeof config!=='undefined'&&typeof client!=='undefined'&&client?.auth){adapterClient=client;project=config.url;}}catch{}
  if(!adapterClient&&window.supabase){try{project=localStorage.getItem('atlas_supabase_url')||'https://kcvyftrvteqmabvxfebu.supabase.co';const key=localStorage.getItem('atlas_supabase_publishable_key')||'sb_publishable_ZBHFlbhQAnhUAOyVg20Szw_nW0QDj_l';adapterClient=window.supabase.createClient(project,key,{auth:{persistSession:true,autoRefreshToken:false,detectSessionInUrl:false}});}catch{adapterClient=null;project=null;}}
  api.bindAuth(adapterClient,project);
  if(path!=='academy.html')return;
  function targetFor(button){
    const d=button.dataset;if(d.academyOpen)return `academy:layer:${d.academyOpen}`;
    if(d.academyCommand==='home'||d.academyCommand==='back-academy')return null;
    if(d.academyCommand==='section')return `academy:layer:${d.academyTargetSection}`;
    if(d.academyFamily)return `academy:family:${d.academyFamily}`;
    const section=d.academyToolsSection||d.academyScope;
    if(d.academyModule)return `academy:module:${section}:${d.academyModule}`;
    return `academy:layer:${section}`;
  }
  document.querySelectorAll('[data-academy-open],[data-academy-command]').forEach(button=>api.decorate(button,targetFor(button)));
  document.querySelectorAll('[data-gasm-family]').forEach(button=>api.decorate(button,`academy:family:${button.dataset.gasmFamily}`));
  document.querySelectorAll('.gasm-qualification>summary').forEach(heading=>api.decorate(heading,`academy:qualification:${heading.parentElement.dataset.qualificationCode}`));
  document.querySelectorAll('.gasm-subject-button').forEach(button=>api.decorate(button,`academy:subject:${button.dataset.qualificationCode}:${button.dataset.subjectCode}`));
  const moduleSelect=byId('academyModule');const moduleField=moduleSelect.closest('.academy-module-field')||moduleSelect;const syncModuleFavorite=()=>api.decorate(moduleField,`academy:module:${activeAcademySectionId()}:${moduleSelect.value}`);moduleSelect.addEventListener('change',syncModuleFavorite);new MutationObserver(syncModuleFavorite).observe(moduleSelect,{childList:true});syncModuleFavorite();
  function restore(id,{record=true}={}){
    if(!Object.prototype.hasOwnProperty.call(catalog,id))return false;const item=catalog[id];if(!item.kind.startsWith('academy-'))return false;
    stopAcademyNavigationActivity();byId('academyOutput').replaceChildren();byId('academyOutput').hidden=true;
    document.querySelectorAll('.gasm-topic-list').forEach(node=>node.remove());
    academyHistoryRestoring=true;
    try{
      if(item.kind==='academy-layer'){
        if(item.layer==='professor-sinbad')showStandaloneAcademyLayer(item.layer);else selectAcademySection(item.layer,{recordHistory:false});
      }else{
        selectAcademySection(item.section||'goss-gasm',{recordHistory:false});if(item.module)setAcademyModule(item.module);
        document.querySelector('.academy-shell').dataset.academyView='tools';
        if(typeof clearGasmSelection==='function')clearGasmSelection();
        const qualification=gasmCatalog.qualifications.find(q=>q.code===(item.qualification||item.code));
        const branch=qualification?.branch||({deck:'DECK',engine:'ENGINE','electro-technical':'ELECTRO_TECHNICAL'}[item.family]);
        const familyName=item.family||({DECK:'deck',ENGINE:'engine',ELECTRO_TECHNICAL:'electro-technical'}[branch]||null);
        if(typeof showGasmFamily==='function')showGasmFamily(familyName,{keepQualification:qualification?.code||null});
        else{
          document.querySelectorAll('.gasm-branch').forEach(node=>{node.open=node.dataset.gasmBranch===branch;});
          document.querySelectorAll('.gasm-qualification').forEach(node=>{node.open=node.dataset.qualificationCode===qualification?.code;});
          document.querySelectorAll('[data-gasm-family]').forEach(node=>node.classList.toggle('active',({deck:'DECK',engine:'ENGINE','electro-technical':'ELECTRO_TECHNICAL'}[node.dataset.gasmFamily])===branch));
        }
        document.querySelectorAll('.gasm-subject-button').forEach(node=>node.classList.remove('active'));
        if(qualification&&item.subject){const subject=qualification.subjects.find(s=>s.code===item.subject),button=[...document.querySelectorAll('.gasm-subject-button')].find(b=>b.dataset.qualificationCode===qualification.code&&b.dataset.subjectCode===item.subject);if(subject&&button)selectGasmSubject(qualification,subject,button,{startTest:false});}
      }
      academyFavoriteSelection=id;
    }finally{academyHistoryRestoring=false;}
    if(record)recordAcademyHistory();
    return true;
  }
  window.SinbadAcademyFavorites={restore};
  window.SinbadFavoritesNavigate=(id,item)=>item.kind.startsWith('academy-')?restore(id):false;
  byId('academyModule')?.addEventListener('change',()=>{academyFavoriteSelection=null;},true);
  document.querySelectorAll('[data-gasm-family]').forEach(button=>button.addEventListener('click',()=>{academyFavoriteSelection=null;},true));
  const initial=new URLSearchParams(location.search).get('favorite');if(initial&&restore(initial,{record:false}))recordAcademyHistory({replace:true});
})();
