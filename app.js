import {saveLibraryBlock} from './repository.js';
import {MAX_STEPS} from './limits.js';
import './theme.js';
import { translateUI } from './i18n.js';
import { confirmSheet,animateScreen } from './sheets.js';
import { symbol, visualStyle, showAppearance } from './appearance.js';
import { installLava } from './lava.js';
installLava();
import { newDraft, newStep, id, restoreDraft, contentIssues, outputIssue, hasResearch, messageText, time } from './model.js';
import { readDraft, writeDraft, listBlocks, saveBlock } from './storage.js';
import { icon } from './icons.js';
import { attachReorder } from './reorder.js';
import { configureExperience, openRitual, openStory } from './experience.js';
import { configureProduct, openProduct, finishEditor, leaveEditor, navigationMarkup, openCreateMenu } from './product.js';
import { TAGS, TRACKS } from './catalog.js';
import { richField, hydrateRich, renderRich } from './richtext.js';
import { audition, stopAudition } from './audio.js';

const $ = (s, root = document) => root.querySelector(s);
const app = $('#app');
const demo = $('#demo-dialog');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inputNames = { none: 'Keine', text: 'Textfeld', voice: 'Memo', photo: 'Foto' };
const outputNames = { buddy: 'Audio', text: 'Text', original: 'Text' };
let storageError = '';
let draft;
try { draft = restoreDraft(await readDraft()); } catch { draft = newDraft(); storageError = 'Der Browser erlaubt gerade kein lokales Speichern.'; }
let persistQueue = Promise.resolve();
let revision = 0;
let saving = false;
let removed = null;
let descriptionOpen = false;
let tagsOpen = false;
let preview = null;
let editingExisting=false;

let outcome='success',auditionTrack=null;
const total = () => draft.steps.reduce((sum, step) => sum + step.minutes, 0);
const stepById = stepId => draft.steps.find(step => step.id === stepId);

