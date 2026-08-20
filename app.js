

const $=id=>document.getElementById(id);
const APP_LANGUAGES=[['tr-TR','TÃ¼rkÃ§e'],['en-US','English'],['ru-RU','Ğ ÑƒÑÑĞºĞ¸Ğ¹'],['fr-FR','FranÃ§ais'],['de-DE','Deutsch'],['ar-SA','Ø§Ù„Ø¹Ø±Ø¨ÙŠØ©'],['es-ES','EspaÃ±ol'],['it-IT','Italiano']];
const APP_I18N={
 'tr-TR':{gatewayTitle:'Sinbad Marine ÅŸu anda geliÅŸtiriliyor.',gatewayText:'GÃ¼venli denizcilik zekÃ¢sÄ± ve yat operasyon platformumuz kullanÄ±ma hazÄ±rlanÄ±yor.',signIn:'Ãœye GiriÅŸi',createAccount:'Hesap OluÅŸtur',checkCloud:'Bulut BaÄŸlantÄ±sÄ±nÄ± Kontrol Et',heroTitle:'Tek KÃ¶prÃ¼. TÃ¼m Operasyonlar.'},
 'en-US':{gatewayTitle:'Sinbad Marine is currently under development.',gatewayText:'Our secure marine intelligence and yacht operations platform is being prepared for launch.',signIn:'Member Sign In',createAccount:'Create Account',checkCloud:'Check Cloud Connection',heroTitle:'One Bridge. Every Operation.'},
 'ru-RU':{gatewayTitle:'Sinbad Marine Ğ½Ğ°Ñ…Ğ¾Ğ´Ğ¸Ñ‚ÑÑ Ğ² Ñ€Ğ°Ğ·Ñ€Ğ°Ğ±Ğ¾Ñ‚ĞºĞµ.',gatewayText:'ĞĞ°ÑˆĞ° Ğ·Ğ°Ñ‰Ğ¸Ñ‰Ñ‘Ğ½Ğ½Ğ°Ñ Ğ¿Ğ»Ğ°Ñ‚Ñ„Ğ¾Ñ€Ğ¼Ğ° Ğ¼Ğ¾Ñ€ÑĞºĞ¾Ğ¹ Ğ°Ğ½Ğ°Ğ»Ğ¸Ñ‚Ğ¸ĞºĞ¸ Ğ¸ ÑƒĞ¿Ñ€Ğ°Ğ²Ğ»ĞµĞ½Ğ¸Ñ ÑÑ…Ñ‚Ğ¾Ğ¹ Ğ³Ğ¾Ñ‚Ğ¾Ğ²Ğ¸Ñ‚ÑÑ Ğº Ğ·Ğ°Ğ¿ÑƒÑĞºÑƒ.',signIn:'Ğ’Ğ¾Ğ¹Ñ‚Ğ¸',createAccount:'Ğ¡Ğ¾Ğ·Ğ´Ğ°Ñ‚ÑŒ Ğ°ĞºĞºĞ°ÑƒĞ½Ñ‚',checkCloud:'ĞŸÑ€Ğ¾Ğ²ĞµÑ€Ğ¸Ñ‚ÑŒ Ğ¾Ğ±Ğ»Ğ°ĞºĞ¾',heroTitle:'ĞĞ´Ğ¸Ğ½ Ğ¼Ğ¾ÑÑ‚Ğ¸Ğº. Ğ’ÑĞµ Ğ¾Ğ¿ĞµÑ€Ğ°Ñ†Ğ¸Ğ¸.'},
 'fr-FR':{gatewayTitle:'Sinbad Marine est en cours de dÃ©veloppement.',gatewayText:'Notre plateforme sÃ©curisÃ©e de renseignement maritime et de gestion de yacht est en prÃ©paration.',signIn:'Connexion membre',createAccount:'CrÃ©er un compte',checkCloud:'Tester le cloud',heroTitle:'Une passerelle. Toutes les opÃ©rations.'},
 'de-DE':{gatewayTitle:'Sinbad Marine wird derzeit entwickelt.',gatewayText:'Unsere sichere Plattform fÃ¼r maritime Informationen und Yachtbetrieb wird vorbereitet.',signIn:'Mitglieder-Login',createAccount:'Konto erstellen',checkCloud:'Cloud prÃ¼fen',heroTitle:'Eine BrÃ¼cke. Alle AblÃ¤ufe.'},
 'ar-SA':{gatewayTitle:'ÙŠØ¬Ø±ÙŠ Ø­Ø§Ù„ÙŠÙ‹Ø§ ØªØ·ÙˆÙŠØ± Sinbad Marine.',gatewayText:'ÙŠØªÙ… Ø¥Ø¹Ø¯Ø§Ø¯ Ù…Ù†ØµØªÙ†Ø§ Ø§Ù„Ø¢Ù…Ù†Ø© Ù„Ù„Ù…Ø¹Ù„ÙˆÙ…Ø§Øª Ø§Ù„Ø¨Ø­Ø±ÙŠØ© ÙˆØ¹Ù…Ù„ÙŠØ§Øª Ø§Ù„ÙŠØ®ÙˆØª Ù„Ù„Ø¥Ø·Ù„Ø§Ù‚.',signIn:'Ø¯Ø®ÙˆÙ„ Ø§Ù„Ø£Ø¹Ø¶Ø§Ø¡',createAccount:'Ø¥Ù†Ø´Ø§Ø¡ Ø­Ø³Ø§Ø¨',checkCloud:'ÙØ­Øµ Ø§Ù„Ø§ØªØµØ§Ù„ Ø§Ù„Ø³Ø­Ø§Ø¨ÙŠ',heroTitle:'Ø¬Ø³Ø± ÙˆØ§Ø­Ø¯. ÙƒÙ„ Ø§Ù„Ø¹Ù…Ù„ÙŠØ§Øª.'},
 'es-ES':{gatewayTitle:'Sinbad Marine estÃ¡ actualmente en desarrollo.',gatewayText:'Nuestra plataforma segura de inteligencia marÃ­tima y operaciones de yates se estÃ¡ preparando.',signIn:'Acceso de miembros',createAccount:'Crear cuenta',checkCloud:'Comprobar la nube',heroTitle:'Un puente. Todas las operaciones.'},
 'it-IT':{gatewayTitle:'Sinbad Marine Ã¨ attualmente in fase di sviluppo.',gatewayText:'La nostra piattaforma sicura per intelligence marittima e gestione yacht Ã¨ in preparazione.',signIn:'Accesso membri',createAccount:'Crea account',checkCloud:'Controlla il cloud',heroTitle:'Un ponte. Tutte le operazioni.'}
};
let appLanguage=localStorage.getItem('atlas_app_language')||'tr-TR';
function applyAppLanguage(language){
  appLanguage=APP_I18N[language]?language:'en-US';localStorage.setItem('atlas_app_language',appLanguage);
  document.documentElement.lang=appLanguage.split('-')[0];document.documentElement.dir=appLanguage.startsWith('ar')?'rtl':'ltr';
  document.querySelectorAll('[data-i18n]').forEach(element=>{const value=APP_I18N[appLanguage][element.dataset.i18n];if(value)element.textContent=value;});
  document.querySelectorAll('.app-language').forEach(select=>select.value=appLanguage);
}
function setupAppLanguages(){
  const options=APP_LANGUAGES.map(([value,label])=>`<option value="${value}">${label}</option>`).join('');
  document.querySelectorAll('.app-language').forEach(select=>{select.innerHTML=options;select.addEventListener('change',event=>applyAppLanguage(event.target.value));});
  applyAppLanguage(appLanguage);
}
setupAppLanguages();
const get=k=>JSON.parse(localStorage.getItem(k)||'[]');
const set=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));


document.querySelectorAll('[data-open]').forEach(x=>x.onclick=()=>openWorkspace(x.dataset.open));
document.querySelectorAll('.close').forEach(x=>x.onclick=closeWorkspaces);
function openWorkspace(id){document.querySelectorAll('.workspace').forEach(x=>x.classList.remove('active'));$(id).classList.add('active');$(id).scrollIntoView({behavior:'smooth'});renderAll();if(id==='enc-viewer')initEncViewer()}
function closeWorkspaces(){document.querySelectorAll('.workspace').forEach(x=>x.classList.remove('active'));scrollTo({top:0,behavior:'smooth'})}

