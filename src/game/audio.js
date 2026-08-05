let ctx;
let muted = false;

function ensure() {
  if (!ctx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) ctx = new AudioContext();
  }
  if (ctx?.state === 'suspended') ctx.resume();
  return ctx;
}

export function setMuted(value) { muted = value; }
export function isMuted() { return muted; }

export function blip(kind = 'shot') {
  if (muted) return;
  const audio = ensure();
  if (!audio) return;
  const now = audio.currentTime;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  const filter = audio.createBiquadFilter();
  osc.type = kind === 'dash' ? 'sawtooth' : kind === 'level' ? 'triangle' : 'square';
  const base = kind === 'hit' ? 180 : kind === 'dash' ? 120 : kind === 'level' ? 420 : kind === 'boss' ? 70 : 280;
  osc.frequency.setValueAtTime(base, now);
  osc.frequency.exponentialRampToValueAtTime(base * (kind === 'level' ? 1.8 : 0.55), now + (kind === 'dash' ? 0.22 : 0.09));
  filter.type = 'lowpass';
  filter.frequency.value = kind === 'boss' ? 480 : 1900;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(kind === 'boss' ? 0.13 : 0.055, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + (kind === 'level' ? 0.35 : 0.12));
  osc.connect(filter).connect(gain).connect(audio.destination);
  osc.start(now);
  osc.stop(now + (kind === 'level' ? 0.36 : 0.14));
}
