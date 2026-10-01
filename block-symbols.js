const entries=[
 ['sun','Sonne','<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>'],
 ['drop','Tropfen','<path d="M12 2C10 6 5 10 5 15a7 7 0 0 0 14 0c0-5-5-9-7-13Z"/>'],
 ['leaf','Blatt','<path d="M20 3C9 2 2 8 5 16c8 4 16-2 15-13ZM4 21 16 8"/>'],
 ['flame','Flamme','<path d="M13 2c2 6-3 7-3 11-2-1-3-3-3-5-7 8-2 14 5 14s11-10 1-20Z"/>'],
 ['heart','Herz','<path d="M12 21 3.5 12.5C-2 5 7-1 12 6c5-7 14-1 8.5 6.5Z"/>'],
 ['mountain','Berg','<path d="m2 21 10-18 10 18ZM8 10l4 3 4-3"/>'],
 ['wave','Welle','<path d="M2 15c6 1 4-12 14-10-5 3-2 9 6 10M2 20c4-4 6 4 10 0s6 4 10 0"/>'],
 ['wind','Wind','<path d="M2 8h13c6 0 6-7 2-6M2 13h18M5 18h9c6 0 6 6 1 4"/>'],
 ['fitness','Bewegung','<path d="M6 5v14M3 8v8M18 5v14M21 8v8M6 12h12"/>'],
 ['compass','Kompass','<circle cx="12" cy="12" r="10"/><path d="m16 7-2 7-7 3 3-7Z"/>'],
 ['book','Buch','<path d="M12 6C8 3 5 3 2 4v15c4-1 7 0 10 2 3-2 6-3 10-2V4c-3-1-6-1-10 2v15"/>'],
 ['pencil','Stift','<path d="m3 21 2-7L17 2l5 5-12 12ZM14 5l5 5M5 14l5 5"/>'],
 ['idea','Idee','<path d="M8 17v-2a7 7 0 1 1 8 0v2ZM9 21h6M12 17v-6"/>'],
 ['target','Ziel','<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>'],
 ['check','Haken','<path d="m3 12 6 6L21 5"/>'],
 ['music','Musik','<path d="M9 18V5l12-3v13M9 9l12-3"/><ellipse cx="5" cy="18" rx="4" ry="3"/><ellipse cx="17" cy="15" rx="4" ry="3"/>'],
 ['speech','Gespräch','<path d="M21 11a9 9 0 0 1-9 9H3l2-5a9 9 0 1 1 16-4Z"/><path d="M8 10h8M8 14h5"/>'],
 ['globe','Welt','<circle cx="12" cy="12" r="10"/><ellipse cx="12" cy="12" rx="4" ry="10"/><path d="M2 12h20M4 6h16M4 18h16"/>'],
 ['clock','Zeit','<circle cx="12" cy="12" r="10"/><path d="M12 6v7l4 2"/>'],
 ['infinity','Unendlich','<path d="M12 12c-4-8-10-6-10 0s6 8 10 0 10-6 10 0-6 8-10 0Z"/>'],
 ['circle','Kreis','<circle cx="12" cy="12" r="9"/>'],
 ['triangle','Dreieck','<path d="M12 3 22 21H2Z"/>'],
 ['square','Quadrat','<rect x="3" y="3" width="18" height="18" rx="2"/>'],
 ['diamond','Raute','<path d="m12 2 10 10-10 10L2 12Z"/>'],
 ['star','Stern','<path d="m12 2 3.1 6.3 7 .9-5.1 5 1.2 7L12 18l-6.2 3.2 1.2-7-5.1-5 7-.9Z"/>']
];
const archived=new Set(['flame','mountain','pencil','check','infinity']);
export const ALL_BLOCK_SYMBOLS=entries.map(([id,label,art])=>({id,label,art}));
export const BLOCK_SYMBOLS=ALL_BLOCK_SYMBOLS.filter(s=>!archived.has(s.id));
const aliases={sunrise:'sun',water:'drop',fire:'flame',plant:'leaf',flower:'leaf',cloud:'wind',run:'fitness',shoe:'fitness',journal:'pencil',news:'globe',earth:'globe',headphones:'music',mic:'speech',people:'speech',care:'drop',strength:'fitness',breathe:'wind',focus:'target',footprint:'fitness',arch:'star',moon:'circle',I:'check',O:'square',T:'target',L:'star',J:'star',S:'wave',Z:'wave'};
const defaults={'demo-arrive':'sun','demo-clear':'wind','demo-day':'globe','community-move':'fitness','community-focus':'target','team-care':'drop'};
export function blockSymbolId(item={}){const id=aliases[item.symbol]||item.symbol;if(ALL_BLOCK_SYMBOLS.some(s=>s.id===id))return id;return defaults[item.sourceId||item.id]||aliases[item.shape]||'sun';}
export function blockSymbolArt(id,color='#493c39'){
 const entry=ALL_BLOCK_SYMBOLS.find(s=>s.id===id)||BLOCK_SYMBOLS[0];
 const ink=/^#[0-9a-f]{6}$/i.test(color)?color:'#493c39';
 return `<svg class="block-symbol-svg" data-symbol-id="${entry.id}" viewBox="0 0 32 32" aria-hidden="true" style="color:${ink}"><g transform="translate(4 4)" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${entry.art}</g></svg>`;
}