let encMap=null,encChartLayer=null,encBathymetryLayer=null,encSeamarkLayer=null;
function initEncViewer(){
  if(encMap){setTimeout(()=>encMap.updateSize(),80);return;}
  const status=$('encMapStatus');
  if(!window.ol){status.textContent='Map library could not be loaded. Check the internet connection and reload.';status.classList.add('error');return;}
  const chartSource=new ol.source.TileWMS({
    url:'https://gis.charttools.noaa.gov/arcgis/rest/services/MCS/ENCOnline/MapServer/exts/MaritimeChartService/WMSServer',
    params:{LAYERS:'0',TILED:true,FORMAT:'image/png',TRANSPARENT:true,VERSION:'1.3.0'},
    crossOrigin:'anonymous',transition:180
  });
  let loaded=false;
  chartSource.on('tileloadend',()=>{if(!loaded){loaded=true;status.textContent='Official NOAA ENC layer connected.';status.classList.add('ready')}});
  chartSource.on('tileloaderror',()=>{if(!loaded){status.textContent='NOAA ENC layer is temporarily unavailable. Use â€œOpen NOAA Viewerâ€ or try again shortly.';status.classList.add('error')}});
  encChartLayer=new ol.layer.Tile({source:chartSource,zIndex:2});
  encBathymetryLayer=new ol.layer.Tile({
    source:new ol.source.TileWMS({url:'https://ows.emodnet-bathymetry.eu/wms',params:{LAYERS:'emodnet:mean_multicolour',TILED:true,FORMAT:'image/png',TRANSPARENT:false,VERSION:'1.3.0'},crossOrigin:'anonymous'}),
    opacity:.82,zIndex:1
  });
  encSeamarkLayer=new ol.layer.Tile({
    source:new ol.source.XYZ({url:'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png',crossOrigin:'anonymous',attributions:'OpenSeaMap contributors'}),
    zIndex:3
  });
  encMap=new ol.Map({
    target:'encMap',
    layers:[new ol.layer.Tile({source:new ol.source.OSM(),zIndex:0}),encBathymetryLayer,encChartLayer,encSeamarkLayer],
    view:new ol.View({center:ol.proj.fromLonLat([18,36]),zoom:5,minZoom:2,maxZoom:19})
  });
  encMap.addControl(new ol.control.ScaleLine({units:'nautical'}));
  $('encLayerToggle').addEventListener('change',e=>encChartLayer.setVisible(e.target.checked));
  $('encBathymetryToggle').addEventListener('change',e=>encBathymetryLayer.setVisible(e.target.checked));
  $('encSeamarkToggle').addEventListener('change',e=>encSeamarkLayer.setVisible(e.target.checked));
  $('encOpacity').addEventListener('input',e=>encChartLayer.setOpacity(Number(e.target.value)/100));
  $('encResetView').addEventListener('click',()=>encMap.getView().animate({center:ol.proj.fromLonLat([-98.5,38.5]),zoom:4,duration:650}));
  $('encMediterraneanView').addEventListener('click',()=>encMap.getView().animate({center:ol.proj.fromLonLat([18,36]),zoom:5,duration:650}));
  const calculateSafetyDepth=()=>{
    const draft=Math.max(0,Number($('encDraft').value)||0),ukc=Math.max(0,Number($('encUkc').value)||0),squat=Math.max(0,Number($('encSquat').value)||0);
    $('encSafetyDepth').textContent=`${(draft+ukc+squat).toFixed(1)} m`;
  };
  ['encDraft','encUkc','encSquat'].forEach(id=>$(id).addEventListener('input',calculateSafetyDepth));
  calculateSafetyDepth();
  $('encUseLocation').addEventListener('click',()=>{
    if(!navigator.geolocation){status.textContent='Location is not supported on this device.';return;}
    status.textContent='Reading your positionâ€¦';status.classList.remove('error','ready');
    navigator.geolocation.getCurrentPosition(pos=>{
      encMap.getView().animate({center:ol.proj.fromLonLat([pos.coords.longitude,pos.coords.latitude]),zoom:12,duration:800});
      status.textContent='Map centered on your current position.';status.classList.add('ready');
    },err=>{status.textContent=`Location could not be read: ${err.message}`;status.classList.add('error')},{enableHighAccuracy:true,timeout:12000});
  });
}


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
  status.textContent=`âœ“ ${done} file(s) saved locally.`;
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
function fileRow(x){return `<div class="file-row"><div><div class="file-name">${esc(x.name)}</div><div class="file-meta">${esc(x.folder)} â€¢ ${esc(x.tags||'No tags')}</div></div><div>${esc(x.type||'Unknown')}</div><div>${formatBytes(x.size)}</div><div>${new Date(x.created).toLocaleDateString()}</div><div class="file-actions"><button class="btn" onclick="previewFile(${x.id})">Open</button><button class="btn" onclick="downloadFile(${x.id})">Download</button><button class="btn" onclick="printFile(${x.id})">Print</button><button class="btn" onclick="shareFile(${x.id})">Share</button><button class="btn" onclick="renameFile(${x.id})">Rename</button><button class="btn danger" onclick="removeFile(${x.id})">Delete</button></div></div>`}
async function getFile(id){return new Promise((res,rej)=>{const r=txStore().get(id);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function previewFile(id){const x=await getFile(id),url=URL.createObjectURL(x.blob);window.open(url,'_blank')}
async function downloadFile(id){const x=await getFile(id),url=URL.createObjectURL(x.blob),a=document.createElement('a');a.href=url;a.download=x.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
async function printFile(id){const x=await getFile(id),url=URL.createObjectURL(x.blob),w=window.open(url,'_blank');setTimeout(()=>{try{w.print()}catch(e){}},1000)}
async function shareFile(id){const x=await getFile(id),file=new File([x.blob],x.name,{type:x.type});if(navigator.share&&navigator.canShare?.({files:[file]})){await navigator.share({title:x.name,files:[file]})}else{downloadFile(id);alert('Direct sharing is unavailable here; the file was downloaded for sharing.')}}
async function renameFile(id){const x=await getFile(id),name=prompt('New file name:',x.name);if(name){x.name=name;await dbPut(x);renderDocuments()}}
async function removeFile(id){if(confirm('Delete this file from local storage?')){await dbDelete(id);renderDocuments();renderSummary()}}
function formatBytes(n){if(n<1024)return n+' B';if(n<1048576)return (n/1024).toFixed(1)+' KB';return (n/1048576).toFixed(1)+' MB'}
async function renderFolderViews(rows){$('publicationList').innerHTML=(rows.filter(x=>x.folder==='Nautical Publications').map(fileRow).join('')||'<div class="empty">No publications uploaded.</div>');$('chartList').innerHTML=(rows.filter(x=>x.folder==='Nautical Charts').map(fileRow).join('')||'<div class="empty">No charts uploaded.</div>')}


$('knowledgeSearchBtn').onclick=async()=>{const q=$('knowledgeQuery').value.toLowerCase().trim(),rows=await dbAll();const out=rows.filter(x=>!q||`${x.name} ${x.folder} ${x.tags} ${x.text}`.toLowerCase().includes(q));$('knowledgeResults').innerHTML=out.length?out.map(x=>`<article class="record"><h3>${esc(x.name)}</h3><div class="muted">${esc(x.folder)} â€¢ ${esc(x.tags)}</div><p>${esc((x.text||'No extracted text available.').slice(0,500))}</p><button class="btn" onclick="previewFile(${x.id})">Open Source</button></article>`).join(''):'<div class="empty">No matching knowledge found.</div>'}


function setupDocumentFilters(){
 if(!$('docFolder')||!$('docFolderFilter'))return;
 const folders=[...$('docFolder').options].map(o=>o.value);folders.forEach(x=>$('docFolderFilter').insertAdjacentHTML('beforeend',`<option>${esc(x)}</option>`));
}
['docSearch','docFolderFilter','docTypeFilter'].forEach(id=>{if($(id))$(id).addEventListener(id==='docSearch'?'input':'change',renderDocuments);});


function setupPilot(){[...new Set(PILOT_DATA.map(x=>x.country))].sort().forEach(x=>$('countryFilter').insertAdjacentHTML('beforeend',`<option>${esc(x)}</option>`));[...new Set(PILOT_DATA.map(x=>x.type))].sort().forEach(x=>$('typeFilter').insertAdjacentHTML('beforeend',`<option>${esc(x)}</option>`))}
function renderPilot(){const q=$('pilotSearch').value.toLowerCase(),c=$('countryFilter').value,t=$('typeFilter').value;const rows=PILOT_DATA.filter(x=>(!c||x.country===c)&&(!t||x.type===t)&&(!q||JSON.stringify(x).toLowerCase().includes(q)));$('pilotGrid').innerHTML=rows.map(x=>`<article class="record"><h3>${esc(x.name)}</h3><div class="muted">${esc(x.country)} â€¢ ${esc(x.region)}</div><p>${esc(x.approach)}</p><p class="warning">${esc(x.captainNote)}</p></article>`).join('')}
function setupRoutes(){[...new Set(ROUTE_DATA.map(x=>x.type))].forEach(x=>$('routeType').insertAdjacentHTML('beforeend',`<option>${esc(x)}</option>`));[...new Set(ROUTE_DATA.map(x=>x.status))].forEach(x=>$('routeStatus').insertAdjacentHTML('beforeend',`<option>${esc(x)}</option>`))}
function renderRoutes(){const q=$('routeSearch').value.toLowerCase(),t=$('routeType').value,s=$('routeStatus').value;const rows=ROUTE_DATA.filter(x=>(!t||x.type===t)&&(!s||x.status===s)&&(!q||JSON.stringify(x).toLowerCase().includes(q)));$('routeGrid').innerHTML=rows.map(x=>`<article class="record"><h3>${esc(x.title)}</h3><div class="muted">${esc(x.type)} â€¢ ${esc(x.status)}</div><p>${x.stops.map(esc).join(' â†’ ')}</p></article>`).join('')}


$('saveVessel').onclick=()=>{const a=get('atlas_fleet');a.unshift({name:$('vName').value,type:$('vType').value,flag:$('vFlag').value,loa:$('vLoa').value,beam:$('vBeam').value,draft:$('vDraft').value,cruise:$('vCruise').value,fuel:$('vFuel').value,water:$('vWater').value,notes:$('vNotes').value});set('atlas_fleet',a);renderFleet()}
function renderFleet(){const a=get('atlas_fleet');$('fleetList').innerHTML=a.map(v=>`<article class="record"><h3>${esc(v.name)}</h3><p>${esc(v.type)} â€¢ ${esc(v.flag)} â€¢ Draft ${esc(v.draft)} m</p></article>`).join('')||'<div class="empty">No vessel records.</div>'}
$('saveCrew').onclick=()=>{const a=get('atlas_crew');a.unshift({name:$('crewName').value,rank:$('crewRank').value,nationality:$('crewNationality').value,passport:$('crewPassport').value,medical:$('crewMedical').value,stcw:$('crewStcw').value,visa:$('crewVisa').value,contract:$('crewContract').value,contact:$('crewContact').value,notes:$('crewNotes').value});set('atlas_crew',a);renderCrew()}
function renderCrew(){const a=get('atlas_crew');$('crewList').innerHTML=a.map(c=>`<article class="record"><h3>${esc(c.name)}</h3><p>${esc(c.rank)} â€¢ ${esc(c.nationality)}</p></article>`).join('')||'<div class="empty">No crew records.</div>'}


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
  messages: JSON.parse(localStorage.getItem('atlas_sinbad_messages') || '[]'),
  voiceEnabled: localStorage.getItem('atlas_sinbad_voice') !== 'off',
  language: localStorage.getItem('atlas_sinbad_language') || 'tr-TR'
};
let pendingSinbadWebQuestion='';
const SINBAD_WEB_SEARCH_ENABLED=false;
const SINBAD_WEB_TEXT={
 'tr-TR':{ask:'Atlas Cloud hafÄ±zamda bu soruya yetecek bilgi yok. Herkese aÃ§Ä±k web kaynaklarÄ±nda arama yapmama izin veriyor musunuz?',result:'Web arama sonucu',denied:'Web aramasÄ± yapÄ±lmadÄ±.'},
 'en-US':{ask:'My Atlas Cloud memory does not contain enough information. May I search public web sources?',result:'Web search result',denied:'The web search was not performed.'},
 'ru-RU':{ask:'Ğ’ Atlas Cloud Ğ½ĞµĞ´Ğ¾ÑÑ‚Ğ°Ñ‚Ğ¾Ñ‡Ğ½Ğ¾ Ğ¸Ğ½Ñ„Ğ¾Ñ€Ğ¼Ğ°Ñ†Ğ¸Ğ¸. Ğ Ğ°Ğ·Ñ€ĞµÑˆĞ¸Ñ‚ÑŒ Ğ¿Ğ¾Ğ¸ÑĞº Ğ² Ğ¾Ñ‚ĞºÑ€Ñ‹Ñ‚Ñ‹Ñ… Ğ¸ÑÑ‚Ğ¾Ñ‡Ğ½Ğ¸ĞºĞ°Ñ…?',result:'Ğ ĞµĞ·ÑƒĞ»ÑŒÑ‚Ğ°Ñ‚ Ğ²ĞµĞ±-Ğ¿Ğ¾Ğ¸ÑĞºĞ°',denied:'Ğ’ĞµĞ±-Ğ¿Ğ¾Ğ¸ÑĞº Ğ½Ğµ Ğ²Ñ‹Ğ¿Ğ¾Ğ»Ğ½ĞµĞ½.'},
 'fr-FR':{ask:'Atlas Cloud ne contient pas assez dâ€™informations. Autorisez-vous une recherche sur le web public ?',result:'RÃ©sultat de recherche web',denied:'La recherche web nâ€™a pas Ã©tÃ© effectuÃ©e.'},
 'de-DE':{ask:'Atlas Cloud enthÃ¤lt nicht genÃ¼gend Informationen. Darf ich im Ã¶ffentlichen Web suchen?',result:'Web-Suchergebnis',denied:'Die Websuche wurde nicht durchgefÃ¼hrt.'},
 'ar-SA':{ask:'Ù„Ø§ ØªØ­ØªÙˆÙŠ Ø°Ø§ÙƒØ±Ø© Atlas Cloud Ø¹Ù„Ù‰ Ù…Ø¹Ù„ÙˆÙ…Ø§Øª ÙƒØ§ÙÙŠØ©. Ù‡Ù„ ØªØ³Ù…Ø­ Ù„ÙŠ Ø¨Ø§Ù„Ø¨Ø­Ø« ÙÙŠ Ø§Ù„ÙˆÙŠØ¨ Ø§Ù„Ø¹Ø§Ù…ØŸ',result:'Ù†ØªÙŠØ¬Ø© Ø¨Ø­Ø« Ø§Ù„ÙˆÙŠØ¨',denied:'Ù„Ù… ÙŠØªÙ… Ø¥Ø¬Ø±Ø§Ø¡ Ø¨Ø­Ø« Ø¹Ù„Ù‰ Ø§Ù„ÙˆÙŠØ¨.'},
 'es-ES':{ask:'Atlas Cloud no contiene suficiente informaciÃ³n. Â¿Permite buscar en la web pÃºblica?',result:'Resultado de bÃºsqueda web',denied:'No se realizÃ³ la bÃºsqueda web.'},
 'it-IT':{ask:'Atlas Cloud non contiene informazioni sufficienti. Autorizza la ricerca sul web pubblico?',result:'Risultato della ricerca web',denied:'La ricerca web non Ã¨ stata eseguita.'}
};
function requestSinbadWebPermission(question){
  if(!SINBAD_WEB_SEARCH_ENABLED){
    pendingSinbadWebQuestion='';$('sinbadWebConsent')?.classList.add('hidden');
    return {'tr-TR':'Sinbad yalnÄ±zca onaylÄ± Atlas Cloud denizcilik kÃ¼tÃ¼phanesini kullanÄ±yor. Bu konu iÃ§in yeterli kaynak yok; ilgili kitabÄ± veya belgeyi kÃ¼tÃ¼phaneye yÃ¼kleyin.','en-US':'Sinbad uses only the approved Atlas Cloud marine library. There is not enough material for this topic; upload the relevant book or document.','ru-RU':'Ğ¡Ğ¸Ğ½Ğ±Ğ°Ğ´ Ğ¸ÑĞ¿Ğ¾Ğ»ÑŒĞ·ÑƒĞµÑ‚ Ñ‚Ğ¾Ğ»ÑŒĞºĞ¾ ÑƒÑ‚Ğ²ĞµÑ€Ğ¶Ğ´Ñ‘Ğ½Ğ½ÑƒÑ Ğ¼Ğ¾Ñ€ÑĞºÑƒÑ Ğ±Ğ¸Ğ±Ğ»Ğ¸Ğ¾Ñ‚ĞµĞºÑƒ Atlas Cloud. Ğ—Ğ°Ğ³Ñ€ÑƒĞ·Ğ¸Ñ‚Ğµ ÑĞ¾Ğ¾Ñ‚Ğ²ĞµÑ‚ÑÑ‚Ğ²ÑƒÑÑ‰ÑƒÑ ĞºĞ½Ğ¸Ğ³Ñƒ Ğ¸Ğ»Ğ¸ Ğ´Ğ¾ĞºÑƒĞ¼ĞµĞ½Ñ‚.','fr-FR':'Sinbad utilise uniquement la bibliothÃ¨que maritime Atlas Cloud approuvÃ©e. Chargez le livre ou document correspondant.','de-DE':'Sinbad verwendet nur die freigegebene Atlas-Cloud-Seefahrtsbibliothek. Laden Sie das passende Buch oder Dokument hoch.','ar-SA':'ÙŠØ³ØªØ®Ø¯Ù… Ø³Ù†Ø¯Ø¨Ø§Ø¯ Ù…ÙƒØªØ¨Ø© Atlas Cloud Ø§Ù„Ø¨Ø­Ø±ÙŠØ© Ø§Ù„Ù…Ø¹ØªÙ…Ø¯Ø© ÙÙ‚Ø·. Ø­Ù…Ù‘Ù„ Ø§Ù„ÙƒØªØ§Ø¨ Ø£Ùˆ Ø§Ù„ÙˆØ«ÙŠÙ‚Ø© Ø°Ø§Øª Ø§Ù„ØµÙ„Ø©.','es-ES':'Sinbad usa Ãºnicamente la biblioteca marÃ­tima aprobada de Atlas Cloud. Cargue el libro o documento correspondiente.','it-IT':'Sinbad utilizza solo la biblioteca marittima Atlas Cloud approvata. Carichi il libro o documento pertinente.'}[sinbadState.language]||'Sinbad uses only the approved Atlas Cloud marine library. Upload the relevant source.';
  }
  pendingSinbadWebQuestion=question;const copy=SINBAD_WEB_TEXT[sinbadState.language]||SINBAD_WEB_TEXT['en-US'];$('sinbadWebConsentText').textContent=copy.ask;$('sinbadWebConsent').classList.remove('hidden');return copy.ask;
}

function setSinbadVoiceUI(){
  const button=$('toggleSinbadVoice');if(!button)return;
  button.textContent=sinbadState.voiceEnabled?'ğŸ”Š Voice: On':'ğŸ”‡ Voice: Off';
  button.setAttribute('aria-pressed',String(sinbadState.voiceEnabled));
}
const SINBAD_ENGLISH_WORDS=new Set(['the','a','an','and','or','for','with','is','are','you','your','this','that','can','will','please','from','have','has','not','use','using','check','safety','route','chart','course','wind','weather','forecast','notice','mariners','waypoint','knots','bearing','captain','system','online','offline','welcome','update','report','status','warning','alert','engine','fuel','crew','port','starboard','bridge','log','logbook','signal','emergency','distress','mayday','over','out','copy','roger','standby','ahead','astern','anchor','depart','arrival','eta','etd']);
function detectRunLanguage(token,fallbackLang,currentLang){
  const hasTurkishChars=/[cgiosuCGIOSU]/.test(token);
  if(hasTurkishChars)return fallbackLang.startsWith('tr')?fallbackLang:'tr-TR';
  const cleaned=token.toLowerCase().replace(/[^a-z']/g,'');
  if(cleaned&&SINBAD_ENGLISH_WORDS.has(cleaned))return 'en-US';
  if(!/[a-zcgiosu]/i.test(token))return currentLang;
  return currentLang||fallbackLang;
}
function splitSpeechByLanguage(text,fallbackLang){
  const tokens=text.split(/(\s+)/);
  const runs=[];
  let currentLang=null,currentText='';
  for(const token of tokens){
    if(!token)continue;
    if(/^\s+$/.test(token)){currentText+=token;continue;}
    const lang=detectRunLanguage(token,fallbackLang,currentLang);
    if(currentLang===null)currentLang=lang;
    if(lang!==currentLang&&currentText.trim()){
      runs.push({lang:currentLang,text:currentText});
      currentText=token;currentLang=lang;
    }else{
      currentText+=token;
    }
  }
  if(currentText.trim())runs.push({lang:currentLang,text:currentText});
  return runs.length?runs:[{lang:fallbackLang,text}];
}
function pickVoiceForLang(voices,lang){
  const root=lang.split('-')[0];
  return voices.find(v=>v.lang.toLowerCase()===lang.toLowerCase())||voices.find(v=>v.lang.toLowerCase().startsWith(root))||voices.find(v=>/^en[-_]/i.test(v.lang))||null;
}
let sinbadVoiceAudio=null;
let sinbadVoiceObjectUrl='';
let sinbadVoiceAbort=null;
function finishSinbadVoice(){
  if(sinbadVoiceObjectUrl)URL.revokeObjectURL(sinbadVoiceObjectUrl);
  sinbadVoiceObjectUrl='';sinbadVoiceAudio=null;sinbadVoiceAbort=null;
  sinbadAwaitingAnswer=false;scheduleSinbadListening();
}
function stopSinbadVoice(){
  sinbadVoiceAbort?.abort();sinbadVoiceAbort=null;
  if(sinbadVoiceAudio){sinbadVoiceAudio.pause();sinbadVoiceAudio.src='';}
  if(sinbadVoiceObjectUrl)URL.revokeObjectURL(sinbadVoiceObjectUrl);
  sinbadVoiceObjectUrl='';sinbadVoiceAudio=null;
  window.speechSynthesis?.cancel();
}
function speakSinbadFallback(text){
  if(!sinbadState.voiceEnabled||!('speechSynthesis'in window)){sinbadAwaitingAnswer=false;scheduleSinbadListening();return;}
  const voices=speechSynthesis.getVoices();
  if(!voices.length){
    speechSynthesis.onvoiceschanged=()=>{speechSynthesis.onvoiceschanged=null;speakSinbadFallback(text);};
    return;
  }
  if(sinbadIsListening)sinbadRecognition?.stop();
  speechSynthesis.cancel();
  const cleanText=String(text).replace(/[\u2022*_#]/g,' ');
  const runs=splitSpeechByLanguage(cleanText,sinbadState.language);
  let index=0;
  const speakNext=()=>{
    if(index>=runs.length){sinbadAwaitingAnswer=false;scheduleSinbadListening();return;}
    const run=runs[index++];
    const utterance=new SpeechSynthesisUtterance(run.text);
    const voice=pickVoiceForLang(voices,run.lang);
    utterance.voice=voice;utterance.lang=voice?.lang||run.lang;utterance.rate=.96;utterance.pitch=.92;
    utterance.onend=speakNext;
    utterance.onerror=speakNext;
    speechSynthesis.speak(utterance);
  };
  speakNext();
}
async function speakSinbad(text,onVoiceReady){
  let announced=false;
  const announce=()=>{if(!announced){announced=true;onVoiceReady?.();}};
  if(!sinbadState.voiceEnabled){announce();sinbadAwaitingAnswer=false;scheduleSinbadListening();return;}
  if(sinbadIsListening)sinbadRecognition?.stop();
  stopSinbadVoice();
  const cleanText=String(text).replace(/[\u2022*_#]/g,' ').trim();
  if(!cleanText){finishSinbadVoice();return;}
  const status=$('sinbadKnowledgeStatus');
  const controller=new AbortController();sinbadVoiceAbort=controller;
  let timedOut=false;
  const timeout=setTimeout(()=>{timedOut=true;controller.abort();},120000);
  try{
    if(status)status.textContent='Sinbad ses klonu haz\u0131rlan\u0131yor\u2026';
    const response=await fetch(`${SINBAD_BRIDGE_URL}/ai/tts`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:cleanText,language:sinbadState.language}),signal:controller.signal});
    if(!response.ok)throw new Error(`XTTS returned ${response.status}`);
    const blob=await response.blob();
    if(!blob.size)throw new Error('XTTS returned empty audio');
    if(sinbadVoiceAbort!==controller)return;
    sinbadVoiceObjectUrl=URL.createObjectURL(blob);
    const audio=new Audio(sinbadVoiceObjectUrl);sinbadVoiceAudio=audio;
    audio.preservesPitch=false;
    audio.playbackRate=1.04;
    audio.volume=.92;
    audio.onended=()=>{if(sinbadVoiceAudio===audio)finishSinbadVoice();};
    audio.onerror=()=>{
      if(sinbadVoiceAudio!==audio)return;
      announce();stopSinbadVoice();
      if(status)status.textContent='XTTS klon sesi oynatılamadı · standart sese geçilmedi';
      sinbadAwaitingAnswer=false;scheduleSinbadListening();
    };
    if(status)status.textContent='Sinbad XTTS klon sesi aktif · owner-local';
    announce();
    await audio.play();
  }catch(error){
    if(sinbadVoiceAbort!==controller)return;
    if(error?.name==='AbortError'&&!timedOut)return;
    console.warn('Sinbad XTTS clone unavailable; standard voice disabled',error);
    announce();stopSinbadVoice();
    if(status)status.textContent=timedOut?'XTTS klon sesi zaman aşımına uğradı · standart sese geçilmedi':'XTTS klon sesi üretilemedi · standart sese geçilmedi';
    sinbadAwaitingAnswer=false;scheduleSinbadListening();
  }finally{clearTimeout(timeout);}
}
let sinbadRecognition=null;
let sinbadIsListening=false;
let sinbadHandsFreeEnabled=false;
let sinbadWakeActive=false;
let sinbadAwaitingAnswer=false;
let sinbadRestartTimer=null;
const SINBAD_SPEECH_TEXT={
 'tr-TR':{listen:'Dinliyorumâ€¦ KonuÅŸabilirsiniz.',ready:'ğŸ™ï¸ Sinbadâ€™a KonuÅŸ',stop:'â¹ Dinlemeyi Durdur',heard:'Sizi duydum. Sorunuz gÃ¶nderiliyorâ€¦',unsupported:'Bu tarayÄ±cÄ± sesli soru Ã¶zelliÄŸini desteklemiyor. iPhone/iPadâ€™de gÃ¼ncel Safari, Androidâ€™de gÃ¼ncel Chrome kullanÄ±n.',denied:'Mikrofon izni verilmedi. TarayÄ±cÄ± adres Ã§ubuÄŸundaki izinlerden mikrofonu aÃ§Ä±n.',test:'Ses aÃ§Ä±k Kaptan. Sizi dinlemeye hazÄ±rÄ±m.'},
 'en-US':{listen:'Listeningâ€¦ You may speak.',ready:'ğŸ™ï¸ Speak to Sinbad',stop:'â¹ Stop listening',heard:'I heard you. Sending your questionâ€¦',unsupported:'This browser does not support voice questions. Use current Safari on iPhone/iPad or current Chrome on Android.',denied:'Microphone permission was not granted. Enable it in the browser site permissions.',test:'Voice is on, Captain. I am ready to listen.'},
 'ru-RU':{listen:'Ğ¡Ğ»ÑƒÑˆĞ°Ñâ€¦ Ğ“Ğ¾Ğ²Ğ¾Ñ€Ğ¸Ñ‚Ğµ.',ready:'ğŸ™ï¸ Ğ“Ğ¾Ğ²Ğ¾Ñ€Ğ¸Ñ‚ÑŒ Ñ Ğ¡Ğ¸Ğ½Ğ±Ğ°Ğ´Ğ¾Ğ¼',stop:'â¹ ĞÑÑ‚Ğ°Ğ½Ğ¾Ğ²Ğ¸Ñ‚ÑŒ',heard:'Ğ¯ Ğ²Ğ°Ñ ÑƒÑĞ»Ñ‹ÑˆĞ°Ğ». ĞÑ‚Ğ¿Ñ€Ğ°Ğ²Ğ»ÑÑ Ğ²Ğ¾Ğ¿Ñ€Ğ¾Ñâ€¦',unsupported:'Ğ­Ñ‚Ğ¾Ñ‚ Ğ±Ñ€Ğ°ÑƒĞ·ĞµÑ€ Ğ½Ğµ Ğ¿Ğ¾Ğ´Ğ´ĞµÑ€Ğ¶Ğ¸Ğ²Ğ°ĞµÑ‚ Ğ³Ğ¾Ğ»Ğ¾ÑĞ¾Ğ²Ñ‹Ğµ Ğ²Ğ¾Ğ¿Ñ€Ğ¾ÑÑ‹.',denied:'ĞĞµÑ‚ Ñ€Ğ°Ğ·Ñ€ĞµÑˆĞµĞ½Ğ¸Ñ Ğ½Ğ° Ğ¼Ğ¸ĞºÑ€Ğ¾Ñ„Ğ¾Ğ½.',test:'Ğ“Ğ¾Ğ»Ğ¾Ñ Ğ²ĞºĞ»ÑÑ‡Ñ‘Ğ½, ĞºĞ°Ğ¿Ğ¸Ñ‚Ğ°Ğ½. Ğ¯ Ğ³Ğ¾Ñ‚Ğ¾Ğ² ÑĞ»ÑƒÑˆĞ°Ñ‚ÑŒ.'},
 'fr-FR':{listen:'Je vous Ã©couteâ€¦ Parlez.',ready:'ğŸ™ï¸ Parler Ã  Sinbad',stop:'â¹ ArrÃªter',heard:'Je vous ai entendu. Envoi de la questionâ€¦',unsupported:'Ce navigateur ne prend pas en charge les questions vocales.',denied:'Lâ€™autorisation du microphone est refusÃ©e.',test:'La voix est active, Capitaine. Je vous Ã©coute.'},
 'de-DE':{listen:'Ich hÃ¶re zuâ€¦ Sprechen Sie.',ready:'ğŸ™ï¸ Mit Sinbad sprechen',stop:'â¹ ZuhÃ¶ren beenden',heard:'Ich habe Sie gehÃ¶rt. Die Frage wird gesendetâ€¦',unsupported:'Dieser Browser unterstÃ¼tzt keine Sprachfragen.',denied:'Die Mikrofonberechtigung wurde nicht erteilt.',test:'Die Stimme ist aktiv, KapitÃ¤n. Ich hÃ¶re zu.'},
 'ar-SA':{listen:'Ø£Ù†Ø§ Ø£Ø³ØªÙ…Ø¹â€¦ ØªÙƒÙ„Ù‘Ù… Ø§Ù„Ø¢Ù†.',ready:'ğŸ™ï¸ ØªØ­Ø¯Ø« Ø¥Ù„Ù‰ Ø³Ù†Ø¯Ø¨Ø§Ø¯',stop:'â¹ Ø¥ÙŠÙ‚Ø§Ù Ø§Ù„Ø§Ø³ØªÙ…Ø§Ø¹',heard:'Ø³Ù…Ø¹ØªÙƒ. ÙŠØªÙ… Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„Ø³Ø¤Ø§Ù„â€¦',unsupported:'Ù‡Ø°Ø§ Ø§Ù„Ù…ØªØµÙØ­ Ù„Ø§ ÙŠØ¯Ø¹Ù… Ø§Ù„Ø£Ø³Ø¦Ù„Ø© Ø§Ù„ØµÙˆØªÙŠØ©.',denied:'Ù„Ù… ÙŠØªÙ… Ø§Ù„Ø³Ù…Ø§Ø­ Ø¨Ø§Ø³ØªØ®Ø¯Ø§Ù… Ø§Ù„Ù…ÙŠÙƒØ±ÙˆÙÙˆÙ†.',test:'Ø§Ù„ØµÙˆØª ÙŠØ¹Ù…Ù„ Ø£ÙŠÙ‡Ø§ Ø§Ù„Ù‚Ø¨Ø·Ø§Ù†. Ø£Ù†Ø§ Ù…Ø³ØªØ¹Ø¯ Ù„Ù„Ø§Ø³ØªÙ…Ø§Ø¹.'},
 'es-ES':{listen:'Escuchandoâ€¦ Puede hablar.',ready:'ğŸ™ï¸ Hablar con Sinbad',stop:'â¹ Dejar de escuchar',heard:'Le he oÃ­do. Enviando la preguntaâ€¦',unsupported:'Este navegador no admite preguntas de voz.',denied:'No se concediÃ³ permiso para el micrÃ³fono.',test:'La voz estÃ¡ activa, CapitÃ¡n. Estoy listo para escuchar.'},
 'it-IT':{listen:'Ti ascoltoâ€¦ Puoi parlare.',ready:'ğŸ™ï¸ Parla con Sinbad',stop:'â¹ Ferma ascolto',heard:'Ti ho sentito. Invio della domandaâ€¦',unsupported:'Questo browser non supporta le domande vocali.',denied:'Il permesso del microfono non Ã¨ stato concesso.',test:'La voce Ã¨ attiva, Capitano. Sono pronto ad ascoltare.'}
};
function speechCopy(){return SINBAD_SPEECH_TEXT[sinbadState.language]||SINBAD_SPEECH_TEXT['en-US'];}
function handsFreeMessage(){return {'tr-TR':'Eller serbest aÃ§Ä±k â€” â€œHey Sinbadâ€ deyin.','en-US':'Hands-free active â€” say â€œHey Sinbadâ€.','ru-RU':'Ğ ĞµĞ¶Ğ¸Ğ¼ Ğ±ĞµĞ· Ñ€ÑƒĞº Ğ²ĞºĞ»ÑÑ‡Ñ‘Ğ½ â€” ÑĞºĞ°Ğ¶Ğ¸Ñ‚Ğµ Â«Hey SinbadÂ».','fr-FR':'Mode mains libres actif â€” dites Â«Hey SinbadÂ».','de-DE':'Freisprechen aktiv â€” sagen Sie â€Hey Sinbadâ€œ.','ar-SA':'ÙˆØ¶Ø¹ Ø§Ù„ØªØ­Ø¯Ø« Ø§Ù„Ø­Ø± Ù†Ø´Ø· â€” Ù‚Ù„ Â«Hey SinbadÂ».','es-ES':'Modo manos libres activo â€” diga Â«Hey SinbadÂ».','it-IT':'ModalitÃ  vivavoce attiva â€” dica Â«Hey SinbadÂ».'}[sinbadState.language]||'Hands-free active â€” say â€œHey Sinbadâ€.';}
function setListeningUI(message='',visible=false){
  const button=$('startSinbadListening'),status=$('sinbadListeningStatus');if(!button||!status)return;
  button.textContent=sinbadHandsFreeEnabled?speechCopy().stop:speechCopy().ready;button.setAttribute('aria-pressed',String(sinbadHandsFreeEnabled));
  status.textContent=message||speechCopy().listen;status.classList.toggle('hidden',!visible);
}
function scheduleSinbadListening(delay=500){
  clearTimeout(sinbadRestartTimer);
  if(!sinbadHandsFreeEnabled||sinbadAwaitingAnswer||window.speechSynthesis?.speaking||(sinbadVoiceAudio&&!sinbadVoiceAudio.paused))return;
  sinbadRestartTimer=setTimeout(beginSinbadRecognition,delay);
}
function beginSinbadRecognition(){
  const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!Recognition){setListeningUI(speechCopy().unsupported,true);return;}
  if(!sinbadHandsFreeEnabled||sinbadIsListening||sinbadAwaitingAnswer)return;
  sinbadRecognition=new Recognition();sinbadRecognition.lang=sinbadState.language;sinbadRecognition.continuous=false;sinbadRecognition.interimResults=true;sinbadRecognition.maxAlternatives=1;
  let finalTranscript='';
  sinbadRecognition.onstart=()=>{sinbadIsListening=true;setListeningUI(sinbadWakeActive?speechCopy().listen:handsFreeMessage(),true);};
  sinbadRecognition.onresult=event=>{let interim='';for(let i=event.resultIndex;i<event.results.length;i++){const part=event.results[i][0].transcript;if(event.results[i].isFinal)finalTranscript+=part;else interim+=part;}$('sinbadInput').value=(finalTranscript||interim).trim();};
  sinbadRecognition.onerror=event=>{sinbadIsListening=false;if(event.error==='not-allowed'||event.error==='service-not-allowed'){sinbadHandsFreeEnabled=false;setListeningUI(speechCopy().denied,true);return;}if(!['no-speech','aborted'].includes(event.error))setListeningUI(`Microphone: ${event.error}`,true);};
  sinbadRecognition.onend=()=>{
    sinbadIsListening=false;const heard=finalTranscript.trim();
    const wakeMatch=heard.match(/(?:hey|hei|hej|ÑĞ¹|ÙŠØ§)?\s*(?:sinbad|sindbad|simbad)/iu);
    let command='';
    if(wakeMatch){sinbadWakeActive=true;command=heard.slice((wakeMatch.index||0)+wakeMatch[0].length).replace(/^[,.:;!?\s-]+/,'').trim();}
    else if(sinbadWakeActive)command=heard;
    if(command){sinbadWakeActive=false;sinbadAwaitingAnswer=true;$('sinbadInput').value=command;setListeningUI(speechCopy().heard,true);setTimeout(()=>sendToSinbad(command),250);}
    else {if(wakeMatch)setListeningUI(speechCopy().listen,true);else $('sinbadInput').value='';scheduleSinbadListening(wakeMatch?150:500);}
  };
  try{sinbadRecognition.start();}catch(error){sinbadIsListening=false;setListeningUI(error.message||String(error),true);}
}
function startSinbadListening(){
  if(sinbadHandsFreeEnabled){sinbadHandsFreeEnabled=false;sinbadWakeActive=false;clearTimeout(sinbadRestartTimer);sinbadRecognition?.abort();setListeningUI('',false);return;}
  sinbadHandsFreeEnabled=true;sinbadWakeActive=false;setListeningUI(handsFreeMessage(),true);beginSinbadRecognition();
}


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
function renderOfficialSources(){
  const box=$('officialSourceList');if(!box||typeof OFFICIAL_PUBLICATIONS==='undefined')return;
  box.innerHTML=OFFICIAL_PUBLICATIONS.map(source=>`<article class="source-card"><strong>${esc(source.title)}</strong><br><small>${esc(source.authority)} â€¢ ${esc(source.edition)} â€¢ ${esc(source.status)}</small><p>${esc(source.notes)}</p><a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">Open official source</a></article>`).join('');
}
function currentPassageInput(){
  const fleet=get('atlas_fleet'),vessel=fleet[0]||{};
  return {departure:$('passageDeparture').value,destination:$('passageDestination').value,region:$('passageRegion').value,distanceNm:$('passageDistance').value,speedKn:$('passageSpeed').value||vessel.cruise,draftM:$('passageDraft').value||vessel.draft,fuelConsumptionLph:$('passageFuelRate').value,fuelMarginPct:$('passageFuelMargin').value,departureTime:$('passageDepartureTime').value};
}
function createPassagePlanDraft(){
  if(!window.SinbadCore||typeof OFFICIAL_PUBLICATIONS==='undefined')return;
  const plan=SinbadCore.passagePlan(currentPassageInput(),OFFICIAL_PUBLICATIONS.filter(x=>x.status==='approved'));
  const text=SinbadCore.formatPlan(plan);$('passagePlanOutput').textContent=text;
  localStorage.setItem('atlas_last_passage_draft',JSON.stringify(plan));
  addSinbadMessage('sinbad',`Passage plan draft created for ${plan.title}. ${plan.sources.length} approved official source(s) cited. Captain approval and live navigation checks are still required.`);
}
async function copyPassagePlanDraft(){
  const text=$('passagePlanOutput').textContent;if(!text)return;
  await navigator.clipboard.writeText(text);$('copyPassagePlan').textContent='Copied';setTimeout(()=>$('copyPassagePlan').textContent='Copy draft',1200);
}
const SINBAD_BRIDGE_URL='http://127.0.0.1:31983';
let bridgeWaypoints=[];
function bridgeXml(value){return String(value??'').replace(/[<>&"']/g,ch=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[ch]));}
function bridgeRouteName(){
  const departure=$('passageDeparture')?.value.trim()||'Departure',destination=$('passageDestination')?.value.trim()||'Destination';
  return `${departure} to ${destination}`;
}
function renderBridgeWaypoints(){
  const box=$('bridgeWaypoints');if(!box)return;
  box.innerHTML=bridgeWaypoints.map((point,index)=>`<div class="bridge-waypoint" data-bridge-index="${index}"><span class="bridge-waypoint-index">WP${String(index+1).padStart(2,'0')}</span><input data-field="name" value="${esc(point.name)}" placeholder="Waypoint name" aria-label="Waypoint ${index+1} name"><input data-field="lat" type="number" min="-90" max="90" step="0.000001" value="${esc(point.lat)}" placeholder="Latitude" aria-label="Waypoint ${index+1} latitude"><input data-field="lon" type="number" min="-180" max="180" step="0.000001" value="${esc(point.lon)}" placeholder="Longitude" aria-label="Waypoint ${index+1} longitude"><button type="button" class="btn bridge-remove" data-remove-bridge="${index}">Remove</button></div>`).join('');
}
function addBridgeWaypoint(point={}){
  bridgeWaypoints.push({name:point.name||`WP${String(bridgeWaypoints.length+1).padStart(2,'0')}`,lat:point.lat??'',lon:point.lon??''});renderBridgeWaypoints();
}
function syncBridgeWaypoint(event){
  const row=event.target.closest('[data-bridge-index]');if(!row||!event.target.dataset.field)return;
  bridgeWaypoints[Number(row.dataset.bridgeIndex)][event.target.dataset.field]=event.target.value;
}
function validBridgeWaypoints(){
  const points=bridgeWaypoints.map((point,index)=>({name:point.name.trim()||`WP${index+1}`,lat:Number(point.lat),lon:Number(point.lon)}));
  if(points.length<2||points.some(point=>!Number.isFinite(point.lat)||!Number.isFinite(point.lon)||Math.abs(point.lat)>90||Math.abs(point.lon)>180))throw new Error('Add at least two waypoints with valid latitude and longitude.');
  return points;
}
function buildBridgeGpx(){
  const points=validBridgeWaypoints(),name=bridgeRouteName(),created=new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Sinbad Marine ECS" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">\n  <metadata><name>${bridgeXml(name)}</name><time>${created}</time><desc>Planning draft. Verify against current official charts and Notices to Mariners.</desc></metadata>\n  ${points.map(point=>`<wpt lat="${point.lat.toFixed(6)}" lon="${point.lon.toFixed(6)}"><name>${bridgeXml(point.name)}</name></wpt>`).join('\n  ')}\n  <rte><name>${bridgeXml(name)}</name><desc>Sinbad planning route â€” captain approval required.</desc>\n    ${points.map(point=>`<rtept lat="${point.lat.toFixed(6)}" lon="${point.lon.toFixed(6)}"><name>${bridgeXml(point.name)}</name></rtept>`).join('\n    ')}\n  </rte>\n</gpx>\n`;
}
function safeBridgeFilename(){return `${bridgeRouteName().replace(/[^a-z0-9_-]+/gi,'-').replace(/^-|-$/g,'')||'sinbad-route'}.gpx`;}
function downloadBridgeGpx(){
  try{const blob=new Blob([buildBridgeGpx()],{type:'application/gpx+xml'}),link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=safeBridgeFilename();link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);$('bridgeMessage').textContent='GPX downloaded. Import it in OpenCPN Route & Mark Manager.';}catch(error){$('bridgeMessage').textContent=error.message;}
}
async function sendBridgeGpx(){
  try{
    const response=await fetch(`${SINBAD_BRIDGE_URL}/routes`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({filename:safeBridgeFilename(),name:bridgeRouteName(),gpx:buildBridgeGpx()})});
    if(!response.ok)throw new Error(`Bridge returned ${response.status}`);const result=await response.json();$('bridgeMessage').textContent=`Route saved locally: ${result.path}. Import it from OpenCPN Route & Mark Manager.`;checkBridgeStatus();
  }catch(error){$('bridgeMessage').textContent='Local Bridge is not reachable. Start bridge/start-sinbad-bridge.cmd, or use Download GPX.';}
}
async function checkBridgeStatus(){
  const badge=$('bridgeStatus');if(!badge)return;
  try{const response=await fetch(`${SINBAD_BRIDGE_URL}/status`,{cache:'no-store'});if(!response.ok)throw new Error();const status=await response.json();const indexed=status.library?.chunks??status.library?.count??0;badge.textContent=`Bridge online Â· ${status.routes} route(s) Â· ${indexed} memory chunk(s)`;badge.className='bridge-status online';}
  catch(error){badge.textContent='Bridge offline';badge.className='bridge-status offline';}
}
async function sinbadBridgeJson(path,options={}){
  const response=await fetch(`${SINBAD_BRIDGE_URL}${path}`,{cache:'no-store',...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});
  if(!response.ok)throw new Error(`Bridge returned ${response.status}`);
  return response.json();
}
async function syncSinbadOfflineMemory(){
  const button=$('syncSinbadMemory'),status=$('sinbadMemoryStatus');
  if(button)button.disabled=true;if(status)status.textContent='Preparing offline memoryâ€¦';
  let documents=0,errors=0;
  try{
    await sinbadBridgeJson('/status');
    if(!cloudClient||!cloudSession?.user||!selectedWorkspaceId)throw new Error('Atlas Cloud workspace is not connected.');
    const knowledge=[];
    for(let from=0;;from+=100){
      const {data,error}=await cloudClient.from('document_knowledge').select('id,title,classification,summary,index_status').eq('workspace_id',selectedWorkspaceId).range(from,from+99);
      if(error)throw error;knowledge.push(...(data||[]));if(!data||data.length<100)break;
    }
    for(const doc of knowledge){
      try{
        const {data,error}=await cloudClient.from('document_knowledge_chunks').select('content,chunk_index').eq('knowledge_id',doc.id).order('chunk_index');
        if(error)throw error;const parts=[doc.summary,...(data||[]).map(item=>item.content)].filter(Boolean);if(!parts.length)continue;
        await sinbadBridgeJson('/library/ingest',{method:'POST',body:JSON.stringify({title:doc.title||`Atlas document ${doc.id}`,text:parts.join('\n\n'),sourceUrl:`atlas-cloud://document-knowledge/${doc.id}`,kind:doc.classification||'publication'})});documents++;
      }catch(error){console.warn('Offline memory document skipped',doc.id,error);errors++;}
      if(status)status.textContent=`Reading libraryâ€¦ ${documents}/${knowledge.length}`;
    }
    const catalogue=(typeof OFFICIAL_PUBLICATIONS==='undefined'?[]:OFFICIAL_PUBLICATIONS).map(source=>[
      `Title: ${source.title}`,`Authority: ${source.authority}`,`Edition: ${source.edition}`,`Region: ${source.region}`,`Type: ${source.type}`,`Access: ${source.access}`,`Status: ${source.status}`,`URL: ${source.url}`,`Local file: ${source.localFile||''}`,`Notes: ${source.notes||''}`
    ].join('\n')).join('\n\n---\n\n');
    if(catalogue){await sinbadBridgeJson('/library/ingest',{method:'POST',body:JSON.stringify({title:'Approved official source catalogue',text:catalogue,sourceUrl:'atlas://official-publications',kind:'official-source-catalogue'})});documents++;}
    const result=await sinbadBridgeJson('/library/reindex',{method:'POST',body:'{}'});const total=result.chunks??result.count??0;
    if(status)status.textContent=`Offline memory ready Â· ${documents} documents Â· ${total} chunks${errors?` Â· ${errors} skipped`:''}`;checkBridgeStatus();
  }catch(error){console.error(error);if(status)status.textContent=`Sync failed: ${error.message}`;}
  finally{if(button)button.disabled=false;}
}
async function importBridgeGpxFile(file){
  if(!file)return;try{
    const xml=new DOMParser().parseFromString(await file.text(),'application/xml');if(xml.querySelector('parsererror'))throw new Error('Invalid GPX file.');
    const routePoints=[...xml.getElementsByTagNameNS('*','rtept')],points=routePoints.length?routePoints:[...xml.getElementsByTagNameNS('*','wpt')];
    if(points.length<2)throw new Error('GPX route must contain at least two points.');
    bridgeWaypoints=points.map((node,index)=>({name:node.getElementsByTagNameNS('*','name')[0]?.textContent||`WP${index+1}`,lat:node.getAttribute('lat')||'',lon:node.getAttribute('lon')||''}));renderBridgeWaypoints();$('bridgeMessage').textContent=`Imported ${bridgeWaypoints.length} GPX waypoint(s).`;
  }catch(error){$('bridgeMessage').textContent=error.message;}
}
function academyTrainingQuery(query){
  return /(chart|harita|nautical|hydrograph|hidrograf|tide|gelgit|current|akÄ±ntÄ±|akinti|set\b|drift|colreg|rule of the road|seyir kural|light|shape|sound signal|enc\b|ecdis|electronic navigation|weather|hava|visibility|gÃ¶rÃ¼ÅŸ|goruÅŸ|course|bearing|kerteriz|compass|pusula|navigation|navigasyon|seyir eÄŸitim|seyir egitim)/iu.test(query);
}
function academyOfflineAnswer(query){
  if(!academyTrainingQuery(query)||!window.SinbadAcademy||!window.SINBAD_TRAINING_DATA)return null;
  return SinbadAcademy.answer(query,SINBAD_TRAINING_DATA)?.text||null;
}
function renderAcademyLesson(){
  const category=$('academyModule')?.value,lesson=window.SinbadAcademy?.lesson(category,window.SINBAD_TRAINING_DATA),output=$('academyOutput');
  if(!lesson||!output)return;
  const progress=JSON.parse(localStorage.getItem('sinbad_academy_progress')||'{}');progress[category]={openedAt:new Date().toISOString(),status:'studying'};localStorage.setItem('sinbad_academy_progress',JSON.stringify(progress));
  output.textContent=`${lesson.title}\n\nLearning objectives\n${lesson.objectives.map(x=>'â€¢ '+x).join('\n')}\n\nPractice\n${lesson.practice}\n\nOfficial offline sources\n${lesson.sources.map((x,i)=>`[S${i+1}] ${x.title} â€” ${x.authority}`).join('\n')||'No matching offline source.'}\n\nâš  Training only. Operational decisions require current official information and captain approval.`;
}
function renderAcademyQuiz(){
  const category=$('academyModule')?.value,items=window.SinbadAcademy?.quiz(category)||[],output=$('academyOutput');if(!items.length||!output)return;
  const item=items[Math.floor(Math.random()*items.length)];output.replaceChildren();
  const title=document.createElement('strong');title.textContent=item.q;output.append(title);
  const choices=document.createElement('div');choices.className='academy-choices';
  item.choices.forEach((choice,index)=>{const button=document.createElement('button');button.type='button';button.className='btn';button.textContent=choice;button.addEventListener('click',()=>{[...choices.children].forEach(x=>x.disabled=true);button.classList.add(index===item.answer?'primary':'danger');const result=document.createElement('p');result.textContent=`${index===item.answer?'âœ“ Correct':'âœ— Review'} â€” ${item.explanation} [${item.source}]`;output.append(result);if(index===item.answer){const progress=JSON.parse(localStorage.getItem('sinbad_academy_progress')||'{}');progress[category]={completedAt:new Date().toISOString(),status:'practised'};localStorage.setItem('sinbad_academy_progress',JSON.stringify(progress));}});choices.append(button);});
  output.append(choices);const source=document.createElement('small');source.className='academy-source';source.textContent=`Official source: ${item.source}`;output.append(source);
}
async function sinbadLocalAnswer(query){
  const q=query.toLowerCase();
  const language=sinbadState.language||appLanguage;
  const coreResult=await window.SinbadCore?.orchestrate?.(query,{
    history:sinbadState.messages,
    experts:{
      emergency:()=>language==='tr-TR'
        ? 'ACÄ°L DURUM: Ä°nsan komutasÄ±nÄ± ve geminin onaylÄ± acil durum prosedÃ¼rlerini derhal devreye alÄ±n. Uygunsa MAYDAY/PAN-PAN Ã§aÄŸrÄ±sÄ± yapÄ±n, mevkiyi ve tehlikenin niteliÄŸini bildirin; Sinbad yalnÄ±zca karar desteÄŸidir.'
        : 'EMERGENCY: Activate human command and the vessel approved emergency procedures immediately. When appropriate transmit MAYDAY/PAN-PAN with position and nature of distress; Sinbad is decision support only.',
      navigation:()=>window.SinbadNavigation?.answer?.(query,language)
    }
  });
  if(coreResult?.handled)return coreResult.answer;
  const greetings={'tr-TR':'Merhaba Kaptan. Sinbad aktif. Rotalar, denizcilik yayÄ±nlarÄ±, belgeler, haritalar ve tekne operasyonlarÄ± hakkÄ±nda bana soru sorabilirsiniz.','en-US':'Hello Captain. Sinbad is active. Ask me about routes, marine publications, documents, charts, or yacht operations.','ru-RU':'Ğ—Ğ´Ñ€Ğ°Ğ²ÑÑ‚Ğ²ÑƒĞ¹Ñ‚Ğµ, ĞºĞ°Ğ¿Ğ¸Ñ‚Ğ°Ğ½. Ğ¡Ğ¸Ğ½Ğ±Ğ°Ğ´ Ğ°ĞºÑ‚Ğ¸Ğ²ĞµĞ½. Ğ¡Ğ¿Ñ€Ğ¾ÑĞ¸Ñ‚Ğµ Ğ¼ĞµĞ½Ñ Ğ¾ Ğ¼Ğ°Ñ€ÑˆÑ€ÑƒÑ‚Ğ°Ñ…, Ğ¼Ğ¾Ñ€ÑĞºĞ¸Ñ… Ğ¸Ğ·Ğ´Ğ°Ğ½Ğ¸ÑÑ…, Ğ´Ğ¾ĞºÑƒĞ¼ĞµĞ½Ñ‚Ğ°Ñ…, ĞºĞ°Ñ€Ñ‚Ğ°Ñ… Ğ¸Ğ»Ğ¸ ÑĞºÑĞ¿Ğ»ÑƒĞ°Ñ‚Ğ°Ñ†Ğ¸Ğ¸ ÑÑ…Ñ‚Ñ‹.','fr-FR':'Bonjour Capitaine. Sinbad est actif. Interrogez-moi sur les routes, publications maritimes, documents, cartes ou opÃ©rations du yacht.','de-DE':'Hallo KapitÃ¤n. Sinbad ist aktiv. Fragen Sie mich zu Routen, nautischen Publikationen, Dokumenten, Karten oder Yachtbetrieb.','ar-SA':'Ù…Ø±Ø­Ø¨Ø§Ù‹ Ø£ÙŠÙ‡Ø§ Ø§Ù„Ù‚Ø¨Ø·Ø§Ù†. Ø³Ù†Ø¯Ø¨Ø§Ø¯ Ù†Ø´Ø·. Ø§Ø³Ø£Ù„Ù†ÙŠ Ø¹Ù† Ø§Ù„Ù…Ø³Ø§Ø±Ø§Øª Ø£Ùˆ Ø§Ù„Ù…Ù†Ø´ÙˆØ±Ø§Øª Ø§Ù„Ø¨Ø­Ø±ÙŠØ© Ø£Ùˆ Ø§Ù„ÙˆØ«Ø§Ø¦Ù‚ Ø£Ùˆ Ø§Ù„Ø®Ø±Ø§Ø¦Ø· Ø£Ùˆ Ø¹Ù…Ù„ÙŠØ§Øª Ø§Ù„ÙŠØ®Øª.','es-ES':'Hola CapitÃ¡n. Sinbad estÃ¡ activo. PregÃºnteme sobre rutas, publicaciones marÃ­timas, documentos, cartas u operaciones del yate.','it-IT':'Salve Capitano. Sinbad Ã¨ attivo. Mi chieda informazioni su rotte, pubblicazioni nautiche, documenti, carte o operazioni dello yacht.'};
  if(/^(slm|selam|merhaba|hello|hi|hey|Ğ¿Ñ€Ğ¸Ğ²ĞµÑ‚|Ğ·Ğ´Ñ€Ğ°Ğ²|bonjour|salut|hallo|guten|Ù…Ø±Ø­Ø¨Ø§|Ø§Ù„Ø³Ù„Ø§Ù…|hola|buen|ciao|salve)[!. ]*$/iu.test(q))return greetings[language]||greetings['en-US'];
  // At sea, avoid waiting for an unreachable cloud request. When the browser
  // reports that it is offline, ask the local Ollama brain first.
  const offlineFirst=navigator.onLine===false;
  if(offlineFirst){
    const offlineFirstAnswer=await sinbadOfflineAiAnswer(query);
    if(offlineFirstAnswer)return offlineFirstAnswer;
  }
  const cloudAnswer=await sinbadCloudKnowledgeAnswer(query);
  if(cloudAnswer)return cloudAnswer;
  if(!offlineFirst){
    const localAiAnswer=await sinbadOfflineAiAnswer(query);
    if(localAiAnswer)return localAiAnswer;
  }
  const offlineTrainingAnswer=academyOfflineAnswer(query);
  if(offlineTrainingAnswer)return offlineTrainingAnswer;
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
      if(days<=90) alerts.push(`${c.name || 'Crew member'} â€” ${type}: ${days<0?'expired '+Math.abs(days)+' days ago':days+' days remaining'}`);
    }));
    return alerts.length ? `I found these crew alerts:\n\n${alerts.join('\n')}` : 'I found no crew items expiring within 90 days.';
  }


  if(q.includes('chart')){
    const charts=files.filter(x=>x.folder==='Nautical Charts');
    return charts.length ? `You currently have ${charts.length} nautical chart file(s):\n\n${charts.slice(0,10).map(x=>'â€¢ '+x.name).join('\n')}` : 'No nautical charts are stored on this device yet.';
  }


  if(q.includes('publication') || q.includes('solas') || q.includes('marpol')){
    const pubs=files.filter(x=>x.folder==='Nautical Publications' || `${x.name} ${x.tags}`.toLowerCase().includes(q));
    return pubs.length ? `I found ${pubs.length} relevant publication file(s):\n\n${pubs.slice(0,10).map(x=>'â€¢ '+x.name).join('\n')}` : 'I could not find a matching nautical publication in the local library. Upload it to Nautical Publications and add descriptive tags.';
  }


  if(q.includes('fleet') || q.includes('vessel')){
    return fleet.length ? `Fleet records:\n\n${fleet.map(v=>`â€¢ ${v.name || 'Unnamed vessel'} â€” ${v.type || 'type not entered'}, draft ${v.draft || 'â€”'} m`).join('\n')}` : 'No vessel has been added to Fleet Manager yet.';
  }


  if(fileMatches.length || pilotMatches.length || routeMatches.length){
    const parts=[];
    if(fileMatches.length)parts.push('Files:\n'+fileMatches.map(x=>'â€¢ '+x.name+' ['+x.folder+']').join('\n'));
    if(pilotMatches.length)parts.push('Pilot Library:\n'+pilotMatches.map(x=>'â€¢ '+x.name+' â€” '+x.country).join('\n'));
    if(routeMatches.length)parts.push('Routes:\n'+routeMatches.map(x=>'â€¢ '+x.title).join('\n'));
    return `I found the following Atlas Marine records:\n\n${parts.join('\n\n')}`;
  }


  if(q.includes('passage') || q.includes('checklist')){
    return 'Passage planning checklist:\n\nâ€¢ Confirm vessel particulars and draft\nâ€¢ Review official charts and notices\nâ€¢ Verify weather and sea state\nâ€¢ Calculate distance, ETA and fuel reserve\nâ€¢ Confirm ports of refuge and alternates\nâ€¢ Check customs, immigration and pilotage\nâ€¢ Complete bridge team briefing\nâ€¢ Save the approved passage in Route Library';
  }


  const noMatch={'tr-TR':'Atlas Marine verilerinde gÃ¼Ã§lÃ¼ bir eÅŸleÅŸme bulamadÄ±m. Ä°lgili kitabÄ± veya belgeyi Atlas Cloud kitaplÄ±ÄŸÄ±na yÃ¼kleyin ya da sorunuzu daha ayrÄ±ntÄ±lÄ± yazÄ±n.','en-US':'I did not find a strong match in Atlas Marine data. Upload the relevant book or document to the Atlas Cloud library, or ask a more specific question.','ru-RU':'Ğ¯ Ğ½Ğµ Ğ½Ğ°ÑˆÑ‘Ğ» Ñ‚Ğ¾Ñ‡Ğ½Ğ¾Ğ³Ğ¾ ÑĞ¾Ğ²Ğ¿Ğ°Ğ´ĞµĞ½Ğ¸Ñ Ğ² Ğ´Ğ°Ğ½Ğ½Ñ‹Ñ… Atlas Marine. Ğ—Ğ°Ğ³Ñ€ÑƒĞ·Ğ¸Ñ‚Ğµ Ğ½ÑƒĞ¶Ğ½ÑƒÑ ĞºĞ½Ğ¸Ğ³Ñƒ Ğ¸Ğ»Ğ¸ Ğ´Ğ¾ĞºÑƒĞ¼ĞµĞ½Ñ‚ Ğ² Atlas Cloud Ğ»Ğ¸Ğ±Ğ¾ ÑƒÑ‚Ğ¾Ñ‡Ğ½Ğ¸Ñ‚Ğµ Ğ²Ğ¾Ğ¿Ñ€Ğ¾Ñ.','fr-FR':'Je nâ€™ai pas trouvÃ© de correspondance prÃ©cise dans Atlas Marine. Chargez le livre ou document dans Atlas Cloud ou prÃ©cisez votre question.','de-DE':'Ich habe keine eindeutige Ãœbereinstimmung gefunden. Laden Sie das Buch oder Dokument in Atlas Cloud hoch oder stellen Sie eine genauere Frage.','ar-SA':'Ù„Ù… Ø£Ø¬Ø¯ ØªØ·Ø§Ø¨Ù‚Ø§Ù‹ ÙˆØ§Ø¶Ø­Ø§Ù‹ ÙÙŠ Ø¨ÙŠØ§Ù†Ø§Øª Atlas Marine. Ø­Ù…Ù‘Ù„ Ø§Ù„ÙƒØªØ§Ø¨ Ø£Ùˆ Ø§Ù„ÙˆØ«ÙŠÙ‚Ø© Ø¥Ù„Ù‰ Ù…ÙƒØªØ¨Ø© Atlas Cloud Ø£Ùˆ Ø§Ø·Ø±Ø­ Ø³Ø¤Ø§Ù„Ø§Ù‹ Ø£ÙƒØ«Ø± ØªØ­Ø¯ÙŠØ¯Ø§Ù‹.','es-ES':'No encontrÃ© una coincidencia clara en Atlas Marine. Cargue el libro o documento en Atlas Cloud o formule una pregunta mÃ¡s especÃ­fica.','it-IT':'Non ho trovato una corrispondenza chiara in Atlas Marine. Carichi il libro o documento in Atlas Cloud oppure formuli una domanda piÃ¹ specifica.'};
  return noMatch[language]||noMatch['en-US'];
}
async function sinbadOfflineAiAnswer(question){
  const status=$('sinbadKnowledgeStatus');
  try{
    if(status)status.textContent='Connecting to Sinbad offline brainâ€¦';
    const history=sinbadState.messages.slice(-12,-1).map(message=>({role:message.role==='sinbad'?'assistant':'user',content:message.text}));
    const coreEnvelope=window.SinbadCore?.aiEnvelope?.(question,history);
    const response=await fetch(`${SINBAD_BRIDGE_URL}/ai/chat`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question,language:sinbadState.language||appLanguage,history,coreEnvelope})});
    if(!response.ok)throw new Error(`Offline brain returned ${response.status}`);
    const data=await response.json();
    if(!data?.answer)return null;
    if(status)status.textContent=`Sinbad offline AI active Â· ${data.model||'local model'}`;
    return data.answer;
  }catch(error){
    console.warn('Sinbad offline AI unavailable',error);
    if(status)status.textContent='Offline AI is not installed or Bridge is closed';
    return null;
  }
}
async function sendToSinbad(text){
  const q=(text||'').trim(); if(!q)return;
  if(pendingSinbadWebQuestion&&/^(izin ver|evet|ara|webde ara|allow|yes|search|Ñ€Ğ°Ğ·Ñ€ĞµÑˆĞ°Ñ|Ğ´Ğ°|autoriser|oui|erlauben|ja|Ø§Ø³Ù…Ø­|Ù†Ø¹Ù…|permitir|sÃ­|consenti|sÃ¬)[.! ]*$/iu.test(q)){
    addSinbadMessage('user',q);$('sinbadInput').value='';await performSinbadWebSearch();return;
  }
  if(pendingSinbadWebQuestion&&/^(izin verme|hayÄ±r|arama|no|do not search|Ğ½ĞµÑ‚|non|nein|Ù„Ø§|hayÄ±r|no buscar|non cercare)[.! ]*$/iu.test(q)){
    pendingSinbadWebQuestion='';$('sinbadWebConsent').classList.add('hidden');const copy=SINBAD_WEB_TEXT[sinbadState.language]||SINBAD_WEB_TEXT['en-US'];addSinbadMessage('user',q);addSinbadMessage('sinbad',copy.denied);sinbadAwaitingAnswer=false;speakSinbad(copy.denied);return;
  }
  addSinbadMessage('user',q);
  $('sinbadInput').value='';
  $('sinbadThinking').classList.remove('hidden');
  setTimeout(async()=>{
    const answer=await sinbadLocalAnswer(q);
    $('sinbadThinking').classList.add('hidden');
    addSinbadMessage('sinbad',answer);
    speakSinbad(answer);
  },650);
}
$('sendSinbad').addEventListener('click',()=>{window.speechSynthesis?.resume();sendToSinbad($('sinbadInput').value);});
$('sinbadInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendToSinbad($('sinbadInput').value)}});
document.querySelectorAll('.sinbad-prompt').forEach(b=>b.addEventListener('click',()=>sendToSinbad(b.textContent)));
$('sinbadFloat').addEventListener('click',()=>openWorkspace('sinbad'));
$('toggleSinbadVoice')?.addEventListener('click',()=>{sinbadState.voiceEnabled=!sinbadState.voiceEnabled;localStorage.setItem('atlas_sinbad_voice',sinbadState.voiceEnabled?'on':'off');setSinbadVoiceUI();if(!sinbadState.voiceEnabled)stopSinbadVoice();});
$('stopSinbadVoice')?.addEventListener('click',stopSinbadVoice);
$('startSinbadListening')?.addEventListener('click',startSinbadListening);
$('testSinbadVoice')?.addEventListener('click',()=>{sinbadState.voiceEnabled=true;localStorage.setItem('atlas_sinbad_voice','on');setSinbadVoiceUI();speakSinbad(speechCopy().test);});
$('sinbadLanguage').value=sinbadState.language;
$('sinbadLanguage')?.addEventListener('change',e=>{sinbadState.language=e.target.value;localStorage.setItem('atlas_sinbad_language',e.target.value);stopSinbadVoice();if(sinbadIsListening)sinbadRecognition?.stop();setListeningUI();});
$('allowSinbadWebSearch')?.addEventListener('click',performSinbadWebSearch);
$('denySinbadWebSearch')?.addEventListener('click',()=>{pendingSinbadWebQuestion='';$('sinbadWebConsent').classList.add('hidden');const copy=SINBAD_WEB_TEXT[sinbadState.language]||SINBAD_WEB_TEXT['en-US'];addSinbadMessage('sinbad',copy.denied);});
$('createPassagePlan')?.addEventListener('click',createPassagePlanDraft);
$('copyPassagePlan')?.addEventListener('click',copyPassagePlanDraft);
$('addBridgeWaypoint')?.addEventListener('click',()=>addBridgeWaypoint());
$('bridgeWaypoints')?.addEventListener('input',syncBridgeWaypoint);
$('bridgeWaypoints')?.addEventListener('click',event=>{const button=event.target.closest('[data-remove-bridge]');if(button){bridgeWaypoints.splice(Number(button.dataset.removeBridge),1);renderBridgeWaypoints();}});
$('downloadBridgeGpx')?.addEventListener('click',downloadBridgeGpx);
$('sendBridgeGpx')?.addEventListener('click',sendBridgeGpx);
$('importBridgeGpx')?.addEventListener('click',()=>$('bridgeGpxFile')?.click());
$('bridgeGpxFile')?.addEventListener('change',event=>importBridgeGpxFile(event.target.files?.[0]));
$('syncSinbadMemory')?.addEventListener('click',syncSinbadOfflineMemory);
addBridgeWaypoint({name:'Departure'});addBridgeWaypoint({name:'Destination'});checkBridgeStatus();setInterval(checkBridgeStatus,30000);
$('startAcademyLesson')?.addEventListener('click',renderAcademyLesson);
$('startAcademyQuiz')?.addEventListener('click',renderAcademyQuiz);
renderOfficialSources();
setSinbadVoiceUI();
setListeningUI();


const originalRenderAll = renderAll;
renderAll = async function(){
  await originalRenderAll();
  renderSinbadMessages();
};






// ============================================================
// ATLAS MARINE OS v7.0 â€” CLOUD-FIRST EXPERIENCE
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
    ? `${cloudSession.user.email} â€¢ Workspace ready`
    : connected
      ? (signedIn?'Select your Atlas workspace.':'Sign in to continue.')
      : 'Open Cloud Setup & Security to connect this device.';
  if(guard){
    guard.textContent=ready?'âœ“ Atlas Cloud ready. Files will be stored privately in your selected workspace.':'Connect, sign in and select a workspace before uploading files.';
    guard.classList.toggle('ready',ready);
  }
}
async function refreshCloudSummary(){
  if(!cloudClient||!cloudSession?.user||!selectedWorkspaceId){
    ['sumFiles','sumPubs','sumCharts','sumStorage'].forEach(id=>{if($(id))$(id).textContent='â€”'});
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
let currentWorkspaceRole = '';
if(selectedWorkspaceId)localStorage.setItem('atlas_selected_workspace',selectedWorkspaceId);
let authSubscription = null;
let pendingInviteSetup =
  /(?:[?#&])type=invite(?:&|$)/i.test(location.href) ||
  /(?:[?&])invite=(?:1|true)(?:&|$)/i.test(location.search) ||
  sessionStorage.getItem('sinbad_pending_invite_setup') === '1';
if(pendingInviteSetup)sessionStorage.setItem('sinbad_pending_invite_setup','1');

function setAuthMessage(message='',type=''){
  const el=$('authMessage');
  if(!el)return;
  el.textContent=message;
  el.className=`auth-message ${type}`.trim();
}
const passwordPolicy={
  length:value=>value.length>=12,
  uppercase:value=>/[A-Z]/.test(value),
  lowercase:value=>/[a-z]/.test(value),
  number:value=>/\d/.test(value),
  special:value=>/[!@#$%&*?]/.test(value),
  spaces:value=>!/\s/.test(value)
};
function passwordPolicyStatus(value=''){
  const password=String(value).normalize('NFKC');
  const checks=Object.fromEntries(Object.entries(passwordPolicy).map(([name,test])=>[name,test(password)]));
  return {password,checks,valid:Object.values(checks).every(Boolean)};
}
function passwordPolicyMessage(){
  return 'Password must contain at least 12 characters, an uppercase letter, a lowercase letter, a number and one of ! @ # $ % & * ?, with no spaces.';
}
function updatePasswordRules(inputId){
  const input=$(inputId);
  const list=document.querySelector(`[data-password-rules="${inputId}"]`);
  const status=passwordPolicyStatus(input?.value||'');
  if(list)Object.entries(status.checks).forEach(([rule,valid])=>list.querySelector(`[data-rule="${rule}"]`)?.classList.toggle('valid',valid));
  return status;
}
function updatePasswordMatch(passwordId,confirmId,messageId){
  const password=$(passwordId)?.value||'';
  const confirm=$(confirmId)?.value||'';
  const message=$(messageId);
  if(!message)return false;
  message.className='password-match';
  if(!confirm){message.textContent='';return false;}
  const matches=password===confirm;
  message.textContent=matches?'Passwords match.':'Passwords do not match.';
  message.classList.add(matches?'valid':'invalid');
  return matches;
}
function updateRegistrationPasswordState(){
  const valid=updatePasswordRules('registrationPassword').valid;
  const matches=updatePasswordMatch('registrationPassword','registrationPasswordConfirm','registrationPasswordMatch');
  $('createAccount').disabled=!(valid&&matches);
}
function friendlyAuthError(error,fallback='The request could not be completed. Please try again.'){
  const message=String(error?.message||error||'');
  if(/string did not match|expected pattern|pattern/i.test(message))return 'The account request could not be prepared by this browser. Close the Outlook browser, open the site directly in Safari or Chrome, and try again.';
  if(error?.code==='weak_password' || /weak password/i.test(message)){
    const reasons=Array.isArray(error?.reasons)&&error.reasons.length
      ? ` (${error.reasons.join(', ')})`
      : '';
    return `Supabase rejected this password as weak${reasons}. Use a new, unique password with at least 12 characters.`;
  }
  if(/same password|different from the old|new password should be different/i.test(message))return 'The new password must be different from the previous password.';
  if(/session|jwt|token|expired/i.test(message))return 'Your invitation session has expired. Open the newest invitation email and try again.';
  if(/already registered|already exists/i.test(message))return 'An account already exists for this email address. Sign in or use password recovery.';
  if(/invalid email/i.test(message))return 'Enter a valid email address.';
  return message||fallback;
}
function setupPasswordControls(){
  document.querySelectorAll('[data-password-toggle]').forEach(button=>button.addEventListener('click',()=>{
    const input=$(button.dataset.passwordToggle);
    if(!input)return;
    const show=input.type==='password';
    input.type=show?'text':'password';
    button.textContent=show?'Hide':'Show';
    button.setAttribute('aria-label',show?'Hide password':'Show password');
    button.setAttribute('aria-pressed',String(show));
    input.focus({preventScroll:true});
  }));
  ['registrationPassword','registrationPasswordConfirm'].forEach(id=>$(id)?.addEventListener('input',updateRegistrationPasswordState));
  $('invitePassword')?.addEventListener('input',()=>{updatePasswordRules('invitePassword');updatePasswordMatch('invitePassword','invitePasswordConfirm','invitePasswordMatch');});
  $('invitePasswordConfirm')?.addEventListener('input',()=>updatePasswordMatch('invitePassword','invitePasswordConfirm','invitePasswordMatch'));
  $('recoveryNewPassword')?.addEventListener('input',()=>updatePasswordRules('recoveryNewPassword'));
  $('recoveryConfirmPassword')?.addEventListener('input',()=>updatePasswordMatch('recoveryNewPassword','recoveryConfirmPassword','recoveryPasswordMatch'));
  updateRegistrationPasswordState();
  updatePasswordRules('invitePassword');
  updatePasswordRules('recoveryNewPassword');
}
function setAppAccess(){
  const signedIn=Boolean(cloudSession?.user) && !needsInviteSetup(cloudSession.user);
  document.body.classList.remove('auth-pending','signed-out','authenticated');
  document.body.classList.add(signedIn?'authenticated':'signed-out');
  if(signedIn && $('authDialog')?.open)$('authDialog').close();
}
function needsInviteSetup(user=cloudSession?.user){
  return Boolean(
    user &&
    (pendingInviteSetup || (user.invited_at && user.user_metadata?.sinbad_account_ready !== true))
  );
}
function showAuthPanel(panel='signin'){
  const panels={
    signin:$('signInPanel'),
    registration:$('registrationPanel'),
    invite:$('inviteSetupPanel'),
    recovery:$('recoveryPanel')
  };
  Object.entries(panels).forEach(([name,element])=>{if(element)element.hidden=name!==panel;});
  const copy={
    signin:['Member Sign In','Sign in to open your authorized Sinbad Marine workspace.'],
    registration:['Create Sinbad Marine Account','Register with your email address. Private workspace access still requires an invitation or Captain Varol Ã‡olakâ€™s approval.'],
    invite:['Complete Your Invitation','Your invitation is verified. Set your password to enter the workspace assigned to you.'],
    recovery:['Recover Member Access','Request the 8-digit code sent by Sinbad Marine, then choose a new password.']
  }[panel];
  $('authTitle').textContent=copy[0];
  $('authHelp').textContent=copy[1];
  setAuthMessage();
}
function showRecoveryPanel(show=true){showAuthPanel(show?'recovery':'signin');}
function openAuthDialog(panel='signin'){
  showAuthPanel(panel);
  if(!$('authDialog').open)$('authDialog').showModal();
}


function cloudEsc(value=''){
  return String(value).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}
function getCloudConfig(){
  // These are browser-safe public project coordinates, never secret keys.
  // Defaults keep every authorized device connected to the same login system.
  const defaultUrl='https://kcvyftrvteqmabvxfebu.supabase.co';
  const obsoleteUrl='https://kcvyftrvtegmabvxfebu.supabase.co';
  const defaultKey='sb_publishable_ZBHFlbhQAnhUAOyVg20Szw_nW0QDj_l';
  let url=localStorage.getItem('atlas_supabase_url') || defaultUrl;
  let key=localStorage.getItem('atlas_supabase_publishable_key') || defaultKey;
  // Correct the one-letter URL typo saved by earlier releases.
  if(url===obsoleteUrl){
    url=defaultUrl;
    localStorage.setItem('atlas_supabase_url',defaultUrl);
  }
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
    const {data}=cloudClient.auth.onAuthStateChange(async(event,session)=>{
      cloudSession=session;
      updateCloudStatus();
      setAppAccess();
      if(session?.user){
        if(needsInviteSetup(session.user)){
          pendingInviteSetup=true;
          sessionStorage.setItem('sinbad_pending_invite_setup','1');
          setTimeout(()=>openAuthDialog('invite'),0);
        }else{
          await loadWorkspaces();
        }
      }
    });
    authSubscription=data.subscription;
    updateCloudStatus(); return cloudClient;
  }catch(error){
    cloudClient=null; updateCloudStatus(error.message); return null;
  }
}
async function diagnosePublicCloudConnection(){
  const output=$('publicCloudDiagnostic');
  const {url,key}=getCloudConfig();
  output.textContent='Checking the secure Atlas Cloud connectionâ€¦';
  output.className='auth-message';
  if(!url || !key){
    output.textContent='Cloud configuration is missing.';
    output.className='auth-message error';
    return false;
  }
  try{
    const response=await fetch(`${url}/auth/v1/settings`,{
      method:'GET',
      headers:{apikey:key,Authorization:`Bearer ${key}`},
      cache:'no-store'
    });
    const raw=await response.text();
    let detail='';
    try{detail=JSON.parse(raw)?.message||'';}catch(_error){}
    if(!response.ok)throw new Error(detail||`Supabase returned HTTP ${response.status}.`);
    output.textContent='Atlas Cloud is reachable and ready. You may sign in.';
    output.className='auth-message success';
    return true;
  }catch(error){
    output.textContent=`Atlas Cloud check failed: ${error?.message||'Network request failed.'}`;
    output.className='auth-message error';
    return false;
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
  $('cloudUserInfo').textContent=cloudSession?.user ? `Signed in as ${cloudSession.user.email} â€¢ User ID: ${cloudSession.user.id}` : 'No active cloud session.';
  setSetupProgress();
}
async function restoreCloudSession(){
  if(!cloudClient){setAppAccess();return;}
  const {data,error}=await cloudClient.auth.getSession();
  if(error)setAuthMessage(error.message,'error');
  cloudSession=data.session; updateCloudStatus(); setAppAccess();
  if(cloudSession?.user){
    if(needsInviteSetup(cloudSession.user))openAuthDialog('invite');
    else await loadWorkspaces();
  }
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
  $('cloudConnectionStatus').textContent=error ? 'Connected â€¢ login required' : 'Connected';
  alert(error ? `Supabase reached. ${error.message}` : 'Atlas Cloud connection successful.');
}
async function cloudSignIn(){
  if(!cloudClient){alert('Configure Atlas Cloud first.');return;}
  const {data,error}=await cloudClient.auth.signInWithPassword({email:$('cloudEmail').value.trim(),password:$('cloudPassword').value});
  if(error){alert(error.message);return;}
  cloudSession=data.session;
  updateCloudStatus();
  setAppAccess();
  if(needsInviteSetup(cloudSession?.user)){openAuthDialog('invite');return;}
  await loadWorkspaces();
  alert('Welcome aboard.');
}
async function cloudSignOut(){
  if(cloudClient)await cloudClient.auth.signOut({scope:'local'});
  cloudSession=null; selectedWorkspaceId=''; localStorage.removeItem('atlas_selected_workspace');
  updateCloudStatus(); setAppAccess(); $('workspaceSelect').innerHTML='<option value="">Select workspace</option>';
}

async function gatewaySignIn(){
  setAuthMessage('Signing inâ€¦');
  if(!cloudClient){setAuthMessage('Atlas Cloud connection is not ready. Open Cloud Setup & Security and save the Project URL again.','error');return;}
  const email=$('gatewayEmail').value.trim();
  const password=$('gatewayPassword').value;
  try{
    const {data,error}=await cloudClient.auth.signInWithPassword({email,password});
    if(error){
      const hint=/invalid login credentials/i.test(error.message||'')?'Email or password is incorrect. Use the same email shown when the password was created, or choose â€œI forgot my passwordâ€.':friendlyAuthError(error);
      setAuthMessage(hint,'error');return;
    }
    cloudSession=data.session;
    localStorage.setItem('sinbad_last_login_email',cloudSession?.user?.email||email);
    updateCloudStatus();
    setAppAccess();
    if(needsInviteSetup(cloudSession?.user)){openAuthDialog('invite');return;}
    await loadWorkspaces();
  }catch(error){
    const message=/Unexpected token|valid JSON|Failed to fetch|NetworkError/i.test(String(error?.message||error))
      ? 'Atlas Cloud could not be reached. Close this window and use â€œCheck Cloud Connectionâ€ to see the exact connection result.'
      : (error?.message||'Sign in failed. Please try again.');
    setAuthMessage(message,'error');
  }
}
async function createAccount(){
  if(!cloudClient){setAuthMessage('Atlas Cloud connection is not configured.','error');return;}
  const name=$('registrationName').value.trim();
  const email=$('registrationEmail').value.trim();
  const password=$('registrationPassword').value;
  const confirmPassword=$('registrationPasswordConfirm').value;
  if(!name){setAuthMessage('Enter your full name.','error');return;}
  if(!email){setAuthMessage('Enter your email address.','error');return;}
  if(!passwordPolicyStatus(password).valid){setAuthMessage(passwordPolicyMessage(),'error');return;}
  if(password!==confirmPassword){setAuthMessage('Passwords do not match.','error');return;}
  setAuthMessage('Creating your accountâ€¦');
  // Use the Site URL configured in Supabase. A per-request redirect URL can
  // trigger a DOM pattern error in some Outlook/iOS embedded browsers.
  const {data,error}=await cloudClient.auth.signUp({
    email,
    password,
    options:{data:{display_name:name,sinbad_account_ready:true}}
  });
  if(error){setAuthMessage(friendlyAuthError(error),'error');return;}
  if(data.session){
    cloudSession=data.session;
    setAppAccess();
    await loadWorkspaces();
    setAuthMessage('Account created. Workspace access will appear after authorization.','success');
  }else{
    showAuthPanel('signin');
    $('gatewayEmail').value=email;
    setAuthMessage('Account created. Confirm your email, then sign in. Private workspace access requires approval.','success');
  }
}
async function completeInviteAccount(){
  try{
    if(!cloudClient){
      setAuthMessage('Atlas Cloud connection is not configured.','error');
      return;
    }
    const name=String($('inviteDisplayName').value||'').trim();
    const password=String($('invitePassword').value||'').normalize('NFKC');
    const confirmPassword=String($('invitePasswordConfirm').value||'').normalize('NFKC');
    if(!name){setAuthMessage('Enter your full name.','error');return;}
    if(!passwordPolicyStatus(password).valid){setAuthMessage(passwordPolicyMessage(),'error');return;}
    if(password!==confirmPassword){setAuthMessage('Passwords do not match.','error');return;}

    setAuthMessage('Checking your invitation sessionâ€¦');
    const {data:sessionData,error:sessionError}=await cloudClient.auth.getSession();
    if(sessionError)throw sessionError;
    const activeSession=sessionData?.session||cloudSession;
    if(!activeSession?.user){
      setAuthMessage('The invitation link is missing or expired. Open the newest invitation email and try again.','error');
      return;
    }
    cloudSession=activeSession;

    // Password and profile metadata are updated separately. Some browsers
    // reject the combined invitation payload with a DOM pattern error.
    setAuthMessage('Creating your secure passwordâ€¦');
    const {data:passwordData,error:passwordError}=await cloudClient.auth.updateUser({password});
    if(passwordError)throw passwordError;

    setAuthMessage('Saving your captain profileâ€¦');
    const {data:profileData,error:profileError}=await cloudClient.auth.updateUser({
      data:{display_name:name,sinbad_account_ready:true}
    });
    const finalUser=profileData?.user||passwordData?.user||activeSession.user;
    const completedEmail=finalUser?.email||activeSession.user?.email||'';
    cloudSession={...activeSession,user:finalUser};
    pendingInviteSetup=false;
    sessionStorage.removeItem('sinbad_pending_invite_setup');
    setAuthMessage('Account completed. Opening secure sign inÃ¢â‚¬Â¦','success');

    // Re-authenticate with the newly assigned password before completing the
    // invitation. This proves that the password is permanent, not session-only.
    const {error:signOutError}=await cloudClient.auth.signOut({scope:'local'});
    if(signOutError)throw signOutError;
    const {data:verifiedLogin,error:verifiedLoginError}=await cloudClient.auth.signInWithPassword({email:completedEmail,password});
    if(verifiedLoginError)throw new Error(`Password verification failed: ${verifiedLoginError.message}`);
    cloudSession=verifiedLogin.session;
    localStorage.setItem('sinbad_last_login_email',completedEmail);
    $('invitePassword').value='';
    $('invitePasswordConfirm').value='';
    $('gatewayEmail').value=completedEmail;
    $('gatewayPassword').value='';
    setAppAccess();
    await loadWorkspaces();
    if($('authDialog')?.open)$('authDialog').close();
    if(profileError)console.warn('Password verified, but profile metadata needs a later retry.',profileError);
  }catch(error){
    console.error('Invitation setup failed',error);
    const message=error?.message||String(error||'Unknown invitation error');
    setAuthMessage(`Account setup could not be completed: ${friendlyAuthError(message)}`,'error');
  }
}
async function requestRecoveryCode(){
  if(!cloudClient){setAuthMessage('Atlas Cloud connection is not configured.','error');return;}
  const email=$('recoveryEmail').value.trim();
  if(!email){setAuthMessage('Enter your email address.','error');return;}
  setAuthMessage('Sending recovery codeâ€¦');
  const redirectTo=`${location.origin}${location.pathname}`;
  const {error}=await cloudClient.auth.resetPasswordForEmail(email,{redirectTo});
  if(error){setAuthMessage(error.message,'error');return;}
  setAuthMessage('Recovery request accepted. Check Inbox, Spam and Promotions.','success');
}
async function completeRecovery(){
  if(!cloudClient){setAuthMessage('Atlas Cloud connection is not configured.','error');return;}
  const email=$('recoveryEmail').value.trim();
  const token=$('recoveryCode').value.trim().replace(/[\s-]/g,'');
  const password=String($('recoveryNewPassword').value||'').normalize('NFKC');
  const confirmation=String($('recoveryConfirmPassword').value||'').normalize('NFKC');
  if(!email){setAuthMessage('Enter the email address that received the code.','error');return;}
  if(token.length<6||token.length>10){setAuthMessage('Enter the newest recovery code exactly as shown in the email.','error');return;}
  if(!passwordPolicyStatus(password).valid){setAuthMessage(passwordPolicyMessage(),'error');return;}
  if(password!==confirmation){setAuthMessage('Passwords do not match.','error');return;}
  setAuthMessage('Verifying codeâ€¦');
  const {error:verifyError}=await cloudClient.auth.verifyOtp({email,token,type:'recovery'});
  if(verifyError){setAuthMessage(`Code verification failed: ${friendlyAuthError(verifyError)}`,'error');return;}
  const {error:updateError}=await cloudClient.auth.updateUser({password,data:{sinbad_account_ready:true}});
  if(updateError){setAuthMessage(updateError.message,'error');return;}
  await cloudClient.auth.signOut({scope:'local'});
  const {data:verified,error:loginError}=await cloudClient.auth.signInWithPassword({email,password});
  if(loginError){setAuthMessage(`Password was saved but verification failed: ${friendlyAuthError(loginError)}`,'error');return;}
  pendingInviteSetup=false;
  sessionStorage.removeItem('sinbad_pending_invite_setup');
  cloudSession=verified.session;localStorage.setItem('sinbad_last_login_email',email);setAppAccess();await loadWorkspaces();
  $('recoveryCode').value='';$('recoveryNewPassword').value='';$('recoveryConfirmPassword').value='';
  if($('authDialog')?.open)$('authDialog').close();
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
  $('workspaceDetails').textContent=selected ? `${selected.name} â€¢ ${selected.id}` : 'No workspace selected.';
  updateCloudStatus();
  await refreshCloudSummary();
  await loadCurrentWorkspaceRole();
}

async function loadCurrentWorkspaceRole(){
  currentWorkspaceRole='';
  if(!cloudClient||!cloudSession?.user||!selectedWorkspaceId){applyRoleAccess();return;}
  const {data,error}=await cloudClient.from('workspace_members').select('role,is_active')
    .eq('workspace_id',selectedWorkspaceId).eq('user_id',cloudSession.user.id).maybeSingle();
  if(!error&&data?.is_active)currentWorkspaceRole=data.role;
  applyRoleAccess();
  await loadSubmissions();
}

function roleCanManageLibrary(){
  return ['owner','administrator','captain'].includes(currentWorkspaceRole);
}

function roleCanManageMembers(){
  return currentWorkspaceRole==='owner';
}

function roleCanSubmit(){
  return roleCanManageLibrary()||currentWorkspaceRole==='developer';
}

function applyRoleAccess(){
  const role=currentWorkspaceRole||'no workspace role';
  const banner=$('currentRoleBanner');
  if(banner){
    banner.textContent=role==='visitor'
      ?'Visitor access: you may explore approved features, but cannot upload, change or delete documents.'
      :role==='developer'
        ?'Developer access: you may submit original sources to quarantine. You cannot approve or publish them.'
        :roleCanManageLibrary()
          ?`Reviewer access (${role}): you may review submissions. Publishing still requires a verified scan.`
          :`Access role: ${role}`;
    banner.classList.toggle('denied',!roleCanSubmit());
  }
  const developerPanel=$('developerSubmissionPanel');
  if(developerPanel)developerPanel.dataset.roleHidden=String(!roleCanSubmit());
  ['uploadCloudFiles','cloudFileInput','uploadCapturedMedia'].forEach(id=>{
    const el=$(id);if(el)el.disabled=!roleCanManageLibrary();
  });
  const adminBanner=$('adminAccessBanner');
  if(adminBanner){
    adminBanner.textContent=!cloudSession?.user?'Sign in to manage your account.':!selectedWorkspaceId?'Select a workspace to manage its members.':roleCanManageMembers()?'Owner access verified. Member administration is enabled.':`Account settings available. Member administration requires the Owner role (current role: ${role}).`;
    adminBanner.classList.toggle('denied',!roleCanManageMembers());
  }
  document.querySelectorAll('.owner-only-setting').forEach(el=>el.dataset.roleHidden=String(!roleCanManageMembers()));
  refreshAccountSettingsSummary();
}
const SETTINGS_ROLES=['owner','administrator','captain','chief_officer','chief_engineer','dpa','developer','visitor','crew','viewer','auditor'];
let settingsMembers=[];
function refreshAccountSettingsSummary(){
  const user=cloudSession?.user, summary=$('settingsAccountSummary');
  if(!summary)return;
  summary.textContent=user?`${user.email} â€¢ ${currentWorkspaceRole||'no workspace role'} â€¢ User ID: ${user.id}`:'No active account.';
  if(user&&$('settingsDisplayName'))$('settingsDisplayName').value=user.user_metadata?.display_name||'';
}
async function saveAccountProfile(){
  if(!cloudClient||!cloudSession?.user)return;
  const displayName=$('settingsDisplayName').value.trim();
  const {data,error}=await cloudClient.auth.updateUser({data:{display_name:displayName}});
  if(!error&&data?.user)cloudSession={...cloudSession,user:data.user};
  $('accountSettingsStatus').textContent=error?error.message:'Profile saved.';refreshAccountSettingsSummary();
}
async function changeAccountPassword(){
  if(!cloudClient||!cloudSession?.user){$('accountSettingsStatus').textContent='Sign in first.';return;}
  const password=$('settingsNewPassword').value, confirmation=$('settingsConfirmPassword').value;
  if(password!==confirmation){$('accountSettingsStatus').textContent='Passwords do not match.';return;}
  if(!passwordPolicyStatus(password).valid){$('accountSettingsStatus').textContent=passwordPolicyMessage();return;}
  const {error}=await cloudClient.auth.updateUser({password});
  $('accountSettingsStatus').textContent=error?friendlyAuthError(error):'Password changed successfully.';
  if(!error){$('settingsNewPassword').value='';$('settingsConfirmPassword').value='';}
}
async function settingsSignOut(scope='local'){
  if(!cloudClient)return;
  if(scope==='global'&&!confirm('Sign out every Sinbad Marine session on all devices?'))return;
  const {error}=await cloudClient.auth.signOut({scope});
  if(error){$('accountSettingsStatus').textContent=error.message;return;}
  cloudSession=null;currentWorkspaceRole='';selectedWorkspaceId='';localStorage.removeItem('atlas_selected_workspace');updateCloudStatus();setAppAccess();openAuthDialog('signin');
}
async function invokeMemberAdmin(action,payload={}){
  if(!roleCanManageMembers())throw new Error('Only the workspace Owner can manage members.');
  const {data,error}=await cloudClient.functions.invoke('manage-members',{body:{action,workspaceId:selectedWorkspaceId,...payload}});
  if(error)throw error;if(data?.error)throw new Error(data.error);return data;
}
async function sendMemberInvite(){
  const email=$('memberInviteEmail').value.trim(), role=$('memberInviteRole').value, note=$('memberInviteNote').value.trim();
  if(!/^\S+@\S+\.\S+$/.test(email)){$('memberInviteStatus').textContent='Enter a valid email address.';return;}
  $('memberInviteStatus').textContent='Preparing secure invitationâ€¦';
  try{await invokeMemberAdmin('invite',{email,role,note,redirectTo:`${location.origin}${location.pathname}?type=invite`});$('memberInviteStatus').textContent=`Invitation sent to ${email}.`;$('memberInviteEmail').value='';$('memberInviteNote').value='';await loadAdminAudit();}
  catch(error){$('memberInviteStatus').textContent=`Invitation failed: ${error.message}`;}
}
function renderSettingsMembers(){
  const list=$('settingsMemberList');if(!list)return;
  const query=$('settingsMemberSearch').value.trim().toLowerCase(), filter=$('settingsMemberFilter').value;
  const rows=settingsMembers.filter(member=>(!query||`${member.user_id} ${member.role}`.toLowerCase().includes(query))&&(filter==='all'||(filter==='active'&&member.is_active)||(filter==='blocked'&&!member.is_active)||(filter==='developer'&&member.role==='developer')));
  list.innerHTML=rows.length?rows.map(member=>`<div class="settings-member ${member.is_active?'':'blocked'}"><div><strong>${cloudEsc(member.user_id)}</strong><small>${member.is_active?'Active':'Suspended'} â€¢ Joined ${cloudEsc(member.joined_at||'')}</small></div><select class="settings-role" data-user="${cloudEsc(member.user_id)}" aria-label="Role for ${cloudEsc(member.user_id)}">${SETTINGS_ROLES.map(role=>`<option value="${role}" ${member.role===role?'selected':''}>${role}</option>`).join('')}</select><div class="settings-member-actions"><button class="btn settings-save-role" data-user="${cloudEsc(member.user_id)}">Save role</button><button class="btn ${member.is_active?'danger':''} settings-toggle-member" data-user="${cloudEsc(member.user_id)}" data-active="${member.is_active}">${member.is_active?'Suspend':'Restore'}</button></div></div>`).join(''):'No matching members.';
}
async function loadSettingsMembers(){
  if(!roleCanManageMembers()||!selectedWorkspaceId){settingsMembers=[];renderSettingsMembers();return;}
  const {data,error}=await cloudClient.from('workspace_members').select('user_id,role,is_active,joined_at').eq('workspace_id',selectedWorkspaceId).order('joined_at');
  if(error){$('settingsMemberList').textContent=error.message;return;}settingsMembers=data||[];renderSettingsMembers();
}
async function changeSettingsMember(userId){
  const select=document.querySelector(`.settings-role[data-user="${CSS.escape(userId)}"]`);if(!select)return;
  if(!confirm(`Change this member's role to ${select.value}?`))return;
  try{await invokeMemberAdmin('set_role',{userId,role:select.value});await loadSettingsMembers();await loadMembers();await loadAdminAudit();}catch(error){alert(error.message);}
}
async function toggleSettingsMember(userId,isActive){
  const next=!isActive;if(!confirm(`${next?'Restore':'Suspend'} this member's workspace access?`))return;
  try{await invokeMemberAdmin('set_active',{userId,isActive:next});await loadSettingsMembers();await loadMembers();await loadAdminAudit();}catch(error){alert(error.message);}
}
async function loadAdminAudit(){
  const list=$('adminAuditList');if(!list||!roleCanManageMembers())return;
  const {data,error}=await cloudClient.from('member_admin_audit').select('action,target_user_id,target_email,details,created_at').eq('workspace_id',selectedWorkspaceId).order('created_at',{ascending:false}).limit(50);
  list.innerHTML=error?cloudEsc(error.message):(data?.length?data.map(event=>`<div class="audit-event"><strong>${cloudEsc(event.action)}</strong><small>${cloudEsc(event.target_email||event.target_user_id||'workspace')} â€¢ ${cloudEsc(event.created_at)}${event.details?` â€¢ ${cloudEsc(JSON.stringify(event.details))}`:''}</small></div>`).join(''):'No administrative events recorded.');
}
async function loadMembers(){
  if(!selectedWorkspaceId || !cloudClient)return;
  const {data,error}=await cloudClient.from('workspace_members').select('user_id,role,is_active,joined_at').eq('workspace_id',selectedWorkspaceId).order('joined_at');
  const canManageMembers=roleCanManageMembers();
  $('memberList').innerHTML=error ? cloudEsc(error.message) : (data?.length ? data.map(m=>`
    <div class="cloud-list-item">
      <strong>${cloudEsc(m.user_id)}</strong>
      <div class="member-role-row">
        ${canManageMembers?`
          <select class="member-role-select" data-user="${cloudEsc(m.user_id)}" aria-label="Role for ${cloudEsc(m.user_id)}">
            ${['owner','administrator','captain','chief_officer','chief_engineer','dpa','developer','visitor','crew','viewer','auditor']
              .map(r=>`<option value="${r}" ${m.role===r?'selected':''}>${r}</option>`).join('')}
          </select>
          <button class="btn save-member-role" data-user="${cloudEsc(m.user_id)}">Save role</button>
        `:`<span class="member-role-readonly" aria-label="Current role">${cloudEsc(m.role)}</span>`}
      </div>
      <small>${m.is_active?'Active':'Inactive'} â€¢ Joined ${cloudEsc(m.joined_at||'')}</small>
    </div>`).join('') : 'No members found.');
}

async function submitLibraryFiles(){
  if(!roleCanSubmit()){ $('submissionUploadStatus').textContent='Your role cannot submit documents.';return; }
  const files=[...$('submissionFiles').files];
  if(!files.length){$('submissionUploadStatus').textContent='Select one or more source files.';return;}
  const description=$('submissionDescription').value.trim();
  const library=$('submissionLibrary').value;
  let completed=0;
  for(const file of files){
    $('submissionUploadStatus').textContent=`Submitting ${completed+1}/${files.length}: ${file.name}`;
    const safe=file.name.replace(/[^a-zA-Z0-9._-]+/g,'-');
    const path=`${selectedWorkspaceId}/${cloudSession.user.id}/${Date.now()}-${safe}`;
    const {error:uploadError}=await cloudClient.storage.from('quarantine').upload(path,file,{contentType:file.type||'application/octet-stream',upsert:false});
    if(uploadError){$('submissionUploadStatus').textContent=`Quarantine upload failed: ${uploadError.message}`;continue;}
    const {error:rowError}=await cloudClient.from('document_submissions').insert({
      workspace_id:selectedWorkspaceId,submitted_by:cloudSession.user.id,bucket_id:'quarantine',object_path:path,
      original_filename:file.name,title:file.name,description:description||null,mime_type:file.type||null,
      file_size_bytes:file.size,intended_library:library,status:'submitted'
    });
    if(rowError){$('submissionUploadStatus').textContent=`File quarantined but submission record failed: ${rowError.message}`;continue;}
    completed++;
  }
  $('submissionFiles').value='';$('submissionDescription').value='';
  $('submissionUploadStatus').textContent=`âœ“ ${completed}/${files.length} source file(s) submitted for Owner review and security scan.`;
  await loadSubmissions();
}

async function loadSubmissions(){
  const list=$('submissionList');if(!list)return;
  if(!cloudClient||!selectedWorkspaceId||!cloudSession?.user){list.textContent='Sign in and select a workspace.';return;}
  const {data,error}=await cloudClient.from('document_submissions')
    .select('id,submitted_by,original_filename,title,description,mime_type,file_size_bytes,intended_library,status,review_note,object_path,created_at')
    .eq('workspace_id',selectedWorkspaceId).order('created_at',{ascending:false}).limit(100);
  if(error){list.textContent=error.message;return;}
  list.innerHTML=data?.length?data.map(s=>`
    <article class="submission-card">
      <h4>${cloudEsc(s.title||s.original_filename)}</h4>
      <p>${cloudEsc(s.intended_library)} â€¢ ${formatBytes(s.file_size_bytes||0)} â€¢ ${cloudEsc(s.status)}<br>${cloudEsc(s.description||'No description')}<br><small>${cloudEsc(s.created_at)}</small></p>
      ${roleCanManageLibrary()?`<div class="submission-actions">
        <button class="btn submission-open" data-path="${cloudEsc(s.object_path)}">Inspect original</button>
        <button class="btn primary submission-approve" data-id="${s.id}">Approve pending scan</button>
        <button class="btn danger submission-reject" data-id="${s.id}">Reject</button>
      </div>`:''}
    </article>`).join(''):'No submissions found.';
}

async function reviewSubmission(id,status){
  if(!roleCanManageLibrary())return;
  const note=prompt(status==='rejected'?'Reason for rejection:':'Owner review note:','')??'';
  const {error}=await cloudClient.from('document_submissions').update({
    status,review_note:note||null,reviewed_by:cloudSession.user.id,reviewed_at:new Date().toISOString()
  }).eq('id',id).eq('workspace_id',selectedWorkspaceId);
  alert(error?error.message:(status==='approved_pending_scan'?'Approved for security scanning. Not published yet.':'Submission rejected.'));
  if(!error)await loadSubmissions();
}

async function openSubmissionOriginal(path){
  if(!roleCanManageLibrary())return;
  const {data,error}=await cloudClient.storage.from('quarantine').createSignedUrl(path,300);
  if(error){alert(error.message);return;}
  window.open(data.signedUrl,'_blank','noopener');
}
async function loadAiJobs(){
  if(!selectedWorkspaceId || !cloudClient)return;
  const {data,error}=await cloudClient.from('ai_index_jobs').select('id,status,document_id,requested_at,error_message').eq('workspace_id',selectedWorkspaceId).order('requested_at',{ascending:false}).limit(30);
  $('aiJobList').innerHTML=error ? cloudEsc(error.message) : (data?.length ? data.map(j=>`<div class="cloud-list-item"><strong>${cloudEsc(j.status)}</strong><br><small>Document ${cloudEsc(j.document_id)}<br>${cloudEsc(j.requested_at)}${j.error_message?'<br>'+cloudEsc(j.error_message):''}</small></div>`).join('') : 'No indexing jobs.');
}
async function runSecurityCheck(){
  const cfg=getCloudConfig(), checks=[];
  checks.push(cfg.url&&cfg.key?'âœ“ Cloud configuration present':'âœ— Cloud configuration missing');
  checks.push(cloudSession?.user?'âœ“ Authenticated session':'âœ— Not signed in');
  checks.push(selectedWorkspaceId?'âœ“ Workspace selected':'âœ— Workspace not selected');
  checks.push(!/secret|service_role/i.test(cfg.key)?'âœ“ No obvious server secret stored':'âœ— Dangerous key detected');
  $('securityCheckResult').textContent=checks.join(' â€¢ ');
}
const KNOWLEDGE_CHUNK_SIZE=12000;
function classifyDocument(name,text,bucket){
  const source=`${name} ${text.slice(0,60000)}`.toLowerCase();
  const rules=[['SOLAS','solas|safety of life at sea'],['MARPOL','marpol|pollution prevention'],['COLREG','colreg|collision regulations'],['STCW','stcw|watchkeeping'],['ISM / Safety Management','ism code|safety management system'],['Navigation','navigation|passage plan|sailing direction|pilot book'],['Engineering','engine|machinery|generator|hydraulic'],['Yacht Operations','yacht|marina|anchorage|charter']];
  const match=rules.find(([,pattern])=>new RegExp(pattern,'i').test(source));
  return match?.[0]||(bucket==='nautical-charts'?'Nautical Chart':bucket==='nautical-publications'?'Nautical Publication':'General Document');
}
async function extractDocumentText(file,onProgress=()=>{}){
  const name=file.name.toLowerCase();
  if(file.size>50*1024*1024)throw new Error('This file is larger than the current 50 MB cloud limit.');
  if(file.type.startsWith('text/')||/\.(txt|md|csv|json|xml)$/i.test(name))return (await file.text()).slice(0,4000000);
  if(/\.docx$/i.test(name)){
    if(!window.mammoth)throw new Error('DOCX reader could not be loaded.');
    return (await mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()})).value.slice(0,4000000);
  }
  if(file.type==='application/pdf'||/\.pdf$/i.test(name)){
    const pdfjs=await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';
    const pdf=await pdfjs.getDocument({data:await file.arrayBuffer()}).promise,pages=[];
    for(let pageNo=1;pageNo<=pdf.numPages;pageNo++){
      onProgress(`Reading PDF page ${pageNo}/${pdf.numPages}â€¦`);
      const content=await (await pdf.getPage(pageNo)).getTextContent();pages.push(`[Page ${pageNo}]\n${content.items.map(item=>item.str).join(' ')}`);
      if(pages.reduce((n,p)=>n+p.length,0)>=4000000)break;
    }
    return pages.join('\n\n').slice(0,4000000);
  }
  if(file.type.startsWith('image/')||/\.(jpg|jpeg|png|webp|tif|tiff)$/i.test(name)){
    if(!window.Tesseract)throw new Error('Image OCR reader could not be loaded.');
    const result=await Tesseract.recognize(file,'eng+tur',{logger:m=>{if(m.status)onProgress(`OCR: ${m.status} ${Math.round((m.progress||0)*100)}%`);}});
    return (result.data?.text||'').slice(0,4000000);
  }
  throw new Error('Unsupported file type. Use PDF, DOCX, text or an image.');
}
async function saveDocumentKnowledge(documentId,file,text,bucket){
  const classification=classifyDocument(file.name,text,bucket),summary=text.replace(/\s+/g,' ').trim().slice(0,1200)||`${file.name} contains no machine-readable text.`;
  const {data:knowledge,error}=await cloudClient.from('document_knowledge').upsert({workspace_id:selectedWorkspaceId,document_id:documentId,title:file.name,classification,summary,language:/[Ã§ÄŸÄ±Ã¶ÅŸÃ¼]/i.test(text.slice(0,50000))?'tr':'en',source_mime_type:file.type||null,character_count:text.length,index_status:text?'ready':'metadata_only',indexed_by:cloudSession.user.id,indexed_at:new Date().toISOString()},{onConflict:'workspace_id,document_id'}).select('id').single();
  if(error)throw error;
  await cloudClient.from('document_knowledge_chunks').delete().eq('knowledge_id',knowledge.id);
  const chunks=[];for(let i=0;i<text.length;i+=KNOWLEDGE_CHUNK_SIZE)chunks.push({knowledge_id:knowledge.id,chunk_index:chunks.length,content:text.slice(i,i+KNOWLEDGE_CHUNK_SIZE)});
  for(let i=0;i<chunks.length;i+=50){const {error:chunkError}=await cloudClient.from('document_knowledge_chunks').insert(chunks.slice(i,i+50));if(chunkError)throw chunkError;}
  return {classification,chunks:chunks.length};
}
async function sinbadCloudKnowledgeAnswer(question){
  if(!cloudClient||!cloudSession?.user||!selectedWorkspaceId)return null;
  const status=$('sinbadKnowledgeStatus');if(status)status.textContent='Searching Atlas Cloudâ€¦';
  try{
    const language=sinbadState.language||appLanguage;
    const history=sinbadState.messages.slice(-12,-1).map(message=>({role:message.role==='sinbad'?'assistant':'user',content:message.text}));
    const coreEnvelope=window.SinbadCore?.aiEnvelope?.(question,history);
    const {data:aiData,error:aiError}=await cloudClient.functions.invoke('sinbad-answer',{body:{workspaceId:selectedWorkspaceId,question,language,history,coreEnvelope}});
    if(!aiError&&aiData?.answer){
      const answer=String(aiData.answer).trim();
      // Older cloud deployments can return a polite "no source found" notice
      // as if it were a complete AI answer. Treat those notices as a miss so
      // the installed Ollama brain gets an opportunity to answer instead.
      const cloudMiss=/yeterli kaynak bulunamad[Ä±i]|eÅŸleÅŸen bir kaynak bulamad[Ä±i]|AI baÄŸlantÄ±sÄ± henÃ¼z etkin|not enough (?:material|source)|no matching (?:knowledge|source)|keine ausreichende quelle|keine passende quelle/i.test(answer);
      const normalizedAnswer=answer.toLocaleLowerCase('tr-TR')
        .replace(/[Ä±Ä°]/g,'i').replace(/[ÅŸÅ]/g,'s').replace(/[ÄŸÄ]/g,'g')
        .replace(/[Ã¼Ãœ]/g,'u').replace(/[Ã¶Ã–]/g,'o').replace(/[Ã§Ã‡]/g,'c')
        .normalize('NFKD').replace(/[\u0300-\u036f]/g,'');
      const cloudMissFallback=normalizedAnswer.includes('yeterli kaynak yok')
        || normalizedAnswer.includes('yeterli kaynak bulunamadi')
        || normalizedAnswer.includes('yalnizca onayli atlas cloud')
        || normalizedAnswer.includes('kitabi veya belgeyi kutuphaneye yukleyin');
      if(!cloudMiss&&!cloudMissFallback){if(status)status.textContent='Atlas Cloud AI active';return answer;}
      if(status)status.textContent='Atlas Cloud has no answer Â· trying offline brain';
    }
    if(!aiError&&aiData?.needsWebPermission){if(status)status.textContent='Atlas Cloud has no answer Â· trying offline brain';return null;}
    const terms=question.toLocaleLowerCase(language).normalize('NFKD').replace(/[^a-z0-9Ã§ÄŸÄ±Ã¶ÅŸÃ¼Ğ°-ÑÑ‘Ø¡-ÙŠ ]/gi,' ').split(/\s+/).filter(x=>x.length>2).slice(0,8);if(!terms.length)return null;
    const {data,error}=await cloudClient.from('document_knowledge_chunks').select('content,chunk_index,document_knowledge!inner(title,classification,workspace_id)').eq('document_knowledge.workspace_id',selectedWorkspaceId).ilike('content',`%${terms[0]}%`).limit(12);
    if(error)throw error;if(!data?.length){if(status)status.textContent='Atlas Cloud has no answer Â· trying offline brain';return null;}
    const ranked=data.map(row=>({row,score:terms.reduce((n,t)=>n+(row.content.toLocaleLowerCase(language).includes(t)?1:0),0)})).sort((a,b)=>b.score-a.score).slice(0,4);
    const excerpts=ranked.map(({row})=>{const lower=row.content.toLocaleLowerCase(language),positions=terms.map(t=>lower.indexOf(t)).filter(n=>n>=0),at=positions.length?Math.min(...positions):0;return `â€¢ ${row.document_knowledge.title} [${row.document_knowledge.classification}]\n${row.content.slice(Math.max(0,at-180),at+650).replace(/\s+/g,' ').trim()}`;});
    if(status)status.textContent='Classified cloud archive active';
    return `Relevant classified Atlas Cloud passages:\n\n${excerpts.join('\n\n')}\n\nVerify critical navigation and safety decisions against the original publication.`;
  }catch(error){console.warn('Sinbad cloud knowledge unavailable',error);if(status)status.textContent='Atlas Cloud unavailable Â· trying offline brain';return null;}
}
async function performSinbadWebSearch(){
  const question=pendingSinbadWebQuestion;if(!question)return;$('sinbadWebConsent').classList.add('hidden');pendingSinbadWebQuestion='';
  $('sinbadThinking').classList.remove('hidden');
  try{
    const history=sinbadState.messages.slice(-12).map(message=>({role:message.role==='sinbad'?'assistant':'user',content:message.text}));
    const {data,error}=await cloudClient.functions.invoke('sinbad-answer',{body:{workspaceId:selectedWorkspaceId,question,language:sinbadState.language,allowWebSearch:true,history}});if(error)throw error;
    const copy=SINBAD_WEB_TEXT[sinbadState.language]||SINBAD_WEB_TEXT['en-US'];const answer=`${copy.result}:\n\n${data?.answer||'No reliable web result was found.'}`;
    addSinbadMessage('sinbad',answer);speakSinbad(answer);
  }catch(error){addSinbadMessage('sinbad',`Web search failed: ${error.message||error}`);}finally{$('sinbadThinking').classList.add('hidden');}
}
async function uploadCloudFiles(){
  if(!cloudClient || !cloudSession?.user || !selectedWorkspaceId){$('cloudUploadProgress').textContent='Connect to Atlas Cloud, sign in and select a workspace first.';alert('Connect, sign in and select a workspace first.');return;}
  if(!roleCanManageLibrary()){$('cloudUploadProgress').textContent='Use Library Submissions. Your role cannot publish directly to Atlas Cloud.';return;}
  const files=[...$('cloudFileInput').files]; if(!files.length){alert('Select one or more files.');return;}
  const bucket=$('cloudBucketSelect').value;
  const folder=($('cloudFolderPath').value.trim()||'general').replace(/^\/+|\/+$/g,'').replace(/[^a-zA-Z0-9._/-]+/g,'-');
  let completed=0;const failures=[];
  for(const file of files){
    let extractedText='';
    try{extractedText=await extractDocumentText(file,message=>$('cloudUploadProgress').textContent=`${file.name}: ${message}`);}catch(error){failures.push(`${file.name}: ${error.message}`);continue;}
    $('cloudUploadProgress').textContent=`Uploading ${completed+1}/${files.length}: ${file.name}`;
    const safeName=file.name.replace(/[^a-zA-Z0-9._-]+/g,'-');
    const path=`${selectedWorkspaceId}/${folder}/${Date.now()}-${safeName}`;
    const {error:uploadError}=await cloudClient.storage.from(bucket).upload(path,file,{upsert:false});
    if(uploadError){failures.push(`${file.name}: upload failed (${uploadError.message})`);continue;}
    const {data:documentRow,error:metaError}=await cloudClient.from('documents').insert({
      workspace_id:selectedWorkspaceId,bucket_id:bucket,object_path:path,original_filename:file.name,title:file.name,
      mime_type:file.type||null,file_size_bytes:file.size,status:'active',
      classification:bucket==='crew-confidential'?'confidential':'standard',created_by:cloudSession.user.id
    }).select('id').single();
    if(metaError){await cloudClient.storage.from(bucket).remove([path]);failures.push(`${file.name}: catalog failed (${metaError.message})`);continue;}
    try{await saveDocumentKnowledge(documentRow.id,file,extractedText,bucket);}catch(error){failures.push(`${file.name}: uploaded; knowledge indexing needs setup (${error.message})`);}
    completed++;
  }
  $('cloudUploadProgress').textContent=`âœ“ ${completed}/${files.length} file(s) uploaded to Atlas Cloud.`; await loadCloudFiles(); await refreshCloudSummary();
  if(failures.length)$('cloudUploadProgress').textContent+=`\nâš  ${failures.join('\nâš  ')}`;
  $('cloudFileInput').value='';
}
async function loadCloudFiles(){
  if(!cloudClient || !selectedWorkspaceId)return;
  const bucket=$('cloudBucketSelect').value;
  const {data,error}=await cloudClient.from('documents').select('id,title,original_filename,bucket_id,object_path,file_size_bytes,status,classification,created_at').eq('workspace_id',selectedWorkspaceId).eq('bucket_id',bucket).order('created_at',{ascending:false}).limit(100);
  if(error){$('cloudFileList').textContent=error.message;return;}
  $('cloudFileList').innerHTML=data?.length ? data.map(d=>`
    <article class="cloud-file-card">
      <h4>${cloudEsc(d.title||d.original_filename)}</h4>
      <small>${cloudEsc(d.bucket_id)} â€¢ ${Math.round((d.file_size_bytes||0)/1024)} KB<br>${cloudEsc(d.status)} â€¢ ${cloudEsc(d.classification)}</small>
      <div class="cloud-file-actions">
        <button class="btn cloud-open-file" data-bucket="${cloudEsc(d.bucket_id)}" data-path="${cloudEsc(d.object_path)}" data-name="${cloudEsc(d.original_filename)}">${d.bucket_id==='nautical-charts'?'View ENC':'Open'}</button>
        <button class="btn cloud-download-file" data-bucket="${cloudEsc(d.bucket_id)}" data-path="${cloudEsc(d.object_path)}" data-name="${cloudEsc(d.original_filename)}">Download</button>
        <button class="btn cloud-share-file" data-bucket="${cloudEsc(d.bucket_id)}" data-path="${cloudEsc(d.object_path)}" data-name="${cloudEsc(d.original_filename)}">Share</button>
        ${roleCanManageLibrary()?`<button class="btn cloud-rename-file" data-id="${cloudEsc(d.id)}" data-bucket="${cloudEsc(d.bucket_id)}" data-path="${cloudEsc(d.object_path)}" data-name="${cloudEsc(d.original_filename)}">Rename</button>
        <button class="btn cloud-index-file" data-id="${cloudEsc(d.id)}">Index AI</button>
        <button class="btn danger cloud-delete-file" data-id="${cloudEsc(d.id)}" data-bucket="${cloudEsc(d.bucket_id)}" data-path="${cloudEsc(d.object_path)}">Delete</button>`:''}
      </div>
    </article>`).join('') : 'No cloud files in this category.';
}
async function openCloudFile(bucket,path,filename=''){
  if(bucket==='nautical-charts'){
    openWorkspace('enc-viewer');
    initEncViewer();
    const status=$('encMapStatus');
    if(status)status.textContent=filename
      ? `${filename} is preserved in the chart archive. Visual ENC display opened.`
      : 'Visual ENC display opened.';
    return;
  }
  const {data,error}=await cloudClient.storage.from(bucket).createSignedUrl(path,300);
  if(error){alert(error.message);return;} window.open(data.signedUrl,'_blank','noopener');
}
async function indexCloudDocument(documentId){
  if(!cloudClient)return;
  const {data,error}=await cloudClient.functions.invoke('index-document',{body:{documentId}});
  alert(error ? error.message : `Index request completed: ${JSON.stringify(data)}`); await loadAiJobs();
}




async function saveMemberRole(userId){
  if(!cloudClient || !selectedWorkspaceId || !roleCanManageMembers()){
    alert('Only the workspace Owner can change member roles.');
    return;
  }
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

// ============================================================
// LOCATION INTELLIGENCE
// ============================================================

let currentGeoPosition=null;
let locationWatchId=null;

function setPermissionBanner(id,message,state=''){
  const banner=$(id);
  if(!banner)return;
  banner.textContent=message;
  banner.classList.remove('allowed','denied');
  if(state)banner.classList.add(state);
}

function renderPosition(position){
  currentGeoPosition=position;
  const {latitude,longitude,accuracy}=position.coords;
  $('locationLatitude').textContent=latitude.toFixed(6);
  $('locationLongitude').textContent=longitude.toFixed(6);
  $('locationAccuracy').textContent=`Â± ${Math.round(accuracy)} m`;
  $('locationTimestamp').textContent=new Date(position.timestamp).toLocaleString();
  $('copyCurrentCoordinates').disabled=false;
  setPermissionBanner('locationPermissionBanner','Location permission granted. Position remains private unless you explicitly attach it to media.','allowed');
  $('nearbyMarineInfo').textContent=`Position ready: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}. The verified nearby marina, anchorage, chart and publication service will use this position when its approved data connector is enabled.`;
}

function handleLocationError(error){
  const messages={
    1:'Location permission was denied. You can enable it later in browser or device settings.',
    2:'Your position is currently unavailable.',
    3:'The location request timed out. Please try again.'
  };
  setPermissionBanner('locationPermissionBanner',messages[error.code]||error.message||'Location could not be read.','denied');
}

function locationOptions(){
  return {enableHighAccuracy:true,timeout:15000,maximumAge:15000};
}

function getCurrentLocation(){
  if(!navigator.geolocation){handleLocationError({message:'This browser does not support location services.'});return;}
  setPermissionBanner('locationPermissionBanner','Waiting for location permissionâ€¦');
  navigator.geolocation.getCurrentPosition(renderPosition,handleLocationError,locationOptions());
}

function startLocationWatch(){
  if(!navigator.geolocation){handleLocationError({message:'This browser does not support location services.'});return;}
  if(locationWatchId!==null)return;
  setPermissionBanner('locationPermissionBanner','Position watch is active. Your location is not being published.','allowed');
  locationWatchId=navigator.geolocation.watchPosition(renderPosition,handleLocationError,locationOptions());
  $('startLocationWatch').disabled=true;
  $('stopLocationWatch').disabled=false;
}

function stopLocationWatch(){
  if(locationWatchId!==null)navigator.geolocation.clearWatch(locationWatchId);
  locationWatchId=null;
  $('startLocationWatch').disabled=false;
  $('stopLocationWatch').disabled=true;
  setPermissionBanner('locationPermissionBanner','Position watch stopped. The last position remains visible.');
}

async function copyCurrentCoordinates(){
  if(!currentGeoPosition)return;
  const {latitude,longitude}=currentGeoPosition.coords;
  await navigator.clipboard.writeText(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
  setPermissionBanner('locationPermissionBanner','Coordinates copied.','allowed');
}

// ============================================================
// CAMERA & PRIVATE MEDIA ARCHIVE
// ============================================================

let cameraStream=null;
let cameraFacingMode='environment';
let mediaRecorder=null;
let recordedChunks=[];
let pendingMedia=[];

function cameraButtons(active){
  $('startCamera').disabled=active;
  $('switchCamera').disabled=!active;
  $('capturePhoto').disabled=!active;
  $('startVideoRecording').disabled=!active || Boolean(mediaRecorder);
  $('closeCamera').disabled=!active;
}

async function openCamera(){
  if(!navigator.mediaDevices?.getUserMedia){
    setPermissionBanner('cameraPermissionBanner','This browser does not support live camera access. Use the phone camera / gallery selector below.','denied');
    return;
  }
  closeCamera();
  try{
    cameraStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:cameraFacingMode}},audio:false});
    const video=$('cameraPreview');
    video.srcObject=cameraStream;
    await video.play();
    video.classList.add('active');
    $('cameraPlaceholder').hidden=true;
    cameraButtons(true);
    setPermissionBanner('cameraPermissionBanner','Camera permission granted. Nothing is uploaded until you press Upload.','allowed');
  }catch(error){
    cameraButtons(false);
    setPermissionBanner('cameraPermissionBanner',`Camera could not be opened: ${error.message}`,'denied');
  }
}

function closeCamera(){
  if(mediaRecorder?.state==='recording')mediaRecorder.stop();
  cameraStream?.getTracks().forEach(track=>track.stop());
  cameraStream=null;
  const video=$('cameraPreview');
  if(video){video.srcObject=null;video.classList.remove('active');}
  if($('cameraPlaceholder'))$('cameraPlaceholder').hidden=false;
  cameraButtons(false);
  $('stopVideoRecording').disabled=true;
}

async function switchCamera(){
  cameraFacingMode=cameraFacingMode==='environment'?'user':'environment';
  await openCamera();
}

function addPendingMedia(blob,name){
  pendingMedia.push({blob,name,type:blob.type||'application/octet-stream',url:URL.createObjectURL(blob)});
  renderPendingMedia();
}

function capturePhoto(){
  const video=$('cameraPreview');
  if(!cameraStream || !video.videoWidth)return;
  const canvas=$('photoCaptureCanvas');
  canvas.width=video.videoWidth;
  canvas.height=video.videoHeight;
  canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);
  canvas.toBlob(blob=>{
    if(blob)addPendingMedia(blob,`sinbad-photo-${new Date().toISOString().replace(/[:.]/g,'-')}.jpg`);
  },'image/jpeg',.9);
}

