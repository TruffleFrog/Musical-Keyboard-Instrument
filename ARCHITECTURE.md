# Keyboard Studio — Architecture & Infrastructure Roadmap

**Status:** planned, not implemented · **Updated:** 2026-10-10  
**Decision type:** recommended baseline until the owner authorizes a build. No package versions or hosting services are installed/configured yet.

## 1. Purpose and constraints

Build a polished, browser-based musical instrument controlled by a physical computer keyboard, clickable on-screen keyboard, and synchronized demo-song tabs. The interactive **computer-keyboard map** is the main visual element. Any note-on/note-off event—user input or demo—must keep audio, virtual-key lighting and song-tab highlights synchronized.

Priorities (in order): **input-to-sound responsiveness → correctness and predictable controls → visual clarity → accessible play → maintainability → optional extras**.

- **Local-first and simple:** no mandatory backend, database, login, telemetry, AI, network audio service, subscription, account, or paid API.
- **Desktop-first:** Firefox/Chromium/Edge on Windows are the initial validation targets; touch and mobile layouts remain usable but physical-key performance is the priority.
- **No dependency inflation:** avoid server components, full-stack frameworks, monorepos, UI kits, elaborate state frameworks and DAWs until demonstrably needed.
- **No automatic production release:** CI on pull requests; publishing only through a deliberately triggered release workflow when hosting is configured.
- **Do not deploy or start implementation from this document alone.** All below is a technical plan.

See [product concept](docs/PRODUCT_CONCEPT.md) for user experience and acceptance criteria. See [TODO](TODO.md) for the executable task checklist and [AGENTS](AGENTS.md) for agent process.

## 2. Proposed technology decisions

| Area | Proposed choice | Why / boundary |
| --- | --- | --- |
| Language | **TypeScript, strict mode** | Shared typed event, note, song and settings contracts; no cross-language runtime |
| App/build | **Vite, vanilla TypeScript template** | Small static application, fast development and build; revisit only if UI complexity warrants it |
| UI | **Semantic HTML + modular CSS + SVG where useful** | Lightweight clickable keycaps, fluid layout, no heavyweight image or component framework necessary |
| Design | CSS custom properties (tokens), responsive grid/flex, restrained animations | Keyboard prominently centered; customization in collapsible sections |
| State | Small typed modules/store with subscriptions/events | Explicit state ownership; no Redux/server state/cache |
| Audio | **Native Web Audio API**: AudioContext, Oscillator/AudioBufferSource, Gain, BiquadFilter and optional effects | No external sound service; reusable envelopes/voices; introduce Tone.js only if measurements justify it |
| Sound assets | Built-in synthesis first; tiny licensed/local samples for percussion if needed | Avoid large third-party soundfonts and copyrighted unlicensed sounds |
| Demo timing | Transport/scheduler anchored to **AudioContext.currentTime**; song events specified in beats | Audio-time scheduled notes, tempo transforms and visual timeline derived from one source |
| Persistence | **localStorage** for small, versioned preferences and custom mappings | No personal account or hosted storage; guard malformed/old schema |
| Recording | Typed note events → MIDI export; later audio via MediaStreamDestination + MediaRecorder | Store files locally; detect supported audio MIME/container instead of promising WAV/MP3 |
| Tests | **Vitest** (unit/integration), **Playwright** (Firefox + Chromium E2E), TypeScript checking | Deterministic music rules and input timing regressions |
| Quality | ESLint + Prettier, accessibility checks, manual listening | Modest dev tooling; no SaaS quality dashboards |
| Packages | npm with committed package-lock.json; compatible supported Node LTS | Reproducible installs with npm ci in CI; pin/test actual versions at implementation |
| Source + CI | GitHub, PR reviews, GitHub Actions | Simple source control; typecheck/lint/unit/build/E2E gates |
| Release hosting | **GitHub Pages** first choice (static), configured only when requested | Minimal infra, can be deployed manually via workflow_dispatch |
| Alternate hosting | Cloudflare Pages or Netlify static only if explicitly preferred | Not required; avoid redundant preview/deploy notifications |
| Analytics | None by default | Privacy-first, no third-party trackers |

**Tradeoffs:** A tiny frameworkless app is the starting point, not a dogma. If keyboard UI and dialog state become difficult to maintain, document the evidence and propose a small component library or framework in a PR; do not silently rewrite. Native Web Audio should be tested before adding an audio abstraction dependency.

### Version / compatibility policy

At Phase 0 implementation, select **current stable supported versions** of Node LTS, Vite, Vitest and Playwright that work together. Record exact versions in lockfile and re-check their official requirements rather than copy dates/versions from planning docs. Keep dependencies updated through reviewed PRs, not unreviewed automatic major upgrades.

