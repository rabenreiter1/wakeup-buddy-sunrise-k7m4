import {locationLabel,requestLocation,saveResearchPreferences} from './research-context.js';
import {listDrafts,readDraft,readState,writeState,removeDrafts} from './storage.js';
import {filterContent,selectionCircle,timeWheel,attachTimeWheels} from './ui-controls.js';
import {MAX_BLOCKS,isOwnRoutine} from './limits.js';
import {setAppearance} from './theme.js';
import {cropPhoto} from './crop.js';
import { BUDDIES,buddyArt,selectedBuddy,selectBuddy,previewBuddy,stopBuddyPreview,reactToBuddy } from './buddies.js';
import { localPhoto } from './media.js';
import { setPreferences,clockLabel,locale,translateUI } from './i18n.js';
import { setupSheets, confirmSheet, animateScreen, animateResize, refreshSheet } from './sheets.js';
import {attachSwipe} from './swipe.js';
import {spring,sample,releaseVelocity} from './motion.js';
import { symbol, visualStyle, showAppearance } from './appearance.js';
import { dayKey, localDay, weekDays, plansFor, nextPlan, monthDays, currentStreak, runDay, successful, morningState, planKey, statusForPlan, dayStatus, omitPlan, weeklyConflicts, assignWeeklyPlan, assignDatePlan, dayHasStarted } from './planning.js';
import { isTeamOriginal } from './catalog.js';
import { DEMO_RITUAL } from './catalog.js';
import { icon } from './icons.js';
import { CATALOG_BLOCKS, CATALOG_RITUALS, TAGS, TRACKS, itemTags, itemMinutes, blockIdentity, freshRitual, defaultAlarm } from './catalog.js';
import { loadProduct, persistProduct, savedBlocks, saveToLibrary, addToRitual, recordRun, nextAlarm, markCustomized, removeLibraryBlock, removeLibraryRitual } from './repository.js';
import { escapeHTML as esc, renderRich } from './richtext.js';
import { openStory, mascot, showStorySaveError } from './experience.js';
import { showAlarmDemo } from './alarm.js';
import { attachReorder } from './reorder.js';
import { audition, stopAudition, setSoundEnabled, auditionAlarm, stopAlarmPreview } from './audio.js';
const $ = (s, root = document) => root.querySelector(s);
setupSheets();
let navigationDirection='forward';
const navStack=[];let navTab='home',librarySearch='',librarySort='recent',libraryOrigin='all',managingRituals=false;
const outputNames = { buddy:'Audio', text:'Text', original:'Text' };
const root = document.createElement('div'); root.id = 'product-app'; root.hidden = true; document.body.append(root);
const modal = document.createElement('dialog'); modal.id = 'product-modal'; document.body.append(modal);
// Commit the underlying view before closing, including the shared sheet's swipe
// dismissal. A delayed close-event render can replace the user's next target.
const nativeModalClose=modal.close.bind(modal);
modal.close=value=>{if(selectionPending)return selectionQueue.then(()=>modal.close(value));if(modal._refreshPage){modal._refreshPage=false;render();}return nativeModalClose(value);};
modal.addEventListener('cancel',event=>{event.preventDefault();selectionQueue.then(()=>modal.close());});
modal.addEventListener('close',()=>{modal._scheduleRitual=null;modal._scheduleDrafts={};modal._scheduleOrigin=null;modal._planReturnMode=null;});
const sheet = document.createElement('dialog'); sheet.id = 'profile-sheet'; sheet.className = 'profile-sheet'; document.body.append(sheet);
let data, blocks = [], route = 'home', currentId, selectedItem, onEditor, libraryKind = 'ritual', busy = false;
let calendarExpanded=false,alarmPreview=null,lastUndo=null,drafts=[],draftUndo=null,draftNotice='';
let selectedDay=dayKey(), editorContext=null, lastPage='home';
let discover = { kind:'all', origin:'all', tags:[], search:'' }, notice = '', modalMode;
const allCatalog = [...CATALOG_RITUALS, ...CATALOG_BLOCKS];
const announce = text => { $('#announcer').textContent = text; };
const ritualNow = () => data.rituals.find(r => r.id === currentId);
const savedItem = item => item.blocks ? data.rituals.some(r => (r.sourceId || r.id) === (item.sourceId || item.id)) : blocks.some(b => blockIdentity(b) === blockIdentity(item));
let ritualDraftQueue=Promise.resolve();
async function pendingDrafts(){const blocks=await listDrafts(),ritual=await readState('ritual-draft');return ritual?[{...ritual,_draftKey:'ritual-draft'},...blocks]:blocks;}
function saveRitualDraft(r){const copy=structuredClone(r);ritualDraftQueue=ritualDraftQueue.catch(()=>{}).then(()=>writeState('ritual-draft',copy)).then(async()=>{drafts=await pendingDrafts();modal._refreshPage=true;});return ritualDraftQueue;}
export function configureProduct(options) { onEditor = options.onEditor; }
export async function openProduct(page = 'home') {
  try { data = await loadProduct(); blocks = await savedBlocks(); drafts=await pendingDrafts(); }
  catch { root.hidden = false; root.innerHTML = '<main class="product-error"><h1>Lokaler Speicher nicht erreichbar.</h1><p>Bitte erlaube Browserspeicher und lade die Seite neu. Deine vorhandenen Daten werden nicht überschrieben.</p></main>'; return; }
  setSoundEnabled(true);setAppearance(data.profile.appearance);setPreferences(data.profile);selectBuddy(data.profile.buddy);
  $('#app').hidden = true; $('.desktop-brand').hidden = true;
  root.hidden = false; root.inert = false; document.body.classList.add('product-mode');
  const historyLink=page==='history'||page.startsWith('history/');resolveRoute(historyLink?'home':page);if(['home','discover','library'].includes(route))navTab=route;else if(route==='ritual'||route==='block'&&selectedItem?._from==='library')navTab='library';else if(route==='block')navTab='discover';render(); window.scrollTo(0,0);if(historyLink){history.replaceState({},'','#home');historyDialog(page.split('/')[1]||null);}
}
function resolveRoute(hash) {
  const [page,id] = hash.split('/'); currentId = id;if(['plan','history'].includes(page))navTab='home';
  if(page==='ritual' && data.rituals.some(r=>r.id===id)) route='ritual';
  else if(page==='history' && id && data.history.some(r=>r.id===id)) route='historyDetail';
  else if(page==='block' && id) {
    const item = blocks.find(b=>b.id===id) || allCatalog.find(b=>b.id===id);
    if(item) { selectedItem=selectedItem?.id===id ? selectedItem : {...item,_from:blocks.some(b=>b.id===id)?'library':'discover'};route='block'; }
    else route='library';
  } else route=['home','discover','library','history','plan'].includes(page)?page:'home';
}
function navigate(page,id,back=false){
  if(page==='history'||page==='historyDetail'){historyDialog(page==='historyDetail'?id:null);return;}
  cancelCalendarMotion();endRitualPress();managingRituals=false;
  navigationDirection=back?'back':['home','discover','library'].includes(page)?'tab':'forward';
  const previous=route==='ritual'?'ritual/'+currentId:route==='block'?'block/'+selectedItem.id:route==='historyDetail'?'history/'+currentId:route;
  if(!back){if(['home','discover','library'].includes(page)){navStack.length=0;navTab=page;}else navStack.push({hash:previous,scroll:scrollY,item:selectedItem,tab:navTab});}
  if(page!==route){lastPage=previous;}route=page;currentId=id;notice='';
  const hash=page==='historyDetail'?'history/'+id:page==='ritual'?'ritual/'+id:page==='block'?'block/'+selectedItem.id:page;
  history.pushState({},'', '#'+hash);render();window.scrollTo(0,0);
}
function goBack(){navigationDirection='back';const entry=navStack.pop();if(!entry){navigate('home',null,true);return;}selectedItem=entry.item;navTab=entry.tab||navTab;resolveRoute(entry.hash);history.replaceState({},'','#'+entry.hash);render();requestAnimationFrame(()=>window.scrollTo(0,entry.scroll));}
function toast(text) { notice = text; announce(text); render(); }
function libraryItem(item){return item?.blocks?data.rituals.find(r=>(r.sourceId||r.id)===(item.sourceId||item.id)):blocks.find(b=>blockIdentity(b)===blockIdentity(item||{}));}
function openLibraryItem(item){
 if(!item)return;
 libraryKind=item.blocks?'ritual':'block';librarySearch='';libraryOrigin='all';navTab='library';
 navStack.length=0;route='library';currentId=null;
 selectedItem=item.blocks?null:{...item,_from:'library'};
 navigate(item.blocks?'ritual':'block',item.blocks?item.id:undefined);
}
function fromDiscover(item){return Boolean(item.origin?.author&&item.origin.author!=='Du'||item.author&&item.author!=='Du'||allCatalog.some(c=>c.id===(item.sourceId||item.id)));}
function filterDialog(library=false){
 modal._filterDraft=library?{origin:libraryOrigin,sort:librarySort,tags:[]}:{origin:discover.origin,tags:[...discover.tags]};
 dialog('Filter',filterContent({library,...modal._filterDraft,topics:TAGS}),'filter');
}
function attribution(item){return item?.author&&item.author!=='Du'&&!item.customized?'<small class="attribution">Von '+esc(item.author)+'</small>':'';}
function header() {
 const names={home:'Home',discover:'Entdecken',library:'Bibliothek',history:'Verlauf',plan:'Kalender',ritual:'Ritual',block:'Baustein',historyDetail:'Dein Morgen'};
 const detail=['ritual','block','historyDetail','plan','history'].includes(route);
 return `<header class="product-header fixed-nav">${detail?`<button class="header-back" data-p="back" aria-label="Zurück">${icon('back')}</button>`:`<button class="profile-avatar" data-p="profile" aria-label="Profil und Einstellungen öffnen">${data.profile.avatar?'<img src="'+data.profile.avatar+'" alt="">':esc((data.profile.name||'Du').slice(0,1).toUpperCase())}</button>`}<span>${route==='block'&&selectedItem?.blocks?'Ritual':names[route]}</span>${route==='ritual'?`<button class="header-add" ${isOwnRoutine(ritualNow())?'data-edit-ritual':'data-routine-options'}="${currentId}" aria-label="${isOwnRoutine(ritualNow())?'Ritual bearbeiten':'Weitere Optionen'}">${isOwnRoutine(ritualNow())?icon('edit'):'⋯'}</button>`:route==='block'&&selectedItem?._from==='discover'?`<button class="header-add catalog-acquire" data-p="${savedItem(selectedItem)?'open-saved':'save-detail'}" aria-label="${savedItem(selectedItem)?'Öffnen':'Merken'}"><span>${savedItem(selectedItem)?'Öffnen':'Merken'}</span></button>`:route==='block'&&libraryItem(selectedItem)?`<button class="header-add" data-p="edit-block" aria-label="Bearbeiten">${icon('edit')}</button>`:'<span class="header-spacer"></span>'}</header>`;
}
export function navigationMarkup() {
 const active=['home','discover','library'].includes(route)?route:navTab;
 return `<nav class="bottom-nav" aria-label="Hauptnavigation">${[['home','home','Home'],['discover','compass','Entdecken'],['library','library','Bibliothek']].map(([key,ico,label])=>`<button data-route="${key}" ${active===key?'aria-current="page"':''}><span class="nav-icon">${icon(ico)}</span><span>${label}</span></button>`).join('')}<button class="nav-create" data-p="create" aria-label="Neu erstellen"><span class="nav-icon">${icon('plus')}</span><span>Neu</span></button></nav>`;
}
function tagPills(tags) { return tags.length ? `<div class="tag-pills">${tags.map(t=>`<span>#${esc(t)}</span>`).join('')}</div>` : ''; }
function teamBadge(item){return isTeamOriginal(item)?'<span class="team-badge" role="img" aria-label="Wakeup Buddy Team">'+icon('sun')+'</span>':'';}
function cover(item,small=false){return `<div class="item-cover ${small?'small-cover':''}" style="${visualStyle(item)}">${symbol(item.finishedCount!==undefined?{...item,kind:'ritual'}:item)}${teamBadge(item)}</div>`;}
function swipeItem(content,kind,id){
 const label=kind==='plan'?'Termin entfernen':kind==='draft'?'Entwurf löschen':'Baustein löschen';
 const attributes=' data-delete-kind="'+kind+'" data-delete-id="'+esc(id)+'"';
 return '<div class="swipe-item" data-swipe-kind="'+kind+'" data-swipe-id="'+esc(id)+'"><button class="swipe-delete"'+attributes+' tabindex="-1" aria-hidden="true" aria-label="'+label+'">'+icon('trash')+'</button><div class="swipe-content">'+content+'</div></div>';
}
function draftDialog(){
 dialog('Entwürfe','<div class="draft-toolbar"><span>'+drafts.length+' Entwürfe</span><button class="quiet danger" data-m="delete-drafts" '+(!drafts.length?'disabled':'')+'>Alle löschen</button></div><div class="draft-list">'+(drafts.length?drafts.map(d=>swipeItem('<button class="create-option" data-draft="'+esc(d._draftKey)+'">'+esc(d.title||'Ohne Titel')+icon('arrow')+'</button>','draft',d._draftKey)).join(''):'<p class="empty-copy">Keine Entwürfe.</p>')+'</div><div class="draft-feedback" role="status">'+esc(draftNotice)+(draftUndo?'<button data-m="undo-drafts">Rückgängig</button>':'')+'</div>','drafts');
}
function catalogAction(item){const saved=savedItem(item);return '<button class="catalog-acquire '+(saved?'is-saved':'')+'" '+(saved?'data-open-catalog="':'data-save-catalog="')+item.id+'" aria-label="'+(saved?'Öffnen':'Merken')+'"><span>'+(saved?'Öffnen':'Merken')+'</span>'+'</button>';}
function itemMeta(item){return item.blocks?item.blocks.length+' '+(item.blocks.length===1?'Baustein':'Bausteine')+' · '+itemMinutes(item)+' Min.':item.steps.length+' '+(item.steps.length===1?'Schritt':'Schritte')+' · '+itemMinutes(item)+' Min. · '+(outputNames[item.output]||'Text');}
function ritualCard(r){
 return `<article class="playlist-card ${managingRituals?'is-managing':''}">${managingRituals?`<button class="ritual-remove" data-delete-kind="ritual" data-delete-id="${r.id}" aria-label="${esc(r.title)} löschen">${icon('minus')}</button>`:''}<button class="playlist-open" data-open-ritual="${r.id}" ${managingRituals?'disabled':''}>${cover(r)}<span class="playlist-copy"><strong>${esc(r.title)}</strong><span>${itemMeta(r)}</span></span></button></article>`;
}
function calendarCells(reference){const days=calendarExpanded?monthDays(reference):weekDays(reference),month=localDay(reference).getMonth();
 return days.map(d=>{
  const key=dayKey(d),p=plansFor(data,key),status=dayStatus(data,key);
  const label={done:'Abgeschlossen',partial:'Teilweise durchgeführt',skipped:'Ausgelassen',planned:'Geplant',empty:'Keine Rituale'}[status];
  const marker=status==='done'?icon('check'):status==='partial'?icon('clock'):status==='skipped'?icon('minus'):p.length?'<span class="calendar-symbol">'+symbol(p[0].ritual)+'</span>':'';
  return '<button data-day="'+key+'" data-status="'+status+'" class="month-day '+(d.getMonth()!==month?'outside ':'')+(status==='done'?'completed ':status==='partial'?'partial ':'')+'" aria-label="'+d.toLocaleDateString(locale(),{weekday:'long',day:'numeric',month:'long'})+' · '+label+(p.length?' · '+p.length+' Rituale':'')+'" aria-pressed="'+(key===reference)+'" '+(key===dayKey()?'aria-current="date"':'')+'><b>'+d.getDate()+'</b><span class="calendar-status" aria-hidden="true">'+marker+'</span></button>';
 }).join('');
}
function weekView(){
 const plans=plansFor(data,selectedDay),past=selectedDay<dayKey(),month=localDay(selectedDay).getMonth(),streak=currentStreak(data);
 for(const run of data.history.filter(r=>runDay(r)===selectedDay)){
  const match=plans.find(p=>run.planKey===planKey(p));if(match){if(!match.run||successful(run))match.run=run;continue;}
  plans.push({id:run.planKey?.split(':')[1]||run.id,date:selectedDay,time:run.planKey?run.planKey.slice(-5):new Date(run.startedAt||run.date).toTimeString().slice(0,5),ritual:{id:run.ritualId,title:run.title,blocks:run.visualBlocks||[],coverPhoto:run.coverPhoto},run});
 }
 const days=monthDays(selectedDay),selectedWeek=Math.floor(days.findIndex(d=>dayKey(d)===selectedDay)/7),runs=data.history.filter(r=>runDay(r)===selectedDay);
 const heading=localDay(selectedDay).toLocaleDateString(locale(),{month:'long',year:'numeric'});
 const cells=calendarCells(selectedDay);
 return planningNotice()+'<section class="calendar"><div class="calendar-heading"><button class="month-toggle" data-p="calendar-expand" aria-expanded="'+calendarExpanded+'">'+heading+icon(calendarExpanded?'up':'down')+'</button><button class="calendar-today" data-p="today">Heute</button></div>'+(streak?'<p class="streak-line">'+icon('fire')+streak+' geplante Morgen in Folge</p>':'')+'<div class="calendar-weekdays">'+weekDays(selectedDay).map(d=>'<span>'+d.toLocaleDateString(locale(),{weekday:'short'}).replace('.','')+'</span>').join('')+'</div><div role="group" aria-label="Kalender, mit Pfeiltasten Woche oder Monat wechseln" tabindex="0" class="calendar-window '+(calendarExpanded?'expanded':'compact')+'" style="--selected-week:'+selectedWeek+'"><div class="calendar-track"><div class="calendar-page"><div class="month-grid '+(calendarExpanded?'expanded':'compact')+'">'+cells+'</div></div></div></div><div class="day-heading"><h2>'+localDay(selectedDay).toLocaleDateString(locale(),{weekday:'long',day:'numeric',month:'short'})+'</h2></div><div class="day-agenda">'+plans.map(p=>{const status=p.run?(successful(p.run)?'done':p.run.finishedCount>0||!p.run.ended?'partial':'skipped'):statusForPlan(data,p),label={done:'Abgeschlossen',partial:'Teilweise durchgeführt',skipped:'Ausgelassen',planned:''}[status];const badge=label?'<span class="run-badge '+status+'" aria-label="'+label+'">'+icon(status==='done'?'check':status==='partial'?'clock':'minus')+'</span>':'';const row='<details class="planned-ritual"><summary><span class="status-cover">'+cover(p.ritual,true)+badge+'</span><span class="agenda-copy"><b data-user-content>'+esc(p.ritual.title)+'</b><time>'+clockLabel(p.time)+(label?' · '+label:'')+'</time></span>'+icon('down')+'</summary><div class="agenda-details"><p>'+(p.run?label:(p.oneOff?'Nur an diesem Tag':'Wöchentlich')+' · '+itemMinutes(p.ritual)+' Min.')+'</p>'+(p.run?'<button class="quiet" data-history-id="'+p.run.id+'">Durchlauf ansehen '+icon('arrow')+'</button>':'<button class="quiet" data-open-ritual="'+p.ritual.id+'">Ritual öffnen '+icon('arrow')+'</button>')+(!past&&!p.run&&status==='planned'?'<button class="quiet" data-plan-edit="'+(p.oneOff?p.id:p.ritual.id)+'">Für diesen Tag ändern '+icon('edit')+'</button><button class="quiet danger" data-delete-kind="plan" data-delete-id="'+esc(planKey(p))+'">Termin entfernen</button>':'')+'</div></details>';return past||p.run||status!=='planned'?row:swipeItem(row,'plan',planKey(p));}).join('')+(!plans.length?'<p class="day-empty">'+(data.scheduleRevisions?.length&&selectedDay<dayKey(new Date(data.scheduleRevisions[0].effectiveAt))?'Für diesen Tag liegen keine Planungsdaten vor.':'Zeit für einen freien Morgen.')+'</p>':'')+'</div>'+(!past&&!plans.length&&!dayHasStarted(data,selectedDay)?'<button class="plan-day-link" data-p="plan-day">'+icon('plus')+' Ritual einplanen</button>':'')+'</section>';
}
function planningNotice(){return data.planMigrationNotice?'<aside class="schedule-notice"><strong>Ein Ritual pro Tag</strong>Bei bisherigen Überschneidungen bleibt der früheste Termin. Einzelne Termine haben Vorrang vor dem Wochenplan. Deine Rituale und dein Verlauf bleiben erhalten.<button data-p="dismiss-plan-notice">Verstanden</button></aside>':'';}
function homeView(){
 const state=morningState(data),r=state.ritual,date=new Date();date.setDate(date.getDate()+1);
 const tomorrow=dayKey(date),plans=plansFor(data,tomorrow);
 const today=['resume','missed'].includes(state.kind)?'<section class="today-reminder"><span><small>Heute</small><strong data-user-content>'+esc(r.title)+'</strong></span><button class="start-ritual home-start" data-p="start-morning">'+icon(state.kind==='resume'?'play':'sun')+(state.kind==='resume'?'Fortsetzen':'Los geht’s')+'</button></section>':state.kind==='done'?'<p class="morning-complete">'+icon('check')+' Dein heutiges Ritual ist durchgeführt.</p>':'';
 return planningNotice()+'<section class="morning-welcome"><span class="eyebrow">DEIN MOMENT AM MORGEN</span><h1>Heute beginnt<br>mit <em>dir.</em></h1><button type="button" class="welcome-friend" data-p="buddy-react" aria-label="'+selectedBuddy().name+' begrüßen">'+buddyArt()+'</button></section>'+today+'<section class="next-morning tomorrow-plan"><div class="section-heading"><div><h2>Morgen</h2><p>'+date.toLocaleDateString(locale(),{weekday:'long',day:'numeric',month:'short'})+'</p></div><button class="icon-btn" data-route="plan" aria-label="Kalender öffnen">'+icon('calendar')+'</button></div>'+plans.map(plan=>swipeItem('<button class="next-ritual" data-home-plan="'+esc(planKey(plan))+'">'+cover(plan.ritual,true)+'<span><strong data-user-content>'+esc(plan.ritual.title)+'</strong><small>'+plan.ritual.blocks.length+' Bausteine · '+itemMinutes(plan.ritual)+' Min.</small></span><time class="wake-time">'+clockLabel(plan.time)+'</time></button>','plan',planKey(plan))).join('')+(!plans.length?'<p class="tomorrow-empty">Noch kein Ritual geplant.</p><button class="secondary" data-p="plan-tomorrow">'+icon('plus')+' Ritual für morgen auswählen</button>':'')+'</section><div class="home-history"><button class="section-link" data-route="history">'+icon('history')+' Verlauf ansehen</button></div><div class="section-heading"><h2>Deine Rituale</h2><button class="section-link" data-route="library">Alle ansehen</button></div><div class="playlist-grid">'+data.rituals.slice(0,6).map(ritualCard).join('')+'</div>';
}
function catalogCard(item){return '<article class="catalog-card"><button data-catalog="'+item.id+'">'+cover(item,true)+'<span class="catalog-copy"><small>Baustein · '+esc(item.author)+'</small><b>'+esc(item.title)+'</b><span>'+itemMeta(item)+'</span></span></button>'+catalogAction(item)+'</article>';}
function discoverView() {
  const filtered = allCatalog.filter(item => (discover.kind === 'all' || (item.blocks ? 'ritual' : 'block') === discover.kind) && (discover.origin === 'all' || (item.publisherId==='wakeup-buddy-team' ? 'team' : 'community') === discover.origin) && (!discover.tags.length || itemTags(item).some(t=>discover.tags.includes(t))) && `${item.title} ${item.description} ${item.author}`.toLocaleLowerCase('de').includes(discover.search.toLocaleLowerCase('de')));
  const rituals=filtered.filter(item=>item.blocks),items=filtered.filter(item=>!item.blocks);
  return `<label class="search-box">${icon('search')}<input id="discover-search" placeholder="Bausteine und Rituale suchen" value="${esc(discover.search)}" aria-label="Discover durchsuchen"></label><div class="discover-toolbar"><div class="filter-tabs">${[['all','Alle'],['ritual','Rituale'],['block','Bausteine']].map(([key,label])=>`<button data-discover-kind="${key}" aria-pressed="${discover.kind===key}">${label}</button>`).join('')}</div><div class="discover-filters"><button data-p="tag-filter" class="tag-filter">${icon('filter')} Filter${discover.tags.length || discover.origin!=='all' ? ' · '+(discover.tags.length+(discover.origin!=='all'?1:0)) : ''}</button></div></div>${discover.tags.length ? `<div class="active-tags">${discover.tags.map(t=>`<button data-clear-tag="${esc(t)}">#${esc(t)} ×</button>`).join('')}</div>` : ''}${rituals.length?'<div class="section-heading"><h2>Rituale</h2></div><div class="playlist-grid">'+rituals.map(item=>'<article class="playlist-card discover-ritual"><button class="playlist-open" data-catalog="'+item.id+'">'+cover(item)+'<span class="playlist-copy"><strong data-user-content>'+esc(item.title)+'</strong><span>'+itemMeta(item)+'</span></span></button>'+catalogAction(item)+'</article>').join('')+'</div>':''}${items.length?'<div class="section-heading"><h2>Bausteine</h2></div><div class="catalog-list">'+items.map(item=>catalogCard(item)).join('')+'</div>':''}${!filtered.length?'<div class="empty-state">Keine Treffer.<p>Versuche andere Tags oder einen anderen Suchbegriff.</p><button class="secondary" data-p="clear-filters">Filter zurücksetzen</button></div>':''}`;
}
function libraryView() {
  const match=x=>x.title.toLocaleLowerCase('de').includes(librarySearch.toLocaleLowerCase('de'))&&(libraryOrigin==='all'||fromDiscover(x)===(libraryOrigin==='saved'));const rs=data.rituals.filter(match),bs=blocks.filter(match);if(librarySort==='name'){rs.sort((a,b)=>a.title.localeCompare(b.title,'de'));bs.sort((a,b)=>a.title.localeCompare(b.title,'de'));}else{rs.reverse();bs.sort((a,b)=>(b.createdAt||b.updatedAt||'').localeCompare(a.createdAt||a.updatedAt||''));}
  return `<label class="search-box">${icon('search')}<input id="library-search" value="${esc(librarySearch)}" placeholder="In deiner Bibliothek suchen" aria-label="Bibliothek durchsuchen"></label>${drafts.length?'<button class="draft-entry" data-p="drafts">Entwürfe fortsetzen <span>'+drafts.length+'</span>'+icon('arrow')+'</button>':''}<div class="discover-toolbar library-toolbar"><div class="filter-tabs library-tabs"><button data-library-kind="ritual" aria-pressed="${libraryKind==='ritual'}">Rituale <small>${rs.length}</small></button><button data-library-kind="block" aria-pressed="${libraryKind==='block'}">Bausteine <small>${bs.length}</small></button></div><button class="tag-filter" data-p="sort-library">${icon('filter')} Filter${libraryOrigin!=='all'||librarySort!=='recent'?' · '+Number(Number(libraryOrigin!=='all')+Number(librarySort!=='recent')):''}</button></div>${libraryKind === 'ritual' ? `<div class="playlist-grid">${rs.map(ritualCard).join('')}</div>` : `<div class="library-blocks">${bs.map(block=>swipeItem(`<button class="library-block" data-open-block="${block.id}">${cover(block,true)}<span><b>${esc(block.title)}</b><small>${itemMeta(block)}</small>${attribution(block)}</span></button>`,'block',block.id)).join('')}</div>`}${(librarySearch||libraryOrigin!=='all')&&!(libraryKind==='ritual'?rs:bs).length?'<p class="empty-copy">Keine Treffer.</p>':''}${(libraryKind === 'ritual' ? !data.rituals.length : !blocks.length) ? '<div class="empty-state">Noch ganz viel Platz für dich.<p>Erstelle etwas Eigenes oder entdecke neue Ideen.</p><button class="secondary" data-route="discover">Entdecken</button></div>' : ''}`;
}
function ritualView() {
 const r=ritualNow();if(!r)return '<p>Dieses Ritual ist nicht verfügbar.</p>';
 const next=nextPlan(data,new Date(),r.id),once=next?.oneOff;
 return `<div class="ritual-hero"><div class="ritual-cover-edit">${cover(r)}${isTeamOriginal(r)?'':'<button class="cover-camera" data-p="cover-photo" aria-label="Coverfoto ändern">'+icon('edit')+'</button>'}<input id="ritual-cover-file" type="file" accept="image/*" hidden></div><div class="ritual-title"><h1>${esc(r.title)}</h1><span class="ritual-meta">${r.blocks.length} Bausteine · ${itemMinutes(r)} Minuten</span></div>${r.description?`<p class="ritual-description">${esc(r.description)}</p>`:''}${attribution(r)}</div><div class="ritual-actions"><button class="secondary schedule-summary" data-schedule-ritual="${r.id}" ${r.blocks.length?'':'disabled'}>${icon('timer')}<span>${next?(once?localDay(next.date).toLocaleDateString(locale(),{day:'numeric',month:'short'}):alarmDays(r.alarm.days))+' · '+clockLabel(next.time):'Einplanen'}</span></button><button class="secondary ritual-preview" data-p="preview-ritual" ${r.blocks.length?'':'disabled'}>${icon('play')} Vorschau</button></div><div class="section-heading"><h2>Dein Ablauf</h2><button class="icon-btn" data-p="add-block" aria-label="Bausteine auswählen">${icon('plus')}</button></div><div class="step-list ritual-track-list is-reordering">${r.blocks.map((b,i)=>`<article class="step ritual-track ${isOwnRoutine(r)?'swipe-item':''}" data-step="${b.id}">${isOwnRoutine(r)?`<button class="swipe-delete" data-unlink-block="${b.id}" tabindex="-1" aria-hidden="true" aria-label="${esc(b.title)} aus Ritual entfernen">${icon('trash')}</button>`:''}<div class="swipe-content ritual-track-content"><button class="drag-handle" data-drag="${b.id}" aria-label="${esc(b.title)} verschieben" ${r.blocks.length<2||!isOwnRoutine(r)?'disabled':''}>${icon('grip')}</button><button class="track-open" data-ritual-block="${i}">${cover(b,true)}<span><b>${esc(b.title)}</b><small>${itemMeta(b)}</small></span></button></div></article>`).join('')}</div>${isOwnRoutine(r)?`${!r.blocks.length?'<p class="empty-copy">Füge Bausteine hinzu, um dieses Ritual zu nutzen. Der Weckplan ist deaktiviert.</p>':''}<button class="delete-ritual quiet" data-delete-kind="ritual" data-delete-id="${r.id}">Ritual löschen</button>`:''}`;
}
function blockView() {
 const b=selectedItem;if(!b)return '';const isRitual=Boolean(b.blocks),saved=libraryItem(b);
 return `<div class="detail-hero compact-hero">${cover(b,true)}<div class="detail-heading"><span class="overline">${isRitual?'RITUAL':'BAUSTEIN'}</span><h1>${esc(b.title)}</h1>${attribution(b)}<p class="detail-time">${itemMeta(b)}</p></div></div>${b.description?'<div class="detail-description formatted-text">'+renderRich(b.description)+'</div>':''}${tagPills(itemTags(b))}<div class="detail-actions">${saved?'<span class="saved-status sr-only">In deiner Bibliothek</span>':''}${!isRitual?'<button class="secondary" data-p="add-detail">'+icon('plus')+' Zu Ritual hinzufügen</button>':''}<button class="secondary" data-p="preview-detail">${icon('play')} Vorschau</button></div><div class="detail-content">${isRitual?b.blocks.map((block,i)=>`<details class="read-step-details"><summary>${cover(block,true)}<b>${esc(block.title)}</b><span>${itemMeta(block)}</span>${icon('down')}</summary><div class="formatted-text">${block.steps.map(s=>renderRich(s.message?.text||'')).join('<hr>')}</div></details>`).join(''):b.steps.map((s,i)=>`<details class="read-step-details"><summary><b>Schritt ${i+1}</b><span>${s.minutes} Min.</span>${icon('down')}</summary><div class="formatted-text">${renderRich(s.message?.text||'')}</div></details>`).join('')}</div>${saved&&!isRitual&&b._from==='library'?'<button class="delete-ritual quiet" data-p="remove-library">Baustein löschen</button>':''}`;
}
function historyCalendar(){
 const today=new Date(),start=new Date(today);start.setDate(start.getDate()-(start.getDay()+6)%7-77);
 const days=Array.from({length:84},(_,i)=>{const d=new Date(start);d.setDate(d.getDate()+i);const key=dayKey(d),runs=data.history.filter(r=>runDay(r)===key);const status=runs.some(successful)?'done':runs.length?'partial':'empty';return '<button data-day="'+key+'" class="heat-day '+status+(key>dayKey()?' future':'')+'" aria-label="'+d.toLocaleDateString(locale(),{day:'numeric',month:'long'})+': '+(status==='done'?'Durchgeführt':status==='partial'?'Unterbrochen oder ausgelassen':'Kein Durchlauf')+'" title="'+d.toLocaleDateString(locale(),{day:'numeric',month:'short'})+'"></button>';});
 return '<section class="history-calendar"><div class="section-heading"><h2>Deine letzten 12 Wochen</h2></div><p class="heat-range">'+start.toLocaleDateString(locale(),{day:'numeric',month:'short'})+' – '+today.toLocaleDateString(locale(),{day:'numeric',month:'short'})+' · Tippe auf einen Tag</p><div class="heat-grid">'+days.join('')+'</div><div class="heat-legend"><span><i class="done"></i> Durchgeführt</span><span><i class="partial"></i> Unterbrochen / ausgelassen</span></div></section>';
}
function historyView(day=null){
 if(!data.history.length)return '<div class="page-intro"><h1>Deine Morgen.</h1></div><div class="empty-state history-empty">'+symbol({symbol:'sun',theme:'peach'})+'<h2>Hier beginnt deine Geschichte.</h2><p>Nach deinem ersten Ritual findest du hier deinen Durchlauf und deine Antworten.</p></div>';
 return '<div class="page-intro"><h1>Deine Morgen.</h1></div>'+historyCalendar()+'<div class="history-list">'+data.history.filter(run=>!day||runDay(run)===day).map(run=>'<button class="history-card" data-history-id="'+run.id+'">'+cover(run,true)+'<span><b data-user-content>'+esc(run.title)+'</b><time>'+new Date(run.startedAt||run.date).toLocaleDateString(locale(),{day:'numeric',month:'short'})+' · '+clockLabel(new Date(run.startedAt||run.date).toTimeString().slice(0,5))+'</time><small>'+(successful(run)?'Durchgeführt':run.finishedCount>0?'Teilweise durchgeführt':run.ended?'Ausgelassen':'Unterbrochen')+'</small></span>'+icon('arrow')+'</button>').join('')+'</div>';
}
function historyDetail(id=currentId){
 const run=data.history.find(x=>x.id===id);if(!run)return '';
 return '<div class="history-detail-heading">'+cover(run,true)+'<div><time>'+new Date(run.startedAt||run.date).toLocaleDateString(locale(),{day:'numeric',month:'long',year:'numeric'})+'</time><h1 data-user-content>'+esc(run.title)+'</h1><p>'+run.finishedCount+' von '+run.totalSteps+' Schritte abgeschlossen</p></div></div><div class="history-steps">'+run.answers.map(a=>'<details class="history-answer"><summary>'+cover(a,true)+'<span><b data-user-content>'+esc(a.blockTitle)+'</b><span>Schritt '+(a.stepIndex+1)+'</span></span><small>'+(a.finished?'Abgeschlossen':a.skipped?'Übersprungen':'Offen')+'</small>'+icon('down')+'</summary><div class="history-answer-body">'+(a.researchResult?'<span class="answer-label">Verwendetes Rechercheergebnis</span><div class="formatted-text">'+renderRich(a.researchResult.text)+'</div><p class="muted">'+esc(new Date(a.researchResult.retrievedAt).toLocaleString(locale()))+'</p>'+a.researchResult.sources.filter(source=>/^https:\/\//.test(source.url)).map(source=>'<p><a target="_blank" rel="noopener noreferrer" href="'+esc(source.url)+'">'+esc(source.title)+'</a></p>').join(''):'')+(a.instruction?'<span class="answer-label">Deine Anweisung</span><div class="formatted-text">'+renderRich(a.instruction)+'</div>':'')+(a.text||a.audio||a.photos?.length?'<span class="answer-label">Deine Antwort</span>':'')+(a.text?'<div class="formatted-text saved-response">'+renderRich(a.text)+'</div>':'')+(a.audio?'<audio controls src="'+a.audio+'" aria-label="Deine Aufnahme"></audio>':a.memo?'<p>Für diese ältere Aufnahme liegt keine Audiodatei vor.</p>':'')+(a.photos||[]).map(src=>'<img src="'+src+'" alt="Dein Foto aus diesem Durchlauf">').join('')+(!a.text&&!a.memo&&!a.photos?.length?'<p class="muted">Keine Antwort hinterlegt.</p>':'')+'</div></details>').join('')+'</div><div class="history-manage"><button class="quiet" data-p="export-run">Durchlauf sichern</button><button class="quiet danger" data-p="delete-run">Durchlauf löschen</button></div>';
}
let calendarGesture=null,calendarMoving=false,calendarSuppressClick=0,calendarMotionToken=0,calendarSpring=null,calendarPosition=0;
function calendarOffset(direction){const date=localDay(selectedDay);if(calendarExpanded){const day=date.getDate();date.setDate(1);date.setMonth(date.getMonth()+direction);date.setDate(Math.min(day,new Date(date.getFullYear(),date.getMonth()+1,0).getDate()));}else date.setDate(date.getDate()+7*direction);return dayKey(date);}
function prepareCalendarPages(){
 const viewport=$('.calendar-window',root),track=viewport?.querySelector('.calendar-track');if(!track)return null;
 if(!track.querySelector('.calendar-preview'))for(const direction of [-1,1]){
  const key=calendarOffset(direction),week=Math.floor(monthDays(key).findIndex(d=>dayKey(d)===key)/7),page=document.createElement('div');
  page.className='calendar-page calendar-preview';page.inert=true;page.setAttribute('aria-hidden','true');page.style.left=direction*100+'%';page.style.setProperty('--selected-week',week);
  page.innerHTML='<div class="month-grid '+(calendarExpanded?'expanded':'compact')+'">'+calendarCells(key)+'</div>';
  page.querySelectorAll('[data-day]').forEach(el=>{el.dataset.previewDay=el.dataset.day;delete el.dataset.day;el.tabIndex=-1;});track.append(page);
 }
 return track;
}
function cancelCalendarMotion(){calendarMotionToken++;calendarSpring?.cancel();calendarMoving=false;calendarGesture=null;calendarPosition=0;const track=$('.calendar-track',root);if(track){track.style.transform='';track.querySelectorAll('.calendar-preview').forEach(el=>el.remove());}}
async function moveCalendar(direction,velocity=0){
 calendarSpring?.cancel();calendarMoving=true;const token=++calendarMotionToken,track=prepareCalendarPages();if(!track){calendarMoving=false;return;}
 const width=track.getBoundingClientRect().width,destination=direction?calendarOffset(direction):selectedDay,focused=document.activeElement?.closest('.calendar-window');
 try{
  calendarSpring=spring({from:calendarPosition,to:-direction*width,velocity,update:value=>{calendarPosition=value;track.style.transform=`translateX(${value}px)`;}});
  if(!await calendarSpring.finished)return;
  if(token!==calendarMotionToken||route!=='plan')return;
  calendarPosition=0;selectedDay=destination;render();if(focused)$('.calendar-window',root)?.focus({preventScroll:true});
 }finally{if(token===calendarMotionToken)calendarMoving=false;}
}
root.addEventListener('pointerdown',e=>{calendarSuppressClick=0;if(e.button!==0||e.isPrimary===false||!e.target.closest('.calendar-window'))return;calendarMotionToken++;calendarSpring?.cancel();calendarMoving=false;calendarGesture={x:e.clientX,y:e.clientY,id:e.pointerId,viewport:e.target.closest('.calendar-window'),axis:null,dx:calendarPosition,start:calendarPosition,sampleValue:calendarPosition,sampleTime:performance.now(),velocity:0};});
root.addEventListener('pointermove',e=>{
 const g=calendarGesture;if(!g||g.id!==e.pointerId)return;const dx=e.clientX-g.x,dy=e.clientY-g.y;g.dx=g.start+dx;
 if(!g.axis&&Math.max(Math.abs(dx),Math.abs(dy))>6){g.axis=Math.abs(dx)>Math.abs(dy)*1.2?'x':'y';if(g.axis==='x'){g.track=prepareCalendarPages();g.viewport.setPointerCapture(e.pointerId);}}
 if(g.axis==='x'){e.preventDefault();const width=g.viewport.clientWidth;calendarPosition=Math.max(-width,Math.min(width,g.dx));sample(g,calendarPosition);g.track.style.transform=`translateX(${calendarPosition}px)`;}
});
function releaseCalendar(e){const g=calendarGesture;if(!g||g.id!==e.pointerId)return;calendarGesture=null;if(g.viewport.hasPointerCapture(e.pointerId))g.viewport.releasePointerCapture(e.pointerId);if(g.axis!=='x'){if(calendarPosition)void moveCalendar(0);return;}calendarSuppressClick=performance.now()+350;const velocity=releaseVelocity(g),direction=e.type==='pointercancel'?0:Math.abs(velocity)>.4?(velocity<0?1:-1):Math.abs(g.dx)>Math.min(64,g.viewport.clientWidth*.22)?(g.dx<0?1:-1):0;void moveCalendar(direction,velocity);}
root.addEventListener('pointerup',releaseCalendar);root.addEventListener('pointercancel',releaseCalendar);
root.addEventListener('click',e=>{if(performance.now()<calendarSuppressClick&&e.target.closest('.calendar-window')){e.preventDefault();e.stopImmediatePropagation();}},true);
root.addEventListener('keydown',e=>{if(e.target.closest('.calendar-window')&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();void moveCalendar(e.key==='ArrowRight'?1:-1);}});

// One long press enters management; moving a finger remains ordinary scrolling.
let ritualPress=null,ritualPressUntil=0;
function endRitualPress(){if(ritualPress?.active)ritualPressUntil=performance.now()+450;clearTimeout(ritualPress?.timer);ritualPress=null;}
root.addEventListener('pointerdown',e=>{
 if(!ritualPress?.active)ritualPressUntil=0;
 if(e.button!==0||managingRituals||!['home','library'].includes(route)||!e.target.closest('[data-open-ritual]'))return;
 endRitualPress();ritualPress={x:e.clientX,y:e.clientY,id:e.pointerId,active:false};
 ritualPress.timer=setTimeout(()=>{if(!ritualPress)return;ritualPress.active=true;ritualPressUntil=performance.now()+1000;window.getSelection()?.removeAllRanges();managingRituals=true;render();announce('Rituale bearbeiten. Wähle ein Minus zum Löschen.');},550);
});
root.addEventListener('pointermove',e=>{if(ritualPress&&!ritualPress.active&&Math.hypot(e.clientX-ritualPress.x,e.clientY-ritualPress.y)>10)endRitualPress();});
root.addEventListener('pointerup',endRitualPress);root.addEventListener('pointercancel',endRitualPress);
root.addEventListener('selectstart',e=>{if((e.target.closest?e.target:e.target.parentElement)?.closest('.playlist-card,.library-toolbar,.discover-toolbar'))e.preventDefault();});
root.addEventListener('contextmenu',e=>{if(['home','library'].includes(route)&&e.target.closest('[data-open-ritual]')){e.preventDefault();endRitualPress();ritualPressUntil=performance.now()+450;managingRituals=true;render();}});
root.addEventListener('click',e=>{if(performance.now()<ritualPressUntil){e.preventDefault();e.stopImmediatePropagation();return;}if(managingRituals&&!e.target.closest('button,a,input,textarea,select,summary,.playlist-card')){managingRituals=false;render();}},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&managingRituals&&!document.querySelector('dialog[open]')){managingRituals=false;render();}});
function updateCalendarFocus(){const viewport=$('.calendar-window',root);if(!viewport)return;viewport.querySelectorAll('[data-day]').forEach(el=>{el.tabIndex=0;el.removeAttribute('aria-hidden');});}
function render() {
  const view=route+':'+(currentId||selectedItem?.id||''),sameView=root.dataset.view===view;
  const expanded=sameView?[...root.querySelectorAll('details')].map(el=>el.open):[];
  const scroll=scrollY,focus=sameView&&root.contains(document.activeElement)?document.activeElement:null;const focusKey=focus?.id,selection=focus?.selectionStart;
  root.dataset.view=view;
  root.innerHTML = `<div class="product-shell">${header()}<main class="product-content">${notice?`<div class="product-toast" role="status">${esc(notice)}${lastUndo?'<button data-p="undo-delete">Rückgängig</button>':''}</div>`:''}${route==='home'?homeView():route==='plan'?weekView():route==='discover'?discoverView():route==='library'?libraryView():route==='history'?historyView():route==='ritual'?ritualView():route==='block'?blockView():historyDetail()}</main>${navigationMarkup()}</div>`;root.querySelectorAll('details').forEach((el,i)=>{if(expanded[i])el.open=true;});translateUI(root);if(sameView){window.scrollTo(0,scroll);if(focusKey){const next=document.getElementById(focusKey);next?.focus({preventScroll:true});if(typeof selection==='number')next?.setSelectionRange?.(selection,selection);}}
 if(!sameView)animateScreen(root,navigationDirection);
 updateCalendarFocus();navigationDirection='forward';
}
function dialog(title, content, mode,decorate) {
 if(!['alarm','date-plan','alarm-sounds','plan-picker'].includes(mode))modal._scheduleRitual=null;
 const changed=modalMode!==mode;modalMode=mode;modal.dataset.mode=mode||'';
 const update=()=>{modal.innerHTML=`<div class="dialog-head"><h2>${title}</h2><button class="icon-btn" data-m="close" aria-label="Schließen">${icon('close')}</button></div>${content}`;decorate?.();};
 if(changed)refreshSheet(modal,update);else update();
 if(!modal.open||modal.dataset.closing)modal.showModal();attachTimeWheels(modal);
}
function planDialog(plan){
 modal._scheduleOrigin||='day';
 const proposed=new Date(Date.now()+15*60000);proposed.setMinutes(Math.ceil(proposed.getMinutes()/5)*5,0,0);
 const base=plan?{...plan,replacesRitualId:plan.replacesRitualId??(!plan.oneOff?plan.ritual?.id:null)}:{date:selectedDay===dayKey()?dayKey(proposed):selectedDay,time:selectedDay===dayKey()?proposed.toTimeString().slice(0,5):'07:00',oneOff:false,replacesRitualId:null};const r=base.ritual||data.rituals.find(r=>r.id===base.ritualId),occupied=plansFor(data,base.date)[0],replacing=occupied&&r&&occupied.ritual.id!==r.id;base.tone=base.tone||r?.alarm?.tone||defaultAlarm().tone;modal._planBase=structuredClone(base);modal._planChoice=r?.id||'';modal._alarmSoundContext='date-plan';if(modal._scheduleRitual!==(r?.id||null)){modal._scheduleDrafts={};modal._scheduleRitual=r?.id||null;}modal._scheduleDrafts||={};
 dialog(localDay(base.date).toLocaleDateString(locale(),{weekday:'long',day:'numeric',month:'long'}),'<form id="date-plan-form">'+(occupied?'<p class="schedule-conflict" role="status">Bereits geplant: <b data-user-content>'+esc(occupied.ritual.title)+'</b> · '+clockLabel(occupied.time)+'. Pro Tag ist ein Ritual möglich.</p>':'')+'<input type="hidden" name="date" value="'+base.date+'"><input type="hidden" name="ritual" value="'+(r?.id||'')+'"><button type="button" class="plan-ritual-choice" data-m="choose-plan-ritual">'+(r?cover(r,true)+'<span>'+esc(r.title)+'</span>':'<span>Ritual auswählen</span>')+icon('down')+'</button>'+timeWheel(base.time,data.profile.timeFormat==='12')+'<input type="hidden" name="tone" value="'+base.tone+'"><button type="button" class="tone-setting" data-m="plan-sounds">'+icon('audio')+'<span>Weckton<b>'+TRACKS.find(t=>t.id===base.tone)?.title+'</b></span>'+icon('arrow')+'</button><p class="form-error" id="date-plan-error" role="alert"></p><button class="primary" type="submit" '+(r?'':'disabled')+'>'+(replacing?'Ritual ersetzen':occupied?'Änderung speichern':'Einplanen')+'</button>'+'</form>','date-plan',()=>scheduleControls('date'));
}
function openPlanPicker(mode='date'){
 const form=modal.querySelector('form');form?._flushTime?.();const v=new FormData(form);
 modal._planReturnMode=mode;modal._planTime=String(v.get('time'));
 if(form.id==='date-plan-form')modal._planBase={...modal._planBase,date:String(v.get('date')),time:modal._planTime,tone:String(v.get('tone'))};
 else{modal._scheduleDrafts.weekly={...modal._alarmDraft,time:modal._planTime,tone:String(v.get('tone')),days:v.getAll('days').map(Number)};modal._planBase={...modal._planBase,time:modal._planTime,tone:String(v.get('tone'))};modal._planChoice=modal._scheduleRitual;}
 const trigger=form.querySelector('.plan-ritual-choice');if(!trigger)return;
 const existing=form.querySelector('.plan-dropdown');if(existing){existing.remove();trigger.setAttribute('aria-expanded','false');return;}
 let anchor=trigger.parentElement;if(!anchor.classList.contains('plan-choice-anchor')){anchor=document.createElement('div');anchor.className='plan-choice-anchor';trigger.before(anchor);anchor.append(trigger);}
 trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','true');trigger.setAttribute('aria-controls','plan-options');
 const menu=document.createElement('div');menu.className='plan-dropdown';menu.innerHTML='<div id="plan-options" role="listbox" aria-label="Ritual auswählen">'+planPicker()+'</div>';anchor.append(menu);translateUI(menu);
 menu.querySelector('button')?.focus({preventScroll:true});
 menu.addEventListener('keydown',event=>{const buttons=[...menu.querySelectorAll('button')],i=buttons.indexOf(document.activeElement);if(event.key==='Escape'){event.stopPropagation();event.preventDefault();menu.remove();trigger.setAttribute('aria-expanded','false');trigger.focus();}else if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();const index=event.key==='Home'?0:event.key==='End'?buttons.length-1:Math.max(0,Math.min(buttons.length-1,i+(event.key==='ArrowDown'?1:-1)));buttons[index]?.focus();}});
}
function planPicker(query=''){
 const options=data.rituals.filter(r=>r.blocks.length&&r.title.toLocaleLowerCase('de').includes(query.toLocaleLowerCase('de'))).sort((a,b)=>Number(b.id===modal._planChoice)-Number(a.id===modal._planChoice));
 return options.map(r=>'<button type="button" role="option" aria-selected="'+(modal._planChoice===r.id)+'" class="library-block" data-select-plan="'+r.id+'">'+cover(r,true)+'<span><b>'+esc(r.title)+'</b><small>'+itemMeta(r)+'</small></span></button>').join('')||'<p class="empty-copy">Kein passendes Ritual.</p>';
}

function alarmDays(days = []) { return days.length===7?'Jeden Tag':days.length?days.map(d=>new Date(2026,8,27+d).toLocaleDateString(locale(),{weekday:'short'}).replace('.','')).join(', '):'Keine Tage'; }
function scheduleDialog(r,mode,plan){
 if(!r)return;
 modal._scheduleOrigin||='ritual';
 if(modal._scheduleRitual!==r.id){modal._scheduleDrafts={};modal._scheduleRitual=r.id;}
 const next=nextPlan(data,new Date(),r.id);mode=mode||(next?.oneOff?'date':'weekly');
 if(mode==='weekly')alarmDialog(r,modal._scheduleDrafts.weekly);
 else{
  const tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);
  planDialog(plan||modal._scheduleDrafts.date||(next?.oneOff?next:{date:dayKey(tomorrow),time:r.alarm?.time||'07:00',tone:r.alarm?.tone||defaultAlarm().tone,ritual:r}));
 }
}
function scheduleControls(mode){
 const id=modal._scheduleRitual,form=modal.querySelector('form');
 modal.querySelector('.dialog-head h2').textContent='Ritual planen';
 form.insertAdjacentHTML('beforebegin','<div class="filter-tabs schedule-tabs">'+[['weekly','Wöchentlich'],['date','Einzelner Tag']].map(([key,label])=>'<button type="button" data-schedule-mode="'+key+'" aria-pressed="'+(mode===key)+'">'+label+'</button>').join('')+'</div>');
 if(mode==='date'){
  const date=form.elements.date;date.type='date';date.min=dayKey();date.className='field-input';date.required=true;
  const label=document.createElement('label');label.className='label schedule-date';label.textContent='Datum';form.querySelector('.time-wheel').after(label);
  const field=document.createElement('span');field.className='schedule-date-control';field.innerHTML=icon('calendar')+'<span data-date-label></span>'+icon('down');label.append(field);field.append(date);date.setAttribute('aria-label','Datum');
  const updateDate=()=>{field.querySelector('[data-date-label]').textContent=date.value?localDay(date.value).toLocaleDateString(locale(),{day:'numeric',month:'short',year:'numeric'}):'Datum wählen';};date.addEventListener('input',updateDate);date.addEventListener('change',updateDate);updateDate();
  if(modal._scheduleOrigin==='ritual')form.querySelector('.plan-ritual-choice')?.remove();
  updateDateConflict();
 }
 if(mode==='weekly'&&modal._scheduleOrigin==='day'){const r=data.rituals.find(r=>r.id===id);form.insertAdjacentHTML('afterbegin','<button type="button" class="plan-ritual-choice" data-m="choose-plan-ritual">'+cover(r,true)+'<span>'+esc(r.title)+'</span>'+icon('down')+'</button>');}
 const dates=(data.datePlans||[]).filter(p=>id&&p.ritualId===id&&p.date>=dayKey()&&!p.cancelled).sort((a,b)=>a.date.localeCompare(b.date));
 if(dates.length)form.querySelector('[type=submit]').insertAdjacentHTML('beforebegin','<div class="scheduled-dates"><h3>Einzelne Termine</h3>'+dates.map(p=>'<button type="button" data-schedule-date="'+p.id+'">'+localDay(p.date).toLocaleDateString(locale(),{day:'numeric',month:'short'})+' · '+clockLabel(p.time)+icon('edit')+'</button>').join('')+'<button type="button" data-schedule-new>'+icon('plus')+' Weiteren Tag planen</button></div>');
}
function updateDateConflict(){
 const form=$('#date-plan-form');if(!form)return;
 let label=form.querySelector('.schedule-conflict');if(!label){label=document.createElement('p');label.className='schedule-conflict';label.setAttribute('role','status');form.prepend(label);}
 const occupied=plansFor(data,form.elements.date.value)[0],other=occupied&&occupied.ritual.id!==form.elements.ritual.value;
 label.hidden=!other;label.textContent=other?'Bereits geplant: '+occupied.ritual.title+' · '+clockLabel(occupied.time)+'. Pro Tag ist ein Ritual möglich.':'';
 form.querySelector('[type=submit]').textContent=other?'Ritual ersetzen':occupied?'Änderung speichern':'Einplanen';
}
function alarmDialog(r,alarm){
 const a=alarm||r.alarm||defaultAlarm();modal._alarmRitual=r;modal._alarmDraft=structuredClone(a);modal._alarmSoundContext='alarm';
 dialog('Dein Wecker','<form id="alarm-form" data-ritual-id="'+r.id+'">'+timeWheel(a.time,data.profile.timeFormat==='12')+'<div class="weekdays">'+[[1,'Mo'],[2,'Di'],[3,'Mi'],[4,'Do'],[5,'Fr'],[6,'Sa'],[0,'So']].map(([n,l])=>'<label><input type="checkbox" name="days" value="'+n+'" '+(a.days.includes(n)?'checked':'')+'><span>'+new Date(2026,8,27+n).toLocaleDateString(locale(),{weekday:'short'}).replace('.','')+'</span></label>').join('')+'</div><input type="hidden" name="tone" value="'+a.tone+'"><button type="button" class="tone-setting" data-m="alarm-sounds">'+icon('audio')+'<span>Weckton<b>'+TRACKS.find(t=>t.id===a.tone)?.title+'</b></span>'+icon('arrow')+'</button><p class="schedule-conflict" id="weekly-conflict" role="status" hidden></p><p class="form-error" id="alarm-error" role="alert"></p><button class="primary" type="submit">Speichern</button></form>','alarm',()=>scheduleControls('weekly'));updateWeeklyConflict();
}
function updateWeeklyConflict(){
 const form=$('#alarm-form');if(!form)return;const values=new FormData(form),days=values.getAll('days').map(Number),conflicts=days.length?weeklyConflicts(data,form.dataset.ritualId,days):[],label=$('#weekly-conflict');
 label.hidden=!conflicts.length;label.textContent=conflicts.length?'Bereits belegt: '+alarmDays([...new Set(conflicts.flatMap(r=>r.alarm.days.filter(d=>days.includes(d))))])+'. Ein Ritual pro Tag. Beim Speichern werden diese Tage nach Bestätigung übernommen.':'';
 const button=form.querySelector('[type=submit]'),r=data.rituals.find(r=>r.id===form.dataset.ritualId);
 button.textContent=conflicts.length?'Wochentage übernehmen':!days.length&&r.alarm?.enabled?'Wochenplan aufheben':'Speichern';button.disabled=!days.length&&!r.alarm?.enabled;translateUI(form);
}
modal.addEventListener('change',e=>{if(e.target.closest('#alarm-form'))updateWeeklyConflict();if(e.target.closest('#date-plan-form'))updateDateConflict();});
function updateAlarmPreview(){
 modal.querySelectorAll('[data-alarm-preview]').forEach(button=>{const playing=alarmPreview===button.dataset.alarmPreview,t=TRACKS.find(t=>t.id===button.dataset.alarmPreview);button.setAttribute('aria-pressed',String(playing));button.setAttribute('aria-label',t.title+(playing?' stoppen':' anhören'));button.innerHTML=icon(playing?'stop':'play');});translateUI(modal);
}
function alarmSoundPicker(){
 dialog('Weckton','<div class="sound-options">'+TRACKS.filter(t=>t.id!=='none').map(t=>'<div class="choice-preview-row sound-option"><button data-alarm-tone="'+t.id+'" aria-pressed="'+(modal._alarmDraft.tone===t.id)+'"><span class="choice-art" aria-hidden="true">'+icon('audio')+'</span><span class="choice-copy"><b>'+t.title+'</b></span>'+selectionCircle(modal._alarmDraft.tone===t.id)+'</button><button class="round-button" data-alarm-preview="'+t.id+'" aria-pressed="false" aria-label="'+t.title+' anhören">'+icon('play')+'</button></div>').join('')+'</div>','alarm-sounds');modal.querySelector('.dialog-head').insertAdjacentHTML('afterbegin','<button class="icon-btn" data-m="alarm-sounds-back" aria-label="Zurück zur Planung">'+icon('back')+'</button>');updateAlarmPreview();
}