function startVideoRecording(){
  if(!cameraStream || !window.MediaRecorder){
    setPermissionBanner('cameraPermissionBanner','Live video recording is not supported here. Use the phone camera selector instead.','denied');
    return;
  }
  recordedChunks=[];
  mediaRecorder=new MediaRecorder(cameraStream);
  mediaRecorder.ondataavailable=event=>{if(event.data.size)recordedChunks.push(event.data);};
  mediaRecorder.onstop=()=>{
    const type=mediaRecorder?.mimeType||'video/webm';
    const blob=new Blob(recordedChunks,{type});
    const extension=type.includes('mp4')?'mp4':'webm';
    addPendingMedia(blob,`sinbad-video-${new Date().toISOString().replace(/[:.]/g,'-')}.${extension}`);
    mediaRecorder=null;
    $('startVideoRecording').disabled=!cameraStream;
    $('stopVideoRecording').disabled=true;
  };
  mediaRecorder.start(1000);
  $('startVideoRecording').disabled=true;
  $('stopVideoRecording').disabled=false;
  setPermissionBanner('cameraPermissionBanner','Recording video locally. Press Stop Recording when finished.','allowed');
}

function stopVideoRecording(){
  if(mediaRecorder?.state==='recording')mediaRecorder.stop();
}

function addSelectedMedia(files){
  [...files].forEach(file=>addPendingMedia(file,file.name));
  $('mobileMediaCapture').value='';
}

