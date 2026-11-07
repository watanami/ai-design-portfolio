/* Audio owns time; requestAnimationFrame only draws and observes it. */
(() => {
'use strict';
const R=HHRules, C=HHCharts, $=id=>document.getElementById(id);
const canvas=$('stage'), g=canvas.getContext('2d');
const colors=['#B79AFF','#2EC4B6','#F3E8D2','#FF9A3C'], angles=[-Math.PI/2,Math.PI,0,Math.PI/2];
const pitches=[220,277.18,329.63,440], keys={ArrowLeft:0,a:0,ArrowDown:1,s:1,ArrowUp:2,w:2,ArrowRight:3,d:3};
let state='Ready', prior='Playing', run=R.fresh(), notes=[];
let ctx=null, bus=null, filter=null, buffer=null, bufferFile='', source=null, sourceGain=null, voices=new Set();
let epoch=0, generation=0, endingStart=0, resumeGrace=-Infinity, frozenTime=0;
let inputSources=new Map(), laneFlash=[0,0,0,0], callFlash=[0,0,0,0], lastJudgment='', slideUntil=0, faceSeen=false;
let loadAction=null, mainAction=null, savedMessage=null, endingStreet=false, lostToneBeat=-1, finalFade=false;
const asset='../assets/hallucination-hysteria/audio/';
const reduced=$('reduced'); reduced.checked=matchMedia('(prefers-reduced-motion: reduce)').matches;
const active=()=>['Playing','Story','Stage Failed','Clear Ending','Lost Ending'].includes(state);
const bpm=()=>run.stage ? C.stages[run.stage-1].bpm : 91;
const latency=()=>ctx ? Math.max(0,ctx.outputLatency || ctx.baseLatency || 0) : 0;
const now=()=>{
 if(!ctx)return 0;
 if(state==='Paused')return frozenTime;
 let audible=ctx.currentTime-latency();
 if(ctx.state==='running'&&ctx.getOutputTimestamp){const stamp=ctx.getOutputTimestamp();if(stamp.contextTime>0&&stamp.performanceTime>0)audible=Math.min(ctx.currentTime,stamp.contextTime+(performance.now()-stamp.performanceTime)/1000);}
 return audible-epoch-Number($('offset').value)/1000;
};
const eventTime=stamp=>stamp===undefined?now():R.eventTime(now(),stamp,performance.now());
const sceneImages={};
for(const [key,file] of Object.entries({street:'street',stop:'bus-stop',room:'room',clear:'clear'})){const im=new Image();im.src='art/'+file+'.png';sceneImages[key]=im;}
let sceneStage=1,story=null;
const playerName=()=>($('player-name').value.trim()||'Walker');
const held=lane=>[...inputSources.values()].includes(lane);
function announce(text){$('announcement').textContent=text;}
function show(title,text,button,action,kicker=state) {
  savedMessage={title,text,button,action,kicker};
  $('message').hidden=false;$('message-title').textContent=title;$('message-text').textContent=text;
  $('message-kicker').textContent=kicker;$('message-kicker').hidden=!kicker;$('message-text').hidden=!text;$('main-action').textContent=button;
  $('main-action').disabled=!action;mainAction=action;
  $('name-label').hidden=state!=='Ready';
  $('back-action').hidden=state!=='Error';
  if(action && state!=='Ready') $('main-action').focus({preventScroll:true});
  announce(title+' '+text);
}
function hideMessage(){ $('message').hidden=true; mainAction=null; }
function setState(next){
 state=next;$('state-label').textContent=next;
 const cinematic=['Ready','Story','Credits','Clear Ending','Lost Ending'].includes(next==='Paused'?prior:next);
 $('game').classList.toggle('cinematic',cinematic);


 $('pause').disabled=!(active()||state==='Paused');
 $('pause').textContent=state==='Paused'?'Resume · P / Esc':'Pause · P / Esc';
 $('restart').disabled=!(['Playing','Stage Failed'].includes(state)||state==='Paused'&&prior==='Playing');
 $('offset').disabled=active();
}
async function unlock(){
 if(!ctx){ctx=new AudioContext({latencyHint:'interactive'});bus=ctx.createGain();filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=20000;filter.connect(bus);bus.connect(ctx.destination);bus.gain.value=Number($('volume').value)/100;}
 await ctx.resume();
}
function tone(lane,when=ctx.currentTime,kind='hit',duration=.13){
 const o=ctx.createOscillator(),a=ctx.createGain();o.type=kind==='miss'?'sine':'triangle';
 o.frequency.setValueAtTime(kind==='miss'?95:pitches[lane],when);
 if(kind==='miss')o.frequency.exponentialRampToValueAtTime(32,when+duration);
 a.gain.setValueAtTime(0,when);a.gain.linearRampToValueAtTime(kind==='pulse'?.025:kind==='miss'?.06:kind==='call'?.027:.045,when+.008);
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
 sourceGain=ctx.createGain();sourceGain.gain.setValueAtTime(0,when);sourceGain.gain.linearRampToValueAtTime(.37,when+.5);
 if(fadeOut){sourceGain.gain.setValueAtTime(.37,when+duration-2);sourceGain.gain.linearRampToValueAtTime(0,when+duration);}
 source.connect(sourceGain);sourceGain.connect(filter);source.start(when,start,duration);
}
function resetVisuals(){lastJudgment='';slideUntil=0;faceSeen=false;endingStreet=false;laneFlash.fill(0);callFlash.fill(0);$('ending-credits').hidden=true;}
async function startStage(index){
 const token=++generation;const config=C.stages[index-1];stopSound(bufferFile!==config.file);clearInputs();run=R.fresh(index);sceneStage=index;notes=[];story=null;resetVisuals();
 setState('Loading');show('Entering '+config.name+'…','Loading this stage’s recording.','Loading',null);
 loadAction=()=>startStage(index);
 try{
  const decoded=await load(config.file);if(token!==generation)return;
  buffer=decoded;bufferFile=config.file;notes=C.chart(index);
  epoch=ctx.currentTime+(index===1?4:1.3);filter.frequency.value=20000;
  music(buffer,config.start,epoch,config.end-config.start+(index===3?7:0),index!==3);
  for(const n of notes)if(n.side==='caller')tone(n.lane,epoch+R.seconds(n.beat,config.bpm),'call',.16);
  finalFade=false;
  setState('Playing');hideMessage();$('stage-label').textContent='0'+index+' / '+config.name+' · 2:47 a.m.';
  $('objective').textContent=config.objective;announce(config.intro);$('game').scrollIntoView({block:'start'});
  if(document.hidden || !document.hasFocus())pause('The page lost focus. Resume when ready.');
 }catch(error){if(token!==generation)return;setState('Error');show('The track could not load',error.message+' Check the connection and try again.','Retry',loadAction);}
}
function score(result){
 run.clarity=R.change(run.clarity,result,run.stage);
 if(result==='Perfect'||result==='Good'){run.hits++;run.combo++;run.bestCombo=Math.max(run.bestCombo,run.combo);tone(pressedLane);faceSeen=true;laneFlash[pressedLane]=ctx.currentTime+.32;}
 if(result==='Miss'){run.combo=0;run.misses++;tone(pressedLane,ctx.currentTime,'miss');slideUntil=ctx.currentTime+.35;}
 const amount=R.points(result,run.stage);lastJudgment=result+(amount>0?' +':' ')+(amount||'');
 if(run.clarity===0 && state==='Playing'){stopSound();clearInputs();setState('Stage Failed');show('The world slips away.','The scene overwhelmed you, but you are still here. Take a breath. Restart this chapter when you are ready.','Restart Stage',()=>startStage(run.stage));}
}
let pressedLane=0;
function press(lane,id,stamp){
 if(state==='Clear Ending')return;
 if(state!=='Playing'||inputSources.has(id))return;
 const already=held(lane);inputSources.set(id,lane);document.querySelector('[data-lane="'+lane+'"]').classList.add('held');
 if(already)return;pressedLane=lane;
 const t=eventTime(stamp),n=R.press(notes,lane,t,bpm());if(!n)return;
 const result=R.judge(t-R.seconds(n.beat,bpm()));if(!result)return;
 n.done=true;
 if(n.hold && (result==='Perfect'||result==='Good')){n.done=false;n.holding=true;}
 score(result);
}
function release(id,stamp){
 const lane=inputSources.get(id);if(lane===undefined)return;
 inputSources.delete(id);
 if(!held(lane))document.querySelector('[data-lane="'+lane+'"]').classList.remove('held');
 if(state!=='Playing'||held(lane))return;
 for(const n of notes.filter(n=>n.lane===lane&&n.holding&&!n.done)){pressedLane=lane;score(R.release(n,eventTime(stamp),bpm()));}
}
function pause(reason='Take a breath. Resume from the same beat.'){
 if(!active()||!ctx)return;
 prior=state;frozenTime=now();const previous=savedMessage;setState('Paused');ctx.suspend();clearInputs();
 show('Paused',reason+' If you paused during a hold, re-grip its key or pad when you resume.','Resume',resume);
 savedMessage.previous=previous;
}
async function resume(){
 if(state!=='Paused')return;
 const previous=savedMessage?.previous;await ctx.resume();
 resumeGrace=now()+.3;setState(prior);
 if(['Story','Stage Failed','Clear Ending','Lost Ending'].includes(prior)&&previous)show(previous.title,previous.text,previous.button,previous.action,previous.kicker);else hideMessage();
 announce('Resumed. Follow the arrows.');$('game').scrollIntoView({block:'start'});
}
async function restart(){await unlock();await startStage(run.stage||1);}
function complete(){openStory(run.stage+1);}
const chapters={"1":[["Another late night.","You have barely slept in days. You left your project behind, but cannot remember whether you saved the last change."],["You should know this street.","You walk this way all the time. Tonight, you cannot remember which turn comes next. You try to notice each sign before it slips from your mind."],["Stay with the beat.","The lights seem to move when you look away. You keep your attention on the music and the arrows. One beat, one step. Keep track of where you are."]],"2":[["Did you pass this stop already?","The shelter looks familiar. You cannot remember whether you just walked past it or only imagined doing so. Stop. Look around. Keep listening."],["You should know that voice.","Someone on the bench seems to say your name. You search for a face, a place you met, anything. Nothing comes. The harder you try, the less certain you feel."],["Do not lose your place.","The figure points down the street. You cannot tell whether it is helping or whether anyone is there. Keep your rhythm while you try to remember the way home."]],"3":[["How did you get here?","You are in your room, but the walk from the bus stop is missing. You try to retrace it. The stairs. The door. Nothing stays clear."],["You should recognize yourself.","Your reflection looks back, then seems to move before you do. You know it should follow you. You watch again, trying to hold on to what you know."],["One thing at a time.","Trying to remember everything only makes the room feel further away. Stay with the next arrow. Then the next beat. Do not let the Reflection pull you out of your own rhythm."]]};
function renderStory(){
 const page=chapters[story.next][story.page],last=story.page===chapters[story.next].length-1;
 show(page[0],page[1],last?'Begin stage':'Continue',()=>last?(story.next===1?showInstructions():startStage(story.next)):(story.page++,renderStory()),'Chapter '+story.next+' · '+(story.page+1)+' / 3');
}
function endingPages(clear,page=0){
 const pages=clear?[["The room settles.","The last pattern ends. You look away from the mirror, then back. Your reflection follows. You can keep your attention on the room for a little longer."],["You are here.","You still cannot remember every turn you took. You still do not know what was real. But you can notice the morning light and feel the headphones in your hands."],["I made it home.","You do not have to solve the whole night now. You stayed with the beat long enough to get here. For now, you can stop trying and rest."]]:[["You lose your place.","The Reflection keeps singing. You cannot remember which phrase you were answering, or how long you have been standing here."],["The street again.","You blink. The room is gone. The clock reads 2:47. You try to remember the walk home, but the memories will not stay in order."],["Was any of it real?","You cannot be sure where you are. The music is still playing. Find the next beat, and try to hold on to your surroundings again."]];
 show(pages[page][0],pages[page][1],page===2?(clear?'Play Again':'Start Again'):'Continue',()=>page===2?ready():endingPages(clear,page+1),'Ending · '+(page+1)+' / 3');
}
function showInstructions(){
 show("Your arrows are on the right.","Press the matching arrow key when a moving arrow reaches its outline. On a phone, use the arrow pads below. Hold notes with tails until the tail ends. The left side is your opponent. You will have four seconds to get ready.","Ready — start countdown",()=>startStage(1),"How to play");
}
async function openStory(next){
 const token=++generation;stopSound(true);clearInputs();notes=[];story={next,page:0};sceneStage=next;endingStreet=false;
 setState('Story');$('stage-label').textContent='Between chapters · '+C.stages[next-1].name;renderStory();$('game').scrollIntoView({block:'start'});
 try{
  const config=C.stages[next-1],decoded=await load(config.file);
  if(token!==generation)return;
  buffer=decoded;bufferFile=config.file;filter.frequency.value=2200;
  source=ctx.createBufferSource();source.buffer=buffer;source.loop=true;source.loopStart=config.start;source.loopEnd=config.start+8;
  sourceGain=ctx.createGain();sourceGain.gain.setValueAtTime(0,ctx.currentTime);sourceGain.gain.linearRampToValueAtTime(.08,ctx.currentTime+1);
  source.connect(sourceGain);sourceGain.connect(filter);source.start(ctx.currentTime,config.start);
 }catch{if(token===generation)announce('The story remains available. Music will retry when you start the next chapter.');}
 if(document.hidden && state==='Story')pause('The tab was hidden.');
}

async function finish(){
 const choice=R.ending(run.clarity);clearInputs();notes=[];endingStart=ctx.currentTime;lostToneBeat=-1;
 setState(choice);
 if(choice==='Lost Ending'){
  filter.frequency.setTargetAtTime(550,ctx.currentTime,.4);
  if(sourceGain){sourceGain.gain.cancelScheduledValues(ctx.currentTime);sourceGain.gain.setValueAtTime(.325,ctx.currentTime);sourceGain.gain.setValueAtTime(.325,ctx.currentTime+3);sourceGain.gain.linearRampToValueAtTime(0,ctx.currentTime+5);}
  endingPages(false);
 }else{
  stopSound(true);filter.frequency.value=20000;
  tone(0,ctx.currentTime,'pulse',1.5);
  endingPages(true);
  const token=++generation;
  try{const decoded=await load('faded-dream.mp3');if(token!==generation || !['Clear Ending','Paused'].includes(state))return;
   buffer=decoded;bufferFile='faded-dream.mp3';music(buffer,0,ctx.currentTime+.15,Math.min(45,buffer.duration),true);
  }catch{if(token===generation)announce('You made it home. The ending music could not load; credits and replay still work.');}
 }
}

function credits(){++generation;stopSound(true);setState('Credits');show('The walk can begin again.','Music and original art credits below.','Play Again',ready);$('ending-credits').hidden=false;$('ending-credits').innerHTML=document.querySelector('#music-credits')?.innerHTML||'';}
function ready(){
 ++generation;stopSound(true);clearInputs();run=R.fresh();notes=[];story=null;sceneStage=1;epoch=0;resetVisuals();$('player-name').value='Walker';setState('Ready');
 $('stage-label').textContent='2:47 A.M. · A ten-minute walk home';$('objective').textContent='Get home before the street stops making sense.';
 show('2:47 a.m.','A ten-minute walk home. Keep the beat.','Start',async()=>{try{await unlock();await openStory(1);}catch(e){setState('Error');loadAction=ready;show('Audio could not start',e.message,'Back to title',ready);}},'');

}
function tick(){
 const t=now();
 if(state==='Playing'){
  const config=C.stages[run.stage-1];
  for(const n of notes){
   if(state!=='Playing')break;
   pressedLane=n.lane;
   if(n.holding&&!n.done){
    if(t>=R.seconds(n.beat+n.hold,config.bpm))score(R.release(n,t,config.bpm));
    else if(!held(n.lane)&&t>resumeGrace)score(R.release(n,t,config.bpm));
   }else {const result=R.expire(n,t-.100,config.bpm);if(result)score(result);}
  }
  if(state==='Playing' && run.stage===3 && !finalFade && t>=config.end-config.start-2){
   finalFade=true;
   if(run.clarity>50 && sourceGain){sourceGain.gain.cancelScheduledValues(ctx.currentTime);sourceGain.gain.setValueAtTime(.37,ctx.currentTime);sourceGain.gain.linearRampToValueAtTime(0,epoch+config.end-config.start);}
  }
  if(state==='Playing'&&t>=config.end-config.start){if(run.stage===3)finish();else complete();}
 }

 if(state==='Lost Ending'){
  const age=ctx.currentTime-endingStart;
  if(age<5){const b=Math.floor(age*115/60);if(b!==lostToneBeat){lostToneBeat=b;tone(b%4,ctx.currentTime,'call',.2);}}
  if(age>=5&&!endingStreet){endingStreet=true;stopSound(true);announce('The blurred street returns. Choose Start Again when ready.');}
 }
 draw(t);requestAnimationFrame(tick);
}
function arrow(x,y,lane,fill=true,size=19){
 g.save();g.translate(x,y);g.rotate(angles[lane]);g.lineJoin='round';g.setLineDash([]);
 const shape=()=>{g.beginPath();[[0,-1.1],[-.17,-1.1],[-1,-.27],[-1,-.07],[-.73,.2],[-.42,-.1],[-.42,.93],[-.28,1.08],[.28,1.08],[.42,.93],[.42,-.1],[.73,.2],[1,-.07],[1,-.27],[.17,-1.1]].forEach(([a,b],i)=>i?g.lineTo(a*size,b*size):g.moveTo(a*size,b*size));g.closePath();};
 shape();
 if(fill){
  // Cream outer rim, ink separation and saturated bevel echo arcade notes.
  g.lineWidth=7;g.strokeStyle='#fff3df';g.stroke();
  g.lineWidth=4.5;g.strokeStyle='#141123';g.stroke();
  const ramp=g.createLinearGradient(0,-size,0,size);
  ramp.addColorStop(0,['#d9baff','#8affec','#fff6c4','#ffc779'][lane]);
  ramp.addColorStop(.45,colors[lane]);ramp.addColorStop(1,['#7443d8','#008f93','#d4a75d','#ee592e'][lane]);
  g.fillStyle=ramp;g.fill();
  g.save();g.scale(.64,.68);shape();g.fillStyle='rgba(255,255,255,.45)';g.fill();g.restore();
  shape();g.lineWidth=1;g.strokeStyle='rgba(255,255,255,.6)';g.stroke();
 }else{
  g.lineWidth=5;g.strokeStyle='#0e1020';g.stroke();g.lineWidth=2;g.strokeStyle=colors[lane];g.stroke();
 }
 g.restore();
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
 const visual=state==='Paused'?prior:state;
 const clear=visual==='Clear Ending',lost=visual==='Lost Ending';
 const backgroundStage=visual==="Story"&&story?story.next:sceneStage;
 const key=clear?'clear':endingStreet?'street':backgroundStage===2?'stop':backgroundStage===3?'room':'street';
 const im=sceneImages[key],cinematic=['Ready','Story','Clear Ending','Credits'].includes(visual);
 const loss=visual==='Ready'?.65:cinematic?0:lost?1:(1-run.clarity/100);
 g.save();g.fillStyle='#0E1020';g.fillRect(0,0,960,540);
 const movement=reduced.checked||cinematic?0:Math.sin(t*.7)*loss*3;
 g.translate(movement,0);
 // Distort the scene, never the independent note/control layers.
 g.filter='blur('+(loss*2.2)+'px) saturate('+(1-loss*.25)+')';
 if(im.complete&&im.naturalWidth)g.drawImage(im,-8,-4,976,549);
 else{g.fillStyle='#211b30';g.fillRect(-8,0,976,540);person(730,325,'#F3E8D2');}
 g.fillStyle='rgba(64,30,106,'+(loss*.18)+')';g.fillRect(-8,0,976,540);
 if(!reduced.checked&&state==='Stage Failed'){g.fillStyle='rgba(14,16,32,.6)';g.fillRect(-8,0,976,540);}
 g.restore();
 // Scene cues never move, hide or alter the independent arrow layer.
 if(state==='Playing'&&im.complete&&im.naturalWidth){
  if(sceneStage===1){
   const pulse=reduced.checked?0:.035*(1+Math.cos(t*bpm()/60*Math.PI*2));
   [[378,111],[475,200],[521,244]].forEach(([x,y],i)=>{
    if(run.hits<(i+1)*3)return;
    const depth=[265,145,100][i],spread=[68,37,24][i];
    g.save();g.translate(movement,0);g.filter='blur(7px)';
    const beam=g.createLinearGradient(x,y,x,y+depth);
    beam.addColorStop(0,'rgba(255,206,139,'+(.13+pulse)+')');
    beam.addColorStop(.55,'rgba(255,185,103,'+(.045+pulse*.4)+')');
    beam.addColorStop(1,'rgba(255,185,103,0)');
    g.fillStyle=beam;g.beginPath();g.moveTo(x-7,y+2);g.lineTo(x+7,y+2);
    g.lineTo(x+spread,y+depth);g.quadraticCurveTo(x,y+depth+12,x-spread,y+depth);g.closePath();g.fill();g.restore();
   });
  }
  if(sceneStage===2){
   const recent=Math.max(...laneFlash)>ctx.currentTime;
   g.save();g.beginPath();g.ellipse(161,315,38,43,0,0,Math.PI*2);g.clip();
   g.filter='blur('+(recent?2:7)+'px)';g.drawImage(im,-8,-4,976,549);g.restore();
  }
 }
 if(lost){const age=ctx.currentTime-endingStart;const fade=age<5?Math.max(0,age-4):Math.max(0,6-age);g.fillStyle='rgba(14,16,32,'+fade+')';g.fillRect(0,0,960,540);}
}

function draw(t){
 g.clearRect(0,0,960,540);scenery(t);
 // Everything below is outside the scenery filter and transform.
 const playing=['Playing','Stage Failed'].includes(state)||state==='Paused'&&prior==='Playing';
 if(!playing){$('clarity-number').textContent=run.clarity;return;}
 for(let side=0;side<2;side++){
  const start=side?660:90;g.fillStyle='rgba(40,48,65,.94)';g.fillRect(start-30,35,240,228);g.strokeStyle='#697487';g.lineWidth=1;g.strokeRect(start-30,35,240,228);
  g.fillStyle='#F3E8D2';g.font='13px sans-serif';g.fillText(side?'YOU · MATCH THE ARROWS':run.stage?C.stages[run.stage-1].caller.toUpperCase():'LISTEN · WATCH',start-12,25);
  for(let lane=0;lane<4;lane++){
   const x=start+lane*60;g.strokeStyle='#353247';g.setLineDash([3,9]);g.beginPath();g.moveTo(x,100);g.lineTo(x,260);g.stroke();g.setLineDash([]);
   arrow(x,82,lane,false);
   if(ctx && side && laneFlash[lane]>ctx.currentTime){
    const progress=1-(laneFlash[lane]-ctx.currentTime)/.32;
    g.save();g.globalAlpha=1-progress;
    g.shadowColor=colors[lane];g.shadowBlur=reduced.checked?0:16*(1-progress);
    arrow(x,82,lane,true,reduced.checked?21:21+4*Math.sin(progress*Math.PI));
    if(!reduced.checked){
     // Arrow-shaped echoes and directional sparks expand from the target.
     g.globalAlpha=(1-progress)*.65;arrow(x,82,lane,false,23+progress*20);
     g.translate(x,82);g.rotate(angles[lane]);g.strokeStyle=colors[lane];g.lineWidth=2;
     for(const sign of [-1,1]){g.beginPath();g.moveTo(sign*(22+progress*15),-8-progress*10);g.lineTo(sign*(26+progress*22),-17-progress*14);g.stroke();}
    }
    g.restore();
   }else if(ctx&&!side&&notes.some(n=>n.side==='caller'&&n.lane===lane&&Math.abs(R.seconds(n.beat,bpm())-t)<.16)){g.save();g.globalAlpha=.65;arrow(x,82,lane,true,21);g.restore();}
  }
 }
 if(playing){
  g.save();g.beginPath();g.rect(0,38,960,232);g.clip();
  for(const n of notes){
   const dt=R.seconds(n.beat,bpm())-t;if(n.done||dt>1.5||dt<-.22&&!n.holding)continue;
   const x=(n.side==='player'?660:90)+n.lane*60;
   let y=82+dt*128;
   if(n.hold){const end=82+(R.seconds(n.beat+n.hold,bpm())-t)*128;g.strokeStyle=colors[n.lane];g.lineWidth=9;g.beginPath();g.moveTo(x,n.holding?82:y);g.lineTo(x,end);g.stroke();}
   if(n.holding)y=82;arrow(x,y,n.lane,true);
  }g.restore();
 }
 const eye=320+run.clarity*3.2;g.fillStyle='#7A4CFF';g.fillRect(320,494,160,10);g.fillStyle='#FF9A3C';g.fillRect(480,494,160,10);
 g.fillStyle='#F3E8D2';g.font='16px sans-serif';g.fillText('Lost',265,505);g.fillText('Clear',658,505);
 g.beginPath();g.moveTo(eye-15,499);g.quadraticCurveTo(eye,478,eye+15,499);g.quadraticCurveTo(eye,520,eye-15,499);g.fillStyle='#0E1020';g.fill();g.strokeStyle='#F3E8D2';g.lineWidth=2;g.stroke();g.beginPath();g.arc(eye,499,4,0,Math.PI*2);g.fillStyle='#F3E8D2';g.fill();
 if(state==='Playing'&&t<0){g.fillStyle='#FF9A3C';g.font='bold 40px sans-serif';g.fillText(String(Math.ceil(-t)),463,295);}
 $('clarity-number').textContent=run.clarity;$('judgment').textContent=lastJudgment||'Hit every arrow · Hold the tails';
 $('progress').textContent='Chapter '+run.stage+' · '+Math.min(100,Math.max(0,Math.floor(t/(C.stages[run.stage-1].end-C.stages[run.stage-1].start)*100)))+'% · Combo '+run.combo;
 $('journey-fill').style.width=Math.min(100,Math.max(0,t/(C.stages[run.stage-1].end-C.stages[run.stage-1].start)*100))+'%';
}
$('main-action').addEventListener('click',()=>mainAction?.());
$('back-action').addEventListener('click',ready);

$('pause').addEventListener('click',()=>state==='Paused'?resume():pause());
$('restart').addEventListener('click',restart);
$('offset').addEventListener('input',()=>{$('offset-value').textContent=$('offset').value+' ms';});
$('volume').addEventListener('input',()=>{if(bus)bus.gain.setTargetAtTime(Number($('volume').value)/100,ctx.currentTime,.03);});
document.querySelectorAll('[data-lane]').forEach(pad=>{
 const lane=Number(pad.dataset.lane);
 pad.addEventListener('pointerdown',e=>{e.preventDefault();pad.setPointerCapture(e.pointerId);press(lane,'pointer'+e.pointerId,e.timeStamp);});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])pad.addEventListener(event,e=>release('pointer'+e.pointerId,e.timeStamp));
 pad.addEventListener('keydown',e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();if(!e.repeat)press(lane,'pad'+lane,e.timeStamp);}});
 pad.addEventListener('keyup',e=>{if([' ','Enter'].includes(e.key))release('pad'+lane,e.timeStamp);});
});
window.addEventListener('keydown',e=>{
 if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.ctrlKey||e.metaKey||e.altKey)return;
 const key=e.key.length===1?e.key.toLowerCase():e.key;
 if(key in keys){if(['Playing','Paused','Clear Ending'].includes(state))e.preventDefault();if(!e.repeat)press(keys[key],key,e.timeStamp);}
 else if(!e.repeat&&(key==='p'||key==='Escape')){if(state==='Paused')resume();else pause();}
 else if(!e.repeat&&key==='r'&&!$('restart').disabled)restart();
});
window.addEventListener('keyup',e=>release(e.key.length===1?e.key.toLowerCase():e.key,e.timeStamp));
window.addEventListener('blur',()=>pause('The window lost focus.'));
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause('The tab was hidden.');});
window.addEventListener('pagehide',()=>{++generation;stopSound(true);ctx?.suspend();});
ready();requestAnimationFrame(tick);
})();