function editRitual(r = freshRitual(), creating = !r.title && !data.rituals.some(x=>x.id===r.id)) {
  if(!isOwnRoutine(r)){routineOptions(r);return;}
  r=structuredClone(r);r.ownership='own';
  dialog(data.rituals.some(x=>x.id===r.id)?'Ritual bearbeiten':'Neues Ritual', `<form id="ritual-form"><label class="label" for="ritual-title">Titel des Rituals</label><input type="text" class="field-input compact-title" id="ritual-title" name="title" maxlength="20" placeholder="Worum geht’s?" value="${esc(r.title)}" required><label class="label" for="ritual-description" style="margin-top:18px">Beschreibung (optional)</label><textarea id="ritual-description" name="description" maxlength="500" placeholder="Wie möchtest du in den Tag starten?">${esc(r.description)}</textarea><p class="form-error" id="ritual-error"></p><button class="primary" type="submit">${creating?'Bausteine auswählen':'Speichern'}</button></form>`, 'ritual'); modal._ritual = r; modal._creating=creating;
}
async function addBlockDialog(r=ritualNow(),creating=false,options=null) {
  if(!isOwnRoutine(r))return;
  if(!options){blocks=await savedBlocks();options=[...blocks,...r.blocks].filter((b,i,all)=>all.findIndex(x=>blockIdentity(x)===blockIdentity(b))===i);}
  const selected=new Set(r.blocks.map(blockIdentity));
  dialog('Bausteine auswählen', `<p class="selection-count" role="status">${r.blocks.length} / ${MAX_BLOCKS} ausgewählt</p>${options.length>7?'<label class="search-box"><input id="block-picker-search" placeholder="Bausteine suchen" aria-label="Bausteine suchen"></label>':''}<div class="pick-block-list">${options.map((b,i)=>{const checked=selected.has(blockIdentity(b));return `<button class="library-block" data-pick-block="${i}" aria-pressed="${checked}" ${!checked&&r.blocks.length>=MAX_BLOCKS?'disabled':''}>${cover(b,true)}<span><b>${esc(b.title)}</b><small>${itemMinutes(b)} Min.</small></span>${icon(checked?'check':'plus')}</button>`;}).join('')}</div><p class="form-error" id="picker-error" role="alert"></p>${creating?`<div class="sheet-actions"><button class="primary" data-m="save-new-ritual" ${r.blocks.length?'':'disabled'}>Speichern</button></div>`:'<button class="quiet" data-m="new-block">Eigenen Baustein erstellen</button>'}`, 'add-block');
  modal._options=options;modal._pickerRitual=r;modal._creating=creating;if(creating)modal.querySelector('.dialog-head').insertAdjacentHTML('afterbegin','<button class="icon-btn" data-m="back-ritual" aria-label="Zurück zu Titel und Beschreibung">'+icon('back')+'</button>');
}
function targetRitualDialog(block){
 dialog('In deinen Ritualen',''+(data.rituals.length?'':'<p class="empty-copy">Erstelle zuerst ein Ritual.</p><button class="secondary" data-m="new-ritual">Ritual erstellen</button>')+(data.rituals.length>7?'<label class="search-box"><input id="target-ritual-search" placeholder="Deine Rituale durchsuchen" aria-label="Ritual suchen"></label>':'')+'<div class="target-rituals">'+data.rituals.filter(isOwnRoutine).map(r=>{const exists=r.blocks.some(b=>blockIdentity(b)===blockIdentity(block));return '<button data-target-ritual="'+r.id+'" aria-pressed="'+exists+'" '+(!exists&&r.blocks.length>=MAX_BLOCKS?'disabled':'')+'>'+cover(r,true)+'<span><b data-user-content>'+esc(r.title)+'</b><small>'+r.blocks.length+(r.blocks.length>=MAX_BLOCKS?' / 10':'')+' Bausteine</small></span>'+icon(exists?'check':'plus')+'</button>';}).join('')+'</div><p class="form-error" role="alert"></p>','target');modal._block=block;
}

