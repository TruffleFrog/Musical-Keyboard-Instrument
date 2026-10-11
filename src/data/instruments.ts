import type {
  InstrumentId,
  InstrumentPreset,
  ToneParamKey,
  ToneParams,
} from '../types/music';

const ALL: ToneParamKey[] = ['brightness', 'attack', 'release', 'reverb', 'width'];
const NO_ATTACK: ToneParamKey[] = ['brightness', 'release', 'reverb', 'width'];

export const INSTRUMENT_PRESETS: InstrumentPreset[] = [
  {
    id: 'piano',
    name: 'Grand Piano',
    caption: 'Sampled concert grand',
    tagline:
      'Recorded Yamaha C5 (Salamander, CC BY 3.0) with velocity-shaped tone, damper release and stereo spread.',
    defaults: { brightness: 0.62, attack: 0.1, release: 0.42, reverb: 0.2, width: 0.55 },
    widthLabel: 'Stereo',
    controls: NO_ATTACK,
    attackRange: [0.002, 0.02],
    releaseRange: [0.12, 1.4],
  },
  {
    id: 'epiano',
    name: 'Electric Piano',
    caption: 'Tine model + tremolo',
    tagline:
      'Rhodes-style tine and tone-bar model: velocity-dependent bark, pickup saturation, chorus and tremolo.',
    defaults: { brightness: 0.55, attack: 0.1, release: 0.5, reverb: 0.22, width: 0.45 },
    widthLabel: 'Tremolo',
    controls: NO_ATTACK,
    attackRange: [0.002, 0.04],
    releaseRange: [0.15, 1.8],
  },
  {
    id: 'synth',
    name: 'Poly Synth',
    caption: 'Analog-style pad / lead',
    tagline:
      'Unison saws with a 24 dB resonant filter that opens with every key press, plus stereo chorus.',
    defaults: { brightness: 0.5, attack: 0.28, release: 0.42, reverb: 0.3, width: 0.5 },
    widthLabel: 'Unison',
    controls: ALL,
    attackRange: [0.004, 0.9],
    releaseRange: [0.08, 2.2],
  },
  {
    id: 'bass',
    name: 'Funk Bass',
    caption: 'Saw + sub pluck',
    tagline:
      'Mono-style synth bass: sub sine under a saw with a snappy resonant filter envelope. Plays one octave low.',
    defaults: { brightness: 0.5, attack: 0.05, release: 0.3, reverb: 0.05, width: 0.35 },
    widthLabel: 'Drive',
    controls: ALL,
    attackRange: [0.002, 0.08],
    releaseRange: [0.05, 0.8],
  },
  {
    id: 'chiptune',
    name: '8-Bit Chip',
    caption: 'Pulse + triangle',
    tagline:
      'Band-limited 25% pulse with a triangle sub and delayed vibrato, like an old console sound chip.',
    defaults: { brightness: 0.7, attack: 0.05, release: 0.2, reverb: 0.06, width: 0.4 },
    widthLabel: 'Vibrato',
    controls: ALL,
    attackRange: [0.001, 0.06],
    releaseRange: [0.01, 0.5],
  },
  {
    id: 'organ',
    name: 'Pipe Organ',
    caption: 'Additive pipes',
    tagline:
      'Principal, octave and mixture ranks with a breath of key chiff and slow chorus, tuned for a big room.',
    defaults: { brightness: 0.55, attack: 0.25, release: 0.3, reverb: 0.45, width: 0.5 },
    widthLabel: 'Rotary',
    controls: ALL,
    attackRange: [0.005, 0.5],
    releaseRange: [0.04, 1.2],
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

export function resolveParams(
  id: InstrumentId,
  custom?: Partial<ToneParams> | null
): ToneParams {
  return { ...getInstrumentPreset(id).defaults, ...(custom ?? {}) };
}

/** Exponential interpolation, used for time-like controls. */
export function expRange(min: number, max: number, t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return min * Math.pow(max / min, c);
}

export function attackSeconds(id: InstrumentId, p: ToneParams): number {
  const [min, max] = getInstrumentPreset(id).attackRange;
  return expRange(min, max, p.attack);
}

export function releaseSeconds(id: InstrumentId, p: ToneParams): number {
  const [min, max] = getInstrumentPreset(id).releaseRange;
  return expRange(min, max, p.release);
}
