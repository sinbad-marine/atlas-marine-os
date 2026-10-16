import * as THREE from 'three';
import { BalanceScene } from './balance-scene.mjs';
import { EngineRoom } from './engine-room.mjs';
import { VARIANTS, TEXT } from './variants.mjs';
import { normalSize, sizeCommand, ClickSeries, CLICK_SERIES_MS, isDrag } from './interaction-core.mjs';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// A local visual study. No telemetry, models, account APIs or external requests.
const REVISION = 'engine-room-r25-integrated';
const canvas = document.querySelector('#scene');
const hint = document.querySelector('#hint');
const reduced = window.__SINBAD_REDUCED_QUERY = matchMedia('(prefers-reduced-motion: reduce)');
// Production embed never enables prototype benchmark/diagnostic URL flags.
const params = new URLSearchParams();
let embeddedActive=false;
let softwareWebGL=false, rasterBudget=1800000;
const errors = [];
addEventListener('error', e => errors.push(String(e.message)));
addEventListener('unhandledrejection', e => errors.push(String(e.reason)));
let renderer, composer, bloom, scene, camera, sphere, structure, core, objectRig, keyLight, rimLight, fillLight;
let variant=5,lang=params.get('lang')==='en'?'en':'tr',sizeState=normalSize();
if(!VARIANTS.some(v=>v.id===variant))variant=1;
let engraving=null,engravingOccluders=[],balanceScene,engineRoom;let pendingEngine=null;
let switches=0,motionStopped=false;const eventHistory=[],resourceHistory=[];
let arcTimer=0,arcBurst=null,arcSpawnCount=0,lastArcEndpoints=[],lastArcPaint=0;
const currentProfile=()=>VARIANTS[variant-1];
let inputTraceTimer=0;
const logEvent=(type,detail={})=>{eventHistory.push({type,at:performance.now(),...detail});if(eventHistory.length>200)eventHistory.shift();if(params.has('measure')&&/secondary|contextmenu|shell-control|pointer-left|native-/.test(type)&&window.__SINBAD_STUDY?.lastMeasurement){clearTimeout(inputTraceTimer);inputTraceTimer=setTimeout(()=>{const record=window.__SINBAD_STUDY.lastMeasurement;record.inputTrace=[...eventHistory];record.pageURL=location.href;sendMeasurement(record);},500);}};
const pointElement=document.querySelector('#point');
let frame = 0, dirty = true, slow = false, benchmark = null, lastTime = 0, lastMotion = 0;
let renderedFrames = 0, hiddenFrames = 0, yaw = 0, pitch = 0, distance = 18;
const layers = [], disposables = [], baseRotation = new THREE.Euler(.13, -.17, .05);
const blue = new THREE.Color('#73c8ff'), gold = new THREE.Color('#eac584');
const clamp = THREE.MathUtils.clamp;
const CORE_RPS=.60, SHELL_RPS=.22, BALANCE_RPS=.045;
const shellRate=()=>variant===4?SHELL_RPS:variant===5?BALANCE_RPS:0;
const coreAxis=new THREE.Vector3(.21,1,.37).normalize(),shellAxis=new THREE.Vector3(.8,-.3,.5).normalize();
let motionSeconds=0,shellAutoAngle=0,shellManual=false,manualPointer=null,manualMoves=0,auditTimer=0;
let clearPointerInput=()=>{manualPointer=null;};
let readInputState=()=>null;
const shellStep=new THREE.Quaternion();
const fastMotionAllowed=()=>embeddedActive&&!reduced.matches&&!motionStopped&&!document.hidden&&sizeState.mode!=='point';

function fail(message) {
  document.querySelector('#loading').hidden = true;
  document.querySelector('#failure').hidden = false;
  document.querySelector('#failure-detail').textContent = message;
  for (const button of document.querySelectorAll('button')) button.disabled = true;
  canvas.hidden = true;
}

function environment() {
  // Procedural reflection lights only. This canvas is not the scene/background.
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
  const ctx = c.getContext('2d'); ctx.fillStyle = '#02050a'; ctx.fillRect(0,0,1024,512);
  const glow = (x,y,rx,ry,color) => {
    ctx.save();ctx.translate(x,y);ctx.scale(rx,ry);
    const g=ctx.createRadialGradient(0,0,0,0,0,1);g.addColorStop(0,color);g.addColorStop(.35,color);g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g;ctx.fillRect(-1,-1,2,2);ctx.restore();
  };
  glow(220,150,110,160,'rgba(213,239,255,1)');
  glow(720,200,80,210,'rgba(130,186,231,.8)');
  glow(475,310,120,70,'rgba(250,218,166,.85)');
  glow(930,80,160,60,'rgba(165,205,240,.6)');
  const texture=new THREE.CanvasTexture(c); texture.mapping=THREE.EquirectangularReflectionMapping;texture.colorSpace=THREE.SRGBColorSpace;
  const pmrem=new THREE.PMREMGenerator(renderer);const result=pmrem.fromEquirectangular(texture);
  texture.dispose();pmrem.dispose();disposables.push(result);return result.texture;
}

function polar(radius, theta, phi) {
  return new THREE.Vector3(radius*Math.sin(theta)*Math.cos(phi),radius*Math.sin(theta)*Math.sin(phi),radius*Math.cos(theta));
}

