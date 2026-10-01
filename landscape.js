import { paletteColor } from './palette.js';
import {symbolId} from './appearance.js';
import { SHAPES,shapeId } from './shapes.js';
export const landscapeColor=item=>paletteColor(item);
const mix=(a,b,t)=>'#'+[1,3,5].map(i=>Math.round(parseInt(a.slice(i,i+2),16)*(1-t)+parseInt(b.slice(i,i+2),16)*t).toString(16).padStart(2,'0')).join('');
const hash=text=>{let n=2166136261;for(const c of text){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return (n>>>0).toString(36);};
let instance=0;
export function visualRecipe(item){const blocks=Array.isArray(item.blocks)?item.blocks:Array.isArray(item.visualBlocks)?item.visualBlocks:[];return blocks.map(b=>({shape:shapeId(b),symbol:symbolId(b),theme:landscapeColor(b).id}));}
export function landscapeSignature(blocks){return hash(JSON.stringify(blocks.map(b=>[shapeId(b),landscapeColor(b).id])));}
export function ritualBackground(item){const blocks=visualRecipe(item);if(!blocks.length)return '#f4f2f5';return `linear-gradient(110deg,${blocks.map((b,i)=>`${mix(landscapeColor(b).bg,'#ffffff',.32)} ${blocks.length===1?0:i/(blocks.length-1)*100}%`).concat(blocks.length===1?[`${mix(landscapeColor(blocks[0]).bg,'#ffffff',.72)} 100%`]:[]).join(',')})`;}
// Pure geometry and an ordered palette: no network, inference, random seed or bitmap.
// Each motif uses the same path in a standalone block and in its ritual slot.
function motif(shape,color,light,simple){
 if(shape==='wave')return `<path d="M-12 39Q17 10 50 37T112 39V100H-12Z" fill="${color}"/><path d="M-12 59Q17 30 50 57T112 59V100H-12Z" fill="${light}" opacity=".67"/>`;
 if(shape==='arch')return `<path d="M8 110V49a42 42 0 0 1 84 0v61H70V49a20 20 0 0 0-40 0v61Z" fill="${color}"/>`;
 if(shape==='ring')return `<circle cx="55" cy="52" r="44" fill="none" stroke="${color}" stroke-width="18"/>${simple?'':`<circle cx="55" cy="52" r="17" fill="${color}" opacity=".55"/>`}`;
 if(shape==='steps')return `<path d="M-5 90V67H24V45H52V22H82V100H-5Z" fill="${color}"/>${simple?'':`<path d="M-5 77H34V55H62V32H82" fill="none" stroke="${light}" stroke-width="3"/>`}`;
 if(shape==='pebble')return `<path d="M-12 92Q-6 26 44 27Q91 21 112 92V110H-12Z" fill="${color}"/>`;
 if(shape==='portal')return `<path d="M82 87H18V18H82V61H44V42" fill="none" stroke="${color}" stroke-width="15" stroke-linejoin="round" stroke-linecap="round"/>`;
 const path=SHAPES.find(s=>s.id===shape)?.path||SHAPES[0].path;
 return `<path d="${path}" fill="${color}" fill-rule="evenodd"/>`;
}
export function landscape(blocks,{block=false,scope}={}){
 blocks=Array.isArray(blocks)?blocks:[];const W=600,H=block?450:240,n=blocks.length,id=scope||`land-${++instance}`,signature=landscapeSignature(blocks);
 if(!n)return `<svg class="landscape-art empty-landscape" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" data-signature="${signature}" aria-hidden="true"><rect width="600" height="${H}" fill="#f4f2f5"/><path d="M0 ${H*.78}Q150 ${H*.45} 300 ${H*.78}T600 ${H*.78}V${H}H0Z" fill="#e7e2ed"/></svg>`;
 const colors=blocks.map(landscapeColor),slot=W/n;
 function stops(fn){return colors.map((c,i)=>`<stop offset="${n===1?0:i/(n-1)*100}%" stop-color="${fn(c)}"/>`).join('')+(n===1?`<stop offset="100%" stop-color="${fn(colors[0])}"/>`:'');}
 const defs=`<defs><linearGradient id="${id}-sky" x2="1" y2=".22">${stops(c=>mix(c.bg,'#ffffff',.5))}</linearGradient><linearGradient id="${id}-ground" x2="1" y2=".12">${stops(c=>mix(c.bg,c.ink,.12))}</linearGradient><linearGradient id="${id}-veil" x2="0" y2="1"><stop stop-color="#fff" stop-opacity=".48"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>`;
 const rows=block||n<=6?1:Math.min(3,Math.ceil(n/6)),columns=Math.ceil(n/rows);
 const motifs=blocks.map((b,i)=>{const shape=shapeId(b),c=colors[i],row=Math.floor(i/columns),column=i%columns,count=Math.min(columns,n-row*columns),width=W/count,size=block?480:Math.min(235,width*1.23),x=column*width+(width-size)/2,baseline=rows===1?.9:.5+.43*row/(rows-1),y=H*baseline-size*.8;return `<g data-motif="${shape}" data-theme="${c.id}" transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${(size/100).toFixed(4)})">${motif(shape,mix(c.bg,c.ink,.13),mix(c.bg,'#ffffff',.1),n>8)}</g>`;}).join('');
 let ridge=`M0 ${H*.83}`;for(let i=0;i<n;i++){const x=i*slot,y=H*(.84+(i%2?-.035:.025));ridge+=`C${x+slot*.35} ${H*.72} ${x+slot*.67} ${H*.97} ${x+slot} ${y}`;}ridge+=`V${H}H0Z`;
 return `<svg class="landscape-art ${block?'block-landscape-art':'ritual-landscape-art'}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" data-signature="${signature}" data-block-count="${n}" aria-hidden="true">${defs}<rect width="${W}" height="${H}" fill="url(#${id}-sky)"/>${motifs}<path d="${ridge}" fill="url(#${id}-ground)" opacity=".7"/><rect width="${W}" height="${H}" fill="url(#${id}-veil)"/></svg>`;
}
export const blockLandscape=(item,options={})=>landscape([item],{...options,block:true});
export const ritualLandscape=(item,options={})=>landscape(visualRecipe(item),options);
