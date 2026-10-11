import type { InstrumentId, ToneParams } from '../types/music';
import {
  attackSeconds,
  getInstrumentPreset,
  releaseSeconds,
  resolveParams,
} from '../data/instruments';
import { midiToFrequency } from '../music/notes';
import { createSharedAssets, type SharedAssets } from './assets';
import { createInstrumentBus, type InstrumentBus } from './effects';
import { SampleBank, type LoadState } from './samples';
import {
  INSTRUMENT_TRANSPOSE,
  VOICE_FACTORIES,
  type VoiceImpl,
} from './voices';

/**
 * Who is playing: the person at the keyboard (affected by the sustain pedal)
 * or scheduled playback (songs, takes), which manages its own note lengths.
 */
export type SourceId = 'user' | 'song';

export interface NoteOnRequest {
  midi: number;
  instrument: InstrumentId;
  /** 0..1, default 0.75 */
  velocity?: number;
  /** AudioContext time to start at; defaults to "now". */
  when?: number;
  tone?: ToneParams;
  source?: SourceId;
}

export interface NoteHandle {
  readonly id: number;
  readonly midi: number;
  readonly instrument: InstrumentId;
  /**
   * Ends the note. With no argument the release happens now (and is held by
   * the sustain pedal for user notes); with a time it is scheduled exactly.
   */
  release(when?: number): void;
}

export interface EngineOptions {
  /** Inject a context (e.g. an OfflineAudioContext for rendering/tests). */
  context?: BaseAudioContext;
  sampleBaseUrl?: string;
  maxVoices?: number;
}

type VoiceState = 'held' | 'sustained' | 'releasing';

interface Voice {
  id: number;
  midi: number;
  instrument: InstrumentId;
  source: SourceId;
  impl: VoiceImpl;
  state: VoiceState;
  startAt: number;
}

/**
 * Per-instrument output trim, set by loudness measurement
 * (see tests/e2e/audio-render.spec.ts) so presets sit at similar levels.
 */
export const INSTRUMENT_TRIM: Record<InstrumentId, number> = {
  piano: 2.6,
  epiano: 0.6,
  synth: 0.97,
  bass: 0.22,
  chiptune: 0.94,
  organ: 0.88,
};

interface BusEntry {
  bus: InstrumentBus;
  trim: GainNode;
  send: GainNode;
}

const NOOP_HANDLE = (midi: number, instrument: InstrumentId): NoteHandle => ({
  id: 0,
  midi,
  instrument,
  release() {},
});

export class AudioEngine {
  private ctx: BaseAudioContext | null = null;
  private readonly injected: boolean;
  private assets: SharedAssets | null = null;
  private readonly samples = new SampleBank();
  private readonly sampleBaseUrl: string;
  private readonly maxVoices: number;

  private masterIn: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private analyser: AnalyserNode | null = null;
  private reverbIn: GainNode | null = null;

  private buses = new Map<InstrumentId, BusEntry>();
  private tones: Partial<Record<InstrumentId, ToneParams>> = {};
  private voices = new Map<number, Voice>();
  private nextId = 1;
  private pedalDown = false;
  private masterVolume = 0.8;
  private loadListeners = new Set<(s: LoadState) => void>();

