# AGENTS.md — Keyboard Studio

## Project overview
**Keyboard Studio** turns a computer keyboard into a piano. TypeScript, React, Vite and the
native Web Audio API; no backend. Read [ARCHITECTURE.md](ARCHITECTURE.md) first and
[docs/REVIEW.md](docs/REVIEW.md) for the reasoning behind the current design.

## Commands
- Install: `npm install`
- Dev server: `npm run dev` (http://localhost:5173)
- Typecheck: `npm run typecheck`
- Unit/integration tests: `npm test`
- E2E tests: `npm run test:e2e` (Playwright; also builds and previews for the offline test)
- Production build: `npm run build`
- Audio level report: `npm run probe:audio`; spectral sanity: `npm run probe:spectrum`
- Screenshots: `npm run screenshots`

## Engineering guidelines
1. **Layering.** `music/` is pure; only `audio/` creates Web Audio nodes; only
   `app/studio.ts` listens to window keyboard events; components never schedule audio.
2. **Latency first.** User notes call `engine.noteOn` synchronously from the input
   handler. Never put network, storage or React rendering in that path.
3. **No stuck notes.** Release/stop on `blur`, `visibilitychange`, panic, and when a mapped
   key's `keyup` arrives. Voices end through `onended`, not timers.
4. **Click-free envelopes.** Build amplitude envelopes from `setTargetAtTime` so releasing in
   the middle of an attack cannot jump. Do not use `cancelAndHoldAtTime` (not in Firefox).
5. **Stable layout.** Anything whose content changes at runtime (readouts, timers, chord
   names, indicators) lives in a fixed-size box with clipped overflow, or is absolutely
   positioned. Add a case to `tests/e2e/layout-stability.spec.ts` when you add dynamic UI.
6. **Songs** are authored as parts in `src/music/songs.ts`; keep every part's bars summing to
   the bar length (the tests enforce it) and the notes within C2–C7. Only public-domain
   compositions; arrangements are original work.
7. **Assets and licences.** Only redistributable audio with a verified licence, recorded in
   `public/samples/**/ATTRIBUTION.txt` and the README. CC BY needs visible attribution.
8. **Loudness.** If you add or change a voice, run `npm run probe:audio` and adjust
   `INSTRUMENT_TRIM` so the instruments stay balanced and unclipped.
9. **Tests.** New behaviour needs unit tests; UI/flow changes need a Playwright case.
   Automated audio checks cannot judge sound quality: say what still needs listening.

## Git workflow
Work on a feature branch (`feat/…`, `fix/…`), commit only intended files, never force-push
shared branches, and do not deploy without explicit owner approval.
