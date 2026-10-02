import {speak} from './speech.js';
import { readState } from './storage.js';
import { locale } from './i18n.js';
import {faceArt,faceReady} from './face-rig.js';

export const BUDDIES=[
 {id:'lumi',name:'Lumi',trait:'Warm & fürsorglich',gender:'Weiblich',color:'#efb6cc',intro:'Ich bin Lumi. Nimm dir einen Moment. Du musst gerade nichts leisten.'},
 {id:'nova',name:'Nova',trait:'Klar & motivierend',gender:'Weiblich',color:'#f4b55f',intro:'Ich bin Nova. Ein kleiner Anfang reicht. Wir machen den ersten Schritt zusammen.'},
 {id:'pip',name:'Pip',trait:'Verspielt & leicht',gender:'Weiblich',color:'#b8ccec',intro:'Ich bin Pip. Ein neuer Morgen! Mal sehen, was heute Schönes auf dich wartet.'},
 {id:'momo',name:'Momo',trait:'Gelassen & sanft',gender:'Männlich',color:'#b5a1de',intro:'Ich bin Momo. Erst einmal ankommen. Alles andere hat noch einen Moment.'},
 {id:'nori',name:'Nori',trait:'Ruhig & strukturiert',gender:'Männlich',color:'#9cc7ad',intro:'Ich bin Nori. Was ist heute wichtig? Wir beginnen mit einer Sache.'},
 {id:'kumo',name:'Kumo',trait:'Neugierig & offen',gender:'Männlich',color:'#d3bc95',intro:'Ich bin Kumo. Was möchtest du heute entdecken? Lass uns neugierig bleiben.'}
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
const intros={en:["I’m Lumi. Take a moment. You don’t have to achieve anything right now.","I’m Nova. A small beginning is enough. Let’s take the first step together.","I’m Pip. A new morning! Let’s see what good things today has in store.","I’m Momo. Let’s settle in first. Everything else can wait a moment.","I’m Nori. What matters today? Let’s begin with one thing.","I’m Kumo. What would you like to discover today? Let’s stay curious."],fr:["Je suis Lumi. Prenez un moment pour vous. Vous n’avez rien à accomplir tout de suite.","Je suis Nova. Un petit début suffit. Faisons le premier pas ensemble.","Je suis Pip. Un nouveau matin ! Voyons quelles belles choses nous attendent.","Je suis Momo. Prenons d’abord le temps d’arriver. Le reste peut attendre un instant.","Je suis Nori. Qu’est-ce qui compte aujourd’hui ? Commençons par une chose.","Je suis Kumo. Que souhaitez-vous découvrir aujourd’hui ? Restons curieux."]};
let preview=null,previewGeneration=0;
export function stopBuddyPreview(){previewGeneration++;preview?.stop();preview=null;document.querySelectorAll('.buddy-option').forEach(el=>setBuddySpeaking(el,false));}
export function previewBuddy(id,onEnd){
 stopBuddyPreview();const b=BUDDIES.find(b=>b.id===id);if(!b){onEnd?.();return;}
 const generation=previewGeneration,figure=()=>document.querySelector('.buddy-option [data-buddy="'+id+'"]');
 const finish=error=>{if(generation!==previewGeneration)return;setBuddySpeaking(figure(),false);preview=null;onEnd?.(error);};
 preview=speak({text:intros[locale().slice(0,2)]?.[BUDDIES.indexOf(b)]||b.intro,buddyId:id,language:locale(),
 onStart:()=>{if(generation===previewGeneration)setBuddySpeaking(figure(),true);},
 onBoundary:e=>{if(generation===previewGeneration)buddySpeechBoundary(figure(),e.word);},onEnd:()=>finish(),onError:finish});
}
