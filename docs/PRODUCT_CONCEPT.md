# Keyboard Studio — Product & UI Concept

> **Status: planning only.** This document is a refined product idea, not an implementation plan approved for coding. No application has been built.

## 1. Core idea

Turn an ordinary computer keyboard into an enjoyable, customizable musical instrument. People should be able to start making sounds almost immediately, watch their keypresses light up on a realistic **on-screen computer-keyboard map**, learn from animated demo-song key tabs, and record their own playing.

This is a fun, lightweight, portfolio-friendly project. No account, paid service, AI, or backend is required for the initial experience.

**The product's distinctive interaction is the tight connection among three things:**
1. Physical keyboard input.
2. A large, visually faithful virtual computer keyboard with real-time key illumination.
3. Demo-song tabs that can play the notes and illuminate their exact corresponding keyboard keys.

The app should feel like a miniature music studio rather than a generic piano page.

## 2. Main-screen layout

Desktop-first; responsive for tablets and smaller screens.

```text
┌───────────────────────────────────────────────────────────────────────────┐
│ Keyboard Studio                         Preset · Help · Settings          │
├────────────────────┬──────────────────────────────────────────────────────┤
│ CUSTOMIZE          │ INSTRUMENT / NOW PLAYING                              │
│                    │                                                      │
│ Instrument         │       INTERACTIVE COMPUTER KEYBOARD MAP              │
│  Piano / Synth     │   ┌───────────────────────────────────────────────┐  │
│  Bass / Drums /…   │   │  [Q][W][E][R][T][Y][U][I][O][P]...           │  │
│                    │   │   [A][S][D][F][G][H][J][K][L]...              │  │
│ Notes & mapping    │   │    [Z][X][C][V][B][N][M]...                    │  │
│  Layout / Remap    │   │   Pressed keys GLOW (including held chords)    │  │
│  Octave / Scale    │   └───────────────────────────────────────────────┘  │
│                    │   Active notes · note names · volume indicator      │
│ Sound             ├──────────────────────────────────────────────────────┤
│  Volume / Envelope│ DEMO SONGS                                           │
│  Sustain / Effects│ [Ode to Joy] [Twinkle] [Mary Had a Little Lamb] ...   │
│  Metronome / BPM  │ ▶ Pause  ■ Stop    Tempo ━━━━━●━━   ⟳ Loop           │
│                    │ Key tabs: [A C4] [S D4] [D E4] ... current = GLOW    │
│ Reset / Presets   ├──────────────────────────────────────────────────────┤
│                    │ ● Record     Stop     Save audio     Export MIDI      │
└────────────────────┴──────────────────────────────────────────────────────┘
```

**Visual priorities**
- The computer-keyboard visualization is the centerpiece and receives the most screen space.
- Customization remains accessible but is grouped into collapsible sections or tabs so it does not clutter the keyboard.
- Demo songs sit immediately under the visual keyboard, reinforcing the connection between the tabs and the highlighted keys.
- Clear play/pause/stop/tempo controls. No unnecessary dashboards, accounts, or charts.
- Dark, music-studio-inspired aesthetic with a restrained accent glow. Light theme can be added as an option later.
- Keys should look like recognizably shaped **computer** keys, not be confused with a virtual piano. A piano-note view can be offered as a secondary toggle in a future iteration.

## 3. Interactive keyboard visualization (core feature)

An on-screen **rendered keyboard** is preferable to a static background image because individual keys must animate, display mapping labels, and be clickable.

### Behavior
- Show a recognizable QWERTY keyboard (at minimum the playable rows; ideally the surrounding nonplayable keys for context).
- When a user physically presses an assigned keyboard key, its matching key immediately lights up and shows a subtle press/depression effect.
- Held keys stay illuminated until release. Several pressed keys must be highlighted simultaneously for chords (polyphony).
- Clicking/tapping an on-screen playable key also produces a note and the identical lighting feedback.
- Each mapped key displays its physical key label and optionally its musical note (e.g., **A · C4**).
- Unmapped keys are visually subdued. The scale/transpose/remapping settings instantly update the note labels.
- Demo playback lights the **same keyboard map** in time with each note and can highlight several keys simultaneously when a demo has chords.
- Use distinguishable visual states for **user input** and **demo playback** (e.g., two accent shades or outlines), including when both occur at once.
- Key illumination must reflect audible note-on/note-off timing, not merely advance a visual slideshow.
- Add an active-note indicator and a visible current-note readout.
- Handle keyup, lost window focus, released mouse/touch, keyboard auto-repeat, and stopping demos so notes never stay stuck.
- Keyboard shortcuts must pause while the user is editing a text field or remapping controls.
- Do not depend solely on color; use pressed depth, border, icon/label, or another state indicator for accessibility.
- Use a responsive scroll/fit treatment on narrow screens rather than rendering illegibly tiny keys.

