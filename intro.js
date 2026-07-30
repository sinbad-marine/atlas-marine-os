(() => {
  "use strict";

  const overlay=document.getElementById("cinematicIntro");
  const canvas=document.getElementById("introCanvas");
  const brand=document.getElementById("introBrand");
  const skip=document.getElementById("skipIntro");
  const replay=document.getElementById("replayIntro");
  const soundButton=document.getElementById("introSound");
  if(!overlay||!canvas)return;

  const ctx=canvas.getContext("2d",{alpha:false});
  const earthImage=new Image();
  const starImage=new Image();
  const chartImage=new Image();
  earthImage.src="./nasa-blue-marble.png";
  starImage.src="./nasa-deep-star-map.jpg";
  chartImage.src="./maritime-world-chart.png";

  let width=0,height=0,dpr=1,startTime=0,frame=0,running=false,assetsReady=false;
  let audioContext=null,soundEnabled=false,stars=[],dust=[];
  const clamp=v=>Math.max(0,Math.min(1,v));
  const smooth=v=>{const x=clamp(v);return x*x*(3-2*x);};
  const easeOut=v=>1-Math.pow(1-clamp(v),3);

  function seededRandom(seed){
    let state=seed>>>0;
    return()=>{state=(state*1664525+1013904223)>>>0;return state/4294967296;};
  }

  function resize(){
    width=innerWidth;height=innerHeight;dpr=Math.min(devicePixelRatio||1,1.7);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    const random=seededRandom(197806);
    stars=Array.from({length:Math.min(2100,Math.round(width*height/620))},()=>({
      x:random()*width,y:random()*height,r:.18+random()*1.5,a:.2+random()*.8,p:random()*6.28
    }));
    dust=Array.from({length:80},()=>({
      x:random()*width,y:height*(.2+random()*.58),r:20+random()*110,a:.006+random()*.022
    }));
  }

  function drawSpace(time,cameraPush){
    ctx.fillStyle="#010309";ctx.fillRect(0,0,width,height);
    if(starImage.complete&&starImage.naturalWidth){
      const scale=Math.max(width/starImage.naturalWidth,height/starImage.naturalHeight)*(1+cameraPush*.1);
      const sw=starImage.naturalWidth*scale,sh=starImage.naturalHeight*scale;
      ctx.globalAlpha=.88;
      ctx.drawImage(starImage,(width-sw)/2-cameraPush*width*.025,(height-sh)/2+Math.sin(time*.08)*8,sw,sh);
      ctx.globalAlpha=1;
    }
    dust.forEach(c=>{
      const glow=ctx.createRadialGradient(c.x,c.y,0,c.x,c.y,c.r);
      glow.addColorStop(0,`rgba(118,137,177,${c.a})`);glow.addColorStop(1,"rgba(0,0,0,0)");
      ctx.fillStyle=glow;ctx.fillRect(c.x-c.r,c.y-c.r,c.r*2,c.r*2);
    });
    stars.forEach(s=>{
      ctx.globalAlpha=s.a*(.7+Math.sin(time*1.8+s.p)*.3);
      ctx.fillStyle=s.r>1.15?"#ddebff":"#fff";
      ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill();
    });
    ctx.globalAlpha=1;
    const sun=ctx.createRadialGradient(width*.04,height*.31,0,width*.04,height*.31,Math.min(width,height)*.38);
    sun.addColorStop(0,"rgba(255,246,215,.4)");sun.addColorStop(.08,"rgba(255,203,118,.15)");
    sun.addColorStop(1,"rgba(0,0,0,0)");ctx.fillStyle=sun;ctx.fillRect(0,0,width*.52,height*.75);
  }

  function drawGlobe(cx,cy,radius,rotation){
    if(!earthImage.naturalWidth)return;
    ctx.save();ctx.beginPath();ctx.arc(cx,cy,radius,0,Math.PI*2);ctx.clip();
    const strips=Math.max(100,Math.round(radius*.75));
    for(let i=0;i<strips;i++){
      const nx=i/(strips-1)*2-1,theta=Math.asin(nx);
      let u=(rotation+theta/(Math.PI*2))%1;if(u<0)u+=1;
      ctx.drawImage(earthImage,Math.floor(u*earthImage.naturalWidth),0,2,earthImage.naturalHeight,
        cx+nx*radius,cy-radius,radius*2/strips+1.6,radius*2);
    }
    const night=ctx.createLinearGradient(cx-radius,cy,cx+radius,cy);
    night.addColorStop(0,"rgba(0,0,0,.02)");night.addColorStop(.48,"rgba(0,4,10,.08)");
    night.addColorStop(.75,"rgba(0,3,9,.5)");night.addColorStop(1,"rgba(0,0,0,.94)");
    ctx.fillStyle=night;ctx.fillRect(cx-radius,cy-radius,radius*2,radius*2);ctx.restore();
    const lightAngle=Math.atan2(height*.31-cy,width*.04-cx);
    ctx.save();ctx.globalCompositeOperation="lighter";ctx.lineCap="round";
    ctx.shadowColor="rgba(83,178,226,.24)";ctx.shadowBlur=Math.max(5,radius*.025);
    ctx.strokeStyle="rgba(150,213,239,.22)";ctx.lineWidth=Math.max(.7,radius*.004);
    ctx.beginPath();ctx.arc(cx,cy,radius+.3,lightAngle-1.35,lightAngle+1.35);ctx.stroke();ctx.restore();
    ctx.strokeStyle="rgba(104,166,196,.1)";ctx.lineWidth=.6;
    ctx.beginPath();ctx.arc(cx,cy,radius,0,Math.PI*2);ctx.stroke();
  }

  function drawSkyFloor(progress){
    const sky=ctx.createLinearGradient(0,0,0,height*.38);
    sky.addColorStop(0,"#3c94cf");sky.addColorStop(.65,"#69b6df");sky.addColorStop(1,"#9ad0e7");
    ctx.fillStyle=sky;ctx.fillRect(0,0,width,height*.36);
    const floor=ctx.createLinearGradient(0,height*.3,0,height);
    floor.addColorStop(0,"#1e536d");floor.addColorStop(.3,"#143748");floor.addColorStop(1,"#07141d");
    ctx.fillStyle=floor;ctx.fillRect(0,height*.32,width,height*.68);
    ctx.globalAlpha=.16*progress;ctx.fillStyle="#f7d996";
    ctx.fillRect(0,height*.318,width,2);ctx.globalAlpha=1;
  }

  function chartBounds(){
    const top=height*.33,bottom=height*.985;
    const topWidth=Math.min(width*.76,1320),bottomWidth=Math.min(width*.985,1820);
    return{top,bottom,topWidth,bottomWidth,cx:width/2,centerY:top+(bottom-top)*.48};
  }

  function drawChartRug(progress,time){
    const b=chartBounds(),rows=170;
    const appear=smooth(progress);
    ctx.save();
    ctx.shadowColor="rgba(0,0,0,.62)";ctx.shadowBlur=30;ctx.shadowOffsetY=18;
    ctx.fillStyle="rgba(0,0,0,.28)";
    ctx.beginPath();ctx.moveTo(b.cx-b.topWidth/2,b.top);ctx.lineTo(b.cx+b.topWidth/2,b.top);
    ctx.lineTo(b.cx+b.bottomWidth/2,b.bottom);ctx.lineTo(b.cx-b.bottomWidth/2,b.bottom);ctx.closePath();ctx.fill();
    ctx.restore();
    for(let i=0;i<rows;i++){
      const t=i/(rows-1),sy=t*chartImage.naturalHeight;
      const rowW=b.topWidth+(b.bottomWidth-b.topWidth)*t;
      const y=b.top+(b.bottom-b.top)*t;
      const roll=(1-appear)*Math.sin(t*24+time*3)*Math.min(55,height*.07);
      const reveal=clamp(appear*1.28-t*.18);
      if(reveal<=0)continue;
      ctx.globalAlpha=reveal;
      ctx.drawImage(chartImage,0,sy,chartImage.naturalWidth,Math.max(2,chartImage.naturalHeight/rows+1),
        b.cx-rowW/2,y+roll,rowW,(b.bottom-b.top)/rows+2);
    }
    ctx.globalAlpha=1;
    const sheen=ctx.createLinearGradient(0,b.top,0,b.bottom);
    sheen.addColorStop(0,"rgba(255,255,255,.13)");sheen.addColorStop(.38,"rgba(255,255,255,0)");
    sheen.addColorStop(1,"rgba(2,17,30,.15)");
    ctx.fillStyle=sheen;ctx.beginPath();ctx.moveTo(b.cx-b.topWidth/2,b.top);ctx.lineTo(b.cx+b.topWidth/2,b.top);
    ctx.lineTo(b.cx+b.bottomWidth/2,b.bottom);ctx.lineTo(b.cx-b.bottomWidth/2,b.bottom);ctx.closePath();ctx.fill();
    return b;
  }

  function drawFlyingStar(bounds,progress){
    const p=smooth(progress),sx=width*.78,sy=height*.075,ex=bounds.cx,ey=bounds.centerY;
    const x=sx+(ex-sx)*p,y=sy+(ey-sy)*p-Math.sin(p*Math.PI)*height*.08;
    const trail=ctx.createLinearGradient(sx,sy,x,y);
    trail.addColorStop(0,"rgba(255,230,125,0)");trail.addColorStop(1,"rgba(255,239,172,.8)");
    ctx.strokeStyle=trail;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(sx,sy);ctx.quadraticCurveTo(width*.64,height*.02,x,y);ctx.stroke();
    const r=8+10*p,glow=ctx.createRadialGradient(x,y,0,x,y,r*5);
    glow.addColorStop(0,"rgba(255,255,235,1)");glow.addColorStop(.13,"rgba(255,224,105,.92)");
    glow.addColorStop(.45,"rgba(250,181,45,.28)");glow.addColorStop(1,"rgba(255,190,40,0)");
    ctx.fillStyle=glow;ctx.fillRect(x-r*5,y-r*5,r*10,r*10);
    return{x,y};
  }

  function rayEndpoint(bounds,index){
    const topY=bounds.top+6,bottomY=bounds.bottom-8,midY=bounds.centerY;
    const topL=bounds.cx-bounds.topWidth*.48,topR=bounds.cx+bounds.topWidth*.48;
    const botL=bounds.cx-bounds.bottomWidth*.48,botR=bounds.cx+bounds.bottomWidth*.48;
    return[
      [bounds.cx,topY],[topR,topY],[botR,midY],[botR,bottomY],
      [bounds.cx,bottomY],[botL,bottomY],[botL,midY],[topL,topY]
    ][index];
  }

  function drawCompass(bounds,progress){
    const p=smooth(progress),cx=bounds.cx,cy=bounds.centerY;
    ctx.save();ctx.globalCompositeOperation="lighter";
    for(let i=0;i<8;i++){
      const [ex,ey]=rayEndpoint(bounds,i),strong=i%2===0;
      const x=cx+(ex-cx)*p,y=cy+(ey-cy)*p;
      const grad=ctx.createLinearGradient(cx,cy,x,y);
      grad.addColorStop(0,strong?"rgba(255,242,174,.95)":"rgba(255,226,134,.78)");
      grad.addColorStop(1,"rgba(255,192,65,0)");
      ctx.strokeStyle=grad;ctx.lineWidth=strong?2.1:1.05;
      ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(x,y);ctx.stroke();
    }
    const radius=(20+Math.min(width,height)*.045*p),glow=ctx.createRadialGradient(cx,cy,0,cx,cy,radius*2.4);
    glow.addColorStop(0,"rgba(255,255,235,.96)");glow.addColorStop(.18,"rgba(255,222,105,.72)");
    glow.addColorStop(1,"rgba(255,190,40,0)");ctx.fillStyle=glow;
    ctx.fillRect(cx-radius*2.4,cy-radius*2.4,radius*4.8,radius*4.8);
    ctx.translate(cx,cy);ctx.strokeStyle="rgba(255,225,137,.95)";ctx.fillStyle="rgba(218,151,38,.92)";
    ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,0,radius*.54,0,Math.PI*2);ctx.stroke();
    for(let i=0;i<8;i++){
      ctx.save();ctx.rotate(i*Math.PI/4);const long=i%2===0?radius:radius*.72;
      ctx.beginPath();ctx.moveTo(0,-long);ctx.lineTo(radius*.13,0);ctx.lineTo(0,long*.18);
      ctx.lineTo(-radius*.13,0);ctx.closePath();ctx.fill();ctx.restore();
    }
    ctx.restore();
  }

  function ensureAudio(){
    if(audioContext)return audioContext;
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!AC)return null;audioContext=new AC();return audioContext;
  }
  function playThunder(){
    if(!soundEnabled)return;const audio=ensureAudio();if(!audio)return;
    if(audio.state==="suspended")audio.resume();
    const duration=9.2,length=Math.floor(audio.sampleRate*duration);
    const buffer=audio.createBuffer(1,length,audio.sampleRate),data=buffer.getChannelData(0);
    let brown=0;for(let i=0;i<length;i++){const white=Math.random()*2-1;brown=(brown*.985+white*.055)/1.04;
      data[i]=brown*Math.min(1,i/(audio.sampleRate*2.2))*Math.pow(1-i/length,.34);}
    const source=audio.createBufferSource(),low=audio.createBiquadFilter(),gain=audio.createGain();
    source.buffer=buffer;low.type="lowpass";low.frequency.setValueAtTime(85,audio.currentTime);
    low.frequency.exponentialRampToValueAtTime(420,audio.currentTime+5.8);
    gain.gain.setValueAtTime(.0001,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.055,audio.currentTime+1.8);
    gain.gain.exponentialRampToValueAtTime(.2,audio.currentTime+5.4);gain.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+duration);
    source.connect(low).connect(gain).connect(audio.destination);source.start();
  }

  function finish(markSeen=true){
    running=false;cancelAnimationFrame(frame);brand.classList.remove("visible");overlay.classList.add("finished");
    if(markSeen)sessionStorage.setItem("sinbad-v815-intro-seen","1");
  }

  function animate(timestamp){
    if(!running)return;if(!startTime)startTime=timestamp;
    const seconds=(timestamp-startTime)/1000,cx=width/2,cy=height/2;
    if(seconds<9.2){
      drawSpace(seconds,smooth((seconds-1.1)/6.8));
      if(seconds>2){
        const approach=easeOut((seconds-2)/6.4),radius=12+approach*Math.min(width,height)*.445;
        drawGlobe(cx+(1-approach)*width*.17,cy+(1-approach)*height*.08,radius,.72-seconds*.027);
      }
    }else{
      drawSkyFloor(smooth((seconds-9.2)/2));
      const bounds=drawChartRug((seconds-9.2)/4.1,seconds);
      if(seconds>=13.1&&seconds<15.4)drawFlyingStar(bounds,(seconds-13.1)/2.1);
      if(seconds>=15.05)drawCompass(bounds,(seconds-15.05)/1.7);
      if(seconds>=16.4)brand.classList.add("visible");
    }
    if(seconds>=27.4)overlay.classList.add("finished");
    if(seconds>=30.4){finish(true);return;}
    frame=requestAnimationFrame(animate);
  }

  function play(force=false){
    if(matchMedia("(prefers-reduced-motion: reduce)").matches&&!force){finish(true);return;}
    overlay.classList.remove("finished");brand.classList.remove("visible");startTime=0;running=true;
    playThunder();frame=requestAnimationFrame(animate);
  }

  async function prepare(){
    resize();
    await Promise.allSettled([earthImage.decode?.()||Promise.resolve(),starImage.decode?.()||Promise.resolve(),chartImage.decode?.()||Promise.resolve()]);
    assetsReady=true;
    if(sessionStorage.getItem("sinbad-v815-intro-seen")==="1")finish(false);else play(false);
  }

  addEventListener("resize",resize,{passive:true});
  skip?.addEventListener("click",()=>finish(true));
  soundButton?.addEventListener("click",()=>{
    soundEnabled=true;ensureAudio()?.resume();soundButton.setAttribute("aria-pressed","true");
    soundButton.textContent="Cinematic sound on";if(assetsReady)play(true);
  });
  replay?.addEventListener("click",()=>{
    soundEnabled=true;ensureAudio()?.resume();
    if(soundButton){soundButton.setAttribute("aria-pressed","true");soundButton.textContent="Cinematic sound on";}
    if(assetsReady)play(true);
  });
  window.AtlasIntro={play:()=>assetsReady&&play(true),skip:()=>finish(true)};
  prepare();
})();
