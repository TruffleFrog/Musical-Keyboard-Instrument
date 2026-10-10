# Keyboard Studio 🎹

**Status: concept / planning — not built yet.**

A playful browser-based musical instrument controlled by an ordinary **computer keyboard**. Choose instrument sounds, customize key mappings and effects, see an on-screen computer keyboard illuminate in real time, and learn songs with demo tabs whose notes *play and light up the matching keys*.

## The idea

- **Interactive visual computer keyboard** — recognizable QWERTY layout; pressed keys glow in real time, including held chords and clicked/tapped keys.
- **Demo songs with synchronized tabs** — choose a familiar melody, play/pause it, adjust the tempo, watch current key tabs highlight, and see the keyboard map light up exactly as each note sounds.
- **Customization** — instruments (piano, synth, bass, drums, chiptune), layouts/key remapping, octaves, scales, sustain, velocity-style emphasis, volume, sound effects, and metronome.
- **Record and share** — eventual in-browser performance recording, MIDI export and compatible audio export.
- **Lightweight and local** — designed to work without an account, backend, AI, or paid API.

The main UI will place **a large, animated computer-keyboard map at the center**, expandable customization controls to the side, and a demo-song/song-tab player directly beneath it. The intent is an easy first-run experience, not a wall of settings.

## Product documentation

Read the [Product & UI Concept](docs/PRODUCT_CONCEPT.md) for the full layout, feature descriptions, demo-song behavior, interaction rules, proposed phases, and acceptance criteria.

## Project state

| Area | State |
| --- | --- |
| Idea & feature scope | Documented |
| Central live keyboard UI | Specified, not implemented |
| Demo-song note tabs and synchronized lighting | Specified, not implemented |
| Customization panel | Specified, not implemented |
| Audio engine / application | Not started |
| Hosting / release | Not set up |

**Next step when development is authorized:** create a small playable vertical slice connecting physical keyboard input, audio, and illuminated virtual keys; then add the synchronized demo-song player. No code or infrastructure setup has been started as part of this documentation update.

## License

No license has been selected yet. A license should be chosen before inviting third-party code contributions or using third-party sound/sample assets.