function renderPendingMedia(){
  const gallery=$('capturedMediaGallery');
  gallery.innerHTML=pendingMedia.map((item,index)=>`
    <article class="captured-media-card">
      ${item.type.startsWith('video/')?`<video src="${item.url}" controls playsinline></video>`:`<img src="${item.url}" alt="Captured media preview">`}
      <button class="captured-media-remove" type="button" data-media-index="${index}" aria-label="Remove">Ã—</button>
      <small>${cloudEsc(item.name)}<br>${Math.round(item.blob.size/1024)} KB</small>
    </article>`).join('');
  $('uploadCapturedMedia').disabled=!pendingMedia.length;
  $('mediaUploadStatus').textContent=pendingMedia.length?`${pendingMedia.length} private media item(s) ready to upload.`:'No media selected.';
}

function removePendingMedia(index){
  const [removed]=pendingMedia.splice(index,1);
  if(removed)URL.revokeObjectURL(removed.url);
  renderPendingMedia();
}

async function uploadCapturedMedia(){
  if(!cloudClient || !cloudSession?.user || !selectedWorkspaceId){
    $('mediaUploadStatus').textContent='Sign in and select your workspace before uploading.';
    openWorkspace('cloud-control');
    return;
  }
  if(!pendingMedia.length)return;
  if(!roleCanManageLibrary()){$('mediaUploadStatus').textContent='Visitor and Developer media remains on the device in this release; cloud upload requires reviewer permission.';return;}
  const note=$('mediaArchiveNote').value.trim();
  const geo=currentGeoPosition?.coords;
  const tags=['camera-media','private-archive'];
  if(geo)tags.push(`geo:${geo.latitude.toFixed(5)},${geo.longitude.toFixed(5)}`);
  let completed=0;
  const items=[...pendingMedia];
  for(const item of items){
    $('mediaUploadStatus').textContent=`Uploading ${completed+1}/${items.length}: ${item.name}`;
    const safeName=item.name.replace(/[^a-zA-Z0-9._-]+/g,'-');
    const month=new Date().toISOString().slice(0,7);
    const path=`${selectedWorkspaceId}/private-media/${month}/${Date.now()}-${safeName}`;
    const {error:uploadError}=await cloudClient.storage.from('passage-media').upload(path,item.blob,{contentType:item.type,upsert:false});
    if(uploadError){$('mediaUploadStatus').textContent=`Upload failed: ${uploadError.message}`;continue;}
    const {error:metaError}=await cloudClient.from('documents').insert({
      workspace_id:selectedWorkspaceId,bucket_id:'passage-media',object_path:path,original_filename:item.name,title:item.name,
      description:note||null,mime_type:item.type,file_size_bytes:item.blob.size,tags,status:'active',
      classification:'restricted',ai_index_allowed:false,created_by:cloudSession.user.id
    });
    if(metaError){$('mediaUploadStatus').textContent=`Media uploaded but its archive record failed: ${metaError.message}`;continue;}
    completed++;
  }
  if(completed===items.length){
    pendingMedia.forEach(item=>URL.revokeObjectURL(item.url));
    pendingMedia=[];
    $('mediaArchiveNote').value='';
    renderPendingMedia();
  }
  $('mediaUploadStatus').textContent=`âœ“ ${completed}/${items.length} item(s) saved in the private passage-media archive.`;
  await refreshCloudSummary();
}

