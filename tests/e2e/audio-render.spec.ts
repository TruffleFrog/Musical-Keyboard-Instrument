import { expect, test } from '@playwright/test';

/**
 * Objective audio checks. The real engine is rendered offline in the browser
 * (OfflineAudioContext), so levels, clipping, onsets and note lifecycles are
 * measured from actual samples. These checks cannot judge how good something
 * *sounds* - that needs human listening - but they catch silence, clipping,
 * clicks-at-start, stuck tails and wildly unbalanced instruments.
 */

const INSTRUMENTS = ['piano', 'epiano', 'synth', 'bass', 'chiptune', 'organ'] as const;

interface Notes {
  midi: number;
  vel: number;
  at: number;
  dur: number;
}

const SCENARIOS: Record<string, Notes[]> = {
  single: [{ midi: 60, vel: 0.75, at: 0.1, dur: 1.2 }],
  chord8: [48, 52, 55, 60, 64, 67, 71, 74].map((m) => ({
    midi: m,
    vel: 1,
    at: 0.1,
    dur: 1.2,
  })),
  melody: [60, 64, 67, 72, 76, 79, 60, 64, 67, 72].map((m, i) => ({
    midi: m,
    vel: 0.7,
    at: 0.1 + i * 0.18,
    dur: 0.6,
  })),
  // the same key struck 24 times in 2 s: stacking / retrigger stress
  repeated: Array.from({ length: 24 }, (_, i) => ({
    midi: 64,
    vel: 0.8,
    at: 0.1 + i * 0.085,
    dur: 0.07,
  })),
};

interface Metrics {
  peakDb: number;
  rmsDb: number;
  tailDb: number;
  onsetMs: number | null;
  clipped: number;
  invalid: number;
  /** largest sample-to-sample jump during the first 5 ms (click detector) */
  startStep: number;
  /** mean sample value while sounding (DC offset) */
  dc: number;
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => !!(window as unknown as { __keyboardStudio?: unknown }).__keyboardStudio);
});

async function render(
  page: import('@playwright/test').Page,
  instrument: string,
  notes: Notes[]
): Promise<Metrics> {
  return page.evaluate(
    async ({ instrument, notes }) => {
      const { AudioEngine } = (window as unknown as {
        __keyboardStudio: { AudioEngine: new (o: unknown) => any };
      }).__keyboardStudio;
      const sr = 44100;
      const seconds = 6;
      const ctx = new OfflineAudioContext(2, sr * seconds, sr);
      const eng = new AudioEngine({ context: ctx, sampleBaseUrl: '/samples/piano/' });
      if (instrument === 'piano') await eng.loadSamples();
      for (const n of notes) {
        const h = eng.noteOn({
          midi: n.midi,
          instrument,
          velocity: n.vel,
          when: n.at,
          source: 'song',
        });
        h.release(n.at + n.dur);
      }
      const buf = await ctx.startRendering();
      const L = buf.getChannelData(0);
      const R = buf.getChannelData(1);
      let peak = 0;
      let sum = 0;
      let clipped = 0;
      let invalid = 0;
      let first = -1;
      const active = Math.floor(sr * 2.2);
      for (let i = 0; i < L.length; i++) {
        const a = Math.max(Math.abs(L[i]), Math.abs(R[i]));
        if (!Number.isFinite(a)) {
          invalid++;
          continue;
        }
        if (a > peak) peak = a;
        if (a >= 0.999) clipped++;
        if (first < 0 && a > 0.001) first = i / sr;
        if (i < active) sum += L[i] * L[i] + R[i] * R[i];
      }
      let dcSum = 0;
      for (let i = 0; i < active; i++) dcSum += (L[i] + R[i]) / 2;
      let tail = 0;
      const tailStart = Math.floor(sr * (seconds - 0.5));
      for (let i = tailStart; i < L.length; i++) tail += L[i] * L[i] + R[i] * R[i];
      // step size right at the first sound
      let startStep = 0;
      if (first >= 0) {
        const s = Math.floor(first * sr);
        for (let i = s + 1; i < s + Math.floor(0.005 * sr) && i < L.length; i++) {
          startStep = Math.max(startStep, Math.abs(L[i] - L[i - 1]));
        }
      }
      const db = (x: number) => (x > 0 ? 20 * Math.log10(x) : -200);
      return {
        peakDb: db(peak),
        rmsDb: db(Math.sqrt(sum / (2 * active))),
        tailDb: db(Math.sqrt(tail / (2 * (L.length - tailStart)))),
        onsetMs: first >= 0 ? (first - notes[0].at) * 1000 : null,
        clipped,
        invalid,
        startStep,
        dc: dcSum / active,
      };
    },
    { instrument, notes }
  );
}

