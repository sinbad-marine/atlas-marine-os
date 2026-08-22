

const $=id=>document.getElementById(id);
const APP_LANGUAGES=[['tr-TR','Türkçe'],['en-US','English'],['ru-RU','Русский'],['fr-FR','Français'],['de-DE','Deutsch'],['ar-SA','العربية'],['es-ES','Español'],['it-IT','Italiano']];
const APP_I18N={
 'tr-TR':{gatewayTitle:'Sinbad Marine şu anda geliştiriliyor.',gatewayText:'Güvenli denizcilik zekâsı ve yat operasyon platformumuz kullanıma hazırlanıyor.',signIn:'Üye Girişi',createAccount:'Hesap Oluştur',checkCloud:'Bulut Bağlantısını Kontrol Et',heroTitle:'Tek Köprü. Tüm Operasyonlar.'},
 'en-US':{gatewayTitle:'Sinbad Marine is currently under development.',gatewayText:'Our secure marine intelligence and yacht operations platform is being prepared for launch.',signIn:'Member Sign In',createAccount:'Create Account',checkCloud:'Check Cloud Connection',heroTitle:'One Bridge. Every Operation.'},
 'ru-RU':{gatewayTitle:'Sinbad Marine находится в разработке.',gatewayText:'Наша защищённая платформа морской аналитики и управления яхтой готовится к запуску.',signIn:'Войти',createAccount:'Создать аккаунт',checkCloud:'Проверить облако',heroTitle:'Один мостик. Все операции.'},
 'fr-FR':{gatewayTitle:'Sinbad Marine est en cours de développement.',gatewayText:'Notre plateforme sécurisée de renseignement maritime et de gestion de yacht est en préparation.',signIn:'Connexion membre',createAccount:'Créer un compte',checkCloud:'Tester le cloud',heroTitle:'Une passerelle. Toutes les opérations.'},
 'de-DE':{gatewayTitle:'Sinbad Marine wird derzeit entwickelt.',gatewayText:'Unsere sichere Plattform für maritime Informationen und Yachtbetrieb wird vorbereitet.',signIn:'Mitglieder-Login',createAccount:'Konto erstellen',checkCloud:'Cloud prüfen',heroTitle:'Eine Brücke. Alle Abläufe.'},
 'ar-SA':{gatewayTitle:'يجري حاليًا تطوير Sinbad Marine.',gatewayText:'يتم إعداد منصتنا الآمنة للمعلومات البحرية وعمليات اليخوت للإطلاق.',signIn:'دخول الأعضاء',createAccount:'إنشاء حساب',checkCloud:'فحص الاتصال السحابي',heroTitle:'جسر واحد. كل العمليات.'},
 'es-ES':{gatewayTitle:'Sinbad Marine está actualmente en desarrollo.',gatewayText:'Nuestra plataforma segura de inteligencia marítima y operaciones de yates se está preparando.',signIn:'Acceso de miembros',createAccount:'Crear cuenta',checkCloud:'Comprobar la nube',heroTitle:'Un puente. Todas las operaciones.'},
 'it-IT':{gatewayTitle:'Sinbad Marine è attualmente in fase di sviluppo.',gatewayText:'La nostra piattaforma sicura per intelligence marittima e gestione yacht è in preparazione.',signIn:'Accesso membri',createAccount:'Crea account',checkCloud:'Controlla il cloud',heroTitle:'Un ponte. Tutte le operazioni.'}
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
function openWorkspace(id){document.querySelectorAll('.workspace').forEach(x=>x.classList.remove('active'));$(id).classList.add('active');$(id).scrollIntoView({behavior:'smooth'});renderAll();if(id==='enc-viewer')initEncViewer();if(id==='navigation-plot')initNavigationPlot();if(id==='studio-console')refreshStudioCapability()}
function closeWorkspaces(){document.querySelectorAll('.workspace').forEach(x=>x.classList.remove('active'));scrollTo({top:0,behavior:'smooth'})}

let encMap=null,encChartLayer=null,encBathymetryLayer=null,encSeamarkLayer=null;
let navigationPlotMap=null,navigationPlotSource=null,navigationPlotRoute=null;
function plotCoordinate(value,axis){return window.SinbadNavigation?.formatCoordinate?.(value,axis)||Number(value).toFixed(5)}
function renderNavigationPlot(){
  if(!navigationPlotMap||!navigationPlotRoute)return;
  const route=navigationPlotRoute,start=ol.proj.fromLonLat([route.start.lon,route.start.lat]),end=ol.proj.fromLonLat([route.end.lon,route.end.lat]);
  const line=new ol.Feature({geometry:new ol.geom.LineString(route.points.map(point=>ol.proj.fromLonLat(point))),kind:'route'});
  const startFeature=new ol.Feature({geometry:new ol.geom.Point(start),kind:'start',label:'Başlangıç'}),endFeature=new ol.Feature({geometry:new ol.geom.Point(end),kind:'end',label:'Varış'});
  navigationPlotSource.clear();navigationPlotSource.addFeatures([line,startFeature,endFeature]);
  navigationPlotMap.getView().fit(line.getGeometry().getExtent(),{padding:[80,80,80,80],maxZoom:9,duration:650});
  $('navigationPlotSummary').textContent=`SEYİR HESABI\n\nBaşlangıç\n${plotCoordinate(route.start.lat,'lat')}, ${plotCoordinate(route.start.lon,'lon')}\n\nVarış\n${plotCoordinate(route.end.lat,'lat')}, ${plotCoordinate(route.end.lon,'lon')}\n\nRota: ${route.course.toFixed(1)}°T\nSürat: ${route.speedKnots.toFixed(2)} kn\nSüre: ${route.hours.toFixed(2)} saat\nMesafe: ${route.distanceNm.toFixed(2)} NM\nYöntem: Sabit kerteriz hattı (rhumb line)\n\n⚠ Eğitim ve karar desteğidir. Resmî harita değildir.`;
}
function initNavigationPlot(){
  if(!window.ol){$('navigationPlotSummary').textContent='Harita kütüphanesi yüklenemedi.';return;}
  if(!navigationPlotMap){
    const status=$('navigationPlotStatus');
    const offlineLandSource=new ol.source.Vector({url:'./vendor/land-110m.json',format:new ol.format.TopoJSON(),overlaps:false});
    offlineLandSource.on('featuresloadend',()=>{status.textContent='Offline dünya katmanı hazır · OSM ayrıntıları internet bağlantısı varsa gösterilir.';status.classList.add('ready')});
    offlineLandSource.on('featuresloaderror',()=>{status.textContent='Offline dünya katmanı yüklenemedi.';status.classList.add('error')});
    const offlineOcean=new ol.layer.Vector({source:offlineLandSource,style:new ol.style.Style({fill:new ol.style.Fill({color:'#173b46'}),stroke:new ol.style.Stroke({color:'#6e9ca4',width:.7})}),zIndex:0});
    const onlineOsm=new ol.layer.Tile({source:new ol.source.OSM(),opacity:.88,zIndex:1});
    navigationPlotSource=new ol.source.Vector();
    const vector=new ol.layer.Vector({source:navigationPlotSource,zIndex:2,style:feature=>feature.get('kind')==='route'
      ?new ol.style.Style({stroke:new ol.style.Stroke({color:'#ffcf66',width:4})})
      :new ol.style.Style({image:new ol.style.Circle({radius:8,fill:new ol.style.Fill({color:feature.get('kind')==='start'?'#55d6be':'#ff6b6b'}),stroke:new ol.style.Stroke({color:'#fff',width:2})}),text:new ol.style.Text({text:feature.get('label'),offsetY:-18,fill:new ol.style.Fill({color:'#fff'}),stroke:new ol.style.Stroke({color:'#071723',width:4})})})});
    navigationPlotMap=new ol.Map({target:'navigationPlotMap',layers:[offlineOcean,onlineOsm,vector],view:new ol.View({center:ol.proj.fromLonLat([18,36]),zoom:5,minZoom:2,maxZoom:18})});
    navigationPlotMap.addControl(new ol.control.ScaleLine({units:'nautical'}));
  }
  setTimeout(()=>{navigationPlotMap.updateSize();renderNavigationPlot()},80);
}
function downloadCalculatedRouteGpx(route){
  const gpx=window.SinbadRouteVisualizer.toGpx(route,{name:'Sinbad calculated DR route'}),url=URL.createObjectURL(new Blob([gpx],{type:'application/gpx+xml'}));
  const link=document.createElement('a');link.href=url;link.download='sinbad-calculated-route.gpx';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function openCalculatedRouteInOpenCpn(route,downloadOnFailure=false){
  const gpx=window.SinbadRouteVisualizer.toGpx(route,{name:'Sinbad calculated DR route'});
  try{
    const response=await fetch(`${SINBAD_BRIDGE_URL}/routes/open`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({filename:'sinbad-calculated-route.gpx',name:'Sinbad calculated DR route',gpx})});
    if(!response.ok)throw new Error(`Bridge returned ${response.status}`);
    const result=await response.json();
    if(result.importRequired)return {ok:true,message:`OpenCPN’yi güvenli biçimde açtım ve GPX rotasını kaydettim: ${result.path}. OpenCPN’de Route & Mark Manager → Import GPX ile bu dosyayı seçin. Otomatik aktarım için güvenli REST eşleştirmesi ayrıca kurulacak.`};
    return {ok:true,message:'Rotayı OpenCPN’ye aktardım. Başlangıç ile hesaplanan DR varış mevkii rota olarak gösteriliyor.'};
  }catch(error){
    if(downloadOnFailure){
      downloadCalculatedRouteGpx(route);
      return {ok:true,message:'OpenCPN yerel köprüsüne ulaşılamadı. GPX rota dosyasını indirdim; dosyayı OpenCPN ile açabilirsiniz.'};
    }
    return null;
  }
}
async function prepareNavigationPlotFromConversation(requestText=''){
  const route=window.SinbadRouteVisualizer?.routeFromConversation?.(sinbadState.messages,window.SinbadNavigation);
  if(!route)return {ok:false,message:'Çizilecek hesaplanmış bir seyir rotası bulamadım. Başlangıç mevkii, rota, sürat ve süreyi yazın.'};
  if(route.status!=='READY')return {ok:false,message:`Harita çizimi için eksik bilgiler: ${route.missing.join(', ')}.`};
  const explicitOpenCpn=window.SinbadRouteVisualizer?.isOpenCpnRequest?.(requestText)===true;
  const openCpnResult=await openCalculatedRouteInOpenCpn(route,explicitOpenCpn);
  if(openCpnResult)return openCpnResult;
  navigationPlotRoute=route;openWorkspace('navigation-plot');return {ok:true,message:'Seyir çizim sayfasını açtım. Başlangıç, varış ve rota hattı etkileşimli harita üzerinde gösteriliyor.'};
}
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
  chartSource.on('tileloaderror',()=>{if(!loaded){status.textContent='NOAA ENC layer is temporarily unavailable. Use “Open NOAA Viewer” or try again shortly.';status.classList.add('error')}});
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
    status.textContent='Reading your position…';status.classList.remove('error','ready');
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
  messages: JSON.parse(localStorage.getItem('atlas_sinbad_messages') || '[]'),
  voiceEnabled: localStorage.getItem('atlas_sinbad_voice') !== 'off',
  language: localStorage.getItem('atlas_sinbad_language') || 'tr-TR'
};
let pendingSinbadWebQuestion='';
const SINBAD_WEB_SEARCH_ENABLED=false;
const SINBAD_WEB_TEXT={
 'tr-TR':{ask:'Atlas Cloud hafızamda bu soruya yetecek bilgi yok. Herkese açık web kaynaklarında arama yapmama izin veriyor musunuz?',result:'Web arama sonucu',denied:'Web araması yapılmadı.'},
 'en-US':{ask:'My Atlas Cloud memory does not contain enough information. May I search public web sources?',result:'Web search result',denied:'The web search was not performed.'},
 'ru-RU':{ask:'В Atlas Cloud недостаточно информации. Разрешить поиск в открытых источниках?',result:'Результат веб-поиска',denied:'Веб-поиск не выполнен.'},
 'fr-FR':{ask:'Atlas Cloud ne contient pas assez d’informations. Autorisez-vous une recherche sur le web public ?',result:'Résultat de recherche web',denied:'La recherche web n’a pas été effectuée.'},
 'de-DE':{ask:'Atlas Cloud enthält nicht genügend Informationen. Darf ich im öffentlichen Web suchen?',result:'Web-Suchergebnis',denied:'Die Websuche wurde nicht durchgeführt.'},
 'ar-SA':{ask:'لا تحتوي ذاكرة Atlas Cloud على معلومات كافية. هل تسمح لي بالبحث في الويب العام؟',result:'نتيجة بحث الويب',denied:'لم يتم إجراء بحث على الويب.'},
 'es-ES':{ask:'Atlas Cloud no contiene suficiente información. ¿Permite buscar en la web pública?',result:'Resultado de búsqueda web',denied:'No se realizó la búsqueda web.'},
 'it-IT':{ask:'Atlas Cloud non contiene informazioni sufficienti. Autorizza la ricerca sul web pubblico?',result:'Risultato della ricerca web',denied:'La ricerca web non è stata eseguita.'}
};
function requestSinbadWebPermission(question){
  if(!SINBAD_WEB_SEARCH_ENABLED){
    pendingSinbadWebQuestion='';$('sinbadWebConsent')?.classList.add('hidden');
    return {'tr-TR':'Sinbad yalnızca onaylı Atlas Cloud denizcilik kütüphanesini kullanıyor. Bu konu için yeterli kaynak yok; ilgili kitabı veya belgeyi kütüphaneye yükleyin.','en-US':'Sinbad uses only the approved Atlas Cloud marine library. There is not enough material for this topic; upload the relevant book or document.','ru-RU':'Синбад использует только утверждённую морскую библиотеку Atlas Cloud. Загрузите соответствующую книгу или документ.','fr-FR':'Sinbad utilise uniquement la bibliothèque maritime Atlas Cloud approuvée. Chargez le livre ou document correspondant.','de-DE':'Sinbad verwendet nur die freigegebene Atlas-Cloud-Seefahrtsbibliothek. Laden Sie das passende Buch oder Dokument hoch.','ar-SA':'يستخدم سندباد مكتبة Atlas Cloud البحرية المعتمدة فقط. حمّل الكتاب أو الوثيقة ذات الصلة.','es-ES':'Sinbad usa únicamente la biblioteca marítima aprobada de Atlas Cloud. Cargue el libro o documento correspondiente.','it-IT':'Sinbad utilizza solo la biblioteca marittima Atlas Cloud approvata. Carichi il libro o documento pertinente.'}[sinbadState.language]||'Sinbad uses only the approved Atlas Cloud marine library. Upload the relevant source.';
  }
  pendingSinbadWebQuestion=question;const copy=SINBAD_WEB_TEXT[sinbadState.language]||SINBAD_WEB_TEXT['en-US'];$('sinbadWebConsentText').textContent=copy.ask;$('sinbadWebConsent').classList.remove('hidden');return copy.ask;
}

