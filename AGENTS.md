# AGENTS.md — Repository-wide agent instructions

Applies to **Claude Code, OpenAI Codex, IDE agents, automated contributors, and anyone following agent-driven workflows**. Read this before every task, and re-check when instructions change.

> **Project phase: implementation under way (authorized 2026-10-10, gate `G-01` ✓).** A playable app exists; see `ARCHITECTURE.md` §20 and `TODO.md` for exactly what. Build the next unblocked task as the smallest useful vertical slice. Releases are separate and **manual only** (`G-03` approved 2026-10-10 for manual GitHub Pages deploys).

**Read-order for every task:** this file → `TODO.md` → `ARCHITECTURE.md` (especially §20 *Current implementation & infrastructure status*) → `docs/PRODUCT_CONCEPT.md` → `README.md`.

## 1. Mandatory start-of-task freshness check

**Do not trust the local checkout or a prior conversation's snapshot.** GitHub `main` is the shared reference; fetch and inspect it **every new work session/task**, even if an agent previously looked at the repo.

1. Identify the repository, current checkout, active branch and working-tree changes:
   ```sh
   git remote -v
   git status --short --branch
   git branch --show-current
   git fetch origin --prune
   git log -1 --oneline origin/main
   git rev-parse HEAD
   ```
2. Before deciding what to edit, read the *current* `origin/main` versions of **AGENTS.md, ARCHITECTURE.md, TODO.md, README.md, and docs/PRODUCT_CONCEPT.md** where present. Also inspect the active branch's versions and any pending PR changes. Examples:
   ```sh
   git show origin/main:AGENTS.md
   git show origin/main:TODO.md
   git show origin/main:ARCHITECTURE.md
   ```
3. Compare current local state against `origin/main` (`git log --oneline --left-right HEAD...origin/main` and/or `git diff --stat origin/main...HEAD`). Confirm whether a requested feature, decision, or fix already exists before recreating it.
4. If the checkout is stale: **safely incorporate current `main` before changing shared work**. When clean, fast-forward `main` using `git pull --ff-only`; when on a feature branch, rebase or merge the latest `origin/main` only after inspecting changes and ensuring nothing is lost. Resolve conflicts deliberately; never blindly reset, overwrite, or force-push another contributor's work.
5. If there are uncommitted changes, unfinished work, an active PR, or a detached HEAD: preserve them. Do not stash, discard, rebase, or cherry-pick over someone else's changes without a safe plan. Use an isolated worktree or new branch when needed.
6. With API-only agent tools, reproduce the same checks by reading the repo's current `main` head SHA, root contents, and relevant files; then verify the feature branch head before writing/merging.
7. **Re-check `origin/main` again before opening or merging a PR**. Update/reconcile the branch if another agent has changed shared docs or code meanwhile.

If remote checks fail, report the limitation. **Do not pretend freshness was verified, or silently continue making assumptions from old documents.**

## 2. Canonical documents / source-of-truth order

- **Explicit current user instructions**: scope and whether implementation is authorized. Ask for clarification only if truly indispensable.
- **AGENTS.md**: repository contribution and maintenance rules.
- **docs/PRODUCT_CONCEPT.md**: product behaviors, UX requirements, interactions, accessibility and feature expectations.
- **ARCHITECTURE.md**: proposed/implemented tech stack, boundaries, component ownership, data contracts, infrastructure and development phases.
- **TODO.md**: authoritative open/completed task checklist, dependencies, blockers, and phase acceptance criteria.
- **README.md**: concise public-facing overview; keep it synchronized with actual repository status.
- **Current code and verified tests**: evidence of what exists; if reality and documentation diverge, fix the discrepancy rather than asserting unsupported completion.

Where two documents conflict, flag the contradiction and make the smallest coherent correction based on the latest accepted decision. Do not silently discard intentional product decisions.

## 3. Work scope and execution discipline

