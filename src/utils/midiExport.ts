import { InstrumentId, Recording } from '../types/music';

const GM_PROGRAM_BY_INSTRUMENT: Record<InstrumentId, number> = {
  piano: 0,     // Acoustic Grand Piano
  synth: 81,    // Lead 2 (Sawtooth)
  epiano: 4,    // Electric Piano 1 (Rhodes)
  bass: 38,     // Synth Bass 1
  chiptune: 80, // Lead 1 (Square)
  organ: 19,    // Church Organ
};

/**
 * Encodes a non-negative integer as a MIDI Variable-Length Quantity (VLQ).
 */
export function encodeVlq(value: number): number[] {
  let v = Math.max(0, Math.floor(value));
  const bytes: number[] = [v & 0x7f];
  v >>= 7;
  while (v > 0) {
    bytes.unshift((v & 0x7f) | 0x80);
    v >>= 7;
  }
  return bytes;
}

/**
 * Encodes a Recording into a Standard MIDI File (Format 0) Uint8Array.
 * Uses 480 ticks per quarter note at 120 BPM (960 ticks per second).
 */
export function exportRecordingToMidi(recording: Recording): Uint8Array {
  const ticksPerSecond = 960; // 480 TPQN @ 120 BPM

  interface RawMidiTimelineEvent {
    tick: number;
    type: 'on' | 'off';
    midi: number;
    velocity: number;
  }

  const timeline: RawMidiTimelineEvent[] = [];

  for (const ev of recording.events) {
    const startTick = Math.max(
      0,
      Math.round((ev.startTimeMs / 1000) * ticksPerSecond)
    );
    const durationTicks = Math.max(
      24,
      Math.round((Math.max(40, ev.durationMs) / 1000) * ticksPerSecond)
    );
    const vel = Math.max(1, Math.min(127, Math.round(ev.velocity * 127)));
    const midiNote = Math.max(0, Math.min(127, ev.midi));

    timeline.push({
      tick: startTick,
      type: 'on',
      midi: midiNote,
      velocity: vel,
    });
    timeline.push({
      tick: startTick + durationTicks,
      type: 'off',
      midi: midiNote,
      velocity: 64,
    });
  }

  timeline.sort((a, b) => {
    if (a.tick !== b.tick) return a.tick - b.tick;
    // Note-off before note-on at identical tick to avoid cutting retriggered notes
    if (a.type !== b.type) return a.type === 'off' ? -1 : 1;
    return a.midi - b.midi;
  });

  const trackBytes: number[] = [];

  // Track Name Meta Event (0xFF 0x03)
  const titleAscii = Array.from(recording.name || 'Keyboard Studio Recording')
    .map((ch) => ch.charCodeAt(0) & 0x7f)
    .slice(0, 64);
  trackBytes.push(0x00, 0xff, 0x03, ...encodeVlq(titleAscii.length), ...titleAscii);

  // Set Tempo Meta Event: 120 BPM = 500,000 microseconds/quarter-note (0x07A120)
  trackBytes.push(0x00, 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20);

  // Program Change on Channel 0
  const gmProgram = GM_PROGRAM_BY_INSTRUMENT[recording.instrument] ?? 0;
  trackBytes.push(0x00, 0xc0, gmProgram & 0x7f);

  let lastTick = 0;
  for (const item of timeline) {
    const delta = Math.max(0, item.tick - lastTick);
    lastTick = item.tick;
    trackBytes.push(...encodeVlq(delta));
    if (item.type === 'on') {
      trackBytes.push(0x90, item.midi, item.velocity);
    } else {
      trackBytes.push(0x80, item.midi, item.velocity);
    }
  }

  // End of Track Meta Event
  trackBytes.push(0x00, 0xff, 0x2f, 0x00);

  const trackLength = trackBytes.length;

  const headerBytes = [
    // "MThd"
    0x4d, 0x54, 0x68, 0x64,
    // Header length = 6
    0x00, 0x00, 0x00, 0x06,
    // Format 0
    0x00, 0x00,
    // 1 Track
    0x00, 0x01,
    // 480 Ticks Per Quarter Note (0x01E0)
    0x01, 0xe0,
    // "MTrk"
    0x4d, 0x54, 0x72, 0x6b,
    // Track byte length (32-bit big endian)
    (trackLength >>> 24) & 0xff,
    (trackLength >>> 16) & 0xff,
    (trackLength >>> 8) & 0xff,
    trackLength & 0xff,
  ];

  return new Uint8Array([...headerBytes, ...trackBytes]);
}

/**
 * Triggers a browser file download for a Recording's .mid file.
 */
export function downloadRecordingAsMidi(recording: Recording): void {
  const bytes = exportRecordingToMidi(recording);
  const blob = new Blob([bytes], { type: 'audio/midi' });
  const url = URL.createObjectURL(blob);
  const safeName =
    recording.name
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/^-|-$/g, '') || 'keyboard-studio-recording';

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${safeName}.mid`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
