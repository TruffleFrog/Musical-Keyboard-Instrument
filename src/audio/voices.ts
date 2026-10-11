import type { InstrumentId } from '../types/music';
import type { SharedAssets } from './assets';
import type { SampleBank } from './samples';

/** Tone controls resolved to physical units. */
export interface PhysicalTone {
  /** 0..1 */
  brightness: number;
  /** seconds */
  attack: number;
  /** seconds */
  release: number;
  /** 0..1 */
  width: number;
}

export interface VoiceSpec {
  midi: number;
  /** Sounding frequency in Hz (already transposed for the instrument). */
  freq: number;
  /** 0..1 */
  velocity: number;
  /** AudioContext time at which the note starts. */
  when: number;
  tone: PhysicalTone;
}

export interface VoiceEnv {
  ctx: BaseAudioContext;
  out: AudioNode;
  assets: SharedAssets;
  samples: SampleBank;
}

export interface VoiceImpl {
  /** Begin the release at `when`; returns the time the voice falls silent. */
  release(when: number): number;
  /** Fade out quickly and stop (used for voice stealing and panic). */
  kill(when: number, fadeSeconds: number): void;
  onEnded: (() => void) | null;
}

export type VoiceFactory = (env: VoiceEnv, spec: VoiceSpec) => VoiceImpl;

/* ------------------------------------------------------------------ */

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

/** Longer ring in the bass, shorter up top, as on a real piano. */
function pitchScaledRelease(midi: number, base: number): number {
  const scale = midi < 60 ? 1 + (60 - midi) / 36 : Math.max(0.55, 1 - (midi - 60) / 90);
  return base * scale;
}

/** Exponential-approach envelope helper: reaches ~95% after `time`. */
function tauFor(time: number): number {
  return Math.max(0.0008, time / 3);
}

/**
 * Owns the audio nodes of one note. All envelopes are built from
 * setTargetAtTime so cancelling at the release time never causes a jump,
 * even if the key is lifted in the middle of the attack.
 */
class Rig implements VoiceImpl {
  onEnded: (() => void) | null = null;
  readonly env: GainNode;
  private nodes: AudioNode[] = [];
  private sources: AudioScheduledSourceNode[] = [];
  private pending = 0;
  private finished = false;
  private released = false;

  constructor(
    protected readonly ctx: BaseAudioContext,
    dest: AudioNode,
    protected readonly t0: number,
    private readonly releaseSeconds: number
  ) {
    this.env = ctx.createGain();
    this.env.gain.value = 0;
    this.env.connect(dest);
    this.nodes.push(this.env, dest);
  }

  node<T extends AudioNode>(n: T): T {
    this.nodes.push(n);
    return n;
  }

  /** Starts a source at the note's start time (or a later `at`). */
  run<T extends AudioScheduledSourceNode>(src: T, at = this.t0, offset?: number): T {
    this.nodes.push(src);
    this.sources.push(src);
    this.pending += 1;
    src.onended = () => {
      this.pending -= 1;
      if (this.pending <= 0) this.finish();
    };
    if (offset !== undefined && 'buffer' in src) {
      (src as unknown as AudioBufferSourceNode).start(at, offset);
    } else {
      src.start(at);
    }
    return src;
  }

  /** Amplitude: attack to `peak`, then optionally decay toward `sustain`. */
  shape(peak: number, attack: number, decayTau?: number, sustain = 0): void {
    const g = this.env.gain;
    g.setValueAtTime(0, this.t0);
    g.setTargetAtTime(peak, this.t0, tauFor(attack));
    if (decayTau !== undefined) {
      const at = this.t0 + Math.max(attack, 0.004);
      g.setTargetAtTime(sustain * peak, at, decayTau);
    }
  }

  release(when: number): number {
    const t = Math.max(when, this.t0);
    if (this.released) return t;
    this.released = true;
    const g = this.env.gain;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(0, t, this.releaseSeconds / 4.5);
    const end = t + this.releaseSeconds * 1.7 + 0.03;
    this.stopAll(end);
    return end;
  }

