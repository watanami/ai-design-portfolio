(function(root){
'use strict';
const stages=[
{name:'The street',caller:'Streetlights',bpm:91,start:21.13,end:84.43,bars:24,file:'dream-aeterna.mp3',objective:'Reach the bus stop. Keep your footsteps steady.',intro:'You know the way home. Follow the arrows while the street changes around you.'},
{name:'The Stranger',caller:'The Stranger',bpm:91,start:.03,end:63.33,bars:24,file:'the-other-place.mp3',objective:'Follow the directions. Hold on to your own rhythm.',intro:'The Stranger knows your name. Answer the visible patterns; hold long notes through their tails.'},
{name:'Your room',caller:'The Reflection',bpm:115,start:108.55,end:175.33,bars:32,file:'acid-trance.mp3',objective:'Finish the song. Make the room feel like yours.',intro:'Your key worked. Your reflection moved first. Stay with the arrows.'}
];
function chart(stage){
const notes=[],s=stages[stage-1],last=stage===3?123:94;
for(let bar=0;bar<s.bars;bar++){
let offsets=stage===1?(bar<4?[0,1,2,3]:bar<10?[0,1,2,3,3.5]:[0,1,1.5,2,3,3.5]):stage===2?[0,.5,1,2,2.5,3,3.5]:bar<4?[0,1,2,3]:[0,.5,1,1.5,2,2.5,3,3.5];
if(bar%4===3)offsets=offsets.filter(o=>o<3);
offsets.forEach((off,j)=>{
 const beat=bar*4+off;if(beat<1||beat>last)return;
 let lane=(bar*3+j*(stage===1?1:3)+Math.floor(bar/3))%4;
 const hold=stage>1&&bar%2===0&&off===1?(stage===3?1:bar%4===0?2:1):0;
 if(beat+hold>last)return;
 for(let attempt=0;attempt<4;attempt++){
 if(!notes.some(n=>n.side==='player'&&n.lane===lane&&beat<=n.beat+(n.hold||0)+.18))break;
 lane=(lane+1)%4;
 }
 if(notes.some(n=>n.side==='player'&&n.lane===lane&&beat<=n.beat+(n.hold||0)+.18))return;
 notes.push({beat,lane,hold,side:'player'});
 if(j%2===0&&beat>=2)notes.push({beat:beat-2,lane,hold:0,side:'caller'});
});
}
return notes.sort((a,b)=>a.beat-b.beat).map((n,id)=>({...n,id,done:false,holding:false}));
}
root.HHCharts={stages,chart};if(typeof module!=='undefined')module.exports=root.HHCharts;
})(typeof window==='undefined'?globalThis:window);