// ---- Captain Sinbad live assistant animation state machine ----
// Single, centralised, testable entry point for avatar state. Every state
// here is wired to a real application event (see setSinbadAssistantState
// call sites below) - none of them are shown ahead of the real event they
// represent. Visuals are the real illustrated Academy pack
// (assets/captain-sinbad/, ACADEMY_BEHAVIOR_MANIFEST_TR.md) - Claude does not
// redraw the character or imitate it with SVG geometry.
const SINBAD_ASSISTANT_STATES=['idle','listening','thinking','preparing-voice','speaking','laughing','walking','success','warning','error','voice-disabled','board-teaching'];
const SINBAD_ASSISTANT_STATE_LABELS={
 'tr-TR':{idle:'Hazır',listening:'Dinliyor',thinking:'Düşünüyor','preparing-voice':'Ses hazırlanıyor',speaking:'Konuşuyor',laughing:'Gülüyor',walking:'Yürüyor',success:'Tamamlandı',warning:'Dikkat',error:'Bağlantı sorunu','voice-disabled':'Ses kapalı','board-teaching':'Tahtada anlatıyor'},
 'en-US':{idle:'Ready',listening:'Listening',thinking:'Thinking','preparing-voice':'Preparing voice',speaking:'Speaking',laughing:'Laughing',walking:'Walking',success:'Done',warning:'Attention',error:'Connection issue','voice-disabled':'Voice off','board-teaching':'Teaching at the board'},
 'ru-RU':{idle:'Готов',listening:'Слушает',thinking:'Думает','preparing-voice':'Готовит голос',speaking:'Говорит',laughing:'Смеётся',walking:'Идёт',success:'Готово',warning:'Внимание',error:'Проблема связи','voice-disabled':'Звук выкл.','board-teaching':'Объясняет у доски'},
 'fr-FR':{idle:'Prêt',listening:'Écoute',thinking:'Réfléchit','preparing-voice':'Prépare la voix',speaking:'Parle',laughing:'Rit',walking:'Marche',success:'Terminé',warning:'Attention',error:'Problème de connexion','voice-disabled':'Voix coupée','board-teaching':'Explique au tableau'},
 'de-DE':{idle:'Bereit',listening:'Hört zu',thinking:'Denkt nach','preparing-voice':'Bereitet Stimme vor',speaking:'Spricht',laughing:'Lacht',walking:'Geht',success:'Fertig',warning:'Achtung',error:'Verbindungsproblem','voice-disabled':'Stimme aus','board-teaching':'Erklärt an der Tafel'},
 'ar-SA':{idle:'جاهز',listening:'يستمع',thinking:'يفكر','preparing-voice':'يجهز الصوت',speaking:'يتحدث',laughing:'يضحك',walking:'يمشي',success:'تم',warning:'تنبيه',error:'مشكلة اتصال','voice-disabled':'الصوت متوقف','board-teaching':'يشرح عند السبورة'},
 'es-ES':{idle:'Listo',listening:'Escuchando',thinking:'Pensando','preparing-voice':'Preparando voz',speaking:'Hablando',laughing:'Riendo',walking:'Caminando',success:'Hecho',warning:'Atención',error:'Problema de conexión','voice-disabled':'Voz apagada','board-teaching':'Explicando en la pizarra'},
 'it-IT':{idle:'Pronto',listening:'Ascolta',thinking:'Pensa','preparing-voice':'Prepara la voce',speaking:'Parla',laughing:'Ride',walking:'Cammina',success:'Fatto',warning:'Attenzione',error:'Problema di connessione','voice-disabled':'Voce disattivata','board-teaching':'Spiega alla lavagna'}
};
const SINBAD_THINKING_STAGE_LABELS={
 'tr-TR':{analyzing:'Soruyu analiz ediyor',calculating:'Hesaplıyor',retrieving:'Kaynaklara erişiyor',composing:'Yanıtı hazırlıyor'},
 'en-US':{analyzing:'Analyzing the question',calculating:'Calculating',retrieving:'Retrieving sources',composing:'Preparing the answer'},
 'ru-RU':{analyzing:'Анализирует вопрос',calculating:'Вычисляет',retrieving:'Ищет источники',composing:'Готовит ответ'},
 'fr-FR':{analyzing:'Analyse la question',calculating:'Calcule',retrieving:'Consulte les sources',composing:'Prépare la réponse'},
 'de-DE':{analyzing:'Analysiert die Frage',calculating:'Berechnet',retrieving:'Ruft Quellen ab',composing:'Bereitet die Antwort vor'},
 'ar-SA':{analyzing:'يحلل السؤال',calculating:'يجري الحساب',retrieving:'يسترجع المصادر',composing:'يجهز الإجابة'},
 'es-ES':{analyzing:'Analizando la pregunta',calculating:'Calculando',retrieving:'Consultando fuentes',composing:'Preparando la respuesta'},
 'it-IT':{analyzing:'Analizza la domanda',calculating:'Calcola',retrieving:'Consulta le fonti',composing:'Prepara la risposta'}
};
// Which real illustrated Academy asset represents each state. Several logical
// states (preparing-voice, success, warning, error, voice-disabled) do not yet
// have dedicated art in the v1 pack - they honestly fall back to the idle
// pose (closed mouth, neutral stance), matching what ACADEMY_BEHAVIOR_MANIFEST_TR.md
// itself specifies for those states ("preparing-voice: ağız kapalı", "voice-disabled:
// konuşma jesti yok", "success/warning/error: mevcut duruşun devamı + efekt").
// Distinct status colour/text still applies (see CSS + sinbadAvatarStatus label).
const SINBAD_AVATAR_ASSET_BASE='./assets/captain-sinbad/';
const SINBAD_BLINK_ASSET='captain-sinbad-idle-blink-v1.png';
const SINBAD_SPEECH_ASSETS=Object.freeze({closed:'captain-sinbad-speaking-mbp-v1.png',open:'captain-sinbad-speaking.png',round:'captain-sinbad-speaking-o-v1.png'});
const SINBAD_WALK_ASSETS=Object.freeze(['captain-sinbad-walk-a-v1.png','captain-sinbad-walk-b-v1.png']);
const SINBAD_STATE_ASSET={
  idle:'captain-sinbad-idle-master.png',
  listening:'captain-sinbad-listening.png',
  thinking:'captain-sinbad-thinking.png',
  'preparing-voice':'captain-sinbad-idle-master.png',
  speaking:'captain-sinbad-speaking.png',
  laughing:'captain-sinbad-laughing-v1.png',
  walking:SINBAD_WALK_ASSETS[0],
  success:'captain-sinbad-idle-master.png',
  warning:'captain-sinbad-idle-master.png',
  error:'captain-sinbad-idle-master.png',
  'voice-disabled':'captain-sinbad-idle-master.png',
  'board-teaching':'captain-sinbad-board-teaching.png'
};
let sinbadAssistantState='idle';
let sinbadAssistantTimers=[];
let sinbadAssistantLastDetail={};
const sinbadCharacterEngine=window.SinbadCharacterEngine?.createCharacterEngine({initialState:'idle'})||null;
const sinbadCharacterRig=window.SinbadCharacterRig||null;
const sinbadPerformanceDirector=window.SinbadPerformanceDirector||null;
let sinbadSpeechPerformanceMode='warm';
let sinbadResponseOpeningCue={gesture:'open-hand',gaze:'audience',emotion:'warm',energy:.36,responseKind:'conversation'};
function prepareSinbadSpeechPerformance(question){
  const decision=window.SinbadCore?.analyzeQuery?.(question)||{};
  sinbadSpeechPerformanceMode=sinbadPerformanceDirector?.speechModeForDecision(decision)||'warm';
}
function sinbadSpeechPerformanceCue(index){
  const sequence=sinbadSpeechPerformanceMode==='caution'?'speaking-caution':sinbadSpeechPerformanceMode==='instructional'?'speaking-instructional':'speaking';
  const result=sinbadPerformanceDirector?.cueAt(sequence,index);return result?.accepted?result.cue:{};
}
function sinbadSpeechBoundaryCue(boundaryEvent,text,index){
  const result=sinbadPerformanceDirector?.speechCueForBoundary({name:boundaryEvent?.name,charIndex:boundaryEvent?.charIndex,text,wordIndex:index,mode:sinbadSpeechPerformanceMode});
  return result?.accepted?result.cue:sinbadSpeechPerformanceCue(index);
}
function prepareSinbadResponsePerformance(text){
  const result=sinbadPerformanceDirector?.responseCueForText(text,sinbadSpeechPerformanceMode);
  sinbadResponseOpeningCue=result?.accepted?result.cue:{gesture:'hold',gaze:'audience',emotion:'concerned',energy:.24,responseKind:'blocked'};
  return sinbadResponseOpeningCue;
}
function setSinbadThinkingStage(stage){
  const result=sinbadPerformanceDirector?.thinkingCueForStage(stage);
  if(!result?.accepted)return false;
  return setSinbadAssistantState('thinking',{...result.cue,thinkingStage:stage});
}
function sinbadAssistantElements(){return document.querySelectorAll('.sinbad-avatar');}
function clearSinbadAssistantTimers(){sinbadAssistantTimers.forEach(clearTimeout);sinbadAssistantTimers=[];}
function preloadSinbadAvatarAssets(){
  const seen=new Set();
  Object.values(SINBAD_STATE_ASSET).forEach(file=>{
    if(seen.has(file))return;seen.add(file);
    const img=new Image();img.src=SINBAD_AVATAR_ASSET_BASE+file;
  });
  const blink=new Image();blink.src=SINBAD_AVATAR_ASSET_BASE+SINBAD_BLINK_ASSET;
  Object.values(SINBAD_SPEECH_ASSETS).forEach(file=>{const img=new Image();img.src=SINBAD_AVATAR_ASSET_BASE+file;});
  SINBAD_WALK_ASSETS.forEach(file=>{const img=new Image();img.src=SINBAD_AVATAR_ASSET_BASE+file;});
}
let sinbadBlinkTimer=null;
function sinbadBlinkAllowed(){
  return ['idle','voice-disabled','success','warning','error'].includes(sinbadAssistantState)
    &&document.visibilityState!=='hidden'
    &&!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    &&!document.documentElement.classList.contains('sinbad-force-reduced-motion');
}
function ensureSinbadBlinkLayers(){
  sinbadAssistantElements().forEach(el=>{
    if(el.querySelector('.sinbad-avatar-blink'))return;
    const blink=document.createElement('img');blink.className='sinbad-avatar-img sinbad-avatar-blink';
    blink.src=SINBAD_AVATAR_ASSET_BASE+SINBAD_BLINK_ASSET;blink.alt='';blink.setAttribute('aria-hidden','true');
    el.insertBefore(blink,el.querySelector('.sinbad-status-light'));
  });
}
function ensureSinbadSpeechLayers(){
  sinbadAssistantElements().forEach(el=>{
    for(const frame of ['closed','round']){
      if(el.querySelector(`.sinbad-avatar-mouth-${frame}`))continue;
      const img=document.createElement('img');img.className=`sinbad-avatar-img sinbad-avatar-mouth sinbad-avatar-mouth-${frame}`;
      img.src=SINBAD_AVATAR_ASSET_BASE+SINBAD_SPEECH_ASSETS[frame];img.alt='';img.setAttribute('aria-hidden','true');
      el.insertBefore(img,el.querySelector('.sinbad-status-light'));
    }
  });
}
function setSinbadMouthFrame(frame){
  const safe=sinbadAssistantState==='speaking'&&Object.hasOwn(SINBAD_SPEECH_ASSETS,frame)?frame:'closed';
  sinbadAssistantElements().forEach(el=>el.dataset.mouthFrame=safe);
}
function scheduleSinbadBlink(){
  clearTimeout(sinbadBlinkTimer);sinbadBlinkTimer=null;
  if(!sinbadBlinkAllowed())return;
  sinbadBlinkTimer=setTimeout(()=>{
    if(!sinbadBlinkAllowed())return;
    sinbadAssistantElements().forEach(el=>el.classList.add('sinbad-blinking'));
    setTimeout(()=>sinbadAssistantElements().forEach(el=>el.classList.remove('sinbad-blinking')),135);
    scheduleSinbadBlink();
  },3800+Math.floor(Math.random()*3200));
}
let sinbadLipSyncAudioContext=null,sinbadLipSyncAnalyser=null,sinbadLipSyncSource=null,sinbadLipSyncRaf=null;
function stopSinbadLipSyncAnalyser(){
  if(sinbadLipSyncRaf)cancelAnimationFrame(sinbadLipSyncRaf);
  sinbadLipSyncRaf=null;
  // Disconnect the previous turn's graph nodes explicitly - a Web Audio node
  // stays wired into the context (and reachable from `destination`) until
  // disconnected, regardless of whether any JS reference to it remains, so
  // skipping this across repeated speech turns leaks nodes on the shared
  // long-lived AudioContext.
  if(sinbadLipSyncSource){try{sinbadLipSyncSource.disconnect();}catch(_){/* already disconnected */}}
  if(sinbadLipSyncAnalyser){try{sinbadLipSyncAnalyser.disconnect();}catch(_){/* already disconnected */}}
  sinbadLipSyncSource=null;sinbadLipSyncAnalyser=null;
  sinbadAssistantElements().forEach(el=>el.style.removeProperty('--sinbad-voice-amp'));setSinbadMouthFrame('closed');
}
async function startSinbadLipSyncAnalyser(audio){
  // Never run two graphs/RAF loops at once, and never leak the previous
  // turn's source/analyser nodes into this one.
  stopSinbadLipSyncAnalyser();
  try{
    const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
    if(!sinbadLipSyncAudioContext)sinbadLipSyncAudioContext=new AC();
    if(sinbadLipSyncAudioContext.state==='suspended')await sinbadLipSyncAudioContext.resume();
    // If resume() did not actually bring the context to 'running' (blocked by
    // an autoplay policy, browser quirk, etc.) do NOT tap the <audio>
    // element: creating a MediaElementSource unconditionally reroutes ALL of
    // the element's output through the (possibly still-suspended) Web Audio
    // graph, which can silence real playback while the UI still says
    // "speaking". Bail out here and stay on the CSS-only lip-sync fallback -
    // audio keeps playing through its normal, untouched element path.
    if(sinbadLipSyncAudioContext.state!=='running')return;
    if(audio.paused||audio.ended)return; // playback already moved on while we awaited resume()
    const source=sinbadLipSyncAudioContext.createMediaElementSource(audio);
    const analyser=sinbadLipSyncAudioContext.createAnalyser();
    analyser.fftSize=256;
    source.connect(analyser);
    analyser.connect(sinbadLipSyncAudioContext.destination);
    sinbadLipSyncSource=source;sinbadLipSyncAnalyser=analyser;
    const data=new Uint8Array(analyser.frequencyBinCount);
    const tick=()=>{
      if(sinbadLipSyncAnalyser!==analyser||audio.paused||audio.ended){sinbadLipSyncRaf=null;return;}
      analyser.getByteFrequencyData(data);
      let sum=0;for(let i=0;i<data.length;i++)sum+=data[i];
      const amp=Math.min(1,(sum/data.length)/72);
      sinbadAssistantElements().forEach(el=>el.style.setProperty('--sinbad-voice-amp',amp.toFixed(3)));
      setSinbadMouthFrame(amp<.12?'closed':amp<.48?'open':'round');
      sinbadLipSyncRaf=requestAnimationFrame(tick);
    };
    tick();
  }catch(error){
    // Expected on browsers/contexts without Web Audio support, or if the
    // element graph cannot be tapped - the CSS-only fallback (a calm speaking
    // pulse driven purely by [data-state="speaking"]) still plays, and
    // playback audio itself is never affected because nothing here runs
    // before the real <audio> element already exists. The v1 Academy pack
    // has no separate mouth/phoneme layer yet (ACADEMY_BEHAVIOR_MANIFEST_TR.md
    // production step 2), so this amplitude drives a whole-portrait energy
    // cue rather than per-phoneme mouth shapes.
    console.warn('Sinbad lip-sync analyser unavailable; using CSS fallback',error);
  }
}
let sinbadAvatarImageGeneration=0;
function startSinbadWalkCycle(generation){
  if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||document.documentElement.classList.contains('sinbad-force-reduced-motion'))return;
  let frame=0;const tick=()=>{if(generation!==sinbadAvatarImageGeneration||sinbadAssistantState!=='walking')return;frame=(frame+1)%SINBAD_WALK_ASSETS.length;sinbadAssistantElements().forEach(el=>{const img=el.querySelector('.sinbad-avatar-img:not(.sinbad-avatar-blink):not(.sinbad-avatar-mouth)');if(img)img.src=SINBAD_AVATAR_ASSET_BASE+SINBAD_WALK_ASSETS[frame];});sinbadAssistantTimers.push(setTimeout(tick,280));};
  sinbadAssistantTimers.push(setTimeout(tick,280));
}
function setSinbadAssistantState(state,detail={}){
  const next=SINBAD_ASSISTANT_STATES.includes(state)?state:'idle';
  const performance=sinbadCharacterEngine?.setState(next,detail)?.snapshot||{state:next,emotion:'neutral',gesture:'rest',gaze:'audience'};
  const changed=next!==sinbadAssistantState;
  sinbadAssistantState=next;
  sinbadAssistantLastDetail=detail||{};
  clearSinbadAssistantTimers();
  const asset=SINBAD_STATE_ASSET[next]||SINBAD_STATE_ASSET.idle;
  const src=SINBAD_AVATAR_ASSET_BASE+asset;
  // A generation token so a slow/stale image load from an earlier state
  // change can never reveal itself (via opacity) once a newer state change
  // has already superseded it.
  const generation=++sinbadAvatarImageGeneration;
  sinbadAssistantElements().forEach(el=>{
    el.dataset.state=next;
    el.dataset.emotion=performance.emotion;
    el.dataset.gesture=performance.gesture;
    el.dataset.gaze=performance.gaze;
    if(next==='listening'&&detail.listeningActivity)el.dataset.listeningActivity=detail.listeningActivity;
    else delete el.dataset.listeningActivity;
    if(next==='thinking'&&detail.thinkingStage)el.dataset.thinkingStage=detail.thinkingStage;
    else delete el.dataset.thinkingStage;
    const defaultEnergy=sinbadCharacterRig?.STATE_POSES[next]?.energy??0;
    const requestedEnergy=Number(detail.energy??defaultEnergy);
    const rigPose=sinbadCharacterRig?.poseForState(next,{energy:Math.max(0,Math.min(1,Number.isFinite(requestedEnergy)?requestedEnergy:defaultEnergy))});
    const rigCss=rigPose?.accepted?sinbadCharacterRig.cssVariables(rigPose.controls):null;
    if(rigCss?.accepted)Object.entries(rigCss.variables).forEach(([name,value])=>el.style.setProperty(name,value));
    const img=el.querySelector('.sinbad-avatar-img');
    if(img&&!img.src.endsWith(asset)){
      img.style.opacity='0';
      img.onload=()=>{if(generation===sinbadAvatarImageGeneration)img.style.opacity='1';};
      img.src=src;
    }
  });
  if('reducedMotion' in (detail||{}))document.documentElement.classList.toggle('sinbad-force-reduced-motion',detail.reducedMotion===true);
  if(next!=='speaking')stopSinbadLipSyncAnalyser();
  else setSinbadMouthFrame('closed');
  const copy=SINBAD_ASSISTANT_STATE_LABELS[sinbadState.language]||SINBAD_ASSISTANT_STATE_LABELS['en-US'];
  const label=$('sinbadAvatarStatus');
  const thinkingCopy=SINBAD_THINKING_STAGE_LABELS[sinbadState.language]||SINBAD_THINKING_STAGE_LABELS['en-US'];
  const statusText=next==='thinking'&&thinkingCopy[detail.thinkingStage]?thinkingCopy[detail.thinkingStage]:(copy[next]||next);
  if(label&&(changed||next==='thinking'))label.textContent=statusText;
  const floatButton=$('sinbadFloat');
  if(floatButton)floatButton.setAttribute('aria-label',`Open Captain Sinbad — ${statusText}`);
  if(next==='success')sinbadAssistantTimers.push(setTimeout(()=>{if(sinbadAssistantState==='success')setSinbadAssistantState('idle');},2200));
  if(next==='laughing')sinbadAssistantTimers.push(setTimeout(()=>{if(sinbadAssistantState==='laughing')setSinbadAssistantState(sinbadState.voiceEnabled?'idle':'voice-disabled');},1250));
  if(next==='walking'){startSinbadWalkCycle(generation);sinbadAssistantTimers.push(setTimeout(()=>{if(sinbadAssistantState==='walking')setSinbadAssistantState(sinbadState.voiceEnabled?'idle':'voice-disabled');},2240));}
  if(next==='warning')sinbadAssistantTimers.push(setTimeout(()=>{if(sinbadAssistantState==='warning')setSinbadAssistantState('idle');},4200));
  if(next==='error')sinbadAssistantTimers.push(setTimeout(()=>{if(sinbadAssistantState==='error')setSinbadAssistantState(sinbadState.voiceEnabled?'idle':'voice-disabled');},6000));
  scheduleSinbadBlink();
  return next;
}
window.SinbadCharacterController=Object.freeze({
  react(action){
    if(!['laugh','walk'].includes(action))return Object.freeze({accepted:false,reason:'UNKNOWN_REACTION'});
    if(action==='walk'&&!['idle','voice-disabled'].includes(sinbadAssistantState))return Object.freeze({accepted:false,reason:'CHARACTER_BUSY'});
    const event=action==='walk'?'WALK':'LAUGH',state=action==='walk'?'walking':'laughing';const result=sinbadCharacterEngine?.dispatch(event);
    if(!result?.accepted)return Object.freeze({accepted:false,reason:result?.reason||'CHARACTER_ENGINE_UNAVAILABLE'});
    setSinbadAssistantState(state);return Object.freeze({accepted:true,state});
  }
});
ensureSinbadBlinkLayers();ensureSinbadSpeechLayers();scheduleSinbadBlink();
preloadSinbadAvatarAssets();
if(typeof document!=='undefined'&&'visibilityState'in document){
  document.addEventListener('visibilitychange',()=>{
    document.documentElement.classList.toggle('sinbad-tab-hidden',document.visibilityState==='hidden');
    scheduleSinbadBlink();
  },{passive:true});
}

