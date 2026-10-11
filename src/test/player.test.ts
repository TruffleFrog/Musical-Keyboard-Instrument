import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AudioEngine } from '../audio/engine';
import {
  SequencePlayer,
  type PlayerNote,
  type PlayerSequence,
} from '../playback/sequencePlayer';

interface Call {
  midi: number;
  when: number;
  velocity: number;
  releasedAt: number | 'now' | null;
}

function fake() {
  let now = 0;
  const calls: Call[] = [];
  const ctx = {
    get currentTime() {
      return now;
    },
  };
  const engine = {
    context: ctx,
    init: () => ctx,
    noteOn(req: { midi: number; when?: number; velocity?: number }) {
      const call: Call = {
        midi: req.midi,
        when: req.when ?? now,
        velocity: req.velocity ?? 0.75,
        releasedAt: null,
      };
      calls.push(call);
      return {
        id: calls.length,
        midi: req.midi,
        instrument: 'piano' as const,
        release(at?: number) {
          call.releasedAt = at === undefined ? 'now' : at;
        },
      };
    },
  } as unknown as AudioEngine;
  return {
    engine,
    calls,
    set now(v: number) {
      now = v;
    },
    get now() {
      return now;
    },
    /** Advance the audio clock and fire the scheduler timer. */
    step(seconds: number) {
      now += seconds;
      vi.advanceTimersByTime(25);
    },
    run(seconds: number, dt = 0.025) {
      for (let t = 0; t < seconds - 1e-9; t += dt) {
        now += dt;
        vi.advanceTimersByTime(25);
      }
    },
  };
}

function seq(notes: PlayerNote[], lengthBeats: number, bpm = 120): PlayerSequence {
  const sorted = [...notes].sort((a, b) => a.start - b.start || a.midi - b.midi);
  return {
    notes: sorted,
    lengthBeats,
    bpm,
    maxDuration: Math.max(...notes.map((n) => n.duration)),
  };
}
const n = (midi: number, start: number, duration = 1, partId = 'a'): PlayerNote => ({
  midi,
  start,
  duration,
  velocity: 0.7,
  partId,
});