// ============================================================
// CAPTAIN'S LOGBOOK + SINBAD VOICE WATCH
// ============================================================

const LOGBOOK_STORAGE_KEY='sinbad_captains_logbook_v1';
let logDrafts=[];
let voiceRecognition=null;
let voiceWatchEnabled=false;
let waitingForLogText=false;
let logAudioStream=null;
let logAudioRecorder=null;
let logAudioChunks=[];
let pendingLogAudio=null;

function loadLogDrafts(){
  try{logDrafts=JSON.parse(localStorage.getItem(LOGBOOK_STORAGE_KEY)||'[]');}
  catch(_){logDrafts=[];}
  if(!Array.isArray(logDrafts))logDrafts=[];
  renderLogDrafts();
}

function persistLogDrafts(){
  localStorage.setItem(LOGBOOK_STORAGE_KEY,JSON.stringify(logDrafts));
  renderLogDrafts();
}

function logPosition(){
  if(!$('attachLogPosition')?.checked || !currentGeoPosition)return null;
  const c=currentGeoPosition.coords;
  return {latitude:Number(c.latitude.toFixed(6)),longitude:Number(c.longitude.toFixed(6)),accuracy_m:Math.round(c.accuracy),captured_at:new Date(currentGeoPosition.timestamp).toISOString()};
}

