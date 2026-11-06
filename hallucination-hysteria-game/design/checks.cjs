/* Run with node design/checks.cjs. No browser or production debug controls. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..'),R=require(root+'/rules.js'),C=require(root+'/charts.js');
let passed=0;function test(name,fn){fn();console.log('PASS '+name);passed++;}
test('Perfect +3; Good +2; miss -6; ghost -8; empty/pass unchanged',()=>{
 assert.equal(R.change(50,'Perfect'),53);assert.equal(R.change(50,'Good'),52);assert.equal(R.change(50,'Miss'),44);assert.equal(R.change(50,'Ghost'),42);assert.equal(R.change(50,'Pass'),50);
 assert.equal(R.judge(.06),'Perfect');assert.equal(R.judge(.11),'Good');assert.equal(R.judge(.15),'Miss');assert.equal(R.judge(.151),null);
 const ghost={side:'player',beat:2,ghost:true};assert.equal(R.expire(ghost,2,91),'Pass');assert.equal(R.expire(ghost,3,91),null);
 assert.equal(R.press(C.chart(1),0,-10,91),undefined);
});
test('Ghost counts 4 / 6 / 0, no head or hold-tail conflicts',()=>{
 [4,6,0].forEach((count,i)=>{const n=C.chart(i+1),ghosts=n.filter(n=>n.ghost);assert.equal(ghosts.length,count);ghosts.forEach(g=>assert.ok(R.ghostSafe(g,n)));
  const real=n.filter(n=>n.side==='player'&&!n.ghost);
  for(const a of real)for(const b of real)if(a!==b&&a.lane===b.lane)assert.ok(b.beat<=a.beat||b.beat>a.beat+(a.hold||0));});
});
test('All stage charts use exact audio-clock beats; endpoints round by <4 ms',()=>{
 C.stages.forEach((s,i)=>{
  for(const n of C.chart(i+1)){const t=n.beat*60/s.bpm;assert.ok(Math.abs(R.songTime(200+t+.035,200,.035,0)-t)<1e-12);assert.ok(t+(n.hold||0)*60/s.bpm+.15<s.end-s.start);}
  assert.ok(Math.abs(s.bars*4*60/s.bpm-(s.end-s.start))<.004);
 });
 assert.ok(Math.min(...C.chart(2).filter(n=>n.side==='player').map(n=>n.beat*60/91))>=10.58);
 assert.ok(Math.abs(108.55+16*60/115-116.90)<.003);
 assert.ok(Math.abs(R.songTime(10,1,.04,200)-8.76)<1e-12);
});
test('Holds reward +2 once, release early misses once; ending threshold',()=>{
 let n={beat:2,hold:2,holding:true};assert.equal(R.release(n,2*60/91+.3,91),'Miss');assert.equal(R.release(n,10,91),null);
 n={beat:2,hold:2,holding:true};assert.equal(R.release(n,4*60/91,91),'Hold');
 assert.equal(R.ending(50),'Lost Ending');assert.equal(R.ending(51),'Clear Ending');
});
const elements=new Map(),events={},windowEvents={},sources=[],oscillators=[];
function el(id){if(!elements.has(id))elements.set(id,{id,value:id==='volume'?'55':id==='offset'?'0':id==='player-name'?'Micah':'',checked:false,hidden:false,disabled:false,textContent:'',innerHTML:'credits',dataset:{},classList:{add(){},remove(){}},focus(){},scrollIntoView(){},addEventListener(){}});return elements.get(id);}
const painter=new Proxy({}, {get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
el('stage').getContext=()=>painter;const pads=[0,1,2,3].map(i=>({...el('pad'+i),dataset:{lane:String(i)}}));
const param=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},setTargetAtTime(){},cancelScheduledValues(){}});
function audioNode(){return {gain:param(),frequency:param(),connect(){},disconnect(){},start(...a){this.started=a;},stop(){this.stopped=true;}};}
class Audio{
 constructor(){this.currentTime=0;this.outputLatency=.04;this.state='running';this.destination={};}
 createGain(){return audioNode();}createBiquadFilter(){return audioNode();}
 createOscillator(){const n=audioNode();oscillators.push(n);return n;}
 createBufferSource(){const n=audioNode();sources.push(n);return n;}
 async decodeAudioData(){return {duration:240};}async resume(){this.state='running';}async suspend(){this.state='suspended';}
}
const context={console,AudioContext:Audio,requestAnimationFrame(){},matchMedia:()=>({matches:false}),fetch:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)}),document:{
 hidden:false,hasFocus:()=>true,getElementById:el,
 querySelector:s=>s.includes('data-lane')?pads[Number(s.match(/"(\d)"/)[1])]:el('music-credits'),
 querySelectorAll:()=>pads,addEventListener:(n,f)=>events[n]=f
}};
context.window=context;context.addEventListener=(n,f)=>windowEvents[n]=f;
vm.createContext(context);
for(const f of ['rules.js','charts.js'])vm.runInContext(fs.readFileSync(root+'/'+f,'utf8'),context);
let app=fs.readFileSync(root+'/app.js','utf8').replace('ready();requestAnimationFrame(tick);',`window.check={unlock,opening,startStage,press,release,tick,pause,resume,restart,finish,credits,ready,
 get state(){return state}, get run(){return run}, get notes(){return notes},get ctx(){return ctx},get epoch(){return epoch},get buffer(){return buffer},get action(){return mainAction},
 time(t){ctx.currentTime=epoch+latency()+Number($('offset').value)/1000+t},now};ready();`);
vm.runInContext(app,context);const a=context.check;
(async()=>{
 assert.equal(a.ctx,null);await a.unlock();a.opening();
 for(let i=0;i<4;i++){a.tick();const n=a.notes.find(n=>!n.done);a.time(n.beat*60/91);a.press(n.lane,'test');a.release('test');}
 await new Promise(setImmediate);assert.equal(a.state,'Playing');assert.equal(a.run.stage,1);
 test('Opening requires four hits and initializes Street at 50',()=>assert.equal(a.run.clarity,50));
 await a.startStage(1);
 const tail=a.notes.filter(n=>n.side==='player'&&!n.ghost).slice(-2);
 a.notes.forEach(n=>{if(!tail.includes(n))n.done=true;});a.run.clarity=58;
 for(const n of tail){a.time(n.beat*60/91);a.press(n.lane,'test');a.release('test');}
 a.time(C.stages[0].end-C.stages[0].start+.01);a.tick();
 test('58 + two Perfect =64; stage-complete waits for explicit next',()=>{assert.equal(a.run.clarity,64);assert.equal(a.state,'Stage Complete');a.ctx.currentTime+=100;a.tick();assert.equal(a.run.stage,1);assert.equal(a.state,'Stage Complete');});
 await a.action();assert.equal(a.run.stage,2);assert.equal(a.run.clarity,50);
 a.time(5);const before=a.now(),audioSource=sources.at(-1);a.pause();
 test('Pause suspends the same audio source/clock',()=>{assert.equal(a.ctx.state,'suspended');assert.equal(a.state,'Paused');assert.equal(a.now(),before);assert.ok(!audioSource.stopped);});
 await a.resume();assert.equal(a.now(),before);
 context.document.hidden=true;events.visibilitychange();
 test('Hidden tab pauses; visibility alone never resumes',()=>{assert.equal(a.state,'Paused');context.document.hidden=false;events.visibilitychange();assert.equal(a.state,'Paused');});
 await a.resume();await a.startStage(3);a.run.clarity=6;
 const first=a.notes.find(n=>n.side==='player');a.time(first.beat*60/115+.16);a.tick();
 assert.equal(a.state,'Stage Failed');a.ctx.currentTime+=1.3;a.tick();await new Promise(setImmediate);
 test('Zero clarity retries Stage3 at50, not the opening',()=>{assert.equal(a.run.stage,3);assert.equal(a.run.clarity,50);assert.equal(a.state,'Playing');});
 // Complete a whole chart with heads and tails at their exact times.
 for(let stage=1;stage<=3;stage++){
  await a.startStage(stage);
  const actions=[];
  a.notes.filter(n=>n.side==='player'&&!n.ghost).forEach(n=>{actions.push({t:n.beat*60/C.stages[stage-1].bpm,n,down:true});actions.push({t:(n.beat+(n.hold||.01))*60/C.stages[stage-1].bpm,n,down:false});});
  actions.sort((x,y)=>x.t-y.t);
  for(const e of actions){a.time(e.t);if(e.down)a.press(e.n.lane,'lane'+e.n.lane);else a.release('lane'+e.n.lane);a.tick();}
  a.time(C.stages[stage-1].end-C.stages[stage-1].start+.01);a.tick();await new Promise(setImmediate);
  assert.equal(a.state,stage===3?'Clear Ending':'Stage Complete');
 }
 test('Full synthetic runs: all three real charts can complete, holds and passing ghosts included',()=>assert.equal(a.run.misses,0));
 a.credits();a.action();
 test('Clear -> credits -> Play Again resets to Ready and releases recording',()=>{assert.equal(a.state,'Ready');assert.equal(a.run.stage,0);assert.equal(a.run.clarity,50);assert.equal(a.buffer,null);assert.equal(a.notes.length,0);});
 await a.startStage(3);a.run.clarity=50;await a.finish();assert.equal(a.state,'Lost Ending');a.ctx.currentTime+=5.1;a.tick();a.credits();a.action();
 test('Lost at50 -> street -> credits -> Ready works',()=>{assert.equal(a.state,'Ready');assert.equal(a.buffer,null);});
 console.log(passed+' checks passed. Audio is mocked: this proves logic/scheduling, not audibility or physical latency.');
})().catch(e=>{console.error(e);process.exitCode=1;});
