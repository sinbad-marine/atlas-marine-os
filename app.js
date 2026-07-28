
const $=id=>document.getElementById(id);
const get=(k)=>JSON.parse(localStorage.getItem(k)||'[]');
const set=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
let currentCalc=null, alertFilter='all';

function openWorkspace(id){document.querySelectorAll('.workspace').forEach(x=>x.classList.remove('active'));$(id).classList.add('active');$(id).scrollIntoView({behavior:'smooth'});renderAll()}
function closeWorkspaces(){document.querySelectorAll('.workspace').forEach(x=>x.classList.remove('active'));scrollTo({top:0,behavior:'smooth'})}
document.querySelectorAll('[data-open]').forEach(x=>x.addEventListener('click',()=>openWorkspace(x.dataset.open)));
document.querySelectorAll('.close').forEach(x=>x.addEventListener('click',closeWorkspaces));

function daysUntil(dateStr){if(!dateStr)return null;const today=new Date();today.setHours(0,0,0,0);return Math.ceil((new Date(dateStr+'T00:00:00')-today)/86400000)}
function statusText(d){const n=daysUntil(d);if(n===null)return 'No expiry';if(n<0)return `Expired ${Math.abs(n)}d`;return `${n}d left`}
function formatHours(h){const w=Math.floor(h),m=Math.round((h-w)*60);return `${w}h ${m}m`}

function saveVessel(){
 const name=$('vName').value.trim();if(!name){alert('Enter vessel name.');return}
 const a=get('atlas_fleet');a.unshift({name,type:$('vType').value.trim(),flag:$('vFlag').value.trim(),loa:$('vLoa').value,beam:$('vBeam').value,draft:$('vDraft').value,cruise:$('vCruise').value,max:$('vMax').value,fuel:$('vFuel').value,water:$('vWater').value,call:$('vCall').value.trim(),mmsi:$('vMmsi').value.trim(),notes:$('vNotes').value.trim()});set('atlas_fleet',a);
 ['vName','vType','vFlag','vLoa','vBeam','vDraft','vCruise','vMax','vFuel','vWater','vCall','vMmsi','vNotes'].forEach(id=>$(id).value='');renderAll()
}
function renderFleet(){const a=get('atlas_fleet');$('fleetList').innerHTML=!a.length?'<div class="empty">No vessel records.</div>':a.map((v,i)=>`<article class="record"><h3>${esc(v.name)}</h3><div class="muted">${esc(v.type||'Vessel')} • ${esc(v.flag||'Flag not entered')}</div><p><b>LOA:</b> ${esc(v.loa||'—')} m • <b>Beam:</b> ${esc(v.beam||'—')} m • <b>Draft:</b> ${esc(v.draft||'—')} m</p><p><b>Cruise:</b> ${esc(v.cruise||'—')} kn • <b>Fuel:</b> ${esc(v.fuel||'—')} L • <b>Water:</b> ${esc(v.water||'—')} L</p><p class="warning">${esc(v.notes||'No machinery notes.')}</p><button class="btn danger" onclick="deleteItem('atlas_fleet',${i})">Delete</button></article>`).join('')}
$('saveVessel').onclick=saveVessel;$('exportFleet').onclick=()=>downloadJSON('atlas-marine-fleet.json',get('atlas_fleet'));

function setupPilot(){[...new Set(PILOT_DATA.map(x=>x.country))].sort().forEach(x=>$('countryFilter').insertAdjacentHTML('beforeend',`<option>${esc(x)}</option>`));[...new Set(PILOT_DATA.map(x=>x.type))].sort().forEach(x=>$('typeFilter').insertAdjacentHTML('beforeend',`<option>${esc(x)}</option>`))}
function renderPilot(){const q=$('pilotSearch').value.toLowerCase(),c=$('countryFilter').value,t=$('typeFilter').value;const rows=PILOT_DATA.filter(x=>(!c||x.country===c)&&(!t||x.type===t)&&(!q||JSON.stringify(x).toLowerCase().includes(q)));$('pilotGrid').innerHTML=rows.map((x,i)=>{const key=`${x.country}|${x.name}`,note=localStorage.getItem('pilotnote:'+key)||'';return `<article class="record"><h3>${esc(x.name)}</h3><div class="muted">${esc(x.country)} • ${esc(x.region)}</div><span class="badge">${esc(x.type)}</span><span class="badge">VHF: ${esc(x.vhf)}</span><p>${esc(x.approach)}</p><p class="warning"><b>Captain note:</b> ${esc(x.captainNote)}</p><textarea id="pn${i}">${esc(note)}</textarea><button class="btn primary" onclick="localStorage.setItem('pilotnote:${esc(key)}',$('pn${i}').value)">Save Note</button></article>`}).join('')||'<div class="empty">No matching pilot records.</div>'}

