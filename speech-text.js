// Same paragraph/list text as renderRich(...).children[].textContent, without a DOM.
export function speechText(value=''){
 const parts=[];let list=null;
 const plain=line=>line.replace(/\*\*([^*\n]+)\*\*|\*([^*\n]+)\*/g,(_,a,b)=>a||b);
 for(const line of String(value).split('\n')){
  if(/^-\s/.test(line)){list=(list??'')+plain(line.slice(2));continue;}
  if(list!==null){parts.push(list.trim());list=null;}
  parts.push(plain(line).trim());
 }
 if(list!==null)parts.push(list.trim());
 return parts.join('\n\n').trim();
}
