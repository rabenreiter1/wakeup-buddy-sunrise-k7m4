import {guidanceCues} from './guidance.js';
import {researchRequest as prepareResearch,locationForm,requestLocation,saveResearchPreferences} from './research-context.js';
import {speak,speakGuide} from './speech.js';
import {research} from './ai-client.js';
import {readState,writeState} from './storage.js';
import {animateScreen} from './sheets.js';
import {lockAppearance,unlockAppearance} from './theme.js';
import { buddyArt,selectedBuddy,setBuddySpeaking,buddySpeechBoundary } from './buddies.js';
import { localPhoto } from './media.js';
import { locale, translateUI } from './i18n.js';
import { symbol, visualStyle,colorOf } from './appearance.js';
import { lavaMarkup } from './lava.js';
import { researchFor,resolveStepOutput } from './research-data.js';
import { icon } from './icons.js';
import { time, restoreDraft, contentIssues, outputIssue } from './model.js';
import { renderRich, richField, hydrateRich } from './richtext.js';
import { unlockAudio, setMusic, stopMusic, stopAudition,restartMusic } from './audio.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const themes = ['peach', 'lilac', 'lime', 'sky', 'rose'];
const labels = { buddy: 'Audio', text: 'Text', original: 'Text' };
const $ = (s, root = document) => root.querySelector(s);
const announce = value => { $('#announcer').textContent = value; };
const minutes = block => block.steps.reduce((sum, s) => sum + s.minutes, 0);

// Felt characters share the same visual language across home,
// stories and completion. They are decorative; all controls have text labels.
export { mascot } from './characters.js';
import { mascot } from './characters.js';
const overlay = document.createElement('div'); overlay.id = 'story-overlay'; overlay.hidden = true; document.body.append(overlay);
let homeCallback;
let player = null, gesture = null, tick, lastTick = 0, transitionTimer, savedScroll = 0, lastCheckpoint=0, recorder, mediaStream;
export function configureExperience({ onHome }) { homeCallback = onHome; }
export async function openRitual() { closeStory(false); return homeCallback?.(); }
export function showStorySaveError(message,retry){
 if(!player||overlay.hidden)return false;
 let banner=overlay.querySelector('.story-save-error');
 if(!banner){banner=document.createElement('div');banner.className='story-save-error';banner.setAttribute('role','alert');banner.dataset.interactive='';banner.innerHTML='<span></span><button>Erneut versuchen</button>';overlay.append(banner);}
 banner.querySelector('span').textContent=message;
 const button=banner.querySelector('button');button.onclick=async()=>{button.disabled=true;try{await retry();banner.remove();}catch{button.disabled=false;}};
 translateUI(banner);return true;
}

const blockNow = () => player.blocks[player.b];
const stepNow = () => blockNow().steps[player.s];
const keyNow = () => `${player.b}:${player.s}`;
function stateNow() {
  const key = keyNow();
  if (!player.states[key]) player.states[key] = { elapsed: 0, paused: false, text: '', memo: false, recording: false, recordSeconds: 0, photos: [], outcome: 'success', finished: false, showTranscript: false, scrollTop: 0 };
  return player.states[key];
}
function running() { return player && !player.done && !player.transitioning && !player.hold && !document.hidden && !stateNow().paused && !['loading','error'].includes(stateNow().researchStatus) && !stateNow().speechError && (!stepNow().timer || stateNow().elapsed < stepNow().minutes * 60 || stateNow().speaking); }
function ready() { const state = stateNow(); return stepNow().input === 'none' || stepNow().input === 'text' && state.text.trim() || stepNow().input === 'voice' && state.memo && !state.recording || stepNow().input === 'photo' && state.photos.length; }
export function openStory(blocks, options = {}) {
  if (!blocks.length) return;
  closeStory(false); lockAppearance(); stopAudition(); unlockAudio();
  player = { blocks: structuredClone(blocks), b: options.startIndex || 0, s: 0, states: {}, onClose: options.onClose, onReport: options.onReport, title: options.title, onCheckpoint:options.onCheckpoint,returnLabel:options.returnLabel,resumed:Boolean(options.resume),reported: false, startedAt: new Date().toISOString(), preview: options.preview, done: false, hold: false, transitioning: false };
  if(options.resume){player.b=options.resume.b;player.s=options.resume.s;player.states=structuredClone(options.resume.states);player.startedAt=options.resume.startedAt;Object.values(player.states).forEach(state=>{state.recording=false;state.speaking=false;state.speechLoading=false;if(state.researchStatus==='loading')state.researchStatus='idle';});stateNow().paused=false;stateNow().spoken=false;}
  savedScroll = scrollY; document.body.classList.add('story-open'); overlay.hidden = false;
  overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true'); overlay.setAttribute('aria-label', options.preview ? 'Baustein-Vorschau' : 'Dein Morgenritual');
  const shell = $('#product-app'); if (shell) shell.inert = true; $('#app').inert = true;
  renderPlayer();animateScreen($('.story-viewport',overlay),'tab');checkpoint(); lastTick = performance.now(); tick = setInterval(updateClock, 50); $('.story-close', overlay).focus({ preventScroll: true });
  const session=player;
  if(!player.preview)readState('story-hint-seen').then(seen=>{if(seen||player!==session||player.done)return;const hint=document.createElement('div');hint.className='story-first-hint';hint.dataset.interactive='';hint.innerHTML='<span>Rechts tippen: weiter. Links: neu starten.<br>Noch einmal links: zurück.</span><button aria-label="Hinweis schließen">×</button>';hint.querySelector('button').onclick=()=>hint.remove();$('.story-face',overlay).append(hint);translateUI(hint);writeState('story-hint-seen',true).catch(()=>{});}).catch(()=>{});
}
export function closeStory(notify = true) {
  if (!player) return;
  clearInterval(tick); clearTimeout(transitionTimer); clearTimeout(gesture?.holdTimer); gesture = null;
  photoDialog?.close();cancelResearch();checkpoint();reportRun(); stopMusic(); cancelSpeech();
  mediaStream?.getTracks().forEach(t=>t.stop());mediaStream=null;const callback = player.onClose; player = null;
  overlay.hidden = true; overlay.innerHTML = ''; document.body.classList.remove('story-open');unlockAppearance(); const shell = $('#product-app'); if (shell) shell.inert = false; $('#app').inert = false; window.scrollTo(0, savedScroll);
  if (notify) {callback?.();const target=document.querySelector('#product-app:not([hidden]),#app:not([hidden])');if(target)animateScreen(target,'back');}
}
function outputText(){
 return resolveStepOutput(stepNow(),stateNow()).text;
}
let speechSession=null,speechGeneration=0;
function cancelSpeech(){speechGeneration++;speechSession?.audio?.stop();if(speechSession){speechSession.state.speaking=false;speechSession.state.speechLoading=false;}speechSession=null;setBuddySpeaking(overlay,false);}

