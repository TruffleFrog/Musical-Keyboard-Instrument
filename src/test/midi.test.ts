import { describe, expect, it } from 'vitest';
import {
  encodeMidiFile,
  encodeVlq,
  exportRecordingToMidi,
  exportSongToMidi,
} from '../utils/midiExport';
import { SONGS } from '../music/songs';
import type { Recording } from '../types/music';

/** Tiny SMF reader sufficient for assertions. */
function parse(bytes: Uint8Array) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (o: number, n: number) =>
    String.fromCharCode(...bytes.slice(o, o + n));
  expect(ascii(0, 4)).toBe('MThd');
  const format = dv.getUint16(8);
  const trackCount = dv.getUint16(10);
  const ppq = dv.getUint16(12);
  let o = 14;
  const tracks: Array<{
    notesOn: Array<{ tick: number; ch: number; note: number; vel: number }>;
    notesOff: number;
    cc64: Array<{ tick: number; value: number }>;
    programs: number[];
    tempo?: number;
    timeSig?: number[];
    ended: boolean;
  }> = [];
  for (let t = 0; t < trackCount; t++) {
    expect(ascii(o, 4)).toBe('MTrk');
    const len = dv.getUint32(o + 4);
    let p = o + 8;
    const end = p + len;
    const tr = {
      notesOn: [] as Array<{ tick: number; ch: number; note: number; vel: number }>,
      notesOff: 0,
      cc64: [] as Array<{ tick: number; value: number }>,
      programs: [] as number[],
      tempo: undefined as number | undefined,
      timeSig: undefined as number[] | undefined,
      ended: false,
    };
    let tick = 0;
    let running = 0;
    const vlq = () => {
      let v = 0;
      for (;;) {
        const b = bytes[p++];
        v = (v << 7) | (b & 0x7f);
        if (!(b & 0x80)) return v;
      }
    };
    while (p < end) {
      tick += vlq();
      let status = bytes[p];
      if (status < 0x80) status = running;
      else p++;
      running = status;
      if (status === 0xff) {
        const type = bytes[p++];
        const mlen = vlq();
        if (type === 0x51) tr.tempo = (bytes[p] << 16) | (bytes[p + 1] << 8) | bytes[p + 2];
        if (type === 0x58) tr.timeSig = [bytes[p], bytes[p + 1]];
        if (type === 0x2f) tr.ended = true;
        p += mlen;
      } else {
        const hi = status & 0xf0;
        if (hi === 0x90) {
          tr.notesOn.push({ tick, ch: status & 0x0f, note: bytes[p], vel: bytes[p + 1] });
          p += 2;
        } else if (hi === 0x80) {
          tr.notesOff += 1;
          p += 2;
        } else if (hi === 0xb0) {
          if (bytes[p] === 64) tr.cc64.push({ tick, value: bytes[p + 1] });
          p += 2;
        } else if (hi === 0xc0) {
          tr.programs.push(bytes[p]);
          p += 1;
        } else {
          p += 2;
        }
      }
    }
    expect(p).toBe(end);
    tracks.push(tr);
    o = end;
  }
  expect(o).toBe(bytes.length);
  return { format, trackCount, ppq, tracks };
}

describe('encodeVlq', () => {
  it('matches the SMF examples', () => {
    expect(encodeVlq(0)).toEqual([0x00]);
    expect(encodeVlq(0x7f)).toEqual([0x7f]);
    expect(encodeVlq(0x80)).toEqual([0x81, 0x00]);
    expect(encodeVlq(0x2000)).toEqual([0xc0, 0x00]);
    expect(encodeVlq(0x3fff)).toEqual([0xff, 0x7f]);
    expect(encodeVlq(0x100000)).toEqual([0xc0, 0x80, 0x00]);
  });
});

