// Shared motion: keep controls usable, preserve state, honour reduced motion.
import {spring, sample, releaseVelocity, reducedMotion as reduced} from './motion.js';
const ease='cubic-bezier(.22,1,.36,1)';
const motions=new WeakMap();
function animate(element,frames,duration){
 motions.get(element)?.cancel();
 if(reduced())return null;
 const animation=element.animate(frames,{duration,easing:ease});
 motions.set(element,animation);return animation;
}
export function animateScreen(root,direction='forward'){
 const content=root.querySelector('main')||root;
 const transform=direction==='tab'?'none':`translateX(${direction==='back'?-12:12}px)`;
 animate(content,[{opacity:0,transform},{opacity:1,transform:'none'}],direction==='tab'?160:240);
}
export function animateResize(element,fromHeight){
 animate(element,[{height:fromHeight+'px'},{height:element.getBoundingClientRect().height+'px'}],260);
}
export function refreshSheet(dialog,update){
 const open=dialog.open&&!dialog.dataset.closing,height=dialog.getBoundingClientRect().height,scroll=dialog.scrollTop;
 update();
 prepareContent(dialog);
 if(!open)return;
 dialog.scrollTop=scroll;
 const next=dialog.getBoundingClientRect().height;
 if(Math.abs(next-height)>2)animate(dialog,[{height:height+'px'},{height:next+'px'}],240);
 const content=dialog.querySelector('form,.modal-blocks,.music-tracks')||dialog.lastElementChild;
 if(content)animate(content,[{opacity:.3},{opacity:1}],160);
}
function prepareContent(dialog){
 if(dialog.dataset.sheetMotion==='bottom'&&!dialog.querySelector('.sheet-grip')){
  const grip=document.createElement('div');grip.className='sheet-grip';grip.setAttribute('aria-hidden','true');dialog.prepend(grip);
 }
 const heading=dialog.querySelector('h1,h2');
 if(heading){heading.tabIndex=-1;heading.setAttribute('autofocus','');}
}
let installed=false;
export function setupSheets(){
 if(installed)return;installed=true;
 const prototype=HTMLDialogElement.prototype,nativeShow=prototype.showModal,nativeClose=prototype.close;
 const states=new WeakMap();
 let pageLock=null;
 const lockPage=()=>{
  if(pageLock)return;
  const body=document.body;
  pageLock={x:scrollX,y:scrollY,view:location.hash,style:body.getAttribute('style')};
  body.style.setProperty('--page-lock-top',pageLock.y+'px');
  const gutter=innerWidth-document.documentElement.clientWidth;
  Object.assign(body.style,{position:'fixed',top:-pageLock.y+'px',left:'0',width:'100%',overflow:'hidden'});
  if(gutter)body.style.paddingRight=gutter+'px';
 };
 const unlockPage=()=>{
  if(!pageLock||document.querySelector('dialog[open]'))return;
  const saved=pageLock;pageLock=null;
  if(saved.style===null)document.body.removeAttribute('style');else document.body.setAttribute('style',saved.style);
  const sameView=location.hash===saved.view;
  window.scrollTo({left:sameView?saved.x:0,top:sameView?saved.y:0,behavior:'instant'});
 };
 const updateViewport=()=>{const v=window.visualViewport;document.documentElement.style.setProperty('--sheet-height',(v?.height||innerHeight)+'px');document.documentElement.style.setProperty('--keyboard-bottom',Math.max(0,innerHeight-(v?.height||innerHeight)-(v?.offsetTop||0))+'px');};
 updateViewport();window.visualViewport?.addEventListener('resize',updateViewport);window.visualViewport?.addEventListener('scroll',updateViewport);
 const paint=(dialog,value)=>{const state=states.get(dialog);state.position=value;dialog.style.transform=value===0?'none':state.side?`translateX(${-value}px)`:`translateY(${value}px)`;dialog.style.setProperty('--sheet-shade',String(Math.max(0,1-value/state.size)));};
 const settle=(dialog,to,velocity=0)=>{const state=states.get(dialog);state.motion?.cancel();dialog.dataset.settling='true';const motion=spring({from:state.position,to,velocity,update:value=>paint(dialog,value)});state.motion=motion;motion.finished.then(()=>{if(state.motion===motion)delete dialog.dataset.settling;});return motion.finished;};
 const prepare=dialog=>{
  if(dialog.dataset.motionReady)return;
  dialog.dataset.motionReady='true';
  const side=dialog.id==='profile-sheet',full=dialog.classList.contains('photo-fullscreen');
  if(!side&&!full)dialog.classList.add('bottom-sheet');
  dialog.dataset.sheetMotion=side?'side':full?'full':'bottom';
  states.set(dialog,{side,full,position:0,size:1,motion:null,closing:false});
  prepareContent(dialog);
  new MutationObserver(()=>prepareContent(dialog)).observe(dialog,{childList:true});
  let drag=null;
  dialog.addEventListener('close',unlockPage);
  // Contain single-finger scrolling even on Safari versions with elastic overscroll.
  let touch=null;
  dialog.addEventListener('touchstart',e=>{touch=e.touches.length===1?{x:e.touches[0].clientX,y:e.touches[0].clientY}:null;},{passive:true});
  dialog.addEventListener('touchmove',e=>{
   if(!touch||e.touches.length!==1)return;
   const next=e.touches[0],dx=next.clientX-touch.x,dy=next.clientY-touch.y;touch={x:next.clientX,y:next.clientY};
   if(e.target.closest('.sheet-grip,.dialog-head'))return;
   if(e.target.closest('input,textarea,[contenteditable=true]'))return;
   let canScroll=false;
   for(let scroller=e.target;scroller&&dialog.contains(scroller);scroller=scroller.parentElement){
    if((scroller===dialog||/auto|scroll/.test(getComputedStyle(scroller).overflowY))&&(dy<0?scroller.scrollTop+scroller.clientHeight<scroller.scrollHeight-1:scroller.scrollTop>0)){canScroll=true;break;}
   }
   if(Math.abs(dx)>Math.abs(dy)||!canScroll)e.preventDefault();
  },{passive:false});
  dialog.addEventListener('cancel',event=>{event.preventDefault();dialog.close();});
  dialog.addEventListener('pointerdown',event=>{
   if(side||full||!event.target.closest('.sheet-grip,.dialog-head')||event.target.closest('button,input,a')||event.button!==0)return;
   const state=states.get(dialog);state.motion?.cancel();state.closing=false;delete dialog.dataset.closing;delete dialog.dataset.settling;
   drag={id:event.pointerId,y:event.clientY,x:event.clientX,start:state.position,sampleValue:state.position,sampleTime:performance.now(),velocity:0};dialog.setPointerCapture(event.pointerId);
   dialog.dataset.dragging='true';
  });
  dialog.addEventListener('pointermove',event=>{
   if(!drag||event.pointerId!==drag.id)return;const value=Math.max(0,drag.start+event.clientY-drag.y);sample(drag,value);paint(dialog,value);
  });
  const release=event=>{
   if(!drag||event.pointerId!==drag.id)return;const g=drag,state=states.get(dialog),velocity=releaseVelocity(g);drag=null;delete dialog.dataset.dragging;
   if(dialog.hasPointerCapture(event.pointerId))dialog.releasePointerCapture(event.pointerId);
   if(event.type!=='pointercancel'&&(velocity>.45&&state.position>12||velocity>-.35&&state.position>Math.min(120,state.size*.28))){state.releaseVelocity=velocity;dialog.close();return;}
   settle(dialog,0,velocity);
  };
  dialog.addEventListener('pointerup',release);dialog.addEventListener('pointercancel',release);
  dialog.addEventListener('click',event=>{
   if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();
   if(event.clientY<r.top||event.clientY>r.bottom||event.clientX<r.left||event.clientX>r.right)dialog.close();
  });
 };
 prototype.showModal=function(){
  prepare(this);
  prepareContent(this);const state=states.get(this);
  if(state.closing){state.motion?.cancel();state.closing=false;delete this.dataset.closing;settle(this,0);return;}
  if(this.open)return;
  lockPage();this.style.transform='';nativeShow.call(this);this.querySelector('h1,h2')?.focus({preventScroll:true});
  state.size=(state.side?this.getBoundingClientRect().width:this.getBoundingClientRect().height)+32;
  paint(this,reduced()||state.full?0:state.size);settle(this,0);
 };
 prototype.close=function(value){
  if(!this.open)return;
  prepare(this);
  const state=states.get(this);
  if(reduced()){state.motion?.cancel();state.closing=false;state.releaseVelocity=0;delete this.dataset.closing;delete this.dataset.settling;paint(this,0);nativeClose.call(this,value);return Promise.resolve();}
  if(state.closing)return state.done;state.closing=true;this.dataset.closing='true';
  state.size=(state.side?this.offsetWidth:this.offsetHeight)+32;
  state.done=settle(this,state.full?0:state.size,state.releaseVelocity||0).then(completed=>{
   if(!completed||!state.closing)return;state.closing=false;state.releaseVelocity=0;delete this.dataset.closing;nativeClose.call(this,value);this.style.transform='';this.style.removeProperty('--sheet-shade');
  });return state.done;
 };
 document.querySelectorAll('dialog').forEach(prepare);
}
export function confirmSheet(title,description,accept='Fortfahren'){
 return new Promise(resolve=>{const dialog=document.createElement('dialog');dialog.className='bottom-sheet';dialog.innerHTML='<div class="dialog-head"><h2></h2><button class="icon-btn" data-no aria-label="Schließen">×</button></div><p class="sheet-description"></p><div class="sheet-actions"><button class="primary" data-yes></button></div>';dialog.querySelector('h2').textContent=title;dialog.querySelector('p').textContent=description;dialog.querySelector('[data-yes]').textContent=accept;let result=false;dialog.onclick=e=>{if(e.target.closest('[data-yes]')){result=true;dialog.close();}else if(e.target.closest('button'))dialog.close();};dialog.onclose=()=>{dialog.remove();resolve(result);};document.body.append(dialog);dialog.showModal();});
}
