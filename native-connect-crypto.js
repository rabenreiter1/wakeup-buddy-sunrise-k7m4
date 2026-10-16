export const HANDOFF_PROTOCOL='wakeupbuddy-native-voice-v1';
const encoder=new TextEncoder();
export function encode64(bytes){return btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');}
export function decode64(value){if(!/^[A-Za-z0-9_-]+$/.test(value))throw Error('Ungültige Verbindung.');return Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));}
export async function validateHandoff(nativeKey,state){
    if(!/^[A-Za-z0-9_-]{43}$/.test(state)||!/^[A-Za-z0-9_-]{87}$/.test(nativeKey))throw Error('Bitte starte die Verbindung erneut in Wakeup Buddy.');
    const point=decode64(nativeKey);if(point.length!==65||point[0]!==4)throw Error('Ungültiger App-Schlüssel.');
    return crypto.subtle.importKey('raw',point,{name:'ECDH',namedCurve:'P-256'},false,[]);
}
export async function encryptHandoff(nativeKey,state,payload){
    const recipient=await validateHandoff(nativeKey,state);
    const pair=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
    const shared=await crypto.subtle.deriveBits({name:'ECDH',public:recipient},pair.privateKey,256);
    const material=await crypto.subtle.importKey('raw',shared,'HKDF',false,['deriveKey']);
    const key=await crypto.subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt:encoder.encode(state),info:encoder.encode(HANDOFF_PROTOCOL)},material,{name:'AES-GCM',length:256},false,['encrypt']);
    new Uint8Array(shared).fill(0);
    const iv=crypto.getRandomValues(new Uint8Array(12));
    const additionalData=encoder.encode(`${HANDOFF_PROTOCOL}:${state}:${nativeKey}`);
    const data=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData,tagLength:128},key,encoder.encode(JSON.stringify(payload)));
    return {state,key:encode64(await crypto.subtle.exportKey('raw',pair.publicKey)),iv:encode64(iv),data:encode64(data)};
}
