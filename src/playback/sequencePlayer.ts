import type { AudioEngine, NoteHandle } from '../audio/engine';
import type { InstrumentId } from '../types/music';

export interface PlayerNote {
  midi: number;
  /** Beats from the start of the sequence. */
  start: number;
  /** Sounding length in beats. */
  duration: number;
  velocity: number;
  partId?: string;
  instrument?: InstrumentId;
}

export interface PlayerSequence {
  /** Must be sorted by start (then pitch). */
  notes: PlayerNote[];
  lengthBeats: number;
  /** Beats per minute at speed 1. */
  bpm: number;
  /** Longest note, in beats (for fast active-note lookup). */
  maxDuration: number;
}

export type PlayerState = 'stopped' | 'playing' | 'paused';

export interface PlayerOptions {
  engine: AudioEngine;
  getInstrument: () => InstrumentId;
  /** Seconds of audio scheduled ahead of the clock. */
  lookahead?: number;
  tickMs?: number;
}

/** Fraction of a note's written length that actually sounds (articulation). */
const GATE = 0.94;

interface Sounding {
  handle: NoteHandle;
  endBeat: number;
}

/**
 * Plays a PlayerSequence using the *audio clock* ("a tale of two clocks"):
 * a coarse timer wakes every few ms and schedules whatever falls inside a short
 * lookahead window with sample-accurate start times. Speed changes re-anchor
 * the timeline instead of restarting, and note ends are scheduled in beats so
 * they follow tempo changes too.
 */
export class SequencePlayer {
  private seq: PlayerSequence | null = null;
  private state: PlayerState = 'stopped';
  private speed = 1;
  private loop = false;
  private partFilter: (partId: string | undefined) => boolean = () => true;

