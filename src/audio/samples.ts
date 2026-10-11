/**
 * Sampled grand piano (Salamander Grand Piano, CC BY 3.0 - see
 * public/samples/piano/ATTRIBUTION.txt).
 *
 * One recording per minor third, re-pitched by at most +-1.5 semitones by the
 * sampler. Each file is decoded once, trimmed to its true onset and given a
 * loudness-matching gain so neighbouring keys have even volume.
 */

const NOTE_FILE: Record<number, string> = { 0: 'C', 3: 'Ds', 6: 'Fs', 9: 'A' };

export interface SampleZone {
  midi: number;
  file: string;
}

function buildZones(): SampleZone[] {
  const zones: SampleZone[] = [];
  for (let octave = 2; octave <= 6; octave++) {
    for (const offset of [0, 3, 6, 9]) {
      zones.push({
        midi: (octave + 1) * 12 + offset,
        file: `${NOTE_FILE[offset]}${octave}.mp3`,
      });
    }
  }
  zones.push({ midi: 96, file: 'C7.mp3' });
  return zones;
}

export const PIANO_ZONES: SampleZone[] = buildZones();

export interface LoadedZone {
  midi: number;
  buffer: AudioBuffer;
  /** Seconds of leading silence to skip. */
  onset: number;
  /** Loudness-matching gain. */
  gain: number;
}

export interface ZoneHit {
  buffer: AudioBuffer;
  rate: number;
  onset: number;
  gain: number;
}

export type LoadState = 'idle' | 'loading' | 'ready' | 'error';

function analyse(buffer: AudioBuffer): { onset: number; rms: number } {
  const sr = buffer.sampleRate;
  const ch = buffer.getChannelData(0);
  const limit = Math.min(ch.length, Math.floor(sr * 0.5));
  let first = 0;
  for (let i = 0; i < limit; i++) {
    if (Math.abs(ch[i]) > 0.004) {
      first = i;
      break;
    }
  }
  // Start a hair before the first audible sample so the attack is intact.
  const startIdx = Math.max(0, first - Math.floor(sr * 0.0015));
  const end = Math.min(ch.length, startIdx + Math.floor(sr * 0.6));
  let sum = 0;
  for (let i = startIdx; i < end; i++) sum += ch[i] * ch[i];
  const rms = Math.sqrt(sum / Math.max(1, end - startIdx));
  return { onset: startIdx / sr, rms };
}

export class SampleBank {
  private zones: LoadedZone[] = [];
  private state: LoadState = 'idle';
  private loading: Promise<void> | null = null;

  getState(): LoadState {
    return this.state;
  }

  isReady(): boolean {
    return this.state === 'ready';
  }

  load(
    ctx: BaseAudioContext,
    baseUrl: string,
    onProgress?: (done: number, total: number) => void
  ): Promise<void> {
    if (this.loading) return this.loading;
    this.state = 'loading';
    let done = 0;

    const fetchOne = async (zone: SampleZone) => {
      const res = await fetch(`${baseUrl}${zone.file}`);
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${zone.file}`);
      const data = await res.arrayBuffer();
      const buffer = await ctx.decodeAudioData(data);
      const { onset, rms } = analyse(buffer);
      done += 1;
      onProgress?.(done, PIANO_ZONES.length);
      return { midi: zone.midi, buffer, onset, rms };
    };

    this.loading = Promise.all(PIANO_ZONES.map(fetchOne))
      .then((loaded) => {
        const sorted = loaded.map((l) => l.rms).sort((a, b) => a - b);
        const target = sorted[Math.floor(sorted.length / 2)] || 0.1;
        this.zones = loaded
          .map((l) => ({
            midi: l.midi,
            buffer: l.buffer,
            onset: l.onset,
            gain: l.rms > 1e-5 ? Math.max(0.45, Math.min(2.2, target / l.rms)) : 1,
          }))
          .sort((a, b) => a.midi - b.midi);
        this.state = 'ready';
      })
      .catch((err) => {
        this.state = 'error';
        this.loading = null;
        throw err;
      });
    return this.loading;
  }

  zoneFor(midi: number): ZoneHit | null {
    if (this.zones.length === 0) return null;
    let best = this.zones[0];
    for (const z of this.zones) {
      if (Math.abs(z.midi - midi) < Math.abs(best.midi - midi)) best = z;
    }
    return {
      buffer: best.buffer,
      rate: Math.pow(2, (midi - best.midi) / 12),
      onset: best.onset,
      gain: best.gain,
    };
  }
}
