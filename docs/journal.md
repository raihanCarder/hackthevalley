# Daily journal (Owner B)

The daily form composes the real body editor with date/note drafts and acknowledged saves. Both storage adapters use the shared lossless PNG decoder and regional reducer. History and reports read through the same bounded repository interface. Maya is an immutable source, separate from visitor records.

The retained MVP provides IndexedDB by default and explicitly selected local PostgreSQL, temporary visitor sessions, and no sign-in. The selected store is remembered across pages and reloads. Failed requests never switch stores. Gemini report summaries are included but remain independent of saving.

## Repository handoff for C and D

Import interfaces from `src/journal/repository.ts`; reuse entry/map/date types from `src/domain/contracts.ts`.

| Operation | Result |
| --- | --- |
| `list(profile, {from, to}, {signal?})` | Chronological metadata and observations without maps or notes; inclusive range of 1–366 calendar days. |
| `read(profile, date, {signal?})` | Exact saved maps/note/metadata, or `null` for no check-in. |
| `previous(profile, before, {signal?})` | Latest strictly earlier entry, skipping any number of missing days, or `null`. |
| `upsert({localDate, timeZone, maps, note?})` | Visitor-only daily replacement; resolves with saved identity and UTC `updatedAt` only after commit. |

`profile` is `"visitor" | "maya"`, not an authorization ID. The server constructs its adapter using the cookie-bound profile. IndexedDB uses a separate browser `local-<UUID>`. Mutation envelopes reject extra fields, including `profileId`, `id`, and caller-provided observations. Returned entries/summaries are detached values. Maya has no mutation method and is not copied into visitor storage.

`JournalError` codes are `invalid`, `unavailable`, `forbidden`, and `cancelled`. Missing data is exclusively `null`; unavailable storage/fixtures never become empty history. Pass an AbortSignal and guard selection revisions in consumers. PostgreSQL checks cancellation before/after its bounded query; it does not interrupt an already running statement. Server statements have a five-second timeout.

Browser consumers use `IndexedDbJournal` with `localVisitorId(window.localStorage)`, or `HttpJournal` after `bootstrap()`. Read-only server consumers use `serverRepository(profile)` in `src/journal/server/runtime.ts`; that module is guarded with `server-only`.

## Editor and Maya integration

`journalMapServices` in `src/journal/integrations.ts` validates/decodes all four layers and recomputes measurements through `body/map-utils`. It runs in browsers and Node without importing the scene. `body-editor-bridge.ts` connects the editor handle to `CheckInPanel`: snapshot captures detached buffers before encoding, restoration checks cancellation after decode, and only strokes/undo notify draft edits. Programmatic loads do not mark a saved entry unsaved.

The form keeps detached in-memory map/note drafts per store/date. Copying shows the earlier source date and requires a separate save. An empty check-in is recorded only by an acknowledged save. Rejected writes preserve the map and note, with retry in the same store. Drafts are not durable across navigation or reload; saved entries are durable. Browser unload warns about unsaved changes.

`syntheticJournalSource` exposes detached list/read/previous results from Maya's deeply frozen fixture. Synthetic reads require no database, visitor cookie, or Gemini. No synthetic mutation method exists.

## Local PostgreSQL setup

Requires Node 20.19+ and ordinary PostgreSQL. The optional Compose file binds PostgreSQL to loopback and uses development-only credentials.

```sh
npm ci
docker compose -f db/compose.yml up -d --wait
cp .env.example .env.local
npm run db:migrate
npm run dev
```

For an existing PostgreSQL installation, create a database and set its `DATABASE_URL` in `.env.local`. Migrations load Next's environment files, use a transaction advisory lock, and track applied files in `journal_migrations`. Ordinary `visitor_sessions`, `daily_entries`, and `regional_observations` tables need no extension, cloud account, or Gemini credentials.

