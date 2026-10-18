'use strict';
(() => {
  const canvas = document.querySelector('#putting-green');
  if (!canvas) return;
  let ctx = canvas.getContext('2d');
  const visibleContext=ctx;
  const grassLayer=document.createElement('canvas'),flagsLayer=document.createElement('canvas');
  let sceneryDirty=true;
  const status = document.querySelector('#golf-status');
  const prompt = document.querySelector('#putting-prompt');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const colors = [
    {hex:'#FFE83D',family:'yellow'}, {hex:'#165743',family:'green'},
    {hex:'#FAF8EF',family:'cream'}, {hex:'#9F8060',family:'sand'}
  ];
  const patterns = ['diagonal','disc','quarter'];
  const holes = [];
  let width=0,height=0,frame=0,press=null,sequence=0,previous=null,shot=null;
  let ball={x:.18,y:.77};
  let aim={x:.79,y:.23};
  const pick = items => items[Math.floor(Math.random()*items.length)];
  const clamp = (v,min,max) => Math.max(min,Math.min(max,v));
  function dimensions(){return {radius:width<600?13:17,pole:width<600?45:62,flag:width<600?29:40};}
  function position(point){
    const {pole,flag}=dimensions();
    return {x:clamp(point.x*width,22,width-flag-15),y:clamp(point.y*height,pole+18,height-23)};
  }
  function ballAt(now){
    if(!shot)return ball;
    const progress=reduced.matches?1:clamp((now-shot.start-360)/850,0,1);
    const t=1-Math.pow(1-progress,2.5);
    return {x:shot.from.x+(shot.to.x-shot.from.x)*t,y:shot.from.y+(shot.to.y-shot.from.y)*t};
  }
  function announce(){
    canvas.dataset.holeCount=String(holes.length);
    status.textContent=`${holes.length} ${holes.length===1?'hole':'holes'} on the green.`;
  }
  function addHole(x,y,starter=false){
    const color=pick(colors.filter(c=>c.family!==previous?.family));
    const second=pick(colors.filter(c=>c.hex!==color.hex));
    const pattern=pick(patterns.filter(p=>p!==previous?.pattern));
    const hole={id:++sequence,x:x/width,y:y/height,color:color.hex,secondary:second.hex,family:color.family,pattern};
    // Store the clamped center so the ball and cup meet at every screen size.
    const p=position(hole);hole.x=p.x/width;hole.y=p.y/height;
    holes.push(hole);if(holes.length>40)holes.shift();previous=hole;
    if(!starter){
      prompt.hidden=true;
      const now=performance.now(),from={x:.18,y:.77};
      aim={x:hole.x,y:hole.y};
      shot=reduced.matches?null:{from,to:{x:hole.x,y:hole.y},start:now};
      ball={x:hole.x,y:hole.y};
    }
    sceneryDirty=true;announce();requestDraw();
  }
  function randomHole(){addHole(width*(.17+Math.random()*.62),height*(.25+Math.random()*.5));}
  function clear(){
    holes.length=0;shot=null;previous=null;sceneryDirty=true;ball={x:.18,y:.77};prompt.hidden=true;
    canvas.dataset.holeCount='0';status.textContent='Green cleared. Add a hole to take another shot.';requestDraw();
  }
  function greenPath(){
    const inset=width<600?14:24;
    ctx.beginPath();ctx.roundRect(inset,inset,width-inset*2,height-inset*2,Math.min(height*.24,width*.17));
  }
  // One fixed grain tile keeps the grass still while the ball moves.
  const grain=document.createElement('canvas');grain.width=96;grain.height=96;
  const gc=grain.getContext('2d'),noise=gc.createImageData(96,96);
  for(let i=0;i<noise.data.length;i+=4){const v=Math.random()>.5?245:30;noise.data[i]=noise.data[i+1]=noise.data[i+2]=v;noise.data[i+3]=Math.random()*13;}
  gc.putImageData(noise,0,0);
  function drawGreen(){
    ctx.fillStyle='#165743';ctx.fillRect(0,0,width,height);
    ctx.save();greenPath();ctx.fillStyle='#759951';ctx.fill();ctx.clip();
    const stripe=width<600?54:100;
    ctx.fillStyle='#f2f1d40d';
    for(let x=-height;x<width+height;x+=stripe*2){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+stripe,0);ctx.lineTo(x+stripe+height,height);ctx.lineTo(x+height,height);ctx.closePath();ctx.fill();}
    ctx.fillStyle=ctx.createPattern(grain,'repeat');ctx.fillRect(0,0,width,height);ctx.restore();
    greenPath();ctx.strokeStyle='#c3ccaa88';ctx.lineWidth=2;ctx.stroke();
  }
  function putterPose(now){
    const origin=position({x:.18,y:.77}),target=position(aim);
    const angle=Math.atan2(target.y-origin.y,target.x-origin.x);
    const elapsed=shot?now-shot.start:0;
    const smooth=t=>t*t*(3-2*t);
    let travel=-6;
    if(shot&&!reduced.matches){
      if(elapsed<220)travel=-6-24*smooth(clamp(elapsed/220,0,1));
      else if(elapsed<360)travel=-30+30*((elapsed-220)/140)**2;
      else if(elapsed<510)travel=16*(1-(1-(elapsed-360)/150)**2);
      else if(elapsed<800)travel=16-22*smooth((elapsed-510)/290);
    }
    // A short putt must not let the follow-through pass through the ball.
    if(shot){
      const current=position(ballAt(now));
      const advance=(current.x-origin.x)*Math.cos(angle)+(current.y-origin.y)*Math.sin(angle);
      travel=Math.min(travel,Math.max(0,advance));
    }
    // The front of the face touches the back of the ball at 360 ms.
    const distance=-dimensions().radius-5+travel;
    return {x:origin.x+Math.cos(angle)*distance,y:origin.y+Math.sin(angle)*distance,angle,travel};
  }
  function drawPutter(now){
    const p=putterPose(now),scale=width<600?.82:1;
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);
    // Rotate the whole club with its face. Choose the shaft side with more room.
    const anchor=position({x:.18,y:.77});
    const rest={x:anchor.x-Math.cos(p.angle)*(dimensions().radius+11),y:anchor.y-Math.sin(p.angle)*(dimensions().radius+11)};
    const room=side=>{
      const x=rest.x-17*scale*Math.cos(p.angle)+side*78*scale*Math.sin(p.angle);
      const y=rest.y-17*scale*Math.sin(p.angle)-side*78*scale*Math.cos(p.angle);
      return Math.min(x,width-x,y,height-y);
    };
    const side=room(1)>=room(-1)?1:-1;
    const vx=-17*scale*Math.cos(p.angle)+side*78*scale*Math.sin(p.angle);
    const vy=-17*scale*Math.sin(p.angle)-side*78*scale*Math.cos(p.angle);
    const fit=Math.max(.2,Math.min(1,...[-30,16].map(travel=>{const x=anchor.x+Math.cos(p.angle)*(-dimensions().radius-5+travel),y=anchor.y+Math.sin(p.angle)*(-dimensions().radius-5+travel);return Math.min(vx<0?(x-9)/-vx:(width-x-9)/(vx||1),vy<0?(y-9)/-vy:(height-y-9)/(vy||1));})));
    ctx.save();ctx.scale(fit,side*fit);
    // A steel shaft with a bent hosel and a ribbed rubber grip.
    ctx.lineCap='round';
    ctx.strokeStyle='#243b2e55';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(-17*scale+3,-78*scale+4);ctx.lineTo(3,4);ctx.stroke();
    ctx.strokeStyle='#6d7779';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-17*scale,-78*scale);ctx.lineTo(-4,-10);ctx.lineTo(0,0);ctx.stroke();
    ctx.strokeStyle='#eef1ec';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(-18*scale,-78*scale);ctx.lineTo(-5,-10);ctx.stroke();
    ctx.strokeStyle='#202c29';ctx.lineWidth=8*scale;ctx.beginPath();ctx.moveTo(-17*scale,-78*scale);ctx.lineTo(-12*scale,-53*scale);ctx.stroke();
    ctx.strokeStyle='#738078';ctx.lineWidth=1;
    for(let i=0;i<5;i++){const t=i/5;ctx.beginPath();ctx.moveTo((-20+5*t)*scale,(-75+20*t)*scale);ctx.lineTo((-14+5*t)*scale,(-76+20*t)*scale);ctx.stroke();}
    ctx.restore();
    // A weighted blade, polished bevel, dark striking face and alignment mark.
    ctx.fillStyle='#263b3055';ctx.beginPath();ctx.roundRect(-6, -20*scale+4,14,44*scale,4);ctx.fill();
    ctx.fillStyle='#7e8989';ctx.beginPath();ctx.roundRect(-7,-22*scale,12,44*scale,3);ctx.fill();
    ctx.fillStyle='#d6ddda';ctx.beginPath();ctx.roundRect(-6,-21*scale,8,42*scale,2);ctx.fill();
    ctx.fillStyle='#344340';ctx.fillRect(2,-19*scale,3,38*scale);
    ctx.strokeStyle='#faf8ef';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(-6,0);ctx.lineTo(1,0);ctx.stroke();
    ctx.restore();
  }

  function drawHole(hole){
    const p=position(hole),{pole,flag}=dimensions();
    ctx.save();ctx.translate(p.x,p.y);
    ctx.fillStyle='#34402d55';ctx.beginPath();ctx.ellipse(10,5,flag*.8,5,-.18,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#23301f';ctx.beginPath();ctx.ellipse(0,0,9,5,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#d4d4be';ctx.lineWidth=1;ctx.stroke();
    ctx.strokeStyle='#f6f3ee';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-pole);ctx.lineTo(0,0);ctx.stroke();
    ctx.save();ctx.beginPath();ctx.moveTo(1,-pole);ctx.lineTo(flag,-pole+flag*.34);ctx.lineTo(1,-pole+flag*.72);ctx.closePath();ctx.clip();
    ctx.fillStyle=hole.color;ctx.fillRect(1,-pole,flag,flag);
    ctx.fillStyle=hole.secondary;
    if(hole.pattern==='diagonal'){ctx.beginPath();ctx.moveTo(1,-pole);ctx.lineTo(flag,-pole+flag*.72);ctx.lineTo(1,-pole+flag*.72);ctx.fill();}
    else {ctx.beginPath();ctx.arc(hole.pattern==='disc'?flag*.45:0,-pole+flag*.42,flag*.36,0,Math.PI*2);ctx.fill();}
    ctx.restore();ctx.restore();
  }
  function drawBall(point,now){
    const p=position(point),{radius:r}=dimensions();
    ctx.save();ctx.translate(p.x,p.y);
    ctx.fillStyle='#24351f4d';ctx.beginPath();ctx.ellipse(4,r*.6,r*1.1,r*.45,0,0,Math.PI*2);ctx.fill();
    const shine=ctx.createRadialGradient(-r*.35,-r*.4,1,0,0,r*1.1);shine.addColorStop(0,'#ffffff');shine.addColorStop(.65,'#f5f4ed');shine.addColorStop(1,'#b4b9ac');
    ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fillStyle=shine;ctx.fill();
    ctx.save();ctx.clip();
    if(shot&&!reduced.matches&&now-shot.start>360)ctx.rotate((now-shot.start-360)/130);
    for(let row=-2;row<=2;row++)for(let col=-2;col<=2;col++){
      const x=col*r*.36+(Math.abs(row)%2)*r*.16,y=row*r*.34;
      if(Math.hypot(x,y)>r*.82)continue;
      ctx.beginPath();ctx.arc(x,y,r*.085,0,Math.PI*2);ctx.fillStyle='#a5ac9f80';ctx.fill();
      ctx.beginPath();ctx.arc(x-.35,y+.5,r*.063,0,Math.PI*2);ctx.fillStyle='#ffffffb0';ctx.fill();
    }
    ctx.restore();ctx.restore();
  }
  function refreshScenery(){
    // Rasterize the textured grass and stationary flags only when they change.
    for(const layer of [grassLayer,flagsLayer]){layer.width=canvas.width;layer.height=canvas.height;}
    const dpr=window.devicePixelRatio||1;
    try{
      ctx=grassLayer.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);drawGreen();
      ctx=flagsLayer.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);
      for(const hole of holes)drawHole(hole);
    }finally{ctx=visibleContext;}
    sceneryDirty=false;
  }
  function draw(now){
    frame=0;if(!width||!height)return;
    if(sceneryDirty)refreshScenery();
    ctx.drawImage(grassLayer,0,0,width,height);drawPutter(now);
    ctx.drawImage(flagsLayer,0,0,width,height);
    drawBall(ballAt(now),now);
    if(shot && (reduced.matches||now-shot.start>=1210))shot=null;
    if(shot)requestDraw();
  }
  function requestDraw(){if(!frame)frame=requestAnimationFrame(draw);}
  function resize(){
    const rect=canvas.getBoundingClientRect();
    // Navigation can briefly report a hidden canvas as zero-sized.
    if(!rect.width||!rect.height)return;
    width=rect.width;height=rect.height;
    const dpr=window.devicePixelRatio||1;canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);sceneryDirty=true;requestDraw();
  }
  resize();new ResizeObserver(resize).observe(canvas);window.addEventListener('resize',resize);
  reduced.addEventListener('change',()=>{if(reduced.matches)shot=null;requestDraw();});
  addHole(width*.79,height*.23,true);
  document.querySelector('#add-hole').addEventListener('click',randomHole);
  document.querySelector('#clear-green').addEventListener('click',clear);
  canvas.addEventListener('pointerdown',e=>{if(e.isPrimary&&e.button===0)press={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false};});
  canvas.addEventListener('pointermove',e=>{if(press&&press.id===e.pointerId&&Math.hypot(e.clientX-press.x,e.clientY-press.y)>9)press.moved=true;});
  canvas.addEventListener('pointercancel',()=>{press=null;});canvas.addEventListener('pointerleave',()=>{press=null;});
  canvas.addEventListener('pointerup',e=>{
    if(!press||press.id!==e.pointerId)return;
    const valid=!press.moved&&Math.hypot(e.clientX-press.x,e.clientY-press.y)<=9;press=null;
    if(valid){const r=canvas.getBoundingClientRect();addHole(e.clientX-r.left,e.clientY-r.top);}
  });
  canvas.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();if(!e.repeat)randomHole();}});
  // Assistive technology can activate the canvas with a synthesized click.
  canvas.addEventListener('click',e=>{if(e.detail===0)randomHole();});
})();