function refreshSelection(){
 const r=modal._pickerRitual;
 if(modalMode==='add-block'){
  const selected=new Set(r.blocks.map(blockIdentity));
  modal.querySelector('.selection-count').textContent=r.blocks.length+' / '+MAX_BLOCKS+' ausgewählt';
  modal.querySelectorAll('[data-pick-block]').forEach(row=>{
   const checked=selected.has(blockIdentity(modal._options[Number(row.dataset.pickBlock)]));
   row.setAttribute('aria-pressed',checked);row.disabled=!checked&&r.blocks.length>=MAX_BLOCKS;
   row.lastElementChild.outerHTML=icon(checked?'check':'plus');
  });
  const save=modal.querySelector('[data-m="save-new-ritual"]');if(save)save.disabled=!r.blocks.length;
 }else if(modalMode==='target'){
  modal.querySelectorAll('[data-target-ritual]').forEach(row=>{
   const ritual=data.rituals.find(r=>r.id===row.dataset.targetRitual),checked=ritual.blocks.some(b=>blockIdentity(b)===blockIdentity(modal._block));
   row.setAttribute('aria-pressed',checked);row.disabled=!checked&&ritual.blocks.length>=MAX_BLOCKS;
   row.querySelector('small').textContent=ritual.blocks.length+' Bausteine';
   row.lastElementChild.outerHTML=icon(checked?'check':'plus');
   const art=row.querySelector('.item-cover');art.outerHTML=cover(ritual,true);
  });
 }
 translateUI(modal);
}