Open http://localhost:3000 and select **Local PostgreSQL**. Paint, add a note, save, reload, and select the same date: the maps/note are restored and the daily record appears once. Open History → Visitor to inspect it.

Every profile/date is unique. The upsert replaces maps, note, and all observations in one transaction on one `pg` client. A rejected observation insert rolls the entire replacement back. Metadata queries do not fetch encoded image payloads.

```sh
# Explicit local test database, never a production database:
TEST_DATABASE_URL=postgresql://pain_journal:pain_journal@127.0.0.1:5432/pain_journal npm run test:journal:postgres
```

This command requires a real PostgreSQL database and creates/removes only a generated test schema. It checks writes/reopens, empty/missing entries, visitor isolation, concurrent replacements, and a trigger-induced insertion failure proving rollback. It uses real Maya PNG maps and the shared reducer, including a trigger-induced rejection of real regional measurements. It is excluded from credential-free `npm test`.

## Configuration and access

| Setting/contract | Behavior |
| --- | --- |
| `DATABASE_URL` | Server-only database connection; also read by the migration command. |
| `TEST_DATABASE_URL` | Opt-in local PostgreSQL test database. |
| `APP_ORIGIN` | Optional canonical origin behind a proxy; otherwise require the browser-addressed origin (request protocol + Host) for mutations. |
| `GEMINI_API_KEY` | Server-only, independent from storage; set GEMINI_MODEL as well. |
| Versions | Schema `1`, body map `mannequin-v1`, four 512 × 512 `png-base64` layers. Unsupported records show restoration errors. |
| Limits | Complete UTF-8 JSON check-in ≤6 MiB; note ≤4,000 JavaScript characters. Streaming requests are bounded before JSON parsing; A validates image content. |
| Server identity | 256-bit opaque random token, SHA-256 hash in PostgreSQL, seven-day server expiry. Cookie is HttpOnly, SameSite Strict, path `/`, Secure in production. |
| Browser identity | Persistent local UUID in localStorage; entries in IndexedDB. Tabs in the same browser profile share this local identity. This is separate from server session isolation. |

Session bootstrap and entry writes require the exact same origin. API errors are sanitized, responses are `no-store`, and saves never call Gemini. No credentials or raw database errors are returned. `/api/status` reports PostgreSQL connectivity/schema readiness separately from Gemini configuration and A/C integration readiness. A configured Gemini key is labeled unverified, not a successful provider call.

## Verification

`npm test` discovers nested feature tests and needs no database or Gemini credentials. It covers real PNG round trips, all 42 fixture/reducer agreements, browser adapter transactions, daily upserts, missing/empty dates, drafts, cancellation, limits, HTTP errors, and origin/token checks.

Real PostgreSQL acceptance passed on PostgreSQL 17.11: migration, exact maps/notes, replacement of all measurements, rollback, concurrent replacements, and visitor isolation. The assembled browser rehearsal passed against both stores, including SHA-256 equality of restored layers, source-preserving copies, missing/empty history, saved-only reports, rejected-write retry, and independent server sessions. The previous-map copy/note/save interaction was timed below 30 seconds by automation; this is not a human usability study.

For a native PostgreSQL installation, the same acceptance setup can be reproduced without Docker (use a fresh data directory):

```sh
initdb -D /tmp/pain-journal-pg -A trust --username=pain_journal --no-locale -E UTF8
pg_ctl -D /tmp/pain-journal-pg -l /tmp/pain-journal-pg.log -o '-h 127.0.0.1 -p 55432 -k /tmp' start
createdb -h 127.0.0.1 -p 55432 -U pain_journal pain_journal
DATABASE_URL=postgresql://pain_journal@127.0.0.1:55432/pain_journal npm run db:migrate
DATABASE_URL=postgresql://pain_journal@127.0.0.1:55432/pain_journal npm run dev
```

This binds to loopback and uses temporary demo records. The [integration record](integration-verification.md) contains final commands and outstanding hardware/provider limits.