function panelGeometry(r, thick, a, b, p, sweep) {
  // Closed, curved 3D volume with independent inner and outer surfaces.
  const nu=14,nv=4,positions=[],indices=[],normals=[];
  const side=(radius,sign)=>{
    for(let v=0;v<=nv;v++)for(let u=0;u<=nu;u++){
      const t=a+(b-a)*v/nv,f=p+sweep*u/nu,pt=polar(radius,t,f),n=pt.clone().normalize().multiplyScalar(sign);
      positions.push(pt.x,pt.y,pt.z);normals.push(n.x,n.y,n.z);
    }
  };
  side(r,1);side(r-thick,-1);const n=(nu+1)*(nv+1);
  for(let v=0;v<nv;v++)for(let u=0;u<nu;u++){
    const q=v*(nu+1)+u;
    indices.push(q,q+nu+1,q+1,q+1,q+nu+1,q+nu+2);
    indices.push(n+q,n+q+1,n+q+nu+1,n+q+1,n+q+nu+2,n+q+nu+1);
  }
  const edge=[];
  for(let u=0;u<=nu;u++)edge.push(u);
  for(let v=1;v<=nv;v++)edge.push(v*(nu+1)+nu);
  for(let u=nu-1;u>=0;u--)edge.push(nv*(nu+1)+u);
  for(let v=nv-1;v>0;v--)edge.push(v*(nu+1));
  for(let i=0;i<edge.length;i++){
    const x=edge[i],y=edge[(i+1)%edge.length];indices.push(x,n+x,y,y,n+x,n+y);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();
  return g;
}

function panelBorder(r,a,b,p,sweep) {
  const points=[];
  for(let i=0;i<=28;i++)points.push(polar(r,a,p+sweep*i/28));
  for(let i=1;i<=8;i++)points.push(polar(r,a+(b-a)*i/8,p+sweep));
  for(let i=1;i<=28;i++)points.push(polar(r,b,p+sweep*(1-i/28)));
  for(let i=1;i<=8;i++)points.push(polar(r,b-(b-a)*i/8,p));
  return new THREE.BufferGeometry().setFromPoints(points);
}

function arc(radius, thickness, angle, material, rotation=[0,0,0], start=0, parent=structure) {
  const g=new THREE.TorusGeometry(radius,thickness,6,Math.max(32,Math.round(144*angle/(Math.PI*2))),angle);
  const mesh=new THREE.Mesh(g,material);mesh.rotation.set(...rotation);mesh.rotateZ(start);parent.add(mesh);return mesh;
}

function makeSphere(profile) {
  sphere=new THREE.Group();sphere.rotation.copy(baseRotation);objectRig.add(sphere);
  structure=new THREE.Group();sphere.add(structure);shellAutoAngle=0;manualPointer=null;
  engraving=null;engravingOccluders=[];
  const engravingDepth=new THREE.MeshBasicMaterial({transparent:true,colorWrite:false,depthWrite:true,side:THREE.FrontSide});
  const coreMaterial=new THREE.MeshPhysicalMaterial(profile.legacy
    ? {color:'#f2c76f',metalness:.35,roughness:.17,transmission:.32,thickness:.55,ior:1.42,clearcoat:1,clearcoatRoughness:.12,emissive:'#bc6d10',emissiveIntensity:.12,envMapIntensity:1.65,flatShading:true}
    : {color:'#edc16b',metalness:.45,roughness:.23,transparent:true,opacity:.91,depthWrite:false,ior:1.42,clearcoat:1,clearcoatRoughness:.12,emissive:'#bc6d10',emissiveIntensity:.25,envMapIntensity:1.65,flatShading:true});
  const luminousGold=new THREE.MeshBasicMaterial({color:new THREE.Color(3.1,1.65,.55),toneMapped:false});
  const wireGold=new THREE.LineBasicMaterial({color:new THREE.Color(1.75,1.05,.38),transparent:true,opacity:profile.id===5?.4:.55});
  const warmMetal=new THREE.MeshStandardMaterial({color:'#c29b55',metalness:.85,roughness:.28,emissive:'#b18436',emissiveIntensity:.3});
  const paleMetal=new THREE.MeshStandardMaterial({color:'#99d2ef',metalness:.82,roughness:.22,emissive:'#357cae',emissiveIntensity:.3});
  const ringGlow=new THREE.MeshBasicMaterial({color:new THREE.Color(.42,.95,1.55),toneMapped:false});
  const dimLine=new THREE.LineBasicMaterial({color:'#4585a7',transparent:true,opacity:.28,depthWrite:false});
  const glass=new THREE.MeshPhysicalMaterial(profile.legacy
    ? {color:'#b7e1f6',metalness:0,roughness:.12,transmission:.98,thickness:.04,ior:1.18,clearcoat:.65,clearcoatRoughness:.16,envMapIntensity:.95,attenuationColor:'#93cbea',attenuationDistance:3.5,side:THREE.FrontSide,depthWrite:true}
    : {color:'#a9d9f1',metalness:.12,roughness:profile.id===4?.18:.23,transparent:true,opacity:profile.glassOpacity,transmission:0,ior:1.3,clearcoat:.7,clearcoatRoughness:.2,envMapIntensity:1.1,side:THREE.FrontSide,depthWrite:false});
  const glassInner=glass.clone();glassInner.color.set(profile.legacy?'#c4e6f4':'#b7d9ea');
  if(profile.legacy){glassInner.transmission=.98;glassInner.roughness=.18;}else{glassInner.opacity=profile.innerOpacity;glassInner.roughness=.27;}
  glassInner.envMapIntensity=.75;
  const border=new THREE.LineBasicMaterial({color:new THREE.Color(.32,.75,1.12),transparent:true,opacity:profile.legacy?.36:profile.id===2?.32:.24,depthWrite:false});
  const innerBorder=new THREE.LineBasicMaterial({color:'#6bafcf',transparent:true,opacity:profile.legacy?.22:.15,depthWrite:false});

  core=new THREE.Group();core.name='room-core';structure.name='room-shell';sphere.add(core);
  const coreGeometry=profile.core==='octa'?new THREE.OctahedronGeometry(profile.coreRadius,0):profile.core==='dodeca'?new THREE.DodecahedronGeometry(profile.coreRadius,0):new THREE.IcosahedronGeometry(profile.coreRadius,profile.core==='icosaFine'?1:0);
  const jewel=new THREE.Mesh(coreGeometry,coreMaterial);jewel.rotation.set(.12,.37,.2);core.add(jewel);
  const coreLines=new THREE.LineSegments(new THREE.EdgesGeometry(jewel.geometry),wireGold);coreLines.rotation.copy(jewel.rotation);core.add(coreLines);
  const cage=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(.81,0)),wireGold);cage.rotation.set(.1,.12,0);core.add(cage);
  const inner=new THREE.Mesh(new THREE.OctahedronGeometry(.28,0),luminousGold);inner.rotation.y=.4;core.add(inner);
  const coreDepth=new THREE.Mesh(jewel.geometry,engravingDepth);coreDepth.rotation.copy(jewel.rotation);coreDepth.renderOrder=19;coreDepth.visible=false;core.add(coreDepth);engravingOccluders.push(coreDepth);
  const ringMaterials={warm:warmMetal,pale:paleMetal,glow:ringGlow};
  for(const [r,t,sweep,material,rotation,start] of profile.rings)arc(r,t,sweep*Math.PI*2,ringMaterials[material],rotation,start);
  const bands=profile.bands;

  for(const [bi,band]of bands.entries()){
    const outer=band.r>2;
    const layer=new THREE.Group();layer.rotation.set(...(outer?[.04,.02,0]:profile.innerTilt));structure.add(layer);layers.push(layer);
    const cell=Math.PI*2/band.n;
    for(let i=0;i<band.n;i++){
      // Vary the openings slightly to retain a designed, assembled silhouette.
      const p=i*cell+band.o+.025,w=cell-(outer?profile.gap:profile.innerGap),a=band.a,b=band.b;
      const geometry=panelGeometry(band.r,profile.panelThickness,a,b,p,w);
      const mesh=new THREE.Mesh(geometry,outer?glass:glassInner);mesh.userData.layer=outer?'outer-shell':'inner-shell';layer.add(mesh);
      const depth=new THREE.Mesh(geometry,engravingDepth);depth.renderOrder=19;depth.visible=false;layer.add(depth);engravingOccluders.push(depth);
      if(bi===1&&i===2)makeEngraving(layer,profile,band,p,w);
      if(bi===profile.bands.reduce((last,b,index)=>b.r>2?index:last,-1)&&i===0)balanceScene.mount(profile,layer,band,p,w);
      const edge=new THREE.Line(panelBorder(band.r+.004,a,b,p,w),outer?border:innerBorder);layer.add(edge);
      if((i+bi)%3===0){
        const bandLine=[];for(let j=0;j<=18;j++)bandLine.push(polar(band.r+.01,(a+b)/2,p+w*j/18));
        layer.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(bandLine),dimLine));
      }
    }
  }
  if(profile.ribs){
    for(let i=0;i<8;i++){
      const p=i*Math.PI/4+.04,g=panelGeometry(2.34,.065,.52,2.58,p,.065);
      const rib=new THREE.Mesh(g,glass);rib.rotation.y=.2;structure.add(rib);
      const edge=new THREE.Line(panelBorder(2.345,.52,2.58,p,.065),border);edge.rotation.y=.2;structure.add(edge);
    }
  }
  if(profile.struts){
    const data=[];
    for(let i=0;i<6;i++){
      const a=polar(.86,1.12,i*Math.PI/3),b=polar(1.5,1.17,i*Math.PI/3+.14);data.push(a,b);
    }
    structure.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(data),new THREE.LineBasicMaterial({color:'#9b844f',transparent:true,opacity:.55})));
  }
  // Instanced micro-details: only the selected variant owns GPU resources.
  const nodeG=new THREE.SphereGeometry(.021,8,6);
  const nodeBlue=new THREE.MeshBasicMaterial({color:new THREE.Color(.7,1.8,3.3),toneMapped:false});
  const nodeGold=new THREE.MeshBasicMaterial({color:new THREE.Color(3.2,1.8,.6),toneMapped:false});
  const counts=[profile.nodes-Math.ceil(profile.nodes/5),Math.ceil(profile.nodes/5)];
  const pools=[new THREE.InstancedMesh(nodeG,nodeBlue,counts[0]),new THREE.InstancedMesh(nodeG,nodeGold,counts[1])],used=[0,0],dummy=new THREE.Object3D();
  for(let i=0;i<profile.nodes;i++){
    const phi=i*2.3999632297,theta=Math.acos(1-2*(i+.5)/profile.nodes),r=i%4===0?2.69:2.4;
    dummy.position.copy(polar(r,theta,phi));dummy.rotation.set(0,0,0);dummy.scale.setScalar(i%6===0?1.3:.8);dummy.updateMatrix();
    const pool=i%5===0?1:0;pools[pool].setMatrixAt(used[pool]++,dummy.matrix);
  }
  pools.forEach(m=>{m.instanceMatrix.needsUpdate=true;structure.add(m);});
  const markMaterial=new THREE.MeshBasicMaterial({color:new THREE.Color(.42,.72,.9),transparent:true,opacity:.65});
  const markG=new THREE.BoxGeometry(profile.id===4?.032:.045,.006,.006),marks=new THREE.InstancedMesh(markG,markMaterial,profile.ticks);
  for(let i=0;i<profile.ticks;i++){
    const t=i*Math.PI*2/profile.ticks;dummy.position.set(Math.cos(t)*2.2,Math.sin(t)*2.2,.49);dummy.rotation.set(0,0,t);dummy.scale.setScalar(1);dummy.updateMatrix();marks.setMatrixAt(i,dummy.matrix);
  }
  marks.instanceMatrix.needsUpdate=true;structure.add(marks);
}

