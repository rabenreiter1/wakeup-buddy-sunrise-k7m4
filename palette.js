// Stable pigment IDs preserve saved content and the established live gradients.
// Static surfaces use one curated pastel swatch per pigment in both themes.
export const COLORS = [
 ['peach','Aprikose','#ffb16c','#58341e','#ffdbbf'],['lilac','Lavendel','#bc9af3','#432b67','#dfcef7'],
 ['lime','Limette','#c5e774','#344715','#d9eeab'],['sky','Himmel','#8ecfff','#204c6c','#c1e6ff'],
 ['rose','Rosa','#f79dc7','#65304b','#f8c9e4'],['sunny','Sonnengelb','#ffdc68','#59400d','#ffe79c'],
 ['red','Koralle','#ff8985','#712d38','#ffbeb9'],['blue','Kornblume','#859ef3','#294779','#c0ccf6'],
 ['teal','Minze','#73d9b0','#245449','#b9e9d1'],['sand','Sand','#e4c8a1','#5b4a2d','#eddfc6'],
 ['tangerine','Mandarine','#efa454','#53330c','#f6cb9a'],['copper','Terrakotta','#c98969','#412417','#e6c0b2'],
 ['lemon','Zitrone','#e9e66c','#48460d','#eef0bc'],['sage','Salbei','#84a585','#203c25','#c2d5b9'],
 ['petrol','Petrol','#76a8ab','#17383d','#acd9d7'],['ocean','Ozean','#7197cb','#172f52','#acc9e1'],
 ['grape','Pflaume','#aa89bd','#382148','#d6b9df'],['raspberry','Himbeere','#bb7896','#422033','#e9b3cc'],
 ['stone','Stein','#b1aaa1','#39332b','#d8d1c9'],['graphite','Schiefer','#6b6678','#494354','#cbc9df']
].map(([id,label,bg,ink,surface])=>({id,label,bg,ink,surface}));

// Keep saved drafts, published blocks and history in their original colour family.
const aliases={orange:'peach',coral:'red',berry:'rose',violet:'lilac',aqua:'sky',mint:'teal',green:'teal',cocoa:'sand',slate:'blue',cream:'sunny',ice:'sky',plum:'lilac',melon:'peach',olive:'lime'};
export function paletteColor(item={}){const id=typeof item==='string'?item:item?.theme;return COLORS.find(c=>c.id===(aliases[id]||id))||COLORS[1];}

// Unknown legacy pigments retain the original white-tint fallback.
export function pastelColor(value){const c=typeof value==='string'&&value.startsWith('#')?COLORS.find(c=>c.bg===value):paletteColor(value);if(c?.surface)return c.surface;const hex=c?.bg||value;return '#'+[1,3,5].map(i=>Math.round(parseInt(hex.slice(i,i+2),16)*.45+255*.55).toString(16).padStart(2,'0')).join('');}
