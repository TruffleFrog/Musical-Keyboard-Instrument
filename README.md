# Keyboard Studio 🎹

**Keyboard Studio** is a modern, low-latency web application that turns your computer keyboard into an expressive musical instrument and mini music production studio. Built with TypeScript, Vite, React, and the Web Audio API.

## Features

### 1. Playable Musical Keyboard
- **Full 2-Octave Chromatic Layout (25 Keys)**: Play melodies and chords directly from your QWERTY keyboard (`A S D F G H J K L ; ' \ , . /` for white keys, `W E T Y U O P [ ] =` for sharps/flats).
- **Real-Time Visual Highlighting**: Virtual piano keys light up instantaneously on physical key presses, mouse clicks/drags, touch input, demo playback, and recording playback.
- **Octave Shift & Sustain**: Shift across octaves (`C1`–`C7`) using `Z` / `X` (or on-screen buttons) and toggle/hold sustain using `Space`.
- **Stuck-Note Protection**: Automatic voice cleanup on window blur, tab switch, octave shifts, and a dedicated **Panic (All Notes Off)** control.

### 2. Multi-Instrument Web Audio Synthesizer
- **6 Distinct Synthesized Instruments**:
  - **Grand Piano**: Warm acoustic-style harmonic partials with hammer transient and natural decay.
  - **Warm Polysynth**: Dual detuned sawtooth oscillators with resonant filter sweep.
  - **Electric Rhodes**: Bell-like tine harmonics over a warm fundamental body.
  - **Funk Synth Bass**: Punchy sawtooth + sub-octave square wave with resonant filter pluck.
  - **8-Bit Chiptune**: Classic retro pulse wave + triangle sub-oscillator with vibrato.
  - **Cathedral Organ**: Drawbar-style additive harmonic synthesis (`1x`, `1.5x`, `2x`, `4x`).
- **Live Sound Customization**: Adjust Master Volume, Attack, Release, Filter Brightness (Cutoff), Stereo Detune, and Studio Ambience (Reverb) with real-time waveform visualization.

### 3. Demo Songs & Interactive Learning
- **6 Built-in Public-Domain Melodies**: *Ode to Joy*, *Twinkle Twinkle Little Star*, *Für Elise*, *Korobeiniki (Tetris Theme)*, *Greensleeves*, and *Canon in D*.
- **Synchronized Virtual Key Highlighting**: Watch the virtual piano keys light up in exact synchronization with the song playback.
- **Practice Mode (Follow Notes)**: Step through any song at your own pace—the next target key highlights on the piano and waits for you to press the matching key before advancing.
- **Speed Control & Interactive Note Roll**: Adjust playback speed from `0.5x` to `2.0x` and view both note names (`E4`) and physical QWERTY bindings (`D`) in the scrolling tab roll.

### 4. Performance Recording & MIDI Export
- **Accurate Event Recording**: Record live performances with millisecond timing accuracy and play them back on any instrument.
- **Session Library**: Save recordings locally in `localStorage`, replay, rename, or delete them.
- **Standard MIDI (`.mid`) Export**: Download any recorded performance as a standard `.mid` file ready to import into any DAW.

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run unit tests
npm test

# Run E2E browser tests
npm run test:e2e

# Build for production
npm run build
```