function updateLogClock(){
  const now=new Date();
  if($('logLocalClock'))$('logLocalClock').textContent=now.toLocaleString('tr-TR',{dateStyle:'medium',timeStyle:'medium'});
  if($('logUtcClock'))$('logUtcClock').textContent=now.toISOString().replace('T',' ').slice(0,19)+' UTC';
  if($('logPositionPreview')){
    const c=currentGeoPosition?.coords;
    $('logPositionPreview').textContent=c?`${c.latitude.toFixed(6)}, ${c.longitude.toFixed(6)} (Â±${Math.round(c.accuracy)} m)`:'Position not available';
  }
}

function saveLogDraft(text=$('logDraftText')?.value.trim(),source='typed'){
  if(!text){$('logComposeStatus').textContent='Enter or dictate a log note first.';return;}
  const now=new Date();
  logDrafts.unshift({
    id:crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random()}`,
    text,category:$('logCategory')?.value||'General',source,status:'draft',
    local_iso:new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,-1),
    utc_iso:now.toISOString(),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'local',
    position:logPosition(),audio_name:pendingLogAudio?.name||null,created_by:cloudSession?.user?.email||'local-authorized-user'
  });
  persistLogDrafts();
  $('logDraftText').value='';
  $('logComposeStatus').textContent='âœ“ Draft log entry saved. Review it before transfer to the official logbook.';
  pendingLogAudio=null;
}

function renderLogDrafts(){
  const list=$('logDraftList'); if(!list)return;
  $('logArchiveSummary').textContent=`${logDrafts.length} entries â€¢ ${logDrafts.filter(x=>x.status==='draft').length} awaiting review`;
  if(!logDrafts.length){list.innerHTML='<div class="notice">No draft entries yet.</div>';return;}
  list.innerHTML=logDrafts.map(item=>{
    const pos=item.position?`${item.position.latitude}, ${item.position.longitude} Â±${item.position.accuracy_m} m`:'No position';
    return `<article class="log-entry ${cloudEsc(item.status)}">
      <div><div class="log-entry-head"><time>${cloudEsc(new Date(item.utc_iso).toLocaleString())}</time><span class="log-badge">${cloudEsc(item.category)}</span><span class="log-badge">${cloudEsc(item.status)}</span><span class="log-badge">${cloudEsc(item.source)}</span></div>
      <p>${cloudEsc(item.text)}</p><div class="log-entry-meta">UTC ${cloudEsc(item.utc_iso)} â€¢ ${cloudEsc(pos)}${item.audio_name?` â€¢ Audio: ${cloudEsc(item.audio_name)}`:''}</div></div>
      <div class="log-entry-actions">
        <button class="btn" data-log-action="edit" data-log-id="${item.id}">Edit</button>
        <button class="btn" data-log-action="review" data-log-id="${item.id}">Review</button>
        <button class="btn" data-log-action="transfer" data-log-id="${item.id}">Transferred</button>
        <button class="btn danger" data-log-action="delete" data-log-id="${item.id}">Delete</button>
      </div></article>`;
  }).join('');
}

function handleLogAction(action,id){
  const item=logDrafts.find(x=>x.id===id); if(!item)return;
  if(action==='edit'){
    const changed=prompt('Edit draft log entry:',item.text);
    if(changed?.trim()){item.text=changed.trim();item.updated_at=new Date().toISOString();}
  }
  if(action==='review')item.status='reviewed';
  if(action==='transfer'){
    if(confirm('Mark this draft as transferred to the official vessel logbook?'))item.status='transferred';
  }
  if(action==='delete'){
    if(!confirm('Delete this draft entry?'))return;
    logDrafts=logDrafts.filter(x=>x.id!==id);
  }
  persistLogDrafts();
}

function downloadLogExport(type){
  if(!logDrafts.length){alert('There are no log entries to export.');return;}
  let data,mime,name;
  if(type==='json'){
    data=JSON.stringify({exported_at:new Date().toISOString(),entries:logDrafts},null,2);
    mime='application/json';name=`sinbad-logbook-${new Date().toISOString().slice(0,10)}.json`;
  }else{
    const quote=value=>`"${String(value??'').replace(/"/g,'""')}"`;
    data=['Local time,UTC,Category,Status,Source,Entry,Latitude,Longitude,Accuracy m',
      ...logDrafts.map(x=>[x.local_iso,x.utc_iso,x.category,x.status,x.source,x.text,x.position?.latitude,x.position?.longitude,x.position?.accuracy_m].map(quote).join(','))].join('\r\n');
    mime='text/csv;charset=utf-8';name=`sinbad-logbook-${new Date().toISOString().slice(0,10)}.csv`;
  }
  const url=URL.createObjectURL(new Blob([data],{type:mime}));
  const link=document.createElement('a');link.href=url;link.download=name;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function voiceStatus(title,help,state=''){
  $('voiceWatchTitle').textContent=title;$('voiceWatchHelp').textContent=help;
  $('voicePulse').classList.remove('listening','capturing');
  if(state)$('voicePulse').classList.add(state);
}

