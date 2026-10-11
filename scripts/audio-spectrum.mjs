// Spectral sanity probe: DC offset, brightness, high-frequency energy and
// harmonic structure of one rendered note per instrument.
//   node scripts/audio-spectrum.mjs [http://localhost:5173/]
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
await page.goto(base);
await page.waitForFunction(() => !!window.__keyboardStudio);

const rows = [];
for (const instrument of ['piano', 'epiano', 'synth', 'bass', 'chiptune', 'organ']) {
  for (const midi of [48, 60, 72]) {
    const r = await page.evaluate(
      async ({ instrument, midi }) => {
        const { AudioEngine } = window.__keyboardStudio;
        const sr = 44100;
        const ctx = new OfflineAudioContext(1, sr * 3, sr);
        const eng = new AudioEngine({ context: ctx, sampleBaseUrl: '/samples/piano/' });
        // dry: no reverb so the spectrum belongs to the voice itself
        eng.setTone(instrument, { brightness: 0.55, attack: 0.1, release: 0.3, reverb: 0, width: 0.5 });
        if (instrument === 'piano') await eng.loadSamples();
        const h = eng.noteOn({ midi, instrument, velocity: 0.8, when: 0.05, source: 'song' });
        h.release(1.6);
        const buf = await ctx.startRendering();
        const x = buf.getChannelData(0);
        // analyse 0.15 s .. 1.4 s
        const a = Math.floor(0.15 * sr);
        const b = Math.floor(1.4 * sr);
        let mean = 0;
        for (let i = a; i < b; i++) mean += x[i];
        mean /= b - a;
        // power spectrum of a 16384 window via naive DFT on selected bins
        const N = 8192;
        const win = new Float32Array(N);
        for (let i = 0; i < N; i++) {
          win[i] = x[a + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
        }
        const bins = N / 2;
        const mag = new Float32Array(bins);
        // radix-2 FFT
        const re = Float64Array.from(win);
        const im = new Float64Array(N);
        for (let i = 1, j = 0; i < N; i++) {
          let bit = N >> 1;
          for (; j & bit; bit >>= 1) j ^= bit;
          j ^= bit;
          if (i < j) {
            [re[i], re[j]] = [re[j], re[i]];
          }
        }
        for (let len = 2; len <= N; len <<= 1) {
          const ang = (-2 * Math.PI) / len;
          const wr = Math.cos(ang);
          const wi = Math.sin(ang);
          for (let i = 0; i < N; i += len) {
            let cr = 1;
            let ci = 0;
            for (let k = 0; k < len / 2; k++) {
              const ur = re[i + k];
              const ui = im[i + k];
              const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
              const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
              re[i + k] = ur + vr;
              im[i + k] = ui + vi;
              re[i + k + len / 2] = ur - vr;
              im[i + k + len / 2] = ui - vi;
              const nr = cr * wr - ci * wi;
              ci = cr * wi + ci * wr;
              cr = nr;
            }
          }
        }
        let total = 0;
        let weighted = 0;
        let hf = 0;
        let peak = 0;
        let peakBin = 0;
        for (let k = 1; k < bins; k++) {
          const p = re[k] * re[k] + im[k] * im[k];
          mag[k] = p;
          const f = (k * sr) / N;
          total += p;
          weighted += p * f;
          if (f > 12000) hf += p;
          if (p > peak) {
            peak = p;
            peakBin = k;
          }
        }
        const db = (v) => 10 * Math.log10(Math.max(v, 1e-30));
        return {
          dc: mean,
          centroid: weighted / total,
          hfDb: db(hf / total),
          fundamentalHz: (peakBin * sr) / N,
        };
      },
      { instrument, midi }
    );
    rows.push({ instrument, midi, ...r });
  }
}
console.log('instrument  midi  fundamental  centroid Hz  >12k dB   DC offset');
for (const r of rows) {
  console.log(
    `${r.instrument.padEnd(10)}  ${String(r.midi).padStart(4)}  ${r.fundamentalHz.toFixed(0).padStart(10)}  ${r.centroid.toFixed(0).padStart(11)}  ${r.hfDb.toFixed(1).padStart(7)}  ${r.dc.toExponential(1).padStart(10)}`
  );
}
await browser.close();
