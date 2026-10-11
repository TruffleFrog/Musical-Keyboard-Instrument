# Keyboard Studio 🎹

Turn your computer keyboard into a piano. A recorded concert grand, a Rhodes-style electric
piano, a polysynth, a funk bass, an 8-bit chip and a pipe organ; eight fully arranged songs
with a falling-note view; a Learn mode that waits for you; recording with MIDI export.
Everything runs in the browser, works offline, and needs no backend or account.

[▶️ **Play Live in Browser**](https://trufflefrog.github.io/Musical-Keyboard-Instrument/)

![Keyboard Studio, Play tab](docs/screenshots/after/02-play-chord.png)

| Songs (Listen) | Songs (Learn) |
| --- | --- |
| ![Songs](docs/screenshots/after/04-songs-playing.png) | ![Learn](docs/screenshots/after/05-songs-learn.png) |

> **Status:** playable app, implemented in phases 0–4 *in part* — see [TODO.md](TODO.md) for the
> task-by-task truth and [ARCHITECTURE.md §20](ARCHITECTURE.md#20-current-implementation--infrastructure-status)
> for what exists. Not yet built: key remapping, scales/transpose, drums, echo, metronome,
> audio export, ESLint/Prettier. The on-screen keyboard is a **piano keybed with computer-key
> legends**, not the QWERTY-shaped key map the original concept describes (see decision D13).

## Playing

| Keys | Action |
| --- | --- |
| `A S D F G H J K L ; ' \ , . /` | White keys, two octaves plus the top C |
| `W E T Y U O P [ ] =` | Black keys |
| `Z` / `X`, `↓` / `↑` | Octave down / up (the marked band slides along the 61-key keyboard) |
| `Space` (hold) | Sustain pedal; the **Sustain** button latches it |
| `1` – `6` | Choose a sound |
| `Esc` | Panic: silence everything |
| `?` | Help and shortcuts |

Mouse and touch work too: click lower on a key for a harder strike, drag across keys for a
glissando, use several fingers for chords. Many keyboards cannot report arbitrarily many
simultaneous keys (rollover/ghosting); clicking the on-screen keys has no such limit.

## Features

- **Sounds** – *Grand Piano* is a real recording (Salamander Grand Piano, Yamaha C5) with
  velocity-shaped tone, damper release and stereo spread. *Electric Piano* (tine FM model with
  pickup saturation, tremolo and chorus), *Poly Synth*, *Funk Bass*, *8-Bit Chip* and *Pipe
  Organ* are synthesised live. Five rotary controls per sound.
- **Songs** – every song is a multi-part arrangement (melody, chords, bass or two hands), so
  several keys sound and light at once. Mute any part, listen to the melody only, change tempo
  while it plays, loop, click the timeline to jump, or export the arrangement as a multi-track
  MIDI file.
- **Learn mode** – the melody waits for you. The target key is outlined and its computer-key
  letter shown; the right note name in any octave counts, so beginners never need an impossible
  chord. The accompaniment plays along as you advance.
- **Note roll** – song notes fall onto the keys that will sound; notes you play rise away from
  the keys.
- **Recorder** – takes keep your touch and sustain pedal, replay with lit keys, can be renamed
  and export as `.mid` (one track per sound, CC64 pedal events included).
- **Local first** – preferences and takes live in `localStorage`; a service worker caches the
  app and samples after the first visit so it works offline. No telemetry, no uploads.

## Songs

| Song | Parts | Level |
| --- | --- | --- |
| Ode to Joy (Beethoven) | melody · chords · bass | Beginner |
| Twinkle, Twinkle, Little Star | melody · left hand (Alberti bass with ringing root) | Beginner |
| Mary Had a Little Lamb | melody · chords · bass | Beginner |
| Greensleeves | melody · waltz chords · bass | Intermediate |
| Korobeiniki (folk) | melody · oom-pah chords · walking bass | Intermediate |
| Für Elise (Beethoven) | right hand · left hand (rolling arpeggios) | Intermediate |
| Canon in D (Pachelbel) | melody · harmony · ground bass, five variations | Intermediate |
| Prelude in C (J. S. Bach) | arpeggio · bass | Advanced |

All compositions are public domain; the arrangements are original to this project. Provenance
is recorded per song in `src/music/songs.ts` and validated by the tests.

## Development

```bash
npm ci               # or npm install
npm run dev          # http://localhost:5173
npm run typecheck
npm test             # Vitest: 140+ unit/integration tests
npm run test:e2e     # Playwright (Chromium): layout stability, songs, learn, recording, audio render, offline
npm run build        # production build in dist/
npm run preview      # serve dist/ locally
npm run probe:audio  # offline-render loudness / clipping / tail report per instrument
npm run screenshots  # regenerate docs/screenshots/after
```

`npm run test:e2e` starts the dev server and a production preview (for the offline test)
automatically. Requires Node 22.12+ (`.nvmrc` pins 24). Playwright uses a Chromium found under
`%LOCALAPPDATA%\ms-playwright` when present. `scripts/smoke-url.mjs <url>` smoke-tests any
deployed build.

### Publishing the live version

Deployment is **manual only** (decision D9): nothing is published on push or merge. In GitHub:
**Actions → "Deploy to GitHub Pages (manual)" → Run workflow** (choose `main`). The workflow
re-runs typecheck and unit tests, builds with `VITE_BASE=/Musical-Keyboard-Instrument/`, and
publishes `dist/` to
<https://trufflefrog.github.io/Musical-Keyboard-Instrument/>.

## Documentation

| Document | Purpose |
| --- | --- |
| [TODO.md](TODO.md) | Task tracker, gates and phase acceptance criteria — the source of truth for progress |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Planned architecture, decisions (D1–D16) and **current status (§20)** |
| [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md) | The architecture as actually built: engine, scheduler, layout rules, tests |
| [docs/PRODUCT_CONCEPT.md](docs/PRODUCT_CONCEPT.md) | Product and UI concept, with implementation notes |
| [docs/REVIEW.md](docs/REVIEW.md) | Audit of the first version, what changed, measured evidence, what needs human listening |
| [AGENTS.md](AGENTS.md) | Rules for AI coding agents and contributors |

## Credits and licensing

- **Source code:** [MIT](LICENSE).
- **Grand piano samples:** *Salamander Grand Piano* by Alexander Holm, licensed
  [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). Source:
  <https://archive.org/details/SalamanderGrandPianoV3>. See
  [`public/samples/piano/ATTRIBUTION.txt`](public/samples/piano/ATTRIBUTION.txt); attribution
  is also in the in-app help.
- **All other sounds** are synthesised at runtime; no other audio assets are used.
- **Songs** are public-domain compositions; arrangements are original (MIT).
- Icons: [lucide](https://lucide.dev) (ISC).
