# Hack the Valley

## Pain journal

Paint four independent sensations directly on a rotatable 3D body, save a daily check-in with a note, and inspect exact saved maps in History. Maya supplies 42 clearly labeled synthetic check-ins for playback, regional intensity/coverage trends, and two-date comparison. The appointment report uses the same records and analysis, with front/back range composites and one-page A4/Letter printing.

Requires Node.js 20.19+, npm, and local PostgreSQL for your journal. Maya and her factual report work without PostgreSQL or Gemini.

```sh
npm ci
docker compose -f db/compose.yml up -d --wait
# Add DATABASE_URL to .env.local (see .env.example); preserve existing Gemini settings.
npm run db:migrate
npm run dev
```

Open http://localhost:3000. Click the profile icon to choose **You** or **Maya**. Paint under You, save, reload the same date, and open History. Copy a previous map to edit another date; an unsaved draft never becomes a recorded check-in. Missing dates remain distinct from explicitly saved empty maps.

```sh
npm test
npm run typecheck
npm run build
npm start
# Browser acceptance starts an isolated app and temporary PostgreSQL schema:
npx playwright install chromium
npm run test:local-browser
```

The [demo guide](docs/demo.md) covers painting → Maya playback → trends/comparison → report. See [integration verification](docs/integration-verification.md) for observed checks and limits.

### Storage

There are exactly two visible profiles, selected from the profile icon on desktop or mobile:

- **You** uses one persistent journal in PostgreSQL on this device. Closing the browser, clearing cookies, or restarting the app does not change its ownership. Browsers connected to this local installation open the same journal.
- **Maya** uses the immutable, synthetic six-week sample. It is read-only throughout the application.

PostgreSQL is the application's save location. Failed saves preserve your draft and offer retry. Existing IndexedDB records and historical visitor records are preserved but are not automatically imported into You's journal.

For an existing PostgreSQL server, set `DATABASE_URL` in `.env.local` and run `npm run db:migrate`. No extension or cloud service is needed. When Docker is unavailable and Homebrew PostgreSQL 17 is installed, start it with `pg_ctl -D /opt/homebrew/var/postgresql@17 -l /tmp/pain-journal-postgres.log -o '-h 127.0.0.1 -p 5432' start`; the database and login named in `DATABASE_URL` must exist. See [journal documentation](docs/journal.md).

```sh
TEST_DATABASE_URL=<local-connection-string> npm run test:journal:postgres
npm run test:local-browser
```

Both database acceptance commands create and remove generated test schemas. Browser tests run with Gemini disabled; they do not write test check-ins to your journal or make live-provider calls.

### Gemini report summaries

Gemini is included in the MVP. Add your own server-side settings to `.env.local` and restart the server:

```dotenv
GEMINI_API_KEY=your-key
GEMINI_MODEL=your-enabled-model-id
```

Open the report and click **Generate Gemini summary** to send that report's saved facts and notes. Save never calls Gemini. Only statements validated against the evidence are displayed; missing keys, timeouts, provider failures, and invalid replies retain the labeled factual summary. Configuration is separate from PostgreSQL. See [report documentation](docs/report.md) for validation, local fake-provider checks, print behavior, and the live-verification limit.

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
