import {localPhoto} from './media.js';
import {translateUI} from './i18n.js';
export async function cropPhoto(file){
 const src=await localPhoto(file,1600),image=new Image();image.src=src;await image.decode();
 return new Promise(resolve=>{
  const dialog=document.createElement('dialog');dialog.className='bottom-sheet crop-dialog';dialog.innerHTML='<div class="dialog-head"><h2>Foto zuschneiden</h2><button class="icon-btn" data-crop-cancel aria-label="Schließen">×</button></div><div class="crop-stage" tabindex="0" aria-label="Bildausschnitt verschieben"><canvas width="640" height="640"></canvas></div><label class="crop-zoom">Zoom<input type="range" min="1" max="3" step="0.01" value="1" aria-label="Zoom"></label><div class="sheet-actions"><button class="secondary" data-crop-cancel>Zurück</button><button class="primary" data-crop-save>Übernehmen</button></div>';
  document.body.append(dialog);translateUI(dialog);const canvas=dialog.querySelector('canvas'),ctx=canvas.getContext('2d'),stage=dialog.querySelector('.crop-stage');let zoom=1,x=0,y=0,start,result=null;
  function draw(){dialog.querySelector('input').style.setProperty('--fill',((zoom-1)/2*100)+'%');const scale=Math.max(640/image.width,640/image.height)*zoom,w=image.width*scale,h=image.height*scale;x=Math.max(-(w-640)/2,Math.min((w-640)/2,x));y=Math.max(-(h-640)/2,Math.min((h-640)/2,y));ctx.fillStyle='#fff';ctx.fillRect(0,0,640,640);ctx.drawImage(image,(640-w)/2+x,(640-h)/2+y,w,h);}
  stage.onpointerdown=e=>{start={px:e.clientX,py:e.clientY,x,y};stage.setPointerCapture(e.pointerId);};
  stage.onpointermove=e=>{if(!start)return;const ratio=640/stage.clientWidth;x=start.x+(e.clientX-start.px)*ratio;y=start.y+(e.clientY-start.py)*ratio;draw();};stage.onpointerup=stage.onpointercancel=()=>start=null;
  stage.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();x+=e.key==='ArrowLeft'?-20:e.key==='ArrowRight'?20:0;y+=e.key==='ArrowUp'?-20:e.key==='ArrowDown'?20:0;draw();};
  dialog.querySelector('input').oninput=e=>{zoom=Number(e.target.value);draw();};
  dialog.onclick=e=>{if(e.target.closest('[data-crop-save]')){result=canvas.toDataURL('image/jpeg',.88);dialog.close();}else if(e.target.closest('[data-crop-cancel]'))dialog.close();};
  dialog.onclose=()=>{dialog.remove();resolve(result);};draw();dialog.showModal();
 });
}
