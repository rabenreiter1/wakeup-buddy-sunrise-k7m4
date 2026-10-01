import { felt } from './felt.js';
// Legacy IDs are retained only for stable migration of saved blocks.
const legacyIds=["pebble","arch","ring","diamond","wave","petals","capsule","triangle","cross","moon","drop","clover","hexagon","fan","oval","steps","bow","squircle","burst","hourglass","twins","ribbon","corner","portal"];
const pieces={I:[[0,0],[1,0],[2,0],[3,0]],O:[[0,0],[1,0],[0,1],[1,1]],T:[[0,0],[1,0],[2,0],[1,1]],L:[[2,0],[0,1],[1,1],[2,1]],S:[[1,0],[2,0],[0,1],[1,1]]};
const previousOrder=['I','O','T','S','Z','J','L'];
const canonical=id=>id==='J'?'L':id==='Z'?'S':id;
function silhouette(cells){
 const edges=new Map(),edge=(a,b)=>{const key=a+':'+b,reverse=b+':'+a;if(edges.has(reverse))edges.delete(reverse);else edges.set(key,[a,b]);};
 for(const [x,y] of cells){edge([x,y],[x+1,y]);edge([x+1,y],[x+1,y+1]);edge([x+1,y+1],[x,y+1]);edge([x,y+1],[x,y]);}
 const segments=[...edges.values()],w=Math.max(...cells.map(c=>c[0]))+1,h=Math.max(...cells.map(c=>c[1]))+1;
 const point=([x,y])=>[10+(4-w)*10+x*20,10+(4-h)*10+y*20].join(' ');
 let cursor=segments[0][0],d='M'+point(cursor);
 for(let i=0;i<segments.length;i++){cursor=segments.find(([a])=>a[0]===cursor[0]&&a[1]===cursor[1])[1];d+='L'+point(cursor);}
 return d+'Z';
}
export const SHAPES=Object.entries(pieces).map(([id,cells])=>({id,label:id+'-Form',cells,path:silhouette(cells)}));
export function shapeId(item={}){
 if(pieces[canonical(item.shape)])return canonical(item.shape);
 const legacy=legacyIds.indexOf(item.shape);if(legacy>=0)return canonical(previousOrder[legacy%previousOrder.length]);
 const seed=String(item.symbol||item.sourceId||item.id||'');return canonical(previousOrder[[...seed].reduce((n,c)=>n+c.charCodeAt(0),0)%previousOrder.length]);
}
export function shapeArt(id,color='#bc9af3'){const s=SHAPES.find(s=>s.id===shapeId({shape:id}))||SHAPES[0];return felt(`<svg class="block-shape" data-piece="${s.id}" data-cells="4" viewBox="0 0 100 100" aria-hidden="true"><path d="${s.path}" fill="${color}" stroke="${color}" stroke-width="1.2" stroke-linejoin="round"/></svg>`);}
