# Hack the Valley

## Pain journal

The Next.js App Router / React / TypeScript app includes a browser-only Three.js mannequin and Owner B's journal infrastructure. Rotate by dragging, use named views, or focus the canvas and use arrow keys, +/−, and Home. The check-in page adds date-specific note drafts and explicit browser/PostgreSQL store selection. History and report routes remain labeled placeholders.

Owner A is implementing painting and real map validation/reduction separately. Until those are connected, body-map save/copy/empty actions are disabled; notes are unsaved page-local drafts. Owner C's read-only Maya fixture is also pending. No test fixture is used as real journal history.

Requires Node.js 20.19+ and npm (verified with Node 22.16.0).

```sh
npm ci
npm run dev
```

Open http://localhost:3000. The Node-runtime foundation endpoint is `/api/status`.

```sh
npm test
npm run typecheck
npm run build
npm start
```

Browser verification (start the dev or production server first):

```sh
npx playwright install chromium
npm run test:browser
# For another port: TEST_BASE_URL=http://127.0.0.1:3001 npm run test:browser
```

The original mannequin and attribution live in `public/body/`; regenerate it with `npm run body:generate`. The [body/entry contract](docs/body-contract.md) records coordinates, UVs, regions, and versions. The [UI direction](docs/ui-design.md) covers layout and accessible controls.

### Journal storage and handoffs

The default mode is IndexedDB, with explicitly selected local PostgreSQL and temporary visitor sessions; no sign-in or Gemini key is needed. Failed server requests preserve drafts and the selected store. Both adapters expose the same bounded list/read/previous/upsert interface. The [journal documentation](docs/journal.md) describes interfaces for A/C/D, configuration, and remaining real-map acceptance checks.

Optional local PostgreSQL setup:

```sh
docker compose -f db/compose.yml up -d --wait
cp .env.example .env.local
npm run db:migrate
npm run dev
```

For an existing ordinary PostgreSQL database, set `DATABASE_URL` in `.env.local` and run the migration command. No TimescaleDB or cloud service is required. Choose **Local PostgreSQL** in the form. After A's map integration lands, verify a painted check-in saves and reloads exactly; that end-to-end check is still pending. Keep database/Gemini credentials server-only.

Run storage checks with `TEST_DATABASE_URL=<local-connection-string> npm run test:journal:postgres`. This uses a temporary test schema and verifies rollback and visitor isolation. Regular `npm test` requires no database/Gemini credentials and discovers nested feature tests.

## OpenSpec (optional)

[OpenSpec](https://github.com/Fission-AI/OpenSpec) helps you plan changes with an AI coding assistant before implementing them. It keeps proposals, requirements, designs, and task lists in `openspec/` so the team can review the plan alongside the code.

This repo already includes OpenSpec configuration and Codex skills in `.agents/skills/`.

### Install

Requires Node.js 20.19.0 or newer and npm. Install the CLI on your machine:

```sh
npm install -g @fission-ai/openspec@latest
openspec --version
```

For a new project, initialize OpenSpec from its root with Codex selected:

```sh
openspec init --tools codex
```

This repo is already initialized, so you can skip that step.

### Use with Codex

In a Codex conversation opened in this repo, start a proposal:

```text
$openspec-propose "Describe the feature or fix"
```

Review the generated plan, then use `$openspec-apply-change` to implement it. After implementation is complete, use `$openspec-archive-change` to archive it.

See the [installation guide](https://github.com/Fission-AI/OpenSpec/blob/main/docs/installation.md) for more setup options.