export async function finishEditor(block) {
 data=await loadProduct();blocks=await savedBlocks();libraryKind='block';
 const context=editorContext;editorContext=null;
 if(context){const r=data.rituals.find(r=>r.id===context.ritualId);if(r&&isOwnRoutine(r)){if(context.add)await addToRitual(r,block);await openProduct('ritual/'+r.id);location.hash='ritual/'+r.id;return;}}
 await openProduct('library');location.hash='library';toast('Baustein gespeichert.');
}
export async function leaveEditor(){const target=editorContext?.ritualId?'ritual/'+editorContext.ritualId:'library';editorContext=null;await openProduct(target);location.hash=target;}

async function beginRun(r,plan=null){
 const existing=data.activeRun?.ritual.id===r.id&&(!plan||data.activeRun.planKey===planKey(plan))?data.activeRun:null;
 const run=existing||{id:crypto.randomUUID(),ritual:structuredClone(r),planKey:planKey(plan),scheduledDate:plan?.date||dayKey(),startedAt:new Date().toISOString()};
 data.activeRun=run;await persistProduct();
 openStory(run.ritual.blocks,{title:r.title,resume:run.snapshot,returnLabel:'Zurück zu Home',
 onCheckpoint:snapshot=>{if(data.activeRun?.id===run.id){data.activeRun.snapshot=snapshot;persistProduct().catch(()=>{showStorySaveError('Dein Fortschritt konnte nicht gespeichert werden.',persistProduct);announce('Dein Fortschritt konnte nicht gespeichert werden.');});}},
 onReport:report=>{const save=()=>recordRun(run.ritual,{...report,id:run.id,planKey:run.planKey,scheduledDate:run.scheduledDate});return save().catch(()=>{if(!showStorySaveError('Verlauf konnte nicht gespeichert werden.',save))toast('Verlauf konnte nicht gespeichert werden. Lass diese Seite geöffnet.');});},
 onClose:()=>navigate('home')});
}