function announce(text) { $('#announcer').textContent = text; }
function persist() {
  const snapshot = structuredClone(draft);
  const current = ++revision;
  const status = $('.draft-status');
  if (status) status.hidden = !storageError;
  persistQueue = persistQueue.catch(() => {}).then(() => writeDraft(snapshot)).then(() => {
    if (current === revision) {
      storageError = '';
      const status = $('.draft-status');
      if (status) { status.textContent = ''; status.hidden = true; }
    }
  }).catch(() => {
    storageError = 'Speichern nicht möglich. Lass diese Seite geöffnet und versuche es erneut.';
    const status = $('.draft-status');
    if (status) { status.textContent = storageError; status.hidden = false; status.classList.add('form-error'); }
  });
  return persistQueue;
}
function commit() { render(); persist(); }
function header() {
  const issues = contentIssues(draft);
  return `<div class="fixed-nav"><header class="topbar"><button class="icon-btn" data-action="${draft.page === 1 ? 'home' : 'back'}" aria-label="${draft.page === 1 ? 'Zurück zur Übersicht' : 'Zurück'}">${icon('back')}</button><div class="topbar-title">${editingExisting?'Baustein bearbeiten':'Baustein erstellen'}</div><span class="header-spacer"></span></header>
  ${draft.page === 'saved' ? '' : `<nav class="steps-nav" aria-label="Erstellungsschritte">${['Inhalt', 'Ausgabe'].map((label, i) => `<button data-page="${i + 1}" ${draft.page === i + 1 ? 'class="active" aria-current="step"' : ''} ${(i > 0 && issues.length) || (i === 2 && outputIssue(draft)) ? 'disabled' : ''}><span class="nav-number">${i + 1}</span>${label}</button>`).join('')}</nav>`}
  </div>`;
}
function stepView(step, index) {
  const open = draft.active === step.id;
  return `<section class="step ${open ? 'open' : ''}" data-step="${step.id}"><div class="step-head"><button class="icon-btn drag-handle" data-drag="${step.id}" aria-label="Schritt ${index + 1} verschieben" aria-describedby="drag-help" ${draft.steps.length === 1 ? 'disabled' : ''}>${icon('grip')}</button><button class="step-expand" data-action="expand" data-id="${step.id}" aria-expanded="${open}"><span class="step-number">${String(index + 1).padStart(2, '0')}</span><span class="grow"><span class="step-title">Schritt ${index + 1}</span></span><span class="step-duration" data-head-duration="${step.id}">${step.minutes} Min.</span>${icon(open ? 'up' : 'down')}</button><button class="icon-btn" data-action="remove-step" data-id="${step.id}" aria-label="Schritt ${index + 1} löschen" ${draft.steps.length === 1 ? 'disabled' : ''}>${icon('trash')}</button></div>
  ${open ? `<div class="step-body"><label class="label" for="instruction-${step.id}">${step.research ? 'Rechercheauftrag' : 'Anweisung'}</label>${richField({ id:`instruction-${step.id}`, value:messageText(step), attrs:`data-instruction="${step.id}"`, placeholder:step.research?'Was soll der Buddy recherchieren?':'Was soll in diesem Schritt passieren?', label:step.research?'Rechercheauftrag':'Anweisung' })}<p class="character-count" id="instruction-count-${step.id}">${messageText(step).length} / 1.200</p>
  <label class="switch-row research-row"><span class="switch-copy">${icon('globe')} Im Internet recherchieren</span><input class="switch" type="checkbox" data-research="${step.id}" ${step.research ? 'checked' : ''}></label>
  <p class="research-explanation">${step.research?'Dein Text ist der Rechercheauftrag. {{ort}} verwendet deinen gespeicherten Ort, {{aktien}} deine Marktinteressen. Verwendet wird das recherchierte Ergebnis.':'Dein Text wird unverändert angezeigt oder vorgelesen.'}</p><span class="label">Deine Eingabe morgens</span><div class="input-types" role="group" aria-label="Eingabe im Ritual">${Object.entries(inputNames).map(([key, label]) => `<button data-input="${key}" data-id="${step.id}" aria-pressed="${step.input === key}">${icon({ none: 'minus', text: 'text', voice: 'mic', photo: 'camera' }[key])}${label}</button>`).join('')}</div>
  <div class="duration-row"><label class="label" for="duration-${step.id}">Dauer</label><span class="duration-value" id="duration-value-${step.id}">${step.minutes} <small>Min.</small></span></div><input id="duration-${step.id}" aria-label="Zeit für Schritt ${index + 1} in Minuten" data-duration="${step.id}" type="range" min="1" max="20" step="1" value="${step.minutes}" style="--fill:${(step.minutes - 1) / 19 * 100}%"><div class="range-labels"><span>1 Min.</span><span>20 Min.</span></div>
  <label class="switch-row"><span class="switch-copy">Timer anzeigen</span><input class="switch" type="checkbox" data-timer="${step.id}" ${step.timer ? 'checked' : ''} ></label></div>` : ''}</section>`;
}
function contentView() {
  return `${editingExisting?'<p class="shared-edit-note">Änderungen gelten in allen Ritualen, die diesen Baustein verwenden.</p>':''}<div class="editor-identity"><button type="button" class="identity-look" data-action="appearance" aria-label="Symbol und Farbe ändern"><span class="appearance-sample" style="${visualStyle(draft)}">${symbol(draft)}</span><span class="edit-badge" aria-hidden="true">${icon('edit')}</span></button><div class="identity-title"><label class="label" for="title">Titel des Bausteins</label><input type="text" id="title" class="title-input compact-title" maxlength="20" placeholder="Worum geht’s?" autocomplete="off" value="${esc(draft.title)}"><div class="meta-row"><span id="title-count">${draft.title.length} / 20</span></div></div></div>
  <p class="sr-only" id="drag-help">Am Griff ziehen. Mit der Tastatur: Pfeil hoch oder runter. Escape bricht das Ziehen ab.</p><div class="step-list">${draft.steps.map(stepView).join('')}</div><details class="description-section" ${descriptionOpen ? 'open' : ''}><summary>Beschreibung des Bausteins <span class="optional">optional</span>${icon('down')}</summary><label class="sr-only" for="description">Beschreibung des Bausteins</label>${richField({id:'description', value:draft.description, max:500, placeholder:'Was macht deinen Baustein aus?', label:'Beschreibung des Bausteins'})}<p class="character-count" id="description-count">${draft.description.length} / 500</p></details>
  <details class="editor-tags" ${tagsOpen?'open':''}><summary>Tags <span>${draft.tags.length ? draft.tags.length+' ausgewählt' : 'optional'}</span>${icon('down')}</summary><div class="tag-picker">${TAGS.map(tag=>`<button data-tag="${tag}" aria-pressed="${draft.tags.includes(tag)}" ${draft.tags.length>=3&&!draft.tags.includes(tag)?'disabled':''}>#${tag}</button>`).join('')}</div></details>

  ${removed ? `<div class="toast">Schritt gelöscht.<button data-action="undo">Rückgängig</button></div>` : ''}
  <button class="add-step" data-action="add-step" ${draft.steps.length>=MAX_STEPS?'disabled':''}>${icon('plus')} Schritt hinzufügen</button>${draft.steps.length>=MAX_STEPS?'<p class="item-limit">Maximal 10 Schritte pro Baustein.</p>':''}
  <div class="actions"><button class="primary" data-action="next" id="next">Weiter ${icon('arrow')}</button><p class="gate-hint" id="gate-hint"></p></div>`;
}
function outputView() {
  const descriptions = { buddy: 'Dein Buddy liest den Inhalt vor.', text: 'Du liest den Inhalt selbst.' };
  return `<div class="output-header"><h1>${esc(draft.title)}</h1><p class="small muted">${draft.steps.length} ${draft.steps.length === 1 ? 'Schritt' : 'Schritte'} · ${total()} Minuten</p></div><h2>Ausgabe für alle Schritte</h2><div class="output-options">${Object.entries({buddy:'Audio',text:'Text'}).map(([key, label]) => `<button class="output-choice" data-output="${key}" aria-pressed="${draft.output === key}"><span class="output-top">${icon({ buddy: 'audio', text: 'lines' }[key])}<span class="output-name">${label}</span><span class="radio" aria-hidden="true">${draft.output === key ? icon('check') : ''}</span></span><span class="output-detail">${descriptions[key]}</span></button>`).join('')}</div>
  <p class="output-explanation">Ohne Recherche bleibt dein Text unverändert. Mit Recherche wird im jeweiligen Schritt das Ergebnis angezeigt oder vorgelesen.</p>
  ${hasResearch(draft) ? '<p class="research-availability">Recherche startet beim jeweiligen Schritt und benötigt eine Internetverbindung sowie die freigeschaltete KI-Anbindung.</p>' : ''}
  <button class="music-setting" data-action="music">${icon('music')}<span>Hintergrundmusik<small>${TRACKS.find(t=>t.id===draft.music)?.title || 'Keine Musik'}</small></span>${icon('arrow')}</button>
  <button class="editor-preview secondary" data-action="launch-preview">${icon('play')} Vorschau</button><div class="actions two"><button class="secondary" data-page="1">${icon('back')} Zurück</button><button class="primary" data-action="save" ${saving ? 'disabled' : ''}>${saving ? 'Speichert …' : 'Speichern'} ${icon('check')}</button></div><p class="gate-hint" id="gate-hint"></p>`;
}
function launchPreview() {
  openStory([{ ...structuredClone(draft), theme: draft.theme || 'lilac' }], { preview:true,returnLabel:'Zurück zum Editor',onClose: () => { render(); announce('Zurück im Editor. Du kannst deinen Baustein jetzt speichern.'); } });
}
function savedView() {
  return `<div class="success"><div class="success-mark">${icon('check')}</div><h1>Dein Baustein ist bereit.</h1><div class="saved-card"><h2>${esc(draft.title)}</h2>${draft.description ? `<div class="formatted-text block-description">${renderRich(draft.description)}</div>` : ''}<p class="small muted">${draft.steps.length} Schritte · ${total()} Minuten · ${outputNames[draft.output]}</p></div><div class="saved-actions"><button class="primary" data-action="home">Zu meinem Ritual ${icon('arrow')}</button><button class="secondary" data-action="edit-saved">Baustein öffnen ${icon('arrow')}</button><button class="secondary" data-action="new">Neuen Baustein erstellen ${icon('plus')}</button><button class="quiet" data-action="export">Als JSON-Datei sichern</button></div></div>`;
}
function render() {
  const previousPage=app.dataset.page;
  if(draft.page===3)draft.page=2;
  app.innerHTML = `${header()}<main>${draft.page === 1 ? contentView() : draft.page === 2 ? outputView() : savedView()}<div class="draft-status" ${storageError ? '' : 'hidden'} role="alert">${esc(storageError)}${storageError?'<button data-action="retry-save">Erneut versuchen</button><button data-action="export">Entwurf sichern</button>':''}</div></main>${navigationMarkup()}`;
  $('.description-section')?.addEventListener('toggle', event => { descriptionOpen = event.target.open; });
  $('.editor-tags')?.addEventListener('toggle', event => { tagsOpen = event.target.open; });
  hydrateRich(app);translateUI(app);
  updateGates();
  app.dataset.page=String(draft.page);
  if(previousPage!==String(draft.page))animateScreen(app,Number(previousPage)>Number(draft.page)?'back':'forward');
}
app.addEventListener('click',async event=>{
 const button=event.target.closest('.bottom-nav button');if(!button)return;
 try{await persist();if(storageError)throw new Error(storageError);if(button.dataset.p==='create')await openCreateMenu();else if(button.dataset.route){await openProduct(button.dataset.route);location.hash=button.dataset.route;}}
 catch{announce('Entwurf konnte nicht gespeichert werden. Bitte erneut versuchen.');}
});
function updateGates() {
  const issues = contentIssues(draft);
  for(const button of app.querySelectorAll('[data-action=save],[data-action=launch-preview]'))button.disabled=saving||issues.length>0||Boolean(outputIssue(draft));
  const next = $('#next');
  const reason = draft.page === 1 ? issues[0]?.text : outputIssue(draft);
  if (next) next.disabled = Boolean(reason);
  const hint = $('#gate-hint');
  if (hint) { hint.textContent = draft.page === 2 && hasResearch(draft) ? '' : reason || ''; hint.hidden = !hint.textContent; }
  for (const button of document.querySelectorAll('.steps-nav [data-page]')) {
    const page = Number(button.dataset.page);
    button.disabled = page > 1 && issues.length > 0 || page === 3 && Boolean(outputIssue(draft));
  }
}
function goPage(page) {
  if (page > 1 && contentIssues(draft).length || page === 3 && outputIssue(draft)) return;
  stopAudition(); draft.page = page;
  preview = null;
  commit();
  window.scrollTo({ top: 0, behavior: 'instant' });

}

app.addEventListener('input', event => {
  const target = event.target;
  if (target.id === 'title') { draft.title = target.value; $('#title-count').textContent = `${target.value.length} / 20`; updateGates(); persist(); }
  if (target.id === 'description') { draft.description = target.value; $('#description-count').textContent = `${target.value.length} / 500`; persist(); }
  if (target.dataset.instruction) {
    stepById(target.dataset.instruction).message = { type: 'text', text: target.value };
    $(`#instruction-count-${target.dataset.instruction}`).textContent = `${target.value.length} / 1.200`; updateGates(); persist();
  }
  if (target.dataset.duration) {
    const step = stepById(target.dataset.duration); step.minutes = Number(target.value);
    target.style.setProperty('--fill', `${(step.minutes - 1) / 19 * 100}%`);
    $(`#duration-value-${step.id}`).innerHTML = `${step.minutes} <small>Min.</small>`; $(`[data-head-duration="${step.id}"]`).textContent = `${step.minutes} Min.`; updateGates(); persist();
  }

});
app.addEventListener('change', async event => {
  const target = event.target;
  if (target.dataset.research) { stepById(target.dataset.research).research = target.checked;if(target.checked)delete stepById(target.dataset.research).guidance; commit(); }
  if (target.dataset.timer) { stepById(target.dataset.timer).timer = target.checked; persist(); }


});
app.addEventListener('click', async event => {
  const button = event.target.closest('button');
  if (!button || button.disabled) return;
  const data = button.dataset;
  if (data.tag) { draft.tags = draft.tags.includes(data.tag) ? draft.tags.filter(t=>t!==data.tag) : [...draft.tags,data.tag].slice(0,3); commit(); return; }
  if (data.page) { goPage(Number(data.page)); return; }
  if (data.input) { stepById(data.id).input = data.input;if(data.input!=='none')delete stepById(data.id).guidance; commit(); return; }
  if (['buddy','text'].includes(data.output)) { draft.output = data.output; commit(); return; }
  const action = data.action;
  if (action === 'back') { goPage(draft.page === 'saved' ? 1 : Math.max(1, draft.page - 1)); return; }
  if (action === 'next') { goPage(draft.page + 1); return; }
  if (action === 'music') { openMusic(); return; }
  if (action === 'demo') { await showDemo(); return; }
  if (action === 'expand') { draft.active = draft.active === data.id ? null : data.id; commit(); }
  if (action === 'clear-message') { stepById(data.id).message = null; commit(); }
  if (action === 'add-step') { if(draft.steps.length>=MAX_STEPS)return; const step = newStep(); draft.steps.push(step); draft.active = step.id; commit(); $(`[data-step="${step.id}"]`).scrollIntoView({ block: 'start', behavior: 'smooth' }); }

  if (action === 'remove-step' && draft.steps.length > 1) {
    const index = draft.steps.findIndex(s => s.id === data.id); removed = { step: draft.steps[index], index };
    draft.steps.splice(index, 1); if (draft.active === data.id) draft.active = draft.steps[Math.min(index, draft.steps.length - 1)].id; commit();
  }
  if (action === 'undo' && removed) {if(draft.steps.length>=MAX_STEPS)return; draft.steps.splice(removed.index, 0, removed.step); draft.active = removed.step.id; removed = null; commit(); }
  if (action === 'appearance') showAppearance(draft,commit);
  if (action === 'launch-preview'&&!contentIssues(draft).length&&!outputIssue(draft)) launchPreview();
  if (action === 'home') { await persist(); await leaveEditor(); return; }
  if (action === 'retry-save') { await persist(); render(); }
  if (action === 'save') await save();
  if (action === 'edit-saved') goPage(1);
  if (action === 'new') await startNew();
  if (action === 'export') exportDraft();
});

