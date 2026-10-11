# AGENTS.md — Keyboard Studio

## Project Overview
**Keyboard Studio** is a lightweight, low-latency web application built with TypeScript, React, Vite, and the Web Audio API that transforms a computer keyboard into an expressive multi-instrument musical studio.

## Commands
- **Install dependencies**: `npm install`
- **Start dev server**: `npm run dev`
- **Typecheck**: `npm run typecheck`
- **Run unit tests (Vitest)**: `npm test`
- **Run E2E browser tests (Playwright)**: `npm run test:e2e`
- **Production build**: `npm run build`

## Engineering Guidelines
1. **Low-Latency Audio First**: Trigger `audioEngine.noteOn` and `audioEngine.noteOff` directly in input event handlers (`keydown`, `keyup`, `pointerdown`, `pointerup`). Never gate audio synthesis on asynchronous network calls or heavy effects.
2. **Prevent Stuck Notes**: Always clean up active voices when the window loses focus (`blur`), document visibility changes (`visibilitychange`), octave shifts occur, or the user triggers "Panic / All Notes Off".
3. **Distinct Web Audio Synthesis**: Every instrument in `src/data/instruments.ts` and `src/audio/AudioEngine.ts` must synthesize genuinely distinct waveforms, harmonic partials, and filter envelopes.
4. **Synchronized Visual Feedback**: Both user input and Demo Song playback must highlight virtual piano keys in real time (`data-active="true"`, `data-demo-target="true"`).
5. **Testing**: Maintain unit test coverage in `src/**/*.test.ts(x)` for keyboard mapping, audio engine lifecycle, MIDI binary export, and UI state, plus Playwright E2E coverage in `tests/e2e/`.
