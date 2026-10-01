// One reveal-then-delete interaction for touch, mouse and keyboard.
export function attachSwipe(root){
 let gesture=null,suppress=false;
 function closeAll(except){root.querySelectorAll('.swipe-item.is-open').forEach(row=>{if(row!==except)setOpen(row,false);});}
 function setOpen(row,open){
  row.classList.toggle('is-open',open);row.style.removeProperty('--swipe-x');
  row.querySelector('.swipe-delete').tabIndex=open?0:-1;
  row.querySelector('.swipe-delete').setAttribute('aria-hidden',String(!open));

 }
 root.addEventListener('pointerdown',e=>{
  const row=e.target.closest('.swipe-item');if(!row||e.button!==0||e.target.closest('.swipe-delete,.row-delete-access,input,textarea,[data-drag]'))return;
  gesture={row,x:e.clientX,y:e.clientY,id:e.pointerId,offset:row.classList.contains('is-open')?-80:0,horizontal:false};
 });
 root.addEventListener('pointermove',e=>{
  if(!gesture||e.pointerId!==gesture.id)return;
  const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;
  if(!gesture.horizontal){if(Math.abs(dy)>10&&Math.abs(dy)>Math.abs(dx)){gesture=null;return;}if(Math.abs(dx)<12||Math.abs(dx)<Math.abs(dy)*1.3)return;gesture.horizontal=true;closeAll(gesture.row);gesture.row.setPointerCapture(e.pointerId);}
  gesture.row.style.setProperty('--swipe-x',Math.max(-80,Math.min(0,gesture.offset+dx))+'px');
 });
 function finish(e){if(!gesture)return;const g=gesture;gesture=null;if(g.horizontal){setOpen(g.row,e.type!=='pointercancel'&&g.offset+e.clientX-g.x<-32);suppress=true;setTimeout(()=>suppress=false,0);}}
 root.addEventListener('pointerup',finish);root.addEventListener('pointercancel',finish);
 root.addEventListener('click',e=>{
  const row=e.target.closest('.swipe-item');
  if(suppress){e.preventDefault();e.stopImmediatePropagation();return;}
  if(row?.classList.contains('is-open')&&!e.target.closest('.swipe-delete,.row-delete-access')){setOpen(row,false);e.preventDefault();e.stopImmediatePropagation();}
  else if(!row)closeAll();
 },true);
 root.addEventListener('keydown',e=>{if(e.key==='Escape')closeAll();});
}
