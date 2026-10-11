import type { Recording } from '../types/music';
import type { PlayerSequence } from './sequencePlayer';

/**
 * A take is stored in real time (milliseconds). To replay it with the shared
 * player we express it as a sequence at 60 BPM, i.e. one beat = one second,
 * extending notes that were held by the sustain pedal until it lifted.
 */
export function takeToSequence(rec: Recording): PlayerSequence {
  const pedal = [...(rec.pedal ?? [])].sort((a, b) => a.timeMs - b.timeMs);

  // Build [down, up) intervals during which the pedal was held.
  const intervals: Array<[number, number]> = [];
  let downAt: number | null = null;
  for (const p of pedal) {
    if (p.down && downAt === null) downAt = p.timeMs;
    else if (!p.down && downAt !== null) {
      intervals.push([downAt, p.timeMs]);
      downAt = null;
    }
  }
  if (downAt !== null) intervals.push([downAt, Math.max(rec.durationMs, downAt)]);

  const notes = rec.events
    .map((e) => {
      const keyUp = e.startTimeMs + Math.max(30, e.durationMs);
      const held = intervals.find(([d, u]) => keyUp >= d && keyUp < u);
      const end = held ? Math.max(keyUp, held[1]) : keyUp;
      return {
        midi: e.midi,
        start: e.startTimeMs / 1000,
        duration: (end - e.startTimeMs) / 1000,
        velocity: e.velocity,
        instrument: e.instrument,
      };
    })
    .sort((a, b) => a.start - b.start || a.midi - b.midi);

  const maxDuration = notes.reduce((m, n) => Math.max(m, n.duration), 0);
  const lengthBeats = Math.max(
    rec.durationMs / 1000,
    notes.reduce((m, n) => Math.max(m, n.start + n.duration), 0)
  );
  return { notes, lengthBeats, bpm: 60, maxDuration };
}