async function editor(item, fresh = false, independent = false) {
  if(item?._ritualId&&!isOwnRoutine(data.rituals.find(r=>r.id===item._ritualId)))return;
  if(route==='ritual'&&fresh&&!independent&&(!isOwnRoutine(ritualNow())||ritualNow().blocks.length>=MAX_BLOCKS))return;
  const context=route==='ritual'&&fresh?{ritualId:currentId,add:true}:item?._ritualId?{ritualId:item._ritualId,editId:item.id}:null;
  stopAudition();
  // A closing crop/appearance sheet is still modal until its exit completes.
  await Promise.all([...document.querySelectorAll('dialog[open]')].map(dialog=>dialog.close()));
  const accepted = await onEditor?.(item, fresh);
  if (accepted === false) return;
  editorContext=context;
  root.hidden = true; document.body.classList.remove('product-mode'); $('#app').hidden = false; $('.desktop-brand').hidden = false; location.hash='editor'; window.scrollTo(0,0);animateScreen($('#app'));
}
root.addEventListener('click', async event => {
  const button=event.target.closest('button'); if(!button||button.disabled||busy)return;
  const d=button.dataset;
  try {
    if(d.p==='undo-delete'&&lastUndo){busy=true;const undo=lastUndo;if(await undo()===false)return;lastUndo=null;blocks=await savedBlocks();toast('Wiederhergestellt.');return;}
    if(d.deleteKind){
      if(d.deleteKind==='plan'){busy=true;const date=d.deleteId.slice(0,10),plan=plansFor(data,date).find(p=>planKey(p)===d.deleteId);if(!plan||statusForPlan(data,plan)!=='planned'||date<dayKey())return;const removed=(data.datePlans||[]).find(p=>p.id===plan.id),before=structuredClone(data.skippedPlans||[]),priorDates=structuredClone(data.datePlans||[]),priorDays=[...(data.skippedDays||[])];omitPlan(data,plan);const added=(data.skippedPlans||[]).filter(p=>!before.some(x=>x.date===p.date&&x.ritualId===p.ritualId));try{await persistProduct();}catch(error){data.datePlans=priorDates;data.skippedPlans=before;data.skippedDays=priorDays;throw error;}lastUndo=async()=>{
 if(dayHasStarted(data,date)){lastUndo=null;toast('Für diesen Tag wurde bereits ein Ritual begonnen. Wähle einen anderen Tag.');return false;}
 const occupied=plansFor(data,date)[0];
 if(occupied&&(occupied.ritual.id!==plan.ritual.id||occupied.time!==plan.time)&&!await confirmSheet('Ritual für diesen Tag ersetzen?',occupied.ritual.title+' ist bereits für '+clockLabel(occupied.time)+' geplant. Stattdessen wird '+plan.ritual.title+' um '+clockLabel(plan.time)+' eingeplant.','Ersetzen'))return false;
 const snapshot=structuredClone(data);
 try{
  data.skippedDays=(data.skippedDays||[]).filter(d=>d!==date||priorDays.includes(d));
  data.skippedPlans=(data.skippedPlans||[]).filter(p=>!added.some(x=>x.date===p.date&&x.ritualId===p.ritualId));
  const returning=plansFor(data,date)[0];
  if(removed||!returning||returning.ritual.id!==plan.ritual.id||returning.time!==plan.time)assignDatePlan(data,removed||{id:crypto.randomUUID(),date,time:plan.time,tone:plan.tone,ritualId:plan.ritual.id});
  await persistProduct();
 }catch(error){Object.assign(data,snapshot);throw error;}
};toast('Termin entfernt.');}
      else await deleteLibraryItem(d.deleteKind,d.deleteId);return;
    }
    if(d.p==='delete-run'){
      if(!await confirmSheet('Durchlauf löschen?','Die Antworten dieses Durchlaufs werden gelöscht. Dein Ritual und dein Wochenplan bleiben erhalten.','Löschen'))return;
      const before=data.history;data.history=before.filter(r=>r.id!==currentId);
      try{await persistProduct();navigate('history');}catch(error){data.history=before;throw error;}return;
    }
    if(d.p==='export-run'){const run=data.history.find(r=>r.id===currentId),url=URL.createObjectURL(new Blob([JSON.stringify(run,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='mein-durchlauf.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return;}
    if(d.p==='cover-photo'){const r=ritualNow();if(r.coverPhoto)dialog('Ritual-Cover','<button class="create-option" data-m="change-cover">'+icon('camera')+' Foto ändern</button><button class="create-option" data-m="auto-cover">'+icon('layers')+' Automatisches Cover</button>','cover');else $('#ritual-cover-file').click();return;}
    if(d.homePlan){selectedDay=d.homePlan.slice(0,10);const p=plansFor(data,selectedDay).find(p=>planKey(p)===d.homePlan);if(p)planDialog(p);return;}
    if(d.day){cancelCalendarMotion();selectedDay=d.day;calendarExpanded=false;if(route==='history')navigate('plan');else render();return;}
    if(d.p==='dismiss-plan-notice'){data.planMigrationNotice=false;await persistProduct();render();return;}
    if(d.p==='calendar-expand'){
 cancelCalendarMotion();
 calendarExpanded=!calendarExpanded;const viewport=$('.calendar-window',root),grid=$('.month-grid',root);
 const existing=new Map([...grid.children].map(el=>[el.dataset.day,el])),template=document.createElement('template');template.innerHTML=calendarCells(selectedDay);
 grid.replaceChildren(...[...template.content.children].map(el=>existing.get(el.dataset.day)||el));
 viewport.classList.toggle('expanded',calendarExpanded);viewport.classList.toggle('compact',!calendarExpanded);
 grid.classList.toggle('expanded',calendarExpanded);grid.classList.toggle('compact',!calendarExpanded);
 button.setAttribute('aria-expanded',calendarExpanded);button.querySelector('svg').outerHTML=icon(calendarExpanded?'up':'down');updateCalendarFocus();return;
}
    if(d.month){const date=localDay(selectedDay);if(calendarExpanded){date.setDate(1);date.setMonth(date.getMonth()+Number(d.month));}else date.setDate(date.getDate()+7*Number(d.month));selectedDay=dayKey(date);render();return;}
    if(d.week){const date=localDay(selectedDay);date.setDate(date.getDate()+Number(d.week)*7);selectedDay=dayKey(date);render();return;}
    if(d.planEdit){const p=plansFor(data,selectedDay).find(p=>(p.oneOff?p.id:p.ritual.id)===d.planEdit);if(p)planDialog(p);return;}
    if(d.p==='manage-rituals'){managingRituals=!managingRituals;render();return;}
    if(d.p==='back'){goBack();return;}
    if(d.p==='buddy-react'){reactToBuddy(button);announce(selectedBuddy().name+' freut sich, dich zu sehen.');return;}
    if(d.p==='start-morning'){const state=morningState(data);if(['resume','missed'].includes(state.kind))await beginRun(state.ritual,state.plan);return;}
    if(d.routineOptions){routineOptions(data.rituals.find(r=>r.id===d.routineOptions));return;}
    if(d.p==='routine-options'){const local=libraryItem(selectedItem);if(local)editRitual(local);return;}
    if(d.p==='preview-ritual'){openStory(ritualNow().blocks,{preview:true,returnLabel:'Zurück zum Ritual'});return;}
    if(d.p==='sort-library'){filterDialog(true);return;}
    if(d.p==='drafts'){drafts=await pendingDrafts();draftDialog();return;}
    if(d.p==='remove-library'){await deleteLibraryItem('block',selectedItem.id);return;}

    
    if(d.p==='today'){cancelCalendarMotion();selectedDay=dayKey();render();return;}
    if(d.p==='plan-tomorrow'){
      const date=new Date();date.setDate(date.getDate()+1);modal._planBase={date:dayKey(date),time:'07:00',tone:defaultAlarm().tone,oneOff:false,replacesRitualId:null};modal._planTime='07:00';modal._planChoice='';
      modal._scheduleOrigin='day';planDialog(modal._planBase);return;
    }
    if(d.p==='plan-day'){planDialog();return;}
    if(d.p==='morning-demo'){showAlarmDemo(DEMO_RITUAL,beginRun);return;}
    if(d.route) { if(d.route==='library'){blocks=await savedBlocks();drafts=await pendingDrafts();} navigate(d.route); return; }
    if(d.openRitual) {navigate('ritual',d.openRitual);return;}
    if(d.startRitual){await beginRun(data.rituals.find(r=>r.id===d.startRitual));return;}
    if(d.alarmPlan){const p=data.datePlans.find(p=>p.id===d.alarmPlan);if(p)planDialog(plansFor(data,p.date).find(x=>x.id===p.id));return;}
    if(d.scheduleRitual){scheduleDialog(data.rituals.find(r=>r.id===d.scheduleRitual));return;}
    if(d.alarmRitual){modal._scheduleRitual=null;alarmDialog(data.rituals.find(r=>r.id===d.alarmRitual));return;}
    if(d.ringRitual){const r=data.rituals.find(r=>r.id===d.ringRitual),p=nextPlan(data,new Date(),r.id);showAlarmDemo(p?{...r,demoDate:p.date,alarm:{...r.alarm,time:p.time,tone:p.tone}}:r,beginRun);return;}
    if(d.editRitual){editRitual(data.rituals.find(r=>r.id===d.editRitual));return;}
    if(d.unlinkBlock){
      const r=ritualNow();if(!r||!isOwnRoutine(r))return;const index=r.blocks.findIndex(b=>b.id===d.unlinkBlock);if(index<0)return;
      busy=true;const before=structuredClone(r),[removed]=r.blocks.splice(index,1);markCustomized(r);if(!r.blocks.length&&r.alarm)r.alarm.enabled=false;
      try{await persistProduct();}catch(error){Object.assign(r,before);throw error;}
      lastUndo=async()=>{if(!r.blocks.some(b=>blockIdentity(b)===blockIdentity(removed))){r.blocks.splice(Math.min(index,r.blocks.length),0,removed);if(before.alarm)r.alarm=before.alarm;await persistProduct();}};
      toast('Baustein aus Ritual entfernt.');return;
    }
    if(d.ritualBlock!==undefined){selectedItem={...ritualNow().blocks[Number(d.ritualBlock)],_from:'library',_ritualId:currentId};navigate('block');return;}
    if(d.catalog){selectedItem={...allCatalog.find(x=>x.id===d.catalog),_from:'discover'};navigate('block');return;}
    if(d.openBlock){selectedItem={...blocks.find(x=>x.id===d.openBlock),_from:'library'};navigate('block');return;}
    if(d.openCatalog){openLibraryItem(libraryItem(allCatalog.find(x=>x.id===d.openCatalog)));return;}
    if(d.saveCatalog){busy=true;await saveToLibrary(allCatalog.find(x=>x.id===d.saveCatalog));blocks=await savedBlocks();announce('In deiner Bibliothek gespeichert.');render();return;}
    if(d.libraryKind){managingRituals=false;libraryKind=d.libraryKind;render();const collection=$('.playlist-grid,.library-blocks,.empty-state',root);if(collection)animateScreen(collection,'tab');return;}
    if(d.discoverKind){discover.kind=d.discoverKind;render();return;}
    if(d.clearTag){discover.tags=discover.tags.filter(t=>t!==d.clearTag);render();return;}
    if(d.historyId){navigate('historyDetail',d.historyId);return;}
    if(d.p==='create')await openCreateMenu();
    if(d.p==='profile')showProfile();
    if(d.p==='about')dialog('Ein echter Ablauf. Eine lokale Demo.', '<p>Bausteine, Rituale, Tags, Antworten und Weckpläne werden in diesem Browser gespeichert. Entdecken enthält 20 Bausteine und fünf Rituale vom Wakeup Buddy Team.</p><p style="margin-top:16px">Recherche und Buddy-Stimmen benötigen die eingerichtete KI-Anbindung. Antworten und Aufnahmen bleiben lokal. Recherchierte Inhalte werden mit Quellen und Zeitpunkt im Verlauf gespeichert. Musik und Weckton sind hörbar. Der Wecker ist eine Simulation innerhalb dieser Seite und ersetzt keinen Handy-Systemwecker.</p>','about');
    if(d.p==='first-alarm')data.rituals.length?alarmDialog(data.rituals[0]):editRitual();
    if(d.p==='add-block')await addBlockDialog();
    if(d.p==='tag-filter'){filterDialog();return;}
    if(d.p==='clear-filters'){discover={kind:'all',origin:'all',tags:[],search:''};render();}
    if(d.p==='open-saved'){openLibraryItem(libraryItem(selectedItem));return;}
    if(d.p==='save-detail'){busy=true;await saveToLibrary(selectedItem);blocks=await savedBlocks();announce('In deiner Bibliothek gespeichert.');render();return;}
    if(d.p==='add-detail')targetRitualDialog(selectedItem);
    if(d.p==='preview-detail')openStory(selectedItem.blocks || [selectedItem],{preview:true,returnLabel:'Zurück zur Übersicht',onClose:render});
    if(d.p==='edit-block'){const local=libraryItem(selectedItem);if(local?.blocks)editRitual(local);else if(local)await editor({...local,_ritualId:selectedItem._ritualId});}
  } catch(error) { toast('Das hat nicht geklappt. Dein bisheriger Stand bleibt gespeichert.'); console.error(error); }
  finally { busy=false; }
});
modal.addEventListener('click',event=>{if(!event.target.closest('.plan-choice-anchor')){modal.querySelector('.plan-dropdown')?.remove();modal.querySelector('.plan-ritual-choice')?.setAttribute('aria-expanded','false');}});
modal.addEventListener('input',event=>{if(event.target.id==='target-ritual-search'){const query=event.target.value.toLocaleLowerCase(locale());modal.querySelectorAll('[data-target-ritual]').forEach(row=>row.hidden=!data.rituals.find(r=>r.id===row.dataset.targetRitual)?.title.toLocaleLowerCase(locale()).includes(query));}if(modalMode==='ritual'&&modal._creating&&['ritual-title','ritual-description'].includes(event.target.id)){modal._ritual.title=$('#ritual-title').value;modal._ritual.description=$('#ritual-description').value;saveRitualDraft(modal._ritual).catch(()=>{const error=$('#ritual-error');if(error)error.textContent='Entwurf konnte nicht gespeichert werden.';});}if(event.target.id==='block-picker-search'){const q=event.target.value.toLocaleLowerCase(locale());modal.querySelectorAll('[data-pick-block]').forEach(row=>row.hidden=!modal._options[Number(row.dataset.pickBlock)].title.toLocaleLowerCase(locale()).includes(q));}if(event.target.id==='plan-search')$('#plan-options').innerHTML=planPicker(event.target.value);});
root.addEventListener('input',event=>{
  if(event.target.id==='library-search'){librarySearch=event.target.value;const pos=event.target.selectionStart;render();$('#library-search').focus();$('#library-search').setSelectionRange(pos,pos);}
  if(event.target.id==='discover-search'){const pos=event.target.selectionStart;discover.search=event.target.value;render();const field=$('#discover-search');field.focus();field.setSelectionRange(pos,pos);}
});
root.addEventListener('change',event=>{if(event.target.id==='discover-origin'){discover.origin=event.target.value;render();}});

let selectionQueue=Promise.resolve(),selectionPending=0;
function queueSelection(d){
 const context={mode:modalMode,ritual:modal._pickerRitual,creating:modal._creating,options:modal._options,block:modal._block};
 selectionPending++;
 selectionQueue=selectionQueue.then(async()=>{
  const r=d.targetRitual?data.rituals.find(r=>r.id===d.targetRitual):context.ritual;
  if(!isOwnRoutine(r))return;
  const creating=!d.targetRitual&&context.creating,before=structuredClone(r),block=d.targetRitual?context.block:context.options[Number(d.pickBlock)];
  const index=r.blocks.findIndex(b=>blockIdentity(b)===blockIdentity(block));
  try{
   if(index>=0){r.blocks.splice(index,1);markCustomized(r);if(!r.blocks.length&&r.alarm)r.alarm.enabled=false;if(!creating)await persistProduct();}
   else{if(r.blocks.length>=MAX_BLOCKS)return;if(creating)r.blocks.push(structuredClone(block));else await addToRitual(r,block);}
   if(creating)await saveRitualDraft(r);else blocks=await savedBlocks();
   if(modalMode===context.mode&&modal._pickerRitual===context.ritual&&modal._block===context.block){refreshSelection();const error=modal.querySelector('.form-error');if(error)error.textContent='';}
   if(!creating){if(modal.open)modal._refreshPage=true;else render();}
  }catch(error){
   Object.keys(r).forEach(key=>delete r[key]);Object.assign(r,before);
   if(modal.open&&modalMode===context.mode){let message=modal.querySelector('.form-error');if(!message){message=document.createElement('p');message.className='form-error';message.setAttribute('role','alert');modal.append(message);}message.textContent='Speichern fehlgeschlagen. Bitte erneut versuchen.';}
   else toast('Speichern fehlgeschlagen. Bitte erneut versuchen.');
  }
 }).finally(()=>selectionPending--);
}

modal.addEventListener('click',async event=>{
  const button=event.target.closest('button');if(!button||button.disabled)return;const d={...button.dataset};
  if(d.pickBlock!==undefined||d.targetRitual){queueSelection(d);return;}
  if(busy)return;await selectionQueue;
  try {
    if(d.scheduleNew!==undefined){const r=data.rituals.find(r=>r.id===modal._scheduleRitual),date=new Date();date.setDate(date.getDate()+1);scheduleDialog(r,'date',{date:dayKey(date),time:r.alarm?.time||'07:00',ritual:r});return;}
    if(d.scheduleMode||d.scheduleDate){
      const r=data.rituals.find(r=>r.id===modal._scheduleRitual),form=modal.querySelector('form');if(!r){openPlanPicker(d.scheduleMode||'date');return;}form._flushTime?.();const v=new FormData(form);
      if(form.id==='alarm-form')modal._scheduleDrafts.weekly={...modal._alarmDraft,time:String(v.get('time')),enabled:v.getAll('days').length>0,days:v.getAll('days').map(Number)};
      else modal._scheduleDrafts.date={...modal._planBase,date:String(v.get('date')),time:String(v.get('time')),ritual:r};
      if(d.scheduleMode){
        const time=String(v.get('time')),tone=String(v.get('tone'));
        if(d.scheduleMode==='weekly')modal._scheduleDrafts.weekly={...r.alarm,...modal._scheduleDrafts.weekly,time,tone};
        else{const next=nextPlan(data,new Date(),r.id),tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);modal._scheduleDrafts.date={...(next?.oneOff?next:{date:dayKey(tomorrow),ritual:r}),...modal._scheduleDrafts.date,time,tone};}
      }
      const p=d.scheduleDate?data.datePlans.find(p=>p.id===d.scheduleDate):null;
      scheduleDialog(r,d.scheduleMode||'date',p?{...p,oneOff:true,ritual:r}:null);return;
    }
    
    if(d.m==='delete-drafts'||d.deleteKind==='draft'){
      busy=true;await ritualDraftQueue;const keys=d.deleteKind==='draft'?[d.deleteId]:drafts.map(x=>x._draftKey);
      draftUndo=await removeDrafts(keys);drafts=await pendingDrafts();draftNotice=keys.length===1?'Entwurf gelöscht.':'Entwürfe gelöscht.';modal._refreshPage=true;draftDialog();return;
    }
    if(d.m==='undo-drafts'&&draftUndo){busy=true;await draftUndo();draftUndo=null;draftNotice='Wiederhergestellt.';drafts=await pendingDrafts();modal._refreshPage=true;draftDialog();return;}
    
    if(d.draft){if(d.draft==='ritual-draft'){const r=await readState('ritual-draft');if(r)editRitual(r,true);}else{const draft=await readDraft(d.draft);if(draft)await editor(draft);}return;}
    if(d.m==='choose-plan-ritual'){openPlanPicker(modalMode==='alarm'?'weekly':'date');return;}
    if(d.selectPlan){const r=data.rituals.find(r=>r.id===d.selectPlan),base={...modal._planBase,time:modal._planTime,ritual:r};if(modal._scheduleRitual!==r.id)modal._scheduleDrafts={date:base};modal._scheduleRitual=r.id;modal._planChoice=r.id;if(modal._planReturnMode==='weekly')alarmDialog(r,{...r.alarm,...modal._scheduleDrafts.weekly,time:base.time,tone:base.tone||r.alarm.tone});else planDialog(base);return;}
    
    if(d.m==='alarm-sounds'){const values=new FormData($('#alarm-form'));modal._alarmDraft={...modal._alarmDraft,time:String(values.get('time')),enabled:values.getAll('days').length>0,days:values.getAll('days').map(Number)};alarmSoundPicker();return;}
    if(d.m==='plan-sounds'){const values=new FormData($('#date-plan-form'));modal._planBase={...modal._planBase,date:String(values.get('date')),time:String(values.get('time')),ritualId:String(values.get('ritual'))};modal._alarmDraft={tone:String(values.get('tone'))};modal._alarmSoundContext='date-plan';alarmSoundPicker();return;}
    if(d.alarmPreview){const id=d.alarmPreview;stopAlarmPreview();alarmPreview=alarmPreview===id?null:id;if(alarmPreview)auditionAlarm(id,()=>{alarmPreview=null;if(modal.open&&modalMode==='alarm-sounds')updateAlarmPreview();});updateAlarmPreview();return;}
    if(d.alarmTone||d.m==='alarm-sounds-back'){if(d.alarmTone)modal._alarmDraft.tone=d.alarmTone;alarmPreview=null;stopAlarmPreview();if(modal._alarmSoundContext==='date-plan')planDialog({...modal._planBase,tone:modal._alarmDraft.tone});else alarmDialog(modal._alarmRitual,modal._alarmDraft);return;}
    if(d.m==='change-cover'){modal.close();$('#ritual-cover-file').click();return;}
    if(d.m==='auto-cover'){const r=ritualNow();delete r.coverPhoto;markCustomized(r);await persistProduct();modal.close();render();return;}
    if(d.m==='close')modal.close();
    if(d.m==='new-block'){await editor(null,true,modalMode==='create');}
    if(d.m==='new-ritual'){await ritualDraftQueue;editRitual(await readState('ritual-draft')||freshRitual(),true);}
    
    if(d.filterField){const input=modal.querySelector('#'+d.filterField);input.value=d.filterValue;button.closest('.filter-tabs').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b===button));return;}
    if(d.filterTag){const draft=modal._filterDraft;draft.tags=draft.tags.includes(d.filterTag)?draft.tags.filter(t=>t!==d.filterTag):[...draft.tags,d.filterTag];button.setAttribute('aria-pressed',draft.tags.includes(d.filterTag));}
    
    if(d.m==='back-ritual'){editRitual(modal._pickerRitual,true);return;}
    if(d.m==='save-new-ritual'){
      const r=modal._pickerRitual;if(!modal._creating||!r.blocks.length||r.blocks.length>MAX_BLOCKS)return;
      busy=true;button.disabled=true;
      try{r.blocks=await Promise.all(r.blocks.map(saveToLibrary));data.rituals.push(r);await persistProduct();await ritualDraftQueue;await writeState('ritual-draft',null);drafts=await pendingDrafts();modal.close();if(root.hidden){await openProduct('ritual/'+r.id);location.hash='ritual/'+r.id;}else navigate('ritual',r.id);}
      catch(error){data.rituals=data.rituals.filter(x=>x.id!==r.id);button.disabled=false;throw error;}return;
    }

  } catch { let error=modal.querySelector('.form-error');if(!error){error=document.createElement('p');error.className='form-error';error.setAttribute('role','alert');modal.append(error);}error.textContent='Speichern fehlgeschlagen. Bitte erneut versuchen.'; }
  finally {busy=false;}
});
modal.addEventListener('submit',async event=>{
  event.preventDefault();const form=event.target; if(busy)return;
  form._flushTime?.();const values=new FormData(form);
  if(form.id==='shared-filter-form'){
    if(form.dataset.library==='true'){libraryOrigin=String(values.get('library-origin'));librarySort=String(values.get('library-sort'));}
    else{discover.origin=String(values.get('discover-origin'));discover.tags=[...modal._filterDraft.tags];}
    modal.close();render();return;
  }
  if(form.id==='date-plan-form'){
    const base=modal._planBase,date=String(values.get('date')),time=String(values.get('time')),ritualId=String(values.get('ritual'));
    const r=data.rituals.find(r=>r.id===ritualId),at=new Date(date+'T'+time+':00');
    const err=$('#date-plan-error');
    if(!r?.blocks.length||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(at.getTime())||at<=new Date()){err.textContent='Wähle ein Ritual und einen Zeitpunkt in der Zukunft.';return;}
    if(dayHasStarted(data,date)){err.textContent='Für diesen Tag wurde bereits ein Ritual begonnen. Wähle einen anderen Tag.';return;}
    const occupied=plansFor(data,date)[0],tone=String(values.get('tone'));
    if(!TRACKS.some(t=>t.id===tone&&t.id!=='none')){err.textContent='Wähle einen Weckton.';return;}
    busy=true;
    const snapshot=structuredClone(data);
    try{
      if(occupied&&occupied.ritual.id!==ritualId&&!await confirmSheet('Ritual für diesen Tag ersetzen?',occupied.ritual.title+' ist bereits für '+clockLabel(occupied.time)+' geplant. Stattdessen wird '+r.title+' um '+clockLabel(time)+' eingeplant.','Ersetzen'))return;
      const entry={id:base.oneOff?base.id:crypto.randomUUID(),date,time,ritualId,tone,replacesRitualId:occupied?.ritual.id||base.replacesRitualId||null};
      assignDatePlan(data,entry);await persistProduct();selectedDay=date;modal.close();render();
    }catch(error){Object.assign(data,snapshot);err.textContent='Der Plan konnte nicht gespeichert werden. Bitte erneut versuchen.';}
    finally{busy=false;}return;
  }
  if(form.id==='ritual-form'){
    const title=String(values.get('title')).trim();if(!title){$('#ritual-error').textContent='Gib deinem Ritual einen Titel.';return;}if(title.length>20&&data.rituals.find(x=>x.id===modal._ritual.id)?.title!==title){$('#ritual-error').textContent='Der Titel darf höchstens 20 Zeichen enthalten.';return;}
    const r=modal._ritual;if(!isOwnRoutine(r))return;if(r.blocks.length>MAX_BLOCKS){$('#ritual-error').textContent='Maximal 10 Bausteine pro Ritual.';return;} if(r.title!==title||r.description!==String(values.get('description')).trim())markCustomized(r);r.title=title;r.description=String(values.get('description')).trim();r.theme=r.theme||'lilac';
    if(modal._creating){await saveRitualDraft(r);await addBlockDialog(r,true);return;}
    const existing=data.rituals.findIndex(x=>x.id===r.id);if(existing<0)data.rituals.push(r);else data.rituals[existing]=r;
    try {busy=true;await persistProduct();modal.close();navigate('ritual',r.id);} catch{$('#ritual-error').textContent='Ritual konnte nicht gespeichert werden.';}finally{busy=false;}
  }
  if(form.id==='alarm-form'){
    const r=data.rituals.find(x=>x.id===form.dataset.ritualId),days=values.getAll('days').map(Number),enabled=days.length>0,time=String(values.get('time'));
    if(enabled&&(!days.length||!r.blocks.length)){$('#alarm-error').textContent=!days.length?'Wähle mindestens einen Wochentag.':'Füge zuerst einen Baustein hinzu.';return;}
    const tone=String(values.get('tone'));if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)||!TRACKS.some(t=>t.id===tone&&t.id!=='none')){$('#alarm-error').textContent='Wähle eine gültige Weckzeit und einen Weckton.';return;}
    const conflicts=enabled?weeklyConflicts(data,r.id,days):[],occupiedDays=[...new Set(conflicts.flatMap(other=>other.alarm.days.filter(day=>days.includes(day))))];
    const snapshot=structuredClone(data);busy=true;
    try{
      if(conflicts.length&&!await confirmSheet('Wochentage übernehmen?',alarmDays(occupiedDays)+': Für diese Tage ist bereits ein Ritual geplant. '+r.title+' übernimmt diese Wochentage.','Übernehmen'))return;
      assignWeeklyPlan(data,r.id,{enabled,time,days,tone});await persistProduct();modal.close();render();
    }catch{Object.assign(data,snapshot);$('#alarm-error').textContent='Weckplan konnte nicht gespeichert werden.';}
    finally{busy=false;}
  }
});
function showProfile(){
 stopBuddyPreview();sheet._buddyPreview=null;sheet.dataset.page='profile';
 sheet.innerHTML='<button class="sheet-close icon-btn" data-sheet="close" aria-label="Profil schließen">'+icon('close')+'</button><h1>Dein Profil</h1><form id="profile-form"><label class="profile-photo" aria-label="Profilbild ändern">'+(data.profile.avatar?'<img src="'+data.profile.avatar+'" alt="">':'<span data-user-content>'+esc((data.profile.name||'Du').slice(0,1).toUpperCase())+'</span>')+'<i>'+icon('camera')+'</i><input type="file" id="profile-photo" accept="image/*"></label><label class="label" for="profile-name">Dein Name</label><div class="name-edit"><input class="field-input" id="profile-name" maxlength="30" value="'+esc(data.profile.name)+'" required><button class="icon-btn" type="submit" aria-label="Speichern">'+icon('check')+'</button></div></form><button class="sheet-link" data-sheet="history">'+icon('history')+' Verlauf '+icon('arrow')+'</button><div class="profile-settings"><h2>Deine Recherche</h2><label class="label" for="profile-city">Ort für Wetter und lokale Inhalte</label><input class="field-input" id="profile-city" maxlength="100" autocomplete="address-level2" placeholder="Stadt, Land" value="'+esc(data.profile.location?.city||'')+'"><p id="profile-location-label" class="small">'+esc(locationLabel(data.profile.location))+'</p><button class="secondary" data-profile-location>Aktuellen Standort verwenden</button><label class="label" for="profile-stocks">Märkte und Unternehmen</label><input class="field-input" id="profile-stocks" maxlength="120" placeholder="Zum Beispiel DAX, Apple, Nvidia" value="'+esc(data.profile.stocks||'')+'"><button class="secondary" data-save-research>Einstellungen speichern</button><p class="small">Dein Ort bleibt hier gespeichert. Bei einer passenden Recherche senden wir nur den benötigten Ort oder deine Marktinteressen. Keine laufende Standortverfolgung.</p><h2>Einstellungen</h2><button class="buddy-setting" data-sheet="buddy">'+buddyArt()+'<span><b>'+selectedBuddy().name+'</b><small>Dein Buddy</small></span>'+icon('arrow')+'</button><span class="label">Dunkelmodus</span><div class="preference-options" role="group" aria-label="Dunkelmodus">'+[['off','Aus'],['on','An'],['auto','Automatisch']].map(([value,label])=>'<button data-appearance="'+value+'" aria-pressed="'+((data.profile.appearance||'off')===value)+'">'+label+'</button>').join('')+'</div><p class="appearance-note" '+(data.profile.appearance==='auto'?'':'hidden')+'>Dunkel von 19:00 bis 07:00 · Ortszeit</p><span class="label">Sprache</span><div class="preference-options" role="group" aria-label="Sprache">'+[['de','Deutsch'],['en','English'],['fr','Français']].map(([value,label])=>'<button data-language="'+value+'" aria-pressed="'+((data.profile.language||'de')===value)+'">'+label+'</button>').join('')+'</div><span class="label">Zeitformat</span><div class="preference-options" role="group" aria-label="Zeitformat">'+[['24','24 Stunden'],['12','12 Stunden']].map(([value,label])=>'<button data-time-format="'+value+'" aria-pressed="'+((data.profile.timeFormat||'24')===value)+'">'+label+'</button>').join('')+'</div></div><a class="support-link" href="mailto:hello@wakeupbuddy.ai">'+icon('mail')+'<span>Support<small>hello@wakeupbuddy.ai</small></span>'+icon('arrow')+'</a><details class="profile-test"><summary>Testbereich</summary><button class="sheet-link" data-sheet="demo">'+icon('play')+' Wecker ausprobieren '+icon('arrow')+'</button></details><p id="profile-status" role="status"></p>';
 if(!sheet.open||sheet.dataset.closing)sheet.showModal();translateUI(sheet);
}
function demoDialog(){
 dialog('Aufwachen ausprobieren',`<p class="demo-intro">Lockscreen, Weckton und dein Morgen – einmal durchspielen.</p><div class="demo-rituals">${data.rituals.filter(r=>r.blocks.length).map(r=>`<button class="library-block" data-demo-ritual="${r.id}">${cover(r,true)}<span><b>${esc(r.title)}</b><small>${itemMinutes(r)} Minuten</small></span>${icon('play')}</button>`).join('')}<button class="library-block" data-demo-ritual="guided"><span class="small-cover item-cover theme-peach">${buddyArt()}</span><span><b>Geführter Demo-Morgen</b><small>Alle vier Eingabearten erleben</small></span>${icon('play')}</button></div><p class="demo-disclosure">Kein Systemwecker. Der geführte Demo-Morgen enthält ein gekennzeichnetes Recherchebeispiel. Audio benötigt die eingerichtete KI-Anbindung. Deine Aufnahmen bleiben lokal. Entdecken enthält redaktionelle Inhalte vom Wakeup Buddy Team.</p>`,'demo');
}
sheet.addEventListener('click',event=>{const action=event.target.closest('[data-sheet]')?.dataset.sheet;if(action==='close')sheet.close();if(action==='buddy')buddyDialog();if(action==='profile')showProfile();if(action==='history'){historyDialog(null,'profile');}if(action==='demo'){sheet.close();demoDialog();}if(event.target===sheet&&event.clientX>sheet.getBoundingClientRect().right)sheet.close();});

