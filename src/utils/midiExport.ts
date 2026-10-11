import type { Song } from '../music/song';
import type { InstrumentId, Recording } from '../types/music';

/** General MIDI program numbers closest to each built-in sound. */
export const GM_PROGRAM: Record<InstrumentId, number> = {
  piano: 0, // Acoustic Grand Piano
  epiano: 4, // Electric Piano 1
  synth: 90, // Pad 3 (polysynth)
  bass: 38, // Synth Bass 1
  chiptune: 80, // Lead 1 (square)
  organ: 19, // Church Organ
};

export const PPQ = 480;

export interface MidiNote {
  /** Start in ticks. */
  tick: number;
  /** Length in ticks. */
  duration: number;
  midi: number;
  /** 1..127 */
  velocity: number;
}

export interface MidiTrackSpec {
  name: string;
  channel: number;
  program: number;
  notes: MidiNote[];
  /** Sustain pedal (CC64) changes. */
  pedal?: Array<{ tick: number; down: boolean }>;
}

export interface MidiFileSpec {
  name: string;
  /** Tempo in quarter-note beats per minute. */
  bpm: number;
  timeSignature?: { numerator: number; denominatorPower: number };
  tracks: MidiTrackSpec[];
}

/** Encodes a non-negative integer as a MIDI variable-length quantity. */
export function encodeVlq(value: number): number[] {
  let v = Math.max(0, Math.floor(value));
  const bytes: number[] = [v & 0x7f];
  v = Math.floor(v / 128);
  while (v > 0) {
    bytes.unshift((v & 0x7f) | 0x80);
    v = Math.floor(v / 128);
  }
  return bytes;
}

function ascii(text: string, max = 80): number[] {
  return Array.from(text)
    .map((ch) => {
      const c = ch.charCodeAt(0);
      return c >= 32 && c < 127 ? c : 63; // '?'
    })
    .slice(0, max);
}

function metaText(type: number, text: string): number[] {
  const bytes = ascii(text);
  return [0xff, type, ...encodeVlq(bytes.length), ...bytes];
}

function u32(n: number): number[] {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
}

interface RawEvent {
  tick: number;
  /** Sort priority at equal ticks: pedal-up/off first, then on. */
  order: number;
  bytes: number[];
}

function trackChunk(body: number[]): number[] {
  return [0x4d, 0x54, 0x72, 0x6b, ...u32(body.length), ...body];
}

function eventsToBytes(events: RawEvent[]): number[] {
  events.sort((a, b) => a.tick - b.tick || a.order - b.order);
  const out: number[] = [];
  let last = 0;
  for (const e of events) {
    out.push(...encodeVlq(Math.max(0, e.tick - last)), ...e.bytes);
    last = e.tick;
  }
  out.push(0x00, 0xff, 0x2f, 0x00); // End of track
  return out;
}

/** Encodes a Standard MIDI File (format 1: tempo track + one per part). */
export function encodeMidiFile(spec: MidiFileSpec): Uint8Array {
  const usPerQuarter = Math.round(60_000_000 / Math.max(10, spec.bpm));
  const ts = spec.timeSignature ?? { numerator: 4, denominatorPower: 2 };

  const tempo: RawEvent[] = [
    { tick: 0, order: 0, bytes: metaText(0x03, spec.name) },
    {
      tick: 0,
      order: 1,
      bytes: [
        0xff,
        0x51,
        0x03,
        (usPerQuarter >> 16) & 0xff,
        (usPerQuarter >> 8) & 0xff,
        usPerQuarter & 0xff,
      ],
    },
    {
      tick: 0,
      order: 2,
      bytes: [0xff, 0x58, 0x04, ts.numerator, ts.denominatorPower, 24, 8],
    },
  ];

  const chunks: number[][] = [trackChunk(eventsToBytes(tempo))];

  for (const track of spec.tracks) {
    const ch = track.channel & 0x0f;
    const events: RawEvent[] = [
      { tick: 0, order: 0, bytes: metaText(0x03, track.name) },
      { tick: 0, order: 1, bytes: [0xc0 | ch, track.program & 0x7f] },
    ];
    for (const n of track.notes) {
      const midi = Math.max(0, Math.min(127, n.midi));
      const vel = Math.max(1, Math.min(127, Math.round(n.velocity)));
      const start = Math.max(0, Math.round(n.tick));
      const len = Math.max(1, Math.round(n.duration));
      events.push({ tick: start, order: 3, bytes: [0x90 | ch, midi, vel] });
      events.push({ tick: start + len, order: 2, bytes: [0x80 | ch, midi, 64] });
    }
    for (const p of track.pedal ?? []) {
      events.push({
        tick: Math.max(0, Math.round(p.tick)),
        order: p.down ? 3 : 1,
        bytes: [0xb0 | ch, 64, p.down ? 127 : 0],
      });
    }
    chunks.push(trackChunk(eventsToBytes(events)));
  }

  const header = [
    0x4d, 0x54, 0x68, 0x64, // MThd
    ...u32(6),
    0x00, 0x01, // format 1
    (chunks.length >> 8) & 0xff,
    chunks.length & 0xff,
    (PPQ >> 8) & 0xff,
    PPQ & 0xff,
  ];
  return new Uint8Array([...header, ...chunks.flat()]);
}

