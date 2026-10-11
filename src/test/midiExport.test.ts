import { describe, expect, it } from 'vitest';
import { encodeVlq, exportRecordingToMidi } from '../utils/midiExport';
import { Recording } from '../types/music';

describe('Standard MIDI File binary exporter', () => {
  it('encodes Variable-Length Quantities (VLQ) accurately', () => {
    expect(encodeVlq(0)).toEqual([0x00]);
    expect(encodeVlq(127)).toEqual([0x7f]);
    expect(encodeVlq(128)).toEqual([0x81, 0x00]);
    expect(encodeVlq(480)).toEqual([0x83, 0x60]);
  });

  it('exports a valid SMF Format 0 binary with MThd, MTrk, NoteOn/NoteOff, and EOT', () => {
    const sampleRecording: Recording = {
      id: 'rec-test',
      name: 'Test Melody',
      createdAt: new Date().toISOString(),
      durationMs: 1200,
      instrument: 'piano',
      events: [
        {
          id: 'ev-1',
          midi: 60,
          noteName: 'C4',
          startTimeMs: 0,
          durationMs: 500,
          velocity: 0.85,
          instrument: 'piano',
        },
        {
          id: 'ev-2',
          midi: 64,
          noteName: 'E4',
          startTimeMs: 500,
          durationMs: 500,
          velocity: 0.85,
          instrument: 'piano',
        },
      ],
    };

    const midiBytes = exportRecordingToMidi(sampleRecording);

    // Check "MThd" magic bytes
    const headerMagic = String.fromCharCode(
      midiBytes[0],
      midiBytes[1],
      midiBytes[2],
      midiBytes[3]
    );
    expect(headerMagic).toBe('MThd');

    // Check "MTrk" chunk magic at offset 14
    const trackMagic = String.fromCharCode(
      midiBytes[14],
      midiBytes[15],
      midiBytes[16],
      midiBytes[17]
    );
    expect(trackMagic).toBe('MTrk');

    // Check End of Track meta event (0xFF 0x2F 0x00) at the end
    const len = midiBytes.length;
    expect(midiBytes[len - 3]).toBe(0xff);
    expect(midiBytes[len - 2]).toBe(0x2f);
    expect(midiBytes[len - 1]).toBe(0x00);

    // Verify NoteOn (0x90) for MIDI 60 and 64 exist in payload
    const payload = Array.from(midiBytes);
    expect(payload).toContain(0x90);
    expect(payload).toContain(60);
    expect(payload).toContain(64);
  });
});