  private anchorBeat = 0;
  private anchorTime = 0;
  private resumeBeat = 0;
  private cursor = 0;
  private sounding: Sounding[] = [];
  private segment: NoteHandle[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;

  private stateCbs = new Set<(s: PlayerState) => void>();
  private endCbs = new Set<() => void>();

  constructor(private readonly opts: PlayerOptions) {}

  /* ---------------- configuration ---------------- */

  load(seq: PlayerSequence): void {
    this.stop();
    this.seq = seq;
    this.resumeBeat = 0;
  }

  getSequence(): PlayerSequence | null {
    return this.seq;
  }

  setPartFilter(fn: (partId: string | undefined) => boolean): void {
    this.partFilter = fn;
  }

  setLoop(loop: boolean): void {
    this.loop = loop;
  }

  setSpeed(speed: number): void {
    const next = Math.max(0.1, Math.min(4, speed));
    if (this.state === 'playing') {
      const ctx = this.opts.engine.context;
      if (ctx) {
        const now = ctx.currentTime;
        this.anchorBeat = this.beatAt(now);
        this.anchorTime = now;
      }
    }
    this.speed = next;
  }

  getSpeed(): number {
    return this.speed;
  }

  getState(): PlayerState {
    return this.state;
  }

  onState(cb: (s: PlayerState) => void): () => void {
    this.stateCbs.add(cb);
    return () => this.stateCbs.delete(cb);
  }

  onEnd(cb: () => void): () => void {
    this.endCbs.add(cb);
    return () => this.endCbs.delete(cb);
  }

  /* ---------------- transport ---------------- */

  play(): void {
    const ctx = this.opts.engine.context ?? this.ensureContext();
    if (!this.seq || !ctx) return;
    if (this.state === 'playing') return;
    let from = this.resumeBeat;
    if (from >= this.seq.lengthBeats - 1e-6) from = 0;
    this.anchorBeat = from;
    this.anchorTime = ctx.currentTime + 0.06;
    this.cursor = this.firstIndexAtOrAfter(from - 1e-6);
    this.sounding = [];
    this.setState('playing');
    this.startTimer();
    this.tick();
  }

  pause(): void {
    if (this.state !== 'playing') return;
    this.resumeBeat = this.getPosition();
    this.releaseSounding();
    this.stopTimer();
    this.setState('paused');
  }

  stop(): void {
    const was = this.state;
    this.stopTimer();
    this.releaseSounding();
    this.resumeBeat = 0;
    if (was !== 'stopped') this.setState('stopped');
  }

  /** Jumps to a beat; keeps playing if it was playing. */
  seek(beat: number): void {
    if (!this.seq) return;
    const b = Math.max(0, Math.min(this.seq.lengthBeats, beat));
    if (this.state === 'playing') {
      this.releaseSounding();
      const ctx = this.opts.engine.context;
      if (!ctx) return;
      this.anchorBeat = b;
      this.anchorTime = ctx.currentTime + 0.05;
      this.cursor = this.firstIndexAtOrAfter(b - 1e-6);
    } else {
      this.resumeBeat = b;
    }
  }

  /** Audible position in beats (compensates for output latency). */
  getPosition(): number {
    if (!this.seq) return 0;
    if (this.state !== 'playing') return this.resumeBeat;
    const ctx = this.opts.engine.context;
    if (!ctx) return this.resumeBeat;
    const latency =
      (ctx as AudioContext).outputLatency ??
      (ctx as AudioContext).baseLatency ??
      0;
    let beat = this.beatAt(ctx.currentTime - latency);
    // Just after a loop wrap the audible position can still be a hair behind.
    if (this.loop && beat < 0) beat += this.seq.lengthBeats;
    return Math.max(0, Math.min(this.seq.lengthBeats, beat));
  }

  /* ---------------- follow-along helper (Learn mode) ---------------- */

  /**
   * Plays the notes starting in [fromBeat, toBeat) immediately, spaced at the
   * current tempo. Used to accompany a student who advances step by step.
   */
  playSegment(
    fromBeat: number,
    toBeat: number,
    filter: (n: PlayerNote) => boolean
  ): void {
    const seq = this.seq;
    const ctx = this.opts.engine.context ?? this.ensureContext();
    if (!seq || !ctx) return;
    const spb = 60 / (seq.bpm * this.speed);
    const t0 = ctx.currentTime + 0.01;
    this.pruneSegment();
    for (
      let i = this.firstIndexAtOrAfter(fromBeat - 1e-6);
      i < seq.notes.length && seq.notes[i].start < toBeat - 1e-6;
      i++
    ) {
      const n = seq.notes[i];
      if (!filter(n)) continue;
      const when = t0 + (n.start - fromBeat) * spb;
      const handle = this.opts.engine.noteOn({
        midi: n.midi,
        instrument: n.instrument ?? this.opts.getInstrument(),
        velocity: n.velocity,
        when,
        source: 'song',
      });
      handle.release(when + Math.max(0.05, n.duration * GATE * spb));
      this.segment.push(handle);
    }
  }

  private pruneSegment(): void {
    if (this.segment.length > 256) this.segment = this.segment.slice(-128);
  }

  /* ---------------- visuals ---------------- */

  /** Pitches sounding at `beat` (respecting the part filter). */
  activeAt(beat: number): Set<number> {
    const out = new Set<number>();
    const seq = this.seq;
    if (!seq) return out;
    const { notes } = seq;
    let lo = 0;
    let hi = notes.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (notes[mid].start <= beat) lo = mid + 1;
      else hi = mid;
    }
    const earliest = beat - seq.maxDuration;
    for (let i = lo - 1; i >= 0; i--) {
      const n = notes[i];
      if (n.start < earliest) break;
      if (beat < n.start + n.duration * GATE && this.partFilter(n.partId)) {
        out.add(n.midi);
      }
    }
    return out;
  }

  /** Seconds per beat at the current speed. */
  secondsPerBeat(): number {
    return this.seq ? 60 / (this.seq.bpm * this.speed) : 0.5;
  }

  /* ---------------- internals ---------------- */

  private ensureContext(): BaseAudioContext | null {
    return this.opts.engine.init();
  }

  private beatAt(time: number): number {
    return this.anchorBeat + (time - this.anchorTime) / this.secondsPerBeat();
  }

  private timeAt(beat: number): number {
    return this.anchorTime + (beat - this.anchorBeat) * this.secondsPerBeat();
  }

