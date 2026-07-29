(() => {
  "use strict";

  const overlay = document.getElementById("cinematicIntro");
  const canvas = document.getElementById("introCanvas");
  const brand = document.getElementById("introBrand");
  const skip = document.getElementById("skipIntro");
  const replay = document.getElementById("replayIntro");
  if (!overlay || !canvas) return;

  const ctx = canvas.getContext("2d", { alpha: false });
  const earthImage = new Image();
  const starImage = new Image();
  earthImage.src = "./assets/nasa-blue-marble.png";
  starImage.src = "./assets/nasa-deep-star-map.jpg";

  const chart = document.createElement("canvas");
  chart.width = 2048;
  chart.height = 1024;
  const chartCtx = chart.getContext("2d");

  const routes = [
    [[-74,40.7],[-36,42],[-5.35,36.1],[28.98,41]],
    [[28.98,41],[23.7,37.9],[32.5,31.2],[55.27,25.2],[72.9,19.1]],
    [[72.9,19.1],[103.8,1.3],[121,14.6],[139.7,35.7]],
    [[-5.35,36.1],[-17,28],[-46,-12],[-79.5,9],[-118.2,33.7]],
    [[103.8,1.3],[115,-12],[151.2,-33.8],[174.8,-36.8]]
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
    chartCtx.fillText("ATLAS MARITIME WORLD CHART",chart.width/2,chart.height-26);
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

    for(let i=4;i>0;i--){
      ctx.strokeStyle=`rgba(83,189,240,${.035*i})`;
      ctx.lineWidth=i*3.2;
      ctx.beginPath();ctx.arc(cx,cy,radius+i*.6,0,Math.PI*2);ctx.stroke();
    }
    ctx.strokeStyle="rgba(191,230,247,.72)";
    ctx.lineWidth=1.1;ctx.beginPath();ctx.arc(cx,cy,radius,0,Math.PI*2);ctx.stroke();

    const rim=ctx.createRadialGradient(cx-radius*.12,cy-radius*.1,radius*.86,cx,cy,radius*1.13);
    rim.addColorStop(0,"rgba(0,0,0,0)");
    rim.addColorStop(.83,"rgba(0,0,0,0)");
    rim.addColorStop(1,"rgba(70,177,234,.18)");
    ctx.fillStyle=rim;ctx.beginPath();ctx.arc(cx,cy,radius*1.13,0,Math.PI*2);ctx.fill();
  }

  function drawUnfoldedChart(cx,cy,progress,time) {
    const maxWidth=Math.min(width*.92,height*1.72);
    const start=Math.min(width,height)*.445;
    const mapWidth=start*2+(maxWidth-start*2)*progress;
    const mapHeight=start*2+(maxWidth*.5-start*2)*progress;
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
    ctx.strokeStyle=`rgba(235,205,132,${.44+.4*progress})`;
    ctx.lineWidth=1.4;ctx.strokeRect(left,top,mapWidth,mapHeight);
    return {left,top,mapWidth,mapHeight};
  }

  function routePoint(bounds,lon,lat){
    const [x,y]=project(lon,lat);
    return [bounds.left+x*bounds.mapWidth,bounds.top+y*bounds.mapHeight];
  }

  function drawRoutes(bounds,progress,time){
    const routeProgress=clamp(progress);
    ctx.save();
    ctx.lineCap="round";
    routes.forEach((route,index)=>{
      const local=clamp(routeProgress*1.35-index*.08);
      if(local<=0)return;
      const points=route.map(([lon,lat])=>routePoint(bounds,lon,lat));
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

    if(seconds>=18.1){finish(true);return;}
    frame=requestAnimationFrame(animate);
  }

  function play(force=false){
    if(matchMedia("(prefers-reduced-motion: reduce)").matches&&!force){finish(true);return;}
    overlay.classList.remove("finished");
    brand.classList.remove("visible");
    startTime=0;
    running=true;
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
  replay?.addEventListener("click",()=>assetsReady&&play(true));
  window.AtlasIntro={play:()=>assetsReady&&play(true),skip:()=>finish(true)};
  prepare();
})();
