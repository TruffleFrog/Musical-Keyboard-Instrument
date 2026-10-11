export type InstrumentId =
  | 'piano'
  | 'synth'
  | 'epiano'
  | 'bass'
  | 'chiptune'
  | 'organ';

export interface SynthParams {
  volume: number;       // 0.0 to 1.0
  attack: number;       // 0.002 to 0.5 seconds
  release: number;      // 0.05 to 2.5 seconds
  filterCutoff: number; // 200 to 12000 Hz
  detune: number;       // 0 to 30 cents
  reverbMix: number;    // 0.0 to 0.8
}

export interface InstrumentPreset {
  id: InstrumentId;
  name: string;
  category: string;
  tagline: string;
  accentColor: string;
  defaultParams: SynthParams;
}

export interface KeyBindingDefinition {
  semitoneOffset: number; // 0 to 24 (25 keys: C to C+2)
  code: string;           // e.g. 'KeyA'
  keyLabel: string;       // e.g. 'A'
  isSharp: boolean;
  noteBaseName: string;   // e.g. 'C', 'C#'
}

export interface VirtualKeyNote extends KeyBindingDefinition {
  midi: number;
  noteName: string;       // e.g. 'C4', 'C#4'
  octave: number;
  frequency: number;
}

export interface SongNote {
  note: string;           // e.g. 'E4'
  midi: number;           // e.g. 64
  durationBeats: number;  // e.g. 1, 0.5, 2
  lyricOrHint?: string;
}

export interface DemoSong {
  id: string;
  title: string;
  composer: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  bpm: number;
  recommendedInstrument: InstrumentId;
  recommendedOctave: number;
  description: string;
  notes: SongNote[];
}

export type DemoPlayMode = 'autoplay' | 'practice';

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
}

export type StudioTab = 'studio' | 'songs' | 'recorder';

export interface StudioPreferences {
  instrument: InstrumentId;
  baseOctave: number;
  sustain: boolean;
  showKeyLabels: boolean;
  showNoteNames: boolean;
  activeTab: StudioTab;
  customParamsByInstrument: Partial<Record<InstrumentId, SynthParams>>;
}