describe('SequencePlayer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const make = (f: ReturnType<typeof fake>) =>
    new SequencePlayer({ engine: f.engine, getInstrument: () => 'piano' });

  it('schedules chord notes at one identical, future audio time', () => {
    const f = fake();
    const p = make(f);
    p.load(seq([n(60, 0), n(64, 0), n(67, 0), n(48, 0, 4, 'b')], 4));
    p.play();
    expect(f.calls).toHaveLength(4);
    const whens = new Set(f.calls.map((c) => c.when.toFixed(6)));
    expect(whens.size).toBe(1);
    expect(f.calls[0].when).toBeGreaterThan(f.now);
  });

  it('only schedules inside the lookahead window', () => {
    const f = fake();
    const p = make(f);
    p.load(seq([n(60, 0), n(62, 4), n(64, 8)], 12)); // 0 s, 2 s, 4 s at 120 BPM
    p.play();
    expect(f.calls.map((c) => c.midi)).toEqual([60]);
    f.run(1.8);
    expect(f.calls.map((c) => c.midi)).toEqual([60]); // 2 s note not yet in window
    f.run(0.3);
    expect(f.calls.map((c) => c.midi)).toEqual([60, 62]);
    f.run(2);
    expect(f.calls.map((c) => c.midi)).toEqual([60, 62, 64]);
  });

  it('times notes from the tempo (beats -> seconds)', () => {
    const f = fake();
    const p = make(f);
    p.load(seq([n(60, 0), n(62, 1), n(64, 2)], 3, 60)); // 1 beat = 1 s
    p.play();
    f.run(2.5);
    const t0 = f.calls[0].when;
    expect(f.calls[1].when - t0).toBeCloseTo(1, 5);
    expect(f.calls[2].when - t0).toBeCloseTo(2, 5);
  });

  it('releases notes shortly before their written length', () => {
    const f = fake();
    const p = make(f);
    p.load(seq([n(60, 0, 2)], 4, 60));
    p.play();
    f.run(2.5);
    const c = f.calls[0];
    expect(typeof c.releasedAt).toBe('number');
    expect((c.releasedAt as number) - c.when).toBeGreaterThan(1.5);
    expect((c.releasedAt as number) - c.when).toBeLessThan(2);
  });

  it('keeps following the same timeline when the speed changes', () => {
    const f = fake();
    const p = make(f);
    p.load(seq([n(60, 0), n(62, 2), n(64, 4)], 6, 60));
    p.play();
    f.run(1); // now ~1 beat in
    const pos = p.getPosition();
    p.setSpeed(2);
    expect(p.getPosition()).toBeCloseTo(pos, 1);
    f.run(1.6);
    // remaining 3 beats at 2x: note at beat 2 sounds ~0.5 s after the change
    const second = f.calls.find((c) => c.midi === 62)!;
    expect(second.when).toBeLessThan(2.2);
    const third = f.calls.find((c) => c.midi === 64);
    expect(third).toBeDefined();
    expect(third!.when - second.when).toBeCloseTo(1, 1); // 2 beats at 2x = 1 s
  });

  it('respects the part filter, live', () => {
    const f = fake();
    const p = make(f);
    p.load(seq([n(60, 0, 1, 'melody'), n(36, 0, 1, 'bass'), n(62, 1, 1, 'melody'), n(38, 1, 1, 'bass')], 2, 60));
    p.setPartFilter((id) => id === 'melody');
    p.play();
    f.run(2);
    expect(f.calls.map((c) => c.midi)).toEqual([60, 62]);
  });

  it('pauses by releasing sounding notes and resumes without replaying', () => {
    const f = fake();
    const p = make(f);
    p.load(seq([n(60, 0, 8), n(62, 4), n(64, 8)], 12, 120));
    p.play();
    f.run(1.0);
    p.pause();
    expect(p.getState()).toBe('paused');
    expect(f.calls[0].releasedAt).not.toBeNull();
    const countAtPause = f.calls.length;
    f.run(3);
    expect(f.calls.length).toBe(countAtPause); // nothing scheduled while paused
    p.play();
    f.run(0.5);
    // resumed from ~beat 2, so beat-0 note is not struck again
    expect(f.calls.filter((c) => c.midi === 60)).toHaveLength(1);
  });

  it('seeks while stopped and plays from there', () => {
    const f = fake();
    const p = make(f);
    p.load(seq([n(60, 0), n(62, 4), n(64, 8)], 12, 120));
    p.seek(8);
    p.play();
    f.run(0.3);
    expect(f.calls.map((c) => c.midi)).toEqual([64]);
  });

  it('loops seamlessly', () => {
    const f = fake();
    const p = make(f);
    p.setLoop(true);
    p.load(seq([n(60, 0), n(62, 1)], 2, 60));
    p.play();
    f.run(5);
    expect(p.getState()).toBe('playing');
    const sixties = f.calls.filter((c) => c.midi === 60);
    expect(sixties.length).toBeGreaterThanOrEqual(2);
    const gap = sixties[1].when - sixties[0].when;
    expect(gap).toBeCloseTo(2, 2); // exactly one song length apart
  });

  it('stops by itself at the end and reports it once', () => {
    const f = fake();
    const p = make(f);
    const onEnd = vi.fn();
    p.onEnd(onEnd);
    p.load(seq([n(60, 0), n(62, 1)], 2, 120));
    p.play();
    f.run(4);
    expect(p.getState()).toBe('stopped');
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('exposes which pitches are sounding at a beat', () => {
    const f = fake();
    const p = make(f);
    p.load(seq([n(60, 0, 2), n(64, 1, 2), n(36, 0, 4, 'bass')], 4, 60));
    expect([...p.activeAt(1.5)].sort()).toEqual([36, 60, 64]);
    p.setPartFilter((id) => id !== 'bass');
    expect([...p.activeAt(1.5)].sort()).toEqual([60, 64]);
    expect([...p.activeAt(3.9)]).toEqual([]);
  });

  it('plays a follow-along segment spaced at tempo', () => {
    const f = fake();
    const p = make(f);
    p.load(seq([n(60, 0), n(36, 0, 1, 'bass'), n(38, 1, 1, 'bass'), n(40, 2, 1, 'bass')], 3, 60));
    p.playSegment(0, 2, (note) => note.partId === 'bass');
    expect(f.calls.map((c) => c.midi)).toEqual([36, 38]);
    expect(f.calls[1].when - f.calls[0].when).toBeCloseTo(1, 5);
  });
});