  constructor(opts: EngineOptions = {}) {
    this.ctx = opts.context ?? null;
    this.injected = !!opts.context;
    this.maxVoices = opts.maxVoices ?? 48;
    const base =
      (typeof import.meta !== 'undefined' &&
        (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL) ||
      '/';
    this.sampleBaseUrl = opts.sampleBaseUrl ?? `${base}samples/piano/`;
  }

  /* ---------------- context + graph ---------------- */

  get context(): BaseAudioContext | null {
    return this.ctx;
  }

  /** True when Web Audio is available in this environment. */
  isSupported(): boolean {
    if (this.ctx) return true;
    return typeof window !== 'undefined' && !!this.audioContextCtor();
  }

  private audioContextCtor(): typeof AudioContext | undefined {
    if (typeof window === 'undefined') return undefined;
    return (
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    );
  }

  /** Creates the context and master graph on first use. */
  init(): BaseAudioContext | null {
    return this.ensure();
  }

  private ensure(): BaseAudioContext | null {
    if (this.ctx && this.masterIn) return this.ctx;
    if (!this.ctx) {
      const Ctor = this.audioContextCtor();
      if (!Ctor) return null;
      this.ctx = new Ctor({ latencyHint: 'interactive' });
    }
    this.buildMaster(this.ctx);
    return this.ctx;
  }

  private buildMaster(ctx: BaseAudioContext): void {
    this.assets = createSharedAssets(ctx);

    this.masterIn = ctx.createGain();
    this.limiter = ctx.createDynamicsCompressor();
    // Transparent peak control: only the loudest chords reach the knee.
    this.limiter.threshold.value = -9;
    this.limiter.knee.value = 8;
    this.limiter.ratio.value = 10;
    this.limiter.attack.value = 0.002;
    this.limiter.release.value = 0.16;
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = this.taper(this.masterVolume);
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.8;

    this.masterIn.connect(this.limiter);
    this.limiter.connect(this.masterGain);
    this.masterGain.connect(this.analyser);
    this.analyser.connect(ctx.destination);

    // Shared reverb
    this.reverbIn = ctx.createGain();
    const convolver = ctx.createConvolver();
    convolver.buffer = this.assets.impulse;
    const ret = ctx.createGain();
    ret.gain.value = 0.9;
    this.reverbIn.connect(convolver);
    convolver.connect(ret);
    ret.connect(this.masterIn);
  }

  private taper(v: number): number {
    return Math.pow(Math.max(0, Math.min(1, v)), 1.7);
  }

  private busFor(instrument: InstrumentId): BusEntry {
    const existing = this.buses.get(instrument);
    if (existing) return existing;
    const ctx = this.ctx!;
    const bus = createInstrumentBus(ctx, instrument, this.assets!);
    const trim = ctx.createGain();
    trim.gain.value = INSTRUMENT_TRIM[instrument];
    const send = ctx.createGain();
    send.gain.value = 0;
    trim.connect(bus.input);
    bus.output.connect(this.masterIn!);
    bus.output.connect(send);
    send.connect(this.reverbIn!);
    const entry = { bus, trim, send };
    this.buses.set(instrument, entry);
    this.applyTone(instrument, entry);
    return entry;
  }

  private applyTone(instrument: InstrumentId, entry: BusEntry): void {
    const ctx = this.ctx!;
    const tone = resolveParams(instrument, this.tones[instrument]);
    const now = ctx.currentTime;
    entry.send.gain.setTargetAtTime(tone.reverb * 0.85, now, 0.03);
    entry.bus.apply(tone, now);
  }

  /* ---------------- public controls ---------------- */

  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  /** Call from a user gesture: starts/resumes audio output. */
  async resume(): Promise<void> {
    const ctx = this.ensure();
    if (ctx && 'resume' in ctx && ctx.state === 'suspended') {
      try {
        await (ctx as AudioContext).resume();
      } catch {
        /* needs another gesture */
      }
    }
  }

  setMasterVolume(volume: number): void {
    this.masterVolume = volume;
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(
        this.taper(volume),
        this.ctx.currentTime,
        0.02
      );
    }
  }

  /** Stores tone controls for an instrument and applies bus-level changes live. */
  setTone(instrument: InstrumentId, tone: ToneParams): void {
    this.tones[instrument] = tone;
    const entry = this.buses.get(instrument);
    if (entry && this.ctx) this.applyTone(instrument, entry);
  }

  setPedal(down: boolean): void {
    if (this.pedalDown === down) return;
    this.pedalDown = down;
    if (down) return;
    for (const v of Array.from(this.voices.values())) {
      if (v.state === 'sustained') this.releaseVoice(v);
    }
  }

  isPedalDown(): boolean {
    return this.pedalDown;
  }

  /* ---------------- samples ---------------- */

  getLoadState(): LoadState {
    return this.samples.getState();
  }

  onLoadState(cb: (s: LoadState) => void): () => void {
    this.loadListeners.add(cb);
    return () => this.loadListeners.delete(cb);
  }

  private emitLoad(): void {
    const s = this.samples.getState();
    this.loadListeners.forEach((cb) => cb(s));
  }

  /**
   * Fetches and decodes the piano samples. Safe to call repeatedly; decoding
   * works on a suspended or offline context so it can start before any click.
   */
  loadSamples(): Promise<void> {
    if (this.samples.getState() !== 'idle') return Promise.resolve();
    let decoder: BaseAudioContext | null = this.ctx;
    if (!decoder) {
      if (typeof OfflineAudioContext !== 'undefined') {
        decoder = new OfflineAudioContext(2, 1, 48000);
      } else {
        decoder = this.ensure();
      }
    }
    if (!decoder) return Promise.resolve();
    this.emitLoad();
    return this.samples
      .load(decoder, this.sampleBaseUrl)
      .then(() => this.emitLoad())
      .catch(() => this.emitLoad());
  }

  /* ---------------- notes ---------------- */

