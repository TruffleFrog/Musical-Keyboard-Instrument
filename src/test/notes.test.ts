import { describe, expect, it } from 'vitest';
import { detectChord } from '../music/chords';
import {
  isBlackKey,
  midiToFrequency,
  midiToName,
  nameToMidi,
} from '../music/notes';

describe('note helpers', () => {
  it('converts names to MIDI and back', () => {
    expect(nameToMidi('C4')).toBe(60);
    expect(nameToMidi('A4')).toBe(69);
    expect(nameToMidi('F#5')).toBe(78);
    expect(nameToMidi('Bb3')).toBe(58);
    expect(nameToMidi('C-1')).toBe(0);
    expect(midiToName(60)).toBe('C4');
    expect(midiToName(61)).toBe('C#4');
    expect(midiToName(95)).toBe('B6');
    for (let m = 24; m <= 108; m++) expect(nameToMidi(midiToName(m))).toBe(m);
  });

  it('rejects malformed names', () => {
    expect(() => nameToMidi('H4')).toThrow();
    expect(() => nameToMidi('C')).toThrow();
  });

  it('computes equal-tempered frequencies', () => {
    expect(midiToFrequency(69)).toBeCloseTo(440, 6);
    expect(midiToFrequency(60)).toBeCloseTo(261.6256, 3);
    expect(midiToFrequency(81)).toBeCloseTo(880, 6);
  });

  it('identifies black keys', () => {
    expect([60, 62, 64, 65, 67, 69, 71].some(isBlackKey)).toBe(false);
    expect([61, 63, 66, 68, 70].every(isBlackKey)).toBe(true);
  });
});

describe('detectChord', () => {
  const n = (...names: string[]) => names.map(nameToMidi);

  it('names common triads and sevenths', () => {
    expect(detectChord(n('C4', 'E4', 'G4'))).toBe('C');
    expect(detectChord(n('A3', 'C4', 'E4'))).toBe('Am');
    expect(detectChord(n('G3', 'B3', 'D4', 'F4'))).toBe('G7');
    expect(detectChord(n('C4', 'E4', 'G4', 'B4'))).toBe('Cmaj7');
  });

  it('reports inversions as slash chords', () => {
    expect(detectChord(n('E3', 'G3', 'C4'))).toBe('C/E');
  });

  it('ignores octave doublings and needs three pitch classes', () => {
    expect(detectChord(n('C3', 'C4', 'C5'))).toBeNull();
    expect(detectChord(n('C4', 'G4'))).toBeNull();
    expect(detectChord(n('C3', 'E4', 'G4', 'C5'))).toBe('C');
  });
});