  kill(when: number, fade: number): void {
    const t = Math.max(when, this.t0);
    this.released = true;
    const g = this.env.gain;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(0, t, Math.max(0.002, fade / 4.5));
    this.stopAll(t + fade * 2 + 0.01);
  }

  private stopAll(at: number): void {
    for (const s of this.sources) {
      try {
        s.stop(at);
      } catch {
        /* already stopped */
      }
    }
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    for (const n of this.nodes) {
      try {
        n.disconnect();
      } catch {
        /* already disconnected */
      }
    }
    this.onEnded?.();
  }
}

function osc(
  ctx: BaseAudioContext,
  type: OscillatorType,
  freq: number,
  detuneCents = 0
): OscillatorNode {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  if (detuneCents) o.detune.value = detuneCents;
  return o;
}

function lowpass(ctx: BaseAudioContext, freq: number, q = 0.707): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = clamp(freq, 40, 20000);
  f.Q.value = q;
  return f;
}

/** AC coupling: removes the DC an asymmetric saturator creates. */
function highpass(ctx: BaseAudioContext, freq: number, q = 0.707): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}

function panner(ctx: BaseAudioContext, pan: number, dest: AudioNode): StereoPannerNode {
  const p = ctx.createStereoPanner();
  p.pan.value = clamp(pan, -1, 1);
  p.connect(dest);
  return p;
}

/** Keys spread gently across the stereo field like a real keyboard. */
function keyPan(midi: number, width: number): number {
  return clamp(((midi - 60) / 40) * 0.6 * width, -0.6, 0.6);
}

function gain(ctx: BaseAudioContext, value: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = value;
  return g;
}

/* ------------------------------------------------------------------ */
/* Grand piano (sampled, with a synthesised stand-in until loaded)      */
/* ------------------------------------------------------------------ */

const pianoSampled: VoiceFactory = (env, s) => {
  const { ctx } = env;
  const zone = env.samples.zoneFor(s.midi);
  if (!zone) return pianoFallback(env, s);

  const v = s.velocity;
  const rel = pitchScaledRelease(s.midi, s.tone.release);
  const pan = panner(ctx, keyPan(s.midi, s.tone.width), env.out);
  const rig = new Rig(ctx, pan, s.when, rel);

  // Softer touches are darker, like a real piano's hammer felt.
  const t = clamp(0.1 + 0.5 * s.tone.brightness + 0.5 * v, 0, 1);
  const cutoff = 1100 * Math.pow(19000 / 1100, t);
  const lp = rig.node(lowpass(ctx, cutoff, 0.5));

  const src = ctx.createBufferSource();
  src.buffer = zone.buffer;
  src.playbackRate.value = zone.rate;
  src.connect(lp);
  lp.connect(rig.env);

  const peak = zone.gain * (0.06 + 0.94 * Math.pow(v, 1.6)) * 0.62;
  rig.shape(peak, 0.0015);
  rig.run(src, s.when, zone.onset);
  return rig;
};

/** Additive tone used only while the samples are still downloading. */
const pianoFallback: VoiceFactory = (env, s) => {
  const { ctx } = env;
  const v = s.velocity;
  const rel = pitchScaledRelease(s.midi, s.tone.release);
  const pan = panner(ctx, keyPan(s.midi, s.tone.width), env.out);
  const rig = new Rig(ctx, pan, s.when, rel);
  const lp = rig.node(lowpass(ctx, 1500 + 7000 * v * (0.4 + s.tone.brightness)));
  lp.connect(rig.env);

  const base = 2.6 * Math.pow(60 / Math.max(36, s.midi), 1.1);
  for (let n = 1; n <= 6; n++) {
    const f = s.freq * n * Math.sqrt(1 + 0.0004 * n * n);
    if (f > 14000) break;
    const o = osc(ctx, 'sine', f, n === 1 ? -3 : 0);
    const g = rig.node(gain(ctx, 0));
    const level = (1 / Math.pow(n, 1.15)) * (n > 2 ? 0.5 + v : 1);
    g.gain.setValueAtTime(0, s.when);
    g.gain.setTargetAtTime(level * 0.3, s.when, 0.0015);
    g.gain.setTargetAtTime(0, s.when + 0.004, base / Math.pow(n, 0.6));
    o.connect(g);
    g.connect(lp);
    rig.run(o);
  }
  rig.shape(0.7 * (0.1 + 0.9 * Math.pow(v, 1.5)), 0.002);
  return rig;
};

