let ctx: AudioContext | null = null;
let muted = false;

function getCtx(): AudioContext | null {
  if (muted || typeof window === 'undefined') return null;
  if (!ctx) {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) ctx = new AudioCtx();
  }
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

export function setSfxMuted(value: boolean): void {
  muted = value;
}

export function isSfxMuted(): boolean {
  return muted;
}

function tone(freq: number, duration: number, type: OscillatorType = 'triangle', gain = 0.08, slideTo?: number) {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + duration);
  g.gain.setValueAtTime(gain, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
  osc.connect(g);
  g.connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + duration);
}

export const sfx = {
  click: () => tone(520, 0.06, 'sine', 0.04, 680),
  slash: () => tone(380, 0.14, 'sawtooth', 0.06, 110),
  shield: () => tone(260, 0.16, 'triangle', 0.07, 420),
  resonance: () => {
    tone(440, 0.22, 'sine', 0.08, 660);
    setTimeout(() => tone(660, 0.26, 'triangle', 0.07, 880), 80);
  },
  thunder: () => tone(130, 0.35, 'sawtooth', 0.09, 45),
  victory: () => {
    tone(523, 0.18, 'triangle', 0.07);
    setTimeout(() => tone(659, 0.18, 'triangle', 0.07), 110);
    setTimeout(() => tone(784, 0.32, 'triangle', 0.08), 220);
  },
};