- **Planning request → docs only**. Do not interpret descriptions of features as permission to build them.
- **Build request → smallest useful vertical slice**, starting from the next uncompleted, unblocked TODO phase task.
- Prefer simple, understandable implementation over clever abstractions and unnecessary infrastructure.
- **New dependencies need justification.** The target is zero runtime dependencies (currently `react`, `react-dom`, `lucide-react` — decision D12). Adding any package requires a stated reason in the PR and an update to `ARCHITECTURE.md` §18; prefer the platform (Web Audio, DOM, `localStorage`) first.
- **Respect module ownership** (`ARCHITECTURE.md` §4): only `input/` interprets raw DOM key/pointer events, only `audio/` creates Web Audio nodes, `music/` stays pure (no DOM/Web Audio).
- Keep the app client-only by default. No login, backend, database, analytics, third-party API, app tracking or remote note capture without explicit new requirements.
- Prefer proposed TypeScript + Vite + native Web Audio API; any meaningful departure needs documented technical reasons and owner approval when it materially changes scope/cost.
- A keyboard is a **computer QWERTY-style keyboard map**, not merely a decorative piano. Real physical presses, clickable keys, demo events, chords and visual illumination must be synchronized.
- Maintain separation between raw input, note mapping, audio voices, song transport, UI state and recording. Avoid using UI render timers as the clock for audio scheduling.
- Protect user data and developer privacy: no personal paths/emails/keys in public files, screenshots, logs or Git history. Never introduce unlicensed music recordings or sound assets.
- Don't install packages, change hosting, add CI, register services or initiate deployments unless the assigned phase requires it. In particular, **never enable auto-deploy on every push** without explicit owner direction.
- Honor the current UI's uncluttered, keyboard-centered UX and accessibility requirements.

## 4. Git workflow and collaborating with other agents

1. Create or reuse a suitable **feature/docs branch**, not direct pushes to `main`; changes reach main via reviewed PR/squash merge where allowed.
2. Before changing shared files, check whether another branch or PR is working on them; prefer integrating work rather than generating competing versions.
3. One coherent change per PR. Avoid unnecessary churn, enormous refactors, and “cleanup” that obscures the requested feature.
4. Commit only intended files; inspect `git diff --check`, changed paths, and statuses. No `git add .` without checking what will be staged.
5. Include what changed, why, evidence/tests, limitations, and **documentation updates** in the PR description.
6. Don't claim CI passed while it is pending or unavailable. Avoid merging failing changes except on explicit user instruction with a stated risk.
7. Do not force-push shared branches, rewrite published history, or merge over stale commits without inspection.
8. Never automatically deploy to production. Releasing is a separate deliberate action.

### Coordinating with other agents

- **Before starting**, list open work: `git branch -r`, `gh pr list --state open` (or the equivalent API calls). If another branch/PR covers the same `TODO.md` task, build on it or coordinate instead of creating a competing version.
- **Branch names:** `docs/<topic>` for documentation, `feat/<task-id>-<slug>` for features, `fix/<slug>` for bug fixes. Reference the TODO task ID (e.g. `P1-09`) in the PR title.
- **One task, one branch, one agent at a time.** Open a draft PR early when work will span a session so others can see it.
- **Never delete, force-push or rewrite another agent's branch or PR.** Leftover branches are reported, not cleaned up.
- **Docs conflicts:** when `TODO.md`/`ARCHITECTURE.md` conflict, keep *both* sides' valid changes and re-verify each checkbox; never resolve by taking one side wholesale.
- **Commit identity and privacy:** before committing, check `git config user.name` / `user.email`. Use the project owner's GitHub identity or GitHub's `…@users.noreply.github.com` address; never commit a personal email address, absolute home-directory path, token or credential.

## 5. Mandatory task and architecture updates

**This applies whenever an agent finishes work, not just at the end of a phase.**

1. Open current `TODO.md` before starting. Identify the matching task(s). If the work is a genuinely new task, add a concise checkbox in the correct phase **before or alongside the implementation**. Do not duplicate existing tasks.
2. After doing work, **mark a checkbox `[x]` only when its acceptance criteria are demonstrably met**. Leave partial work unchecked and add a short status, subtask, or blocker explanation. Do not claim something was tested that was not.
3. In the **same PR/branch** as the work, update:
   - `TODO.md`: completed checkboxes, blocked or follow-up tasks, and changes to sequencing/dependencies.
   - `ARCHITECTURE.md`: **§20 Current implementation & infrastructure status**, phase completion, actual package/runtime choices, key data flows or decisions **when affected**. Do not rewrite architecture for trivial copy/style changes; still verify it remains accurate.
   - `README.md`: project status, setup commands or public features **if they changed**.
   - `docs/PRODUCT_CONCEPT.md`: only when an authorized product requirement changes.
4. Any significant architecture change: document the decision, alternatives, tradeoffs and migration impacts. A decision can be proposed without silently becoming final.
5. For every completed implementation task, cite evidence in the PR: test command and result, observable behavior, screenshot/manual check or build artifacts as appropriate. **Document-only work** may use file/repo verification, without pretending it has runtime tests.
6. Update documentation before requesting PR review/merge, then verify the merged state and give the user a concise summary with link.
7. If stopping with unfinished work, report the exact branch/PR, what is complete, what is pending and how to resume. Never invent a “done” status.

