import { paletteColor } from './palette.js';
import { createLavaField,vertex,fragment } from './lava-core.js';

const colour=item=>paletteColor(item).bg;
export function ritualColors(item={}) {
 const blocks=Array.isArray(item.blocks)?item.blocks:Array.isArray(item.visualBlocks)?item.visualBlocks:[];
 return [...new Set(blocks.map(colour))];
}
export function ritualSignature(item) { return ritualColors(item).join(','); }
export function lavaMarkup(item,{tint=0,background=false,blockGradient=false}={}) {
 const colors=ritualColors(item),palette=colors.length?colors:['#f4f2f5'];
 return `<canvas class="ritual-lava${background?' lava-background':''}" data-lava-mode="${blockGradient?'block':'palette'}" data-lava-colors="${palette.join(',')}" data-lava-tint="${tint}" data-color-count="${colors.length}" data-signature="${colors.join(',')}" data-block-count="${(item.blocks||item.visualBlocks||[]).length}" aria-hidden="true"></canvas>`;
}
export function ritualFallback(item) {
 const colors=ritualColors(item);
 return colors.length<2?colors[0]||'#f4f2f5':`radial-gradient(ellipse at 20% 20%,${colors[0]},transparent 70%),linear-gradient(135deg,${colors.join(',')})`;
}

