'use strict';
(() => {
 const root=document.querySelector('.hh'), slider=document.querySelector('#clarity'), title=document.querySelector('#proposal-title'), art=document.querySelector('#art-effects');
 root.classList.add('js-enabled');slider.disabled=false;
 const reduce=matchMedia('(prefers-reduced-motion: reduce)');
 const svg=document.querySelector('#hero-art'), ns='http://www.w3.org/2000/svg';
 const filter=document.createElementNS(ns,'filter');filter.id='clarity-warp';filter.setAttribute('x','-10%');filter.setAttribute('y','-10%');filter.setAttribute('width','120%');filter.setAttribute('height','120%');
 const noise=document.createElementNS(ns,'feTurbulence');noise.setAttribute('type','fractalNoise');noise.setAttribute('baseFrequency','.012');noise.setAttribute('numOctaves','2');noise.setAttribute('seed','4');noise.setAttribute('result','noise');
 const displacement=document.createElementNS(ns,'feDisplacementMap');displacement.setAttribute('in','SourceGraphic');displacement.setAttribute('in2','noise');displacement.setAttribute('xChannelSelector','R');displacement.setAttribute('yChannelSelector','G');filter.append(noise,displacement);svg.querySelector('defs').append(filter);
 let context,lowpass,gain,active=null,previewTimer=null,request=0;
 const toggle=document.querySelector('#sound-toggle'), status=document.querySelectorAll('.track-status');
 const buttons=[...document.querySelectorAll('.track-play')];
 const updateClarity=()=>{const v=Number(slider.value),loss=(100-v)/100;root.style.setProperty('--loss',loss);document.querySelector('#clarity-value').textContent=v+'%';slider.setAttribute('aria-valuetext',`Clarity ${v}%: ${v===100?'clear':v===0?'hallucinating':v===50?'half-hallucinated':v<50?'toward hallucinating':'toward clear'}`);art.style.filter=`blur(${v>=50?(100-v)*.04:2+(50-v)*.08}px) saturate(${1-loss*.7})`;svg.style.filter=reduce.matches?'none':'url(#clarity-warp)';displacement.setAttribute('scale',String(loss*18));document.querySelector('#hero-ghost').setAttribute('opacity',String(loss*.55));title.classList.toggle('title-lost',v<30&&!reduce.matches);if(lowpass)lowpass.frequency.setTargetAtTime(350+Math.pow(v/100,2)*19650,context.currentTime,.06);};
 const notesToggle=document.querySelector('#notes-toggle');notesToggle.disabled=false;notesToggle.addEventListener('click',()=>{const paused=root.classList.toggle('notes-paused');notesToggle.textContent=paused?'Resume notes':'Pause notes';notesToggle.setAttribute('aria-pressed',String(paused));});
 slider.addEventListener('input',updateClarity);reduce.addEventListener('change',updateClarity);updateClarity();
 // No audio context, media load, or play call happens before an explicit click.
 function setSound(on){toggle.textContent=`Sound: ${on?'on':'off'}`;toggle.setAttribute('aria-pressed',String(on));}
 let source=null,progressTimer=null;
 function stop(){++request;clearTimeout(previewTimer);clearInterval(progressTimer);previewTimer=null;if(source){source.onended=null;try{source.stop();}catch{}source.disconnect();source=null;}active=null;buttons.forEach(b=>{b.textContent='Play preview · 30 s';b.setAttribute('aria-pressed','false');b.setAttribute('aria-label',`Play preview · 30 s — ${b.closest('article').querySelector('h4').textContent}`);});status.forEach(n=>n.textContent='');if(gain){gain.gain.cancelScheduledValues(context.currentTime);gain.gain.setValueAtTime(0,context.currentTime);}}
 toggle.disabled=false;toggle.addEventListener('click',()=>{const on=toggle.getAttribute('aria-pressed')!=='true';if(!on)stop();setSound(on);});
 const buffers=new Map();
 buttons.forEach(button=>{const audio=document.querySelector('#audio-'+button.dataset.track),card=button.closest('article'),note=card.querySelector('.track-status');button.disabled=false;
  button.addEventListener('click',async()=>{
   if(active===audio){stop();return;}
   stop();const id=request;active=audio;setSound(true);note.textContent='Loading preview…';
   try{
    if(!context){context=new (window.AudioContext||window.webkitAudioContext)();lowpass=context.createBiquadFilter();lowpass.type='lowpass';gain=context.createGain();gain.gain.value=0;lowpass.connect(gain);gain.connect(context.destination);updateClarity();}
    await context.resume();if(id!==request)return;
    // Decode only after a play gesture. Buffer offsets work even on servers without byte-range seeking.
    if(!buffers.has(audio.src)){const response=await fetch(audio.src);if(!response.ok)throw new Error('missing');buffers.set(audio.src,await context.decodeAudioData(await response.arrayBuffer()));}
    if(id!==request)return;
    const buffer=buffers.get(audio.src),duration=Math.min(30,buffer.duration-20);if(duration<=0)throw new Error('short');
    source=context.createBufferSource();source.buffer=buffer;source.connect(lowpass);
    const start=context.currentTime;gain.gain.cancelScheduledValues(start);gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(1,start+1);gain.gain.setValueAtTime(1,start+duration-1);gain.gain.linearRampToValueAtTime(0,start+duration);
    source.onended=()=>{if(id===request)stop();};source.start(start,20,duration);
    button.textContent='Pause preview';button.setAttribute('aria-pressed','true');button.setAttribute('aria-label',`Pause preview — ${card.querySelector('h4').textContent}`);
    note.textContent='30-second preview · 0:20–0:50';
    previewTimer=setTimeout(()=>{if(id===request)stop();},duration*1000+100);
   }catch(error){if(id===request){stop();setSound(false);note.textContent=error.message==='missing'?'Preview file not added yet.':'Playback unavailable. Press play to try again.';if(error.message==='missing')button.disabled=true;}}
  });
 });
 const links=[...document.querySelectorAll('.section-nav nav a')];
 const sections=links.map(a=>document.querySelector(a.hash));
 const header=document.querySelector('.portfolio-header'),sectionNav=document.querySelector('.section-nav');
 let scrollFrame=0;
 function updateNavigation(){
  const headerHeight=header.getBoundingClientRect().height,navHeight=sectionNav.getBoundingClientRect().height;
  root.style.setProperty('--portfolio-height',`${headerHeight}px`);root.style.setProperty('--section-nav-height',`${navHeight}px`);
  const line=headerHeight+(innerWidth<=900?navHeight:0)+28;
  let current=sections[0];for(const section of sections){if(section.getBoundingClientRect().top<=line)current=section;}
  if(sections[0].getBoundingClientRect().top>innerHeight)current=null;
  links.forEach(link=>{if(current&&link.hash==='#'+current.id)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');});
 }
 const scheduleNavigation=()=>{if(!scrollFrame)scrollFrame=requestAnimationFrame(()=>{scrollFrame=0;updateNavigation();});};
 if('IntersectionObserver' in window){const observer=new IntersectionObserver(scheduleNavigation,{rootMargin:'-15% 0px -60% 0px',threshold:0});sections.forEach(s=>observer.observe(s));}
 window.addEventListener('scroll',scheduleNavigation,{passive:true});window.addEventListener('resize',scheduleNavigation);
 if('ResizeObserver' in window){const observer=new ResizeObserver(scheduleNavigation);observer.observe(header);observer.observe(sectionNav);}
 links.forEach(link=>link.addEventListener('click',()=>requestAnimationFrame(scheduleNavigation)));updateNavigation();
 document.querySelectorAll('.fnf-figure img').forEach(img=>{const fallback=()=>{const box=document.createElement('div');box.className='missing-image';box.textContent=`Missing image: ${img.getAttribute('src').split('/').pop()}`;box.setAttribute('role','img');box.setAttribute('aria-label',img.alt);img.replaceWith(box);};img.addEventListener('error',fallback,{once:true});if(img.complete&&!img.naturalWidth)fallback();});
 window.addEventListener('pagehide',stop);
})();
