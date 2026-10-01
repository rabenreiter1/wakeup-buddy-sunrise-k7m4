export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inline = value => escapeHTML(value).replace(/\*\*([^*\n]+)\*\*|\*([^*\n]+)\*/g, (_,double,single) => `<strong>${double||single}</strong>`);
export function renderRich(value = '') {
  let html = '', list = false;
  for (const line of String(value).split('\n')) {
    const bullet = /^-\s/.test(line);
    if (bullet && !list) { html += '<ul>'; list = true; }
    if (!bullet && list) { html += '</ul>'; list = false; }
    html += bullet ? `<li>${inline(line.slice(2)) || '<br>'}</li>` : `<p>${inline(line) || '<br>'}</p>`;
  }
  return html + (list ? '</ul>' : '');
}
export function richField({ id, value = '', placeholder = '', attrs = '', label = '', max = 1200 }) {
  return `<div id="${id}" class="rich-input" data-rich data-max="${max}" contenteditable="true" role="textbox" aria-multiline="true" aria-label="${escapeHTML(label || placeholder)}" data-placeholder="${escapeHTML(placeholder)}" spellcheck="true" ${attrs}>${value ? renderRich(value) : ''}</div>`;
}
function serializeInline(node) {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent.replace(/\u200b/g, '');
  if (node.nodeName === 'BR') return '\n';
  const text = [...node.childNodes].map(serializeInline).join('');
  return ['B', 'STRONG'].includes(node.nodeName) && text ? `*${text}*` : text;
}
export function richValue(el) {
  const lines = [];
  let pending = '';
  function flush() { if (pending) { lines.push(pending); pending = ''; } }
  function walk(node) {
    if (node.nodeType === Node.TEXT_NODE || ['B','STRONG','SPAN','I','EM','A'].includes(node.nodeName)) { pending += serializeInline(node); return; }
    if (['UL','OL'].includes(node.nodeName)) { flush(); [...node.children].forEach(walk); return; }
    if (node.nodeName === 'LI') { flush(); lines.push('- ' + serializeInline(node).replace(/\n$/, '')); return; }
    if (['P','DIV'].includes(node.nodeName)) {
      flush();
      if (node.querySelector('ul,ol,div,p')) { [...node.childNodes].forEach(walk); flush(); }
      else lines.push(serializeInline(node).replace(/\n$/, ''));
      return;
    }
    if (node.nodeName === 'BR') { lines.push(pending); pending = ''; }
  }
  [...el.childNodes].forEach(walk); flush();
  return lines.join('\n').replace(/\u200b/g, '');
}
const states = new WeakMap();
export function hydrateRich(root = document) {
  root.querySelectorAll('[data-rich]').forEach(el => {
    if(states.has(el))return;
    const value = richValue(el); el.value = value;
    states.set(el, { value, composing: false, undo: [], redo: [] });
  });
}
function caretEnd(el) { const range = document.createRange(); range.selectNodeContents(el); range.collapse(false); const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range); }
function update(el, notify = false) {
  let state = states.get(el);
  if (!state) { state = { value: '', composing: false, undo: [], redo: [] }; states.set(el, state); }
  if (state.composing) return;
  let raw = richValue(el);
  if (raw.length > Number(el.dataset.max || 1200)) { el.innerHTML = renderRich(state.value); caretEnd(el); raw = state.value; }
  if (raw !== state.value) { state.undo.push(state.value); if (state.undo.length > 100) state.undo.shift(); state.redo = []; }
  state.value = raw; el.value = raw;
  if (!raw && !el.querySelector('li')) el.innerHTML = '';
  if (notify) el.dispatchEvent(new Event('input', { bubbles: true }));
}
function shortcuts(el) {
  const selection = getSelection();
  if (!selection?.isCollapsed || !el.contains(selection.anchorNode)) return;
  const node = selection.anchorNode;
  if (node.nodeType !== Node.TEXT_NODE) return;
  const offset = selection.anchorOffset, before = node.textContent.slice(0, offset);
  const block = node.parentElement.closest('p,div,li');
  if (before === '- ' && block?.tagName !== 'LI') {
    const prefix = document.createRange(); prefix.setStart(block || el, 0); prefix.setEnd(node, 0);
    if (!prefix.toString().trim()) {
      const range = document.createRange(); range.setStart(node, 0); range.setEnd(node, 2); selection.removeAllRanges(); selection.addRange(range);
      document.execCommand('delete'); document.execCommand('insertUnorderedList'); return;
    }
  }
  const match = before.match(/(?:^|\s)\*([^*\n]+)\*$/);
  if (match && !node.parentElement.closest('strong,b')) {
    const start = offset - match[1].length - 2;
    const range = document.createRange(); range.setStart(node, start); range.setEnd(node, offset);
    selection.removeAllRanges(); selection.addRange(range);
    document.execCommand('insertHTML', false, `<strong>${escapeHTML(match[1])}</strong>&#8203;`);
    if (document.queryCommandState('bold')) document.execCommand('bold');
  }
}
let transforming = false;
document.addEventListener('input', event => {
  const el = event.target.closest?.('[data-rich]'); if (!el || transforming) return;
  if (states.get(el)?.composing || event.isComposing) return;
  transforming = true; shortcuts(el); update(el); transforming = false;
}, true);
document.addEventListener('compositionstart', event => { const state = states.get(event.target); if (state) state.composing = true; });
document.addEventListener('compositionend', event => { const state = states.get(event.target); if (state) { state.composing = false; update(event.target, true); } });
document.addEventListener('paste', event => {
  const el = event.target.closest?.('[data-rich]'); if (!el) return;
  event.preventDefault();
  const text = (event.clipboardData?.getData('text/plain') || '').slice(0, Number(el.dataset.max || 1200));
  document.execCommand('insertHTML', false, renderRich(text)); update(el, true);
});
document.addEventListener('keydown', event => {
  const el = event.target.closest?.('[data-rich]'); if (!el) return;
  const state = states.get(el); if (!state) return;
  if ((event.ctrlKey || event.metaKey) && ['z','y'].includes(event.key.toLowerCase())) {
    event.preventDefault(); const redo = event.shiftKey || event.key.toLowerCase() === 'y';
    const from = redo ? state.redo : state.undo, to = redo ? state.undo : state.redo;
    if (!from.length) return; to.push(state.value); state.value = from.pop(); el.value = state.value;
    el.innerHTML = state.value ? renderRich(state.value) : ''; caretEnd(el);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
});
