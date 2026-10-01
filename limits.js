export const MAX_STEPS=10;
export const MAX_BLOCKS=10;
export const isOwnRoutine=r=>r?.ownership==='own'||(!r?.ownership&&!r?.sourceId&&!r?.author);
export function editableCopy(r){const copy=structuredClone(r);copy.id=crypto.randomUUID();copy.ownership='own';copy.derivedFrom={id:r.sourceId||r.id,author:r.author||'Du'};delete copy.sourceId;copy.author='Du';copy.alarm={enabled:false,time:'07:00',days:[],tone:'sunrise'};return copy;}
