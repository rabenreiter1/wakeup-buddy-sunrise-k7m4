import {AI_CONFIG} from './ai-config.js';
let auth=null,scriptPending=null,authPending=null;
export class AIError extends Error{constructor(message,code='unavailable'){super(message);this.code=code;}}
export const aiConfigured=()=>Boolean(AI_CONFIG.apiBase&&AI_CONFIG.turnstileSiteKey);
function loadTurnstile(){
 if(window.turnstile)return Promise.resolve();if(scriptPending)return scriptPending;
 scriptPending=new Promise((resolve,reject)=>{const el=document.createElement('script');el.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';el.async=true;el.onload=resolve;el.onerror=()=>{scriptPending=null;reject(new AIError('Die Zugriffsprüfung ist nicht erreichbar.'));};document.head.append(el);});return scriptPending;
}
function challenge(signal){return new Promise((resolve,reject)=>{
 signal?.throwIfAborted();
 const host=document.createElement('div');host.className='ai-challenge';host.setAttribute('role','status');host.setAttribute('aria-label','Zugriff wird geprüft');(document.querySelector('dialog[open]:not([data-closing])')||document.body).append(host);
 let widget,timer,settled=false;const abort=()=>finish(new DOMException('Abgebrochen','AbortError'));
 const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);if(widget!==undefined)window.turnstile.remove(widget);host.remove();error?reject(error instanceof Error?error:new AIError(error)):resolve(value);};
 signal?.addEventListener('abort',abort,{once:true});
 timer=setTimeout(()=>finish('Die Zugriffsprüfung hat zu lange gedauert.'),90000);
 widget=window.turnstile.render(host,{sitekey:AI_CONFIG.turnstileSiteKey,action:'wakeup-ai',appearance:'interaction-only',callback:token=>finish(null,token),'error-callback':()=>finish('Der Zugriff konnte nicht bestätigt werden.'),'expired-callback':()=>finish('Bitte bestätige den Zugriff erneut.')});
});}
async function request(path,input,{signal,token}={}){
 let response;try{response=await fetch(AI_CONFIG.apiBase.replace(/\/$/,'')+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(input),signal});}catch(error){if(error.name==='AbortError')throw error;throw new AIError('Die Verbindung zum KI-Dienst ist unterbrochen.');}
 let data;try{data=await response.json();}catch{throw new AIError('Die Antwort konnte nicht gelesen werden.');}
 if(!response.ok)throw new AIError(data.message||'Der Dienst ist gerade nicht verfügbar.',data.code);return data;
}
async function authorization(signal){
 if(auth?.expiresAt>Date.now()+10000)return auth.token;
 if(!authPending)authPending=(async()=>{await loadTurnstile();signal?.throwIfAborted();auth=await request('/api/session',{token:await challenge(signal)},{signal});return auth.token;})().finally(()=>{authPending=null;});
 const token=await authPending;signal?.throwIfAborted();return token;
}
export async function askAI(path,input,signal){
 if(!aiConfigured())throw new AIError('Die KI-Anbindung ist noch nicht freigeschaltet.','not_configured');
 const token=await authorization(signal);signal?.throwIfAborted();
 try{return await request(path,input,{signal,token});}catch(error){if(error.code==='session_expired')auth=null;throw error;}
}
export const research=(query,language,signal)=>askAI('/api/research',{query,language:language.slice(0,2),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone},signal);
