import { DEFAULT_OCTAVE, MAX_OCTAVE, MIN_OCTAVE } from '../data/keyboardMap';
import { INSTRUMENT_MAP } from '../data/instruments';
import type {
  InstrumentId,
  Recording,
  SongMode,
  StudioPreferences,
  StudioTab,
  ToneParams,
} from '../types/music';

export const PREFERENCES_STORAGE_KEY = 'keyboard_studio_preferences_v2';
export const LEGACY_PREFERENCES_STORAGE_KEY = 'keyboard_studio_preferences_v1';
export const RECORDINGS_STORAGE_KEY = 'keyboard_studio_recordings_v1';
export const MAX_SAVED_TAKES = 40;

export const DEFAULT_PREFERENCES: StudioPreferences = {
  version: 2,
  instrument: 'piano',
  octave: DEFAULT_OCTAVE,
  masterVolume: 0.8,
  touch: 0.75,
  params: {},
  showKeyLabels: true,
  showNoteNames: false,
  tab: 'play',
  songId: 'ode-to-joy',
  speed: 1,
  songMode: 'listen',
  loop: false,
  melodyOnly: false,
  learnAccompaniment: true,
  autoSound: true,
};

const TABS: StudioTab[] = ['play', 'songs', 'record'];
const MODES: SongMode[] = ['listen', 'learn'];

const clamp = (n: unknown, lo: number, hi: number, fallback: number): number =>
  typeof n === 'number' && Number.isFinite(n)
    ? Math.max(lo, Math.min(hi, n))
    : fallback;

const bool = (v: unknown, fallback: boolean): boolean =>
  typeof v === 'boolean' ? v : fallback;

function sanitizeTone(raw: unknown): ToneParams | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const out: ToneParams = {
    brightness: clamp(r.brightness, 0, 1, 0.5),
    attack: clamp(r.attack, 0, 1, 0.1),
    release: clamp(r.release, 0, 1, 0.4),
    reverb: clamp(r.reverb, 0, 1, 0.2),
    width: clamp(r.width, 0, 1, 0.5),
  };
  return out;
}

/** Coerces untrusted JSON into a valid preferences object. */
export function sanitizePreferences(raw: unknown): StudioPreferences {
  const d = DEFAULT_PREFERENCES;
  if (!raw || typeof raw !== 'object') return { ...d, params: {} };
  const r = raw as Record<string, unknown>;

  const params: StudioPreferences['params'] = {};
  if (r.params && typeof r.params === 'object') {
    for (const [id, value] of Object.entries(r.params as object)) {
      if (id in INSTRUMENT_MAP) {
        const tone = sanitizeTone(value);
        if (tone) params[id as InstrumentId] = tone;
      }
    }
  }

  return {
    version: 2,
    instrument:
      typeof r.instrument === 'string' && r.instrument in INSTRUMENT_MAP
        ? (r.instrument as InstrumentId)
        : d.instrument,
    octave: Math.round(clamp(r.octave, MIN_OCTAVE, MAX_OCTAVE, d.octave)),
    masterVolume: clamp(r.masterVolume, 0, 1, d.masterVolume),
    touch: clamp(r.touch, 0.2, 1, d.touch),
    params,
    showKeyLabels: bool(r.showKeyLabels, d.showKeyLabels),
    showNoteNames: bool(r.showNoteNames, d.showNoteNames),
    tab: TABS.includes(r.tab as StudioTab) ? (r.tab as StudioTab) : d.tab,
    songId: typeof r.songId === 'string' ? r.songId : d.songId,
    speed: clamp(r.speed, 0.4, 1.6, d.speed),
    songMode: MODES.includes(r.songMode as SongMode)
      ? (r.songMode as SongMode)
      : d.songMode,
    loop: bool(r.loop, d.loop),
    melodyOnly: bool(r.melodyOnly, d.melodyOnly),
    learnAccompaniment: bool(r.learnAccompaniment, d.learnAccompaniment),
    autoSound: bool(r.autoSound, d.autoSound),
  };
}

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function loadPreferences(): StudioPreferences {
  const ls = storage();
  if (!ls) return sanitizePreferences(null);
  try {
    const raw = ls.getItem(PREFERENCES_STORAGE_KEY);
    if (raw) return sanitizePreferences(JSON.parse(raw));

    // One-time migration from the first release's preferences.
    const legacy = ls.getItem(LEGACY_PREFERENCES_STORAGE_KEY);
    if (legacy) {
      const old = JSON.parse(legacy) as Record<string, unknown>;
      return sanitizePreferences({
        instrument: old.instrument,
        octave: old.baseOctave,
        showKeyLabels: old.showKeyLabels,
        showNoteNames: old.showNoteNames,
      });
    }
  } catch {
    /* fall through to defaults */
  }
  return sanitizePreferences(null);
}

export function savePreferences(prefs: StudioPreferences): void {
  const ls = storage();
  if (!ls) return;
  try {
    ls.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* quota or privacy mode: ignore */
  }
}

function sanitizeRecording(raw: unknown): Recording | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<Recording>;
  if (typeof r.id !== 'string' || !Array.isArray(r.events)) return null;
  const instrument =
    typeof r.instrument === 'string' && r.instrument in INSTRUMENT_MAP
      ? (r.instrument as InstrumentId)
      : 'piano';
  const events = r.events
    .filter(
      (e) =>
        e &&
        typeof e.midi === 'number' &&
        typeof e.startTimeMs === 'number' &&
        typeof e.durationMs === 'number'
    )
    .map((e) => ({
      ...e,
      velocity: clamp(e.velocity, 0.05, 1, 0.75),
      instrument:
        typeof e.instrument === 'string' && e.instrument in INSTRUMENT_MAP
          ? e.instrument
          : instrument,
    }));
  return {
    id: r.id,
    name: typeof r.name === 'string' ? r.name : 'Take',
    createdAt:
      typeof r.createdAt === 'string' ? r.createdAt : new Date(0).toISOString(),
    durationMs: typeof r.durationMs === 'number' ? r.durationMs : 0,
    instrument,
    events,
    pedal: Array.isArray(r.pedal)
      ? r.pedal.filter(
          (p) => p && typeof p.timeMs === 'number' && typeof p.down === 'boolean'
        )
      : undefined,
  };
}

export function loadRecordings(): Recording[] {
  const ls = storage();
  if (!ls) return [];
  try {
    const raw = ls.getItem(RECORDINGS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(sanitizeRecording)
      .filter((r): r is Recording => r !== null)
      .slice(0, MAX_SAVED_TAKES);
  } catch {
    return [];
  }
}

export function saveRecordings(recordings: Recording[]): void {
  const ls = storage();
  if (!ls) return;
  try {
    ls.setItem(
      RECORDINGS_STORAGE_KEY,
      JSON.stringify(recordings.slice(0, MAX_SAVED_TAKES))
    );
  } catch {
    /* quota exceeded: keep working in memory */
  }
}
