# Local journal

The application has two visible profiles: **You** and **Maya**, selected from the profile icon. The selection follows navigation across the body, history, and report. First use opens You; the device remembers later selections. Browser preferences contain only UI choices, never saved check-ins.

## Local PostgreSQL

You is the fixed `local-you` profile in the PostgreSQL database named by server-only `DATABASE_URL`. Every browser connected to this local installation sees that same journal. No account, session cookie, or expiring visitor identity is required. The API keeps the existing `visitor` selection key for You and `maya` for the sample; neither key is a caller-controlled ownership ID.

```sh
docker compose -f db/compose.yml up -d --wait
# Set DATABASE_URL in .env.local using .env.example. Preserve existing settings.
npm run db:migrate
npm run dev
```

With installed Homebrew PostgreSQL 17 instead of Docker:

```sh
pg_ctl -D /opt/homebrew/var/postgresql@17 -l /tmp/pain-journal-postgres.log -o '-h 127.0.0.1 -p 5432' start
npm run db:migrate
npm run dev
```

The configured login and database must already exist for either setup. PostgreSQL binds to loopback. Its database files or Docker named volume preserve data across app/browser restarts. Resetting that database or deleting its volume removes the journal.

Migration `003_local_profiles.sql` backfills profile ownership from existing visitor sessions, creates You, and moves the daily-entry foreign key to `journal_profiles`. Historical sessions and records remain intact. Existing browser IndexedDB data is untouched; no automatic import runs. The active UI has no storage selector or additional profiles.

## Check-ins

The editor captures all four versioned PNG paint layers, local date, time zone, and optional note. The server validates the maps and computes region statistics. A transaction upserts one daily entry and replaces all regional observations. Only a committed write shows Saved check-in. A rejected write preserves its draft and provides retry. A failed opening provides Retry opening check-in and never becomes an empty saved map.

Dates with no record remain unrecorded. Saving an empty map deliberately creates a record with no marked regions. Copy previous map uses the latest earlier saved entry and requires a separate save without changing its source.

You's editor stays mounted when switching to Maya, preserving its in-memory date, painting, and note. Switching profiles during a save/copy operation is disabled. Drafts do not survive navigation away from the editor or browser reload; saved entries do. Maya's preview, history, and report are read-only and never write into You.

## History and reports

View history after saving selects the saved date, even when it lies outside the default six-week range. History reads through `HttpJournal`, restores exact maps, distinguishes empty/missing dates, and retains regional trends, playback, and comparison. Reopening, Refresh history, or returning focus refreshes saved records.

Generate report carries the profile and date range from history. `GET /api/report/entries` loads all saved maps and notes for You in one bounded PostgreSQL query. `POST /api/report/summary` accepts only profile, range, and an optional saved-record revision. It loads evidence on the server; submitted entries or ownership IDs are rejected. A changed revision requires refreshing the report before another explicit Gemini request.

Same-origin mutation checks and no-store responses remain. `DATABASE_URL`, `GEMINI_API_KEY`, and `GEMINI_MODEL` stay on the server. Saving never calls Gemini. `/api/status` reports database readiness separately from provider configuration.

## Verification

```sh
npm test
npm run typecheck
npm run build
TEST_DATABASE_URL=<local-connection-string> npm run test:journal:postgres
npm run test:local-browser
```

The PostgreSQL test creates a disposable schema and checks legacy-data preservation, exact maps/notes, daily replacement, rollback, concurrent saves, and reopening You independently of cookies. Browser acceptance starts a separate Next app and disposable schema, resets only that generated schema between tests, and disables live Gemini. Your journal is not cleared or populated by this runner.

The retained IndexedDB adapter still has unit coverage for historical data compatibility. It is not used as a fallback by the application.