modal.addEventListener('click',event=>{const id=event.target.closest('[data-demo-ritual]')?.dataset.demoRitual;if(!id)return;const r=id==='guided'?DEMO_RITUAL:data.rituals.find(r=>r.id===id);const plan=nextPlan(data,new Date(),r.id);modal.close();showAlarmDemo(plan?{...r,demoDate:plan.date,alarm:{...r.alarm,time:plan.time,tone:plan.tone}}:r,ritual=>beginRun(ritual));});

sheet.addEventListener('click',async event=>{
 const button=event.target.closest('[data-language],[data-time-format],[data-appearance]');if(!button)return;
 if(button.dataset.appearance){data.profile.appearance=button.dataset.appearance;setAppearance(button.dataset.appearance,{manual:true});sheet.querySelectorAll('[data-appearance]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.appearance===data.profile.appearance));sheet.querySelector('.appearance-note').hidden=data.profile.appearance!=='auto';}
 if(button.dataset.language)data.profile.language=button.dataset.language;if(button.dataset.timeFormat)data.profile.timeFormat=button.dataset.timeFormat;
 try{await persistProduct();setPreferences(data.profile);sheet.querySelectorAll('[data-language]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.language===(data.profile.language||'de')));sheet.querySelectorAll('[data-time-format]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.timeFormat===(data.profile.timeFormat||'24')));render();}catch{$('#profile-status').textContent='Einstellung konnte nicht gespeichert werden.';}
});
sheet.addEventListener('change',async event=>{if(event.target.id!=='profile-photo'||!event.target.files[0])return;try{const avatar=await localPhoto(event.target.files[0],320);data.profile.avatar=avatar;data.profile.name=$('#profile-name').value.trim()||data.profile.name;await persistProduct();showProfile();render();}catch(error){$('#profile-status').textContent=error.message;}});
sheet.addEventListener('submit',async event=>{event.preventDefault();data.profile.name=$('#profile-name').value.trim()||'Du';try{await persistProduct();sheet.close();render();}catch{$('#profile-status').textContent='Profil konnte nicht gespeichert werden.';}});
modal.addEventListener('close',()=>{alarmPreview=null;stopAlarmPreview();});
sheet.addEventListener('close',()=>{stopBuddyPreview();sheet._buddyPreview=null;});
sheet.addEventListener('click',async event=>{
 const button=event.target.closest('[data-buddy-choose],[data-buddy-preview]');if(!button)return;
 if(button.dataset.buddyPreview){const id=button.dataset.buddyPreview,was=sheet._buddyPreview===id;stopBuddyPreview();sheet._buddyPreview=was?null:id;updateBuddySelection();if(!was)previewBuddy(id,error=>{sheet._buddyPreview=null;if(sheet.open&&sheet.dataset.page==='buddy'){updateBuddySelection();sheet.querySelector('#buddy-status').textContent=error?.message||'';}});return;}
 if(sheet._savingBuddy)return;sheet._savingBuddy=true;const previous=data.profile.buddy;
 try{stopBuddyPreview();sheet._buddyPreview=null;data.profile.buddy=button.dataset.buddyChoose;await persistProduct();selectBuddy(data.profile.buddy);updateBuddySelection();reactToBuddy(button);const friend=root.querySelector('.welcome-friend');if(friend){friend.innerHTML=buddyArt();friend.setAttribute('aria-label',selectedBuddy().name+' begrüßen');}}
 catch{data.profile.buddy=previous;sheet.querySelector('#buddy-status').textContent='Buddy konnte nicht gespeichert werden. Bitte erneut versuchen.';}
 finally{sheet._savingBuddy=false;}
});
attachReorder(root,{getSteps:()=>ritualNow()?.blocks || [],setSteps:steps=>{if(!ritualNow()||!isOwnRoutine(ritualNow()))return;ritualNow().blocks=steps;markCustomized(ritualNow());render();persistProduct().catch(()=>toast('Reihenfolge konnte nicht gespeichert werden.'));},announce});
window.addEventListener('popstate',()=>{navStack.pop();});
window.addEventListener('hashchange',async()=>{
  const hash=location.hash.slice(1);
  if(hash==='history'||hash.startsWith('history/')){history.replaceState({},'','#'+(route==='ritual'?'ritual/'+currentId:route));historyDialog(hash.split('/')[1]||null);return;}
  if(hash==='editor'){if(!root.hidden)await editor();return;}
  if(root.hidden){await openProduct(hash);return;}
  cancelCalendarMotion();endRitualPress();managingRituals=false;resolveRoute(hash);render();
});

function updateBuddySelection(){
 sheet.querySelectorAll('[data-buddy-choose]').forEach(button=>{const selected=button.dataset.buddyChoose===selectedBuddy().id;button.setAttribute('aria-pressed',String(selected));button.querySelector('.selection-circle').classList.toggle('selected',selected);});
 sheet.querySelectorAll('[data-buddy-preview]').forEach(button=>{const playing=button.dataset.buddyPreview===sheet._buddyPreview;button.setAttribute('aria-pressed',String(playing));button.innerHTML=icon(playing?'stop':'play');button.closest('.buddy-option').classList.toggle('previewing',playing);});
}
let historyRunId=null,historyEntry='page',historyDay=null,historyScroll=0;
function historyDialog(id=null,entry){
 if(entry)historyEntry=entry;else if(!sheet.open)historyEntry='page';
 if(id&&sheet.dataset.page==='history')historyScroll=sheet.scrollTop;
 historyRunId=id;sheet.dataset.page=id?'history-detail':'history';
 sheet.innerHTML='<div class="buddy-sheet-head">'+(id||historyEntry==='profile'?'<button class="icon-btn" data-history-back aria-label="Zurück">'+icon('back')+'</button>':'<span></span>')+'<h1>Verlauf</h1><button class="icon-btn" data-sheet="close" aria-label="Schließen">'+icon('close')+'</button></div><div class="history-sheet-content">'+(id?historyDetail(id):historyView(historyDay))+(historyDay&&!id?'<button class="quiet" data-history-all>Alle Durchläufe anzeigen</button>':'')+'</div><p class="history-error" role="alert"></p>';
 if(!sheet.open||sheet.dataset.closing)sheet.showModal();
 sheet.scrollTop=id?0:historyScroll;translateUI(sheet);
}
sheet.addEventListener('click',async e=>{
 if(!sheet.dataset.page?.startsWith('history'))return;
 const button=e.target.closest('button');if(!button)return;
 try{
 if(button.hasAttribute('data-history-back')){if(historyRunId)historyDialog();else showProfile();return;}
 if(button.dataset.historyId){historyDialog(button.dataset.historyId);return;}
 if(button.dataset.day){historyDay=button.dataset.day;historyDialog();return;}
 if(button.hasAttribute('data-history-all')){historyDay=null;historyDialog();return;}
 const run=data.history.find(x=>x.id===historyRunId);if(!run)return;
 if(button.dataset.p==='export-run'){const url=URL.createObjectURL(new Blob([JSON.stringify(run,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='mein-durchlauf.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 if(button.dataset.p==='delete-run'){
 if(!await confirmSheet('Durchlauf löschen?','Die Antworten dieses Durchlaufs werden gelöscht. Dein Ritual bleibt erhalten.','Löschen'))return;
 const previous=data.history;data.history=previous.filter(x=>x.id!==run.id);try{await persistProduct();historyDialog();}catch(error){data.history=previous;throw error;}
 }
 }catch{sheet.querySelector('.history-error').textContent='Änderung konnte nicht gespeichert werden.';}
});
export async function openCreateMenu(){
 data=await loadProduct();blocks=await savedBlocks();
 dialog('Neu','<button class="create-option" data-m="new-block">'+icon('layers')+'<span><b>Baustein</b></span>'+icon('arrow')+'</button><button class="create-option" data-m="new-ritual">'+icon('library')+'<span><b>Ritual</b></span>'+icon('arrow')+'</button>','create');
}
function buddyDialog(){
 const scroll=sheet.dataset.page==='buddy'?sheet.scrollTop:0;sheet.dataset.page='buddy';
 sheet.innerHTML='<div class="buddy-sheet-head"><button class="icon-btn" data-sheet="profile" aria-label="Zurück zum Profil">'+icon('back')+'</button><h1>Dein Buddy</h1><button class="icon-btn" data-sheet="close" aria-label="Schließen">'+icon('close')+'</button></div><div class="buddy-options">'+BUDDIES.map(b=>'<div class="buddy-option choice-preview-row '+(sheet._buddyPreview===b.id?'previewing':'')+'"><button data-buddy-choose="'+b.id+'" aria-pressed="'+(selectedBuddy().id===b.id)+'">'+buddyArt(b.id)+'<span><b>'+b.name+'</b><small>'+b.trait+'</small><small>'+b.gender+'e Stimme</small></span>'+selectionCircle(selectedBuddy().id===b.id)+'</button><button class="round-button" data-buddy-preview="'+b.id+'" aria-pressed="'+(sheet._buddyPreview===b.id)+'" aria-label="'+b.name+' anhören">'+icon(sheet._buddyPreview===b.id?'stop':'play')+'</button></div>').join('')+'</div><p class="voice-availability">Sechs eigene Stimmen für deinen Morgen. Hörproben benötigen eine Internetverbindung.</p><p id="buddy-status" role="status"></p>';
 if(!sheet.open||sheet.dataset.closing)sheet.showModal();sheet.scrollTop=scroll;translateUI(sheet);
}

function routineOptions(r){if(r)editRitual(r);}
root.addEventListener('change',async event=>{
 if(event.target.id!=='ritual-cover-file'||!event.target.files[0])return;
 const r=ritualNow(),file=event.target.files[0];event.target.value='';if(!r)return;
 try{const photo=await cropPhoto(file);if(!photo)return;r.coverPhoto=photo;markCustomized(r);await persistProduct();render();}catch(error){toast(error.message);}
});

attachSwipe(root);attachSwipe(modal);
async function deleteLibraryItem(kind,id){
 if(kind==='ritual'&&!await confirmSheet('Ritual löschen?','Deine Bausteine bleiben in der Bibliothek. Die Wecktermine dieses Rituals werden entfernt.','Löschen'))return;
 if(kind==='block'&&!await confirmSheet('Baustein löschen?','Dieser Baustein wird zusätzlich auch aus allen bestehenden Ritualen entfernt.','Löschen'))return;
 lastUndo=kind==='block'?await removeLibraryBlock(id):await removeLibraryRitual(id);blocks=await savedBlocks();
 if(route==='ritual'||route==='block')navigate('library');toast(kind==='block'?'Baustein gelöscht.':'Ritual gelöscht.');
}

sheet.addEventListener('click',async event=>{
 const button=event.target.closest('[data-profile-location],[data-save-research]');if(!button)return;button.disabled=true;
 try{if(button.hasAttribute('data-profile-location')){const location=await requestLocation();await saveResearchPreferences({location});sheet.querySelector('#profile-city').value='';sheet.querySelector('#profile-location-label').textContent=locationLabel(location);}else{const city=sheet.querySelector('#profile-city').value;await saveResearchPreferences({...(city||data.profile.location?.city?{city}:{}),stocks:sheet.querySelector('#profile-stocks').value});}sheet.querySelector('#profile-status').textContent='Recherche-Einstellungen gespeichert.';}
 catch(error){sheet.querySelector('#profile-status').textContent=error.message;}finally{button.disabled=false;}
});