function makeEngraving(parent,profile,band,p,width){
  const theta=(band.a+band.b)/2,phi=p+width/2,normal=polar(1,theta,phi).negate();
  const tile=String('outer-band-1/tile-2'),local=polar(band.r-profile.panelThickness-.009,theta,phi);
  const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d');
  ctx.font='100px Georgia, serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#c7b58d';ctx.fillText('Captain',256,65);
  const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
  const material=new THREE.MeshBasicMaterial({map,transparent:true,opacity:0,depthWrite:false,depthTest:true,side:THREE.FrontSide,toneMapped:true});material.userData.eggMap=true;
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1.08,.27,32,8),material);mesh.position.copy(local);
  const right=new THREE.Vector3(-Math.sin(phi),Math.cos(phi),0),up=normal.clone().cross(right).normalize();
  const basis=new THREE.Matrix4().makeBasis(right,up,normal);mesh.quaternion.setFromRotationMatrix(basis);
  const radius=local.length(),positions=mesh.geometry.attributes.position,inverse=basis.clone().invert();
  for(let i=0;i<positions.count;i++){
    const onShell=local.clone().addScaledVector(right,positions.getX(i)).addScaledVector(up,positions.getY(i)).normalize().multiplyScalar(radius).sub(local).applyMatrix4(inverse);
    positions.setXYZ(i,onShell.x,onShell.y,onShell.z);
  }mesh.geometry.computeVertexNormals();mesh.renderOrder=20;mesh.visible=false;parent.add(mesh);
  engraving={mesh,normal,radius,plateID:tile,local:local.toArray(),theta,phi,worldPosition:new THREE.Vector3(),worldNormal:new THREE.Vector3(),facing:0};
}
function updateEngraving(){
  if(!engraving)return;
  sphere.updateMatrixWorld(true);const e=engraving;
  e.mesh.getWorldPosition(e.worldPosition);e.worldNormal.copy(e.normal).transformDirection(e.mesh.parent.matrixWorld);
  const towardCamera=camera.position.clone().sub(e.worldPosition).normalize();e.facing=towardCamera.dot(e.worldNormal);
  const smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
  // Only the enlarged object and a narrow oblique view reveal the physical mark.
  const angle=smooth((e.facing-.73)/.09)*smooth((.99-e.facing)/.035);
  e.mesh.material.opacity=0;e.mesh.visible=e.mesh.material.opacity>.005;
  for(const m of engravingOccluders)m.visible=e.mesh.visible;
  e.depthClear=0;
  if(e.mesh.visible){
    const ray=new THREE.Raycaster();
    for(const x of [-.31,0,.31])for(const y of [-.055,0,.055]){
      const target=e.mesh.localToWorld(new THREE.Vector3(x,y,e.radius-Math.sqrt(e.radius*e.radius-x*x-y*y))),direction=target.clone().sub(camera.position),length=direction.length();
      ray.set(camera.position,direction.normalize());ray.far=length-.003;
      if(!ray.intersectObjects(engravingOccluders,false).length)e.depthClear++;
    }
  }
}

function updateCamera() {
  const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch,yaw,0,'YXZ'));
  camera.position.set(0,0,distance).applyQuaternion(q);
  camera.up.set(0,1,0).applyQuaternion(q);camera.lookAt(0,0,0);camera.updateMatrixWorld();
}

function resize() {
  const w=canvas.clientWidth,h=canvas.clientHeight;
  // Limit both DPR and total raster area. This is a resource budget, not an FPS promise.
  const ratio=Math.min(devicePixelRatio||1,1.5,Math.sqrt(rasterBudget/(w*h)));
  renderer.setPixelRatio(ratio);renderer.setSize(w,h,false);
  composer.setPixelRatio(ratio);composer.setSize(w,h);
  camera.aspect=w/h;camera.updateProjectionMatrix();
  if(sizeState.mode==='inspect')sizeState={...sizeState,scale:fitScale()};
  if(w<600&&sizeState.mode==='normal')distance=Math.max(distance,18/Math.min(1,camera.aspect));
  invalidate();
}

function render() {
  updateCamera();applySize();engineRoom?.update(motionSeconds,shellManual);updateEngraving();
  for(const mesh of engravingOccluders)mesh.visible=!!engraving?.mesh.visible||!!balanceScene?.miniVisible;
  renderer.info.reset();composer.render();renderedFrames++;
}

function invalidate() {
  dirty=true;
  if(!frame&&!document.hidden)frame=requestAnimationFrame(tick);
}

function tick(now) {
  frame=0;
  if(document.hidden||!embeddedActive){hiddenFrames++;return;}
  if(reduced.matches&&(arcTimer||arcBurst))stopArcs();
  const fast=fastMotionAllowed(),animate=slow&&fast&&!shellManual;
  const dt=lastTime?Math.max(0,(now-lastTime)/1000):0;lastTime=now;
  if(fast){motionSeconds+=dt;if(shellRate()&&!shellManual){const angle=dt*shellRate()*Math.PI*2;shellAutoAngle+=angle;structure.quaternion.premultiply(shellStep.setFromAxisAngle(shellAxis,angle));}}
  if((fast||animate)&&now-lastMotion>=1000/30){
    core.quaternion.setFromAxisAngle(coreAxis,(motionSeconds*CORE_RPS*Math.PI*2)%(Math.PI*2));
    if(animate)sphere.rotation.y+=(lastMotion?Math.max(0,(now-lastMotion)/1000):0)*.07;
    lastMotion=now;dirty=true;
  }
  if(arcBurst&&now-lastArcPaint>=1000/30){updateArc(now);lastArcPaint=now;dirty=true;}
  if(benchmark)dirty=true;
  if(dirty){
    const start=performance.now();render();const elapsed=performance.now()-start;dirty=false;
    if(benchmark){
      if(benchmark.warmup>0)benchmark.warmup--;
      else{benchmark.cpu.push(elapsed);(benchmark.motion??=[]).push({atMs:now,seconds:motionSeconds,coreAngleRad:motionSeconds*CORE_RPS*Math.PI*2,shellAngleRad:shellRate()?shellAutoAngle:0,coreQuaternion:core.quaternion.toArray(),shellQuaternion:structure.quaternion.toArray()});if(benchmark.last)benchmark.intervals.push(now-benchmark.last);}
      benchmark.last=now;
      if(benchmark.cpu.length>=36)finishBenchmark();
    }
  }
  if(fast||animate||benchmark||arcBurst)frame=requestAnimationFrame(tick);
}

function describeResources() {
  const geo=new Set(),mat=new Set();let visibleMeshes=0,triangles=0;
  scene.traverse(o=>{
    if(o.geometry){geo.add(o.geometry);if(o.isMesh){visibleMeshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);}}
    if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])mat.add(m);
  });
  let bytes=0;for(const g of geo){for(const a of Object.values(g.attributes))bytes+=a.array.byteLength;if(g.index)bytes+=g.index.array.byteLength;}
  return {sceneMeshes:visibleMeshes,uniqueGeometries:geo.size,uniqueMaterials:mat.size,sceneTriangles:Math.round(triangles),geometryAttributeBytes:bytes,
    renderCalls:renderer.info.render.calls,renderedTriangles:renderer.info.render.triangles,textures:renderer.info.memory.textures,
    rendererGeometries:renderer.info.memory.geometries,shaderPrograms:renderer.info.programs?.length,
    softwareWebGL,rasterBudget,renderTargetSamples:composer.renderTarget1.samples,canvas:[canvas.width,canvas.height],pixelRatio:renderer.getPixelRatio(),bloomMipLevels:bloom.nMips,
    note:'Geometry bytes exclude GPU alignment, environment and composer render targets. This is not total VRAM.'};
}

