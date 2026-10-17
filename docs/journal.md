# Daily journal (Owner B)

This branch implements the repository, IndexedDB/PostgreSQL adapters, temporary sessions, API routes, date/note form, and draft handling. A's editor, PNG validator, and region reducer and C's immutable Maya reader are connected in `src/journal/integrations.ts` and `src/journal/editor.ts` (see the handoff sections). No replacement codec, reducer, renderer, or synthetic history is included.

The user requested all independently implementable B work while A works in parallel. The implementation follows the two adapters listed in task 3: IndexedDB by default and explicitly selected PostgreSQL, with temporary visitor sessions and no sign-in. The selected store is remembered in the browser. Failed requests never switch stores, including after reload. When browser preferences are blocked, a store must be selected explicitly.

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

## Handoff from A (connected)

`journalMapServices.validateAndMeasure` decodes and validates all four layers with A's `decodePaintSnapshot` and measures them with `reduceRegions`, in the browser and in Node. `createEditorBridge` in `src/journal/editor.ts` adapts A's `BodyHandle`: `snapshot` copies the buffers before encoding, `load` checks cancellation after decoding and before replacing the editor's map, `clear` loads a blank map, and `subscribe` reports only strokes and undos (it ignores the handle's replay of its latest change and programmatic loads). `CheckInWorkspace` passes the workbench's handle through this bridge. `tests/browser/journal-integration.spec.ts` paints, saves, reloads, and restores a real map.

The original handoff requirements:


Connect `journalMapServices` in `src/journal/integrations.ts` to A's real pure decoder/validator/reducer. `validateAndMeasure(snapshot)` must validate/decode all four PNG layers, enforce version/dimension/content constraints, and derive observations using A's atlas/reducer. It must work in browser and Node without importing the renderer. B validates the outer envelope and never trusts client measurements.

Adapt A's editable controller to `JournalEditorBridge` in `src/journal/editor.ts`, then pass it as `editor` to `CheckInPanel` in `check-in-workspace.tsx`:

- `snapshot()` returns detached, exact encoded layers; capture buffers before asynchronous encoding starts.
- `load(snapshot, {signal?})` and `clear({signal?})` affect only the check-in editor and check cancellation before committing decoded buffers.
- `subscribe(onEdit)` reports user strokes/erase/undo. Programmatic restoration/clearing does not emit user edits.

B's panel already orchestrates reads/restoration, previous-map copy with a source date, explicit empty maps, save/retry acknowledgments, and newer edits during pending saves. Map actions are disabled only until the editor handle has mounted. Notes remain in memory by store/date while the check-in page is open; they are not durable drafts. Browser unload warns about unsaved drafts, but app navigation can unmount them. Failed writes retain the draft.

After connecting A, verify real-map save/reopen in both stores, source immutability, cancellation during restoration, failed-write retention, and the timed 30-second previous-map edit. Structural test snapshots do not prove real-map integration.

## Handoff from C (connected)

`syntheticJournalSource` is `createMayaSource()` from `src/demo/maya-source.ts`: a read-only `list`/`read`/`previous` over the immutable fixture that rejects any profile other than `"maya"` and returns detached copies.

The original handoff requirements:


Connect `syntheticJournalSource` in `src/journal/integrations.ts` to C's immutable fixture reader. It implements only `list`, `read`, and `previous`, called with `"maya"`. C/D label consuming screens synthetic/read-only. Both adapters clone fixture results. Maya API reads require no visitor cookie, PostgreSQL, or Gemini; until the source is connected they explicitly return unavailable.

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

Open http://localhost:3000 and select **Local PostgreSQL**. After A's integration is connected, paint, add a note, save, reload, and select the same date: the maps/note must match and the daily record must appear once. Before that handoff, Save is deliberately disabled; the full walkthrough remains an outstanding acceptance check.

Every profile/date is unique. The upsert replaces maps, note, and all observations in one transaction on one `pg` client. A rejected observation insert rolls the entire replacement back. Metadata queries do not fetch encoded image payloads.

```sh
# Explicit local test database, never a production database:
TEST_DATABASE_URL=postgresql://pain_journal:pain_journal@127.0.0.1:5432/pain_journal npm run test:journal:postgres
```

This command requires a real PostgreSQL database and creates/removes only a generated test schema. It checks writes/reopens, empty/missing entries, visitor isolation, concurrent replacements, and a trigger-induced insertion failure proving rollback. It uses labeled structural maps to isolate B's storage behavior; A's real PNG/reducer acceptance is separate. It is excluded from credential-free `npm test`.

## Configuration and access

| Setting/contract | Behavior |
| --- | --- |
| `DATABASE_URL` | Server-only database connection; also read by the migration command. |
| `TEST_DATABASE_URL` | Opt-in local PostgreSQL test database. |
| `APP_ORIGIN` | Optional canonical origin behind a proxy; otherwise require the request URL's origin for mutations. |
| `GEMINI_API_KEY` | Optional, server-only, independent from storage. D owns provider verification. |
| Versions | Schema `1`, body map `mannequin-v1`, four 512 × 512 `png-base64` layers. Unsupported records show restoration errors. |
| Limits | Complete UTF-8 JSON check-in ≤6 MiB; note ≤4,000 JavaScript characters. Streaming requests are bounded before JSON parsing; A validates image content. |
| Server identity | 256-bit opaque random token, SHA-256 hash in PostgreSQL, seven-day server expiry. Cookie is HttpOnly, SameSite Strict, path `/`, Secure in production. |
| Browser identity | Persistent local UUID in localStorage; entries in IndexedDB. Tabs in the same browser profile share this local identity. This is separate from server session isolation. |

Session bootstrap and entry writes require the exact same origin. API errors are sanitized, responses are `no-store`, and saves never call Gemini. No credentials or raw database errors are returned. `/api/status` reports PostgreSQL connectivity/schema readiness separately from Gemini configuration and A/C integration readiness. A configured Gemini key is labeled unverified, not a successful provider call.

## Verification and remaining acceptance

```sh
npm test
npm run typecheck
npm run build
# Start the app first; use its actual origin for development:
TEST_BASE_URL=http://localhost:3000 npm run test:browser
```

The shared runner discovers all `tests/**/*.test.ts`, including A/C/D's future feature directories. The explicit PostgreSQL test uses the `.integration.ts` suffix and is run separately.

Unit checks cover actual IndexedDB adapter transactions with fake-indexeddb, reopening/upserts/isolation, aborted writes, payload limits, draft copy/rejection/revisions, HTTP failures, and origin/token validation. Browser checks cover note/date drafts, failed store selection, stale reads using test-only intercepted responses, API rejection, responsive layout, and the original scene. Mocked maps and responses are confined to tests.

Task 3 checkboxes remain pending until A/C integration and real setup/usability acceptance pass. Task 6 needs all four shipped features and cannot be completed by this branch alone.

For this branch's review, all 24 credential-free tests, TypeScript, the production build, all 11 browser checks, and strict OpenSpec validation passed. Browser checks ran against the separate production server on port 3013; desktop/tablet/phone screenshots were inspected. Docker's daemon was unreachable and no local PostgreSQL binaries were present, so the opt-in real PostgreSQL test and the complete setup/save/reload walkthrough have not been verified here. No 30-second usability result is claimed before A's editor is connected.