### Definition of done

A task is done only when the requested behavior or document exists, acceptance checks pass (or nonapplicable checks are clearly identified), no known critical regressions remain, and tracking docs match reality. **The existence of a UI control does not prove its behavior works.**

## 6. Verification rules by change type

**Never state that a test, build, lint run or deployment passed unless you ran it (or observed its result) in this session.** "Not run" and "not available yet" are valid, honest answers.

**Docs-only:** check links and anchors, file references, terminology (Phase 0–6 naming), phase/TODO consistency, markdown formatting, code/status claims and merge result; explicitly say implementation tests were not relevant.

**App code:** run available `typecheck`, `lint`, `test`, `build`, and the appropriate browser/E2E tests. If the scripts/tools do not exist yet, document that fact honestly instead of fabricating output. Add regression tests for bug fixes.

**Audio and keyboard features:** beyond CI, manually verify in Firefox and Chromium where possible: real keydown/up, chords, pointer cancellation, focus loss, no stuck notes, audio unlock, instrument switching, demo tab/audio/keyboard synchronization, tempo changes and accessibility. Headless test success is not proof of audible quality.

**Deployment:** only when explicitly authorized; confirm actual deployed URL, checks and manual usability, not just the workflow's green icon.

## 6a. Commands and codebase-specific rules

| Command | Purpose |
| --- | --- |
| `npm ci` | Reproducible install |
| `npm run dev` | Vite dev server (http://localhost:5173) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit / integration |
| `npm run test:e2e` | Playwright (Chromium): starts the dev server and a production preview itself |
| `npm run build` | Production build to `dist/` |
| `npm run probe:audio` / `probe:spectrum` | Offline-render level and spectral reports per instrument |
| `node scripts/smoke-url.mjs <url>` | Smoke-test a deployed or previewed build |

(`npm run lint` does not exist yet — `P0-05`.)

Rules specific to this codebase:

1. **Latency first.** User notes call `engine.noteOn` synchronously from the input handler. Never put network, storage or React rendering on that path.
2. **Click-free envelopes.** Build amplitude envelopes from `setTargetAtTime` so releasing mid-attack cannot jump; do not use `cancelAndHoldAtTime` (not in Firefox). Voices end through `onended`, not timers.
3. **Stable layout.** Anything whose content changes at runtime (readouts, timers, chord names, indicators) lives in a fixed-size box with clipped overflow, or is absolutely positioned. Add a case to `tests/e2e/layout-stability.spec.ts` when adding dynamic UI.
4. **Songs** are authored as parts in `src/music/songs.ts`; every part's bars must sum to the bar length, notes stay within C2–C7, `provenance` is required, and a part must not re-strike a pitch that is still sounding (the validator and tests enforce these).
5. **Assets and licences.** Only redistributable audio with a verified licence, recorded in `public/samples/**/ATTRIBUTION.txt` and the README. CC BY needs visible attribution.
6. **Loudness.** If you add or change a voice, run `npm run probe:audio` and adjust `INSTRUMENT_TRIM` so instruments stay balanced and unclipped.
7. **No test hooks in production.** `window.__keyboardStudio` exists in dev builds only.
8. **Shared Pages origin.** The deployed app lives on a user-wide `github.io` origin. Keep storage keys and cache names namespaced (`keyboard_studio_*`, `keyboard-studio-*`) and never delete caches you do not own.

## 7. Multi-agent handoff

At the end of work, give a short handoff with:
- repository + branch + commit/PR link;
- what changed;
- checks actually performed (and what could not be verified);
- TODO tasks marked or left open;
- architecture/README updates made or not needed;
- unblocked next task;
- any risks requiring user input.

Before starting the next task, **repeat the freshness check**. Never rely on a prior assistant's final answer as the sole source of truth.

## 8. Build order and status

Status (2026-10-10): the first implementation covers parts of Phases 0–4 and some of Phase 6 — `TODO.md` has the exact per-task state. As planned: **Phase 0 repository foundation → Phase 1 playable visual keyboard and basic audio → Phase 2 customization and settings → Phase 3 demo songs with synchronized tabs → Phase 4 recording, export and effects → Phase 5 testing, accessibility, optimization and release → Phase 6 optional enhancements**.

The accepted specification for each phase is in `ARCHITECTURE.md` §19 and the task-level checklist is in `TODO.md`. Do not expand scope into a full DAW, backend, or subscription business without new user approval.
