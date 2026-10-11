/**
 * Pure pitch helpers. No DOM, no Web Audio.
 */

export const NOTE_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
] as const;

const FLAT_TO_SHARP: Record<string, string> = {
  Db: 'C#',
  Eb: 'D#',
  Gb: 'F#',
  Ab: 'G#',
  Bb: 'A#',
  Cb: 'B',
  Fb: 'E',
};

const BLACK_PITCH_CLASSES = new Set([1, 3, 6, 8, 10]);

/** MIDI note number -> frequency in Hz (A4 = 69 = 440 Hz). */
export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** MIDI note number -> scientific pitch name, e.g. 60 -> "C4". */
export function midiToName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[pitchClass(midi)]}${octave}`;
}

/** Parses "C4", "F#5" or "Bb3" into a MIDI number. Throws on invalid input. */
export function nameToMidi(name: string): number {
  const match = /^([A-Ga-g])([#b]?)(-?\d+)$/.exec(name.trim());
  if (!match) throw new Error(`Invalid note name: ${name}`);
  let base = match[1].toUpperCase() + match[2];
  base = FLAT_TO_SHARP[base] ?? base;
  const index = NOTE_NAMES.indexOf(base as (typeof NOTE_NAMES)[number]);
  if (index === -1) throw new Error(`Unknown pitch class: ${name}`);
  return (parseInt(match[3], 10) + 1) * 12 + index;
}

export function pitchClass(midi: number): number {
  return ((midi % 12) + 12) % 12;
}

export function isBlackKey(midi: number): boolean {
  return BLACK_PITCH_CLASSES.has(pitchClass(midi));
}

/** Note letter without octave, e.g. 61 -> "C#". */
export function pitchClassName(midi: number): string {
  return NOTE_NAMES[pitchClass(midi)];
}