function finishBenchmark() {
  const b=benchmark;benchmark=null;
  const stats=arr=>{const a=[...arr].sort((x,y)=>x-y);return{samples:a.length,mean:a.reduce((x,y)=>x+y,0)/a.length,median:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)]};};
  const record={revision:REVISION,pageURL:location.href,variant,tag:params.get('tag')||'initial',measuredAt:new Date().toISOString(),webgl2:renderer.capabilities.isWebGL2,
    userAgent:navigator.userAgent,visibility:document.visibilityState,reducedMotion:reduced.matches,slowAnimation:slow,
    cpuSubmissionMs:stats(b.cpu),rafIntervalMs:stats(b.intervals),motionSamples:b.motion||[],coreRps:CORE_RPS,shellRps:!shellManual?shellRate():0,durationMs:performance.now()-b.started,resources:describeResources(),
    errors:[...errors],externalResources:performance.getEntriesByType('resource').filter(r=>new URL(r.name).origin!==location.origin).map(r=>r.name),
    lifecycle:[],limit:'Short foreground desktop sample, 5 warm-up frames excluded. CPU submission and rAF intervals are not GPU elapsed time or guaranteed FPS.'};
  window.__SINBAD_STUDY.lastMeasurement=record;
  hint.textContent=TEXT[lang].normalHint;
  sendMeasurement(record);
  const idleStart=renderedFrames;
  setTimeout(()=>{record.idleCheck={windowMs:2000,additionalRenderFrames:renderedFrames-idleStart,animation:slow,visibility:document.visibilityState};sendMeasurement(record);},2000);
}

function sendMeasurement(record) {
  // Prototype diagnostics are disabled in the integrated surface.
}

function setView(which) {
  yaw=which==='back'?Math.PI:which==='diagonal'?Math.PI/4:0;pitch=which==='top'?-Math.PI/2:which==='bottom'?Math.PI/2:which==='diagonal'?.17:0;
  distance=innerWidth<600?Math.max(18,18/camera.aspect):18;
  sphere.rotation.copy(baseRotation);
  for(const id of ['front','diagonal','back','top','bottom'])document.querySelector('#'+id).setAttribute('aria-pressed',String(id===which));
  invalidate();
}

function applySize() {
  objectRig.position.fromArray(sizeState.position);objectRig.scale.setScalar(sizeState.scale);
  sphere.visible=sizeState.mode!=='point';pointElement.hidden=sizeState.mode!=='point';
  if(sizeState.mode==='point'){
    const pt=new THREE.Vector3(...sizeState.position).project(camera);
    pointElement.style.left=((pt.x*.5+.5)*100)+'%';pointElement.style.top=((-pt.y*.5+.5)*100)+'%';
  }
}
function fitScale(){return Math.max(.03,distance*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*Math.min(1,camera.aspect)*.88/currentProfile().bound);}
function command(which){
  if(engineRoom?.command(which)){logEvent('size',{command:which,target:engineRoom.selectedId});invalidate();return;}
  sizeState=sizeCommand(sizeState,which,fitScale());if(which==='point'||which==='restore')balanceScene?.close(true);lastTime=0;if(sizeState.mode==='point')stopArcs();else armArc();logEvent('size',{command:which,mode:sizeState.mode,scale:sizeState.scale});
  hint.textContent=TEXT[lang][which==='point'?'pointHint':which==='inspect'?'inspectHint':'restoredHint'];syncMotion();
  invalidate();
}
function hitSphere(e,margin=1){
  if(engineRoom)return engineRoom.pick(e)==='sinbad';
  const rect=canvas.getBoundingClientRect(),point={x:e.clientX-rect.left,y:e.clientY-rect.top};
  if(sizeState.mode==='point'){
    const p=new THREE.Vector3(...sizeState.position).project(camera),x=(p.x*.5+.5)*rect.width,y=(-p.y*.5+.5)*rect.height;
    return Math.hypot(point.x-x,point.y-y)<=36*margin;
  }
  const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(point.x/rect.width*2-1,1-point.y/rect.height*2),camera);
  const bounds=new THREE.Sphere(new THREE.Vector3(...sizeState.position),currentProfile().bound*sizeState.scale*margin);
  return ray.ray.intersectsSphere(bounds);
}
const series=new ClickSeries(count=>{
  if(pendingEngine)engineRoom?.select(pendingEngine);pendingEngine=null;logEvent('gesture',{count});
  if(count===2)command('inspect');else if(count===3)command('point');else if(count===4)command('restore');else{canvas.focus({preventScroll:true});logEvent('select');}
});
function disposeSphere(){
  balanceScene?.close(true);
  if(!sphere)return;
  const geo=new Set(),mat=new Set();sphere.traverse(o=>{if(o.geometry)geo.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])mat.add(m);});
  objectRig.remove(sphere);geo.forEach(g=>g.dispose());mat.forEach(m=>{if(m.userData.eggMap)m.map.dispose();m.dispose();});layers.length=0;renderer.renderLists.dispose();
}
function selectVariant(id){
  if(id!==5)return;
  series.clear();if(id===variant){syncLanguage();return;}
  stopArcs();disposeSphere();shellManual=false;manualPointer=null;variant=id;switches++;makeSphere(currentProfile());
  const p=currentProfile();bloom.strength=p.bloom[0];bloom.radius=p.bloom[1];bloom.threshold=p.bloom[2];renderer.toneMappingExposure=p.exposure;
  keyLight.intensity=p.key;rimLight.intensity=p.rim;fillLight.intensity=p.fill;
  if(sizeState.mode==='inspect')sizeState={...sizeState,scale:fitScale()};
  syncLanguage();armArc();logEvent('variant',{variant});invalidate();
  requestAnimationFrame(()=>{resourceHistory.push({variant,switches,...describeResources()});if(resourceHistory.length>50)resourceHistory.shift();});
}
function syncLanguage(){
  document.documentElement.lang=lang;const words=TEXT[lang];
  for(const el of document.querySelectorAll('[data-i18n]'))el.textContent=words[el.dataset.i18n];
  document.querySelector('#variant-description').textContent=lang==='tr'?'Denge · Görsel dönüş çalışma kanıtı değildir.':'Balance · Visual rotation is not evidence of operation.';engineRoom?.setLanguage(lang);
  for(const button of document.querySelectorAll('[data-variant]')){const p=VARIANTS[Number(button.dataset.variant)-1];button.querySelector('span').textContent=p.name[lang];button.setAttribute('aria-pressed',String(p.id===variant));button.title=p.description[lang];}
  document.querySelector('#lang-tr').setAttribute('aria-pressed',String(lang==='tr'));document.querySelector('#lang-en').setAttribute('aria-pressed',String(lang==='en'));
  hint.textContent=words[sizeState.mode==='point'?'pointHint':sizeState.mode==='inspect'?'inspectHint':'normalHint'];document.querySelector('#arc-preview').hidden=true;syncMotion();syncBalanceUI();
}
function syncBalanceUI(){
  const item=engineRoom?.active;if(item){const mode=item.size.mode;hint.textContent=item[lang]+' · '+(lang==='tr'?(mode==='point'?'Nokta':mode==='inspect'?'İnceleme boyutu':'Motor seçili'):(mode==='point'?'Point':mode==='inspect'?'Inspection size':'Engine selected'));return;}
  const phase=balanceScene?.phase||'hidden';document.querySelector('#balance-return').hidden=phase==='hidden';
  if(phase!=='hidden')hint.textContent=TEXT[lang][phase==='ready'?'balanceReady':phase==='opening'?'balanceOpening':'balanceClosing'];
  else hint.textContent=TEXT[lang][sizeState.mode==='point'?'pointHint':sizeState.mode==='inspect'?'inspectHint':'normalHint'];
}

