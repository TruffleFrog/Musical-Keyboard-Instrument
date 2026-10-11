# ARCHITECTURE.md — Keyboard Studio

## High-Level Architecture

Keyboard Studio follows a clean, modular client-side architecture with zero backend dependencies:

```
src/
├── audio/
│   └── AudioEngine.ts        # Web Audio API polyphonic synthesizer, effects, & analyser
├── data/
│   ├── keyboardMap.ts        # Physical QWERTY <-> MIDI note mapping & frequency math
│   ├── instruments.ts        # 6 distinct instrument synthesis presets & defaults
│   └── demoSongs.ts          # Public-domain melodies with timing & note sequences
├── utils/
│   ├── midiExport.ts         # Standard MIDI File (SMF Format 0) binary encoder
│   └── storage.ts            # LocalStorage persistence for preferences & recordings
├── components/
│   ├── HeaderBar.tsx         # Studio transport bar, octave/sustain controls, live LED readout
│   ├── PianoKeyboard.tsx     # Interactive 25-key virtual piano with real-time highlights
│   ├── SoundStudioPanel.tsx  # Instrument selector, ADSR/filter/reverb controls, oscilloscope
│   ├── DemoSongsPanel.tsx    # Auto-play & Practice (Follow Notes) engine with note roll
│   └── RecorderPanel.tsx     # Performance recorder, playback scheduler, & .mid file export
├── types/
│   └── music.ts              # Shared TypeScript interfaces
└── App.tsx                   # Central studio state, keyboard event routing, & layout
```

## Key Technical Decisions

### 1. Polyphonic Web Audio Engine (`AudioEngine.ts`)
- **Signal Chain**: Voice Oscillators + Harmonic Partials -> Voice Lowpass Filter (`BiquadFilterNode`) -> Voice Envelope (`GainNode`) -> Master Bus -> Stereo Ambience/Reverb Send + Dry Path -> Master Dynamics Compressor (`DynamicsCompressorNode`) -> Master Gain -> `AnalyserNode` -> `AudioContext.destination`.
- **Distinct Instrument Architectures**:
  - **Grand Piano**: Multi-partial triangle + sine + harmonic overtone synthesis with a short hammer transient burst and pitch-scaled filter decay.
  - **Warm Polysynth**: Dual detuned sawtooth oscillators (`±10 cents`) with a resonant lowpass filter envelope sweep.
  - **Electric Rhodes**: Sine fundamental paired with a bell-like FM/harmonic tine overtone (3x/4x frequency) that decays into a warm sustained body.
  - **Funk Synth Bass**: Sawtooth + sub-octave square wave with a snappy high-resonance lowpass filter pluck.
  - **8-Bit Chiptune**: Square wave + sub-octave triangle wave with pitch vibrato LFO and crisp gate envelope.
  - **Cathedral Organ**: Drawbar-style additive synthesis (`1x`, `1.5x`, `2x`, `4x` harmonics) with rotary detune warmth.
- **Anti-Stuck-Note Safeguards**: Active voices are tracked in a `Map<number, ActiveVoice>`. A separate `sustainedNotes: Set<number>` holds notes released while sustain is active and stops them immediately when sustain is disengaged. Global `blur` and `visibilitychange` listeners invoke `stopAllNotes()`.

### 2. QWERTY Keyboard Mapping (`keyboardMap.ts`)
- Covers a full 2-octave chromatic span (25 keys, default `C4`–`C6`) with zero key collisions:
  - **White keys (15)**: `A S D F G H J K L ; ' \ , . /`
  - **Black keys (10)**: `W E T Y U O P [ ] =`
  - **Octave Shift**: `Z` / `ArrowDown` (Octave Down), `X` / `ArrowUp` (Octave Up)
  - **Sustain Pedal**: `Space` (hold or toggle)

### 3. Demo Song Playback & Practice Mode (`DemoSongsPanel.tsx`)
- **Auto-Play Mode**: Uses a high-frequency timer tick aligned with `performance.now()` and adjustable playback speed (`0.5x`–`2.0x`) to trigger `audioEngine.noteOn`/`noteOff` and highlight the corresponding virtual piano keys in real time.
- **Practice (Follow Notes) Mode**: Pauses at each note in the melody, highlights the target key on the virtual piano (with a pulsing guide indicator), and advances automatically as soon as the user plays the matching note via QWERTY keyboard or mouse/touch.

### 4. Performance Recorder & MIDI Export (`RecorderPanel.tsx`, `midiExport.ts`)
- Captures timestamped note-on and note-off events with millisecond precision during live play.
- Encodes recordings directly in the browser into binary Standard MIDI Files (`.mid`) using variable-length quantity (VLQ) delta timestamps.
