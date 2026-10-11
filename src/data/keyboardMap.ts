import { KeyBindingDefinition, VirtualKeyNote } from '../types/music';

export const MIN_OCTAVE = 1;
export const MAX_OCTAVE = 6;
export const DEFAULT_OCTAVE = 4;

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

/**
 * 25-key chromatic layout (2 full octaves + top C).
 * Home row + top row naturally forms the piano layout:
 * White keys (15): A S D F G H J K L ; ' \ , . /
 * Black keys (10): W E T Y U O P [ ] =
 */
export const KEY_BINDINGS: KeyBindingDefinition[] = [
  // First Octave (0 - 11)
  { semitoneOffset: 0,  code: 'KeyA',         keyLabel: 'A',  isSharp: false, noteBaseName: 'C' },
  { semitoneOffset: 1,  code: 'KeyW',         keyLabel: 'W',  isSharp: true,  noteBaseName: 'C#' },
  { semitoneOffset: 2,  code: 'KeyS',         keyLabel: 'S',  isSharp: false, noteBaseName: 'D' },
  { semitoneOffset: 3,  code: 'KeyE',         keyLabel: 'E',  isSharp: true,  noteBaseName: 'D#' },
  { semitoneOffset: 4,  code: 'KeyD',         keyLabel: 'D',  isSharp: false, noteBaseName: 'E' },
  { semitoneOffset: 5,  code: 'KeyF',         keyLabel: 'F',  isSharp: false, noteBaseName: 'F' },
  { semitoneOffset: 6,  code: 'KeyT',         keyLabel: 'T',  isSharp: true,  noteBaseName: 'F#' },
  { semitoneOffset: 7,  code: 'KeyG',         keyLabel: 'G',  isSharp: false, noteBaseName: 'G' },
  { semitoneOffset: 8,  code: 'KeyY',         keyLabel: 'Y',  isSharp: true,  noteBaseName: 'G#' },
  { semitoneOffset: 9,  code: 'KeyH',         keyLabel: 'H',  isSharp: false, noteBaseName: 'A' },
  { semitoneOffset: 10, code: 'KeyU',         keyLabel: 'U',  isSharp: true,  noteBaseName: 'A#' },
  { semitoneOffset: 11, code: 'KeyJ',         keyLabel: 'J',  isSharp: false, noteBaseName: 'B' },

  // Second Octave (12 - 23) + Top C (24)
  { semitoneOffset: 12, code: 'KeyK',         keyLabel: 'K',  isSharp: false, noteBaseName: 'C' },
  { semitoneOffset: 13, code: 'KeyO',         keyLabel: 'O',  isSharp: true,  noteBaseName: 'C#' },
  { semitoneOffset: 14, code: 'KeyL',         keyLabel: 'L',  isSharp: false, noteBaseName: 'D' },
  { semitoneOffset: 15, code: 'KeyP',         keyLabel: 'P',  isSharp: true,  noteBaseName: 'D#' },
  { semitoneOffset: 16, code: 'Semicolon',    keyLabel: ';',  isSharp: false, noteBaseName: 'E' },
  { semitoneOffset: 17, code: 'Quote',        keyLabel: "'",  isSharp: false, noteBaseName: 'F' },
  { semitoneOffset: 18, code: 'BracketLeft',  keyLabel: '[',  isSharp: true,  noteBaseName: 'F#' },
  { semitoneOffset: 19, code: 'Backslash',    keyLabel: '\\', isSharp: false, noteBaseName: 'G' },
  { semitoneOffset: 20, code: 'BracketRight', keyLabel: ']',  isSharp: true,  noteBaseName: 'G#' },
  { semitoneOffset: 21, code: 'Comma',        keyLabel: ',',  isSharp: false, noteBaseName: 'A' },
  { semitoneOffset: 22, code: 'Equal',        keyLabel: '=',  isSharp: true,  noteBaseName: 'A#' },
  { semitoneOffset: 23, code: 'Period',       keyLabel: '.',  isSharp: false, noteBaseName: 'B' },
  { semitoneOffset: 24, code: 'Slash',        keyLabel: '/',  isSharp: false, noteBaseName: 'C' },
];

