let ctx;
let muted = false;
let musicTimer;
let musicStep = 0;
let musicIntensity = 0.2;
let musicBus;
let ambienceBus;

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

function tone({ frequency, duration = 0.12, type = 'triangle', volume = 0.06, destination, detune = 0, when }) {
  if (!ctx || muted) return;
  const now = when ?? ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.detune.value = detune;
  osc.frequency.setValueAtTime(frequency, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(35, frequency * 0.72), now + duration);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(gain).connect(destination || ctx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.025);
}

function scheduleMusicStep() {
  if (!ctx || muted || !musicBus) return;
  const now = ctx.currentTime + 0.015;
  const scale = [0, 3, 5, 7, 10, 12, 15, 17];
  const root = musicIntensity > 0.68 ? 55 : 49;
  const note = root * Math.pow(2, scale[musicStep % scale.length] / 12);
  const beat = musicStep % 8;
  const pulse = musicIntensity > 0.68 ? 0.052 : 0.038;
  tone({ frequency: note, duration: 0.24, type: 'triangle', volume: pulse, destination: musicBus, when: now });
  if (beat === 0 || (musicIntensity > 0.62 && beat === 4)) tone({ frequency: root / 2, duration: 0.38, type: 'sine', volume: 0.08, destination: musicBus, when: now });
  if (musicIntensity > 0.38 && beat % 2 === 1) tone({ frequency: note * 2.02, duration: 0.07, type: 'square', volume: 0.018 + musicIntensity * 0.02, destination: musicBus, when: now });
  musicStep += 1;
}

export function startMusic() {
  const audio = ensure();
  if (!audio || musicTimer) return;
  musicBus = audio.createGain();
  musicBus.gain.value = 0.42;
  musicBus.connect(audio.destination);
  ambienceBus = audio.createGain();
  ambienceBus.gain.value = 0.06;
  ambienceBus.connect(audio.destination);
  musicStep = 0;
  scheduleMusicStep();
  musicTimer = window.setInterval(scheduleMusicStep, 215);
}

export function stopMusic() {
  if (musicTimer) window.clearInterval(musicTimer);
  musicTimer = undefined;
  musicBus?.disconnect();
  ambienceBus?.disconnect();
  musicBus = undefined;
  ambienceBus = undefined;
}

export function setMusicIntensity(value) {
  musicIntensity = Math.max(0, Math.min(1, value));
  if (musicBus) musicBus.gain.setTargetAtTime(0.31 + musicIntensity * 0.2, ctx.currentTime, 0.22);
}

export function blip(kind = 'shot') {
  if (muted) return;
  const audio = ensure();
  if (!audio) return;
  const now = audio.currentTime;
  const presets = {
    shot: { frequency: 240, duration: 0.075, type: 'square', volume: 0.028 },
    hit: { frequency: 155, duration: 0.105, type: 'sawtooth', volume: 0.048 },
    dash: { frequency: 120, duration: 0.22, type: 'sawtooth', volume: 0.075 },
    level: { frequency: 420, duration: 0.36, type: 'triangle', volume: 0.11 },
    boss: { frequency: 70, duration: 0.46, type: 'sine', volume: 0.14 }
  };
  tone({ ...(presets[kind] || presets.shot), destination: audio.destination, when: now });
  if (kind === 'level') tone({ frequency: 630, duration: 0.24, type: 'triangle', volume: 0.075, destination: audio.destination, when: now + 0.13 });
  if (kind === 'boss') tone({ frequency: 46, duration: 0.6, type: 'sine', volume: 0.075, destination: audio.destination, when: now + 0.08 });
}
