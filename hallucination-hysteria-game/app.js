/* Audio owns time; requestAnimationFrame only draws and observes it. */
(() => {
'use strict';
const R=HHRules, C=HHCharts, $=id=>document.getElementById(id);
const canvas=$('stage'), g=canvas.getContext('2d');
const colors=['#B79AFF','#2EC4B6','#F3E8D2','#FF9A3C'], angles=[-Math.PI/2,Math.PI,0,Math.PI/2];
const pitches=[220,277.18,329.63,440], keys={ArrowLeft:0,a:0,ArrowDown:1,s:1,ArrowUp:2,w:2,ArrowRight:3,d:3};
let state='Ready', prior='Opening', run=R.fresh(), notes=[], openingHits=0;
let ctx=null, bus=null, filter=null, buffer=null, bufferFile='', source=null, sourceGain=null, voices=new Set();
let epoch=0, generation=0, scheduled=0, openingNext=3, endingStart=0, failAt=0, resumeGrace=-Infinity;
let inputSources=new Map(), laneFlash=[0,0,0,0], callFlash=[0,0,0,0], lastJudgment='', slideUntil=0, faceSeen=false;
let loadAction=null, mainAction=null, savedMessage=null, endingStreet=false, lostToneBeat=-1, finalFade=false;
const asset='../assets/hallucination-hysteria/audio/';
const reduced=$('reduced'); reduced.checked=matchMedia('(prefers-reduced-motion: reduce)').matches;
const active=()=>['Opening','Playing','Stage Failed','Clear Ending','Lost Ending'].includes(state);
const bpm=()=>run.stage ? C.stages[run.stage-1].bpm : 91;
const latency=()=>ctx ? Math.max(0,ctx.outputLatency || ctx.baseLatency || 0) : 0;
const now=()=>ctx?R.songTime(ctx.currentTime,epoch,latency(),Number($('offset').value)):0;
const held=lane=>[...inputSources.values()].includes(lane);
function announce(text){$('announcement').textContent=text;}
function show(title,text,button,action,kicker=state) {
  savedMessage={title,text,button,action,kicker};
  $('message').hidden=false;$('message-title').textContent=title;$('message-text').textContent=text;
  $('message-kicker').textContent=kicker;$('main-action').textContent=button;
  $('main-action').disabled=!action;mainAction=action;
  $('name-label').hidden=state!=='Ready';
  $('back-action').hidden=state!=='Error';
  if(action && state!=='Ready') $('main-action').focus({preventScroll:true});
  announce(title+' '+text);
}
function hideMessage(){ $('message').hidden=true; mainAction=null; }
function setState(next){
 state=next;$('state-label').textContent=next;
 $('pause').disabled=!(active()||state==='Paused');
 $('pause').textContent=state==='Paused'?'Resume · P / Esc':'Pause · P / Esc';
 $('restart').disabled=!['Opening','Playing','Paused','Stage Failed'].includes(state);
 $('offset').disabled=active();
}
async function unlock(){
 if(!ctx){ctx=new AudioContext({latencyHint:'interactive'});bus=ctx.createGain();filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=20000;filter.connect(bus);bus.connect(ctx.destination);bus.gain.value=Number($('volume').value)/100;}
 await ctx.resume();
}
function tone(lane,when=ctx.currentTime,kind='hit',duration=.13){
 const o=ctx.createOscillator(),a=ctx.createGain();o.type=kind==='miss'?'sine':'triangle';
 o.frequency.setValueAtTime(kind==='miss'?95:pitches[lane]*(kind==='ghost'?1.055:1),when);
 if(kind==='miss')o.frequency.exponentialRampToValueAtTime(32,when+duration);
 a.gain.setValueAtTime(0,when);a.gain.linearRampToValueAtTime(kind==='pulse'?.035:kind==='miss'?.09:.065,when+.008);
 a.gain.exponentialRampToValueAtTime(.0001,when+duration);
 o.connect(a);a.connect(bus);o.start(when);o.stop(when+duration+.02);voices.add(o);o.onended=()=>{voices.delete(o);o.disconnect();a.disconnect();};
}
function stopSound(release=false){
 if(source){try{source.stop();}catch{}source.disconnect();source=null;}
 if(sourceGain){sourceGain.disconnect();sourceGain=null;}
 for(const o of voices){try{o.stop();}catch{}o.disconnect();}voices.clear();
 if(release){buffer=null;bufferFile='';}
}
function clearInputs(){inputSources.clear();document.querySelectorAll('[data-lane]').forEach(el=>el.classList.remove('held'));}
async function load(file){
 if(bufferFile===file&&buffer)return buffer;
 buffer=null;bufferFile='';
 const response=await fetch(asset+file);if(!response.ok)throw new Error('Audio file could not be loaded ('+response.status+').');
 const decoded=await ctx.decodeAudioData(await response.arrayBuffer());return decoded;
}
function music(buf,start,when,duration,fadeOut=true){
 source=ctx.createBufferSource();source.buffer=buf;
 sourceGain=ctx.createGain();sourceGain.gain.setValueAtTime(0,when);sourceGain.gain.linearRampToValueAtTime(.8,when+.5);
 if(fadeOut){sourceGain.gain.setValueAtTime(.8,when+duration-2);sourceGain.gain.linearRampToValueAtTime(0,when+duration);}
 source.connect(sourceGain);sourceGain.connect(filter);source.start(when,start,duration);
}
function resetVisuals(){lastJudgment='';slideUntil=0;faceSeen=false;endingStreet=false;laneFlash.fill(0);callFlash.fill(0);$('ending-credits').hidden=true;}
function opening(){
 ++generation;stopSound(true);clearInputs();run=R.fresh();notes=[];openingHits=0;scheduled=0;openingNext=3;epoch=ctx.currentTime+.25;
 filter.frequency.value=20000;resetVisuals();setState('Opening');hideMessage();
 $('stage-label').textContent='Opening · Find the beat';announce('Match four arrows on the right. Each success lights the street.');$('game').scrollIntoView({block:'start'});
}
async function startStage(index){
 const token=++generation;stopSound(index!==run.stage);clearInputs();run=R.fresh(index);notes=[];resetVisuals();
 const config=C.stages[index-1];setState('Loading');show('Entering '+config.name+'…','Loading this stage’s recording.','Loading',null);
 loadAction=()=>startStage(index);
 try{
  const decoded=await load(config.file);if(token!==generation)return;
  buffer=decoded;bufferFile=config.file;notes=C.chart(index);scheduled=0;
  epoch=ctx.currentTime+2;filter.frequency.value=20000;
  music(buffer,config.start,epoch,config.end-config.start+(index===3?7:0),index!==3);
  for(const n of notes)if(n.side==='caller')tone(n.lane,epoch+R.seconds(n.beat,config.bpm),'call',.16);
  finalFade=false;
  setState('Playing');hideMessage();$('stage-label').textContent='0'+index+' / '+config.name+' · '+config.bpm+' BPM';
  announce(config.intro);$('game').scrollIntoView({block:'start'});
  if(document.hidden || !document.hasFocus())pause('The page lost focus. Resume when ready.');
 }catch(error){if(token!==generation)return;setState('Error');show('The track could not load',error.message+' Check the connection and try again.','Retry',loadAction);}
}
function score(result){
 run.clarity=R.change(run.clarity,result);
 if(result==='Perfect'||result==='Good'){run.hits++;run.combo++;tone(pressedLane);faceSeen=true;laneFlash[pressedLane]=ctx.currentTime+.18;}
 if(result==='Miss'||result==='Ghost'){run.combo=0;run.misses++;tone(pressedLane,ctx.currentTime,result==='Miss'?'miss':'ghost');slideUntil=ctx.currentTime+.35;}
 lastJudgment=result+(R.delta[result]>0?' +':' ')+(R.delta[result]||'');
 if(run.clarity===0 && state==='Playing'){stopSound();clearInputs();failAt=ctx.currentTime+1.2;setState('Stage Failed');show('The world slips away.','Clarity ran out. This stage will restart; your journey stays here.','Restart Stage',()=>startStage(run.stage));}
}
let pressedLane=0;
function press(lane,id){
 if(state==='Clear Ending'){credits();return;}
 if(!['Opening','Playing'].includes(state)||inputSources.has(id))return;
 const already=held(lane);inputSources.set(id,lane);document.querySelector('[data-lane="'+lane+'"]').classList.add('held');
 if(already)return;pressedLane=lane;
 const t=now(),n=R.press(notes,lane,t,bpm());if(!n)return;
 const result=n.ghost?'Ghost':R.judge(t-R.seconds(n.beat,bpm()));if(!result)return;
 if(state==='Opening'){
  n.done=true;
  if(result==='Perfect'||result==='Good'){openingHits++;tone(lane);laneFlash[lane]=ctx.currentTime+.2;lastJudgment='Found the beat · '+openingHits+' / 4';}
  else lastJudgment='Try the next arrow';
  if(openingHits===4)startStage(1);return;
 }
 n.done=true;
 if(n.hold && (result==='Perfect'||result==='Good')){n.done=false;n.holding=true;}
 score(result);
}
function release(id){
 const lane=inputSources.get(id);if(lane===undefined)return;
 inputSources.delete(id);
 if(!held(lane))document.querySelector('[data-lane="'+lane+'"]').classList.remove('held');
 if(state!=='Playing'||held(lane))return;
 for(const n of notes.filter(n=>n.lane===lane&&n.holding&&!n.done)){pressedLane=lane;score(R.release(n,now(),bpm()));}
}
function pause(reason='Take a breath. Resume from the same beat.'){
 if(!active()||!ctx)return;
 prior=state;const previous=savedMessage;setState('Paused');ctx.suspend();clearInputs();
 show('Paused',reason+' If you paused during a hold, re-grip its key or pad when you resume.','Resume',resume);
 savedMessage.previous=previous;
}
async function resume(){
 if(state!=='Paused')return;
 const previous=savedMessage?.previous;await ctx.resume();
 resumeGrace=now()+.3;setState(prior);
 if(['Stage Failed','Clear Ending','Lost Ending'].includes(prior)&&previous)show(previous.title,previous.text,previous.button,previous.action,previous.kicker);else hideMessage();
 announce('Resumed. Follow the arrows.');$('game').scrollIntoView({block:'start'});
}
async function restart(){await unlock();if(run.stage)await startStage(run.stage);else opening();}
function complete(){
 stopSound();clearInputs();setState('Stage Complete');
 show('Stage complete · Clarity '+run.clarity,C.stages[run.stage-1].complete,'Start Next Stage',()=>startStage(run.stage+1));
}

async function finish(){
 const choice=R.ending(run.clarity);clearInputs();notes=[];endingStart=ctx.currentTime;lostToneBeat=-1;
 setState(choice);
 if(choice==='Lost Ending'){
  filter.frequency.setTargetAtTime(550,ctx.currentTime,.4);
  if(sourceGain){sourceGain.gain.cancelScheduledValues(ctx.currentTime);sourceGain.gain.setValueAtTime(.65,ctx.currentTime);sourceGain.gain.setValueAtTime(.65,ctx.currentTime+3);sourceGain.gain.linearRampToValueAtTime(0,ctx.currentTime+5);}
  show('Was any of it real?','The Reflection sings on. The room fades back to the blurred street.','Start Again',credits);
 }else{
  stopSound(true);filter.frequency.value=20000;
  tone(0,ctx.currentTime,'pulse',1.5);
  show('I made it home.','Morning comes. The mirror shows only the Walker, headphones off. Press any arrow or Play Again to view the credits.','Play Again',credits);
  const token=++generation;
  try{const decoded=await load('faded-dream.mp3');if(token!==generation || !['Clear Ending','Paused'].includes(state))return;
   buffer=decoded;bufferFile='faded-dream.mp3';music(buffer,0,ctx.currentTime+.15,Math.min(45,buffer.duration),true);
  }catch{if(token===generation)announce('You made it home. The ending music could not load; credits and replay still work.');}
 }
}

function credits(){++generation;stopSound(true);setState('Credits');show('The walk can begin again.','Music and original art credits below.','Play Again',ready);$('ending-credits').hidden=false;$('ending-credits').innerHTML=document.querySelector('#music-credits')?.innerHTML||'';}
function ready(){
 ++generation;stopSound(true);clearInputs();run=R.fresh();notes=[];openingHits=0;epoch=0;resetVisuals();$('player-name').value='Micah';setState('Ready');
 $('stage-label').textContent='A walk through an unreliable world';
 show('Keep the rhythm. Keep your bearings.','Sound is needed. Press the matching arrow as it meets its target on the right. Use arrow keys, WASD or the four tap pads. Ignore hollow, dashed notes.','Start',async()=>{try{await unlock();opening();}catch(e){setState('Error');loadAction=ready;show('Audio could not start',e.message,'Back to title',ready);}},'Before you begin');
}
function tick(){
 const t=now();
 if(state==='Opening'){
  while(scheduled<ctx.currentTime+.15-epoch){const b=Math.ceil(scheduled*91/60-1e-6);tone(0,Math.max(ctx.currentTime,epoch+R.seconds(b,91)),'pulse',.08);scheduled=R.seconds(b+1,91);}
  if(!notes.some(n=>!n.done)){notes=[{beat:openingNext,lane:Math.floor(openingNext/4)%4,side:'player',done:false}];openingNext+=4;}
  for(const n of notes)if(t>R.seconds(n.beat,91)+.15){n.done=true;}
 }
 if(state==='Playing'){
  const config=C.stages[run.stage-1];
  for(const n of notes){
   if(state!=='Playing')break;
   pressedLane=n.lane;
   if(n.holding&&!n.done){
    if(t>=R.seconds(n.beat+n.hold,config.bpm))score(R.release(n,t,config.bpm));
    else if(!held(n.lane)&&t>resumeGrace)score(R.release(n,t,config.bpm));
   }else {const result=R.expire(n,t,config.bpm);if(result&&result!=='Pass')score(result);}
  }
  if(state==='Playing' && run.stage===3 && !finalFade && t>=config.end-config.start-2){
   finalFade=true;
   if(run.clarity>50 && sourceGain){sourceGain.gain.cancelScheduledValues(ctx.currentTime);sourceGain.gain.setValueAtTime(.8,ctx.currentTime);sourceGain.gain.linearRampToValueAtTime(0,epoch+config.end-config.start);}
  }
  if(state==='Playing'&&t>=config.end-config.start){if(run.stage===3)finish();else complete();}
 }
 if(state==='Stage Failed'&&ctx.currentTime>=failAt)startStage(run.stage);
 if(state==='Lost Ending'){
  const age=ctx.currentTime-endingStart;
  if(age<5){const b=Math.floor(age*115/60);if(b!==lostToneBeat){lostToneBeat=b;tone(b%4,ctx.currentTime,'call',.2);}}
  if(age>=5&&!endingStreet){endingStreet=true;stopSound(true);announce('The blurred street returns. Start Again leads to the credits.');}
 }
 draw(t);requestAnimationFrame(tick);
}
function arrow(x,y,lane,fill=true,ghost=false,size=19){
 g.save();g.translate(x,y);g.rotate(angles[lane]);g.beginPath();
 [[0,-size],[-size,0],[-size*.43,0],[-size*.43,size],[size*.43,size],[size*.43,0],[size,0]].forEach(([a,b],i)=>i?g.lineTo(a,b):g.moveTo(a,b));g.closePath();
 g.lineWidth=ghost?3:2;g.strokeStyle=ghost?'#F3E8D2':colors[lane];g.setLineDash(ghost?[5,4]:[]);
 if(fill&&!ghost){g.fillStyle=colors[lane];g.fill();g.strokeStyle='#F3E8D2';}g.stroke();g.restore();
}
function person(x,y,color,headphones=true,reflection=false,faceOffset=0,faceClear=true){
 g.save();g.translate(x,y);g.strokeStyle=color;g.lineWidth=4;g.lineJoin='round';g.fillStyle='#202236';
 g.beginPath();g.moveTo(-20,22);g.lineTo(-28,80);g.lineTo(28,80);g.lineTo(20,22);g.closePath();g.fill();g.stroke();
 g.save();g.translate(faceOffset,0);g.beginPath();g.ellipse(0,0,23,29,0,0,Math.PI*2);g.fill();g.stroke();if(faceClear){g.fillStyle=color;g.fillRect(-11,-5,5,4);g.fillRect(6,-5,5,4);g.beginPath();g.moveTo(-7,10);g.lineTo(7,10);g.stroke();}g.restore();
 g.beginPath();g.moveTo(-12,80);g.lineTo(-18,112);g.moveTo(12,80);g.lineTo(18,112);g.moveTo(-22,32);g.lineTo(-40,60);g.moveTo(22,32);g.lineTo(reflection?65:40,reflection?12:60);g.stroke();
 if(headphones){g.strokeStyle='#FF9A3C';g.beginPath();g.arc(0,-2,29,Math.PI,0);g.stroke();g.fillStyle='#FF9A3C';g.fillRect(-32,-10,7,25);g.fillRect(25,-10,7,25);}
 g.restore();
}
function scenery(t){
 const visualState=state==='Paused'?prior:state;
 const clear=visualState==='Clear Ending',lost=visualState==='Lost Ending';
 const stage=endingStreet?0:run.stage,opening=visualState==='Opening'||visualState==='Ready',loss=clear?0:lost?1:opening?Math.max(.25,1-openingHits*.17):1-run.clarity/100;
 g.save();g.filter='blur('+(loss*4)+'px)';
 const motion=reduced.checked?0:Math.sin(t*.8)*loss*(stage===3?8:3);
 g.translate(motion,0);if(!reduced.checked && state==='Stage Failed')g.transform(1,0,.08*Math.sin(t*12),1,0,0);
 g.fillStyle=clear?'#61505b':stage===3?'#21152f':'#111425';g.fillRect(-20,0,1000,540);
 if(stage!==3){
  g.fillStyle='#1c1c30';[[0,120,150],[150,70,130],[280,135,160],[440,60,130],[570,130,140],[710,80,250]].forEach(([x,y,w])=>g.fillRect(x,y,w,330-y));
  g.strokeStyle='#393248';g.lineWidth=2;g.beginPath();g.moveTo(0,425);g.lineTo(960,425);g.moveTo(0,500);g.lineTo(960,455);g.stroke();
  [240,480,800].forEach((x,i)=>{g.strokeStyle='#685264';g.lineWidth=6;g.beginPath();g.moveTo(x,420);g.lineTo(x,205);g.lineTo(x+35,205);g.stroke();g.fillStyle='#FF9A3C';g.fillRect(x+23,202,36,7);const singing=notes.some(n=>n.side==='caller'&&n.lane%3===i&&Math.abs(R.seconds(n.beat,bpm())-t)<.18);g.fillStyle='rgba(255,154,60,'+((opening&&i>=openingHits)?.025:singing?.24:.12)+')';g.beginPath();g.moveTo(x+23,210);g.lineTo(x-65,425);g.lineTo(x+146,425);g.lineTo(x+59,210);g.fill();});
  g.fillStyle='#FF9A3C';g.font='18px monospace';g.fillText('OPEN',55,305);g.fillStyle='#F3E8D2';g.fillText('2:47',450,270);
  if(stage===2){
   g.strokeStyle='#75677c';g.lineWidth=6;g.strokeRect(105,260,245,170);g.beginPath();g.moveTo(85,260);g.lineTo(370,260);g.moveTo(120,395);g.lineTo(335,395);g.stroke();
   const entrance=Math.min(1,Math.max(0,t/10.58));g.globalAlpha=entrance;
   person(225,325,faceSeen?'#F3E8D2':'#2EC4B6',false,true,ctx&&ctx.currentTime<slideUntil?22:0,faceSeen);
   g.fillStyle='#0E1020';g.fillRect(270,285,155,42);g.strokeStyle='#2EC4B6';g.strokeRect(270,285,155,42);g.fillStyle='#2EC4B6';g.font='20px sans-serif';g.fillText(faceSeen?($('player-name').value.trim()||'Micah'):'∿ ? ⌁ #',282,313);g.globalAlpha=1;
  }
 }else{
  g.strokeStyle='#64516e';g.lineWidth=5;g.strokeRect(115,235,230,225);g.fillStyle='#141226';g.fillRect(120,240,220,215);
  person(235,323,clear?'#F3E8D2':'#2EC4B6',!clear,!clear);g.strokeStyle='#64516e';g.strokeRect(470,300,190,125);g.fillRect(470,305,185,120);
 }
 person(735,330,'#F3E8D2',!clear);
 if(clear){g.fillStyle='rgba(255,206,139,.15)';g.fillRect(0,0,960,540);}
 g.fillStyle='rgba(122,76,255,'+(loss*.15)+')';g.fillRect(-20,0,1000,540);g.restore();
 if(lost){const age=ctx.currentTime-endingStart;const fade=age<5?Math.max(0,age-4):Math.max(0,6-age);g.fillStyle='rgba(14,16,32,'+fade+')';g.fillRect(0,0,960,540);}
}
function draw(t){
 g.clearRect(0,0,960,540);scenery(t);
 // Everything below is outside the scenery filter and transform.
 const playing=['Opening','Playing','Paused','Stage Failed'].includes(state);
 for(let side=0;side<2;side++){
  const start=side?660:90;g.fillStyle='rgba(14,16,32,.88)';g.fillRect(start-30,35,270,228);
  g.fillStyle='#F3E8D2';g.font='13px sans-serif';g.fillText(side?'YOU · MATCH THE ARROWS':run.stage?C.stages[run.stage-1].caller.toUpperCase():'LISTEN · WATCH',start-12,25);
  for(let lane=0;lane<4;lane++){
   const x=start+lane*60;g.strokeStyle='#353247';g.setLineDash([3,9]);g.beginPath();g.moveTo(x,100);g.lineTo(x,260);g.stroke();g.setLineDash([]);
   arrow(x,82,lane,false);
   if(ctx && ((side&&laneFlash[lane]>ctx.currentTime)||(!side&&notes.some(n=>n.side==='caller'&&n.lane===lane&&Math.abs(R.seconds(n.beat,bpm())-t)<.16)))){g.strokeStyle=colors[lane];g.lineWidth=3;g.strokeRect(x-24,58,48,48);}
  }
 }
 if(playing){
  g.save();g.beginPath();g.rect(0,38,960,232);g.clip();
  for(const n of notes){
   const dt=R.seconds(n.beat,bpm())-t;if(n.done||dt>2.1||dt<-.2&&!n.holding)continue;
   const x=(n.side==='player'?660:90)+n.lane*60;
   let y=82+dt*92;
   if(n.hold){const end=82+(R.seconds(n.beat+n.hold,bpm())-t)*92;g.strokeStyle=colors[n.lane];g.lineWidth=9;g.beginPath();g.moveTo(x,n.holding?82:y);g.lineTo(x,end);g.stroke();}
   if(n.holding)y=82;arrow(x,y,n.lane,true,n.ghost);
  }g.restore();
 }
 const eye=320+run.clarity*3.2;g.fillStyle='#7A4CFF';g.fillRect(320,494,160,10);g.fillStyle='#FF9A3C';g.fillRect(480,494,160,10);
 g.fillStyle='#F3E8D2';g.font='16px sans-serif';g.fillText('Lost',265,505);g.fillText('Clear',658,505);
 g.beginPath();g.moveTo(eye-15,499);g.quadraticCurveTo(eye,478,eye+15,499);g.quadraticCurveTo(eye,520,eye-15,499);g.fillStyle='#0E1020';g.fill();g.strokeStyle='#F3E8D2';g.lineWidth=2;g.stroke();g.beginPath();g.arc(eye,499,4,0,Math.PI*2);g.fillStyle='#F3E8D2';g.fill();
 if(state==='Ready'){g.fillStyle='#F3E8D2';g.font='bold 23px sans-serif';g.textAlign='center';g.fillText('A familiar street. An unfamiliar feeling.',480,450);g.textAlign='left';}
 if(state==='Playing'&&t<0){g.fillStyle='#FF9A3C';g.font='bold 40px sans-serif';g.fillText(String(Math.ceil(-t)),463,295);}
 $('clarity-number').textContent=run.clarity;$('judgment').textContent=lastJudgment||'Solid arrows: hit · Hollow dashed arrows: ignore';
 $('progress').textContent=(state==='Opening'||state==='Paused'&&prior==='Opening')?'Find the beat · '+openingHits+' / 4':run.stage?'Stage '+run.stage+' · '+Math.max(0,Math.floor(t))+' / '+Math.round(C.stages[run.stage-1].end-C.stages[run.stage-1].start)+' s':'Opening → Street → Stranger → Room';
}
$('main-action').addEventListener('click',()=>mainAction?.());
$('back-action').addEventListener('click',ready);
$('pause').addEventListener('click',()=>state==='Paused'?resume():pause());
$('restart').addEventListener('click',restart);
$('offset').addEventListener('input',()=>{$('offset-value').textContent=$('offset').value+' ms';});
$('volume').addEventListener('input',()=>{if(bus)bus.gain.setTargetAtTime(Number($('volume').value)/100,ctx.currentTime,.03);});
document.querySelectorAll('[data-lane]').forEach(pad=>{
 const lane=Number(pad.dataset.lane);
 pad.addEventListener('pointerdown',e=>{e.preventDefault();pad.setPointerCapture(e.pointerId);press(lane,'pointer'+e.pointerId);});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])pad.addEventListener(event,e=>release('pointer'+e.pointerId));
 pad.addEventListener('keydown',e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();if(!e.repeat)press(lane,'pad'+lane);}});
 pad.addEventListener('keyup',e=>{if([' ','Enter'].includes(e.key))release('pad'+lane);});
});
window.addEventListener('keydown',e=>{
 if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.ctrlKey||e.metaKey||e.altKey)return;
 const key=e.key.length===1?e.key.toLowerCase():e.key;
 if(key in keys){if(['Opening','Playing','Paused','Clear Ending'].includes(state))e.preventDefault();if(!e.repeat)press(keys[key],key);}
 else if(!e.repeat&&(key==='p'||key==='Escape')){if(state==='Paused')resume();else pause();}
 else if(!e.repeat&&key==='r'&&!$('restart').disabled)restart();
});
window.addEventListener('keyup',e=>release(e.key.length===1?e.key.toLowerCase():e.key));
window.addEventListener('blur',()=>pause('The window lost focus.'));
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause('The tab was hidden.');});
window.addEventListener('pagehide',()=>{++generation;stopSound(true);ctx?.suspend();});
ready();requestAnimationFrame(tick);
})();
