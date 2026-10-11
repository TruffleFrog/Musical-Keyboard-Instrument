# Keyboard Studio — Architecture & Infrastructure Roadmap

**Status:** partially implemented — a playable app exists; see [§20](#20-current-implementation--infrastructure-status) · **Last updated:** 2026-10-10

**Nature of this document:** the planned architecture and roadmap, kept as the reference the code is measured against. Where the implementation differs, §20 and the decisions table (§21) say so, and the architecture *as built* is described in [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md). Passages written as plans (future tense, "proposed") are plans, not guarantees.

> **Implementation is authorized** (gate `G-01`, 2026-10-10). Work proceeds task by task through [TODO.md](TODO.md); releases remain manual (decision D9).

Related documents: [README](README.md) · [Product & UI concept](docs/PRODUCT_CONCEPT.md) · [TODO / progress tracker](TODO.md) · [Agent rules](AGENTS.md)

## Contents

1. [Purpose, priorities and constraints](#1-purpose-priorities-and-constraints)
2. [Technical stack and rationale](#2-technical-stack-and-rationale)
3. [Application architecture and data flow](#3-application-architecture-and-data-flow)
4. [Repository structure and module organization](#4-repository-structure-and-module-organization)
5. [Keyboard input handling and key mapping](#5-keyboard-input-handling-and-key-mapping)
6. [Audio engine: synthesis, instruments, latency and polyphony](#6-audio-engine-synthesis-instruments-latency-and-polyphony)
7. [Real-time visual keyboard state](#7-real-time-visual-keyboard-state)
8. [Demo songs and synchronized playback](#8-demo-songs-and-synchronized-playback)
9. [Customization settings and local persistence](#9-customization-settings-and-local-persistence)
10. [Recording and MIDI / audio export](#10-recording-and-midi--audio-export)
11. [UI architecture and responsive design](#11-ui-architecture-and-responsive-design)
12. [Accessibility and browser compatibility](#12-accessibility-and-browser-compatibility)
13. [Security, privacy and music / sample licensing](#13-security-privacy-and-music--sample-licensing)
14. [Development environment and expected commands](#14-development-environment-and-expected-commands)
15. [Testing strategy](#15-testing-strategy)
16. [GitHub Actions CI strategy](#16-github-actions-ci-strategy)
17. [Infrastructure and deployment strategy](#17-infrastructure-and-deployment-strategy)
18. [Dependencies, tradeoffs and future scalability](#18-dependencies-tradeoffs-and-future-scalability)
19. [Phased development roadmap](#19-phased-development-roadmap)
20. [Current implementation & infrastructure status](#20-current-implementation--infrastructure-status)
21. [Decisions and open questions](#21-decisions-and-open-questions)
22. [References](#22-references)

---

## 1. Purpose, priorities and constraints

Build a polished, browser-based musical instrument controlled by a physical computer keyboard, a clickable on-screen keyboard, and synchronized demo-song tabs. The interactive **computer-keyboard map** is the main visual element. Any note-on/note-off event — from the user or from a demo — must keep **audio, virtual-key lighting and song-tab highlights synchronized**.

Priorities, in order: **input-to-sound responsiveness → correctness and predictable controls → visual clarity → accessible play → maintainability → optional extras**.

- **Local-first and simple:** no mandatory backend, database, login, telemetry, AI, network audio service, subscription, account, or paid API.
- **Desktop-first:** Firefox, Chromium/Chrome and Edge on Windows are the initial validation targets; touch and small screens remain usable, but physical-keyboard play is the priority.
- **No dependency inflation:** no server components, full-stack frameworks, monorepos, UI kits, elaborate state frameworks or DAW-scale features until demonstrably needed.
- **No automatic production release:** CI runs on pull requests; production publishing happens only through a deliberately triggered workflow, and only once hosting is configured (see [§17](#17-infrastructure-and-deployment-strategy)).
- **Proposal vs. reality:** anything in this document is a proposal until it is recorded in [§20](#20-current-implementation--infrastructure-status).

The product behaviors and acceptance criteria live in [docs/PRODUCT_CONCEPT.md](docs/PRODUCT_CONCEPT.md); this document says *how* they are built.

---

## 2. Technical stack and rationale

| Area | Proposed choice | Why / boundary |
| --- | --- | --- |
| Language | **TypeScript, strict mode** | Shared typed event, note, song and settings contracts; no cross-language runtime |
| App / build | **Vite, vanilla TypeScript template** — *as built: Vite + TypeScript + React 18 (D12)* | Small static app, fast dev server and build; revisit only if UI complexity warrants it |
| UI | **Semantic HTML + modular CSS + SVG where useful** — *as built: React components, one CSS file, lucide icons* | Lightweight clickable keycaps and fluid layout; no heavyweight component framework or bitmap needed |
| Design | CSS custom properties (tokens), responsive grid/flex, restrained animation | Keyboard prominently centered; customization in collapsible sections |
| State | Small typed store + typed event emitter | Explicit state ownership; no Redux, server-state or cache libraries |
| Audio | **Native Web Audio API** (`AudioContext`, `OscillatorNode`, `AudioBufferSourceNode`, `GainNode`, `BiquadFilterNode`, `ConvolverNode`, `DelayNode`, `DynamicsCompressorNode`) | No external audio service; reusable envelopes and voices; add Tone.js only if measurement justifies it |
| Sound assets | Built-in **synthesis first**, including synthesized percussion — *as built: grand piano is sampled (Salamander, CC BY 3.0, ~1.4 MB; D14); everything else synthesised; percussion not yet built* | Avoids sample licensing and large downloads; small licensed samples only if synthesis is judged inadequate |
| Demo timing | Transport/scheduler anchored to **`AudioContext.currentTime`**; song events authored in **beats** | One clock drives audio, key lighting and tab timeline |
| Persistence | **`localStorage`** for small, versioned preferences, custom mappings and presets | No account or hosted storage; validate on load and tolerate blocked storage |
| Recording | Typed note events → **Standard MIDI File** export; audio via `MediaStreamAudioDestinationNode` + `MediaRecorder` and/or offline WAV render | Local files only; detect supported audio MIME types instead of promising WAV/MP3 |
| Tests | **Vitest** (unit/integration), **Playwright** (Chromium + Firefox E2E — *as built: Chromium only so far*), `tsc --noEmit` | Deterministic music rules and input/timing regressions |
| Quality | ESLint + Prettier (*not yet added, P0-05*); automated accessibility checks; manual listening | Modest dev tooling; no SaaS quality dashboards |
| Packages | npm, committed `package-lock.json`, current Node LTS | Reproducible installs via `npm ci`; exact versions chosen and recorded at implementation time |
| Source + CI | GitHub, pull requests, GitHub Actions | Simple source control; typecheck/lint/unit/build/E2E gates |
| Release hosting | **GitHub Pages** (static) as first choice, configured only on request, **manual deploy only** | Minimal infrastructure; no auto-deploy |
| Alternate hosting | Cloudflare Pages or Netlify static, only if explicitly preferred | Not required |
| Analytics | **None** | Privacy-first; no third-party trackers |

### Version and compatibility policy

At implementation time, select **current stable, mutually compatible** versions of Node LTS, Vite, Vitest and Playwright, and re-check their official requirements rather than copying versions from planning documents. Record the result in `package-lock.json` and in [§20](#20-current-implementation--infrastructure-status). Dependency upgrades go through reviewed PRs, not unreviewed automatic major bumps.

---

## 3. Application architecture and data flow

The browser is the entire application runtime. There is no privileged or global keyboard hook: only DOM input events delivered to the page.

```text
physical key / pointer
        │
        ▼
  input normalizer ──► key resolver (layout + octave + transpose + scale)
        │                          │
        │                          ▼
        │                 NoteEvent (noteOn/noteOff, source, voiceId, at)
        │                          │
        │        ┌─────────────────┼──────────────────────┐
        │        ▼                 ▼                      ▼
        │   voice engine     key-state store        recorder (optional)
        │   (Web Audio)      (what is lit, by whom)
        │        │                 │
        │        ▼                 ▼
        │    speakers      computer-keyboard map + note readout

selected song ─► beat transport / scheduler ─► same NoteEvent path (source = "demo")
                                  └────────────► tab timeline / playhead (same clock)
settings (localStorage) ─► layout, instrument, sound shaping, appearance
```

**Single-clock rule.** There must be **one** transport timeline and one playback position. Audio is scheduled against the audio clock; visual updates read the same clock. Do not run a second independent timer that decides which demo key should light.

**Single-path rule.** User and demo notes use the same `NoteEvent` pipeline and differ only in `source`. This is what keeps audio, key lighting and recording consistent.

### Data contracts (conceptual — refine before coding)

```ts
type KeyId = string;                      // KeyboardEvent.code, e.g. "KeyA", "Semicolon"
type NoteSource = "physical" | "pointer" | "demo";

interface NoteEvent {
  type: "noteOn" | "noteOff";
  pitch: number;                          // MIDI 0–127; frequency derived from pitch
  velocity: number;                       // 1–127 (simulated; see §5)
  source: NoteSource;
  voiceId: string;                        // unique per note instance, not per pitch
  key?: KeyId;                            // lit key, when one exists
  at: number;                             // AudioContext time, seconds
}

type KeyAction =
  | { type: "note"; pitch: number }
  | { type: "drum"; drum: DrumId }
  | { type: "control"; control: "sustain" | "octaveUp" | "octaveDown" | "allNotesOff" };

interface KeyBinding { key: KeyId; action: KeyAction; }
interface Layout     { id: string; name: string; bindings: KeyBinding[]; }

interface SongNote { startBeat: number; durationBeats: number; pitch: number; velocity?: number; }
interface Song {
  id: string; title: string; difficulty: 1 | 2 | 3;
  referenceBpm: number; timeSignature?: [number, number];
  notes: SongNote[];                      // chords = several notes with the same startBeat
  provenance: { composer?: string; source: string; license: string; notes?: string };
}

interface TransportState {
  status: "stopped" | "playing" | "paused";
  positionBeats: number; bpm: number;
  loop: { enabled: boolean; startBeat: number; endBeat: number };
  generation: number;                     // cancellation token for stale callbacks
}

interface Settings { schemaVersion: number; /* instrument, layout, octave, scale, sound, appearance… */ }
interface Recording { startedAt: number; events: NoteEvent[]; audio?: Blob; }
```

Songs are authored in **pitches and beats**, never in physical keys: tabs are *derived* from the current layout (see [§8](#8-demo-songs-and-synchronized-playback)).

---

## 4. Repository structure and module organization

This is a **target** layout, not a statement of what exists (the built layout, and its known deviations, are in [§20](#20-current-implementation--infrastructure-status) and [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md)):

```text
/
├── AGENTS.md                    # mandatory agent workflow
├── ARCHITECTURE.md              # this document
├── TODO.md                      # phase checklist and acceptance gates
├── README.md
├── LICENSE                      # MIT (decision D1)
├── docs/
│   └── PRODUCT_CONCEPT.md       # product and UI behavior
├── public/                      # static assets (only rights-cleared; ideally none initially)
├── src/
│   ├── main.ts                  # entry point / lifecycle
│   ├── app/                     # store wiring and orchestration
│   ├── input/                   # DOM key + pointer normalization, focus/blur handling
│   ├── music/                   # pure logic: pitch, scales, layouts, resolver, song types/validation
│   ├── audio/                   # AudioContext, voices, instruments, effects, master chain
│   ├── transport/               # beat transport, look-ahead scheduler, loop/tempo
│   ├── recording/               # event recorder, MIDI encoder, audio export
│   ├── ui/                      # keyboard map, customization panel, song player, dialogs
│   ├── styles/                  # design tokens, layout, component CSS
│   └── data/                    # built-in songs and layout definitions
├── tests/                       # unit/integration (Vitest); e2e/ for Playwright
├── index.html
├── package.json / package-lock.json
├── tsconfig.json
├── vite.config.ts
└── .github/workflows/           # PR checks (later), manual deploy (later)
```

**Ownership and dependency rules**

| Module | Owns | Must not |
| --- | --- | --- |
| `music/` | Pure functions and types: pitch math, scales, layout resolution, song validation | Import DOM or Web Audio (must run in plain Node tests) |
| `input/` | The *only* place raw `KeyboardEvent`/`PointerEvent` are interpreted | Create audio nodes or touch UI state directly |
| `audio/` | The *only* place Web Audio nodes are created; voice lifecycle | Know about DOM or songs |
| `transport/` | Beat↔time mapping, scheduling, loop/tempo | Hold a direct `AudioContext` reference — depend on a small `AudioClock` interface so tests can use a virtual clock |
| `recording/` | Event capture, MIDI/audio encoding | Alter live playback |
| `ui/` | Rendering and user intent | Compute note timing or create voices |

Allowed import direction: `ui → app → {input, audio, transport, recording} → music`. Add folders as work makes them necessary; do not create empty directories or config files just to match this diagram. Boundary rules may later be enforced with an ESLint restricted-imports rule.

---

## 5. Keyboard input handling and key mapping

### Identity and layouts

- Use **`KeyboardEvent.code`** (physical key position, e.g. `KeyA`) for bindings, so mappings are stable across OS keyboard layouts. Use `event.key` or, where available, the Keyboard Map API (`navigator.keyboard.getLayoutMap()`, Chromium-only) **only for display legends**, as progressive enhancement.
- A **layout** is data: a list of `KeyBinding`s. Ship at least a default piano-style layout and one alternate; user remaps are stored as an override layer on top of a base layout.

**Proposed default layout ("Piano / musical typing")** — a convention familiar from DAW "musical typing":

```text
 sharps:     W   E       T   Y   U       O   P
            C#4 D#4     F#4 G#4 A#4     C#5 D#5
 naturals: A   S   D   F   G   H   J   K   L   ;   '
           C4  D4  E4  F4  G4  A4  B4  C5  D5  E5  F5
 controls: Space = sustain · Z / X = octave down / up · Esc = all notes off
```

**Alternate layouts (decision D4):**

- **Scale rows** — every key is in the selected scale. Bottom row `Z X C V B N M , . /` = scale degrees 1–10; top row `Q W E R T Y U I O P` continues with degrees 11–20. No black-key gymnastics; ideal for beginners.
- **Drum pads** — `Z X C V B N M ,` = kick, snare, closed hat, open hat, low tom, high tom, clap, crash. Only available with the percussion instrument.

Control keys are part of a layout so they can be remapped too. Non-QWERTY keyboards use the same physical positions (`KeyboardEvent.code`); legends follow the Keyboard Map API where available and otherwise show the QWERTY label.

### Pitch resolution pipeline

`base pitch from binding → + octave shift × 12 → + transpose → scale lock → clamp 0–127 → NoteEvent`

Labels in the keyboard map are produced by the **same** resolver, so a label can never disagree with the sound. **Scale lock (decision D5):** when enabled, a resolved pitch that is not in the selected scale **snaps to the nearest in-scale pitch (ties snap down)**. The key's label shows the pitch that will actually sound, and snapped keys are marked so the behavior is visible. Scale lock is off by default; the "Scale rows" layout provides the degree-mapped alternative.

### Event rules

- On `keydown`: ignore `event.repeat` for an already-held physical key; ignore events with Ctrl/Meta/Alt held (browser/OS shortcuts); ignore while `event.isComposing`.
- On `keyup`: release **that key's own** voice only.
- Never intercept typing when focus is in an `input`, `textarea`, `select`, `[contenteditable]`, or a remap-capture field. Call `preventDefault()` only for *mapped* keys while the app is actively being played (this stops Space/arrow scrolling without breaking the rest of the page).
- Release all physical-key voices on `window` `blur`, `visibilitychange` (hidden), and when the AudioContext is suspended. On macOS, `keyup` is not delivered for non-modifier keys while Cmd is held; treat Meta keydown as "release all" rather than leaving notes stuck.
- Pointer input uses Pointer Events with `setPointerCapture`, and handles `pointerup`, `pointercancel` and `lostpointercapture`; set `touch-action: none` on the keyboard so multi-touch chords work.
- Pointer events carry the same `NoteEvent` shape with `source: "pointer"`.

### Velocity simulation

Computer keys are not velocity-sensitive. **Decision D6:** a **fixed velocity** setting (default 100, adjustable 1–127) for physical keys, plus **pointer-position velocity** on on-screen keys (striking nearer the front/bottom of a key is louder; can be switched off). There is deliberately **no keyboard accent modifier** in the first release: Shift/Alt interact badly with typing, sticky keys and browser shortcuts. Velocity scales gain and, for some instruments, filter brightness.

### Known hardware limit

Many physical keyboards cannot report arbitrarily many simultaneous keys (rollover limits and "ghosting" vary by keyboard). The app cannot fix this; the documentation and settings help should say so, and clicking/touching on-screen keys is not subject to the limit.

---

## 6. Audio engine: synthesis, instruments, latency and polyphony

### Lifecycle

1. Create/resume a **single** `AudioContext` on an explicit user gesture (keydown, pointerdown or click). Show clear "click or press a key to enable sound" guidance until the context is `running`.
2. Route all voices through one master chain: `voice → instrument bus → [filter] → send-effects (delay, reverb) → master gain → DynamicsCompressor → destination`, plus a tap to a `MediaStreamAudioDestinationNode` for recording. Effects are **created once and reused**, not per key.
3. Maintain a registry of active voices keyed by **unique voice identity** (`source + key/voiceId`), never by pitch alone, so a user note and a demo note at the same pitch cannot cut each other off.
4. Apply envelopes with Web Audio time-based automation (`setValueAtTime`, `linearRampToValueAtTime`, `setTargetAtTime`) to avoid clicks. `cancelAndHoldAtTime` is not universally supported — use `cancelScheduledValues` plus an explicit `setValueAtTime` fallback.
5. After the release tail, `stop()` and **disconnect** nodes so no oscillators, buffers or timers leak.
6. Provide an obvious **Stop All / All Notes Off**, and run the same cleanup on blur, visibility change, song stop and instrument change.

### Instruments (proposed, all synthesized)

| Instrument | Approach |
| --- | --- |
| Piano-like | Additive `PeriodicWave` partials + fast attack, exponential decay, gentle low-pass; an *approximation*, not a sampled piano |
| Synth | Detuned saw/square pair, filter envelope, selectable waveform |
| Bass | Triangle/sine + low-pass with short attack, longer sustain |
| Chiptune | Pulse (via `PeriodicWave` duty cycles) and triangle with stepped/vibrato envelopes, noise channel |
| Drums / percussion | Separate path: key → drum trigger. Kick = pitch-swept sine; snare = noise burst + tone; hats = high-passed noise. Not pitched waveforms renamed "drums" |

Every instrument implements one small interface — `createVoice(ctx: BaseAudioContext, out: AudioNode, params) → { noteOn(t, velocity), noteOff(t), dispose() }` — and takes a **`BaseAudioContext`**, so the same code can render offline with `OfflineAudioContext` for WAV export and tests.

### Polyphony

- A voice cap (initial proposal: 32, to be tuned by measurement) with deterministic **voice stealing**: oldest *released* voice first, then oldest sounding voice, never stealing a currently-held user note while a releasing/demo voice is available.
- A modest per-voice gain scale plus the master compressor protects against clipping when many keys are held.

### Latency

- Use `new AudioContext({ latencyHint: "interactive" })`. User-triggered notes are started *immediately* (at `currentTime`), not through a look-ahead queue.
- Native node graphs run on the audio thread, so main-thread jank does not delay already-scheduled audio.
- Read `baseLatency` and, where supported, `outputLatency` for diagnostics and optional visual compensation. Bluetooth headphones add large, unavoidable delay.
- **No numeric latency promise** until measured on real devices and browsers.
- Avoid deprecated `ScriptProcessorNode`; reach for `AudioWorklet` only if a native-node approach is demonstrably insufficient.

---

## 7. Real-time visual keyboard state

The virtual keyboard is a **real interactive rendering** (HTML/SVG), not a fixed bitmap — bitmaps cannot reflect remaps, multi-source state, accessibility, window size or live labels.

### State model

Each key tracks *which sources currently hold it*, not a single boolean:

```ts
interface KeyVisualState {
  user: Set<string>;     // voiceIds held by physical/pointer input
  demo: Set<string>;     // voiceIds held by demo playback
  sustained: boolean;    // audio still sounding after physical release (sustain pedal)
}
```

Derived presentation states: `idle`, `user`, `demo`, `both`, `sustained`, `unmapped`, plus focus/disabled. Visual state releases only when **that source** releases, so ending a demo cannot unlight a key the user is still holding.

### Rendering

- A change updates **one key's `data-state` attribute** (CSS does the rest). Never re-render the whole keyboard on a note event; re-render labels only when mapping/octave/scale change.
- **User input** is applied synchronously in the event handler.
- **Demo notes** are scheduled slightly *ahead* on the audio clock, so lighting must wait for the audible time: each scheduled note also enqueues a visual event `{ at, key, on|off }`; a `requestAnimationFrame` loop applies events whose `at ≤ audioContext.currentTime` (optionally shifted by measured output latency). This is what keeps tabs, lights and sound aligned.
- Sustained-but-released notes use a distinct indicator from physically held keys.
- States must be distinguishable **without color** (border style, depth, pattern/icon) and respect `prefers-reduced-motion`.

---

## 8. Demo songs and synchronized playback

### Data

Songs are static, validated data modules (or JSON) under `src/data/`, each carrying **provenance and license** ([§13](#13-security-privacy-and-music--sample-licensing)). A validator (run in unit tests) rejects overlapping-same-pitch errors, negative durations, notes outside 0–127, missing provenance, and non-finite values.

```ts
// Illustrative only
const odeToJoy: Song = {
  id: "ode-to-joy", title: "Ode to Joy", difficulty: 1, referenceBpm: 100,
  provenance: { composer: "L. van Beethoven", source: "original data entry by project", license: "public-domain melody; arrangement CC0/owner-licensed" },
  notes: [{ startBeat: 0, durationBeats: 1, pitch: 64 }, { startBeat: 1, durationBeats: 1, pitch: 64 } /* … */],
};
```

### Tab derivation and out-of-range handling

For each song note, the **key resolver** (the same one live input uses) finds the key that currently produces that pitch under the active layout/octave/transpose/scale. If several keys produce the pitch, the *first in layout order* is the canonical demo key (the mapping UI should warn about duplicates). If **no** key can play the pitch, the tab shows an explicit "out of range / unmapped" indicator, and the UI offers a deliberate fit/transpose option — it must **never** light an unrelated key.

### Transport and scheduling

- **Beat ↔ time mapping:** `positionBeats(t) = anchorBeat + (t − anchorTime) × bpm / 60`. Tempo change, pause/resume and seek re-anchor (`anchorBeat`, `anchorTime`) rather than accumulating timer drift.
- **Look-ahead scheduler:** a lightweight ticker (e.g. every ~25 ms) schedules all notes whose start falls inside a short window (e.g. ~100 ms) on the audio clock. `setTimeout` never *plays* a note; it only refills the schedule.
- **Visuals follow audio:** the tab playhead and key lighting are derived from the transport position and the visual event queue ([§7](#7-real-time-visual-keyboard-state)), not the other way around.
- **Controls:** play, pause, resume, stop, restart, tempo (scales BPM; both sound and visuals follow), loop. Notes that straddle the loop end are clipped at the loop boundary.
- **Cancellation:** a `generation` token invalidates callbacks from a previous run. Stop, pause, song change, instrument change and layout change release **demo-owned** voices only — held user notes are untouched.
- **Play-along:** user and demo notes run side by side with distinct sources; recording excludes demo notes unless "record demo / both" is chosen.
- **Background tabs (decision D10):** timers throttle; the audio clock does not. The transport **pauses when the page becomes hidden** and stays paused until the user resumes it; this is covered by a test.
- **Testability:** the transport depends on an injected `AudioClock` and an event sink, so unit tests drive a virtual clock and assert exact event times with no real audio.

### Pause semantics (decision D10)

Pausing releases demo voices; resuming continues from the next note boundary and does *not* re-strike a note that was mid-flight at the pause point.

---

## 9. Customization settings and local persistence

### Settings model

All customization lives in one validated, versioned object (illustrative):

```ts
interface Settings {
  schemaVersion: 1;
  instrument: { id: string; params: Record<string, number> };
  layout: { baseId: string; overrides: Record<KeyId, KeyAction | null> };
  pitch: { octaveShift: number; transpose: number; scale: { root: number; id: string; lock: "off" | "snap" } };
  performance: { sustain: boolean; velocity: { mode: "fixed" | "pointer"; value: number }; voiceCap: number };
  sound: { masterVolume: number; adsr: { a: number; d: number; s: number; r: number }; filter: number; reverb: number; echo: { mix: number; time: number; feedback: number } };
  timing: { metronome: boolean; bpm: number };
  appearance: { labelMode: "key" | "note" | "both"; theme: "dark" | "light" | "system"; reducedMotion: "system" | "on" | "off" };
}
```

### Persistence rules

- Store under a namespaced key such as `keyboard-studio:settings`, JSON-encoded, with `schemaVersion`. **Validate on load**: unknown, malformed or out-of-range values fall back to defaults field by field; never crash on bad stored data.
- Provide explicit **migrations** between schema versions and tests for each.
- Wrap every storage access in try/catch: storage may be unavailable (private mode, blocked site data, quota). The app must work with in-memory settings and tell the user persistence is unavailable.
- **Reset** returns to defaults behind a confirmation. Named **presets** (save/load) are stored the same way with a bounded count; import/export of preset JSON is a later enhancement.
- Settings changes are applied **immediately** to labels, sound and demo tabs through the single store; no "apply" step.
- IndexedDB is only for substantially larger persisted data (for example saved recordings) and only if explicitly needed later.

---

## 10. Recording and MIDI / audio export

### Event capture

The recorder subscribes to the same `NoteEvent` stream, stamps events against the audio clock, and by default captures **user** sources only. "Record demo" / "record both" are explicit options. Recording state, elapsed time and a clear stop control are always visible.

### MIDI export (primary)

- Hand-written **Standard MIDI File** encoder (small; no dependency needed): format 0 or 1, fixed PPQ (e.g. 480), a tempo meta event, `noteOn`/`noteOff` events with delta-times, program-change per instrument (General MIDI numbers), drums on channel 10.
- Seconds → ticks uses an explicit tempo (metronome BPM, or a default); document that MIDI stores *performance events*, not this app's exact synthesized sound or effects.
- Tests verify event ordering, note lengths, header/track chunk validity and variable-length quantity encoding; a manual check opens an exported file in an external MIDI tool.

### Audio export

- **Real-time capture:** `MediaStreamAudioDestinationNode` → `MediaRecorder`. Choose the container with `MediaRecorder.isTypeSupported()` (commonly WebM/Opus in Chromium, Ogg/WebM in Firefox, MP4/AAC in Safari). Show the actual extension; never offer a format the browser cannot produce.
- **Offline render (optional):** re-render recorded events with `OfflineAudioContext` using the same instrument code, then encode **WAV** with a small hand-written encoder. This is deterministic and faster than real time, and requires instruments to accept a `BaseAudioContext` ([§6](#6-audio-engine-synthesis-instruments-latency-and-polyphony)).
- Files are created locally as `Blob`s and downloaded via object URLs that are **revoked** after use. Nothing is uploaded.

---

## 11. UI architecture and responsive design

**Large central virtual computer keyboard (mandatory):** semantic key elements (buttons, with SVG for decorative detail if useful), realistic staggered rows driven by **geometry data** (rows of `{ code, label, widthUnits }`), keycaps showing physical key + mapped note, pointer support. States: idle, user-held, demo-held, both, sustained, unmapped, focus, disabled.

**Customization panel (side):** groups — *Quick* (instrument, octave, scale, volume, sustain, demo tempo) / *Instrument* / *Key mapping* / *Sound shaping* / *Advanced*. Quick controls stay visible; complex mapping and effects live behind progressive disclosure. Reset is reversible or confirmed.

**Demo player (below the keyboard):** song picker, animated key-tab timeline with moving playhead and highlighted current note(s), play/pause/stop/restart, tempo, loop. Demo and manual lighting are visually distinct.

**Recorder area (later):** visible record state, elapsed time, separate MIDI and audio actions. No download button for unavailable formats.

### Responsive behavior

- Sizing is driven by a single key-unit custom property so the keyboard scales as one object and keeps its proportions.
- **Wide (desktop):** side customization panel + central keyboard + song player below.
- **Medium (tablet):** panel collapses into a drawer; keyboard stays full width.
- **Narrow (phone):** show the playable rows at readable key size with horizontal scroll or a compact view rather than microscopic keys; target size of touch keys follows WCAG 2.2 minimum target guidance, with larger preferred.
- The keyboard must never be hidden by the customization UI.

### Implementation approach

Plain TypeScript modules: each component is a function that creates DOM, subscribes to a narrow slice of the store, and exposes a `destroy()`. A light framework is only introduced if this demonstrably becomes unmanageable (documented decision, see [§18](#18-dependencies-tradeoffs-and-future-scalability)).

---

## 12. Accessibility and browser compatibility

### Accessibility (target: WCAG 2.2 AA where applicable)

- All controls are real, labelled HTML controls reachable and operable by keyboard; visible focus styles.
- Virtual keys expose an accessible name that includes key and note (e.g. "A, C4"). Do **not** announce every note via a live region; announce only meaningful state changes (song started/stopped, recording started/stopped, errors).
- Performance-key capture is scoped: mapped keys act as instrument input when focus is on the keyboard region or page body, never inside form controls or remap fields. Provide a way to leave "play focus" (Esc / Tab) so keyboard users are not trapped. Space-as-sustain must not break native Space activation on focused buttons.
- States never rely on color alone; support `prefers-reduced-motion`, `prefers-color-scheme` and `forced-colors` (high contrast); avoid flashing more than three times per second.
- Provide **Stop All** at all times. Sufficient text contrast (4.5:1) and non-text contrast (3:1) for key states.

### Browser compatibility

| Target | Support level |
| --- | --- |
| Recent Chrome, Edge (Chromium) on desktop | Primary; E2E-tested |
| Recent Firefox on desktop | Primary; E2E-tested; special attention to audio timing and `MediaRecorder` formats |
| Recent Safari (macOS/iOS) | Best effort; unverified until a Safari environment is available |
| Mobile / touch | Evaluated separately in Phase 5; iOS requires a user gesture to start audio and hardware mute may silence Web Audio |

Feature-detect rather than user-agent-sniff: Web Audio, `MediaRecorder`, `OfflineAudioContext`, Keyboard Map API, `outputLatency`, `localStorage`. If Web Audio is missing or blocked, show a clear unsupported message instead of failing silently.

---

## 13. Security, privacy and music / sample licensing

- **No telemetry, accounts, third-party trackers or uploads.** Key events are processed locally and never logged or sent anywhere.
- **Key capture is scoped to the page** — no global hooks, no key logging. Do not persist raw keystroke history; recordings are explicit, user-initiated, and local.
- Use a strict, simple static-site posture: HTTPS hosting, no inline third-party scripts; a restrictive Content-Security-Policy meta tag is a Phase 5 hardening item where compatible with the hosting choice.
- Persisted settings are untrusted input and are validated on load ([§9](#9-customization-settings-and-local-persistence)). If MIDI/song import is added later, bound file size, track/event counts and values.
- Object URLs are revoked after export; no sensitive data is needed to play a note.
- Dependencies are minimal and lockfile-pinned; CI runs on every PR; review security advisories before upgrades.
- **Licensing:** every built-in song and any sound asset records provenance and redistribution rights. Prefer public-domain melodies **encoded by hand as original data** over importing third-party MIDI/recordings of unknown license. Synthesized sounds avoid sample-pack licensing entirely. The repository's source code is licensed under the **MIT License** (decision D1; see `LICENSE`). Third-party song and sound material is licensed separately and must record its own provenance.

---

## 14. Development environment and expected commands

> **Runnable since 2026-10-10**, except `npm run lint` (ESLint/Prettier are not added yet — `P0-05`). Also available: `npm run probe:audio` (offline-render level report) and `npm run screenshots`.

| Command | Purpose |
| --- | --- |
| `npm ci` | Reproducible install (`npm install` only when intentionally changing dependencies) |
| `npm run dev` | Local Vite dev server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (+ Prettier check) |
| `npm run test` | Vitest unit/integration |
| `npm run test:e2e` | Playwright (Chromium + Firefox) |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the production build locally |

Environment: current Node LTS (pinned via `.nvmrc`/`engines`), npm, a recent Chromium-family browser and Firefox for manual and E2E verification. Windows is the primary developer platform; scripts must not assume a POSIX shell.

---

## 15. Testing strategy

| Level | What it must check |
| --- | --- |
| Unit (`music/`, `transport/`, `recording/`) | Mapping collisions and defaults, scale/transpose/octave math, note labels, song validation and durations, beat↔time mapping, tempo/loop/pause arithmetic with a **virtual clock**, MIDI/WAV encoding, settings validation and migrations |
| Integration | One `NoteEvent` drives audio + key state + recorder; user/demo source ownership; sustain and release; focus-loss cleanup; song switch cleanup |
| Browser E2E (Playwright) | Press/release lights and unlights the correct key; multi-key chords; pointer press; remap updates labels and sound path; song select/play/pause/stop/tempo/loop; reduced-motion; text fields do not trigger notes |
| Export | MIDI event ordering and lengths, valid headers; audio MIME feature detection |
| Accessibility | Automated checks (e.g. axe via Playwright) for labels/contrast/roles, plus manual keyboard-only and screen-reader passes |
| Manual audio | First-interaction unlock, real listening in Firefox and Chromium, clipping, perceived latency, stuck notes, background-tab behavior |

Use a stubbed/instrumented `AudioContext` (injected via the `AudioClock`/factory seam or `page.addInitScript`) where deterministic assertions are needed. **Headless CI cannot certify audible quality or real-world latency** and must not be described as doing so. Any test-only hooks must not ship as production behavior.

---

## 16. GitHub Actions CI strategy

*Implemented 2026-10-10 in `.github/workflows/ci.yml`: typecheck → unit tests → build, plus a separate Chromium E2E job (including the offline production-build test); read-only token; no deploy steps. Still open: a lint step (`P0-05`) and Firefox E2E (`P0-07`).*

- **PR checks** — trigger: `pull_request` targeting `main` (and optionally `push` to `main`, for verification only). Steps: checkout → set up Node (cache npm) → `npm ci` → typecheck → lint → unit tests → build. A second job runs Playwright on Chromium and Firefox and uploads the report/artifacts on failure.
- Least privilege: `permissions: contents: read`; no `pull_request_target`; no secrets needed; pin third-party actions to a major version tag or commit SHA; use `concurrency` to cancel superseded runs.
- Once workflows exist and are stable, require them as **status checks** via branch protection/rulesets on `main` (an owner/admin action).
- **CI never deploys.** Pull requests do not publish previews to a public host.
- Optional later: Dependabot (grouped, scheduled, reviewed) for npm and GitHub Actions. Owner decision.

---

## 17. Infrastructure and deployment strategy

**Principle: no automatic production deployment on push or merge.** Production release is a manual, deliberate action.

| Concern | Plan |
| --- | --- |
| Hosting | Static files from `dist/`. **GitHub Pages** is the first choice (free, same platform); Cloudflare Pages / Netlify only on explicit request |
| Trigger | A separate deploy workflow triggered **only** by `workflow_dispatch` (owner presses "Run workflow" and picks the ref) |
| Deploy job | Re-run checks → `npm ci` → `npm run build` → upload `dist/` as a Pages artifact → deploy via the official Pages actions, with `permissions: pages: write, id-token: write, contents: read` and the `github-pages` environment |
| Base path | Vite `base: "/Musical-Keyboard-Instrument/"` for the project-site URL (or `/` with a custom domain) |
| Backend / DB / storage / auth | **None.** Not needed; adding any requires an owner decision and an architecture update |
| Domain / DNS / certificates | Not assumed; GitHub-provided HTTPS URL is sufficient |
| Secrets | None required |
| Environments | A single production environment; local dev and PR CI are the only others. No standing staging site |
| Versioning | Lightweight tags/changelog at release time; no auto-versioning bot |
| Rollback | Re-run the deploy workflow on a previous tag/commit |

Enabling GitHub Pages, creating the deploy workflow, and any custom domain are **explicit, owner-approved** steps tracked in Phase 5 of [TODO.md](TODO.md). The deploy workflow (`.github/workflows/deploy-pages.yml`) exists and is `workflow_dispatch`-only; owner approval (`G-03`) was given on 2026-10-10.

---

## 18. Dependencies, tradeoffs and future scalability

### Dependency budget

- **Runtime dependencies — target: none; as built: three (D12).**
  - `react`, `react-dom` (18.x) — the UI has eight stateful components with live cross-component
    state (held notes, learn progress, recording); a declarative renderer removed a class of
    manual DOM-sync bugs. The revisit trigger in the original tradeoff ("component/state
    complexity becomes hard to maintain") was met by the first implementation.
  - `lucide-react` — tree-shaken SVG icons (about a dozen are used).
  - Everything else (audio, scheduling, MIDI, storage, store) is hand-written on browser APIs.
- **Development dependencies (as built):** TypeScript, Vite, `@vitejs/plugin-react`, Vitest 5 with
  jsdom, Testing Library (`react`, `jest-dom`), Playwright. Not yet added: ESLint (+ typescript-eslint)
  and Prettier (`P0-05`), an accessibility-testing helper (`P5-02`).
- **Security:** `npm audit` reported 0 vulnerabilities when this was merged (Vitest was moved from
  3.x to 5.x to clear advisories in its dev-only `tinypool` / `@vitest/mocker`). Each addition must be
  justified in its PR and reflected here.

### Key tradeoffs

| Decision | Chosen | Alternative | Consequence / revisit trigger |
| --- | --- | --- | --- |
| UI approach | Vanilla TS + HTML/CSS — *superseded by D12: React* | React/Svelte/Vue | Fewer dependencies and faster start; revisit if component/state complexity becomes hard to maintain |
| Audio | Native Web Audio | Tone.js | Full control and zero dependency; more code to write. Revisit if scheduling/instrument work is demonstrably costly |
| Sounds | Synthesized — *piano superseded by D14: sampled* | Sampled soundfonts | No licensing or download size; less realistic piano. Revisit with properly licensed samples if quality is judged inadequate |
| Persistence | `localStorage` | IndexedDB | Simple and synchronous; limited size. IndexedDB only if saved recordings/projects are added |
| Timing | Look-ahead on audio clock | `setTimeout`/`setInterval` playback | Slightly more code; required for accuracy |
| Hosting | Manual-deploy GitHub Pages | Auto-deploy / preview deploys | Fewer surprises and no notification noise; one extra manual step per release |
| Layout identity | `KeyboardEvent.code` | `event.key` | Stable positions across layouts; legends may differ on non-QWERTY keyboards |

### Future scalability (only if explicitly prioritized)

Imported MIDI/songs and a practice mode (Phase 6); sampled instruments; a PWA/offline mode; additional keyboard layouts (AZERTY, QWERTZ); Web MIDI input from a real MIDI keyboard; a piano-roll view. The module boundaries in [§4](#4-repository-structure-and-module-organization) are designed so these can be added without rewriting input, audio or transport. A backend, accounts or sharing features are **out of scope** and would require a new, explicit decision.

---

## 19. Phased development roadmap

Phases are tracked task-by-task, with IDs and acceptance criteria, in [TODO.md](TODO.md). Build in **vertical slices**, not a giant scaffold or an architecture rewrite.

| Phase | Outcome | Depends on | Exit gate |
| --- | --- | --- | --- |
| **0 — Repository foundation** | Minimal Vite + TypeScript shell, scripts, lint/typecheck/test tooling, PR CI, docs kept accurate | Owner authorizes build (`G-01`) | Fresh clone installs and all checks pass; CI green on a PR; no deployment configured |
| **1 — Interactive keyboard & basic audio** | Central keyboard map; low-latency synth; physical + pointer + multi-key input; release and focus safety | Phase 0 | Physical and pointer play light exactly the right keys and sound in Chromium and Firefox; no stuck notes |
| **2 — Customization & settings** | Instruments, octave/scale, remapping, volume, sustain, saved local settings | Phase 1 | Changes immediately affect sound, labels and lit keys; settings persist and reset |
| **3 — Demo songs & synchronized playback** | Song data, beat transport, synchronized sound + key lighting + animated tabs, tempo/pause/loop, play-along | Phases 1–2 | No drift or stale notes; custom mappings and simultaneous manual play represented correctly |
| **4 — Recording, export & effects** | Recording, MIDI export, supported audio export, reverb/echo, metronome | Phase 3 | Valid downloadable performance; formats accurately labeled; no glitches |
| **5 — Testing, accessibility, optimization & release** | Browser matrix, a11y pass, performance, licensing audit, optional **manual** Pages deploy | Phases 0–4 | All checks pass; owner approves release and verifies live app |
| **6 — Optional future enhancements** | Import songs/MIDI, practice modes, presets sharing, richer sounds, etc. | Phase 5 + explicit prioritization | Each addition justified by user value and complexity |

Product-concept build order maps to these phases as follows: concept "Phase 1 — Playable visual instrument" = roadmap Phases 0–2; "Phase 2 — Learn with live demo tabs" = Phase 3; "Phase 3 — More complete studio" = Phases 4–5.

### Phase execution convention

At the start of each phase, pick an implementable vertical slice and its test plan. In every PR: mark only **demonstrated** tasks complete in `TODO.md`; update [§20](#20-current-implementation--infrastructure-status) and any changed decisions/stack; keep product requirements in `PRODUCT_CONCEPT.md`. A UI control existing is not evidence that the behavior works.

---

## 20. Current implementation & infrastructure status

**As of 2026-10-10**, with the first application PR (#4). Items marked *not built* do not exist.

### Implementation

| Area | Status |
| --- | --- |
| Application source | **Exists:** `src/` (TypeScript strict, React 18), `index.html`, `public/`. Built layout: [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md) |
| Toolchain | Node 24 LTS (`.nvmrc`), npm + `package-lock.json`, Vite 6, TypeScript 5.7, Vitest 5 + jsdom + Testing Library, Playwright (Chromium). **No ESLint / Prettier yet** (`P0-05`) |
| Keyboard | 61-key piano keybed with computer-key legends and a marked 25-key QWERTY window; physical, pointer and multi-touch input; sustain (hold Space or latch); octave shift; panic. **Not** the QWERTY-shaped key map in the concept (**D13**) |
| Audio engine | Native Web Audio: sampled grand piano + synthesised electric piano, polysynth, bass, chiptune, organ; per-instrument buses and effects, master limiter, voice cap with stealing, offline-renderable (`BaseAudioContext`) |
| Demo songs | 8 public-domain multi-part arrangements with recorded provenance; audio-clock look-ahead player (tempo change, loop, part mute); Learn mode; note roll |
| Customization | Instrument, 5 tone controls per instrument, touch, master volume, label toggles; persisted (schema v2, v1 migration). **Not built:** key remapping, alternate layouts, scales/transpose, presets, drums, global reset |
| Recording / export | Takes with velocity and pedal, replay, rename, delete; MIDI export of takes and arrangements. **Not built:** audio export, echo, metronome |
| Offline | Service worker caches the app and samples after one visit (`P6-08`, in part: no web-app manifest) |
| Tests | 146 unit/integration (Vitest) and 76 E2E (Playwright/Chromium: layout stability at 4 viewports, flows, offline production build, offline-rendered audio checks). **Firefox E2E not configured** |
| Documentation | `README.md`, `TODO.md`, `ARCHITECTURE.md`, `docs/IMPLEMENTATION.md`, `docs/PRODUCT_CONCEPT.md`, `docs/REVIEW.md`, `AGENTS.md` |

### Known deviations from the planned architecture

- **Module boundaries (§4).** Window-level key listeners and note orchestration live in `app/studio.ts`, and pointer handling in `components/Keyboard.tsx`; §4 reserves raw-event interpretation for `input/`. Extract an `input/` module when remapping (`P2-13`) is built. `transport/` and `recording/` are `playback/` and `app/`; `data/` holds the key map and instrument presets, while songs live in `music/songs.ts`.
- **No `AudioClock` interface.** The player depends on the engine's context; tests inject a fake engine (an equivalent seam under a different name).
- **Visual keyboard (D13).** Piano keybed, not a QWERTY-shaped key map.
- **Song schema.** `music/song.ts` (parts + notation → beat-based notes, with required `provenance`) rather than the `Song` / `SongNote` contract sketched in §3.
- **Settings.** A flat versioned preferences object, not the nested model in §9.

### Infrastructure

| Item | Status |
| --- | --- |
| GitHub repository `TruffleFrog/Musical-Keyboard-Instrument` (public), default branch `main` | Exists |
| Merge methods | Squash, merge-commit and rebase all allowed (repo defaults) |
| Branch protection / rulesets on `main` | **None configured** (`P0-10` open — owner/admin action) |
| GitHub Actions | `ci.yml` (PRs and pushes to `main`: typecheck, unit tests, build, Chromium E2E; `contents: read`; never deploys) and `deploy-pages.yml` (**`workflow_dispatch` only**) |
| GitHub Pages | Owner approval given 2026-10-10 (`G-03`). Enabling Pages and the first manual deploy happen immediately after this PR merges and are recorded in the follow-up PR |
| Custom domain, DNS, backend, database, secrets | **None, none planned** |
| Dependabot version updates (`dependabot.yml`) | **Not configured** (`P0-12`) |
| Dependabot alerts / `npm audit` | `npm audit` clean (0 vulnerabilities) at merge |
| Source-code license | **MIT** (D1); `LICENSE` present. Third-party audio: Salamander piano, CC BY 3.0 — attribution in `public/samples/piano/ATTRIBUTION.txt`, README and in-app help |

When implementation or infrastructure changes, update this section in the **same PR** and link the PR. Do not rewrite long-term decisions elsewhere merely to match an incomplete feature.

---

## 21. Decisions and open questions

The repository owner delegated the open decisions D1–D11 to the assistant on **2026-10-10**; they are recorded below as **decided**. D12–D16 record departures that arose when the first implementation was written at the owner's direction. All are reversible by a documented PR (state date, reason, alternatives and evidence). Decisions that depend on measurement are marked *revisit*.

| # | Decision | Outcome | Status | Revisit when |
| --- | --- | --- | --- | --- |
| D1 | Source-code license | **MIT**. Simple, permissive, well understood; suits a portfolio/open-source project | Decided | Only if the owner wants copyleft or patent terms (Apache-2.0) |
| D2 | Instrument roster and percussion source | Synthesized piano-like, synth, bass, chiptune (Phase 2) and drums/percussion; **no sample packs** | Decided | If synthesized piano is judged inadequate → licensed samples (Phase 6) |
| D3 | Native Web Audio vs. Tone.js | **Native Web Audio**; Tone.js not used | Decided | Only on measured evidence that scheduling/instrument work is too costly |
| D4 | Layouts and non-QWERTY presentation | Default **Piano (musical typing)**; alternates **Scale rows** and **Drum pads** (§5); bindings by `KeyboardEvent.code`, legends via Keyboard Map API when available | Decided | Phase 6 adds AZERTY/QWERTZ-specific layouts |
| D5 | Scale-lock semantics | **Snap to nearest in-scale pitch, ties snap down**; label shows sounding pitch; off by default | Decided | After usability testing in Phase 2 |
| D6 | Velocity simulation | Fixed velocity (default 100) + pointer-position velocity; **no keyboard accent modifier** | Decided | If users ask for physical-key dynamics |
| D7 | Mobile/touch scope | **Best effort**: tablets fully supported via touch; phones get a compact/scrollable keyboard; not a release blocker | Decided | Phase 5 device testing |
| D8 | Export formats | **MIDI always**; audio via `MediaRecorder` in the browser-supported container (extension shown); offline **WAV** is optional (`P4-09`) | Decided | Phase 4 browser-matrix results |
| D9 | Hosting and release cadence | **GitHub Pages, manual `workflow_dispatch` deploy only**; no auto-deploy, previews or custom domain. *Activation still requires owner approval (`G-03`)* | Decided (activation gated) | If the owner prefers another static host |
| D10 | Background-tab and pause/resume behavior | **Pause on hidden; resume from next note boundary; no re-strike** (§8) | Decided | Phase 3 manual testing |
| D11 | Branch protection and dependency automation | After CI exists (`P0-08`): protect `main` (PR + required CI checks); enable Dependabot **grouped, monthly** updates for npm and GitHub Actions, reviewed like any PR | Decided (action deferred until CI exists) | If it creates review noise |
| D12 | UI framework | **React 18 + `lucide-react`** (three runtime deps) instead of vanilla TS. The first implementation was React; its state (held notes, learn progress, recording) is cross-cutting enough that rewriting to vanilla was not justified | Decided 2026-10-10 (departure from §2) | If bundle size or maintenance cost argues for vanilla TS (bundle ≈ 80 kB gzip) |
| D13 | Visual keyboard | **Piano keybed with computer-key legends** and a marked 25-key QWERTY window, at the owner's direction for the redesign ("playable keyboard as the visual centerpiece", synth / digital-piano look). Songs can light keys outside the QWERTY range. The concept's QWERTY-shaped key map is **not built** | **Departure — owner to confirm**; concept §3 unchanged | If the QWERTY key-map view is wanted: add it as a second view |
| D14 | Piano sound | **Sampled** *Salamander Grand Piano* (CC BY 3.0; 21 MP3s, ≈1.4 MB, re-pitched ≤ 1.5 semitones) because the synthesised piano was judged inadequate by the owner. All other instruments remain synthesised. Supersedes D2 for the piano only; completes `P6-05` for one instrument | Decided 2026-10-10 | If download size matters or a CC0 set of equal quality appears |
| D15 | Songs | Authored as **multi-part notation** (melody / chords / bass), compiled to beat-based notes, **provenance required and validated**; arrangements original (MIT). Library of 8 | Decided 2026-10-10 | When song import (`P6-01`) is added |
| D16 | Learn mode | "Wait for me" over the melody part, **octave-forgiving** (the right note name in any octave counts), optional accompaniment. Realises part of `P6-02` | Decided 2026-10-10 | Count-in, bar loop and speed presets remain open (`P6-02`) |

### Still owner-only (not decisions the assistant may take)

- ~~`G-01`~~ — implementation authorized by the owner on 2026-10-10.
- ~~`G-03`~~ — Pages / first release approved by the owner on 2026-10-10 (manual deploys only).
- **D13** — confirm the piano-keybed departure, or request the QWERTY key-map view.
- **`P0-10`** — enable branch protection on `main`.

## 22. References

Verify against the current official docs during implementation.

- Vite: <https://vite.dev/guide/> · static deploy: <https://vite.dev/guide/static-deploy.html>
- Web Audio `AudioContext`: <https://developer.mozilla.org/en-US/docs/Web/API/AudioContext>
- Audio clock: <https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/currentTime>
- `OfflineAudioContext`: <https://developer.mozilla.org/en-US/docs/Web/API/OfflineAudioContext>
- Autoplay policy: <https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay>
- `MediaRecorder`: <https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder>
- `KeyboardEvent.code`: <https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code>
- Vitest: <https://vitest.dev/guide/> · Playwright: <https://playwright.dev/docs/intro>
- GitHub Pages with Actions: <https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages>
- WCAG 2.2: <https://www.w3.org/TR/WCAG22/>
