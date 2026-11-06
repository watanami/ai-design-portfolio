(function (root) {
  'use strict';
  const stages = [
    {name:'The street', caller:'Streetlights', bpm:91, start:21.13, end:84.43, bars:24, file:'dream-aeterna.mp3', intro:'Copy the lights. Solid arrows are yours; let hollow, dashed arrows pass.', complete:'The street is behind you. The next voice is stranger. Start when you are ready.'}
  ];
  function pair(notes, at, pattern, response) {
    pattern.forEach(([offset,lane,hold=0]) => {
      notes.push({beat:at+offset,lane,hold,side:'caller'});
      notes.push({beat:at+response+offset,lane,hold,side:'player'});
    });
  }
  function chart(stage) {
    const notes = [];
    for(let bar=0;bar<24;bar+=2) {
      const p = bar < 4 ? [[0,bar%4],[2,(bar+1)%4]] : [0,1,2,3].map((b)=>[b,(bar+b)%4]);
      pair(notes,bar*4,p,4);
    }
    [22.5,38.5,62.5,86.5].forEach((beat,i)=>notes.push({beat,lane:(i+2)%4,ghost:true,side:'player',hold:0}));
    return notes.sort((a,b)=>a.beat-b.beat).map((n,id)=>({...n,id,done:false,holding:false}));
  }
  root.HHCharts = {stages,chart,pair};
  if(typeof module!=='undefined') module.exports=root.HHCharts;
})(typeof window==='undefined'?globalThis:window);
