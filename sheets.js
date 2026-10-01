// Shared motion: keep controls usable, preserve state, honour reduced motion.
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
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
 if(!open)return;
 dialog.scrollTop=scroll;
 const next=dialog.getBoundingClientRect().height;
 if(Math.abs(next-height)>2)animate(dialog,[{height:height+'px'},{height:next+'px'}],240);
 const content=dialog.querySelector('form,.modal-blocks,.music-tracks')||dialog.lastElementChild;
 if(content)animate(content,[{opacity:.3},{opacity:1}],160);
}
let installed=false;
export function setupSheets(){
 if(installed)return;installed=true;
 const prototype=HTMLDialogElement.prototype,nativeShow=prototype.showModal,nativeClose=prototype.close;
 const closing=new WeakMap();
 const prepare=dialog=>{
  if(dialog.dataset.motionReady)return;
  dialog.dataset.motionReady='true';
  const side=dialog.id==='profile-sheet',full=dialog.classList.contains('photo-fullscreen');
  if(!side&&!full)dialog.classList.add('bottom-sheet');
  dialog.dataset.sheetMotion=side?'side':full?'full':'bottom';
  let drag=null;
  dialog.addEventListener('cancel',event=>{event.preventDefault();dialog.close();});
  dialog.addEventListener('pointerdown',event=>{
   const grip=dialog.id==='appearance-dialog'?'.sheet-grip':'.dialog-head';
   if(side||full||!event.target.closest(grip)||event.target.closest('button,input,a')||event.button!==0)return;
   motions.get(dialog)?.cancel();drag={y:event.clientY,x:event.clientX,delta:0};dialog.setPointerCapture(event.pointerId);
  });
  dialog.addEventListener('pointermove',event=>{
   if(!drag)return;drag.delta=Math.max(0,event.clientY-drag.y);dialog.style.transform=`translateY(${drag.delta}px)`;
  });
  const release=event=>{
   if(!drag)return;const {delta,x}=drag;drag=null;
   if(event.type!=='pointercancel'&&delta>70&&Math.abs(event.clientX-x)<90){dialog.close();return;}
   dialog.style.transform='';animate(dialog,[{transform:`translateY(${delta}px)`},{transform:'none'}],200);
  };
  dialog.addEventListener('pointerup',release);dialog.addEventListener('pointercancel',release);
  dialog.addEventListener('click',event=>{
   if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();
   if(event.clientY<r.top||event.clientY>r.bottom||event.clientX<r.left||event.clientX>r.right)dialog.close();
  });
 };
 prototype.showModal=function(){
  prepare(this);
  const pending=closing.get(this);
  if(pending){pending.animation?.cancel();closing.delete(this);delete this.dataset.closing;this.style.transform='';}
  if(this.open)return;
  this.style.transform='';nativeShow.call(this);
  const transform=this.dataset.sheetMotion==='side'?'translateX(-100%)':this.dataset.sheetMotion==='full'?'scale(.96)':'translateY(calc(100% + 32px))';
  animate(this,[{opacity:.3,transform},{opacity:1,transform:'none'}],300);
 };
 prototype.close=function(value){
  if(!this.open)return;
  if(closing.has(this))return closing.get(this).done;
  prepare(this);
  if(reduced()){this.style.transform='';nativeClose.call(this,value);return;}
  const start=getComputedStyle(this).transform;
  const transform=this.dataset.sheetMotion==='side'?'translateX(-100%)':this.dataset.sheetMotion==='full'?'scale(.96)':'translateY(calc(100% + 32px))';
  this.dataset.closing='true';
  const token={animation:animate(this,[{opacity:1,transform:start},{opacity:0,transform}],200)};
  closing.set(this,token);
  token.done=token.animation.finished.then(()=>{
   if(closing.get(this)!==token)return;
   closing.delete(this);delete this.dataset.closing;this.style.transform='';nativeClose.call(this,value);
  }).catch(()=>{});
  return token.done;
 };
 document.querySelectorAll('dialog').forEach(prepare);
}
export function confirmSheet(title,description,accept='Fortfahren'){
 return new Promise(resolve=>{const dialog=document.createElement('dialog');dialog.className='bottom-sheet';dialog.innerHTML='<div class="dialog-head"><h2></h2><button class="icon-btn" data-no aria-label="Schließen">×</button></div><p class="sheet-description"></p><div class="sheet-actions"><button class="primary" data-yes></button></div>';dialog.querySelector('h2').textContent=title;dialog.querySelector('p').textContent=description;dialog.querySelector('[data-yes]').textContent=accept;let result=false;dialog.onclick=e=>{if(e.target.closest('[data-yes]')){result=true;dialog.close();}else if(e.target.closest('button'))dialog.close();};dialog.onclose=()=>{dialog.remove();resolve(result);};document.body.append(dialog);dialog.showModal();});
}
