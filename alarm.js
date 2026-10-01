import { clockLabel,locale,translateUI } from './i18n.js';
import { icon } from './icons.js';
import { escapeHTML as esc } from './richtext.js';
import { unlockAudio, startAlarm, stopAlarm, stopMusic } from './audio.js';
const root = document.createElement('div'); root.id = 'alarm-overlay'; root.hidden = true; document.body.append(root);
let session, timer, touchY;
export function showAlarmDemo(ritual, onStart) {
  closeAlarm(); unlockAudio(); stopMusic();
  session = { ritual: structuredClone(ritual), onStart, phase: 'locked' };
  document.body.classList.add('alarm-open'); root.hidden = false;
  root.setAttribute('role','dialog'); root.setAttribute('aria-modal','true'); root.setAttribute('aria-label','Wecker-Simulation');
  document.querySelector('#product-app').inert = true;
  render(); timer = setTimeout(ring, 1600);
}
function ring() { if (!session) return; session.phase = 'ringing'; startAlarm(session.ritual.alarm?.tone || 'sunrise'); render(); }
function render() {
  if (!session) return;
  const phase = session.phase, time = clockLabel(session.ritual.alarm?.time || '07:00');
  const date = (session.ritual.demoDate ? new Date(session.ritual.demoDate+'T12:00:00') : new Date()).toLocaleDateString(locale(), { weekday: 'long', day:'numeric', month:'long' });
  root.innerHTML = `<section class="alarm-phone ${phase}"><header class="alarm-status"><span>Wecker-Demo</span><button data-alarm="close" aria-label="Simulation schließen">${icon('close')}</button></header><div class="lock-symbol">${icon(phase === 'awake' ? 'check' : 'lock')}</div><p class="lock-date">${date}</p><div class="lock-time">${time}</div><div class="lock-orb orb-one"></div><div class="lock-orb orb-two"></div>
  ${phase === 'ringing' ? `<div class="ringing-content"><span class="ring-bell">${icon('timer')}</span><p>Guten Morgen.</p><h1>Dein Moment<br>beginnt jetzt.</h1><span class="lock-ritual">${esc(session.ritual.title)}</span></div><div class="alarm-actions"><button class="awake-button" data-alarm="awake">Ich bin wach ${icon('sun')}</button></div>` : phase === 'awake' ? `<div class="unlock-content"><div class="unlock-check">${icon('check')}</div><h1>Hallo, du.</h1><p>Dein Ritual wartet schon.</p></div><button class="unlock-button" data-alarm="unlock">${icon('up')} Zum Entsperren nach oben wischen</button>` : `<div class="lock-notification">${icon('timer')}<div><b>Dein Morgen steht bereit.</b><p>${esc(session.ritual.title)}</p></div></div><p class="alarm-demo-note">Simulation startet gleich mit Ton.</p>`}<div class="lock-home-bar"></div></section>`;translateUI(root);
}
function unlock() {
  if (session?.phase !== 'awake') return;
  const { onStart, ritual } = session;
  session.phase = 'unlocking';
  const face = root.querySelector('.alarm-phone'); face.classList.add('unlocking');
  timer = setTimeout(() => { closeAlarm(); onStart(ritual); }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 380);
}
export function closeAlarm() {
  clearTimeout(timer); stopAlarm(); session = null; root.hidden = true; root.innerHTML = ''; document.body.classList.remove('alarm-open');
  const shell = document.querySelector('#product-app'); if (shell) shell.inert = false;
}
root.addEventListener('click', event => {
  const action = event.target.closest('[data-alarm]')?.dataset.alarm; if (!action) return;
  if (action === 'close') closeAlarm();
  if (action === 'awake') { clearTimeout(timer); stopAlarm(); session.phase = 'awake'; render(); }

  if (action === 'unlock') unlock();
});
root.addEventListener('pointerdown', event => { if (session?.phase === 'awake') { touchY = event.clientY; if (!event.target.closest('button')) root.setPointerCapture(event.pointerId); } });
root.addEventListener('pointerup', event => { if (touchY !== undefined && touchY - event.clientY > 60) unlock(); touchY = undefined; });
document.addEventListener('keydown', event => { if (session && event.key === 'Escape') closeAlarm(); });
document.addEventListener('visibilitychange', () => { if (session && document.hidden) closeAlarm(); });
