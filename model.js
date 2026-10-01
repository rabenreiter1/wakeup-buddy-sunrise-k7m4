import {MAX_STEPS} from './limits.js';
import { colorOf, symbolId,shapeId } from './appearance.js';
export const TITLE_LIMIT = 20;
export const MESSAGE_LIMIT = 1200;
export const DESCRIPTION_LIMIT = 500;
export const outputs = ['buddy', 'text'];
export const normalizeOutput = value => value === 'original' ? 'text' : value;
export const inputs = ['none', 'text', 'voice', 'photo'];
export const id = () => crypto.randomUUID();
export const newStep = () => ({ id: id(), message: null, research: false, input: 'none', minutes: 2, timer: false });
export const newDraft = () => {
  const step = newStep();
  return { version: 1, id: null, title: '', description: '', symbol:'sun', shape:'I', theme:'sunny', tags: [], music: 'none', musicVolume: .25, steps: [step], output: null, active: step.id, page: 1 };
};
export const hasResearch = draft => draft.steps.some(step => step.research);
export function stepIssues(step) {
  const issues = [];
  const m = step.message;
  if (!m || m.type !== 'text' || !m.text?.trim()) issues.push(step.research ? 'Ergänze deinen Rechercheauftrag.' : 'Ergänze eine Anweisung.');
  if (!Number.isInteger(step.minutes) || step.minutes < 1 || step.minutes > 20) issues.push('Wähle eine Dauer zwischen 1 und 20 Minuten.');
  return issues;
}
export function contentIssues(draft) {
  const issues = [];
  if(draft.steps.length>MAX_STEPS) issues.push({field:'steps',text:'Maximal 10 Schritte pro Baustein.'});
  if (!draft.title.trim()) issues.push({ field: 'title', text: 'Gib deinem Baustein einen Titel.' });
  else if (draft.title.length > TITLE_LIMIT && draft.title !== draft._originalTitle) issues.push({ field: 'title', text: `Der Titel darf höchstens ${TITLE_LIMIT} Zeichen enthalten.` });
  draft.steps.forEach((step, index) => stepIssues(step).forEach(text => issues.push({ stepId: step.id, text: `Schritt ${index + 1}: ${text}` })));
  return issues;
}
export function outputIssue(draft) {
  if (!outputs.includes(normalizeOutput(draft.output))) return 'Wähle eine Ausgabe für deinen Baustein.';
  return '';
}
export function restoreDraft(value) {
  if (!value || value.version !== 1 || !Array.isArray(value.steps) || !value.steps.length) return newDraft();
  const steps = value.steps.filter(x => x && typeof x.id === 'string').map(x => {
    const m = x.message;
    let message = null;
    if (m?.type === 'text') message = { type: 'text', text: String(m.text || '').slice(0, MESSAGE_LIMIT) };
    if (m?.type === 'voice' || m?.type === 'photo') message = { type: 'text', text: String(m.transcript || m.caption || '').slice(0, MESSAGE_LIMIT) };
    const legacyMessage = x.legacyMessage || (m?.type === 'voice' || m?.type === 'photo' ? m : undefined);
    return { id: x.id, message, ...(legacyMessage ? { legacyMessage } : {}), research: Boolean(x.research), input: inputs.includes(x.input) ? x.input : 'none', minutes: Math.min(20, Math.max(1, Math.round(Number(x.minutes) || 2))), timer: Boolean(x.timer) };
  });
  if (!steps.length) return newDraft();
  const draft = { version: 1, id: typeof value.id === 'string' ? value.id : null, title: String(value.title || ''), description: String(value.description || '').slice(0, DESCRIPTION_LIMIT), steps, output: outputs.includes(normalizeOutput(value.output)) ? normalizeOutput(value.output) : null, active: value.active === null ? null : steps.some(s => s.id === value.active) ? value.active : steps[0].id, page: [1, 2, 3, 'saved'].includes(value.page) ? value.page : 1 };
  if(draft.id)draft._originalTitle=value._originalTitle??draft.title;
  if (draft.page !== 1 && contentIssues(draft).length) draft.page = 1;
  if ([3, 'saved'].includes(draft.page) && outputIssue(draft)) draft.page = 2;
  draft.tags = [...new Set(Array.isArray(value.tags) ? value.tags.filter(t => ['Mindfulness','Fitness','Getting things done','Personal Care','Wissen','Kreativität'].includes(t)) : [])].slice(0,3);
  draft.music = ['sunrise','focus','flow'].includes(value.music) ? value.music : 'none';
  draft.musicVolume = Math.max(0, Math.min(1, Number.isFinite(value.musicVolume) ? value.musicVolume : .25));
  for (const key of ['sourceId','theme','author']) if (typeof value[key] === 'string') draft[key] = value[key];
  if(value.origin)draft.origin=structuredClone(value.origin);if(value.customized)draft.customized=true;
  if(value._draftKey)draft._draftKey=value._draftKey;
  draft.symbol=symbolId(value);draft.shape=shapeId(value);draft.theme=colorOf(value).id;
  return draft;
}
export const messageText = step => step.message?.type === 'photo' ? step.message.caption : step.message?.type === 'voice' ? step.message.transcript : step.message?.text || '';
export const time = seconds => `${String(Math.floor(Math.max(0, seconds) / 60)).padStart(2, '0')}:${String(Math.max(0, seconds) % 60).padStart(2, '0')}`;
