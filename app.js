

const $=id=>document.getElementById(id);
const get=k=>JSON.parse(localStorage.getItem(k)||'[]');
const set=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));


document.querySelectorAll('[data-open]').forEach(x=>x.onclick=()=>openWorkspace(x.dataset.open));
document.querySelectorAll('.close').forEach(x=>x.onclick=closeWorkspaces);
function openWorkspace(id){document.querySelectorAll('.workspace').forEach(x=>x.classList.remove('active'));$(id).classList.add('active');$(id).scrollIntoView({behavior:'smooth'});renderAll()}
function closeWorkspaces(){document.querySelectorAll('.workspace').forEach(x=>x.classList.remove('active'));scrollTo({top:0,behavior:'smooth'})}


let db;
function withTimeout(promise,ms=30000,label='Operation'){
 return Promise.race([
  promise,
  new Promise((_,reject)=>setTimeout(()=>reject(new Error(`${label} timed out after ${ms/1000}s`)),ms))
 ]);
}
function openDB(){
 return new Promise((resolve,reject)=>{
  if(!('indexedDB' in window)){reject(new Error('IndexedDB is not available in this browser mode.'));return;}
  const req=indexedDB.open('AtlasMarineFiles',2);
  req.onupgradeneeded=e=>{
   const d=e.target.result;
   let s;
   if(!d.objectStoreNames.contains('files')){
    s=d.createObjectStore('files',{keyPath:'id',autoIncrement:true});
   }else{
    s=e.target.transaction.objectStore('files');
   }
   if(!s.indexNames.contains('folder'))s.createIndex('folder','folder',{unique:false});
   if(!s.indexNames.contains('name'))s.createIndex('name','name',{unique:false});
  };
  req.onsuccess=e=>{
   db=e.target.result;
   db.onversionchange=()=>db.close();
   resolve(db);
  };
  req.onerror=e=>reject(e.target.error||new Error('IndexedDB could not be opened.'));
  req.onblocked=()=>reject(new Error('IndexedDB upgrade is blocked. Close other Atlas Marine OS tabs and reload.'));
 });
}
function ensureDB(){
 if(db)return Promise.resolve(db);
 return openDB();
}
function txStore(mode='readonly'){
 if(!db)throw new Error('Local database is not ready.');
 return db.transaction('files',mode).objectStore('files');
}
function dbAll(){return new Promise((res,rej)=>{try{const r=txStore().getAll();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error)}catch(e){rej(e)}})}
function dbAdd(obj){return new Promise((res,rej)=>{try{const r=txStore('readwrite').add(obj);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)}catch(e){rej(e)}})}
function dbDelete(id){return new Promise((res,rej)=>{try{const r=txStore('readwrite').delete(id);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)}catch(e){rej(e)}})}
function dbPut(obj){return new Promise((res,rej)=>{try{const r=txStore('readwrite').put(obj);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)}catch(e){rej(e)}})}


async function fileToText(file){
 const textTypes=['text/','application/json','application/xml','text/csv'];
 if(textTypes.some(t=>file.type.startsWith(t))) return (await file.text()).slice(0,200000);
 return '';
}
if($('uploadDocs')) $('uploadDocs').onclick=async()=>{
 const input=$('docFiles');
 const files=[...(input.files||[])];
 if(!files.length){alert('Choose one or more files first.');return;}
 const status=$('uploadStatus');
 $('uploadDocs').disabled=true;
 status.textContent=`Preparing ${files.length} file(s)...`;
 try{
  await ensureDB();
  let done=0;
  for(const f of files){
   status.textContent=`Saving ${done+1}/${files.length}: ${f.name}`;
   const buffer=await withTimeout(f.arrayBuffer(),30000,'Reading file');
   const blob=new Blob([buffer],{type:f.type||'application/octet-stream'});
   const record={
    name:f.name,
    type:f.type||'application/octet-stream',
    size:f.size,
    folder:$('docFolder').value,
    tags:$('docTags').value.trim(),
    created:new Date().toISOString(),
    blob,
    text:await fileToText(f)
   };
   await withTimeout(dbAdd(record),30000,'Saving file');
   done++;
  }
  input.value='';
  status.textContent=`✓ ${done} file(s) saved locally.`;
  await renderDocuments();
  await renderSummary();
 }catch(error){
  console.error('Atlas local upload failed',error);
  status.textContent=`Upload failed: ${error.message||error}`;
  alert(`Local upload failed.


${error.message||error}


Safari Private Browsing may restrict persistent storage. Open the normal Safari tab or use Cloud Document Center.`);
 }finally{
  $('uploadDocs').disabled=false;
 }
}
function openFolderUpload(folder){
 const bucket=folder==='Nautical Publications'?'nautical-publications':folder==='Nautical Charts'?'nautical-charts':'atlas-documents';
 openCloudBucket(bucket);
}