function setupRoutes(){[...new Set(ROUTE_DATA.map(x=>x.type))].sort().forEach(x=>$('routeType').insertAdjacentHTML('beforeend',`<option>${esc(x)}</option>`));[...new Set(ROUTE_DATA.map(x=>x.status))].sort().forEach(x=>$('routeStatus').insertAdjacentHTML('beforeend',`<option>${esc(x)}</option>`))}
function renderRoutes(){const q=$('routeSearch').value.toLowerCase(),t=$('routeType').value,s=$('routeStatus').value;const rows=ROUTE_DATA.filter(x=>(!t||x.type===t)&&(!s||x.status===s)&&(!q||JSON.stringify(x).toLowerCase().includes(q)));$('routeGrid').innerHTML=rows.map((x,i)=>{const key='route:'+x.title,note=localStorage.getItem(key)||'';return `<article class="record"><h3>${esc(x.title)}</h3><div class="muted">${esc(x.type)} • ${esc(x.status)}</div><span class="badge">${esc(x.vessel)}</span><p><b>Route:</b> ${x.stops.map(esc).join(' → ')}</p><p class="warning">${esc(x.note)}</p><textarea id="rn${i}">${esc(note)}</textarea><button class="btn primary" onclick="localStorage.setItem('${esc(key)}',$('rn${i}').value)">Save Note</button></article>`}).join('')||'<div class="empty">No matching routes.</div>'}

$('calcPassage').onclick=()=>{const d=parseFloat($('distance').value),s=parseFloat($('speed').value),rate=parseFloat($('fuelRate').value)||0,res=parseFloat($('reserve').value)||0;if(!(d>0&&s>0)){alert('Distance and speed must be greater than zero.');return}const h=d/s,dt=$('departTime').value?new Date($('departTime').value):new Date(),eta=new Date(dt.getTime()+h*3600000),fuel=rate*h*(1+res/100);currentCalc={departure:$('dep').value.trim(),arrival:$('arr').value.trim(),distance:d,speed:s,hours:h,eta:eta.toISOString(),fuel,note:$('passageNote').value.trim()};$('rTime').textContent=formatHours(h);$('rEta').textContent=eta.toLocaleString();$('rFuel').textContent=rate?fuel.toFixed(1)+' L':'—';$('rAvg').textContent=s.toFixed(1)+' kn'}
$('savePassage').onclick=()=>{if(!currentCalc)$('calcPassage').click();if(!currentCalc)return;const a=get('atlas_passages');a.unshift(currentCalc);set('atlas_passages',a);renderAll()}
function renderPassages(){const a=get('atlas_passages');$('passages').innerHTML=!a.length?'<div class="empty">No saved passages.</div>':'<table><tr><th>Route</th><th>Distance</th><th>Speed</th><th>Time</th><th></th></tr>'+a.map((x,i)=>`<tr><td>${esc(x.departure||'—')} → ${esc(x.arrival||'—')}</td><td>${x.distance} NM</td><td>${x.speed} kn</td><td>${formatHours(x.hours)}</td><td><button class="btn danger" onclick="deleteItem('atlas_passages',${i})">Delete</button></td></tr>`).join('')+'</table>'}

$('saveLog').onclick=()=>{const text=$('logText').value.trim();if(!text){alert('Enter a log note.');return}const a=get('atlas_logs');a.unshift({date:$('logDate').value||new Date().toISOString().slice(0,10),position:$('logPosition').value.trim(),weather:$('logWeather').value.trim(),text});set('atlas_logs',a);$('logText').value='';renderAll()}
function renderLogs(){const a=get('atlas_logs');$('logs').innerHTML=!a.length?'<div class="empty">No log entries.</div>':'<table><tr><th>Date</th><th>Position</th><th>Weather</th><th>Entry</th><th></th></tr>'+a.map((x,i)=>`<tr><td>${esc(x.date)}</td><td>${esc(x.position||'—')}</td><td>${esc(x.weather||'—')}</td><td>${esc(x.text)}</td><td><button class="btn danger" onclick="deleteItem('atlas_logs',${i})">Delete</button></td></tr>`).join('')+'</table>'}

