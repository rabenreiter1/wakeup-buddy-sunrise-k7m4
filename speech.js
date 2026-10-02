import {askAI} from './ai-client.js';
import {audioContext} from './audio.js';
let current=null;
const memory=new Map();
// Unlock the shared context in the original tap, before fetching or decoding TTS.
// A media element created after that await loses user activation on iPhone Safari.
function speechContext(){try{return audioContext();}catch{return null;}}
async function decodedAudio(context,data){
 if(!context)throw new Error('Die Sprachausgabe wird von diesem Browser nicht unterstützt.');
 const bytes=Uint8Array.from(atob(data.audioBase64),c=>c.charCodeAt(0));
 const buffer=await context.decodeAudioData(bytes.buffer);
 let source=null,offset=0,startedAt=0,disposed=false,attempt=0;
 const position=()=>Math.min(buffer.duration,offset+(source?Math.max(0,context.currentTime-startedAt):0));
 const stopSource=()=>{if(!source)return;const old=source;source=null;old.onended=null;old.stop();old.disconnect();};
 const audio={
  get paused(){return !source;},
  get currentTime(){return position();},
  set currentTime(value){audio.pause();offset=Math.max(0,Math.min(buffer.duration,Number(value)||0));},
  async play(){
   if(disposed||source)return;
   const ownAttempt=++attempt;
   if(context.state!=='running'){
    let timer;try{await Promise.race([context.resume(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Tippe auf „Erneut versuchen“, um die Sprachausgabe zu starten.')),1500);})]);}finally{clearTimeout(timer);}
   }
   if(disposed||ownAttempt!==attempt)return;
   if(context.state!=='running')throw new Error('Tippe auf „Erneut versuchen“, um die Sprachausgabe zu starten.');
   if(offset>=buffer.duration){audio.onended?.();return;}
   const next=context.createBufferSource();next.buffer=buffer;next.connect(context.destination);source=next;startedAt=context.currentTime;
   next.onended=()=>{if(source!==next||disposed)return;source=null;offset=buffer.duration;next.disconnect();audio.onended?.();};
   next.start(0,offset);audio.onplaying?.();
  },
  pause(){attempt++;offset=position();stopSource();},
  dispose(){audio.pause();disposed=true;audio.onplaying=null;audio.onended=null;}
 };
 return audio;
}
async function audioKey(text,buddyId,language){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([text,buddyId,language,'eleven-v4-1'])));return new URL('./__voice_cache__/'+[...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,'0')).join(''),import.meta.url).href;}
async function getAudio(text,buddyId,language,signal){
 const key=await audioKey(text,buddyId,language);if(memory.has(key))return memory.get(key);
 let cache;try{cache=await caches.open('wakeup-voice-v1');const hit=await cache.match(key);if(hit){const value=await hit.json();memory.set(key,value);return value;}}catch{}
 const value=await askAI('/api/tts',{text,buddyId,language:language.slice(0,2)},signal);signal.throwIfAborted();
 memory.set(key,value);if(memory.size>30)memory.delete(memory.keys().next().value);
 if(cache)try{await cache.put(key,new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}}));const keys=await cache.keys();for(const old of keys.slice(0,-60))await cache.delete(old);}catch{}
 return value;
}
export function stopSpeech(){current?.stop();}
// One synthesis per guided step; alignment slices let the local clock provide real pauses.
export function speakGuide({cues,buddyId,language,onReady,onStart,onBoundary,onSilent,onError}){
 stopSpeech();const context=speechContext(),abort=new AbortController();let audio,frame,alignment,stopped=false,paused=false,index=-1,elapsed=0,ends=[],starts=[],lastChar=-1;
 const offsets=[];let text='';for(const cue of cues){if(text)text+='\n';offsets.push(text.length);text+=cue.text.trim();}
 const failure=error=>{if(stopped||error.name==='AbortError')return;session.stop();onError?.(error);};
 const session={
  stop(){if(stopped)return;stopped=true;abort.abort();cancelAnimationFrame(frame);audio?.dispose();if(current===session)current=null;},
  pause(){paused=true;audio?.pause();},
  resume(){if(!paused)return;paused=false;if(audio&&index>=0&&audio.currentTime<ends[index])audio.play().catch(failure);},
  setTime(time){elapsed=time;if(!audio||stopped||paused)return;let next=-1;for(let i=0;i<cues.length;i++)if(cues[i].at<=time)next=i;if(next<0||next===index)return;index=next;lastChar=-1;audio.currentTime=starts[index];audio.play().catch(failure);}
 };
 current=session;
 (async()=>{try{
  if(!context)throw new Error('Die Sprachausgabe wird von diesem Browser nicht unterstützt.');
  const data=await getAudio(text,buddyId,language,abort.signal);if(stopped)return;
  alignment=data.alignment;const chars=alignment?.characters||[],begin=alignment?.character_start_times_seconds||[],end=alignment?.character_end_times_seconds||[];
  if(chars.join('')!==text||begin.length!==text.length||end.length!==text.length)throw new Error('Die Zeitmarken dieser Führung konnten nicht zugeordnet werden. Bitte erneut versuchen.');
  starts=offsets.map(n=>begin[n]);ends=offsets.map((n,i)=>end[n+cues[i].text.trim().length-1]);
  if(cues.some((c,i)=>i<cues.length-1&&ends[i]-starts[i]>cues[i+1].at-c.at))throw new Error('Ein Hinweis ist länger als seine Pause. Erhöhe im Editor den Abstand zwischen den Hinweisen.');
  audio=await decodedAudio(context,data);if(stopped){audio.dispose();return;}
  audio.onplaying=()=>onStart?.();audio.onended=()=>onSilent?.();
  const follow=()=>{if(stopped)return;if(index>=0&&!audio.paused){if(audio.currentTime>=ends[index]){audio.pause();onSilent?.();}else{let n=offsets[index];while(n<begin.length&&begin[n]<=audio.currentTime)n++;n--;if(n!==lastChar){lastChar=n;onBoundary?.({charIndex:n-offsets[index],word:chars.slice(n,n+20).join('').split(/\s/)[0]||''});}}}frame=requestAnimationFrame(follow);};follow();onReady?.();session.setTime(elapsed);
 }catch(error){failure(error);}})();return session;
}
export function speak({text,buddyId,language,onStart,onBoundary,onEnd,onError}){
 stopSpeech();const context=speechContext(),abort=new AbortController();let audio=null,stopped=false,paused=false,last=-1,frame;
 const cleanup=()=>{cancelAnimationFrame(frame);audio?.dispose();};
 const session={stop(){if(stopped)return;stopped=true;abort.abort();cleanup();if(current===session)current=null;},pause(){paused=true;audio?.pause();},resume(){paused=false;if(audio&&!stopped)audio.play().catch(error=>failure(error));}};
 const failure=error=>{if(stopped||error.name==='AbortError')return;session.stop();onError?.(error);};
 current=session;
 (async()=>{
 try{if(!context)throw new Error('Die Sprachausgabe wird von diesem Browser nicht unterstützt.');const data=await getAudio(text,buddyId,language,abort.signal);if(stopped)return;
 audio=await decodedAudio(context,data);if(stopped){audio.dispose();return;}
 audio.onplaying=()=>{if(!stopped)onStart?.();};audio.onended=()=>{session.stop();onEnd?.();};
 const a=data.alignment,starts=a?.character_start_times_seconds||[],chars=a?.characters||[];
 const follow=()=>{if(stopped)return;if(!audio.paused){let i=last+1;while(i<starts.length&&starts[i]<=audio.currentTime)i++;const index=i-1;if(index>last){last=index;onBoundary?.({charIndex:index,word:chars.slice(index,index+20).join('').split(/\s/)[0]||''});}}frame=requestAnimationFrame(follow);};follow();
 if(!paused)await audio.play();
 }catch(error){failure(error);}
 })();return session;
}
