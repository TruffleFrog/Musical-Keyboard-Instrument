/**
 * Per-context shared audio resources: noise, band-limited waves, waveshaper
 * curves and the reverb impulse response. Built once and reused by all voices.
 */

export interface SharedAssets {
  noise: AudioBuffer;
  pulse25: PeriodicWave;
  organ: PeriodicWave;
  rhodesCurve: Float32Array;
  softClipCurves: Float32Array[];
  impulse: AudioBuffer;
}

/** Small deterministic PRNG so noise and reverb are identical every run. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createNoiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * 1.0);
  const buf = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buf.getChannelData(0);
  const rnd = mulberry32(0x9e3779b9);
  for (let i = 0; i < length; i++) data[i] = rnd() * 2 - 1;
  return buf;
}

function pulseWave(ctx: BaseAudioContext, duty: number): PeriodicWave {
  const N = 128;
  const real = new Float32Array(N + 1);
  const imag = new Float32Array(N + 1);
  for (let n = 1; n <= N; n++) {
    real[n] = Math.sin(2 * Math.PI * n * duty) / (Math.PI * n);
    imag[n] = (1 - Math.cos(2 * Math.PI * n * duty)) / (Math.PI * n);
  }
  return ctx.createPeriodicWave(real, imag);
}

function organWave(ctx: BaseAudioContext): PeriodicWave {
  // Principal-style stack: 8', 4', 2 2/3', 2' and a touch of mixture.
  const amps = [0, 1, 0.72, 0.4, 0.46, 0.1, 0.2, 0.06, 0.1, 0.03, 0.05, 0.02];
  const real = new Float32Array(amps.length);
  const imag = new Float32Array(amps.length);
  for (let n = 1; n < amps.length; n++) imag[n] = amps[n];
  return ctx.createPeriodicWave(real, imag);
}

/** Asymmetric saturator approximating a tine pickup: adds even harmonics. */
function rhodesCurve(): Float32Array {
  const size = 2048;
  const curve = new Float32Array(size);
  const norm = Math.tanh(2.0 * (1 + 0.3));
  for (let i = 0; i < size; i++) {
    const x = (i / (size - 1)) * 2 - 1;
    curve[i] = Math.tanh(2.0 * (x + 0.3 * x * x)) / norm;
  }
  return curve;
}

/** Soft-clip curves of increasing drive for the bass amp. */
function softClipCurves(): Float32Array[] {
  const size = 1024;
  return [0.8, 1.6, 2.6, 4].map((drive) => {
    const curve = new Float32Array(size);
    const norm = Math.tanh(drive);
    for (let i = 0; i < size; i++) {
      const x = (i / (size - 1)) * 2 - 1;
      curve[i] = Math.tanh(drive * x) / norm;
    }
    return curve;
  });
}

/**
 * Stereo room impulse: sparse early reflections followed by a diffuse tail
 * whose high frequencies decay faster than its lows (a one-pole lowpass whose
 * cutoff falls with time), which keeps the reverb dark and unobtrusive.
 */
export function createImpulseResponse(
  ctx: BaseAudioContext,
  seconds = 2.1,
  preDelay = 0.012
): AudioBuffer {
  const sr = ctx.sampleRate;
  const length = Math.floor((seconds + preDelay) * sr);
  const buf = ctx.createBuffer(2, length, sr);

  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    const rnd = mulberry32(0xc0ffee + ch * 7919);
    let lp = 0;
    for (let i = 0; i < length; i++) {
      const t = i / sr - preDelay;
      if (t < 0) continue;
      const env = Math.exp((-6.9 * t) / seconds);
      const a = 0.08 + 0.5 * Math.exp(-t / 0.28);
      lp += a * (rnd() * 2 - 1 - lp);
      data[i] = lp * env * 2.4;
    }
    // Early reflections
    const taps = 9;
    for (let k = 0; k < taps; k++) {
      const at = Math.floor((preDelay + 0.006 + rnd() * 0.07) * sr);
      const amp = (0.55 - k * 0.04) * (rnd() < 0.5 ? -1 : 1);
      if (at < length) data[at] += amp;
    }
    // Gentle onset to avoid a click at the head of the response.
    const fade = Math.floor(0.002 * sr);
    for (let i = 0; i < fade && i < length; i++) data[i] *= i / fade;
  }
  return buf;
}

export function createSharedAssets(ctx: BaseAudioContext): SharedAssets {
  return {
    noise: createNoiseBuffer(ctx),
    pulse25: pulseWave(ctx, 0.25),
    organ: organWave(ctx),
    rhodesCurve: rhodesCurve(),
    softClipCurves: softClipCurves(),
    impulse: createImpulseResponse(ctx),
  };
}
