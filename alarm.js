import {unlockAudio,startAlarm,stopAlarm,stopMusic} from './audio.js';
import {lockAppearance,unlockAppearance,setSurfaceColor} from './theme.js';
const root=document.createElement('div');root.id='alarm-overlay';root.hidden=true;document.body.append(root);
let session,drag,previousFocus;
export function showAlarmDemo(ritual,onStart){
 closeAlarm();unlockAudio();stopMusic();previousFocus=document.activeElement;lockAppearance();setSurfaceColor('#000000');
 session={ritual:structuredClone(ritual),onStart};
 document.body.classList.add('alarm-open');root.hidden=false;root.tabIndex=-1;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','Wecker-Demo, 07:00. Wake Up öffnet dein Ritual.');
 root.innerHTML='<section class="alarm-phone"><img class="alarm-reference" src="./assets/alarm-iphone-demo.png" alt="Mornings matter. 07:00. WakeupBuddy." draggable="false"><button class="alarm-wake" data-alarm="wake" aria-label="Wake Up – Ritual starten"></button><div class="alarm-stop-track"><span class="alarm-stop-label" aria-hidden="true">slide to stop</span><button class="alarm-stop-thumb" data-alarm="stop" aria-label="Demo beenden: nach rechts schieben oder Eingabetaste drücken"><span aria-hidden="true"></span></button></div></section>';
 const shell=document.querySelector('#product-app');if(shell)shell.inert=true;
 root.focus({preventScroll:true});startAlarm(session.ritual.alarm?.tone||'sunrise');
}
function wake(){if(!session)return;const {ritual,onStart}=session;closeAlarm();onStart(ritual);}
export function closeAlarm(){
 const active=Boolean(session);stopAlarm();drag=null;session=null;root.hidden=true;root.innerHTML='';document.body.classList.remove('alarm-open');
 if(active){const shell=document.querySelector('#product-app');if(shell)shell.inert=false;unlockAppearance();}
 if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});previousFocus=null;
}
root.addEventListener('click',event=>{const action=event.target.closest('[data-alarm]')?.dataset.alarm;if(action==='wake')wake();if(action==='stop'&&event.detail===0)closeAlarm();});
root.addEventListener('pointerdown',event=>{
 const thumb=event.target.closest('.alarm-stop-thumb');if(!session||!thumb||event.isPrimary===false)return;
 event.preventDefault();const track=thumb.parentElement;drag={id:event.pointerId,x:event.clientX,thumb,track,travel:track.clientWidth-thumb.offsetWidth,dx:0};thumb.setPointerCapture(event.pointerId);
});
root.addEventListener('pointermove',event=>{
 if(!drag||drag.id!==event.pointerId)return;
 drag.dx=Math.min(drag.travel,Math.max(0,event.clientX-drag.x));if(drag.dx>2)drag.track.classList.add('is-dragging');
 drag.thumb.style.transform='translateX('+drag.dx+'px)';drag.track.querySelector('.alarm-stop-label').style.opacity=String(1-drag.dx/drag.travel);
});
function release(cancelled=false){if(!drag)return;const d=drag;drag=null;if(!cancelled&&d.dx>=d.travel*.82){closeAlarm();return;}d.thumb.style.transform='';d.track.classList.remove('is-dragging');d.track.querySelector('.alarm-stop-label').style.opacity='';}
root.addEventListener('pointerup',()=>release());root.addEventListener('pointercancel',()=>release(true));
root.addEventListener('keydown',event=>{
 if(event.target.closest('.alarm-stop-thumb')&&['ArrowRight','End'].includes(event.key)){event.preventDefault();closeAlarm();}
 if(event.key==='Tab'){const controls=[...root.querySelectorAll('button')],i=controls.indexOf(document.activeElement);if(event.shiftKey&&i<=0){event.preventDefault();controls.at(-1)?.focus();}else if(!event.shiftKey&&i===controls.length-1){event.preventDefault();controls[0]?.focus();}}
});
document.addEventListener('keydown',event=>{if(session&&event.key==='Escape')closeAlarm();});
document.addEventListener('visibilitychange',()=>{if(session&&document.hidden)closeAlarm();});
