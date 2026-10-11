import { getNoteFrequency } from '../data/keyboardMap';
import { getInstrumentPreset } from '../data/instruments';
import { InstrumentId, SynthParams } from '../types/music';

interface ActiveVoice {
  midi: number;
  instrument: InstrumentId;
  oscillators: OscillatorNode[];
  gains: GainNode[];
  masterVoiceGain: GainNode;
  filter: BiquadFilterNode;
  peakGain: number;
  releaseDuration: number;
  heldByKey: boolean;
  heldBySustain: boolean;
  cleanupTimer?: ReturnType<typeof setTimeout>;
  oscillatorTypes: OscillatorType[];
}

export interface VoiceInspection {
  midi: number;
  frequency: number;
  instrument: InstrumentId;
  oscillatorTypes: OscillatorType[];
  oscillatorCount: number;
  filterCutoff: number;
  filterQ: number;
  attack: number;
  release: number;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private dryGain: GainNode | null = null;
  private reverbGain: GainNode | null = null;
  private convolver: ConvolverNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private analyser: AnalyserNode | null = null;

  private activeVoices = new Map<number, ActiveVoice>();
  private releasingVoices = new Set<ActiveVoice>();
  private sustainEnabled = false;
  private lastVoiceInspection: VoiceInspection | null = null;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return null;

