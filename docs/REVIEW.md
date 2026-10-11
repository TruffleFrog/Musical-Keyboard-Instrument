# Review of Keyboard Studio v1 and what changed in v2

This documents an independent audit of the first version (branch
`feat/keyboard-studio-v1`), the problems found, what was changed on
`feat/studio-overhaul`, and how each claim was verified. Where something could not be
verified by a machine it is listed under **Needs human review**.

## 1. Audit findings (v1)

### Layout — the "page jumps when I press keys" bug
Measured with Playwright at 1440×900 against the v1 build:

| | Keyboard top edge |
| --- | --- |
| Sound Studio tab | 503 px |
| Demo Songs tab | 456 px |
| Recorder tab | 378 px |
| Press a 7-note chord (any tab) | **+9 px** |
| 900×700, Songs tab, chord | **−30 px** |

**Root cause:** the whole page was normal flow layout with content-sized regions. The header's
LED readout (note chips that wrap, an idle message that wraps to three lines) and each
tab's panel contributed their natural height, so every dynamic text change re-flowed
everything below it, including the keyboard. Fixing individual labels would not have
helped; the structure itself was the bug.

### Audio
- Oscillator-only instruments with note-off timers (`setTimeout`) rather than the audio clock.
- All voices of every instrument shared one reverb send that was re-written on *every*
  note-on, so the last instrument played changed the reverb of notes already ringing.
- Gain staging was uncalibrated: on the same passage the bass was ~10 dB louder than the
  piano. No DC handling, no limiter beyond a mild compressor.
- Envelopes used `exponentialRampToValueAtTime` + `cancelScheduledValues`, which can snap
  in some browsers (the previous author had worked around this by reading `.value`).
- "Piano" was a triangle plus two sines; "Rhodes" a sine plus triangle. Not convincing.
- The bass preset sounded two octaves below the key pressed.

### Songs and practice
- Songs were flat arrays of single notes; nothing could sound together.
- Playback was a React `useEffect` that scheduled `setTimeout`s per step, so timing was tied
  to rendering, a tempo change restarted the current note, and a minimum step length distorted
  fast passages.
- Notes outside the 25-key window forced an octave change (impossible when a song spans
  more than two octaves, e.g. with a bass line).
- Practice mode could only step through single notes.

### Recording / export
- Fixed velocity, no sustain pedal, single MIDI channel, MIDI minimum-length hacks.
- Sustain state was persisted across reloads (a stuck-pedal surprise).

### Code
- An 800-line `App.tsx` with ~20 `useState`s and event handlers re-bound on state change.
- Fonts loaded from Google at runtime (breaks offline, third-party request).
- Tests exercised mocks that never produced audio.

## 2. What was built

| Area | v1 | v2 |
| --- | --- | --- |
| Layout | content-sized flow; keyboard moved | fixed-region grid; exact boxes asserted at 4 viewport sizes |
| Piano | oscillators | Salamander Grand Piano samples (CC BY 3.0), velocity-shaped, damper release |
| Other sounds | basic oscillators | FM tine + pickup model, unison synth with 24 dB filter, plucked bass, band-limited chip, additive organ; per-instrument FX buses |
| Songs | 6 single-line melodies | 7 multi-part arrangements; 3–6 simultaneous notes |
| Scheduling | `setTimeout` per step in React | audio-clock lookahead player, live tempo change, loop, part mute |
| Out-of-range notes | forced octave change | fixed 61-key keyboard with a sliding QWERTY band |
| Practice | single-note stepping | Learn mode: chord steps, octave-forgiving, accompaniment follows |
| Visuals | tabs + chips | note roll above the keys, rotary controls, chord-name readout |
| Recorder | fixed velocity | touch + pedal captured, multi-track MIDI with CC64, rename, replay lit |
| Persistence | prefs v1 incl. pedal | validated prefs v2 with migration; pedal not persisted |
| Offline | fonts from CDN | system fonts + service worker caching samples |

## 3. Verification evidence

Run in this session (Windows, Node 24, Chromium via Playwright, system Firefox for a render check):

| Check | Result |
| --- | --- |
| `npm run typecheck` | clean |
| `npm test` | 132 / 132 pass (9 files) |
| `npm run test:e2e` | 70 / 70 pass (Chromium + production-build offline project) |
| `npm run build` | 255 kB JS (81 kB gzip) + 22 kB CSS, plus 1.36 MB of piano samples |