async function renderDocuments(){
 if(!$('documentList'))return;
 const rows=await dbAll(),q=($('docSearch').value||'').toLowerCase(),folder=$('docFolderFilter').value,type=$('docTypeFilter').value;
 const filtered=rows.filter(x=>(!folder||x.folder===folder)&&(!type||x.type===type)&&(!q||`${x.name} ${x.folder} ${x.tags} ${x.text}`.toLowerCase().includes(q)));
 $('documentList').innerHTML=filtered.length?filtered.map(fileRow).join(''):'<div class="empty">No matching files.</div>';
 renderFolderViews(rows);
}
function fileRow(x){return `<div class="file-row"><div><div class="file-name">${esc(x.name)}</div><div class="file-meta">${esc(x.folder)} • ${esc(x.tags||'No tags')}</div></div><div>${esc(x.type||'Unknown')}</div><div>${formatBytes(x.size)}</div><div>${new Date(x.created).toLocaleDateString()}</div><div class="file-actions"><button class="btn" onclick="previewFile(${x.id})">Open</button><button class="btn" onclick="downloadFile(${x.id})">Download</button><button class="btn" onclick="printFile(${x.id})">Print</button><button class="btn" onclick="shareFile(${x.id})">Share</button><button class="btn" onclick="renameFile(${x.id})">Rename</button><button class="btn danger" onclick="removeFile(${x.id})">Delete</button></div></div>`}
async function getFile(id){return new Promise((res,rej)=>{const r=txStore().get(id);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function previewFile(id){const x=await getFile(id),url=URL.createObjectURL(x.blob);window.open(url,'_blank')}
async function downloadFile(id){const x=await getFile(id),url=URL.createObjectURL(x.blob),a=document.createElement('a');a.href=url;a.download=x.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
async function printFile(id){const x=await getFile(id),url=URL.createObjectURL(x.blob),w=window.open(url,'_blank');setTimeout(()=>{try{w.print()}catch(e){}},1000)}
async function shareFile(id){const x=await getFile(id),file=new File([x.blob],x.name,{type:x.type});if(navigator.share&&navigator.canShare?.({files:[file]})){await navigator.share({title:x.name,files:[file]})}else{downloadFile(id);alert('Direct sharing is unavailable here; the file was downloaded for sharing.')}}
async function renameFile(id){const x=await getFile(id),name=prompt('New file name:',x.name);if(name){x.name=name;await dbPut(x);renderDocuments()}}
async function removeFile(id){if(confirm('Delete this file from local storage?')){await dbDelete(id);renderDocuments();renderSummary()}}
function formatBytes(n){if(n<1024)return n+' B';if(n<1048576)return (n/1024).toFixed(1)+' KB';return (n/1048576).toFixed(1)+' MB'}
async function renderFolderViews(rows){$('publicationList').innerHTML=(rows.filter(x=>x.folder==='Nautical Publications').map(fileRow).join('')||'<div class="empty">No publications uploaded.</div>');$('chartList').innerHTML=(rows.filter(x=>x.folder==='Nautical Charts').map(fileRow).join('')||'<div class="empty">No charts uploaded.</div>')}


$('knowledgeSearchBtn').onclick=async()=>{const q=$('knowledgeQuery').value.toLowerCase().trim(),rows=await dbAll();const out=rows.filter(x=>!q||`${x.name} ${x.folder} ${x.tags} ${x.text}`.toLowerCase().includes(q));$('knowledgeResults').innerHTML=out.length?out.map(x=>`<article class="record"><h3>${esc(x.name)}</h3><div class="muted">${esc(x.folder)} • ${esc(x.tags)}</div><p>${esc((x.text||'No extracted text available.').slice(0,500))}</p><button class="btn" onclick="previewFile(${x.id})">Open Source</button></article>`).join(''):'<div class="empty">No matching knowledge found.</div>'}


function setupDocumentFilters(){
 if(!$('docFolder')||!$('docFolderFilter'))return;
 const folders=[...$('docFolder').options].map(o=>o.value);folders.forEach(x=>$('docFolderFilter').insertAdjacentHTML('beforeend',`<option>${esc(x)}</option>`));
}
['docSearch','docFolderFilter','docTypeFilter'].forEach(id=>{if($(id))$(id).addEventListener(id==='docSearch'?'input':'change',renderDocuments);});


function setupPilot(){[...new Set(PILOT_DATA.map(x=>x.country))].sort().forEach(x=>$('countryFilter').insertAdjacentHTML('beforeend',`<option>${esc(x)}</option>`));[...new Set(PILOT_DATA.map(x=>x.type))].sort().forEach(x=>$('typeFilter').insertAdjacentHTML('beforeend',`<option>${esc(x)}</option>`))}
function renderPilot(){const q=$('pilotSearch').value.toLowerCase(),c=$('countryFilter').value,t=$('typeFilter').value;const rows=PILOT_DATA.filter(x=>(!c||x.country===c)&&(!t||x.type===t)&&(!q||JSON.stringify(x).toLowerCase().includes(q)));$('pilotGrid').innerHTML=rows.map(x=>`<article class="record"><h3>${esc(x.name)}</h3><div class="muted">${esc(x.country)} • ${esc(x.region)}</div><p>${esc(x.approach)}</p><p class="warning">${esc(x.captainNote)}</p></article>`).join('')}
function setupRoutes(){[...new Set(ROUTE_DATA.map(x=>x.type))].forEach(x=>$('routeType').insertAdjacentHTML('beforeend',`<option>${esc(x)}</option>`));[...new Set(ROUTE_DATA.map(x=>x.status))].forEach(x=>$('routeStatus').insertAdjacentHTML('beforeend',`<option>${esc(x)}</option>`))}
function renderRoutes(){const q=$('routeSearch').value.toLowerCase(),t=$('routeType').value,s=$('routeStatus').value;const rows=ROUTE_DATA.filter(x=>(!t||x.type===t)&&(!s||x.status===s)&&(!q||JSON.stringify(x).toLowerCase().includes(q)));$('routeGrid').innerHTML=rows.map(x=>`<article class="record"><h3>${esc(x.title)}</h3><div class="muted">${esc(x.type)} • ${esc(x.status)}</div><p>${x.stops.map(esc).join(' → ')}</p></article>`).join('')}


$('saveVessel').onclick=()=>{const a=get('atlas_fleet');a.unshift({name:$('vName').value,type:$('vType').value,flag:$('vFlag').value,loa:$('vLoa').value,beam:$('vBeam').value,draft:$('vDraft').value,cruise:$('vCruise').value,fuel:$('vFuel').value,water:$('vWater').value,notes:$('vNotes').value});set('atlas_fleet',a);renderFleet()}
function renderFleet(){const a=get('atlas_fleet');$('fleetList').innerHTML=a.map(v=>`<article class="record"><h3>${esc(v.name)}</h3><p>${esc(v.type)} • ${esc(v.flag)} • Draft ${esc(v.draft)} m</p></article>`).join('')||'<div class="empty">No vessel records.</div>'}
$('saveCrew').onclick=()=>{const a=get('atlas_crew');a.unshift({name:$('crewName').value,rank:$('crewRank').value,nationality:$('crewNationality').value,passport:$('crewPassport').value,medical:$('crewMedical').value,stcw:$('crewStcw').value,visa:$('crewVisa').value,contract:$('crewContract').value,contact:$('crewContact').value,notes:$('crewNotes').value});set('atlas_crew',a);renderCrew()}
function renderCrew(){const a=get('atlas_crew');$('crewList').innerHTML=a.map(c=>`<article class="record"><h3>${esc(c.name)}</h3><p>${esc(c.rank)} • ${esc(c.nationality)}</p></article>`).join('')||'<div class="empty">No crew records.</div>'}


async function renderSummary(){const rows=await dbAll();$('sumFiles').textContent=rows.length;$('sumPubs').textContent=rows.filter(x=>x.folder==='Nautical Publications').length;$('sumCharts').textContent=rows.filter(x=>x.folder==='Nautical Charts').length;$('sumStorage').textContent=(rows.reduce((a,x)=>a+x.size,0)/1048576).toFixed(1)+' MB'}
async function renderAll(){renderFleet();renderCrew();renderPilot();renderRoutes();await renderDocuments();await renderSummary()}


['pilotSearch','countryFilter','typeFilter'].forEach(id=>$(id).addEventListener(id==='pilotSearch'?'input':'change',renderPilot));
['routeSearch','routeType','routeStatus'].forEach(id=>$(id).addEventListener(id==='routeSearch'?'input':'change',renderRoutes));


document.addEventListener('DOMContentLoaded',async()=>{
 setupDocumentFilters();setupPilot();setupRoutes();
 try{
  await ensureDB();
  await renderAll();
  const s=$('uploadStatus'); if(s && !s.textContent.trim())s.textContent='Local storage ready.';
 }catch(error){
  console.error(error);
  const s=$('uploadStatus');
  if(s)s.textContent=`Local storage unavailable: ${error.message}`;
 }
});
if('serviceWorker'in navigator)addEventListener('load',()=>navigator.serviceWorker.register('./sw.js'));




const sinbadState = {
  messages: JSON.parse(localStorage.getItem('atlas_sinbad_messages') || '[]')
};


function saveSinbadMessages(){
  localStorage.setItem('atlas_sinbad_messages', JSON.stringify(sinbadState.messages.slice(-80)));
}
function renderSinbadMessages(){
  const box=$('sinbadMessages'); if(!box) return;
  if(!sinbadState.messages.length){
    sinbadState.messages.push({
      role:'sinbad',
      text:'Welcome aboard, Captain. I am Captain Sinbad, your Atlas AI Marine Intelligence Guide.\n\nAsk me about routes, documents, charts, crew records or your Atlas Marine knowledge library.'
    });
    saveSinbadMessages();
  }
  box.innerHTML=sinbadState.messages.map(m=>`
    <div class="chat-bubble ${m.role==='user'?'user':'sinbad'}">
      <span class="speaker">${m.role==='user'?'Captain':'Captain Sinbad'}</span>
      ${esc(m.text)}
    </div>`).join('');
  box.scrollTop=box.scrollHeight;
}
function addSinbadMessage(role,text){
  sinbadState.messages.push({role,text,at:new Date().toISOString()});
  saveSinbadMessages();renderSinbadMessages();
}
async function sinbadLocalAnswer(query){
  const q=query.toLowerCase();
  const files=await dbAll();
  const crew=get('atlas_crew');
  const fleet=get('atlas_fleet');
  const fileMatches=files.filter(x=>`${x.name} ${x.folder} ${x.tags} ${x.text}`.toLowerCase().includes(q)).slice(0,6);
  const pilotMatches=PILOT_DATA.filter(x=>JSON.stringify(x).toLowerCase().includes(q)).slice(0,4);
  const routeMatches=ROUTE_DATA.filter(x=>JSON.stringify(x).toLowerCase().includes(q)).slice(0,4);


  if(q.includes('crew') || q.includes('expiry') || q.includes('certificate')){
    const alerts=[];
    crew.forEach(c=>[['Passport',c.passport],['Medical',c.medical],['STCW',c.stcw],['Visa',c.visa],['Contract',c.contract]].forEach(([type,date])=>{
      if(!date)return; const days=Math.ceil((new Date(date+'T00:00:00')-new Date())/86400000);
      if(days<=90) alerts.push(`${c.name || 'Crew member'} — ${type}: ${days<0?'expired '+Math.abs(days)+' days ago':days+' days remaining'}`);
    }));
    return alerts.length ? `I found these crew alerts:\n\n${alerts.join('\n')}` : 'I found no crew items expiring within 90 days.';
  }


  if(q.includes('chart')){
    const charts=files.filter(x=>x.folder==='Nautical Charts');
    return charts.length ? `You currently have ${charts.length} nautical chart file(s):\n\n${charts.slice(0,10).map(x=>'• '+x.name).join('\n')}` : 'No nautical charts are stored on this device yet.';
  }


  if(q.includes('publication') || q.includes('solas') || q.includes('marpol')){
    const pubs=files.filter(x=>x.folder==='Nautical Publications' || `${x.name} ${x.tags}`.toLowerCase().includes(q));
    return pubs.length ? `I found ${pubs.length} relevant publication file(s):\n\n${pubs.slice(0,10).map(x=>'• '+x.name).join('\n')}` : 'I could not find a matching nautical publication in the local library. Upload it to Nautical Publications and add descriptive tags.';
  }


  if(q.includes('fleet') || q.includes('vessel')){
    return fleet.length ? `Fleet records:\n\n${fleet.map(v=>`• ${v.name || 'Unnamed vessel'} — ${v.type || 'type not entered'}, draft ${v.draft || '—'} m`).join('\n')}` : 'No vessel has been added to Fleet Manager yet.';
  }


  if(fileMatches.length || pilotMatches.length || routeMatches.length){
    const parts=[];
    if(fileMatches.length)parts.push('Files:\n'+fileMatches.map(x=>'• '+x.name+' ['+x.folder+']').join('\n'));
    if(pilotMatches.length)parts.push('Pilot Library:\n'+pilotMatches.map(x=>'• '+x.name+' — '+x.country).join('\n'));
    if(routeMatches.length)parts.push('Routes:\n'+routeMatches.map(x=>'• '+x.title).join('\n'));
    return `I found the following Atlas Marine records:\n\n${parts.join('\n\n')}`;
  }


  if(q.includes('passage') || q.includes('checklist')){
    return 'Passage planning checklist:\n\n• Confirm vessel particulars and draft\n• Review official charts and notices\n• Verify weather and sea state\n• Calculate distance, ETA and fuel reserve\n• Confirm ports of refuge and alternates\n• Check customs, immigration and pilotage\n• Complete bridge team briefing\n• Save the approved passage in Route Library';
  }


  return 'I searched the local Atlas Marine OS data but did not find a strong match. After the secure cloud AI backend is connected, I will also read indexed PDFs, publications, charts and cross-device records.';
}
async function sendToSinbad(text){
  const q=(text||'').trim(); if(!q)return;
  addSinbadMessage('user',q);
  $('sinbadInput').value='';
  $('sinbadThinking').classList.remove('hidden');
  setTimeout(async()=>{
    const answer=await sinbadLocalAnswer(q);
    $('sinbadThinking').classList.add('hidden');
    addSinbadMessage('sinbad',answer);
  },650);
}
$('sendSinbad').addEventListener('click',()=>sendToSinbad($('sinbadInput').value));
$('sinbadInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendToSinbad($('sinbadInput').value)}});
document.querySelectorAll('.sinbad-prompt').forEach(b=>b.addEventListener('click',()=>sendToSinbad(b.textContent)));
$('sinbadFloat').addEventListener('click',()=>openWorkspace('sinbad'));


const originalRenderAll = renderAll;
renderAll = async function(){
  await originalRenderAll();
  renderSinbadMessages();
};






// ============================================================
// ATLAS MARINE OS v7.0 — CLOUD-FIRST EXPERIENCE
// ============================================================
function formatBytes(bytes=0){
  if(!bytes)return '0 MB';
  const mb=bytes/1024/1024;
  return mb<1024 ? `${mb.toFixed(mb<10?1:0)} MB` : `${(mb/1024).toFixed(1)} GB`;
}
function setSetupProgress(){
  const connected=Boolean(cloudClient);
  const signedIn=Boolean(cloudSession?.user);
  const workspace=Boolean(selectedWorkspaceId);
  const ready=connected&&signedIn&&workspace;
  [['setupStep1',connected],['setupStep2',signedIn],['setupStep3',workspace],['setupStep4',ready]]
    .forEach(([id,ok])=>{const el=$(id);if(el)el.classList.toggle('complete',ok)});
  const dot=$('liveCloudDot'),title=$('liveCloudTitle'),sub=$('liveCloudSubtitle'),guard=$('cloudDocumentGuard');
  if(dot)dot.classList.toggle('online',ready);
  if(title)title.textContent=ready?'Atlas Cloud connected':'Atlas Cloud is not connected';
  if(sub)sub.textContent=ready
    ? `${cloudSession.user.email} • Workspace ready`
    : connected
      ? (signedIn?'Select your Atlas workspace.':'Sign in to continue.')
      : 'Open Cloud Setup & Security to connect this device.';
  if(guard){
    guard.textContent=ready?'✓ Atlas Cloud ready. Files will be stored privately in your selected workspace.':'Connect, sign in and select a workspace before uploading files.';
    guard.classList.toggle('ready',ready);
  }
}
async function refreshCloudSummary(){
  if(!cloudClient||!cloudSession?.user||!selectedWorkspaceId){
    ['sumFiles','sumPubs','sumCharts','sumStorage'].forEach(id=>{if($(id))$(id).textContent='—'});
    return;
  }
  const {data,error}=await cloudClient.from('documents')
    .select('bucket_id,file_size_bytes')
    .eq('workspace_id',selectedWorkspaceId)
    .is('deleted_at',null);
  if(error)return;
  const files=data||[];
  $('sumFiles').textContent=files.length;
  $('sumPubs').textContent=files.filter(f=>f.bucket_id==='nautical-publications').length;
  $('sumCharts').textContent=files.filter(f=>f.bucket_id==='nautical-charts').length;
  $('sumStorage').textContent=formatBytes(files.reduce((n,f)=>n+(Number(f.file_size_bytes)||0),0));
}
function openCloudBucket(bucket){
  openWorkspace('cloud-documents');
  setTimeout(()=>{
    const select=$('cloudBucketSelect');
    if(select){select.value=bucket;loadCloudFiles();}
  },60);
}
document.querySelectorAll('[data-cloud-bucket]').forEach(card=>{
  card.addEventListener('click',()=>openCloudBucket(card.dataset.cloudBucket));
});


// ============================================================
// ATLAS CLOUD CONTROL CENTER v6.0
// ============================================================
let cloudClient = null;
let cloudSession = null;
let selectedWorkspaceId = localStorage.getItem('atlas_selected_workspace') || localStorage.getItem('atlas-v81-workspace') || '';
if(selectedWorkspaceId)localStorage.setItem('atlas_selected_workspace',selectedWorkspaceId);
let authSubscription = null;

function setAuthMessage(message='',type=''){
  const el=$('authMessage');
  if(!el)return;
  el.textContent=message;
  el.className=`auth-message ${type}`.trim();
}
function setAppAccess(){
  const signedIn=Boolean(cloudSession?.user);
  document.body.classList.remove('auth-pending','signed-out','authenticated');
  document.body.classList.add(signedIn?'authenticated':'signed-out');
  if(signedIn && $('authDialog')?.open)$('authDialog').close();
}
function showRecoveryPanel(show=true){
  $('signInPanel').hidden=show;
  $('recoveryPanel').hidden=!show;
  $('authTitle').textContent=show?'Recover Captain Access':'Captain Sign In';
  $('authHelp').textContent=show
    ?'Request the 8-digit code sent by Atlas Marine OS, then choose a new password.'
    :'Sign in to open the complete Atlas Marine OS management bridge.';
  setAuthMessage();
}


function cloudEsc(value=''){
  return String(value).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}
function getCloudConfig(){
  let url=localStorage.getItem('atlas_supabase_url') || '';
  let key=localStorage.getItem('atlas_supabase_publishable_key') || '';
  if(!url || !key){
    try{
      const current=JSON.parse(localStorage.getItem('atlas-v81-supabase-config')||'{}');
      url=url||current.url||'';
      key=key||current.key||'';
      if(url&&key){
        localStorage.setItem('atlas_supabase_url',url);
        localStorage.setItem('atlas_supabase_publishable_key',key);
      }
    }catch(_error){}
  }
  return {
    url,
    key
  };
}
function initCloudClient(){
  const {url,key}=getCloudConfig();
  if(!url || !key || !window.supabase){
    cloudClient=null; updateCloudStatus(); return null;
  }
  try{
    cloudClient=window.supabase.createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    if(authSubscription)authSubscription.unsubscribe();
    const {data}=cloudClient.auth.onAuthStateChange(async(_event,session)=>{
      cloudSession=session;
      updateCloudStatus();
      setAppAccess();
      if(session?.user)await loadWorkspaces();
    });
    authSubscription=data.subscription;
    updateCloudStatus(); return cloudClient;
  }catch(error){
    cloudClient=null; updateCloudStatus(error.message); return null;
  }
}
function updateCloudStatus(error=''){
  const cfg=getCloudConfig();
  $('cloudConnectionStatus').textContent=error ? 'Configuration error' : (cloudClient?'Configured':'Not configured');
  $('cloudAuthStatus').textContent=cloudSession?.user ? cloudSession.user.email : 'Signed out';
  $('cloudWorkspaceStatus').textContent=selectedWorkspaceId ? 'Selected' : 'Not selected';
  $('cloudAiStatus').textContent=cloudClient && cloudSession?.user ? 'Cloud ready' : 'Local mode';
  $('supabaseUrlInput').value=cfg.url;
  $('supabaseKeyInput').value=cfg.key;
  $('cloudUserInfo').textContent=cloudSession?.user ? `Signed in as ${cloudSession.user.email} • User ID: ${cloudSession.user.id}` : 'No active cloud session.';
  setSetupProgress();
}
async function restoreCloudSession(){
  if(!cloudClient){setAppAccess();return;}
  const {data,error}=await cloudClient.auth.getSession();
  if(error)setAuthMessage(error.message,'error');
  cloudSession=data.session; updateCloudStatus(); setAppAccess();
  if(cloudSession?.user) await loadWorkspaces();
}
async function saveCloudConfig(){
  const url=$('supabaseUrlInput').value.trim().replace(/\/$/,'');
  const key=$('supabaseKeyInput').value.trim();
  if(!/^https:\/\/.+\.supabase\.co$/.test(url)){alert('Enter a valid Supabase Project URL.');return;}
  if(!key){alert('Enter the publishable key.');return;}
  if(/secret|service_role/i.test(key)){alert('Never enter a secret or service-role key in Atlas Marine OS.');return;}
  localStorage.setItem('atlas_supabase_url',url);
  localStorage.setItem('atlas_supabase_publishable_key',key);
  initCloudClient(); await restoreCloudSession(); alert('Atlas Cloud connection saved.');
}
async function testCloudConnection(){
  if(!cloudClient){alert('Save the connection first.');return;}
  const {error}=await cloudClient.from('workspaces').select('id').limit(1);
  $('cloudConnectionStatus').textContent=error ? 'Connected • login required' : 'Connected';
  alert(error ? `Supabase reached. ${error.message}` : 'Atlas Cloud connection successful.');
}
async function cloudSignIn(){
  if(!cloudClient){alert('Configure Atlas Cloud first.');return;}
  const {data,error}=await cloudClient.auth.signInWithPassword({email:$('cloudEmail').value.trim(),password:$('cloudPassword').value});
  if(error){alert(error.message);return;}
  cloudSession=data.session; updateCloudStatus(); setAppAccess(); await loadWorkspaces(); alert('Welcome aboard.');
}
async function cloudSignOut(){
  if(cloudClient)await cloudClient.auth.signOut();
  cloudSession=null; selectedWorkspaceId=''; localStorage.removeItem('atlas_selected_workspace');
  updateCloudStatus(); setAppAccess(); $('workspaceSelect').innerHTML='<option value="">Select workspace</option>';
}

async function gatewaySignIn(){
  setAuthMessage('Signing in…');
  if(!cloudClient){setAuthMessage('Atlas Cloud configuration was not found. Open the previously configured v8.7 site once, or configure it in Cloud Control Center.','error');return;}
  const email=$('gatewayEmail').value.trim();
  const password=$('gatewayPassword').value;
  const {data,error}=await cloudClient.auth.signInWithPassword({email,password});
  if(error){setAuthMessage(error.message,'error');return;}
  cloudSession=data.session;
  updateCloudStatus();
  setAppAccess();
  await loadWorkspaces();
}
async function requestRecoveryCode(){
  if(!cloudClient){setAuthMessage('Atlas Cloud connection is not configured.','error');return;}
  const email=$('recoveryEmail').value.trim();
  if(!email){setAuthMessage('Enter your email address.','error');return;}
  setAuthMessage('Sending recovery code…');
  const redirectTo=`${location.origin}${location.pathname}`;
  const {error}=await cloudClient.auth.resetPasswordForEmail(email,{redirectTo});
  if(error){setAuthMessage(error.message,'error');return;}
  setAuthMessage('Recovery request accepted. Check Inbox, Spam and Promotions.','success');
}
async function completeRecovery(){
  if(!cloudClient){setAuthMessage('Atlas Cloud connection is not configured.','error');return;}
  const email=$('recoveryEmail').value.trim();
  const token=$('recoveryCode').value.replace(/\D/g,'');
  const password=$('recoveryNewPassword').value;
  if(token.length<6||token.length>8){setAuthMessage('Enter the recovery code from the newest email.','error');return;}
  if(password.length<8){setAuthMessage('New password must be at least 8 characters.','error');return;}
  setAuthMessage('Verifying code…');
  const {error:verifyError}=await cloudClient.auth.verifyOtp({email,token,type:'recovery'});
  if(verifyError){setAuthMessage(verifyError.message,'error');return;}
  const {error:updateError}=await cloudClient.auth.updateUser({password});
  if(updateError){setAuthMessage(updateError.message,'error');return;}
  await cloudClient.auth.signOut();
  cloudSession=null;
  showRecoveryPanel(false);
  setAppAccess();
  setAuthMessage('Password updated. Sign in with your new password.','success');
}
async function loadWorkspaces(){
  if(!cloudClient || !cloudSession?.user)return;
  const {data,error}=await cloudClient.from('workspaces').select('id,name,slug,created_at').order('name');
  if(error){$('workspaceDetails').textContent=error.message;return;}
  $('workspaceSelect').innerHTML='<option value="">Select workspace</option>'+(data||[]).map(w=>`<option value="${cloudEsc(w.id)}">${cloudEsc(w.name)}</option>`).join('');
  if(selectedWorkspaceId && (data||[]).some(w=>w.id===selectedWorkspaceId)) $('workspaceSelect').value=selectedWorkspaceId;
  else if(data?.length){selectedWorkspaceId=data[0].id;$('workspaceSelect').value=selectedWorkspaceId;}
  localStorage.setItem('atlas_selected_workspace',selectedWorkspaceId);
  const selected=(data||[]).find(w=>w.id===selectedWorkspaceId);
  $('workspaceDetails').textContent=selected ? `${selected.name} • ${selected.id}` : 'No workspace selected.';
  updateCloudStatus();
  await refreshCloudSummary();
}
async function loadMembers(){
  if(!selectedWorkspaceId || !cloudClient)return;
  const {data,error}=await cloudClient.from('workspace_members').select('user_id,role,is_active,joined_at').eq('workspace_id',selectedWorkspaceId).order('joined_at');
  $('memberList').innerHTML=error ? cloudEsc(error.message) : (data?.length ? data.map(m=>`
    <div class="cloud-list-item">
      <strong>${cloudEsc(m.user_id)}</strong>
      <div class="member-role-row">
        <select class="member-role-select" data-user="${cloudEsc(m.user_id)}">
          ${['owner','administrator','captain','chief_officer','chief_engineer','dpa','crew','viewer','auditor']
            .map(r=>`<option value="${r}" ${m.role===r?'selected':''}>${r}</option>`).join('')}
        </select>
        <button class="btn save-member-role" data-user="${cloudEsc(m.user_id)}">Save role</button>
      </div>
      <small>${m.is_active?'Active':'Inactive'} • Joined ${cloudEsc(m.joined_at||'')}</small>
    </div>`).join('') : 'No members found.');
}
async function loadAiJobs(){
  if(!selectedWorkspaceId || !cloudClient)return;
  const {data,error}=await cloudClient.from('ai_index_jobs').select('id,status,document_id,requested_at,error_message').eq('workspace_id',selectedWorkspaceId).order('requested_at',{ascending:false}).limit(30);
  $('aiJobList').innerHTML=error ? cloudEsc(error.message) : (data?.length ? data.map(j=>`<div class="cloud-list-item"><strong>${cloudEsc(j.status)}</strong><br><small>Document ${cloudEsc(j.document_id)}<br>${cloudEsc(j.requested_at)}${j.error_message?'<br>'+cloudEsc(j.error_message):''}</small></div>`).join('') : 'No indexing jobs.');
}
async function runSecurityCheck(){
  const cfg=getCloudConfig(), checks=[];
  checks.push(cfg.url&&cfg.key?'✓ Cloud configuration present':'✗ Cloud configuration missing');
  checks.push(cloudSession?.user?'✓ Authenticated session':'✗ Not signed in');
  checks.push(selectedWorkspaceId?'✓ Workspace selected':'✗ Workspace not selected');
  checks.push(!/secret|service_role/i.test(cfg.key)?'✓ No obvious server secret stored':'✗ Dangerous key detected');
  $('securityCheckResult').textContent=checks.join(' • ');
}
async function uploadCloudFiles(){
  if(!cloudClient || !cloudSession?.user || !selectedWorkspaceId){$('cloudUploadProgress').textContent='Connect to Atlas Cloud, sign in and select a workspace first.';alert('Connect, sign in and select a workspace first.');return;}
  const files=[...$('cloudFileInput').files]; if(!files.length){alert('Select one or more files.');return;}
  const bucket=$('cloudBucketSelect').value;
  const folder=($('cloudFolderPath').value.trim()||'general').replace(/^\/+|\/+$/g,'').replace(/[^a-zA-Z0-9._/-]+/g,'-');
  let completed=0;
  for(const file of files){
    $('cloudUploadProgress').textContent=`Uploading ${completed+1}/${files.length}: ${file.name}`;
    const safeName=file.name.replace(/[^a-zA-Z0-9._-]+/g,'-');
    const path=`${selectedWorkspaceId}/${folder}/${Date.now()}-${safeName}`;
    const {error:uploadError}=await cloudClient.storage.from(bucket).upload(path,file,{upsert:false});
    if(uploadError){$('cloudUploadProgress').textContent=`Upload failed: ${uploadError.message}`;continue;}
    const {error:metaError}=await cloudClient.from('documents').insert({
      workspace_id:selectedWorkspaceId,bucket_id:bucket,object_path:path,original_filename:file.name,title:file.name,
      mime_type:file.type||null,file_size_bytes:file.size,status:'active',
      classification:bucket==='crew-confidential'?'confidential':'standard',created_by:cloudSession.user.id
    });
    if(metaError)$('cloudUploadProgress').textContent=`File uploaded but metadata failed: ${metaError.message}`;
    completed++;
  }
  $('cloudUploadProgress').textContent=`✓ ${completed}/${files.length} file(s) uploaded to Atlas Cloud.`; await loadCloudFiles(); await refreshCloudSummary();
}
async function loadCloudFiles(){
  if(!cloudClient || !selectedWorkspaceId)return;
  const bucket=$('cloudBucketSelect').value;
  const {data,error}=await cloudClient.from('documents').select('id,title,original_filename,bucket_id,object_path,file_size_bytes,status,classification,created_at').eq('workspace_id',selectedWorkspaceId).eq('bucket_id',bucket).order('created_at',{ascending:false}).limit(100);
  if(error){$('cloudFileList').textContent=error.message;return;}
  $('cloudFileList').innerHTML=data?.length ? data.map(d=>`
    <article class="cloud-file-card">
      <h4>${cloudEsc(d.title||d.original_filename)}</h4>
      <small>${cloudEsc(d.bucket_id)} • ${Math.round((d.file_size_bytes||0)/1024)} KB<br>${cloudEsc(d.status)} • ${cloudEsc(d.classification)}</small>
      <div class="cloud-file-actions">
        <button class="btn cloud-open-file" data-bucket="${cloudEsc(d.bucket_id)}" data-path="${cloudEsc(d.object_path)}">Open</button>
        <button class="btn cloud-download-file" data-bucket="${cloudEsc(d.bucket_id)}" data-path="${cloudEsc(d.object_path)}" data-name="${cloudEsc(d.original_filename)}">Download</button>
        <button class="btn cloud-share-file" data-bucket="${cloudEsc(d.bucket_id)}" data-path="${cloudEsc(d.object_path)}" data-name="${cloudEsc(d.original_filename)}">Share</button>
        <button class="btn cloud-rename-file" data-id="${cloudEsc(d.id)}" data-bucket="${cloudEsc(d.bucket_id)}" data-path="${cloudEsc(d.object_path)}" data-name="${cloudEsc(d.original_filename)}">Rename</button>
        <button class="btn cloud-index-file" data-id="${cloudEsc(d.id)}">Index AI</button>
        <button class="btn danger cloud-delete-file" data-id="${cloudEsc(d.id)}" data-bucket="${cloudEsc(d.bucket_id)}" data-path="${cloudEsc(d.object_path)}">Delete</button>
      </div>
    </article>`).join('') : 'No cloud files in this category.';
}
async function openCloudFile(bucket,path){
  const {data,error}=await cloudClient.storage.from(bucket).createSignedUrl(path,300);
  if(error){alert(error.message);return;} window.open(data.signedUrl,'_blank','noopener');
}
async function indexCloudDocument(documentId){
  if(!cloudClient)return;
  const {data,error}=await cloudClient.functions.invoke('index-document',{body:{documentId}});
  alert(error ? error.message : `Index request completed: ${JSON.stringify(data)}`); await loadAiJobs();
}




async function saveMemberRole(userId){
  if(!cloudClient || !selectedWorkspaceId)return;
  const select=document.querySelector(`.member-role-select[data-user="${CSS.escape(userId)}"]`);
  if(!select)return;
  const {error}=await cloudClient.from('workspace_members')
    .update({role:select.value})
    .eq('workspace_id',selectedWorkspaceId)
    .eq('user_id',userId);
  alert(error ? error.message : 'Role updated.');
  if(!error)await loadMembers();
}


async function downloadCloudFile(bucket,path,filename='atlas-file'){
  const {data,error}=await cloudClient.storage.from(bucket).download(path);
  if(error){alert(error.message);return;}
  const url=URL.createObjectURL(data);
  const a=document.createElement('a');
  a.href=url;a.download=filename;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}


async function shareCloudFile(bucket,path,filename='atlas-file'){
  const {data,error}=await cloudClient.storage.from(bucket).createSignedUrl(path,600);
  if(error){alert(error.message);return;}
  if(navigator.share){
    await navigator.share({title:filename,url:data.signedUrl});
  }else{
    await navigator.clipboard.writeText(data.signedUrl);
    alert('10-minute secure link copied.');
  }
}


async function renameCloudFile(documentId,bucket,oldPath,oldName){
  const newName=prompt('New file name:',oldName);
  if(!newName || newName===oldName)return;
  const safeName=newName.replace(/[^a-zA-Z0-9._-]+/g,'-');
  const parts=oldPath.split('/');parts[parts.length-1]=`${Date.now()}-${safeName}`;
  const newPath=parts.join('/');
  const {error:moveError}=await cloudClient.storage.from(bucket).move(oldPath,newPath);
  if(moveError){alert(moveError.message);return;}
  const {error:metaError}=await cloudClient.from('documents')
    .update({original_filename:newName,title:newName,object_path:newPath})
    .eq('id',documentId);
  alert(metaError ? `File moved but metadata failed: ${metaError.message}` : 'File renamed.');
  await loadCloudFiles();
}


async function deleteCloudFile(documentId,bucket,path){
  if(!confirm('Delete this cloud file?'))return;
  const {error:fileError}=await cloudClient.storage.from(bucket).remove([path]);
  if(fileError){alert(fileError.message);return;}
  const {error:metaError}=await cloudClient.from('documents').delete().eq('id',documentId);
  alert(metaError ? `File deleted but metadata failed: ${metaError.message}` : 'File deleted.');
  await loadCloudFiles(); await refreshCloudSummary();
}


$('saveCloudConfig').addEventListener('click',saveCloudConfig);
$('clearCloudConfig').addEventListener('click',()=>{localStorage.removeItem('atlas_supabase_url');localStorage.removeItem('atlas_supabase_publishable_key');cloudClient=null;cloudSession=null;updateCloudStatus();});
$('testCloudConnection').addEventListener('click',testCloudConnection);
$('cloudSignIn').addEventListener('click',cloudSignIn);
$('cloudSignOut').addEventListener('click',cloudSignOut);
$('refreshWorkspaces').addEventListener('click',loadWorkspaces);
$('workspaceSelect').addEventListener('change',async e=>{selectedWorkspaceId=e.target.value;localStorage.setItem('atlas_selected_workspace',selectedWorkspaceId);updateCloudStatus();await loadMembers();await loadCloudFiles();await refreshCloudSummary();});
$('refreshMembers').addEventListener('click',loadMembers);
$('refreshAiJobs').addEventListener('click',loadAiJobs);
$('runSecurityCheck').addEventListener('click',runSecurityCheck);
$('uploadCloudFiles').addEventListener('click',uploadCloudFiles);
$('refreshCloudFiles').addEventListener('click',loadCloudFiles);
$('cloudBucketSelect').addEventListener('change',loadCloudFiles);
$('cloudFileList').addEventListener('click',e=>{
  const o=e.target.closest('.cloud-open-file');
  const d=e.target.closest('.cloud-download-file');
  const s=e.target.closest('.cloud-share-file');
  const r=e.target.closest('.cloud-rename-file');
  const i=e.target.closest('.cloud-index-file');
  const x=e.target.closest('.cloud-delete-file');
  if(o)openCloudFile(o.dataset.bucket,o.dataset.path);
  if(d)downloadCloudFile(d.dataset.bucket,d.dataset.path,d.dataset.name);
  if(s)shareCloudFile(s.dataset.bucket,s.dataset.path,s.dataset.name);
  if(r)renameCloudFile(r.dataset.id,r.dataset.bucket,r.dataset.path,r.dataset.name);
  if(i)indexCloudDocument(i.dataset.id);
  if(x)deleteCloudFile(x.dataset.id,x.dataset.bucket,x.dataset.path);
});
$('memberList').addEventListener('click',e=>{
  const b=e.target.closest('.save-member-role');
  if(b)saveMemberRole(b.dataset.user);
});
$('openLocalDocuments').addEventListener('click',()=>openWorkspace('documents'));

$('openCaptainSignIn').addEventListener('click',()=>{
  showRecoveryPanel(false);
  $('authDialog').showModal();
});
$('closeAuthDialog').addEventListener('click',()=>$('authDialog').close());
$('gatewaySignIn').addEventListener('click',gatewaySignIn);
$('gatewayPassword').addEventListener('keydown',e=>{if(e.key==='Enter')gatewaySignIn();});
$('showRecovery').addEventListener('click',()=>showRecoveryPanel(true));
$('showSignIn').addEventListener('click',()=>showRecoveryPanel(false));
$('requestRecoveryCode').addEventListener('click',requestRecoveryCode);
$('completeRecovery').addEventListener('click',completeRecovery);

initCloudClient();
restoreCloudSession();


setTimeout(()=>{
  if(!localStorage.getItem('atlas_v61_seen')){
    localStorage.setItem('atlas_v61_seen','1');
    const card=document.querySelector('[data-open="cloud-control"]');
    if(card) card.classList.add('attention-pulse');
  }
},800);


setSetupProgress();