function shellControlEnabled(){return shellManual&&fastMotionAllowed();}
function trackball(e){
  const r=canvas.getBoundingClientRect(),m=Math.min(r.width,r.height);
  if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)return null;
  const x=(2*(e.clientX-r.left)-r.width)/m,y=(r.height-2*(e.clientY-r.top))/m,d=x*x+y*y;
  return new THREE.Vector3(x,y,d<=.5?Math.sqrt(1-d):.5/Math.sqrt(d)).normalize();
}
function applyShellDelta(delta,targetId=engineRoom?.selectedId){
  if(!shellControlEnabled())return;
  if(engineRoom?.rotateShell(delta,targetId)){invalidate();return;}
  const parent=sphere.getWorldQuaternion(new THREE.Quaternion()),cameraQ=camera.quaternion;
  const local=parent.clone().invert().multiply(cameraQ).multiply(delta).multiply(cameraQ.clone().invert()).multiply(parent);
  structure.quaternion.premultiply(local).normalize();invalidate();
}
function moveShell(e,targetId=engineRoom?.selectedId){
  const next=trackball(e);if((e.buttons&1)===0||!shellControlEnabled()||!next){manualPointer=null;return;}
  if(manualPointer&&manualPointer.distanceToSquared(next)>1e-12){manualMoves++;applyShellDelta(new THREE.Quaternion().setFromUnitVectors(manualPointer,next),targetId);}
  manualPointer=next;
}
function toggleShellControl(force){
  clearPointerInput();shellManual=force??!shellManual;manualPointer=null;series.clear();
  syncMotion();logEvent('shell-control',{manual:shellManual,quaternion:structure.quaternion.toArray()});auditShellMotion();invalidate();
}
function auditShellMotion(){
  if(!params.has('measure')||!window.__SINBAD_STUDY?.lastMeasurement)return;
  if(auditTimer)clearTimeout(auditTimer);
  const record=window.__SINBAD_STUDY.lastMeasurement,audit={startedAt:new Date().toISOString(),samples:[]};
  (record.shellAudits??=[]).push(audit);if(record.shellAudits.length>8)record.shellAudits.shift();
  const sample=()=>{
    audit.samples.push({at:performance.now(),manual:shellManual,moves:manualMoves,coreSeconds:motionSeconds,shell:structure.quaternion.toArray(),core:core.quaternion.toArray(),camera:{yaw,pitch,distance},parent:sphere.quaternion.toArray()});
    if(audit.samples.length>=60||document.hidden){auditTimer=0;sendMeasurement(record);return;}
    auditTimer=setTimeout(sample,100);
  };sample();
}

