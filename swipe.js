// One reveal-then-delete interaction for touch, mouse and keyboard.
import {spring,sample,releaseVelocity} from './motion.js';
export function attachSwipe(root){
 let gesture=null,suppressUntil=0;const states=new WeakMap();
 function stateFor(row){if(!states.has(row))states.set(row,{position:0,motion:null});return states.get(row);}
 function paint(row,value){stateFor(row).position=value;row.style.setProperty('--swipe-x',value+'px');}
 function closeAll(except){root.querySelectorAll('.swipe-item.is-open').forEach(row=>{if(row!==except)setOpen(row,false);});}
 function setOpen(row,open,velocity=0){
  const state=stateFor(row);state.motion?.cancel();row.classList.toggle('is-open',open);
  row.querySelector('.swipe-delete').tabIndex=open?0:-1;
  row.querySelector('.swipe-delete').setAttribute('aria-hidden',String(!open));
  state.motion=spring({from:state.position,to:open?-80:0,velocity,update:value=>paint(row,value)});state.motion.finished.then(done=>{if(done)row.style.removeProperty('--swipe-x');});
 }
 root.addEventListener('pointerdown',e=>{
  suppressUntil=0;
  const row=e.target.closest('.swipe-item');if(!row||e.button!==0||e.target.closest('.swipe-delete,.row-delete-access,input,textarea,[data-drag]'))return;
  const state=stateFor(row);state.motion?.cancel();gesture={row,x:e.clientX,y:e.clientY,id:e.pointerId,offset:state.position,horizontal:false,sampleValue:state.position,sampleTime:performance.now(),velocity:0};
 });
 root.addEventListener('pointermove',e=>{
  if(!gesture||e.pointerId!==gesture.id)return;
  const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;
  if(!gesture.horizontal){if(Math.abs(dy)>10&&Math.abs(dy)>Math.abs(dx)){setOpen(gesture.row,gesture.row.classList.contains('is-open'));gesture=null;return;}if(Math.abs(dx)<8||Math.abs(dx)<Math.abs(dy)*1.3)return;gesture.horizontal=true;closeAll(gesture.row);gesture.row.setPointerCapture(e.pointerId);}
  e.preventDefault();const value=Math.max(-80,Math.min(0,gesture.offset+dx));sample(gesture,value);paint(gesture.row,value);
 });
 function finish(e){if(!gesture||gesture.id!==e.pointerId)return;const g=gesture;gesture=null;if(g.row.hasPointerCapture(e.pointerId))g.row.releasePointerCapture(e.pointerId);if(g.horizontal){const velocity=releaseVelocity(g);setOpen(g.row,e.type==='pointercancel'?g.row.classList.contains('is-open'):Math.abs(velocity)>.35?velocity<0:stateFor(g.row).position<-36,velocity);suppressUntil=performance.now()+350;}else setOpen(g.row,g.row.classList.contains('is-open'));}
 root.addEventListener('pointerup',finish);root.addEventListener('pointercancel',finish);
 root.addEventListener('click',e=>{
  const row=e.target.closest('.swipe-item');
  if(performance.now()<suppressUntil){e.preventDefault();e.stopImmediatePropagation();return;}
  if(row?.classList.contains('is-open')&&!e.target.closest('.swipe-delete,.row-delete-access')){setOpen(row,false);e.preventDefault();e.stopImmediatePropagation();}
  else if(!row)closeAll();
 },true);
 root.addEventListener('keydown',e=>{if(e.key==='Escape')closeAll();});
}