  noteOn(req: NoteOnRequest): NoteHandle {
    const ctx = this.ensure();
    if (!ctx || !this.assets) return NOOP_HANDLE(req.midi, req.instrument);

    const instrument = req.instrument;
    const preset = getInstrumentPreset(instrument);
    const source = req.source ?? 'user';
    const tone = resolveParams(instrument, req.tone ?? this.tones[instrument]);
    const now = ctx.currentTime;
    const when = Math.max(req.when ?? now, now);
    const velocity = Math.max(0.03, Math.min(1, req.velocity ?? 0.75));

    // Re-striking a key that is still ringing damps the old note quickly.
    for (const v of this.voices.values()) {
      if (
        v.midi === req.midi &&
        v.instrument === instrument &&
        v.source === source &&
        v.state !== 'releasing'
      ) {
        v.state = 'releasing';
        v.impl.kill(when, 0.06);
      }
    }

    if (this.voices.size >= this.maxVoices) this.stealVoice(when);

    const entry = this.busFor(instrument);
    const sounding = req.midi + INSTRUMENT_TRANSPOSE[instrument];
    const impl = VOICE_FACTORIES[instrument](
      {
        ctx,
        out: entry.trim,
        assets: this.assets,
        samples: this.samples,
      },
      {
        midi: sounding,
        freq: midiToFrequency(sounding),
        velocity,
        when,
        tone: {
          brightness: tone.brightness,
          attack: attackSeconds(instrument, tone),
          release: releaseSeconds(instrument, tone),
          width: tone.width,
        },
      }
    );
    void preset;

    const id = this.nextId++;
    const voice: Voice = {
      id,
      midi: req.midi,
      instrument,
      source,
      impl,
      state: 'held',
      startAt: when,
    };
    this.voices.set(id, voice);
    impl.onEnded = () => {
      this.voices.delete(id);
    };

    return {
      id,
      midi: req.midi,
      instrument,
      release: (at?: number) => this.releaseVoice(voice, at),
    };
  }

  private releaseVoice(voice: Voice, when?: number): void {
    if (voice.state === 'releasing') return;
    const ctx = this.ctx;
    if (!ctx) return;
    if (voice.source === 'user' && this.pedalDown && when === undefined) {
      voice.state = 'sustained';
      return;
    }
    voice.state = 'releasing';
    const t = when === undefined ? ctx.currentTime : Math.max(when, ctx.currentTime);
    voice.impl.release(t);
  }

  private stealVoice(at: number): void {
    let victim: Voice | null = null;
    for (const v of this.voices.values()) {
      const rank = v.state === 'releasing' ? 0 : v.state === 'sustained' ? 1 : 2;
      const best = victim
        ? victim.state === 'releasing'
          ? 0
          : victim.state === 'sustained'
            ? 1
            : 2
        : 99;
      if (rank < best || (rank === best && v.startAt < victim!.startAt)) {
        victim = v;
      }
    }
    if (victim) {
      victim.state = 'releasing';
      victim.impl.kill(at, 0.03);
      this.voices.delete(victim.id);
    }
  }

  /** Gracefully releases every held/sustained note of a source. */
  releaseAll(source?: SourceId): void {
    for (const v of Array.from(this.voices.values())) {
      if (!source || v.source === source) this.releaseVoice(v, undefined);
    }
  }

  /** Immediately silences everything (with a few-ms fade to avoid clicks). */
  stopAll(): void {
    const ctx = this.ctx;
    const now = ctx ? ctx.currentTime : 0;
    for (const v of this.voices.values()) {
      v.state = 'releasing';
      v.impl.kill(now, 0.02);
    }
    this.voices.clear();
    this.pedalDown = false;
  }

  /* ---------------- introspection ---------------- */

  getVoiceCount(): number {
    return this.voices.size;
  }

  getActiveMidis(source?: SourceId): number[] {
    const out: number[] = [];
    for (const v of this.voices.values()) {
      if (v.state !== 'releasing' && (!source || v.source === source)) {
        out.push(v.midi);
      }
    }
    return out;
  }

  /** Sampler readiness for the piano preset (true once decoded). */
  isPianoReady(): boolean {
    return this.samples.isReady();
  }

  dispose(): void {
    this.stopAll();
    for (const entry of this.buses.values()) entry.bus.dispose();
    this.buses.clear();
    if (this.ctx && !this.injected && 'close' in this.ctx) {
      void (this.ctx as AudioContext).close();
    }
    this.ctx = this.injected ? this.ctx : null;
  }
}

export const audioEngine = new AudioEngine();