Official references (verify during implementation):
- Vite: https://vite.dev/guide/ and https://vite.dev/guide/static-deploy.html
- MDN AudioContext clock: https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/currentTime
- MDN autoplay rules: https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay
- MDN MediaRecorder: https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder
- Vitest: https://vitest.dev/guide/
- Playwright: https://playwright.dev/docs/intro

## 3. System boundaries and data flow

The browser is the entire application runtime. No privileged/global keyboard hook: only DOM input while the page has appropriate focus.

**Physical key / pointer → input normalizer → mapping/resolver → note-event controller → voice engine → speakers**  
**Same canonical note events → active-key state → animated computer-keyboard map**  
**Selected song → beat-based transport/scheduler → note-event controller → audio + key map + highlighted tabs**  
**Local settings → mapping/instrument/sound configuration; recorded events → local MIDI or audio download**

Important: avoid two separate timing systems that independently determine which demo key should illuminate. There should be **one transport timeline** and clear current playback position. Audio runs against the audio clock; animation draws from the current position on that same clock (with measured latency compensation only if needed).

### Data contracts (conceptual; refine before coding)

- `PhysicalKey`: normalized `KeyboardEvent.code` / pointer key ID; display legends can use `event.key` where layout-dependent.
- `Note`: MIDI pitch (0–127), velocity, channel/instrument choice; audio frequency derived from MIDI.
- `NoteEvent`: `noteOn` / `noteOff`, `note`, `velocity`, `source` (`physical`/`pointer`/`demo`), `sourceId`, `at` on audio timeline.
- `KeyBinding`: physical/pointer key ID ↔ note or drum trigger; configurable scale/transpose/octave.
- `Song`: stable ID, title, attribution/license, reference BPM, optionally meter, and events in **beats** with explicit start + duration; supports chords, rests and note overlaps.
- `Transport`: stopped/playing/paused, position in beats, effective BPM, loop boundaries, generation/cancellation token.
- `Voice`: independently controlled instance with note, source, start, release and audio-node lifecycle.
- `Settings`: schemaVersion and validated instruments, key mapping, sound, accessibility and player preferences.
- `Recording`: raw time-stamped note events and optional audio blob; do not confuse MIDI with rendered sound.

A demo note's intended pitch must resolve to the **current mapped key legend** for tabs. If no key in the active mapping can play that note (out-of-range, scale-lock, custom mapping), show a visible “unmapped/out of range” indicator or provide a deliberate transpose/fit option. Never silently flash an unrelated key.

## 4. Code boundaries / proposed source tree

This is a target layout, **not a representation of files that exist**:

```text
/
├── AGENTS.md                    # mandatory agent workflow
├── ARCHITECTURE.md              # this document + technical decisions
├── TODO.md                      # tasks and milestone acceptance gates
├── README.md
├── docs/
│   ├── PRODUCT_CONCEPT.md      # product and UI behavior
│   └── ...                     # optional decision notes after significant changes
├── public/
│   └── sounds/                 # only rights-cleared local samples if needed
├── src/
│   ├── main.ts                 # app entry / lifecycle
│   ├── app/                    # cohesive store + orchestration
│   ├── input/                  # physical key & pointer input, remap, focus handling
│   ├── music/                  # notes, scales, layouts, song types and validation
│   ├── audio/                  # context setup, voices, synthesis, effects, sound assets
│   ├── transport/              # demo scheduling, pause/seek/loop, sync
│   ├── recording/              # MIDI encoder, recording and audio export
│   ├── ui/                     # keyboard, customization, song tabs/player, dialogs
│   ├── styles/                 # design tokens, layout and component CSS
│   └── data/                   # rights-cleared built-in song events and metadata
├── tests/                      # unit/integration; e2e/ for Playwright
├── index.html
├── package.json
├── package-lock.json
├── tsconfig.json
├── vite.config.ts
└── .github/workflows/           # later: PR checks and optional manual deploy
```

Avoid creating empty folders and config files merely to match this diagram. Add them as work makes them necessary. Prefer clear ownership (e.g. only `input/` interprets raw DOM key events, only `audio/` creates Web Audio nodes).

## 5. Audio, mapping and synchronization design

### Audio lifecycle

1. Create/resume a single AudioContext on an explicit user gesture (browsers block unprompted audio).
2. Maintain a limited, configurable pool/registry of active voices keyed by **unique source+voice identity**, not just MIDI pitch; simultaneous user/demo notes cannot stop each other.
3. Schedule envelopes with Web Audio time-based methods. Release voices and disconnect nodes after fade-out; avoid leaking oscillators, timers or audio buffers.
4. Reuse audio effects and master volume graph rather than creating new effects for every key.
5. Provide an obvious **All Notes Off**, protect against clipping, and clean up on `blur`, `visibilitychange`, input cancellations and transport stop.
6. Default to a small number of stable synthesis presets. Drum/percussion is a separate design (sample or percussion synthesis), not pitched piano waves renamed “drums.”
7. Validate performance on real hardware, especially Firefox; test with actual input and speakers/headphones.

