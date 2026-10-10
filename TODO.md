# Keyboard Studio — TODO / Progress Tracker

This is the **primary progress tracker**. Read it before starting any work, and update it in the same PR as the work (see [AGENTS.md](AGENTS.md)).

- Design and rationale: [ARCHITECTURE.md](ARCHITECTURE.md) · Product behavior: [docs/PRODUCT_CONCEPT.md](docs/PRODUCT_CONCEPT.md) · Overview: [README.md](README.md)
- **Last updated:** 2026-10-10 · **Current state:** planning documentation only — no application code exists.

## How to use this file

- Task IDs (`P1-04`) are stable. Reference them in branch names, commits and PR titles; never renumber — append new tasks instead.
- `[ ]` open · `[x]` done **and verified** (acceptance met, evidence in the PR). Partially finished work stays `[ ]` with a short note beneath it.
- `Needs:` lists task or gate prerequisites. `Done when:` is the acceptance criterion for the task.
- Phases are built as **vertical slices**. Do not start a phase before its dependencies are met unless the task explicitly says it is independent.
- A UI control existing is **not** evidence that its behavior works. Planning documents are **not** implemented functionality.

---

## Gates and decisions (owner)

| ID | Item | Status |
| --- | --- | --- |
| [ ] `G-01` | **Owner explicitly authorizes implementation.** Record the date and where the instruction was given, here, when it happens. Until then every phase below is blocked. | Not authorized |
| [ ] `G-02` | Choose a source-code license (decision D1 in [ARCHITECTURE.md §21](ARCHITECTURE.md#21-open-decisions)). | Open |
| [ ] `G-03` | Approve first public release / enabling GitHub Pages (Phase 5). | Open |

---

## Planning documentation (not implementation)

These are documentation deliverables only. Completing them does **not** advance any implementation phase.

- [x] `DOC-01` Product & UI concept — [docs/PRODUCT_CONCEPT.md](docs/PRODUCT_CONCEPT.md)
- [x] `DOC-02` Architecture & infrastructure roadmap — [ARCHITECTURE.md](ARCHITECTURE.md)
- [x] `DOC-03` Agent instructions — [AGENTS.md](AGENTS.md)
- [x] `DOC-04` Progress tracker — this file
- [x] `DOC-05` README entry point — [README.md](README.md)

---

## Phase 0 — Repository foundation and development environment

**Goal:** a tiny, verified development scaffold with CI — and *no* deployment.  
**Needs:** `G-01`.  
**Exit gate:** a fresh clone runs `npm ci` and every check script passes; CI is green on a pull request; no deploy workflow or hosting exists.

- [ ] `P0-01` Add repo hygiene files: `.gitignore`, `.editorconfig`, optional `.gitattributes` (LF line endings), `.nvmrc` (current Node LTS).  
  *Done when:* files exist; `node_modules/` and `dist/` are ignored.
- [ ] `P0-02` Add `LICENSE` per `G-02`.  
  *Needs:* `G-02`. *Done when:* license file matches the owner's choice and README states it.
- [ ] `P0-03` Scaffold a minimal Vite + vanilla TypeScript app (`index.html`, `src/main.ts`) showing a placeholder "Keyboard Studio" shell.  
  *Done when:* `npm run dev` serves the page and `npm run build` produces `dist/`.
- [ ] `P0-04` Enable TypeScript `strict`; add `npm run typecheck`.  
  *Done when:* script passes on a clean tree and fails on a deliberate type error.
- [ ] `P0-05` Add ESLint (with typescript-eslint) and Prettier; add `npm run lint`.  
  *Done when:* script passes on a clean tree.
- [ ] `P0-06` Add Vitest with one meaningful unit test; add `npm run test`.  
  *Done when:* test runs headlessly and passes.
- [ ] `P0-07` Add Playwright (Chromium + Firefox) with one smoke test that the page loads; add `npm run test:e2e`.  
  *Done when:* smoke test passes locally in both browsers.
- [ ] `P0-08` Add GitHub Actions **PR CI**: `npm ci` → typecheck → lint → test → build; separate E2E job; `permissions: contents: read`; no deploy steps.  
  *Needs:* `P0-03`–`P0-07`. *Done when:* the workflow is green on a PR and visibly **does not** publish anything.
- [ ] `P0-09` Add a pull-request template with the documentation/TODO/verification checklist from [AGENTS.md](AGENTS.md).  
  *Done when:* new PRs show the template.
- [ ] `P0-10` Owner/admin: enable branch protection (or a ruleset) on `main` requiring the CI checks (decision D11).  
  *Needs:* `P0-08`. *Done when:* a PR cannot merge with failing checks.
- [ ] `P0-11` Update README "Development" section with the *actual* working commands; update [ARCHITECTURE.md §20](ARCHITECTURE.md#20-current-implementation--infrastructure-status) with the real toolchain and versions.  
  *Needs:* `P0-03`–`P0-08`. *Done when:* every command in the README was run and works.

---

## Phase 1 — Interactive visual keyboard and basic audio engine

**Goal:** the playable vertical slice — physical key or click → sound → matching key lights.  
**Needs:** Phase 0 exit gate.  
**Exit gate:** in Chromium and Firefox, physical and pointer play sound and light exactly the right keys; chords work; releasing, blurring the window and Stop All never leave stuck notes or stuck lights.

### Core types and pure logic (`music/`)

- [ ] `P1-01` Define core types (`KeyId`, `NoteEvent`, `KeyAction`, `Layout`) per [ARCHITECTURE.md §3](ARCHITECTURE.md#3-application-architecture-and-data-flow).  
  *Done when:* types compile and are imported by at least one consumer.
- [ ] `P1-02` Pitch utilities: MIDI→frequency, note names (e.g. `C4`), accidentals.  
  *Done when:* unit tests cover known values (A4 = 440 Hz, C4 = MIDI 60) and range edges.
- [ ] `P1-03` Default "Piano" layout data and layout validation (no duplicate keys; control keys declared).  
  *Done when:* tests assert the default mapping and reject invalid layouts.
- [ ] `P1-04` Key resolver: binding → pitch with octave shift (transposition/scale added in Phase 2).  
  *Done when:* unit tests cover clamping at 0–127 and unmapped keys.

### Visual keyboard (`ui/`)

- [ ] `P1-05` Keyboard geometry data (rows, staggered offsets, key widths) for the on-screen computer keyboard.  
  *Done when:* data validates (no overlaps) in a unit test.
- [ ] `P1-06` Render the large, central keyboard from geometry data with physical-key and note labels.  
  *Needs:* `P1-03`, `P1-05`. *Done when:* every mapped key shows both labels; unmapped keys are visually subdued.
- [ ] `P1-07` Key visual-state store with per-source ownership (`user`, `demo`, `sustained`) per [ARCHITECTURE.md §7](ARCHITECTURE.md#7-real-time-visual-keyboard-state).  
  *Done when:* unit tests prove one source releasing does not clear another.
- [ ] `P1-08` CSS states: idle, user-held, demo-held, both, unmapped, focus — distinguishable without color; `prefers-reduced-motion` respected.  
  *Needs:* `P1-06`, `P1-07`. *Done when:* each state is demonstrable and not color-only.

### Input (`input/`)

- [ ] `P1-09` Physical keyboard input normalizer (keydown/keyup by `code`, ignore repeat, ignore Ctrl/Meta/Alt chords, ignore text fields/IME).  
  *Done when:* unit tests cover repeat, modifiers and text-field focus.
- [ ] `P1-10` Pointer/touch input on virtual keys with capture and cancel handling; multi-touch chords.  
  *Needs:* `P1-06`. *Done when:* pointerup/cancel/capture-loss all release the note.
- [ ] `P1-11` Focus-loss cleanup: release everything on `blur`, `visibilitychange`, Meta keydown.  
  *Done when:* a test simulates blur while holding keys and asserts all released.

### Audio (`audio/`)

- [ ] `P1-12` AudioContext lifecycle with user-gesture unlock and visible "enable sound" guidance.  
  *Done when:* context starts `running` after first gesture; UI reflects `suspended`/`running`.
- [ ] `P1-13` Master chain: master gain → compressor/limiter → destination.  
  *Done when:* many simultaneous voices do not clip audibly (manual check).
- [ ] `P1-14` Basic voice: oscillator + gain envelope (attack/release), note-on/note-off, unique `voiceId`, click-free release, node disposal.  
  *Done when:* repeated play does not grow active node count (verified by a test hook or inspection).
- [ ] `P1-15` Voice registry with cap and voice stealing.  
  *Done when:* unit test fills the cap and asserts stealing order.
- [ ] `P1-16` **Stop All / All Notes Off** control and `Esc` binding.  
  *Done when:* all sound and lights stop immediately, including pointer-held keys.

### Integration and verification

- [ ] `P1-17` Wire input → resolver → `NoteEvent` → audio + key state; active-note readout.  
  *Needs:* `P1-04`, `P1-07`, `P1-09`, `P1-14`. *Done when:* pressing a mapped key sounds and lights that key; releasing stops both.
- [ ] `P1-18` E2E tests: press lights correct key, release unlights, two-key chord, pointer press, blur release, typing in an input does not play.  
  *Done when:* tests pass in Chromium and Firefox.
- [ ] `P1-19` Manual audio checklist run (real keyboard + speakers/headphones, Chromium and Firefox) and recorded in the PR.  
  *Done when:* checklist from [AGENTS.md §6](AGENTS.md) completed with notes on latency feel and stuck notes.
- [ ] `P1-20` Update README status, [ARCHITECTURE.md §20](ARCHITECTURE.md#20-current-implementation--infrastructure-status) and this file.

---

## Phase 2 — Instrument customization and settings

**Goal:** make the instrument personal, and remember it.  
**Needs:** Phase 1 exit gate.  
**Exit gate:** every setting immediately changes sound, labels and lit keys as appropriate; settings persist across reloads and reset cleanly.

- [ ] `P2-01` Settings model, defaults and validation (field-by-field fallback) per [ARCHITECTURE.md §9](ARCHITECTURE.md#9-customization-settings-and-local-persistence).  
  *Done when:* malformed input never throws and yields valid defaults (unit tests).
- [ ] `P2-02` `localStorage` persistence with try/catch fallback, `schemaVersion`, migration scaffold.  
  *Done when:* tests cover missing, corrupt, old-version and blocked storage.
- [ ] `P2-03` Reset to defaults with confirmation.  
  *Done when:* reset restores defaults and persists them.
- [ ] `P2-04` Instrument interface (`createVoice` on `BaseAudioContext`) and instrument selector.  
  *Needs:* `P1-14`. *Done when:* instrument changes apply to the next note without stuck voices.
- [ ] `P2-05` Instruments: piano-like, synth.  
  *Needs:* `P2-04`. *Done when:* the presets are audibly distinct (manual) and pass lifecycle tests.
- [ ] `P2-06` Instruments: bass, chiptune.  
  *Needs:* `P2-04`. *Done when:* as above.
- [ ] `P2-07` Drum/percussion instrument with per-key drum mapping (synthesized kick/snare/hat etc.).  
  *Needs:* `P2-04`. *Done when:* a drum layout triggers distinct percussive sounds with correct labels.
- [ ] `P2-08` Octave shift and transpose controls; labels update live.  
  *Done when:* resolver tests and an E2E check confirm labels and pitch agree.
- [ ] `P2-09` Scale selection and scale-lock behavior per decision D5; visible in labels.  
  *Done when:* tests cover representative scales and out-of-scale behavior.
- [ ] `P2-10` Sustain (Space) with separate "sustained" visual state; correct release on sustain off.  
  *Needs:* `P1-07`. *Done when:* tests prove physical glow ends on key release while audio sustains.
- [ ] `P2-11` Velocity simulation per decision D6.  
  *Done when:* velocity audibly and measurably changes gain in a test.
- [ ] `P2-12` Master volume, ADSR and tone/filter controls.  
  *Done when:* parameter changes affect new notes without clicks.
- [ ] `P2-13` Key remapping UI: capture mode, conflict/duplicate handling, per-key reset, text-field guard.  
  *Done when:* a remap updates labels, sound and (later) demo tabs; conflicts are explained.
- [ ] `P2-14` Alternate layout(s) (decision D4).  
  *Done when:* switching layouts updates keys, labels and control bindings.
- [ ] `P2-15` Customization panel with progressive disclosure (Quick vs. Advanced) and responsive drawer.  
  *Done when:* the keyboard stays the visual focus at all supported widths.
- [ ] `P2-16` Named presets (save/load/delete, bounded count).  
  *Done when:* presets round-trip all settings.
- [ ] `P2-17` Tests (unit + E2E) for persistence, remap and instrument switching; update docs and this file.

---

## Phase 3 — Demo songs, animated tabs and synchronized playback

**Goal:** songs that actually play, light the real keys, and scroll tabs — all from one clock.  
**Needs:** Phases 1–2.  
**Exit gate:** no drift or stale notes over repeated play/pause/loop/tempo changes; user and demo notes coexist; custom mappings are reflected correctly.

- [ ] `P3-01` Song schema, validator and provenance requirement per [ARCHITECTURE.md §8](ARCHITECTURE.md#8-demo-songs-and-synchronized-playback).  
  *Done when:* validator tests reject malformed songs and missing provenance.
- [ ] `P3-02` Author built-in songs as original data entry: *Ode to Joy*, *Twinkle Twinkle Little Star*, *Mary Had a Little Lamb* (and optionally one original tune), with provenance.  
  *Done when:* each validates, and a licensing note per song is recorded.
- [ ] `P3-03` `AudioClock` interface and virtual clock for tests.  
  *Done when:* transport tests run without real audio.
- [ ] `P3-04` Beat ↔ time mapping with re-anchoring for tempo/pause/seek.  
  *Done when:* unit tests prove no accumulated drift across tempo changes.
- [ ] `P3-05` Look-ahead scheduler emitting `NoteEvent`s with `source: "demo"` and unique voice IDs.  
  *Needs:* `P3-03`, `P3-04`. *Done when:* a virtual-clock test asserts exact scheduled times for a known song.
- [ ] `P3-06` Transport controls: play, pause/resume, stop, restart, generation-token cancellation.  
  *Done when:* tests show stale callbacks never fire after stop/switch.
- [ ] `P3-07` Tempo control (affects sound and visuals) and loop with boundary clipping.  
  *Done when:* tests cover tempo change mid-song and loop wrap.
- [ ] `P3-08` Pitch→key resolver for tabs using the active layout; explicit out-of-range/unmapped indicator; duplicate-key rule.  
  *Needs:* `P2-13`. *Done when:* a song under a remapped layout shows the correct keys; unmappable notes never light a wrong key.
- [ ] `P3-09` Visual event queue so demo lighting occurs at audible time (rAF over audio clock).  
  *Needs:* `P1-07`, `P3-05`. *Done when:* lights match scheduled audio time within one frame in a stubbed-clock test.
- [ ] `P3-10` Song picker UI (title, difficulty, tempo, duration).
- [ ] `P3-11` Animated tab timeline: key + note names, moving playhead, current-note highlight, progress bar tied to transport position.  
  *Needs:* `P3-08`. *Done when:* highlighted tab always equals the lit key set.
- [ ] `P3-12` Player controls UI (play/pause/stop/restart/tempo/loop) with keyboard accessibility.
- [ ] `P3-13` Play-along: user and demo sources distinct, simultaneous, independently released.  
  *Done when:* an E2E test holds a user key while a demo starts and stops; the user key stays lit and sounding.
- [ ] `P3-14` Cleanup on song switch, instrument change, layout change and hidden tab (decision D10).  
  *Done when:* no demo voices or lights remain after each action.
- [ ] `P3-15` E2E sync tests (select, play, observe lit keys/tabs, pause, tempo, loop, stop).
- [ ] `P3-16` Manual synchronization listening/viewing check in Chromium and Firefox.
- [ ] `P3-17` Update README, [ARCHITECTURE.md §20](ARCHITECTURE.md#20-current-implementation--infrastructure-status) and this file.

---

## Phase 4 — Recording, MIDI/audio export and advanced effects

**Goal:** capture and share performances; richer sound.  
**Needs:** Phase 3.  
**Exit gate:** a recorded performance exports as a valid MIDI file and, where supported, audio; labels are accurate; no audio glitches or leaked resources.

- [ ] `P4-01` Reverb send with generated impulse response (no asset files); wet/dry control.  
  *Done when:* effect is audible, adjustable and shared across voices (not per-note).
- [ ] `P4-02` Echo/delay send (time, feedback, mix) with feedback safety limit.  
  *Done when:* no runaway feedback at maximum settings (manual + test).
- [ ] `P4-03` Metronome (optional, off by default): audible click and visual beat on the same clock.  
  *Needs:* `P3-03`. *Done when:* clicks hold steady against the clock; toggling leaves no stuck timers.
- [ ] `P4-04` Recording model: time-stamped `NoteEvent` capture, user-only by default.  
  *Done when:* unit tests verify event capture and exclusion of demo events.
- [ ] `P4-05` Recorder UI: record/stop, elapsed time, clear state.
- [ ] `P4-06` Standard MIDI File encoder (format, PPQ, tempo, program change, drum channel).  
  *Done when:* tests verify header, VLQ and event ordering/lengths.
- [ ] `P4-07` MIDI download.  
  *Needs:* `P4-04`, `P4-06`. *Done when:* an exported file opens correctly in an external MIDI tool (manual check recorded).
- [ ] `P4-08` Audio export capability detection (`MediaRecorder.isTypeSupported`) and real-time capture via `MediaStreamAudioDestinationNode`.  
  *Done when:* the offered format matches what the browser actually produces; unsupported formats never appear.
- [ ] `P4-09` (Optional) Offline WAV render via `OfflineAudioContext` + WAV encoder.  
  *Needs:* `P2-04`. *Done when:* output is a valid, playable WAV.
- [ ] `P4-10` "Record demo / record both" option.
- [ ] `P4-11` Object URL revocation and resource-cleanup checks.
- [ ] `P4-12` Tests, docs and TODO/architecture status updates.

---

## Phase 5 — Testing, accessibility, optimization and release

**Goal:** make it solid, accessible and (when approved) public.  
**Needs:** Phases 0–4.  
**Exit gate:** all checks pass; accessibility and browser-matrix passes recorded; licensing audit complete; the owner approves release (`G-03`) and verifies the live app.

- [ ] `P5-01` Keyboard-only navigation pass over every control; no focus traps; Space-sustain vs. button activation resolved.
- [ ] `P5-02` Automated accessibility checks (e.g. axe) in E2E; fix findings.
- [ ] `P5-03` Screen-reader pass; accessible names for keys and states.
- [ ] `P5-04` Contrast, `forced-colors`, `prefers-reduced-motion`, flashing review.
- [ ] `P5-05` Cross-browser matrix: Chromium/Chrome, Edge, Firefox (primary); Safari best effort. Record results.
- [ ] `P5-06` Touch/mobile layout and interaction pass (decision D7).
- [ ] `P5-07` Performance and soak: CPU under chords, voice-cap tuning, memory/node leak check over long sessions.
- [ ] `P5-08` Graceful degradation: Web Audio unavailable, storage blocked, unsupported export formats.
- [ ] `P5-09` Licensing audit: every song and asset has recorded provenance; license file present (`G-02`).
- [ ] `P5-10` Optional hardening: Content-Security-Policy compatible with chosen hosting.
- [ ] `P5-11` README: screenshots or short demo capture, accurate usage and limitations (e.g. keyboard rollover).
- [ ] `P5-12` Release checklist and lightweight changelog/tag convention.
- [ ] `P5-13` Create a **manual-only** (`workflow_dispatch`) GitHub Pages deploy workflow; set Vite `base`; least-privilege permissions.  
  *Needs:* `G-03`. *Done when:* no deployment happens on push or merge; a manual run publishes `dist/` only.
- [ ] `P5-14` Owner-approved first deploy; verify the live URL loads, plays sound and runs the key flows.  
  *Needs:* `P5-13`. *Done when:* verified on the actual deployed URL, not just a green workflow.
- [ ] `P5-15` Update [ARCHITECTURE.md §20](ARCHITECTURE.md#20-current-implementation--infrastructure-status) to reflect real infrastructure.

---

## Phase 6 — Optional future enhancements

Not scheduled. Each item needs explicit prioritization, a justification, and an architecture update before work begins.

- [ ] `P6-01` Import MIDI / user-created songs (with size and value bounds).
- [ ] `P6-02` Practice mode: step-through, count-in, loop a selected bar, speed presets, difficulty levels.
- [ ] `P6-03` Alternate keyboard layouts (AZERTY, QWERTZ, others) and a piano-note secondary view.
- [ ] `P6-04` Preset import/export as JSON files.
- [ ] `P6-05` Sampled/higher-fidelity instruments (properly licensed).
- [ ] `P6-06` Light theme and further theming.
- [ ] `P6-07` Web MIDI input from a real MIDI keyboard.
- [ ] `P6-08` PWA / offline support.
- [ ] `P6-09` Time signatures and richer metronome patterns.
- [ ] `P6-10` Recording take list, layering, and trimming.

---

## Changelog of this tracker

- 2026-10-10 — Initial TODO created from the architecture roadmap; planning documents marked done, **all implementation tasks open**.
