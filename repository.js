import {MAX_BLOCKS,isOwnRoutine} from './limits.js';
import {captureSchedule,migrateSingleDailyPlan,weeklyConflicts,dayHasStarted} from './planning.js';
import { readState, writeState, readRitual, listBlocks, saveBlock, writeLibraryChange } from './storage.js';
import { CATALOG_BLOCKS, CATALOG_RITUALS } from './demo-catalog.js';
import { CATALOG_BLOCKS as TEAM_BLOCKS,TEAM_PUBLISHER } from './team-catalog.js';
import { blockIdentity, defaultAlarm } from './catalog.js';
import { restoreDraft } from './model.js';
import { visualRecipe } from './landscape.js';
let data, queue = Promise.resolve();
export async function loadProduct() {
  if (data) return data;
  data = await readState('product-v3');
  if (!data) {
    const legacy = await readRitual();
    let first = structuredClone(CATALOG_RITUALS[0]);
    if (legacy?.blocks?.length) first = { ...first, ...legacy, title: legacy.title || first.title };
    first.ownership='own';first.id = 'my-morning'; first.alarm = { ...defaultAlarm(), enabled: true };
    first.blocks = first.blocks.map(b => {
      const seed = CATALOG_BLOCKS.find(s => s.id === b.id || s.id === b.sourceId);
      return { ...(seed || {}), ...restoreDraft(b), sourceId: b.sourceId || seed?.id || b.id, tags: b.tags || seed?.tags || [], music: b.music || seed?.music || 'none' };
    });
    // Older demos could add the same source repeatedly. Keep the first in place.
    const seen = new Set(); first.blocks = first.blocks.filter(b => { const key = blockIdentity(b); if (seen.has(key)) return false; seen.add(key); return true; });
    data = { version: 3, rituals: [first], history: [], profile: { name: 'Du', sound: true }, createdAt: new Date().toISOString() };
    const existing = await listBlocks();
    for (const b of first.blocks) if (!existing.some(x => blockIdentity(x) === blockIdentity(b))) await saveBlock({ ...b, id: b.id || crypto.randomUUID(), updatedAt: new Date().toISOString() });
    await writeState('product-v3', data);
  }
  for(const r of data.rituals)r.ownership='own';
  if(!data.sharedLibraryVersion)await migrateLibrary();
  if(!data.scheduleRevisions){captureSchedule(data);await writeState('product-v3',data);}
  if(migrateSingleDailyPlan(data))await writeState('product-v3',data);
  if(!data.stocksListeningVersion)await migrateStocksListening();
  return data;
}
async function migrateStocksListening(){
 const original=TEAM_BLOCKS.find(b=>b.id==='wb-stocks');
 const old={...original,steps:[...original.steps,{id:'wb-stocks-2',message:{type:'text',text:'*Deine Einordnung*\n\nSprich eine kurze Notiz: Welche Meldung ist für dich relevant und welche Frage bleibt offen? Trenne das, was die Quelle belegt, von deiner eigenen Vermutung. Du brauchst daraus heute keine Handelsentscheidung zu machen.'},minutes:1,input:'voice',timer:false,research:false}]};
 const signature=contentSignature(old);
 const update=block=>{if((block.sourceId||block.id)!=='wb-stocks'||block.publisherId!==TEAM_PUBLISHER||block.customized||contentSignature(block)!==signature)return block;return {...block,contentRevision:2,steps:structuredClone(original.steps)};};
 const put=[];for(const block of await listBlocks()){const revised=update(block);if(revised!==block)put.push(revised);}
 const next=structuredClone(data);next.rituals.forEach(r=>{r.blocks=r.blocks.map(update);});next.stocksListeningVersion=1;
 await atomicChange(next,{put});
}
export function persistProduct() {
  captureSchedule(data);
  const snapshot = structuredClone(data);
  queue = queue.catch(() => {}).then(() => writeState('product-v3', snapshot)); return queue;
}
export async function savedBlocks() { return (await listBlocks()).map(b => ({ ...b, ...restoreDraft(b), sourceId: b.sourceId || b.id, kind: 'block', author: b.author || 'Du' })); }
export async function saveToLibrary(item) {
  if (item.kind === 'ritual' || item.blocks) {
    const exists = data.rituals.find(r => (r.sourceId || r.id) === (item.sourceId || item.id));
    if (exists) return exists;
    const copy = { ...structuredClone(item), id: crypto.randomUUID(), sourceId: item.sourceId || item.id, ownership:'own', alarm: defaultAlarm() };
    copy.blocks=await Promise.all(copy.blocks.map(saveToLibrary));
    if(copy.blocks.some((b,i)=>contentSignature(b)!==contentSignature(item.blocks[i])))markCustomized(copy);
    data.rituals.push(copy); await persistProduct(); return copy;
  }
  const exists = (await savedBlocks()).find(b => blockIdentity(b) === blockIdentity(item));
  if (exists) return exists;
  const copy = { ...structuredClone(item), id: crypto.randomUUID(), sourceId: item.sourceId || item.id, createdAt:new Date().toISOString(), updatedAt: new Date().toISOString() };
  await saveBlock(copy); return copy;
}
export async function addToRitual(ritual, block) {
  if(!isOwnRoutine(ritual))throw new Error('Ritual nicht verfügbar.');
  if(ritual.blocks.length>=MAX_BLOCKS)throw new Error('Maximal 10 Bausteine pro Ritual.');
  if (ritual.blocks.some(b => blockIdentity(b) === blockIdentity(block))) return false;
  const saved = await saveToLibrary(block);
  ritual.blocks.push(structuredClone(saved)); markCustomized(ritual); await persistProduct(); return true;
}
export async function recordRun(ritual, report) {
  const entry={ id:report.id||crypto.randomUUID(),ritualId:ritual.id,title:ritual.title,theme:ritual.theme,symbol:ritual.symbol,sourceId:ritual.sourceId,date:new Date().toISOString(),...report,visualBlocks:visualRecipe(ritual),coverPhoto:ritual.coverPhoto };
  data.history=data.history.filter(r=>r.id!==entry.id);data.history.unshift(entry);if(report.ended)data.activeRun=null;
  await persistProduct();
}
export function nextAlarm(ritual, now = new Date()) {
  const a = ritual.alarm; if (!a?.enabled || !a.days?.length || !ritual.blocks.length) return null;
  const [h,m] = a.time.split(':').map(Number);
  for (let offset = 0; offset <= 7; offset++) {
    const date = new Date(now); date.setDate(date.getDate()+offset); date.setHours(h,m,0,0);
    if (date > now && a.days.includes(date.getDay())) return date;
  }
  return null;
}