### Keyboard event handling

- `KeyboardEvent.code` is the reliable identity for physical QWERTY key positions; display the legend the player expects and document international layout behavior. Support custom remapping and a visible keyboard-layout choice.
- On `keydown`, ignore repeat for an already-held physical key; on `keyup`, release **that key's** owned voice only.
- Never intercept typing when focus is in input, textarea, select, dialog remap fields or editable content; use preventDefault only for mapped performance keys during intentional active play.
- Pointer events require matching pointerdown/up/cancel handling and cleanup; avoid lost pointer leaving stuck notes.
- Use source ownership rather than a global boolean: a key can appear demo-lit, user-lit, or both. Release visual state only when that source releases.
- Sustain postpones audio note-off but should not incorrectly leave the physical pressed-key glow active. Communicate sustained/audible status separately.

### Song transport

- Song data uses beats and explicit durations; at playback, calculate absolute audio timestamps using BPM. Schedule upcoming audio events with a **short look-ahead window** instead of relying on `setTimeout` to fire on the exact note.
- UI uses `requestAnimationFrame` for low-cost visual updates based on the audio clock and transport cursor. The visual notes should track scheduled sound, not the other way around.
- Cancellation IDs or generations prevent stale scheduled callbacks from a previous demo. Pause/resume, seek, loop and tempo changes require explicit rescheduling and release of **demo-owned** voices without killing held user notes.
- Background tab throttling/suspended contexts: pause safely or recover transport position predictably. Document whichever behavior is implemented.
- Timing accuracy must be verified with controlled/virtual-clock tests and human ears; do not promise a sub-X-ms latency number without measurements.

## 6. UI/component plan

**Large central virtual computer keyboard (mandatory):** semantic HTML key buttons (SVG decorative outlines if needed), sensible row staggering, keycaps labeled with physical key + mapped note, responsive container, pointer support. States: idle, user-held, demo-held, both, unmapped, focus, disabled; support reduced motion.

**Left settings panel:** group Quick / Instrument / Key mapping / Sound shaping / Advanced. Quick controls remain visible; complex mappings/effects in progressive disclosure. Provide accessible, reversible Reset with confirm when destructive.

**Below keyboard:** song selector and note-tab timeline with moving playhead, current note highlight, play/pause/stop, tempo, loop, clearly separated demo and manual key lighting. On narrow viewports place settings in a collapsible drawer without hiding the main visualization.

**Recorder area (later):** visible record state, elapsed time, supported audio type and distinct MIDI export. Never show a download button for unavailable formats.

Keyboard visualization should be a **real interactive rendering, not a fixed image**: fixed bitmap overlays won't be reliable for remaps, multisource state, accessibility, different window sizes or live labels.

## 7. Persistence, privacy and security

- Store only schema-versioned settings/custom mappings locally with validation, reset, and safe migrations. Default to `localStorage`; upgrade to IndexedDB only for substantial persisted project data if explicitly needed later.
- No user telemetry, third-party trackers or remote uploads. Do not log raw playing/key data to servers.
- Key capture is scoped to the application page; never attempt global keyboard capture or keylogging.
- Built-in songs and sound assets must have recorded provenance and redistribution permissions; do not copy copyrighted recordings or sample packs without proper licenses.
- Blob/audio exports remain local, with object URLs revoked after use. Guard untrusted imported MIDI data against oversized/invalid tracks if an import feature is added.
- Serve static HTTPS when released. Keep dependencies minimal, lock dependencies, run CI and review security updates.

## 8. Verification and release infrastructure

### Development commands (to be implemented, not currently runnable)

