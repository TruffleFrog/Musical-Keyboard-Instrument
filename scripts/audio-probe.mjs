// Renders each instrument offline through the real engine and prints
// level / onset / tail metrics. Used to calibrate INSTRUMENT_TRIM.
//   node scripts/audio-probe.mjs [http://localhost:5173/]
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const base = process.argv[2] ?? 'http://localhost:5173/';
const exe = path.join(
  process.env.LOCALAPPDATA ?? '',
  'ms-playwright', 'chromium-1232', 'chrome-win64', 'chrome.exe'
);
const browser = await chromium.launch({
  executablePath: fs.existsSync(exe) ? exe : undefined,
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(base);
await page.waitForFunction(() => !!window.__keyboardStudio);

const scenarios = {
  single: [{ midi: 60, vel: 0.75, at: 0.1, dur: 1.2 }],
  low: [{ midi: 40, vel: 0.75, at: 0.1, dur: 1.2 }],
  high: [{ midi: 84, vel: 0.75, at: 0.1, dur: 1.2 }],
  chord8: [48, 52, 55, 60, 64, 67, 71, 74].map((m) => ({
    midi: m, vel: 1, at: 0.1, dur: 1.2,
  })),
  song: [60, 64, 67, 72, 76, 79, 60, 64, 67, 72].map((m, i) => ({
    midi: m, vel: 0.7, at: 0.1 + i * 0.18, dur: 0.6,
  })),
};

const instruments = ['piano', 'epiano', 'synth', 'bass', 'chiptune', 'organ'];
const rows = [];

for (const instrument of instruments) {
  for (const [name, notes] of Object.entries(scenarios)) {
    const r = await page.evaluate(
      async ({ instrument, notes }) => {
        const { AudioEngine } = window.__keyboardStudio;
        const sr = 44100;
        const seconds = 6;
        const ctx = new OfflineAudioContext(2, sr * seconds, sr);
        const eng = new AudioEngine({ context: ctx, sampleBaseUrl: '/samples/piano/' });
        if (instrument === 'piano') await eng.loadSamples();
        for (const n of notes) {
          const h = eng.noteOn({
            midi: n.midi, instrument, velocity: n.vel, when: n.at, source: 'song',
          });
          h.release(n.at + n.dur);
        }
        const buf = await ctx.startRendering();
        const L = buf.getChannelData(0);
        const R = buf.getChannelData(1);
        let peak = 0, sum = 0, clip = 0, nan = 0, first = -1;
        const active = Math.floor(sr * 2.2);
        for (let i = 0; i < L.length; i++) {
          const a = Math.max(Math.abs(L[i]), Math.abs(R[i]));
          if (!Number.isFinite(a)) { nan++; continue; }
          if (a > peak) peak = a;
          if (a >= 0.999) clip++;
          if (first < 0 && a > 0.001) first = i / sr;
          if (i < active) sum += L[i] * L[i] + R[i] * R[i];
        }
        let tail = 0;
        const tailStart = Math.floor(sr * (seconds - 0.5));
        for (let i = tailStart; i < L.length; i++) tail += L[i] * L[i];
        const db = (x) => (x > 0 ? 20 * Math.log10(x) : -200);
        return {
          peakDb: db(peak),
          rmsDb: db(Math.sqrt(sum / (2 * active))),
          tailDb: db(Math.sqrt(tail / (L.length - tailStart))),
          onsetMs: first >= 0 ? Math.round((first - notes[0].at) * 1000) : null,
          clip,
          nan,
        };
      },
      { instrument, notes }
    );
    rows.push({ instrument, scenario: name, ...r });
  }
}

const fmt = (n) => (typeof n === 'number' ? n.toFixed(1).padStart(7) : String(n).padStart(7));
console.log('instrument  scenario   peak dB   rms dB   tail dB  onset ms  clip  nan');
for (const r of rows) {
  console.log(
    `${r.instrument.padEnd(10)}  ${r.scenario.padEnd(8)}  ${fmt(r.peakDb)}  ${fmt(r.rmsDb)}  ${fmt(r.tailDb)}  ${String(r.onsetMs).padStart(8)}  ${String(r.clip).padStart(4)}  ${r.nan}`
);
}
if (errors.length) console.log('PAGE ERRORS:', errors.slice(0, 5));
await browser.close();
