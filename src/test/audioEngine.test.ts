import { beforeEach, describe, expect, it } from 'vitest';
import { AudioEngine } from '../audio/AudioEngine';
import { InstrumentId } from '../types/music';

describe('AudioEngine polyphonic synthesizer', () => {
  let engine: AudioEngine;

  beforeEach(() => {
    engine = new AudioEngine();
  });

  it('tracks active polyphonic voices and releases them on noteOff', () => {
    engine.noteOn(60, 'piano');
    engine.noteOn(64, 'piano');
    engine.noteOn(67, 'piano');

    expect(engine.getActiveMidiNotes()).toEqual([60, 64, 67]);

    engine.noteOff(64);
    expect(engine.getActiveMidiNotes()).toEqual([60, 67]);

    engine.stopAllNotes();
    expect(engine.getActiveMidiNotes()).toEqual([]);
  });

  it('produces genuinely distinct oscillator and filter configurations for each instrument', () => {
    const instruments: InstrumentId[] = [
      'piano',
      'synth',
      'epiano',
      'bass',
      'chiptune',
      'organ',
    ];

    const signatures = instruments.map((inst) => {
      const info = engine.noteOn(60, inst);
      return `${inst}:${info.oscillatorTypes.join('+')}:Q${info.filterQ}:cut${info.filterCutoff}`;
    });

    const uniqueSignatures = new Set(signatures);
    expect(uniqueSignatures.size).toBe(instruments.length);

    const chiptuneInfo = engine.noteOn(69, 'chiptune');
    expect(chiptuneInfo.oscillatorTypes).toContain('square');
    expect(chiptuneInfo.frequency).toBeCloseTo(440, 2);

    const synthInfo = engine.noteOn(69, 'synth');
    expect(synthInfo.oscillatorTypes).toEqual(['sawtooth', 'sawtooth', 'triangle']);

    const organInfo = engine.noteOn(69, 'organ');
    expect(organInfo.oscillatorCount).toBe(4);
  });

  it('holds released notes while sustain is enabled and releases them when sustain turns off', () => {
    engine.setSustain(true);
    engine.noteOn(60, 'piano');
    engine.noteOn(64, 'piano');

    // Releasing key while sustain is on keeps voice active
    engine.noteOff(60);
    expect(engine.getActiveMidiNotes()).toEqual([60, 64]);

    // Disabling sustain releases the sustained note (60) while keeping held key (64)
    engine.setSustain(false);
    expect(engine.getActiveMidiNotes()).toEqual([64]);
  });
});