function input() {
  for(const kind of ['click','dblclick','auxclick'])canvas.addEventListener(kind,e=>logEvent('native-'+kind,{button:e.button,buttons:e.buttons,ctrl:e.ctrlKey,trusted:e.isTrusted,target:e.target?.id}));
  let drag=null,lastPointer=null;
  for(const type of ['pointerdown','pointermove','pointerup','pointercancel'])window.addEventListener(type,e=>{lastPointer={id:e.pointerId,button:e.button,buttons:e.buttons,x:e.clientX,y:e.clientY,type:e.pointerType};},true);
  const focusKind=()=>document.activeElement===canvas?'canvas':document.activeElement?.closest?.('.commands,.variants')?'control':'other';
  readInputState=()=>({drag:drag?{id:drag.id,moved:drag.moved,shell:drag.shell,sphereHit:drag.hit,balanceHit:!!drag.balanceHit}:null,capture:lastPointer?canvas.hasPointerCapture(lastPointer.id):false,manual:shellManual,manualAnchor:!!manualPointer,active:shellControlEnabled(),focus:focusKind(),documentFocus:document.hasFocus(),hidden:document.hidden,pointerLock:!!document.pointerLockElement,pointer:lastPointer?{...lastPointer}:null,camera:[yaw,pitch,distance],shell:structure?.quaternion.toArray(),shellMoves:manualMoves,balance:balanceScene?.phase,pendingClicks:series.count});
  // Opt-in bounded local diagnostics: no text values, arbitrary keys or external transmission.
  const diagnostic=params.has('inputdiag'),ring=[];let frozen=null,diagSequence=0,lastMoveAt=0,lastButtons=-1,diagBox;
  const snapshot=(type,e,stage='after')=>({sequence:++diagSequence,at:Math.round(performance.now()),type,stage,button:e?.button??null,buttons:e?.buttons??null,trusted:e?.isTrusted??null,...readInputState()});
  const paintDiagnostic=()=>{
    if(!diagBox)return;const s=readInputState(),p=s.pointer;
    diagBox.textContent=`Giriş tanısı · ${frozen?'Esc öncesi kayıt saklandı':'Canlı'}\nMod ${s.manual?'Elle':'Otomatik'} · drag ${s.drag?'VAR':'yok'} · capture ${s.capture?'VAR':'yok'} · lock ${s.pointerLock?'VAR':'yok'}\nDüğmeler ${p?.buttons??'—'} · xy ${p?Math.round(p.x)+','+Math.round(p.y):'—'} · odak ${s.focus}/${s.documentFocus?'evet':'hayır'}\nOlay ${diagSequence} · hareket ${s.shellMoves} · ${s.balance}${frozen?'\nEsc önce: '+(frozen.before.manual?'Elle':'Otomatik')+' · drag '+(frozen.before.drag?'VAR':'yok')+' · capture '+(frozen.before.capture?'VAR':'yok')+' · düğmeler '+(frozen.before.pointer?.buttons??'—'):''}\nTakılınca Esc: önceki olayları saklar ve kontrolü bırakır.`;
  };
  const appendDiagnostic=(type,e,stage='after')=>{if(!diagnostic)return;const entry=snapshot(type,e,stage);if(!frozen){ring.push(entry);if(ring.length>96)ring.shift();}paintDiagnostic();};
  const freezeDiagnostic=()=>{
    if(!diagnostic||frozen)return;frozen={revision:REVISION,capturedAt:new Date().toISOString(),reason:'escape-before-cleanup',before:readInputState(),events:[...ring]};
    // Dedicated compact record avoids the old growing measurement payload. Same loopback sink.
    requestAnimationFrame(()=>{frozen.after=readInputState();paintDiagnostic();/* no production diagnostic transport */});
  };
  if(diagnostic){
    diagBox=document.createElement('output');diagBox.id='input-diagnostic';diagBox.setAttribute('aria-label','Sınırlı giriş tanısı');
    Object.assign(diagBox.style,{position:'fixed',left:'12px',top:'76px',zIndex:'30',font:'11px/1.45 ui-monospace,monospace',whiteSpace:'pre',padding:'8px',color:'#c6d9e5',background:'rgba(5,12,18,.88)',border:'1px solid #304657',borderRadius:'5px',pointerEvents:'none'});document.body.append(diagBox);
    for(const type of ['pointerdown','pointerup','pointermove','pointercancel','pointerenter','pointerleave','gotpointercapture','lostpointercapture'])canvas.addEventListener(type,e=>{
      lastPointer={id:e.pointerId,button:e.button,buttons:e.buttons,x:e.clientX,y:e.clientY,type:e.pointerType};
      if(type==='pointermove'&&e.buttons===lastButtons&&performance.now()-lastMoveAt<80)return;
      if(type==='pointermove')lastMoveAt=performance.now();lastButtons=e.buttons;appendDiagnostic(type,e,'before');queueMicrotask(()=>appendDiagnostic(type,e));
    },true);
    for(const type of ['blur','focus'])window.addEventListener(type,e=>queueMicrotask(()=>appendDiagnostic(type,e)));
    for(const type of ['pointerdown','pointerup'])window.addEventListener(type,e=>{if(e.target!==canvas)queueMicrotask(()=>appendDiagnostic(type+'-outside',e));});
    canvas.addEventListener('wheel',e=>queueMicrotask(()=>appendDiagnostic('wheel',e)));
    document.addEventListener('visibilitychange',e=>queueMicrotask(()=>appendDiagnostic('visibilitychange',e)));
    document.addEventListener('pointerlockchange',e=>appendDiagnostic('pointerlockchange',e));
    window.addEventListener('keydown',e=>{if(e.key==='Escape'){appendDiagnostic('Escape',e,'before');freezeDiagnostic();}else if((e.key==='v'||e.key==='V')&&!e.metaKey&&!e.ctrlKey&&!e.altKey&&!e.isComposing&&e.target?.closest?.('#view,.commands,.variants')){appendDiagnostic('V',e,'before');queueMicrotask(()=>appendDiagnostic('V',e));}},true);
    window.__SINBAD_INPUT_DIAGNOSTIC={get state(){return readInputState();},get events(){return [...ring];},get frozen(){return frozen;}};
    paintDiagnostic();
  }

  clearPointerInput=(cancelClicks=true)=>{
    const id=drag?.id;engineRoom?.endMove();drag=null;manualPointer=null;if(cancelClicks){series.clear();pendingEngine=null;}
    if(id!==undefined&&canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);
  };
  canvas.addEventListener('lostpointercapture',e=>{if(drag?.id===e.pointerId)clearPointerInput();});
  window.addEventListener('blur',()=>clearPointerInput());
  window.addEventListener('pointerup',e=>{if(drag?.id===e.pointerId)clearPointerInput();});
  const isSecondary=e=>e.button===2||(e.button===0&&e.ctrlKey&&/Mac/.test(navigator.platform));
  // Secondary input never participates in size gestures or shell control.
  canvas.addEventListener('contextmenu',e=>{e.preventDefault();logEvent('contextmenu',{button:e.button,ctrl:e.ctrlKey,trusted:e.isTrusted,target:e.target?.id});},true);
  canvas.addEventListener('pointerdown',e=>{
    if(isSecondary(e)){e.preventDefault();clearPointerInput();logEvent('secondary-ignored',{button:e.button,buttons:e.buttons,ctrl:e.ctrlKey,trusted:e.isTrusted,target:e.target?.id});return;}
    if(e.button!==0)return;lastPointer={id:e.pointerId,button:e.button,buttons:e.buttons,x:e.clientX,y:e.clientY,type:e.pointerType};logEvent('pointer-left-down',{button:e.button,buttons:e.buttons,ctrl:e.ctrlKey,trusted:e.isTrusted,target:e.target?.id,x:e.clientX,y:e.clientY});manualPointer=null;canvas.focus({preventScroll:true});drag={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false,hit:hitSphere(e),balanceHit:false,engineHit:engineRoom?.pick(e),shell:shellManual&&(hitSphere(e)||!!engineRoom?.pick(e)),motorMove:false};try{canvas.setPointerCapture(e.pointerId);}catch{}
    if(drag.shell)manualPointer=trackball(e);
  },true);
  canvas.addEventListener('pointerenter',()=>{if(!drag)manualPointer=null;});
  canvas.addEventListener('pointerleave',()=>{clearPointerInput();});
  canvas.addEventListener('pointermove',e=>{
    const rect=canvas.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom){clearPointerInput();return;}
    if(!drag){manualPointer=null;canvas.style.cursor=engineRoom?.pick(e)?'pointer':'grab';return;}
    if(e.pointerId!==drag.id)return;
    if((e.buttons&1)===0){clearPointerInput();logEvent('drag-buttons-released');appendDiagnostic('buttons-release-cleanup',e);return;}
    if(!drag.moved&&!isDrag(drag,{x:e.clientX,y:e.clientY}))return;
    if(!drag.moved){drag.moved=true;series.clear();drag.motorMove=!drag.shell&&drag.engineHit&&drag.engineHit!=='sinbad'&&engineRoom.beginMove(drag.engineHit,{clientX:drag.x,clientY:drag.y});logEvent('drag-start',{kind:drag.shell?'shell':drag.motorMove?'motor':'orbit'});}
    if(drag.shell)moveShell(e,drag.engineHit||'sinbad');else if(drag.motorMove)engineRoom.moveMotor(e);else{yaw-=(e.clientX-drag.lastX)*.006;pitch-=(e.clientY-drag.lastY)*.006;invalidate();}
    drag.lastX=e.clientX;drag.lastY=e.clientY;
  });
  canvas.addEventListener('pointerup',e=>{
    if(isSecondary(e)||e.button!==0)return;
    if(!drag)return;logEvent('pointer-left-up',{button:e.button,buttons:e.buttons,ctrl:e.ctrlKey,trusted:e.isTrusted,target:e.target?.id,x:e.clientX,y:e.clientY});const done=drag;clearPointerInput(false);
    if(!done.moved){
      if(done.balanceHit){series.clear();balanceScene.open();invalidate();return;}
      if(performance.now()<(balanceScene?.guardUntil||0)){series.clear();return;}
      pendingEngine=done.engineHit;
      if(done.hit||done.engineHit)series.push();
    }else logEvent('drag-end');
    if(params.has('measure'))requestAnimationFrame(()=>{const b=balanceScene.state;logEvent('view-pose',{camera:{yaw,pitch,distance,position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),target:[0,0,0]},balance:{phase:b.phase,mainPosition:b.mainPosition,mainScale:b.mainScale,worldPosition:b.worldPosition,worldNormal:b.worldNormal,visibleHitPoints:b.visibleHitPoints}});});
  },true);
  canvas.addEventListener('pointercancel',()=>clearPointerInput());
  canvas.addEventListener('wheel',e=>{e.preventDefault();series.clear();distance=clamp(distance*Math.exp(e.deltaY*.001),engineRoom?.active?engineRoom.active.rig.position.length()+3.5:10,52);logEvent('camera-zoom',{distance});invalidate();},{passive:false});
  window.addEventListener('keydown',e=>{
    if(e.key==='Escape'){
      const active=!!drag||!!manualPointer||shellManual||balanceScene?.phase!=='hidden';
      clearPointerInput();if(engineRoom?.active){engineRoom.select('sinbad');sizeState=normalSize();}if(shellManual)toggleShellControl(false);balanceScene?.close();if(active)e.preventDefault();return;
    }
    if(e.metaKey||e.ctrlKey||e.altKey||e.isComposing)return;const target=e.target;if(target?.closest?.('input,textarea,select')||target?.isContentEditable)return;
    if(e.key==='Enter'&&e.target===canvas&&balanceScene?.miniVisible&&balanceScene?.clearSamples>0){series.clear();balanceScene.open();invalidate();e.preventDefault();return;}
    if(e.key==='v'||e.key==='V'){
      if(!target?.closest?.('#view,.commands,.variants'))return;
      e.preventDefault();if(e.repeat)return;
      toggleShellControl();canvas.focus({preventScroll:true});return;
    }
    if(shellManual&&e.target===canvas&&e.key.startsWith('Arrow')){
      const axis=e.key==='ArrowLeft'||e.key==='ArrowRight'?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0);
      const sign=e.key==='ArrowLeft'||e.key==='ArrowUp'?-1:1;applyShellDelta(new THREE.Quaternion().setFromAxisAngle(axis,sign*.10));e.preventDefault();return;
    }
    if(e.key==='+'||e.key==='='||e.code==='NumpadAdd'){series.clear();command('inspect');}
    else if(e.key==='-'||e.code==='NumpadSubtract'){series.clear();command('point');}
    else if(e.key==='0'||e.code==='Numpad0'){series.clear();command('restore');}
    else if(e.key==='Home'){series.clear();setView('front');}
    else if(e.target===canvas&&e.key==='ArrowLeft')yaw-=.12;else if(e.target===canvas&&e.key==='ArrowRight')yaw+=.12;
    else if(e.target===canvas&&e.key==='ArrowUp')pitch-=.12;else if(e.target===canvas&&e.key==='ArrowDown')pitch+=.12;else return;
    e.preventDefault();invalidate();
  });
  for(const id of ['front','diagonal','back','top','bottom'])document.querySelector('#'+id).addEventListener('click',()=>{series.clear();setView(id);});
  document.querySelector('#reset').addEventListener('click',()=>{clearPointerInput();sizeState=normalSize();if(shellManual)toggleShellControl(false);setView('front');engineRoom.resetLayout();});
  document.querySelector('#inspect').addEventListener('click',()=>{series.clear();command('inspect');});
  document.querySelector('#point-size').addEventListener('click',()=>{series.clear();command('point');});
  document.querySelector('#restore').addEventListener('click',()=>{series.clear();command('restore');});
  document.querySelector('#engine-close').addEventListener('click',()=>{series.clear();engineRoom.select('sinbad');sizeState=normalSize();invalidate();});
  document.querySelector('#balance-return').addEventListener('click',()=>{series.clear();balanceScene.close();invalidate();});
  document.querySelector('#shell-control').addEventListener('click',()=>{toggleShellControl();if(shellManual)canvas.focus({preventScroll:true});});
  document.querySelector('#animate').addEventListener('click',()=>{slow=!slow&&!reduced.matches&&!motionStopped;syncMotion();invalidate();});
  const helpPanel=document.querySelector('#shortcut-help'),helpToggle=document.querySelector('#help-toggle'),helpClose=document.querySelector('#help-close');
  const setHelp=open=>{helpPanel.hidden=!open;helpToggle.setAttribute('aria-expanded',String(open));(open?helpClose:helpToggle).focus({preventScroll:true});};
  helpToggle.addEventListener('click',()=>setHelp(helpPanel.hidden));helpClose.addEventListener('click',()=>setHelp(false));
  for(const type of ['pointerdown','pointermove','pointerup','click','dblclick','wheel'])helpPanel.addEventListener(type,e=>e.stopPropagation(),{passive:true});
  helpPanel.addEventListener('keydown',e=>{if(e.key==='Escape'){setHelp(false);return;}e.stopPropagation();});
  for(const button of document.querySelectorAll('[data-variant]'))button.addEventListener('click',()=>selectVariant(Number(button.dataset.variant)));
  for(const id of ['tr','en'])document.querySelector('#lang-'+id).addEventListener('click',()=>{lang=id;syncLanguage();});
  document.querySelector('#stop-motion').addEventListener('click',()=>{motionStopped=!motionStopped;manualPointer=null;lastTime=0;lastMotion=0;if(motionStopped){slow=false;stopArcs();}else armArc();syncMotion();logEvent('motion-stop',{motionStopped});invalidate();});
  document.querySelector('#arc-preview').addEventListener('click',()=>engineRoom.toggleDrawing());
  const motionPreferenceChanged=()=>{manualPointer=null;lastTime=0;lastMotion=0;if(reduced.matches){slow=false;stopArcs();}else armArc();syncMotion();logEvent('motion-preference',{reduced:reduced.matches});invalidate();};
  // Attach the live preference observer after the first style/layout frame.
  requestAnimationFrame(()=>{const observer=window.__SINBAD_REDUCED_OBSERVER=matchMedia('(prefers-reduced-motion: reduce)');observer.onchange=motionPreferenceChanged;motionPreferenceChanged();});
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){clearPointerInput();stopArcs();if(frame)cancelAnimationFrame(frame);frame=0;lastTime=0;lastMotion=0;
      if(benchmark){benchmark=null;errors.push('Measurement cancelled: page hidden.');}
      const record=window.__SINBAD_STUDY?.lastMeasurement;
      if(record){const start=renderedFrames;const event={state:'hidden',at:new Date().toISOString(),scheduledFrame:frame,slowAnimation:slow};record.lifecycle.push(event);sendMeasurement(record);
        setTimeout(()=>{event.additionalFramesAfterHidden=renderedFrames-start;event.observedState=document.visibilityState;sendMeasurement(record);},1500);}
    }else{lastTime=0;lastMotion=0;armArc();invalidate();const record=window.__SINBAD_STUDY?.lastMeasurement;if(record){record.lifecycle.push({state:'visible',at:new Date().toISOString()});sendMeasurement(record);}}
  });
  addEventListener('resize',resize);new ResizeObserver(()=>resize()).observe(document.querySelector('#view'));
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();slow=false;stopArcs();series.clear();if(frame)cancelAnimationFrame(frame);frame=0;fail(lang==='tr'?'WebGL2 bağlamı kesildi. Sayfayı yeniden yükleyebilirsiniz.':'The WebGL2 context was lost. You can reload this page.');});
}