function processVoicePhrase(phrase){
  const clean=phrase.trim();
  $('voiceTranscript').textContent=clean||'No speech detected.';
  const normalized=clean.toLocaleLowerCase('tr-TR');
  const command=normalized.match(/\b(?:sinbad|simbad)\s+(?:log|jurnal|gÃ¼nlÃ¼k)\b[,:;\s-]*(.*)$/i);
  if(command){
    const entry=(command[1]||'').trim();
    if(entry){$('logDraftText').value=entry;saveLogDraft(entry,'voice-command');waitingForLogText=false;voiceStatus('Draft saved','Say â€œSinbad Logâ€ for another entry.','listening');if(!voiceWatchEnabled)try{voiceRecognition?.stop();}catch(_){}}
    else{waitingForLogText=true;voiceStatus('Sinbad is listening for the log entry','Speak the operational detail now.','capturing');}
    return;
  }
  if(waitingForLogText && clean){
    $('logDraftText').value=clean;saveLogDraft(clean,'voice-command');waitingForLogText=false;
    voiceStatus('Draft saved','Say â€œSinbad Logâ€ for another entry.','listening');
    if(!voiceWatchEnabled)try{voiceRecognition?.stop();}catch(_){}
  }
}

function createVoiceRecognition(){
  const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!Recognition)return null;
  const recognition=new Recognition();
  recognition.lang='tr-TR';recognition.continuous=true;recognition.interimResults=true;
  recognition.onresult=event=>{
    let interim='';
    for(let i=event.resultIndex;i<event.results.length;i++){
      const text=event.results[i][0].transcript;
      if(event.results[i].isFinal)processVoicePhrase(text); else interim+=text;
    }
    if(interim)$('voiceTranscript').textContent=interim;
  };
  recognition.onerror=event=>{
    $('voiceTranscript').textContent=`Voice recognition: ${event.error}`;
    if(event.error==='not-allowed')stopVoiceWatch();
  };
  recognition.onend=()=>{
    if(voiceWatchEnabled)setTimeout(()=>{try{recognition.start();}catch(_){}},350);
  };
  return recognition;
}