const CODE_TO_BINDING = new Map<string, KeyBindingDefinition>(
  KEY_BINDINGS.map((b) => [b.code, b])
);

const KEY_CHAR_TO_BINDING = new Map<string, KeyBindingDefinition>(
  KEY_BINDINGS.map((b) => [b.keyLabel.toLowerCase(), b])
);

/**
 * Converts a MIDI note number (e.g. 60 = C4, 69 = A4) to frequency in Hz.
 */
export function getNoteFrequency(midi: number): number {
  return Number((440 * Math.pow(2, (midi - 69) / 12)).toFixed(3));
}

/**
 * Converts a MIDI note number to scientific pitch notation (e.g. 60 -> "C4").
 */
export function getNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const noteIndex = ((midi % 12) + 12) % 12;
  return `${NOTE_NAMES[noteIndex]}${octave}`;
}

/**
 * Parses a scientific pitch note string (e.g. "C4", "F#5") to MIDI number.
 */
export function noteNameToMidi(noteName: string): number {
  const match = /^([A-G]#?)(-?\d+)$/i.exec(noteName.trim());
  if (!match) {
    throw new Error(`Invalid note name: ${noteName}`);
  }
  const base = match[1].toUpperCase();
  const octave = parseInt(match[2], 10);
  const index = NOTE_NAMES.indexOf(base as (typeof NOTE_NAMES)[number]);
  if (index === -1) {
    throw new Error(`Unknown pitch class: ${base}`);
  }
  return (octave + 1) * 12 + index;
}

/**
 * Generates the 25 virtual piano keys starting at `baseOctave` (e.g. C4 to C6 when baseOctave = 4).
 */
export function getKeyboardNotes(baseOctave: number): VirtualKeyNote[] {
  const clampedOctave = Math.max(MIN_OCTAVE, Math.min(MAX_OCTAVE, baseOctave));
  const baseMidi = (clampedOctave + 1) * 12; // e.g., octave 4 -> MIDI 60 (C4)

  return KEY_BINDINGS.map((binding) => {
    const midi = baseMidi + binding.semitoneOffset;
    const octave = Math.floor(midi / 12) - 1;
    const noteName = `${binding.noteBaseName}${octave}`;
    return {
      ...binding,
      midi,
      octave,
      noteName,
      frequency: getNoteFrequency(midi),
    };
  });
}

/**
 * Resolves a physical keyboard event (code or key fallback) to a VirtualKeyNote.
 */
export function getVirtualNoteFromKeyboardEvent(
  code: string,
  key: string,
  baseOctave: number
): VirtualKeyNote | null {
  const binding =
    CODE_TO_BINDING.get(code) ?? KEY_CHAR_TO_BINDING.get(key.toLowerCase());
  if (!binding) return null;

  const clampedOctave = Math.max(MIN_OCTAVE, Math.min(MAX_OCTAVE, baseOctave));
  const midi = (clampedOctave + 1) * 12 + binding.semitoneOffset;
  const octave = Math.floor(midi / 12) - 1;
  return {
    ...binding,
    midi,
    octave,
    noteName: `${binding.noteBaseName}${octave}`,
    frequency: getNoteFrequency(midi),
  };
}

/**
 * Returns the physical key label (e.g. 'D' for E4) for a given MIDI note at `baseOctave`,
 * or null if the note is outside the current 25-key window.
 */
export function getKeyLabelForMidi(midi: number, baseOctave: number): string | null {
  const clampedOctave = Math.max(MIN_OCTAVE, Math.min(MAX_OCTAVE, baseOctave));
  const baseMidi = (clampedOctave + 1) * 12;
  const offset = midi - baseMidi;
  const binding = KEY_BINDINGS.find((b) => b.semitoneOffset === offset);
  return binding ? binding.keyLabel : null;
}