      this.ctx = new AudioCtx();
      this.setupMasterChain(this.ctx);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {
        // Ignore autoplay restrictions until user gesture
      });
    }

    return this.ctx;
  }

  private setupMasterChain(ctx: AudioContext): void {
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 0.88;

    this.dryGain = ctx.createGain();
    this.dryGain.gain.value = 0.85;

    this.reverbGain = ctx.createGain();
    this.reverbGain.gain.value = 0.25;

    this.compressor = ctx.createDynamicsCompressor();
    if (this.compressor.threshold) {
      this.compressor.threshold.value = -14;
      this.compressor.knee.value = 16;
      this.compressor.ratio.value = 3.5;
      this.compressor.attack.value = 0.003;
      this.compressor.release.value = 0.18;
    }

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.82;

    try {
      this.convolver = ctx.createConvolver();
      this.convolver.buffer = this.createImpulseResponse(ctx, 1.7, 2.8);
      this.reverbGain.connect(this.convolver);
      this.convolver.connect(this.compressor);
    } catch {
      this.reverbGain.connect(this.compressor);
    }

    this.dryGain.connect(this.compressor);
    this.compressor.connect(this.masterGain);
    this.masterGain.connect(this.analyser);
    this.analyser.connect(ctx.destination);
  }

  private createImpulseResponse(
    ctx: AudioContext,
    durationSeconds: number,
    decayRate: number
  ): AudioBuffer {
    const sampleRate = ctx.sampleRate || 44100;
    const length = Math.floor(sampleRate * durationSeconds);
    const impulse = ctx.createBuffer(2, length, sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const channelData = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        const env = Math.pow(1 - i / length, decayRate);
        channelData[i] = (Math.random() * 2 - 1) * env * 0.45;
      }
    }
    return impulse;
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  public getActiveMidiNotes(): number[] {
    return Array.from(this.activeVoices.keys());
  }

  public getLastVoiceInspection(): VoiceInspection | null {
    return this.lastVoiceInspection;
  }

  public setSustain(enabled: boolean): void {
    this.sustainEnabled = enabled;
    if (!enabled) {
      for (const [midi, voice] of this.activeVoices.entries()) {
        if (!voice.heldByKey && voice.heldBySustain) {
          this.releaseVoice(midi, voice);
        }
      }
    }
  }

  public isSustainEnabled(): boolean {
    return this.sustainEnabled;
  }

  /**
   * Updates live synthesis parameters on currently active voices so slider adjustments
   * are audible immediately while holding notes or chords.
   */
  public updateActiveParams(params: SynthParams): void {
    if (!this.ctx || !this.dryGain || !this.reverbGain) return;
    const now = this.ctx.currentTime;

    this.reverbGain.gain.setTargetAtTime(params.reverbMix, now, 0.02);
    this.dryGain.gain.setTargetAtTime(
      Math.max(0.45, 1 - params.reverbMix * 0.4),
      now,
      0.02
    );

    for (const voice of this.activeVoices.values()) {
      voice.releaseDuration = params.release;
      try {
        voice.filter.frequency.setTargetAtTime(params.filterCutoff, now, 0.03);
      } catch {
        // Ignore in mock contexts
      }
    }
  }

  public noteOn(
    midi: number,
    instrument: InstrumentId,
    customParams?: Partial<SynthParams>,
    velocity = 0.85
  ): VoiceInspection {
    const preset = getInstrumentPreset(instrument);
    const params: SynthParams = {
      ...preset.defaultParams,
      ...customParams,
    };

    const freq = getNoteFrequency(midi);
    const existing = this.activeVoices.get(midi);
    if (existing) {
      this.activeVoices.delete(midi);
      this.fadeOutVoiceQuickly(existing);
    }

    const ctx = this.ensureContext();
    const oscTypesForInstrument =
      this.getInstrumentOscillatorSignature(instrument);
    const filterQ = this.getInstrumentFilterQ(instrument);

    const inspection: VoiceInspection = {
      midi,
      frequency: freq,
      instrument,
      oscillatorTypes: oscTypesForInstrument,
      oscillatorCount: oscTypesForInstrument.length,
      filterCutoff: params.filterCutoff,
      filterQ,
      attack: params.attack,
      release: params.release,
    };
    this.lastVoiceInspection = inspection;

    if (!ctx || !this.dryGain || !this.reverbGain) {
      return inspection;
    }

    const now = ctx.currentTime;
    this.reverbGain.gain.setTargetAtTime(params.reverbMix, now, 0.015);
    this.dryGain.gain.setTargetAtTime(
      Math.max(0.45, 1 - params.reverbMix * 0.4),
      now,
      0.015
    );

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.setValueAtTime(filterQ, now);

    const masterVoiceGain = ctx.createGain();
    const peakGain = Math.max(
      0.02,
      Math.min(0.95, params.volume * velocity * 0.42)
    );
    const attackSec = Math.max(0.003, params.attack);

    masterVoiceGain.gain.setValueAtTime(0.0001, now);
    masterVoiceGain.gain.linearRampToValueAtTime(peakGain, now + attackSec);

    const oscillators: OscillatorNode[] = [];
    const gains: GainNode[] = [masterVoiceGain];

    this.buildInstrumentGraph(
      ctx,
      now,
      instrument,
      freq,
      params,
      peakGain,
      attackSec,
      filter,
      masterVoiceGain,
      oscillators,
      gains
    );

    filter.connect(masterVoiceGain);
    masterVoiceGain.connect(this.dryGain);
    masterVoiceGain.connect(this.reverbGain);

    for (const osc of oscillators) {
      osc.start(now);
    }

    const voice: ActiveVoice = {
      midi,
      instrument,
      oscillators,
      gains,
      masterVoiceGain,
      filter,
      peakGain,
      releaseDuration: params.release,
      heldByKey: true,
      heldBySustain: false,
      oscillatorTypes: oscTypesForInstrument,
    };

    this.activeVoices.set(midi, voice);
    return inspection;
  }

  private getInstrumentOscillatorSignature(
    instrument: InstrumentId
  ): OscillatorType[] {
    switch (instrument) {
      case 'piano':
        return ['triangle', 'sine', 'sine'];
      case 'synth':
        return ['sawtooth', 'sawtooth', 'triangle'];
      case 'epiano':
        return ['sine', 'triangle', 'sine'];
      case 'bass':
        return ['sawtooth', 'square'];
      case 'chiptune':
        return ['square', 'triangle'];
      case 'organ':
        return ['sine', 'triangle', 'sine', 'sine'];
    }
  }

  private getInstrumentFilterQ(instrument: InstrumentId): number {
    switch (instrument) {
      case 'piano':
        return 1.1;
      case 'synth':
        return 3.2;
      case 'epiano':
        return 1.4;
      case 'bass':
        return 4.8;
      case 'chiptune':
        return 1.0;
      case 'organ':
        return 0.85;
    }
  }

  private buildInstrumentGraph(
    ctx: AudioContext,
    now: number,
    instrument: InstrumentId,
    freq: number,
    params: SynthParams,
    peakGain: number,
    attackSec: number,
    filter: BiquadFilterNode,
    masterVoiceGain: GainNode,
    oscillators: OscillatorNode[],
    gains: GainNode[]
  ): void {
    switch (instrument) {
      case 'piano': {
        // Warm triangle fundamental + 2nd harmonic sine + 4th harmonic hammer chime
        const osc1 = ctx.createOscillator();
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(freq, now);
        osc1.detune.setValueAtTime(-params.detune * 0.4, now);
        const g1 = ctx.createGain();
        g1.gain.setValueAtTime(0.68, now);

        const osc2 = ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(freq * 2, now);
        osc2.detune.setValueAtTime(params.detune * 0.4, now);
        const g2 = ctx.createGain();
        g2.gain.setValueAtTime(0.28, now);
        g2.gain.exponentialRampToValueAtTime(0.03, now + 0.65);

        const osc3 = ctx.createOscillator();
        osc3.type = 'sine';
        osc3.frequency.setValueAtTime(Math.min(12000, freq * 4), now);
        const g3 = ctx.createGain();
        g3.gain.setValueAtTime(0.14, now);
        g3.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

        osc1.connect(g1);
        g1.connect(filter);
        osc2.connect(g2);
        g2.connect(filter);
        osc3.connect(g3);
        g3.connect(filter);

        filter.frequency.setValueAtTime(
          Math.min(14000, params.filterCutoff * 1.5),
          now
        );
        filter.frequency.exponentialRampToValueAtTime(
          Math.max(350, params.filterCutoff * 0.6),
          now + 1.2
        );

        masterVoiceGain.gain.exponentialRampToValueAtTime(
          Math.max(0.005, peakGain * 0.38),
          now + attackSec + 1.8
        );

        oscillators.push(osc1, osc2, osc3);
        gains.push(g1, g2, g3);
        break;
      }

      case 'synth': {
        // Balanced dual detuned sawtooths + sub triangle + smooth resonant filter sweep
        const osc1 = ctx.createOscillator();
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(freq, now);
        osc1.detune.setValueAtTime(-params.detune, now);
        const g1 = ctx.createGain();
        g1.gain.setValueAtTime(0.38, now);

        const osc2 = ctx.createOscillator();
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(freq, now);
        osc2.detune.setValueAtTime(params.detune, now);
        const g2 = ctx.createGain();
        g2.gain.setValueAtTime(0.38, now);

        const oscSub = ctx.createOscillator();
        oscSub.type = 'triangle';
        oscSub.frequency.setValueAtTime(freq * 0.5, now);
        const subGain = ctx.createGain();
        subGain.gain.setValueAtTime(0.28, now);

        osc1.connect(g1);
        g1.connect(filter);
        osc2.connect(g2);
        g2.connect(filter);
        oscSub.connect(subGain);
        subGain.connect(filter);

        filter.frequency.setValueAtTime(
          Math.max(250, params.filterCutoff * 0.45),
          now
        );
        filter.frequency.exponentialRampToValueAtTime(
          Math.min(14000, params.filterCutoff * 1.75),
          now + Math.max(0.04, attackSec * 2.0)
        );
        filter.frequency.exponentialRampToValueAtTime(
          Math.max(300, params.filterCutoff),
          now + Math.max(0.08, attackSec * 2.0) + 0.45
        );

        oscillators.push(osc1, osc2, oscSub);
        gains.push(g1, g2, subGain);
        break;
      }

      case 'epiano': {
        // Rhodes electric piano: fundamental sine + warm 2nd triangle + bell tine transient
        const osc1 = ctx.createOscillator();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(freq, now);
        const g1 = ctx.createGain();
        g1.gain.setValueAtTime(0.68, now);

        const osc2 = ctx.createOscillator();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(freq * 2, now);
        osc2.detune.setValueAtTime(params.detune, now);
        const g2 = ctx.createGain();
        g2.gain.setValueAtTime(0.2, now);

        const tineOsc = ctx.createOscillator();
        tineOsc.type = 'sine';
        tineOsc.frequency.setValueAtTime(Math.min(11000, freq * 5), now);
        const tineGain = ctx.createGain();
        tineGain.gain.setValueAtTime(0.22, now);
        tineGain.gain.exponentialRampToValueAtTime(0.002, now + 0.24);

        osc1.connect(g1);
        g1.connect(filter);
        osc2.connect(g2);
        g2.connect(filter);
        tineOsc.connect(tineGain);
        tineGain.connect(filter);

        filter.frequency.setValueAtTime(params.filterCutoff, now);

        oscillators.push(osc1, osc2, tineOsc);
        gains.push(g1, g2, tineGain);
        break;
      }

      case 'bass': {
        // Funk Synth Bass: Sawtooth + sub-octave Square + snappy resonant filter pluck
        const oscSaw = ctx.createOscillator();
        oscSaw.type = 'sawtooth';
        oscSaw.frequency.setValueAtTime(freq * 0.5, now);
        oscSaw.detune.setValueAtTime(-params.detune * 0.5, now);
        const sawGain = ctx.createGain();
        sawGain.gain.setValueAtTime(0.48, now);

        const oscSub = ctx.createOscillator();
        oscSub.type = 'square';
        oscSub.frequency.setValueAtTime(freq * 0.25, now);
        const subGain = ctx.createGain();
        subGain.gain.setValueAtTime(0.4, now);

        oscSaw.connect(sawGain);
        sawGain.connect(filter);
        oscSub.connect(subGain);
        subGain.connect(filter);

        filter.frequency.setValueAtTime(
          Math.min(9000, params.filterCutoff * 2.6),
          now
        );
        filter.frequency.exponentialRampToValueAtTime(
          Math.max(180, params.filterCutoff * 0.36),
          now + 0.16
        );

        oscillators.push(oscSaw, oscSub);
        gains.push(sawGain, subGain);
        break;
      }

      case 'chiptune': {
        // 8-Bit Console: Gain-balanced Square main + Triangle sub + Pitch vibrato LFO
        const oscSquare = ctx.createOscillator();
        oscSquare.type = 'square';
        oscSquare.frequency.setValueAtTime(freq, now);
        const sqGain = ctx.createGain();
        sqGain.gain.setValueAtTime(0.42, now);

        const oscTri = ctx.createOscillator();
        oscTri.type = 'triangle';
        oscTri.frequency.setValueAtTime(freq * 0.5, now);
        const triGain = ctx.createGain();
        triGain.gain.setValueAtTime(0.32, now);

        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(6.2, now);
        const lfoGain = ctx.createGain();
        lfoGain.gain.setValueAtTime(params.detune * 1.4 + 5, now);
        lfo.connect(lfoGain);
        lfoGain.connect(oscSquare.detune);

        oscSquare.connect(sqGain);
        sqGain.connect(filter);
        oscTri.connect(triGain);
        triGain.connect(filter);

        filter.frequency.setValueAtTime(params.filterCutoff, now);

        oscillators.push(oscSquare, oscTri, lfo);
        gains.push(sqGain, triGain, lfoGain);
        break;
      }

      case 'organ': {
        // Cathedral Additive Drawbar Organ: 0.5x, 1x, 1.498x, 2x harmonics
        const ratios = [0.5, 1, 1.498, 2];
        const types: OscillatorType[] = ['sine', 'triangle', 'sine', 'sine'];
        const levels = [0.28, 0.42, 0.18, 0.22];

        ratios.forEach((ratio, idx) => {
          const osc = ctx.createOscillator();
          osc.type = types[idx];
          osc.frequency.setValueAtTime(freq * ratio, now);
          osc.detune.setValueAtTime(
            (idx % 2 === 0 ? 1 : -1) * params.detune * 0.6,
            now
          );
          const g = ctx.createGain();
          g.gain.setValueAtTime(levels[idx], now);
          osc.connect(g);
          g.connect(filter);
          oscillators.push(osc);
          gains.push(g);
        });

        filter.frequency.setValueAtTime(params.filterCutoff, now);
        break;
      }
    }
  }

  public noteOff(midi: number): void {
    const voice = this.activeVoices.get(midi);
    if (!voice) return;

    voice.heldByKey = false;
    if (this.sustainEnabled) {
      voice.heldBySustain = true;
      return;
    }

    this.releaseVoice(midi, voice);
  }

  private fadeOutVoiceQuickly(voice: ActiveVoice): void {
    if (!this.ctx) {
      this.disposeVoiceImmediate(voice);
      return;
    }

    const now = this.ctx.currentTime;
    try {
      const currentVal = Math.max(
        0.0001,
        voice.masterVoiceGain.gain.value || voice.peakGain * 0.5
      );
      voice.masterVoiceGain.gain.cancelScheduledValues(now);
      voice.masterVoiceGain.gain.setValueAtTime(currentVal, now);
      voice.masterVoiceGain.gain.linearRampToValueAtTime(0.0001, now + 0.015);
    } catch {
      // Ignore in mock contexts
    }

    this.releasingVoices.add(voice);
    voice.cleanupTimer = setTimeout(() => {
      this.releasingVoices.delete(voice);
      this.disposeVoiceImmediate(voice);
    }, 25);
  }

  private releaseVoice(midi: number, voice: ActiveVoice): void {
    this.activeVoices.delete(midi);

    if (!this.ctx) {
      this.disposeVoiceImmediate(voice);
      return;
    }

    const now = this.ctx.currentTime;
    const releaseSec = Math.max(0.02, Math.min(2.5, voice.releaseDuration));

    try {
      // Read live interpolated value BEFORE cancelScheduledValues to avoid Firefox/WebAudio snap
      const liveValue = voice.masterVoiceGain.gain.value;
      const currentVal = Math.max(
        0.0001,
        liveValue > 0.001 ? liveValue : voice.peakGain * 0.5
      );
      voice.masterVoiceGain.gain.cancelScheduledValues(now);
      voice.masterVoiceGain.gain.setValueAtTime(currentVal, now);
      voice.masterVoiceGain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + releaseSec
      );
    } catch {
      // Fallback for mocked GainNodes in unit tests
    }

    this.releasingVoices.add(voice);
    voice.cleanupTimer = setTimeout(() => {
      this.releasingVoices.delete(voice);
      this.disposeVoiceImmediate(voice);
    }, releaseSec * 1000 + 40);
  }

  private disposeVoiceImmediate(voice: ActiveVoice): void {
    if (voice.cleanupTimer) {
      clearTimeout(voice.cleanupTimer);
    }
    for (const osc of voice.oscillators) {
      try {
        osc.stop();
        osc.disconnect();
      } catch {
        // Ignore already stopped oscillators
      }
    }
    for (const gain of voice.gains) {
      try {
        gain.disconnect();
      } catch {
        // Ignore already disconnected nodes
      }
    }
    try {
      voice.filter.disconnect();
    } catch {
      // Ignore
    }
  }

  /**
   * Immediately silences all playing and releasing voices to prevent stuck notes.
   */
  public stopAllNotes(): void {
    for (const voice of this.activeVoices.values()) {
      this.disposeVoiceImmediate(voice);
    }
    this.activeVoices.clear();

    for (const voice of this.releasingVoices.values()) {
      this.disposeVoiceImmediate(voice);
    }
    this.releasingVoices.clear();
  }
}

export const audioEngine = new AudioEngine();
