import { describe, expect, it } from 'vitest';
import {
  getKeyboardNotes,
  getKeyLabelForMidi,
  getNoteFrequency,
  getNoteName,
  getVirtualNoteFromKeyboardEvent,
  KEY_BINDINGS,
  noteNameToMidi,
} from '../data/keyboardMap';

describe('keyboardMap utilities', () => {
  it('calculates standard concert pitch A4 = 440Hz and C4 = 261.626Hz', () => {
    expect(getNoteFrequency(69)).toBeCloseTo(440, 2);
    expect(getNoteFrequency(60)).toBeCloseTo(261.626, 2);
    expect(getNoteFrequency(81)).toBeCloseTo(880, 2);
  });

  it('converts between MIDI numbers and scientific pitch notation accurately', () => {
    expect(getNoteName(60)).toBe('C4');
    expect(getNoteName(61)).toBe('C#4');
    expect(getNoteName(69)).toBe('A4');
    expect(getNoteName(84)).toBe('C6');

    expect(noteNameToMidi('C4')).toBe(60);
    expect(noteNameToMidi('C#4')).toBe(61);
    expect(noteNameToMidi('A4')).toBe(69);
    expect(noteNameToMidi('C6')).toBe(84);
  });

  it('generates 25 chromatic keys (15 white, 10 black) with unique QWERTY bindings', () => {
    const notes = getKeyboardNotes(4);
    expect(notes).toHaveLength(25);
    expect(notes[0].noteName).toBe('C4');
    expect(notes[0].keyLabel).toBe('A');
    expect(notes[12].noteName).toBe('C5');
    expect(notes[12].keyLabel).toBe('K');
    expect(notes[24].noteName).toBe('C6');
    expect(notes[24].keyLabel).toBe('/');

    const whiteCount = notes.filter((n) => !n.isSharp).length;
    const blackCount = notes.filter((n) => n.isSharp).length;
    expect(whiteCount).toBe(15);
    expect(blackCount).toBe(10);

    const uniqueCodes = new Set(KEY_BINDINGS.map((b) => b.code));
    expect(uniqueCodes.size).toBe(25);
  });

  it('resolves physical KeyboardEvent codes and shifts correctly with baseOctave', () => {
    const c4 = getVirtualNoteFromKeyboardEvent('KeyA', 'a', 4);
    expect(c4?.noteName).toBe('C4');
    expect(c4?.midi).toBe(60);

    const c3 = getVirtualNoteFromKeyboardEvent('KeyA', 'a', 3);
    expect(c3?.noteName).toBe('C3');
    expect(c3?.midi).toBe(48);

    const fSharp4 = getVirtualNoteFromKeyboardEvent('KeyT', 't', 4);
    expect(fSharp4?.noteName).toBe('F#4');
    expect(fSharp4?.isSharp).toBe(true);
  });

  it('returns the physical key binding label for a MIDI note in range', () => {
    expect(getKeyLabelForMidi(60, 4)).toBe('A');
    expect(getKeyLabelForMidi(64, 4)).toBe('D');
    expect(getKeyLabelForMidi(72, 4)).toBe('K');
    expect(getKeyLabelForMidi(30, 4)).toBeNull();
  });
});
