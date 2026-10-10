# Keyboard Studio 🎹

**Status: concept / planning — not built yet. There is nothing to install, run or visit.**

Keyboard Studio is a playful browser-based musical instrument controlled by an ordinary **computer keyboard**. Choose instrument sounds, customize key mappings and effects, see an on-screen computer keyboard illuminate in real time, and learn songs with demo tabs whose notes *play and light up the matching keys*.

## The idea

- **Interactive visual computer keyboard** — recognizable QWERTY layout; pressed keys glow in real time, including held chords and clicked/tapped keys. User-played and demo-played keys look different.
- **Demo songs with synchronized tabs** — choose a familiar melody, play/pause/stop/restart it, adjust the tempo, loop it, watch the key tabs highlight, and see the keyboard map light up exactly as each note sounds. You can play along.
- **Customization** — instruments (piano, synth, bass, drums, chiptune), layouts and key remapping, octaves, scales, chords/polyphony, sustain, velocity-style emphasis, volume and sound shaping, reverb and echo, and an optional metronome. Preferences are saved locally and can be reset.
- **Record and share** — in-browser performance recording with MIDI export and browser-compatible audio export.
- **Lightweight and local** — designed to work without an account, backend, AI, or paid API.

The main UI will place **a large, animated computer-keyboard map at the center**, expandable customization controls to the side, and a demo-song / song-tab player directly beneath it. The intent is an easy first-run experience, not a wall of settings.

## Documentation

| Document | Purpose |
| --- | --- |
| [docs/PRODUCT_CONCEPT.md](docs/PRODUCT_CONCEPT.md) | Product and UI concept: layout, features, demo-song behavior, interaction rules, acceptance criteria |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Proposed technical architecture, infrastructure and deployment plan, phased roadmap, and the **current implementation/infrastructure status** |
| [TODO.md](TODO.md) | Task-level progress tracker with phases, dependencies and acceptance criteria |
| [AGENTS.md](AGENTS.md) | Mandatory instructions for AI coding agents (Claude Code, Codex, etc.) and automated contributors |

## Current status

| Area | State |
| --- | --- |
| Idea, feature scope and product concept | Documented |
| Architecture, infrastructure plan and roadmap | Documented (proposal) |
| Task tracker and agent rules | Documented |
| Central live keyboard UI | Specified, **not implemented** |
| Audio engine | **Not started** |
| Demo-song tabs and synchronized lighting | Specified, **not implemented** |
| Customization panel, recording, export | Specified, **not implemented** |
| Tooling, tests, CI | **Not set up** |
| Hosting / public release | **Not set up — no deployed site exists** |

No application code or infrastructure has been created yet. Implementation will start only when the repository owner explicitly authorizes it (gate `G-01` in [TODO.md](TODO.md)).

## Proposed technology stack

*Proposed — none of this is installed yet. See [ARCHITECTURE.md](ARCHITECTURE.md) for rationale and tradeoffs.*

- **TypeScript** (strict) built with **Vite**
- **Native Web Audio API** for synthesis (no required sample packs or paid services)
- **HTML / CSS / SVG** for the interactive keyboard
- **Local browser storage** (`localStorage`) for settings and presets
- **Vitest** and **Playwright** for tests; **GitHub Actions** for pull-request checks
- **Static hosting** (GitHub Pages is the first choice), deployed **manually** — never automatically on push or merge
- No backend, database, accounts, analytics or AI

## Proposed build order

| Phase | Outcome |
| --- | --- |
| 0 | Repository foundation and development environment |
| 1 | Interactive visual keyboard and basic audio engine |
| 2 | Instrument customization and settings |
| 3 | Demo songs, animated tabs and synchronized playback |
| 4 | Recording, MIDI/audio export and advanced effects |
| 5 | Testing, accessibility, optimization and release |
| 6 | Optional future enhancements |

**Recommended first vertical slice (once authorized):** physical keyboard input → one synthesized voice → matching on-screen key lights. Then customization, then the synchronized demo-song player. Details and tasks: [TODO.md](TODO.md).

## Contributing

Development has not begun, so there is no build to run yet.

- **Ideas and documentation fixes** are welcome as pull requests against the planning documents.
- **Code contributions** should wait until implementation is authorized; check [TODO.md](TODO.md) for the current gate and the next unblocked task.
- Everyone — people and AI agents — should read [AGENTS.md](AGENTS.md) first: fetch the latest `main`, consult `TODO.md`, work on a feature branch, keep documentation updated in the same PR, and never claim checks passed unless they were run.

## License

No license has been selected yet. A license should be chosen before inviting third-party code contributions or using third-party sound/sample assets.
