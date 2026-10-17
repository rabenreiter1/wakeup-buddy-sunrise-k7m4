import {AI_CONFIG} from './ai-config.js';
import {validateHandoff,encryptHandoff} from './native-connect-crypto.js';
const params=new URLSearchParams(location.search),nativeKey=params.get('key')||'',state=params.get('state')||'';
const embedded=params.get('embedded')==='1';if(embedded)document.documentElement.classList.add('embedded');
const button=document.getElementById('connect'),status=document.getElementById('status'),open=document.getElementById('open-app'),cancel=document.getElementById('cancel');
const callback=values=>{const url=new URL('wakeupbuddy-native://voice-auth');for(const [key,value]of Object.entries(values))url.searchParams.set(key,value);return url.href;};
let scriptPromise;
function loadChallenge(){
    if(window.turnstile)return Promise.resolve();
    return scriptPromise ||= new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;script.onload=resolve;script.onerror=()=>{scriptPromise=null;reject(Error('Die Zugriffsprüfung ist nicht erreichbar.'));};document.head.append(script);});
}
function challenge(){return new Promise((resolve,reject)=>{
    let widget,timer,settled=false;
    const finish=(error,token)=>{if(settled)return;settled=true;clearTimeout(timer);if(widget!==undefined)window.turnstile.remove(widget);error?reject(Error(error)):resolve(token);};
    timer=setTimeout(()=>finish('Die Zugriffsprüfung hat zu lange gedauert. Bitte erneut versuchen.'),90000);
    widget=window.turnstile.render(document.getElementById('verification'),{sitekey:AI_CONFIG.turnstileSiteKey,action:'wakeup-ai',size:'flexible',appearance:'interaction-only',callback:token=>finish(null,token),'error-callback':code=>{if(/^[0-9]{6}$/.test(String(code)))console.warn('Native verification failed ('+code+')');finish('Der Zugriff konnte nicht bestätigt werden.');},'expired-callback':()=>finish('Bitte bestätige den Zugriff erneut.')});
});}
try {
    await validateHandoff(nativeKey,state);cancel.href=callback({state,cancelled:'1'});cancel.hidden=false;button.disabled=false;
} catch(error) {status.textContent=error.message;}
button.onclick=async()=>{
    button.disabled=true;status.textContent='Zugriff wird geprüft …';
    try {
        await loadChallenge();const token=await challenge();
        let payload;
        if(params.get('native-session')==='1'){
            // Native HTTP creates the session after the Worker validates this one-use proof.
            // This keeps the session bound to the network used by native service requests.
            payload={challengeToken:token,issuedAt:Date.now()};
        }else{
            const response=await fetch(AI_CONFIG.apiBase.replace(/\/$/,'')+'/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token}),credentials:'omit',cache:'no-store',redirect:'error'});
            const session=await response.json();if(!response.ok)throw Error(session.message||'Die Verbindung ist gerade nicht verfügbar.');
            if(typeof session.token!=='string'||!Number.isFinite(session.expiresAt))throw Error('Die Verbindung konnte nicht geprüft werden.');
            payload={token:session.token,expiresAt:session.expiresAt};
        }
        const envelope=await encryptHandoff(nativeKey,state,payload);
        open.href=callback(envelope);open.hidden=false;button.hidden=true;status.textContent='Bereit. Öffne jetzt Wakeup Buddy.';
        if(embedded)location.href=open.href;
    } catch(error) {status.textContent=error.message||'Bitte erneut versuchen.';button.disabled=false;}
};
if(embedded&&!button.disabled)button.click();
