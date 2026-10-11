import '@testing-library/jest-dom';

class MockAudioParam {
  public value = 0;
  setValueAtTime(val: number) {
    this.value = val;
  }
  linearRampToValueAtTime(val: number) {
    this.value = val;
  }
  exponentialRampToValueAtTime(val: number) {
    this.value = val;
  }
  setTargetAtTime(val: number) {
    this.value = val;
  }
  cancelScheduledValues() {}
}

class MockAudioNode {
  connect() {
    return this;
  }
  disconnect() {}
}

class MockOscillatorNode extends MockAudioNode {
  public type: OscillatorType = 'sine';
  public frequency = new MockAudioParam();
  public detune = new MockAudioParam();
  start() {}
  stop() {}
}

class MockGainNode extends MockAudioNode {
  public gain = new MockAudioParam();
}

class MockBiquadFilterNode extends MockAudioNode {
  public type: BiquadFilterType = 'lowpass';
  public frequency = new MockAudioParam();
  public Q = new MockAudioParam();
}

class MockDynamicsCompressorNode extends MockAudioNode {
  public threshold = new MockAudioParam();
  public knee = new MockAudioParam();
  public ratio = new MockAudioParam();
  public attack = new MockAudioParam();
  public release = new MockAudioParam();
}

class MockConvolverNode extends MockAudioNode {
  public buffer: AudioBuffer | null = null;
}

class MockAnalyserNode extends MockAudioNode {
  public fftSize = 1024;
  public smoothingTimeConstant = 0.8;
  getByteTimeDomainData(array: Uint8Array) {
    array.fill(128);
  }
}

class MockAudioContext {
  public state: AudioContextState = 'running';
  public currentTime = 0;
  public sampleRate = 44100;
  public destination = new MockAudioNode();

  createOscillator() {
    return new MockOscillatorNode();
  }
  createGain() {
    return new MockGainNode();
  }
  createBiquadFilter() {
    return new MockBiquadFilterNode();
  }
  createDynamicsCompressor() {
    return new MockDynamicsCompressorNode();
  }
  createConvolver() {
    return new MockConvolverNode();
  }
  createAnalyser() {
    return new MockAnalyserNode();
  }
  createBuffer(_channels: number, length: number, sampleRate: number) {
    return {
      length,
      sampleRate,
      getChannelData: () => new Float32Array(length),
    } as unknown as AudioBuffer;
  }
  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
}

Object.defineProperty(window, 'AudioContext', {
  writable: true,
  configurable: true,
  value: MockAudioContext,
});

HTMLCanvasElement.prototype.getContext = (() => {
  return {
    clearRect: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    strokeStyle: '',
    lineWidth: 1,
  };
}) as unknown as typeof HTMLCanvasElement.prototype.getContext;
