// Original, code-native felt treatment shared by every content illustration.
// Separate per-shape lighting preserves recognisable silhouettes at small sizes.
let sequence=0;
const tone=(hex,amount)=>'#'+hex.slice(1).match(/../g).map(x=>Math.max(0,Math.min(255,parseInt(x,16)+amount)).toString(16).padStart(2,'0')).join('');
export function felt(svg){
 const id='felt-'+(++sequence),colors=[...new Set([...svg.matchAll(/fill="(#[0-9a-f]{6})"/gi)].map(m=>m[1]))];
 let gradients='';colors.forEach((color,i)=>{const name=id+'-c'+i;gradients+=`<radialGradient id="${name}" cx="32%" cy="24%" r="85%"><stop stop-color="${tone(color,25)}"/><stop offset=".48" stop-color="${color}"/><stop offset="1" stop-color="${tone(color,-35)}"/></radialGradient>`;svg=svg.replaceAll('fill="'+color+'"','fill="url(#'+name+')"');});
 const view=svg.match(/viewBox="([^"]+)"/)?.[1]||'0 0 100 100',scale=Number(view.split(' ')[2])/100;
 const start=svg.indexOf('>')+1,body=svg.slice(start,svg.lastIndexOf('</svg>'));
 return svg.slice(0,start)+`<defs>${gradients}<filter id="${id}" x="-15%" y="-15%" width="130%" height="135%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="${.78/scale}" numOctaves="3" seed="8" result="noise"/><feColorMatrix in="noise" type="saturate" values="0" result="rawFibers"/><feComponentTransfer in="rawFibers" result="fibers"><feFuncR type="linear" slope=".08" intercept=".46"/><feFuncG type="linear" slope=".08" intercept=".46"/><feFuncB type="linear" slope=".08" intercept=".46"/></feComponentTransfer><feComposite in="fibers" in2="SourceAlpha" operator="in" result="clipped"/><feBlend in="SourceGraphic" in2="clipped" mode="soft-light" result="textured"/><feDisplacementMap in="textured" in2="noise" scale="${.25*scale}" xChannelSelector="R" yChannelSelector="G"/><feDropShadow dx="0" dy="${1.25*scale}" stdDeviation="${1.3*scale}" flood-color="#39253b" flood-opacity=".19"/></filter></defs><g class="felt-surface" filter="url(#${id})">${body}</g></svg>`;
}
