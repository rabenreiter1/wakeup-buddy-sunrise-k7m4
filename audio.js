// Original, synthesized demo loops: no downloads, external services or recordings.
const melodies = {
  sunrise: [60,null,64,null,67,null,72,null,69,null,67,null,64,null,62,null],
  focus: [48,null,55,null,60,null,55,null,50,null,57,null,62,null,57,null],
  flow: [60,67,64,67,62,69,65,69,57,64,60,64,55,62,59,62]
};
let context, bus, musicBus, alarmBus, enabled = true, loop, alarmLoop, previewTimer, alarmGeneration = 0;
const musicNotes=new Set();
function silenceMusic(){if(!context)return;for(const {osc,gain} of musicNotes){gain.gain.cancelScheduledValues(context.currentTime);gain.gain.setTargetAtTime(.0001,context.currentTime,.008);try{osc.stop(context.currentTime+.04);}catch{}}musicNotes.clear();}
let track = 'none', level = .25, playing = false, beat = 0, duck = 1;
export function audioContext() {
  if (!context) { context = new (window.AudioContext || window.webkitAudioContext)(); bus = context.createGain(); bus.gain.value = enabled ? .45 : 0; bus.connect(context.destination); musicBus = context.createGain(); alarmBus = context.createGain(); musicBus.connect(bus); alarmBus.connect(context.destination); }
  context.resume().catch(() => {}); return context;
}
export function unlockAudio() { try { audioContext(); } catch { /* Browsers without audio can still run the visual demo. */ } }
function note(midi, seconds, volume, type = 'sine', destination = musicBus) {
  if ((!enabled && destination !== alarmBus) || !context || context.state !== 'running') return;
  const osc = context.createOscillator(), gain = context.createGain(), now = context.currentTime;
  osc.type = type; osc.frequency.value = 440 * 2 ** ((midi - 69) / 12);
  gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(volume, now + .03); gain.gain.exponentialRampToValueAtTime(.0001, now + seconds);
  const voice={osc,gain};if(destination===musicBus)musicNotes.add(voice);osc.connect(gain); gain.connect(destination); osc.start(); osc.stop(now + seconds + .03); osc.onended = () => { musicNotes.delete(voice);osc.disconnect(); gain.disconnect(); };
}
export function setSoundEnabled(value) { enabled = Boolean(value); if (bus) bus.gain.setTargetAtTime(enabled ? .45 : 0, context.currentTime, .03); }
export function setMusic(next, volume = .25, play = true, reduce = false) {
  if (next !== track) { silenceMusic();track = melodies[next] ? next : 'none'; beat = 0; }
  level = Math.max(0, Math.min(1, volume));
  if (musicBus && (playing !== play || duck !== (reduce ? .3 : 1))) musicBus.gain.setTargetAtTime(play ? (reduce ? .3 : 1) : 0, context.currentTime, .04);
  playing = play; duck = reduce ? .3 : 1;
  if (!loop) loop = setInterval(() => {
    if (!playing || track === 'none') return;
    const n = melodies[track][beat % melodies[track].length];
    if (n !== null) { note(n, 1.1, level * .25, track === 'flow' ? 'triangle' : 'sine'); if (beat % 4 === 0) note(n - 12, 1.7, level * .13); }
    beat++;
  }, 500);
}
export function restartMusic(){silenceMusic();beat=0;clearInterval(loop);loop=null;}
export function stopMusic() { silenceMusic();playing = false; if (musicBus) musicBus.gain.setTargetAtTime(0, context.currentTime, .015); }
export function audition(trackId, volume = .25, onEnd) { unlockAudio(); clearTimeout(previewTimer); setMusic(trackId, volume, true); previewTimer = setTimeout(()=>{stopMusic();onEnd?.();}, 6000); }
export function stopAudition() { clearTimeout(previewTimer); stopMusic(); }
export function startAlarm(tone = 'sunrise') {
  stopAlarm(); stopMusic(); unlockAudio();
  if (alarmBus) alarmBus.gain.setTargetAtTime(1, context.currentTime, .015);
  const generation = alarmGeneration;
  const notes = tone === 'flow' ? [72,76,79] : tone === 'focus' ? [64,67,71] : [72,79,76];
  const ring = () => notes.forEach((n,i) => setTimeout(() => { if (alarmLoop && generation === alarmGeneration) note(n, .65, .2, 'sine', alarmBus); }, i * 210));
  alarmLoop = setInterval(ring, 1600); ring();
}
export function stopAlarm() { clearInterval(alarmLoop); alarmLoop = null; alarmGeneration++; if (alarmBus) alarmBus.gain.setTargetAtTime(0, context.currentTime, .015); }
document.addEventListener('visibilitychange', () => { if (document.hidden) { stopAlarm(); stopMusic(); } });

let alarmPreviewTimer;
export function auditionAlarm(tone,onEnd){stopAlarmPreview();startAlarm(tone);alarmPreviewTimer=setTimeout(()=>{stopAlarm();alarmPreviewTimer=null;onEnd?.();},5000);}
export function stopAlarmPreview(){if(alarmPreviewTimer){clearTimeout(alarmPreviewTimer);alarmPreviewTimer=null;stopAlarm();}}
