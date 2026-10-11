import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_PREFERENCES,
  LEGACY_PREFERENCES_STORAGE_KEY,
  MAX_SAVED_TAKES,
  PREFERENCES_STORAGE_KEY,
  RECORDINGS_STORAGE_KEY,
  loadPreferences,
  loadRecordings,
  sanitizePreferences,
  savePreferences,
  saveRecordings,
} from '../utils/storage';
import type { Recording } from '../types/music';

describe('preferences', () => {
  beforeEach(() => window.localStorage.clear());

  it('returns defaults when nothing is stored', () => {
    expect(loadPreferences()).toEqual(DEFAULT_PREFERENCES);
  });

  it('round-trips saved preferences', () => {
    const prefs = {
      ...DEFAULT_PREFERENCES,
      instrument: 'organ' as const,
      octave: 3,
      masterVolume: 0.4,
      params: {
        organ: { brightness: 0.9, attack: 0.1, release: 0.2, reverb: 0.3, width: 0.4 },
      },
    };
    savePreferences(prefs);
    expect(loadPreferences()).toEqual(prefs);
  });

  it('sanitises hostile or corrupt data', () => {
    const p = sanitizePreferences({
      instrument: 'kazoo',
      octave: 99,
      masterVolume: 'loud',
      touch: -4,
      tab: 'admin',
      speed: 50,
      songMode: 'cheat',
      params: { piano: { brightness: 7 }, kazoo: {} },
    });
    expect(p.instrument).toBe('piano');
    expect(p.octave).toBe(5);
    expect(p.masterVolume).toBe(DEFAULT_PREFERENCES.masterVolume);
    expect(p.touch).toBeGreaterThanOrEqual(0.2);
    expect(p.tab).toBe('play');
    expect(p.speed).toBeLessThanOrEqual(1.6);
    expect(p.songMode).toBe('listen');
    expect(p.params.piano?.brightness).toBe(1);
    expect(Object.keys(p.params)).toEqual(['piano']);
  });

  it('survives invalid JSON', () => {
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, '{nope');
    expect(loadPreferences()).toEqual(DEFAULT_PREFERENCES);
  });

  it('migrates the first release\'s preferences', () => {
    window.localStorage.setItem(
      LEGACY_PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        instrument: 'synth',
        baseOctave: 3,
        sustain: true,
        showKeyLabels: false,
        showNoteNames: true,
        activeTab: 'songs',
        customParamsByInstrument: {},
      })
    );
    const p = loadPreferences();
    expect(p.instrument).toBe('synth');
    expect(p.octave).toBe(3);
    expect(p.showKeyLabels).toBe(false);
    expect(p.showNoteNames).toBe(true);
    expect(p.version).toBe(2);
  });
});

describe('recordings', () => {
  beforeEach(() => window.localStorage.clear());

  const take = (id: string): Recording => ({
    id,
    name: id,
    createdAt: '2026-01-01T00:00:00.000Z',
    durationMs: 1000,
    instrument: 'piano',
    events: [
      { id: 'a', midi: 60, noteName: 'C4', startTimeMs: 0, durationMs: 100, velocity: 0.8, instrument: 'piano' },
    ],
  });

  it('round-trips takes', () => {
    saveRecordings([take('a'), take('b')]);
    expect(loadRecordings().map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('keeps old takes that lack velocity or instrument fields', () => {
    window.localStorage.setItem(
      RECORDINGS_STORAGE_KEY,
      JSON.stringify([
        {
          id: 'old',
          name: 'Take #1 (Grand Piano)',
          createdAt: '2026-01-01',
          durationMs: 500,
          instrument: 'piano',
          events: [{ id: 'x', midi: 60, noteName: 'C4', startTimeMs: 0, durationMs: 100 }],
        },
      ])
    );
    const [r] = loadRecordings();
    expect(r.events[0].velocity).toBeGreaterThan(0);
    expect(r.events[0].instrument).toBe('piano');
  });

  it('drops garbage entries and caps the list', () => {
    const many = Array.from({ length: MAX_SAVED_TAKES + 10 }, (_, i) => take(`t${i}`));
    window.localStorage.setItem(
      RECORDINGS_STORAGE_KEY,
      JSON.stringify([null, 5, { id: 1 }, ...many])
    );
    expect(loadRecordings()).toHaveLength(MAX_SAVED_TAKES);
  });
});
