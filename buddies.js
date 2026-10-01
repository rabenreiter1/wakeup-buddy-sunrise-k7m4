import { readState } from './storage.js';
import { locale } from './i18n.js';
import {faceArt,faceReady} from './face-rig.js';

export const BUDDIES=[
 {id:'lumi',name:'Lumi',trait:'Warm & fürsorglich',gender:'Weiblich',color:'#efb6cc',rate:.92,pitch:1.08,intro:'Ich bin Lumi. Nimm dir einen Moment. Du musst gerade nichts leisten.'},
 {id:'nova',name:'Nova',trait:'Klar & motivierend',gender:'Weiblich',color:'#f4b55f',rate:1.03,pitch:1.02,intro:'Ich bin Nova. Ein kleiner Anfang reicht. Wir machen den ersten Schritt zusammen.'},
 {id:'pip',name:'Pip',trait:'Verspielt & leicht',gender:'Weiblich',color:'#b8ccec',rate:1.08,pitch:1.2,intro:'Ich bin Pip. Ein neuer Morgen! Mal sehen, was heute Schönes auf dich wartet.'},
 {id:'momo',name:'Momo',trait:'Gelassen & sanft',gender:'Männlich',color:'#b5a1de',rate:.85,pitch:.9,intro:'Ich bin Momo. Erst einmal ankommen. Alles andere hat noch einen Moment.'},
 {id:'nori',name:'Nori',trait:'Ruhig & strukturiert',gender:'Männlich',color:'#9cc7ad',rate:.95,pitch:.93,intro:'Ich bin Nori. Was ist heute wichtig? Wir beginnen mit einer Sache.'},
 {id:'kumo',name:'Kumo',trait:'Neugierig & offen',gender:'Männlich',color:'#d3bc95',rate:1.01,pitch:1.03,intro:'Ich bin Kumo. Was möchtest du heute entdecken? Lass uns neugierig bleiben.'}
];
const kinds={lumi:'sun',nova:'star',pip:'flower',momo:'moon',nori:'drop',kumo:'cloud'};
for(const buddy of BUDDIES)buddy.kind=kinds[buddy.id];
let chosen='lumi';try{chosen=(await readState('product-v3'))?.profile?.buddy||chosen;}catch{}
export const selectedBuddy=()=>BUDDIES.find(b=>b.id===chosen)||BUDDIES[0];
export function selectBuddy(id){chosen=BUDDIES.some(b=>b.id===id)?id:'lumi';}
export function buddyArt(id=chosen){
 const b=BUDDIES.find(b=>b.id===id)||selectedBuddy();
 return '<span class="buddy-character buddy-bitmap buddy-'+b.id+'" data-buddy="'+b.id+'" data-character="'+b.kind+'" data-face-ready="'+faceReady(b.kind)+'" role="img" aria-label="'+b.name+'"><span class="buddy-body"><img class="buddy-portrait" src="assets/felt-'+b.kind+'.png" width="220" height="220" alt="" aria-hidden="true" draggable="false">'+faceArt(b.kind)+'</span></span>';
}
export function setBuddySpeaking(root,active){
 if(!root)return;const buddies=root.matches?.('.buddy-character')?[root]:root.querySelectorAll('.buddy-character');
 for(const buddy of buddies){const value=active&&!matchMedia('(prefers-reduced-motion: reduce)').matches?'true':'false';if(buddy.dataset.speaking!==value)buddy.dataset.speaking=value;if(!active)delete buddy.dataset.phoneme;}
}
const reactions=new WeakMap();
export function reactToBuddy(root){
 const buddy=root?.matches?.('.buddy-character')?root:root?.querySelector('.buddy-character');if(!buddy)return;
 for(const timer of reactions.get(buddy)||[])clearTimeout(timer);
 delete buddy.dataset.reacting;delete buddy.dataset.eyeState;
 void buddy.offsetWidth; // Restart a repeated tap, without stacking animations.
 buddy.dataset.reacting='true';
 const timers=[];
 if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
  buddy.dataset.eyeState='half';
  timers.push(setTimeout(()=>buddy.dataset.eyeState='blink',70),setTimeout(()=>buddy.dataset.eyeState='open',170));
 }
 timers.push(setTimeout(()=>{delete buddy.dataset.reacting;delete buddy.dataset.eyeState;reactions.delete(buddy);},850));
 reactions.set(buddy,timers);
}
const mouthTimers=new WeakMap();
export function buddySpeechBoundary(root,word=''){
 const buddy=root?.matches?.('.buddy-character')?root:root?.querySelector('.buddy-character');if(!buddy||buddy.dataset.speaking!=='true')return;
 clearTimeout(mouthTimers.get(buddy));buddy.dataset.phoneme=/[ouöü]/i.test(word)?'round':/[aeä]/i.test(word)?'wide':'small';
 mouthTimers.set(buddy,setTimeout(()=>delete buddy.dataset.phoneme,150));
}
const female=/female|woman|katja|hedda|zira|jenny|aria|sara|hazel|susan|denise|hortense|julie|eloise|elsa/i;
const male=/male|man|conrad|stefan|david|guy|ryan|george|paul|henri|claude/i;
export function buddyVoice(b=selectedBuddy()){
 const language=locale().slice(0,2),voices=(window.speechSynthesis?.getVoices()||[]).filter(v=>v.lang.toLowerCase().startsWith(language));
 const preferred=voices.filter(v=>b.gender==='Weiblich'?female.test(v.name):male.test(v.name)&&!female.test(v.name));
 const rank=BUDDIES.filter(x=>x.gender===b.gender).findIndex(x=>x.id===b.id);
 return preferred[rank%Math.max(1,preferred.length)]||voices[rank%Math.max(1,voices.length)]||null;
}
export function styleUtterance(utterance,b=selectedBuddy()){utterance.lang=locale();utterance.rate=b.rate;utterance.pitch=b.pitch;const voice=buddyVoice(b);if(voice)utterance.voice=voice;}
const intros={en:["I’m Lumi. Take a moment. You don’t have to achieve anything right now.","I’m Nova. A small beginning is enough. Let’s take the first step together.","I’m Pip. A new morning! Let’s see what good things today has in store.","I’m Momo. Let’s settle in first. Everything else can wait a moment.","I’m Nori. What matters today? Let’s begin with one thing.","I’m Kumo. What would you like to discover today? Let’s stay curious."],fr:["Je suis Lumi. Prenez un moment pour vous. Vous n’avez rien à accomplir tout de suite.","Je suis Nova. Un petit début suffit. Faisons le premier pas ensemble.","Je suis Pip. Un nouveau matin ! Voyons quelles belles choses nous attendent.","Je suis Momo. Prenons d’abord le temps d’arriver. Le reste peut attendre un instant.","Je suis Nori. Qu’est-ce qui compte aujourd’hui ? Commençons par une chose.","Je suis Kumo. Que souhaitez-vous découvrir aujourd’hui ? Restons curieux."]};
let preview=null,previewGeneration=0;
export function stopBuddyPreview(){previewGeneration++;if(preview)window.speechSynthesis?.cancel();preview=null;document.querySelectorAll('.buddy-option').forEach(el=>setBuddySpeaking(el,false));}
export function previewBuddy(id,onEnd){stopBuddyPreview();const b=BUDDIES.find(b=>b.id===id);if(!window.speechSynthesis||!window.SpeechSynthesisUtterance){onEnd?.();return;}const u=new SpeechSynthesisUtterance(intros[locale().slice(0,2)]?.[BUDDIES.indexOf(b)]||b.intro),generation=previewGeneration,figure=()=>document.querySelector('.buddy-option [data-buddy="'+id+'"]');styleUtterance(u,b);preview=u;u.onstart=()=>{if(generation===previewGeneration)setBuddySpeaking(figure(),true);};u.onboundary=e=>{if(generation===previewGeneration)buddySpeechBoundary(figure(),u.text.slice(e.charIndex).split(/\s/)[0]);};u.onend=u.onerror=()=>{if(generation===previewGeneration){setBuddySpeaking(figure(),false);preview=null;onEnd?.();}};window.speechSynthesis.speak(u);}
