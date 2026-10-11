import type { InstrumentId, ToneParams } from '../types/music';
import type { SharedAssets } from './assets';

/**
 * Per-instrument insert effect chain. `input` receives the summed voices of
 * one instrument; `output` feeds the dry/reverb mix in the engine.
 */
export interface InstrumentBus {
  input: AudioNode;
  output: AudioNode;
  /** Re-applies live tone controls (width/character knob). */
  apply(tone: ToneParams, now: number): void;
  dispose(): void;
}

interface Chorus {
  input: GainNode;
  output: GainNode;
  setDepth(seconds: number, now: number): void;
  setMix(mix: number, now: number): void;
  nodes: AudioNode[];
  sources: OscillatorNode[];
}

function createChorus(
  ctx: BaseAudioContext,
  rate: number,
  baseDelay: number,
  depth: number,
  mix: number
): Chorus {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  dry.gain.value = 1 - mix * 0.5;
  wet.gain.value = mix;

  const split = ctx.createChannelSplitter(2);
  const merge = ctx.createChannelMerger(2);
  const dl = ctx.createDelay(0.05);
  const dr = ctx.createDelay(0.05);
  dl.delayTime.value = baseDelay;
  dr.delayTime.value = baseDelay * 1.17;

  const lfo = ctx.createOscillator();
  lfo.frequency.value = rate;
  const lfoL = ctx.createGain();
  const lfoR = ctx.createGain();
  lfoL.gain.value = depth;
  lfoR.gain.value = -depth;
  lfo.connect(lfoL);
  lfo.connect(lfoR);
  lfoL.connect(dl.delayTime);
  lfoR.connect(dr.delayTime);

  input.connect(dry);
  dry.connect(output);
  input.connect(split);
  split.connect(dl, 0);
  split.connect(dr, 1);
  dl.connect(merge, 0, 0);
  dr.connect(merge, 0, 1);
  merge.connect(wet);
  wet.connect(output);
  lfo.start();

  return {
    input,
    output,
    setDepth(seconds, now) {
      lfoL.gain.setTargetAtTime(seconds, now, 0.03);
      lfoR.gain.setTargetAtTime(-seconds, now, 0.03);
    },
    setMix(m, now) {
      dry.gain.setTargetAtTime(1 - m * 0.5, now, 0.03);
      wet.gain.setTargetAtTime(m, now, 0.03);
    },
    nodes: [input, output, dry, wet, split, merge, dl, dr, lfoL, lfoR],
    sources: [lfo],
  };
}

function plain(ctx: BaseAudioContext): InstrumentBus {
  const g = ctx.createGain();
  return {
    input: g,
    output: g,
    apply() {},
    dispose() {
      g.disconnect();
    },
  };
}

/** Stereo tremolo ("suitcase" auto-pan) followed by a light chorus. */
function electricPianoBus(ctx: BaseAudioContext): InstrumentBus {
  const input = ctx.createGain();
  const split = ctx.createChannelSplitter(2);
  const merge = ctx.createChannelMerger(2);
  const gl = ctx.createGain();
  const gr = ctx.createGain();
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 4.7;
  const dl = ctx.createGain();
  const dr = ctx.createGain();
  lfo.connect(dl);
  lfo.connect(dr);
  dl.connect(gl.gain);
  dr.connect(gr.gain);
  input.connect(split);
  split.connect(gl, 0);
  split.connect(gr, 1);
  gl.connect(merge, 0, 0);
  gr.connect(merge, 0, 1);
  lfo.start();

  const chorus = createChorus(ctx, 0.45, 0.012, 0.0022, 0.3);
  merge.connect(chorus.input);

  const set = (depth: number, now: number) => {
    const d = 0.04 + 0.42 * depth;
    gl.gain.setTargetAtTime(1 - d / 2, now, 0.03);
    gr.gain.setTargetAtTime(1 - d / 2, now, 0.03);
    dl.gain.setTargetAtTime(d / 2, now, 0.03);
    dr.gain.setTargetAtTime(-d / 2, now, 0.03);
  };
  set(0.45, ctx.currentTime);

  return {
    input,
    output: chorus.output,
    apply(tone, now) {
      set(tone.width, now);
    },
    dispose() {
      lfo.stop();
      chorus.sources.forEach((s) => s.stop());
      [input, split, merge, gl, gr, dl, dr, ...chorus.nodes].forEach((n) =>
        n.disconnect()
      );
    },
  };
}

function synthBus(ctx: BaseAudioContext): InstrumentBus {
  const chorus = createChorus(ctx, 0.38, 0.018, 0.005, 0.5);
  return {
    input: chorus.input,
    output: chorus.output,
    apply(tone, now) {
      chorus.setMix(0.25 + 0.5 * tone.width, now);
    },
    dispose() {
      chorus.sources.forEach((s) => s.stop());
      chorus.nodes.forEach((n) => n.disconnect());
    },
  };
}

/** Rotary-speaker-ish vibrato: fast, shallow modulation. */
function organBus(ctx: BaseAudioContext): InstrumentBus {
  const chorus = createChorus(ctx, 5.4, 0.006, 0.0016, 0.45);
  return {
    input: chorus.input,
    output: chorus.output,
    apply(tone, now) {
      chorus.setDepth(0.0004 + 0.0028 * tone.width, now);
      chorus.setMix(0.2 + 0.5 * tone.width, now);
    },
    dispose() {
      chorus.sources.forEach((s) => s.stop());
      chorus.nodes.forEach((n) => n.disconnect());
    },
  };
}

/** Amp-style soft clipping for the bass. */
function bassBus(ctx: BaseAudioContext, assets: SharedAssets): InstrumentBus {
  const input = ctx.createGain();
  const shaper = ctx.createWaveShaper();
  const makeup = ctx.createGain();
  shaper.oversample = '2x';
  input.connect(shaper);
  shaper.connect(makeup);
  let current = -1;
  const set = (width: number) => {
    const idx = Math.min(
      assets.softClipCurves.length - 1,
      Math.floor(width * assets.softClipCurves.length)
    );
    if (idx !== current) {
      current = idx;
      shaper.curve = assets.softClipCurves[idx] as Float32Array<ArrayBuffer>;
    }
  };
  set(0.35);
  return {
    input,
    output: makeup,
    apply(tone) {
      set(tone.width);
    },
    dispose() {
      [input, shaper, makeup].forEach((n) => n.disconnect());
    },
  };
}

export function createInstrumentBus(
  ctx: BaseAudioContext,
  instrument: InstrumentId,
  assets: SharedAssets
): InstrumentBus {
  switch (instrument) {
    case 'epiano':
      return electricPianoBus(ctx);
    case 'synth':
      return synthBus(ctx);
    case 'organ':
      return organBus(ctx);
    case 'bass':
      return bassBus(ctx, assets);
    default:
      return plain(ctx);
  }
}