- `npm install` initially, then `npm ci` for repeatable CI.
- `npm run dev`: local Vite server for interactive work.
- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`.
- `npm run test:e2e`: Playwright Chromium + Firefox keyboard, pointer, demo and control tests.
- `npm run preview`: locally inspect release bundle after build.

### Test coverage

| Level | Required checks |
| --- | --- |
| Unit | Mapping collisions, scale/transpose, note labels, MIDI math, settings migrations, song parsing/durations, transport timeline |
| Integration | One note event drives audio + visual state, manual/demo source ownership, sustain/release and focus cleanup |
| Browser E2E | Keyboard press/lift + glow, multi-key chords, pointer press, changing mappings, song selection, demo seek/stop/tempo, reduced-motion behavior |
| Export | MIDI event ordering and note lengths, container header/validity, audio MIME feature detection |
| Manual audio | First-interaction unlock, real listening in Firefox and Chromium, clipping, latency feel, stuck notes, background tab behavior |
| Accessibility | Focus order, meaningful buttons/key labels, contrast, visible state independent of color, disabled/unavailable feedback |

Use faked/stubbed AudioContext where deterministic integration tests require it; do not pretend headless CI can accurately certify **audible** sound quality or end-user latency.

### GitHub Actions approach (future)

**PR CI** triggers on pull requests to main: install with `npm ci` → typecheck → lint → tests → build; run Playwright E2E in a separate or cached job when available. Make required status checks enforceable once workflows exist. Do not configure hosted preview environments or deploy on every push.

**Release deploy** is optional and **manual** via `workflow_dispatch` after the owner approves releasing. GitHub Pages is the low-maintenance first choice; workflow builds `dist/` and deploys it using least-privilege permissions. For GitHub Pages under the repository subpath, set Vite `base` to `/Musical-Keyboard-Instrument/` (or `/` for a custom-domain root). Confirm Pages settings and verify output before announcing a live URL. No domain/DNS setup is assumed.

At launch, add a small releases/changelog convention; no auto-version bump bot is necessary.

## 9. Milestones, infrastructure gates and roadmap

All milestones are tracked individually in [TODO.md](TODO.md). **Do not treat this roadmap as authorization to implement.** Complete features in vertical slices, not a giant scaffold or architecture rewrite.

| Milestone | Outcome | Depends on | Exit gate |
| --- | --- | --- | --- |
| M0 — Repository foundation | Small Vite TS app shell, scripts, lint/types/tests, clear docs, PR CI | Owner authorizes build | New clone installs and checks pass; no production deploy |
| M1 — Playable keyboard | Keyboard map + low-latency synth + multi-key input, release and focus safety | M0 | Physical & pointer play light correct keys, audible in Firefox/Chromium |
| M2 — Customization | Instruments, octave/scale, remaps, volume, sustain, saved local settings | M1 | Changes immediately affect sound, labels and mapped keys |
| M3 — Demo-song trainer | Song dataset, beat transport, synchronized demo sound + key lighting + moving tabs, tempo/pause/loop | M1–M2 | No drift/stale notes; custom mappings and simultaneous manual play correctly represented |
| M4 — Recording & sound design | MIDI performance export, supported audio export, optional reverb/echo/metronome, UX polish | M3 | Valid downloadable performance; formats accurately labeled; no glitches |
| M5 — Accessibility/quality/release | Browser matrix, mobile/touch, keyboard navigation, licensing audit, optional manual GitHub Pages deploy | M0–M4 | All checks pass; owner approves release and verifies live app |
| M6 — Optional follow-on | Import songs/MIDI, guided practice, custom presets, richer sounds | M5 + explicit prioritization | Each addition justified by user value and measured complexity |

### Milestone execution convention

At the start of each milestone, identify an implementable vertical slice and its test plan. For every merged PR, mark only demonstrated tasks complete in TODO, and update this document's **Current implementation status** section, design decisions/stack or diagrams *if changed*. Keep product requirements in PRODUCT_CONCEPT. Avoid prematurely declaring “M2 complete” because a UI control exists without correct audio behavior.

## 10. Decisions requiring future confirmation

- **License** for source: not chosen (keep status visible; never assume MIT/Apache).
- Audio fidelity and exact instrument roster; percussion sound-source and sample licensing.
- Native Web Audio vs Tone.js after timing complexity/profiling.
- Default mapping and how international physical layouts are presented.
- Mobile touch scope and whether the virtual keyboard should be playable on very small screens.
- Hosting activation and public demo URL (manual deployment only unless the owner changes this).
- Audio export format(s) supported by the browser matrix.

Document any significant reversal with date, reason, alternatives and observed evidence; preserve the rationale rather than quietly editing history.

## 11. Current implementation status

**As of 2026-10-10:** The repository contains product/planning documents only. No app source, installed toolchain, tests, CI workflow, audio engine, visual keyboard, hosting or live demo exists.

When implementation is authorized, update this section after significant milestones: current architecture reality, completed milestones, known tradeoffs, and links to PRs. Agents must keep it accurate, but should not overwrite long-term design decisions simply to match an incomplete feature.

## 12. Official references

- https://vite.dev/guide/
- https://vite.dev/guide/static-deploy.html
- https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/currentTime
- https://developer.mozilla.org/en-US/docs/Web/API/AudioContext
- https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder
- https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay
- https://vitest.dev/guide/
- https://playwright.dev/docs/intro
