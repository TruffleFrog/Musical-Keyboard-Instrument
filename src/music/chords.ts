import { NOTE_NAMES, pitchClass } from './notes';

interface ChordShape {
  /** Interval set in semitones above the root, always including 0. */
  intervals: number[];
  /** Suffix appended to the root name. */
  suffix: string;
  /** Lower number wins when several shapes explain the same notes. */
  priority: number;
}

const SHAPES: ChordShape[] = [
  { intervals: [0, 4, 7], suffix: '', priority: 0 },
  { intervals: [0, 3, 7], suffix: 'm', priority: 0 },
  { intervals: [0, 3, 6], suffix: 'dim', priority: 1 },
  { intervals: [0, 4, 8], suffix: 'aug', priority: 1 },
  { intervals: [0, 2, 7], suffix: 'sus2', priority: 2 },
  { intervals: [0, 5, 7], suffix: 'sus4', priority: 2 },
  { intervals: [0, 4, 7, 10], suffix: '7', priority: 1 },
  { intervals: [0, 4, 7, 11], suffix: 'maj7', priority: 1 },
  { intervals: [0, 3, 7, 10], suffix: 'm7', priority: 1 },
  { intervals: [0, 3, 6, 10], suffix: 'm7♭5', priority: 2 },
  { intervals: [0, 3, 6, 9], suffix: 'dim7', priority: 2 },
  { intervals: [0, 4, 7, 9], suffix: '6', priority: 3 },
  { intervals: [0, 3, 7, 9], suffix: 'm6', priority: 3 },
  { intervals: [0, 4, 7, 14 % 12], suffix: 'add9', priority: 3 },
];

/**
 * Names the chord formed by the given MIDI notes (any octave, any order), or
 * returns null when fewer than three distinct pitch classes are sounding or
 * nothing matches. A slash bass is appended when the lowest note is not the root.
 */
export function detectChord(midis: Iterable<number>): string | null {
  const list = Array.from(midis);
  if (list.length < 3) return null;

  const classes = Array.from(new Set(list.map(pitchClass)));
  if (classes.length < 3) return null;

  const lowest = Math.min(...list);
  const bassClass = pitchClass(lowest);

  let best: { name: string; score: number; root: number } | null = null;

  for (const root of classes) {
    const relative = new Set(classes.map((c) => (c - root + 12) % 12));
    for (const shape of SHAPES) {
      if (shape.intervals.length !== relative.size) continue;
      if (!shape.intervals.every((i) => relative.has(i))) continue;
      // Prefer: root in the bass, then simpler shapes.
      const score = (root === bassClass ? 0 : 10) + shape.priority;
      if (!best || score < best.score) {
        best = {
          name: `${NOTE_NAMES[root]}${shape.suffix}`,
          score,
          root,
        };
      }
    }
  }

  if (!best) return null;
  return best.root === bassClass
    ? best.name
    : `${best.name}/${NOTE_NAMES[bassClass]}`;
}