$('saveCrew').onclick=()=>{const name=$('crewName').value.trim();if(!name){alert('Enter crew member name.');return}const a=get('atlas_crew');a.unshift({name,rank:$('crewRank').value.trim(),nationality:$('crewNationality').value.trim(),passport:$('crewPassport').value,medical:$('crewMedical').value,stcw:$('crewStcw').value,visa:$('crewVisa').value,contract:$('crewContract').value,contact:$('crewContact').value.trim(),notes:$('crewNotes').value.trim()});set('atlas_crew',a);renderAll()}
$('exportCrew').onclick=()=>downloadJSON('atlas-marine-crew.json',get('atlas_crew'));
function renderCrew(){const a=get('atlas_crew');$('crewList').innerHTML=!a.length?'<div class="empty">No crew records.</div>':a.map((c,i)=>`<article class="record"><h3>${esc(c.name)}</h3><div class="muted">${esc(c.rank||'Rank not entered')} • ${esc(c.nationality||'Nationality not entered')}</div><p>Passport: ${statusText(c.passport)} • Medical: ${statusText(c.medical)} • STCW: ${statusText(c.stcw)} • Visa: ${statusText(c.visa)} • Contract: ${statusText(c.contract)}</p><p class="warning">${esc(c.notes||'—')}</p><button class="btn danger" onclick="deleteItem('atlas_crew',${i})">Delete</button></article>`).join('')}

$('saveDoc').onclick=()=>{const name=$('docName').value.trim();if(!name){alert('Enter document name.');return}const a=get('atlas_docs');a.unshift({name,cat:$('docCat').value,exp:$('docExp').value});set('atlas_docs',a);renderAll()}
function renderDocs(){const a=get('atlas_docs');$('docList').innerHTML=!a.length?'<div class="empty">No documents.</div>':'<table><tr><th>Name</th><th>Category</th><th>Expiry</th><th>Status</th><th></th></tr>'+a.map((x,i)=>`<tr><td>${esc(x.name)}</td><td>${esc(x.cat)}</td><td>${esc(x.exp||'—')}</td><td>${esc(statusText(x.exp))}</td><td><button class="btn danger" onclick="deleteItem('atlas_docs',${i})">Delete</button></td></tr>`).join('')+'</table>'}

function buildAlerts(){
 const out=[];
 get('atlas_crew').forEach(c=>[['Passport',c.passport],['Medical',c.medical],['STCW',c.stcw],['Visa',c.visa],['Contract',c.contract]].forEach(([type,date])=>{const days=daysUntil(date);if(days!==null&&days<=90)out.push({source:c.name,type,date,days})}));
 get('atlas_docs').forEach(d=>{const days=daysUntil(d.exp);if(days!==null&&days<=90)out.push({source:d.name,type:d.cat,date:d.exp,days})});
 return out.sort((a,b)=>a.days-b.days)
}
function renderAlerts(){let a=buildAlerts();if(alertFilter==='expired')a=a.filter(x=>x.days<0);if(alertFilter==='30')a=a.filter(x=>x.days>=0&&x.days<=30);if(alertFilter==='90')a=a.filter(x=>x.days>30&&x.days<=90);$('alertList').innerHTML=!a.length?'<div class="empty">No alerts in this category.</div>':a.map(x=>`<article class="alert ${x.days<0?'expired':''}"><b>${esc(x.source)}</b><div>${esc(x.type)} • ${esc(x.date)} • ${esc(statusText(x.date))}</div></article>`).join('')}
document.querySelectorAll('[data-alert-filter]').forEach(x=>x.onclick=()=>{alertFilter=x.dataset.alertFilter;renderAlerts()});

function deleteItem(key,i){const a=get(key);a.splice(i,1);set(key,a);renderAll()}
function downloadJSON(name,data){const b=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=name;a.click();URL.revokeObjectURL(u)}
function renderSummary(){$('sumFleet').textContent=get('atlas_fleet').length;$('sumCrew').textContent=get('atlas_crew').length;$('sumDocs').textContent=get('atlas_docs').length;$('sumAlerts').textContent=buildAlerts().length}
function renderAll(){renderFleet();renderPilot();renderRoutes();renderPassages();renderLogs();renderCrew();renderDocs();renderAlerts();renderSummary()}

['pilotSearch','countryFilter','typeFilter'].forEach(id=>$(id).addEventListener(id==='pilotSearch'?'input':'change',renderPilot));
['routeSearch','routeType','routeStatus'].forEach(id=>$(id).addEventListener(id==='routeSearch'?'input':'change',renderRoutes));

document.addEventListener('DOMContentLoaded',()=>{setupPilot();setupRoutes();$('logDate').value=new Date().toISOString().slice(0,10);renderAll()});
if('serviceWorker'in navigator)addEventListener('load',()=>navigator.serviceWorker.register('./sw.js'));