/* ------------------------------------------------------------------ */
/* Electric piano: FM tine + pickup nonlinearity                        */
/* ------------------------------------------------------------------ */

const rhodes: VoiceFactory = (env, s) => {
  const { ctx } = env;
  const v = s.velocity;
  const f = s.freq;
  const rel = pitchScaledRelease(s.midi, s.tone.release);
  const pan = panner(ctx, keyPan(s.midi, 0.7), env.out);
  const rig = new Rig(ctx, pan, s.when, rel);

  // Tine: sine carrier phase-modulated by a 1:1 modulator whose index decays,
  // giving the characteristic bark on attack that mellows into a bell tone.
  const carrier = osc(ctx, 'sine', f);
  const mod = osc(ctx, 'sine', f);
  const modGain = rig.node(gain(ctx, 0));
  const idx = (0.7 + 2.6 * v) * (0.5 + 0.9 * s.tone.brightness);
  modGain.gain.setValueAtTime(idx * f, s.when);
  modGain.gain.setTargetAtTime(0.14 * idx * f, s.when + 0.002, 0.2);
  mod.connect(modGain);
  modGain.connect(carrier.frequency);

  // Pickup: harder playing drives the asymmetric saturator harder.
  const pre = rig.node(gain(ctx, 0.5 + 0.75 * v));
  const shaper = rig.node(ctx.createWaveShaper());
  shaper.curve = env.assets.rhodesCurve as Float32Array<ArrayBuffer>;
  shaper.oversample = '2x';
  const dcBlock = rig.node(highpass(ctx, 32));
  const tone = rig.node(lowpass(ctx, 1800 * Math.pow(9, s.tone.brightness) + 600 * v, 0.6));
  carrier.connect(pre);
  pre.connect(shaper);
  shaper.connect(dcBlock);
  dcBlock.connect(tone);
  tone.connect(rig.env);

  // Bell partial (tine overtone) with a very short life.
  const bellFreq = f * 6.8;
  if (bellFreq < 13000) {
    const bell = osc(ctx, 'sine', bellFreq);
    const bg = rig.node(gain(ctx, 0));
    bg.gain.setValueAtTime(0.16 * v * v, s.when);
    bg.gain.setTargetAtTime(0, s.when + 0.001, 0.07);
    bell.connect(bg);
    bg.connect(tone);
    rig.run(bell);
  }

  // Soft hammer thump.
  const thump = ctx.createBufferSource();
  thump.buffer = env.assets.noise;
  const thumpLp = rig.node(lowpass(ctx, 520, 0.9));
  const tg = rig.node(gain(ctx, 0));
  tg.gain.setValueAtTime(0.1 * (0.3 + v), s.when);
  tg.gain.setTargetAtTime(0, s.when + 0.001, 0.009);
  thump.connect(thumpLp);
  thumpLp.connect(tg);
  tg.connect(rig.env);

  const decay = clamp(1.1 + (72 - s.midi) * 0.045, 0.5, 3.6);
  const peak = 0.5 * (0.1 + 0.9 * Math.pow(v, 1.25));
  rig.shape(peak, 0.002, decay, 0);

  rig.run(carrier);
  rig.run(mod);
  rig.run(thump, s.when, Math.random() * 0.5);
  return rig;
};

