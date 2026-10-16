import * as THREE from 'three';
import {normalSize,sizeCommand} from './interaction-core.mjs';
// Source-declared identities; no runtime, telemetry, health or model calls.
export const ENGINE_INVENTORY=Object.freeze([
 {id:'bridge',tr:'Bridge',en:'Bridge',source:['GET /status','GET /argos/status bridge']},
 {id:'local-ai',tr:'Yerel AI',en:'Local AI',source:['GET /ai/status','GET /argos/status ai (fallback)']},
 {id:'command-gate',tr:'ARGOS',en:'ARGOS',source:['GET /argos/status']},
 {id:'library',tr:'Library',en:'Library',source:['GET /library/status','GET /status library (fallback)']},
 {id:'studio',tr:'Studio',en:'Studio',source:['GET /studio/status']}
]);
// Independent motor-only materials: source sphere materials are never mutated.
export const ENGINE_PALETTE=Object.freeze({
 bridge:{name:'Light turquoise',surface:'#9be6dc',core:'#b7f4ea',edge:'#8de3d8'},
 'local-ai':{name:'Lavender',surface:'#ccb7ef',core:'#d7c5f5',edge:'#bc9fe8'},
 'command-gate':{name:'Ice blue',surface:'#b3dafa',core:'#c4e8fc',edge:'#91c5f2'},
 library:{name:'Pearl',surface:'#ecece4',core:'#ecefe9',edge:'#c5d8d7'},
 studio:{name:'Champagne',surface:'#ead0a5',core:'#f1dec0',edge:'#dfbc84'}
});
function motorMaterials(body,id){
 const palette=ENGINE_PALETTE[id],cache=new Map();
 const clone=original=>{if(cache.has(original))return cache.get(original);const m=original.clone();
  if(m.color)m.color.set(m.isLineBasicMaterial?palette.edge:palette.surface);
  if(m.isMeshPhysicalMaterial){m.roughness=.11;m.metalness=.04;m.ior=1.47;m.clearcoat=1;m.clearcoatRoughness=.08;m.envMapIntensity=.9;m.flatShading=true;if(m.opacity<.5)m.opacity=Math.min(.28,m.opacity*1.5+.03);else m.color.set(palette.core);}
  else if(m.isMeshStandardMaterial){m.metalness=.5;m.roughness=.18;m.envMapIntensity=.9;}
  else if(m.isMeshBasicMaterial&&m.color)m.color.set(palette.core).multiplyScalar(1.05);
  if(m.emissive){m.emissive.set(palette.surface);m.emissiveIntensity=.055;}
  if(m.isLineBasicMaterial&&m.transparent)m.opacity=Math.min(.66,m.opacity*1.5+.12);
  m.needsUpdate=true;cache.set(original,m);return m;
 };
 body.traverse(node=>{if(node.material)node.material=Array.isArray(node.material)?node.material.map(clone):clone(node.material);});
}
const smooth=t=>{t=THREE.MathUtils.clamp(t,0,1);return t*t*(3-2*t);};
export class EngineRoom{
 constructor({scene,camera,canvas,mainRig,sphere,clock,canAnimate,onChange,mainMode}){
  Object.assign(this,{scene,camera,canvas,mainRig,clock,canAnimate,onChange,mainMode});this.selectedId='sinbad';this.drawing=false;this.live=true;this.observation={access:'not-requested',engines:[]};this.lang='tr';this.lastSeconds=clock();this.items=[];this.phase='overview';
  const homes=[[-4.5,1.9,-.7],[-4.0,-1.8,.6],[4.4,2.0,-1.0],[4.7,-.3,.7],[3.8,-2.3,-.3]];
  ENGINE_INVENTORY.forEach((entry,i)=>{
   const rig=new THREE.Group(),body=sphere.clone(true),remove=[];body.traverse(n=>{if(n.userData.craft||n.material?.userData.eggMap||n.material?.colorWrite===false)remove.push(n);});remove.forEach(n=>n.removeFromParent());motorMaterials(body,entry.id);rig.add(body);scene.add(rig);
   const home=new THREE.Vector3(...homes[i]),scale=.34;rig.position.copy(home);rig.scale.setScalar(scale);
   const label=document.createElement('button');label.className='engine-label';label.dataset.engine=entry.id;document.querySelector('#engine-labels').append(label);
   const button=document.createElement('button');button.dataset.engine=entry.id;document.querySelector('#engine-list').append(button);
   const point=document.createElement('span');point.className='engine-point';point.style.background=ENGINE_PALETTE[entry.id].core;point.hidden=true;document.querySelector('#view').append(point);
   for(const el of [label,button])el.addEventListener('click',()=>{this.select(entry.id);canvas.focus({preventScroll:true});});
   this.items.push({...entry,connection:'unknown',operation:'unknown',fault:'unknown',overrides:[],rig,body,home,initialHome:home.clone(),homeScale:scale,label,button,point,shell:body.getObjectByName('room-shell'),core:body.getObjectByName('room-core'),size:{...normalSize(),scale,position:home.toArray()}});
  });this.connectionArc=new THREE.Group();scene.add(this.connectionArc);this.arcMaterial=new THREE.LineBasicMaterial({color:'#9acde5',transparent:true,opacity:.26,depthWrite:false,linewidth:1});this.arcGeometry=new THREE.BufferGeometry();this.arcGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(180*3),3));this.arcLine=new THREE.LineSegments(this.arcGeometry,this.arcMaterial);this.connectionArc.add(this.arcLine);this.connectionArc.visible=false;this.setLanguage('tr');
 }

 toggleDrawing(){
  if(this.live)return;
  this.drawing=!this.drawing;
  for(const item of this.items){const fault=this.drawing&&item.id==='bridge';item.connection=fault?'sample-connected':'unknown';item.fault=fault?'sample-fault':'unknown';
   if(fault&&!item.overrides.length){const mats=new Map();item.body.traverse(n=>{if(!n.material)return;const original=n.material;const clone=m=>{if(!mats.has(m)){const red=m.clone();if(red.color)red.color.set('#e74943');if(red.emissive){red.emissive.set('#8f1613');red.emissiveIntensity=Math.max(.12,red.emissiveIntensity||0);}mats.set(m,red);}return mats.get(m);};const replacement=Array.isArray(original)?original.map(clone):clone(original);item.overrides.push({node:n,original,replacement});});}
   for(const m of item.overrides)m.node.material=fault?m.replacement:m.original;item.point.style.background=fault?'#e74943':ENGINE_PALETTE[item.id].core;
  }this.updateArc(this.clock());this.setLanguage(this.lang);this.onChange();
 }
 updateArc(seconds){
  const item=this.items.find(i=>i.id==='bridge');this.connectionArc.visible=this.drawing&&item.connection==='sample-connected';if(!this.connectionArc.visible){this.arcGeometry.setDrawRange(0,0);return;}
  const dir=item.rig.position.clone().sub(this.mainRig.position).normalize(),a=this.mainRig.position.clone().addScaledVector(dir,2.74*this.mainRig.scale.x),b=item.rig.position.clone().addScaledVector(dir,-2.74*item.rig.scale.x),length=a.distanceTo(b),side=new THREE.Vector3().crossVectors(dir,new THREE.Vector3(0,1,0));if(side.lengthSq()<.01)side.set(1,0,0);side.normalize();const up=new THREE.Vector3().crossVectors(dir,side).normalize();let seed=(Math.floor(seconds*4)+17)|0;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return((seed>>>0)/4294967295)*2-1;};const pts=[];
  for(let i=0;i<=18;i++){const t=i/18,envelope=t*(1-t)*Math.min(.7,length*.4);pts.push(a.clone().lerp(b,t).addScaledVector(side,rnd()*envelope).addScaledVector(up,rnd()*envelope));}
  const values=[];for(let i=1;i<pts.length;i++)values.push(...pts[i-1],...pts[i]);for(const at of [5,11,14]){let prev=pts[at];for(let j=1;j<=4;j++){const next=pts[at].clone().addScaledVector(dir,j*length*.025).addScaledVector(side,rnd()*.12+j*.06).addScaledVector(up,rnd()*.14-j*.025);values.push(...prev,...next);prev=next;}}
  const aPos=this.arcGeometry.attributes.position;aPos.array.set(values);aPos.needsUpdate=true;this.arcGeometry.setDrawRange(0,values.length/3);this.arcGeometry.computeBoundingSphere();
 }
 get active(){return this.items.find(i=>i.id===this.selectedId)||null;}
 get activeShell(){return this.active?.shell;}
 select(id){
  if(id===this.selectedId||!(id==='sinbad'||this.items.some(i=>i.id===id)))return;
  this.selectedId=id;const dir=this.camera.position.clone().normalize(),right=new THREE.Vector3().crossVectors(this.camera.up,dir).normalize();
  this.fromMain=this.mainRig.position.clone();this.toMain=id==='sinbad'?new THREE.Vector3():dir.clone().multiplyScalar(-6).addScaledVector(right,-8.3).addScaledVector(this.camera.up,2.2);
  for(const item of this.items){item.from=item.rig.position.clone();item.fromScale=item.rig.scale.x;item.to=id===item.id?dir.clone().multiplyScalar(this.camera.position.length()*.42):item.home.clone().multiplyScalar(id==='sinbad'?1:1.5).addScaledVector(dir,id==='sinbad'?0:-5);item.toScale=id===item.id?.88:item.homeScale;item.size={...normalSize(),scale:item.toScale,position:item.to.toArray()};}
  this.started=this.clock();this.duration=this.canAnimate()?.65:0;this.phase=id==='sinbad'?'returning':'selecting';this.setLanguage(this.lang);this.onChange();
 }
 resetLayout(){this.endMove();for(const item of this.items)item.home.copy(item.initialHome);this.selectedId=null;this.select('sinbad');}
 beginMove(id,event){
  const item=this.items.find(i=>i.id===id);if(!item)return false;
  const rect=this.canvas.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2),this.camera);
  const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(this.camera.getWorldDirection(new THREE.Vector3()),item.rig.position),anchor=ray.ray.intersectPlane(plane,new THREE.Vector3());if(!anchor)return false;
  this.move={item,plane,anchor,position:item.rig.position.clone(),home:item.home.clone(),size:JSON.parse(JSON.stringify(item.size))};item.from=null;return true;
 }
 moveMotor(event){
  const m=this.move;if(!m)return;const rect=this.canvas.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2),this.camera);
  const hit=ray.ray.intersectPlane(m.plane,new THREE.Vector3());if(!hit)return;const delta=hit.sub(m.anchor),item=m.item;item.rig.position.copy(m.position).add(delta);item.home.copy(m.home).add(delta);item.to=item.rig.position.clone();
  item.size={...m.size,position:item.rig.position.toArray(),snapshot:m.size.snapshot?{...m.size.snapshot,position:new THREE.Vector3(...m.size.snapshot.position).add(delta).toArray()}:null};this.onChange();
 }
 endMove(){this.move=null;}
 command(which){
  const item=this.active;if(!item)return false;const fit=this.camera.position.distanceTo(item.rig.position)*Math.tan(THREE.MathUtils.degToRad(this.camera.fov/2))*Math.min(1,this.camera.aspect)*.82/2.74;
  item.size=sizeCommand({...item.size,scale:item.rig.scale.x,position:item.rig.position.toArray()},which,fit);this.onChange();return true;
 }
 rotateShell(delta,targetId=this.selectedId){
  const item=this.items.find(i=>i.id===targetId);if(!item)return false;const parent=item.body.getWorldQuaternion(new THREE.Quaternion()),cq=this.camera.quaternion,local=parent.clone().invert().multiply(cq).multiply(delta).multiply(cq.clone().invert()).multiply(parent);item.shell.quaternion.premultiply(local).normalize();this.onChange();return true;
 }
 pick(event){
  const rect=this.canvas.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2),this.camera);
  const hits=[];for(const item of this.items){if(item.size.mode==='point'){const p=item.rig.position.clone().project(this.camera),x=rect.left+(p.x*.5+.5)*rect.width,y=rect.top+(-p.y*.5+.5)*rect.height;if(Math.hypot(event.clientX-x,event.clientY-y)<36)hits.push({id:item.id,distance:this.camera.position.distanceTo(item.rig.position)});continue;}const point=ray.ray.intersectSphere(new THREE.Sphere(item.rig.position,2.74*item.rig.scale.x),new THREE.Vector3());if(point)hits.push({id:item.id,distance:point.distanceTo(this.camera.position)});}
  if(this.mainMode()==='point'){const p=this.mainRig.position.clone().project(this.camera),x=rect.left+(p.x*.5+.5)*rect.width,y=rect.top+(-p.y*.5+.5)*rect.height;if(Math.hypot(event.clientX-x,event.clientY-y)<36)hits.push({id:'sinbad',distance:this.camera.position.distanceTo(this.mainRig.position)});}else{const point=ray.ray.intersectSphere(new THREE.Sphere(this.mainRig.position,2.74*this.mainRig.scale.x),new THREE.Vector3());if(point)hits.push({id:'sinbad',distance:point.distanceTo(this.camera.position)});}
  hits.sort((a,b)=>a.distance-b.distance);return hits[0]?.id||null;
 }
 setObservation(value){
  this.observation=value;this.drawing=false;this.connectionArc.visible=false;
  for(const item of this.items){const row=value.engines?.find(e=>e.id===item.id);item.observed=row||null;const fault=row?.kind==='fault'&&row.recordClass==='current';
   if(fault&&!item.overrides.length){const materials=new Map();item.body.traverse(node=>{if(!node.material)return;const original=node.material,clone=m=>{if(!materials.has(m)){const red=m.clone();if(red.color)red.color.set('#e74943');if(red.emissive)red.emissive.set('#8f1613');materials.set(m,red);}return materials.get(m);};item.overrides.push({node,original,replacement:Array.isArray(original)?original.map(clone):clone(original)});});}
   for(const m of item.overrides)m.node.material=fault?m.replacement:m.original;item.point.style.background=fault?'#e74943':ENGINE_PALETTE[item.id].core;
   item.connection=row?.connection||'unknown';item.operation='unknown';item.fault=fault?'observed-fault':'unknown';
  }this.setLanguage(this.lang);this.onChange();
 }
 paintObservation(){
  const tr=this.lang==='tr',item=this.active,detail=document.querySelector('#engine-detail');document.querySelector('#live-status').textContent=this.observation.reason|| (tr?'Ölçüm istenmedi.':'Observation not requested.');
  if(!item)return;const row=item.observed;detail.replaceChildren();const lines=[['h2',item[this.lang]],['strong',row?.label||(tr?'Veri yok':'No data')],['p',tr?'Bağlantı: '+(row?.connection==='source-response'?'Kaynak yanıtı alındı; anlık bağlantı ölçülmedi.':row?.connection==='access-denied'?'Kaynak erişimi reddetti.':row?.connection==='unavailable'?'Kaynağa ulaşılamadı.':'Bilinmiyor.'):'Connection: '+(row?.connection==='source-response'?'Source response received; current connectivity is unmeasured.':row?.connection==='access-denied'?'Source access denied.':row?.connection==='unavailable'?'Source unavailable.':'Unknown.')],['p',tr?'Çalışma: Bilinmiyor; online alanı iş yükü ölçümü değildir.':'Operation: Unknown; online is not a workload measurement.'],['p',tr?'Arıza: '+(item.fault==='observed-fault'?'Kaynak FAULT bildiriyor.':'Bilinmiyor; veri yokluğu arıza değildir.'):'Fault: '+(item.fault==='observed-fault'?'Source reports FAULT.':'Unknown; missing data is not a fault.')],['p',row?.time||(tr?'Kaynak ölçüm zamanı yok.':'Source measurement time absent.')],['p',(tr?'Kaynak: ':'Source: ')+(row?.sources?.join(' · ')||(tr?'Yanıt yok':'No response'))],['p',(row?.probeErrors||[]).map(e=>e.path+' · HTTP '+e.http).join(' / ')],['p',(tr?'Kayıt: ':'Record: ')+(row?.recordClass||'unverified')],['p',tr?'Sağlık ölçümü yok. Tüm kaynak kayıtları Ayrıntılar görünümünde.':'No health measurement. All source records remain in Details.']];
  for(const[tag,text]of lines){const el=document.createElement(tag);el.textContent=text;detail.append(el);}
 }
 setLanguage(lang){
  this.lang=lang;const tr=lang==='tr',no=tr?'Ölçüm yok':'No measurement';for(const item of this.items){item.label.textContent=item[lang];item.button.textContent=item[lang];item.button.setAttribute('aria-pressed',String(item.id===this.selectedId));}
  const sample=document.querySelector('#room-sample');sample.hidden=!this.drawing;sample.textContent=tr?'ÇİZİM / ÖRNEK VERİ · Gerçek ölçüm değil':'DRAWING / SAMPLE DATA · Not a real measurement';document.querySelector('#arc-preview').setAttribute('aria-pressed',String(this.drawing));
  document.querySelector('#engine-close').textContent=tr?'Genel görünüm':'Overview';const detail=document.querySelector('#engine-detail'),item=this.active;detail.hidden=!item;document.querySelector('#engine-close').hidden=!item;
  if(item){detail.replaceChildren();for(const[tag,text]of[['h2',item[lang]],['strong',this.drawing?(tr?'ÇİZİM / ÖRNEK VERİ':'DRAWING / SAMPLE DATA'):no],['p',tr?'Kaynakta tanımlı motor · canlı bağlantı doğrulanmadı.':'Source-defined engine · live connection unverified.'],['p',tr?'Çalışma ve sağlık durumu bilinmiyor. Bu görünüm telemetri okumaz.':'Operation and health are unknown. This view reads no telemetry.']]){const el=document.createElement(tag);el.textContent=text;detail.append(el);}for(const[label,value]of [[tr?'Bağlantı':'Connection',item.connection==='sample-connected'?(tr?'Örnek bağlı':'Sample connected'):(tr?'Bilinmiyor':'Unknown')],[tr?'Çalışma':'Operation',tr?'Bilinmiyor':'Unknown'],[tr?'Arıza':'Fault',item.fault==='sample-fault'?(tr?'Örnek arıza':'Sample fault'):(tr?'Bilinmiyor':'Unknown')]]){const line=document.createElement('p');line.textContent=label+': '+value;detail.append(line);}}
   if(this.live)this.paintObservation();
 }

 update(seconds,manual){
  const dt=Math.max(0,seconds-this.lastSeconds);this.lastSeconds=seconds;const axis=new THREE.Vector3(.21,1,.37).normalize(),shellAxis=new THREE.Vector3(.8,-.3,.5).normalize();
  let t=1;if(this.phase==='selecting'||this.phase==='returning'){t=this.duration?smooth((seconds-this.started)/this.duration):1;if(!this.canAnimate())t=1;this.mainRig.position.lerpVectors(this.fromMain,this.toMain,t);if(t>=1)this.phase=this.selectedId==='sinbad'?'overview':'focused';}else if(this.toMain)this.mainRig.position.copy(this.toMain);
  const rect=this.canvas.getBoundingClientRect();for(const item of this.items){
   if(item.from){if(t>=1){item.rig.position.copy(item.to);item.rig.scale.setScalar(item.toScale);}else{item.rig.position.lerpVectors(item.from,item.to,t);item.rig.scale.setScalar(THREE.MathUtils.lerp(item.fromScale,item.toScale,t));}}
   if(item.size.mode!=='normal'||item.size.snapshot){item.rig.position.fromArray(item.size.position);item.rig.scale.setScalar(item.size.scale);}
   item.body.visible=item.size.mode!=='point';item.point.hidden=item.size.mode!=='point';
   item.core.quaternion.setFromAxisAngle(axis,seconds*.60*Math.PI*2);if(!manual&&dt)item.shell.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(shellAxis,dt*.045*Math.PI*2));
   const p=item.rig.position.clone().project(this.camera),x=(p.x*.5+.5)*rect.width,y=(-p.y*.5+.5)*rect.height,r=2.74*item.rig.scale.x/this.camera.position.distanceTo(item.rig.position)*rect.height/(2*Math.tan(THREE.MathUtils.degToRad(this.camera.fov/2)));
   item.label.hidden=this.selectedId!=='sinbad'||p.z>1||p.z< -1;item.label.style.left=(item.id==='library'?x+r+12:x)+'px';item.label.style.top=(item.id==='library'?y-17:y+r+9)+'px';item.point.style.left=x+'px';item.point.style.top=y+'px';
  }this.layoutLabels(rect);this.updateArc(seconds);
 }
 layoutLabels(rect){
  const placed=[];for(const item of this.items){if(item.label.hidden)continue;const el=item.label,w=el.offsetWidth,h=el.offsetHeight;if(!w||!h)continue;
   const center=Number.parseFloat(el.style.left),base=Number.parseFloat(el.style.top),x=Math.max(5,Math.min(rect.width-w-5,center-(item.id==='library'?0:w/2)));let y=Math.max(5,Math.min(rect.height-h-5,base));
   for(let step=0;step<18;step++){const candidate=Math.max(5,Math.min(rect.height-h-5,base+(step%2?1:-1)*Math.ceil(step/2)*(h+5))),box={x,y:candidate,w,h};
    if(!placed.some(p=>box.x<p.x+p.w+5&&box.x+box.w+5>p.x&&box.y<p.y+p.h+5&&box.y+box.h+5>p.y)){y=candidate;break;}}
   el.style.left=(item.id==='library'?x:x+w/2)+'px';el.style.top=y+'px';placed.push({x,y,w,h});
  }
 }
 get state(){return{selectedId:this.selectedId,phase:this.phase,liveTelemetry:this.observation.access==='record',observation:this.observation,drawing:this.drawing,moving:this.move?.item.id||null,connectionArc:{visible:this.connectionArc.visible,branches:3,thin:true,opacity:.26,strobe:false,start:this.arcGeometry.attributes.position.array.slice(0,3),end:this.arcGeometry.attributes.position.array.slice(105,108)},mainPosition:this.mainRig.position.toArray(),engines:this.items.map(i=>({id:i.id,name:i[this.lang],registration:'source-defined; runtime unverified',measurement:null,connection:i.connection,operation:i.operation,fault:i.fault,status:this.lang==='tr'?'Ölçüm yok':'No measurement',position:i.rig.position.toArray(),home:i.home.toArray(),initialHome:i.initialHome.toArray(),scale:i.rig.scale.x,size:JSON.parse(JSON.stringify(i.size)),shellQuaternion:i.shell.quaternion.toArray(),coreQuaternion:i.core.quaternion.toArray(),geometryShared:true,projected:i.rig.position.clone().project(this.camera).toArray()}))};}
}
