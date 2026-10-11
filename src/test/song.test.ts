import { describe, expect, it } from 'vitest';
import {
  NotationError,
  activeMidisAt,
  barAtBeat,
  beatOfBar,
  defineSong,
  parseNotation,
} from '../music/song';
import { SONGS } from '../music/songs';
import { nameToMidi } from '../music/notes';
import { KEYBOARD_HIGH_MIDI, KEYBOARD_LOW_MIDI } from '../data/keyboardMap';

describe('notation parser', () => {
  it('advances time by each token and supports default durations', () => {
    const p = parseNotation('d=.5 C4 D4 E4:1 r:.5 G4');
    expect(p.notes.map((n) => [n.midi, n.start, n.duration])).toEqual([
      [60, 0, 0.5],
      [62, 0.5, 0.5],
      [64, 1, 1],
      [67, 2.5, 0.5],
    ]);
    expect(p.advance).toBe(3);
  });

  it('expands chords into simultaneous notes', () => {
    const p = parseNotation('C3+E3+G3:2 C4');
    const first = p.notes.filter((n) => n.start === 0);
    expect(first.map((n) => n.midi).sort()).toEqual([48, 52, 55]);
    expect(first.every((n) => n.duration === 2)).toBe(true);
    expect(p.notes[3].start).toBe(2);
  });

  it('supports held notes that outlast their advance', () => {
    const p = parseNotation('C4:.25/2 E4:.25/1.75');
    expect(p.notes[0]).toMatchObject({ start: 0, duration: 2 });
    expect(p.notes[1]).toMatchObject({ start: 0.25, duration: 1.75 });
    expect(p.advance).toBe(0.5);
  });

  it('parses velocity, lyrics and repeat groups', () => {
    const p = parseNotation('(C4:1@127{la} D4:1)*2');
    expect(p.notes).toHaveLength(4);
    expect(p.notes[0].velocity).toBe(1);
    expect(p.notes[0].lyric).toBe('la');
    expect(p.notes[2].start).toBe(2);
  });

  it('measures bars between bar lines', () => {
    const p = parseNotation('C4:2 D4:2 | E4:4 | F4:3');
    expect(p.barLengths).toEqual([4, 4, 3]);
  });

  it('rejects bad tokens and unbalanced groups', () => {
    expect(() => parseNotation('C4 H9')).toThrow(NotationError);
    expect(() => parseNotation('(C4 D4')).toThrow(NotationError);
    expect(() => parseNotation('C4 D4)')).toThrow(NotationError);
  });
});

describe('song model helpers', () => {
  const song = defineSong({
    id: 't',
    title: 'T',
    composer: 'x',
    era: '',
    difficulty: 'Beginner',
    bpm: 120,
    beatsPerBar: 3,
    beatUnit: 'quarter',
    pickupBeats: 1,
    key: 'C',
    recommendedInstrument: 'piano',
    recommendedOctave: 4,
    description: '',
    parts: [
      { id: 'a', name: 'A', role: 'melody', hand: 'right', notation: 'C4:1 | D4:3 | E4:3' },
      { id: 'b', name: 'B', role: 'bass', hand: 'left', notation: 'r:1 | C3:3 | G2:3' },
    ],
  });

  it('sorts notes and counts bars including the pickup', () => {
    expect(song.lengthBeats).toBe(7);
    expect(song.notes.map((n) => n.start)).toEqual([...song.notes.map((n) => n.start)].sort((a, b) => a - b));
    expect(song.barCount).toBe(3);
  });

  it('maps beats to bars and back', () => {
    expect(barAtBeat(song, 0)).toBe(0);
    expect(barAtBeat(song, 1)).toBe(1);
    expect(barAtBeat(song, 4)).toBe(2);
    expect(beatOfBar(song, 2)).toBe(4);
  });

  it('finds simultaneously sounding notes and honours part filters', () => {
    const at2 = activeMidisAt(song, 2);
    expect([...at2].sort()).toEqual([nameToMidi('D4'), nameToMidi('C3')].sort());
    const onlyA = activeMidisAt(song, 2, (id) => id === 'a');
    expect([...onlyA]).toEqual([nameToMidi('D4')]);
  });
});

describe('built-in song library', () => {
  it('has unique ids and plausible metadata', () => {
    const ids = SONGS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(SONGS.length).toBeGreaterThanOrEqual(6);
    for (const s of SONGS) {
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.bpm).toBeGreaterThan(30);
      expect(s.recommendedOctave).toBeGreaterThanOrEqual(2);
      expect(s.recommendedOctave).toBeLessThanOrEqual(5);
    }
  });

  for (const song of SONGS) {
    describe(song.title, () => {
      it('is multi-part with a melody', () => {
        expect(song.parts.length).toBeGreaterThanOrEqual(2);
        expect(song.parts.some((p) => p.role === 'melody')).toBe(true);
        expect(song.parts.every((p) => p.noteCount > 0)).toBe(true);
      });

      it('plays several notes at once (real polyphony)', () => {
        let maxConcurrent = 0;
        for (const n of song.notes) {
          const c = song.notes.filter(
            (m) => m.start <= n.start && n.start < m.start + m.duration
          ).length;
          maxConcurrent = Math.max(maxConcurrent, c);
        }
        expect(maxConcurrent).toBeGreaterThanOrEqual(3);
      });

      it('has rhythmically consistent bars in every part', () => {
        const pickup = song.pickupBeats ?? 0;
        for (const part of song.parts) {
          expect(part.advance, `${part.id} length`).toBeCloseTo(song.lengthBeats, 6);
          part.barLengths.forEach((len, i) => {
            const expected = i === 0 && pickup > 0 ? pickup : song.beatsPerBar;
            expect(len, `${part.id} bar ${i}`).toBeCloseTo(expected, 6);
          });
        }
      });

      it('fits the on-screen keyboard range', () => {
        for (const n of song.notes) {
          expect(n.midi).toBeGreaterThanOrEqual(KEYBOARD_LOW_MIDI);
          expect(n.midi).toBeLessThanOrEqual(KEYBOARD_HIGH_MIDI);
        }
      });

      it('keeps the melody mostly inside the recommended QWERTY window', () => {
        const base = (song.recommendedOctave + 1) * 12;
        const melodyIds = new Set(
          song.parts.filter((p) => p.role === 'melody').map((p) => p.id)
        );
        const melody = song.notes.filter((n) => melodyIds.has(n.partId));
        const inside = melody.filter(
          (n) => n.midi >= base && n.midi <= base + 24
        ).length;
        expect(inside / melody.length).toBeGreaterThanOrEqual(0.8);
      });
    });
  }
});