function arcAllowed(){return false;}
function armArc(){
  if(!arcAllowed()||arcTimer||arcBurst)return;
  // Uneven quiet gaps. One short discharge at a time, with no brightness pulses.
  arcTimer=setTimeout(()=>{arcTimer=0;if(arcAllowed())startArc();},5100+Math.random()**.65*7900);
}
function stopArcs(){
  if(arcTimer)clearTimeout(arcTimer);arcTimer=0;
  if(arcBurst){arcBurst.group.parent?.remove(arcBurst.group);arcBurst.geometries.forEach(g=>g.dispose());arcBurst.material.dispose();arcBurst=null;}
}
function boltPoints(from,to,levels,amplitude){
  const axis=to.clone().sub(from).normalize(),side=new THREE.Vector3(0,1,0);
  if(Math.abs(axis.dot(side))>.9)side.set(1,0,0);
  side.cross(axis).normalize();const up=axis.clone().cross(side).normalize();
  let points=[from.clone(),to.clone()];
  // Recursive nonuniform subdivision: broad bends, small kinks, then fine detail.
  // No periodic spatial sine, equal-distance sawtooth, or per-frame random flicker.
  for(let level=0;level<levels;level++){
    const next=[points[0]],spread=amplitude*Math.pow(.51,level);
    for(let i=1;i<points.length;i++){
      const t=.29+Math.random()*.42,mid=points[i-1].clone().lerp(points[i],t);
      mid.addScaledVector(side,(Math.random()*2-1)*spread);
      mid.addScaledVector(up,(Math.random()*2-1)*spread*.77);
      next.push(mid,points[i]);
    }points=next;
  }return points;
}
function shellTarget(){
  const profile=currentProfile(),bands=profile.bands.filter(b=>b.r>2),band=bands[Math.floor(Math.random()*bands.length)];
  const cell=Math.PI*2/band.n,tile=Math.floor(Math.random()*band.n),width=cell-profile.gap;
  const phi=tile*cell+band.o+.025+width*(.08+Math.random()*.84),theta=band.a+(band.b-band.a)*(.12+Math.random()*.76);
  return polar(band.r,theta,phi).applyEuler(new THREE.Euler(.04,.02,0));
}
function startArc(){
  if(!arcAllowed()||arcBurst)return;
  const end=shellTarget(),from=end.clone().normalize().multiplyScalar(.59);
  const points=boltPoints(from,end,5,.17+Math.random()*.12),paths=[points],ends=[end];
  // Most discharges have no branch; at most one, born near the shell, stays faint.
  if(Math.random()<.28){
    const start=points[Math.floor(points.length*(.65+Math.random()*.13))];
    let target=shellTarget();for(let attempt=0;attempt<10&&start.distanceTo(target)>=1.4;attempt++)target=shellTarget();
    if(start.distanceTo(target)<1.4){paths.push(boltPoints(start,target,3,.055));ends.push(target);}
  }
  const material=new THREE.LineBasicMaterial({color:new THREE.Color(.38,.65,.81),transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,depthTest:true,toneMapped:true});
  const group=new THREE.Group(),geometries=paths.map(points=>new THREE.BufferGeometry().setFromPoints(points));
  geometries.forEach(g=>group.add(new THREE.Line(g,material)));structure.add(group);
  arcBurst={group,geometries,material,counts:paths.map(p=>p.length),started:performance.now(),duration:760+Math.random()*280,peak:.36+Math.random()*.09};
  arcSpawnCount++;lastArcEndpoints=ends.map(p=>p.toArray());logEvent('artistic-arc',{spawnCount:arcSpawnCount,endpoints:lastArcEndpoints,lines:paths.length,duration:arcBurst.duration});invalidate();
}
function updateArc(now){
  if(!arcBurst)return;
  if(!arcAllowed()){stopArcs();return;}
  const t=(now-arcBurst.started)/arcBurst.duration;
  if(t>=1){stopArcs();armArc();return;}
  const smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
  arcBurst.material.opacity=smooth(t/.25)*smooth((1-t)/.62)*arcBurst.peak;
  arcBurst.geometries.forEach((g,i)=>{const growth=clamp((t-(i?.18:0))/(i?.42:.34),0,1);g.setDrawRange(0,growth>0?Math.max(2,Math.ceil(arcBurst.counts[i]*growth)):0);});
}

