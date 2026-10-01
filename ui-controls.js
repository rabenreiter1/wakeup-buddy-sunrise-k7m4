import {escapeHTML as esc} from './richtext.js';
import {spring} from './motion.js';

export function selectField(id,label,options,value){return `<label class="label filter-field" for="${id}">${label}</label><select class="field-input" id="${id}" name="${id}">${options.map(([key,text])=>`<option value="${key}" ${value===key?'selected':''}>${text}</option>`).join('')}</select>`;}
export function choiceField(id,label,options,value){return `<fieldset class="filter-choice"><legend class="label">${label}</legend><input type="hidden" id="${id}" name="${id}" value="${value}"><div class="filter-tabs">${options.map(([key,text])=>`<button type="button" data-filter-field="${id}" data-filter-value="${key}" aria-pressed="${key===value}">${text}</button>`).join('')}</div></fieldset>`;}
export function filterContent({library=false,origin='all',sort='recent',tags=[],topics=[]}){
 return `<form id="shared-filter-form" data-library="${library}">${library?choiceField('library-origin','Sammlung',[['all','Alle'],['own','Selbst erstellt'],['saved','Gemerkt']],origin)+choiceField('library-sort','Sortieren nach',[['recent','Zuletzt hinzugefügt'],['name','A–Z']],sort):choiceField('discover-origin','Von wem?',[['all','Alle'],['team','WB Team'],['community','Community']],origin)+'<h3 class="filter-heading">Themen</h3><div class="tag-picker">'+topics.map(t=>`<button type="button" data-filter-tag="${esc(t)}" aria-pressed="${tags.includes(t)}">#${esc(t)}</button>`).join('')+'</div>'}<button class="primary" type="submit">Anwenden</button></form>`;
}
export const selectionCircle=checked=>`<span class="selection-circle ${checked?'selected':''}" aria-hidden="true"></span>`;
export function timeWheel(time='07:00',hour12=false){
 const [h,m]=time.split(':').map(Number),column=(kind,label,values,index)=>{
  // Equal cycles on either side preserve native momentum through 59 → 00.
  const cycles=Math.max(9,Math.ceil(180/values.length)*2+1),base=Math.floor(cycles/2)*values.length;
  return `<div class="time-wheel-column" data-wheel="${kind}" data-count="${values.length}" data-base="${base}" data-index="${index}" role="spinbutton" aria-label="${label}" aria-valuemin="${kind==='hour'&&hour12?1:0}" aria-valuemax="${values.length-(kind==='hour'&&hour12?0:1)}" aria-valuenow="${kind==='hour'&&hour12?index+1:index}" tabindex="0">${Array.from({length:cycles*values.length},(_,i)=>`<div class="time-wheel-option" data-wheel-index="${i}" aria-hidden="true">${values[i%values.length]}</div>`).join('')}</div>`;
 };
 return `<div class="time-wheel" data-hour12="${hour12}"><input type="hidden" name="time" value="${time}"><div class="time-wheel-highlight" aria-hidden="true"></div>${column('hour','Stunden',Array.from({length:hour12?12:24},(_,i)=>String(hour12?i+1:i).padStart(2,'0')),hour12?(h+11)%12:h)}<span class="time-wheel-colon" aria-hidden="true">:</span>${column('minute','Minuten',Array.from({length:60},(_,i)=>String(i).padStart(2,'0')),m)}${hour12?column('period','Tageshälfte',['AM','PM'],h>=12?1:0):''}</div>`;
}
export function attachTimeWheels(root){
 for(const wheel of root.querySelectorAll('.time-wheel:not([data-ready])')){
  wheel.dataset.ready='true';const input=wheel.querySelector('[name=time]'),columns=[...wheel.querySelectorAll('[data-wheel]')],hour12=wheel.dataset.hour12==='true',row=44;
  const sync=()=>{let h=Number(columns[0].dataset.index);if(hour12)h=(h+1)%12+Number(columns[2].dataset.index)*12;const value=String(h).padStart(2,'0')+':'+String(columns[1].dataset.index).padStart(2,'0');if(input.value!==value){input.value=value;input.dispatchEvent(new Event('change',{bubbles:true}));}};
  const read=col=>{const physical=Math.max(0,Math.min(col.children.length-1,Math.round(col.scrollTop/row))),index=physical%Number(col.dataset.count);col.dataset.index=index;col.setAttribute('aria-valuenow',col.dataset.wheel==='hour'&&hour12?index+1:index);col.setAttribute('aria-valuetext',col.children[physical].textContent);col.querySelector('.is-selected')?.classList.remove('is-selected');col.children[physical].classList.add('is-selected');};
  for(const col of columns){
   col.scrollTop=(Number(col.dataset.base)+Number(col.dataset.index))*row;read(col);
   let idle,touching=false,motion=null,targetIndex=null;
   const recenter=()=>{
    if(touching||mouse||motion||!col.isConnected)return;
    const physical=Math.round(col.scrollTop/row),count=Number(col.dataset.count),base=Number(col.dataset.base);
    // Rebase only after scrolling settles, so iOS momentum is never interrupted.
    col.scrollTo({top:(base+physical%count)*row,behavior:'instant'});read(col);sync();
   };
   const cancelMotion=()=>{motion?.cancel();motion=null;targetIndex=null;col.style.scrollSnapType='';};
   col._flushWheel=()=>{const selected=targetIndex??Math.round(col.scrollTop/row);cancelMotion();clearTimeout(idle);col.scrollTo({top:(Number(col.dataset.base)+selected%Number(col.dataset.count))*row,behavior:'instant'});read(col);};
   const go=index=>{
    cancelMotion();clearTimeout(idle);index=Math.max(0,Math.min(col.children.length-1,index));targetIndex=index;col.style.scrollSnapType='none';
    const next=spring({from:col.scrollTop,to:index*row,update:value=>{col.scrollTop=value;read(col);sync();}});motion=next;
    next.finished.then(done=>{if(motion!==next)return;motion=null;targetIndex=null;col.style.scrollSnapType='';if(done)recenter();});
   };
   col.addEventListener('scroll',()=>{read(col);sync();clearTimeout(idle);idle=setTimeout(recenter,180);},{passive:true});
   col.addEventListener('scrollend',recenter);
   col.addEventListener('touchstart',()=>{cancelMotion();touching=true;clearTimeout(idle);},{passive:true});
   col.addEventListener('wheel',cancelMotion,{passive:true});
   const touchEnd=()=>{touching=false;clearTimeout(idle);idle=setTimeout(recenter,180);};
   col.addEventListener('touchend',touchEnd,{passive:true});col.addEventListener('touchcancel',touchEnd,{passive:true});
   col.addEventListener('keydown',e=>{let next=targetIndex??Math.round(col.scrollTop/row);if(e.key==='ArrowUp')next--;else if(e.key==='ArrowDown')next++;else if(e.key==='Home')next=Number(col.dataset.base);else if(e.key==='End')next=Number(col.dataset.base)+Number(col.dataset.count)-1;else return;e.preventDefault();go(next);});
   let mouse=null,suppress=false;
   col.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse'||e.button!==0)return;cancelMotion();mouse={y:e.clientY,top:col.scrollTop,moved:false,option:e.target.closest('[data-wheel-index]')?.dataset.wheelIndex};col.setPointerCapture(e.pointerId);});
   col.addEventListener('pointermove',e=>{if(!mouse)return;if(Math.abs(e.clientY-mouse.y)>4){mouse.moved=true;col.setPointerCapture(e.pointerId);col.style.scrollSnapType='none';col.scrollTop=mouse.top+mouse.y-e.clientY;}});
   const release=e=>{if(!mouse)return;const {moved,option}=mouse;mouse=null;col.style.scrollSnapType='';if(moved||option!==undefined){suppress=true;setTimeout(()=>suppress=false,0);go(moved?Math.round(col.scrollTop/row):Number(option));}};
   col.addEventListener('pointerup',release);col.addEventListener('pointercancel',release);
   col.addEventListener('click',e=>{const option=e.target.closest('[data-wheel-index]');if(option&&!suppress)go(Number(option.dataset.wheelIndex));});
  }
  wheel.closest('form')._flushTime=()=>{columns.forEach(col=>col._flushWheel());sync();};
 }
}
