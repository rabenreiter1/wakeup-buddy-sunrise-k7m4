import { clockLabel,locale,translateUI } from './i18n.js';
import { icon } from './icons.js';
import { escapeHTML as esc } from './richtext.js';
import { unlockAudio, startAlarm, stopAlarm, stopMusic } from './audio.js';
const root=document.createElement('div');root.id='alarm-overlay';root.hidden=true;document.body.append(root);
let session,timer,drag,previousFocus,themeColor;
export function showAlarmDemo(ritual,onStart){
 closeAlarm();unlockAudio();stopMusic();previousFocus=document.activeElement;
 session={ritual:structuredClone(ritual),onStart,phase:'locked'};
 document.body.classList.add('alarm-open');root.hidden=false;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','iPhone-Wecker-Demo');
 const theme=document.querySelector('meta[name="theme-color"]');themeColor=theme?.content;if(theme)theme.content='#080b13';
 document.querySelector('#product-app').inert=true;render();root.querySelector('[data-alarm="close"]').focus({preventScroll:true});timer=setTimeout(ring,1600);
}
function ring(){if(!session)return;clearTimeout(timer);session.phase='ringing';startAlarm(session.ritual.alarm?.tone||'sunrise');render();}
function awake(){if(!session)return;clearTimeout(timer);stopAlarm();session.phase='awake';render();root.querySelector('[data-alarm="unlock"]').focus({preventScroll:true});}
function snooze(){if(!session)return;clearTimeout(timer);stopAlarm();session.phase='snoozed';session.snoozeUntil=Date.now()+9*60*1000;render();timer=setTimeout(ring,9*60*1000);}
function render(){
 if(!session)return;
 const phase=session.phase,label=clockLabel(session.ritual.alarm?.time||'07:00'),period=label.match(/\s*(AM|PM)$/i)?.[1]||'',time=period?label.replace(/\s*(AM|PM)$/i,''):label;
 const date=(session.ritual.demoDate?new Date(session.ritual.demoDate+'T12:00:00'):new Date()).toLocaleDateString(locale(),{weekday:'long',day:'numeric',month:'long'});
 root.innerHTML=`<section class="alarm-phone ${phase}"><header class="alarm-status"><span>Wecker-Demo</span><button data-alarm="close" aria-label="Simulation schließen">${icon('close')}</button></header><div class="alarm-lock">${icon(phase==='awake'?'check':'lock')}</div><p class="alarm-date">${esc(date)}</p><div class="alarm-clock"><span>${esc(time)}</span>${period?`<small>${esc(period)}</small>`:''}</div>
 ${phase==='ringing'?`<div class="alarm-label"><span>${icon('timer')} Wecker</span><h1>${esc(session.ritual.title)}</h1></div><div class="alarm-controls"><button class="alarm-snooze" data-alarm="snooze">Schlummern</button><div class="alarm-stop-track"><span class="alarm-stop-label" aria-hidden="true">Zum Stoppen schieben</span><button class="alarm-stop-thumb" data-alarm="stop" aria-label="Wecker stoppen: nach rechts schieben oder Eingabetaste drücken">${icon('arrow')}</button></div></div>`
 :phase==='awake'?`<button class="alarm-notification" data-alarm="unlock"><span class="alarm-app-icon">${icon('sun')}</span><span><small>WAKEUP BUDDY · JETZT</small><b>Dein Morgen beginnt.</b><span>${esc(session.ritual.title)}</span></span>${icon('arrow')}</button><button class="alarm-unlock" data-alarm="unlock">Zum Öffnen nach oben wischen ${icon('up')}</button>`
 :phase==='snoozed'?`<div class="alarm-snoozed">${icon('timer')}<h1>Schlummern</h1><p>Der Wecker klingelt in 9 Minuten erneut.</p><button data-alarm="ring">Demo vorspulen</button><button data-alarm="awake">Schlummern beenden</button></div>`
 :`<div class="alarm-pending">${icon('timer')}<p>${esc(session.ritual.title)}</p><small>Die Demo klingelt gleich.</small></div>`}<div class="alarm-home-indicator" aria-hidden="true"></div></section>`;
 translateUI(root);
}
function unlock(){
 if(session?.phase!=='awake')return;
 const {onStart,ritual}=session;session.phase='unlocking';root.querySelector('.alarm-phone').classList.add('unlocking');
 timer=setTimeout(()=>{closeAlarm();onStart(ritual);},matchMedia('(prefers-reduced-motion: reduce)').matches?0:300);
}
export function closeAlarm(){
 clearTimeout(timer);stopAlarm();drag=null;session=null;root.hidden=true;root.innerHTML='';document.body.classList.remove('alarm-open');
 const shell=document.querySelector('#product-app');if(shell)shell.inert=false;
 const theme=document.querySelector('meta[name="theme-color"]');if(theme&&themeColor!==undefined)theme.content=themeColor;themeColor=undefined;
 if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});previousFocus=null;
}
root.addEventListener('click',event=>{
 const action=event.target.closest('[data-alarm]')?.dataset.alarm;if(!action)return;
 if(action==='close')closeAlarm();
 if(action==='snooze')snooze();
 if(action==='ring')ring();
 if(action==='awake')awake();
 if(action==='unlock')unlock();
 if(action==='stop'&&event.detail===0)awake();
});
root.addEventListener('pointerdown',event=>{
 if(!session||event.isPrimary===false)return;
 const thumb=event.target.closest('.alarm-stop-thumb');
 if(thumb){event.preventDefault();const track=thumb.parentElement;drag={kind:'stop',id:event.pointerId,x:event.clientX,thumb,travel:track.clientWidth-thumb.offsetWidth-8,dx:0};thumb.setPointerCapture(event.pointerId);thumb.classList.add('dragging');}
 else if(session.phase==='awake'&&!event.target.closest('button')){drag={kind:'unlock',id:event.pointerId,y:event.clientY,dy:0};root.setPointerCapture(event.pointerId);}
});
root.addEventListener('pointermove',event=>{
 if(!drag||drag.id!==event.pointerId)return;
 if(drag.kind==='stop'){drag.dx=Math.min(drag.travel,Math.max(0,event.clientX-drag.x));drag.thumb.style.transform=`translateX(${drag.dx}px)`;root.querySelector('.alarm-stop-label').style.opacity=String(1-drag.dx/drag.travel);}
 else{drag.dy=Math.min(0,event.clientY-drag.y);root.querySelector('.alarm-phone').style.transform=`translateY(${drag.dy*.8}px)`;}
});
function release(cancelled=false){
 if(!drag)return;const d=drag;drag=null;
 if(d.kind==='stop'){d.thumb.classList.remove('dragging');if(!cancelled&&d.dx>=d.travel*.82){awake();return;}d.thumb.style.transform='';const label=root.querySelector('.alarm-stop-label');if(label)label.style.opacity='';}
 else if(!cancelled&&d.dy<-70)unlock();else{const phone=root.querySelector('.alarm-phone');if(phone)phone.style.transform='';}
}
root.addEventListener('pointerup',()=>release());root.addEventListener('pointercancel',()=>release(true));
root.addEventListener('keydown',event=>{
 if(event.target.closest('.alarm-stop-thumb')&&['ArrowRight','End'].includes(event.key)){event.preventDefault();awake();}
 if(event.key==='Tab'){const controls=[...root.querySelectorAll('button:not(:disabled)')];const i=controls.indexOf(document.activeElement);if(event.shiftKey&&i<=0){event.preventDefault();controls.at(-1)?.focus();}else if(!event.shiftKey&&i===controls.length-1){event.preventDefault();controls[0]?.focus();}}
});
document.addEventListener('keydown',event=>{if(session&&event.key==='Escape')closeAlarm();});
document.addEventListener('visibilitychange',()=>{if(session&&document.hidden)closeAlarm();});
