# Hack the Valley

## Pain journal

Paint four independent sensations directly on a rotatable 3D body, save a daily check-in with a note, and inspect exact saved maps in History. Maya supplies 42 clearly labeled synthetic check-ins for playback, regional intensity/coverage trends, and two-date comparison. The appointment report uses the same records and analysis, with front/back range composites and one-page A4/Letter printing.

Requires Node.js 20.19+ and npm. No external service is required for browser-local check-ins, Maya, trends, comparisons, or the factual report.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. Paint, save, reload the same date, and open History → Visitor. Copy a previous map to edit another date; an unsaved draft never becomes a recorded check-in. Missing dates remain distinct from explicitly saved empty maps.

```sh
npm test
npm run typecheck
npm run build
npm start
# With a running server:
npx playwright install chromium
npm run test:browser
# Another port: TEST_BASE_URL=http://127.0.0.1:3014 npm run test:browser
```

The [demo guide](docs/demo.md) covers painting → Maya playback → trends/comparison → report. See [integration verification](docs/integration-verification.md) for observed checks and limits.

### Storage

The default is **This browser (IndexedDB)**. **Local PostgreSQL** is an explicit alternative with temporary visitor sessions and no sign-in. The selection is shared across check-in, history, and report. Failed saves retain the draft and never change stores.

For local PostgreSQL:

```sh
docker compose -f db/compose.yml up -d --wait
cp .env.example .env.local
npm run db:migrate
npm run dev
```

For an existing ordinary PostgreSQL server, create a database, set `DATABASE_URL` in `.env.local`, and run the same migration. No TimescaleDB extension or cloud service is needed. Choose **Local PostgreSQL**, paint, save, reload the same date, then inspect Visitor history and its report. Detailed setup, the bounded repository interface, versions, and isolation are in [journal documentation](docs/journal.md).

```sh
TEST_DATABASE_URL=<local-connection-string> npm run test:journal:postgres
# With the app connected to that database:
TEST_JOURNAL_STORAGE=postgresql npm run test:browser -- tests/browser/journal-history.spec.ts
```

### Gemini report summaries

Gemini is included in the MVP. Add your own server-side settings to `.env.local` and restart the server:

```dotenv
GEMINI_API_KEY=your-key
GEMINI_MODEL=your-enabled-model-id
```

Open the report and click **Organize with Gemini** to send that report's saved facts and notes. Save never calls Gemini. Only statements validated against the evidence are displayed; missing keys, timeouts, provider failures, and invalid replies retain the labeled factual summary. Configuration is separate from PostgreSQL. See [report documentation](docs/report.md) for validation, local fake-provider checks, print behavior, and the live-verification limit.

### Assets and feature documentation

The original mannequin and attribution are in `public/body/`; regenerate with `npm run body:generate`. Regenerate Maya with `npm run demo:generate` (deterministic, no network). The [body contract](docs/body-contract.md), [editor interface](docs/body-editor.md), [history architecture](docs/history.md), and [UI direction](docs/ui-design.md) describe the shared implementation.

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
