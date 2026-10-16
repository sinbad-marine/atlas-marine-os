import * as THREE from 'three';
const clamp=THREE.MathUtils.clamp;
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const polar=(r,t,p)=>new THREE.Vector3(r*Math.sin(t)*Math.cos(p),r*Math.sin(t)*Math.sin(p),r*Math.cos(t));
function crystalPanels(){
 const positions=[],normals=[];const point=(t,p)=>polar(1.04,t,p);
 for(const [a,b]of [[.42,.92],[1.24,1.90],[2.22,2.72]])for(let n=0;n<8;n++){
  const p=n*Math.PI/4+.11,w=Math.PI/4-.23;
  for(let y=0;y<2;y++)for(let x=0;x<2;x++){
   const v=[point(a+(b-a)*y/2,p+w*x/2),point(a+(b-a)*y/2,p+w*(x+1)/2),point(a+(b-a)*(y+1)/2,p+w*x/2),point(a+(b-a)*(y+1)/2,p+w*(x+1)/2)];
   for(const i of [0,2,1,1,2,3]){positions.push(...v[i]);normals.push(...v[i].clone().normalize());}
  }
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));return g;
}
function model(){
 const group=new THREE.Group();
 const gold=new THREE.MeshStandardMaterial({color:'#c5a15c',metalness:.83,roughness:.28,emissive:'#75511e',emissiveIntensity:.075,envMapIntensity:1.35});
 const edgeGold=new THREE.MeshStandardMaterial({color:'#e2c47b',metalness:.88,roughness:.19,envMapIntensity:1.45});
 const aged=new THREE.MeshStandardMaterial({color:'#665137',metalness:.72,roughness:.43,envMapIntensity:.9});
 const put=(geometry,x,y,z=0,material=gold)=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.renderOrder=20;group.add(mesh);return mesh;};
 const lathe=(profile,x,y,z=0,material=gold)=>put(new THREE.LatheGeometry(profile.map(p=>new THREE.Vector2(...p)),32),x,y,z,material);
 const ring=(r,tube,y,material=edgeGold)=>{const m=put(new THREE.TorusGeometry(r,tube,6,40),0,y,0,material);m.rotation.x=Math.PI/2;return m;};
 lathe([[0,-.055],[.18,-.055],[.23,-.035],[.24,-.012],[.23,.01],[.18,.027],[.16,.055],[.095,.074],[.063,.12],[.047,.17]],0,-.65);
 ring(.222,.008,-.666);ring(.168,.006,-.603,aged);
 lathe([[.046,-.49],[.058,-.46],[.058,-.43],[.039,-.39],[.035,-.30],[.033,.23],[.041,.34],[.055,.38],[.055,.42],[.04,.46],[.037,.54]],0,0);
 for(const y of [-.46,-.405,.34,.395,.455])ring(y<0?.054:.051,.006,y);
 for(let i=0;i<10;i++){const p=i*Math.PI/5;const flute=put(new THREE.CylinderGeometry(.0036,.0045,.58,5),Math.cos(p)*.035,-.025,Math.sin(p)*.035,edgeGold);}
 const beam=new THREE.Shape();beam.moveTo(-.80,.50);beam.bezierCurveTo(-.62,.57,-.29,.69,0,.625);beam.bezierCurveTo(.29,.69,.62,.57,.80,.50);beam.lineTo(.775,.463);beam.bezierCurveTo(.50,.51,.26,.575,0,.535);beam.bezierCurveTo(-.26,.575,-.50,.51,-.775,.463);beam.closePath();
 put(new THREE.ExtrudeGeometry(beam,{depth:.055,bevelEnabled:true,bevelSize:.008,bevelThickness:.008,bevelSegments:2,steps:1,curveSegments:20}),0,0,-.0275);
 const pivot=put(new THREE.CylinderGeometry(.067,.067,.10,24),0,.585,0,aged);pivot.rotation.x=Math.PI/2;
 const face=put(new THREE.SphereGeometry(.056,20,12),0,.585,.061,edgeGold);face.scale.z=.34;
 lathe([[.033,0],[.055,.035],[.043,.07],[.024,.11],[0,.17]],0,.65,0,edgeGold);
 const links=[],linkShape=new THREE.TorusGeometry(.0125,.0032,5,10),dummy=new THREE.Object3D(),axis=new THREE.Vector3(0,1,0);
 for(const side of [-1,1]){
  const x=side*.66,pivot=new THREE.Vector3(x,.535,0);
  const hook=put(new THREE.TorusGeometry(.025,.006,6,18),x,.516,0,edgeGold);
  lathe([[0,-.107],[.07,-.102],[.14,-.08],[.20,-.035],[.225,.008],[.224,.025],[.210,.025],[.188,-.025],[.13,-.065],[.06,-.08],[0,-.08]],x,-.14);
  const rim=put(new THREE.TorusGeometry(.221,.007,6,40),x,-.118,0,edgeGold);rim.rotation.x=Math.PI/2;
  for(const a of [Math.PI/6,5*Math.PI/6,3*Math.PI/2]){
   const end=new THREE.Vector3(x+Math.cos(a)*.202,-.117,Math.sin(a)*.202),delta=end.clone().sub(pivot),length=delta.length(),n=Math.ceil(length/.023);
   const rotation=new THREE.Quaternion().setFromUnitVectors(axis,delta.clone().normalize());
   for(let i=0;i<n;i++)links.push({position:pivot.clone().lerp(end,(i+.5)/n),rotation:rotation.clone().multiply(new THREE.Quaternion().setFromAxisAngle(axis,i%2?Math.PI/2:0))});
  }
 }
 const chain=new THREE.InstancedMesh(linkShape,edgeGold,links.length);chain.renderOrder=20;links.forEach((link,i)=>{dummy.position.copy(link.position);dummy.quaternion.copy(link.rotation);dummy.scale.set(.8,1.15,1);dummy.updateMatrix();chain.setMatrixAt(i,dummy.matrix);});group.add(chain);
 const pick=new THREE.Mesh(new THREE.BoxGeometry(1.84,1.68,.5),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,colorWrite:false}));pick.position.y=.08;pick.visible=false;pick.userData.pickOnly=true;group.add(pick);
 group.userData.craft={chainLinks:links.length,instancedChain:true,materials:['aged brass','polished brass edges','patinated recesses']};return group;
}
export class BalanceScene{
 constructor({scene,camera,mainRig,canvas,clock,canAnimate,reducedMotion,captureCamera,restoreCamera,onChange}){
  Object.assign(this,{scene,camera,mainRig,canvas,clock,canAnimate,reducedMotion,captureCamera,restoreCamera,onChange});this.phase='hidden';this.retreat=0;this.root=null;this.guardUntil=0;this.activationCount=0;this.clearSamples=0;
  this.background=new THREE.Group();this.background.visible=false;scene.add(this.background);this.positions=[];this.dummy=new THREE.Object3D();
  this.spheres=new THREE.InstancedMesh(crystalPanels(),new THREE.MeshPhysicalMaterial({color:'#ffffff',metalness:.16,roughness:.25,transparent:true,opacity:.40,depthWrite:false,side:THREE.DoubleSide,clearcoat:.65,clearcoatRoughness:.18}),30);
  this.wires=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.55,0),new THREE.MeshBasicMaterial({color:'#ffffff',wireframe:true,transparent:true,opacity:.60,depthWrite:false}),30);
  this.cores=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.25,0),new THREE.MeshStandardMaterial({color:'#ffffff',metalness:.48,roughness:.28,emissive:'#162333',emissiveIntensity:.2}),30);
  this.colorHues=[];for(let i=0;i<30;i++){const hue=(.56+i*.61803398875)%1;this.colorHues.push(hue);this.spheres.setColorAt(i,new THREE.Color().setHSL(hue,.55,.59));this.wires.setColorAt(i,new THREE.Color().setHSL(hue,.64,.66));this.cores.setColorAt(i,new THREE.Color().setHSL(hue,.49,.67));}
  for(const mesh of [this.spheres,this.wires,this.cores])mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.background.add(this.spheres,this.wires,this.cores);
 }
 mount(profile,parent,band,p,width){
  this.phase='hidden';this.profile=profile;this.root=model();parent.add(this.root);
  const theta=(band.a+band.b)/2,phi=p+width/2,normal=polar(1,theta,phi).negate(),right=new THREE.Vector3(-Math.sin(phi),Math.cos(phi),0),up=normal.clone().cross(right).normalize();
  this.root.position.copy(polar(band.r-profile.panelThickness-.16,theta,phi));this.root.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,up,normal));this.root.scale.setScalar(.24);this.root.visible=false;
  this.home={parent,position:this.root.position.clone(),quaternion:this.root.quaternion.clone(),scale:this.root.scale.clone(),normal};this.slotID='outer-bottom/tile-0';this.miniVisible=false;
 }
 placeBackground(){
  const w=this.canvas.clientWidth,h=this.canvas.clientHeight,d=this.camera.position.length(),tan=Math.tan(THREE.MathUtils.degToRad(this.camera.fov/2)),radius=this.profile.bound*this.mainRig.scale.x;
  const pose=this.focusCamera,q=new THREE.Quaternion().setFromEuler(new THREE.Euler(pose.pitch,pose.yaw,0,'YXZ'));
  const view=this.camera.clone();view.position.set(0,0,d).applyQuaternion(q);view.up.set(0,1,0).applyQuaternion(q);view.lookAt(0,0,0);view.updateMatrixWorld();
  const backdrop=this.mainSnapshot.position.clone().addScaledVector(this.retreatDirection,this.retreatDepth),center=backdrop.clone().project(view),centerPx=new THREE.Vector2((center.x*.5+.5)*w,(-center.y*.5+.5)*h),screenRadius=radius/view.position.distanceTo(backdrop)*h/(2*tan);
  const bounds={left:Infinity,right:-Infinity,top:Infinity,bottom:-Infinity};
  for(const x of [-.94,.94])for(const y of [-.76,.88])for(const z of [-.3,.3]){const v=new THREE.Vector3(x,y,z).multiply(this.target.scale).applyQuaternion(this.target.quaternion).add(this.target.position).project(view),px=(v.x*.5+.5)*w,py=(-v.y*.5+.5)*h;bounds.left=Math.min(bounds.left,px);bounds.right=Math.max(bounds.right,px);bounds.top=Math.min(bounds.top,py);bounds.bottom=Math.max(bounds.bottom,py);}
  this.positions=[];const placed=[],baseDepth=d+this.retreatDepth+radius+6;
  const maxRadius=1.04*4*(.08+4*.023)/baseDepth*h/(2*tan);
  const corridor=Math.max(Math.abs(centerPx.x-w/2)+screenRadius,Math.abs(bounds.left-w/2),Math.abs(bounds.right-w/2))+maxRadius+22;
  for(const side of [-1,1])for(let row=0;row<5;row++)for(let col=0;col<3;col++){
   const i=this.positions.length,depth=baseDepth+col*7+(row%2)*1.2,r=1.04*4*(.08+(i%5)*.023)/depth*h/(2*tan);
   const inner=w/2+side*corridor,outer=side<0?r+12:w-r-12,px=THREE.MathUtils.lerp(inner,outer,col/2),py=h*(.12+row*.19);
   const x=(px/w-.5)*2,y=(.5-py/h)*2;
   this.positions.push(new THREE.Vector3(x*depth*tan*w/h,y*depth*tan,-depth).applyQuaternion(q).add(view.position));placed.push({x:px,y:py,r,side,row,column:col,depth});
  }
  this.spheres.count=this.wires.count=this.cores.count=30;
  this.placement={count:30,layout:'two balanced banks; five rows; three depth planes',screenRadius,mainCenter:centerPx.toArray(),foregroundBounds:bounds,points:placed};
 }
 worldHome(){this.home.parent.updateWorldMatrix(true,false);return{position:this.home.position.clone().applyMatrix4(this.home.parent.matrixWorld),quaternion:this.home.parent.getWorldQuaternion(new THREE.Quaternion()).multiply(this.home.quaternion),scale:this.home.parent.getWorldScale(new THREE.Vector3()).multiply(this.home.scale)};}
 open(){
  this.guardUntil=performance.now()+650;
  if(!this.root||this.phase!=='hidden')return false;
  this.mainSnapshot={position:this.mainRig.position.clone(),quaternion:this.mainRig.quaternion.clone(),scale:this.mainRig.scale.clone(),camera:this.captureCamera()};
  this.retreatDirection=this.camera.getWorldDirection(new THREE.Vector3());
  this.originalDistance=this.camera.position.distanceTo(this.mainRig.position);
  // Keep object scale intact: moving about one original view distance back halves its angular size.
  this.retreatDepth=this.originalDistance*(1/.52-1);this.retreat=0;this.retreatFrom=0;
  this.focusCamera={...this.mainSnapshot.camera,yaw:this.mainSnapshot.camera.yaw+.08,pitch:clamp(this.mainSnapshot.camera.pitch-.28,-1.4,1.4)};
  this.activationCount++;this.root.updateWorldMatrix(true,true);this.scene.attach(this.root);this.root.visible=true;
  const radius=this.profile.bound*this.mainRig.scale.x;
  this.target={position:this.camera.position.clone().normalize().multiplyScalar(radius+.85).addScaledVector(this.camera.up,-.10),quaternion:this.camera.quaternion.clone(),scale:new THREE.Vector3(1.15,1.15,1.15)};
  this.from={position:this.root.position.clone(),quaternion:this.root.quaternion.clone(),scale:this.root.scale.clone()};this.started=this.clock();this.phase=this.canAnimate()?'opening':'ready';this.miniVisible=this.phase==='opening';
  this.placeBackground();this.background.visible=true;if(this.phase==='ready'){this.retreat=1;this.applyBackdrop(true);this.applyTarget(this.target,1);}this.onChange();return true;
 }
 applyTarget(target,t){this.root.position.lerpVectors(this.from.position,target.position,t);this.root.quaternion.slerpQuaternions(this.from.quaternion,target.quaternion,t);this.root.scale.lerpVectors(this.from.scale,target.scale,t);}
 applyBackdrop(forceCamera=false){
  if(this.phase==='hidden'||!this.mainSnapshot)return;
  if(this.phase==='opening'||forceCamera){const a=this.mainSnapshot.camera,b=this.focusCamera,t=this.retreat;this.restoreCamera({yaw:THREE.MathUtils.lerp(a.yaw,b.yaw,t),pitch:THREE.MathUtils.lerp(a.pitch,b.pitch,t),distance:a.distance});}
  else if(this.phase==='closing'){const a=this.closingCamera,b=this.mainSnapshot.camera,t=this.retreatFrom?1-this.retreat/this.retreatFrom:1;this.restoreCamera({yaw:THREE.MathUtils.lerp(a.yaw,b.yaw,t),pitch:THREE.MathUtils.lerp(a.pitch,b.pitch,t),distance:THREE.MathUtils.lerp(a.distance,b.distance,t)});}
  this.mainRig.position.copy(this.mainSnapshot.position).addScaledVector(this.retreatDirection,this.retreatDepth*this.retreat);
  this.mainRig.quaternion.copy(this.mainSnapshot.quaternion);this.mainRig.scale.copy(this.mainSnapshot.scale);this.mainRig.updateWorldMatrix(true,true);
 }
 close(immediate=false){
  if(!this.root||this.phase==='hidden')return;
  this.guardUntil=performance.now()+200;
  if(immediate||!this.canAnimate()){this.finishHome();return;}
  if(this.phase==='closing')return;this.retreatFrom=this.retreat;this.closingCamera=this.captureCamera();
  this.from={position:this.root.position.clone(),quaternion:this.root.quaternion.clone(),scale:this.root.scale.clone()};this.started=this.clock();this.phase='closing';this.miniVisible=true;this.onChange();
 }
 finishHome(){
  if(this.mainSnapshot){this.mainRig.position.copy(this.mainSnapshot.position);this.mainRig.quaternion.copy(this.mainSnapshot.quaternion);this.mainRig.scale.copy(this.mainSnapshot.scale);this.restoreCamera(this.mainSnapshot.camera);}
  this.retreat=0;this.mainSnapshot=null;
  this.home.parent.add(this.root);this.root.position.copy(this.home.position);this.root.quaternion.copy(this.home.quaternion);this.root.scale.copy(this.home.scale);this.phase='hidden';this.background.visible=false;this.root.visible=false;this.miniVisible=false;this.onChange();
 }
 update(mode,occluders){
  this.occluders=occluders;
  if(!this.root)return;
  if(this.phase==='opening'&&this.reducedMotion()){this.retreat=1;this.applyBackdrop(true);this.applyTarget(this.target,1);this.phase='ready';this.miniVisible=false;this.onChange();}
  if(this.phase==='closing'&&this.reducedMotion())this.finishHome();
  this.applyBackdrop();
  if(this.phase==='hidden'){
   this.root.updateWorldMatrix(true,true);const pos=this.root.getWorldPosition(new THREE.Vector3()),normal=this.home.normal.clone().transformDirection(this.home.parent.matrixWorld);
   const facing=this.camera.position.clone().sub(pos).normalize().dot(normal);this.miniVisible=mode==='inspect'&&facing>.60&&facing<.995;this.root.visible=this.miniVisible;this.clearSamples=0;
   if(this.miniVisible){const ray=new THREE.Raycaster();for(const x of [-.5,0,.5])for(const y of [-.4,0,.4]){const p=this.root.localToWorld(new THREE.Vector3(x,y,.05)),dir=p.clone().sub(this.camera.position);ray.set(this.camera.position,dir.clone().normalize());ray.far=dir.length()-.005;if(!ray.intersectObjects(occluders,false).length)this.clearSamples++;}if(!this.clearSamples){this.miniVisible=false;this.root.visible=false;}}
  }else{
   this.root.visible=mode!=='point';
   if(this.phase==='opening'||this.phase==='closing'){
    const t=smooth((this.clock()-this.started)/(this.phase==='opening'?.85:.65));
    this.retreat=this.phase==='opening'?t:this.retreatFrom*(1-t);this.applyBackdrop();
    const target=this.phase==='opening'?this.target:this.worldHome();this.applyTarget(target,t);
    if(t>=1){if(this.phase==='opening'){this.phase='ready';this.miniVisible=false;this.onChange();}else this.finishHome();}
   }
  }
  if(this.background.visible){
   const t=this.clock();for(let i=0;i<this.positions.length;i++){
    this.dummy.position.copy(this.positions[i]);this.dummy.rotation.set(t*(.2+i%3*.03),t*(.32+i%7*.02),i*.4);this.dummy.scale.setScalar(4*(.08+(i%5)*.023));this.dummy.updateMatrix();this.spheres.setMatrixAt(i,this.dummy.matrix);this.wires.setMatrixAt(i,this.dummy.matrix);this.cores.setMatrixAt(i,this.dummy.matrix);
   }this.spheres.instanceMatrix.needsUpdate=true;this.wires.instanceMatrix.needsUpdate=true;this.cores.instanceMatrix.needsUpdate=true;
  }
 }
 physicalHit(ray,occluders){
  const hits=ray.intersectObject(this.root,true).filter(hit=>!hit.object.userData.pickOnly&&hit.object.visible);
  if(!hits.length)return null;const cover=ray.intersectObjects(occluders,false);
  return !cover.length||cover[0].distance>=hits[0].distance-.005?hits[0]:null;
 }
 visibleHandles(){
  if(this.phase!=='hidden'||!this.miniVisible||!this.root?.visible)return[];
  this.root.updateWorldMatrix(true,true);const ray=new THREE.Raycaster(),rect=this.canvas.getBoundingClientRect(),points=[];
  for(const [x,y,z]of [[0,0,.04],[0,.53,.055],[-.55,.5,.04],[.55,.5,.04],[-.59,-.075,.10],[.59,-.075,.10],[0,-.59,.08],[0,.72,0]]){
   const point=this.root.localToWorld(new THREE.Vector3(x,y,z));ray.set(this.camera.position,point.clone().sub(this.camera.position).normalize());
   const hit=this.physicalHit(ray,this.occluders||[]);if(!hit)continue;const p=hit.point.clone().project(this.camera);points.push([rect.left+(p.x*.5+.5)*rect.width,rect.top+(-p.y*.5+.5)*rect.height]);
  }return points;
 }
 pick(event,occluders){
  if(!this.root?.visible)return false;if(this.phase==='hidden'&&!this.miniVisible)return false;
  const r=this.canvas.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((event.clientX-r.left)/r.width*2-1,1-(event.clientY-r.top)/r.height*2),this.camera);
  this.root.updateWorldMatrix(true,true);
  if(this.phase!=='hidden')return ray.intersectObject(this.root,true).length>0;
  if(this.physicalHit(ray,occluders))return true;
  // A small screen-space tolerance follows only verified visible gold, never the hidden volume.
  return this.visibleHandles().some(p=>Math.hypot(event.clientX-p[0],event.clientY-p[1])<=7);
 }
 get state(){
  if(!this.root)return{phase:'hidden'};const world=this.root.getWorldPosition(new THREE.Vector3()),projected=world.clone().project(this.camera);
  return{phase:this.phase,visibleHitPoints:this.visibleHandles(),craft:this.root.userData.craft,focusCamera:this.focusCamera,retreat:this.retreat,retreatDepth:this.retreatDepth||0,mainPosition:this.mainRig.position.toArray(),mainScale:this.mainRig.scale.toArray(),mainQuaternion:this.mainRig.quaternion.toArray(),projectedSizeRatio:this.mainSnapshot?this.originalDistance/this.camera.position.distanceTo(this.mainRig.position):1,backgroundSpin:this.clock(),slotID:this.slotID,worldNormal:this.home.normal.clone().transformDirection(this.home.parent.matrixWorld).toArray(),homeLocal:this.home.position.toArray(),worldPosition:world.toArray(),projected:projected.toArray(),miniVisible:this.miniVisible,clearSamples:this.clearSamples,activationCount:this.activationCount,backgroundCount:this.background.visible?this.positions.length:0,backgroundDrawCalls:3,backgroundDiameterFactor:4,backgroundHues:this.colorHues,backgroundDiameters:this.positions.map((_,i)=>2*1.04*4*(.08+(i%5)*.023)),backgroundOriginalDiameters:this.positions.map((_,i)=>2*1.04*(.08+(i%5)*.023)),placement:this.placement,guardUntil:this.guardUntil};
 }
}