function followSpeech(element,charIndex=0){
 const card=$('.story-text-card',overlay);if(!card||!element?.isConnected||!running())return;
 let rect=element.getBoundingClientRect();
 if(charIndex>0){const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT);let node,left=charIndex;while(node=walker.nextNode()){if(left<node.length){const range=document.createRange();range.setStart(node,left);range.setEnd(node,Math.min(node.length,left+1));rect=range.getBoundingClientRect();break;}left-=node.length;}}
 const box=card.getBoundingClientRect();if(rect.top<box.top||rect.top>box.top+box.height*.6){card.scrollTo({top:Math.max(0,card.scrollTop+rect.top-box.top-28),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
}
function speakPart(session){
 if(speechSession!==session||!player||player.done)return;
 const part=session.parts[session.index];if(!part){session.state.speaking=false;speechSession=null;updateVisuals();return;}
 session.pending=false;session.audible=false;session.state.speechPart=session.index;session.state.speechLoading=true;
 const generation=speechGeneration,current=()=>speechSession===session&&speechGeneration===generation;
 session.audio=speak({text:part.text,buddyId:selectedBuddy().id,language:locale(),
 onStart:()=>{if(current()){session.audible=true;session.state.speechLoading=false;session.state.speaking=true;followSpeech(part.element);updateVisuals();}},
 onBoundary:e=>{if(current()){followSpeech(part.element,e.charIndex);buddySpeechBoundary($('.story-symbol',overlay),e.word);}},
 onEnd:()=>{if(!current())return;session.index++;session.state.speaking=false;if(session.index>=session.parts.length){speechSession=null;updateVisuals();}else if(running())speakPart(session);else session.pending=true;},
 onError:error=>{if(current()){session.state.speaking=false;session.state.speechLoading=false;session.state.speechError=error.message;speechSession=null;renderPlayer();}}
 });
}
function syncSpeech(){
 if(!player||player.done||blockNow().output!=='buddy'||stateNow().textOnly||resolveStepOutput(stepNow(),stateNow()).kind==='unavailable'||stepNow().research&&stateNow().outcome!=='success'){if(speechSession)cancelSpeech();return;}
 const state=stateNow(),key=keyNow();
 if(speechSession&&speechSession.key!==key)cancelSpeech();
 if(!running()){if(speechSession&&!speechSession.paused){speechSession.paused=true;speechSession.audio?.pause();}return;}
 if(speechSession){if(speechSession.paused){speechSession.paused=false;speechSession.audio?.resume();}if(speechSession.pending)speakPart(speechSession);speechSession?.audio?.setTime?.(state.elapsed);return;}
 if(state.spoken)return;
 if(stepNow().guidance){
  state.spoken=true;state.speechLoading=true;const session={key,state,paused:false,audible:false};speechSession=session;const current=()=>speechSession===session;
  session.audio=speakGuide({cues:guidanceCues(stepNow().guidance),buddyId:selectedBuddy().id,language:locale(),onReady:()=>{if(current())state.speechLoading=false;},onStart:()=>{if(current()){session.audible=true;state.speaking=true;}},onBoundary:e=>{if(current())buddySpeechBoundary($('.story-symbol',overlay),e.word);},onSilent:()=>{if(current()){session.audible=false;state.speaking=false;}},onError:error=>{if(current()){state.speechLoading=false;state.speaking=false;state.speechError=error.message;speechSession=null;renderPlayer();}}});session.audio.setTime(state.elapsed);return;
 }

 const element=$('.spoken-copy',overlay),parts=[{element,text:(element?.innerText||outputText()).trim()}];
 state.spoken=true;speechSession={key,state,parts,index:0,paused:false};speakPart(speechSession);
}
let researchRequest=null;
function cancelResearch(){if(researchRequest){researchRequest.abort.abort();if(researchRequest.state.researchStatus==='loading')researchRequest.state.researchStatus='idle';researchRequest=null;}}
function ensureResearch(){
 if(!player||player.done||!stepNow().research)return;
 const state=stateNow(),step=stepNow();if(researchFor(step,state)||['loading','error'].includes(state.researchStatus))return;
 cancelResearch();const owner=player,key=keyNow(),abort=new AbortController();researchRequest={state,abort};state.researchStatus='loading';
 prepareResearch(step.message.text).then(query=>research(query,locale(),abort.signal)).then(result=>{
 if(player!==owner||keyNow()!==key||abort.signal.aborted)return;
 state.researchResult=result;state.researchStatus='ready';state.outcome='success';checkpoint();renderPlayer();
 }).catch(error=>{if(player!==owner||abort.signal.aborted||keyNow()!==key)return;state.researchStatus='error';state.outcome='error';state.researchError=error.message;state.researchErrorCode=error.code;renderPlayer();});
}
function storyContent(){
 const step=stepNow(),block=blockNow(),state=stateNow(),result=researchFor(step,state);
 const issue=step.research&&(state.outcome!=='success'||!result);
 const body=issue?(state.researchErrorCode==='location_required'?locationForm():state.researchStatus==='loading'?'<h2>Recherche läuft …</h2><p>Deine Zeit startet, sobald das Ergebnis da ist.</p><button class="story-pill" data-story="skip">Überspringen</button>':'<h2>Recherche nicht verfügbar</h2><p>'+esc(state.researchError||'Es liegt noch kein Ergebnis vor.')+'</p><button class="story-pill" data-story="retry">Erneut versuchen</button><button class="story-pill" data-story="skip">Überspringen</button>'):'<div class="spoken-copy" data-user-content>'+renderRich(outputText())+'</div>'+(result?'<div class="research-sources"><small>'+esc(step.demoResearch?'Redaktionelles Beispiel · 19.03.2025':'Recherchiert: '+new Date(result.retrievedAt).toLocaleString(locale()))+'</small>'+result.sources.map(source=>'<a class="story-source" href="'+esc(source.url)+'" target="_blank" rel="noopener noreferrer" data-interactive>'+esc(source.title)+' ↗</a>').join('')+'</div>':'');
 const speechIssue=state.speechError?'<div class="speech-error" role="status"><p>'+esc(state.speechError)+'</p><button class="story-pill" data-story="speech-retry">Erneut versuchen</button><button class="story-pill" data-story="speech-text">Als Text weiterlesen</button></div>':'';

 return `<div class="story-symbol" aria-hidden="true">${buddyArt()}</div><div class="story-step-label"><span>Schritt ${player.s+1} von ${block.steps.length}</span><span class="story-mode">${block.output==='buddy'?`<span class="audio-visual">${Array.from({length:7},(_,i)=>`<i style="--i:${i};--h:${8+i*5%15}px"></i>`).join('')}</span>Audio`:labels[block.output]}</span></div><article class="story-text-card formatted-text" tabindex="0" aria-label="Anweisung und Ausgabe">${speechIssue}${step.guidance?'<p class="guided-cue" role="status" aria-live="off"></p>':''}${body}</article>`;
}
function responseView(){
 const state=stateNow(),step=stepNow();
 let content='';
 if(step.input==='text')content=richField({id:'story-answer',value:state.text,placeholder:'Deine Gedanken …',label:'Deine Antwort'});
 else if(step.input==='voice')content=state.memo&&state.audio?'<div class="memo-playback"><audio controls src="'+state.audio+'" aria-label="Deine Aufnahme"></audio><button class="icon-btn" data-story="record" aria-label="Neu aufnehmen">'+icon('mic')+'</button></div>':'<button class="memo-record '+(state.recording?'recording':'')+'" data-story="record"><span class="record-circle">'+icon(state.recording?'stop':'mic')+'</span><span>'+(state.recording?'Aufnahme beenden':'Memo aufnehmen')+'<small>'+(state.recording?time(Math.floor(state.recordSeconds)):'Deine Gedanken, in deiner Stimme.')+'</small></span></button>';
 else if(step.input==='photo')content=`<div class="photo-stage"><label class="photo-response">${state.photos.length?`<img class="photo-inline" src="${state.photos[0]}" alt="Dein Foto im Ritual">`:icon('camera')}<span>${state.photos.length?'Foto wechseln':'Foto hinzufügen'}</span><input type="file" id="story-photo" accept="image/*" aria-label="Foto für dein Ritual auswählen"></label>${state.photos.length?'<button class="photo-expand" data-story="expand-photo" aria-label="Foto in Vollbild öffnen">↗</button>':''}</div>`;
 else content='';
 return `<div class="story-response input-${step.input}" data-interactive><div class="response-field">${content}</div><p class="story-input-error" role="alert" hidden></p><div class="response-actions">${step.input!=='none'?'<button data-story="skip" '+(state.recording?'disabled':'')+'>Überspringen</button>':'<span></span>'}</div></div>`;
}

function renderPlayer() {
  if (!player) return;
  if (player.done) { renderFinish(); return; }
  ensureResearch();
  const block = blockNow(), state = stateNow();
  const markup = `<div class="story-viewport"><section class="story-face output-${block.output} has-input-${stepNow().input}" tabindex="-1" aria-label="${esc(block.title)}, Schritt ${player.s + 1}" data-block="${player.b}" data-story-step="${player.s}">${lavaMarkup({blocks:[block]},{tint:.55,background:true,blockGradient:true})}<header class="story-header"><div class="story-progress" aria-label="Schrittfortschritt">${block.steps.map((s, i) => `<div class="story-segment"><span style="transform:scaleX(${i < player.s ? 1 : i === player.s ? Math.min(1, stepNow().timer?state.elapsed / (s.minutes * 60):0) : 0})"></span></div>`).join('')}</div><div class="story-topline"><span class="story-avatar" style="--block-color:${colorOf(block).bg}">${symbol(block)}</span><div class="story-owner"><b>${esc(block.title)}</b><span>${player.preview ? 'Vorschau' : `${player.b + 1} von ${player.blocks.length} Bausteinen`}</span></div><button class="story-pause round-button" data-story="pause" aria-label="${state.paused ? 'Fortsetzen' : 'Pausieren'}">${icon(state.paused ? 'play' : 'pause')}</button><button class="story-close round-button" data-story="close" aria-label="Story schließen">${icon('close')}</button></div></header>
  <div class="story-scroll"><div class="story-content">${storyContent()}</div>${responseView()}</div><footer class="story-footer"><span class="story-clock">${icon('timer')}<b>${stepNow().timer?time(Math.ceil(Math.max(0, stepNow().minutes * 60 - state.elapsed))):'In deinem Tempo'}</b></span><span class="story-status">${state.paused ? 'Pausiert' : 'In deinem Tempo'}</span><button class="story-help" data-story="help" aria-label="Hilfe und Schrittdetails">${icon('info')}</button></footer><button class="sr-only" data-story="prev-step">Schritt neu starten</button><button class="sr-only" data-story="next-step">Nächster Schritt</button><button class="sr-only" data-story="prev-block">Vorheriger Baustein</button><button class="sr-only" data-story="next-block">Nächster Baustein</button></section></div>`;
  const existing=$('.story-face:not(.outgoing)',overlay),sameBlock=existing?.dataset.block===String(player.b);
  if(sameBlock){
    // Keep the live canvas, mascot and controls mounted throughout this block.
    const template=document.createElement('template');template.innerHTML=markup;
    const fresh=template.content.querySelector('.story-face'),changed=existing.dataset.storyStep!==String(player.s);
    existing.dataset.storyStep=String(player.s);existing.setAttribute('aria-label',fresh.getAttribute('aria-label'));
    existing.className=fresh.className;existing.querySelector('.story-help-pane')?.remove();
    existing.querySelectorAll('.story-segment span').forEach((bar,i)=>bar.style.transform=fresh.querySelectorAll('.story-segment span')[i].style.transform);
    const label=$('.story-step-label',existing),newLabel=$('.story-step-label',fresh);
    if(label.innerHTML!==newLabel.innerHTML)label.innerHTML=newLabel.innerHTML;
    const text=$('.story-text-card',existing),newText=$('.story-text-card',fresh);
    if(changed||text.dataset.source!==newText.innerHTML){text.innerHTML=newText.innerHTML;text.dataset.source=newText.innerHTML;
      if(changed&&!matchMedia('(prefers-reduced-motion: reduce)').matches){text.getAnimations().forEach(a=>a.cancel());text.animate([{opacity:.35},{opacity:1}],{duration:180,easing:'ease-out'});}}
    const response=$('.story-response',existing);
    // A focused text editor must never be rebuilt by a clock or pause update.
    if(changed||stepNow().input!=='text')response.replaceWith($('.story-response',fresh));
  }else{overlay.innerHTML=markup;const text=$('.story-text-card',overlay);text.dataset.source=text.innerHTML;}
  hydrateRich(overlay);translateUI(overlay);
  if(speechSession?.key===keyNow()){
    const elements=[...overlay.querySelectorAll('.spoken-copy p,.spoken-copy li,.spoken-copy h2,.spoken-copy h3')].filter(el=>el.textContent.trim());
    speechSession.parts.forEach((part,i)=>{part.element=elements[i]||$('.spoken-copy',overlay);});
  }
  const textCard = $('.story-text-card', overlay); if (textCard) {
    textCard.scrollTop = state.scrollTop;
    if(!textCard.dataset.bound){textCard.dataset.bound='true';
    const pauseReading = () => { stateNow().paused = true; const control = $('.story-pause', overlay); if (control) { control.innerHTML = icon('play'); control.setAttribute('aria-label','Fortsetzen'); } updateVisuals(); };
    textCard.addEventListener('wheel', pauseReading, { passive:true });
    textCard.addEventListener('touchmove', event => { if (!gesture || Math.abs(event.touches[0]?.clientY - gesture.y) > 12) pauseReading(); }, { passive:true });
    textCard.addEventListener('scroll', () => { if(player&&!player.done)stateNow().scrollTop = textCard.scrollTop; }, { passive:true });
    textCard.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','PageUp','PageDown','Home','End'].includes(e.key))pauseReading();});
    }
  }
  updateVisuals();
}
function updateVisuals() {
  if (!player || player.done) return;
  const state = stateNow(), duration = stepNow().minutes * 60;
  const pauseControl=$('.story-pause',overlay),pauseLabel=state.paused?'Fortsetzen':'Pausieren';
  if(pauseControl&&pauseControl.dataset.paused!==String(state.paused)){
    pauseControl.dataset.paused=String(state.paused);pauseControl.innerHTML=icon(state.paused?'play':'pause');pauseControl.setAttribute('aria-label',pauseLabel);translateUI(pauseControl);
  }
  $('.story-face',overlay)?.classList.toggle('is-speaking',Boolean(state.speaking));
  const bar = $(`.story-segment:nth-child(${player.s + 1}) span`, overlay);
  if (bar) bar.style.transform = `scaleX(${Math.min(1, stepNow().timer?state.elapsed / duration:0)})`;
  const clock = $('.story-clock b', overlay); if (clock) clock.textContent = stepNow().timer?time(Math.ceil(Math.max(0,duration-state.elapsed))):'In deinem Tempo';
  const status = $('.story-status', overlay);
  if (status) status.textContent = stepNow().timer && state.elapsed >= duration && stepNow().input !== 'none' ? 'Deine Antwort hat Zeit.' : player.hold ? 'Kurz durchatmen.' : state.paused ? 'Pausiert' : ''; 
  $('.story-face', overlay)?.classList.toggle('is-paused', !running());
  $('.story-symbol .buddy-character',overlay)?.classList.toggle('buddy-speaking',Boolean(state.speaking&&running()));
  setBuddySpeaking($('.story-symbol',overlay),Boolean(state.speaking&&speechSession?.audible&&running()));
  if(stepNow().guidance){const cues=guidanceCues(stepNow().guidance),cue=cues.findLast(c=>c.at<=state.elapsed),el=$('.guided-cue',overlay);if(el){const text=cue?(cue.count?'Wiederholung '+cue.count+' / '+stepNow().guidance.count:cue.text):'Gleich geht’s los …';if(el.textContent!==text)el.textContent=text;}}
  syncSpeech();
  setMusic(blockNow().music || 'none', .25, running() && !state.recording, Boolean(state.speaking));
}
function updateClock() {
  const now = performance.now(), delta = Math.max(0, (now - lastTick) / 1000); lastTick = now;
  if (!player || player.done || player.transitioning) return;
  const state = stateNow();
  if (state.recording && !document.hidden) {
    state.recordSeconds += delta;
    const small = $('.memo-record small', overlay); if (small) small.textContent = time(Math.floor(state.recordSeconds));
  }
  if (running() && !state.speechLoading) {
    const duration = stepNow().minutes * 60;
    state.elapsed = stepNow().timer?Math.min(duration,state.elapsed+delta):state.elapsed+delta;
  }
    if (stepNow().timer && !state.paused && !player.hold && !document.hidden && state.elapsed >= stepNow().minutes*60 && !state.speaking) {
      state.paused = true;
      if (stepNow().input === 'none' && (!stepNow().research || state.outcome === 'success' && researchFor(stepNow(),stateNow()))) { state.finished = true; state.skipped=false;nextStep(); return; }
      renderPlayer();
    }
  updateVisuals();if(now-lastCheckpoint>5000){checkpoint();lastCheckpoint=now;}
}
function stopRecording(){if(recorder?.state==='recording'){stateNow().finalizing=true;recorder.stop();}}
function inputError(message){const el=$('.story-input-error',overlay);if(el){el.hidden=false;el.textContent=message;}}
async function recordMemo(){
 const owner=player,state=stateNow();state.paused=true;
 if(recorder?.state==='recording'){stopRecording();return;}if(state.recording||state.requesting)return;
 state.requesting=true;
 try{
  if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw new Error('Die Aufnahme ist in diesem Browser nicht verfügbar.');
  const stream=await navigator.mediaDevices.getUserMedia({audio:true});state.requesting=false;
  if(player!==owner||state!==stateNow()){stream.getTracks().forEach(t=>t.stop());return;}
  mediaStream=stream;const chunks=[],localRecorder=new MediaRecorder(stream);recorder=localRecorder;
  state.recording=true;state.memo=false;state.recordSeconds=0;state.audio=null;
  localRecorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
  localRecorder.onstop=()=>{
   const reader=new FileReader();stream.getTracks().forEach(t=>t.stop());if(mediaStream===stream)mediaStream=null;
   reader.onload=()=>{state.audio=reader.result;state.memo=true;state.recording=false;state.finalizing=false;if(player===owner){checkpoint();if(state.closeAfterRecording){state.closeAfterRecording=false;closeStory();}else if(state.advanceAfterRecording){state.advanceAfterRecording=false;advanceStep();}else renderPlayer();}};
   reader.onerror=()=>{state.recording=false;state.finalizing=false;state.advanceAfterRecording=false;state.closeAfterRecording=false;if(player===owner){renderPlayer();inputError('Die Aufnahme konnte nicht gespeichert werden. Bitte erneut aufnehmen.');}};
   reader.readAsDataURL(new Blob(chunks,{type:localRecorder.mimeType}));
  };
  localRecorder.onerror=()=>{stream.getTracks().forEach(t=>t.stop());state.recording=false;state.finalizing=false;state.advanceAfterRecording=false;state.closeAfterRecording=false;if(player===owner){renderPlayer();inputError('Die Aufnahme wurde unterbrochen. Bitte erneut aufnehmen.');}};
  localRecorder.start();renderPlayer();
 }catch(error){state.requesting=false;state.recording=false;if(player!==owner)return;renderPlayer();const el=$('.story-input-error',overlay);el.hidden=false;el.textContent=error.name==='NotAllowedError'?'Erlaube den Mikrofonzugriff oder überspringe diesen Schritt.':error.message;}
}
function checkpoint(){if(player&&!player.preview&&!player.done)player.onCheckpoint?.({b:player.b,s:player.s,states:structuredClone(player.states),startedAt:player.startedAt});}

function moveTo(b, s) {
  if (!player || player.done || player.transitioning || stateNow().recording || stateNow().requesting || stateNow().photoLoading || b < 0 || b >= player.blocks.length) return;
  if(stateNow().recording)return;
  cancelSpeech();cancelResearch();
  const oldB = player.b, oldFace = $('.story-face', overlay);
  player.b = b; player.s = s; player.hold = false; player.lastLeft=null; gesture = null; lastTick = performance.now();
  Object.assign(stateNow(),{spoken:false,speaking:false,paused:false,elapsed:0,speechPart:0,scrollTop:0});
  renderPlayer();
  if (oldB !== b && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const face = $('.story-face', overlay), viewport = $('.story-viewport', overlay);
    const forward = b > oldB;
    oldFace.setAttribute('aria-hidden', 'true'); oldFace.inert = true; oldFace.classList.add('outgoing');
    viewport.append(oldFace); player.transitioning = true;
    const width = viewport.clientWidth;
    const common = { duration: 560, easing: 'cubic-bezier(.22,.75,.2,1)', fill: 'both' };
    oldFace.animate([{ transform: 'rotateY(0deg)', opacity: 1 }, { transform: `translateX(${forward ? -width / 2 : width / 2}px) rotateY(${forward ? -88 : 88}deg)`, opacity: .35 }], common);
    face.animate([{ transform: `translateX(${forward ? width / 2 : -width / 2}px) rotateY(${forward ? 88 : -88}deg)`, opacity: .35 }, { transform: 'rotateY(0deg)', opacity: 1 }], common);
    transitionTimer = setTimeout(() => {
      // Clear the filled transforms at the same point that gestures unlock.
      // This also avoids stale perspective hit areas on rapid back-and-forth.
      oldFace.getAnimations().forEach(animation => animation.cancel());
      face.getAnimations().forEach(animation => animation.cancel());
      oldFace.remove();
      if (player) { player.transitioning = false; lastTick = performance.now(); updateVisuals(); }
    }, 570);
  }
  checkpoint();announce(`${blockNow().title}, Schritt ${s + 1}`);
}
function advanceStep(){
 $('.story-first-hint',overlay)?.remove();
 if(!player||player.done||player.transitioning)return;
 const state=stateNow();if(state.finalizing||state.requesting||state.photoLoading)return;
 if(state.recording){state.advanceAfterRecording=true;stopRecording();return;}
 const valid=!stepNow().research||Boolean(researchFor(stepNow(),stateNow())&&state.outcome==='success');
 state.finished=Boolean(valid);state.skipped=!valid;checkpoint();nextStep();
}
function nextStep() {
  if (player.s < blockNow().steps.length - 1) moveTo(player.b, player.s + 1);
  else if (player.b < player.blocks.length - 1) moveTo(player.b + 1, 0);
  else { stopRecording(); player.done = true; renderFinish(); }
}
function prevStep(){
 if(!player||player.done||player.transitioning||stateNow().recording||stateNow().requesting||stateNow().photoLoading)return;
 const previous=player.lastLeft,now=performance.now(),key=keyNow();
 if(previous?.key===key&&now-previous.at<1000&&(player.s>0||player.b>0)){player.lastLeft=null;restartMusic();if(player.s>0)moveTo(player.b,player.s-1);else moveTo(player.b-1,player.blocks[player.b-1].steps.length-1);return;}
 player.lastLeft={key,at:now};cancelSpeech();restartMusic();Object.assign(stateNow(),{elapsed:0,paused:false,spoken:false,speaking:false,speechPart:0,scrollTop:0});
 player.hold=false;gesture=null;lastTick=performance.now();renderPlayer();checkpoint();announce('Schritt von vorne gestartet. Deine Antworten bleiben erhalten.');
}
function nextBlock() { if(!player||player.done||player.transitioning||stateNow().recording||stateNow().requesting||stateNow().photoLoading)return;if(!stateNow().finished)stateNow().skipped=true; if (player.b < player.blocks.length - 1) moveTo(player.b + 1, 0); else { stopRecording(); player.done = true; renderFinish(); } }
function renderFinish(){
 cancelResearch();reportRun();stopMusic();cancelSpeech();const count=Object.values(player.states).filter(s=>s.finished).length,celebrate=!player.preview&&count>0;
 overlay.innerHTML='<div class="story-viewport"><section class="story-finish '+(celebrate?'celebrating':'')+'">'+lavaMarkup({blocks:player.blocks},{tint:.55,background:true})+'<button class="round-button story-close" data-story="close" aria-label="Schließen">'+icon('close')+'</button>'+(celebrate?'<div class="confetti" aria-hidden="true">'+Array.from({length:28},(_,i)=>'<i style="--x:'+((i*37)%100)+'%;--i:'+i+';--r:'+(i*29)+'deg"></i>').join('')+'</div>':'')+'<div class="finish-art">'+buddyArt()+'</div><span class="story-eyebrow">'+(player.preview?'DEINE VORSCHAU':celebrate?'DIESER MOMENT GEHÖRT DIR':'IN DEINEM TEMPO')+'</span><h1>'+(player.preview?'So beginnt<br>dein Morgen.':celebrate?'Hallo Tag.<br>Ich bin da.':'Bis zu deinem<br>nächsten Moment.')+'</h1><p>'+(player.preview?'Deine Einstellungen sind bereit.':celebrate?'Nimm dieses Gefühl mit in deinen Tag.':'Dieser Durchlauf wurde ausgelassen.')+'</p><button class="finish-button" data-story="close">'+(player.returnLabel||(player.preview?'Zurück zum Editor':'Zurück zu Home'))+icon('check')+'</button></section></div>';
 animateScreen($('.story-finish',overlay),'tab');
}

overlay.addEventListener('input', event => {
  if (event.target.id !== 'story-answer') return;
  stateNow().text = event.target.value;checkpoint();

});
overlay.addEventListener('focusin', event => {
  if (event.target.id === 'story-answer') { stateNow().paused = true; const pause = $('.story-pause', overlay); pause.innerHTML = icon('play'); pause.setAttribute('aria-label', 'Fortsetzen'); updateVisuals(); }
});
overlay.addEventListener('change', async event => {
  if (event.target.id !== 'story-photo' || !event.target.files[0]) return;
  const state = stateNow(), session = player, file = event.target.files[0]; state.paused = true;state.photoLoading=true;
  try {
    const photo=await localPhoto(file);if(player!==session||state!==stateNow())return;state.photos=[photo];state.photoLoading=false;checkpoint();renderPlayer();
  } catch (error) { state.photoLoading=false;if (player === session && state === stateNow()) { const target = $('.story-input-error', overlay); target.hidden = false; target.textContent = error.message || 'Dieses Foto konnte nicht geladen werden.'; } }
});
overlay.addEventListener('click', event => {
  if(event.target.closest('.photo-response')){if(player&&!player.done){stateNow().paused=true;updateVisuals();}return;}
  const button = event.target.closest('[data-story]'); if (!button || button.disabled || !player || player.transitioning) return;
  const action = button.dataset.story;
  if(action==='close'){if(!player.done&&stateNow().recording){stateNow().closeAfterRecording=true;stopRecording();return;}closeStory();return;}
  if (action === 'restart') { const { blocks, onClose, preview, onReport, title } = player; openStory(blocks, { onClose, preview, onReport, title }); return; }
  if (player.done) return;
  const state = stateNow();
  if(state.recording&&!['record','next-step'].includes(action))return;
  if(action==='expand-photo'){showPhotoFullscreen();return;}
  if (action === 'pause') { if (stepNow().timer && state.elapsed >= stepNow().minutes*60 && stepNow().input === 'none') { state.finished=true; nextStep(); } else { state.paused = !state.paused; updateVisuals(); } }
  if (action === 'transcript') { state.showTranscript = !state.showTranscript; renderPlayer(); }
  if(action==='record'){recordMemo();return;}
  if(action==='skip'){state.skipped=true;state.finished=false;checkpoint();nextStep();}
  if(action==='next-step')advanceStep();
  if (action === 'prev-step') prevStep();
  if (action === 'next-block') nextBlock();
  if (action === 'prev-block') moveTo(player.b - 1, 0);
  if(action==='retry'){cancelResearch();state.researchStatus='idle';state.researchError=null;renderPlayer();}
  if(action==='speech-retry'){state.speechError=null;state.spoken=false;state.paused=false;renderPlayer();}
  if(action==='speech-text'){cancelSpeech();state.speechError=null;state.speechLoading=false;state.textOnly=true;state.paused=false;renderPlayer();}
  if (action === 'help') { state.helpWasPaused=state.paused;state.paused = true; showStoryHelp(); }
});
function showStoryHelp() {
  const pane = document.createElement('div'); pane.className = 'story-help-pane'; pane.dataset.interactive = '';
  pane.innerHTML = `<h2>Dein Tempo. Dein Morgen.</h2><details class="story-settings"><summary>Einstellungen dieses Schritts</summary><dl><dt>Ausgabe</dt><dd>${labels[blockNow().output]}</dd><dt>Eingabe morgens</dt><dd>${{none:'Keine',text:'Textfeld',voice:'Memo',photo:'Foto'}[stepNow().input]}</dd><dt>Dauer</dt><dd>${stepNow().minutes} Min. · ${stepNow().timer?'Timer an':'Ohne Timer'}</dd><dt>Recherche</dt><dd>${stepNow().research?'An':'Aus'}</dd></dl><div class="formatted-text">${renderRich(stepNow().message.text)}</div></details><p>Links tippen: Schritt neu starten. Direkt noch einmal: vorheriger Schritt.<br>Rechts tippen: nächster Schritt.<br>Wischen: Baustein wechseln.<br>Gedrückt halten: kurz pausieren.</p>${player.preview&&stepNow().demoResearch ? '<label>Demo-Ergebnis<select id="story-outcome"><option value="success">Ergebnis vorhanden</option><option value="empty">Keine Ergebnisse</option><option value="error">Verbindung fehlgeschlagen</option></select></label>' : ''}<button class="finish-button" id="close-story-help">Verstanden</button>`;
  $('.story-face', overlay).append(pane);
  $('#close-story-help').onclick = () => {stateNow().paused=Boolean(stateNow().helpWasPaused);renderPlayer();};
  const select = $('#story-outcome'); if (select) { select.value = stateNow().outcome; select.onchange = () => { stateNow().outcome = select.value; }; }
}
// Gesture recognition is limited to non-interactive story surfaces. Vertical
// scroll and editing keep their native behavior. A hold never toggles pause.
overlay.addEventListener('pointerdown', event => {
  if (!player || player.done || player.transitioning || event.button !== 0 || event.target.closest('a,button,input,textarea,select,label,summary,audio,[contenteditable],[data-interactive],.story-help-pane')) return;
  gesture = { x: event.clientX, y: event.clientY, id: event.pointerId, held: false, moved: false };
  gesture.holdTimer = setTimeout(() => { if (gesture) { gesture.held = true; player.hold = true; updateVisuals(); } }, 230);
});
overlay.addEventListener('pointermove', event => {
  if (!gesture || event.pointerId !== gesture.id) return;
  if (Math.abs(event.clientX - gesture.x) > 12 || Math.abs(event.clientY - gesture.y) > 12) { clearTimeout(gesture.holdTimer); gesture.moved = true; player.hold = true; }
});
overlay.addEventListener('pointerup', event => {
  if (!gesture || event.pointerId !== gesture.id) return;
  const g = gesture; clearTimeout(g.holdTimer); gesture = null; player.hold = false;
  const dx = event.clientX - g.x, dy = event.clientY - g.y;
  if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.4) { if (dx < 0) nextBlock(); else moveTo(player.b - 1, 0); }
  else if (!g.held && !g.moved) { const rect = $('.story-face', overlay).getBoundingClientRect(); const x = (event.clientX - rect.left) / rect.width; if (x < .28) prevStep(); else if (x > .72) advanceStep(); }
  updateVisuals();
});
function cancelGesture() { clearTimeout(gesture?.holdTimer); gesture = null; if (player) { player.hold = false; updateVisuals(); } }
overlay.addEventListener('pointercancel', cancelGesture);
window.addEventListener('blur', () => { cancelGesture(); if (player && !player.done) { stateNow().paused = true; stopRecording();updateVisuals();checkpoint(); } });
document.addEventListener('visibilitychange', () => { if (player && !player.done && document.hidden) { stateNow().paused = true; stopRecording(); cancelGesture(); checkpoint();updateVisuals(); } lastTick = performance.now(); });
document.addEventListener('keydown', event => {
  if(photoDialog?.open)return;
  if (!player || event.target.closest('input,textarea,select,[contenteditable]')) return;
  if (event.key === 'Escape') { if(!player.done&&stateNow().recording){stateNow().closeAfterRecording=true;stopRecording();return;}closeStory();return; }
  if (player.done || player.transitioning) return;
  if(stateNow().recording&&event.key!=='ArrowRight')return;
  if (event.key === 'ArrowRight') { event.preventDefault(); advanceStep(); }
  if (event.key === 'ArrowLeft') { event.preventDefault(); prevStep(); }
  if (event.key === ' ') { event.preventDefault(); stateNow().paused = !stateNow().paused; updateVisuals(); }
});
function reportRun() {
  if (!player || player.preview || player.reported || !player.onReport) return;
  player.reported = true;
  const answers = Object.entries(player.states).map(([key,state]) => { const [b,stepIndex] = key.split(':').map(Number); return { blockTitle:player.blocks[b].title, blockId:player.blocks[b].id,symbol:player.blocks[b].symbol,sourceId:player.blocks[b].sourceId,shape:player.blocks[b].shape,theme:player.blocks[b].theme,instruction:player.blocks[b].steps[stepIndex].message?.text,researchResult:state.researchResult,input:player.blocks[b].steps[stepIndex].input,stepIndex, text:state.text, memo:state.memo, recordSeconds:state.recordSeconds, photos:state.photos,audio:state.audio,skipped:Boolean(state.skipped),finished:state.finished }; });
  player.onReport({ startedAt:player.startedAt, ended:player.done,completed:player.done&&answers.filter(a=>a.finished).length===player.blocks.reduce((sum,b)=>sum+b.steps.length,0), finishedCount:answers.filter(a=>a.finished).length, totalSteps:player.blocks.reduce((sum,b)=>sum+b.steps.length,0), elapsedSeconds:Math.floor(Object.values(player.states).reduce((sum,state)=>sum+state.elapsed,0)), answers });
}

let photoDialog;
function showPhotoFullscreen(){
 if(!stateNow().photos.length)return;stateNow().paused=true;updateVisuals();checkpoint();
 if(!photoDialog){photoDialog=document.createElement('dialog');photoDialog.className='photo-fullscreen';photoDialog.dataset.sheetReady='true';photoDialog.setAttribute('aria-label','Foto in Vollbild');document.body.append(photoDialog);}
 photoDialog.innerHTML='<button class="photo-full-close" aria-label="Vollbild schließen">×</button><img alt="Dein Foto" src="'+stateNow().photos[0]+'">';photoDialog.querySelector('button').onclick=()=>photoDialog.close();photoDialog.showModal();
}

function syncKeyboard(){
 const viewport=window.visualViewport;
 const editing=overlay.contains(document.activeElement)&&document.activeElement.matches('input,textarea,[contenteditable]');
 const compact=Boolean(player&&editing&&viewport&&viewport.height<window.innerHeight-120);
 overlay.classList.toggle('keyboard-open',compact);
 if(compact)overlay.style.setProperty('--keyboard-height',viewport.height+'px');else overlay.style.removeProperty('--keyboard-height');
}
window.visualViewport?.addEventListener('resize',syncKeyboard);
overlay.addEventListener('focusin',syncKeyboard);overlay.addEventListener('focusout',()=>requestAnimationFrame(syncKeyboard));

async function savePlayerLocation(form,locate){
 const owner=player,key=keyNow(),button=form.querySelector(locate?'[data-story="locate"]':'[type="submit"]');button.disabled=true;
 try{await saveResearchPreferences(locate?{location:await requestLocation()}:{city:form.elements.city.value});if(player===owner&&keyNow()===key){stateNow().researchStatus='idle';stateNow().researchErrorCode=null;stateNow().outcome='success';renderPlayer();}}
 catch(error){if(form.isConnected)form.querySelector('.location-status').textContent=error.message;}finally{button.disabled=false;}
}
overlay.addEventListener('submit',event=>{if(!event.target.matches('.research-location-form'))return;event.preventDefault();savePlayerLocation(event.target,false);});
overlay.addEventListener('click',event=>{if(event.target.closest('[data-story="locate"]'))savePlayerLocation(event.target.closest('form'),true);});
