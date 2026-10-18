# feel integration acceptance — October 17, 2026

The editor, daily repositories, shared-pipeline Maya, exact-map history/playback/comparison, and appointment report are connected. The OpenSpec checklist is **32/34 complete**. Two acceptance gates remain: actual demo-laptop confirmation (2.8), and a live Google Gemini request after the user supplies credentials (the live portion of 6.3). No successful live Google request is claimed.

## Observed environment

Direct hardware/system checks report MacBook Air (MacBookAir10,1), Apple M1, 8 GB memory, macOS 26.5.2, and Node 22.16.0. The previous feature documentation's M5 Pro/64 GB claims were incorrect and are superseded. The user has not confirmed this machine is the demo laptop.

Browser checks use Playwright Chromium with `--use-angle=swiftshader --enable-webgl`, one worker. The final painting check reported **60 rendered FPS**, above the 30 FPS gate, at the default 1280×720 viewport. This is software WebGL in a headless browser, not a measured result on another device. Cleanup/remount checks prove the previous editor handle is disposed, history owns a distinct read-only scene, and returning to check-in creates exactly one working editor.

## Passing checks

| Check | Observed result |
| --- | --- |
| `npm test` | 80 passing; zero failures, cancellations, or skips |
| `npm run typecheck` | Pass |
| `npm run build` | Pass; all application routes built |
| Full production browser suite, no database or Gemini configuration | 41 passing; zero unexpected, flaky, or skipped tests |
| Real PostgreSQL 17.11 migration and transaction test | Pass using real PNG maps and the shared reducer; replacement, rollback, concurrent upserts, missing/empty days, and profile isolation |
| PostgreSQL history and assembled rehearsal | 11 passing, including all 42 Maya dates and desktop/touch visitor flows |
| Final PostgreSQL draft/date regression | 4 passing: desktop, actual touch at 390px, rejected browser write, server rejection/retry and separate-session isolation |
| Actual UI → Route Handler → loopback fake Gemini provider | 2 passing: validated success; invalid counts/diagnostic prose rejected; HTTP failure/timeout; factual fallback/retry; stale-response cancellation |
| Maya regeneration | Reproducible through shared PaintEngine, atlas, reducer, and lossless encoder; 42 decoded maps agree with stored observations |
| `openspec validate pain-map-journal --strict` | Pass |

Production checks ran at `http://127.0.0.1:3014`. The earlier touch-selection failure was corrected: initializing a playback controller after metadata arrives no longer emits an older selected date. All 41 production checks pass after merging main at `8c0b885`, including main’s two additional end-to-end integration checks. The merged build, TypeScript, all 80 unit tests, and strict OpenSpec validation also pass.

## What the assembled checks establish

- Real mouse/touch painting, independent sensations, erasing/undo, named views, keyboard focus, reduced motion, renderer failure, cleanup/remount, and the FPS threshold.
- Real maps and notes save, update a single daily entry, and restore with identical SHA-256 hashes in both stores. Previous-record copying leaves the source intact. Rejected writes retain the painted draft and note and retry in the selected store.
- The previous-map copy/note/save interaction took **249 ms on desktop and 167 ms on the narrow touch setup** in the final production automation. These timings are automated interactions, not a human usability study.
- Unavailable PostgreSQL history shows its actual error, never a browser-storage label, missing-day facts, or empty-history analysis.
- Visitor history is separate from immutable synthetic Maya. Profile/range/date restoration, selected-date map reads, prefetching, cancellation, one-entry playback disabling, and missing versus explicitly empty days work through the repositories.
- Maya traverses all 42 dates chronologically at 2x, stops at October 17, and remains paused after scrubbing. Thigh burning starts October 3, calf burning October 10, and lower-back aching occurs on 38 recorded days. Explicit note intensity ratings use the same target as their painted map.
- Trends and the two labeled comparison maps/table agree with those same saved entries. Missing dates cannot be compared as zero pain. No AI service is required for deterministic analysis.
- Reports exclude drafts, use the same timeline evidence, show actual front/back range composites, preserve patient-attributed partial-relief wording, and remain usable without Gemini. Maya's default report fits one A4 and one Letter PDF page in Chromium.
- Visual review covered check-in, history, comparison, and report at 390, 768, and 1440px, plus print media. The body remains prominent, camera controls/legends are visible, and narrow comparison maps retain their labels. Tables/long timelines scroll within their own containers.

## Reproduce

```sh
npm run demo:generate
npm test
npm run typecheck
npm run build
npm run start -- -p 3014
# Separate terminal:
TEST_BASE_URL=http://127.0.0.1:3014 npm run test:browser
```

PostgreSQL setup and migration are documented in [journal.md](journal.md). Acceptance used a native loopback-only PostgreSQL 17.11 server on port 55432 because Docker's engine was unavailable. PostgreSQL was installed through Homebrew with approval. The temporary acceptance database and app/provider test processes were stopped after verification; the user’s original development server was preserved. The tests use temporary visitor records; the transaction test creates and removes its own isolated schema.

```sh
TEST_DATABASE_URL=postgresql://pain_journal@127.0.0.1:55432/pain_journal npm run test:journal:postgres
# App must be configured with DATABASE_URL for the same local database:
TEST_BASE_URL=http://localhost:3016 TEST_JOURNAL_STORAGE=postgresql npm run test:browser -- tests/browser/history.spec.ts tests/browser/journal-history.spec.ts
```

The fake-provider commands are in [report.md](report.md). `PAIN_JOURNAL_DIST_DIR=.next-acceptance` can isolate a development instance from an existing server's build directory; these generated directories are ignored by Git.

## Remaining acceptance

1. **Task 2.8:** confirm the current MacBook Air is the demo laptop. If another laptop will be used, repeat the body FPS/remount checks on that device and record its actual model, browser, settings, and observed FPS.
2. **Task 6.3, live Gemini portion:** add `GEMINI_API_KEY` and `GEMINI_MODEL` to `.env.local`, restart the app, and submit Maya's report using Organize with Gemini. Record the actual provider/model and validated result. The key stays server-only and must not be pasted into reports, documentation, or logs. Task 5.6 is complete because it explicitly permits recording unavailable credentials; task 6.3 stays open until its included live path is exercised.

The implementation is reviewed on `fix/pain-map-journal-task-6-conflicts`, which merges main at `8c0b885` and replaces the original integration branch. The reconciliation preserves main’s shared synthetic source, origin checks, and regression tests, and consolidates the editor bridge. The OpenSpec change remains unarchived; merging and deployment are outside this request.
