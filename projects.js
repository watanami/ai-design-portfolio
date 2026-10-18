'use strict';
document.querySelectorAll('.comparison').forEach(figure=>{
  const images=figure.querySelector('.comparison-images'), range=figure.querySelector('input[type="range"]');
  const update=()=>{images.style.setProperty('--split',`${range.value}%`);range.setAttribute('aria-valuetext',`${range.value}% Before, ${100-Number(range.value)}% After`);};
  range.addEventListener('input',update);update();
  // Comparison images are a drag surface, not draggable image files.
  images.querySelectorAll('img').forEach(image=>{image.draggable=false;});
  images.addEventListener('dragstart',e=>e.preventDefault());
  let pointer=null;
  const move=e=>{const r=images.getBoundingClientRect();range.value=Math.round(Math.max(0,Math.min(100,(e.clientX-r.left)/r.width*100)));update();};
  images.addEventListener('pointerdown',e=>{if(e.button!==0||!e.isPrimary||pointer!==null)return;e.preventDefault();pointer=e.pointerId;images.setPointerCapture(e.pointerId);move(e);});
  images.addEventListener('pointermove',e=>{if(pointer===e.pointerId)move(e);});
  const end=e=>{if(pointer===e.pointerId){pointer=null;if(images.hasPointerCapture(e.pointerId))images.releasePointerCapture(e.pointerId);}};
  images.addEventListener('pointerup',e=>{if(pointer===e.pointerId)move(e);end(e);});images.addEventListener('pointercancel',end);
  images.addEventListener('lostpointercapture',e=>{if(pointer===e.pointerId)pointer=null;});
});
const video=document.querySelector('#walkthrough');
if(video){
  const status=document.querySelector('#chapter-status');
  let selection=0;
  document.querySelectorAll('[data-time]').forEach(button=>button.addEventListener('click',()=>{
    const request=++selection, time=Number(button.dataset.time);
    const seek=()=>{if(request===selection)video.currentTime=time;};
    if(video.readyState>=1)seek();
    else video.addEventListener('loadedmetadata',seek,{once:true});
    // Call play in the click event so mobile browsers retain the user gesture.
    const playing=video.play();
    if(playing)playing.then(()=>{
      if(request===selection)status.textContent=`Playing: ${button.textContent.trim()}.`;
    }).catch(()=>{
      if(request===selection)status.textContent=`${button.textContent.trim()}. Press the video Play control to watch.`;
    });
  }));
}