### Layout stability (the reported bug)
`tests/e2e/layout-stability.spec.ts` snapshots the exact box of top bar, readout, deck, note
roll, dock and key bed, then asserts they are bit-identical after: a 14-note cluster, 40 rapid
note presses, octave shifts, pedal, sound switching, label toggles, all tab switches, all
songs, song playback, part toggles, Learn mode, recording, take playback — at 1440×900,
1280×720, 1024×768 and 390×844. It also asserts the page never scrolls. While writing it the
suite found **two further real shifts** that were then fixed: the dock's border pushed rows
1 px past the viewport, and the red recording dot widened the Record tab, nudging the
readout 15 px sideways.

### Audio, measured by rendering the real engine offline
(`scripts/audio-probe.mjs`; `rms` over the first 2.2 s of the "song" passage, `peak` of an
8-note fortissimo chord, both after the master stage at the default volume)

| Sound | passage RMS | 8-note chord peak | clipped samples | onset |
| --- | --- | --- | --- | --- |
| Grand Piano | −18.7 dBFS | −3.6 dBFS | 0 | 7 ms |
| Electric Piano | −19.1 | −4.1 | 0 | 6 ms |
| Poly Synth | −19.9 | −4.4 | 0 | 6 ms |
| Funk Bass | −18.5 | −5.3 | 0 | 9 ms |
| 8-Bit Chip | −20.2 | −4.8 | 0 | 6 ms |
| Pipe Organ | −19.5 | −4.6 | 0 | 6 ms |

Defects found and fixed by these measurements: instrument loudness spread of ~16 dB →
1.7 dB; a **DC offset of ~0.04 in the electric piano** (asymmetric pickup curve) → ~1e-5
after AC coupling. Automated checks also assert: no NaN/∞, no full-scale samples, ≥ 1.5 dB
peak headroom, silent tail after release (every voice ends), attack within 30 ms, no step
discontinuity at note start, no DC, loudness balance < 7 dB, and that all voices are
reclaimed after a busy passage. The first key press used to cost 41 ms (device + graph +
reverb impulse creation); it is now pre-built when idle and costs ~0.6 ms.

### Songs
Unit tests enforce, for every song: every bar of every part sums to the time signature (with
pickups), all parts are the same length, ≥ 3 notes sound at once somewhere, all notes fit
C2–C7, and ≥ 80 % of the melody falls inside the recommended QWERTY window. The live
browser run lit up to 6 keys at once (Prelude) and returned to 0 voices after pause.

### Browsers
Chromium: full automated suite. Firefox: the system Firefox 
rendered the UI identically (headless screenshot, `docs/screenshots/after/firefox-play.png`)
and the code avoids Chromium-only Web Audio features. Playwright's Firefox build is not
installed here, so **interactive Firefox behaviour (real key events, audio output) was not
automated** — please give it a quick manual pass.

## 4. Needs human review

These cannot be judged by a machine and were **not** listened to:

1. **How good each sound actually sounds.** The piano is a genuine recording, so it should
   be convincing; the Rhodes, synth, bass, chip and organ are synthesised and the tuning
   constants (FM index, filter sweeps, chorus depth, reverb size) were chosen from
   experience and measured only for level/DC/clipping, not taste.
2. **Piano dynamics.** One sample layer is used; soft vs hard is shaped with gain and a
   lowpass, not true velocity layers.
3. **The arrangements.** Bar-length and range correctness is tested; musical correctness
   (right notes, voicings, balance) was written from knowledge of the pieces and has not
   been checked against scores or by ear. Für Elise plays only the famous A-section theme
   (twice), not the contrasting sections. The Greensleeves chorus and the second half of
   Korobeiniki are the most likely to deserve a score check.
4. **Reverb amount per sound** and overall master loudness at the default 80 %.

## 5. Known limitations / ideas not done

- No WAV/MP3 export (MIDI only) and no Web MIDI input.
- Piano has no release/pedal-noise samples and a single velocity layer (full set is ~1 GB).
- The 25-key QWERTY layout is unchanged (it extends the GarageBand/Logic layout); key
  legends assume a US layout, though the mapping uses physical key codes.
- On phones the keyboard shows ~15–17 keys (portrait); landscape is far better.
- No metronome or count-in.
- No LICENSE file exists in this repo (the separate planning repo is MIT); add one if intended.
