import type { KeyBindingDefinition, VirtualKeyNote } from '../types/music';
import { midiToFrequency, midiToName, nameToMidi } from '../music/notes';

/** Octave of the lowest C of the 25-key computer-keyboard window. */
export const MIN_OCTAVE = 2;
export const MAX_OCTAVE = 5;
export const DEFAULT_OCTAVE = 4;

/** The on-screen keyboard shows C2..C7 (61 keys) when there is room. */
export const KEYBOARD_LOW_MIDI = 36;
export const KEYBOARD_HIGH_MIDI = 96;
/** The QWERTY window spans two octaves plus the top C. */
export const WINDOW_SPAN = 24;

/**
 * 25-key chromatic layout (2 octaves + top C) on a QWERTY keyboard.
 * The core (A..' with W..P above) is the standard "musical typing" layout used
 * by GarageBand, Logic and Ableton, so it should feel familiar; the remaining
 * keys continue the pattern.
 *
 * White keys (15): A S D F G H J K L ; ' \ , . /
 * Black keys (10): W E T Y U O P [ ] =
 */
export const KEY_BINDINGS: KeyBindingDefinition[] = [
  { semitoneOffset: 0, code: 'KeyA', keyLabel: 'A', isSharp: false, noteBaseName: 'C' },
  { semitoneOffset: 1, code: 'KeyW', keyLabel: 'W', isSharp: true, noteBaseName: 'C#' },
  { semitoneOffset: 2, code: 'KeyS', keyLabel: 'S', isSharp: false, noteBaseName: 'D' },
  { semitoneOffset: 3, code: 'KeyE', keyLabel: 'E', isSharp: true, noteBaseName: 'D#' },
  { semitoneOffset: 4, code: 'KeyD', keyLabel: 'D', isSharp: false, noteBaseName: 'E' },
  { semitoneOffset: 5, code: 'KeyF', keyLabel: 'F', isSharp: false, noteBaseName: 'F' },
  { semitoneOffset: 6, code: 'KeyT', keyLabel: 'T', isSharp: true, noteBaseName: 'F#' },
  { semitoneOffset: 7, code: 'KeyG', keyLabel: 'G', isSharp: false, noteBaseName: 'G' },
  { semitoneOffset: 8, code: 'KeyY', keyLabel: 'Y', isSharp: true, noteBaseName: 'G#' },
  { semitoneOffset: 9, code: 'KeyH', keyLabel: 'H', isSharp: false, noteBaseName: 'A' },
  { semitoneOffset: 10, code: 'KeyU', keyLabel: 'U', isSharp: true, noteBaseName: 'A#' },
  { semitoneOffset: 11, code: 'KeyJ', keyLabel: 'J', isSharp: false, noteBaseName: 'B' },
  { semitoneOffset: 12, code: 'KeyK', keyLabel: 'K', isSharp: false, noteBaseName: 'C' },
  { semitoneOffset: 13, code: 'KeyO', keyLabel: 'O', isSharp: true, noteBaseName: 'C#' },
  { semitoneOffset: 14, code: 'KeyL', keyLabel: 'L', isSharp: false, noteBaseName: 'D' },
  { semitoneOffset: 15, code: 'KeyP', keyLabel: 'P', isSharp: true, noteBaseName: 'D#' },
  { semitoneOffset: 16, code: 'Semicolon', keyLabel: ';', isSharp: false, noteBaseName: 'E' },
  { semitoneOffset: 17, code: 'Quote', keyLabel: "'", isSharp: false, noteBaseName: 'F' },
  { semitoneOffset: 18, code: 'BracketLeft', keyLabel: '[', isSharp: true, noteBaseName: 'F#' },
  { semitoneOffset: 19, code: 'Backslash', keyLabel: '\\', isSharp: false, noteBaseName: 'G' },
  { semitoneOffset: 20, code: 'BracketRight', keyLabel: ']', isSharp: true, noteBaseName: 'G#' },
  { semitoneOffset: 21, code: 'Comma', keyLabel: ',', isSharp: false, noteBaseName: 'A' },
  { semitoneOffset: 22, code: 'Equal', keyLabel: '=', isSharp: true, noteBaseName: 'A#' },
  { semitoneOffset: 23, code: 'Period', keyLabel: '.', isSharp: false, noteBaseName: 'B' },
  { semitoneOffset: 24, code: 'Slash', keyLabel: '/', isSharp: false, noteBaseName: 'C' },
];

const CODE_TO_BINDING = new Map<string, KeyBindingDefinition>(
  KEY_BINDINGS.map((b) => [b.code, b])
);
const KEY_TO_BINDING = new Map<string, KeyBindingDefinition>(
  KEY_BINDINGS.map((b) => [b.keyLabel.toLowerCase(), b])
);
const OFFSET_TO_BINDING = new Map<number, KeyBindingDefinition>(
  KEY_BINDINGS.map((b) => [b.semitoneOffset, b])
);

export function clampOctave(octave: number): number {
  return Math.max(MIN_OCTAVE, Math.min(MAX_OCTAVE, Math.round(octave)));
}

/** MIDI number of the window's lowest key (a C). */
export function windowBaseMidi(octave: number): number {
  return (clampOctave(octave) + 1) * 12;
}