function setSinbadVoiceUI(){
  const button=$('toggleSinbadVoice');if(!button)return;
  button.textContent=sinbadState.voiceEnabled?'🔊 Voice: On':'🔇 Voice: Off';
  button.setAttribute('aria-pressed',String(sinbadState.voiceEnabled));
}
const SINBAD_ENGLISH_WORDS=new Set(['the','a','an','and','or','for','with','is','are','you','your','this','that','can','will','please','from','have','has','not','use','using','check','safety','route','chart','course','wind','weather','forecast','notice','mariners','waypoint','knots','bearing','captain','system','online','offline','welcome','update','report','status','warning','alert','engine','fuel','crew','port','starboard','bridge','log','logbook','signal','emergency','distress','mayday','over','out','copy','roger','standby','ahead','astern','anchor','depart','arrival','eta','etd']);
function detectRunLanguage(token,fallbackLang,currentLang){
  const hasTurkishChars=/[çğıöşüÇĞİÖŞÜ]/.test(token);
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
  // Deliberately no cross-language fallback here: returning an English voice
  // for a Turkish (or any other) run would silently mispronounce the text.
  // Callers must handle a null result explicitly (surface it, don't guess).
  const root=lang.split('-')[0].toLowerCase();
  return voices.find(v=>v.lang.toLowerCase()===lang.toLowerCase())||voices.find(v=>v.lang.toLowerCase().startsWith(root))||null;
}
// Academy speech is deliberately calmer than a screen reader. Keep the
// profile language-aware so English is never spoken with the Turkish voice
// (and vice versa), while both retain a measured teaching cadence.
const SINBAD_VOICE_PROFILES=Object.freeze({
  tr:{rate:.82,pitch:.91,volume:1},
  en:{rate:.86,pitch:.96,volume:1},
  default:{rate:.84,pitch:.94,volume:1}
});
const SINBAD_SPOKEN_SUMMARY_MAX_SENTENCES=6;
const SINBAD_SPOKEN_SUMMARY_MAX_WORDS=110;
let sinbadModelSpokenSummary='';
function sinbadVoiceProfileForLanguage(lang=''){
  return SINBAD_VOICE_PROFILES[lang.toLowerCase().split('-')[0]]||SINBAD_VOICE_PROFILES.default;
}
function stripSinbadSpeechMarkup(text){
  return String(text||'')
    .replace(/```[\s\S]*?```/g,' ')
    .replace(/`([^`]+)`/g,'$1')
    .replace(/\[S\d+\]/gi,' ')
    .replace(/https?:\/\/\S+/gi,' ')
    .replace(/^#{1,6}\s+/gm,'')
    .replace(/^\s*[-*•]\s+/gm,'')
    .replace(/[>*_]/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}
function sinbadSpeechSentences(text){
  return stripSinbadSpeechMarkup(text).match(/[^.!?…]+[.!?…]+|[^.!?…]+$/gu)?.map(part=>part.trim()).filter(Boolean)||[];
}
function sinbadSentenceWordCount(sentence){return sentence.split(/\s+/u).filter(Boolean).length;}
function buildSinbadSpokenSummary(text,{maxSentences=SINBAD_SPOKEN_SUMMARY_MAX_SENTENCES,maxWords=SINBAD_SPOKEN_SUMMARY_MAX_WORDS}={}){
  const sentences=sinbadSpeechSentences(text);
  if(!sentences.length)return '';
  const chosen=[];
  let words=0;
  // Offline/retrieval-only fallback: select complete teaching points and
  // prioritize safety guidance. Never clip a sentence at a character limit.
  const safety=/\b(dikkat|uyar[ıi]|önemli|emniyet|güvenlik|risk|kural|doğrula|kontrol|must|important|warning|safety|risk|verify|check)\b/iu;
  const candidates=[sentences[0],...sentences.slice(1).filter(sentence=>safety.test(sentence)),...sentences.slice(1)];
  for(const sentence of candidates){
    if(chosen.includes(sentence))continue;
    const count=sinbadSentenceWordCount(sentence);
    if(chosen.length&&(words+count>maxWords||chosen.length>=maxSentences))continue;
    chosen.push(sentence);words+=count;
    if(words>=maxWords||chosen.length>=maxSentences)break;
  }
  // A single complete sentence may exceed the preferred word budget. Keep it
  // intact: coherent teaching is more important than a blind hard cut.
  return chosen.join(' ');
}
function selectSinbadSpokenText(answer,modelSummary=''){
  const supplied=stripSinbadSpeechMarkup(modelSummary);
  const suppliedSentences=sinbadSpeechSentences(supplied);
  const suppliedWords=sinbadSentenceWordCount(supplied);
  if(supplied&&suppliedSentences.length>=2&&suppliedSentences.length<=8&&suppliedWords>=20&&suppliedWords<=150)return supplied;
  return buildSinbadSpokenSummary(answer);
}
function detectSinbadSpeechLanguage(text,fallbackLang){
  const sample=String(text).toLowerCase();
  if(/[\u0400-\u04ff]/u.test(sample))return fallbackLang?.startsWith('ru')?fallbackLang:'ru-RU';
  if(/[\u0600-\u06ff]/u.test(sample))return fallbackLang?.startsWith('ar')?fallbackLang:'ar-SA';
  const trScore=(sample.match(/[\u00e7\u011f\u0131\u00f6\u015f\u00fc]/gu)||[]).length+(sample.match(/\b(bir|bu|ve|ile|için|olarak|deniz|gemi|gelgit|nedir|nasıl)\b/gu)||[]).length*2;
  const enScore=(sample.match(/\b(the|and|with|for|from|this|that|tide|ship|sea|water|is|are|how|why)\b/gu)||[]).length*2;
  if(enScore>trScore+1)return 'en-US';
  if(trScore>enScore+1)return 'tr-TR';
  return fallbackLang||'en-US';
}
function splitSinbadTeachingSpeech(text,fallbackLang){
  const sentences=String(text).match(/[^.!?…]+[.!?…]+|[^.!?…]+$/gu)||[String(text)];
  const teachingRuns=[];
  sentences.forEach((sentence,sentenceIndex)=>{
    const sentenceLang=detectSinbadSpeechLanguage(sentence,fallbackLang);
    const languageRuns=splitSpeechByLanguage(sentence.trim(),sentenceLang);
    languageRuns.forEach((run,runIndex)=>teachingRuns.push({
      text:run.text.trim(),
      lang:run.lang,
      // Pause only at a sentence boundary, never between two language runs
      // belonging to the same sentence (for example “gelgit / spring tide”).
      pauseAfter:runIndex===languageRuns.length-1&&sentenceIndex<sentences.length-1?360:0
    }));
  });
  return teachingRuns.filter(item=>item.text);
}
function sinbadNoVoiceMessage(lang,textMode=false){
  const root=String(lang||'').toLowerCase().split('-')[0];
  const name={tr:'Türkçe',en:'English',ru:'Русский',fr:'Français',de:'Deutsch',ar:'العربية',es:'Español',it:'Italiano'}[root]||lang||'Selected language';
  return textMode?`${name} sesi bulunamadı · metin modunda devam ediliyor`:`${name} sesi bulunamadı`;
}
function pickSinbadTurkishVoice(voices){
  const trVoices=voices.filter(v=>v.lang.toLowerCase()==='tr-tr'||v.lang.toLowerCase().startsWith('tr'));
  if(!trVoices.length)return null;
  // Best-effort warmer/male-leaning preference by voice name - the Web
  // Speech API exposes no gender field, so this is a name heuristic only,
  // not a guarantee. Falls back to any tr-TR voice rather than guessing wrong.
  const preferred=/tolga|ahmet|mehmet|emre|burak|kaan|ali|erkek|male/i;
  const avoid=/yelda|filiz|kad[ıi]n|female/i;
  return trVoices.find(v=>preferred.test(v.name))||trVoices.find(v=>!avoid.test(v.name))||trVoices[0];
}
let sinbadVoiceAudio=null;
let sinbadVoiceObjectUrl='';
let sinbadVoiceAbort=null;
// The single idempotent end-of-turn path for both voice providers. Always
// resolves the avatar out of thinking/preparing-voice/speaking - never
// leaves it stuck on an early return, error, or timeout. `forceState` lets a
// caller pick a specific transient outcome (e.g. 'warning' for "no suitable
// voice this turn"); otherwise it falls back to the real persistent voice
// preference so a transient hiccup never misrepresents that preference.
function finishSinbadVoice(forceState){
  if(sinbadVoiceObjectUrl)URL.revokeObjectURL(sinbadVoiceObjectUrl);
  sinbadVoiceObjectUrl='';sinbadVoiceAudio=null;sinbadVoiceAbort=null;
  sinbadAwaitingAnswer=false;
  setSinbadAssistantState(forceState||(sinbadState.voiceEnabled?'idle':'voice-disabled'));
  scheduleSinbadListening();
}
function stopSinbadVoice(){
  sinbadStandardSpeechGeneration++;
  sinbadVoiceAbort?.abort();sinbadVoiceAbort=null;
  if(sinbadVoiceAudio){sinbadVoiceAudio.pause();sinbadVoiceAudio.src='';}
  if(sinbadVoiceObjectUrl)URL.revokeObjectURL(sinbadVoiceObjectUrl);
  sinbadVoiceObjectUrl='';sinbadVoiceAudio=null;
  window.speechSynthesis?.cancel();
  if(sinbadAssistantState==='speaking'||sinbadAssistantState==='preparing-voice')setSinbadAssistantState(sinbadState.voiceEnabled?'idle':'voice-disabled');
}
let sinbadStandardBoundaryTimer=null;
let sinbadStandardMouthSequence=0;
function sinbadStandardVoiceTick(boundaryEvent,spokenText){
  sinbadAssistantElements().forEach(el=>el.classList.add('sinbad-voice-tick'));
  setSinbadMouthFrame(++sinbadStandardMouthSequence%3===0?'round':'open');
  const performanceCue=sinbadSpeechBoundaryCue(boundaryEvent,spokenText,sinbadStandardMouthSequence-1);
  if(performanceCue.gesture&&sinbadAssistantState==='speaking')sinbadAssistantElements().forEach(el=>{
    el.dataset.gesture=performanceCue.gesture;el.dataset.gaze=performanceCue.gaze;el.dataset.emotion=performanceCue.emotion||'warm';
    el.dataset.speechBoundary=performanceCue.cadence||'word';
  });
  clearTimeout(sinbadStandardBoundaryTimer);
  sinbadStandardBoundaryTimer=setTimeout(()=>{sinbadAssistantElements().forEach(el=>el.classList.remove('sinbad-voice-tick'));setSinbadMouthFrame('closed');},160);
}
// Default voice provider: low-latency browser speechSynthesis ('standard').
// speakSinbadXttsClone (GPU-dependent Yasemin voice clone) is kept fully
// functional below as an optional provider for later - not deleted, not
// wired as default. Both providers are called through speakSinbad() below,
// which is the single entry point every existing call site already uses.
// Bumped once per call so a stale earlier call (still waiting on a timer or
// a 'voiceschanged' event) can recognize a newer call has taken over and
// stop touching shared state/UI - never let an old request finish over a
// newer one.
let sinbadStandardSpeechGeneration=0;
function speakSinbadStandard(text,onVoiceReady){
  const myGeneration=++sinbadStandardSpeechGeneration;
  let announced=false;
  const announce=()=>{if(!announced){announced=true;onVoiceReady?.();}};
  const status=$('sinbadKnowledgeStatus');
  if(!sinbadState.voiceEnabled||!('speechSynthesis'in window)){announce();finishSinbadVoice();return;}
  const voices=speechSynthesis.getVoices();
  if(!voices.length){
    let settled=false;
    let voiceWaitTimer;
    const onVoicesChanged=()=>{
      if(myGeneration!==sinbadStandardSpeechGeneration||settled||!speechSynthesis.getVoices().length)return; // stale call or still-empty list
      settled=true;
      clearTimeout(voiceWaitTimer);
      speechSynthesis.removeEventListener('voiceschanged',onVoicesChanged);
      speakSinbadStandard(text,onVoiceReady);
    };
    voiceWaitTimer=setTimeout(()=>{
      if(myGeneration!==sinbadStandardSpeechGeneration||settled)return;
      settled=true;
      speechSynthesis.removeEventListener('voiceschanged',onVoicesChanged);
      // No suitable voice for this turn - a transient work-status, not a
      // change to the user's persistent voice preference, so this resolves
      // to 'warning' (auto-clears) rather than 'voice-disabled'.
      if(status)status.textContent=sinbadNoVoiceMessage(sinbadState.language,true);
      announce();
      finishSinbadVoice('warning');
    },1500);
    speechSynthesis.addEventListener('voiceschanged',onVoicesChanged);
    return;
  }
  if(sinbadIsListening)sinbadRecognition?.stop();
  speechSynthesis.cancel();
  setSinbadAssistantState('preparing-voice',sinbadResponseOpeningCue);
  const cleanText=selectSinbadSpokenText(text,sinbadModelSpokenSummary);
  sinbadModelSpokenSummary='';
  if(!cleanText){announce();finishSinbadVoice();return;}
  const runs=splitSinbadTeachingSpeech(cleanText,sinbadState.language);
  let index=0;
  let anyVoiceQueued=false;
  const speakNext=()=>{
    if(myGeneration!==sinbadStandardSpeechGeneration)return; // a newer speak request has taken over
    if(index>=runs.length){
      if(!anyVoiceQueued){
        if(status)status.textContent=sinbadNoVoiceMessage(sinbadState.language,true);
        announce();
        finishSinbadVoice('warning');
      }else{
        if(status)status.textContent='';
        finishSinbadVoice();
      }
      return;
    }
    const run=runs[index++];
    const isTurkish=run.lang.toLowerCase().startsWith('tr');
    const voice=isTurkish?pickSinbadTurkishVoice(voices):pickVoiceForLang(voices,run.lang);
    if(!voice){
      // No silent fallback to a mismatched-language system voice: skip this
      // run's audio, surface it plainly, still deliver the text answer.
      if(status)status.textContent=sinbadNoVoiceMessage(run.lang);
      announce();
      speakNext();
      return;
    }
    anyVoiceQueued=true;
    const utterance=new SpeechSynthesisUtterance(run.text);
    utterance.voice=voice;
    utterance.lang=voice.lang;
    const profile=sinbadVoiceProfileForLanguage(run.lang);
    utterance.rate=profile.rate;utterance.pitch=profile.pitch;utterance.volume=profile.volume;
    // Only the real 'speaking has actually started' signal flips the avatar -
    // never the moment we merely queued/prepared the utterance.
    utterance.onstart=()=>{if(myGeneration!==sinbadStandardSpeechGeneration)return;announce();setSinbadAssistantState('speaking',sinbadResponseOpeningCue);};
    utterance.onboundary=event=>{if(myGeneration===sinbadStandardSpeechGeneration)sinbadStandardVoiceTick(event,run.text);};
    utterance.onend=()=>{
      if(myGeneration!==sinbadStandardSpeechGeneration)return;
      if(run.pauseAfter)setTimeout(speakNext,run.pauseAfter);
      else speakNext();
    };
    utterance.onerror=()=>{
      if(myGeneration!==sinbadStandardSpeechGeneration)return;
      if(status)status.textContent='Standart ses okunamadı';
      speakNext();
    };
    speechSynthesis.speak(utterance);
  };
  speakNext();
  return true;
}
function splitSinbadCloneChunks(text,maxLength=220){
  const sentences=String(text).match(/[^.!?…]+[.!?…]?/gu)||[String(text)];
  const chunks=[];
  for(const sentence of sentences){
    const clean=sentence.trim();if(!clean)continue;
    if(clean.length<=maxLength){chunks.push(clean);continue;}
    let chunk='';
    for(const word of clean.split(/\s+/)){
      if(chunk&&`${chunk} ${word}`.length>maxLength){chunks.push(chunk);chunk=word;}
      else chunk=chunk?`${chunk} ${word}`:word;
    }
    if(chunk)chunks.push(chunk);
  }
  return chunks;
}
function playSinbadCloneBlob(blob,controller){
  return new Promise((resolve,reject)=>{
    if(sinbadVoiceObjectUrl)URL.revokeObjectURL(sinbadVoiceObjectUrl);
    const objectUrl=URL.createObjectURL(blob);
    sinbadVoiceObjectUrl=objectUrl;
    const audio=new Audio(objectUrl);sinbadVoiceAudio=audio;
    audio.preservesPitch=false;audio.playbackRate=1.04;audio.volume=.92;
    const cleanup=()=>{
      if(sinbadVoiceAudio===audio)sinbadVoiceAudio=null;
      URL.revokeObjectURL(objectUrl);
      if(sinbadVoiceObjectUrl===objectUrl)sinbadVoiceObjectUrl='';
      stopSinbadLipSyncAnalyser();
    };
    // 'playing' fires only once audio is actually producing sound - this is
    // the real signal the task requires, not the fetch/announce moment.
    audio.addEventListener('playing',()=>{
      if(sinbadVoiceAbort!==controller)return;
      setSinbadAssistantState('speaking',sinbadResponseOpeningCue);
      startSinbadLipSyncAnalyser(audio);
    },{once:true});
    audio.onended=()=>{cleanup();resolve();};
    audio.onerror=()=>{cleanup();reject(new Error('XTTS cloned audio playback failed'));};
    controller.signal.addEventListener('abort',()=>{audio.pause();audio.src='';cleanup();resolve();},{once:true});
    audio.play().catch(error=>{cleanup();reject(error);});
  });
}
// Optional GPU-dependent clone-voice provider. Kept fully functional per the
// architecture decision (not deleted), but not the active default - see
// sinbadVoiceProvider below. UI-facing status text is deliberately generic
// ("klon ses"), no voice-clone identity is named in the interface.
async function speakSinbadXttsClone(text,onVoiceReady){
  let announced=false;
  const announce=()=>{if(!announced){announced=true;onVoiceReady?.();}};
  if(!sinbadState.voiceEnabled){announce();finishSinbadVoice();return;}
  if(sinbadIsListening)sinbadRecognition?.stop();
  stopSinbadVoice();
  const cleanText=String(text).replace(/[•*_#]/g,' ').trim();
  if(!cleanText){finishSinbadVoice();return;}
  const chunks=splitSinbadCloneChunks(cleanText);
  const status=$('sinbadKnowledgeStatus');
  const controller=new AbortController();sinbadVoiceAbort=controller;
  setSinbadAssistantState('preparing-voice',sinbadResponseOpeningCue);
  let timedOut=false;
  const loadChunk=async index=>{
    const timeout=setTimeout(()=>{timedOut=true;controller.abort();},150000);
    try{
      const response=await fetch(`${SINBAD_BRIDGE_URL}/ai/tts`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:chunks[index],language:sinbadState.language}),signal:controller.signal});
      if(!response.ok)throw new Error(`XTTS returned ${response.status}: ${await response.text()}`);
      const blob=await response.blob();
      if(!blob.size)throw new Error('XTTS returned empty audio');
      return blob;
    }finally{clearTimeout(timeout);}
  };
  try{
    let pendingChunk=loadChunk(0);
    for(let index=0;index<chunks.length;index++){
      if(sinbadVoiceAbort!==controller)return;
      if(status)status.textContent=`Klon ses hazırlanıyor · ${index+1}/${chunks.length}`;
      const blob=await pendingChunk;
      if(sinbadVoiceAbort!==controller)return;
      pendingChunk=index+1<chunks.length?loadChunk(index+1):null;
      if(status)status.textContent=`Klon ses aktif · ${index+1}/${chunks.length}`;
      announce();
      await playSinbadCloneBlob(blob,controller);
    }
    if(sinbadVoiceAbort===controller)finishSinbadVoice();
  }catch(error){
    if(sinbadVoiceAbort!==controller)return;
    if(error?.name==='AbortError'&&!timedOut)return;
    console.warn('Sinbad XTTS clone unavailable',error);
    setSinbadAssistantState('error');
    announce();stopSinbadVoice();
    if(status)status.textContent=timedOut?'Klon ses zaman aşımına uğradı':'Klon ses üretilemedi';
    sinbadAwaitingAnswer=false;scheduleSinbadListening();
  }
}
// Provider switch: 'standard' (default, low-latency browser TTS) or
// 'xtts-clone' (optional, GPU-dependent, manual opt-in only - not exposed in
// the UI). Both providers share the exact same (text, onVoiceReady) call
// shape and the exact same setSinbadAssistantState event contract, so
// switching providers never requires touching a call site or the animation
// wiring.
let sinbadVoiceProvider='standard';
function speakSinbad(text,onVoiceReady){
  prepareSinbadResponsePerformance(text);
  if(sinbadVoiceProvider==='xtts-clone')return speakSinbadXttsClone(text,onVoiceReady);
  return speakSinbadStandard(text,onVoiceReady);
}
let sinbadRecognition=null;
let sinbadIsListening=false;
let sinbadHandsFreeEnabled=false;
let sinbadWakeActive=false;
let sinbadAwaitingAnswer=false;
let sinbadRestartTimer=null;
const SINBAD_SPEECH_TEXT={
 'tr-TR':{listen:'Dinliyorum… Konuşabilirsiniz.',ready:'🎙️ Sinbad’a Konuş',stop:'⏹ Dinlemeyi Durdur',heard:'Sizi duydum. Sorunuz gönderiliyor…',unsupported:'Bu tarayıcı sesli soru özelliğini desteklemiyor. iPhone/iPad’de güncel Safari, Android’de güncel Chrome kullanın.',denied:'Mikrofon izni verilmedi. Tarayıcı adres çubuğundaki izinlerden mikrofonu açın.',test:'Ses açık Kaptan. Sizi dinlemeye hazırım.'},
 'en-US':{listen:'Listening… You may speak.',ready:'🎙️ Speak to Sinbad',stop:'⏹ Stop listening',heard:'I heard you. Sending your question…',unsupported:'This browser does not support voice questions. Use current Safari on iPhone/iPad or current Chrome on Android.',denied:'Microphone permission was not granted. Enable it in the browser site permissions.',test:'Voice is on, Captain. I am ready to listen.'},
 'ru-RU':{listen:'Слушаю… Говорите.',ready:'🎙️ Говорить с Синбадом',stop:'⏹ Остановить',heard:'Я вас услышал. Отправляю вопрос…',unsupported:'Этот браузер не поддерживает голосовые вопросы.',denied:'Нет разрешения на микрофон.',test:'Голос включён, капитан. Я готов слушать.'},
 'fr-FR':{listen:'Je vous écoute… Parlez.',ready:'🎙️ Parler à Sinbad',stop:'⏹ Arrêter',heard:'Je vous ai entendu. Envoi de la question…',unsupported:'Ce navigateur ne prend pas en charge les questions vocales.',denied:'L’autorisation du microphone est refusée.',test:'La voix est active, Capitaine. Je vous écoute.'},
 'de-DE':{listen:'Ich höre zu… Sprechen Sie.',ready:'🎙️ Mit Sinbad sprechen',stop:'⏹ Zuhören beenden',heard:'Ich habe Sie gehört. Die Frage wird gesendet…',unsupported:'Dieser Browser unterstützt keine Sprachfragen.',denied:'Die Mikrofonberechtigung wurde nicht erteilt.',test:'Die Stimme ist aktiv, Kapitän. Ich höre zu.'},
 'ar-SA':{listen:'أنا أستمع… تكلّم الآن.',ready:'🎙️ تحدث إلى سندباد',stop:'⏹ إيقاف الاستماع',heard:'سمعتك. يتم إرسال السؤال…',unsupported:'هذا المتصفح لا يدعم الأسئلة الصوتية.',denied:'لم يتم السماح باستخدام الميكروفون.',test:'الصوت يعمل أيها القبطان. أنا مستعد للاستماع.'},
 'es-ES':{listen:'Escuchando… Puede hablar.',ready:'🎙️ Hablar con Sinbad',stop:'⏹ Dejar de escuchar',heard:'Le he oído. Enviando la pregunta…',unsupported:'Este navegador no admite preguntas de voz.',denied:'No se concedió permiso para el micrófono.',test:'La voz está activa, Capitán. Estoy listo para escuchar.'},
 'it-IT':{listen:'Ti ascolto… Puoi parlare.',ready:'🎙️ Parla con Sinbad',stop:'⏹ Ferma ascolto',heard:'Ti ho sentito. Invio della domanda…',unsupported:'Questo browser non supporta le domande vocali.',denied:'Il permesso del microfono non è stato concesso.',test:'La voce è attiva, Capitano. Sono pronto ad ascoltare.'}
};
function speechCopy(){return SINBAD_SPEECH_TEXT[sinbadState.language]||SINBAD_SPEECH_TEXT['en-US'];}
function handsFreeMessage(){return {'tr-TR':'Eller serbest açık — “Hey Sinbad” deyin.','en-US':'Hands-free active — say “Hey Sinbad”.','ru-RU':'Режим без рук включён — скажите «Hey Sinbad».','fr-FR':'Mode mains libres actif — dites «Hey Sinbad».','de-DE':'Freisprechen aktiv — sagen Sie „Hey Sinbad“.','ar-SA':'وضع التحدث الحر نشط — قل «Hey Sinbad».','es-ES':'Modo manos libres activo — diga «Hey Sinbad».','it-IT':'Modalità vivavoce attiva — dica «Hey Sinbad».'}[sinbadState.language]||'Hands-free active — say “Hey Sinbad”.';}
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
  const recognition=sinbadRecognition;
  let finalTranscript='';
  let listeningProgressBucket=-1;
  const listeningCue=(activity,revision=0)=>{if(sinbadRecognition!==recognition)return;const cue=sinbadPerformanceDirector?.listeningCueForActivity(activity,revision);setSinbadAssistantState('listening',{...(cue?.accepted?cue.cue:{}),listeningActivity:activity});};
  sinbadRecognition.onstart=()=>{if(sinbadRecognition!==recognition)return;sinbadIsListening=true;setListeningUI(sinbadWakeActive?speechCopy().listen:handsFreeMessage(),true);listeningCue('ready');};
  sinbadRecognition.onsoundstart=()=>listeningCue('sound');
  sinbadRecognition.onspeechstart=()=>listeningCue('speech');
  sinbadRecognition.onspeechend=()=>listeningCue('pause');
  sinbadRecognition.onresult=event=>{if(sinbadRecognition!==recognition)return;let interim='',hasFinal=false;for(let i=event.resultIndex;i<event.results.length;i++){const part=event.results[i][0].transcript;if(event.results[i].isFinal){finalTranscript+=part;hasFinal=true;}else interim+=part;}const heardSoFar=(finalTranscript||interim).trim();$('sinbadInput').value=heardSoFar;const progressBucket=Math.floor(heardSoFar.length/12);if(hasFinal)listeningCue('processed',progressBucket);else if(progressBucket>listeningProgressBucket){listeningProgressBucket=progressBucket;listeningCue('interim',progressBucket);}};
  sinbadRecognition.onerror=event=>{if(sinbadRecognition!==recognition)return;sinbadIsListening=false;if(event.error==='not-allowed'||event.error==='service-not-allowed'){sinbadHandsFreeEnabled=false;setListeningUI(speechCopy().denied,true);return;}if(!['no-speech','aborted'].includes(event.error))setListeningUI(`Microphone: ${event.error}`,true);};
  sinbadRecognition.onend=()=>{
    if(sinbadRecognition!==recognition)return;
    sinbadRecognition=null;
    sinbadIsListening=false;const heard=finalTranscript.trim();
    const wakeMatch=heard.match(/(?:hey|hei|hej|эй|يا)?\s*(?:sinbad|sindbad|simbad)/iu);
    let command='';
    if(wakeMatch){sinbadWakeActive=true;command=heard.slice((wakeMatch.index||0)+wakeMatch[0].length).replace(/^[,.:;!?\s-]+/,'').trim();}
    else if(sinbadWakeActive)command=heard;
    if(command){sinbadWakeActive=false;sinbadAwaitingAnswer=true;$('sinbadInput').value=command;setListeningUI(speechCopy().heard,true);setTimeout(()=>sendToSinbad(command),250);}
    else {if(wakeMatch)setListeningUI(speechCopy().listen,true);else $('sinbadInput').value='';if(sinbadAssistantState==='listening')setSinbadAssistantState('idle');scheduleSinbadListening(wakeMatch?150:500);}
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
function sinbadVisualCards(visuals=[]){
  if(!Array.isArray(visuals)||!visuals.length)return '';
  return `<div class="sinbad-source-visuals">${visuals.slice(0,3).map((visual,index)=>`
    <article class="sinbad-source-visual" data-visual-index="${index}">
      <div><strong>${esc(visual.title||'Atlas Cloud source')}</strong><small>${esc(visual.sourceId||'Source')} · page ${esc(visual.page)}</small></div>
      <button type="button" class="btn sinbad-open-source-visual" data-document-id="${esc(visual.documentId)}" data-page="${esc(visual.page)}" data-title="${esc(visual.title||'Atlas Cloud source')}">Kaynak sayfasını göster</button>
      <div class="sinbad-source-visual-stage hidden" aria-live="polite"><span>Kaynak sayfası hazırlanıyor…</span></div>
    </article>`).join('')}</div>`;
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
      ${m.role==='sinbad'?sinbadVisualCards(m.visuals):''}
    </div>`).join('');
  box.scrollTop=box.scrollHeight;
}
function addSinbadMessage(role,text,visuals=[]){
  sinbadState.messages.push({role,text,visuals:Array.isArray(visuals)?visuals.slice(0,3):[],at:new Date().toISOString()});
  saveSinbadMessages();renderSinbadMessages();
}

