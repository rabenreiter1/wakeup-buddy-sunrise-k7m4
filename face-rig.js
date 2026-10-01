// Measured raster cutouts; no face masks or blurred texture patches.
const atlas='assets/felt-face-atlas-v2.png';
const frames={open:[100,115,272,261],half:[542,182,258,143],blink:[948,196,321,138],smile:[1396,179,312,159],small:[99,607,271,129],wide:[522,591,296,160],round:[1022,580,179,180]};
const loaded=new Set(),pending=new Map();
function imageReady(src){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>image.decode().then(resolve,reject);image.onerror=reject;image.src=src;});}
let atlasReady;
export function faceReady(kind){
 if(!pending.has(kind)){
  atlasReady ||= imageReady(atlas);
  pending.set(kind,Promise.all([atlasReady,imageReady('assets/felt-'+kind+'-base-v2.png')]).then(()=>{
   loaded.add(kind);document.querySelectorAll('.buddy-character[data-character="'+kind+'"]').forEach(el=>el.dataset.faceReady='true');
  }).catch(()=>{})); // Retain the complete original portrait on loading failure.
 }
 return loaded.has(kind);
}
function frame(name){const [x,y,w,h]=frames[name];return '<svg class="felt-face-frame frame-'+name+'" data-face-frame="'+name+'" viewBox="'+[x-3,y-3,w+6,h+6].join(' ')+'" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><image href="'+atlas+'" width="1774" height="887"/></svg>';}
export function faceArt(kind){
 const eyes=['left','right'].map(side=>'<span class="felt-eye eye-'+side+'">'+['open','half','blink'].map(frame).join('')+'</span>').join('');
 return '<img class="buddy-face-base" src="assets/felt-'+kind+'-base-v2.png" width="220" height="220" alt="" aria-hidden="true" draggable="false"><span class="felt-eye-pair" aria-hidden="true">'+eyes+'</span><span class="felt-mouth" aria-hidden="true">'+['smile','small','wide','round'].map(frame).join('')+'</span>';
}
