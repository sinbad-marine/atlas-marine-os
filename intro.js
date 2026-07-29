(() => {
  "use strict";

  const overlay = document.getElementById("cinematicIntro");
  const canvas = document.getElementById("introCanvas");
  const brand = document.getElementById("introBrand");
  const skip = document.getElementById("skipIntro");
  const replay = document.getElementById("replayIntro");
  if (!overlay || !canvas) return;

  const ctx = canvas.getContext("2d", { alpha: false });
  const map = document.createElement("canvas");
  map.width = 1600;
  map.height = 800;
  const m = map.getContext("2d");
  const stars = [];
  let width = 0;
  let height = 0;
  let dpr = 1;
  let startTime = 0;
  let frame = 0;
  let running = false;

  const continents = [
    [[.07,.25],[.11,.15],[.20,.11],[.27,.17],[.29,.27],[.25,.34],[.22,.43],[.16,.48],[.11,.42],[.08,.33]],
    [[.21,.47],[.27,.50],[.30,.60],[.28,.72],[.25,.88],[.20,.80],[.18,.66]],
    [[.38,.18],[.46,.12],[.58,.15],[.67,.23],[.76,.22],[.83,.29],[.79,.39],[.69,.39],[.62,.34],[.54,.38],[.49,.32],[.42,.30]],
    [[.46,.37],[.55,.35],[.59,.46],[.57,.62],[.52,.78],[.47,.70],[.44,.55]],
    [[.69,.39],[.77,.38],[.82,.46],[.79,.54],[.72,.51]],
    [[.80,.67],[.88,.63],[.93,.72],[.89,.82],[.81,.80],[.77,.73]],
    [[.31,.10],[.35,.07],[.37,.13],[.34,.17]],
    [[.52,.28],[.55,.25],[.57,.31],[.54,.34]],
    [[.59,.45],[.61,.42],[.63,.48],[.61,.52]],
    [[.91,.49],[.94,.47],[.95,.54],[.92,.57]]
  ];

  function seededRandom(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function buildMap() {
    const ocean = m.createLinearGradient(0, 0, 0, map.height);
    ocean.addColorStop(0, "#082b46");
    ocean.addColorStop(.52, "#07506a");
    ocean.addColorStop(1, "#041d34");
    m.fillStyle = ocean;
    m.fillRect(0, 0, map.width, map.height);

    m.strokeStyle = "rgba(146,205,218,.18)";
    m.lineWidth = 1;
    for (let lon = 0; lon <= 24; lon++) {
      const x = lon * map.width / 24;
      m.beginPath(); m.moveTo(x, 0); m.lineTo(x, map.height); m.stroke();
    }
    for (let lat = 0; lat <= 12; lat++) {
      const y = lat * map.height / 12;
      m.beginPath(); m.moveTo(0, y); m.lineTo(map.width, y); m.stroke();
    }

    continents.forEach((points, index) => {
      m.beginPath();
      points.forEach(([x, y], i) => i ? m.lineTo(x * map.width, y * map.height) : m.moveTo(x * map.width, y * map.height));
      m.closePath();
      const land = m.createLinearGradient(0, 0, 0, map.height);
      land.addColorStop(0, index % 2 ? "#617665" : "#71806b");
      land.addColorStop(1, "#243f3d");
      m.fillStyle = land;
      m.fill();
      m.strokeStyle = "rgba(233,211,151,.74)";
      m.lineWidth = 2.2;
      m.stroke();
    });

    m.fillStyle = "rgba(235,219,168,.72)";
    m.font = "22px Georgia";
    m.textAlign = "center";
    [["NORTH ATLANTIC",.28,.39],["SOUTH ATLANTIC",.34,.69],["INDIAN OCEAN",.66,.65],["PACIFIC OCEAN",.90,.44],["ARCTIC OCEAN",.50,.07]].forEach(([label,x,y]) => m.fillText(label,x*map.width,y*map.height));
    m.font = "700 20px system-ui";
    m.letterSpacing = "4px";
    m.fillText("ATLAS MARITIME WORLD CHART", map.width / 2, map.height - 28);

    m.strokeStyle = "rgba(239,199,106,.84)";
    m.lineWidth = 3;
    m.setLineDash([13, 10]);
    m.beginPath();
    m.moveTo(.42 * map.width, .39 * map.height);
    m.bezierCurveTo(.50 * map.width,.30 * map.height,.62 * map.width,.41 * map.height,.71 * map.width,.46 * map.height);
    m.bezierCurveTo(.79 * map.width,.50 * map.height,.84 * map.width,.58 * map.height,.87 * map.width,.68 * map.height);
    m.stroke();
    m.setLineDash([]);
  }

  function resize() {
    width = innerWidth;
    height = innerHeight;
    dpr = Math.min(devicePixelRatio || 1, 1.6);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const rnd = seededRandom(1977);
    stars.length = 0;
    const count = Math.min(1800, Math.round(width * height / 780));
    for (let i = 0; i < count; i++) {
      stars.push({ x:rnd()*width, y:rnd()*height, r:.25+rnd()*1.55, a:.22+rnd()*.78, p:rnd()*6.28 });
    }
  }

  const clamp = value => Math.max(0, Math.min(1, value));
  const smooth = value => {
    const x = clamp(value);
    return x * x * (3 - 2 * x);
  };

  function drawSpace(time) {
    ctx.fillStyle = "#01040a";
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(width*.5,height*.46);
    ctx.rotate(-.29);
    const galaxy = ctx.createLinearGradient(0,-height*.24,0,height*.24);
    galaxy.addColorStop(0,"rgba(20,41,69,0)");
    galaxy.addColorStop(.5,"rgba(113,139,176,.12)");
    galaxy.addColorStop(1,"rgba(20,41,69,0)");
    ctx.fillStyle=galaxy;
    ctx.fillRect(-width*.8,-height*.24,width*1.6,height*.48);
    ctx.restore();

    for (const star of stars) {
      const twinkle = .7 + Math.sin(time*2.1+star.p)*.3;
      ctx.globalAlpha = star.a * twinkle;
      ctx.fillStyle = star.r > 1.25 ? "#dceeff" : "#fff";
      ctx.beginPath();
      ctx.arc(star.x,star.y,star.r,0,Math.PI*2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const sun = ctx.createRadialGradient(width*.1,height*.25,0,width*.1,height*.25,Math.min(width,height)*.28);
    sun.addColorStop(0,"rgba(255,229,163,.18)");
    sun.addColorStop(.2,"rgba(255,190,93,.07)");
    sun.addColorStop(1,"rgba(255,160,50,0)");
    ctx.fillStyle=sun;
    ctx.fillRect(0,0,width*.48,height*.65);
  }

  function drawGlobe(cx, cy, radius, rotation) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();
    const strips = Math.max(80, Math.round(radius * .75));
    for (let i = 0; i < strips; i++) {
      const nx = (i / (strips - 1)) * 2 - 1;
      const theta = Math.asin(nx);
      let u = (rotation + theta / (Math.PI * 2)) % 1;
      if (u < 0) u += 1;
      const sx = Math.floor(u * map.width);
      const dx = cx + nx * radius;
      const dw = radius * 2 / strips + 1.4;
      ctx.drawImage(map, sx, 0, 2, map.height, dx, cy-radius, dw, radius*2);
    }
    const shade = ctx.createRadialGradient(cx-radius*.34,cy-radius*.38,radius*.06,cx,cy,radius*1.08);
    shade.addColorStop(0,"rgba(255,241,194,.24)");
    shade.addColorStop(.52,"rgba(3,22,34,.04)");
    shade.addColorStop(.82,"rgba(0,5,12,.38)");
    shade.addColorStop(1,"rgba(0,0,0,.88)");
    ctx.fillStyle=shade;
    ctx.fillRect(cx-radius,cy-radius,radius*2,radius*2);
    ctx.restore();
    ctx.strokeStyle="rgba(179,220,231,.62)";
    ctx.lineWidth=1.5;
    ctx.beginPath();ctx.arc(cx,cy,radius,0,Math.PI*2);ctx.stroke();
    ctx.shadowColor="rgba(74,174,209,.46)";ctx.shadowBlur=28;
    ctx.stroke();ctx.shadowBlur=0;
  }

  function drawUnfoldedMap(cx, cy, progress, time) {
    const maxWidth=Math.min(width*.88,height*1.55);
    const startSize=Math.min(width,height)*.43;
    const mapWidth=startSize*2+(maxWidth-startSize*2)*progress;
    const mapHeight=startSize*2+(maxWidth*.5-startSize*2)*progress;
    const left=cx-mapWidth/2;
    const top=cy-mapHeight/2;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(left,top,mapWidth,mapHeight,Math.max(8,42*(1-progress)));
    ctx.clip();
    const rows=90;
    for(let i=0;i<rows;i++){
      const sy=i*map.height/rows;
      const dy=top+i*mapHeight/rows;
      const wave=Math.sin(i*.26+time*2.4)*(1-progress)*14+Math.sin(i*.12+time)*progress*3;
      ctx.drawImage(map,0,sy,map.width,map.height/rows+1,left,dy+wave,mapWidth,mapHeight/rows+1.6);
    }
    const wash=ctx.createLinearGradient(left,top,left,top+mapHeight);
    wash.addColorStop(0,"rgba(221,241,239,.08)");
    wash.addColorStop(1,"rgba(0,12,24,.14)");
    ctx.fillStyle=wash;ctx.fillRect(left,top,mapWidth,mapHeight);
    ctx.restore();
    ctx.strokeStyle=`rgba(232,204,132,${.45+.45*progress})`;
    ctx.lineWidth=1.5;
    ctx.strokeRect(left,top,mapWidth,mapHeight);
  }

  function finish(markSeen=true) {
    running=false;
    cancelAnimationFrame(frame);
    brand.classList.remove("visible");
    overlay.classList.add("finished");
    if(markSeen)sessionStorage.setItem("atlas-v89-intro-seen","1");
  }

  function animate(timestamp) {
    if(!running)return;
    if(!startTime)startTime=timestamp;
    const seconds=(timestamp-startTime)/1000;
    drawSpace(seconds);
    const cx=width/2;
    const cy=height/2;

    if(seconds>1.5 && seconds<7.4){
      const approach=smooth((seconds-1.5)/4.9);
      const radius=18+approach*Math.min(width,height)*.42;
      const drift=(1-approach)*width*.12;
      drawGlobe(cx+drift,cy,radius,.62-seconds*.035);
    }else if(seconds>=7.4){
      const unfold=smooth((seconds-7.4)/3.1);
      if(unfold<.06)drawGlobe(cx,cy,Math.min(width,height)*.43,.36);
      drawUnfoldedMap(cx,cy,unfold,seconds);
      if(seconds>9.5)brand.classList.add("visible");
    }

    if(seconds>=12.2){finish(true);return;}
    frame=requestAnimationFrame(animate);
  }

  function play(force=false) {
    if(matchMedia("(prefers-reduced-motion: reduce)").matches&&!force){finish(true);return;}
    overlay.classList.remove("finished");
    brand.classList.remove("visible");
    startTime=0;
    running=true;
    frame=requestAnimationFrame(animate);
  }

  buildMap();
  resize();
  addEventListener("resize",resize,{passive:true});
  skip.addEventListener("click",()=>finish(true));
  replay?.addEventListener("click",()=>play(true));
  window.AtlasIntro={play:()=>play(true),skip:()=>finish(true)};

  if(sessionStorage.getItem("atlas-v89-intro-seen")==="1")finish(false);
  else play(false);
})();