async function openSinbadSourceVisual(button){
  const documentId=button?.dataset?.documentId,pageNumber=Math.max(1,Number(button?.dataset?.page)||1);
  const card=button?.closest('.sinbad-source-visual'),stage=card?.querySelector('.sinbad-source-visual-stage');
  if(!documentId||!stage||!cloudClient||!selectedWorkspaceId)return;
  button.disabled=true;stage.classList.remove('hidden');stage.replaceChildren(Object.assign(document.createElement('span'),{textContent:'Kaynak sayfası hazırlanıyor…'}));
  try{
    const {data:documentRow,error:documentError}=await cloudClient.from('documents').select('bucket_id,object_path,original_filename,mime_type').eq('workspace_id',selectedWorkspaceId).eq('id',documentId).maybeSingle();
    if(documentError||!documentRow)throw documentError||new Error('Kaynak belgesi bulunamadı.');
    if(!/pdf/i.test(documentRow.mime_type||documentRow.original_filename||''))throw new Error('Bu kaynak PDF sayfası olarak gösterilemiyor.');
    const {data:blob,error:downloadError}=await cloudClient.storage.from(documentRow.bucket_id).download(documentRow.object_path);
    if(downloadError||!blob)throw downloadError||new Error('Kaynak indirilemedi.');
    const pdfjs=await ensurePdfJs(),pdf=await pdfjs.getDocument({data:await blob.arrayBuffer()}).promise;
    const safePage=Math.min(pageNumber,pdf.numPages),page=await pdf.getPage(safePage),viewport=page.getViewport({scale:1.35});
    const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);canvas.setAttribute('aria-label',`${button.dataset.title||'Kaynak'} sayfa ${safePage}`);
    await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
    const caption=document.createElement('small');caption.textContent=`${documentRow.original_filename||button.dataset.title} · sayfa ${safePage}/${pdf.numPages}`;
    stage.replaceChildren(canvas,caption);button.textContent='Sayfayı yenile';
  }catch(error){stage.replaceChildren(Object.assign(document.createElement('span'),{textContent:`Görsel açılamadı: ${error.message||error}`}));}
  finally{button.disabled=false;}
}
function renderOfficialSources(){
  const box=$('officialSourceList');if(!box||typeof OFFICIAL_PUBLICATIONS==='undefined')return;
  box.innerHTML=OFFICIAL_PUBLICATIONS.map(source=>`<article class="source-card"><strong>${esc(source.title)}</strong><br><small>${esc(source.authority)} • ${esc(source.edition)} • ${esc(source.status)}</small><p>${esc(source.notes)}</p><a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">Open official source</a></article>`).join('');
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
  setSinbadAssistantState('success');
}
async function copyPassagePlanDraft(){
  const text=$('passagePlanOutput').textContent;if(!text)return;
  await navigator.clipboard.writeText(text);$('copyPassagePlan').textContent='Copied';setTimeout(()=>$('copyPassagePlan').textContent='Copy draft',1200);
}
const SINBAD_BRIDGE_URL='http://127.0.0.1:31983';
async function refreshStudioCapability(){
 const dot=$('studioStatusDot'),title=$('studioStatusTitle'),detail=$('studioStatusDetail'),boundary=$('studioBoundaryText');
 if(!dot||!title||!detail)return;
 dot.classList.remove('online');title.textContent='Checking local Studio runtime…';detail.textContent='Reading capability status from Sinbad Bridge.';
 try{
  const response=await fetch(`${SINBAD_BRIDGE_URL}/studio/status`,{cache:'no-store'});if(!response.ok)throw new Error(`Bridge returned ${response.status}`);const status=await response.json(),ready=status.status==='READY_FOR_APPROVAL_GATED_TESTS';
  dot.classList.toggle('online',ready);title.textContent=ready?`Studio ${status.studioVersion} ready`:`Studio ${status.studioVersion||''} runtime incomplete`;
  detail.textContent=`Docker installed: ${status.docker?.installed?'yes':'no'} · Docker running: ${status.docker?.processRunning?'yes':'no'} · WSL installed: ${status.wsl?.installed?'yes':'no'} · Core installed: ${status.core?.installed?'yes':'no'}`;
  if(boundary)boundary.textContent=`Allowed: ${(status.allowed||[]).join(', ')}. Prohibited: ${(status.prohibited||[]).join(', ')}. Approval: ${status.approval||'required'}.`;
 }catch(_){title.textContent='Local Studio service offline';detail.textContent='Start Sinbad Bridge on this Windows computer, then refresh. No remote fallback was used.';}
}
$('refreshStudioStatus')?.addEventListener('click',refreshStudioCapability);
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
  if(points.length<2||points.some(point=>!Number.isFinite(point.lat)||!Number.isFinite(point.lon)||Math.abs(point.lat)>90||Math.abs(point.lon)>180))throw new Error(SINBAD_MISSING_WAYPOINTS_MESSAGE);
  return points;
}
function buildBridgeGpx(){
  const points=validBridgeWaypoints(),name=bridgeRouteName(),created=new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Sinbad Marine ECS" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">\n  <metadata><name>${bridgeXml(name)}</name><time>${created}</time><desc>Planning draft. Verify against current official charts and Notices to Mariners.</desc></metadata>\n  ${points.map(point=>`<wpt lat="${point.lat.toFixed(6)}" lon="${point.lon.toFixed(6)}"><name>${bridgeXml(point.name)}</name></wpt>`).join('\n  ')}\n  <rte><name>${bridgeXml(name)}</name><desc>Sinbad planning route — captain approval required.</desc>\n    ${points.map(point=>`<rtept lat="${point.lat.toFixed(6)}" lon="${point.lon.toFixed(6)}"><name>${bridgeXml(point.name)}</name></rtept>`).join('\n    ')}\n  </rte>\n</gpx>\n`;
}
function safeBridgeFilename(){return `${bridgeRouteName().replace(/[^a-z0-9_-]+/gi,'-').replace(/^-|-$/g,'')||'sinbad-route'}.gpx`;}
const SINBAD_MISSING_WAYPOINTS_MESSAGE='Add at least two waypoints with valid latitude and longitude.';
function downloadBridgeGpx(){
  try{const blob=new Blob([buildBridgeGpx()],{type:'application/gpx+xml'}),link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=safeBridgeFilename();link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);$('bridgeMessage').textContent='GPX downloaded. Import it in OpenCPN Route & Mark Manager.';setSinbadAssistantState('success');}catch(error){$('bridgeMessage').textContent=error.message;setSinbadAssistantState(error.message===SINBAD_MISSING_WAYPOINTS_MESSAGE?'warning':'error');}
}
async function sendBridgeGpx(){
  try{
    const response=await fetch(`${SINBAD_BRIDGE_URL}/routes`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({filename:safeBridgeFilename(),name:bridgeRouteName(),gpx:buildBridgeGpx()})});
    if(!response.ok)throw new Error(`Bridge returned ${response.status}`);const result=await response.json();$('bridgeMessage').textContent=`Route saved locally: ${result.path}. Import it from OpenCPN Route & Mark Manager.`;checkBridgeStatus();setSinbadAssistantState('success');
  }catch(error){$('bridgeMessage').textContent='Local Bridge is not reachable. Start bridge/start-sinbad-bridge.cmd, or use Download GPX.';setSinbadAssistantState(error.message===SINBAD_MISSING_WAYPOINTS_MESSAGE?'warning':'error');}
}
async function checkBridgeStatus(){
  const badge=$('bridgeStatus');if(!badge)return;
  try{const response=await fetch(`${SINBAD_BRIDGE_URL}/status`,{cache:'no-store'});if(!response.ok)throw new Error();const status=await response.json();const indexed=status.library?.chunks??status.library?.count??0;badge.textContent=`Bridge online · ${status.routes} route(s) · ${indexed} memory chunk(s)`;badge.className='bridge-status online';}
  catch(error){badge.textContent='Bridge offline';badge.className='bridge-status offline';}
}
async function sinbadBridgeJson(path,options={}){
  const response=await fetch(`${SINBAD_BRIDGE_URL}${path}`,{cache:'no-store',...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});
  if(!response.ok)throw new Error(`Bridge returned ${response.status}`);
  return response.json();
}
async function syncSinbadOfflineMemory(){
  const button=$('syncSinbadMemory'),status=$('sinbadMemoryStatus');
  if(button)button.disabled=true;if(status)status.textContent='Preparing offline memory…';
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
      if(status)status.textContent=`Reading library… ${documents}/${knowledge.length}`;
    }
    const catalogue=(typeof OFFICIAL_PUBLICATIONS==='undefined'?[]:OFFICIAL_PUBLICATIONS).map(source=>[
      `Title: ${source.title}`,`Authority: ${source.authority}`,`Edition: ${source.edition}`,`Region: ${source.region}`,`Type: ${source.type}`,`Access: ${source.access}`,`Status: ${source.status}`,`URL: ${source.url}`,`Local file: ${source.localFile||''}`,`Notes: ${source.notes||''}`
    ].join('\n')).join('\n\n---\n\n');
    if(catalogue){await sinbadBridgeJson('/library/ingest',{method:'POST',body:JSON.stringify({title:'Approved official source catalogue',text:catalogue,sourceUrl:'atlas://official-publications',kind:'official-source-catalogue'})});documents++;}
    const result=await sinbadBridgeJson('/library/reindex',{method:'POST',body:'{}'});const total=result.chunks??result.count??0;
    if(status)status.textContent=`Offline memory ready · ${documents} documents · ${total} chunks${errors?` · ${errors} skipped`:''}`;checkBridgeStatus();
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
  return /(chart|harita|nautical|hydrograph|hidrograf|tide|gelgit|current|akıntı|akinti|set\b|drift|colreg|rule of the road|seyir kural|light|shape|sound signal|enc\b|ecdis|electronic navigation|weather|hava|visibility|görüş|goruş|course|bearing|kerteriz|compass|pusula|navigation|navigasyon|seyir eğitim|seyir egitim)/iu.test(query);
}
function academyOfflineAnswer(query){
  if(!academyTrainingQuery(query)||!window.SinbadAcademy||!window.SINBAD_TRAINING_DATA)return null;
  return SinbadAcademy.answer(query,SINBAD_TRAINING_DATA)?.text||null;
}
let sinbadAcademyNativeWindow=null;
function openSinbadAcademyWindow(){
  if(sinbadAcademyNativeWindow&&!sinbadAcademyNativeWindow.closed){sinbadAcademyNativeWindow.focus();return;}
  const width=Math.max(900,screen.availWidth||1200),height=Math.max(650,screen.availHeight||800);
  sinbadAcademyNativeWindow=window.open('./academy.html','sinbadAcademyClassroom',`popup=yes,left=0,top=0,width=${width},height=${height},resizable=yes,scrollbars=yes`);
  if(!sinbadAcademyNativeWindow){alert('Sinbad Academy penceresi engellendi. Bu site için açılır pencerelere izin verip yeniden deneyin.');return;}
  sinbadAcademyNativeWindow.focus();
}
function renderAcademyLesson(){
  const category=$('academyModule')?.value,lesson=window.SinbadAcademy?.lesson(category,window.SINBAD_TRAINING_DATA),output=$('academyOutput');
  if(!lesson||!output)return;
  const progress=JSON.parse(localStorage.getItem('sinbad_academy_progress')||'{}');progress[category]={openedAt:new Date().toISOString(),status:'studying'};localStorage.setItem('sinbad_academy_progress',JSON.stringify(progress));
  output.textContent=`${lesson.title}\n\nLearning objectives\n${lesson.objectives.map(x=>'• '+x).join('\n')}\n\nPractice\n${lesson.practice}\n\nOfficial offline sources\n${lesson.sources.map((x,i)=>`[S${i+1}] ${x.title} — ${x.authority}`).join('\n')||'No matching offline source.'}\n\n⚠ Training only. Operational decisions require current official information and captain approval.`;
}
function renderAcademyQuiz(){
  const category=$('academyModule')?.value,items=window.SinbadAcademy?.quiz(category)||[],output=$('academyOutput');if(!items.length||!output)return;
  const item=items[Math.floor(Math.random()*items.length)];output.replaceChildren();
  const title=document.createElement('strong');title.textContent=item.q;output.append(title);
  const choices=document.createElement('div');choices.className='academy-choices';
  item.choices.forEach((choice,index)=>{const button=document.createElement('button');button.type='button';button.className='btn';button.textContent=choice;button.addEventListener('click',()=>{[...choices.children].forEach(x=>x.disabled=true);button.classList.add(index===item.answer?'primary':'danger');const result=document.createElement('p');result.textContent=`${index===item.answer?'✓ Correct':'✗ Review'} — ${item.explanation} [${item.source}]`;output.append(result);if(index===item.answer){const progress=JSON.parse(localStorage.getItem('sinbad_academy_progress')||'{}');progress[category]={completedAt:new Date().toISOString(),status:'practised'};localStorage.setItem('sinbad_academy_progress',JSON.stringify(progress));}});choices.append(button);});
  output.append(choices);const source=document.createElement('small');source.className='academy-source';source.textContent=`Official source: ${item.source}`;output.append(source);
}
async function sinbadLocalAnswer(query){
  setSinbadThinkingStage('analyzing');
  const q=query.toLowerCase();
  const language=sinbadState.language||appLanguage;
  const coreResult=await window.SinbadCore?.orchestrate?.(query,{
    history:sinbadState.messages,
    experts:{
      emergency:{mode:window.SinbadCore?.EXPERT_MODE,handle:()=>language==='tr-TR'
        ? 'ACİL DURUM: İnsan komutasını ve geminin onaylı acil durum prosedürlerini derhal devreye alın. Uygunsa MAYDAY/PAN-PAN çağrısı yapın, mevkiyi ve tehlikenin niteliğini bildirin; Sinbad yalnızca karar desteğidir.'
        : 'EMERGENCY: Activate human command and the vessel approved emergency procedures immediately. When appropriate transmit MAYDAY/PAN-PAN with position and nature of distress; Sinbad is decision support only.'},
      navigation:window.SinbadNavigationAssistant?.createExpert?.({engine:window.SinbadNavigation,language})
    }
  });
  if(coreResult?.handled)return coreResult.answer;
  const greetings={'tr-TR':'Merhaba Kaptan. Sinbad aktif. Rotalar, denizcilik yayınları, belgeler, haritalar ve tekne operasyonları hakkında bana soru sorabilirsiniz.','en-US':'Hello Captain. Sinbad is active. Ask me about routes, marine publications, documents, charts, or yacht operations.','ru-RU':'Здравствуйте, капитан. Синбад активен. Спросите меня о маршрутах, морских изданиях, документах, картах или эксплуатации яхты.','fr-FR':'Bonjour Capitaine. Sinbad est actif. Interrogez-moi sur les routes, publications maritimes, documents, cartes ou opérations du yacht.','de-DE':'Hallo Kapitän. Sinbad ist aktiv. Fragen Sie mich zu Routen, nautischen Publikationen, Dokumenten, Karten oder Yachtbetrieb.','ar-SA':'مرحباً أيها القبطان. سندباد نشط. اسألني عن المسارات أو المنشورات البحرية أو الوثائق أو الخرائط أو عمليات اليخت.','es-ES':'Hola Capitán. Sinbad está activo. Pregúnteme sobre rutas, publicaciones marítimas, documentos, cartas u operaciones del yate.','it-IT':'Salve Capitano. Sinbad è attivo. Mi chieda informazioni su rotte, pubblicazioni nautiche, documenti, carte o operazioni dello yacht.'};
  if(/^(slm|selam|merhaba|hello|hi|hey|привет|здрав|bonjour|salut|hallo|guten|مرحبا|السلام|hola|buen|ciao|salve)[!. ]*$/iu.test(q))return greetings[language]||greetings['en-US'];
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


  const noMatch={'tr-TR':'Atlas Marine verilerinde güçlü bir eşleşme bulamadım. İlgili kitabı veya belgeyi Atlas Cloud kitaplığına yükleyin ya da sorunuzu daha ayrıntılı yazın.','en-US':'I did not find a strong match in Atlas Marine data. Upload the relevant book or document to the Atlas Cloud library, or ask a more specific question.','ru-RU':'Я не нашёл точного совпадения в данных Atlas Marine. Загрузите нужную книгу или документ в Atlas Cloud либо уточните вопрос.','fr-FR':'Je n’ai pas trouvé de correspondance précise dans Atlas Marine. Chargez le livre ou document dans Atlas Cloud ou précisez votre question.','de-DE':'Ich habe keine eindeutige Übereinstimmung gefunden. Laden Sie das Buch oder Dokument in Atlas Cloud hoch oder stellen Sie eine genauere Frage.','ar-SA':'لم أجد تطابقاً واضحاً في بيانات Atlas Marine. حمّل الكتاب أو الوثيقة إلى مكتبة Atlas Cloud أو اطرح سؤالاً أكثر تحديداً.','es-ES':'No encontré una coincidencia clara en Atlas Marine. Cargue el libro o documento en Atlas Cloud o formule una pregunta más específica.','it-IT':'Non ho trovato una corrispondenza chiara in Atlas Marine. Carichi il libro o documento in Atlas Cloud oppure formuli una domanda più specifica.'};
  return noMatch[language]||noMatch['en-US'];
}
async function sinbadOfflineAiAnswer(question){
  const status=$('sinbadKnowledgeStatus');
  try{
    setSinbadThinkingStage('retrieving');
    if(status)status.textContent='Connecting to Sinbad offline brain…';
    const history=sinbadState.messages.slice(-12,-1).map(message=>({role:message.role==='sinbad'?'assistant':'user',content:message.text}));
    const coreEnvelope=window.SinbadCore?.aiEnvelope?.(question,history);
    const response=await fetch(`${SINBAD_BRIDGE_URL}/ai/chat`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question,language:sinbadState.language||appLanguage,history,coreEnvelope})});
    if(!response.ok)throw new Error(`Offline brain returned ${response.status}`);
    const data=await response.json();
    if(!data?.answer)return null;
    if(status)status.textContent=`Sinbad offline AI active · ${data.model||'local model'}`;
    return data.answer;
  }catch(error){
    console.warn('Sinbad offline AI unavailable',error);
    if(status)status.textContent='Offline AI is not installed or Bridge is closed';
    return null;
  }
}
async function sendToSinbad(text){
  const q=(text||'').trim(); if(!q)return;
  // A new question always takes the floor immediately. This cancels queued
  // teaching pauses and any utterance still reading the previous answer.
  stopSinbadVoice();
  prepareSinbadSpeechPerformance(q);
  sinbadModelSpokenSummary='';
  if(pendingSinbadWebQuestion&&/^(izin ver|evet|ara|webde ara|allow|yes|search|разрешаю|да|autoriser|oui|erlauben|ja|اسمح|نعم|permitir|sí|consenti|sì)[.! ]*$/iu.test(q)){
    addSinbadMessage('user',q);$('sinbadInput').value='';await performSinbadWebSearch();return;
  }
  if(pendingSinbadWebQuestion&&/^(izin verme|hayır|arama|no|do not search|нет|non|nein|لا|hayır|no buscar|non cercare)[.! ]*$/iu.test(q)){
    pendingSinbadWebQuestion='';$('sinbadWebConsent').classList.add('hidden');const copy=SINBAD_WEB_TEXT[sinbadState.language]||SINBAD_WEB_TEXT['en-US'];addSinbadMessage('user',q);addSinbadMessage('sinbad',copy.denied);sinbadAwaitingAnswer=false;speakSinbad(copy.denied);return;
  }
  addSinbadMessage('user',q);
  $('sinbadInput').value='';
  if(window.SinbadRouteVisualizer?.isPlotRequest?.(q)){
    setSinbadThinkingStage('calculating');
    const plotted=await prepareNavigationPlotFromConversation(q);
    setSinbadThinkingStage('composing');
    addSinbadMessage('sinbad',plotted.message);speakSinbad(plotted.message);return;
  }
  setSinbadThinkingStage('analyzing');
  $('sinbadThinking').classList.remove('hidden');
  try{
    const answer=await sinbadLocalAnswer(q);
    setSinbadThinkingStage('composing');
    speakSinbad(answer,()=>addSinbadMessage('sinbad',answer,consumeSinbadSourceVisuals()));
  }catch(error){
    console.error('Sinbad answer failed',error);
    const message=sinbadState.language==='tr-TR'?'Yanıt hazırlanırken güvenli biçimde durdum. Lütfen yeniden deneyin.':'I stopped safely while preparing the answer. Please try again.';
    addSinbadMessage('sinbad',message);setSinbadAssistantState('error');
  }finally{$('sinbadThinking').classList.add('hidden');}
}
$('sendSinbad').addEventListener('click',()=>{window.speechSynthesis?.resume();sendToSinbad($('sinbadInput').value);});
$('sinbadMessages')?.addEventListener('click',event=>{const button=event.target.closest('.sinbad-open-source-visual');if(button)openSinbadSourceVisual(button);});
$('sinbadInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendToSinbad($('sinbadInput').value)}});
document.querySelectorAll('.sinbad-prompt').forEach(b=>b.addEventListener('click',()=>sendToSinbad(b.textContent)));

const SINBAD_WORKSPACE_TABS=Object.freeze(['chat','academy','passage','sources']);
function setSinbadWorkspaceTab(requested,{focus=false}={}){
  const tab=SINBAD_WORKSPACE_TABS.includes(requested)?requested:'chat';
  document.querySelectorAll('[data-sinbad-tab]').forEach(button=>{
    const active=button.dataset.sinbadTab===tab;
    button.classList.toggle('active',active);
    button.setAttribute('aria-selected',String(active));
    button.tabIndex=active?0:-1;
    if(active&&focus)button.focus();
  });
  document.querySelectorAll('[data-sinbad-panel]').forEach(panel=>{panel.hidden=panel.dataset.sinbadPanel!==tab;});
  try{sessionStorage.setItem('atlas_sinbad_workspace_tab',tab);}catch{}
}
document.querySelectorAll('[data-sinbad-tab]').forEach(button=>{
  button.addEventListener('click',()=>setSinbadWorkspaceTab(button.dataset.sinbadTab));
  button.addEventListener('keydown',event=>{
    const current=SINBAD_WORKSPACE_TABS.indexOf(button.dataset.sinbadTab);
    let next=current;
    if(event.key==='ArrowRight')next=(current+1)%SINBAD_WORKSPACE_TABS.length;
    else if(event.key==='ArrowLeft')next=(current-1+SINBAD_WORKSPACE_TABS.length)%SINBAD_WORKSPACE_TABS.length;
    else if(event.key==='Home')next=0;
    else if(event.key==='End')next=SINBAD_WORKSPACE_TABS.length-1;
    else return;
    event.preventDefault();setSinbadWorkspaceTab(SINBAD_WORKSPACE_TABS[next],{focus:true});
  });
});
let initialSinbadWorkspaceTab='chat';
try{initialSinbadWorkspaceTab=sessionStorage.getItem('atlas_sinbad_workspace_tab')||'chat';}catch{}
setSinbadWorkspaceTab(initialSinbadWorkspaceTab);

$('sinbadFloat').addEventListener('click',()=>openWorkspace('sinbad'));
$('backToSinbad')?.addEventListener('click',()=>openWorkspace('sinbad'));
$('toggleSinbadVoice')?.addEventListener('click',()=>{sinbadState.voiceEnabled=!sinbadState.voiceEnabled;localStorage.setItem('atlas_sinbad_voice',sinbadState.voiceEnabled?'on':'off');setSinbadVoiceUI();if(!sinbadState.voiceEnabled){stopSinbadVoice();setSinbadAssistantState('voice-disabled');}else if(sinbadAssistantState==='voice-disabled')setSinbadAssistantState('idle');});
setSinbadAssistantState(sinbadState.voiceEnabled?'idle':'voice-disabled');
$('stopSinbadVoice')?.addEventListener('click',stopSinbadVoice);
$('startSinbadListening')?.addEventListener('click',startSinbadListening);
$('testSinbadVoice')?.addEventListener('click',()=>{sinbadState.voiceEnabled=true;localStorage.setItem('atlas_sinbad_voice','on');setSinbadVoiceUI();speakSinbad(speechCopy().test);});
$('testSinbadWalk')?.addEventListener('click',()=>window.SinbadCharacterController.react('walk'));
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
$('openSinbadAcademyClassroom')?.addEventListener('click',openSinbadAcademyWindow);
renderOfficialSources();
setSinbadVoiceUI();
setListeningUI();


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
    registration:['Create Sinbad Marine Account','Register with your email address. Private workspace access still requires an invitation or Captain Varol Çolak’s approval.'],
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
  output.textContent='Checking the secure Atlas Cloud connection…';
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
  $('cloudUserInfo').textContent=cloudSession?.user ? `Signed in as ${cloudSession.user.email} • User ID: ${cloudSession.user.id}` : 'No active cloud session.';
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
  $('cloudConnectionStatus').textContent=error ? 'Connected • login required' : 'Connected';
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
  setAuthMessage('Signing in…');
  if(!cloudClient){setAuthMessage('Atlas Cloud connection is not ready. Open Cloud Setup & Security and save the Project URL again.','error');return;}
  const email=$('gatewayEmail').value.trim();
  const password=$('gatewayPassword').value;
  try{
    const {data,error}=await cloudClient.auth.signInWithPassword({email,password});
    if(error){
      const hint=/invalid login credentials/i.test(error.message||'')?'Email or password is incorrect. Use the same email shown when the password was created, or choose “I forgot my password”.':friendlyAuthError(error);
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
      ? 'Atlas Cloud could not be reached. Close this window and use “Check Cloud Connection” to see the exact connection result.'
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
  setAuthMessage('Creating your account…');
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

    setAuthMessage('Checking your invitation session…');
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
    setAuthMessage('Creating your secure password…');
    const {data:passwordData,error:passwordError}=await cloudClient.auth.updateUser({password});
    if(passwordError)throw passwordError;

    setAuthMessage('Saving your captain profile…');
    const {data:profileData,error:profileError}=await cloudClient.auth.updateUser({
      data:{display_name:name,sinbad_account_ready:true}
    });
    const finalUser=profileData?.user||passwordData?.user||activeSession.user;
    const completedEmail=finalUser?.email||activeSession.user?.email||'';
    cloudSession={...activeSession,user:finalUser};
    pendingInviteSetup=false;
    sessionStorage.removeItem('sinbad_pending_invite_setup');
    setAuthMessage('Account completed. Opening secure sign in…','success');

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
  setAuthMessage('Sending recovery code…');
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
  setAuthMessage('Verifying code…');
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
  $('workspaceDetails').textContent=selected ? `${selected.name} • ${selected.id}` : 'No workspace selected.';
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
  summary.textContent=user?`${user.email} • ${currentWorkspaceRole||'no workspace role'} • User ID: ${user.id}`:'No active account.';
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
  $('memberInviteStatus').textContent='Preparing secure invitation…';
  try{await invokeMemberAdmin('invite',{email,role,note,redirectTo:`${location.origin}${location.pathname}?type=invite`});$('memberInviteStatus').textContent=`Invitation sent to ${email}.`;$('memberInviteEmail').value='';$('memberInviteNote').value='';await loadAdminAudit();}
  catch(error){$('memberInviteStatus').textContent=`Invitation failed: ${error.message}`;}
}
function renderSettingsMembers(){
  const list=$('settingsMemberList');if(!list)return;
  const query=$('settingsMemberSearch').value.trim().toLowerCase(), filter=$('settingsMemberFilter').value;
  const rows=settingsMembers.filter(member=>(!query||`${member.user_id} ${member.role}`.toLowerCase().includes(query))&&(filter==='all'||(filter==='active'&&member.is_active)||(filter==='blocked'&&!member.is_active)||(filter==='developer'&&member.role==='developer')));
  list.innerHTML=rows.length?rows.map(member=>`<div class="settings-member ${member.is_active?'':'blocked'}"><div><strong>${cloudEsc(member.user_id)}</strong><small>${member.is_active?'Active':'Suspended'} • Joined ${cloudEsc(member.joined_at||'')}</small></div><select class="settings-role" data-user="${cloudEsc(member.user_id)}" aria-label="Role for ${cloudEsc(member.user_id)}">${SETTINGS_ROLES.map(role=>`<option value="${role}" ${member.role===role?'selected':''}>${role}</option>`).join('')}</select><div class="settings-member-actions"><button class="btn settings-save-role" data-user="${cloudEsc(member.user_id)}">Save role</button><button class="btn ${member.is_active?'danger':''} settings-toggle-member" data-user="${cloudEsc(member.user_id)}" data-active="${member.is_active}">${member.is_active?'Suspend':'Restore'}</button></div></div>`).join(''):'No matching members.';
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
  list.innerHTML=error?cloudEsc(error.message):(data?.length?data.map(event=>`<div class="audit-event"><strong>${cloudEsc(event.action)}</strong><small>${cloudEsc(event.target_email||event.target_user_id||'workspace')} • ${cloudEsc(event.created_at)}${event.details?` • ${cloudEsc(JSON.stringify(event.details))}`:''}</small></div>`).join(''):'No administrative events recorded.');
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
      <small>${m.is_active?'Active':'Inactive'} • Joined ${cloudEsc(m.joined_at||'')}</small>
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
  $('submissionUploadStatus').textContent=`✓ ${completed}/${files.length} source file(s) submitted for Owner review and security scan.`;
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
      <p>${cloudEsc(s.intended_library)} • ${formatBytes(s.file_size_bytes||0)} • ${cloudEsc(s.status)}<br>${cloudEsc(s.description||'No description')}<br><small>${cloudEsc(s.created_at)}</small></p>
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
  checks.push(cfg.url&&cfg.key?'✓ Cloud configuration present':'✗ Cloud configuration missing');
  checks.push(cloudSession?.user?'✓ Authenticated session':'✗ Not signed in');
  checks.push(selectedWorkspaceId?'✓ Workspace selected':'✗ Workspace not selected');
  checks.push(!/secret|service_role/i.test(cfg.key)?'✓ No obvious server secret stored':'✗ Dangerous key detected');
  $('securityCheckResult').textContent=checks.join(' • ');
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
      onProgress(`Reading PDF page ${pageNo}/${pdf.numPages}…`);
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
  const {data:knowledge,error}=await cloudClient.from('document_knowledge').upsert({workspace_id:selectedWorkspaceId,document_id:documentId,title:file.name,classification,summary,language:/[çğıöşü]/i.test(text.slice(0,50000))?'tr':'en',source_mime_type:file.type||null,character_count:text.length,index_status:text?'ready':'metadata_only',indexed_by:cloudSession.user.id,indexed_at:new Date().toISOString()},{onConflict:'workspace_id,document_id'}).select('id').single();
  if(error)throw error;
  await cloudClient.from('document_knowledge_chunks').delete().eq('knowledge_id',knowledge.id);
  const chunks=[];for(let i=0;i<text.length;i+=KNOWLEDGE_CHUNK_SIZE)chunks.push({knowledge_id:knowledge.id,chunk_index:chunks.length,content:text.slice(i,i+KNOWLEDGE_CHUNK_SIZE)});
  for(let i=0;i<chunks.length;i+=50){const {error:chunkError}=await cloudClient.from('document_knowledge_chunks').insert(chunks.slice(i,i+50));if(chunkError)throw chunkError;}
  return {classification,chunks:chunks.length};
}
function cloudAnswerPassesCoreGate(data,envelope){
  const decision=data?.coreDecision;
  const expected=envelope?.analysis,answerSafe=data?.answer==null||window.SinbadCoreDecision?.answerIsSafe?.(String(data.answer))===true;
  return Boolean(data&&answerSafe&&data.coreGateVersion===window.SinbadCore?.CORE_GATE_VERSION&&data.coreGateVersion===envelope?.gateVersion&&data.permission==='DECISION_SUPPORT_ONLY'&&data.executionPerformed===false&&decision&&expected&&['low','medium','high','critical'].includes(decision.risk)&&decision.risk===expected.risk&&['emergency','operational','needsLiveData','requiresHumanApproval','requiresIndependentVerification'].every(field=>typeof decision[field]==='boolean'&&decision[field]===expected[field]));
}
let sinbadPendingSourceVisuals=[];
function consumeSinbadSourceVisuals(){const visuals=sinbadPendingSourceVisuals;sinbadPendingSourceVisuals=[];return visuals;}
async function sinbadCloudKnowledgeAnswer(question){
  sinbadPendingSourceVisuals=[];
  if(!cloudClient||!cloudSession?.user||!selectedWorkspaceId)return null;
  setSinbadThinkingStage('retrieving');
  const status=$('sinbadKnowledgeStatus');if(status)status.textContent='Searching Atlas Cloud…';
  try{
    const language=sinbadState.language||appLanguage;
    const history=sinbadState.messages.slice(-12,-1).map(message=>({role:message.role==='sinbad'?'assistant':'user',content:message.text}));
    const coreEnvelope=window.SinbadCore?.aiEnvelope?.(question,history);
    const invocation=await cloudClient.functions.invoke('sinbad-answer',{body:{workspaceId:selectedWorkspaceId,question,language,coreEnvelope}});
    const aiError=invocation.error;let trustedAiData=invocation.data;
    if(aiError){trustedAiData=null;if(status)status.textContent='Atlas Cloud AI unavailable · searching private archive';}
    else if(!cloudAnswerPassesCoreGate(trustedAiData,coreEnvelope)){trustedAiData=null;if(status)status.textContent='Atlas Cloud Core gate blocked AI · searching private archive';}
    if(trustedAiData?.answer){
      const answer=String(trustedAiData.answer).trim();
      // Older cloud deployments can return a polite "no source found" notice
      // as if it were a complete AI answer. Treat those notices as a miss so
      // the installed Ollama brain gets an opportunity to answer instead.
      const cloudMiss=/yeterli kaynak bulunamad[ıi]|eşleşen bir kaynak bulamad[ıi]|AI bağlantısı henüz etkin|metni (?:yer almad[ıi]ğından|bulunmad[ıi]ğından)|kaynağa dayalı (?:olarak )?doğrulayam[ıi]yorum|not enough (?:material|source)|no matching (?:knowledge|source)|source text (?:is|was) not available|keine ausreichende quelle|keine passende quelle/i.test(answer);
      const normalizedAnswer=answer.toLocaleLowerCase('tr-TR')
        .replace(/[ıİ]/g,'i').replace(/[şŞ]/g,'s').replace(/[ğĞ]/g,'g')
        .replace(/[üÜ]/g,'u').replace(/[öÖ]/g,'o').replace(/[çÇ]/g,'c')
        .normalize('NFKD').replace(/[\u0300-\u036f]/g,'');
      const cloudMissFallback=normalizedAnswer.includes('yeterli kaynak yok')
        || normalizedAnswer.includes('yeterli kaynak bulunamadi')
        || normalizedAnswer.includes('yalnizca onayli atlas cloud')
        || normalizedAnswer.includes('kitabi veya belgeyi kutuphaneye yukleyin');
      if(!cloudMiss&&!cloudMissFallback){
        sinbadModelSpokenSummary=String(trustedAiData.spokenSummary||'').trim();
        sinbadPendingSourceVisuals=Array.isArray(trustedAiData.visuals)?trustedAiData.visuals.slice(0,3):[];
        if(status)status.textContent=sinbadPendingSourceVisuals.length?'Atlas Cloud AI active · source visuals ready':'Atlas Cloud AI active';return answer;
      }
      if(status)status.textContent='Atlas Cloud has no answer · trying offline brain';
    }
    if(trustedAiData?.needsWebPermission){if(status)status.textContent='Atlas Cloud has no answer · trying offline brain';return null;}
    const terms=question.toLocaleLowerCase(language).normalize('NFKD').replace(/[^a-z0-9çğıöşüа-яёء-ي ]/gi,' ').split(/\s+/).filter(x=>x.length>2).slice(0,8);if(!terms.length)return null;
    const titleRows=[];
    for(const term of terms.slice(0,5)){
      const {data,error}=await cloudClient.from('document_knowledge').select('id,title,classification').eq('workspace_id',selectedWorkspaceId).ilike('title',`%${term.replace(/[%_]/g,'')}%`).limit(6);
      if(error)throw error;if(data)titleRows.push(...data);
    }
    const titleMatches=[...new Map(titleRows.map(row=>[row.id,row])).values()].slice(0,8);
    let data=[];
    if(titleMatches.length){
      const {data:chunks,error}=await cloudClient.from('document_knowledge_chunks').select('knowledge_id,content,chunk_index').in('knowledge_id',titleMatches.map(row=>row.id)).limit(500);
      if(error)throw error;
      const titles=new Map(titleMatches.map(row=>[row.id,row]));
      data=(chunks||[]).map(row=>({...row,document_knowledge:titles.get(row.knowledge_id)}));
    }
    if(!data.length){
      const result=await cloudClient.from('document_knowledge_chunks').select('content,chunk_index,document_knowledge!inner(title,classification,workspace_id)').eq('document_knowledge.workspace_id',selectedWorkspaceId).ilike('content',`%${terms[0]}%`).limit(12);
      if(result.error)throw result.error;data=result.data||[];
    }
    if(!data.length){if(status)status.textContent='Atlas Cloud has no answer · trying offline brain';return null;}
    const ranked=data.map(row=>({row,score:terms.reduce((n,t)=>n+(row.content.toLocaleLowerCase(language).includes(t)?1:0),0)})).sort((a,b)=>b.score-a.score).slice(0,4);
    const excerpts=ranked.map(({row})=>{const lower=row.content.toLocaleLowerCase(language),positions=terms.map(t=>lower.indexOf(t)).filter(n=>n>=0),at=positions.length?Math.min(...positions):0;return `• ${row.document_knowledge.title} [${row.document_knowledge.classification}]\n${row.content.slice(Math.max(0,at-180),at+650).replace(/\s+/g,' ').trim()}`;});
    if(status)status.textContent='Classified cloud archive active';
    return `Relevant classified Atlas Cloud passages:\n\n${excerpts.join('\n\n')}\n\nVerify critical navigation and safety decisions against the original publication.`;
  }catch(error){console.warn('Sinbad cloud knowledge unavailable',error);if(status)status.textContent='Atlas Cloud unavailable · trying offline brain';return null;}
}
async function performSinbadWebSearch(){
  const question=pendingSinbadWebQuestion;if(!question)return;$('sinbadWebConsent').classList.add('hidden');pendingSinbadWebQuestion='';
  setSinbadThinkingStage('retrieving');
  $('sinbadThinking').classList.remove('hidden');
  try{
    const history=sinbadState.messages.slice(-12).map(message=>({role:message.role==='sinbad'?'assistant':'user',content:message.text}));
    const coreEnvelope=window.SinbadCore?.aiEnvelope?.(question,history);
    const {data,error}=await cloudClient.functions.invoke('sinbad-answer',{body:{workspaceId:selectedWorkspaceId,question,language:sinbadState.language,allowWebSearch:true,coreEnvelope}});if(error)throw error;
    if(!cloudAnswerPassesCoreGate(data,coreEnvelope))throw new Error('Core safety gate rejected the cloud response');
    sinbadModelSpokenSummary=String(data?.spokenSummary||'').trim();
    const copy=SINBAD_WEB_TEXT[sinbadState.language]||SINBAD_WEB_TEXT['en-US'];const answer=`${copy.result}:\n\n${data?.answer||'No reliable web result was found.'}`;
    speakSinbad(answer,()=>addSinbadMessage('sinbad',answer));
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
  $('cloudUploadProgress').textContent=`✓ ${completed}/${files.length} file(s) uploaded to Atlas Cloud.`; await loadCloudFiles(); await refreshCloudSummary();
  if(failures.length)$('cloudUploadProgress').textContent+=`\n⚠ ${failures.join('\n⚠ ')}`;
  $('cloudFileInput').value='';
}
async function loadCloudFiles(){
  if(!cloudClient || !selectedWorkspaceId)return;
  const bucket=$('cloudBucketSelect').value;
  const search=($('cloudFileSearch')?.value||'').trim();
  let query=cloudClient.from('documents').select('id,title,original_filename,bucket_id,object_path,file_size_bytes,status,classification,created_at').eq('workspace_id',selectedWorkspaceId).eq('bucket_id',bucket);
  if(search)query=query.ilike('title',`%${search.replace(/[%_]/g,'')}%`);
  const {data,error}=await query.order('created_at',{ascending:false}).limit(100);
  if(error){$('cloudFileList').textContent=error.message;return;}
  $('cloudFileList').innerHTML=data?.length ? data.map(d=>`
    <article class="cloud-file-card">
      <h4>${cloudEsc(d.title||d.original_filename)}</h4>
      <small>${cloudEsc(d.bucket_id)} • ${Math.round((d.file_size_bytes||0)/1024)} KB<br>${cloudEsc(d.status)} • ${cloudEsc(d.classification)}</small>
      <div class="cloud-file-actions">
        <button class="btn cloud-open-file" data-bucket="${cloudEsc(d.bucket_id)}" data-path="${cloudEsc(d.object_path)}" data-name="${cloudEsc(d.original_filename)}">${d.bucket_id==='nautical-charts'?'View ENC':'Open'}</button>
        <button class="btn cloud-download-file" data-bucket="${cloudEsc(d.bucket_id)}" data-path="${cloudEsc(d.object_path)}" data-name="${cloudEsc(d.original_filename)}">Download</button>
        <button class="btn cloud-share-file" data-bucket="${cloudEsc(d.bucket_id)}" data-path="${cloudEsc(d.object_path)}" data-name="${cloudEsc(d.original_filename)}">Share</button>
        ${roleCanManageLibrary()?`<button class="btn cloud-rename-file" data-id="${cloudEsc(d.id)}" data-bucket="${cloudEsc(d.bucket_id)}" data-path="${cloudEsc(d.object_path)}" data-name="${cloudEsc(d.original_filename)}">Rename</button>
        <button class="btn cloud-index-file" data-id="${cloudEsc(d.id)}">Index AI</button>
        <button class="btn cloud-repair-knowledge" data-id="${cloudEsc(d.id)}" data-bucket="${cloudEsc(d.bucket_id)}" data-path="${cloudEsc(d.object_path)}" data-name="${cloudEsc(d.original_filename)}">Repair AI text</button>
        <button class="btn danger cloud-delete-file" data-id="${cloudEsc(d.id)}" data-bucket="${cloudEsc(d.bucket_id)}" data-path="${cloudEsc(d.object_path)}">Delete</button>`:''}
      </div>
    </article>`).join('') : 'No cloud files in this category.';
}
async function repairCloudDocumentKnowledge(documentId,bucket,path,filename){
  const progress=$('cloudUploadProgress');
  try{
    if(!cloudClient||!cloudSession?.user||!selectedWorkspaceId)throw new Error('Atlas Cloud workspace is not connected.');
    if(!roleCanManageLibrary())throw new Error('Only an authorized library manager can repair AI text.');
    if(progress)progress.textContent=`Downloading ${filename} for AI text repair…`;
    const {data:blob,error:downloadError}=await cloudClient.storage.from(bucket).download(path);
    if(downloadError)throw downloadError;
    const file=new File([blob],filename||'atlas-document',{type:blob.type||''});
    const text=await extractDocumentText(file,message=>{if(progress)progress.textContent=`${filename}: ${message}`;});
    if(!text.trim())throw new Error('No machine-readable text was extracted. OCR or a text counterpart is required.');
    const result=await saveDocumentKnowledge(documentId,file,text,bucket);
    if(progress)progress.textContent=`✓ AI text repaired: ${filename} · ${result.chunks} chunk(s) · ${result.classification}`;
    return result;
  }catch(error){
    if(progress)progress.textContent=`⚠ AI text repair failed for ${filename}: ${error.message||error}`;
    throw error;
  }
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
  $('locationAccuracy').textContent=`± ${Math.round(accuracy)} m`;
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
  setPermissionBanner('locationPermissionBanner','Waiting for location permission…');
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
      <button class="captured-media-remove" type="button" data-media-index="${index}" aria-label="Remove">×</button>
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
  $('mediaUploadStatus').textContent=`✓ ${completed}/${items.length} item(s) saved in the private passage-media archive.`;
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
    $('logPositionPreview').textContent=c?`${c.latitude.toFixed(6)}, ${c.longitude.toFixed(6)} (±${Math.round(c.accuracy)} m)`:'Position not available';
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
  $('logComposeStatus').textContent='✓ Draft log entry saved. Review it before transfer to the official logbook.';
  pendingLogAudio=null;
}

function renderLogDrafts(){
  const list=$('logDraftList'); if(!list)return;
  $('logArchiveSummary').textContent=`${logDrafts.length} entries • ${logDrafts.filter(x=>x.status==='draft').length} awaiting review`;
  if(!logDrafts.length){list.innerHTML='<div class="notice">No draft entries yet.</div>';return;}
  list.innerHTML=logDrafts.map(item=>{
    const pos=item.position?`${item.position.latitude}, ${item.position.longitude} ±${item.position.accuracy_m} m`:'No position';
    return `<article class="log-entry ${cloudEsc(item.status)}">
      <div><div class="log-entry-head"><time>${cloudEsc(new Date(item.utc_iso).toLocaleString())}</time><span class="log-badge">${cloudEsc(item.category)}</span><span class="log-badge">${cloudEsc(item.status)}</span><span class="log-badge">${cloudEsc(item.source)}</span></div>
      <p>${cloudEsc(item.text)}</p><div class="log-entry-meta">UTC ${cloudEsc(item.utc_iso)} • ${cloudEsc(pos)}${item.audio_name?` • Audio: ${cloudEsc(item.audio_name)}`:''}</div></div>
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
  const command=normalized.match(/\b(?:sinbad|simbad)\s+(?:log|jurnal|günlük)\b[,:;\s-]*(.*)$/i);
  if(command){
    const entry=(command[1]||'').trim();
    if(entry){$('logDraftText').value=entry;saveLogDraft(entry,'voice-command');waitingForLogText=false;voiceStatus('Draft saved','Say “Sinbad Log” for another entry.','listening');if(!voiceWatchEnabled)try{voiceRecognition?.stop();}catch(_){}}
    else{waitingForLogText=true;voiceStatus('Sinbad is listening for the log entry','Speak the operational detail now.','capturing');}
    return;
  }
  if(waitingForLogText && clean){
    $('logDraftText').value=clean;saveLogDraft(clean,'voice-command');waitingForLogText=false;
    voiceStatus('Draft saved','Say “Sinbad Log” for another entry.','listening');
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
  voiceStatus(pushOnly?'Push to Talk is listening':'Sinbad Voice Watch is active',pushOnly?'Speak your log entry now.':'Say “Sinbad Log” followed by the entry.','listening');
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
      $('logComposeStatus').innerHTML='✓ Audio note ready. Save the draft text, and keep this file: ';
      $('logComposeStatus').append(link);
      logAudioStream?.getTracks().forEach(t=>t.stop());logAudioStream=null;logAudioRecorder=null;
    };
    logAudioRecorder.start(1000);$('recordLogAudio').disabled=true;$('stopLogAudio').disabled=false;
    $('logComposeStatus').textContent='● Recording audio locally. Press Stop Audio when finished.';
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
    setPermissionBanner('cameraPermissionBanner','● EMERGENCY EVIDENCE RECORDING — audio and video are being recorded visibly. Press Stop Recording to finish.','denied');
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
$('searchCloudFiles')?.addEventListener('click',loadCloudFiles);
$('cloudFileSearch')?.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();loadCloudFiles();}});
$('cloudBucketSelect').addEventListener('change',loadCloudFiles);
$('cloudFileList').addEventListener('click',e=>{
  const o=e.target.closest('.cloud-open-file');
  const d=e.target.closest('.cloud-download-file');
  const s=e.target.closest('.cloud-share-file');
  const r=e.target.closest('.cloud-rename-file');
  const i=e.target.closest('.cloud-index-file');
  const k=e.target.closest('.cloud-repair-knowledge');
  const x=e.target.closest('.cloud-delete-file');
  if(o)openCloudFile(o.dataset.bucket,o.dataset.path,o.dataset.name||'');
  if(d)downloadCloudFile(d.dataset.bucket,d.dataset.path,d.dataset.name);
  if(s)shareCloudFile(s.dataset.bucket,s.dataset.path,s.dataset.name);
  if(r)renameCloudFile(r.dataset.id,r.dataset.bucket,r.dataset.path,r.dataset.name);
  if(i)indexCloudDocument(i.dataset.id);
  if(k)repairCloudDocumentKnowledge(k.dataset.id,k.dataset.bucket,k.dataset.path,k.dataset.name).catch(()=>{});
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
