import { DEFAULT_OCTAVE, MAX_OCTAVE, MIN_OCTAVE } from '../data/keyboardMap';
import { Recording, StudioPreferences } from '../types/music';

export const PREFERENCES_STORAGE_KEY = 'keyboard_studio_preferences_v1';
export const RECORDINGS_STORAGE_KEY = 'keyboard_studio_recordings_v1';

export const DEFAULT_PREFERENCES: StudioPreferences = {
  instrument: 'piano',
  baseOctave: DEFAULT_OCTAVE,
  sustain: false,
  showKeyLabels: true,
  showNoteNames: true,
  activeTab: 'studio',
  customParamsByInstrument: {},
};

export function loadPreferences(): StudioPreferences {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...DEFAULT_PREFERENCES };
  }

  try {
    const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFERENCES };
    const parsed = JSON.parse(raw) as Partial<StudioPreferences>;

    const baseOctave =
      typeof parsed.baseOctave === 'number'
        ? Math.max(MIN_OCTAVE, Math.min(MAX_OCTAVE, parsed.baseOctave))
        : DEFAULT_OCTAVE;

    return {
      ...DEFAULT_PREFERENCES,
      ...parsed,
      baseOctave,
      customParamsByInstrument: parsed.customParamsByInstrument ?? {},
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function savePreferences(prefs: StudioPreferences): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadRecordings(): Recording[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(RECORDINGS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveRecordings(recordings: Recording[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(
      RECORDINGS_STORAGE_KEY,
      JSON.stringify(recordings)
    );
  } catch {
    // Ignore storage quota errors
  }
}
