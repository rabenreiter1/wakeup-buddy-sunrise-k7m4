export { SHAPES,shapeId } from './shapes.js';
import { escapeHTML as esc } from './richtext.js';
import { COLORS, paletteColor, pastelColor } from './palette.js';
export { COLORS } from './palette.js';
import {BLOCK_SYMBOLS,ALL_BLOCK_SYMBOLS,blockSymbolId,blockSymbolArt} from './block-symbols.js';
export const SYMBOLS=BLOCK_SYMBOLS;
export const symbolId=blockSymbolId;
export function colorOf(item={}) { return paletteColor(item); }
export function visualStyle(item={}) {const c={...colorOf(item),bg:pastelColor(item)};return 'color:'+c.ink+';--scene:'+c.bg+';--scene-ink:'+c.ink+';--scene-dark:'+c.ink+';background:'+((item.kind==='ritual'||item.blocks||item.visualBlocks)?'var(--soft)':c.bg);}
export function symbol(item={}) {
 const ritual=item.kind==='ritual'||Array.isArray(item.blocks)||Array.isArray(item.visualBlocks);
 if(!ritual)return '<span class="visual-symbol block-form" role="img" aria-label="'+ALL_BLOCK_SYMBOLS.find(s=>s.id===symbolId(item)).label+'">'+blockSymbolArt(symbolId(item),colorOf(item).ink)+'</span>';
 const blocks=(item.blocks||item.visualBlocks||[]).slice(0,4);
 const photo=typeof item.coverPhoto==='string'&&/^data:image\/(jpeg|png|webp);base64,/.test(item.coverPhoto)?item.coverPhoto:null;
 const content=photo?'<img class="routine-photo" src="'+esc(photo)+'" alt="">':blocks.map(b=>'<span class="cover-quadrant" style="background:'+pastelColor(b)+'">'+blockSymbolArt(symbolId(b),colorOf(b).ink)+'</span>').join('')+(blocks.length===3?'<span class="cover-quadrant empty-quadrant"></span>':'');
 return '<span class="visual-symbol ritual-art playlist-art tiles-'+blocks.length+'" data-cover-count="'+blocks.length+'" role="img" aria-label="Ritual-Cover">'+content+'</span>';
}
let dialog;
export function showAppearance(item,onChange,onClose) {
 if(item.kind==='ritual'||Array.isArray(item.blocks)){onClose?.();return;}
 if(!dialog){dialog=document.createElement('dialog');dialog.id='appearance-dialog';document.body.append(dialog);}
 const ritual=false,options=SYMBOLS,selected=()=>symbolId(item);
 let tab='symbol';
 function choices(){return tab==='symbol'?options.map(s=>`<button type="button" data-symbol="${s.id}" aria-label="${s.label}" aria-pressed="${selected()===s.id}">${symbol(ritual?{kind:'ritual',symbol:s.id}:{symbol:s.id,theme:item.theme})}</button>`).join(''):COLORS.map(c=>`<button type="button" data-color="${c.id}" aria-label="${c.label}" aria-pressed="${colorOf(item).id===c.id}" style="--swatch:${pastelColor(c.bg)};--swatch-ink:${c.ink}"><span></span></button>`).join('');}
 function render(){const scroll=dialog.scrollTop;dialog.innerHTML=`<div class="sheet-grip" aria-hidden="true"></div><div class="dialog-head"><h2>Dein Look</h2><button class="icon-btn" data-look-close aria-label="Schließen">✕</button></div><div class="look-preview" style="${visualStyle(item)}">${symbol(item)}<span>${esc(item.title||'Dein Baustein')}</span></div><div class="filter-tabs look-tabs"><button data-look-tab="symbol" aria-pressed="${tab==='symbol'}">Symbol</button><button data-look-tab="color" aria-pressed="${tab==='color'}">Farbe</button></div><div class="look-grid ${tab}" style="--symbol-surface:${pastelColor(item)}">${choices()}</div>`;dialog.scrollTop=scroll;}
 dialog.onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.hasAttribute('data-look-close')){dialog.close();return;}if(b.dataset.lookTab){tab=b.dataset.lookTab;render();return;}if(b.dataset.symbol)item.symbol=b.dataset.symbol;if(b.dataset.color)item.theme=b.dataset.color;if(b.dataset.symbol||b.dataset.color){onChange();dialog.querySelector('.look-preview').setAttribute('style',visualStyle(item));dialog.querySelector('.look-preview .visual-symbol').outerHTML=symbol(item);dialog.querySelectorAll('[data-symbol]').forEach(el=>el.setAttribute('aria-pressed',el.dataset.symbol===selected()));dialog.querySelectorAll('[data-color]').forEach(el=>el.setAttribute('aria-pressed',el.dataset.color===colorOf(item).id));}};
 dialog.onclose=()=>onClose?.();render();dialog.showModal();
}