async function save() {
  if (saving || contentIssues(draft).length || outputIssue(draft)) return;
  saving = true; render();
  const block = { ...structuredClone(draft), id: draft.id || id(), page: 1, updatedAt: new Date().toISOString() };
  try {
    await persistQueue;
    await saveLibraryBlock(block);
    draft.id = block.id; draft.page = 'saved'; preview = null; storageError = ''; await persist();
    saving=false;await finishEditor(block);announce('Baustein gespeichert.');return;
  } catch { storageError = 'Der Baustein konnte nicht gespeichert werden. Deine Eingaben bleiben hier. Bitte erneut versuchen.'; }
  saving = false; render(); window.scrollTo({ top: 0, behavior: 'instant' });
}
async function startNew() {
  await persist(); draft = newDraft(); draft._draftKey='new:'+crypto.randomUUID(); editingExisting=false; preview = null; removed = null; outcome = 'success'; descriptionOpen = false; demo.close(); commit(); window.scrollTo({ top: 0, behavior: 'instant' });
}
function exportDraft() {
  const url = URL.createObjectURL(new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = `${draft.title.replace(/[^a-zA-Z0-9äöüÄÖÜß_-]/g, '-').slice(0, 28) || 'baustein'}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function showDemo() {
  let blocks = [];
  try { blocks = (await listBlocks()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); } catch { /* Error already explained by persistence banner. */ }
  demo.innerHTML = `<div class="dialog-head"><h2 id="demo-title">Dein lokaler MVP</h2><button class="icon-btn" data-demo="close" aria-label="Schließen">${icon('close')}</button></div><p class="small muted">Recherche und Buddy-Stimmen benötigen die eingerichtete KI-Anbindung. Bei Ausfällen kannst du Text weiterlesen oder einen Recherche-Schritt überspringen. Memos, Fotos, Antworten und Bausteine bleiben in diesem Browser.</p><h3 style="margin-top:21px">Gespeicherte Bausteine</h3><div class="saved-list">${blocks.length ? blocks.map(b => `<button class="saved-entry" data-load="${b.id}"><b>${esc(b.title)}</b><span>${b.steps.length} Schritte · ${outputNames[b.output]}</span></button>`).join('') : '<p class="small muted">Noch kein Baustein gespeichert.</p>'}</div><div class="saved-actions"><button class="secondary" data-demo="new">Neuen Baustein beginnen</button><button class="quiet" data-demo="export">Aktuellen Stand als JSON sichern</button></div>`;
  demo.showModal();
}
demo.addEventListener('click', async event => {
  const button = event.target.closest('button'); if (!button) return;
  if (button.dataset.demo === 'close') demo.close();
  if (button.dataset.demo === 'new') await startNew();
  if (button.dataset.demo === 'export') exportDraft();
  if (button.dataset.load) {
    if (draft.page !== 'saved' && (draft.title || draft.description || draft.steps.some(s => s.message)) && !await confirmSheet('Baustein öffnen?','Der aktuelle Entwurf wird ersetzt.','Öffnen')) return;
    try { const block = (await listBlocks()).find(b => b.id === button.dataset.load); if (block) { draft = restoreDraft(block); draft.page = 1; preview = null; removed = null; descriptionOpen = false; demo.close(); commit(); } }
    catch { announce('Baustein konnte nicht geöffnet werden.'); }
  }
});
attachReorder(app, {
  getSteps: () => draft.steps,
  setSteps: steps => { draft.steps = steps; commit(); },
  announce
});
configureProduct({ onEditor: async (item, fresh) => {
  await persist();
  if(fresh){draft=newDraft();draft._draftKey='new:'+crypto.randomUUID();editingExisting=false;}
  else if(item){
    const key=item._draftKey||'block:'+item.id;
    draft=restoreDraft(await readDraft(key)||item);draft._draftKey=key;
    editingExisting=Boolean(item.id);
  }
    draft.page=1;descriptionOpen=false;tagsOpen=false;commit();return true;
} });
configureExperience({ onHome: () => openProduct('home') });
render(); persist();
if (location.hash !== '#editor') openProduct(location.hash.slice(1));
function openMusic(){
 demo.innerHTML='<div class="dialog-head"><h2>Dein Soundtrack</h2><button class="icon-btn" data-music-close aria-label="Schließen">'+icon('close')+'</button></div><div class="music-tracks">'+TRACKS.map(track=>'<div class="music-track"><button data-music-select="'+track.id+'" aria-pressed="'+(draft.music===track.id)+'">'+icon(draft.music===track.id?'check':'music')+'<span><b>'+track.title+'</b><small>'+track.subtitle+'</small></span></button>'+(track.id!=='none'?'<button class="round-button" data-music-preview="'+track.id+'" aria-pressed="'+(auditionTrack===track.id)+'" aria-label="'+track.title+(auditionTrack===track.id?' stoppen':' anhören')+'">'+icon(auditionTrack===track.id?'stop':'play')+'</button>':'')+'</div>').join('')+'</div>';if(!demo.open||demo.dataset.closing)demo.showModal();
}

demo.addEventListener('click', event => {
  const b=event.target.closest('button');if(!b)return;
  if(b.hasAttribute('data-music-close'))demo.close();
  if(b.dataset.musicSelect){draft.music=b.dataset.musicSelect;draft.musicVolume=.25;commit();openMusic();}
  if(b.dataset.musicPreview){const next=b.dataset.musicPreview;stopAudition();auditionTrack=auditionTrack===next?null:next;if(auditionTrack)audition(auditionTrack,.25,()=>{auditionTrack=null;if(demo.open&&demo.querySelector('.music-tracks'))openMusic();});openMusic();}
});

demo.addEventListener('close',()=>{stopAudition();auditionTrack=null;});