export function markCustomized(item){
 if(!item)return;
 if(!item.origin&&item.author&&item.author!=='Du')item.origin={id:item.sourceId||item.id,author:item.author};
 item.customized=true;item.author='Du';if(item.blocks)item.ownership='own';
}
export function contentSignature(block){
 const b=restoreDraft(block);
 return JSON.stringify([b.title,b.description,b.symbol,b.theme,b.tags,b.music,b.output,b.steps.map(s=>[s.message,s.input,s.research,s.minutes,s.timer,s.guidance||null])]);
}
async function atomicChange(next,change){
 captureSchedule(next);
 queue=queue.catch(()=>{}).then(()=>writeLibraryChange(next,change));await queue;
 Object.keys(data).forEach(k=>delete data[k]);Object.assign(data,next);
}
async function migrateLibrary(){
 const library=await savedBlocks(),put=[];
 for(const r of data.rituals){
  r.blocks=r.blocks.map(raw=>{
   let block=library.find(b=>blockIdentity(b)===blockIdentity(raw));
   if(block&&contentSignature(block)!==contentSignature(raw)){
    // Keep previously independent edits as a named library item instead of losing them.
    const variant=library.find(b=>b.legacySource===blockIdentity(raw)&&contentSignature(b)===contentSignature(raw));
    if(variant)return structuredClone(variant);
    block={...structuredClone(raw),id:crypto.randomUUID(),legacySource:blockIdentity(raw)};
    block.sourceId=block.id;markCustomized(block);library.push(block);put.push(block);
   }else if(!block){block={...structuredClone(raw),id:raw.id||crypto.randomUUID()};library.push(block);put.push(block);}
   return structuredClone(block);
  });
 }
 data.sharedLibraryVersion=1;await writeLibraryChange(data,{put});
}
export async function saveLibraryBlock(block){
 await loadProduct();const old=(await savedBlocks()).find(b=>b.id===block.id);
 const saved={...old,...structuredClone(block),createdAt:old?.createdAt||old?.updatedAt||new Date().toISOString()};delete saved._draftKey;delete saved._draftUpdated;delete saved._from;delete saved._ritualId;
 const changed=!old||contentSignature(old)!==contentSignature(saved);
 if(old&&changed)markCustomized(saved);
 const next=structuredClone(data);
 next.rituals.forEach(r=>{let used=false;r.blocks=r.blocks.map(b=>{if(blockIdentity(b)!==blockIdentity(saved))return b;used=true;return structuredClone(saved);});if(used&&changed)markCustomized(r);});
 await atomicChange(next,{put:[saved]});return saved;
}
// Undo restores only free slots; a newer user choice always wins.
function restoreAlarm(state,ritual,alarm){
 if(!alarm)return;
 const restored=structuredClone(alarm);
 if(state.singleDailyPlanVersion&&restored.enabled){
  const occupied=new Set(weeklyConflicts(state,ritual.id,restored.days).flatMap(r=>r.alarm.days));
  restored.days=restored.days.filter(day=>!occupied.has(day));
  restored.enabled=Boolean(restored.days.length&&ritual.blocks.length);
 }
 ritual.alarm=restored;
}
function restoreAppointments(state,appointments,removedDays=[]){
 for(const p of appointments){
  if(!state.rituals.some(r=>r.id===p.ritualId&&r.blocks.length)||state.datePlans?.some(x=>x.id===p.id))continue;
  if(state.singleDailyPlanVersion&&(dayHasStarted(state,p.date)||state.datePlans?.some(x=>x.date===p.date)))continue;
  state.datePlans=[...(state.datePlans||[]),structuredClone(p)];
  if(removedDays.includes(p.date))state.skippedDays=(state.skippedDays||[]).filter(date=>date!==p.date);
 }
}
function suppressRemovedDays(state,appointments){
 if(!state.singleDailyPlanVersion)return [];
 const added=[...new Set(appointments.map(p=>p.date))].filter(date=>!state.skippedDays?.includes(date)&&!state.datePlans?.some(p=>p.date===date));
 state.skippedDays=[...(state.skippedDays||[]),...added];return added;
}
export async function removeLibraryBlock(id){
 await loadProduct();const block=(await savedBlocks()).find(b=>b.id===id);if(!block)return;
 const next=structuredClone(data),affected=[];
 next.rituals.forEach(r=>{const index=r.blocks.findIndex(b=>blockIdentity(b)===blockIdentity(block));if(index<0)return;affected.push({id:r.id,index,alarm:structuredClone(r.alarm)});r.blocks.splice(index,1);markCustomized(r);if(!r.blocks.length&&r.alarm)r.alarm.enabled=false;});
 const empty=new Set(next.rituals.filter(r=>!r.blocks.length).map(r=>r.id));
 const removedPlans=(next.datePlans||[]).filter(p=>empty.has(p.ritualId));next.datePlans=(next.datePlans||[]).filter(p=>!empty.has(p.ritualId));
 const removedDays=suppressRemovedDays(next,removedPlans);
 const addedSkips=[];for(const p of removedPlans){if(p.replacesRitualId&&!next.skippedPlans?.some(x=>x.date===p.date&&x.ritualId===p.replacesRitualId)){const skip={date:p.date,ritualId:p.replacesRitualId};addedSkips.push(skip);next.skippedPlans=[...(next.skippedPlans||[]),skip];}}
 await atomicChange(next,{remove:[id]});
 return async()=>{const restored=structuredClone(data);for(const a of affected){const r=restored.rituals.find(r=>r.id===a.id);if(!r||r.blocks.some(b=>blockIdentity(b)===blockIdentity(block)))continue;const wasEmpty=!r.blocks.length;r.blocks.splice(Math.min(a.index,r.blocks.length),0,structuredClone(block));if(wasEmpty)restoreAlarm(restored,r,a.alarm);}restored.skippedPlans=(restored.skippedPlans||[]).filter(p=>!addedSkips.some(x=>x.date===p.date&&x.ritualId===p.ritualId));restoreAppointments(restored,removedPlans,removedDays);await atomicChange(restored,{put:[block]});};
}
export async function removeLibraryRitual(id){
 await loadProduct();const next=structuredClone(data),index=next.rituals.findIndex(r=>r.id===id);if(index<0)return;
 const [ritual]=next.rituals.splice(index,1),plans=(next.datePlans||[]).filter(p=>p.ritualId===id);
 next.datePlans=(next.datePlans||[]).filter(p=>p.ritualId!==id);const removedDays=suppressRemovedDays(next,plans);await atomicChange(next,{});
 return async()=>{const restored=structuredClone(data),library=await savedBlocks();ritual.blocks=ritual.blocks.map(b=>library.find(x=>blockIdentity(x)===blockIdentity(b))).filter(Boolean).map(b=>structuredClone(b));if(!ritual.blocks.length&&ritual.alarm)ritual.alarm.enabled=false;if(!restored.rituals.some(r=>r.id===id))restored.rituals.splice(Math.min(index,restored.rituals.length),0,ritual);restoreAlarm(restored,ritual,ritual.alarm);restoreAppointments(restored,plans,removedDays);await atomicChange(restored,{});};
}
