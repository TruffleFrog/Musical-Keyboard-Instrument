import { describe, expect, it } from 'vitest';
import { LearnSession, buildLearnSteps } from '../playback/learn';
import { takeToSequence } from '../playback/take';
import type { Recording } from '../types/music';

const note = (midi: number, start: number, partId = 'm') => ({
  midi,
  start,
  duration: 1,
  velocity: 0.8,
  partId,
});

describe('buildLearnSteps', () => {
  const notes = [
    note(60, 0),
    note(48, 0, 'bass'),
    note(64, 1),
    note(67, 1), // melody chord
    note(40, 1, 'bass'),
    note(72, 2),
  ];
  const steps = buildLearnSteps(notes, (p) => p === 'm', 4);

  it('uses only melody notes and groups simultaneous ones', () => {
    expect(steps.map((s) => s.midis)).toEqual([[60], [64, 67], [72]]);
    expect(steps.map((s) => s.start)).toEqual([0, 1, 2]);
  });

  it('links each step to the start of the next', () => {
    expect(steps.map((s) => s.nextStart)).toEqual([1, 2, 5]);
  });
});

describe('LearnSession', () => {
  const make = () =>
    new LearnSession(
      buildLearnSteps(
        [note(60, 0), note(64, 1), note(67, 1), note(72, 2)],
        () => true,
        3
      )
    );

  it('waits for the right note then advances', () => {
    const s = make();
    expect(s.targets).toEqual([60]);
    expect(s.press(62)).toEqual({ result: 'miss' });
    expect(s.mistakes).toBe(1);
    expect(s.index).toBe(0);
    const hit = s.press(60);
    expect(hit).toMatchObject({ result: 'hit', advanced: true, finished: false });
    expect(s.index).toBe(1);
  });

  it('requires every note of a chord step, in any order', () => {
    const s = make();
    s.press(60);
    expect(s.press(67)).toMatchObject({ result: 'hit', advanced: false });
    expect(s.targets).toEqual([64]);
    expect(s.press(64)).toMatchObject({ result: 'hit', advanced: true });
  });

  it('accepts the right note name in any octave', () => {
    const s = make();
    expect(s.press(48)).toMatchObject({ result: 'hit', matched: 60 }); // C3 for C4
    s.press(52); // E3 for E4
    expect(s.press(79)).toMatchObject({ result: 'hit', matched: 67 }); // G5 for G4
  });

  it('finishes, reports accuracy and can restart', () => {
    const s = make();
    s.press(61);
    [60, 64, 67].forEach((m) => s.press(m));
    const last = s.press(72);
    expect(last).toMatchObject({ result: 'hit', finished: true });
    expect(s.completed).toBe(true);
    expect(s.press(60)).toEqual({ result: 'none' });
    expect(s.accuracy).toBeCloseTo(4 / 5, 5); // 4 right presses, 1 wrong
    s.restart();
    expect(s.completed).toBe(false);
    expect(s.index).toBe(0);
    expect(s.mistakes).toBe(0);
  });

  it('can jump to a beat', () => {
    const s = make();
    s.seekToBeat(1);
    expect(s.index).toBe(1);
    expect(s.targets.sort()).toEqual([64, 67]);
  });

  it('copes with an empty melody', () => {
    const s = new LearnSession([]);
    expect(s.completed).toBe(true);
    expect(s.press(60)).toEqual({ result: 'none' });
  });
});

describe('takeToSequence', () => {
  const base: Recording = {
    id: 't',
    name: 'T',
    createdAt: '',
    durationMs: 4000,
    instrument: 'piano',
    events: [
      { id: 'a', midi: 60, noteName: 'C4', startTimeMs: 0, durationMs: 200, velocity: 0.7, instrument: 'piano' },
      { id: 'b', midi: 64, noteName: 'E4', startTimeMs: 3000, durationMs: 200, velocity: 0.7, instrument: 'piano' },
    ],
  };

  it('expresses a take at 60 BPM (one beat per second)', () => {
    const seq = takeToSequence(base);
    expect(seq.bpm).toBe(60);
    expect(seq.notes[0]).toMatchObject({ midi: 60, start: 0, duration: 0.2 });
    expect(seq.lengthBeats).toBeGreaterThanOrEqual(4);
  });

  it('extends notes released while the pedal was down until it lifts', () => {
    const seq = takeToSequence({
      ...base,
      pedal: [
        { timeMs: 100, down: true },
        { timeMs: 1500, down: false },
      ],
    });
    // C4 key-up at 200 ms is inside [100,1500): rings until 1.5 s.
    expect(seq.notes[0].duration).toBeCloseTo(1.5, 3);
    // E4 at 3 s is after the pedal lifted: unchanged.
    expect(seq.notes[1].duration).toBeCloseTo(0.2, 3);
  });
});