for (const instrument of INSTRUMENTS) {
  test.describe(`${instrument} renders cleanly`, () => {
    for (const [name, notes] of Object.entries(SCENARIOS)) {
      test(`${name}: audible, finite, unclipped, with headroom, silent tail`, async ({ page }) => {
        const m = await render(page, instrument, notes);
        expect(m.invalid, 'NaN/Infinity samples').toBe(0);
        expect(m.clipped, 'samples at full scale').toBe(0);
        expect(m.peakDb, 'peak headroom').toBeLessThan(-1.5);
        expect(m.rmsDb, 'not silent').toBeGreaterThan(-45);
        expect(m.tailDb, 'every note must have fully ended').toBeLessThan(-70);
        expect(m.onsetMs, 'attack latency (ms)').not.toBeNull();
        expect(m.onsetMs!).toBeLessThan(30);
        expect(m.onsetMs!).toBeGreaterThanOrEqual(0);
      });
    }

    test('no step discontinuity at note start (click guard)', async ({ page }) => {
      const m = await render(page, instrument, SCENARIOS.single);
      expect(m.startStep).toBeLessThan(0.12);
    });

    test('no DC offset (wastes headroom, thumps on note on/off)', async ({ page }) => {
      for (const name of ['single', 'chord8'] as const) {
        const m = await render(page, instrument, SCENARIOS[name]);
        expect(Math.abs(m.dc), `${name} mean`).toBeLessThan(0.004);
      }
    });
  });
}

for (const instrument of ['piano', 'epiano', 'synth', 'bass'] as const) {
  test(`${instrument}: key velocity measurably changes loudness`, async ({ page }) => {
    const soft = await render(page, instrument, [{ midi: 60, vel: 0.3, at: 0.1, dur: 1.2 }]);
    const hard = await render(page, instrument, [{ midi: 60, vel: 1.0, at: 0.1, dur: 1.2 }]);
    expect(hard.rmsDb - soft.rmsDb, 'rms dB difference').toBeGreaterThan(5);
  });
}

test('reverb send audibly lengthens the tail', async ({ page }) => {
  const tailEnergy = (reverb: number) =>
    page.evaluate(async (reverb) => {
      const { AudioEngine } = (window as unknown as {
        __keyboardStudio: { AudioEngine: new (o: unknown) => any };
      }).__keyboardStudio;
      const sr = 44100;
      const ctx = new OfflineAudioContext(2, sr * 5, sr);
      const eng = new AudioEngine({ context: ctx });
      eng.setTone('epiano', { brightness: 0.55, attack: 0.1, release: 0.1, reverb, width: 0.45 });
      const h = eng.noteOn({ midi: 60, instrument: 'epiano', velocity: 0.8, when: 0.1, source: 'song' });
      h.release(0.5);
      const buf = await ctx.startRendering();
      const L = buf.getChannelData(0);
      let sum = 0;
      // energy 1.0 s .. 2.5 s: long after the dry note has ended
      for (let i = Math.floor(sr * 1.0); i < Math.floor(sr * 2.5); i++) sum += L[i] * L[i];
      return 10 * Math.log10(Math.max(sum / (1.5 * sr), 1e-20));
    }, reverb);
  const dry = await tailEnergy(0);
  const wet = await tailEnergy(0.8);
  expect(wet - dry, 'tail energy dB (wet - dry)').toBeGreaterThan(12);
});

test('instruments are loudness-balanced on the same passage', async ({ page }) => {
  const levels: number[] = [];
  for (const instrument of INSTRUMENTS) {
    levels.push((await render(page, instrument, SCENARIOS.melody)).rmsDb);
  }
  const min = Math.min(...levels);
  const max = Math.max(...levels);
  expect(max - min, `rms dB spread: ${levels.map((l) => l.toFixed(1)).join(', ')}`).toBeLessThan(7);
});

test('engine voices are all reclaimed after a busy passage', async ({ page }) => {
  const remaining = await page.evaluate(async () => {
    const { AudioEngine } = (window as unknown as {
      __keyboardStudio: { AudioEngine: new (o: unknown) => any };
    }).__keyboardStudio;
    const ctx = new OfflineAudioContext(2, 44100 * 5, 44100);
    const eng = new AudioEngine({ context: ctx });
    const kinds = ['epiano', 'synth', 'bass', 'chiptune', 'organ'];
    for (let i = 0; i < 60; i++) {
      const h = eng.noteOn({
        midi: 40 + (i % 30),
        instrument: kinds[i % kinds.length],
        when: i * 0.04,
        source: 'song',
      });
      h.release(i * 0.04 + 0.2);
    }
    await ctx.startRendering();
    // let ended-events drain
    await new Promise((r) => setTimeout(r, 100));
    return eng.getVoiceCount();
  });
  expect(remaining).toBe(0);
});

test('piano samples load, decode and are used (not the stand-in)', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { AudioEngine } = (window as unknown as {
      __keyboardStudio: { AudioEngine: new (o: unknown) => any };
    }).__keyboardStudio;
    const ctx = new OfflineAudioContext(2, 44100, 44100);
    const eng = new AudioEngine({ context: ctx, sampleBaseUrl: '/samples/piano/' });
    await eng.loadSamples();
    return { state: eng.getLoadState(), ready: eng.isPianoReady() };
  });
  expect(result).toEqual({ state: 'ready', ready: true });
});
