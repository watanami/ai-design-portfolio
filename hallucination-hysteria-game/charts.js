(function (root) {
'use strict';
const stages=[
 {name:'The street',caller:'Streetlights',bpm:91,start:21.13,end:84.43,bars:24,file:'dream-aeterna.mp3',intro:'Copy the lights. Solid arrows are yours; let hollow, dashed arrows pass.',complete:'The street is behind you. The next voice is stranger. Start when you are ready.'},
 {name:'The Stranger',caller:'The Stranger',bpm:91,start:.03,end:63.33,bars:24,file:'the-other-place.mp3',intro:'The Stranger appears. Follow visible arrows and hold each tail to its end.',complete:'The bus never comes. The Stranger points up the street toward home. Start when you are ready.'},
 {name:'Your room',caller:'The Reflection',bpm:115,start:108.55,end:175.33,bars:32,file:'acid-trance.mp3',intro:'Face the Reflection. Longer phrases; the same clear arrows. No ghost notes.'}
];
function pair(notes,at,pattern,response){
 pattern.forEach(([offset,lane,hold=0])=>{
  notes.push({beat:at+offset,lane,hold,side:'caller'});
  notes.push({beat:at+response+offset,lane,hold,side:'player'});
 });
}
function chart(stage){
 const notes=[];
 if(stage===1){
  for(let bar=0;bar<24;bar+=2){
   const p=bar<4?[[0,bar%4],[2,(bar+1)%4]]:[0,1,2,3].map(b=>[b,(bar+b)%4]);
   pair(notes,bar*4,p,4);
  }
 }else if(stage===2){
  for(let beat=16;beat<96;beat+=8){
   const turn=(beat-16)/8;
   const p=turn%2?[[0,(turn+3)%4,2],[2,(turn+1)%4],[3,turn%4]]:[[0,turn%4],[1,(turn+2)%4,1],[3,(turn+1)%4]];
   pair(notes,beat,p,4);
  }
 }else{
  pair(notes,0,[[0,0],[2,2]],4);pair(notes,8,[[0,1],[2,3]],4);
  for(let beat=16;beat<128;beat+=16){
   const lane=(beat/16)%4;
   // Final response resolves before the last two-second musical fade.
   const p=beat===112?[[0,lane],[1,(lane+2)%4],[2,(lane+1)%4,1]]:[[0,lane],[1,(lane+2)%4,1],[3,(lane+1)%4],[4,(lane+3)%4,2],[6,(lane+2)%4],[7,lane]];
   pair(notes,beat,p,8);
  }
 }
 const ghostBeats=stage===1?[22.5,38.5,62.5,86.5]:stage===2?[26.5,34.5,50.5,66.5,82.5,90.5]:[];
 ghostBeats.forEach((beat,i)=>{
  for(let k=0;k<4;k++){
   const ghost={beat,lane:(i+k)%4,ghost:true,side:'player',hold:0};
   if(root.HHRules.ghostSafe(ghost,notes)){notes.push(ghost);return;}
  }
  throw Error('No safe ghost slot at '+beat);
 });
 return notes.sort((a,b)=>a.beat-b.beat).map((n,id)=>({...n,id,done:false,holding:false}));
}
root.HHCharts={stages,chart,pair};
if(typeof module!=='undefined')module.exports=root.HHCharts;
})(typeof window==='undefined'?globalThis:window);