## 4. Customization panel

The interface should **expose and organize all major options**, while clearly indicating which are launch features versus later enhancements. Most changes should take effect immediately.

| Group | Controls | Notes |
| --- | --- | --- |
| Instrument | Piano, synth, bass, drums/percussion, chiptune, and additional sound presets | Presets should sound meaningfully different; percussion needs per-key sample/sound mapping rather than pitched waveforms |
| Keyboard mapping | Default layout, alternate layouts, custom key-to-note remapping, reset | Prevent conflicting mappings or clearly explain them |
| Notes | Octave up/down, transpose, note labels, scale selection/lock | Scale lock behavior should be predictable and visible |
| Performance | Polyphony/chords, sustain, velocity/emphasis simulation | Support holding several keys simultaneously |
| Sound shaping | Master volume, attack, decay, sustain level, release, tone/filter, reverb, delay/echo | Keep advanced controls behind an expandable section |
| Timing | Metronome on/off, BPM, time signature (later) | Avoid intrusive metronome by default |
| Appearance | Key label mode, demo highlighting, optional light/dark theme | Visual accessibility first |
| Save/reset | Persist local preferences, factory reset, later import/export presets | No login required |

### Suggested progressive disclosure

**Quick controls:** instrument, octave, scale, master volume, sustain, and demo tempo.

**Advanced controls:** individual key remapping, ADSR, effects, velocity, custom layouts, extra visual preferences.

Avoid showing every slider at once. Preserve the most important controls even when the panel is collapsed.

## 5. Demo-song library & animated key tabs (core feature)

A simple **Demo Songs** tab presents beginner-friendly, rights-cleared tunes, initially including *Ode to Joy*, *Twinkle Twinkle Little Star*, and *Mary Had a Little Lamb*. An original melody is a good showcase too. Confirm arrangement and recording rights; prefer original performances/arrangements or clearly public-domain material.

### Song selection and playback
- Pick a demo from song cards or tabs; show title, difficulty, tempo, and approximate duration.
- **Play** triggers actual instrument notes and, at the same moments, lights the relevant keyboard keys on the main keyboard visualization.
- A horizontal note/key-tab timeline moves as the demo plays; the current note is prominently highlighted.
- Tabs show physical-key names plus musical note names so a beginner can copy the song with their own keyboard.
- Support play, pause, resume, restart, and stop.
- Let the user slow down or speed up demo BPM. A loop toggle helps practice.
- The progress bar and highlighted tab reflect the actual playback position.
- Any custom keyboard mapping, octave, or other transposition should be reflected correctly by demo tabs and illumination. When a melody falls outside the playable range, handle it explicitly rather than displaying nonexistent keys.
- Manual playing should be possible while a demo is running. User-played keys and demo-played keys must stay distinguishable.
- Demo playback should not inadvertently enter a user-only recording unless the UI expressly offers “record demo” or “record both.”
- Starting a new song or changing instrument/layout must clean up old active demo notes/timers.
- Later: step-through practice mode, count-in, loop a selected bar, speed presets, difficulty levels, and user-imported MIDI/song tabs.

### Three linked states

**Song note -> tab highlight -> keyboard illumination -> audible note** must remain aligned. Correct timing and precise mapping matter more than an elaborate animation.

## 6. Recording and export

- One button to start/stop recording a live performance, with a clear elapsed-time indicator.
- Export notes as **MIDI** so they can be edited elsewhere.
- Optionally export the produced sound as audio (browser-compatible format, with the actual extension indicated).
- Recording should respect the selected instrument, mapped notes, timing, and note lengths.
- Make limitations clear: MIDI stores performance events and generally does not reproduce this app's exact synthesized sound or effect settings.
- Record locally by default; no account or cloud upload.
- Later: playback/re-record, track layers, take list, WAV rendering, and basic trimming.

