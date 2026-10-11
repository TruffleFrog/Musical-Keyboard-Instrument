import '@testing-library/jest-dom';

/**
 * Minimal, behavioural Web Audio mock for jsdom.
 *  - every create*() returns a node whose AudioParams record their scheduled
 *    events;
 *  - scheduled sources fire `onended` shortly after stop() so voice cleanup
 *    can be tested;
 *  - currentTime follows performance.now(), so fake timers drive it.
 */

const PARAM_NAMES = new Set([
  'gain',
  'frequency',
  'detune',
  'Q',
  'pan',
  'delayTime',
  'threshold',
  'knee',
  'ratio',
  'attack',
  'release',
  'playbackRate',
]);

export interface ParamEvent {
  type: string;
  value: number;
  time: number;
}

export class MockParam {
  value = 0;
  events: ParamEvent[] = [];
  private rec(type: string, value: number, time: number) {
    this.events.push({ type, value, time });
    return this;
  }
  setValueAtTime(v: number, t: number) {
    this.value = v;
    return this.rec('set', v, t);
  }
  linearRampToValueAtTime(v: number, t: number) {
    return this.rec('linear', v, t);
  }
  exponentialRampToValueAtTime(v: number, t: number) {
    return this.rec('exp', v, t);
  }
  setTargetAtTime(v: number, t: number, tau: number) {
    void tau;
    return this.rec('target', v, t);
  }
  cancelScheduledValues(t: number) {
    this.events = this.events.filter((e) => e.time < t);
    return this;
  }
}

export interface MockNode {
  kind: string;
  started?: number;
  stopped?: number;
  connected: unknown[];
  onended: (() => void) | null;
  [key: string]: unknown;
}

export const createdNodes: MockNode[] = [];

function makeNode(kind: string, props: Record<string, unknown> = {}): MockNode {
  const params = new Map<string, MockParam>();
  const target: MockNode = {
    kind,
    connected: [],
    onended: null,
    ...props,
  };
  const proxy: MockNode = new Proxy(target, {
    get(t, prop) {
      if (typeof prop === 'symbol') return undefined;
      if (prop in t) return t[prop as string];
      if (PARAM_NAMES.has(prop)) {
        if (!params.has(prop)) params.set(prop, new MockParam());
        return params.get(prop);
      }
      if (prop === 'connect') {
        return (dest: unknown) => {
          t.connected.push(dest);
          return dest;
        };
      }
      if (prop === 'disconnect') return () => {};
      if (prop === 'start') {
        return (when = 0) => {
          t.started = when;
        };
      }
      if (prop === 'stop') {
        return (when = 0) => {
          if (t.stopped === undefined) {
            setTimeout(() => t.onended?.(), 0);
          }
          t.stopped = when;
        };
      }
      if (prop === 'setPeriodicWave') return () => {};
      return undefined;
    },
    set(t, prop, value) {
      t[prop as string] = value;
      return true;
    },
  });
  createdNodes.push(proxy);
  return proxy;
}

const originStart = typeof performance !== 'undefined' ? performance.now() : 0;

class MockAudioContext {
  state: 'running' | 'suspended' = 'running';
  sampleRate = 44100;
  baseLatency = 0;
  destination = makeNode('destination');
  get currentTime(): number {
    return (performance.now() - originStart) / 1000;
  }
  constructor(_opts?: unknown) {
    void _opts;
  }
  createOscillator() {
    return makeNode('oscillator', { type: 'sine' });
  }
  createBufferSource() {
    return makeNode('bufferSource', { buffer: null });
  }
  createGain() {
    return makeNode('gain');
  }
  createBiquadFilter() {
    return makeNode('biquad', { type: 'lowpass' });
  }
  createStereoPanner() {
    return makeNode('panner');
  }
  createWaveShaper() {
    return makeNode('shaper', { curve: null, oversample: 'none' });
  }
  createDynamicsCompressor() {
    return makeNode('compressor');
  }
  createConvolver() {
    return makeNode('convolver', { buffer: null });
  }
  createAnalyser() {
    return makeNode('analyser', { fftSize: 1024 });
  }
  createDelay() {
    return makeNode('delay');
  }
  createChannelSplitter() {
    return makeNode('splitter');
  }
  createChannelMerger() {
    return makeNode('merger');
  }
  createPeriodicWave() {
    return {};
  }
  createBuffer(channels: number, length: number, sampleRate: number) {
    return {
      length,
      sampleRate,
      numberOfChannels: channels,
      duration: length / sampleRate,
      getChannelData: () => new Float32Array(length),
    };
  }
  decodeAudioData() {
    return Promise.reject(new Error('decode not available in tests'));
  }
  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
  close() {
    return Promise.resolve();
  }
}

Object.defineProperty(window, 'AudioContext', {
  writable: true,
  configurable: true,
  value: MockAudioContext,
});
Object.defineProperty(globalThis, 'OfflineAudioContext', {
  writable: true,
  configurable: true,
  value: MockAudioContext,
});

// Samples cannot be fetched in unit tests; fail fast and quietly.
globalThis.fetch = (() =>
  Promise.reject(new Error('network disabled in tests'))) as typeof fetch;

HTMLCanvasElement.prototype.getContext = (() => ({
  setTransform() {},
  clearRect() {},
  beginPath() {},
  moveTo() {},
  lineTo() {},
  arcTo() {},
  closePath() {},
  stroke() {},
  fill() {},
  fillRect() {},
})) as unknown as typeof HTMLCanvasElement.prototype.getContext;

if (typeof window.matchMedia !== 'function') {
  window.matchMedia = ((q: string) => ({
    matches: false,
    media: q,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
