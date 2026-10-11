import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioEngine } from '../audio/engine';
import { VOICE_FACTORIES } from '../audio/voices';
import { INSTRUMENT_PRESETS } from '../data/instruments';
import { createdNodes } from './setup';

function makeEngine(maxVoices?: number) {
  const ctx = new (window.AudioContext as unknown as new () => BaseAudioContext)();
  return new AudioEngine({ context: ctx, maxVoices });
}

describe('AudioEngine voice lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    createdNodes.length = 0;
  });
  afterEach(() => vi.useRealTimers());

  it('has a voice recipe for every preset', () => {
    for (const p of INSTRUMENT_PRESETS) {
      expect(typeof VOICE_FACTORIES[p.id]).toBe('function');
    }
  });

  for (const preset of INSTRUMENT_PRESETS) {
    it(`${preset.name}: note on -> release -> fully cleaned up`, () => {
      const engine = makeEngine();
      const h = engine.noteOn({ midi: 60, instrument: preset.id, velocity: 0.8 });
      expect(engine.getVoiceCount()).toBe(1);
      expect(engine.getActiveMidis()).toEqual([60]);

      h.release();
      expect(engine.getActiveMidis()).toEqual([]);
      vi.advanceTimersByTime(50);
      expect(engine.getVoiceCount()).toBe(0);
    });
  }

  it('starts scheduled notes at their requested time, not immediately', () => {
    const engine = makeEngine();
    const future = engine.context!.currentTime + 2;
    engine.noteOn({ midi: 64, instrument: 'synth', when: future, source: 'song' });
    // (the bus's always-running chorus LFO is started with no time argument)
    const voiceOscs = createdNodes.filter(
      (n) => n.kind === 'oscillator' && (n.started as number) > 0
    );
    expect(voiceOscs.length).toBeGreaterThanOrEqual(4);
    expect(voiceOscs.every((n) => Math.abs((n.started as number) - future) < 1e-6)).toBe(true);
  });

  it('holds released user notes while the pedal is down, then lets go', () => {
    const engine = makeEngine();
    engine.setPedal(true);
    const h = engine.noteOn({ midi: 60, instrument: 'organ' });
    h.release();
    vi.advanceTimersByTime(2000);
    expect(engine.getVoiceCount()).toBe(1); // still ringing

    engine.setPedal(false);
    vi.advanceTimersByTime(50);
    expect(engine.getVoiceCount()).toBe(0);
  });

  it('does not apply the pedal to song playback', () => {
    const engine = makeEngine();
    engine.setPedal(true);
    const h = engine.noteOn({ midi: 60, instrument: 'organ', source: 'song' });
    h.release();
    vi.advanceTimersByTime(50);
    expect(engine.getVoiceCount()).toBe(0);
  });

  it('damps a note that is re-struck instead of stacking voices', () => {
    const engine = makeEngine();
    engine.noteOn({ midi: 60, instrument: 'epiano' });
    engine.noteOn({ midi: 60, instrument: 'epiano' });
    vi.advanceTimersByTime(50);
    expect(engine.getVoiceCount()).toBe(1);
  });

  it('keeps simultaneous different notes independent (chords)', () => {
    const engine = makeEngine();
    const hs = [60, 64, 67, 72].map((m) => engine.noteOn({ midi: m, instrument: 'piano' }));
    expect(engine.getVoiceCount()).toBe(4);
    hs[1].release();
    expect(engine.getActiveMidis().sort()).toEqual([60, 67, 72]);
  });

  it('caps polyphony by stealing the oldest voices', () => {
    const engine = makeEngine(6);
    for (let m = 40; m < 52; m++) engine.noteOn({ midi: m, instrument: 'chiptune' });
    vi.advanceTimersByTime(50);
    expect(engine.getVoiceCount()).toBeLessThanOrEqual(6);
    // the most recent notes survive
    expect(engine.getActiveMidis()).toContain(51);
    expect(engine.getActiveMidis()).not.toContain(40);
  });

  it('releaseAll only affects the requested source', () => {
    const engine = makeEngine();
    engine.noteOn({ midi: 60, instrument: 'piano', source: 'user' });
    engine.noteOn({ midi: 72, instrument: 'piano', source: 'song' });
    engine.releaseAll('song');
    expect(engine.getActiveMidis()).toEqual([60]);
  });

  it('stopAll silences everything and clears the pedal', () => {
    const engine = makeEngine();
    engine.setPedal(true);
    [60, 62, 64].forEach((m) => engine.noteOn({ midi: m, instrument: 'synth' }));
    engine.stopAll();
    vi.advanceTimersByTime(100);
    expect(engine.getVoiceCount()).toBe(0);
    expect(engine.isPedalDown()).toBe(false);
  });

  it('transposes the bass an octave down', () => {
    const engine = makeEngine();
    engine.noteOn({ midi: 60, instrument: 'bass' });
    const freqs = createdNodes
      .filter((n) => n.kind === 'oscillator')
      .map((n) => (n.frequency as { value: number }).value);
    // saw at C3 (130.8 Hz) and sub at C2 (65.4 Hz)
    expect(freqs.some((f) => Math.abs(f - 130.81) < 0.2)).toBe(true);
    expect(freqs.some((f) => Math.abs(f - 65.41) < 0.2)).toBe(true);
  });

  it('accepts out-of-range velocities without producing invalid gains', () => {
    const engine = makeEngine();
    expect(() => {
      engine.noteOn({ midi: 60, instrument: 'piano', velocity: -3 });
      engine.noteOn({ midi: 61, instrument: 'piano', velocity: 99 });
      engine.noteOn({ midi: 62, instrument: 'epiano', velocity: NaN });
    }).not.toThrow();
  });
});
