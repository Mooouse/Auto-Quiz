# AUTO QUIZ — implementation report

Date: 2026-10-21 (owner timezone). Brief: photo/silhouette car quiz, four single-player modes, three formats, expandable explicit catalogue. Audience: general. Current channel: web. Kit: code. Intended future portal: CrazyGames.

## Implemented

Menu, all four quiz modes, three session formats, strict aliases, unique question queue and related distractors, active-time timer, streak/XP rewards, results, car collection, achievements, profile, per-mode/per-format statistics, local save/reset, optional sound, RU/EN, responsive styles and a browser catalogue importer. Core/session/storage/view boundaries are separate. Online is marked coming soon and contains no simulated users.

No owner car photographs were supplied. The production catalogue is intentionally empty, with clear import/addition guidance and minimum-pool checks. Fictional browser fixtures are isolated inside tests and never written to public/ or dist/.

## Verification

- `npm test`: 26 passed, 0 failed. Covers all 12 mode/format combinations, exact aliases, duplicates/ambiguity, minimum pool, no repeats, recent avoidance, 3-error marathon, deadline rejection, load/pause timing, double-submit prevention, scoring, collection/achievements, idempotent summaries and corrupt-save hydration.
- `npm run build`: passed catalogue validation, strict TypeScript and production Vite build. The nonfatal dynamic-import bundling warning comes from the provided platform snapshot.
- Independent code reviewer identified six issues: asynchronous confirmation loss, mobile stats access, semantic duplicate cars, import/session races, tablet sorting, and untranslated labels. Fixes applied. Static follow-up confirmed the main fixes and identified two remaining variants: the tablet-specific sorting rule and resuming under another confirmation. Both were corrected. Browser validation remains outstanding.
- Browser E2E runner: written against production dist with isolated, explicitly fictional car data and generated transparent fixture PNGs. It is **not reported as passed**. Chromium could not start in this execution environment: `socket() failed: Operation not permitted`. Extended-execution approval was rejected by the environment policy. The integrated browser also did not receive approval to open the local origin. No alternate path was used to bypass the restriction.
- Therefore no verified browser screenshots, independent screenshot quality review, real-device touch/audio check, or completed portal QA are available in this handoff.

## Release status and remaining work

This is a source implementation and buildable foundation, not a certified portal submission. Add the owner's real photographs and explicit identities; run `npm run check`, `npx playwright install chromium`, and `npm run test:e2e` in an environment that allows browser execution. Inspect desktop, portrait, landscape, reveal animation and audio. Then complete the independent visual review required by AGENTS.md, reconcile/enable the SDK adapter against current official CrazyGames docs, test portal preview, and prepare covers and submission materials.

Money forecast: not produced; no invented revenue or approval probabilities. Submission package: incomplete because real photographs, visual/browser QA and actual SDK integration are outstanding.

## Platform reuse and friction

Used the original ZIP unchanged with SHA-256 pinning, code-kit entry, GameHost lifecycle, host audio bus, bundled Exo 2 font, configuration validation and Vite aliases. No platform package source edits. Added the font's OFL notice to the public build.

The snapshot's translation validator rejects spaces inside keys (`category.Sports Cars`), so display-label translation keys use `SportsCars` while database category values stay unchanged. The manifest uses `sound.why` as defined by the validator. The platform's generic release workflow cannot validate genuine car-photo gameplay until the content set exists. A finite catalogue ends marathon/time attack explicitly rather than violating the user's no-repeats rule.

Block requests: none. Main documentation gap for this project: migration of snapshot portal focus lifecycle to the latest CrazyGames game-event guidance must be checked before channel activation.
