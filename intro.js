(() => {
  "use strict";

  const overlay = document.getElementById("cinematicIntro");
  const canvas = document.getElementById("introCanvas");
  const brand = document.getElementById("introBrand");
  const skip = document.getElementById("skipIntro");
  const replay = document.getElementById("replayIntro");
  const soundButton = document.getElementById("introSound");
  if (!overlay || !canvas) return;

  const ctx = canvas.getContext("2d", { alpha: false });
  const earthImage = new Image();
  const starImage = new Image();
earthImage.src = "./nasa-blue-marble.png";
starImage.src = "./nasa-deep-star-map.jpg";

  const chart = document.createElement("canvas");
  chart.width = 2048;
  chart.height = 1024;
  const chartCtx = chart.getContext("2d");

  // Maritime corridors use extra sea waypoints so the golden tracks avoid
  // continents, narrow capes and the sharp land-cutting chords of v8.10.
  // Hand-plotted ocean passages. Extra waypoints keep the gold routes in
  // navigable water instead of drawing straight lines across continents.
  const routes = [
    [[-74,40.7],[-70,39.5],[-62,39],[-52,38.5],[-42,38],[-32,37.5],[-22,36.5],[-12,35.7],[-5.35,36.1],[-3,36],[2,37],[8,36.8],[12.5,36.2],[15,35.7],[19,36.5],[22.5,36],[24.5,37.2],[25.5,39],[26.1,40.1],[27.5,40.7],[28.98,41]],
    [[28.98,41],[27.5,40.7],[26.1,40.1],[25.4,38.6],[24.5,36.2],[27,34.2],[30.5,32.1],[32.3,31.3],[32.6,29.8],[33.2,27],[34.5,23],[36.5,18],[40.5,13.2],[43.2,12.5],[47,12.8],[51,14.5],[55,18],[58.5,20],[62,21],[66,20.5],[69.5,19.5],[72.9,19.1]],
    [[72.9,19.1],[71.8,15],[73.5,10],[77,6],[80.5,5.5],[85,6],[90,6],[95,5],[100,3],[103.8,1.3],[108,3],[112,6],[115,10],[117.5,15],[120,20],[122,23],[125,26],[129,29],[133,32],[136.5,34],[139.7,35.7]],
    [[-5.35,36.1],[-10,30],[-20,20],[-35,10],[-50,5],[-65,7],[-76,9],[-79.5,9],[-80.5,7],[-85,7],[-90,10],[-96,14],[-103,19],[-110,25],[-116,31],[-118.2,33.7]],
    [[103.8,1.3],[104.7,-2],[105.8,-6.1],[110,-8],[115.8,-8.8],[120,-12],[125,-16],[121,-22],[116,-29],[114,-34],[118,-37],[126,-39],[137,-42],[147,-39],[153,-34],[158,-35],[166,-36],[174.8,-36.8]]
  ];
  const ports = [
    ["NEW YORK",-74,40.7],["GIBRALTAR",-5.35,36.1],["ISTANBUL",28.98,41],
    ["DUBAI",55.27,25.2],["MUMBAI",72.9,19.1],["SINGAPORE",103.8,1.3],
    ["TOKYO",139.7,35.7],["PANAMA",-79.5,9],["LOS ANGELES",-118.2,33.7],
    ["SYDNEY",151.2,-33.8],["AUCKLAND",174.8,-36.8]
  ];

  let width = 0;
  let height = 0;
  let dpr = 1;
  let startTime = 0;
  let frame = 0;
  let running = false;
  let assetsReady = false;
  let audioContext = null;
  let soundEnabled = false;
  let stars = [];
  let dust = [];

  const clamp = value => Math.max(0, Math.min(1, value));
  const smooth = value => {
    const x = clamp(value);
    return x * x * (3 - 2 * x);
  };
  const easeOut = value => 1 - Math.pow(1 - clamp(value), 3);
  const project = (lon, lat) => [(lon + 180) / 360, (90 - lat) / 180];

  function seededRandom(seed) {
    let state = seed >>> 0;
    return () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  function buildChart() {
    if (!earthImage.naturalWidth) return;
    chartCtx.clearRect(0, 0, chart.width, chart.height);
    chartCtx.save();
    chartCtx.filter = "saturate(.55) contrast(1.15) brightness(.72) hue-rotate(8deg)";
    chartCtx.drawImage(earthImage, 0, 0, chart.width, chart.height);
    chartCtx.restore();
    chartCtx.fillStyle = "rgba(1,27,45,.43)";
    chartCtx.fillRect(0, 0, chart.width, chart.height);

    const vignette = chartCtx.createRadialGradient(chart.width*.5,chart.height*.48,chart.height*.1,chart.width*.5,chart.height*.5,chart.width*.62);
    vignette.addColorStop(0,"rgba(22,91,111,.08)");
    vignette.addColorStop(1,"rgba(0,8,18,.65)");
    chartCtx.fillStyle=vignette;
    chartCtx.fillRect(0,0,chart.width,chart.height);

    chartCtx.lineWidth=1;
    chartCtx.strokeStyle="rgba(151,207,218,.22)";
    for(let lon=-180;lon<=180;lon+=10){
      const x=(lon+180)/360*chart.width;
      chartCtx.beginPath();chartCtx.moveTo(x,0);chartCtx.lineTo(x,chart.height);chartCtx.stroke();
    }
    for(let lat=-80;lat<=80;lat+=10){
      const y=(90-lat)/180*chart.height;
      chartCtx.beginPath();chartCtx.moveTo(0,y);chartCtx.lineTo(chart.width,y);chartCtx.stroke();
    }

    chartCtx.strokeStyle="rgba(228,205,143,.34)";
    chartCtx.lineWidth=1.2;
    chartCtx.setLineDash([5,9]);
    [120,200,310,430].forEach((offset,index)=>{
      chartCtx.beginPath();
      for(let x=0;x<=chart.width;x+=12){
        const y=chart.height*.54+Math.sin(x*.008+index)*offset*.08+(index-1.5)*78;
        x?chartCtx.lineTo(x,y):chartCtx.moveTo(x,y);
      }
      chartCtx.stroke();
    });
    chartCtx.setLineDash([]);

    chartCtx.fillStyle="rgba(223,231,218,.72)";
    chartCtx.textAlign="center";
    chartCtx.font="500 23px Georgia";
    [["NORTH ATLANTIC",-42,32],["SOUTH ATLANTIC",-25,-27],["INDIAN OCEAN",79,-26],["NORTH PACIFIC",-150,24],["SOUTH PACIFIC",-133,-31],["ARCTIC OCEAN",30,75]].forEach(([label,lon,lat])=>{
      const [x,y]=project(lon,lat);
      chartCtx.fillText(label,x*chart.width,y*chart.height);
    });
    chartCtx.font="700 18px system-ui";
    chartCtx.letterSpacing="4px";
    chartCtx.fillStyle="rgba(244,213,133,.9)";
    chartCtx.fillText("SINBAD MARINE • WORLD CHART",chart.width/2,chart.height-26);
  }

  function resize() {
    width = innerWidth;
    height = innerHeight;
    dpr = Math.min(devicePixelRatio || 1, 1.7);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    const random=seededRandom(197706);
    stars=Array.from({length:Math.min(2100,Math.round(width*height/620))},()=>({
      x:random()*width,y:random()*height,r:.18+random()*1.5,a:.2+random()*.8,p:random()*6.28
    }));
    dust=Array.from({length:90},()=>({
      x:random()*width,y:height*(.22+random()*.55),r:20+random()*110,a:.006+random()*.025
    }));
  }

  function drawSpace(time, cameraPush) {
    ctx.fillStyle="#010309";
    ctx.fillRect(0,0,width,height);

    if(starImage.complete&&starImage.naturalWidth){
      const scale=Math.max(width/starImage.naturalWidth,height/starImage.naturalHeight)*(1+cameraPush*.1);
      const sw=starImage.naturalWidth*scale;
      const sh=starImage.naturalHeight*scale;
      const x=(width-sw)/2-cameraPush*width*.025;
      const y=(height-sh)/2+Math.sin(time*.08)*8;
      ctx.globalAlpha=.88;
      ctx.drawImage(starImage,x,y,sw,sh);
      ctx.globalAlpha=1;
    }

    ctx.save();
    ctx.translate(width*.5,height*.5);
    ctx.rotate(-.17);
    const band=ctx.createLinearGradient(0,-height*.26,0,height*.26);
    band.addColorStop(0,"rgba(3,10,22,0)");
    band.addColorStop(.42,"rgba(111,128,164,.08)");
    band.addColorStop(.5,"rgba(230,207,174,.12)");
    band.addColorStop(.58,"rgba(87,111,156,.08)");
    band.addColorStop(1,"rgba(3,10,22,0)");
    ctx.fillStyle=band;ctx.fillRect(-width,-height*.26,width*2,height*.52);
    ctx.restore();

    dust.forEach(cloud=>{
      const glow=ctx.createRadialGradient(cloud.x,cloud.y,0,cloud.x,cloud.y,cloud.r);
      glow.addColorStop(0,`rgba(118,137,177,${cloud.a})`);
      glow.addColorStop(1,"rgba(0,0,0,0)");
      ctx.fillStyle=glow;ctx.fillRect(cloud.x-cloud.r,cloud.y-cloud.r,cloud.r*2,cloud.r*2);
    });
    stars.forEach(star=>{
      const twinkle=.7+Math.sin(time*1.8+star.p)*.3;
      ctx.globalAlpha=star.a*twinkle;
      ctx.fillStyle=star.r>1.15?"#ddebff":"#fff";
      ctx.beginPath();ctx.arc(star.x,star.y,star.r,0,Math.PI*2);ctx.fill();
    });
    ctx.globalAlpha=1;

    const sunX=width*.04,sunY=height*.31;
    const sunlight=ctx.createRadialGradient(sunX,sunY,0,sunX,sunY,Math.min(width,height)*.38);
    sunlight.addColorStop(0,"rgba(255,246,215,.42)");
    sunlight.addColorStop(.06,"rgba(255,203,118,.18)");
    sunlight.addColorStop(.35,"rgba(255,145,55,.035)");
    sunlight.addColorStop(1,"rgba(0,0,0,0)");
    ctx.fillStyle=sunlight;ctx.fillRect(0,0,width*.5,height*.72);
    ctx.fillStyle="rgba(255,238,194,.18)";
    ctx.beginPath();ctx.arc(width*.22,height*.39,3+cameraPush*5,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.arc(width*.34,height*.43,1.5+cameraPush*3,0,Math.PI*2);ctx.fill();
  }

  function drawRealGlobe(cx,cy,radius,rotation,time) {
    if(!earthImage.naturalWidth)return;
    ctx.save();
    ctx.beginPath();ctx.arc(cx,cy,radius,0,Math.PI*2);ctx.clip();
    const strips=Math.max(120,Math.round(radius*.82));
    for(let i=0;i<strips;i++){
      const nx=(i/(strips-1))*2-1;
      const theta=Math.asin(nx);
      let u=(rotation+theta/(Math.PI*2))%1;
      if(u<0)u+=1;
      const sx=Math.floor(u*earthImage.naturalWidth);
      const dx=cx+nx*radius;
      const dw=radius*2/strips+1.6;
      ctx.drawImage(earthImage,sx,0,2,earthImage.naturalHeight,dx,cy-radius,dw,radius*2);
    }

    const clouds=ctx.createRadialGradient(cx-radius*.3,cy-radius*.4,0,cx-radius*.1,cy-radius*.1,radius);
    clouds.addColorStop(0,"rgba(255,255,255,.14)");
    clouds.addColorStop(.52,"rgba(255,255,255,.025)");
    clouds.addColorStop(1,"rgba(255,255,255,0)");
    ctx.fillStyle=clouds;ctx.fillRect(cx-radius,cy-radius,radius*2,radius*2);

    const night=ctx.createLinearGradient(cx-radius,cy,cx+radius,cy);
    night.addColorStop(0,"rgba(0,0,0,.03)");
    night.addColorStop(.44,"rgba(0,4,10,.08)");
    night.addColorStop(.72,"rgba(0,3,9,.48)");
    night.addColorStop(1,"rgba(0,0,0,.94)");
    ctx.fillStyle=night;ctx.fillRect(cx-radius,cy-radius,radius*2,radius*2);
    ctx.restore();

    // A physically restrained atmosphere: no concentric neon rings.
    // The sun is upper-left, so scattering is strongest only on that limb.
    const lightAngle=Math.atan2(height*.31-cy,width*.04-cx);
    ctx.save();
    ctx.globalCompositeOperation="lighter";
    ctx.lineCap="round";

    ctx.shadowColor="rgba(83,178,226,.24)";
    ctx.shadowBlur=Math.max(5,radius*.025);
    ctx.strokeStyle="rgba(105,190,230,.16)";
    ctx.lineWidth=Math.max(.7,radius*.0045);
    ctx.beginPath();
    ctx.arc(cx,cy,radius+.35,lightAngle-1.42,lightAngle+1.42);
    ctx.stroke();

    ctx.shadowColor="rgba(190,230,246,.28)";
    ctx.shadowBlur=Math.max(3,radius*.012);
    ctx.strokeStyle="rgba(205,235,247,.34)";
    ctx.lineWidth=Math.max(.55,radius*.0026);
    ctx.beginPath();
    ctx.arc(cx,cy,radius+.15,lightAngle-.92,lightAngle+.92);
    ctx.stroke();

    // Very subtle warm scattering at the point closest to the sun.
    ctx.shadowColor="rgba(255,205,145,.16)";
    ctx.shadowBlur=Math.max(2,radius*.008);
    ctx.strokeStyle="rgba(255,224,181,.18)";
    ctx.lineWidth=Math.max(.45,radius*.0018);
    ctx.beginPath();
    ctx.arc(cx,cy,radius+.05,lightAngle-.28,lightAngle+.28);
    ctx.stroke();
    ctx.restore();

    // A barely visible hairline keeps the night-side silhouette crisp.
    ctx.strokeStyle="rgba(104,166,196,.09)";
    ctx.lineWidth=Math.max(.35,radius*.0012);
    ctx.beginPath();ctx.arc(cx,cy,radius,0,Math.PI*2);ctx.stroke();
  }

  function drawUnfoldedChart(cx,cy,progress,time) {
    const start=Math.min(width,height)*.445;
    const mapWidth=start*2+(width-start*2)*progress;
    const mapHeight=start*2+(height-start*2)*progress;
    const left=cx-mapWidth/2;
    const top=cy-mapHeight/2;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(left,top,mapWidth,mapHeight,Math.max(6,56*(1-progress)));
    ctx.clip();
    const rows=150;
    for(let i=0;i<rows;i++){
      const sy=i*chart.height/rows;
      const dy=top+i*mapHeight/rows;
      const fold=(1-progress)*Math.sin(i*.21+time*2.5)*18;
      const living=progress*Math.sin(i*.15+time*.7)*2.4;
      ctx.drawImage(chart,0,sy,chart.width,chart.height/rows+1,left,dy+fold+living,mapWidth,mapHeight/rows+1.8);
    }
    const sheen=ctx.createLinearGradient(left,top,left+mapWidth,top+mapHeight);
    sheen.addColorStop(0,"rgba(255,255,255,.12)");
    sheen.addColorStop(.32,"rgba(255,255,255,0)");
    sheen.addColorStop(.7,"rgba(2,15,27,.08)");
    sheen.addColorStop(1,"rgba(255,220,148,.08)");
    ctx.fillStyle=sheen;ctx.fillRect(left,top,mapWidth,mapHeight);
    ctx.restore();
    ctx.strokeStyle=`rgba(235,205,132,${Math.max(0,.78-progress*.78)})`;
    ctx.lineWidth=1.4;ctx.strokeRect(left,top,mapWidth,mapHeight);
    return {left,top,mapWidth,mapHeight};
  }

  function ensureAudio(){
    if(audioContext)return audioContext;
    const AudioContextClass=window.AudioContext||window.webkitAudioContext;
    if(!AudioContextClass)return null;
    audioContext=new AudioContextClass();
    return audioContext;
  }

  function playThunder(){
    if(!soundEnabled)return;
    const audio=ensureAudio();
    if(!audio)return;
    if(audio.state==="suspended")audio.resume();
    const duration=9.2;
    const length=Math.floor(audio.sampleRate*duration);
    const buffer=audio.createBuffer(1,length,audio.sampleRate);
    const data=buffer.getChannelData(0);
    let brown=0;
    for(let i=0;i<length;i++){
      const white=Math.random()*2-1;
      brown=(brown*.985+white*.055)/1.04;
      const envelope=Math.min(1,i/(audio.sampleRate*2.2))*Math.pow(1-i/length,.34);
      const roll=.56+.44*Math.sin(i/audio.sampleRate*2.1+i*i*.000000012);
      data[i]=brown*envelope*roll;
    }
    const source=audio.createBufferSource();
    source.buffer=buffer;
    const low=audio.createBiquadFilter();
    low.type="lowpass";
    low.frequency.setValueAtTime(85,audio.currentTime);
    low.frequency.exponentialRampToValueAtTime(420,audio.currentTime+5.8);
    low.Q.value=.7;
    const body=audio.createBiquadFilter();
    body.type="peaking";
    body.frequency.value=58;
    body.Q.value=.8;
    body.gain.value=10;
    const gain=audio.createGain();
    gain.gain.setValueAtTime(.0001,audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(.055,audio.currentTime+1.8);
    gain.gain.exponentialRampToValueAtTime(.24,audio.currentTime+5.4);
    gain.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+duration);
    source.connect(low).connect(body).connect(gain).connect(audio.destination);
    source.start();
  }

  function routePoint(bounds,lon,lat){
    const [x,y]=project(lon,lat);
    return [bounds.left+x*bounds.mapWidth,bounds.top+y*bounds.mapHeight];
  }

  function smoothRoute(points,steps=7){
    if(points.length<3)return points;
    const result=[];
    for(let i=0;i<points.length-1;i++){
      const p0=points[Math.max(0,i-1)];
      const p1=points[i];
      const p2=points[i+1];
      const p3=points[Math.min(points.length-1,i+2)];
      for(let s=0;s<steps;s++){
        const t=s/steps,t2=t*t,t3=t2*t;
        result.push([
          .5*((2*p1[0])+(-p0[0]+p2[0])*t+(2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*t2+(-p0[0]+3*p1[0]-3*p2[0]+p3[0])*t3),
          .5*((2*p1[1])+(-p0[1]+p2[1])*t+(2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*t2+(-p0[1]+3*p1[1]-3*p2[1]+p3[1])*t3)
        ]);
      }
    }
    result.push(points[points.length-1]);
    return result;
  }

  function drawRoutes(bounds,progress,time){
    const routeProgress=clamp(progress);
    ctx.save();
    ctx.lineCap="round";
    routes.forEach((route,index)=>{
      const local=clamp(routeProgress*1.35-index*.08);
      if(local<=0)return;
      const points=smoothRoute(route.map(([lon,lat])=>routePoint(bounds,lon,lat)));
      const glowWidth=7+Math.sin(time*3+index)*1.4;
      ctx.strokeStyle="rgba(255,180,55,.16)";
      ctx.lineWidth=glowWidth;
      ctx.setLineDash([Math.max(1,local*10000),10000]);
      ctx.beginPath();
      points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));
      ctx.stroke();
      ctx.strokeStyle="rgba(255,210,105,.96)";
      ctx.lineWidth=1.7;
      ctx.stroke();
      ctx.setLineDash([]);

      const totalSegments=points.length-1;
      const travel=(time*.17+index*.18)%1;
      const scaled=travel*totalSegments;
      const segment=Math.min(totalSegments-1,Math.floor(scaled));
      const t=scaled-segment;
      const x=points[segment][0]+(points[segment+1][0]-points[segment][0])*t;
      const y=points[segment][1]+(points[segment+1][1]-points[segment][1])*t;
      const flare=ctx.createRadialGradient(x,y,0,x,y,15);
      flare.addColorStop(0,"rgba(255,244,191,1)");
      flare.addColorStop(.22,"rgba(255,195,61,.8)");
      flare.addColorStop(1,"rgba(255,170,30,0)");
      ctx.fillStyle=flare;ctx.fillRect(x-15,y-15,30,30);
    });

    if(routeProgress>.38){
      const alpha=smooth((routeProgress-.38)/.45);
      ports.forEach(([label,lon,lat],index)=>{
        const [x,y]=routePoint(bounds,lon,lat);
        ctx.globalAlpha=alpha;
        ctx.fillStyle="#ffe3a0";ctx.beginPath();ctx.arc(x,y,2.5,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle="rgba(255,202,84,.62)";ctx.beginPath();ctx.arc(x,y,5+Math.sin(time*2+index)*1.3,0,Math.PI*2);ctx.stroke();
        if(bounds.mapWidth>800){
          ctx.fillStyle="rgba(248,235,203,.82)";
          ctx.font="600 8px system-ui";
          ctx.textAlign="center";ctx.fillText(label,x,y-9);
        }
      });
      ctx.globalAlpha=1;
    }
    ctx.restore();
  }

  function finish(markSeen=true){
    running=false;
    cancelAnimationFrame(frame);
    brand.classList.remove("visible");
    overlay.classList.add("finished");
    if(markSeen)sessionStorage.setItem("atlas-v810-intro-seen","1");
  }

  function animate(timestamp){
    if(!running)return;
    if(!startTime)startTime=timestamp;
    const seconds=(timestamp-startTime)/1000;
    const cameraPush=smooth((seconds-1.2)/7);
    drawSpace(seconds,cameraPush);
    const cx=width/2,cy=height/2;

    if(seconds>2.1&&seconds<9.4){
      const approach=easeOut((seconds-2.1)/6.6);
      const radius=12+approach*Math.min(width,height)*.445;
      const drift=(1-approach)*width*.17;
      const rise=(1-approach)*height*.08;
      drawRealGlobe(cx+drift,cy+rise,radius,.72-seconds*.027,seconds);
    }else if(seconds>=9.4){
      const unfold=smooth((seconds-9.4)/3.8);
      if(unfold<.045)drawRealGlobe(cx,cy,Math.min(width,height)*.445,.466,seconds);
      const bounds=drawUnfoldedChart(cx,cy,unfold,seconds);
      if(seconds>12.1)drawRoutes(bounds,(seconds-12.1)/3.5,seconds);
      if(seconds>14.8)brand.classList.add("visible");
    }

    // The complete Sinbad Marine signature remains fully readable for
    // seven seconds, then dissolves into the application over three seconds.
    if(seconds>=24.8)overlay.classList.add("finished");
    if(seconds>=27.8){finish(true);return;}
    frame=requestAnimationFrame(animate);
  }

  function play(force=false){
    if(matchMedia("(prefers-reduced-motion: reduce)").matches&&!force){finish(true);return;}
    overlay.classList.remove("finished");
    brand.classList.remove("visible");
    startTime=0;
    running=true;
    playThunder();
    frame=requestAnimationFrame(animate);
  }

  async function prepare(){
    resize();
    await Promise.allSettled([
      earthImage.decode?.()||Promise.resolve(),
      starImage.decode?.()||Promise.resolve()
    ]);
    buildChart();
    assetsReady=true;
    if(sessionStorage.getItem("atlas-v810-intro-seen")==="1")finish(false);
    else play(false);
  }

  addEventListener("resize",resize,{passive:true});
  skip.addEventListener("click",()=>finish(true));
  soundButton?.addEventListener("click",()=>{
    soundEnabled=true;
    ensureAudio()?.resume();
    soundButton.setAttribute("aria-pressed","true");
    soundButton.textContent="Cinematic sound on";
    if(assetsReady)play(true);
  });
  replay?.addEventListener("click",()=>{
    soundEnabled=true;
    ensureAudio()?.resume();
    if(soundButton){
      soundButton.setAttribute("aria-pressed","true");
      soundButton.textContent="Cinematic sound on";
    }
    if(assetsReady)play(true);
  });
  window.AtlasIntro={play:()=>assetsReady&&play(true),skip:()=>finish(true)};
  prepare();
})();
