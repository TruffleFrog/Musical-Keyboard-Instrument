import { InstrumentId, InstrumentPreset } from '../types/music';

export const INSTRUMENT_PRESETS: InstrumentPreset[] = [
  {
    id: 'piano',
    name: 'Grand Piano',
    category: 'Acoustic Keys',
    tagline: 'Rich harmonic overtones with hammer transient & natural decay',
    accentColor: '#f59e0b',
    defaultParams: {
      volume: 0.8,
      attack: 0.008,
      release: 0.65,
      filterCutoff: 4800,
      detune: 4,
      reverbMix: 0.28,
    },
  },
  {
    id: 'synth',
    name: 'Warm Polysynth',
    category: 'Analog Synth',
    tagline: 'Dual detuned sawtooth oscillators with resonant filter sweep',
    accentColor: '#38bdf8',
    defaultParams: {
      volume: 0.75,
      attack: 0.045,
      release: 0.55,
      filterCutoff: 3200,
      detune: 14,
      reverbMix: 0.35,
    },
  },
  {
    id: 'epiano',
    name: 'Electric Rhodes',
    category: 'Vintage Keys',
    tagline: 'Warm fundamental body paired with crystalline bell tine harmonics',
    accentColor: '#a855f7',
    defaultParams: {
      volume: 0.8,
      attack: 0.01,
      release: 0.75,
      filterCutoff: 3600,
      detune: 6,
      reverbMix: 0.32,
    },
  },
  {
    id: 'bass',
    name: 'Funk Synth Bass',
    category: 'Low-End Mono/Poly',
    tagline: 'Punchy saw + sub-octave square with snappy resonant filter pluck',
    accentColor: '#10b981',
    defaultParams: {
      volume: 0.85,
      attack: 0.005,
      release: 0.22,
      filterCutoff: 1800,
      detune: 5,
      reverbMix: 0.08,
    },
  },
  {
    id: 'chiptune',
    name: '8-Bit Chiptune',
    category: 'Retro Console',
    tagline: 'Crisp pulse wave + sub-triangle with classic arcade pitch vibrato',
    accentColor: '#f43f5e',
    defaultParams: {
      volume: 0.72,
      attack: 0.003,
      release: 0.14,
      filterCutoff: 7500,
      detune: 2,
      reverbMix: 0.1,
    },
  },
  {
    id: 'organ',
    name: 'Cathedral Organ',
    category: 'Additive Drawbar',
    tagline: 'Multi-rank drawbar harmonics (8\', 4\', 2⅔\', 2\') with rotary shimmer',
    accentColor: '#eab308',
    defaultParams: {
      volume: 0.75,
      attack: 0.06,
      release: 0.4,
      filterCutoff: 5400,
      detune: 9,
      reverbMix: 0.48,
    },
  },
];

export const INSTRUMENT_MAP: Record<InstrumentId, InstrumentPreset> =
  Object.fromEntries(INSTRUMENT_PRESETS.map((p) => [p.id, p])) as Record<
    InstrumentId,
    InstrumentPreset
  >;

export function getInstrumentPreset(id: InstrumentId): InstrumentPreset {
  return INSTRUMENT_MAP[id] ?? INSTRUMENT_PRESETS[0];
}