describe('recording export', () => {
  const rec: Recording = {
    id: 'r',
    name: 'Take 1',
    createdAt: '',
    durationMs: 2000,
    instrument: 'piano',
    events: [
      { id: '1', midi: 60, noteName: 'C4', startTimeMs: 0, durationMs: 500, velocity: 0.5, instrument: 'piano' },
      { id: '2', midi: 64, noteName: 'E4', startTimeMs: 500, durationMs: 500, velocity: 1, instrument: 'piano' },
      { id: '3', midi: 36, noteName: 'C2', startTimeMs: 1000, durationMs: 500, velocity: 0.8, instrument: 'bass' },
    ],
    pedal: [
      { timeMs: 100, down: true },
      { timeMs: 900, down: false },
    ],
  };

  it('writes a valid format-1 file with matching note on/off counts', () => {
    const m = parse(exportRecordingToMidi(rec));
    expect(m.format).toBe(1);
    expect(m.ppq).toBe(480);
    // tempo track + one per instrument
    expect(m.trackCount).toBe(3);
    expect(m.tracks.every((t) => t.ended)).toBe(true);
    const all = m.tracks.flatMap((t) => t.notesOn);
    expect(all).toHaveLength(3);
    expect(m.tracks.reduce((n, t) => n + t.notesOff, 0)).toBe(3);
    expect(m.tracks[0].tempo).toBe(500000); // 120 BPM
  });

  it('preserves timing at 960 ticks per second and velocity', () => {
    const m = parse(exportRecordingToMidi(rec));
    const piano = m.tracks[1].notesOn;
    expect(piano[0]).toMatchObject({ tick: 0, note: 60, vel: 64 });
    expect(piano[1]).toMatchObject({ tick: 480, note: 64, vel: 127 });
  });

  it('keeps sustain pedal events and per-instrument programs', () => {
    const m = parse(exportRecordingToMidi(rec));
    expect(m.tracks[1].cc64).toEqual([
      { tick: 96, value: 127 },
      { tick: 864, value: 0 },
    ]);
    expect(m.tracks[1].programs).toEqual([0]);
    expect(m.tracks[2].programs).toEqual([38]);
  });

  it('never uses the percussion channel', () => {
    const many: Recording = {
      ...rec,
      events: (['piano', 'epiano', 'synth', 'bass', 'chiptune', 'organ'] as const).map(
        (instrument, i) => ({
          id: String(i),
          midi: 60 + i,
          noteName: 'x',
          startTimeMs: i * 100,
          durationMs: 100,
          velocity: 0.7,
          instrument,
        })
      ),
    };
    const m = parse(exportRecordingToMidi(many));
    const channels = m.tracks.flatMap((t) => t.notesOn.map((n) => n.ch));
    expect(channels).not.toContain(9);
  });

  it('exports an empty take without throwing', () => {
    const m = parse(exportRecordingToMidi({ ...rec, events: [], pedal: undefined }));
    expect(m.tracks.every((t) => t.ended)).toBe(true);
  });
});

describe('song export', () => {
  it('writes one track per part with all notes', () => {
    for (const song of SONGS) {
      const m = parse(exportSongToMidi(song));
      expect(m.trackCount).toBe(song.parts.length + 1);
      const total = m.tracks.reduce((n, t) => n + t.notesOn.length, 0);
      expect(total).toBe(song.notes.length);
    }
  });

  it('converts the tempo to quarter notes for eighth-note beats', () => {
    const elise = SONGS.find((s) => s.id === 'fur-elise')!;
    const m = parse(exportSongToMidi(elise));
    // beat = eighth at 132 => 66 quarter-note BPM
    expect(m.tracks[0].tempo).toBe(Math.round(60_000_000 / 66));
    expect(m.tracks[0].timeSig).toEqual([3, 3]); // 3/8
  });

  it('can export a subset of parts', () => {
    const song = SONGS[0];
    const m = parse(exportSongToMidi(song, new Set(['melody'])));
    expect(m.trackCount).toBe(2);
  });
});

describe('encodeMidiFile', () => {
  it('clamps out-of-range values instead of corrupting the file', () => {
    const bytes = encodeMidiFile({
      name: 'x',
      bpm: 120,
      tracks: [
        {
          name: 't',
          channel: 3,
          program: 0,
          notes: [{ tick: -5, duration: 0, midi: 300, velocity: 999 }],
        },
      ],
    });
    const m = parse(bytes);
    expect(m.tracks[1].notesOn[0]).toMatchObject({ note: 127, vel: 127, tick: 0 });
  });
});