  private firstIndexAtOrAfter(beat: number): number {
    const notes = this.seq!.notes;
    let lo = 0;
    let hi = notes.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (notes[mid].start < beat) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  private startTimer(): void {
    this.stopTimer();
    this.timer = setInterval(() => this.tick(), this.opts.tickMs ?? 25);
  }

  private stopTimer(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private setState(s: PlayerState): void {
    if (this.state === s) return;
    this.state = s;
    this.stateCbs.forEach((cb) => cb(s));
  }

  private releaseSounding(): void {
    for (const s of this.sounding) s.handle.release();
    this.sounding = [];
    for (const h of this.segment) h.release();
    this.segment = [];
  }

  private tick(): void {
    const seq = this.seq;
    const ctx = this.opts.engine.context;
    if (!seq || !ctx || this.state !== 'playing') return;

    const hidden = typeof document !== 'undefined' && document.hidden;
    const lookahead = hidden ? 1.2 : (this.opts.lookahead ?? 0.14);
    const now = ctx.currentTime;
    const horizonBeat = this.beatAt(now + lookahead);

    // Note ends that fall inside the window.
    this.releaseDue(horizonBeat);

    // Note starts that fall inside the window.
    this.scheduleUpTo(horizonBeat, now);

    // Seamless loop: once everything is scheduled, shift the timeline back by
    // one length and keep scheduling from the top.
    if (
      this.loop &&
      this.cursor >= seq.notes.length &&
      horizonBeat >= seq.lengthBeats
    ) {
      this.anchorBeat -= seq.lengthBeats;
      for (const s of this.sounding) s.endBeat -= seq.lengthBeats;
      this.cursor = 0;
      const wrapped = this.beatAt(now + lookahead);
      this.releaseDue(wrapped);
      this.scheduleUpTo(wrapped, now);
    }

    // End of sequence: everything has been played and the tail has rung out.
    if (!this.loop && this.cursor >= seq.notes.length && this.sounding.length === 0) {
      const tailBeats = 0.5 / this.secondsPerBeat();
      if (this.beatAt(now) >= this.endBeat() + tailBeats) {
        this.stopTimer();
        this.resumeBeat = 0;
        this.setState('stopped');
        this.endCbs.forEach((cb) => cb());
      }
    }
  }

  private endBeat(): number {
    const seq = this.seq!;
    let end = seq.lengthBeats;
    for (const n of seq.notes) end = Math.max(end, n.start + n.duration);
    return end;
  }

  private releaseDue(horizonBeat: number): void {
    if (this.sounding.length === 0) return;
    const keep: Sounding[] = [];
    for (const s of this.sounding) {
      if (s.endBeat <= horizonBeat) s.handle.release(this.timeAt(s.endBeat));
      else keep.push(s);
    }
    this.sounding = keep;
  }

  private scheduleUpTo(horizonBeat: number, now: number): void {
    const seq = this.seq!;
    while (
      this.cursor < seq.notes.length &&
      seq.notes[this.cursor].start < horizonBeat
    ) {
      const n = seq.notes[this.cursor++];
      if (!this.partFilter(n.partId)) continue;
      const when = this.timeAt(n.start);
      if (when < now - 0.03) continue; // far too late; skip rather than smear
      const handle = this.opts.engine.noteOn({
        midi: n.midi,
        instrument: n.instrument ?? this.opts.getInstrument(),
        velocity: n.velocity,
        when,
        source: 'song',
      });
      const endBeat = n.start + Math.max(0.04, n.duration * GATE);
      if (endBeat <= horizonBeat) handle.release(this.timeAt(endBeat));
      else this.sounding.push({ handle, endBeat });
    }
  }
}

/** Builds a player sequence from a compiled Song. */
export function songToSequence(song: {
  notes: Array<{
    midi: number;
    start: number;
    duration: number;
    velocity: number;
    partId: string;
  }>;
  lengthBeats: number;
  bpm: number;
  maxDuration: number;
}): PlayerSequence {
  return {
    notes: song.notes.map((n) => ({
      midi: n.midi,
      start: n.start,
      duration: n.duration,
      velocity: n.velocity,
      partId: n.partId,
    })),
    lengthBeats: song.lengthBeats,
    bpm: song.bpm,
    maxDuration: song.maxDuration,
  };
}
