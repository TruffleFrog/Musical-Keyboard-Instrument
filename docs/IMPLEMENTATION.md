# Keyboard Studio — architecture as built

> This is the architecture of the code in `src/` as of 2026-10-10. The planned architecture, decisions (D1–D16) and status live in [ARCHITECTURE.md](../ARCHITECTURE.md); progress is tracked in [TODO.md](../TODO.md). Where the two differ, ARCHITECTURE.md §20 lists the deviations.

Client-only TypeScript + React + Vite. Runtime dependencies: `react`, `react-dom`,
`lucide-react` (icons). Audio is the native Web Audio API; there is no backend.

## Layers and ownership

```
src/
├── music/          PURE. No DOM, no Web Audio.
│   ├── notes.ts        pitch <-> MIDI <-> frequency
│   ├── chords.ts       chord naming for the live readout
│   ├── song.ts         song model, notation parser, bar/beat helpers
│   └── songs.ts        the built-in arrangements
├── audio/          ONLY place that creates Web Audio nodes.
│   ├── engine.ts       AudioEngine: contexts, buses, voice lifecycle, pedal, stealing
│   ├── voices.ts       one synthesis recipe per instrument (+ envelope "Rig")
│   ├── effects.ts      per-instrument insert chains (chorus, tremolo, drive)
│   ├── samples.ts      sample bank: decode, onset trim, loudness match, zone lookup
│   └── assets.ts       noise, band-limited waves, saturator curves, reverb IR
├── playback/       Scheduling & pure learn logic.
│   ├── sequencePlayer.ts   audio-clock lookahead scheduler (songs and takes)
│   ├── learn.ts            wait-for-me session (steps, octave-forgiving matching)
│   └── take.ts             recorded take -> sequence (pedal-extended)
├── app/studio.ts   Controller: input routing, transport, recording, persistence.
├── state/store.ts  ~40-line external store + selector hook.
├── components/     React UI; reads the store, calls the controller.
├── data/           key map and keyboard geometry, instrument presets.
└── utils/          MIDI encoding/export, localStorage with validation + migration.
```

Rules: `music/` imports nothing browser-specific; only `audio/` touches Web Audio; only
`app/studio.ts` listens to window-level keyboard events; components never schedule audio.

## Audio engine

```
voice ──> per-voice pan ──> instrument trim ──> insert FX ──┬─ dry ────────────┐
 (osc / sample / FM)         (loudness-matched)              └─ reverb send ─> convolver ─┤
                                                                                         v
                                                       limiter -> master gain -> analyser -> out
```

- **Voices.** Each instrument is a recipe (`voices.ts`):
  *piano* – decoded Salamander sample, re-pitched ≤ 1.5 semitones, lowpass darkened for soft
  touches; a small additive stand-in plays only until samples finish decoding.
  *epiano* – phase-modulated sine "tine" whose index decays (bark → bell), bell partial,
  hammer thump, asymmetric saturator, AC-coupling high-pass, then bus tremolo + chorus.
  *synth* – three detuned saws + sub into two cascaded resonant lowpass filters with a per-note
  sweep. *bass* – saw + square + sub, plucked filter, soft-clip amp. *chiptune* – band-limited
  25% pulse + triangle, vibrato that fades in. *organ* – additive PeriodicWave stack, detuned
  pair, sub, filtered-noise chiff, rotary-style bus modulation.
- **Envelopes** use only `setTargetAtTime` (exponential approach). Cancelling at a future
  release time therefore never leaves a dangling ramp, so a key lifted during the attack
  does not jump or click (`cancelAndHoldAtTime` is not available in Firefox).
- **Lifecycle.** A voice ends when its last source fires `onended`; nothing relies on timers.
  Re-striking a ringing key damps the old voice in 60 ms; at 48 voices the oldest releasing /
  sustained voice is stolen. `stopAll()` fades in ~20 ms.
- **Sustain pedal** applies only to user notes; song playback manages its own note lengths.
- **Gain staging.** Each instrument has a trim (`INSTRUMENT_TRIM`) calibrated with
  `scripts/audio-probe.mjs` so the same passage is within a few dB across sounds; the master
  limiter keeps 8-note fortissimo chords below −3 dBFS.
