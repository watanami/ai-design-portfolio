/* Audio owns time; requestAnimationFrame only draws and observes it. */
(() => {
'use strict';
const R=HHRules, C=HHCharts, $=id=>document.getElementById(id);
const canvas=$('stage'), g=canvas.getContext('2d');
const colors=['#B79AFF','#2EC4B6','#F3E8D2','#FF9A3C'], angles=[-Math.PI/2,Math.PI,0,Math.PI/2];
const pitches=[220,277.18,329.63,440], keys={ArrowLeft:0,a:0,ArrowDown:1,s:1,ArrowUp:2,w:2,ArrowRight:3,d:3};
let state='Ready', prior='Playing', run=R.fresh(), notes=[];
let ctx=null, bus=null, filter=null, buffer=null, bufferFile='', source=null, sourceGain=null, voices=new Set();
let epoch=0, generation=0, endingStart=0, failAt=0, resumeGrace=-Infinity, frozenTime=0;
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
let sceneStage=1,story=null,storyLine=-1;
const playerName=()=>($('player-name').value.trim()||'Walker');
const storyPages={
 2:[
  {title:'The last bus has already gone.',narration:'You reach the shelter. The timetable says the last bus left at 2:47. Your phone still says 2:47. Someone on the bench turns before you speak.',speaker:'STRANGER',line:()=>playerName()+'. You’re going the wrong way.'},
  {title:'Someone knows the way.',narration:'“How do you know my name?” you ask. The Stranger points past the next streetlight. You can see your building, but the road seems longer than it should.',speaker:'STRANGER',line:()=> 'You’ve passed this stop twice. Home is past that light. Keep your own rhythm. Don’t follow the other footsteps.'}
 ],
 3:[
  {title:'Your key still fits.',narration:'The bus never comes. You follow the Stranger’s gesture and walk the last block. Your door opens. Your keys land where you always leave them. In the mirror, someone looks up before you do.',speaker:'WALKER',line:()=> 'This is my room. So why does it feel as if someone got here first?'},
  {title:'Finish the song.',narration:'You hold still. Your reflection does not. The music in your headphones is the only thing that has stayed predictable all night.',speaker:'REFLECTION',line:()=> 'You made it home. Why are you still listening?'}
 ]
};
const stageLines={
 1:[[0,'WALKER','The bus stop is two blocks away. One step, then another.'],[24,'WALKER','That shop should be behind me. I’ll keep moving.'],[56,'WALKER','The lamps are in time with the music. Or are my steps?'],[80,'WALKER','The shelter. Someone is waiting there.']],
 2:[[0,'STRANGER',()=>playerName()+', don’t wait for the bus. It isn’t coming.'],[24,'WALKER','How did you know where I was going?'],[48,'STRANGER','You look toward that window every time you pass.'],[72,'WALKER','My building. I can see it now.'],[88,'STRANGER','Then go. Keep walking.']],
 3:[[0,'WALKER','My door. My keys. My room.'],[20,'REFLECTION','You came home. Why are you still afraid?'],[48,'WALKER','Because you moved before I did.'],[80,'REFLECTION','Then stop watching me. Finish the song.'],[112,'WALKER','One last phrase. Then I take these off.']]
};
function storyCaption(t){
 if(state!=='Playing')return;
 const rows=stageLines[run.stage],beat=t*bpm()/60;
 const index=Math.max(0,rows.findLastIndex(row=>beat>=row[0]));
 if(index!==storyLine){storyLine=index;const row=rows[index];$('dialogue-speaker').textContent=row[1];$('dialogue-line').textContent=typeof row[2]==='function'?row[2]():row[2];}
}
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
 const cinematic=['Ready','Story','Credits','Clear Ending','Lost Ending'].includes(next==='Paused'?prior:next);
 $('game').classList.toggle('cinematic',cinematic);
 $('story-details').hidden=next!=='Story';
 $('skip-story').hidden=next!=='Story';
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
 sourceGain=ctx.createGain();sourceGain.gain.setValueAtTime(0,when);sourceGain.gain.linearRampToValueAtTime(.8,when+.5);
 if(fadeOut){sourceGain.gain.setValueAtTime(.8,when+duration-2);sourceGain.gain.linearRampToValueAtTime(0,when+duration);}
 source.connect(sourceGain);sourceGain.connect(filter);source.start(when,start,duration);
}
function resetVisuals(){lastJudgment='';slideUntil=0;faceSeen=false;endingStreet=false;laneFlash.fill(0);callFlash.fill(0);$('ending-credits').hidden=true;}
async function startStage(index){
 const token=++generation;const config=C.stages[index-1];stopSound(bufferFile!==config.file);clearInputs();run=R.fresh(index);sceneStage=index;notes=[];story=null;storyLine=-1;resetVisuals();
 setState('Loading');show('Entering '+config.name+'…','Loading this stage’s recording.','Loading',null);
 loadAction=()=>startStage(index);
 try{
  const decoded=await load(config.file);if(token!==generation)return;
  buffer=decoded;bufferFile=config.file;notes=C.chart(index);
  epoch=ctx.currentTime+1.3;filter.frequency.value=20000;
  music(buffer,config.start,epoch,config.end-config.start+(index===3?7:0),index!==3);
  for(const n of notes)if(n.side==='caller')tone(n.lane,epoch+R.seconds(n.beat,config.bpm),'call',.16);
  finalFade=false;
  setState('Playing');hideMessage();$('stage-label').textContent='0'+index+' / '+config.name+' · '+config.bpm+' BPM';
  $('objective').textContent=config.objective;announce(config.intro);$('game').scrollIntoView({block:'start'});
  if(document.hidden || !document.hasFocus())pause('The page lost focus. Resume when ready.');
 }catch(error){if(token!==generation)return;setState('Error');show('The track could not load',error.message+' Check the connection and try again.','Retry',loadAction);}
}
function score(result){
 run.clarity=R.change(run.clarity,result);
 if(result==='Perfect'||result==='Good'){run.hits++;run.combo++;run.bestCombo=Math.max(run.bestCombo,run.combo);tone(pressedLane);faceSeen=true;laneFlash[pressedLane]=ctx.currentTime+.18;}
 if(result==='Miss'){run.combo=0;run.misses++;tone(pressedLane,ctx.currentTime,'miss');slideUntil=ctx.currentTime+.35;}
 lastJudgment=result+(R.delta[result]>0?' +':' ')+(R.delta[result]||'');
 if(run.clarity===0 && state==='Playing'){stopSound();clearInputs();failAt=ctx.currentTime+1.2;setState('Stage Failed');show('The world slips away.','Clarity ran out. This stage will restart; your journey stays here.','Restart Stage',()=>startStage(run.stage));}
}
let pressedLane=0;
function press(lane,id,stamp){
 if(state==='Clear Ending'){credits();return;}
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
function renderStory(){
 const page=storyPages[story.next][story.page],last=story.page===storyPages[story.next].length-1;
 show(page.title,page.narration,last?(story.next===2?'Follow the Stranger':'Face the Reflection'):'Continue',()=>last?startStage(story.next):(story.page++,renderStory()),'Chapter '+story.next+' / '+(story.page+1)+' of 2');
 $('story-speaker').textContent=page.speaker;$('story-line').textContent=page.line();
 $('objective').textContent=C.stages[story.next-1].objective;
}
async function openStory(next){
 const token=++generation;stopSound(true);clearInputs();notes=[];story={next,page:0};sceneStage=next;
 setState('Story');$('stage-label').textContent='Between chapters · '+C.stages[next-1].name;renderStory();$('game').scrollIntoView({block:'start'});
 try{
  const config=C.stages[next-1],decoded=await load(config.file);
  if(token!==generation)return;
  buffer=decoded;bufferFile=config.file;filter.frequency.value=2200;
  source=ctx.createBufferSource();source.buffer=buffer;source.loop=true;source.loopStart=config.start;source.loopEnd=config.start+8;
  sourceGain=ctx.createGain();sourceGain.gain.setValueAtTime(0,ctx.currentTime);sourceGain.gain.linearRampToValueAtTime(.16,ctx.currentTime+1);
  source.connect(sourceGain);sourceGain.connect(filter);source.start(ctx.currentTime,config.start);
 }catch{if(token===generation)announce('The story remains available. Music will retry when you start the next chapter.');}
 if(document.hidden && state==='Story')pause('The tab was hidden.');
}

async function finish(){
 const choice=R.ending(run.clarity);clearInputs();notes=[];endingStart=ctx.currentTime;lostToneBeat=-1;
 setState(choice);
 if(choice==='Lost Ending'){
  filter.frequency.setTargetAtTime(550,ctx.currentTime,.4);
  if(sourceGain){sourceGain.gain.cancelScheduledValues(ctx.currentTime);sourceGain.gain.setValueAtTime(.65,ctx.currentTime);sourceGain.gain.setValueAtTime(.65,ctx.currentTime+3);sourceGain.gain.linearRampToValueAtTime(0,ctx.currentTime+5);}
  show('Was any of it real?','You open your bedroom door and step onto wet pavement. The same shop. The same lamps. 2:47 a.m. Your key is still warm in your hand.','Start Again',credits);
 }else{
  stopSound(true);filter.frequency.value=20000;
  tone(0,ctx.currentTime,'pulse',1.5);
  show('I made it home.','The last note fades. You lower your headphones. For the first time, your reflection waits for you. Pale light crosses the floor. The clock reads 2:48. Outside, a bus passes without stopping.','Play Again',credits);
  const token=++generation;
  try{const decoded=await load('faded-dream.mp3');if(token!==generation || !['Clear Ending','Paused'].includes(state))return;
   buffer=decoded;bufferFile='faded-dream.mp3';music(buffer,0,ctx.currentTime+.15,Math.min(45,buffer.duration),true);
  }catch{if(token===generation)announce('You made it home. The ending music could not load; credits and replay still work.');}
 }
}

function credits(){++generation;stopSound(true);setState('Credits');show('The walk can begin again.','Music and original art credits below.','Play Again',ready);$('ending-credits').hidden=false;$('ending-credits').innerHTML=document.querySelector('#music-credits')?.innerHTML||'';}
function ready(){
 ++generation;stopSound(true);clearInputs();run=R.fresh();notes=[];story=null;sceneStage=1;storyLine=-1;epoch=0;resetVisuals();$('player-name').value='Walker';setState('Ready');
 $('stage-label').textContent='2:47 A.M. · Two blocks from home';$('objective').textContent='Get home before the street stops making sense.';
 show('You know the way home.','You have walked this street a hundred times. Tonight, the same shop keeps appearing ahead of you. Keep the music in your headphones going. Match every arrow to steady your steps and reach the bus stop.','Start the walk',async()=>{try{await unlock();await startStage(1);}catch(e){setState('Error');loadAction=ready;show('Audio could not start',e.message,'Back to title',ready);}},'A familiar route. An unfamiliar night.');
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
 storyCaption(t);draw(t);requestAnimationFrame(tick);
}
function arrow(x,y,lane,fill=true,size=19){
 g.save();g.translate(x,y);g.rotate(angles[lane]);g.beginPath();
 [[0,-size],[-size,0],[-size*.43,0],[-size*.43,size],[size*.43,size],[size*.43,0],[size,0]].forEach(([a,b],i)=>i?g.lineTo(a,b):g.moveTo(a,b));g.closePath();
 g.lineWidth=2;g.strokeStyle=colors[lane];g.setLineDash([]);
 if(fill){g.fillStyle=colors[lane];g.fill();g.strokeStyle='#F3E8D2';}g.stroke();g.restore();
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
 const key=clear?'clear':endingStreet?'street':sceneStage===2?'stop':sceneStage===3?'room':'street';
 const im=sceneImages[key],cinematic=['Ready','Story','Clear Ending','Credits'].includes(visual);
 const loss=cinematic?0:lost?1:(1-run.clarity/100);
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
 if(lost){const age=ctx.currentTime-endingStart;const fade=age<5?Math.max(0,age-4):Math.max(0,6-age);g.fillStyle='rgba(14,16,32,'+fade+')';g.fillRect(0,0,960,540);}
}

function draw(t){
 g.clearRect(0,0,960,540);scenery(t);
 // Everything below is outside the scenery filter and transform.
 const playing=['Playing','Stage Failed'].includes(state)||state==='Paused'&&prior==='Playing';
 if(!playing){$('clarity-number').textContent=run.clarity;return;}
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
$('skip-story').addEventListener('click',()=>{if(story)startStage(story.next);});
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
