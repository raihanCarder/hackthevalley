# Local two-profile verification

The approved flow is implemented: profile icon → You or Maya; You's painted check-in → local PostgreSQL → history/trends/comparison → saved-only report → explicit Gemini action. Maya is fixed, synthetic, and read-only. The app is available during this session at http://127.0.0.1:3025.

## Local setup observed

Docker Desktop was running but its engine returned EOF / invalid image-response errors. The installed Homebrew PostgreSQL 17 service was started on 127.0.0.1:5432 instead. The configured application login/database were created only if missing. The existing DATABASE_URL and Gemini key were preserved. All SQL migrations applied successfully; a second migration run reported the database current.

Migration 003 adds persistent profile ownership, backfills old visitor profiles, preserves their exact saved entries, and creates `local-you`. You does not depend on a cookie, seven-day expiry, browser preference, or browser database. The running UI uses PostgreSQL exclusively; test data is isolated from this journal.

## Automated results

- `npm test`: **89 passing**; no live provider or database needed. Covers painting/codec/reducer, historical IndexedDB compatibility, drafts, cancellation, shared analysis, report evidence, server-owned summary loading, stale revisions, and Gemini validation/fallback (including HTTP 402).
- `npm run typecheck`: passed.
- `npm run build`: passed after the final editor timing fix and billing-error handling. Includes `/api/report/entries` and the report summary route.
- Real PostgreSQL integration: passed in a disposable schema. Seeded legacy entries before migration 003 survive unchanged. Exact maps/notes, daily replacement, transaction rollback, concurrent writes, persistent You ownership, and bounded full-record reads passed.
- Journal browser acceptance: the focused 13-test run passed, covering the complete painting/save/reload/copy/history/comparison/report path on desktop and real emulated touch at 390px, rejected-save retry, date/read races, and independent browsers reading/updating the same You journal.
- Full credential-free browser suite: **41 of 44 passed initially**. One cleanup assertion still expected Maya's default canvas and was updated to expect no live renderer for an empty You history. The FPS and 42-day playback checks failed while another browser suite competed for resources (20.7 FPS and playback beyond its 30-second limit).
- Focused follow-up: **4 of 4 passed**, including the corrected resource cleanup, the unchanged ≥30 FPS assertion, all 42 playback dates in chronological order, and the new keyboard-accessible two-option profile menu at 390px, 768px, and 1440px. These runs cover all 45 current credential-free browser cases across the full/focused checks; the full suite was not rerun after these focused passes.
- Local fake Gemini provider: **4 of 4 passed**, including You's saved PostgreSQL evidence reaching a verified summary, rejection of uploaded evidence/stale revisions, timeout/error/invalid-plan fallback, retry, and cancellation on range or profile change.
- A4 and Letter print checks passed with one page for Maya. Mobile/desktop screenshots reviewed: profile menu, body, history, comparison, and report remain usable without horizontal overflow. You's exact unsaved painting/note survived switching through Maya.

Browser acceptance uses `npm run test:local-browser`, which starts a separate app and generated PostgreSQL schema, resets only that schema between tests, disables live Gemini, and removes the schema afterward. `npm run test:local-browser -- --fake-gemini report-provider.spec.ts` additionally starts the loopback-only fake provider. The normal journal is never reset or populated by this runner.

## Live Gemini outcome

The supplied model setting contained the display name `Gemini 3.5 Flash-Lite`, which produced HTTP 400. It was corrected in the ignored local environment file to the [documented API model ID](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite), `gemini-3.5-flash-lite`, without changing the key.

The explicit live request used **only Maya's synthetic records**. Google returned **HTTP 402**, so a successful live-generated summary could not be verified. The app accurately retains its factual summary and now explains that billing or available credits are required. Live Gemini success remains dependent on provider billing/access; fake-provider success is not presented as a successful Google request.

The original hardware-specific demo-laptop acceptance gate remains unchecked: software-rendered Chromium checks are not a physical GPU rehearsal.