function syncMotion() {
  const button=document.querySelector('#animate');button.setAttribute('aria-pressed',String(slow));button.disabled=reduced.matches||motionStopped||shellManual;
  const stop=document.querySelector('#stop-motion');stop.setAttribute('aria-pressed',String(motionStopped));stop.textContent=TEXT[lang][motionStopped?'resumeMotion':'stopMotion'];document.querySelector('#arc-preview').disabled=false;
  const control=document.querySelector('#shell-control');control.setAttribute('aria-pressed',String(shellManual));document.querySelector('#shell-state').textContent=TEXT[lang][shellManual?'manual':'automatic'];
  document.querySelector('#motion-state').textContent=TEXT[lang][reduced.matches?'reduced':slow&&!motionStopped&&!shellManual?'on':'off'];
  button.title='Yalnız görsel hareket. Gerçek çalışma veya telemetri göstergesi değildir.';
}

try {
  const gl=params.has('fallback')?null:canvas.getContext('webgl2',{alpha:false,antialias:true,powerPreference:'low-power'});
  if(!gl)throw new Error('WebGL2 desteği doğrulanamadı. Donanım hızlandırması kapalı olabilir veya tarayıcı bu bağlamı sağlayamıyor.');
  // Software rasterizers pay for transmission, bloom and MSAA on the CPU.
  // Bound their raster workload without changing geometry, labels or interaction semantics.
  // Hardware keeps the original r24 pixel and sample budgets. No UA or test-only switch.
  try {
    const info=gl.getExtension('WEBGL_debug_renderer_info');
    const name=String(gl.getParameter(info?info.UNMASKED_RENDERER_WEBGL:gl.RENDERER));
    softwareWebGL=/swiftshader|llvmpipe|softpipe|software rasterizer/i.test(name);
  } catch { /* Keep the hardware budget if renderer identity is unavailable. */ }
  if(softwareWebGL)rasterBudget=120000;
  renderer=new THREE.WebGLRenderer({canvas,context:gl,antialias:true,alpha:false,powerPreference:'low-power'});
  renderer.setClearColor('#010204',1);renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;
  renderer.info.autoReset=false;
  scene=new THREE.Scene();scene.background=new THREE.Color('#010204');scene.environment=environment();objectRig=new THREE.Group();scene.add(objectRig);
  camera=new THREE.PerspectiveCamera(38,innerWidth/innerHeight,.1,80);
  keyLight=new THREE.DirectionalLight('#d0e9ff',currentProfile().key);keyLight.position.set(-4,5,6);scene.add(keyLight);
  rimLight=new THREE.DirectionalLight('#548fc8',currentProfile().rim);rimLight.position.set(4,-1,-4);scene.add(rimLight);fillLight=new THREE.HemisphereLight('#adcfe6','#221409',currentProfile().fill);scene.add(fillLight);
  const warm=new THREE.PointLight('#ffbb5e',7,5,2);warm.position.set(.2,.1,.2);scene.add(warm);
  balanceScene=new BalanceScene({scene,camera,mainRig:objectRig,canvas,clock:()=>motionSeconds,canAnimate:()=>fastMotionAllowed(),reducedMotion:()=>reduced.matches,captureCamera:()=>({yaw,pitch,distance}),restoreCamera:s=>{({yaw,pitch,distance}=s);updateCamera();},onChange:()=>{syncBalanceUI();logEvent('balance-phase',{phase:balanceScene?.phase});invalidate();}});
  makeSphere(currentProfile());
  engineRoom=new EngineRoom({scene,camera,canvas,mainRig:objectRig,sphere,clock:()=>motionSeconds,canAnimate:()=>fastMotionAllowed(),mainMode:()=>sizeState.mode,onChange:()=>{syncBalanceUI();invalidate();}});
  const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType});target.samples=softwareWebGL?0:2;
  composer=new EffectComposer(renderer,target);
  composer.addPass(new RenderPass(scene,camera));
  bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),...currentProfile().bloom);composer.addPass(bloom);
  composer.addPass(new OutputPass());
  renderer.toneMappingExposure=currentProfile().exposure;input();syncLanguage();resize();armArc();
  document.querySelector('#loading').hidden=true;
  new ResizeObserver(()=>resize()).observe(canvas);
  window.__SINBAD_STUDY={revision:REVISION,webgl2:renderer.capabilities.isWebGL2,get resources(){return describeResources();},get state(){return {room:engineRoom?.state,input:readInputState(),variant,lang,size:JSON.parse(JSON.stringify(sizeState)),camera:{yaw,pitch,distance},pendingClicks:series.count,slow,motionStopped,reduced:reduced.matches,pointDiameter:11,balance:balanceScene.state,shellControl:{manual:shellManual,pointerMoves:manualMoves,active:shellControlEnabled(),quaternion:(engineRoom?.activeShell||structure).quaternion.toArray()},engraving:engraving?{plateID:engraving.plateID,local:engraving.local,theta:engraving.theta,phi:engraving.phi,worldPosition:engraving.worldPosition.toArray(),worldNormal:engraving.worldNormal.toArray(),facing:engraving.facing,depthClearSamples:engraving.depthClear,opacity:engraving.mesh.material.opacity,visible:engraving.mesh.visible}:null,motion:{enabled:fastMotionAllowed(),seconds:motionSeconds,coreRps:CORE_RPS,shellRps:!shellManual?shellRate():0,coreAngle:motionSeconds*CORE_RPS*Math.PI*2,shellAngle:shellRate()?shellAutoAngle:0,coreQuaternion:core.quaternion.toArray(),shellQuaternion:structure.quaternion.toArray()},electric:{enabled:arcAllowed(),scheduled:!!arcTimer,active:!!arcBurst,activeLines:arcBurst?.geometries.length||0,opacity:arcBurst?.material.opacity||0,duration:arcBurst?.duration||0,spawnCount:arcSpawnCount,lastEndpoints:lastArcEndpoints}};},get events(){return [...eventHistory];},get resourceHistory(){return [...resourceHistory];},
    get frames(){return renderedFrames;},get running(){return frame!==0;},get hiddenRenderAttempts(){return hiddenFrames;},get errors(){return [...errors];},lastMeasurement:null};
  let lastEnvelope=0;
  window.addEventListener('message',event=>{
    if(event.source!==parent||event.origin!==location.origin||event.data?.type!=='sinbad-denge-observation/v1')return;
    const value=event.data;if(!Number.isSafeInteger(value.sequence)||value.sequence<=lastEnvelope)return;lastEnvelope=value.sequence;
    embeddedActive=Boolean(value.active);if(!embeddedActive){clearPointerInput();stopArcs();if(frame)cancelAnimationFrame(frame);frame=0;}lastTime=0;lastMotion=0;
    const next=value.language==='tr'?'tr':'en';if(lang!==next){lang=next;syncLanguage();}
    engineRoom.setObservation(value);if(embeddedActive){resize();invalidate();}
  });
  for(const id of ['tr','en'])document.querySelector('#lang-'+id).addEventListener('click',()=>parent.postMessage({type:'sinbad-denge-language/v1',language:id},location.origin));
  parent.postMessage({type:'sinbad-denge-ready/v1'},location.origin);
  if(params.get('view')==='diagonal')setView('diagonal');else if(params.get('view')==='back')setView('back');
  if(params.has('measure')){benchmark={cpu:[],intervals:[],warmup:5,last:0,started:performance.now()};invalidate();}
} catch(e) {
  errors.push(String(e.message));fail(TEXT[lang].webglFailure+' '+e.message);console.error(e);
}
