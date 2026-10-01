let connection;
function open() {
  if (!connection) connection = new Promise((resolve, reject) => {
    const request = indexedDB.open('wakeup-buddy-creator-mvp', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('state');
      request.result.createObjectStore('blocks', { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Lokaler Speicher ist durch einen anderen Tab blockiert.'));
  });
  return connection;
}
async function transaction(store, mode, action) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const request = action(tx.objectStore(store));
    tx.oncomplete = () => resolve(request?.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Speichern abgebrochen.'));
  });
}
export const readDraft = async key => key ? (await readState('editor-drafts') || {})[key] : transaction('state', 'readonly', store => store.get('draft'));
export const listDrafts = async () => Object.values(await readState('editor-drafts') || {}).sort((a,b)=>(b._draftUpdated||'').localeCompare(a._draftUpdated||''));
export async function writeDraft(draft) {
  const db=await open(),snapshot=structuredClone(draft);
  const key=snapshot._draftKey || (snapshot.id?'block:'+snapshot.id:'new');
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('state','readwrite'),store=tx.objectStore('state');
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    const request=store.get('editor-drafts');
    request.onsuccess=()=>{
      const drafts=request.result||{};
      if(snapshot.page==='saved')delete drafts[key];
      else if(snapshot.title||snapshot.description||snapshot.steps.some(s=>s.message?.text))drafts[key]={...snapshot,_draftKey:key,_draftUpdated:new Date().toISOString()};
      store.put(drafts,'editor-drafts');store.put(snapshot,'draft');
    };
  });
}
export const listBlocks = () => transaction('blocks', 'readonly', store => store.getAll());
export const saveBlock = block => transaction('blocks', 'readwrite', store => store.put(structuredClone(block)));
export const deleteBlock = id => transaction('blocks', 'readwrite', store => store.delete(id));
export const readRitual = () => transaction('state', 'readonly', store => store.get('ritual'));
export const writeRitual = ritual => transaction('state', 'readwrite', store => store.put(structuredClone(ritual), 'ritual'));
export const readState = key => transaction('state', 'readonly', store => store.get(key));
export const writeState = (key, value) => transaction('state', 'readwrite', store => store.put(structuredClone(value), key));

async function changeDrafts(change){
 const db=await open();return new Promise((resolve,reject)=>{
  const tx=db.transaction('state','readwrite'),store=tx.objectStore('state'),values={};let count=0,result;
  tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Entwürfe konnten nicht gespeichert werden.'));
  for(const key of ['editor-drafts','ritual-draft','draft']){
   const request=store.get(key);request.onsuccess=()=>{values[key]=request.result;if(++count===3){try{result=change(values);for(const key of Object.keys(values))store.put(values[key],key);}catch(error){tx.abort();reject(error);}}};
  }
 });
}
// Remove only the selected draft keys, atomically; undo never replaces a newer draft.
export async function removeDrafts(keys){
 const selected=new Set(keys);
 const removed=await changeDrafts(values=>{
  const saved={blocks:{},ritual:null,legacy:null},blocks={...values['editor-drafts']};
  for(const key of selected)if(blocks[key]){saved.blocks[key]=blocks[key];delete blocks[key];}
  values['editor-drafts']=blocks;
  if(selected.has('ritual-draft')){saved.ritual=values['ritual-draft'];values['ritual-draft']=null;}
  const legacy=values.draft,legacyKey=legacy?legacy._draftKey||(legacy.id?'block:'+legacy.id:'new'):null;
  if(selected.has(legacyKey)){saved.legacy=legacy;values.draft=null;}
  return saved;
 });
 return ()=>changeDrafts(values=>{
  values['editor-drafts']={...removed.blocks,...values['editor-drafts']};
  if(!values['ritual-draft']&&removed.ritual)values['ritual-draft']=removed.ritual;
  if(!values.draft&&removed.legacy)values.draft=removed.legacy;
 });
}

// Library and routine references must commit together, including on quota failure.
export async function writeLibraryChange(product,{put=[],remove=[]}={}) {
  const db=await open();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(['state','blocks'],'readwrite');
    tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Speichern abgebrochen.'));
    try {
      tx.objectStore('state').put(structuredClone(product),'product-v3');
      const blocks=tx.objectStore('blocks');
      remove.forEach(id=>blocks.delete(id));put.forEach(block=>blocks.put(structuredClone(block)));
    } catch(error) { tx.abort();reject(error); }
  });
}
