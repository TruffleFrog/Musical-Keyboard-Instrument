import type { PlayerNote } from './sequencePlayer';

/**
 * Learn ("wait for me") mode. The melody is broken into steps; each step is
 * one or more notes that start together. The session waits until every note
 * of the step has been played, then advances. Octave is forgiving: playing
 * the right note name in any octave counts, because a 25-key computer
 * keyboard can't reach every register of a song.
 */

export interface LearnStep {
  /** Beat at which the step's notes start. */
  start: number;
  /** Target pitches (true song pitches). */
  midis: number[];
  /** Start beat of the following step (or just past the song's end). */
  nextStart: number;
}

export function buildLearnSteps(
  notes: PlayerNote[],
  isMelody: (partId: string | undefined) => boolean,
  lengthBeats: number
): LearnStep[] {
  const steps: LearnStep[] = [];
  for (const n of notes) {
    if (!isMelody(n.partId)) continue;
    const last = steps[steps.length - 1];
    if (last && Math.abs(last.start - n.start) < 1e-6) {
      if (!last.midis.includes(n.midi)) last.midis.push(n.midi);
    } else {
      steps.push({ start: n.start, midis: [n.midi], nextStart: 0 });
    }
  }
  steps.forEach((s, i) => {
    s.nextStart = i + 1 < steps.length ? steps[i + 1].start : lengthBeats + 1;
  });
  return steps;
}

export type PressResult =
  | { result: 'none' }
  | { result: 'miss' }
  | {
      result: 'hit';
      /** The target pitch that was satisfied. */
      matched: number;
      /** True when the step is complete and the session moved on. */
      advanced: boolean;
      /** The step that was just completed (when advanced). */
      completed?: LearnStep;
      finished: boolean;
    };

const pc = (m: number) => ((m % 12) + 12) % 12;

export class LearnSession {
  private idx = 0;
  private pending: number[];
  private hitCount = 0;
  private missCount = 0;
  private done: boolean;

  constructor(readonly steps: LearnStep[]) {
    this.pending = steps[0] ? steps[0].midis.slice() : [];
    this.done = steps.length === 0;
  }

  get index(): number {
    return this.idx;
  }
  get total(): number {
    return this.steps.length;
  }
  get completed(): boolean {
    return this.done;
  }
  get mistakes(): number {
    return this.missCount;
  }
  get hits(): number {
    return this.hitCount;
  }
  get step(): LearnStep | null {
    return this.done ? null : (this.steps[this.idx] ?? null);
  }
  /** Notes still to be played in the current step. */
  get targets(): number[] {
    return this.done ? [] : this.pending.slice();
  }
  /** 0..1 share of presses that were correct. */
  get accuracy(): number {
    const total = this.hitCount + this.missCount;
    return total === 0 ? 1 : this.hitCount / total;
  }

  press(midi: number): PressResult {
    if (this.done) return { result: 'none' };

    let candidate = this.pending.indexOf(midi);
    if (candidate === -1) {
      let bestDist = Infinity;
      this.pending.forEach((target, i) => {
        if (pc(target) === pc(midi)) {
          const d = Math.abs(target - midi);
          if (d < bestDist) {
            bestDist = d;
            candidate = i;
          }
        }
      });
    }

    if (candidate === -1) {
      this.missCount += 1;
      return { result: 'miss' };
    }

    const [matched] = this.pending.splice(candidate, 1);
    this.hitCount += 1;
    if (this.pending.length > 0) {
      return { result: 'hit', matched, advanced: false, finished: false };
    }

    const completed = this.steps[this.idx];
    this.idx += 1;
    if (this.idx >= this.steps.length) {
      this.done = true;
      this.pending = [];
      return { result: 'hit', matched, advanced: true, completed, finished: true };
    }
    this.pending = this.steps[this.idx].midis.slice();
    return { result: 'hit', matched, advanced: true, completed, finished: false };
  }

  /** Jumps to the first step starting at or after `beat`. */
  seekToBeat(beat: number): void {
    const i = this.steps.findIndex((s) => s.start >= beat - 1e-6);
    this.goTo(i === -1 ? this.steps.length - 1 : i);
  }

  goTo(index: number): void {
    if (this.steps.length === 0) return;
    this.idx = Math.max(0, Math.min(this.steps.length - 1, index));
    this.pending = this.steps[this.idx].midis.slice();
    this.done = false;
  }

  restart(): void {
    this.hitCount = 0;
    this.missCount = 0;
    this.goTo(0);
  }
}
