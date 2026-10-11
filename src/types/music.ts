export type InstrumentId =
  | 'piano'
  | 'epiano'
  | 'synth'
  | 'bass'
  | 'chiptune'
  | 'organ';

/**
 * Normalised 0..1 tone controls shared by every instrument. Each instrument
 * maps them to physical values (seconds, Hz...) itself.
 */
export interface ToneParams {
  brightness: number;
  attack: number;
  release: number;
  reverb: number;
  /** Instrument-specific "character" control: stereo width, tremolo, unison... */
  width: number;
}

export type ToneParamKey = keyof ToneParams;

export interface InstrumentPreset {
  id: InstrumentId;
  name: string;
  /** Short caption under the name, e.g. "Sampled · Yamaha C5". */
  caption: string;
  tagline: string;
  defaults: ToneParams;
  /** What the "width" knob is called for this instrument. */
  widthLabel: string;
  /** Knobs that actually do something for this instrument. */
  controls: ToneParamKey[];
  /** [min, max] seconds for the attack knob. */
  attackRange: [number, number];
  /** [min, max] seconds for the release knob. */
  releaseRange: [number, number];
}

export interface KeyBindingDefinition {
  /** Semitones above the window's lowest C (0..24). */
  semitoneOffset: number;
  code: string;
  keyLabel: string;
  isSharp: boolean;
  noteBaseName: string;
}

export interface VirtualKeyNote extends KeyBindingDefinition {
  midi: number;
  noteName: string;
  octave: number;
  frequency: number;
}

export type StudioTab = 'play' | 'songs' | 'record';

export type SongMode = 'listen' | 'learn';

export interface RecordedNoteEvent {
  id: string;
  midi: number;
  noteName: string;
  startTimeMs: number;
  durationMs: number;
  velocity: number;
  instrument: InstrumentId;
}

export interface Recording {
  id: string;
  name: string;
  createdAt: string;
  durationMs: number;
  instrument: InstrumentId;
  events: RecordedNoteEvent[];
  /** Sustain pedal changes, if any were captured. */
  pedal?: Array<{ timeMs: number; down: boolean }>;
}

export interface StudioPreferences {
  version: 2;
  instrument: InstrumentId;
  octave: number;
  masterVolume: number;
  /** Fixed velocity (0..1) used for computer-keyboard notes. */
  touch: number;
  params: Partial<Record<InstrumentId, ToneParams>>;
  showKeyLabels: boolean;
  showNoteNames: boolean;
  tab: StudioTab;
  songId: string;
  speed: number;
  songMode: SongMode;
  loop: boolean;
  melodyOnly: boolean;
  learnAccompaniment: boolean;
  /** When true, picking a song also switches to its recommended sound. */
  autoSound: boolean;
}