// One GPU context for the entire app. Only visible, unobscured covers animate;
// equal palettes share their solver and clock, including live and completion.
let installed=false,engine=null,disabledGPU=false,raf=0,last=0;
const entries=new Map(),fields=new Map(),reduce=matchMedia('(prefers-reduced-motion: reduce)');
function makeEngine(){
 if(engine||disabledGPU)return engine;
 const source=document.createElement('canvas'),gl=source.getContext('webgl',{alpha:false,antialias:false,preserveDrawingBuffer:true});
 if(!gl){disabledGPU=true;return null;}
 try {
  function compile(type,code){const shader=gl.createShader(type);gl.shaderSource(shader,code);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));return shader;}
  const program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
  const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  const pos=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
  const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  const uniforms=Object.fromEntries(['palette','count','clock','corner','sites[0]','companions[0]'].map(name=>[name,gl.getUniformLocation(program,name)]));gl.uniform1i(uniforms.palette,0);
  engine={source,gl,texture,uniforms};
  source.addEventListener('webglcontextlost',e=>{e.preventDefault();disabledGPU=true;engine=null;entries.forEach(e=>e.dirty=true);wake();});
  source.addEventListener('webglcontextrestored',()=>{disabledGPU=false;entries.forEach(e=>e.dirty=true);wake();});
 }catch(error){console.warn('Lava uses its static fallback:',error.message);disabledGPU=true;engine=null;}
 return engine;
}
// Live steps have one hue only. Moving soft light adds depth without introducing
// another block's colour, black shading, or changing single-colour ritual covers.
function renderBlock(entry){
 const {ctx,canvas,width:w,height:h,time:t}=entry;
 const dark=document.documentElement.dataset.theme==='dark',rgb=[1,3,5].map(i=>parseInt(entry.colors[0].slice(i,i+2),16));
 ctx.fillStyle=dark?'rgb('+rgb.map(v=>Math.round(v*.18)).join(',')+')':entry.colors[0];ctx.fillRect(0,0,w,h);
 // A broad diagonal wash, with a slowly drifting angle and no central hotspot.
 const angle=Math.PI/4+.28*Math.sin(t*.16),dx=Math.cos(angle)*w*.48,dy=Math.sin(angle)*h*.48;
 const shift=.15*Math.sin(t*.20),cx=w*(.5+shift),cy=h*(.5-shift);
 const light=ctx.createLinearGradient(cx-dx,cy-dy,cx+dx,cy+dy);
 const lightColor=dark?rgb.join(','):'255,255,255';
 light.addColorStop(0,`rgba(${lightColor},${dark?.18:.72})`);
 light.addColorStop(1,`rgba(${lightColor},${dark?.025:.04})`);
 ctx.fillStyle=light;ctx.fillRect(0,0,w,h);
 if(entry.tint&&!document.documentElement.matches('[data-theme=dark]')){ctx.fillStyle=`rgba(255,255,255,${entry.tint})`;ctx.fillRect(0,0,w,h);}
 canvas.dataset.lavaReady='true';canvas.dataset.lavaTime=t.toFixed(3);entry.dirty=false;
}
function render(entry,field){
 const {canvas,ctx}=entry,{width,height,corner}=entry,size=Math.max(width,height)>380?512:256,e=makeEngine();
 if(e&&!e.gl.isContextLost()){
  const {source,gl,uniforms}=e;
  if(source.width!==size){source.width=source.height=size;gl.viewport(0,0,size,size);}
  gl.uniform1i(uniforms.count,field.colors.length);gl.uniform1f(uniforms.clock,field.time);gl.uniform2f(uniforms.corner,...corner);
  gl.uniform3fv(uniforms['sites[0]'],field.math.sites);gl.uniform4fv(uniforms['companions[0]'],field.math.companions);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,field.colors.length,1,0,gl.RGBA,gl.UNSIGNED_BYTE,field.bytes);gl.drawArrays(gl.TRIANGLES,0,6);
  ctx.drawImage(source,0,0,width,height);
 }else{
  const raster=document.createElement('canvas');raster.width=raster.height=80;const context=raster.getContext('2d'),pixels=context.createImageData(80,80);
  for(let y=0;y<80;y++)for(let x=0;x<80;x++){const rgb=field.math.sample((x+.5)/80,(y+.5)/80),at=(y*80+x)*4;for(let c=0;c<3;c++)pixels.data[at+c]=rgb[c];pixels.data[at+3]=255;}context.putImageData(pixels,0,0);ctx.drawImage(raster,0,0,width,height);
 }
 if(entry.tint){ctx.fillStyle=`rgba(255,255,255,${entry.tint})`;ctx.fillRect(0,0,width,height);}
 if(document.documentElement.dataset.theme==='dark'&&canvas.classList.contains('lava-background')){ctx.fillStyle='rgba(15,11,22,.68)';ctx.fillRect(0,0,width,height);}
 canvas.dataset.lavaReady='true';canvas.dataset.lavaTime=field.time.toFixed(3);entry.dirty=false;
}
function fieldFor(colors){
 const key=colors.join(',');let field=fields.get(key);
 if(!field){const bytes=new Uint8Array(colors.length*4);colors.forEach((c,i)=>{[1,3,5].forEach((s,k)=>bytes[i*4+k]=parseInt(c.slice(s,s+2),16));bytes[i*4+3]=255;});field={colors,bytes,math:createLavaField(colors),time:0};fields.set(key,field);}
 return field;
}
function isVisible(entry){return entry.visible&&entry.canvas.isConnected&&entry.width>0&&!entry.canvas.closest('[hidden],[inert],dialog:not([open])')&&(!document.body.classList.contains('story-open')||entry.canvas.closest('#story-overlay'));}
function frame(now){
 raf=0;const dt=last?Math.min((now-last)/1000,.12):0;last=now;
 if(document.hidden)return;
 const active=new Map();let moving=false;
 for(const [canvas,entry] of entries){
  if(!canvas.isConnected){intersection.unobserve(canvas);resize.unobserve(canvas);entries.delete(canvas);continue;}
  if(!isVisible(entry))continue;
  if(entry.blockGradient){
   const playing=!reduce.matches&&!canvas.closest('.is-paused');
   if(playing){entry.time+=dt;moving=true;}
   if(playing||entry.dirty)renderBlock(entry);
   continue;
  }
  const paletteMoving=!reduce.matches&&!disabledGPU&&entry.colors.length>1&&!canvas.closest('.is-paused');
  if(paletteMoving||entry.dirty){const key=entry.colors.join(',');if(!active.has(key))active.set(key,{field:fieldFor(entry.colors),entries:[],moving:false});const group=active.get(key);group.entries.push(entry);group.moving ||= paletteMoving;}
 }
 for(const group of active.values()){
  if(group.moving){group.field.time+=dt;moving=true;}
  group.field.math.update(group.field.time);for(const entry of group.entries)render(entry,group.field);
 }
 // Remove palette caches no longer referenced after edits/navigation.
 const used=new Set([...entries.values()].map(e=>e.colors.join(',')));for(const key of fields.keys())if(!used.has(key))fields.delete(key);
 if(moving)raf=requestAnimationFrame(throttled);
}
function throttled(now){if(now-last<1000/24){raf=requestAnimationFrame(throttled);return;}frame(now);}
function wake(){if(!raf&&!document.hidden)raf=requestAnimationFrame(frame);}
const intersection=new IntersectionObserver(changes=>{for(const change of changes){const entry=entries.get(change.target);if(entry){entry.visible=change.isIntersecting;entry.dirty=true;}}wake();});
const resize=new ResizeObserver(changes=>{for(const {target} of changes){const entry=entries.get(target);if(!entry)continue;const r=target.getBoundingClientRect(),scale=Math.min(devicePixelRatio||1,1.5);entry.width=Math.max(1,Math.round(r.width*scale));entry.height=Math.max(1,Math.round(r.height*scale));target.width=entry.width;target.height=entry.height;const radius=getComputedStyle(target.parentElement).borderTopLeftRadius;entry.corner=radius.includes('%')?[parseFloat(radius)/100,parseFloat(radius)/100]:[Math.min(.49,(parseFloat(radius)||0)/Math.max(1,r.width)),Math.min(.49,(parseFloat(radius)||0)/Math.max(1,r.height))];entry.dirty=true;}wake();});
function scan(){
 document.querySelectorAll('canvas.ritual-lava').forEach(canvas=>{
  if(entries.has(canvas))return;
  const colors=[...new Set((canvas.dataset.lavaColors||'').split(',').filter(c=>/^#[0-9a-f]{6}$/i.test(c)))].slice(0,24);if(!colors.length)colors.push('#f4f2f5');
  const entry={canvas,ctx:canvas.getContext('2d'),colors,blockGradient:canvas.dataset.lavaMode==='block',time:0,tint:Math.min(1,Math.max(0,Number(canvas.dataset.lavaTint)||0)),width:0,height:0,corner:[0,0],visible:false,dirty:true};entries.set(canvas,entry);intersection.observe(canvas);resize.observe(canvas);
 });wake();
}
export function installLava(){
 if(installed)return;installed=true;scan();
 const mutations=new MutationObserver(changes=>{if(changes.some(c=>c.type==='childList'))scan();else wake();});
 mutations.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden','inert','open']});
 document.addEventListener('appearancechange',()=>{entries.forEach(e=>e.dirty=true);wake();});
 reduce.addEventListener('change',()=>{entries.forEach(e=>e.dirty=true);wake();});
 document.addEventListener('visibilitychange',()=>{last=0;entries.forEach(e=>e.dirty=true);wake();});
}
