import { describe, expect, it } from 'vitest';
import {
  KEYBOARD_HIGH_MIDI,
  KEYBOARD_LOW_MIDI,
  KEY_BINDINGS,
  MAX_OCTAVE,
  MIN_OCTAVE,
  WINDOW_SPAN,
  clampOctave,
  computeViewRange,
  getKeyLabelForMidi,
  getKeyboardNotes,
  getVirtualNoteFromKeyboardEvent,
  isInWindow,
  layoutKeys,
  nearestWindowMidi,
  whiteKeys,
} from '../data/keyboardMap';

describe('QWERTY mapping', () => {
  it('covers 25 chromatic keys with unique codes and labels', () => {
    expect(KEY_BINDINGS).toHaveLength(25);
    expect(new Set(KEY_BINDINGS.map((b) => b.code)).size).toBe(25);
    expect(new Set(KEY_BINDINGS.map((b) => b.keyLabel)).size).toBe(25);
    expect(KEY_BINDINGS.map((b) => b.semitoneOffset)).toEqual(
      Array.from({ length: 25 }, (_, i) => i)
    );
  });

  it('does not collide with reserved shortcuts', () => {
    const codes = new Set(KEY_BINDINGS.map((b) => b.code));
    for (const reserved of ['KeyZ', 'KeyX', 'Space', 'Escape', 'ArrowUp', 'ArrowDown']) {
      expect(codes.has(reserved)).toBe(false);
    }
    for (let d = 1; d <= 6; d++) expect(codes.has(`Digit${d}`)).toBe(false);
  });

  it('maps the home row to C major from the window base', () => {
    const notes = getKeyboardNotes(4);
    expect(notes[0]).toMatchObject({ keyLabel: 'A', midi: 60, noteName: 'C4' });
    expect(notes[4]).toMatchObject({ keyLabel: 'D', noteName: 'E4' });
    expect(notes[24]).toMatchObject({ keyLabel: '/', noteName: 'C6' });
    expect(getKeyboardNotes(3)[0].noteName).toBe('C3');
  });

  it('resolves keyboard events by code, falling back to key', () => {
    expect(getVirtualNoteFromKeyboardEvent('KeyA', 'a', 4)?.midi).toBe(60);
    expect(getVirtualNoteFromKeyboardEvent('', "'", 4)?.noteName).toBe('F5');
    expect(getVirtualNoteFromKeyboardEvent('KeyQ', 'q', 4)).toBeNull();
  });

  it('clamps octaves into the supported range', () => {
    expect(clampOctave(0)).toBe(MIN_OCTAVE);
    expect(clampOctave(9)).toBe(MAX_OCTAVE);
    expect(clampOctave(4.4)).toBe(4);
  });

  it('keeps the whole window on the on-screen keyboard at every octave', () => {
    for (let o = MIN_OCTAVE; o <= MAX_OCTAVE; o++) {
      const base = (o + 1) * 12;
      expect(base).toBeGreaterThanOrEqual(KEYBOARD_LOW_MIDI);
      expect(base + WINDOW_SPAN).toBeLessThanOrEqual(KEYBOARD_HIGH_MIDI);
    }
  });
});

describe('window helpers', () => {
  it('labels in-window notes and ignores others', () => {
    expect(getKeyLabelForMidi(64, 4)).toBe('D');
    expect(getKeyLabelForMidi(59, 4)).toBeNull();
    expect(getKeyLabelForMidi(85, 4)).toBeNull();
    expect(isInWindow(84, 4)).toBe(true);
    expect(isInWindow(85, 4)).toBe(false);
  });

  it('suggests the nearest same-name key for out-of-window targets', () => {
    // E3 (52) is below the C4 window: reach it with E4.
    expect(nearestWindowMidi(52, 4)).toBe(64);
    // E6 (88) is above: E5 (76) is the nearest E inside C4..C6.
    expect(nearestWindowMidi(88, 4)).toBe(76);
    // Already inside: unchanged.
    expect(nearestWindowMidi(67, 4)).toBe(67);
    // Pitch class is always preserved.
    for (let t = 36; t <= 96; t++) {
      expect(nearestWindowMidi(t, 3) % 12).toBe(t % 12);
    }
  });
});

describe('on-screen keyboard geometry', () => {
  it('shows C2..C7 (36 white keys) when there is room', () => {
    const r = computeViewRange(4, 1600);
    expect(r).toEqual({ low: KEYBOARD_LOW_MIDI, high: KEYBOARD_HIGH_MIDI });
    expect(whiteKeys(r.low, r.high)).toHaveLength(36);
  });

  it('narrows around the QWERTY window on small screens, never below it', () => {
    for (const w of [320, 390, 600, 800]) {
      for (let o = MIN_OCTAVE; o <= MAX_OCTAVE; o++) {
        const { low, high } = computeViewRange(o, w);
        const base = (o + 1) * 12;
        expect(low).toBeLessThanOrEqual(base);
        expect(high).toBeGreaterThanOrEqual(base + WINDOW_SPAN);
        expect(low).toBeGreaterThanOrEqual(KEYBOARD_LOW_MIDI);
        expect(high).toBeLessThanOrEqual(KEYBOARD_HIGH_MIDI);
      }
    }
  });

  it('lays out non-overlapping white keys and centred black keys', () => {
    const { keys, whiteCount } = layoutKeys(60, 84);
    expect(whiteCount).toBe(15);
    const whites = keys.filter((k) => !k.isBlack);
    for (let i = 1; i < whites.length; i++) {
      expect(whites[i].x).toBeCloseTo(whites[i - 1].x + whites[i - 1].w, 8);
    }
    expect(whites[whites.length - 1].x + whites[whites.length - 1].w).toBeCloseTo(1, 8);
    expect(keys.filter((k) => k.isBlack)).toHaveLength(10);
    // C#4 sits on the boundary between C4 and D4.
    const cs = keys.find((k) => k.midi === 61)!;
    const c = keys.find((k) => k.midi === 60)!;
    expect(cs.x + cs.w / 2).toBeCloseTo(c.x + c.w, 8);
  });
});