function startVoiceWatch(pushOnly=false){
  if(!voiceRecognition)voiceRecognition=createVoiceRecognition();
  if(!voiceRecognition){
    voiceStatus('Voice recognition is unavailable','Use the typed entry box or audio recorder on this browser.');
    return;
  }
  voiceWatchEnabled=!pushOnly;
  waitingForLogText=pushOnly;
  try{voiceRecognition.start();}catch(_){}
  $('startVoiceWatch').disabled=!pushOnly;$('stopVoiceWatch').disabled=pushOnly;
  voiceStatus(pushOnly?'Push to Talk is listening':'Sinbad Voice Watch is active',pushOnly?'Speak your log entry now.':'Say â€œSinbad Logâ€ followed by the entry.','listening');
}

function stopVoiceWatch(){
  voiceWatchEnabled=false;waitingForLogText=false;
  try{voiceRecognition?.stop();}catch(_){}
  $('startVoiceWatch').disabled=false;$('stopVoiceWatch').disabled=true;
  voiceStatus('Sinbad Voice Watch is off','Press Start Voice Watch when the app is open and visible.');
}

async function startLogAudio(){
  if(!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder){$('logComposeStatus').textContent='Audio recording is not supported by this browser.';return;}
  try{
    logAudioStream=await navigator.mediaDevices.getUserMedia({audio:true});
    logAudioChunks=[];logAudioRecorder=new MediaRecorder(logAudioStream);
    logAudioRecorder.ondataavailable=e=>{if(e.data.size)logAudioChunks.push(e.data);};
    logAudioRecorder.onstop=()=>{
      const type=logAudioRecorder.mimeType||'audio/webm';
      const blob=new Blob(logAudioChunks,{type});
      const ext=type.includes('mp4')?'m4a':'webm';
      const name=`sinbad-log-audio-${new Date().toISOString().replace(/[:.]/g,'-')}.${ext}`;
      const url=URL.createObjectURL(blob);pendingLogAudio={blob,name,url};
      const link=document.createElement('a');link.href=url;link.download=name;link.textContent='Download recorded audio';
      $('logComposeStatus').innerHTML='âœ“ Audio note ready. Save the draft text, and keep this file: ';
      $('logComposeStatus').append(link);
      logAudioStream?.getTracks().forEach(t=>t.stop());logAudioStream=null;logAudioRecorder=null;
    };
    logAudioRecorder.start(1000);$('recordLogAudio').disabled=true;$('stopLogAudio').disabled=false;
    $('logComposeStatus').textContent='â— Recording audio locally. Press Stop Audio when finished.';
  }catch(error){$('logComposeStatus').textContent=`Microphone could not be opened: ${error.message}`;}
}

function stopLogAudio(){
  if(logAudioRecorder?.state==='recording')logAudioRecorder.stop();
  $('recordLogAudio').disabled=false;$('stopLogAudio').disabled=true;
}

async function startEmergencyRecord(){
  openWorkspace('camera-archive');
  closeCamera();
  if(!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder){
    setPermissionBanner('cameraPermissionBanner','Emergency recording is not supported by this browser. Use the phone camera selector.','denied');return;
  }
  try{
    cameraFacingMode='environment';
    cameraStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:true});
    const video=$('cameraPreview');video.srcObject=cameraStream;await video.play();video.classList.add('active');
    $('cameraPlaceholder').hidden=true;cameraButtons(true);
    startVideoRecording();
    setPermissionBanner('cameraPermissionBanner','â— EMERGENCY EVIDENCE RECORDING â€” audio and video are being recorded visibly. Press Stop Recording to finish.','denied');
  }catch(error){
    setPermissionBanner('cameraPermissionBanner',`Emergency recording could not start: ${error.message}`,'denied');
  }
}


$('saveCloudConfig').addEventListener('click',saveCloudConfig);
$('clearCloudConfig').addEventListener('click',()=>{localStorage.removeItem('atlas_supabase_url');localStorage.removeItem('atlas_supabase_publishable_key');cloudClient=null;cloudSession=null;updateCloudStatus();});
$('testCloudConnection').addEventListener('click',testCloudConnection);
$('cloudSignIn').addEventListener('click',cloudSignIn);
$('cloudSignOut').addEventListener('click',cloudSignOut);
$('refreshWorkspaces').addEventListener('click',loadWorkspaces);
$('workspaceSelect').addEventListener('change',async e=>{selectedWorkspaceId=e.target.value;localStorage.setItem('atlas_selected_workspace',selectedWorkspaceId);updateCloudStatus();await loadCurrentWorkspaceRole();await loadMembers();await loadSettingsMembers();await loadAdminAudit();await loadCloudFiles();await refreshCloudSummary();});
$('refreshMembers').addEventListener('click',loadMembers);
$('refreshAiJobs').addEventListener('click',loadAiJobs);
$('runSecurityCheck').addEventListener('click',runSecurityCheck);
$('saveDisplayName')?.addEventListener('click',saveAccountProfile);
$('changeAccountPassword')?.addEventListener('click',changeAccountPassword);
$('settingsSignOut')?.addEventListener('click',()=>settingsSignOut('local'));
$('settingsSignOutEverywhere')?.addEventListener('click',()=>settingsSignOut('global'));
$('sendMemberInvite')?.addEventListener('click',sendMemberInvite);
$('settingsRefreshMembers')?.addEventListener('click',loadSettingsMembers);
$('settingsMemberSearch')?.addEventListener('input',renderSettingsMembers);
$('settingsMemberFilter')?.addEventListener('change',renderSettingsMembers);
$('refreshAdminAudit')?.addEventListener('click',loadAdminAudit);
$('settingsMemberList')?.addEventListener('click',event=>{
  const save=event.target.closest('.settings-save-role'),toggle=event.target.closest('.settings-toggle-member');
  if(save)changeSettingsMember(save.dataset.user);
  if(toggle)toggleSettingsMember(toggle.dataset.user,toggle.dataset.active==='true');
});
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
  if(o)openCloudFile(o.dataset.bucket,o.dataset.path,o.dataset.name||'');
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
  openAuthDialog('signin');
});
$('openRegistration').addEventListener('click',()=>openAuthDialog('registration'));
$('checkCloudBeforeSignIn')?.addEventListener('click',diagnosePublicCloudConnection);
$('openAccountPassword')?.addEventListener('click',()=>{
  if(cloudSession?.user)openWorkspace('admin-settings');
  else openAuthDialog('recovery');
});
$('closeAuthDialog').addEventListener('click',()=>$('authDialog').close());
$('gatewaySignIn').addEventListener('click',gatewaySignIn);
$('gatewayPassword').addEventListener('keydown',e=>{if(e.key==='Enter')gatewaySignIn();});
$('showRecovery').addEventListener('click',()=>showRecoveryPanel(true));
$('showSignIn').addEventListener('click',()=>showRecoveryPanel(false));
$('showRegistration').addEventListener('click',()=>showAuthPanel('registration'));
$('registrationBackToSignIn').addEventListener('click',()=>showAuthPanel('signin'));
$('createAccount').addEventListener('click',createAccount);
$('completeInviteSetup').addEventListener('click',completeInviteAccount);
$('requestRecoveryCode').addEventListener('click',requestRecoveryCode);
$('completeRecovery').addEventListener('click',completeRecovery);
setupPasswordControls();
if($('gatewayEmail'))$('gatewayEmail').value=localStorage.getItem('sinbad_last_login_email')||'';
$('getCurrentLocation')?.addEventListener('click',getCurrentLocation);
$('startLocationWatch')?.addEventListener('click',startLocationWatch);
$('stopLocationWatch')?.addEventListener('click',stopLocationWatch);
$('copyCurrentCoordinates')?.addEventListener('click',copyCurrentCoordinates);
$('startCamera')?.addEventListener('click',openCamera);
$('switchCamera')?.addEventListener('click',switchCamera);
$('capturePhoto')?.addEventListener('click',capturePhoto);
$('startVideoRecording')?.addEventListener('click',startVideoRecording);
$('stopVideoRecording')?.addEventListener('click',stopVideoRecording);
$('closeCamera')?.addEventListener('click',closeCamera);
$('mobileMediaCapture')?.addEventListener('change',event=>addSelectedMedia(event.target.files));
$('uploadCapturedMedia')?.addEventListener('click',uploadCapturedMedia);
$('submitLibraryFiles')?.addEventListener('click',submitLibraryFiles);
$('refreshSubmissions')?.addEventListener('click',loadSubmissions);
$('submissionList')?.addEventListener('click',event=>{
  const open=event.target.closest('.submission-open');
  const approve=event.target.closest('.submission-approve');
  const reject=event.target.closest('.submission-reject');
  if(open)openSubmissionOriginal(open.dataset.path);
  if(approve)reviewSubmission(approve.dataset.id,'approved_pending_scan');
  if(reject)reviewSubmission(reject.dataset.id,'rejected');
});
$('capturedMediaGallery')?.addEventListener('click',event=>{
  const button=event.target.closest('[data-media-index]');
  if(button)removePendingMedia(Number(button.dataset.mediaIndex));
});
$('saveLogDraft')?.addEventListener('click',()=>saveLogDraft());
$('startVoiceWatch')?.addEventListener('click',()=>startVoiceWatch(false));
$('stopVoiceWatch')?.addEventListener('click',stopVoiceWatch);
$('pushToTalkLog')?.addEventListener('click',()=>startVoiceWatch(true));
$('recordLogAudio')?.addEventListener('click',startLogAudio);
$('stopLogAudio')?.addEventListener('click',stopLogAudio);
$('startEmergencyRecord')?.addEventListener('click',startEmergencyRecord);
$('exportLogsJson')?.addEventListener('click',()=>downloadLogExport('json'));
$('exportLogsCsv')?.addEventListener('click',()=>downloadLogExport('csv'));
$('clearReviewedLogs')?.addEventListener('click',()=>{
  const count=logDrafts.filter(x=>x.status==='transferred').length;
  if(count&&confirm(`Remove ${count} transferred entries from this device?`)){logDrafts=logDrafts.filter(x=>x.status!=='transferred');persistLogDrafts();}
});
$('logDraftList')?.addEventListener('click',event=>{
  const button=event.target.closest('[data-log-action]');
  if(button)handleLogAction(button.dataset.logAction,button.dataset.logId);
});

if(navigator.permissions?.query){
  navigator.permissions.query({name:'geolocation'}).then(status=>{
    if(status.state==='granted')setPermissionBanner('locationPermissionBanner','Location permission is available. Press a location button when you want to use it.','allowed');
    if(status.state==='denied')setPermissionBanner('locationPermissionBanner','Location permission is blocked in browser or device settings.','denied');
  }).catch(()=>{});
}

initCloudClient();
restoreCloudSession();
loadLogDrafts();
updateLogClock();
setInterval(updateLogClock,1000);


setTimeout(()=>{
  if(!localStorage.getItem('atlas_v61_seen')){
    localStorage.setItem('atlas_v61_seen','1');
    const card=document.querySelector('[data-open="cloud-control"]');
    if(card) card.classList.add('attention-pulse');
  }
},800);


setSetupProgress();