## 7. Feature scope / build order

This separates what makes the concept special from nice-to-have extras and avoids a huge first build.

### Phase 1 — Playable visual instrument
- Responsive single-page layout; readable keyboard map.
- Real-time physical-key, pointer, and multi-key lighting.
- Accurate playable notes, release and focus cleanup.
- Several distinct instrument presets (piano, synth, bass, chiptune first).
- Layout, octave, scale, volume, sustain; simple settings persistence.
- Clear audio-unlock guidance (browsers require a user gesture).
- Keyboard remapping UI and reset if feasible within a focused MVP.

### Phase 2 — Learn with live demo tabs
- Rights-cleared built-in melodies with data-driven notes and durations.
- Song selection, synchronized audible playback, keyboard illumination, tab highlighting.
- Tempo adjustment, pause/resume, restart, stop, loop.
- Distinct highlighting for user keys and demo keys, including simultaneous input.
- Tests verifying that mapped keys, note timing and displayed tabs agree.

### Phase 3 — More complete studio
- Effects and sound-shaping panel, optional metronome.
- Performance recording, MIDI export, browser-compatible audio capture.
- Advanced mappings and saved presets.
- Accessibility/performance refinement and phone/tablet interactions.

**Important:** This sequence is a *proposal*, not authorization to start implementation. Do not write application code until requested.

## 8. User journeys

**Play instantly:** Open page -> pick piano -> press A/S/D -> matching screen keys illuminate and notes sound -> switch instruments.

**Learn a melody:** Choose *Ode to Joy* -> slow BPM -> press Play -> tab progresses while corresponding keyboard keys glow in time -> mimic physical keys -> repeat.

**Personalize:** Select synth -> raise octave -> change scale and effects -> remap a key -> both manual play and song visualizations immediately reflect the updated mapping.

**Record:** Adjust sound -> start recording -> play a chord or melody -> stop -> download MIDI or supported audio format.

## 9. Quality, safety and accessibility

- Prefer low perceptible input-to-sound latency on ordinary desktop browsers; do not claim a numeric latency target without measuring real devices.
- Prevent stuck notes, duplicate note-ons, runaway effects, clipping, and excessive memory usage.
- Keep synthesis on the client; no third-party APIs required for core functionality.
- Never capture global keyboard input outside the focused/active web page.
- Make focus states visible and distinguish active states without relying only on color.
- Buttons, songs, controls and remapping must be usable with assistive technology; don't steal keystrokes from focused form controls.
- Support recent Firefox, Chromium/Chrome, and Edge; evaluate mobile touch separately.
- Respect reduced-motion preferences, avoid high-frequency flashing, and expose a clear Stop All control.
- No sensitive user data or credentials are needed.
- Include a simple, public-repo-friendly README, screenshots/short demo when built, and automated tests for note mapping, song scheduling, and exports.

## 10. Technology direction (tentative, not locked)

A lightweight browser app is a good fit. TypeScript plus Web Audio API, optionally Tone.js, could handle sounds and demo scheduling; SVG or HTML/CSS can render interactive keyboard keys. Keep dependencies small. A backend, AI, login, and paid APIs are not justified for the initial concept.

Tech choices should be made at implementation time after comparing the simplest viable options; this document intentionally avoids prematurely locking a framework or deployment service.

## 11. Acceptance criteria when we eventually build it

1. Pressing a mapped physical key produces a note and visibly illuminates exactly that key; releasing it turns off the pressed state without delay or stuck audio.
2. Two or more simultaneous keypresses produce a chord and highlight every pressed key.
3. Clicking a visual key works without a physical keyboard.
4. Editing a mapping changes key labels, playback mappings and demo hints consistently.
5. Demo playback audibly plays the selected tune, advances the correct key tabs, and illuminates the exact on-screen keys at matching times.
6. Pause/stop/switch-song fully release demo-owned notes without interrupting separately held user notes.
7. Tempo changes are reflected by both sound and visualization.
8. Controls are discoverable and grouped; a first-time user can play without reading a manual.
9. All major UI states work on supported desktop browsers, and small viewports remain navigable.
10. No credentials, backend, or upload is required to play a note.

## Current project state

**Concept and UI specification only.** Repository documentation can be refined now. Code, packages, deployment, CI, and any runnable demo are explicitly out of scope until the owner requests development.