/** Kept for API compatibility with older code and tests. */
export function getNoteFrequency(midi: number): number {
  return Number(midiToFrequency(midi).toFixed(3));
}
export const getNoteName = midiToName;
export const noteNameToMidi = nameToMidi;

function toVirtualNote(
  binding: KeyBindingDefinition,
  octave: number
): VirtualKeyNote {
  const midi = windowBaseMidi(octave) + binding.semitoneOffset;
  const noteOctave = Math.floor(midi / 12) - 1;
  return {
    ...binding,
    midi,
    octave: noteOctave,
    noteName: `${binding.noteBaseName}${noteOctave}`,
    frequency: getNoteFrequency(midi),
  };
}

/** The 25 playable keys for a given octave setting. */
export function getKeyboardNotes(octave: number): VirtualKeyNote[] {
  return KEY_BINDINGS.map((b) => toVirtualNote(b, octave));
}

/** Resolves a physical key event to the note it plays, or null. */
export function getVirtualNoteFromKeyboardEvent(
  code: string,
  key: string,
  octave: number
): VirtualKeyNote | null {
  const binding =
    CODE_TO_BINDING.get(code) ?? KEY_TO_BINDING.get(key.toLowerCase());
  return binding ? toVirtualNote(binding, octave) : null;
}

/** Computer-key label for a MIDI note, or null when outside the window. */
export function getKeyLabelForMidi(midi: number, octave: number): string | null {
  const binding = OFFSET_TO_BINDING.get(midi - windowBaseMidi(octave));
  return binding ? binding.keyLabel : null;
}

/**
 * The in-window MIDI note with the same pitch class that is closest to
 * `target`. Used to hint which computer key to press for an out-of-window note.
 */
export function nearestWindowMidi(target: number, octave: number): number {
  const base = windowBaseMidi(octave);
  const pc = ((target % 12) + 12) % 12;
  let best = base + ((pc - (base % 12) + 12) % 12);
  let bestDist = Math.abs(best - target);
  for (let m = best; m <= base + WINDOW_SPAN; m += 12) {
    const d = Math.abs(m - target);
    if (d < bestDist) {
      best = m;
      bestDist = d;
    }
  }
  return best;
}

export function isInWindow(midi: number, octave: number): boolean {
  const off = midi - windowBaseMidi(octave);
  return off >= 0 && off <= WINDOW_SPAN;
}

/* ---------- on-screen keyboard geometry ---------- */

export interface KeyGeometry {
  midi: number;
  isBlack: boolean;
  /** Left edge as a fraction (0..1) of keyboard width. */
  x: number;
  /** Width as a fraction of keyboard width. */
  w: number;
}

const BLACK_PC = new Set([1, 3, 6, 8, 10]);

export function isBlackMidi(midi: number): boolean {
  return BLACK_PC.has(((midi % 12) + 12) % 12);
}

/** White-key MIDI numbers between low and high inclusive. */
export function whiteKeys(low: number, high: number): number[] {
  const out: number[] = [];
  for (let m = low; m <= high; m++) if (!isBlackMidi(m)) out.push(m);
  return out;
}

/**
 * Picks the visible MIDI range for the on-screen keyboard. The full C2..C7 is
 * shown when it fits at a comfortable key width; otherwise the range shrinks
 * around the QWERTY window so keys never get too small to hit.
 */
export function computeViewRange(
  octave: number,
  availableWidthPx: number,
  minWhitePx = 26
): { low: number; high: number } {
  const all = whiteKeys(KEYBOARD_LOW_MIDI, KEYBOARD_HIGH_MIDI);
  const windowWhites = whiteKeys(
    windowBaseMidi(octave),
    windowBaseMidi(octave) + WINDOW_SPAN
  );
  const capacity = Math.max(
    windowWhites.length,
    Math.min(all.length, Math.floor(availableWidthPx / minWhitePx))
  );
  if (capacity >= all.length) {
    return { low: KEYBOARD_LOW_MIDI, high: KEYBOARD_HIGH_MIDI };
  }
  const windowStart = all.indexOf(windowWhites[0]);
  const extra = capacity - windowWhites.length;
  const start = Math.max(
    0,
    Math.min(all.length - capacity, windowStart - Math.floor(extra / 2))
  );
  return { low: all[start], high: all[start + capacity - 1] };
}

/**
 * Lays out a keyboard spanning [low, high] (both should be white keys).
 * White keys share the width equally; black keys straddle the boundary.
 */
export function layoutKeys(low: number, high: number): {
  keys: KeyGeometry[];
  whiteCount: number;
} {
  const whites = whiteKeys(low, high);
  const whiteW = 1 / whites.length;
  const whiteIndex = new Map(whites.map((m, i) => [m, i]));
  const keys: KeyGeometry[] = [];
  for (let m = low; m <= high; m++) {
    if (!isBlackMidi(m)) {
      keys.push({ midi: m, isBlack: false, x: whiteIndex.get(m)! * whiteW, w: whiteW });
    } else {
      const left = whiteIndex.get(m - 1);
      const right = whiteIndex.get(m + 1);
      if (left === undefined || right === undefined) continue;
      const bw = whiteW * 0.62;
      keys.push({
        midi: m,
        isBlack: true,
        x: (left + 1) * whiteW - bw / 2,
        w: bw,
      });
    }
  }
  return { keys, whiteCount: whites.length };
}