- **Samples** are fetched and decoded on a throw-away `OfflineAudioContext`, so loading starts
  before any user gesture. The engine can be given any `BaseAudioContext`, which is how
  the E2E suite renders it offline and measures the result.

## Songs and playback

A song is a set of **parts** compiled from a small notation (`E4:1`, `C3+E3+G3:2`,
`E4:.25/2` for held notes, `( … )*3` repeats, `|` bar lines). The compiler yields absolute
note events in beats; tests assert every bar of every part adds up and that all parts
have equal length.

`SequencePlayer` follows the "two clocks" pattern: a 25 ms timer wakes and schedules
whatever falls in the next ~140 ms at sample-accurate `AudioContext` times. Note **ends**
are also scheduled in beats, so changing tempo mid-note re-anchors the timeline without
restarting. Looping shifts the anchor by one length; part filters apply live. Highlights
come from the player's *audible* position (latency-compensated), not from per-note timers.

**Learn mode** builds steps from the melody parts (simultaneous notes form one step) and
waits for them. Matching prefers the exact pitch and falls back to the same note name in any
octave, which keeps 25 computer keys sufficient for songs that span four octaves. After a
step, the accompaniment notes that start before the next step are played at the current tempo.

## Layout stability

The page is `100dvh` and a CSS grid of fixed regions:

```
topbar (56px) / deck (viewport-derived) / note roll (1fr) / keyboard dock (viewport-derived)
```

Region sizes depend only on the viewport. Dynamic content is clipped inside fixed boxes:
the LCD readout is 44 px tall with `nowrap` + `overflow: hidden`; timers use tabular
numerals in fixed-width slots; the recording indicator is absolutely positioned; key labels
are absolutely positioned inside keys. `tests/e2e/layout-stability.spec.ts` asserts that every
region's exact box is unchanged through chords, runs, octave shifts, tab switches, song
playback, Learn mode, recording and take playback at four viewport sizes.

## State and persistence

One external store holds preferences (persisted, validated, debounced) and transient state
(held notes, lit notes, learn progress, recording, takes). High-frequency values (playback
position, the note roll) are read imperatively in `requestAnimationFrame`, not through React
state. Preferences use `keyboard_studio_preferences_v2` and migrate from v1; takes keep the
v1 key and are sanitised on load. Sustain is deliberately not persisted.

## Offline

`public/sw.js` is a stale-while-revalidate cache for same-origin GETs. After load the page
tells the worker which resources it used (including the samples), so a single visit is
enough. Registered in production builds only.

## Testing strategy

| Layer | Tool | What it proves |
| --- | --- | --- |
| Pure music, parser, MIDI, storage, learn | Vitest | correctness, bar sums, ranges, file structure |
| Engine lifecycle, player scheduling | Vitest + Web Audio mock / fake engine | voice reclamation, pedal, stealing, timing maths |
| UI integration | Vitest + Testing Library | keys, readouts, tabs, learn, recording |
| Layout, flows, offline | Playwright (Chromium) | no layout shift, real browser behaviour |
| Audio signal | Playwright + `OfflineAudioContext` | levels, clipping, DC, onset, tails, balance |

Listening quality cannot be asserted automatically; see `docs/REVIEW.md` for what still needs
human ears.

## Decisions

| Decision | Alternatives | Why |
| --- | --- | --- |
| Sample only the piano | Sample every instrument | One legitimately licensed, well-known set (CC BY 3.0, 1.3 MB); no suitably licensed Rhodes set exists (best candidate is CC BY-NC) |
| Window of 25 QWERTY keys over a fixed 61-key keyboard | Keyboard that scrolls / re-ranges | Song notes outside the window stay visible and lit; octave change is just a band moving |
| Notation DSL | Hand-written note arrays | Arrangements stay readable and are validated mechanically |
| Audio-clock scheduler | `setTimeout` per note (v1) | Drift-free, polyphonic, tempo changes without restart |
| Custom 40-line store | zustand / redux | No dependency for a small problem |
| System fonts | Google Fonts (v1) | Works offline, no third-party request |