/* ------------------------------------------------------------------ */
/* Poly synth: unison saws into a 24 dB filter with a per-note sweep    */
/* ------------------------------------------------------------------ */

const polySynth: VoiceFactory = (env, s) => {
  const { ctx } = env;
  const v = s.velocity;
  const rel = s.tone.release;
  const w = s.tone.width;
  const out = ctx.createGain();
  out.connect(env.out);
  const rig = new Rig(ctx, out, s.when, rel);

  // Key tracking keeps high notes from sounding duller than low ones.
  const track = Math.pow(clamp(s.freq / 261.6, 0.4, 3), 0.55);
  const base = 260 * Math.pow(46, s.tone.brightness) * track;
  const f1 = rig.node(lowpass(ctx, base, 1.6));
  const f2 = rig.node(lowpass(ctx, base, 2.4));
  const open = Math.min(16000, base * (1.6 + 4.2 * v));
  for (const f of [f1, f2]) {
    f.frequency.setValueAtTime(open, s.when);
    f.frequency.setTargetAtTime(base * 1.1, s.when + 0.01, 0.32);
  }
  f1.connect(f2);
  f2.connect(rig.env);

  const spread = 3 + 20 * w;
  const mix: Array<[number, number, number]> = [
    [-spread, -0.7 * w, 0.26],
    [spread, 0.7 * w, 0.26],
    [0, 0, 0.22],
  ];
  for (const [cents, p, level] of mix) {
    const o = osc(ctx, 'sawtooth', s.freq, cents);
    const g = rig.node(gain(ctx, level));
    const pn = rig.node(ctx.createStereoPanner());
    pn.pan.value = p;
    o.connect(g);
    g.connect(pn);
    pn.connect(f1);
    rig.run(o);
  }
  const sub = osc(ctx, 'sine', s.freq / 2);
  const sg = rig.node(gain(ctx, 0.3));
  sub.connect(sg);
  sg.connect(f1);
  rig.run(sub);

  rig.shape(0.34 * (0.35 + 0.65 * v), s.tone.attack);
  return rig;
};

/* ------------------------------------------------------------------ */
/* Funk bass: saw + sub with a plucky resonant filter                   */
/* ------------------------------------------------------------------ */

const funkBass: VoiceFactory = (env, s) => {
  const { ctx } = env;
  const v = s.velocity;
  const out = ctx.createGain();
  out.connect(env.out);
  const rig = new Rig(ctx, out, s.when, s.tone.release);

  const closed = 140 + 700 * s.tone.brightness;
  const open = Math.min(9000, closed + (500 + 4200 * s.tone.brightness) * (0.4 + v));
  const lp = rig.node(lowpass(ctx, open, 5.5));
  lp.frequency.setValueAtTime(open, s.when);
  lp.frequency.setTargetAtTime(closed, s.when + 0.003, 0.085);
  lp.connect(rig.env);

  const saw = osc(ctx, 'sawtooth', s.freq);
  const sawG = rig.node(gain(ctx, 0.46));
  const sq = osc(ctx, 'square', s.freq, 4);
  const sqG = rig.node(gain(ctx, 0.12));
  const sub = osc(ctx, 'sine', s.freq / 2);
  const subG = rig.node(gain(ctx, 0.62));
  saw.connect(sawG);
  sawG.connect(lp);
  sq.connect(sqG);
  sqG.connect(lp);
  sub.connect(subG);
  subG.connect(lp);
  rig.run(saw);
  rig.run(sq);
  rig.run(sub);

  rig.shape(0.55 * (0.3 + 0.7 * v), s.tone.attack, 0.42, 0.62);
  return rig;
};

/* ------------------------------------------------------------------ */
/* 8-bit chip: band-limited 25% pulse + triangle, delayed vibrato       */
/* ------------------------------------------------------------------ */

