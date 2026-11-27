import type { ElementTag } from '../core/types';

// 中国传统五声音阶（D 宫调式：D, E, F#, A, B）
const PENTA = {
  D3: 146.83, E3: 164.81, Fs3: 185.0, A3: 220.0, B3: 246.94,
  D4: 293.66, E4: 329.63, Fs4: 369.99, A4: 440.0, B4: 493.88,
  D5: 587.33, E5: 659.25, Fs5: 739.99, A5: 880.0, B5: 987.77,
  D6: 1174.66,
};

class XianxiaAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private dryGain: GainNode | null = null;
  private wetGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private sfxMuted = false;
  private bgmEnabled = false;
  private bgmTimer: number | null = null;
  private windNode: AudioBufferSourceNode | null = null;
  private windGain: GainNode | null = null;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      const c = new AudioCtx();
      this.ctx = c;

      // 母线防削波压限器
      const limiter = c.createDynamicsCompressor();
      limiter.threshold.value = -8;
      limiter.knee.value = 12;
      limiter.ratio.value = 8;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.15;

      const master = c.createGain();
      master.gain.value = 0.85;

      const dry = c.createGain();
      dry.gain.value = 0.88;

      const wet = c.createGain();
      wet.gain.value = 0.34;

      const convolver = c.createConvolver();
      convolver.buffer = this.createHallImpulse(c, 1.45, 2.6);

      dry.connect(master);
      wet.connect(convolver);
      convolver.connect(master);
      master.connect(limiter);
      limiter.connect(c.destination);

      this.masterGain = master;
      this.dryGain = dry;
      this.wetGain = wet;
      this.noiseBuffer = this.createNoiseBuffer(c, 2.0);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private createHallImpulse(c: AudioContext, duration: number, decay: number): AudioBuffer {
    const length = Math.floor(c.sampleRate * duration);
    const impulse = c.createBuffer(2, length, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        const env = Math.pow(1 - i / length, decay);
        data[i] = (Math.random() * 2 - 1) * env * 0.45;
      }
    }
    return impulse;
  }

  private createNoiseBuffer(c: AudioContext, duration: number): AudioBuffer {
    const length = Math.floor(c.sampleRate * duration);
    const buf = c.createBuffer(1, length, c.sampleRate);
    const data = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + white * 0.029;
      b1 = 0.985 * b1 + white * 0.032;
      b2 = 0.950 * b2 + white * 0.048;
      data[i] = (b0 + b1 + b2 + white * 0.18) * 0.85;
    }
    return buf;
  }

  private jitter(base: number, pct = 0.04): number {
    return base * (1 + (Math.random() * 2 - 1) * pct);
  }

  private route(node: AudioNode, wetSend = 0.25) {
    if (!this.dryGain || !this.wetGain || !this.ctx) return;
    node.connect(this.dryGain);
    if (wetSend > 0) {
      const send = this.ctx.createGain();
      send.gain.value = wetSend;
      node.connect(send);
      send.connect(this.wetGain);
    }
  }

  /** 古琴/弹拨乐器建模：起音清亮、中段温润衰减 */
  private pluck(freq: number, delay = 0, duration = 0.75, volume = 0.12, wet = 0.55) {
    const c = this.ensureContext();
    if (!c || this.sfxMuted) return;
    const t = c.currentTime + delay;
    const f = this.jitter(freq, 0.008);

    const osc1 = c.createOscillator();
    const osc2 = c.createOscillator();
    osc1.type = 'triangle';
    osc2.type = 'sine';
    osc1.frequency.setValueAtTime(f, t);
    osc2.frequency.setValueAtTime(f * 2.0, t);

    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.min(5200, f * 6), t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(320, f * 1.4), t + duration * 0.7);

    const gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0008, t + duration);

    const subGain = c.createGain();
    subGain.gain.value = 0.35;

    osc1.connect(filter);
    osc2.connect(subGain);
    subGain.connect(filter);
    filter.connect(gain);
    this.route(gain, wet);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + duration + 0.02);
    osc2.stop(t + duration + 0.02);
  }

  /** 滤波噪声层（破风/雷滚/火焰/毒雾/符纸） */
  private noiseBurst(opts: {
    delay?: number;
    duration: number;
    filterType: BiquadFilterType;
    freqStart: number;
    freqEnd: number;
    q?: number;
    volume: number;
    attack?: number;
    wet?: number;
  }) {
    const c = this.ensureContext();
    if (!c || !this.noiseBuffer || this.sfxMuted) return;
    const t = c.currentTime + (opts.delay ?? 0);
    const src = c.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = c.createBiquadFilter();
    filter.type = opts.filterType;
    filter.Q.value = opts.q ?? 1.2;
    filter.frequency.setValueAtTime(this.jitter(opts.freqStart, 0.06), t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, opts.freqEnd), t + opts.duration);

    const gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(opts.volume, t + (opts.attack ?? 0.01));
    gain.gain.exponentialRampToValueAtTime(0.0008, t + opts.duration);

    src.connect(filter);
    filter.connect(gain);
    this.route(gain, opts.wet ?? 0.3);

    src.start(t, Math.random() * 0.6, opts.duration + 0.05);
  }

  /** 钟磬/金石金属谐波（护盾/法宝/格挡/剑鸣） */
  private metallicHit(baseFreq: number, duration: number, volume: number, wet = 0.5, delay = 0) {
    const c = this.ensureContext();
    if (!c || this.sfxMuted) return;
    const t = c.currentTime + delay;
    const ratios = [1, 2.756, 5.404];
    const weights = [1, 0.42, 0.18];
    ratios.forEach((r, idx) => {
      const osc = c.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(this.jitter(baseFreq * r, 0.025), t);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(volume * weights[idx], t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0006, t + duration / (1 + idx * 0.45));
      osc.connect(g);
      this.route(g, wet);
      osc.start(t);
      osc.stop(t + duration + 0.03);
    });
  }

  // ==================== 公开音效接口 ====================

  setMuted(value: boolean) {
    this.sfxMuted = value;
    if (value) this.setBgmEnabled(false);
  }

  isMuted() {
    return this.sfxMuted;
  }

  isBgmEnabled() {
    return this.bgmEnabled;
  }

  setBgmEnabled(enabled: boolean) {
    this.bgmEnabled = enabled;
    if (enabled && !this.sfxMuted) {
      this.startAmbientBgm();
    } else {
      this.stopAmbientBgm();
    }
  }

  private startAmbientBgm() {
    const c = this.ensureContext();
    if (!c || !this.noiseBuffer || this.bgmTimer !== null) return;

    // 极轻柔的山海云风底噪
    const wind = c.createBufferSource();
    wind.buffer = this.noiseBuffer;
    wind.loop = true;
    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 260;
    filter.Q.value = 2.2;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.linearRampToValueAtTime(0.025, c.currentTime + 1.5);

    wind.connect(filter);
    filter.connect(g);
    this.route(g, 0.65);
    wind.start();
    this.windNode = wind;
    this.windGain = g;

    // 偶发禅意五声古琴泛音
    const scale = [PENTA.D4, PENTA.E4, PENTA.Fs4, PENTA.A4, PENTA.B4, PENTA.D5, PENTA.E5];
    const scheduleNote = () => {
      if (!this.bgmEnabled || this.sfxMuted) return;
      const note = scale[Math.floor(Math.random() * scale.length)];
      this.pluck(note, 0, 2.2, 0.038, 0.85);
      if (Math.random() < 0.35) {
        const fifth = scale[Math.floor(Math.random() * scale.length)];
        this.pluck(fifth, 0.45, 1.8, 0.025, 0.85);
      }
      this.bgmTimer = window.setTimeout(scheduleNote, 2400 + Math.random() * 2600);
    };
    this.bgmTimer = window.setTimeout(scheduleNote, 600);
  }

  private stopAmbientBgm() {
    if (this.bgmTimer !== null) {
      clearTimeout(this.bgmTimer);
      this.bgmTimer = null;
    }
    if (this.windNode && this.windGain && this.ctx) {
      try {
        this.windGain.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 0.3);
        this.windNode.stop(this.ctx.currentTime + 0.35);
      } catch {}
      this.windNode = null;
      this.windGain = null;
    }
  }

  /** 玉简轻叩（按钮点击） */
  click() {
    this.metallicHit(1280, 0.08, 0.045, 0.25);
  }

  /** 星宿落子（地图选点） */
  mapStep() {
    const c = this.ensureContext();
    if (!c || this.sfxMuted) return;
    const t = c.currentTime;
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(this.jitter(220, 0.05), t);
    osc.frequency.exponentialRampToValueAtTime(75, t + 0.09);
    const g = c.createGain();
    g.gain.setValueAtTime(0.11, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
    osc.connect(g);
    this.route(g, 0.35);
    osc.start(t);
    osc.stop(t + 0.12);
    this.metallicHit(880, 0.14, 0.035, 0.4, 0.01);
  }

  /** 灵石入袋（交易/收获） */
  coin() {
    this.metallicHit(1760, 0.16, 0.055, 0.4, 0);
    this.metallicHit(2349, 0.22, 0.05, 0.45, 0.055);
  }

  /** 剑气斩击（金/默认攻伐）：破风 + 清越剑鸣 */
  slash() {
    this.noiseBurst({
      duration: 0.18,
      filterType: 'bandpass',
      freqStart: 2800,
      freqEnd: 520,
      q: 1.8,
      volume: 0.16,
      attack: 0.008,
      wet: 0.35,
    });
    const c = this.ensureContext();
    if (!c || this.sfxMuted) return;
    const t = c.currentTime;
    const osc = c.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(this.jitter(1420, 0.05), t);
    osc.frequency.exponentialRampToValueAtTime(420, t + 0.16);
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1800;
    f.Q.value = 3.2;
    const g = c.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.085, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 0.22);
    osc.connect(f);
    f.connect(g);
    this.route(g, 0.45);
    osc.start(t);
    osc.stop(t + 0.24);
  }

  /** 紫霄落雷（雷法/天劫）：电弧炸裂 + 次声雷滚 */
  thunder() {
    this.noiseBurst({
      duration: 0.11,
      filterType: 'highpass',
      freqStart: 3200,
      freqEnd: 900,
      volume: 0.22,
      attack: 0.002,
      wet: 0.4,
    });
    this.noiseBurst({
      delay: 0.04,
      duration: 0.62,
      filterType: 'lowpass',
      freqStart: 420,
      freqEnd: 75,
      q: 1.0,
      volume: 0.26,
      attack: 0.02,
      wet: 0.75,
    });
    const c = this.ensureContext();
    if (!c || this.sfxMuted) return;
    const t = c.currentTime;
    const sub = c.createOscillator();
    sub.type = 'triangle';
    sub.frequency.setValueAtTime(98, t);
    sub.frequency.exponentialRampToValueAtTime(34, t + 0.42);
    const g = c.createGain();
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    sub.connect(g);
    this.route(g, 0.55);
    sub.start(t);
    sub.stop(t + 0.48);
  }

  /** 丹火焚烧（火系） */
  fire() {
    this.noiseBurst({
      duration: 0.34,
      filterType: 'bandpass',
      freqStart: 340,
      freqEnd: 1350,
      q: 1.4,
      volume: 0.19,
      attack: 0.025,
      wet: 0.42,
    });
    this.noiseBurst({
      delay: 0.06,
      duration: 0.16,
      filterType: 'highpass',
      freqStart: 2200,
      freqEnd: 1100,
      volume: 0.08,
      wet: 0.3,
    });
  }

  /** 丹毒腐蚀（木/毒系）：气泡上滑 + 毒雾嘶鸣 */
  poison() {
    this.noiseBurst({
      duration: 0.26,
      filterType: 'bandpass',
      freqStart: 2400,
      freqEnd: 1500,
      q: 3.5,
      volume: 0.09,
      wet: 0.4,
    });
    const c = this.ensureContext();
    if (!c || this.sfxMuted) return;
    [0, 0.07, 0.13].forEach((d, idx) => {
      const t = c.currentTime + d;
      const osc = c.createOscillator();
      osc.type = 'sine';
      const base = 280 + idx * 120;
      osc.frequency.setValueAtTime(this.jitter(base, 0.08), t);
      osc.frequency.exponentialRampToValueAtTime(base * 2.1, t + 0.08);
      const g = c.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.075, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      osc.connect(g);
      this.route(g, 0.45);
      osc.start(t);
      osc.stop(t + 0.1);
    });
  }

  /** 血煞魔功 / 燃寿禁术（煞系）：暗沉撕裂低吼 */
  sha() {
    const c = this.ensureContext();
    if (!c || this.sfxMuted) return;
    const t = c.currentTime;
    [118, 125].forEach((freq) => {
      const osc = c.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(52, t + 0.36);
      const filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(880, t);
      filter.frequency.exponentialRampToValueAtTime(160, t + 0.36);
      const g = c.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.09, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
      osc.connect(filter);
      filter.connect(g);
      this.route(g, 0.55);
      osc.start(t);
      osc.stop(t + 0.4);
    });
    this.noiseBurst({
      duration: 0.24,
      filterType: 'bandpass',
      freqStart: 900,
      freqEnd: 260,
      q: 2.0,
      volume: 0.14,
      wet: 0.5,
    });
  }

  /** 护体罡气 / 布阵（金钟浑厚嗡鸣） */
  shield() {
    this.metallicHit(329.63, 0.42, 0.085, 0.55);
    this.pluck(PENTA.A4, 0.02, 0.35, 0.055, 0.5);
  }

  /** 护盾完美格挡敌方攻击（清脆金石相击） */
  blockHit() {
    this.metallicHit(920, 0.24, 0.1, 0.45);
    this.noiseBurst({
      duration: 0.07,
      filterType: 'highpass',
      freqStart: 2600,
      freqEnd: 1200,
      volume: 0.12,
      attack: 0.002,
      wet: 0.25,
    });
  }

  /** 我方气血受创（沉闷钝击） */
  hurt() {
    const c = this.ensureContext();
    if (!c || this.sfxMuted) return;
    const t = c.currentTime;
    const osc = c.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(145, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.2);
    const g = c.createGain();
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(g);
    this.route(g, 0.25);
    osc.start(t);
    osc.stop(t + 0.24);
    this.noiseBurst({
      duration: 0.12,
      filterType: 'lowpass',
      freqStart: 620,
      freqEnd: 140,
      volume: 0.16,
      attack: 0.004,
      wet: 0.2,
    });
  }

  /** 灵丹回生 / 运转真元（温润五声古琴） */
  heal() {
    this.pluck(PENTA.D5, 0, 0.55, 0.08, 0.6);
    this.pluck(PENTA.Fs5, 0.07, 0.6, 0.08, 0.6);
    this.pluck(PENTA.A5, 0.14, 0.75, 0.09, 0.65);
  }

  /** 灵印相生共鸣（华丽五声上行扫弦 + 玉磬清鸣） */
  resonance() {
    this.pluck(PENTA.D4, 0, 0.65, 0.09, 0.65);
    this.pluck(PENTA.A4, 0.05, 0.7, 0.09, 0.65);
    this.pluck(PENTA.D5, 0.1, 0.8, 0.1, 0.7);
    this.pluck(PENTA.Fs5, 0.15, 0.9, 0.11, 0.75);
    this.metallicHit(PENTA.A5, 0.65, 0.065, 0.7, 0.14);
  }

  /** 祭出本命法宝（古鼎震响 + 灵威爆发） */
  treasure() {
    this.metallicHit(185, 0.9, 0.13, 0.7);
    this.thunder();
    this.pluck(PENTA.D5, 0.08, 0.85, 0.1, 0.7);
  }

  /** 斗法大胜（清越五声收尾） */
  victory() {
    this.pluck(PENTA.D5, 0, 0.55, 0.1, 0.6);
    this.pluck(PENTA.Fs5, 0.1, 0.55, 0.1, 0.6);
    this.pluck(PENTA.A5, 0.2, 0.65, 0.11, 0.65);
    this.pluck(PENTA.D6, 0.32, 1.1, 0.13, 0.75);
    this.metallicHit(PENTA.D5, 0.85, 0.06, 0.7, 0.32);
  }

  /** 破境登仙 / 天道法则（宏大云钟 + 天籁琶音） */
  breakthrough() {
    this.metallicHit(PENTA.D3, 1.5, 0.14, 0.85, 0);
    [PENTA.D4, PENTA.Fs4, PENTA.A4, PENTA.D5, PENTA.Fs5, PENTA.A5, PENTA.D6].forEach((n, i) => {
      this.pluck(n, 0.08 + i * 0.075, 1.1, 0.09, 0.8);
    });
  }

  /** 寿尽坐化 / 陨落（苍凉羽调古琴下行） */
  defeat() {
    this.pluck(PENTA.A4, 0, 0.9, 0.1, 0.8);
    this.pluck(PENTA.Fs4, 0.22, 0.95, 0.095, 0.8);
    this.pluck(PENTA.E4, 0.44, 1.0, 0.09, 0.8);
    this.pluck(PENTA.D4, 0.68, 1.4, 0.1, 0.85);
  }

  /** 根据卡牌元素与类型自动匹配最佳听感 */
  playElemental(element: ElementTag, isAttack: boolean, isDefense: boolean, isPoison: boolean) {
    if (isDefense && !isAttack) {
      this.shield();
      return;
    }
    if (element === 'thunder') this.thunder();
    else if (element === 'sha') this.sha();
    else if (isPoison || element === 'wood') this.poison();
    else if (element === 'fire') this.fire();
    else if (isAttack) this.slash();
    else this.heal();
  }
}

const audio = new XianxiaAudioEngine();

export const setSfxMuted = (v: boolean) => audio.setMuted(v);
export const isSfxMuted = () => audio.isMuted();
export const setBgmEnabled = (v: boolean) => audio.setBgmEnabled(v);
export const isBgmEnabled = () => audio.isBgmEnabled();

export const sfx = {
  click: () => audio.click(),
  mapStep: () => audio.mapStep(),
  coin: () => audio.coin(),
  slash: () => audio.slash(),
  thunder: () => audio.thunder(),
  fire: () => audio.fire(),
  poison: () => audio.poison(),
  sha: () => audio.sha(),
  shield: () => audio.shield(),
  blockHit: () => audio.blockHit(),
  hurt: () => audio.hurt(),
  heal: () => audio.heal(),
  resonance: () => audio.resonance(),
  treasure: () => audio.treasure(),
  victory: () => audio.victory(),
  breakthrough: () => audio.breakthrough(),
  defeat: () => audio.defeat(),
  playElemental: (el: ElementTag, atk: boolean, def: boolean, poi: boolean) =>
    audio.playElemental(el, atk, def, poi),
};
