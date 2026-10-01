import {readState} from './storage.js';
let mode='off',locked=false;
export function scheduledDark(date=new Date()){return date.getHours()<7||date.getHours()>=19;}
export function applyAppearance(date=new Date(),manual=false){
 if(locked&&!manual)return;
 const dark=mode==='on'||mode==='auto'&&scheduledDark(date);
 document.documentElement.dataset.theme=dark?'dark':'light';
 document.documentElement.style.colorScheme=dark?'dark':'light';
 document.querySelector('meta[name=theme-color]')?.setAttribute('content',dark?'#1d1923':'#fffcf7');
 document.dispatchEvent(new Event('appearancechange'));
}
export function setAppearance(value,{manual=false}={}){mode=['off','on','auto'].includes(value)?value:'off';applyAppearance(new Date(),manual);}
export function lockAppearance(){applyAppearance();locked=true;}
export function unlockAppearance(){locked=false;applyAppearance();}
try{setAppearance((await readState('product-v3'))?.profile?.appearance);}catch{applyAppearance();}
setInterval(()=>applyAppearance(),30000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)applyAppearance();});