/** MIDI channel for the nth track, skipping percussion channel 10 (index 9). */
function channelFor(index: number): number {
  const c = index % 15;
  return c >= 9 ? c + 1 : c;
}

/**
 * Converts a take to a MIDI file at a fixed 120 BPM (960 ticks per second),
 * one track per instrument used, with sustain-pedal events preserved.
 */
export function exportRecordingToMidi(recording: Recording): Uint8Array {
  const ticksPerMs = (PPQ * 2) / 1000;
  const byInstrument = new Map<InstrumentId, MidiNote[]>();
  for (const ev of recording.events) {
    const list = byInstrument.get(ev.instrument) ?? [];
    list.push({
      tick: ev.startTimeMs * ticksPerMs,
      duration: Math.max(40, ev.durationMs) * ticksPerMs,
      midi: ev.midi,
      velocity: ev.velocity * 127,
    });
    byInstrument.set(ev.instrument, list);
  }
  if (byInstrument.size === 0) byInstrument.set(recording.instrument, []);

  const pedal = (recording.pedal ?? []).map((p) => ({
    tick: p.timeMs * ticksPerMs,
    down: p.down,
  }));

  const tracks: MidiTrackSpec[] = [];
  let index = 0;
  for (const [instrument, notes] of byInstrument) {
    tracks.push({
      name: instrument,
      channel: channelFor(index),
      program: GM_PROGRAM[instrument],
      notes,
      pedal: index === 0 ? pedal : undefined,
    });
    index += 1;
  }
  return encodeMidiFile({ name: recording.name, bpm: 120, tracks });
}

/** Exports a built-in arrangement: one track per part, tempo preserved. */
export function exportSongToMidi(
  song: Song,
  enabledParts?: Set<string>
): Uint8Array {
  // MIDI tempo is per quarter note; our beat may be an eighth note.
  const quartersPerBeat = song.beatUnit === 'eighth' ? 0.5 : 1;
  const ticksPerBeat = PPQ * quartersPerBeat;
  const tracks: MidiTrackSpec[] = [];
  song.parts.forEach((part, index) => {
    if (enabledParts && !enabledParts.has(part.id)) return;
    tracks.push({
      name: part.name,
      channel: channelFor(index),
      program: GM_PROGRAM[song.recommendedInstrument],
      notes: song.notes
        .filter((n) => n.partId === part.id)
        .map((n) => ({
          tick: n.start * ticksPerBeat,
          duration: n.duration * ticksPerBeat,
          midi: n.midi,
          velocity: n.velocity * 127,
        })),
    });
  });
  const denominatorPower = song.beatUnit === 'eighth' ? 3 : 2;
  return encodeMidiFile({
    name: song.title,
    bpm: song.bpm * quartersPerBeat,
    timeSignature: { numerator: song.beatsPerBar, denominatorPower },
    tracks,
  });
}

export function safeFileName(name: string, fallback = 'keyboard-studio'): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '') || fallback
  );
}

/** Triggers a browser download of the given bytes. */
export function downloadBytes(
  fileName: string,
  bytes: Uint8Array,
  mime = 'audio/midi'
): void {
  const blob = new Blob([bytes as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