const chiptune: VoiceFactory = (env, s) => {
  const { ctx } = env;
  const v = s.velocity;
  const out = ctx.createGain();
  out.connect(env.out);
  const rig = new Rig(ctx, out, s.when, s.tone.release);

  const lp = rig.node(lowpass(ctx, 2600 * Math.pow(6.5, s.tone.brightness), 0.5));
  lp.connect(rig.env);

  const pulse = ctx.createOscillator();
  pulse.setPeriodicWave(env.assets.pulse25);
  pulse.frequency.value = s.freq;
  const pg = rig.node(gain(ctx, 0.5));
  pulse.connect(pg);
  pg.connect(lp);

  const tri = osc(ctx, 'triangle', s.freq / 2);
  const tg = rig.node(gain(ctx, 0.42));
  tri.connect(tg);
  tg.connect(lp);

  // Vibrato that fades in after the note has been held for a moment.
  const lfo = osc(ctx, 'sine', 6.2);
  const lfoG = rig.node(gain(ctx, 0));
  const depth = 4 + 26 * s.tone.width;
  lfoG.gain.setValueAtTime(0, s.when);
  lfoG.gain.setTargetAtTime(depth, s.when + 0.16, 0.12);
  lfo.connect(lfoG);
  lfoG.connect(pulse.detune);
  lfoG.connect(tri.detune);

  rig.run(pulse);
  rig.run(tri);
  rig.run(lfo);
  rig.shape(0.26 * (0.5 + 0.5 * v), s.tone.attack, 0.05, 0.82);
  return rig;
};

/* ------------------------------------------------------------------ */
/* Pipe organ: additive principal chorus with a breath of chiff         */
/* ------------------------------------------------------------------ */

const pipeOrgan: VoiceFactory = (env, s) => {
  const { ctx } = env;
  const v = s.velocity;
  const out = ctx.createGain();
  out.connect(env.out);
  const rig = new Rig(ctx, out, s.when, s.tone.release);

  const lp = rig.node(lowpass(ctx, 1500 * Math.pow(9, s.tone.brightness), 0.5));
  lp.connect(rig.env);

  for (const [cents, level] of [
    [-4, 0.36],
    [4, 0.36],
  ] as Array<[number, number]>) {
    const o = ctx.createOscillator();
    o.setPeriodicWave(env.assets.organ);
    o.frequency.value = s.freq;
    o.detune.value = cents;
    const g = rig.node(gain(ctx, level));
    o.connect(g);
    g.connect(lp);
    rig.run(o);
  }
  const sub = osc(ctx, 'sine', s.freq / 2);
  const sg = rig.node(gain(ctx, 0.22));
  sub.connect(sg);
  sg.connect(lp);
  rig.run(sub);

  // Chiff: a few milliseconds of band-passed breath at the front of the note.
  const chiff = ctx.createBufferSource();
  chiff.buffer = env.assets.noise;
  const bp = rig.node(ctx.createBiquadFilter());
  bp.type = 'bandpass';
  bp.frequency.value = clamp(s.freq * 4, 300, 7000);
  bp.Q.value = 1.4;
  const cg = rig.node(gain(ctx, 0));
  cg.gain.setValueAtTime(0.09 * (0.4 + 0.6 * s.tone.brightness), s.when);
  cg.gain.setTargetAtTime(0, s.when + 0.002, 0.018);
  chiff.connect(bp);
  bp.connect(cg);
  cg.connect(rig.env);
  rig.run(chiff, s.when, Math.random() * 0.5);

  rig.shape(0.3 * (0.8 + 0.2 * v), s.tone.attack);
  return rig;
};

export const VOICE_FACTORIES: Record<InstrumentId, VoiceFactory> = {
  piano: pianoSampled,
  epiano: rhodes,
  synth: polySynth,
  bass: funkBass,
  chiptune,
  organ: pipeOrgan,
};

/** Semitone offset applied to the played note before synthesis. */
export const INSTRUMENT_TRANSPOSE: Record<InstrumentId, number> = {
  piano: 0,
  epiano: 0,
  synth: 0,
  bass: -12,
  chiptune: 0,
  organ: 0,
};
